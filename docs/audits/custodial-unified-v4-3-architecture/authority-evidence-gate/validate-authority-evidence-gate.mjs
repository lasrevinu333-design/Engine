import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const VALIDATOR_VERSION = "CUSTODIAL_V43_AUTHORITY_EVIDENCE_VALIDATOR_V2";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, "../../../..");
const PACKAGE_PREFIX = "docs/audits/custodial-unified-v4-3-architecture/authority-evidence-gate/";
const WORKFLOW = ".github/workflows/custodial-v43-authority-evidence.yml";
const HARDENING_SCOPE_BASE = "66e6a8ea251169403aed555b439c4a4424306f5c";
const HARDENING_SCOPE_TREE = "9e233d67c3ee35f288b11f310083812960c72cf7";
const FOUNDATION_SOURCE_COMMIT = "46b049439cf83c7fe861926ef34cabf9dcb5840b";
const FOUNDATION_SOURCE_TREE = "3607fd3a7cc908b90f95fde456d6d5b1e4d5fbe9";
const AUTHORITY_PREDECESSOR_COMMIT = "f5c5731d68bbc6bf17d3a7d2f9acc5ab4ba3e247";
const AUTHORITY_PREDECESSOR_TREE = "e5022f6dcf5b82b5ffa2f3a3789e642679f8bded";
const AUTHORITY_PREDECESSOR_MANIFEST_SHA256 = "7e5e7e5ff646ab4976753bbbf4c50f6451b9ba8bf7b040215a6283774cbc0294";
const FOUNDATION_PACKAGE_ID = "custodial-unified-v4-3-foundation-correction-20260808-002";
const FOUNDATION_REVISION = "v4.3.4-foundation-correction";
const AUTHORITY_EVIDENCE_PACKAGE_ID = "custodial-unified-v4-3-authority-evidence-successor-20260808-001";
const AUTHORITY_EVIDENCE_REVISION = "v4.3.1-authority-evidence-successor";
const EXPECTED_WORKFLOW_SHA256 = "7a0dcba2e8a4274d5edf1d31d3735a835692e5b881199498587e96c19b4e227c";
const EXPECTED_LEDGER_SHA256 = "cfe4e296427f6ee7f1e393087afd9aac573e713a95ee346cee043d995b2921b2";
const BRANCH = "agent/custodial-v43-current-trace-reverse-registry-20260808";
const NODE_VERSION = "v22.23.1";
const NPM_VERSION = "11.17.0";
const AUDIT_BASE = FOUNDATION_SOURCE_COMMIT;
const RECORD_COMMIT = "aab21274de72747e38c8e5996c06e77c399e0f3f";
const RECORD_TREE = "8e1cea35444ac84785a3a6aff46d7d5f69277ec7";
const RECORD_MANIFEST = "e24e086ea7a90c71b46c07dac2125c4a7e9123d823a37b89090f1300eb611142";
const RECORD_RESULT = "a2987c49d1042f98095fb589a10d06173749ed5e2f4e9011845ead1d89a88acd";
const HISTORICAL_RECORD_COMMIT = "5c2e9308ba75d6c8f95e52783e05144392eae20c";
const HISTORICAL_RECORD_TREE = "248407269c7510c579ff8e59e973d1d57e380f63";
const HISTORICAL_RECORD_MANIFEST = "1a3b3d5266bb7f0b12b024e82bd06f12e8e9217836a853c6ce548f7504314f8f";
const AUTHORITY_COMMIT = "466d7451b50fb1c851fa17d3b8ac5b32482e285c";
const AUTHORITY_TREE = "6f4f695718e1af18ea4b0d3601587d167c359f1d";
const AUTHORITY_MANIFEST = "5fa8d8579eb8519be8f746286e9b16ad281e3b0382b7815a165c03ae79b5091a";
const AUTHORITY_RESULT = "3ae6b69698f356f9c398ddc4797941afc3397620eb1ca25c2eadad476663a553";
const EXPECTED_CHANGED_PATHS = [
  WORKFLOW,
  `${PACKAGE_PREFIX}README.md`,
  `${PACKAGE_PREFIX}command-receipts.json`,
  `${PACKAGE_PREFIX}evidence-ledger.json`,
  `${PACKAGE_PREFIX}package-manifest.json`,
  `${PACKAGE_PREFIX}validate-authority-evidence-gate.mjs`,
  `${PACKAGE_PREFIX}validation-result.json`
].sort();
const EXPECTED_MEMBER_GENERATED = new Map([
  ["README.md", false],
  ["command-receipts.json", true],
  ["evidence-ledger.json", false],
  ["validate-authority-evidence-gate.mjs", false]
]);
const EXPECTED_MEMBER_NAMES = [...EXPECTED_MEMBER_GENERATED.keys()];
const EXPECTED_PACKAGE_FILES = [...EXPECTED_MEMBER_NAMES, "package-manifest.json", "validation-result.json"].sort();
const GENERATED_RECEIPT_NAMES = ["command-receipts.json", "package-manifest.json", "validation-result.json"];
const WRITE_JOURNAL_NAME = ".authority-evidence-write-journal.json";
const WRITE_JOURNAL_PROTOCOL = "CUSTODIAL_V43_AUTHORITY_EVIDENCE_WRITE_JOURNAL_V2";
const WRITE_STAGE_PREFIX = ".authority-evidence-write-stage-";
const MANIFEST_FIELDS = [
  "activation_authorized", "aggregate_protocol", "aggregate_sha256", "architecture_closure", "excluded_receipts",
  "execution_base", "foundation_source", "hardening_scope_base", "invariant", "member_order", "members", "package_id",
  "predecessor", "protocol", "revision", "self_digest_excluded", "status"
];
const MEMBER_FIELDS = ["bytes", "generated", "path", "sha256"];
const RECEIPT_FIELDS = [
  "branch", "checks", "dependency_replays", "execution_base", "external_reads", "foundation_source",
  "hardening_scope_base", "proposed_source", "protocol", "runtime"
];
const CHECK_FIELDS = [
  "checkout_commit", "checkout_tree", "command", "execution_scope", "exit_status", "id",
  "process_cleanup", "signal", "source_set_sha256", "stable_result", "status", "stderr_policy",
  "timed_out", "timeout_ms", "volatile_fields_omitted"
];
const DEPENDENCY_FIELDS = [...CHECK_FIELDS, "package_manifest_sha256", "validation_result_sha256"];
const CHILD_TIMEOUT_MS = 120000;
const RESULT_FIELDS = [
  "activation_authorized", "architecture_closure", "blockers", "closure", "command_execution",
  "earliest_open_gate", "execution_base", "foundation_source", "hardening_scope_base", "mutation_evidence",
  "owned_test_residue", "package_aggregate_sha256", "package_id", "package_manifest_sha256", "protocol",
  "revision", "status", "validator", "validator_sha256"
];
const HEX_40 = /^[0-9a-f]{40}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const EXPECTED_BLOCKERS = [
  "Canonical registered-private-evidence-plane locator is missing.",
  "Canonical package attestation and evidence-set identity are missing.",
  "Authorized append-only root gate decision sequence is missing.",
  "Current admissible v4.3 joined CAP trace and reverse registry are missing.",
  "G-EVIDENCE-001 and G-TRACE-001 remain OPEN."
];
const EXPECTED_ROOT_GATE_EVIDENCE = [
  {
    gate_id: "G-EVIDENCE-001",
    ready: ["frozen v4.2 input identity", "current v4.3 contract identities", "local deterministic validator receipts", "GitHub run and job-log correlation", "privacy-safe Gmail notice correlation", "inspected archive candidate inventory"],
    missing: ["normatively registered private evidence plane locator", "canonical package_attestation_id", "canonical evidence_set_sha256", "authorized append-only decision sequence", "complete CLOSE REOPEN INVALIDATE SUPERSEDE history"]
  },
  {
    gate_id: "G-TRACE-001",
    ready: ["canonical prerequisite definition", "historical 252-row candidate trace", "current Phase-1 Phase-2 and authority inventories"],
    missing: ["current admissible v4.3 joined CAP trace", "object-level reverse registry", "trace lint bound to the joined trace", "authorized closure after G-EVIDENCE-001"]
  }
];
const EXPECTED_STAGE_FIELDS = ["decision_id", "package_attestation_id", "sequence", "expected_prior_state", "command", "next_state", "actor_principal_id", "authorization_decision_id", "evidence_set_sha256", "decided_at_utc"];
const EXPECTED_ASSUMPTIONS = [
  "The exact scoped Engine worktree and GitHub origin are authoritative repository surfaces.",
  "The archive candidate is evidence input only until a controlling contract registers it.",
  "Mailbox identifiers are private evidence locators and are represented by SHA-256 in this public repository.",
  "No green validator receipt alone is an append-only authority decision."
];
const EXPECTED_INPUTS = [
  ["docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-gate-registry.json", "cc5057340c0e75680e2117cf6edb13b4533baf8510dcbe0ecba91de6352035a8"],
  ["docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-stage-control-model.json", "67eb1f5b9dbc05459d09175abf5e4df1b0a1596e4e599d12bc023155ec801964"],
  ["docs/audits/custodial-unified-v4-3-architecture/phase1-foundation-registry.json", "f34d5d251b0cd52264b8df2e332e17f14e2cf9b69b12748eae1f4312282cc2d0"],
  ["docs/audits/custodial-unified-v4-3-architecture/record-envelope-canonicalization/package-manifest.json", RECORD_MANIFEST],
  ["docs/audits/custodial-unified-v4-3-architecture/record-envelope-canonicalization/validation-result.json", RECORD_RESULT],
  ["docs/audits/custodial-unified-v4-3-architecture/phase2-operational-architecture/phase2-package-manifest.json", "b38442b9b0c3b356c98bb0180f6f06294663d722b89762d3e4295be40e8f8784"],
  ["docs/audits/custodial-unified-v4-3-architecture/authority-schema-component-gate/package-manifest.json", AUTHORITY_MANIFEST],
  ["docs/audits/custodial-unified-v4-3-architecture/authority-schema-component-gate/validation-result.json", AUTHORITY_RESULT],
  ["docs/audits/custodial-unified-v4-3-architecture/stage-decision-phase2-operational-architecture.json", "f4992b5d0435a01e0e751825ba9da4ef548ef3321b88734071594a0839f1b4f6"]
  , ["docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-content-manifest.json", "5c5749486add2308a430de0145b02e1a19d5b4ba59cc875b5c48d47180f068c8"]
];
const EXPECTED_PROTECTED = [
  ["package.json", "7ffce76375965c2d96ba0a835a2010690b2c7a55df782781acebb272bb96e004"],
  ["docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-content-manifest.json", "5c5749486add2308a430de0145b02e1a19d5b4ba59cc875b5c48d47180f068c8"]
];

class ValidationError extends Error {
  constructor(code, detail = "") {
    super(`${code}${detail ? `: ${detail}` : ""}`);
    this.code = code;
  }
}
const fail = (code, detail) => { throw new ValidationError(code, detail); };
const ensure = (condition, code, detail) => { if (!condition) fail(code, detail); };
const clone = (value) => JSON.parse(JSON.stringify(value));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const exactJson = (actual, expected, code, detail = "") => ensure(JSON.stringify(actual) === JSON.stringify(expected), code, detail);
const unique = (values, code, detail = "") => ensure(new Set(values).size === values.length, code, detail);
const readJson = (name) => JSON.parse(readRegularFile(path.join(ROOT, name), ROOT, "E-PACKAGE-READ").toString("utf8"));
const textJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

function strictObject(value, fields, code) {
  ensure(value !== null && typeof value === "object" && !Array.isArray(value), `${code}-TYPE`);
  exactJson(Object.keys(value).sort(), [...fields].sort(), `${code}-FIELDS`);
}

function expectFailure(action, expectedCode) {
  try {
    action();
  } catch (error) {
    ensure(error?.code === expectedCode, "E-HARDENING-WRONG-ERROR", `${expectedCode}:${error?.code ?? error?.message}`);
    return;
  }
  fail("E-HARDENING-MUTATION-ESCAPED", expectedCode);
}

function runMutationCases(baseline, cases, validate) {
  const evidence = [];
  for (const [name, expectedCode, mutate] of cases) {
    const candidate = clone(baseline);
    const mutated = mutate(candidate) ?? candidate;
    expectFailure(() => validate(mutated), expectedCode);
    validate(baseline);
    evidence.push({ name, error: expectedCode, recovery: "PASS" });
  }
  return evidence;
}

function assertPathInside(scopeRoot, target, code = "E-PATH-SCOPE") {
  const relative = path.relative(scopeRoot, target);
  ensure(relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)), code, target);
}

function validateRelativePath(value, code = "E-MEMBER-PATH") {
  ensure(typeof value === "string", `${code}-TYPE`);
  ensure(
    value.length > 0 && !value.includes("\0") && !value.includes("\\") && !path.posix.isAbsolute(value) &&
      value !== "." && value !== ".." && path.posix.normalize(value) === value &&
      !value.split("/").some((part) => part === "" || part === "." || part === ".."),
    `${code}-SCOPE`, value
  );
}

