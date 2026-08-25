import assert from 'node:assert/strict';
import {
  CUSTODIAL_NATIVE_CREDENTIAL_HANDLE,
  createNativeProtectedStorage,
} from '../src/custodial/native-security.js';
import { createCustodialCredentialStore } from '../src/custodial/credential-store.js';
import {
  CUSTODIAL_CREDENTIAL_KEY,
  CUSTODIAL_DEVICE_KEYS,
  CUSTODIAL_ENROLLMENT_OPERATION_KEY,
  CUSTODIAL_INSTALLATION_MARKER_KEY,
  CUSTODIAL_RECOVERY_RECORD_KEY,
  CUSTODIAL_REMOVAL_COMPLETION_KEY,
  CUSTODIAL_REMOVAL_OPERATION_KEY,
  CUSTODIAL_RESTORE_QUARANTINE_KEY,
} from '../src/custodial/security-keys.js';

const operationId = '12345678-1234-4123-8123-123456789abc';
const recoveryId = 'recovery-proof-1234567890';
const deviceId = 'KIOSK_09';
const seal = 'native-installation-seal-1234567890';

function storageFixture(initial = {}, failOnce = null) {
  const values = new Map(Object.entries(initial));
  const failurePlans = (Array.isArray(failOnce) ? failOnce : [failOnce])
    .filter(Boolean)
    .map((plan) => ({ ...plan, armed: true, matchingOperations: 0 }));
  const maybeFail = (operation, key, timing) => {
    for (const plan of failurePlans) {
      const plannedTiming = plan.after === true ? 'after' : 'before';
      if (!plan.armed || plan.operation !== operation || plan.key !== key || plannedTiming !== timing) continue;
      plan.matchingOperations += 1;
      if (plan.matchingOperations !== (plan.occurrence || 1)) continue;
      plan.armed = false;
      throw new Error(`injected ${operation} failure for ${key}`);
    }
  };
  const storage = {
    key(index) { return Array.from(values.keys())[index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      maybeFail('set', key, 'before');
      values.set(key, String(value));
      maybeFail('set', key, 'after');
    },
    removeItem(key) {
      maybeFail('remove', key, 'before');
      values.delete(key);
      maybeFail('remove', key, 'after');
    },
    value(key) { return values.get(key); },
  };
  Object.defineProperty(storage, 'length', { get: () => values.size });
  return storage;
}

function pendingRecoveryFixture({ flow = 'recovery', reason = 'protected_enrollment_missing' } = {}) {
  const recovery = {
    schema_version: 1,
    recovery_id: recoveryId,
    status: 'pending_manager_recovery',
    reason,
    created_at: '2026-08-01T01:00:00.000Z',
    original_device_keys: { mz_scan_device_id: deviceId },
    original_identities: [{
      device_id: deviceId,
      canonical_device_id: deviceId,
      original_values: [deviceId],
    }],
    preserved_counts: { total_pending: 2 },
  };
  const operation = {
    schema_version: 1,
    operation_id: operationId,
    flow,
    device_id: deviceId,
    recovery_id: flow === 'recovery' ? recoveryId : null,
    status: 'pending_server',
    created_at: '2026-08-01T01:05:00.000Z',
  };
  const quarantine = {
    schema_version: 1,
    recovery_id: recoveryId,
    active: true,
    reason,
    created_at: recovery.created_at,
    original_device_keys: recovery.original_device_keys,
    original_identities: recovery.original_identities,
    preserved_counts: recovery.preserved_counts,
  };
  return {
    [CUSTODIAL_RECOVERY_RECORD_KEY]: JSON.stringify(recovery),
    [CUSTODIAL_RESTORE_QUARANTINE_KEY]: JSON.stringify(quarantine),
    [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: JSON.stringify(operation),
  };
}

function pendingNativeState(flow = 'recovery') {
  return {
    schema_version: 1,
    state: 'PENDING_SERVER_CONFIRMATION',
    pending_operation_id: operationId,
    pending_device_id: deviceId,
    pending_flow: flow,
    pending_enrollment: {
      operation_id: operationId,
      device_id: deviceId,
      flow,
      credential_id: 'safe-credential-row-id',
      resume_expires_at: '2026-08-01T01:30:00.000Z',
      ...(flow === 'recovery' ? { recovery_id: recoveryId } : {}),
    },
    installation: {
      schema_version: 1,
      device_id: deviceId,
      installation_seal: seal,
      enrolled_at: '2026-08-01T01:06:00.000Z',
      enrollment_operation_id: operationId,
      migrated_from_credential_only_state: false,
    },
  };
}

function adapter(storage, flow = 'recovery') {
  return createNativeProtectedStorage({ getState: async () => pendingNativeState(flow) }, storage);
}

function stateAdapter(storage, state) {
  return createNativeProtectedStorage({ getState: async () => state }, storage);
}

const removalOperationId = 'abcdef12-3456-4789-8abc-def012345678';
const enrollmentOperationId = 'fedcba98-7654-4321-8fed-cba987654321';

function activeNativeState({
  operation = enrollmentOperationId,
  flow = 'enrollment',
  activeDevice = deviceId,
  activeSeal = seal,
} = {}) {
  return {
    schema_version: 2,
    state: 'ACTIVE',
    revision: 7,
    active: true,
    blocked: false,
    credential_present: true,
    removal_operation_id: '',
    removal_device_id: '',
    removal_pending: false,
    removal_finalized: false,
    removal_remote_complete: false,
    active_enrollment_flow: flow,
    installation: {
      schema_version: 1,
      device_id: activeDevice,
      installation_seal: activeSeal,
      enrolled_at: '2026-08-01T02:00:00.000Z',
      enrollment_operation_id: operation,
      migrated_from_credential_only_state: false,
    },
  };
}

function nativeRemovalHarness(storage, { finalizeFailure = '' } = {}) {
  let current = activeNativeState();
  let finalizeAttempts = 0;
  let remoteCalls = 0;
  const tombstone = (operation) => ({
    schema_version: 2,
    state: 'REMOVAL_TOMBSTONE',
    revision: 9,
    active: false,
    blocked: false,
    credential_present: false,
    removal_operation_id: operation,
    removal_device_id: deviceId,
    removal_pending: true,
    removal_finalized: false,
    removal_remote_complete: true,
    removal: {
      operation_id: operation,
      device_id: deviceId,
      remote_complete: true,
      finalized: false,
    },
  });
  const finalized = (operation) => ({
    schema_version: 2,
    state: 'EMPTY',
    revision: 10,
    active: false,
    blocked: false,
    credential_present: false,
    removal_operation_id: operation,
    removal_device_id: deviceId,
    removal_pending: false,
    removal_finalized: true,
    removal_remote_complete: true,
    removal: {
      operation_id: operation,
      device_id: deviceId,
      remote_complete: true,
      finalized: true,
    },
  });
  const plugin = {
    async getState() { return structuredClone(current); },
    async finalizeRemoval({ operation_id: requested }) {
      finalizeAttempts += 1;
      assert.equal(requested, removalOperationId);
      assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY) != null, true, 'terminal journal must outlive native finalization');
      assert.equal(JSON.parse(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY)).phase, 'server_logged_out');
      for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), undefined, 'local device binding must be cleared first');
      assert.equal(storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), undefined, 'local installation marker must be cleared first');
      assert.equal(storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined, 'local quarantine must be reconciled first');
      assert.equal(storage.value(CUSTODIAL_CREDENTIAL_KEY), undefined, 'plaintext compatibility credential must be cleared first');
      if (current.state === 'EMPTY') {
        assert.equal(current.removal_operation_id, requested);
        return structuredClone(current);
      }
      assert.equal(current.state, 'REMOVAL_TOMBSTONE');
      if (finalizeFailure === 'before_write' && finalizeAttempts === 1) {
        throw new Error('injected native finalize failure before write');
      }
      current = finalized(requested);
      if (finalizeFailure === 'after_write' && finalizeAttempts === 1) {
        throw new Error('injected native finalize response loss');
      }
      return structuredClone(current);
    },
  };
  return {
    plugin,
    state: () => structuredClone(current),
    finalizeAttempts: () => finalizeAttempts,
    async remoteComplete({ operationId: requested, deviceId: requestedDevice, checkpoint }) {
      remoteCalls += 1;
      assert.equal(requested, removalOperationId);
      assert.equal(requestedDevice, deviceId);
      assert.equal(current.state, 'ACTIVE');
      current = tombstone(requested);
      await checkpoint('server_logged_out');
    },
    remoteCalls: () => remoteCalls,
  };
}

