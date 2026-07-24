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
  await page.evaluate(() => window.MemphisScanSync.showRecoveryPanel());
  const dialog = page.locator('#memphis-scan-recovery-dialog');
  await expect(dialog).toContainText('Exact session transition rejected');
  await expect(dialog).toContainText(SESSION_ID);
  await dialog.getByRole('button', { name: 'Retry once' }).click();
  await waitForQueue(page, (rows) => rows.length === 0);
  expect(finishCalls).toBe(2);
  await context.close();
});

test('dead-letter recovery renders server errors as text, never executable markup', async ({ browser }) => {
  const context = await browser.newContext();
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status') return json(route, 200, { ok: true, data: {} });
    return json(route, 422, { ok: false, error: '&lt;img src=x onerror="window.__recoveryInjected=true"&gt;' });
  });
  const page = await openHarness(context);
  const eventId = '00000000-0000-4000-8000-000000000409';
  await page.evaluate((id) => window.MemphisScanSync.enqueue({
    type: 'record_scan_event',
    client_id: id,
    payload: { p_client_event_id: id, p_event_type: 'recovery_render_test', p_result: 'rejected' },
  }), eventId);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 1 && rows[0].dead_letter === true);
  await page.evaluate(() => window.MemphisScanSync.showRecoveryPanel());
  const dialog = page.locator('#memphis-scan-recovery-dialog');
  await expect(dialog).toContainText('&lt;img src=x onerror="window.__recoveryInjected=true"&gt;');
  await expect(dialog.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__recoveryInjected === true)).toBe(false);
  await context.close();
});

test('start acknowledgement cannot regress a queued completion back to active', async ({ browser }) => {
  const context = await browser.newContext();
  let releaseCompletion;
  const completionHeld = new Promise((resolve) => { releaseCompletion = resolve; });
  let completionReached = false;
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status') return json(route, 200, { ok: true, data: {} });
    if (request.fn === 'tool_start_session_v2') {
      return json(route, 200, { ok: true, data: {
        session_uuid: SESSION_ID,
        client_session_id: '00000000-0000-4000-8000-000000000410',
        status: 'active',
        employee_name: 'Queued Completion Employee',
      } });
    }
    if (request.fn === 'tool_commit_cleaning_workflow') {
      completionReached = true;
      await completionHeld;
      return json(route, 200, { ok: true, data: { session_uuid: SESSION_ID, status: 'closed' } });
    }
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await openHarness(context);
  const clientSessionId = '00000000-0000-4000-8000-000000000410';
  const completionId = '00000000-0000-4000-8000-000000000411';
  await page.evaluate(({ clientSessionId: clientId, completionId: completion }) => {
    localStorage.setItem(`session:${clientId}`, JSON.stringify({
      session_uuid: clientId,
      client_session_id: clientId,
      status: 'pending_sync',
      state: 'submitting-completion',
      completion_pending: true,
      client_completion_id: completion,
      response_json: { services: ['restroom_check'] },
      ended_at: '2026-07-24T15:00:00.000Z',
      sync_status: 'submission_pending',
      device_id: 'SCAN_SYNC_BROWSER_TEST',
    }));
  }, { clientSessionId, completionId });
  await page.evaluate(({ clientSessionId: clientId, completionId: completion }) => Promise.all([
    window.MemphisScanSync.enqueue({
      type: 'start_session',
      client_id: clientId,
      payload: { p_client_session_id: clientId, p_location_code: 'TETM', p_device_id: 'SCAN_SYNC_BROWSER_TEST' },
    }),
    window.MemphisScanSync.enqueue({
      type: 'commit_workflow',
      client_id: completion,
      payload: {
        p_client_session_id: clientId,
        p_client_completion_id: completion,
        p_location_code: 'TETM',
        p_device_id: 'SCAN_SYNC_BROWSER_TEST',
      },
    }),
  ]), { clientSessionId, completionId });
  const syncPromise = page.evaluate(() => window.MemphisScanSync.sync());
  await expect.poll(() => completionReached).toBe(true);
  const retained = await page.evaluate((serverSessionId) => JSON.parse(localStorage.getItem(`session:${serverSessionId}`)), SESSION_ID);
  expect(retained.status).toBe('pending_sync');
  expect(retained.state).toBe('submitting-completion');
  expect(retained.completion_pending).toBe(true);
  expect(retained.client_completion_id).toBe(completionId);
  expect(retained.response_json).toEqual({ services: ['restroom_check'] });
  releaseCompletion();
  await syncPromise;
  await context.close();
});

test('queue clock remains eligible after the phone wall clock moves backward', async ({ browser }) => {
  const context = await browser.newContext();
  const originalNow = 2_000_000_000_000;
  await context.addInitScript((initial) => {
    window.__memphisTestNow = initial;
    Date.now = () => window.__memphisTestNow;
  }, originalNow);
  let calls = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn !== 'tool_report_device_sync_status') calls += 1;
    return json(route, 200, { ok: true, data: { status: 'accepted' } });
  });
  const page = await openHarness(context);
  const eventId = '00000000-0000-4000-8000-000000000420';
  await page.evaluate(({ eventId: id, eligibleAt }) => window.MemphisScanSync.enqueue({
    type: 'record_scan_event',
    client_id: id,
    next_attempt_at: eligibleAt,
    payload: { p_client_event_id: id, p_event_type: 'clock_rollback_test', p_result: 'accepted' },
  }), { eventId, eligibleAt: originalNow + 500 });
  await page.evaluate((rolledBack) => { window.__memphisTestNow = rolledBack; }, originalNow - 60 * 60 * 1000);
  await page.waitForTimeout(700);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 0);
  expect(calls).toBe(1);
  await context.close();
});

test('queue clock does not accelerate when queue records are read repeatedly', async ({ browser }) => {
  const context = await browser.newContext();
  const originalNow = 2_000_000_000_000;
  await context.addInitScript((initial) => {
    window.__memphisTestNow = initial;
    Date.now = () => window.__memphisTestNow;
  }, originalNow);
  let calls = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn !== 'tool_report_device_sync_status') calls += 1;
    return json(route, 200, { ok: true, data: { status: 'accepted' } });
  });
  const page = await openHarness(context);
  const eventId = '00000000-0000-4000-8000-000000000421';
  await page.evaluate(({ eventId: id, eligibleAt }) => window.MemphisScanSync.enqueue({
    type: 'record_scan_event',
    client_id: id,
    next_attempt_at: eligibleAt,
    payload: { p_client_event_id: id, p_event_type: 'clock_rate_test', p_result: 'accepted' },
  }), { eventId, eligibleAt: originalNow + 5000 });
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    for (let index = 0; index < 250; index += 1) await window.MemphisScanSync.listActions();
  });
  await page.evaluate(() => window.MemphisScanSync.sync());
  const queued = await page.evaluate(() => window.MemphisScanSync.listActions());
  expect(queued).toHaveLength(1);
  expect(calls).toBe(0);
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
