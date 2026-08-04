# Memphis Zoo Custodial Program — Unified Whole-System Research Charter

**Status:** Active foundation-first research; no implementation authorized  
**Prepared:** 2026-08-04  
**Research branch:** `agent/custodial-unified-whole-system-v4-20260803`  
**Parent architecture commit:** `92cc7a95c6c0beb211db27ac510fa725aa3c23c0`  
**Actual-program commit:** `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`  
**Backend commit:** `0fff8c2cadea132902df22c99593f1ce348411a7`  
**Required program report:** `Memphis_Zoo_Custodial_System_Final_Report_v17_optional_marketing.pdf` — 26 pages  
**Employee rollback baseline:** Custodial Build 22

---

## 1. Governing engineering doctrine

The Memphis Zoo Custodial Program will not be repaired through accumulated patches, compatibility exceptions, self-rewriting build steps or narrow fixes that preserve a defective authority model.

The required cycle is:

```text
research
→ reconstruct reality
→ plan
→ audit
→ replan
→ reaudit
→ research unresolved facts
→ replan
→ build in isolation
→ audit the build
→ rebuild weak components from the correct layer
→ adversarial and fault testing
→ shadow migration
→ physical-device testing
→ release audit
```

A failed gate returns the project to the earliest incorrect assumption, missing invariant, incomplete data model, authority conflict, lifecycle defect or unresolved operating policy. It does not authorize another layer of caulk.

Existing source, database objects, tests and deployed behavior are evidence. They are not automatically the target architecture.

---

## 2. Why a new whole-system architecture is required

Canonical Ownership Foundation Architecture v3.1 materially improves one critical subsystem: location-level responsibility over time. It correctly establishes static-first scheduling, exception-only changes, explicit `OPEN`, location-level authority, owner/cleaner separation, deterministic compilation, atomic publication and immutable history.

Independent audits nevertheless agree that v3.1 is not the complete architecture for the program. The final system must also define, as first-class authoritative domains:

- employee product behavior;
- native Android lifecycle and Fully Kiosk containment;
- NFC and tag identity;
- cleaning sessions and offline recovery;
- restroom and exhibit completion evidence;
- operational status and inspection readiness;
- maintenance, supplies, tickets and work orders;
- manager workflows and exact publication review;
- inspections and analytics;
- Messenger and Memphis AI;
- employee and manager notifications;
- events and approved operational impacts;
- guest reporting and Marketing review;
- employee feedback and help;
- employee, position, device and credential lifecycles;
- contractor assignments and acceptance;
- Read Only projections;
- AI, MCP, Moxie and diagnostics authority;
- security, retention, backup and disaster recovery;
- migration, rollback, release provenance and physical acceptance.

The new architecture will import the valid ownership contracts from v3.1. It will not append disconnected product chapters to v3.1 and declare the house finished.

---

## 3. Evidence hierarchy

When sources conflict, use this order:

1. Eric's current explicit operating and product decisions.
2. The actual custodial operating purpose.
3. `docs/custodial-field-workflow-invariants.md`.
4. Valid operational outcomes stated or shown in Final Report v17.
5. Actual frontend, native, backend and database behavior.
6. Tests only after proving they exercise the correct production path and requirement.
7. Real Moto G 2025 and Fully Kiosk behavior for NFC, lifecycle, sound, notifications, GPS, performance, permissions and containment.

Historical screenshots preserve capabilities, not obsolete interfaces. Deployed behavior proves current reality, not correctness.

---

## 4. Non-negotiable current decisions

### 4.1 Employee application

- Private, Android-only and employee-only.
- Package `org.memphiszoo.custodial`.
- Moto G 2025 under Fully Kiosk / Device Owner containment.
- Separate from Full Access Manager and Read Only.

### 4.2 Employee Home

Normal Home contains only:

- Memphis Zoo Custodial;
- enrolled employee name;
- Schedule;
- Messages;
- Events;
- Feedback.

Ordinary employees do not receive device IDs, weather, attendance, QR instructions, Scanner, enrollment controls, diagnostics, build data, permanent Refresh or bottom navigation.

### 4.3 Field workflow

- Employees own areas; software does not dictate a walking route.
- Restrooms-first is display priority, not forced travel order.
- NFC is ambient from lock state and all ordinary employee screens.
- A valid tag opens the correct Start Cleaning workflow directly.
- Enrolled-device identity supplies the employee.
- Employee QR scanning is not the normal workflow.
- Active work and completion drafts survive ordinary interruption and offline operation.

### 4.4 Scheduling

- Published static policy is normal authority.
- Dynamic changes are exception-only and minimal-change.
- Individual location is the authoritative unit.
- Groups are authoring, display and workload aids.
- Read operations never generate or mutate schedules.
- `OPEN` is explicit required coverage without an eligible owner.
- `not_required` is outside the operational-requirement interval.
- Actual cleaner and responsible owner are separate facts.
- One-time work requests do not transfer ownership.
- CoverAll is contractor capacity, not an employee identity.

### 4.5 Events, guest reporting and GPS

- Event save/import/edit/cancel does not silently alter ownership.
- Any ownership effect requires a separate reviewed manager publication.
- Guest QR reporting remains separate, optional, Marketing-reviewed and dormant until approved.
- GPS is active-session-only for the current release.
- Continuous fleet tracking is future scope.

### 4.6 Operational status and notifications

