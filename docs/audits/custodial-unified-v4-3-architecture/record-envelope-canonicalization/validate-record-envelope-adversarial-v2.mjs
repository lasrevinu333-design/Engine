import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VALIDATOR_VERSION = "CUSTODIAL_V43_RECORD_ENVELOPE_ADVERSARIAL_VALIDATOR_V2";
const ROOT = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(ROOT, "..");
const read = (name) => readFileSync(resolve(ROOT, name), "utf8");
const json = (name) => JSON.parse(read(name));
const readParentJson = (name) => JSON.parse(readFileSync(resolve(PACKAGE_ROOT, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clone = (value) => structuredClone(value);

function failure(code, detail = "") {
  const error = new Error(code + (detail ? ": " + detail : ""));
  error.code = code;
  throw error;
}
function assert(condition, code, detail = "") {
  if (!condition) failure(code, detail);
}
function unique(values, code) {
  assert(new Set(values).size === values.length, code);
}
function pointerEscape(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
function codePointCompare(a, b) {
  const aa = Array.from(a, (x) => x.codePointAt(0));
  const bb = Array.from(b, (x) => x.codePointAt(0));
  for (let i = 0; i < Math.min(aa.length, bb.length); i += 1) {
    if (aa[i] !== bb[i]) return aa[i] - bb[i];
  }
  return aa.length - bb.length;
}
function canonicalString(value) {
  return JSON.stringify(value);
}
function pathMode(path, policies) {
  return policies.find((entry) => entry.path === path)?.mode ?? null;
}
function normalizeCanonical(value, path, policies, requireCanonicalInput = true) {
  if (typeof value === "string") {
    const normalized = value.normalize("NFC");
    if (requireCanonicalInput && normalized !== value) failure("RECORD_V2_NON_NFC_STRING", path);
    return normalized;
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) failure("RECORD_V2_INTEGER_NOT_CANONICAL", path);
    return value;
  }
  if (Array.isArray(value)) {
    const mode = pathMode(path, policies);
    if (!mode) failure("RECORD_V2_ARRAY_POLICY_MISSING", path);
    const normalized = value.map((item) => normalizeCanonical(item, path + "/*", policies, requireCanonicalInput));
    if (mode === "ordered") return normalized;
    if (mode === "set_sorted_by_canonical_utf8_bytes") {
      const indexed = normalized.map((item) => ({ item, bytes: Buffer.from(canonicalString(item), "utf8") }));
      indexed.sort((a, b) => Buffer.compare(a.bytes, b.bytes));
      for (let i = 1; i < indexed.length; i += 1) {
        if (Buffer.compare(indexed[i - 1].bytes, indexed[i].bytes) === 0) failure("RECORD_V2_SET_DUPLICATE", path);
      }
      const sorted = indexed.map((entry) => entry.item);
      if (requireCanonicalInput && JSON.stringify(sorted) !== JSON.stringify(normalized)) failure("RECORD_V2_SET_ORDER", path);
      return sorted;
    }
    failure("RECORD_V2_ARRAY_POLICY_INVALID", path);
  }
  if (value && typeof value === "object") {
    const normalizedKeys = new Map();
    for (const key of Object.keys(value)) {
      const normalized = key.normalize("NFC");
      if (requireCanonicalInput && normalized !== key) failure("RECORD_V2_NON_NFC_KEY", path + "/" + key);
      if (normalizedKeys.has(normalized)) failure("RECORD_V2_NFC_KEY_COLLISION", path + "/" + normalized);
      normalizedKeys.set(normalized, key);
    }
    const out = {};
    for (const key of [...normalizedKeys.keys()].sort(codePointCompare)) {
      out[key] = normalizeCanonical(value[normalizedKeys.get(key)], path + "/" + pointerEscape(key), policies, requireCanonicalInput);
    }
    return out;
  }
  failure("RECORD_V2_UNSUPPORTED_VALUE", path);
}
function canonicalBytes(value, policies, requireCanonicalInput = true) {
  return Buffer.from(JSON.stringify(normalizeCanonical(value, "", policies, requireCanonicalInput)), "utf8");
}

function scanCanonicalRawJson(raw) {
  let i = 0;
  const skip = () => { while (/\s/.test(raw[i] ?? "")) i += 1; };
  function parseString() {
    if (raw[i] !== '"') failure("RECORD_V2_RAW_JSON", "expected string");
    const start = i;
    i += 1;
    let escaped = false;
    while (i < raw.length) {
      const ch = raw[i];
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') {
        i += 1;
        const value = JSON.parse(raw.slice(start, i));
        if (value !== value.normalize("NFC")) failure("RECORD_V2_NON_NFC_STRING", value);
        return value;
      }
      i += 1;
    }
    failure("RECORD_V2_RAW_JSON", "unterminated string");
  }
  function parseNumber() {
    const start = i;
    while (/[0-9eE+\-.]/.test(raw[i] ?? "")) i += 1;
    const token = raw.slice(start, i);
    if (!/^-?(0|[1-9][0-9]*)$/.test(token) || token === "-0") failure("RECORD_V2_INTEGER_TOKEN", token);
    const value = Number(token);
    if (!Number.isSafeInteger(value)) failure("RECORD_V2_INTEGER_RANGE", token);
  }
  function literal(token) {
    if (raw.slice(i, i + token.length) !== token) failure("RECORD_V2_RAW_JSON", token);
    i += token.length;
  }
  function array() {
    i += 1; skip();
    if (raw[i] === "]") { i += 1; return; }
    while (true) {
      value(); skip();
      if (raw[i] === "]") { i += 1; return; }
      if (raw[i] !== ",") failure("RECORD_V2_RAW_JSON", "array comma");
      i += 1; skip();
    }
  }
  function object() {
    i += 1; skip();
    const exact = new Set();
    const normalized = new Set();
    if (raw[i] === "}") { i += 1; return; }
    while (true) {
      const key = parseString();
      if (exact.has(key)) failure("RECORD_V2_DUPLICATE_KEY", key);
      exact.add(key);
      const nfc = key.normalize("NFC");
      if (normalized.has(nfc)) failure("RECORD_V2_NFC_KEY_COLLISION", key);
      normalized.add(nfc);
      skip();
      if (raw[i] !== ":") failure("RECORD_V2_RAW_JSON", "object colon");
      i += 1; skip(); value(); skip();
      if (raw[i] === "}") { i += 1; return; }
      if (raw[i] !== ",") failure("RECORD_V2_RAW_JSON", "object comma");
      i += 1; skip();
    }
  }
  function value() {
    skip();
    const ch = raw[i];
    if (ch === "{") return object();
    if (ch === "[") return array();
    if (ch === '"') { parseString(); return; }
    if (ch === "t") return literal("true");
    if (ch === "f") return literal("false");
    if (ch === "n") return literal("null");
    return parseNumber();
  }
  value(); skip();
  if (i !== raw.length) failure("RECORD_V2_RAW_JSON", "trailing bytes");
  return JSON.parse(raw);
}

const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA = /^[0-9a-f]{64}$/;

function strictDate(value) {
  assert(DATE.test(value), "RECORD_V2_SERVICE_DATE", value);
  const [year, month, day] = value.split("-").map(Number);
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  assert(
    roundTrip.getUTCFullYear() === year && roundTrip.getUTCMonth() === month - 1 && roundTrip.getUTCDate() === day,
    "RECORD_V2_SERVICE_DATE",
    value,
  );
  return { year, month, day };
}
function nthWeekday(year, monthIndex, weekday, nth) {
  const first = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
}
function validateServiceTime(record, contract) {
  if (!Object.hasOwn(record, "service_date")) return;
  const { year, month, day } = strictDate(record.service_date);
  const service = contract.canonical_json.service_time;
  assert(record.service_time_zone === service.time_zone, "RECORD_V2_SERVICE_ZONE");
  assert(service.ruleset_revision === "america-chicago-us-2007-2037.v1", "RECORD_V2_SERVICE_RULESET");
  assert(
    Array.isArray(service.supported_year_range) &&
      service.supported_year_range.length === 2 &&
      year >= service.supported_year_range[0] &&
      year <= service.supported_year_range[1],
    "RECORD_V2_SERVICE_RULESET_RANGE",
    String(year),
  );
  assert(
    Number.isSafeInteger(record.service_day_offset_minutes) &&
      record.service_day_offset_minutes >= 0 &&
      record.service_day_offset_minutes <= 1439,
    "RECORD_V2_SERVICE_OFFSET",
  );
  const offset = record.service_day_offset_minutes;
  const dstStart = nthWeekday(year, 2, 0, 2);
  const dstEnd = nthWeekday(year, 10, 0, 1);
  if (month === 3 && day === dstStart && offset >= 120 && offset < 180) {
    failure("RECORD_V2_SERVICE_TIME_NONEXISTENT");
  }
  if (month === 11 && day === dstEnd && offset >= 60 && offset < 120) {
    assert([0, 1].includes(record.service_time_fold), "RECORD_V2_SERVICE_TIME_FOLD");
  }
}
function validateTimestamps(record) {
  for (const field of ["valid_time_start", "recorded_at", "occurred_at"]) {
    assert(TS.test(record[field] ?? ""), "RECORD_V2_TIMESTAMP", field);
    assert(new Date(record[field]).toISOString() === record[field], "RECORD_V2_TIMESTAMP", field);
  }
  if (Object.hasOwn(record, "valid_time_end") && record.valid_time_end !== null) {
    assert(TS.test(record.valid_time_end), "RECORD_V2_TIMESTAMP", "valid_time_end");
    assert(new Date(record.valid_time_end).toISOString() === record.valid_time_end, "RECORD_V2_TIMESTAMP", "valid_time_end");
  }
}
function wireFields(contract) {
  return contract.envelope.fields.filter((field) => field.presence !== "registry_inherited");
}
function validateTopLevel(record, contract) {
  const allowed = new Set(wireFields(contract).map((field) => field.name));
  for (const key of Object.keys(record)) assert(allowed.has(key), "RECORD_V2_UNKNOWN_TOP_LEVEL_FIELD", key);
  for (const field of wireFields(contract)) {
    if (field.presence === "wire_required") assert(Object.hasOwn(record, field.name), "RECORD_V2_REQUIRED_FIELD", field.name);
  }
  assert(record.domain_payload && typeof record.domain_payload === "object" && !Array.isArray(record.domain_payload), "RECORD_V2_DOMAIN_PAYLOAD");
  for (const field of contract.envelope.fields.filter((item) => item.json_type === "integer")) {
    if (Object.hasOwn(record, field.name)) {
      assert(Number.isSafeInteger(record[field.name]) && !Object.is(record[field.name], -0), "RECORD_V2_INTEGER_NOT_CANONICAL", field.name);
    }
  }
}
function validateConditions(record, contract, activeIds) {
  const active = new Set(activeIds);
  const conditions = new Map(contract.envelope.conditions.map((condition) => [condition.id, condition]));
  for (const id of active) assert(conditions.has(id), "RECORD_V2_CONDITION_UNKNOWN", id);
  for (const field of contract.envelope.fields.filter((item) => item.presence === "wire_conditional")) {
    if (active.has(field.condition)) assert(Object.hasOwn(record, field.name), "RECORD_V2_CONDITIONAL_FIELD_MISSING", field.name);
    else assert(!Object.hasOwn(record, field.name), "RECORD_V2_CONDITIONAL_FIELD_UNEXPECTED", field.name);
  }
}
function expectedContext(record, activeIds) {
  const active = new Set(activeIds);
  const out = {
    principal_id: record.principal_id,
    actor_snapshot_digest: record.actor_snapshot_digest,
  };
  if (active.has("COND-AUTHORIZATION")) {
    out.authorization_decision_id = record.authorization_decision_id;
    out.authorization_snapshot_digest = record.authorization_snapshot_digest;
  }
  if (active.has("COND-CREDENTIAL-CONTEXT")) out.credential_id = record.credential_id;
  if (active.has("COND-SESSION-CONTEXT")) out.session_id = record.session_id;
  if (active.has("COND-DEVICE-CONTEXT")) out.device_id = record.device_id;
  if (active.has("COND-ASSIGNMENT-EPOCH")) out.assignment_epoch_id = record.assignment_epoch_id;
  return out;
}
function validateOriginalContext(record, context) {
  for (const [field, expected] of Object.entries(context)) {
    assert(record[field] === expected, field.startsWith("authorization_") ? "RECORD_V2_ORIGINAL_AUTHORIZATION" : "RECORD_V2_ORIGINAL_ACTOR_CONTEXT", field);
  }
}
function validateVersion(record, supported) {
  assert(supported.includes(record.schema_version), "RECORD_V2_UNKNOWN_VERSION", record.schema_version);
}
function payloadPolicies(fixtures) {
  return fixtures.array_policies
    .filter((entry) => entry.path.startsWith("/domain_payload"))
    .map((entry) => ({ ...entry, path: entry.path.slice("/domain_payload".length) || "" }));
}
function finalizeRecord(record, rawPayload, fixtures) {
  record.source_bytes_digest = sha256(Buffer.from(rawPayload, "utf8"));
  record.payload_digest = sha256(canonicalBytes(record.domain_payload, payloadPolicies(fixtures), true));
  const view = clone(record);
  delete view.source_bytes_digest;
  delete view.normalized_content_digest;
  delete view.payload_digest;
  record.normalized_content_digest = sha256(canonicalBytes(view, fixtures.array_policies, true));
  return record;
}
function validateDigests(record, rawPayload, fixtures) {
  for (const field of ["source_bytes_digest", "normalized_content_digest", "payload_digest"]) {
    assert(SHA.test(record[field] ?? ""), "RECORD_V2_DIGEST_FORMAT", field);
  }
  assert(sha256(Buffer.from(rawPayload, "utf8")) === record.source_bytes_digest, "RECORD_V2_SOURCE_DIGEST");
  assert(sha256(canonicalBytes(record.domain_payload, payloadPolicies(fixtures), true)) === record.payload_digest, "RECORD_V2_PAYLOAD_DIGEST");
  const view = clone(record);
  delete view.source_bytes_digest;
  delete view.normalized_content_digest;
  delete view.payload_digest;
  assert(sha256(canonicalBytes(view, fixtures.array_policies, true)) === record.normalized_content_digest, "RECORD_V2_NORMALIZED_DIGEST");
}
function validateRecord(record, contract, fixtures, activeIds, rawPayload, context, supportedVersions) {
  validateTopLevel(record, contract);
  validateConditions(record, contract, activeIds);
  validateTimestamps(record);
  validateServiceTime(record, contract);
  validateOriginalContext(record, context);
  validateVersion(record, supportedVersions);
  validateDigests(record, rawPayload, fixtures);
  scanCanonicalRawJson(canonicalBytes(record, fixtures.array_policies, true).toString("utf8"));
  return canonicalBytes(record, fixtures.array_policies, true).toString("utf8");
}

function makeVariant(base, variant, contract, fixtures) {
  const record = clone(base);
  record.record_id = `rec_${variant.id}`;
  record.record_class = variant.record_class;
  record.record_type = variant.record_type;
  record.aggregate_id = `aggregate_${variant.id}`;
  record.operation_id = `operation_${variant.id}`;
  record.idempotency_key = `idempotency:${variant.id}`;
  record.correlation_id = null;
  record.causation_id = null;
  record.valid_time_start = "2026-08-06T14:30:00.000Z";
  record.recorded_at = "2026-08-06T14:30:01.000Z";
  record.occurred_at = "2026-08-06T14:30:00.000Z";
  record.domain_payload = { fixture_id: variant.id };
  const active = new Set(variant.active_conditions);

  for (const field of contract.envelope.fields.filter((item) => item.presence === "wire_conditional")) {
    if (!active.has(field.condition)) delete record[field.name];
  }
  if (active.has("COND-AGGREGATE-SEQUENCE")) {
    record.ordering_rule = "aggregate_sequence";
    record.aggregate_sequence = 1;
  } else {
    record.ordering_rule = "record_id_lexical";
    delete record.aggregate_sequence;
  }
  if (active.has("COND-VALID-INTERVAL")) {
    record.valid_time_kind = "interval";
    record.valid_time_end = "2026-08-06T15:30:00.000Z";
  } else {
    record.valid_time_kind = "instant";
    delete record.valid_time_end;
  }
  if (active.has("COND-SERVICE-TIME")) {
    record.service_date = "2026-08-06";
    record.service_day_offset_minutes = 570;
    record.service_time_zone = "America/Chicago";
  }
  if (active.has("COND-DST-AMBIGUOUS")) record.service_time_fold = 0;
  if (active.has("COND-AUTHORIZATION")) {
    record.authorization_decision_id = `authz_${variant.id}`;
    record.authorization_snapshot_digest = "b".repeat(64);
  }
  if (active.has("COND-CREDENTIAL-CONTEXT")) record.credential_id = `credential_${variant.id}`;
  if (active.has("COND-SESSION-CONTEXT")) record.session_id = `session_${variant.id}`;
  if (active.has("COND-DEVICE-CONTEXT")) record.device_id = `device_${variant.id}`;
  if (active.has("COND-ASSIGNMENT-EPOCH")) record.assignment_epoch_id = `epoch_${variant.id}`;
  if (active.has("COND-SOURCE-EVIDENCE")) {
    record.source_artifact_id = `source_${variant.id}`;
    record.source_revision = "source.v1";
    record.source_confidence = "direct";
  }
  const rawPayload = JSON.stringify(record.domain_payload);
  finalizeRecord(record, rawPayload, fixtures);
  return { id: variant.id, record, rawPayload, activeIds: variant.active_conditions, context: expectedContext(record, variant.active_conditions) };
}

function validateLineageGraph(records) {
  const graph = new Map(records.map((record) => [record.record_id, record.derives_from_record_ids.filter((id) => records.some((candidate) => candidate.record_id === id))]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) failure("RECORD_V2_LINEAGE_GRAPH_CYCLE", id);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of graph.get(id) ?? []) visit(next);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of graph.keys()) visit(id);
}
function validateStrengthening(contract, strengthening, baseRegistry) {
  const baseIds = [...new Set(baseRegistry.records.map((record) => record.id))].sort();
  const contractIds = contract.per_record_strengthening.profiles.map((profile) => profile.record_type).sort();
  const projectionIds = strengthening.profiles.map((profile) => profile.record_type).sort();
  assert(JSON.stringify(baseIds) === JSON.stringify(contractIds), "RECORD_V2_PROFILE_COVERAGE");
  assert(JSON.stringify(contractIds) === JSON.stringify(projectionIds), "RECORD_V2_PROFILE_PROJECTION");
  const conditions = new Set(contract.envelope.conditions.map((condition) => condition.id));
  for (const profile of contract.per_record_strengthening.profiles) {
    assert(profile.base_contract === contract.envelope.contract_id, "RECORD_V2_PROFILE_BASE", profile.record_type);
    assert(profile.may_remove_fields === false, "RECORD_V2_PROFILE_FIELD_REMOVAL", profile.record_type);
    assert(profile.may_widen_types === false, "RECORD_V2_PROFILE_TYPE_WIDENING", profile.record_type);
    assert(profile.may_weaken_conditions === false, "RECORD_V2_PROFILE_CONDITION_WEAKENING", profile.record_type);
    for (const id of profile.required_conditions) assert(conditions.has(id), "RECORD_V2_PROFILE_CONDITION_UNKNOWN", id);
  }
  assert(JSON.stringify(strengthening.profiles) === JSON.stringify(contract.per_record_strengthening.profiles), "RECORD_V2_PROFILE_PROJECTION");
  const signature = sha256(Buffer.from(JSON.stringify(contract.envelope.fields), "utf8"));
  return signature;
}
function expectCode(code, fn, id) {
  let observed = null;
  try { fn(); } catch (error) { observed = error.code ?? error.message; }
  assert(observed === code, "RECORD_V2_ATTACK_MISMATCH", `${id}:${observed}`);
  return { id, expected: code, observed };
}

const contract = json("record-envelope-contract.json");
const fixtures = json("conformance-fixtures.json");
const strengthening = json("record-type-strengthening-map.json");
const baseRegistry = readParentJson("phase1-foundation-registry.json");

assert(contract.envelope.fields.some((field) => field.name === "domain_payload" && field.json_type === "object" && field.presence === "wire_required"), "RECORD_V2_DOMAIN_PAYLOAD_CONTRACT");
assert(contract.canonical_json.integers?.safe_min === -9007199254740991, "RECORD_V2_INTEGER_CONTRACT");
assert(contract.canonical_json.integers?.safe_max === 9007199254740991, "RECORD_V2_INTEGER_CONTRACT");
assert(contract.canonical_json.integers?.exponent === "forbidden", "RECORD_V2_INTEGER_CONTRACT");
assert(contract.canonical_json.service_time?.ruleset_revision === "america-chicago-us-2007-2037.v1", "RECORD_V2_SERVICE_RULESET");
assert(JSON.stringify(contract.canonical_json.service_time?.supported_year_range) === JSON.stringify([2007, 2037]), "RECORD_V2_SERVICE_RULESET_RANGE");

const primary = clone(fixtures.positive.record);
delete primary.valid_time_end;
delete primary.service_time_fold;
const primaryRaw = fixtures.positive.raw_domain_payload;
finalizeRecord(primary, primaryRaw, fixtures);
const primaryContext = expectedContext(primary, fixtures.positive.active_conditions);
const positives = [{
  id: fixtures.positive.id,
  record: primary,
  rawPayload: primaryRaw,
  activeIds: fixtures.positive.active_conditions,
  context: primaryContext,
}];
for (const variant of fixtures.profile_variants) positives.push(makeVariant(primary, variant, contract, fixtures));
assert(positives.length === 5, "RECORD_V2_POSITIVE_FIXTURE_COUNT");
for (const fixture of positives) validateRecord(fixture.record, contract, fixtures, fixture.activeIds, fixture.rawPayload, fixture.context, ["1.0.0"]);

const attacks = [];
attacks.push(expectCode("RECORD_V2_UNKNOWN_TOP_LEVEL_FIELD", () => {
  const record = clone(primary); record.rogue_field = true;
  validateTopLevel(record, contract);
}, "unknown_top_level_field"));
attacks.push(expectCode("RECORD_V2_INTEGER_NOT_CANONICAL", () => {
  const record = clone(primary); record.authority_set_generation = Number.MAX_SAFE_INTEGER + 1;
  validateTopLevel(record, contract);
}, "unsafe_integer"));
attacks.push(expectCode("RECORD_V2_INTEGER_TOKEN", () => scanCanonicalRawJson('{"x":1e3}'), "integer_exponent"));
attacks.push(expectCode("RECORD_V2_INTEGER_RANGE", () => scanCanonicalRawJson('{"x":9007199254740992}'), "integer_range"));
attacks.push(expectCode("RECORD_V2_INTEGER_TOKEN", () => scanCanonicalRawJson('{"x":-0}'), "integer_negative_zero"));
attacks.push(expectCode("RECORD_V2_SERVICE_DATE", () => {
  const record = clone(primary); record.service_date = "2026-02-30";
  validateServiceTime(record, contract);
}, "invalid_service_date"));
attacks.push(expectCode("RECORD_V2_ORIGINAL_ACTOR_CONTEXT", () => {
  const record = clone(primary); record.principal_id = "employee:current-assignee";
  validateOriginalContext(record, primaryContext);
}, "current_actor_substitution"));
attacks.push(expectCode("RECORD_V2_ORIGINAL_AUTHORIZATION", () => {
  const record = clone(primary); record.authorization_decision_id = "authz_current";
  validateOriginalContext(record, primaryContext);
}, "current_authorization_substitution"));
attacks.push(expectCode("RECORD_V2_UNKNOWN_VERSION", () => {
  const record = clone(primary); record.schema_version = "99.0.0";
  validateVersion(record, ["1.0.0"]);
}, "unknown_version"));
attacks.push(expectCode("RECORD_V2_CONDITIONAL_FIELD_UNEXPECTED", () => {
  const fixture = makeVariant(primary, fixtures.profile_variants[0], contract, fixtures);
  fixture.record.credential_id = "rogue";
  validateConditions(fixture.record, contract, fixture.activeIds);
}, "inactive_conditional_field"));
attacks.push(expectCode("RECORD_V2_CONDITIONAL_FIELD_MISSING", () => {
  const record = clone(primary); delete record.assignment_epoch_id;
  validateConditions(record, contract, fixtures.positive.active_conditions);
}, "active_conditional_field_missing"));
attacks.push(expectCode("RECORD_V2_LINEAGE_GRAPH_CYCLE", () => {
  validateLineageGraph([
    { record_id: "a", derives_from_record_ids: ["b"] },
    { record_id: "b", derives_from_record_ids: ["a"] },
  ]);
}, "multi_record_lineage_cycle"));
attacks.push(expectCode("RECORD_V2_NON_NFC_STRING", () => scanCanonicalRawJson('{"notes":"Café"}'), "whole_record_non_nfc"));
attacks.push(expectCode("RECORD_V2_PROFILE_FIELD_REMOVAL", () => {
  const modified = clone(contract);
  modified.per_record_strengthening.profiles[0].may_remove_fields = true;
  validateStrengthening(modified, strengthening, baseRegistry);
}, "profile_field_removal"));
attacks.push(expectCode("RECORD_V2_PROFILE_TYPE_WIDENING", () => {
  const modified = clone(contract);
  modified.per_record_strengthening.profiles[0].may_widen_types = true;
  validateStrengthening(modified, strengthening, baseRegistry);
}, "profile_type_widening"));
attacks.push(expectCode("RECORD_V2_PROFILE_CONDITION_WEAKENING", () => {
  const modified = clone(contract);
  modified.per_record_strengthening.profiles[0].may_weaken_conditions = true;
  validateStrengthening(modified, strengthening, baseRegistry);
}, "profile_condition_weakening"));

validateLineageGraph(positives.map((fixture) => fixture.record));
const fieldSignature = validateStrengthening(contract, strengthening, baseRegistry);

const result = {
  protocol: "CUSTODIAL_V43_RECORD_ENVELOPE_ADVERSARIAL_RESULT_V2",
  status: "PASS",
  validator: VALIDATOR_VERSION,
  contract_id: contract.envelope.contract_id,
  canonicalization_id: contract.canonical_json.contract_id,
  positive_fixture_count: positives.length,
  conditional_branch_count: new Set(positives.flatMap((fixture) => fixture.activeIds)).size,
  adversarial_attack_count: attacks.length,
  envelope_field_count: contract.envelope.fields.length,
  envelope_field_signature_sha256: fieldSignature,
  source_base: contract.source_authority.phase1_review_head,
  downstream_authority: contract.downstream_authority,
};
const resultText = JSON.stringify(result, null, 2) + "\n";
const resultPath = resolve(ROOT, "adversarial-validation-result.json");
const mode = process.argv[2] ?? "--check";
if (mode === "--refresh-fixture") {
  fixtures.positive.record = primary;
  fixtures.positive.expected.canonical_record_utf8 = canonicalBytes(primary, fixtures.array_policies, true).toString("utf8");
  fixtures.positive.expected.source_bytes_digest = primary.source_bytes_digest;
  fixtures.positive.expected.payload_digest = primary.payload_digest;
  fixtures.positive.expected.normalized_content_digest = primary.normalized_content_digest;
  writeFileSync(resolve(ROOT, "conformance-fixtures.json"), JSON.stringify(fixtures, null, 2) + "\n");
} else if (mode === "--write") {
  writeFileSync(resultPath, resultText);
} else if (mode === "--check") {
  assert(readFileSync(resultPath, "utf8") === resultText, "RECORD_V2_RESULT_STALE");
} else {
  failure("RECORD_V2_ARGUMENT", mode);
}
console.log(JSON.stringify(result));
