(() => {
  'use strict';

  const CONFIG = {
    API_URL: 'https://memphis-zoo-mcp.onrender.com/scan-api/rpc',
    DB_NAME: 'mz_scan_queue',
    STORE_NAME: 'actions',
    DB_VERSION: 5,
    SCHEMA_VERSION: 5,
    POLL_MS: 30000,
    LEASE_MS: 60000,
    FALLBACK_LOCK_KEY: 'mz_scan_sync_worker_lock_v5',
    FALLBACK_LOCK_TTL_MS: 75000,
    WEB_LOCK_NAME: 'memphis-scan-queue-v5',
    CHANNEL_NAME: 'memphis-scan-queue-v5',
    CLOCK_FLOOR_KEY: 'mz_scan_queue_clock_floor_v1',
    MAX_RETRIES: 50,
    FRONTEND_VERSION: 'release-2026.07.24.custodial-v3.19',
  };

  const state = {
    db: null,
    deviceId: '',
    syncing: false,
    workerId: `scan-worker-${crypto.randomUUID()}`,
    timer: null,
    channel: typeof BroadcastChannel === 'function' ? new BroadcastChannel(CONFIG.CHANNEL_NAME) : null,
    lastServerAckAt: null,
    lastError: null,
    clockBaseMs: 0,
    clockLastMs: 0,
    clockAnchorMonotonicMs: typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : 0,
  };

  function safeText(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) {
    return safeText(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
  function safeIsoTimestamp(value) {
    if (!value) return null;
    const timestamp = new Date(value);
    return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : null;
  }
  function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeText(value)); }
  function readClockFloor() {
    try {
      const value = Number(localStorage.getItem(CONFIG.CLOCK_FLOOR_KEY) || 0);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (_err) { return 0; }
  }
  function now() {
    const hasMonotonicClock = typeof performance !== 'undefined' && typeof performance.now === 'function';
    const monotonicNow = hasMonotonicClock ? performance.now() : 0;
    const wallNow = Date.now();
    if (!state.clockBaseMs) {
      state.clockBaseMs = Math.max(wallNow, readClockFloor());
      state.clockAnchorMonotonicMs = monotonicNow;
    }
    let value = hasMonotonicClock
      ? state.clockBaseMs + Math.max(0, monotonicNow - state.clockAnchorMonotonicMs)
      : Math.max(state.clockBaseMs, wallNow);
    if (wallNow > value) {
      state.clockBaseMs = wallNow;
      state.clockAnchorMonotonicMs = monotonicNow;
      value = wallNow;
    }
    value = Math.max(value, state.clockLastMs);
    state.clockLastMs = value;
    try { localStorage.setItem(CONFIG.CLOCK_FLOOR_KEY, String(Math.floor(value))); } catch (_err) {}
    return value;
  }
  function resolveDeviceId() {
    const shared = window.MemphisDeviceIdentity?.resolve?.({ url: new URL(window.location.href) });
    return safeText(shared?.deviceId);
  }
  function sessionKey(id) { return `session:${safeText(id)}`; }
  function readSession(id) {
    const key = sessionKey(id);
    if (key === 'session:') return null;
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (_err) { return null; }
  }
  function removeSession(id) {
    const key = sessionKey(id);
    if (key === 'session:') return;
    try { localStorage.removeItem(key); } catch (_err) {}
  }
  function saveSession(session) {
    const id = safeText(session?.session_uuid);
    if (!id) return;
    try { localStorage.setItem(sessionKey(id), JSON.stringify(session)); } catch (_err) {}
  }
  function allSessions() {
    const rows = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith('session:')) continue;
        try { const value = JSON.parse(localStorage.getItem(key)); if (value && typeof value === 'object') rows.push(value); } catch (_err) {}
      }
    } catch (_err) {}
    return rows;
  }
  function exactSessionForPayload(payload = {}) {
    const identifiers = [payload.p_session_uuid, payload.p_client_session_id].map(safeText).filter(Boolean);
    for (const identifier of identifiers) {
      const direct = readSession(identifier);
      if (direct) return direct;
      const byClient = allSessions().find((item) => safeText(item.client_session_id) === identifier || safeText(item.session_uuid) === identifier);
      if (byClient) return byClient;
    }
    return null;
  }

  function operationIdFor(action = {}) {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    const candidate = safeText(action.operation_id || action.client_id
      || payload.p_client_completion_id || payload.p_client_event_id
      || payload.p_client_session_id || payload.p_operation_id || payload.p_session_uuid);
    return isUuid(candidate) ? candidate : crypto.randomUUID();
  }
  function logicalIdentityFor(action = {}, operationId = '') {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    return safeText(action.logical_identity || action.client_id
      || payload.p_client_completion_id || payload.p_client_event_id
      || payload.p_client_session_id || payload.p_operation_id || payload.p_session_uuid)
      || operationId;
  }
  function normalizeRecord(action = {}) {
    const operationId = operationIdFor(action);
    const logicalIdentity = logicalIdentityFor(action, operationId);
    return {
      ...action,
      schema_version: CONFIG.SCHEMA_VERSION,
      operation_id: operationId,
      logical_identity: logicalIdentity,
      logical_key: safeText(action.logical_key) || `${safeText(action.type)}:${logicalIdentity}`,
      created_at: Number(action.created_at || now()),
      retry_count: Number(action.retry_count || 0),
      last_error: action.last_error || null,
      last_attempt_at: action.last_attempt_at || null,
      next_attempt_at: Number(action.next_attempt_at || 0),
      dead_letter: action.dead_letter === true,
      state: action.dead_letter === true ? 'dead-letter' : safeText(action.state || 'pending'),
      lease_owner: action.lease_owner || null,
      lease_token: action.lease_token || null,
      lease_until: Number(action.lease_until || 0),
      queue_clock_observed_at: Number(action.queue_clock_observed_at || now()),
    };
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(CONFIG.STORE_NAME)
          ? request.transaction.objectStore(CONFIG.STORE_NAME)
          : db.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
        if (!store.indexNames.contains('logical_key')) store.createIndex('logical_key', 'logical_key', { unique: false });
        if (!store.indexNames.contains('state')) store.createIndex('state', 'state', { unique: false });
        if (!store.indexNames.contains('next_attempt_at')) store.createIndex('next_attempt_at', 'next_attempt_at', { unique: false });
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (!current) return;
          current.update(normalizeRecord(current.value));
          current.continue();
        };
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Scan queue upgrade is blocked by another stale browser tab.'));
    });
  }

  function listActions() {
    if (!state.db) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readonly');
      const request = tx.objectStore(CONFIG.STORE_NAME).getAll();
      request.onsuccess = () => resolve((Array.isArray(request.result) ? request.result : []).map(normalizeRecord).sort((a, b) => a.created_at - b.created_at));
      request.onerror = () => reject(request.error);
    });
  }

  function enqueue(action) {
    if (!state.db) return Promise.reject(new Error('The durable scan queue is not ready.'));
    const record = normalizeRecord(action);
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const lookup = store.index('logical_key').getAll(record.logical_key);
      let result = null;
      lookup.onsuccess = () => {
        const existing = (lookup.result || []).find((item) => item.dead_letter !== true);
        if (existing) { result = existing.id; return; }
        const add = store.add(record);
        add.onsuccess = () => { result = add.result; };
      };
      tx.oncomplete = () => {
        state.channel?.postMessage({ type: 'queued', logical_key: record.logical_key });
        dispatchStatus({ status: 'queued', logical_key: record.logical_key });
        resolve(result);
        if (navigator.onLine) window.setTimeout(() => sync(), 0);
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Queue transaction aborted.'));
    });
  }

  function claimNextAction() {
    if (!state.db) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.getAll();
      let claimed = null;
      request.onsuccess = () => {
        const eligible = (request.result || [])
          .map(normalizeRecord)
          .filter((item) => !item.dead_letter)
          .filter((item) => item.next_attempt_at <= now())
          .filter((item) => !item.lease_until || item.lease_until <= now())
          .sort((a, b) => a.created_at - b.created_at || Number(a.id) - Number(b.id));
        if (!eligible.length) return;
        const item = eligible[0];
        claimed = {
          ...item,
          state: 'processing',
          lease_owner: state.workerId,
          lease_token: crypto.randomUUID(),
          lease_until: now() + CONFIG.LEASE_MS,
        };
        store.put(claimed);
      };
      tx.oncomplete = () => resolve(claimed);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Queue claim aborted.'));
    });
  }

  function finishClaim(item, { succeeded, error = null, permanent = false, retryAfterMs = 0 } = {}) {
    if (!state.db || !item?.id) return Promise.resolve(false);
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.get(item.id);
      let changed = false;
      request.onsuccess = () => {
        const current = request.result;
        if (!current || current.lease_token !== item.lease_token || current.lease_owner !== state.workerId) return;
        changed = true;
        if (succeeded) {
          store.delete(item.id);
          return;
        }
        const retryCount = Number(current.retry_count || 0) + 1;
        const deadLetter = permanent || retryCount >= CONFIG.MAX_RETRIES;
        store.put({
          ...current,
          retry_count: retryCount,
          last_error: safeText(error || 'Sync failed').slice(0, 1000),
          last_attempt_at: now(),
          next_attempt_at: deadLetter ? Number.MAX_SAFE_INTEGER : now() + Math.max(retryAfterMs, retryDelay(retryCount)),
          dead_letter: deadLetter,
          state: deadLetter ? 'dead-letter' : 'retrying',
          lease_owner: null,
          lease_token: null,
          lease_until: 0,
        });
      };
      tx.oncomplete = () => resolve(changed);
      tx.onerror = () => reject(tx.error);
    });
  }

  function retryDelay(retryCount) {
    return Math.min(15 * 60 * 1000, Math.max(5000, 5000 * (2 ** Math.min(Number(retryCount || 0), 8)))) + Math.floor(Math.random() * 3000);
  }
  function parseRetryAfter(value) {
    const raw = safeText(value);
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return Number(raw) * 1000;
    const at = Date.parse(raw);
    return Number.isFinite(at) ? Math.max(0, at - now()) : 0;
  }
  function dispatchStatus(detail) {
    try { window.dispatchEvent(new CustomEvent('memphis-scan-sync', { detail })); } catch (_err) {}
  }

  function acquireFallbackLock() {
    const at = now();
    try {
      const current = JSON.parse(localStorage.getItem(CONFIG.FALLBACK_LOCK_KEY) || 'null');
      if (current?.owner && current.owner !== state.workerId && at - Number(current.at || 0) < CONFIG.FALLBACK_LOCK_TTL_MS) return false;
      localStorage.setItem(CONFIG.FALLBACK_LOCK_KEY, JSON.stringify({ owner: state.workerId, at }));
      return JSON.parse(localStorage.getItem(CONFIG.FALLBACK_LOCK_KEY) || 'null')?.owner === state.workerId;
    } catch (_err) { return true; }
  }
  function refreshFallbackLock() {
    try { localStorage.setItem(CONFIG.FALLBACK_LOCK_KEY, JSON.stringify({ owner: state.workerId, at: now() })); } catch (_err) {}
  }
  function releaseFallbackLock() {
    try {
      const current = JSON.parse(localStorage.getItem(CONFIG.FALLBACK_LOCK_KEY) || 'null');
      if (current?.owner === state.workerId) localStorage.removeItem(CONFIG.FALLBACK_LOCK_KEY);
    } catch (_err) {}
  }

  async function rpc(fn, args = {}) {
    const requestedDevice = state.deviceId || safeText(args.p_device_id || args.p_device_identifier);
    if (!requestedDevice) throw new Error('This phone has no verified device identity.');
    const headers = { 'Content-Type': 'application/json', 'X-Device-Id': requestedDevice };
    if (requestedDevice.toUpperCase() === 'KIOSK_01') {
      const session = await window.MemphisAuth?.requireOpsManagerSession?.({
        accessLevel: 'full_access',
        redirect: false,
        interactive: false,
        throwOnFailure: true,
      });
      if (!session?.token || session.read_only === true) {
        throw Object.assign(new Error('Full Ops Manager authentication is required to synchronize KIOSK_01.'), { httpStatus: 401 });
      }
      headers.Authorization = `Bearer ${session.token}`;
    }
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers,
      body: JSON.stringify({ device_id: requestedDevice, fn, args }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const err = new Error(payload?.error || `HTTP ${response.status}`);
      err.httpStatus = response.status;
      err.retryAfter = response.headers.get('Retry-After') || '';
      throw err;
    }
    return payload.data;
  }

  async function processAction(item) {
    const payload = item?.payload && typeof item.payload === 'object' ? { ...item.payload } : {};
    let result;
    switch (safeText(item?.type)) {
      case 'record_scan_event': result = await rpc('tool_record_scan_event', payload); break;
      case 'ping_device': result = await rpc('tool_ping_device', payload); break;
      case 'start_session': result = await rpc('tool_start_session_v2', payload); break;
      case 'finish_session': {
        const sessionIdentifier = safeText(payload.p_session_uuid || payload.p_client_session_id);
        if (!sessionIdentifier) throw Object.assign(new Error('Historical finish record has no exact session identifier and requires manager reconciliation.'), { httpStatus: 422 });
        result = await rpc('tool_finish_session', {
          ...payload,
          p_session_uuid: sessionIdentifier,
          p_finish_operation_id: item.operation_id,
        });
        break;
      }
      case 'complete_session': {
        const sessionIdentifier = safeText(payload.p_session_uuid || payload.p_client_session_id);
        if (!sessionIdentifier) throw Object.assign(new Error('Historical completion record has no exact session identifier and requires manager reconciliation.'), { httpStatus: 422 });
        result = await rpc('tool_complete_session', {
          ...payload,
          p_session_uuid: sessionIdentifier,
          p_client_completion_id: safeText(payload.p_client_completion_id || item.operation_id),
        });
        break;
      }
      case 'commit_workflow': result = await rpc('tool_commit_cleaning_workflow', payload); break;
      case 'evaluate_location_proximity':
      case 'evaluate_location_proximity_v2': {
        const sessionIdentifier = safeText(payload.p_session_uuid);
        const local = sessionIdentifier ? exactSessionForPayload(payload) : null;
        const localStatus = safeText(local?.status).toLowerCase();
        if (sessionIdentifier && (!local || !['active', 'server-active'].includes(localStatus))) {
          result = { discarded: true, reason: 'local_session_is_no_longer_active' };
          break;
        }
        result = await rpc(item.type === 'evaluate_location_proximity_v2'
          ? 'tool_evaluate_location_proximity_v2'
          : 'tool_evaluate_location_proximity', payload);
        break;
      }
      default: throw Object.assign(new Error(`Unknown queued action type: ${safeText(item?.type)}`), { httpStatus: 422 });
    }
    if (item.type === 'start_session' && result?.session_uuid) {
      const clientId = safeText(payload.p_client_session_id || item.client_id);
      const local = exactSessionForPayload({ p_client_session_id: clientId });
      if (local) {
        const localStatus = safeText(local.status).toLowerCase();
        const completionPending = ['pending_submit', 'pending_sync'].includes(localStatus)
          || local.completion_pending === true
          || Boolean(local.client_completion_id || local.ended_at || local.response_json);
        const authoritative = completionPending
          ? {
              ...result,
              status: localStatus === 'pending_sync' ? 'pending_sync' : 'pending_submit',
              state: safeText(local.state) || 'submitting-completion',
              ended_at: local.ended_at || null,
              duration_display: local.duration_display || null,
              client_completion_id: local.client_completion_id || null,
              response_json: local.response_json || null,
              completion_pending: local.completion_pending === true,
              offline: local.offline === true,
              sync_status: safeText(local.sync_status) || 'submission_pending',
            }
          : result;
        removeSession(local.session_uuid);
        removeSession(clientId);
        saveSession({
          ...local,
          ...authoritative,
          client_session_id: clientId,
          server_acknowledged: true,
          sync_status: completionPending ? (safeText(local.sync_status) || 'submission_pending') : 'synced',
        });
      }
    }
    if (item.type === 'finish_session' && result?.session_uuid) {
      const local = exactSessionForPayload(payload);
      if (local) {
        removeSession(local.session_uuid);
        saveSession({ ...local, ...result, client_session_id: local.client_session_id || local.session_uuid, server_acknowledged: true, sync_status: 'synced' });
      }
    }
    if ((item.type === 'complete_session' || item.type === 'commit_workflow') && result?.status === 'closed') {
      const local = exactSessionForPayload(payload);
      [local?.session_uuid, local?.client_session_id, payload.p_client_session_id, payload.p_session_uuid, result.session_uuid].map(safeText).filter(Boolean).forEach(removeSession);
    }
    if (result?.discard_local_workflow === true || result?.terminal === true || safeText(result?.status).toLowerCase() === 'cancelled') {
      const local = exactSessionForPayload(payload);
      [local?.session_uuid, local?.client_session_id, payload.p_client_session_id, payload.p_session_uuid, result.client_session_id, result.session_uuid].map(safeText).filter(Boolean).forEach(removeSession);
    }
    return result;
  }

  async function reportDeviceSyncStatus(items = null) {
    if (!state.deviceId || !navigator.onLine) return null;
    const queue = Array.isArray(items) ? items : await listActions();
    const oldestMs = queue.reduce((min, item) => item.created_at > 0 && (!min || item.created_at < min) ? item.created_at : min, 0);
    const retryCount = queue.reduce((total, item) => total + Number(item.retry_count || 0), 0);
    try {
      const result = await rpc('tool_report_device_sync_status', {
        p_device_identifier: state.deviceId,
        p_queue_count: queue.length,
        p_oldest_item_at: oldestMs ? new Date(oldestMs).toISOString() : null,
        p_retry_count: retryCount,
        p_last_server_ack_at: state.lastServerAckAt,
        p_frontend_version: CONFIG.FRONTEND_VERSION,
        p_last_error: state.lastError,
        p_correlation_id: `sync:${state.deviceId}:${crypto.randomUUID()}`,
      });
      state.lastServerAckAt = new Date().toISOString();
      state.lastError = null;
      return result;
    } catch (error) {
      state.lastError = safeText(error?.message || 'Sync status report failed').slice(0, 1000);
      return null;
    }
  }

  async function runWorker() {
    if (state.syncing || !state.db || !navigator.onLine || !state.deviceId) return false;
    state.syncing = true;
    try {
      let processed = 0;
      while (processed < 100) {
        refreshFallbackLock();
        const item = await claimNextAction();
        if (!item) break;
        try {
          const result = await processAction(item);
          state.lastServerAckAt = new Date().toISOString();
          state.lastError = null;
          await finishClaim(item, { succeeded: true });
          dispatchStatus({ status: 'synced', item, result });
        } catch (error) {
          const status = Number(error?.httpStatus || 0);
          const staleTelemetry = ['evaluate_location_proximity', 'evaluate_location_proximity_v2'].includes(safeText(item.type))
            && /session does not belong|session is no longer active|active session not found/i.test(safeText(error?.message));
          const permanent = staleTelemetry || (status >= 400 && status < 500 && ![408, 429].includes(status));
          const retryAfterMs = status === 429 ? parseRetryAfter(error?.retryAfter) : 0;
          state.lastError = safeText(error?.message || 'Sync failed').slice(0, 1000);
          const disposableTelemetry = permanent
            && ['evaluate_location_proximity', 'evaluate_location_proximity_v2'].includes(safeText(item.type));
          await finishClaim(item, disposableTelemetry
            ? { succeeded: true }
            : { succeeded: false, error: state.lastError, permanent, retryAfterMs });
          dispatchStatus({ status: disposableTelemetry ? 'discarded' : (permanent ? 'dead-letter' : 'retrying'), item, error: state.lastError });
        }
        processed += 1;
      }
      const remaining = await listActions();
      await reportDeviceSyncStatus(remaining);
      dispatchStatus({ status: 'idle', queued: remaining.length, dead_letters: remaining.filter((item) => item.dead_letter).length });
      state.channel?.postMessage({ type: 'sync-complete', queued: remaining.length });
      refreshRecoveryButton().catch(() => {});
      return true;
    } finally {
      state.syncing = false;
    }
  }

  async function sync() {
    await ready;
    if (!state.db || !navigator.onLine || !state.deviceId) return false;
    if (navigator.locks?.request) {
      return navigator.locks.request(CONFIG.WEB_LOCK_NAME, { ifAvailable: true, mode: 'exclusive' }, (lock) => lock ? runWorker() : false);
    }
    if (!acquireFallbackLock()) return false;
    try { return await runWorker(); } finally { releaseFallbackLock(); }
  }

  async function recoverDeadLetter(id) {
    if (!state.db) throw new Error('The durable scan queue is not ready.');
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        if (!request.result) return;
        store.put({ ...normalizeRecord(request.result), dead_letter: false, state: 'reconciliation-required', next_attempt_at: 0, lease_owner: null, lease_token: null, lease_until: 0 });
      };
      tx.oncomplete = () => { resolve(true); window.setTimeout(() => sync(), 0); };
      tx.onerror = () => reject(tx.error);
    });
  }

  async function discardDeadLetter(id) {
    if (!state.db) throw new Error('The durable scan queue is not ready.');
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.get(id);
      let removed = false;
      request.onsuccess = () => {
        if (!request.result?.dead_letter) return;
        removed = true;
        store.delete(id);
      };
      tx.oncomplete = () => {
        dispatchStatus({ status: 'dead-letter-discarded', id, removed });
        resolve(removed);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  function deadLetterSummary(item) {
    const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {};
    return {
      id: item?.id,
      operation_id: item?.operation_id || null,
      type: safeText(item?.type) || 'unknown',
      state: safeText(item?.state) || 'dead-letter',
      created_at: safeIsoTimestamp(item?.created_at),
      retry_count: Number(item?.retry_count || 0),
      last_error: safeText(item?.last_error || 'No error detail was recorded.'),
      session_id: safeText(payload.p_session_uuid || payload.p_client_session_id) || null,
      location_code: safeText(payload.p_location_code) || null,
      device_id: safeText(payload.p_device_id || payload.p_device_identifier || state.deviceId) || null,
    };
  }

  function downloadDeadLetterReport(items) {
    const body = JSON.stringify({
      exported_at: new Date().toISOString(),
      device_id: state.deviceId || null,
      queue_schema_version: CONFIG.SCHEMA_VERSION,
      dead_letters: items.map(deadLetterSummary),
    }, null, 2);
    const blob = new Blob([body], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `memphis-scan-recovery-${state.deviceId || 'device'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function showRecoveryPanel() {
    const existing = document.getElementById('memphis-scan-recovery-dialog');
    if (existing) existing.remove();
    const queue = await listActions();
    const deadLetters = queue.filter((item) => item.dead_letter === true);
    const dialog = document.createElement('dialog');
    dialog.id = 'memphis-scan-recovery-dialog';
    dialog.setAttribute('aria-label', 'Scan synchronization recovery');
    dialog.style.cssText = 'width:min(720px,94vw);max-height:88vh;padding:0;border:1px solid #64748b;border-radius:18px;background:#0f172a;color:#f8fafc;box-shadow:0 24px 70px rgba(0,0,0,.55);';
    const rows = deadLetters.map((item) => {
      const summary = deadLetterSummary(item);
      return `<article style="padding:14px;border:1px solid #334155;border-radius:12px;background:#111827">
        <strong>${escapeHtml(summary.type)}</strong>
        <div style="margin-top:7px;font-size:.88rem;color:#cbd5e1">Created ${escapeHtml(summary.created_at || 'unknown')} · retries ${summary.retry_count}</div>
        <div style="margin-top:7px;font-size:.88rem">Session: ${escapeHtml(summary.session_id || 'not recorded')}<br>Location: ${escapeHtml(summary.location_code || 'not recorded')}</div>
        <div style="margin-top:9px;padding:9px;border-radius:9px;background:#450a0a;color:#fecaca">${escapeHtml(summary.last_error)}</div>
        <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:12px">
          <button type="button" data-retry="${item.id}" style="padding:10px 14px;border:0;border-radius:10px;background:#84c341;color:#07110a;font-weight:900">Retry once</button>
          <button type="button" data-discard="${item.id}" style="padding:10px 14px;border:1px solid #ef4444;border-radius:10px;background:#1f2937;color:#fecaca;font-weight:800">Discard from phone</button>
        </div>
      </article>`;
    }).join('');
    dialog.innerHTML = `<div style="padding:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div><div style="font-size:1.25rem;font-weight:900">Scan Recovery</div><div style="margin-top:4px;color:#cbd5e1;font-size:.9rem">${queue.length} queued · ${deadLetters.length} require review</div></div>
        <button type="button" data-close style="padding:9px 12px;border:1px solid #64748b;border-radius:10px;background:#1e293b;color:#fff">Close</button>
      </div>
      <p style="color:#cbd5e1;line-height:1.45">Review the exact failed operation and error. Retry only after the cause is corrected. Discard removes the operation from this phone and cannot submit it later.</p>
      <div style="display:grid;gap:12px">${rows || '<div style="padding:18px;border-radius:12px;background:#052e16;color:#bbf7d0">No dead letters. The queue has nothing requiring manual recovery.</div>'}</div>
      ${deadLetters.length ? '<button type="button" data-export style="margin-top:14px;padding:10px 14px;border:1px solid #94a3b8;border-radius:10px;background:#1e293b;color:#fff;font-weight:800">Export recovery report</button>' : ''}
    </div>`;
    document.body.append(dialog);
    dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-export]')?.addEventListener('click', () => downloadDeadLetterReport(deadLetters));
    dialog.querySelectorAll('[data-retry]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      await recoverDeadLetter(Number(button.dataset.retry));
      dialog.close();
    }));
    dialog.querySelectorAll('[data-discard]').forEach((button) => button.addEventListener('click', async () => {
      const item = deadLetters.find((candidate) => String(candidate.id) === String(button.dataset.discard));
      const summary = deadLetterSummary(item);
      if (!window.confirm(`Discard ${summary.type} for ${summary.location_code || summary.session_id || 'this operation'} from this phone? This cannot submit it later.`)) return;
      button.disabled = true;
      await discardDeadLetter(Number(button.dataset.discard));
      dialog.close();
      await showRecoveryPanel();
    }));
    dialog.addEventListener('close', () => dialog.remove());
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return deadLetters.length;
  }

  async function refreshRecoveryButton() {
    if (!document?.body) return;
    const queue = await listActions();
    const deadCount = queue.filter((item) => item.dead_letter === true).length;
    let button = document.getElementById('memphis-scan-recovery-button');
    if (!deadCount) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.id = 'memphis-scan-recovery-button';
      button.type = 'button';
      button.style.cssText = 'position:fixed;right:10px;bottom:max(10px,env(safe-area-inset-bottom));z-index:10020;padding:11px 14px;border:2px solid #fecaca;border-radius:999px;background:#7f1d1d;color:#fff;font:900 13px/1.1 Arial,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.42)';
      button.addEventListener('click', () => showRecoveryPanel().catch(console.warn));
      document.body.append(button);
    }
    button.textContent = `Recovery needed · ${deadCount}`;
  }

  async function init() {
    state.deviceId = resolveDeviceId();
    if (!window.indexedDB) return false;
    state.db = await openDb();
    now();
    state.channel?.addEventListener('message', (event) => {
      if (event.data?.type === 'queued' && navigator.onLine) window.setTimeout(() => sync(), 50);
      dispatchStatus({ status: 'peer-update', ...event.data });
      refreshRecoveryButton().catch(() => {});
    });
    state.timer = window.setInterval(() => sync(), CONFIG.POLL_MS);
    window.addEventListener('online', () => sync());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
    window.setTimeout(() => sync(), 900);
    window.setTimeout(() => refreshRecoveryButton().catch(() => {}), 950);
    return true;
  }

  const ready = init().catch((error) => {
    console.warn('Scan synchronization worker could not open its durable queue', error);
    state.lastError = safeText(error?.message || error);
    return false;
  });
  window.MemphisScanSync = {
    ready,
    sync,
    enqueue,
    listActions,
    reportDeviceSyncStatus,
    recoverDeadLetter,
    discardDeadLetter,
    showRecoveryPanel,
    resolveDeviceId: () => state.deviceId || resolveDeviceId(),
    queueSchemaVersion: CONFIG.SCHEMA_VERSION,
  };
})();
