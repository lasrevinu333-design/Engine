# Native enrollment removal: capture / send / settle

Source-only continuation of OWNER_HANDOFF gate 1, based on exact frontend
`df679151ac0384fb6974c6eab2aba07a210d7b9f`. No provider factory, manifest,
Start admission, reconciliation policy, clock qualification or backend change.

`VaultEngine.removeEnrollment` now captures the original immutable snapshot and
durable REMOVAL_REQUESTED under its existing monitor. A brief device-keyed,
process-local capability prevents concurrent removal HTTP from even distinct
engine instances. An overlapping same-device attempt gets the existing
`custodial_native_vault_concurrent_change`; it does not wait holding an engine
or launch another send. Wrong pending operation/device remains a removal conflict.
A reentrant caller already holding the engine monitor is refused before writes.

The original decrypted credential is rechecked against the complete captured
snapshot before dispatch. HTTP owns neither the engine nor the flight registry
nor the provider coordinator monitor. On return, the engine monitor is reacquired;
only the complete captured snapshot or its exact computed successor tombstone
can settle. Same operation alone cannot acknowledge a changed device, revision,
credential, principal metadata or original enrollment lineage. Existing commit
readback recovers an exact write-then-failure. Captured credentials are wiped on
all normal/error paths, before settlement and again in outer cleanup; only the
original flight capability can release its registry entry.

Response loss, interruption and storage ambiguity preserve the original durable
operation. A retry after the first attempt has ended uses that operation; it
does not synthesize server success. Process restart loses only the in-memory
flight; server idempotency plus durable intent remain authoritative. This is
not cross-process coordination; current app-context ownership is single-process.
Original Activity confirmation, provider-removal fence and key finalization
remain unchanged. Finalization cannot proceed from REMOVAL_REQUESTED.

Proof entry points: `VaultRemovalTransportTest`, existing
`NativeProviderRuntimeOwnerTest` loss/retry/fence proof, Android API-first runner
`mobile/scripts/custodial-provider-storage-tests.mjs`, and
`scripts/native-removal-contract-tests.mjs`. The latter hash-pins the entire old
and new removal sections, compares every other engine byte to its exact original
baseline, exercises negative mutations and runs all five affected source guards
with PATH empty. Tracked `scripts/fixtures/native-source-baselines.json` retains
origin commit/path, raw SHA-256 and exact normalized SHA-256; no local worker Git
object is required by those guards. The five earlier documentation moves retain
their original raw SHA-256 identities.

The obsolete standalone `scripts/provider-clock-contract-tests.mjs` still refers
to its historical 208bab17 baseline; it is not one of the five migrated guards.
Its later receipt/lifecycle/readiness deltas require a separate owning update
before it can be treated as a current CI contract. This limitation is explicit,
not a false whole-suite PASS.

QP profile authority remains unsupported. Point-to-conservative-interval
consumers, full production effect/runtime construction and required additional
notification kinds remain open; both factories stay hard SUSPENDED. These local
tests are not an independent audit or closed-app delivery acceptance.
