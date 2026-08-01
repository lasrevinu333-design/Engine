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
- npm `11.17.0`, installed explicitly after Node setup because the Node
  distribution bundles npm `10.9.8`
- one root npm workspace and lockfile
- exact direct dependency versions
- an exact install-script allowlist with strict rejection of unreviewed scripts
- Playwright `1.61.1` revision-pinned Chromium
- axe `4.12.1`
- deterministic edition identity derived from the full source commit
- exact discovered frontend runtime inventory and exact edition output manifests
- ChatScope source/output drift check while the compatibility renderer remains
- Capacitor iOS generation explicitly locked to SwiftPM and Xcode `26.4`
- edition-specific `Package.resolved` graphs enforced during both dependency
  resolution and archive
- Gradle `8.14.3` distribution and wrapper JAR verified against Gradle's
  published SHA-256 checksums before execution
- edition-specific Gradle dependency graphs restored from reviewed SHA-256
  verification metadata, semantically validated, and enforced in strict mode
  from isolated cold caches for debug and release
- project-wide native build numbers and a single reviewed `1.0.0` release version
- Android release signing wired to the edition-specific Codemagic keystore,
  followed by APK and app-bundle signature verification
- Manager Firebase client configuration locked by reviewed SHA-256 digests;
  release builds reject endpoint fallback and record only digest/size provenance

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

## External release activation

The repository is fail-closed when release infrastructure is absent. A signed
Codemagic run requires:

- distinct Manager, Custodial, and Viewer Android keystores with the configured
  reference names;
- Apple distribution certificates, provisioning profiles, and App Store records
  for the Manager and Viewer bundle identifiers only;
- Google Play applications and publishing service-account access for the Manager
  and Viewer package identifiers only;
- a durable Custodial Android signing key for private, direct APK installation;
- a `firebase_client_config` Codemagic group containing the reviewed Manager
  Android and iOS client configuration bytes;
- a Codemagic `PROJECT_BUILD_NUMBER` higher than the build number already
  accepted by each store.

These values are not repository data and must never be replaced with generated
test credentials. Missing or mismatched inputs stop the release before an
artifact is uploaded.

## Exit gate

Batch 0A is complete only when:

- a clean install from the single lockfile passes on exact Node/npm;
- manifest discovery, exact set equality, and hashes pass;
- two builds of the same edition and commit produce identical asset hashes;
- all three edition builds carry the exact source commit;
- invalid edition names fail instead of silently packaging Manager privileges;
- source, contract, browser, accessibility, and mobile gates pass;
- the Manager and Viewer iOS dependency graphs resolve exclusively from their
  committed locks;
- all three Android builds verify the Gradle wrapper and resolve exclusively
  through their committed strict SHA-256 dependency metadata from empty,
  per-build Gradle homes with build/task caches disabled;
- all native artifacts carry the CI build number and reviewed release version;
- every APK signature verifies, and store app-bundle and IPA signatures verify,
  before provenance is accepted;
- Manager Firebase client configuration matches the reviewed digest;
- PR checks are green on the final head;
- the merge commit is rebuilt and verified independently;
- public Pages assets match the merged manifest;
- no production database state changed.
