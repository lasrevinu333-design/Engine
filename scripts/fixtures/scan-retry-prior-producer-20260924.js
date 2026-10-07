// Exact function bodies extracted from frozen d16b7bd1 packet source SHA256 015c78238488eade762a4a22f09275179ae7cb71be5de82b80d8a0ed0a3faf23.
// Historical defect producer for migration tests only; never shipped as product code.
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

  function finishClaim(item, { succeeded, result = null, error = null, permanent = false, automaticRetry = false, retryAfterMs = 0 } = {}) {
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
        const retryCount = Math.min(Number.MAX_SAFE_INTEGER, Number(current.retry_count || 0) + 1);
        // A confirmed transport/server outage is not a permanent rejection of saved work.
        // Unknown failures retain the existing bounded hold; old held rows are not revived.
        const deadLetter = permanent || (!automaticRetry && retryCount >= CONFIG.MAX_RETRIES);
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
  function isAutomaticOutageRetry(error) {
    // Never reinterpret a typed identity, vault or reconciliation failure as an outage.
    if (error?.code) return error.code === 'custodial_native_network_unavailable';
    const status = Number(error?.httpStatus || 0);
    return status === 408 || status === 429 || (status >= 500 && status < 600)
      || error?.scanTransportFailure === true;
  }
  function parseRetryAfter(value) {
    const raw = safeText(value);
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return Number(raw) * 1000;
    const at = Date.parse(raw);
    return Number.isFinite(at) ? Math.max(0, at - now()) : 0;
  }

