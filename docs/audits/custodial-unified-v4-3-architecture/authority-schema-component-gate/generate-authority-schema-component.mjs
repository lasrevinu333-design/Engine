import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(ROOT, "../../../..");
const PHASE2 = path.resolve(ROOT, "../phase2-operational-architecture");
const CONTRACTS = path.resolve(ROOT, "../../custodial-unified-v4-3/contracts");
const mode = process.argv[2] ?? "--write";
if (!new Set(["--write", "--check"]).has(mode)) throw new Error(`E-GENERATOR-ARGUMENT: ${mode}`);

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const unique = (values) => [...new Set(values)].sort();
const byId = (values, key = "id") => [...values].sort((a, b) => a[key].localeCompare(b[key]));
const git = (args) => execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();

const inputNames = {
  projection: "phase2-authority-set-activation-fencing-rollback-contract.json",
  registry: "phase2-command-record-state-machine-registry.json",
  coverage: "phase2-command-and-transition-coverage-ledger.json",
  authorization: "phase2-principal-grant-tool-authorization-contract.json",
  engine: "phase2-engine-authority-surface-inventory.json",
  backend: "phase2-backend-authority-surface-inventory.json",
  validator: "validate-phase2-operational-architecture.mjs"
};
const inputs = Object.fromEntries(
  Object.entries(inputNames).map(([key, name]) => [key, fs.readFileSync(path.join(PHASE2, name))]),
);
const parsed = Object.fromEntries(
  Object.entries(inputs).filter(([, bytes]) => bytes[0] === 123).map(([key, bytes]) => [key, JSON.parse(bytes)]),
);
const build = readJson(path.join(ROOT, "build-contract.json"));
const envelopePath = path.resolve(ROOT, "../record-envelope-canonicalization/record-envelope-contract.json");
const envelopeBytes = fs.readFileSync(envelopePath);
const envelopeContract = JSON.parse(envelopeBytes);
const gateRegistryPath = "docs/audits/custodial-unified-v4-3/contracts/custodial-unified-v4-3-gate-registry.json";
const gateRegistry = readJson(path.join(CONTRACTS, "custodial-unified-v4-3-gate-registry.json"));
const gateIds = build.authority.required_gate_chain;
const aggregates = new Set(build.target_aggregates);
const commands = byId(parsed.registry.commands.filter((command) => aggregates.has(command.aggregate)));
const commandIds = new Set(commands.map((command) => command.id));
if (commands.length !== build.expected_command_count) throw new Error(`E-TARGET-COMMAND-COUNT: ${commands.length}`);
if (parsed.projection.status !== "SUPERSEDED_BY_EXACT_REGISTRIES") throw new Error("E-PROJECTION-AUTHORITY");
if (JSON.stringify(unique(parsed.projection.command_ids)) !== JSON.stringify(unique([...commandIds]))) throw new Error("E-PROJECTION-PARITY");

const targetMachines = byId(
  parsed.registry.state_machines
    .filter((machine) => aggregates.has(machine.aggregate))
    .map((machine) => ({
      ...machine,
      transitions: byId(machine.transitions.filter((transition) => commandIds.has(transition.command_id)))
    })),
);
const transitions = new Map(targetMachines.flatMap((machine) => machine.transitions.map((transition) => [transition.command_id, transition])));
if (transitions.size !== commands.length) throw new Error("E-TARGET-TRANSITION-CLOSURE");
const targetRegistry = {
  protocol: "CUSTODIAL_V43_AUTHORITY_TARGET_COMMAND_REGISTRY_V1",
  status: "EXACT_DERIVATION_NON_ACTIVATABLE",
  source_head: build.source_head,
  source_registry_sha256: sha256(inputs.registry),
  command_count: commands.length,
  state_machine_count: targetMachines.length,
  transition_count: transitions.size,
  commands,
  state_machines: targetMachines
};

