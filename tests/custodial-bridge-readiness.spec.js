const { expect, test } = require('@playwright/test');

const OUTPUT_ROOT = 'build/batch-0b-shell-browser/custodial';
const AUTHORITATIVE_DEVICE = 'KIOSK_08';
const STALE_QUERY_DEVICE = 'KIOSK_02';

async function installDelayedNativeVault(page, {
  historicalQuarantineReason = '',
  reconstructedHistoricalRecovery = false,
  scanJournalDisposition = null,
  scanState = null,
} = {}) {
  await page.addInitScript(({
    authoritativeDevice,
    historicalReason,
    reconstructedRecovery,
    journalDisposition,
    configuredScanState,
  }) => {
    const seal = 'readiness-native-installation-seal-v1';
    const installation = {
      schema_version: 1,
      device_id: authoritativeDevice,
      installation_seal: seal,
      enrolled_at: '2026-08-01T12:00:00.000Z',
      migrated_from_credential_only_state: true,
    };
    const nativeState = {
      schema_version: 1,
      state: 'ACTIVE',
      active: true,
      credential_present: true,
      blocked: false,
      installation,
    };
    if (journalDisposition) {
      nativeState.scan_journal_state = 'READY';
      nativeState.scan_journal_recovery_required = false;
      nativeState.scan_journal_disposition = journalDisposition;
    }
    let releaseState;
    const delayedState = new Promise((resolve) => { releaseState = resolve; });
    const audit = { getStateCalls: 0, requests: [] };

    const encodeJson = (value) => btoa(unescape(encodeURIComponent(JSON.stringify(value))));
    const response = (payload, status = 200) => ({
      status,
      headers: { 'content-type': 'application/json' },
      body_base64: encodeJson(payload),
    });
    const authorizedResponse = (request) => {
      const path = String(request?.path || '');
      if (localStorage.getItem('__custodial_test_offline_home') === '1'
        && (path.startsWith('/device-auth/status') || path.startsWith('/schedule-api/my-day-summary'))) {
        return Promise.reject(new Error('simulated employee Home refresh outage'));
      }
      if (path.startsWith('/device-auth/status')) {
        return response({ ok: true, data: {
          authenticated: true,
          canonical_device_id: authoritativeDevice,
          device_id: authoritativeDevice,
          credential_id: '285ef315-3455-4b62-9a33-d6b5c4d6f901',
          employee_name: 'Karen Robinson',
        } });
      }
      if (path.startsWith('/messaging-api/me/by-device')) {
        return response({ ok: true, data: {
          msg_user_id: '00000000-0000-4000-8000-000000000808',
          display_name: 'Karen Robinson',
          role: 'employee',
          canonical_device_id: authoritativeDevice,
        } });
      }
      if (path.startsWith('/messaging-api/threads/updates')) return new Promise(() => {});
      if (path.startsWith('/messaging-api/threads')) return response({ ok: true, data: [] });
      if (path.startsWith('/schedule-api/my-day-summary')) {
        return response({ ok: true, data: {
          employee_name: 'Karen Robinson',
          device_id: authoritativeDevice,
          service_date: '2026-08-01',
          source: 'static_weekly_projection',
          projection_status: 'current',
          groups: [{
            group_code: 'LOSSY_LEGACY_SUMMARY',
            group_name: 'Lossy Legacy Summary',
            included_locations: ['Lossy Legacy Summary'],
          }],
          all_items: [{
            occurrence_id: '00000000-0000-4000-8000-000000000811',
            group_code: 'TETON_RESTROOM',
            group_name: 'Teton Restroom',
            location_name: 'Teton Restroom',
            included_locations: ['Teton Restroom'],
            coverage_purpose: 'area_owner',
            section_title: 'Primary area coverage',
            coverage_start: '08:00',
            coverage_end: '10:00',
          }, {
            occurrence_id: '00000000-0000-4000-8000-000000000812',
            group_code: 'TETON_RESTROOM',
            group_name: 'Teton Restroom',
            location_name: 'Teton Restroom',
            included_locations: ['Teton Restroom'],
            coverage_purpose: 'area_owner',
            section_title: 'Primary area coverage',
            coverage_start: '13:00',
            coverage_end: '14:00',
          }],
        } });
      }
      if (path === '/scan-api/rpc' && configuredScanState) {
        return response({ ok: true, data: configuredScanState });
      }
      if (path === '/feedback-api/submit') return response({ ok: true, data: { accepted: true } });
      return response({ ok: true, data: {} });
    };

    window.androidBridge = {};
    window.Capacitor = {
      PluginHeaders: [{
        name: 'CustodialNativeVault',
        methods: [
          'getState',
          'authorizedRequest',
          'resumeEnrollment',
          'confirmEnrollment',
          'cancelEnrollment',
          'removeEnrollment',
          'finalizeRemoval',
        ].map((name) => ({ name, rtype: 'promise' })),
      }],
      nativePromise(plugin, method, options) {
        if (plugin !== 'CustodialNativeVault') return Promise.reject(new Error(`Unexpected native plugin ${plugin}`));
        if (method === 'getState') {
          audit.getStateCalls += 1;
          return delayedState.then(() => JSON.parse(JSON.stringify(nativeState)));
        }
        if (method === 'authorizedRequest') {
          const request = JSON.parse(JSON.stringify(options || {}));
          audit.requests.push(request);
          return authorizedResponse(request);
        }
        return Promise.reject(new Error(`Unexpected CustodialNativeVault method ${method}`));
      },
    };
    for (const key of ['memphisAssignedDeviceId', 'mz_scan_device_id', 'mz_employee_hub_device_id']) {
      localStorage.setItem(key, authoritativeDevice);
    }
    localStorage.setItem('memphisZooCustodialInstallationSeal', seal);
    if (historicalReason) {
      const recoveryId = 'historical-server-quarantine-kiosk08';
      const createdAt = '2026-08-17T01:19:09.000Z';
      const originalDeviceKeys = Object.fromEntries(
        ['memphisAssignedDeviceId', 'mz_scan_device_id', 'mz_employee_hub_device_id']
          .map((key) => [key, authoritativeDevice]),
      );
      if (!reconstructedRecovery) {
        localStorage.setItem('memphisZooCustodialRecoveryRecord', JSON.stringify({
          schema_version: 1,
          recovery_id: recoveryId,
          status: 'pending_manager_recovery',
          reason: historicalReason,
          created_at: createdAt,
          original_device_keys: originalDeviceKeys,
          original_identities: [],
          preserved_counts: { sessions: 0, total_pending: 0 },
          details: { requested_by: 'protected_enrollment_runtime' },
          history: [],
        }));
      }
      localStorage.setItem('memphisZooCustodialRestoreQuarantine', JSON.stringify({
        schema_version: 1,
        recovery_id: recoveryId,
        active: true,
        reason: historicalReason,
        created_at: createdAt,
        original_device_keys: originalDeviceKeys,
        original_identities: [],
        preserved_counts: { sessions: 0, total_pending: 0 },
      }));
    }
    window.__custodialReadinessAudit = audit;
    window.__releaseCustodialNativeState = () => releaseState();
  }, {
    authoritativeDevice: AUTHORITATIVE_DEVICE,
    historicalReason: historicalQuarantineReason,
    reconstructedRecovery: reconstructedHistoricalRecovery,
    journalDisposition: scanJournalDisposition,
    configuredScanState: scanState,
  });
}

