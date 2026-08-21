const { test, expect } = require('@playwright/test');

const DEVICE_ID = 'KIOSK_04';
const SESSION_ID = '00000000-0000-4000-8000-000000000401';
const NFC_ENTRY_A = '00000000-0000-4000-8000-000000000421';
const NFC_ENTRY_B = '00000000-0000-4000-8000-000000000422';
const NFC_ENTRY_C = '00000000-0000-4000-8000-000000000423';
const NFC_ENTRY_D = '00000000-0000-4000-8000-000000000424';
const NFC_ENTRY_E = '00000000-0000-4000-8000-000000000425';
const NFC_ENTRY_F = '00000000-0000-4000-8000-000000000426';
const NFC_ENTRY_G = '00000000-0000-4000-8000-000000000430';
const NFC_ENTRY_H = '00000000-0000-4000-8000-000000000439';
const SCHEMA_FINGERPRINT = '6a5ed2cb582ef6d77400ebe2eec5738066b1073b1ed8187ad6615c139e171eaf';
function currentAuthoritySnapshot() {
  return {
    schema_version: 'offline-scan-snapshot.v2',
    contract_version: 'scan.v4.snapshot-bound-authority',
    snapshot_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    canonical_device_id: DEVICE_ID,
    employee_id: '00000000-0000-4000-8000-000000000406',
    credential_id: '40000000-0000-4000-8000-000000000004',
    employee_name: 'Tammy Miller',
    assignment_epoch: 3,
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    locations: [{ location_code: 'TETM', location_name: "Teton Men's Restroom", location_type: 'restroom', form_type: 'restroom' }],
  };
}

