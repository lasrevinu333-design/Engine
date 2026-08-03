# Memphis Zoo Custodial Employee App — Independent Audit Handoff

**Prepared:** 2026-08-02  
**Repository:** `lasrevinu333-design/Engine`  
**Audit branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Base/merge base:** `7bc61e39a5ae2fda52c777c8a222f138ee36c5af`  
**Accepted production baseline before redesign:** Custodial Build 22  
**Package:** `org.memphiszoo.custodial`  
**Target hardware:** Moto G 2025, Android 16, managed by Fully Kiosk 1.60.1  

---

## 1. Auditor mandate

Perform a genuinely independent, read-only audit. Do not accept this handoff's conclusions without checking the source. Do not modify the repository, trigger Codemagic, install an APK, change a phone, or alter backend data unless Eric explicitly authorizes it in the audit chat.

Audit the employee-only Android app redesign for:

1. fidelity to the real custodial operating model;
2. NFC correctness and interruption recovery;
3. current-ownership scheduling and coverage transfers;
4. notification cadence, persistence, deduplication, and wording;
5. employee usability for extremely low-technology users;
6. Messenger correctness and speed;
7. Android/Fully Kiosk containment;
8. offline and network-recovery behavior;
9. strict separation from manager applications;
10. preservation of the existing native security and release boundaries.

Report findings by severity: **BLOCKER, HIGH, MEDIUM, LOW**. For every finding, cite the exact file/function or test contract, explain the user impact, and recommend the smallest correct repair. Distinguish proven facts from inferences.

---

## 2. Product scope — employee app only

This branch is solely for the locked custodial employee phones.

It is **not** the future Ops Manager Full Access application and **not** the future Read-Only application.

Future products are separate:

- **Ops Manager Full Access:** private Android and iOS app with full authorized operations access.
- **Read Only:** private Android and iOS app with **Dashboard and Events only**.

The employee APK must not expose manager dashboards, analytics, inspections management, employee administration, device administration, enrollment removal, scheduling tools, manager-only Messenger controls, or backend/security administration.

---

## 3. Canonical operating model

The employee system is an **area-ownership and scan-verification system**, not a turn-by-turn task dispatcher.

Employees receive a set of locations they currently own. They choose a practical order based on geography, restroom priority, guest conditions, access, and work already underway. The phone must not create a mandatory route or tell them a software-selected current/next stop.

Authoritative source to read first:

- `docs/custodial-field-workflow-invariants.md`

Also inspect:

- `employee-schedule.html`
- `schedule-employee-day.html`
- `schedule.html`
- the relevant schedule tests under `scripts/`
- the preserved v17 program/report material if available in the connected file library

Public restrooms may be listed first, but that is display priority—not a forced walking order.

---

## 4. Employee home — fixed design decision

Use **Option A**: a simple stone-path launcher, no bottom navigation.

Home must contain only:

- `Memphis Zoo Custodial`
- the employee's name
- four large buttons centered down the stone path:
  1. Schedule
  2. Messages
  3. Events
  4. Feedback

Do not show on the employee home:

- kiosk ID;
- assigned areas;
- NFC instructions or NFC tag data;
- QR references or QR scanning;
- a permanent Refresh button;
- enrollment status;
- Remove Enrollment;
- device status;
- build/debug information;
- weather or attendance;
- duplicated navigation;
- manager or administrator controls.

Each secondary page uses a clear Back action to return home.

---

## 5. NFC — non-negotiable

There is no normal Scanner page and no QR workflow.

Required behavior:

1. NFC listening is ambient from the employee kiosk lock state and every ordinary employee screen.
2. A valid location tag immediately resolves the location.
3. The correct **Start Cleaning** screen opens.
4. The enrolled phone supplies employee identity.
5. The employee is not repeatedly asked to select a name.
6. The scan/session state machine records physical presence and location context.
7. Active cleaning work survives screen off, wake, backgrounding, WebView restoration, and temporary network loss.

Real-device acceptance must include scans from Home, Schedule, Messages, Events, Feedback, the kiosk lock state, after sleep/wake, after reboot, after a long idle period, offline, and during reconnection.

Current field report: on Build 22, an NFC scan merely vibrated and did not open or start the location workflow. Treat this as a release blocker until proven fixed on a Moto G 2025.

---

## 6. Schedule — live current ownership

The Schedule page shows what the employee owns **now**, not a static full-day itinerary.

### Morning

Before the 9:45 restroom rebalance, show only the employee's morning assigned areas.

### 9:45 restroom rebalance

At 9:45, when ownership actually changes:

- notify the employee;
- replace/update the active ownership list;
- preserve continuing non-restroom ownership;
- do not duplicate unchanged morning and afternoon lists.

### Lunch coverage

When lunch coverage starts:

- notify the employee;
- show a distinct temporary Lunch Coverage section below the active rebalance ownership;
- include the effective end time;
- remove it automatically when the window ends, normally one hour later;
- notify the employee that lunch coverage ended.

### Shift-end inheritance

When an employee clocks out or reaches scheduled shift end:

