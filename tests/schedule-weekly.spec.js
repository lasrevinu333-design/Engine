const { test, expect } = require('@playwright/test');

const SLOT_WORKING = '20000000-0000-4000-8000-000000000001';
const SLOT_DEPARTED = '20000000-0000-4000-8000-000000000002';
const SLOT_CONTRACTOR = '20000000-0000-4000-8000-000000000003';
const PUBLICATION = '70000000-0000-4000-8000-000000000001';
const VERSION = '60000000-0000-4000-8000-000000000001';

function sessionPayload() {
  return { ok: true, data: { session: {
    token: 'weekly-manager-browser-token', role: 'ops_manager', roles: ['CUSTODIAL_MANAGER'],
    manager_id: '10000000-0000-4000-8000-000000000001', manager_display_name: 'Scheduler Test Manager',
    credential_id: 'weekly-credential', device_id: 'weekly-device', access_level: 'full_access', read_only: false,
    auth_mode: 'trusted_device', trusted_device: true, expires_at: '2036-08-10T00:00:00.000Z',
  } } };
}

function schedulerFixture() {
  const availability = [];
  for (let day = 0; day < 7; day += 1) {
    availability.push({ slot_id: SLOT_WORKING, day_of_week: day, availability_state: 'working', shift_start: '07:00', shift_end: '16:00', max_load_points: 300 });
    availability.push({ slot_id: SLOT_DEPARTED, day_of_week: day, availability_state: 'departed_named_absent' });
    availability.push({ slot_id: SLOT_CONTRACTOR, day_of_week: day, availability_state: 'unavailable' });
  }
  return {
    schema: 'memphis-zoo.static-weekly-manager-snapshot.v1', week_start: '2026-08-10', week_end: '2026-08-16', authority_revision: 3,
    sources: [{ source_id: '50000000-0000-4000-8000-000000000001', source_digest: 'a'.repeat(64), slot_count: 3 }],
    current_publication: { publication_id: PUBLICATION, version_id: VERSION, version_number: 1, effective_start: '2026-08-10' },
    drafts: [], display_version: { version_id: VERSION, lifecycle_state: 'published' },
    roster: [
      { slot_id: SLOT_WORKING, slot_label: 'Karen slot', contractor_capacity: false, incumbencies: [{ person_id: '30000000-0000-4000-8000-000000000001', person_name: 'Karen Robinson', effective_start: '2020-01-01' }] },
      { slot_id: SLOT_DEPARTED, slot_label: 'Departed named slot', contractor_capacity: false, incumbencies: [{ person_id: '30000000-0000-4000-8000-000000000002', person_name: 'Departed Employee', effective_start: '2020-01-01' }] },
      { slot_id: SLOT_CONTRACTOR, slot_label: 'CoverAll capacity 1', contractor_capacity: true, incumbencies: [] },
    ],
    availability,
    assignments: Array.from({ length: 7 }, (_, day) => ({ assignment_id: `assignment-${day}`, work_id: `work-${day}`, day_of_week: day, status: 'assigned', location_name: `Zoo Area ${day + 1}`, coverage_start: '08:00', coverage_end: '10:00', owner_slot_id: SLOT_WORKING, workload_points: 40 })),
    exceptions: [], latest_projection: null,
  };
}