async function waitForDelayedGetState(page) {
  await expect.poll(() => page.evaluate(() => window.__custodialReadinessAudit?.getStateCalls || 0)).toBeGreaterThan(0);
}

async function releaseNativeState(page) {
  await page.evaluate(() => window.__releaseCustodialNativeState());
  await expect.poll(() => page.evaluate(() => window.MemphisMobile?.deviceId?.() || '')).toBe(AUTHORITATIVE_DEVICE);
}

async function nativeRequests(page) {
  return page.evaluate(() => window.__custodialReadinessAudit?.requests || []);
}

test('Messenger waits for delayed native getState and uses only the authoritative identity', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await installDelayedNativeVault(page);
  await page.goto(`/${OUTPUT_ROOT}/messages.html?hub=employee&device=${STALE_QUERY_DEVICE}`);
  await waitForDelayedGetState(page);
  expect(await nativeRequests(page)).toEqual([]);

  await releaseNativeState(page);
  await expect(page.locator('.mz-chat-brand-text span')).toContainText('Karen Robinson');
  await expect(page.locator('.mz-chat-list-empty')).toContainText('Tap New to message someone.');
  const mobileLayout = await page.evaluate(() => {
    const sidebar = document.querySelector('.cs-sidebar')?.getBoundingClientRect();
    const unusedPane = document.querySelector('.cs-main-container > .mz-chat-empty');
    return {
      sidebarWidth: sidebar?.width || 0,
      viewportWidth: window.innerWidth,
      unusedPaneVisible: unusedPane ? getComputedStyle(unusedPane).display !== 'none' : false,
    };
  });
  expect(mobileLayout.sidebarWidth).toBeGreaterThan(mobileLayout.viewportWidth * 0.95);
  expect(mobileLayout.unusedPaneVisible).toBe(false);
  await expect.poll(async () => (await nativeRequests(page)).some(({ path }) => (
    path === `/messaging-api/me/by-device?device_id=${AUTHORITATIVE_DEVICE}`
  ))).toBe(true);
  expect((await nativeRequests(page)).some(({ path, device_id: deviceId }) => (
    String(path).includes(STALE_QUERY_DEVICE) || deviceId !== AUTHORITATIVE_DEVICE
  ))).toBe(false);
});