- every location they owned must transfer to one or more employees still working;
- receiving employees are notified;
- inherited locations are added to their live ownership display;
- those locations remain until another transfer or the recipient employee leaves.

Every location must have a responsible employee throughout every staffed coverage window until all employees have left for the day.

### Unstaffed gap

If the zoo is open but no eligible custodial employee remains, do not invent an owner. Surface a manager-facing uncovered/open-coverage exception.

Current example supplied by Eric:

- two employees remain from 3:00–5:00 PM;
- no custodial employee remains during the current 5:00–6:00 PM public hour;
- public closing changes from 6:00 PM to 5:00 PM on September 14;
- seasonal operating hours belong in scheduler policy, not hard-coded employee UI logic.

### Refresh behavior

No permanent employee Refresh button.

Synchronize automatically:

- app launch;
- page open;
- foreground return;
- network reconnection;
- notification receipt;
- assignment-window start/end;
- backend schedule-version change;
- bounded periodic safety poll.

Show `Try Again` only after a real failed update.

---

## 7. Voice and visual notification contract

This applies to:

- direct messages;
- Memphis messages;
- due-soon locations;
- overdue locations;
- 9:45 schedule changes;
- lunch coverage assigned;
- lunch coverage ended;
- inherited areas;
- areas removed/transferred;
- manager/emergency reassignment.

Exact audio cadence:

1. chime once;
2. speak the complete personalized announcement once;
3. chime once again;
4. speak the identical announcement once again;
5. stop all sound and speech.

No third repetition. No periodic replay while the overlay remains displayed. No replay after page changes, foregrounding, sleep/wake, polling, or reconnection.

The visual notification appears above whatever screen is open and remains until the employee chooses **Open** or **Dismiss**. Later alerts queue behind the active alert rather than stacking.

The system must record at least:

- displayed;
- opened;
- dismissed/acknowledged.

Deduplicate by a stable permanent notification key.

Preferred message wording example:

> `Tammy, you received a message from Alijah Collins.`

Other wording examples:

- `Tammy, your restroom assignments have changed.`
- `Tammy, lunch coverage has been assigned.`
- `Tammy, your lunch coverage has ended.`
- `Tammy, additional areas have been assigned to you.`
- `Tammy, Teton Restrooms is due soon.`
- `Tammy, Teton Restrooms is overdue. Please handle it now.`

Do not speak private message contents aloud.

Original web notification foundation:

- `memphis-device-reminders.js`
- `scripts/device-reminder-contract-tests.mjs`

At the branch start, the original implementation performed only one chime and one voice announcement even though repeat-related constants existed. The redesign must implement and test the exact two-cycle sequence.

---

## 8. Messenger requirements

The current physical-phone Messenger was reported as slow, visually cheap, and state-unsafe.

Required behavior:

- fast conversation list;
- professional, restrained presentation;
- tapping `New` opens recipient selection immediately;
- no redundant confirmation asking whether to create a new message;
- selecting Alijah must never display Memphis's or another person's prior thread while loading;
- render a clean recipient-specific loading state, then the correct thread;
- swipe left on the conversation row to reveal Delete;
- tapping Delete removes the conversation from the employee view immediately, with no redundant second confirmation;
- maintain correct backend retention/deletion semantics;
- message send produces immediate local visual feedback;
- avoid broken avatars, stale thread flashes, and unnecessary controls.

Inspect:

- `messages.html`
- `messages-chatscope.html`
- `thread.html`
- `mobile/src/chatscope/app.jsx`
- messaging incremental-sync and browser tests

---

## 9. Performance and usability targets

Primary user example: Karen has never owned a cellphone or computer and has difficulty using ordinary picture-based food kiosks. The interface must be designed for that reality.

Targets:

- home usable quickly after launch;
- visible tap feedback within approximately 100 ms;
- common employee task within three primary decisions;
- tab/page transition under approximately 500 ms where practical;
- conversation open under approximately one second on normal network;
- NFC scan to correct Start Cleaning screen under approximately one second after tag resolution where practical;
- no technical error language shown to ordinary employees;
- 48 dp minimum Android touch targets;
- no required drag-only action without an accessible alternative;
- zero lost offline cleaning submissions;
- zero wrong-recipient thread flashes;
- real-user field success target of at least 95 percent.

Prefer removal of UI and requests over ornamental optimization. Do not sacrifice speed for visual effects.

---

## 10. Native shell and security boundaries to preserve

The redesign should remain a thin Android shell around the fast employee web runtime, using native code only where it materially matters:

- NFC intent/foreground handling;
- notifications;
- device identity;
- secure credential/native vault;
- offline persistence/queue;
- wake/reboot recovery;
- Android permissions and lock-task containment.

Preserve:

- production package `org.memphiszoo.custodial`;
- accepted signer policy;
- native-vault boundary;
- Device Owner/Fully Kiosk containment;
- anti-rollback policy;
- Build 22 as the installed rollback baseline until a newer APK is independently admitted;
- backend/Supabase/coordinates/geofence/proximity behavior unless an independently proven defect requires an authorized change.

