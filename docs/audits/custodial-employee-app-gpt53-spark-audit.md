# Custodial Employee App — GPT-5.3 Spark Mechanical Audit

**Repository:** `lasrevinu333-design/Engine`  
**Branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Mode:** Read-only, adversarial, implementation-focused  
**Primary handoff:** `docs/custodial-employee-app-independent-audit-handoff.md`

## Purpose

This is the third-party mechanical audit. It is intentionally narrower than the architecture/release audit. Do not redesign the product unless a proven implementation defect makes the current requirement impossible.

Assume that:

- requirements may have been implemented incompletely;
- tests may pass without proving the user-visible behavior they claim;
- stale legacy code may still be reachable;
- generated/runtime assets may differ from reviewed source;
- race conditions and state leakage may exist even where happy-path tests pass.

Produce evidence-backed findings only.

## Required first steps

1. Read `docs/custodial-employee-app-independent-audit-handoff.md`.
2. Record the exact branch commit being audited.
3. Compare the branch against its current merge base with `main`.
4. List every changed file before judging the implementation.
5. Read the actual source and tests; do not rely on commit messages or prior audit conclusions.

Do not read another auditor's report before completing your first report.

## Primary assignment

Inspect every changed file and every directly affected test for mechanical defects, incomplete wiring, stale references, contradictions, race conditions, untested branches, and build omissions.

### 1. Employee-only boundary

Verify that the Custodial runtime cannot expose or navigate to:

- manager dashboards;
- analytics or inspections management;
- employee/device administration;
- enrollment removal;
- manager schedule editing;
- backend/security administration;
- Android launcher or other applications.

Search source, route definitions, generated runtime allowlists, fallback links, error pages, Back handlers, deep links, notification targets, and stale HTML assets.

### 2. Simple home contract

Prove that the production Custodial home contains only:

- Memphis Zoo Custodial;
- employee name;
- Schedule;
- Messages;
- Events;
- Feedback.

Flag any reachable or visible kiosk ID, QR text, NFC instructions, refresh control, enrollment/device status, weather, attendance, build stamp, duplicate navigation, bottom navigation, or admin control.

### 3. NFC plumbing

Trace the complete path from Android NFC intent/tag discovery through the native bridge and WebView to the resolved location and Start Cleaning screen.

Check for:

- intent filters that only vibrate without routing;
- handlers registered too late or only on one page;
- foreground dispatch/state restoration gaps;
- lost payloads during app launch, sleep/wake, or WebView recreation;
- duplicate event delivery;
- stale device/employee identity;
- unsupported QR/manual fallback accidentally becoming primary;
- scan/session state not preserved across interruption;
- untested branches.

Do not claim NFC works from static inspection alone. Identify what still requires Moto G 2025 proof.

### 4. Exact notification sequence

Verify executable behavior—not constants alone—for:

`chime -> voice -> chime -> identical voice -> silence`

Check:

- exactly two chimes;
- exactly two speech calls;
- identical normalized spoken text both times;
- no third repeat;
- no replay on polling, reconnect, page navigation, foreground, sleep/wake, or reboot;
- overlay remains until Open or Dismiss;
- later alerts queue rather than stack or overwrite;
- stable deduplication key;
- displayed/opened/dismissed acknowledgements;
- message text does not read private body contents aloud;
- direct-message wording uses `Employee, you received a message from Sender.`;
- due-soon and overdue use the same cadence.

Look for timer races, cancelled speech, overlapping ringtone fallbacks, stale sequence tokens, duplicate native/browser notification paths, and tests that only grep source text.

### 5. Schedule ownership mechanics

Trace active schedule rendering and change detection for:

- morning ownership;
- 9:45 restroom rebalance;
- lunch coverage start/end;
- shift-end inheritance;
- additional late coverage;
- employee departure;
- seasonal public closing time;
- no-employee/uncovered gap;
- manager reassignment;
- network reconnect and stale cache.

