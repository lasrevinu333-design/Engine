import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Capacitor } from '@capacitor/core';

const DEVICE = 'ops-app-11111111-1111-4111-8111-111111111111';
const OPERATION = '22222222-2222-4222-8222-222222222222';
const AUTHORIZED_ROUTES = JSON.parse(await readFile(
  new URL('../contracts/manager-authorized-routes-v2.json', import.meta.url),
  'utf8',
));
const SECRET_KEY_CONTRACT = JSON.parse(await readFile(
  new URL('../contracts/manager-secret-key-names-v2.json', import.meta.url),
  'utf8',
));

const originalNative = Capacitor.isNativePlatform;
const originalPlatform = Capacitor.getPlatform;
Capacitor.isNativePlatform = () => true;
Capacitor.getPlatform = () => 'android';

const module = await import(`../src/manager/native-security.js?contract=${Date.now()}`);
await module.managerNativeSecurity.ready.catch(() => null);

function state(overrides = {}) {
  return {
    schema_version: 2,
    contract_version: 'manager-device-auth.v2',
    state: 'ACTIVE',
    revision: 8,
    active: true,
    blocked: false,
    reason: '',
    device_id: DEVICE,
    manager_id: '33333333-3333-4333-8333-333333333333',
    roles: ['OPS_MANAGER'],
    access_level: 'full_access',
    key_security_level: 'trusted_environment',
    pending_operation_id: '',
    pending_flow: '',
    removal_operation_id: '',
    removal_pending: false,
    ...overrides,
  };
}

function mutation(operationId, vaultState, replayed = false) {
  return { operation_id: operationId, replayed, vault_state: vaultState };
}

function encodedJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