const inventory = [...parsed.engine.entries, ...parsed.backend.entries];
const inventoryById = new Map(inventory.map((row) => [row.inventory_id, row]));
const selectedCoverage = parsed.coverage.source_surfaces.filter((row) => row.command_ids.some((id) => commandIds.has(id)));
if (selectedCoverage.length !== build.expected_source_surface_count) throw new Error(`E-TARGET-SURFACE-COUNT: ${selectedCoverage.length}`);
const matrix = selectedCoverage
  .map((coverage) => {
    const source = inventoryById.get(coverage.source_surface_id);
    if (!source) throw new Error(`E-SOURCE-JOIN: ${coverage.source_surface_id}`);
    const candidates = unique(coverage.command_ids.filter((id) => commandIds.has(id)));
    const declaredSelfReference = source.callers.length === 1 && source.callers[0] === source.symbol;
    return {
      matrix_id: `MATRIX-${source.inventory_id}`,
      source_surface_id: source.inventory_id,
      source_definition: {
        repository: source.source_repository,
        commit: source.source_commit,
        tree: source.source_tree,
        path: source.path,
        line: source.line,
        symbol: source.symbol,
        method: source.method,
        target: source.target,
        git_blob_sha1: source.git_blob_sha1,
        file_sha256: source.file_sha256,
        definition_sha256: source.definition_sha256,
        proof_status: source.source_proof_status
      },
      caller_evidence: {
        actual_callers: [],
        declared_phase2_candidates: source.callers,
        status: "UNRESOLVED_FAIL_CLOSED",
        reason: declaredSelfReference
          ? "DECLARED_CALLER_IS_SELF_REFERENCE_NOT_CALL_GRAPH"
          : "DECLARED_CALLERS_LACK_SOURCE_NATIVE_CALL_GRAPH_PROOF"
      },
      mutation_semantics: {
        category: source.category,
        mutation_class: source.mutation_class,
        domain: source.domain,
        classification_basis: source.classification_basis
      },
      historical_candidate_assignments: candidates.map((id) => ({
        command_id: id,
        aggregate: parsed.registry.commands.find((command) => command.id === id)?.aggregate ?? null
      })),
      authoritative_replacement_command_ids: [],
      disposition: {
        action: "FAIL_CLOSED_RETIRE_PENDING_SOURCE_NATIVE_CALL_GRAPH",
        runtime_admission: false,
        architecture_activation_admission: false,
        fence_before_replacement: true,
        denial_proof_fixture_id: source.denial_proof_fixture_id,
        migration_order: source.migration_order,
        rollback: source.rollback,
        residual_gate: "G-EVIDENCE-001"
      },
      evidence: {
        inventory_status: source.classification_status,
        research_gate: source.research_gate,
        original_runtime_admission: source.runtime_admission,
        coverage_ledger_sha256: sha256(inputs.coverage)
      }
    };
  })
  .sort((a, b) => a.source_surface_id.localeCompare(b.source_surface_id));
if (new Set(matrix.map((row) => row.source_surface_id)).size !== matrix.length) throw new Error("E-MATRIX-DUPLICATE");

const countBy = (values, select) => Object.entries(values.reduce((out, value) => {
  const key = select(value);
  out[key] = (out[key] ?? 0) + 1;
  return out;
}, {})).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ key, count }));
const matrixSummary = {
  protocol: "CUSTODIAL_V43_AUTHORITY_SOURCE_SEMANTIC_MATRIX_SUMMARY_V1",
  status: "COMPLETE_FAIL_CLOSED_DISPOSITION",
  rows: matrix.length,
  unique_source_surfaces: new Set(matrix.map((row) => row.source_surface_id)).size,
  authoritative_command_assignments: matrix.filter((row) => row.authoritative_replacement_command_ids.length).length,
  fail_closed_retirements: matrix.filter((row) => !row.disposition.runtime_admission).length,
  unresolved_actual_callers: matrix.filter((row) => row.caller_evidence.status !== "VERIFIED").length,
  self_referential_declared_callers: matrix.filter((row) => row.caller_evidence.reason === "DECLARED_CALLER_IS_SELF_REFERENCE_NOT_CALL_GRAPH").length,
  by_repository: countBy(matrix, (row) => row.source_definition.repository),
  by_mutation_class: countBy(matrix, (row) => row.mutation_semantics.mutation_class),
  by_category: countBy(matrix, (row) => row.mutation_semantics.category),
  invariant: "No historical singleton assignment is authoritative without source-native definition and caller proof. Missing proof retires the surface fail-closed."
};