async function json(route, status, body, headers = {}) {
  await route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installKioskRuntime(context, {
  session = null, resumeView = '', fullyDeviceId = DEVICE_ID, verifiedEntryIds = [],
} = {}) {
  await context.addInitScript(({ deviceId, nativeDeviceId, seededSession, view, entryIds }) => {
    window.fully = {
      bindings: {},
      bind(event, source) { this.bindings[event] = source; },
      getDeviceId() { return nativeDeviceId; },
      getDeviceName() { return 'TAMMY'; },
    };
    localStorage.setItem('mz_scan_device_id', deviceId);
    localStorage.setItem('mz_employee_hub_device_id', deviceId);
    localStorage.setItem('memphisAssignedDeviceId', deviceId);
    const attestations = new Map(entryIds.map((entryId) => [entryId, {
      schema_version: 'scan-entry-attestation.v1',
      entry_id: entryId,
      entry_source: 'native-nfc',
      device_id: deviceId,
      location_code: 'TETM',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      client_session_id: null,
      action: null,
    }]));
    const completionTime = (clientSessionId) => {
      const key = `mz_test_native_completion_time:${clientSessionId}`;
      const endedAt = localStorage.getItem(key) || new Date().toISOString();
      localStorage.setItem(key, endedAt);
      return endedAt;
    };
    window.MemphisMobile = {
      nativeOfflineTimeAuthority: false,
      saveOfflineScanAuthoritySnapshot: async (snapshot) => {
        localStorage.setItem(`mz_scan_authority_snapshot:${deviceId}`, JSON.stringify(snapshot));
        return true;
      },
      loadOfflineAuthoritySnapshot: async (requestedDeviceId) => {
        if (requestedDeviceId !== deviceId) throw new Error('The protected device identity is unavailable for offline work admission.');
        const snapshot = JSON.parse(localStorage.getItem(`mz_scan_authority_snapshot:${deviceId}`) || 'null');
        if (!snapshot) throw new Error('The protected offline authority snapshot is unavailable.');
        return snapshot;
      },
      authorizeOfflineNewWork: async (requestedDeviceId, snapshotId) => {
        const snapshot = JSON.parse(localStorage.getItem(`mz_scan_authority_snapshot:${deviceId}`) || 'null');
        if (requestedDeviceId !== deviceId || snapshot?.snapshot_id !== snapshotId) {
          throw new Error('The protected offline authority did not authorize new work.');
        }
        return { authorized: true };
      },
      verifyScanEntryAttestation: async (entryId) => {
        const record = attestations.get(entryId);
        if (!record) throw new Error('The native scan handoff is missing or expired.');
        return { ...record };
      },
      bindScanEntryAttestation: async (entryId, clientSessionId, locationCode, action) => {
        const record = attestations.get(entryId);
        if (!record || record.location_code !== locationCode || !['start', 'finish'].includes(action)
          || (record.client_session_id && record.client_session_id !== clientSessionId)
          || (record.action && record.action !== action)) {
          throw new Error('The native scan handoff cannot be bound to this session.');
        }
        attestations.set(entryId, { ...record, client_session_id: clientSessionId, action });
        return true;
      },
      consumeScanEntryAttestation: async (entryId, clientSessionId, locationCode, action) => {
        const record = attestations.get(entryId);
        if (!record || record.client_session_id !== clientSessionId || record.location_code !== locationCode || record.action !== action) {
          throw new Error('The native scan handoff cannot be consumed by this session.');
        }
        attestations.delete(entryId);
        return true;
      },
      createOfflineStartAttestation: async (input) => {
        window.__nativeStartInput = input;
        const record = attestations.get(input.nativeScanEntryId);
        if (!record || record.location_code !== input.locationCode || record.client_session_id
          || record.action) throw new Error('The native NFC handoff cannot authorize this start.');
        attestations.delete(input.nativeScanEntryId);
        return {
          p_client_started_at: new Date().toISOString(),
          p_native_scan_entry_id: input.nativeScanEntryId,
          p_native_start_attestation_version: 'custodial-native-start.v1',
          p_native_start_attestation: 'a'.repeat(64),
          input,
        };
      },
      captureOfflineCompletionTime: async (input) => {
        const record = attestations.get(input.nativeFinishScanEntryId);
        if (!record || record.client_session_id !== input.clientSessionId || record.action !== 'finish') {
          throw new Error('The native NFC finish handoff is missing.');
        }
        return {
          p_client_ended_at: completionTime(input.clientSessionId),
          p_native_finish_scan_entry_id: input.nativeFinishScanEntryId,
        };
      },
      createOfflineCompletionAttestation: async (input) => ({
        p_client_ended_at: completionTime(input.clientSessionId),
        p_native_finish_scan_entry_id: input.nativeFinishScanEntryId,
        p_native_completion_attestation_version: 'custodial-native-completion.v2',
        p_native_completion_attestation: 'b'.repeat(64),
        input,
      }),
      acknowledgeOfflineCompletion: async (input) => {
        attestations.delete(input.nativeFinishScanEntryId);
        localStorage.setItem('mz_test_completion_acknowledgement', JSON.stringify(input));
        return { acknowledged: true };
      },
    };
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
  }, {
    deviceId: DEVICE_ID,
    nativeDeviceId: fullyDeviceId,
    seededSession: session,
    view: resumeView,
    entryIds: verifiedEntryIds,
  });
}

async function seedOfflineAuthority(context, { expiresAt = new Date(Date.now() + 60 * 60_000).toISOString() } = {}) {
  await context.addInitScript(({ deviceId, expiration, schemaFingerprint }) => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    localStorage.setItem(`mz_scan_contract_cache:release-2026.07.19.custodial-v3.12`, JSON.stringify({
      app_version: 'release-2026.07.19.custodial-v3.12',
      contract_version: 'scan.v4.snapshot-bound-authority',
      backend_version: 'release-2026.07.19.custodial-v3.12',
      schema_fingerprint: schemaFingerprint,
      validated_at: new Date().toISOString(),
    }));
    localStorage.setItem(`mz_scan_authority_snapshot:${deviceId}`, JSON.stringify({
      schema_version: 'offline-scan-snapshot.v2',
      contract_version: 'scan.v4.snapshot-bound-authority',
      snapshot_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      canonical_device_id: deviceId,
      employee_id: '00000000-0000-4000-8000-000000000406',
      credential_id: '40000000-0000-4000-8000-000000000004',
      employee_name: 'Tammy Miller',
      assignment_epoch: 3,
      generated_at: new Date().toISOString(),
      expires_at: expiration,
      locations: [{ location_code: 'TETM', location_name: "Teton Men's Restroom", location_type: 'restroom', form_type: 'restroom' }],
    }));
  }, { deviceId: DEVICE_ID, expiration: expiresAt, schemaFingerprint: SCHEMA_FINGERPRINT });
}

