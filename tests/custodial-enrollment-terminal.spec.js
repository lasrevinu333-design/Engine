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
          'anchorOfflineAuthoritySnapshot',
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
        if (method === 'anchorOfflineAuthoritySnapshot') {
          return Promise.resolve({ anchored: true });
        }
        if (method === 'authorizedRequest') {
          const path = String(options.path || '');
          const payload = path.startsWith('/schedule-api/my-day-summary')
            ? { ok: true, data: { groups: [] } }
            : path.startsWith('/scan-api/rpc')
              ? {
                  ok: true,
                  data: {
                    schema_version: 'offline-scan-snapshot.v2',
                    contract_version: 'scan.v4.snapshot-bound-authority',
                    snapshot_id: '8888888888888888888888888888888888888888888888888888888888888888',
                    canonical_device_id: deviceId,
                    employee_id: '00000000-0000-4000-8000-000000000808',
                    credential_id: '80000000-0000-4000-8000-000000000008',
                    employee_name: 'Karen Robinson',
                    assignment_epoch: 1,
                    generated_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
                    locations: [],
                  },
                }
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
  await expect(page.locator('#enroll-status')).toContainText('That manager code did not work');
  await expect.poll(() => page.evaluate(() => window.MemphisCustodialSecurity.getPendingEnrollmentOperation())).toBeNull();

  await page.locator('#code').fill('22222222');
  await page.locator('#enroll-submit').click();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('.homeButton')).toHaveText(['Schedule', 'Messages', 'Events', 'Feedback']);
  const audit = await page.evaluate(() => window.__terminalEnrollmentAudit);
  expect(audit.enrollmentOperations).toHaveLength(2);
  expect(audit.enrollmentOperations[1]).not.toBe(audit.enrollmentOperations[0]);
  expect(audit.confirmedOperations).toEqual([audit.enrollmentOperations[1]]);
});

