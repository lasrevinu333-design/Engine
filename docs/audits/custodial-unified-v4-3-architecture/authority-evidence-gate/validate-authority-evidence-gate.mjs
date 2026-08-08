#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, "../../../..");
const args = process.argv.slice(2);
const CHILD_TIMEOUT_MS = 30_000;
const CHILD_MAX_BUFFER = 64 * 1024 * 1024;
const expectedPackageFiles = ["README.md", "command-receipts.json", "evidence-ledger.json", "package-manifest.json", "validate-authority-evidence-gate.mjs"];
const membershipMutationPath = path.join(ROOT, ".membership-extra-directory");

if (args.length !== 1 || args[0] !== "--check") {
  throw new Error("USAGE: node validate-authority-evidence-gate.mjs --check");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPO, relativePath), "utf8"));
}

function sha256File(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(REPO, relativePath))).digest("hex");
}

function git(...gitArgs) {
  const result = spawnSync("git", gitArgs, { cwd: REPO, encoding: "utf8", timeout: CHILD_TIMEOUT_MS, maxBuffer: CHILD_MAX_BUFFER });
  if (result.error || result.status !== 0) {
    throw new Error(`GIT_${gitArgs[0]}: ${(result.stderr || result.error?.message || "unknown failure").trim()}`);
  }
  return result.stdout;
}

function assertNoSymlinkComponents(target) {
  const relative = path.relative(REPO, target);
  assert.ok(relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative), "PACKAGE_PATH_SCOPE");
  let cursor = REPO;
  for (const component of relative.split(path.sep)) {
    cursor = path.join(cursor, component);
    assert.equal(fs.lstatSync(cursor).isSymbolicLink(), false, "PACKAGE_SYMLINK_FORBIDDEN");
  }
}

function validatePackageMembership() {
  assertNoSymlinkComponents(ROOT);
  const entries = fs.readdirSync(ROOT).sort();
  assert.deepEqual(entries, expectedPackageFiles, "PACKAGE_MEMBERSHIP_EXACT");
  for (const name of expectedPackageFiles) {
    const target = path.join(ROOT, name);
    assertNoSymlinkComponents(target);
    assert.equal(fs.lstatSync(target).isFile(), true, "PACKAGE_MEMBER_REGULAR_FILE");
  }
}

function requireHex(value, length, code) {
  assert.match(value, new RegExp(`^[0-9a-f]{${length}}$`), code);
}

