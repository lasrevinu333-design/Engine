import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createProtectedFeedbackIdentity} from '../src/custodial/protected-principal.js';
import {createFeedbackOutbox} from '../src/custodial/feedback-outbox.js';
import {createSyntheticScheduleLocks} from '../../scripts/synthetic-schedule-locks.mjs';
import {createProtectedBrowserAdmission} from '../src/custodial/protected-browser-admission.js';
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
  CUSTODIAL_INSTALLATION_RECORD_KEY,
  CUSTODIAL_INSTALLATION_SEAL_KEY,
  CUSTODIAL_RECOVERY_RECORD_KEY,
  CUSTODIAL_REMOVAL_COMPLETION_KEY,
  CUSTODIAL_REMOVAL_OPERATION_KEY,
  CUSTODIAL_RESTORE_QUARANTINE_KEY,
} from '../src/custodial/security-keys.js';

const operationId = '12345678-1234-4123-8123-123456789abc';
const recoveryId = 'recovery-proof-1234567890';
const deviceId = 'KIOSK_09';
const seal = 'native-installation-seal-1234567890';

if(process.argv.includes('--feedback-original-fifo-only')){
  const id=n=>`81000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
    credential_operation_id:id(3),assignment_epoch:4,installation_seal:seal,enrolled_at:'2026-10-12T12:00:00Z'};
  const local=storageFixture({...Object.fromEntries(CUSTODIAL_DEVICE_KEYS.map(k=>[k,principal.device_id])),[CUSTODIAL_INSTALLATION_MARKER_KEY]:seal});
  const record=JSON.stringify({schema_version:1,credential:'synthetic-not-native-token',device_id:principal.device_id,
    installation_seal:seal,enrolled_at:principal.enrolled_at,principal,migrated_from_credential_only_state:false});
  const secure={async get(key){return key===CUSTODIAL_INSTALLATION_RECORD_KEY?record:null;},async set(){throw Error('Unexpected fixture protected write');},async remove(){throw Error('Unexpected fixture protected remove');}};
  const db={databases:async()=>[],open(){throw Error('No fixture database should be created');}};
  const gate=createProtectedBrowserAdmission({storage:local,indexedDb:db,locks:createSyntheticScheduleLocks(),cryptoApi:webcrypto});
  const owner=createCustodialCredentialStore({storage:local,secureStorage:secure,indexedDb:db,cryptoApi:webcrypto,
    protectedWorkAdmission:work=>gate.mutate(work),protectedWorkCheckpoint:()=>gate.requireAdmission()});
  await owner.ensureSecurityState();assert.equal(owner.getStatus().ready,true);assert.deepEqual(owner.getStatus().principal,principal);
  let ensureCalls=0,refreshCalls=0,requests=0;
  const facade={getStatus:owner.getStatus,ensureSecurityState:async()=>{ensureCalls++;return owner.ensureSecurityState();}};
  const identity=createProtectedFeedbackIdentity({ready:()=>Promise.resolve(),security:facade,currentDeviceId:()=>principal.device_id,
    online:()=>true,refreshStatus:async()=>{refreshCalls++;throw Error('No identity refresh for existing principal');}});
  const outbox=createFeedbackOutbox({storage:local,mutate:owner.runWhenReady,identity,online:()=>true,
    request:async(_path,options)=>{requests++;assert.equal(options.expectedGeneration,owner.getStatus().generation);throw Error('Synthetic unknown transport; original must remain');}});
  let timer;const bounded=work=>Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Actual protected FIFO deadlock')),1500);})]).finally(()=>clearTimeout(timer));
  const body={operation_id:id(4),message:'original source-only fixture feedback',category:'other',priority:'normal'};
  await bounded(outbox.save(body));const pending=await bounded(outbox.readPending());assert.equal(pending.state,'pending');
  assert.equal(pending.body.expected_employee_id,principal.employee_id);assert.equal(pending.body.expected_credential_id,principal.credential_id);
  assert.equal(pending.body.expected_assignment_epoch,'4');assert.equal(ensureCalls,0);assert.equal(refreshCalls,0);
  assert.deepEqual(await bounded(outbox.flush()),[]);assert.equal(requests,1);assert.equal((await bounded(outbox.readPending())).body.operation_id,body.operation_id);
  console.log('NEW actual credential-store/browser FIFO -> protected identity -> Feedback save/pending/unknown transport join PASS; synthetic enrollment/store, no SQL/native/phone acceptance');
  process.exit(0);
}

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
    async withoutInjectedFailures(operation) {
      const prior=failurePlans.map(plan=>({armed:plan.armed,matchingOperations:plan.matchingOperations}));
      failurePlans.forEach(plan=>{plan.armed=false;});
      try{return await operation();}finally{failurePlans.forEach((plan,index)=>Object.assign(plan,prior[index]));}
    },
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

async function assertUnknownEnrollmentPreserved(adapter, storage) {
  const snapshot=()=>Array.from({length:storage.length},(_,index)=>storage.key(index)).sort()
    .map(key=>[key,storage.getItem(key)]);
  const original=snapshot();
  await assert.rejects(()=>adapter.reconcileLocalState(),{code:'custodial_native_invalid_record'});
  assert.deepEqual(snapshot(),original,'unknown original bytes cannot authorize any cleanup or identity replacement');
}

function stateAdapter(storage, state) {
  return createNativeProtectedStorage({ getState: async () => state }, storage);
}

const removalOperationId = 'abcdef12-3456-4789-8abc-def012345678';
const enrollmentOperationId = 'fedcba98-7654-4321-8fed-cba987654321';

if (process.argv.includes('--quarantine-removal-contract-only')) {
  await quarantineRemovalContractCases();
  process.exit(0);
}

if (process.argv.includes('--enrollment-original-rollback-only')) {
  const flow = process.argv.includes('--recovery-original-only') ? 'recovery' : 'enrollment';
  const initial = pendingRecoveryFixture({ flow });
  if (flow === 'enrollment') {
    delete initial[CUSTODIAL_RECOVERY_RECORD_KEY];
    delete initial[CUSTODIAL_RESTORE_QUARANTINE_KEY];
  }
  const storage = storageFixture(initial);
  let current = { ...pendingNativeState(flow), state: 'CREDENTIAL_STAGED' };
  let enter, finish;
  const entered = new Promise(resolve => { enter = resolve; });
  const wait = new Promise(resolve => { finish = resolve; });
  let completeCalls = 0;
  const plugin = {
    async getState() { return structuredClone(current); },
    async completeLocalBinding(input) {
      assert.equal(input.operation_id, operationId);
      completeCalls++;
      current = pendingNativeState(flow); // Source fixture models accepted native binding before lost reply.
      enter();
      await wait;
      throw Error('Synthetic lost binding reply');
    },
  };
  const owner = createCustodialCredentialStore({
    storage, secureStorage: createNativeProtectedStorage(plugin, storage), cryptoApi: webcrypto,
    indexedDb: { databases: async () => [], open() { throw Error('No fixture database creation'); } },
    now: () => new Date('2026-08-01T01:07:00.000Z'),
  });
  const work = owner.commitEnrollmentOperation({ operationId, deviceId,
    credential: CUSTODIAL_NATIVE_CREDENTIAL_HANDLE });
  await entered;
  const replacement = '{foreign original enrollment journal, retained exactly';
  storage.setItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY, replacement);
  finish();
  await assert.rejects(work);
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), replacement);
  assert.equal(completeCalls, 1);
  assert.equal(current.state, 'PENDING_SERVER_CONFIRMATION');
  assert.equal(current.installation.enrollment_operation_id, operationId);
  assert.equal(owner.getStatus().ready, false);
  assert.equal(storage.value(CUSTODIAL_CREDENTIAL_KEY), undefined);
  console.log(`NEW ${flow} actual caller preserves foreign original after lost native binding reply; synthetic source callback only`);
  process.exit(0);
}

if (process.argv.includes('--enrollment-new-cases-only')) {
  const keys = [...CUSTODIAL_DEVICE_KEYS, CUSTODIAL_INSTALLATION_MARKER_KEY,
    CUSTODIAL_ENROLLMENT_OPERATION_KEY, CUSTODIAL_RECOVERY_RECORD_KEY,
    CUSTODIAL_RESTORE_QUARANTINE_KEY, CUSTODIAL_CREDENTIAL_KEY];
  const snapshot = storage => Object.fromEntries(keys.map(key => [key, storage.getItem(key)]));
  const make = ({ flow = 'enrollment', failure = null, onComplete = null,
    onRead = null, onRemove = null, onInspect = null } = {}) => {
    const initial = pendingRecoveryFixture({ flow });
    if (flow === 'enrollment') {
      delete initial[CUSTODIAL_RECOVERY_RECORD_KEY];
      delete initial[CUSTODIAL_RESTORE_QUARANTINE_KEY];
    }
    const storage = storageFixture(initial, failure);
    let current = { ...pendingNativeState(flow), state: 'CREDENTIAL_STAGED' };
    const evidence = { calls: 0, before: null };
    const plugin = {
      async getState() {
        if (current.state === 'PENDING_SERVER_CONFIRMATION' && onRead) await onRead(storage);
        return structuredClone(current);
      },
      async completeLocalBinding(input) {
        assert.equal(input.operation_id, operationId);
        evidence.calls++;
        evidence.before = snapshot(storage);
        current = pendingNativeState(flow);
        if (onComplete) await onComplete(storage);
        return structuredClone(current);
      },
    };
    const native = createNativeProtectedStorage(plugin, storage);
    const secure = { ...native, async remove(key) {
      if (onRemove) await onRemove(storage, key);
      return native.remove(key);
    } };
    const owner = createCustodialCredentialStore({ storage, secureStorage: secure, cryptoApi: webcrypto,
      indexedDb: { databases: async () => { if (onInspect) await onInspect(storage); return []; },
        open() { throw Error('No fixture database creation'); } },
      now: () => new Date('2026-08-01T01:07:00.000Z') });
    return { storage, owner, evidence, state: () => current,
      commit: () => owner.commitEnrollmentOperation({ operationId, deviceId,
        credential: CUSTODIAL_NATIVE_CREDENTIAL_HANDLE }) };
  };
  const cases = {
    async normalEnrollmentAndRecovery() {
      for (const flow of ['enrollment', 'recovery']) {
        const x = make({ flow });
        const result = await x.commit();
        assert.equal(result.operationId, operationId);
        assert.equal(x.evidence.calls, 1);
        assert.equal(x.owner.getStatus().ready, true);
        for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(x.storage.value(key), deviceId);
        assert.equal(x.storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), seal);
        const journal = JSON.parse(x.storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY));
        assert.equal(journal.status, 'local_committed_pending_server_confirmation');
        assert.equal(journal.operation_id, operationId);
        assert.equal(journal.device_id, deviceId);
        assert.equal(x.storage.value(CUSTODIAL_CREDENTIAL_KEY), undefined);
        if (flow === 'recovery') {
          assert.equal(JSON.parse(x.storage.value(CUSTODIAL_RECOVERY_RECORD_KEY)).status, 'resolved');
          assert.equal(x.storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
        }
      }
    },
    async partialOwnWrites() {
      for (const [operation, key, occurrence] of [
        ['set', CUSTODIAL_DEVICE_KEYS[1], 1],
        ['set', CUSTODIAL_INSTALLATION_MARKER_KEY, 1],
        ['set', CUSTODIAL_RECOVERY_RECORD_KEY, 1],
        ['set', CUSTODIAL_ENROLLMENT_OPERATION_KEY, 2],
        ['remove', CUSTODIAL_RESTORE_QUARANTINE_KEY, 1],
      ]) for (const after of [false, true]) {
        const x = make({ flow: 'recovery', failure: { operation, key, occurrence, after } });
        await assert.rejects(x.commit());
        assert.deepEqual(snapshot(x.storage), x.evidence.before);
        assert.equal(x.state().state, 'PENDING_SERVER_CONFIRMATION');
        assert.equal(x.evidence.calls, 1);
        assert.equal(x.owner.getStatus().ready, false);
      }
    },
    async authoritativeReadReplacement() {
      const foreign = '{different original operation after protected read';
      const x = make({ onRead: async storage => { storage.setItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY, foreign); } });
      await assert.rejects(x.commit());
      assert.equal(x.storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), foreign);
      assert.equal(x.storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), undefined);
      assert.equal(x.evidence.calls, 1);
    },
    async partialReentrantReplacement() {
      const x = make({ flow: 'recovery' });
      const set = x.storage.setItem;
      const foreign = '{foreign pending recovery after own checkpoint';
      x.storage.setItem = (key, value) => {
        set(key, value);
        if (key === CUSTODIAL_INSTALLATION_MARKER_KEY) set(CUSTODIAL_RECOVERY_RECORD_KEY, foreign);
      };
      await assert.rejects(x.commit());
      assert.equal(x.storage.value(CUSTODIAL_RECOVERY_RECORD_KEY), foreign);
      assert.equal(x.storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), x.evidence.before[CUSTODIAL_ENROLLMENT_OPERATION_KEY]);
      assert.equal(x.storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), undefined);
    },
    async protectedCleanupReplacement() {
      for (const target of [CUSTODIAL_CREDENTIAL_KEY, CUSTODIAL_INSTALLATION_SEAL_KEY]) {
        const foreign = `{retained different original during ${target}`;
        const x = make({ flow: 'recovery', onRemove: async (storage, key) => {
          if (key === target) storage.setItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY, foreign);
        } });
        await assert.rejects(x.commit());
        assert.equal(x.storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), foreign);
        assert.equal(x.storage.value(CUSTODIAL_RECOVERY_RECORD_KEY), x.evidence.before[CUSTODIAL_RECOVERY_RECORD_KEY]);
        assert.equal(x.storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), x.evidence.before[CUSTODIAL_RESTORE_QUARANTINE_KEY]);
        assert.equal(x.state().state, 'PENDING_SERVER_CONFIRMATION');
        assert.equal(x.evidence.calls, 1);
        assert.equal(x.owner.getStatus().ready, false);
      }
    },
    async inspectionReplacement() {
      const foreign = '{foreign original during asynchronous source inspection';
      let once = false;
      const x = make({ onInspect: async storage => {
        if (!once) { once = true; storage.setItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY, foreign); }
      } });
      await assert.rejects(x.commit());
      assert.equal(x.storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), foreign);
      assert.equal(x.evidence.calls, 0);
    },
    async noPlaintextResurrection() {
      const x = make({ onRemove: async (_storage, key) => {
        if (key === CUSTODIAL_CREDENTIAL_KEY) throw Error('Synthetic unknown protected cleanup');
      } });
      x.storage.setItem(CUSTODIAL_CREDENTIAL_KEY, 'synthetic legacy compatibility secret');
      await assert.rejects(x.commit());
      assert.equal(x.storage.value(CUSTODIAL_CREDENTIAL_KEY), undefined);
      assert.equal(x.state().state, 'PENDING_SERVER_CONFIRMATION');
      assert.equal(x.evidence.calls, 1);
      assert.equal(x.owner.getStatus().ready, false);
    },
    async nonNativeExactAndForeignRollback() {
      for (const foreign of [false, true]) {
        const initial = pendingRecoveryFixture({ flow: 'enrollment' });
        delete initial[CUSTODIAL_RECOVERY_RECORD_KEY];
        delete initial[CUSTODIAL_RESTORE_QUARANTINE_KEY];
        const storage = storageFixture(initial, { operation: 'set', key: CUSTODIAL_INSTALLATION_MARKER_KEY, after: true });
        const protectedRows = new Map();
        const replacement = '{retained different protected installation';
        let getsAfterWrite = 0;
        const secure = {
          async get(key) {
            if (key === CUSTODIAL_INSTALLATION_RECORD_KEY && protectedRows.has(key)) {
              getsAfterWrite++;
              if (foreign && getsAfterWrite === 2) protectedRows.set(key, replacement);
            }
            return protectedRows.get(key) ?? null;
          },
          async set(key, value) { protectedRows.set(key, value); },
          async remove(key) { protectedRows.delete(key); },
        };
        const owner = createCustodialCredentialStore({ storage, secureStorage: secure, cryptoApi: webcrypto,
          indexedDb: { databases: async () => [], open() { throw Error('No fixture database creation'); } } });
        await assert.rejects(owner.commitEnrollmentOperation({ operationId, deviceId, credential: 'synthetic protected fixture credential' }));
        assert.equal(protectedRows.get(CUSTODIAL_INSTALLATION_RECORD_KEY), foreign ? replacement : undefined);
        assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), initial[CUSTODIAL_ENROLLMENT_OPERATION_KEY]);
        for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), undefined);
        assert.equal(storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), undefined);
        assert.equal(storage.value(CUSTODIAL_CREDENTIAL_KEY), undefined);
        assert.equal(owner.getStatus().ready, false);
      }
    },
    async directRecoveryVerifierReplacement() {
      const initial = pendingRecoveryFixture();
      const storage = storageFixture(initial);
      let protectedWrites = 0;
      const secure = { async get() { return null; }, async set() { protectedWrites++; }, async remove() {} };
      const owner = createCustodialCredentialStore({ storage, secureStorage: secure, cryptoApi: webcrypto,
        indexedDb: { databases: async () => [], open() { throw Error('No fixture database creation'); } } });
      const foreign = '{foreign recovery while original verifier awaited';
      await assert.rejects(owner.recoverEnrollment({ deviceId, managerCode: 'synthetic fixture-only code',
        credential: 'synthetic protected fixture credential', verifyManagerCode: async () => {
          storage.setItem(CUSTODIAL_RECOVERY_RECORD_KEY, foreign);
          return { authorized: true }; // Source callback fixture, not named-manager authentication.
        } }));
      assert.equal(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY), foreign);
      assert.equal(storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), initial[CUSTODIAL_RESTORE_QUARANTINE_KEY]);
      assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), initial[CUSTODIAL_ENROLLMENT_OPERATION_KEY]);
      assert.equal(protectedWrites, 0);
      assert.equal(owner.getStatus().ready, false);
    },
    async whitespaceProtectedReplacement() {
      const initial = pendingRecoveryFixture({ flow: 'enrollment' });
      delete initial[CUSTODIAL_RECOVERY_RECORD_KEY];
      delete initial[CUSTODIAL_RESTORE_QUARANTINE_KEY];
      const storage = storageFixture(initial, { operation: 'set', key: CUSTODIAL_INSTALLATION_MARKER_KEY });
      let raw = null, originalWritten = null, readsAfterWrite = 0;
      const secure = {
        async get(key) {
          if (key !== CUSTODIAL_INSTALLATION_RECORD_KEY) return null;
          if (raw !== null && ++readsAfterWrite === 2) raw = ` ${raw} `;
          return raw;
        },
        async set(key, value) { assert.equal(key, CUSTODIAL_INSTALLATION_RECORD_KEY); raw = value; originalWritten = value; },
        async remove() { throw Error('Foreign protected original must not be removed'); },
      };
      const owner = createCustodialCredentialStore({ storage, secureStorage: secure, cryptoApi: webcrypto,
        indexedDb: { databases: async () => [], open() { throw Error('No fixture database creation'); } } });
      await assert.rejects(owner.commitEnrollmentOperation({ operationId, deviceId, credential: 'synthetic protected fixture credential' }));
      assert.equal(raw, ` ${originalWritten} `);
      assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), initial[CUSTODIAL_ENROLLMENT_OPERATION_KEY]);
      assert.equal(owner.getStatus().ready, false);
    },
  };
  const selected = process.argv.find(value => value.startsWith('--enrollment-new-case='))?.split('=')[1];
  const entries = Object.entries(cases).filter(([name]) => !selected || selected === name);
  assert.ok(entries.length, 'Unknown affected enrollment case');
  for (const [name, work] of entries) { await work(); console.log(`NEW enrollment ${name} PASS (source/synthetic callbacks only)`); }
  process.exit(0);
}

// Original server-revalidation failure/regression, separate from enrollment.
if (process.argv.includes('--server-revalidation-original-counterexample-only')) {
  const initial = pendingRecoveryFixture({ reason: 'server_credential_rejected' });
  const recovery = JSON.parse(initial[CUSTODIAL_RECOVERY_RECORD_KEY]);
  recovery.details = { requested_by: 'protected_enrollment_runtime' };
  initial[CUSTODIAL_RECOVERY_RECORD_KEY] = JSON.stringify(recovery);
  for (const key of CUSTODIAL_DEVICE_KEYS) initial[key] = deviceId;
  initial[CUSTODIAL_INSTALLATION_MARKER_KEY] = seal;
  const storage = storageFixture(initial);
  const remove = storage.removeItem;
  const foreign = '{foreign recovery before resolution rollback';
  let changed = false;
  storage.removeItem = key => {
    if (key === CUSTODIAL_RESTORE_QUARANTINE_KEY && !changed) {
      changed = true;
      storage.setItem(CUSTODIAL_RECOVERY_RECORD_KEY, foreign);
      throw Error('Synthetic resolution failure after foreign replacement');
    }
    return remove(key);
  };
  const record = JSON.stringify({ schema_version: 1, credential: 'synthetic protected fixture credential',
    device_id: deviceId, installation_seal: seal, enrolled_at: '2026-08-01T01:00:00Z' });
  const owner = createCustodialCredentialStore({ storage, cryptoApi: webcrypto,
    secureStorage: { async get(key) { return key === CUSTODIAL_INSTALLATION_RECORD_KEY ? record : null; },
      async set() { throw Error('Unexpected protected write'); }, async remove() { throw Error('Unexpected protected remove'); } },
    indexedDb: { databases: async () => [], open() { throw Error('No fixture database creation'); } } });
  await assert.rejects(owner.reconcileAuthenticatedServerQuarantine(async () => ({ authenticated: true,
    deviceId, credentialId: '11000000-0000-4000-8000-000000000001' })));
  assert.equal(changed, true, 'Actual resolution callback must be reached');
  assert.equal(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY), foreign);
  process.exit(0);
}

if (process.argv.includes('--revalidation-original-new-only')) {
  const keys = [...CUSTODIAL_DEVICE_KEYS, CUSTODIAL_INSTALLATION_MARKER_KEY,
    CUSTODIAL_RECOVERY_RECORD_KEY, CUSTODIAL_RESTORE_QUARANTINE_KEY,
    CUSTODIAL_ENROLLMENT_OPERATION_KEY, CUSTODIAL_CREDENTIAL_KEY];
  const snapshot = storage => Object.fromEntries(keys.map(key => [key, storage.getItem(key)]));
  const make = ({ failures = null, onInspection = null, onProtectedRead = null } = {}) => {
    const initial = pendingRecoveryFixture({ reason: 'server_credential_rejected' });
    const recovery = JSON.parse(initial[CUSTODIAL_RECOVERY_RECORD_KEY]);
    recovery.details = { requested_by: 'protected_enrollment_runtime' };
    initial[CUSTODIAL_RECOVERY_RECORD_KEY] = JSON.stringify(recovery);
    for (const key of CUSTODIAL_DEVICE_KEYS) initial[key] = deviceId;
    initial[CUSTODIAL_INSTALLATION_MARKER_KEY] = seal;
    const storage = storageFixture(initial, failures);
    let protectedRaw = JSON.stringify({ schema_version: 1, credential: 'synthetic protected fixture credential',
      device_id: deviceId, installation_seal: seal, enrolled_at: '2026-08-01T01:00:00Z' });
    let installationReads = 0, writes = 0;
    const secure = {
      async get(key) {
        if (key !== CUSTODIAL_INSTALLATION_RECORD_KEY) return null;
        installationReads++;
        if (onProtectedRead) await onProtectedRead({ installationReads, storage,
          replace: raw => { protectedRaw = raw; }, original: protectedRaw });
        return protectedRaw;
      },
      async set() { writes++; throw Error('Unexpected protected write'); },
      async remove() { writes++; throw Error('Unexpected protected remove'); },
    };
    const owner = createCustodialCredentialStore({ storage, secureStorage: secure, cryptoApi: webcrypto,
      indexedDb: { databases: async () => { if (onInspection) await onInspection(storage); return []; },
        open() { throw Error('No fixture database creation'); } } });
    const proof = { authenticated: true, deviceId, credentialId: '11000000-0000-4000-8000-000000000001' };
    return { storage, initial, owner, proof, protectedWrites: () => writes,
      reconcile: verifier => owner.reconcileAuthenticatedServerQuarantine(verifier || (async () => proof)) };
  };
  const cases = {
    async normalResolution() {
      const x = make();
      const result = await x.reconcile();
      assert.equal(result.reconciled, true);
      const resolved = JSON.parse(x.storage.value(CUSTODIAL_RECOVERY_RECORD_KEY));
      assert.equal(resolved.recovery_id, recoveryId);
      assert.equal(resolved.status, 'resolved');
      assert.equal(resolved.resolution.credential_id, x.proof.credentialId);
      assert.equal(x.storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
      assert.equal(x.storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), x.initial[CUSTODIAL_ENROLLMENT_OPERATION_KEY]);
      assert.equal(x.owner.getStatus().ready, true);
      assert.equal(x.protectedWrites(), 0);
    },
    async rejectedAndCommittedThrowEffects() {
      for (const [operation, key] of [['set', CUSTODIAL_RECOVERY_RECORD_KEY], ['remove', CUSTODIAL_RESTORE_QUARANTINE_KEY]]) {
        for (const after of [false, true]) {
          const x = make({ failures: { operation, key, after } });
          const before = snapshot(x.storage);
          await assert.rejects(x.reconcile());
          assert.deepEqual(snapshot(x.storage), before);
          assert.equal(x.owner.getStatus().ready, false);
          assert.equal(x.owner.getStatus().principal, null);
          assert.equal(x.protectedWrites(), 0);
        }
      }
    },
    async foreignRowsAtEffectTime() {
      for (const effect of ['set', 'remove']) {
        const x = make();
        const ownSet = x.storage.setItem, ownRemove = x.storage.removeItem;
        const foreign = '{foreign unresolved protected row, exact original retained';
        const target = effect === 'set' ? CUSTODIAL_RESTORE_QUARANTINE_KEY : CUSTODIAL_RECOVERY_RECORD_KEY;
        if (effect === 'set') x.storage.setItem = (key, value) => {
          ownSet(key, value);
          if (key === CUSTODIAL_RECOVERY_RECORD_KEY) ownSet(target, foreign);
        };
        else x.storage.removeItem = key => {
          ownRemove(key);
          if (key === CUSTODIAL_RESTORE_QUARANTINE_KEY) {
            ownSet(target, foreign);
            throw Error('Synthetic committed cleanup with foreign replacement');
          }
        };
        await assert.rejects(x.reconcile());
        assert.equal(x.storage.value(target), foreign);
        assert.equal(x.owner.getStatus().ready, false);
        assert.equal(x.owner.getStatus().principal, null);
        assert.equal(x.protectedWrites(), 0);
      }
    },
    async originalChangedWhileVerifierAwaited() {
      for (const key of [CUSTODIAL_DEVICE_KEYS[0], CUSTODIAL_ENROLLMENT_OPERATION_KEY, CUSTODIAL_RECOVERY_RECORD_KEY]) {
        const x = make();
        const foreign = '{different original protected owner while verifier awaited';
        await assert.rejects(x.reconcile(async () => {
          await Promise.resolve();
          x.storage.setItem(key, foreign);
          return x.proof;
        }));
        assert.equal(x.storage.value(key), foreign);
        assert.equal(x.storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), x.initial[CUSTODIAL_RESTORE_QUARANTINE_KEY]);
        assert.equal(x.owner.getStatus().ready, false);
      }
    },
    async protectedBindingChangedDuringVerification() {
      for (const mutate of ['credential', 'device_id']) {
        const x = make({ onProtectedRead: async ({ installationReads, replace, original }) => {
          if (installationReads === 3) {
            const changed = JSON.parse(original);
            changed[mutate] = mutate === 'device_id' ? 'KIOSK_08' : 'different synthetic protected binding';
            replace(JSON.stringify(changed));
          }
        } });
        const before = snapshot(x.storage);
        await assert.rejects(x.reconcile());
        assert.deepEqual(snapshot(x.storage), before);
        assert.equal(x.owner.getStatus().ready, false);
        assert.equal(x.owner.getStatus().principal, null);
        assert.equal(x.protectedWrites(), 0);
      }
    },
    async refusedOrUnavailableVerification() {
      for (const failure of ['refused', 'throws']) {
        const x = make();
        const before = snapshot(x.storage);
        const beforeStatus = x.owner.getStatus();
        const result = await x.reconcile(async () => {
          if (failure === 'throws') throw Error('Synthetic unavailable verifier');
          return { ...x.proof, authenticated: false };
        });
        assert.equal(result.reconciled, false);
        assert.deepEqual(snapshot(x.storage), before);
        assert.equal(x.owner.getStatus().ready, false);
        assert.deepEqual(x.owner.getStatus(), beforeStatus);
        assert.equal(x.protectedWrites(), 0);
      }
    },
    async changedOwnerOnRejectedVerification() {
      for (const failure of ['refused', 'throws']) {
        const x = make();
        const foreign = '{foreign quarantine during failed verifier';
        await assert.rejects(x.reconcile(async () => {
          x.storage.setItem(CUSTODIAL_RESTORE_QUARANTINE_KEY, foreign);
          if (failure === 'throws') throw Error('Synthetic unavailable verifier');
          return { ...x.proof, authenticated: false };
        }));
        assert.equal(x.storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), foreign);
        assert.equal(x.storage.value(CUSTODIAL_RECOVERY_RECORD_KEY), x.initial[CUSTODIAL_RECOVERY_RECORD_KEY]);
        assert.equal(x.owner.getStatus().ready, false);
      }
    },
    async rollbackFailureDoesNotGenerateRecovery() {
      const x = make({ failures: [
        { operation: 'remove', key: CUSTODIAL_RESTORE_QUARANTINE_KEY },
        { operation: 'set', key: CUSTODIAL_RECOVERY_RECORD_KEY, occurrence: 2, after: true },
      ] });
      const before = snapshot(x.storage);
      await assert.rejects(x.reconcile());
      assert.deepEqual(snapshot(x.storage), before);
      assert.equal(x.owner.getStatus().ready, false);
      assert.equal(x.owner.getStatus().principal, null);
      assert.equal(x.protectedWrites(), 0);
    },
    async sourceInspectionReplacement() {
      const foreign = '{foreign recovery during deferred source inspection';
      let once = false;
      const x = make({ onInspection: async storage => {
        if (!once) { once = true; storage.setItem(CUSTODIAL_RECOVERY_RECORD_KEY, foreign); }
      } });
      let verifierCalls = 0;
      await assert.rejects(x.reconcile(async () => { verifierCalls++; return x.proof; }));
      assert.equal(verifierCalls, 0);
      assert.equal(x.storage.value(CUSTODIAL_RECOVERY_RECORD_KEY), foreign);
      assert.equal(x.owner.getStatus().ready, false);
    },
  };
  const selected = process.argv.find(value => value.startsWith('--revalidation-original-new-case='))?.split('=')[1];
  const entries = Object.entries(cases).filter(([name]) => !selected || name === selected);
  assert.ok(entries.length, 'Unknown owning revalidation case');
  for (const [name, work] of entries) { await work(); console.log(`NEW original revalidation ${name} PASS (source/synthetic callbacks only)`); }
  process.exit(0);
}

if (process.argv.includes('--enrollment-original-initial-value-only')) {
  const selected = process.argv.find(value => value.startsWith('--initial-value-case='))?.split('=')[1];
  const validOriginal = JSON.stringify({ schema_version: 1, credential: 'synthetic prior protected credential',
    device_id: deviceId, installation_seal: seal, enrolled_at: '2026-08-01T01:00:00Z' });
  const cases = { empty: '', whitespace: ' ', blankLines: '\n\t', malformed: '{saved unsupported original',
    absent: null, validRecovery: validOriginal };
  const entries = Object.entries(cases).filter(([name]) => !selected || selected === name);
  assert.ok(entries.length, 'Unknown owning original installation case');
  for (const [name, original] of entries) {
    const flow = name === 'validRecovery' ? 'recovery' : 'enrollment';
    const initial = pendingRecoveryFixture({ flow });
    if (flow === 'enrollment') {
      delete initial[CUSTODIAL_RECOVERY_RECORD_KEY];
      delete initial[CUSTODIAL_RESTORE_QUARANTINE_KEY];
    }
    const storage = storageFixture(initial);
    let raw = original, writes = 0;
    const secure = {
      async get(key) { return key === CUSTODIAL_INSTALLATION_RECORD_KEY ? raw : null; },
      async set(key, value) { assert.equal(key, CUSTODIAL_INSTALLATION_RECORD_KEY); writes++; raw = value; },
      async remove(key) { assert.notEqual(key, CUSTODIAL_INSTALLATION_RECORD_KEY); },
    };
    const owner = createCustodialCredentialStore({ storage, secureStorage: secure, cryptoApi: webcrypto,
      indexedDb: { databases: async () => [], open() { throw Error('No fixture database creation'); } } });
    const work = owner.commitEnrollmentOperation({ operationId, deviceId, credential: 'synthetic new protected credential' });
    if (name === 'absent' || name === 'validRecovery') {
      assert.equal((await work).operationId, operationId);
      assert.equal(writes, 1);
      assert.equal(JSON.parse(raw).enrollment_operation_id, operationId);
      assert.equal(owner.getStatus().ready, true);
    } else {
      await assert.rejects(work);
      assert.equal(writes, 0);
      assert.equal(raw, original);
      assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), initial[CUSTODIAL_ENROLLMENT_OPERATION_KEY]);
      assert.equal(owner.getStatus().ready, false);
    }
    console.log(`NEW original installation ${name} PASS (source/synthetic store only)`);
  }
  process.exit(0);
}

if (process.argv.includes('--queued-removal-original-new-only')) {
  const { protectedBrowserIdbFixture } = await import('../../scripts/protected-browser-inventory-tests.mjs');
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const fixture = async ({ initialize = true } = {}) => {
    const id = n => `79000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const principal = { schema_version: 'custodial-protected-principal.v1', device_id: deviceId,
      employee_id: id(1), credential_id: id(2), credential_operation_id: id(3), assignment_epoch: 1,
      installation_seal: seal, enrolled_at: '2026-08-01T02:00:00.000Z' };
    const original = { schema_version: 1, credential: 'synthetic-original-removal-owner-only', device_id: deviceId,
      installation_seal: seal, enrolled_at: principal.enrolled_at, enrollment_operation_id: id(3),
      migrated_from_credential_only_state: false, principal };
    let encoded = JSON.stringify(original), pausedRead = null, remoteCalls = 0, finalizerCalls = 0, holder = null;
    const storage = storageFixture(Object.fromEntries([
      ...CUSTODIAL_DEVICE_KEYS.map(key => [key, deviceId]), [CUSTODIAL_INSTALLATION_MARKER_KEY, seal],
    ]));
    const definitions = { mz_scan_queue: { stores: { actions: [] } }, mz_scan_completion_drafts: { stores: { drafts: [] } } };
    const indexedDb = protectedBrowserIdbFixture(definitions), locks = createSyntheticScheduleLocks();
    const attempted = [deferred(), deferred()];
    const secureStorage = {
      async get(key) {
        if (key !== CUSTODIAL_INSTALLATION_RECORD_KEY) return null;
        if (pausedRead) { const wait = pausedRead; pausedRead = null; wait.entered.resolve(); await wait.release.promise; }
        return encoded;
      },
      async set() { throw Error('Unexpected fixture protected write'); },
      async remove() { throw Error('Unexpected fixture protected removal'); },
      async finalizeRemoval(operation, requestedDevice) {
        assert.equal(holder, 0); finalizerCalls++;
        assert.equal(operation, removalOperationId);
        const current = JSON.parse(encoded);
        assert.equal(requestedDevice, current.device_id);
        const journal = JSON.parse(storage.getItem(CUSTODIAL_REMOVAL_OPERATION_KEY));
        assert.equal(journal.operation_id, operation); assert.equal(journal.phase, 'server_logged_out');
        for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.getItem(key), null);
        encoded = null;
      },
    };
    const gates = [0, 1].map(() => createProtectedBrowserAdmission({ storage, indexedDb, locks, cryptoApi: webcrypto }));
    const owners = gates.map((gate, index) => createCustodialCredentialStore({ storage, indexedDb, secureStorage,
      cryptoApi: { randomUUID: () => removalOperationId }, now: () => '2026-08-01T02:15:00.000Z',
      protectedWorkAdmission: operation => {
        attempted[index].resolve();
        return gate.mutate(async () => {
          assert.equal(holder, null); holder = index;
          try { return await operation(); } finally { holder = null; }
        });
      }, protectedWorkCheckpoint: () => gate.requireAdmission(),
    }));
    if (initialize) { await owners[0].ensureSecurityState(); await owners[1].ensureSecurityState(); }
    const replacement = change => {
      // Synthetic persisted-owner change, not a native activation or permission.
      const next = structuredClone(original); change(next); encoded = JSON.stringify(next);
      for (const key of CUSTODIAL_DEVICE_KEYS) storage.setItem(key, next.device_id);
      storage.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY, next.installation_seal);
      return next;
    };
    const remote = async args => {
      assert.equal(holder, 0); remoteCalls++;
      const current = JSON.parse(encoded);
      assert.equal(args.credential, current.credential); assert.equal(args.deviceId, current.device_id);
      assert.equal(args.operationId, removalOperationId); await args.checkpoint('server_logged_out');
    };
    const rawLocal = () => Object.fromEntries(Array.from({ length: storage.length }, (_, n) => {
      const key = storage.key(n); return [key, storage.getItem(key)];
    }));
    return { owners, attempted, storage, indexedDb, locks, original, replacement, remote, rawLocal,
      rawProtected: () => encoded, holder: () => holder, counts: () => ({ remoteCalls, finalizerCalls }),
      pauseRead() { const wait = { entered: deferred(), release: deferred() }; pausedRead = wait; return wait; },
    };
  };
  const behindSharedOwner = async (change, { unchanged = false } = {}) => {
    const x = await fixture(), entered = deferred(), release = deferred();
    const blocker = x.owners[1].runWhenReady(async context => {
      entered.resolve(); await release.promise; context.assertCurrent();
    }, { requireEnrollment: true }).then(() => ({}), error => ({ error }));
    await entered.promise;
    const request = x.owners[0].removeEnrollment({ beforeRemove: x.remote }).then(value => ({ value }), error => ({ error }));
    await x.attempted[0].promise;
    assert.equal(x.holder(), 1); assert.deepEqual(x.counts(), { remoteCalls: 0, finalizerCalls: 0 });
    change(x);
    const protectedBefore = x.rawProtected(), localBefore = x.rawLocal();
    release.resolve(); await blocker;
    const result = await request;
    console.log(`NEW queued owner result: refused=${!!result.error} remote=${x.counts().remoteCalls} finalizer=${x.counts().finalizerCalls}`);
    if (unchanged) {
      assert.equal(result.value?.removed, true); assert.deepEqual(x.counts(), { remoteCalls: 1, finalizerCalls: 1 });
      assert.equal(x.rawProtected(), null);
      for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(x.storage.getItem(key), null);
      assert.equal(JSON.parse(x.storage.getItem(CUSTODIAL_REMOVAL_COMPLETION_KEY)).operation_id, removalOperationId);
    } else {
      assert.equal(result.error?.code, 'custodial_security_generation_changed', 'An old queued request must not retarget the replacement');
      assert.deepEqual(x.counts(), { remoteCalls: 0, finalizerCalls: 0 });
      assert.equal(x.rawProtected(), protectedBefore); assert.deepEqual(x.rawLocal(), localBefore);
    }
    assert.equal(x.indexedDb.state.opens, x.indexedDb.state.closes);
    assert.equal(x.holder(), null); await Promise.resolve(); assert.equal(x.locks.pending, 0);
  };
  const cases = {
    async sharedOwnerReplacement() {
      await behindSharedOwner(x => x.replacement(next => {
        next.device_id = 'KIOSK_08'; next.credential = 'synthetic-successor-removal-owner-only';
        next.installation_seal = 'successor-fixture-installation-seal-12345678';
        next.principal = { ...next.principal, device_id: next.device_id, installation_seal: next.installation_seal,
          employee_id: '79000000-0000-4000-8000-000000000009', credential_id: '79000000-0000-4000-8000-000000000010', assignment_epoch: 2 };
      }));
    },
    async sharedCredentialOnlyReplacement() {
      await behindSharedOwner(x => x.replacement(next => { next.credential = 'synthetic-successor-removal-owner-only'; }));
    },
    async sharedPrincipalOnlyReplacement() {
      await behindSharedOwner(x => x.replacement(next => {
        next.principal = { ...next.principal, credential_id: '79000000-0000-4000-8000-000000000010', assignment_epoch: 2 };
      }));
    },
    async sharedUnknownPrincipalReplacement() {
      await behindSharedOwner(x => x.replacement(next => { next.principal.extra_unknown = 'retained unsupported original'; }));
    },
    async unchangedSharedOwnerOwnPhases() { await behindSharedOwner(() => {}, { unchanged: true }); },
    async fifoRefreshSuccessor() {
      const x = await fixture(), wait = x.pauseRead();
      const refresh = x.owners[0].ensureSecurityState();
      await wait.entered.promise;
      const removal = x.owners[0].removeEnrollment({ beforeRemove: x.remote }).then(value => ({ value }), error => ({ error }));
      x.replacement(next => {
        next.credential = 'synthetic-successor-removal-owner-only';
        next.principal = { ...next.principal, credential_id: '79000000-0000-4000-8000-000000000010', assignment_epoch: 2 };
      });
      const original = x.rawProtected(), localBefore = x.rawLocal();
      wait.release.resolve(); await refresh;
      assert.equal((await removal).error?.code, 'custodial_security_generation_changed');
      assert.deepEqual(x.counts(), { remoteCalls: 0, finalizerCalls: 0 });
      assert.equal(x.rawProtected(), original); assert.deepEqual(x.rawLocal(), localBefore);
      assert.equal(x.owners[0].getStatus().ready, true, 'Old request refusal does not rewrite the newly refreshed owner');
      assert.equal(x.owners[0].getStatus().principal.assignment_epoch, 2);
      await Promise.resolve(); assert.equal(x.locks.pending, 0);
    },
    async unchangedFifoOwner() {
      const x = await fixture(), entered = deferred(), release = deferred();
      const first = x.owners[0].runWhenReady(async context => {
        entered.resolve(); await release.promise; context.assertCurrent();
      }, { requireEnrollment: true });
      await entered.promise;
      const removal = x.owners[0].removeEnrollment({ beforeRemove: x.remote });
      assert.deepEqual(x.counts(), { remoteCalls: 0, finalizerCalls: 0 });
      release.resolve(); await first;
      assert.equal((await removal).removed, true);
      assert.deepEqual(x.counts(), { remoteCalls: 1, finalizerCalls: 1 });
      assert.equal(x.rawProtected(), null); await Promise.resolve(); assert.equal(x.locks.pending, 0);
    },
    async uninitializedCallerIsUnknown() {
      const x = await fixture({ initialize: false }), original = x.rawProtected(), localBefore = x.rawLocal();
      await assert.rejects(x.owners[0].removeEnrollment({ beforeRemove: x.remote }), error => error.code === 'custodial_security_state_unchecked');
      assert.deepEqual(x.counts(), { remoteCalls: 0, finalizerCalls: 0 });
      assert.equal(x.indexedDb.state.opens, 0); assert.equal(x.rawProtected(), original); assert.deepEqual(x.rawLocal(), localBefore);
      await Promise.resolve(); assert.equal(x.locks.pending, 0);
    },
    async originalPendingNativePhaseResume() {
      const storage = storageFixture(nativeRemovalLocalFixture());
      const native = nativeRemovalHarness(storage, { finalizeFailure: 'before_write' });
      const owner = nativeRemovalStore(native.plugin, storage);
      await owner.ensureSecurityState();
      await assert.rejects(owner.removeEnrollment({ beforeRemove: native.remoteComplete }), error => error.code === 'custodial_secure_storage_unavailable');
      const pending = storage.getItem(CUSTODIAL_REMOVAL_OPERATION_KEY);
      assert.equal(JSON.parse(pending).operation_id, removalOperationId);
      assert.equal(JSON.parse(pending).phase, 'server_logged_out');
      assert.equal(owner.getStatus().ready, false);
      assert.equal((await owner.removeEnrollment({ beforeRemove: native.remoteComplete })).removed, true);
      assert.equal(native.remoteCalls(), 1); assert.equal(native.finalizeAttempts(), 2);
      assert.equal(JSON.parse(storage.getItem(CUSTODIAL_REMOVAL_COMPLETION_KEY)).operation_id, removalOperationId);
    },
  };
  const selected = process.argv.find(value => value.startsWith('--queued-removal-original-case='))?.split('=')[1];
  const entries = Object.entries(cases).filter(([name]) => !selected || name === selected);
  assert.ok(entries.length, 'Unknown queued original removal case');
  for (const [name, run] of entries) {
    let timer;
    try {
      await Promise.race([run(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Queued original removal deadlock')), 2000); })]);
      console.log(`NEW queued original removal ${name} PASS (source/synthetic owner/storage/locks only)`);
    } finally { clearTimeout(timer); }
  }
  process.exit(0);
}

if (process.argv.includes('--participating-removal-new-only')) {
  const { protectedBrowserIdbFixture } = await import('../../scripts/protected-browser-inventory-tests.mjs');
  const { PROTECTED_BROWSER_HOLD_KEY } = await import('../src/custodial/protected-browser-admission.js');
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const fixture = async () => {
    const definitions = { mz_scan_queue: { stores: { actions: [] } }, mz_scan_completion_drafts: { stores: { drafts: [] } } };
    const options = {}, indexedDb = protectedBrowserIdbFixture(definitions, options);
    const storage = storageFixture(nativeRemovalLocalFixture()), native = nativeRemovalHarness(storage);
    const locks = createSyntheticScheduleLocks();
    const gates = ['removal', 'writer'].map(() => createProtectedBrowserAdmission({ storage, indexedDb, locks, cryptoApi: webcrypto }));
    const attempted = { removal: deferred(), writer: deferred() };
    let holder = null, removalDecided = false, producerCalls = 0;
    const admission = (name, gate) => operation => {
      attempted[name].resolve();
      return gate.mutate(async () => {
        assert.equal(holder, null, 'Actual modeled shared lease excludes the other owner');
        holder = name;
        try { return await operation(); }
        finally { if (name === 'removal') removalDecided = true; holder = null; }
      });
    };
    const owners = gates.map((gate, index) => createCustodialCredentialStore({ storage, indexedDb,
      secureStorage: createNativeProtectedStorage({ ...native.plugin, async finalizeRemoval(args) {
        assert.equal(holder, 'removal', 'Finalizer callback runs inside removal shared lease');
        const result = await native.plugin.finalizeRemoval(args);
        assert.equal(holder, 'removal');
        return result;
      } }, storage),
      protectedWorkAdmission: admission(index === 0 ? 'removal' : 'writer', gate),
      protectedWorkCheckpoint: () => gate.requireAdmission(),
      cryptoApi: { randomUUID: () => removalOperationId }, now: () => '2026-08-01T02:15:00.000Z' }));
    await owners[0].ensureSecurityState(); await owners[1].ensureSecurityState();
    const original = { id: 93, type: 'commit_workflow', operation_id: operationId, state: 'pending',
      payload: { p_device_id: deviceId, p_client_completion_id: enrollmentOperationId } };
    const produce = async context => {
      assert.equal(holder, 'writer'); context.assertCurrent();
      producerCalls++; definitions.mz_scan_queue.stores.actions.push({ key: 93, value: original });
      context.assertCurrent();
    };
    const remote = async args => {
      assert.equal(holder, 'removal', 'Remote callback runs inside removal shared lease');
      await native.remoteComplete(args); assert.equal(holder, 'removal');
    };
    return { definitions, indexedDb, options, storage, native, locks, owners, gates, attempted, original, produce, remote,
      holder: () => holder, decided: () => removalDecided, produced: () => producerCalls };
  };
  const cases = {
    async removalFirstWriterWaitsThenRefuses() {
      const x = await fixture(), inspecting = deferred(), resume = deferred();
      const list = x.indexedDb.databases.bind(x.indexedDb);
      let lists = 0;
      x.indexedDb.databases = async () => {
        const result = await list();
        if (++lists === 2) { inspecting.resolve(); await resume.promise; }
        return result;
      };
      const originalGeneration = x.owners[1].getGeneration();
      const removal = x.owners[0].removeEnrollment({ beforeRemove: x.remote });
      await inspecting.promise;
      assert.equal(x.indexedDb.state.opens, x.indexedDb.state.closes, 'Existing queue snapshot already closed');
      const writer = x.owners[1].runWhenReady(x.produce, { requireEnrollment: true, expectedGeneration: originalGeneration })
        .then(value => ({ value }), error => ({ error }));
      await x.attempted.writer.promise;
      assert.equal(x.holder(), 'removal'); assert.equal(x.produced(), 0); assert.equal(x.decided(), false);
      assert.deepEqual(x.definitions.mz_scan_queue.stores.actions, []);
      resume.resolve();
      assert.equal((await removal).removed, true);
      const outcome = await writer;
      assert.equal(outcome.error?.code, 'custodial_security_state_unavailable');
      assert.equal(x.decided(), true); assert.equal(x.produced(), 0);
      assert.deepEqual(x.definitions.mz_scan_queue.stores.actions, []);
      assert.equal(x.native.remoteCalls(), 1); assert.equal(x.native.finalizeAttempts(), 1);
      assert.equal(x.holder(), null); await Promise.resolve(); assert.equal(x.locks.pending, 0);
    },
    async writerFirstPendingWorkRefusesRemoval() {
      const x = await fixture(), writerEntered = deferred(), release = deferred();
      const producer = x.owners[1].runWhenReady(async context => {
        writerEntered.resolve(); await release.promise; await x.produce(context);
      }, { requireEnrollment: true, expectedGeneration: x.owners[1].getGeneration() });
      await writerEntered.promise;
      const opens = x.indexedDb.state.opens;
      const removal = x.owners[0].removeEnrollment({ beforeRemove: x.remote }).then(value => ({ value }), error => ({ error }));
      await x.attempted.removal.promise;
      assert.equal(x.holder(), 'writer'); assert.equal(x.indexedDb.state.opens, opens);
      release.resolve(); await producer;
      const result = await removal;
      assert.equal(result.error?.code, 'custodial_pending_work');
      assert.equal(result.error.preservedCounts.scan_queue, 1);
      assert.equal(x.produced(), 1); assert.deepEqual(x.definitions.mz_scan_queue.stores.actions, [{ key: 93, value: x.original }]);
      assert.equal(x.native.remoteCalls(), 0); assert.equal(x.native.finalizeAttempts(), 0);
      assert.equal(x.storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
      assert.equal(x.holder(), null); await Promise.resolve(); assert.equal(x.locks.pending, 0);
    },
    async rejectedInspectionReleasesLease() {
      const x = await fixture();
      x.options.transactionAbort = true;
      const removal = x.owners[0].removeEnrollment({ beforeRemove: x.remote }).then(value => ({ value }), error => ({ error }));
      await x.attempted.removal.promise;
      const producer = x.owners[1].runWhenReady(async context => {
        assert.equal(x.decided(), true, 'Writer proceeds only after rejected removal terminal decision');
        await x.produce(context);
      }, { requireEnrollment: true, expectedGeneration: x.owners[1].getGeneration() });
      const result = await removal; assert.equal(result.error?.code, 'custodial_security_state_unavailable');
      await producer;
      assert.equal(x.produced(), 1); assert.deepEqual(x.definitions.mz_scan_queue.stores.actions, [{ key: 93, value: x.original }]);
      assert.equal(x.native.remoteCalls(), 0); assert.equal(x.native.finalizeAttempts(), 0);
      assert.equal(x.indexedDb.state.opens, x.indexedDb.state.closes);
      assert.equal(x.holder(), null); await Promise.resolve(); assert.equal(x.locks.pending, 0);
    },
    async closedAdmissionNoOperationsAndReleases() {
      const x = await fixture(), raw = '{retained unknown preservation marker';
      x.storage.setItem(PROTECTED_BROWSER_HOLD_KEY, raw);
      const opens = x.indexedDb.state.opens;
      await assert.rejects(x.owners[0].removeEnrollment({ beforeRemove: x.remote }),
        error => error.code === 'custodial_browser_preservation_pending');
      await assert.rejects(x.owners[1].runWhenReady(x.produce, { requireEnrollment: true }),
        error => error.code === 'custodial_browser_preservation_pending');
      assert.equal(x.indexedDb.state.opens, opens); assert.equal(x.produced(), 0);
      assert.equal(x.native.remoteCalls(), 0); assert.equal(x.native.finalizeAttempts(), 0);
      assert.equal(x.storage.value(PROTECTED_BROWSER_HOLD_KEY), raw);
      assert.deepEqual(x.definitions.mz_scan_queue.stores.actions, []);
      assert.equal(x.holder(), null); await Promise.resolve(); assert.equal(x.locks.pending, 0);
    },
  };
  const selected = process.argv.find(value => value.startsWith('--participating-removal-case='))?.split('=')[1];
  const entries = Object.entries(cases).filter(([name]) => !selected || name === selected);
  assert.ok(entries.length, 'Unknown participating removal case');
  for (const [name, run] of entries) {
    let timer;
    try {
      await Promise.race([run(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Participating owner/FIFO deadlock')), 2000); })]);
      console.log(`NEW participating removal ${name} PASS (actual modules/synthetic locks and IDB, not native/browser proof)`);
    } finally { clearTimeout(timer); }
  }
  process.exit(0);
}

if (process.argv.includes('--removal-original-work-keyset-only')) {
  const storage = storageFixture(nativeRemovalLocalFixture());
  const native = nativeRemovalHarness(storage);
  let enter, resume;
  const inspecting = new Promise(resolve => { enter = resolve; });
  const waiting = new Promise(resolve => { resume = resolve; });
  let armed = false;
  const owner = createCustodialCredentialStore({ storage,
    secureStorage: createNativeProtectedStorage(native.plugin, storage),
    indexedDb: { async databases() { if (armed) { enter(); await waiting; } return []; },
      open() { throw Error('Absent original database must not open'); } },
    cryptoApi: { randomUUID: () => removalOperationId }, now: () => '2026-08-01T02:15:00.000Z' });
  await owner.ensureSecurityState();
  armed = true;
  const work = owner.removeEnrollment({ beforeRemove: native.remoteComplete });
  await inspecting;
  const key = 'session:new-original-pending-work';
  const raw = JSON.stringify({ device_id: deviceId, status: 'open',
    client_session_id: '11000000-0000-4000-8000-000000000009' });
  storage.setItem(key, raw);
  resume();
  await assert.rejects(work.then(result => {
    console.log(JSON.stringify({ unexpected_success: result.removed === true,
      remote_calls: native.remoteCalls(), finalizer_calls: native.finalizeAttempts(),
      original_work_retained: storage.value(key) === raw }));
    return result;
  }));
  assert.equal(storage.value(key), raw);
  assert.equal(native.remoteCalls(), 0);
  assert.equal(native.finalizeAttempts(), 0);
  assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
  assert.equal(owner.getStatus().ready, false);
  console.log('NEW local pending work inserted during actual removal inspection retained/refused (synthetic callbacks only)');
  process.exit(0);
}

if (process.argv.includes('--removal-work-keyset-new-only')) {
  const cases = {
    async knownAndUnknownWorkDuringProtectedRead() {
      for (const key of ['mz_chatscope_read_outbox:new-original', 'mz_employee_feedback_retirement_backup:new-original',
        'mz_chatscope_group_pending:new-original']) {
        const storage = storageFixture(nativeRemovalLocalFixture());
        const native = nativeRemovalHarness(storage);
        let armed = false, reads = 0;
        const raw = '{unknown pending original work, retained without interpretation';
        const owner = nativeRemovalStore({ ...native.plugin, async getState() {
          if (armed && ++reads === 2) storage.setItem(key, raw);
          return native.plugin.getState();
        } }, storage);
        await owner.ensureSecurityState();
        armed = true;
        await assert.rejects(owner.removeEnrollment({ beforeRemove: native.remoteComplete }));
        assert.equal(storage.value(key), raw);
        assert.equal(native.remoteCalls(), 0);
        assert.equal(native.finalizeAttempts(), 0);
        assert.equal(owner.getStatus().ready, false);
      }
    },
    async remoteAwaitNewWork() {
      const key = 'mz_chatscope_outbox:late-original', raw = '{held original send, never adopt';
      const storage = storageFixture(nativeRemovalLocalFixture());
      const native = nativeRemovalHarness(storage), owner = nativeRemovalStore(native.plugin, storage);
      await owner.ensureSecurityState();
      await assert.rejects(owner.removeEnrollment({ beforeRemove: async args => {
        await native.remoteComplete(args);
        storage.setItem(key, raw);
      } }));
      assert.equal(storage.value(key), raw);
      assert.equal(native.remoteCalls(), 1);
      assert.equal(native.finalizeAttempts(), 0);
      assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
      assert.equal(owner.getStatus().ready, false);
    },
    async workAppearsDuringCleanupRollback() {
      const key = 'mz_scan_completion_draft:new-original', raw = '{unknown pending answers, do not erase';
      const storage = storageFixture(nativeRemovalLocalFixture());
      const native = nativeRemovalHarness(storage), owner = nativeRemovalStore(native.plugin, storage);
      await owner.ensureSecurityState();
      const remove = storage.removeItem;
      storage.removeItem = item => {
        remove(item);
        if (item === CUSTODIAL_INSTALLATION_MARKER_KEY) storage.setItem(key, raw);
      };
      await assert.rejects(owner.removeEnrollment({ beforeRemove: native.remoteComplete }));
      assert.equal(storage.value(key), raw);
      assert.equal(storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), seal);
      for (const item of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(item), deviceId);
      assert.equal(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY), undefined);
      assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
      assert.equal(native.finalizeAttempts(), 0);
      assert.equal(owner.getStatus().ready, false);
    },
    async workAppearsDuringFinalizerAwait() {
      const key = 'mz_native_notification_outbox:unknown-original', raw = '{unknown notification original, not accepted';
      const storage = storageFixture(nativeRemovalLocalFixture());
      const native = nativeRemovalHarness(storage);
      const owner = nativeRemovalStore({ ...native.plugin, async finalizeRemoval(args) {
        const result = await native.plugin.finalizeRemoval(args);
        storage.setItem(key, raw);
        return result;
      } }, storage);
      await owner.ensureSecurityState();
      await assert.rejects(owner.removeEnrollment({ beforeRemove: native.remoteComplete }));
      assert.equal(storage.value(key), raw);
      assert.equal(native.finalizeAttempts(), 1, 'JS refusal cannot undo an already completed native fixture effect');
      assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
      assert.equal(owner.getStatus().ready, false);
    },
    async unchangedOriginalWorkStillBlocks() {
      const key = 'session:existing-original', raw = JSON.stringify({ device_id: deviceId, status: 'open' });
      const storage = storageFixture({ ...nativeRemovalLocalFixture(), [key]: raw });
      const native = nativeRemovalHarness(storage), owner = nativeRemovalStore(native.plugin, storage);
      await owner.ensureSecurityState();
      await assert.rejects(owner.removeEnrollment({ beforeRemove: native.remoteComplete }),
        error => error.code === 'custodial_pending_work');
      assert.equal(storage.value(key), raw);
      assert.equal(native.remoteCalls(), 0);
      assert.equal(native.finalizeAttempts(), 0);
      assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
    },
    async exactCacheOnlyCleanupStillAllowed() {
      const cache = 'mz_employee_events_snapshot:original';
      const storage = storageFixture({ ...nativeRemovalLocalFixture(), [cache]: 'original cache bytes' });
      const native = nativeRemovalHarness(storage), owner = nativeRemovalStore(native.plugin, storage);
      await owner.ensureSecurityState();
      assert.equal((await owner.removeEnrollment({ beforeRemove: native.remoteComplete })).removed, true);
      assert.equal(storage.value(cache), undefined);
      assert.equal(native.finalizeAttempts(), 1);
      assert.equal(JSON.parse(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY)).operation_id, removalOperationId);
    },
    async nearPrefixUnrelatedRowNotWork() {
      const key = 'sessionPreference', raw = 'unrelated original preference';
      const storage = storageFixture(nativeRemovalLocalFixture());
      const native = nativeRemovalHarness(storage), owner = nativeRemovalStore(native.plugin, storage);
      await owner.ensureSecurityState();
      const get = storage.getItem;
      storage.getItem = item => { if (item === key) throw Error('Unrelated value must not be read'); return get(item); };
      assert.equal((await owner.removeEnrollment({ beforeRemove: async args => {
        storage.setItem(key, raw);
        await native.remoteComplete(args);
      } })).removed, true);
      assert.equal(storage.value(key), raw);
      assert.equal(native.finalizeAttempts(), 1);
    },
  };
  const selected = process.argv.find(value => value.startsWith('--removal-work-keyset-case='))?.split('=')[1];
  const entries = Object.entries(cases).filter(([name]) => !selected || name === selected);
  assert.ok(entries.length, 'Unknown affected local work keyset case');
  for (const [name, work] of entries) { await work(); console.log(`NEW local work membership ${name} PASS (source/synthetic callbacks only)`); }
  process.exit(0);
}

if (process.argv.includes('--removal-original-keyset-only')) {
  const storage = storageFixture(nativeRemovalLocalFixture());
  const native = nativeRemovalHarness(storage);
  let entered, resume;
  const inspecting = new Promise(resolve => { entered = resolve; });
  const waiting = new Promise(resolve => { resume = resolve; });
  let armed = false;
  const owner = createCustodialCredentialStore({ storage,
    secureStorage: createNativeProtectedStorage(native.plugin, storage),
    indexedDb: { async databases() { if (armed) { entered(); await waiting; } return []; },
      open() { throw Error('Absent original database must not open'); } },
    cryptoApi: { randomUUID: () => removalOperationId }, now: () => '2026-08-01T02:15:00.000Z' });
  await owner.ensureSecurityState();
  armed = true;
  const work = owner.removeEnrollment({ beforeRemove: native.remoteComplete });
  await inspecting;
  const key = 'mz_employee_schedule_snapshot:new-original';
  const raw = '{new unknown old-owner authority cache, retain exactly';
  storage.setItem(key, raw);
  resume();
  await assert.rejects(work.then(result => {
    console.log(JSON.stringify({ unexpected_success: result.removed === true,
      remote_calls: native.remoteCalls(), finalizer_calls: native.finalizeAttempts(),
      inserted_original_retained: storage.value(key) === raw }));
    return result;
  }));
  assert.equal(storage.value(key), raw);
  assert.equal(native.remoteCalls(), 0);
  assert.equal(native.finalizeAttempts(), 0);
  assert.equal(owner.getStatus().ready, false);
  assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
  console.log('NEW removal keyset insertion during actual deferred inspection retained/refused (synthetic source callbacks only)');
  process.exit(0);
}

if (process.argv.includes('--removal-original-keyset-new-only')) {
  const prefixes = ['mz_scan_authority_snapshot:', 'mz_scan_contract_cache:', 'mz_custodial_home_cache:',
    'mz_employee_schedule_snapshot:', 'mz_employee_events_snapshot:'];
  const unknown = '{new ambiguous original cache, retained without adoption';
  const cases = {
    async eachOwnedPrefixDuringProtectedRead() {
      for (const prefix of prefixes) {
        const storage = storageFixture(nativeRemovalLocalFixture());
        const native = nativeRemovalHarness(storage);
        let armed = false, inserted = false;
        const key = `${prefix}new-original`;
        // Removal first reconciles state, then captures its fixed keys. Insert
        // only on the following protectedSnapshot get, after that capture.
        let removalReads = 0;
        const actualGet = native.plugin.getState;
        // This is a private source-fixture callback, not a replacement guard.
        const readPlugin = { ...native.plugin, async getState() {
          if (armed && ++removalReads === 2) { inserted = true; storage.setItem(key, unknown); }
          return actualGet();
        } };
        const bound = nativeRemovalStore(readPlugin, storage);
        await bound.ensureSecurityState();
        armed = true;
        await assert.rejects(bound.removeEnrollment({ beforeRemove: native.remoteComplete }));
        assert.equal(inserted, true);
        assert.equal(storage.value(key), unknown);
        assert.equal(native.remoteCalls(), 0);
        assert.equal(native.finalizeAttempts(), 0);
        assert.equal(bound.getStatus().ready, false);
      }
    },
    async remoteCallbackAddition() {
      const storage = storageFixture(nativeRemovalLocalFixture());
      const native = nativeRemovalHarness(storage), owner = nativeRemovalStore(native.plugin, storage);
      await owner.ensureSecurityState();
      const key = `${prefixes[0]}remote-original`;
      await assert.rejects(owner.removeEnrollment({ beforeRemove: async args => {
        await native.remoteComplete(args);
        storage.setItem(key, unknown);
      } }));
      assert.equal(storage.value(key), unknown);
      assert.equal(native.remoteCalls(), 1);
      assert.equal(native.finalizeAttempts(), 0);
      assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
      assert.equal(owner.getStatus().ready, false);
    },
    async additionAtCleanupAndRollback() {
      const oldKey = `${prefixes[1]}original`, newKey = `${prefixes[1]}inserted-original`;
      const original = 'exact original cache bytes';
      const storage = storageFixture({ ...nativeRemovalLocalFixture(), [oldKey]: original });
      const native = nativeRemovalHarness(storage), owner = nativeRemovalStore(native.plugin, storage);
      await owner.ensureSecurityState();
      const remove = storage.removeItem;
      storage.removeItem = key => {
        remove(key);
        if (key === oldKey) storage.setItem(newKey, unknown);
      };
      await assert.rejects(owner.removeEnrollment({ beforeRemove: native.remoteComplete }));
      assert.equal(storage.value(newKey), unknown);
      assert.equal(storage.value(oldKey), original, 'Own deleted original is restored, new row never removed');
      for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), deviceId);
      assert.equal(storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), seal);
      assert.equal(native.finalizeAttempts(), 0);
      assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
      assert.equal(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY), undefined, 'Membership uncertainty must not generate recovery metadata');
      assert.equal(owner.getStatus().ready, false);
    },
    async legitimateCacheMembershipCleanup() {
      const caches = Object.fromEntries(prefixes.map(prefix => [`${prefix}original`, 'original cache bytes']));
      const storage = storageFixture({ ...nativeRemovalLocalFixture(), ...caches });
      const native = nativeRemovalHarness(storage), owner = nativeRemovalStore(native.plugin, storage);
      await owner.ensureSecurityState();
      assert.equal((await owner.removeEnrollment({ beforeRemove: native.remoteComplete })).removed, true);
      for (const key of Object.keys(caches)) assert.equal(storage.value(key), undefined);
      assert.equal(native.finalizeAttempts(), 1);
      assert.equal(JSON.parse(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY)).operation_id, removalOperationId);
      assert.equal(owner.getStatus().ready, true);
    },
    async ownCacheCommittedThrowRollback() {
      for (const after of [false, true]) {
        const key = `${prefixes[2]}original`, raw = 'retained original cache';
        const storage = storageFixture({ ...nativeRemovalLocalFixture(), [key]: raw },
          { operation: 'remove', key, after });
        const native = nativeRemovalHarness(storage), owner = nativeRemovalStore(native.plugin, storage);
        await owner.ensureSecurityState();
        await assert.rejects(owner.removeEnrollment({ beforeRemove: native.remoteComplete }));
        assert.equal(storage.value(key), raw);
        assert.equal(storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), seal);
        assert.equal(native.finalizeAttempts(), 0);
        assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
        assert.equal(owner.getStatus().ready, false);
      }
    },
    async unrelatedRowIsNotInCacheFence() {
      const key = 'ordinary_fixture_preference';
      const storage = storageFixture(nativeRemovalLocalFixture());
      const native = nativeRemovalHarness(storage), owner = nativeRemovalStore(native.plugin, storage);
      await owner.ensureSecurityState();
      const get = storage.getItem;
      storage.getItem = item => { if (item === key) throw Error('Unrelated row value must not be read'); return get(item); };
      assert.equal((await owner.removeEnrollment({ beforeRemove: async args => {
        storage.setItem(key, 'unrelated unchanged bytes');
        await native.remoteComplete(args);
      } })).removed, true);
      assert.equal(storage.value(key), 'unrelated unchanged bytes');
      assert.equal(native.finalizeAttempts(), 1);
    },
    async lateFinalizerAdditionRemainsUnconfirmed() {
      const key = `${prefixes[4]}late-original`;
      const storage = storageFixture(nativeRemovalLocalFixture());
      const native = nativeRemovalHarness(storage);
      const owner = nativeRemovalStore({ ...native.plugin, async finalizeRemoval(args) {
        const result = await native.plugin.finalizeRemoval(args);
        storage.setItem(key, unknown);
        return result;
      } }, storage);
      await owner.ensureSecurityState();
      await assert.rejects(owner.removeEnrollment({ beforeRemove: native.remoteComplete }));
      assert.equal(storage.value(key), unknown);
      assert.equal(native.finalizeAttempts(), 1, 'Browser refusal does not undo synthetic native finalization');
      assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
      assert.equal(owner.getStatus().ready, false);
      for (const deviceKey of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(deviceKey), deviceId);
    },
  };
  const selected = process.argv.find(value => value.startsWith('--removal-keyset-new-case='))?.split('=')[1];
  const entries = Object.entries(cases).filter(([name]) => !selected || name === selected);
  assert.ok(entries.length, 'Unknown affected removal keyset case');
  for (const [name, work] of entries) { await work(); console.log(`NEW removal keyset ${name} PASS (source/synthetic callbacks only)`); }
  process.exit(0);
}

