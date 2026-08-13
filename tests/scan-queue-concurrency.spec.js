const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const DEVICE_ID = 'SCAN_SYNC_BROWSER_TEST';
const SESSION_ID = '00000000-0000-4000-8000-000000000111';
const COMPLETION_ID = '00000000-0000-4000-8000-000000000112';
const SCHEMA_FINGERPRINT = '70cb4b18909dd6cb908c94be9718366fe832ff950496aff2362fc3e2a3482baf';
const ACCEPTED_BUILD_22_COMMIT = '23740cb0c50c4b80f78adbe9fa4f875707359483';
const ACCEPTED_BUILD_22_WORKER_SHA256 = 'b9465949796be0e84d6c4236a6c01974fd74534792f8ca30b2304c8969ffe4fa';

function acceptedBuild22Worker() {
  const source = execFileSync('git', ['show', `${ACCEPTED_BUILD_22_COMMIT}:memphis-scan-sync.js`], { encoding: 'utf8' });
  expect(createHash('sha256').update(source).digest('hex')).toBe(ACCEPTED_BUILD_22_WORKER_SHA256);
  return source;
}

async function json(route, status, body, headers = {}) {
  await route.fulfill({
    status,
    headers,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function waitForQueue(page, predicate) {
  await expect.poll(async () => {
    const rows = await page.evaluate(() => window.MemphisScanSync.listActions());
    return predicate(rows);
  }, { timeout: 12_000 }).toBe(true);
}

async function installCompatibleVersionRoute(context, version = 'release-2026.07.19.custodial-v3.12', schemaFingerprint = SCHEMA_FINGERPRINT) {
  await context.route('https://memphis-zoo-mcp.onrender.com/version', (route) => json(route, 200, {
    version,
    contracts: { scan: 'scan.v4.snapshot-bound-authority' },
    release_manifest: { schema: { fingerprint: schemaFingerprint } },
  }));
}

async function openHarness(context, { backendVersion, backendSchema } = {}) {
  await installCompatibleVersionRoute(context, backendVersion, backendSchema);
  const page = await context.newPage();
  await page.goto(`/tests/scan-sync-harness.html?device=${DEVICE_ID}`);
  await page.evaluate(() => window.MemphisScanSync.ready);
  return page;
}

async function seedExactQueueRecord(page, record) {
  await seedQueueDatabase(page, 4, [record]);
  return record;
}

async function seedQueueDatabase(page, version, records) {
  return page.evaluate(async ({ databaseVersion, values }) => {
    await new Promise((resolve, reject) => {
      const removal = indexedDB.deleteDatabase('mz_scan_queue');
      removal.onsuccess = () => resolve();
      removal.onerror = () => reject(removal.error);
      removal.onblocked = () => reject(new Error('Queue database deletion was blocked.'));
    });
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('mz_scan_queue', databaseVersion);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('logical_key', 'logical_key', { unique: false });
        store.createIndex('state', 'state', { unique: false });
        store.createIndex('next_attempt_at', 'next_attempt_at', { unique: false });
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('actions', 'readwrite');
        for (const value of values) tx.objectStore('actions').put(value);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, { databaseVersion: version, values: records });
}

async function exactQueueRecords(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('mz_scan_queue');
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('actions', 'readonly');
      const rows = tx.objectStore('actions').getAll();
      rows.onsuccess = () => resolve(rows.result);
      rows.onerror = () => reject(rows.error);
      tx.oncomplete = () => db.close();
    };
    request.onerror = () => reject(request.error);
  }));
}

async function physicalDatabaseVersion(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('mz_scan_queue');
    request.onsuccess = () => { const version = request.result.version; request.result.close(); resolve(version); };
    request.onerror = () => reject(request.error);
  }));
}

