const { test, expect } = require('@playwright/test');

const DEVICE_ID = 'KIOSK_04';
const SESSION_ID = '00000000-0000-4000-8000-000000000401';

async function json(route, status, body, headers = {}) {
  await route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installKioskRuntime(context, { session = null, resumeView = '', fullyDeviceId = DEVICE_ID } = {}) {
  await context.addInitScript(({ deviceId, nativeDeviceId, seededSession, view }) => {
    window.fully = {
      bindings: {},
      bind(event, source) { this.bindings[event] = source; },
      getDeviceId() { return nativeDeviceId; },
      getDeviceName() { return 'TAMMY'; },
    };
    localStorage.setItem('mz_scan_device_id', deviceId);
    localStorage.setItem('mz_employee_hub_device_id', deviceId);
    localStorage.setItem('memphisAssignedDeviceId', deviceId);
    if (seededSession) {
      localStorage.setItem(`session:${seededSession.session_uuid}`, JSON.stringify(seededSession));
      if (view) {
        localStorage.setItem(`mz_phone_scan_resume:${deviceId}`, JSON.stringify({
          session_uuid: seededSession.session_uuid,
          client_session_id: seededSession.client_session_id,
          device_id: deviceId,
          location_code: seededSession.location_code,
          view,
          saved_at: new Date().toISOString(),
        }));
      }
    }
  }, { deviceId: DEVICE_ID, nativeDeviceId: fullyDeviceId, seededSession: session, view: resumeView });
}

async function installCommonRoutes(context, scanHandler = null) {
  await context.route('https://api.open-meteo.com/**', (route) => json(route, 200, {
    current: { temperature_2m: 25, weather_code: 0, wind_speed_10m: 3 },
    daily: { temperature_2m_max: [28], temperature_2m_min: [20] },
    hourly: { time: [], precipitation_probability: [] },
  }));
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/version') return json(route, 200, {
      ok: true,
      version: 'release-2026.07.19.custodial-v3.12',
      contracts: { scan: 'scan.v3.offline-authority' },
    });
    if (url.pathname === '/scan-api/rpc' && scanHandler) return scanHandler(route);
    if (url.pathname === '/scan-api/rpc') return json(route, 200, { ok: true, data: {} });
    if (url.pathname.includes('/current-attendance')) return json(route, 200, { ok: true, data: { attendance: 0 } });
    if (url.pathname.includes('/my-day-summary')) return json(route, 200, { ok: true, data: { employee: { display_name: 'Tammy Miller' } } });
    return json(route, 200, { ok: true, data: {} });
  });
}

function activeSession(status = 'active') {
  return {
    session_uuid: SESSION_ID,
    client_session_id: SESSION_ID,
    location_code: 'TETM',
    location_name: "Teton Men's Restroom",
    location_type: 'restroom',
    form_type: 'restroom',
    employee_name: 'Tammy Miller',
    device_id: DEVICE_ID,
    status,
    started_at: '2026-07-18T23:30:00.000Z',
    server_acknowledged: true,
  };
}

test('screen wake resumes an active scan without finishing it', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { session: activeSession(), resumeView: 'timer' });
  let finishCalls = 0;
  await installCommonRoutes(context, async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_finish_session') finishCalls += 1;
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await context.newPage();
  await page.goto(`/employee-hub.html?device=${DEVICE_ID}&lock=1`);
  await page.evaluate(() => window.MemphisUI.handlePhoneWake({ force: true }));
  await expect(page).toHaveURL(/index\.html.*action=resume/);
  await expect(page.getByRole('heading', { name: 'Cleaning In Progress' })).toBeVisible();
  expect(finishCalls).toBe(0);
  await context.close();
});

test('screen wake without an open scan refreshes the locked employee hub', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context);
  await installCommonRoutes(context);
  const page = await context.newPage();
  await page.goto(`/events.html?hub=employee&device=${DEVICE_ID}`);
  await page.evaluate(() => window.MemphisUI.handlePhoneWake({ force: true }));
  await expect(page).toHaveURL(/employee-hub\.html.*lock=1/);
  await expect(page.locator('#kiosk-lock-screen')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/kiosk-locked/);
  await context.close();
});

