# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4.1 Independent Audit Handoff

**Status:** Ready for four independent first-pass architecture audits  
**Prepared:** 2026-08-04  
**Audit candidate branch:** `agent/custodial-unified-whole-system-v4-20260803`  
**Audit candidate file:** `docs/audits/custodial-unified-whole-system-architecture-v4-1.md`  
**Final internal audit:** `docs/audits/custodial-unified-whole-system-architecture-v4-1-final-internal-audit.md`  
**Implementation:** not authorized

---

## 1. Frozen evidence

### Engine actual program

- Repository: `lasrevinu333-design/Engine`
- Exact actual-program commit: `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`

### Prior ownership architecture

- Branch: `agent/custodial-moto-g-simple-v23-20260802`
- Exact commit: `92cc7a95c6c0beb211db27ac510fa725aa3c23c0`
- Retained subsystem: `docs/audits/custodial-canonical-ownership-foundation-architecture-v3.md`

### Unified architecture candidate

- Branch: `agent/custodial-unified-whole-system-v4-20260803`
- Read the exact current branch head observed at audit start and report it.
- Candidate: `docs/audits/custodial-unified-whole-system-architecture-v4-1.md`

### Backend

- Repository: `lasrevinu333-design/memphis-zoo-mcp`
- Exact commit: `0fff8c2cadea132902df22c99593f1ce348411a7`

### Required report

- `Memphis_Zoo_Custodial_System_Final_Report_v17_optional_marketing.pdf`
- 26 pages
- Inspect parsed text and every page image, especially screenshot plates on pages 5–15.

### Production evidence

- Supabase project: Memphis Zoo Custodial Tracking System
- Production access is read-only for audit.
- SELECT-only schema, function, grant/RLS and aggregate-data inspection is permitted if available.
- Do not invoke mutating functions or expose credentials, raw private messages, raw GPS coordinates, private notes or unnecessary employee/device telemetry.

### Rollback baseline

- Custodial Build 22
- Package: `org.memphiszoo.custodial`
- Target: Moto G 2025, Android 16, Fully Kiosk / Device Owner

---

## 2. Mandatory reading order

1. `docs/custodial-unified-whole-system-independent-audit-handoff.md`
2. `docs/custodial-field-workflow-invariants.md`
3. Final Report v17, all pages and images
4. `docs/audits/custodial-unified-whole-system-research-charter.md`
5. `docs/audits/custodial-unified-whole-system-production-truth-research-v1.md`
6. `docs/audits/custodial-unified-whole-system-capability-canon-v1.md`
7. `docs/audits/custodial-unified-whole-system-authority-register-v1.md`
8. `docs/audits/custodial-unified-whole-system-research-and-decision-gates-v1.md`
9. `docs/audits/custodial-unified-whole-system-architecture-v4-1.md`
10. Relevant actual frontend/native/backend/database/tests and release sources

Complete and freeze independent first-pass findings before reading:

- `docs/audits/custodial-unified-whole-system-auditor-reconciliation-v1.md`
- `docs/audits/custodial-unified-whole-system-architecture-v4-internal-audit.md`
- `docs/audits/custodial-unified-whole-system-architecture-v4-1-final-internal-audit.md`
- another new auditor's report.

After the first pass, read internal material and reconcile each material conclusion against primary evidence.

---

## 3. Foundation-first doctrine

Do not recommend a local patch as the final repair when the root cause is an incorrect assumption, missing invariant, incomplete data model, duplicate authority, lifecycle defect, security-boundary flaw, migration defect or unresolved operating policy.

For every finding state:

- visible symptom;
- immediate failure;
- earliest root cause;
- why a patch/fallback/addendum is insufficient;
- correct architectural layer for repair;
- retain/rebuild/retire/research/decision disposition;
- proof needed.

Temporary shadow/compatibility mechanisms are acceptable only when bounded, non-authoritative and paired with an explicit retirement gate.

---

## 4. Read-only restrictions