function readRegularFile(target, scopeRoot, code, options = {}) {
  assertPathInside(scopeRoot, target, `${code}-SCOPE`);
  assertPathInside(REPO, scopeRoot, `${code}-SCOPE-ROOT`);
  ensure(process.cwd() === REPO, `${code}-TRUSTED-CWD`, process.cwd());
  ensure(Number.isInteger(fs.constants.O_NOFOLLOW) && Number.isInteger(fs.constants.O_DIRECTORY), `${code}-DESCRIPTOR-FLAGS`, target);
  ensure(fs.existsSync("/proc/self/fd"), `${code}-DESCRIPTOR-RELATIVE-UNAVAILABLE`);
  const relative = path.relative(REPO, target);
  const components = relative.split(path.sep);
  ensure(components.length > 0 && components.every((item) => item.length > 0 && item !== "." && item !== ".."), `${code}-COMPONENTS`, relative);
  const opened = [];
  const chain = [];
  try {
    const rootDescriptor = fs.openSync(".", fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    opened.push(rootDescriptor);
    const rootStat = fs.fstatSync(rootDescriptor);
    ensure(rootStat.isDirectory(), `${code}-TRUSTED-ROOT`);
    chain.push([rootStat.dev, rootStat.ino, rootStat.mode]);
    let parentDescriptor = rootDescriptor;
    for (const [index, component] of components.slice(0, -1).entries()) {
      const componentPath = `/proc/self/fd/${parentDescriptor}/${component}`;
      const directoryDescriptor = fs.openSync(componentPath, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      opened.push(directoryDescriptor);
      const directoryStat = fs.fstatSync(directoryDescriptor);
      ensure(directoryStat.isDirectory(), `${code}-ANCESTOR-NONREGULAR`, component);
      chain.push([directoryStat.dev, directoryStat.ino, directoryStat.mode]);
      parentDescriptor = directoryDescriptor;
      options.afterDirectoryOpened?.({ component, index });
    }
    const descriptor = fs.openSync(`/proc/self/fd/${parentDescriptor}/${components.at(-1)}`, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    opened.push(descriptor);
    const before = fs.fstatSync(descriptor);
    ensure(before.isFile(), `${code}-NONREGULAR`, target);
    ensure(Number.isSafeInteger(before.size) && before.size >= 0, `${code}-SIZE`, target);
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      ensure(count > 0, `${code}-SHORT-READ`, target);
      offset += count;
    }
    const probe = Buffer.alloc(1);
    ensure(fs.readSync(descriptor, probe, 0, 1, offset) === 0, `${code}-GROWTH`, target);
    const after = fs.fstatSync(descriptor);
    ensure(
      after.isFile() && before.dev === after.dev && before.ino === after.ino &&
        before.size === after.size && before.mode === after.mode,
      `${code}-RACE`, target
    );
    const stableChain = descriptorPathIdentity(target, code);
    exactJson(stableChain.directories, chain, `${code}-ANCESTOR-RACE`, target);
    exactJson(stableChain.leaf, [after.dev, after.ino, after.mode, after.size], `${code}-LEAF-RACE`, target);
    return bytes;
  } catch (error) {
    if (error?.code === "ELOOP" || error?.code === "ENOTDIR") fail(`${code}-SYMLINK`, target);
    throw error;
  } finally {
    for (const descriptor of opened.reverse()) fs.closeSync(descriptor);
  }
}

function validateDescriptorRelativeRaceMutations() {
  const ownedRoot = beginOwnedLifecycleTest("descriptor-reads");
  const inside = path.join(ownedRoot, "inside");
  const pinned = path.join(ownedRoot, "pinned");
  const outside = path.join(ownedRoot, "outside");
  const member = path.join(inside, "member.txt");
  const evidence = [];
  try {
    fs.mkdirSync(inside);
    fs.mkdirSync(outside);
    fs.writeFileSync(member, "safe-in-scope\n");
    fs.writeFileSync(path.join(outside, "member.txt"), "outside-canary-must-not-be-read\n");
    let substituted = false;
    expectFailure(() => readRegularFile(member, ownedRoot, "E-DESCRIPTOR-RACE", {
      afterDirectoryOpened: ({ component }) => {
        if (component === "inside" && !substituted) {
          fs.renameSync(inside, pinned);
          fs.symlinkSync(outside, inside);
          substituted = true;
        }
      }
    }), "E-DESCRIPTOR-RACE-SYMLINK");
    ensure(substituted, "E-DESCRIPTOR-RACE-NOT-INJECTED");
    fs.unlinkSync(inside);
    fs.renameSync(pinned, inside);
    ensure(readRegularFile(member, ownedRoot, "E-DESCRIPTOR-RACE").toString("utf8") === "safe-in-scope\n", "E-DESCRIPTOR-RACE-RECOVERY");
    evidence.push({ name: "ancestor_component_substitution", error: "E-DESCRIPTOR-RACE-SYMLINK", recovery: "PASS" });

    fs.unlinkSync(member);
    fs.symlinkSync(path.join(outside, "member.txt"), member);
    expectFailure(() => readRegularFile(member, ownedRoot, "E-DESCRIPTOR-LEAF"), "E-DESCRIPTOR-LEAF-SYMLINK");
    fs.unlinkSync(member);
    fs.writeFileSync(member, "safe-in-scope\n");
    ensure(readRegularFile(member, ownedRoot, "E-DESCRIPTOR-LEAF").toString("utf8") === "safe-in-scope\n", "E-DESCRIPTOR-LEAF-RECOVERY");
    evidence.push({ name: "leaf_symlink_substitution", error: "E-DESCRIPTOR-LEAF-SYMLINK", recovery: "PASS" });
  } finally {
    finishOwnedLifecycleTest(ownedRoot);
  }
  return evidence;
}

function descriptorPathIdentity(target, code) {
  const relative = path.relative(REPO, target);
  const components = relative.split(path.sep);
  const opened = [];
  const directories = [];
  try {
    const rootDescriptor = fs.openSync(".", fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    opened.push(rootDescriptor);
    const rootStat = fs.fstatSync(rootDescriptor);
    directories.push([rootStat.dev, rootStat.ino, rootStat.mode]);
    let parentDescriptor = rootDescriptor;
    for (const component of components.slice(0, -1)) {
      const directoryDescriptor = fs.openSync(`/proc/self/fd/${parentDescriptor}/${component}`, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      opened.push(directoryDescriptor);
      const stat = fs.fstatSync(directoryDescriptor);
      directories.push([stat.dev, stat.ino, stat.mode]);
      parentDescriptor = directoryDescriptor;
    }
    const leafDescriptor = fs.openSync(`/proc/self/fd/${parentDescriptor}/${components.at(-1)}`, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    opened.push(leafDescriptor);
    const leafStat = fs.fstatSync(leafDescriptor);
    ensure(leafStat.isFile(), `${code}-NONREGULAR`, target);
    return { directories, leaf: [leafStat.dev, leafStat.ino, leafStat.mode, leafStat.size] };
  } catch (error) {
    if (error?.code === "ELOOP" || error?.code === "ENOTDIR") fail(`${code}-SYMLINK`, target);
    throw error;
  } finally {
    for (const descriptor of opened.reverse()) fs.closeSync(descriptor);
  }
}

function discoverPackage(packageRoot, scopeRoot, expectedFiles, expectedDirectories = []) {
  assertPathInside(scopeRoot, packageRoot, "E-PACKAGE-ROOT-SCOPE");
  assertPathInside(REPO, scopeRoot, "E-PACKAGE-SCOPE-ROOT");
  const files = [];
  const directories = [];
  let rootDescriptor;
  try {
    rootDescriptor = openDirectoryDescriptor(packageRoot, "E-PACKAGE");
    const rootIdentity = fs.fstatSync(rootDescriptor);
    const walk = (directoryDescriptor, relativeParent = "") => {
      for (const name of fs.readdirSync(`/proc/self/fd/${directoryDescriptor}`).sort()) {
        validateRelativePath(name, "E-PACKAGE-ENTRY");
        ensure(!name.includes("/"), "E-PACKAGE-ENTRY-NESTED", name);
        const relative = relativeParent ? `${relativeParent}/${name}` : name;
        const descriptorPath = `/proc/self/fd/${directoryDescriptor}/${name}`;
        const before = fs.lstatSync(descriptorPath);
        ensure(!before.isSymbolicLink(), "E-PACKAGE-SYMLINK", relative);
        if (before.isDirectory()) {
          const childDescriptor = fs.openSync(descriptorPath, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
          try {
            const opened = fs.fstatSync(childDescriptor);
            ensure(opened.isDirectory() && opened.dev === before.dev && opened.ino === before.ino && opened.mode === before.mode, "E-PACKAGE-RACE", relative);
            directories.push(relative);
            walk(childDescriptor, relative);
            const after = fs.lstatSync(descriptorPath);
            ensure(!after.isSymbolicLink() && after.isDirectory() && after.dev === opened.dev && after.ino === opened.ino && after.mode === opened.mode, "E-PACKAGE-RACE", relative);
          } finally {
            fs.closeSync(childDescriptor);
          }
        } else if (before.isFile()) {
          const fileDescriptor = fs.openSync(descriptorPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
          try {
            const opened = fs.fstatSync(fileDescriptor);
            ensure(opened.isFile() && opened.dev === before.dev && opened.ino === before.ino && opened.mode === before.mode && opened.size === before.size, "E-PACKAGE-RACE", relative);
            const after = fs.lstatSync(descriptorPath);
            ensure(!after.isSymbolicLink() && after.isFile() && after.dev === opened.dev && after.ino === opened.ino && after.mode === opened.mode && after.size === opened.size, "E-PACKAGE-RACE", relative);
          } finally {
            fs.closeSync(fileDescriptor);
          }
          files.push(relative);
        } else {
          fail("E-PACKAGE-NONREGULAR", relative);
        }
      }
    };
    walk(rootDescriptor);
    const closingIdentity = fs.fstatSync(rootDescriptor);
    ensure(closingIdentity.dev === rootIdentity.dev && closingIdentity.ino === rootIdentity.ino && closingIdentity.mode === rootIdentity.mode, "E-PACKAGE-ROOT-RACE");
    const pathDescriptor = openDirectoryDescriptor(packageRoot, "E-PACKAGE");
    try {
      const pathIdentity = fs.fstatSync(pathDescriptor);
      ensure(pathIdentity.dev === rootIdentity.dev && pathIdentity.ino === rootIdentity.ino && pathIdentity.mode === rootIdentity.mode, "E-PACKAGE-ROOT-RACE");
    } finally {
      fs.closeSync(pathDescriptor);
    }
  } catch (error) {
    if (error?.code === "ELOOP" || error?.code === "ENOTDIR") fail("E-PACKAGE-SYMLINK", packageRoot);
    throw error;
  } finally {
    if (rootDescriptor !== undefined) fs.closeSync(rootDescriptor);
  }
  exactJson(files.sort(), [...expectedFiles].sort(), "E-PACKAGE-FILE-CLOSURE");
  exactJson(directories.sort(), [...expectedDirectories].sort(), "E-PACKAGE-DIRECTORY-CLOSURE");
  return { files, directories };
}

function packageAggregate(members) {
  const hash = crypto.createHash("sha256");
  hash.update("CUSTODIAL_V43_AUTHORITY_EVIDENCE_PACKAGE_AGGREGATE_V2\0", "utf8");
  for (const member of [...members].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)) {
    hash.update("member\0", "utf8");
    hash.update(member.path, "utf8");
    hash.update("\0", "utf8");
    hash.update(String(member.bytes), "utf8");
    hash.update("\0", "utf8");
    hash.update(member.sha256, "utf8");
    hash.update("\0", "utf8");
    hash.update(member.generated ? "1" : "0", "utf8");
    hash.update("\0", "utf8");
  }
  hash.update("end\0", "utf8");
  return hash.digest("hex");
}

function expectedManifest(commandReceiptText) {
  const override = new Map([["command-receipts.json", Buffer.from(commandReceiptText)]]);
  const members = EXPECTED_MEMBER_NAMES.map((name) => {
    const bytes = override.get(name) ?? readRegularFile(path.join(ROOT, name), ROOT, "E-MANIFEST-SOURCE");
    return { path: name, bytes: bytes.length, sha256: sha256(bytes), generated: EXPECTED_MEMBER_GENERATED.get(name) };
  });
  return {
    protocol: "CUSTODIAL_V43_AUTHORITY_EVIDENCE_PACKAGE_MANIFEST_V2",
    package_id: AUTHORITY_EVIDENCE_PACKAGE_ID,
    revision: AUTHORITY_EVIDENCE_REVISION,
    status: "PASS_EVIDENCE_PACKET_ONLY",
    hardening_scope_base: HARDENING_SCOPE_BASE,
    execution_base: { commit: HARDENING_SCOPE_BASE, tree: HARDENING_SCOPE_TREE },
    foundation_source: {
      commit: FOUNDATION_SOURCE_COMMIT,
      tree: FOUNDATION_SOURCE_TREE,
      package_id: FOUNDATION_PACKAGE_ID,
      revision: FOUNDATION_REVISION,
      content_manifest_sha256: "5c5749486add2308a430de0145b02e1a19d5b4ba59cc875b5c48d47180f068c8"
    },
    predecessor: {
      commit: AUTHORITY_PREDECESSOR_COMMIT,
      tree: AUTHORITY_PREDECESSOR_TREE,
      package_manifest_sha256: AUTHORITY_PREDECESSOR_MANIFEST_SHA256
    },
    activation_authorized: false,
    architecture_closure: false,
    member_order: "LEXICOGRAPHIC_SOURCE_MEMBERS_THEN_MANIFEST_THEN_VALIDATION_RESULT",
    self_digest_excluded: true,
    excluded_receipts: ["package-manifest.json", "validation-result.json"],
    members,
    aggregate_protocol: "CUSTODIAL_V43_AUTHORITY_EVIDENCE_PACKAGE_AGGREGATE_V2",
    aggregate_sha256: packageAggregate(members),
    invariant: "Authority evidence, package manifests, and validation receipts cannot authorize activation or architecture closure or participate in their own digest closure."
  };
}

function validateManifest(manifest, expected) {
  strictObject(manifest, MANIFEST_FIELDS, "E-MANIFEST");
  ensure(manifest.protocol === expected.protocol, "E-MANIFEST-PROTOCOL");
  ensure(manifest.package_id === AUTHORITY_EVIDENCE_PACKAGE_ID && manifest.revision === AUTHORITY_EVIDENCE_REVISION, "E-MANIFEST-IDENTITY");
  ensure(manifest.status === expected.status, "E-MANIFEST-STATUS");
  ensure(manifest.hardening_scope_base === HARDENING_SCOPE_BASE, "E-MANIFEST-SCOPE-BASE");
  exactJson(manifest.execution_base, expected.execution_base, "E-MANIFEST-EXECUTION-BASE");
  exactJson(manifest.foundation_source, expected.foundation_source, "E-MANIFEST-FOUNDATION-SOURCE");
  exactJson(manifest.predecessor, expected.predecessor, "E-MANIFEST-PREDECESSOR");
  ensure(manifest.activation_authorized === false, "E-MANIFEST-ACTIVATION");
  ensure(manifest.architecture_closure === false, "E-MANIFEST-ARCHITECTURE-CLOSURE");
  ensure(manifest.member_order === expected.member_order, "E-MANIFEST-MEMBER-ORDER");
  ensure(manifest.self_digest_excluded === true, "E-MANIFEST-SELF-EXCLUSION");
  ensure(Array.isArray(manifest.excluded_receipts) && manifest.excluded_receipts.every((item) => typeof item === "string"), "E-MANIFEST-EXCLUSIONS-TYPE");
  exactJson(manifest.excluded_receipts, expected.excluded_receipts, "E-MANIFEST-EXCLUSIONS");
  ensure(Array.isArray(manifest.members), "E-MANIFEST-MEMBERS-TYPE");
  for (const member of manifest.members) {
    strictObject(member, MEMBER_FIELDS, "E-MANIFEST-MEMBER");
    validateRelativePath(member.path, "E-MANIFEST-MEMBER-PATH");
    ensure(Number.isSafeInteger(member.bytes) && member.bytes >= 0, "E-MANIFEST-MEMBER-BYTES", member.path);
    ensure(typeof member.sha256 === "string" && HEX_64.test(member.sha256), "E-MANIFEST-MEMBER-DIGEST", member.path);
    ensure(typeof member.generated === "boolean", "E-MANIFEST-MEMBER-GENERATED-TYPE", member.path);
  }
  const names = manifest.members.map((member) => member.path);
  unique(names, "E-MANIFEST-MEMBER-DUPLICATE");
  ensure(!names.includes("package-manifest.json"), "E-MANIFEST-SELF-CYCLE");
  ensure(!names.includes("validation-result.json"), "E-MANIFEST-RESULT-CYCLE");
  exactJson(names, EXPECTED_MEMBER_NAMES, "E-MANIFEST-MEMBER-CLOSURE");
  for (let index = 0; index < manifest.members.length; index += 1) {
    const member = manifest.members[index];
    const expectedMember = expected.members[index];
    ensure(member.generated === EXPECTED_MEMBER_GENERATED.get(member.path), "E-MANIFEST-MEMBER-CLASSIFICATION", member.path);
    ensure(member.bytes === expectedMember.bytes, "E-MANIFEST-MEMBER-BYTES-DRIFT", member.path);
    ensure(member.sha256 === expectedMember.sha256, "E-MANIFEST-MEMBER-DIGEST-DRIFT", member.path);
  }
  ensure(typeof manifest.aggregate_sha256 === "string" && HEX_64.test(manifest.aggregate_sha256), "E-MANIFEST-AGGREGATE-TYPE");
  ensure(manifest.aggregate_protocol === expected.aggregate_protocol, "E-MANIFEST-AGGREGATE-PROTOCOL");
  ensure(manifest.aggregate_sha256 === packageAggregate(manifest.members), "E-MANIFEST-AGGREGATE");
  ensure(manifest.invariant === expected.invariant, "E-MANIFEST-INVARIANT");
}

const MANIFEST_MUTATIONS = [
  ["top_array_not_object", "E-MANIFEST-TYPE", () => []],
  ["top_missing_status", "E-MANIFEST-FIELDS", (value) => { delete value.status; }],
  ["top_extra_activation_authority", "E-MANIFEST-FIELDS", (value) => { value.activation_authority = true; }],
  ["top_extra_closure_authority", "E-MANIFEST-FIELDS", (value) => { value.closure_authority = true; }],
  ["protocol_drift", "E-MANIFEST-PROTOCOL", (value) => { value.protocol = "ACTIVATED"; }],
  ["identity_reused", "E-MANIFEST-IDENTITY", (value) => { value.package_id = FOUNDATION_PACKAGE_ID; }],
  ["foundation_checkout_conflated", "E-MANIFEST-FOUNDATION-SOURCE", (value) => { value.foundation_source.commit = HARDENING_SCOPE_BASE; }],
  ["predecessor_drift", "E-MANIFEST-PREDECESSOR", (value) => { value.predecessor.commit = FOUNDATION_SOURCE_COMMIT; }],
  ["scope_base_drift", "E-MANIFEST-SCOPE-BASE", (value) => { value.hardening_scope_base = "0".repeat(40); }],
  ["activation_escalated", "E-MANIFEST-ACTIVATION", (value) => { value.activation_authorized = true; }],
  ["architecture_closure_escalated", "E-MANIFEST-ARCHITECTURE-CLOSURE", (value) => { value.architecture_closure = true; }],
  ["self_exclusion_disabled", "E-MANIFEST-SELF-EXCLUSION", (value) => { value.self_digest_excluded = false; }],
  ["exclusions_missing_result", "E-MANIFEST-EXCLUSIONS", (value) => { value.excluded_receipts.pop(); }],
  ["member_missing_field", "E-MANIFEST-MEMBER-FIELDS", (value) => { delete value.members[0].bytes; }],
  ["member_extra_field", "E-MANIFEST-MEMBER-FIELDS", (value) => { value.members[0].activation_authorized = true; }],
  ["member_path_escape", "E-MANIFEST-MEMBER-PATH-SCOPE", (value) => { value.members[0].path = "../README.md"; }],
  ["member_path_backslash", "E-MANIFEST-MEMBER-PATH-SCOPE", (value) => { value.members[0].path = "dir\\README.md"; }],
  ["member_path_normalization", "E-MANIFEST-MEMBER-PATH-SCOPE", (value) => { value.members[0].path = "dir/../README.md"; }],
  ["member_duplicate", "E-MANIFEST-MEMBER-DUPLICATE", (value) => { value.members[1].path = value.members[0].path; }],
  ["member_self_cycle", "E-MANIFEST-SELF-CYCLE", (value) => { value.members.at(-1).path = "package-manifest.json"; }],
  ["member_result_cycle", "E-MANIFEST-RESULT-CYCLE", (value) => { value.members.at(-1).path = "validation-result.json"; }],
  ["member_missing", "E-MANIFEST-MEMBER-CLOSURE", (value) => { value.members.pop(); }],
  ["member_order_drift", "E-MANIFEST-MEMBER-CLOSURE", (value) => { value.members.reverse(); }],
  ["member_bytes_type", "E-MANIFEST-MEMBER-BYTES", (value) => { value.members[0].bytes = "1"; }],
  ["member_digest_type", "E-MANIFEST-MEMBER-DIGEST", (value) => { value.members[0].sha256 = true; }],
  ["member_generated_type", "E-MANIFEST-MEMBER-GENERATED-TYPE", (value) => { value.members[0].generated = "false"; }],
  ["member_classification_flip", "E-MANIFEST-MEMBER-CLASSIFICATION", (value) => { value.members[0].generated = true; }],
  ["member_bytes_drift", "E-MANIFEST-MEMBER-BYTES-DRIFT", (value) => { value.members[0].bytes += 1; }],
  ["member_digest_drift", "E-MANIFEST-MEMBER-DIGEST-DRIFT", (value) => { value.members[0].sha256 = "0".repeat(64); }],
  ["aggregate_drift", "E-MANIFEST-AGGREGATE", (value) => { value.aggregate_sha256 = "0".repeat(64); }],
  ["aggregate_protocol_drift", "E-MANIFEST-AGGREGATE-PROTOCOL", (value) => { value.aggregate_protocol = "UNDOMAINED"; }],
  ["invariant_laundered", "E-MANIFEST-INVARIANT", (value) => { value.invariant = "activation authorized"; }]
];

function removeOwned(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true });
  ensure(!fs.existsSync(target), "E-FILESYSTEM-RESIDUE", target);
}

async function validateFilesystemMutations() {
  const ownedRoot = beginOwnedLifecycleTest("filesystem-mutations");
  const fixture = path.join(ownedRoot, "package");
  const expectedFiles = ["member.txt", "nested/member.txt"];
  const expectedDirectories = ["nested"];
  const evidence = [];
  const recover = () => {
    removeOwned(fixture);
    fs.mkdirSync(path.join(fixture, "nested"), { recursive: true });
    fs.writeFileSync(path.join(fixture, "member.txt"), "member\n");
    fs.writeFileSync(path.join(fixture, "nested/member.txt"), "nested\n");
    discoverPackage(fixture, ownedRoot, expectedFiles, expectedDirectories);
  };
  const run = (name, expectedCode, mutate, cleanup = recover) => {
    recover();
    mutate();
    expectFailure(() => discoverPackage(fixture, ownedRoot, expectedFiles, expectedDirectories), expectedCode);
    cleanup();
    discoverPackage(fixture, ownedRoot, expectedFiles, expectedDirectories);
    evidence.push({ name, error: expectedCode, recovery: "PASS" });
  };
  try {
    run("extra_file", "E-PACKAGE-FILE-CLOSURE", () => fs.writeFileSync(path.join(fixture, "extra.txt"), "extra\n"));
    run("extra_directory", "E-PACKAGE-DIRECTORY-CLOSURE", () => fs.mkdirSync(path.join(fixture, "extra")));
    run("missing_member", "E-PACKAGE-FILE-CLOSURE", () => fs.unlinkSync(path.join(fixture, "member.txt")));
    recover();
    const created = await runBounded("mkfifo", [path.join(fixture, "fifo")], { cwd: ownedRoot, timeoutMs: 5000, stderrPolicy: "EMPTY" });
    ensure(created.status === 0 && created.signal === null && !created.timedOut && !created.orphanDetected, "E-FILESYSTEM-FIFO-CREATE", created.stderr);
    expectFailure(() => discoverPackage(fixture, ownedRoot, expectedFiles, expectedDirectories), "E-PACKAGE-NONREGULAR");
    recover();
    evidence.push({ name: "nonregular_fifo", error: "E-PACKAGE-NONREGULAR", recovery: "PASS" });
    run("direct_symlink", "E-PACKAGE-SYMLINK", () => {
      fs.unlinkSync(path.join(fixture, "member.txt"));
      fs.symlinkSync(path.join(fixture, "nested/member.txt"), path.join(fixture, "member.txt"));
    });
    recover();
    const realAncestor = path.join(ownedRoot, "real-ancestor");
    const linkedAncestor = path.join(ownedRoot, "linked-ancestor");
    fs.mkdirSync(realAncestor);
    fs.symlinkSync(realAncestor, linkedAncestor);
    expectFailure(() => discoverPackage(path.join(linkedAncestor, "package"), ownedRoot, [], []), "E-PACKAGE-SYMLINK");
    fs.unlinkSync(linkedAncestor);
    fs.rmdirSync(realAncestor);
    recover();
    evidence.push({ name: "ancestor_symlink", error: "E-PACKAGE-SYMLINK", recovery: "PASS" });
    recover();
    try {
      fs.writeFileSync(path.join(fixture, "interrupted.tmp"), "owned\n");
      fail("E-FILESYSTEM-INJECTED-INTERRUPTION");
    } catch (error) {
      ensure(error.code === "E-FILESYSTEM-INJECTED-INTERRUPTION", "E-FILESYSTEM-INTERRUPTION-WRONG-ERROR");
    } finally {
      fs.unlinkSync(path.join(fixture, "interrupted.tmp"));
    }
    discoverPackage(fixture, ownedRoot, expectedFiles, expectedDirectories);
    evidence.push({ name: "cleanup_interruption", error: "E-FILESYSTEM-INJECTED-INTERRUPTION", recovery: "PASS" });
  } finally {
    finishOwnedLifecycleTest(ownedRoot);
  }
  return evidence;
}

function validateBindingArray(bindings, expected, code) {
  ensure(Array.isArray(bindings), `${code}-TYPE`);
  for (const binding of bindings) {
    strictObject(binding, ["path", "sha256"], `${code}-MEMBER`);
    validateRelativePath(binding.path, `${code}-PATH`);
    ensure(typeof binding.sha256 === "string" && HEX_64.test(binding.sha256), `${code}-DIGEST-TYPE`, binding.path);
  }
  unique(bindings.map((item) => item.path), `${code}-DUPLICATE`);
  exactJson(bindings.map((item) => [item.path, item.sha256]), expected, `${code}-VALUE`);
  for (const binding of bindings) {
    const bytes = readRegularFile(path.join(REPO, binding.path), REPO, code);
    ensure(sha256(bytes) === binding.sha256, `${code}-DIGEST`, binding.path);
  }
}

function validateLedgerShape(ledger) {
  strictObject(ledger, [
    "assumptions", "audit_base_head", "authority", "blockers", "branch", "earliest_invariant",
    "downstream_rebinds", "evidence_planes", "execution_binding", "foundation_binding", "github", "gmail", "hardening_scope_base",
    "historical_clean_baseline_head", "input_bindings", "open_gate_inventory",
    "phase2_stage_decision_governance", "predecessor_binding", "protected_files", "protocol", "receipts",
    "record_envelope", "root_gate_evidence", "status", "trace_audit"
  ], "E-LEDGER");
  strictObject(ledger.receipts, ["build_receipt_status", "build_sha256", "research_sha256", "revised_plan_audit_sha256"], "E-LEDGER-RECEIPTS");
  strictObject(ledger.foundation_binding, ["activation_authorized", "classification", "closure_ready", "commit", "content_manifest_sha256", "package_id", "revision", "tree"], "E-LEDGER-FOUNDATION");
  strictObject(ledger.execution_binding, ["classification", "commit", "tree", "whole_system_quality_run"], "E-LEDGER-EXECUTION");
  strictObject(ledger.predecessor_binding, ["classification", "commit", "package_manifest_sha256", "tree"], "E-LEDGER-PREDECESSOR");
  strictObject(ledger.downstream_rebinds, ["record_registry_prerequisite", "trace_reverse_registry"], "E-LEDGER-DOWNSTREAM");
  strictObject(ledger.downstream_rebinds.record_registry_prerequisite, ["classification", "derived_package_consumer", "direct_consumers", "reason"], "E-LEDGER-DOWNSTREAM-PREREQUISITE");
  strictObject(ledger.downstream_rebinds.trace_reverse_registry, ["artifact_ids", "classification", "current_joined_trace_directory", "current_state"], "E-LEDGER-DOWNSTREAM-TRACE");
  strictObject(ledger.authority, [
    "activation_authorized", "architecture_closure", "canonical_gate_decisions_authored",
    "component_design_authorized", "earliest_open_gate", "implementation_authorized",
    "migration_authorized", "production_authorized", "release_authorized",
    "runtime_admission_authorized", "schema_design_authorized"
  ], "E-LEDGER-AUTHORITY");
  ensure(Array.isArray(ledger.root_gate_evidence), "E-LEDGER-ROOT-GATE-TYPE");
  for (const item of ledger.root_gate_evidence) strictObject(item, ["closure_evidence_ready", "gate_id", "missing", "ready", "status"], "E-LEDGER-ROOT-GATE");
  strictObject(ledger.evidence_planes, ["canonical_registered_private_plane", "inspected_archive_candidate", "memphis_zoo_mcp_registration"], "E-LEDGER-EVIDENCE-PLANES");
  strictObject(ledger.evidence_planes.canonical_registered_private_plane, ["global_absence_proven", "locator", "locator_status", "system_wide_sequence_auditable"], "E-LEDGER-PRIVATE-PLANE");
  strictObject(ledger.evidence_planes.memphis_zoo_mcp_registration, ["allowed_repositories", "archive_candidate_registered", "default_repository"], "E-LEDGER-MCP");
  strictObject(ledger.evidence_planes.inspected_archive_candidate, [
    "admissibility", "admissible_joined_trace", "admissible_reverse_registry", "authorization_decisions",
    "current_head", "evidence_set_identities", "gate_events", "locator", "package_attestation",
    "package_history", "package_tree", "sequence_history"
  ], "E-LEDGER-ARCHIVE");
  strictObject(ledger.evidence_planes.inspected_archive_candidate.gate_events, ["CLOSE", "INVALIDATE", "REOPEN", "SUPERSEDE"], "E-LEDGER-GATE-EVENTS");
  strictObject(ledger.github, ["historic_failures", "pr_135", "repository", "visibility"], "E-LEDGER-GITHUB");
  strictObject(ledger.github.pr_135, ["binding_to_audit_head", "checks", "draft", "head", "mergeable", "state", "successful_checks"], "E-LEDGER-GITHUB-PR");
  ensure(Array.isArray(ledger.github.historic_failures), "E-LEDGER-GITHUB-HISTORY-TYPE");
  for (const item of ledger.github.historic_failures) strictObject(item, [
    "actual", "completed_at_utc", "conclusion", "created_at_utc", "disposition", "expected",
    "failed_jobs", "head", "job_ids", "root_cause", "run_id", "successful_jobs", "workflow"
  ], "E-LEDGER-GITHUB-FAILURE");
  strictObject(ledger.gmail, ["messages", "notification_tokens_published", "raw_mailbox_identifiers_published", "repository_visibility"], "E-LEDGER-GMAIL");
  ensure(Array.isArray(ledger.gmail.messages), "E-LEDGER-GMAIL-MESSAGES-TYPE");
  for (const item of ledger.gmail.messages) strictObject(item, [
    "disposition", "head", "labels", "message_id_sha256", "run_id", "thread_id_sha256",
    "thread_message_count", "timestamp_utc", "unread"
  ], "E-LEDGER-GMAIL-MESSAGE");
  strictObject(ledger.record_envelope, [
    "accepted_commit", "accepted_exit_status", "accepted_package_manifest_sha256", "accepted_result",
    "accepted_tree", "accepted_validation_result_sha256", "accepted_validator", "current_adversarial_result",
    "current_branch_changed_path", "current_branch_error_code", "current_branch_result", "data_failure"
  ], "E-LEDGER-RECORD");
  strictObject(ledger.phase2_stage_decision_governance, [
    "actual_canonical_schema", "canonical_authority", "canonical_stage_required_fields", "classification",
    "explicit_binding_to_canonical_stage_model", "missing_required_fields", "protocol",
    "protocol_occurrence_paths", "transition_validity"
  ], "E-LEDGER-PHASE2");
  strictObject(ledger.trace_audit, ["current_admissible_v43_joined_trace", "current_admissible_v43_reverse_registry", "global_absence_proven", "historical_candidate"], "E-LEDGER-TRACE");
  strictObject(ledger.trace_audit.historical_candidate, [
    "admissible", "ancestor_of_audit_head", "cap_rows", "claimed_status", "commit", "path",
    "record_types_resolving_in_record_registry", "reverse_registry_section_present", "synthetic_record_types", "unique_cap_ids"
  ], "E-LEDGER-TRACE-HISTORICAL");
  strictObject(ledger.earliest_invariant, [
    "earliest_active_foundation_commit", "earliest_active_foundation_invariant", "earliest_active_foundation_tree",
    "earliest_bounded_repository_v43_commit", "evaluated_surfaces", "invariant", "system_wide_commit", "system_wide_status"
  ], "E-LEDGER-EARLIEST");
  ensure(Array.isArray(ledger.earliest_invariant.evaluated_surfaces), "E-LEDGER-SURFACES-TYPE");
  for (const item of ledger.earliest_invariant.evaluated_surfaces) strictObject(item, ["commit", "finding", "scope"], "E-LEDGER-SURFACE");
}

function validateLedger(ledger) {
  validateLedgerShape(ledger);
  ensure(ledger.protocol === "CUSTODIAL_V43_ROOT_AUTHORITY_EVIDENCE_LEDGER_V2", "E-LEDGER-PROTOCOL");
  ensure(ledger.status === "PASS_EVIDENCE_PACKET_ONLY", "E-LEDGER-STATUS");
  ensure(ledger.hardening_scope_base === HARDENING_SCOPE_BASE, "E-LEDGER-SCOPE-BASE");
  ensure(ledger.audit_base_head === AUDIT_BASE && ledger.branch === BRANCH, "E-LEDGER-SOURCE");
  ensure(ledger.receipts.research_sha256 === "ed3ed38f67d2d3f0567b68e82cd1fc39d24cceee350f4e3284f3d9f11eac1d66", "E-LEDGER-RESEARCH-RECEIPT");
  ensure(ledger.receipts.revised_plan_audit_sha256 === "308f641b30aa22efccb7a81a47f11dc1b0c64d1e5ba0699649a35518dbb7d59e", "E-LEDGER-PLAN-RECEIPT");
  ensure(ledger.receipts.build_sha256 === null && ledger.receipts.build_receipt_status === "PRE_COMMIT_NONFINAL", "E-LEDGER-BUILD-NONFINAL");
  ensure(ledger.foundation_binding.activation_authorized === false && ledger.foundation_binding.closure_ready === false, "E-LEDGER-FOUNDATION-FALSE");
  exactJson(ledger.foundation_binding, {
    classification: "IMMUTABLE_SUCCESSOR_FOUNDATION_SOURCE", commit: FOUNDATION_SOURCE_COMMIT, tree: FOUNDATION_SOURCE_TREE,
    package_id: FOUNDATION_PACKAGE_ID, revision: FOUNDATION_REVISION,
    content_manifest_sha256: "5c5749486add2308a430de0145b02e1a19d5b4ba59cc875b5c48d47180f068c8",
    activation_authorized: false, closure_ready: false
  }, "E-LEDGER-FOUNDATION-IDENTITY");
  exactJson(ledger.execution_binding, {
    classification: "CURRENT_EXECUTION_AND_HARDENING_BASE", commit: HARDENING_SCOPE_BASE, tree: HARDENING_SCOPE_TREE,
    whole_system_quality_run: 31263611491
  }, "E-LEDGER-EXECUTION-IDENTITY");
  exactJson(ledger.predecessor_binding, {
    classification: "LAST_ACCEPTED_AUTHORITY_SOURCE_REBIND_TIP", commit: AUTHORITY_PREDECESSOR_COMMIT,
    tree: AUTHORITY_PREDECESSOR_TREE, package_manifest_sha256: AUTHORITY_PREDECESSOR_MANIFEST_SHA256
  }, "E-LEDGER-PREDECESSOR-IDENTITY");
  exactJson(ledger.downstream_rebinds, {
    record_registry_prerequisite: {
      classification: "SEPARATE_SUCCESSOR_REBIND_REQUIRED",
      direct_consumers: [
        "docs/audits/custodial-unified-v4-3-architecture/record-registry-prerequisite-evidence/artifact-dag-blocker.json",
        "docs/audits/custodial-unified-v4-3-architecture/record-registry-prerequisite-evidence/validate-record-registry-prerequisite.mjs"
      ],
      derived_package_consumer: "docs/audits/custodial-unified-v4-3-architecture/record-registry-prerequisite-evidence/package-manifest.json",
      reason: "direct consumers bind superseded foundation commit, tree, and content-manifest SHA-256; changed member bytes require a new package manifest"
    },
    trace_reverse_registry: {
      classification: "SEPARATE_LATER_STAGE_AFTER_PREREQUISITE_REBIND",
      artifact_ids: ["V43-OBJECT-REGISTRY", "V43-TRACE", "V43-REVERSE-REGISTRY"],
      current_state: "BLOCKED_NOT_MATERIALIZED",
      current_joined_trace_directory: "ABSENT_BY_DAG_DISCIPLINE"
    }
  }, "E-LEDGER-DOWNSTREAM-IDENTITY");
  for (const [field, value] of Object.entries(ledger.authority)) {
    if (field.endsWith("authorized") || field.endsWith("authored") || field === "architecture_closure") ensure(value === false, "E-LEDGER-AUTHORITY-FALSE", field);
  }
  ensure(ledger.authority.earliest_open_gate === "G-EVIDENCE-001", "E-LEDGER-EARLIEST-GATE");
  validateBindingArray(ledger.input_bindings, EXPECTED_INPUTS, "E-LEDGER-INPUT");
  validateBindingArray(ledger.protected_files, EXPECTED_PROTECTED, "E-LEDGER-PROTECTED");
  const registry = JSON.parse(readRegularFile(path.join(REPO, EXPECTED_INPUTS[0][0]), REPO, "E-LEDGER-GATE-REGISTRY").toString("utf8"));
  ensure(Array.isArray(registry.gates) && registry.gates.length === 39, "E-LEDGER-GATE-COUNT");
  ensure(registry.gates.every((gate) => gate.status === "OPEN"), "E-LEDGER-GATE-STATUS");
  const registryIds = registry.gates.map((gate) => gate.gate_id);
  unique(registryIds, "E-LEDGER-GATE-DUPLICATE");
  exactJson(ledger.open_gate_inventory, registryIds, "E-LEDGER-GATE-ORDER");
  ensure(ledger.open_gate_inventory.length === 39 && ledger.open_gate_inventory[0] === "G-EVIDENCE-001", "E-LEDGER-GATE-TRUTH");
  ensure(Array.isArray(ledger.root_gate_evidence) && ledger.root_gate_evidence.length === 2, "E-LEDGER-ROOT-GATE-COUNT");
  exactJson(ledger.root_gate_evidence.map((item) => item.gate_id), ["G-EVIDENCE-001", "G-TRACE-001"], "E-LEDGER-ROOT-GATE-ORDER");
  ensure(ledger.root_gate_evidence.every((item) => item.status === "OPEN" && item.closure_evidence_ready === false), "E-LEDGER-ROOT-GATE-OPEN");
  for (const [index, item] of ledger.root_gate_evidence.entries()) {
    ensure(Array.isArray(item.ready) && item.ready.every((value) => typeof value === "string"), "E-LEDGER-ROOT-GATE-READY-TYPE", item.gate_id);
    ensure(Array.isArray(item.missing) && item.missing.every((value) => typeof value === "string"), "E-LEDGER-ROOT-GATE-MISSING-TYPE", item.gate_id);
    exactJson(item.ready, EXPECTED_ROOT_GATE_EVIDENCE[index].ready, "E-LEDGER-ROOT-GATE-READY-VALUE", item.gate_id);
    exactJson(item.missing, EXPECTED_ROOT_GATE_EVIDENCE[index].missing, "E-LEDGER-ROOT-GATE-MISSING-VALUE", item.gate_id);
  }
  const privatePlane = ledger.evidence_planes.canonical_registered_private_plane;
  ensure(privatePlane.locator_status === "MISSING_NORMATIVE_LOCATOR" && privatePlane.locator === null && privatePlane.global_absence_proven === false && privatePlane.system_wide_sequence_auditable === false, "E-LEDGER-PRIVATE-PLANE-OPEN");
  ensure(ledger.evidence_planes.memphis_zoo_mcp_registration.archive_candidate_registered === false, "E-LEDGER-ARCHIVE-REGISTRATION");
  const archive = ledger.evidence_planes.inspected_archive_candidate;
  ensure(archive.admissibility === "UNREGISTERED_CANDIDATE_ONLY" && archive.package_attestation === "ABSENT", "E-LEDGER-ARCHIVE-ADMISSIBILITY");
  for (const field of ["evidence_set_identities", "authorization_decisions", "sequence_history"]) ensure(Array.isArray(archive[field]) && archive[field].length === 0, "E-LEDGER-ARCHIVE-AUTHORITY", field);
  for (const events of Object.values(archive.gate_events)) ensure(Array.isArray(events) && events.length === 0, "E-LEDGER-GATE-EVENTS-EMPTY");
  ensure(archive.admissible_joined_trace === "ABSENT" && archive.admissible_reverse_registry === "ABSENT", "E-LEDGER-ARCHIVE-TRACE");
  ensure(ledger.github.visibility === "PUBLIC" && ledger.github.pr_135.binding_to_audit_head === false, "E-LEDGER-GITHUB-BINDING");
  ensure(ledger.github.pr_135.successful_checks === ledger.github.pr_135.checks.length, "E-LEDGER-GITHUB-CHECK-COUNT");
  unique(ledger.github.pr_135.checks, "E-LEDGER-GITHUB-CHECK-DUPLICATE");
  ensure(ledger.github.historic_failures.length === 2 && ledger.github.historic_failures.every((item) => item.conclusion === "failure" && item.root_cause === "PINNED_PLAYWRIGHT_INSTALL_COUNT_MISMATCH" && item.actual === 0 && item.expected === 1), "E-LEDGER-GITHUB-HISTORY");
  ensure(ledger.gmail.repository_visibility === "PUBLIC" && ledger.gmail.raw_mailbox_identifiers_published === false && ledger.gmail.notification_tokens_published === false, "E-LEDGER-GMAIL-PRIVACY");
  ensure(ledger.gmail.messages.length === 2, "E-LEDGER-GMAIL-COUNT");
  for (const item of ledger.gmail.messages) ensure(HEX_64.test(item.message_id_sha256) && HEX_64.test(item.thread_id_sha256) && item.disposition === "RETAINED_UNMODIFIED", "E-LEDGER-GMAIL-HASHED");
  ensure(ledger.record_envelope.accepted_commit === RECORD_COMMIT && ledger.record_envelope.accepted_tree === RECORD_TREE, "E-LEDGER-RECORD-IDENTITY");
  ensure(ledger.record_envelope.accepted_validator === "CUSTODIAL_V43_RECORD_ENVELOPE_VALIDATOR_V3" && ledger.record_envelope.accepted_package_manifest_sha256 === RECORD_MANIFEST && ledger.record_envelope.accepted_validation_result_sha256 === RECORD_RESULT, "E-LEDGER-RECORD-RECEIPT");
  ensure(ledger.record_envelope.accepted_result === "PASS" && ledger.record_envelope.accepted_exit_status === 0 && ledger.record_envelope.data_failure === false, "E-LEDGER-RECORD-STATUS");
  ensure(ledger.phase2_stage_decision_governance.explicit_binding_to_canonical_stage_model === false && ledger.phase2_stage_decision_governance.canonical_authority === false, "E-LEDGER-PHASE2-FALSE");
  exactJson(ledger.phase2_stage_decision_governance.canonical_stage_required_fields, EXPECTED_STAGE_FIELDS, "E-LEDGER-PHASE2-CANONICAL-FIELDS");
  exactJson(ledger.phase2_stage_decision_governance.missing_required_fields, EXPECTED_STAGE_FIELDS, "E-LEDGER-PHASE2-MISSING");
  ensure(ledger.trace_audit.global_absence_proven === false, "E-LEDGER-TRACE-GLOBAL-ABSENCE");
  ensure(ledger.trace_audit.current_admissible_v43_joined_trace === "ABSENT_IN_INSPECTED_SURFACES" && ledger.trace_audit.current_admissible_v43_reverse_registry === "ABSENT_IN_INSPECTED_SURFACES", "E-LEDGER-TRACE-ABSENT");
  ensure(ledger.trace_audit.historical_candidate.admissible === false && ledger.trace_audit.historical_candidate.reverse_registry_section_present === false && ledger.trace_audit.historical_candidate.record_types_resolving_in_record_registry === 0, "E-LEDGER-HISTORICAL-TRACE");
  ensure(ledger.earliest_invariant.system_wide_status === "INDETERMINATE_MISSING_CANONICAL_PRIVATE_LOCATOR" && ledger.earliest_invariant.system_wide_commit === null, "E-LEDGER-EARLIEST-INVARIANT");
  ensure(Array.isArray(ledger.earliest_invariant.evaluated_surfaces) && ledger.earliest_invariant.evaluated_surfaces.length === 12, "E-LEDGER-SURFACE-COUNT");
  exactJson(ledger.assumptions, EXPECTED_ASSUMPTIONS, "E-LEDGER-ASSUMPTIONS");
  exactJson(ledger.blockers, EXPECTED_BLOCKERS, "E-LEDGER-BLOCKERS");
  ensure(sha256(Buffer.from(textJson(ledger))) === EXPECTED_LEDGER_SHA256, "E-LEDGER-EXACT-CONTENT");
}

const LEDGER_MUTATIONS = [
  ["top_array_not_object", "E-LEDGER-TYPE", () => []],
  ["top_extra_activation_authority", "E-LEDGER-FIELDS", (value) => { value.activation_authority = true; }],
  ["top_missing_authority", "E-LEDGER-FIELDS", (value) => { delete value.authority; }],
  ["research_receipt_drift", "E-LEDGER-RESEARCH-RECEIPT", (value) => { value.receipts.research_sha256 = "0".repeat(64); }],
  ["build_claimed_final", "E-LEDGER-BUILD-NONFINAL", (value) => { value.receipts.build_sha256 = "0".repeat(64); }],
  ["foundation_activation", "E-LEDGER-FOUNDATION-FALSE", (value) => { value.foundation_binding.activation_authorized = true; }],
  ["foundation_closure", "E-LEDGER-FOUNDATION-FALSE", (value) => { value.foundation_binding.closure_ready = true; }],
  ["authority_activation", "E-LEDGER-AUTHORITY-FALSE", (value) => { value.authority.activation_authorized = true; }],
  ["authority_architecture_closure", "E-LEDGER-AUTHORITY-FALSE", (value) => { value.authority.architecture_closure = true; }],
  ["authority_implementation", "E-LEDGER-AUTHORITY-FALSE", (value) => { value.authority.implementation_authorized = true; }],
  ["earliest_gate_laundered", "E-LEDGER-EARLIEST-GATE", (value) => { value.authority.earliest_open_gate = "G-TRACE-001"; }],
  ["input_path_escape", "E-LEDGER-INPUT-PATH-SCOPE", (value) => { value.input_bindings[0].path = "../escape"; }],
  ["input_duplicate", "E-LEDGER-INPUT-DUPLICATE", (value) => { value.input_bindings[1].path = value.input_bindings[0].path; }],
  ["input_missing", "E-LEDGER-INPUT-VALUE", (value) => { value.input_bindings.pop(); }],
  ["gate_order_drift", "E-LEDGER-GATE-ORDER", (value) => { value.open_gate_inventory.reverse(); }],
  ["gate_count_drift", "E-LEDGER-GATE-ORDER", (value) => { value.open_gate_inventory.pop(); }],
  ["root_gate_closed", "E-LEDGER-ROOT-GATE-OPEN", (value) => { value.root_gate_evidence[0].status = "CLOSED"; }],
  ["root_gate_closure_ready", "E-LEDGER-ROOT-GATE-OPEN", (value) => { value.root_gate_evidence[0].closure_evidence_ready = true; }],
  ["root_gate_ready_string", "E-LEDGER-ROOT-GATE-READY-TYPE", (value) => { value.root_gate_evidence[0].ready = "laundered"; }],
  ["root_gate_ready_content_drift", "E-LEDGER-ROOT-GATE-READY-VALUE", (value) => { value.root_gate_evidence[0].ready[0] = "invented readiness"; }],
  ["root_gate_missing_string", "E-LEDGER-ROOT-GATE-MISSING-TYPE", (value) => { value.root_gate_evidence[0].missing = "still truthy"; }],
  ["root_gate_missing_content_drift", "E-LEDGER-ROOT-GATE-MISSING-VALUE", (value) => { value.root_gate_evidence[1].missing[0] = "invented blocker"; }],
  ["private_locator_invented", "E-LEDGER-PRIVATE-PLANE-OPEN", (value) => { value.evidence_planes.canonical_registered_private_plane.locator = "invented"; }],
  ["global_absence_invented", "E-LEDGER-PRIVATE-PLANE-OPEN", (value) => { value.evidence_planes.canonical_registered_private_plane.global_absence_proven = true; }],
  ["archive_registered", "E-LEDGER-ARCHIVE-REGISTRATION", (value) => { value.evidence_planes.memphis_zoo_mcp_registration.archive_candidate_registered = true; }],
  ["archive_promoted", "E-LEDGER-ARCHIVE-ADMISSIBILITY", (value) => { value.evidence_planes.inspected_archive_candidate.admissibility = "CANONICAL"; }],
  ["gate_close_event_invented", "E-LEDGER-GATE-EVENTS-EMPTY", (value) => { value.evidence_planes.inspected_archive_candidate.gate_events.CLOSE.push({ gate_id: "G-EVIDENCE-001" }); }],
  ["github_binding_invented", "E-LEDGER-GITHUB-BINDING", (value) => { value.github.pr_135.binding_to_audit_head = true; }],
  ["gmail_raw_identifier", "E-LEDGER-GMAIL-MESSAGE-FIELDS", (value) => { value.gmail.messages[0].message_id = "private"; }],
  ["record_stale_commit", "E-LEDGER-RECORD-IDENTITY", (value) => { value.record_envelope.accepted_commit = "5c2e9308ba75d6c8f95e52783e05144392eae20c"; }],
  ["record_result_drift", "E-LEDGER-RECORD-RECEIPT", (value) => { value.record_envelope.accepted_validation_result_sha256 = "0".repeat(64); }],
  ["phase2_authority_escalated", "E-LEDGER-PHASE2-FALSE", (value) => { value.phase2_stage_decision_governance.canonical_authority = true; }],
  ["phase2_canonical_fields_laundered", "E-LEDGER-PHASE2-CANONICAL-FIELDS", (value) => { value.phase2_stage_decision_governance.canonical_stage_required_fields = ["decision_id"]; }],
  ["phase2_both_field_arrays_laundered", "E-LEDGER-PHASE2-CANONICAL-FIELDS", (value) => { value.phase2_stage_decision_governance.canonical_stage_required_fields = ["invented"]; value.phase2_stage_decision_governance.missing_required_fields = ["invented"]; }],
  ["trace_global_absence_claimed", "E-LEDGER-TRACE-GLOBAL-ABSENCE", (value) => { value.trace_audit.global_absence_proven = true; }],
  ["historical_trace_promoted", "E-LEDGER-HISTORICAL-TRACE", (value) => { value.trace_audit.historical_candidate.admissible = true; }],
  ["system_wide_commit_invented", "E-LEDGER-EARLIEST-INVARIANT", (value) => { value.earliest_invariant.system_wide_commit = AUDIT_BASE; }],
  ["assumption_content_drift", "E-LEDGER-ASSUMPTIONS", (value) => { value.assumptions[0] = "invented authority"; }],
  ["otherwise_unchecked_nested_content", "E-LEDGER-EXACT-CONTENT", (value) => { value.github.repository = "invented/repository"; }],
  ["blockers_laundered", "E-LEDGER-BLOCKERS", (value) => { value.blockers = []; }]
];

const CURRENT_CHECKS = [
  ["H05", "node tools/validate-custodial-v43-replan.mjs --check", "tools/validate-custodial-v43-replan.mjs", "--check", "PASS"],
  ["H05_EVIDENCE_ID_SELF_TEST", "node tools/validate-custodial-v43-replan.mjs --self-test", "tools/validate-custodial-v43-replan.mjs", "--self-test", "PASS"],
  ["CONTENT_MANIFEST_GENERATOR_CHECK", "node tools/generate-v43-content-manifest.mjs --check", "tools/generate-v43-content-manifest.mjs", "--check", "PASS"],
  ["CONTENT_MANIFEST_GENERATOR_SELF_TEST", "node tools/generate-v43-content-manifest.mjs --self-test", "tools/generate-v43-content-manifest.mjs", "--self-test", "PASS"],
  ["ARCHITECTURE_PROJECTIONS", "node docs/audits/custodial-unified-v4-3-architecture/generate-architecture-projections.mjs --check", "docs/audits/custodial-unified-v4-3-architecture/generate-architecture-projections.mjs", "--check", "PASS"],
  ["PHASE1_FOUNDATION", "node docs/audits/custodial-unified-v4-3-architecture/validate-architecture-foundation.mjs --check", "docs/audits/custodial-unified-v4-3-architecture/validate-architecture-foundation.mjs", "--check", "PASS"],
  ["PHASE2_OPERATIONAL", "node docs/audits/custodial-unified-v4-3-architecture/phase2-operational-architecture/validate-phase2-operational-architecture.mjs --check", "docs/audits/custodial-unified-v4-3-architecture/phase2-operational-architecture/validate-phase2-operational-architecture.mjs", "--check", "PASS_ARCHITECTURE_ONLY"],
  ["PHASE2_REVIEW", "node docs/audits/custodial-unified-v4-3-architecture/phase2-operational-architecture/validate-phase2-review.mjs --check", "docs/audits/custodial-unified-v4-3-architecture/phase2-operational-architecture/validate-phase2-review.mjs", "--check", "PASS_ARCHITECTURE_ONLY"]
];
const DEPENDENCY_CONFIGS = [
  ["RECORD_ENVELOPE_HISTORICAL_ACCEPTED", HISTORICAL_RECORD_COMMIT, HISTORICAL_RECORD_TREE, "docs/audits/custodial-unified-v4-3-architecture/record-envelope-canonicalization/validate-record-envelope-canonicalization.mjs", "--check", "PASS", HISTORICAL_RECORD_MANIFEST, null],
  ["RECORD_ENVELOPE_CANONICAL_ACCEPTED", RECORD_COMMIT, RECORD_TREE, "docs/audits/custodial-unified-v4-3-architecture/record-envelope-canonicalization/validate-record-envelope-canonicalization.mjs", "--check", "PASS", RECORD_MANIFEST, RECORD_RESULT],
  ["RECORD_ENVELOPE_ADVERSARIAL_ACCEPTED", RECORD_COMMIT, RECORD_TREE, "docs/audits/custodial-unified-v4-3-architecture/record-envelope-canonicalization/validate-record-envelope-adversarial-v2.mjs", "--check", "PASS", RECORD_MANIFEST, RECORD_RESULT],
  ["AUTHORITY_GENERATOR_CHECK_ACCEPTED", AUTHORITY_COMMIT, AUTHORITY_TREE, "docs/audits/custodial-unified-v4-3-architecture/authority-schema-component-gate/generate-authority-schema-component.mjs", "--check", "PASS", AUTHORITY_MANIFEST, AUTHORITY_RESULT],
  ["AUTHORITY_GENERATOR_RESTART_ACCEPTED", AUTHORITY_COMMIT, AUTHORITY_TREE, "docs/audits/custodial-unified-v4-3-architecture/authority-schema-component-gate/generate-authority-schema-component.mjs", "--self-test-restart", "PASS", AUTHORITY_MANIFEST, AUTHORITY_RESULT],
  ["AUTHORITY_VALIDATOR_CHECK_ACCEPTED", AUTHORITY_COMMIT, AUTHORITY_TREE, "docs/audits/custodial-unified-v4-3-architecture/authority-schema-component-gate/validate-authority-schema-component.mjs", "--check", "PASS_NON_ACTIVATABLE", AUTHORITY_MANIFEST, AUTHORITY_RESULT],
  ["AUTHORITY_VALIDATOR_MANIFEST_ACCEPTED", AUTHORITY_COMMIT, AUTHORITY_TREE, "docs/audits/custodial-unified-v4-3-architecture/authority-schema-component-gate/validate-authority-schema-component.mjs", "--check-package-manifest", "PASS_EXACT_DETERMINISTIC_BYTES", AUTHORITY_MANIFEST, AUTHORITY_RESULT]
].map(([id, commit, tree, script, argument, status, packageManifest, validationResult]) => ({ id, commit, tree, script, argument, status, packageManifest, validationResult }));
const EXPECTED_STABLE_SHA256 = new Map([
  ["H05", "b74811f6bedcd254959096e3d08194ccbe0305a832650f1fc483dbfd0b05ac9e"],
  ["H05_EVIDENCE_ID_SELF_TEST", "f2005639822c35b3b5f02442fe1c59b9691ce95e8f9845157ba91dcdf2c2398f"],
  ["CONTENT_MANIFEST_GENERATOR_CHECK", "a9cfb516f094da14839812719bbddf7b8fe55a68b71276fd8e45d6a3881ba638"],
  ["CONTENT_MANIFEST_GENERATOR_SELF_TEST", "a18b9e4bb36ad033f3f65426f1c8d0f54f19e5bebf295fe64c1bf3ce57faa870"],
  ["ARCHITECTURE_PROJECTIONS", "f0aa3c8db7a96d46125a00ff4b12c09d2484c70a4c5a09d663ec5e1037781bd7"],
  ["PHASE1_FOUNDATION", "3e9369431a40f31fcdafe8d12e6a9abc2d65d5cafb1a04e46f4fd5d98542b5ac"],
  ["PHASE2_OPERATIONAL", "a64831973905f8fa1b82f0922c9f1ecf05c7cd3e1b7f849048d2904b37e7f943"],
  ["PHASE2_REVIEW", "f6a9e737beb424347753cef863474e4c4632fbbba8ac0b10c13f31bb7e83f339"],
  ["RECORD_ENVELOPE_HISTORICAL_ACCEPTED", "c433bf177b4e8086bb3d4bca7e58dc3ae446f7fd40637ea513b210bd1086d5c5"],
  ["RECORD_ENVELOPE_CANONICAL_ACCEPTED", "a2987c49d1042f98095fb589a10d06173749ed5e2f4e9011845ead1d89a88acd"],
  ["RECORD_ENVELOPE_ADVERSARIAL_ACCEPTED", "4e84097508bda3a68e2037f71e5cea506035d8d1e3ead1cc45a7bcc4192122f8"],
  ["AUTHORITY_GENERATOR_CHECK_ACCEPTED", "96fe65a33822689e6864fc4aea4c08ac34084b7c8ef2affa06ef917f1102ffe1"],
  ["AUTHORITY_GENERATOR_RESTART_ACCEPTED", "21bf3f7ca4e58deec0d687ea00183192b198d6c928e2231171e0f4f881297356"],
  ["AUTHORITY_VALIDATOR_CHECK_ACCEPTED", "3ae6b69698f356f9c398ddc4797941afc3397620eb1ca25c2eadad476663a553"],
  ["AUTHORITY_VALIDATOR_MANIFEST_ACCEPTED", "fbb0fcc80cbba3711ca03ae4a159c2263bd2b54dd3ceaef02cc491bb62f73c6f"]
]);
const EXTERNAL_READS = [
  { id: "PR135_CURRENT", interface: "GitHub CLI/API", status: "OPEN_DRAFT", head: "26a996fddf70aabff6ab2a526a16425526137e3b", successful_checks: 9, binding_to_audit_head: false },
  { id: "GITHUB_HISTORIC_FAILURES", interface: "GitHub Actions run/job API", run_ids: [31087372296, 31087372426], head: "8e53038f9e5d5146b1dd8260614de30cb9be4553", conclusion: "failure", assertion: "custodial-simple-v23-builder.yml:repair-audit-findings must run exactly one pinned Playwright Chromium install", actual: 0, expected: 1 },
  { id: "GMAIL_HISTORIC_FAILURES", interface: "Gmail connector", matched_messages: 2, state: "UNREAD_INBOX_RETAINED_UNMODIFIED", raw_mailbox_identifiers_published: false }
];
const activeProcessGroups = new Set();
let pendingLifecycleSignal = null;
let lifecycleCleanupInProgress = false;
let lifecycleLockHandle = null;

function lifecycleSignalHandler(signal) {
  if (pendingLifecycleSignal === null) pendingLifecycleSignal = signal;
  process.exitCode = pendingLifecycleSignal === "SIGINT" ? 130 : 143;
  for (const processGroup of activeProcessGroups) {
    try { process.kill(-processGroup, "SIGTERM"); } catch {}
  }
  const forcedKill = setTimeout(() => {
    for (const processGroup of activeProcessGroups) {
      try { process.kill(-processGroup, "SIGKILL"); } catch {}
    }
  }, 250);
  forcedKill.unref();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => lifecycleSignalHandler(signal));

function ensureNoPendingLifecycleSignal(code) {
  ensure(pendingLifecycleSignal === null, code, pendingLifecycleSignal);
}

async function lifecycleSignalBoundary(code) {
  await new Promise((resolve) => setImmediate(resolve));
  ensureNoPendingLifecycleSignal(code);
}

function parseCommandOutput(stdout, id) {
  const value = stdout.trim();
  ensure(value.length > 0, "E-COMMAND-EMPTY-OUTPUT", id);
  try {
    return JSON.parse(value);
  } catch {
    fail("E-COMMAND-NONJSON-OUTPUT", id);
  }
}

function minimalChildEnvironment() {
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    TZ: "UTC",
    NO_COLOR: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0"
  };
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function runBounded(executable, args, { cwd, timeoutMs = CHILD_TIMEOUT_MS, stderrPolicy = "EMPTY", outputLimitBytes = 64 * 1024 * 1024 }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env: minimalChildEnvironment(), detached: true, stdio: ["ignore", "pipe", "pipe"] });
    if (Number.isInteger(child.pid)) activeProcessGroups.add(child.pid);
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let overflow = false;
    let settlementStarted = false;
    let timeout = null;
    let delayedKill = null;
    let delayedKillFired = false;
    const append = (chunks, chunk, current) => {
      const next = current + chunk.length;
      if (next > outputLimitBytes) {
        overflow = true;
        try { process.kill(-child.pid, "SIGKILL"); } catch {}
      } else chunks.push(chunk);
      return next;
    };
    child.stdout.on("data", (chunk) => { stdoutBytes = append(stdout, chunk, stdoutBytes); });
    child.stderr.on("data", (chunk) => { stderrBytes = append(stderr, chunk, stderrBytes); });
    const clearTimers = () => {
      clearTimeout(timeout);
      if (delayedKill !== null) clearTimeout(delayedKill);
      delayedKill = null;
    };
    const cleanProcessGroup = async () => {
      if (!Number.isInteger(child.pid)) return { detected: false, residue: false };
      let detected = false;
      try {
        process.kill(-child.pid, 0);
        detected = true;
        process.kill(-child.pid, "SIGKILL");
      } catch {}
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try { process.kill(-child.pid, 0); await delay(25); } catch { activeProcessGroups.delete(child.pid); return { detected, residue: false }; }
      }
      activeProcessGroups.delete(child.pid);
      return { detected, residue: true };
    };
    const settleAsync = (action) => {
      if (settlementStarted) return;
      settlementStarted = true;
      void (async () => {
        try {
          await action();
        } catch (error) {
          reject(error);
        }
      })();
    };
    child.on("error", (spawnError) => settleAsync(async () => {
      clearTimers();
      const cleanup = await cleanProcessGroup();
      ensure(!cleanup.residue, "E-CHILD-SPAWN-ERROR-RESIDUE", executable);
      throw spawnError;
    }));
    timeout = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, "SIGTERM"); } catch {}
      delayedKill = setTimeout(() => {
        delayedKillFired = true;
        try { process.kill(-child.pid, "SIGKILL"); } catch {}
      }, 250);
      delayedKill.unref();
    }, timeoutMs);
    child.on("close", (status, signal) => settleAsync(async () => {
      clearTimers();
      const cleanup = await cleanProcessGroup();
      const orphanDetected = cleanup.detected && !timedOut;
      const residue = cleanup.residue;
      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");
      const canaries = Object.entries(process.env).filter(([key, value]) => /SECRET|TOKEN|FAULT|INJECT/i.test(key) && value).map(([, value]) => value);
      ensure(canaries.every((value) => !stdoutText.includes(value) && !stderrText.includes(value)), "E-CHILD-SECRET-CANARY");
      ensure(!overflow, "E-CHILD-OUTPUT-LIMIT");
      ensure(!residue, "E-CHILD-PROCESS-RESIDUE", executable);
      ensure(!orphanDetected, "E-CHILD-ORPHAN-GRANDCHILD", executable);
      ensure(pendingLifecycleSignal === null || lifecycleCleanupInProgress, "E-LIFECYCLE-SIGNAL", pendingLifecycleSignal);
      if (stderrPolicy === "EMPTY") ensure(stderrText.trim() === "", "E-COMMAND-STDERR", stderrText.trim());
      if (timedOut) {
        const error = new ValidationError("E-CHILD-TIMEOUT", executable);
        error.delayedKillCleared = delayedKill === null;
        error.delayedKillFired = delayedKillFired;
        throw error;
      }
      resolve({ status, signal, stdout: stdoutText, stderr: stderrText, timedOut, orphanDetected, processCleanup: "PASS", delayedKillCleared: delayedKill === null });
    }));
  });
}

