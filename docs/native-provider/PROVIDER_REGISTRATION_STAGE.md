# Guarded native provider registration stage — 2026-10-02

Implementation source only. Both native runtime factories still return hard `SUSPENDED`, and `CustodialProviderMessagingService` is deliberately absent from the manifest. No production coordinator is constructed, token read is invoked, registration is sent, clock is qualified, notification is displayed, or delivery is claimed by this change. Do not activate this stage with a feature flag.

Based on integrated frontend `47f8948f520dd8687805c81a1a59b776d477a14d`; independent implementation owner `/root/native_provider`, release owner `/root`. NFC core, signing, backend, old program, release-scope flags and phone state are outside this change.

## Native ownership and data path

The eventual admitted native owner must create exactly one shared coordinator per process using the same engine, full native principal journals, provider store and provider coordinator monitor. Lock order is engine then provider, matching the existing engine. Network I/O runs outside both locks. This stage does not provide that admission/construction owner.

- `CustodialProviderMessagingService` obtains sender from `RemoteMessage.getFrom()`, configured project from installed `FirebaseApp` options, and actual notification-object presence. `NativeProviderFirebaseDispatch` requires the existing exact data-only protected envelope. Protected malformed, foreign or suspended input never falls through to the compatibility plugin. Unrelated traffic retains the installed plugin callback.
- `onNewToken` commits the opaque native token to the encrypted journal before scheduling or legacy forwarding. Failed or ambiguous local readback cannot report callback success. Durable token capture is not provider acceptance.
- `AndroidProviderTokenSource` reads `FirebaseMessaging.getToken()` only on the already-owned bounded worker, with the current attempt's remaining timeout and post-read cancellation check. It creates no executor, JS callback, permission dialog or activity. The underlying SDK task may finish after timeout; no late callback can mutate the journal.
- A native token-read lease captures engine revision, full principal, provider invalidation epoch and capture sequence. Only its exact owner may complete it once. Replacement callback, reassignment, removal, unavailable/available round trip, abandonment or successor read prevents stale completion. This is local callback fencing, not identity authority.
- `NativeProviderRegistrationCoordinator.register` resolves the journal's original pending operation before preparing a newer token. Existing `VaultEngine.registerNativeProvider` signs the exact raw typed body; its private register/status route and native credential remain unavailable through the generic JS bridge. The engine validates native revision, original principal, journal epoch and exact response before durable confirmation. Status-only is internal recovery, not a WebView choice.
- A coordinator-local busy lease prevents duplicate concurrent registration. Retry, timeout and process reconstruction preserve the persisted original operation. Actual native removal observed during the network attempt fences retained records instead of reassigning them.
- Ingress at this stage requires an observation with **unknown authenticated time** and only quarantines valid payloads. Supplying an authenticated instant is rejected as `custodial_provider_clock_not_admitted`. There is no RECEIVED/PRESENTED/ACKNOWLEDGED, inventory settlement, notification display, boot wakeup, or in-app presentation implementation in this stage.

The only journal change is the read-only token cursor. The component/source contract tests retain exact byte comparisons for the original engine, clock, NFC, bridge and other unaffected owners, and compare the full journal after stripping that exact addition.

## Requirement trace and remaining gates

| Requirement / accepted design boundary | Owning source | Evidence | Remaining gate |
| --- | --- | --- | --- |
| Native token observation precedes forwarding, original encrypted operation survives retries | `NativeProviderFirebaseDispatch`, `NativeProviderRegistrationCoordinator`, existing journal | Dispatcher ordering/failure tests; actual encrypted ambiguous-write retry; original-token/status reconstruction test | Single production owner construction; real Firebase token/configuration acceptance |
| Raw exact authenticated transport; original actor and native identity only | Coordinator → existing `VaultEngine` → existing `NativeProviderHttp` | Both v1/v2 native principals; exact raw-body attestation; concurrent request/removal/reassignment tests | Current backend contract/independent changed-input review and bounded live service evidence |
| Native SDK sender, strict data-only protected ingress, no legacy fallback | SDK service + dispatcher + existing payload parser | SDK source compilation; sender/notification/malformed/suspension tests | Replace **both** old MESSAGING_EVENT handlers atomically, prove exact merged/compiled manifest and one handler |
| H01 encrypted namespace and original work preservation | Existing store/cipher/journal; read-only cursor addition | Full regression suite; no cleaning runtime provider-store/key construction | Production removal/finalization and crash/keystore instrumentation |
| PC01/PC02 conservative clock; no fabricated receipt | Coordinator rejects authenticated ingress time; production hard suspension | Unknown-clock quarantine creates no inbox/event; qualified-clock-claim negative | QP-01 source qualification or separately accepted correction; complete native/wire/backend/SQL interval migration |
| OC24-15 exclusive employee interface | No Activity/URL/permission/Lock Task changes; existing private component adapters | Source isolation and manifest contracts | Inside-app actual PRESENTED evidence, pending-action/native-claim drain, removal cleanup and locked-runtime acceptance |
| Complete-system messages/events/feedback/Memphis integration | Parent release-shell/module owners, not this worker | Parent reported release scope still disables/stubs these modules | Reconcile authoritative current master and later corrections; independent module/shell closure; do not infer enabled scope from incoming FCM |

## Accepted-plan provenance retained

These are accepted **plan/review** identities, not current runtime passes. Authoritative files reside under the release owner's `work/autonomous-repair-20260923/` directory:

- `PROVIDER_DURABLE_DELIVERY_CORRECTED_PLAN.md`: SHA-256 `6623462ca36fb1891e8def589e7e26804f63eb3a5ff8a1f16c79a6791dbf4d8b`.
- `PROVIDER_CLOCK_AUTHORITY_ADDENDUM.md`: SHA-256 `25d4218373c451e0d9bfb8f64c4422883728fdd1d443b49760780571d3553982`.
- `PROVIDER_H01_WEB_PASS_FULL.txt`: SHA-256 `6581d17e18fc32c71b2d4716f355ab2a61a98bfcc4ca9ec85b73ce9d6e1d9c82`; PLAN-only PASS.
- `PROVIDER_CLOCK_PC01_PC02_WEB_PASS_FULL.md`: SHA-256 `329edf8e1b354ca4d566eeab2f891a31c120acf0d0bb4c439b2c4b1bceb2fa41`; conditional PLAN PASS retaining NO PRODUCTION CLOCK AUTHORITY.

Master trace is explicitly **INCOMPLETE** pending full Rev5/Library-v4 artifacts, five appendices, exact domain JSON and 413-record archive, plus later owner corrections. The parent retrieval worker owns that recovery. This stage does not resolve contradictions, substitute recovered Rev2, or freeze an all-level audit packet.

## Reproduction and evidence limits

Run `mobile/scripts/custodial-provider-storage-tests.mjs` with locally installed JUnit/Hamcrest/JSON/Android API JAR paths, followed by `scripts/provider-registration-contract-tests.mjs`, `scripts/provider-component-contract-tests.mjs`, and `scripts/cleaning-provider-isolation-tests.mjs`. Actual SDK/library compilation and focused Gradle unit tests must use worker-isolated output directories for **all** projects including shared Capacitor/Firebase dependencies; use offline dependency resolution and no signing/assembly/installation.

The source stage is not READY, FINISHED or COMPLETE. Final full-system review belongs to a fresh independent parent-created reviewer only after the complete exact candidate and evidence are frozen.
