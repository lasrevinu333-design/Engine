# Custodial v4.3 Phase-1 Foundation Contract

Status: **DRAFT_REMOTE_PHASE_1**. This is normative Phase-1 architecture material, not architecture approval. Phase 2, schema/component design, implementation, migration, release, device, and production authority remain false.

## Authority and ownership

`architecture-foundation-build-contract.json` alone owns the immutable source tuple and downstream authority flags. `phase1-foundation-registry.json` owns stable architecture, record, identity, grant, tool, authority-set, gate, research, and retirement identities. `artifact-generation-dag.json` owns generation edges, field owners, and transitive invalidation. No consumer may redefine an upstream identity, infer authority from file presence, or use a local fallback.

Each artifact field has exactly one `field_owner`. Every producer and consumer is registered before use. Unknown record types, record versions, principals, writers, endpoints, control surfaces, references, and authority generations are denied and block the earliest dependent stage.

## Records, ordering, replay, and compatibility

Every cross-domain record uses its registered version and canonical JSON serialization. Ordering is explicit: stage decisions use a monotonic sequence; other foundation records use content digest followed by stable ID. Replay is idempotent by stable record ID and version. Compatibility is exact-version by default; only a registered, tested adapter may cross versions. Retention, migration, and retirement rules are per record. An unknown version is rejected, never coerced or silently accepted.

## Identity and authorization

Authorization is default deny. Principal, credential, session, grant, authorization decision, service principal, and executable tool identities are separate. Each tool binds an exact principal class, credential class, grant, resource scope, allowed records, confirmation rule, revocation behavior, failure behavior, and forbidden planes.

Public read has no write, privileged, migration, release, administration, or database-owner path. Ordinary employee, manager, Read Only, worker, and MCP runtime identities do not acquire migration, release, Device Security, manager-administration, or database-ownership authority. Privileged actions require the registered human or dual-control rule. Revocation is checked before use and fences outstanding leases.

## Authority-set activation

Authority-set dependencies and compatibility form an acyclic graph. Activation requires a registered command, decision, receipt, fencing owner, and monotonic token within one declared transaction boundary. Stale clients are rejected. Workers lease then drain. Mixed generations quarantine. Partial activation rolls back in the registered reverse order. Consumers have no local fallback and cannot pick an authority generation independently.

## Content identity and stage authority

`architecture-foundation-manifest.json` lists immutable normative members but excludes itself. Its own digest, containing commit, tree, blobs, member SHA-256 values, generated timestamps, mutable validation receipts, execution state, and stage decisions belong to detached evidence. `phase1-stage-decision.json` is append-only authority outside content identity and holds Phase 2 closed.

## Gates, research, proof, and retirement

Every gate, research/policy decision, proof obligation, and retirement/control-surface entry has a stable ID, owner, structural classification, earliest blocked stage, evidence, references, and fail-closed behavior. Unknown current writers remain explicitly registered research blockers; the contract does not invent certainty. Automated validation and independent physical review are distinct proof requirements.

## Transactions, failures, and rollback

A write becomes authoritative only after its complete registered validation and evidence boundary succeeds. Missing closure, stale source tuple, duplicate identity, unknown version, privilege leakage, authority/DAG cycle, duplicate field owner, manifest self-reference, mutable-stage leakage, unregistered writer, unresolved required gate, or missing proof fails closed with a stable error code.

This correction creates only commits on the isolated correction branch and evidence branch. Rollback preserves the parent Phase-1 commit, bootstrap commit, draft PR 131, and all prior evidence; PR 131 remains draft and the correction head is abandoned as authority. No runtime rollback is needed because product and production mutation are forbidden.