async function installCommonRoutes(context, scanHandler = null, {
  backendVersion = 'release-2026.07.19.custodial-v3.12',
  onScanRequest = () => {},
} = {}) {
  await context.route('https://api.open-meteo.com/**', (route) => json(route, 200, {
    current: { temperature_2m: 25, weather_code: 0, wind_speed_10m: 3 },
    daily: { temperature_2m_max: [28], temperature_2m_min: [20] },
    hourly: { time: [], precipitation_probability: [] },
  }));
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/version') return json(route, 200, {
      ok: true,
      version: backendVersion,
      contracts: { scan: 'scan.v4.snapshot-bound-authority' },
      release_manifest: { schema: { fingerprint: SCHEMA_FINGERPRINT } },
    });
    if (url.pathname === '/scan-api/rpc') {
      const request = JSON.parse(route.request().postData() || '{}');
      onScanRequest(request);
      if (request.fn === 'tool_get_offline_scan_authority_snapshot') {
        return json(route, 200, { ok: true, data: currentAuthoritySnapshot() });
      }
    }
    if (url.pathname === '/scan-api/rpc' && scanHandler) return scanHandler(route);
    if (url.pathname === '/scan-api/rpc') return json(route, 200, { ok: true, data: {} });
    if (url.pathname.includes('/current-attendance')) return json(route, 200, { ok: true, data: { attendance: 0 } });
    if (url.pathname.includes('/my-day-summary')) return json(route, 200, { ok: true, data: { employee: { display_name: 'Tammy Miller' } } });
    return json(route, 200, { ok: true, data: {} });
  });
}