- Scan receipt or session start never resolves overdue work.
- Only accepted authoritative completion or an audited named-manager correction resolves the operational episode.
- Dismissal does not mean work was performed.
- Manager escalation is independent from employee dismissal.
- Employee cadence is exactly: chime → complete personalized announcement → chime → identical announcement → silence.
- One persistent Open/Dismiss overlay is visible at a time; later alerts queue.
- No replay occurs merely because of navigation, wake, foreground, polling or reconnect.

### 4.7 Identity and release

- Employee identity, schedule position and phone identity are different entities.
- Michael McWright and Daniel Morgan retain their historical identities.
- Replacement employees receive new permanent identities.
- Build 22 remains rollback until a later signed APK is independently admitted and physically accepted.

---

## 5. Frozen research inputs

### Frontend and native

- Repository: `lasrevinu333-design/Engine`
- Actual program: `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`
- Ownership architecture: `92cc7a95c6c0beb211db27ac510fa725aa3c23c0`

### Backend

- Repository: `lasrevinu333-design/memphis-zoo-mcp`
- Commit: `0fff8c2cadea132902df22c99593f1ce348411a7`

### Production database

- Project: Memphis Zoo Custodial Tracking System
- Access for this phase: SELECT-only schema, definition and aggregate-data inspection.
- No DDL, row mutation, function invocation with side effects or policy change is authorized.

### Program report

- Final Report v17 optional Marketing version.
- All 26 pages and page images are part of the capability evidence set.

### Independent audits

- GPT-5.3 Spark mechanical architecture audit.
- GPT-5.5 Pro operational/Karen audit.
- GPT-5.5 Instant whole-program evidence reconstruction.
- Earlier GPT-5.6 Pro employee-app audit retained only as historical implementation evidence until a current whole-program integrated audit is completed.

---

## 6. Research workstreams

### Workstream A — Capability canon

Build one ledger of every valid capability from the PDF, screenshots, current program, native runtime, backend, database, workers, tests, release controls and field operation. Every capability receives one disposition:

- retain;
- rebuild on the unified foundation;
- partial;
- missing;
- contradictory;
- retire;
- optional/approval-gated;
- future;
- physical-only;
- research required;
- Eric decision required.

Silence is not a disposition.

### Workstream B — Authority register

For every operational fact, identify:

- current writers;
- current readers;
- duplicate or fallback authority;
- target canonical writer;
- target canonical resolver/projection;
- role boundary;
- retention class;
- migration and retirement plan;
- automated and physical proof.

### Workstream C — Production truth

Inspect the deployed schema and definitions without mutation. Priority subjects:

- all schedule writers and current-owner resolvers;
- Sunday and group/location template conflict;
- read-side schedule generation;
- lunch, 9:45, departure and inheritance behavior;
- CoverAll pseudo-employees;
- employee lifecycle conflation;
- operating hours and September 14 policy;
- workload, route, zone and proximity completeness;
- session, status, readiness and scan-alert behavior;
- notification recipient revalidation and acknowledgement;
- Messenger identity, outbox, deletion and retention;
- events and schedule coupling;
- guest/feedback privacy and retention;
- RLS, grants and privileged function boundaries;
- release manifests, validation runs and recovery evidence.

### Workstream D — Operational policy

Separate questions answerable from source/data/field observation from genuine policy decisions. Do not ask Eric to decide facts that can be researched.

### Workstream E — Physical constraints

Architecture must specify the evidence required for:

- NFC from every required state;
- sleep/wake and process restoration;
- offline exactly-once behavior;
- exact notification cadence;
- no duplicate OS sound;
- overlay queue and persistence;
- GPS calibration and battery impact;
- Fully Kiosk containment;
- performance, large text, gloves and keyboard obstruction;
- Karen task completion without rescue.

---

## 7. Required architecture products

The research phase must produce:

1. Four-auditor reconciliation.
2. Production truth report.
3. Complete capability canon.
4. Canonical authority register.
5. Research and decision-gate registry.
6. Unified Whole-System Architecture v4 draft.
7. Internal adversarial audit of v4.
8. Replanned v4.1 architecture.
9. Independent audit handoff for GPT-5.3 Spark, GPT-5.5 Instant, GPT-5.5 Pro and GPT-5.6 Pro.

No schema or product implementation begins merely because these documents exist. The revised architecture must pass independent review and close all foundational gates.

---

## 8. Stage gates

| Gate | Authorization |
|---|---|
| Research GO | Current evidence collection may close for the stated questions |
| Whole-system architecture GO | Isolated schema and component design may begin |
| Schema/component design GO | Isolated implementation may begin |
| Component GO | Integration with the next isolated subsystem may begin |
| Integration GO | Shadow migration work may begin |
| Migration GO | Controlled canary may begin |
| Physical GO | Limited fleet pilot may begin |
| Release GO | Full production use may begin |

A GO at one gate never authorizes the next.

---

## 9. Current authorization state

- Research: **active**.
- Ownership v3.1: **retained as subsystem specification**.
- Whole-program architecture: **NO-GO pending unified replan**.
- Schema design: **NO-GO**.
- Product implementation: **NO-GO**.
- Migration: **NO-GO**.
- APK: **NO-GO**.
- Phone changes: **NO-GO**.
- Fleet rollout: **NO-GO**.
- Release: **NO-GO**.

---

## 10. Safety statement

This branch is for documentation, read-only research and architecture only. No production source, backend, database row, device, Fully Kiosk configuration, APK, deployment or live operational behavior is changed by this research phase.