if (process.argv.includes('--original-retirement-only')) {
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const original = JSON.stringify(JSON.parse(pendingRecoveryFixture({ flow: 'enrollment' })[CUSTODIAL_ENROLLMENT_OPERATION_KEY]));
  const cancelled = { state: 'CANCELLED', enrollment_terminal: true,
    cancelled_enrollment: { operation_id: operationId, device_id: deviceId, flow: 'enrollment', status: 'cancelled' } };
  const terminal = JSON.stringify({ schema_version: 1, operation_id: removalOperationId,
    device_id: deviceId, phase: 'server_logged_out', created_at: '2026-08-01T01:00:00Z' });
  const cases = {
    async stateReplacement() {
      const storage = storageFixture({ [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: original });
      const wait = deferred();
      const owner = createNativeProtectedStorage({ getState: () => wait.promise }, storage);
      const work = owner.reconcileLocalState();
      const replacement = original.replace('01:05:00', '01:06:00');
      storage.setItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY, replacement);
      wait.resolve(cancelled);
      await assert.rejects(work);
      assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), replacement);
    },
    async effectReplacement() {
      const storage = storageFixture({ [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: original });
      const set = storage.setItem;
      const replacement = original.replace(operationId, enrollmentOperationId);
      storage.setItem = (key, value) => { set(key, value); if (key === CUSTODIAL_DEVICE_KEYS[0]) set(CUSTODIAL_ENROLLMENT_OPERATION_KEY, replacement); };
      await assert.rejects(stateAdapter(storage, activeNativeState({ operation: operationId })).reconcileLocalState());
      assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), replacement);
    },
    async corruptOriginals() {
      for (const [key, state] of [
        [CUSTODIAL_ENROLLMENT_OPERATION_KEY, cancelled],
        [CUSTODIAL_ENROLLMENT_OPERATION_KEY, activeNativeState({ operation: operationId })],
        [CUSTODIAL_REMOVAL_COMPLETION_KEY, { state: 'EMPTY' }],
      ]) {
        const raw = '{retained original, unsupported JSON';
        const storage = storageFixture({ [key]: raw });
        await assert.rejects(stateAdapter(storage, state).reconcileLocalState());
        assert.equal(storage.value(key), raw);
      }
      for (const raw of ['', '[]', JSON.stringify({ ...JSON.parse(original), schema_version: 2 })]) {
        const storage = storageFixture({ [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: raw });
        await assert.rejects(stateAdapter(storage, cancelled).reconcileLocalState());
        assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), raw);
      }
    },
    async finalizeStateReplacement() {
      const storage = storageFixture({ [CUSTODIAL_REMOVAL_OPERATION_KEY]: terminal });
      const native = nativeRemovalHarness(storage);
      await native.remoteComplete({ operationId: removalOperationId, deviceId, checkpoint: async () => {} });
      const before = await native.plugin.getState();
      const wait = deferred(); let calls = 0;
      const owner = createNativeProtectedStorage({ getState: () => wait.promise,
        finalizeRemoval: async args => { calls++; return native.plugin.finalizeRemoval(args); } }, storage);
      const work = owner.finalizeRemoval(removalOperationId, deviceId);
      const replacement = terminal.replace(removalOperationId, enrollmentOperationId);
      storage.setItem(CUSTODIAL_REMOVAL_OPERATION_KEY, replacement);
      wait.resolve(before);
      await assert.rejects(work);
      assert.equal(calls, 0);
      assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), replacement);
    },
    async foreignRemovalJournal() {
      const raw = original.replace(deviceId, 'KIOSK_08');
      const storage = storageFixture({ [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: raw });
      const native = nativeRemovalHarness(storage);
      await native.remoteComplete({ operationId: removalOperationId, deviceId, checkpoint: async () => {} });
      await assert.rejects(createNativeProtectedStorage(native.plugin, storage).reconcileLocalState());
      assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), raw);
    },
    async finalizeResponseReplacement() {
      const storage = storageFixture({ [CUSTODIAL_REMOVAL_OPERATION_KEY]: terminal });
      const native = nativeRemovalHarness(storage);
      await native.remoteComplete({ operationId: removalOperationId, deviceId, checkpoint: async () => {} });
      const waiting = deferred(), entered = deferred();
      const owner = createNativeProtectedStorage({ getState: native.plugin.getState,
        finalizeRemoval: async args => { const response = await native.plugin.finalizeRemoval(args); entered.resolve(); await waiting.promise; return response; } }, storage);
      const work = owner.finalizeRemoval(removalOperationId, deviceId);
      await entered.promise;
      const replacement = terminal.replace('01:00:00', '01:00:01');
      storage.setItem(CUSTODIAL_REMOVAL_OPERATION_KEY, replacement);
      waiting.resolve();
      await assert.rejects(work);
      assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), replacement);
    },
    async boundOriginalControls() {
      const storage = storageFixture({ [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: original, 'mz_scan_queue:original': 'retained original work' });
      await stateAdapter(storage, cancelled).reconcileLocalState();
      assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
      assert.equal(storage.value('mz_scan_queue:original'), 'retained original work');
      const removalStorage = storageFixture({ [CUSTODIAL_REMOVAL_OPERATION_KEY]: terminal });
      const native = nativeRemovalHarness(removalStorage);
      await native.remoteComplete({ operationId: removalOperationId, deviceId, checkpoint: async () => {} });
      assert.equal(await createNativeProtectedStorage(native.plugin, removalStorage).finalizeRemoval(removalOperationId, deviceId), true);
      assert.equal(removalStorage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), terminal);
    },
    async callerRollbackBoundary() {
      if (process.argv.includes('--removal-inspection-change-only')) {
        const key = 'mz_employee_schedule_snapshot:original';
        const local = storageFixture({ ...nativeRemovalLocalFixture(), [key]: 'original cached bytes' });
        const originalNative = nativeRemovalHarness(local), inspecting = deferred(), resume = deferred();
        let armed = false;
        const owner = createCustodialCredentialStore({ storage: local,
          secureStorage: createNativeProtectedStorage(originalNative.plugin, local),
          indexedDb: { async databases() { if (armed) { inspecting.resolve(); await resume.promise; } return []; }, open() { throw new Error('Absent original database must not open'); } },
          cryptoApi: { randomUUID: () => removalOperationId }, now: () => '2026-08-01T02:15:00.000Z' });
        await owner.ensureSecurityState(); armed = true;
        const work = owner.removeEnrollment({ beforeRemove: originalNative.remoteComplete });
        await inspecting.promise;
        local.setItem(key, 'foreign replacement cached bytes'); resume.resolve();
        await assert.rejects(work);
        assert.equal(local.value(key), 'foreign replacement cached bytes');
        assert.equal(originalNative.finalizeAttempts(), 0);
        console.log('CALLER_ROLLBACK_NEW inspection await preserves changed original PASS');
        return;
      }
      const storage = storageFixture(nativeRemovalLocalFixture());
      const native = nativeRemovalHarness(storage), entered = deferred(), waiting = deferred();
      const store = nativeRemovalStore({ getState: native.plugin.getState,
        finalizeRemoval: async args => { const response = await native.plugin.finalizeRemoval(args); entered.resolve(); await waiting.promise; return response; } }, storage);
      await store.ensureSecurityState();
      const work = store.removeEnrollment({ beforeRemove: native.remoteComplete });
      await Promise.race([entered.promise, work.then(() => { throw new Error('Missing original finalizer boundary'); })]);
      const replacement = terminal.replace(removalOperationId, enrollmentOperationId);
      storage.setItem(CUSTODIAL_REMOVAL_OPERATION_KEY, replacement);
      waiting.resolve();
      await assert.rejects(work);
      assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), replacement,
        'The owning credential-store rollback must retain a changed original row');
      assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
      assert.equal(store.getStatus().ready, false);
      assert.equal(native.state().removal_finalized, true, 'Lost local ownership does not undo native finalization');

      const clean = storageFixture(nativeRemovalLocalFixture());
      const cleanNative = nativeRemovalHarness(clean), cleanStore = nativeRemovalStore(cleanNative.plugin, clean);
      await cleanStore.ensureSecurityState();
      assert.equal((await cleanStore.removeEnrollment({ beforeRemove: cleanNative.remoteComplete })).removed, true);
      assert.equal(clean.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);
      assert.equal(JSON.parse(clean.value(CUSTODIAL_REMOVAL_COMPLETION_KEY)).operation_id, removalOperationId);
      assert.equal(cleanNative.remoteCalls(), 1); assert.equal(cleanNative.finalizeAttempts(), 1);

      // Newly affected partial writes: the fixture supports errors both before
      // and after the real Storage effect. Each case runs the actual caller.
      for (const key of [CUSTODIAL_INSTALLATION_MARKER_KEY, CUSTODIAL_REMOVAL_COMPLETION_KEY, CUSTODIAL_REMOVAL_OPERATION_KEY]) {
        for (const after of [false, true]) {
          const operation = key === CUSTODIAL_REMOVAL_COMPLETION_KEY ? 'set' : 'remove';
          const partial = storageFixture(nativeRemovalLocalFixture(), { operation, key, after });
          const partialNative = nativeRemovalHarness(partial), partialStore = nativeRemovalStore(partialNative.plugin, partial);
          await partialStore.ensureSecurityState();
          await assert.rejects(partialStore.removeEnrollment({ beforeRemove: partialNative.remoteComplete }));
          for (const deviceKey of CUSTODIAL_DEVICE_KEYS) assert.equal(partial.value(deviceKey), deviceId);
          assert.equal(partial.value(CUSTODIAL_INSTALLATION_MARKER_KEY), seal);
          const retained = JSON.parse(partial.value(CUSTODIAL_REMOVAL_OPERATION_KEY));
          assert.equal(retained.operation_id, removalOperationId); assert.equal(retained.phase, 'server_logged_out');
          assert.equal(partial.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
          assert.equal(partialStore.getStatus().ready, false);
          assert.equal(partialNative.finalizeAttempts(), key === CUSTODIAL_INSTALLATION_MARKER_KEY ? 0 : 1);
        }
      }

      const reentrant = storageFixture(nativeRemovalLocalFixture());
      const reentrantNative = nativeRemovalHarness(reentrant), reentrantStore = nativeRemovalStore(reentrantNative.plugin, reentrant);
      await reentrantStore.ensureSecurityState();
      const write = reentrant.setItem;
      reentrant.setItem = (key, value) => {
        write(key, value);
        if (key === CUSTODIAL_REMOVAL_COMPLETION_KEY) write(CUSTODIAL_REMOVAL_OPERATION_KEY, replacement);
      };
      await assert.rejects(reentrantStore.removeEnrollment({ beforeRemove: reentrantNative.remoteComplete }));
      assert.equal(reentrant.value(CUSTODIAL_REMOVAL_OPERATION_KEY), replacement);
      assert.equal(reentrant.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined, 'Own acknowledgement is withdrawn on a changed journal');

      const checkpointStorage = storageFixture(nativeRemovalLocalFixture());
      const checkpointNative = nativeRemovalHarness(checkpointStorage), checkpointStore = nativeRemovalStore(checkpointNative.plugin, checkpointStorage);
      await checkpointStore.ensureSecurityState();
      await assert.rejects(checkpointStore.removeEnrollment({ beforeRemove: async args => {
        checkpointStorage.setItem(CUSTODIAL_REMOVAL_OPERATION_KEY, replacement);
        await checkpointNative.remoteComplete(args);
      } }));
      assert.equal(checkpointStorage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), replacement);
      assert.equal(checkpointStorage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
      assert.equal(checkpointNative.finalizeAttempts(), 0);
      console.log('CALLER_ROLLBACK_NEW original/positive/6partial/reentrant/checkpoint cases PASS');
    },
  };
  const selection = process.argv.find(arg => arg.startsWith('--original-retirement-case='))?.split('=')[1];
  for (const [name, run] of Object.entries(cases)) if (!selection || selection === name) { await run(); console.log(`ORIGINAL_RETIREMENT_NEW ${name} PASS`); }
  if (selection) assert.ok(Object.hasOwn(cases, selection));
  process.exit(0);
}

