const { expect, test } = require('@playwright/test');

const OUTPUT_ROOT = 'build/batch-0b-shell-browser/custodial';
const AUTHORITATIVE_DEVICE = 'KIOSK_08';
const STALE_QUERY_DEVICE = 'KIOSK_02';

async function installDelayedNativeVault(page) {
  await page.addInitScript(({ authoritativeDevice }) => {
    const seal = 'readiness-native-installation-seal-v1';
    const installation = {
      schema_version: 1,
      device_id: authoritativeDevice,
      installation_seal: seal,
      enrolled_at: '2026-08-01T12:00:00.000Z',
      migrated_from_credential_only_state: true,
    };
    const nativeState = {
      schema_version: 1,
      state: 'ACTIVE',
      active: true,
      credential_present: true,
      blocked: false,
      installation,
    };
    let releaseState;
    const delayedState = new Promise((resolve) => { releaseState = resolve; });
    const audit = { getStateCalls: 0, requests: [] };

    const encodeJson = (value) => btoa(unescape(encodeURIComponent(JSON.stringify(value))));
    const response = (payload, status = 200) => ({
      status,
      headers: { 'content-type': 'application/json' },
      body_base64: encodeJson(payload),
    });
    const authorizedResponse = (request) => {
      const path = String(request?.path || '');
      if (path.startsWith('/device-auth/status')) {
        return response({ ok: true, data: {
          authenticated: true,
          canonical_device_id: authoritativeDevice,
          device_id: authoritativeDevice,
          employee_name: 'Karen Robinson',
        } });
      }
      if (path.startsWith('/messaging-api/me/by-device')) {
        return response({ ok: true, data: {
          msg_user_id: '00000000-0000-4000-8000-000000000808',
          display_name: 'Karen Robinson',
          role: 'employee',
          canonical_device_id: authoritativeDevice,
        } });
      }
      if (path.startsWith('/messaging-api/threads/updates')) return new Promise(() => {});
      if (path.startsWith('/messaging-api/threads')) return response({ ok: true, data: [] });
      if (path.startsWith('/schedule-api/my-day-summary')) {
        return response({ ok: true, data: {
          employee_name: 'Karen Robinson',
          device_id: authoritativeDevice,
          service_date: '2026-08-01',
          source: 'static_weekly_projection',
          projection_status: 'current',
          all_items: [{
            occurrence_id: '00000000-0000-4000-8000-000000000811',
            group_code: 'TETON_RESTROOM',
            group_name: 'Teton Restroom',
            location_name: 'Teton Restroom',
            included_locations: ['Teton Restroom'],
            coverage_purpose: 'area_owner',
          }],
        } });
      }
      if (path === '/feedback-api/submit') return response({ ok: true, data: { accepted: true } });
      return response({ ok: true, data: {} });
    };

    window.androidBridge = {};
    window.Capacitor = {
      PluginHeaders: [{
        name: 'CustodialNativeVault',
        methods: [
          'getState',
          'authorizedRequest',
          'resumeEnrollment',
          'confirmEnrollment',
          'cancelEnrollment',
          'removeEnrollment',
          'finalizeRemoval',
        ].map((name) => ({ name, rtype: 'promise' })),
      }],
      nativePromise(plugin, method, options) {
        if (plugin !== 'CustodialNativeVault') return Promise.reject(new Error(`Unexpected native plugin ${plugin}`));
        if (method === 'getState') {
          audit.getStateCalls += 1;
          return delayedState.then(() => JSON.parse(JSON.stringify(nativeState)));
        }
        if (method === 'authorizedRequest') {
          const request = JSON.parse(JSON.stringify(options || {}));
          audit.requests.push(request);
          return authorizedResponse(request);
        }
        return Promise.reject(new Error(`Unexpected CustodialNativeVault method ${method}`));
      },
    };
    for (const key of ['memphisAssignedDeviceId', 'mz_scan_device_id', 'mz_employee_hub_device_id']) {
      localStorage.setItem(key, authoritativeDevice);
    }
    localStorage.setItem('memphisZooCustodialInstallationSeal', seal);
    window.__custodialReadinessAudit = audit;
    window.__releaseCustodialNativeState = () => releaseState();
  }, { authoritativeDevice: AUTHORITATIVE_DEVICE });
}

async function waitForDelayedGetState(page) {
  await expect.poll(() => page.evaluate(() => window.__custodialReadinessAudit?.getStateCalls || 0)).toBeGreaterThan(0);
}

async function releaseNativeState(page) {
  await page.evaluate(() => window.__releaseCustodialNativeState());
  await expect.poll(() => page.evaluate(() => window.MemphisMobile?.deviceId?.() || '')).toBe(AUTHORITATIVE_DEVICE);
}

