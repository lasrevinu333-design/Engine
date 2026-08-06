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

## Acceptance rule

This package may report its dedicated architecture workflow as green only if it passes at the exact applied head. It may not claim that PR 131, mobile builds, Android test APKs, implementation, or release are globally green. Those separate failures remain open and must be addressed at the product/build stage before any downstream release authorization.
