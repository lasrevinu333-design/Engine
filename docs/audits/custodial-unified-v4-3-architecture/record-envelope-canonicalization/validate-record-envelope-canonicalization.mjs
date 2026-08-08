import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve, relative, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  collectConstraints,
  mutateConstraint,
  stableError,
  validateAgainstSchema,
} from "../generate-architecture-projections.mjs";

export const VALIDATOR_VERSION = "CUSTODIAL_V43_RECORD_ENVELOPE_VALIDATOR_V3";
const ROOT = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(ROOT, "..");
const REPO_ROOT = resolve(ROOT, "../../../..");
const read = (name) => readFileSync(resolve(ROOT, name), "utf8");
const json = (name) => JSON.parse(read(name));
const readParentJson = (name) => JSON.parse(readFileSync(resolve(PACKAGE_ROOT, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clone = (value) => structuredClone(value);
const mode = process.argv[2] ?? "--check";
if (!["--check", "--write", "--check-package-manifest"].includes(mode)) {
  const error = new Error(`RECORD_VALIDATOR_ARGUMENT: ${mode}`);
  error.code = "RECORD_VALIDATOR_ARGUMENT";
  throw error;
}
const EXPECTED_PACKAGE_ENTRIES = [
  "README.md",
  "adversarial-validation-result.json",
  "ci-failure-correlation.md",
  "conformance-fixtures.json",
  "package-manifest.json",
  "post-apply-independent-review.json",
  "record-envelope-contract.json",
  "record-envelope-contract.schema.json",
  "record-type-strengthening-map.json",
  "research-plan-audit-replan.md",
  "stage-decision-record-envelope-acceptance.json",
  "stage-decision.json",
  "validate-record-envelope-adversarial-v2.mjs",
  "validate-record-envelope-canonicalization.mjs",
  "validation-result.json",
];
const MANIFEST_FIELDS = [
  "base_head", "excluded", "identity_rule", "members", "no_parallel_authority",
  "no_self_reference", "package_root", "protocol", "status",
];
const MEMBER_FIELDS = ["bytes", "path", "role", "sha256"];
const SHA256 = /^[0-9a-f]{64}$/;
const EXPECTED_BASE_HEAD = "8e53038f9e5d5146b1dd8260614de30cb9be4553";
const EXPECTED_PACKAGE_ROOT = "docs/audits/custodial-unified-v4-3-architecture/record-envelope-canonicalization";
const EXPECTED_IDENTITY_RULE = "Members are sorted by path; each member is bound by exact UTF-8 bytes, byte length, and SHA-256. This manifest, stage decisions, validation receipts, workflow identities, and containing commit/tree are detached to avoid self-reference.";
const EXPECTED_EXCLUDED = [
  "package-manifest.json",
  "stage-decision.json",
  "validation-result.json",
  "GitHub workflow run/job/log identities",
  "containing Git commit and tree",
  "adversarial-validation-result.json",
];
const EXPECTED_MEMBER_ROLES = new Map([
  ["README.md", "normative_boundary"],
  ["conformance-fixtures.json", "executable_fixtures"],
  ["record-envelope-contract.json", "normative_machine_contract"],
  ["record-envelope-contract.schema.json", "strict_schema"],
  ["record-type-strengthening-map.json", "record_profile_projection"],
  ["research-plan-audit-replan.md", "research_and_replan_evidence"],
  ["validate-record-envelope-adversarial-v2.mjs", "independent_adversarial_validator"],
  ["validate-record-envelope-canonicalization.mjs", "deterministic_validator"],
]);
const EXPECTED_MEMBER_NAMES = [...EXPECTED_MEMBER_ROLES.keys()];
const HARDENING_SCOPE_BASE = "4dfef6dbbeb5a1bf169f0ed62d5ad3a9c832db71";
const VALIDATION_RECEIPT_FIELDS = [
  "canonical_contract", "canonical_record_sha256", "canonicalization_contract", "conditional_rule_count",
  "downstream_authority", "field_count", "filesystem_mutation_failures", "filesystem_recoveries",
  "hardening_scope_base",
  "manifest_semantic_mutation_failures", "manifest_semantic_recoveries", "member_sha256",
  "owned_test_residue", "package_aggregate_sha256", "package_manifest_sha256", "protocol",
  "raw_json_attack_count", "receipt_semantic_mutation_failures", "receipt_semantic_recoveries",
  "record_profile_count", "schema_mutation_count", "semantic_attack_count", "source_base", "status", "validator",
];
const DOWNSTREAM_AUTHORITY_FIELDS = [
  "component_design_authorized", "implementation_authorized", "migration_authorized", "next_gate",
  "phase2_authorized", "release_authorized", "schema_design_authorized",
];
const RECEIPT_MUTATION_CASE_COUNT = 19;
const EXPECTED_CANONICAL_RECORD_SHA256 = "8405f16a0ca8b057046ecaed7277134bff6ab7adf7ad220885b69de008fbb2ad";

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
function strictObject(value, fields, code) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), code + "_TYPE");
  assert(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort()), code + "_FIELDS");
}
function expectFailure(fn, expectedCode) {
  let observed = null;
  try { fn(); } catch (error) { observed = error.code ?? error.message; }
  assert(observed === expectedCode, "RECORD_MUTATION_EXPECTED_FAILURE", `${expectedCode}:${observed}`);
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
  assert(runGit(["merge-base", "--is-ancestor", contract.source_authority.phase1_review_head, "HEAD"], true).status === 0, "RECORD_GIT_ANCESTRY_INVALID");
  assert(runGit(["merge-base", "--is-ancestor", HARDENING_SCOPE_BASE, "HEAD"], true).status === 0, "RECORD_GIT_ANCESTRY_INVALID");
  const allowedPrefix = "docs/audits/custodial-unified-v4-3-architecture/record-envelope-canonicalization/";
  const allowedWorkflow = ".github/workflows/custodial-v43-record-envelope-canonicalization.yml";
  const changed = runGit(["diff", "--name-only", HARDENING_SCOPE_BASE + "..HEAD"]).stdout.trim().split("\n").filter(Boolean);
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

function assertPathInside(scopeRoot, target) {
  const scoped = relative(scopeRoot, target);
  assert(scoped === "" || (!scoped.startsWith(`..${sep}`) && scoped !== ".." && !isAbsolute(scoped)), "RECORD_PACKAGE_PATH_SCOPE", target);
}
function assertNoSymlinkComponents(target) {
  const absolute = resolve(target);
  const root = parse(absolute).root;
  let cursor = root;
  for (const component of absolute.slice(root.length).split(sep).filter(Boolean)) {
    cursor = join(cursor, component);
    assert(lstatSync(cursor).isSymbolicLink() === false, "RECORD_PACKAGE_SYMLINK_FORBIDDEN", cursor);
  }
}
function validateDiscoveredPackage(packageRoot, scopeRoot, expectedEntries) {
  assertPathInside(scopeRoot, packageRoot);
  assertNoSymlinkComponents(scopeRoot);
  assertNoSymlinkComponents(packageRoot);
  const entries = readdirSync(packageRoot).sort();
  assert(JSON.stringify(entries) === JSON.stringify([...expectedEntries].sort()), "RECORD_PACKAGE_MEMBERSHIP_EXACT");
  for (const name of entries) {
    const target = resolve(packageRoot, name);
    assertPathInside(packageRoot, target);
    assertNoSymlinkComponents(target);
    assert(lstatSync(target).isFile(), "RECORD_PACKAGE_MEMBER_NOT_REGULAR", name);
  }
}
function validateManifestMemberPath(memberPath) {
  assert(typeof memberPath === "string", "RECORD_MANIFEST_MEMBER_PATH_TYPE");
  assert(memberPath.length > 0 && !memberPath.includes("\0") && !memberPath.includes("\\") && !memberPath.includes("/") && memberPath !== "." && memberPath !== ".." && !isAbsolute(memberPath), "RECORD_MANIFEST_MEMBER_PATH_SCOPE", memberPath);
}
function validateManifest(manifest) {
  strictObject(manifest, MANIFEST_FIELDS, "RECORD_MANIFEST");
  assert(manifest.protocol === "CUSTODIAL_V43_RECORD_ENVELOPE_PACKAGE_MANIFEST_V1", "RECORD_MANIFEST_PROTOCOL");
  assert(manifest.status === "DRAFT_REMOTE_PHASE_1", "RECORD_MANIFEST_STATUS");
  assert(typeof manifest.base_head === "string", "RECORD_MANIFEST_BASE_HEAD_TYPE");
  assert(manifest.base_head === EXPECTED_BASE_HEAD, "RECORD_MANIFEST_BASE_HEAD");
  assert(typeof manifest.package_root === "string", "RECORD_MANIFEST_PACKAGE_ROOT_TYPE");
  assert(manifest.package_root === EXPECTED_PACKAGE_ROOT, "RECORD_MANIFEST_PACKAGE_ROOT");
  assert(typeof manifest.identity_rule === "string", "RECORD_MANIFEST_IDENTITY_RULE_TYPE");
  assert(manifest.identity_rule === EXPECTED_IDENTITY_RULE, "RECORD_MANIFEST_IDENTITY_RULE");
  assert(Array.isArray(manifest.members), "RECORD_MANIFEST_MEMBERS_TYPE");
  assert(Array.isArray(manifest.excluded) && manifest.excluded.every((entry) => typeof entry === "string"), "RECORD_MANIFEST_EXCLUDED_TYPE");
  assert(JSON.stringify(manifest.excluded) === JSON.stringify(EXPECTED_EXCLUDED), "RECORD_MANIFEST_EXCLUDED");
  assert(manifest.no_self_reference === true, "RECORD_MANIFEST_SELF_REFERENCE_FLAG");
  assert(manifest.no_parallel_authority === true, "RECORD_MANIFEST_PARALLEL_AUTHORITY_FLAG");

  for (const member of manifest.members) {
    strictObject(member, MEMBER_FIELDS, "RECORD_MANIFEST_MEMBER");
    validateManifestMemberPath(member.path);
    assert(typeof member.role === "string", "RECORD_MANIFEST_MEMBER_ROLE_TYPE");
    assert(typeof member.sha256 === "string" && SHA256.test(member.sha256), "RECORD_MANIFEST_MEMBER_SHA256_TYPE");
    assert(Number.isSafeInteger(member.bytes) && member.bytes >= 0, "RECORD_MANIFEST_MEMBER_BYTES_TYPE");
  }
  const names = manifest.members.map((member) => member.path);
  unique(names, "RECORD_MANIFEST_DUPLICATE");
  assert(!names.includes("package-manifest.json"), "RECORD_MANIFEST_SELF_REFERENCE");
  assert(!names.includes("validation-result.json"), "RECORD_MANIFEST_RECEIPT_CYCLE");
  assert(!names.includes("stage-decision.json"), "RECORD_MANIFEST_STAGE_CYCLE");
  assert(JSON.stringify(names) === JSON.stringify(EXPECTED_MEMBER_NAMES), "RECORD_MANIFEST_MEMBERSHIP");
  for (const member of manifest.members) assert(member.role === EXPECTED_MEMBER_ROLES.get(member.path), "RECORD_MANIFEST_MEMBER_ROLE", member.path);

  validateDiscoveredPackage(ROOT, REPO_ROOT, EXPECTED_PACKAGE_ENTRIES);
  for (const member of manifest.members) {
    const memberPath = resolve(ROOT, member.path);
    assertPathInside(ROOT, memberPath);
    assertNoSymlinkComponents(memberPath);
    const bytes = readFileSync(memberPath);
    const actual = sha256(bytes);
    assert(bytes.length === member.bytes, "RECORD_MANIFEST_BYTES_MISMATCH", member.path);
    assert(actual === member.sha256, "RECORD_MANIFEST_HASH_MISMATCH", member.path);
  }
}

function validateManifestHardeningMutations(manifest) {
  const mutations = [
    ["manifest_array_not_object", "RECORD_MANIFEST_TYPE", () => {}],
    ...MANIFEST_FIELDS.map((field) => [`top_missing_${field}`, "RECORD_MANIFEST_FIELDS", (candidate) => { delete candidate[field]; }]),
    ["dangerous_extra_activation_field", "RECORD_MANIFEST_FIELDS", (candidate) => { candidate.activation_authorized = true; }],
    ["dangerous_extra_architecture_closure_field", "RECORD_MANIFEST_FIELDS", (candidate) => { candidate.architecture_closure = true; }],
    ["wrong_protocol_type", "RECORD_MANIFEST_PROTOCOL", (candidate) => { candidate.protocol = 1; }],
    ["protocol_semantic_drift", "RECORD_MANIFEST_PROTOCOL", (candidate) => { candidate.protocol = "CUSTODIAL_V43_RECORD_ENVELOPE_PACKAGE_MANIFEST_V999"; }],
    ["wrong_status_type", "RECORD_MANIFEST_STATUS", (candidate) => { candidate.status = false; }],
    ["status_semantic_drift", "RECORD_MANIFEST_STATUS", (candidate) => { candidate.status = "ACTIVATED"; }],
    ["wrong_base_head_type", "RECORD_MANIFEST_BASE_HEAD_TYPE", (candidate) => { candidate.base_head = 1; }],
    ["wrong_package_root_type", "RECORD_MANIFEST_PACKAGE_ROOT_TYPE", (candidate) => { candidate.package_root = []; }],
    ["wrong_identity_rule_type", "RECORD_MANIFEST_IDENTITY_RULE_TYPE", (candidate) => { candidate.identity_rule = null; }],
    ["members_object_not_array", "RECORD_MANIFEST_MEMBERS_TYPE", (candidate) => { candidate.members = {}; }],
    ["excluded_object_not_array", "RECORD_MANIFEST_EXCLUDED_TYPE", (candidate) => { candidate.excluded = {}; }],
    ["excluded_non_string_member", "RECORD_MANIFEST_EXCLUDED_TYPE", (candidate) => { candidate.excluded[0] = true; }],
    ["wrong_no_self_reference_type", "RECORD_MANIFEST_SELF_REFERENCE_FLAG", (candidate) => { candidate.no_self_reference = "true"; }],
    ["no_self_reference_semantic_drift", "RECORD_MANIFEST_SELF_REFERENCE_FLAG", (candidate) => { candidate.no_self_reference = false; }],
    ["wrong_no_parallel_authority_type", "RECORD_MANIFEST_PARALLEL_AUTHORITY_FLAG", (candidate) => { candidate.no_parallel_authority = "true"; }],
    ["no_parallel_authority_semantic_drift", "RECORD_MANIFEST_PARALLEL_AUTHORITY_FLAG", (candidate) => { candidate.no_parallel_authority = false; }],
    ["base_head_semantic_drift", "RECORD_MANIFEST_BASE_HEAD", (candidate) => { candidate.base_head = "0".repeat(40); }],
    ["package_root_semantic_drift", "RECORD_MANIFEST_PACKAGE_ROOT", (candidate) => { candidate.package_root = "/tmp/not-the-package"; }],
    ["identity_rule_semantic_drift", "RECORD_MANIFEST_IDENTITY_RULE", (candidate) => { candidate.identity_rule = "activation may be inferred"; }],
    ["excluded_semantic_drift", "RECORD_MANIFEST_EXCLUDED", (candidate) => { candidate.excluded = ["README.md"]; }],
    ...MEMBER_FIELDS.map((field) => [`member_missing_${field}`, "RECORD_MANIFEST_MEMBER_FIELDS", (candidate) => { delete candidate.members[0][field]; }]),
    ["member_array_not_object", "RECORD_MANIFEST_MEMBER_TYPE", (candidate) => { candidate.members[0] = []; }],
    ["member_scalar_not_object", "RECORD_MANIFEST_MEMBER_TYPE", (candidate) => { candidate.members[0] = "member"; }],
    ["member_extra_field", "RECORD_MANIFEST_MEMBER_FIELDS", (candidate) => { candidate.members[0].activation_authorized = true; }],
    ["member_wrong_path_type", "RECORD_MANIFEST_MEMBER_PATH_TYPE", (candidate) => { candidate.members[0].path = 1; }],
    ["member_wrong_role_type", "RECORD_MANIFEST_MEMBER_ROLE_TYPE", (candidate) => { candidate.members[0].role = false; }],
    ["member_wrong_sha256_type", "RECORD_MANIFEST_MEMBER_SHA256_TYPE", (candidate) => { candidate.members[0].sha256 = 1; }],
    ["member_wrong_bytes_type", "RECORD_MANIFEST_MEMBER_BYTES_TYPE", (candidate) => { candidate.members[0].bytes = "1"; }],
    ["member_well_typed_bytes_drift", "RECORD_MANIFEST_BYTES_MISMATCH", (candidate) => { candidate.members[0].bytes += 1; }],
    ["member_well_typed_digest_drift", "RECORD_MANIFEST_HASH_MISMATCH", (candidate) => { candidate.members[0].sha256 = "0".repeat(64); }],
    ["member_role_authority_laundering", "RECORD_MANIFEST_MEMBER_ROLE", (candidate) => { candidate.members[0].role = "activation_authority"; }],
    ["member_dot_path", "RECORD_MANIFEST_MEMBER_PATH_SCOPE", (candidate) => { candidate.members[0].path = "."; }],
    ["member_backslash_path", "RECORD_MANIFEST_MEMBER_PATH_SCOPE", (candidate) => { candidate.members[0].path = "..\\README.md"; }],
    ["member_nul_path", "RECORD_MANIFEST_MEMBER_PATH_SCOPE", (candidate) => { candidate.members[0].path = "README.md\0suffix"; }],
    ["member_escape_path", "RECORD_MANIFEST_MEMBER_PATH_SCOPE", (candidate) => { candidate.members[0].path = "../README.md"; }],
    ["member_self_circular_manifest", "RECORD_MANIFEST_SELF_REFERENCE", (candidate) => { candidate.members.at(-1).path = "package-manifest.json"; }],
    ["member_receipt_cycle", "RECORD_MANIFEST_RECEIPT_CYCLE", (candidate) => { candidate.members.at(-1).path = "validation-result.json"; }],
    ["member_stage_cycle", "RECORD_MANIFEST_STAGE_CYCLE", (candidate) => { candidate.members.at(-1).path = "stage-decision.json"; }],
    ["member_duplicate", "RECORD_MANIFEST_DUPLICATE", (candidate) => { candidate.members[1].path = candidate.members[0].path; }],
    ["member_omitted", "RECORD_MANIFEST_MEMBERSHIP", (candidate) => { candidate.members.pop(); }],
    ["member_extra", "RECORD_MANIFEST_MEMBERSHIP", (candidate) => { candidate.members.push({ ...candidate.members[0], path: "unexpected.txt", role: "unexpected" }); }],
  ];
  for (const [, expected, mutateManifest] of mutations) {
    const candidate = expected === "RECORD_MANIFEST_TYPE" ? [] : clone(manifest);
    mutateManifest(candidate);
    expectFailure(() => validateManifest(candidate), expected);
    validateManifest(manifest);
  }
  return { failures: mutations.length, recoveries: mutations.length, residue: 0, names: mutations.map(([name]) => name) };
}

function validateFilesystemDiscoveryMutations() {
  const ownedRoot = mkdtempSync(join(tmpdir(), "custodial-record-envelope-manifest-"));
  const fixtureRoot = join(ownedRoot, "package");
  const member = join(fixtureRoot, "member.txt");
  let failures = 0;
  let recoveries = 0;
  const names = [];
  const recover = () => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot);
    writeFileSync(member, "fixture\n");
    validateDiscoveredPackage(fixtureRoot, ownedRoot, ["member.txt"]);
    recoveries += 1;
  };
  try {
    recoveries -= 1;
    recover();
    const cases = [
      ["filesystem_extra_file", "RECORD_PACKAGE_MEMBERSHIP_EXACT", () => writeFileSync(join(fixtureRoot, "extra.txt"), "extra\n")],
      ["filesystem_extra_directory", "RECORD_PACKAGE_MEMBERSHIP_EXACT", () => mkdirSync(join(fixtureRoot, "extra-directory"))],
      ["filesystem_missing_member", "RECORD_PACKAGE_MEMBERSHIP_EXACT", () => unlinkSync(member)],
      ["filesystem_nonregular_member", "RECORD_PACKAGE_MEMBER_NOT_REGULAR", () => { unlinkSync(member); mkdirSync(member); }],
      ["filesystem_direct_symlink", "RECORD_PACKAGE_SYMLINK_FORBIDDEN", () => { unlinkSync(member); symlinkSync(join(ownedRoot, "target.txt"), member); }],
    ];
    writeFileSync(join(ownedRoot, "target.txt"), "target\n");
    for (const [name, expected, mutate] of cases) {
      names.push(name);
      mutate();
      expectFailure(() => validateDiscoveredPackage(fixtureRoot, ownedRoot, ["member.txt"]), expected);
      failures += 1;
      recover();
    }
    names.push("filesystem_ancestor_symlink");
    const alias = join(ownedRoot, "package-alias");
    symlinkSync(fixtureRoot, alias);
    expectFailure(() => validateDiscoveredPackage(alias, ownedRoot, ["member.txt"]), "RECORD_PACKAGE_SYMLINK_FORBIDDEN");
    failures += 1;
    unlinkSync(alias);
    validateDiscoveredPackage(fixtureRoot, ownedRoot, ["member.txt"]);
    recoveries += 1;

    names.push("filesystem_cleanup_interruption");
    const interrupted = join(ownedRoot, "interrupted-residue");
    try {
      writeFileSync(interrupted, "owned\n");
      failure("RECORD_TEST_INJECTED_INTERRUPTION");
    } catch (error) {
      assert(error.code === "RECORD_TEST_INJECTED_INTERRUPTION", "RECORD_TEST_INTERRUPTION_WRONG_ERROR");
      failures += 1;
    } finally {
      rmSync(interrupted, { force: true });
    }
    assert(!existsSync(interrupted), "RECORD_TEST_INTERRUPTION_RESIDUE");
    validateDiscoveredPackage(fixtureRoot, ownedRoot, ["member.txt"]);
    recoveries += 1;
  } finally {
    rmSync(ownedRoot, { recursive: true, force: true });
  }
  assert(!existsSync(ownedRoot), "RECORD_FILESYSTEM_TEST_RESIDUE");
  return { failures, recoveries, residue: 0, names };
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
function buildResult(contract, schemaRows, rawRows, semanticRows, canonical, manifestHardening, filesystemHardening) {
  const hashes = Object.fromEntries(manifest.members.map((member) => [member.path, member.sha256]));
  return {
    protocol: "CUSTODIAL_V43_RECORD_ENVELOPE_VALIDATION_RESULT_V2",
    status: "PASS",
    validator: VALIDATOR_VERSION,
    source_base: contract.source_authority.phase1_review_head,
    hardening_scope_base: HARDENING_SCOPE_BASE,
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
    manifest_semantic_mutation_failures: manifestHardening.failures,
    manifest_semantic_recoveries: manifestHardening.recoveries,
    filesystem_mutation_failures: filesystemHardening.failures,
    filesystem_recoveries: filesystemHardening.recoveries,
    receipt_semantic_mutation_failures: RECEIPT_MUTATION_CASE_COUNT,
    receipt_semantic_recoveries: RECEIPT_MUTATION_CASE_COUNT,
    owned_test_residue: manifestHardening.residue + filesystemHardening.residue,
    canonical_record_sha256: sha256(Buffer.from(canonical, "utf8")),
    member_sha256: hashes,
    downstream_authority: contract.downstream_authority,
  };
}

