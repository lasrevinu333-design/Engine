#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = "docs/audits/custodial-unified-v4-3-architecture";
const CONTRACT_PATH = `${ROOT}/architecture-foundation-build-contract.json`;
const SCHEMA_PATH = `${ROOT}/architecture-foundation-build-contract.schema.json`;
const MANIFEST_PATH = `${ROOT}/architecture-foundation-manifest.json`;
const FIXTURE_PATH = `${ROOT}/fixtures/invalid-missing-required-output.json`;
const RESULT_PATH = `${ROOT}/validation-result.json`;
const WORKFLOW_PATH = ".github/workflows/custodial-v43-architecture-foundation.yml";
const SOURCE_COMMIT = "569dc25c11723801a212de489dced7da776d5be7";
const TARGET_BRANCH = "agent/custodial-v43-standalone-architecture-remote-20260806";
const INHERITED_GATE_REGISTRY = "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-gate-registry.json";
const INHERITED_VALIDATOR = "tools/validate-custodial-v43-replan.mjs";

const REQUIRED_ROOT_KEYS = [
  "authorization", "foundation_members", "invariants", "phase",
  "protocol", "required_architecture_outputs", "revision", "rollback",
  "source", "status", "target", "validator"
].sort();

const REQUIRED_OUTPUT_IDS = [
  "AO-AUTHORITY-SET",
  "AO-CAP-TRACE",
  "AO-CONTENT-MANIFEST",
  "AO-EXCEPTIONS",
  "AO-GATE-DESIGN-MATRIX",
  "AO-OBJECT-REGISTRY",
  "AO-OCCURRENCE-LOCATION",
  "AO-OFFLINE-ORIGINAL-ACTOR",
  "AO-PRINCIPAL-GRANT-TOOL",
  "AO-PROOF-CATALOG",
  "AO-RECORD-REGISTRY",
  "AO-RETIREMENT",
  "AO-ROLLBACK-RESTORE"
].sort();

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function read(path) {
  if (!existsSync(path)) fail("AF_MEMBER_MISSING", `required path missing: ${path}`);
  return readFileSync(path, "utf8");
}

function json(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    fail("AF_JSON_INVALID", `${path}: ${error.message}`);
  }
}

function exactKeys(value, expected, code) {
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    fail(code, `unexpected keys: ${actual.join(",")}`);
  }
}

