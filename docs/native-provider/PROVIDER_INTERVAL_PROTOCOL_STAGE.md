# Provider interval protocol — conditional source, not activation

This stage implements the accepted PC01/PC02 arithmetic and transport contract. It does not qualify a physical clock, select a production profile, mount a factory, activate notifications, or change CLEANING/Start authority. Both existing production factories remain SUSPENDED. The five earlier `*_STAGE.md` documents remain byte-identical historical evidence.

## Controlling identities

- Corrected provider plan: SHA-256 `6623462ca36fb1891e8def589e7e26804f63eb3a5ff8a1f16c79a6791dbf4d8b`.
- Provider clock addendum: `25d4218373c451e0d9bfb8f64c4422883728fdd1d443b49760780571d3553982`.
- Complete PC01/PC02 conditional web verdict: `329edf8e1b354ca4d566eeab2f891a31c120acf0d0bb4c439b2c4b1bceb2fa41`.
- Isolated frontend baseline: `efe0cc3f0120e18c5e53f2c025a0ce0cfa1963cd`; companion backend baseline: `6dd8699ee374dac681bec5be61badeeea095ddb0` and forward migration `20261003150000_native_provider_interval_protocol.sql`.

## Callable contract and authority

`NativeProviderTime.Profile` is an immutable, native-only pin: exact API/OS-build/device-family identity, quantization bound, rate-error bound, maximum qualified age, and evidence SHA. No production profile is constructed. `Profiles.NONE` selects nothing. Neither a server `clock_profile_id`, WebView value, preferences value, nor a cleaning anchor can supply qualification.

`NativeProviderClockOwner.accept(Settlement)` consumes the exact authenticated register/status result, including original request nonce, raw-body digest, canonical path, native A/B readings, boot counts, original principal, engine revision and provider epoch. `observe()` rechecks current native authority and reads the encrypted generation-bound sample. `VaultEngine.recoverNativeProviderInventory(..., NativeProviderClockOwner)` is the callable inventory path: retain the actual HTTP exchange, validate the fresh nonce-bound clock independently of the frozen inventory-page timestamp, recheck the original engine request, then accept the sample and consume the page. The owner and journal identities must be the exact ones supplied to that engine. Lock order remains engine, then coordinator; HTTP is outside those monitors.

The sample stores full original recipient/generation/registration identity, profile fingerprint, exact exchange facts and native high-water marks. Same-nonce/same-facts replay reconciles a lost durable return; conflicting facts cannot replace the original. Revision/principal/generation/removal changes fence authority. A reboot or elapsed horizon marks `REFRESH_REQUIRED`; a later return to an older clock point cannot resurrect that sample. A fresh authenticated nonce with monotonic high-water evidence can refresh it. Backward counters or contradictory intervals are `FENCED`, preserving original evidence. Removal marks the owned clock record revoked/foreign without inventing an observation.

For A <= B <= N in one boot, checked signed-64 arithmetic implements outward-rounded durations with the accepted `2*q_ns` endpoint allowance and `p_ppm` rate error. The UTC interval is `S - 1us + floor(low(B,N)/1000)` through `S + 1us + ceil(high(A,N)/1000)`. Request upper duration must be strictly below 45 seconds; sample horizon is positive and at most 15 minutes; whole age cannot exceed the supplied profile; the latest bound must remain strictly before sample expiry. Every invalid, missing, mismatched or overflow case is UNKNOWN.

Presentation requires earliest >= reservation AND latest < notification expiry. Cleanup requires earliest >= the cutoff, plus the original terminal/settlement/current-owner conditions. An interval straddling a boundary grants neither effect nor deletion. A sample that has expired cannot authorize cleanup. The 15-minute sample horizon is NOT a notification business TTL.

## Exact receipt boundary and preservation

Provider event/batch/receipt schemas are v2. Observation objects have exactly `earliest_at`, `latest_at`, `clock_profile_id`, `elapsed_realtime_ms`, `boot_count`. Unknown original arrival retains null time/profile values and any actual original native counters; admission stores separate later `admission_bounds`. No backdated/synthetic arrival is created. Native -> raw-body HMAC API -> SQL -> receipt -> native validation uses these exact objects and the immutable original event ID/content/reservation. Omitted results stay pending. Local Dismiss is not server acknowledgement.

Existing encrypted journal namespace/schema is retained. New provider records carry `interval_version: 2`. Historical point records are preserved, but cannot be promoted into interval authority, presented, acknowledged as a new v2 transition, or removed by interval cleanup. There is no permissive v1 wire fallback or historical data conversion.

The sole `OfflineAuthorityTime` change is its provider adapter returning UNKNOWN plus original native counters instead of deriving a provider point from the CLEANING anchor. Every CLEANING algorithm and every engine byte outside the exact provider-inventory block is pinned against the original baseline. Start/reconciliation/removal/NFC/readiness policies are unchanged.

## Evidence and remaining gates

- API-first native suite: 303 tests passed with the final actual SQL fixture.
- Android production, all unit-test sources and instrumentation-test sources compile; 79 focused JVM tests passed. This is not an APK build or instrumentation execution.
- Actual synthetic raw-body HMAC HTTP -> SQL inventory clock response -> native validation; frozen pagination timestamp versus fresh sample, loss/replay, unknown arrival, cutoff straddles, overflow, reboot, horizon revival, profile mismatch and removal/rotation tests pass.
- Portable source guard: 49 checks with PATH empty; exact reversible byte deltas plus tracked hashes replace unpublished Git-object dependencies. Existing five guard portability checks remain enforced.

Required subsequent SOURCE work: construct the one application-context clock/registration/job/effect owner using supported dependencies; integrate all required notification kinds with exact authoritative occurrence, recipient, revision and finite validity; bind actual presentation/audio/ACK cancellation; mount the exact backend adapter and owning CI/canary after combined review. Current receipt SQL still admits the exact LOCATION reservation payload, not arbitrary kinds. Runtime qualification remains a separate mandatory prerequisite: documented defensible bounds for the exact target platform and operating envelope, reviewed/native-pinned without a remote qualification switch. No source test supplies those bounds.