test('prepared recovery resumes an old active native binding only after manager code and native proof', async ({ page }) => {
  await page.addInitScript(({ deviceId }) => {
    const oldOperation = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const recoveryOperation = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const recoveryId = 'server-rejected-recovery-proof';
    const seal = 'prepared-recovery-native-seal';
    const createdAt = '2026-08-25T18:00:00.000Z';
    const identity = {
      device_id: deviceId,
      canonical_device_id: deviceId,
      original_values: [deviceId],
    };
    localStorage.setItem('memphisAssignedDeviceId', deviceId);
    localStorage.setItem('mz_scan_device_id', deviceId);
    localStorage.setItem('mz_employee_hub_device_id', deviceId);
    localStorage.setItem('memphisZooCustodialInstallationSeal', seal);
    localStorage.setItem('memphisZooCustodialRecoveryRecord', JSON.stringify({
      schema_version: 1,
      recovery_id: recoveryId,
      status: 'pending_manager_recovery',
      reason: 'server_credential_rejected',
      created_at: createdAt,
      original_device_keys: { mz_scan_device_id: deviceId },
      original_identities: [identity],
      preserved_counts: { total_pending: 1 },
      details: { requested_by: 'protected_enrollment_runtime' },
    }));
    localStorage.setItem('memphisZooCustodialRestoreQuarantine', JSON.stringify({
      schema_version: 1,
      recovery_id: recoveryId,
      active: true,
      reason: 'server_credential_rejected',
      created_at: createdAt,
      original_device_keys: { mz_scan_device_id: deviceId },
      original_identities: [identity],
      preserved_counts: { total_pending: 1 },
    }));
    localStorage.setItem('memphisZooCustodialEnrollmentOperationV1', JSON.stringify({
      schema_version: 1,
      operation_id: recoveryOperation,
      flow: 'recovery',
      device_id: deviceId,
      recovery_id: recoveryId,
      status: 'pending_server',
      created_at: '2026-08-25T18:05:00.000Z',
    }));
    const installation = (operationId) => ({
      schema_version: 1,
      device_id: deviceId,
      installation_seal: seal,
      enrolled_at: createdAt,
      enrollment_operation_id: operationId,
      migrated_from_credential_only_state: false,
    });
    const activeState = (operationId, flow) => ({
      schema_version: 2,
      state: 'ACTIVE',
      revision: 10,
      active: true,
      blocked: false,
      credential_present: true,
      credential_usable: true,
      recovery_required: false,
      active_enrollment_flow: flow,
      installation: installation(operationId),
      removal_pending: false,
      removal_finalized: false,
    });
    const pendingState = (phase) => ({
      schema_version: 2,
      state: phase,
      revision: phase === 'CREDENTIAL_STAGED' ? 11 : 12,
      active: false,
      blocked: false,
      credential_present: true,
      pending_operation_id: recoveryOperation,
      pending_device_id: deviceId,
      pending_flow: 'recovery',
      pending_server_confirmation: phase === 'PENDING_SERVER_CONFIRMATION',
      pending_enrollment: {
        operation_id: recoveryOperation,
        device_id: deviceId,
        flow: 'recovery',
        credential_id: '80000000-0000-4000-8000-000000000008',
        recovery_id: recoveryId,
        resume_expires_at: '2026-08-25T18:30:00.000Z',
      },
      installation: installation(recoveryOperation),
      removal_pending: false,
    });
    let state = activeState(oldOperation, 'enrollment');
    const audit = { resumeCalls: 0, enrollCalls: 0, statusCalls: 0, confirmCalls: 0 };
    const encode = (value) => btoa(unescape(encodeURIComponent(JSON.stringify(value))));
    window.androidBridge = {};
    window.Capacitor = {
      PluginHeaders: [{
        name: 'CustodialNativeVault',
        methods: [
          'getState', 'reportRecoveryDiagnostic', 'authorizedRequest', 'resumeEnrollment',
          'enroll', 'completeLocalBinding', 'confirmEnrollment',
        ].map((name) => ({ name, rtype: 'promise' })),
      }],
      nativePromise(plugin, method, options = {}) {
        if (plugin !== 'CustodialNativeVault') return Promise.reject(new Error(`Unexpected native plugin ${plugin}`));
        if (method === 'getState') return Promise.resolve(structuredClone(state));
        if (method === 'reportRecoveryDiagnostic') return Promise.resolve({ reported: true });
        if (method === 'authorizedRequest') {
          audit.statusCalls += 1;
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            body_base64: encode({ ok: true, data: {
              authenticated: false,
              enrollment_required: true,
              policy_mode: 'enforce',
              canonical_device_id: deviceId,
              credential_id: null,
            } }),
          });
        }
        if (method === 'resumeEnrollment') {
          audit.resumeCalls += 1;
          return Promise.reject(Object.assign(new Error('different active native operation'), {
            code: 'custodial_native_enrollment_conflict',
          }));
        }
        if (method === 'enroll') {
          audit.enrollCalls += 1;
          if (options.operation_id !== recoveryOperation || options.flow !== 'recovery' || options.enrollment_code !== '12345678') {
            return Promise.reject(new Error('recovery request mismatch'));
          }
          state = pendingState('CREDENTIAL_STAGED');
          return Promise.resolve({ status: 200, payload: { ok: true, data: {
            operation_id: recoveryOperation,
            device_id: deviceId,
            flow: 'recovery',
            credential_id: '80000000-0000-4000-8000-000000000008',
            resume_expires_at: '2026-08-25T18:30:00.000Z',
            employee: { id: 'employee-karen', name: 'Karen Robinson' },
          } } });
        }
        if (method === 'completeLocalBinding') {
          state = pendingState('PENDING_SERVER_CONFIRMATION');
          return Promise.resolve(structuredClone(state));
        }
        if (method === 'confirmEnrollment') {
          audit.confirmCalls += 1;
          state = activeState(recoveryOperation, 'recovery');
          return Promise.resolve(structuredClone(state));
        }
        return Promise.reject(new Error(`Unexpected CustodialNativeVault method ${method}`));
      },
    };
    window.__preparedRecoveryAudit = audit;
  }, { deviceId: DEVICE_ID });

  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await expect(page.getByRole('heading', { name: 'Finish phone recovery' })).toBeVisible();
  await expect(page.locator('#device-id')).toHaveValue(DEVICE_ID);
  await page.locator('#code').fill('12345678');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect.poll(() => page.evaluate(() => window.MemphisCustodialSecurity.getPendingEnrollmentOperation())).toBeNull();
  const audit = await page.evaluate(() => window.__preparedRecoveryAudit);
  expect(audit.statusCalls).toBeGreaterThanOrEqual(1);
  expect(audit.resumeCalls).toBeGreaterThanOrEqual(1);
  expect(audit.enrollCalls).toBe(1);
  expect(audit.confirmCalls).toBe(1);
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
