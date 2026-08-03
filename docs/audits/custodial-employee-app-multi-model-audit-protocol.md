# Custodial Employee App — Multi-Model Audit Protocol

**Repository:** `lasrevinu333-design/Engine`  
**Branch:** `agent/custodial-moto-g-simple-v23-20260802`

## Audit roster

### Builder and primary self-auditor

**Model:** GPT-5.6 Extra High  
**Role:** architecture, implementation, integration, test construction, iterative repair, and first complete audit.

### Mechanical adversarial auditor

**Model:** GPT-5.3 Spark  
**Assignment:** `docs/audits/custodial-employee-app-gpt53-spark-audit.md`

Purpose:

- inspect every changed file;
- identify incomplete wiring, stale assets, build omissions, race conditions, and false-confidence tests;
- trace NFC, notifications, schedule transitions, Messenger state, and offline recovery mechanically;
- avoid broad redesign unless required by a proven defect.

### Operational and low-technology-user auditor

**Model:** GPT-5.5  
**Assignment:** `docs/audits/custodial-employee-app-gpt55-operational-audit.md`

Purpose:

- compare software behavior with real custodial operations;
- test the area-ownership model, coverage changes, seasonal hours, and employee interpretation;
- audit the interface for an employee such as Karen;
- identify excess text, ambiguous actions, cognitive load, and likely field failures.

### Independent final release auditor

**Model:** GPT-5.6 Pro  
**Assignment:** `docs/custodial-employee-app-independent-audit-handoff.md`

Purpose:

- comprehensive source-to-release audit;
- integrate architecture, security, operations, Android/Fully containment, test sufficiency, and Codemagic readiness;
- issue the final independent GO, CONDITIONAL GO, or NO-GO recommendation.

## Independence rules

1. Freeze and record one exact commit for each audit round.
2. Each auditor reads source and tests directly.
3. Do not provide another auditor's findings before the first report is complete.
4. Do not ask auditors to confirm the builder's conclusions.
5. Require evidence, exact references, and a falsifiable repair for every finding.
6. Treat unsupported claims as hypotheses requiring verification.
7. A lower-tier model finding is not automatically accepted or rejected; verify it against source and tests.
8. Real Moto G 2025 behavior overrides model consensus.

## Audit rounds

### Round 1 — plan and early implementation

Run after the first coherent implementation of Home, Schedule, notifications, Messenger, and NFC wiring.

Order:

1. Builder self-audit on GPT-5.6 Extra High.
2. GPT-5.3 Spark mechanical audit.
3. GPT-5.5 operational/Karen audit.
4. Repair evidence-backed findings.

The two secondary audits may run in parallel because their assignments do not overlap materially.

### Round 2 — source-complete freeze

Run when all intended employee runtime features and tests are implemented.

Order:

1. Freeze exact commit.
2. Builder full audit.
3. Spark mechanical audit on the frozen commit.
4. GPT-5.5 operational audit on the same frozen commit.
5. Resolve every BLOCKER/HIGH finding and document disposition:
   - accepted and repaired;
   - rejected with source/test evidence;
   - deferred to physical-phone proof.
6. Freeze a new repair commit.

### Round 3 — pre-Codemagic release audit

Run only after source-complete repairs and clean tests.

Order:

1. Builder final self-audit using GPT-5.6 Pro if available.
2. Independent GPT-5.6 Pro audit using the full handoff.
3. Final Spark regression sweep of the exact release diff.
4. Optional focused GPT-5.5 recheck only if employee-visible behavior changed after its prior audit.
5. No Codemagic trigger while any unresolved BLOCKER exists.

### Round 4 — admitted APK and physical-phone acceptance

Models may review artifact evidence, but the final authority is Karen's Moto G 2025 under Fully Kiosk.

Required physical proof includes:

- upgrade preserves enrollment and native vault;
- Fully Single App containment;
- Home/Recents blocked;
- reboot and sleep/wake recovery;
- NFC from lock state and every employee screen;
- restroom and exhibit workflows;
- offline queue and single replay;
- exact chime/voice/chime/voice cadence;
- persistent overlay and alert queue;
- due-soon, overdue, direct message, schedule change, lunch, and inherited-area notifications;
- live ownership transitions;
- Messenger recipient isolation and deletion;
- no employee access to enrollment removal, manager tools, or Android launcher.

## Finding disposition format

For every external finding, the builder records:

- Auditor/model
- Severity
- Finding summary
- Exact evidence
- Disposition
- Repair commit or rejection evidence
- Regression test
- Physical verification required: yes/no

Do not close a finding with `fixed` unless the repair and regression proof are both identified.

## Recommended prompt sequence

### Spark

Use the copy-ready prompt at the end of:

`docs/audits/custodial-employee-app-gpt53-spark-audit.md`

### GPT-5.5

Use the copy-ready prompt at the end of:

`docs/audits/custodial-employee-app-gpt55-operational-audit.md`

### GPT-5.6 Pro

Use the copy-ready prompt in:

`docs/custodial-employee-app-independent-audit-handoff.md`

## Decision rule

The build may proceed to Codemagic only when:

- builder audit has no unresolved blocker;
- independent GPT-5.6 Pro audit has no unresolved blocker;
- Spark mechanical audit has no unresolved blocker;
- GPT-5.5 operational audit has no unresolved employee-usability or operating-model blocker;
- all required automated gates pass;
- every remaining limitation is explicitly classified as a real-device test item;
- Build 22 remains the rollback baseline until the new APK is independently admitted and physically accepted.
