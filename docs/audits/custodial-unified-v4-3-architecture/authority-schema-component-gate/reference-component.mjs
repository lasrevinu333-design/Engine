import crypto from "node:crypto";

const FORBIDDEN_SECRET_KEY = /(^|_)(secret|password|private_key|access_token|refresh_token|credential_material)(_|$)/i;
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export class AuthorityComponentError extends Error {
  constructor(code, detail = "") {
    super(`${code}${detail ? `: ${detail}` : ""}`);
    this.name = "AuthorityComponentError";
    this.code = code;
  }
}

function fail(code, detail) {
  throw new AuthorityComponentError(code, detail);
}

function ensure(condition, code, detail) {
  if (!condition) fail(code, detail);
}

function findSecretMaterial(value, path = "$") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSecretMaterial(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SECRET_KEY.test(key)) return `${path}.${key}`;
    const found = findSecretMaterial(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function eventType(commandId) {
  return commandId.replace(/^CMD-/, "EVT-");
}

/**
 * Validation-only reference for the frozen component interfaces. It has no
 * database, network, outbox, credential, release, or production adapter.
 */
export class AuthoritySchemaComponent {
  constructor({ commandRegistry, authorizationContract, gateTrace }) {
    this.commands = new Map(commandRegistry.commands.map((command) => [command.id, command]));
    this.transitions = new Map(
      commandRegistry.state_machines.flatMap((machine) =>
        machine.transitions.map((transition) => [transition.command_id, transition]),
      ),
    );
    this.principals = new Set(authorizationContract.principals.map((principal) => principal.id));
    this.grants = new Map(authorizationContract.grants.map((grant) => [grant.id, grant]));
    this.tools = new Set(authorizationContract.tools.map((tool) => tool.id));
    this.gates = new Map(gateTrace.current_gate_chain.map((gate) => [gate.gate_id, gate.status]));
    this.activationAuthorized = gateTrace.activation_authorized === true;
    this.journal = new Map();
  }

  validateCommand(command) {
    ensure(command && typeof command === "object" && !Array.isArray(command), "E-SCHEMA", "command");
    const secretPath = findSecretMaterial(command);
    ensure(!secretPath, "E-SECRET-MATERIAL", secretPath);
    for (const field of ["record_id", "record_class", "record_type", "schema_version", "aggregate_type", "aggregate_id", "aggregate_sequence", "idempotency_key", "authority_set_id", "authority_set_generation", "principal_id", "credential_id", "session_id", "authorization_decision_id", "payload_digest", "domain_payload"])
      ensure(command[field] !== undefined && command[field] !== null, "E-SCHEMA", field);
    ensure(command.record_class === "command", "E-SCHEMA", "record_class");
    ensure(command.domain_payload && typeof command.domain_payload === "object" && !Array.isArray(command.domain_payload), "E-SCHEMA", "domain_payload");
    const payload = command.domain_payload;
    for (const field of ["command_id", "grant_id", "tool_id", "expected_aggregate_sequence", "canonical_payload_digest", "issued_at", "producer_version"])
      ensure(payload[field] !== undefined && payload[field] !== null, "E-SCHEMA", `domain_payload.${field}`);
    ensure(/^[0-9a-f]{64}$/.test(payload.canonical_payload_digest), "E-SCHEMA", "canonical_payload_digest");
    ensure(Number.isSafeInteger(command.authority_set_generation) && command.authority_set_generation >= 0, "E-SCHEMA", "authority_set_generation");
    ensure(Number.isSafeInteger(payload.expected_aggregate_sequence) && payload.expected_aggregate_sequence >= 0, "E-SCHEMA", "expected_aggregate_sequence");
    const definition = this.commands.get(payload.command_id);
    ensure(definition, "E-UNKNOWN-COMMAND", payload.command_id);
    ensure(command.record_type === definition.input_record, "E-SCHEMA", "record_type");
    ensure(command.aggregate_type === definition.aggregate, "E-SCHEMA", "aggregate_type");
    for (const field of definition.required_context) ensure(payload[field] !== undefined && payload[field] !== null, "E-SCHEMA", `domain_payload.${field}`);
    for (const field of ["authority_set_id", "authority_set_generation", "principal_id", "credential_id", "session_id", "authorization_decision_id"])
      ensure(payload[field] === command[field], "E-SCHEMA", `context binding ${field}`);
    return definition;
  }

  simulate(command, context) {
    const definition = this.validateCommand(command);
    const payload = command.domain_payload;
    ensure(this.principals.has(command.principal_id), "E-AUTHORIZATION-DENIED", "principal");
    ensure(this.grants.has(payload.grant_id), "E-AUTHORIZATION-DENIED", "grant");
    ensure(this.tools.has(payload.tool_id), "E-AUTHORIZATION-DENIED", "tool");
    ensure(command.principal_id === definition.principal, "E-AUTHORIZATION-DENIED", "principal binding");
    ensure(payload.grant_id === definition.grant, "E-AUTHORIZATION-DENIED", "grant binding");
    ensure(payload.tool_id === definition.tool, "E-AUTHORIZATION-DENIED", "tool binding");
    const grant = this.grants.get(payload.grant_id);
    ensure(grant.principal_ids.includes(command.principal_id), "E-AUTHORIZATION-DENIED", "grant principal");
    ensure(grant.tools.includes(payload.tool_id), "E-AUTHORIZATION-DENIED", "grant tool");
    ensure(command.authority_set_id === context.active_authority_set_id, "E-AUTHORITY-GENERATION", "authority_set_id");
    ensure(command.authority_set_generation === context.active_authority_set_generation, "E-AUTHORITY-GENERATION", "authority_set_generation");
    ensure(payload.expected_aggregate_sequence === context.current_sequence && command.aggregate_sequence === context.current_sequence, "E-SEQUENCE-CONFLICT", command.aggregate_id);

    const journalKey = `${command.aggregate_type}:${command.aggregate_id}:${command.idempotency_key}`;
    const prior = this.journal.get(journalKey);
    if (prior) {
      ensure(prior.canonical_payload_digest === payload.canonical_payload_digest, "E-REPLAY-PAYLOAD-MISMATCH", journalKey);
      return { event: prior.event, replayed: true };
    }

    const transition = this.transitions.get(payload.command_id);
    ensure(transition, "E-STATE-PRECONDITION", "transition missing");
    ensure(transition.from_states.includes(context.current_state), "E-STATE-PRECONDITION", context.current_state);
    const eventPayload = {
      ...payload,
      command_record_id: command.record_id,
      event_type: eventType(payload.command_id),
      prior_state: context.current_state,
      state: transition.to_state,
      outcome: "COMMITTED"
    };
    const event = Object.freeze({
      record_id: `event:${command.record_id}`,
      record_class: "event",
      record_type: definition.output_records[0],
      schema_version: "v1",
      record_registry_revision: command.record_registry_revision,
      authority_set_id: command.authority_set_id,
      authority_set_generation: command.authority_set_generation,
      source_domain: command.source_domain,
      source_contract_revision: command.source_contract_revision,
      aggregate_type: command.aggregate_type,
      aggregate_id: command.aggregate_id,
      ordering_rule: command.ordering_rule,
      aggregate_sequence: context.current_sequence + 1,
      valid_time_kind: "instant",
      valid_time_start: payload.issued_at,
      recorded_at: payload.issued_at,
      occurred_at: payload.issued_at,
      operation_id: payload.command_id,
      idempotency_key: command.idempotency_key,
      correlation_id: command.correlation_id,
      causation_id: command.record_id,
      principal_id: command.principal_id,
      actor_snapshot_digest: command.actor_snapshot_digest,
      authorization_decision_id: command.authorization_decision_id,
      authorization_snapshot_digest: command.authorization_snapshot_digest,
      credential_id: command.credential_id,
      session_id: command.session_id,
      ...(command.device_id ? { device_id: command.device_id } : {}),
      ...(command.assignment_epoch_id ? { assignment_epoch_id: command.assignment_epoch_id } : {}),
      supersedes_record_ids: [],
      corrects_record_ids: [],
      voids_record_ids: [],
      derives_from_record_ids: [command.record_id],
      sensitivity_class: command.sensitivity_class,
      retention_class: command.retention_class,
      domain_payload: eventPayload,
      source_bytes_digest: sha256(JSON.stringify(eventPayload)),
      normalized_content_digest: sha256(`event:${command.normalized_content_digest}`),
      payload_digest: sha256(JSON.stringify(eventPayload)),
      hash_algorithm: "sha-256",
      canonicalization_version: "canonical-json.v1",
      producer_release_id: command.producer_release_id,
      replay_compatibility: command.replay_compatibility,
      projection_compatibility: command.projection_compatibility,
      unknown_version_behavior: "reject_or_quarantine"
    });
    this.journal.set(journalKey, { canonical_payload_digest: payload.canonical_payload_digest, event });
    return { event, replayed: false };
  }

  assertActivationAuthorized() {
    const open = [...this.gates.entries()].filter(([, status]) => !["CLOSED", "CLOSED_DISABLED"].includes(status));
    ensure(this.activationAuthorized && open.length === 0, "E-GATE-OPEN", open.map(([gate]) => gate).join(","));
    return true;
  }
}

export function expectAuthorityError(code, operation) {
  try {
    operation();
  } catch (error) {
    ensure(error instanceof AuthorityComponentError, "E-TEST-WRONG-ERROR", String(error));
    ensure(error.code === code, "E-TEST-WRONG-ERROR", `${code} != ${error.code}`);
    return error;
  }
  fail("E-TEST-EXPECTED-ERROR", code);
}