function strictObject(value, fields, code) {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${code}_TYPE`);
  assert.deepEqual(Object.keys(value).sort(), [...fields].sort(), `${code}_FIELDS`);
}

function validateModel(model) {
  assert.equal(model.protocol, "CUSTODIAL_V43_ROOT_AUTHORITY_EVIDENCE_LEDGER_V1", "MODEL_PROTOCOL");
  assert.equal(model.status, "PASS_EVIDENCE_PACKET_ONLY", "MODEL_STATUS");
  assert.equal(model.audit_base_head, "24c2f877fb86ee027e8acdab27316f1dba05bfe2", "MODEL_CURRENT_EXECUTION_BASE");
  assert.equal(model.historical_clean_baseline_head, "a606982b141d0aea8782b73260a09174f3539945", "MODEL_HISTORICAL_TASK_BASE");
  assert.equal(model.branch, "agent/custodial-v43-current-trace-reverse-registry-20260808", "MODEL_CURRENT_BRANCH");
  assert.equal(model.receipts.build_sha256, null, "MODEL_BUILD_RECEIPT_NULL");
  assert.equal(model.receipts.build_receipt_status, "PRE_COMMIT_NONFINAL", "MODEL_BUILD_RECEIPT_STATUS");
  assert.deepEqual(model.foundation_binding, {
    classification: "CURRENT_FOUNDATION_INPUT",
    commit: "24c2f877fb86ee027e8acdab27316f1dba05bfe2",
    tree: "d80787f826ee570da825baf10829c1785e0311e2",
    content_manifest_sha256: "d66bcc4b2d0a8a21067d9eb235c33f53b091ac733a3b60c6ebc1d4b4f5d36e58",
    activation_authorized: false,
    closure_ready: false
  }, "MODEL_FOUNDATION_BINDING");
  assert.equal(model.authority.activation_authorized, false, "MODEL_FALSE_ACTIVATION");
  assert.equal(model.authority.canonical_gate_decisions_authored, false, "MODEL_NO_GATE_AUTHORING");
  for (const [name, value] of Object.entries(model.authority)) {
    if (name.endsWith("_authorized")) assert.equal(value, false, `MODEL_AUTHORITY_${name}`);
  }

  assert.equal(model.evidence_planes.canonical_registered_private_plane.locator_status, "MISSING_NORMATIVE_LOCATOR", "MODEL_PRIVATE_LOCATOR");
  assert.equal(model.evidence_planes.canonical_registered_private_plane.locator, null, "MODEL_PRIVATE_LOCATOR_NULL");
  assert.equal(model.evidence_planes.canonical_registered_private_plane.global_absence_proven, false, "MODEL_NO_GLOBAL_ABSENCE");
  assert.equal(model.evidence_planes.inspected_archive_candidate.admissibility, "UNREGISTERED_CANDIDATE_ONLY", "MODEL_CANDIDATE_NOT_CANONICAL");
  assert.equal(model.evidence_planes.inspected_archive_candidate.package_attestation, "ABSENT", "MODEL_ATTESTATION_ABSENT");
  for (const event of ["CLOSE", "REOPEN", "INVALIDATE", "SUPERSEDE"]) {
    assert.deepEqual(model.evidence_planes.inspected_archive_candidate.gate_events[event], [], `MODEL_NO_${event}`);
  }

  assert.equal(model.gmail.raw_mailbox_identifiers_published, false, "MODEL_MAILBOX_PRIVACY");
  assert.equal(model.gmail.notification_tokens_published, false, "MODEL_MAIL_TOKEN_PRIVACY");
  for (const message of model.gmail.messages) {
    assert.equal(Object.hasOwn(message, "message_id"), false, "MODEL_RAW_MESSAGE_ID");
    assert.equal(Object.hasOwn(message, "thread_id"), false, "MODEL_RAW_THREAD_ID");
    requireHex(message.message_id_sha256, 64, "MODEL_MESSAGE_DIGEST");
    requireHex(message.thread_id_sha256, 64, "MODEL_THREAD_DIGEST");
    assert.deepEqual(message.labels, ["INBOX", "UNREAD"], "MODEL_MAIL_LABELS");
    assert.equal(message.unread, true, "MODEL_MAIL_UNREAD");
    assert.equal(message.disposition, "RETAINED_UNMODIFIED", "MODEL_MAIL_DISPOSITION");
  }

  assert.equal(model.github.pr_135.state, "OPEN", "MODEL_PR135_OPEN");
  assert.equal(model.github.pr_135.draft, true, "MODEL_PR135_DRAFT");
  assert.equal(model.github.pr_135.binding_to_audit_head, false, "MODEL_PR135_NOT_BINDING");
  assert.equal(model.github.pr_135.checks.length, 9, "MODEL_PR135_CHECK_COUNT");
  assert.equal(new Set(model.github.pr_135.checks).size, 9, "MODEL_PR135_CHECK_UNIQUE");
  assert.equal(model.github.historic_failures.length, 2, "MODEL_GITHUB_FAILURE_RUNS");
  assert.deepEqual(model.github.historic_failures.map((entry) => entry.run_id), model.gmail.messages.map((entry) => entry.run_id), "MODEL_GITHUB_GMAIL_RUN_ALIGNMENT");
  for (const run of model.github.historic_failures) {
    assert.equal(run.head, model.gmail.messages.find((entry) => entry.run_id === run.run_id).head, `MODEL_RUN_HEAD_${run.run_id}`);
    assert.equal(run.conclusion, "failure", `MODEL_RUN_FAILURE_${run.run_id}`);
    assert.equal(run.root_cause, "PINNED_PLAYWRIGHT_INSTALL_COUNT_MISMATCH", `MODEL_RUN_CAUSE_${run.run_id}`);
    assert.equal(run.actual, 0, `MODEL_RUN_ACTUAL_${run.run_id}`);
    assert.equal(run.expected, 1, `MODEL_RUN_EXPECTED_${run.run_id}`);
    assert.equal(run.job_ids.length, 4, `MODEL_RUN_JOBS_${run.run_id}`);
  }

  assert.equal(model.phase2_stage_decision_governance.explicit_binding_to_canonical_stage_model, false, "MODEL_STAGE_UNBOUND");
  assert.equal(model.phase2_stage_decision_governance.actual_canonical_schema, "NOT_FOUND", "MODEL_STAGE_SCHEMA_ABSENT");
  assert.equal(model.phase2_stage_decision_governance.canonical_authority, false, "MODEL_STAGE_NOT_AUTHORITY");
  assert.equal(model.trace_audit.global_absence_proven, false, "MODEL_TRACE_NO_GLOBAL_ABSENCE");
  assert.equal(model.trace_audit.historical_candidate.admissible, false, "MODEL_HISTORICAL_TRACE_NOT_ADMISSIBLE");
  assert.equal(model.earliest_invariant.system_wide_status, "INDETERMINATE_MISSING_CANONICAL_PRIVATE_LOCATOR", "MODEL_EARLIEST_SYSTEM_UNKNOWN");
  assert.equal(model.earliest_invariant.system_wide_commit, null, "MODEL_NO_SYSTEM_COMMIT");
  assert.deepEqual(model.earliest_invariant.evaluated_surfaces.map((entry) => entry.commit), [
    "be01c7b382da14e0e98375ee7a03e88c26ee598c",
    "30130b62c29ba017128ae0a88bf3d98f75b64b20",
    "1c306bcaedaef2dcc456e14116709709d7a894af",
    "6cb27912e0fd79533ee6c92cba2632806cfc306a",
    "503db26d5a6f0a24deb229cc573b287963cc0356",
    "8a809ca1ce9b2e94c127329c9c0b6aedd12c2697",
    "26a996fddf70aabff6ab2a526a16425526137e3b",
    "a606982b141d0aea8782b73260a09174f3539945",
    "24c2f877fb86ee027e8acdab27316f1dba05bfe2",
    "6541f7a2e35c0ba182d0d5e7a6500dda9e076ab5"
  ], "MODEL_EARLIEST_SURFACE_COVERAGE");
  assert.equal(model.evidence_planes.inspected_archive_candidate.current_head, model.earliest_invariant.evaluated_surfaces.at(-1).commit, "MODEL_ARCHIVE_HEAD_ALIGNMENT");
  assert.equal(model.evidence_planes.inspected_archive_candidate.package_history.length, 4, "MODEL_ARCHIVE_HISTORY_COUNT");

  assert.deepEqual(model.root_gate_evidence.map((entry) => entry.gate_id), ["G-EVIDENCE-001", "G-TRACE-001"], "MODEL_ROOT_GATE_ORDER");
  for (const gate of model.root_gate_evidence) {
    assert.equal(gate.status, "OPEN", `MODEL_${gate.gate_id}_OPEN`);
    assert.equal(gate.closure_evidence_ready, false, `MODEL_${gate.gate_id}_NOT_READY`);
    assert.ok(gate.missing.length > 0, `MODEL_${gate.gate_id}_MISSING_EVIDENCE`);
  }
}

const evidencePath = "docs/audits/custodial-unified-v4-3-architecture/authority-evidence-gate/evidence-ledger.json";
const receiptsPath = "docs/audits/custodial-unified-v4-3-architecture/authority-evidence-gate/command-receipts.json";
const manifestPath = "docs/audits/custodial-unified-v4-3-architecture/authority-evidence-gate/package-manifest.json";
const evidence = readJson(evidencePath);
const receipts = readJson(receiptsPath);
const manifest = readJson(manifestPath);

validateModel(evidence);
assert.equal(receipts.protocol, "CUSTODIAL_V43_AUTHORITY_EVIDENCE_COMMAND_RECEIPTS_V1", "RECEIPT_PROTOCOL");
assert.equal(receipts.audit_base_head, evidence.audit_base_head, "RECEIPT_BASE_BINDING");
function validateExecutionBase(model, commandReceipts) {
  assert.equal(model.audit_base_head, model.foundation_binding.commit, "CURRENT_BASE_FOUNDATION_PARITY");
  assert.equal(commandReceipts.audit_base_head, model.audit_base_head, "CURRENT_RECEIPT_BASE_PARITY");
  assert.notEqual(model.historical_clean_baseline_head, model.audit_base_head, "HISTORICAL_BASE_NOT_CURRENT");
}
validateExecutionBase(evidence, receipts);
const staleBaseReceipts = structuredClone(receipts); staleBaseReceipts.audit_base_head = evidence.historical_clean_baseline_head;
assert.throws(() => validateExecutionBase(evidence, staleBaseReceipts), /CURRENT_RECEIPT_BASE_PARITY/);
validateExecutionBase(evidence, receipts);

const head = git("rev-parse", "HEAD").trim();
requireHex(head, 40, "HEAD_SHA");
const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", evidence.audit_base_head, head], { cwd: REPO, timeout: CHILD_TIMEOUT_MS, maxBuffer: CHILD_MAX_BUFFER });
assert.equal(ancestor.status, 0, "AUDIT_BASE_NOT_ANCESTOR");
const foundationAncestor = spawnSync("git", ["merge-base", "--is-ancestor", evidence.foundation_binding.commit, head], { cwd: REPO, timeout: CHILD_TIMEOUT_MS, maxBuffer: CHILD_MAX_BUFFER });
assert.equal(foundationAncestor.status, 0, "FOUNDATION_BINDING_NOT_ANCESTOR");
assert.equal(git("rev-parse", `${evidence.foundation_binding.commit}^{tree}`).trim(), evidence.foundation_binding.tree, "FOUNDATION_TREE_BINDING");

for (const binding of [...evidence.input_bindings, ...evidence.protected_files]) {
  assert.equal(sha256File(binding.path), binding.sha256, `INPUT_DIGEST_${binding.path}`);
}

validatePackageMembership();
let packageMembershipMutationFailures = 0;
let packageMembershipRecoveries = 0;
assert.equal(fs.existsSync(membershipMutationPath), false, "PACKAGE_MEMBERSHIP_TEST_RESIDUE_PREEXISTING");
fs.mkdirSync(membershipMutationPath);
try {
  assert.throws(() => validatePackageMembership(), /PACKAGE_MEMBERSHIP_EXACT/);
  packageMembershipMutationFailures += 1;
} finally {
  if (fs.existsSync(membershipMutationPath)) fs.rmdirSync(membershipMutationPath);
}
assert.equal(fs.existsSync(membershipMutationPath), false, "PACKAGE_MEMBERSHIP_TEST_RESIDUE");
validatePackageMembership();
packageMembershipRecoveries += 1;
const expectedManifestMembers = expectedPackageFiles.filter((name) => name !== "package-manifest.json").sort();
function validatePackageManifest(candidate) {
  strictObject(candidate, ["members", "protocol", "self_digest_excluded"], "MANIFEST");
  assert.equal(candidate.protocol, "CUSTODIAL_V43_AUTHORITY_EVIDENCE_PACKAGE_MANIFEST_V1", "MANIFEST_PROTOCOL");
  assert.equal(candidate.self_digest_excluded, true, "MANIFEST_SELF_EXCLUDED");
  strictObject(candidate.members, expectedManifestMembers, "MANIFEST_MEMBERS");
  assert.deepEqual(Object.keys(candidate.members).sort(), expectedManifestMembers, "MANIFEST_MEMBERS");
  for (const [name, digest] of Object.entries(candidate.members)) {
    requireHex(digest, 64, `MANIFEST_DIGEST_FORMAT_${name}`);
    assert.equal(sha256File(path.posix.join(path.posix.dirname(manifestPath), name)), digest, `MANIFEST_DIGEST_${name}`);
  }
}
validatePackageManifest(manifest);
const tamperedManifest = structuredClone(manifest);
tamperedManifest.members["README.md"] = "0".repeat(64);
assert.throws(() => validatePackageManifest(tamperedManifest));
validatePackageManifest(manifest);
const manifestSemanticMutations = [
  ["dangerous_extra_activation_field", /MANIFEST_FIELDS/, (candidate) => { candidate.activation_authorized = true; }],
  ["dangerous_extra_closure_field", /MANIFEST_FIELDS/, (candidate) => { candidate.architecture_closure = true; }],
  ["wrong_self_digest_type", /MANIFEST_SELF_EXCLUDED/, (candidate) => { candidate.self_digest_excluded = "true"; }],
  ["unexpected_member", /MANIFEST_MEMBERS_FIELDS/, (candidate) => { candidate.members["activation-authorized.json"] = "0".repeat(64); }],
];
let manifestSemanticMutationFailures = 0;
let manifestSemanticRecoveries = 0;
for (const [, expected, mutate] of manifestSemanticMutations) {
  const candidate = structuredClone(manifest);
  mutate(candidate);
  assert.throws(() => validatePackageManifest(candidate), expected);
  manifestSemanticMutationFailures += 1;
  validatePackageManifest(manifest);
  manifestSemanticRecoveries += 1;
}

const gateRegistry = readJson("docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-gate-registry.json");
assert.equal(gateRegistry.gates.length, 39, "GATE_COUNT");
assert.deepEqual(gateRegistry.gates.map((gate) => gate.gate_id), evidence.open_gate_inventory, "OPEN_GATE_INVENTORY_EXACT");
assert.ok(gateRegistry.gates.every((gate) => gate.status === "OPEN"), "ALL_GATES_OPEN");
const evidenceGate = gateRegistry.gates.find((gate) => gate.gate_id === "G-EVIDENCE-001");
const traceGate = gateRegistry.gates.find((gate) => gate.gate_id === "G-TRACE-001");
assert.deepEqual(evidenceGate.prerequisite_gate_ids, [], "EVIDENCE_ROOT");
assert.deepEqual(traceGate.prerequisite_gate_ids, ["G-EVIDENCE-001"], "TRACE_DEPENDS_ON_EVIDENCE");

const stageModel = readJson("docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-stage-control-model.json");
const stageDecisionPaths = evidence.phase2_stage_decision_governance.protocol_occurrence_paths;
assert.equal(stageModel.mutable_records_location, "registered private evidence plane outside immutable content commits", "STAGE_PRIVATE_PLANE_RULE");
assert.deepEqual(stageModel.record_schema.required, evidence.phase2_stage_decision_governance.canonical_stage_required_fields, "STAGE_REQUIRED_FIELDS_EXACT");
assert.equal(JSON.stringify(stageModel).includes(evidence.phase2_stage_decision_governance.protocol), false, "STAGE_PROTOCOL_NOT_BOUND");
const phase2Decisions = stageDecisionPaths.map((entry) => readJson(entry));
assert.equal(phase2Decisions.length, 2, "PHASE2_DECISION_COUNT");
assert.deepEqual(phase2Decisions[0], phase2Decisions[1], "PHASE2_DECISION_PROJECTIONS_IDENTICAL");
for (const decision of phase2Decisions) {
  assert.equal(decision.protocol, evidence.phase2_stage_decision_governance.protocol, "PHASE2_PROTOCOL");
  const missing = stageModel.record_schema.required.filter((field) => !Object.hasOwn(decision, field));
  assert.deepEqual(missing, evidence.phase2_stage_decision_governance.missing_required_fields, "PHASE2_STAGE_FIELDS_MISSING");
}

const currentTracePath = path.join(REPO, "docs/audits/custodial-unified-v4-3/custodial-unified-whole-system-capability-joined-trace-v3.md");
assert.equal(fs.existsSync(currentTracePath), false, "CURRENT_V43_JOINED_TRACE_MUST_NOT_BE_CLAIMED");
const historical = evidence.trace_audit.historical_candidate;
const historicalTrace = git("show", `${historical.commit}:${historical.path}`);
const capRows = historicalTrace.split("\n").filter((line) => /^\| CAP-\d{3} \|/.test(line));
const capIds = capRows.map((line) => line.split("|")[1].trim());
assert.equal(capRows.length, historical.cap_rows, "HISTORICAL_CAP_ROW_COUNT");
assert.equal(new Set(capIds).size, historical.unique_cap_ids, "HISTORICAL_CAP_UNIQUE");
assert.equal(/^## .*reverse/im.test(historicalTrace), historical.reverse_registry_section_present, "HISTORICAL_REVERSE_SECTION");
const recordTypes = capRows.map((line) => line.split("|")[7].trim());
assert.equal(new Set(recordTypes).size, historical.synthetic_record_types, "HISTORICAL_SYNTHETIC_RECORD_TYPES");
const recordRegistry = git("show", `${historical.commit}:docs/audits/custodial-unified-v4-3/custodial-unified-whole-system-record-type-registry-v1.md`);
const resolvingTypes = recordTypes.filter((type) => recordRegistry.includes(`\`${type}\``));
assert.equal(resolvingTypes.length, historical.record_types_resolving_in_record_registry, "HISTORICAL_RECORD_TYPE_RESOLUTION");
const historicalAncestor = spawnSync("git", ["merge-base", "--is-ancestor", historical.commit, evidence.audit_base_head], { cwd: REPO, timeout: CHILD_TIMEOUT_MS, maxBuffer: CHILD_MAX_BUFFER });
assert.equal(historicalAncestor.status === 0, historical.ancestor_of_audit_head, "HISTORICAL_ANCESTRY");