const aggregateMeta = {
  "authority-set": { sensitivity: "INTERNAL_SECURITY", retention: "SECURITY_AUDIT_7Y" },
  credential: { sensitivity: "SECRET_METADATA_NO_SECRET_MATERIAL", retention: "CREDENTIAL_METADATA_7Y" },
  grant: { sensitivity: "RESTRICTED_AUTHORIZATION", retention: "AUTHORIZATION_7Y" },
  "manager-session": { sensitivity: "RESTRICTED_SESSION", retention: "SESSION_SECURITY_2Y" },
  principal: { sensitivity: "RESTRICTED_IDENTITY", retention: "IDENTITY_LIFECYCLE_7Y" }
};
const idSchema = { type: "string", minLength: 1, maxLength: 256, pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" };
const digestSchema = { type: "string", pattern: "^[0-9a-f]{64}$" };
const dateSchema = { type: "string", format: "date-time" };
const contextProperties = {
  assignment_epoch: { type: "integer", minimum: 0 },
  authority_set_generation: { type: "integer", minimum: 0 },
  authority_set_id: idSchema,
  authorization_decision_id: idSchema,
  canonical_payload_digest: digestSchema,
  capability_id: idSchema,
  command_id: idSchema,
  compatibility_matrix_digest: digestSchema,
  credential_class: { enum: ["EMPLOYEE_DEVICE", "MANAGER_DEVICE", "RELEASE_SERVICE", "SECURITY_ADMIN"] },
  credential_id: idSchema,
  dependency_graph_digest: digestSchema,
  effective_at: dateSchema,
  expected_aggregate_sequence: { type: "integer", minimum: 0 },
  expires_at: dateSchema,
  fence_token: { type: "integer", minimum: 0 },
  grant_id: idSchema,
  issued_at: dateSchema,
  manager_id: idSchema,
  principal_class: { enum: ["EMPLOYEE", "MANAGER", "RELEASE_SERVICE", "SECURITY_ADMIN"] },
  principal_id: idSchema,
  producer_version: idSchema,
  release_tuple_id: idSchema,
  resource_scope: { type: "string", minLength: 1, maxLength: 1024 },
  rollback_tuple_id: idSchema,
  session_id: idSchema,
  trusted_device_id: idSchema
};
const envelopeProperty = (field) => {
  const rules = {
    string: { type: "string", minLength: 1 },
    integer: { type: "integer", minimum: 0 },
    timestamp: dateSchema,
    timestamp_or_null: { type: ["string", "null"], format: "date-time" },
    date: { type: "string", format: "date" },
    string_or_null: { type: ["string", "null"] },
    sha256: digestSchema,
    array_string: { type: "array", items: idSchema, uniqueItems: true },
    object: { type: "object" }
  };
  const rule = structuredClone(rules[field.json_type]);
  if (!rule) throw new Error(`E-ENVELOPE-TYPE: ${field.name}:${field.json_type}`);
  rule.description = field.semantics;
  return rule;
};
const canonicalEnvelopeProperties = Object.fromEntries(envelopeContract.envelope.fields.map((field) => [field.name, envelopeProperty(field)]));
const canonicalEnvelopeRequired = envelopeContract.envelope.fields
  .filter((field) => field.presence === "wire_required" || field.presence === "registry_inherited")
  .map((field) => field.name);
const authorityContextRequired = ["aggregate_sequence", "authorization_decision_id", "authorization_snapshot_digest", "credential_id", "session_id"];

const makeDomainPayload = (aggregate, kind, aggregateCommands) => {
  const properties = {
    ...contextProperties,
    grant_id: { enum: unique(aggregateCommands.map((command) => command.grant)) },
    tool_id: { enum: unique(aggregateCommands.map((command) => command.tool))
    }
  };
  properties.command_id = { enum: aggregateCommands.map((command) => command.id) };
  if (kind === "event") Object.assign(properties, {
    command_record_id: idSchema,
    event_type: { enum: aggregateCommands.map((command) => command.id.replace(/^CMD-/, "EVT-")) },
    prior_state: { enum: unique(aggregateCommands.flatMap((command) => command.allowed_from_states)) },
    state: { enum: unique(aggregateCommands.map((command) => command.success_state)) },
    outcome: { const: "COMMITTED" }
  });
  return { type: "object", additionalProperties: false, required: ["command_id", "grant_id", "tool_id"], properties };
};

const makeProperties = (aggregate, kind, aggregateCommands) => {
  const meta = aggregateMeta[aggregate];
  const properties = {
    ...structuredClone(canonicalEnvelopeProperties),
    record_class: { const: kind },
    record_type: { const: `${aggregate}.${kind}.v1` },
    schema_version: { const: "v1" },
    record_registry_revision: { const: "authority-schema-component.v1" },
    aggregate_type: { const: aggregate },
    source_domain: { const: "SECURITY_AUTHORITY" },
    source_contract_revision: { const: "authority-schema-component.v1" },
    ordering_rule: { const: "aggregate_sequence" },
    valid_time_kind: { const: "instant" },
    sensitivity_class: { const: meta.sensitivity },
    retention_class: { const: meta.retention },
    domain_payload: makeDomainPayload(aggregate, kind, aggregateCommands),
    hash_algorithm: { const: "sha-256" },
    canonicalization_version: { const: "canonical-json.v1" },
    replay_compatibility: { const: "v1-only-idempotent-replay" },
    projection_compatibility: { const: "rebuild-from-events-v1" },
    unknown_version_behavior: { const: "reject_or_quarantine" }
  };
  return properties;
};
const makeSchema = (aggregate, kind) => {
  const aggregateCommands = commands.filter((command) => command.aggregate === aggregate);
  const meta = aggregateMeta[aggregate];
  const properties = makeProperties(aggregate, kind, aggregateCommands);
  const variants = aggregateCommands.map((command) => ({
    if: { properties: { domain_payload: { properties: { command_id: { const: command.id } }, required: ["command_id"] } }, required: ["domain_payload"] },
    then: {
      properties: {
        domain_payload: {
          required: unique([
            ...command.required_context,
            "command_id", "grant_id", "tool_id",
            ...(kind === "event" ? ["command_record_id", "event_type", "prior_state", "state", "outcome"] : [])
          ]),
          properties: kind === "event" ? {
            command_id: { const: command.id },
            event_type: { const: command.id.replace(/^CMD-/, "EVT-") },
            prior_state: { enum: command.allowed_from_states },
            state: { const: command.success_state },
            principal_id: { const: command.principal },
            grant_id: { const: command.grant },
            tool_id: { const: command.tool }
          } : {
            command_id: { const: command.id },
            principal_id: { const: command.principal },
            grant_id: { const: command.grant },
            tool_id: { const: command.tool }
          }
        }
      }
    }
  }));
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://custodial.invalid/schemas/${aggregate}.${kind}.v1.schema.json`,
    title: `${aggregate}.${kind}.v1`,
    description: "Policy-gated candidate schema; validation-only and not runtime-admitted.",
    type: "object",
    additionalProperties: false,
    required: unique([
      ...canonicalEnvelopeRequired,
      ...authorityContextRequired,
      ...(aggregate === "manager-session" ? ["device_id"] : []),
      ...(aggregate === "credential" ? ["assignment_epoch_id"] : [])
    ]),
    properties,
    allOf: variants,
    "x-state-evidence": aggregateCommands.map((command) => ({
      command_id: command.id,
      allowed_from_states: command.allowed_from_states,
      success_state: command.success_state,
      state_machine: command.state_machine
    })),
    "x-stable-errors": unique([
      "E-SCHEMA", "E-UNKNOWN-COMMAND", "E-AUTHORIZATION-DENIED", "E-AUTHORITY-GENERATION",
      "E-SEQUENCE-CONFLICT", "E-STATE-PRECONDITION", "E-REPLAY-PAYLOAD-MISMATCH", "E-GATE-OPEN",
      "E-SECRET-MATERIAL", ...aggregateCommands.flatMap((command) => command.failure_codes)
    ]),
    "x-compatibility": {
      version: 1,
      reader_rule: "exact registered version only",
      unknown_version_behavior: "reject_or_quarantine",
      additive_change_rule: "new optional field requires registry revision and fixture",
      breaking_change_rule: "new record version and explicit adapter; never reinterpret v1"
    },
    "x-privacy": {
      sensitivity_class: meta.sensitivity,
      retention_class: meta.retention,
      secret_material_allowed: false,
      redaction: "identifiers may be retained only for authorization evidence; presentation logs use digests"
    },
    "x-canonical-envelope": {
      contract_id: envelopeContract.envelope.contract_id,
      contract_sha256: sha256(envelopeBytes),
      field_count: envelopeContract.envelope.fields.length,
      domain_extensions_top_level_allowed: false,
      condition_dispositions: {
        "COND-AGGREGATE-SEQUENCE": "APPLIES",
        "COND-VALID-INTERVAL": "NOT_APPLICABLE_INSTANT_ONLY",
        "COND-SERVICE-TIME": "NOT_APPLICABLE_NO_TARGET_COMMAND_REQUIRES_SERVICE_TIME",
        "COND-DST-AMBIGUOUS": "NOT_APPLICABLE_WITHOUT_SERVICE_TIME",
        "COND-AUTHORIZATION": "APPLIES",
        "COND-CREDENTIAL-CONTEXT": "APPLIES",
        "COND-SESSION-CONTEXT": "APPLIES",
        "COND-DEVICE-CONTEXT": aggregate === "manager-session" ? "APPLIES" : "NOT_APPLICABLE_NO_DEVICE_CONTEXT_IN_EXACT_COMMANDS",
        "COND-ASSIGNMENT-EPOCH": aggregate === "credential" ? "APPLIES" : "NOT_APPLICABLE_NO_ASSIGNMENT_CONTEXT_IN_EXACT_COMMANDS",
        "COND-SOURCE-EVIDENCE": "NOT_APPLICABLE_NATIVE_COMMAND_OR_EVENT_NOT_IMPORTED_EVIDENCE"
      }
    },
    "x-authority": {
      runtime_admission: false,
      activation_gate: "G-AUTHSET-001",
      earliest_open_gate: "G-EVIDENCE-001"
    }
  };
};

