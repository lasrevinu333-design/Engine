# Memphis Zoo Custodial System — Foundation Truth Audit Plan

**Status:** Read-only research and planning artifact  
**Prepared:** 2026-08-03  
**Frontend repository:** `lasrevinu333-design/Engine`  
**Employee-app branch under study:** `agent/custodial-moto-g-simple-v23-20260802`  
**Branch tree restored for foundation review:** `d73f5ff6ffeb0d964f69790a2d39ca50ac64616b`  
**Backend repository:** `lasrevinu333-design/memphis-zoo-mcp`  
**Accepted installed employee rollback baseline:** Custodial Build 22  
**Target employee device:** Moto G 2025 under Fully Kiosk / Device Owner containment

---

## 1. Purpose

This audit reconstructs the complete intended Memphis Zoo Custodial System before additional product construction resumes.

The system will not be judged from one document, one screen, one branch, or one test suite. The audit will compare:

1. the real custodial operating purpose;
2. the Final Report v17 summary PDF and its screenshots;
3. the original and current frontend implementation;
4. the Android/Capacitor implementation and packaged runtime graph;
5. the backend routes, workers, database functions, migrations, and policies;
6. the test suites and what they actually prove;
7. observed field behavior on the Moto G phones;
8. Eric's clarified operating rules and current staffing reality.

The objective is not to preserve old code because it is old, or replace old code because it is old. The objective is to preserve proven strengths, correct foundational defects, and produce the strongest faithful implementation of the system's true purpose.

---

## 2. Non-negotiable engineering method

The project will follow this sequence:

1. become expert in the complete existing system;
2. inventory every feature and data path;
3. reconstruct intended behavior;
4. compare intent with actual behavior;
5. identify omissions, contradictions, and inherited defects;
6. design one coherent architecture;
7. audit the architecture plan;
8. revise the plan until contradictions are resolved;
9. implement directly from the approved architecture;
10. audit the implementation;
11. repair root causes, not symptoms;
12. rebuild and retest until the product is correct;
13. perform independent source, APK, and physical-phone acceptance.

Prohibited methods:

- bandage fixes;
- self-modifying patch scripts;
- CI workflows that rewrite or commit product source;
- changing implementation solely because the next legacy assertion fails;
- preserving duplicated runtime owners;
- guessing absent requirements;
- accepting a test name as proof;
- treating the PDF or original build as unquestionable authority;
- triggering Codemagic or installing an APK before the required gates pass.

---

## 3. Evidence hierarchy

When evidence conflicts, resolve it in this order:

### 3.1 True operational purpose

The primary purpose is to remove uncertainty from custodial operations:

- know whether work has started or finished;
- know who performed it;
- know where and when it occurred;
- know what services were completed;
- know what problems were found;
- know whether a location is ready to inspect;
- keep current ownership visible as staffing conditions change;
- preserve evidence for coaching, planning, maintenance, supply, staffing, and accountability.

### 3.2 Explicit current decisions

Current decisions include:

- employee app is Android-only and employee-only;
- normal employee Home contains Schedule, Messages, Events, and Feedback;
- NFC is ambient and opens the cleaning workflow directly;
- static premade schedules are the normal daily authority;
- dynamic scheduling is exception-only;
- employees choose their own sensible order within owned areas;
- GPS scope for this release is active cleaning sessions only;
- continuous fleet mapping is a future feature;
- departed employees remain in the system until Eric explicitly changes their status;
- historical employee records are never renamed into replacement employees.

### 3.3 Operational invariants

`docs/custodial-field-workflow-invariants.md` is authoritative where it reflects the current real workflow.

### 3.4 Final Report v17

The report is a major source of intended capabilities and original positioning, but it is not complete and may contain claims that were only partial or aspirational.

### 3.5 Actual source and database behavior

The code establishes what the system currently does, not necessarily what it should do.

### 3.6 Tests

Tests are evidence only after verifying that they exercise the correct production path and current requirement.

### 3.7 Physical device behavior

