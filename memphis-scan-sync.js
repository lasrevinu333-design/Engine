(() => {
  'use strict';

  const CONFIG = {
    API_URL: 'https://memphis-zoo-mcp.onrender.com/scan-api/rpc',
    DB_NAME: 'mz_scan_queue',
    STORE_NAME: 'actions',
    DB_VERSION: 3,
    POLL_MS: 30000,
    LOCK_KEY: 'mz_scan_sync_worker_lock',
    LOCK_TTL_MS: 45000,
    FRONTEND_VERSION: 'release-2026.07.15.schedule-messaging.5',
  };

  const state = {
    db: null,
    deviceId: '',
    syncing: false,
    workerId: `worker-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timer: null,
    lastServerAckAt: null,
    lastError: null,
  };

  function safeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function resolveDeviceId() {
    const shared = window.MemphisDeviceIdentity?.resolve?.({ url: new URL(window.location.href) });
    return safeText(shared?.deviceId);
  }

  function sessionKey(id) {
    return `session:${safeText(id)}`;
  }

  function readSession(id) {
    const normalized = safeText(id);
    if (!normalized) return null;
    try {
      const raw = localStorage.getItem(sessionKey(normalized));
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  }

  function removeSession(id) {
    const normalized = safeText(id);
    if (!normalized) return;
    try { localStorage.removeItem(sessionKey(normalized)); } catch (_err) {}
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
        if (!key || !key.startsWith('session:')) continue;
        try {
          const value = JSON.parse(localStorage.getItem(key));
          if (value && typeof value === 'object') rows.push(value);
        } catch (_err) {}
      }
    } catch (_err) {}
    return rows;
  }

  function latestSessionFor({ locationCode = '', deviceId = '' } = {}) {
    const location = safeText(locationCode).toUpperCase();
    const device = safeText(deviceId).toUpperCase();
    return allSessions()
      .filter((row) => !location || safeText(row.location_code || row.location_name).toUpperCase() === location)
      .filter((row) => !device || safeText(row.device_id).toUpperCase() === device)
      .sort((left, right) => Date.parse(right.started_at || 0) - Date.parse(left.started_at || 0))[0] || null;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
          db.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function listActions() {
    if (!state.db) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readonly');
      const request = tx.objectStore(CONFIG.STORE_NAME).getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error);
    });
  }

  function deleteAction(id) {
    if (!state.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      tx.objectStore(CONFIG.STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function updateAction(id, patch) {
    if (!state.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        if (!request.result) return;
        store.put({ ...request.result, ...patch });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function dispatchStatus(detail) {
    try {
      window.dispatchEvent(new CustomEvent('memphis-scan-sync', { detail }));
    } catch (_err) {}
  }

  function acquireLock() {
    const now = Date.now();
    try {
      const current = JSON.parse(localStorage.getItem(CONFIG.LOCK_KEY) || 'null');
      if (current?.owner && current.owner !== state.workerId && now - Number(current.at || 0) < CONFIG.LOCK_TTL_MS) return false;
      localStorage.setItem(CONFIG.LOCK_KEY, JSON.stringify({ owner: state.workerId, at: now }));
      const check = JSON.parse(localStorage.getItem(CONFIG.LOCK_KEY) || 'null');
      return check?.owner === state.workerId;
    } catch (_err) {
      return true;
    }
  }

  function refreshLock() {
    try { localStorage.setItem(CONFIG.LOCK_KEY, JSON.stringify({ owner: state.workerId, at: Date.now() })); } catch (_err) {}
  }

  function releaseLock() {
    try {
      const current = JSON.parse(localStorage.getItem(CONFIG.LOCK_KEY) || 'null');
      if (current?.owner === state.workerId) localStorage.removeItem(CONFIG.LOCK_KEY);
    } catch (_err) {}
  }

  async function rpc(fn, args = {}) {
    const requestedDevice = state.deviceId || safeText(args.p_device_id || args.p_device_identifier);
    if (!requestedDevice) throw new Error('This phone has no verified device identity.');
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': requestedDevice },
      body: JSON.stringify({ device_id: requestedDevice, fn, args }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload.data;
  }

  async function processAction(item) {
    const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {};
    let result;
    switch (safeText(item?.type)) {
      case 'record_scan_event': result = await rpc('tool_record_scan_event', payload); break;
      case 'ping_device': result = await rpc('tool_ping_device', payload); break;
      case 'start_session': result = await rpc('tool_start_session', payload); break;
      case 'finish_session': result = await rpc('tool_finish_session', payload); break;
      case 'complete_session': result = await rpc('tool_complete_session', payload); break;
      case 'commit_workflow': result = await rpc('tool_commit_cleaning_workflow', payload); break;
      case 'evaluate_location_proximity': result = await rpc('tool_evaluate_location_proximity', payload); break;
      default: throw new Error(`Unknown queued action type: ${safeText(item?.type)}`);
    }

    if (item.type === 'start_session' && result?.session_uuid) {
      const clientId = safeText(payload.p_client_session_id || item.client_id);
      const local = readSession(clientId);
      if (local) {
        removeSession(clientId);
        saveSession({ ...local, ...result, client_session_id: clientId, server_acknowledged: true, sync_status: 'synced' });
      }
    }

    if (item.type === 'finish_session' && result?.session_uuid) {
      const local = latestSessionFor({ locationCode: payload.p_location_code, deviceId: payload.p_device_id });
      if (local) {
        if (local.session_uuid !== result.session_uuid) removeSession(local.session_uuid);
        saveSession({ ...local, ...result, client_session_id: local.client_session_id || local.session_uuid, server_acknowledged: true, sync_status: 'synced' });
      }
    }

    if ((item.type === 'complete_session' || item.type === 'commit_workflow') && result?.status === 'closed') {
      const clientId = safeText(payload.p_client_session_id || payload.p_session_uuid);
      const local = readSession(clientId) || latestSessionFor({ locationCode: payload.p_location_code, deviceId: payload.p_device_id });
      if (local?.session_uuid) removeSession(local.session_uuid);
      removeSession(clientId);
      removeSession(result.session_uuid);
    }


    if (result?.discard_local_workflow === true || result?.terminal === true || safeText(result?.status).toLowerCase() === 'cancelled') {
      const local = latestSessionFor({
        locationCode: payload.p_location_code,
        deviceId: payload.p_device_id || payload.p_device_identifier,
      });
      const identifiers = new Set([
        payload.p_client_session_id,
        payload.p_session_uuid,
        result.client_session_id,
        result.session_uuid,
        local?.client_session_id,
        local?.session_uuid,
      ].map(safeText).filter(Boolean));
      for (const identifier of identifiers) removeSession(identifier);
    }

    return result;
  }


  async function reportDeviceSyncStatus(items = null) {
    if (!state.deviceId || !navigator.onLine) return null;
    const queue = Array.isArray(items) ? items : await listActions();
    const oldestMs = queue.reduce((min, item) => {
      const value = Number(item?.created_at || 0);
      return value > 0 && (!min || value < min) ? value : min;
    }, 0);
    const retryCount = queue.reduce((total, item) => total + Number(item?.retry_count || 0), 0);
    try {
      const result = await rpc('tool_report_device_sync_status', {
        p_device_identifier: state.deviceId,
        p_queue_count: queue.length,
        p_oldest_item_at: oldestMs ? new Date(oldestMs).toISOString() : null,
        p_retry_count: retryCount,
        p_last_server_ack_at: state.lastServerAckAt,
        p_frontend_version: CONFIG.FRONTEND_VERSION,
        p_last_error: state.lastError,
        p_correlation_id: `sync:${state.deviceId}:${Date.now()}`,
      });
      state.lastServerAckAt = new Date().toISOString();
      state.lastError = null;
      return result;
    } catch (error) {
      state.lastError = String(error?.message || error || 'Sync status report failed').slice(0, 1000);
      return null;
    }
  }

  function retryDelay(retryCount) {
    return Math.min(15 * 60 * 1000, Math.max(5000, 5000 * (2 ** Math.min(Number(retryCount || 0), 8)))) + Math.floor(Math.random() * 3000);
  }

  function mayDrop(item, retryCount) {
    if (['start_session', 'finish_session', 'complete_session', 'commit_workflow'].includes(safeText(item?.type))) return false;
    return Number(retryCount || 0) >= 50;
  }

  async function sync() {
    if (state.syncing || !state.db || !navigator.onLine || !state.deviceId || !acquireLock()) return;
    state.syncing = true;
    try {
      const items = (await listActions()).sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0));
      dispatchStatus({ status: 'running', queued: items.length });
      for (const item of items) {
        refreshLock();
        if (Number(item.next_attempt_at || 0) > Date.now()) continue;
        try {
          const result = await processAction(item);
          state.lastServerAckAt = new Date().toISOString();
          state.lastError = null;
          await deleteAction(item.id);
          dispatchStatus({ status: 'synced', item, result });
        } catch (error) {
          const retryCount = Number(item.retry_count || 0) + 1;
          state.lastError = String(error?.message || error || 'Sync failed').slice(0, 1000);
          await updateAction(item.id, {
            retry_count: retryCount,
            last_error: String(error?.message || error || 'Sync failed'),
            last_attempt_at: Date.now(),
            next_attempt_at: Date.now() + retryDelay(retryCount),
          });
          if (mayDrop(item, retryCount)) await deleteAction(item.id);
          dispatchStatus({ status: 'retrying', item, retryCount, error: String(error?.message || error) });
        }
      }
      const remaining = await listActions();
      await reportDeviceSyncStatus(remaining);
      dispatchStatus({ status: 'idle', queued: remaining.length });
    } finally {
      state.syncing = false;
      releaseLock();
    }
  }

  async function init() {
    state.deviceId = resolveDeviceId();
    if (!state.deviceId || !window.indexedDB) return;
    try { state.db = await openDb(); } catch (error) {
      console.warn('Scan synchronization worker could not open its queue', error);
      return;
    }
    window.MemphisScanSync = { sync, listActions, reportDeviceSyncStatus, resolveDeviceId: () => state.deviceId };
    window.setTimeout(sync, 900);
    state.timer = window.setInterval(sync, CONFIG.POLL_MS);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
