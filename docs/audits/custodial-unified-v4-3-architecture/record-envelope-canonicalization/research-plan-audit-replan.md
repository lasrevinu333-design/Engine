# Research → Plan → Audit → Replan

## 1. Research and actual-system finding

Primary authority is Unified Whole-System Architecture v4.2 §5. It requires every authoritative command, fact, event, correction, outbox intent, worker attempt, authorization decision, migration assertion, and release assertion to use a registered record type and inherit one common semantic envelope.

The reviewed Phase-1 base at Engine `8e53038f9e5d5146b1dd8260614de30cb9be4553` did not fully implement that requirement:

- the embedded envelope listed only 20 abbreviated fields;
- it omitted or collapsed record class, source domain/revision, aggregate type, valid-time structure, operation identity, canonical principal, original credential/session/device/assignment epoch, source evidence, complete lineage, canonical payload/source/normalized digests, replay/projection compatibility, and exact unknown-version behavior;
- canonical serialization was reduced to UTF-8, sorted keys, finite JSON, and whitespace;
- the schema accepted any 20 unique strings and any nonempty serialization sentence;
- the validator therefore proved list length and internal consistency, not equivalence to the accepted architecture.

The accepted architecture additionally requires Unicode NFC, stable semantic array order, fixed-precision UTC timestamps, America/Chicago service-date/day-offset rules, canonical non-exponent decimals, distinct null/missing/empty semantics, source-byte plus normalized-content hashes, and stored SHA-256 algorithm/version identity.

## 2. Exact success and failure

Success means one controlling contract provides every required semantic dimension and byte rule; original actor and original authorization cannot be replaced by current server state; every current Phase-1 record profile inherits the contract without weakening it; each schema constraint is directly mutated; and every named semantic attack fails with its exact stable code.

Failure includes any of the following:

- the old 20-field summary remains parallel authority;
- a later designer must reconstruct meaning from prose;
- offline work can be re-attributed after device reassignment;
- arrays canonicalize without a registered semantic ordering policy;
- timestamps, decimals, service dates, or DST are locale-dependent;
- null, missing, and empty collapse;
- a digest is self-referential or does not bind the exact intended bytes;
- a record type removes a field, widens a type, weakens a condition, or coerces an unknown version;
- a green test checks names/counts rather than executing the actual failure.

## 3. Initial plan

The first plan was to rewrite the large existing Phase-1 registry and schema in place, regenerate the existing coverage ledger, and expand the existing validator.

## 4. Plan audit

That plan was rejected for four reasons:

1. Replacing a very large multi-domain registry through remote full-file writes creates an avoidable risk of silently dropping unrelated accepted authority.
2. Editing the old summary without an exact supersession rule leaves readers unable to prove which revision controls.
3. Folding generated receipts, manifests, stage decisions, and containing commits into one digest creates circular identity pressure.
4. Extending the old validator alone would allow future consumers to keep reading the weak embedded summary while the new checks sat beside it.

## 5. Corrected plan

The corrected plan is a bounded replacement at the design boundary:

1. Bind the exact reviewed base registry and schema by Git blob SHA.
2. Declare the old record-envelope and per-record serialization summaries historical evidence only.
3. Publish one standalone controlling record-envelope/canonicalization contract.
4. Define all mandatory/conditional semantics, original actor/authorization rules, and deterministic bytes.
5. Publish an exact strengthening profile for every current Phase-1 record type.
6. Execute strict schema validation, direct mutation of every schema constraint, raw-JSON attacks, semantic attacks, digest reproduction, source/ancestry checks, and changed-path scope checks.
7. Keep the stage on HOLD.
8. At the later complete-architecture freeze, fold this accepted contract into the clean standalone registry rather than preserve two authorities.

This is a foundation replacement with explicit precedence and a deterministic retirement path, not an optional compatibility patch.