const schemas = new Map();
for (const aggregate of build.target_aggregates) {
  for (const kind of ["command", "event"]) schemas.set(`schemas/${aggregate}.${kind}.v1.schema.json`, makeSchema(aggregate, kind));
}

const snapshot = (commit) => {
  const registry = JSON.parse(git(["show", `${commit}:${gateRegistryPath}`]));
  return {
    commit,
    subject: git(["show", "-s", "--format=%s", commit]),
    gates: gateIds.map((gateId) => {
      const gate = registry.gates.find((candidate) => candidate.gate_id === gateId);
      if (!gate) throw new Error(`E-GATE-SNAPSHOT: ${commit}:${gateId}`);
      return { gate_id: gateId, status: gate.status, prerequisite_gate_ids: gate.prerequisite_gate_ids };
    })
  };
};
const registryLineageSnapshots = [
  "f755b86653d892149fe877f03ac103cbc9a7bcfc",
  "b4461a8139a8e054b64e360892b084f440a87b6d",
  "6cb27912e0fd79533ee6c92cba2632806cfc306a"
].map(snapshot);
const admissionSnapshots = [
  "802c567d4b28c37b95136ebc07677997bb95c183",
  "8a809ca1ce9b2e94c127329c9c0b6aedd12c2697",
  build.source_head
].map(snapshot);
const currentGateChain = gateIds.map((gateId) => {
  const gate = gateRegistry.gates.find((candidate) => candidate.gate_id === gateId);
  return {
    gate_id: gateId,
    status: gate.status,
    prerequisite_gate_ids: gate.prerequisite_gate_ids,
    decision_authority_capability: gate.decision_authority_capability,
    design_impact: gate.design_impact
  };
});
const gateTrace = {
  protocol: "CUSTODIAL_V43_AUTHORITY_GATE_HISTORY_TRACE_V1",
  status: "COMPLETE_TRACE_BLOCKED_OPEN_ROOT",
  canonical_registry_sha256: sha256(fs.readFileSync(path.join(CONTRACTS, "custodial-unified-v4-3-gate-registry.json"))),
  activation_authorized: false,
  earliest_failed_invariant: {
    gate_id: "G-EVIDENCE-001",
    status: "OPEN",
    reason: "The canonical root gate was OPEN before exact Phase-2 artifacts were admitted and has no append-only closure decision."
  },
  pre_registry_origin: {
    commit: "1c306bcaedaef2dcc456e14116709709d7a894af",
    gate_registry_present: false,
    evidence: "git object lookup confirms the canonical gate registry did not yet exist at the standalone v4.3 architecture commit"
  },
  registry_lineage_snapshots: registryLineageSnapshots,
  current_gate_chain: currentGateChain,
  admission_snapshots: admissionSnapshots,
  decision_event_audit: {
    close_or_supersede_events_for_required_gates: [],
    status: "NO_CANONICAL_DECISION_EVENTS_PRESENT",
    evidence: "The controlling registry defines a decision schema and transition rules but contains no decision-event collection; all required gates remain statically OPEN at each admission snapshot."
  },
  invariant: "Schema/component artifacts may be generated for review, but activation is denied until append-only authorized decisions close every prerequisite."
};