Do not merge employee design code into Manager or Viewer editions.

---

## 11. Current branch state at handoff creation

The branch was created from main commit `7bc61e39a5ae2fda52c777c8a222f138ee36c5af` and was seven commits ahead/two commits behind main when this document was prepared.

Current branch differences at that moment:

- `.github/workflows/custodial-simple-v23-branch-build.yml` — temporary branch build carrier;
- `employee-home-simple.html` — initial simple-home prototype;
- `employee-hub.html` — replaced with the simple employee launcher;
- `mobile/src/shell/roles/custodial/routes.ts` — routes revised toward the approved employee modules;
- `requests/custodial-simple-v23.trigger` — temporary branch trigger;
- `scripts/custodial-simple-v23-contract-tests.mjs` — focused contract scaffolding;
- `scripts/patch-custodial-simple-v23-reminders.py` — temporary patch helper for the two-cycle reminder change.

Important: at this handoff creation point, the branch copy of `memphis-device-reminders.js` still had the original one-cycle runtime. The patch helper existed, but the final reminder change had not yet been proven and committed on the branch. Do not treat the notification requirement as complete merely because the helper exists.

The branch also contains temporary workflow/trigger scaffolding that should be removed or consolidated before final review.

---

## 12. Required audit/test matrix

### Static and unit/contract audit

- employee-only route and asset allowlist;
- no manager/admin/enrollment removal exposure;
- no QR/scanner-page primary flow;
- exact two-cycle notification sequence;
- stable alert deduplication and queueing;
- direct-message wording personalization;
- due-soon and overdue wording;
- Schedule time-window ownership rendering;
- 9:45, lunch, shift-end inheritance, seasonal close, and unstaffed-gap logic;
- Messenger recipient/thread isolation;
- release-manifest/runtime graph correctness;
- native-vault and admission contracts;
- no weakening of CSP, credential boundaries, signer, or anti-rollback rules.

### Browser/UI tests at Moto G 2025 geometry

Use the actual 20:9 Moto G viewport and include:

- home with long employee name;
- large text/font scaling;
- soft keyboard open in Messenger;
- notification overlay on every major screen;
- queueing a second alert behind the first;
- Schedule transitions across time windows;
- offline and reconnect states;
- Back behavior from all four modules;
- no bottom navigation or duplicated controls.

### Real Moto G 2025 tests under Fully Kiosk

- install/upgrade preserves enrollment and native vault;
- Fully Single App/lock-task remains locked;
- Home/Recents blocked;
- reboot automatically returns to employee app;
- sleep/wake preserves active cleaning workflow;
- NFC from lock state and each screen;
- NFC after reboot, idle, offline, and reconnection;
- restroom and exhibit sessions submit correctly;
- offline queue synchronizes once, with no duplicate;
- exact two chimes and two identical voice announcements;
- no audio replay after the second voice;
- overlay remains until Open/Dismiss;
- due-soon, overdue, message, schedule, lunch, and inherited-area alerts all work;
- employee cannot reach enrollment removal or Android launcher.

### Release audit before Codemagic

- branch rebased or cleanly updated on final main;
- all temporary carrier workflows removed or intentionally retained;
- frontend release manifest regenerated and exact;
- versionCode exceeds the committed minimum floor;
- Codemagic workflow uses the existing production signer and fail-closed admission path;
- no APK is called accepted until independent producer/consumer admission passes;
- no fleet rollout before Karen's physical acceptance passes.

---

## 13. Required auditor deliverable

Provide:

1. executive verdict: **GO, CONDITIONAL GO, or NO-GO**;
2. severity-ranked findings with source references;
3. operational-model mismatches;
4. security/release-boundary findings;
5. missing or weak tests;
6. performance/usability risks;
7. specific recommended changes in execution order;
8. a concise regression checklist for the implementing chat;
9. unresolved questions that truly require Eric's decision.

Do not implement fixes during the independent audit unless Eric explicitly changes the assignment.

---

## 14. Copy-ready prompt for a second ChatGPT session

> You are the independent senior auditor for the Memphis Zoo Custodial employee Android app. Use the connected GitHub repository `lasrevinu333-design/Engine`. Audit branch `agent/custodial-moto-g-simple-v23-20260802` against main and against `docs/custodial-employee-app-independent-audit-handoff.md`. Read the actual source and tests; do not trust the handoff's conclusions without verification. This is a read-only audit: do not write code, trigger builds, install APKs, or change backend data. The product is employee-only, Android-only, tailored to Moto G 2025 under Fully Kiosk. Produce a GO/CONDITIONAL GO/NO-GO verdict, severity-ranked findings with exact file/function references, missing-test analysis, performance and low-tech-user usability findings, security/release-boundary findings, and a prioritized repair plan. Pay special attention to ambient NFC, live ownership scheduling including 9:45/lunch/shift-end inheritance/seasonal closing, exact chime→voice→chime→same voice notification behavior, persistent overlay/deduplication, Messenger thread isolation and speed, employee-only route restrictions, and preservation of the native vault/signer/anti-rollback/Codemagic admission boundaries.
