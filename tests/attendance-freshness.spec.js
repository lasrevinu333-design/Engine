const { test, expect } = require('@playwright/test');

async function installRuntime(context, attendance) {
  await context.addInitScript(() => {
    localStorage.setItem('mz_scan_device_id', 'KIOSK_04');
    localStorage.setItem('memphisAssignedDeviceId', 'KIOSK_04');
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
    if (url.pathname === '/version') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: 'audit4-test' }) });
    if (url.pathname === '/dashboard-api/current-attendance') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: attendance }) });
    if (url.pathname === '/device-auth/status') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { authenticated: true, enrollment_required: false, canonical_device_id: 'KIOSK_04', employee_name: 'Tammy Miller' } }) });
    if (url.pathname === '/schedule-api/my-day-summary') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { employee: { display_name: 'Tammy Miller' } } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
}

test('employee hub shows the attendance source time and stale state', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installRuntime(context, {
    attendance: 1087,
    planned: 1200,
    last_year: 1100,
    yesterday_plan: 1180,
    source_timestamp: '2026-07-29T15:30:00.000Z',
    stale: true,
  });
  const page = await context.newPage();
  await page.goto('/employee-hub.html?device=KIOSK_04&lock=0');
  await expect(page.locator('#attendance-value')).toHaveText('1,087');
  await expect(page.locator('#attendance-meta')).toContainText('Stale gate count · source');
  await expect(page.locator('#attendance-meta')).toHaveClass(/stale/);
  await context.close();
});
