import assert from 'node:assert/strict';
import { Capacitor } from '@capacitor/core';

const DEVICE = 'ops-app-11111111-1111-4111-8111-111111111111';
const OPERATION = '22222222-2222-4222-8222-222222222222';

const originalNative = Capacitor.isNativePlatform;
const originalPlatform = Capacitor.getPlatform;
Capacitor.isNativePlatform = () => true;
Capacitor.getPlatform = () => 'android';

const module = await import(`../src/manager/native-security.js?contract=${Date.now()}`);
// The module-level production instance has no native bridge in Node. Attach a
// handler immediately so only explicit injected plugin instances drive tests.
await module.managerNativeSecurity.ready.catch(() => null);

function state(overrides = {}) {
  return {
    schema_version: 2,
    state: 'ACTIVE',
    revision: 8,
    active: true,
    blocked: false,
    reason: '',
    device_id: DEVICE,
    credential_present: true,
    pending_operation_id: '',
    pending_flow: '',
    legacy_pending: false,
    removal_operation_id: '',
    removal_pending: false,
    removal_finalized: false,
    ...overrides,
  };
}

function encodedJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

try {
  let current = state();
  let authorizedCalls = 0;
  const requests = [];
  const plugin = {
    async getState() { return current; },
    async authorizedRequest(request) {
      authorizedCalls += 1;
      requests.push(request);
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body_base64: encodedJson({
          ok: true,
          data: {
            session: {
              role: 'ops_manager',
              device_id: DEVICE,
              expires_at: '2099-01-01T00:00:00.000Z',
            },
            credential_id: '33333333-3333-4333-8333-333333333333',
            credential_present: true,
          },
        }),
      };
    },
  };
  const security = module.createManagerNativeSecurity({ plugin });
  await security.ready;
  const status = security.getStatus();
  assert.equal(status.active, true);
  assert.equal(status.device_id, DEVICE);
  assert.equal('credential_present' in status, false);
  assert.equal('installation' in status, false);
  for (const capability of ['readCredential', 'writeCredential', 'commitEnrollment', 'confirmEnrollment']) {
    assert.equal(capability in security, false, `${capability} must not cross the WebView facade`);
  }

  const response = await security.authorizedFetch('https://memphis-zoo-mcp.onrender.com/mobile-auth-api/session', {
    method: 'POST',
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.credential_id, '33333333-3333-4333-8333-333333333333');
  assert.deepEqual(requests[0], {
    path: '/mobile-auth-api/session',
    method: 'POST',
    headers: {},
    body_base64: '',
  });

  for (const [url, init, code] of [
    ['https://evil.example/scan-api/health', {}, 'manager_native_origin_refused'],
    ['https://memphis-zoo-mcp.onrender.com/scan-api/health#fragment', {}, 'manager_native_origin_refused'],
    ['https://memphis-zoo-mcp.onrender.com/scan-api/health', { headers: { Authorization: 'Bearer attacker' } }, 'manager_native_headers_refused'],
    ['https://memphis-zoo-mcp.onrender.com/scan-api/health', { headers: { Cookie: 'secret=1' } }, 'manager_native_headers_refused'],
  ]) {
    await assert.rejects(
      () => security.authorizedFetch(url, init),
      (error) => error?.code === code,
    );
  }
  assert.equal(authorizedCalls, 1, 'hostile requests must fail before native dispatch');

  const secretResponsePlugin = {
    async getState() { return state(); },
    async authorizedRequest() {
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body_base64: encodedJson({ ok: true, data: { csrf_token: 'must-not-cross' } }),
      };
    },
  };
  const secretResponseSecurity = module.createManagerNativeSecurity({ plugin: secretResponsePlugin });
  await secretResponseSecurity.ready;
  await assert.rejects(
    () => secretResponseSecurity.authorizedFetch('https://memphis-zoo-mcp.onrender.com/scan-api/health'),
    (error) => error?.code === 'manager_native_secret_response_refused',
  );

  let resumeCalls = 0;
  let enrollCalls = 0;
  current = state({
    state: 'ENROLLMENT_DISPATCHED', active: false, device_id: DEVICE,
    pending_operation_id: OPERATION, pending_flow: 'enrollment',
  });
  const pendingPlugin = {
    async getState() { return current; },
    async enroll() { enrollCalls += 1; throw new Error('must resume the durable operation'); },
    async resumeEnrollment(options) {
      resumeCalls += 1;
      assert.deepEqual(options, { operation_id: OPERATION });
      current = state();
      return { payload: { data: { operation_id: OPERATION, replayed: true, vault_state: current } } };
    },
  };
  const pendingSecurity = module.createManagerNativeSecurity({ plugin: pendingPlugin });
  await pendingSecurity.ready;
  const resumed = await pendingSecurity.enroll({ code: '1234 5678' });
  assert.equal(resumed.state.active, true);
  assert.equal(resumeCalls, 1);
  assert.equal(enrollCalls, 0);

  let submitted = null;
  current = state({ state: 'EMPTY', active: false, device_id: '' });
  const emptyPlugin = {
    async getState() { return current; },
    async enroll(options) {
      submitted = options;
      current = state();
      return { payload: { data: { operation_id: options.operation_id, replayed: false, vault_state: current } } };
    },
  };
  const emptySecurity = module.createManagerNativeSecurity({ plugin: emptyPlugin });
  await emptySecurity.ready;
  await emptySecurity.enroll({ code: '12345678' });
  assert.match(submitted.operation_id, /^[0-9a-f-]{36}$/);
  assert.equal(submitted.enrollment_code, '12345678');
  assert.equal(submitted.flow, 'enrollment');
  assert.equal('device_id' in submitted, false, 'WebView must not choose the native installation identity');

  process.stdout.write('Manager native WebView boundary contract tests passed.\n');
} finally {
  Capacitor.isNativePlatform = originalNative;
  Capacitor.getPlatform = originalPlatform;
}
