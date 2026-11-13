# Memphis Zoo Custodial Program — V4.2 Research, Policy and Stage Gate Registry v1

**Status:** Controlling open-gate registry for the v4.2 architecture cycle  
**Prepared:** 2026-08-04  
**Authorization:** Research and architecture only

---

## 1. Gate classes

- `TECH` — architecture must define the mechanism; Eric does not invent it.
- `SOURCE` — answer from repository/source inventory.
- `SCHEMA` — answer from read-only schema/function/grant inspection.
- `DATA` — answer from production records and provenance.
- `FIELD` — answer from operational observation/measurement.
- `PHYSICAL` — answer on bound Moto G/Fully Kiosk/artifact.
- `POLICY` — genuine Eric/management decision after research.
- `STAGE` — controls project advancement.

A gate may have multiple classes. Researchable facts are not converted into Eric questions merely because they are inconvenient.

---

## 2. Technical architecture closure gates

| Gate | Class | Status | Required closure evidence | Owner |
|---|---|---|---|---|
| G-EVIDENCE-001 | TECH/SOURCE | OPEN | Frozen evidence manifest resolves every path/digest/status/precedence | Architecture lead |
| G-TRACE-001 | TECH/SOURCE | OPEN | CAP-001–CAP-252 exactly once; reverse registry; all codes/sections/gates resolve | Architecture lead |
| G-RECORD-001 | TECH | OPEN | Common record envelope, registry, version/replay/fail-closed tests defined | Architecture lead |
| G-AUTHSET-001 | TECH | OPEN | Distributed generation/fencing/pinning/activation/rollback protocol defined | Architecture lead |
| G-PRINCIPAL-001 | TECH | OPEN | Principal/credential/grant/session/authorization-decision model defined | Security architecture |
| G-PRIV-ACCOMMODATION | TECH/POLICY | OPEN | Neutral operational effect separated from private justification; access/retention policy approved | Security + Eric/HR authority |
| G-LOC-TRANS-001 | TECH | OPEN | Split/merge/retire/tag transition transaction and in-flight rules defined | Architecture lead |
| G-OCC-001 | TECH | OPEN | Occurrence command/state/concurrency/satisfaction/correction/next-cycle model defined | Architecture lead |
| G-RETIRE-001 | TECH/SCHEMA/SOURCE | OPEN | Machine-readable complete writer/resolver/trigger/cron/API/tool retirement manifest | Migration/security |
| G-MIG-EXTERNAL-ARTIFACTS | TECH/SOURCE | OPEN | All generated SQL/data artifacts inventoried; unadmitted artifacts quarantined | Migration lead |
| G-OFFLINE-TIME | TECH/PHYSICAL | OPEN | Boot-generation/trusted-time/reboot/staleness contract and tests | Native architecture |
| G-LOCAL-KEYS | TECH/PHYSICAL | OPEN | Key rotation/revocation/lost-phone/quarantine/storage-exhaustion contract | Native security |
| G-CROSS-SET-WORK | TECH/PHYSICAL | OPEN | Old-set sessions/queues/acks/clients and rollback treatment defined | Architecture + native/backend |
| G-NOTIF-ACK-001 | TECH | OPEN | Receipt/ack binds intent, occurrence, employee, device, credential, epoch and authority set | Notification architecture |
| G-NOTIF-GROUP | TECH | OPEN | Presentation-group versus child intent/occurrence/escalation semantics defined | Notification architecture |
| G-NOTIF-VISIBLE-REVOKE | TECH/PHYSICAL | OPEN | Already-visible stale alert cancellation/replacement and audit defined | Notification architecture |
| G-NOTIF-P0 | TECH/POLICY/PHYSICAL | OPEN | Default no-preemption enforced or separately approved deterministic P0 contract | Eric + notification architecture |
| G-TOOL-REGISTRY | TECH/SECURITY | OPEN | Executable server-enforced AI/MCP/Moxie/diagnostic registry defined | Security architecture |
| G-FEEDBACK-ATTACHMENT | TECH/POLICY | OPEN | Offline attachment encryption/validation/access/retention/hold contract | Security + Eric |
| G-RESTORE | TECH/POLICY | OPEN | Complete restore bundle and drill contract; exact authority separation | DR architecture + Eric |
| G-VALIDATION-INVALIDATION | TECH | OPEN | Material tuple changes invalidate prior gate evidence | Release architecture |
| G-TRACE-LINT | TECH | OPEN | Automated documentation lint for CAP IDs/codes/sections/gates | Architecture lead |