test('employee feedback waits at submit and sends the authoritative native device ID', async ({ page }) => {
  await installDelayedNativeVault(page);
  await page.goto(`/${OUTPUT_ROOT}/system-feedback.html?hub=employee&device=${STALE_QUERY_DEVICE}`);
  await waitForDelayedGetState(page);
  await page.getByText('Something is broken', { exact: true }).click();
  await page.locator('#message').fill('Delayed native identity feedback test');
  await page.locator('#send').click();
  expect(await nativeRequests(page)).toEqual([]);

  await releaseNativeState(page);
  await expect(page.locator('#status')).toHaveText('Sent.');
  const feedback = (await nativeRequests(page)).find(({ path }) => path === '/feedback-api/submit');
  expect(feedback?.device_id).toBe(AUTHORITATIVE_DEVICE);
  expect(JSON.parse(Buffer.from(feedback.body_base64, 'base64').toString('utf8'))).toMatchObject({
    device_id: AUTHORITATIVE_DEVICE,
    hub_context: 'employee',
  });
});

test('schedule does not request by query identity before delayed native getState settles', async ({ page }) => {
  await installDelayedNativeVault(page);
  await page.goto(`/${OUTPUT_ROOT}/employee-schedule.html?hub=employee&device=${STALE_QUERY_DEVICE}`);
  await waitForDelayedGetState(page);
  expect(await nativeRequests(page)).toEqual([]);

  await releaseNativeState(page);
  await expect(page.locator('#employee')).toHaveText('Karen Robinson');
  const schedule = (await nativeRequests(page)).find(({ path }) => path.startsWith('/schedule-api/my-day-summary'));
  expect(schedule).toMatchObject({
    path: `/schedule-api/my-day-summary?device_id=${AUTHORITATIVE_DEVICE}`,
    device_id: AUTHORITATIVE_DEVICE,
  });
});

test('protected Home renders only the employee name and four fixed choices', async ({ page }) => {
  await installDelayedNativeVault(page);
  await page.goto(`/${OUTPUT_ROOT}/index.html?device=${STALE_QUERY_DEVICE}`);
  await waitForDelayedGetState(page);
  expect(await nativeRequests(page)).toEqual([]);

  await releaseNativeState(page);
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('.homeButton')).toHaveText(['Schedule', 'Messages', 'Events', 'Feedback']);
  await expect(page.locator('.homeButton')).toHaveCount(4);
  expect((await nativeRequests(page)).some(({ path }) => path.startsWith('/schedule-api/'))).toBe(false);
});

test('protected Home retires an exact historical server quarantine before restoring employee work', async ({ page }) => {
  await installDelayedNativeVault(page, { historicalQuarantineReason: 'native_start_attestation_required' });
  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await waitForDelayedGetState(page);
  expect(await nativeRequests(page)).toEqual([]);

  await releaseNativeState(page);
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('.homeButton')).toHaveText(['Schedule', 'Messages', 'Events', 'Feedback']);
  const reconciliation = await page.evaluate(() => ({
    status: window.MemphisMobile?.securityStatus?.(),
    quarantine: localStorage.getItem('memphisZooCustodialRestoreQuarantine'),
    recovery: JSON.parse(localStorage.getItem('memphisZooCustodialRecoveryRecord') || 'null'),
  }));
  expect(reconciliation.status).toMatchObject({ state: 'enrolled', ready: true, quarantined: false, deviceId: AUTHORITATIVE_DEVICE });
  expect(reconciliation.quarantine).toBeNull();
  expect(reconciliation.recovery).toMatchObject({
    status: 'resolved',
    reason: 'native_start_attestation_required',
    resolution: {
      method: 'current_native_credential_revalidated',
      contract: 'historical_server_quarantine.v1',
      prior_requested_by: 'protected_enrollment_runtime',
      preserved_work_retained: true,
    },
  });
  expect((await nativeRequests(page)).some(({ path }) => path.startsWith('/device-auth/status'))).toBe(true);
});

