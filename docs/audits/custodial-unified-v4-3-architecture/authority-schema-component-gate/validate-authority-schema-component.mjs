import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { AuthoritySchemaComponent, expectAuthorityError } from "./reference-component.mjs";

export const VALIDATOR_VERSION = "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_VALIDATOR_V2";
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(ROOT, "../../../..");
const mode = process.argv[2] ?? "--check";
if (!new Set(["--check", "--write", "--check-package-manifest"]).has(mode)) throw new Error(`E-VALIDATOR-ARGUMENT: ${mode}`);
const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, name), "utf8"));
const lines = (name) => fs.readFileSync(path.join(ROOT, name), "utf8").trim().split("\n").map(JSON.parse);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const clone = (value) => JSON.parse(JSON.stringify(value));
const HARDENING_SCOPE_BASE = "c7a0d947225d7eb3b09f415cc1944e2509ffcd99";
const EXPECTED_SOURCE_HEAD = "26a996fddf70aabff6ab2a526a16425526137e3b";
const EXPECTED_INVARIANT = "Manifest and validation receipts cannot authorize activation or participate in their own digest closure.";
const EXPECTED_EXCLUDED_RECEIPTS = ["package-manifest.json", "validation-result.json"];
const MANIFEST_FIELDS = ["activation_authorized", "excluded_receipts", "invariant", "members", "protocol", "source_head", "status"];
const MEMBER_FIELDS = ["bytes", "generated", "path", "sha256"];
const EXPECTED_MEMBER_GENERATED = new Map([
  ["activation-and-rollout-contract.json", true],
  ["build-contract.json", false],
  ["component-interface-contract.json", true],
  ["conformance-fixtures.json", true],
  ["credential-lifecycle-contract.json", true],
  ["derivation-receipt.json", true],
  ["gate-history-trace.json", true],
  ["generate-authority-schema-component.mjs", false],
  ["journey-and-recovery-contract.json", true],
  ["README.md", false],
  ["reference-component.mjs", false],
  ["schemas/authority-set.command.v1.schema.json", true],
  ["schemas/authority-set.event.v1.schema.json", true],
  ["schemas/credential.command.v1.schema.json", true],
  ["schemas/credential.event.v1.schema.json", true],
  ["schemas/grant.command.v1.schema.json", true],
  ["schemas/grant.event.v1.schema.json", true],
  ["schemas/manager-session.command.v1.schema.json", true],
  ["schemas/manager-session.event.v1.schema.json", true],
  ["schemas/principal.command.v1.schema.json", true],
  ["schemas/principal.event.v1.schema.json", true],
  ["source-surface-semantic-matrix.jsonl", true],
  ["source-surface-semantic-summary.json", true],
  ["target-command-registry.json", true],
  ["validate-authority-schema-component.mjs", false]
]);
const EXPECTED_MEMBER_NAMES = [...EXPECTED_MEMBER_GENERATED.keys()];
const EXPECTED_PACKAGE_FILES = [...EXPECTED_MEMBER_NAMES, ...EXPECTED_EXCLUDED_RECEIPTS].sort();
const EXPECTED_PACKAGE_DIRECTORIES = ["schemas"];
const RECEIPT_FIELDS = [
  "activation_authorized", "architecture_closure", "behavior", "blockers", "closure",
  "earliest_open_gate", "filesystem_mutation_failures", "filesystem_recoveries", "generator_check",
  "generator_restart_self_test", "hardening_scope_base", "manifest_semantic_mutation_failures",
  "manifest_semantic_recoveries", "mutation_tests", "owned_test_residue", "package_aggregate_sha256",
  "package_manifest_sha256", "protocol", "receipt_semantic_mutation_failures",
  "receipt_semantic_recoveries", "source_head", "status", "validator"
];
const CLOSURE_FIELDS = ["commands", "credential_classes", "interfaces", "journeys", "schemas", "source_surfaces", "state_machines", "transitions"];
const BEHAVIOR_FIELDS = ["expected_failures", "normal", "recoveries", "replay"];
const RECEIPT_MUTATION_CASE_COUNT = 27;

class ValidationError extends Error {
  constructor(code, detail = "") {
    super(`${code}${detail ? `: ${detail}` : ""}`);
    this.code = code;
  }
}
const fail = (code, detail) => { throw new ValidationError(code, detail); };
const ensure = (condition, code, detail) => { if (!condition) fail(code, detail); };
const unique = (values, code, detail) => ensure(new Set(values).size === values.length, code, detail);
const exactJson = (actual, expected, code, detail) => ensure(JSON.stringify(actual) === JSON.stringify(expected), code, detail);

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

function assertPathInside(scopeRoot, target) {
  const scoped = path.relative(scopeRoot, target);
  ensure(scoped === "" || (!scoped.startsWith(`..${path.sep}`) && scoped !== ".." && !path.isAbsolute(scoped)), "E-MANIFEST-PACKAGE-PATH-SCOPE", target);
}

function assertNoSymlinkComponents(target) {
  const absolute = path.resolve(target);
  const root = path.parse(absolute).root;
  let cursor = root;
  for (const component of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    ensure(!fs.lstatSync(cursor).isSymbolicLink(), "E-MANIFEST-PACKAGE-SYMLINK", cursor);
  }
}

function validateMemberPath(memberPath) {
  ensure(typeof memberPath === "string", "E-MANIFEST-MEMBER-PATH-TYPE");
  ensure(
    memberPath.length > 0 && !memberPath.includes("\0") && !memberPath.includes("\\") &&
      !path.posix.isAbsolute(memberPath) && memberPath !== "." && memberPath !== ".." &&
      !memberPath.split("/").some((component) => component === "" || component === "." || component === "..") &&
      path.posix.normalize(memberPath) === memberPath,
    "E-MANIFEST-MEMBER-PATH-SCOPE",
    memberPath
  );
}

