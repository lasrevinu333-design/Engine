# Custodial v4.3 Phase-1 Semantic Authority Contract

Status: **DRAFT_REMOTE_PHASE_1**. Architecture approval, Phase 2, schema/component design, implementation, migration, release, device, and production authority are false.

## Exact sources and authority planes

`architecture-foundation-build-contract.json` owns the single exact evidence tuple and precedence order. The workflow proves the correction head descends from immutable review head `922a1c470019b4a2576fcbf03d3005de5a241f18`, the PR base is `f8235b88ef178da50681789a5ebff0dbcf4df5f2`, and all post-review changes stay inside the architecture package and its one workflow. Pattern-shaped strings are never source verification.

The architecture-control plane has four distinct classes: architecture owner, independent stage authority, deterministic architecture validator, and review reader. The owner authors normative records. Only the independent stage authority authors stage decisions. The validator reads normative inputs and emits schema-coverage and validation receipts; a receipt can never grant its producer stage authority.

Future Employee, Manager, Read Only, worker, MCP, migration, backup, restore, release, Device Security, and database-owner classes are operational-plane placeholders. They are `PLANNED_DENY_ALL`, have no grant or executable tool, and cannot activate an authority set. Public guest/reporting authority is disabled.

## Credential doctrine

Employee identity remains the enrolled-device native-vault credential plus assignment epoch and immutable actor snapshot. It is not generic OIDC. Manager identity remains bound to a named trusted manager device. Hardware user presence or dual control applies only when an accepted contract says it does. The unresolved issuance, revocation, and presentation mechanisms are fail-closed research gates; Phase 1 does not invent OIDC, mTLS, hardware MFA, public-read, service-principal, or runtime policy.

## Records and exact authorization closure

Every record uses the common envelope in the registry. Each record contract independently fixes stable identity/version, owner, exact producer and consumers, resolver, aggregate order, canonical serialization, idempotency/replay, compatibility/unknown-version behavior, retention, migration, retirement, authorization, transaction boundary, failure outcome, and tests.

For each producer there is one exact write grant and tool containing that record. For each consumer there is one exact read grant and tool. The reverse relation is also enforced: no grant or tool may name a record absent from its matching read/write relation. No generic `write_authorized_records`, catch-all capability, copied record list, alias, or local fallback exists. Read Only and MCP read-only remain planned deny-all and structurally cannot write authorization decisions, stage decisions, proof obligations, migrations, restores, releases, administration, or database ownership.

## Planned operational authority set

`AS-OPERATIONAL-TEMPLATE-V1` is a complete but non-activatable template. It enumerates record registry/schemas, principal/grant registry, backend/API, workers, notification contract, configuration/keys, client/APK, local-store compatibility, release tuple, migration/retirement state, and restore bundle. It defines compatibility dimensions, lifecycle, command/decision/receipt fields, future fencing ownership, monotonic token ownership, stale-client outcomes, worker drain, mixed-generation quarantine, partial activation, transaction boundaries, invalidation, and full reverse rollback. No operational generation is active or validated in Phase 1.

## Gates, retirement, objects, and proof

Gate classifications are limited to `value-only`, `component-structural`, `schema-structural`, `migration-structural`, `release-structural`, and `physical-only`. Each unresolved structural gate blocks the earliest named stage and cites the frozen source.

The retirement registry separately accounts for anonymous full MCP mode, generic application/migration SQL, schedule writers/resolvers, PTO/absence synchronization, rolling schedule cron, Messenger schedule triggers, scan-alert clearing, retention/purge workers, Event mutation, repair/rollback writers, frontend/native compatibility routes, and unknown writers. Unknowns remain research-blocked.

Every architecture object names a legitimate user, purpose, authority owner, exact source/finding references, failure behavior, disposition, proof IDs, gate IDs, future CAP obligation, and an explicit physical-proof requirement. Document review is not physical proof.

## Authored sources, generated projections, and content identity

The artifact DAG labels authored sources honestly. Only `schema-coverage-ledger.json` and `validation-result.json` declare registered generators, versions, commands, input paths, and byte reproduction. Input/consumer edges are exact inverses, invalidation is the exact transitive consumer closure, and the validator's declared inputs equal the files it reads.

The manifest defines normative content members but excludes itself, stage decisions, receipts, execution evidence, containing commit/tree, and mutable lifecycle state. Detached result evidence binds one aggregate content digest, manifest SHA-256, final commit/tree, every normative member blob/SHA-256, generator identities, and the exact source tuple. There is no `validated_content_head` parallel authority.

## Executable coverage and semantic failures

The registered generator enumerates every build and artifact schema constraint. For each exact constraint it makes one direct mutation, runs the same schema validator used by the Phase-1 validator, and records the expected and observed stable error. Semantic fixtures separately attack unauthorized producers/consumers, Read Only and MCP writers, credential doctrine, stage-authority confusion, privileged runtime tools, source ancestry/base/path scope, gate classification, placeholders, DAG inverses, false generation, stale attestations, grant/tool/record mismatch, authority-plane conflation, activatable templates, generic writes, and unknown writers.

A baseline pass plus all exact negative failures is necessary but not architecture approval. The pinned read-only workflow runs inherited v4.3.2 validation first, generator byte checks second, and Phase-1 validation last.

## Rollback and next gate

Every correction is an append-only commit. Rollback preserves `922a1c470019b4a2576fcbf03d3005de5a241f18`, `f8235b88ef178da50681789a5ebff0dbcf4df5f2`, `58159ef9e5440d9f654f381c4eee2a875d298ee6`, PR 131, and all evidence; the new head is abandoned as authority. No runtime rollback exists because no runtime state is authorized. The next gate is a second independent Programmer 1 Phase-1 review only.