function validateManifestHardeningReceipt(receipt, manifestHardening, filesystemHardening) {
  strictObject(receipt, VALIDATION_RECEIPT_FIELDS, "RECORD_HARDENING_RECEIPT");
  assert(receipt.protocol === "CUSTODIAL_V43_RECORD_ENVELOPE_VALIDATION_RESULT_V2", "RECORD_HARDENING_RECEIPT_PROTOCOL");
  assert(receipt.status === "PASS", "RECORD_HARDENING_RECEIPT_STATUS");
  assert(receipt.validator === VALIDATOR_VERSION, "RECORD_HARDENING_RECEIPT_VALIDATOR");
  assert(receipt.source_base === EXPECTED_BASE_HEAD, "RECORD_HARDENING_RECEIPT_SOURCE_BASE");
  assert(receipt.hardening_scope_base === HARDENING_SCOPE_BASE, "RECORD_HARDENING_RECEIPT_SCOPE_BASE");
  assert(receipt.package_manifest_sha256 === sha256(readFileSync(resolve(ROOT, "package-manifest.json"))), "RECORD_HARDENING_RECEIPT_MANIFEST");
  assert(receipt.package_aggregate_sha256 === packageAggregate(manifest), "RECORD_HARDENING_RECEIPT_AGGREGATE");
  assert(receipt.manifest_semantic_mutation_failures === manifestHardening.failures, "RECORD_HARDENING_RECEIPT_SEMANTIC_FAILURES");
  assert(receipt.manifest_semantic_recoveries === manifestHardening.recoveries, "RECORD_HARDENING_RECEIPT_SEMANTIC_RECOVERIES");
  assert(receipt.filesystem_mutation_failures === filesystemHardening.failures, "RECORD_HARDENING_RECEIPT_FILESYSTEM_FAILURES");
  assert(receipt.filesystem_recoveries === filesystemHardening.recoveries, "RECORD_HARDENING_RECEIPT_FILESYSTEM_RECOVERIES");
  assert(receipt.receipt_semantic_mutation_failures === RECEIPT_MUTATION_CASE_COUNT, "RECORD_HARDENING_RECEIPT_MUTATION_FAILURES");
  assert(receipt.receipt_semantic_recoveries === RECEIPT_MUTATION_CASE_COUNT, "RECORD_HARDENING_RECEIPT_MUTATION_RECOVERIES");
  assert(receipt.owned_test_residue === 0, "RECORD_HARDENING_RECEIPT_RESIDUE");
  assert(receipt.canonical_contract === "canonical-record-envelope.v1", "RECORD_HARDENING_RECEIPT_CANONICAL_CONTRACT");
  assert(receipt.canonicalization_contract === "canonical-json.v1", "RECORD_HARDENING_RECEIPT_CANONICALIZATION_CONTRACT");
  assert(receipt.canonical_record_sha256 === EXPECTED_CANONICAL_RECORD_SHA256, "RECORD_HARDENING_RECEIPT_CANONICAL_RECORD_DIGEST");
  assert(receipt.field_count === 53, "RECORD_HARDENING_RECEIPT_FIELD_COUNT");
  assert(receipt.conditional_rule_count === 10, "RECORD_HARDENING_RECEIPT_CONDITIONAL_COUNT");
  assert(receipt.record_profile_count === 15, "RECORD_HARDENING_RECEIPT_PROFILE_COUNT");
  assert(receipt.schema_mutation_count === 502, "RECORD_HARDENING_RECEIPT_SCHEMA_MUTATION_COUNT");
  assert(receipt.raw_json_attack_count === 3, "RECORD_HARDENING_RECEIPT_RAW_ATTACK_COUNT");
  assert(receipt.semantic_attack_count === 19, "RECORD_HARDENING_RECEIPT_SEMANTIC_ATTACK_COUNT");
  strictObject(receipt.member_sha256, EXPECTED_MEMBER_NAMES, "RECORD_HARDENING_RECEIPT_MEMBER_DIGESTS");
  for (const member of manifest.members) assert(receipt.member_sha256[member.path] === member.sha256, "RECORD_HARDENING_RECEIPT_MEMBER_DIGEST", member.path);
  strictObject(receipt.downstream_authority, DOWNSTREAM_AUTHORITY_FIELDS, "RECORD_HARDENING_RECEIPT_DOWNSTREAM");
  assert(JSON.stringify(receipt.downstream_authority) === JSON.stringify({
    phase2_authorized: false,
    schema_design_authorized: false,
    component_design_authorized: false,
    implementation_authorized: false,
    migration_authorized: false,
    release_authorized: false,
    next_gate: "independent_post_apply_record_envelope_review",
  }), "RECORD_HARDENING_RECEIPT_DOWNSTREAM_AUTHORITY");
}