function nativeRemovalLocalFixture({ recovery = false } = {}) {
  const local = {
    ...Object.fromEntries(CUSTODIAL_DEVICE_KEYS.map((key) => [key, deviceId])),
    [CUSTODIAL_INSTALLATION_MARKER_KEY]: seal,
    [CUSTODIAL_CREDENTIAL_KEY]: 'legacy-plaintext-must-be-purged',
  };
  if (!recovery) return local;
  const pending = pendingRecoveryFixture();
  delete pending[CUSTODIAL_ENROLLMENT_OPERATION_KEY];
  return { ...local, ...pending };
}

function nativeRemovalStore(plugin, storage) {
  return createCustodialCredentialStore({
    secureStorage: createNativeProtectedStorage(plugin, storage),
    storage,
    indexedDb: null,
    cryptoApi: { randomUUID: () => removalOperationId },
    now: () => '2026-08-01T02:15:00.000Z',
  });
}

function assertReconciled(storage, method) {
  for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), deviceId);
  assert.equal(storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), seal);
  const operation = JSON.parse(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY));
  assert.equal(operation.operation_id, operationId);
  assert.equal(operation.status, 'local_committed_pending_server_confirmation');
  const recovery = JSON.parse(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY));
  assert.equal(recovery.status, 'resolved');
  assert.equal(recovery.resolved_device_id, deviceId);
  assert.equal(recovery.resolution.enrollment_operation_id, operationId);
  assert.equal(recovery.resolution.method, method);
  assert.equal(storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
}

{
  const storage = storageFixture(pendingRecoveryFixture());
  await adapter(storage).reconcileLocalState();
  assertReconciled(storage, 'resumable_manager_code');
}

