# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4.2 Checkpoint

**Checkpoint date:** 2026-08-04  
**Branch:** `agent/custodial-unified-whole-system-v4-2-20260804`  
**Base:** `main@8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`  
**Status:** Standalone v4.2 architecture and audit package complete; immutable freeze and four independent audits are next  
**All design/implementation/release gates:** closed

---

## 1. Completed work

- Read and reconciled all four independent v4.1 audits.
- Retained v4.1 as the correct whole-system direction but rejected it as final architecture.
- Created a clean v4.2 branch directly from the frozen actual program/main.
- Created a frozen evidence-precedence manifest.
- Quarantined the generated schedule-seed SQL as non-admitted executable evidence.
- Created a CAP-001–CAP-252 capability/authority/security/retention/migration/proof trace.
- Created the trace shorthand registry and validation contract.
- Created the comprehensive technical/research/policy/stage gate registry.
- Created standalone Unified Whole-System Architecture v4.2.
- Performed new SELECT-only production research on triggers, cron, function configuration, RLS/FORCE RLS and extension placement.
- Completed adversarial internal v4.2 audit.
- Prepared programmer handoff, independent audit handoff and four model-specific prompts.

---

## 2. V4.2 architecture closure

V4.2 adds the cross-domain contracts missing from v4.1:

1. common record envelope/type registry;
2. distributed authority-set generation/fencing/pinning/activation/rollback;
3. canonical principal, credential, grant and authorization decision;
4. confidential accommodation effect versus justification;
5. location split/merge/tag/in-flight transaction;
6. occurrence satisfaction/concurrency/correction/next-cycle aggregate;
7. reboot-aware offline time and local-key/lost-phone lifecycle;
8. notification child/group/epoch-bound acknowledgement and visible stale cancellation;
9. Messenger user-scoped visibility/reappearance;
10. Event cancellation and impact reversal;
11. Feedback offline/attachment security;
12. executable AI/MCP/Moxie/diagnostic registry;
13. structural analytics anti-misuse;
14. cross-store retention/holds and complete restore bundle;
15. machine-enforced legacy writer/resolver retirement;
16. external artifact quarantine;
17. exact release validation invalidation.

---

## 3. Live production facts newly confirmed

SELECT-only inspection confirmed current triggers including:

- absence override schedule regeneration;
- PTO-to-absence synchronization;
- Messenger background work;
- Messenger schedule pre-generation;
- scan-event alert clearing.

Active cron includes:

- rolling schedule-window ensure every 30 minutes;
- Messenger deleted-content purge hourly at minute 18.

Sampled protected tables use RLS and FORCE RLS, with varied policy counts. This requires exact role/grant/function/API analysis rather than a simplistic safety label.

`pg_net` is installed in `public`; `pg_cron` is in `pg_catalog`.

No object or row was changed.

---

## 4. Open gates intentionally preserved

The architecture does not invent:

- approved static schedule and disputed shifts;
- positions/person-bound rules;
- lunch;
- normal/seasonal/split/after-hours/cross-midnight policy;
- workload/frequency/route;
- readiness/severity/inspection/OPEN policy;
- contractor identity/acceptance;
- GPS use/retention;
- manager tiers/on-call;
- Messenger archive/reappearance;
- Moxie/AI write authority;
- guest activation/privacy;
- retention/holds/analytics policy;
- SLO/RPO/RTO;
- Karen/pilot and Build 22 retirement thresholds.

Those gates block downstream design where they affect structure.

---

## 5. Internal verdict

> **GO for four independent v4.2 architecture audits only.**

No schema, component, implementation, migration, APK, phone, fleet or release work is authorized.

---

## 6. Next sequence

1. validate final package paths and manifest entries;
2. open a draft documentation-only PR to main;
3. create immutable branch `audit/custodial-unified-v4-2-freeze-20260804`;
4. record exact freeze SHA in PR launch comment;
5. run GPT-5.3 Spark, GPT-5.5 Instant, GPT-5.5 Pro and GPT-5.6 Pro in four fresh conversations;
6. reconcile reports against source and production evidence;
7. replan any confirmed architecture blocker/high finding;
8. repeat audit if architecture changes materially;
9. begin isolated design only after explicit final architecture GO and relevant gates close.

---

## 7. Safety

This cycle changed documentation only. It did not change product source, database objects/rows, workflows, builds, APKs, phones, Fully Kiosk, deployments or production behavior.