test('restore quarantine leaves the real IndexedDB queue and local work byte-for-byte unchanged', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const quarantined = () => Object.assign(new Error('Protected phone recovery is active.'), {
      code: 'custodial_restore_quarantine', reason: 'restored_operational_state',
    });
    window.MemphisCustodialSecurity = {
      native: true,
      ensureSecurityState: async () => { throw quarantined(); },
      waitForStableState: async () => { throw quarantined(); },
      mutateProtectedWork: async () => { throw quarantined(); },
      getStatus: () => ({ ready: false, available: true, quarantined: true, reason: 'restored_operational_state', deviceId: 'KIOSK_08', recovery: { queue_action_count: 1 } }),
    };
  });
  let backendRequests = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    backendRequests += 1;
    await route.abort();
  });
  const page = await context.newPage();
  await page.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
  const record = {
    id: 41,
    type: 'record_scan_event',
    schema_version: 4,
    operation_id: SESSION_ID,
    logical_identity: SESSION_ID,
    logical_key: `record_scan_event:${SESSION_ID}`,
    created_at: 1785600000000,
    retry_count: 0,
    last_error: null,
    last_attempt_at: null,
    next_attempt_at: 0,
    dead_letter: false,
    state: 'pending',
    lease_owner: null,
    lease_token: null,
    lease_until: 0,
    payload: { p_client_event_id: SESSION_ID, p_device_id: 'KIOSK_08' },
  };
  const before = await seedExactQueueRecord(page, record);
  await page.evaluate(() => {
    localStorage.setItem('session:preserved', JSON.stringify({ session_uuid: 'preserved', device_id: 'KIOSK_08', status: 'pending_sync' }));
    localStorage.setItem('mz_chatscope_outbox:preserved', JSON.stringify({ id: 'preserved', device_id: 'KIOSK_08' }));
  });
  await page.goto(`/tests/scan-sync-harness.html?device=${DEVICE_ID}`);
  expect(await page.evaluate(() => window.MemphisScanSync.ready)).toBe(false);
  expect(await page.evaluate(() => window.MemphisScanSync.sync())).toBe(false);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(1_100);
  expect(await exactQueueRecords(page)).toEqual([before]);
  expect(await page.evaluate(() => ({
    session: localStorage.getItem('session:preserved'),
    outbox: localStorage.getItem('mz_chatscope_outbox:preserved'),
  }))).toEqual({
    session: JSON.stringify({ session_uuid: 'preserved', device_id: 'KIOSK_08', status: 'pending_sync' }),
    outbox: JSON.stringify({ id: 'preserved', device_id: 'KIOSK_08' }),
  });
  expect(await page.evaluate(() => window.MemphisScanSync.enqueue({ type: 'ping_device' })
    .then(() => 'changed', (error) => error.code))).toBe('custodial_restore_quarantine');
  expect(await page.evaluate(() => window.MemphisScanSync.recoverAllDeadLetters()
    .then(() => 'changed', (error) => error.code))).toBe('custodial_restore_quarantine');
  expect(backendRequests).toBe(0);
  await context.close();
});

test('quarantine activated after queue startup pauses before claiming an action', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__custodialQuarantined = false;
    const status = () => ({
      ready: !window.__custodialQuarantined,
      available: true,
      quarantined: window.__custodialQuarantined,
      reason: 'runtime_quarantine',
      deviceId: 'KIOSK_08',
      generation: window.__custodialQuarantined ? 2 : 1,
      state: 'enrolled',
    });
    const stable = async () => {
      if (!window.__custodialQuarantined) return status();
      throw Object.assign(new Error('Protected phone recovery is active.'), {
        code: 'custodial_restore_quarantine', reason: 'runtime_quarantine',
      });
    };
    window.MemphisCustodialSecurity = {
      native: true,
      ensureSecurityState: stable,
      waitForStableState: stable,
      mutateProtectedWork: async (operation) => {
        const current = await stable();
        return operation({ deviceId: current.deviceId, generation: current.generation, state: current.state });
      },
      getStatus: status,
    };
  });
  let backendRequests = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    backendRequests += 1;
    await route.abort();
  });
  const page = await openHarness(context);
  await context.setOffline(true);
  await page.evaluate((eventId) => window.MemphisScanSync.enqueue({
    type: 'record_scan_event',
    client_id: eventId,
    payload: { p_client_event_id: eventId, p_device_id: 'KIOSK_08' },
  }), SESSION_ID);
  const before = await page.evaluate(() => window.MemphisScanSync.listActions());
  await page.evaluate(() => { window.__custodialQuarantined = true; });
  await context.setOffline(false);
  expect(await page.evaluate(() => window.MemphisScanSync.sync())).toBe(false);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.MemphisScanSync.listActions())).toEqual(before);
  expect(backendRequests).toBe(0);
  await context.close();
});

