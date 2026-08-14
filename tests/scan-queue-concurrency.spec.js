const { test, expect } = require('@playwright/test');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const DEVICE_ID = 'SCAN_SYNC_BROWSER_TEST';
const SESSION_ID = '00000000-0000-4000-8000-000000000111';
const COMPLETION_ID = '00000000-0000-4000-8000-000000000112';
const FINISH_SCAN_ID = '00000000-0000-4000-8000-000000000119';
const SCHEMA_FINGERPRINT = '7a67d1acd26ab29f15d0e6f099193d83e073bcd71ec88943f745c70ddbc84785';
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
      createOfflineCompletionAttestation: async (input) => {
        window.__completionAttestationInput = input;
        return {
          p_client_ended_at: endedAt,
          p_native_finish_scan_entry_id: input.nativeFinishScanEntryId,
          p_native_completion_attestation_version: 'custodial-native-completion.v2',
          p_native_completion_attestation: 'd'.repeat(64),
        };
      },
      acknowledgeOfflineCompletion: async (input) => {
        window.__completionAcknowledgementInput = input;
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
  const completion = calls[1].args;
  expect(completion).toEqual(expect.objectContaining({
    p_client_ended_at: frozenEndedAt,
    p_native_finish_scan_entry_id: FINISH_SCAN_ID,
    p_native_completion_attestation_version: 'custodial-native-completion.v2',
    p_native_completion_attestation: 'd'.repeat(64),
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
  });
  expect(await page.evaluate((id) => localStorage.getItem(`session:${id}`), SESSION_ID)).toBeNull();
  await context.close();
});

test('completion proof survives renderer death after an idempotent backend commit', async ({ browser }) => {
  const context = await browser.newContext();
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
      createOfflineCompletionAttestation: async (input) => {
        localStorage.setItem('__completion_attestation_calls', String(Number(localStorage.getItem('__completion_attestation_calls') || 0) + 1));
        return {
          p_client_ended_at: exactEndedAt,
          p_native_finish_scan_entry_id: input.nativeFinishScanEntryId,
          p_native_completion_attestation_version: 'custodial-native-completion.v2',
          p_native_completion_attestation: 'd'.repeat(64),
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
    return json(route, 200, { ok: true, data: {
      status: 'closed', terminal: true, client_session_id: SESSION_ID,
      client_completion_id: COMPLETION_ID, occurrence_id: occurrenceId,
    } });
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
  }));
  expect(persisted.payload.p_response_json.__custodial_offline_reconciliation_v1).toEqual({
    context_id: contextId, submission_proof: 'c'.repeat(64),
  });
  expect(await first.evaluate((id) => localStorage.getItem(`session:${id}`), SESSION_ID)).toBeNull();
  await first.close();

  const second = await openHarness(context);
  await second.evaluate(() => window.MemphisScanSync.sync());
  await waitForQueue(second, (rows) => rows.length === 0);
  expect(calls).toHaveLength(2);
  expect(calls[1].args).toEqual(expect.objectContaining({
    p_native_finish_scan_entry_id: FINISH_SCAN_ID,
    p_native_completion_attestation_version: 'custodial-native-completion.v2',
    p_native_completion_attestation: 'd'.repeat(64),
  }));
  expect(calls[1].args.p_response_json.__custodial_offline_reconciliation_v1).toEqual({
    context_id: contextId, submission_proof: 'c'.repeat(64),
  });
  expect(await second.evaluate(() => Number(localStorage.getItem('__completion_attestation_calls')))).toBe(1);
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
