(() => {
  'use strict';

  const CONFIG = {
    API_URL: 'https://memphis-zoo-mcp.onrender.com/scan-api/rpc',
    VERSION_URL: 'https://memphis-zoo-mcp.onrender.com/version',
    DB_NAME: 'mz_scan_queue',
    STORE_NAME: 'actions',
    COMPLETION_DRAFT_DB_NAME: 'mz_scan_completion_drafts',
    COMPLETION_DRAFT_STORE_NAME: 'drafts',
    COMPLETION_DRAFT_SCHEMA_VERSION: 1,
    // Physical v5/v6 candidates existed before the accepted v4 fleet baseline.
    // openDb normalizes those known versions back to v4 through a verified
    // shadow copy so both the current worker and the fleet rollback can open it.
    DB_VERSION: 4,
    SCHEMA_VERSION: 6,
    MAX_KNOWN_DB_VERSION: 6,
    ROLLBACK_BACKUP_DB_NAME: 'mz_scan_queue_v6_to_v4_backup',
    POLL_MS: 30000,
    LEASE_MS: 60000,
    FALLBACK_LOCK_KEY: 'mz_scan_sync_worker_lock_v4',
    FALLBACK_LOCK_TTL_MS: 75000,
    FALLBACK_LOCK_HEARTBEAT_MS: 15000,
    FALLBACK_LOCK_WAIT_MS: 90000,
    WEB_LOCK_NAME: 'memphis-scan-queue-v4',
    CHANNEL_NAME: 'memphis-scan-queue-v4',
    MAX_RETRIES: 50,
    ADMISSION_MAX_BATCHES: 64,
    FRONTEND_VERSION: 'release-2026.07.19.custodial-v3.12',
    MINIMUM_BACKEND_VERSION: 'release-2026.07.19.custodial-v3.12',
    REQUIRED_SCAN_CONTRACT_VERSION: 'scan.v4.snapshot-bound-authority',
    REQUIRED_BACKEND_SCHEMA_FINGERPRINT: '0c3cd0cb822f147842d5c09a2bc15ffae41401956b7664f2ccfaedd13b79d527',
  };

  const state = {
    db: null,
    deviceId: '',
    syncing: false,
    initializing: null,
    listenersInstalled: false,
    workerId: `scan-worker-${crypto.randomUUID()}`,
    timer: null,
    channel: typeof BroadcastChannel === 'function' ? new BroadcastChannel(CONFIG.CHANNEL_NAME) : null,
    lastServerAckAt: null,
    lastError: null,
  };

  function custodialSecurity() {
    const security = window.MemphisCustodialSecurity;
    return security && typeof security === 'object' ? security : null;
  }

  function securityErrorIsPause(error) {
    return ['custodial_restore_quarantine', 'custodial_secure_storage_unavailable', 'custodial_security_state_unavailable', 'custodial_security_generation_changed', 'custodial_device_not_enrolled', 'custodial_enrollment_confirmation_pending', 'custodial_enrollment_removal_pending']
      .includes(safeText(error?.code));
  }

  async function securityPause() {
    const security = custodialSecurity();
    if (!security) return null;
    try {
      if (typeof security.waitForStableState === 'function') await security.waitForStableState({ requireEnrollment: true });
      const status = typeof security.getStatus === 'function' ? security.getStatus() : null;
      if (status?.ready !== true || status?.quarantined === true || status?.available === false) {
        return {
          reason: safeText(status.reason || (status.quarantined ? 'custodial_restore_quarantine' : 'custodial_secure_storage_unavailable')),
          recovery: status.recovery || null,
        };
      }
      return null;
    } catch (error) {
      return {
        reason: safeText(error?.reason || error?.code || 'custodial_security_unavailable'),
        recovery: error?.recovery || null,
      };
    }
  }

  async function mutateProtectedQueue(operation, options = { requireEnrollment: true }) {
    const security = custodialSecurity();
    if (!security) return operation({ deviceId: state.deviceId, generation: null, state: 'legacy' });
    return security.mutateProtectedWork(operation, options);
  }

  function dispatchSecurityPause(pause) {
    dispatchStatus({
      status: 'security-paused',
      reason: safeText(pause?.reason || 'custodial_security_pause'),
      recovery: pause?.recovery || null,
    });
  }

  function observeSync(promise) {
    void Promise.resolve(promise).catch((error) => {
      if (securityErrorIsPause(error)) {
        dispatchSecurityPause({ reason: safeText(error?.reason || error?.code), recovery: error?.recovery || null });
        return;
      }
      state.lastError = safeText(error?.message || error || 'Scan synchronization failed').slice(0, 1000);
      dispatchStatus({ status: 'worker-error', error: state.lastError });
    });
  }

  function scheduleSync(delay = 0) {
    return window.setTimeout(() => observeSync(sync()), delay);
  }

  function safeText(value) { return String(value == null ? '' : value).trim(); }
  function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeText(value)); }
  function now() { return Date.now(); }
  function canonicalJson(value) { return JSON.stringify(canonicalizeSemanticValue(value)); }
  async function sha256(value) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  function storageFailure(boundary, error) {
    const failure = new Error(`Durable ${boundary} storage is unavailable: ${safeText(error?.message || error || 'write verification failed')}`);
    failure.code = 'custodial_storage_unavailable';
    failure.cause = error;
    return failure;
  }
  function releaseVersionTuple(value) {
    const match = safeText(value).match(/^release-(\d{4})\.(\d{2})\.(\d{2})\.custodial-v(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }
  function backendMeetsMinimum(value) {
    const actual = releaseVersionTuple(value);
    const minimum = releaseVersionTuple(CONFIG.MINIMUM_BACKEND_VERSION);
    if (!actual || !minimum) return false;
    for (let index = 0; index < minimum.length; index += 1) {
      if (actual[index] > minimum[index]) return true;
      if (actual[index] < minimum[index]) return false;
    }
    return true;
  }

  function openCompletionDraftDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.COMPLETION_DRAFT_DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(CONFIG.COMPLETION_DRAFT_STORE_NAME)) {
          request.result.createObjectStore(CONFIG.COMPLETION_DRAFT_STORE_NAME, { keyPath: 'session_uuid' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(storageFailure('completion draft', request.error));
      request.onblocked = () => reject(storageFailure('completion draft', new Error('database upgrade is blocked')));
    });
  }

  function completionDraftIdentity(input = {}) {
    const identity = {
      schema_version: CONFIG.COMPLETION_DRAFT_SCHEMA_VERSION,
      contract_version: safeText(input.contract_version),
      session_uuid: safeText(input.session_uuid).toLowerCase(),
      client_completion_id: safeText(input.client_completion_id).toLowerCase(),
      device_id: safeText(input.device_id).toUpperCase(),
      employee_id: safeText(input.employee_id).toLowerCase(),
      location_code: safeText(input.location_code).toUpperCase(),
    };
    if (!isUuid(identity.session_uuid) || !isUuid(identity.client_completion_id) || !isUuid(identity.employee_id)
      || !/^KIOSK_(?:0[2-9]|10)$/.test(identity.device_id)
      || !/^[A-Z0-9._:-]{1,100}$/.test(identity.location_code)
      || identity.contract_version !== CONFIG.REQUIRED_SCAN_CONTRACT_VERSION) {
      throw storageFailure('completion draft', new Error('exact draft identity is required'));
    }
    return identity;
  }

  async function completionDraftRecord(input = {}) {
    const identity = completionDraftIdentity(input);
    const draft = input.draft && typeof input.draft === 'object' && !Array.isArray(input.draft)
      ? canonicalizeSemanticValue(input.draft) : null;
    const encodedDraft = draft ? canonicalJson(draft) : '';
    if (!draft || encodedDraft.length > 64 * 1024) throw storageFailure('completion draft', new Error('draft is invalid or too large'));
    const protectedContent = { ...identity, draft };
    return {
      ...protectedContent,
      integrity_sha256: await sha256(canonicalJson(protectedContent)),
      saved_at: new Date().toISOString(),
    };
  }

  async function verifyCompletionDraftRecord(record, expected = {}) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    const identity = completionDraftIdentity(record);
    const required = completionDraftIdentity({ ...record, ...expected });
    for (const key of ['schema_version', 'contract_version', 'session_uuid', 'client_completion_id', 'device_id', 'employee_id', 'location_code']) {
      if (identity[key] !== required[key]) throw storageFailure('completion draft', new Error(`draft ${key} does not match current work`));
    }
    const draft = record.draft && typeof record.draft === 'object' && !Array.isArray(record.draft)
      ? canonicalizeSemanticValue(record.draft) : null;
    const expectedDigest = await sha256(canonicalJson({ ...identity, draft }));
    if (!draft || safeText(record.integrity_sha256) !== expectedDigest) {
      throw storageFailure('completion draft', new Error('integrity check failed'));
    }
    return { ...record, ...identity, draft, integrity_sha256: expectedDigest };
  }

  async function saveCompletionDraft(input) {
    if (!window.indexedDB) throw storageFailure('completion draft', new Error('IndexedDB is unavailable'));
    return mutateProtectedQueue(async () => {
      const record = await completionDraftRecord(input);
      const db = await openCompletionDraftDb();
      try {
        await new Promise((resolve, reject) => {
          const transaction = db.transaction(CONFIG.COMPLETION_DRAFT_STORE_NAME, 'readwrite');
          transaction.objectStore(CONFIG.COMPLETION_DRAFT_STORE_NAME).put(record);
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(storageFailure('completion draft', transaction.error));
          transaction.onabort = () => reject(storageFailure('completion draft', transaction.error || new Error('write aborted')));
        });
        const verified = await loadCompletionDraft(record);
        if (!verified || verified.integrity_sha256 !== record.integrity_sha256) throw storageFailure('completion draft', new Error('write verification failed'));
        return verified;
      } finally { db.close(); }
    });
  }

  async function loadCompletionDraft(expected) {
    if (!window.indexedDB) throw storageFailure('completion draft', new Error('IndexedDB is unavailable'));
    const identity = completionDraftIdentity(expected);
    const db = await openCompletionDraftDb();
    try {
      const record = await new Promise((resolve, reject) => {
        const transaction = db.transaction(CONFIG.COMPLETION_DRAFT_STORE_NAME, 'readonly');
        const request = transaction.objectStore(CONFIG.COMPLETION_DRAFT_STORE_NAME).get(identity.session_uuid);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(storageFailure('completion draft', request.error));
      });
      return record ? verifyCompletionDraftRecord(record, identity) : null;
    } finally { db.close(); }
  }

  async function deleteCompletionDraft(sessionUuid) {
    const id = safeText(sessionUuid).toLowerCase();
    if (!isUuid(id)) throw storageFailure('completion draft', new Error('session identifier is required'));
    if (!window.indexedDB) throw storageFailure('completion draft', new Error('IndexedDB is unavailable'));
    return mutateProtectedQueue(async () => {
      const db = await openCompletionDraftDb();
      try {
        await new Promise((resolve, reject) => {
          const transaction = db.transaction(CONFIG.COMPLETION_DRAFT_STORE_NAME, 'readwrite');
          transaction.objectStore(CONFIG.COMPLETION_DRAFT_STORE_NAME).delete(id);
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(storageFailure('completion draft', transaction.error));
          transaction.onabort = () => reject(storageFailure('completion draft', transaction.error || new Error('delete aborted')));
        });
      } finally { db.close(); }
      return true;
    });
  }
  async function verifyWorkerBackendCompatibility() {
    try {
      const response = await fetch(CONFIG.VERSION_URL, { cache: 'no-store', credentials: 'omit' });
      const payload = await response.json().catch(() => null);
      const version = safeText(payload?.version);
      const contract = safeText(payload?.contracts?.scan);
      const schemaFingerprint = safeText(payload?.release_manifest?.schema?.fingerprint);
      if (
        !response.ok
        || contract !== CONFIG.REQUIRED_SCAN_CONTRACT_VERSION
        || schemaFingerprint !== CONFIG.REQUIRED_BACKEND_SCHEMA_FINGERPRINT
        || !backendMeetsMinimum(version)
      ) {
        dispatchStatus({
          status: 'compatibility-paused',
          backend_version: version || null,
          scan_contract: contract || null,
          schema_fingerprint: schemaFingerprint || null,
        });
        return false;
      }
      return true;
    } catch (error) {
      dispatchStatus({ status: 'compatibility-paused', error: safeText(error?.message || error).slice(0, 1000) });
      return false;
    }
  }
  function resolveDeviceId() {
    const security = custodialSecurity();
    if (security?.native === true) {
      const status = security.getStatus?.();
      return status?.ready === true && status?.available === true ? safeText(status.deviceId) : '';
    }
    const shared = window.MemphisDeviceIdentity?.resolve?.({ url: new URL(window.location.href) });
    return safeText(shared?.deviceId);
  }
  function sessionKey(id) { return `session:${safeText(id)}`; }
  function readSession(id) {
    const key = sessionKey(id);
    if (key === 'session:') return null;
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (error) { throw storageFailure('local workflow', error); }
  }
  function removeSession(id) {
    const key = sessionKey(id);
    if (key === 'session:') return;
    try {
      localStorage.removeItem(key);
      if (localStorage.getItem(key) !== null) throw new Error('delete verification failed');
    } catch (error) {
      throw storageFailure('local workflow', error);
    }
  }
  function saveSession(session) {
    const id = safeText(session?.session_uuid);
    if (!id) throw storageFailure('local workflow', new Error('session identifier is required'));
    let encoded;
    try { encoded = JSON.stringify(session); } catch (error) { throw storageFailure('local workflow', error); }
    try {
      localStorage.setItem(sessionKey(id), encoded);
      if (localStorage.getItem(sessionKey(id)) !== encoded) throw new Error('write verification failed');
      return true;
    } catch (error) {
      throw storageFailure('local workflow', error);
    }
  }
  function allSessions() {
    const rows = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith('session:')) continue;
        const value = JSON.parse(localStorage.getItem(key));
        if (value && typeof value === 'object') rows.push(value);
      }
    } catch (error) { throw storageFailure('local workflow', error); }
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
    return isUuid(candidate) ? candidate : '';
  }
  function canonicalizeSemanticValue(value) {
    if (Array.isArray(value)) return value.map(canonicalizeSemanticValue);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((canonical, key) => {
        if (value[key] !== undefined) canonical[key] = canonicalizeSemanticValue(value[key]);
        return canonical;
      }, {});
    }
    return value;
  }
  function completionClientIdFor(action = {}) {
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    return safeText(action.completion_client_id || action.client_id || payload.p_client_completion_id);
  }
  function semanticFingerprintFor(action = {}) {
    const type = safeText(action.forward_action_type || action.type);
    if (type !== 'commit_workflow') return '';
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    const supplied = safeText(action.semantic_fingerprint || action.offline_payload_fingerprint || payload.p_offline_payload_fingerprint);
    return supplied || `canonical:${JSON.stringify(canonicalizeSemanticValue(payload))}`;
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
    const semanticFingerprint = semanticFingerprintFor(action);
    const completionClientId = completionClientIdFor(action);
    const forwardReplay = action.forward_replay_contract === CONFIG.REQUIRED_SCAN_CONTRACT_VERSION;
    const type = forwardReplay ? safeText(action.forward_action_type || action.type) : safeText(action.type);
    const deadLetter = forwardReplay ? action.current_dead_letter === true : action.dead_letter === true;
    return {
      ...action,
      type,
      schema_version: CONFIG.SCHEMA_VERSION,
      operation_id: operationId,
      logical_identity: logicalIdentity,
      semantic_fingerprint: semanticFingerprint || null,
      completion_client_id: completionClientId || null,
      logical_key: safeText(action.logical_key) || (safeText(action.type) === 'commit_workflow' && semanticFingerprint
        ? `${safeText(action.type)}:${logicalIdentity}:${semanticFingerprint}`
        : `${safeText(action.type)}:${logicalIdentity}`),
      created_at: Number(action.created_at || now()),
      retry_count: Number(action.retry_count || 0),
      last_error: action.last_error || null,
      last_attempt_at: action.last_attempt_at || null,
      next_attempt_at: Number(action.next_attempt_at || 0),
      dead_letter: deadLetter,
      state: action.recoverable === false
        ? 'legacy-quarantine'
        : (deadLetter
          ? (safeText(action.state) === 'quarantined' ? 'quarantined' : 'dead-letter')
          : safeText(action.state || 'pending')),
      lease_owner: action.lease_owner || null,
      lease_token: action.lease_token || null,
      lease_until: Number(action.lease_until || 0),
    };
  }

  function replayBindingFor(action = {}) {
    const supplied = action.replay_binding && typeof action.replay_binding === 'object' ? action.replay_binding : {};
    const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
    const local = exactSessionForPayload(payload);
    return {
      client_session_id: safeText(supplied.client_session_id || local?.client_session_id || local?.session_uuid || payload.p_client_session_id || payload.p_session_uuid),
      client_completion_id: safeText(supplied.client_completion_id || local?.client_completion_id || payload.p_client_completion_id || action.completion_client_id || action.client_id || action.operation_id),
      occurrence_id: safeText(supplied.occurrence_id || local?.offline_occurrence_id || local?.occurrence_id || local?.offline_actor_context?.occurrence_id),
      context_id: safeText(supplied.context_id || local?.context_id || local?.offline_actor_context_id || local?.offline_actor_context?.context_id),
      snapshot_id: safeText(supplied.snapshot_id || local?.offline_authority_snapshot_id || payload.p_snapshot_id),
      employee_id: safeText(supplied.employee_id || local?.offline_authority_employee_id || payload.p_snapshot_employee_id),
      assignment_epoch: Number(supplied.assignment_epoch ?? local?.offline_authority_assignment_epoch ?? payload.p_snapshot_assignment_epoch),
    };
  }

  function recoveryPhaseFor(action = {}) {
    switch (safeText(action.type)) {
      case 'start_session': return 1;
      case 'finish_session': return 2;
      case 'complete_session':
      case 'commit_workflow': return 3;
      default: return 0;
    }
  }

  function recoveryChainFor(action = {}) {
    const phase = recoveryPhaseFor(action);
    if (!phase) return null;
    const sessionId = replayBindingFor(action).client_session_id;
    return isUuid(sessionId) ? { session_id: sessionId.toLowerCase(), phase } : null;
  }

  function actionCanRun(item, at = now()) {
    return item.dead_letter !== true
      && Number(item.next_attempt_at || 0) <= at
      && (!item.lease_until || Number(item.lease_until) <= at);
  }

  function nextRecoveryAction(rows = [], at = now()) {
    const chains = new Map();
    for (const raw of rows) {
      const item = normalizeRecord(raw);
      if (item.dead_letter === true) continue;
      const chain = recoveryChainFor(item);
      if (!chain) continue;
      const group = chains.get(chain.session_id) || {
        session_id: chain.session_id,
        first_created_at: Number(item.created_at || 0),
        items: [],
      };
      group.first_created_at = Math.min(group.first_created_at, Number(item.created_at || 0));
      group.items.push({ item, phase: chain.phase });
      chains.set(chain.session_id, group);
    }
    if (!chains.size) return { item: null, active: false };
    const ordered = [...chains.values()].sort((left, right) => left.first_created_at - right.first_created_at
      || left.session_id.localeCompare(right.session_id));
    for (const group of ordered) {
      const phase = Math.min(...group.items.map((entry) => entry.phase));
      const candidates = group.items
        .filter((entry) => entry.phase === phase)
        .map((entry) => entry.item)
        .sort((left, right) => left.created_at - right.created_at || Number(left.id) - Number(right.id));
      const eligible = candidates.find((item) => actionCanRun(item, at));
      if (eligible) return { item: eligible, active: true };
    }
    return { item: null, active: true };
  }

  function hasUnresolvedReconciliationWork(rows = []) {
    return nextRecoveryAction(rows).active;
  }

  function nextClaimableAction(rows = [], at = now()) {
    const recovery = nextRecoveryAction(rows, at);
    if (recovery.item || recovery.active) return recovery.item;
    return rows
      .map(normalizeRecord)
      .filter((item) => actionCanRun(item, at))
      .sort((left, right) => left.created_at - right.created_at || Number(left.id) - Number(right.id))[0] || null;
  }

  function storageRecord(action = {}) {
    const rawForwardFence = action.forward_replay_contract === CONFIG.REQUIRED_SCAN_CONTRACT_VERSION
      && safeText(action.type).startsWith('forward-replay-fenced:');
    const current = normalizeRecord({
      ...action,
      forward_replay_contract: rawForwardFence ? action.forward_replay_contract : undefined,
      forward_action_type: rawForwardFence ? action.forward_action_type : undefined,
      current_dead_letter: rawForwardFence ? action.current_dead_letter : undefined,
      dead_letter: rawForwardFence ? action.current_dead_letter === true : action.dead_letter === true,
    });
    return {
      ...current,
      replay_binding: replayBindingFor(current),
      forward_replay_contract: CONFIG.REQUIRED_SCAN_CONTRACT_VERSION,
      current_dead_letter: current.dead_letter === true,
      // Build 22 understands dead_letter but not the v6 authority contract. It
      // therefore preserves current work without calling a retired endpoint.
      dead_letter: true,
      forward_action_type: current.type,
      type: `forward-replay-fenced:${current.type}`,
    };
  }

  function fencedDowngradeRows(rows = []) {
    return rows.map((row) => storageRecord(normalizeRecord(row)));
  }

  function downgradeTransition(point) {
    // Browser tests use this deterministic boundary to model process death.
    const hook = window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__;
    if (typeof hook === 'function') hook(point);
  }

  function legacyMigrationFailure(action, sourceVersion, reason) {
    const candidate = safeText(action.operation_id || action.client_id) || `legacy-v${sourceVersion}-row-${Number(action.id || 0)}`;
    const migrated = normalizeRecord({ ...action, operation_id: isUuid(candidate) ? candidate : '' });
    return {
      ...migrated,
      source_schema_version: sourceVersion,
      recoverable: false,
      dead_letter: true,
      state: 'legacy-quarantine',
      next_attempt_at: Number.MAX_SAFE_INTEGER,
      lease_owner: null,
      lease_token: null,
      lease_until: 0,
      last_error: `Legacy queue v${sourceVersion} was preserved locally and not sent: ${reason}`,
    };
  }

  function migrateLegacyRecord(action = {}, sourceVersion) {
    const payload = action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload) ? action.payload : {};
    const type = safeText(action.type);
    const exactOperationId = safeText(action.operation_id || action.client_id
      || payload.p_client_completion_id || payload.p_client_event_id || payload.p_operation_id);
    let valid = false;
    if (type === 'start_session') {
      valid = isUuid(payload.p_client_session_id)
        && /^[a-f0-9]{64}$/i.test(safeText(payload.p_snapshot_id))
        && isUuid(payload.p_snapshot_employee_id)
        && Number.isSafeInteger(Number(payload.p_snapshot_assignment_epoch))
        && Number(payload.p_snapshot_assignment_epoch) >= 1
        && Boolean(safeText(payload.p_location_code))
        && Boolean(safeText(payload.p_device_id));
    } else if (type === 'complete_session') {
      valid = isUuid(payload.p_session_uuid || payload.p_client_session_id)
        && isUuid(payload.p_client_completion_id || exactOperationId);
    } else if (type === 'commit_workflow') {
      const local = exactSessionForPayload(payload);
      valid = isUuid(payload.p_session_uuid || payload.p_client_session_id)
        && isUuid(payload.p_client_completion_id || exactOperationId)
        && Boolean(local)
        && Boolean(safeText(local.context_id))
        && Boolean(safeText(local.submission_proof));
    } else if (type === 'finish_session') {
      valid = isUuid(payload.p_session_uuid || payload.p_client_session_id) && isUuid(exactOperationId);
    } else if (type === 'record_scan_event') {
      const evidence = payload.p_payload_json && typeof payload.p_payload_json === 'object' ? payload.p_payload_json : {};
      valid = isUuid(payload.p_client_event_id || exactOperationId)
        && isUuid(evidence.session_uuid || evidence.client_session_id)
        && Boolean(exactSessionForPayload(evidence));
    } else if (type === 'ping_device') {
      valid = isUuid(exactOperationId) && Boolean(safeText(payload.p_device_id));
    } else if (type === 'evaluate_location_proximity_v2') {
      valid = isUuid(payload.p_client_event_id || exactOperationId)
        && Boolean(safeText(payload.p_location_code))
        && Number.isFinite(Number(payload.p_latitude))
        && Number.isFinite(Number(payload.p_longitude))
        && Number.isFinite(Date.parse(safeText(payload.p_observed_at)));
    }
    if (!valid || !isUuid(exactOperationId)) {
      return legacyMigrationFailure(action, sourceVersion, 'the record lacks exact v6 identity or authority fields');
    }
    return {
      ...normalizeRecord({ ...action, operation_id: exactOperationId }),
      source_schema_version: sourceVersion,
      migrated_at: new Date().toISOString(),
      recoverable: action.recoverable !== false,
    };
  }

  function deleteDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error || new Error(`Could not delete ${name}.`));
      request.onblocked = () => reject(new Error(`${name} is blocked by another stale browser tab.`));
    });
  }

  function openExistingDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error(`Could not open ${name}.`));
      request.onblocked = () => reject(new Error(`${name} is blocked by another stale browser tab.`));
    });
  }

  function readRawRows(db, storeName = CONFIG.STORE_NAME) {
    if (!db.objectStoreNames.contains(storeName)) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).getAll();
      let rows = [];
      request.onsuccess = () => { rows = Array.isArray(request.result) ? request.result : []; };
      request.onerror = () => reject(request.error || new Error('Scan queue read failed.'));
      transaction.oncomplete = () => resolve(rows);
      transaction.onerror = () => reject(transaction.error || new Error('Scan queue read failed.'));
      transaction.onabort = () => reject(transaction.error || new Error('Scan queue read was aborted.'));
    });
  }

  function canonicalRows(rows) {
    return JSON.stringify(canonicalizeSemanticValue([...rows].sort((left, right) => Number(left?.id || 0) - Number(right?.id || 0))));
  }

  function createQueueDatabase(name, version, rows = []) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(CONFIG.STORE_NAME)
          ? request.transaction.objectStore(CONFIG.STORE_NAME)
          : db.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
        if (!store.indexNames.contains('logical_key')) store.createIndex('logical_key', 'logical_key', { unique: false });
        if (!store.indexNames.contains('state')) store.createIndex('state', 'state', { unique: false });
        if (!store.indexNames.contains('next_attempt_at')) store.createIndex('next_attempt_at', 'next_attempt_at', { unique: false });
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!rows.length) { resolve(db); return; }
        const transaction = db.transaction(CONFIG.STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CONFIG.STORE_NAME);
        for (const row of rows) store.put(row);
        transaction.oncomplete = () => resolve(db);
        transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Scan queue restore failed.')); };
        transaction.onabort = () => { db.close(); reject(transaction.error || new Error('Scan queue restore was aborted.')); };
      };
      request.onerror = () => reject(request.error || new Error(`Could not create ${name}.`));
      request.onblocked = () => reject(new Error(`${name} is blocked by another stale browser tab.`));
    });
  }

  async function readDowngradeBackup() {
    const db = await openExistingDatabase(CONFIG.ROLLBACK_BACKUP_DB_NAME);
    try {
      if (!db.objectStoreNames.contains('metadata') || !db.objectStoreNames.contains(CONFIG.STORE_NAME)) return null;
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(['metadata', CONFIG.STORE_NAME], 'readonly');
        const metadata = transaction.objectStore('metadata').get('capture');
        const rows = transaction.objectStore(CONFIG.STORE_NAME).getAll();
        transaction.oncomplete = () => resolve(metadata.result && {
          ...metadata.result,
          rows: Array.isArray(rows.result) ? rows.result : [],
        });
        transaction.onerror = () => reject(transaction.error || new Error('Rollback backup read failed.'));
        transaction.onabort = () => reject(transaction.error || new Error('Rollback backup read was aborted.'));
      });
    } finally { db.close(); }
  }

  async function writeDowngradeBackup(rows, sourceVersion) {
    await deleteDatabase(CONFIG.ROLLBACK_BACKUP_DB_NAME);
    const expected = canonicalRows(rows);
    const expectedFenced = canonicalRows(fencedDowngradeRows(rows));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.ROLLBACK_BACKUP_DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('metadata', { keyPath: 'key' });
        request.result.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Rollback backup could not be created.'));
    });
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(['metadata', CONFIG.STORE_NAME], 'readwrite');
        transaction.objectStore('metadata').put({
          key: 'capture', source_version: sourceVersion, canonical_rows: expected,
          canonical_fenced_rows: expectedFenced,
        });
        for (const row of rows) transaction.objectStore(CONFIG.STORE_NAME).put(row);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Rollback backup write failed.'));
        transaction.onabort = () => reject(transaction.error || new Error('Rollback backup write was aborted.'));
      });
    } finally { db.close(); }
    const verified = await readDowngradeBackup();
    if (!verified || verified.source_version !== sourceVersion || verified.canonical_rows !== expected
      || verified.canonical_fenced_rows !== expectedFenced || canonicalRows(verified.rows) !== expected) {
      throw storageFailure('queue downgrade backup', new Error('backup verification failed'));
    }
    downgradeTransition('backup-verified');
    return verified;
  }

  async function restoreRollbackCompatibleQueue(backup) {
    const fencedRows = fencedDowngradeRows(backup.rows);
    const expectedFenced = backup.canonical_fenced_rows || canonicalRows(fencedRows);
    const existing = await openExistingDatabase(CONFIG.DB_NAME);
    try {
      if (existing.version > CONFIG.MAX_KNOWN_DB_VERSION) throw new Error(`Unknown scan queue database version ${existing.version}.`);
      const rows = await readRawRows(existing);
      if (existing.version === CONFIG.DB_VERSION && canonicalRows(rows) === expectedFenced) {
        downgradeTransition('fenced-v4-verified');
        await deleteDatabase(CONFIG.ROLLBACK_BACKUP_DB_NAME);
        downgradeTransition('backup-deleted');
        return;
      }
    } finally { existing.close(); }
    await deleteDatabase(CONFIG.DB_NAME);
    downgradeTransition('primary-deleted');
    const restored = await createQueueDatabase(CONFIG.DB_NAME, CONFIG.DB_VERSION, fencedRows);
    downgradeTransition('fenced-v4-written');
    const restoredRows = await readRawRows(restored);
    restored.close();
    if (canonicalRows(restoredRows) !== expectedFenced) throw storageFailure('queue downgrade restore', new Error('fenced restore verification failed'));
    downgradeTransition('fenced-v4-verified');
    await deleteDatabase(CONFIG.ROLLBACK_BACKUP_DB_NAME);
    downgradeTransition('backup-deleted');
  }

  async function postOpenContentMigration(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const cursor = transaction.objectStore(CONFIG.STORE_NAME).openCursor();
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const declaredVersion = Number(current.value?.schema_version || 0);
        const sourceVersion = declaredVersion >= 1 && declaredVersion <= 4
          ? declaredVersion
          : (declaredVersion === 0 ? Math.min(db.version, 4) : 0);
        const migrated = sourceVersion
          ? migrateLegacyRecord(current.value, sourceVersion)
          : (declaredVersion === CONFIG.SCHEMA_VERSION
            ? normalizeRecord(current.value)
            : legacyMigrationFailure(current.value, declaredVersion || db.version, 'the record uses an unsupported future schema'));
        current.update(storageRecord(migrated));
        current.continue();
      };
      cursor.onerror = () => reject(cursor.error || new Error('Scan queue content migration failed.'));
      transaction.oncomplete = () => resolve(db);
      transaction.onerror = () => reject(transaction.error || new Error('Scan queue content migration failed.'));
      transaction.onabort = () => reject(transaction.error || new Error('Scan queue content migration was aborted.'));
    });
  }

  async function openDb() {
    const backup = await readDowngradeBackup();
    if (backup) await restoreRollbackCompatibleQueue(backup);
    else await deleteDatabase(CONFIG.ROLLBACK_BACKUP_DB_NAME);

    let db = await openExistingDatabase(CONFIG.DB_NAME);
    if (db.version > CONFIG.MAX_KNOWN_DB_VERSION) {
      const version = db.version;
      db.close();
      throw new Error(`Unknown scan queue database version ${version}; preserved without mutation.`);
    }
    if (db.version > CONFIG.DB_VERSION) {
      const sourceVersion = db.version;
      const rows = await readRawRows(db);
      db.close();
      const captured = await writeDowngradeBackup(rows, sourceVersion);
      await restoreRollbackCompatibleQueue(captured);
      db = await openExistingDatabase(CONFIG.DB_NAME);
    } else if (db.version < CONFIG.DB_VERSION || !db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
      db.close();
      db = await createQueueDatabase(CONFIG.DB_NAME, CONFIG.DB_VERSION);
    }
    return postOpenContentMigration(db);
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

  async function enqueueUnlocked(action) {
    const record = normalizeRecord({ ...action, replay_binding: replayBindingFor(action) });
    return mutateProtectedQueue(() => new Promise((resolve, reject) => {
        const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
        const store = tx.objectStore(CONFIG.STORE_NAME);
        const lookup = store.getAll();
        let result = null;
        let conflict = null;
        lookup.onsuccess = () => {
          const existingRows = (lookup.result || []).map(normalizeRecord);
          const exact = existingRows.find((item) => item.logical_key === record.logical_key
            && safeText(item.semantic_fingerprint) === safeText(record.semantic_fingerprint));
          if (exact) {
            if (exact.dead_letter === true || exact.recoverable === false) {
              conflict = Object.assign(new Error('This operation is already in durable recovery and requires explicit resolution.'), {
                code: 'semantic_completion_quarantined', queue_record_id: exact.id,
              });
              return;
            }
            result = exact.id;
            return;
          }
          if (safeText(record.type) === 'commit_workflow' && record.completion_client_id) {
            const related = existingRows.filter((item) => safeText(item.type) === 'commit_workflow'
              && completionClientIdFor(item) === record.completion_client_id);
            if (related.length) {
              const safeToReplace = related.length === 1
                && related[0].dead_letter !== true
                && safeText(related[0].state || 'pending') === 'pending'
                && Number(related[0].retry_count || 0) === 0
                && !related[0].last_attempt_at
                && !related[0].lease_owner
                && !related[0].lease_token
                && Number(related[0].lease_until || 0) <= now();
              if (safeToReplace) {
                const prior = related[0];
                result = prior.id;
                store.put(storageRecord({
                  ...record,
                  id: prior.id,
                  created_at: prior.created_at,
                  replaced_unattempted_semantic_fingerprint: prior.semantic_fingerprint || null,
                  replaced_at: now(),
                }));
                return;
              }
              const reason = 'semantic_completion_mismatch_requires_explicit_resolution';
              for (const prior of related) store.put(storageRecord({
                ...prior,
                dead_letter: true,
                state: 'quarantined',
                last_error: reason,
                last_attempt_at: now(),
                next_attempt_at: Number.MAX_SAFE_INTEGER,
                lease_owner: null,
                lease_token: null,
                lease_until: 0,
                terminal_result: {
                  status: 'quarantined', terminal: true, recovery_required: true, reason,
                  retained_semantic_fingerprint: prior.semantic_fingerprint || null,
                  incoming_semantic_fingerprint: record.semantic_fingerprint || null,
                },
              }));
              const add = store.add(storageRecord({
                ...record,
                dead_letter: true,
                state: 'quarantined',
                last_error: reason,
                last_attempt_at: now(),
                next_attempt_at: Number.MAX_SAFE_INTEGER,
              }));
              add.onsuccess = () => { result = add.result; };
              conflict = Object.assign(new Error('Changed completion evidence conflicts with an attempted operation; both versions were preserved.'), {
                code: 'semantic_completion_conflict', completion_client_id: record.completion_client_id,
              });
              return;
            }
          }
          const add = store.add(storageRecord(record));
          add.onsuccess = () => { result = add.result; };
        };
        tx.oncomplete = () => {
          if (conflict) {
            dispatchStatus({ status: 'quarantined', logical_key: record.logical_key, reason: conflict.code });
            reject(conflict);
            return;
          }
          state.channel?.postMessage({ type: 'queued', logical_key: record.logical_key });
          dispatchStatus({ status: 'queued', logical_key: record.logical_key });
          resolve(result);
          if (navigator.onLine) scheduleSync();
        };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Queue transaction aborted.'));
      }));
  }

  function claimNextAction() {
    if (!state.db) return Promise.resolve(null);
    return mutateProtectedQueue((securityContext) => new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.getAll();
      let claimed = null;
      request.onsuccess = () => {
        const item = nextClaimableAction(request.result || []);
        if (!item) return;
        claimed = {
          ...item,
          state: 'processing',
          lease_owner: state.workerId,
          lease_token: crypto.randomUUID(),
          lease_until: now() + CONFIG.LEASE_MS,
        };
        store.put(storageRecord(claimed));
        claimed = {
          ...claimed,
          claimed_from: {
            state: item.state,
            lease_owner: item.lease_owner,
            lease_token: item.lease_token,
            lease_until: item.lease_until,
          },
          security_generation: securityContext?.generation ?? null,
        };
      };
      tx.oncomplete = () => resolve(claimed);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Queue claim aborted.'));
    }));
  }

  function releaseClaimWithoutAttempt(item) {
    if (!state.db || !item?.id) return Promise.resolve(false);
    return mutateProtectedQueue(() => new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.get(item.id);
      let changed = false;
      request.onsuccess = () => {
        const current = request.result;
        if (!current || current.lease_token !== item.lease_token || current.lease_owner !== state.workerId) return;
        const previous = item.claimed_from || {};
        changed = true;
        store.put(storageRecord({
          ...current,
          state: previous.state || 'pending',
          lease_owner: previous.lease_owner || null,
          lease_token: previous.lease_token || null,
          lease_until: Number(previous.lease_until || 0),
        }));
      };
      tx.oncomplete = () => resolve(changed);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Queue claim release aborted.'));
    }), { requireEnrollment: true, expectedGeneration: item.security_generation ?? null });
  }

  function recoverOrphanedClaims(recoverImmediately = false) {
    if (!state.db) return Promise.resolve(0);
    return mutateProtectedQueue(() => new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.getAll();
      let recovered = 0;
      request.onsuccess = () => {
        for (const raw of request.result || []) {
          const item = normalizeRecord(raw);
          if (item.state !== 'processing' || !item.lease_owner
            || (!recoverImmediately && Number(item.lease_until || 0) > now())) continue;
          recovered += 1;
          store.put(storageRecord({
            ...item,
            state: Number(item.retry_count || 0) > 0 ? 'retrying' : 'pending',
            lease_owner: null,
            lease_token: null,
            lease_until: 0,
          }));
        }
      };
      tx.oncomplete = () => resolve(recovered);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Queue orphan recovery was aborted.'));
    }));
  }

  function persistClaimPayload(item, payload) {
    if (!state.db || !item?.id || !payload || typeof payload !== 'object') return Promise.resolve(false);
    return mutateProtectedQueue(() => new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.get(item.id);
      let changed = false;
      request.onsuccess = () => {
        const current = request.result;
        if (!current || current.lease_token !== item.lease_token || current.lease_owner !== state.workerId) return;
        changed = true;
        store.put(storageRecord({ ...current, payload: { ...payload } }));
      };
      tx.oncomplete = () => resolve(changed);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Queue proof persistence was aborted.'));
    }), { requireEnrollment: true, expectedGeneration: item.security_generation ?? null });
  }

  function finishClaim(item, { succeeded, result = null, error = null, permanent = false, retryAfterMs = 0 } = {}) {
    if (!state.db || !item?.id) return Promise.resolve(false);
    return mutateProtectedQueue(() => new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.get(item.id);
      let changed = false;
      request.onsuccess = () => {
        const current = request.result;
        if (!current || current.lease_token !== item.lease_token || current.lease_owner !== state.workerId) return;
        changed = true;
        if (succeeded) {
          try {
            if (isTerminalReconciliation(item, result)) {
              store.put(storageRecord({
                ...current,
                type: item.type,
                dead_letter: true,
                state: 'quarantined',
                terminal_result: result,
                last_error: safeText(result?.reason || result?.status || 'Manager recovery is required.').slice(0, 1000),
                last_attempt_at: now(),
                next_attempt_at: Number.MAX_SAFE_INTEGER,
                lease_owner: null,
                lease_token: null,
                lease_until: 0,
              }));
              return;
            }
            applyProcessResult(item, result);
            store.delete(item.id);
          } catch (applyError) {
            changed = false;
            try { tx.abort(); } catch {}
            reject(applyError);
          }
          return;
        }
        const retryCount = Number(current.retry_count || 0) + 1;
        const deadLetter = permanent || retryCount >= CONFIG.MAX_RETRIES;
        store.put(storageRecord({
          ...current,
          type: item.type,
          retry_count: retryCount,
          last_error: safeText(error || 'Sync failed').slice(0, 1000),
          last_attempt_at: now(),
          next_attempt_at: deadLetter ? Number.MAX_SAFE_INTEGER : now() + Math.max(retryAfterMs, retryDelay(retryCount)),
          dead_letter: deadLetter,
          state: deadLetter ? 'dead-letter' : 'retrying',
          lease_owner: null,
          lease_token: null,
          lease_until: 0,
        }));
      };
      tx.oncomplete = () => resolve(changed);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Queue completion transaction aborted.'));
    }), { requireEnrollment: true, expectedGeneration: item.security_generation ?? null });
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
  function latestQueueError(queue = []) {
    const failed = queue
      .filter((item) => safeText(item?.last_error))
      .sort((a, b) => Number(b.last_attempt_at || b.created_at || 0) - Number(a.last_attempt_at || a.created_at || 0));
    return safeText(failed[0]?.last_error).slice(0, 1000) || null;
  }
  function dispatchStatus(detail) {
    try { window.dispatchEvent(new CustomEvent('memphis-scan-sync', { detail })); } catch (_err) {}
  }

  function acquireFallbackLock() {
    const at = now();
    const token = crypto.randomUUID();
    try {
      const current = JSON.parse(localStorage.getItem(CONFIG.FALLBACK_LOCK_KEY) || 'null');
      if (current?.owner && at - Number(current.at || 0) < CONFIG.FALLBACK_LOCK_TTL_MS) return null;
      localStorage.setItem(CONFIG.FALLBACK_LOCK_KEY, JSON.stringify({ owner: state.workerId, token, at }));
      const acquired = JSON.parse(localStorage.getItem(CONFIG.FALLBACK_LOCK_KEY) || 'null');
      return acquired?.owner === state.workerId && acquired?.token === token ? token : null;
    } catch (_err) { return null; }
  }
  function refreshFallbackLock(token) {
    try {
      const current = JSON.parse(localStorage.getItem(CONFIG.FALLBACK_LOCK_KEY) || 'null');
      if (current?.owner === state.workerId && current?.token === token) {
        localStorage.setItem(CONFIG.FALLBACK_LOCK_KEY, JSON.stringify({ owner: state.workerId, token, at: now() }));
      }
    } catch (_err) {}
  }
  function releaseFallbackLock(token) {
    try {
      const current = JSON.parse(localStorage.getItem(CONFIG.FALLBACK_LOCK_KEY) || 'null');
      if (current?.owner === state.workerId && current?.token === token) localStorage.removeItem(CONFIG.FALLBACK_LOCK_KEY);
    } catch (_err) {}
  }
  async function withQueueLock(operation, { ifAvailable = false } = {}) {
    if (navigator.locks?.request) {
      const options = { mode: 'exclusive' };
      if (ifAvailable) options.ifAvailable = true;
      return navigator.locks.request(CONFIG.WEB_LOCK_NAME, options, (lock) => lock ? operation({ recoverClaimsImmediately: true }) : false);
    }
    const waitStartedAt = now();
    let token = acquireFallbackLock();
    while (!token && !ifAvailable && now() - waitStartedAt < CONFIG.FALLBACK_LOCK_WAIT_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      token = acquireFallbackLock();
    }
    if (!token) {
      if (ifAvailable) return false;
      throw new Error('The protected saved-work queue is busy. Retry after the current recovery pass finishes.');
    }
    const heartbeat = window.setInterval(() => refreshFallbackLock(token), CONFIG.FALLBACK_LOCK_HEARTBEAT_MS);
    try {
      return await operation({ recoverClaimsImmediately: false });
    } finally {
      window.clearInterval(heartbeat);
      releaseFallbackLock(token);
    }
  }
  async function enqueue(action) {
    await ensureWorkerReady();
    if (!state.db) throw new Error('The durable scan queue is not ready.');
    return withQueueLock(() => enqueueUnlocked(action));
  }

  async function rpc(fn, args = {}) {
    const requestedDevice = state.deviceId || safeText(args.p_device_id || args.p_device_identifier);
    if (!requestedDevice) throw new Error('This phone has no verified device identity.');
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': requestedDevice },
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
      case 'record_scan_event': {
        const eventPayload = payload.p_payload_json && typeof payload.p_payload_json === 'object' ? payload.p_payload_json : {};
        const local = exactSessionForPayload({
          ...eventPayload,
          p_session_uuid: eventPayload.session_uuid,
          p_client_session_id: eventPayload.client_session_id,
        });
        if (local) {
          const evidence = Array.isArray(local.scan_evidence) ? local.scan_evidence : [];
          const clientEventId = safeText(payload.p_client_event_id || item.client_id || item.operation_id);
          if (!evidence.some((event) => safeText(event?.client_event_id) === clientEventId)) {
            saveSession({ ...local, scan_evidence: [...evidence, {
              client_event_id: clientEventId,
              event_type: safeText(payload.p_event_type || 'scan_error'),
              result: safeText(payload.p_result) || null,
              notes: safeText(payload.p_notes) || null,
              scanned_at: new Date(Number(item.created_at || now())).toISOString(),
              payload_json: eventPayload,
            }].slice(-200) });
          }
        }
        if (!local) {
          throw Object.assign(new Error('Historical standalone scan evidence has no exact occurrence and requires manager reconciliation.'), { httpStatus: 422 });
        }
        result = { status: 'cancelled', terminal: true, migrated_to_canonical_evidence: true };
        break;
      }
      case 'ping_device': result = await rpc('tool_ping_device', payload); break;
      case 'start_session': {
        if (
          !isUuid(payload.p_client_session_id)
          || !/^[a-f0-9]{64}$/i.test(safeText(payload.p_snapshot_id))
          || !isUuid(payload.p_snapshot_employee_id)
          || !Number.isSafeInteger(Number(payload.p_snapshot_assignment_epoch))
          || Number(payload.p_snapshot_assignment_epoch) < 1
          || !isUuid(payload.p_native_scan_entry_id)
          || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(safeText(payload.p_client_started_at))
          || safeText(payload.p_native_start_attestation_version) !== 'custodial-native-start.v1'
          || !/^[a-f0-9]{64}$/.test(safeText(payload.p_native_start_attestation))
        ) throw Object.assign(new Error('Queued start lacks exact v6 offline authority and requires manager reconciliation.'), { httpStatus: 422 });
        result = await rpc('tool_start_offline_occurrence', payload);
        break;
      }
      case 'finish_session': {
        const sessionIdentifier = safeText(payload.p_session_uuid || payload.p_client_session_id);
        if (!isUuid(sessionIdentifier) || !isUuid(item.operation_id)) throw Object.assign(new Error('Historical finish record has no exact session or operation identifier and requires manager reconciliation.'), { httpStatus: 422 });
        result = await rpc('tool_finish_session', {
          ...payload,
          p_session_uuid: sessionIdentifier,
          p_finish_operation_id: item.operation_id,
        });
        break;
      }
      case 'complete_session': {
        const sessionIdentifier = safeText(payload.p_session_uuid || payload.p_client_session_id);
        if (!isUuid(sessionIdentifier) || !isUuid(payload.p_client_completion_id || item.operation_id)) throw Object.assign(new Error('Historical completion record has no exact session or completion identifier and requires manager reconciliation.'), { httpStatus: 422 });
        result = await rpc('tool_complete_session', {
          ...payload,
          p_session_uuid: sessionIdentifier,
          p_client_completion_id: safeText(payload.p_client_completion_id || item.operation_id),
        });
        break;
      }
      case 'commit_workflow': {
        const local = exactSessionForPayload(payload);
        const binding = replayBindingFor(item);
        if (local
          && safeText(local.native_completion_attestation_version) === 'custodial-native-completion.v2'
          && isUuid(local.native_finish_scan_entry_id)
          && /^[a-f0-9]{64}$/.test(safeText(local.native_completion_attestation))) {
          Object.assign(payload, {
            p_client_ended_at: safeText(local.ended_at),
            p_native_finish_scan_entry_id: safeText(local.native_finish_scan_entry_id),
            p_native_completion_attestation_version: 'custodial-native-completion.v2',
            p_native_completion_attestation: safeText(local.native_completion_attestation),
          });
        }
        if (binding.snapshot_id && (
          !isUuid(payload.p_native_finish_scan_entry_id)
          || safeText(payload.p_native_completion_attestation_version) !== 'custodial-native-completion.v2'
          || !/^[a-f0-9]{64}$/.test(safeText(payload.p_native_completion_attestation))
        )) {
          const contextId = safeText(local?.context_id);
          const submissionProof = safeText(local?.submission_proof);
          const createAttestation = window.MemphisMobile?.createOfflineCompletionAttestation;
          if (!contextId || !submissionProof) {
            throw Object.assign(new Error('The offline start must be acknowledged before its completion can be bound.'), { httpStatus: 503 });
          }
          if (typeof createAttestation !== 'function') {
            throw Object.assign(new Error('The protected native completion attestation is unavailable.'), { httpStatus: 503 });
          }
          const nativeCompletion = await createAttestation({
            deviceId: safeText(payload.p_device_id),
            locationCode: safeText(payload.p_location_code),
            clientSessionId: safeText(payload.p_client_session_id),
            clientCompletionId: safeText(payload.p_client_completion_id),
            contextId,
            nativeFinishScanEntryId: safeText(local?.native_finish_scan_entry_id || payload.p_native_finish_scan_entry_id),
            clientStartedAt: safeText(payload.p_client_started_at),
          });
          if (safeText(local?.ended_at) && safeText(nativeCompletion?.p_client_ended_at) !== safeText(local.ended_at)) {
            throw Object.assign(new Error('The native completion time changed after it was frozen.'), { httpStatus: 422 });
          }
          Object.assign(payload, nativeCompletion);
          if (local) saveSession({
            ...local,
            ended_at: safeText(nativeCompletion.p_client_ended_at),
            native_finish_scan_entry_id: safeText(nativeCompletion.p_native_finish_scan_entry_id),
            native_completion_attestation_version: safeText(nativeCompletion.p_native_completion_attestation_version),
            native_completion_attestation: safeText(nativeCompletion.p_native_completion_attestation),
          });
        }
        if (binding.snapshot_id && (
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(safeText(payload.p_client_started_at))
          || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(safeText(payload.p_client_ended_at))
          || !isUuid(payload.p_native_finish_scan_entry_id)
          || safeText(payload.p_native_completion_attestation_version) !== 'custodial-native-completion.v2'
          || !/^[a-f0-9]{64}$/.test(safeText(payload.p_native_completion_attestation))
        )) throw Object.assign(new Error('Queued completion lacks exact native timestamp proof and requires manager reconciliation.'), { httpStatus: 422 });
        const response = payload.p_response_json && typeof payload.p_response_json === 'object' && !Array.isArray(payload.p_response_json)
          ? { ...payload.p_response_json } : {};
        response.__custodial_offline_reconciliation_v1 = {
          context_id: safeText(local?.context_id || response.__custodial_offline_reconciliation_v1?.context_id),
          submission_proof: safeText(local?.submission_proof || response.__custodial_offline_reconciliation_v1?.submission_proof),
        };
        Object.assign(payload, {
          p_response_json: response,
          p_scan_evidence: Array.isArray(local?.scan_evidence) ? local.scan_evidence : payload.p_scan_evidence,
        });
        if (!await persistClaimPayload(item, payload)) {
          throw Object.assign(new Error('The durable completion proof lost queue ownership before submission.'), { httpStatus: 503 });
        }
        result = await rpc('tool_commit_cleaning_workflow', payload);
        break;
      }
      case 'evaluate_location_proximity': result = await rpc('tool_evaluate_location_proximity', payload); break;
      case 'evaluate_location_proximity_v2': result = await rpc('tool_evaluate_location_proximity_v2', payload); break;
      default: throw Object.assign(new Error(`Unknown queued action type: ${safeText(item?.type)}`), { httpStatus: 422 });
    }
    validateProcessResult(item, result);
    if (item.type === 'commit_workflow' && safeText(result?.status).toLowerCase() === 'closed'
      && safeText(payload.p_native_completion_attestation_version) === 'custodial-native-completion.v2') {
      const acknowledge = window.MemphisMobile?.acknowledgeOfflineCompletion;
      if (typeof acknowledge !== 'function') {
        throw Object.assign(new Error('The protected completion journal cannot be acknowledged.'), { httpStatus: 503 });
      }
      await acknowledge({
        deviceId: safeText(payload.p_device_id),
        locationCode: safeText(payload.p_location_code),
        clientSessionId: safeText(payload.p_client_session_id),
        nativeFinishScanEntryId: safeText(payload.p_native_finish_scan_entry_id),
        clientStartedAt: safeText(payload.p_client_started_at),
        clientEndedAt: safeText(payload.p_client_ended_at),
      });
    }
    return result;
  }

  function processResultFailure(reason) {
    return Object.assign(new Error(reason), { httpStatus: 422, code: 'custodial_unbound_server_result' });
  }

  function validateProcessResult(item, result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw processResultFailure('The server returned no operation-bound result.');
    const type = safeText(item?.type);
    const expected = replayBindingFor(item);
    const status = safeText(result.status).toLowerCase();
    if (type === 'start_session') {
      const existingProof = safeText(exactSessionForPayload(item?.payload || {})?.submission_proof);
      if (safeText(result.client_session_id) !== expected.client_session_id
        || !isUuid(result.context_id)
        || !isUuid(result.occurrence_id)
        || (expected.snapshot_id && safeText(result.snapshot_id) !== expected.snapshot_id)
        || (expected.employee_id && safeText(result.employee_id) !== expected.employee_id)
        || !Number.isSafeInteger(expected.assignment_epoch)
        || Number(result.assignment_epoch) !== expected.assignment_epoch
        || safeText(result.started_at) !== safeText(item?.payload?.p_client_started_at)
        || !/^[0-9a-f]{64}$/i.test(safeText(result.submission_proof || existingProof))) {
        throw processResultFailure('Offline activation acknowledgement does not match the queued snapshot occurrence.');
      }
      return true;
    }
    if (type === 'commit_workflow' || type === 'complete_session') {
      const terminal = result.terminal === true || ['closed', 'cancelled', 'quarantined', 'recovery_required'].includes(status);
      if (!terminal) throw processResultFailure('Completion acknowledgement is not terminal.');
      const sessionMatches = type === 'complete_session'
        ? [result.client_session_id, result.session_uuid].map(safeText).includes(expected.client_session_id)
        : safeText(result.client_session_id) === expected.client_session_id;
      if (status === 'closed' && (
        !sessionMatches
        || safeText(result.client_completion_id) !== expected.client_completion_id
        || (expected.occurrence_id && safeText(result.occurrence_id) !== expected.occurrence_id)
      )) throw processResultFailure('Completion acknowledgement does not match the queued occurrence and completion identity.');
      return true;
    }
    if (type === 'finish_session') {
      const requested = safeText(item?.payload?.p_session_uuid || item?.payload?.p_client_session_id);
      if (!requested || ![result.session_uuid, result.client_session_id].map(safeText).includes(requested)) {
        throw processResultFailure('Finish acknowledgement does not match the queued session.');
      }
    }
    return true;
  }

  function isTerminalReconciliation(item, result) {
    if (!['complete_session', 'commit_workflow'].includes(safeText(item?.type))) return false;
    const status = safeText(result?.status).toLowerCase();
    return result?.quarantined === true
      || result?.terminal === true && status !== 'closed'
      || result?.discard_local_workflow === true
      || ['cancelled', 'quarantined', 'recovery_required'].includes(status);
  }

  function applyProcessResult(item, result) {
    const payload = item?.payload && typeof item.payload === 'object' ? { ...item.payload } : {};
    if (item.type === 'start_session' && (result?.client_session_id || result?.session_uuid)) {
      const clientId = safeText(payload.p_client_session_id || item.client_id);
      const local = exactSessionForPayload({ p_client_session_id: clientId });
      if (local) {
        const pending = ['pending_submit', 'pending_sync'].includes(safeText(local.status).toLowerCase());
        const { started_at: ignoredServerStartedAt, p_client_started_at: ignoredServerClientStartedAt, ...serverResult } = result;
        void ignoredServerStartedAt;
        void ignoredServerClientStartedAt;
        saveSession({ ...local, ...serverResult, session_uuid: local.session_uuid || clientId, client_session_id: clientId, started_at: safeText(payload.p_client_started_at), status: pending ? local.status : 'server-active', state: pending ? local.state : 'server-active', server_acknowledged: true, sync_status: pending ? local.sync_status : 'synced' });
        if (clientId !== safeText(local.session_uuid) && readSession(clientId)) removeSession(clientId);
      }
    }
    if (item.type === 'finish_session' && result?.session_uuid) {
      const local = exactSessionForPayload(payload);
      if (local) {
        saveSession({ ...local, ...result, client_session_id: local.client_session_id || local.session_uuid, server_acknowledged: true, sync_status: 'synced' });
      }
    }
    if ((item.type === 'complete_session' || item.type === 'commit_workflow') && result?.status === 'closed') {
      const local = exactSessionForPayload(payload);
      const canonical = safeText(local?.session_uuid || local?.client_session_id || payload.p_client_session_id || payload.p_session_uuid);
      const aliases = [...new Set([local?.client_session_id, payload.p_client_session_id, payload.p_session_uuid, result.session_uuid]
        .map(safeText).filter((value) => value && value !== canonical))];
      aliases.forEach(removeSession);
      if (canonical) removeSession(canonical);
    }
  }

  async function reportDeviceSyncStatus(items = null) {
    const pause = await securityPause();
    if (pause) {
      dispatchSecurityPause(pause);
      return null;
    }
    if (!state.deviceId || !navigator.onLine) return null;
    const queue = Array.isArray(items) ? items : await listActions();
    const oldestMs = queue.reduce((min, item) => item.created_at > 0 && (!min || item.created_at < min) ? item.created_at : min, 0);
    const retryCount = queue.reduce((total, item) => total + Number(item.retry_count || 0), 0);
    const queueError = latestQueueError(queue);
    const authorityGroups = new Map();
    for (const item of queue) {
      const binding = replayBindingFor(item);
      if (!isUuid(binding.employee_id)
        || !/^[0-9a-f]{64}$/i.test(binding.snapshot_id)
        || !Number.isSafeInteger(binding.assignment_epoch)
        || binding.assignment_epoch < 1) continue;
      const key = `${binding.employee_id.toLowerCase()}:${binding.assignment_epoch}:${binding.snapshot_id.toLowerCase()}`;
      const prior = authorityGroups.get(key) || {
        employee_id: binding.employee_id.toLowerCase(), assignment_epoch: binding.assignment_epoch,
        snapshot_id: binding.snapshot_id.toLowerCase(), queue_count: 0, oldest_item_at: null,
      };
      prior.queue_count += 1;
      const created = Number(item.created_at || 0);
      if (created > 0 && (!prior.oldest_item_at || created < Date.parse(prior.oldest_item_at))) prior.oldest_item_at = new Date(created).toISOString();
      authorityGroups.set(key, prior);
    }
    try {
      const result = await rpc('tool_report_device_sync_status_v2', {
        p_device_identifier: state.deviceId,
        p_queue_count: queue.length,
        p_oldest_item_at: oldestMs ? new Date(oldestMs).toISOString() : null,
        p_retry_count: retryCount,
        p_last_server_ack_at: state.lastServerAckAt,
        p_frontend_version: CONFIG.FRONTEND_VERSION,
        p_last_error: queueError || state.lastError,
        p_correlation_id: `sync:${state.deviceId}:${crypto.randomUUID()}`,
        p_queue_authority_groups: [...authorityGroups.values()].sort((left, right) => `${left.employee_id}:${left.assignment_epoch}:${left.snapshot_id}`.localeCompare(`${right.employee_id}:${right.assignment_epoch}:${right.snapshot_id}`)),
      });
      state.lastServerAckAt = new Date().toISOString();
      // A successful heartbeat must not erase the cause of work that remains
      // queued. Clear the error only after the failed records actually drain.
      state.lastError = queueError;
      return result;
    } catch (error) {
      state.lastError = safeText(error?.message || 'Sync status report failed').slice(0, 1000);
      return null;
    }
  }

  async function runWorker(lockContext = {}) {
    const initialPause = await securityPause();
    if (initialPause) {
      dispatchSecurityPause(initialPause);
      return false;
    }
    if (state.syncing || !state.db || !navigator.onLine || !state.deviceId) return false;
    state.syncing = true;
    try {
      // runWorker is entered only while the cross-tab queue lock is held. A
      // processing record therefore belongs to a dead WebView and is safe to
      // replay through its stable operation identity.
      await recoverOrphanedClaims(lockContext.recoverClaimsImmediately === true);
      let processed = 0;
      let paused = null;
      let compatibilityVerified = false;
      while (processed < 100) {
        paused = await securityPause();
        if (paused) break;
        const item = await claimNextAction();
        if (!item) break;
        try {
          if (!compatibilityVerified) {
            if (!(await verifyWorkerBackendCompatibility())) {
              await releaseClaimWithoutAttempt(item);
              return false;
            }
            compatibilityVerified = true;
          }
          await custodialSecurity()?.waitForStableState?.({
            requireEnrollment: true,
            expectedGeneration: item.security_generation ?? null,
          });
          const result = await processAction(item);
          await finishClaim(item, { succeeded: true, result });
          state.lastServerAckAt = new Date().toISOString();
          state.lastError = null;
          dispatchStatus({ status: 'synced', item, result });
        } catch (error) {
          if (securityErrorIsPause(error)) {
            paused = { reason: safeText(error.reason || error.code), recovery: error.recovery || null };
            break;
          }
          const status = Number(error?.httpStatus || 0);
          const permanent = status >= 400 && status < 500 && ![401, 403, 408, 429].includes(status);
          const retryAfterMs = status === 429 ? parseRetryAfter(error?.retryAfter) : 0;
          state.lastError = safeText(error?.message || 'Sync failed').slice(0, 1000);
          try {
            await finishClaim(item, { succeeded: false, error: state.lastError, permanent, retryAfterMs });
          } catch (finishError) {
            if (securityErrorIsPause(finishError)) {
              paused = { reason: safeText(finishError.reason || finishError.code), recovery: finishError.recovery || null };
              break;
            }
            throw finishError;
          }
          dispatchStatus({ status: permanent ? 'dead-letter' : 'retrying', item, error: state.lastError });
        }
        processed += 1;
      }
      if (paused) {
        dispatchSecurityPause(paused);
        return false;
      }
      const remaining = await listActions();
      if (!hasUnresolvedReconciliationWork(remaining)) await reportDeviceSyncStatus(remaining);
      const currentTime = now();
      if (remaining.some((item) => actionCanRun(item, currentTime))) scheduleSync(50);
      const nextRetryAt = remaining
        .filter((item) => item.dead_letter !== true && Number(item.next_attempt_at || 0) > currentTime)
        .reduce((earliest, item) => Math.min(earliest, Number(item.next_attempt_at)), Number.MAX_SAFE_INTEGER);
      if (nextRetryAt < Number.MAX_SAFE_INTEGER) scheduleSync(Math.max(50, nextRetryAt - currentTime));
      dispatchStatus({ status: 'idle', queued: remaining.length, dead_letters: remaining.filter((item) => item.dead_letter).length });
      state.channel?.postMessage({ type: 'sync-complete', queued: remaining.length });
      return true;
    } finally {
      state.syncing = false;
    }
  }

  async function sync() {
    try {
      await ensureWorkerReady();
    } catch (error) {
      if (!securityErrorIsPause(error)) throw error;
      dispatchSecurityPause({ reason: safeText(error?.reason || error?.code), recovery: error?.recovery || null });
      return false;
    }
    const pause = await securityPause();
    if (pause) {
      dispatchSecurityPause(pause);
      return false;
    }
    if (!state.db || !navigator.onLine || !state.deviceId) return false;
    return withQueueLock((lockContext) => runWorker(lockContext), { ifAvailable: true });
  }

  async function drainForNewWorkUnlocked(lockContext = {}) {
    for (let batch = 0; batch < CONFIG.ADMISSION_MAX_BATCHES; batch += 1) {
      const before = await listActions();
      if (before.length === 0) return Object.freeze({ admitted: true, queued: 0, batches: batch });
      if (!navigator.onLine) return Object.freeze({ admitted: false, queued: before.length, batches: batch, reason: 'offline_queue_pending' });
      const ran = await runWorker(lockContext);
      const after = await listActions();
      if (after.length === 0) return Object.freeze({ admitted: true, queued: 0, batches: batch + 1 });
      if (!ran || after.length >= before.length) {
        return Object.freeze({ admitted: false, queued: after.length, batches: batch + 1, reason: 'unresolved_queue_pending' });
      }
    }
    const remaining = await listActions();
    return Object.freeze({ admitted: remaining.length === 0, queued: remaining.length, batches: CONFIG.ADMISSION_MAX_BATCHES, reason: remaining.length ? 'queue_drain_bound_reached' : null });
  }
  async function drainForNewWork(authorize = null) {
    await ensureWorkerReady();
    return withQueueLock(async (lockContext) => {
      const admission = await drainForNewWorkUnlocked(lockContext);
      if (admission.admitted !== true || typeof authorize !== 'function') return admission;
      const value = await authorize();
      const afterAuthorization = await listActions();
      if (afterAuthorization.length) {
        return Object.freeze({
          admitted: false,
          queued: afterAuthorization.length,
          batches: admission.batches,
          reason: 'queue_changed_during_admission',
        });
      }
      return Object.freeze({ ...admission, value });
    });
  }

  function localOpenWorkCount(deviceId) {
    const openStatuses = new Set(['active', 'server-active', 'offline-provisional', 'pending_submit', 'pending_sync']);
    let count = 0;
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith('session:')) continue;
        const row = JSON.parse(localStorage.getItem(key) || 'null');
        if (safeText(row?.device_id).toUpperCase() === deviceId && openStatuses.has(safeText(row?.status).toLowerCase())) count += 1;
      }
    } catch (_error) {
      return -1;
    }
    return count;
  }

  async function rollbackReadiness() {
    await ensureWorkerReady();
    if (!state.db || !state.deviceId || !navigator.onLine) throw new Error('Rollback readiness requires this enrolled phone to be online.');
    if (typeof navigator.locks?.request !== 'function') {
      throw new Error('Rollback readiness requires the browser Web Locks authority.');
    }
    return withQueueLock(async (lockContext) => {
      const drained = await drainForNewWorkUnlocked(lockContext);
      const queue = await listActions();
      const localOpen = localOpenWorkCount(state.deviceId);
      const nativeRead = window.MemphisMobile?.getOfflineAuthorityState;
      const nativeBeginFence = window.MemphisMobile?.beginRollbackFence;
      const nativeClearFence = window.MemphisMobile?.clearRollbackFence;
      if (typeof nativeRead !== 'function' || typeof nativeBeginFence !== 'function' || typeof nativeClearFence !== 'function') {
        throw new Error('The native rollback-fence capability is unavailable.');
      }
      const native = await nativeRead(state.deviceId);
      const nativePending = native?.occurrences_awaiting_acknowledgement === true ? 1 : 0;
      const preconditionsReady = drained.admitted === true && queue.length === 0 && localOpen === 0 && nativePending === 0;
      const initialRollbackFenceId = native?.rollback_fence_active === true ? safeText(native.rollback_fence_id) : '';
      let rollbackFenceId = initialRollbackFenceId;
      try {
        if (preconditionsReady) {
          const fenced = await nativeBeginFence(state.deviceId);
          rollbackFenceId = fenced?.rollback_fence_active === true ? safeText(fenced.rollback_fence_id) : '';
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rollbackFenceId)) {
            throw new Error('The native rollback fence was not durably established.');
          }
          const fencedState = await nativeRead(state.deviceId);
          if (fencedState?.rollback_fence_active !== true || safeText(fencedState.rollback_fence_id) !== rollbackFenceId
            || fencedState?.occurrences_awaiting_acknowledgement === true) {
            throw new Error('The native rollback fence could not prove a quiescent phone.');
          }
        }
        const reported = await reportDeviceSyncStatus(queue);
        if (!reported) throw new Error('The backend did not accept the current queue status.');
        const backend = await rpc('tool_get_device_rollback_readiness', { p_device_identifier: state.deviceId });
        const eligible = preconditionsReady && rollbackFenceId !== ''
          && backend?.eligible === true && Number(backend.backend_queue_count) === 0 && Number(backend.backend_open_session_count) === 0;
        if (!eligible && rollbackFenceId) {
          await nativeClearFence(state.deviceId, rollbackFenceId);
          rollbackFenceId = '';
        }
        return Object.freeze({
          contract_version: 'custodial-rollback-readiness.v2',
          captured_at: new Date().toISOString(),
          device_id: state.deviceId,
          browser_queue_count: queue.length,
          local_open_work_count: localOpen,
          native_occurrence_count: nativePending,
          backend_queue_count: Number(backend?.backend_queue_count ?? -1),
          backend_open_session_count: Number(backend?.backend_open_session_count ?? -1),
          backend_sync_reported_at: backend?.backend_sync_reported_at || null,
          rollback_fence_active: rollbackFenceId !== '',
          rollback_fence_id: rollbackFenceId || null,
          eligible,
        });
      } catch (error) {
        if (!initialRollbackFenceId) {
          try {
            const active = await nativeRead(state.deviceId);
            const activeFenceId = active?.rollback_fence_active === true ? safeText(active.rollback_fence_id) : '';
            if (activeFenceId) await nativeClearFence(state.deviceId, activeFenceId);
          } catch (_cleanupError) {}
        }
        throw error;
      }
    });
  }

  async function cancelRollbackFence(rollbackFenceId) {
    await ensureWorkerReady();
    if (!state.deviceId) throw new Error('The enrolled phone identity is unavailable.');
    const nativeClearFence = window.MemphisMobile?.clearRollbackFence;
    const nativeRead = window.MemphisMobile?.getOfflineAuthorityState;
    if (typeof nativeClearFence !== 'function' || typeof nativeRead !== 'function') throw new Error('The native rollback-fence capability is unavailable.');
    return withQueueLock(async () => {
      await nativeClearFence(state.deviceId, rollbackFenceId);
      const native = await nativeRead(state.deviceId);
      if (native?.rollback_fence_active === true) throw new Error('The native rollback fence remains active.');
      return Object.freeze({ cleared: true, device_id: state.deviceId });
    });
  }

  async function recoverStaleRollbackFenceForNewWork(rollbackFenceId) {
    await ensureWorkerReady();
    const expectedFenceId = safeText(rollbackFenceId).toLowerCase();
    if (!state.db || !state.deviceId || !navigator.onLine) {
      throw new Error('Rollback-fence recovery requires this enrolled phone to be online.');
    }
    if (!isUuid(expectedFenceId)) throw new Error('The rollback-fence identity is invalid.');
    if (typeof navigator.locks?.request !== 'function') {
      throw new Error('Rollback-fence recovery requires the browser Web Locks authority.');
    }
    return withQueueLock(async (lockContext) => {
      const drained = await drainForNewWorkUnlocked(lockContext);
      const queue = await listActions();
      const localOpen = localOpenWorkCount(state.deviceId);
      const nativeRead = window.MemphisMobile?.getOfflineAuthorityState;
      const nativeClearFence = window.MemphisMobile?.clearRollbackFence;
      if (typeof nativeRead !== 'function' || typeof nativeClearFence !== 'function') {
        throw new Error('The native rollback-fence capability is unavailable.');
      }
      const native = await nativeRead(state.deviceId);
      const nativeFenceId = native?.rollback_fence_active === true ? safeText(native.rollback_fence_id).toLowerCase() : '';
      const localReady = drained.admitted === true && queue.length === 0 && localOpen === 0
        && native?.occurrences_awaiting_acknowledgement !== true && nativeFenceId === expectedFenceId;
      if (!localReady) {
        return Object.freeze({
          contract_version: 'custodial-stale-rollback-fence-recovery.v1', device_id: state.deviceId,
          browser_queue_count: queue.length, local_open_work_count: localOpen,
          native_occurrence_count: native?.occurrences_awaiting_acknowledgement === true ? 1 : 0,
          backend_queue_count: -1, backend_open_session_count: -1,
          rollback_fence_active: nativeFenceId !== '', rollback_fence_id: nativeFenceId || null,
          eligible: false, cleared: false,
        });
      }
      const reported = await reportDeviceSyncStatus(queue);
      if (!reported) throw new Error('The backend did not accept the current queue status.');
      const backend = await rpc('tool_get_device_rollback_readiness', { p_device_identifier: state.deviceId });

      // Re-read every phone-side input while the same cross-tab lock is still
      // held. A stale proof must never clear protected state.
      const finalQueue = await listActions();
      const finalLocalOpen = localOpenWorkCount(state.deviceId);
      const finalNative = await nativeRead(state.deviceId);
      const finalFenceId = finalNative?.rollback_fence_active === true
        ? safeText(finalNative.rollback_fence_id).toLowerCase() : '';
      const eligible = backend?.eligible === true
        && Number(backend.backend_queue_count) === 0
        && Number(backend.backend_open_session_count) === 0
        && finalQueue.length === 0
        && finalLocalOpen === 0
        && finalNative?.occurrences_awaiting_acknowledgement !== true
        && finalFenceId === expectedFenceId;
      if (!eligible) {
        return Object.freeze({
          contract_version: 'custodial-stale-rollback-fence-recovery.v1', device_id: state.deviceId,
          browser_queue_count: finalQueue.length, local_open_work_count: finalLocalOpen,
          native_occurrence_count: finalNative?.occurrences_awaiting_acknowledgement === true ? 1 : 0,
          backend_queue_count: Number(backend?.backend_queue_count ?? -1),
          backend_open_session_count: Number(backend?.backend_open_session_count ?? -1),
          rollback_fence_active: finalFenceId !== '', rollback_fence_id: finalFenceId || null,
          eligible: false, cleared: false,
        });
      }
      await nativeClearFence(state.deviceId, expectedFenceId);
      const verified = await nativeRead(state.deviceId);
      if (verified?.rollback_fence_active === true || verified?.occurrences_awaiting_acknowledgement === true) {
        throw new Error('The native rollback fence remains active.');
      }
      return Object.freeze({
        contract_version: 'custodial-stale-rollback-fence-recovery.v1', device_id: state.deviceId,
        browser_queue_count: 0, local_open_work_count: 0, native_occurrence_count: 0,
        backend_queue_count: 0, backend_open_session_count: 0,
        rollback_fence_active: false, rollback_fence_id: null,
        eligible: true, cleared: true,
      });
    });
  }

  async function recoverDeadLetter(id, { syncAfter = true } = {}) {
    await ensureWorkerReady();
    if (!state.db) throw new Error('The durable scan queue is not ready.');
    return mutateProtectedQueue(() => new Promise((resolve, reject) => {
      const tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.get(id);
      let recovered = false;
      request.onsuccess = () => {
        if (!request.result) return;
        if (request.result.recoverable === false) return;
        recovered = true;
        store.put(storageRecord({ ...normalizeRecord(request.result), dead_letter: false, state: 'reconciliation-required', next_attempt_at: 0, lease_owner: null, lease_token: null, lease_until: 0 }));
      };
      tx.oncomplete = () => {
        resolve(recovered);
        if (syncAfter && recovered) scheduleSync();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Queue recovery transaction aborted.'));
    }));
  }

  async function recoverAllDeadLetters() {
    await ensureWorkerReady();
    await custodialSecurity()?.waitForStableState?.({ requireEnrollment: true });
    const deadLetters = (await listActions()).filter((item) => item.dead_letter === true && item.recoverable !== false);
    if (!deadLetters.length) return 0;
    await Promise.all(deadLetters.map((item) => recoverDeadLetter(item.id, { syncAfter: false })));
    scheduleSync();
    return deadLetters.length;
  }

  function installWorkerListeners() {
    if (state.listenersInstalled) return;
    state.listenersInstalled = true;
    window.addEventListener('online', () => observeSync(sync()));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) observeSync(sync()); });
    window.addEventListener('memphis:custodial-security-state', (event) => {
      const status = event.detail || {};
      if (status.ready === true && status.available === true && !status.quarantined) {
        scheduleSync();
        return;
      }
      if (state.timer) window.clearInterval(state.timer);
      state.timer = null;
    });
  }

  async function init() {
    installWorkerListeners();
    if (!window.indexedDB) return false;
    await mutateProtectedQueue(async (context) => {
      state.deviceId = safeText(context?.deviceId) || resolveDeviceId();
      state.db = await openDb();
    });
    state.channel?.addEventListener('message', (event) => {
      if (event.data?.type === 'queued' && navigator.onLine) scheduleSync(50);
      dispatchStatus({ status: 'peer-update', ...event.data });
    });
    state.timer = window.setInterval(() => observeSync(sync()), CONFIG.POLL_MS);
    scheduleSync(900);
    return true;
  }

  function ensureWorkerReady() {
    if (state.db) return Promise.resolve(true);
    if (!state.initializing) {
      state.initializing = init().finally(() => { state.initializing = null; });
    }
    return state.initializing;
  }

  const ready = ensureWorkerReady().catch((error) => {
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
    recoverAllDeadLetters,
    drainForNewWork,
    rollbackReadiness,
    cancelRollbackFence,
    recoverStaleRollbackFenceForNewWork,
    saveCompletionDraft,
    loadCompletionDraft,
    deleteCompletionDraft,
    resolveDeviceId: () => state.deviceId || resolveDeviceId(),
    queueSchemaVersion: CONFIG.SCHEMA_VERSION,
  };
})();