function validateReceiptHardeningMutations(receipt, manifestHardening, filesystemHardening) {
  const mutations = [
    ["receipt_missing_field", "RECORD_HARDENING_RECEIPT_FIELDS", (candidate) => { delete candidate.status; }],
    ["receipt_extra_activation_field", "RECORD_HARDENING_RECEIPT_FIELDS", (candidate) => { candidate.activation_authorized = true; }],
    ["receipt_extra_architecture_closure_field", "RECORD_HARDENING_RECEIPT_FIELDS", (candidate) => { candidate.architecture_closure = true; }],
    ["receipt_protocol_wrong_type", "RECORD_HARDENING_RECEIPT_PROTOCOL", (candidate) => { candidate.protocol = 1; }],
    ["receipt_status_escalated", "RECORD_HARDENING_RECEIPT_STATUS", (candidate) => { candidate.status = "PASS_ACTIVATED"; }],
    ["receipt_status_wrong_type", "RECORD_HARDENING_RECEIPT_STATUS", (candidate) => { candidate.status = true; }],
    ["receipt_source_base_drift", "RECORD_HARDENING_RECEIPT_SOURCE_BASE", (candidate) => { candidate.source_base = "0".repeat(40); }],
    ["receipt_scope_base_drift", "RECORD_HARDENING_RECEIPT_SCOPE_BASE", (candidate) => { candidate.hardening_scope_base = "0".repeat(40); }],
    ["receipt_canonical_contract_drift", "RECORD_HARDENING_RECEIPT_CANONICAL_CONTRACT", (candidate) => { candidate.canonical_contract = "activation-authority.v1"; }],
    ["receipt_canonical_record_digest_drift", "RECORD_HARDENING_RECEIPT_CANONICAL_RECORD_DIGEST", (candidate) => { candidate.canonical_record_sha256 = "0".repeat(64); }],
    ["receipt_field_count_drift", "RECORD_HARDENING_RECEIPT_FIELD_COUNT", (candidate) => { candidate.field_count = 999999; }],
    ["receipt_schema_mutation_count_drift", "RECORD_HARDENING_RECEIPT_SCHEMA_MUTATION_COUNT", (candidate) => { candidate.schema_mutation_count = 0; }],
    ["receipt_member_digest_extra", "RECORD_HARDENING_RECEIPT_MEMBER_DIGESTS_FIELDS", (candidate) => { candidate.member_sha256["activation.json"] = "0".repeat(64); }],
    ["receipt_downstream_wrong_type", "RECORD_HARDENING_RECEIPT_DOWNSTREAM_TYPE", (candidate) => { candidate.downstream_authority = []; }],
    ["receipt_downstream_missing", "RECORD_HARDENING_RECEIPT_DOWNSTREAM_FIELDS", (candidate) => { delete candidate.downstream_authority.release_authorized; }],
    ["receipt_downstream_extra", "RECORD_HARDENING_RECEIPT_DOWNSTREAM_FIELDS", (candidate) => { candidate.downstream_authority.architecture_closure = true; }],
    ["receipt_activation_escalated", "RECORD_HARDENING_RECEIPT_DOWNSTREAM_AUTHORITY", (candidate) => { candidate.downstream_authority.phase2_authorized = true; }],
    ["receipt_implementation_escalated", "RECORD_HARDENING_RECEIPT_DOWNSTREAM_AUTHORITY", (candidate) => { candidate.downstream_authority.implementation_authorized = true; }],
    ["receipt_closure_escalated", "RECORD_HARDENING_RECEIPT_DOWNSTREAM_AUTHORITY", (candidate) => { candidate.downstream_authority.release_authorized = true; }],
  ];
  assert(mutations.length === RECEIPT_MUTATION_CASE_COUNT, "RECORD_HARDENING_RECEIPT_MUTATION_COUNT");
  for (const [, expected, mutate] of mutations) {
    const candidate = clone(receipt);
    mutate(candidate);
    expectFailure(() => validateManifestHardeningReceipt(candidate, manifestHardening, filesystemHardening), expected);
    validateManifestHardeningReceipt(receipt, manifestHardening, filesystemHardening);
  }
  return { failures: mutations.length, recoveries: mutations.length, residue: 0, names: mutations.map(([name]) => name) };
}