test('opening an employee app does not reinterpret page navigation as screen-off', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { fullyDeviceId: 'f6cd1bb6-80852ca3' });
  await installCommonRoutes(context);
  const page = await context.newPage();
  await page.goto(`/employee-hub.html?device=${DEVICE_ID}&lock=1`);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.locator('body')).toHaveClass(/kiosk-unlocked/);

  const employeeApps = [
    ['messages-link', /messages\.html.*hub=employee/],
    ['schedule-link', /employee-schedule\.html.*hub=employee/],
    ['events-link', /events\.html.*hub=employee/],
    ['feedback-link', /system-feedback\.html.*hub=employee/],
  ];
  for (const [linkId, expectedUrl] of employeeApps) {
    await page.evaluate((id) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      window.location.assign(document.getElementById(id).href);
    }, linkId);
    await page.waitForTimeout(700);
    await expect(page).toHaveURL(expectedUrl);
    await page.goto(`/employee-hub.html?device=${DEVICE_ID}&hub=employee&lock=0`);
    await expect(page.locator('body')).toHaveClass(/kiosk-unlocked/);
    await expect(page.locator('#kiosk-lock-screen')).toBeHidden();
  }
  await context.close();
});

test('NFC entry keeps the stored canonical kiosk identity instead of Fully hardware id', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { fullyDeviceId: 'f6cd1bb6-80852ca3' });
  const observed = [];
  await installCommonRoutes(context, async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    observed.push({
      fn: request.fn,
      bodyDeviceId: request.device_id,
      argDeviceId: request.args?.p_device_id,
      headerDeviceId: route.request().headers()['x-device-id'],
      entrySource: request.args?.p_scan_evidence?.find((event) => event?.payload_json?.entry_source)?.payload_json?.entry_source,
    });
    if (request.fn === 'tool_get_system_settings') {
      return json(route, 200, { ok: true, data: { system_enabled: true } });
    }
    if (request.fn === 'tool_get_location_scan_state') {
      return json(route, 200, { ok: true, data: {
        location_code: 'TETM',
        location_name: "Teton Men's Restroom",
        location_type: 'restroom',
        form_type: 'restroom',
        canonical_device_id: DEVICE_ID,
        assigned_device_employee_name: 'Tammy Miller',
        suggested_action: 'start_session',
      } });
    }
    if (request.fn === 'tool_start_offline_occurrence') {
      return json(route, 200, { ok: true, data: {
        client_session_id: request.args.p_client_session_id,
        canonical_location_code: 'TETM',
        started_at: request.args.p_client_started_at,
        context_id: '00000000-0000-4000-8000-000000000402',
        submission_proof: 'a'.repeat(64),
      } });
    }
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await context.newPage();
  await page.goto('/index.html?code=TETM&source=native-nfc');
  await expect(page.getByRole('heading', { name: 'Pre-Scan' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`device=${DEVICE_ID}`));
  const scanStateRequest = observed.find((request) => request.fn === 'tool_get_location_scan_state');
  expect(scanStateRequest).toEqual({
    fn: 'tool_get_location_scan_state',
    bodyDeviceId: DEVICE_ID,
    argDeviceId: DEVICE_ID,
    headerDeviceId: DEVICE_ID,
    entrySource: undefined,
  });
  await page.getByRole('button', { name: 'Start Cleaning' }).click();
  await expect(page.getByRole('heading', { name: 'Cleaning In Progress' })).toBeVisible();
  const storedEvidence = await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith('session:')) continue;
      const session = JSON.parse(localStorage.getItem(key));
      const source = session.scan_evidence?.find((event) => event?.payload_json?.entry_source)?.payload_json?.entry_source;
      if (source) return source;
    }
    return null;
  });
  expect(storedEvidence).toBe('native-nfc');
  await context.close();
});

