# Memphis Zoo Custodial System — Phase A Capability Inventory

**Status:** Read-only foundation research, pass 1  
**Prepared:** 2026-08-03  
**Frontend repository:** `lasrevinu333-design/Engine`  
**Frontend branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Product tree reviewed before this document:** `0312a8c415d7ee9698bdc6a1da0e32aca5acfc0c`  
**Backend repository:** `lasrevinu333-design/memphis-zoo-mcp`  
**Backend commit reviewed:** `0fff8c2cadea132902df22c99593f1ce348411a7`  
**Report reviewed:** `Memphis_Zoo_Custodial_System_Final_Report_v17_optional_marketing.pdf`  
**Accepted installed rollback baseline:** Custodial Build 22  
**Current activity:** inventory and truth reconstruction only; no product implementation

---

## 1. Purpose of this pass

This document is the first concrete inventory produced under `custodial-system-foundation-truth-audit-plan.md`.

It does not declare the system complete or defective as a whole. It records what has been located, what each component appears intended to do, what is actually wired, and what still lacks end-to-end or physical proof.

The inventory intentionally separates:

- report claims;
- original screen behavior;
- current frontend behavior;
- Android/native behavior;
- backend behavior;
- database behavior;
- tests;
- real-phone evidence;
- the correct target behavior.

The old program is treated as a strong working baseline, not an unquestionable specification. Existing features are retained when they serve the real custodial purpose. Existing defects, duplicate owners, obsolete interfaces, and unsupported claims are not preserved merely because they are old.

---

## 2. Classification vocabulary

| Status | Meaning |
|---|---|
| **PROVEN-SOURCE** | The implementation path is present and traced in source, but may still require runtime or phone proof. |
| **PARTIAL** | Important pieces exist, but the complete intended outcome is not proven. |
| **CONTRADICTORY** | Current implementation conflicts with a fixed product decision or another authoritative layer. |
| **MISSING** | The required capability or foundation has not been located. |
| **OBSOLETE** | The capability exists but should not remain in the target product in its current form. |
| **FUTURE** | Deliberately outside current release scope. |
| **PHYSICAL-ONLY** | Source cannot establish the result; Moto G/Fully Kiosk testing is required. |
| **INVENTORY-IN-PROGRESS** | The domain has not yet received complete route/database/test tracing. |

No item is marked fully complete from a source-string assertion alone.

---

## 3. Product surface inventory

### 3.1 Custodial employee Android product

Approved normal employee destinations:

1. Schedule
2. Messages
3. Events
4. Feedback

Ambient NFC is an action available throughout the product, not a fifth destination.

| Surface | Current principal files | Current purpose | Preliminary status |
|---|---|---|---|
| Home | `employee-hub.html` | Employee name and four large launcher buttons | PARTIAL — approved visible model exists; canonical runtime ownership remains unresolved |
| Schedule | `employee-schedule.html` | Current ownership, lunch, added areas, schedule-change detection | PARTIAL |
| Messages | `messages.html`, `mobile/src/chatscope/app.jsx`, generated `chatscope-messenger.js/css` | Employee direct messaging and Memphis thread | PARTIAL |
| Events | `employee-events.html` | Upcoming event notices | PARTIAL |
| Feedback | `employee-feedback.html` | Employee feedback submission | CONTRADICTORY — categories and data authority do not yet match intended operational use |
| Cleaning workflow | repository `index.html`, packaged as `scan.html` | NFC-resolved Start Cleaning, timer, completion, offline/GPS evidence | PARTIAL / PHYSICAL-ONLY |
| Protected setup | `mobile/src/custodial/index.html`, `mobile/src/custodial/app.js` | Manager-assisted enrollment/recovery | PARTIAL |
| Native bridge | `mobile/src/custodial/bridge.js` | Native vault, authenticated transport, NFC link routing, notification installation | PARTIAL |
| Native notification coordinator | `mobile/src/custodial/notification-coordinator.js` | Persistent overlay, queue, wording, two-cycle audio | PROVEN-SOURCE / PHYSICAL-ONLY |
| Role shell | `mobile/src/shell/**`, Custodial route definition | Migration shell and legacy handoff | OBSOLETE AS FINAL RUNTIME — useful migration scaffolding, not a finished employee product |