const componentInterfaces = {
  protocol: "CUSTODIAL_V43_AUTHORITY_COMPONENT_INTERFACE_CONTRACT_V1",
  status: "COMPLETE_TARGET_CONTRACT_POLICY_GATED",
  runtime_admission: false,
  transaction_invariant: "authorization decision, command acceptance, aggregate sequence, event append, evidence receipt, and outbox intents commit atomically; external effects reconcile separately",
  interfaces: [
    { id: "AuthorityGenerationStore", owner: "control-plane persistence", operations: ["readActive", "compareAndActivate", "quarantineMixed", "restorePrior"], invariant: "one active generation; compare-and-swap; prior generation immutable", failure: "E-AUTHORITY-GENERATION", recovery: "quarantine then authorized rollback" },
    { id: "FenceTokenIssuer", owner: "control-plane persistence", operations: ["issueMonotonic"], invariant: "strictly increasing durable token scoped to authority set; never wall-clock derived", failure: "E-AUTHSET-FENCE", recovery: "retry transaction without reusing a token" },
    { id: "AuthorizationDecisionStore", owner: "security control plane", operations: ["appendDecision", "readDecision"], invariant: "append-only decision binds actor, credential, grant, tool, command, resource, policy revision, and generation", failure: "E-AUTHORIZATION-DENIED", recovery: "new decision; never mutate denial" },
    { id: "AggregateCommandStore", owner: "domain persistence", operations: ["acceptAtExactSequence", "readByIdempotencyKey"], invariant: "exact sequence and payload-digest replay identity", failure: "E-SEQUENCE-CONFLICT", recovery: "reload state and issue a new command or replay identical bytes" },
    { id: "AtomicEventOutbox", owner: "domain persistence", operations: ["appendEventAndOutbox"], invariant: "event, evidence, sequence, and outbox are one transaction", failure: "E-ATOMIC-WRITE", recovery: "rollback transaction and retry identical command" },
    { id: "OutboxReconciler", owner: "operations runtime", operations: ["lease", "deliver", "recordReceipt", "release"], invariant: "idempotent external effect keyed by immutable intent; bounded lease", failure: "E-OUTBOX-AMBIGUOUS", recovery: "reconcile provider receipt before retry" },
    { id: "RollbackReceiptStore", owner: "control-plane persistence", operations: ["appendRequest", "appendExecution", "appendVerification"], invariant: "request, execution, restored generation, fence token, affected aggregates, and verification are append-only", failure: "E-ROLLBACK-INCOMPLETE", recovery: "remain quarantined until receipt closure" }
  ],
  frozen_backend_boundary: {
    implementation_selected: false,
    migration_authorized: false,
    required_before_activation: ["named service owners", "database transaction adapter", "monotonic token proof", "outbox ambiguity reconciliation proof", "rollback receipt persistence proof"]
  }
};