// Credential recovery owns a new operation, but the installation belongs to
// the original enrollment. Native authority must not conflate these identities.
if(process.argv.includes('--malformed-enrollment-preservation-only')) {
  const cancelled={schema_version:2,state:'CANCELLED',blocked:false,enrollment_terminal:true,
    cancelled_operation_id:operationId,cancelled_device_id:deviceId,
    cancelled_enrollment:{operation_id:operationId,device_id:deviceId,flow:'enrollment',status:'cancelled'}};
  const results=[];
  for(const phase of ['CANCELLED','ACTIVE','REMOVAL_TOMBSTONE']) {
    const original='{unreadable '+phase+' original journal';
    const storage=storageFixture({[CUSTODIAL_ENROLLMENT_OPERATION_KEY]:original,
      'session:retained-original':'{ protected original cleaning bytes }'});
    let adapter,native;
    if(phase==='REMOVAL_TOMBSTONE') {
      native=nativeRemovalHarness(storage);
      await native.remoteComplete({operationId:removalOperationId,deviceId,checkpoint:async()=>{}});
      adapter=createNativeProtectedStorage(native.plugin,storage);
    }else adapter=stateAdapter(storage,phase==='ACTIVE'?activeNativeState():cancelled);
    await assertUnknownEnrollmentPreserved(adapter,storage);
    assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY),original);
    if(native)assert.equal(native.state().state,'REMOVAL_TOMBSTONE');
    results.push('preserve unknown original in '+phase);
  }
  // Positive controls use the same real reconciliation adapter and exact native
  // binding, so the refusal checks cannot pass merely by disabling all writes.
  const cancelledStorage=storageFixture({[CUSTODIAL_ENROLLMENT_OPERATION_KEY]:
    pendingRecoveryFixture({flow:'enrollment'})[CUSTODIAL_ENROLLMENT_OPERATION_KEY]});
  await stateAdapter(cancelledStorage,cancelled).reconcileLocalState();
  assert.equal(cancelledStorage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY),undefined);
  results.push('matching cancellation retires exact journal');
  const activeStorage=storageFixture({[CUSTODIAL_ENROLLMENT_OPERATION_KEY]:JSON.stringify(activeEnrollmentJournal())});
  await stateAdapter(activeStorage,activeNativeState()).reconcileLocalState();assertActiveBinding(activeStorage);
  assert.equal(activeStorage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY),undefined);
  results.push('matching ACTIVE establishes binding and retires exact journal');
  const removalStorage=storageFixture({[CUSTODIAL_ENROLLMENT_OPERATION_KEY]:JSON.stringify(activeEnrollmentJournal())});
  const removal=nativeRemovalHarness(removalStorage);
  await removal.remoteComplete({operationId:removalOperationId,deviceId,checkpoint:async()=>{}});
  await createNativeProtectedStorage(removal.plugin,removalStorage).reconcileLocalState();
  assert.equal(removalStorage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY),undefined);
  assert.equal(JSON.parse(removalStorage.value(CUSTODIAL_REMOVAL_OPERATION_KEY)).operation_id,removalOperationId);
  assert.equal(removal.state().state,'REMOVAL_TOMBSTONE');
  results.push('matching removal retains revoked native state and exact terminal journal');
  console.log(JSON.stringify({status:'PASS_MALFORMED_ENROLLMENT_PRESERVATION',cases:results.length,results,
    limits:'actual JS reconciliation with synthetic native state and storage; no real credentials, native recovery or physical acceptance'}));
  process.exit(0);
}