test('protected Home retires a reconstructed historical server quarantine only after current native proof', async ({ page }) => {
  await installDelayedNativeVault(page, {
    historicalQuarantineReason: 'native_start_attestation_required',
    reconstructedHistoricalRecovery: true,
  });
  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await waitForDelayedGetState(page);
  expect(await nativeRequests(page)).toEqual([]);

  await releaseNativeState(page);
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('.homeButton')).toHaveText(['Schedule', 'Messages', 'Events', 'Feedback']);
  const reconciliation = await page.evaluate(() => ({
    status: window.MemphisMobile?.securityStatus?.(),
    quarantine: localStorage.getItem('memphisZooCustodialRestoreQuarantine'),
    recovery: JSON.parse(localStorage.getItem('memphisZooCustodialRecoveryRecord') || 'null'),
  }));
  expect(reconciliation.status).toMatchObject({ state: 'enrolled', ready: true, quarantined: false, deviceId: AUTHORITATIVE_DEVICE });
  expect(reconciliation.quarantine).toBeNull();
  expect(reconciliation.recovery).toMatchObject({
    status: 'resolved',
    reason: 'native_start_attestation_required',
    resolution: {
      method: 'current_native_credential_revalidated',
      contract: 'historical_server_quarantine_reconstruction.v1',
      prior_provenance: 'reconstructed_active_quarantine',
      prior_requested_by: null,
      preserved_work_retained: true,
    },
  });
  expect((await nativeRequests(page)).some(({ path }) => path.startsWith('/device-auth/status'))).toBe(true);
});

test('protected Home describes one interrupted pre-start truthfully without adding another Home choice', async ({ page }) => {
  const sessionId = '00000000-0000-4000-8000-000000000853';
  await installDelayedNativeVault(page);
  await page.addInitScript(({ authoritativeDevice, interruptedSession }) => {
    const session = {
      session_uuid: interruptedSession,
      client_session_id: interruptedSession,
      device_id: authoritativeDevice,
      location_code: 'NOCX',
      location_name: 'Nocturnal',
      employee_name: 'Karen Robinson',
      status: 'offline-provisional',
      started_at: '',
      sync_status: 'activation_queued',
      entry_attestation: 'native-entry-pending.v1',
    };
    localStorage.setItem(`session:${interruptedSession}`, JSON.stringify(session));
    localStorage.setItem(`mz_phone_scan_resume:${authoritativeDevice}`, JSON.stringify({
      schema_version: 2,
      device_id: authoritativeDevice,
      sessions: [{ ...session, view: 'timer', updated_at: '2026-08-20T12:00:00.000Z' }],
      updated_at: '2026-08-20T12:00:00.000Z',
    }));
  }, { authoritativeDevice: AUTHORITATIVE_DEVICE, interruptedSession: sessionId });
  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await waitForDelayedGetState(page);
  await releaseNativeState(page);
  await expect(page.locator('#active-cleaning')).toBeVisible();
  await expect(page.locator('#active-cleaning-text')).toHaveText(
    'Cleaning did not start at Nocturnal. Tap the location tag again.',
  );
  await expect(page.locator('.homeButton')).toHaveText(['Schedule', 'Messages', 'Events', 'Feedback']);
  await expect(page.locator('.homeButton')).toHaveCount(4);
  expect(new URL(page.url()).pathname).toMatch(/\/index\.html$/);
});