### 3.2 Ops Manager Full Access product

Current manager surfaces discovered:

- Today / Ops Manager Hub
- Messenger
- Schedule and staffing
- Operations Dashboard
- Events display
- Event input
- Guest issues
- Insights and inspections
- Feedback triage
- Notification settings/testing
- Employee phone assignments
- Manager access enrollment
- Device security/revocation
- Moxie
- diagnostics / controlled repair console
- weather and attendance summary

Principal frontend evidence:

- `ops-manager-hub.html`
- `ops-hub.js`
- `dashboard.html`
- `schedule-simple.html`
- `schedule.html`
- `messages.html`
- `events.html`
- `events-admin.html`
- `guest-issues.html`
- `operational-insights.html/js/css`
- `system-feedback.html`
- `notifications.html`
- `phone-assignments.html/js/css`
- `manager-access.html`
- `device-security.html`
- `gemini-admin.html`
- `mobile/src/shell/roles/manager/routes.ts`

Preliminary status: **PARTIAL**. The breadth is substantially greater than the Final Report v17. Each manager capability still requires authorization, runtime, database, and action-outcome tracing.

### 3.3 Read Only product

Fixed target:

- Dashboard
- Events
- nothing else

Current implementation conflict:

- `mobile/src/shell/roles/viewer/routes.ts` includes Dashboard, Events, and Feedback.
- `mobile/src/viewer/index.html` includes Dashboard, Events, and Feedback.
- current wording describes a public operations overview rather than the future private Read Only application.

Preliminary status: **CONTRADICTORY**.

### 3.4 Public and contractor surfaces

| Surface | Purpose | Preliminary status |
|---|---|---|
| Guest cleanliness report / QR | Location-bound guest cleanliness reporting | PARTIAL, approval-gated, optional Marketing-supported capability |
| Marketing review queue | Approval before guest issue enters operations | PROVEN-SOURCE |
| Public guest issue status/landing | Guest-facing intake and limited status | PARTIAL |
| CoverAll secure assignment page | Expiring, limited contractor schedule view | PROVEN-SOURCE / requires live security proof |
| MCP endpoint | Connected ChatGPT operational tool access | PROVEN-SOURCE / authority audit pending |
| Legacy SSE MCP | Token-protected compatibility transport | PROVEN-SOURCE |

Guest QR support does not authorize QR scanning inside the employee APK. They are separate product surfaces.

---

## 4. Current Android and runtime inventory

### 4.1 Custodial Android identity

- Package: `org.memphiszoo.custodial`
- Android only for Custodial
- Accepted rollback baseline: Build 22
- Minimum next release versionCode: 23
- Production signer and anti-rollback protections already exist and must remain unchanged unless separately authorized
- Target device: Moto G 2025 under Fully Kiosk / Device Owner containment

### 4.2 Current included Custodial plugins

From `mobile/capacitor.config.ts` and `mobile/package.json`:

- first-party Custodial native vault
- Firebase Messaging
- Capacitor App
- Local Notifications
- Network
- Status Bar

Not currently present:

- a native geolocation/fused-location plugin
- a dedicated native active-session location service

### 4.3 Current start and handoff model

Current packaged runtime contains multiple conceptual owners:

1. `app-shell.html` as Capacitor start path;
2. React role shell;
3. legacy employee pages;
4. protected setup `index.html` / `start_page1.html`;
5. repository root `index.html` copied as `scan.html`;
6. native bridge listeners installed inside injected employee pages.

This architecture can work as a migration seam, but it is not yet one deliberate permanent runtime. The final architecture must define one persistent owner for:

- app lifecycle;
- NFC link intake;
- notification intake and overlay;
- active-session restoration;
- protected identity;
- foreground/background location monitoring;
- navigation and Back behavior.

### 4.4 Custodial distribution boundary

`mobile/scripts/build.mjs` currently:

- selects a Custodial compatibility allowlist;
- excludes known manager pages;
- copies the root scan runtime to packaged `scan.html`;
- bundles the native Custodial bridge;
- injects native scripts into packaged employee HTML;
- copies protected setup as `index.html` and `start_page1.html`;
- builds the React role shell;
- generates build and runtime-asset identities.