test('backend versions below the published minimum fail closed before scan work', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { verifiedEntryIds: [NFC_ENTRY_F] });
  let scanCalls = 0;
  await installCommonRoutes(context, async (route) => {
    scanCalls += 1;
    return json(route, 200, { ok: true, data: {} });
  }, { backendVersion: 'release-2026.07.18.custodial-v99.99' });
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&source=native-nfc&entry_id=${NFC_ENTRY_F}`);
  await expect(page.getByRole('heading', { name: 'Update Required' })).toBeVisible();
  expect(scanCalls).toBe(0);
  await context.close();
});

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
    context_id: '00000000-0000-4000-8000-000000000402',
    occurrence_id: '00000000-0000-4000-8000-000000000432',
    submission_proof: 'a'.repeat(64),
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

test('an active employee session cannot enter completion without a fresh NFC attestation', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { session: activeSession() });
  await installCommonRoutes(context, async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_get_system_settings') return json(route, 200, { ok: true, data: { system_enabled: true } });
    if (request.fn === 'tool_get_location_scan_state') return json(route, 200, { ok: true, data: {
      location_code: 'TETM', location_name: "Teton Men's Restroom", location_type: 'restroom', form_type: 'restroom',
      canonical_device_id: DEVICE_ID, assigned_device_employee_name: 'Tammy Miller', suggested_action: 'finish_session',
      latest_session_uuid: SESSION_ID, latest_session_status: 'active',
    } });
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&device=${DEVICE_ID}`);
  await expect(page.getByRole('heading', { name: 'Scan Again To Complete' })).toBeVisible();
  expect(await page.evaluate(() => Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key) => key?.startsWith('session:')).map((key) => JSON.parse(localStorage.getItem(key)).status)
    .includes('pending_submit'))).toBe(false);
  await page.goto(`/index.html?code=TETM&device=${DEVICE_ID}&session_uuid=${SESSION_ID}&action=complete`);
  await expect(page.getByRole('heading', { name: 'Scan Again To Complete' })).toBeVisible();
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
  await installKioskRuntime(context, {
    fullyDeviceId: 'f6cd1bb6-80852ca3', verifiedEntryIds: [NFC_ENTRY_A],
  });
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
  await installKioskRuntime(context, {
    fullyDeviceId: 'f6cd1bb6-80852ca3', verifiedEntryIds: [NFC_ENTRY_A],
  });
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
        occurrence_id: '00000000-0000-4000-8000-000000000432',
        snapshot_id: request.args.p_snapshot_id,
        employee_id: request.args.p_snapshot_employee_id,
        assignment_epoch: request.args.p_snapshot_assignment_epoch,
        submission_proof: 'a'.repeat(64),
      } });
    }
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&source=native-nfc&entry_id=${NFC_ENTRY_A}`);
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

test('NFC occurrence completes through v4 with signed start and finish entry evidence', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, {
    fullyDeviceId: 'f6cd1bb6-80852ca3', verifiedEntryIds: [NFC_ENTRY_A, NFC_ENTRY_B],
  });
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
        occurrence_id: '00000000-0000-4000-8000-000000000433',
        snapshot_id: request.args.p_snapshot_id,
        employee_id: request.args.p_snapshot_employee_id,
        assignment_epoch: request.args.p_snapshot_assignment_epoch,
        submission_proof: 'b'.repeat(64),
      } });
    }
    if (request.fn === 'tool_commit_cleaning_workflow') {
      completion = request.args;
      return json(route, 200, { ok: true, data: {
        status: 'closed', terminal: true, client_session_id: activeClientSession,
        client_completion_id: request.args.p_client_completion_id,
        occurrence_id: '00000000-0000-4000-8000-000000000433',
        session_uuid: '00000000-0000-4000-8000-000000000404',
      } });
    }
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&source=native-nfc&entry_id=${NFC_ENTRY_A}`);
  await page.getByRole('button', { name: 'Start Cleaning' }).click();
  await expect(page.getByRole('heading', { name: 'Cleaning In Progress' })).toBeVisible();
  await page.goto(`/index.html?code=TETM&source=native-nfc&entry_id=${NFC_ENTRY_B}`);
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
  expect(completion.p_scan_evidence).toContainEqual(expect.objectContaining({
    client_event_id: NFC_ENTRY_B,
    event_type: 'scan_finish',
    result: 'ok',
    scanned_at: completion.p_client_ended_at,
    payload_json: { entry_source: 'native-nfc' },
  }));
  expect(completion.p_native_finish_scan_entry_id).toBe(NFC_ENTRY_B);
  expect(completion.p_native_completion_attestation_version).toBe('custodial-native-completion.v2');
  expect(completion.p_scan_evidence.every((event) => event.payload_json.entry_source === 'native-nfc')).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mz_test_completion_acknowledgement')))).toEqual(expect.objectContaining({
    deviceId: DEVICE_ID,
    locationCode: 'TETM',
    clientSessionId: activeClientSession,
    nativeFinishScanEntryId: NFC_ENTRY_B,
    clientStartedAt: completion.p_client_started_at,
    clientEndedAt: completion.p_client_ended_at,
  }));
  await context.close();
});

