const { test, expect } = require('@playwright/test');

const employeeTammy = '00000000-0000-4000-8000-000000000111';
const employeeSherita = '00000000-0000-4000-8000-000000000112';
const locationTeton = '00000000-0000-4000-8000-000000000211';
const locationCatHouse = '00000000-0000-4000-8000-000000000212';
const sessionTammy = '00000000-0000-4000-8000-000000000311';
const sessionSherita = '00000000-0000-4000-8000-000000000312';

function authPayload() {
  return {
    ok: true,
    data: {
      session: {
        token: 'operational-insights-browser-session',
        role: 'ops_manager',
        roles: ['CUSTODIAL_MANAGER', 'SECURITY_ADMIN'],
        manager_id: '00000000-0000-4000-8000-000000000901',
        manager_display_name: 'Eric Operle',
        manager_job_title: 'Custodial Manager',
        device_id: 'ui-audit-browser',
        credential_id: '00000000-0000-4000-8000-000000000902',
        access_level: 'full_access',
        read_only: false,
        expires_at: '2036-07-18T00:00:00.000Z',
      },
    },
  };
}

const performance = [
  {
    employee_id: employeeTammy, employee_code: 'EMP004', employee_name: 'Tammy Miller',
    location_id: locationTeton, location_code: 'TETX', location_name: 'Teton',
    cleaning_count: 5, cleanings_last_30_days: 5, average_duration_minutes: 45,
    median_duration_minutes: 44, duration_delta_from_location_minutes: -19.3,
    inspection_count: 4, average_inspection_score: 96, inspection_pass_rate_pct: 100,
    maintenance_ticket_count: 0, latest_cleaning_at: '2026-07-22T14:45:00Z',
  },
  {
    employee_id: employeeSherita, employee_code: 'EMP007', employee_name: 'Sherita James',
    location_id: locationTeton, location_code: 'TETX', location_name: 'Teton',
    cleaning_count: 4, cleanings_last_30_days: 4, average_duration_minutes: 90,
    median_duration_minutes: 88, duration_delta_from_location_minutes: 25.7,
    inspection_count: 3, average_inspection_score: 72, inspection_pass_rate_pct: 0,
    maintenance_ticket_count: 1, latest_cleaning_at: '2026-07-21T16:30:00Z',
  },
];

const sessions = [
  {
    session_id: sessionTammy, status: 'closed', employee_id: employeeTammy, employee_code: 'EMP004', employee_name: 'Tammy Miller',
    location_id: locationTeton, location_code: 'TETX', location_name: 'Teton', started_at: '2026-07-22T14:00:00Z', ended_at: '2026-07-22T14:45:00Z',
    duration_minutes: 45, services_performed: ['Floors', 'Glass', 'Trash'], maintenance_ticket_count: 0, open_maintenance_ticket_count: 0,
    inspection_count: 4, latest_inspection_score: 96, cleaning_note: 'Inspection-ready finish.',
  },
  {
    session_id: sessionSherita, status: 'closed', employee_id: employeeSherita, employee_code: 'EMP007', employee_name: 'Sherita James',
    location_id: locationTeton, location_code: 'TETX', location_name: 'Teton', started_at: '2026-07-21T15:00:00Z', ended_at: '2026-07-21T16:30:00Z',
    duration_minutes: 90, services_performed: ['Floors', 'Trash'], maintenance_ticket_count: 1, open_maintenance_ticket_count: 1,
    inspection_count: 3, latest_inspection_score: 72, cleaning_note: 'Detail work needs coaching.',
  },
];

const tickets = [{
  location_id: locationCatHouse, location_code: 'CATHOUSE_CAFE_W', location_name: "Cat House Café Women's Restroom",
  issue_category: 'Plumbing', issue_category_key: 'plumbing', fixture_type: 'Stall', fixture_identifier: 'Stall 2',
  ticket_count_last_7_days: 3, ticket_count_last_30_days: 3, ticket_count_last_90_days: 3,
  total_ticket_count: 3, open_ticket_count: 1, recurrence_status: 'hotspot', average_resolution_hours: 18.4,
  first_reported_at: '2026-07-16T15:00:00Z', latest_reported_at: '2026-07-22T13:00:00Z', issue_signature: 'stall2-plumbing-hotspot',
}];

const inspections = [{
  id: '00000000-0000-4000-8000-000000000411', session_id: sessionTammy, inspection_type: 'manager_spot_check',
  location_name_snapshot: 'Teton', employee_name_snapshot: 'Tammy Miller', inspector_name_snapshot: 'Eric Operle',
  session_duration_minutes: 45, overall_score: 96, appearance_score: 100, sanitation_score: 95, detail_score: 95,
  passed: true, critical_failure: false, follow_up_required: false, inspected_at: '2026-07-22T15:00:00Z', notes: 'Excellent result.',
}];