const credentialLifecycle = {
  protocol: "CUSTODIAL_V43_TARGET_CREDENTIAL_LIFECYCLE_CONTRACT_V1",
  status: "COMPLETE_TARGETS_POLICY_GATED",
  secret_material_in_package: false,
  mechanisms: [
    { principal_class: "EMPLOYEE", issuer: "security control plane after named enrollment authority decision", storage_and_presentation: "non-exportable device key; signed nonce; public key and metadata server-side", rotation: "overlapping replacement followed by explicit completion and old-key revocation", revocation: "immediate credential event plus session invalidation", expiry: "bounded credential metadata expiry", recovery: "manager-assisted re-enrollment with old credential revoked", legacy_adapter: "read-only identity bridge; no authority issuance" },
    { principal_class: "MANAGER", issuer: "security control plane after manager identity proof", storage_and_presentation: "WebAuthn/passkey or hardware-backed native key; short bounded session", rotation: "new authenticator verified before old authenticator revocation", revocation: "credential and all manager sessions revoked", expiry: "session expiry mandatory; credential policy expiry recorded", recovery: "security-admin supervised re-enrollment; no shared PIN", legacy_adapter: "existing trusted-device identity may present only through a fenced adapter" },
    { principal_class: "RELEASE_SERVICE", issuer: "workload identity authority bound to immutable release-service principal", storage_and_presentation: "short-lived workload assertion; no repository or client secret", rotation: "automatic issuer-key and workload assertion rotation", revocation: "disable workload principal and reject outstanding assertions", expiry: "short-lived assertion required", recovery: "re-provision workload identity after security review", legacy_adapter: "static release tokens prohibited" },
    { principal_class: "SECURITY_ADMIN", issuer: "separate security authority with named-person evidence", storage_and_presentation: "hardware-backed phishing-resistant credential and bounded step-up session", rotation: "two-credential overlap only during audited rotation", revocation: "immediate credential, grant, and session revocation", expiry: "step-up session expires rapidly; credential policy expiry recorded", recovery: "independent recovery authority; no self-recovery", legacy_adapter: "shared administrator credentials prohibited" }
  ],
  acceptance_state: "TARGET_MECHANISMS_REQUIRE_G_PRINCIPAL_001_DECISION",
  stable_errors: ["E-CREDENTIAL-ISSUE", "E-CREDENTIAL-ROTATE", "E-CREDENTIAL-ROTATE-COMPLETE", "E-CREDENTIAL-REVOCATION", "E-CREDENTIAL-EXPIRY", "E-SECRET-MATERIAL"]
};

const journeys = {
  protocol: "CUSTODIAL_V43_AUTHORITY_JOURNEY_RECOVERY_CONTRACT_V1",
  status: "COMPLETE_TARGET_JOURNEYS_POLICY_GATED",
  journeys: [
    { id: "AUTHORITY-ACTIVATION", actor: "release service", normal: ["prepare", "validate compatibility", "issue monotonic fence", "activate", "confirm health", "drain prior", "retire prior"], failure: ["deny stale generation or fence", "quarantine mixed generation", "preserve prior generation"], recovery: ["request rollback", "execute rollback", "verify rollback receipt", "retire failed generation"] },
    { id: "MIXED-GENERATION-QUARANTINE", actor: "release service", normal: ["detect mixed generation", "stop new work", "append quarantine event"], failure: ["ambiguous in-flight effects remain fenced"], recovery: ["reconcile in-flight work", "rollback or revalidate", "append verification receipt"] },
    { id: "AUTHORITY-ROLLBACK", actor: "release service with restore separation", normal: ["request", "authorize", "restore prior generation with newer fence", "verify"], failure: ["incomplete receipt keeps system quarantined"], recovery: ["reconcile every affected aggregate and outbox intent", "append closure receipt"] },
    { id: "PRINCIPAL-CREDENTIAL-GRANT-ADMIN", actor: "security admin", normal: ["register principal", "issue credential", "issue bounded grant"], failure: ["deny self-grant, unknown scope, expired credential, or dependency conflict"], recovery: ["revoke grant", "rotate or revoke credential", "retire or revoke principal without history rewrite"] },
    { id: "MANAGER-SESSION-REFRESH", actor: "manager", normal: ["open with trusted device", "require refresh", "refresh with live credential"], failure: ["deny stale assignment, revoked credential, wrong device, or expired session"], recovery: ["re-authenticate", "open new session", "leave prior session closed or revoked"] }
  ],
  privacy: "Journeys display stable reason codes and recovery actions; they never expose credential material, secret values, or unrestricted authorization evidence."
};

const rollout = {
  protocol: "CUSTODIAL_V43_AUTHORITY_ACTIVATION_ROLLOUT_CONTRACT_V1",
  status: "BLOCKED_OPEN_GATES",
  activation_authorized: false,
  stages: [
    { stage: "schema-review", admission: "local schema and fixture validation", rollback: "regenerate from exact registries" },
    { stage: "component-validation", admission: "validation-only reference behavior and interface owner review", rollback: "discard candidate package" },
    { stage: "shadow", admission: "requires all canonical prerequisites CLOSED and separate runtime authorization", rollback: "disable shadow consumer; no authority effect" },
    { stage: "activation", admission: "requires monotonic fence, compatibility quorum, rollback tuple, named authority decision, and migration authorization", rollback: "quarantine and restore prior generation with newer fence" }
  ],
  scheduling: { concurrent_activation: false, prior_generation_drain_required: true, mixed_generation_behavior: "QUARANTINE", external_effects: "outbox reconciliation only" },
  closed_scope: build.closed_scope
};