async function validateProcessLifecycleMutations() {
  const evidence = [];
  const expectPromptRejection = async (action, expectedCode, maximumMilliseconds = 5000) => {
    const started = Date.now();
    let caught = null;
    try { await action(); } catch (error) { caught = error; }
    ensure(caught?.code === expectedCode, "E-PROCESS-REJECTION-CODE", `${expectedCode}:${caught?.code ?? caught?.message}`);
    ensure(Date.now() - started < maximumMilliseconds, "E-PROCESS-REJECTION-HANG", expectedCode);
    return caught;
  };

  const contended = await runBounded(process.execPath, [fileURLToPath(import.meta.url), "--check-package-manifest"], {
    cwd: REPO, timeoutMs: 5000, stderrPolicy: "ALLOW"
  });
  ensure(contended.status === 1 && contended.signal === null && contended.stderr.includes("E-LIFECYCLE-LOCK-BUSY"), "E-LIFECYCLE-LOCK-CONTENTION-PROOF", contended.stderr.trim());
  evidence.push({ name: "concurrent_check_write_lifecycle_lock", error: "E-LIFECYCLE-LOCK-BUSY", recovery: "PASS" });

  const lateSignal = await runBounded(process.execPath, [fileURLToPath(import.meta.url), "--self-test-late-signal"], {
    cwd: REPO, timeoutMs: 5000, stderrPolicy: "ALLOW"
  });
  ensure(lateSignal.status === 143 && lateSignal.signal === null && lateSignal.stdout.trim() === "" && lateSignal.stderr.includes("E-LIFECYCLE-SIGNAL-LATE-SELF-TEST"), "E-LIFECYCLE-LATE-SIGNAL-PROOF", `${lateSignal.status}:${lateSignal.signal}:${lateSignal.stdout}:${lateSignal.stderr}`);
  evidence.push({ name: "late_signal_suppresses_pass_and_exits_143", error: "E-LIFECYCLE-SIGNAL-LATE-SELF-TEST", recovery: "PASS" });

  await expectPromptRejection(
    () => runBounded(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { cwd: REPO, timeoutMs: 150, stderrPolicy: "EMPTY" }),
    "E-CHILD-TIMEOUT"
  );
  evidence.push({ name: "timeout_process_group", error: "E-CHILD-TIMEOUT", recovery: "PASS" });

  const cleanTermError = await expectPromptRejection(
    () => runBounded(process.execPath, ["-e", "process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000)"], { cwd: REPO, timeoutMs: 300, stderrPolicy: "EMPTY" }),
    "E-CHILD-TIMEOUT"
  );
  ensure(cleanTermError.delayedKillCleared === true && cleanTermError.delayedKillFired === false, "E-PROCESS-TERM-DELAYED-KILL");
  await delay(400);
  evidence.push({ name: "term_exits_without_delayed_kill", error: "E-CHILD-TIMEOUT", recovery: "PASS" });

  const orphanScript = "require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}).unref();";
  await expectPromptRejection(
    () => runBounded(process.execPath, ["-e", orphanScript], { cwd: REPO, timeoutMs: 2000, stderrPolicy: "EMPTY" }),
    "E-CHILD-ORPHAN-GRANDCHILD"
  );
  evidence.push({ name: "orphan_grandchild", error: "E-CHILD-ORPHAN-GRANDCHILD", recovery: "PASS" });

  let spawnError = null;
  try { await runBounded("/definitely/not/a/custodial-command", [], { cwd: REPO, timeoutMs: 150, stderrPolicy: "EMPTY" }); } catch (error) { spawnError = error; }
  ensure(spawnError?.code === "ENOENT", "E-PROCESS-SPAWN-ERROR-PROOF", spawnError?.code);
  await delay(300);
  evidence.push({ name: "spawn_error_cleanup", error: "ENOENT", recovery: "PASS" });

  const previousCanary = process.env.CUSTODIAL_SECRET_CANARY;
  process.env.CUSTODIAL_SECRET_CANARY = "custodial-secret-canary-must-not-leak";
  try {
    const canaryRun = await runBounded(process.execPath, ["-e", "process.stdout.write(JSON.stringify({present:Object.hasOwn(process.env,'CUSTODIAL_SECRET_CANARY')}))"], { cwd: REPO, timeoutMs: 2000, stderrPolicy: "EMPTY" });
    ensure(canaryRun.status === 0 && canaryRun.stdout === '{"present":false}' && !canaryRun.orphanDetected, "E-PROCESS-CANARY-PROOF");
  } finally {
    if (previousCanary === undefined) delete process.env.CUSTODIAL_SECRET_CANARY;
    else process.env.CUSTODIAL_SECRET_CANARY = previousCanary;
  }
  evidence.push({ name: "secret_and_fault_environment_canary", error: "E-CHILD-SECRET-CANARY", recovery: "PASS" });

  await expectPromptRejection(
    () => runBounded(process.execPath, ["-e", "process.stderr.write('forbidden-stderr\\n')"], { cwd: REPO, timeoutMs: 2000, stderrPolicy: "EMPTY" }),
    "E-COMMAND-STDERR"
  );
  evidence.push({ name: "nonempty_stderr_prompt_rejection", error: "E-COMMAND-STDERR", recovery: "PASS" });

  await expectPromptRejection(
    () => runBounded(process.execPath, ["-e", "process.stdout.write('x'.repeat(4096))"], { cwd: REPO, timeoutMs: 2000, stderrPolicy: "EMPTY", outputLimitBytes: 1024 }),
    "E-CHILD-OUTPUT-LIMIT"
  );
  evidence.push({ name: "output_limit_prompt_rejection", error: "E-CHILD-OUTPUT-LIMIT", recovery: "PASS" });

  const previousOutputCanary = process.env.CUSTODIAL_OUTPUT_SECRET_CANARY;
  process.env.CUSTODIAL_OUTPUT_SECRET_CANARY = "custodial-output-canary-must-be-rejected";
  try {
    await expectPromptRejection(
      () => runBounded(process.execPath, ["-e", "process.stdout.write('custodial-output-canary-must-be-rejected')"], { cwd: REPO, timeoutMs: 2000, stderrPolicy: "EMPTY" }),
      "E-CHILD-SECRET-CANARY"
    );
  } finally {
    if (previousOutputCanary === undefined) delete process.env.CUSTODIAL_OUTPUT_SECRET_CANARY;
    else process.env.CUSTODIAL_OUTPUT_SECRET_CANARY = previousOutputCanary;
  }
  evidence.push({ name: "canary_output_prompt_rejection", error: "E-CHILD-SECRET-CANARY", recovery: "PASS" });
  return evidence;
}