const receiptById = new Map(receipts.checks.map((entry) => [entry.id, entry]));
for (const id of ["H05", "CONTENT_MANIFEST_GENERATOR_CHECK", "CONTENT_MANIFEST_GENERATOR_SELF_TEST", "ARCHITECTURE_PROJECTIONS", "PHASE1_FOUNDATION", "RECORD_ENVELOPE_CURRENT_STAGE_GUARD", "RECORD_ENVELOPE_HISTORICAL_ACCEPTED", "RECORD_ENVELOPE_ADVERSARIAL_CURRENT", "PHASE2_OPERATIONAL", "PHASE2_REVIEW", "AUTHORITY_GENERATOR_DIRECT", "AUTHORITY_VALIDATOR_DIRECT"]) {
  assert.ok(receiptById.has(id), `RECEIPT_REQUIRED_${id}`);
}
function validateReceiptTruth(candidate) {
  const byId = new Map(candidate.checks.map((entry) => [entry.id, entry]));
  const check = byId.get("CONTENT_MANIFEST_GENERATOR_CHECK"), selfTest = byId.get("CONTENT_MANIFEST_GENERATOR_SELF_TEST");
  assert.deepEqual(Object.keys(check).sort(), ["command", "exit_status", "id", "stable_result", "status"], "RECEIPT_CHECK_FIELDS");
  assert.deepEqual(Object.keys(selfTest).sort(), ["command", "exit_status", "id", "stable_result", "status"], "RECEIPT_SELF_TEST_FIELDS");
  assert.equal(check.command, "node tools/generate-v43-content-manifest.mjs --check", "RECEIPT_CHECK_COMMAND");
  assert.equal(selfTest.command, "node tools/generate-v43-content-manifest.mjs --self-test", "RECEIPT_SELF_TEST_COMMAND");
  assert.equal(byId.get("H05").stable_result.checks_total, 110, "RECEIPT_H05_COUNT");
  assert.equal(byId.get("AUTHORITY_GENERATOR_DIRECT").stable_result.restart_recovery_test, "NOT_RUN", "RECEIPT_AUTHORITY_CHECK_MODE");
  assert.equal(byId.get("AUTHORITY_VALIDATOR_DIRECT").stable_result.generator_restart_self_test, "PASS", "RECEIPT_AUTHORITY_RESTART_WIRING");
  const specifications = [
    [check, ["tools/generate-v43-content-manifest.mjs", "--check"]],
    [selfTest, ["tools/generate-v43-content-manifest.mjs", "--self-test"]]
  ];
  for (const [receipt, command] of specifications) {
    const executed = spawnSync(process.execPath, command, { cwd: REPO, encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 });
    assert.equal(executed.status, receipt.exit_status, `RECEIPT_EXECUTED_STATUS_${receipt.id}`);
    assert.equal(executed.signal, null, `RECEIPT_EXECUTED_SIGNAL_${receipt.id}`);
    assert.equal(executed.stderr, "", `RECEIPT_EXECUTED_STDERR_${receipt.id}`);
    const actual = JSON.parse(executed.stdout);
    assert.equal(receipt.status, actual.status, `RECEIPT_RECORDED_STATUS_${receipt.id}`);
    assert.deepEqual(receipt.stable_result, actual, `RECEIPT_EXECUTED_RESULT_${receipt.id}`);
  }
}
validateReceiptTruth(receipts);
const receiptMutations = [
  (candidate) => { candidate.checks.find((entry) => entry.id === "CONTENT_MANIFEST_GENERATOR_CHECK").stable_result.extra = true; },
  (candidate) => { candidate.checks.find((entry) => entry.id === "CONTENT_MANIFEST_GENERATOR_SELF_TEST").stable_result.self_tests = 10; },
  (candidate) => { const check = candidate.checks.find((entry) => entry.id === "CONTENT_MANIFEST_GENERATOR_CHECK"), selfTest = candidate.checks.find((entry) => entry.id === "CONTENT_MANIFEST_GENERATOR_SELF_TEST"); [check.stable_result, selfTest.stable_result] = [selfTest.stable_result, check.stable_result]; },
  (candidate) => { candidate.checks.find((entry) => entry.id === "CONTENT_MANIFEST_GENERATOR_CHECK").command = "node tools/generate-v43-content-manifest.mjs --self-test"; }
];
for (const mutate of receiptMutations) {
  const candidate = structuredClone(receipts); mutate(candidate);
  assert.throws(() => validateReceiptTruth(candidate));
  validateReceiptTruth(receipts);
}
assert.equal(receiptById.get("RECORD_ENVELOPE_CURRENT_STAGE_GUARD").stable_result.data_failure, false, "RECORD_GUARD_NOT_DATA_FAILURE");
assert.equal(receiptById.get("AUTHORITY_VALIDATOR_DIRECT").stable_result.activation_authorized, false, "AUTHORITY_RECEIPT_NOT_ACTIVATABLE");