async function nativeRequests(page) {
  return page.evaluate(() => window.__custodialReadinessAudit?.requests || []);
}

test('Messenger waits for delayed native getState and uses only the authoritative identity', async ({ page }) => {
  await installDelayedNativeVault(page);
  await page.goto(`/${OUTPUT_ROOT}/messages.html?hub=employee&device=${STALE_QUERY_DEVICE}`);
  await waitForDelayedGetState(page);
  expect(await nativeRequests(page)).toEqual([]);

  await releaseNativeState(page);
  await expect(page.locator('.mz-chat-brand-text span')).toContainText('Karen Robinson');
  await expect.poll(async () => (await nativeRequests(page)).some(({ path }) => (
    path === `/messaging-api/me/by-device?device_id=${AUTHORITATIVE_DEVICE}`
  ))).toBe(true);
  expect((await nativeRequests(page)).some(({ path, device_id: deviceId }) => (
    String(path).includes(STALE_QUERY_DEVICE) || deviceId !== AUTHORITATIVE_DEVICE
  ))).toBe(false);
});

test('system feedback waits at submit and sends the authoritative native device ID', async ({ page }) => {
  await installDelayedNativeVault(page);
  await page.goto(`/${OUTPUT_ROOT}/system-feedback.html?hub=employee&device=${STALE_QUERY_DEVICE}`);
  await waitForDelayedGetState(page);
  await page.locator('#message').fill('Delayed native identity feedback test');
  await page.locator('#send-feedback').click();
  expect(await nativeRequests(page)).toEqual([]);

  await releaseNativeState(page);
  await expect(page.locator('#feedback-status')).toHaveText('Sent. Thank you.');
  const feedback = (await nativeRequests(page)).find(({ path }) => path === '/feedback-api/submit');
  expect(feedback?.device_id).toBe(AUTHORITATIVE_DEVICE);
  expect(JSON.parse(Buffer.from(feedback.body_base64, 'base64').toString('utf8'))).toMatchObject({
    device_id: AUTHORITATIVE_DEVICE,
    hub_context: 'employee',
  });
});

test('schedule does not request by query identity before delayed native getState settles', async ({ page }) => {
  await installDelayedNativeVault(page);
  await page.goto(`/${OUTPUT_ROOT}/employee-schedule.html?hub=employee&device=${STALE_QUERY_DEVICE}`);
  await waitForDelayedGetState(page);
  expect(await nativeRequests(page)).toEqual([]);

  await releaseNativeState(page);
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  const schedule = (await nativeRequests(page)).find(({ path }) => path.startsWith('/schedule-api/my-day-summary'));
  expect(schedule).toMatchObject({
    path: `/schedule-api/my-day-summary?device_id=${AUTHORITATIVE_DEVICE}`,
    device_id: AUTHORITATIVE_DEVICE,
  });
});

test('protected home renders canonical weekly projection items after native identity settles', async ({ page }) => {
  await installDelayedNativeVault(page);
  await page.goto(`/${OUTPUT_ROOT}/index.html?device=${STALE_QUERY_DEVICE}`);
  await waitForDelayedGetState(page);
  expect(await nativeRequests(page)).toEqual([]);

  await releaseNativeState(page);
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('#areas-list')).toContainText('Teton Restroom');
  await expect(page.locator('#areas-list')).toContainText('Restroom priority');
  const schedule = (await nativeRequests(page)).find(({ path }) => path.startsWith('/schedule-api/my-day-summary'));
  expect(schedule?.device_id).toBe(AUTHORITATIVE_DEVICE);
});

test('reload and Back navigation await a fresh native state and discard a stale device query', async ({ page }) => {
  await installDelayedNativeVault(page);
  const feedbackUrl = `/${OUTPUT_ROOT}/system-feedback.html?hub=employee&device=${STALE_QUERY_DEVICE}`;
  await page.goto(feedbackUrl);
  await waitForDelayedGetState(page);
  await releaseNativeState(page);

  await page.reload();
  await waitForDelayedGetState(page);
  expect(await nativeRequests(page)).toEqual([]);
  await page.locator('[data-mz-back]').click();
  expect(page.url()).toContain(`system-feedback.html?hub=employee&device=${STALE_QUERY_DEVICE}`);

  await page.evaluate(() => window.__releaseCustodialNativeState());
  await page.waitForURL((url) => url.pathname.endsWith('/index.html'));
  const navigated = new URL(page.url());
  expect(navigated.search).toBe('');
  expect(navigated.searchParams.get('device')).toBeNull();
  expect(navigated.searchParams.get('hub')).toBeNull();
});