function strictStableResult(id, parsed) {
  const exactKeys = (fields) => strictObject(parsed, fields, `E-COMMAND-${id}-RESULT`);
  if (id === "H05") {
    exactKeys(["checks", "checks_failed", "checks_passed", "checks_total", "content_sha256", "generated_at_utc", "protocol", "status"]);
    strictObject(parsed.content_sha256, ["authority", "closure", "dag", "domains", "gates", "manifest", "occurrence", "projection", "schemas", "security", "stage"], "E-COMMAND-H05-CONTENT");
    ensure(parsed.protocol === "CUSTODIAL_V432_H05_VALIDATION_V3", "E-COMMAND-H05-PROTOCOL");
    ensure(parsed.checks_total === 111 && parsed.checks_passed === 111 && parsed.checks_failed === 0, "E-COMMAND-H05-COUNT");
    ensure(Array.isArray(parsed.checks) && parsed.checks.length === 111, "E-COMMAND-H05-CHECKS");
    for (const check of parsed.checks) strictObject(check, ["detail", "id", "status"], "E-COMMAND-H05-CHECK");
    unique(parsed.checks.map((check) => check.id), "E-COMMAND-H05-CHECK-DUPLICATE");
    ensure(parsed.checks.every((check) => check.status === "PASS" && typeof check.detail === "string"), "E-COMMAND-H05-CHECK-STATUS");
    ensure(parsed.checks.some((check) => check.id === "H05-EVIDENCE-ID-UNIQUE"), "E-COMMAND-H05-UNIQUE-PROOF");
    const { generated_at_utc: omitted, ...stable } = parsed;
    ensure(typeof omitted === "string", "E-COMMAND-H05-TIMESTAMP");
    return { stable, omitted: ["generated_at_utc"] };
  }
  if (id === "H05_EVIDENCE_ID_SELF_TEST") {
    exactKeys(["activation_authorized", "protocol", "status", "test_id", "tests"]);
    strictObject(parsed.tests, ["duplicate_rejection", "failed_completion", "guard_collision"], "E-COMMAND-H05-SELF-TESTS");
    ensure(parsed.protocol === "CUSTODIAL_V432_H05_EVIDENCE_ID_SELF_TEST_V1" && parsed.test_id === "H05-EVIDENCE-ID-DUPLICATE-REJECT", "E-COMMAND-H05-SELF-TEST-IDENTITY");
    ensure(parsed.activation_authorized === false && Object.values(parsed.tests).every((value) => value === "PASS"), "E-COMMAND-H05-SELF-TEST-VALUE");
  }
  else if (id.startsWith("CONTENT_MANIFEST_")) {
    exactKeys(["activation_authorized", "manifest_sha256", "members", "mode", "protocol", "self_tests", "status"]);
    ensure(parsed.activation_authorized === false && HEX_64.test(parsed.manifest_sha256) && Number.isSafeInteger(parsed.members) && Number.isSafeInteger(parsed.self_tests), `E-COMMAND-${id}-VALUES`);
  }
  else if (id === "ARCHITECTURE_PROJECTIONS") exactKeys(["entries", "generator", "status"]);
  else if (id === "PHASE1_FOUNDATION") {
    exactKeys(["counts", "status", "validator"]);
    strictObject(parsed.counts, ["architecture_objects", "checks", "direct_schema_mutations", "gates_research", "grants", "principals", "record_contracts", "retirement_surfaces", "semantic_negative_fixtures", "tools"], "E-COMMAND-PHASE1-COUNTS");
  }
  else if (id === "PHASE2_OPERATIONAL") {
    exactKeys(["authority_closed", "authority_opened", "behavior", "closure", "head_binding", "mutation_tests", "protocol", "status"]);
    strictObject(parsed.closure, ["commands", "fixtures", "proofs", "retirements", "state_machines", "surfaces", "transitions"], "E-COMMAND-PHASE2-CLOSURE");
    strictObject(parsed.behavior, ["failures", "normal", "recoveries", "replay"], "E-COMMAND-PHASE2-BEHAVIOR");
    ensure(Array.isArray(parsed.authority_opened) && Array.isArray(parsed.authority_closed), "E-COMMAND-PHASE2-AUTHORITY-TYPE");
  }
  else if (id === "PHASE2_REVIEW") {
    exactKeys(["expected", "head_binding", "protocol", "status"]);
    strictObject(parsed.expected, ["commands", "failures", "fixtures", "mutation_tests", "normal", "proofs", "recoveries", "replay", "retirements", "state_machines", "surfaces", "transitions"], "E-COMMAND-PHASE2-REVIEW-EXPECTED");
  }
  else if (id === "RECORD_ENVELOPE_HISTORICAL_ACCEPTED") {
    exactKeys(["canonical_contract", "canonical_record_sha256", "canonicalization_contract", "conditional_rule_count", "downstream_authority", "field_count", "member_sha256", "package_aggregate_sha256", "package_manifest_sha256", "protocol", "raw_json_attack_count", "record_profile_count", "schema_mutation_count", "semantic_attack_count", "source_base", "status", "validator"]);
    strictObject(parsed.downstream_authority, ["component_design_authorized", "implementation_authorized", "migration_authorized", "next_gate", "phase2_authorized", "release_authorized", "schema_design_authorized"], "E-COMMAND-HISTORICAL-AUTHORITY");
    strictObject(parsed.member_sha256, ["README.md", "conformance-fixtures.json", "record-envelope-contract.json", "record-envelope-contract.schema.json", "record-type-strengthening-map.json", "research-plan-audit-replan.md", "validate-record-envelope-adversarial-v2.mjs", "validate-record-envelope-canonicalization.mjs"], "E-COMMAND-HISTORICAL-MEMBERS");
  }
  else if (id === "RECORD_ENVELOPE_CANONICAL_ACCEPTED") {
    exactKeys(["canonical_contract", "canonical_record_sha256", "canonicalization_contract", "conditional_rule_count", "downstream_authority", "field_count", "filesystem_mutation_failures", "filesystem_recoveries", "hardening_scope_base", "manifest_semantic_mutation_failures", "manifest_semantic_recoveries", "member_sha256", "owned_test_residue", "package_aggregate_sha256", "package_manifest_sha256", "protocol", "raw_json_attack_count", "receipt_semantic_mutation_failures", "receipt_semantic_recoveries", "record_profile_count", "schema_mutation_count", "semantic_attack_count", "source_base", "status", "validator"]);
    strictObject(parsed.downstream_authority, ["component_design_authorized", "implementation_authorized", "migration_authorized", "next_gate", "phase2_authorized", "release_authorized", "schema_design_authorized"], "E-COMMAND-RECORD-AUTHORITY");
    strictObject(parsed.member_sha256, ["README.md", "conformance-fixtures.json", "record-envelope-contract.json", "record-envelope-contract.schema.json", "record-type-strengthening-map.json", "research-plan-audit-replan.md", "validate-record-envelope-adversarial-v2.mjs", "validate-record-envelope-canonicalization.mjs"], "E-COMMAND-RECORD-MEMBERS");
  }
  else if (id === "RECORD_ENVELOPE_ADVERSARIAL_ACCEPTED") {
    exactKeys(["adversarial_attack_count", "canonicalization_id", "conditional_branch_count", "contract_id", "downstream_authority", "envelope_field_count", "envelope_field_signature_sha256", "positive_fixture_count", "protocol", "source_base", "status", "validator"]);
    strictObject(parsed.downstream_authority, ["component_design_authorized", "implementation_authorized", "migration_authorized", "next_gate", "phase2_authorized", "release_authorized", "schema_design_authorized"], "E-COMMAND-ADVERSARIAL-AUTHORITY");
  }
  else if (id.startsWith("AUTHORITY_GENERATOR_")) exactKeys(["activation_authorized", "commands", "fail_closed_retirements", "protocol", "restart_recovery_test", "schemas", "source_surfaces", "state_machines", "status", "transitions"]);
  else if (id === "AUTHORITY_VALIDATOR_CHECK_ACCEPTED") {
    exactKeys(["activation_authorized", "architecture_closure", "behavior", "blockers", "closure", "earliest_open_gate", "filesystem_mutation_failures", "filesystem_recoveries", "generator_check", "generator_restart_self_test", "hardening_scope_base", "manifest_semantic_mutation_failures", "manifest_semantic_recoveries", "mutation_tests", "owned_test_residue", "package_aggregate_sha256", "package_manifest_sha256", "protocol", "receipt_semantic_mutation_failures", "receipt_semantic_recoveries", "source_head", "status", "validator"]);
    strictObject(parsed.closure, ["commands", "credential_classes", "interfaces", "journeys", "schemas", "source_surfaces", "state_machines", "transitions"], "E-COMMAND-AUTHORITY-CLOSURE");
    strictObject(parsed.behavior, ["expected_failures", "normal", "recoveries", "replay"], "E-COMMAND-AUTHORITY-BEHAVIOR");
    ensure(Array.isArray(parsed.blockers) && parsed.blockers.every((item) => typeof item === "string"), "E-COMMAND-AUTHORITY-BLOCKERS");
  }
  else if (id === "AUTHORITY_VALIDATOR_MANIFEST_ACCEPTED") {
    exactKeys(["filesystem_mutation_failures", "filesystem_mutations", "filesystem_recoveries", "manifest_members", "normal_validation_receipt_binding", "owned_test_residue", "package_directories", "package_files", "protocol", "receipt_mutations", "receipt_semantic_mutation_failures", "receipt_semantic_recoveries", "semantic_mutation_failures", "semantic_mutations", "semantic_recoveries", "status"]);
    for (const field of ["filesystem_mutations", "receipt_mutations", "semantic_mutations"]) ensure(Array.isArray(parsed[field]) && parsed[field].every((item) => typeof item === "string"), `E-COMMAND-AUTHORITY-MANIFEST-${field.toUpperCase()}`);
  }
  else fail("E-COMMAND-PROJECTION-ID", id);
  return { stable: parsed, omitted: [] };
}