{
  const storage = storageFixture(pendingRecoveryFixture());
  const native = pendingNativeState();
  native.installation.enrollment_operation_id = enrollmentOperationId;
  native.installation.enrolled_at = '2026-01-01T00:00:00.000Z';
  await stateAdapter(storage, native).reconcileLocalState();
  const record = JSON.parse(await stateAdapter(storage, native).get(CUSTODIAL_INSTALLATION_RECORD_KEY));
  assert.equal(record.enrollment_operation_id, enrollmentOperationId);
  assert.equal(record.credential_operation_id, operationId);
  native.state = 'ACTIVE';
  native.pending_operation_id = '';
  native.active_enrollment_operation_id = operationId;
  native.active_enrollment_flow = 'recovery';
  await stateAdapter(storage, native).reconcileLocalState();
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
  assert.equal(native.installation.enrolled_at, '2026-01-01T00:00:00.000Z');
}

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

// The real adapter may recover a migrated installation with no historical
// enrollment UUID only from the strict native terminal-derived v2 principal.
function legacyActiveNativeState(){
  const state=activeNativeState({operation:'',flow:'recovery'});
  state.active_enrollment_operation_id=operationId;
  state.active_device_id=deviceId;
  state.installation.migrated_from_credential_only_state=true;
  state.installation.enrollment_operation_id=null;
  state.principal={schema_version:'custodial-protected-principal.v2',device_id:deviceId,
    employee_id:'11000000-0000-4000-8000-000000000001',assignment_epoch:7,
    credential_id:'11000000-0000-4000-8000-000000000002',activation_operation_id:operationId,
    activation_receipt_sha256:'a'.repeat(64),legacy_binding_id:'11000000-0000-4000-8000-000000000003',
    legacy_binding_kind:'authenticated_legacy_installation_observation',installation_binding_sha256:'b'.repeat(64),
    installation_seal:seal,enrolled_at:state.installation.enrolled_at};
  state.assigned_activation={schema_version:'native-assigned-activation-legacy.v1',operation_id:operationId,
    device_id:deviceId,credential_id:state.principal.credential_id,transition:'confirmed_recovery',
    installation_seal:seal,enrolled_at:state.installation.enrolled_at,
    installation_binding_sha256:state.principal.installation_binding_sha256,
    legacy_binding_id:state.principal.legacy_binding_id,legacy_binding_kind:state.principal.legacy_binding_kind};
  return state;
}
{
  const native=legacyActiveNativeState(),storage=storageFixture({'mz_scan_queue:synthetic':'retained exact work'});
  const a=stateAdapter(storage,native);await a.reconcileLocalState();
  const installation=JSON.parse(await a.get(CUSTODIAL_INSTALLATION_RECORD_KEY));
  assert.equal(installation.enrollment_operation_id,null);
  assert.equal(installation.enrolled_at,native.installation.enrolled_at);
  assert.equal(installation.installation_seal,seal);
  assert.equal(installation.credential_operation_id,operationId);
  assert.equal(storage.value('mz_scan_queue:synthetic'),'retained exact work');
  assert.equal(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY),undefined,'no invented browser recovery history');
}
for(const change of [
  n=>{n.principal=null;},n=>{delete n.assigned_activation;},
  n=>{n.principal.credential_operation_id=operationId;},
  n=>{n.installation.enrollment_operation_id=operationId;},
  n=>{delete n.installation.enrolled_at;},n=>{n.installation.migrated_from_credential_only_state=false;},
  ...['operation_id','device_id','credential_id','transition','installation_seal','enrolled_at',
    'installation_binding_sha256','legacy_binding_id','legacy_binding_kind'].map(k=>n=>{n.assigned_activation[k]='wrong';}),
  n=>{n.assigned_activation.lineage_operation_id=operationId;},
]){
  const native=legacyActiveNativeState();change(native);
  const storage=storageFixture({'mz_scan_queue:synthetic':'retained exact work'});
  await assert.rejects(()=>stateAdapter(storage,native).reconcileLocalState(),error=>/custodial_native_(?:binding|recovery_reconciliation)_mismatch/.test(error.code));
  assert.equal(storage.value('mz_scan_queue:synthetic'),'retained exact work');
  assert.equal(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY),undefined);
}
console.log('Strict legacy native commit reconciliation: 17 cases passed (synthetic native boundary).');

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

