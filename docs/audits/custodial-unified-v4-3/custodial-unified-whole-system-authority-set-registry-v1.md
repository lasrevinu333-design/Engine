# Authority-Set Registry and Protocol v1

**Status:** normative distributed-generation/fencing contract.

## Immutable dependency graph

An authority set AS-{generation}-{digest} immutably contains object IDs and digests for: record schemas/compatibility; command handlers; resolvers/projections; policy/approved-source bundle; locations/tags; workload/ownership/occurrence rules; grants; retention; workers/queues; notification templates; migration manifest; release tuple. Its generation is monotonically issued by AUTH-001 Authority Set Controller, the only fencing owner. A set is immutable; correction creates another set.

## Lifecycle

DRAFT → VALIDATED → READY_FOR_AUDIT → ACTIVE → DRAINING → RETAINED_ROLLBACK → RETIRED; DRAFT/VALIDATED → FAILED on invalid dependency or test. Only a dual-approved activation command promotes VALIDATED after exact evidence. ACTIVE has one read-authority pointer. DRAINING accepts only compatible, pinned in-flight work; RETIRED rejects all target admission. Rollback reactivates a prior compatible set only through the ordered DR runbook.

## Compatibility and mixed deployment

| Producer / consumer | Compatible condition | Otherwise |
|---|---|---|
| old client → new backend | registered reader, unchanged command semantics, original set pinned | accept only as draining work or quarantine |
| new client → old backend | exact listed backward compatibility | reject release activation |
| local queue → synchronizer | original set/session/actor/device snapshots admitted and lease valid | quarantine; manager recovery |
| worker → queue/lease | worker implementation and queue lease pin same set | fence worker, leave lease for compatible retry |
| projection → fact stream | explicit type/schema and set reader compatibility | stop projection and emit operational fault |
| notification provider attempt → intent | child intent and recipient/device epoch match | record receipt; suppress presentation and reconcile |
| migration → application | manifest sequence and set fence exact | stop migration/rollback |

Partial deployment is not best effort: the controller permits only registered compatible pairs. Unknown/mixed generations never resolve ownership, attribution, status, notification, or authorization.

## Activation, drain, and rollback

1. Validate graph digests, producer/consumer matrix, release tuple, and negative tests.
2. Create new generation without moving the pointer; install compatible readers and schema adapters first.
3. Pin queues, leases, sessions, local envelopes, and workers; classify all old work as compatible drain or quarantine.
4. Dual-approve activation; atomically move the one read pointer and emit release assertion.
5. Drain bounded old work with its original generation; do not create new work under it.
6. Retire old writers/resolvers only after manifest proof. Retain a rollback set only under G-BUILD22/G-RESTORE.
7. For rollback: halt new admission, fence workers, capture/reconcile provider receipts and local queues, restore compatible data/object-store bundle, move pointer, activate compatible app/backend, then release quarantined work only after revalidation.

## Required evidence

Graph and digest manifest; state-transition log; fence owner proof; compatibility matrix; old-client and partial-deployment tests; queue/lease pinning and worker-drain proof; cross-set quarantine fixtures; activation/rollback order test; physical old-APK wake/offline upload/partial update/rollback results. Missing evidence leaves G-AUTHSET-001 or G-CROSS-SET-WORK open.