Flag any code that:

- displays a static full-day itinerary instead of current ownership;
- loses continuing non-restroom assignments at 9:45;
- duplicates unchanged lists;
- fails to remove ended lunch coverage;
- assigns locations to employees after they leave;
- invents an owner during an unstaffed gap;
- hard-codes September 14 in employee UI instead of scheduler policy;
- requires a permanent Refresh button;
- fails to preserve completed work or active sessions.

### 6. Messenger mechanics

Inspect list, picker, thread loading, sending, deletion, caching, and navigation.

Find:

- stale thread content shown while another recipient loads;
- state keyed by previous thread or recipient;
- redundant New confirmation;
- delayed/absent optimistic send feedback;
- duplicate or stale requests;
- conversation deletion that does not immediately update local UI;
- swipe-only behavior with no accessible alternative;
- broken avatar fallback;
- heavy imports or requests that block first render;
- race conditions between incremental sync and active thread selection;
- tests that do not prove wrong-thread flashes are impossible.

### 7. Runtime/build graph

Verify that reviewed source reaches the Custodial APK runtime.

Inspect:

- Custodial compatibility asset allowlist;
- route targets;
- generated mobile runtime;
- frontend release manifest;
- service worker/cache references if present;
- native bridge injection;
- Capacitor configuration;
- Android manifest and package identity;
- versionCode floor;
- Codemagic path and release admission;
- temporary workflows/helpers/triggers that must be removed.

Flag source files that are changed but not packaged, packaged stale files, generated bundles not refreshed, or tests aimed at non-production fixtures.

### 8. Offline/recovery correctness

Inspect active cleaning and pending submission state through:

- screen off/wake;
- background/foreground;
- WebView recreation;
- process restart where supported;
- temporary network loss;
- queued submission replay;
- duplicate prevention.

Look for retry amplification, stale session identifiers, transient/permanent error misclassification, and local state cleared too early.

## Test-quality audit

For every important requirement, classify current proof as one of:

- **Static only**
- **Unit/contract**
- **Browser integration**
- **Android instrumentation/emulator**
- **Real Moto G 2025 required**

Flag tests that:

- merely grep strings;
- assert constants without running sequence behavior;
- mock away the failure mode;
- use the wrong route/runtime asset;
- omit negative cases;
- pass without verifying the final visible state;
- do not exercise repeated polling/reconnect/race conditions.

## Output format

Return:

1. **Verdict:** GO, CONDITIONAL GO, or NO-GO.
2. **Exact commit audited.**
3. **Changed-file inventory.**
4. Findings grouped as **BLOCKER / HIGH / MEDIUM / LOW**.
5. For each finding:
   - exact file and function/section;
   - proof;
   - user or release impact;
   - smallest correct repair;
   - missing regression test.
6. **False-confidence tests:** tests that pass but do not prove their named requirement.
7. **Unverified physical-phone requirements.**
8. **Prioritized repair order.**

Do not modify code. Do not trigger Codemagic. Do not install an APK. Do not repeat another auditor's conclusions without independent proof.

## Copy-ready prompt

> Independently perform the GPT-5.3 Spark mechanical audit of `lasrevinu333-design/Engine`, branch `agent/custodial-moto-g-simple-v23-20260802`. Read `docs/audits/custodial-employee-app-gpt53-spark-audit.md` and `docs/custodial-employee-app-independent-audit-handoff.md`, then inspect the actual branch diff, source, generated runtime, and tests. This is read-only. Focus on implementation defects, stale/reachable legacy code, race conditions, missing wiring, false-confidence tests, runtime/build omissions, NFC plumbing, exact two-cycle notifications, schedule ownership changes, Messenger state leakage, and offline recovery. Return GO, CONDITIONAL GO, or NO-GO with BLOCKER/HIGH/MEDIUM/LOW findings and exact file/function references.