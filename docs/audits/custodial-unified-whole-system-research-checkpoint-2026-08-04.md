# Memphis Zoo Custodial Program — Unified Whole-System Research Checkpoint

**Checkpoint date:** 2026-08-04  
**Branch:** `agent/custodial-unified-whole-system-v4-20260803`  
**Draft PR:** Engine #126  
**Status:** v4.1 architecture candidate and evidence package ready for four independent audits; all design/implementation/release gates remain closed

---

## 1. Work completed in this research cycle

- Reconciled GPT-5.3 Spark, GPT-5.5 Pro and GPT-5.5 Instant whole-program audits against primary evidence.
- Retained Ownership Architecture v3.1 as a subsystem specification rather than discarding it or treating it as the full architecture.
- Performed SELECT-only production schema/function/aggregate research across scheduling, identity, sessions, status, notifications, Messenger, Events, guest reporting, feedback, retention, cron, release and migration ledgers.
- Reconstructed competing schedule writers/resolvers, Sunday conflict, mixed groups, read-side inheritance, force regeneration, scan-alert clearing, AI-triggered generation, cron generation and SCH2 behavior.
- Created a 252-capability canon and whole-system authority register.
- Created a source/schema/data/field/physical/policy gate registry.
- Located and inspected the candidate seven-day static schedule workbook without modifying or importing it.
- Wrote Unified Whole-System Architecture v4 draft.1.
- Adversarially audited and rejected draft.1 as a final candidate.
- Replanned the complete architecture as v4.1, adding authority-set compatibility, location lifecycle, service occurrences, corrected ticket doctrine, outage/local-state rules, historical confidence, availability, test-data governance and other missing foundations.
- Completed final internal v4.1 audit.
- Prepared independent handoff, four-auditor prompt pack and mandatory evidence supplements.
- Opened draft PR #126, kept unmerged.

---

## 2. Architecture status

| Scope | Status |
|---|---|
| Ownership v3.1 principles | Retained |
| Unified Whole-System Architecture v4.1 | Ready for independent audit, not finally approved |
| Static schedule source | Seven-day candidate found; approval/provenance/conflicts remain open |
| Schema/component design | NO-GO |
| Product/backend/native implementation | NO-GO |
| Migration/shadow/cutover | NO-GO |
| APK/phone/Fully Kiosk/fleet/release | NO-GO |

---

## 3. High-load production findings now captured

- Group templates and Sunday-only location templates are materially different competing authorities.
- Seven active groups mix restroom and non-restroom locations.
- Employee Schedule currently computes inheritance and can emit synthetic `All Locations`.
- Named employee/code and free-text accommodation assumptions exist in SQL.
- Absence triggers, rolling cron, AI message triggers, API routes, legacy generation and SCH2 all write or publish schedule state through different mechanisms.
- Any scan event currently clears active legacy location alerts.
- Operating-hours data is empty; code falls back to 6:00 PM and does not encode September 14.
- Dashboard timer status is not canonical inspection readiness.
- Employee identity/eligibility and CoverAll contractor capacity are conflated.
- Location-level workload/route truth is incomplete and unversioned.
- Message/event retention physically removes short-lived content/history.
- Current GPS evidence is sparse latest status, not calibrated historical proof.
- Secure device/epoch delivery mechanisms are useful but currently consume legacy owner/status authority.
- Event audience uses legacy daily group assignments.
- Historical release/validation rows are stale relative to later migrations/source and can create false confidence.
- Strong forced-RLS, privileged-function, native-vault, durable-job, signer, anti-rollback and admission mechanisms should survive the rebuild.

---

## 4. Candidate workbook finding

`Memphis_Zoo_Static_Custodial_Schedule_COMPLETE_v2_OPEN.xlsx` is a useful seven-day candidate artifact with explicit `OPEN` gaps and internal assumptions/audits. It is not approved policy.

Material conflicts include:

- Michael McWright: workbook 3:00 PM–12:00 AM versus production 9:00 AM–6:00 PM;
- Markiesha Warren: workbook 8:30 AM–5:30 PM versus production 8:00 AM–5:00 PM;
- 6:00 PM close assumption versus missing effective operating policy/September 14;
- no approved lunch coverage;
- orphan reminder groups and inactive Elephant Trunk restroom scope;
- employee-bound family rows rather than approved positions and individual locations.

The artifact narrowed the research gate from “no seven-day candidate” to “candidate found; provenance, policy and normalization unresolved.”

---

## 5. Next required sequence

1. Run four separate independent first-pass v4.1 audits:
   - GPT-5.3 Spark;
   - GPT-5.5 Instant;
   - GPT-5.5 Pro;
   - GPT-5.6 Pro.
2. Do not show one new audit report to another auditor before its first pass is fixed.
3. Reconcile findings against source and production evidence, not by vote.
4. Research source/field/physical facts before asking Eric to decide policy.
5. Replan every confirmed BLOCKER/HIGH finding in a standalone architecture revision.
6. Internally reaudit and then repeat the four independent audits.
7. Begin isolated schema/component design only after architecture GO and closed gates.

---

## 6. Safety and no-change statement

This research cycle changed documentation on a new draft architecture branch only.

It did not change:

- product/frontend/native/backend source;
- database schemas, functions, policies, rows or cron jobs;
- employees, devices, assignments, credentials, schedules, Events, guest settings or feedback;
- GitHub Actions, Codemagic or other workflows;
- builds, APKs, phones, Fully Kiosk or fleet configuration;
- Render, Supabase, Firebase or GitHub Pages deployment;
- production behavior.

Draft PR #126 must remain unmerged until the independent audit/replan cycle closes.