test('NFC occurrence completes through v3 with its proof and immutable entry evidence', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { fullyDeviceId: 'f6cd1bb6-80852ca3' });
  let activeClientSession = '';
  let completion = null;
  await installCommonRoutes(context, async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_get_system_settings') {
      return json(route, 200, { ok: true, data: { system_enabled: true } });
    }
    if (request.fn === 'tool_get_location_scan_state') {
      return json(route, 200, { ok: true, data: {
        location_code: 'TETM', location_name: "Teton Men's Restroom",
        location_type: 'restroom', form_type: 'restroom', canonical_device_id: DEVICE_ID,
        assigned_device_employee_name: 'Tammy Miller',
        suggested_action: activeClientSession ? 'finish_session' : 'start_session',
      } });
    }
    if (request.fn === 'tool_start_offline_occurrence') {
      activeClientSession = request.args.p_client_session_id;
      return json(route, 200, { ok: true, data: {
        client_session_id: activeClientSession,
        canonical_location_code: 'TETM',
        started_at: request.args.p_client_started_at,
        context_id: '00000000-0000-4000-8000-000000000403',
        submission_proof: 'b'.repeat(64),
      } });
    }
    if (request.fn === 'tool_commit_cleaning_workflow') {
      completion = request.args;
      return json(route, 200, { ok: true, data: {
        status: 'closed', terminal: true, client_session_id: activeClientSession,
        session_uuid: '00000000-0000-4000-8000-000000000404',
      } });
    }
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await context.newPage();
  await page.goto('/index.html?code=TETM&source=native-nfc');
  await page.getByRole('button', { name: 'Start Cleaning' }).click();
  await expect(page.getByRole('heading', { name: 'Cleaning In Progress' })).toBeVisible();
  await page.goto('/index.html?code=TETM&source=native-nfc');
  await expect(page.getByRole('heading', { name: 'Complete Cleaning' })).toBeVisible();
  await page.getByRole('button', { name: 'PRESS TO CONTINUE' }).click();
  await expect(page.getByRole('heading', { name: 'Restroom Completion Form' })).toBeVisible();
  await page.locator('input[name="services"]').first().check();
  await page.getByRole('button', { name: 'Submit Completion' }).click();
  await expect.poll(() => completion).not.toBeNull();
  expect(completion.p_client_session_id).toBe(activeClientSession);
  expect(completion.p_response_json.__custodial_offline_reconciliation_v1).toEqual({
    context_id: '00000000-0000-4000-8000-000000000403',
    submission_proof: 'b'.repeat(64),
  });
  expect(completion.p_scan_evidence.map((event) => event.event_type)).toContain('scan_start');
  expect(completion.p_scan_evidence.every((event) => event.payload_json.entry_source === 'native-nfc')).toBe(true);
  await context.close();
});

test('a transient scan read failure recovers without leaving a stuck error card', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context);
  let stateReads = 0;
  await installCommonRoutes(context, async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_get_system_settings') return json(route, 200, { ok: true, data: { system_enabled: true } });
    if (request.fn === 'tool_get_location_scan_state') {
      stateReads += 1;
      if (stateReads === 1) return json(route, 503, { ok: false, error: 'temporary dependency outage' });
      return json(route, 200, { ok: true, data: {
        location_code: 'TETM',
        location_name: "Teton Men's Restroom",
        location_type: 'restroom',
        form_type: 'restroom',
        canonical_device_id: DEVICE_ID,
        assigned_device_employee_name: 'Tammy Miller',
        suggested_action: 'start_session',
      } });
    }
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&device=${DEVICE_ID}`);
  await expect(page.getByRole('heading', { name: 'Reconnecting' })).toBeVisible();
  await page.getByRole('button', { name: 'Try Again Now' }).click();
  await expect(page.getByRole('heading', { name: 'Pre-Scan' })).toBeVisible();
  expect(stateReads).toBe(2);
  await context.close();
});

test('wake restores the completion form and its phone-saved draft', async ({ browser }) => {
  const session = { ...activeSession('pending_submit'), ended_at: '2026-07-19T00:00:00.000Z', duration_display: '30 min' };
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { session, resumeView: 'completion-form' });
  await context.addInitScript(({ sessionId }) => {
    localStorage.setItem(`mz_scan_completion_draft:${sessionId}`, JSON.stringify({
      services: ['Empty trash'],
      note: 'Saved before screen sleep',
    }));
  }, { sessionId: SESSION_ID });
  await installCommonRoutes(context);
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&device=${DEVICE_ID}&session_uuid=${SESSION_ID}&action=resume`);
  await expect(page.getByRole('heading', { name: 'Restroom Completion Form' })).toBeVisible();
  await expect(page.locator('input[name="services"][value="Empty trash"]')).toBeChecked();
  await expect(page.locator('textarea[name="note"]')).toHaveValue('Saved before screen sleep');
  await context.close();
});

test('permanent authorization failure is not mislabeled as backend unavailable', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context);
  await installCommonRoutes(context, async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_get_system_settings') return json(route, 200, { ok: true, data: { system_enabled: true } });
    if (request.fn === 'tool_get_location_scan_state') return json(route, 403, { ok: false, error: 'device denied' });
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&device=${DEVICE_ID}`);
  await expect(page.getByRole('heading', { name: 'Unauthorized Device' })).toBeVisible();
  await expect(page.getByText('Reconnecting')).toHaveCount(0);
  await context.close();
});