const mutations = [
  (value) => { value.authority.activation_authorized = true; },
  (value) => { value.root_gate_evidence[0].status = "CLOSED"; },
  (value) => { value.root_gate_evidence[1].closure_evidence_ready = true; },
  (value) => { value.evidence_planes.canonical_registered_private_plane.locator_status = "RESOLVED"; },
  (value) => { value.evidence_planes.canonical_registered_private_plane.global_absence_proven = true; },
  (value) => { value.evidence_planes.inspected_archive_candidate.admissibility = "CANONICAL"; },
  (value) => { value.evidence_planes.inspected_archive_candidate.gate_events.CLOSE.push({ gate_id: "G-EVIDENCE-001" }); },
  (value) => { value.gmail.raw_mailbox_identifiers_published = true; },
  (value) => { value.gmail.messages[0].message_id = "forbidden"; },
  (value) => { value.phase2_stage_decision_governance.canonical_authority = true; },
  (value) => { value.trace_audit.global_absence_proven = true; },
  (value) => { value.earliest_invariant.system_wide_status = "PROVEN"; },
  (value) => { value.github.pr_135.checks.pop(); },
  (value) => { value.earliest_invariant.evaluated_surfaces.pop(); }
];

let mutationFailures = 0;
let recoveries = 0;
for (const mutate of mutations) {
  const candidate = structuredClone(evidence);
  mutate(candidate);
  assert.throws(() => validateModel(candidate));
  mutationFailures += 1;
  validateModel(structuredClone(evidence));
  recoveries += 1;
}

