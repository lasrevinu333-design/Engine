#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, "../../../..");
const BASE_COMMIT = "ea22af22685d466b66334000c6bd931fb4beca6d";
const BASE_TREE = "61baa8d9499fcc8fb1a61c16361133ed9dddaae1";
const REPOSITORY_IDENTITY = "https://github.com/lasrevinu333-design/Engine.git";
const MANIFEST_SHA256 = "920cb9cdda2f2ce060e49bff9483ed5c86d772158d0998faa98a27cba95f54bb";
const MANIFEST_BLOB_SHA1 = "7255bced8afefa149c9eeb543f258e93fb05cbf3";
const MEMBER_SET_SHA256 = "bc2c8adf2e7eb5ba67692d6bd357e3f52503bcb5d1a79a72280fe7d43df4838b";
const MANIFEST_PATH = "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-content-manifest.json";
const SHA = /^[0-9a-f]{64}$/;
const GIT = /^[0-9a-f]{40}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const expectedFiles = ["README.md", "conformance-fixtures.json", "decision-status-matrix.json", "package-manifest.json", "private-evidence-plane-contract.json", "private-evidence-plane-contract.schema.json", "validate-private-evidence-plane.mjs"];
if (process.argv.length !== 3 || process.argv[2] !== "--check") throw new Error("USAGE: node validate-private-evidence-plane.mjs --check");
const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");
const json = (name) => JSON.parse(read(name));
const clone = (value) => structuredClone(value);
const fail = (code) => { const error = new Error(code); error.code = code; throw error; };
const ensure = (condition, code) => { if (!condition) fail(code); };
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function scalarCompare(a, b) {
  const aa = Array.from(a, (char) => char.codePointAt(0));
  const bb = Array.from(b, (char) => char.codePointAt(0));
  for (let index = 0; index < Math.min(aa.length, bb.length); index += 1) if (aa[index] !== bb[index]) return aa[index] - bb[index];
  return aa.length - bb.length;
}
function scalarText(value, code) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) { ensure(index + 1 < value.length && value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff, code); index += 1; }
    else ensure(unit < 0xdc00 || unit > 0xdfff, code);
  }
}
function canonical(value) {
  if (typeof value === "string") { scalarText(value, "PEP_NON_SCALAR"); ensure(value === value.normalize("NFC"), "PEP_NON_NFC"); return JSON.stringify(value); }
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") { ensure(Number.isSafeInteger(value) && !Object.is(value, -0), "PEP_CANONICAL_NUMBER"); return String(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  ensure(value && typeof value === "object", "PEP_CANONICAL_TYPE");
  const keys = Object.keys(value);
  keys.forEach((key) => scalarText(key, "PEP_NON_SCALAR_KEY"));
  const normalized = keys.map((key) => key.normalize("NFC"));
  ensure(new Set(normalized).size === keys.length, "PEP_NFC_KEY_COLLISION");
  ensure(keys.every((key) => key === key.normalize("NFC")), "PEP_NON_NFC_KEY");
  return `{${keys.sort(scalarCompare).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
const domainDigest = (domain, value) => sha256(Buffer.concat([Buffer.from(domain, "utf8"), Buffer.from([0]), Buffer.from(canonical(value), "utf8")]));
const without = (value, field) => { const result = clone(value); delete result[field]; return result; };
function strictObject(value, fields, code) { ensure(value && typeof value === "object" && !Array.isArray(value), code); ensure(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort()), code); }
function id(value, code) { ensure(typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value), code); }
function time(value, code) { if (typeof value !== "string" || !UTC.test(value)) fail(code); const parsed = Date.parse(value); ensure(Number.isFinite(parsed), code); ensure(new Date(parsed).toISOString() === value, code); }
function instant(value, code) { time(value, code); return Date.parse(value); }
function safeReference(value) { strictObject(value, ["reference_type", "value"], "PEP_PRIVATE_REFERENCE"); ensure(value.reference_type === "sha256_locator" && SHA.test(value.value), "PEP_PRIVATE_REFERENCE"); }

function resolveRef(ref, root) {
  ensure(typeof ref === "string" && /^#\/\$defs\/[A-Za-z][A-Za-z0-9_]*$/.test(ref), "PEP_SCHEMA_REF");
  const name = ref.slice("#/$defs/".length);
  ensure(root.$defs && own(root.$defs, name) && root.$defs[name] && typeof root.$defs[name] === "object", "PEP_SCHEMA_REF");
  return root.$defs[name];
}
function validateDraft(value, schema, root = schema) {
  ensure(schema && typeof schema === "object" && !Array.isArray(schema), "PEP_SCHEMA_REF");
  if (own(schema, "$ref")) return validateDraft(value, resolveRef(schema.$ref, root), root);
  if (own(schema, "const")) ensure(canonical(value) === canonical(schema.const), "PEP_SCHEMA_CONST");
  if (schema.enum) ensure(schema.enum.some((item) => canonical(item) === canonical(value)), "PEP_SCHEMA_ENUM");
  if (schema.type) {
    const actual = value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value;
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    ensure(allowed.includes(actual) || (actual === "integer" && allowed.includes("number")), "PEP_SCHEMA_TYPE");
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined) ensure(value.length >= schema.minLength, "PEP_SCHEMA_MIN_LENGTH");
    if (schema.pattern) ensure(new RegExp(schema.pattern).test(value), "PEP_SCHEMA_PATTERN");
    if (schema.format === "date-time") time(value, "PEP_SCHEMA_FORMAT");
  }
  if (typeof value === "number" && schema.minimum !== undefined) ensure(value >= schema.minimum, "PEP_SCHEMA_MINIMUM");
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined) ensure(value.length >= schema.minItems, "PEP_SCHEMA_MIN_ITEMS");
    if (schema.uniqueItems) ensure(new Set(value.map(canonical)).size === value.length, "PEP_SCHEMA_UNIQUE_ITEMS");
    if (schema.items) value.forEach((item) => validateDraft(item, schema.items, root));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (schema.required) schema.required.forEach((key) => ensure(own(value, key), "PEP_SCHEMA_REQUIRED"));
    if (schema.properties) {
      if (schema.additionalProperties === false) ensure(Object.keys(value).every((key) => own(schema.properties, key)), "PEP_SCHEMA_ADDITIONAL_PROPERTY");
      for (const [key, child] of Object.entries(schema.properties)) if (own(value, key)) validateDraft(value[key], child, root);
    }
  }
}
function validateDeclaredSchema(contract, schema) {
  ensure(schema.$schema === "https://json-schema.org/draft/2020-12/schema" && schema.type === "object" && schema.additionalProperties === false, "PEP_SCHEMA_DIALECT");
  for (const name of ["private_safe_public_reference", "candidate_locator_registration", "candidate_authorization_chain", "authorization_decision", "evidence_member", "evidence_set_record", "package_attestation_record", "sequence_namespace_policy", "stage_decision", "gate_decision", "invalidation", "supersession"]) {
    const definition = schema.$defs?.[name];
    ensure(definition?.type === "object" && definition.additionalProperties === false && Array.isArray(definition.required), "PEP_SCHEMA_CLOSED_OBJECT");
    ensure(definition.required.every((key) => own(definition.properties, key)), "PEP_SCHEMA_REQUIRED");
  }
  validateDraft(contract, schema);
}
function fieldSet(fields) { return canonical([...fields].sort(scalarCompare)); }
function validateContractParity(contract, schema) {
  const contracts = contract.record_contracts;
  const definitions = { locator_registration: "candidate_locator_registration", authorization_chain: "candidate_authorization_chain", authorization_decision: "authorization_decision", evidence_member: "evidence_member", evidence_set: "evidence_set_record", package_attestation: "package_attestation_record", sequence_namespace_policy: "sequence_namespace_policy", namespace_entry: "namespace_entry", decision_common: "decision_common", stage_decision: "stage_decision", gate_decision: "gate_decision", invalidation: "invalidation", supersession: "supersession" };
  for (const [abstractName, definitionName] of Object.entries(definitions)) {
    const definition = schema.$defs[definitionName];
    ensure(fieldSet(contracts[abstractName]) === fieldSet(definition.required), "PEP_CONTRACT_FIELD_PARITY");
    ensure(fieldSet(definition.required) === fieldSet(Object.keys(definition.properties)), "PEP_CONTRACT_FIELD_PARITY");
  }
  ensure(fieldSet(contract.locator_registration.required) === fieldSet(contracts.locator_registration), "PEP_CONTRACT_FIELD_PARITY");
  ensure(fieldSet(contract.authorization_chain.required) === fieldSet(contracts.authorization_chain), "PEP_CONTRACT_FIELD_PARITY");
  ensure(fieldSet(contract.evidence_set.required) === fieldSet(contracts.evidence_set), "PEP_CONTRACT_FIELD_PARITY");
  ensure(fieldSet(contract.package_attestation.required) === fieldSet(contracts.package_attestation), "PEP_CONTRACT_FIELD_PARITY");
  ensure(fieldSet(contract.decision_history.required_common_fields) === fieldSet(contracts.decision_common), "PEP_CONTRACT_FIELD_PARITY");
  ensure(fieldSet([...contract.decision_history.required_common_fields, ...contract.decision_history.stage_required_fields]) === fieldSet(contracts.stage_decision), "PEP_CONTRACT_FIELD_PARITY");
  ensure(fieldSet([...contract.decision_history.required_common_fields, ...contract.decision_history.gate_required_fields]) === fieldSet(contracts.gate_decision), "PEP_CONTRACT_FIELD_PARITY");
}
function validateContract(contract) {
  ensure(contract.protocol === "CUSTODIAL_V43_PRIVATE_EVIDENCE_PLANE_CONTRACT_V1" && contract.status === "UNREGISTERED_NON_ACTIVATABLE", "PEP_CONTRACT_STATUS");
  ensure(Object.values(contract.authority).every((value) => value === false), "PEP_ACTIVATION_ESCALATION");
  ensure(contract.scope.root_gate === "G-EVIDENCE-001", "PEP_ROOT_GATE");
  ensure(contract.locator_registration.status === "MISSING_PRIMARY_EVIDENCE" && contract.locator_registration.actual_locator === null, "PEP_LOCATOR_UNRESOLVED");
  ensure(contract.authorization_chain.required_capability === "gate.g_evidence_001.decide" && contract.authorization_chain.phase1_stage_authority_substitution === "forbidden", "PEP_PHASE1_AUTHORITY_SUBSTITUTION");
  ensure(contract.decision_history.sequence_namespace_policy === "UNRESOLVED_PRIMARY_EVIDENCE_REQUIRED" && contract.decision_history.shared_or_separate_namespaces === "UNRESOLVED", "PEP_NAMESPACE_POLICY");
  ensure(contract.inherited_reference.classification === "UNVERIFIABLE_INHERITED_REFERENCE" && !contract.inherited_reference.admissible_for_gate_closure, "PEP_CANDIDATE_ADMISSION");
}
function validateAuthorization(decision, chain) {
  ensure(decision.decision === "ALLOW", "PEP_AUTHORIZATION_ALLOW");
  ensure(decision.principal_id === chain.issuer_principal_id && canonical(decision.credential_reference) === canonical(chain.credential_verification_reference) && decision.grant_id === chain.grant_id && decision.capability === chain.capability && decision.resource === chain.resource_scope && decision.authority_set_id === chain.authority_set_id && decision.policy_version === chain.policy_version && decision.idempotency_key === chain.authorization_idempotency_key, "PEP_AUTHORIZATION_BINDING");
  ensure(decision.principal_id !== "P-INDEPENDENT-STAGE-AUTHORITY", "PEP_PHASE1_AUTHORITY_SUBSTITUTION");
}
function validateMember(member) {
  strictObject(member, ["member_id", "member_kind", "public_reference", "sensitivity", "member_digest_sha256"], "PEP_MEMBER_SHAPE");
  id(member.member_id, "PEP_MEMBER_ID"); id(member.member_kind, "PEP_MEMBER_KIND"); id(member.sensitivity, "PEP_MEMBER_SENSITIVITY"); safeReference(member.public_reference);
  ensure(member.member_digest_sha256 === domainDigest("custodial.v43.evidence-member.v1", without(member, "member_digest_sha256")), "PEP_MEMBER_DIGEST");
}
function validateEvidenceSet(set, authorization) {
  const fields = ["evidence_set_id", "evidence_set_sha256", "member_count", "ordered_member_ids", "member_identity_digest_sha256", "canonicalization_id", "issuer_principal_id", "issuer_authorization_decision_id", "created_at_utc", "members"];
  strictObject(set, fields, "PEP_SET_SHAPE");
  set.members.forEach(validateMember); const ids = set.members.map((member) => member.member_id);
  ensure(set.member_count === set.members.length && set.members.length > 0, "PEP_MEMBER_COUNT");
  ensure(new Set(ids).size === ids.length, "PEP_MEMBER_DUPLICATE");
  ensure(canonical(ids) === canonical([...ids].sort(scalarCompare)) && canonical(ids) === canonical(set.ordered_member_ids), "PEP_MEMBER_ORDER");
  ensure(set.member_identity_digest_sha256 === domainDigest("custodial.v43.evidence-member-set.v1", set.members.map((member) => ({ member_id: member.member_id, member_digest_sha256: member.member_digest_sha256 }))), "PEP_SET_MEMBER_DIGEST");
  ensure(set.evidence_set_sha256 === domainDigest("custodial.v43.evidence-set.v1", without(set, "evidence_set_sha256")), "PEP_SET_DIGEST");
  ensure(set.canonicalization_id === "canonical-json.nfc.unicode-scalar.v1" && set.issuer_principal_id === authorization.principal_id && set.issuer_authorization_decision_id === authorization.authorization_decision_id, "PEP_AUTHORIZATION_BINDING");
  time(set.created_at_utc, "PEP_SET_TIME");
}
function gitValue(args) { try { return execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim(); } catch { fail("PEP_ATTESTATION_IMMUTABLE_BINDING"); } }
function validateAttestation(attestation, evidenceSet, authorization) {
  const fields = ["package_attestation_id", "content_manifest_sha256", "content_manifest_git_blob_sha1", "repository_identity", "exact_commit", "exact_tree", "member_sha256_set_digest", "issuer_principal_id", "issuer_authorization_decision_id", "evidence_set_sha256", "issued_at_utc", "attestation_canonical_sha256"];
  strictObject(attestation, fields, "PEP_ATTESTATION_SHAPE");
  ensure(attestation.repository_identity === REPOSITORY_IDENTITY && gitValue(["remote", "get-url", "origin"]) === REPOSITORY_IDENTITY, "PEP_ATTESTATION_REPOSITORY_BINDING");
  ensure(attestation.exact_commit === BASE_COMMIT && attestation.exact_tree === BASE_TREE && attestation.content_manifest_sha256 === MANIFEST_SHA256 && attestation.content_manifest_git_blob_sha1 === MANIFEST_BLOB_SHA1 && attestation.member_sha256_set_digest === MEMBER_SET_SHA256, "PEP_ATTESTATION_IMMUTABLE_BINDING");
  ensure(attestation.evidence_set_sha256 === evidenceSet.evidence_set_sha256 && attestation.issuer_principal_id === authorization.principal_id && attestation.issuer_authorization_decision_id === authorization.authorization_decision_id, "PEP_AUTHORIZATION_BINDING");
  const bytes = execFileSync("git", ["show", `${BASE_COMMIT}:${MANIFEST_PATH}`], { cwd: REPO }); const manifest = JSON.parse(bytes);
  const memberDigest = domainDigest("custodial.v43.content-manifest-members.v1", manifest.members.map((member) => ({ path: member.repo_path, digest: member.content_digest.value })).sort((a, b) => scalarCompare(a.path, b.path)));
  ensure(sha256(bytes) === MANIFEST_SHA256 && gitValue(["rev-parse", `${BASE_COMMIT}:${MANIFEST_PATH}`]) === MANIFEST_BLOB_SHA1 && gitValue(["rev-parse", `${BASE_COMMIT}^{tree}`]) === BASE_TREE && memberDigest === MEMBER_SET_SHA256, "PEP_ATTESTATION_IMMUTABLE_BINDING");
  ensure(attestation.attestation_canonical_sha256 === domainDigest("custodial.v43.package-attestation.v1", without(attestation, "attestation_canonical_sha256")), "PEP_ATTESTATION_DIGEST");
  time(attestation.issued_at_utc, "PEP_ATTESTATION_TIME");
}
function validatePolicy(policy) {
  const entries = new Map();
  for (const entry of policy.namespaces) { ensure(!entries.has(entry.namespace_id), "PEP_NAMESPACE_POLICY"); entries.set(entry.namespace_id, entry.record_family); }
  ensure(entries.size === 4 && ["stage", "gate", "invalidation", "supersession"].every((family) => [...entries.values()].filter((value) => value === family).length === 1), "PEP_NAMESPACE_POLICY");
  return entries;
}
function validateSetAttestationTime(candidate) {
  ensure(instant(candidate.evidence_set.created_at_utc, "PEP_TIME_SET_ATTESTATION") <= instant(candidate.attestation.issued_at_utc, "PEP_TIME_SET_ATTESTATION") && instant(candidate.successor_evidence_set.created_at_utc, "PEP_TIME_SET_ATTESTATION") <= instant(candidate.successor_attestation.issued_at_utc, "PEP_TIME_SET_ATTESTATION"), "PEP_TIME_SET_ATTESTATION");
}
function validateHistory(candidate, authorization) {
  const policy = validatePolicy(candidate.sequence_namespace_policy);
  const sets = new Map([[candidate.evidence_set.evidence_set_sha256, candidate.evidence_set], [candidate.successor_evidence_set.evidence_set_sha256, candidate.successor_evidence_set]]);
  const attestations = new Map([[candidate.attestation.package_attestation_id, candidate.attestation], [candidate.successor_attestation.package_attestation_id, candidate.successor_attestation]]);
  const records = [...candidate.decision_history, candidate.invalidation, candidate.supersession];
  const seen = new Map(); const claims = new Set(); const idempotency = new Map(); const allByDigest = new Map(); const recordIds = new Set(); const recordDigests = new Set();
  for (const record of records) {
    const definition = record.record_family === "stage" ? "stage_decision" : record.record_family === "gate" ? "gate_decision" : record.record_family;
    validateDraft(record, schema.$defs[definition], schema);
    const recordId = record.decision_id ?? record.invalidation_id ?? record.supersession_id;
    ensure(!recordIds.has(recordId), "PEP_RECORD_ID_DUPLICATE"); recordIds.add(recordId);
    ensure(!recordDigests.has(record.record_sha256), "PEP_RECORD_DIGEST_DUPLICATE"); recordDigests.add(record.record_sha256);
    ensure(policy.get(record.sequence_namespace_id) === record.record_family, "PEP_CROSS_FAMILY_AMBIGUITY");
    const actor = record.record_family === "stage" ? record.actor_principal_id : record.record_family === "gate" ? record.decision_authority_principal : record.authorizer_principal_id;
    ensure(record.authorization_decision_id === authorization.authorization_decision_id && actor === authorization.principal_id, "PEP_AUTHORIZATION_BINDING");
    const actionTime = instant(record.record_family === "stage" || record.record_family === "gate" ? record.decided_at_utc : record.recorded_at_utc, "PEP_DECISION_TIME");
    ensure(instant(authorization.decided_at_utc, "PEP_TIME_AUTHORIZATION_USE") <= actionTime, "PEP_TIME_AUTHORIZATION_USE");
    if (["stage", "gate"].includes(record.record_family)) {
      const boundAttestation = attestations.get(record.package_attestation_id);
      ensure(boundAttestation && boundAttestation.evidence_set_sha256 === record.evidence_set_sha256, "PEP_DECISION_ATTESTATION_BINDING");
      ensure(instant(boundAttestation.issued_at_utc, "PEP_TIME_DECISION_ATTESTATION") <= actionTime, "PEP_TIME_DECISION_ATTESTATION");
    }
    const group = `${record.sequence_namespace_id}:${record.aggregate_id}`; const claim = `${group}:${record.sequence}`; const prior = seen.get(group);
    ensure(!claims.has(claim), "PEP_SEQUENCE_COLLISION"); claims.add(claim);
    if (!prior) ensure(record.sequence === 1 && record.predecessor_record_sha256 === null, "PEP_SEQUENCE_START");
    else { ensure(record.sequence === prior.sequence + 1, "PEP_SEQUENCE_GAP"); ensure(record.predecessor_record_sha256 === prior.record_sha256, "PEP_PREDECESSOR"); ensure(instant(prior.record_family === "stage" || prior.record_family === "gate" ? prior.decided_at_utc : prior.recorded_at_utc, "PEP_TIME_SEQUENCE_REGRESSION") <= actionTime, "PEP_TIME_SEQUENCE_REGRESSION"); }
    const duplicateKey = `${group}:${record.idempotency_key}`; if (idempotency.has(duplicateKey)) ensure(idempotency.get(duplicateKey) === record.record_sha256, "PEP_DUPLICATE_REPLAY"); else idempotency.set(duplicateKey, record.record_sha256);
    ensure(record.record_sha256 === domainDigest("custodial.v43.private-decision.v1", without(record, "record_sha256")), "PEP_DECISION_DIGEST");
    seen.set(group, record); allByDigest.set(record.record_sha256, record);
  }
  const base = candidate.evidence_set.evidence_set_sha256; const successor = candidate.successor_evidence_set.evidence_set_sha256;
  ensure(sets.has(candidate.invalidation.target_evidence_set_sha256) && attestations.has(candidate.invalidation.target_package_attestation_id) && allByDigest.has(candidate.invalidation.target_record_sha256), "PEP_INVALIDATION");
  ensure(candidate.invalidation.target_evidence_set_sha256 === base && candidate.invalidation.target_package_attestation_id === candidate.attestation.package_attestation_id && allByDigest.get(candidate.invalidation.target_record_sha256).evidence_set_sha256 === base, "PEP_INVALIDATION");
  ensure(instant(candidate.invalidation.recorded_at_utc, "PEP_TIME_INVALIDATION_TARGET") >= Math.max(instant(candidate.evidence_set.created_at_utc, "PEP_TIME_INVALIDATION_TARGET"), instant(candidate.attestation.issued_at_utc, "PEP_TIME_INVALIDATION_TARGET"), instant(allByDigest.get(candidate.invalidation.target_record_sha256).decided_at_utc, "PEP_TIME_INVALIDATION_TARGET")), "PEP_TIME_INVALIDATION_TARGET");
  ensure(sets.has(candidate.supersession.superseded_evidence_set_sha256) && sets.has(candidate.supersession.successor_evidence_set_sha256) && attestations.has(candidate.supersession.superseded_package_attestation_id) && attestations.has(candidate.supersession.successor_package_attestation_id) && allByDigest.has(candidate.supersession.superseded_record_sha256) && allByDigest.has(candidate.supersession.successor_record_sha256), "PEP_SUPERSESSION_REWRITE");
  ensure(candidate.supersession.superseded_evidence_set_sha256 === base && candidate.supersession.successor_evidence_set_sha256 === successor && candidate.supersession.superseded_package_attestation_id === candidate.attestation.package_attestation_id && candidate.supersession.successor_package_attestation_id === candidate.successor_attestation.package_attestation_id && allByDigest.get(candidate.supersession.superseded_record_sha256).evidence_set_sha256 === base && allByDigest.get(candidate.supersession.successor_record_sha256).evidence_set_sha256 === successor, "PEP_SUPERSESSION_REWRITE");
  ensure(instant(candidate.supersession.recorded_at_utc, "PEP_TIME_SUPERSESSION_SUCCESSOR") >= Math.max(instant(candidate.evidence_set.created_at_utc, "PEP_TIME_SUPERSESSION_SUCCESSOR"), instant(candidate.successor_evidence_set.created_at_utc, "PEP_TIME_SUPERSESSION_SUCCESSOR"), instant(candidate.attestation.issued_at_utc, "PEP_TIME_SUPERSESSION_SUCCESSOR"), instant(candidate.successor_attestation.issued_at_utc, "PEP_TIME_SUPERSESSION_SUCCESSOR"), instant(allByDigest.get(candidate.supersession.superseded_record_sha256).decided_at_utc, "PEP_TIME_SUPERSESSION_SUCCESSOR"), instant(allByDigest.get(candidate.supersession.successor_record_sha256).decided_at_utc, "PEP_TIME_SUPERSESSION_SUCCESSOR")), "PEP_TIME_SUPERSESSION_SUCCESSOR");
  const inactiveSets = new Set([candidate.invalidation.target_evidence_set_sha256, candidate.supersession.superseded_evidence_set_sha256]);
  const inactiveAttestations = new Set([candidate.invalidation.target_package_attestation_id, candidate.supersession.superseded_package_attestation_id]);
  const ineffective = (record) => inactiveSets.has(record.evidence_set_sha256) || inactiveAttestations.has(record.package_attestation_id) || record.record_sha256 === candidate.invalidation.target_record_sha256 || record.record_sha256 === candidate.supersession.superseded_record_sha256;
  ensure(candidate.decision_history.filter((record) => record.evidence_set_sha256 === base).every(ineffective) && candidate.decision_history.filter((record) => record.evidence_set_sha256 === successor).every((record) => !ineffective(record)), "PEP_TRANSITIVE_INVALIDATION");
  for (const terminal of [candidate.invalidation, candidate.supersession]) for (const record of candidate.decision_history) if ((record.evidence_set_sha256 === base || record.package_attestation_id === candidate.attestation.package_attestation_id) && instant(record.decided_at_utc, "PEP_TERMINAL_STATE") >= instant(terminal.recorded_at_utc, "PEP_TERMINAL_STATE")) fail("PEP_TERMINAL_STATE");
  for (const record of candidate.decision_history.filter((record) => record.record_family === "gate" && record.command === "CLOSE")) {
    if (ineffective(record)) fail("PEP_STALE_EVIDENCE_BINDING");
    fail("PEP_GATE_CLOSURE_UNAUTHORIZED");
  }
  return { ineffective, records };
}
function validateCandidate(candidate) {
  for (const [value, definition] of [[candidate.locator_registration, "candidate_locator_registration"], [candidate.authorization_chain, "candidate_authorization_chain"], [candidate.authorization_decision, "authorization_decision"], [candidate.sequence_namespace_policy, "sequence_namespace_policy"], [candidate.evidence_set, "evidence_set_record"], [candidate.successor_evidence_set, "evidence_set_record"], [candidate.attestation, "package_attestation_record"], [candidate.successor_attestation, "package_attestation_record"], [candidate.invalidation, "invalidation"], [candidate.supersession, "supersession"]]) validateDraft(value, schema.$defs[definition], schema);
  candidate.decision_history.forEach((record) => validateDraft(record, schema.$defs[record.record_family === "stage" ? "stage_decision" : "gate_decision"], schema));
  safeReference(candidate.public_reference); safeReference(candidate.locator_registration.public_reference); safeReference(candidate.authorization_chain.credential_verification_reference); safeReference(candidate.authorization_chain.revocation_reference);
  ensure(candidate.locator_registration.status === "CANDIDATE_ONLY" && canonical(candidate.locator_registration.public_reference) === canonical(candidate.public_reference), "PEP_LOCATOR_REFERENCE_BINDING");
  ensure(candidate.locator_registration.registration_digest_sha256 === domainDigest("custodial.v43.private-locator-registration.v1", without(candidate.locator_registration, "registration_digest_sha256")), "PEP_LOCATOR_DIGEST");
  ensure(candidate.locator_registration.registrar_principal_id === candidate.authorization_decision.principal_id && candidate.locator_registration.registrar_authorization_decision_id === candidate.authorization_decision.authorization_decision_id, "PEP_AUTHORIZATION_BINDING");
  ensure(candidate.authorization_chain.issuer_principal_id !== "P-INDEPENDENT-STAGE-AUTHORITY", "PEP_PHASE1_AUTHORITY_SUBSTITUTION");
  validateAuthorization(candidate.authorization_decision, candidate.authorization_chain);
  const authorizationTime = instant(candidate.authorization_decision.decided_at_utc, "PEP_TIME_AUTHORIZATION_USE");
  ensure(authorizationTime <= instant(candidate.locator_registration.registered_at_utc, "PEP_TIME_AUTHORIZATION_USE") && authorizationTime <= instant(candidate.evidence_set.created_at_utc, "PEP_TIME_AUTHORIZATION_USE") && authorizationTime <= instant(candidate.successor_evidence_set.created_at_utc, "PEP_TIME_AUTHORIZATION_USE") && authorizationTime <= instant(candidate.attestation.issued_at_utc, "PEP_TIME_AUTHORIZATION_USE") && authorizationTime <= instant(candidate.successor_attestation.issued_at_utc, "PEP_TIME_AUTHORIZATION_USE"), "PEP_TIME_AUTHORIZATION_USE");
  validateEvidenceSet(candidate.evidence_set, candidate.authorization_decision); validateEvidenceSet(candidate.successor_evidence_set, candidate.authorization_decision);
  validateAttestation(candidate.attestation, candidate.evidence_set, candidate.authorization_decision); validateAttestation(candidate.successor_attestation, candidate.successor_evidence_set, candidate.authorization_decision);
  validateSetAttestationTime(candidate);
  validateHistory(candidate, candidate.authorization_decision);
}
function validateManifest(manifest) {
  ensure(manifest.protocol === "CUSTODIAL_V43_PRIVATE_EVIDENCE_PLANE_PACKAGE_MANIFEST_V1" && manifest.self_digest_excluded === true, "PEP_MANIFEST");
  const files = fs.readdirSync(ROOT).filter((name) => fs.statSync(path.join(ROOT, name)).isFile()).sort(); ensure(canonical(files) === canonical([...expectedFiles].sort()), "PEP_MANIFEST_MEMBERSHIP");
  for (const name of expectedFiles.filter((name) => name !== "package-manifest.json")) ensure(manifest.members[name] === sha256(read(name)), "PEP_MANIFEST_DIGEST");
}
function validateFixtureClassification(fixtures) {
  const classification = fixtures.fixture_classification;
  ensure(classification.normal_candidate.fixture_id === fixtures.normal_candidate.fixture_id && classification.normal_candidate.classification === "HISTORICAL_ATTESTATION_FIXTURE" && classification.normal_candidate.current_authority === false, "PEP_FIXTURE_CLASSIFICATION");
  ensure(classification.normal_candidate.binding_commit === BASE_COMMIT && classification.normal_candidate.binding_manifest_sha256 === MANIFEST_SHA256 && classification.normal_candidate.base_record_disposition === "INVALIDATED_AND_SUPERSEDED_FIXTURE" && classification.normal_candidate.successor_record_disposition === "HISTORICAL_FIXTURE_ONLY_NOT_CURRENT", "PEP_FIXTURE_CLASSIFICATION");
  ensure(classification.normal_candidate.validator_path === "validate-private-evidence-plane.mjs:validateCandidate", "PEP_FIXTURE_CLASSIFICATION");
  const family = classification.failure_case_family, ids = fixtures.failure_cases.map((item) => item.id);
  ensure(family.classification === "CURRENT_TEST_FIXTURE" && family.current_authority === false && family.fixture_count === 84 && family.validator_path === "validate-private-evidence-plane.mjs:mutation", "PEP_FIXTURE_CLASSIFICATION");
  ensure(canonical(family.fixture_ids) === canonical(ids) && new Set(family.fixture_ids).size === 84, "PEP_FIXTURE_CLASSIFICATION");
  ensure(sha256(fs.readFileSync(path.join(REPO, MANIFEST_PATH))) !== MANIFEST_SHA256, "PEP_HISTORICAL_FIXTURE_NOT_CURRENT");
}
function recompute(record) { record.record_sha256 = domainDigest("custodial.v43.private-decision.v1", without(record, "record_sha256")); return record; }
function recomputeAttestation(attestation) { attestation.attestation_canonical_sha256 = domainDigest("custodial.v43.package-attestation.v1", without(attestation, "attestation_canonical_sha256")); return attestation; }
function recomputeEvidenceSet(set) {
  set.member_identity_digest_sha256 = domainDigest("custodial.v43.evidence-member-set.v1", set.members.map((member) => ({ member_id: member.member_id, member_digest_sha256: member.member_digest_sha256 })));
  set.evidence_set_sha256 = domainDigest("custodial.v43.evidence-set.v1", without(set, "evidence_set_sha256"));
  return set;
}
function appendGateClose(candidate, binding, decidedAt) {
  const prior = candidate.decision_history.find((record) => record.record_family === "gate");
  const record = { ...clone(prior), decision_id: "DEC-GATE-CLOSE-001", sequence: 2, predecessor_record_sha256: prior.record_sha256, idempotency_key: "candidate-gate-close-1", command: "CLOSE", next_status: "CLOSED", package_attestation_id: binding.attestation.package_attestation_id, evidence_set_sha256: binding.evidence_set.evidence_set_sha256, decided_at_utc: decidedAt };
  candidate.decision_history.push(recompute(record));
}
function mutation(id, action) {
  const expected = fixtureCases.get(id); ensure(expected, "PEP_FIXTURE_COVERAGE");
  try { action(); fail("PEP_MUTATION_ESCAPED"); } catch (error) { ensure(error.code === expected.code, `PEP_MUTATION_WRONG_CODE:${id}:${error.code}`); }
  validateCandidate(clone(candidate)); observed.push({ id, code: expected.code, category: expected.category }); counts[expected.category] = (counts[expected.category] ?? 0) + 1; recoveries += 1;
}

const contract = json("private-evidence-plane-contract.json"); const schema = json("private-evidence-plane-contract.schema.json"); const fixtures = json("conformance-fixtures.json"); const matrix = json("decision-status-matrix.json"); const manifest = json("package-manifest.json");
validateDeclaredSchema(contract, schema); validateContractParity(contract, schema); validateContract(contract); validateManifest(manifest); validateFixtureClassification(fixtures);
const classificationMutation = clone(fixtures); classificationMutation.fixture_classification.normal_candidate.current_authority = true;
try { validateFixtureClassification(classificationMutation); fail("PEP_FIXTURE_CLASSIFICATION_MUTATION_ESCAPED"); } catch (error) { ensure(error.code === "PEP_FIXTURE_CLASSIFICATION", "PEP_FIXTURE_CLASSIFICATION_MUTATION"); }
validateFixtureClassification(clone(fixtures));
const gateRegistry = JSON.parse(fs.readFileSync(path.join(REPO, "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-gate-registry.json"), "utf8"));
ensure(matrix.status === "G_EVIDENCE_001_OPEN" && matrix.rows.length === 4 && canonical(matrix.rows.map((row) => row.class).sort(scalarCompare)) === canonical(["CANDIDATE_ONLY_EVIDENCE", "G_EVIDENCE_001_CLOSURE_PREREQUISITES", "MISSING_AUTHORITY", "READY_EVIDENCE"]) && matrix.rows.every((row) => row.admissible_for_closure === false) && gateRegistry.gates.length === 39 && gateRegistry.gates.every((gate) => gate.status === "OPEN"), "PEP_MATRIX");
const sourceFixture = read("conformance-fixtures.json"); ensure(!sourceFixture.includes('"computed"') && !sourceFixture.includes('"0000000000000000000000000000000000000000"') && !sourceFixture.includes('"1111111111111111111111111111111111111111111111111111111111111111"'), "PEP_FIXTURE_PLACEHOLDER");
const candidate = clone(fixtures.normal_candidate); validateCandidate(candidate);
const fixtureCases = new Map(); for (const item of fixtures.failure_cases) { strictObject(item, ["id", "code", "category"], "PEP_FIXTURE_COVERAGE"); ensure(!fixtureCases.has(item.id), "PEP_FIXTURE_COVERAGE"); fixtureCases.set(item.id, item); }
const observed = []; const counts = {}; let recoveries = 0;
mutation("non_nfc_value", () => canonical("e\u0301"));
mutation("non_nfc_key", () => canonical({ "e\u0301": 1 }));
mutation("non_scalar_value", () => canonical("\ud800"));
mutation("non_scalar_key", () => canonical({ "\udc00": 1 }));
mutation("nfc_key_collision", () => canonical({ "é": 1, "e\u0301": 2 }));
mutation("unicode_scalar_order", () => { const got = canonical({ "\u{10000}": 1, "\uE000": 2 }); ensure(got === '{"\uE000":2,"𐀀":1}', "PEP_MUTATION_ESCAPED"); fail("PEP_SCALAR_ORDER"); });
for (const [id, value] of [["unsafe_credential", "credential=forbidden"], ["unsafe_secret", "secret=forbidden"], ["unsafe_token", "token=forbidden"], ["unsafe_mailbox", "mailbox=forbidden"], ["unsafe_signed_url", "https://example.invalid/signed?sig=forbidden"], ["unsafe_local_path", "/home/eric/private"]]) mutation(id, () => { const changed = clone(candidate); changed.public_reference.value = value; validateCandidate(changed); });
mutation("locator_digest", () => { const changed = clone(candidate); changed.locator_registration.registration_digest_sha256 = "0".repeat(64); validateCandidate(changed); });
mutation("locator_reference", () => { const changed = clone(candidate); changed.locator_registration.public_reference.value = "b".repeat(64); changed.locator_registration.registration_digest_sha256 = domainDigest("custodial.v43.private-locator-registration.v1", without(changed.locator_registration, "registration_digest_sha256")); validateCandidate(changed); });
mutation("phase1_substitution", () => { const changed = clone(candidate); changed.authorization_chain.issuer_principal_id = "P-INDEPENDENT-STAGE-AUTHORITY"; validateCandidate(changed); });
mutation("authorization_deny", () => { const changed = clone(candidate); changed.authorization_decision.decision = "DENY"; validateAuthorization(changed.authorization_decision, changed.authorization_chain); });
for (const [id, field, value] of [["authorization_credential", "credential_reference", { reference_type: "sha256_locator", value: "a".repeat(64) }], ["authorization_grant", "grant_id", "other-grant"], ["authorization_capability", "capability", "other.capability"], ["authorization_resource", "resource", "OTHER-GATE"], ["authorization_authority_set", "authority_set_id", "other-authority"], ["authorization_policy", "policy_version", "other-policy"], ["authorization_principal", "principal_id", "other-principal"], ["authorization_idempotency", "idempotency_key", "other-auth-key"]]) mutation(id, () => { const changed = clone(candidate); changed.authorization_decision[field] = value; validateAuthorization(changed.authorization_decision, changed.authorization_chain); });
mutation("locator_authorizer", () => { const changed = clone(candidate); changed.locator_registration.registrar_authorization_decision_id = "other-decision"; changed.locator_registration.registration_digest_sha256 = domainDigest("custodial.v43.private-locator-registration.v1", without(changed.locator_registration, "registration_digest_sha256")); validateCandidate(changed); });
mutation("set_issuer", () => { const changed = clone(candidate); changed.evidence_set.issuer_principal_id = "other-principal"; recomputeEvidenceSet(changed.evidence_set); validateCandidate(changed); });
mutation("set_authorizer", () => { const changed = clone(candidate); changed.evidence_set.issuer_authorization_decision_id = "other-decision"; recomputeEvidenceSet(changed.evidence_set); validateCandidate(changed); });
mutation("attestation_issuer", () => { const changed = clone(candidate); changed.attestation.issuer_principal_id = "other-principal"; validateCandidate(changed); });
mutation("attestation_authorizer", () => { const changed = clone(candidate); changed.attestation.issuer_authorization_decision_id = "other-decision"; validateCandidate(changed); });
mutation("stage_actor", () => { const changed = clone(candidate); changed.decision_history[0].actor_principal_id = "other-principal"; validateCandidate(changed); });
mutation("stage_authorizer", () => { const changed = clone(candidate); changed.decision_history[0].authorization_decision_id = "other-decision"; validateCandidate(changed); });
mutation("gate_authority", () => { const changed = clone(candidate); changed.decision_history[1].decision_authority_principal = "other-principal"; validateCandidate(changed); });
mutation("gate_authorizer", () => { const changed = clone(candidate); changed.decision_history[1].authorization_decision_id = "other-decision"; validateCandidate(changed); });
mutation("unordered_members", () => { const changed = clone(candidate); changed.evidence_set.members.reverse(); validateCandidate(changed); });
mutation("duplicate_member", () => { const changed = clone(candidate); changed.evidence_set.members[1].member_id = "E-001"; changed.evidence_set.members[1].member_digest_sha256 = domainDigest("custodial.v43.evidence-member.v1", without(changed.evidence_set.members[1], "member_digest_sha256")); validateCandidate(changed); });
mutation("member_digest", () => { const changed = clone(candidate); changed.evidence_set.members[0].member_digest_sha256 = "0".repeat(64); validateCandidate(changed); });
mutation("set_digest", () => { const changed = clone(candidate); changed.evidence_set.evidence_set_sha256 = "0".repeat(64); validateCandidate(changed); });
mutation("attestation_digest", () => { const changed = clone(candidate); changed.attestation.attestation_canonical_sha256 = "0".repeat(64); validateAttestation(changed.attestation, changed.evidence_set, changed.authorization_decision); });
mutation("manifest_binding", () => { const changed = clone(candidate); changed.attestation.content_manifest_sha256 = "a".repeat(64); validateAttestation(changed.attestation, changed.evidence_set, changed.authorization_decision); });
mutation("repository_binding", () => { const changed = clone(candidate); changed.attestation.repository_identity = "https://example.invalid/not-engine.git"; validateAttestation(changed.attestation, changed.evidence_set, changed.authorization_decision); });
mutation("sequence_policy", () => { const changed = clone(candidate); changed.sequence_namespace_policy.namespaces[3].namespace_id = changed.sequence_namespace_policy.namespaces[2].namespace_id; validateCandidate(changed); });
mutation("sequence_start", () => { const changed = clone(candidate); changed.decision_history[0].sequence = 2; validateCandidate(changed); });
mutation("sequence_gap", () => { const changed = clone(candidate); changed.decision_history[2].sequence = 3; recompute(changed.decision_history[2]); validateCandidate(changed); });
mutation("sequence_collision", () => { const changed = clone(candidate); const copied = clone(changed.decision_history[0]); copied.decision_id = "DEC-CANDIDATE-COLLISION"; changed.decision_history.push(recompute(copied)); validateCandidate(changed); });
mutation("duplicate_replay", () => { const changed = clone(candidate); const copied = clone(changed.decision_history[0]); copied.decision_id = "DEC-CANDIDATE-REPLAY"; copied.sequence = 2; copied.predecessor_record_sha256 = changed.decision_history[0].record_sha256; changed.decision_history.splice(2, 1, recompute(copied)); validateCandidate(changed); });
mutation("idempotent_replay", () => { const changed = clone(candidate); changed.decision_history.push(clone(changed.decision_history[0])); validateCandidate(changed); });
mutation("predecessor", () => { const changed = clone(candidate); changed.decision_history[2].predecessor_record_sha256 = "0".repeat(64); recompute(changed.decision_history[2]); validateCandidate(changed); });
mutation("cross_family", () => { const changed = clone(candidate); const gate = changed.decision_history[1]; gate.sequence_namespace_id = "candidate-stage-namespace"; recompute(gate); validateCandidate(changed); });
mutation("unknown_attestation", () => { const changed = clone(candidate); changed.decision_history[0].package_attestation_id = "ATT-UNKNOWN-001"; validateCandidate(changed); });
mutation("mismatched_attestation_set", () => { const changed = clone(candidate); changed.decision_history[0].evidence_set_sha256 = changed.successor_evidence_set.evidence_set_sha256; validateCandidate(changed); });
mutation("duplicate_record_id", () => { const changed = clone(candidate); const copied = clone(changed.decision_history[0]); copied.sequence = 2; copied.predecessor_record_sha256 = changed.decision_history[0].record_sha256; copied.idempotency_key = "candidate-stage-duplicate-id"; changed.decision_history.splice(2, 0, recompute(copied)); validateCandidate(changed); });
mutation("duplicate_record_digest", () => { const changed = clone(candidate); const copied = clone(changed.decision_history[0]); copied.decision_id = "DEC-CANDIDATE-DUPLICATE-DIGEST"; changed.decision_history.push(copied); validateCandidate(changed); });
mutation("terminal_after_invalidation", () => { const changed = clone(candidate); const prior = changed.decision_history[2]; const record = { ...clone(prior), decision_id: "DEC-CANDIDATE-003", sequence: 3, predecessor_record_sha256: prior.record_sha256, idempotency_key: "candidate-stage-3", package_attestation_id: changed.attestation.package_attestation_id, evidence_set_sha256: changed.evidence_set.evidence_set_sha256, decided_at_utc: "2026-08-08T00:04:00.000Z" }; changed.decision_history.push(recompute(record)); validateCandidate(changed); });
mutation("invalidation_authorizer", () => { const changed = clone(candidate); changed.invalidation.authorizer_principal_id = "other-principal"; recompute(changed.invalidation); validateCandidate(changed); });
mutation("supersession_authorizer", () => { const changed = clone(candidate); changed.supersession.authorizer_principal_id = "other-principal"; recompute(changed.supersession); validateCandidate(changed); });
mutation("stale_close", () => { const changed = clone(candidate); appendGateClose(changed, { attestation: changed.attestation, evidence_set: changed.evidence_set }, "2026-08-08T00:00:30.000Z"); validateCandidate(changed); });
mutation("successor_close", () => { const changed = clone(candidate); appendGateClose(changed, { attestation: changed.successor_attestation, evidence_set: changed.successor_evidence_set }, "2026-08-08T00:04:00.000Z"); validateCandidate(changed); });
mutation("temporal_authorization_use", () => { const changed = clone(candidate); changed.locator_registration.registered_at_utc = "2026-08-07T23:59:59.000Z"; changed.locator_registration.registration_digest_sha256 = domainDigest("custodial.v43.private-locator-registration.v1", without(changed.locator_registration, "registration_digest_sha256")); validateCandidate(changed); });
mutation("temporal_set_attestation", () => { const changed = clone(candidate); changed.authorization_decision.decided_at_utc = "2026-08-07T23:59:58.000Z"; changed.attestation.issued_at_utc = "2026-08-07T23:59:59.000Z"; recomputeAttestation(changed.attestation); validateCandidate(changed); });
mutation("temporal_decision_attestation", () => { const changed = clone(candidate); changed.attestation.issued_at_utc = "2026-08-08T00:00:01.000Z"; recomputeAttestation(changed.attestation); validateCandidate(changed); });
mutation("temporal_invalidation_target", () => { const changed = clone(candidate); const first = changed.decision_history[0]; const second = changed.decision_history[2]; first.decided_at_utc = "2026-08-08T00:00:01.000Z"; recompute(first); second.predecessor_record_sha256 = first.record_sha256; recompute(second); changed.invalidation.target_record_sha256 = first.record_sha256; changed.invalidation.recorded_at_utc = "2026-08-08T00:00:00.000Z"; recompute(changed.invalidation); changed.supersession.superseded_record_sha256 = first.record_sha256; changed.supersession.successor_record_sha256 = second.record_sha256; recompute(changed.supersession); validateCandidate(changed); });
mutation("temporal_supersession_successor", () => { const changed = clone(candidate); changed.supersession.recorded_at_utc = "2026-08-08T00:00:00.000Z"; recompute(changed.supersession); validateCandidate(changed); });
mutation("temporal_sequence_regression", () => { const changed = clone(candidate); const first = changed.decision_history[0]; const second = changed.decision_history[2]; first.decided_at_utc = "2026-08-08T00:01:10.000Z"; recompute(first); second.predecessor_record_sha256 = first.record_sha256; recompute(second); changed.invalidation.target_record_sha256 = first.record_sha256; recompute(changed.invalidation); changed.supersession.superseded_record_sha256 = first.record_sha256; changed.supersession.successor_record_sha256 = second.record_sha256; recompute(changed.supersession); validateCandidate(changed); });
for (const [index, name] of ["locator_registration", "authorization_chain", "authorization_decision", "evidence_member", "evidence_set", "package_attestation", "sequence_namespace_policy", "namespace_entry", "decision_common", "stage_decision", "gate_decision", "invalidation", "supersession"].entries()) mutation(`parity_${name}`, () => { const changed = clone(contract); if (index % 3 === 0) changed.record_contracts[name].pop(); else if (index % 3 === 1) changed.record_contracts[name].push("unexpected_field"); else changed.record_contracts[name][0] = "renamed_field"; validateContractParity(changed, schema); });
mutation("schema_wrong_type", () => { const changed = clone(candidate.locator_registration); changed.registered_at_utc = 7; validateDraft(changed, schema.$defs.candidate_locator_registration, schema); });
mutation("schema_bad_pattern", () => { const changed = clone(candidate.locator_registration); changed.registration_digest_sha256 = "bad"; validateDraft(changed, schema.$defs.candidate_locator_registration, schema); });
mutation("schema_unexpected_property", () => { const changed = clone(candidate.locator_registration); changed.unexpected = true; validateDraft(changed, schema.$defs.candidate_locator_registration, schema); });
mutation("schema_missing_required", () => { const changed = clone(candidate.locator_registration); delete changed.locator_kind; validateDraft(changed, schema.$defs.candidate_locator_registration, schema); });
mutation("schema_bad_item", () => { const changed = clone(candidate.evidence_set); changed.ordered_member_ids = [7]; validateDraft(changed, schema.$defs.evidence_set_record, schema); });
mutation("schema_bad_datetime", () => { const changed = clone(candidate.locator_registration); changed.registered_at_utc = "2026-01-00T00:00:00.000Z"; validateDraft(changed, schema.$defs.candidate_locator_registration, schema); });
mutation("schema_unknown_ref", () => validateDraft({}, { $ref: "#/$defs/not_present" }, schema));
mutation("schema_malformed_ref", () => validateDraft({}, { $ref: "not-a-local-ref" }, schema));
ensure(fixtures.failure_cases.length === fixtureCases.size && canonical(observed) === canonical(fixtures.failure_cases), "PEP_FIXTURE_COVERAGE");
console.log(JSON.stringify({ protocol: "CUSTODIAL_V43_PRIVATE_EVIDENCE_PLANE_VALIDATION_RESULT_V3", status: "PASS_UNREGISTERED_NON_ACTIVATABLE", package_members: expectedFiles.length, historical_attestation_fixtures: 1, current_test_fixtures: fixtures.failure_cases.length, fixture_classification_mutations: 1, mutation_failures: observed.length, mutation_categories: counts, recoveries, activation_authorized: false, g_evidence_001_status: "OPEN", all_39_gates_open: true, canonical_private_plane_locator: "MISSING_PRIMARY_EVIDENCE", sequence_namespace_policy: "UNRESOLVED_PRIMARY_EVIDENCE_REQUIRED" }));
