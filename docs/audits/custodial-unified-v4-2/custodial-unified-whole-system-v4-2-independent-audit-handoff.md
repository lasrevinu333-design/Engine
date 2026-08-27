# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4.2 Independent Audit Handoff

**Status:** Prepared for four independent first-pass architecture audits; implementation is not authorized  
**Working branch:** `agent/custodial-unified-whole-system-v4-2-20260804`  
**Planned immutable audit branch:** `audit/custodial-unified-v4-2-freeze-20260804`  
**Exact frozen commit:** supplied in the PR launch comment after the freeze branch is created  
**Rollback baseline:** Custodial Build 22

---

## 1. Audit purpose

Unified Architecture v4.2 is a standalone replan of the complete Memphis Zoo Custodial Program. It is not an addendum to v4.1 and is not an implementation candidate.

The four independent audits must determine whether v4.2:

- describes the complete valid program;
- closes the accepted v4.1 architecture findings;
- defines cross-domain record, authority-set, principal, occurrence, location-transition, retention, migration and release contracts strongly enough for later isolated design;
- keeps unresolved operational values explicit and fail-closed;
- avoids legacy patchwork and permanent compatibility authority;
- can authorize isolated schema/component design only after its named gates close.

No auditor may authorize implementation, migration, APK, phone or release merely because the architecture is coherent.

---

## 2. Frozen evidence

### Frontend/native actual program

- Repository: `lasrevinu333-design/Engine`
- Commit: `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`

### Prior ownership subsystem

- Repository: `lasrevinu333-design/Engine`
- Commit: `92cc7a95c6c0beb211db27ac510fa725aa3c23c0`

### Audited v4.1 predecessor

- Repository: `lasrevinu333-design/Engine`
- Frozen branch: `audit/custodial-unified-v4-1-freeze-20260804`
- Commit: `7d3e30d7ab6deb9dfa70224a9f6c3a3dab6292fc`

### V4.2 candidate

- Repository: `lasrevinu333-design/Engine`
- Immutable audit branch: `audit/custodial-unified-v4-2-freeze-20260804`
- Exact commit: use the SHA in the PR launch comment; verify branch and SHA are identical before auditing

### Backend

- Repository: `lasrevinu333-design/memphis-zoo-mcp`
- Commit: `0fff8c2cadea132902df22c99593f1ce348411a7`

### External evidence

- `Memphis_Zoo_Custodial_System_Final_Report_v17_optional_marketing.pdf`
- 26 pages; all page images must be inspected
- Candidate workbook: `Memphis_Zoo_Static_Custodial_Schedule_COMPLETE_v2_OPEN.xlsx`
- Candidate workbook is evidence only, never approved/importable policy
- Generated seed SQL is quarantined and must not be executed

### Employee target

- Package: `org.memphiszoo.custodial`
- Moto G 2025
- Android 16
- Fully Kiosk / Device Owner

---

## 3. Access recovery rules

Do not declare an audit blocked from one incomplete branch or repository search.

For each repository/ref, attempt:

1. direct exact commit fetch;
2. direct file fetch by repository/path/ref;
3. exact branch search;
4. compare branch to supplied commit;
5. direct GitHub blob URL;
6. repository installation/account discovery only if direct retrieval fails.

A metadata lookup failure does not invalidate successfully fetched source.

Live Supabase access is optional. The frozen production-truth documents, including v4.2 production-truth addendum v9, are mandatory. An auditor may use live Supabase only with SELECT-only inspection.

If an essential exact commit, architecture file, backend source or PDF remains inaccessible after real fallback calls, return only:

`AUDIT BLOCKED — NO ARCHITECTURE VERDICT`

State exact tool, target, ref/path and error. Do not call an access failure GO, CONDITIONAL GO or NO-GO.

---

## 4. Required first-pass reading order

Read before forming findings:

1. this handoff;
2. `custodial-field-workflow-invariants.md` from the actual-program commit;
3. every page and image of v17;
4. `custodial-unified-whole-system-evidence-manifest-v1.md`;
5. `custodial-unified-whole-system-trace-code-registry-v1.md`;
6. `custodial-unified-whole-system-capability-trace-v2.md`;
7. `custodial-unified-whole-system-v4-2-gate-registry-v1.md`;
8. `custodial-unified-whole-system-production-truth-addendum-v9.md`;
9. all v4.1 production-truth research/addenda registered in the manifest;
10. `custodial-unified-whole-system-architecture-v4-2.md`;
11. actual frontend/native/backend/database/tests/workflows/release evidence as required.

The auditor must independently test the architecture rather than trusting the trace labels.

---

## 5. Independence rule

Before completing and freezing the first-pass findings, do not read:

- `custodial-unified-whole-system-architecture-v4-2-internal-audit.md`;
- `custodial-unified-whole-system-v4-1-four-auditor-final-reconciliation.md`;
- another new v4.2 auditor report;
- a future combined v4.2 reconciliation.

After the independent first pass is frozen, read the internal audit and v4.1 reconciliation and state which conclusions are independently corroborated, incomplete, contradicted or unsupported.