For NFC, Fully Kiosk containment, wake/reboot, permissions, audio, notifications, GPS accuracy, and performance, the Moto G 2025 is the final authority.

---

## 4. Fixed scheduler foundation

### 4.1 Static schedule is normal authority

The applicable premade weekly schedule must generate the normal daily schedule.

A normal day must not be redesigned, rebalanced, or regenerated merely because:

- a page opens;
- an employee checks Schedule;
- Memphis AI receives a question;
- a background poll runs;
- a different algorithm can produce a numerically different result.

### 4.2 Valid reasons for a changed daily schedule

A published day may change only because of a real input change:

- approved PTO;
- callout or absence;
- CoverAll addition or removal;
- employee departure or inactive status;
- new employee activation;
- explicit manager reassignment;
- newly published static schedule version becoming effective;
- seasonal operating-hours change;
- event/emergency override;
- correction of a proven invalid schedule.

### 4.3 Exception optimization

Exception scheduling must begin with the static schedule and minimize unnecessary movement.

Priorities:

1. all required coverage is represented;
2. no assignment exceeds an employee's active shift;
3. restrictions and qualifications are honored;
4. locations remain geographically coherent;
5. workload is balanced using meaningful load values;
6. static ownership is preserved where practical;
7. the fewest necessary assignments move;
8. all changes are previewed and auditable;
9. no owner is fabricated when no eligible employee remains.

### 4.4 Stable daily identity

A daily schedule requires a deterministic identity derived from at least:

- static schedule version;
- service date;
- active roster;
- absences;
- CoverAll additions;
- shift and lunch windows;
- seasonal close time;
- manager overrides;
- relevant operational rules.

Unchanged inputs must return the existing published schedule.

### 4.5 Static schedule replacement

A new premade schedule requires:

1. import;
2. employee/location resolution;
3. full-week preview;
4. coverage, workload, proximity, restriction, lunch, and close-time audit;
5. comparison against the current version;
6. explicit approval;
7. effective date;
8. rollback capability.

Publishing a future schedule must not rewrite historical published days.

---

## 5. Employee lifecycle foundation

The system must support:

- retaining Michael and Daniel as active records during the current build until Eric explicitly changes them;
- marking an employee inactive without deleting history;
- releasing or reassigning the employee's phone;
- disabling future schedule generation and Messenger/device access when inactive;
- preserving sessions, inspections, messages subject to retention, schedules, analytics, issues, and assignment history;
- adding a new employee with a new permanent identity;
- creating the new employee's Messenger identity;
- assigning shift templates and static areas;
- assigning a phone;
- previewing future schedules before activation;
- moving an employee between phones without duplicate active assignments;
- versioning all manager changes with actor, reason, and timestamp.

Historical records must remain tied to the actual employee who created them.

---

## 6. GPS scope for this release

### 6.1 Required now

GPS is required only while a cleaning session is active.

The system must determine whether the phone remains within the general allowed area for the scanned location while that session is open.

### 6.2 Evidence rules

Do not declare that an employee left based on one weak reading.

A reliable departure determination must account for:

- precise location permission;
- Android location settings enabled;
- observation age;
- reported accuracy;
- configured location or location-group coordinates;
- allowed radius;
- hysteresis/uncertainty band;
- impossible motion rejection;
- consecutive outside readings or an approved dwell threshold;
- return-to-area evidence;
- offline storage and later synchronization.

### 6.3 Required states

At minimum:

- inside active scanned area;
- outside active scanned area, unconfirmed;
- outside active scanned area, confirmed;
- returned to active scanned area;
- boundary uncertain;
- low accuracy;
- stale reading;
- location unavailable;
- permission disabled;
- system location disabled;
- coordinates not configured;
- impossible GPS jump.

### 6.4 Manager evidence

A manager-facing exception must include:

- employee;
- device;
- session;
- location;
- first outside observation;
- confirmation time;
- last known distance;
- accuracy;
- allowed radius;
- return time if applicable;
- whether observations were uploaded live or synchronized later.