function validateDiscoveredPackage(packageRoot, scopeRoot, expectedFiles, expectedDirectories) {
  assertPathInside(scopeRoot, packageRoot);
  assertNoSymlinkComponents(scopeRoot);
  assertNoSymlinkComponents(packageRoot);
  const files = [];
  const directories = [];
  const walk = (directory) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const target = path.resolve(directory, name);
      assertPathInside(packageRoot, target);
      assertNoSymlinkComponents(target);
      const relative = path.relative(packageRoot, target).split(path.sep).join("/");
      const stat = fs.lstatSync(target);
      if (stat.isDirectory()) {
        directories.push(relative);
        walk(target);
      } else if (stat.isFile()) {
        files.push(relative);
      } else {
        fail("E-MANIFEST-PACKAGE-MEMBER-NONREGULAR", relative);
      }
    }
  };
  walk(packageRoot);
  exactJson(files.sort(), [...expectedFiles].sort(), "E-MANIFEST-PACKAGE-FILE-CLOSURE");
  exactJson(directories.sort(), [...expectedDirectories].sort(), "E-MANIFEST-PACKAGE-DIRECTORY-CLOSURE");
}

const generated = spawnSync(process.execPath, [path.join(ROOT, "generate-authority-schema-component.mjs"), "--check"], { cwd: REPO, encoding: "utf8" });
ensure(generated.status === 0, "E-GENERATOR-CHECK", `${generated.stdout}${generated.stderr}`.trim());
const restartSelfTest = spawnSync(process.execPath, [path.join(ROOT, "generate-authority-schema-component.mjs"), "--self-test-restart"], { cwd: REPO, encoding: "utf8" });
ensure(restartSelfTest.status === 0, "E-GENERATOR-RESTART-SELF-TEST", `${restartSelfTest.stdout}${restartSelfTest.stderr}`.trim());

const pkg = {
  build: read("build-contract.json"),
  registry: read("target-command-registry.json"),
  matrix: lines("source-surface-semantic-matrix.jsonl"),
  summary: read("source-surface-semantic-summary.json"),
  gates: read("gate-history-trace.json"),
  interfaces: read("component-interface-contract.json"),
  credentials: read("credential-lifecycle-contract.json"),
  journeys: read("journey-and-recovery-contract.json"),
  rollout: read("activation-and-rollout-contract.json"),
  fixtures: read("conformance-fixtures.json"),
  derivation: read("derivation-receipt.json"),
  manifest: read("package-manifest.json"),
  authorization: JSON.parse(fs.readFileSync(path.resolve(ROOT, "../phase2-operational-architecture/phase2-principal-grant-tool-authorization-contract.json"), "utf8")),
  schemas: Object.fromEntries(pkgSchemaNames().map((name) => [name, read(`schemas/${name}.schema.json`)]))
};

function pkgSchemaNames() {
  return ["authority-set.command.v1", "authority-set.event.v1", "credential.command.v1", "credential.event.v1", "grant.command.v1", "grant.event.v1", "manager-session.command.v1", "manager-session.event.v1", "principal.command.v1", "principal.event.v1"];
}

function validateValue(rule, value, pathName) {
  if (rule.const !== undefined) ensure(value === rule.const, "E-SCHEMA-CONST", pathName);
  if (rule.enum) ensure(rule.enum.includes(value), "E-SCHEMA-ENUM", pathName);
  if (Array.isArray(rule.type)) {
    const actual = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    ensure(rule.type.includes(actual), "E-SCHEMA-TYPE", pathName);
  }
  if (rule.type === "string" || (Array.isArray(rule.type) && typeof value === "string")) {
    ensure(typeof value === "string", "E-SCHEMA-TYPE", pathName);
    if (rule.minLength !== undefined) ensure(value.length >= rule.minLength, "E-SCHEMA-LENGTH", pathName);
    if (rule.maxLength !== undefined) ensure(value.length <= rule.maxLength, "E-SCHEMA-LENGTH", pathName);
    if (rule.pattern) ensure(new RegExp(rule.pattern).test(value), "E-SCHEMA-PATTERN", pathName);
    if (rule.format === "date-time") ensure(Number.isFinite(Date.parse(value)), "E-SCHEMA-DATETIME", pathName);
    if (rule.format === "date") ensure(/^\d{4}-\d{2}-\d{2}$/.test(value), "E-SCHEMA-DATE", pathName);
  }
  if (rule.type === "integer") {
    ensure(Number.isSafeInteger(value), "E-SCHEMA-TYPE", pathName);
    if (rule.minimum !== undefined) ensure(value >= rule.minimum, "E-SCHEMA-MINIMUM", pathName);
  }
  if (rule.type === "boolean") ensure(typeof value === "boolean", "E-SCHEMA-TYPE", pathName);
  if (rule.type === "array") {
    ensure(Array.isArray(value), "E-SCHEMA-TYPE", pathName);
    if (rule.uniqueItems) ensure(new Set(value.map((item) => JSON.stringify(item))).size === value.length, "E-SCHEMA-UNIQUE", pathName);
    if (rule.items) value.forEach((item, index) => validateValue(rule.items, item, `${pathName}[${index}]`));
  }
  if (rule.type === "object") {
    ensure(value && typeof value === "object" && !Array.isArray(value), "E-SCHEMA-TYPE", pathName);
    for (const field of rule.required ?? []) ensure(value[field] !== undefined, "E-SCHEMA-REQUIRED", `${pathName}.${field}`);
    if (rule.additionalProperties === false) for (const field of Object.keys(value)) ensure(rule.properties[field], "E-SCHEMA-ADDITIONAL", `${pathName}.${field}`);
    for (const [field, child] of Object.entries(value)) if (rule.properties?.[field]) validateValue(rule.properties[field], child, `${pathName}.${field}`);
  }
}

function validateRecord(schema, record) {
  ensure(record && typeof record === "object" && !Array.isArray(record), "E-SCHEMA-TYPE", schema.title);
  for (const field of schema.required) ensure(record[field] !== undefined, "E-SCHEMA-REQUIRED", `${schema.title}:${field}`);
  if (schema.additionalProperties === false) for (const field of Object.keys(record)) ensure(schema.properties[field], "E-SCHEMA-ADDITIONAL", `${schema.title}:${field}`);
  for (const [field, value] of Object.entries(record)) if (schema.properties[field]) validateValue(schema.properties[field], value, `${schema.title}:${field}`);
  for (const conditional of schema.allOf) {
    const commandId = conditional.if.properties.domain_payload.properties.command_id.const;
    if (record.domain_payload.command_id !== commandId) continue;
    const payloadRule = conditional.then.properties.domain_payload;
    for (const field of payloadRule.required ?? []) ensure(record.domain_payload[field] !== undefined, "E-SCHEMA-CONDITIONAL", `${schema.title}:domain_payload.${field}`);
    for (const [field, rule] of Object.entries(payloadRule.properties ?? {})) validateValue(rule, record.domain_payload[field], `${schema.title}:domain_payload.${field}`);
  }
  return true;
}

