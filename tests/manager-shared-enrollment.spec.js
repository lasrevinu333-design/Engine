const { test, expect } = require('@playwright/test');

const validCode = '24681357';

function sessionPayload(deviceId, mobile = false) {
  return {
    ok: true,
    data: {
      session: {
        token: `browser-session-${deviceId}`,
        role: 'ops_manager',
        roles: ['OPS_MANAGER'],
        manager_id: '00000000-0000-4000-8000-000000000002',
        manager_display_name: 'Shared Ops Manager',
        device_id: deviceId,
        credential_id: `credential-${mobile ? 'mobile' : 'desktop'}`,
        access_level: 'full_access',
        read_only: false,
        expires_at: '2036-07-18T00:00:00.000Z'
      },
      trusted_device: { device_id: deviceId }
    }
  };
}

async function installAuthBackend(context, { mobile = false } = {}) {
  let trusted = false;
  let consumeCount = 0;
  let submittedCode = '';
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
      submittedCode = String(body.code || '');
      if (submittedCode !== validCode) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Invalid.' }) });
        return;
      }
      trusted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': 'mz_ops_trust=test; Path=/; Secure; HttpOnly; SameSite=None' },
        body: JSON.stringify(sessionPayload(mobile ? 'mobile-browser' : 'desktop-browser', mobile))
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
  return {
    state: () => ({ trusted, consumeCount, submittedCode })
  };
}

async function verifyOneClickEnrollment(browser, { mobile = false } = {}) {
  const context = await browser.newContext(mobile ? {
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
  } : {});
  const backend = await installAuthBackend(context, { mobile });
  const page = await context.newPage();
  await page.goto('/start_page1.html');
  await expect(page.getByRole('heading', { name: 'OPS MANAGER HUB ACCESS' })).toBeVisible();
  await expect(page.getByText('This passcode is only needed once for each phone, computer, or browser.')).toBeVisible();
  await page.getByLabel('Enrollment passcode').fill('2468 1357');
  await page.getByLabel('Device label (optional)').fill(mobile ? 'Disposable Phone' : 'Disposable Desktop');
  await page.getByRole('button', { name: 'Open Ops Manager Hub' }).click();
  await expect(page.locator('#access-mode')).toContainText('Full-access Ops Manager');
  await expect(page).toHaveURL(/\/start_page1\.html$/);
  expect(backend.state()).toEqual({ trusted: true, consumeCount: 1, submittedCode: validCode });
  const storage = await page.evaluate(() => ({
    local: Object.values(localStorage),
    session: Object.values(sessionStorage),
    url: location.href
  }));
  expect(JSON.stringify(storage)).not.toContain(validCode);
  await page.reload();
  await expect(page.locator('#access-mode')).toContainText('Full-access Ops Manager');
  await expect(page.getByRole('heading', { name: 'OPS MANAGER HUB ACCESS' })).toHaveCount(0);
  expect(backend.state().consumeCount).toBe(1);
  await context.close();
}

test('shared 48-hour passcode enrolls desktop and daily reopen is passwordless', async ({ browser }) => {
  await verifyOneClickEnrollment(browser, { mobile: false });
});

test('shared 48-hour passcode enrolls a mobile browser independently', async ({ browser }) => {
  await verifyOneClickEnrollment(browser, { mobile: true });
});

test('an unrelated untrusted browser stays denied and obsolete invitation UI is absent', async ({ browser }) => {
  const context = await browser.newContext();
  await installAuthBackend(context);
  const page = await context.newPage();
  await page.goto('/start_page1.html');
  await expect(page.getByRole('heading', { name: 'OPS MANAGER HUB ACCESS' })).toBeVisible();
  await expect(page.getByText(/Generate PC Invite|Generate Phone Invite|Copy Invite Link|Pair Manager Device/)).toHaveCount(0);
  await expect(page.locator('.apps')).toHaveCount(0);
  await context.close();
});
