const { test, expect } = require('@playwright/test');

const validCode = '24681357';
const managerName = 'Brandy Gull';

function sessionPayload(deviceId, mobile = false) {
  return {
    ok: true,
    data: {
      session: {
        token: `browser-session-${deviceId}`,
        role: 'ops_manager',
        roles: ['OPS_MANAGER'],
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
    if (url.pathname === '/auth-api/ops/manager-codes/consume') {
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

async function verifyNamedEnrollment(browser, { mobile = false } = {}) {
  const context = await browser.newContext(mobile ? {
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
  } : {});
  const backend = await installAuthBackend(context, { mobile });
  const page = await context.newPage();
  await page.goto('/start_page1.html');
  await expect(page).toHaveURL(/\/ops-manager-hub\.html/);
  await expect(page.getByRole('heading', { name: 'Operations Leadership Hub' })).toBeVisible();
  await expect(page.getByText('This browser is not enrolled. Enter the personal code created for your leadership account.')).toBeVisible();
  await page.getByLabel('Personal enrollment code').fill('2468 1357');
  const deviceLabel = mobile ? 'Brandy Personal Android' : 'Brandy Work Desktop';
  await page.getByLabel('Browser name').fill(deviceLabel);
  await page.getByRole('button', { name: 'Enroll This Browser' }).click();
  await expect(page.locator('#access-mode')).toContainText(`Full-access Ops Manager · ${managerName}`);
  await expect(page).toHaveURL(/\/start_page1\.html\?manager_access=full_access$/);
  expect(backend.state()).toEqual({ trusted: true, consumeCount: 1, submittedCode: validCode, submittedDeviceLabel: deviceLabel });
  const storage = await page.evaluate(() => ({
    local: Object.values(localStorage),
    session: Object.values(sessionStorage),
    url: location.href
  }));
  expect(JSON.stringify(storage)).not.toContain(validCode);
  await page.reload();
  await expect(page.locator('#access-mode')).toContainText(`Full-access Ops Manager · ${managerName}`);
  await expect(page.getByRole('heading', { name: 'Operations Leadership Hub' })).toHaveCount(0);
  expect(backend.state().consumeCount).toBe(1);
  await context.close();
}

test('personal manager code enrolls a desktop browser and daily reopen is passwordless', async ({ browser }) => {
  await verifyNamedEnrollment(browser, { mobile: false });
});

test('personal manager code enrolls an Android browser independently', async ({ browser }) => {
  await verifyNamedEnrollment(browser, { mobile: true });
});

test('an unrelated untrusted browser stays denied and shared enrollment UI is absent', async ({ browser }) => {
  const context = await browser.newContext();
  await installAuthBackend(context);
  const page = await context.newPage();
  await page.goto('/start_page1.html');
  await expect(page).toHaveURL(/\/ops-manager-hub\.html/);
  await expect(page.getByRole('heading', { name: 'Operations Leadership Hub' })).toBeVisible();
  await expect(page.getByLabel('Personal enrollment code')).toBeVisible();
  await expect(page.getByText(/shared 48-hour|shared enrollment|Generate PC Invite|Generate Phone Invite|Copy Invite Link|Pair Manager Device/i)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open the read-only Viewer instead' })).toBeVisible();
  await expect(page.locator('.apps')).toHaveCount(0);
  await context.close();
});