---

## 3. Static schedule and operating-policy gates

| Gate | Class | Status | Required closure evidence | Decision owner |
|---|---|---|---|---|
| G-SCHED-SOURCE | DATA/POLICY | OPEN | Approved source artifact, provenance, digest, effective date | Eric/management |
| G-SUNDAY | DATA/POLICY | OPEN | Sunday source reconciled against production and candidate workbook | Eric/management |
| G-SHIFTS | DATA/POLICY | OPEN | Michael, Markiesha and all other shift conflicts resolved by source | Eric/management |
| G-POSITION | DATA/POLICY | OPEN | Every normal row mapped to position or approved person-bound rule | Eric/management |
| G-LUNCH | FIELD/POLICY | OPEN | Coverage start/end/restoration/9:45/shift-end behavior approved | Eric/management |
| G-HOURS | DATA/POLICY | OPEN | Normal operating hours approved and versioned | Eric/management |
| G-SEPT14 | DATA/POLICY | OPEN | September 14 seasonal transition approved | Eric/management |
| G-SPLIT-WINDOWS | DATA/FIELD/POLICY | OPEN | Split location windows, including Splash Pad-type service windows | Eric/management |
| G-CROSS-MIDNIGHT | POLICY | OPEN | Service-date/day-offset/overnight work policy | Eric/management |
| G-OPEN | POLICY | OPEN | Truthful publication, manager response and escalation policy | Eric/management |
| G-LATE-INHERITANCE | FIELD/POLICY | OPEN | Late-day tie-break policy after workload/route research | Eric/management |
| G-ELEPHANT-TRUNK | DATA/FIELD/POLICY | OPEN | Location/tag/service scope and active state | Eric/management |
| G-REMINDER-GROUPS | SOURCE/DATA/POLICY | OPEN | Gift shops/East End Break Room and orphan reminders classified | Eric/management |

Candidate workbook and generated seed SQL do not close any gate.

---

## 4. Workload, route and service-policy gates

| Gate | Class | Status | Required closure evidence | Owner |
|---|---|---|---|---|
| G-WORKLOAD | FIELD/POLICY | OPEN | Location/purpose expected minutes/load, source/confidence/revision | Operations + Eric |
| G-FREQUENCY | FIELD/POLICY | OPEN | Required frequency by purpose/window/season | Operations + Eric |
| G-ROUTE | FIELD/POLICY | OPEN | Location zones, adjacency, walking time and access constraints | Operations + Eric |
| G-RESTRICTIONS | SOURCE/DATA/POLICY | OPEN | Current preferences/restrictions classified; private rationale protected | Operations + HR authority |
| G-TAXONOMY | SOURCE/FIELD/POLICY | OPEN | Restroom/exhibit/other form and service taxonomy approved | Operations + Eric |

Group-level values cannot close location-level gates without validated derivation.

---

## 5. Status, inspection and analytics gates

| Gate | Class | Status | Required closure evidence | Owner |
|---|---|---|---|---|
| G-READINESS | FIELD/POLICY | OPEN | Ready/ready-with-follow-up/blocked/awaiting/not-required/unknown truth table | Eric/management |
| G-SEVERITY | FIELD/POLICY | OPEN | Issue severity and readiness consequence | Eric/management |
| G-REOPEN | POLICY | OPEN | Reopen/corrective occurrence and manager wording | Eric/management |
| G-INSPECTION | FIELD/POLICY | OPEN | Rubric, inspection types, spot-check coverage and correction | Eric/management |
| G-ANALYTICS-POLICY | POLICY | OPEN | Coaching/staffing/discipline use, thresholds, disputes and exports | Eric/management |
| G-RO-FIELDS | POLICY/SECURITY | OPEN | Read Only exact allowed fields beyond strict default | Eric/management |