function validateManifest(manifest) {
  strictObject(manifest, MANIFEST_FIELDS, "E-MANIFEST");
  ensure(manifest.protocol === "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_PACKAGE_MANIFEST_V1", "E-MANIFEST-PROTOCOL");
  ensure(manifest.status === "COMPLETE_NON_ACTIVATABLE_PACKAGE", "E-MANIFEST-STATUS");
  ensure(typeof manifest.source_head === "string", "E-MANIFEST-SOURCE-HEAD-TYPE");
  ensure(manifest.source_head === EXPECTED_SOURCE_HEAD, "E-MANIFEST-SOURCE-HEAD");
  ensure(typeof manifest.activation_authorized === "boolean", "E-MANIFEST-AUTHORITY-TYPE");
  ensure(manifest.activation_authorized === false, "E-MANIFEST-AUTHORITY");
  ensure(Array.isArray(manifest.members), "E-MANIFEST-MEMBERS-TYPE");
  ensure(Array.isArray(manifest.excluded_receipts) && manifest.excluded_receipts.every((entry) => typeof entry === "string"), "E-MANIFEST-EXCLUSIONS-TYPE");
  exactJson(manifest.excluded_receipts, EXPECTED_EXCLUDED_RECEIPTS, "E-MANIFEST-EXCLUSIONS");
  ensure(typeof manifest.invariant === "string", "E-MANIFEST-INVARIANT-TYPE");
  ensure(manifest.invariant === EXPECTED_INVARIANT, "E-MANIFEST-INVARIANT");

  for (const member of manifest.members) {
    strictObject(member, MEMBER_FIELDS, "E-MANIFEST-MEMBER");
    validateMemberPath(member.path);
    ensure(Number.isSafeInteger(member.bytes) && member.bytes >= 0, "E-MANIFEST-MEMBER-BYTES-TYPE", member.path);
    ensure(typeof member.sha256 === "string" && /^[0-9a-f]{64}$/.test(member.sha256), "E-MANIFEST-MEMBER-DIGEST-TYPE", member.path);
    ensure(typeof member.generated === "boolean", "E-MANIFEST-MEMBER-GENERATED-TYPE", member.path);
  }
  const names = manifest.members.map((member) => member.path);
  unique(names, "E-MANIFEST-DUPLICATE", "members");
  ensure(!names.includes("package-manifest.json"), "E-MANIFEST-SELF-CYCLE");
  ensure(!names.includes("validation-result.json"), "E-MANIFEST-RECEIPT-CYCLE");
  exactJson(names, EXPECTED_MEMBER_NAMES, "E-MANIFEST-MEMBER-CLOSURE");
  for (const member of manifest.members) ensure(member.generated === EXPECTED_MEMBER_GENERATED.get(member.path), "E-MANIFEST-MEMBER-GENERATED", member.path);

  validateDiscoveredPackage(ROOT, REPO, EXPECTED_PACKAGE_FILES, EXPECTED_PACKAGE_DIRECTORIES);
  for (const member of manifest.members) {
    const memberPath = path.resolve(ROOT, member.path);
    assertPathInside(ROOT, memberPath);
    assertNoSymlinkComponents(memberPath);
    const bytes = fs.readFileSync(memberPath);
    ensure(bytes.length === member.bytes, "E-MANIFEST-BYTES", member.path);
    ensure(sha256(bytes) === member.sha256, "E-MANIFEST-DIGEST", member.path);
  }
}

