const { test, expect } = require('@playwright/test');

const DEVICE_ID = 'SCAN_SYNC_BROWSER_TEST';
const SESSION_ID = '00000000-0000-4000-8000-000000000111';
const COMPLETION_ID = '00000000-0000-4000-8000-000000000112';

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

async function openHarness(context) {
  const page = await context.newPage();
  await page.goto(`/tests/scan-sync-harness.html?device=${DEVICE_ID}`);
  await page.evaluate(() => window.MemphisScanSync.ready);
  return page;
}

test('two tabs submit one authoritative request for one logical operation', async ({ browser }) => {
  const context = await browser.newContext();
  const rpcCalls = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn !== 'tool_report_device_sync_status') rpcCalls.push(request);
    return json(route, 200, { ok: true, data: { event_id: SESSION_ID, status: 'accepted' } });
  });
  const [one, two] = await Promise.all([openHarness(context), openHarness(context)]);
  const action = {
    type: 'record_scan_event',
    client_id: SESSION_ID,
    payload: { p_client_event_id: SESSION_ID, p_event_type: 'test', p_result: 'accepted' },
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
  expect(rpcCalls.filter((call) => call.fn === 'tool_record_scan_event')).toHaveLength(1);
  expect(rpcCalls[0].args.p_client_event_id).toBe(SESSION_ID);
  await context.close();
});

test('six tabs deduplicate one logical NFC-side operation and preserve six distinct operations', async ({ browser }) => {
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
    type: 'record_scan_event',
    client_id: sharedId,
    payload: { p_client_event_id: sharedId, p_event_type: 'scan_received', p_result: 'accepted' },
  };
  await Promise.all(pages.map((page) => page.evaluate((action) => window.MemphisScanSync.enqueue(action), sharedAction)));
  await Promise.all(pages.map((page) => page.evaluate(() => window.MemphisScanSync.sync())));
  await waitForQueue(pages[0], (rows) => rows.length === 0);
  expect(rpcCalls.filter((call) => call.args?.p_client_event_id === sharedId)).toHaveLength(1);

  const distinctIds = pages.map((_, index) => `00000000-0000-4000-8000-${String(300 + index).padStart(12, '0')}`);
  await Promise.all(pages.map((page, index) => page.evaluate(({ clientId }) => window.MemphisScanSync.enqueue({
    type: 'record_scan_event',
    client_id: clientId,
    payload: { p_client_event_id: clientId, p_event_type: 'scan_received', p_result: 'accepted' },
  }), { clientId: distinctIds[index] })));
  await Promise.all(pages.map((page) => page.evaluate(() => window.MemphisScanSync.sync())));
  await waitForQueue(pages[0], (rows) => rows.length === 0);
  for (const clientId of distinctIds) expect(rpcCalls.filter((call) => call.args?.p_client_event_id === clientId)).toHaveLength(1);
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
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status') return json(route, 200, { ok: true, data: {} });
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
  reject = false;
  const recovered = await page.evaluate(() => window.MemphisScanSync.recoverAllDeadLetters());
  expect(recovered).toBe(1);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 0);
  expect(finishCalls).toBe(2);
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
    type: 'record_scan_event',
    client_id: eventId,
    payload: { p_client_event_id: eventId, p_event_type: 'test', p_result: 'accepted' },
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

test('version 3 completion record is upgraded and exact identifiers are adapted', async ({ browser }) => {
  const context = await browser.newContext();
  let captured = null;
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_complete_session') captured = request;
    return json(route, 200, { ok: true, data: request.fn === 'tool_complete_session' ? { session_uuid: SESSION_ID, status: 'closed' } : {} });
  });
  const page = await context.newPage();
  // Seed v3 on a same-origin page that never loads the v4 queue module. Loading
  // the harness first races an open v4 connection and can legitimately block
  // deleteDatabase in fast CI runners.
  await page.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
  await page.evaluate(async ({ sessionId }) => {
    await new Promise((resolve, reject) => {
      const removal = indexedDB.deleteDatabase('mz_scan_queue');
      removal.onsuccess = () => resolve();
      removal.onerror = () => reject(removal.error);
      removal.onblocked = () => reject(new Error('Legacy queue database deletion was blocked.'));
    });
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('mz_scan_queue', 3);
      request.onupgradeneeded = () => request.result.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('actions', 'readwrite');
        tx.objectStore('actions').add({
          type: 'complete_session',
          client_id: 'historical-client-session',
          created_at: Date.now() - 1000,
          payload: { p_client_session_id: sessionId, p_response_json: { services: ['restroom_check'] } },
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, { sessionId: SESSION_ID });
  await page.goto(`/tests/scan-sync-harness.html?device=${DEVICE_ID}`);
  await page.evaluate(() => window.MemphisScanSync.ready);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 0);
  expect(captured).not.toBeNull();
  expect(captured.args.p_session_uuid).toBe(SESSION_ID);
  expect(captured.args.p_client_completion_id).toMatch(/^[0-9a-f-]{36}$/i);
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
  expect(row.last_error).toContain('no exact session identifier');
  expect(finishCalls).toBe(0);
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
