const { test, expect } = require('@playwright/test');

const DEVICE_ID = 'KIOSK_08';
const EMPLOYEE_ID = '00000000-0000-4000-8000-000000000008';

function event(id, overrides = {}) {
  return {
    id,
    event_name: 'Zoo Event',
    event_date: '2099-09-14',
    end_date: '2099-09-14',
    start_time: '09:00:00',
    end_time: '11:00:00',
    display_location: 'Event Center',
    attendee_count: null,
    notes: null,
    status: 'SCHEDULED',
    event_timezone: 'America/Chicago',
    ...overrides,
  };
}

async function installEmployeeRuntime(context) {
  await context.addInitScript(({ deviceId, employeeId }) => {
    const security = {
      state: 'enrolled', initialized: true, ready: true, available: true,
      quarantined: false, deviceId, generation: 11,
    };
    window.MemphisCustodialSecurity = {
      getStatus: () => ({ ...security }),
      mutateProtectedWork: async (operation) => operation({ generation: security.generation }),
    };
    window.MemphisMobile = {
      ready: Promise.resolve(),
      edition: 'custodial',
      deviceId: () => deviceId,
      readCustodialHomeCache: () => ({ profile: { employee_id: employeeId } }),
    };
  }, { deviceId: DEVICE_ID, employeeId: EMPLOYEE_ID });
}

test('employee events preserve zero, missing count, notes, status, and the last good offline snapshot', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installEmployeeRuntime(context);
  let offline = false;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (offline) return route.abort('failed');
    if (url.pathname === '/employee-events-api') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: [
            event('00000000-0000-4000-8000-000000000001', {
              event_name: 'Known Zero Event',
              attendee_count: 0,
              notes: 'Use <north> service door.\nBring liners.',
            }),
            event('00000000-0000-4000-8000-000000000002', {
              event_name: 'Missing Count Event',
              attendee_count: null,
              status: 'CANCELLED',
            }),
          ],
          meta: {
            generated_at: '2099-09-13T14:30:00.000Z',
            canonical_device_id: DEVICE_ID,
            employee_id: EMPLOYEE_ID,
            assignment_epoch: 7,
            credential_id: 'credential-kiosk-08',
          },
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });

  const page = await context.newPage();
  await page.goto(`/employee-events.html?device=${DEVICE_ID}`);
  await expect(page.locator('.event')).toHaveCount(2);
  await expect(page.getByText('Expected guests: 0', { exact: true })).toBeVisible();
  await expect(page.getByText('Expected guests: Not provided', { exact: true })).toBeVisible();
  await expect(page.getByText('Scheduled', { exact: true })).toBeVisible();
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  await expect(page.locator('.notes')).toContainText('Use <north> service door.');
  expect(await page.locator('.notes').evaluate((node) => node.innerHTML)).toContain('&lt;north&gt;');

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), `mz_employee_events_snapshot:${DEVICE_ID}`);
  expect(saved).toMatchObject({
    schema_version: 'employee-events-snapshot.v1',
    device_id: DEVICE_ID,
    employee_id: EMPLOYEE_ID,
    assignment_epoch: 7,
    security_generation: 11,
  });
  expect(saved.data).toHaveLength(2);

  offline = true;
  await page.reload();
  await expect(page.locator('.event')).toHaveCount(2);
  await expect(page.locator('#state-text')).toContainText('No connection — showing your last update from');
  await expect(page.getByText('Expected guests: 0', { exact: true })).toBeVisible();
  await context.close();
});

test('authorization failure never falls back to a saved employee event snapshot', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installEmployeeRuntime(context);
  await context.addInitScript(({ deviceId, employeeId, eventForInit }) => {
    localStorage.setItem(`mz_employee_events_snapshot:${deviceId}`, JSON.stringify({
      schema_version: 'employee-events-snapshot.v1',
      device_id: deviceId,
      employee_id: employeeId,
      security_generation: 11,
      saved_at: '2099-09-13T14:00:00.000Z',
      data: [eventForInit],
    }));
  }, {
    deviceId: DEVICE_ID,
    employeeId: EMPLOYEE_ID,
    eventForInit: event('00000000-0000-4000-8000-000000000003', { event_name: 'Must Stay Hidden' }),
  });
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/employee-events-api') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'device_credential_required' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });

  const page = await context.newPage();
  await page.goto(`/employee-events.html?device=${DEVICE_ID}`);
  await expect(page.locator('#state-text')).toHaveText('This phone needs a manager.');
  await expect(page.getByText('Must Stay Hidden', { exact: true })).toHaveCount(0);
  await context.close();
});