// Structural ACTIVE metadata is not readiness when the native credential can
// no longer be used. The adapter must withhold the opaque installation handle
// so the credential store preserves every local identity/work record and
// enters the existing manager-code recovery path.
{
  const storage = storageFixture({
    ...Object.fromEntries(CUSTODIAL_DEVICE_KEYS.map((key) => [key, deviceId])),
    [CUSTODIAL_INSTALLATION_MARKER_KEY]: seal,
  });
  const native = {
    ...activeNativeState(),
    state: 'RECOVERY_REQUIRED',
    active: false,
    credential_present: false,
    credential_usable: false,
    recovery_required: true,
    recovery_device_id: deviceId,
    recovery_reason: 'custodial_native_vault_key_missing',
  };
  const store = createCustodialCredentialStore({
    secureStorage: stateAdapter(storage, native),
    storage,
    indexedDb: null,
    cryptoApi: { randomUUID: () => recoveryId },
    now: () => '2026-08-01T02:15:00.000Z',
  });
  await assert.rejects(() => store.ensureSecurityState(), (error) => {
    assert.equal(error.code, 'custodial_restore_quarantine');
    return true;
  });
  const status = store.getStatus();
  assert.equal(status.quarantined, true);
  assert.equal(status.ready, false);
  assert.equal(status.reason, 'preserved_state_without_protected_enrollment');
  assert.equal(status.recovery.status, 'pending_manager_recovery');
  assert.deepEqual(status.recovery.original_identities.map((item) => item.canonical_device_id), [deviceId]);
  for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), deviceId);
}

// A process may die after persisting dispatch/cancellation but before retaining
// its Web Storage journal. Native operation/device/flow reconstruct exactly one
// pending-server journal so resume can receive/stabilize the native terminal
// result instead of stranding either transition.
for (const [nativePhase, failFirstWrite] of [
  ['ENROLLMENT_DISPATCHED', false],
  ['ENROLLMENT_DISPATCHED', true],
  ['CANCEL_REQUESTED', false],
  ['CANCEL_REQUESTED', true],
]) {
  const dispatched = pendingNativeState('enrollment');
  dispatched.state = nativePhase;
  if (nativePhase === 'ENROLLMENT_DISPATCHED') delete dispatched.installation;
  const storage = storageFixture({}, failFirstWrite
    ? { operation: 'set', key: CUSTODIAL_ENROLLMENT_OPERATION_KEY }
    : null);
  const dispatchedAdapter = stateAdapter(storage, dispatched);
  if (failFirstWrite) await assert.rejects(() => dispatchedAdapter.reconcileLocalState(), /injected/);
  await dispatchedAdapter.reconcileLocalState();
  const journal = JSON.parse(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY));
  assert.equal(journal.operation_id, operationId);
  assert.equal(journal.device_id, deviceId);
  assert.equal(journal.flow, 'enrollment');
  assert.equal(journal.status, 'pending_server');
}

for (const nativePhase of [
  'ENROLLMENT_REQUESTED',
  'ENROLLMENT_DISPATCHED',
  'CREDENTIAL_STAGED',
  'PENDING_SERVER_CONFIRMATION',
]) {
  const initial = pendingRecoveryFixture();
  delete initial[CUSTODIAL_ENROLLMENT_OPERATION_KEY];
  const native = pendingNativeState('recovery');
  native.state = nativePhase;
  if (['ENROLLMENT_REQUESTED', 'ENROLLMENT_DISPATCHED'].includes(nativePhase)) {
    delete native.installation;
    delete native.pending_enrollment.recovery_id;
  }
  const storage = storageFixture(initial);
  await stateAdapter(storage, native).reconcileLocalState();
  const journal = JSON.parse(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY));
  assert.equal(journal.operation_id, operationId);
  assert.equal(journal.device_id, deviceId);
  assert.equal(journal.flow, 'recovery');
  assert.equal(journal.recovery_id, recoveryId);
  assert.equal(
    journal.status,
    nativePhase === 'PENDING_SERVER_CONFIRMATION'
      ? 'local_committed_pending_server_confirmation'
      : 'pending_server',
  );
  if (nativePhase === 'PENDING_SERVER_CONFIRMATION') {
    assertReconciled(storage, 'resumable_manager_code');
  } else {
    assert.equal(JSON.parse(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY)).status, 'pending_manager_recovery');
    assert.notEqual(storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
  }
}

{
  const initial = pendingRecoveryFixture();
  delete initial[CUSTODIAL_ENROLLMENT_OPERATION_KEY];
  const native = pendingNativeState('recovery');
  native.pending_enrollment.recovery_id = 'unrelated-recovery-id';
  const storage = storageFixture(initial);
  await assert.rejects(
    () => stateAdapter(storage, native).reconcileLocalState(),
    (error) => error?.code === 'custodial_native_recovery_reconciliation_mismatch',
  );
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
}

for (const sameOperation of [true, false]) {
  const initial = pendingRecoveryFixture();
  delete initial[CUSTODIAL_ENROLLMENT_OPERATION_KEY];
  delete initial[CUSTODIAL_RESTORE_QUARANTINE_KEY];
  const recovery = JSON.parse(initial[CUSTODIAL_RECOVERY_RECORD_KEY]);
  recovery.status = 'resolved';
  recovery.resolved_device_id = deviceId;
  recovery.resolution = {
    method: 'resumable_manager_code',
    enrollment_operation_id: sameOperation
      ? operationId
      : '11111111-2222-4333-8444-555555555555',
    preserved_work_retained: true,
  };
  initial[CUSTODIAL_RECOVERY_RECORD_KEY] = JSON.stringify(recovery);
  const storage = storageFixture(initial);
  const native = pendingNativeState('recovery');
  if (sameOperation) {
    await stateAdapter(storage, native).reconcileLocalState();
    assertReconciled(storage, 'resumable_manager_code');
  } else {
    await assert.rejects(
      () => stateAdapter(storage, native).reconcileLocalState(),
      (error) => error?.code === 'custodial_native_recovery_reconciliation_mismatch',
    );
    assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
  }
}

