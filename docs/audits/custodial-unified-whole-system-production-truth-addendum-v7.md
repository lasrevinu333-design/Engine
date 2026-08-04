# Memphis Zoo Custodial Program — Production Truth Addendum v7

**Status:** SELECT-only release, validation and migration-identity reconstruction  
**Prepared:** 2026-08-04

---

## 1. Scope and safety

This addendum compares deployed release/validation ledgers, source release identity and migration histories. No deployment, migration, validation, backup, workflow, build or production state was changed or triggered.

---

## 2. Production has multiple release-identity records from different eras

The deployed `release_deployment_manifest` table contains two records, both created/deployed on July 16:

- foundation-repair release;
- manager-access-repair release.

The frozen backend source at `0fff8c2cadea132902df22c99593f1ce348411a7` instead declares:

- semantic app version `release-2026.07.19.custodial-v3.12`;
- runtime release ID derived from deployed commit/environment when available;
- frontend commit `7bc61e39a5ae2fda52c777c8a222f138ee36c5af`;
- schema fingerprint `c6742e500c2a5d3767f1d886bb5937167eab42730f8271eec76b427a10c5f302`;
- explicit API and queue-compatibility versions.

The database release-manifest table is therefore not the current complete release authority.

### Architecture consequence

Release identity must be one signed/immutable tuple that binds:

- source commits;
- frontend deployed commit/assets;
- backend deployed commit/runtime ID;
- schema/migration fingerprint;
- operational authority-set ID;
- API/queue contracts;
- APK package/version/hash/signer/native graph;
- production configuration/policy versions;
- validation and physical-admission evidence.

Older release records remain history, not current truth.

---

## 3. The release validation ledger is stale relative to later schema changes

`release_validation_runs` contains useful historical records for areas such as:

- database foundation/security/indexes;
- frontend/backend live checks;
- employee schedules;
- GPS;
- event-instance deduplication;
- manager access;
- device enforcement guard;
- Moxie;
- physical phone enrollment;
- final release gate.

The latest recorded validation is July 16. The migration audit records show database changes continued into August:

- `migration_log` latest application: August 3;
- Supabase migration ledger: 149 applied migrations, latest version `20260801195620`.

A July 14–16 `pass`, including a row named `final_release_gate`, cannot prove the correctness of the later production schema or current v3.12 application tuple.

### False-confidence risk

A validation table can remain green while:

- later migrations change functions/constraints;
- current frontend/backend commits differ;
- physical phones remain unaccepted;
- ownership/status/notification architecture remains fragmented;
- the validator's requirement is obsolete.

Every release-gate result must bind the exact release tuple and authority set it validated. Any later migration/source/config change invalidates affected gates until rerun.

---

## 4. Physical phone validation was not a clean current fleet acceptance

Historical validation records include warnings for physical phone enrollment and a Moxie authenticated-logout retest. These rows are useful evidence of incomplete historical acceptance, but they are not current Build 22/Build 23+ fleet results.

Target physical evidence must include:

- exact source/APK/release tuple;
- device/OS/Fully Kiosk configuration;
- enrollment/vault/epoch/push state;
- NFC, wake/reboot/offline/alert/GPS/Messenger/Karen matrix;
- test operator/time/logs/recordings;
- rollback result.

A generic historical `live_application_acceptance` or `final_release_gate` cannot substitute for that artifact-bound evidence.

---

## 5. Migration histories have different coverage and purposes

Production contains:

- Supabase's applied migration ledger with 149 versions spanning May through August;
- `migration_log` and `migration_log_summary` with 27 named records since July 21, 54 statements and stored SQL digests/metadata.

These are not equivalent:

- Supabase migration versions identify applied migration files/versions;
- the custom migration log appears to record a later audited subset or application path, including SQL text/summary hashes;
- neither by itself proves the deployed schema exactly matches the frozen repository's complete migration graph and generated definitions.

### Target migration identity

The release system must bind:

- ordered canonical migration manifest;
- file digests and dependency graph;
- applied versions and checksums;
- current schema fingerprint/definition audit;
- expected extension/config state;
- clean empty-database rebuild result;
- production drift comparison;
- restore result.

Custom/audit logs remain supplementary evidence, not competing schema authority.

---

## 6. Release validation rows need immutable requirement versions

A validation area name such as `employee_kiosk_schedules` or `authoritative_gps` is not sufficient proof unless the row also identifies:

- test/requirement version;
- exact source and schema tuple;
- fixture/data class;
- execution environment;
- result details and artifact links/hashes;
- whether proof is source, browser, integration, APK or physical;
- expiration/invalidation conditions.

Without that, old validations may encode obsolete behavior—such as mutable group schedules or sparse GPS status—and still appear as current passes.

---

## 7. Strong release mechanisms worth retaining

The current repositories contain legitimate mechanisms to preserve and strengthen:

- frontend/backend/schema release manifest concepts;
- API and queue-compatibility versions;
- schema fingerprints and transitions;
- migration file hashing/logging;
- clean rebuild/restore scripts;
- encrypted backup process;
- exact live release alignment checks;
- native vault/manifest/DEX/source-integrity checks;
- signer fingerprint and anti-rollback enforcement;
- producer and independent consumer admission;
- Build 22 rollback baseline.

These mechanisms must be made authoritative for one exact tuple and cannot be treated as passed merely because a similarly named earlier release passed.

---

## 8. Target validation invalidation rules

At minimum, rerun/invalidate applicable gates after any change to:

- source commit or generated asset;
- dependency/toolchain lock;
- backend/API contract;
- schema/migration/fingerprint;
- operational authority-set/domain policy;
- queue/local-state compatibility;
- APK/native plugin/manifest/permission/signer/version;
- production configuration/secret-provider capability;
- device/OS/Fully Kiosk target;
- physical NFC/tag/calibration configuration.

The release gate evaluates the complete tuple, not a component name.

---

## 9. Architecture consequence

Unified Architecture v4.1's operational authority set and release tuple are required to eliminate this fragmentation. Independent auditors should attack:

- whether one current release/authority identity can be proven end-to-end;
- whether stale validation can be mistaken as current;
- whether schema drift after validation is detected;
- whether every validation type is correctly labeled and invalidated;
- whether backup/restore and physical evidence bind the same tuple;
- whether rollback has an exact compatible target.

No production state was changed by this research.