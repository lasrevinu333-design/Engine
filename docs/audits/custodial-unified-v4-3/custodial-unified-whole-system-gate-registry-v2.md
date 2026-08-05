# Gate Registry v2

**Status:** sole gate-state authority for v4.3.

## Vocabulary

`NOT_STARTED` = no owner/evidence; `OPEN_RESEARCH` = fact unknown; `OPEN_POLICY` = genuine decision unknown; `OPEN_TECH` = mechanism/contract incomplete; `READY_FOR_AUDIT` = closure evidence complete, not yet accepted; `PASSED` = accepted for its declared scope; `FAILED` = evidence disproves closure; `DISABLED` = feature unavailable by default; `RETAINED_ROLLBACK` = temporary predecessor retained only for rollback; `RETIRED` = unreachable and no longer authority. These values are mutually exclusive per gate revision. “GO/NO-GO” is a consequence, not a second state vocabulary.

| Gate | State | Design impact | Closure evidence / fail-closed consequence |
|---|---|---|---|
| G-EVIDENCE-001 | READY_FOR_AUDIT | value-only | manifest/hash/supersession lint; reject unregistered evidence |
| G-TRACE-001 | READY_FOR_AUDIT | component-structural | exact joined trace/object reverse map; reject architecture approval |
| G-TRACE-LINT | NOT_STARTED | component-structural | machine lint; reject audit admission |
| G-RECORD-001 | READY_FOR_AUDIT | schema-structural | registry/schema/compatibility fixtures; no schema design |
| G-AUTHSET-001 | READY_FOR_AUDIT | migration-structural | graph, fencing, matrix, drain and rollback fixtures; no mixed deployment |
| G-PRINCIPAL-001 | READY_FOR_AUDIT | component-structural | principal/grant/decision registry and negatives; deny all unregistered callers |
| G-RETIRE-001 | OPEN_RESEARCH | migration-structural | complete source/schema/live inventory and machine retirement plan; no cutover |
| G-LOC-TRANS-001 | READY_FOR_AUDIT | schema-structural | effective-time/in-flight matrix; reject unresolved location operation |
| G-OCC-001 | READY_FOR_AUDIT | schema-structural | occurrence state/concurrency/correction model; no status claim |
| G-OFFLINE-TIME | READY_FOR_AUDIT | component-structural | original-envelope/reboot clock fixtures; queue quarantine |
| G-CROSS-SET-WORK | READY_FOR_AUDIT | migration-structural | old-client/lease/drain tests; quarantine cross-set work |
| G-NOTIF-001 | READY_FOR_AUDIT | component-structural | intent/provider/presentation reconciliation; no alert send |
| G-NOTIF-P0 | OPEN_POLICY | component-structural | explicit deterministic P0/preemption decision; default remains no preemption |
| G-MSG-POLICY | OPEN_POLICY | value-only | approved hide/delete/reappearance/hold meanings; conservative hide/hold |
| G-EVENT-001 | READY_FOR_AUDIT | component-structural | revision/impact approval/reversal fixtures; no operational mutation |
| G-GPS | OPEN_POLICY | physical-only | purpose/retention plus session physical matrix; no collection |
| G-RETENTION | OPEN_POLICY | migration-structural | class/hold/purge/restore policy; no destructive purge |
| G-PRIV-ACCOMMODATION | OPEN_POLICY | schema-structural | approved confidential-justification versus neutral-effect access/retention model; hide justification |
| G-RESTORE | READY_FOR_AUDIT | migration-structural | compatible restore bundle/drill contract; no release admission |
| G-BUILD22 | OPEN_POLICY | migration-structural | rollback successor proof and retirement authority; retain predecessor only |
| G-PRODUCT-001 | READY_FOR_AUDIT | component-structural | route/API/asset/field allowlists; no employee artifact admission |
| G-PHYSICAL-ACCEPTANCE | NOT_STARTED | physical-only | exact phone/device fixture results; no APK/phone/canary |
| G-SCHED-SOURCE | OPEN_POLICY | schema-structural | approved bytes/digest/effective date; no schedule publish |
| G-RO-FIELDS | OPEN_POLICY | component-structural | approved Read Only field allowlist; default is deny/no projection |
| G-ESCALATION | OPEN_POLICY | component-structural | manager/on-call/fallback/no-recipient behavior; do not fabricate recipient |
| G-MGR-ATTENDANCE | OPEN_RESEARCH | value-only | source/freshness/privacy/no-schedule-effect evidence; excluded from employee product |
| G-HOURS, G-LUNCH, G-OPEN, G-WORKLOAD, G-FREQUENCY, G-ROUTE, G-READINESS, G-INSPECTION, G-CONTRACTOR, G-MGR-TIERS, G-SLO | OPEN_POLICY | component-structural | approved decision record; affected capability disabled or truthful UNKNOWN/OPEN |
| G-SUNDAY, G-SHIFTS, G-POSITION, G-SEPT14, G-SPLIT-WINDOWS, G-CROSS-MIDNIGHT, G-ELEPHANT-TRUNK, G-REMINDER-GROUPS, G-TAXONOMY, G-RESTRICTIONS | OPEN_RESEARCH | schema-structural | source/field reconciliation then decision; exclude affected scope |
| G-GUEST, G-AI-WRITE, G-MOXIE, G-WEATHER | DISABLED | component-structural | separate approval and security case; no route/API/write grant |

## Stage consequences

Independent architecture audit is **authorized** for READY_FOR_AUDIT artifacts and does not require a PASSED design gate. Final architecture approval, isolated design, implementation, migration, APK, phone/canary, and fleet release are **blocked**. A gate may pass only for an explicitly named scope; every dependency and invalidation link must be recorded in the evidence manifest.