test('a transient scan read failure falls back to the current snapshot without a stuck error card', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { verifiedEntryIds: [NFC_ENTRY_C] });
  await seedOfflineAuthority(context);
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
  await page.goto(`/index.html?code=TETM&device=${DEVICE_ID}&source=native-nfc&entry_id=${NFC_ENTRY_C}`);
  await expect(page.getByRole('heading', { name: 'Pre-Scan' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reconnecting' })).toHaveCount(0);
  expect(stateReads).toBe(1);
  await context.close();
});

test('wake restores the completion form and its phone-saved draft', async ({ browser }) => {
  const session = { ...activeSession('pending_submit'), ended_at: '2026-07-19T00:00:00.000Z', duration_display: '30 min' };
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { session, resumeView: 'completion-form' });
  await context.addInitScript(({ sessionId }) => {
    localStorage.setItem(`mz_scan_completion_draft:${sessionId}`, JSON.stringify({
      services: ['Empty trash'],
      issues: ['Sink leaking'],
      note: 'Saved before screen sleep',
    }));
  }, { sessionId: SESSION_ID });
  await installCommonRoutes(context);
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&device=${DEVICE_ID}&session_uuid=${SESSION_ID}&action=resume`);
  await expect(page.getByRole('heading', { name: 'Restroom Completion Form' })).toBeVisible();
  await expect(page.locator('input[name="services"][value="Empty trash"]')).toBeChecked();
  await expect(page.locator('input[name="issues"][value="Sink leaking"]')).toBeChecked();
  await expect(page.locator('textarea[name="note"]')).toHaveValue('Saved before screen sleep');
  await context.close();
});

test('process death after accepted completion reuses the journaled completion identity', async ({ browser }) => {
  const endedAt = new Date().toISOString();
  const session = {
    ...activeSession('pending_submit'),
    ended_at: endedAt,
    duration_display: '30 min',
    native_finish_scan_entry_id: NFC_ENTRY_B,
    scan_evidence: [{ client_event_id: NFC_ENTRY_B, event_type: 'scan_finish', result: 'ok', scanned_at: endedAt, payload_json: { entry_source: 'native-nfc' } }],
  };
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { session, resumeView: 'completion-form' });
  let firstCompletionId = '';
  let completionCalls = 0;
  const requestOrder = [];
  let releaseFirstCompletion;
  const firstCompletionHeld = new Promise((resolve) => { releaseFirstCompletion = resolve; });
  await installCommonRoutes(context, async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_commit_cleaning_workflow') {
      completionCalls += 1;
      firstCompletionId ||= request.args.p_client_completion_id;
      expect(request.args.p_client_completion_id).toBe(firstCompletionId);
      if (completionCalls === 1) {
        await firstCompletionHeld;
        // Model acceptance followed by a lost response. The next WebView must
        // replay this exact idempotency identity instead of inventing one.
        return json(route, 503, { ok: false, error: 'accepted response lost before delivery' }, { 'Retry-After': '1' });
      }
      return json(route, 200, { ok: true, data: {
        status: 'closed', terminal: true,
        session_uuid: SESSION_ID,
        client_session_id: request.args.p_client_session_id,
        client_completion_id: request.args.p_client_completion_id,
        occurrence_id: '00000000-0000-4000-8000-000000000432',
      } });
    }
    return json(route, 200, { ok: true, data: {} });
  }, { onScanRequest: (request) => requestOrder.push(request.fn) });
  const first = await context.newPage();
  await first.goto(`/index.html?code=TETM&device=${DEVICE_ID}&session_uuid=${SESSION_ID}&action=resume`);
  await first.locator('input[name="services"]').first().check();
  await first.getByRole('button', { name: 'Submit Completion' }).click({ noWaitAfter: true });
  await expect.poll(() => first.evaluate((sessionId) => {
    const local = JSON.parse(localStorage.getItem(`session:${sessionId}`));
    return local && { id: local.client_completion_id, state: local.sync_status };
  }, SESSION_ID)).toEqual({ id: expect.any(String), state: 'submission_pending' });
  releaseFirstCompletion();
  // Model acceptance followed by a lost response before process death. Once
  // the retry state is durable, the replacement WebView can reclaim it.
  await expect.poll(() => first.evaluate(() => window.MemphisScanSync.listActions()
    .then((rows) => rows.length === 1 && rows[0].state === 'retrying'))).toBe(true);
  await first.close();

  const recoveryRequestStart = requestOrder.length;
  const recovered = await context.newPage();
  await recovered.goto(`/index.html?code=TETM&device=${DEVICE_ID}&session_uuid=${SESSION_ID}&action=resume`);
  await expect.poll(() => completionCalls, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  const recoveryOrder = requestOrder.slice(recoveryRequestStart);
  expect(recoveryOrder.indexOf('tool_commit_cleaning_workflow')).toBeGreaterThanOrEqual(0);
  expect(recoveryOrder).not.toContain('tool_get_offline_scan_authority_snapshot');
  expect(firstCompletionId).toMatch(/^[0-9a-f-]{36}$/i);
  await context.close();
});

test('process death after accepted start recovers the same journal identity and proof', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { verifiedEntryIds: [NFC_ENTRY_C] });
  let startCalls = 0;
  let firstIdentity = null;
  let releaseFirstStart;
  const firstStartHeld = new Promise((resolve) => { releaseFirstStart = resolve; });
  await installCommonRoutes(context, async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_get_system_settings') return json(route, 200, { ok: true, data: { system_enabled: true } });
    if (request.fn === 'tool_get_offline_scan_authority_snapshot') return json(route, 200, { ok: true, data: {} });
    if (request.fn === 'tool_get_location_scan_state') return json(route, 200, { ok: true, data: {
      location_code: 'TETM', location_name: "Teton Men's Restroom", location_type: 'restroom', form_type: 'restroom',
      canonical_device_id: DEVICE_ID, assigned_device_employee_name: 'Tammy Miller', suggested_action: 'start_session',
    } });
    if (request.fn === 'tool_start_offline_occurrence') {
      startCalls += 1;
      firstIdentity ||= { id: request.args.p_client_session_id, startedAt: request.args.p_client_started_at };
      if (startCalls === 1) await firstStartHeld;
      else releaseFirstStart();
      expect(request.args.p_client_session_id).toBe(firstIdentity.id);
      expect(request.args.p_client_started_at).toBe(firstIdentity.startedAt);
      return json(route, 200, { ok: true, data: {
        client_session_id: firstIdentity.id, canonical_location_code: 'TETM', started_at: firstIdentity.startedAt,
        context_id: '00000000-0000-4000-8000-000000000405',
        occurrence_id: '00000000-0000-4000-8000-000000000435',
        snapshot_id: request.args.p_snapshot_id,
        employee_id: request.args.p_snapshot_employee_id,
        assignment_epoch: request.args.p_snapshot_assignment_epoch,
        submission_proof: 'c'.repeat(64),
      } });
    }
    return json(route, 200, { ok: true, data: {} });
  });
  const first = await context.newPage();
  await first.goto(`/index.html?code=TETM&source=native-nfc&entry_id=${NFC_ENTRY_C}`);
  await first.getByRole('button', { name: 'Start Cleaning' }).click({ noWaitAfter: true });
  await expect.poll(async () => first.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith('session:'));
    const session = key ? JSON.parse(localStorage.getItem(key)) : null;
    return session && { id: session.client_session_id, startedAt: session.started_at, status: session.status };
  })).toEqual({ id: expect.any(String), startedAt: expect.any(String), status: 'offline-provisional' });
  const resumeUrl = first.url();
  expect(resumeUrl).toContain('action=resume');
  await first.close();
  releaseFirstStart();

  const recovered = await context.newPage();
  await recovered.goto(resumeUrl);
  await expect(recovered.getByRole('heading', { name: 'Cleaning In Progress' })).toBeVisible();
  await expect.poll(async () => recovered.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith('session:'));
    const session = key ? JSON.parse(localStorage.getItem(key)) : null;
    return session && { id: session.client_session_id, startedAt: session.started_at, proof: session.submission_proof };
  })).toEqual({ id: firstIdentity.id, startedAt: firstIdentity.startedAt, proof: 'c'.repeat(64) });
  expect(startCalls).toBeGreaterThanOrEqual(1);
  await context.close();
});

test('crash after local start journal but before resume URL still replays the exact start', async ({ browser }) => {
  const interruptedId = '00000000-0000-4000-8000-000000000427';
  const interruptedAt = new Date(Date.now() - 15_000).toISOString();
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, {
    session: {
      ...activeSession('offline-provisional'),
      session_uuid: interruptedId,
      client_session_id: interruptedId,
      started_at: interruptedAt,
      server_acknowledged: false,
      sync_status: 'activation_queued',
      offline_authority_snapshot_id: 'a'.repeat(64),
      offline_authority_employee_id: '00000000-0000-4000-8000-000000000406',
      offline_authority_assignment_epoch: 3,
      offline_authority_credential_id: '40000000-0000-4000-8000-000000000004',
      native_start_attestation_version: 'custodial-native-start.v1',
      native_start_attestation: 'a'.repeat(64),
      entry_id: NFC_ENTRY_G,
    },
  });
  let replay = null;
  await installCommonRoutes(context, async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_start_offline_occurrence') {
      replay = request.args;
      return json(route, 200, { ok: true, data: {
        client_session_id: interruptedId,
        canonical_location_code: 'TETM',
        started_at: interruptedAt,
        context_id: '00000000-0000-4000-8000-000000000428',
        occurrence_id: '00000000-0000-4000-8000-000000000429',
        snapshot_id: request.args.p_snapshot_id,
        employee_id: request.args.p_snapshot_employee_id,
        assignment_epoch: request.args.p_snapshot_assignment_epoch,
        submission_proof: 'd'.repeat(64),
      } });
    }
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&device=${DEVICE_ID}`);
  await expect(page.getByRole('heading', { name: 'Cleaning In Progress' })).toBeVisible();
  expect(replay).toMatchObject({
    p_client_session_id: interruptedId,
    p_client_started_at: interruptedAt,
    p_native_scan_entry_id: NFC_ENTRY_G,
    p_snapshot_credential_id: '40000000-0000-4000-8000-000000000004',
  });
  const recovered = await page.evaluate((sessionId) => JSON.parse(localStorage.getItem(`session:${sessionId}`)), interruptedId);
  expect(recovered).toMatchObject({
    client_session_id: interruptedId,
    context_id: '00000000-0000-4000-8000-000000000428',
    submission_proof: 'd'.repeat(64),
    server_acknowledged: true,
  });
  await context.close();
});

