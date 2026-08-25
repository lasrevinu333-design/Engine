const { test, expect } = require('@playwright/test');

const managerSession = {
  ok: true,
  data: {
    session: {
      token: 'attendance-browser-test-token',
      role: 'ops_manager',
      roles: ['CUSTODIAL_MANAGER'],
      manager_id: '00000000-0000-4000-8000-000000000901',
      manager_display_name: 'Attendance Test Manager',
      manager_job_title: 'Custodial Manager',
      credential_id: '00000000-0000-4000-8000-000000000902',
      device_id: 'attendance-browser',
      access_level: 'full_access',
      read_only: false,
      trusted_device: true,
      expires_at: '2036-07-18T00:00:00.000Z',
    },
    trusted_device: {
      credential_id: '00000000-0000-4000-8000-000000000902',
      device_id: 'attendance-browser',
    },
  },
};

async function installRuntime(context, attendance, requestPaths) {
  await context.addInitScript(() => {
    localStorage.setItem('mz_scan_device_id', 'KIOSK_01');
    localStorage.setItem('memphisAssignedDeviceId', 'KIOSK_01');
  });
  await context.route('https://api.open-meteo.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      current: { temperature_2m: 25, weather_code: 0, wind_speed_10m: 3 },
      daily: { temperature_2m_max: [28], temperature_2m_min: [20] },
      hourly: { time: [], precipitation_probability: [] },
    }),
  }));
  await context.route('https://memphis-zoo-mcp.onrender.com/**', (route) => {
    const url = new URL(route.request().url());
    requestPaths.push(url.pathname);
    if (url.pathname === '/auth-api/session') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(managerSession) });
    }
    if (url.pathname === '/version') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: 'audit4-test' }) });
    }
    if (url.pathname === '/dashboard-api/current-attendance') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: attendance }) });
    }
    if (url.pathname === '/guest-api/status') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { enabled: false } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
}

test('employee Home contains no guest-attendance feed or request', async ({ browser }) => {
  const requestPaths = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installRuntime(context, {}, requestPaths);
  const page = await context.newPage();
  await page.goto('/employee-hub.html?device=KIOSK_08&lock=0');
  await expect(page.locator('.label')).toHaveText(['Schedule', 'Messages', 'Events', 'Feedback']);
  await expect(page.locator('#attendance-value')).toHaveCount(0);
  expect(requestPaths).not.toContain('/dashboard-api/current-attendance');
  await context.close();
});

test('manager Home shows attendance source time and stale state', async ({ browser }) => {
  const requestPaths = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installRuntime(context, {
    attendance: 1087,
    planned: 1200,
    last_year: 1100,
    yesterday_plan: 1180,
    source_timestamp: '2026-07-29T15:30:00.000Z',
    stale: true,
  }, requestPaths);
  const page = await context.newPage();
  await page.goto('/start_page1.html');
  await expect(page.locator('#access-mode')).toContainText('Full-access Ops Manager · Attendance Test Manager');
  await expect(page.locator('#attendance-value')).toHaveText('1,087');
  await expect(page.locator('#attendance-meta')).toContainText('Stale gate count · source');
  await expect(page.locator('#attendance-meta')).toHaveClass(/stale/);
  expect(requestPaths).toContain('/dashboard-api/current-attendance');
  await context.close();
});