try {
  assert.equal(SECRET_KEY_CONTRACT.contract_version, 'manager-secret-key-names.v2');
  assert.deepEqual(module.MANAGER_SECRET_KEY_NAMES, SECRET_KEY_CONTRACT.normalized_keys);
  let current = state();
  let authorizedCalls = 0;
  const requests = [];
  const plugin = {
    async getStatus() { return current; },
    async authorizedRequest(request) {
      authorizedCalls += 1;
      requests.push(request);
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body_base64: encodedJson({ ok: true, data: { healthy: true } }),
      };
    },
  };
  const security = module.createManagerNativeSecurity({ plugin });
  await security.ready;
  assert.equal(security.getStatus().active, true);
  assert.equal(security.getStatus().device_id, DEVICE);
  const canonicalLeadershipRoles = ['OPS_MANAGER', 'CUSTODIAL_MANAGER', 'DIRECTOR', 'SECURITY_ADMIN'];
  const canonicalRoleSecurity = module.createManagerNativeSecurity({
    plugin: { async getStatus() { return state({ roles: canonicalLeadershipRoles }); } },
  });
  assert.deepEqual((await canonicalRoleSecurity.ready).roles, canonicalLeadershipRoles);
  for (const roles of [
    ['CUSTODIAL_MANAGER'],
    ['OPS_MANAGER', 'DIRECTOR', 'CUSTODIAL_MANAGER'],
    ['OPS_MANAGER', 'CUSTODIAL_MANAGER', 'CUSTODIAL_MANAGER'],
    ['OPS_MANAGER', 'UNKNOWN_ROLE'],
  ]) {
    const invalidRoleSecurity = module.createManagerNativeSecurity({
      plugin: { async getStatus() { return state({ roles }); } },
    });
    await assert.rejects(
      invalidRoleSecurity.ready,
      (error) => error?.code === 'manager_native_state_invalid',
      `invalid role projection must fail closed: ${roles.join(',')}`,
    );
  }
  for (const pendingFlow of ['recover', 'replace']) {
    for (const pendingState of ['ENROLLING', 'PENDING_CONFIRMATION', 'CANCELLING']) {
      const activeTransitionSecurity = module.createManagerNativeSecurity({
        plugin: { async getStatus() {
          return state({
            state: pendingState, active: true, pending_operation_id: OPERATION,
            pending_flow: pendingFlow, roles: [], access_level: '',
          });
        } },
      });
      assert.equal((await activeTransitionSecurity.ready).active, true, `${pendingFlow}:${pendingState}`);
    }
  }
  for (const pendingFlow of ['enroll']) {
    const invalidActiveTransition = module.createManagerNativeSecurity({
      plugin: { async getStatus() {
        return state({
          state: 'ENROLLING', active: true, pending_operation_id: OPERATION,
          pending_flow: pendingFlow, roles: [], access_level: '',
        });
      } },
    });
    await assert.rejects(
      invalidActiveTransition.ready,
      (error) => error?.code === 'manager_native_state_invalid',
    );
  }
  for (const capability of [
    'readCredential', 'writeCredential', 'commitEnrollment', 'migrateLegacyEnrollment',
    'removeEnrollment', 'readSessionToken',
  ]) assert.equal(capability in security, false, `${capability} must not cross the WebView facade`);

  const response = await security.authorizedFetch('https://memphis-zoo-mcp.onrender.com/scan-api/health');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.healthy, true);
  assert.deepEqual(requests[0], {
    path: '/scan-api/health', method: 'GET', headers: {}, body_base64: '',
  });

  for (const [url, init, code] of [
    ['https://evil.example/scan-api/health', {}, 'manager_native_origin_refused'],
    ['https://memphis-zoo-mcp.onrender.com/scan-api/health#fragment', {}, 'manager_native_origin_refused'],
    ['https://memphis-zoo-mcp.onrender.com/scan-api/health', { headers: { Authorization: 'Bearer attacker' } }, 'manager_native_headers_refused'],
    ['https://memphis-zoo-mcp.onrender.com/scan-api/health', { headers: { Cookie: 'secret=1' } }, 'manager_native_headers_refused'],
  ]) {
    await assert.rejects(() => security.authorizedFetch(url, init), (error) => error?.code === code);
  }
  assert.equal(authorizedCalls, 1, 'hostile requests must fail before native dispatch');

  assert.equal(AUTHORIZED_ROUTES.contract_version, 'manager-authorized-routes.v2');
  assert.equal(AUTHORIZED_ROUTES.access_level, 'full_access');
  for (const route of AUTHORIZED_ROUTES.routes) {
    const method = String(route.method).toUpperCase();
    const mutating = !['GET', 'HEAD'].includes(method);
    const responseForRoute = await security.authorizedFetch(
      `https://memphis-zoo-mcp.onrender.com${route.example}`,
      mutating ? {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      } : { method },
    );
    assert.equal(responseForRoute.status, 200, `${method} ${route.example}`);
    assert.deepEqual(requests.at(-1), {
      path: route.example,
      method,
      headers: mutating ? { 'content-type': 'application/json' } : {},
      body_base64: mutating ? Buffer.from('{}', 'utf8').toString('base64') : '',
    }, `${method} ${route.example}`);
  }

  const secretResponseSecurity = module.createManagerNativeSecurity({
    plugin: {
      async getStatus() { return state(); },
      async authorizedRequest() {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body_base64: encodedJson({ ok: true, data: { session_token: 'must-not-cross' } }),
        };
      },
    },
  });
  await secretResponseSecurity.ready;
  await assert.rejects(
    () => secretResponseSecurity.authorizedFetch('https://memphis-zoo-mcp.onrender.com/scan-api/health'),
    (error) => error?.code === 'manager_native_secret_response_refused',
  );

  const opsSessionResponseSecurity = module.createManagerNativeSecurity({
    plugin: {
      async getStatus() { return state(); },
      async authorizedRequest() {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body_base64: encodedJson({ ok: true, data: { ops_session: 'opaque-native-session' } }),
        };
      },
    },
  });
  await opsSessionResponseSecurity.ready;
  await assert.rejects(
    () => opsSessionResponseSecurity.authorizedFetch('https://memphis-zoo-mcp.onrender.com/scan-api/health'),
    (error) => error?.code === 'manager_native_secret_response_refused',
  );

  const codeDisclosureSecurity = module.createManagerNativeSecurity({
    plugin: {
      async getStatus() { return state(); },
      async authorizedRequest() {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body_base64: encodedJson({ ok: true, data: { enrollment_code: '12345678' } }),
        };
      },
    },
  });
  await codeDisclosureSecurity.ready;
  const codeResponse = await codeDisclosureSecurity.authorizedFetch(
    'https://memphis-zoo-mcp.onrender.com/admin-api/device-auth/enrollment-code',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  );
  assert.equal((await codeResponse.json()).data.enrollment_code, '12345678');
  await assert.rejects(
    () => codeDisclosureSecurity.authorizedFetch('https://memphis-zoo-mcp.onrender.com/scan-api/health'),
    (error) => error?.code === 'manager_native_secret_response_refused',
  );

  let resumeCalls = 0;
  let enrollCalls = 0;
  current = state({
    state: 'ENROLLING', active: false, access_level: '', roles: [],
    key_security_level: 'trusted_environment', pending_operation_id: OPERATION, pending_flow: 'recover',
  });
  const pendingPlugin = {
    async getStatus() { return current; },
    async enroll() { enrollCalls += 1; throw new Error('must resume the durable operation'); },
    async resumeEnrollment(options) {
      resumeCalls += 1;
      assert.deepEqual(options, { operation_id: OPERATION });
      current = state({ state: 'PENDING_CONFIRMATION', active: false, access_level: '', roles: [], pending_operation_id: OPERATION, pending_flow: 'recover' });
      return mutation(OPERATION, current, true);
    },
  };
  const pendingSecurity = module.createManagerNativeSecurity({ plugin: pendingPlugin });
  await pendingSecurity.ready;
  const resumed = await pendingSecurity.enroll({ code: '1234 5678', flow: 'recover' });
  assert.equal(resumed.vault_state.pending_operation_id, OPERATION);
  assert.equal(resumeCalls, 1);
  assert.equal(enrollCalls, 0);

  current = state({
    state: 'ENROLLING', active: false, access_level: '', roles: [],
    key_security_level: 'trusted_environment', pending_operation_id: OPERATION, pending_flow: 'replace',
  });
  let replacementResumeCalls = 0;
  const pendingReplacementSecurity = module.createManagerNativeSecurity({
    plugin: {
      async getStatus() { return current; },
      async resumeEnrollment(options) {
        replacementResumeCalls += 1;
        assert.deepEqual(options, { operation_id: OPERATION });
        return mutation(OPERATION, current, true);
      },
    },
  });
  await pendingReplacementSecurity.ready;
  await pendingReplacementSecurity.enroll({ code: '12345678', flow: 'replace' });
  assert.equal(replacementResumeCalls, 1);
  await assert.rejects(
    () => pendingReplacementSecurity.enroll({ code: '12345678', flow: 'recover' }),
    (error) => error?.code === 'manager_native_enrollment_conflict',
  );
  assert.equal(replacementResumeCalls, 1, 'a mismatched flow must fail before native resume');

  let submitted = null;
  current = state({
    state: 'EMPTY', active: false, device_id: '', manager_id: '', roles: [],
    access_level: '', key_security_level: '',
  });
  const emptyPlugin = {
    async getStatus() { return current; },
    async enroll(options) {
      submitted = options;
      current = state({ state: 'PENDING_CONFIRMATION', active: false, roles: [], access_level: '', pending_operation_id: options.operation_id, pending_flow: 'enroll' });
      return mutation(options.operation_id, current);
    },
  };
  const emptySecurity = module.createManagerNativeSecurity({ plugin: emptyPlugin });
  await emptySecurity.ready;
  await emptySecurity.enroll({ code: '12345678', deviceLabel: 'Managed Pixel' });
  assert.match(submitted.operation_id, /^[0-9a-f-]{36}$/);
  assert.deepEqual({ ...submitted, operation_id: '<uuid>' }, {
    operation_id: '<uuid>',
    flow: 'enroll',
    enrollment_code: '12345678',
    device_label: 'Managed Pixel',
    requested_access_level: 'full_access',
  });
  assert.equal('device_id' in submitted, false, 'WebView must not choose the native installation identity');

  current = state({
    state: 'BLOCKED', active: false, blocked: true,
    reason: 'manager_native_replacement_required', roles: [], access_level: '', key_security_level: '',
  });
  let replacementSubmission = null;
  const replacementPlugin = {
    async getStatus() { return current; },
    async enroll(options) {
      replacementSubmission = options;
      current = state({
        state: 'PENDING_CONFIRMATION', active: false, blocked: false, reason: '',
        roles: [], access_level: '', pending_operation_id: options.operation_id,
        pending_flow: 'replace',
      });
      return mutation(options.operation_id, current);
    },
  };
  const replacementSecurity = module.createManagerNativeSecurity({ plugin: replacementPlugin });
  await replacementSecurity.ready;
  await replacementSecurity.enroll({ code: '12345678', flow: 'replace', deviceLabel: 'Replacement Pixel' });
  assert.equal(replacementSubmission.flow, 'replace');
  assert.equal(replacementSubmission.requested_access_level, 'full_access');

  current = state();
  let activeReplacementSubmission = null;
  const activeReplacementSecurity = module.createManagerNativeSecurity({
    plugin: {
      async getStatus() { return current; },
      async enroll(options) {
        activeReplacementSubmission = options;
        current = state({
          state: 'PENDING_CONFIRMATION', active: true,
          pending_operation_id: options.operation_id, pending_flow: 'replace',
          roles: [], access_level: '',
        });
        return mutation(options.operation_id, current);
      },
    },
  });
  await activeReplacementSecurity.ready;
  await activeReplacementSecurity.enroll({
    code: '12345678', flow: 'replace', deviceLabel: 'Rotated Manager Pixel',
  });
  assert.equal(activeReplacementSubmission.flow, 'replace');
  assert.equal(activeReplacementSubmission.requested_access_level, 'full_access');

  current = state({
    state: 'LEGACY_PENDING', active: false, blocked: false,
    reason: 'manager_native_replacement_required', device_id: '', manager_id: '',
    roles: [], access_level: '', key_security_level: '',
  });
  let legacyReplacementSubmission = null;
  const legacyReplacementSecurity = module.createManagerNativeSecurity({
    plugin: {
      async getStatus() { return current; },
      async enroll(options) {
        legacyReplacementSubmission = options;
        current = state({
          state: 'PENDING_CONFIRMATION', active: false, blocked: false, reason: '',
          roles: [], access_level: '', pending_operation_id: options.operation_id,
          pending_flow: 'replace',
        });
        return mutation(options.operation_id, current);
      },
    },
  });
  await legacyReplacementSecurity.ready;
  await legacyReplacementSecurity.enroll({ code: '12345678', flow: 'replace' });
  assert.equal(legacyReplacementSubmission.flow, 'replace');

  current = state({ state: 'EMPTY', active: false, device_id: '', manager_id: '', roles: [], access_level: '', key_security_level: '' });
  const refusedReplacement = module.createManagerNativeSecurity({ plugin: { async getStatus() { return current; } } });
  await refusedReplacement.ready;
  await assert.rejects(
    () => refusedReplacement.enroll({ code: '12345678', flow: 'replace' }),
    (error) => error?.code === 'manager_native_replacement_refused',
  );

  current = state({
    state: 'BLOCKED', active: false, blocked: true,
    reason: 'manager_native_replacement_required', roles: [], access_level: '', key_security_level: '',
  });
  let blockedRemoval = null;
  const blockedRemovalSecurity = module.createManagerNativeSecurity({
    plugin: {
      async getStatus() { return current; },
      async remove(options) {
        blockedRemoval = options;
        current = state({
          state: 'EMPTY', active: false, blocked: false, reason: '', device_id: '', manager_id: '',
          roles: [], access_level: '', key_security_level: '',
        });
        return mutation(options.operation_id, current);
      },
    },
  });
  await blockedRemovalSecurity.ready;
  await blockedRemovalSecurity.remove({ operationId: OPERATION });
  assert.deepEqual(blockedRemoval, { operation_id: OPERATION });

  let quarantinedState = state();
  const postFailureRefreshSecurity = module.createManagerNativeSecurity({
    plugin: {
      async getStatus() { return quarantinedState; },
      async authorizedRequest() {
        quarantinedState = state({
          state: 'BLOCKED', active: false, blocked: true,
          reason: 'manager_native_replacement_required', roles: [], access_level: '', key_security_level: '',
        });
        const error = new Error('local key authority failed');
        error.code = 'manager_native_replacement_required';
        throw error;
      },
    },
  });
  await postFailureRefreshSecurity.ready;
  await assert.rejects(
    () => postFailureRefreshSecurity.authorizedFetch('https://memphis-zoo-mcp.onrender.com/scan-api/health'),
    (error) => error?.code === 'manager_native_replacement_required',
  );
  assert.equal(postFailureRefreshSecurity.getStatus().state, 'BLOCKED');
  assert.equal(postFailureRefreshSecurity.getStatus().active, false);

  for (const platform of ['android', 'ios']) {
    for (const restartCase of [
      {
        initial: state({
          state: 'ENROLLING', active: false, roles: [], access_level: '',
          pending_operation_id: OPERATION, pending_flow: 'recover',
        }),
        expectedCalls: ['resume', 'confirm'],
      },
      {
        initial: state({
          state: 'PENDING_CONFIRMATION', active: false, roles: [], access_level: '',
          pending_operation_id: OPERATION, pending_flow: 'recover',
        }),
        expectedCalls: ['confirm'],
      },
      {
        initial: state({
          state: 'CANCELLING', active: false, roles: [], access_level: '',
          pending_operation_id: OPERATION, pending_flow: 'recover',
        }),
        expectedCalls: ['cancel'],
      },
      {
        initial: state({
          state: 'REMOVING', active: false, roles: [], access_level: '',
          pending_operation_id: '', pending_flow: '', removal_operation_id: OPERATION,
          removal_pending: true,
        }),
        expectedCalls: ['remove'],
      },
    ]) {
      Capacitor.getPlatform = () => platform;
      const calls = [];
      let restartState = restartCase.initial;
      const restartPlugin = {
        async getStatus() { return restartState; },
        async resumeEnrollment(options) {
          calls.push('resume');
          assert.deepEqual(options, { operation_id: OPERATION });
          restartState = state({
            state: 'PENDING_CONFIRMATION', active: false, roles: [], access_level: '',
            pending_operation_id: OPERATION, pending_flow: 'recover',
          });
          return mutation(OPERATION, restartState, true);
        },
        async confirmEnrollment(options) {
          calls.push('confirm');
          assert.deepEqual(options, { operation_id: OPERATION });
          restartState = state();
          return mutation(OPERATION, restartState, true);
        },
        async cancelEnrollment(options) {
          calls.push('cancel');
          assert.deepEqual(options, { operation_id: OPERATION });
          restartState = state({
            state: 'CANCELLED', active: false, roles: [], access_level: '', key_security_level: '',
            pending_operation_id: '', pending_flow: '',
          });
          return mutation(OPERATION, restartState, true);
        },
        async remove(options) {
          calls.push('remove');
          assert.deepEqual(options, { operation_id: OPERATION });
          restartState = state({
            state: 'EMPTY', active: false, roles: [], access_level: '', key_security_level: '',
            removal_operation_id: '', removal_pending: false,
          });
          return mutation(OPERATION, restartState, true);
        },
      };
      const restartedSecurity = module.createManagerNativeSecurity({ plugin: restartPlugin });
      await restartedSecurity.ready;
      const reconciled = await restartedSecurity.reconcilePendingState();
      assert.deepEqual(calls, restartCase.expectedCalls, `${platform} ${restartCase.initial.state}`);
      assert.equal(reconciled.pending_operation_id, '');
      assert.equal(reconciled.removal_pending, false);
    }
  }

  Capacitor.getPlatform = () => 'ios';
  const iosSecurity = module.createManagerNativeSecurity({ plugin: { async getStatus() { return state({ key_security_level: 'secure_enclave' }); } } });
  assert.equal((await iosSecurity.ready).key_security_level, 'secure_enclave');

  assert.throws(
    () => module.assertManagerSecretFree({ nested: { Authorization: 'Bearer attacker' } }),
    (error) => error?.code === 'manager_native_secret_response_refused',
  );
} finally {
  Capacitor.isNativePlatform = originalNative;
  Capacitor.getPlatform = originalPlatform;
}

console.log('Manager native security contract tests passed.');