function validateManifestHardeningMutations(manifest) {
  const mutations = [
    ["manifest_array_not_object", "E-MANIFEST-TYPE", () => {}],
    ...MANIFEST_FIELDS.map((field) => [`top_missing_${field}`, "E-MANIFEST-FIELDS", (candidate) => { delete candidate[field]; }]),
    ["dangerous_extra_activation_authority", "E-MANIFEST-FIELDS", (candidate) => { candidate.activation_authority = true; }],
    ["dangerous_extra_architecture_closure", "E-MANIFEST-FIELDS", (candidate) => { candidate.architecture_closure = true; }],
    ["protocol_wrong_type", "E-MANIFEST-PROTOCOL", (candidate) => { candidate.protocol = 1; }],
    ["protocol_semantic_drift", "E-MANIFEST-PROTOCOL", (candidate) => { candidate.protocol = "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_PACKAGE_MANIFEST_V999"; }],
    ["status_wrong_type", "E-MANIFEST-STATUS", (candidate) => { candidate.status = false; }],
    ["status_semantic_drift", "E-MANIFEST-STATUS", (candidate) => { candidate.status = "ACTIVATED"; }],
    ["source_head_wrong_type", "E-MANIFEST-SOURCE-HEAD-TYPE", (candidate) => { candidate.source_head = 1; }],
    ["source_head_zero", "E-MANIFEST-SOURCE-HEAD", (candidate) => { candidate.source_head = "0".repeat(40); }],
    ["activation_wrong_type", "E-MANIFEST-AUTHORITY-TYPE", (candidate) => { candidate.activation_authorized = "false"; }],
    ["activation_escalated", "E-MANIFEST-AUTHORITY", (candidate) => { candidate.activation_authorized = true; }],
    ["members_object_not_array", "E-MANIFEST-MEMBERS-TYPE", (candidate) => { candidate.members = {}; }],
    ["exclusions_object_not_array", "E-MANIFEST-EXCLUSIONS-TYPE", (candidate) => { candidate.excluded_receipts = {}; }],
    ["exclusions_non_string", "E-MANIFEST-EXCLUSIONS-TYPE", (candidate) => { candidate.excluded_receipts[0] = true; }],
    ["exclusions_empty", "E-MANIFEST-EXCLUSIONS", (candidate) => { candidate.excluded_receipts = []; }],
    ["invariant_wrong_type", "E-MANIFEST-INVARIANT-TYPE", (candidate) => { candidate.invariant = null; }],
    ["invariant_semantic_drift", "E-MANIFEST-INVARIANT", (candidate) => { candidate.invariant = "activation may be inferred"; }],
    ...MEMBER_FIELDS.map((field) => [`member_missing_${field}`, "E-MANIFEST-MEMBER-FIELDS", (candidate) => { delete candidate.members[0][field]; }]),
    ["member_array_not_object", "E-MANIFEST-MEMBER-TYPE", (candidate) => { candidate.members[0] = []; }],
    ["member_scalar_not_object", "E-MANIFEST-MEMBER-TYPE", (candidate) => { candidate.members[0] = "member"; }],
    ["member_extra_field", "E-MANIFEST-MEMBER-FIELDS", (candidate) => { candidate.members[0].activation_authorized = true; }],
    ["member_path_wrong_type", "E-MANIFEST-MEMBER-PATH-TYPE", (candidate) => { candidate.members[0].path = 1; }],
    ["member_bytes_wrong_type", "E-MANIFEST-MEMBER-BYTES-TYPE", (candidate) => { candidate.members[0].bytes = "1"; }],
    ["member_digest_wrong_type", "E-MANIFEST-MEMBER-DIGEST-TYPE", (candidate) => { candidate.members[0].sha256 = 1; }],
    ["member_generated_wrong_type", "E-MANIFEST-MEMBER-GENERATED-TYPE", (candidate) => { candidate.members[0].generated = "true"; }],
    ["member_well_typed_bytes_drift", "E-MANIFEST-BYTES", (candidate) => { candidate.members[0].bytes += 1; }],
    ["member_well_typed_digest_drift", "E-MANIFEST-DIGEST", (candidate) => { candidate.members[0].sha256 = "0".repeat(64); }],
    ["member_generated_flip", "E-MANIFEST-MEMBER-GENERATED", (candidate) => { candidate.members[0].generated = !candidate.members[0].generated; }],
    ["member_dot_path", "E-MANIFEST-MEMBER-PATH-SCOPE", (candidate) => { candidate.members.at(-1).path = "."; }],
    ["member_backslash_path", "E-MANIFEST-MEMBER-PATH-SCOPE", (candidate) => { candidate.members.at(-1).path = "schemas\\escape.json"; }],
    ["member_nul_path", "E-MANIFEST-MEMBER-PATH-SCOPE", (candidate) => { candidate.members.at(-1).path = "escape\0.json"; }],
    ["member_escape_path", "E-MANIFEST-MEMBER-PATH-SCOPE", (candidate) => { candidate.members.at(-1).path = "../escape.json"; }],
    ["member_normalized_escape_path", "E-MANIFEST-MEMBER-PATH-SCOPE", (candidate) => { candidate.members.at(-1).path = "schemas/../escape.json"; }],
    ["member_self_cycle", "E-MANIFEST-SELF-CYCLE", (candidate) => { candidate.members.at(-1).path = "package-manifest.json"; }],
    ["member_receipt_cycle", "E-MANIFEST-RECEIPT-CYCLE", (candidate) => { candidate.members.at(-1).path = "validation-result.json"; }],
    ["member_duplicate", "E-MANIFEST-DUPLICATE", (candidate) => { candidate.members[1].path = candidate.members[0].path; }],
    ["member_omitted", "E-MANIFEST-MEMBER-CLOSURE", (candidate) => { candidate.members.pop(); }],
    ["member_extra", "E-MANIFEST-MEMBER-CLOSURE", (candidate) => { candidate.members.push({ path: "unexpected.txt", bytes: 0, sha256: "0".repeat(64), generated: false }); }],
    ["member_order_drift", "E-MANIFEST-MEMBER-CLOSURE", (candidate) => { [candidate.members[0], candidate.members[1]] = [candidate.members[1], candidate.members[0]]; }]
  ];
  for (const [, expected, mutate] of mutations) {
    const candidate = expected === "E-MANIFEST-TYPE" ? [] : clone(manifest);
    mutate(candidate);
    expectFailure(() => validateManifest(candidate), expected);
    validateManifest(manifest);
  }
  return { failures: mutations.length, recoveries: mutations.length, residue: 0, names: mutations.map(([name]) => name) };
}

function validateFilesystemDiscoveryMutations() {
  const ownedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "custodial-v43-authority-schema-manifest-"));
  const fixtureRoot = path.join(ownedRoot, "package");
  const member = path.join(fixtureRoot, "member.txt");
  const nested = path.join(fixtureRoot, "nested");
  const child = path.join(nested, "child.txt");
  const expectedFiles = ["member.txt", "nested/child.txt"];
  const expectedDirectories = ["nested"];
  let failures = 0;
  let recoveries = 0;
  const names = [];
  const recover = () => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(member, "fixture\n");
    fs.writeFileSync(child, "child\n");
    validateDiscoveredPackage(fixtureRoot, ownedRoot, expectedFiles, expectedDirectories);
    recoveries += 1;
  };
  try {
    recoveries -= 1;
    recover();
    const cases = [
      ["filesystem_extra_file", "E-MANIFEST-PACKAGE-FILE-CLOSURE", () => fs.writeFileSync(path.join(fixtureRoot, "extra.txt"), "extra\n")],
      ["filesystem_extra_directory", "E-MANIFEST-PACKAGE-DIRECTORY-CLOSURE", () => fs.mkdirSync(path.join(fixtureRoot, "extra-directory"))],
      ["filesystem_missing_member", "E-MANIFEST-PACKAGE-FILE-CLOSURE", () => fs.unlinkSync(member)],
      ["filesystem_nonregular_member", "E-MANIFEST-PACKAGE-MEMBER-NONREGULAR", () => { fs.unlinkSync(member); const fifo = spawnSync("mkfifo", [member]); ensure(fifo.status === 0, "E-MANIFEST-TEST-MKFIFO"); }],
      ["filesystem_direct_symlink", "E-MANIFEST-PACKAGE-SYMLINK", () => { fs.unlinkSync(member); fs.symlinkSync(path.join(ownedRoot, "target.txt"), member); }],
      ["filesystem_ancestor_symlink", "E-MANIFEST-PACKAGE-SYMLINK", () => { fs.rmSync(nested, { recursive: true, force: true }); fs.symlinkSync(path.join(ownedRoot, "target-directory"), nested); }]
    ];
    fs.writeFileSync(path.join(ownedRoot, "target.txt"), "target\n");
    fs.mkdirSync(path.join(ownedRoot, "target-directory"));
    fs.writeFileSync(path.join(ownedRoot, "target-directory", "child.txt"), "target child\n");
    for (const [name, expected, mutate] of cases) {
      names.push(name);
      mutate();
      expectFailure(() => validateDiscoveredPackage(fixtureRoot, ownedRoot, expectedFiles, expectedDirectories), expected);
      failures += 1;
      recover();
    }
    names.push("filesystem_cleanup_interruption");
    const interrupted = path.join(ownedRoot, "interrupted-residue");
    try {
      fs.writeFileSync(interrupted, "owned\n");
      fail("E-MANIFEST-TEST-INJECTED-INTERRUPTION");
    } catch (error) {
      ensure(error.code === "E-MANIFEST-TEST-INJECTED-INTERRUPTION", "E-MANIFEST-TEST-INTERRUPTION-WRONG-ERROR");
      failures += 1;
    } finally {
      fs.rmSync(interrupted, { force: true });
    }
    ensure(!fs.existsSync(interrupted), "E-MANIFEST-TEST-INTERRUPTION-RESIDUE");
    validateDiscoveredPackage(fixtureRoot, ownedRoot, expectedFiles, expectedDirectories);
    recoveries += 1;
  } finally {
    fs.rmSync(ownedRoot, { recursive: true, force: true });
  }
  ensure(!fs.existsSync(ownedRoot), "E-MANIFEST-FILESYSTEM-TEST-RESIDUE");
  return { failures, recoveries, residue: 0, names };
}