// Every non-atomic Web Storage boundary is restart-safe because native
// PENDING_SERVER_CONFIRMATION remains authoritative until server confirmation.
for (const failure of [
  ...CUSTODIAL_DEVICE_KEYS.map((key) => ({ operation: 'set', key })),
  { operation: 'set', key: CUSTODIAL_INSTALLATION_MARKER_KEY },
  { operation: 'set', key: CUSTODIAL_ENROLLMENT_OPERATION_KEY },
  { operation: 'set', key: CUSTODIAL_RECOVERY_RECORD_KEY },
  { operation: 'remove', key: CUSTODIAL_RESTORE_QUARANTINE_KEY },
]) {
  const storage = storageFixture(pendingRecoveryFixture(), failure);
  await assert.rejects(() => adapter(storage).reconcileLocalState(), /injected/);
  await adapter(storage).reconcileLocalState();
  assertReconciled(storage, 'resumable_manager_code');
}

// A rollback failure during a new enrollment has no prior identity to recover;
// the exact native operation/device pair and matching quarantine journal prove
// the retry without inventing a second credential.
{
  const initial = pendingRecoveryFixture({
    flow: 'enrollment',
    reason: 'enrollment_commit_rollback_failed',
  });
  const recovery = JSON.parse(initial[CUSTODIAL_RECOVERY_RECORD_KEY]);
  recovery.original_device_keys = {};
  recovery.original_identities = [];
  initial[CUSTODIAL_RECOVERY_RECORD_KEY] = JSON.stringify(recovery);
  const quarantine = JSON.parse(initial[CUSTODIAL_RESTORE_QUARANTINE_KEY]);
  quarantine.original_device_keys = {};
  quarantine.original_identities = [];
  initial[CUSTODIAL_RESTORE_QUARANTINE_KEY] = JSON.stringify(quarantine);
  const storage = storageFixture(initial);
  await adapter(storage, 'enrollment').reconcileLocalState();
  assertReconciled(storage, 'resumed_enrollment_after_local_commit_failure');
}