async function initializeRemovalCaller(store,storage) {
  // Inject failures only at the removal boundary under test. The maintained
  // bridge initializes the original owner before it can request removal.
  const priorQuarantine=storage.getItem(CUSTODIAL_RESTORE_QUARANTINE_KEY);
  try{await storage.withoutInjectedFailures(()=>store.ensureSecurityState());}
  catch(error){
    if(priorQuarantine!==null&&error.code==='custodial_restore_quarantine'){
      const original=JSON.parse(priorQuarantine);
      assert.equal(error.reason,original.reason);
      assert.equal(store.getStatus().recovery.recovery_id,original.recovery_id);
      assert.equal(store.getStatus().quarantined,true);
    }else{
      assert.equal(error.code,'custodial_enrollment_removal_pending');
      assert.deepEqual(error.operation,store.getRemovalRecord(),'only the observed original removal may resume');
    }
  }
  assert.equal(store.getStatus().initialized,true,'removal captures its initialized original caller');
}

function nativeRemovalStore(plugin, storage) {
  return createCustodialCredentialStore({
    secureStorage: createNativeProtectedStorage(plugin, storage),
    storage,
    // Zero-work removal requires an inspected empty browser inventory, not an
    // unavailable API treated as empty. Keep all native finalization assertions.
    indexedDb: {databases:async()=>[],open(){throw new Error('No absent database should be opened');}},
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
  // A native cancellation does not identify unreadable browser journal bytes.
  await assertUnknownEnrollmentPreserved(cancelledAdapter,storage);
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

// Only the protected maintenance receiver can supply this persisted native
// provenance. Missing browser proof alone never grants ordinary recovery.
{
  const current=activeNativeState({operation:enrollmentOperationId,flow:'recovery'});
  current.active_enrollment_operation_id=operationId;
  current.assigned_activation={schema_version:'native-assigned-activation.v1',operation_id:operationId,device_id:deviceId,
    flow:'recovery',installation_seal:seal,enrolled_at:current.installation.enrolled_at,lineage_operation_id:enrollmentOperationId};
  const storage=storageFixture({'mz_custodial_draft:preserved':'original saved work'});
  await stateAdapter(storage,current).reconcileLocalState();assertActiveBinding(storage);
  assert.equal(storage.value('mz_custodial_draft:preserved'),'original saved work');
  await stateAdapter(storage,current).reconcileLocalState();assertActiveBinding(storage);
  for(const field of ['operation_id','device_id','installation_seal','enrolled_at','lineage_operation_id']){
    const bad=structuredClone(current);bad.assigned_activation[field]='different';
    await assert.rejects(()=>stateAdapter(storageFixture(),bad).reconcileLocalState(),
      e=>e?.code==='custodial_native_recovery_reconciliation_mismatch');
  }
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
  for (const activeFlow of ['enrollment', 'recovery']) {
    const storage = storageFixture(initial);
    await stateAdapter(storage, activeNativeState({ flow: activeFlow })).reconcileLocalState();
    assertActiveBinding(storage);
    assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
  }
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
    (error) => error?.code === (mismatch.status==='cancelled'
      ?'custodial_native_operation_reconciliation_mismatch':'custodial_native_active_reconciliation_mismatch'),
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
  // Unknown local work is held; native ACTIVE is not authority to erase it.
  await assertUnknownEnrollmentPreserved(activeAdapter,storage);
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
    indexedDb: {databases:async()=>[],open(){throw new Error('No absent database should be opened');}},
    cryptoApi: { randomUUID: () => removalOperationId },
  });
  await initializeRemovalCaller(restarted,storage);
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
  const original=Array.from({length:storage.length},(_,index)=>storage.key(index)).sort().map(key=>[key,storage.getItem(key)]);
  await assert.rejects(()=>createNativeProtectedStorage(native.plugin,storage).reconcileLocalState(),
    {code:mismatch.device_id?'custodial_native_removal_reconciliation_mismatch':'custodial_native_operation_reconciliation_mismatch'});
  assert.deepEqual(Array.from({length:storage.length},(_,index)=>storage.key(index)).sort().map(key=>[key,storage.getItem(key)]),original);
  assert.equal(native.state().state,'REMOVAL_TOMBSTONE','unrelated browser journal cannot restore revoked credential');
}

{
  const storage = storageFixture({
    ...nativeRemovalLocalFixture(),
    [CUSTODIAL_ENROLLMENT_OPERATION_KEY]: '{malformed-superseded-enrollment',
  });
  const native = nativeRemovalHarness(storage);
  await native.remoteComplete({ operationId: removalOperationId, deviceId, checkpoint: async () => {} });
  await assertUnknownEnrollmentPreserved(createNativeProtectedStorage(native.plugin,storage),storage);
  assert.equal(native.state().state,'REMOVAL_TOMBSTONE','refusal never revives revoked native credentials');
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
  await initializeRemovalCaller(first,storage);
  await assert.rejects(
    () => first.removeEnrollment({ beforeRemove: native.remoteComplete }),
    (error) => /injected/.test(String(error?.cause?.message || error?.message || '')),
    failure.label,
  );
  assert.equal(native.remoteCalls(), 1, `${failure.label}: backend removal must happen once`);
  assert.notEqual(native.state().state, 'ACTIVE', `${failure.label}: revoked native credential must never be restored`);
  assert.ok(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), `${failure.label}: exact journal must remain restartable`);

  const restarted = nativeRemovalStore(native.plugin, storage);
  await initializeRemovalCaller(restarted,storage);
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

// This is the credential-store contract, not native removal admission. Current
// bridge/native preflight refuses removal until the original inventory/manager
// protocol exists. No synthetic successful revocation or native finalization is
// used to resolve this quarantine. The absent-credential, zero-work case matches
// the maintained mobile-contract-tests.mjs recovery-provenance control.
async function quarantineRemovalContractCases() {
  const snapshot = storage => Array.from({length:storage.length},(_,index)=>storage.key(index)).sort()
    .map(key=>[key,storage.getItem(key)]);
  {
    const storage = storageFixture(nativeRemovalLocalFixture({ recovery: true }));
    const native = nativeRemovalHarness(storage);
    const originalStorage = snapshot(storage), originalNative = native.state();
    for (const attempt of ['initial', 'restart']) {
      const owner = nativeRemovalStore(native.plugin, storage);
      await initializeRemovalCaller(owner, storage);
      assert.equal(owner.getStatus().quarantined, true);
      assert.equal(owner.getStatus().deviceId, '');
      await assert.rejects(() => owner.removeEnrollment({ beforeRemove: native.remoteComplete }),
        {code:'custodial_security_generation_changed'}, attempt);
      assert.deepEqual(snapshot(storage), originalStorage, `${attempt}: unknown caller binding preserves every original byte`);
      assert.deepEqual(native.state(), originalNative, `${attempt}: no protected state transition`);
      assert.equal(native.remoteCalls(), 0);
      assert.equal(native.finalizeAttempts(), 0);
    }
  }
  for (const failure of [
    { operation: 'set', key: CUSTODIAL_RECOVERY_RECORD_KEY, label: 'recovery resolution' },
    { operation: 'remove', key: CUSTODIAL_RESTORE_QUARANTINE_KEY, label: 'quarantine retirement' },
  ]) {
    const storage = storageFixture(nativeRemovalLocalFixture({ recovery: true }), failure);
    const originalStorage = snapshot(storage);
    const originalRecovery = JSON.parse(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY));
    const emptyNative = {schema_version:2,state:'EMPTY',active:false,blocked:false,credential_present:false};
    const plugin = {
      async getState() { return structuredClone(emptyNative); },
      async finalizeRemoval() { assert.fail('credential-absent cleanup has no native finalization authority'); },
    };
    const first = nativeRemovalStore(plugin, storage);
    await initializeRemovalCaller(first, storage);
    assert.equal(first.getStatus().quarantined, true);
    assert.equal(first.getStatus().preservedCounts.total_pending, 0, 'current inspected inventory is empty');
    await assert.rejects(
      () => first.removeEnrollment({ beforeRemove: async () => assert.fail('no protected credential may be sent') }),
      (error) => /injected/.test(String(error?.cause?.message || error?.message || '')),
      failure.label,
    );
    assert.deepEqual(snapshot(storage), originalStorage, `${failure.label}: exact original rollback`);
    const restarted = nativeRemovalStore(plugin, storage);
    await initializeRemovalCaller(restarted, storage);
    await restarted.removeEnrollment({ beforeRemove: async () => assert.fail('no backend replay') });
    const resolved = JSON.parse(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY));
    assert.equal(resolved.status, 'resolved');
    assert.equal(resolved.resolution.method, 'explicit_enrollment_removal');
    assert.equal(resolved.resolution.preserved_work_count, 0);
    for (const [key, value] of Object.entries(originalRecovery)) {
      if (key !== 'status') assert.deepEqual(resolved[key], value, `original recovery provenance ${key}`);
    }
    assert.equal(storage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
    assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);
    assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
    assert.equal(storage.value(CUSTODIAL_CREDENTIAL_KEY), undefined);
    for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), undefined);
    assert.equal(storage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), undefined);
    assert.equal((await restarted.ensureSecurityState()).state, 'unenrolled');
    assert.deepEqual(await plugin.getState(), emptyNative);
  }
  console.log(JSON.stringify({status:'PASS_QUARANTINE_REMOVAL_CONTRACT',cases:3,
    limits:'actual credential-store/native-state adapter with synthetic empty inventory; ACTIVE denial plus credential-absent cleanup only, no native removal admission/finalization or phone acceptance'}));
}
await quarantineRemovalContractCases();