function unique(values, code) {
  if (new Set(values).size !== values.length) fail(code, "duplicate identifier");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function rejectMarkers(value) {
  const serialized = JSON.stringify(value);
  if (/(<TBD>|\bTODO\b|\bFIXME\b|CHANGEME|PLACEHOLDER_VALUE)/i.test(serialized)) {
    fail("AF_PLACEHOLDER_REJECTED", "placeholder marker found");
  }
}

function validateContract(contract) {
  exactKeys(contract, REQUIRED_ROOT_KEYS, "AF_ROOT_KEYS_INVALID");
  if (contract.protocol !== "CUSTODIAL_V43_ARCHITECTURE_FOUNDATION_BUILD_CONTRACT_V1") fail("AF_PROTOCOL_INVALID", "contract protocol");
  if (contract.revision !== "v4.3.2" || contract.phase !== "PHASE_1_FOUNDATION" || contract.status !== "FOUNDATION_READY") fail("AF_REVISION_INVALID", "contract revision/state");
  if (contract.source?.repository !== "lasrevinu333-design/Engine" || contract.source?.commit !== SOURCE_COMMIT) fail("AF_SOURCE_IDENTITY_MISMATCH", "source identity");
  if (contract.target?.branch !== TARGET_BRANCH || contract.target?.package_root !== ROOT || contract.target?.workflow_path !== WORKFLOW_PATH) fail("AF_TARGET_IDENTITY_MISMATCH", "target identity");
  const auth = contract.authorization ?? {};
  if (auth.architecture_foundation !== true) fail("AF_AUTHORIZATION_INVALID", "foundation not authorized");
  for (const key of ["architecture_content_approval","schema_design","application_implementation","production_mutation","deployment","apk_or_device_action","pull_request_or_merge"]) {
    if (auth[key] !== false) fail("AF_SCOPE_EXPANSION", `forbidden authorization: ${key}`);
  }
  if (!Array.isArray(contract.invariants) || contract.invariants.length < 9) fail("AF_INVARIANTS_INCOMPLETE", "invariants");
  unique(contract.invariants.map((item) => item.id), "AF_INVARIANT_DUPLICATE");
  if (!Array.isArray(contract.foundation_members) || contract.foundation_members.length !== 9) fail("AF_MEMBER_SET_MISMATCH", "foundation member count");
  unique(contract.foundation_members, "AF_MEMBER_DUPLICATE");
  const outputIds = (contract.required_architecture_outputs ?? []).map((item) => item.id).sort();
  unique(outputIds, "AF_REQUIRED_OUTPUT_DUPLICATE");
  if (JSON.stringify(outputIds) !== JSON.stringify(REQUIRED_OUTPUT_IDS)) fail("AF_REQUIRED_OUTPUT_SET_MISMATCH", "required architecture output set");
  if (contract.required_architecture_outputs.some((item) => item.required !== true)) fail("AF_REQUIRED_OUTPUT_OPTIONAL", "required output made optional");
  if (contract.rollback?.required !== true || contract.rollback?.runtime_state_created !== false) fail("AF_ROLLBACK_INVALID", "rollback boundary");
  rejectMarkers(contract);
}

const contract = json(CONTRACT_PATH);
const schema = json(SCHEMA_PATH);
const manifest = json(MANIFEST_PATH);
const fixture = json(FIXTURE_PATH);

validateContract(contract);

if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema" || schema.additionalProperties !== false) fail("AF_SCHEMA_NOT_STRICT", "root schema");
if (JSON.stringify([...schema.required].sort()) !== JSON.stringify(REQUIRED_ROOT_KEYS)) fail("AF_SCHEMA_REQUIRED_KEYS", "schema required keys");
if (schema.properties?.required_architecture_outputs?.minItems !== 13 || schema.properties?.required_architecture_outputs?.maxItems !== 13) fail("AF_SCHEMA_OUTPUT_BOUNDS", "schema output bounds");

const inheritedGateRegistry = json(INHERITED_GATE_REGISTRY);
const expectedH05Order = ["G-RESTORE","G-RELEASE-ADMISSION",["G-PHYSICAL-ACCEPTANCE","G-EXACT-RELEASE-RESTORE"],"G-CANARY-ADMISSION"];
if (inheritedGateRegistry.revision !== "v4.3.2" || JSON.stringify(inheritedGateRegistry.h05_release_order?.ordered_stages) !== JSON.stringify(expectedH05Order)) fail("AF_H05_GATE_ORDER_INVALID", "inherited v4.3.2 H05 gate order");
const inheritedValidator = read(INHERITED_VALIDATOR);
if (!inheritedValidator.includes("H05") || !inheritedValidator.includes("G-EXACT-RELEASE-RESTORE")) fail("AF_H05_PROOF_CHAIN_MISSING", "inherited H05 validator");

if (manifest.protocol !== "CUSTODIAL_V43_ARCHITECTURE_FOUNDATION_MANIFEST_V1") fail("AF_MANIFEST_PROTOCOL", "manifest protocol");
if (manifest.source_identity?.commit !== SOURCE_COMMIT || manifest.target_branch !== TARGET_BRANCH) fail("AF_MANIFEST_IDENTITY", "manifest identity");
if (manifest.lifecycle?.architecture_approved !== false || manifest.lifecycle?.implementation_authorized !== false || manifest.lifecycle?.production_authorized !== false) fail("AF_MANIFEST_AUTHORITY", "manifest authority");
const manifestPaths = manifest.members.map((item) => item.path).sort();
unique(manifestPaths, "AF_MANIFEST_MEMBER_DUPLICATE");
if (JSON.stringify(manifestPaths) !== JSON.stringify([...contract.foundation_members].sort())) fail("AF_MANIFEST_MEMBER_SET_MISMATCH", "manifest members");
for (const member of contract.foundation_members) read(member);
if (manifest.immutable_manifest_rules?.stage_authority_external !== true) fail("AF_STAGE_AUTHORITY_INVALID", "stage authority");
for (const excluded of ["own_digest","containing_commit","mutable_lifecycle_state","stage_decisions"]) {
  if (!manifest.immutable_manifest_rules.future_content_manifest_excludes.includes(excluded)) fail("AF_SELF_REFERENCE_GUARD_MISSING", excluded);
}
if (manifest.ci?.permissions !== "contents: read" || manifest.ci?.writes_repository !== false || manifest.ci?.writes_artifacts !== false || manifest.ci?.network_required !== false) fail("AF_CI_BOUNDARY_INVALID", "CI boundary");

if (fixture.protocol !== "CUSTODIAL_V43_ARCHITECTURE_FOUNDATION_NEGATIVE_FIXTURE_V1" || fixture.mutation?.operation !== "remove_required_architecture_output" || fixture.expected?.error_code !== "AF_REQUIRED_OUTPUT_SET_MISMATCH") fail("AF_NEGATIVE_FIXTURE_INVALID", "negative fixture");
const mutated = structuredClone(contract);
mutated.required_architecture_outputs = mutated.required_architecture_outputs.filter((item) => item.id !== fixture.mutation.id);
let negativeCode = null;
try { validateContract(mutated); } catch (error) { negativeCode = error.code; }
if (negativeCode !== fixture.expected.error_code) fail("AF_NEGATIVE_FIXTURE_DID_NOT_FAIL", `received ${negativeCode}`);

const workflow = read(WORKFLOW_PATH);
if (!/permissions:\s*\n\s*contents:\s*read\b/.test(workflow)) fail("AF_WORKFLOW_PERMISSIONS", "workflow must be read-only");
if (/contents:\s*write|pull_request_target|actions\/upload-artifact/.test(workflow)) fail("AF_WORKFLOW_SCOPE_EXPANSION", "workflow write or artifact action");
if (!workflow.includes("validate-architecture-foundation.mjs --check")) fail("AF_WORKFLOW_VALIDATOR_MISSING", "workflow validator");

const hashMembers = contract.foundation_members.filter((member) => member !== RESULT_PATH).sort();
const hashes = Object.fromEntries(hashMembers.map((member) => [member, sha256(member)]));
const expectedResult = {
  protocol: "CUSTODIAL_V43_ARCHITECTURE_FOUNDATION_VALIDATION_RESULT_V1",
  status: "PASS",
  revision: "v4.3.2",
  phase: "PHASE_1_FOUNDATION",
  source_commit: SOURCE_COMMIT,
  target_branch: TARGET_BRANCH,
  checks: [
    "exact_contract_keys",
    "source_and_target_identity",
    "authorization_boundary",
    "strict_schema",
    "inherited_v432_h05_gate_order",
    "foundation_member_closure",
    "required_architecture_output_closure",
    "immutable_manifest_self_reference_guard",
    "read_only_ci_boundary",
    "negative_fixture_rejected",
    "member_sha256"
  ],
  negative_fixture: { expected_error_code: fixture.expected.error_code, observed_error_code: negativeCode },
  member_sha256: hashes
};

const mode = process.argv[2] ?? "--check";
if (mode === "--write") {
  writeFileSync(RESULT_PATH, JSON.stringify(expectedResult, null, 2) + "\n");
} else if (mode === "--check") {
  const actualResult = json(RESULT_PATH);
  if (JSON.stringify(actualResult) !== JSON.stringify(expectedResult)) fail("AF_VALIDATION_RESULT_STALE", "validation receipt does not match branch members");
} else {
  fail("AF_ARGUMENT_INVALID", "expected --check or --write");
}

console.log(JSON.stringify({status:"PASS",checks:expectedResult.checks.length,members:contract.foundation_members.length,required_outputs:REQUIRED_OUTPUT_IDS.length,negative_fixture:negativeCode}));