// A mismatched recovery proof is never healed from an unrelated native device.
{
  const initial = pendingRecoveryFixture();
  const recovery = JSON.parse(initial[CUSTODIAL_RECOVERY_RECORD_KEY]);
  recovery.original_device_keys.mz_scan_device_id = 'KIOSK_08';
  recovery.original_identities[0].canonical_device_id = 'KIOSK_08';
  recovery.original_identities[0].original_values = ['KIOSK_08'];
  initial[CUSTODIAL_RECOVERY_RECORD_KEY] = JSON.stringify(recovery);
  const storage = storageFixture(initial);
  await assert.rejects(
    () => adapter(storage).reconcileLocalState(),
    (error) => error?.code === 'custodial_native_recovery_reconciliation_mismatch',
  );
  assert.notEqual(storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
}

// Native cancellation is a durable tombstone. If the process dies after the
// native commit but before the compatibility journal delete, startup retires
// only the exact uncommitted operation and never an active/local-bound one.
{
  const fixture = pendingRecoveryFixture({ flow: 'enrollment' });
  const initial = { [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: fixture[CUSTODIAL_ENROLLMENT_OPERATION_KEY] };
  const storage = storageFixture(initial);
  const cancelled = {
    schema_version: 2,
    state: 'CANCELLED',
    blocked: false,
    enrollment_terminal: true,
    cancelled_operation_id: operationId,
    cancelled_device_id: deviceId,
    cancelled_enrollment: {
      operation_id: operationId,
      device_id: deviceId,
      flow: 'enrollment',
      status: 'cancelled',
    },
  };
  await stateAdapter(storage, cancelled).reconcileLocalState();
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
  await stateAdapter(storage, cancelled).reconcileLocalState();
}

{
  const fixture = pendingRecoveryFixture({ flow: 'enrollment' });
  const initial = { [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: fixture[CUSTODIAL_ENROLLMENT_OPERATION_KEY] };
  const operation = JSON.parse(initial[CUSTODIAL_ENROLLMENT_OPERATION_KEY]);
  operation.status = 'local_committed_pending_server_confirmation';
  initial[CUSTODIAL_ENROLLMENT_OPERATION_KEY] = JSON.stringify(operation);
  const storage = storageFixture(initial);
  await assert.rejects(
    () => stateAdapter(storage, {
      schema_version: 2,
      state: 'CANCELLED',
      blocked: false,
      enrollment_terminal: true,
      cancelled_operation_id: operationId,
      cancelled_device_id: deviceId,
      cancelled_enrollment: {
        operation_id: operationId,
        device_id: deviceId,
        flow: 'enrollment',
        status: 'cancelled',
      },
    }).reconcileLocalState(),
    (error) => error?.code === 'custodial_native_cancelled_operation_mismatch',
  );
  assert.notEqual(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
}

for (const failFirstRetirement of [false, true]) {
  const storage = storageFixture({
    [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: '{malformed-cancelled-journal',
  }, failFirstRetirement
    ? { operation: 'remove', key: CUSTODIAL_ENROLLMENT_OPERATION_KEY }
    : null);
  const cancelled = {
    schema_version: 2,
    state: 'CANCELLED',
    blocked: false,
    enrollment_terminal: true,
    cancelled_operation_id: operationId,
    cancelled_device_id: deviceId,
    cancelled_enrollment: {
      operation_id: operationId,
      device_id: deviceId,
      flow: 'enrollment',
      status: 'cancelled',
    },
  };
  const cancelledAdapter = stateAdapter(storage, cancelled);
  if (failFirstRetirement) await assert.rejects(() => cancelledAdapter.reconcileLocalState(), /injected/);
  await cancelledAdapter.reconcileLocalState();
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
}

function activeEnrollmentJournal(overrides = {}) {
  return {
    schema_version: 1,
    operation_id: enrollmentOperationId,
    flow: 'enrollment',
    device_id: deviceId,
    recovery_id: null,
    status: 'pending_server',
    created_at: '2026-08-01T01:55:00.000Z',
    ...overrides,
  };
}

function assertActiveBinding(storage) {
  for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), deviceId);
  assert.equal(storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), seal);
}

// A direct same-origin Capacitor call can advance the exact native operation to
// ACTIVE before JavaScript finishes its compatibility writes. ACTIVE native
// op/device/flow is authoritative and heals the matching journal, deleting it
// last. Every Web Storage failure remains restart-safe.
for (const failure of [
  ...CUSTODIAL_DEVICE_KEYS.map((key) => ({ operation: 'set', key })),
  { operation: 'set', key: CUSTODIAL_INSTALLATION_MARKER_KEY },
  { operation: 'remove', key: CUSTODIAL_ENROLLMENT_OPERATION_KEY },
]) {
  const storage = storageFixture({
    [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: JSON.stringify(activeEnrollmentJournal()),
  }, failure);
  const native = activeNativeState();
  await assert.rejects(
    () => stateAdapter(storage, native).reconcileLocalState(),
    /injected/,
  );
  await stateAdapter(storage, native).reconcileLocalState();
  assertActiveBinding(storage);
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
}

// Deleting the local journal from another Storage realm cannot strand the
// native credential. New enrollment synthesizes only the native binding;
// recovery additionally requires and resolves the preserved recovery proof.
{
  const storage = storageFixture();
  await stateAdapter(storage, activeNativeState()).reconcileLocalState();
  assertActiveBinding(storage);
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
}

{
  const initial = pendingRecoveryFixture();
  delete initial[CUSTODIAL_ENROLLMENT_OPERATION_KEY];
  const storage = storageFixture(initial);
  await stateAdapter(storage, activeNativeState({ operation: operationId, flow: 'recovery' })).reconcileLocalState();
  assertActiveBinding(storage);
  const recovery = JSON.parse(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY));
  assert.equal(recovery.status, 'resolved');
  assert.equal(recovery.resolution.enrollment_operation_id, operationId);
  assert.equal(recovery.resolution.method, 'resumable_manager_code');
  assert.equal(storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
}

{
  const storage = storageFixture();
  await assert.rejects(
    () => stateAdapter(storage, activeNativeState({ operation: operationId, flow: 'recovery' })).reconcileLocalState(),
    (error) => error?.code === 'custodial_native_recovery_reconciliation_mismatch',
  );
  for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), undefined);
  assert.equal(storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), undefined);
}

// Recovery intent is written before the first native call. If the process dies
// in that exact window, the prior ACTIVE binding and the new local recovery
// operation legitimately differ. Preserve both only when the recovery and
// quarantine prove the same canonical phone; the native vault will perform the
// authoritative server credential check when the manager re-enters a code.
{
  const storage = storageFixture(pendingRecoveryFixture({ reason: 'server_credential_rejected' }));
  await stateAdapter(storage, activeNativeState()).reconcileLocalState();
  assertActiveBinding(storage);
  const operation = JSON.parse(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY));
  assert.equal(operation.operation_id, operationId);
  assert.equal(operation.flow, 'recovery');
  assert.equal(operation.status, 'pending_server');
  assert.equal(JSON.parse(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY)).status, 'pending_manager_recovery');
  assert.notEqual(storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
}

// If current native proof later authenticates the old credential, the recovery
// resolution retires only the never-started local operation. It never changes
// the active native binding or preserved work.
{
  const initial = pendingRecoveryFixture({ reason: 'server_credential_rejected' });
  const recovery = JSON.parse(initial[CUSTODIAL_RECOVERY_RECORD_KEY]);
  recovery.status = 'resolved';
  recovery.resolved_device_id = deviceId;
  recovery.resolution = {
    method: 'current_native_credential_revalidated',
    preserved_work_retained: true,
  };
  initial[CUSTODIAL_RECOVERY_RECORD_KEY] = JSON.stringify(recovery);
  delete initial[CUSTODIAL_RESTORE_QUARANTINE_KEY];
  const storage = storageFixture(initial);
  await stateAdapter(storage, activeNativeState()).reconcileLocalState();
  assertActiveBinding(storage);
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
}

