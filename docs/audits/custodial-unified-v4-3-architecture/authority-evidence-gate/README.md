# Custodial v4.3 root authority evidence gate audit

**Package:** `custodial-unified-v4-3-authority-evidence-successor-20260808-001`

**Revision:** `v4.3.1-authority-evidence-successor`

**Status:** `PASS_EVIDENCE_PACKET_ONLY`

**Activation:** **DENIED**

**Architecture closure:** **DENIED**

**Canonical gate decisions authored by this package:** **none**

This package audits the root authority chain beginning with `G-EVIDENCE-001`
and `G-TRACE-001`. It is deliberately outside the immutable v4.3 content
manifest. It records evidence readiness and missing authority; it is not a
stage decision, gate decision, package attestation, evidence-set identity, or
substitute private evidence plane.

## Controlling conclusion

All 39 canonical gates remain `OPEN`. No inspected surface contains an
admissible append-only `CLOSE`, `REOPEN`, `INVALIDATE`, or `SUPERSEDE` decision
for either root gate. The canonical registered-private-plane locator is absent
from the controlling contracts, so absence is proven only for the bounded
inspected surfaces. Global absence and a system-wide earliest failure are not
claimed.

The earliest active foundation invariant failure remains commit
`30130b62c29ba017128ae0a88bf3d98f75b64b20`: it registered
`tools/generate-v43-content-manifest.mjs` before the generator existed. The
immutable successor foundation is commit
`46b049439cf83c7fe861926ef34cabf9dcb5840b` (tree
`3607fd3a7cc908b90f95fde456d6d5b1e4d5fbe9`), package
`custodial-unified-v4-3-foundation-correction-20260808-002`, revision
`v4.3.4-foundation-correction`. Its content manifest is SHA-256
`5c5749486add2308a430de0145b02e1a19d5b4ba59cc875b5c48d47180f068c8`.
The current execution and hardening base is separately bound to commit
`66e6a8ea251169403aed555b439c4a4424306f5c` (tree
`9e233d67c3ee35f288b11f310083812960c72cf7`), whose only later foundation
change is the accepted dependency lockfile correction. Whole-System Quality
Program run `31263611491` is accepted green at that checkout. The last accepted
authority source/rebind tip remains historical predecessor
`f5c5731d68bbc6bf17d3a7d2f9acc5ab4ba3e247` (tree
`e5022f6dcf5b82b5ffa2f3a3789e642679f8bded`). These identities are not
interchangeable and this stage does not change the earliest-invariant conclusion.

The record-envelope dependency is replayed only from accepted commit
`aab21274de72747e38c8e5996c06e77c399e0f3f` (tree
`8e1cea35444ac84785a3a6aff46d7d5f69277ec7`). The authority-schema dependency
is replayed only from accepted commit
`466d7451b50fb1c851fa17d3b8ac5b32482e285c` (tree
`6f4f695718e1af18ea4b0d3601587d167c359f1d`). Neither package is incorrectly
replayed on current HEAD after its changed-path scope ended.

## Root decision matrix

| Gate | Ready evidence | Missing admissible evidence | Status |
|---|---|---|---|
| `G-EVIDENCE-001` | Frozen v4.2 input, current v4.3 contracts, deterministic validators, GitHub run/log correlation, privacy-safe Gmail correlation, inspected archive candidate | Registered private-plane locator; package attestation; evidence-set identity; authorized append-only decision sequence and later invalidation/supersession history | `OPEN` |
| `G-TRACE-001` | Canonical dependency definition; historical 252-row candidate; current Phase-1/Phase-2/authority inventories | Current admissible v4.3 joined CAP trace; object-level reverse registry; trace lint; authorized closure after `G-EVIDENCE-001` | `OPEN` |

Schema design, component design, runtime admission, implementation, migration,
APK, phone, canary, release, deployment, and production remain unauthorized.
The two files using protocol `CUSTODIAL_V43_PHASE2_STAGE_DECISION_V2` remain
architecture-only projections: they have no canonical stage-schema binding and
omit all ten canonical stage fields.

PR 135's green checks do not bind this branch or close a root gate. Historic
runs `31087372296` and `31087372426` retain their failed pinned-Playwright
evidence. Gmail evidence is represented only by SHA-256 locators; raw mailbox
identifiers and notification tokens are not published or modified.

## Deterministic verification

Run the focused closure and adversarial check first:

```sh
node docs/audits/custodial-unified-v4-3-architecture/authority-evidence-gate/validate-authority-evidence-gate.mjs --check-package-manifest
```

Then run the full deterministic replay:

```sh
node docs/audits/custodial-unified-v4-3-architecture/authority-evidence-gate/validate-authority-evidence-gate.mjs --check
```

`--write` transactionally regenerates `command-receipts.json`, then
`package-manifest.json`, then `validation-result.json`. The manifest and result
are excluded from the member aggregate to prevent circular identity. Missing
or unknown modes are rejected.

The validator performs recursive file, directory, symlink, and nonregular
closure checks; exact manifest, ledger, command-receipt, and validation-result
shape and semantic checks; deterministic byte, digest, and aggregate checks;
and named failure/recovery cases. Full `--check` replays eight current
commands using Node `22.23.1` and npm `11.17.0`. Dedicated CI replays accepted
dependencies in detached temporary worktrees, removes only its registered
owned worktrees and residue, and proves the proposed checkout is read-only. H05
is bound to `CUSTODIAL_V432_H05_VALIDATION_V3`, 111/111 unique passing checks,
normalized SHA-256 `52db2f1928ac90e0f338af86f9b4e5e87267e8197635f787fcc6b14150985adc`,
stable authority receipt SHA-256
`b74811f6bedcd254959096e3d08194ccbe0305a832650f1fc483dbfd0b05ac9e`,
and named negative proof `H05-EVIDENCE-ID-DUPLICATE-REJECT`. No check
uses the network, phone, browser, credential, migration, release, deployment,
or production authority.

## Deferred consumer rebinds

This package deliberately does not edit downstream sources. A separate stage
must rebind the record-registry prerequisite consumers that still select the
pre-correction content-manifest/H05 identities, then rebind the joined CAP trace
and object-level reverse-registry consumers that depend on that prerequisite.
Neither downstream class may treat this evidence workflow or its green result
as activation, migration, release, canary, fleet, deployment, or production
authority.
