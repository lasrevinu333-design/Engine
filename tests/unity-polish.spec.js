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
        manager_job_title: 'Custodial Manager',
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
  for (const externalCdn of [
    'https://cdn.jsdelivr.net/**',
    'https://cdnjs.cloudflare.com/**',
    'https://unpkg.com/**',
  ]) {
    await context.route(externalCdn, (route) => route.abort());
  }
  await context.route('https://api.open-meteo.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      current: { temperature_2m: 25, weather_code: 0, wind_speed_10m: 3 },
      daily: { temperature_2m_max: [28], temperature_2m_min: [20] },
    }),
  }));
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth-api/session') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionPayload()) });
      return;
    }
    if (url.pathname === '/messaging-api/me/by-device') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { msg_user_id: managerId, user_id: managerId, display_name: 'Unity Test Manager', role: 'manager', role_title: 'Custodial Manager', identity_source: 'trusted_manager_session' } }),
      });
      return;
    }
    if (url.pathname === '/messaging-api/threads') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      return;
    }
    if (url.pathname === '/messaging-api/threads/updates') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [], meta: { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: '00000000-0000-0000-0000-000000000000' } } }) });
      return;
    }
    if (url.pathname === '/version') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: 'release-2026.07.19.custodial-v3.12' }) });
      return;
    }
    if (url.pathname === '/release-manifest') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ release_id: 'release-2026.07.19.custodial-v3.12' }) });
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
  ['schedule-employee-day.html', 'Back', /start_page1\.html$/],
  ['schedule-simple.html', 'Back', /start_page1\.html$/],
  ['schedule-weekly.html', 'Back', /start_page1\.html$/],
  ['schedule.html', 'Back', /start_page1\.html$/],
  ['system-feedback.html?hub=manager', 'Back', /start_page1\.html$/],
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

  test(`${viewport.name} ChatScope and legacy thread routes expose the same canonical Back control`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    await mockBackend(context);
    const page = await context.newPage();
    for (const route of [
      '/messages.html?hub=manager',
      '/thread.html?hub=manager&thread_id=00000000-0000-4000-8000-000000000903',
    ]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/messages\.html/);
      const back = page.locator('.mz-chat-toolbar > .mz-button:first-child');
      await expect(back).toHaveCount(1);
      await expect(back).toBeVisible();
      await expect(back).toHaveAccessibleName('Back');
      const box = await back.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.round(box.width)).toBe(116);
      expect(Math.round(box.height)).toBe(52);
      expect(box.x).toBeLessThan(viewport.width * 0.55);
      expect(box.y).toBeLessThan(170);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
      await back.focus();
      await expect(back).toBeFocused();
      await Promise.all([page.waitForURL(/start_page1\.html$/), page.keyboard.press('Enter')]);
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
