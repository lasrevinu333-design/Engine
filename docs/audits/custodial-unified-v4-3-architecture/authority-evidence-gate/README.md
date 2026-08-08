# Custodial v4.3 root authority evidence gate audit

**Status:** `PASS_EVIDENCE_PACKET_ONLY`

**Activation:** **DENIED**

**Canonical gate decisions authored by this package:** **none**

This package audits the root authority chain beginning with `G-EVIDENCE-001`
and `G-TRACE-001`. It is deliberately outside the immutable v4.3 content
manifest. It records evidence readiness and missing authority; it is not a
stage decision, gate decision, package attestation, evidence-set identity, or
substitute private evidence plane.

## Controlling conclusion

All 39 canonical gates remain `OPEN`. No inspected surface contains an
admissible append-only `CLOSE`, `REOPEN`, `INVALIDATE`, or `SUPERSEDE` decision
for `G-EVIDENCE-001` or `G-TRACE-001`. The canonical registered-private-plane
locator is itself absent from the controlling contracts, so absence is proven
only for the current Engine worktree and history plus the inspected archive
candidate. Global absence and a system-wide earliest failure are not claimed.

The earliest bounded v4.3 repository invariant failure is commit
`1c306bcaedaef2dcc456e14116709709d7a894af`: its joined trace calls itself
complete and contains 252 CAP rows, but it has no reverse registry and its 252
synthetic `custodial.capability.cap-NNN.v1` record types do not resolve in its
record-type registry. That commit is not an ancestor of this branch.

## Root decision matrix

| Gate | Ready evidence | Missing admissible evidence | Status |
|---|---|---|---|
| `G-EVIDENCE-001` | Frozen v4.2 input, current v4.3 contracts, deterministic validators, GitHub run/log correlation, Gmail notice correlation, inspected archive candidate | Normatively registered private-plane locator; package attestation; evidence-set identity; authorized append-only decision sequence and any later invalidation/supersession history | `OPEN` |
| `G-TRACE-001` | Canonical dependency definition; historical 252-row candidate; current Phase-1/Phase-2/authority inventories | Current admissible v4.3 joined CAP trace; object-level reverse registry; trace lint; authorized closure after `G-EVIDENCE-001` | `OPEN` |

Schema design, component design, runtime admission, implementation, migration,
APK, phone, canary, release, deployment, and production therefore remain
closed.

## Stage-decision interpretation

The two files using protocol `CUSTODIAL_V43_PHASE2_STAGE_DECISION_V2` are
identical architecture-only projection receipts. No controlling artifact binds
that protocol to `custodial-unified-v4-3-stage-control-model.json`, and no other
canonical schema for it exists in the inspected repository. Both files omit all
ten fields required by the canonical stage model. They therefore cannot be
used as canonical stage authority. This package does not infer an illegal
transition from their filename; it reports the earlier schema/locator gap.

The current-branch canonical record-envelope validator exits at its
`RECORD_CHANGED_PATH_OUT_OF_SCOPE` guard because later workflow changes are
outside that historical package stage. This is a scope guard, not a record-data
failure. At accepted commit `5c2e9308ba75d6c8f95e52783e05144392eae20c`
(tree `248407269c7510c579ff8e59e973d1d57e380f63`) the canonical validator passes;
the inherited adversarial validator also passes at the current branch.

## GitHub and Gmail disposition

PR 135 is an open draft at `26a996fddf70aabff6ab2a526a16425526137e3b`
with nine successful checks. That green state does not bind this branch or
close a root gate.

Historic runs `31087372296` and `31087372426` remain failed at
`8e53038f9e5d5146b1dd8260614de30cb9be4553`. Direct job logs reproduce the
shared pinned-Playwright assertion (`actual: 0`, `expected: 1`). Two matching
Gmail notices still exist as single-message `UNREAD` `INBOX` threads and were
not modified. Because Engine is public, raw mailbox identifiers and notification
tokens are not published; `evidence-ledger.json` stores only their SHA-256
locators.

## Deterministic verification

Run directly with Node:

```sh
node docs/audits/custodial-unified-v4-3-architecture/authority-evidence-gate/validate-authority-evidence-gate.mjs --check
```

The validator checks package membership and hashes, protected-file hashes,
all current gates, stage-schema non-binding, historical trace defects,
privacy constraints, fail-closed authority status, and semantic mutation plus
recovery cases. It performs no network, phone, runtime, credential, migration,
release, deployment, or production action.
