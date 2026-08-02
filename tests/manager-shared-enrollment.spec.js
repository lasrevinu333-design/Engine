const { test, expect } = require('@playwright/test');

const validCode = '24681357';
const managerName = 'Brandy Gull';
const deviceLabelDraftKey = 'memphisOpsManagerDeviceLabelDraft.v1';

function sessionPayload(deviceId, mobile = false) {
  return {
    ok: true,
    data: {
      session: {
        token: `browser-session-${deviceId}`,
        role: 'ops_manager',
        roles: ['OPS_MANAGER', 'CUSTODIAL_MANAGER'],
        manager_id: '00000000-0000-4000-8000-000000000002',
        manager_display_name: managerName,
        device_id: deviceId,
        credential_id: `credential-${mobile ? 'mobile' : 'desktop'}`,
        access_level: 'full_access',
        read_only: false,
        expires_at: '2036-07-18T00:00:00.000Z'
      },
      manager: {
        manager_id: '00000000-0000-4000-8000-000000000002',
        display_name: managerName,
        job_title: 'Horticulture Manager',
        roles: ['OPS_MANAGER']
      },
      trusted_device: { device_id: deviceId }
    }
  };
}

async function installManagerAccessBackend(context) {
  const managerId = '00000000-0000-4000-8000-000000000002';
  let browserWindow = null;
  let sharedCreateCount = 0;
  let appCodeCreateCount = 0;
  const requestedPaths = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requestedPaths.push(`${request.method()} ${url.pathname}`);
    const json = async (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
    if (url.pathname === '/auth-api/session') return json(sessionPayload('manager-browser').data);
    if (url.pathname === '/auth-api/ops/shared-enrollment' && request.method() === 'GET') {
      return json({ enrollment_window: browserWindow, devices: [], current_credential_id: 'credential-desktop' });
    }
    if (url.pathname === '/auth-api/ops/shared-enrollment' && request.method() === 'POST') {
      sharedCreateCount += 1;
      browserWindow = {
        window_id: '00000000-0000-4000-8000-000000000099', active: true, status: 'active',
        created_at: '2036-07-16T00:00:00.000Z', expires_at: '2036-07-18T00:00:00.000Z', enrollment_count: 0
      };
      return json({ ...browserWindow, passcode: '13572468', display_passcode: '1357 2468', shown_once: true });
    }
    if (url.pathname === '/auth-api/ops/trusted-devices') {
      return json({ devices: [], current_credential_id: 'credential-desktop' });
    }
    if (url.pathname === '/leadership-api/roster') {
      return json({ managers: [{ manager_id: managerId, display_name: managerName, job_title: 'Horticulture Manager' }] });
    }
    if (url.pathname === `/leadership-api/managers/${managerId}/enrollment-code` && request.method() === 'POST') {
      appCodeCreateCount += 1;
      return json({ display_code: '8642 1357', one_time_code: '86421357', expires_at: '2036-07-16T00:15:00.000Z' });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Unexpected test route.' }) });
  });
  return { state: () => ({ sharedCreateCount, appCodeCreateCount, requestedPaths }) };
}

async function installAuthBackend(context, { mobile = false } = {}) {
  let trusted = false;
  let consumeCount = 0;
  let submittedCode = '';
  let submittedDeviceLabel = '';
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth-api/session') {
      if (!trusted) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Enrollment required.' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionPayload(mobile ? 'mobile-browser' : 'desktop-browser', mobile)) });
      return;
    }
    if (url.pathname === '/auth-api/ops/shared-enrollment/consume') {
      consumeCount += 1;
      const body = request.postDataJSON();
      submittedCode = String(body.code || body.manager_code || '');
      submittedDeviceLabel = String(body.device_label || '');
      if (submittedCode !== validCode) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Invalid.' }) });
        return;
      }
      trusted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': 'memphis_ops_trust=test; Path=/; Secure; HttpOnly; SameSite=None' },
        body: JSON.stringify(sessionPayload(mobile ? 'mobile-browser' : 'desktop-browser', mobile))
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
  return {
    state: () => ({ trusted, consumeCount, submittedCode, submittedDeviceLabel })
  };
}