console.log(JSON.stringify({
  protocol: "CUSTODIAL_V43_ROOT_AUTHORITY_EVIDENCE_VALIDATION_RESULT_V1",
  status: "PASS_EVIDENCE_PACKET_ONLY",
  head,
  open_gates: gateRegistry.gates.length,
  root_gates: ["G-EVIDENCE-001", "G-TRACE-001"],
  package_members: expectedPackageFiles.length,
  package_membership_mutation_failures: packageMembershipMutationFailures,
  package_membership_recoveries: packageMembershipRecoveries,
  package_manifest_semantic_mutation_failures: manifestSemanticMutationFailures,
  package_manifest_semantic_recoveries: manifestSemanticRecoveries,
  package_manifest_semantic_mutations: manifestSemanticMutations.map(([name]) => name),
  owned_test_residue: fs.existsSync(membershipMutationPath) ? 1 : 0,
  input_bindings: evidence.input_bindings.length,
  command_receipts: receipts.checks.length,
  historical_cap_rows: capRows.length,
  semantic_mutation_failures: mutationFailures,
  recoveries,
  integrity_mutation_failures: 1,
  integrity_recoveries: 1,
  receipt_truth_mutation_failures: receiptMutations.length,
  receipt_truth_recoveries: receiptMutations.length,
  execution_base_mutation_failures: 1,
  execution_base_recoveries: 1,
  activation_authorized: false,
  earliest_open_gate: "G-EVIDENCE-001",
  canonical_private_plane_locator: "MISSING_NORMATIVE_LOCATOR"
}));
