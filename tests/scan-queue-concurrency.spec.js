if(process.argv[2]==='--receipt-original-owner-source-only'){
  queueReceiptOriginalOwnerSourceCase().catch(error=>{console.error(error);process.exitCode=1;});
}else if(process.argv[2]==='--claim-original-owner-source-only'){
  queueClaimOriginalOwnerSourceCase().catch(error=>{console.error(error);process.exitCode=1;});
}else if(process.argv[2]==='--enqueue-terminal-settlement-source-only'){
  queueEnqueueTerminalSettlementSourceCase().catch(error=>{console.error(error);process.exitCode=1;});
}else if(process.argv[2]==='--enqueue-owned-boundary-source-only'){
  queueEnqueueOwnedBoundarySourceCase().catch(error=>{console.error(error);process.exitCode=1;});
}else{
const { installNativeAcceptanceFixture } = require('./helpers/native-acceptance-fixture.cjs');
const { test, expect } = require('@playwright/test');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const DEVICE_ID = 'SCAN_SYNC_BROWSER_TEST';
const SESSION_ID = '00000000-0000-4000-8000-000000000111';
const COMPLETION_ID = '00000000-0000-4000-8000-000000000112';
const FINISH_SCAN_ID = '00000000-0000-4000-8000-000000000119';
// Candidate's isolated NORMAL catalog; browser execution remains a separate gate.
const SCHEMA_FINGERPRINT = 'ce1406bf491d398acb0d9d81ce1ed8f5d9ad60f503bc27585b9991c93b1b6ee2';
const PREVIOUS_SCHEMA_FINGERPRINT = '81b3fa4316a772ab7553956e5b5c29a04c3d5583c6f32b2917c30eb19a011c32';
const ACCEPTED_BUILD_22_COMMIT = '23740cb0c50c4b80f78adbe9fa4f875707359483';
const ACCEPTED_BUILD_22_WORKER_SHA256 = 'b9465949796be0e84d6c4236a6c01974fd74534792f8ca30b2304c8969ffe4fa';
const ACCEPTED_BUILD_22_WORKER_FIXTURE = path.join(__dirname, 'fixtures', 'build22-memphis-scan-sync.js');
const BUILD_22_ROLLBACK_POLICY = JSON.parse(readFileSync(path.join(__dirname, '..', 'mobile', 'release-policies', 'custodial-build22-rollback.json'), 'utf8'));

function acceptedBuild22Worker() {
  expect(ACCEPTED_BUILD_22_COMMIT).toMatch(/^[a-f0-9]{40}$/);
  const source = readFileSync(ACCEPTED_BUILD_22_WORKER_FIXTURE, 'utf8');
  expect(createHash('sha256').update(source).digest('hex')).toBe(ACCEPTED_BUILD_22_WORKER_SHA256);
  return source;
}

test('Build 22 is preserved as history but cannot admit new scan.v4 work or serve as rollback', () => {
  const source = acceptedBuild22Worker();
  expect(source).toContain('tool_start_session_v2');
  expect(source).not.toMatch(/tool_start_offline_occurrence|beginRollbackFence|authorizeOfflineNewWork/);
  expect(BUILD_22_ROLLBACK_POLICY.status).toBe('preserved_incompatible_not_rollback_eligible');
  expect(BUILD_22_ROLLBACK_POLICY.compatibility_evidence).toEqual(expect.objectContaining({
    artifact_scan_contract: 'scan.v2',
    required_scan_contract: 'scan.v4.snapshot-bound-authority',
    backend_allows_artifact_start_rpc: false,
    artifact_has_durable_rollback_fence: false,
    canary_release_eligible: false,
  }));
  expect(BUILD_22_ROLLBACK_POLICY.rollback_commands).toEqual([]);
});

test('completion-draft presence can be checked without deleting or reading its content', async ({ context }) => {
  const page = await openHarness(context);
  const identity = {
    contract_version: 'scan.v4.snapshot-bound-authority',
    session_uuid: SESSION_ID,
    client_completion_id: COMPLETION_ID,
    device_id: 'KIOSK_08',
    employee_id: '00000000-0000-4000-8000-000000000113',
    location_code: 'NOCX',
  };
  expect(await page.evaluate((id) => window.MemphisScanSync.completionDraftExists(id), SESSION_ID)).toBe(false);
  await page.evaluate((value) => window.MemphisScanSync.saveCompletionDraft({
    ...value,
    draft: { issue: 'preserved' },
  }), identity);
  expect(await page.evaluate((id) => window.MemphisScanSync.completionDraftExists(id), SESSION_ID)).toBe(true);
  await page.evaluate((id) => window.MemphisScanSync.deleteCompletionDraft(id), SESSION_ID);
  expect(await page.evaluate((id) => window.MemphisScanSync.completionDraftExists(id), SESSION_ID)).toBe(false);
});

test('one exact preserved interrupted Start Cleaning action retires under the queue writer lock', async ({ context }) => {
  const page = await openHarness(context);
  await context.setOffline(true);
  await page.evaluate((sessionId) => window.MemphisScanSync.enqueue({
    type: 'start_session',
    client_id: sessionId,
    payload: { p_client_session_id: sessionId },
  }), SESSION_ID);
  const before = await page.evaluate(() => window.MemphisScanSync.listActions());
  expect(before).toHaveLength(1);
  expect(before[0]).toMatchObject({
    type: 'start_session',
    client_id: SESSION_ID,
    operation_id: SESSION_ID,
    logical_identity: SESSION_ID,
    replay_binding: { client_session_id: SESSION_ID },
  });

  const retirement = await page.evaluate((sessionId) => window.MemphisScanSync.retirePreservedInterruptedStart(
    sessionId,
    async (actions, evidence) => {
      localStorage.setItem('__preserved_interrupted_start', JSON.stringify(actions));
      return {
        preserved: localStorage.getItem('__preserved_interrupted_start') === JSON.stringify(actions),
        canonical_actions: evidence.canonical_actions,
      };
    },
  ), SESSION_ID);
  expect(retirement).toMatchObject({
    contract_version: 'custodial-interrupted-start-retirement.v1',
    session_uuid: SESSION_ID,
    preserved_action_count: 1,
    retired_action_count: 1,
    already_absent: false,
  });
  expect(await page.evaluate(() => window.MemphisScanSync.listActions())).toEqual([]);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('__preserved_interrupted_start'))))
    .toEqual(JSON.parse(JSON.stringify(before)));
});

test('interrupted-start recovery reclaims an orphaned live lease after acquiring the queue Web Lock', async ({ context }) => {
  const page = await openHarness(context);
  await context.setOffline(true);
  expect(await page.evaluate(() => typeof navigator.locks?.request === 'function')).toBe(true);
  await page.evaluate((sessionId) => window.MemphisScanSync.enqueue({
    type: 'start_session',
    client_id: sessionId,
    payload: { p_client_session_id: sessionId },
  }), SESSION_ID);
  const [queued] = await page.evaluate(() => window.MemphisScanSync.listActions());
  await page.evaluate(({ id, leaseUntil }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('mz_scan_queue');
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('actions', 'readwrite');
      const store = tx.objectStore('actions');
      const lookup = store.get(id);
      lookup.onsuccess = () => store.put({
        ...lookup.result,
        state: 'processing',
        lease_owner: 'departed-scan-worker',
        lease_token: crypto.randomUUID(),
        lease_until: leaseUntil,
      });
      lookup.onerror = () => reject(lookup.error);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  }), { id: queued.id, leaseUntil: Date.now() + 60_000 });
  const [leased] = await page.evaluate(() => window.MemphisScanSync.listActions());
  expect(leased).toMatchObject({ state: 'processing', lease_owner: 'departed-scan-worker' });
  expect(leased.lease_until).toBeGreaterThan(Date.now());

  const retirement = await page.evaluate((sessionId) => window.MemphisScanSync.retirePreservedInterruptedStart(
    sessionId,
    async (actions, evidence) => ({
      preserved: actions.length === 1,
      canonical_actions: evidence.canonical_actions,
    }),
  ), SESSION_ID);
  expect(retirement).toMatchObject({
    session_uuid: SESSION_ID,
    preserved_action_count: 1,
    retired_action_count: 1,
  });
  expect(await page.evaluate(() => window.MemphisScanSync.listActions())).toEqual([]);
});

test('native startup recovery owns queued Start Cleaning evidence before automatic replay begins', async ({ context }) => {
  const snapshotId = '1'.repeat(64);
  const employeeId = '00000000-0000-4000-8000-000000000121';
  const credentialId = '00000000-0000-4000-8000-000000000122';
  const scanEntryId = '00000000-0000-4000-8000-000000000123';
  const startedAt = '2026-08-26T18:00:00.000Z';
  const contextId = '00000000-0000-4000-8000-000000000124';
  const occurrenceId = '00000000-0000-4000-8000-000000000125';
  const calls = [];

  await context.addInitScript(() => {
    window.MemphisMobile = {
      reconcileRecoveredPreStart: async () => ({ state: window.__startupRecoveryHealthy ? 'none' : 'manager_required' }),
    };
  });
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status_v2') {
      return json(route, 200, { ok: true, data: {} });
    }
    calls.push(request.fn);
    return json(route, 200, { ok: true, data: {
      status: 'active',
      client_session_id: SESSION_ID,
      context_id: contextId,
      occurrence_id: occurrenceId,
      snapshot_id: snapshotId,
      employee_id: employeeId,
      assignment_epoch: 1,
      started_at: startedAt,
      submission_proof: '2'.repeat(64),
    } });
  });

  const page = await openHarness(context);
  await context.setOffline(true);
  await page.evaluate((values) => window.MemphisScanSync.enqueue({
    type: 'start_session',
    client_id: values.sessionId,
    payload: {
      p_client_session_id: values.sessionId,
      p_device_id: values.deviceId,
      p_location_code: 'NOCX',
      p_snapshot_id: values.snapshotId,
      p_snapshot_employee_id: values.employeeId,
      p_snapshot_assignment_epoch: 1,
      p_snapshot_credential_id: values.credentialId,
      p_native_scan_entry_id: values.scanEntryId,
      p_client_started_at: values.startedAt,
      p_native_start_attestation_version: 'custodial-native-start.v1',
      p_native_start_attestation: '3'.repeat(64),
    },
  }), {
    sessionId: SESSION_ID,
    deviceId: DEVICE_ID,
    snapshotId,
    employeeId,
    credentialId,
    scanEntryId,
    startedAt,
  });
  await context.setOffline(false);

  await page.waitForTimeout(1_200);
  const held = await page.evaluate(() => window.MemphisScanSync.listActions());
  expect(held).toHaveLength(1);
  expect(held[0]).toMatchObject({ state: 'pending', retry_count: 0 });
  expect(calls).toEqual([]);

  expect(await page.evaluate(() => window.MemphisScanSync.releaseStartupRecoveryGate({ state: 'manager_required' }))).toBe(false);
  expect(await page.evaluate(() => window.MemphisScanSync.sync())).toBe(false);
  expect(await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows.length))).toBe(1);
  expect(calls).toEqual([]);

  // Shared recovery, not a Home visit or forced release, must classify the retained state.
  expect(await page.evaluate(async () => { window.__startupRecoveryHealthy = true; return (await window.MemphisScanSync.reconcileStartupRecovery()).state; })).toBe('none');
  await waitForQueue(page, (rows) => rows.length === 0);
  expect(calls).toEqual(['tool_start_offline_occurrence']);
});

test('interrupted-start retirement refuses Finish Cleaning evidence and leaves it unchanged', async ({ context }) => {
  const page = await openHarness(context);
  await context.setOffline(true);
  await page.evaluate((sessionId) => window.MemphisScanSync.enqueue({
    type: 'finish_session',
    client_id: sessionId,
    payload: { p_session_uuid: sessionId },
  }), SESSION_ID);
  const before = await page.evaluate(() => window.MemphisScanSync.listActions());
  const result = await page.evaluate((sessionId) => window.MemphisScanSync.retirePreservedInterruptedStart(
    sessionId,
    async (_actions, evidence) => ({ preserved: true, canonical_actions: evidence.canonical_actions }),
  ).then(() => ({ changed: true }), (error) => ({ changed: false, code: error.code })), SESSION_ID);
  expect(result).toEqual({ changed: false, code: 'queue_chain_type' });
  expect(await page.evaluate(() => window.MemphisScanSync.listActions())).toEqual(before);
});

test('process death after archival preserves the Start Cleaning row and resumes exact retirement', async ({ context }) => {
  const page = await openHarness(context);
  await context.setOffline(true);
  await page.evaluate((sessionId) => window.MemphisScanSync.enqueue({
    type: 'start_session',
    client_id: sessionId,
    payload: { p_client_session_id: sessionId },
  }), SESSION_ID);
  await page.evaluate(() => {
    window.__MZ_SCAN_SYNC_INTERRUPTED_START_TEST_HOOK__ = (point) => {
      if (point === 'archive-preserved') throw new Error('simulated process death after archival');
    };
  });
  const interrupted = await page.evaluate((sessionId) => window.MemphisScanSync.retirePreservedInterruptedStart(
    sessionId,
    async (actions, evidence) => {
      localStorage.setItem('__preserved_interrupted_start', JSON.stringify(actions));
      return { preserved: true, canonical_actions: evidence.canonical_actions };
    },
  ).then(() => 'retired', (error) => error.message), SESSION_ID);
  expect(interrupted).toBe('simulated process death after archival');
  const beforeResume = await page.evaluate(() => window.MemphisScanSync.listActions());
  expect(beforeResume).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('__preserved_interrupted_start'))).not.toBeNull();

  const resumed = await page.evaluate((sessionId) => {
    delete window.__MZ_SCAN_SYNC_INTERRUPTED_START_TEST_HOOK__;
    const expected = localStorage.getItem('__preserved_interrupted_start');
    return window.MemphisScanSync.retirePreservedInterruptedStart(sessionId, async (actions, evidence) => ({
      preserved: JSON.stringify(actions) === expected,
      canonical_actions: evidence.canonical_actions,
    }));
  }, SESSION_ID);
  expect(resumed).toMatchObject({ retired_action_count: 1, already_absent: false });
  expect(await page.evaluate(() => window.MemphisScanSync.listActions())).toEqual([]);
});

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

async function downgradeBackupState(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('mz_scan_queue_v6_to_v4_backup');
    request.onsuccess = () => {
      const db = request.result;
      const available = db.objectStoreNames.contains('metadata') && db.objectStoreNames.contains('actions');
      db.close();
      resolve(available);
    };
    request.onerror = () => reject(request.error);
  }));
}

function isRollbackFenced(rows) {
  return rows.every((row) => row.forward_replay_contract === 'scan.v4.snapshot-bound-authority'
    && String(row.type || '').startsWith('forward-replay-fenced:')
    && row.dead_letter === true);
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
    if (request.fn !== 'tool_report_device_sync_status_v2') rpcCalls.push(request);
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

test('fully offline finish freezes time then binds completion after start acknowledgement', async ({ browser }) => {
  const context = await browser.newContext();
  const snapshotId = 'e'.repeat(64);
  const employeeId = '00000000-0000-4000-8000-000000000113';
  const credentialId = '00000000-0000-4000-8000-000000000114';
  const contextId = '00000000-0000-4000-8000-000000000115';
  const occurrenceId = '00000000-0000-4000-8000-000000000116';
  const startedAt = '2026-08-13T14:00:00.000Z';
  const frozenEndedAt = '2026-08-13T14:17:00.000Z';
  const calls = [];
  await context.addInitScript(({ endedAt }) => {
    window.MemphisMobile = {
      nativeOfflineTimeAuthority: true,
      createOfflineStartAttestation: async (input) => ({
        p_client_started_at: input.clientStartedAt,
        p_native_scan_entry_id: input.nativeScanEntryId,
        p_native_start_attestation_version: input.originalNativeStartAttestationVersion,
        p_native_start_attestation: input.originalNativeStartAttestation,
        p_native_start_transport_attestation_version: 'custodial-native-start-transport.v1',
        p_native_start_transport_attestation: 'e'.repeat(64),
      }),
      createOfflineCompletionAttestation: async (input) => {
        window.__completionAttestationInput = input;
        return {
          p_client_ended_at: endedAt,
          p_native_finish_scan_entry_id: input.nativeFinishScanEntryId,
          p_native_completion_attestation_version: 'custodial-native-completion.v2',
          p_native_completion_attestation: input.originalNativeCompletionAttestation || 'd'.repeat(64),
          ...(input.originalNativeCompletionAttestation ? {
            p_native_completion_transport_attestation_version: 'custodial-native-completion-transport.v1',
            p_native_completion_transport_attestation: 'f'.repeat(64),
          } : {}),
        };
      },
      acknowledgeOfflineCompletion: async (input) => {
        window.__completionAcknowledgementInput = input;
        return { acknowledged: true };
      },
    };
  }, { endedAt: frozenEndedAt });
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
    calls.push(request);
    if (request.fn === 'tool_start_offline_occurrence') return json(route, 200, { ok: true, data: {
      status: 'active', client_session_id: SESSION_ID, context_id: contextId,
      occurrence_id: occurrenceId, snapshot_id: snapshotId, employee_id: employeeId,
      assignment_epoch: 7, started_at: startedAt, submission_proof: 'c'.repeat(64),
    } });
    if (request.fn === 'tool_commit_cleaning_workflow') return json(route, 200, { ok: true, data: {
      status: 'closed', terminal: true, client_session_id: SESSION_ID,
      client_completion_id: COMPLETION_ID, occurrence_id: occurrenceId,
    } });
    return json(route, 422, { ok: false, error: `unexpected ${request.fn}` });
  });
  const page = await openHarness(context);
  await context.setOffline(true);
  await page.evaluate((record) => localStorage.setItem(`session:${record.client_session_id}`, JSON.stringify(record)), {
    session_uuid: SESSION_ID, client_session_id: SESSION_ID, client_completion_id: COMPLETION_ID,
    device_id: DEVICE_ID, location_code: 'TETM', started_at: startedAt, ended_at: frozenEndedAt,
    offline_authority_snapshot_id: snapshotId, offline_authority_employee_id: employeeId,
    offline_authority_assignment_epoch: 7, status: 'pending_submit',
    sync_status: 'submission_waiting_for_activation', native_completion_time_captured: true,
    native_finish_scan_entry_id: FINISH_SCAN_ID,
    scan_evidence: [{ client_event_id: FINISH_SCAN_ID, event_type: 'scan_finish', result: 'ok', scanned_at: frozenEndedAt, payload_json: { entry_source: 'native-nfc' } }],
  });
  await page.evaluate((values) => Promise.all([
    window.MemphisScanSync.enqueue({
      type: 'start_session', client_id: values.sessionId,
      payload: {
        p_client_session_id: values.sessionId, p_device_id: values.deviceId, p_location_code: 'TETM',
        p_snapshot_id: values.snapshotId, p_snapshot_employee_id: values.employeeId,
        p_snapshot_assignment_epoch: 7, p_snapshot_credential_id: values.credentialId,
        p_native_scan_entry_id: '00000000-0000-4000-8000-000000000331',
        p_client_started_at: values.startedAt,
        p_native_start_attestation_version: 'custodial-native-start.v1',
        p_native_start_attestation: 'a'.repeat(64),
      },
    }),
    window.MemphisScanSync.enqueue({
      type: 'commit_workflow', client_id: values.completionId,
      payload: {
        p_client_session_id: values.sessionId, p_client_completion_id: values.completionId,
        p_device_id: values.deviceId, p_location_code: 'TETM',
        p_client_started_at: values.startedAt, p_client_ended_at: values.endedAt,
        p_response_json: { services_performed: ['Sweep'] },
      },
    }),
  ]), {
    sessionId: SESSION_ID, completionId: COMPLETION_ID, deviceId: DEVICE_ID,
    snapshotId, employeeId, credentialId, startedAt, endedAt: frozenEndedAt,
  });
  await context.setOffline(false);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 0);
  expect(calls.map((call) => call.fn)).toEqual(['tool_start_offline_occurrence', 'tool_commit_cleaning_workflow']);
  expect(calls[0].args).toEqual(expect.objectContaining({
    p_native_start_attestation_version: 'custodial-native-start.v1',
    p_native_start_attestation: 'a'.repeat(64),
    p_native_start_transport_attestation_version: 'custodial-native-start-transport.v1',
    p_native_start_transport_attestation: 'e'.repeat(64),
  }));
  const completion = calls[1].args;
  expect(completion).toEqual(expect.objectContaining({
    p_client_ended_at: frozenEndedAt,
    p_native_finish_scan_entry_id: FINISH_SCAN_ID,
    p_native_completion_attestation_version: 'custodial-native-completion.v2',
    p_native_completion_attestation: 'd'.repeat(64),
    p_native_completion_transport_attestation_version: 'custodial-native-completion-transport.v1',
    p_native_completion_transport_attestation: 'f'.repeat(64),
  }));
  expect(completion.p_response_json.__custodial_offline_reconciliation_v1).toEqual({
    context_id: contextId, submission_proof: 'c'.repeat(64),
  });
  expect(await page.evaluate(() => window.__completionAttestationInput)).toEqual(expect.objectContaining({
    contextId, clientSessionId: SESSION_ID, clientCompletionId: COMPLETION_ID,
    nativeFinishScanEntryId: FINISH_SCAN_ID,
  }));
  expect(await page.evaluate(() => window.__completionAcknowledgementInput)).toEqual({
    deviceId: DEVICE_ID, locationCode: 'TETM', clientSessionId: SESSION_ID,
    nativeFinishScanEntryId: FINISH_SCAN_ID,
    clientStartedAt: startedAt, clientEndedAt: frozenEndedAt,
    completionPayload: completion,
  });
  expect(await page.evaluate((id) => localStorage.getItem(`session:${id}`), SESSION_ID)).toBeNull();
  await context.close();
});

