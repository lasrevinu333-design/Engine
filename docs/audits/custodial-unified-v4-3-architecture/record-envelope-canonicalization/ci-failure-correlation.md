# GitHub Actions and Gmail Failure Correlation

## Exact reviewed head

- Engine PR 131 head: `8e53038f9e5d5146b1dd8260614de30cb9be4553`
- PR merge test commit observed by GitHub Actions: `aeb7d91e9ffa9908f21c1919d75f5fbc65b468c9`

## Matching unread Gmail notifications

Two unread failure notices match the reviewed PR head:

1. **Mobile Editions Build** — workflow run `31087372296`.
2. **Android Test APKs** — workflow run `31087372426`.

They are retained as required evidence and were not marked read or modified.

## Mobile Editions Build root cause

The failing custodial, manager, and viewer jobs reached the shared contract step and stopped in `scripts/ci-toolchain-contract-tests.mjs`. The exact assertion was:

```text
custodial-simple-v23-builder.yml:repair-audit-findings must run exactly one pinned Playwright Chromium install
actual: 0
expected: 1
```

The failure predates and is outside the documentation/control-only record-envelope package. The shell-browser job passed. The new Stage-1 workflow does not suppress, repair, or reinterpret this failure; it isolates architecture validation while recording the unrelated product-workflow debt for its proper later gate.

## Android Test APKs

The matching Android workflow failure is likewise retained as unresolved product/build evidence. No APK, dependency, mobile source, or build-workflow correction is authorized by this Stage-1 architecture command.

## PR 133/134 bootstrap recovery

- PR 133 bootstrap run `31125793180`, job `92714925198`, independently verified both transport hashes and reconstructed the exact reviewed archive.
- That job created local commit `f3d19ee` but GitHub correctly rejected its push because the job token lacked permission to create or update workflow files.
- Recovery PR 134 retained the same hash-verified archive, installed the documentation package through commit `fdc67da639c51c2c29a830b33499f524d3c383ee`, installed the reviewed read-only canonicalization workflow through commit `f667400af350125d6d8116283d6d27241c72472b`, removed the consumed bootstrap through `ece24415939379f8f304e7a5bbcc3e7aed8d03c8`, and removed the temporary staged workflow copy through `2751e4b734bd53dc52daf91e85f3888080728d01`.
- This append-only evidence update is the sole validation-trigger change after cleanup. It does not alter any normative package member, product source, schema, migration, APK, phone, deployment, or production state.

## Acceptance rule

This package may report its dedicated architecture workflow as green only if it passes at the exact applied head. It may not claim that PR 131, mobile builds, Android test APKs, implementation, or release are globally green. Those separate failures remain open and must be addressed at the product/build stage before any downstream release authorization.