// An unproven active/local operation mismatch remains fail closed.
{
  const initial = pendingRecoveryFixture({ reason: 'server_credential_rejected' });
  const recovery = JSON.parse(initial[CUSTODIAL_RECOVERY_RECORD_KEY]);
  recovery.original_device_keys.mz_scan_device_id = 'KIOSK_08';
  recovery.original_identities[0].canonical_device_id = 'KIOSK_08';
  recovery.original_identities[0].original_values = ['KIOSK_08'];
  initial[CUSTODIAL_RECOVERY_RECORD_KEY] = JSON.stringify(recovery);
  const storage = storageFixture(initial);
  await assert.rejects(
    () => stateAdapter(storage, activeNativeState()).reconcileLocalState(),
    (error) => error?.code === 'custodial_native_active_reconciliation_mismatch',
  );
  assert.notEqual(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
}

// A present journal must match every native authority field and allowed local
// transition state. No mismatch is healed or rebound.
for (const mismatch of [
  { operation_id: '11111111-2222-4333-8444-555555555555' },
  { device_id: 'KIOSK_08' },
  { flow: 'recovery' },
  { status: 'cancelled' },
]) {
  const storage = storageFixture({
    [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: JSON.stringify(activeEnrollmentJournal(mismatch)),
  });
  await assert.rejects(
    () => stateAdapter(storage, activeNativeState()).reconcileLocalState(),
    (error) => error?.code === 'custodial_native_active_reconciliation_mismatch',
  );
  for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), undefined);
  assert.equal(storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), undefined);
}

for (const failFirstRetirement of [false, true]) {
  const storage = storageFixture({
    [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: '{malformed-journal',
  }, failFirstRetirement
    ? { operation: 'remove', key: CUSTODIAL_ENROLLMENT_OPERATION_KEY }
    : null);
  const native = activeNativeState();
  const activeAdapter = stateAdapter(storage, native);
  if (failFirstRetirement) await assert.rejects(() => activeAdapter.reconcileLocalState(), /injected/);
  await activeAdapter.reconcileLocalState();
  assertActiveBinding(storage);
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
}

// Beginning a new native enrollment retires the prior removal completion ack;
// it cannot suppress or conflict with the new active binding.
{
  const storage = storageFixture({
    [CUSTODIAL_REMOVAL_COMPLETION_KEY]: JSON.stringify({
      schema_version: 1,
      operation_id: removalOperationId,
      device_id: deviceId,
      status: 'local_cleanup_complete',
      completed_at: '2026-08-01T01:00:00.000Z',
    }),
  });
  await stateAdapter(storage, activeNativeState()).reconcileLocalState();
  assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
  assertActiveBinding(storage);
}

// Server revocation is the point of no return. At every subsequent local
// boundary, process death or an injected write failure leaves either the native
// REMOVAL_TOMBSTONE or its exact finalized EMPTY proof plus the server_logged_out
// journal. A fresh store resumes without another backend call or credential.
for (const failJournalRetirement of [false, true]) {
  const storage = storageFixture({
    ...nativeRemovalLocalFixture(),
    [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: JSON.stringify(activeEnrollmentJournal()),
  }, failJournalRetirement
    ? { operation: 'remove', key: CUSTODIAL_ENROLLMENT_OPERATION_KEY }
    : null);
  const native = nativeRemovalHarness(storage);
  // Model direct same-origin completeLocalBinding + confirmEnrollment followed
  // by the separately confirmed native removal call before JavaScript cleanup.
  await native.remoteComplete({ operationId: removalOperationId, deviceId, checkpoint: async () => {} });
  const adapter = createNativeProtectedStorage(native.plugin, storage);
  if (failJournalRetirement) {
    await assert.rejects(() => adapter.reconcileLocalState(), /injected/);
    assert.notEqual(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
  }
  await adapter.reconcileLocalState();
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
  assert.equal(JSON.parse(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY)).phase, 'server_logged_out');
  const restarted = createCustodialCredentialStore({
    secureStorage: adapter,
    storage,
    indexedDb: null,
    cryptoApi: { randomUUID: () => removalOperationId },
  });
  await restarted.removeEnrollment({ beforeRemove: async () => assert.fail('revoked backend removal must not replay') });
  assert.equal(native.state().state, 'EMPTY');
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);
}

for (const mismatch of [
  { device_id: 'KIOSK_08' },
  { status: 'cancelled' },
  { flow: 'manager' },
]) {
  const storage = storageFixture({
    ...nativeRemovalLocalFixture(),
    [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: JSON.stringify(activeEnrollmentJournal(mismatch)),
  });
  const native = nativeRemovalHarness(storage);
  await native.remoteComplete({ operationId: removalOperationId, deviceId, checkpoint: async () => {} });
  await createNativeProtectedStorage(native.plugin, storage).reconcileLocalState();
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
  assert.equal(JSON.parse(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY)).phase, 'server_logged_out');
}

{
  const storage = storageFixture({
    ...nativeRemovalLocalFixture(),
    [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: '{malformed-superseded-enrollment',
  });
  const native = nativeRemovalHarness(storage);
  await native.remoteComplete({ operationId: removalOperationId, deviceId, checkpoint: async () => {} });
  await createNativeProtectedStorage(native.plugin, storage).reconcileLocalState();
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
  assert.equal(JSON.parse(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY)).operation_id, removalOperationId);
}

for (const failure of [
  { operation: 'set', key: CUSTODIAL_REMOVAL_OPERATION_KEY, occurrence: 2, label: 'server checkpoint' },
  ...CUSTODIAL_DEVICE_KEYS.map((key) => ({ operation: 'remove', key, label: `identity ${key}` })),
  { operation: 'remove', key: CUSTODIAL_INSTALLATION_MARKER_KEY, label: 'installation marker' },
  { operation: 'set', key: CUSTODIAL_REMOVAL_COMPLETION_KEY, label: 'completion acknowledgement' },
  { operation: 'remove', key: CUSTODIAL_REMOVAL_OPERATION_KEY, label: 'terminal journal delete' },
  { operation: 'remove', key: CUSTODIAL_CREDENTIAL_KEY, label: 'plaintext cleanup' },
]) {
  const storage = storageFixture(nativeRemovalLocalFixture(), failure);
  const native = nativeRemovalHarness(storage);
  const first = nativeRemovalStore(native.plugin, storage);
  await assert.rejects(
    () => first.removeEnrollment({ beforeRemove: native.remoteComplete }),
    (error) => /injected/.test(String(error?.cause?.message || error?.message || '')),
    failure.label,
  );
  assert.equal(native.remoteCalls(), 1, `${failure.label}: backend removal must happen once`);
  assert.notEqual(native.state().state, 'ACTIVE', `${failure.label}: revoked native credential must never be restored`);
  assert.ok(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), `${failure.label}: exact journal must remain restartable`);

  const restarted = nativeRemovalStore(native.plugin, storage);
  await restarted.removeEnrollment({
    beforeRemove: async () => assert.fail(`${failure.label}: restart must not call the backend again`),
  });
  assert.equal(native.state().state, 'EMPTY');
  assert.equal(native.state().removal_operation_id, removalOperationId);
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);
  const completion = JSON.parse(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY));
  assert.equal(completion.operation_id, removalOperationId);
  assert.equal(completion.device_id, deviceId);
  assert.equal(completion.status, 'local_cleanup_complete');
  assert.equal(storage.value(CUSTODIAL_CREDENTIAL_KEY), undefined);
  for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), undefined);
  assert.equal(storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), undefined);
}

