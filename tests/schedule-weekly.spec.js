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

// Main's UNIT bearer must not be persisted in traces/video/screenshots.
// Worker options must be file-level; leave all historical defaults untouched
// when the owning fixture is absent. Main selects only the opt-in member.
if (process.env.CUSTODIAL_PENDING_BROWSER_FIXTURE) {
  test.use({ trace: 'off', video: 'off', screenshot: 'off' });
}
test.describe('owned current scheduler browser integration', () => {
  test.skip(!process.env.CUSTODIAL_PENDING_BROWSER_FIXTURE,
    'NOT_RUN: Main must export its existing owned normal HTTP/SQL fixture.');

  test('current pending original through actual browser and normal runtime', async ({ browser, baseURL }, testInfo) => {
    const requireInput = (ok, message) => { if (!ok) throw new Error(message); };
    const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
    let input, endpoint, frontend;
    try {
      input = JSON.parse(process.env.CUSTODIAL_PENDING_BROWSER_FIXTURE);
      endpoint = new URL(input.endpoint); frontend = new URL(baseURL);
    } catch { throw new Error('The closed owning fixture JSON/loopback URLs are unavailable; no session data is logged.'); }
    const keys = ['endpoint', 'week', 'session', 'employeeId', 'slotId', 'publicationId', 'versionId', 'revision'];
    const loopback = url => url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
      && !url.username && !url.password;
    requireInput(Object.keys(input).sort().join(',') === keys.sort().join(',')
      && loopback(endpoint) && endpoint.port && endpoint.pathname === '/' && !endpoint.search && !endpoint.hash
      && loopback(frontend), 'Only Main’s closed fixture and existing owned loopback endpoints are admitted.');
    requireInput(input.week === '2026-10-19', 'The owning week must remain exactly 2026-10-19.');
    const today = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    requireInput(today.year + '-' + today.month + '-' + today.day <= input.week,
      'The fixed owning date elapsed; do not replace the clock or substitute a week.');
    requireInput(input.employeeId === 'abac6002-02ee-46b4-bc16-11337b0abb2a'
      && input.slotId === 'e91b7a47-f20f-5777-a5d3-9c0ce8778df5'
      && uuid(input.publicationId) && uuid(input.versionId)
      && Number.isSafeInteger(input.revision) && input.revision >= 0,
    'The existing KAILI identity and actual accepted initial publication/version/revision are required.');
    const session = input.session;
    requireInput(session && session.role === 'ops_manager' && typeof session.token === 'string' && session.token.length > 0
      && uuid(session.manager_id) && typeof session.device_id === 'string' && session.device_id.length > 0
      && typeof session.credential_id === 'string' && session.credential_id.length > 0
      && Number.isFinite(Date.parse(session.expires_at)) && Date.parse(session.expires_at) > Date.now()
      && session.permissions?.schema === 'custodial.manager-permissions.v1'
      && session.permissions.read === true && session.permissions.manage_absences === true,
    'Main must supply its actual current UNIT manager session/absence permission.');

    const base = '/static-weekly/staffing-commands';
    const missingMessage = 'No release-admitted approved pattern matches the current staffing. The original request is preserved; nothing was accepted.';
    const key = 'mz_scheduler_dated_operation_v1:' + encodeURIComponent(endpoint.origin) + ':' + session.manager_id;
    const traffic = [], blocked = [], issues = [], reads = [], counts = { begin: 0, prepare: 0, cancel: 0 };
    let operationId = null, routedOperationId = null, reloaded = false, lostReply = false, page;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const clean = value => {
      if (Array.isArray(value)) return value.map(clean);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
        .filter(([name]) => !/token|secret|password|authorization|cookie|session|credential/i.test(name))
        .map(([name, child]) => [name, clean(child)]));
      return typeof value === 'string' ? value.split(session.token).join('[REDACTED]') : value;
    };
    const record = async response => {
      const request = response.request(), url = new URL(request.url());
      if (url.origin !== endpoint.origin || !(url.pathname === base || url.pathname.startsWith(base + '/'))
        || url.pathname.endsWith('/cancel')) return;
      try {
        const text = await response.text();
        requireInput(text.length <= 1048576, 'Original operation response exceeds the bounded case limit.');
        traffic.push({ method: request.method(), path: url.pathname, status: response.status(),
          request_body: request.postData() ? clean(JSON.parse(request.postData())) : null,
          response_body: text ? clean(JSON.parse(text)) : null, after_reload: reloaded });
      } catch { issues.push('Original operation response unavailable as bounded JSON.'); }
    };
    const savedRaw = () => page.evaluate(storageKey => localStorage.getItem(storageKey), key); // READ ONLY
    const commandPath = suffix => base + '/' + operationId + suffix;
    try {
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.origin === 'https://memphis-zoo-mcp.onrender.com' && request.method() === 'GET') {
          if (url.pathname === '/auth-api/session') return json({ ok: true, data: { session } });
          if (url.pathname === '/scheduler-runtime-config') {
            return json({ ok: true, data: { configured: true, public_url: endpoint.origin } });
          }
        }
        if (url.origin === endpoint.origin && url.pathname.startsWith('/static-weekly/')) {
          // Preserve the actual browser Origin/headers/body and actual CORS.
          if (['GET', 'OPTIONS'].includes(request.method())) return route.continue();
          const match = url.pathname.match(/^\/static-weekly\/staffing-commands\/([0-9a-f-]{36})\/(prepare|cancel)$/i);
          const kind = url.pathname === base ? 'begin' : match && uuid(match[1]) ? match[2] : null;
          if (request.method() !== 'POST' || reloaded || !kind
            || match && operationId && match[1] !== operationId) {
            let body = null;
            try { body = request.postData() ? clean(JSON.parse(request.postData())) : null; }
            catch { body = '[unparseable request body omitted]'; }
            traffic.push({ method: request.method(), path: url.pathname, status: null,
              request_body: body, response_body: null, after_reload: reloaded, blocked: true });
            issues.push('Unexpected scheduler mutation refused.'); return route.abort('blockedbyclient');
          }
          counts[kind]++;
          if (counts[kind] !== 1) {
            issues.push('Repeated original mutation refused; no retry sent.'); return route.abort('blockedbyclient');
          }
          if (kind === 'prepare') {
            routedOperationId = match[1]; // actual request DATA, not an invented operation
            return route.continue();
          }
          if (kind === 'begin') return route.continue();
          // One real cancel request, without a header/body override or retry.
          // Drop ONLY its successful reply after the actual endpoint responds.
          try {
            const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 });
            const text = await response.text();
            requireInput(text.length <= 1048576, 'Original cancel response exceeds the bounded case limit.');
            const body = JSON.parse(text), value = body?.data;
            const entry = { method: 'POST', path: url.pathname, status: response.status(),
              request_body: clean(JSON.parse(request.postData())), response_body: clean(body),
              after_reload: false, client_reply_lost: false };
            traffic.push(entry);
            if (response.status() === 200 && body?.ok === true && value?.cancelled === true
              && value.operation_id === operationId && value.state === 'CANCELLED') {
              entry.client_reply_lost = lostReply = true;
              return route.abort('failed');
            }
            return route.fulfill({ response }); // real refusal unchanged, never fake committed success
          } catch {
            issues.push('Original cancel transport failed before a successful reply was observed.');
            return route.abort('failed');
          }
        }
        if (url.origin === frontend.origin && ['GET', 'HEAD'].includes(request.method())) return route.continue();
        blocked.push({ method: request.method(), origin: url.origin, path: url.pathname });
        return route.abort('blockedbyclient'); // external Lucide is optional; never substitute code
      });
      page = await context.newPage();
      page.on('response', response => { reads.push(record(response)); });
      const snapshotResponse = response => {
        const url = new URL(response.url());
        return url.origin === endpoint.origin && url.pathname === '/static-weekly/manager-snapshot'
          && response.request().method() === 'GET' && response.status() === 200;
      };
      const firstRead = page.waitForResponse(snapshotResponse);
      await page.goto('/schedule-weekly.html?date=' + input.week + '&week_start=' + input.week,
        { waitUntil: 'domcontentloaded' });
      const initial = (await (await firstRead).json()).data;
      requireInput(initial?.week_start === input.week && /^\d{4}-\d{2}-\d{2}$/.test(initial.current_service_date)
        && initial.current_service_date <= input.week && initial.authority_revision === input.revision
        && initial.current_publication?.publication_id === input.publicationId
        && initial.current_publication?.version_id === input.versionId
        && initial.roster?.some(row => row.slot_id === input.slotId
          && row.incumbencies?.some(person => person.person_id === input.employeeId)),
      'The actual current read does not match Main’s original accepted basis/KAILI.');
      const loaded = 'Loaded 2026-10-19 through 2026-10-25.';
      await expect(page.locator('#status')).toHaveText(loaded);
      await expect(page.locator('#revision-count')).toHaveText(String(input.revision));
      expect(await savedRaw() === null, 'No pending original may be seeded.').toBe(true);
      await page.locator('#absence-type').selectOption('daily_absence');
      await page.locator('#absence-end-date').fill(input.week);
      await page.locator('[data-callout-slot="' + input.slotId + '"]').check();
      const beginRead = page.waitForResponse(response => new URL(response.url()).origin === endpoint.origin
        && new URL(response.url()).pathname === base && response.request().method() === 'POST');
      await page.locator('#apply-day-btn').click(); // real UI creates original body/key; no private function call
      const begun = await (await beginRead).json();
      requireInput(begun?.ok === true && uuid(begun.data?.operation_id), 'Normal BEGIN lacks its original operation.');
      operationId = begun.data.operation_id;
      await expect(page.locator('#status')).toHaveText(missingMessage);
      await expect(page.locator('#scheduler-pending-text')).toContainText('No confirmation is available.');
      await expect(page.locator('#staffing-confirm-btn')).toBeHidden();
      await expect(page.locator('#scheduler-cancel-preparation')).toBeEnabled();
      await Promise.all(reads);
      const prepared = traffic.find(row => row.path === commandPath('/prepare') && row.method === 'POST');
      requireInput(routedOperationId === operationId && prepared?.status === 409
        && prepared.response_body?.code === 'static_template_missing_approved_pattern'
        && prepared.response_body?.operation_outcome === 'rejected',
      'Actual normal preparation did not return the same original typed missing-pattern dependency.');
      const original = JSON.parse(await savedRaw());
      requireInput(original.state === 'PENDING' && original.command.phase === 'PREPARING'
        && original.command.operationId === operationId && original.body.employee_id === input.employeeId
        && original.body.start_date === input.week && original.body.end_date === input.week
        && original.body.expected_revision === input.revision && original.receipt === null
        && original.command.confirmationAttempted === false && original.command.confirmationKey === null,
      'The actual page did not retain its exact unaccepted original.');

      await page.locator('#scheduler-cancel-preparation').click();
      const dialog = page.locator('#action-confirm-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading')).toHaveText('Cancel unpublished preparation');
      await dialog.getByRole('button', { name: 'Cancel Unpublished Preparation', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator('#scheduler-pending-text')).toContainText('An original unpublished cancellation was attempted.');
      await expect(page.locator('#scheduler-retry')).toBeEnabled();
      requireInput(lostReply && counts.cancel === 1, 'One actual successful cancel reply was not observed and lost.');
      const attemptedRaw = await savedRaw(), attempted = JSON.parse(attemptedRaw);
      requireInput(attempted.encoded === original.encoded && JSON.stringify(attempted.body) === JSON.stringify(original.body)
        && attempted.command.operationId === operationId
        && attempted.command.semanticDigest === original.command.semanticDigest
        && attempted.command.cancellationAttempt?.operationId === operationId
        && attempted.command.confirmationAttempted === false && attempted.command.confirmationKey === null
        && attempted.receipt === null && attempted.state === 'PENDING',
      'Lost reply changed/retired the original before independent cancellation readback.');
      for (const field of ['base', 'managerId', 'principal', 'path', 'weekStart', 'publicationId', 'versionId', 'weekBindings']) {
        expect(JSON.stringify(attempted[field]) === JSON.stringify(original[field]),
          'The original ' + field + ' binding changed during the cancellation attempt.').toBe(true);
      }
      await Promise.all(reads);

      reloaded = true;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#status')).toHaveText(loaded);
      await expect(page.locator('#scheduler-pending-text')).toContainText('An original unpublished cancellation was attempted.');
      expect(await savedRaw() === attemptedRaw, 'Reload must retain the same complete saved original attempt.').toBe(true);
      const originalRead = page.waitForResponse(response => new URL(response.url()).origin === endpoint.origin
        && new URL(response.url()).pathname === commandPath('')
        && response.request().method() === 'GET' && response.status() === 200);
      await page.getByRole('button', { name: 'Read original cancellation outcome', exact: true }).click();
      const cancelled = (await (await originalRead).json()).data;
      requireInput(cancelled?.operation_id === operationId && cancelled.state === 'CANCELLED'
        && cancelled.semantic_digest === original.command.semanticDigest && cancelled.accepted_receipt === null,
      'Actual original GET did not independently confirm CANCELLED.');
      await expect(page.locator('#scheduler-pending-panel')).toBeHidden();
      await expect(page.locator('#status')).toContainText('The exact original reads CANCELLED.');
      expect(await savedRaw() === null, 'Only matching original CANCELLED may retire the local control.').toBe(true);
      const lastRead = page.waitForResponse(snapshotResponse);
      await page.locator('#refresh-btn').click();
      const final = (await (await lastRead).json()).data;
      for (const field of ['authority_revision', 'current_publication', 'assignments', 'availability',
        'exceptions', 'latest_projection', 'canonical_staffing_absences']) {
        expect(JSON.stringify(final?.[field]) === JSON.stringify(initial[field]),
          'The actual current ' + field + ' changed after unpublished cancellation.').toBe(true);
      }
      await expect(page.locator('#status')).toHaveText(loaded);
      await Promise.all(reads);
      expect(counts).toEqual({ begin: 1, prepare: 1, cancel: 1 });
      expect(traffic.filter(row => row.after_reload && row.method !== 'OPTIONS').every(row => row.method === 'GET')).toBe(true);
      expect(traffic.some(row => row.after_reload && row.path === commandPath(''))).toBe(true);
      expect(issues).toEqual([]);
      expect(blocked.every(row => row.method === 'GET' && row.origin === 'https://unpkg.com'
        && row.path === '/lucide@0.468.0/dist/umd/lucide.min.js')).toBe(true);
      // Main independently checks the retained SQL original, one cancellation
      // receipt, unchanged schedule and zero leases. This attachment admits nothing.
    } finally {
      await Promise.allSettled(reads);
      try {
        await testInfo.attach('current-pending-original-sanitized-http', {
          contentType: 'application/json',
          body: JSON.stringify({ operation_id: operationId, traffic, blocked, issues,
            request_counts: counts, client_lost_one_cancel_reply: lostReply }, null, 2),
        });
      } finally { await context.close(); }
    }
  });
});