test('historical standalone evidence is folded into its exact occurrence without calling the retired writer', async ({ browser }) => {
  const context = await browser.newContext();
  const rpcCalls = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn !== 'tool_report_device_sync_status') rpcCalls.push(request);
    return json(route, 200, { ok: true, data: { event_id: SESSION_ID, status: 'accepted' } });
  });
  const [one, two] = await Promise.all([openHarness(context), openHarness(context)]);
  await one.evaluate((sessionId) => localStorage.setItem(`session:${sessionId}`, JSON.stringify({
    session_uuid: sessionId,
    client_session_id: sessionId,
    device_id: 'SCAN_SYNC_BROWSER_TEST',
    status: 'server-active',
    scan_evidence: [],
  })), SESSION_ID);
  const action = {
    type: 'record_scan_event',
    client_id: SESSION_ID,
    payload: {
      p_client_event_id: SESSION_ID,
      p_event_type: 'scan_start',
      p_result: 'accepted',
      p_payload_json: { session_uuid: SESSION_ID, entry_source: 'native-nfc' },
    },
  };
  await Promise.all([
    one.evaluate((value) => window.MemphisScanSync.enqueue(value), action),
    two.evaluate((value) => window.MemphisScanSync.enqueue(value), action),
  ]);
  await Promise.all([
    one.evaluate(() => window.MemphisScanSync.sync()),
    two.evaluate(() => window.MemphisScanSync.sync()),
  ]);
  await waitForQueue(one, (rows) => rows.length === 0);
  expect(rpcCalls).toHaveLength(0);
  const migrated = await one.evaluate((sessionId) => JSON.parse(localStorage.getItem(`session:${sessionId}`)), SESSION_ID);
  expect(migrated.scan_evidence).toEqual([expect.objectContaining({
    client_event_id: SESSION_ID,
    event_type: 'scan_start',
    payload_json: expect.objectContaining({ entry_source: 'native-nfc' }),
  })]);
  await context.close();
});

test('six tabs deduplicate one logical queued operation and preserve six distinct operations', async ({ browser }) => {
  const context = await browser.newContext();
  const rpcCalls = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn !== 'tool_report_device_sync_status') rpcCalls.push(request);
    return json(route, 200, { ok: true, data: { event_id: request.args?.p_client_event_id || SESSION_ID, status: 'accepted' } });
  });
  const pages = await Promise.all(Array.from({ length: 6 }, () => openHarness(context)));
  const sharedId = '00000000-0000-4000-8000-000000000210';
  const sharedAction = {
    type: 'ping_device',
    client_id: sharedId,
    payload: { p_device_id: 'SCAN_SYNC_BROWSER_TEST', p_notes: sharedId },
  };
  await Promise.all(pages.map((page) => page.evaluate((action) => window.MemphisScanSync.enqueue(action), sharedAction)));
  await Promise.all(pages.map((page) => page.evaluate(() => window.MemphisScanSync.sync())));
  await waitForQueue(pages[0], (rows) => rows.length === 0);
  expect(rpcCalls.filter((call) => call.args?.p_notes === sharedId)).toHaveLength(1);

  const distinctIds = pages.map((_, index) => `00000000-0000-4000-8000-${String(300 + index).padStart(12, '0')}`);
  await Promise.all(pages.map((page, index) => page.evaluate(({ clientId }) => window.MemphisScanSync.enqueue({
    type: 'ping_device',
    client_id: clientId,
    payload: { p_device_id: 'SCAN_SYNC_BROWSER_TEST', p_notes: clientId },
  }), { clientId: distinctIds[index] })));
  await Promise.all(pages.map((page) => page.evaluate(() => window.MemphisScanSync.sync())));
  await waitForQueue(pages[0], (rows) => rows.length === 0);
  for (const clientId of distinctIds) expect(rpcCalls.filter((call) => call.args?.p_notes === clientId)).toHaveLength(1);
  await context.close();
});

test('GPS v2 offline record keeps the observation timestamp and stable event identity', async ({ browser }) => {
  const context = await browser.newContext();
  let captured = null;
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_evaluate_location_proximity_v2') captured = request;
    return json(route, 200, { ok: true, data: { result: 'near', authoritative: true } });
  });
  const page = await openHarness(context);
  const eventId = '00000000-0000-4000-8000-000000000220';
  const observedAt = '2026-07-19T12:00:00.000Z';
  await page.evaluate(({ eventId: id, observedAt: timestamp }) => window.MemphisScanSync.enqueue({
    type: 'evaluate_location_proximity_v2',
    client_id: id,
    payload: {
      p_location_code: 'TETM', p_device_identifier: 'SCAN_SYNC_BROWSER_TEST',
      p_latitude: 35.1495, p_longitude: -90.0490, p_accuracy_m: 8,
      p_client_event_id: id, p_observed_at: timestamp,
    },
  }), { eventId, observedAt });
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 0);
  expect(captured).not.toBeNull();
  expect(captured.args.p_client_event_id).toBe(eventId);
  expect(captured.args.p_observed_at).toBe(observedAt);
  await context.close();
});