test('exact manager journal recovery preserves and retires only a proven never-started cleaning', async ({ page }) => {
  const sessionId = '00000000-0000-4000-8000-000000000854';
  const entryId = '00000000-0000-4000-8000-000000000855';
  const recoveryId = '00000000-0000-4000-8000-000000000856';
  const operationId = '00000000-0000-4000-8000-000000000857';
  const disposition = {
    schema_version: 'custodial-scan-journal-disposition.v1',
    state: 'RESOLVED',
    preserved: true,
    manager_recovery_required: false,
    recovery_id: recoveryId,
    source_sha256: 'a'.repeat(64),
    replacement_journal_sha256: 'b'.repeat(64),
    manager_recovery_operation_id: operationId,
    device_id: AUTHORITATIVE_DEVICE,
    resolved_at: '2026-08-26T14:00:00.000Z',
  };
  await installDelayedNativeVault(page, {
    scanJournalDisposition: disposition,
    scanState: {
      location_code: 'NOCX',
      location_name: 'Nocturnal',
      device_approved: true,
      latest_session_uuid: null,
      latest_session_status: null,
      suggested_action: 'start_session',
    },
  });
  await page.addInitScript(({
    authoritativeDevice,
    interruptedSession,
    nativeEntry,
  }) => {
    const session = {
      session_uuid: interruptedSession,
      client_session_id: interruptedSession,
      device_id: authoritativeDevice,
      location_code: 'NOCX',
      location_name: 'Nocturnal',
      employee_name: 'Karen Robinson',
      status: 'offline-provisional',
      state: 'offline-provisional',
      started_at: '',
      sync_status: 'activation_queued',
      entry_id: nativeEntry,
      entry_attestation: 'native-entry-pending.v1',
      server_acknowledged: false,
      updated_at: '2026-08-26T13:00:00.000Z',
    };
    localStorage.setItem(`session:${interruptedSession}`, JSON.stringify(session));
    localStorage.setItem(`mz_phone_scan_resume:${authoritativeDevice}`, JSON.stringify({
      schema_version: 2,
      device_id: authoritativeDevice,
      sessions: [{ ...session, view: 'timer' }],
      updated_at: session.updated_at,
    }));
  }, {
    authoritativeDevice: AUTHORITATIVE_DEVICE,
    interruptedSession: sessionId,
    nativeEntry: entryId,
  });
  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await waitForDelayedGetState(page);
  await releaseNativeState(page);
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('#active-cleaning')).toBeHidden();
  await expect.poll(() => page.evaluate((id) => Boolean(
    localStorage.getItem(`mz_custodial_prestart_recovery:${id}`),
  ), sessionId)).toBe(true);
  const result = await page.evaluate((id) => ({
    active: localStorage.getItem(`session:${id}`),
    index: localStorage.getItem('mz_phone_scan_resume:KIOSK_08'),
    archive: JSON.parse(localStorage.getItem(`mz_custodial_prestart_recovery:${id}`) || 'null'),
  }), sessionId);
  expect(result.active).toBeNull();
  expect(result.index).toBeNull();
  expect(result.archive).toMatchObject({
    schema_version: 'custodial-prestart-recovery.v1',
    session_uuid: sessionId,
    device_id: AUTHORITATIVE_DEVICE,
    native_scan_journal_recovery_id: recoveryId,
    manager_recovery_operation_id: operationId,
    resolution: {
      method: 'preserved_native_journal_manager_recovery',
      queued_action_count: 0,
      server_suggested_action: 'start_session',
    },
  });
  expect(JSON.parse(result.archive.preserved_session_raw)).toMatchObject({
    session_uuid: sessionId,
    entry_id: entryId,
    location_name: 'Nocturnal',
  });
});

test('exact manager journal recovery preserves and retires a native-started session the server never accepted', async ({ page }) => {
  const sessionId = '00000000-0000-4000-8000-000000000866';
  const entryId = '00000000-0000-4000-8000-000000000867';
  const recoveryId = '00000000-0000-4000-8000-000000000868';
  const operationId = '00000000-0000-4000-8000-000000000869';
  const disposition = {
    schema_version: 'custodial-scan-journal-disposition.v1',
    state: 'RESOLVED',
    preserved: true,
    manager_recovery_required: false,
    recovery_id: recoveryId,
    source_sha256: '1'.repeat(64),
    replacement_journal_sha256: '2'.repeat(64),
    manager_recovery_operation_id: operationId,
    device_id: AUTHORITATIVE_DEVICE,
    resolved_at: '2026-08-26T14:00:00.000Z',
  };
  await installDelayedNativeVault(page, {
    scanJournalDisposition: disposition,
    scanState: {
      location_code: 'NOCX',
      location_name: 'Nocturnal',
      device_approved: true,
      latest_session_uuid: '3fd0ae52-a9af-4e03-aa18-0f0ff2f6fd9d',
      latest_session_status: 'closed',
      suggested_action: 'start_session',
    },
  });
  await page.addInitScript(({
    authoritativeDevice,
    interruptedSession,
    nativeEntry,
  }) => {
    const session = {
      session_uuid: interruptedSession,
      client_session_id: interruptedSession,
      device_id: authoritativeDevice,
      location_code: 'NOCX',
      location_name: 'Nocturnal',
      employee_id: '00000000-0000-4000-8000-000000000870',
      employee_name: 'Karen Robinson',
      status: 'offline-provisional',
      state: 'offline-provisional',
      offline_provisional: true,
      started_at: '2026-08-17T02:33:00.000Z',
      sync_status: 'activation_queued',
      entry_source: 'native-nfc',
      entry_id: nativeEntry,
      entry_attestation: 'native-start-proof.v1',
      native_start_attestation_version: 'custodial-native-start.v1',
      native_start_attestation: '3'.repeat(64),
      offline_authority_snapshot_id: '4'.repeat(64),
      offline_authority_employee_id: '00000000-0000-4000-8000-000000000870',
      offline_authority_assignment_epoch: 1,
      offline_authority_credential_id: '00000000-0000-4000-8000-000000000871',
      server_acknowledged: false,
      scan_evidence: [{ event_type: 'scan_received', result: 'ok' }],
      updated_at: '2026-08-17T02:33:01.000Z',
    };
    localStorage.setItem(`session:${interruptedSession}`, JSON.stringify(session));
    localStorage.setItem(`mz_phone_scan_resume:${authoritativeDevice}`, JSON.stringify({
      schema_version: 2,
      device_id: authoritativeDevice,
      sessions: [{ ...session, view: 'timer' }],
      updated_at: session.updated_at,
    }));
  }, {
    authoritativeDevice: AUTHORITATIVE_DEVICE,
    interruptedSession: sessionId,
    nativeEntry: entryId,
  });
  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await waitForDelayedGetState(page);
  await releaseNativeState(page);
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('#active-cleaning')).toBeHidden();
  const result = await page.evaluate((id) => ({
    active: localStorage.getItem(`session:${id}`),
    index: localStorage.getItem('mz_phone_scan_resume:KIOSK_08'),
    archive: JSON.parse(localStorage.getItem(`mz_custodial_prestart_recovery:${id}`) || 'null'),
  }), sessionId);
  expect(result.active).toBeNull();
  expect(result.index).toBeNull();
  expect(result.archive).toMatchObject({
    schema_version: 'custodial-interrupted-start-recovery.v2',
    session_uuid: sessionId,
    device_id: AUTHORITATIVE_DEVICE,
    resolution: {
      method: 'preserved_native_journal_manager_recovery',
      queued_action_count: 0,
      completion_draft_count: 0,
      local_start_state: 'native_started_server_unaccepted',
      server_suggested_action: 'start_session',
    },
  });
  expect(JSON.parse(result.archive.preserved_session_raw)).toMatchObject({
    session_uuid: sessionId,
    entry_id: entryId,
    started_at: '2026-08-17T02:33:00.000Z',
    native_start_attestation: '3'.repeat(64),
  });
});

