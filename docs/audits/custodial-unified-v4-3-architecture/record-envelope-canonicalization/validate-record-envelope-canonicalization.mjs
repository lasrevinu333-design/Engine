import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  collectConstraints,
  mutateConstraint,
  stableError,
  validateAgainstSchema,
} from "../generate-architecture-projections.mjs";

export const VALIDATOR_VERSION = "CUSTODIAL_V43_RECORD_ENVELOPE_VALIDATOR_V2";
const ROOT = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(ROOT, "..");
const REPO_ROOT = resolve(ROOT, "../../../..");
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
function runGit(args, allowFailure = false) {
  const result = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (!allowFailure && result.status !== 0) failure("RECORD_GIT_COMMAND_FAILED", args.join(" ") + "\n" + result.stderr);
  return result;
}
function gitBlob(path) {
  return runGit(["hash-object", path]).stdout.trim();
}
function gitHead() {
  return runGit(["rev-parse", "HEAD"]).stdout.trim();
}
function pointerEscape(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
function pointerGet(root, pointer) {
  if (pointer === "") return root;
  let current = root;
  for (const part of pointer.slice(1).split("/").map((x) => x.replaceAll("~1", "/").replaceAll("~0", "~"))) {
    current = current[part];
  }
  return current;
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
  const exact = policies.find((x) => x.path === path);
  if (exact) return exact.mode;
  return null;
}
function normalizeCanonical(value, path, policies, requireCanonicalInput = true) {
  if (typeof value === "string") return value.normalize("NFC");
  if (value === null || typeof value === "boolean" || Number.isInteger(value)) return value;
  if (typeof value === "number") failure("RECORD_CANON_NON_INTEGER_NUMBER", path);
  if (Array.isArray(value)) {
    const mode = pathMode(path, policies);
    if (!mode) failure("RECORD_CANON_ARRAY_POLICY_MISSING", path);
    const normalized = value.map((item) => normalizeCanonical(item, path + "/*", policies, requireCanonicalInput));
    if (mode === "ordered") return normalized;
    if (mode === "set_sorted_by_canonical_utf8_bytes") {
      const indexed = normalized.map((item) => ({ item, bytes: Buffer.from(canonicalString(item), "utf8") }));
      indexed.sort((a, b) => Buffer.compare(a.bytes, b.bytes));
      for (let i = 1; i < indexed.length; i += 1) {
        if (Buffer.compare(indexed[i - 1].bytes, indexed[i].bytes) === 0) failure("RECORD_CANON_SET_DUPLICATE", path);
      }
      const sorted = indexed.map((x) => x.item);
      if (requireCanonicalInput && JSON.stringify(sorted) !== JSON.stringify(normalized)) failure("RECORD_CANON_SET_ORDER", path);
      return sorted;
    }
    failure("RECORD_CANON_ARRAY_POLICY_INVALID", path);
  }
  if (value && typeof value === "object") {
    const normalizedKeys = new Map();
    for (const key of Object.keys(value)) {
      const normalized = key.normalize("NFC");
      if (normalizedKeys.has(normalized)) failure("RECORD_CANON_NFC_KEY_COLLISION", path + "/" + normalized);
      normalizedKeys.set(normalized, key);
    }
    const out = {};
    for (const key of [...normalizedKeys.keys()].sort(codePointCompare)) {
      out[key] = normalizeCanonical(value[normalizedKeys.get(key)], path + "/" + pointerEscape(key), policies, requireCanonicalInput);
    }
    return out;
  }
  failure("RECORD_CANON_UNSUPPORTED_VALUE", path);
}
function canonicalBytes(value, policies, requireCanonicalInput = true) {
  return Buffer.from(JSON.stringify(normalizeCanonical(value, "", policies, requireCanonicalInput)), "utf8");
}

function scanRawJson(raw) {
  let i = 0;
  const skip = () => { while (/\s/.test(raw[i] ?? "")) i += 1; };
  function parseString(enforceNfc = true) {
    if (raw[i] !== '"') failure("RECORD_CANON_RAW_JSON", "expected string");
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
        if (enforceNfc && value !== value.normalize("NFC")) failure("RECORD_CANON_NON_NFC_INPUT", value);
        return value;
      }
      i += 1;
    }
    failure("RECORD_CANON_RAW_JSON", "unterminated string");
  }
  function parseNumber() {
    const start = i;
    while (/[0-9eE+\-.]/.test(raw[i] ?? "")) i += 1;
    const token = raw.slice(start, i);
    if (!/^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(token)) failure("RECORD_CANON_RAW_JSON", token);
  }
  function parseLiteral(token) {
    if (raw.slice(i, i + token.length) !== token) failure("RECORD_CANON_RAW_JSON", token);
    i += token.length;
  }
  function parseArray() {
    i += 1; skip();
    if (raw[i] === "]") { i += 1; return; }
    while (true) {
      parseValue(); skip();
      if (raw[i] === "]") { i += 1; return; }
      if (raw[i] !== ",") failure("RECORD_CANON_RAW_JSON", "array comma");
      i += 1; skip();
    }
  }
  function parseObject() {
    i += 1; skip();
    const exact = new Set();
    const normalized = new Set();
    const nonNfcKeys = [];
    if (raw[i] === "}") { i += 1; return; }
    while (true) {
      const key = parseString(false);
      if (exact.has(key)) failure("RECORD_CANON_DUPLICATE_KEY", key);
      exact.add(key);
      const nfc = key.normalize("NFC");
      if (normalized.has(nfc)) failure("RECORD_CANON_NFC_KEY_COLLISION", key);
      normalized.add(nfc);
      if (key !== nfc) nonNfcKeys.push(key);
      skip();
      if (raw[i] !== ":") failure("RECORD_CANON_RAW_JSON", "object colon");
      i += 1; skip(); parseValue(); skip();
      if (raw[i] === "}") {
        i += 1;
        if (nonNfcKeys.length) failure("RECORD_CANON_NON_NFC_INPUT", nonNfcKeys[0]);
        return;
      }
      if (raw[i] !== ",") failure("RECORD_CANON_RAW_JSON", "object comma");
      i += 1; skip();
    }
  }
  function parseValue() {
    skip();
    const ch = raw[i];
    if (ch === "{") return parseObject();
    if (ch === "[") return parseArray();
    if (ch === '"') { parseString(); return; }
    if (ch === "t") return parseLiteral("true");
    if (ch === "f") return parseLiteral("false");
    if (ch === "n") return parseLiteral("null");
    return parseNumber();
  }
  parseValue(); skip();
  if (i !== raw.length) failure("RECORD_CANON_RAW_JSON", "trailing bytes");
  return JSON.parse(raw);
}