// Native finalization itself is restart-safe both before the atomic write and
// after the write when the JavaScript caller loses the response.
for (const finalizeFailure of ['before_write', 'after_write']) {
  const storage = storageFixture(nativeRemovalLocalFixture());
  const native = nativeRemovalHarness(storage, { finalizeFailure });
  const first = nativeRemovalStore(native.plugin, storage);
  await initializeRemovalCaller(first,storage);
  await assert.rejects(
    () => first.removeEnrollment({ beforeRemove: native.remoteComplete }),
    (error) => /injected native/.test(String(error?.cause?.message || error?.message || '')),
  );
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY) != null, true);
  assert.equal(native.state().state, finalizeFailure === 'before_write' ? 'REMOVAL_TOMBSTONE' : 'EMPTY');
  const restarted = nativeRemovalStore(native.plugin, storage);
  await initializeRemovalCaller(restarted,storage);
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
  await initializeRemovalCaller(first,storage);
  await assert.rejects(
    () => first.removeEnrollment({ beforeRemove: native.remoteComplete }),
    (error) => error?.code === 'custodial_restore_quarantine'
      && error?.reason === 'enrollment_removal_rollback_failed',
  );
  assert.equal(native.state().state, 'EMPTY');
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);
  assert.equal(storage.value(CUSTODIAL_REMOVAL_COMPLETION_KEY), undefined);
  const restarted = nativeRemovalStore(native.plugin, storage);
  await initializeRemovalCaller(restarted,storage);
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
  await initializeRemovalCaller(restarted,storage);
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