---

## 6. Communication, contractor and public-feature gates

| Gate | Class | Status | Required closure evidence | Owner |
|---|---|---|---|---|
| G-ESCALATION | FIELD/POLICY | OPEN | Manager capability/shift/on-call/fallback/no-recipient behavior | Eric/management |
| G-MSG-POLICY | POLICY | OPEN | Archive, hide/reappearance, Memphis and group membership semantics | Eric/management |
| G-CONTRACTOR | FIELD/POLICY | OPEN | Named worker versus slot, acceptance, language and history claims | Eric/management |
| G-GUEST | POLICY/SECURITY | CLOSED-DISABLED | Remains disabled until Marketing/data/privacy/retention approval | Eric + Marketing |
| G-MGR-ATTENDANCE | SOURCE/SECURITY/POLICY | OPEN | Source/freshness/privacy/fields/no-schedule-effect contract | Eric/management |
| G-WEATHER | POLICY | OPEN-DISABLED | Optional manager-only or retired; never Employee Home | Eric/management |
| G-MOXIE | POLICY/SECURITY | OPEN-DISABLED | Separate private role or excluded from program | Eric |
| G-AI-WRITE | POLICY/SECURITY | OPEN-DISABLED | Exact write tools, confirmations and second approvals | Eric |

---

## 7. Privacy, retention, availability and release gates

| Gate | Class | Status | Required closure evidence | Owner |
|---|---|---|---|---|
| G-GPS | FIELD/PHYSICAL/POLICY | OPEN | Acquisition/calibration/use/retention/hold/dispute/battery | Eric + architecture |
| G-RETENTION | POLICY/SECURITY | OPEN | Class-by-class retention, purge, redaction and holds | Eric/management |
| G-SLO | POLICY | OPEN | Response, notification, freshness, offline capacity, RPO/RTO budgets | Eric/budget authority |
| G-MGR-TIERS | POLICY/SECURITY | OPEN | Manager capabilities and dual-control actions | Eric/management |
| G-BUILD22 | POLICY/RELEASE | OPEN-RETAIN | Compatibility duration and retirement authority | Eric/release authority |
| G-PHYSICAL-ACCEPTANCE | PHYSICAL/POLICY | OPEN | Exact Moto G/Fully/NFC/audio/GPS/Karen matrix and pass thresholds | Eric/release authority |

---

## 8. Stage gates

| Stage gate | Status | Required before opening |
|---|---|---|
| Architecture internal audit | OPEN | v4.2 artifacts complete and linted |
| Independent v4.2 audits | CLOSED | Internal audit closes BLOCKER/HIGH or records bounded gates |
| Final architecture approval | CLOSED | Four independent audits reconciled; no architecture blocker |
| Isolated schema design | CLOSED | Final architecture GO plus structure-changing policy gates closed |
| Isolated component design | CLOSED | Final architecture GO and component-relevant gates closed |
| Implementation | CLOSED | Designs independently audited |
| Shadow migration | CLOSED | Implementation/security/migration audit GO |
| APK build | CLOSED | Source/runtime/release gates GO |
| Phone/canary | CLOSED | Signed admitted APK and physical plan |
| Fleet/release | CLOSED | Canary, rollback and final release audit GO |

---

## 9. Current project authorization

- Evidence research: **GO**
- Standalone v4.2 architecture replan: **GO**
- Internal architecture audit: **pending artifact completion**
- Independent v4.2 audit: **NO-GO today**
- Schema/component design: **NO-GO**
- Implementation: **NO-GO**
- Migration: **NO-GO**
- APK/phone/fleet/release: **NO-GO**