test('process death before JavaScript receives native start proof resumes the durable NFC occurrence', async ({ browser }) => {
  const interruptedId = '00000000-0000-4000-8000-000000000436';
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, {
    verifiedEntryIds: [NFC_ENTRY_H],
    session: {
      ...activeSession('offline-provisional'),
      session_uuid: interruptedId,
      client_session_id: interruptedId,
      started_at: '',
      server_acknowledged: false,
      sync_status: 'activation_queued',
      offline_authority_snapshot_id: 'a'.repeat(64),
      offline_authority_employee_id: '00000000-0000-4000-8000-000000000406',
      offline_authority_assignment_epoch: 3,
      offline_authority_credential_id: '40000000-0000-4000-8000-000000000004',
      entry_id: NFC_ENTRY_H,
      entry_source: 'native-nfc',
      entry_attestation: 'native-entry-pending.v1',
    },
  });
  let replay = null;
  await installCommonRoutes(context, async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_start_offline_occurrence') {
      replay = request.args;
      return json(route, 200, { ok: true, data: {
        client_session_id: interruptedId,
        canonical_location_code: 'TETM',
        started_at: request.args.p_client_started_at,
        context_id: '00000000-0000-4000-8000-000000000437',
        occurrence_id: '00000000-0000-4000-8000-000000000438',
        snapshot_id: request.args.p_snapshot_id,
        employee_id: request.args.p_snapshot_employee_id,
        assignment_epoch: request.args.p_snapshot_assignment_epoch,
        submission_proof: 'e'.repeat(64),
      } });
    }
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&device=${DEVICE_ID}`);
  await expect(page.getByRole('heading', { name: 'Cleaning In Progress' })).toBeVisible();
  expect(await page.evaluate(() => window.__nativeStartInput)).toEqual(expect.objectContaining({
    clientSessionId: interruptedId,
    nativeScanEntryId: NFC_ENTRY_H,
    snapshotCredentialId: '40000000-0000-4000-8000-000000000004',
  }));
  expect(replay).toMatchObject({
    p_client_session_id: interruptedId,
    p_native_scan_entry_id: NFC_ENTRY_H,
    p_snapshot_credential_id: '40000000-0000-4000-8000-000000000004',
  });
  const recovered = await page.evaluate((sessionId) => JSON.parse(localStorage.getItem(`session:${sessionId}`)), interruptedId);
  expect(recovered).toMatchObject({
    client_session_id: interruptedId,
    server_acknowledged: true,
    submission_proof: 'e'.repeat(64),
  });
  await context.close();
});

test('fresh offline NFC uses only a current matching authority snapshot', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { verifiedEntryIds: [NFC_ENTRY_D] });
  await seedOfflineAuthority(context);
  await context.route('https://memphis-zoo-mcp.onrender.com/**', (route) => route.abort('internetdisconnected'));
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&source=native-nfc&entry_id=${NFC_ENTRY_D}`);
  await expect(page.getByRole('heading', { name: 'Pre-Scan' })).toBeVisible();
  await expect(page.getByText('Tammy Miller')).toBeVisible();
  await page.getByRole('button', { name: 'Start Cleaning' }).click();
  await expect(page.getByRole('heading', { name: 'Cleaning In Progress' })).toBeVisible();
  const session = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith('session:'));
    return JSON.parse(localStorage.getItem(key));
  });
  expect(session.offline_authority_snapshot_id).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  expect(session.server_acknowledged).toBe(false);
  await context.close();
});