test('completion proof survives renderer death after an idempotent backend commit', async ({ browser }) => {
  const context = await browser.newContext();
  const trustedReceipts=await installNativeAcceptanceFixture(context);
  const snapshotId = 'e'.repeat(64);
  const employeeId = '00000000-0000-4000-8000-000000000113';
  const contextId = '00000000-0000-4000-8000-000000000115';
  const occurrenceId = '00000000-0000-4000-8000-000000000116';
  const startedAt = '2026-08-13T14:00:00.000Z';
  const endedAt = '2026-08-13T14:17:00.000Z';
  const calls = [];
  await context.addInitScript(({ exactEndedAt }) => {
    window.MemphisMobile = {
      nativeOfflineTimeAuthority: true,
      getAuthenticatedCompletion:input=>window.__testReadAuthenticatedCompletion(input),
      createOfflineCompletionAttestation: async (input) => {
        localStorage.setItem('__completion_attestation_calls', String(Number(localStorage.getItem('__completion_attestation_calls') || 0) + 1));
        return {
          p_client_ended_at: exactEndedAt,
          p_native_finish_scan_entry_id: input.nativeFinishScanEntryId,
          p_native_completion_attestation_version: 'custodial-native-completion.v2',
          p_native_completion_attestation: input.originalNativeCompletionAttestation || 'd'.repeat(64),
          ...(input.originalNativeCompletionAttestation ? {
            p_native_completion_transport_attestation_version: 'custodial-native-completion-transport.v1',
            p_native_completion_transport_attestation: 'f'.repeat(64),
          } : {}),
        };
      },
      acknowledgeOfflineCompletion: async (input) => {
        if (localStorage.getItem('__completion_ack_renderer_killed') !== 'done') {
          localStorage.setItem('__completion_ack_renderer_killed', 'done');
          localStorage.setItem('__completion_ack_entered', 'true');
          localStorage.removeItem(`session:${input.clientSessionId}`);
          return new Promise(() => {});
        }
        return { acknowledged: true };
      },
    };
  }, { exactEndedAt: endedAt });
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
    calls.push(request);
    const accepted={status:'closed',terminal:true,client_session_id:SESSION_ID,
      client_completion_id:COMPLETION_ID,occurrence_id:occurrenceId};
    trustedReceipts.capture(request.args,accepted);
    return json(route,200,{ok:true,data:accepted});
  });
  const first = await openHarness(context);
  await context.setOffline(true);
  await first.evaluate((record) => localStorage.setItem(`session:${record.client_session_id}`, JSON.stringify(record)), {
    session_uuid: SESSION_ID, client_session_id: SESSION_ID, client_completion_id: COMPLETION_ID,
    device_id: DEVICE_ID, location_code: 'TETM', started_at: startedAt, ended_at: endedAt,
    offline_authority_snapshot_id: snapshotId, offline_authority_employee_id: employeeId,
    offline_authority_assignment_epoch: 7, offline_occurrence_id: occurrenceId,
    context_id: contextId, submission_proof: 'c'.repeat(64), status: 'pending_submit',
    native_finish_scan_entry_id: FINISH_SCAN_ID,
    scan_evidence: [{ client_event_id: FINISH_SCAN_ID, event_type: 'scan_finish', result: 'ok', scanned_at: endedAt, payload_json: { entry_source: 'native-nfc' } }],
  });
  await first.evaluate((values) => window.MemphisScanSync.enqueue({
    type: 'commit_workflow', client_id: values.completionId,
    payload: {
      p_client_session_id: values.sessionId, p_client_completion_id: values.completionId,
      p_device_id: values.deviceId, p_location_code: 'TETM',
      p_client_started_at: values.startedAt, p_client_ended_at: values.endedAt,
      p_response_json: { services_performed: ['Sweep'] },
    },
  }), { sessionId: SESSION_ID, completionId: COMPLETION_ID, deviceId: DEVICE_ID, startedAt, endedAt });
  await context.setOffline(false);
  await first.evaluate(() => {
    window.MemphisScanSync.sync();
    return true;
  });
  await expect.poll(() => calls.length).toBe(1);
  await expect.poll(() => first.evaluate(() => localStorage.getItem('__completion_ack_entered'))).toBe('true');
  await waitForQueue(first, (rows) => rows.length === 1 && rows[0].state === 'processing');
  const persisted = await first.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows[0]));
  expect(persisted.payload).toEqual(expect.objectContaining({
    p_native_finish_scan_entry_id: FINISH_SCAN_ID,
    p_native_completion_attestation_version: 'custodial-native-completion.v2',
    p_native_completion_attestation: 'd'.repeat(64),
    p_native_completion_transport_attestation_version: 'custodial-native-completion-transport.v1',
    p_native_completion_transport_attestation: 'f'.repeat(64),
  }));
  expect(persisted.payload.p_response_json.__custodial_offline_reconciliation_v1).toEqual({
    context_id: contextId, submission_proof: 'c'.repeat(64),
  });
  expect(await first.evaluate((id) => localStorage.getItem(`session:${id}`), SESSION_ID)).toBeNull();
  await first.close();

  const second = await openHarness(context);
  await second.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(second, (rows) => rows.length === 0);
  expect(calls).toHaveLength(1);
  expect(trustedReceipts.stats.recoveries).toBeGreaterThan(0);
  expect(persisted.server_completion_receipt?.result.client_completion_id).toBe(COMPLETION_ID);
  expect(persisted.server_completion_receipt?.integrity_sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(calls[0].args).toEqual(expect.objectContaining({
    p_native_finish_scan_entry_id: FINISH_SCAN_ID,
    p_native_completion_attestation_version: 'custodial-native-completion.v2',
    p_native_completion_attestation: 'd'.repeat(64),
    p_native_completion_transport_attestation_version: 'custodial-native-completion-transport.v1',
    p_native_completion_transport_attestation: 'f'.repeat(64),
  }));
  expect(calls[0].args.p_response_json.__custodial_offline_reconciliation_v1).toEqual({
    context_id: contextId, submission_proof: 'c'.repeat(64),
  });
  expect(await second.evaluate(() => Number(localStorage.getItem('__completion_attestation_calls')))).toBe(2);
  await context.close();
});

test('six tabs deduplicate one logical queued operation and preserve six distinct operations', async ({ browser }) => {
  const context = await browser.newContext();
  const rpcCalls = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn !== 'tool_report_device_sync_status_v2') rpcCalls.push(request);
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

test('a stale telemetry rejection cannot run before a frozen start and completion recovery chain', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    let online = false;
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
    window.__setQueueTestOnline = (value) => {
      online = value === true;
      window.dispatchEvent(new Event(online ? 'online' : 'offline'));
    };
    window.MemphisMobile = {
      acknowledgeOfflineCompletion: async () => ({ acknowledged: true }),
    };
  });
  const calls = [];
  let startAttempts = 0;
  const employeeId = '00000000-0000-4000-8000-000000000115';
  const contextId = '00000000-0000-4000-8000-000000000116';
  const occurrenceId = '00000000-0000-4000-8000-000000000117';
  const snapshotId = 'a'.repeat(64);
  const telemetryId = '00000000-0000-4000-8000-000000000118';
  await installCompatibleVersionRoute(context);
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn !== 'tool_report_device_sync_status_v2') calls.push(request.fn);
    if (request.fn === 'tool_start_offline_occurrence') {
      startAttempts += 1;
      if (startAttempts === 1) return json(route, 429, { ok: false, error: 'retry start' }, { 'Retry-After': '60' });
      return json(route, 200, { ok: true, data: {
        status: 'active', client_session_id: SESSION_ID, context_id: contextId, occurrence_id: occurrenceId,
        snapshot_id: request.args.p_snapshot_id, employee_id: request.args.p_snapshot_employee_id,
        assignment_epoch: request.args.p_snapshot_assignment_epoch, started_at: request.args.p_client_started_at, submission_proof: 'c'.repeat(64),
      } });
    }
    if (request.fn === 'tool_commit_cleaning_workflow') return json(route, 200, { ok: true, data: {
      status: 'closed', terminal: true, client_session_id: SESSION_ID,
      client_completion_id: COMPLETION_ID, occurrence_id: occurrenceId,
    } });
    if (request.fn === 'tool_evaluate_location_proximity_v2') {
      return json(route, 403, { ok: false, error: 'stale telemetry credential' });
    }
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await context.newPage();
  await page.goto('/frontend-release-manifest.json');
  await page.evaluate(({ sessionId, completionId, snapshot, employee, contextValue, occurrence, finishScan }) => {
    localStorage.setItem(`session:${sessionId}`, JSON.stringify({
      session_uuid: sessionId, client_session_id: sessionId, client_completion_id: completionId,
      context_id: contextValue, occurrence_id: occurrence, submission_proof: 'c'.repeat(64),
      offline_authority_snapshot_id: snapshot, offline_authority_employee_id: employee,
      offline_authority_assignment_epoch: 7, status: 'pending_submit',
      native_finish_scan_entry_id: finishScan,
      native_completion_attestation_version: 'custodial-native-completion.v2',
      native_completion_attestation: 'b'.repeat(64),
      ended_at: '2026-07-19T12:03:00.000Z',
      scan_evidence: [{ client_event_id: finishScan, event_type: 'scan_finish', result: 'ok', scanned_at: '2026-07-19T12:03:00.000Z', payload_json: { entry_source: 'native-nfc' } }],
    }));
  }, { sessionId: SESSION_ID, completionId: COMPLETION_ID, snapshot: snapshotId, employee: employeeId, contextValue: contextId, occurrence: occurrenceId, finishScan: FINISH_SCAN_ID });
  await seedQueueDatabase(page, 4, [
    {
      id: 1, schema_version: 6, type: 'start_session', client_id: SESSION_ID, operation_id: SESSION_ID,
      created_at: 1, retry_count: 0, next_attempt_at: 0, dead_letter: false, state: 'pending',
      payload: {
        p_client_session_id: SESSION_ID, p_location_code: 'TETM', p_device_id: DEVICE_ID,
        p_snapshot_id: snapshotId, p_snapshot_employee_id: employeeId, p_snapshot_assignment_epoch: 7,
        p_client_started_at: '2026-07-19T12:00:00.000Z',
        p_native_scan_entry_id: '00000000-0000-4000-8000-000000000484',
        p_native_start_attestation_version: 'custodial-native-start.v1', p_native_start_attestation: 'a'.repeat(64),
      },
    },
    {
      id: 2, schema_version: 6, type: 'evaluate_location_proximity_v2', client_id: telemetryId, operation_id: telemetryId,
      created_at: 2, retry_count: 0, next_attempt_at: 0, dead_letter: false, state: 'pending',
      payload: {
        p_location_code: 'TETM', p_device_identifier: DEVICE_ID, p_latitude: 35.1495, p_longitude: -90.049,
        p_accuracy_m: 8, p_client_event_id: telemetryId, p_observed_at: '2026-07-19T12:01:00.000Z',
      },
    },
    {
      id: 3, schema_version: 6, type: 'commit_workflow', client_id: COMPLETION_ID, operation_id: COMPLETION_ID,
      created_at: 3, retry_count: 0, next_attempt_at: 0, dead_letter: false, state: 'pending',
      payload: {
        p_client_session_id: SESSION_ID, p_client_completion_id: COMPLETION_ID, p_device_id: DEVICE_ID,
        p_location_code: 'TETM', p_client_started_at: '2026-07-19T12:00:00.000Z',
        p_client_ended_at: '2026-07-19T12:03:00.000Z',
        p_native_finish_scan_entry_id: FINISH_SCAN_ID,
        p_native_completion_attestation_version: 'custodial-native-completion.v2', p_native_completion_attestation: 'b'.repeat(64),
        p_scan_evidence: [{ client_event_id: FINISH_SCAN_ID, event_type: 'scan_finish', result: 'ok', scanned_at: '2026-07-19T12:03:00.000Z', payload_json: { entry_source: 'native-nfc' } }],
        p_response_json: { services_performed: ['Sweep'] },
      },
    },
  ]);
  await page.goto(`/tests/scan-sync-harness.html?device=${DEVICE_ID}`);
  await page.evaluate(() => window.MemphisScanSync.ready);
  await page.evaluate(() => window.__setQueueTestOnline(true));
  await page.evaluate(() => window.MemphisScanSync.sync());
  await expect.poll(() => startAttempts).toBe(1);
  expect(calls).toEqual(['tool_start_offline_occurrence']);

  await page.evaluate(async () => new Promise((resolve, reject) => {
    const request = indexedDB.open('mz_scan_queue');
    request.onsuccess = () => {
      const tx = request.result.transaction('actions', 'readwrite');
      const store = tx.objectStore('actions');
      const get = store.get(1);
      get.onsuccess = () => store.put({ ...get.result, next_attempt_at: 0, state: 'pending' });
      tx.oncomplete = () => { request.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  }));
  await page.evaluate(() => window.MemphisScanSync.sync());
  await expect.poll(() => calls.includes('tool_evaluate_location_proximity_v2')).toBe(true);
  expect(calls.slice(0, 3)).toEqual([
    'tool_start_offline_occurrence',
    'tool_start_offline_occurrence',
    'tool_commit_cleaning_workflow',
  ]);
  expect(calls.indexOf('tool_commit_cleaning_workflow')).toBeLessThan(calls.indexOf('tool_evaluate_location_proximity_v2'));
  await context.close();
});

test('permanent rejection enters visible dead letter and can be recovered once', async ({ browser }) => {
  const context = await browser.newContext();
  let reject = true;
  let finishCalls = 0;
  const statusReports = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status_v2') {
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
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
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
      if (request.fn !== 'tool_report_device_sync_status_v2') rpcCalls.push(request);
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
    if (!['tool_report_device_sync_status', 'tool_report_device_sync_status_v2'].includes(request.fn)) operationCalls.push(request);
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await openHarness(context, { backendSchema: '0'.repeat(64) });
  // Keep the current worker out of the fixture while the forward-fenced row is
  // captured. Otherwise its scheduled sync can transiently claim the row on a
  // slower runner, making `before` describe an in-flight lease instead of the
  // durable record whose Build 22 replay boundary this test owns.
  await context.setOffline(true);
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
  await context.setOffline(false);
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

for (const transition of ['backup-verified', 'primary-deleted', 'fenced-v4-written', 'fenced-v4-verified', 'backup-deleted']) {
  test(`queue downgrade ${transition} process death never exposes an unfenced v4 row`, async ({ browser }) => {
    const context = await browser.newContext();
    await installCompatibleVersionRoute(context, undefined, '0'.repeat(64));
    const seed = await context.newPage();
    await seed.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
    await seedQueueDatabase(seed, 6, [{
      id: 99, schema_version: 6, type: 'complete_session', operation_id: COMPLETION_ID, client_id: COMPLETION_ID,
      payload: { p_session_uuid: SESSION_ID, p_client_completion_id: COMPLETION_ID, p_device_id: DEVICE_ID },
      created_at: 1785600000000, retry_count: 0, dead_letter: false, state: 'pending',
    }]);
    await seed.evaluate((point) => localStorage.setItem('__mz_scan_sync_fault', point), transition);
    await seed.close();
    await context.addInitScript(() => {
      const point = localStorage.getItem('__mz_scan_sync_fault');
      if (point) window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__ = (seen) => {
        if (seen === point) throw new Error(`simulated process death at ${seen}`);
      };
    });
    const crashed = await context.newPage();
    await crashed.goto(`/tests/scan-sync-harness.html?device=${DEVICE_ID}`);
    expect(await crashed.evaluate(() => window.MemphisScanSync.ready)).toBe(false);
    const version = await physicalDatabaseVersion(crashed);
    if (version === 4) expect(isRollbackFenced(await exactQueueRecords(crashed))).toBe(true);
    expect(await downgradeBackupState(crashed)).toBe(transition !== 'backup-deleted');

    await crashed.evaluate(() => localStorage.removeItem('__mz_scan_sync_fault'));
    await crashed.reload();
    expect(await crashed.evaluate(() => window.MemphisScanSync.ready)).toBe(true);
    await context.setOffline(true);
    expect(await physicalDatabaseVersion(crashed)).toBe(4);
    expect(isRollbackFenced(await exactQueueRecords(crashed))).toBe(true);
    expect(await downgradeBackupState(crashed)).toBe(false);
    await context.close();
  });
}

test('new-work admission drains more than 100 rows before opening', async ({ browser }) => {
  const context = await browser.newContext();
  const calls = [];
  await installCompatibleVersionRoute(context);
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
    calls.push(request);
    return json(route, 200, { ok: true, data: { ok: true } });
  });
  const seed = await context.newPage();
  await seed.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
  const rows = Array.from({ length: 101 }, (_value, index) => {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    return { id: index + 1, schema_version: 6, type: 'ping_device', operation_id: id, client_id: id,
      payload: { p_device_id: DEVICE_ID }, created_at: 1785600000000 + index, retry_count: 0, dead_letter: false, state: 'pending' };
  });
  await seedQueueDatabase(seed, 4, rows);
  await seed.close();
  const page = await openHarness(context);
  const admission = await page.evaluate(() => window.MemphisScanSync.drainForNewWork());
  expect(admission).toEqual(expect.objectContaining({ admitted: true, queued: 0, batches: 2 }));
  expect(calls.filter((request) => request.fn === 'tool_ping_device')).toHaveLength(101);
  await context.close();
});

test('new-work admission remains closed for a future retry row', async ({ browser }) => {
  const context = await browser.newContext();
  const calls = [];
  await installCompatibleVersionRoute(context);
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    calls.push(JSON.parse(route.request().postData() || '{}'));
    return json(route, 200, { ok: true, data: {} });
  });
  const seed = await context.newPage();
  await seed.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
  await seedQueueDatabase(seed, 4, [{
    id: 1, schema_version: 6, type: 'ping_device', operation_id: COMPLETION_ID, client_id: COMPLETION_ID,
    payload: { p_device_id: DEVICE_ID }, created_at: 1785600000000, retry_count: 1,
    next_attempt_at: Date.now() + 60_000, dead_letter: false, state: 'retrying',
  }]);
  await seed.close();
  const page = await openHarness(context);
  const admission = await page.evaluate(() => window.MemphisScanSync.drainForNewWork());
  expect(admission).toEqual(expect.objectContaining({ admitted: false, queued: 1, reason: 'unresolved_queue_pending' }));
  expect(calls.filter((request) => request.fn === 'tool_ping_device')).toHaveLength(0);
  await context.close();
});