test('manager recovery preserves a native-started session when completion-draft evidence exists', async ({ page }) => {
  const sessionId = '00000000-0000-4000-8000-000000000872';
  const entryId = '00000000-0000-4000-8000-000000000873';
  const disposition = {
    schema_version: 'custodial-scan-journal-disposition.v1',
    state: 'RESOLVED',
    preserved: true,
    manager_recovery_required: false,
    recovery_id: '00000000-0000-4000-8000-000000000874',
    source_sha256: '5'.repeat(64),
    replacement_journal_sha256: '6'.repeat(64),
    manager_recovery_operation_id: '00000000-0000-4000-8000-000000000875',
    device_id: AUTHORITATIVE_DEVICE,
    resolved_at: '2026-08-26T14:00:00.000Z',
  };
  await installDelayedNativeVault(page, {
    scanJournalDisposition: disposition,
    scanState: {
      location_code: 'NOCX',
      location_name: 'Nocturnal',
      device_approved: true,
      latest_session_uuid: null,
      latest_session_status: null,
      suggested_action: 'start_session',
    },
  });
  await page.addInitScript(({ authoritativeDevice, interruptedSession, nativeEntry }) => {
    const session = {
      session_uuid: interruptedSession,
      client_session_id: interruptedSession,
      device_id: authoritativeDevice,
      location_code: 'NOCX',
      location_name: 'Nocturnal',
      employee_id: '00000000-0000-4000-8000-000000000876',
      employee_name: 'Karen Robinson',
      status: 'offline-provisional',
      state: 'offline-provisional',
      offline_provisional: true,
      started_at: '2026-08-17T02:33:00.000Z',
      sync_status: 'activation_queued',
      entry_source: 'native-nfc',
      entry_id: nativeEntry,
      entry_attestation: 'native-start-proof.v1',
      native_start_attestation_version: 'custodial-native-start.v1',
      native_start_attestation: '7'.repeat(64),
      offline_authority_snapshot_id: '8'.repeat(64),
      offline_authority_employee_id: '00000000-0000-4000-8000-000000000876',
      offline_authority_assignment_epoch: 1,
      offline_authority_credential_id: '00000000-0000-4000-8000-000000000877',
      server_acknowledged: false,
      updated_at: '2026-08-17T02:33:01.000Z',
    };
    localStorage.setItem(`session:${interruptedSession}`, JSON.stringify(session));
    localStorage.setItem(`mz_scan_completion_draft:${interruptedSession}`, JSON.stringify({ preserved: true }));
    localStorage.setItem(`mz_phone_scan_resume:${authoritativeDevice}`, JSON.stringify({
      schema_version: 2,
      device_id: authoritativeDevice,
      sessions: [{ ...session, view: 'timer' }],
      updated_at: session.updated_at,
    }));
  }, { authoritativeDevice: AUTHORITATIVE_DEVICE, interruptedSession: sessionId, nativeEntry: entryId });
  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await waitForDelayedGetState(page);
  await releaseNativeState(page);
  await expect(page.locator('#boot-title')).toHaveText('This phone needs a manager.');
  const retained = await page.evaluate((id) => ({
    active: localStorage.getItem(`session:${id}`),
    index: localStorage.getItem('mz_phone_scan_resume:KIOSK_08'),
    draft: localStorage.getItem(`mz_scan_completion_draft:${id}`),
    archive: localStorage.getItem(`mz_custodial_prestart_recovery:${id}`),
  }), sessionId);
  expect(retained.active).not.toBeNull();
  expect(retained.index).not.toBeNull();
  expect(retained.draft).not.toBeNull();
  expect(retained.archive).toBeNull();
});