function validatePersistedStableResult(id, stableResult, volatileFieldsOmitted) {
  ensure(stableResult && typeof stableResult === "object" && !Array.isArray(stableResult), "E-RECEIPT-STABLE-RESULT-TYPE", id);
  const expectedOmitted = id === "H05" ? ["generated_at_utc"] : [];
  exactJson(volatileFieldsOmitted, expectedOmitted, "E-RECEIPT-VOLATILE-FIELDS", id);
  const parsed = id === "H05" ? { ...stableResult, generated_at_utc: "OMITTED_BY_STABLE_PROJECTION" } : clone(stableResult);
  const projection = strictStableResult(id, parsed);
  exactJson(projection.stable, stableResult, "E-RECEIPT-STABLE-PROJECTION", id);
  exactJson(projection.omitted, expectedOmitted, "E-RECEIPT-STABLE-OMISSION", id);
  ensure(sha256(Buffer.from(textJson(stableResult))) === EXPECTED_STABLE_SHA256.get(id), "E-RECEIPT-STABLE-VALUE", id);
}

function proposedSourceIdentity() {
  const paths = [WORKFLOW, `${PACKAGE_PREFIX}README.md`, `${PACKAGE_PREFIX}evidence-ledger.json`, `${PACKAGE_PREFIX}validate-authority-evidence-gate.mjs`];
  const members = paths.map((memberPath) => {
    const bytes = readRegularFile(path.join(REPO, memberPath), REPO, "E-PROPOSED-SOURCE");
    return { path: memberPath, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const hash = crypto.createHash("sha256");
  hash.update("CUSTODIAL_V43_AUTHORITY_EVIDENCE_PROPOSED_SOURCE_SET_V1\0");
  for (const member of members) hash.update(`${member.path}\0${member.bytes}\0${member.sha256}\0`);
  return { state: "UNCOMMITTED_PRE_COMMIT_SOURCE_SET", commit: null, tree: null, members, aggregate_sha256: hash.digest("hex") };
}

async function executeReceiptCommand({ id, command, script, argument, expectedStatus, cwd, commit = null, tree = null, packageManifest = undefined, validationResult = undefined, sourceSetSha256 = null }) {
  const run = await runBounded(process.execPath, [path.join(cwd, script), argument], { cwd, timeoutMs: CHILD_TIMEOUT_MS, stderrPolicy: "EMPTY" });
  ensure(!run.timedOut, "E-COMMAND-TIMEOUT", id);
  ensure(!run.orphanDetected, "E-COMMAND-ORPHAN-GRANDCHILD", id);
  ensure(run.status === 0 && run.signal === null, "E-COMMAND-EXIT", `${id}:${run.status}:${run.signal}`);
  const parsed = parseCommandOutput(run.stdout, id);
  ensure(parsed.status === expectedStatus, "E-COMMAND-STATUS", `${id}:${parsed.status}`);
  const projection = strictStableResult(id, parsed);
  validatePersistedStableResult(id, projection.stable, projection.omitted);
  return {
    id,
    execution_scope: commit ? "ACCEPTED_DEPENDENCY_REPLAY" : "CURRENT_PROPOSED_SOURCE",
    checkout_commit: commit,
    checkout_tree: tree,
    source_set_sha256: sourceSetSha256,
    command,
    exit_status: run.status,
    signal: run.signal,
    timed_out: run.timedOut,
    timeout_ms: CHILD_TIMEOUT_MS,
    stderr_policy: "EMPTY",
    process_cleanup: run.processCleanup,
    status: parsed.status,
    stable_result: projection.stable,
    volatile_fields_omitted: projection.omitted,
    ...(packageManifest !== undefined ? { package_manifest_sha256: packageManifest, validation_result_sha256: validationResult } : {})
  };
}

async function executeCurrentChecks(sourceSet) {
  ensure(process.version === NODE_VERSION, "E-RUNTIME-NODE", process.version);
  const npmRun = await runBounded("npm", ["--version"], { cwd: REPO, timeoutMs: 10000, stderrPolicy: "EMPTY" });
  ensure(!npmRun.timedOut && !npmRun.orphanDetected && npmRun.status === 0 && npmRun.signal === null, "E-RUNTIME-NPM-PROCESS");
  ensure(npmRun.stdout.trim() === NPM_VERSION, "E-RUNTIME-NPM", npmRun.stdout.trim());
  const results = [];
  for (const [id, command, script, argument, expectedStatus] of CURRENT_CHECKS) results.push(await executeReceiptCommand({ id, command, script, argument, expectedStatus, cwd: REPO, sourceSetSha256: sourceSet.aggregate_sha256 }));
  return results;
}

function expectedCommandReceipt(checks, dependencyReplays, sourceSet) {
  return {
    protocol: "CUSTODIAL_V43_AUTHORITY_EVIDENCE_COMMAND_RECEIPTS_V2",
    hardening_scope_base: HARDENING_SCOPE_BASE,
    execution_base: { commit: HARDENING_SCOPE_BASE, tree: HARDENING_SCOPE_TREE },
    foundation_source: {
      commit: FOUNDATION_SOURCE_COMMIT,
      tree: FOUNDATION_SOURCE_TREE,
      package_id: FOUNDATION_PACKAGE_ID,
      revision: FOUNDATION_REVISION,
      content_manifest_sha256: "5c5749486add2308a430de0145b02e1a19d5b4ba59cc875b5c48d47180f068c8"
    },
    branch: BRANCH,
    runtime: { node: NODE_VERSION, npm: NPM_VERSION },
    proposed_source: sourceSet,
    checks,
    dependency_replays: dependencyReplays,
    external_reads: EXTERNAL_READS
  };
}

async function runGit(args, cwd = REPO, stderrPolicy = "ALLOW_PROGRESS") {
  const run = await runBounded("git", args, { cwd, timeoutMs: 30000, stderrPolicy });
  ensure(!run.timedOut, "E-GIT-TIMEOUT", args.join(" "));
  ensure(!run.orphanDetected, "E-GIT-ORPHAN", args.join(" "));
  ensure(run.status === 0 && run.signal === null, "E-GIT-EXIT", `${args.join(" ")}:${run.status}:${run.signal}:${run.stderr.trim()}`);
  return run.stdout;
}

function gitCommonDirectory() {
  const dotGit = path.join(REPO, ".git");
  const stat = fs.lstatSync(dotGit);
  if (stat.isDirectory()) return fs.realpathSync(dotGit);
  ensure(stat.isFile(), "E-DEPENDENCY-GITDIR-TYPE");
  const value = readRegularFile(dotGit, REPO, "E-DEPENDENCY-GITDIR").toString("utf8").trim();
  ensure(value.startsWith("gitdir: "), "E-DEPENDENCY-GITDIR-FORMAT");
  const gitDir = path.resolve(REPO, value.slice("gitdir: ".length));
  return fs.realpathSync(path.resolve(gitDir, "../.."));
}

function dependencyLockPath() {
  const common = gitCommonDirectory();
  return { common, lock: path.join(os.tmpdir(), `custodial-v43-authority-dependency-${sha256(common).slice(0, 24)}.lock`) };
}

function readDescriptorBytes(descriptor, code) {
  const before = fs.fstatSync(descriptor);
  ensure(before.isFile() && Number.isSafeInteger(before.size) && before.size >= 0, `${code}-TYPE`);
  const bytes = Buffer.alloc(before.size);
  let offset = 0;
  while (offset < bytes.length) {
    const count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
    ensure(count > 0, `${code}-SHORT-READ`);
    offset += count;
  }
  ensure(fs.readSync(descriptor, Buffer.alloc(1), 0, 1, offset) === 0, `${code}-GROWTH`);
  const after = fs.fstatSync(descriptor);
  ensure(before.dev === after.dev && before.ino === after.ino && before.mode === after.mode && before.size === after.size, `${code}-RACE`);
  return bytes;
}

function readDependencyLock(lock, common) {
  let directoryDescriptor;
  let ownerDescriptor;
  try {
    directoryDescriptor = fs.openSync(lock, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    const directoryStat = fs.fstatSync(directoryDescriptor);
    ensure(directoryStat.isDirectory(), "E-DEPENDENCY-LOCK-TYPE");
    exactJson(fs.readdirSync(`/proc/self/fd/${directoryDescriptor}`).sort(), ["owner.json"], "E-DEPENDENCY-LOCK-CLOSURE");
    ownerDescriptor = fs.openSync(`/proc/self/fd/${directoryDescriptor}/owner.json`, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    let owner;
    try { owner = JSON.parse(readDescriptorBytes(ownerDescriptor, "E-DEPENDENCY-LOCK-OWNER").toString("utf8")); }
    catch (error) {
      if (error instanceof SyntaxError) fail("E-DEPENDENCY-LOCK-OWNER-JSON");
      throw error;
    }
    strictObject(owner, ["boot_id_sha256", "common_git_dir_sha256", "hardening_scope_base", "nonce", "pid", "process_start_ticks", "protocol", "replay_root", "repository_scope_sha256", "worktrees"], "E-DEPENDENCY-LOCK-OWNER");
    ensure(owner.protocol === "CUSTODIAL_V43_AUTHORITY_DEPENDENCY_LOCK_V2", "E-DEPENDENCY-LOCK-OWNER-PROTOCOL");
    ensure(Number.isSafeInteger(owner.pid) && owner.pid > 0 && /^\d+$/.test(owner.process_start_ticks) && typeof owner.nonce === "string" && /^[0-9a-f]{48}$/.test(owner.nonce), "E-DEPENDENCY-LOCK-OWNER-TYPE");
    ensure(
      owner.common_git_dir_sha256 === sha256(common) && owner.hardening_scope_base === HARDENING_SCOPE_BASE &&
        owner.repository_scope_sha256 === sha256(REPO) && owner.boot_id_sha256 === lifecycleBootIdSha256(),
      "E-DEPENDENCY-LOCK-OWNER-MISMATCH"
    );
    const expectedRoot = path.join(os.tmpdir(), `custodial-v43-authority-replays-${owner.nonce}`);
    ensure(owner.replay_root === expectedRoot, "E-DEPENDENCY-LOCK-OWNER-ROOT");
    const uniqueCommits = [...new Set(DEPENDENCY_CONFIGS.map((item) => item.commit))];
    ensure(Array.isArray(owner.worktrees) && owner.worktrees.length === uniqueCommits.length, "E-DEPENDENCY-LOCK-OWNER-WORKTREES");
    exactJson(owner.worktrees, uniqueCommits.map((commit, index) => ({ commit, path: path.join(expectedRoot, `worktree-${index}`) })), "E-DEPENDENCY-LOCK-OWNER-WORKTREE-VALUE");
    return { owner, dev: directoryStat.dev, ino: directoryStat.ino };
  } catch (error) {
    if (error?.code === "ELOOP" || error?.code === "ENOTDIR") fail("E-DEPENDENCY-LOCK-SYMLINK", lock);
    throw error;
  } finally {
    if (ownerDescriptor !== undefined) fs.closeSync(ownerDescriptor);
    if (directoryDescriptor !== undefined) fs.closeSync(directoryDescriptor);
  }
}

function dependencyPidIsLive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

function dependencyOwnerIsLive(owner) {
  return owner.boot_id_sha256 === lifecycleBootIdSha256() && processStartTicks(owner.pid) === owner.process_start_ticks;
}

function removeDeadDependencyLock(lock, common, snapshot) {
  const current = readDependencyLock(lock, common);
  ensure(current.dev === snapshot.dev && current.ino === snapshot.ino && JSON.stringify(current.owner) === JSON.stringify(snapshot.owner), "E-DEPENDENCY-LOCK-RACE");
  ensure(!dependencyOwnerIsLive(current.owner), "E-DEPENDENCY-LOCK-BUSY", String(current.owner.pid));
  const inventory = spawnSync("git", ["worktree", "list", "--porcelain"], { cwd: REPO, env: minimalChildEnvironment(), encoding: "utf8" });
  ensure(inventory.status === 0 && inventory.signal === null, "E-DEPENDENCY-LOCK-STALE-INVENTORY", inventory.stderr?.trim());
  for (const worktree of current.owner.worktrees) {
    if (inventory.stdout.split("\n").includes(`worktree ${worktree.path}`)) {
      const removed = spawnSync("git", ["worktree", "remove", "--force", worktree.path], { cwd: REPO, env: minimalChildEnvironment(), encoding: "utf8" });
      ensure(removed.status === 0 && removed.signal === null, "E-DEPENDENCY-LOCK-STALE-WORKTREE", worktree.path);
    }
  }
  if (fs.existsSync(current.owner.replay_root)) removeOwned(current.owner.replay_root);
  fs.unlinkSync(path.join(lock, "owner.json"));
  fs.rmdirSync(lock);
  ensure(!fs.existsSync(lock), "E-DEPENDENCY-LOCK-STALE-RESIDUE");
}

function writeDependencyLockOwner(lock, owner) {
  const directoryDescriptor = fs.openSync(lock, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try {
    writeNewDescriptorLeaf(directoryDescriptor, "owner.json", Buffer.from(textJson(owner)), "E-DEPENDENCY-LOCK-CREATE");
    fs.fsyncSync(directoryDescriptor);
  } finally {
    fs.closeSync(directoryDescriptor);
  }
}

function acquireDependencyLock() {
  const { common, lock } = dependencyLockPath();
  let recoveredDeadOwner = false;
  try {
    fs.mkdirSync(lock, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const snapshot = readDependencyLock(lock, common);
    if (dependencyOwnerIsLive(snapshot.owner)) fail("E-DEPENDENCY-LOCK-BUSY", String(snapshot.owner.pid));
    removeDeadDependencyLock(lock, common, snapshot);
    recoveredDeadOwner = true;
    fs.mkdirSync(lock, { mode: 0o700 });
  }
  const nonce = crypto.randomBytes(24).toString("hex");
  const replayRoot = path.join(os.tmpdir(), `custodial-v43-authority-replays-${nonce}`);
  const owner = {
    protocol: "CUSTODIAL_V43_AUTHORITY_DEPENDENCY_LOCK_V2",
    pid: process.pid,
    process_start_ticks: processStartTicks(process.pid),
    boot_id_sha256: lifecycleBootIdSha256(),
    nonce,
    common_git_dir_sha256: sha256(common),
    hardening_scope_base: HARDENING_SCOPE_BASE,
    repository_scope_sha256: sha256(REPO),
    replay_root: replayRoot,
    worktrees: [...new Set(DEPENDENCY_CONFIGS.map((item) => item.commit))].map((commit, index) => ({ commit, path: path.join(replayRoot, `worktree-${index}`) }))
  };
  try {
    writeDependencyLockOwner(lock, owner);
  } catch (error) {
    try { fs.rmdirSync(lock); } catch {}
    throw error;
  }
  const snapshot = readDependencyLock(lock, common);
  exactJson(snapshot.owner, owner, "E-DEPENDENCY-LOCK-OWNER-VERIFY");
  return { lock, common, owner, dev: snapshot.dev, ino: snapshot.ino, recoveredDeadOwner };
}

function releaseDependencyLock(handle) {
  ensure(!fs.existsSync(handle.owner.replay_root), "E-DEPENDENCY-LOCK-REPLAY-ROOT-RESIDUE", handle.owner.replay_root);
  const current = readDependencyLock(handle.lock, handle.common);
  ensure(current.dev === handle.dev && current.ino === handle.ino, "E-DEPENDENCY-LOCK-RELEASE-RACE");
  exactJson(current.owner, handle.owner, "E-DEPENDENCY-LOCK-RELEASE-OWNER");
  fs.unlinkSync(path.join(handle.lock, "owner.json"));
  fs.rmdirSync(handle.lock);
  ensure(!fs.existsSync(handle.lock), "E-DEPENDENCY-LOCK-RESIDUE");
}

async function withDependencyLock(action) {
  const handle = acquireDependencyLock();
  try {
    return await action(handle);
  } finally {
    releaseDependencyLock(handle);
  }
}

async function executeDependencyReplays() {
  return await withDependencyLock(async (handle) => {
    let inventoryBefore = null;
    let ownedRoot = null;
    const results = [];
    let primaryError = null;
    let cleanupFailure = null;
    try {
      inventoryBefore = await runGit(["worktree", "list", "--porcelain"]);
      ownedRoot = handle.owner.replay_root;
      fs.mkdirSync(ownedRoot, { mode: 0o700 });
      for (const [commitIndex, commit] of [...new Set(DEPENDENCY_CONFIGS.map((item) => item.commit))].entries()) {
        const worktree = handle.owner.worktrees[commitIndex].path;
        ensure(handle.owner.worktrees[commitIndex].commit === commit, "E-DEPENDENCY-WORKTREE-REGISTRATION", commit);
        await runGit(["worktree", "add", "--detach", worktree, commit]);
        const configGroup = DEPENDENCY_CONFIGS.filter((item) => item.commit === commit);
        const actualCommit = (await runGit(["rev-parse", "HEAD"], worktree, "EMPTY")).trim();
        const actualTree = (await runGit(["rev-parse", "HEAD^{tree}"], worktree, "EMPTY")).trim();
        ensure(actualCommit === commit && actualTree === configGroup[0].tree, "E-DEPENDENCY-WORKTREE-IDENTITY", commit);
        for (const config of configGroup) {
          const command = `node ${config.script} ${config.argument}`;
          results.push(await executeReceiptCommand({
            id: config.id, command, script: config.script, argument: config.argument, expectedStatus: config.status,
            cwd: worktree, commit: config.commit, tree: config.tree,
            packageManifest: config.packageManifest, validationResult: config.validationResult
          }));
        }
        ensure((await runGit(["status", "--porcelain"], worktree, "EMPTY")).trim() === "", "E-DEPENDENCY-WORKTREE-DIRTY", commit);
        await runGit(["worktree", "remove", worktree]);
        ensure(!fs.existsSync(worktree), "E-DEPENDENCY-WORKTREE-RESIDUE", worktree);
      }
    } catch (error) {
      primaryError = error;
    } finally {
      const cleanupForSignal = pendingLifecycleSignal !== null;
      if (cleanupForSignal) lifecycleCleanupInProgress = true;
      for (const worktree of ownedRoot && fs.existsSync(ownedRoot) ? fs.readdirSync(ownedRoot).map((name) => path.join(ownedRoot, name)) : []) {
        try { await runGit(["worktree", "remove", "--force", worktree]); } catch (error) { cleanupFailure = error; }
      }
      try { if (ownedRoot && fs.existsSync(ownedRoot)) fs.rmdirSync(ownedRoot); } catch (error) { cleanupFailure = error; }
      if (inventoryBefore !== null) try {
          const inventoryAfter = await runGit(["worktree", "list", "--porcelain"]);
          const beforeBlocks = inventoryBefore.trim().split("\n\n").filter(Boolean);
          ensure(beforeBlocks.every((block) => inventoryAfter.includes(block)), "E-DEPENDENCY-WORKTREE-PREEXISTING-LOSS");
          ensure(handle.owner.worktrees.every((item) => !inventoryAfter.split("\n").includes(`worktree ${item.path}`)), "E-DEPENDENCY-WORKTREE-OWNED-RESIDUE");
        } catch (error) { cleanupFailure = error; }
      if (cleanupForSignal) lifecycleCleanupInProgress = false;
    }
    if (cleanupFailure) throw cleanupFailure;
    if (primaryError) throw primaryError;
    return results;
  });
}

async function validateDependencyLockMutations() {
  const { common, lock } = dependencyLockPath();
  const evidence = [];
  const ownerValue = (overrides = {}) => {
    const nonce = overrides.nonce ?? crypto.randomBytes(24).toString("hex");
    const replayRoot = path.join(os.tmpdir(), `custodial-v43-authority-replays-${nonce}`);
    return {
      protocol: "CUSTODIAL_V43_AUTHORITY_DEPENDENCY_LOCK_V2",
      pid: process.pid,
      process_start_ticks: processStartTicks(process.pid),
      boot_id_sha256: lifecycleBootIdSha256(),
      nonce,
      common_git_dir_sha256: sha256(common),
      hardening_scope_base: HARDENING_SCOPE_BASE,
      repository_scope_sha256: sha256(REPO),
      replay_root: replayRoot,
      worktrees: [...new Set(DEPENDENCY_CONFIGS.map((item) => item.commit))].map((commit, index) => ({ commit, path: path.join(replayRoot, `worktree-${index}`) })),
      ...overrides
    };
  };
  const createFixture = (content) => {
    ensure(!fs.existsSync(lock), "E-DEPENDENCY-LOCK-TEST-PREEXISTING");
    fs.mkdirSync(lock, { mode: 0o700 });
    const descriptor = fs.openSync(lock, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    try {
      writeNewDescriptorLeaf(descriptor, "owner.json", Buffer.from(typeof content === "string" ? content : textJson(content)), "E-DEPENDENCY-LOCK-TEST-FIXTURE");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  };
  const removeFixture = () => {
    if (!fs.existsSync(lock)) return;
    const descriptor = fs.openSync(lock, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    try {
      exactJson(fs.readdirSync(`/proc/self/fd/${descriptor}`), ["owner.json"], "E-DEPENDENCY-LOCK-TEST-CLOSURE");
      fs.unlinkSync(`/proc/self/fd/${descriptor}/owner.json`);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.rmdirSync(lock);
  };
  if (fs.existsSync(lock)) {
    const stale = readDependencyLock(lock, common);
    ensure(!dependencyOwnerIsLive(stale.owner), "E-DEPENDENCY-LOCK-BUSY", String(stale.owner.pid));
    removeDeadDependencyLock(lock, common, stale);
  }
  let injected = null;
  try {
    await withDependencyLock(async () => fail("E-DEPENDENCY-LOCK-INJECTED-AFTER-ACQUIRE"));
  } catch (error) { injected = error; }
  ensure(injected?.code === "E-DEPENDENCY-LOCK-INJECTED-AFTER-ACQUIRE" && !fs.existsSync(lock), "E-DEPENDENCY-LOCK-INJECTED-CLEANUP");
  evidence.push({ name: "failure_immediately_after_acquisition", error: "E-DEPENDENCY-LOCK-INJECTED-AFTER-ACQUIRE", recovery: "PASS" });

  const live = acquireDependencyLock();
  try {
    expectFailure(() => acquireDependencyLock(), "E-DEPENDENCY-LOCK-BUSY");
    exactJson(readDependencyLock(lock, common).owner, live.owner, "E-DEPENDENCY-LOCK-LIVE-PRESERVED");
  } finally {
    releaseDependencyLock(live);
  }
  evidence.push({ name: "live_owner_contention", error: "E-DEPENDENCY-LOCK-BUSY", recovery: "PASS" });

  let deadPid = 2147483647;
  while (deadPid > 2147483000 && dependencyPidIsLive(deadPid)) deadPid -= 1;
  ensure(!dependencyPidIsLive(deadPid), "E-DEPENDENCY-LOCK-DEAD-PID-FIXTURE");
  const deadOwner = ownerValue({ pid: deadPid, process_start_ticks: "0" });
  fs.mkdirSync(deadOwner.replay_root, { mode: 0o700 });
  fs.writeFileSync(path.join(deadOwner.replay_root, "owned-interrupted-residue"), "owned\n");
  createFixture(deadOwner);
  const recovered = acquireDependencyLock();
  ensure(recovered.recoveredDeadOwner === true && !fs.existsSync(deadOwner.replay_root), "E-DEPENDENCY-LOCK-DEAD-NOT-RECOVERED");
  releaseDependencyLock(recovered);
  evidence.push({ name: "strict_dead_owner_and_owned_residue_recovery", error: "E-DEPENDENCY-LOCK-STALE-DEAD", recovery: "PASS" });

  createFixture("{\n");
  expectFailure(() => acquireDependencyLock(), "E-DEPENDENCY-LOCK-OWNER-JSON");
  ensure(fs.existsSync(lock), "E-DEPENDENCY-LOCK-MALFORMED-DELETED");
  removeFixture();
  evidence.push({ name: "malformed_owner_fail_closed", error: "E-DEPENDENCY-LOCK-OWNER-JSON", recovery: "PASS" });

  createFixture(ownerValue({ hardening_scope_base: "0".repeat(40) }));
  expectFailure(() => acquireDependencyLock(), "E-DEPENDENCY-LOCK-OWNER-MISMATCH");
  ensure(fs.existsSync(lock), "E-DEPENDENCY-LOCK-MISMATCH-DELETED");
  removeFixture();
  evidence.push({ name: "mismatched_owner_fail_closed", error: "E-DEPENDENCY-LOCK-OWNER-MISMATCH", recovery: "PASS" });
  ensure(!fs.existsSync(lock), "E-DEPENDENCY-LOCK-TEST-RESIDUE");
  return evidence;
}

async function verifyDependencyObjects() {
  const foundationCommit = (await runGit(["rev-parse", `${FOUNDATION_SOURCE_COMMIT}^{commit}`], REPO, "EMPTY")).trim();
  const foundationTree = (await runGit(["rev-parse", `${FOUNDATION_SOURCE_COMMIT}^{tree}`], REPO, "EMPTY")).trim();
  ensure(foundationCommit === FOUNDATION_SOURCE_COMMIT && foundationTree === FOUNDATION_SOURCE_TREE, "E-RECEIPT-FOUNDATION-IDENTITY");
  const foundationObjects = [
    ["docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-content-manifest.json", "5c5749486add2308a430de0145b02e1a19d5b4ba59cc875b5c48d47180f068c8", "84a50e96efa97edd7cc316dc765c07c7229f327e"],
    ["tools/validate-custodial-v43-replan.mjs", "78acbbcdfc487a7b7f498c4dc920a5b004d4a6dd49b539e076171e46ef877a46", "72b59ba3bce878137bcd4f4ff429ce62ff631857"],
    ["tools/generate-v43-content-manifest.mjs", "7aabae15c079f4bba2edf8c3891a9f118874aa820b2d973ff38602064fe5597b", "bebad1a9fa05281d38bd253e2fff1fdd54c27b38"]
  ];
  for (const [file, expectedSha256, expectedBlob] of foundationObjects) {
    const bytes = Buffer.from(await runGit(["show", `${FOUNDATION_SOURCE_COMMIT}:${file}`], REPO, "EMPTY"), "utf8");
    const blob = (await runGit(["rev-parse", `${FOUNDATION_SOURCE_COMMIT}:${file}`], REPO, "EMPTY")).trim();
    ensure(sha256(bytes) === expectedSha256 && blob === expectedBlob, "E-RECEIPT-FOUNDATION-OBJECT", file);
  }
  const foundationDelta = (await runGit(["diff", "--name-only", `${FOUNDATION_SOURCE_COMMIT}..${HARDENING_SCOPE_BASE}`], REPO, "EMPTY")).trim().split("\n").filter(Boolean);
  exactJson(foundationDelta, ["package-lock.json"], "E-RECEIPT-FOUNDATION-EXECUTION-DELTA");
  for (const dependency of DEPENDENCY_CONFIGS) {
    const commit = (await runGit(["rev-parse", `${dependency.commit}^{commit}`], REPO, "EMPTY")).trim();
    const tree = (await runGit(["rev-parse", `${dependency.commit}^{tree}`], REPO, "EMPTY")).trim();
    ensure(commit === dependency.commit && tree === dependency.tree, "E-RECEIPT-DEPENDENCY-IDENTITY", dependency.id);
  }
  const gitBlobDigest = async (commit, file) => sha256(Buffer.from(await runGit(["show", `${commit}:${file}`], REPO, "EMPTY"), "utf8"));
  ensure(await gitBlobDigest(RECORD_COMMIT, `${PACKAGE_PREFIX.replace("authority-evidence-gate/", "record-envelope-canonicalization/")}package-manifest.json`) === RECORD_MANIFEST, "E-RECEIPT-DEPENDENCY-MANIFEST", "record");
  ensure(await gitBlobDigest(RECORD_COMMIT, `${PACKAGE_PREFIX.replace("authority-evidence-gate/", "record-envelope-canonicalization/")}validation-result.json`) === RECORD_RESULT, "E-RECEIPT-DEPENDENCY-RESULT", "record");
  ensure(await gitBlobDigest(AUTHORITY_COMMIT, `${PACKAGE_PREFIX.replace("authority-evidence-gate/", "authority-schema-component-gate/")}package-manifest.json`) === AUTHORITY_MANIFEST, "E-RECEIPT-DEPENDENCY-MANIFEST", "authority");
  ensure(await gitBlobDigest(AUTHORITY_COMMIT, `${PACKAGE_PREFIX.replace("authority-evidence-gate/", "authority-schema-component-gate/")}validation-result.json`) === AUTHORITY_RESULT, "E-RECEIPT-DEPENDENCY-RESULT", "authority");
  ensure(await gitBlobDigest(HISTORICAL_RECORD_COMMIT, `${PACKAGE_PREFIX.replace("authority-evidence-gate/", "record-envelope-canonicalization/")}package-manifest.json`) === HISTORICAL_RECORD_MANIFEST, "E-RECEIPT-DEPENDENCY-MANIFEST", "historical-record");
}

function validateCommandReceipt(receipt, expectedChecks, expectedDependencies, sourceSet) {
  strictObject(receipt, RECEIPT_FIELDS, "E-RECEIPT");
  ensure(receipt.protocol === "CUSTODIAL_V43_AUTHORITY_EVIDENCE_COMMAND_RECEIPTS_V2", "E-RECEIPT-PROTOCOL");
  ensure(receipt.hardening_scope_base === HARDENING_SCOPE_BASE && receipt.branch === BRANCH, "E-RECEIPT-SOURCE");
  exactJson(receipt.execution_base, { commit: HARDENING_SCOPE_BASE, tree: HARDENING_SCOPE_TREE }, "E-RECEIPT-EXECUTION-BASE");
  exactJson(receipt.foundation_source, {
    commit: FOUNDATION_SOURCE_COMMIT,
    tree: FOUNDATION_SOURCE_TREE,
    package_id: FOUNDATION_PACKAGE_ID,
    revision: FOUNDATION_REVISION,
    content_manifest_sha256: "5c5749486add2308a430de0145b02e1a19d5b4ba59cc875b5c48d47180f068c8"
  }, "E-RECEIPT-FOUNDATION-SOURCE");
  strictObject(receipt.runtime, ["node", "npm"], "E-RECEIPT-RUNTIME");
  exactJson(receipt.runtime, { node: NODE_VERSION, npm: NPM_VERSION }, "E-RECEIPT-RUNTIME-VALUE");
  strictObject(receipt.proposed_source, ["aggregate_sha256", "commit", "members", "state", "tree"], "E-RECEIPT-PROPOSED-SOURCE");
  exactJson(receipt.proposed_source, sourceSet, "E-RECEIPT-PROPOSED-SOURCE-VALUE");
  ensure(Array.isArray(receipt.checks) && receipt.checks.length === CURRENT_CHECKS.length, "E-RECEIPT-CHECK-COUNT");
  for (const check of receipt.checks) strictObject(check, CHECK_FIELDS, "E-RECEIPT-CHECK");
  unique(receipt.checks.map((item) => item.id), "E-RECEIPT-CHECK-DUPLICATE");
  exactJson(receipt.checks.map((item) => item.id), CURRENT_CHECKS.map((item) => item[0]), "E-RECEIPT-CHECK-ORDER");
  for (let index = 0; index < receipt.checks.length; index += 1) {
    const check = receipt.checks[index];
    const config = CURRENT_CHECKS[index];
    ensure(check.command === config[1], "E-RECEIPT-COMMAND", check.id);
    ensure(check.execution_scope === "CURRENT_PROPOSED_SOURCE" && check.checkout_commit === null && check.checkout_tree === null && check.source_set_sha256 === sourceSet.aggregate_sha256, "E-RECEIPT-CHECK-SOURCE", check.id);
    ensure(check.exit_status === 0 && check.status === config[4], "E-RECEIPT-STATUS", check.id);
    ensure(check.signal === null && check.timed_out === false && check.timeout_ms === CHILD_TIMEOUT_MS && check.stderr_policy === "EMPTY" && check.process_cleanup === "PASS", "E-RECEIPT-PROCESS", check.id);
    validatePersistedStableResult(check.id, check.stable_result, check.volatile_fields_omitted);
  }
  if (expectedChecks) exactJson(receipt.checks, expectedChecks, "E-RECEIPT-STALE-RESULT");
  ensure(Array.isArray(receipt.dependency_replays) && receipt.dependency_replays.length === DEPENDENCY_CONFIGS.length, "E-RECEIPT-DEPENDENCY-COUNT");
  for (const item of receipt.dependency_replays) strictObject(item, DEPENDENCY_FIELDS, "E-RECEIPT-DEPENDENCY");
  unique(receipt.dependency_replays.map((item) => item.id), "E-RECEIPT-DEPENDENCY-DUPLICATE");
  exactJson(receipt.dependency_replays.map((item) => item.id), DEPENDENCY_CONFIGS.map((item) => item.id), "E-RECEIPT-DEPENDENCY-ORDER");
  for (let index = 0; index < receipt.dependency_replays.length; index += 1) {
    const replay = receipt.dependency_replays[index];
    const config = DEPENDENCY_CONFIGS[index];
    ensure(replay.execution_scope === "ACCEPTED_DEPENDENCY_REPLAY" && replay.checkout_commit === config.commit && replay.checkout_tree === config.tree && replay.source_set_sha256 === null, "E-RECEIPT-DEPENDENCY-SOURCE", replay.id);
    ensure(replay.command === `node ${config.script} ${config.argument}` && replay.status === config.status && replay.exit_status === 0, "E-RECEIPT-DEPENDENCY-COMMAND", replay.id);
    ensure(replay.signal === null && replay.timed_out === false && replay.timeout_ms === CHILD_TIMEOUT_MS && replay.stderr_policy === "EMPTY" && replay.process_cleanup === "PASS", "E-RECEIPT-DEPENDENCY-PROCESS", replay.id);
    ensure(replay.package_manifest_sha256 === config.packageManifest && replay.validation_result_sha256 === config.validationResult, "E-RECEIPT-DEPENDENCY-IDENTITIES", replay.id);
    validatePersistedStableResult(replay.id, replay.stable_result, replay.volatile_fields_omitted);
  }
  if (expectedDependencies) exactJson(receipt.dependency_replays, expectedDependencies, "E-RECEIPT-DEPENDENCY-VALUE");
  const historical = receipt.dependency_replays[0].stable_result;
  ensure(
    historical.validator === "CUSTODIAL_V43_RECORD_ENVELOPE_VALIDATOR_V2" && historical.field_count === 53 &&
      historical.schema_mutation_count === 502 && historical.raw_json_attack_count === 3 && historical.semantic_attack_count === 19 &&
      historical.package_manifest_sha256 === HISTORICAL_RECORD_MANIFEST,
    "E-RECEIPT-HISTORICAL-RECORD"
  );
  exactJson(receipt.external_reads, EXTERNAL_READS, "E-RECEIPT-EXTERNAL-READS");
}

const RECEIPT_MUTATIONS = [
  ["top_array_not_object", "E-RECEIPT-TYPE", () => []],
  ["top_missing_runtime", "E-RECEIPT-FIELDS", (value) => { delete value.runtime; }],
  ["top_extra_activation", "E-RECEIPT-FIELDS", (value) => { value.activation_authorized = true; }],
  ["protocol_drift", "E-RECEIPT-PROTOCOL", (value) => { value.protocol = "ACTIVATED"; }],
  ["runtime_node_drift", "E-RECEIPT-RUNTIME-VALUE", (value) => { value.runtime.node = "v22.23.2"; }],
  ["runtime_npm_drift", "E-RECEIPT-RUNTIME-VALUE", (value) => { value.runtime.npm = "10.9.8"; }],
  ["check_missing", "E-RECEIPT-CHECK-COUNT", (value) => { value.checks.pop(); }],
  ["check_duplicate", "E-RECEIPT-CHECK-DUPLICATE", (value) => { value.checks[1].id = value.checks[0].id; }],
  ["check_command_drift", "E-RECEIPT-COMMAND", (value) => { value.checks[0].command += " --activate"; }],
  ["check_source_drift", "E-RECEIPT-CHECK-SOURCE", (value) => { value.checks[0].checkout_commit = HARDENING_SCOPE_BASE; }],
  ["check_status_escalation", "E-RECEIPT-STATUS", (value) => { value.checks[0].status = "PASS_ACTIVATED"; }],
  ["stale_result", "E-COMMAND-H05-COUNT", (value) => { value.checks[0].stable_result.checks_total += 1; }],
  ["h05_content_digest_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.checks[0].stable_result.content_sha256.gates = "0".repeat(64); }],
  ["h05_named_check_drift", "E-COMMAND-H05-CHECK-STATUS", (value) => { value.checks[0].stable_result.checks[0].status = "FAIL"; }],
  ["h05_duplicate_self_test_drift", "E-COMMAND-H05-SELF-TEST-VALUE", (value) => { value.checks[1].stable_result.tests.duplicate_rejection = "FAIL"; }],
  ["content_check_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.checks[2].stable_result.members += 1; }],
  ["content_self_test_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.checks[3].stable_result.self_tests -= 1; }],
  ["architecture_projection_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.checks[4].stable_result.entries += 1; }],
  ["phase1_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.checks[5].stable_result.counts.checks += 1; }],
  ["phase2_operational_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.checks[6].stable_result.behavior.recoveries += 1; }],
  ["phase2_review_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.checks[7].stable_result.expected.recoveries += 1; }],
  ["activation_result_escalation", "E-COMMAND-CONTENT_MANIFEST_GENERATOR_CHECK-VALUES", (value) => { value.checks[2].stable_result.activation_authorized = true; }],
  ["stable_extra_field", "E-COMMAND-CONTENT_MANIFEST_GENERATOR_CHECK-RESULT-FIELDS", (value) => { value.checks[2].stable_result.invented = true; }],
  ["stable_results_swapped", "E-RECEIPT-STABLE-VALUE", (value) => { [value.checks[2].stable_result, value.checks[3].stable_result] = [value.checks[3].stable_result, value.checks[2].stable_result]; }],
  ["volatile_omission_laundered", "E-RECEIPT-VOLATILE-FIELDS", (value) => { value.checks[0].volatile_fields_omitted = []; }],
  ["dependency_missing", "E-RECEIPT-DEPENDENCY-COUNT", (value) => { value.dependency_replays.pop(); }],
  ["dependency_duplicate", "E-RECEIPT-DEPENDENCY-DUPLICATE", (value) => { value.dependency_replays[1].id = value.dependency_replays[0].id; }],
  ["dependency_commit_drift", "E-RECEIPT-DEPENDENCY-SOURCE", (value) => { value.dependency_replays[0].checkout_commit = "0".repeat(40); }],
  ["dependency_command_drift", "E-RECEIPT-DEPENDENCY-COMMAND", (value) => { value.dependency_replays[0].command += " --activate"; }],
  ["dependency_status_escalation", "E-RECEIPT-DEPENDENCY-COMMAND", (value) => { value.dependency_replays[0].status = "PASS_ACTIVATED"; }],
  ["dependency_signal_laundered", "E-RECEIPT-DEPENDENCY-PROCESS", (value) => { value.dependency_replays[0].signal = "SIGTERM"; }],
  ["historical_dependency_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.dependency_replays[0].stable_result.field_count += 1; }],
  ["record_dependency_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.dependency_replays[1].stable_result.downstream_authority.phase2_authorized = true; }],
  ["record_adversarial_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.dependency_replays[2].stable_result.adversarial_attack_count += 1; }],
  ["authority_generator_check_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.dependency_replays[3].stable_result.commands += 1; }],
  ["authority_generator_restart_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.dependency_replays[4].stable_result.restart_recovery_test = "NOT_RUN"; }],
  ["authority_validator_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.dependency_replays[5].stable_result.behavior.recoveries += 1; }],
  ["authority_manifest_nested_drift", "E-RECEIPT-STABLE-VALUE", (value) => { value.dependency_replays[6].stable_result.semantic_recoveries += 1; }],
  ["current_timeout_laundered", "E-RECEIPT-PROCESS", (value) => { value.checks[0].timed_out = true; }],
  ["proposed_source_claimed_committed", "E-RECEIPT-PROPOSED-SOURCE-VALUE", (value) => { value.proposed_source.commit = HARDENING_SCOPE_BASE; }],
  ["external_privacy_escalation", "E-RECEIPT-EXTERNAL-READS", (value) => { value.external_reads[2].raw_mailbox_identifiers_published = true; }]
];

async function collectChangedPaths() {
  const values = new Set();
  const add = (output) => output.trim().split("\n").filter(Boolean).forEach((item) => values.add(item));
  add(await runGit(["diff", "--name-only", `${HARDENING_SCOPE_BASE}..HEAD`], REPO, "EMPTY"));
  add(await runGit(["diff", "--name-only", "HEAD"], REPO, "EMPTY"));
  add(await runGit(["ls-files", "--others", "--exclude-standard"], REPO, "EMPTY"));
  return [...values].sort();
}

async function validateSourceScope(allowedTransactionPaths = []) {
  const base = (await runGit(["rev-parse", `${HARDENING_SCOPE_BASE}^{commit}`], REPO, "EMPTY")).trim();
  const tree = (await runGit(["rev-parse", `${HARDENING_SCOPE_BASE}^{tree}`], REPO, "EMPTY")).trim();
  ensure(base === HARDENING_SCOPE_BASE && tree === HARDENING_SCOPE_TREE, "E-SOURCE-BASE");
  await runGit(["merge-base", "--is-ancestor", HARDENING_SCOPE_BASE, "HEAD"], REPO, "EMPTY");
  const branch = await runBounded("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd: REPO, timeoutMs: 10000, stderrPolicy: "EMPTY" });
  ensure(!branch.timedOut && !branch.orphanDetected && branch.signal === null, "E-SOURCE-BRANCH-PROCESS");
  if (branch.status === 0) ensure(branch.stdout.trim() === BRANCH, "E-SOURCE-BRANCH", branch.stdout.trim());
  else ensure(process.env.GITHUB_REF_NAME === BRANCH, "E-SOURCE-BRANCH", "detached checkout without exact GITHUB_REF_NAME");
  const workflowBytes = readRegularFile(path.join(REPO, WORKFLOW), REPO, "E-SOURCE-WORKFLOW");
  ensure(sha256(workflowBytes) === EXPECTED_WORKFLOW_SHA256, "E-SOURCE-WORKFLOW-DIGEST");
  const allowed = new Set(allowedTransactionPaths);
  exactJson((await collectChangedPaths()).filter((item) => !allowed.has(item)), EXPECTED_CHANGED_PATHS, "E-SOURCE-CHANGED-PATHS");
}

function expectedResult(manifestText, manifest, ledger, mutationEvidence) {
  return {
    protocol: "CUSTODIAL_V43_AUTHORITY_EVIDENCE_VALIDATION_RESULT_V2",
    package_id: AUTHORITY_EVIDENCE_PACKAGE_ID,
    revision: AUTHORITY_EVIDENCE_REVISION,
    status: "PASS_EVIDENCE_PACKET_ONLY",
    validator: VALIDATOR_VERSION,
    validator_sha256: sha256(readRegularFile(path.join(ROOT, "validate-authority-evidence-gate.mjs"), ROOT, "E-RESULT-VALIDATOR")),
    hardening_scope_base: HARDENING_SCOPE_BASE,
    execution_base: { commit: HARDENING_SCOPE_BASE, tree: HARDENING_SCOPE_TREE },
    foundation_source: {
      commit: FOUNDATION_SOURCE_COMMIT,
      tree: FOUNDATION_SOURCE_TREE,
      package_id: FOUNDATION_PACKAGE_ID,
      revision: FOUNDATION_REVISION,
      content_manifest_sha256: "5c5749486add2308a430de0145b02e1a19d5b4ba59cc875b5c48d47180f068c8"
    },
    package_manifest_sha256: sha256(Buffer.from(manifestText)),
    package_aggregate_sha256: manifest.aggregate_sha256,
    closure: {
      package_files: 6,
      package_directories: 0,
      package_symlinks: 0,
      package_nonregular: 0,
      manifest_members: 4,
      generated_members: 1,
      input_bindings: ledger.input_bindings.length,
      open_gates: ledger.open_gate_inventory.length
    },
    command_execution: {
      current_commands: CURRENT_CHECKS.length,
      accepted_dependency_commands: DEPENDENCY_CONFIGS.length,
      node: NODE_VERSION,
      npm: NPM_VERSION,
      workflow_sha256: EXPECTED_WORKFLOW_SHA256
    },
    mutation_evidence: mutationEvidence,
    owned_test_residue: 0,
    blockers: ledger.blockers,
    activation_authorized: false,
    architecture_closure: false,
    earliest_open_gate: "G-EVIDENCE-001"
  };
}

function validateResult(result, expected) {
  strictObject(result, RESULT_FIELDS, "E-RESULT");
  ensure(result.protocol === expected.protocol, "E-RESULT-PROTOCOL");
  ensure(result.package_id === AUTHORITY_EVIDENCE_PACKAGE_ID && result.revision === AUTHORITY_EVIDENCE_REVISION, "E-RESULT-IDENTITY");
  ensure(result.status === "PASS_EVIDENCE_PACKET_ONLY", "E-RESULT-STATUS");
  ensure(result.validator === VALIDATOR_VERSION && result.validator_sha256 === expected.validator_sha256, "E-RESULT-VALIDATOR");
  ensure(result.hardening_scope_base === HARDENING_SCOPE_BASE, "E-RESULT-SCOPE-BASE");
  exactJson(result.execution_base, expected.execution_base, "E-RESULT-EXECUTION-BASE");
  exactJson(result.foundation_source, expected.foundation_source, "E-RESULT-FOUNDATION-SOURCE");
  ensure(result.package_manifest_sha256 === expected.package_manifest_sha256, "E-RESULT-MANIFEST");
  ensure(result.package_aggregate_sha256 === expected.package_aggregate_sha256, "E-RESULT-AGGREGATE");
  strictObject(result.closure, Object.keys(expected.closure), "E-RESULT-CLOSURE");
  exactJson(result.closure, expected.closure, "E-RESULT-CLOSURE-VALUE");
  strictObject(result.command_execution, Object.keys(expected.command_execution), "E-RESULT-COMMANDS");
  exactJson(result.command_execution, expected.command_execution, "E-RESULT-COMMANDS-VALUE");
  exactJson(result.mutation_evidence, expected.mutation_evidence, "E-RESULT-MUTATION-EVIDENCE");
  ensure(result.owned_test_residue === 0, "E-RESULT-RESIDUE");
  exactJson(result.blockers, EXPECTED_BLOCKERS, "E-RESULT-BLOCKERS");
  ensure(result.activation_authorized === false, "E-RESULT-ACTIVATION");
  ensure(result.architecture_closure === false, "E-RESULT-ARCHITECTURE-CLOSURE");
  ensure(result.earliest_open_gate === "G-EVIDENCE-001", "E-RESULT-EARLIEST-GATE");
}

const RESULT_MUTATIONS = [
  ["top_array_not_object", "E-RESULT-TYPE", () => []],
  ["top_missing_status", "E-RESULT-FIELDS", (value) => { delete value.status; }],
  ["top_extra_authority", "E-RESULT-FIELDS", (value) => { value.activation_authority = true; }],
  ["validator_drift", "E-RESULT-VALIDATOR", (value) => { value.validator_sha256 = "0".repeat(64); }],
  ["identity_reused", "E-RESULT-IDENTITY", (value) => { value.package_id = FOUNDATION_PACKAGE_ID; }],
  ["foundation_checkout_conflated", "E-RESULT-FOUNDATION-SOURCE", (value) => { value.foundation_source.commit = HARDENING_SCOPE_BASE; }],
  ["manifest_drift", "E-RESULT-MANIFEST", (value) => { value.package_manifest_sha256 = "0".repeat(64); }],
  ["aggregate_drift", "E-RESULT-AGGREGATE", (value) => { value.package_aggregate_sha256 = "0".repeat(64); }],
  ["closure_count_drift", "E-RESULT-CLOSURE-VALUE", (value) => { value.closure.package_files += 1; }],
  ["command_count_drift", "E-RESULT-COMMANDS-VALUE", (value) => { value.command_execution.current_commands -= 1; }],
  ["mutation_recovery_drift", "E-RESULT-MUTATION-EVIDENCE", (value) => { value.mutation_evidence.filesystem[0].recovery = "SKIPPED"; }],
  ["residue_nonzero", "E-RESULT-RESIDUE", (value) => { value.owned_test_residue = 1; }],
  ["blockers_laundered", "E-RESULT-BLOCKERS", (value) => { value.blockers = []; }],
  ["activation_escalated", "E-RESULT-ACTIVATION", (value) => { value.activation_authorized = true; }],
  ["closure_escalated", "E-RESULT-ARCHITECTURE-CLOSURE", (value) => { value.architecture_closure = true; }],
  ["earliest_gate_drift", "E-RESULT-EARLIEST-GATE", (value) => { value.earliest_open_gate = "G-TRACE-001"; }]
];

function openDirectoryDescriptor(directory, code = "E-WRITE-DIRECTORY") {
  assertPathInside(REPO, directory, `${code}-SCOPE`);
  ensure(process.cwd() === REPO && fs.existsSync("/proc/self/fd"), `${code}-PRIMITIVE`);
  const components = path.relative(REPO, directory).split(path.sep).filter(Boolean);
  const opened = [];
  try {
    let descriptor = fs.openSync(".", fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    opened.push(descriptor);
    for (const component of components) {
      descriptor = fs.openSync(`/proc/self/fd/${descriptor}/${component}`, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      opened.push(descriptor);
      ensure(fs.fstatSync(descriptor).isDirectory(), `${code}-TYPE`, component);
    }
    for (const parent of opened.slice(0, -1)) fs.closeSync(parent);
    return opened.at(-1);
  } catch (error) {
    for (const descriptor of opened.reverse()) {
      try { fs.closeSync(descriptor); } catch {}
    }
    if (error?.code === "ELOOP" || error?.code === "ENOTDIR") fail(`${code}-SYMLINK`, directory);
    throw error;
  }
}

function descriptorLeaf(directoryDescriptor, name, code = "E-WRITE-LEAF") {
  validateRelativePath(name, code);
  ensure(!name.includes("/"), `${code}-NESTED`, name);
  return `/proc/self/fd/${directoryDescriptor}/${name}`;
}

function writeNewDescriptorLeaf(directoryDescriptor, name, bytes, code = "E-WRITE-STAGE") {
  ensure(Buffer.isBuffer(bytes), `${code}-BYTES`);
  const descriptor = fs.openSync(
    descriptorLeaf(directoryDescriptor, name, code),
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
    0o600
  );
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      ensure(count > 0, `${code}-SHORT-WRITE`, name);
      offset += count;
    }
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function optionalRegularIdentity(transactionRoot, name, code) {
  try {
    const bytes = readRegularFile(path.join(transactionRoot, name), transactionRoot, code);
    return { identity: { exists: true, bytes: bytes.length, sha256: sha256(bytes) }, bytes };
  } catch (error) {
    if (error?.code === "ENOENT") return { identity: { exists: false, bytes: 0, sha256: null }, bytes: null };
    throw error;
  }
}

function journalIntegrity(value) {
  const projected = clone(value);
  delete projected.integrity_sha256;
  return sha256(Buffer.concat([
    Buffer.from("CUSTODIAL_V43_AUTHORITY_EVIDENCE_WRITE_JOURNAL_INTEGRITY_V2\0"),
    Buffer.from(textJson(projected))
  ]));
}

function expectedWriteMap(files) {
  exactJson(files.map(([name]) => name), GENERATED_RECEIPT_NAMES, "E-WRITE-TARGETS");
  return new Map(files.map(([name, content]) => {
    ensure(typeof content === "string", "E-WRITE-CONTENT-TYPE", name);
    return [name, Buffer.from(content)];
  }));
}

function buildWriteJournal(files, sourceSetSha256, transactionRoot) {
  const expected = expectedWriteMap(files);
  const transactionNonce = crypto.randomBytes(24).toString("hex");
  const entries = GENERATED_RECEIPT_NAMES.map((name, order) => {
    const nextBytes = expected.get(name);
    return {
      name,
      order,
      prior: optionalRegularIdentity(transactionRoot, name, "E-WRITE-PRIOR").identity,
      next: { exists: true, bytes: nextBytes.length, sha256: sha256(nextBytes) },
      stage: `${WRITE_STAGE_PREFIX}${transactionNonce}-${order}`
    };
  });
  const value = {
    protocol: WRITE_JOURNAL_PROTOCOL,
    version: 2,
    transaction_nonce: transactionNonce,
    owner: {
      branch: BRANCH,
      hardening_scope_base: HARDENING_SCOPE_BASE,
      pid: process.pid,
      repository_scope_sha256: sha256(REPO),
      source_set_sha256: sourceSetSha256
    },
    entries,
    integrity_sha256: null
  };
  value.integrity_sha256 = journalIntegrity(value);
  return value;
}

function parseAndPreflightWriteJournal(files, sourceSetSha256, transactionRoot) {
  const expected = expectedWriteMap(files);
  let value;
  try {
    value = JSON.parse(readRegularFile(path.join(transactionRoot, WRITE_JOURNAL_NAME), transactionRoot, "E-WRITE-JOURNAL-READ").toString("utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) fail("E-WRITE-JOURNAL-JSON");
    throw error;
  }
  strictObject(value, ["entries", "integrity_sha256", "owner", "protocol", "transaction_nonce", "version"], "E-WRITE-JOURNAL");
  ensure(value.protocol === WRITE_JOURNAL_PROTOCOL && value.version === 2, "E-WRITE-JOURNAL-PROTOCOL");
  ensure(typeof value.transaction_nonce === "string" && /^[0-9a-f]{48}$/.test(value.transaction_nonce), "E-WRITE-JOURNAL-NONCE");
  strictObject(value.owner, ["branch", "hardening_scope_base", "pid", "repository_scope_sha256", "source_set_sha256"], "E-WRITE-JOURNAL-OWNER");
  ensure(
    value.owner.branch === BRANCH && value.owner.hardening_scope_base === HARDENING_SCOPE_BASE &&
      Number.isSafeInteger(value.owner.pid) && value.owner.pid > 0 && value.owner.repository_scope_sha256 === sha256(REPO) &&
      value.owner.source_set_sha256 === sourceSetSha256,
    "E-WRITE-JOURNAL-OWNER-VALUE"
  );
  ensure(typeof value.integrity_sha256 === "string" && HEX_64.test(value.integrity_sha256), "E-WRITE-JOURNAL-INTEGRITY-TYPE");
  ensure(value.integrity_sha256 === journalIntegrity(value), "E-WRITE-JOURNAL-INTEGRITY");
  ensure(Array.isArray(value.entries), "E-WRITE-JOURNAL-ENTRIES-TYPE");
  exactJson(value.entries.map((item) => item.name), GENERATED_RECEIPT_NAMES, "E-WRITE-JOURNAL-TARGETS");
  const allowedOwned = new Set([WRITE_JOURNAL_NAME]);
  const preflight = [];
  for (const [index, entry] of value.entries.entries()) {
    strictObject(entry, ["name", "next", "order", "prior", "stage"], "E-WRITE-JOURNAL-ENTRY");
    ensure(entry.order === index, "E-WRITE-JOURNAL-ORDER", entry.name);
    ensure(entry.stage === `${WRITE_STAGE_PREFIX}${value.transaction_nonce}-${index}`, "E-WRITE-JOURNAL-STAGE-NAME", entry.name);
    allowedOwned.add(entry.stage);
    for (const [kind, identity] of [["PRIOR", entry.prior], ["NEXT", entry.next]]) {
      strictObject(identity, ["bytes", "exists", "sha256"], `E-WRITE-JOURNAL-${kind}`);
      ensure(typeof identity.exists === "boolean" && Number.isSafeInteger(identity.bytes) && identity.bytes >= 0, `E-WRITE-JOURNAL-${kind}-TYPE`, entry.name);
      ensure(identity.exists ? HEX_64.test(identity.sha256) : identity.sha256 === null && identity.bytes === 0, `E-WRITE-JOURNAL-${kind}-VALUE`, entry.name);
    }
    const nextBytes = expected.get(entry.name);
    exactJson(entry.next, { exists: true, bytes: nextBytes.length, sha256: sha256(nextBytes) }, "E-WRITE-JOURNAL-STALE-NEXT", entry.name);
    const target = optionalRegularIdentity(transactionRoot, entry.name, "E-WRITE-JOURNAL-TARGET").identity;
    const targetState = JSON.stringify(target) === JSON.stringify(entry.prior) ? "PRIOR" : JSON.stringify(target) === JSON.stringify(entry.next) ? "NEXT" : null;
    ensure(targetState !== null, "E-WRITE-JOURNAL-TARGET-MISMATCH", entry.name);
    const stage = optionalRegularIdentity(transactionRoot, entry.stage, "E-WRITE-JOURNAL-STAGE");
    if (stage.bytes !== null) ensure(stage.identity.bytes === entry.next.bytes && stage.identity.sha256 === entry.next.sha256, "E-WRITE-JOURNAL-STAGE-MISMATCH", entry.name);
    preflight.push({ entry, nextBytes, targetState, stagePresent: stage.bytes !== null });
  }
  const unexpectedOwned = fs.readdirSync(transactionRoot).filter((name) => (name === WRITE_JOURNAL_NAME || isOwnedWriteResidue(name)) && !allowedOwned.has(name));
  exactJson(unexpectedOwned, [], "E-WRITE-JOURNAL-UNEXPECTED-RESIDUE");
  return { value, preflight };
}

function resumeWriteTransaction(files, sourceSetSha256, transactionRoot, hooks = {}) {
  const { preflight } = parseAndPreflightWriteJournal(files, sourceSetSha256, transactionRoot);
  const directoryDescriptor = openDirectoryDescriptor(transactionRoot);
  try {
    for (const item of preflight) if (!item.stagePresent && item.targetState === "PRIOR") {
      writeNewDescriptorLeaf(directoryDescriptor, item.entry.stage, item.nextBytes);
    }
    fs.fsyncSync(directoryDescriptor);
    hooks.afterStage?.();
    for (const [index, item] of preflight.entries()) {
      if (item.targetState === "PRIOR") {
        fs.renameSync(
          descriptorLeaf(directoryDescriptor, item.entry.stage),
          descriptorLeaf(directoryDescriptor, item.entry.name)
        );
      } else if (item.stagePresent) {
        fs.unlinkSync(descriptorLeaf(directoryDescriptor, item.entry.stage));
      }
      fs.fsyncSync(directoryDescriptor);
      hooks.afterPublish?.(index);
    }
    for (const [name, content] of files) {
      const actual = readRegularFile(path.join(transactionRoot, name), transactionRoot, "E-WRITE-VERIFY");
      ensure(actual.equals(Buffer.from(content)), "E-WRITE-VERIFY", name);
    }
    fs.unlinkSync(descriptorLeaf(directoryDescriptor, WRITE_JOURNAL_NAME));
    fs.fsyncSync(directoryDescriptor);
  } finally {
    fs.closeSync(directoryDescriptor);
  }
  checkNoOwnedResidue(transactionRoot);
}

function transactionWrite(files, sourceSetSha256, transactionRoot = ROOT, hooks = {}) {
  expectedWriteMap(files);
  const journalState = optionalRegularIdentity(transactionRoot, WRITE_JOURNAL_NAME, "E-WRITE-JOURNAL-PRESENCE");
  if (journalState.bytes === null) {
    checkNoOwnedResidue(transactionRoot);
    const journal = buildWriteJournal(files, sourceSetSha256, transactionRoot);
    const directoryDescriptor = openDirectoryDescriptor(transactionRoot);
    try {
      writeNewDescriptorLeaf(directoryDescriptor, WRITE_JOURNAL_NAME, Buffer.from(textJson(journal)), "E-WRITE-JOURNAL-CREATE");
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
  }
  resumeWriteTransaction(files, sourceSetSha256, transactionRoot, hooks);
}

function checkNoOwnedResidue(transactionRoot = ROOT) {
  const residue = fs.readdirSync(transactionRoot).filter((name) => name === WRITE_JOURNAL_NAME || isOwnedWriteResidue(name));
  exactJson(residue, [], "E-OWNED-RESIDUE");
}

function isOwnedWriteResidue(name) {
  return name.startsWith(WRITE_STAGE_PREFIX);
}

function validateWriteTransactionMutations(files, sourceSetSha256) {
  const transactionRoot = beginOwnedLifecycleTest("write-transaction-mutations");
  const evidence = [];
  const reset = () => {
    resetOwnedLifecycleTest(transactionRoot);
    const descriptor = openDirectoryDescriptor(transactionRoot);
    try {
      for (const name of GENERATED_RECEIPT_NAMES) writeNewDescriptorLeaf(descriptor, name, Buffer.from(`prior:${name}\n`), "E-WRITE-TEST-SEED");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  };
  const targetSnapshot = () => GENERATED_RECEIPT_NAMES.map((name) => optionalRegularIdentity(transactionRoot, name, "E-WRITE-TEST-SNAPSHOT").identity);
  const rewriteJournal = (content) => {
    const descriptor = openDirectoryDescriptor(transactionRoot);
    try {
      fs.unlinkSync(descriptorLeaf(descriptor, WRITE_JOURNAL_NAME));
      writeNewDescriptorLeaf(descriptor, WRITE_JOURNAL_NAME, Buffer.from(typeof content === "string" ? content : textJson(content)), "E-WRITE-TEST-JOURNAL");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  };
  const readJournal = () => JSON.parse(readRegularFile(path.join(transactionRoot, WRITE_JOURNAL_NAME), transactionRoot, "E-WRITE-TEST-JOURNAL-READ").toString("utf8"));
  const interruptInitial = () => expectFailure(
    () => transactionWrite(files, sourceSetSha256, transactionRoot, { afterPublish: (index) => { if (index === 0) fail("E-WRITE-TEST-INTERRUPT"); } }),
    "E-WRITE-TEST-INTERRUPT"
  );
  const proveRejectedWithoutTargetWrite = (name, expectedCode, mutate) => {
    reset();
    interruptInitial();
    mutate();
    const before = targetSnapshot();
    expectFailure(() => transactionWrite(files, sourceSetSha256, transactionRoot), expectedCode);
    exactJson(targetSnapshot(), before, "E-WRITE-TEST-FAILURE-WROTE-TARGET", name);
    reset();
    transactionWrite(files, sourceSetSha256, transactionRoot);
    checkNoOwnedResidue(transactionRoot);
    evidence.push({ name, error: expectedCode, recovery: "PASS" });
  };
  try {
    reset();
    interruptInitial();
    const firstMix = targetSnapshot();
    ensure(firstMix[0].sha256 === sha256(Buffer.from(files[0][1])) && firstMix.slice(1).every((item, index) => item.sha256 === sha256(Buffer.from(`prior:${GENERATED_RECEIPT_NAMES[index + 1]}\n`))), "E-WRITE-TEST-PARTIAL-MIX");
    expectFailure(
      () => transactionWrite(files, sourceSetSha256, transactionRoot, { afterPublish: (index) => { if (index === 1) fail("E-WRITE-TEST-RECOVERY-INTERRUPT"); } }),
      "E-WRITE-TEST-RECOVERY-INTERRUPT"
    );
    transactionWrite(files, sourceSetSha256, transactionRoot);
    transactionWrite(files, sourceSetSha256, transactionRoot);
    checkNoOwnedResidue(transactionRoot);
    evidence.push({ name: "partial_mix_restart_idempotent_recovery", error: "E-WRITE-TEST-INTERRUPT", recovery: "PASS" });
    evidence.push({ name: "crash_during_recovery_then_repeat", error: "E-WRITE-TEST-RECOVERY-INTERRUPT", recovery: "PASS" });

    proveRejectedWithoutTargetWrite("corrupt_journal", "E-WRITE-JOURNAL-JSON", () => rewriteJournal("{\n"));
    proveRejectedWithoutTargetWrite("arbitrary_base64_field", "E-WRITE-JOURNAL-ENTRY-FIELDS", () => {
      const journal = readJournal();
      journal.entries[0].content_base64 = Buffer.from("arbitrary source overwrite").toString("base64");
      journal.integrity_sha256 = journalIntegrity(journal);
      rewriteJournal(journal);
    });
    proveRejectedWithoutTargetWrite("stale_next_metadata", "E-WRITE-JOURNAL-STALE-NEXT", () => {
      const journal = readJournal();
      journal.entries[1].next.sha256 = "0".repeat(64);
      journal.integrity_sha256 = journalIntegrity(journal);
      rewriteJournal(journal);
    });
    proveRejectedWithoutTargetWrite("stale_next_stage", "E-WRITE-JOURNAL-STAGE-MISMATCH", () => {
      const journal = readJournal();
      const descriptor = openDirectoryDescriptor(transactionRoot);
      try {
        fs.unlinkSync(descriptorLeaf(descriptor, journal.entries[1].stage));
        writeNewDescriptorLeaf(descriptor, journal.entries[1].stage, Buffer.from("stale next bytes\n"), "E-WRITE-TEST-STALE-STAGE");
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
    });
    proveRejectedWithoutTargetWrite("partial_mix_target_mismatch", "E-WRITE-JOURNAL-TARGET-MISMATCH", () => {
      const descriptor = openDirectoryDescriptor(transactionRoot);
      try {
        fs.unlinkSync(descriptorLeaf(descriptor, GENERATED_RECEIPT_NAMES[2]));
        writeNewDescriptorLeaf(descriptor, GENERATED_RECEIPT_NAMES[2], Buffer.from("neither prior nor next\n"), "E-WRITE-TEST-TARGET-MISMATCH");
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
    });
    proveRejectedWithoutTargetWrite("planted_mismatched_owner", "E-WRITE-JOURNAL-OWNER-VALUE", () => {
      const journal = readJournal();
      journal.owner.source_set_sha256 = "0".repeat(64);
      journal.integrity_sha256 = journalIntegrity(journal);
      rewriteJournal(journal);
    });
    proveRejectedWithoutTargetWrite("ambiguous_duplicate_target", "E-WRITE-JOURNAL-TARGETS", () => {
      const journal = readJournal();
      journal.entries[1].name = journal.entries[0].name;
      journal.integrity_sha256 = journalIntegrity(journal);
      rewriteJournal(journal);
    });
  } finally {
    finishOwnedLifecycleTest(transactionRoot);
  }
  return evidence;
}

function processStartTicks(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(") ");
    ensure(close > 0, "E-LIFECYCLE-PROC-STAT", String(pid));
    const fieldsAfterCommand = stat.slice(close + 2).trim().split(/\s+/);
    ensure(/^\d+$/.test(fieldsAfterCommand[19] ?? ""), "E-LIFECYCLE-PROC-START", String(pid));
    return fieldsAfterCommand[19];
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function lifecycleBootIdSha256() {
  return sha256(fs.readFileSync("/proc/sys/kernel/random/boot_id"));
}

function lifecycleLockPath() {
  const common = gitCommonDirectory();
  return { common, lock: path.join(os.tmpdir(), `custodial-v43-authority-lifecycle-${sha256(common).slice(0, 24)}.lock`) };
}

function lifecycleOwnerIntegrity(owner) {
  const projected = clone(owner);
  delete projected.integrity_sha256;
  const domain = owner.protocol === "CUSTODIAL_V43_AUTHORITY_EVIDENCE_LIFECYCLE_LOCK_V1" ?
    "CUSTODIAL_V43_AUTHORITY_EVIDENCE_LIFECYCLE_OWNER_INTEGRITY_V1\0" :
    "CUSTODIAL_V43_AUTHORITY_EVIDENCE_LIFECYCLE_OWNER_INTEGRITY_V2\0";
  return sha256(Buffer.concat([
    Buffer.from(domain),
    Buffer.from(textJson(projected))
  ]));
}

function lifecycleOwnerValue(lock, pid = process.pid, overrides = {}) {
  const startTicks = processStartTicks(pid);
  ensure(startTicks !== null, "E-LIFECYCLE-PROC-MISSING", String(pid));
  const nonce = overrides.nonce ?? crypto.randomBytes(24).toString("hex");
  const owner = {
    protocol: "CUSTODIAL_V43_AUTHORITY_EVIDENCE_LIFECYCLE_LOCK_V2",
    pid,
    process_start_ticks: startTicks,
    boot_id_sha256: lifecycleBootIdSha256(),
    nonce,
    common_git_dir_sha256: sha256(gitCommonDirectory()),
    repository_scope_sha256: sha256(REPO),
    lock_scope_sha256: sha256(lock),
    hardening_scope_base: HARDENING_SCOPE_BASE,
    owned_test_root: path.join(REPO, `.authority-evidence-owned-${nonce}`),
    ...overrides
  };
  owner.integrity_sha256 = lifecycleOwnerIntegrity(owner);
  return owner;
}

function readLifecycleLock(lock, common) {
  let directoryDescriptor;
  let ownerDescriptor;
  try {
    directoryDescriptor = fs.openSync(lock, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(directoryDescriptor);
    ensure(stat.isDirectory(), "E-LIFECYCLE-LOCK-TYPE");
    exactJson(fs.readdirSync(`/proc/self/fd/${directoryDescriptor}`).sort(), ["owner.json"], "E-LIFECYCLE-LOCK-CLOSURE");
    ownerDescriptor = fs.openSync(`/proc/self/fd/${directoryDescriptor}/owner.json`, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    let owner;
    try { owner = JSON.parse(readDescriptorBytes(ownerDescriptor, "E-LIFECYCLE-LOCK-OWNER").toString("utf8")); }
    catch (error) {
      if (error instanceof SyntaxError) fail("E-LIFECYCLE-LOCK-OWNER-JSON");
      throw error;
    }
    const legacyOwner = owner.protocol === "CUSTODIAL_V43_AUTHORITY_EVIDENCE_LIFECYCLE_LOCK_V1";
    ensure(legacyOwner || owner.protocol === "CUSTODIAL_V43_AUTHORITY_EVIDENCE_LIFECYCLE_LOCK_V2", "E-LIFECYCLE-LOCK-PROTOCOL");
    strictObject(owner, legacyOwner ?
      ["boot_id_sha256", "common_git_dir_sha256", "hardening_scope_base", "integrity_sha256", "lock_scope_sha256", "nonce", "owned_test_roots", "pid", "process_start_ticks", "protocol", "repository_scope_sha256"] :
      ["boot_id_sha256", "common_git_dir_sha256", "hardening_scope_base", "integrity_sha256", "lock_scope_sha256", "nonce", "owned_test_root", "pid", "process_start_ticks", "protocol", "repository_scope_sha256"], "E-LIFECYCLE-LOCK-OWNER");
    ensure(Number.isSafeInteger(owner.pid) && owner.pid > 0 && /^\d+$/.test(owner.process_start_ticks) && /^[0-9a-f]{48}$/.test(owner.nonce), "E-LIFECYCLE-LOCK-OWNER-TYPE");
    ensure(HEX_64.test(owner.integrity_sha256) && owner.integrity_sha256 === lifecycleOwnerIntegrity(owner), "E-LIFECYCLE-LOCK-OWNER-INTEGRITY");
    ensure(owner.boot_id_sha256 === lifecycleBootIdSha256() && owner.common_git_dir_sha256 === sha256(common) && owner.repository_scope_sha256 === sha256(REPO) && owner.lock_scope_sha256 === sha256(lock) && owner.hardening_scope_base === HARDENING_SCOPE_BASE, "E-LIFECYCLE-LOCK-OWNER-MISMATCH");
    let ownedResidueRoots;
    if (legacyOwner) {
      strictObject(owner.owned_test_roots, ["descriptor_reads", "filesystem_mutations", "write_transaction_mutations"], "E-LIFECYCLE-LOCK-OWNER-TEST-ROOTS");
      const expectedRoots = {
        descriptor_reads: path.join(REPO, `.authority-evidence-owned-${owner.nonce}-descriptor-reads`),
        filesystem_mutations: path.join(REPO, `.authority-evidence-owned-${owner.nonce}-filesystem-mutations`),
        write_transaction_mutations: path.join(REPO, `.authority-evidence-owned-${owner.nonce}-write-transaction-mutations`)
      };
      exactJson(owner.owned_test_roots, expectedRoots, "E-LIFECYCLE-LOCK-OWNER-TEST-ROOTS-VALUE");
      ownedResidueRoots = Object.values(expectedRoots);
    } else {
      ensure(owner.owned_test_root === path.join(REPO, `.authority-evidence-owned-${owner.nonce}`), "E-LIFECYCLE-LOCK-OWNER-TEST-ROOT");
      ownedResidueRoots = [owner.owned_test_root];
    }
    return { owner, ownedResidueRoots, dev: stat.dev, ino: stat.ino };
  } catch (error) {
    if (error?.code === "ELOOP" || error?.code === "ENOTDIR") fail("E-LIFECYCLE-LOCK-SYMLINK", lock);
    throw error;
  } finally {
    if (ownerDescriptor !== undefined) fs.closeSync(ownerDescriptor);
    if (directoryDescriptor !== undefined) fs.closeSync(directoryDescriptor);
  }
}

function lifecycleOwnerIsLive(owner) {
  return processStartTicks(owner.pid) === owner.process_start_ticks && owner.boot_id_sha256 === lifecycleBootIdSha256();
}

function removeLifecycleLock(lock, common, snapshot, code, recoverOwnedResidue = false) {
  const current = readLifecycleLock(lock, common);
  ensure(current.dev === snapshot.dev && current.ino === snapshot.ino, `${code}-RACE`);
  exactJson(current.owner, snapshot.owner, `${code}-OWNER-RACE`);
  if (recoverOwnedResidue) {
    for (const ownedResidueRoot of current.ownedResidueRoots) if (fs.existsSync(ownedResidueRoot)) {
      removeOwned(ownedResidueRoot);
      fsyncRepositoryDirectory();
    }
  } else for (const ownedResidueRoot of current.ownedResidueRoots) ensure(!fs.existsSync(ownedResidueRoot), `${code}-OWNED-TEST-RESIDUE`, ownedResidueRoot);
  fs.unlinkSync(path.join(lock, "owner.json"));
  fs.rmdirSync(lock);
  fsyncDirectoryPath(path.dirname(lock));
  ensure(!fs.existsSync(lock), `${code}-RESIDUE`);
}

function acquireLifecycleLock() {
  const { common, lock } = lifecycleLockPath();
  let recoveredDeadOwner = false;
  try {
    fs.mkdirSync(lock, { mode: 0o700 });
    fsyncDirectoryPath(path.dirname(lock));
  }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const snapshot = readLifecycleLock(lock, common);
    ensure(!lifecycleOwnerIsLive(snapshot.owner), "E-LIFECYCLE-LOCK-BUSY", String(snapshot.owner.pid));
    removeLifecycleLock(lock, common, snapshot, "E-LIFECYCLE-LOCK-STALE", true);
    recoveredDeadOwner = true;
    fs.mkdirSync(lock, { mode: 0o700 });
    fsyncDirectoryPath(path.dirname(lock));
  }
  const owner = lifecycleOwnerValue(lock);
  try {
    const descriptor = fs.openSync(lock, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    try {
      writeNewDescriptorLeaf(descriptor, "owner.json", Buffer.from(textJson(owner)), "E-LIFECYCLE-LOCK-CREATE");
      fs.fsyncSync(descriptor);
    } finally { fs.closeSync(descriptor); }
  } catch (error) {
    try { fs.rmdirSync(lock); } catch {}
    throw error;
  }
  const snapshot = readLifecycleLock(lock, common);
  exactJson(snapshot.owner, owner, "E-LIFECYCLE-LOCK-VERIFY");
  ensure(!fs.existsSync(owner.owned_test_root), "E-LIFECYCLE-LOCK-TEST-ROOT-PREEXISTING", owner.owned_test_root);
  return { lock, common, owner, dev: snapshot.dev, ino: snapshot.ino, recoveredDeadOwner };
}

function releaseLifecycleLock(handle) {
  removeLifecycleLock(handle.lock, handle.common, handle, "E-LIFECYCLE-LOCK-RELEASE");
}

function fsyncDirectoryPath(directory) {
  const descriptor = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(descriptor); }
  finally { fs.closeSync(descriptor); }
}

function fsyncRepositoryDirectory() {
  fsyncDirectoryPath(REPO);
}

function beginOwnedLifecycleTest(name) {
  ensure(lifecycleLockHandle !== null, "E-LIFECYCLE-TEST-NO-OWNER", name);
  validateRelativePath(name, "E-LIFECYCLE-TEST-NAME");
  ensure(!name.includes("/"), "E-LIFECYCLE-TEST-NESTED", name);
  const ownedRoot = lifecycleLockHandle.owner.owned_test_root;
  assertPathInside(REPO, ownedRoot, "E-LIFECYCLE-TEST-ROOT-SCOPE");
  if (!fs.existsSync(ownedRoot)) {
    fs.mkdirSync(ownedRoot, { mode: 0o700 });
    fsyncRepositoryDirectory();
  }
  const target = path.join(ownedRoot, name);
  assertPathInside(ownedRoot, target, "E-LIFECYCLE-TEST-TARGET-SCOPE");
  ensure(!fs.existsSync(target), "E-LIFECYCLE-TEST-TARGET-PREEXISTING", target);
  fs.mkdirSync(target, { mode: 0o700 });
  fsyncDirectoryPath(ownedRoot);
  return target;
}

function finishOwnedLifecycleTest(target) {
  ensure(lifecycleLockHandle !== null, "E-LIFECYCLE-TEST-NO-OWNER", target);
  const ownedRoot = lifecycleLockHandle.owner.owned_test_root;
  assertPathInside(ownedRoot, target, "E-LIFECYCLE-TEST-TARGET-SCOPE");
  removeOwned(target);
  ensure(fs.readdirSync(ownedRoot).length === 0, "E-LIFECYCLE-TEST-ROOT-CLOSURE", ownedRoot);
  fs.rmdirSync(ownedRoot);
  fsyncRepositoryDirectory();
  ensure(!fs.existsSync(ownedRoot), "E-LIFECYCLE-TEST-ROOT-RESIDUE", ownedRoot);
}

function resetOwnedLifecycleTest(target) {
  ensure(lifecycleLockHandle !== null, "E-LIFECYCLE-TEST-NO-OWNER", target);
  const ownedRoot = lifecycleLockHandle.owner.owned_test_root;
  assertPathInside(ownedRoot, target, "E-LIFECYCLE-TEST-TARGET-SCOPE");
  ensure(fs.existsSync(ownedRoot), "E-LIFECYCLE-TEST-ROOT-MISSING", ownedRoot);
  if (fs.existsSync(target)) removeOwned(target);
  fs.mkdirSync(target, { mode: 0o700 });
  fsyncDirectoryPath(ownedRoot);
}

function parseMode() {
  ensure(process.argv.length === 3, "E-CLI-USAGE", "expected exactly one mode");
  const value = process.argv[2];
  ensure(new Set(["--check", "--write", "--check-package-manifest", "--self-test-late-signal"]).has(value), "E-CLI-MODE", value);
  return value;
}

try {
  const mode = parseMode();
  if (mode === "--self-test-late-signal") {
    setImmediate(() => process.kill(process.pid, "SIGTERM"));
    await delay(25);
    ensureNoPendingLifecycleSignal("E-LIFECYCLE-SIGNAL-LATE-SELF-TEST");
    fail("E-LIFECYCLE-LATE-SIGNAL-ESCAPED");
  }
  lifecycleLockHandle = acquireLifecycleLock();
  const initialOwnedTransactionNames = fs.readdirSync(ROOT).filter((name) => name === WRITE_JOURNAL_NAME || isOwnedWriteResidue(name));
  const recoveryPending = mode === "--write" && initialOwnedTransactionNames.includes(WRITE_JOURNAL_NAME);
  if (!recoveryPending) checkNoOwnedResidue();
  const allowedTransactionPaths = recoveryPending ? initialOwnedTransactionNames.map((name) => `${PACKAGE_PREFIX}${name}`) : [];
  await validateSourceScope(allowedTransactionPaths);
  discoverPackage(ROOT, REPO, [...EXPECTED_PACKAGE_FILES, ...initialOwnedTransactionNames], []);
  await verifyDependencyObjects();
  const sourceSet = proposedSourceIdentity();
  const descriptorEvidence = validateDescriptorRelativeRaceMutations();
  const processEvidence = await validateProcessLifecycleMutations();
  const dependencyLockEvidence = await validateDependencyLockMutations();
  const ledgerBytes = readRegularFile(path.join(ROOT, "evidence-ledger.json"), ROOT, "E-LEDGER-SOURCE");
  ensure(sha256(ledgerBytes) === EXPECTED_LEDGER_SHA256, "E-LEDGER-SOURCE-DIGEST");
  const ledger = JSON.parse(ledgerBytes.toString("utf8"));
  validateLedger(ledger);
  const ledgerEvidence = runMutationCases(ledger, LEDGER_MUTATIONS, validateLedger);
  const filesystemEvidence = await validateFilesystemMutations();
  let receipt;
  let receiptText;
  let expectedChecks = null;
  let expectedDependencies = null;
  if (mode === "--check" || mode === "--write") {
    expectedChecks = await executeCurrentChecks(sourceSet);
    expectedDependencies = await executeDependencyReplays();
    receipt = expectedCommandReceipt(expectedChecks, expectedDependencies, sourceSet);
    receiptText = textJson(receipt);
  } else {
    receipt = readJson("command-receipts.json");
    receiptText = readRegularFile(path.join(ROOT, "command-receipts.json"), ROOT, "E-RECEIPT-SOURCE").toString("utf8");
  }
  validateCommandReceipt(receipt, expectedChecks, expectedDependencies, sourceSet);
  const receiptEvidence = runMutationCases(receipt, RECEIPT_MUTATIONS, (candidate) => validateCommandReceipt(candidate, receipt.checks, receipt.dependency_replays, sourceSet));
  const manifest = expectedManifest(receiptText);
  const manifestText = textJson(manifest);
  const manifestEvidence = runMutationCases(manifest, MANIFEST_MUTATIONS, (candidate) => validateManifest(candidate, manifest));
  const transactionEvidence = validateWriteTransactionMutations([
    ["command-receipts.json", receiptText],
    ["package-manifest.json", manifestText],
    ["validation-result.json", "synthetic validation result bytes\n"]
  ], sourceSet.aggregate_sha256);
  const mutationEvidence = { manifest: manifestEvidence, filesystem: filesystemEvidence, descriptor_reads: descriptorEvidence, process_lifecycle: processEvidence, dependency_lock: dependencyLockEvidence, write_transaction: transactionEvidence, ledger: ledgerEvidence, command_receipts: receiptEvidence, validation_result: [] };
  mutationEvidence.validation_result = RESULT_MUTATIONS.map(([name, error]) => ({ name, error, recovery: "PASS" }));
  const result = expectedResult(manifestText, manifest, ledger, mutationEvidence);
  const resultEvidence = runMutationCases(result, RESULT_MUTATIONS, (candidate) => validateResult(candidate, result));
  exactJson(resultEvidence, mutationEvidence.validation_result, "E-RESULT-MUTATION-SELF-CHECK");
  validateManifest(manifest, manifest);
  validateResult(result, result);
  const resultText = textJson(result);
  if (mode === "--write") {
    await lifecycleSignalBoundary("E-LIFECYCLE-SIGNAL-BEFORE-WRITE");
    transactionWrite([
      ["command-receipts.json", receiptText],
      ["package-manifest.json", manifestText],
      ["validation-result.json", resultText]
    ], sourceSet.aggregate_sha256);
    ensureNoPendingLifecycleSignal("E-LIFECYCLE-SIGNAL-AFTER-WRITE");
  } else {
    await lifecycleSignalBoundary("E-LIFECYCLE-SIGNAL-BEFORE-READ-CHECK");
    validateManifest(readJson("package-manifest.json"), manifest);
    validateResult(readJson("validation-result.json"), result);
    ensure(readRegularFile(path.join(ROOT, "package-manifest.json"), ROOT, "E-MANIFEST-SOURCE").toString("utf8") === manifestText, "E-MANIFEST-BYTES-DETERMINISM");
    ensure(readRegularFile(path.join(ROOT, "validation-result.json"), ROOT, "E-RESULT-SOURCE").toString("utf8") === resultText, "E-RESULT-BYTES-DETERMINISM");
    if (mode === "--check") ensure(readRegularFile(path.join(ROOT, "command-receipts.json"), ROOT, "E-RECEIPT-SOURCE").toString("utf8") === receiptText, "E-RECEIPT-BYTES-DETERMINISM");
  }
  discoverPackage(ROOT, REPO, EXPECTED_PACKAGE_FILES, []);
  checkNoOwnedResidue();
  await lifecycleSignalBoundary("E-LIFECYCLE-SIGNAL-BEFORE-PASS");
  const output = {
    protocol: "CUSTODIAL_V43_AUTHORITY_EVIDENCE_VALIDATION_EXECUTION_V2",
    status: "PASS_EVIDENCE_PACKET_ONLY",
    mode,
    package_manifest_sha256: sha256(Buffer.from(manifestText)),
    package_aggregate_sha256: manifest.aggregate_sha256,
    validation_result_sha256: sha256(Buffer.from(resultText)),
    package_files: 6,
    package_directories: 0,
    manifest_members: 4,
    current_commands_replayed: mode === "--check" || mode === "--write" ? CURRENT_CHECKS.length : 0,
    accepted_dependency_commands_replayed: mode === "--check" || mode === "--write" ? DEPENDENCY_CONFIGS.length : 0,
    accepted_dependency_commands_bound: DEPENDENCY_CONFIGS.length,
    mutation_failures: Object.values(mutationEvidence).reduce((sum, items) => sum + items.length, 0),
    mutation_recoveries: Object.values(mutationEvidence).reduce((sum, items) => sum + items.length, 0),
    owned_test_residue: 0,
    activation_authorized: false,
    architecture_closure: false,
    earliest_open_gate: "G-EVIDENCE-001"
  };
  ensureNoPendingLifecycleSignal("E-LIFECYCLE-SIGNAL-AT-PASS");
  process.stdout.write(textJson(output));
} catch (error) {
  process.stderr.write(`${error?.code ?? "E-UNEXPECTED"}: ${error?.message ?? String(error)}\n`);
  process.exitCode = error?.code === "E-CLI-USAGE" || error?.code === "E-CLI-MODE" ? 64 :
    pendingLifecycleSignal === "SIGINT" ? 130 : pendingLifecycleSignal === "SIGTERM" ? 143 : 1;
} finally {
  if (lifecycleLockHandle !== null) {
    try { releaseLifecycleLock(lifecycleLockHandle); }
    catch (error) {
      process.stderr.write(`${error?.code ?? "E-LIFECYCLE-LOCK-RELEASE"}: ${error?.message ?? String(error)}\n`);
      process.exitCode = pendingLifecycleSignal === "SIGINT" ? 130 : pendingLifecycleSignal === "SIGTERM" ? 143 : 1;
    }
    lifecycleLockHandle = null;
  }
  if (pendingLifecycleSignal !== null) process.exitCode = pendingLifecycleSignal === "SIGINT" ? 130 : 143;
}