### 6.5 Future feature, not current release scope

A live zoo map showing all employee phones at any time will be preserved as a future architecture extension. Current work must not prevent it, but it will not be built into this employee release.

---

## 7. Complete domain inventory

Every domain below must receive a requirements, implementation, data, security, test, and physical-validation audit.

### Domain 1 — Product and role separation

- Custodial employee Android app;
- Ops Manager Full Access Android/iOS app;
- Read Only Android/iOS app with Dashboard and Events only;
- web manager tools;
- public guest-report pages;
- CoverAll secure assignment pages;
- MCP/connected ChatGPT access;
- role and credential boundaries.

### Domain 2 — Employee Home and navigation

- one canonical Home;
- employee identity;
- Schedule, Messages, Events, Feedback;
- Back behavior;
- active-session takeover and return;
- no manager/admin leakage;
- no QR/scanner primary destination;
- no duplicate shell/legacy ownership.

### Domain 3 — Device identity and enrollment

- canonical KIOSK identity;
- aliases;
- employee assignment;
- assignment epochs;
- native vault;
- enrollment, recovery, cancellation, removal;
- manager-gated setup;
- conflict detection;
- reboot and replacement behavior.

### Domain 4 — Static schedules and versioning

- weekly shift templates;
- employee-area mappings;
- location groups and memberships;
- static schedule versions;
- effective dates;
- imports;
- previews;
- publish and rollback;
- historical preservation.

### Domain 5 — Daily schedule generation

- idempotent daily generation;
- input fingerprint;
- stable normal-day output;
- roster creation;
- close-time policy;
- missing/corrupt schedule handling;
- no read-triggered destructive regeneration.

### Domain 6 — Exception scheduling

- PTO;
- callouts;
- CoverAll additions;
- varied start/end times;
- 9:45 restroom rebalance;
- lunch start/end;
- shift-end inheritance;
- emergency/manager reassignment;
- uncovered/open exceptions;
- workload and proximity scoring;
- minimal-change objective;
- audit and rollback.

### Domain 7 — Employee current-ownership Schedule

- areas owned now;
- restrooms displayed first without forced route;
- temporary lunch section and end time;
- added/inherited areas;
- removed/transferred areas;
- schedule version and transition time;
- launch/foreground/reconnect/notification/boundary refresh;
- no permanent Refresh control;
- employee-safe errors.

### Domain 8 — NFC and native routing

- physical NFC tag contents;
- Android 16 intent delivery;
- launch, foreground, lock-state, background, wake, reboot, idle, and offline scans;
- one persistent owner;
- deduplication;
- location resolution;
- device-bound employee identity;
- correct Start Cleaning screen;
- no vibration-only dead end;
- no manual Scanner requirement.

### Domain 9 — Cleaning session state machine

- valid start;
- active timer;
- second scan/finish;
- completion form;
- closed session;
- cancelled/invalid session;
- duplicate protection;
- wrong-location protection;
- process death and WebView restoration;
- active-session return after sleep/wake.

### Domain 10 — Restroom and exhibit completion evidence

- distinct service sets;
- exact required operational labels;
- normal full-clean path;
- individual-work path;
- issues and out-of-order reporting;
- notes;
- inspection-readiness consequences;
- manager-visible evidence;
- form draft persistence;
- minimal employee cognitive load.

### Domain 11 — Offline and synchronization

- start offline;
- finish offline;
- completion offline;
- GPS evidence offline;
- notification acknowledgements offline where supported;
- durable queue;
- exactly-once server effect;
- poison/dead-letter handling;
- visible employee-safe state;
- manager device-health state;
- reconnect and reboot recovery.

### Domain 12 — Active-session GPS

- permissions;
- location settings;
- native versus WebView ownership;
- update interval;
- battery impact;
- local and server evaluation parity;
- location calibration;
- false-positive prevention;
- confirmed-away event;
- return event;
- manager presentation;
- retention and privacy.

### Domain 13 — Employee notifications