test('permanent rejection enters visible dead letter and can be recovered once', async ({ browser }) => {
  const context = await browser.newContext();
  let reject = true;
  let finishCalls = 0;
  const statusReports = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status') {
      statusReports.push(request.args);
      return json(route, 200, { ok: true, data: {} });
    }
    finishCalls += 1;
    if (reject) return json(route, 422, { ok: false, error: 'Exact session transition rejected' });
    return json(route, 200, { ok: true, data: { session_uuid: SESSION_ID, status: 'closed' } });
  });
  const page = await openHarness(context);
  await page.evaluate((sessionId) => window.MemphisScanSync.enqueue({
    type: 'finish_session',
    operation_id: '00000000-0000-4000-8000-000000000113',
    payload: { p_session_uuid: sessionId },
  }), SESSION_ID);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 1 && rows[0].state === 'dead-letter' && rows[0].dead_letter === true);
  const deadLetter = await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows[0]));
  expect(deadLetter.last_error).toContain('Exact session transition rejected');
  await page.evaluate(() => window.MemphisScanSync.reportDeviceSyncStatus());
  expect(statusReports.some((report) => report.p_queue_count === 1
    && report.p_last_error?.includes('Exact session transition rejected'))).toBe(true);
  reject = false;
  const recovered = await page.evaluate(() => window.MemphisScanSync.recoverAllDeadLetters());
  expect(recovered).toBe(1);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 0);
  expect(finishCalls).toBe(2);
  await page.evaluate(() => window.MemphisScanSync.reportDeviceSyncStatus());
  expect(statusReports.at(-1).p_queue_count).toBe(0);
  expect(statusReports.at(-1).p_last_error).toBeNull();
  await context.close();
});

test('temporary authentication rejection remains retryable and drains after access recovers', async ({ browser }) => {
  const context = await browser.newContext();
  let reject = true;
  let calls = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status') return json(route, 200, { ok: true, data: {} });
    calls += 1;
    if (reject) return json(route, 401, { ok: false, error: 'Session refresh required' });
    return json(route, 200, { ok: true, data: { event_id: SESSION_ID, status: 'accepted' } });
  });
  const page = await openHarness(context);
  await page.evaluate((eventId) => window.MemphisScanSync.enqueue({
    type: 'ping_device',
    client_id: eventId,
    payload: { p_device_id: 'SCAN_SYNC_BROWSER_TEST', p_notes: eventId },
  }), SESSION_ID);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 1 && rows[0].state === 'retrying');
  const queued = await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows[0]));
  expect(queued.dead_letter).toBe(false);
  expect(queued.retry_count).toBe(1);

  reject = false;
  await page.waitForTimeout(13_000);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 0);
  expect(calls).toBe(2);
  await context.close();
});