Do not:

- modify source or documentation;
- create/update branches, commits, PRs or issues;
- trigger workflows/builds;
- alter Supabase/Render/Firebase/GitHub Pages;
- build or install an APK;
- change a phone or Fully Kiosk;
- change employees, devices, schedules, events, policies, credentials or production data;
- accept intended behavior or passing test names as proof.

If an essential evidence source remains unavailable after actual connector/file attempts, return `AUDIT BLOCKED — NO ARCHITECTURE VERDICT` and exact errors. Do not call access failure GO/CONDITIONAL GO/NO-GO.

---

## 5. Current fixed product and operating decisions

- Employee product is private Android employee-only.
- Full Access Manager and private Read Only are separate products.
- Read Only is Dashboard and Events only.
- Employee Home contains title, enrolled employee name, Schedule, Messages, Events and Feedback only.
- NFC is ambient and directly opens the correct Start Cleaning workflow.
- Enrolled device supplies employee identity.
- No normal employee Scanner/QR/name-selection workflow.
- Employee owns areas and chooses practical order; phone does not dictate route.
- Restrooms-first is display priority.
- Static published schedule is normal authority.
- Dynamic scheduling is exception-only and minimal-change.
- Individual location is final authority unit.
- Read paths never generate or mutate schedules/ownership/status.
- Events do not automatically alter ownership.
- Guest QR is separate, dormant and approval-gated.
- GPS is active-session-only in this release.
- Owner, active cleaner and actual cleaner are different facts.
- CoverAll is contractor capacity, not employee identity.
- Work request is not ownership transfer.
- Scan/start/open/dismiss never resolves overdue work.
- Accepted completion or audited manager correction resolves the operational episode.
- Exact employee audio cadence is two identical chime/speech cycles, then silence.
- One persistent overlay; later alerts queue; no lifecycle replay.
- Michael McWright and Daniel Morgan retain historical identity.
- Build 22 remains rollback.

---

## 6. Verdict scope

The requested architecture verdict is one of:

- `GO`
- `CONDITIONAL GO`
- `NO-GO`

It answers only:

> Is v4.1 complete and coherent enough to authorize isolated schema and component design after its stated research/policy conditions are closed?

State separate authorization for:

- independent/replan work;
- schema/component design;
- implementation;
- migration;
- APK;
- phone/fleet;
- release.

No architecture verdict automatically authorizes a later gate.

---

## 7. Auditor assignments

### 7.1 GPT-5.3 Spark — Mechanical architecture falsifier

Primary focus:

- authority-set manifest and canonical serialization;
- schema enforceability and temporal constraints;
- service occurrence/status/readiness mechanics;
- ownership compiler determinism and minimal change;
- identity/location/position/device lifecycle;
- session/offline/idempotency/concurrency;
- notification state machines and transactional outbox;
- migration confidence, cutover and rollback;
- false-confidence tests.

Attack:

- overlapping/missing intervals;
- equal-time collisions;
- DST/cross-midnight;
- hash/input instability;
- interrupted publication;
- stale epoch/offline replay;
- completion/issue/inspection truth tables;
- active session across transitions;
- provider/ack races;
- rollback with pending local work;
- schema security and grants.

Do not reduce inspection readiness to an unreviewed simple Boolean formula.

### 7.2 GPT-5.5 Instant — Capability and completeness auditor

Primary focus:

- every valid PDF/current-program capability has a home;
- no hidden legitimate feature disappears;
- obsolete behavior is explicitly retired;
- product/role/domain boundaries;
- authority register completeness;
- research/decision gate completeness;
- availability, retention, recovery, release and physical domains;
- no disconnected “later alignment.”

Attack both directions:

```text
capability → architecture → authority → product → proof
architecture object → legitimate operational purpose → source evidence
```

### 7.3 GPT-5.5 Pro — Operations and Karen auditor

Primary focus:

