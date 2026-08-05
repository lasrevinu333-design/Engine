# Record-Type Registry v1

**Status:** normative catalogue for every target command, fact, event, evidence, correction, outbox intent, worker attempt, authorization decision, migration assertion, and release assertion.

All records use the immutable envelope `{record_id,type,version,aggregate_type,aggregate_id,sequence,recorded_at,authority_set,actor_snapshot,correlation_id,idempotency_key,payload_digest,classification,hold_state}`. Unknown type/version, missing sequence, actor snapshot, authority set, or idempotency key is rejected and produces an authorization/refusal evidence record; it never falls back to current identity.

| Type family / version | Owner; aggregate; ordering | Producer → consumer | Compatibility, idempotency, replay | Retention / migration / retirement | Failure behavior; tests |
|---|---|---|---|---|---|
| `custodial.command.v1` | domain command owner; command aggregate; caller sequence | admitted UI/API/tool → command handler | exact version only; client idempotency key; replay validates original envelope | class by command; adapter reads v1; retire only after queue drain | reject unknown/duplicate/conflict; auth, ordering, retry tests |
| `custodial.fact.v1` | domain owner; stated aggregate; monotonic aggregate sequence | handler → projections/audit | backward readers must understand v1; facts append only | durable or policy class; no mutation adapter | stop projection on gap; replay/digest tests |
| `custodial.event.v1` | Event owner; Event revision aggregate | Event handler → audience/impact | expected revision required; idempotent revision command | durable; adapter preserves revision | conflict returns candidate, no impact; conflict/cancel tests |
| `custodial.evidence.v1` | evidence service; evidence item | command/worker → immutable store | content-addressed; duplicate digest is reference, not overwrite | evidence/hold policy; export is derived | immutable-store refusal; tamper/hold/restore tests |
| `custodial.correction.v1` | correction owner; corrected aggregate | authorized manager → resolver/projection | references immutable prior fact; explicit reason/approval | durable; no destructive rewrite | deny missing prior/approval; bitemporal tests |
| `custodial.notification-intent.v1` | notification service; child intent/group | occurrence/Event → notifier | deterministic intent key; presentation is separate | operational/presentation class; adapter preserves intent | no provider call without intent; crash-after-send tests |
| `custodial.worker-attempt.v1` | worker owner; leased work item | worker → reconciliation/audit | lease and authority-set pinned; attempt key stable | security/operational; retain through dispute window | fence expired lease; retry/quarantine tests |
| `custodial.authorization-decision.v1` | authorization service; request decision | PDP → handler/audit | exact grant, scope, actor/session/device snapshots | security class; no reinterpretation by current grants | deny unavailable/ambiguous; revocation tests |
| `custodial.migration-assertion.v1` | migration operator; migration run | migration controller → release gate | manifest digest + generation fence; one assertion per step | release class; retained through rollback retirement | refuse mismatched graph; rollback/drain tests |
| `custodial.release-assertion.v1` | release operator; release tuple | release controller → admission | tuple digest idempotent; consumers exact-match | release class; retains Build 22 proof | reject stale tuple; invalidation tests |
| `custodial.local-operation.v1` | device security; offline operation | protected local queue → synchronizer | original signed actor/device/credential/assignment/session/occurrence/ownership/authority snapshots; stable nonce | encrypted local until accepted/quarantined; migration adapter only on compatible set | quarantine on reassignment/revocation/set mismatch; offline/reboot tests |

Every family has canonical schema, consumer compatibility matrix, contract-test fixture, and migration adapter registered before implementation. Only additive compatible readers may coexist; producers change after readers and queues are ready. Retirement requires no retained rollback consumer, no in-flight lease, and an accepted replay proof.