- message;
- Memphis message;
- event;
- due soon;
- overdue;
- 9:45 change;
- lunch start/end;
- inherited areas;
- transferred/removed areas;
- manager/emergency reassignment;
- durable queue;
- stable notification key;
- displayed/opened/dismissed acknowledgements;
- exact chime, voice, chime, identical voice, silence sequence;
- overlay persistence;
- no private message content spoken;
- no replay after navigation, wake, reconnect, or polling.

### Domain 14 — Messenger

- direct messages;
- groups and broadcasts where authorized;
- Memphis system thread;
- employee recipient picker;
- thread isolation;
- incremental sync;
- optimistic send;
- outbox recovery;
- unread state;
- employee hide/delete semantics;
- retention;
- manager authority;
- performance;
- notification integration.

### Domain 15 — Events

- event input;
- spreadsheet/document parsing;
- event validation;
- publish/update/cancel;
- location, attendance, timing, notes, status;
- employee event display;
- day-before and shift-relative reminders;
- staffing and restroom planning consequences;
- event retention and privacy.

### Domain 16 — Guest cleanliness reporting

- feature approval gate;
- location-bound QR;
- guest form;
- guest privacy;
- public rate limiting;
- manager review;
- assigned-employee alert;
- issue status;
- follow-up and closure;
- repeated issue patterns;
- Marketing integration;
- employee app relationship.

### Domain 17 — Dashboard and inspection readiness

- cleaned/not cleaned;
- active session;
- overdue/due soon;
- employee;
- timestamps;
- services;
- issues;
- open tickets;
- inspection-ready state;
- recent activity;
- stale data handling;
- current ownership;
- manager actions;
- Read Only projection.

### Domain 18 — Inspections and operational analytics

- inspection records;
- employee/location comparisons;
- duration patterns;
- quality outcomes;
- recurring problems;
- workload analysis;
- route/ownership fairness;
- coaching context;
- retention windows;
- filters and export;
- factual limitations and anti-misuse controls.

### Domain 19 — Maintenance, supplies, and tickets

- form-generated maintenance issues;
- guest-generated issues;
- ticket creation;
- OPEN and W.O. Submitted lifecycle;
- repeated fixture failure;
- recurring supply shortage;
- chronic location issues;
- manager closure/follow-up;
- pattern analytics;
- event and schedule context.

### Domain 20 — Attendance

- attendance source;
- freshness and cache;
- failure state;
- use in manager Hub;
- whether attendance affects scheduling or is informational only;
- privacy and access.

### Domain 21 — Employee and phone administration

- add employee;
- active/inactive state;
- preserve departed employee history;
- phone assignment and movement;
- Messenger identity;
- device release;
- aliases;
- assignment history;
- manager authorization;
- replacement employee onboarding.

### Domain 22 — Memphis AI, Moxie, and diagnostics

- connected data sources;
- read/write authority;
- schedule questions;
- coverage questions;
- contacts;
- events;
- tickets;
- repairs and controlled actions;
- hallucination controls;
- explicit confirmation;
- diagnostics versus operational product function;
- whether each capability belongs in the final product.

### Domain 23 — Feedback

- employee feedback;
- manager feedback;
- private attachments;
- status/triage;
- reminder workflow;
- retention;
- product feedback versus operational issue reporting;
- employee-safe form design.

### Domain 24 — Manager access and device security

- named leadership identities;
- trusted devices;
- enrollment;
- recovery;
- revocation;
- read-only versus write authority;
- session/key handling;
- audit history;
- lost/stolen device response;
- private Manager application boundary.

### Domain 25 — CoverAll

- contractor slots;
- secure assignment links;
- language support;
- expiration and revocation;
- absence ineligibility;
- schedule integration;
- employee/privacy boundaries;
- no access to unrelated tools.

### Domain 26 — Viewer / Read Only

- Dashboard and Events only;
- no employee route details;
- no device identity;
- no internal notes;
- no manager actions;
- no Messenger;
- no schedule administration;
- separate package and authorization.

### Domain 27 — Backup, restore, and schema integrity