function packageAggregate(manifest) {
  const hash = crypto.createHash("sha256");
  for (const member of [...manifest.members].sort((left, right) => left.path.localeCompare(right.path))) {
    hash.update(`${member.path}\0${member.bytes}\0${member.sha256}\0${member.generated}\n`);
  }
  return hash.digest("hex");
}

function validatePackage(candidate) {
  ensure(candidate.build.authority.activation_authorized === false, "E-BUILD-AUTHORITY");
  ensure(candidate.registry.commands.length === 26, "E-COMMAND-COUNT");
  ensure(candidate.registry.state_machines.length === 5, "E-STATE-MACHINE-COUNT");
  unique(candidate.registry.commands.map((command) => command.id), "E-COMMAND-DUPLICATE");
  const transitions = candidate.registry.state_machines.flatMap((machine) => machine.transitions);
  ensure(transitions.length === 26, "E-TRANSITION-COUNT");
  ensure(candidate.registry.commands.every((command) => transitions.filter((transition) => transition.command_id === command.id).length === 1), "E-TRANSITION-CLOSURE");
  ensure(candidate.matrix.length === 935, "E-MATRIX-COUNT");
  unique(candidate.matrix.map((row) => row.source_surface_id), "E-MATRIX-DUPLICATE");
  ensure(candidate.matrix.every((row) => row.caller_evidence.status === "UNRESOLVED_FAIL_CLOSED" && row.caller_evidence.actual_callers.length === 0), "E-MATRIX-CALLER-PROOF");
  ensure(candidate.matrix.every((row) => row.authoritative_replacement_command_ids.length === 0), "E-MATRIX-AUTHORITY");
  ensure(candidate.matrix.every((row) => row.disposition.action === "FAIL_CLOSED_RETIRE_PENDING_SOURCE_NATIVE_CALL_GRAPH" && row.disposition.runtime_admission === false && row.disposition.architecture_activation_admission === false), "E-MATRIX-FENCE");
  ensure(candidate.summary.rows === 935 && candidate.summary.fail_closed_retirements === 935 && candidate.summary.authoritative_command_assignments === 0, "E-MATRIX-SUMMARY");
  ensure(candidate.gates.activation_authorized === false && candidate.gates.earliest_failed_invariant.gate_id === "G-EVIDENCE-001", "E-GATE-AUTH");
  ensure(candidate.gates.current_gate_chain.length === 7 && candidate.gates.current_gate_chain.every((gate) => gate.status === "OPEN"), "E-GATE-TRACE");
  ensure(candidate.gates.pre_registry_origin.gate_registry_present === false && candidate.gates.registry_lineage_snapshots.length === 3 && candidate.gates.registry_lineage_snapshots.every((snapshot) => snapshot.gates.every((gate) => gate.status === "OPEN")), "E-GATE-LINEAGE");
  ensure(candidate.gates.admission_snapshots.length === 3 && candidate.gates.admission_snapshots.every((snapshot) => snapshot.gates.every((gate) => gate.status === "OPEN")), "E-GATE-HISTORY");
  ensure(candidate.gates.decision_event_audit.close_or_supersede_events_for_required_gates.length === 0, "E-GATE-EVENT");
  const requiredInterfaces = ["AuthorityGenerationStore", "FenceTokenIssuer", "AuthorizationDecisionStore", "AggregateCommandStore", "AtomicEventOutbox", "OutboxReconciler", "RollbackReceiptStore"];
  ensure(requiredInterfaces.every((id) => candidate.interfaces.interfaces.some((item) => item.id === id)), "E-INTERFACE");
  ensure(candidate.interfaces.runtime_admission === false && candidate.interfaces.frozen_backend_boundary.migration_authorized === false, "E-INTERFACE-AUTHORITY");
  ensure(candidate.credentials.secret_material_in_package === false && candidate.credentials.mechanisms.length === 4, "E-CREDENTIAL-SECRET");
  ensure(new Set(candidate.credentials.mechanisms.map((item) => item.principal_class)).size === 4, "E-CREDENTIAL-COVERAGE");
  ensure(candidate.journeys.journeys.length === 5, "E-JOURNEY-COVERAGE");
  ensure(candidate.rollout.activation_authorized === false && candidate.rollout.status === "BLOCKED_OPEN_GATES", "E-ROLLOUT-AUTHORITY");
  ensure(Object.keys(candidate.schemas).length === 10, "E-SCHEMA-COUNT");
  for (const [name, schema] of Object.entries(candidate.schemas)) {
    const commandSchema = name.includes(".command.");
    const aggregate = name.replace(/\.(command|event)\.v1$/, "");
    const count = candidate.registry.commands.filter((command) => command.aggregate === aggregate).length;
    ensure(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "E-SCHEMA-DIALECT", name);
    ensure(schema.additionalProperties === false && schema.allOf.length === count, "E-SCHEMA-VARIANTS", name);
    ensure(Object.keys(schema.properties).length === 53 && schema["x-canonical-envelope"].field_count === 53 && schema["x-canonical-envelope"].domain_extensions_top_level_allowed === false, "E-SCHEMA-ENVELOPE", name);
    ensure(schema["x-authority"].runtime_admission === false, "E-SCHEMA-AUTHORITY", name);
    ensure(schema["x-privacy"].secret_material_allowed === false, "E-SCHEMA-PRIVACY", name);
    ensure(schema["x-compatibility"].unknown_version_behavior === "reject_or_quarantine", "E-SCHEMA-COMPATIBILITY", name);
    ensure(schema["x-stable-errors"].includes("E-GATE-OPEN") && schema["x-stable-errors"].includes("E-SECRET-MATERIAL"), "E-SCHEMA-ERRORS", name);
    ensure(commandSchema === (schema.properties.record_class.const === "command"), "E-SCHEMA-KIND", name);
  }
  ensure(candidate.fixtures.normal.length === 26, "E-FIXTURE-NORMAL");
  ensure(candidate.fixtures.failure.length === 104, "E-FIXTURE-FAILURE");
  ensure(candidate.fixtures.recovery.length === 26, "E-FIXTURE-RECOVERY");
  ensure(candidate.derivation.counts.commands === 26 && candidate.derivation.counts.source_surfaces === 935 && candidate.derivation.counts.schemas === 10, "E-DERIVATION-COUNTS");
  ensure(candidate.derivation.historical_singleton_disposition === "CANDIDATE_ONLY_REPLACED_BY_FAIL_CLOSED_MATRIX", "E-DERIVATION-SINGLETON");
  return { commands: 26, state_machines: 5, transitions: 26, source_surfaces: 935, schemas: 10, interfaces: 7, credential_classes: 4, journeys: 5 };
}