// Recovery/quarantine reconciliation also completes before the native key is
// destroyed. Failures at either boundary replay to one resolved recovery row.
for (const failure of [
  { operation: 'set', key: CUSTODIAL_RECOVERY_RECORD_KEY, label: 'recovery resolution' },
  { operation: 'remove', key: CUSTODIAL_RESTORE_QUARANTINE_KEY, label: 'quarantine retirement' },
]) {
  const storage = storageFixture(nativeRemovalLocalFixture({ recovery: true }), failure);
  const native = nativeRemovalHarness(storage);
  const first = nativeRemovalStore(native.plugin, storage);
  await assert.rejects(
    () => first.removeEnrollment({ beforeRemove: native.remoteComplete }),
    (error) => /injected/.test(String(error?.cause?.message || error?.message || '')),
    failure.label,
  );
  assert.equal(native.state().state, 'REMOVAL_TOMBSTONE');
  const restarted = nativeRemovalStore(native.plugin, storage);
  await restarted.removeEnrollment({ beforeRemove: async () => assert.fail('backend replay refused') });
  const resolved = JSON.parse(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY));
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.resolution.method, 'explicit_enrollment_removal');
  assert.equal(storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
  assert.equal(native.state().state, 'EMPTY');
}

// Native finalization itself is restart-safe both before the atomic write and
// after the write when the JavaScript caller loses the response.
for (const finalizeFailure of ['before_write', 'after_write']) {
  const storage = storageFixture(nativeRemovalLocalFixture());
  const native = nativeRemovalHarness(storage, { finalizeFailure });
  const first = nativeRemovalStore(native.plugin, storage);
  await assert.rejects(
    () => first.removeEnrollment({ beforeRemove: native.remoteComplete }),
    (error) => /injected native/.test(String(error?.cause?.message || error?.message || '')),
  );
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY) != null, true);
  assert.equal(native.state().state, finalizeFailure === 'before_write' ? 'REMOVAL_TOMBSTONE' : 'EMPTY');
  const restarted = nativeRemovalStore(native.plugin, storage);
  await restarted.removeEnrollment({ beforeRemove: async () => assert.fail('backend replay refused') });
  assert.equal(native.state().state, 'EMPTY');
  assert.equal(native.finalizeAttempts(), 2);
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);
}

// If journal deletion and its rollback restoration both fail after exact native
// finalization, the missing local proof is reconstructed once from native EMPTY.
// No credential or active binding is ever recreated.
{
  const storage = storageFixture(nativeRemovalLocalFixture(), [
    { operation: 'remove', key: CUSTODIAL_REMOVAL_OPERATION_KEY, occurrence: 1, after: true },
    { operation: 'set', key: CUSTODIAL_REMOVAL_OPERATION_KEY, occurrence: 3 },
  ]);
  const native = nativeRemovalHarness(storage);
  const first = nativeRemovalStore(native.plugin, storage);
  await assert.rejects(
    () => first.removeEnrollment({ beforeRemove: native.remoteComplete }),
    (error) => error?.code === 'custodial_restore_quarantine'
      && error?.reason === 'enrollment_removal_rollback_failed',
  );
  assert.equal(native.state().state, 'EMPTY');
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);
  assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
  const restarted = nativeRemovalStore(native.plugin, storage);
  await restarted.removeEnrollment({ beforeRemove: async () => assert.fail('backend replay refused') });
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);
  assert.equal(JSON.parse(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY)).operation_id, removalOperationId);
  assert.equal(native.state().credential_present, false);
  for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), undefined);
}