const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL = /^-?(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$/;
const SHA = /^[0-9a-f]{64}$/;

function nthWeekday(year, monthIndex, weekday, nth) {
  const first = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
}
function validateServiceTime(record) {
  if (!Object.hasOwn(record, "service_date")) return;
  assert(DATE.test(record.service_date), "RECORD_CANON_SERVICE_DATE");
  assert(record.service_time_zone === "America/Chicago", "RECORD_CANON_SERVICE_TIME_ZONE");
  assert(Number.isInteger(record.service_day_offset_minutes), "RECORD_CANON_SERVICE_DAY_OFFSET");
  const [year, month, day] = record.service_date.split("-").map(Number);
  const offset = record.service_day_offset_minutes;
  const dstStart = nthWeekday(year, 2, 0, 2);
  const dstEnd = nthWeekday(year, 10, 0, 1);
  if (month === 3 && day === dstStart && offset >= 120 && offset < 180) {
    failure("RECORD_CANON_SERVICE_TIME_NONEXISTENT");
  }
  if (month === 11 && day === dstEnd && offset >= 60 && offset < 120) {
    if (![0, 1].includes(record.service_time_fold)) failure("RECORD_CANON_SERVICE_TIME_FOLD");
  }
}
function validateTimestamps(record) {
  for (const field of ["valid_time_start", "recorded_at", "occurred_at"]) {
    assert(TS.test(record[field] ?? ""), "RECORD_CANON_TIMESTAMP", field);
    assert(new Date(record[field]).toISOString() === record[field], "RECORD_CANON_TIMESTAMP", field);
  }
  if (Object.hasOwn(record, "valid_time_end") && record.valid_time_end !== null) {
    assert(TS.test(record.valid_time_end ?? ""), "RECORD_CANON_TIMESTAMP", "valid_time_end");
    assert(new Date(record.valid_time_end).toISOString() === record.valid_time_end, "RECORD_CANON_TIMESTAMP", "valid_time_end");
  }
}
function validateDecimals(record, decimalPaths) {
  for (const path of decimalPaths) {
    const value = pointerGet(record, path);
    assert(typeof value === "string" && DECIMAL.test(value) && value !== "-0", "RECORD_CANON_DECIMAL", path);
  }
}
function conditionMap(contract) {
  return new Map(contract.envelope.conditions.map((x) => [x.id, x]));
}
function fieldMap(contract) {
  return new Map(contract.envelope.fields.map((x) => [x.name, x]));
}
function activeConditionIds(record) {
  const ids = [];
  if (record.ordering_rule === "aggregate_sequence") ids.push("COND-AGGREGATE-SEQUENCE");
  if (record.valid_time_kind === "interval") ids.push("COND-VALID-INTERVAL");
  if (Object.hasOwn(record, "service_date")) ids.push("COND-SERVICE-TIME");
  const [y, m, d] = (record.service_date ?? "0000-00-00").split("-").map(Number);
  if (m === 11 && d === nthWeekday(y, 10, 0, 1) && record.service_day_offset_minutes >= 60 && record.service_day_offset_minutes < 120) ids.push("COND-DST-AMBIGUOUS");
  if (record.record_class === "authorization_decision" || record.record_type === "cleaning_completion" || record.offline === true) ids.push("COND-AUTHORIZATION");
  if (record.record_type === "cleaning_completion" || record.offline === true) {
    ids.push("COND-CREDENTIAL-CONTEXT", "COND-SESSION-CONTEXT", "COND-DEVICE-CONTEXT", "COND-ASSIGNMENT-EPOCH");
  }
  if (Object.hasOwn(record, "source_artifact_id")) ids.push("COND-SOURCE-EVIDENCE");
  return [...new Set(ids)];
}
function validateEnvelopeRecord(record, contract, fixtures, rawPayload = null) {
  const fields = fieldMap(contract);
  for (const def of fields.values()) {
    if (def.presence === "wire_required" && !Object.hasOwn(record, def.name)) failure("RECORD_ENVELOPE_REQUIRED_FIELD_MISSING", def.name);
  }
  const conditions = conditionMap(contract);
  for (const id of activeConditionIds(record)) {
    const condition = conditions.get(id);
    assert(condition, "RECORD_ENVELOPE_CONDITION_UNKNOWN", id);
    for (const field of condition.requires) {
      if (!Object.hasOwn(record, field)) failure(condition.failure, field);
    }
  }
  assert(record.principal_id && record.actor_snapshot_digest, "RECORD_ENVELOPE_ORIGINAL_ACTOR_MISSING");
  if (record.original_actor_substituted === true) failure("RECORD_ENVELOPE_ORIGINAL_ACTOR_SUBSTITUTION");
  if (record.original_authorization_substituted === true) failure("RECORD_ENVELOPE_ORIGINAL_AUTHORIZATION_SUBSTITUTION");
  if (record.unknown_version_coerced === true || record.unknown_version_behavior !== undefined && record.unknown_version_behavior !== "reject_or_quarantine") failure("RECORD_ENVELOPE_UNKNOWN_VERSION");
  for (const field of ["supersedes_record_ids", "corrects_record_ids", "voids_record_ids", "derives_from_record_ids"]) {
    if (!Object.hasOwn(record, field) || !Array.isArray(record[field])) failure("RECORD_ENVELOPE_NULL_MISSING_EMPTY", field);
    if (record[field].includes(record.record_id)) failure("RECORD_ENVELOPE_LINEAGE_CYCLE", field);
  }
  validateTimestamps(record);
  validateServiceTime(record);
  validateDecimals(record, fixtures.decimal_paths);
  for (const field of ["source_bytes_digest", "normalized_content_digest", "payload_digest"]) assert(SHA.test(record[field] ?? ""), "RECORD_DIGEST_FORMAT", field);
  assert(record.hash_algorithm === "sha-256", "RECORD_DIGEST_ALGORITHM");
  assert(record.canonicalization_version === "canonical-json.v1", "RECORD_CANON_VERSION");
  const policies = fixtures.array_policies;
  canonicalBytes(record, policies, true);
  const payloadPolicies = policies
    .filter((entry) => entry.path.startsWith("/domain_payload"))
    .map((entry) => ({ ...entry, path: entry.path.slice("/domain_payload".length) || "" }));
  const payloadBytes = canonicalBytes(record.domain_payload, payloadPolicies, true);
  assert(sha256(payloadBytes) === record.payload_digest, "RECORD_DIGEST_PAYLOAD_MISMATCH");
  if (rawPayload !== null) assert(sha256(Buffer.from(rawPayload, "utf8")) === record.source_bytes_digest, "RECORD_DIGEST_SOURCE_MISMATCH");
  const normalizedView = clone(record);
  delete normalizedView.source_bytes_digest;
  delete normalizedView.normalized_content_digest;
  delete normalizedView.payload_digest;
  assert(sha256(canonicalBytes(normalizedView, policies, true)) === record.normalized_content_digest, "RECORD_DIGEST_NORMALIZED_MISMATCH");
  return canonicalBytes(record, policies, true).toString("utf8");
}
function validateStrengthening(profile, contract, mutation = null) {
  if (!profile.base_contract || profile.base_contract !== contract.envelope.contract_id) failure("RECORD_STRENGTHENING_BASE_MISSING");
  if (mutation === "field_removal" || profile.may_remove_fields) failure("RECORD_STRENGTHENING_FIELD_REMOVAL");
  if (mutation === "type_widening" || profile.may_widen_types) failure("RECORD_STRENGTHENING_TYPE_WIDENING");
  if (mutation === "condition_weakening" || profile.may_weaken_conditions) failure("RECORD_STRENGTHENING_CONDITION_WEAKENING");
}

function schemaCoverage(contract, schema) {
  validateAgainstSchema(contract, schema, schema, "record-envelope-contract");
  const constraints = collectConstraints(schema);
  const rows = [];
  for (const constraint of constraints) {
    const expected = stableError("record-envelope-contract", constraint.constraintPath);
    let observed = null;
    try {
      const mutated = mutateConstraint(contract, schema, schema, constraint);
      validateAgainstSchema(mutated, schema, schema, "record-envelope-contract");
    } catch (error) {
      observed = error.code ?? error.message;
    }
    assert(observed === expected, "RECORD_SCHEMA_MUTATION_MISMATCH", constraint.constraintPath + ":" + observed);
    rows.push({ path: constraint.constraintPath, expected, observed });
  }
  return rows;
}
function strictSchemas(node, path = "#") {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const types = Array.isArray(node.type) ? node.type : [node.type];
  if (types.includes("object")) assert(node.additionalProperties === false, "RECORD_SCHEMA_OBJECT_NOT_STRICT", path);
  for (const [key, value] of Object.entries(node)) strictSchemas(value, path + "/" + key);
}
function runAttack(id, base, contract, fixtures) {
  const record = clone(base);
  if (id === "current_actor_substituted_for_original_actor") record.original_actor_substituted = true;
  else if (id === "current_authorization_substituted_for_original_authorization") record.original_authorization_substituted = true;
  else if (id === "unknown_version_coercion") record.unknown_version_coerced = true;
  else if (id === "unregistered_array_path") record.domain_payload.unregistered_array = ["x"];
  else if (id === "unstable_set_array_order") record.derives_from_record_ids = ["z", "a"];
  else if (id === "timestamp_offset_or_wrong_precision") record.recorded_at = "2026-08-06T14:32:15-05:00";
  else if (id === "nonexistent_service_time") { record.service_date = "2026-03-08"; record.service_day_offset_minutes = 150; }
  else if (id === "ambiguous_service_time_without_fold") { record.service_date = "2026-11-01"; record.service_day_offset_minutes = 90; delete record.service_time_fold; }
  else if (id === "exponent_decimal") record.domain_payload.duration_minutes = "1e1";
  else if (id === "negative_zero_decimal") record.domain_payload.duration_minutes = "-0";
  else if (id === "missing_lineage_array") delete record.corrects_record_ids;
  else if (id === "null_lineage_array") record.corrects_record_ids = null;
  else if (id === "source_bytes_digest_mismatch") record.source_bytes_digest = "f".repeat(64);
  else if (id === "normalized_content_digest_mismatch") record.normalized_content_digest = "f".repeat(64);
  else if (id === "payload_digest_mismatch") record.payload_digest = "f".repeat(64);
  else if (id === "lineage_cycle") record.derives_from_record_ids = [record.record_id];
  else if (id === "per_record_field_removal") return validateStrengthening(clone(contract.per_record_strengthening.profiles[0]), contract, "field_removal");
  else if (id === "per_record_type_widening") return validateStrengthening(clone(contract.per_record_strengthening.profiles[0]), contract, "type_widening");
  else if (id === "per_record_condition_weakening") return validateStrengthening(clone(contract.per_record_strengthening.profiles[0]), contract, "condition_weakening");
  else failure("RECORD_ATTACK_UNKNOWN", id);
  return validateEnvelopeRecord(record, contract, fixtures, fixtures.positive.raw_domain_payload);
}
function validateRawAttacks(fixtures) {
  const rows = [];
  for (const attack of fixtures.raw_json_attacks) {
    let observed = null;
    try { scanRawJson(attack.raw); } catch (error) { observed = error.code ?? error.message; }
    assert(observed === attack.expected_error, "RECORD_RAW_ATTACK_MISMATCH", attack.id + ":" + observed);
    rows.push({ id: attack.id, expected: attack.expected_error, observed });
  }
  return rows;
}
function validateSemanticAttacks(contract, fixtures) {
  const rows = [];
  for (const attack of fixtures.semantic_attacks) {
    let observed = null;
    try { runAttack(attack.id, fixtures.positive.record, contract, fixtures); }
    catch (error) { observed = error.code ?? error.message; }
    assert(observed === attack.expected_error, "RECORD_SEMANTIC_ATTACK_MISMATCH", attack.id + ":" + observed);
    rows.push({ id: attack.id, expected: attack.expected_error, observed });
  }
  return rows;
}
function validateConditions(contract) {
  const fields = fieldMap(contract);
  const conditions = conditionMap(contract);
  unique([...fields.keys()], "RECORD_FIELD_DUPLICATE");
  unique([...conditions.keys()], "RECORD_CONDITION_DUPLICATE");
  for (const field of fields.values()) {
    if (field.presence === "wire_conditional") {
      assert(field.condition && conditions.has(field.condition), "RECORD_CONDITION_REFERENCE_MISSING", field.name);
      assert(conditions.get(field.condition).requires.includes(field.name), "RECORD_CONDITION_REVERSE_MISSING", field.name);
    } else {
      assert(field.condition === null, "RECORD_CONDITION_UNEXPECTED", field.name);
    }
  }
  for (const condition of conditions.values()) for (const name of condition.requires) {
    assert(fields.has(name), "RECORD_CONDITION_FIELD_MISSING", condition.id + ":" + name);
  }
  const requiredNames = new Set([
    "record_id","record_class","record_type","schema_version","record_registry_revision",
    "authority_set_id","authority_set_generation","source_domain","source_contract_revision",
    "aggregate_type","aggregate_id","ordering_rule","valid_time_kind","valid_time_start",
    "recorded_at","occurred_at","operation_id","idempotency_key","correlation_id","causation_id",
    "principal_id","actor_snapshot_digest","supersedes_record_ids","corrects_record_ids",
    "voids_record_ids","derives_from_record_ids","sensitivity_class","retention_class",
    "source_bytes_digest","normalized_content_digest","payload_digest","hash_algorithm",
    "canonicalization_version","producer_release_id","domain_payload","replay_compatibility",
    "projection_compatibility","unknown_version_behavior"
  ]);
  for (const name of requiredNames) assert(fields.has(name), "RECORD_MANDATORY_SEMANTIC_FIELD_MISSING", name);
}
function validateSourceAndScope(contract) {
  assert(contract.source_authority.accepted_governance_commit === "569dc25c11723801a212de489dced7da776d5be7", "RECORD_SOURCE_TUPLE_STALE");
  assert(contract.source_authority.phase1_review_head === "8e53038f9e5d5146b1dd8260614de30cb9be4553", "RECORD_SOURCE_TUPLE_STALE");
  assert(gitBlob(contract.source_authority.base_registry_path) === contract.source_authority.base_registry_blob, "RECORD_BASE_REGISTRY_BLOB_MISMATCH");
  assert(gitBlob(contract.source_authority.base_schema_path) === contract.source_authority.base_schema_blob, "RECORD_BASE_SCHEMA_BLOB_MISMATCH");
  const architecture = readFileSync(resolve(REPO_ROOT, "docs/audits/custodial-unified-v4-2/custodial-unified-whole-system-architecture-v4-2.md"), "utf8");
  for (const phrase of [
    "`record_class`",
    "source domain and source contract revision",
    "credential, session, device and assignment-epoch context where applicable",
    "source-byte hash plus normalized-content hash",
    "UTF-8 and Unicode NFC",
    "stable semantic array order",
    "America/Chicago service-date/day-offset rules",
    "canonical non-exponent decimals",
    "distinct null, missing and empty values",
  ]) assert(architecture.includes(phrase), "RECORD_V42_SOURCE_CONTRACT_MISSING", phrase);
  const base = contract.source_authority.phase1_review_head;
  assert(runGit(["merge-base", "--is-ancestor", base, "HEAD"], true).status === 0, "RECORD_GIT_ANCESTRY_INVALID");
  const allowedPrefix = "docs/audits/custodial-unified-v4-3-architecture/record-envelope-canonicalization/";
  const allowedWorkflow = ".github/workflows/custodial-v43-record-envelope-canonicalization.yml";
  const changed = runGit(["diff", "--name-only", base + "..HEAD"]).stdout.trim().split("\n").filter(Boolean);
  for (const path of changed) assert(path.startsWith(allowedPrefix) || path === allowedWorkflow, "RECORD_CHANGED_PATH_OUT_OF_SCOPE", path);
}
function validateSupersession(contract, baseRegistry) {
  assert(contract.supersession.no_parallel_authority, "RECORD_PARALLEL_AUTHORITY");
  assert(contract.supersession.controlling_contract === "record-envelope-contract.json", "RECORD_CONTROLLING_CONTRACT_INVALID");
  assert(contract.supersession.superseded_json_pointers.includes("/record_envelope"), "RECORD_SUPERSESSION_INCOMPLETE");
  assert(baseRegistry.record_envelope.schema_version === "CUSTODIAL_RECORD_ENVELOPE_V1", "RECORD_BASE_REGISTRY_CHANGED_WITHOUT_REVIEW");
  assert(baseRegistry.record_envelope.required_fields.length === 20, "RECORD_BASE_REGISTRY_CHANGED_WITHOUT_REVIEW");
  assert(!contract.downstream_authority.phase2_authorized, "RECORD_STAGE_LEAKAGE");
}

function validateManifest(manifest) {
  assert(manifest.protocol === "CUSTODIAL_V43_RECORD_ENVELOPE_PACKAGE_MANIFEST_V1", "RECORD_MANIFEST_PROTOCOL");
  const names = manifest.members.map((x) => x.path);
  unique(names, "RECORD_MANIFEST_DUPLICATE");
  assert(!names.includes("package-manifest.json"), "RECORD_MANIFEST_SELF_REFERENCE");
  assert(!names.includes("validation-result.json"), "RECORD_MANIFEST_RECEIPT_CYCLE");
  assert(!names.includes("stage-decision.json"), "RECORD_MANIFEST_STAGE_CYCLE");
  for (const member of manifest.members) {
    const path = resolve(ROOT, member.path);
    const actual = sha256(readFileSync(path));
    assert(actual === member.sha256, "RECORD_MANIFEST_HASH_MISMATCH", member.path);
  }
  const required = [
    "README.md","record-envelope-contract.json","record-envelope-contract.schema.json",
    "conformance-fixtures.json","validate-record-envelope-canonicalization.mjs",
    "validate-record-envelope-adversarial-v2.mjs","record-type-strengthening-map.json","research-plan-audit-replan.md"
  ];
  assert(JSON.stringify([...names].sort()) === JSON.stringify(required.sort()), "RECORD_MANIFEST_MEMBERSHIP");
}

function packageAggregate(manifest) {
  const hash = createHash("sha256");
  for (const member of [...manifest.members].sort((a, b) => a.path.localeCompare(b.path))) {
    const bytes = readFileSync(resolve(ROOT, member.path));
    hash.update(Buffer.from(member.path, "utf8"));
    hash.update(Buffer.from([0]));
    hash.update(Buffer.from(String(bytes.length), "utf8"));
    hash.update(Buffer.from([0]));
    hash.update(bytes);
  }
  return hash.digest("hex");
}
function buildResult(contract, schemaRows, rawRows, semanticRows, canonical) {
  const hashes = Object.fromEntries(manifest.members.map((member) => [member.path, member.sha256]));
  return {
    protocol: "CUSTODIAL_V43_RECORD_ENVELOPE_VALIDATION_RESULT_V1",
    status: "PASS",
    validator: VALIDATOR_VERSION,
    source_base: contract.source_authority.phase1_review_head,
    package_manifest_sha256: sha256(readFileSync(resolve(ROOT, "package-manifest.json"))),
    package_aggregate_sha256: packageAggregate(manifest),
    canonical_contract: contract.envelope.contract_id,
    canonicalization_contract: contract.canonical_json.contract_id,
    field_count: contract.envelope.fields.length,
    conditional_rule_count: contract.envelope.conditions.length,
    record_profile_count: contract.per_record_strengthening.profiles.length,
    schema_mutation_count: schemaRows.length,
    raw_json_attack_count: rawRows.length,
    semantic_attack_count: semanticRows.length,
    canonical_record_sha256: sha256(Buffer.from(canonical, "utf8")),
    member_sha256: hashes,
    downstream_authority: contract.downstream_authority,
  };
}

const contract = json("record-envelope-contract.json");
const schema = json("record-envelope-contract.schema.json");
const fixtures = json("conformance-fixtures.json");
const strengthening = json("record-type-strengthening-map.json");
const stage = json("stage-decision.json");
const manifest = json("package-manifest.json");
const baseRegistry = readParentJson("phase1-foundation-registry.json");

strictSchemas(schema);
const schemaRows = schemaCoverage(contract, schema);
validateSourceAndScope(contract);
validateManifest(manifest);
validateSupersession(contract, baseRegistry);
validateConditions(contract);
unique(contract.per_record_strengthening.profiles.map((x) => x.record_type), "RECORD_PROFILE_DUPLICATE");
const baseRecordIds = [...new Set(baseRegistry.records.map((x) => x.id))].sort();
const profileIds = contract.per_record_strengthening.profiles.map((x) => x.record_type).sort();
assert(JSON.stringify(baseRecordIds) === JSON.stringify(profileIds), "RECORD_PROFILE_COVERAGE_MISMATCH");
for (const profile of contract.per_record_strengthening.profiles) validateStrengthening(profile, contract);
assert(JSON.stringify(strengthening.profiles) === JSON.stringify(contract.per_record_strengthening.profiles), "RECORD_STRENGTHENING_PROJECTION_STALE");
assert(stage.stage === "DRAFT_REMOTE_PHASE_1" && stage.decision === "hold", "RECORD_STAGE_LEAKAGE");
assert(stage.phase2_authorized === false && stage.schema_design_authorized === false && stage.component_design_authorized === false, "RECORD_STAGE_LEAKAGE");

scanRawJson(fixtures.positive.raw_domain_payload);
const canonical = validateEnvelopeRecord(fixtures.positive.record, contract, fixtures, fixtures.positive.raw_domain_payload);
assert(canonical === fixtures.positive.expected.canonical_record_utf8, "RECORD_CANONICAL_BYTES_MISMATCH");
for (const [field, expected] of Object.entries({
  source_bytes_digest: fixtures.positive.expected.source_bytes_digest,
  payload_digest: fixtures.positive.expected.payload_digest,
  normalized_content_digest: fixtures.positive.expected.normalized_content_digest,
})) assert(fixtures.positive.record[field] === expected, "RECORD_FIXTURE_DIGEST_STALE", field);
const rawRows = validateRawAttacks(fixtures);
const semanticRows = validateSemanticAttacks(contract, fixtures);

const result = JSON.stringify(buildResult(contract, schemaRows, rawRows, semanticRows, canonical), null, 2) + "\n";
const resultPath = resolve(ROOT, "validation-result.json");
const mode = process.argv[2] ?? "--check";
if (mode === "--write") writeFileSync(resultPath, result);
else if (mode === "--check") {
  assert(readFileSync(resultPath, "utf8") === result, "RECORD_VALIDATION_RESULT_STALE");
} else failure("RECORD_VALIDATOR_ARGUMENT", mode);
console.log(JSON.stringify(JSON.parse(result)));
