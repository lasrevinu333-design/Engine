const { test, expect } = require('@playwright/test');

const SLOT_WORKING = '20000000-0000-4000-8000-000000000001';
const SLOT_DEPARTED = '20000000-0000-4000-8000-000000000002';
const SLOT_CONTRACTOR = '20000000-0000-4000-8000-000000000003';
const PUBLICATION = '70000000-0000-4000-8000-000000000001';
const VERSION = '60000000-0000-4000-8000-000000000001';
const DRAFT_VERSION = '60000000-0000-4000-8000-000000000002';
const OPERATIONAL_NOW = '2026-08-12T18:00:00Z';

async function installOperationalClock(page) {
  await page.addInitScript((now) => {
    const NativeDate = Date;
    const fixedNow = new NativeDate(now).getTime();
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedNow])); }
      static now() { return fixedNow; }
    };
  }, OPERATIONAL_NOW);
}

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
    const serviceDate = new Date(Date.UTC(2026, 7, 10 + ((day + 6) % 7))).toISOString().slice(0, 10);
    availability.push({ slot_id: SLOT_WORKING, day_of_week: day, service_date: serviceDate, availability_state: 'working', shift_start: '07:00', shift_end: '16:00', max_load_points: 300, person_id: '30000000-0000-4000-8000-000000000001', person_name: 'Karen Robinson', employee_active: true, device_ids: ['KIOSK_02'] });
    availability.push({ slot_id: SLOT_DEPARTED, day_of_week: day, service_date: serviceDate, availability_state: 'departed_named_absent', person_id: '30000000-0000-4000-8000-000000000002', person_name: 'Departed Employee', employee_active: false, device_ids: [] });
    availability.push({ slot_id: SLOT_CONTRACTOR, day_of_week: day, availability_state: 'unavailable' });
  }
  const weekStaffing = (slotId) => availability.filter((row) => row.slot_id === slotId).map((row) => ({ ...row }));
  return {
    schema: 'memphis-zoo.static-weekly-manager-snapshot.v1', week_start: '2026-08-10', week_end: '2026-08-16', authority_revision: 3,
    projection_status: 'current', projection_authority_revision: 3, staffing_authority_revision: null,
    sources: [{ source_id: '50000000-0000-4000-8000-000000000001', source_digest: 'a'.repeat(64), slot_count: 3 }],
    current_publication: { publication_id: PUBLICATION, version_id: VERSION, version_number: 1, effective_start: '2026-08-10' },
    drafts: [], display_version: { version_id: VERSION, lifecycle_state: 'published' },
    roster: [
      { slot_id: SLOT_WORKING, slot_label: 'Karen slot', contractor_capacity: false, incumbencies: [{ person_id: '30000000-0000-4000-8000-000000000001', person_name: 'Karen Robinson', effective_start: '2020-01-01' }], week_staffing: weekStaffing(SLOT_WORKING) },
      { slot_id: SLOT_DEPARTED, slot_label: 'Departed named slot', contractor_capacity: false, incumbencies: [{ person_id: '30000000-0000-4000-8000-000000000002', person_name: 'Departed Employee', effective_start: '2020-01-01' }], week_staffing: weekStaffing(SLOT_DEPARTED) },
      { slot_id: SLOT_CONTRACTOR, slot_label: 'CoverAll capacity 1', contractor_capacity: true, incumbencies: [] },
    ],
    availability,
    assignments: Array.from({ length: 7 }, (_, day) => ({ assignment_id: `assignment-${day}`, work_id: `work-${day}`, day_of_week: day, status: 'assigned', location_name: `Zoo Area ${day + 1}`, coverage_start: '08:00', coverage_end: '10:00', owner_slot_id: SLOT_WORKING, workload_points: 40 })),
    exceptions: [], latest_projection: null,
  };
}