test('actual version 1 through 4 records migrate explicitly or remain in non-recoverable local quarantine', async ({ browser }) => {
  const fixture = require('../quality/fixtures/batch-0a/mz-scan-queue-v4.json');
  const actualSnapshots = [
    ...fixture.legacy_snapshots,
    { database_version: fixture.database.version, records: fixture.v4_records },
  ];
  for (const snapshot of actualSnapshots) {
    const legacyVersion = snapshot.database_version;
    const context = await browser.newContext();
    const rpcCalls = [];
    await installCompatibleVersionRoute(context);
    await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
      const request = JSON.parse(route.request().postData() || '{}');
      if (request.fn !== 'tool_report_device_sync_status') rpcCalls.push(request);
      return json(route, 200, { ok: true, data: request.fn === 'tool_complete_session' ? {
        session_uuid: request.args.p_session_uuid,
        client_session_id: request.args.p_session_uuid,
        client_completion_id: request.args.p_client_completion_id,
        status: 'closed',
        terminal: true,
      } : {} });
    });
    const page = await context.newPage();
    await page.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
    await page.evaluate(async ({ records, version }) => {
      await new Promise((resolve, reject) => {
        const removal = indexedDB.deleteDatabase('mz_scan_queue');
        removal.onsuccess = () => resolve();
        removal.onerror = () => reject(removal.error);
        removal.onblocked = () => reject(new Error('Legacy queue database deletion was blocked.'));
      });
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('mz_scan_queue', version);
        request.onupgradeneeded = () => request.result.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('actions', 'readwrite');
          for (const record of records) tx.objectStore('actions').add(record);
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    }, { records: snapshot.records, version: legacyVersion });
    await page.goto(`/tests/scan-sync-harness.html?device=${DEVICE_ID}`);
    await page.evaluate(() => window.MemphisScanSync.ready);
    await page.evaluate(() => window.MemphisScanSync.sync());
    await waitForQueue(page, (rows) => legacyVersion === 3 ? rows.length === 0 : rows.length === snapshot.records.length);
    expect(await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('mz_scan_queue');
      request.onsuccess = () => { const version = request.result.version; request.result.close(); resolve(version); };
      request.onerror = () => reject(request.error);
    }))).toBe(4);
    if (legacyVersion === 3) {
      expect(rpcCalls).toEqual([expect.objectContaining({
        fn: 'tool_complete_session',
        args: expect.objectContaining({
          p_session_uuid: '70000000-0000-4000-8000-000000000004',
          p_client_completion_id: '70000000-0000-4000-8000-000000000003',
        }),
      })]);
    } else {
      expect(rpcCalls).toHaveLength(0);
      const rows = await page.evaluate(() => window.MemphisScanSync.listActions());
      expect(rows.every((row) => row.recoverable === false && row.state === 'legacy-quarantine')).toBe(true);
      expect(await page.evaluate(() => window.MemphisScanSync.recoverAllDeadLetters())).toBe(0);
    }
    await context.close();
  }
});

test('accepted Build 22 worker cannot replay a current authority-bound record', async ({ browser }) => {
  const context = await browser.newContext();
  const operationCalls = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn !== 'tool_report_device_sync_status') operationCalls.push(request);
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await openHarness(context, { backendSchema: '0'.repeat(64) });
  await page.evaluate((completionId) => window.MemphisScanSync.enqueue({
    type: 'complete_session',
    operation_id: completionId,
    payload: {
      p_session_uuid: '00000000-0000-4000-8000-000000000114',
      p_client_completion_id: completionId,
    },
  }), COMPLETION_ID);

  await waitForQueue(page, (rows) => rows.length === 1 && rows[0].state === 'pending');
  const before = await exactQueueRecords(page);
  expect(await physicalDatabaseVersion(page)).toBe(4);
  expect(before).toEqual([expect.objectContaining({
    schema_version: 6,
    operation_id: COMPLETION_ID,
    forward_action_type: 'complete_session',
    type: 'forward-replay-fenced:complete_session',
    dead_letter: true,
  })]);

  await page.close();
  const rollbackPage = await context.newPage();
  await rollbackPage.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
  await rollbackPage.evaluate(() => {
    window.MemphisDeviceIdentity = { resolve: () => ({ deviceId: 'SCAN_SYNC_BROWSER_TEST' }) };
  });
  await rollbackPage.addScriptTag({ content: acceptedBuild22Worker() });
  expect(await rollbackPage.evaluate(() => window.MemphisScanSync.ready)).toBe(true);
  await rollbackPage.evaluate(() => window.MemphisScanSync.sync());
  await rollbackPage.waitForTimeout(1_100);
  expect(operationCalls).toHaveLength(0);
  expect(await exactQueueRecords(rollbackPage)).toEqual(before);
  await context.close();
});

for (const version of [5, 6]) {
  test(`physical queue database v${version} is durably normalized to rollback-compatible v4`, async ({ browser }) => {
    const context = await browser.newContext();
    await installCompatibleVersionRoute(context, undefined, '0'.repeat(64));
    const page = await context.newPage();
    await page.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
    await seedQueueDatabase(page, version, [{
      id: 91,
      schema_version: 6,
      type: 'complete_session',
      operation_id: COMPLETION_ID,
      client_id: COMPLETION_ID,
      payload: {
        p_session_uuid: SESSION_ID,
        p_client_completion_id: COMPLETION_ID,
        p_device_id: DEVICE_ID,
      },
      created_at: 1785600000000,
      retry_count: 0,
      dead_letter: false,
      state: 'pending',
    }]);
    await page.goto(`/tests/scan-sync-harness.html?device=${DEVICE_ID}`);
    expect(await page.evaluate(() => window.MemphisScanSync.ready)).toBe(true);
    expect(await physicalDatabaseVersion(page)).toBe(4);
    expect(await page.evaluate(() => window.MemphisScanSync.listActions())).toEqual([
      expect.objectContaining({ operation_id: COMPLETION_ID, type: 'complete_session', dead_letter: false }),
    ]);
    const physical = await exactQueueRecords(page);
    expect(physical).toEqual([expect.objectContaining({
      operation_id: COMPLETION_ID,
      type: 'forward-replay-fenced:complete_session',
      forward_action_type: 'complete_session',
      dead_letter: true,
      current_dead_letter: false,
    })]);
    await context.close();
  });
}