test('rollback receipt requires browser, local, native, and backend quiescence', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__nativeRollbackFenceId = null;
    window.MemphisMobile = {
      getOfflineAuthorityState: async () => ({
        occurrences_awaiting_acknowledgement: window.__nativeOccurrencePending === true,
        rollback_fence_active: typeof window.__nativeRollbackFenceId === 'string',
        rollback_fence_id: window.__nativeRollbackFenceId,
      }),
      beginRollbackFence: async () => {
        if (window.__nativeOccurrencePending === true) throw new Error('Native work is still pending.');
        window.__nativeRollbackFenceId ||= '55555555-5555-4555-8555-555555555555';
        return { rollback_fence_active: true, rollback_fence_id: window.__nativeRollbackFenceId };
      },
      clearRollbackFence: async (_deviceId, rollbackFenceId) => {
        if (rollbackFenceId !== window.__nativeRollbackFenceId) throw new Error('Rollback fence mismatch.');
        window.__nativeRollbackFenceId = null;
        return { cleared: true };
      },
      authorizeOfflineNewWork: async () => {
        if (window.__nativeRollbackFenceId) throw new Error('Rollback fence is active.');
        return { authorized: true };
      },
    };
  });
  await installCompatibleVersionRoute(context);
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_get_device_rollback_readiness') {
      return json(route, 200, { ok: true, data: {
        contract_version: 'custodial-rollback-readiness.v2', device_id: DEVICE_ID,
        backend_queue_count: 0, backend_open_session_count: 0,
        backend_sync_reported_at: new Date().toISOString(), eligible: true,
      } });
    }
    return json(route, 200, { ok: true, data: { ok: true } });
  });
  const page = await openHarness(context);
  const ready = await page.evaluate(() => window.MemphisScanSync.rollbackReadiness());
  expect(ready).toEqual(expect.objectContaining({
    contract_version: 'custodial-rollback-readiness.v2', browser_queue_count: 0,
    local_open_work_count: 0, native_occurrence_count: 0,
    backend_queue_count: 0, backend_open_session_count: 0,
    rollback_fence_active: true, rollback_fence_id: '55555555-5555-4555-8555-555555555555', eligible: true,
  }));
  await expect(page.evaluate(() => window.MemphisMobile.authorizeOfflineNewWork())).rejects.toThrow(/rollback fence is active/i);
  expect(await page.evaluate(() => window.MemphisScanSync.cancelRollbackFence('55555555-5555-4555-8555-555555555555')))
    .toEqual(expect.objectContaining({ cleared: true, device_id: DEVICE_ID }));
  const localBlocked = await page.evaluate(async () => {
    localStorage.setItem('session:rollback-blocked', JSON.stringify({ device_id: 'SCAN_SYNC_BROWSER_TEST', status: 'pending_sync' }));
    return window.MemphisScanSync.rollbackReadiness();
  });
  expect(localBlocked).toEqual(expect.objectContaining({ local_open_work_count: 1, rollback_fence_active: false, eligible: false }));
  const nativeBlocked = await page.evaluate(async () => {
    localStorage.removeItem('session:rollback-blocked');
    window.__nativeOccurrencePending = true;
    return window.MemphisScanSync.rollbackReadiness();
  });
  expect(nativeBlocked).toEqual(expect.objectContaining({ native_occurrence_count: 1, rollback_fence_active: false, eligible: false }));
  await context.close();
});

test('rollback readiness fails closed when the browser cannot provide an atomic Web Lock', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  });
  await installCompatibleVersionRoute(context);
  const page = await openHarness(context);
  await expect(page.evaluate(() => window.MemphisScanSync.rollbackReadiness())).rejects.toThrow(/requires the browser Web Locks authority/i);
  await context.close();
});

test('fallback queue lock rejects same-worker reentry without reclaiming live work', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  });
  let pingCalls = 0;
  await installCompatibleVersionRoute(context);
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
    pingCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
    return json(route, 200, { ok: true, data: { ok: true } });
  });
  const seed = await context.newPage();
  await seed.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
  await seedQueueDatabase(seed, 4, [{
    id: 1, schema_version: 6, type: 'ping_device', operation_id: COMPLETION_ID, client_id: COMPLETION_ID,
    payload: { p_device_id: DEVICE_ID }, created_at: 1785600000000, retry_count: 0,
    next_attempt_at: 0, dead_letter: false, state: 'pending',
  }]);
  await seed.close();
  const page = await openHarness(context);
  const results = await page.evaluate(() => Promise.all([
    window.MemphisScanSync.sync(),
    window.MemphisScanSync.sync(),
  ]));
  expect(results.sort()).toEqual([false, true]);
  expect(pingCalls).toBe(1);
  expect(await page.evaluate(() => window.MemphisScanSync.listActions())).toEqual([]);
  await context.close();
});

test('native admission holds the queue lock through authorization', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openHarness(context);
  await context.setOffline(true);
  const result = await page.evaluate(async () => {
    let authorizationStarted = false;
    let authorizationFinished = false;
    let enqueueSettled = false;
    const admissionPromise = window.MemphisScanSync.drainForNewWork(async () => {
      authorizationStarted = true;
      await new Promise((resolve) => setTimeout(resolve, 100));
      authorizationFinished = true;
      return { snapshot_id: 'f'.repeat(64) };
    });
    while (!authorizationStarted) await new Promise((resolve) => setTimeout(resolve, 1));
    const id = crypto.randomUUID();
    const enqueuePromise = window.MemphisScanSync.enqueue({
      type: 'ping_device', operation_id: id, client_id: id, payload: { p_device_id: 'SCAN_SYNC_BROWSER_TEST' },
    }).then(() => { enqueueSettled = true; });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const settledDuringAuthorization = enqueueSettled;
    const admission = await admissionPromise;
    const finishedWhenAdmitted = authorizationFinished;
    await enqueuePromise;
    return {
      admission,
      settledDuringAuthorization,
      finishedWhenAdmitted,
      queue: await window.MemphisScanSync.listActions(),
    };
  });
  expect(result.settledDuringAuthorization).toBe(false);
  expect(result.finishedWhenAdmitted).toBe(true);
  expect(result.admission).toEqual(expect.objectContaining({ admitted: true, queued: 0 }));
  expect(result.queue).toHaveLength(1);
  await context.close();
});

test('start acknowledgement must echo and cannot replace the queued native timestamp', async ({ browser }) => {
  const context = await browser.newContext();
  const snapshotId = 'f'.repeat(64);
  const employeeId = '00000000-0000-4000-8000-000000000119';
  const queuedAt = '2026-08-13T14:00:00.000Z';
  const serverStartedAt = '2026-08-13T14:09:00.000Z';
  await installCompatibleVersionRoute(context);
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
    if (request.fn !== 'tool_start_offline_occurrence') return json(route, 200, { ok: true, data: {} });
    return json(route, 200, { ok: true, data: {
      status: 'active', client_session_id: request.args.p_client_session_id,
      context_id: '00000000-0000-4000-8000-000000000120', occurrence_id: '00000000-0000-4000-8000-000000000121',
      snapshot_id: request.args.p_snapshot_id, employee_id: request.args.p_snapshot_employee_id,
      assignment_epoch: request.args.p_snapshot_assignment_epoch, submission_proof: 'c'.repeat(64),
      started_at: request.args.p_client_session_id === SESSION_ID ? request.args.p_client_started_at : serverStartedAt,
    } });
  });
  const page = await openHarness(context);
  const start = async (sessionId) => page.evaluate(async ({ sessionId, snapshotId, employeeId, queuedAt }) => {
    localStorage.setItem(`session:${sessionId}`, JSON.stringify({
      session_uuid: sessionId, client_session_id: sessionId, started_at: queuedAt, status: 'offline-provisional',
    }));
    await window.MemphisScanSync.enqueue({ type: 'start_session', client_id: sessionId, payload: {
      p_client_session_id: sessionId, p_device_id: 'SCAN_SYNC_BROWSER_TEST', p_location_code: 'TETM',
      p_snapshot_id: snapshotId, p_snapshot_employee_id: employeeId, p_snapshot_assignment_epoch: 7,
      p_client_started_at: queuedAt, p_native_scan_entry_id: '00000000-0000-4000-8000-000000000122',
      p_native_start_attestation_version: 'custodial-native-start.v1', p_native_start_attestation: 'a'.repeat(64),
    } });
    await window.MemphisScanSync.sync();
  }, { sessionId, snapshotId, employeeId, queuedAt });
  await start(SESSION_ID);
  await waitForQueue(page, (rows) => rows.length === 0);
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem(`session:${id}`)).started_at, SESSION_ID)).toBe(queuedAt);

  const mismatchedSessionId = '00000000-0000-4000-8000-000000000123';
  await start(mismatchedSessionId);
  await waitForQueue(page, (rows) => rows.length === 1 && rows[0].state === 'dead-letter');
  expect(await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows[0].last_error)))
    .toContain('does not match the queued snapshot occurrence');
  await context.close();
});

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
    if (request.fn !== 'tool_report_device_sync_status_v2') rpcCalls.push(request);
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
    if (request.fn !== 'tool_report_device_sync_status_v2') rpcCalls.push(request);
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

test('queued work cannot drain against the reviewed transition-source schema', async ({ browser }) => {
  const context = await browser.newContext();
  const rpcCalls = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn !== 'tool_report_device_sync_status_v2') rpcCalls.push(request);
    return json(route, 200, { ok: true, data: {} });
  });
  const page = await openHarness(context, { backendSchema: PREVIOUS_SCHEMA_FINGERPRINT });
  await page.evaluate((completionId) => window.MemphisScanSync.enqueue({
    type: 'complete_session', operation_id: completionId,
    payload: { p_session_uuid: '00000000-0000-4000-8000-000000000114', p_client_completion_id: completionId },
  }), COMPLETION_ID);
  await page.evaluate(() => window.MemphisScanSync.sync());
  await expect.poll(async () => JSON.parse(await page.locator('#status').textContent()).status)
    .toBe('compatibility-paused');
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

test('exact historical finish drains through its idempotent compatibility adapter', async ({ browser }) => {
  const context = await browser.newContext();
  const sessionId = '00000000-0000-4000-8000-000000000114';
  const requests = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
    requests.push(request);
    return json(route, 200, { ok: true, data: {
      session_uuid: sessionId, client_session_id: sessionId, status: 'pending_submit',
      finish_operation_id: COMPLETION_ID, replayed: false,
    } });
  });
  const page = await openHarness(context);
  await page.evaluate(({ sessionId, operationId, deviceId }) => window.MemphisScanSync.enqueue({
    type: 'finish_session', operation_id: operationId,
    payload: { p_session_uuid: sessionId, p_device_id: deviceId },
  }), { sessionId, operationId: COMPLETION_ID, deviceId: DEVICE_ID });
  await page.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(page, (rows) => rows.length === 0);
  expect(requests).toEqual([expect.objectContaining({
    fn: 'tool_finish_session',
    args: expect.objectContaining({ p_session_uuid: sessionId, p_finish_operation_id: COMPLETION_ID }),
  })]);
  await context.close();
});