This is a strong fail-closed packaging foundation, but it currently packages a hybrid migration graph rather than one final employee runtime.

---

## 5. Backend module and contract inventory

Backend commit reviewed: `0fff8c2cadea132902df22c99593f1ce348411a7`.

| Domain | Principal source | Contract / role |
|---|---|---|
| Scan and session RPC | `src/index.js` scan allowlist and `/scan-api/rpc` | `scan.v2` |
| Scheduling | `src/schedule-api.js` | `schedule.v2` |
| Messenger | `src/messaging-api.js` | `messaging.v5` |
| Events | `src/events-api.js` | `events.v3` |
| Employee push | `src/employee-notifications.js` | `employee-native-push.v2` |
| Manager notifications | `src/manager-notifications.js` | manager alert control |
| Employee/phone administration | `src/custodial-employee-admin.js` | employee, phone, enrollment lifecycle |
| Operational analytics and inspections | `src/operational-analytics-api.js` | `operational-analytics.v1` |
| Guest reporting | `src/index.js`, `public-submission-controls.js` | `guest-reports.v2.approval-gated` |
| Product/system feedback | `src/index.js`, `public-submission-controls.js` | `feedback.v2.json-triage` |
| Shared manager access | `src/auth/shared-access-auth.js` | named manager access |
| Device credentials | `src/auth/device-credential-auth.js` | employee device authority |
| Moxie | `src/routes/moxie.js`, bootstrap modules | private operations workspace |
| Gemini console / controlled worker | `src/gemini-console-api.js`, `src/gemini-controlled-worker.js` | diagnostics and controlled repairs |
| MCP | `src/mcp/**`, `/mcp`, legacy `/sse` | connected AI tool access |
| Attendance | `src/index.js`, `attendance-state.js` | current/planned attendance feed |
| Backup/restore | scripts invoked by backend `package.json` | disaster recovery and schema verification |

### 5.1 Scan RPC allowlist located

- system settings
- active employee list
- location scan state
- session start v1/v2 compatibility
- finish
- completion
- ping
- scan event recording
- atomic cleaning workflow commit
- device sync health
- GPS proximity v1/v2

Employee identity is canonicalized from the authenticated device for session start and completion.

### 5.2 API and worker framework located

- event maintenance sweep
- durable operational notification worker
- employee FCM delivery worker
- feedback reminder sweep currently dashboard-only
- attendance cache and fallback fetch
- guest Marketing review gate
- public submission rate limiting
- graceful shutdown and worker drainage

---

## 6. Queue, retry, and durable-state inventory

| Queue/state | Current owner | Purpose | Preliminary status |
|---|---|---|---|
| Scan action queue | `memphis-scan-sync.js`, IndexedDB generations | Offline session, completion, GPS and sync actions | PARTIAL; exactly-once and poison handling audit pending |
| Local scan/session state | scan runtime + protected mutation wrapper | Active workflow and form recovery | PARTIAL |
| Messenger outbox | ChatScope/local storage protected mutation | Offline message sending | PARTIAL |
| Native employee alert queue | notification coordinator local storage | Serialized persistent overlay alerts | PARTIAL; not yet native-vault durable and acknowledgement retry is unproven |
| Operational notification jobs | backend database worker | Durable FCM/event/guest delivery | PROVEN-SOURCE |
| Event push instances | backend database | Scheduled event reminders and open state | PROVEN-SOURCE |
| Employee push registrations | backend database | Assignment-epoch-bound FCM tokens | PROVEN-SOURCE |
| Feedback items | backend database | Dashboard triage and status | PROVEN-SOURCE |
| Guest reports | backend database | Marketing review, operations dispatch, closure | PROVEN-SOURCE |
| Gemini console outbox | backend/frontend diagnostics layer | Controlled console work | INVENTORY-IN-PROGRESS |

Important open question: the native alert coordinator marks an alert seen and removes it before acknowledgement success is guaranteed. A network failure can therefore lose the displayed/opened/dismissed acknowledgement unless another durable layer handles it. No such retry path has yet been proven.

---

## 7. Database and migration capability inventory

### 7.1 Scheduling objects located