test('unknown future physical queue version is preserved without opening or mutating it', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
  const future = { id: 92, schema_version: 99, type: 'future_authority_action', payload: { opaque: 'preserve-me' } };
  await seedQueueDatabase(page, 7, [future]);
  await page.goto(`/tests/scan-sync-harness.html?device=${DEVICE_ID}`);
  expect(await page.evaluate(() => window.MemphisScanSync.ready)).toBe(false);
  expect(await physicalDatabaseVersion(page)).toBe(7);
  expect(await exactQueueRecords(page)).toEqual([future]);
  await context.close();
});

test('queued work cannot drain against a backend below the published minimum', async ({ browser }) => {
  const context = await browser.newContext();
  const rpcCalls = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn !== 'tool_report_device_sync_status') rpcCalls.push(request);
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await openHarness(context, { backendVersion: 'release-2026.07.18.custodial-v99.99' });
  await page.evaluate((completionId) => window.MemphisScanSync.enqueue({
    type: 'complete_session', operation_id: completionId,
    payload: { p_session_uuid: '00000000-0000-4000-8000-000000000114', p_client_completion_id: completionId },
  }), COMPLETION_ID);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await page.waitForTimeout(1_100);
  expect(await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows.length))).toBe(1);
  expect(rpcCalls).toHaveLength(0);
  await context.close();
});

test('queued work cannot drain against a same-version backend with the wrong authority schema', async ({ browser }) => {
  const context = await browser.newContext();
  const rpcCalls = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn !== 'tool_report_device_sync_status') rpcCalls.push(request);
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await openHarness(context, { backendSchema: '0'.repeat(64) });
  await page.evaluate((completionId) => window.MemphisScanSync.enqueue({
    type: 'complete_session', operation_id: completionId,
    payload: { p_session_uuid: '00000000-0000-4000-8000-000000000114', p_client_completion_id: completionId },
  }), COMPLETION_ID);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await page.waitForTimeout(1_100);
  expect(await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows.length))).toBe(1);
  expect(rpcCalls).toHaveLength(0);
  await context.close();
});

test('incompatible historical finish is retained as a reconciliation dead letter', async ({ browser }) => {
  const context = await browser.newContext();
  let finishCalls = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_finish_session') finishCalls += 1;
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await openHarness(context);
  await page.evaluate(() => window.MemphisScanSync.enqueue({
    type: 'finish_session',
    client_id: 'old-location-only-finish',
    payload: { p_location_code: 'MEMMEX', p_device_id: 'old-phone' },
  }));
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 1 && rows[0].dead_letter === true);
  const row = await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows[0]));
  expect(row.last_error).toContain('no exact session or operation identifier');
  expect(finishCalls).toBe(0);
  await context.close();
});

test('mismatched completion acknowledgement preserves local work and enters recovery', async ({ browser }) => {
  const context = await browser.newContext();
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status') return json(route, 200, { ok: true, data: {} });
    return json(route, 200, { ok: true, data: {
      status: 'closed', terminal: true,
      client_session_id: '00000000-0000-4000-8000-000000000999',
      client_completion_id: '00000000-0000-4000-8000-000000000998',
    } });
  });
  const page = await openHarness(context);
  await context.setOffline(true);
  await page.evaluate(({ sessionId, completionId }) => localStorage.setItem(`session:${sessionId}`, JSON.stringify({
    session_uuid: sessionId,
    client_session_id: sessionId,
    client_completion_id: completionId,
    context_id: '00000000-0000-4000-8000-000000000120',
    submission_proof: 'proof-120',
    status: 'pending_submit',
  })), { sessionId: SESSION_ID, completionId: COMPLETION_ID });
  await page.evaluate(({ sessionId, completionId }) => window.MemphisScanSync.enqueue({
    type: 'commit_workflow', client_id: completionId,
    payload: {
      p_client_session_id: sessionId, p_client_completion_id: completionId,
      p_response_json: { services_performed: ['Sweep'] },
    },
  }), { sessionId: SESSION_ID, completionId: COMPLETION_ID });
  await context.setOffline(false);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 1 && rows[0].state !== 'processing');
  const queued = await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows[0]));
  expect(queued).toEqual(expect.objectContaining({ state: 'dead-letter', dead_letter: true }));
  expect(await page.evaluate((id) => localStorage.getItem(`session:${id}`), SESSION_ID)).not.toBeNull();
  expect(queued.last_error).toContain('does not match the queued occurrence');
  await context.close();
});