test('interrupted local retirement resumes from its exact preserved archive without another server decision', async ({ page }) => {
  const sessionId = '00000000-0000-4000-8000-000000000858';
  const entryId = '00000000-0000-4000-8000-000000000859';
  const recoveryId = '00000000-0000-4000-8000-000000000860';
  const operationId = '00000000-0000-4000-8000-000000000861';
  const resolvedAt = '2026-08-26T14:00:00.000Z';
  const disposition = {
    schema_version: 'custodial-scan-journal-disposition.v1',
    state: 'RESOLVED',
    preserved: true,
    manager_recovery_required: false,
    recovery_id: recoveryId,
    source_sha256: 'c'.repeat(64),
    replacement_journal_sha256: 'd'.repeat(64),
    manager_recovery_operation_id: operationId,
    device_id: AUTHORITATIVE_DEVICE,
    resolved_at: resolvedAt,
  };
  await installDelayedNativeVault(page, { scanJournalDisposition: disposition });
  await page.addInitScript(({
    authoritativeDevice,
    interruptedSession,
    nativeEntry,
    journalRecovery,
    managerOperation,
  }) => {
    const session = {
      session_uuid: interruptedSession,
      client_session_id: interruptedSession,
      device_id: authoritativeDevice,
      location_code: 'NOCX',
      location_name: 'Nocturnal',
      employee_name: 'Karen Robinson',
      status: 'offline-provisional',
      state: 'offline-provisional',
      started_at: '',
      sync_status: 'activation_queued',
      entry_id: nativeEntry,
      entry_attestation: 'native-entry-pending.v1',
      server_acknowledged: false,
      updated_at: '2026-08-26T13:00:00.000Z',
    };
    localStorage.setItem(`mz_phone_scan_resume:${authoritativeDevice}`, JSON.stringify({
      schema_version: 2,
      device_id: authoritativeDevice,
      sessions: [{ ...session, view: 'timer' }],
      updated_at: session.updated_at,
    }));
    localStorage.setItem(`mz_custodial_prestart_recovery:${interruptedSession}`, JSON.stringify({
      schema_version: 'custodial-prestart-recovery.v1',
      session_uuid: interruptedSession,
      device_id: authoritativeDevice,
      native_scan_journal_recovery_id: journalRecovery,
      manager_recovery_operation_id: managerOperation,
      preserved_session_raw: JSON.stringify(session),
      preserved_at: session.updated_at,
      resolved_at: '2026-08-26T14:01:00.000Z',
      resolution: {
        method: 'preserved_native_journal_manager_recovery',
        queued_action_count: 0,
        server_session_uuid: null,
        server_session_status: null,
        server_suggested_action: 'start_session',
      },
    }));
  }, {
    authoritativeDevice: AUTHORITATIVE_DEVICE,
    interruptedSession: sessionId,
    nativeEntry: entryId,
    journalRecovery: recoveryId,
    managerOperation: operationId,
  });
  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await waitForDelayedGetState(page);
  await releaseNativeState(page);
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('#active-cleaning')).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mz_phone_scan_resume:KIOSK_08'))).toBeNull();
  const scanStateRequests = (await nativeRequests(page)).filter(({ path, body_base64: body }) => {
    if (path !== '/scan-api/rpc' || !body) return false;
    return JSON.parse(Buffer.from(body, 'base64').toString('utf8')).fn === 'tool_get_location_scan_state';
  });
  expect(scanStateRequests).toHaveLength(0);
  expect(await page.evaluate((id) => Boolean(
    localStorage.getItem(`mz_custodial_prestart_recovery:${id}`),
  ), sessionId)).toBe(true);
});