- weekly employee shift templates
- daily work roster
- static employee/group ownership mappings
- daily schedule assignments
- planned time off / absence rows
- close-time policy
- schedule automation run state
- schedule preview and publish tables
- input hashes for SCH2 previews
- manual locks
- publish audit and rollback data
- location groups, memberships, zones, adjacency and proximity scoring
- coverage candidate scoring
- lunch coverage
- 9:45 restroom rebalance
- current employee schedule page functions
- open coverage and hard-rule audit functions

Multiple historical definitions of `sch_employee_my_schedule_page` exist. The deployed canonical definition must be identified from production schema identity before any new scheduler architecture is approved.

### 7.2 Cleaning and GPS objects located

- sessions and completion responses
- scan events
- device sync health
- location proximity settings
- location-group proximity settings
- current device/location proximity status
- GPS observation age, accuracy and motion hardening
- `evaluate_location_proximity_v2`
- idempotent client event IDs

### 7.3 Employee and phone lifecycle objects located

- employee records with active state
- devices and canonical aliases
- employee-to-device assignment
- assignment epochs
- Messenger user/device mapping
- device credential registration and revocation
- phone-assignment history
- employee status history
- manager-attributed changes

### 7.4 Analytics, issue and inspection objects located

- cleaning session facts
- cleaning performance comparisons
- maintenance ticket trends
- inspection records
- inspection scores and findings
- recurring issue data
- guest report history
- feedback items and attachments
- retention and cleanup policies

Full table/RLS/trigger inventory remains in progress.

---

## 8. Final Report v17 claim matrix — first pass

| Report capability | What source supports | Preliminary truth status |
|---|---|---|
| Inspection readiness | Dashboard, sessions, completion details and inspection records exist | PARTIAL — exact ready/not-ready rules need trace |
| NFC proof of presence | Scan/session state and timestamped events exist | PARTIAL / PHYSICAL-ONLY — Build 22 field report was vibration without workflow opening |
| Dashboard status and history | Dashboard and analytics sources exist | PARTIAL — data freshness and full correctness not yet proven |
| PTO redistribution | Absence preview/publish and regeneration paths exist | PARTIAL — minimal-change and idempotency need audit |
| Lunch ownership transfer | Lunch coverage functions and display sections exist | PARTIAL — exact start/end/persistence/notification path needs audit |
| Post-opening restroom rebalance | Route-fit/load-balancing implementation exists | PARTIAL — static-owner preservation and repeated-run stability need audit |
| Varied start/end coverage | Current-schedule and inheritance SQL exists | PARTIAL — inheritance is at least partly display-layer rather than persisted ownership |
| Completion forms | Distinct restroom and exhibit evidence sets exist | PROVEN-SOURCE / usability redesign required |
| Events as planning triggers | Event input, parsing, reference data and reminders exist | PARTIAL — direct schedule/staffing consequence needs trace |
| Direct/group/broadcast communication | Messenger backend and manager UI support these modes | PARTIAL — employee UI is direct-focused; performance/state safety need proof |
| Memphis AI answers from connected data | AI modules and MCP/tool access exist | PARTIAL — authority, freshness, hallucination and write safety audit pending |
| Guest cleanliness reporting | Feature-gated QR intake and Marketing review exist | PARTIAL / OPTIONAL |
| Maintenance and supply pattern tracking | ticket trends and issue history exist | PARTIAL — supply-specific capture and actionable manager workflow need trace |
| Coaching and staffing insight | analytics and inspection comparison endpoints exist | PARTIAL — interpretation limits and UI correctness need audit |

The report does not establish that every claim was fully operational in the locked build. Each claim remains subject to end-to-end proof.

---

## 9. Implemented capabilities omitted or understated by the report

The following substantial capabilities are present in source but are not fully described in Final Report v17:

1. named manager identities and trusted-device enrollment;
2. manager access recovery and revocation;
3. employee phone assignment, movement and assignment history;
4. employee active/inactive lifecycle;
5. assignment-epoch-bound employee push registration;
6. native credential vault and signer-bound release admission;
7. anti-rollback and accepted fleet baseline management;
8. operational inspections with scored rubrics and findings;
9. employee/location performance comparisons;
10. secure expiring CoverAll assignment links;
11. CoverAll English/Spanish limited views;
12. attendance source, cache and freshness state;
13. system feedback triage, private image storage and status;
14. Marketing approval queue for guest cleanliness reports;
15. event maintenance and scheduled reminder workers;
16. Moxie private workspace;
17. Gemini diagnostic/controlled repair console;
18. MCP tool access for connected ChatGPT sessions;
19. production backup, restore verification and empty-database rebuild;
20. schema fingerprint and transition controls;
21. exact runtime asset manifests and APK provenance admission;
22. device sync-health reporting and queue dead-letter concepts;
23. GPS stale/future/accuracy/hysteresis/motion checks.