async function confirmScheduleAction(page, label) {
  const dialog = page.locator('#action-confirm-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: label, exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function installRoutes(context, { failAtomicTurnover = false } = {}) {
  const fixture = schedulerFixture();
  const calls = [];
  const commitProjection = () => {
    const workingSlot = fixture.roster.find((slot) => slot.week_staffing.some((row) => row.availability_state === 'working'))?.slot_id;
    fixture.latest_projection = {
      publication_id: PUBLICATION,
      assignments: fixture.assignments.map((row) => ({
        plan_work_id: row.work_id,
        day_of_week: row.day_of_week,
        status: workingSlot ? 'assigned' : 'open',
        owner_slot_id: workingSlot || null,
        work_snapshot: {
          locationNameSnapshot: row.location_name,
          window: { start: row.coverage_start, end: row.coverage_end },
          serviceEffortMinutes: row.workload_points,
        },
      })),
    };
    fixture.projection_status = 'current';
    fixture.projection_authority_revision = fixture.authority_revision;
  };
  commitProjection();
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
    if (path === '/static-weekly/employees/departed' && failAtomicTurnover) {
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'No feasible schedule for current staffing.' }) });
    }
    fixture.authority_revision += 1;
    if (path === '/static-weekly/drafts/replacement') {
      fixture.drafts = [{ version_id: DRAFT_VERSION, revision: 1, lifecycle_state: 'draft', effective_start: fixture.week_start }];
    }
    if (path === `/static-weekly/drafts/${DRAFT_VERSION}/publish`) {
      fixture.current_publication = { publication_id: PUBLICATION, version_id: DRAFT_VERSION, version_number: 2, effective_start: fixture.week_start };
      fixture.drafts = [];
    }
    if (path === '/static-weekly/day-changes/batch') {
      const body = request.postDataJSON();
      body.operations.forEach((operation, index) => fixture.exceptions.push({
        id: `exception-${fixture.authority_revision}-${index}`,
        type: operation.operation === 'cover_all' ? 'cover_all' : operation.exception_type,
        serviceDate: body.service_date,
        reason: operation.reason,
        payload: operation.operation === 'cover_all' ? { availability: { slotId: operation.slot_id } } : operation.payload,
      }));
    }
    if (path === '/static-weekly/exceptions') {
      const body = request.postDataJSON();
      if (body.exception_type === 'reverse') fixture.exceptions = fixture.exceptions.filter((row) => row.id !== body.reverses_exception_id);
      else fixture.exceptions.push({ id: `exception-${fixture.authority_revision}`, type: body.exception_type, serviceDate: body.service_date, reason: body.reason, payload: body.payload });
    }
    if (path === '/static-weekly/contractor-capacity') fixture.exceptions.push({ id: `exception-${fixture.authority_revision}`, type: 'cover_all', serviceDate: request.postDataJSON().service_date, reason: request.postDataJSON().reason, payload: { availability: { slotId: request.postDataJSON().slot_id } } });
    if (path === '/static-weekly/employees/departed') {
      const body = request.postDataJSON();
      for (const row of fixture.roster.find((item) => item.slot_id === body.slot_id).week_staffing.filter((item) => item.service_date >= '2026-08-12')) {
        row.availability_state = 'departed_named_absent'; row.employee_active = false; row.device_ids = [];
      }
      for (const row of fixture.availability.filter((item) => item.slot_id === body.slot_id && item.service_date >= '2026-08-12')) row.availability_state = 'departed_named_absent';
    }
    if (path === '/static-weekly/employees/replacements') {
      const body = request.postDataJSON(); const newId = '30000000-0000-4000-8000-000000000099';
      const slot = fixture.roster.find((item) => item.slot_id === body.slot_id);
      slot.incumbencies.at(-1).effective_end = '2026-08-12';
      slot.incumbencies.push({ person_id: newId, person_name: body.new_employee_name, effective_start: '2026-08-12' });
      for (const row of slot.week_staffing.filter((item) => item.service_date >= '2026-08-12')) {
        row.availability_state = 'working'; row.person_id = newId; row.person_name = body.new_employee_name; row.employee_active = true; row.device_ids = ['KIOSK_03'];
      }
      for (const row of fixture.availability.filter((item) => item.slot_id === body.slot_id && item.service_date >= '2026-08-12')) row.availability_state = 'working';
    }
    commitProjection();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { revision: fixture.authority_revision, data: { publication_id: PUBLICATION } } }) });
  });
  return { calls, fixture };
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 667 }]) {
  test(`${viewport.name} weekly scheduler renders static ownership and dated changes`, async ({ browser }) => {
    const context = await browser.newContext({ viewport });
    const backend = await installRoutes(context);
    const page = await context.newPage();
    await installOperationalClock(page);
    await page.goto('/schedule-weekly.html?date=2026-08-11');
    await expect(page.getByRole('heading', { name: 'Weekly Custodial Schedule' })).toBeVisible();
    await expect(page.getByText('Karen Robinson').first()).toBeVisible();
    await expect(page.getByText('Departed Employee', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Absent until replacement').first()).toBeVisible();
    await expect(page.getByText('CoverAll capacity 1', { exact: true })).toBeVisible();
    await expect(page.locator('#open-count')).toHaveText('0');
    await expect(page.locator('#service-date')).toHaveValue('2026-08-11');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);

    if (viewport.name === 'desktop') {
      await page.evaluate(() => { window.location.hash = 'changes'; });
      await expect(page.getByRole('tab', { name: 'Changes' })).toHaveClass(/active/);
      await page.getByRole('tab', { name: 'Week' }).click();
    }

    if (viewport.name === 'desktop') await page.locator('#absence-type').selectOption('pto');
    await page.locator(`[data-callout-slot="${SLOT_WORKING}"]`).check();
    await page.locator(`[data-contractor-slot="${SLOT_CONTRACTOR}"]`).check();
    await page.getByRole('button', { name: 'Apply Day Changes' }).click();
    await confirmScheduleAction(page, 'Apply Changes');
    await expect(page.getByText(viewport.name === 'desktop' ? 'PTO already applied' : 'Call-out already applied')).toBeVisible();
    await expect(page.getByText('Contractor capacity already applied')).toBeVisible();
    expect(backend.calls.map((call) => call.path)).toEqual(['/static-weekly/day-changes/batch']);
    expect(backend.calls.every((call) => call.authorization === 'Bearer weekly-manager-browser-token')).toBe(true);
    expect(backend.calls[0].body.expected_revision).toBe(3);
    expect(backend.calls[0].body.operations).toHaveLength(2);
    expect(backend.calls[0].body.operations[0].exception_type).toBe(viewport.name === 'desktop' ? 'pto' : 'daily_absence');

    await page.getByRole('tab', { name: 'Changes' }).click();
    const removeAbsence = page.getByRole('button', { name: viewport.name === 'desktop' ? 'Remove Pto' : 'Remove Daily Absence' });
    await removeAbsence.click();
    await confirmScheduleAction(page, 'Remove Change');
    await expect(removeAbsence).toHaveCount(0);
    expect(backend.calls.map((call) => call.path)).toEqual([
      '/static-weekly/day-changes/batch',
      '/static-weekly/exceptions',
    ]);
    expect(backend.calls[1].body.exception_type).toBe('reverse');
    expect(backend.calls[1].body.reverses_exception_id).toBe('exception-4-0');
    expect(backend.calls[1].body.expected_revision).toBe(4);

    await page.getByRole('button', { name: 'Add replacement for Departed Employee' }).click();
    await page.locator('#replacement-name').fill('Taylor New');
    await page.getByRole('button', { name: 'Add Employee' }).click();
    await expect(page.getByText('Taylor New').first()).toBeVisible();
    await expect(page.getByText('KIOSK_03').first()).toBeVisible();
    expect(backend.calls.at(-1).path).toBe('/static-weekly/employees/replacements');
    expect(backend.calls.at(-1).body.new_employee_name).toBe('Taylor New');
    expect(backend.calls.at(-1).body.expected_revision).toBe(5);
    expect(backend.calls.at(-1).body).not.toHaveProperty('effective_start');

    await page.getByRole('button', { name: 'Mark gone Karen Robinson' }).click();
    await page.getByRole('button', { name: 'Mark Gone', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add replacement for Karen Robinson' })).toBeVisible();
    expect(backend.calls.at(-1).path).toBe('/static-weekly/employees/departed');
    expect(backend.calls.at(-1).body.expected_revision).toBe(6);
    expect(backend.calls.at(-1).body).not.toHaveProperty('effective_start');
    expect(backend.calls.every((call) => call.authorization === 'Bearer weekly-manager-browser-token')).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: `test-results/schedule-weekly-${viewport.name}.png`, fullPage: true });
    await context.close();
  });
}

test('draft and publication use deterministic in-page confirmation without duplicate commands', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const backend = await installRoutes(context);
  const page = await context.newPage();
  await installOperationalClock(page);
  await page.goto('/schedule-weekly.html?date=2026-08-11');

  await page.getByRole('button', { name: 'Generate Draft' }).click();
  await expect(page.getByRole('heading', { name: 'Generate weekly draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(backend.calls).toHaveLength(0);

  await page.getByRole('button', { name: 'Generate Draft' }).click();
  await confirmScheduleAction(page, 'Generate Draft');
  await expect(page.getByRole('button', { name: 'Publish Week' })).toBeEnabled();
  expect(backend.calls.map((call) => call.path)).toEqual(['/static-weekly/drafts/replacement']);
  expect(backend.calls[0].body.expected_revision).toBe(3);

  await page.getByRole('button', { name: 'Publish Week' }).click();
  await expect(page.getByRole('heading', { name: 'Publish weekly schedule' })).toBeVisible();
  await confirmScheduleAction(page, 'Publish Week');
  await expect.poll(() => backend.calls.length).toBe(2);
  expect(backend.calls.map((call) => call.path)).toEqual([
    '/static-weekly/drafts/replacement',
    `/static-weekly/drafts/${DRAFT_VERSION}/publish`,
  ]);
  expect(backend.calls[1].body.expected_revision).toBe(4);
  expect(backend.calls.every((call) => call.authorization === 'Bearer weekly-manager-browser-token')).toBe(true);
  await context.close();
});

test('failed atomic turnover leaves the previous current schedule unchanged', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const backend = await installRoutes(context, { failAtomicTurnover: true });
  const page = await context.newPage();
  await installOperationalClock(page);
  await page.goto('/schedule-weekly.html?date=2026-08-11');
  await page.getByRole('button', { name: 'Mark gone Karen Robinson' }).click();
  await page.getByRole('button', { name: 'Mark Gone', exact: true }).click();
  await expect(page.locator('#week-meta')).toContainText('Published baseline');
  await expect(page.locator('#week-meta')).toContainText('7 work items');
  await page.getByRole('tab', { name: 'Readiness' }).click();
  await expect(page.getByText('Current staffing projection').locator('..').getByText('Ready')).toBeVisible();
  await expect(page.locator('#status')).toContainText('No feasible schedule for current staffing.');
  expect(backend.calls.map((call) => call.path)).toEqual(['/static-weekly/employees/departed']);
  expect(backend.fixture.authority_revision).toBe(3);
  await context.close();
});
