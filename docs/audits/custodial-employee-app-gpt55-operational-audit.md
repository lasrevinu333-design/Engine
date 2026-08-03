# Custodial Employee App — GPT-5.5 Operational and Low-Technology User Audit

**Repository:** `lasrevinu333-design/Engine`  
**Branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Mode:** Read-only, operational-model and human-factors audit  
**Primary handoff:** `docs/custodial-employee-app-independent-audit-handoff.md`

## Purpose

This audit asks whether the employee product actually matches how Memphis Zoo custodial work operates and whether an extremely low-technology employee can use it correctly without interpretation, technical knowledge, or repeated manager assistance.

This is not the mechanical code audit and not the final cryptographic/release audit. Concentrate on contradictions between the real work, the employee's mental model, the information shown, the timing of changes, and the actions required.

Do not read another auditor's findings before completing the first report.

## User model

Evaluate the product for an employee such as Karen:

- has never owned a cellphone or computer;
- struggles with ordinary picture-based ordering kiosks;
- can be trained to locate and tap NFC tags in each work area;
- should not need to understand device enrollment, kiosk identity, sync, QR codes, network state, app architecture, schedule versions, or technical recovery procedures;
- may be wearing gloves, carrying supplies, listening to a radio, and working around guests;
- needs large, obvious, forgiving actions and very little text.

Any point where the product expects Karen to infer what the software means is a product defect, not a user defect.

## Required first steps

1. Read `docs/custodial-employee-app-independent-audit-handoff.md`.
2. Read `docs/custodial-field-workflow-invariants.md`.
3. Inspect the original web employee experience and schedule behavior.
4. Inspect the redesigned employee branch at a frozen commit.
5. Distinguish actual behavior from intended behavior and from unimplemented plans.

## Primary assignment

### 1. True operating model

Verify that the product treats work as **current area ownership**, not a software-ordered route.

Employees must be free to choose practical order based on geography, restroom urgency, guest conditions, access, and work already underway.

Flag language or behavior such as:

- current assignment;
- next assignment;
- next stop;
- recommended route;
- forced numbered sequence;
- prompts that imply the phone controls walking order.

Public restrooms may be displayed first, but this must not force wasteful travel.

### 2. Home-screen comprehension

The employee home must be immediately understandable and contain only:

- Memphis Zoo Custodial;
- employee name;
- Schedule;
- Messages;
- Events;
- Feedback.

Assess:

- whether each label matches the employee's likely vocabulary;
- whether the four actions are visually distinct and easy to tap;
- whether the stone-path background helps orientation without reducing readability;
- whether a long employee name breaks the layout;
- whether Back behavior is obvious;
- whether any extra text competes with the four actions;
- whether any duplicate navigation creates uncertainty.

Reject employee-facing kiosk IDs, QR instructions, NFC explanations, enrollment/device status, weather, attendance, build information, permanent refresh controls, or admin actions.

### 3. NFC as trained physical behavior

Employees will be shown where each NFC tag is located. The interface does not need to explain NFC.

Required normal behavior:

- tap phone to location tag from lock state or any employee page;
- correct location is visibly confirmed;
- Start Cleaning screen opens;
- employee starts the session;
- no Scanner page;
- no QR path;
- no repeated employee-name selection;
- no silent vibration-only failure.

Audit all failure states from the employee perspective:

- unrecognized tag;
- network unavailable;
- tag scanned twice;
- another scan during an active session;
- screen off during timer;
- unfinished completion form;
- app or WebView restart;
- queued offline submission.

Every error must tell the employee what to do next in plain language. Technical errors, identifiers, stack details, and sync terminology are prohibited.

### 4. Live ownership schedule

The Schedule page must answer one question:

> What areas am I responsible for right now?

Assess whether the employee can understand the following transitions without manager explanation:

#### Morning

Show the morning assigned areas only.

#### 9:45 restroom rebalance

When ownership changes:

- employee receives the approved persistent notification;
- Schedule updates automatically;
- continuing areas remain;
- changed restroom ownership is clear;
- unchanged days do not show duplicated artificial morning/afternoon sections.

#### Lunch coverage

When coverage begins:

- employee is notified;
- temporary locations appear under the active ownership list;
- end time is obvious;
- section disappears automatically when coverage ends;
- employee receives the end notification.

#### Shift-end inheritance

When another employee leaves:

- remaining employees receive clear notifications;
- inherited areas appear automatically;
- wording emphasizes present responsibility, not the departed employee's technical schedule record;
- locations remain assigned until the next legitimate transfer or the recipient leaves.

#### Final staffed hours and seasonal close

Check that:

- every location has an owner during staffed coverage windows;
- two remaining employees from 3:00–5:00 can see inherited responsibilities clearly;
- an open-hour gap with no employee is surfaced to management, not hidden from employees or assigned to someone who left;
- the September 14 closing-time change comes from scheduler policy rather than employee-facing hard-coded text.

### 5. Refresh and stale information

The employee should not need to decide when data is stale.

Expected behavior:

- automatic update at launch, page open, foreground return, network reconnect, notification arrival, assignment-window change, and bounded safety polling;
- no permanent Refresh button;
- `Try Again` appears only after a real failure;
- cached ownership is clearly handled when offline without claiming stale information is current if the system cannot establish that.