async function verifyNamedEnrollment(browser, { mobile = false, reloadBeforeSubmit = false } = {}) {
  const context = await browser.newContext(mobile ? {
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
  } : {});
  const backend = await installAuthBackend(context, { mobile });
  const page = await context.newPage();
  await page.goto('/start_page1.html');
  await expect(page).toHaveURL(/\/ops-manager-hub\.html/);
  await expect(page.getByRole('heading', { name: 'Operations Leadership Hub' })).toBeVisible();
  await expect(page.getByText('This browser is not enrolled. Enter the shared 48-hour passcode from Manager Device Access.')).toBeVisible();
  await page.getByLabel('Shared enrollment passcode').fill('2468 1357');
  const deviceLabel = mobile ? 'Brandy Personal Android' : 'Brandy Work Desktop';
  await page.getByLabel('Browser name').fill(deviceLabel);
  await expect(page.getByLabel('Browser name')).toHaveValue(deviceLabel);
  if (reloadBeforeSubmit) {
    await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), deviceLabelDraftKey)).toBe(deviceLabel);
    await page.reload();
    await expect(page.getByText('This browser is not enrolled. Enter the shared 48-hour passcode from Manager Device Access.')).toBeVisible();
    await expect(page.getByLabel('Browser name')).toHaveValue(deviceLabel);
    await expect(page.getByLabel('Shared enrollment passcode')).toHaveValue('');
    await page.getByLabel('Browser name').fill('');
    await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), deviceLabelDraftKey)).toBeNull();
    await page.getByLabel('Browser name').fill(deviceLabel);
    await page.getByLabel('Shared enrollment passcode').fill('2468 1357');
  }
  await page.getByRole('button', { name: 'Enroll This Browser' }).click();
  await expect(page.locator('#access-mode')).toContainText(`Full-access Ops Manager · ${managerName}`);
  await expect(page).toHaveURL(/\/start_page1\.html\?manager_access=full_access$/);
  expect(backend.state()).toEqual({ trusted: true, consumeCount: 1, submittedCode: validCode, submittedDeviceLabel: deviceLabel });
  const storage = await page.evaluate((key) => ({
    local: Object.values(localStorage),
    session: Object.values(sessionStorage),
    deviceLabelDraft: sessionStorage.getItem(key),
    url: location.href
  }), deviceLabelDraftKey);
  expect(JSON.stringify(storage)).not.toContain(validCode);
  expect(storage.deviceLabelDraft).toBeNull();
  await page.reload();
  await expect(page.locator('#access-mode')).toContainText(`Full-access Ops Manager · ${managerName}`);
  await expect(page.getByRole('heading', { name: 'Operations Leadership Hub' })).toHaveCount(0);
  expect(backend.state().consumeCount).toBe(1);
  await context.close();
}

test('shared manager passcode enrolls a desktop browser and daily reopen is passwordless', async ({ browser }) => {
  await verifyNamedEnrollment(browser, { mobile: false });
});

test('shared manager passcode enrolls an Android browser independently', async ({ browser }) => {
  await verifyNamedEnrollment(browser, { mobile: true, reloadBeforeSubmit: true });
});

test('an unrelated untrusted browser stays denied and sees only the shared browser enrollment form', async ({ browser }) => {
  const context = await browser.newContext();
  await installAuthBackend(context);
  const page = await context.newPage();
  await page.goto('/start_page1.html');
  await expect(page).toHaveURL(/\/ops-manager-hub\.html/);
  await expect(page.getByRole('heading', { name: 'Operations Leadership Hub' })).toBeVisible();
  await expect(page.getByLabel('Shared enrollment passcode')).toBeVisible();
  await expect(page.getByText(/Generate PC Invite|Generate Phone Invite|Copy Invite Link|Pair Manager Device|Personal enrollment code/i)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open the read-only Viewer instead' })).toBeVisible();
  await expect(page.locator('.apps')).toHaveCount(0);
  await context.close();
});

test('Manager Access keeps browser and native-app enrollment on their distinct backend contracts', async ({ browser }) => {
  const context = await browser.newContext();
  const backend = await installManagerAccessBackend(context);
  const page = await context.newPage();
  await page.goto('/manager-access.html');
  await expect(page.getByRole('heading', { name: 'Browser Enrollment Window' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Native App Enrollment' })).toBeVisible();
  await expect(page.locator('#status')).toContainText('Access records are current.');

  await page.getByRole('button', { name: 'Generate New 48-Hour Passcode' }).click();
  await expect(page.locator('#code-title')).toHaveText('48-Hour Browser Enrollment Passcode');
  await expect(page.locator('#code-value')).toHaveText('1357 2468');

  await page.getByRole('button', { name: 'Generate App Code' }).click();
  await expect(page.locator('#code-title')).toHaveText(`${managerName} — Native App Code`);
  await expect(page.locator('#code-value')).toHaveText('8642 1357');

  const state = backend.state();
  expect(state.sharedCreateCount).toBe(1);
  expect(state.appCodeCreateCount).toBe(1);
  expect(state.requestedPaths).toContain('POST /auth-api/ops/shared-enrollment');
  expect(state.requestedPaths).toContain(`POST /leadership-api/managers/00000000-0000-4000-8000-000000000002/enrollment-code`);
  expect(state.requestedPaths.join('\n')).not.toContain('/auth-api/ops/manager-codes/consume');
  await context.close();
});