async function installRoutes(context) {
  const fixture = schedulerFixture();
  const calls = [];
  await context.route('https://unpkg.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.lucide={createIcons(){}};' }));
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth-api/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionPayload()) });
    if (path === '/scheduler-runtime-config') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { configured: true, public_url: 'https://weekly-test.onrender.com' } }) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
  });
  await context.route('https://weekly-test.onrender.com/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/static-weekly/manager-snapshot') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: fixture }) });
    }
    calls.push({ path, body: request.postDataJSON(), authorization: await request.headerValue('authorization') });
    fixture.authority_revision += 1;
    if (path === '/static-weekly/exceptions') {
      const body = request.postDataJSON();
      if (body.exception_type === 'reverse') fixture.exceptions = fixture.exceptions.filter((row) => row.id !== body.reverses_exception_id);
      else fixture.exceptions.push({ id: `exception-${fixture.authority_revision}`, type: body.exception_type, serviceDate: body.service_date, reason: body.reason, payload: body.payload });
    }
    if (path === '/static-weekly/contractor-capacity') fixture.exceptions.push({ id: `exception-${fixture.authority_revision}`, type: 'cover_all', serviceDate: request.postDataJSON().service_date, reason: request.postDataJSON().reason, payload: { availability: { slotId: request.postDataJSON().slot_id } } });
    if (path === '/static-weekly/projections') fixture.latest_projection = { publication_id: PUBLICATION, assignments: fixture.assignments.map((row) => ({ plan_work_id: row.work_id, day_of_week: row.day_of_week, status: row.status, owner_slot_id: row.owner_slot_id, work_snapshot: { locationNameSnapshot: row.location_name, window: { start: row.coverage_start, end: row.coverage_end }, serviceEffortMinutes: row.workload_points } })) };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { revision: fixture.authority_revision, data: { publication_id: PUBLICATION } } }) });
  });
  return { calls, fixture };
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 667 }]) {
  test(`${viewport.name} weekly scheduler renders static ownership and dated changes`, async ({ browser }) => {
    const context = await browser.newContext({ viewport });
    const backend = await installRoutes(context);
    const page = await context.newPage();
    await page.goto('/schedule-weekly.html?date=2026-08-11');
    await expect(page.getByRole('heading', { name: 'Weekly Custodial Schedule' })).toBeVisible();
    await expect(page.getByText('Karen Robinson').first()).toBeVisible();
    await expect(page.getByText('Departed Employee', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Absent until replacement').first()).toBeVisible();
    await expect(page.getByText('CoverAll capacity 1', { exact: true })).toBeVisible();
    await expect(page.locator('#open-count')).toHaveText('0');
    await expect(page.locator('#service-date')).toHaveValue('2026-08-11');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);

    page.on('dialog', (dialog) => dialog.accept());
    await page.locator(`[data-callout-slot="${SLOT_WORKING}"]`).check();
    await page.locator(`[data-contractor-slot="${SLOT_CONTRACTOR}"]`).check();
    await page.getByRole('button', { name: 'Apply Day Changes' }).click();
    await expect(page.getByText('Call-out already applied')).toBeVisible();
    await expect(page.getByText('Contractor capacity already applied')).toBeVisible();
    expect(backend.calls.map((call) => call.path)).toEqual(['/static-weekly/exceptions', '/static-weekly/contractor-capacity', '/static-weekly/projections']);
    expect(backend.calls.every((call) => call.authorization === 'Bearer weekly-manager-browser-token')).toBe(true);
    expect(backend.calls[0].body.expected_revision).toBe(3);
    expect(backend.calls[1].body.expected_revision).toBe(4);
    expect(backend.calls[2].body.expected_revision).toBe(5);

    await page.getByRole('tab', { name: 'Changes' }).click();
    await page.getByRole('button', { name: 'Remove Daily Absence' }).click();
    await expect(page.getByText('Daily Absence')).toHaveCount(0);
    expect(backend.calls.map((call) => call.path)).toEqual([
      '/static-weekly/exceptions',
      '/static-weekly/contractor-capacity',
      '/static-weekly/projections',
      '/static-weekly/exceptions',
      '/static-weekly/projections',
    ]);
    expect(backend.calls[3].body.exception_type).toBe('reverse');
    expect(backend.calls[3].body.reverses_exception_id).toBe('exception-4');
    expect(backend.calls[3].body.expected_revision).toBe(6);
    expect(backend.calls[4].body.expected_revision).toBe(7);
    await page.screenshot({ path: `test-results/schedule-weekly-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}
