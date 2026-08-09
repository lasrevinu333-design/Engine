# Custodial Employee App — Preliminary Multi-Model Audit Disposition

**Repository:** `lasrevinu333-design/Engine`  
**Branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Audit stage:** Preliminary architecture/prototype review  

## Verdict

The current branch is **NO-GO as an integrated prototype** and is not eligible for merge, Codemagic, installation, or Build 23 designation.

This is not a final-product rejection. It is the expected outcome of an early audit performed before the employee runtime became coherent.

## Preserved foundations

The following controls remain valid and must be preserved:

- package `org.memphiszoo.custodial`;
- Android-only Custodial edition;
- native-vault credential boundary;
- production signer policy;
- Build 22 rollback baseline;
- minimum next versionCode 23;
- anti-rollback controls;
- manager/viewer module separation;
- fail-closed Codemagic admission framework.

## Accepted BLOCKER findings

### 1. One coherent Home/build/navigation graph does not exist

The branch routes to `employee-home-simple.html`, the compatibility allowlist packages `employee-hub.html`, and the production Custodial build overwrites packaged `index.html` with the legacy native Assigned Areas/enrollment/QR page.

**Disposition:** accepted.

**Repair direction:**

- use `employee-hub.html` as the single canonical simple employee Home;
- delete `employee-home-simple.html` after content is consolidated;
- route every ordinary employee Back/Home destination to `employee-hub.html`;
- keep provisioning/recovery separate and manager-gated;
- remove normal employee access to QR, Refresh, enrollment removal, old bottom navigation, and Assigned Areas on Home;
- regenerate and verify the frontend manifest;
- add built-distribution route-target existence tests.

### 2. Ambient NFC is not persistent across ordinary employee pages

The React shell owns `appUrlOpen`, but the shell unloads when handing off to legacy pages. The shared Custodial bridge does not currently own the persistent native URL/NFC listener.

**Disposition:** accepted.

**Repair direction:**

- place native NFC/deep-link ownership in a layer that survives every employee page;
- prefer one permanent native Activity/plugin listener;
- otherwise inject the Capacitor App listener through the shared Custodial bridge on every employee page;
- reuse the existing strict route normalizer;
- test cold launch and warm scans from Home, Schedule, Messages, Events, Feedback, cleaning screens, lock state, wake, offline, and reconnect.

### 3. Packaged wake recovery targets the wrong file

The web runtime builds active-session wake URLs with `./index.html`, but the APK packages the cleaning runtime as `scan.html` and uses the old native screen as packaged `index.html`.

**Disposition:** accepted.

**Repair direction:**

- make `scan.html` the canonical native cleaning destination;
- centralize scan/wake route construction;
- remove packaged topology assumptions that `index.html` is the scan runtime;
- test timer, completion screen, form draft, and session restoration against the built distribution.

### 4. The required notification system is absent from the authoritative APK path

The native bridge marks native notifications authoritative, causing `memphis-device-reminders.js` to exit. The native path currently schedules ordinary Android notifications and does not implement the persistent overlay, durable queue, exact two-cycle chime/voice sequence, complete acknowledgement lifecycle, or all required categories.

**Disposition:** accepted.

**Repair direction:**

- implement one authoritative native notification coordinator;
- durable stable notification key and queue;
- one active persistent overlay;
- exact `chime -> voice -> chime -> identical voice -> silence`;
- no replay after foreground, wake, polling, page changes, or reconnect;
- explicit Open and Dismiss;
- displayed/opened/dismissed ledger;
- direct message, Memphis message, due-soon, overdue, 9:45, lunch start/end, inherited, transfer, and manager-reassignment categories;
- private message content is never spoken;
- remove or formally demote the parallel web reminder path.

### 5. Back navigation can expose the prohibited legacy screen

Several native employee Back paths route to packaged `index.html`, which is the old Assigned Areas/QR/Refresh/enrollment screen.

**Disposition:** accepted.

**Repair direction:** one canonical employee Home resolver used by Home, Schedule, Messages, Events, Feedback, wake-without-session, and Android hardware Back.