validateManifest(pkg.manifest);
const manifestHardening = validateManifestHardeningMutations(pkg.manifest);
const filesystemHardening = validateFilesystemDiscoveryMutations();
const closure = validatePackage(pkg);
const fixtureById = new Map(pkg.fixtures.normal.map((fixture) => [fixture.fixture_id, fixture]));
let normal = 0;
let replay = 0;
let failures = 0;
let recoveries = 0;
for (const fixture of pkg.fixtures.normal) {
  const component = new AuthoritySchemaComponent({ commandRegistry: pkg.registry, authorizationContract: pkg.authorization, gateTrace: pkg.gates });
  const commandSchema = pkg.schemas[fixture.record.record_type];
  validateRecord(commandSchema, fixture.record);
  const context = {
    current_state: fixture.current_state,
    current_sequence: fixture.current_sequence,
    active_authority_set_id: fixture.active_authority_set_id,
    active_authority_set_generation: fixture.active_authority_set_generation,
    sensitivity_class: fixture.record.sensitivity_class,
    retention_class: fixture.record.retention_class
  };
  const outcome = component.simulate(fixture.record, context);
  ensure(outcome.event.domain_payload.state === fixture.expected_state && outcome.replayed === false, "E-NORMAL-BEHAVIOR", fixture.fixture_id);
  validateRecord(pkg.schemas[outcome.event.record_type], outcome.event);
  normal += 1;
  const repeated = component.simulate(fixture.record, context);
  ensure(repeated.replayed === true && repeated.event.record_id === outcome.event.record_id, "E-REPLAY", fixture.fixture_id);
  replay += 1;
  const changed = { ...fixture.record, domain_payload: { ...fixture.record.domain_payload, canonical_payload_digest: sha256(`changed:${fixture.command_id}`) } };
  expectAuthorityError("E-REPLAY-PAYLOAD-MISMATCH", () => component.simulate(changed, context));
  recoveries += 1;
}
const mergeRecord = (base, mutation) => ({ ...base, ...mutation, ...(mutation.domain_payload ? { domain_payload: { ...base.domain_payload, ...mutation.domain_payload } } : {}) });
for (const fixture of pkg.fixtures.failure) {
  const base = fixtureById.get(fixture.base_fixture_id);
  const record = mergeRecord(base.record, fixture.mutation ?? {});
  const context = {
    current_state: base.current_state,
    current_sequence: base.current_sequence,
    active_authority_set_id: base.active_authority_set_id,
    active_authority_set_generation: base.active_authority_set_generation,
    sensitivity_class: base.record.sensitivity_class,
    retention_class: base.record.retention_class,
    ...(fixture.context_mutation ?? {})
  };
  const component = new AuthoritySchemaComponent({ commandRegistry: pkg.registry, authorizationContract: pkg.authorization, gateTrace: pkg.gates });
  expectAuthorityError(fixture.expected_error, () => component.simulate(record, context));
  failures += 1;
}
{
  const base = pkg.fixtures.normal[0];
  const component = new AuthoritySchemaComponent({ commandRegistry: pkg.registry, authorizationContract: pkg.authorization, gateTrace: pkg.gates });
  expectAuthorityError("E-SECRET-MATERIAL", () => component.validateCommand(mergeRecord(base.record, pkg.fixtures.privacy_denial.mutation)));
  expectAuthorityError("E-GATE-OPEN", () => component.assertActivationAuthorized());
  failures += 2;
}

const mutationCases = [
  ["E-COMMAND-COUNT", (value) => value.registry.commands.pop()],
  ["E-MATRIX-COUNT", (value) => value.matrix.pop()],
  ["E-MATRIX-AUTHORITY", (value) => value.matrix[0].authoritative_replacement_command_ids.push("CMD-AUTHSET-ACTIVATE")],
  ["E-GATE-AUTH", (value) => { value.gates.activation_authorized = true; }],
  ["E-INTERFACE", (value) => { value.interfaces.interfaces = value.interfaces.interfaces.filter((item) => item.id !== "FenceTokenIssuer"); }],
  ["E-CREDENTIAL-SECRET", (value) => { value.credentials.secret_material_in_package = true; }],
  ["E-SCHEMA-PRIVACY", (value) => { value.schemas["credential.command.v1"]["x-privacy"].secret_material_allowed = true; }],
  ["E-SCHEMA-ENVELOPE", (value) => { delete value.schemas["principal.event.v1"].properties.record_registry_revision; }],
  ["E-FIXTURE-RECOVERY", (value) => value.fixtures.recovery.pop()]
];
for (const [expected, mutate] of mutationCases) {
  const candidate = clone(pkg);
  mutate(candidate);
  try {
    validatePackage(candidate);
    fail("E-MUTATION-ESCAPED", expected);
  } catch (error) {
    ensure(error.code === expected, "E-MUTATION-WRONG-ERROR", `${expected}:${error.code}`);
  }
}