Each must be retained, revised, separated, or retired based on operational purpose—not merely because it exists.

---

## 10. Preliminary capability truth ledger

This ledger is not the final thirty-domain verdict. It records the first source-backed state and the principal unresolved question.

| ID | Domain | Preliminary status | First source-backed conclusion | Main unresolved question |
|---|---|---|---|---|
| C01 | Product and role separation | PARTIAL / CONTRADICTORY | Separate package/build concepts exist | Why does Viewer still include Feedback and public framing? |
| C02 | Employee Home/navigation | PARTIAL | Approved four-button Home exists | Which runtime permanently owns Home, Back, NFC and alerts? |
| C03 | Device identity/enrollment | PARTIAL | Strong native-vault and backend lifecycle exists | Is manager recovery invisible to employees and physically robust? |
| C04 | Static schedules/versioning | PARTIAL / MISSING FOUNDATION | Static templates and mappings exist | Where is approved static schedule version/effective-date import/rollback? |
| C05 | Daily schedule generation | PARTIAL | Normal generation can use `force: false` | Is unchanged-input identity enforced across every caller? |
| C06 | Exception scheduling | PARTIAL | PTO, CoverAll, lunch, rebalance and inheritance code exists | Does it move only the minimum necessary static work? |
| C07 | Current-ownership Schedule | PARTIAL | Current/lunch/added sections and boundary refresh exist | Is backend response canonical and are changes pushed from any screen? |
| C08 | NFC/native routing | PARTIAL / PHYSICAL-ONLY | Native link routing and `scan.html` target exist | Does every real NFC state open the correct location on Moto G? |
| C09 | Cleaning session state machine | PARTIAL | Idempotent start/finish/completion contracts exist | Are all process-death, wrong-location and wake paths coherent? |
| C10 | Restroom/exhibit evidence | PROVEN-SOURCE / PARTIAL UX | Distinct evidence sets exist | How can required evidence remain while employee burden is minimized? |
| C11 | Offline/synchronization | PARTIAL | Durable scan and Messenger queues exist | Is every mutation exactly once across reboot, poison and reconnection? |
| C12 | Active-session GPS | PARTIAL / MISSING NATIVE FOUNDATION | Strong evaluator exists | How will Android permissions/service ownership survive screen off? |
| C13 | Employee notifications | PARTIAL | Native two-cycle overlay coordinator exists | Where are global schedule/lunch/inheritance jobs and durable ack retry? |
| C14 | Messenger | PARTIAL | Direct/group/broadcast backend and employee direct picker exist | Are speed, thread isolation, hide/delete and offline behavior correct? |
| C15 | Events | PARTIAL | Input, parsing, display, reminders and maintenance exist | Which events are employee-relevant and how do they change planning? |
| C16 | Guest cleanliness | PARTIAL / OPTIONAL | Approval-gated workflow exists | Is Marketing approval complete and what is the employee relationship? |
| C17 | Dashboard/inspection readiness | PARTIAL | Broad live status UI and APIs exist | What exact rule makes a location inspection-ready? |
| C18 | Inspections/analytics | PARTIAL | Inspection and comparison APIs exist | Are metrics fair, current, retained and interpreted safely? |
| C19 | Maintenance/supplies/tickets | PARTIAL | Tickets and trend analytics exist | Are supplies and operational reports captured through the correct employee path? |
| C20 | Attendance | PROVEN-SOURCE / INFORMATIONAL | Manager Hub displays cached attendance | Is it intentionally informational only? |
| C21 | Employee/phone administration | PARTIAL | Add/status/assign/release/history paths exist | Is full onboarding from new employee to static schedule and phone coherent? |
| C22 | Memphis AI/Moxie/diagnostics | INVENTORY-IN-PROGRESS | Broad connected operational capabilities exist | Which actions are product features versus privileged diagnostics? |
| C23 | Feedback | CONTRADICTORY | Employee product-feedback form and dashboard triage exist | Where should maintenance, supplies and app feedback be separated? |
| C24 | Manager access/device security | PARTIAL | Named roles, trusted devices, vaults and revocation exist | Do all manager surfaces enforce the same authority? |
| C25 | CoverAll | PARTIAL | Secure slot and link workflows exist | Is repeated publication stable and minimally disruptive? |
| C26 | Viewer/Read Only | CONTRADICTORY | Current Viewer includes Feedback | Rebuild as private Dashboard + Events only. |
| C27 | Backup/restore/schema | PARTIAL | Scripts and schema controls exist | Has a current production restore drill passed against exact schema? |
| C28 | Build/release/admission | STRONG FOUNDATION / CURRENT BUILD UNADMITTED | Build 22 is accepted with signer/provenance controls | Can the final redesigned runtime pass the same fail-closed chain? |
| C29 | Fully Kiosk/physical containment | PHYSICAL-ONLY | Device Owner/Fully configuration exists operationally | Does the final APK preserve lock, reboot, wake and permission policy? |
| C30 | Performance/accessibility/Karen usability | PARTIAL / CURRENT NO-GO | Simpler pages are being designed | Can Karen complete every task without explanation or waiting? |