const contract = json("record-envelope-contract.json");
const schema = json("record-envelope-contract.schema.json");
const fixtures = json("conformance-fixtures.json");
const strengthening = json("record-type-strengthening-map.json");
const stage = json("stage-decision.json");
const manifest = json("package-manifest.json");
const baseRegistry = readParentJson("phase1-foundation-registry.json");

validateManifest(manifest);
const manifestHardening = validateManifestHardeningMutations(manifest);
const filesystemHardening = validateFilesystemDiscoveryMutations();

strictSchemas(schema);
const schemaRows = schemaCoverage(contract, schema);
validateSourceAndScope(contract);
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

const result = JSON.stringify(buildResult(contract, schemaRows, rawRows, semanticRows, canonical, manifestHardening, filesystemHardening), null, 2) + "\n";
const resultPath = resolve(ROOT, "validation-result.json");
const resultObject = JSON.parse(result);
validateManifestHardeningReceipt(resultObject, manifestHardening, filesystemHardening);
const receiptHardening = validateReceiptHardeningMutations(resultObject, manifestHardening, filesystemHardening);
if (mode === "--write") {
  writeFileSync(resultPath, result);
  assert(readFileSync(resultPath, "utf8") === result, "RECORD_VALIDATION_RESULT_WRITE_MISMATCH");
} else {
  assert(readFileSync(resultPath, "utf8") === result, "RECORD_VALIDATION_RESULT_STALE");
  validateManifestHardeningReceipt(json("validation-result.json"), manifestHardening, filesystemHardening);
}
if (mode === "--check-package-manifest") {
  console.log(JSON.stringify({
    protocol: "CUSTODIAL_V43_RECORD_ENVELOPE_MANIFEST_HARDENING_RESULT_V2",
    status: "PASS",
    package_entries: EXPECTED_PACKAGE_ENTRIES.length,
    manifest_members: manifest.members.length,
    semantic_mutation_failures: manifestHardening.failures,
    semantic_recoveries: manifestHardening.recoveries,
    filesystem_mutation_failures: filesystemHardening.failures,
    filesystem_recoveries: filesystemHardening.recoveries,
    receipt_semantic_mutation_failures: receiptHardening.failures,
    receipt_semantic_recoveries: receiptHardening.recoveries,
    normal_validation_receipt_binding: "PASS_EXACT_DETERMINISTIC_BYTES",
    owned_test_residue: manifestHardening.residue + filesystemHardening.residue + receiptHardening.residue,
    semantic_mutations: manifestHardening.names,
    filesystem_mutations: filesystemHardening.names,
    receipt_mutations: receiptHardening.names,
  }));
} else {
  console.log(JSON.stringify(resultObject));
}