Do not average verdicts.

---

## 6. Foundation-first doctrine

For every defect:

1. identify the earliest missing invariant, incorrect assumption, incomplete authority, lifecycle, security, concurrency, migration or policy contract;
2. explain why a local conditional, fallback, compatibility flag, endpoint patch, UI warning or test-string change is insufficient;
3. identify the correct architecture layer;
4. classify the target as retain, rebuild, retire, research required or policy decision required;
5. require automated and physical proof at the correct stage.

Compatibility is acceptable only when temporary, non-authoritative, bounded, observable, reversible and assigned a retirement gate.

---

## 7. Fixed decisions

- Employee product is private, Android-only and employee-only.
- Manager and Read Only are separate private products.
- Read Only is Dashboard and Events only.
- Employee Home contains title, employee name, Schedule, Messages, Events and Feedback only.
- No employee Scanner page, QR workflow, weather, attendance, device administration, diagnostics, enrollment removal or bottom navigation.
- NFC is ambient and opens Start Cleaning directly.
- Enrolled-device identity supplies employee identity.
- Employees own areas; the phone does not dictate a route.
- Static schedules are normal authority; dynamic changes are exception-only and minimal-change.
- Individual location is authoritative.
- Events cannot silently modify service requirements or ownership.
- Guest reporting remains disabled and Marketing-gated.
- GPS is active-session-only for the current release.
- Owner, active cleaner and actual cleaner are distinct.
- CoverAll is contractor capacity, not an employee identity.
- Work requests do not transfer ownership.
- Scan/start, Open/Dismiss and message read do not resolve work.
- Audio is exactly chime → full speech → chime → identical speech → silence.
- Default architecture prohibits speech preemption.
- Build 22 remains rollback until later physical acceptance.

---

## 8. Common audit attacks

Every auditor must attack at least:

1. CAP-001–CAP-252 completeness and reverse mapping.
2. Evidence-manifest precedence and drift.
3. Cross-domain record envelope and version/replay behavior.
4. Distributed authority-set activation, pinning, adapters, split-brain and rollback.
5. Principal/grant/session/authorization decision and confidential accommodation boundary.
6. Location rename/close/retire/split/merge/tag and in-flight work.
7. Static source, positions, schedule, workload, route, hours, lunch, 9:45, `OPEN`, after-hours and cross-midnight.
8. Service-occurrence satisfaction, concurrency, correction and next-cycle creation.
9. Session/offline/reboot/key/lost-phone/reassignment/GPS behavior.
10. Completion, issue, ticket, readiness and inspection truth.
11. Notification grouping, final recipient, epoch-bound acknowledgement, visible stale cancellation and escalation.
12. Messenger visibility/outbox/delete/reappearance/archive.
13. Event cancellation/impact reversal and no read-side mutation.
14. Guest/Feedback/contractor boundaries.
15. AI/MCP/Moxie/diagnostic executable authorization.
16. Retention, holds, analytics anti-misuse and complete restore bundle.
17. Machine-enforced writer/resolver/trigger/cron/API/tool retirement.
18. Release tuple, validation invalidation, Build 22 and physical acceptance.
19. False-confidence tests and historical green evidence.
20. Whether any later designer would still need to invent foundational semantics.

---

## 9. Trace and registry validation

Each auditor must independently verify:

- CAP-001 through CAP-252 appear exactly once in the main trace;
- all shorthand resolves through the code registry;
- all architecture section references resolve;
- all gate IDs resolve;
- every architecture object reverse-maps to one or more capabilities;
- no legitimate capability lacks an authority/security/retention/migration/proof home;
- no architecture object exists only to preserve a legacy implementation.

A claimed trace is not proof merely because it contains 252 labels.

---

## 10. Verdict scope

Allowed architecture verdicts:

- `GO`
- `CONDITIONAL GO`
- `NO-GO`

The verdict answers:

> Is v4.2 complete and normative enough to authorize later isolated schema/component design after all structure-changing research and policy gates close, without requiring designers to invent foundational semantics?

It does not authorize implementation.

Return a separate matrix for:

- architecture replan;
- final architecture approval;
- schema design;
- component design;
- implementation;
- migration;
- APK;
- phone;
- release.

---

## 11. Required finding format

For every BLOCKER/HIGH finding provide:

- exact architecture section and supporting source/SQL/test;
- proven fact versus inference;
- failure mechanism;
- root cause;
- cross-domain blast radius;
- why patching is inadequate;
- correct architecture layer;
- retain/rebuild/retire/research/decision disposition;
- required automated proof;
- required physical proof;
- gate impact.

Do not write implementation code or migration SQL.

---

## 12. Safety

The v4.2 audits are read-only.

Do not modify:

- source or architecture files;
- branches, PRs, issues or comments;
- database objects or rows;
- workflows/builds/APKs;
- phones or Fully Kiosk;
- deployments, employees, devices, schedules, Events, guest settings, credentials or policies.

Michael McWright and Daniel Morgan production identities remain unchanged.