test('localStorage deletion failure cannot acknowledge or discard a completed workflow', async ({ browser }) => {
  const context = await browser.newContext();
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status') return json(route, 200, { ok: true, data: {} });
    return json(route, 200, { ok: true, data: {
      status: 'closed', terminal: true,
      client_session_id: request.args.p_client_session_id,
      client_completion_id: request.args.p_client_completion_id,
    } });
  });
  const page = await openHarness(context);
  await context.setOffline(true);
  await page.evaluate(({ sessionId, completionId }) => localStorage.setItem(`session:${sessionId}`, JSON.stringify({
    session_uuid: sessionId,
    client_session_id: sessionId,
    client_completion_id: completionId,
    context_id: '00000000-0000-4000-8000-000000000121',
    submission_proof: 'proof-121',
    status: 'pending_submit',
  })), { sessionId: SESSION_ID, completionId: COMPLETION_ID });
  await page.evaluate(({ sessionId, completionId }) => window.MemphisScanSync.enqueue({
    type: 'commit_workflow', client_id: completionId,
    payload: {
      p_client_session_id: sessionId, p_client_completion_id: completionId,
      p_response_json: { services_performed: ['Sweep'] },
    },
  }), { sessionId: SESSION_ID, completionId: COMPLETION_ID });
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function removeItem(key) {
      if (String(key).startsWith('session:')) throw new Error('simulated localStorage deletion failure');
      return original.call(this, key);
    };
  });
  await context.setOffline(false);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 1 && rows[0].state === 'retrying');
  expect(await page.evaluate((id) => localStorage.getItem(`session:${id}`), SESSION_ID)).not.toBeNull();
  expect(await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows[0].last_error)))
    .toContain('Durable local workflow storage is unavailable');
  await context.close();
});

test('localStorage write failure cannot acknowledge a started occurrence', async ({ browser }) => {
  const context = await browser.newContext();
  const employeeId = '00000000-0000-4000-8000-000000000115';
  const contextId = '00000000-0000-4000-8000-000000000116';
  const occurrenceId = '00000000-0000-4000-8000-000000000117';
  const snapshotId = 'a'.repeat(64);
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status') return json(route, 200, { ok: true, data: {} });
    return json(route, 200, { ok: true, data: {
      status: 'active',
      client_session_id: request.args.p_client_session_id,
      context_id: contextId,
      occurrence_id: occurrenceId,
      snapshot_id: request.args.p_snapshot_id,
      employee_id: request.args.p_snapshot_employee_id,
      assignment_epoch: request.args.p_snapshot_assignment_epoch,
      submission_proof: 'b'.repeat(64),
    } });
  });
  const page = await openHarness(context);
  await context.setOffline(true);
  await page.evaluate((sessionId) => localStorage.setItem(`session:${sessionId}`, JSON.stringify({
    session_uuid: sessionId, client_session_id: sessionId, status: 'offline-provisional', server_acknowledged: false,
  })), SESSION_ID);
  await page.evaluate(({ sessionId, snapshot, employee }) => window.MemphisScanSync.enqueue({
    type: 'start_session', client_id: sessionId,
    payload: {
      p_client_session_id: sessionId, p_location_code: 'TETM', p_device_id: 'SCAN_SYNC_BROWSER_TEST',
      p_snapshot_id: snapshot, p_snapshot_employee_id: employee, p_snapshot_assignment_epoch: 1,
    },
  }), { sessionId: SESSION_ID, snapshot: snapshotId, employee: employeeId });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (String(key).startsWith('session:')) throw new Error('simulated localStorage write failure');
      return original.call(this, key, value);
    };
  });
  await context.setOffline(false);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 1 && rows[0].state === 'retrying');
  const local = await page.evaluate((id) => JSON.parse(localStorage.getItem(`session:${id}`)), SESSION_ID);
  expect(local.server_acknowledged).toBe(false);
  expect(await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows[0].last_error)))
    .toContain('Durable local workflow storage is unavailable');
  await context.close();
});