const sampleFor = (field, command, index) => {
  const suffix = `${command.aggregate}-${index}`;
  const digest = sha256(`${command.id}:${field}`);
  const values = {
    assignment_epoch: 11,
    authority_set_generation: 7,
    authority_set_id: "authority-set:7",
    authorization_decision_id: `authz:${suffix}`,
    canonical_payload_digest: sha256(`payload:${command.id}`),
    capability_id: `capability:${suffix}`,
    command_id: command.id,
    compatibility_matrix_digest: digest,
    credential_class: "MANAGER_DEVICE",
    credential_id: `credential:${suffix}`,
    dependency_graph_digest: digest,
    effective_at: "2026-08-07T12:00:00.000Z",
    expected_aggregate_sequence: 0,
    expires_at: "2026-08-07T13:00:00.000Z",
    fence_token: 7001,
    grant_id: command.grant,
    issued_at: "2026-08-07T12:00:00.000Z",
    manager_id: "manager:fixture",
    principal_class: "MANAGER",
    principal_id: command.principal,
    producer_version: "authority-schema-component.v1",
    release_tuple_id: "release:fixture",
    resource_scope: "memphis-zoo:fixture",
    rollback_tuple_id: "rollback:fixture",
    session_id: `session:${suffix}`,
    trusted_device_id: "device:fixture"
  };
  return values[field];
};
const normalFixtures = commands.map((command, index) => {
  const meta = aggregateMeta[command.aggregate];
  const domainPayload = { command_id: command.id, grant_id: command.grant, tool_id: command.tool };
  for (const field of command.required_context) domainPayload[field] = sampleFor(field, command, index);
  const issuedAt = domainPayload.issued_at;
  const record = {
    record_id: `command:${command.id.toLowerCase()}`,
    record_class: "command",
    record_type: command.input_record,
    schema_version: "v1",
    record_registry_revision: "authority-schema-component.v1",
    authority_set_id: domainPayload.authority_set_id,
    authority_set_generation: domainPayload.authority_set_generation,
    source_domain: "SECURITY_AUTHORITY",
    source_contract_revision: "authority-schema-component.v1",
    aggregate_type: command.aggregate,
    aggregate_id: `${command.aggregate}:fixture-${index}`,
    ordering_rule: "aggregate_sequence",
    aggregate_sequence: domainPayload.expected_aggregate_sequence,
    valid_time_kind: "instant",
    valid_time_start: issuedAt,
    recorded_at: issuedAt,
    occurred_at: issuedAt,
    operation_id: command.id,
    idempotency_key: `idempotency:${command.id.toLowerCase()}`,
    correlation_id: `correlation:${command.id.toLowerCase()}`,
    causation_id: null,
    principal_id: domainPayload.principal_id,
    actor_snapshot_digest: sha256(`actor:${command.principal}`),
    authorization_decision_id: domainPayload.authorization_decision_id,
    authorization_snapshot_digest: sha256(`authorization:${command.id}`),
    credential_id: domainPayload.credential_id,
    session_id: domainPayload.session_id,
    supersedes_record_ids: [],
    corrects_record_ids: [],
    voids_record_ids: [],
    derives_from_record_ids: [],
    sensitivity_class: meta.sensitivity,
    retention_class: meta.retention,
    domain_payload: domainPayload,
    source_bytes_digest: sha256(`source:${command.id}`),
    normalized_content_digest: sha256(`normalized:${command.id}`),
    payload_digest: sha256(JSON.stringify(domainPayload)),
    hash_algorithm: "sha-256",
    canonicalization_version: "canonical-json.v1",
    producer_release_id: "authority-schema-component.v1",
    replay_compatibility: "v1-only-idempotent-replay",
    projection_compatibility: "rebuild-from-events-v1",
    unknown_version_behavior: "reject_or_quarantine"
  };
  if (command.aggregate === "manager-session") record.device_id = domainPayload.trusted_device_id;
  if (command.aggregate === "credential") record.assignment_epoch_id = `assignment-epoch:${domainPayload.assignment_epoch ?? 0}`;
  return {
    fixture_id: `FIX-AUTHORITY-NORMAL-${command.id}`,
    command_id: command.id,
    current_state: command.allowed_from_states[0],
    current_sequence: 0,
    active_authority_set_id: "authority-set:7",
    active_authority_set_generation: 7,
    expected_state: command.success_state,
    record
  };
});
const failureFixtures = normalFixtures.flatMap((fixture) => [
  { fixture_id: `${fixture.fixture_id}-AUTH`, base_fixture_id: fixture.fixture_id, mutation: { principal_id: "P-READ-ONLY", domain_payload: { principal_id: "P-READ-ONLY" } }, expected_error: "E-AUTHORIZATION-DENIED" },
  { fixture_id: `${fixture.fixture_id}-GENERATION`, base_fixture_id: fixture.fixture_id, mutation: { authority_set_generation: 6, domain_payload: { authority_set_generation: 6 } }, expected_error: "E-AUTHORITY-GENERATION" },
  { fixture_id: `${fixture.fixture_id}-SEQUENCE`, base_fixture_id: fixture.fixture_id, mutation: { domain_payload: { expected_aggregate_sequence: 1 } }, expected_error: "E-SEQUENCE-CONFLICT" },
  { fixture_id: `${fixture.fixture_id}-STATE`, base_fixture_id: fixture.fixture_id, context_mutation: { current_state: "__INVALID__" }, expected_error: "E-STATE-PRECONDITION" }
]);
const fixtures = {
  protocol: "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_FIXTURES_V1",
  status: "COMPLETE_VALIDATION_ONLY",
  normal: normalFixtures,
  failure: failureFixtures,
  recovery: normalFixtures.map((fixture) => ({ fixture_id: `FIX-AUTHORITY-RECOVERY-${fixture.command_id}`, base_fixture_id: fixture.fixture_id, behavior: "IDENTICAL_REPLAY", expected_replayed: true })),
  activation_denial: { fixture_id: "FIX-AUTHORITY-ACTIVATION-DENIED-OPEN-GATE", expected_error: "E-GATE-OPEN", earliest_open_gate: "G-EVIDENCE-001" },
  privacy_denial: { fixture_id: "FIX-AUTHORITY-SECRET-MATERIAL-DENIED", base_fixture_id: normalFixtures[0].fixture_id, mutation: { domain_payload: { credential_material_secret: null } }, expected_error: "E-SECRET-MATERIAL" }
};

