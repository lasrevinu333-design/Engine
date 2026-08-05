# Architecture-Object Registry v1

**Acceptance rule:** every normative object below maps to a CAP set, legitimate user/purpose, evidence, failure behavior, proof, and gates. Any new normative object without a row is an orphan and fails architecture acceptance. Legacy-only means temporary only under RET-001 and G-RETIRE-001.

| Object ID | Object / disposition | CAP coverage | User / purpose | Evidence; failure behavior | Automated / physical proof; gates |
|---|---|---|---|---|---|
| OBJ-001 | Evidence control plane / REBUILD | 001-003, 238-252 | auditor / bounded truth | manifest; reject unregistered/stale evidence | lint; n/a; G-EVIDENCE-001 |
| OBJ-002 | Gate control plane / REBUILD | 001-010, 238-252 | decision owner / admission | gate registry; block stage on open dependency | state/invalidation tests; n/a; G-TRACE-001 |
| OBJ-003 | Record envelope/type registry / REBUILD | 003, 064-075, 117-252 | all / replayable facts | registry; reject unknown/missing envelope | serialization/replay; old-phone tests; G-RECORD-001 |
| OBJ-004 | Principal, grant, authorization decision / REBUILD | 004-037, 216-252 | named actors / least privilege | principal registry; deny ambiguous caller | grant/revocation tests; untrusted client; G-PRINCIPAL-001 |
| OBJ-005 | Device/enrollment/assignment epoch / REBUILD | 023-035, 108-121 | employee/security / original attribution | device records; quarantine reassignment | reassignment model; device matrix; G-OFFLINE-TIME |
| OBJ-006 | Authority-set controller / REBUILD | 003, 068-075, 108-252 | release controller / one authority | authority registry; fence mismatch | split-brain/drain tests; rollback device test; G-AUTHSET-001 |
| OBJ-007 | Location lifecycle/tag relation / REBUILD | 043, 076-107, 122-130 | operations / effective location | lifecycle facts; reject invalid-time location | split/merge fixtures; NFC field matrix; G-LOC-TRANS-001 |
| OBJ-008 | Approved source/policy bundle / REBUILD | 038-063, 076-107 | management / required service | source decision; UNKNOWN if gate open | provenance/preview; field observation; G-SCHED-SOURCE |
| OBJ-009 | Ownership compiler/resolver / REBUILD | 043-075 | employees/managers / truthful owner | immutable publications; no fallback resolver | deterministic/fault tests; manager explanation; G-OCC-001 |
| OBJ-010 | Service occurrence/status/readiness / REBUILD | 002, 045, 077-107, 131-166 | all / required work state | occurrence facts; no derived guess | concurrency/replay; field state; G-OCC-001 |
| OBJ-011 | Session/local operation sync / REBUILD | 108-130 | employee / offline work | original envelope; quarantine mismatch | reboot/reassignment tests; Moto G proof; G-CROSS-SET-WORK |
| OBJ-012 | NFC intake/manual recovery / REBUILD | 122-130 | employee/manager / location proof | scan evidence; no manual normal path | tag negatives; failure recovery physical; G-PHYSICAL-ACCEPTANCE |
| OBJ-013 | GPS session evidence / REBUILD | 131-136 | employee/privacy / scoped evidence | session bind; reject outside session | stop/revocation tests; device privacy matrix; G-GPS |
| OBJ-014 | Completion/correction/evidence / REBUILD | 137-166 | employee/manager / trustworthy completion | append-only evidence; refuse conflict | correction/replay; scan/complete matrix; G-RETENTION |
| OBJ-015 | Issue/inspection/feedback / REBUILD | 064, 167-190 | employee/manager / follow-up | separate aggregate; no ownership mutation | access/attachment tests; physical UX; G-INSPECTION |
| OBJ-016 | Messenger lifecycle / REBUILD | 191-205 | participants / bounded communication | visibility/hold ledger; hide by default on ambiguity | hide/purge/restore tests; reassignment test; G-MSG-POLICY |
| OBJ-017 | Notification reconciliation / REBUILD | 206-220 | eligible recipient / actionable alert | child intent/receipt/presentation; suppress stale | crash/dedupe tests; non-audio/stale visual; G-NOTIF-001 |
| OBJ-018 | Event revision/impact / REBUILD | 221-230 | manager / explicit operational change | expected revision/approval; no silent change | conflict/reversal tests; employee view; G-EVENT-001 |
| OBJ-019 | Contractor lifecycle / REBUILD | 036-037, 055, 231-237 | vendor/manager / honest capacity | acceptance facts; OPEN on no acceptance | expiry/substitution tests; link-loss proof; G-CONTRACTOR |
| OBJ-020 | Retention/hold/immutable analytics / REBUILD | 191-252 | security/management / preservation | class/hold ledger; block destructive action | purge/restore/analytics negatives; UI proof; G-RETENTION |
| OBJ-021 | Release/rollback/DR / REBUILD | 238-252 | release/restore operators / recoverability | tuple/assertions; reject incomplete bundle | drill/invalidation tests; Build 22 physical; G-RESTORE |
| OBJ-022 | Product projection registry / REBUILD | 004-010, 167-190, 231-237 | each product / isolation | allowlists; deny unregistered route/field | artifact/API negatives; six-element Home; G-PRODUCT-001 |
| OBJ-023 | Legacy authority inventory / LEGACY-ONLY | 009, 068-075, 191-252 | migration / controlled retirement | retirement manifest; deny uncovered legacy path | caller inventory; old path failure; G-RETIRE-001 |
| OBJ-024 | Physical acceptance family / REBUILD | 005, 122-136, 206-220, 238-252 | release owner / real-world proof | tuple-bound fixture ledger; no inferred pass | device results only; G-PHYSICAL-ACCEPTANCE |
| OBJ-025 | CMD capability-command registry / REBUILD | 001-252 | admitted actor / exact mutation or query authority | joined trace command IDs; reject unregistered command | command/authorization fixtures; applicable physical family; G-RECORD-001 |
| OBJ-026 | SM lifecycle-state-machine registry / REBUILD | 023-037, 076-166, 191-252 | domain owner / legal transitions | record and authority registries; reject illegal transition | transition/property tests; device cases where stated; G-AUTHSET-001 |
| OBJ-027 | PRJ product/projection registry / REBUILD | 002, 004-010, 043-075, 167-237 | role user / bounded view | projection allowlist; suppress unavailable/stale state | API/field negatives; role fixture; G-PRODUCT-001 |
| OBJ-028 | WRK worker/outbox/lease registry / REBUILD | 068-075, 108-130, 191-220, 238-252 | service principal / asynchronous work | type/lease/set pin; fence wrong worker | crash/retry/drain tests; notification/device cases; G-AUTHSET-001 |
| OBJ-029 | ADP compatibility/migration-adapter registry / REBUILD | 003, 023-075, 108-252 | migration operator / controlled evolution | exact reader/writer matrix; quarantine unknown version | compatibility/replay tests; old-app matrix; G-CROSS-SET-WORK |
| OBJ-030 | RLS release/migration assertion registry / REBUILD | 238-252 | release/migration operator / admission | release tuple and assertion types; reject mismatch | activation/invalidation tests; Build 22 matrix; G-RESTORE |
| OBJ-031 | PHY physical-evidence fixture registry / REBUILD | 005, 023-035, 108-136, 206-220, 238-252 | release authority / field proof | exact tuple/device/tag fixture record; no inferred result | bound physical run; G-PHYSICAL-ACCEPTANCE |
| OBJ-032 | LEG Build 22 rollback artifact / LEGACY-ONLY | 238-252 | release operator / temporary recovery | expiry/fence/compatibility proof; cannot receive target authority | rollback negatives and physical drill; G-BUILD22 |

CAP ranges are inclusive. Each joined-trace row points to one or more of these objects through its canonical authority; reverse lookup is deterministic by CAP range and object row. No range denotes an omitted requirement: it names every included ID.
