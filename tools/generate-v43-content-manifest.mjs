#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";

const REPO = process.cwd();
const MANIFEST_REPO_PATH = "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-content-manifest.json";
const MANIFEST_PATH = path.join(REPO, MANIFEST_REPO_PATH);
const MODE = process.argv[2] ?? "--check";
const MODES = new Set(["--check", "--write", "--self-test"]);
if (!MODES.has(MODE) || process.argv.length !== 3) {
  throw new Error("USAGE: node tools/generate-v43-content-manifest.mjs --check|--write|--self-test");
}

const PRIOR_H05_CORRECTION_BASE_COMMIT = "a606982b141d0aea8782b73260a09174f3539945";
const EVIDENCE_ID_CORRECTION_BASE_COMMIT = "f5c5731d68bbc6bf17d3a7d2f9acc5ab4ba3e247";
const GENERATOR_VERSION = "3";
const GENERATOR_PROTOCOL = `CUSTODIAL_V43_CONTENT_MANIFEST_GENERATOR_V${GENERATOR_VERSION}`;
const MEMBER_SPECIFICATIONS = [
  ["V43-CONTENT-01", "contracts/custodial-unified-v4-3-accepted-finding-closure-registry.json", "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-accepted-finding-closure-registry.json", "canonical_json", "canonical", ["G-EVIDENCE-001"], "any blob change"],
  ["V43-CONTENT-02", "contracts/custodial-unified-v4-3-artifact-generation-contract.json", "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-artifact-generation-contract.json", "canonical_json", "canonical", ["G-EVIDENCE-001"], "any blob change"],
  ["V43-CONTENT-03", "contracts/custodial-unified-v4-3-authority-restore-transition-contract.json", "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-authority-restore-transition-contract.json", "canonical_json", "canonical", ["G-EVIDENCE-001"], "any blob change"],
  ["V43-CONTENT-04", "contracts/custodial-unified-v4-3-contract-schemas.json", "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-contract-schemas.json", "canonical_json", "canonical", ["G-EVIDENCE-001"], "any blob change"],
  ["V43-CONTENT-05", "contracts/custodial-unified-v4-3-gate-registry.json", "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-gate-registry.json", "canonical_json", "canonical", ["G-EVIDENCE-001"], "any blob change"],
  ["V43-CONTENT-06", "contracts/custodial-unified-v4-3-occurrence-location-contract.json", "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-occurrence-location-contract.json", "canonical_json", "canonical", ["G-EVIDENCE-001"], "any blob change"],
  ["V43-CONTENT-07", "contracts/custodial-unified-v4-3-operational-domain-contracts.json", "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-operational-domain-contracts.json", "canonical_json", "canonical", ["G-EVIDENCE-001"], "any blob change"],
  ["V43-CONTENT-08", "contracts/custodial-unified-v4-3-security-authority-contract.json", "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-security-authority-contract.json", "canonical_json", "canonical", ["G-EVIDENCE-001"], "any blob change"],
  ["V43-CONTENT-09", "contracts/custodial-unified-v4-3-stage-control-model.json", "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-stage-control-model.json", "canonical_json", "canonical", ["G-EVIDENCE-001"], "any blob change"],
  ["V43-README", "README.md", "docs/audits/custodial-unified-v4-3/README.md", "markdown_projection", "projection", ["G-EVIDENCE-001"], "source contract or metadata change"],
  ["V43-REPLAN", "custodial-unified-whole-system-v4-3-foundational-replan.md", "docs/audits/custodial-unified-v4-3/custodial-unified-whole-system-v4-3-foundational-replan.md", "markdown_projection", "projection", ["G-RELEASE-ADMISSION", "G-PHYSICAL-ACCEPTANCE", "G-EXACT-RELEASE-RESTORE", "G-CANARY-ADMISSION"], "source contract change"],
  ["V43-HANDOFF", "custodial-unified-whole-system-v4-3-replan-audit-and-build-handoff.md", "docs/audits/custodial-unified-v4-3/custodial-unified-whole-system-v4-3-replan-audit-and-build-handoff.md", "markdown_projection", "projection", ["G-RELEASE-ADMISSION", "G-PHYSICAL-ACCEPTANCE", "G-EXACT-RELEASE-RESTORE", "G-CANARY-ADMISSION"], "source contract or audit change"],
  ["V43-SCHEDULE", "custodial-unified-whole-system-v4-3-two-week-canary-acceleration-plan.md", "docs/audits/custodial-unified-v4-3/custodial-unified-whole-system-v4-3-two-week-canary-acceleration-plan.md", "markdown_projection", "projection", ["G-RELEASE-ADMISSION", "G-PHYSICAL-ACCEPTANCE", "G-EXACT-RELEASE-RESTORE", "G-CANARY-ADMISSION"], "gate or release-order change"],
  ["V43-V42-RECONCILIATION", "custodial-unified-whole-system-v4-2-six-report-final-reconciliation.md", "docs/audits/custodial-unified-v4-3/custodial-unified-whole-system-v4-2-six-report-final-reconciliation.md", "frozen_input", "evidence", [], "never mutate; supersede through new evidence"],
  ["V43-VALIDATOR", "tools/validate-custodial-v43-replan.mjs", "tools/validate-custodial-v43-replan.mjs", "deterministic_validator", "validation", ["G-RELEASE-ADMISSION", "G-PHYSICAL-ACCEPTANCE", "G-EXACT-RELEASE-RESTORE", "G-CANARY-ADMISSION"], "any validator or contract change"],
  ["V43-CONTENT-MANIFEST-GENERATOR", "tools/generate-v43-content-manifest.mjs", "tools/generate-v43-content-manifest.mjs", "deterministic_generator", "validation", ["G-EVIDENCE-001", "G-TRACE-LINT"], "any generator or manifest generation rule change"],
  ["V43-QUALITY-GATE-WIRING", "package.json", "package.json", "control_validation_configuration", "validation", ["G-EVIDENCE-001", "G-TRACE-LINT"], "validator command wiring change"],
  ["V43-GATE-DAY-PROJECTION", "contracts/custodial-unified-v4-3-gate-workstream-day-projection.json", "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-gate-workstream-day-projection.json", "generated_json_projection", "projection", ["G-RELEASE-ADMISSION", "G-PHYSICAL-ACCEPTANCE", "G-EXACT-RELEASE-RESTORE", "G-CANARY-ADMISSION"], "gate registry or generation rule change"],
  ["V43-QUALITY-WORKFLOW", ".github/workflows/whole-system-quality-gate.yml", ".github/workflows/whole-system-quality-gate.yml", "control_validation_configuration", "validation", ["G-RELEASE-ADMISSION", "G-PHYSICAL-ACCEPTANCE", "G-EXACT-RELEASE-RESTORE", "G-CANARY-ADMISSION"], "validator execution or exit-propagation change"]
].map(([artifact_id, memberPath, repo_path, type, precedence, dependent_gates, invalidation]) => ({ artifact_id, path: memberPath, repo_path, type, precedence, sensitivity: "private_program", dependent_gates, invalidation }));
const MEMBER_SOURCE_SPECIFICATIONS = [
  ["V43-CONTENT-01", "dag_input", "V43-FINDING-CLOSURE"], ["V43-CONTENT-02", "dag_input", "V43-ARTIFACT-GENERATION"], ["V43-CONTENT-03", "dag_input", "V43-AUTHORITY-RESTORE"], ["V43-CONTENT-04", "dag_input", "V43-CONTRACT-SCHEMAS"], ["V43-CONTENT-05", "dag_input", "V43-GATE-REGISTRY"], ["V43-CONTENT-06", "dag_input", "V43-OCCURRENCE-LOCATION"], ["V43-CONTENT-07", "dag_input", "V43-OPERATIONAL-DOMAINS"], ["V43-CONTENT-08", "dag_input", "V43-SECURITY-AUTHORITY"], ["V43-CONTENT-09", "dag_input", "V43-STAGE-CONTROL"], ["V43-README", "dag_input", "V43-README-PROJECTION"], ["V43-REPLAN", "dag_input", "V43-REPLAN-PROJECTION"], ["V43-HANDOFF", "dag_input", "V43-HANDOFF-PROJECTION"], ["V43-SCHEDULE", "dag_input", "V43-SCHEDULE-PROJECTION"], ["V43-VALIDATOR", "dag_input", "V43-VALIDATOR"], ["V43-GATE-DAY-PROJECTION", "dag_input", "V43-GATE-DAY-PROJECTION"], ["V43-V42-RECONCILIATION", "frozen_evidence", "EVIDENCE-V42"], ["V43-CONTENT-MANIFEST-GENERATOR", "generator_implementation", "V43-CONTENT-MANIFEST.generator"], ["V43-QUALITY-GATE-WIRING", "validation_wiring", "package.json"], ["V43-QUALITY-WORKFLOW", "validation_wiring", ".github/workflows/whole-system-quality-gate.yml"]
].map(([member_artifact_id, source_kind, source_artifact_id]) => ({ member_artifact_id, source_kind, source_artifact_id }));