- production backup;
- restore verification;
- empty-database rebuild;
- schema fingerprint;
- transition windows;
- canonical migration ordering;
- data retention;
- destructive-operation protections;
- disaster recovery drill.

### Domain 28 — Build, release, and admission

- exact package;
- versionCode;
- signer;
- native-vault source digest;
- runtime asset manifest;
- source commit/tree provenance;
- Android permission/component graph;
- no backup/device transfer;
- anti-rollback;
- Codemagic fail-closed admission;
- Build 22 rollback preservation;
- producer/consumer verification.

### Domain 29 — Fully Kiosk and physical-device containment

- Device Owner;
- Single App;
- launcher/Home/Recents escape;
- reboot relaunch;
- screen-off/wake;
- permission policy;
- location-service policy;
- notification/audio behavior;
- battery optimization;
- update/install procedure;
- phone replacement;
- physical Karen usability.

### Domain 30 — Performance, accessibility, and low-technology usability

- 48 dp targets;
- font scaling;
- contrast;
- keyboard behavior;
- no drag-only requirement without alternative;
- visible tap feedback;
- NFC response time;
- message opening time;
- wrong-recipient prevention;
- common tasks within three decisions;
- employee-safe language;
- manager explanation count;
- real-user success rate.

---

## 8. Capability truth ledger

Every capability will be recorded with:

| Field | Meaning |
|---|---|
| Capability ID | Permanent audit identifier |
| Intended purpose | Operational outcome |
| PDF claim | Exact report claim, if any |
| Screenshot evidence | What original screens showed |
| Frontend implementation | Files/functions/routes |
| Native implementation | Android/Capacitor owner |
| Backend implementation | Routes/workers/RPCs |
| Database implementation | Tables/functions/triggers/policies |
| Authorization | Who can read/write |
| Tests | Tests and what they truly execute |
| Field evidence | Phone/live observations |
| Status | Proven / Partial / Missing / Contradictory / Obsolete / Future |
| Root issue | Foundational cause |
| Correct target | Approved behavior |
| Required repair | Architectural work, not patch |
| Required acceptance | Automated and physical proof |

No capability will be marked complete from source strings alone.

---

## 9. Required discrepancy classes

The audit must explicitly find:

1. report says it exists, but implementation is absent;
2. report says it exists, but implementation is partial;
3. report says it exists, but implementation behaves differently;
4. implementation exists but report omitted it;
5. implementation exists but has no valid operational purpose;
6. original behavior conflicts with current decisions;
7. duplicated owners create inconsistent behavior;
8. backend is correct but frontend misrepresents it;
9. frontend appears correct but backend does not enforce it;
10. tests pass obsolete or non-production behavior;
11. security/release machinery protects the wrong runtime;
12. feature works in a browser but not in the Moto G/Fully environment;
13. feature works online but loses or duplicates data offline;
14. feature produces data but no useful manager action;
15. feature exposes private or technical information unnecessarily.

---

## 10. Audit phases

### Phase A — Complete inventory

- enumerate frontend runtime assets;
- enumerate mobile editions and routes;
- enumerate native plugins, permissions, components, and intent filters;
- enumerate backend routes and workers;
- enumerate MCP tools;
- enumerate database schemas/functions/triggers/policies;
- enumerate queues and retention jobs;
- enumerate all tests and workflows;
- enumerate physical device settings and accepted build evidence.

### Phase B — Requirements reconstruction

For each domain:

- extract PDF claims;
- extract original screen behavior;
- extract operational invariants;
- record Eric's current clarifications;
- identify unresolved decisions;
- define the exact intended outcome.

### Phase C — Implementation trace

Trace each outcome from UI through native layer, backend, database, acknowledgement, analytics, and recovery.

### Phase D — Test audit

Classify each test:

- current behavioral proof;
- security/release invariant;
- obsolete requirement;
- source-string-only;
- mocked away from production;
- manager/viewer-only;
- physical-device-only;
- missing.

### Phase E — Foundation architecture plan

