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
    WORKER_LOCK_NAME: 'memphis-scan-network-worker-v1',
    CHANNEL_NAME: 'memphis-scan-queue-v4',
    MAX_RETRIES: 50,
    ADMISSION_MAX_BATCHES: 64,
    FRONTEND_VERSION: 'release-2026.07.19.custodial-v3.12',
    MINIMUM_BACKEND_VERSION: 'release-2026.07.19.custodial-v3.12',
    REQUIRED_SCAN_CONTRACT_VERSION: 'scan.v4.snapshot-bound-authority',
    REQUIRED_BACKEND_SCHEMA_FINGERPRINT: '8f9c8059f07dcebbba60f3ef143b8e7a58fe063a960d08b05dae0b4ef2e03d80',
  };

  const state = {
    db: null,
    deviceId: '',
    syncing: false,
    initializing: null,
    listenersInstalled: false,
    workerId: `scan-worker-${crypto.randomUUID()}`,
    timer: null,
    scheduledSyncTimer: null,
    scheduledSyncAt: 0,
    channel: typeof BroadcastChannel === 'function' ? new BroadcastChannel(CONFIG.CHANNEL_NAME) : null,
    lastServerAckAt: null,
    lastError: null,
    // The native Custodial shell may have protected interrupted-start evidence
    // to classify before any queued Start Cleaning action is replayed. The
    // bridge is loaded before this worker, so its recovery capability is the
    // fail-closed signal that startup replay must wait for the app tribunal.
    startupRecoveryPending: typeof window.MemphisMobile?.reconcileRecoveredPreStart === 'function',
  };

  function custodialSecurity() {
    const security = window.MemphisCustodialSecurity;
    return security && typeof security === 'object' ? security : null;
  }

  // Bootstrap markers can only withdraw the legacy path, never admit work.
  // Once observed in this worker, removing a marker cannot reopen that path.
  let nativeQueueSecurityRequired = false;
  // The compatibility web queue shares the same origin's protected DATA.
  // Absence of native enrollment is not permission to write through a browser
  // preservation hold. Keep one private owner; failed acquisition is not reset.
  let legacyBrowserAdmissionPromise = null;
  let legacyBrowserAdmission = null;
  let legacyBrowserSource = null;
  function legacyBrowserMutationOwner() {
    if (!legacyBrowserAdmissionPromise) {
      try {
        // Capture original mutation resources synchronously, BEFORE import.
        // Inventory/cipher ports are not prerequisites for a local mutation.
        const area = window.localStorage, navigatorObject = window.navigator;
        const locks = navigatorObject?.locks, request = locks?.request;
        if (typeof request !== 'function') {
          throw Object.assign(queueSecurityUnavailable(), { reason: 'browser_shared_lock_unavailable' });
        }
        const prototype = Object.getPrototypeOf(area), methods = {}, optional = {};
        for (const name of ['getItem', 'setItem']) {
          const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
          // A firewall's replaced/sealed methods are not raw storage loans.
          if (!descriptor || descriptor.writable !== true || descriptor.configurable !== true
            || typeof descriptor.value !== 'function' || area[name] !== descriptor.value) throw queueSecurityUnavailable();
          methods[name] = descriptor.value;
        }
        for (const name of ['sessionStorage', 'indexedDB', 'crypto']) {
          // Optional inventory ports confer no mutation authority.
          // Pin a readable port if present; never use an unavailable one or
          // require inventory support just to mutate original local storage.
          try { const value = window[name]; if (value !== undefined) optional[name] = value; }
          catch (_) { /* Not borrowed by this mutation-only owner. */ }
        }
        let withdrawn = false, requestedMutation = null, activeMutation = null;
        const current = () => {
          try {
            if (withdrawn || queueMutationSecurity() !== null || window.localStorage !== area
              || Object.getPrototypeOf(area) !== prototype || window.navigator !== navigatorObject
              || navigatorObject.locks !== locks || locks.request !== request) throw queueSecurityUnavailable();
            for (const name of Object.keys(methods)) {
              const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
              if (area[name] !== methods[name] || descriptor?.value !== methods[name]
                || descriptor.writable !== true || descriptor.configurable !== true) throw queueSecurityUnavailable();
            }
            for (const name of Object.keys(optional)) {
              if (window[name] !== optional[name]) throw queueSecurityUnavailable();
            }
          } catch (error) { withdrawn = true; throw error; }
        };
        const requireActive = () => {
          current();
          if (!activeMutation) throw queueSecurityUnavailable();
          activeMutation.current();
        };
        const storage = Object.freeze({
          getItem(key) {
            requireActive(); const raw = methods.getItem.call(area, key); requireActive();
            if (raw !== null && typeof raw !== 'string') { withdrawn = true; throw queueSecurityUnavailable(); }
            return raw;
          },
          setItem(key, value) {
            requireActive(); methods.setItem.call(area, key, value); requireActive();
          },
        });
        const fixedLocks = Object.freeze({
          request(name, options, operation) {
            // The admission invokes request synchronously. Borrow ONLY that
            // private invocation through this exact queued lock callback.
            const original = requestedMutation;
            current();
            if (!original) throw queueSecurityUnavailable();
            original.current();
            return request.call(locks, name, options, async lock => {
              original.current();
              if (activeMutation) throw queueSecurityUnavailable();
              activeMutation = original;
              try { return await operation(lock); }
              finally { activeMutation = null; }
            });
          },
        });
        legacyBrowserSource = Object.freeze({
          current,
          requireMutation() {
            requireActive(); legacyBrowserAdmission.requireMutation(); requireActive();
          },
          async mutate(owner, deviceId, operation) {
            let closed = false, refused = false;
            const original = Object.freeze({
              current() {
                try {
                  current();
                  if (closed || refused || state.deviceId !== deviceId) throw queueSecurityUnavailable();
                } catch (error) { refused = true; throw error; }
              },
            });
            const context = Object.freeze({
              deviceId, generation: null, state: 'legacy',
              assertCurrent() {
                original.current();
                if (activeMutation !== original) throw queueSecurityUnavailable();
                try { owner.requireMutation(); original.current(); }
                catch (error) { refused = true; throw error; }
              },
            });
            original.current();
            let pending;
            try {
              requestedMutation = original;
              pending = owner.mutate(async () => {
                context.assertCurrent();
                const result = await operation(context);
                context.assertCurrent();
                return result;
              });
            } finally { requestedMutation = null; }
            try { const result = await pending; original.current(); return result; }
            finally { closed = true; }
          },
        });
        current();
        legacyBrowserAdmissionPromise = import('./mobile/src/custodial/protected-browser-admission.js')
          .then(({ createProtectedBrowserAdmission }) => {
            current();
            legacyBrowserAdmission = createProtectedBrowserAdmission({ storage, locks: fixedLocks });
            current();
            return legacyBrowserAdmission;
          });
      } catch (error) {
        // Never retry acquisition against a successor resource set.
        legacyBrowserAdmissionPromise = Promise.reject(error);
      }
    }
    return legacyBrowserAdmissionPromise;
  }
  // Cooperative synchronous checkpoint for existing page metadata writers.
  // Only the SAME private active callback can borrow its mutation checkpoint.
  function requireLegacyBrowserMutation() {
    if (!legacyBrowserSource || !legacyBrowserAdmission) throw queueSecurityUnavailable();
    legacyBrowserSource.requireMutation();
  }
  function queueMutationSecurity() {
    const security = custodialSecurity();
    try {
      if (window.MemphisMobile?.edition === 'custodial'
        || window.MemphisMobileBuildIdentity?.edition === 'custodial'
        || (typeof window.Capacitor?.isNativePlatform === 'function' && window.Capacitor.isNativePlatform() === true)
        || security?.native === true) nativeQueueSecurityRequired = true;
    } catch (_) {
      nativeQueueSecurityRequired = true;
      throw queueSecurityUnavailable();
    }
    if ((nativeQueueSecurityRequired && (security?.native !== true
      || typeof security.waitForStableState !== 'function' || typeof security.getStatus !== 'function'))
      || (security && typeof security.mutateProtectedWork !== 'function')) throw queueSecurityUnavailable();
    return security;
  }

  function queueSecurityUnavailable() {
    return Object.assign(new Error('Protected scan queue admission is unavailable; original work is retained.'),
      { code: 'custodial_security_state_unavailable' });
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
    const security = queueMutationSecurity();
    if (!security) {
      const deviceId = state.deviceId;
      const owner = await legacyBrowserMutationOwner();
      return legacyBrowserSource.mutate(owner, deviceId, operation);
    }
    return security.mutateProtectedWork((context) => {
      if (queueMutationSecurity() !== security) throw queueSecurityUnavailable();
      queueOpeningCheckpoint(context);
      return operation(context);
    }, options);
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
    if (state.startupRecoveryPending) return null;
    // Browser timers overflow beyond signed 32-bit milliseconds. Wake in a safe
    // chunk; queue eligibility retains the original server-directed deadline.
    const chunk = Number.isFinite(delay) ? Math.min(2147483647, Math.max(0, delay)) : CONFIG.POLL_MS;
    const at = now() + chunk;
    if (state.scheduledSyncTimer != null && state.scheduledSyncAt <= at) return state.scheduledSyncTimer;
    if (state.scheduledSyncTimer != null) window.clearTimeout(state.scheduledSyncTimer);
    state.scheduledSyncAt = at;
    state.scheduledSyncTimer = window.setTimeout(() => {
      state.scheduledSyncTimer = null;
      state.scheduledSyncAt = 0;
      observeSync(sync());
    }, chunk);
    return state.scheduledSyncTimer;
  }

  function releaseStartupRecoveryGate(recovery) {
    const recoveryState = safeText(recovery?.state);
    if (!['none', 'not_applicable', 'retired_preserved'].includes(recoveryState)) return false;
    if (!state.startupRecoveryPending) return true;
    state.startupRecoveryPending = false;
    scheduleSync();
    return true;
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

  function openCompletionDraftDb(context, { readonly = false } = {}) {
    queueOpeningCheckpoint(context);
    return new Promise((resolve, reject) => {
      // Reads must never create or upgrade the draft database. An open without
      // a version lets us inspect only an already-existing schema.
      const request = readonly
        ? indexedDB.open(CONFIG.COMPLETION_DRAFT_DB_NAME)
        : indexedDB.open(CONFIG.COMPLETION_DRAFT_DB_NAME, 1);
      let missing = false;
      let failure = null;
      request.onupgradeneeded = (event) => {
        try {
          queueOpeningCheckpoint(context);
          if (readonly) {
            missing = event.oldVersion === 0;
            failure = missing ? null : storageFailure('completion draft', new Error('unknown database schema'));
            request.transaction.abort();
            return;
          }
          if (event.oldVersion === 0) {
            request.result.createObjectStore(CONFIG.COMPLETION_DRAFT_STORE_NAME, { keyPath: 'session_uuid' });
          } else {
            failure = storageFailure('completion draft', new Error('unknown database schema'));
            request.transaction.abort();
          }
        } catch (error) {
          failure = error;
          try { request.transaction.abort(); } catch (_) { /* terminal request handler reports the original failure */ }
        }
      };
      request.onsuccess = () => {
        try {
          queueOpeningCheckpoint(context);
          const db = request.result;
          if (db.version !== 1 || !db.objectStoreNames.contains(CONFIG.COMPLETION_DRAFT_STORE_NAME)) {
            db.close();
            throw storageFailure('completion draft', new Error('unknown database schema'));
          }
          resolve(queueOpeningConnection(db));
        } catch (error) {
          request.result.close();
          reject(error);
        }
      };
      request.onerror = () => {
        try { queueOpeningCheckpoint(context); } catch (error) { reject(error); return; }
        if (missing) resolve(null);
        else reject(failure || storageFailure('completion draft', request.error));
      };
      // IndexedDB open requests cannot be cancelled. Keep their owner/admission
      // until a terminal success/error, even if another connection blocks them.
      request.onblocked = () => {};
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
    if (record.schema_version !== CONFIG.COMPLETION_DRAFT_SCHEMA_VERSION) {
      throw storageFailure('completion draft', new Error('unknown record schema'));
    }
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

    const security = queueMutationSecurity(), mobile = window.MemphisMobile;
    const reader = security?.getStatus, writer = security?.mutateProtectedWork, principalReader = mobile?.principalIdentity;
    const initial = security?.native === true ? security.getStatus() : null;
    const original = initial ? Object.freeze({ generation: initial.generation, deviceId: initial.deviceId,
      principal: canonicalJson(initial.principal), identity: mobile?.principalIdentity?.(), employeeId: initial.principal?.employee_id }) : null;
    const originalIndexedDB = window.indexedDB, originalOpen = originalIndexedDB?.open;
    const requireOriginal = (context) => {
      const liveSecurity = queueMutationSecurity();
      if (liveSecurity !== security || security?.getStatus !== reader || security?.mutateProtectedWork !== writer
        || window.MemphisMobile !== mobile || window.indexedDB !== originalIndexedDB || originalIndexedDB?.open !== originalOpen)
        throw queueSecurityUnavailable();
      if (original) {
        const live = reader.call(security);
        if (mobile?.principalIdentity !== principalReader || live?.ready !== true || live.available !== true
          || live.quarantined !== false || live.state !== 'enrolled' || !Number.isSafeInteger(original.generation)
          || original.generation < 1 || live.generation !== original.generation || live.deviceId !== original.deviceId
          || !live.principal || live.principal.device_id !== original.deviceId
          || !['custodial-protected-principal.v1', 'custodial-protected-principal.v2'].includes(live.principal.schema_version)
          || !isUuid(live.principal.employee_id) || !isUuid(live.principal.credential_id)
          || !Number.isSafeInteger(live.principal.assignment_epoch) || live.principal.assignment_epoch < 1
          || canonicalJson(live.principal) !== original.principal || typeof original.identity !== 'string' || !original.identity
          || principalReader.call(mobile) !== original.identity) throw queueSecurityUnavailable();
        if (context !== undefined && (context?.generation !== original.generation || context?.deviceId !== original.deviceId))
          throw queueSecurityUnavailable();
      } else if (liveSecurity?.native === true) throw queueSecurityUnavailable();
      if (context !== undefined) queueOpeningCheckpoint(context);
    };
    const options = { requireEnrollment: true, ...(original ? { expectedGeneration: original.generation } : {}) };
    requireOriginal();

    // Snapshot own plain data before hashing or FIFO admission; never call input getters.
    const copy = (value, depth = 0) => {
      if (depth > 64) throw storageFailure('completion draft', new Error('draft is too deep'));
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (!value || typeof value !== 'object')
        throw storageFailure('completion draft', new Error('draft must be exact plain data'));
      const prototype = Object.getPrototypeOf(value);
      if (!Array.isArray(value) && prototype !== null && (Object.getPrototypeOf(prototype) !== null
        || Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value?.name !== 'Object'))
        throw storageFailure('completion draft', new Error('draft must be exact plain data'));
      const descriptors = Object.getOwnPropertyDescriptors(value), result = Array.isArray(value) ? [] : Object.create(null);
      for (const key of Reflect.ownKeys(descriptors)) {
        if (Array.isArray(value) && key === 'length') continue;
        const descriptor = descriptors[key];
        if (typeof key !== 'string' || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable
          || ['__proto__', 'prototype', 'constructor'].includes(key))
          throw storageFailure('completion draft', new Error('draft accessors or unsafe fields are unavailable'));
        result[key] = copy(descriptor.value, depth + 1);
      }
      if (Array.isArray(value) && (result.length !== value.length || Object.keys(result).length !== value.length))
        throw storageFailure('completion draft', new Error('sparse draft arrays are unavailable'));
      return result;
    };
    const snapshot = copy(input);
    const identity = completionDraftIdentity(snapshot), id = identity.session_uuid;
    if (original && (identity.device_id !== original.deviceId || identity.employee_id !== original.employeeId))
      throw storageFailure('completion draft', new Error('draft does not belong to the original native principal'));
    const record = await completionDraftRecord(snapshot);
    requireOriginal();

    // Own direct transaction terminal dispatch, not an earlier bubbled request/error.
    const readOrWrite = (db, context, write, captured, replacement) => new Promise((resolve, reject) => {
      let tx = null, failure = null, result = null;
      const refuse = (error) => {
        failure = failure || error;
        if (!tx) { reject(failure); return; }
        try { tx.abort(); } catch (abortError) {
          failure = Object.assign(new AggregateError([failure, abortError],
            'Completion draft settlement is uncertain.', { cause: failure }),
          { code: failure.code || 'custodial_storage_unavailable' });
        }
      };
      const settle = (aborted) => {
        let error = failure || (aborted ? storageFailure('completion draft', tx.error || new Error('transaction aborted')) : null);
        try { requireOriginal(context); } catch (withdrawn) { error = error || withdrawn; }
        if (error) reject(error); else resolve(result);
      };
      try {
        requireOriginal(context);
        tx = db.transaction(CONFIG.COMPLETION_DRAFT_STORE_NAME, write ? 'readwrite' : 'readonly');
        tx.oncomplete = event => { if (event.target === tx) window.setTimeout(() => settle(false), 0); };
        tx.onabort = event => { if (event.target === tx) window.setTimeout(() => settle(true), 0); };
        tx.onerror = event => {
          failure = failure || storageFailure('completion draft', event.target?.error || tx.error);
          try { requireOriginal(context); } catch (error) { failure = failure || error; }
        };
        requireOriginal(context);
        const store = tx.objectStore(CONFIG.COMPLETION_DRAFT_STORE_NAME);
        const lookup = store.get(id);
        lookup.onerror = () => refuse(storageFailure('completion draft', lookup.error || tx.error));
        lookup.onsuccess = () => {
          try {
            requireOriginal(context);
            if (failure) throw failure;
            result = lookup.result == null ? null : lookup.result;
            if (result !== null && !queueOpeningRowsMatch([result], [JSON.parse(canonicalJson(result))]))
              throw storageFailure('completion draft', new Error('unknown original draft representation'));
            if (write) {
              if (!queueOpeningRowsMatch(result === null ? [] : [result], captured === null ? [] : [captured]))
                throw storageFailure('completion draft', new Error('original draft changed before mutation'));
              requireOriginal(context);
              const request = replacement ? store.put(replacement) : result === null ? null : store.delete(id);
              if (request) request.onerror = () => refuse(storageFailure('completion draft', request.error || tx.error));
              requireOriginal(context);
            }
          } catch (error) { refuse(error); }
        };
      } catch (error) { refuse(error); }
    });
    const validateRecord = async (raw, expected) => {
      if (raw === null) return null;
      const keys = ['schema_version', 'contract_version', 'session_uuid', 'client_completion_id', 'device_id',
        'employee_id', 'location_code', 'draft', 'integrity_sha256', 'saved_at'];
      if (Object.keys(raw).sort().join('|') !== keys.sort().join('|')
        || typeof raw.integrity_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(raw.integrity_sha256)
        || typeof raw.saved_at !== 'string' || !Number.isFinite(Date.parse(raw.saved_at)))
        throw storageFailure('completion draft', new Error('unknown original draft'));
      const identity = completionDraftIdentity(raw);
      if (Object.keys(identity).some(key => raw[key] !== identity[key])
        || original && (identity.device_id !== original.deviceId || identity.employee_id !== original.employeeId))
        throw storageFailure('completion draft', new Error('foreign original draft'));
      const verified = await verifyCompletionDraftRecord(raw, expected || identity);
      requireOriginal();
      return verified;
    };

    const result = await mutateProtectedQueue(async context => {
      requireOriginal(context);
      const db = await openCompletionDraftDb(context);
      try {
        requireOriginal(context);
        const raw = await readOrWrite(db, context, false);
        requireOriginal(context);
        const captured = raw === null ? null : JSON.parse(canonicalJson(raw));
        await validateRecord(raw, identity);
        requireOriginal(context);
        await readOrWrite(db, context, true, captured, record);
        requireOriginal(context);
        const readback = await readOrWrite(db, context, false);
        requireOriginal(context);
        if (!readback || !queueOpeningRowsMatch([record], [readback]))
          throw storageFailure('completion draft', new Error('write verification failed'));
        const verified = await validateRecord(readback, identity);
        requireOriginal(context);
        return verified;
      } finally { db.close(); }
    }, options);
    requireOriginal(); // The callback context is closed here; use only original readers.
    return result;
  }

  async function readCompletionDraftWithinOwnedContext(expected, context) {
    if (!window.indexedDB) throw storageFailure('completion draft', new Error('IndexedDB is unavailable'));
    // Capture the actual runtime observation BEFORE any FIFO/open/hash await.
    // This comparison is only a refusal fence; admission still owns authority.
    const security = queueMutationSecurity();
    const methods = security ? [security.getStatus, security.mutateProtectedWork, security.waitForStableState] : [];
    const observe = () => {
      if (queueMutationSecurity() !== security || (security
        && (security.getStatus !== methods[0] || security.mutateProtectedWork !== methods[1]
          || security.waitForStableState !== methods[2]))) throw queueSecurityUnavailable();
      const status = typeof methods[0] === 'function' ? methods[0].call(security) : null;
      if (security?.native === true && (status?.ready !== true || status.available !== true
        || status.quarantined !== false || status.state !== 'enrolled'
        || !Number.isSafeInteger(status.generation) || status.generation <= 0)) throw queueSecurityUnavailable();
      return status;
    };
    const original = observe();
    const owner = status => status ? JSON.stringify([status.ready, status.available, status.quarantined,
      status.state, status.deviceId, status.generation, status.principal]) : null;
    const originalOwner = owner(original);
    const checkpoint = context => {
      if (owner(observe()) !== originalOwner) {
        throw Object.assign(new Error('The original completion draft reader changed; original data is retained.'),
          { code: 'custodial_security_generation_changed' });
      }
      if (context) {
        queueOpeningCheckpoint(context);
        if (original && (context.generation !== original.generation || context.deviceId !== original.deviceId)) throw queueSecurityUnavailable();
      }
    };
    const identity = Object.freeze(completionDraftIdentity(expected));
    checkpoint(context);
    const db = await openCompletionDraftDb(context, { readonly: true });
    try {
      // An absent database resolves from an aborted open request. Keep its
      // original owner through that terminal dispatch as well as read TXs.
      await new Promise(resolve => window.setTimeout(resolve, 0));
      checkpoint(context);
      if (!db) return null;
      const record = await new Promise((resolve, reject) => {
        checkpoint(context);
        const transaction = db.transaction(CONFIG.COMPLETION_DRAFT_STORE_NAME, 'readonly');
        checkpoint(context);
        const request = transaction.objectStore(CONFIG.COMPLETION_DRAFT_STORE_NAME).get(identity.session_uuid);
        let result;
        let observed = false;
        let failure = null;
        request.onsuccess = () => {
          try { checkpoint(context); result = request.result; observed = true; } catch (error) { failure = error; }
        };
        request.onerror = () => { failure = storageFailure('completion draft', request.error); };
        // Error bubbles are not terminal. Retain the actual owner until the
        // transaction terminal dispatch (including later listeners) has ended.
        transaction.onerror = () => { failure ||= storageFailure('completion draft', transaction.error); };
        const settle = (event, aborted) => {
          if (event.target !== transaction) return;
          window.setTimeout(() => {
            try {
              checkpoint(context);
              if (failure) throw failure;
              if (aborted || !observed) throw storageFailure('completion draft', transaction.error || new Error('read did not complete'));
              resolve(result == null ? null : result);
            } catch (error) { reject(error); }
          }, 0);
        };
        transaction.oncomplete = event => settle(event, false);
        transaction.onabort = event => settle(event, true);
      });
      checkpoint(context);
      if (record == null) return null; // Only an owned successful absence is empty.
      const verified = await verifyCompletionDraftRecord(record, identity);
      checkpoint(context);
      if (!verified) throw storageFailure('completion draft', new Error('invalid stored draft'));
      return verified;
    } finally { db?.close(); }
  }

  function loadCompletionDraft(expected) {
    if (!window.indexedDB) throw storageFailure('completion draft', new Error('IndexedDB is unavailable'));
    // Capture the actual runtime observation BEFORE any FIFO/open/hash await.
    // This comparison is only a refusal fence; admission still owns authority.
    const security = queueMutationSecurity();
    const methods = security ? [security.getStatus, security.mutateProtectedWork, security.waitForStableState] : [];
    const observe = () => {
      if (queueMutationSecurity() !== security || (security
        && (security.getStatus !== methods[0] || security.mutateProtectedWork !== methods[1]
          || security.waitForStableState !== methods[2]))) throw queueSecurityUnavailable();
      const status = typeof methods[0] === 'function' ? methods[0].call(security) : null;
      if (security?.native === true && (status?.ready !== true || status.available !== true
        || status.quarantined !== false || status.state !== 'enrolled'
        || !Number.isSafeInteger(status.generation) || status.generation <= 0)) throw queueSecurityUnavailable();
      return status;
    };
    const original = observe();
    const owner = status => status ? JSON.stringify([status.ready, status.available, status.quarantined,
      status.state, status.deviceId, status.generation, status.principal]) : null;
    const originalOwner = owner(original);
    const checkpoint = context => {
      if (owner(observe()) !== originalOwner) {
        throw Object.assign(new Error('The original completion draft reader changed; original data is retained.'),
          { code: 'custodial_security_generation_changed' });
      }
      if (context) {
        queueOpeningCheckpoint(context);
        if (original && (context.generation !== original.generation || context.deviceId !== original.deviceId)) throw queueSecurityUnavailable();
      }
    };
    const identity = Object.freeze(completionDraftIdentity(expected));
    checkpoint();
    // Never accept an owner/context from an API caller. Keep the original
    // identity/runtime while the existing private admission waits in its FIFO.
    return mutateProtectedQueue(async context => {
      checkpoint(context);
      const result = await readCompletionDraftWithinOwnedContext(identity, context);
      checkpoint(context);
      return result;
    }, { requireEnrollment: true, expectedGeneration: original?.generation ?? null }).then(result => {
      // The admission has closed here. Compare observations only; NEVER call
      // the now-closed private context from this public settlement path.
      checkpoint();
      return result;
    });
  }

  async function completionDraftExists(sessionUuid) {
    const id = safeText(sessionUuid).toLowerCase();
    if (!isUuid(id)) throw storageFailure('completion draft', new Error('session identifier is required'));
    if (!window.indexedDB) throw storageFailure('completion draft', new Error('IndexedDB is unavailable'));
    // Capture the actual runtime observation BEFORE any FIFO/open/hash await.
    // This comparison is only a refusal fence; admission still owns authority.
    const security = queueMutationSecurity();
    const methods = security ? [security.getStatus, security.mutateProtectedWork, security.waitForStableState] : [];
    const observe = () => {
      if (queueMutationSecurity() !== security || (security
        && (security.getStatus !== methods[0] || security.mutateProtectedWork !== methods[1]
          || security.waitForStableState !== methods[2]))) throw queueSecurityUnavailable();
      const status = typeof methods[0] === 'function' ? methods[0].call(security) : null;
      if (security?.native === true && (status?.ready !== true || status.available !== true
        || status.quarantined !== false || status.state !== 'enrolled'
        || !Number.isSafeInteger(status.generation) || status.generation <= 0)) throw queueSecurityUnavailable();
      return status;
    };
    const original = observe();
    const owner = status => status ? JSON.stringify([status.ready, status.available, status.quarantined,
      status.state, status.deviceId, status.generation, status.principal]) : null;
    const originalOwner = owner(original);
    const checkpoint = context => {
      if (owner(observe()) !== originalOwner) {
        throw Object.assign(new Error('The original completion draft reader changed; original data is retained.'),
          { code: 'custodial_security_generation_changed' });
      }
      if (context) {
        queueOpeningCheckpoint(context);
        if (original && (context.generation !== original.generation || context.deviceId !== original.deviceId)) throw queueSecurityUnavailable();
      }
    };
    checkpoint();
    const result = await mutateProtectedQueue(async context => {
      checkpoint(context);
      const db = await openCompletionDraftDb(context, { readonly: true });
      try {
        await new Promise(resolve => window.setTimeout(resolve, 0));
        checkpoint(context);
        if (!db) return false;
        const exists = await new Promise((resolve, reject) => {
          checkpoint(context);
          const transaction = db.transaction(CONFIG.COMPLETION_DRAFT_STORE_NAME, 'readonly');
          checkpoint(context);
          const request = transaction.objectStore(CONFIG.COMPLETION_DRAFT_STORE_NAME).getKey(id);
          let found = false;
          let observed = false;
          let failure = null;
          request.onsuccess = () => {
            try { checkpoint(context); found = request.result != null; observed = true; } catch (error) { failure = error; }
          };
          request.onerror = () => { failure = storageFailure('completion draft', request.error); };
          transaction.onerror = () => { failure ||= storageFailure('completion draft', transaction.error); };
          const settle = (event, aborted) => {
            if (event.target !== transaction) return;
            window.setTimeout(() => {
              try {
                checkpoint(context);
                if (failure) throw failure;
                if (aborted || !observed) throw storageFailure('completion draft', transaction.error || new Error('read did not complete'));
                resolve(found);
              } catch (error) { reject(error); }
            }, 0);
          };
          transaction.oncomplete = event => settle(event, false);
          transaction.onabort = event => settle(event, true);
        });
        checkpoint(context);
        return exists;
      } finally { db?.close(); }
    }, { requireEnrollment: true, expectedGeneration: original?.generation ?? null });
    checkpoint(); // Observation-only after admission; no closed context invocation.
    return result;
  }

  async function deleteCompletionDraft(sessionUuid, expectedGeneration = null) {
    const id = typeof sessionUuid === 'string' ? safeText(sessionUuid).toLowerCase() : '';
    if (!isUuid(id)) throw storageFailure('completion draft', new Error('session identifier is required'));
    if (!window.indexedDB) throw storageFailure('completion draft', new Error('IndexedDB is unavailable'));

    const security = queueMutationSecurity(), mobile = window.MemphisMobile;
    const reader = security?.getStatus, writer = security?.mutateProtectedWork, principalReader = mobile?.principalIdentity;
    const initial = security?.native === true ? security.getStatus() : null;
    const original = initial ? Object.freeze({ generation: initial.generation, deviceId: initial.deviceId,
      principal: canonicalJson(initial.principal), identity: mobile?.principalIdentity?.(), employeeId: initial.principal?.employee_id }) : null;
    const originalIndexedDB = window.indexedDB, originalOpen = originalIndexedDB?.open;
    const requireOriginal = (context) => {
      const liveSecurity = queueMutationSecurity();
      if (liveSecurity !== security || security?.getStatus !== reader || security?.mutateProtectedWork !== writer
        || window.MemphisMobile !== mobile || window.indexedDB !== originalIndexedDB || originalIndexedDB?.open !== originalOpen)
        throw queueSecurityUnavailable();
      if (original) {
        const live = reader.call(security);
        if (mobile?.principalIdentity !== principalReader || live?.ready !== true || live.available !== true
          || live.quarantined !== false || live.state !== 'enrolled' || !Number.isSafeInteger(original.generation)
          || original.generation < 1 || live.generation !== original.generation || live.deviceId !== original.deviceId
          || !live.principal || live.principal.device_id !== original.deviceId
          || !['custodial-protected-principal.v1', 'custodial-protected-principal.v2'].includes(live.principal.schema_version)
          || !isUuid(live.principal.employee_id) || !isUuid(live.principal.credential_id)
          || !Number.isSafeInteger(live.principal.assignment_epoch) || live.principal.assignment_epoch < 1
          || canonicalJson(live.principal) !== original.principal || typeof original.identity !== 'string' || !original.identity
          || principalReader.call(mobile) !== original.identity) throw queueSecurityUnavailable();
        if (context !== undefined && (context?.generation !== original.generation || context?.deviceId !== original.deviceId))
          throw queueSecurityUnavailable();
      } else if (liveSecurity?.native === true) throw queueSecurityUnavailable();
      if (context !== undefined) queueOpeningCheckpoint(context);
    };
    const options = { requireEnrollment: true, ...(original ? { expectedGeneration: original.generation } : {}) };
    requireOriginal();

    if (original && expectedGeneration !== null && expectedGeneration !== original.generation)
      throw queueSecurityUnavailable();
    if (!original && expectedGeneration !== null) options.expectedGeneration = expectedGeneration;

    // Own direct transaction terminal dispatch, not an earlier bubbled request/error.
    const readOrWrite = (db, context, write, captured, replacement) => new Promise((resolve, reject) => {
      let tx = null, failure = null, result = null;
      const refuse = (error) => {
        failure = failure || error;
        if (!tx) { reject(failure); return; }
        try { tx.abort(); } catch (abortError) {
          failure = Object.assign(new AggregateError([failure, abortError],
            'Completion draft settlement is uncertain.', { cause: failure }),
          { code: failure.code || 'custodial_storage_unavailable' });
        }
      };
      const settle = (aborted) => {
        let error = failure || (aborted ? storageFailure('completion draft', tx.error || new Error('transaction aborted')) : null);
        try { requireOriginal(context); } catch (withdrawn) { error = error || withdrawn; }
        if (error) reject(error); else resolve(result);
      };
      try {
        requireOriginal(context);
        tx = db.transaction(CONFIG.COMPLETION_DRAFT_STORE_NAME, write ? 'readwrite' : 'readonly');
        tx.oncomplete = event => { if (event.target === tx) window.setTimeout(() => settle(false), 0); };
        tx.onabort = event => { if (event.target === tx) window.setTimeout(() => settle(true), 0); };
        tx.onerror = event => {
          failure = failure || storageFailure('completion draft', event.target?.error || tx.error);
          try { requireOriginal(context); } catch (error) { failure = failure || error; }
        };
        requireOriginal(context);
        const store = tx.objectStore(CONFIG.COMPLETION_DRAFT_STORE_NAME);
        const lookup = store.get(id);
        lookup.onerror = () => refuse(storageFailure('completion draft', lookup.error || tx.error));
        lookup.onsuccess = () => {
          try {
            requireOriginal(context);
            if (failure) throw failure;
            result = lookup.result == null ? null : lookup.result;
            if (result !== null && !queueOpeningRowsMatch([result], [JSON.parse(canonicalJson(result))]))
              throw storageFailure('completion draft', new Error('unknown original draft representation'));
            if (write) {
              if (!queueOpeningRowsMatch(result === null ? [] : [result], captured === null ? [] : [captured]))
                throw storageFailure('completion draft', new Error('original draft changed before mutation'));
              requireOriginal(context);
              const request = replacement ? store.put(replacement) : result === null ? null : store.delete(id);
              if (request) request.onerror = () => refuse(storageFailure('completion draft', request.error || tx.error));
              requireOriginal(context);
            }
          } catch (error) { refuse(error); }
        };
      } catch (error) { refuse(error); }
    });
    const validateRecord = async (raw, expected) => {
      if (raw === null) return null;
      const keys = ['schema_version', 'contract_version', 'session_uuid', 'client_completion_id', 'device_id',
        'employee_id', 'location_code', 'draft', 'integrity_sha256', 'saved_at'];
      if (Object.keys(raw).sort().join('|') !== keys.sort().join('|')
        || typeof raw.integrity_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(raw.integrity_sha256)
        || typeof raw.saved_at !== 'string' || !Number.isFinite(Date.parse(raw.saved_at)))
        throw storageFailure('completion draft', new Error('unknown original draft'));
      const identity = completionDraftIdentity(raw);
      if (Object.keys(identity).some(key => raw[key] !== identity[key])
        || original && (identity.device_id !== original.deviceId || identity.employee_id !== original.employeeId))
        throw storageFailure('completion draft', new Error('foreign original draft'));
      const verified = await verifyCompletionDraftRecord(raw, expected || identity);
      requireOriginal();
      return verified;
    };

    // First observe/verify the original under its own admission. A later FIFO
    // callback must compare the exact raw row again, never delete a successor.
    const captured = await mutateProtectedQueue(async context => {
      requireOriginal(context);
      const db = await openCompletionDraftDb(context, { readonly: true });
      if (!db) { requireOriginal(context); return null; }
      try {
        requireOriginal(context);
        const raw = await readOrWrite(db, context, false);
        requireOriginal(context);
        const exact = raw === null ? null : JSON.parse(canonicalJson(raw));
        await validateRecord(raw);
        requireOriginal(context);
        return exact;
      } finally { db.close(); }
    }, options);
    requireOriginal();
    const result = await mutateProtectedQueue(async context => {
      requireOriginal(context);
      const db = await openCompletionDraftDb(context, { readonly: true });
      if (!db) {
        requireOriginal(context);
        if (captured !== null) throw storageFailure('completion draft', new Error('original draft database disappeared'));
        return true;
      }
      try {
        requireOriginal(context);
        await readOrWrite(db, context, true, captured, null);
        requireOriginal(context);
        const remaining = await readOrWrite(db, context, false);
        requireOriginal(context);
        if (remaining !== null) throw storageFailure('completion draft', new Error('draft absence is unverified'));
        return true;
      } finally { db.close(); }
    }, options);
    requireOriginal();
    return result;
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

  function sameClaimedQueueRow(current, item) {
    if (!current || current.lease_token !== item.lease_token || current.lease_owner !== state.workerId) return false;
    const identity = (row) => {
      const value = normalizeRecord(row);
      return canonicalizeSemanticValue({ type: value.type, operation_id: value.operation_id,
        logical_key: value.logical_key, logical_identity: value.logical_identity,
        semantic_fingerprint: value.semantic_fingerprint, completion_client_id: value.completion_client_id,
        replay_binding: value.replay_binding, payload: value.payload });
    };
    return JSON.stringify(identity(current)) === JSON.stringify(identity(item));
  }

  function originalCompletionSession(item, local = exactSessionForPayload(item.payload || {})) {
    if (!local) return null;
    const payload = item.payload || {}, saved = item.replay_binding || {};
    const pairs = [
      [payload.p_client_session_id || saved.client_session_id || payload.p_session_uuid, local.client_session_id || local.session_uuid],
      [item.type === 'commit_workflow' ? payload.p_client_completion_id || saved.client_completion_id : '', local.client_completion_id],
      [saved.employee_id || payload.p_snapshot_employee_id, local.offline_authority_employee_id],
      [saved.snapshot_id || payload.p_snapshot_id, local.offline_authority_snapshot_id],
      [saved.occurrence_id, local.offline_occurrence_id || local.occurrence_id || local.offline_actor_context?.occurrence_id],
      [saved.context_id, local.context_id || local.offline_actor_context_id || local.offline_actor_context?.context_id],
      [payload.p_device_id, local.device_id],
      [payload.p_location_code, local.location_code],
      [payload.p_client_started_at, local.started_at],
    ];
    const epoch = saved.assignment_epoch ?? payload.p_snapshot_assignment_epoch;
    if (Number.isSafeInteger(epoch) && epoch > 0) pairs.push([String(epoch), String(local.offline_authority_assignment_epoch)]);
    // Once present, the original completion proof/time is immutable. Missing
    // initial proof can still be filled by the existing native attestation path.
    for (const [payloadKey, localKey] of [['p_client_ended_at','ended_at'],
      ['p_native_finish_scan_entry_id','native_finish_scan_entry_id'],
      ['p_native_completion_attestation_version','native_completion_attestation_version'],
      ['p_native_completion_attestation','native_completion_attestation']]) {
      if (safeText(payload[payloadKey]) && safeText(local[localKey])) pairs.push([payload[payloadKey],local[localKey]]);
    }
    if (pairs.some(([expected, actual]) => safeText(expected) && safeText(expected) !== safeText(actual))) {
      throw processResultFailure('Saved local completion changed from the original queued identity or frozen proof.');
    }
    return local;
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

  function queueOpeningCheckpoint(context) {
    const security = queueMutationSecurity();
    if (typeof context?.assertCurrent === 'function') return context.assertCurrent();
    if (security || nativeQueueSecurityRequired) {
      throw Object.assign(new Error('The owned queue-opening checkpoint is unavailable.'), { code: 'custodial_protected_checkpoint_unavailable' });
    }
    // Retain the pre-existing standalone legacy path; this is not a protected
    // principal or native-admission claim. Protected runtime must supply owner.
  }

  function queueOpeningConnection(db) {
    db.onversionchange = () => {
      db.close();
      if (state.db === db) state.db = null;
    };
    return db;
  }

  function queueOpeningRowsMatch(left, right) {
    const same = (a, b, depth = 0) => {
      if (Object.is(a, b)) return true;
      if (depth > 64 || !a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
      const arrays = Array.isArray(a);
      if (arrays !== Array.isArray(b) || (arrays && a.length !== b.length)) return false;
      // Unknown structured-clone types remain held, not collapsed to JSON {}.
      if (!arrays && (Object.prototype.toString.call(a) !== '[object Object]' || Object.prototype.toString.call(b) !== '[object Object]')) return false;
      const keys = Object.keys(a), other = Object.keys(b);
      return keys.length === other.length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key], depth + 1));
    };
    return same([...left].sort((a, b) => a.id - b.id), [...right].sort((a, b) => a.id - b.id));
  }

  function deleteDatabase(name, context) {
    queueOpeningCheckpoint(context);
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => { try { queueOpeningCheckpoint(context); resolve(true); } catch (error) { reject(error); } };
      request.onerror = () => reject(request.error || new Error(`Could not delete ${name}.`));
      // IDB requests cannot be cancelled. Keep admission until terminal event;
      // rejecting onblocked would let this deletion complete outside its owner.
      request.onblocked = () => {};
    });
  }

  function openExistingDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      let missing = false;
      // Existence reads must not create an empty DB, including the backup.
      request.onupgradeneeded = (event) => {
        missing = event.oldVersion === 0;
        try { request.transaction.abort(); } catch (error) { missing = false; reject(error); }
      };
      request.onsuccess = () => resolve(queueOpeningConnection(request.result));
      request.onerror = () => missing ? resolve(null) : reject(request.error || new Error(`Could not open ${name}.`));
      request.onblocked = () => {};
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

  function createQueueDatabase(name, version, rows = [], context) {
    queueOpeningCheckpoint(context);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      let upgraded = false;
      let failure = null;
      request.onupgradeneeded = () => {
        try {
          queueOpeningCheckpoint(context); upgraded = true;
          const db = request.result;
          const store = db.objectStoreNames.contains(CONFIG.STORE_NAME)
            ? request.transaction.objectStore(CONFIG.STORE_NAME)
            : db.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
          if (!store.indexNames.contains('logical_key')) store.createIndex('logical_key', 'logical_key', { unique: false });
          if (!store.indexNames.contains('state')) store.createIndex('state', 'state', { unique: false });
          if (!store.indexNames.contains('next_attempt_at')) store.createIndex('next_attempt_at', 'next_attempt_at', { unique: false });
          // Schema and restored rows commit together; never expose empty v4
          // between creation and a second, separately committed restore.
          for (const row of rows) { queueOpeningCheckpoint(context); store.put(row); }
        } catch (error) { failure = error; request.transaction.abort(); }
      };
      request.onsuccess = () => {
        const db = request.result;
        try {
          queueOpeningCheckpoint(context);
          if (rows.length && !upgraded) throw storageFailure('queue restore', new Error('Existing primary must be compared before restore.'));
          resolve(queueOpeningConnection(db));
        } catch (error) { db.close(); reject(error); }
      };
      request.onerror = () => reject(failure || request.error || new Error(`Could not create ${name}.`));
      request.onblocked = () => {};
    });
  }

  async function readDowngradeBackup(context) {
    const db = await openExistingDatabase(CONFIG.ROLLBACK_BACKUP_DB_NAME);
    if (!db) { if (context) queueOpeningCheckpoint(context); return null; }
    try {
      if (context) queueOpeningCheckpoint(context);
      if (db.version !== 1 || db.objectStoreNames.length !== 2 || !db.objectStoreNames.contains('metadata') || !db.objectStoreNames.contains(CONFIG.STORE_NAME))
        throw storageFailure('queue downgrade backup', new Error('Unknown backup schema is retained.'));
      const result = await new Promise((resolve, reject) => {
        const transaction = db.transaction(['metadata', CONFIG.STORE_NAME], 'readonly');
        const metadata = transaction.objectStore('metadata').getAll();
        const rows = transaction.objectStore(CONFIG.STORE_NAME).getAll();
        transaction.oncomplete = () => resolve({ metadata: metadata.result, rows: rows.result });
        transaction.onerror = () => reject(transaction.error || new Error('Rollback backup read failed.'));
        transaction.onabort = () => reject(transaction.error || new Error('Rollback backup read was aborted.'));
      });
      if (context) queueOpeningCheckpoint(context);
      const metadata = Array.isArray(result.metadata) && result.metadata.length === 1 ? result.metadata[0] : null;
      const fields = ['key', 'source_version', 'canonical_rows', 'canonical_fenced_rows'];
      const seen = new Set();
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || Object.keys(metadata).length !== fields.length || !fields.every(key => Object.hasOwn(metadata, key))
        || metadata.key !== 'capture' || !Number.isSafeInteger(metadata.source_version) || metadata.source_version <= CONFIG.DB_VERSION || metadata.source_version > CONFIG.MAX_KNOWN_DB_VERSION
        || !Array.isArray(result.rows) || !result.rows.every(row => row && typeof row === 'object' && !Array.isArray(row)
          && Number.isSafeInteger(row.id) && row.id >= 1 && !seen.has(row.id) && seen.add(row.id))
        || typeof metadata.canonical_rows !== 'string' || canonicalRows(result.rows) !== metadata.canonical_rows
        || typeof metadata.canonical_fenced_rows !== 'string' || canonicalRows(fencedDowngradeRows(result.rows)) !== metadata.canonical_fenced_rows)
        throw storageFailure('queue downgrade backup', new Error('Unconfirmed backup originals are retained.'));
      return { ...metadata, rows: result.rows };
    } finally { db.close(); }
  }

  async function writeDowngradeBackup(rows, sourceVersion, context) {
    if (await readDowngradeBackup(context)) throw storageFailure('queue downgrade backup', new Error('An existing original backup must be reconciled first.'));
    queueOpeningCheckpoint(context);
    const expected = canonicalRows(rows);
    const expectedFenced = canonicalRows(fencedDowngradeRows(rows));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.ROLLBACK_BACKUP_DB_NAME, 1);
      let created = false;
      let failure = null;
      request.onupgradeneeded = () => {
        try {
          queueOpeningCheckpoint(context); created = true;
          const metadata = request.result.createObjectStore('metadata', { keyPath: 'key' });
          const originals = request.result.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'id', autoIncrement: true });
          metadata.put({ key: 'capture', source_version: sourceVersion, canonical_rows: expected, canonical_fenced_rows: expectedFenced });
          for (const row of rows) { queueOpeningCheckpoint(context); originals.put(row); }
        } catch (error) { failure = error; request.transaction.abort(); }
      };
      request.onsuccess = () => {
        try { queueOpeningCheckpoint(context); if (!created) throw storageFailure('queue downgrade backup', new Error('A newly appeared backup is retained.')); resolve(queueOpeningConnection(request.result)); }
        catch (error) { request.result.close(); reject(error); }
      };
      request.onerror = () => reject(failure || request.error || new Error('Rollback backup could not be created.'));
      request.onblocked = () => {};
    });
    db.close();
    const verified = await readDowngradeBackup(context);
    if (!verified || verified.source_version !== sourceVersion || verified.canonical_rows !== expected
      || verified.canonical_fenced_rows !== expectedFenced || canonicalRows(verified.rows) !== expected) {
      throw storageFailure('queue downgrade backup', new Error('backup verification failed'));
    }
    downgradeTransition('backup-verified');
    queueOpeningCheckpoint(context);
    return verified;
  }

  async function restoreRollbackCompatibleQueue(backup, context) {
    const retained = await readDowngradeBackup(context);
    if (!retained || retained.source_version !== backup.source_version || retained.canonical_rows !== backup.canonical_rows
      || retained.canonical_fenced_rows !== backup.canonical_fenced_rows || !queueOpeningRowsMatch(retained.rows, backup.rows)) throw storageFailure('queue downgrade restore', new Error('Original backup changed; retained without restore.'));
    const fencedRows = fencedDowngradeRows(backup.rows);
    const expectedFenced = backup.canonical_fenced_rows;
    const existing = await openExistingDatabase(CONFIG.DB_NAME);
    let restored = null;
    try {
      queueOpeningCheckpoint(context);
      if (existing) {
        if (existing.version > CONFIG.MAX_KNOWN_DB_VERSION || existing.objectStoreNames.length !== 1 || !existing.objectStoreNames.contains(CONFIG.STORE_NAME))
          throw storageFailure('queue downgrade restore', new Error('Unknown primary originals are retained.'));
        const rows = await readRawRows(existing); queueOpeningCheckpoint(context);
        if (existing.version === CONFIG.DB_VERSION) {
          const expected = new Map(fencedRows.map(row => [row.id, row]));
          if (!rows.every(row => expected.has(row.id) && queueOpeningRowsMatch([row], [expected.get(row.id)])))
            throw storageFailure('queue downgrade restore', new Error('Changed primary originals are retained.'));
          if (canonicalRows(rows) !== expectedFenced) {
            await new Promise((resolve, reject) => {
              queueOpeningCheckpoint(context);
              const transaction = existing.transaction(CONFIG.STORE_NAME, 'readwrite'), store = transaction.objectStore(CONFIG.STORE_NAME), current = store.getAll();
              let failure = null;
              current.onsuccess = () => { try {
                queueOpeningCheckpoint(context);
                if (!Array.isArray(current.result) || !queueOpeningRowsMatch(current.result, rows)) throw storageFailure('queue downgrade restore', new Error('Primary changed during restore.'));
                const present = new Set(rows.map(row => row.id));
                for (const row of fencedRows) if (!present.has(row.id)) { queueOpeningCheckpoint(context); store.put(row); }
              } catch (error) { failure = error; transaction.abort(); } };
              transaction.oncomplete = () => { try { if (failure) throw failure; queueOpeningCheckpoint(context); resolve(); } catch (error) { reject(error); } };
              transaction.onerror = () => { failure = failure || transaction.error || storageFailure('queue downgrade restore', new Error('Restore transaction was unconfirmed.')); };
              transaction.onabort = () => reject(failure || transaction.error || storageFailure('queue downgrade restore', new Error('Restore transaction was unconfirmed.')));
            });
          }
          restored = existing;
        } else if (existing.version !== backup.source_version || !queueOpeningRowsMatch(rows, backup.rows)) {
          throw storageFailure('queue downgrade restore', new Error('Changed primary originals are retained.'));
        } else {
          existing.close();
          await deleteDatabase(CONFIG.DB_NAME, context); downgradeTransition('primary-deleted'); queueOpeningCheckpoint(context);
        }
      }
      if (!restored) restored = await createQueueDatabase(CONFIG.DB_NAME, CONFIG.DB_VERSION, fencedRows, context);
      downgradeTransition('fenced-v4-written'); queueOpeningCheckpoint(context);
      const restoredRows = await readRawRows(restored); queueOpeningCheckpoint(context);
      if (canonicalRows(restoredRows) !== expectedFenced || !queueOpeningRowsMatch(restoredRows, fencedRows)) throw storageFailure('queue downgrade restore', new Error('fenced restore verification failed'));
      downgradeTransition('fenced-v4-verified'); queueOpeningCheckpoint(context);
      await deleteDatabase(CONFIG.ROLLBACK_BACKUP_DB_NAME, context); downgradeTransition('backup-deleted');
    } finally { existing?.close(); restored?.close(); }
  }

  async function postOpenContentMigration(db, context) {
    queueOpeningCheckpoint(context);
    const migrationAt = now();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CONFIG.STORE_NAME, 'readwrite');
      const cursor = transaction.objectStore(CONFIG.STORE_NAME).openCursor();
      let failure = null;
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        try {
        queueOpeningCheckpoint(context);
        const declaredVersion = Number(current.value?.schema_version || 0);
        const sourceVersion = declaredVersion >= 1 && declaredVersion <= 4
          ? declaredVersion
          : (declaredVersion === 0 ? Math.min(db.version, 4) : 0);
        const migrated = sourceVersion
          ? migrateLegacyRecord(current.value, sourceVersion)
          : (declaredVersion === CONFIG.SCHEMA_VERSION
            ? normalizeRecord(current.value)
            : legacyMigrationFailure(current.value, declaredVersion || db.version, 'the record uses an unsupported future schema'));
        // The prior Retry-After parser could persist Infinity in a logically
        // retryable schema-6 row. Repair only its eligibility, once; never
        // revive a hold/quarantine or reinterpret an unknown future schema.
        const savedRetryAt = Number(current.value?.next_attempt_at ?? 0);
        if (declaredVersion === CONFIG.SCHEMA_VERSION && migrated.dead_letter !== true
          && migrated.recoverable !== false && ['pending', 'retrying', 'processing'].includes(migrated.state)
          && (!Number.isSafeInteger(savedRetryAt) || savedRetryAt < 0 || savedRetryAt > 8640000000000000)
          && Number.isSafeInteger(migrationAt) && migrationAt >= 0 && migrationAt <= 8640000000000000) {
          migrated.next_attempt_at = migrationAt;
        }
        current.update(storageRecord(migrated));
        current.continue();
        } catch (error) { failure = error; transaction.abort(); }
      };
      cursor.onerror = () => { failure = cursor.error || new Error('Scan queue content migration failed.'); };
      transaction.oncomplete = event => {
        if (event.target !== transaction) return;
        // Keep the original admission through every direct terminal listener,
        // including the callback-cleanup microtask checkpoint between them.
        window.setTimeout(() => {
          try { if (failure) throw failure; queueOpeningCheckpoint(context); resolve(db); } catch (error) { reject(error); }
        }, 0);
      };
      transaction.onerror = () => { failure = failure || transaction.error || new Error('Scan queue content migration failed.'); };
      transaction.onabort = event => {
        if (event.target !== transaction) return;
        window.setTimeout(() => reject(failure || transaction.error || new Error('Scan queue content migration was aborted.')), 0);
      };
    });
  }

  async function openDb(context) {
    queueOpeningCheckpoint(context);
    const backup = await readDowngradeBackup(context);
    if (backup) await restoreRollbackCompatibleQueue(backup, context);
    let db = await openExistingDatabase(CONFIG.DB_NAME);
    try {
    queueOpeningCheckpoint(context);
    if (db && db.version > CONFIG.MAX_KNOWN_DB_VERSION) {
      const version = db.version;
      db.close();
      throw new Error(`Unknown scan queue database version ${version}; preserved without mutation.`);
    }
    if (db && db.version > CONFIG.DB_VERSION) {
      if (db.objectStoreNames.length !== 1 || !db.objectStoreNames.contains(CONFIG.STORE_NAME)) throw storageFailure('queue downgrade backup', new Error('Unknown primary schema is retained.'));
      const sourceVersion = db.version;
      const rows = await readRawRows(db);
      queueOpeningCheckpoint(context);
      db.close();
      const captured = await writeDowngradeBackup(rows, sourceVersion, context);
      await restoreRollbackCompatibleQueue(captured, context);
      db = await openExistingDatabase(CONFIG.DB_NAME);
      queueOpeningCheckpoint(context);
    } else if (!db || db.version < CONFIG.DB_VERSION || !db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
      db?.close();
      db = await createQueueDatabase(CONFIG.DB_NAME, CONFIG.DB_VERSION, [], context);
    }
    return await postOpenContentMigration(db, context);
    } catch (error) { db?.close(); throw error; }
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

  function actionReferencesSession(item, sessionId) {
    return [
      item?.client_id,
      item?.operation_id,
      item?.logical_identity,
      item?.payload?.p_client_session_id,
      item?.payload?.p_session_uuid,
      item?.replay_binding?.client_session_id,
      item?.replay_binding?.session_uuid,
    ].some((value) => safeText(value).toLowerCase() === sessionId);
  }

  function retirableInterruptedStartMismatch(item, sessionId) {
    const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {};
    const binding = item?.replay_binding && typeof item.replay_binding === 'object' ? item.replay_binding : {};
    const liveLease = safeText(item?.lease_owner) && Number(item?.lease_until || 0) > now();
    const checks = [
      ['queue_chain_type', safeText(item?.type) === 'start_session'],
      ['queue_chain_recoverable', item?.recoverable !== false],
      ['queue_chain_schema', Number(item?.schema_version) === CONFIG.SCHEMA_VERSION],
      ['queue_chain_replay_contract', safeText(item?.forward_replay_contract) === CONFIG.REQUIRED_SCAN_CONTRACT_VERSION],
      ['queue_chain_forward_type', safeText(item?.forward_action_type) === 'start_session'],
      ['queue_chain_id', Number.isSafeInteger(Number(item?.id)) && Number(item.id) > 0],
      ['queue_chain_live_lease', !liveLease],
      ['queue_chain_client_id', safeText(item?.client_id).toLowerCase() === sessionId],
      ['queue_chain_operation_id', safeText(item?.operation_id).toLowerCase() === sessionId],
      ['queue_chain_logical_identity', safeText(item?.logical_identity).toLowerCase() === sessionId],
      ['queue_chain_logical_key', safeText(item?.logical_key) === `start_session:${sessionId}`],
      ['queue_chain_payload_session', safeText(payload.p_client_session_id).toLowerCase() === sessionId],
      ['queue_chain_binding_session', safeText(binding.client_session_id).toLowerCase() === sessionId],
    ];
    return checks.find(([, matches]) => !matches)?.[0] || '';
  }

  function exactRetirableInterruptedStart(item, sessionId) {
    return retirableInterruptedStartMismatch(item, sessionId) === '';
  }

  function interruptedStartRetirementError(code, message) {
    return Object.assign(new Error(message), { code });
  }

  async function retirePreservedInterruptedStart(sessionId, preserve) {
    const exactSessionId = typeof sessionId === 'string' ? safeText(sessionId).toLowerCase() : '';
    if (!isUuid(exactSessionId) || typeof preserve !== 'function') {
      throw interruptedStartRetirementError(
        'custodial_interrupted_start_retirement_invalid',
        'Exact interrupted-start retirement evidence is required.',
      );
    }
    // Pin the invocation before worker, queue-lock, archive or native FIFO waits.
    // The first asynchronous queue read supplies the rows; their exact canonical
    // originals are then fixed before the preservation callback is invoked.
    const originalSecurity = queueMutationSecurity(), originalMobile = window.MemphisMobile;
    const originalReader = originalSecurity?.getStatus, originalWriter = originalSecurity?.mutateProtectedWork;
    const originalPrincipalReader = originalMobile?.principalIdentity;
    const status = originalSecurity?.native === true ? originalSecurity.getStatus() : null;
    const original = status ? Object.freeze({ generation: status.generation, deviceId: status.deviceId,
      principal: canonicalJson(status.principal), identity: originalMobile?.principalIdentity?.() }) : null;
    let originalDb = state.db, originalTransaction = originalDb?.transaction;
    const requireOriginal = (context) => {
      const security = queueMutationSecurity();
      if (security !== originalSecurity || security?.getStatus !== originalReader
        || security?.mutateProtectedWork !== originalWriter || window.MemphisMobile !== originalMobile
        || originalDb && (state.db !== originalDb || originalDb.transaction !== originalTransaction))
        throw queueSecurityUnavailable();
      if (original) {
        if (originalMobile?.principalIdentity !== originalPrincipalReader) throw queueSecurityUnavailable();
        const live = security.getStatus();
        if (live?.ready !== true || live.available !== true || live.quarantined !== false || live.state !== 'enrolled'
          || !Number.isSafeInteger(original.generation) || original.generation < 1 || live.generation !== original.generation
          || live.deviceId !== original.deviceId || !live.principal || live.principal.device_id !== original.deviceId
          || !['custodial-protected-principal.v1', 'custodial-protected-principal.v2'].includes(live.principal.schema_version)
          || !isUuid(live.principal.employee_id) || !isUuid(live.principal.credential_id)
          || !Number.isSafeInteger(live.principal.assignment_epoch) || live.principal.assignment_epoch < 1
          || canonicalJson(live.principal) !== original.principal || typeof original.identity !== 'string' || !original.identity
          || originalMobile.principalIdentity() !== original.identity) throw queueSecurityUnavailable();
        if (context !== undefined && (context?.generation !== original.generation || context?.deviceId !== original.deviceId))
          throw queueSecurityUnavailable();
      } else if (security?.native === true) throw queueSecurityUnavailable();
      if (context !== undefined) queueOpeningCheckpoint(context);
    };
    const originalOptions = { requireEnrollment: true, ...(original ? { expectedGeneration: original.generation } : {}) };
    requireOriginal();
    await ensureWorkerReady();
    requireOriginal();
    if (!state.db) {
      throw interruptedStartRetirementError('custodial_interrupted_start_retirement_invalid', 'The original queue is unavailable.');
    }
    if (!originalDb) { originalDb = state.db; originalTransaction = originalDb.transaction; }
    requireOriginal();
    const result = await withQueueLock(async (lockContext) => {
      requireOriginal();
      // Only the existing queue lock decides whether a prior processing lease
      // is orphaned; no replacement operation or new epoch is allocated here.
      await recoverOrphanedClaims(lockContext.recoverClaimsImmediately === true);
      requireOriginal();
      const pause = await securityPause();
      requireOriginal();
      if (pause) {
        throw interruptedStartRetirementError('custodial_interrupted_start_security_paused', 'Protected phone recovery is active.');
      }
      const initialRows = await readRawRows(originalDb);
      requireOriginal();
      const initialRawMatches = initialRows.filter((item) => actionReferencesSession(item, exactSessionId));
      const initialMatches = initialRawMatches.map(normalizeRecord);
      if (initialMatches.length > 1) {
        throw interruptedStartRetirementError('custodial_interrupted_start_queue_ambiguous',
          'More than one saved operation references the interrupted cleaning.');
      }
      if (initialMatches.length === 1) {
        const mismatch = retirableInterruptedStartMismatch(initialMatches[0], exactSessionId);
        if (mismatch) throw interruptedStartRetirementError(mismatch, 'The saved operation is not one quiescent Start Cleaning action.');
      }
      if (initialRawMatches.some((item) => Number(item.schema_version) !== CONFIG.SCHEMA_VERSION
        || !['start_session', 'forward-replay-fenced:start_session'].includes(safeText(item.type)))) {
        throw interruptedStartRetirementError('custodial_interrupted_start_queue_changed', 'Unknown saved-work representation is retained.');
      }
      const expectedRows = canonicalRows(initialMatches);
      // The canonical archive must represent the original values losslessly.
      // Unknown structured-clone values are held, not collapsed to JSON {}.
      const originalRows = JSON.parse(expectedRows);
      const originalRawRows = JSON.parse(canonicalRows(initialRawMatches));
      const requireRows = () => {
        if (canonicalRows(initialMatches) !== expectedRows || !queueOpeningRowsMatch(initialMatches, originalRows)
          || !queueOpeningRowsMatch(initialRawMatches, originalRawRows))
          throw interruptedStartRetirementError(
          'custodial_interrupted_start_queue_changed', 'The preserved original action body changed.');
      };
      requireRows();
      const preservationEvidence = Object.freeze({
        contract_version: 'custodial-interrupted-start-preservation.v1',
        session_uuid: exactSessionId,
        canonical_actions: expectedRows,
      });
      const preserved = await preserve(
        Object.freeze(initialMatches.map((item) => Object.freeze({ ...item }))),
        preservationEvidence,
      );
      requireOriginal(); requireRows();
      if (preserved?.preserved !== true || preserved?.canonical_actions !== expectedRows) {
        throw interruptedStartRetirementError('custodial_interrupted_start_archive_unverified',
          'The interrupted Start Cleaning action was not durably preserved.');
      }
      const testHook = window.__MZ_SCAN_SYNC_INTERRUPTED_START_TEST_HOOK__;
      if (typeof testHook === 'function') testHook('archive-preserved');
      requireOriginal(); requireRows();

      const retired = await mutateProtectedQueue(async (context) => {
        requireOriginal(context); requireRows();
        await new Promise((resolve, reject) => {
          let tx = null, failure = null;
          const refuse = (error) => {
            if (failure) return;
            failure = error;
            if (!tx) { reject(failure); return; }
            try { tx.abort(); }
            catch (abortError) {
              failure = Object.assign(new AggregateError([failure, abortError],
                'Interrupted-start queue settlement is uncertain.', { cause: failure }),
              { code: failure.code || 'custodial_storage_unavailable' });
            }
            // Do not release native/queue admission on request error or even
            // a failed abort: staged effects remain unknown until a direct
            // transaction onabort/oncomplete event has fully dispatched.
          };
          const settle = (aborted) => {
            let error = failure || (aborted ? tx.error || new Error('Interrupted-start queue retirement was aborted.') : null);
            try { requireOriginal(context); requireRows(); } catch (withdrawn) { error = error || withdrawn; }
            if (error) reject(error); else resolve();
          };
          try {
            requireOriginal(context);
            tx = originalDb.transaction(CONFIG.STORE_NAME, 'readwrite');
            tx.oncomplete = (event) => {
              if (event.target !== tx) return;
              window.setTimeout(() => settle(false), 0);
            };
            tx.onabort = (event) => {
              if (event.target !== tx) return;
              window.setTimeout(() => settle(true), 0);
            };
            tx.onerror = (event) => {
              failure = failure || event.target?.error || tx.error || new Error('Interrupted-start queue retirement failed.');
              try { requireOriginal(context); } catch (error) { failure = failure || error; }
            };
            const store = tx.objectStore(CONFIG.STORE_NAME);
            requireOriginal(context);
            const lookup = store.getAll();
            lookup.onerror = () => refuse(lookup.error || tx.error || new Error('Interrupted-start queue verification failed.'));
            lookup.onsuccess = () => {
              try {
                requireOriginal(context); requireRows();
                if (!Array.isArray(lookup.result)) throw interruptedStartRetirementError(
                  'custodial_interrupted_start_queue_changed', 'The original queue read is unavailable.');
                const rawMatches = lookup.result.filter((item) => actionReferencesSession(item, exactSessionId));
                if (!queueOpeningRowsMatch(rawMatches, originalRawRows))
                  throw interruptedStartRetirementError('custodial_interrupted_start_queue_changed',
                    'Unknown or mixed saved work is retained.');
                const currentMatches = rawMatches.map(normalizeRecord);
                if (currentMatches.length !== initialMatches.length
                  || currentMatches.length === 1 && !exactRetirableInterruptedStart(currentMatches[0], exactSessionId)
                  || canonicalRows(currentMatches) !== expectedRows || !queueOpeningRowsMatch(currentMatches, originalRows)) {
                  throw interruptedStartRetirementError('custodial_interrupted_start_queue_changed',
                    'The saved Start Cleaning action changed before retirement.');
                }
                if (currentMatches.length === 1) {
                  requireOriginal(context);
                  const deletion = store.delete(currentMatches[0].id);
                  deletion.onerror = () => refuse(deletion.error || tx.error || new Error('Interrupted-start queue deletion failed.'));
                  requireOriginal(context);
                }
              } catch (error) { refuse(error); }
            };
          } catch (error) { refuse(error); }
        });
        requireOriginal(context); requireRows();
        const remaining = (await readRawRows(originalDb)).filter((item) => actionReferencesSession(item, exactSessionId));
        requireOriginal(context); requireRows();
        if (remaining.length !== 0) throw interruptedStartRetirementError(
          'custodial_interrupted_start_queue_retirement_unverified',
          'The interrupted Start Cleaning action remains in the saved-work queue.');
        return Object.freeze({
          contract_version: 'custodial-interrupted-start-retirement.v1',
          session_uuid: exactSessionId,
          preserved_action_count: initialMatches.length,
          retired_action_count: initialMatches.length,
          already_absent: initialMatches.length === 0,
        });
      }, originalOptions);
      // Callback context is closed after mutateProtectedQueue settles.
      requireOriginal(); requireRows();
      return retired;
    });
    requireOriginal();
    return result;
  }

  async function enqueueUnlocked(action, expectedGeneration = null) {
    // Caller/imported actions cannot manufacture a server acknowledgement.
    const {server_completion_receipt: ignoredReceipt, ...suppliedAction} = action;
    void ignoredReceipt;
    const record = normalizeRecord({ ...suppliedAction, replay_binding: replayBindingFor(suppliedAction) });
    return mutateProtectedQueue((context) => new Promise((resolve, reject) => {
        let tx = null;
        let result = null;
        let conflict = null;
        let failure = null;
        const refuse = error => {
          if (failure) return;
          failure = error;
          if (!tx) { reject(failure); return; }
          try { tx.abort(); }
          catch (abortError) {
            failure = Object.assign(new AggregateError([failure, abortError],
              'Queue transaction settlement is uncertain.'), { code: 'custodial_storage_unavailable' });
          }
          // Keep this admission until onabort/oncomplete. A failed abort can
          // still commit staged rows; rejection is never a rollback claim.
        };
        try {
        queueOpeningCheckpoint(context);
        tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
        tx.oncomplete = event => {
          if (event.target !== tx) return;
          // Settle outside terminal-event dispatch so the original owner
          // spans every listener of this direct transaction event.
          window.setTimeout(() => {
          try {
            if (failure) throw failure;
            queueOpeningCheckpoint(context);
            if (conflict) {
              dispatchStatus({ status: 'quarantined', logical_key: record.logical_key, reason: conflict.code });
              reject(conflict);
              return;
            }
            state.channel?.postMessage({ type: 'queued', logical_key: record.logical_key });
            dispatchStatus({ status: 'queued', logical_key: record.logical_key });
            resolve(result);
            if (navigator.onLine) scheduleSync();
          } catch (error) { reject(error); }
          }, 0);
        };
        tx.onerror = event => { failure = failure || event.target.error || tx.error || new Error('Queue transaction failed.'); };
        tx.onabort = event => {
          if (event.target !== tx) return;
          window.setTimeout(() => {
            const abortError = tx.error;
            if (failure && abortError && failure !== abortError) {
              reject(Object.assign(new AggregateError([failure, abortError],
                'Queue transaction aborted after refusal.', { cause: failure }), {
                code: failure.code || 'custodial_storage_unavailable',
              }));
            } else reject(failure || abortError || new Error('Queue transaction aborted.'));
          }, 0);
        };
        const store = tx.objectStore(CONFIG.STORE_NAME);
        queueOpeningCheckpoint(context);
        const lookup = store.getAll();
        lookup.onsuccess = () => {
          try {
          queueOpeningCheckpoint(context);
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
                queueOpeningCheckpoint(context);
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
              for (const prior of related) {
                queueOpeningCheckpoint(context);
                store.put(storageRecord({
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
              }
              queueOpeningCheckpoint(context);
              const add = store.add(storageRecord({
                ...record,
                dead_letter: true,
                state: 'quarantined',
                last_error: reason,
                last_attempt_at: now(),
                next_attempt_at: Number.MAX_SAFE_INTEGER,
              }));
              add.onsuccess = () => { try { queueOpeningCheckpoint(context); result = add.result; } catch (error) { refuse(error); } };
              conflict = Object.assign(new Error('Changed completion evidence conflicts with an attempted operation; both versions were preserved.'), {
                code: 'semantic_completion_conflict', completion_client_id: record.completion_client_id,
              });
              return;
            }
          }
          queueOpeningCheckpoint(context);
          const add = store.add(storageRecord(record));
          add.onsuccess = () => { try { queueOpeningCheckpoint(context); result = add.result; } catch (error) { refuse(error); } };
          } catch (error) { refuse(error); }
        };
        lookup.onerror = () => refuse(lookup.error || tx.error || new Error('Queue lookup failed.'));
        } catch (error) { refuse(error); }
      }), { requireEnrollment: true, ...(expectedGeneration == null ? {} : { expectedGeneration }) });
  }

  function claimNextAction() {
    if (!state.db) return Promise.resolve(null);
    const security = queueMutationSecurity();
    const expectedGeneration = security?.getStatus?.()?.generation ?? null;
    if (security && (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0)) {
      return Promise.reject(queueSecurityUnavailable());
    }
    return mutateProtectedQueue((context) => new Promise((resolve, reject) => {
      let claimed = null;
      let tx = null, failure = null;
      const refuse = error => {
        if (failure) return;
        failure = error;
        if (!tx) { reject(failure); return; }
        try { tx.abort(); }
        catch (abortError) {
          failure = Object.assign(new AggregateError([failure, abortError],
            'Queue transaction settlement is uncertain.'), { code: 'custodial_storage_unavailable' });
        }
        // Only a direct terminal event settles ownership, even if abort throws.
      };
      try {
        queueOpeningCheckpoint(context);
        tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
        tx.onerror = event => { failure = failure || event.target.error || tx.error || new Error('Queue claim failed.'); };
        tx.onabort = event => {
          if (event.target !== tx) return;
          window.setTimeout(() => {
            const abortError = tx.error;
            if (failure && abortError && failure !== abortError) {
              reject(Object.assign(new AggregateError([failure, abortError],
                'Queue claim aborted after refusal.', { cause: failure }), {
                code: failure.code || 'custodial_storage_unavailable',
              }));
            } else reject(failure || abortError || new Error('Queue claim aborted.'));
          }, 0);
        };
        tx.oncomplete = event => {
          if (event.target !== tx) return;
          window.setTimeout(() => {
            try {
              if (failure) throw failure;
              queueOpeningCheckpoint(context);
              resolve(claimed);
            } catch (error) { reject(error); }
          }, 0);
        };
        const store = tx.objectStore(CONFIG.STORE_NAME);
        queueOpeningCheckpoint(context);
        const request = store.getAll();
        request.onerror = () => refuse(request.error || tx.error || new Error('Queue claim lookup failed.'));
        request.onsuccess = () => {
          try {
            queueOpeningCheckpoint(context);
            const item = nextClaimableAction(request.result || []);
            if (!item) return;
            queueOpeningCheckpoint(context);
            claimed = {
              ...item,
              state: 'processing',
              lease_owner: state.workerId,
              lease_token: crypto.randomUUID(),
              lease_until: now() + CONFIG.LEASE_MS,
            };
            const stored = storageRecord(claimed);
            queueOpeningCheckpoint(context);
            store.put(stored);
            claimed = {
              ...claimed,
              claimed_from: {
                state: item.state,
                lease_owner: item.lease_owner,
                lease_token: item.lease_token,
                lease_until: item.lease_until,
              },
              security_generation: context?.generation ?? null,
            };
          } catch (error) { refuse(error); }
        };
      } catch (error) { refuse(error); }
    }), { requireEnrollment: true, expectedGeneration });
  }

  function releaseClaimWithoutAttempt(item) {
    if (!state.db || !item?.id) return Promise.resolve(false);
    // Freeze the original claim's bounds before FIFO/IDB callbacks can run.
    const original = {
      id: item.id, lease_token: item.lease_token, generation: item.security_generation ?? null,
      previous: {
        state: item.claimed_from?.state || 'pending',
        lease_owner: item.claimed_from?.lease_owner || null,
        lease_token: item.claimed_from?.lease_token || null,
        lease_until: Number(item.claimed_from?.lease_until || 0),
      },
    };
    const security = queueMutationSecurity();
    if (security && (!Number.isSafeInteger(original.generation) || original.generation < 0)) {
      return Promise.reject(queueSecurityUnavailable());
    }
    return mutateProtectedQueue((context) => new Promise((resolve, reject) => {
      let changed = false;
      let tx = null, failure = null;
      const refuse = error => {
        if (failure) return;
        failure = error;
        if (!tx) { reject(failure); return; }
        try { tx.abort(); }
        catch (abortError) {
          failure = Object.assign(new AggregateError([failure, abortError],
            'Queue transaction settlement is uncertain.'), { code: 'custodial_storage_unavailable' });
        }
        // Only a direct terminal event settles ownership, even if abort throws.
      };
      try {
        queueOpeningCheckpoint(context);
        tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
        tx.onerror = event => { failure = failure || event.target.error || tx.error || new Error('Queue claim release failed.'); };
        tx.onabort = event => {
          if (event.target !== tx) return;
          window.setTimeout(() => {
            const abortError = tx.error;
            if (failure && abortError && failure !== abortError) {
              reject(Object.assign(new AggregateError([failure, abortError],
                'Queue claim release aborted after refusal.', { cause: failure }), {
                code: failure.code || 'custodial_storage_unavailable',
              }));
            } else reject(failure || abortError || new Error('Queue claim release aborted.'));
          }, 0);
        };
        tx.oncomplete = event => {
          if (event.target !== tx) return;
          window.setTimeout(() => {
            try {
              if (failure) throw failure;
              queueOpeningCheckpoint(context);
              resolve(changed);
            } catch (error) { reject(error); }
          }, 0);
        };
        const store = tx.objectStore(CONFIG.STORE_NAME);
        queueOpeningCheckpoint(context);
        const request = store.get(original.id);
        request.onerror = () => refuse(request.error || tx.error || new Error('Queue claim release lookup failed.'));
        request.onsuccess = () => {
          try {
            queueOpeningCheckpoint(context);
            const current = request.result;
            if (!current || current.lease_token !== original.lease_token || current.lease_owner !== state.workerId) return;
            const stored = storageRecord({
              ...current,
              state: original.previous.state,
              lease_owner: original.previous.lease_owner,
              lease_token: original.previous.lease_token,
              lease_until: original.previous.lease_until,
            });
            queueOpeningCheckpoint(context);
            store.put(stored);
            changed = true;
          } catch (error) { refuse(error); }
        };
      } catch (error) { refuse(error); }
    }), { requireEnrollment: true, expectedGeneration: original.generation });
  }

  function recoverOrphanedClaims(recoverImmediately = false) {
    if (!state.db) return Promise.resolve(0);
    const security = queueMutationSecurity();
    const expectedGeneration = security?.getStatus?.()?.generation ?? null;
    if (security && (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0)) {
      return Promise.reject(queueSecurityUnavailable());
    }
    return mutateProtectedQueue((context) => new Promise((resolve, reject) => {
      let recovered = 0;
      let tx = null, failure = null;
      const refuse = error => {
        if (failure) return;
        failure = error;
        if (!tx) { reject(failure); return; }
        try { tx.abort(); }
        catch (abortError) {
          failure = Object.assign(new AggregateError([failure, abortError],
            'Queue transaction settlement is uncertain.'), { code: 'custodial_storage_unavailable' });
        }
        // Only a direct terminal event settles ownership, even if abort throws.
      };
      try {
        queueOpeningCheckpoint(context);
        tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
        tx.onerror = event => { failure = failure || event.target.error || tx.error || new Error('Queue orphan recovery failed.'); };
        tx.onabort = event => {
          if (event.target !== tx) return;
          window.setTimeout(() => {
            const abortError = tx.error;
            if (failure && abortError && failure !== abortError) {
              reject(Object.assign(new AggregateError([failure, abortError],
                'Queue orphan recovery aborted after refusal.', { cause: failure }), {
                code: failure.code || 'custodial_storage_unavailable',
              }));
            } else reject(failure || abortError || new Error('Queue orphan recovery aborted.'));
          }, 0);
        };
        tx.oncomplete = event => {
          if (event.target !== tx) return;
          window.setTimeout(() => {
            try {
              if (failure) throw failure;
              queueOpeningCheckpoint(context);
              resolve(recovered);
            } catch (error) { reject(error); }
          }, 0);
        };
        const store = tx.objectStore(CONFIG.STORE_NAME);
        queueOpeningCheckpoint(context);
        const request = store.getAll();
        request.onerror = () => refuse(request.error || tx.error || new Error('Queue orphan recovery lookup failed.'));
        request.onsuccess = () => {
          try {
            queueOpeningCheckpoint(context);
            for (const raw of request.result || []) {
              queueOpeningCheckpoint(context);
              const item = normalizeRecord(raw);
              if (item.state !== 'processing' || !item.lease_owner
                || (!recoverImmediately && Number(item.lease_until || 0) > now())) continue;
              const stored = storageRecord({
                ...item,
                state: Number(item.retry_count || 0) > 0 ? 'retrying' : 'pending',
                lease_owner: null,
                lease_token: null,
                lease_until: 0,
              });
              queueOpeningCheckpoint(context);
              store.put(stored);
              recovered += 1;
            }
          } catch (error) { refuse(error); }
        };
      } catch (error) { refuse(error); }
    }), { requireEnrollment: true, expectedGeneration });
  }

  function persistClaimPayload(item, payload) {
    if (!state.db || !item?.id || !payload || typeof payload !== 'object') return Promise.resolve(false);
    const original = structuredClone(item);
    const originalBytes = canonicalJson(original);
    const security = queueMutationSecurity();
    if (security && (!Number.isSafeInteger(original.security_generation) || original.security_generation < 0)) {
      return Promise.reject(queueSecurityUnavailable());
    }
    const requireOriginal = context => {
      queueOpeningCheckpoint(context);
      if (canonicalJson(item) !== originalBytes) {
        throw storageFailure('completion ownership', new Error('original queue claim changed'));
      }
    };
    const capturedPayload = structuredClone(payload);
    return mutateProtectedQueue(context => new Promise((resolve, reject) => {
      let changed = false;
      let tx = null, failure = null;
      const refuse = error => {
        if (failure) return;
        failure = error;
        if (!tx) { reject(failure); return; }
        try { tx.abort(); }
        catch (abortError) {
          failure = Object.assign(new AggregateError([failure, abortError],
            'Queue proof persistence abort was unconfirmed.', { cause: failure }), {
            code: failure.code || 'custodial_storage_unavailable',
          });
        }
        // Wait for direct abort/complete even if abort is unconfirmed.
      };
      try {
        requireOriginal(context);
        tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
        tx.onerror = event => { failure = failure || event.target.error || tx.error || new Error('Queue proof persistence failed.'); };
        tx.onabort = event => {
          if (event.target !== tx) return;
          window.setTimeout(() => {
            const abortError = tx.error;
            if (failure && abortError && failure !== abortError) {
              reject(Object.assign(new AggregateError([failure, abortError],
                'Queue proof persistence aborted after refusal.', { cause: failure }), {
                code: failure.code || 'custodial_storage_unavailable',
              }));
            } else reject(failure || abortError || new Error('Queue proof persistence aborted.'));
          }, 0);
        };
        tx.oncomplete = event => {
          if (event.target !== tx) return;
          // The admission spans the complete direct terminal-event dispatch.
          window.setTimeout(() => {
            try {
              if (failure) throw failure;
              requireOriginal(context);
              if (changed) item.payload = structuredClone(capturedPayload);
              resolve(changed);
            } catch (error) { reject(error); }
          }, 0);
        };
        const store = tx.objectStore(CONFIG.STORE_NAME);
        requireOriginal(context);
        const request = store.get(original.id);
        request.onerror = () => refuse(request.error || tx.error || new Error('Queue proof persistence lookup failed.'));
        request.onsuccess = () => {
          try {
            requireOriginal(context);

            const current = request.result;
            if (!sameClaimedQueueRow(current, original)) return;
            const stored = storageRecord({ ...current, payload: structuredClone(capturedPayload) });
            requireOriginal(context);
            store.put(stored);
            changed = true;
          } catch (error) { refuse(error); }
        };
      } catch (error) { refuse(error); }
    }), { requireEnrollment: true, expectedGeneration: original.security_generation ?? null });
  }

  function requireClaimOwnership(item) {
    const original = structuredClone(item);
    const originalBytes = canonicalJson(original);
    const security = queueMutationSecurity();
    if (security && (!Number.isSafeInteger(original.security_generation) || original.security_generation < 0)) {
      return Promise.reject(queueSecurityUnavailable());
    }
    const requireOriginal = context => {
      queueOpeningCheckpoint(context);
      if (canonicalJson(item) !== originalBytes) {
        throw storageFailure('completion ownership', new Error('original queue claim changed'));
      }
    };
    return mutateProtectedQueue(context => new Promise((resolve, reject) => {
      let matches = false;
      let tx = null, failure = null;
      const refuse = error => {
        if (failure) return;
        failure = error;
        if (!tx) { reject(failure); return; }
        try { tx.abort(); }
        catch (abortError) {
          failure = Object.assign(new AggregateError([failure, abortError],
            'Completion ownership read abort was unconfirmed.', { cause: failure }), {
            code: failure.code || 'custodial_storage_unavailable',
          });
        }
        // Wait for direct abort/complete even if abort is unconfirmed.
      };
      try {
        requireOriginal(context);
        tx = state.db.transaction(CONFIG.STORE_NAME, 'readonly');
        tx.onerror = event => { failure = failure || event.target.error || tx.error || new Error('Completion ownership read failed.'); };
        tx.onabort = event => {
          if (event.target !== tx) return;
          window.setTimeout(() => {
            const abortError = tx.error;
            if (failure && abortError && failure !== abortError) {
              reject(Object.assign(new AggregateError([failure, abortError],
                'Completion ownership read aborted after refusal.', { cause: failure }), {
                code: failure.code || 'custodial_storage_unavailable',
              }));
            } else reject(failure || abortError || new Error('Completion ownership read aborted.'));
          }, 0);
        };
        tx.oncomplete = event => {
          if (event.target !== tx) return;
          // The admission spans the complete direct terminal-event dispatch.
          window.setTimeout(() => {
            try {
              if (failure) throw failure;
              requireOriginal(context);
              if (!matches) throw storageFailure('completion cleanup', new Error('original queue ownership changed'));
              resolve();
            } catch (error) { reject(error); }
          }, 0);
        };
        const store = tx.objectStore(CONFIG.STORE_NAME);
        requireOriginal(context);
        const request = store.get(original.id);
        request.onerror = () => refuse(request.error || tx.error || new Error('Completion ownership read lookup failed.'));
        request.onsuccess = () => {
          try {
            requireOriginal(context);

            matches = sameClaimedQueueRow(request.result, original);
          } catch (error) { refuse(error); }
        };
      } catch (error) { refuse(error); }
    }), { requireEnrollment: true, expectedGeneration: original.security_generation ?? null });
  }

  function finishClaim(item, options = {}) {
    if (!state.db || item == null) return Promise.resolve(false);
    try {
      const security = queueMutationSecurity(), mobile = window.MemphisMobile;
      const reader = security?.getStatus, writer = security?.mutateProtectedWork, stable = security?.waitForStableState;
      const principalReader = mobile?.principalIdentity;
      const status = security?.native === true ? reader.call(security) : null;
      const owner = status ? Object.freeze({ generation: status.generation, deviceId: status.deviceId,
        principal: canonicalJson(status.principal), identity: principalReader?.call(mobile) }) : null;
      const db = state.db, transaction = db.transaction, storeName = CONFIG.STORE_NAME, worker = state.workerId;
      const invalid = () => storageFailure('completion ownership', new Error('Original queue claim or settlement input changed.'));
      // Only detached plain data may cross the FIFO. Descriptors reject raw
      // getters; structuredClone additionally refuses proxy/internal brands.
      const plain = (value, seen = new Set(), depth = 0) => {
        if (value === null || ['undefined', 'string', 'boolean', 'number'].includes(typeof value)) return;
        if (!value || typeof value !== 'object' || depth > 64 || seen.has(value)) throw invalid();
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        if (prototype !== null) {
          const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
          if (!constructor || !Object.hasOwn(constructor, 'value') || typeof constructor.value !== 'function'
            || constructor.value.name !== (array ? 'Array' : 'Object')
            || (!array && Object.getPrototypeOf(prototype) !== null)) throw invalid();
        }
        seen.add(value);
        for (const key of Reflect.ownKeys(value)) {
          if (array && key === 'length') continue;
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (typeof key !== 'string' || !descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw invalid();
          plain(descriptor.value, seen, depth + 1);
        }
        seen.delete(value);
      };
      plain(item); plain(options);
      const original = structuredClone(item), originalOptions = structuredClone(options);
      plain(original); plain(originalOptions);
      if (!original || typeof original !== 'object' || Array.isArray(original)
        || !originalOptions || typeof originalOptions !== 'object' || Array.isArray(originalOptions)) throw invalid();
      if (!original.id) return Promise.resolve(false);
      const { succeeded, result = null, error = null, permanent = false, automaticRetry = false, retryAfterMs = 0 } = originalOptions;
      if (typeof succeeded !== 'boolean' || typeof permanent !== 'boolean' || typeof automaticRetry !== 'boolean'
        || typeof retryAfterMs !== 'number' || error !== null && typeof error !== 'string'
        || result !== null && (typeof result !== 'object' || Array.isArray(result))) throw invalid();
      const freeze = value => {
        if (value && typeof value === 'object') { for (const key of Object.keys(value)) freeze(value[key]); Object.freeze(value); }
      };
      freeze(original); freeze(originalOptions);
      const requireOriginal = context => {
        const liveSecurity = queueMutationSecurity();
        if (liveSecurity !== security || security?.getStatus !== reader || security?.mutateProtectedWork !== writer
          || security?.waitForStableState !== stable || window.MemphisMobile !== mobile || mobile?.principalIdentity !== principalReader
          || state.db !== db || db.transaction !== transaction || CONFIG.STORE_NAME !== storeName || state.workerId !== worker)
          throw queueSecurityUnavailable();
        if (owner) {
          const live = reader.call(security);
          if (live?.ready !== true || live.available !== true || live.quarantined !== false || live.state !== 'enrolled'
            || !Number.isSafeInteger(owner.generation) || owner.generation < 1 || live.generation !== owner.generation
            || live.deviceId !== owner.deviceId || !live.principal || live.principal.device_id !== owner.deviceId
            || !['custodial-protected-principal.v1', 'custodial-protected-principal.v2'].includes(live.principal.schema_version)
            || !isUuid(live.principal.employee_id) || !isUuid(live.principal.credential_id)
            || !Number.isSafeInteger(live.principal.assignment_epoch) || live.principal.assignment_epoch < 1
            || canonicalJson(live.principal) !== owner.principal || typeof owner.identity !== 'string' || !owner.identity
            || typeof principalReader !== 'function' || principalReader.call(mobile) !== owner.identity
            || original.security_generation !== owner.generation) throw queueSecurityUnavailable();
          if (context !== undefined && (context?.generation !== owner.generation || context?.deviceId !== owner.deviceId))
            throw queueSecurityUnavailable();
        } else if (liveSecurity?.native === true) throw queueSecurityUnavailable();
        plain(item); plain(options);
        if (!queueOpeningRowsMatch([item], [original])
          || !queueOpeningRowsMatch([{ id: 1, value: options }], [{ id: 1, value: originalOptions }])) throw invalid();
        if (context !== undefined) queueOpeningCheckpoint(context);
      };
      requireOriginal();
      return mutateProtectedQueue(context => new Promise((resolve, reject) => {
        let tx = null, changed = false, failure = null, abortAttempted = false;
        const refuse = cause => {
          failure = failure || cause; changed = false;
          if (!tx) { reject(failure); return; }
          if (abortAttempted) return;
          abortAttempted = true;
          try { tx.abort(); } catch (abortError) {
            failure = Object.assign(new AggregateError([failure, abortError], 'Queue completion abort was unconfirmed.', { cause: failure }),
              { code: failure.code || 'custodial_storage_unavailable' });
          }
          // A failed abort can still commit. Never release before a direct
          // terminal dispatch or claim rollback/compensate/resend afterward.
        };
        const settle = (event, aborted) => {
          if (event.target !== tx) return;
          window.setTimeout(() => {
            let cause = failure || (aborted ? tx.error || new Error('Queue completion transaction aborted.') : null);
            try { requireOriginal(context); } catch (withdrawn) { cause = cause || withdrawn; }
            if (cause) reject(cause); else resolve(changed);
          }, 0);
        };
        try {
          requireOriginal(context);
          tx = transaction.call(db, storeName, 'readwrite');
          tx.oncomplete = event => settle(event, false);
          tx.onabort = event => settle(event, true);
          tx.onerror = event => {
            failure = failure || event?.target?.error || tx.error || new Error('Queue completion transaction failed.');
            try { requireOriginal(context); } catch (withdrawn) { failure = failure || withdrawn; }
          };
          requireOriginal(context);
          const store = tx.objectStore(storeName);
          const request = store.get(original.id);
          request.onsuccess = () => {
            try {
              requireOriginal(context);
              const current = request.result;
              if (!sameClaimedQueueRow(current, original)) return;
              changed = true;
              if (succeeded) {
                if (isTerminalReconciliation(original, result)) {
                  const stored = storageRecord({ ...current, type: original.type, dead_letter: true, state: 'quarantined',
                    terminal_result: result, last_error: safeText(result?.reason || result?.status || 'Manager recovery is required.').slice(0, 1000),
                    last_attempt_at: now(), next_attempt_at: Number.MAX_SAFE_INTEGER,
                    lease_owner: null, lease_token: null, lease_until: 0 });
                  requireOriginal(context); store.put(stored); requireOriginal(context); return;
                }
                requireOriginal(context);
                applyProcessResult(original, result);
                requireOriginal(context);
                store.delete(original.id);
                requireOriginal(context); return;
              }
              const retryCount = Math.min(Number.MAX_SAFE_INTEGER, Number(current.retry_count || 0) + 1);
              // Outage retry/backoff and old held evidence keep their existing meanings.
              const deadLetter = permanent || (!automaticRetry && retryCount >= CONFIG.MAX_RETRIES), attemptedAt = now();
              const stored = storageRecord({ ...current, type: original.type, retry_count: retryCount,
                last_error: safeText(error || 'Sync failed').slice(0, 1000), last_attempt_at: attemptedAt,
                next_attempt_at: deadLetter ? Number.MAX_SAFE_INTEGER
                  : attemptedAt + Math.max(boundedRetryAfterMs(retryAfterMs, attemptedAt), retryDelay(retryCount)),
                dead_letter: deadLetter, state: deadLetter ? 'dead-letter' : 'retrying',
                lease_owner: null, lease_token: null, lease_until: 0 });
              requireOriginal(context); store.put(stored); requireOriginal(context);
            } catch (callbackError) { refuse(callbackError); }
          };
          request.onerror = () => refuse(request.error || tx.error || new Error('Queue completion lookup failed.'));
        } catch (admissionError) { refuse(admissionError); }
      }), { requireEnrollment: true, expectedGeneration: original.security_generation ?? null }).then(changed => {
        // Admission is closed: compare observations/input only, never call its context here.
        requireOriginal(); return changed;
      });
    } catch (captureError) { return Promise.reject(captureError); }
  }

  function retryDelay(retryCount) {
    return Math.min(15 * 60 * 1000, Math.max(5000, 5000 * (2 ** Math.min(Number(retryCount || 0), 8)))) + Math.floor(Math.random() * 3000);
  }
  function isAutomaticOutageRetry(error) {
    // Never reinterpret a typed identity, vault or reconciliation failure as an outage.
    if (error?.code) return error.code === 'custodial_native_network_unavailable';
    const status = Number(error?.httpStatus || 0);
    return status === 408 || status === 429 || (status >= 500 && status < 600)
      || error?.scanTransportFailure === true;
  }
  function boundedRetryAfterMs(value, at = now()) {
    // Reject unrepresentable intervals, including addition overflow, rather
    // than persisting Infinity/NaN or the dead-letter sentinel as eligibility.
    return Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000 - at ? value : 0;
  }
  function parseRetryAfter(value) {
    const raw = safeText(value);
    if (!raw) return 0;
    const parsedAt = now();
    if (!Number.isSafeInteger(parsedAt) || parsedAt < 0 || parsedAt > 8640000000000000) return 0;
    if (/^\d+$/.test(raw)) return boundedRetryAfterMs(Number(raw) * 1000, parsedAt);
    // RFC9110 5.6.7 / RFC5322 3.3: explicit UTC components avoid Date.parse's
    // implementation-dependent rollover, ignored weekdays and century rule.
    const imf = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;
    const rfc850 = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/;
    const asctime = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( \d|\d{2}) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/;
    let match = imf.exec(raw), obsolete = false;
    if (!match) { match = rfc850.exec(raw); obsolete = Boolean(match); }
    if (!match) {
      const legacy = asctime.exec(raw);
      if (!legacy) return 0;
      match = [legacy[0], legacy[1], legacy[3], legacy[2], legacy[7], legacy[4], legacy[5], legacy[6]];
    }
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(match[1].slice(0, 3));
    const day = Number(match[2]);
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(match[3]);
    let year = Number(match[4]);
    const hour = Number(match[5]), minute = Number(match[6]), second = Number(match[7]);
    if (hour > 23 || minute > 59 || second > 60 || day < 1 || day > 31) return 0;
    const baseSecond = Math.min(second, 59);
    const leapMs = second === 60 ? 1000 : 0;
    if (obsolete) {
      const limit = new Date(parsedAt);
      limit.setUTCFullYear(limit.getUTCFullYear() + 50);
      year += Math.floor(limit.getUTCFullYear() / 100) * 100;
      if (Date.UTC(year, month, day, hour, minute, baseSecond) + leapMs > limit.getTime()) year -= 100;
    }
    if (year < 1900 || year > 9999) return 0;
    const date = new Date(Date.UTC(year, month, day, hour, minute, baseSecond));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day
      || date.getUTCDay() !== weekday) return 0;
    // POSIX Date has no leap-second representation; the following UTC second
    // is the conservative not-before instant, never the start of that minute.
    return boundedRetryAfterMs(Math.max(0, date.getTime() + leapMs - parsedAt), parsedAt);
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

  async function withQueueLock(operation, { ifAvailable = false } = {}) {
    if (typeof navigator.locks?.request === 'function') {
      const options = { mode: 'exclusive' };
      if (ifAvailable) options.ifAvailable = true;
      return navigator.locks.request(CONFIG.WEB_LOCK_NAME, options, (lock) => lock ? operation({ recoverClaimsImmediately: true }) : false);
    }
    // The shipping protected-work owner already requires the shared browser
    // lock. A localStorage TTL record cannot replace that owner: the legacy
    // fallback wrote/refreshed/deleted captured originals before the ensuing
    // mutation was refused. Preserve any old lease bytes and queued work;
    // report unavailable admission instead of creating a token, a timer, a
    // misleading busy wait or a raw write/delete through a preservation hold.
    throw Object.assign(queueSecurityUnavailable(), { reason: 'browser_shared_lock_unavailable' });
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
    }).catch((error) => {
      // Only a rejection at fetch's transport boundary receives this marker, not
      // an arbitrary TypeError in proof validation, response parsing or storage.
      if (error?.name === 'TypeError' && !error?.code) {
        const outage = new Error('The connection is unavailable. Saved work will retry automatically.', { cause: error });
        outage.scanTransportFailure = true;
        throw outage;
      }
      throw error;
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

  async function persistServerCompletionReceipt(item, result) {
    const original = structuredClone(item);
    const originalBytes = canonicalJson(original);
    const security = queueMutationSecurity();
    if (security && (!Number.isSafeInteger(original.security_generation) || original.security_generation < 0)) {
      return Promise.reject(queueSecurityUnavailable());
    }
    const requireOriginal = context => {
      queueOpeningCheckpoint(context);
      if (canonicalJson(item) !== originalBytes) {
        throw storageFailure('completion ownership', new Error('original queue claim changed'));
      }
    };
    const receipt = {
      schema_version: 'server-completion-receipt.v1', operation_id: original.operation_id,
      logical_key: original.logical_key, semantic_fingerprint: original.semantic_fingerprint,
      result: structuredClone(result),
    };
    const encoded = canonicalJson(receipt);
    if (encoded.length > 65536) throw storageFailure('server acknowledgement', new Error('acknowledgement exceeds the safe bound'));
    await mutateProtectedQueue(async context => {
      requireOriginal(context);
      // Hash exactly the captured result under the SAME original admission.
      receipt.integrity_sha256 = await sha256(encoded);
      requireOriginal(context);
      return new Promise((resolve, reject) => {
      let written = false;
      let tx = null, failure = null;
      const refuse = error => {
        if (failure) return;
        failure = error;
        if (!tx) { reject(failure); return; }
        try { tx.abort(); }
        catch (abortError) {
          failure = Object.assign(new AggregateError([failure, abortError],
            'Server acknowledgement abort was unconfirmed.', { cause: failure }), {
            code: failure.code || 'custodial_storage_unavailable',
          });
        }
        // Wait for direct abort/complete even if abort is unconfirmed.
      };
      try {
        requireOriginal(context);
        tx = state.db.transaction(CONFIG.STORE_NAME, 'readwrite');
        tx.onerror = event => { failure = failure || event.target.error || tx.error || new Error('Server acknowledgement failed.'); };
        tx.onabort = event => {
          if (event.target !== tx) return;
          window.setTimeout(() => {
            const abortError = tx.error;
            if (failure && abortError && failure !== abortError) {
              reject(Object.assign(new AggregateError([failure, abortError],
                'Server acknowledgement aborted after refusal.', { cause: failure }), {
                code: failure.code || 'custodial_storage_unavailable',
              }));
            } else reject(failure || abortError || new Error('Server acknowledgement aborted.'));
          }, 0);
        };
        tx.oncomplete = event => {
          if (event.target !== tx) return;
          // The admission spans the complete direct terminal-event dispatch.
          window.setTimeout(() => {
            try {
              if (failure) throw failure;
              requireOriginal(context);
              if (!written) throw storageFailure('server acknowledgement', new Error('queue lease changed'));
              item.server_completion_receipt = structuredClone(receipt);
              resolve();
            } catch (error) { reject(error); }
          }, 0);
        };
        const store = tx.objectStore(CONFIG.STORE_NAME);
        requireOriginal(context);
        const request = store.get(original.id);
        request.onerror = () => refuse(request.error || tx.error || new Error('Server acknowledgement lookup failed.'));
        request.onsuccess = () => {
          try {
            requireOriginal(context);

            const current = request.result;
            if (!sameClaimedQueueRow(current, original)) return;
            const stored = storageRecord({ ...current, server_completion_receipt: structuredClone(receipt) });
            requireOriginal(context);
            store.put(stored);
            written = true;
          } catch (error) { refuse(error); }
        };
      } catch (error) { refuse(error); }
      });
    }, { requireEnrollment: true, expectedGeneration: original.security_generation ?? null });
  }
  async function verifiedServerCompletionReceipt(item){
    if(item.type!=='commit_workflow') return null;
    // Browser receipt hashes prove consistency only. Never use them as server authority.
    const recover=window.MemphisMobile?.getAuthenticatedCompletion;
    if(typeof recover!=='function') return null;
    const value=await recover({deviceId:safeText(item.payload?.p_device_id),completionPayload:item.payload,
      expectedGeneration:item.security_generation??null});
    if(value?.found!==true) return null;
    validateProcessResult(item,value.result);
    if(value.result?.status!=='closed') throw processResultFailure('Native receipt does not identify accepted completion.');
    return value.result;
  }

  async function processAction(item) {
    const payload = item?.payload && typeof item.payload === 'object' ? { ...item.payload } : {};
    if (item.type === 'commit_workflow') originalCompletionSession(item);
    let result = await verifiedServerCompletionReceipt(item);
    if (!result) switch (safeText(item?.type)) {
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
        const createAttestation = window.MemphisMobile?.createOfflineStartAttestation;
        if (typeof createAttestation === 'function') {
          const originalVersion = safeText(payload.p_native_start_attestation_version);
          const originalSignature = safeText(payload.p_native_start_attestation);
          const transported = await createAttestation({
            deviceId: safeText(payload.p_device_id),
            locationCode: safeText(payload.p_location_code),
            clientSessionId: safeText(payload.p_client_session_id),
            snapshotId: safeText(payload.p_snapshot_id),
            snapshotEmployeeId: safeText(payload.p_snapshot_employee_id),
            snapshotAssignmentEpoch: Number(payload.p_snapshot_assignment_epoch),
            snapshotCredentialId: safeText(payload.p_snapshot_credential_id),
            nativeScanEntryId: safeText(payload.p_native_scan_entry_id),
            clientStartedAt: safeText(payload.p_client_started_at),
            originalNativeStartAttestationVersion: originalVersion,
            originalNativeStartAttestation: originalSignature,
          });
          const transportVersion = safeText(transported?.p_native_start_transport_attestation_version);
          const transportSignature = safeText(transported?.p_native_start_transport_attestation);
          if (safeText(transported?.p_client_started_at) !== safeText(payload.p_client_started_at)
            || safeText(transported?.p_native_scan_entry_id) !== safeText(payload.p_native_scan_entry_id)
            || safeText(transported?.p_native_start_attestation_version) !== originalVersion
            || safeText(transported?.p_native_start_attestation) !== originalSignature
            || (window.MemphisMobile?.nativeOfflineTimeAuthority === true
              && (transportVersion !== 'custodial-native-start-transport.v1' || !/^[a-f0-9]{64}$/.test(transportSignature)))) {
            throw Object.assign(new Error('The protected phone could not preserve the frozen cleaning-start proof for transport.'), { httpStatus: 422 });
          }
          Object.assign(payload, transported);
          if (!await persistClaimPayload(item, payload)) {
            throw Object.assign(new Error('The durable start proof lost queue ownership before submission.'), { httpStatus: 503 });
          }
        } else if (window.MemphisMobile?.nativeOfflineTimeAuthority === true) {
          throw Object.assign(new Error('The protected native start transport attestation is unavailable.'), { httpStatus: 503 });
        }
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
        const hasNativeCompletion = isUuid(payload.p_native_finish_scan_entry_id)
          && safeText(payload.p_native_completion_attestation_version) === 'custodial-native-completion.v2'
          && /^[a-f0-9]{64}$/.test(safeText(payload.p_native_completion_attestation));
        if (binding.snapshot_id && hasNativeCompletion) {
          const createAttestation = window.MemphisMobile?.createOfflineCompletionAttestation;
          if (typeof createAttestation !== 'function') {
            if (window.MemphisMobile?.nativeOfflineTimeAuthority === true) {
              throw Object.assign(new Error('The protected native completion transport attestation is unavailable.'), { httpStatus: 503 });
            }
          } else {
            const originalVersion = safeText(payload.p_native_completion_attestation_version);
            const originalSignature = safeText(payload.p_native_completion_attestation);
            const transported = await createAttestation({
              deviceId: safeText(payload.p_device_id),
              locationCode: safeText(payload.p_location_code),
              clientSessionId: safeText(payload.p_client_session_id),
              clientCompletionId: safeText(payload.p_client_completion_id),
              contextId: safeText(local?.context_id),
              nativeFinishScanEntryId: safeText(payload.p_native_finish_scan_entry_id),
              clientStartedAt: safeText(payload.p_client_started_at),
              clientEndedAt: safeText(payload.p_client_ended_at),
              originalNativeCompletionAttestationVersion: originalVersion,
              originalNativeCompletionAttestation: originalSignature,
            });
            const transportVersion = safeText(transported?.p_native_completion_transport_attestation_version);
            const transportSignature = safeText(transported?.p_native_completion_transport_attestation);
            if (safeText(transported?.p_client_ended_at) !== safeText(payload.p_client_ended_at)
              || safeText(transported?.p_native_finish_scan_entry_id) !== safeText(payload.p_native_finish_scan_entry_id)
              || safeText(transported?.p_native_completion_attestation_version) !== originalVersion
              || safeText(transported?.p_native_completion_attestation) !== originalSignature
              || (window.MemphisMobile?.nativeOfflineTimeAuthority === true
                && (transportVersion !== 'custodial-native-completion-transport.v1' || !/^[a-f0-9]{64}$/.test(transportSignature)))) {
              throw Object.assign(new Error('The protected phone could not preserve the frozen cleaning-completion proof for transport.'), { httpStatus: 422 });
            }
            Object.assign(payload, transported);
          }
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
          // The saved submission owns its evidence, including an intentional
          // empty list. A later local journal cannot replace those original args.
          p_scan_evidence: Array.isArray(payload.p_scan_evidence) ? payload.p_scan_evidence
            : (Array.isArray(local?.scan_evidence) ? local.scan_evidence : payload.p_scan_evidence),
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
      originalCompletionSession(item);
      // Persist the verified server response before native cleanup. A crash in the
      // next step must not require a deleted native record to be signed again.
      if (!item.server_completion_receipt) await persistServerCompletionReceipt(item, result);
      await requireClaimOwnership(item);
      const acknowledge = window.MemphisMobile?.acknowledgeOfflineCompletion;
      if (typeof acknowledge !== 'function') {
        throw Object.assign(new Error('The protected completion journal cannot be acknowledged.'), { httpStatus: 503 });
      }
      const acknowledged = await acknowledge({
        deviceId: safeText(payload.p_device_id),
        locationCode: safeText(payload.p_location_code),
        clientSessionId: safeText(payload.p_client_session_id),
        nativeFinishScanEntryId: safeText(payload.p_native_finish_scan_entry_id),
        clientStartedAt: safeText(payload.p_client_started_at),
        clientEndedAt: safeText(payload.p_client_ended_at),
        completionPayload: payload,
      });
      if (acknowledged?.acknowledged !== true) throw new Error('The native completion was not acknowledged.');
      await requireClaimOwnership(item);
      originalCompletionSession(item);
      const ids = new Set([payload.p_client_session_id,payload.p_session_uuid].map(safeText).filter(isUuid));
      for (const id of ids) {
        await deleteCompletionDraft(id, item.security_generation ?? null);
        await mutateProtectedQueue(() => {
          const key = `mz_scan_completion_draft:${id}`;
          localStorage.removeItem(key);
          if (localStorage.getItem(key) !== null) throw storageFailure('completed draft cleanup',new Error('draft could not be retired'));
        }, { requireEnrollment: true, expectedGeneration: item.security_generation ?? null });
      }
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
        const pending = ['pending_submit', 'pending_sync', 'saved_pending_sync'].includes(safeText(local.status).toLowerCase());
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
      const local = originalCompletionSession(item);
      const canonical = safeText(local?.session_uuid || local?.client_session_id || payload.p_client_session_id || payload.p_session_uuid);
      const aliases = [...new Set([local?.client_session_id, payload.p_client_session_id, payload.p_session_uuid, result.session_uuid]
        .map(safeText).filter((value) => value && value !== canonical))];
      // A server alias is not permission to delete another local occurrence.
      // Validate all original local rows before the first deletion.
      const removable = [...new Set([canonical, ...aliases])].filter(Boolean).filter((id) => {
        const row = readSession(id);
        if (!row) return false;
        if (id === safeText(result.session_uuid) && ![canonical,payload.p_client_session_id,payload.p_session_uuid].includes(id)) {
          try { originalCompletionSession(item, row); } catch { return false; }
          return true;
        }
        originalCompletionSession(item, row);
        return true;
      });
      removable.forEach(removeSession);
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
    if (navigator.locks?.request && lockContext.workerLockHeld !== true) {
      return navigator.locks.request(CONFIG.WORKER_LOCK_NAME, {mode:'exclusive',ifAvailable:true},
        lock => lock ? runWorker({...lockContext,workerLockHeld:true}) : false);
    }
    const critical = operation => lockContext.shortQueueLocks === true
      ? withQueueLock(operation) : operation(lockContext);
    if (state.startupRecoveryPending) return false;
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
      await critical(() => recoverOrphanedClaims(lockContext.workerLockHeld === true || lockContext.recoverClaimsImmediately === true));
      let processed = 0;
      let paused = null;
      let compatibilityVerified = false;
      while (processed < 100) {
        paused = await securityPause();
        if (paused) break;
        const item = await critical(() => claimNextAction());
        if (!item) break;
        try {
          if (!compatibilityVerified) {
            if (!(await verifyWorkerBackendCompatibility())) {
              await critical(() => releaseClaimWithoutAttempt(item));
              return false;
            }
            compatibilityVerified = true;
          }
          await custodialSecurity()?.waitForStableState?.({
            requireEnrollment: true,
            expectedGeneration: item.security_generation ?? null,
          });
          const result = await processAction(item);
          const retired = await critical(() => finishClaim(item, { succeeded: true, result }));
          if (!retired) {
            state.lastError = 'Saved work remains pending because original queue ownership changed.';
            dispatchStatus({ status: 'retrying', item, error: state.lastError });
            break;
          }
          if(retired && item.type==='commit_workflow' && result?.status==='closed') {
            try { await window.MemphisMobile?.retireAuthenticatedCompletion?.({
              deviceId:safeText(item.payload?.p_device_id),completionPayload:item.payload,
              expectedGeneration:item.security_generation??null}); }
            catch { dispatchStatus({status:'receipt-retention-pending'}); }
          }
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
          const retryAfterMs = isAutomaticOutageRetry(error) ? parseRetryAfter(error?.retryAfter) : 0;
          state.lastError = safeText(error?.message || 'Sync failed').slice(0, 1000);
          try {
            await critical(() => finishClaim(item, { succeeded: false, error: state.lastError, permanent,
              automaticRetry: isAutomaticOutageRetry(error), retryAfterMs }));
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
      if (!hasUnresolvedReconciliationWork(remaining)
        && (compatibilityVerified || await verifyWorkerBackendCompatibility())
        && !(await securityPause())) await reportDeviceSyncStatus(remaining);
      const currentTime = now();
      // A later Finish/Completion may be individually due while its Start is
      // still backing off. Only the ordered claim selector may request an
      // immediate wake, or the worker will spin every 50 ms through an outage.
      if (nextClaimableAction(remaining, currentTime)) scheduleSync(50);
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

  async function reconcileStartupRecovery() {
    if (!state.startupRecoveryPending) return state.startupRecoveryResult || {state:'not_applicable'};
    if (state.startupRecoveryFlight) return state.startupRecoveryFlight;
    state.startupRecoveryFlight=(async()=>{
      await ensureWorkerReady();
      await window.MemphisMobile?.ready;
      const pause=await securityPause();
      if(pause){dispatchSecurityPause(pause);return {state:'manager_required'};}
      const reconcile=window.MemphisMobile?.reconcileRecoveredPreStart;
      if(typeof reconcile!=='function') return {state:'manager_required'};
      await recoverLocalCompletionIntents();
      const recovery=await reconcile();
      if(releaseStartupRecoveryGate(recovery)!==true) return {state:'manager_required'};
      state.startupRecoveryResult=recovery;
      return recovery;
    })().catch(error=>{
      state.lastError=safeText(error?.message||'Protected startup requires recovery');
      dispatchStatus({status:'recovery-paused'});
      return {state:'manager_required'};
    }).finally(()=>{state.startupRecoveryFlight=null;});
    return state.startupRecoveryFlight;
  }

  async function sync() {
    if (state.startupRecoveryPending && (await reconcileStartupRecovery()).state==='manager_required') return false;
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
    if (navigator.locks?.request) return runWorker({shortQueueLocks:true});
    return withQueueLock((lockContext) => runWorker(lockContext), { ifAvailable: true });
  }

  // Ephemeral admission from the native authenticated receipt only, never an
  // editable browser flag, date, schema version, or persisted receipt hash.
  const nativeLegacyCompletionBindings = new WeakMap();
  function localCompletionReceipt(session) {
    return canonicalJson({
      session: safeText(session?.client_session_id || session?.session_uuid),
      completion: safeText(session?.client_completion_id), device: safeText(session?.device_id),
      location: safeText(session?.location_code), start: safeText(session?.started_at),
      end: safeText(session?.ended_at), finish: safeText(session?.native_finish_scan_entry_id),
      response: session?.response_json || null,
    });
  }
  function isLocallyCompleted(session) {
    return safeText(session?.status) === 'saved_pending_sync'
      && session?.completion_pending === true
      && safeText(session?.local_completion_receipt) === localCompletionReceipt(session);
  }
  function validateLocalCompletion(session, action) {
    const p = action?.payload || {};
    const s = safeText(session?.client_session_id || session?.session_uuid);
    const response = { ...(p.p_response_json || {}) };
    delete response.__custodial_offline_reconciliation_v1;
    const checkOnly = response.work_result === 'checked_no_cleaning_needed';
    const verifiedLegacy = response.work_result === undefined
      && nativeLegacyCompletionBindings.get(action) === canonicalJson(p);
    const knownOutcome = verifiedLegacy || ['full', 'details', 'checked_no_cleaning_needed'].includes(response.work_result);
    const fullService = value => String(value).trim().toLowerCase() === 'full cleaning services';
    const exclusiveServices = verifiedLegacy
      ? !response.services_performed?.some(fullService) || response.services_performed.length === 1
      : (response.work_result === 'full'
        ? response.services_performed?.length === 1 && fullService(response.services_performed[0])
        : !Array.isArray(response.services_performed) || !response.services_performed.some(fullService));
    const validServices = knownOutcome && exclusiveServices && Array.isArray(response.services_performed)
      && response.services_performed.every(value => typeof value === 'string' && value.trim())
      && (checkOnly ? response.services_performed.length === 0 : response.services_performed.length > 0);
    if (action?.type !== 'commit_workflow' || !isUuid(s)
      || !isUuid(session.client_completion_id) || !isUuid(session.native_finish_scan_entry_id)
      || s !== safeText(p.p_client_session_id)
      || safeText(session.client_completion_id) !== safeText(p.p_client_completion_id)
      || safeText(session.device_id) !== safeText(p.p_device_id)
      || safeText(session.location_code) !== safeText(p.p_location_code)
      || safeText(session.started_at) !== safeText(p.p_client_started_at)
      || safeText(session.ended_at) !== safeText(p.p_client_ended_at)
      || safeText(session.native_finish_scan_entry_id) !== safeText(p.p_native_finish_scan_entry_id)
      || !Number.isFinite(Date.parse(session.started_at)) || !Number.isFinite(Date.parse(session.ended_at))
      || Date.parse(session.ended_at) < Date.parse(session.started_at)
      || !validServices
      || canonicalJson(response) !== canonicalJson(session.response_json || {})) {
      throw storageFailure('completed cleaning', new Error('exact saved answers and finish identity are required'));
    }
  }
  async function persistLocalCompletionUnlocked(session, action) {
    validateLocalCompletion(session, action);
    const originalSecurity = queueMutationSecurity(), originalMobile = window.MemphisMobile;
    const originalStatusReader = originalSecurity?.getStatus, originalWriter = originalSecurity?.mutateProtectedWork;
    const originalPrincipalReader = originalMobile?.principalIdentity;
    const status = originalSecurity?.native === true ? originalSecurity.getStatus() : null;
    const original = status ? Object.freeze({deviceId: status.deviceId, generation: status.generation,
      principal: canonicalJson(status.principal), identity: originalMobile?.principalIdentity?.()}) : null;
    const originalSession = canonicalJson(session), originalAction = canonicalJson(action);
    const requireOriginal = (context) => {
      const currentSecurity = queueMutationSecurity();
      if (currentSecurity !== originalSecurity || canonicalJson(session) !== originalSession || canonicalJson(action) !== originalAction)
        throw queueSecurityUnavailable();
      if (!original) {
        if (currentSecurity?.native === true) throw queueSecurityUnavailable();
        return;
      }
      if (window.MemphisMobile !== originalMobile || currentSecurity.getStatus !== originalStatusReader
        || currentSecurity.mutateProtectedWork !== originalWriter || originalMobile.principalIdentity !== originalPrincipalReader)
        throw queueSecurityUnavailable();
      const live = currentSecurity.getStatus();
      if (live?.ready !== true || live.available !== true || live.quarantined !== false || live.state !== 'enrolled'
        || !Number.isSafeInteger(original.generation) || original.generation < 1 || live.generation !== original.generation
        || live.deviceId !== original.deviceId || safeText(session.device_id) !== original.deviceId
        || !live.principal || live.principal.device_id !== original.deviceId
        || !['custodial-protected-principal.v1', 'custodial-protected-principal.v2'].includes(live.principal.schema_version)
        || !isUuid(live.principal.employee_id) || !isUuid(live.principal.credential_id)
        || !Number.isSafeInteger(live.principal.assignment_epoch) || live.principal.assignment_epoch < 1
        || typeof original.identity !== 'string' || !original.identity
        || canonicalJson(live.principal) !== original.principal || originalMobile.principalIdentity() !== original.identity)
        throw queueSecurityUnavailable();
      if (context !== undefined) {
        if (typeof context?.assertCurrent !== 'function' || context.generation !== original.generation || context.deviceId !== original.deviceId)
          throw queueSecurityUnavailable();
        context.assertCurrent();
      }
    };
    const originalOptions = {requireEnrollment: true, ...(original ? {expectedGeneration: original.generation} : {})};
    requireOriginal();let originalIntentRaw;
    // The intent is durable before queue insertion. A restart can finish this exact save.
    await mutateProtectedQueue(context => {
      requireOriginal(context);saveSession({ ...session, completion_outbox: action });
      originalIntentRaw = localStorage.getItem(sessionKey(session.session_uuid));requireOriginal(context);
    }, originalOptions);
    requireOriginal();
    await enqueueUnlocked(action, original?.generation ?? null);
    requireOriginal();
    if (localStorage.getItem(sessionKey(session.session_uuid)) !== originalIntentRaw) throw queueSecurityUnavailable();
    const latest = readSession(session.session_uuid);
    if (!latest) throw storageFailure('completed cleaning', new Error('saved record disappeared'));
    const saved = { ...latest, status: 'saved_pending_sync', state: 'locally-completed',
      completion_pending: true, sync_status: 'delivery_pending' };
    saved.local_completion_receipt = localCompletionReceipt(saved);
    let viewConfirmation = null;
    await mutateProtectedQueue((context) => {
      requireOriginal(context);
      saveSession(saved);
      const security = queueMutationSecurity();
      if (security?.native === true) {
        if (typeof context?.assertCurrent !== 'function') throw queueSecurityUnavailable();
        context.assertCurrent();
        const status = security.getStatus(), identity = window.MemphisMobile?.principalIdentity?.();
        const raw = localStorage.getItem(sessionKey(saved.session_uuid));
        if (status?.ready !== true || status.available !== true || status.quarantined !== false
          || status.deviceId !== context.deviceId || status.generation !== context.generation
          || status.principal?.device_id !== context.deviceId || safeText(saved.device_id) !== context.deviceId
          || typeof identity !== 'string' || !identity || typeof raw !== 'string' || !raw) throw queueSecurityUnavailable();
        context.assertCurrent();
        viewConfirmation = Object.freeze({deviceId: context.deviceId, generation: context.generation,
          principalIdentity: identity, sessionRaw: raw});
      } else if (typeof window.MemphisUI?.retireCompletedScanView === 'function'
        && window.MemphisUI.retireCompletedScanView(saved) !== true) {
        throw storageFailure('completed cleaning index', new Error('active view could not be retired'));
      }
      requireOriginal(context);
    }, originalOptions);
    requireOriginal();
    if (viewConfirmation) {
      // Admission above has settled: do not re-enter the native FIFO from its
      // own callback. A missing/changed/unknown index result retains completion
      // intent and original receipt; it cannot announce a completed view.
      const retire = window.MemphisUI?.retireCompletedScanViewConfirmed;
      const original = JSON.parse(viewConfirmation.sessionRaw);
      if (typeof retire !== 'function' || await retire(original, viewConfirmation) !== true)
        throw storageFailure('completed cleaning index', new Error('active view retirement is unconfirmed'));
      requireOriginal();
      return original;
    }
    return saved;
  }
  async function saveCompletedLocalWork(session, action) {
    await ensureWorkerReady();
    return withQueueLock(() => persistLocalCompletionUnlocked(session, action));
  }
  async function mutateLocalSessions(operation) {
    // Page writers and recovery share the exact queue lock, including across
    // documents. Do not pretend localStorage's best-effort fallback is a CAS.
    if (!navigator.locks?.request) {
      throw storageFailure('local workflow', new Error('The shared saved-work lock is unavailable; nothing was changed.'));
    }
    await ensureWorkerReady();
    return withQueueLock(operation);
  }
  async function recoverLocalCompletionIntentsUnlocked() {
    for (let session of allSessions()) {
      if (safeText(session.device_id) !== state.deviceId || !session.completion_outbox) continue;
      if (!['pending_submit', 'pending_sync', 'saved_pending_sync'].includes(safeText(session.status))) continue;
      let action = session.completion_outbox;
      if (action.payload?.p_response_json?.work_result === undefined) {
        if (!navigator.locks?.request) {
          throw storageFailure('legacy completed cleaning', new Error('The shared saved-work lock is unavailable; nothing was changed.'));
        }
        const durableBefore = canonicalJson(session);
        const before = canonicalJson(action.payload);
        const accepted = await verifiedServerCompletionReceipt(action);
        const current = readSession(session.session_uuid);
        if (!accepted || canonicalJson(action.payload) !== before
          || !current || canonicalJson(current) !== durableBefore) {
          // Retain the exact queue, draft, answers and identity. This phone must
          // complete protected legacy reconciliation before cutover, not invent
          // an outcome or treat a browser record as authenticated acceptance.
          throw storageFailure('legacy completed cleaning', new Error('Saved legacy work needs exact authenticated acceptance; nothing was deleted.'));
        }
        // Bind the freshly read action, not the detached pre-await snapshot.
        // The caller still holds the same Web Lock used by every page writer.
        session = current;
        action = current.completion_outbox;
        nativeLegacyCompletionBindings.set(action, before);
      }
      try {
        if (isLocallyCompleted(session)) {
          validateLocalCompletion(session, action);
          const rows = await listActions();
          if (!rows.some(item => item.type === 'commit_workflow'
            && safeText(item.payload?.p_client_completion_id) === safeText(session.client_completion_id))) {
            await enqueueUnlocked(action);
          }
        } else {
          await persistLocalCompletionUnlocked(session, action);
        }
      } finally {
        nativeLegacyCompletionBindings.delete(action);
      }
    }
  }
  async function recoverLocalCompletionIntents() {
    await ensureWorkerReady();
    return withQueueLock(recoverLocalCompletionIntentsUnlocked);
  }
  async function admitNewLocalWork(authorize) {
    await ensureWorkerReady();
    return withQueueLock(async () => {
      await recoverLocalCompletionIntentsUnlocked();
      const blocking = allSessions().filter(session => safeText(session.device_id) === state.deviceId
        && ['active','server-active','offline-provisional','pending_submit','pending_sync'].includes(safeText(session.status)));
      if (blocking.length) throw Object.assign(new Error('Finish the current cleaning and its form before starting another location.'), {code:'custodial_unfinished_work'});
      const value = await authorize();
      return Object.freeze({admitted:true,queued:(await listActions()).length,value});
    });
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

  async function recoverDeadLetter(id, options = {}) {
    if (!Number.isSafeInteger(id) || id < 1) throw storageFailure('dead-letter recovery', new Error('Exact original row id required'));
    // Keep the public {syncAfter} call shape, but never invoke an option getter.
    if (!options || typeof options !== 'object' || Array.isArray(options))
      throw storageFailure('dead-letter recovery', new Error('Original recovery options required'));
    const descriptors = Object.getOwnPropertyDescriptors(options), sync = descriptors.syncAfter;
    if (Reflect.ownKeys(descriptors).some(key => key !== 'syncAfter')
      || sync && (!Object.hasOwn(sync, 'value') || typeof sync.value !== 'boolean'))
      throw storageFailure('dead-letter recovery', new Error('Unsupported original recovery options'));
    const syncAfter = sync ? sync.value : true;

    const security = queueMutationSecurity(), mobile = window.MemphisMobile;
    const reader = security?.getStatus, writer = security?.mutateProtectedWork, stable = security?.waitForStableState;
    const principalReader = mobile?.principalIdentity, initial = security?.native === true ? security.getStatus() : null;
    const original = initial ? Object.freeze({ generation: initial.generation, deviceId: initial.deviceId,
      principal: canonicalJson(initial.principal), identity: mobile?.principalIdentity?.(),
      employeeId: initial.principal?.employee_id, assignmentEpoch: initial.principal?.assignment_epoch,
      credentialId: initial.principal?.credential_id }) : null;
    let db = state.db, transactionMethod = db?.transaction;
    const requireOriginal = context => {
      const current = queueMutationSecurity();
      if (current !== security || security?.getStatus !== reader || security?.mutateProtectedWork !== writer
        || security?.waitForStableState !== stable || window.MemphisMobile !== mobile
        || db && (state.db !== db || db.transaction !== transactionMethod)) throw queueSecurityUnavailable();
      if (original) {
        const live = reader.call(security);
        if (mobile?.principalIdentity !== principalReader || live?.ready !== true || live.available !== true
          || live.quarantined !== false || live.state !== 'enrolled' || !Number.isSafeInteger(original.generation)
          || original.generation < 1 || live.generation !== original.generation || live.deviceId !== original.deviceId
          || !live.principal || live.principal.device_id !== original.deviceId
          || !['custodial-protected-principal.v1', 'custodial-protected-principal.v2'].includes(live.principal.schema_version)
          || !isUuid(live.principal.employee_id) || !isUuid(live.principal.credential_id)
          || !Number.isSafeInteger(live.principal.assignment_epoch) || live.principal.assignment_epoch < 1
          || canonicalJson(live.principal) !== original.principal || typeof original.identity !== 'string' || !original.identity
          || principalReader.call(mobile) !== original.identity
          || state.deviceId !== original.deviceId && (db || state.deviceId !== '')) throw queueSecurityUnavailable();
        if (context !== undefined && (context?.deviceId !== original.deviceId || context?.generation !== original.generation))
          throw queueSecurityUnavailable();
      } else if (current?.native === true) throw queueSecurityUnavailable();
      if (context !== undefined) queueOpeningCheckpoint(context);
    };
    const bounds = { requireEnrollment: true, ...(original ? { expectedGeneration: original.generation } : {}) };
    requireOriginal();
    await ensureWorkerReady();
    requireOriginal();
    if (!db) { db = state.db; transactionMethod = db?.transaction; }
    if (!db || typeof transactionMethod !== 'function') throw storageFailure('dead-letter recovery', new Error('Original queue unavailable'));
    requireOriginal();


    const snapshot = raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw storageFailure('dead-letter recovery', new Error('Unknown original row'));
      const copy = JSON.parse(JSON.stringify(raw));
      if (!queueOpeningRowsMatch([raw], [copy])) throw storageFailure('dead-letter recovery', new Error('Unknown original row representation'));
      return copy;
    };
    const eligible = raw => {
      if (raw == null) return false;
      const forward = raw.forward_replay_contract === CONFIG.REQUIRED_SCAN_CONTRACT_VERSION;
      const dead = forward ? raw.current_dead_letter : raw.dead_letter;
      if (raw.recoverable === false || dead === false) return false;
      const type = forward ? raw.forward_action_type : raw.type;
      if (dead !== true || raw.recoverable !== undefined && typeof raw.recoverable !== 'boolean'
        || raw.schema_version !== CONFIG.SCHEMA_VERSION || !Number.isSafeInteger(raw.id) || raw.id < 1
        || typeof type !== 'string' || !['start_session','complete_session','commit_workflow','finish_session',
          'record_scan_event','ping_device','evaluate_location_proximity_v2'].includes(type)
        || forward && raw.type !== 'forward-replay-fenced:' + type
        || !forward && raw.forward_replay_contract != null
        || !isUuid(raw.operation_id) || typeof raw.operation_id !== 'string'
        || raw.state !== 'dead-letter' || !raw.payload || typeof raw.payload !== 'object' || Array.isArray(raw.payload)
        || raw.lease_owner != null || raw.lease_token != null || raw.lease_until != null && raw.lease_until !== 0)
        throw storageFailure('dead-letter recovery', new Error('Unknown or leased original dead letter'));
      if (original && (raw.payload.p_device_id !== original.deviceId
        || raw.replay_binding?.employee_id !== original.employeeId
        || raw.replay_binding?.assignment_epoch !== original.assignmentEpoch
        || raw.replay_binding?.credential_id != null && raw.replay_binding.credential_id !== original.credentialId
        || raw.payload.p_snapshot_employee_id != null && raw.payload.p_snapshot_employee_id !== original.employeeId
        || raw.payload.p_snapshot_assignment_epoch != null && raw.payload.p_snapshot_assignment_epoch !== original.assignmentEpoch))
        throw storageFailure('dead-letter recovery', new Error('Foreign original dead letter retained'));
      return true;
    };
    // Every transaction keeps native FIFO ownership through a DIRECT terminal
    // event's full dispatch. Put remains synchronous in get.onsuccess while IDB
    // is active; there is no timer/microtask around the actual writer.
    const transact = (context, key, expected, replacement) => new Promise((resolve, reject) => {
      let tx = null, failure = null, value = null;
      const refuse = error => {
        failure = failure || error;
        if (!tx) { reject(failure); return; }
        try { tx.abort(); } catch (abortError) {
          failure = Object.assign(new AggregateError([failure, abortError],
            'Dead-letter recovery settlement is uncertain.', { cause: failure }),
          { code: failure.code || 'custodial_storage_unavailable' });
        }
      };
      const settle = aborted => {
        let error = failure || (aborted ? tx.error || new Error('Queue recovery transaction aborted.') : null);
        try { requireOriginal(context); } catch (withdrawn) { error = error || withdrawn; }
        if (error) reject(error); else resolve(value);
      };
      try {
        requireOriginal(context);
        tx = transactionMethod.call(db, CONFIG.STORE_NAME, replacement ? 'readwrite' : 'readonly');
        const terminal = (event, aborted) => {
          if (event.target !== tx) return;
          try { requireOriginal(context); } catch (withdrawn) { failure = failure || withdrawn; }
          window.setTimeout(() => settle(aborted), 0);
        };
        tx.oncomplete = event => terminal(event, false);
        tx.onabort = event => terminal(event, true);
        tx.onerror = event => {
          failure = failure || event.target?.error || tx.error || new Error('Queue recovery transaction failed.');
          try { requireOriginal(context); } catch (error) { failure = failure || error; }
        };
        const store = tx.objectStore(CONFIG.STORE_NAME);
        requireOriginal(context);
        const request = key === null ? store.getAll() : store.get(key);
        request.onerror = () => refuse(request.error || tx.error || new Error('Original queue read failed.'));
        request.onsuccess = () => {
          try {
            requireOriginal(context);
            if (failure) throw failure;
            if (key === null) {
              if (!Array.isArray(request.result)) throw new Error('Original queue list unavailable.');
              value = request.result.map(snapshot);
            } else {
              value = request.result == null ? null : snapshot(request.result);
              if (value && value.id !== key) throw new Error('Original queue key changed.');
            }
            if (replacement) {
              if (!value || !queueOpeningRowsMatch([value], [expected]) || !eligible(value))
                throw storageFailure('dead-letter recovery', new Error('Original dead letter changed before recovery'));
              requireOriginal(context);
              const put = store.put(replacement);
              if (put) put.onerror = () => refuse(put.error || tx.error || new Error('Original recovery write failed.'));
              requireOriginal(context);
            }
          } catch (error) { refuse(error); }
        };
      } catch (error) { refuse(error); }
    });

    // Keep ONE original FIFO admission from first raw read through readback;
    // no cooperating successor writer may slip between observation and put.
    const recovered = await mutateProtectedQueue(async context => {
      requireOriginal(context);
      const raw = await transact(context, id);
      requireOriginal(context);
      if (!eligible(raw)) return false;

      // Change only explicit reconciliation bookkeeping. Never rerun the queue
      // normalizer/producer to refill IDs, payload, receipts or attempt history.
      const actionType = raw.forward_replay_contract === CONFIG.REQUIRED_SCAN_CONTRACT_VERSION ? raw.forward_action_type : raw.type;
      const replacement = { ...raw, forward_replay_contract: CONFIG.REQUIRED_SCAN_CONTRACT_VERSION,
        forward_action_type: actionType, type: 'forward-replay-fenced:' + actionType, dead_letter: true, current_dead_letter: false,
        state: 'reconciliation-required', next_attempt_at: 0, lease_owner: null, lease_token: null, lease_until: 0 };
      requireOriginal(context);
      await transact(context, raw.id, raw, replacement);
      requireOriginal(context);
      const verified = await transact(context, raw.id);
      requireOriginal(context);
      if (!verified || !queueOpeningRowsMatch([verified], [replacement]))
        throw storageFailure('dead-letter recovery', new Error('Original recovery readback unconfirmed'));
      return true;
    }, bounds);
    requireOriginal(); // Callback is closed; only original readers may run here.
    if (syncAfter && recovered === true) { requireOriginal(); scheduleSync(); }
    return recovered === true;
  }

  async function recoverAllDeadLetters() {

    const security = queueMutationSecurity(), mobile = window.MemphisMobile;
    const reader = security?.getStatus, writer = security?.mutateProtectedWork, stable = security?.waitForStableState;
    const principalReader = mobile?.principalIdentity, initial = security?.native === true ? security.getStatus() : null;
    const original = initial ? Object.freeze({ generation: initial.generation, deviceId: initial.deviceId,
      principal: canonicalJson(initial.principal), identity: mobile?.principalIdentity?.(),
      employeeId: initial.principal?.employee_id, assignmentEpoch: initial.principal?.assignment_epoch,
      credentialId: initial.principal?.credential_id }) : null;
    let db = state.db, transactionMethod = db?.transaction;
    const requireOriginal = context => {
      const current = queueMutationSecurity();
      if (current !== security || security?.getStatus !== reader || security?.mutateProtectedWork !== writer
        || security?.waitForStableState !== stable || window.MemphisMobile !== mobile
        || db && (state.db !== db || db.transaction !== transactionMethod)) throw queueSecurityUnavailable();
      if (original) {
        const live = reader.call(security);
        if (mobile?.principalIdentity !== principalReader || live?.ready !== true || live.available !== true
          || live.quarantined !== false || live.state !== 'enrolled' || !Number.isSafeInteger(original.generation)
          || original.generation < 1 || live.generation !== original.generation || live.deviceId !== original.deviceId
          || !live.principal || live.principal.device_id !== original.deviceId
          || !['custodial-protected-principal.v1', 'custodial-protected-principal.v2'].includes(live.principal.schema_version)
          || !isUuid(live.principal.employee_id) || !isUuid(live.principal.credential_id)
          || !Number.isSafeInteger(live.principal.assignment_epoch) || live.principal.assignment_epoch < 1
          || canonicalJson(live.principal) !== original.principal || typeof original.identity !== 'string' || !original.identity
          || principalReader.call(mobile) !== original.identity
          || state.deviceId !== original.deviceId && (db || state.deviceId !== '')) throw queueSecurityUnavailable();
        if (context !== undefined && (context?.deviceId !== original.deviceId || context?.generation !== original.generation))
          throw queueSecurityUnavailable();
      } else if (current?.native === true) throw queueSecurityUnavailable();
      if (context !== undefined) queueOpeningCheckpoint(context);
    };
    const bounds = { requireEnrollment: true, ...(original ? { expectedGeneration: original.generation } : {}) };
    requireOriginal();
    await ensureWorkerReady();
    requireOriginal();
    if (!db) { db = state.db; transactionMethod = db?.transaction; }
    if (!db || typeof transactionMethod !== 'function') throw storageFailure('dead-letter recovery', new Error('Original queue unavailable'));
    requireOriginal();

    if (typeof stable === 'function') { await stable.call(security, { requireEnrollment: true }); requireOriginal(); }

    const snapshot = raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw storageFailure('dead-letter recovery', new Error('Unknown original row'));
      const copy = JSON.parse(JSON.stringify(raw));
      if (!queueOpeningRowsMatch([raw], [copy])) throw storageFailure('dead-letter recovery', new Error('Unknown original row representation'));
      return copy;
    };
    const eligible = raw => {
      if (raw == null) return false;
      const forward = raw.forward_replay_contract === CONFIG.REQUIRED_SCAN_CONTRACT_VERSION;
      const dead = forward ? raw.current_dead_letter : raw.dead_letter;
      if (raw.recoverable === false || dead === false) return false;
      const type = forward ? raw.forward_action_type : raw.type;
      if (dead !== true || raw.recoverable !== undefined && typeof raw.recoverable !== 'boolean'
        || raw.schema_version !== CONFIG.SCHEMA_VERSION || !Number.isSafeInteger(raw.id) || raw.id < 1
        || typeof type !== 'string' || !['start_session','complete_session','commit_workflow','finish_session',
          'record_scan_event','ping_device','evaluate_location_proximity_v2'].includes(type)
        || forward && raw.type !== 'forward-replay-fenced:' + type
        || !forward && raw.forward_replay_contract != null
        || !isUuid(raw.operation_id) || typeof raw.operation_id !== 'string'
        || raw.state !== 'dead-letter' || !raw.payload || typeof raw.payload !== 'object' || Array.isArray(raw.payload)
        || raw.lease_owner != null || raw.lease_token != null || raw.lease_until != null && raw.lease_until !== 0)
        throw storageFailure('dead-letter recovery', new Error('Unknown or leased original dead letter'));
      if (original && (raw.payload.p_device_id !== original.deviceId
        || raw.replay_binding?.employee_id !== original.employeeId
        || raw.replay_binding?.assignment_epoch !== original.assignmentEpoch
        || raw.replay_binding?.credential_id != null && raw.replay_binding.credential_id !== original.credentialId
        || raw.payload.p_snapshot_employee_id != null && raw.payload.p_snapshot_employee_id !== original.employeeId
        || raw.payload.p_snapshot_assignment_epoch != null && raw.payload.p_snapshot_assignment_epoch !== original.assignmentEpoch))
        throw storageFailure('dead-letter recovery', new Error('Foreign original dead letter retained'));
      return true;
    };
    // Every transaction keeps native FIFO ownership through a DIRECT terminal
    // event's full dispatch. Put remains synchronous in get.onsuccess while IDB
    // is active; there is no timer/microtask around the actual writer.
    const transact = (context, key, expected, replacement) => new Promise((resolve, reject) => {
      let tx = null, failure = null, value = null;
      const refuse = error => {
        failure = failure || error;
        if (!tx) { reject(failure); return; }
        try { tx.abort(); } catch (abortError) {
          failure = Object.assign(new AggregateError([failure, abortError],
            'Dead-letter recovery settlement is uncertain.', { cause: failure }),
          { code: failure.code || 'custodial_storage_unavailable' });
        }
      };
      const settle = aborted => {
        let error = failure || (aborted ? tx.error || new Error('Queue recovery transaction aborted.') : null);
        try { requireOriginal(context); } catch (withdrawn) { error = error || withdrawn; }
        if (error) reject(error); else resolve(value);
      };
      try {
        requireOriginal(context);
        tx = transactionMethod.call(db, CONFIG.STORE_NAME, replacement ? 'readwrite' : 'readonly');
        const terminal = (event, aborted) => {
          if (event.target !== tx) return;
          try { requireOriginal(context); } catch (withdrawn) { failure = failure || withdrawn; }
          window.setTimeout(() => settle(aborted), 0);
        };
        tx.oncomplete = event => terminal(event, false);
        tx.onabort = event => terminal(event, true);
        tx.onerror = event => {
          failure = failure || event.target?.error || tx.error || new Error('Queue recovery transaction failed.');
          try { requireOriginal(context); } catch (error) { failure = failure || error; }
        };
        const store = tx.objectStore(CONFIG.STORE_NAME);
        requireOriginal(context);
        const request = key === null ? store.getAll() : store.get(key);
        request.onerror = () => refuse(request.error || tx.error || new Error('Original queue read failed.'));
        request.onsuccess = () => {
          try {
            requireOriginal(context);
            if (failure) throw failure;
            if (key === null) {
              if (!Array.isArray(request.result)) throw new Error('Original queue list unavailable.');
              value = request.result.map(snapshot);
            } else {
              value = request.result == null ? null : snapshot(request.result);
              if (value && value.id !== key) throw new Error('Original queue key changed.');
            }
            if (replacement) {
              if (!value || !queueOpeningRowsMatch([value], [expected]) || !eligible(value))
                throw storageFailure('dead-letter recovery', new Error('Original dead letter changed before recovery'));
              requireOriginal(context);
              const put = store.put(replacement);
              if (put) put.onerror = () => refuse(put.error || tx.error || new Error('Original recovery write failed.'));
              requireOriginal(context);
            }
          } catch (error) { refuse(error); }
        };
      } catch (error) { refuse(error); }
    });

    const count = await mutateProtectedQueue(async context => {
      requireOriginal(context);
      const listed = await transact(context, null);
      requireOriginal(context);
      const originals = listed.filter(raw => {
        const dead = raw.forward_replay_contract === CONFIG.REQUIRED_SCAN_CONTRACT_VERSION ? raw.current_dead_letter : raw.dead_letter;
        return dead === true && raw.recoverable !== false && eligible(raw);
      }).sort((left, right) => left.created_at - right.created_at);
      if (new Set(originals.map(raw => raw.id)).size !== originals.length)
        throw storageFailure('dead-letter recovery', new Error('Ambiguous original queue row ids'));
      let recovered = 0;
      for (const raw of originals) {
        requireOriginal(context);

      // Change only explicit reconciliation bookkeeping. Never rerun the queue
      // normalizer/producer to refill IDs, payload, receipts or attempt history.
        const actionType = raw.forward_replay_contract === CONFIG.REQUIRED_SCAN_CONTRACT_VERSION ? raw.forward_action_type : raw.type;
        const replacement = { ...raw, forward_replay_contract: CONFIG.REQUIRED_SCAN_CONTRACT_VERSION,
          forward_action_type: actionType, type: 'forward-replay-fenced:' + actionType, dead_letter: true, current_dead_letter: false,
          state: 'reconciliation-required', next_attempt_at: 0, lease_owner: null, lease_token: null, lease_until: 0 };
        requireOriginal(context);
        await transact(context, raw.id, raw, replacement);
        requireOriginal(context);
        const verified = await transact(context, raw.id);
        requireOriginal(context);
        if (!verified || !queueOpeningRowsMatch([verified], [replacement]))
          throw storageFailure('dead-letter recovery', new Error('Original recovery readback unconfirmed'));
        recovered++;
      }
      return recovered;
    }, bounds);
    requireOriginal(); // Never call the settled callback's checkpoint.
    if (count > 0) scheduleSync();
    return count;
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
    const legacyBrowser = queueMutationSecurity() === null;
    if (legacyBrowser) {
      // Receiver selection is browser DATA, not native/auth admission. Bind it
      // before import/FIFO waits; the callback must not resolve a successor.
      const originalDeviceId = state.deviceId;
      const selectedDeviceId = safeText(originalDeviceId) || resolveDeviceId();
      if (queueMutationSecurity() !== null || state.deviceId !== originalDeviceId) throw queueSecurityUnavailable();
      state.deviceId = selectedDeviceId;
    }
    await mutateProtectedQueue(async (context) => {
      if (!legacyBrowser) state.deviceId = safeText(context?.deviceId) || resolveDeviceId();
      state.db = await openDb(context);
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
  void ready.then(opened=>{if(opened && state.startupRecoveryPending)observeSync(reconcileStartupRecovery());});
  window.MemphisScanSync = {
    ready,
    sync,
    releaseStartupRecoveryGate,
    reconcileStartupRecovery,
    enqueue,
    listActions,
    retirePreservedInterruptedStart,
    reportDeviceSyncStatus,
    recoverDeadLetter,
    recoverAllDeadLetters,
    drainForNewWork,
    admitNewLocalWork,
    saveCompletedLocalWork,
    mutateProtectedWork: mutateProtectedQueue,
    requireLegacyBrowserMutation,
    mutateLocalSessions,
    recoverLocalCompletionIntents,
    isLocallyCompleted,
    rollbackReadiness,
    cancelRollbackFence,
    recoverStaleRollbackFenceForNewWork,
    saveCompletionDraft,
    loadCompletionDraft,
    completionDraftExists,
    deleteCompletionDraft,
    resolveDeviceId: () => state.deviceId || resolveDeviceId(),
    queueSchemaVersion: CONFIG.SCHEMA_VERSION,
  };
})();