function validateSourceAndScope(sourceHead) {
  ensure(sourceHead === EXPECTED_SOURCE_HEAD, "E-SOURCE-HEAD");
  ensure(execFileSync("git", ["merge-base", "--is-ancestor", sourceHead, "HEAD"], { cwd: REPO }).length === 0, "E-SOURCE-ANCESTRY");
  ensure(execFileSync("git", ["merge-base", "--is-ancestor", HARDENING_SCOPE_BASE, "HEAD"], { cwd: REPO }).length === 0, "E-HARDENING-SCOPE-ANCESTRY");
  const changed = execFileSync("git", ["diff", "--name-only", `${HARDENING_SCOPE_BASE}..HEAD`], { cwd: REPO, encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const packagePrefix = "docs/audits/custodial-unified-v4-3-architecture/authority-schema-component-gate/";
  const workflow = ".github/workflows/custodial-v43-authority-schema-component.yml";
  for (const changedPath of changed) ensure(changedPath.startsWith(packagePrefix) || changedPath === workflow, "E-HARDENING-SCOPE-PATH", changedPath);
}

function validateHardeningReceipt(receipt, expected) {
  strictObject(receipt, RECEIPT_FIELDS, "E-RECEIPT");
  ensure(receipt.protocol === "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_VALIDATION_RESULT_V2", "E-RECEIPT-PROTOCOL");
  ensure(receipt.status === "PASS_NON_ACTIVATABLE", "E-RECEIPT-STATUS");
  ensure(receipt.validator === VALIDATOR_VERSION, "E-RECEIPT-VALIDATOR");
  ensure(receipt.source_head === EXPECTED_SOURCE_HEAD, "E-RECEIPT-SOURCE-HEAD");
  ensure(receipt.hardening_scope_base === HARDENING_SCOPE_BASE, "E-RECEIPT-SCOPE-BASE");
  ensure(receipt.package_manifest_sha256 === sha256(fs.readFileSync(path.join(ROOT, "package-manifest.json"))), "E-RECEIPT-MANIFEST-DIGEST");
  ensure(receipt.package_aggregate_sha256 === packageAggregate(pkg.manifest), "E-RECEIPT-PACKAGE-AGGREGATE");
  strictObject(receipt.closure, CLOSURE_FIELDS, "E-RECEIPT-CLOSURE");
  exactJson(receipt.closure, expected.closure, "E-RECEIPT-CLOSURE-VALUE");
  strictObject(receipt.behavior, BEHAVIOR_FIELDS, "E-RECEIPT-BEHAVIOR");
  exactJson(receipt.behavior, expected.behavior, "E-RECEIPT-BEHAVIOR-VALUE");
  ensure(receipt.mutation_tests === expected.mutationTests, "E-RECEIPT-MUTATION-COUNT");
  ensure(receipt.manifest_semantic_mutation_failures === expected.manifestHardening.failures, "E-RECEIPT-MANIFEST-FAILURES");
  ensure(receipt.manifest_semantic_recoveries === expected.manifestHardening.recoveries, "E-RECEIPT-MANIFEST-RECOVERIES");
  ensure(receipt.filesystem_mutation_failures === expected.filesystemHardening.failures, "E-RECEIPT-FILESYSTEM-FAILURES");
  ensure(receipt.filesystem_recoveries === expected.filesystemHardening.recoveries, "E-RECEIPT-FILESYSTEM-RECOVERIES");
  ensure(receipt.receipt_semantic_mutation_failures === RECEIPT_MUTATION_CASE_COUNT, "E-RECEIPT-SEMANTIC-FAILURES");
  ensure(receipt.receipt_semantic_recoveries === RECEIPT_MUTATION_CASE_COUNT, "E-RECEIPT-SEMANTIC-RECOVERIES");
  ensure(receipt.owned_test_residue === 0, "E-RECEIPT-RESIDUE");
  ensure(receipt.generator_check === "PASS", "E-RECEIPT-GENERATOR");
  ensure(receipt.generator_restart_self_test === "PASS", "E-RECEIPT-GENERATOR-RESTART");
  ensure(receipt.activation_authorized === false, "E-RECEIPT-ACTIVATION");
  ensure(receipt.architecture_closure === false, "E-RECEIPT-ARCHITECTURE-CLOSURE");
  ensure(receipt.earliest_open_gate === "G-EVIDENCE-001", "E-RECEIPT-EARLIEST-GATE");
  exactJson(receipt.blockers, pkg.derivation.blockers, "E-RECEIPT-BLOCKERS");
}

function validateReceiptHardeningMutations(receipt, expected) {
  const mutations = [
    ["receipt_missing_field", "E-RECEIPT-FIELDS", (candidate) => { delete candidate.status; }],
    ["receipt_extra_activation_field", "E-RECEIPT-FIELDS", (candidate) => { candidate.activation_authority = true; }],
    ["receipt_extra_architecture_closure_field", "E-RECEIPT-FIELDS", (candidate) => { candidate.closure_authorized = true; }],
    ["receipt_protocol_wrong_type", "E-RECEIPT-PROTOCOL", (candidate) => { candidate.protocol = 1; }],
    ["receipt_protocol_semantic_drift", "E-RECEIPT-PROTOCOL", (candidate) => { candidate.protocol = "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_VALIDATION_RESULT_V999"; }],
    ["receipt_status_wrong_type", "E-RECEIPT-STATUS", (candidate) => { candidate.status = false; }],
    ["receipt_status_escalated", "E-RECEIPT-STATUS", (candidate) => { candidate.status = "PASS_ACTIVATABLE"; }],
    ["receipt_validator_drift", "E-RECEIPT-VALIDATOR", (candidate) => { candidate.validator = "ACTIVATION_AUTHORITY"; }],
    ["receipt_source_head_drift", "E-RECEIPT-SOURCE-HEAD", (candidate) => { candidate.source_head = "0".repeat(40); }],
    ["receipt_scope_base_drift", "E-RECEIPT-SCOPE-BASE", (candidate) => { candidate.hardening_scope_base = "0".repeat(40); }],
    ["receipt_manifest_digest_drift", "E-RECEIPT-MANIFEST-DIGEST", (candidate) => { candidate.package_manifest_sha256 = "0".repeat(64); }],
    ["receipt_package_aggregate_drift", "E-RECEIPT-PACKAGE-AGGREGATE", (candidate) => { candidate.package_aggregate_sha256 = "0".repeat(64); }],
    ["receipt_closure_count_drift", "E-RECEIPT-CLOSURE-VALUE", (candidate) => { candidate.closure.commands = 999; }],
    ["receipt_closure_extra_field", "E-RECEIPT-CLOSURE-FIELDS", (candidate) => { candidate.closure.activation_authorized = true; }],
    ["receipt_behavior_count_drift", "E-RECEIPT-BEHAVIOR-VALUE", (candidate) => { candidate.behavior.normal = 999; }],
    ["receipt_behavior_extra_field", "E-RECEIPT-BEHAVIOR-FIELDS", (candidate) => { candidate.behavior.activation_authorized = true; }],
    ["receipt_package_mutation_count_drift", "E-RECEIPT-MUTATION-COUNT", (candidate) => { candidate.mutation_tests = 0; }],
    ["receipt_manifest_failure_count_drift", "E-RECEIPT-MANIFEST-FAILURES", (candidate) => { candidate.manifest_semantic_mutation_failures = 0; }],
    ["receipt_filesystem_failure_count_drift", "E-RECEIPT-FILESYSTEM-FAILURES", (candidate) => { candidate.filesystem_mutation_failures = 0; }],
    ["receipt_semantic_failure_count_drift", "E-RECEIPT-SEMANTIC-FAILURES", (candidate) => { candidate.receipt_semantic_mutation_failures = 0; }],
    ["receipt_residue_escalated", "E-RECEIPT-RESIDUE", (candidate) => { candidate.owned_test_residue = 1; }],
    ["receipt_generator_drift", "E-RECEIPT-GENERATOR", (candidate) => { candidate.generator_check = "SKIPPED"; }],
    ["receipt_generator_restart_drift", "E-RECEIPT-GENERATOR-RESTART", (candidate) => { candidate.generator_restart_self_test = "SKIPPED"; }],
    ["receipt_activation_escalated", "E-RECEIPT-ACTIVATION", (candidate) => { candidate.activation_authorized = true; }],
    ["receipt_architecture_closure_escalated", "E-RECEIPT-ARCHITECTURE-CLOSURE", (candidate) => { candidate.architecture_closure = true; }],
    ["receipt_earliest_gate_drift", "E-RECEIPT-EARLIEST-GATE", (candidate) => { candidate.earliest_open_gate = null; }],
    ["receipt_blockers_laundered", "E-RECEIPT-BLOCKERS", (candidate) => { candidate.blockers = []; }]
  ];
  ensure(mutations.length === RECEIPT_MUTATION_CASE_COUNT, "E-RECEIPT-MUTATION-CASE-COUNT");
  for (const [, expectedCode, mutate] of mutations) {
    const candidate = clone(receipt);
    mutate(candidate);
    expectFailure(() => validateHardeningReceipt(candidate, expected), expectedCode);
    validateHardeningReceipt(receipt, expected);
  }
  return { failures: mutations.length, recoveries: mutations.length, residue: 0, names: mutations.map(([name]) => name) };
}

const sourceHead = pkg.build.source_head;
validateSourceAndScope(sourceHead);
const behavior = { normal, replay, expected_failures: failures, recoveries };
const receiptExpected = { closure, behavior, mutationTests: mutationCases.length, manifestHardening, filesystemHardening };
const result = {
  protocol: "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_VALIDATION_RESULT_V2",
  status: "PASS_NON_ACTIVATABLE",
  validator: VALIDATOR_VERSION,
  source_head: sourceHead,
  hardening_scope_base: HARDENING_SCOPE_BASE,
  package_manifest_sha256: sha256(fs.readFileSync(path.join(ROOT, "package-manifest.json"))),
  package_aggregate_sha256: packageAggregate(pkg.manifest),
  closure,
  behavior,
  mutation_tests: mutationCases.length,
  manifest_semantic_mutation_failures: manifestHardening.failures,
  manifest_semantic_recoveries: manifestHardening.recoveries,
  filesystem_mutation_failures: filesystemHardening.failures,
  filesystem_recoveries: filesystemHardening.recoveries,
  receipt_semantic_mutation_failures: RECEIPT_MUTATION_CASE_COUNT,
  receipt_semantic_recoveries: RECEIPT_MUTATION_CASE_COUNT,
  owned_test_residue: manifestHardening.residue + filesystemHardening.residue,
  generator_check: "PASS",
  generator_restart_self_test: "PASS",
  activation_authorized: false,
  architecture_closure: false,
  earliest_open_gate: "G-EVIDENCE-001",
  blockers: pkg.derivation.blockers
};
validateHardeningReceipt(result, receiptExpected);
const receiptHardening = validateReceiptHardeningMutations(result, receiptExpected);
const resultText = `${JSON.stringify(result, null, 2)}\n`;
const resultPath = path.join(ROOT, "validation-result.json");
if (mode === "--write") {
  fs.writeFileSync(resultPath, resultText);
  ensure(fs.readFileSync(resultPath, "utf8") === resultText, "E-VALIDATION-RESULT-WRITE");
} else {
  ensure(fs.existsSync(resultPath) && fs.readFileSync(resultPath, "utf8") === resultText, "E-VALIDATION-RESULT-STALE");
  validateHardeningReceipt(read("validation-result.json"), receiptExpected);
}
if (mode === "--check-package-manifest") {
  console.log(JSON.stringify({
    protocol: "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_MANIFEST_HARDENING_RESULT_V1",
    status: "PASS_EXACT_DETERMINISTIC_BYTES",
    manifest_members: pkg.manifest.members.length,
    package_files: EXPECTED_PACKAGE_FILES.length,
    package_directories: EXPECTED_PACKAGE_DIRECTORIES.length,
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
    receipt_mutations: receiptHardening.names
  }));
} else {
  console.log(JSON.stringify(result));
}