Audit whether recovery wording is simple enough for Karen.

### 6. Voice and visual notifications

Applies to messages, due-soon, overdue, schedule changes, lunch changes, inherited areas, transferred areas, and manager/emergency reassignment.

Exact sequence:

1. chime;
2. personalized spoken announcement;
3. chime again;
4. identical spoken announcement again;
5. silence.

The visual notification remains over the current screen until Open or Dismiss.

Assess:

- whether the announcement is short, specific, and understandable;
- whether employee and sender/location names are pronounced and ordered sensibly;
- whether the message body remains private;
- whether Open labels describe the destination clearly;
- whether Dismiss is large and obvious;
- whether a second queued alert causes confusion;
- whether the same alert ever repeats after the second voice;
- whether due-soon and overdue wording communicates different urgency;
- whether the employee understands that dismissing a schedule notice does not remove the assignment.

Preferred wording includes:

- `Tammy, you received a message from Alijah Collins.`
- `Tammy, your restroom assignments have changed.`
- `Tammy, lunch coverage has been assigned.`
- `Tammy, your lunch coverage has ended.`
- `Tammy, additional areas have been assigned to you.`
- `Tammy, Teton Restrooms is due soon.`
- `Tammy, Teton Restrooms is overdue. Please handle it now.`

Flag unnecessary words, technical labels, long sentences, ambiguous pronouns, or inconsistent terminology.

### 7. Messenger human factors

Judge Messenger as a field tool, not a consumer social app.

Required flow:

- conversation list opens quickly;
- New immediately opens recipient selection;
- selecting a person opens only that person's thread;
- no previous thread flashes while loading;
- sending gives immediate visible confirmation;
- swipe left reveals Delete;
- tapping Delete removes the conversation from the employee view immediately;
- an accessible non-swipe delete path exists for employees who cannot perform the gesture;
- controls are limited and professional;
- no redundant confirmation asking whether the user intended the button they just pressed.

Audit labels, density, loading state, empty state, keyboard state, large text, message-bubble readability, wrong-recipient risk, and recovery when the network is slow.

### 8. Events and Feedback

Events should show only information relevant to the employee's work, in brief language.

Feedback should make it simple to report the intended employee concerns without exposing manager/device administration.

Assess whether either page contains excessive categories, explanations, secondary controls, or technical wording.

### 9. Cognitive-load audit

For each common task, count:

- decisions;
- taps;
- screens;
- text that must be interpreted;
- opportunities to choose the wrong path;
- moments where the app appears frozen or contradictory.

Tasks:

1. Check current areas.
2. Read a message from Alijah.
3. Start a new message.
4. Delete a conversation.
5. View an event notice.
6. Submit feedback.
7. Scan an NFC tag and start cleaning.
8. Complete a restroom session.
9. Complete an exhibit session.
10. Understand a 9:45 schedule change.
11. Understand lunch coverage beginning and ending.
12. Understand inherited areas at shift end.
13. Recover from no network.

Common employee tasks should require no more than three primary decisions.

### 10. Field-test design

Produce a Karen acceptance script that gives the employee only realistic training, not hints designed to rescue the interface.

Record:

- hesitation longer than three seconds;
- wrong taps;
- repeated taps caused by delayed feedback;
- questions asked;
- abandoned actions;
- manager explanations required;
- recovery without assistance;
- confidence after each task.

Recommend the smallest UI correction for each likely failure.

## Output format

Return:

1. **Verdict:** GO, CONDITIONAL GO, or NO-GO.
2. **Exact commit audited.**
3. **Operational contradictions:** where software behavior conflicts with real custodial work.
4. **Karen blockers:** anything an extremely low-technology employee is unlikely to understand or complete.
5. Findings grouped as **BLOCKER / HIGH / MEDIUM / LOW**.
6. For each finding:
   - screen/flow and exact source reference where possible;
   - expected employee interpretation;
   - likely actual interpretation;
   - operational consequence;
   - smallest correct repair;
   - acceptance test.
7. **Word-removal list:** text that should be deleted or shortened.
8. **Task-decision table:** decisions/taps/screens for common tasks.
9. **Karen field-test script.**
10. **Top five simplifications before release.**

Do not modify the repository, trigger Codemagic, install an APK, or copy another auditor's conclusions.

## Copy-ready prompt

> Independently perform the GPT-5.5 operational and low-technology-user audit of `lasrevinu333-design/Engine`, branch `agent/custodial-moto-g-simple-v23-20260802`. Read `docs/audits/custodial-employee-app-gpt55-operational-audit.md`, `docs/custodial-employee-app-independent-audit-handoff.md`, and `docs/custodial-field-workflow-invariants.md`. Inspect the actual employee screens and schedule behavior. This is read-only. Audit whether the product matches real area ownership, 9:45 rebalance, lunch coverage, shift-end inheritance, seasonal hours, ambient NFC, exact two-cycle notifications, and the needs of an employee like Karen who has almost no technology experience. Return GO, CONDITIONAL GO, or NO-GO with BLOCKER/HIGH/MEDIUM/LOW findings, exact references where possible, a word-removal list, task-decision counts, and a realistic Karen field-test script.