const strictDecoder = new TextDecoder("utf-8", { fatal: true });
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const gitBlobSha1 = (bytes) => crypto.createHash("sha1").update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex");
const fail = (code, detail = "") => {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  throw error;
};

function validateCanonicalText(bytes, repoPath) {
  let text;
  try {
    text = strictDecoder.decode(bytes);
  } catch {
    fail("E-MANIFEST-UTF8", repoPath);
  }
  if (text.normalize("NFC") !== text) fail("E-MANIFEST-NFC", repoPath);
  if (text.includes("\r")) fail("E-MANIFEST-LF", repoPath);
}

function resolveMember(repoPath, repoRoot = REPO) {
  if (typeof repoPath !== "string" || repoPath.length === 0 || path.isAbsolute(repoPath)) fail("E-MANIFEST-PATH", String(repoPath));
  const normalized = path.posix.normalize(repoPath);
  if (normalized !== repoPath || normalized === ".." || normalized.startsWith("../")) fail("E-MANIFEST-PATH", repoPath);
  const absolute = path.resolve(repoRoot, repoPath);
  const relative = path.relative(repoRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail("E-MANIFEST-PATH", repoPath);
  const parts = repoPath.split("/");
  let cursor = repoRoot;
  for (let index = 0; index < parts.length; index += 1) {
    cursor = path.join(cursor, parts[index]);
    const component = fs.lstatSync(cursor);
    if (component.isSymbolicLink()) fail(index === parts.length - 1 ? "E-MANIFEST-SYMLINK" : "E-MANIFEST-ANCESTOR-SYMLINK", repoPath);
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile()) fail("E-MANIFEST-NONFILE", repoPath);
  return absolute;
}

function validateMemberDefinitions(members) {
  if (!Array.isArray(members) || members.length === 0) fail("E-MANIFEST-MEMBERS");
  const artifactIds = new Set();
  const paths = new Set();
  const repoPaths = new Set();
  for (const member of members) {
    if (!member || typeof member !== "object") fail("E-MANIFEST-MEMBER-SHAPE");
    if (artifactIds.has(member.artifact_id)) fail("E-MANIFEST-DUPLICATE-ARTIFACT", member.artifact_id);
    if (paths.has(member.path)) fail("E-MANIFEST-DUPLICATE-PATH", member.path);
    if (repoPaths.has(member.repo_path)) fail("E-MANIFEST-DUPLICATE-REPO-PATH", member.repo_path);
    artifactIds.add(member.artifact_id);
    paths.add(member.path);
    repoPaths.add(member.repo_path);
    if (member.repo_path === MANIFEST_REPO_PATH || member.path.endsWith("custodial-unified-v4-3-content-manifest.json")) {
      fail("E-MANIFEST-SELF-REFERENCE", member.repo_path);
    }
    if (member.type === "immutable_manifest") fail("E-MANIFEST-SEMANTIC-CIRCULARITY", member.artifact_id);
  }
}

function validateExpectedMembership(members) {
  validateMemberDefinitions(members);
  const identity = (member) => JSON.stringify({ artifact_id: member.artifact_id, path: member.path, repo_path: member.repo_path, type: member.type, precedence: member.precedence, sensitivity: member.sensitivity, dependent_gates: member.dependent_gates, invalidation: member.invalidation });
  const expected = MEMBER_SPECIFICATIONS.map(identity);
  const actual = members.map(identity);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail("E-MANIFEST-MEMBERSHIP-EXACT");
}

function validateArtifactContractDocument(contract) {
  const node = contract.nodes.find((candidate) => candidate.artifact_id === "V43-CONTENT-MANIFEST");
  if (!node || node.generator !== "tools/generate-v43-content-manifest.mjs" || node.order !== 23 || node.kind !== "immutable_manifest") fail("E-MANIFEST-CONTRACT-GENERATOR");
  const contractInputs = new Set(node.inputs);
  const requiredInputs = ["V43-ARTIFACT-GENERATION", "V43-STAGE-CONTROL", "V43-SECURITY-AUTHORITY", "V43-AUTHORITY-RESTORE", "V43-OCCURRENCE-LOCATION", "V43-OPERATIONAL-DOMAINS", "V43-GATE-REGISTRY", "V43-GATE-DAY-PROJECTION", "V43-FINDING-CLOSURE", "V43-CONTRACT-SCHEMAS", "V43-README-PROJECTION", "V43-REPLAN-PROJECTION", "V43-HANDOFF-PROJECTION", "V43-SCHEDULE-PROJECTION", "V43-VALIDATOR"];
  if (contractInputs.size !== requiredInputs.length || requiredInputs.some((input) => !contractInputs.has(input))) fail("E-MANIFEST-CONTRACT-INPUTS");
  const classifications = node.member_source_classification;
  if (!Array.isArray(classifications) || classifications.length !== MEMBER_SPECIFICATIONS.length) fail("E-MANIFEST-SOURCE-CLASSIFICATION-COUNT");
  const byMember = new Map(classifications.map((entry) => [entry.member_artifact_id, entry]));
  if (byMember.size !== MEMBER_SPECIFICATIONS.length || MEMBER_SPECIFICATIONS.some((member) => !byMember.has(member.artifact_id))) fail("E-MANIFEST-SOURCE-CLASSIFICATION-MEMBERS");
  if (JSON.stringify(classifications) !== JSON.stringify(MEMBER_SOURCE_SPECIFICATIONS)) fail("E-MANIFEST-SOURCE-CLASSIFICATION-EXACT");
  const direct = classifications.filter((entry) => entry.source_kind === "dag_input").map((entry) => entry.source_artifact_id);
  if (new Set(direct).size !== node.inputs.length || node.inputs.some((input) => !direct.includes(input))) fail("E-MANIFEST-SOURCE-CLASSIFICATION-DAG-PARITY");
  const supplemental = classifications.filter((entry) => entry.source_kind !== "dag_input");
  const expectedSupplemental = [
    ["V43-V42-RECONCILIATION", "frozen_evidence", "EVIDENCE-V42"],
    ["V43-CONTENT-MANIFEST-GENERATOR", "generator_implementation", "V43-CONTENT-MANIFEST.generator"],
    ["V43-QUALITY-GATE-WIRING", "validation_wiring", "package.json"],
    ["V43-QUALITY-WORKFLOW", "validation_wiring", ".github/workflows/whole-system-quality-gate.yml"]
  ];
  if (JSON.stringify(supplemental.map((entry) => [entry.member_artifact_id, entry.source_kind, entry.source_artifact_id])) !== JSON.stringify(expectedSupplemental)) fail("E-MANIFEST-SOURCE-CLASSIFICATION-SUPPLEMENTAL");
}

function readAndValidateArtifactContract() {
  const contractPath = path.join(REPO, "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-artifact-generation-contract.json");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  validateArtifactContractDocument(contract);
  return contract;
}

function buildExpected() {
  readAndValidateArtifactContract();
  const manifest = {
    schema_version: "v4.3.1",
    artifact_id: "V43-CONTENT-MANIFEST",
    authority: "canonical",
    package_id: "custodial-unified-v4-3-foundation-correction-20260808-002",
    package_root: "docs/audits/custodial-unified-v4-3",
    origin: { repository: "lasrevinu333-design/Engine", working_branch: "agent/custodial-v43-h05-evidence-id-restorative-20260808", foundation_base_commit: EVIDENCE_ID_CORRECTION_BASE_COMMIT },
    prior_freeze: { branch: "audit/custodial-unified-v4-3-replan-correction-final-freeze-20260806", commit: "8b473ff6f31d5be7f5ec4c4fd9a7c84c904cdc8e", mutable: false },
    identity_rule: { self_digest: "forbidden", containing_commit: "detached_attestation_only", member_digest: "every member except this manifest has an explicit Git blob digest; detached attestation adds SHA-256 and exact tree/commit", attestation_location: "registered private evidence plane", stage_authority: "append-only stage records outside immutable content" },
    generator: { id: "tools/generate-v43-content-manifest.mjs", version: GENERATOR_VERSION, specification: "independent constant reconciled to V43-ARTIFACT-GENERATION; output manifest is comparison target only", deterministic_timestamp_policy: "no generated timestamp in semantic manifest", write_protocol: "stage exact bytes, validate all members, atomically replace manifest last" },
    precedence: ["canonical_json", "frozen_input", "markdown_projection", "validation"],
    members: MEMBER_SPECIFICATIONS.map((member) => ({ ...structuredClone(member), content_digest: { algorithm: "git_blob_sha1", value: "0".repeat(40) } })),
    excluded_mutable_evidence: ["package-attestation", "stage-decision-ledger", "validator-run-report", "internal-adversarial-review", "targeted-sol-recheck", "execution-manifest", "SHA256SUMS"],
    invalidation_rule: "any changed member blob creates a new package identity and invalidates all transitive evidence; stale GO cannot be retained",
    revision: "v4.3.4-foundation-correction",
    h05_correction: { command_id: "custodial-v433-foundation-h05-semantic-correction-20260808-001", base_commit: PRIOR_H05_CORRECTION_BASE_COMMIT, changed_member_count: 5, semantic_order: ["G-RESTORE", "G-RELEASE-ADMISSION", ["G-PHYSICAL-ACCEPTANCE", "G-EXACT-RELEASE-RESTORE"], "G-CANARY-ADMISSION"], semantic_invariant: "restore and Build 22 precede release admission; physical acceptance and exact-release restore are sibling post-admission proofs; canary admission requires release admission and both siblings; no reverse edge is permitted", downstream_authority: "closed", activation_authorized: false },
    h05_evidence_id_correction: { command_id: "custodial-v434-foundation-h05-evidence-id-restoration-20260808-001", base_commit: EVIDENCE_ID_CORRECTION_BASE_COMMIT, changed_member_count: 2, predecessor: { package_id: "custodial-unified-v4-3-foundation-correction-20260808-001", revision: "v4.3.3-foundation-correction", manifest_sha256: "d66bcc4b2d0a8a21067d9eb235c33f53b091ac733a3b60c6ebc1d4b4f5d36e58", manifest_git_blob_sha1: "33ffc56b41f34c75c2f4baeb9cb12fe83f55145b", correction_command_id: "custodial-v433-foundation-h05-semantic-correction-20260808-001" }, semantic_invariant: "every emitted H05 evidence check ID is unique; duplicate IDs fail closed before an evidence checks array is emitted", downstream_authority: "closed", activation_authorized: false }
  };
  validateExpectedMembership(manifest.members);
  for (const member of manifest.members) {
    let absolute;
    try {
      absolute = resolveMember(member.repo_path);
    } catch (error) {
      if (error.code) throw error;
      fail("E-MANIFEST-MEMBER-MISSING", member.repo_path);
    }
    const bytes = fs.readFileSync(absolute);
    validateCanonicalText(bytes, member.repo_path);
    member.content_digest = { algorithm: "git_blob_sha1", value: gitBlobSha1(bytes) };
  }
  return { manifest, bytes: Buffer.from(json(manifest), "utf8") };
}

function checkCurrent() {
  const expected = buildExpected();
  const current = fs.readFileSync(MANIFEST_PATH);
  compareManifestBytes(current, expected.bytes, MANIFEST_REPO_PATH);
  return expected;
}

function compareManifestBytes(current, expected, label) {
  if (!current.equals(expected)) fail("E-MANIFEST-STALE", `${label} expected_sha256=${sha256(expected)} actual_sha256=${sha256(current)}`);
}

function atomicReplace(file, bytes) {
  const temp = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temp, bytes, { flag: "wx" });
    const staged = fs.readFileSync(temp);
    if (!staged.equals(bytes)) fail("E-MANIFEST-STAGE-MISMATCH");
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function writeExpected() {
  const expected = buildExpected();
  atomicReplace(MANIFEST_PATH, expected.bytes);
  return checkCurrent();
}

function selfTest() {
  const expected = buildExpected();
  const original = structuredClone(expected.manifest.members);
  const cases = [
    ["omitted_member", "E-MANIFEST-MEMBERSHIP-EXACT", (members) => { members.pop(); }],
    ["duplicate_path", "E-MANIFEST-DUPLICATE-PATH", (members) => { members[1].path = members[0].path; }],
    ["duplicate_repo_path", "E-MANIFEST-DUPLICATE-REPO-PATH", (members) => { members[1].repo_path = members[0].repo_path; }],
    ["self_reference", "E-MANIFEST-SELF-REFERENCE", (members) => { members[1].repo_path = MANIFEST_REPO_PATH; }],
    ["semantic_circularity", "E-MANIFEST-SEMANTIC-CIRCULARITY", (members) => { members[1].type = "immutable_manifest"; }],
    ["stale_digest", "E-MANIFEST-STALE-MEMBER", (members) => { members[0].content_digest.value = "0".repeat(40); }]
  ];
  const observed = [];
  for (const [id, code, mutate] of cases) {
    const candidate = structuredClone(original);
    mutate(candidate);
    let actual = null;
    try {
      validateExpectedMembership(candidate);
      if (id === "stale_digest") {
        const bytes = fs.readFileSync(resolveMember(candidate[0].repo_path));
        if (candidate[0].content_digest.value !== gitBlobSha1(bytes)) fail(code);
      }
    } catch (error) {
      actual = error.code;
    }
    if (actual !== code) fail("E-MANIFEST-SELF-TEST", `${id}:${actual}`);
    validateExpectedMembership(structuredClone(original));
    observed.push({ id, expected_error: code, recovery: "PASS" });
  }
  const contract=readAndValidateArtifactContract(),mappingMutation=structuredClone(contract),mappingNode=mappingMutation.nodes.find(node=>node.artifact_id==="V43-CONTENT-MANIFEST");
  [mappingNode.member_source_classification[0].source_artifact_id,mappingNode.member_source_classification[1].source_artifact_id]=[mappingNode.member_source_classification[1].source_artifact_id,mappingNode.member_source_classification[0].source_artifact_id];
  let mappingCode=null;try{validateArtifactContractDocument(mappingMutation)}catch(error){mappingCode=error.code}
  if(mappingCode!=="E-MANIFEST-SOURCE-CLASSIFICATION-EXACT")fail("E-MANIFEST-SELF-TEST",`source_mapping_swap:${mappingCode}`);
  validateArtifactContractDocument(contract);observed.push({id:"source_mapping_swap",expected_error:"E-MANIFEST-SOURCE-CLASSIFICATION-EXACT",recovery:"PASS"});
  const tempRoot = fs.mkdtempSync(path.join(path.dirname(MANIFEST_PATH), ".manifest-self-test-"));
  try {
    const tempManifest = path.join(tempRoot, "manifest.json");
    fs.writeFileSync(tempManifest, expected.bytes);
    const corrupted = structuredClone(expected.manifest);corrupted.members.pop();
    fs.writeFileSync(tempManifest, json(corrupted));
    let staleCode=null;try{compareManifestBytes(fs.readFileSync(tempManifest),expected.bytes,"self-test-manifest")}catch(error){staleCode=error.code}
    if(staleCode!=="E-MANIFEST-STALE")fail("E-MANIFEST-SELF-TEST",`corrupted_current:${staleCode}`);
    atomicReplace(tempManifest, expected.bytes);
    if (!fs.readFileSync(tempManifest).equals(expected.bytes) || fs.readdirSync(tempRoot).some((name) => name.includes(".tmp-"))) fail("E-MANIFEST-BYTE-RECOVERY");
    const symlinkTarget = path.join(tempRoot, "target.txt"),symlinkPath = path.join(tempRoot, "member.txt");
    fs.writeFileSync(symlinkTarget, "safe\n");fs.symlinkSync("target.txt",symlinkPath);
    let symlinkCode=null;try{resolveMember("member.txt",tempRoot)}catch(error){symlinkCode=error.code}
    if(symlinkCode!=="E-MANIFEST-SYMLINK")fail("E-MANIFEST-SELF-TEST",`symlink:${symlinkCode}`);
    let pathCode=null;try{resolveMember("../escape.txt",tempRoot)}catch(error){pathCode=error.code}
    if(pathCode!=="E-MANIFEST-PATH")fail("E-MANIFEST-SELF-TEST",`path_escape:${pathCode}`);
    const realParent=path.join(tempRoot,"real-parent");fs.mkdirSync(realParent);fs.writeFileSync(path.join(realParent,"nested.txt"),"safe\n");fs.symlinkSync("real-parent",path.join(tempRoot,"linked-parent"));
    let ancestorCode=null;try{resolveMember("linked-parent/nested.txt",tempRoot)}catch(error){ancestorCode=error.code}
    if(ancestorCode!=="E-MANIFEST-ANCESTOR-SYMLINK")fail("E-MANIFEST-SELF-TEST",`ancestor_symlink:${ancestorCode}`);
    observed.push({id:"symlink_member",expected_error:"E-MANIFEST-SYMLINK",recovery:"PASS"},{id:"ancestor_symlink",expected_error:"E-MANIFEST-ANCESTOR-SYMLINK",recovery:"PASS"},{id:"path_escape",expected_error:"E-MANIFEST-PATH",recovery:"PASS"},{id:"byte_recovery",expected_error:"E-MANIFEST-STALE",recovery:"PASS"});
  }finally{fs.rmSync(tempRoot,{recursive:true,force:true})}
  return observed;
}

let result;
if (MODE === "--write") result = writeExpected();
else if (MODE === "--check") result = checkCurrent();
else result = { ...buildExpected(), selfTests: selfTest() };

process.stdout.write(`${JSON.stringify({
  protocol: GENERATOR_PROTOCOL,
  status: MODE === "--write" ? "WROTE" : "PASS",
  mode: MODE,
  members: result.manifest.members.length,
  manifest_sha256: sha256(result.bytes),
  self_tests: result.selfTests?.length ?? 0,
  activation_authorized: false
})}\n`);
