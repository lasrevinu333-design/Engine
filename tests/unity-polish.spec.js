const { test, expect } = require('@playwright/test');

const managerId = '00000000-0000-4000-8000-000000000901';
const credentialId = '00000000-0000-4000-8000-000000000902';

function sessionPayload() {
  return {
    ok: true,
    data: {
      session: {
        token: 'unity-polish-browser-test-token',
        role: 'ops_manager',
        roles: ['CUSTODIAL_MANAGER', 'SECURITY_ADMIN'],
        manager_id: managerId,
        manager_display_name: 'Unity Test Manager',
        credential_id: credentialId,
        device_id: 'unity-browser',
        access_level: 'full_access',
        read_only: false,
        trusted_device: true,
        expires_at: '2036-07-18T00:00:00.000Z',
      },
      trusted_device: { credential_id: credentialId, device_id: 'unity-browser' },
    },
  };
}

async function mockBackend(context) {
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth-api/session') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionPayload()) });
      return;
    }
    if (url.pathname === '/version') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: 'release-2026.07.18.custodial-v3.11' }) });
      return;
    }
    if (url.pathname === '/release-manifest') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ release_id: 'release-2026.07.18.custodial-v3.11' }) });
      return;
    }
    const body = request.method() === 'GET'
      ? { ok: true, data: [], meta: { next_cursor: null } }
      : { ok: true, data: {} };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

const pageMatrix = [
  ['admin.html', 'Back', /start_page1\.html$/],
  ['coverall-print.html', 'Back', /start_page1\.html$/],
  ['dashboard.html', 'Back', /start_page1\.html$/],
  ['device-security.html', 'Back', /start_page1\.html$/],
  ['employee-schedule.html?hub=employee&device=KIOSK_01', 'Back', /employee-hub\.html\?device=KIOSK_01&hub=employee$/],
  ['events-admin.html', 'Back', /start_page1\.html$/],
  ['events.html?hub=manager', 'Back', /start_page1\.html$/],
  ['gemini-admin.html', 'Back', /start_page1\.html$/],
  ['guest-issues.html', 'Back', /start_page1\.html$/],
  ['manager-access.html', 'Back', /start_page1\.html$/],
  ['messages.html?hub=manager', 'Back', /start_page1\.html$/],
  ['schedule-employee-day.html', 'Back', /start_page1\.html$/],
  ['schedule-simple.html', 'Back', /start_page1\.html$/],
  ['schedule.html', 'Back', /start_page1\.html$/],
  ['system-feedback.html?hub=manager', 'Back', /start_page1\.html$/],
  ['thread.html?hub=manager&thread_id=00000000-0000-4000-8000-000000000903', 'Back', /start_page1\.html$/],
];

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 667 },
]) {
  test(`${viewport.name} secondary-page navigation matrix is consistent and reachable`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    await mockBackend(context);
    const page = await context.newPage();
    for (const [route, label, destination] of pageMatrix) {
      await page.goto(`/${route}`, { waitUntil: 'domcontentloaded' });
      const back = page.locator('[data-mz-back]');
      await expect(back, route).toHaveCount(1);
      await expect(back, route).toBeVisible();
      await expect(back, route).toHaveAccessibleName(label);
      const box = await back.boundingBox();
      expect(box, `${route} control must have a touch-sized box`).not.toBeNull();
      expect(box.height, `${route} control height`).toBeGreaterThanOrEqual(43);
      expect(box.x, `${route} control must remain near the upper-left region`).toBeLessThan(viewport.width * 0.55);
      expect(box.y, `${route} control must remain in the page header`).toBeLessThan(170);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${route} must not create critical horizontal overflow`).toBeLessThanOrEqual(2);
      await back.focus();
      await expect(back).toBeFocused();
      await Promise.all([page.waitForURL(destination), page.keyboard.press('Enter')]);
    }
    await context.close();
  });
}

test('unsaved form data is protected and canonical navigation remains deterministic', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await mockBackend(context);
  const page = await context.newPage();
  await page.goto('/system-feedback.html?hub=manager');
  await page.locator('textarea').first().fill('Unsaved test content');
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('unsaved changes');
    await dialog.dismiss();
  });
  await page.locator('[data-mz-back]').click();
  await expect(page).toHaveURL(/system-feedback\.html/);
  await expect(page.locator('textarea').first()).toHaveValue('Unsaved test content');
  await context.close();
});

test('Gemini composer and global Hub navigation fit desktop and mobile viewports', async ({ browser }) => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 667 }]) {
    const context = await browser.newContext({ viewport });
    await mockBackend(context);
    const page = await context.newPage();
    await page.goto('/gemini-admin.html');
    await expect(page.locator('[data-mz-back]')).toBeVisible();
    await expect(page.getByLabel('Message Gemini Console')).toBeVisible();
    const geometry = await page.evaluate(() => {
      const composer = document.querySelector('.composer-wrap').getBoundingClientRect();
      const back = document.querySelector('[data-mz-back]').getBoundingClientRect();
      return { composerBottom: composer.bottom, backTop: back.top, viewportHeight: window.innerHeight, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
    });
    expect(geometry.composerBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.backTop).toBeGreaterThanOrEqual(0);
    expect(geometry.scrollWidth - geometry.clientWidth).toBeLessThanOrEqual(2);
    await context.close();
  }
});

test('unknown routes expose useful Ops and employee recovery paths', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Ops Manager Hub' })).toHaveAttribute('href', './start_page1.html');
  await expect(page.getByRole('link', { name: 'Open Custodial Hub' })).toHaveAttribute('href', './employee-hub.html');
});