test('manager recovery never retires a local pre-start when the server says that session is active', async ({ page }) => {
  const sessionId = '00000000-0000-4000-8000-000000000862';
  const entryId = '00000000-0000-4000-8000-000000000863';
  const disposition = {
    schema_version: 'custodial-scan-journal-disposition.v1',
    state: 'RESOLVED',
    preserved: true,
    manager_recovery_required: false,
    recovery_id: '00000000-0000-4000-8000-000000000864',
    source_sha256: 'e'.repeat(64),
    replacement_journal_sha256: 'f'.repeat(64),
    manager_recovery_operation_id: '00000000-0000-4000-8000-000000000865',
    device_id: AUTHORITATIVE_DEVICE,
    resolved_at: '2026-08-26T14:00:00.000Z',
  };
  await installDelayedNativeVault(page, {
    scanJournalDisposition: disposition,
    scanState: {
      location_code: 'NOCX',
      location_name: 'Nocturnal',
      device_approved: true,
      latest_session_uuid: sessionId,
      latest_session_status: 'active',
      suggested_action: 'finish_session',
    },
  });
  await page.addInitScript(({
    authoritativeDevice,
    interruptedSession,
    nativeEntry,
  }) => {
    const session = {
      session_uuid: interruptedSession,
      client_session_id: interruptedSession,
      device_id: authoritativeDevice,
      location_code: 'NOCX',
      location_name: 'Nocturnal',
      employee_name: 'Karen Robinson',
      status: 'offline-provisional',
      state: 'offline-provisional',
      started_at: '',
      sync_status: 'activation_queued',
      entry_id: nativeEntry,
      entry_attestation: 'native-entry-pending.v1',
      server_acknowledged: false,
      updated_at: '2026-08-26T13:00:00.000Z',
    };
    localStorage.setItem(`session:${interruptedSession}`, JSON.stringify(session));
    localStorage.setItem(`mz_phone_scan_resume:${authoritativeDevice}`, JSON.stringify({
      schema_version: 2,
      device_id: authoritativeDevice,
      sessions: [{ ...session, view: 'timer' }],
      updated_at: session.updated_at,
    }));
  }, {
    authoritativeDevice: AUTHORITATIVE_DEVICE,
    interruptedSession: sessionId,
    nativeEntry: entryId,
  });
  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await waitForDelayedGetState(page);
  await releaseNativeState(page);
  await expect(page.locator('#boot-title')).toHaveText('This phone needs a manager.');
  const retained = await page.evaluate((id) => ({
    active: localStorage.getItem(`session:${id}`),
    index: localStorage.getItem('mz_phone_scan_resume:KIOSK_08'),
    archive: localStorage.getItem(`mz_custodial_prestart_recovery:${id}`),
  }), sessionId);
  expect(retained.active).not.toBeNull();
  expect(retained.index).not.toBeNull();
  expect(retained.archive).toBeNull();
});

test('protected employee Home reloads from its verified cache during a refresh outage', async ({ page }) => {
  await installDelayedNativeVault(page);
  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await waitForDelayedGetState(page);
  await releaseNativeState(page);
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('.homeButton')).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('mz_custodial_home_cache:KIOSK_08')))).toBe(true);

  await page.evaluate(() => localStorage.setItem('__custodial_test_offline_home', '1'));
  await page.reload();
  await waitForDelayedGetState(page);
  await releaseNativeState(page);
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('.homeButton')).toHaveText(['Schedule', 'Messages', 'Events', 'Feedback']);
  expect((await nativeRequests(page)).some(({ path }) => path.startsWith('/schedule-api/'))).toBe(false);
});

test('reload and Back navigation await a fresh native state and discard a stale device query', async ({ page }) => {
  await installDelayedNativeVault(page);
  const feedbackUrl = `/${OUTPUT_ROOT}/system-feedback.html?hub=employee&device=${STALE_QUERY_DEVICE}`;
  await page.goto(feedbackUrl);
  await waitForDelayedGetState(page);
  await releaseNativeState(page);

  await page.reload();
  await waitForDelayedGetState(page);
  expect(await nativeRequests(page)).toEqual([]);
  await page.locator('[data-mz-back]').click();
  expect(page.url()).toContain(`system-feedback.html?hub=employee&device=${STALE_QUERY_DEVICE}`);

  await page.evaluate(() => window.__releaseCustodialNativeState());
  await page.waitForURL((url) => url.pathname.endsWith('/index.html'));
  const navigated = new URL(page.url());
  expect(navigated.search).toBe('');
  expect(navigated.searchParams.get('device')).toBeNull();
  expect(navigated.searchParams.get('hub')).toBeNull();
});