---

## 11. Confirmed architecture contradictions and gaps

These are evidence-backed foundation findings. They are not repairs and do not authorize code changes yet.

### BLOCKER-A — No single permanent employee runtime owner

The current package combines a React migration shell, legacy pages, protected setup, injected bridge code and a separate scan page. This creates multiple lifecycle and navigation owners.

Correct target: one persistent Android/web runtime coordinator with explicit module boundaries.

### BLOCKER-B — Real NFC behavior remains unproven

Source routing exists, but the accepted Build 22 field observation was a vibration with no session workflow. No future release can be accepted without the complete Moto G NFC matrix.

### BLOCKER-C — Active-session GPS is not an admitted Android capability

The evaluator and backend exist, but the accepted Android manifest policy contains no location permissions and the current implementation polls browser geolocation only while the scan page is active.

Correct target: location monitoring begins with an active session, survives required interruptions, confirms sustained departure/return, then stops when the session ends.

### HIGH-A — Schedule change alerts are not globally produced

`employee-schedule.html` detects schedule changes by comparing snapshots while that page loads or refreshes. That does not notify an employee who remains on Home, Messages, Events, Feedback or an active session unless another backend/native path generates the alert.

Backend employee push currently proves event, message, due-soon and overdue kinds, but not the required schedule/lunch/inheritance/transferred-area kinds.

### HIGH-B — Static schedule version management is not proven

Static templates and daily generation exist, and SCH2 preview has an input hash. A complete approved static-schedule import, version, effective date, comparison, publish and rollback lifecycle has not been located.

### HIGH-C — Shift-end inheritance may be display-only

Later `sch_employee_my_schedule_page` SQL computes carry-forward ownership dynamically for display while preserving daily assignments as the planned source of truth. This can show the right employee list without creating one authoritative persisted ownership record for alerts, dashboard routing, guest issues and analytics.

The final architecture must decide whether inheritance is persisted or represented by one canonical effective-ownership projection used everywhere.

### HIGH-D — Read Only product violates fixed scope

Current Viewer includes Feedback. The approved Read Only product is Dashboard and Events only.

### HIGH-E — Employee Feedback is the wrong operational model

Current employee choices are:

- Something is broken
- I need help
- The app confused me

The required employee reporting model also needs maintenance and supply reporting. Current submission is sent to a public feedback endpoint with employee/device names in request data rather than a clearly device-bound operational report contract.

### HIGH-F — Notification acknowledgement durability is unproven

The native coordinator removes/marks an alert seen even if displayed/opened/dismissed acknowledgement fails. A durable offline acknowledgement queue has not been traced.

### MEDIUM-A — Employee Events may be overbroad

The employee page reads the general dashboard event feed and displays upcoming rows. Employee relevance, assignment impact, privacy and operational instructions are not yet enforced by one explicit employee event contract.