// Process death after the completion acknowledgement but before journal delete
// is an exact, idempotent terminal replay. A later normal boot sees the ack and
// does not recreate removal work.
{
  const storage = storageFixture(nativeRemovalLocalFixture());
  const native = nativeRemovalHarness(storage);
  storage.setItem(CUSTODIAL_REMOVAL_OPERATION_KEY, JSON.stringify({
    schema_version: 1,
    operation_id: removalOperationId,
    device_id: deviceId,
    phase: 'server_logged_out',
    created_at: '2026-08-01T02:10:00.000Z',
    updated_at: '2026-08-01T02:10:00.000Z',
  }));
  await native.remoteComplete({ operationId: removalOperationId, deviceId, checkpoint: async () => {} });
  for (const key of CUSTODIAL_DEVICE_KEYS) storage.removeItem(key);
  storage.removeItem(CUSTODIAL_INSTALLATION_MARKER_KEY);
  storage.removeItem(CUSTODIAL_CREDENTIAL_KEY);
  await native.plugin.finalizeRemoval({ operation_id: removalOperationId });
  storage.setItem(CUSTODIAL_REMOVAL_COMPLETION_KEY, JSON.stringify({
    schema_version: 1,
    operation_id: removalOperationId,
    device_id: deviceId,
    status: 'local_cleanup_complete',
    completed_at: '2026-08-01T02:20:00.000Z',
  }));
  const restarted = nativeRemovalStore(native.plugin, storage);
  await restarted.removeEnrollment({ beforeRemove: async () => assert.fail('backend replay refused') });
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);
  await createNativeProtectedStorage(native.plugin, storage).reconcileLocalState();
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined, 'completed boot must not recreate removal work');
}

// A finalized native proof may retire only its exact server terminal journal.
{
  const wrong = {
    schema_version: 1,
    operation_id: '11111111-2222-4333-8444-555555555555',
    device_id: deviceId,
    phase: 'server_logged_out',
  };
  const storage = storageFixture({
    ...nativeRemovalLocalFixture(),
    [CUSTODIAL_REMOVAL_OPERATION_KEY]: JSON.stringify(wrong),
  });
  const finalized = nativeRemovalHarness(storage);
  await finalized.remoteComplete({
    operationId: removalOperationId,
    deviceId,
    checkpoint: async () => {},
  });
  // Finalize directly only to construct the process-death proof under test.
  for (const key of CUSTODIAL_DEVICE_KEYS) storage.removeItem(key);
  storage.removeItem(CUSTODIAL_INSTALLATION_MARKER_KEY);
  storage.removeItem(CUSTODIAL_CREDENTIAL_KEY);
  storage.setItem(CUSTODIAL_REMOVAL_OPERATION_KEY, JSON.stringify({ ...wrong, operation_id: removalOperationId }));
  await finalized.plugin.finalizeRemoval({ operation_id: removalOperationId });
  storage.setItem(CUSTODIAL_REMOVAL_OPERATION_KEY, JSON.stringify(wrong));
  await assert.rejects(
    () => createNativeProtectedStorage(finalized.plugin, storage).reconcileLocalState(),
    (error) => error?.code === 'custodial_native_removal_reconciliation_mismatch',
  );
}

// A completion acknowledgement without its journal must exactly match native
// finalized proof; malformed or unrelated acknowledgements never suppress
// interrupted-removal reconstruction.
for (const completion of [
  {
    schema_version: 1,
    operation_id: '11111111-2222-4333-8444-555555555555',
    device_id: deviceId,
    status: 'local_cleanup_complete',
    completed_at: '2026-08-01T02:20:00.000Z',
  },
  {
    schema_version: 1,
    operation_id: removalOperationId,
    device_id: deviceId,
    status: 'not-complete',
    completed_at: '2026-08-01T02:20:00.000Z',
  },
]) {
  const storage = storageFixture({ [CUSTODIAL_REMOVAL_COMPLETION_KEY]: JSON.stringify(completion) });
  const native = nativeRemovalHarness(storage);
  await native.remoteComplete({ operationId: removalOperationId, deviceId, checkpoint: async () => {} });
  // The direct harness finalizer asserts local cleanup, which this isolated
  // fixture already satisfies.
  storage.setItem(CUSTODIAL_REMOVAL_OPERATION_KEY, JSON.stringify({
    schema_version: 1,
    operation_id: removalOperationId,
    device_id: deviceId,
    phase: 'server_logged_out',
  }));
  await native.plugin.finalizeRemoval({ operation_id: removalOperationId });
  storage.removeItem(CUSTODIAL_REMOVAL_OPERATION_KEY);
  const completionAdapter = createNativeProtectedStorage(native.plugin, storage);
  if (completion.status === 'local_cleanup_complete') {
    await assert.rejects(
      () => completionAdapter.reconcileLocalState(),
      (error) => error?.code === 'custodial_native_removal_completion_mismatch',
    );
  } else {
    await completionAdapter.reconcileLocalState();
    assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
    assert.equal(JSON.parse(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY)).operation_id, removalOperationId);
  }
}

console.log('CUSTODIAL_NATIVE_RECONCILIATION_PASS');