Define one owner for each responsibility:

- navigation;
- NFC;
- active-session persistence;
- GPS;
- notifications;
- schedule truth;
- offline queue;
- device identity;
- authorization;
- analytics;
- release provenance.

### Phase F — Plan audit and revision

Audit the plan against:

- every capability in the truth ledger;
- all current operational decisions;
- security/release invariants;
- low-technology employee use;
- physical Android constraints;
- independent GPT-5.3, GPT-5.5 Pro, and GPT-5.6 Pro review.

No implementation starts until unresolved BLOCKER/HIGH plan contradictions are eliminated.

### Phase G — Foundation implementation

Implement coherent subsystems directly. Do not construct product behavior through patch scripts or CI source rewriting.

### Phase H — Build audit

- source review;
- behavior tests;
- integration tests;
- Android generated-app tests;
- runtime/package inspection;
- security and release verification;
- independent frozen-commit audits.

### Phase I — APK and Moto G acceptance

- signed APK admission;
- Karen phone installation;
- Fully containment;
- NFC matrix;
- sleep/wake/reboot;
- offline/reconnect;
- exact notification sequence;
- active-session GPS departure/return tests;
- employee usability;
- manager visibility.

---

## 11. Preliminary findings requiring full audit

These are research observations, not final verdicts:

1. The Final Report v17 is a high-level walkthrough, not a complete specification.
2. Image-only report pages contain important behavior omitted from parsed text.
3. The current program exposes major manager domains not separately documented in the PDF.
4. The React role shell is explicitly a migration handoff and is not yet a finished permanent employee runtime.
5. The current employee build graph contains separate shell, legacy-page, protected-setup, and generated scan concepts that require one deliberate ownership model.
6. The original scan screen asked the employee to choose a name; the correct employee APK should use enrolled-device identity.
7. The original completion forms preserve valuable evidence but impose excessive all-at-once employee complexity.
8. The guest issue workflow is approval-gated and was described as optional Marketing-supported functionality.
9. Static schedule generation was intended to use `force: false`, but all generation/read paths still require an idempotency audit.
10. Multiple historical versions of `sch_employee_my_schedule_page` exist and must be reconciled with the deployed canonical function.
11. Later schedule SQL corrects early lunch-window behavior, but inheritance is implemented as a display-layer overlay rather than necessarily persisted ownership; the operational consequences must be audited.
12. The current scan GPS evaluator has useful accuracy, staleness, hysteresis, and motion checks.
13. The accepted Custodial Android permission policy currently does not include location permissions, so active-session GPS is not yet proven as a complete native Android capability.
14. The current GPS polling is tied to an active scan page and requires interruption, screen-off, WebView restoration, and permission-state validation.
15. Employee push infrastructure contains route and wording inherited from the old route model and must be aligned with current ownership language.
16. Existing test breadth is substantial, but test correctness and production-path fidelity remain unproven.

---

## 12. Gates before product code resumes

Product code may resume only when:

- the complete capability inventory is finished;
- the truth ledger covers all thirty domains;
- report claims and undocumented capabilities are classified;
- the deployed scheduler behavior is identified exactly;
- static versus exception scheduling is formally specified;
- employee lifecycle is specified;
- active-session GPS architecture is specified;
- one native/runtime ownership model is selected;
- the first architecture plan is self-audited;
- independent plan audits are reconciled;
- no unresolved BLOCKER/HIGH design contradiction remains.

---

## 13. Required final research deliverables

Before implementation:

1. complete capability truth ledger;
2. PDF-claim versus implementation matrix;
3. undocumented-capability inventory;
4. static and exception scheduler specification;
5. employee lifecycle specification;
6. active-session GPS specification;
7. Android runtime ownership diagram;
8. notification state machine;
9. scan/offline state machine;
10. Messenger state model;
11. role/security matrix;
12. test classification matrix;
13. physical-device acceptance matrix;
14. prioritized foundation architecture plan;
15. independent audit disposition.

No GO decision can be based solely on the report, source volume, or test count.
