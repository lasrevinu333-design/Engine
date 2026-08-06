# Phase-1 Correction Rollback

This correction is documentation and control-artifact work on `agent/custodial-v43-remote-foundation-phase1-correction-20260806` only. It creates no product, database, migration, dependency, APK, phone, device, deployment, release, or production state.

Preserve these immutable anchors:

- parent Phase-1 commit `f8235b88ef178da50681789a5ebff0dbcf4df5f2`;
- bootstrap commit `58159ef9e5440d9f654f381c4eee2a875d298ee6`;
- accepted governance commit `569dc25c11723801a212de489dced7da776d5be7`;
- draft stacked PR 131 and all independent-review evidence.

Each remote write is a sequential commit with prior blob identity checked where a file existed. If validation fails, repair the earliest violated foundation invariant and preserve failed evidence. Do not weaken checks or add a one-record exception.

Rollback keeps PR 131 draft, records Phase 2 as unauthorized, and abandons the correction head as authority. No runtime reversal is required. Never roll back by changing the parent branch, prior freezes, main, product/runtime code, dependencies, databases, devices, release state, or production.
