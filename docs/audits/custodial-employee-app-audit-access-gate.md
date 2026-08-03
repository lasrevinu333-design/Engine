# Custodial Employee App — Audit Access and Frozen-Commit Gate

**Repository:** `lasrevinu333-design/Engine`  
**Branch:** `agent/custodial-moto-g-simple-v23-20260802`

## Purpose

No product audit is valid unless the auditor can inspect the exact frozen source and its history. Tooling failure is not a product failure.

## Required access gate

Before reviewing product behavior, the auditor must prove all of the following:

1. The repository is accessible.
2. The named branch exists.
3. A literal 40-character frozen commit SHA was supplied; placeholders such as `<FROZEN_COMMIT_SHA>` are invalid.
4. The frozen commit is accessible.
5. The branch pointer can be compared with the frozen commit.
6. The merge base with `main` can be determined.
7. Changed files can be enumerated.
8. Source and tests can be read.

The auditor must record the evidence used for each item.

## Correct blocked outcome

If any access prerequisite is unavailable, return:

`AUDIT BLOCKED — NO PRODUCT VERDICT`

Do **not** return GO, CONDITIONAL GO, or NO-GO for the product. Explain exactly what access or artifact is missing.

A missing connector, inaccessible private repository, absent source bundle, or placeholder commit SHA is an audit-environment failure. It does not prove a defect in the application.

Do not inflate the blocked report with hypothetical BLOCKER/HIGH/MEDIUM findings copied from the audit checklist. Uninspected risks may be listed only as `Not evaluated`.

## Timing gate

Do not begin a specialist implementation audit merely because the branch exists.

The first GPT-5.3 and GPT-5.5 audit round begins only after the builder declares one coherent implementation of:

- employee Home;
- live Schedule;
- notification overlay and two-cycle audio cadence;
- Messenger;
- ambient NFC wiring;
- directly affected tests and runtime packaging.

Before that point, the branch may be reviewed as an early-plan/prototype review, but it must not be represented as a release audit.

## Connector preflight

For a GitHub-connected chat, perform this preflight before receiving the full audit prompt:

1. Fetch this file from the named branch.
2. Fetch `docs/custodial-employee-app-independent-audit-handoff.md` from the same branch.
3. Fetch the supplied frozen commit by exact SHA.
4. Return only:
   - repository accessible: yes/no;
   - branch accessible: yes/no;
   - frozen commit accessible: yes/no;
   - first heading of each fetched file;
   - exact commit SHA observed.

Do not start the audit during preflight.

## Offline/source-bundle fallback

If the selected model or chat cannot use the GitHub connector, the builder must provide a frozen audit bundle containing at minimum:

- exact frozen commit SHA;
- merge-base SHA;
- branch pointer SHA;
- complete changed-file inventory;
- patch from merge base to frozen commit;
- complete changed source and test files;
- relevant unchanged dependency files;
- generated/runtime asset inventory and hashes;
- build and release manifests;
- automated test commands and captured results;
- explicit list of physical-phone-only requirements.

The auditor must identify that it used a source bundle rather than live GitHub access.

## Independence rule

Access evidence may be shared among auditors. Product conclusions and findings must not be shared until each auditor finishes its first independent pass.
