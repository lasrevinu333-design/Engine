const { expect, test } = require('@playwright/test');

const OUTPUT_ROOT = 'build/batch-0b-shell-browser/custodial';
const DEVICE_ID = 'KIOSK_08';

test('terminal bad code retires its native tombstone and corrected code succeeds with a fresh operation', async ({ page }) => {
  await page.addInitScript(({ deviceId }) => {
    const audit = { enrollmentOperations: [], confirmedOperations: [] };
    let state = {
      schema_version: 2,
      state: 'EMPTY',
      active: false,
      blocked: false,
      credential_present: false,
      enrollment_terminal: false,
      pending_operation_id: '',
      pending_device_id: '',
      pending_flow: '',
      removal_pending: false,
    };
    const installationFor = (operationId) => ({
      schema_version: 1,
      device_id: deviceId,
      installation_seal: `native-seal-${operationId}`,
      enrolled_at: '2026-08-01T17:00:00.000Z',
      migrated_from_credential_only_state: false,
      enrollment_operation_id: operationId,
    });
    const pendingState = (phase, operationId) => ({
      schema_version: 2,
      state: phase,
      active: false,
      blocked: false,
      credential_present: true,
      enrollment_terminal: false,
      pending_operation_id: operationId,
      pending_device_id: deviceId,
      pending_flow: 'enrollment',
      pending_server_confirmation: phase === 'PENDING_SERVER_CONFIRMATION',
      pending_enrollment: {
        operation_id: operationId,
        device_id: deviceId,
        flow: 'enrollment',
        credential_id: 'credential-row-safe-id',
        resume_expires_at: '2026-08-01T17:30:00.000Z',
      },
      installation: installationFor(operationId),
      removal_pending: false,
    });
    const activeState = (operationId) => ({
      schema_version: 2,
      state: 'ACTIVE',
      active: true,
      blocked: false,
      credential_present: true,
      enrollment_terminal: false,
      pending_operation_id: '',
      pending_device_id: '',
      pending_flow: '',
      pending_server_confirmation: false,
      active_enrollment_flow: 'enrollment',
      installation: installationFor(operationId),
      removal_pending: false,
    });
    const encode = (value) => btoa(unescape(encodeURIComponent(JSON.stringify(value))));

    window.androidBridge = {};
    window.Capacitor = {
      PluginHeaders: [{
        name: 'CustodialNativeVault',
        methods: [
          'getState',
          'enroll',
          'resumeEnrollment',
          'completeLocalBinding',
          'confirmEnrollment',
          'cancelEnrollment',
          'authorizedRequest',
          'removeEnrollment',
          'finalizeRemoval',
        ].map((name) => ({ name, rtype: 'promise' })),
      }],
      nativePromise(plugin, method, options = {}) {
        if (plugin !== 'CustodialNativeVault') return Promise.reject(new Error(`Unexpected native plugin ${plugin}`));
        if (method === 'getState') return Promise.resolve(structuredClone(state));
        if (method === 'enroll') {
          audit.enrollmentOperations.push(options.operation_id);
          if (audit.enrollmentOperations.length === 1) {
            state = {
              schema_version: 2,
              state: 'CANCELLED',
              active: false,
              blocked: false,
              credential_present: false,
              enrollment_terminal: true,
              cancelled_operation_id: options.operation_id,
              cancelled_device_id: deviceId,
              cancelled_enrollment: {
                operation_id: options.operation_id,
                device_id: deviceId,
                flow: 'enrollment',
                status: 'cancelled',
              },
              pending_operation_id: '',
              pending_device_id: '',
              pending_flow: '',
              removal_pending: false,
            };
            return Promise.reject(Object.assign(new Error('terminal enrollment rejection'), {
              code: 'custodial_native_enrollment_terminal',
              data: { status: 401, reason: 'invalid_enrollment_code' },
            }));
          }
          state = pendingState('CREDENTIAL_STAGED', options.operation_id);
          return Promise.resolve({
            status: 200,
            payload: {
              ok: true,
              data: {
                operation_id: options.operation_id,
                device_id: deviceId,
                flow: 'enrollment',
                credential_id: 'credential-row-safe-id',
                resume_expires_at: '2026-08-01T17:30:00.000Z',
                employee: { id: 'employee-safe-id', name: 'Karen Robinson' },
              },
            },
          });
        }
        if (method === 'completeLocalBinding') {
          state = pendingState('PENDING_SERVER_CONFIRMATION', options.operation_id);
          return Promise.resolve(structuredClone(state));
        }
        if (method === 'confirmEnrollment') {
          audit.confirmedOperations.push(options.operation_id);
          state = activeState(options.operation_id);
          return Promise.resolve(structuredClone(state));
        }
        if (method === 'authorizedRequest') {
          const payload = String(options.path || '').startsWith('/schedule-api/my-day-summary')
            ? { ok: true, data: { groups: [] } }
            : { ok: true, data: {} };
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            body_base64: encode(payload),
          });
        }
        return Promise.reject(new Error(`Unexpected CustodialNativeVault method ${method}`));
      },
    };
    window.__terminalEnrollmentAudit = audit;
  }, { deviceId: DEVICE_ID });

  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await expect(page.locator('#enrollment')).toBeVisible();
  await page.locator('#device-id').selectOption(DEVICE_ID);
  await page.locator('#code').fill('11111111');
  await page.locator('#enroll-submit').click();
  await expect(page.locator('#enroll-status')).toContainText('invalid or has already been used');
  await expect.poll(() => page.evaluate(() => window.MemphisCustodialSecurity.getPendingEnrollmentOperation())).toBeNull();

  await page.locator('#code').fill('22222222');
  await page.locator('#enroll-submit').click();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#areas-status')).toHaveText('Current areas loaded.');
  const audit = await page.evaluate(() => window.__terminalEnrollmentAudit);
  expect(audit.enrollmentOperations).toHaveLength(2);
  expect(audit.enrollmentOperations[1]).not.toBe(audit.enrollmentOperations[0]);
  expect(audit.confirmedOperations).toEqual([audit.enrollmentOperations[1]]);
});