test('mismatched completion acknowledgement preserves local work and enters recovery', async ({ browser }) => {
  const context = await browser.newContext();
  await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
    const request = JSON.parse(route.request().postData() || '{}');
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
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
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
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
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
    return json(route, 200, { ok: true, data: {
      status: 'active',
      client_session_id: request.args.p_client_session_id,
      context_id: contextId,
      occurrence_id: occurrenceId,
        snapshot_id: request.args.p_snapshot_id,
        employee_id: request.args.p_snapshot_employee_id,
        assignment_epoch: request.args.p_snapshot_assignment_epoch,
        started_at: request.args.p_client_started_at,
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
      p_client_started_at: '2026-07-19T12:00:00.000Z',
      p_native_scan_entry_id: '00000000-0000-4000-8000-000000000951',
      p_native_start_attestation_version: 'custodial-native-start.v1', p_native_start_attestation: 'a'.repeat(64),
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

for (const acknowledgement of ['missing', 'wrong']) {
  test(`${acknowledgement} assignment epoch cannot acknowledge a queued start`, async ({ browser }) => {
    const context = await browser.newContext();
    const employeeId = '00000000-0000-4000-8000-000000000125';
    const snapshotId = 'c'.repeat(64);
    await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async (route) => {
      const request = JSON.parse(route.request().postData() || '{}');
      if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
      return json(route, 200, { ok: true, data: {
        status: 'active', client_session_id: request.args.p_client_session_id,
        context_id: '00000000-0000-4000-8000-000000000126', occurrence_id: '00000000-0000-4000-8000-000000000127',
        snapshot_id: request.args.p_snapshot_id, employee_id: request.args.p_snapshot_employee_id,
        started_at: request.args.p_client_started_at,
        ...(acknowledgement === 'wrong' ? { assignment_epoch: request.args.p_snapshot_assignment_epoch + 1 } : {}),
        submission_proof: 'd'.repeat(64),
      } });
    });
    const page = await openHarness(context);
    await context.setOffline(true);
    await page.evaluate((sessionId) => localStorage.setItem(`session:${sessionId}`, JSON.stringify({
      session_uuid: sessionId, client_session_id: sessionId, status: 'offline-provisional', server_acknowledged: false,
    })), SESSION_ID);
    await page.evaluate(({ sessionId, snapshot, employee }) => window.MemphisScanSync.enqueue({
      type: 'start_session', client_id: sessionId,
      payload: { p_client_session_id: sessionId, p_location_code: 'TETM', p_device_id: 'SCAN_SYNC_BROWSER_TEST',
        p_snapshot_id: snapshot, p_snapshot_employee_id: employee, p_snapshot_assignment_epoch: 7,
        p_client_started_at: '2026-07-19T12:00:00.000Z',
        p_native_scan_entry_id: '00000000-0000-4000-8000-000000000997',
        p_native_start_attestation_version: 'custodial-native-start.v1', p_native_start_attestation: 'a'.repeat(64) },
    }), { sessionId: SESSION_ID, snapshot: snapshotId, employee: employeeId });
    await context.setOffline(false);
    await page.evaluate(() => window.MemphisScanSync.sync());
    await waitForQueue(page, (rows) => rows.length === 1 && rows[0].state === 'dead-letter');
    const local = await page.evaluate((id) => JSON.parse(localStorage.getItem(`session:${id}`)), SESSION_ID);
    expect(local.server_acknowledged).toBe(false);
    expect(await page.evaluate(() => window.MemphisScanSync.listActions().then((rows) => rows[0].last_error)))
      .toContain('does not match the queued snapshot occurrence');
    await context.close();
  });
}

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
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
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
    if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
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

// SCAN_BOOTSTRAP_NEW: source callbacks use the shipping closure, not a second queue implementation.
test('SCAN_BOOTSTRAP_NEW source: native bootstrap refuses writers and opening before admission', async () => {
  const assert = require('node:assert/strict');
  const vm = require('node:vm');
  const { URL } = require('node:url');
  const { TextEncoder } = require('node:util');
  const source = readFileSync(path.join(__dirname, '..', 'memphis-scan-sync.js'), 'utf8');
  const entry = source.indexOf('  const ready = ensureWorkerReady().catch(');
  assert(entry > 0 && source.indexOf('  const ready = ensureWorkerReady().catch(', entry + 1) === -1);
  const callbacks = source.slice(0, entry) + `
    window.__bootstrapCallbacks = { mutateProtectedQueue, queueOpeningCheckpoint,
      ensureWorkerReady, openDb, openCompletionDraftDb, postOpenContentMigration };
  })();`;
  function fixture(globals = {}) {
    let opens = 0, transactions = 0;
    const indexedDB = { open() { opens++; throw new Error('unexpected_fixture_database_open'); } };
    const window = { indexedDB, location: { href: 'https://source.invalid/tests/scan-sync-harness.html' },
      MemphisDeviceIdentity: { resolve: () => ({ deviceId: DEVICE_ID }) }, addEventListener() {}, ...globals };
    const context = vm.createContext({ window, indexedDB, navigator: { onLine: false },
      document: { addEventListener() {} }, crypto: require('node:crypto').webcrypto, URL, TextEncoder });
    vm.runInContext(callbacks, context, { timeout: 1000, filename: 'memphis-scan-sync.js' });
    return { window, api: window.__bootstrapCallbacks, opens: () => opens, transactions: () => transactions,
      db: { transaction() { transactions++; throw new Error('unexpected_fixture_migration'); } } };
  }
  const denied = error => error.code === 'custodial_security_state_unavailable';
  const markers = [
    { MemphisMobile: { edition: 'custodial' } },
    { MemphisMobileBuildIdentity: { edition: 'custodial' } },
    { Capacitor: { isNativePlatform: () => true } },
  ];
  let denials = 0;
  for (const marker of markers) {
    for (const security of [undefined, null, 'malformed', [], {}, { native: false, mutateProtectedWork() { throw new Error('must_not_delegate'); } },
      { native: true }, { native: true, mutateProtectedWork() {} }]) {
      const f = fixture({ ...marker, MemphisCustodialSecurity: security }); let writes = 0;
      await assert.rejects(f.api.mutateProtectedQueue(() => { writes++; }), denied); denials++;
      await assert.rejects(f.api.ensureWorkerReady(), denied); denials++;
      await assert.rejects(f.api.openDb({ state: 'legacy' }), denied); denials++;
      assert.throws(() => f.api.openCompletionDraftDb({ state: 'legacy' }), denied); denials++;
      await assert.rejects(f.api.postOpenContentMigration(f.db, { state: 'legacy' }), denied); denials++;
      // A leftover caller callback cannot waive bootstrap validation.
      assert.throws(() => f.api.queueOpeningCheckpoint({ assertCurrent() {} }), denied); denials++;
      assert.equal(writes, 0); assert.equal(f.opens(), 0); assert.equal(f.transactions(), 0);
    }
  }
  const legacy = fixture(); let legacyContext;
  assert.equal(await legacy.api.mutateProtectedQueue(context => { legacyContext = context; return 'ordinary-web'; }), 'ordinary-web');
  assert.equal(legacyContext.state, 'legacy'); assert.equal(legacyContext.generation, null);
  legacy.api.queueOpeningCheckpoint(legacyContext);
  const webCapacitor = fixture({ Capacitor: { isNativePlatform: () => false } });
  assert.equal(await webCapacitor.api.mutateProtectedQueue(() => 'web-capacitor'), 'web-capacitor');
  // The same legacy asynchronous operation sees marker arrival before its next write.
  let resume; let lateWrites = 0;
  const delayed = legacy.api.mutateProtectedQueue(async context => {
    await new Promise(resolve => { resume = resolve; });
    legacy.api.queueOpeningCheckpoint(context); lateWrites++;
  });
  legacy.window.MemphisMobileBuildIdentity = { edition: 'custodial' }; resume();
  await assert.rejects(delayed, denied); assert.equal(lateWrites, 0);
  delete legacy.window.MemphisMobileBuildIdentity;
  await assert.rejects(legacy.api.mutateProtectedQueue(() => { lateWrites++; }), denied);
  assert.equal(lateWrites, 0); // observed native bootstrap cannot fall back when a marker disappears

  let protectedCalls = 0, currentChecks = 0, observedOptions;
  const context = { deviceId: 'source-only-native-fixture', assertCurrent() { currentChecks++; } };
  const options = { requireEnrollment: true };
  const security = { native: true, waitForStableState: async () => {}, getStatus: () => ({}),
    mutateProtectedWork(operation, supplied) { assert.equal(this, security); protectedCalls++; observedOptions = supplied; return operation(context); } };
  const native = fixture({ MemphisCustodialSecurity: security });
  const result = {};
  assert.equal(await native.api.mutateProtectedQueue(received => { assert.equal(received, context); return result; }, options), result);
  assert.equal(protectedCalls, 1); assert.equal(observedOptions, options); assert(currentChecks > 0);
  const missingCheckpoint = fixture({ MemphisMobile: { edition: 'custodial' }, MemphisCustodialSecurity: {
    ...security, mutateProtectedWork: operation => operation({ deviceId: context.deviceId }) } });
  let unownedWrites = 0;
  await assert.rejects(missingCheckpoint.api.mutateProtectedQueue(() => { unownedWrites++; }),
    error => error.code === 'custodial_protected_checkpoint_unavailable');
  assert.equal(unownedWrites, 0);
  let admit; let retiredWrites = 0;
  const admissionGap = fixture({ MemphisMobile: { edition: 'custodial' }, MemphisCustodialSecurity: {
    ...security, mutateProtectedWork: async operation => { await new Promise(resolve => { admit = resolve; }); return operation(context); } } });
  const pending = admissionGap.api.mutateProtectedQueue(() => { retiredWrites++; });
  admissionGap.window.MemphisCustodialSecurity = security; admit();
  await assert.rejects(pending, denied); assert.equal(retiredWrites, 0);
  const uncertain = fixture({ Capacitor: { isNativePlatform() { throw new Error('platform unavailable'); } } });
  await assert.rejects(uncertain.api.mutateProtectedQueue(() => { retiredWrites++; }), denied);
  assert.equal(retiredWrites, 0);
  console.log(`SCAN_BOOTSTRAP_NEW Source callbacks: ${denials} preboot denials plus legacy/native/context/lifetime controls; SYNTHETIC globals, no browser/IDB/native authority proof`);
});

test('SCAN_BOOTSTRAP_NEW browser: preboot holds original v5 queue without opening or migration', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => { window.MemphisMobileBuildIdentity = { edition: 'custodial' }; });
    const page = await openHarness(context);
    expect(await page.evaluate(() => window.MemphisScanSync.ready)).toBe(false);
    const original = { id: 7, type: 'finish_session', client_id: SESSION_ID, schema_version: 4,
      payload: { p_session_uuid: SESSION_ID }, state: 'pending', retained_bootstrap_original: 'exact original' };
    await seedQueueDatabase(page, 5, [original]);
    const before = await exactQueueRecords(page);
    await page.reload();
    expect(await page.evaluate(() => window.MemphisScanSync.ready)).toBe(false);
    expect(await page.evaluate(() => window.MemphisScanSync.enqueue({ type: 'finish_session', client_id: 'unadmitted' })
      .then(() => null, error => error.code))).toBe('custodial_security_state_unavailable');
    expect(await physicalDatabaseVersion(page)).toBe(5);
    expect(await exactQueueRecords(page)).toEqual(before);
    expect(await page.evaluate(async () => (await indexedDB.databases())
      .some(database => database.name === 'mz_scan_queue_v6_to_v4_backup'))).toBe(false);
  } finally { await context.close(); }
});


test('QUEUE_ENQUEUE_OWNED_REAL_IDB_NEW browser: original owner withdrawal aborts real lookup before writes', async ({ browser }) => {
  const context = await browser.newContext();
  let page;
  let backendRequests = 0;
  try {
    // Real browser IDB/Web Lock/requests; the native owner remains an explicitly
    // SYNTHETIC generation/context model, not Android authentication/admission.
    await context.addInitScript(() => {
      const model = {
        generation: 7, withdrawn: false, activeOwners: 0, closedOwners: 0,
        armed: false, selected: 0, lookups: 0, adds: 0, puts: 0,
        aborts: 0, completes: 0, order: [], events: [], messages: [],
      };
      const originalGetAll = IDBObjectStore.prototype.getAll;
      const originalAdd = IDBObjectStore.prototype.add;
      const originalPut = IDBObjectStore.prototype.put;
      let selectedTransaction = null;
      const unavailable = () => Object.assign(new Error('Synthetic original enqueue owner withdrawn.'), {
        code: 'custodial_security_generation_changed',
      });
      const status = () => ({
        ready: !model.withdrawn, available: true, quarantined: model.withdrawn,
        state: 'enrolled', generation: model.generation, deviceId: 'KIOSK_08',
      });
      const stable = async () => {
        if (model.withdrawn) throw unavailable();
        return status();
      };
      let tail = Promise.resolve();
      window.MemphisCustodialSecurity = Object.freeze({
        native: true, getStatus: status, ensureSecurityState: stable, waitForStableState: stable,
        mutateProtectedWork(operation, options = {}) {
          const expectedGeneration = options.expectedGeneration;
          const pending = tail.then(async () => {
            const original = await stable();
            if (expectedGeneration != null && expectedGeneration !== original.generation) throw unavailable();
            let owned = true;
            model.activeOwners++;
            const owner = Object.freeze({
              deviceId: original.deviceId, generation: original.generation, state: original.state,
              assertCurrent() {
                if (!owned || model.withdrawn || model.generation !== original.generation) throw unavailable();
              },
            });
            try { owner.assertCurrent(); return await operation(owner); }
            finally {
              owned = false; model.activeOwners--; model.closedOwners++;
              if (selectedTransaction) model.order.push('owner-closed');
            }
          });
          tail = pending.catch(() => {});
          return pending;
        },
      });
      IDBObjectStore.prototype.getAll = function (...args) {
        const request = originalGetAll.apply(this, args);
        if (model.armed && this.name === 'actions' && this.transaction.db.name === 'mz_scan_queue'
          && this.transaction.mode === 'readwrite') {
          model.armed = false; model.selected++; selectedTransaction = this.transaction;
          selectedTransaction.addEventListener('abort', () => {
            model.aborts++; model.order.push('transaction-abort');
          }, { once: true, capture: true });
          selectedTransaction.addEventListener('complete', () => {
            model.completes++; model.order.push('transaction-complete');
          }, { once: true, capture: true });
          // Listener is registered BEFORE enqueue assigns request.onsuccess.
          // The same real asynchronous success event reaches shipping code next.
          request.addEventListener('success', () => {
            model.lookups++; model.withdrawn = true; model.generation++;
            model.order.push('lookup-withdrawal');
          }, { once: true });
        }
        return request;
      };
      IDBObjectStore.prototype.add = function (...args) {
        if (this.transaction === selectedTransaction) model.adds++;
        return originalAdd.apply(this, args);
      };
      IDBObjectStore.prototype.put = function (...args) {
        if (this.transaction === selectedTransaction) model.puts++;
        return originalPut.apply(this, args);
      };
      const onStatus = event => model.events.push(event.detail.status);
      window.addEventListener('memphis-scan-sync', onStatus);
      const observer = new BroadcastChannel('memphis-scan-queue-v4');
      observer.addEventListener('message', event => model.messages.push(event.data.type));
      window.__enqueueRealIdb = {
        model,
        arm() {
          if (model.activeOwners !== 0 || selectedTransaction) throw new Error('Synthetic owner has not settled.');
          model.events.length = 0; model.messages.length = 0; model.order.length = 0;
          model.armed = true;
        },
        cleanup() {
          observer.close(); window.removeEventListener('memphis-scan-sync', onStatus);
          IDBObjectStore.prototype.getAll = originalGetAll;
          IDBObjectStore.prototype.add = originalAdd;
          IDBObjectStore.prototype.put = originalPut;
        },
      };
    });
    await context.route('https://memphis-zoo-mcp.onrender.com/**', async route => {
      backendRequests++; await route.abort();
    });
    const seed = await context.newPage();
    await seed.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
    await seedQueueDatabase(seed, 4, [
      {
        id: 41, schema_version: 6, type: 'ping_device', operation_id: SESSION_ID, client_id: SESSION_ID,
        payload: { p_device_id: 'FOREIGN_ORIGINAL_PHONE', original: ['retain', 'exactly'] },
        created_at: 1785600000000, retry_count: 0, dead_letter: false, state: 'pending',
        opaque_original: { foreign: true, bytes_label: 'not authority' },
      },
      {
        id: 42, schema_version: 6, type: 'ping_device', operation_id: FINISH_SCAN_ID, client_id: FINISH_SCAN_ID,
        payload: { p_device_id: 'KIOSK_08', original: 'same original saved work' },
        created_at: 1785600000001, retry_count: 0, dead_letter: false, state: 'pending',
      },
    ]);
    await seed.close();
    page = await openHarness(context);
    expect(await page.evaluate(() => window.MemphisScanSync.ready)).toBe(true);
    await context.setOffline(true);
    expect(await page.evaluate(() => typeof navigator.locks?.request)).toBe('function');
    const preserved = await exactQueueRecords(page);

    const control = {
      type: 'record_scan_event', client_id: COMPLETION_ID,
      payload: { p_client_event_id: COMPLETION_ID, p_device_id: 'KIOSK_08', p_payload_json: { source: 'healthy original control' } },
    };
    const positiveId = await page.evaluate(action => window.MemphisScanSync.enqueue(action), control);
    expect(Number.isInteger(positiveId)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__enqueueRealIdb.model.messages
      .filter(type => type === 'queued').length)).toBe(1);
    expect(await page.evaluate(() => window.__enqueueRealIdb.model.events.filter(status => status === 'queued').length)).toBe(1);
    const before = await exactQueueRecords(page);
    expect(before.filter(row => row.id !== positiveId)).toEqual(preserved);
    expect(before.find(row => row.id === positiveId).payload).toEqual(control.payload);
    expect(await page.evaluate(() => window.__enqueueRealIdb.model.activeOwners)).toBe(0);

    await page.evaluate(() => window.__enqueueRealIdb.arm());
    const refusal = await page.evaluate(async sessionId => {
      try {
        const result = await window.MemphisScanSync.enqueue({
          type: 'record_scan_event', client_id: sessionId,
          payload: { p_client_event_id: sessionId, p_device_id: 'KIOSK_08', p_payload_json: { source: 'must not be staged' } },
        });
        return { resolved: true, result };
      } catch (error) {
        return { resolved: false, code: error.code, name: error.name };
      }
    }, '00000000-0000-4000-8000-000000000199');
    expect(refusal).toMatchObject({ resolved: false, code: 'custodial_security_generation_changed' });
    const observed = await page.evaluate(() => {
      const m = window.__enqueueRealIdb.model;
      return {
        selected: m.selected, lookups: m.lookups, adds: m.adds, puts: m.puts,
        aborts: m.aborts, completes: m.completes, activeOwners: m.activeOwners,
        order: [...m.order], events: [...m.events], messages: [...m.messages],
      };
    });
    expect(observed).toMatchObject({ selected: 1, lookups: 1, adds: 0, puts: 0, aborts: 1, completes: 0, activeOwners: 0 });
    expect(observed.order).toEqual(['lookup-withdrawal', 'transaction-abort', 'owner-closed']);
    expect(observed.events.filter(status => ['queued', 'synced', 'idle', 'retrying', 'dead-letter'].includes(status))).toEqual([]);
    expect(observed.messages.filter(type => ['queued', 'sync-complete'].includes(type))).toEqual([]);
    expect(await exactQueueRecords(page)).toEqual(before);
    expect(backendRequests).toBe(0);
  } finally {
    try {
      if (page && !page.isClosed()) await page.evaluate(() => window.__enqueueRealIdb?.cleanup());
    } finally { await context.close(); }
  }
});

test('QUEUE_RECEIPT_PUBLIC_REAL_IDB_NEW browser: public start payload lookup keeps original owner through real abort', async ({ browser }, testInfo) => {
  const context = await browser.newContext();
  let page;
  let phase = 'setup';
  let backendSchema = null;
  const requests = [];
  const snapshotId = 'b'.repeat(64);
  const employeeId = '00000000-0000-4000-8000-000000000713';
  const credentialId = '00000000-0000-4000-8000-000000000714';
  const contextId = '00000000-0000-4000-8000-000000000715';
  const occurrenceId = '00000000-0000-4000-8000-000000000716';
  const startedAt = '2026-08-13T14:00:00.000Z';
  try {
    // Synthetic current API compatibility only, never actual backend authority.
    // Bind this member to the served manifest; do not extend a predecessor TTL.
    const currentManifest = JSON.parse(readFileSync(path.join(__dirname, '..', 'frontend-release-manifest.json'), 'utf8'));
    backendSchema = currentManifest.schema_fingerprint;
    expect(backendSchema).toMatch(/^[0-9a-f]{64}$/);
    // Real worker/public APIs, IndexedDB transactions, and event dispatch.
    // Native principal/admission/attestation and HTTP answers are SYNTHETIC
    // local test fixtures, NOT Android/server authentication or ACK authority.
    await context.addInitScript(() => {
      const model = {
        generation: 7, withdrawn: false, activeOwners: 0, nextOwner: 0,
        selected: 0, lookups: 0, puts: 0, adds: 0, aborts: 0, completes: 0,
        nativeCalls: [], order: [], events: [], messages: [],
      };
      let targetId = null, targetSession = null, withdraw = false, selectNextGet = false;
      let selectedTransaction = null, selectedOwner = null, currentOwner = null;
      const originalGet = IDBObjectStore.prototype.get;
      const originalPut = IDBObjectStore.prototype.put;
      const originalAdd = IDBObjectStore.prototype.add;
      const unavailable = () => Object.assign(new Error('Synthetic original payload owner withdrawn.'), {
        code: 'custodial_security_generation_changed',
      });
      // The changed finishClaim owner now requires the normal full principal,
      // not the earlier payload-only fixture's generation shorthand. This is
      // still SYNTHETIC identity, not an Android or server authentication.
      const principal = Object.freeze({schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',
        employee_id:'00000000-0000-4000-8000-000000000713',credential_id:'00000000-0000-4000-8000-000000000714',
        credential_operation_id:'00000000-0000-4000-8000-000000000717',assignment_epoch:7,
        installation_seal:'synthetic-original-payload-owner-installation',enrolled_at:'2026-08-01T17:00:00.000Z'});
      const status = () => ({
        ready: !model.withdrawn, available: true, quarantined: model.withdrawn,
        state: 'enrolled', generation: model.generation, deviceId: 'KIOSK_08',
        principal: structuredClone(principal),
      });
      const stable = async () => { if (model.withdrawn) throw unavailable(); return status(); };
      let tail = Promise.resolve();
      window.MemphisCustodialSecurity = Object.freeze({
        native: true, getStatus: status, ensureSecurityState: stable, waitForStableState: stable,
        mutateProtectedWork(operation, options = {}) {
          const expectedGeneration = options.expectedGeneration;
          const pending = tail.then(async () => {
            const original = await stable();
            if (expectedGeneration != null && expectedGeneration !== original.generation) throw unavailable();
            let owned = true;
            const ownerId = ++model.nextOwner;
            currentOwner = ownerId; model.activeOwners++;
            const owner = Object.freeze({
              deviceId: original.deviceId, generation: original.generation, state: original.state,
              assertCurrent() {
                if (!owned || model.withdrawn || model.generation !== original.generation) throw unavailable();
              },
            });
            try { owner.assertCurrent(); return await operation(owner); }
            finally {
              owned = false; currentOwner = null; model.activeOwners--;
              if (selectedOwner === ownerId) model.order.push('owner-closed');
            }
          });
          tail = pending.catch(() => {});
          return pending;
        },
      });
      window.MemphisMobile = Object.freeze({
        nativeOfflineTimeAuthority: true,
        principalIdentity: () => JSON.stringify(principal),
        async createOfflineStartAttestation(input) {
          model.nativeCalls.push(structuredClone(input));
          if (input.clientSessionId !== targetSession || selectNextGet || selectedTransaction) {
            throw new Error('Unexpected or repeated synthetic native start transport request.');
          }
          // Existing supported transport DTO: echo the frozen original proof,
          // not a replacement owner/private worker function or fabricated receipt.
          selectNextGet = true;
          return {
            p_client_started_at: input.clientStartedAt,
            p_native_scan_entry_id: input.nativeScanEntryId,
            p_native_start_attestation_version: input.originalNativeStartAttestationVersion,
            p_native_start_attestation: input.originalNativeStartAttestation,
            p_native_start_transport_attestation_version: 'custodial-native-start-transport.v1',
            p_native_start_transport_attestation: 'e'.repeat(64),
          };
        },
      });
      IDBObjectStore.prototype.get = function (...args) {
        const request = originalGet.apply(this, args);
        if (selectNextGet && this.name === 'actions' && this.transaction.db.name === 'mz_scan_queue'
          && this.transaction.mode === 'readwrite' && args[0] === targetId) {
          selectNextGet = false; selectedTransaction = this.transaction; selectedOwner = currentOwner;
          if (selectedOwner == null) throw new Error('Payload lookup lacked its synthetic protected owner.');
          model.selected++;
          selectedTransaction.addEventListener('abort', () => {
            model.aborts++; model.order.push('transaction-abort');
          }, { once: true, capture: true });
          selectedTransaction.addEventListener('complete', () => {
            model.completes++; model.order.push('transaction-complete');
          }, { once: true, capture: true });
          // BEFORE the actual shipping request.onsuccess, on the SAME genuine
          // request/event/transaction. No mock result, replacement transaction,
          // raw private function export, or JSMap consumer.
          request.addEventListener('success', () => {
            model.lookups++; model.originalAtBoundary = structuredClone(request.result);
            if (withdraw) {
              model.withdrawn = true; model.generation++; model.order.push('lookup-withdrawal');
            } else model.order.push('lookup-current');
          }, { once: true });
        }
        return request;
      };
      IDBObjectStore.prototype.put = function (...args) {
        if (this.transaction === selectedTransaction) model.puts++;
        return originalPut.apply(this, args);
      };
      IDBObjectStore.prototype.add = function (...args) {
        if (this.transaction === selectedTransaction) model.adds++;
        return originalAdd.apply(this, args);
      };
      const onStatus = event => model.events.push({
        status: event.detail.status, operation_id: event.detail.item?.operation_id,
      });
      window.addEventListener('memphis-scan-sync', onStatus);
      const observer = new BroadcastChannel('memphis-scan-queue-v4');
      observer.addEventListener('message', event => model.messages.push(event.data.type));
      window.__receiptPublicRealIdb = {
        model,
        arm(input) {
          if (model.activeOwners !== 0) throw new Error('Previous synthetic admission has not settled.');
          targetId = input.id; targetSession = input.sessionId; withdraw = input.withdraw;
          selectedTransaction = null; selectedOwner = null; selectNextGet = false;
          for (const key of ['selected', 'lookups', 'puts', 'adds', 'aborts', 'completes']) model[key] = 0;
          model.nativeCalls.length = 0; model.order.length = 0; model.events.length = 0; model.messages.length = 0;
          delete model.originalAtBoundary;
        },
        cleanup() {
          observer.close(); window.removeEventListener('memphis-scan-sync', onStatus);
          IDBObjectStore.prototype.get = originalGet;
          IDBObjectStore.prototype.put = originalPut;
          IDBObjectStore.prototype.add = originalAdd;
        },
      };
    });
    await context.route('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', async route => {
      const request = JSON.parse(route.request().postData() || '{}');
      requests.push(request);
      if (request.fn === 'tool_report_device_sync_status_v2') return json(route, 200, { ok: true, data: {} });
      if (request.fn === 'tool_start_offline_occurrence') return json(route, 200, { ok: true, data: {
        status: 'active', client_session_id: request.args.p_client_session_id, context_id: contextId,
        occurrence_id: occurrenceId, snapshot_id: snapshotId, employee_id: employeeId,
        assignment_epoch: 7, started_at: startedAt, submission_proof: 'c'.repeat(64),
      } });
      return json(route, 422, { ok: false, error: 'Unexpected synthetic workflow RPC.' });
    });
    const seed = await context.newPage();
    await seed.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
    await seedQueueDatabase(seed, 4, [
      {
        id: 61, schema_version: 6, type: 'ping_device', operation_id: SESSION_ID, client_id: SESSION_ID,
        payload: { p_device_id: 'FOREIGN_ORIGINAL_PHONE', original: ['retained', 'unchanged'] },
        created_at: 1785600000000, retry_count: 0, dead_letter: true, state: 'dead-letter',
        opaque_original: { bytes_label: 'foreign source fixture; no authority' },
      },
      {
        id: 62, schema_version: 6, type: 'ping_device', operation_id: FINISH_SCAN_ID, client_id: FINISH_SCAN_ID,
        payload: { p_device_id: 'KIOSK_08', original: 'old retained original' },
        created_at: 1785600000001, retry_count: 0, dead_letter: true, state: 'dead-letter',
      },
    ]);
    await seed.close();
    phase = 'open-current-schema-harness';
    page = await openHarness(context, { backendSchema });
    await context.setOffline(true);
    expect(await page.evaluate(() => typeof navigator.locks?.request)).toBe('function');
    const preserved = await exactQueueRecords(page);
    const makeAction = (sessionId, scanId) => ({
      type: 'start_session', client_id: sessionId,
      payload: {
        p_client_session_id: sessionId, p_device_id: 'KIOSK_08', p_location_code: 'TETM',
        p_snapshot_id: snapshotId, p_snapshot_employee_id: employeeId, p_snapshot_assignment_epoch: 7,
        p_snapshot_credential_id: credentialId, p_native_scan_entry_id: scanId, p_client_started_at: startedAt,
        p_native_start_attestation_version: 'custodial-native-start.v1', p_native_start_attestation: 'a'.repeat(64),
      },
    });
    const positiveSession = '00000000-0000-4000-8000-000000000701';
    const positive = makeAction(positiveSession, '00000000-0000-4000-8000-000000000702');
    const positiveId = await page.evaluate(action => window.MemphisScanSync.enqueue(action), positive);
    expect(Number.isInteger(positiveId)).toBe(true);
    await page.evaluate(input => window.__receiptPublicRealIdb.arm(input), {
      id: positiveId, sessionId: positiveSession, withdraw: false,
    });
    phase = 'healthy-public-sync';
    await context.setOffline(false);
    await page.evaluate(() => window.MemphisScanSync.sync()); // same public path as the online listener
    await expect.poll(() => page.evaluate(() => window.__receiptPublicRealIdb.model.events
      .filter(event => event.status === 'idle').length)).toBeGreaterThan(0);
    phase = 'healthy-settled-assertions';
    const healthy = await page.evaluate(() => structuredClone(window.__receiptPublicRealIdb.model));
    expect(healthy).toMatchObject({ selected: 1, lookups: 1, puts: 1, adds: 0, aborts: 0, completes: 1, activeOwners: 0 });
    expect(healthy.order).toEqual(['lookup-current', 'transaction-complete', 'owner-closed']);
    expect(healthy.nativeCalls).toHaveLength(1);
    expect(healthy.originalAtBoundary.payload).toEqual(positive.payload);
    expect(healthy.events.filter(event => event.status === 'synced' && event.operation_id === positiveSession)).toHaveLength(1);
    expect(await exactQueueRecords(page)).toEqual(preserved);
    const actualStarts = requests.filter(request => request.fn === 'tool_start_offline_occurrence');
    expect(actualStarts).toHaveLength(1);
    expect(actualStarts[0].args).toEqual({
      ...positive.payload, p_native_start_transport_attestation_version: 'custodial-native-start-transport.v1',
      p_native_start_transport_attestation: 'e'.repeat(64),
    });
    expect(requests.filter(request => !['tool_start_offline_occurrence', 'tool_report_device_sync_status_v2'].includes(request.fn))).toEqual([]);

    await context.setOffline(true);
    phase = 'negative-public-enqueue';
    const negativeSession = '00000000-0000-4000-8000-000000000703';
    const negative = makeAction(negativeSession, '00000000-0000-4000-8000-000000000704');
    const negativeId = await page.evaluate(action => window.MemphisScanSync.enqueue(action), negative);
    const before = await exactQueueRecords(page);
    expect(before.filter(row => row.id !== negativeId)).toEqual(preserved);
    await page.evaluate(input => window.__receiptPublicRealIdb.arm(input), {
      id: negativeId, sessionId: negativeSession, withdraw: true,
    });
    const requestCount = requests.length;
    phase = 'withdrawn-payload-public-sync';
    await context.setOffline(false);
    await page.evaluate(() => window.MemphisScanSync.sync());
    await expect.poll(() => page.evaluate(() => {
      const model = window.__receiptPublicRealIdb.model;
      return model.aborts === 1 && model.activeOwners === 0 && model.order.includes('owner-closed')
        && model.events.some(event => event.status === 'security-paused');
    })).toBe(true);
    phase = 'withdrawn-settled-assertions';
    const refused = await page.evaluate(() => structuredClone(window.__receiptPublicRealIdb.model));
    expect(refused).toMatchObject({ selected: 1, lookups: 1, puts: 0, adds: 0, aborts: 1, completes: 0, activeOwners: 0 });
    expect(refused.order).toEqual(['lookup-withdrawal', 'transaction-abort', 'owner-closed']);
    expect(refused.nativeCalls).toHaveLength(1);
    expect(refused.originalAtBoundary.payload).toEqual(negative.payload);
    expect(refused.originalAtBoundary).toMatchObject({ id: negativeId, state: 'processing', operation_id: negativeSession });
    expect(refused.originalAtBoundary.lease_token).toEqual(expect.any(String));
    expect(refused.originalAtBoundary.lease_token.length).toBeGreaterThan(0);
    expect(refused.events.filter(event => ['synced', 'idle', 'retrying', 'dead-letter'].includes(event.status))).toEqual([]);
    expect(refused.messages.filter(type => type === 'sync-complete')).toEqual([]);
    expect(requests.slice(requestCount)).toEqual([]); // withdrawal before the work RPC, no retry/heartbeat
    const retained = await exactQueueRecords(page);
    expect(retained.filter(row => row.id !== negativeId)).toEqual(preserved);
    expect(retained.find(row => row.id === negativeId)).toEqual(refused.originalAtBoundary);
    expect(retained.find(row => row.id === negativeId).server_completion_receipt).toBeUndefined();
    expect(retained.find(row => row.id === negativeId).payload).toEqual(before.find(row => row.id === negativeId).payload);
    // Claim's normal original lease is retained, not compensated/deleted on refusal.
    // This is payload persistence qualification, NOT completion receipt/ACK proof.
  } catch (error) {
    // Preserve the original assertion. Diagnostics are SYNTHETIC fixture data,
    // best-effort read-only snapshots, never a substituted result or repair.
    const diagnostic = {
      phase, backendSchema, requests: structuredClone(requests),
      originalFailure: { name: error?.name, message: String(error?.message || error).slice(0, 4000) },
    };
    if (page && !page.isClosed()) {
      try {
        diagnostic.model = await page.evaluate(() => structuredClone(window.__receiptPublicRealIdb?.model || null));
      } catch (snapshotError) { diagnostic.modelSnapshotError = snapshotError?.name || 'unavailable'; }
      try { diagnostic.queue = await exactQueueRecords(page); }
      catch (snapshotError) { diagnostic.queueSnapshotError = snapshotError?.name || 'unavailable'; }
    } else diagnostic.pageUnavailable = true;
    try {
      await testInfo.attach('queue-receipt-public-real-idb-failure', {
        body: Buffer.from(JSON.stringify(diagnostic, null, 2)), contentType: 'application/json',
      });
    } catch (_attachmentError) {
      console.error('QUEUE_RECEIPT_PUBLIC_REAL_IDB_NEW diagnostic attachment unavailable.');
    }
    throw error;
  } finally {
    try {
      if (page && !page.isClosed()) await page.evaluate(() => window.__receiptPublicRealIdb?.cleanup());
    } finally { await context.close(); }
  }
});