test('expired or unknown offline authority stays fail closed', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { verifiedEntryIds: [NFC_ENTRY_E, NFC_ENTRY_F] });
  await seedOfflineAuthority(context, { expiresAt: new Date(Date.now() - 60_000).toISOString() });
  await context.route('https://memphis-zoo-mcp.onrender.com/**', (route) => route.abort('internetdisconnected'));
  const page = await context.newPage();
  await page.goto(`/index.html?code=TETM&source=native-nfc&entry_id=${NFC_ENTRY_E}`);
  await expect(page.getByRole('heading', { name: 'Reconnecting' })).toBeVisible();
  await page.goto(`/index.html?code=UNKNOWN&source=native-nfc&entry_id=${NFC_ENTRY_F}`);
  await expect(page.getByRole('heading', { name: 'Reconnecting' })).toBeVisible();
  await context.close();
});

test('timer identity and elapsed time survive full WebView reconstruction', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'FullyKiosk Browser' });
  await installKioskRuntime(context, { session: activeSession(), resumeView: 'timer' });
  await installCommonRoutes(context);
  const first = await context.newPage();
  await first.goto(`/index.html?code=TETM&device=${DEVICE_ID}&session_uuid=${SESSION_ID}&action=resume`);
  await expect(first.getByRole('heading', { name: 'Cleaning In Progress' })).toBeVisible();
  const before = await first.locator('#timer').textContent();
  await first.close();
  const rebuilt = await context.newPage();
  await rebuilt.goto(`/index.html?code=TETM&device=${DEVICE_ID}&session_uuid=${SESSION_ID}&action=resume`);
  await expect(rebuilt.getByText("Teton Men's Restroom")).toBeVisible();
  await expect(rebuilt.getByText('Tammy Miller')).toBeVisible();
  await expect(rebuilt.getByText(`Session ID: ${SESSION_ID}`)).toBeVisible();
  expect(await rebuilt.locator('#timer').textContent()).not.toBe('00:00:00');
  expect(before).not.toBe('00:00:00');
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