### 6. Current-ownership scheduling is incomplete and insufficiently proven

The employee page polls `/my-day-summary`, but the branch does not yet implement or prove all time-window transitions, event-driven refresh, effective lunch end-time display, schedule versions, shift-end inheritance, uncovered public-hour exceptions, or seasonal closing transitions.

**Disposition:** accepted as a failed release gate. This does not prove every backend rule is absent; it proves the integrated contract is not yet sufficient.

**Repair direction:**

- trace and preserve the original scheduler logic before inventing new allocation rules;
- define a versioned current-ownership response including server time, effective start/end, current, temporary, inherited, removed/transferred, uncovered exception, and next transition;
- add launch, foreground, reconnect, notification, version-change, and next-boundary refresh;
- deterministic tests at 9:44:59/9:45:00, lunch start/end, shift ends, final departure, current 5–6 PM uncovered hour, and September 14 seasonal boundary.

### 7. Temporary focused CI is contradictory and cannot prove a valid build

The current temporary workflow mutates source, contains contradictory old/new notification assertions, checks the wrong Home file, mistakes the offline queue for NFC coverage, and omits the production build/manifest/runtime gates.

**Disposition:** accepted.

**Repair direction:** commit product behavior directly, replace contradictory tests with one authoritative v23 suite, run real production build and built-distribution browser tests, then remove temporary carrier workflow/trigger/patch files.

### 8. Mandatory physical acceptance is absent

**Disposition:** accepted as a release-evidence blocker, not an early implementation defect.

No GO is possible until an admitted signed candidate passes the Moto G 2025/Fully Kiosk matrix on Karen's phone.

## Accepted HIGH findings

- Messenger can display prior-recipient messages beneath a newly selected recipient during loading.
- Messenger delete is header-based, confirm-driven, server-first, and not swipe-row/immediate.
- the simple Home resolves protected identity too early and can remain in a false failure state;
- native notification acknowledgement coverage is incomplete.

## Accepted MEDIUM/LOW findings

- employee-facing route wording conflicts with area ownership;
- long names and 200% text can crop the fixed Home because scrolling is disabled;
- technical backend/error language leaks to employees;
- performance targets are not measured;
- duplicate Home files create drift;
- temporary carrier infrastructure must be removed before final review.

## Product decisions established

### Canonical Home

`employee-hub.html` will become the sole simple employee Home. The duplicate prototype will be removed.

### Employee QR policy

No QR workflow or QR fallback exists anywhere in the ordinary employee app.

### Provisioning default

Use a hidden manager-gated provisioning/recovery state inside the same APK unless later evidence shows a separate provisioning tool is safer. Ordinary employees cannot see enrollment or removal controls.

### Conversation deletion

Employee Delete means immediate per-employee removal/hide from that employee's Messenger. Other participants retain their records. The backend endpoint and retention policy must be verified before implementation is declared complete.

### Operating hours

Seasonal and exceptional public hours come from the scheduler/backend policy source of truth, never from employee UI constants.

### Shift-end inheritance

Do not invent a new allocation algorithm until the original scheduler and existing backend rules are traced. Preserve geographic coherence first, then use configured backup/coverage rules and workload balancing where already defined.

## Repair order

1. One canonical Home, provisioning boundary, route graph, manifest, and built-target tests.
2. Permanent native NFC listener and canonical `scan.html` routing.
3. Packaged active-session wake/recovery.
4. Authoritative native notification coordinator.
5. Versioned current-ownership schedule contract and transitions.
6. Messenger recipient isolation and deletion interaction.
7. Employee-safe wording across scan, Schedule, Messages, Events, Feedback, and offline recovery.
8. Large-text, geometry, accessibility, and performance tests.
9. Remove temporary audit/build scaffolding and run the complete source/runtime/security suite.
10. Freeze, repeat Spark/5.5/5.6 Pro audits, then prepare Codemagic only after all blockers are cleared.

## Decision rule

No finding is marked fixed without:

- a repair commit;
- a regression test that exercises the actual runtime path;
- built-distribution proof where packaging matters;
- physical Moto G proof where Android/Fully behavior matters.