const derivation = {
  protocol: "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_DERIVATION_RECEIPT_V1",
  status: "COMPLETE_NON_ACTIVATABLE_DERIVATION",
  source_head: build.source_head,
  inputs: [
    ...Object.entries(inputNames).map(([key, name]) => ({ key, path: `../phase2-operational-architecture/${name}`, sha256: sha256(inputs[key]) })),
    { key: "canonical_record_envelope", path: "../record-envelope-canonicalization/record-envelope-contract.json", sha256: sha256(envelopeBytes) }
  ],
  lineage: [
    { commit: "802c567d4b28c37b95136ebc07677997bb95c183", role: "signed fail-closed source dispositions" },
    { commit: "8a809ca1ce9b2e94c127329c9c0b6aedd12c2697", role: "exact command/state registry and mechanically balanced singleton candidates" },
    { commit: build.source_head, role: "accepted PR135 green source and workflow ownership repair" }
  ],
  algorithm: [
    "select commands whose aggregate is one of the five build-contract targets",
    "require exact command-to-transition closure",
    "select every coverage row containing at least one target command",
    "join each selected row to one frozen source inventory definition",
    "reject declared callers as authority unless source-native call-graph proof exists",
    "replace every unproven singleton assignment with explicit fail-closed retirement",
    "derive ten schemas, fixtures, interfaces, lifecycle targets, and journeys from the exact target registry"
  ],
  historical_singleton_disposition: "CANDIDATE_ONLY_REPLACED_BY_FAIL_CLOSED_MATRIX",
  counts: { commands: commands.length, state_machines: targetMachines.length, transitions: transitions.size, source_surfaces: matrix.length, schemas: schemas.size, canonical_envelope_fields: envelopeContract.envelope.fields.length },
  activation_authorized: false,
  blockers: ["canonical prerequisite gates remain OPEN", "source-native actual caller proof is absent for all selected surfaces", "runtime owners and adapters are not accepted", "credential mechanisms require G-PRINCIPAL-001 decision"]
};

const outputs = new Map([
  ["target-command-registry.json", json(targetRegistry)],
  ["source-surface-semantic-matrix.jsonl", `${matrix.map((row) => JSON.stringify(row)).join("\n")}\n`],
  ["source-surface-semantic-summary.json", json(matrixSummary)],
  ["gate-history-trace.json", json(gateTrace)],
  ["component-interface-contract.json", json(componentInterfaces)],
  ["credential-lifecycle-contract.json", json(credentialLifecycle)],
  ["journey-and-recovery-contract.json", json(journeys)],
  ["activation-and-rollout-contract.json", json(rollout)],
  ["conformance-fixtures.json", json(fixtures)],
  ["derivation-receipt.json", json(derivation)],
  ...[...schemas.entries()].map(([name, schema]) => [name, json(schema)])
]);

const handAuthored = ["README.md", "build-contract.json", "generate-authority-schema-component.mjs", "reference-component.mjs", "validate-authority-schema-component.mjs"];
const manifestMembers = [
  ...[...outputs.entries()].map(([name, text]) => ({ path: name, bytes: Buffer.byteLength(text), sha256: sha256(text), generated: true })),
  ...handAuthored.map((name) => {
    const bytes = fs.readFileSync(path.join(ROOT, name));
    return { path: name, bytes: bytes.length, sha256: sha256(bytes), generated: false };
  })
].sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  protocol: "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_PACKAGE_MANIFEST_V1",
  status: "COMPLETE_NON_ACTIVATABLE_PACKAGE",
  source_head: build.source_head,
  activation_authorized: false,
  members: manifestMembers,
  excluded_receipts: ["package-manifest.json", "validation-result.json"],
  invariant: "Manifest and validation receipts cannot authorize activation or participate in their own digest closure."
};
outputs.set("package-manifest.json", json(manifest));

const mismatches = [];
for (const [name, text] of outputs) {
  const file = path.join(ROOT, name);
  if (mode === "--write") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  } else if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) mismatches.push(name);
}
if (mismatches.length) throw new Error(`E-GENERATED-STALE: ${mismatches.join(",")}`);
console.log(JSON.stringify({
  protocol: "CUSTODIAL_V43_AUTHORITY_SCHEMA_COMPONENT_GENERATOR_V1",
  status: mode === "--write" ? "WROTE" : "PASS",
  commands: commands.length,
  state_machines: targetMachines.length,
  transitions: transitions.size,
  source_surfaces: matrix.length,
  fail_closed_retirements: matrixSummary.fail_closed_retirements,
  schemas: schemas.size,
  activation_authorized: false
}));