### MEDIUM-B — Legacy reminder wording conflicts with ownership model

The original reminder client still uses “assigned route” and “on your route.” The current operating model is owned areas, not a system-dictated route.

### MEDIUM-C — Legacy and new Schedule renderers coexist

`employee-schedule.html` contains older group/segment renderer functions and newer current-ownership section functions. Even if some are dead, they create maintenance ambiguity and increase the chance that tests validate the wrong rendering path.

### MEDIUM-D — Original completion screens are operationally rich but cognitively dense

The detailed service and issue lists are valuable evidence. The old all-at-once presentation is not suitable for employees with extremely low technology experience. Evidence and employee interaction must be separated through progressive disclosure, not wholesale field deletion.

---

## 12. Test and release inventory — first pass

### 12.1 Frontend/Android test families located

- role shell and route normalization
- mobile contracts
- native Custodial navigation
- native vault/storage firewall/reconciliation
- generated Android app tests
- Capacitor runtime policy
- Android toolchain policy
- Codemagic admission and bootstrap
- release manifest and runtime asset identity
- Messenger incremental/browser tests
- scan queue concurrency
- phone wake recovery
- events browser tests
- operational insights tests
- accessibility baseline
- employee notification contracts
- Custodial redesign-specific source contracts

### 12.2 Backend test families located

- schedule AI and schedule display
- scheduler overhaul and SCH2 publish
- route/proximity restroom rebalance
- events parser/API/integrity
- messaging regression/recovery/incremental/authority
- employee and manager notifications
- device credentials and enrollment security
- employee phone database/admin authorization
- operational analytics and database tests
- inspection readiness
- guest/feedback/Coverall security
- schema fingerprint, transitions and empty database rebuild
- production runtime and database identity
- backup/restore and restore drill

### 12.3 Test-audit warning

The system has extensive test volume. That is useful but not dispositive. Existing failures already demonstrated that tests can encode obsolete requirements, source-string assumptions or migration scaffolding. Every test must be mapped to a current capability and production path before it can be treated as release evidence.

---

## 13. Physical evidence still required

No source audit can replace these tests on Karen’s Moto G 2025 under Fully Kiosk:

- ambient NFC from every employee screen and kiosk lock state;
- NFC after sleep, wake, reboot, idle, offline and reconnect;
- correct employee identity without name selection;
- restroom and exhibit completion;
- active timer and unfinished form restoration;
- active-session GPS inside, uncertain, sustained outside, confirmed outside and returned states;
- screen-off GPS continuation if required by final policy;
- exact two chimes and two identical spoken announcements;
- no third/replayed announcement;
- overlay queue and Open/Dismiss behavior;
- notification arrival while each major screen is open;
- schedule 9:45, lunch, inheritance and transfer transitions;
- Messenger wrong-recipient prevention and speed;
- Fully Home/Recents/launcher containment;
- reboot relaunch;
- offline queue exactly-once synchronization;
- Karen task completion without coaching.

---

## 14. Remaining Phase A inventory work

The next research pass must complete:

1. exact backend route inventory with authorization for each route;
2. exact MCP tool inventory and read/write authority;
3. deployed production schema/function identity, especially current schedule functions;
4. table, trigger, RLS and retention inventory;
5. complete scheduler writer/caller graph, including every `p_force: true` path;
6. exact static-template edit/import process;
7. event-to-schedule and event-to-notification consequence tracing;
8. Messenger thread, delete/hide, retention and outbox state machine;
9. dashboard inspection-ready calculation;
10. ticket and supply-report creation paths;
11. manager notification settings and employee notification job generation;
12. Fully Kiosk configuration evidence and phone permission state;
13. test-by-capability classification;
14. live/backend deployment alignment and production schema fingerprint;
15. report-claim versus actual-runtime matrix with final status for every claim.

---

## 15. Research gate

No product implementation resumes from this inventory alone.

The next allowable progression is:

```text
Complete inventory
→ build full truth ledger
→ reconstruct exact requirements
→ design one foundation architecture
→ self-audit plan
→ independent audits
→ revise until no BLOCKER/HIGH contradiction remains
→ implement coherent subsystems directly
```

This document changes no product behavior, database, workflow, build, APK or phone.