- actual custodial day;
- Karen comprehension and manager rescue burden;
- four-button Home and NFC-first field work;
- current-area Schedule through 9:45/lunch/departure/zero staff;
- restroom/exhibit completion under gloves/noise/time pressure;
- manager exact-diff schedule workflow;
- contractor practicality;
- inspection readiness and Dashboard language;
- Messenger privacy and novice flow;
- event/feedback/issue pathways;
- fair analytics and physical acceptance.

For every employee state answer:

> What does Karen believe happened, and what does she do next?

### 7.4 GPT-5.6 Pro — Integrated architecture/security/migration auditor

Primary focus:

- whole-system authority-set compatibility;
- cross-domain facts/events/transactions;
- trust boundaries and confused-deputy risk;
- AI/MCP/Moxie/diagnostic authority;
- retention/privacy/holds/backup/DR;
- whole-program migration, legacy retirement and rollback;
- release tuple, APK provenance and physical evidence;
- shared blind spots missed by narrower auditors.

Attack complete flows:

```text
static policy/exception
→ ownership
→ employee work/session/GPS/completion
→ status/readiness/inspection
→ Dashboard/alerts/Messenger/AI/analytics
→ history/retention/migration/release
```

---

## 8. Required finding format

For every BLOCKER/HIGH finding include:

- capability/workflow;
- exact architecture section;
- PDF page when applicable;
- exact source/function/API/SQL/test or production evidence;
- proven fact versus inference;
- visible symptom;
- root cause;
- cross-system blast radius;
- why patching is inadequate;
- correct architectural repair;
- retain/rebuild/retire/research/decision;
- automated proof;
- physical proof;
- gate blocked.

Include MEDIUM/LOW findings, false-confidence tests, missing research and genuine Eric decisions.

---

## 9. Mandatory attack areas

1. Operational authority-set activation and rollback.
2. Location rename/split/merge/closure/tag lifecycle.
3. Employee/position/vacancy/contractor/device epoch lifecycle.
4. Static source/Sunday migration and historical confidence.
5. Workload/route/frequency unknowns and determinism.
6. Requirement/service occurrence creation and next-cycle behavior.
7. 9:45/lunch/departure/one/zero staff/cross-midnight/event collision.
8. Active session across ownership/shift/lunch/alert/reassignment/app update.
9. Offline clock skew, expired snapshot, outage, storage exhaustion and downgrade.
10. Completion correction, issue severity, ticket/W.O. Submitted and readiness.
11. Scan/open/dismiss inability to resolve work.
12. Notification grouping/priority/revalidation/ack/escalation/no replay.
13. Messenger stale recipient/outbox/delete/archive.
14. Event parser/save/AI reads cannot mutate schedule.
15. Guest/contractor/public/Read Only/AI/diagnostic boundaries.
16. Analytics attribution/confidence/anti-misuse.
17. Retention/hold/purge/FK/backup/restore.
18. Source→release→APK→Moto G/Fully Kiosk/Karen proof.
19. Test-data separation from production identities.
20. Availability/SLO/hosting dependency behavior.

---

## 10. Required final output

1. Exact access evidence and commits/head observed.
2. Architecture verdict and separate gate matrix.
3. Executive explanation.
4. Strengths that should survive replan.
5. BLOCKER/HIGH/MEDIUM/LOW findings.
6. Capability omissions and architecture objects without purpose.
7. Duplicate-authority or cross-domain contradiction map.
8. Research gaps separated into source, production, field, physical and policy.
9. False-confidence tests and missing evidence.
10. Prioritized foundational replan.
11. Revised exit gates before isolated design.
12. Genuine Eric decisions only.
13. No-change statement.

Do not implement repairs or write migration DDL.

---

## 11. Current internal status

The internal audit reports:

- GO to submit v4.1 for four independent first-pass architecture audits;
- NO-GO for treating v4.1 as finally approved;
- NO-GO for schema/component design;
- NO-GO for implementation, migration, APK, phone and release.

Independent auditors must challenge that conclusion rather than inherit it.