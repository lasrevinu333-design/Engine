# Batch 0A — reproducible baseline and rollback boundary

## Purpose

Batch 0A makes the existing release reproducible before the React/Living Field
Guide migration begins. It does not change permissions, notification semantics,
Messenger semantics, or database data. Its sole user-visible compatibility
repair is a browser-safe `notifications.html` explanation for the previously
broken Manager Hub link; it does not register push, change preferences, or send
anything.

Baseline sources:

- Frontend: `1bbdcb059e3fdf260f6ae76a6ab024502d9d26e5`
- Backend: `ac70f68c78cfcaff11cf9834620e0b2775a339dd`
- Production database metadata captured read-only on 2026-07-23

## Locked foundation

- Node `22.23.1`
- npm `11.17.0` (the version bundled with Node `22.23.1`)
- one root npm workspace and lockfile
- exact direct dependency versions
- an exact install-script allowlist with strict rejection of unreviewed scripts
- Playwright `1.61.1` revision-pinned Chromium
- axe `4.12.1`
- deterministic edition identity derived from the full source commit
- exact discovered frontend runtime inventory and exact edition output manifests
- ChatScope source/output drift check while the compatibility renderer remains

The accepted future component versions and state-ownership boundaries live in
`docs/architecture-version-baseline.json`. Recording them in Batch 0A does not
install the future React 19 shell or alter the current React 18 compatibility
bundle.

## Captured rollback evidence

- `quality/baselines/production-schema-api-2026-07-23.json`
  - full schema metadata fingerprints
  - 156 public tables, 1,847 columns, 632 constraints, 493 indexes, 23 policies
  - detailed metadata for the 20 tables involved in events, device assignment,
    Messenger, push, scanning, sessions, and retention
  - the current 17-tool MCP transport contract and API contract versions
- `quality/baselines/production-migrations-2026-07-23.json`
  - 133 Supabase migration identifiers
  - four MCP RPC migration-ledger entries
  - no SQL bodies, authors, notes, secrets, or production row data
- `quality/baselines/backend-http-api-2026-07-23.json`
  - 80 documented full HTTP routes
  - 182 route declarations extracted from the exact deployed backend source
  - nine application contract versions
  - no request/response payloads, credentials, or production row data
- synthetic fixtures under `quality/fixtures/batch-0a/`
  - the approved target contracts are captured without asserting that the
    legacy runtime already implements them
- current accessibility baseline
  - existing findings are recorded; new serious or critical findings fail CI

## Rollback

No database migration is part of Batch 0A, so database rollback is neither
required nor permitted for this batch.

If the merged foundation causes a release regression:

1. Revert the Batch 0A merge commit on `main`; do not rewrite branch history.
2. Wait for GitHub Pages to advertise the revert commit.
3. Verify the public deployment manifest and every runtime asset hash.
4. Rebuild Manager, Custodial, and Viewer artifacts from the revert commit.
5. Verify each artifact’s embedded source commit, edition, runtime manifest,
   archive integrity, and checksum.
6. Compare production schema/API metadata to the committed read-only baseline.
   A difference means an unrelated production mutation occurred and must be
   investigated separately; do not “fix” it by replaying Batch 0A.

The previous APKs remain recoverable by their final pre-Batch-0A workflow
artifacts and checksums. They must not be relabeled as production-signed builds.

## Exit gate

Batch 0A is complete only when:

- a clean install from the single lockfile passes on exact Node/npm;
- manifest discovery, exact set equality, and hashes pass;
- two builds of the same edition and commit produce identical asset hashes;
- all three edition builds carry the exact source commit;
- invalid edition names fail instead of silently packaging Manager privileges;
- source, contract, browser, accessibility, and mobile gates pass;
- PR checks are green on the final head;
- the merge commit is rebuilt and verified independently;
- public Pages assets match the merged manifest;
- no production database state changed.