test('changed unattempted completion replaces its predecessor under one durable identity', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openHarness(context);
  await context.setOffline(true);
  await page.evaluate(({ sessionId, completionId }) => localStorage.setItem(`session:${sessionId}`, JSON.stringify({
    session_uuid: sessionId, client_session_id: sessionId, client_completion_id: completionId,
    context_id: '00000000-0000-4000-8000-000000000122', submission_proof: 'proof-122', status: 'pending_submit',
  })), { sessionId: SESSION_ID, completionId: COMPLETION_ID });
  const enqueue = (services) => page.evaluate(({ sessionId, completionId, selected }) => window.MemphisScanSync.enqueue({
    type: 'commit_workflow', client_id: completionId,
    payload: {
      p_client_session_id: sessionId, p_client_completion_id: completionId,
      p_response_json: { services_performed: selected },
    },
  }), { sessionId: SESSION_ID, completionId: COMPLETION_ID, selected: services });
  await enqueue(['Sweep']);
  await enqueue(['Sweep', 'Trash']);
  const rows = await page.evaluate(() => window.MemphisScanSync.listActions());
  expect(rows).toHaveLength(1);
  expect(rows[0].payload.p_response_json.services_performed).toEqual(['Sweep', 'Trash']);
  expect(rows[0].replaced_unattempted_semantic_fingerprint).toMatch(/^canonical:/);
  await context.close();
});

test('changed attempted completion quarantines both semantic versions', async ({ browser }) => {
  const context = await browser.newContext();
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status') return json(route, 200, { ok: true, data: {} });
    return json(route, 429, { ok: false, error: 'Try again later' }, { 'Retry-After': '60' });
  });
  const page = await openHarness(context);
  await context.setOffline(true);
  await page.evaluate(({ sessionId, completionId }) => localStorage.setItem(`session:${sessionId}`, JSON.stringify({
    session_uuid: sessionId, client_session_id: sessionId, client_completion_id: completionId,
    context_id: '00000000-0000-4000-8000-000000000123', submission_proof: 'proof-123', status: 'pending_submit',
  })), { sessionId: SESSION_ID, completionId: COMPLETION_ID });
  const action = (services) => ({
    type: 'commit_workflow', client_id: COMPLETION_ID,
    payload: {
      p_client_session_id: SESSION_ID, p_client_completion_id: COMPLETION_ID,
      p_response_json: { services_performed: services },
    },
  });
  await page.evaluate((value) => window.MemphisScanSync.enqueue(value), action(['Sweep']));
  await context.setOffline(false);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 1 && rows[0].state === 'retrying');
  await context.setOffline(true);
  expect(await page.evaluate((value) => window.MemphisScanSync.enqueue(value)
    .then(() => null, (error) => error.code), action(['Sweep', 'Trash']))).toBe('semantic_completion_conflict');
  const rows = await page.evaluate(() => window.MemphisScanSync.listActions());
  expect(rows).toHaveLength(2);
  expect(rows.every((row) => row.dead_letter === true && row.state === 'quarantined')).toBe(true);
  expect(new Set(rows.map((row) => row.semantic_fingerprint)).size).toBe(2);
  await context.close();
});

test('429 response retains the operation and records bounded retry state', async ({ browser }) => {
  const context = await browser.newContext();
  let throttledCalls = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status') return json(route, 200, { ok: true, data: {} });
    throttledCalls += 1;
    return json(route, 429, { ok: false, error: 'Try again later' }, { 'Retry-After': '1' });
  });
  const page = await openHarness(context);
  const started = Date.now();
  await page.evaluate((completionId) => window.MemphisScanSync.enqueue({
    type: 'complete_session',
    operation_id: completionId,
    payload: { p_session_uuid: '00000000-0000-4000-8000-000000000114', p_client_completion_id: completionId },
  }), COMPLETION_ID);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 1 && rows[0].state === 'retrying');
  const row = await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows[0]));
  expect(row.dead_letter).toBe(false);
  expect(row.retry_count).toBe(1);
  expect(row.next_attempt_at).toBeGreaterThan(started + 900);
  expect(throttledCalls).toBe(1);
  await context.close();
});