async function installBackend(context, capture = {}) {
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const auth = request.headers().authorization || '';
    if (url.pathname === '/auth-api/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authPayload()) });
    if (url.pathname.startsWith('/analytics-api/') && !auth.startsWith('Bearer ')) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Custodial Manager access is required.' }) });
    }
    if (url.pathname === '/analytics-api/cleaning-performance') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: performance }) });
    if (url.pathname === '/analytics-api/session-facts') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: sessions }) });
    if (url.pathname === '/analytics-api/ticket-trends') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: tickets }) });
    if (url.pathname === '/analytics-api/inspections' && request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: inspections }) });
    if (url.pathname === '/analytics-api/inspections' && request.method() === 'POST') {
      capture.payload = request.postDataJSON();
      capture.idempotencyKey = request.headers()['idempotency-key'];
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { ...capture.payload, id: 'saved-inspection' } }) });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Not found.' }) });
  });
}

for (const viewport of [
  { name: 'Samsung phone', width: 390, height: 667 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`${viewport.name}: insights are readable, comparable, and clear of the viewport`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    await installBackend(context);
    const page = await context.newPage();
    await page.goto('/operational-insights.html');
    await expect(page.getByRole('heading', { name: 'Insights & Inspections' })).toBeVisible();
    const performanceList = page.locator('#performance-list');
    await expect(performanceList.getByText('Tammy Miller · Teton', { exact: true })).toBeVisible();
    await expect(performanceList.getByText('Sherita James · Teton', { exact: true })).toBeVisible();
    await expect(performanceList.getByText('45 min', { exact: true })).toBeVisible();
    await expect(performanceList.getByText('1h 30m', { exact: true })).toBeVisible();
    await expect(performanceList.getByText('96.0%', { exact: true })).toBeVisible();
    await expect(performanceList.getByText('72.0%', { exact: true })).toBeVisible();

    const back = page.getByRole('link', { name: 'Back' });
    const box = await back.boundingBox();
    expect(Math.round(box.width)).toBe(116);
    expect(Math.round(box.height)).toBe(52);
    const headerBox = await page.locator('.insightsHeader').boundingBox();
    expect(headerBox).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(headerBox.x);
    expect(box.x - headerBox.x).toBeLessThan(24);
    expect(box.x + box.width).toBeLessThanOrEqual(headerBox.x + headerBox.width);
    expect(box.y).toBeGreaterThanOrEqual(headerBox.y);
    expect(box.y - headerBox.y).toBeLessThan(24);
    expect(box.y + box.height).toBeLessThanOrEqual(headerBox.y + headerBox.height);

    const geometry = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 2);

    await page.getByRole('button', { name: 'Ticket Trends' }).click();
    await expect(page.getByText("Cat House Café Women's Restroom")).toBeVisible();
    await expect(page.getByText('Plumbing · Stall · Stall 2')).toBeVisible();
    await expect(page.getByText('3 in 7 days')).toBeVisible();
    await expect(page.getByText('hotspot', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`operational-insights-${viewport.name.replaceAll(' ', '-').toLowerCase()}.png`), fullPage: true });
    await context.close();
  });
}

test('a manager inspection is tied to the exact cleaning session and saved idempotently', async ({ browser }) => {
  const capture = {};
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installBackend(context, capture);
  const page = await context.newPage();
  await page.goto('/operational-insights.html');
  await page.getByRole('button', { name: 'Cleanings' }).click();
  const tammyCard = page.locator('[data-session-id]').filter({ hasText: 'Tammy Miller' });
  await tammyCard.getByRole('button', { name: 'Inspect' }).click();
  await expect(page.getByRole('heading', { name: 'Record cleaning quality' })).toBeVisible();
  await expect(page.getByText('Teton · Tammy Miller · 45 min cleaning')).toBeVisible();
  await page.locator('#appearance-score').selectOption('100');
  await page.locator('#sanitation-score').selectOption('100');
  await page.locator('#supplies-score').selectOption('90');
  await page.locator('#detail-score').selectOption('100');
  await page.locator('#safety-score').selectOption('100');
  await page.getByLabel('Inspection notes').fill('Excellent result. Keep this standard.');
  await page.getByRole('button', { name: 'Save Inspection' }).click();
  await expect(page.getByText('Inspection saved.')).toBeVisible();
  expect(capture.payload.session_id).toBe(sessionTammy);
  expect(capture.payload.overall_score).toBe(98);
  expect(capture.payload.pass_threshold).toBe(85);
  expect(capture.payload.notes).toBe('Excellent result. Keep this standard.');
  expect(capture.idempotencyKey).toBe(capture.payload.operation_id);
  await context.close();
});