test('cancel response loss retires the exact pending journal in the first restored boot', async ({ page }) => {
  await page.addInitScript(({ deviceId }) => {
    const operationId = '12345678-1234-4123-8123-123456789abc';
    localStorage.setItem('memphisZooCustodialEnrollmentOperationV1', JSON.stringify({
      schema_version: 1,
      operation_id: operationId,
      flow: 'enrollment',
      device_id: deviceId,
      recovery_id: null,
      status: 'pending_server',
      created_at: '2026-08-01T18:00:00.000Z',
    }));
    let state = {
      schema_version: 2,
      state: 'CANCEL_REQUESTED',
      active: false,
      blocked: false,
      credential_present: true,
      enrollment_terminal: false,
      pending_operation_id: operationId,
      pending_device_id: deviceId,
      pending_flow: 'enrollment',
      pending_server_confirmation: false,
      pending_enrollment: {
        operation_id: operationId,
        device_id: deviceId,
        flow: 'enrollment',
      },
      installation: {
        schema_version: 1,
        device_id: deviceId,
        installation_seal: 'cancel-response-loss-native-seal',
        enrolled_at: '2026-08-01T18:00:01.000Z',
        enrollment_operation_id: operationId,
        migrated_from_credential_only_state: false,
      },
      removal_pending: false,
    };
    const audit = { resumeCalls: 0 };
    window.androidBridge = {};
    window.Capacitor = {
      PluginHeaders: [{
        name: 'CustodialNativeVault',
        methods: ['getState', 'resumeEnrollment'].map((name) => ({ name, rtype: 'promise' })),
      }],
      nativePromise(plugin, method, options = {}) {
        if (plugin !== 'CustodialNativeVault') return Promise.reject(new Error(`Unexpected native plugin ${plugin}`));
        if (method === 'getState') return Promise.resolve(structuredClone(state));
        if (method === 'resumeEnrollment') {
          audit.resumeCalls += 1;
          if (options.operation_id !== operationId) return Promise.reject(new Error('wrong cancellation operation'));
          state = {
            schema_version: 2,
            state: 'CANCELLED',
            active: false,
            blocked: false,
            credential_present: false,
            enrollment_terminal: true,
            cancelled_operation_id: operationId,
            cancelled_device_id: deviceId,
            cancelled_enrollment: {
              operation_id: operationId,
              device_id: deviceId,
              flow: 'enrollment',
              status: 'cancelled',
            },
            pending_operation_id: '',
            pending_device_id: '',
            pending_flow: '',
            removal_pending: false,
          };
          return Promise.reject(Object.assign(new Error('native cancellation completed'), {
            code: 'custodial_native_enrollment_cancelled',
          }));
        }
        return Promise.reject(new Error(`Unexpected CustodialNativeVault method ${method}`));
      },
    };
    window.__cancelResponseLossAudit = audit;
  }, { deviceId: DEVICE_ID });

  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await expect(page.locator('#enrollment')).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    pending: window.MemphisCustodialSecurity.getPendingEnrollmentOperation(),
    stored: localStorage.getItem('memphisZooCustodialEnrollmentOperationV1'),
    resumes: window.__cancelResponseLossAudit.resumeCalls,
  }))).toEqual({ pending: null, stored: null, resumes: 1 });
  await expect(page.locator('#enroll-submit')).toBeEnabled();
});
