import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { AuthoritySchemaComponent, expectAuthorityError } from "./reference-component.mjs";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(ROOT, "../../../..");
const mode = process.argv[2] ?? "--check";
if (!new Set(["--check", "--write"]).has(mode)) throw new Error(`E-VALIDATOR-ARGUMENT: ${mode}`);
const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, name), "utf8"));
const lines = (name) => fs.readFileSync(path.join(ROOT, name), "utf8").trim().split("\n").map(JSON.parse);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const clone = (value) => JSON.parse(JSON.stringify(value));

class ValidationError extends Error {
  constructor(code, detail = "") {
    super(`${code}${detail ? `: ${detail}` : ""}`);
    this.code = code;
  }
}
const fail = (code, detail) => { throw new ValidationError(code, detail); };
const ensure = (condition, code, detail) => { if (!condition) fail(code, detail); };
const unique = (values, code, detail) => ensure(new Set(values).size === values.length, code, detail);

const generated = spawnSync(process.execPath, [path.join(ROOT, "generate-authority-schema-component.mjs"), "--check"], { cwd: REPO, encoding: "utf8" });
ensure(generated.status === 0, "E-GENERATOR-CHECK", `${generated.stdout}${generated.stderr}`.trim());

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
  ensure(manifest.activation_authorized === false, "E-MANIFEST-AUTHORITY");
  unique(manifest.members.map((member) => member.path), "E-MANIFEST-DUPLICATE", "members");
  ensure(!manifest.members.some((member) => manifest.excluded_receipts.includes(member.path)), "E-MANIFEST-CYCLE");
  for (const member of manifest.members) {
    const bytes = fs.readFileSync(path.join(ROOT, member.path));
    ensure(bytes.length === member.bytes, "E-MANIFEST-BYTES", member.path);
    ensure(sha256(bytes) === member.sha256, "E-MANIFEST-DIGEST", member.path);
  }
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

const sourceHead = pkg.build.source_head;
ensure(execFileSync("git", ["merge-base", "--is-ancestor", sourceHead, "HEAD"], { cwd: REPO }).length === 0, "E-SOURCE-ANCESTRY");
const result = {
  protocol: "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_VALIDATION_RESULT_V1",
  status: "PASS_NON_ACTIVATABLE",
  source_head: sourceHead,
  closure,
  behavior: { normal, replay, expected_failures: failures, recoveries },
  mutation_tests: mutationCases.length,
  generator_check: "PASS",
  activation_authorized: false,
  earliest_open_gate: "G-EVIDENCE-001",
  blockers: pkg.derivation.blockers
};
const resultText = `${JSON.stringify(result, null, 2)}\n`;
const resultPath = path.join(ROOT, "validation-result.json");
if (mode === "--write") fs.writeFileSync(resultPath, resultText);
else ensure(fs.existsSync(resultPath) && fs.readFileSync(resultPath, "utf8") === resultText, "E-VALIDATION-RESULT-STALE");
console.log(JSON.stringify(result));