test('INTERRUPTED_START_PUBLIC_REAL_IDB_NEW browser: canonical archive precedes retirement and withdrawal retains originals', async ({ browser }, testInfo) => {
  const context = await browser.newContext();
  let page, phase = 'setup';
  const backendRequests = [];
  try {
    const manifest = JSON.parse(readFileSync(path.join(__dirname, '..', 'frontend-release-manifest.json'), 'utf8'));
    expect(manifest.schema_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    await context.addInitScript(() => {
      // Full structural SYNTHETIC principal and private identity model. This
      // is NOT enrollment/native authentication, approval, ACK or key authority.
      const principal = Object.freeze({
        schema_version: 'custodial-protected-principal.v1', device_id: 'KIOSK_08',
        employee_id: '00000000-0000-4000-8000-000000000813',
        credential_id: '00000000-0000-4000-8000-000000000814',
        credential_operation_id: '00000000-0000-4000-8000-000000000815',
        assignment_epoch: 7, installation_seal: 'SYNTHETIC_ORIGINAL_INSTALLATION_SEAL_08',
        enrolled_at: '2026-08-13T13:00:00.000Z',
      });
      const identity = JSON.stringify(principal);
      const model = {
        generation: 7, withdrawn: false, activeOwners: 0, nextOwner: 0,
        selected: 0, lookups: 0, deletes: 0, allDeletes: 0, deleteBeforeArchive: 0,
        puts: 0, aborts: 0, completes: 0, archiveCalls: 0, order: [], events: [],
      };
      let activePhase = false, withdraw = false, selectNextGetAll = false;
      let targetSession = null, archiveKey = null, selectedTransaction = null, selectedOwner = null, currentOwner = null;
      const originalGetAll = IDBObjectStore.prototype.getAll;
      const originalDelete = IDBObjectStore.prototype.delete;
      const originalPut = IDBObjectStore.prototype.put;
      const unavailable = () => Object.assign(new Error('Synthetic original retirement owner withdrawn.'), {
        code: 'custodial_security_generation_changed',
      });
      const status = () => ({
        ready: !model.withdrawn, available: true, quarantined: model.withdrawn,
        state: 'enrolled', generation: model.generation, deviceId: principal.device_id, principal,
      });
      const stable = async () => { if (model.withdrawn) throw unavailable(); return status(); };
      let tail = Promise.resolve();
      window.MemphisCustodialSecurity = Object.freeze({
        native: true, getStatus: status, ensureSecurityState: stable, waitForStableState: stable,
        mutateProtectedWork(operation, options = {}) {
          const expectedGeneration = options.expectedGeneration;
          const pending = tail.then(async () => {
            const original = await stable();
            if (expectedGeneration != null && expectedGeneration !== original.generation) throw unavailable();
            let owned = true;
            const ownerId = ++model.nextOwner;
            currentOwner = ownerId; model.activeOwners++;
            const owner = Object.freeze({
              deviceId: original.deviceId, generation: original.generation, state: original.state,
              assertCurrent() {
                if (!owned || model.withdrawn || model.generation !== original.generation
                  || status().principal !== original.principal) throw unavailable();
              },
            });
            try { owner.assertCurrent(); return await operation(owner); }
            finally {
              owned = false; currentOwner = null; model.activeOwners--;
              if (selectedOwner === ownerId) model.order.push('owner-closed');
            }
          });
          tail = pending.catch(() => {});
          return pending;
        },
      });
      window.MemphisMobile = Object.freeze({ principalIdentity: () => identity });
      IDBObjectStore.prototype.getAll = function (...args) {
        const request = originalGetAll.apply(this, args);
        if (selectNextGetAll && this.name === 'actions' && this.transaction.db.name === 'mz_scan_queue'
          && this.transaction.mode === 'readwrite') {
          selectNextGetAll = false; selectedTransaction = this.transaction; selectedOwner = currentOwner;
          if (selectedOwner == null) throw new Error('Retirement lookup has no synthetic original owner.');
          model.selected++;
          selectedTransaction.addEventListener('abort', () => {
            model.aborts++; model.order.push('transaction-abort');
          }, { once: true, capture: true });
          selectedTransaction.addEventListener('complete', () => {
            model.completes++; model.order.push('transaction-complete');
          }, { once: true, capture: true });
          request.addEventListener('success', () => {
            // Same real request/event; listener runs BEFORE shipping onsuccess.
            // Observe actual bytes/rows, never replace them or the transaction.
            model.lookups++; model.rawRowsAtBoundary = structuredClone(request.result);
            if (withdraw) {
              model.withdrawn = true; model.generation++; model.order.push('lookup-withdrawal');
            } else model.order.push('lookup-current');
          }, { once: true });
        }
        return request;
      };
      IDBObjectStore.prototype.delete = function (...args) {
        if (activePhase && this.name === 'actions' && this.transaction.db.name === 'mz_scan_queue') {
          model.allDeletes++;
          if (!model.archiveCanonical || localStorage.getItem(archiveKey) !== model.archiveCanonical) model.deleteBeforeArchive++;
          if (this.transaction === selectedTransaction) { model.deletes++; model.order.push('delete'); }
        }
        return originalDelete.apply(this, args);
      };
      IDBObjectStore.prototype.put = function (...args) {
        if (activePhase && this.name === 'actions' && this.transaction.db.name === 'mz_scan_queue') model.puts++;
        return originalPut.apply(this, args);
      };
      const onStatus = event => model.events.push(event.detail.status);
      window.addEventListener('memphis-scan-sync', onStatus);
      window.__interruptedStartRealIdb = {
        model,
        arm(input) {
          if (model.activeOwners !== 0 || model.withdrawn) throw new Error('Previous synthetic owner has not settled.');
          activePhase = true; withdraw = input.withdraw; targetSession = input.sessionId; archiveKey = input.archiveKey;
          selectedTransaction = null; selectedOwner = null; selectNextGetAll = false;
          for (const key of ['selected', 'lookups', 'deletes', 'allDeletes', 'deleteBeforeArchive', 'puts', 'aborts', 'completes', 'archiveCalls']) model[key] = 0;
          model.order.length = 0; model.events.length = 0;
          delete model.rawRowsAtBoundary; delete model.archiveCanonical;
        },
        archiveVerified(sessionId, canonical) {
          // Observation arm only. Production independently verifies the callback
          // return/canonical archive and all original-owner guards.
          if (sessionId !== targetSession || localStorage.getItem(archiveKey) !== canonical) throw new Error('Synthetic archive readback mismatch.');
          model.archiveCalls++; model.archiveCanonical = canonical;
          model.order.push('archive-verified'); selectNextGetAll = true;
        },
        disarm() { activePhase = false; },
        cleanup() {
          window.removeEventListener('memphis-scan-sync', onStatus);
          IDBObjectStore.prototype.getAll = originalGetAll;
          IDBObjectStore.prototype.delete = originalDelete;
          IDBObjectStore.prototype.put = originalPut;
        },
      };
    });
    await context.route('https://memphis-zoo-mcp.onrender.com/**', async route => {
      backendRequests.push({ url: route.request().url(), method: route.request().method() });
      await route.abort();
    });
    const seed = await context.newPage();
    await seed.goto('/frontend-release-manifest.json', { waitUntil: 'commit' });
    await seedQueueDatabase(seed, 4, [
      { id: 81, schema_version: 6, type: 'ping_device', operation_id: SESSION_ID, client_id: SESSION_ID,
        payload: { p_device_id: 'FOREIGN_ORIGINAL_PHONE', original: ['keep', 'unchanged'] },
        created_at: 1785600000000, retry_count: 0, dead_letter: true, state: 'dead-letter',
        opaque_original: { source_only: 'foreign original retained; no authority' } },
      { id: 82, schema_version: 6, type: 'ping_device', operation_id: FINISH_SCAN_ID, client_id: FINISH_SCAN_ID,
        payload: { p_device_id: 'KIOSK_08', original: 'old retained original' },
        created_at: 1785600000001, retry_count: 0, dead_letter: true, state: 'dead-letter' },
    ]);
    await seed.close();
    page = await openHarness(context, { backendSchema: manifest.schema_fingerprint });
    expect(await page.evaluate(() => typeof navigator.locks?.request)).toBe('function');
    const identityCheck = await page.evaluate(async () => {
      const { protectedPrincipal, principalIdentity } = await import('/mobile/src/custodial/protected-principal.js');
      const current = window.MemphisCustodialSecurity.getStatus();
      return { principal: protectedPrincipal(current.principal), identity: principalIdentity(current.principal),
        privateIdentity: window.MemphisMobile.principalIdentity(), generation: current.generation, deviceId: current.deviceId };
    });
    expect(identityCheck.principal).not.toBeNull();
    expect(identityCheck.identity).toBe(identityCheck.privateIdentity);
    expect(identityCheck).toMatchObject({ generation: 7, deviceId: 'KIOSK_08' });
    // Load/validate the ordinary module before offline mode; all original
    // enqueue/archive/retirement work below must execute offline.
    await context.setOffline(true);
    const preserved = await exactQueueRecords(page);
    const action = sessionId => ({
      type: 'start_session', client_id: sessionId,
      payload: {
        p_client_session_id: sessionId, p_device_id: 'KIOSK_08', p_location_code: 'TETM',
        p_snapshot_id: 'b'.repeat(64), p_snapshot_employee_id: '00000000-0000-4000-8000-000000000813',
        p_snapshot_credential_id: '00000000-0000-4000-8000-000000000814', p_snapshot_assignment_epoch: 7,
        p_native_scan_entry_id: '00000000-0000-4000-8000-000000000816',
        p_client_started_at: '2026-08-13T14:00:00.000Z',
        p_native_start_attestation_version: 'custodial-native-start.v1', p_native_start_attestation: 'a'.repeat(64),
      },
    });
    const retire = async input => page.evaluate(async ({ sessionId, archiveKey, captureFailure = false }) => {
      return window.MemphisScanSync.retirePreservedInterruptedStart(sessionId, async (actions, evidence) => {
        const canonical = value => Array.isArray(value) ? value.map(canonical)
          : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
        const expected = JSON.stringify(canonical([...actions].sort((a, b) => Number(a.id) - Number(b.id))));
        if (evidence.contract_version !== 'custodial-interrupted-start-preservation.v1'
          || evidence.session_uuid !== sessionId || evidence.canonical_actions !== expected) throw new Error('Exact original archive input mismatch.');
        localStorage.setItem(archiveKey, evidence.canonical_actions);
        const saved = localStorage.getItem(archiveKey);
        if (saved !== evidence.canonical_actions) throw new Error('Original archive storage readback mismatch.');
        window.__interruptedStartRealIdb.archiveVerified(sessionId, saved);
        return { preserved: true, canonical_actions: saved };
      }).catch(error => {
        if (!captureFailure) throw error;
        // Observe the real public rejection, not a replacement result/API.
        return { resolved: false, code: error.code, message: error.message };
      });
    }, input);

    phase = 'healthy-original-enqueue';
    const healthySession = '00000000-0000-4000-8000-000000000801';
    const healthyKey = '__source_interrupted_start_original_801';
    const healthyId = await page.evaluate(value => window.MemphisScanSync.enqueue(value), action(healthySession));
    const healthyActions = await page.evaluate(sessionId => window.MemphisScanSync.listActions()
      .then(rows => rows.filter(row => row.operation_id === sessionId)), healthySession);
    expect(healthyActions).toHaveLength(1);
    await page.evaluate(input => window.__interruptedStartRealIdb.arm(input), { sessionId: healthySession, archiveKey: healthyKey, withdraw: false });
    phase = 'healthy-public-retirement';
    const healthyResult = await retire({ sessionId: healthySession, archiveKey: healthyKey });
    expect(healthyResult).toEqual({
      contract_version: 'custodial-interrupted-start-retirement.v1', session_uuid: healthySession,
      preserved_action_count: 1, retired_action_count: 1, already_absent: false,
    });
    const healthy = await page.evaluate(() => structuredClone(window.__interruptedStartRealIdb.model));
    expect(healthy).toMatchObject({ archiveCalls: 1, selected: 1, lookups: 1, deletes: 1,
      allDeletes: 1, deleteBeforeArchive: 0, puts: 0, aborts: 0, completes: 1, activeOwners: 0 });
    expect(healthy.order).toEqual(['archive-verified', 'lookup-current', 'delete', 'transaction-complete', 'owner-closed']);
    expect(healthy.rawRowsAtBoundary.find(row => row.id === healthyId).payload).toEqual(action(healthySession).payload);
    expect(await exactQueueRecords(page)).toEqual(preserved);
    const healthyArchive = await page.evaluate(key => localStorage.getItem(key), healthyKey);
    expect(healthyArchive).toBe(healthy.archiveCanonical);
    expect(JSON.parse(healthyArchive)).toEqual(healthyActions);
    await page.evaluate(() => window.__interruptedStartRealIdb.disarm());

    phase = 'withdrawn-original-enqueue';
    const negativeSession = '00000000-0000-4000-8000-000000000803';
    const negativeKey = '__source_interrupted_start_original_803';
    const negativeId = await page.evaluate(value => window.MemphisScanSync.enqueue(value), action(negativeSession));
    const before = await exactQueueRecords(page);
    expect(before.filter(row => row.id !== negativeId)).toEqual(preserved);
    const negativeActions = await page.evaluate(sessionId => window.MemphisScanSync.listActions()
      .then(rows => rows.filter(row => row.operation_id === sessionId)), negativeSession);
    await page.evaluate(input => window.__interruptedStartRealIdb.arm(input), { sessionId: negativeSession, archiveKey: negativeKey, withdraw: true });
    phase = 'withdrawn-public-retirement';
    const refusal = await retire({ sessionId: negativeSession, archiveKey: negativeKey, captureFailure: true });
    expect(refusal).toMatchObject({ resolved: false, code: 'custodial_security_state_unavailable' });
    const refused = await page.evaluate(() => structuredClone(window.__interruptedStartRealIdb.model));
    expect(refused).toMatchObject({ archiveCalls: 1, selected: 1, lookups: 1, deletes: 0,
      allDeletes: 0, deleteBeforeArchive: 0, puts: 0, aborts: 1, completes: 0, activeOwners: 0 });
    expect(refused.order).toEqual(['archive-verified', 'lookup-withdrawal', 'transaction-abort', 'owner-closed']);
    expect(refused.rawRowsAtBoundary).toEqual(before);
    expect(await exactQueueRecords(page)).toEqual(before);
    const retainedArchive = await page.evaluate(key => localStorage.getItem(key), negativeKey);
    expect(retainedArchive).toBe(refused.archiveCanonical);
    expect(JSON.parse(retainedArchive)).toEqual(negativeActions);
    expect(await page.evaluate(key => localStorage.getItem(key), healthyKey)).toBe(healthyArchive);
    expect(refused.events.filter(status => ['synced', 'idle', 'retrying', 'dead-letter'].includes(status))).toEqual([]);
    expect(backendRequests).toEqual([]); // compatibility version is the explicit current synthetic route only
  } catch (error) {
    const diagnostic = { phase, backendRequests, originalFailure: String(error?.message || error).slice(0, 4000) };
    if (page && !page.isClosed()) {
      try { diagnostic.model = await page.evaluate(() => structuredClone(window.__interruptedStartRealIdb?.model || null)); } catch (_error) {}
      try { diagnostic.queue = await exactQueueRecords(page); } catch (_error) {}
    }
    try { await testInfo.attach('interrupted-start-public-real-idb-failure', {
      body: Buffer.from(JSON.stringify(diagnostic, null, 2)), contentType: 'application/json',
    }); } catch (_error) { console.error('Interrupted-start synthetic fixture diagnostic unavailable.'); }
    throw error;
  } finally {
    try { if (page && !page.isClosed()) await page.evaluate(() => window.__interruptedStartRealIdb?.cleanup()); }
    finally { await context.close(); }
  }
});

test('DEAD_LETTER_PUBLIC_REAL_IDB_NEW browser: original recovery readback and direct abort retain one owner', async ({ browser }, testInfo) => {
  // Only this NEW member is selected. Actual public worker + real IndexedDB;
  // native status/FIFO/principal and HTTP compatibility are SYNTHETIC, not
  // enrollment, authentication, server acceptance, replay, ACK or key authority.
  const manifest = JSON.parse(readFileSync(path.join(__dirname, '..', 'frontend-release-manifest.json'), 'utf8'));
  expect(manifest.schema_fingerprint).toMatch(/^[a-f0-9]{64}$/);
  const phases = ['single-healthy', 'single-generation-loss', 'single-principal-loss', 'batch-healthy', 'batch-after-list-loss'];
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const originalRow = (id, suffix, { device = 'KIOSK_08', employee = '00000000-0000-4000-8000-000000000913',
    credential = '00000000-0000-4000-8000-000000000914' } = {}) => {
    const operation = `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
    const payload = { p_device_id: device, p_client_session_id: SESSION_ID, p_client_completion_id: operation,
      p_snapshot_id: 'b'.repeat(64), p_snapshot_employee_id: employee,
      p_snapshot_credential_id: credential, p_snapshot_assignment_epoch: 7,
      p_response_json: { answers: ['exact original', suffix], note: 'retained, never resubmitted by this test' } };
    const fingerprint = `canonical:${JSON.stringify(canonical(payload))}`, logicalKey = `commit_workflow:${operation}:${fingerprint}`;
    const receipt = { schema_version: 'server-completion-receipt.v1', operation_id: operation,
      logical_key: logicalKey, semantic_fingerprint: fingerprint, result: { status: 'unknown', source_fixture_only: true } };
    // A consistency hash is not an authenticated/accepted server receipt.
    receipt.integrity_sha256 = createHash('sha256').update(JSON.stringify(canonical(receipt))).digest('hex');
    return { id, schema_version: 6, type: 'forward-replay-fenced:commit_workflow', forward_action_type: 'commit_workflow',
      forward_replay_contract: 'scan.v4.snapshot-bound-authority', operation_id: operation, client_id: operation,
      logical_identity: operation, completion_client_id: operation, semantic_fingerprint: fingerprint, logical_key: logicalKey,
      payload, replay_binding: { client_session_id: SESSION_ID, client_completion_id: operation, occurrence_id: '', context_id: '',
        snapshot_id: 'b'.repeat(64), employee_id: payload.p_snapshot_employee_id, assignment_epoch: 7 },
      created_at: 1785600000000 + id, retry_count: 4, last_error: 'original unknown outcome', last_attempt_at: 1785600000000,
      next_attempt_at: 1785600060000, recoverable: true, dead_letter: true, current_dead_letter: true, state: 'dead-letter',
      lease_owner: null, lease_token: null, lease_until: 0, server_completion_receipt: receipt,
      original_attempt_history: [{ at: '2026-08-01T12:00:00.000Z', outcome: 'unconfirmed', opaque: ['preserve', id] }] };
  };
  const replacement = raw => ({ ...raw, forward_replay_contract: 'scan.v4.snapshot-bound-authority',
    forward_action_type: 'commit_workflow', type: 'forward-replay-fenced:commit_workflow', dead_letter: true,
    current_dead_letter: false, state: 'reconciliation-required', next_attempt_at: 0,
    lease_owner: null, lease_token: null, lease_until: 0 });
  for (const phase of phases) {
    const context = await browser.newContext(); let page;
    const unexpectedRequests = [];
    try {
      await context.addInitScript(() => {
        const principal = Object.freeze({ schema_version: 'custodial-protected-principal.v1', device_id: 'KIOSK_08',
          employee_id: '00000000-0000-4000-8000-000000000913', credential_id: '00000000-0000-4000-8000-000000000914',
          credential_operation_id: '00000000-0000-4000-8000-000000000915', assignment_epoch: 7,
          installation_seal: 'SYNTHETIC_ORIGINAL_DEAD_LETTER_INSTALLATION_08', enrolled_at: '2026-08-01T17:00:00.000Z' });
        const model = { generation: 7, principal, activeOwners: 0, nextOwner: 0, maximumOwners: 0,
          ownerIds: [], closedCheckpoints: 0, selected: 0, targetReads: [], rawReads: [], allTerminals: [], puts: [], deletes: 0, databaseDeletes: 0,
          aborts: 0, completes: 0, scheduleRequests: 0, order: [], terminalOwners: [], events: [] };
        let active = false, phase = '', targetId = null, currentOwner = null, selectedOwner = null, selectedTx = null;
        const get = IDBObjectStore.prototype.get, getAll = IDBObjectStore.prototype.getAll;
        const put = IDBObjectStore.prototype.put, remove = IDBObjectStore.prototype.delete;
        const removeDatabase = IDBFactory.prototype.deleteDatabase, timeout = window.setTimeout;
        const status = () => ({ ready: true, available: true, quarantined: false, state: 'enrolled',
          generation: model.generation, deviceId: 'KIOSK_08', principal: model.principal });
        const stable = async () => status();
        const unavailable = () => Object.assign(new Error('Synthetic original dead-letter owner changed.'), { code: 'custodial_security_generation_changed' });
        let tail = Promise.resolve();
        window.MemphisCustodialSecurity = Object.freeze({ native: true, getStatus: status,
          ensureSecurityState: stable, waitForStableState: stable,
          mutateProtectedWork(operation, options = {}) {
            const pending = tail.then(async () => {
              const original = await stable(), identity = JSON.stringify(original.principal);
              if (options.expectedGeneration != null && options.expectedGeneration !== original.generation) throw unavailable();
              const id = ++model.nextOwner; let open = true;
              currentOwner = id; model.activeOwners++; model.maximumOwners = Math.max(model.maximumOwners, model.activeOwners);
              if (active) model.ownerIds.push(id);
              const owner = Object.freeze({ deviceId: original.deviceId, generation: original.generation, state: original.state,
                assertCurrent() {
                  if (!open) model.closedCheckpoints++;
                  if (!open || model.generation !== original.generation || JSON.stringify(model.principal) !== identity) throw unavailable();
                } });
              try { owner.assertCurrent(); return await operation(owner); }
              finally { open = false; currentOwner = null; model.activeOwners--; if (active) model.order.push('owner-closed'); }
            });
            tail = pending.catch(() => {}); return pending;
          } });
        window.MemphisMobile = Object.freeze({ principalIdentity: () => JSON.stringify(model.principal) });
        const withdraw = kind => {
          if (kind === 'principal') model.principal = Object.freeze({ ...principal, credential_id: '00000000-0000-4000-8000-000000000994' });
          else model.generation++;
          model.order.push(kind + '-withdrawal');
        };
        const watched = new WeakSet();
        const watchOwnedTerminal = tx => {
          if (watched.has(tx)) return; watched.add(tx); const owner = currentOwner;
          if (owner == null) throw new Error('Recovery read/write transaction lacks its original FIFO owner.');
          for (const type of ['complete', 'abort']) {
            tx.addEventListener(type, event => {
              if (event.target !== tx) return;
              model.allTerminals.push({ type, point: 'direct', owner, active: model.activeOwners });
              queueMicrotask(() => model.allTerminals.push({ type, point: 'microtask', owner, active: model.activeOwners }));
            }, { once: true, capture: true });
            tx.addEventListener(type, event => {
              if (event.target === tx) model.allTerminals.push({ type, point: 'late-listener', owner, active: model.activeOwners });
            }, { once: true });
          }
        };
        const observeTerminal = tx => {
          selectedTx = tx; selectedOwner = currentOwner; model.selected++;
          if (selectedOwner == null) throw new Error('Real recovery transaction lacks its synthetic FIFO owner.');
          for (const type of ['abort', 'complete']) {
            tx.addEventListener(type, event => {
              if (event.target !== tx) return;
              model[type === 'abort' ? 'aborts' : 'completes']++;
              model.order.push('transaction-' + type); model.terminalOwners.push({ type, point: 'direct', active: model.activeOwners });
              queueMicrotask(() => { model.order.push(type + '-microtask'); model.terminalOwners.push({ type, point: 'microtask', active: model.activeOwners }); });
            }, { once: true, capture: true });
            tx.addEventListener(type, event => {
              if (event.target !== tx) return;
              model.order.push(type + '-late-listener'); model.terminalOwners.push({ type, point: 'late-listener', active: model.activeOwners });
            }, { once: true });
          }
        };
        IDBObjectStore.prototype.get = function (...args) {
          const request = get.apply(this, args), tx = this.transaction;
          if (active && this.name === 'actions' && tx.db.name === 'mz_scan_queue') {
            watchOwnedTerminal(tx);
            request.addEventListener('success', () => model.rawReads.push({ mode: tx.mode, owner: currentOwner,
              row: structuredClone(request.result) }), { once: true });
            if (args[0] === targetId) model.targetReads.push({ mode: tx.mode, owner: currentOwner });
            if (tx.mode === 'readwrite' && args[0] === targetId && !selectedTx) {
              observeTerminal(tx);
              request.addEventListener('success', () => {
                model.originalAtBoundary = structuredClone(request.result); model.order.push('lookup-success');
                if (phase === 'single-generation-loss') withdraw('generation');
                if (phase === 'single-principal-loss') withdraw('principal');
              }, { once: true }); // same actual request BEFORE shipping onsuccess
            }
          }
          return request;
        };
        IDBObjectStore.prototype.getAll = function (...args) {
          const request = getAll.apply(this, args), tx = this.transaction;
          if (active && phase === 'batch-after-list-loss' && this.name === 'actions'
            && tx.db.name === 'mz_scan_queue' && tx.mode === 'readonly' && !selectedTx) {
            watchOwnedTerminal(tx);
            observeTerminal(tx);
            request.addEventListener('success', () => {
              model.listedOriginals = structuredClone(request.result); model.order.push('list-success');
            }, { once: true });
            // Registered AFTER shipping tx.oncomplete. Withdrawal is after the
            // genuine list and shipping direct terminal handler, but before
            // its normal-next-task settlement. No replaced result or event.
            tx.addEventListener('complete', event => { if (event.target === tx) withdraw('generation'); }, { once: true });
          }
          return request;
        };
        IDBObjectStore.prototype.put = function (...args) {
          if (active && this.name === 'actions' && this.transaction.db.name === 'mz_scan_queue')
            model.puts.push({ row: structuredClone(args[0]), owner: currentOwner });
          return put.apply(this, args);
        };
        IDBObjectStore.prototype.delete = function (...args) {
          if (active && this.name === 'actions' && this.transaction.db.name === 'mz_scan_queue') model.deletes++;
          return remove.apply(this, args);
        };
        IDBFactory.prototype.deleteDatabase = function (...args) { if (active) model.databaseDeletes++; return removeDatabase.apply(this, args); };
        window.setTimeout = function (callback, ...args) {
          if (active && typeof callback === 'function' && Function.prototype.toString.call(callback).includes('state.scheduledSyncTimer = null')) model.scheduleRequests++;
          return timeout.call(this, callback, ...args); // observe only; no timer replacement/suppression
        };
        const onStatus = event => { if (active) model.events.push(event.detail.status); };
        window.addEventListener('memphis-scan-sync', onStatus);
        window.__deadLetterRealIdb = { model,
          arm(value) {
            if (model.activeOwners !== 0) throw new Error('Original initialization owner is still active.');
            phase = value.phase; targetId = value.targetId; active = true;
          },
          settled(resolved) { model.order.push(resolved ? 'public-resolved' : 'public-rejected'); },
          cleanup() {
            active = false; window.removeEventListener('memphis-scan-sync', onStatus);
            IDBObjectStore.prototype.get = get; IDBObjectStore.prototype.getAll = getAll;
            IDBObjectStore.prototype.put = put; IDBObjectStore.prototype.delete = remove;
            IDBFactory.prototype.deleteDatabase = removeDatabase; window.setTimeout = timeout;
          } };
      });
      await context.route('https://memphis-zoo-mcp.onrender.com/**', async route => {
        unexpectedRequests.push({ url: route.request().url(), method: route.request().method() }); await route.abort();
      });
      page = await openHarness(context, { backendSchema: manifest.schema_fingerprint });
      expect(await page.evaluate(() => window.MemphisScanSync.ready)).toBe(true);
      expect(await page.evaluate(() => window.MemphisScanSync.queueSchemaVersion)).toBe(6);
      const identity = await page.evaluate(async () => {
        const { protectedPrincipal, principalIdentity } = await import('/mobile/src/custodial/protected-principal.js');
        const status = window.MemphisCustodialSecurity.getStatus();
        return { principal: protectedPrincipal(status.principal), identity: principalIdentity(status.principal),
          privateIdentity: window.MemphisMobile.principalIdentity(), deviceId: status.deviceId, generation: status.generation };
      });
      expect(identity.principal).not.toBeNull(); expect(identity.identity).toBe(identity.privateIdentity);
      expect(identity).toMatchObject({ deviceId: 'KIOSK_08', generation: 7 });
      await context.setOffline(true);
      const first = originalRow(91, 921), second = originalRow(92, 922);
      const pending = { ...originalRow(93, 923), current_dead_letter: false, state: 'pending', retry_count: 0 };
      const foreign = { ...originalRow(94, 924, { device: 'KIOSK_09', employee: '00000000-0000-4000-8000-000000000993',
        credential: '00000000-0000-4000-8000-000000000994' }), recoverable: false, state: 'legacy-quarantine' };
      // Foreign/unknown work is explicitly noneligible, NOT rewritten/adopted
      // to satisfy batch's normal current-principal eligibility predicate.
      const originals = [first, second, pending, foreign];
      await page.evaluate(values => new Promise((resolve, reject) => {
        const opening = indexedDB.open('mz_scan_queue');
        opening.onupgradeneeded = () => { opening.transaction.abort(); reject(new Error('Expected existing normal queue schema.')); };
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const db = opening.result, tx = db.transaction('actions', 'readwrite');
          for (const row of values) tx.objectStore('actions').put(row);
          tx.oncomplete = event => { if (event.target === tx) { db.close(); resolve(); } };
          tx.onabort = () => { db.close(); reject(tx.error || new Error('Original fixture seeding aborted.')); };
          tx.onerror = () => {}; // direct abort is the terminal error boundary
        };
      }), originals);
      const before = await exactQueueRecords(page);
      expect(JSON.stringify(before)).toBe(JSON.stringify(originals));
      const databasesBefore = await page.evaluate(() => indexedDB.databases().then(rows => rows.map(({ name, version }) => ({ name, version })).sort((a, b) => a.name.localeCompare(b.name))));
      await page.evaluate(value => window.__deadLetterRealIdb.arm(value), { phase, targetId: first.id });
      const outcome = await page.evaluate(async ({ phase, id }) => {
        try {
          const result = phase.startsWith('batch') ? await window.MemphisScanSync.recoverAllDeadLetters()
            : await window.MemphisScanSync.recoverDeadLetter(id, { syncAfter: false });
          window.__deadLetterRealIdb.settled(true); return { resolved: true, result };
        } catch (error) {
          window.__deadLetterRealIdb.settled(false); return { resolved: false, code: error.code, message: error.message };
        }
      }, { phase, id: first.id });
      const model = await page.evaluate(() => structuredClone(window.__deadLetterRealIdb.model));
      const after = await exactQueueRecords(page);
      expect(model.activeOwners).toBe(0); expect(model.maximumOwners).toBe(1); expect(model.ownerIds).toHaveLength(1);
      expect(model.closedCheckpoints).toBe(0); expect(model.deletes).toBe(0); expect(model.databaseDeletes).toBe(0);
      expect(model.puts.every(write => write.owner === model.ownerIds[0])).toBe(true);
      expect(model.allTerminals.length).toBeGreaterThan(0);
      expect(model.allTerminals.every(point => point.active === 1 && point.owner === model.ownerIds[0])).toBe(true);
      expect(model.allTerminals).toHaveLength(phase === 'single-healthy' ? 9 : phase === 'batch-healthy' ? 12
        : phase === 'batch-after-list-loss' ? 3 : 6);
      expect(model.terminalOwners).toHaveLength(3);
      expect(model.terminalOwners.every(point => point.active === 1)).toBe(true);
      expect(model.events.filter(value => ['queued', 'synced', 'retrying', 'dead-letter', 'receipt-retention-pending'].includes(value))).toEqual([]);
      if (phase === 'single-healthy' || phase === 'batch-healthy') {
        expect(outcome).toEqual({ resolved: true, result: phase === 'single-healthy' ? true : 2 });
        expect(model.puts.map(write => write.row)).toEqual(phase === 'single-healthy' ? [replacement(first)] : [replacement(first), replacement(second)]);
        expect(after).toEqual(phase === 'single-healthy' ? [replacement(first), second, pending, foreign]
          : [replacement(first), replacement(second), pending, foreign]);
        expect(JSON.stringify(after.slice(2))).toBe(JSON.stringify(before.slice(2)));
        expect(model.targetReads.map(read => read.mode)).toEqual(phase === 'single-healthy' ? ['readonly', 'readwrite', 'readonly'] : ['readwrite', 'readonly']);
        expect(new Set(model.targetReads.map(read => read.owner))).toEqual(new Set(model.ownerIds));
        expect(model.rawReads.filter(read => read.mode === 'readonly' && read.row?.current_dead_letter === false)
          .map(read => read.row)).toEqual(phase === 'single-healthy' ? [replacement(first)] : [replacement(first), replacement(second)]);
        expect(model.scheduleRequests).toBe(phase === 'single-healthy' ? 0 : 1);
        expect(model.order.at(-1)).toBe('public-resolved');
      } else {
        expect(outcome.resolved).toBe(false); expect(outcome.code).toBe('custodial_security_state_unavailable');
        expect(JSON.stringify(after)).toBe(JSON.stringify(before)); expect(model.puts).toEqual([]); expect(model.scheduleRequests).toBe(0);
        expect(model.selected).toBe(1);
        const closedAt = model.order.indexOf('owner-closed'); expect(closedAt).toBeGreaterThan(0);
        if (phase.startsWith('single')) {
          expect(model.targetReads.map(read => read.mode)).toEqual(['readonly', 'readwrite']);
          expect(model.originalAtBoundary).toEqual(first); expect(model.aborts).toBe(1); expect(model.completes).toBe(0);
          for (const event of ['transaction-abort', 'abort-microtask', 'abort-late-listener']) {
            expect(model.order.indexOf(event)).toBeGreaterThanOrEqual(0); expect(closedAt).toBeGreaterThan(model.order.indexOf(event));
          }
        } else {
          expect(model.listedOriginals).toEqual(before); expect(model.targetReads).toEqual([]);
          expect(model.completes).toBe(1); expect(model.aborts).toBe(0);
          for (const event of ['list-success', 'transaction-complete', 'complete-microtask', 'complete-late-listener', 'generation-withdrawal']) {
            expect(model.order.indexOf(event)).toBeGreaterThanOrEqual(0); expect(closedAt).toBeGreaterThan(model.order.indexOf(event));
          }
        }
        expect(model.order.at(-1)).toBe('public-rejected');
      }
      expect(await page.evaluate(() => indexedDB.databases().then(rows => rows.map(({ name, version }) => ({ name, version })).sort((a, b) => a.name.localeCompare(b.name))))).toEqual(databasesBefore);
      expect(unexpectedRequests).toEqual([]); // only fully intercepted compatibility may run
    } catch (error) {
      const diagnostic = { phase, unexpectedRequests, firstFailure: String(error?.message || error).slice(0, 4000) };
      if (page && !page.isClosed()) {
        try { diagnostic.model = await page.evaluate(() => structuredClone(window.__deadLetterRealIdb?.model || null)); } catch (_) {}
        try { diagnostic.rows = await exactQueueRecords(page); } catch (_) {}
      }
      try { await testInfo.attach('dead-letter-public-real-idb-failure', { body: Buffer.from(JSON.stringify(diagnostic, null, 2)), contentType: 'application/json' }); }
      catch (_) { console.error('Dead-letter real-IDB diagnostic attachment unavailable.'); }
      throw error;
    } finally {
      try { if (page && !page.isClosed()) await page.evaluate(() => window.__deadLetterRealIdb?.cleanup()); }
      finally { await context.close(); }
    }
  }
});

test('QUEUE_ENQUEUE_OWNED_NEW source: deferred enqueue retains original owner through settlement', queueEnqueueOwnedBoundarySourceCase);
test('QUEUE_ENQUEUE_TERMINAL_NEW source: direct terminal dispatch precedes owned settlement', queueEnqueueTerminalSettlementSourceCase);
test('QUEUE_CLAIM_ORIGINAL_OWNER_NEW source: claim release and orphan writes retain original admission', queueClaimOriginalOwnerSourceCase);
test('QUEUE_RECEIPT_ORIGINAL_OWNER_NEW source: payload receipt and ownership retain original admission', queueReceiptOriginalOwnerSourceCase);
}

async function queueEnqueueOwnedBoundarySourceCase() {
  const assert = require('node:assert/strict');
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'memphis-scan-sync.js'), 'utf8');
  const entry = source.indexOf('  const ready = ensureWorkerReady().catch(');
  assert(entry > 0 && source.indexOf('  const ready = ensureWorkerReady().catch(', entry + 1) === -1);
  const callbacks = source.slice(0, entry) + `
    window.__enqueueCallbacks = { enqueueUnlocked, normalizeRecord, storageRecord,
      install(db,channel) { state.db=db;state.channel=channel; } };
  })();`;
  const id = '00000000-0000-4000-8000-000000000112';
  const action = label => ({type:'commit_workflow',client_id:id,payload:{p_client_completion_id:id,p_response_json:{services_performed:[label]}}});
  const plain = value => structuredClone(value);
  function fixture(initial = [], {abortThrows=null,withdrawAfterFirstPut=false} = {}) {
    let current=true,owned=true,checks=0,transactions=0,adds=0,puts=0,aborts=0,committed=false;
    let rows=plain(initial),staged=[],lookup,tx;const requests=[],notifications=[];
    const guardError=Object.assign(new Error('synthetic original owner withdrawn'),{code:'custodial_security_generation_changed'});
    const context=Object.freeze({deviceId:'KIOSK_08',generation:7,state:'enrolled',
      assertCurrent(){checks++;if(!current||!owned)throw guardError;}});
    const store={
      getAll(){lookup={};return lookup;},
      put(row){puts++;staged.push({kind:'put',row:plain(row)});if(withdrawAfterFirstPut&&puts===1)current=false;return {};},
      add(row){adds++;const result=100+adds,request={result};staged.push({kind:'add',row:{...plain(row),id:result}});requests.push(request);return request;},
    };
    const db={transaction(){
      transactions++;assert.equal(transactions,1);
      tx={error:null,objectStore:()=>store,
        abort(){aborts++;if(abortThrows)throw abortThrows;tx.aborted=true;staged=[];
          queueMicrotask(()=>{tx.onabort?.({target:tx});});}};
      return tx;
    }};
    const security={native:true,getStatus:()=>({generation:7}),waitForStableState:async()=>{},
      async mutateProtectedWork(operation,options){assert.equal(options.expectedGeneration,7);
        try{return await operation(context);}finally{owned=false;}}};
    const window={setTimeout,location:{href:'https://source.invalid/tests/scan-sync-harness.html'},
      MemphisCustodialSecurity:security,addEventListener(){},
      dispatchEvent(event){notifications.push({event:event.detail});}};
    const localStorage={getItem:()=>null,key:()=>null,length:0};
    const sandbox=vm.createContext({window,localStorage,navigator:{onLine:false},document:{addEventListener(){}},
      crypto:require('node:crypto').webcrypto,URL,TextEncoder,
      CustomEvent:class {constructor(_name,options){this.detail=options.detail;}}});
    vm.runInContext(callbacks,sandbox,{timeout:1000,filename:'memphis-scan-sync.js'});
    const api=window.__enqueueCallbacks;api.install(db,{postMessage(value){notifications.push({channel:value});}});
    return {api,guardError,withdraw(){current=false;},
      deliverLookup(){lookup.result=plain(rows);lookup.onsuccess();},
      lookupError(error){lookup.error=error;lookup.onerror?.();if(!tx.aborted){tx.error=error;tx.onerror?.({target:tx});tx.abort();}},
      complete(afterCommit=()=>{}){
        if(tx.aborted)return;
        for(const request of requests){request.onsuccess?.();if(tx.aborted)return;}
        for(const operation of staged){
          if(operation.kind==='put'){const at=rows.findIndex(r=>r.id===operation.row.id);if(at<0)rows.push(operation.row);else rows[at]=operation.row;}
          else rows.push(operation.row);
        }
        committed=true;afterCommit();tx.oncomplete({target:tx});
      },
      rows:()=>plain(rows),notifications,
      counts:()=>({checks,transactions,adds,puts,aborts,committed}),
    };
  }
  const seed=(label,extra={})=>{const f=fixture();return plain(f.api.storageRecord({...action(label),id:5,created_at:1234,...extra}));};
  let cases=0;
  {
    const original=seed('original'),f=fixture([original]);const pending=f.api.enqueueUnlocked(action('new'),7);
    f.withdraw();f.deliverLookup();f.complete();
    await assert.rejects(pending,error=>error===f.guardError);
    assert.deepEqual(f.rows(),[original]);assert.equal(f.counts().adds,0);assert.equal(f.counts().puts,0);assert.equal(f.notifications.length,0);cases++;
  }
  {
    const f=fixture(),payload=action('healthy'),pending=f.api.enqueueUnlocked(payload,7);
    f.deliverLookup();f.complete();assert.equal(await pending,101);
    assert.deepEqual(f.rows()[0].payload,payload.payload);assert.equal(f.counts().adds,1);
    assert.equal(f.notifications.filter(v=>v.channel?.type==='queued').length,1);
    assert.equal(f.notifications.filter(v=>v.event?.status==='queued').length,1);cases++;
  }
  {
    const original=seed('same'),f=fixture([original]),pending=f.api.enqueueUnlocked(action('same'),7);
    f.deliverLookup();f.complete();assert.equal(await pending,5);assert.deepEqual(f.rows(),[original]);
    assert.equal(f.counts().adds,0);assert.equal(f.counts().puts,0);cases++;
  }
  {
    const original=seed('old'),f=fixture([original]),pending=f.api.enqueueUnlocked(action('replacement'),7);
    f.deliverLookup();f.complete();assert.equal(await pending,5);assert.equal(f.rows().length,1);
    assert.equal(f.rows()[0].id,5);assert.equal(f.rows()[0].created_at,1234);
    assert.deepEqual(f.rows()[0].payload,action('replacement').payload);assert.equal(f.counts().puts,1);cases++;
  }
  {
    const original=seed('attempted',{retry_count:1}),f=fixture([original]),pending=f.api.enqueueUnlocked(action('conflict'),7);
    f.deliverLookup();f.complete();await assert.rejects(pending,error=>error.code==='semantic_completion_conflict');
    assert.equal(f.rows().length,2);assert.equal(f.rows()[0].state,'quarantined');assert.equal(f.rows()[1].state,'quarantined');
    assert.deepEqual(f.rows()[0].payload,original.payload);
    assert.equal(f.notifications.filter(v=>v.event?.status==='queued'||v.channel?.type==='queued').length,0);cases++;
  }
  {
    const originals=[seed('one',{retry_count:1}),{...seed('two',{retry_count:1}),id:6}];
    const f=fixture(originals,{withdrawAfterFirstPut:true}),pending=f.api.enqueueUnlocked(action('conflict'),7);
    f.deliverLookup();f.complete();await assert.rejects(pending,error=>error===f.guardError);
    assert.equal(f.counts().puts,1);assert.equal(f.counts().adds,0);assert.deepEqual(f.rows(),originals);
    assert.equal(f.notifications.length,0);cases++;
  }
  {
    const f=fixture(),pending=f.api.enqueueUnlocked(action('before-add-result'),7);
    f.deliverLookup();f.withdraw();f.complete();await assert.rejects(pending,error=>error===f.guardError);
    assert.equal(f.counts().aborts,1);assert.deepEqual(f.rows(),[]);assert.equal(f.notifications.length,0);cases++;
  }
  {
    const f=fixture(),pending=f.api.enqueueUnlocked(action('already-committed'),7);
    f.deliverLookup();f.complete(()=>f.withdraw());await assert.rejects(pending,error=>error===f.guardError);
    assert.equal(f.counts().committed,true);assert.equal(f.rows().length,1);
    assert.deepEqual(f.rows()[0].payload,action('already-committed').payload);
    assert.equal(f.notifications.length,0);cases++; // refusal is NOT rollback
  }
  {
    const original=seed('exact'),f=fixture([original]),pending=f.api.enqueueUnlocked(action('exact'),7);
    f.deliverLookup();f.complete(()=>f.withdraw());await assert.rejects(pending,error=>error===f.guardError);
    assert.deepEqual(f.rows(),[original]);assert.equal(f.notifications.length,0);cases++;
  }
  {
    const f=fixture(),error=new Error('synthetic IDB lookup failure'),pending=f.api.enqueueUnlocked(action('lookup-error'),7);
    f.lookupError(error);await assert.rejects(pending,observed=>observed===error);
    assert.equal(f.counts().adds,0);assert.equal(f.notifications.length,0);cases++;
  }
  {
    const abortError=new Error('synthetic abort could not be confirmed'),originals=[seed('one',{retry_count:1}),{...seed('two',{retry_count:1}),id:6}];
    const f=fixture(originals,{abortThrows:abortError,withdrawAfterFirstPut:true});
    let settled=false;const pending=f.api.enqueueUnlocked(action('uncertain'),7);pending.then(()=>{settled=true;},()=>{settled=true;});
    f.deliverLookup();await Promise.resolve();assert.equal(settled,false);
    f.complete();await assert.rejects(pending,error=>error.code==='custodial_storage_unavailable'&&error.errors[0]===f.guardError&&error.errors[1]===abortError);
    assert.equal(f.counts().committed,true);assert.equal(f.rows().length,2);
    assert.equal(f.rows()[0].state,'quarantined');assert.deepEqual(f.rows()[1],originals[1]);assert.equal(f.notifications.length,0);cases++;
  }
  console.log(JSON.stringify({member:'QUEUE_ENQUEUE_OWNED_NEW source',cases,result:'PASS',
    limits:'Shipping enqueue/checkpoint/normalization in existing source-VM pattern; synthetic delayed IDB staging/context, not real IDB/browser locks/native authority.'}));
}

async function queueEnqueueTerminalSettlementSourceCase() {
  const assert = require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'..','memphis-scan-sync.js'),'utf8');
  const entry=source.indexOf('  const ready = ensureWorkerReady().catch(');
  assert(entry>0);
  const callbacks=source.slice(0,entry)+`
    window.__terminalEnqueue={enqueueUnlocked,install(db){state.db=db;state.channel=null;}};
  })();`;
  function fixture() {
    let owned=false,withdrawn=false,lookup,tx,addRequest,abortRequested=false;
    const order=[],announcements=[];
    const originalError=Object.assign(new Error('synthetic original owner withdrawn'),{code:'custodial_security_generation_changed'});
    const security={native:true,getStatus:()=>({generation:7}),waitForStableState:async()=>{},
      async mutateProtectedWork(operation,options){
        assert.equal(options.expectedGeneration,7);owned=true;
        const context=Object.freeze({deviceId:'KIOSK_08',generation:7,state:'enrolled',assertCurrent(){if(!owned||withdrawn)throw originalError;}});
        try{return await operation(context);}finally{owned=false;order.push('owner-closed');}
      }};
    const store={getAll(){lookup={result:[]};return lookup;},add(){addRequest={result:101};return addRequest;},put(){throw Error('not this terminal case');}};
    const db={transaction(){tx={error:null,objectStore:()=>store,abort(){abortRequested=true;}};return tx;}};
    const window={setTimeout,location:{href:'https://source.invalid/tests/scan-sync-harness.html'},MemphisCustodialSecurity:security,
      dispatchEvent(event){announcements.push(event.detail);},addEventListener(){}};
    const sandbox=vm.createContext({window,localStorage:{getItem:()=>null,key:()=>null,length:0},navigator:{onLine:false},
      document:{addEventListener(){}},URL,TextEncoder,crypto:require('node:crypto').webcrypto,
      CustomEvent:class{constructor(_name,options){this.detail=options.detail;}}});
    vm.runInContext(callbacks,sandbox,{timeout:1000,filename:'memphis-scan-sync.js'});
    window.__terminalEnqueue.install(db);
    const pending=window.__terminalEnqueue.enqueueUnlocked({type:'ping_device',client_id:'00000000-0000-4000-8000-000000000112',payload:{p_device_id:'KIOSK_08'}},7);
    // Suppress neither error nor rejection: attach the assertion before timer settlement.
    return {pending,originalError,order,announcements,withdraw(){withdrawn=true;},
      lookup:()=>lookup,tx:()=>tx,add:()=>addRequest,owned:()=>owned,abortRequested:()=>abortRequested};
  }
  const drainMicrotasks=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  {
    const f=fixture();f.withdraw();f.lookup().onsuccess();assert.equal(f.abortRequested(),true);
    const requestError=new Error('synthetic bubbling request error');f.lookup().error=requestError;
    f.tx().onerror({target:f.lookup()});await drainMicrotasks();assert.equal(f.owned(),true);
    const abortError=new Error('synthetic actual transaction abort cause');f.tx().error=abortError;
    f.tx().onabort({target:f.tx()});await drainMicrotasks();assert.equal(f.owned(),true);
    // Model a later observer in the SAME terminal dispatch after an inter-listener
    // microtask checkpoint; this is source scheduling proof, not browser proof.
    f.order.push('transaction-abort-observed');
    await assert.rejects(f.pending,error=>error.code===f.originalError.code&&error.cause===f.originalError
      &&error.errors[0]===f.originalError&&error.errors[1]===abortError);
    assert.deepEqual(f.order,['transaction-abort-observed','owner-closed']);assert.equal(f.announcements.length,0);
  }
  {
    const f=fixture();f.lookup().onsuccess();f.add().onsuccess();
    f.tx().oncomplete({target:f.tx()});await drainMicrotasks();assert.equal(f.owned(),true);
    f.order.push('transaction-complete-observed');f.withdraw();
    await assert.rejects(f.pending,error=>error===f.originalError);
    assert.deepEqual(f.order,['transaction-complete-observed','owner-closed']);assert.equal(f.announcements.length,0);
  }
  console.log(JSON.stringify({member:'QUEUE_ENQUEUE_TERMINAL_NEW source',cases:2,result:'PASS',
    limits:'Actual shipping closure; synthetic event-dispatch gap/transaction/context, not real browser terminal qualification. Original real-browser failure retained.'}));
}

async function queueClaimOriginalOwnerSourceCase() {
  const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'..','memphis-scan-sync.js'),'utf8');
  const entry=source.indexOf('  const ready = ensureWorkerReady().catch(');
  assert(entry>0 && source.indexOf('  const ready = ensureWorkerReady().catch(',entry+1)===-1);
  const callbacks=source.slice(0,entry)+`
    window.__claimOwner={claimNextAction,releaseClaimWithoutAttempt,recoverOrphanedClaims,storageRecord,
      install(db){state.db=db;state.channel=null;},worker(){return state.workerId;}};
  })();`;
  const copy=value=>structuredClone(value),drain=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  function fixture({withdrawAfterPut=false,abortThrows=false}={}) {
    let owned=false,current=true,generation=7,lookup,tx,rows=[],staged=[],puts=0,aborts=0,transactions=0,uuids=0;
    const order=[],optionsSeen=[];
    const guardError=Object.assign(new Error('synthetic original queue owner withdrawn'),{code:'custodial_security_generation_changed'});
    const abortCause=new Error('synthetic transaction abort cause'),abortFailure=new Error('synthetic abort settlement unavailable');
    const security={native:true,getStatus:()=>({generation}),waitForStableState:async()=>{},
      async mutateProtectedWork(operation,options) {
        optionsSeen.push(copy(options));
        const originalGeneration=options.expectedGeneration ?? generation;
        if(originalGeneration!==generation)throw guardError;
        owned=true;
        const context=Object.freeze({deviceId:'KIOSK_08',generation:originalGeneration,state:'enrolled',
          assertCurrent(){if(!owned||!current||generation!==originalGeneration)throw guardError;}});
        try{return await operation(context);}finally{owned=false;order.push('owner-closed');}
      }};
    const store={getAll(){lookup={};return lookup;},get(id){lookup={id};return lookup;},
      put(row){puts++;staged.push(copy(row));if(withdrawAfterPut)current=false;return {};}};
    const db={transaction(){transactions++;tx={error:null,objectStore:()=>store,
      abort(){aborts++;if(abortThrows)throw abortFailure;tx.aborted=true;staged=[];}};return tx;}};
    const window={setTimeout,location:{href:'https://source.invalid/tests/scan-sync-harness.html'},
      MemphisCustodialSecurity:security,addEventListener(){},dispatchEvent(){throw Error('unexpected announcement');}};
    const sandbox=vm.createContext({window,localStorage:{getItem:()=>null,key:()=>null,length:0},
      navigator:{onLine:false},document:{addEventListener(){}},URL,TextEncoder,
      crypto:{randomUUID(){uuids++;return require('node:crypto').randomUUID();}},
      CustomEvent:class{constructor(_name,options){this.detail=options.detail;}}});
    vm.runInContext(callbacks,sandbox,{timeout:1000,filename:'memphis-scan-sync.js'});
    const api=window.__claimOwner;api.install(db);
    const id='00000000-0000-4000-8000-000000000112';
    const pending=copy(api.storageRecord({id:5,type:'ping_device',client_id:id,created_at:1234,payload:{p_device_id:'KIOSK_08',original:['kept']}}));
    const processing=copy(api.storageRecord({...pending,state:'processing',lease_owner:api.worker(),lease_token:'original-lease',lease_until:0}));
    const claim={...copy(processing),type:'ping_device',security_generation:7,claimed_from:{state:'pending',lease_owner:null,lease_token:null,lease_until:0}};
    return {api,pending,processing,claim,guardError,abortCause,abortFailure,order,optionsSeen,
      seed(value){rows=copy(value);},rows:()=>copy(rows),owned:()=>owned,
      withdraw(){current=false;},changeGeneration(){generation++;},
      lookup(){lookup.result=lookup.id===undefined?copy(rows):copy(rows.find(row=>row.id===lookup.id));lookup.onsuccess();},
      error(){lookup.error=new Error('synthetic request failure');tx.onerror({target:lookup});},
      async terminalAbort() {
        tx.error=abortCause;tx.onabort({target:tx});await drain();
        assert.equal(owned,true,'owner must span the whole abort event dispatch');order.push('transaction-abort');
      },
      async complete(afterCommit=()=>{}) {
        if(tx.aborted)return;
        for(const row of staged){const at=rows.findIndex(saved=>saved.id===row.id);if(at<0)rows.push(row);else rows[at]=row;}
        afterCommit();tx.oncomplete({target:tx});await drain();
        assert.equal(owned,true,'owner must span the whole complete event dispatch');order.push('transaction-complete');
      },
      counts:()=>({puts,aborts,transactions,uuids})};
  }
  const kinds=['claim','release','orphan'];
  const start=(f,kind)=>{
    f.seed([kind==='claim'?f.pending:f.processing]);
    const promise=kind==='claim'?f.api.claimNextAction():kind==='release'?f.api.releaseClaimWithoutAttempt(f.claim):f.api.recoverOrphanedClaims();
    promise.catch(()=>{});return promise;
  };
  if(process.argv[3]==='--before') {
    const observations=[];
    for(const kind of kinds){
      const f=fixture(),promise=start(f,kind);f.withdraw();f.lookup();
      observations.push({kind,...f.counts()});
      // Baseline has already staged the unauthorized write; deliver terminal
      // directly without imposing the NEW repaired dispatch-order assertion.
      // This mode is only the preserved counterexample, never an acceptance.
      await f.complete().catch(()=>{});await promise.catch(()=>{});
    }
    console.log(JSON.stringify({member:'QUEUE_CLAIM_ORIGINAL_OWNER_NEW before',observations}));
    assert.equal(observations.reduce((n,value)=>n+value.puts,0),0,'withdrawn original owner must stage zero writes');
    return;
  }
  let cases=0;
  for(const kind of kinds) {
    const f=fixture(),promise=start(f,kind),original=f.rows();f.withdraw();f.lookup();
    assert.equal(f.counts().puts,0);assert.equal(f.counts().aborts,1);
    if(kind==='claim')assert.equal(f.counts().uuids,1,'only worker startup UUID, no lease UUID on refusal');
    f.error();await drain();assert.equal(f.owned(),true);
    await f.terminalAbort();
    await assert.rejects(promise,error=>error.code===f.guardError.code && error.cause===f.guardError
      &&error.errors[0]===f.guardError&&error.errors[1]===f.abortCause);
    assert.deepEqual(f.rows(),original);assert.deepEqual(f.order,['transaction-abort','owner-closed']);cases++;
  }
  for(const kind of kinds) {
    const f=fixture(),promise=start(f,kind);f.lookup();await f.complete();
    const result=await promise;
    assert.equal(f.counts().puts,1);assert.equal(f.rows().length,1);
    assert.deepEqual(f.rows()[0].payload,f.pending.payload);assert.equal(f.rows()[0].operation_id,f.pending.operation_id);
    if(kind==='claim'){assert.equal(result.security_generation,7);assert.equal(result.state,'processing');assert.equal(result.id,5);}
    else assert.equal(result,kind==='release'?true:1);
    assert.deepEqual(f.order,['transaction-complete','owner-closed']);cases++;
  }
  for(const kind of kinds) {
    const f=fixture(),promise=start(f,kind);f.lookup();await f.complete(()=>f.withdraw());
    await assert.rejects(promise,error=>error===f.guardError);
    assert.equal(f.counts().puts,1);assert.equal(f.rows().length,1); // committed, NOT rolled back
    assert.deepEqual(f.order,['transaction-complete','owner-closed']);cases++;
  }
  for(const kind of kinds) {
    const f=fixture(),promise=start(f,kind),original=f.rows();
    f.error();await drain();assert.equal(f.owned(),true);await f.terminalAbort();
    await assert.rejects(promise,error=>error.errors?.[0]?.message==='synthetic request failure'&&error.errors[1]===f.abortCause);
    assert.deepEqual(f.rows(),original);cases++;
  }
  {
    const f=fixture({withdrawAfterPut:true}),second={...f.processing,id:6};
    f.seed([f.processing,second]);const original=f.rows(),promise=f.api.recoverOrphanedClaims();promise.catch(()=>{});
    f.lookup();assert.equal(f.counts().puts,1);assert.equal(f.counts().aborts,1);await f.terminalAbort();
    await assert.rejects(promise);assert.deepEqual(f.rows(),original);cases++;
  }
  for(const security_generation of [null,undefined,'7',-1,NaN,8]) {
    const f=fixture();f.seed([f.processing]);const original=f.rows();
    await assert.rejects(f.api.releaseClaimWithoutAttempt({...f.claim,security_generation}));
    assert.equal(f.counts().transactions,0);assert.deepEqual(f.rows(),original);cases++;
  }
  {
    const f=fixture();f.seed([f.processing]);const original=f.rows(),claim=copy(f.claim);
    const promise=f.api.releaseClaimWithoutAttempt(claim);promise.catch(()=>{});
    claim.id=99;claim.lease_token='changed';claim.security_generation=8;claim.claimed_from.state='destroyed';
    f.lookup();await f.complete();assert.equal(await promise,true);assert.equal(f.rows()[0].state,'pending');
    assert.deepEqual(f.rows()[0].payload,original[0].payload);cases++;
  }
  {
    const f=fixture();f.seed([{...f.processing,lease_owner:'foreign-owner'}]);const original=f.rows();
    const promise=f.api.releaseClaimWithoutAttempt(f.claim);f.lookup();await f.complete();
    assert.equal(await promise,false);assert.equal(f.counts().puts,0);assert.deepEqual(f.rows(),original);cases++;
  }
  for(const kind of kinds) {
    const f=fixture(),promise=start(f,kind),original=f.rows();f.changeGeneration();f.lookup();
    assert.equal(f.counts().puts,0);await f.terminalAbort();await assert.rejects(promise);assert.deepEqual(f.rows(),original);cases++;
  }
  {
    const f=fixture();f.seed([{...f.processing,lease_until:Date.now()+60000}]);const original=f.rows();
    const promise=f.api.recoverOrphanedClaims();f.lookup();await f.complete();
    assert.equal(await promise,0);assert.deepEqual(f.rows(),original);cases++;
  }
  console.log(JSON.stringify({member:'QUEUE_CLAIM_ORIGINAL_OWNER_NEW source',cases,result:'PASS',
    limits:'Actual three shipping functions/checkpoints/normalization; synthetic delayed IDB events and native context. Not real IndexedDB, browser locks, Android or authority proof.'}));
}

async function queueReceiptOriginalOwnerSourceCase() {
  const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'..','memphis-scan-sync.js'),'utf8');
  const entry=source.indexOf('  const ready = ensureWorkerReady().catch(');
  assert(entry>0&&source.indexOf('  const ready = ensureWorkerReady().catch(',entry+1)===-1);
  const callbacks=source.slice(0,entry)+`
    window.__receiptOwner={persistClaimPayload,requireClaimOwnership,persistServerCompletionReceipt,storageRecord,canonicalJson,
      install(db){state.db=db;state.channel=null;},worker(){return state.workerId;}};
  })();`;
  const copy=value=>structuredClone(value),drain=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  function fixture({holdDigest=false,abortThrows=false}={}) {
    let current=true,generation=7,owned=false,rows=[],staged=[],lookup,tx,puts=0,aborts=0,transactions=0,settled=false;
    let lookupReady,digestStarted,releaseDigest;
    const lookupPromise=new Promise(resolve=>{lookupReady=resolve;});
    const digestPromise=new Promise(resolve=>{digestStarted=resolve;});
    const digestGate=new Promise(resolve=>{releaseDigest=resolve;});
    const order=[],optionsSeen=[];
    const guardError=Object.assign(new Error('synthetic original receipt owner withdrawn'),{code:'custodial_security_generation_changed'});
    const abortCause=new Error('synthetic abort cause'),abortFailure=new Error('synthetic abort could not be confirmed');
    const crypto=require('node:crypto').webcrypto;
    const security={native:true,getStatus:()=>({generation}),waitForStableState:async()=>{},
      async mutateProtectedWork(operation,options){
        optionsSeen.push(copy(options));const originalGeneration=options.expectedGeneration??generation;
        if(generation!==originalGeneration)throw guardError;
        owned=true;const context=Object.freeze({generation:originalGeneration,deviceId:'KIOSK_08',state:'enrolled',
          assertCurrent(){if(!owned||!current||generation!==originalGeneration)throw guardError;}});
        try{return await operation(context);}finally{owned=false;order.push('owner-closed');}
      }};
    const store={get(id){lookup={id};lookupReady();return lookup;},
      put(row){puts++;staged.push(copy(row));return {};}};
    const db={transaction(_name,mode){transactions++;tx={mode,error:null,objectStore:()=>store,
      abort(){aborts++;if(abortThrows)throw abortFailure;tx.aborted=true;staged=[];}};return tx;}};
    const window={setTimeout,location:{href:'https://source.invalid/tests/scan-sync-harness.html'},
      MemphisCustodialSecurity:security,addEventListener(){},dispatchEvent(){throw Error('unexpected announcement');}};
    const sandbox=vm.createContext({window,structuredClone,localStorage:{getItem:()=>null,key:()=>null,length:0},
      navigator:{onLine:false},document:{addEventListener(){}},URL,TextEncoder,
      crypto:{randomUUID:()=>crypto.randomUUID(),subtle:{async digest(...args){digestStarted();if(holdDigest)await digestGate;return crypto.subtle.digest(...args);}}},
      CustomEvent:class{constructor(_name,options){this.detail=options.detail;}}});
    vm.runInContext(callbacks,sandbox,{timeout:1000,filename:'memphis-scan-sync.js'});
    const api=window.__receiptOwner;api.install(db);
    const id='00000000-0000-4000-8000-000000000112';
    const raw=copy(api.storageRecord({id:5,type:'commit_workflow',client_id:id,created_at:1234,semantic_fingerprint:'original-fingerprint',
      state:'processing',lease_owner:api.worker(),lease_token:'original-lease',lease_until:12345,
      payload:{p_device_id:'KIOSK_08',p_client_completion_id:id,p_response_json:{answers:['exact original']}},replay_binding:{client_completion_id:id}}));
    const claim={...copy(raw),type:'commit_workflow',security_generation:7};
    rows=[copy(raw)];
    const payload={...copy(claim.payload),p_native_completion_attestation:'source-fixture-only',p_response_json:{answers:['same submitted answers']}};
    const result={status:'closed',client_completion_id:id,original:{accepted:['source synthetic result']}};
    return {api,claim,raw,payload,result,guardError,abortCause,abortFailure,order,optionsSeen,
      owned:()=>owned,settled:()=>settled,rows:()=>copy(rows),seed(value){rows=copy(value);},
      withdraw(){current=false;},changeGeneration(){generation++;},
      waitLookup:()=>lookupPromise,waitDigest:()=>digestPromise,releaseDigest,
      track(promise){promise.then(()=>{settled=true;},()=>{settled=true;});return promise;},
      deliver(){lookup.result=copy(rows.find(row=>row.id===lookup.id));lookup.onsuccess();},
      error(){lookup.error=new Error('synthetic lookup error');tx.onerror({target:lookup});},
      async abort(){tx.error=abortCause;tx.onabort({target:tx});await drain();assert.equal(owned,true);order.push('transaction-abort');},
      async complete(afterCommit=()=>{},checkTerminal=true){
        if(tx.aborted)return;
        for(const row of staged){const at=rows.findIndex(saved=>saved.id===row.id);rows[at]=row;}
        afterCommit();tx.oncomplete({target:tx});await drain();
        if(checkTerminal)assert.equal(owned,true,'owner spans direct completion dispatch');order.push('transaction-complete');
      },counts:()=>({puts,aborts,transactions})};
  }
  const kinds=['payload','ownership','receipt'];
  const start=(f,kind)=>f.track(kind==='payload'?f.api.persistClaimPayload(f.claim,f.payload):
    kind==='ownership'?f.api.requireClaimOwnership(f.claim):f.api.persistServerCompletionReceipt(f.claim,f.result));
  if(process.argv[3]==='--before'){
    const observations=[];
    for(const kind of kinds){
      const f=fixture(),promise=start(f,kind);await f.waitLookup();f.withdraw();f.deliver();
      if(f.counts().aborts)await f.abort();else await f.complete(()=>{},false);
      let success=false;try{await promise;success=true;}catch(_error){}
      observations.push({kind,success,...f.counts()});
    }
    console.log(JSON.stringify({member:'QUEUE_RECEIPT_ORIGINAL_OWNER_NEW before',observations}));
    assert.equal(observations.filter(value=>value.success).length,0,'withdrawn owner must not publish payload, receipt or ownership success');return;
  }
  let cases=0;
  for(const kind of kinds){
    const f=fixture(),original=f.rows(),claim=copy(f.claim),promise=start(f,kind);await f.waitLookup();
    f.withdraw();f.deliver();assert.equal(f.counts().puts,0);assert.equal(f.counts().aborts,1);
    f.error();await drain();assert.equal(f.owned(),true);assert.equal(f.settled(),false);
    await f.abort();
    await assert.rejects(promise,error=>error.cause===f.guardError&&error.errors[0]===f.guardError&&error.errors[1]===f.abortCause);
    assert.deepEqual(f.rows(),original);assert.deepEqual(f.claim,claim);assert.deepEqual(f.order,['transaction-abort','owner-closed']);cases++;
  }
  for(const kind of kinds){
    const f=fixture(),original=f.rows(),promise=start(f,kind);await f.waitLookup();f.deliver();await f.complete();
    const value=await promise;assert.equal(f.optionsSeen[0].expectedGeneration,7);
    assert.deepEqual(f.order,['transaction-complete','owner-closed']);
    if(kind==='payload'){assert.equal(value,true);assert.deepEqual(f.rows()[0].payload,f.payload);assert.deepEqual(f.claim.payload,f.payload);}
    if(kind==='ownership'){assert.equal(value,undefined);assert.deepEqual(f.rows(),original);assert.equal(f.counts().puts,0);}
    if(kind==='receipt'){
      const receipt=f.rows()[0].server_completion_receipt,expected={schema_version:'server-completion-receipt.v1',
        operation_id:f.claim.operation_id,logical_key:f.claim.logical_key,semantic_fingerprint:f.claim.semantic_fingerprint,result:f.result};
      const encoded=f.api.canonicalJson(expected);
      assert.equal(receipt.integrity_sha256,require('node:crypto').createHash('sha256').update(encoded).digest('hex'));
      assert.deepEqual(receipt.result,f.result);assert.deepEqual(f.claim.server_completion_receipt,receipt);
      f.result.original.accepted[0]='later changed';assert.notEqual(f.claim.server_completion_receipt.result.original.accepted[0],'later changed');
    }cases++;
  }
  for(const kind of kinds){
    const f=fixture(),claim=copy(f.claim),promise=start(f,kind);await f.waitLookup();f.deliver();await f.complete(()=>f.withdraw());
    await assert.rejects(promise,error=>error===f.guardError);assert.deepEqual(f.claim,claim);
    assert.equal(f.counts().puts,kind==='ownership'?0:1); // committed rows retained, never a rollback claim
    cases++;
  }
  for(const kind of kinds){
    const f=fixture(),original=f.rows(),promise=start(f,kind);await f.waitLookup();f.error();await drain();
    assert.equal(f.owned(),true);assert.equal(f.settled(),false);await f.abort();
    await assert.rejects(promise,error=>error.errors[0].message==='synthetic lookup error'&&error.errors[1]===f.abortCause);
    assert.deepEqual(f.rows(),original);cases++;
  }
  for(const kind of kinds){
    const f=fixture(),original=f.rows(),promise=start(f,kind);await f.waitLookup();f.changeGeneration();f.deliver();await f.abort();
    await assert.rejects(promise);assert.equal(f.counts().puts,0);assert.deepEqual(f.rows(),original);cases++;
  }
  for(const kind of kinds){
    const f=fixture(),original=f.rows(),promise=start(f,kind);await f.waitLookup();
    f.claim.id=99;f.claim.lease_token='replacement';f.claim.payload.p_response_json.answers[0]='replacement';
    f.deliver();await f.abort();await assert.rejects(promise);
    assert.equal(f.counts().puts,0);assert.deepEqual(f.rows(),original);cases++;
  }
  for(const kind of kinds)for(const generation of [null,'7',8]){
    const f=fixture();f.claim.security_generation=generation;
    await assert.rejects(start(f,kind));assert.equal(f.counts().transactions,0);cases++;
  }
  {
    const f=fixture({holdDigest:true}),claim=copy(f.claim),original=f.rows(),promise=start(f,'receipt');
    await f.waitDigest();assert.equal(f.owned(),true);f.withdraw();f.releaseDigest();
    await assert.rejects(promise,error=>error===f.guardError);assert.equal(f.counts().transactions,0);
    assert.deepEqual(f.claim,claim);assert.deepEqual(f.rows(),original);cases++;
  }
  {
    const f=fixture({holdDigest:true}),originalResult=copy(f.result),promise=start(f,'receipt');
    await f.waitDigest();f.result.original.accepted[0]='substitute after crypto await';
    f.releaseDigest();await f.waitLookup();f.deliver();await f.complete();await promise;
    assert.deepEqual(f.rows()[0].server_completion_receipt.result,originalResult);cases++;
  }
  {
    const f=fixture(),payload=copy(f.payload),promise=start(f,'payload');await f.waitLookup();
    f.payload.p_response_json.answers[0]='substitute after lookup await';
    f.deliver();await f.complete();await promise;
    assert.deepEqual(f.rows()[0].payload,payload);assert.deepEqual(f.claim.payload,payload);cases++;
  }
  for(const kind of kinds){
    const f=fixture();f.seed([{...f.raw,lease_token:'foreign-token'}]);const original=f.rows(),claim=copy(f.claim),promise=start(f,kind);
    await f.waitLookup();f.deliver();await f.complete();
    if(kind==='payload')assert.equal(await promise,false);else await assert.rejects(promise);
    assert.deepEqual(f.rows(),original);assert.deepEqual(f.claim,claim);assert.equal(f.counts().puts,0);cases++;
  }
  {
    const f=fixture();f.result.original.accepted=['x'.repeat(65537)];
    await assert.rejects(start(f,'receipt'),error=>error.code==='custodial_storage_unavailable');
    assert.equal(f.counts().transactions,0);cases++;
  }
  for(const kind of kinds){
    const f=fixture({abortThrows:true}),promise=start(f,kind);await f.waitLookup();f.withdraw();f.deliver();
    await drain();assert.equal(f.settled(),false);assert.equal(f.owned(),true);
    await f.complete();await assert.rejects(promise,error=>error.errors[0]===f.guardError&&error.errors[1]===f.abortFailure);
    assert.equal(f.counts().puts,0);cases++;
  }
  console.log(JSON.stringify({member:'QUEUE_RECEIPT_ORIGINAL_OWNER_NEW source',cases,result:'PASS',
    limits:'Three shipping closures plus real WebCrypto hashing; synthetic IDB staging/events/native admission. Not browser/native authentication or server-receipt authority proof.'}));
}
