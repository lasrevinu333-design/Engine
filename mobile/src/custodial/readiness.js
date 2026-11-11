// Presentation only. No credentials, wall-clock expiry inference, or work admission.
export function classifyReadiness(input = {}) {
  const { security = {}, queue, nativeState, sessionState } = input;
  const result = (state, label, detail) => Object.freeze({ state, label, detail });
  if (security.quarantined === true || input.integrityFailure === true || nativeState?.observation === 'DO_NOT_USE' || ['corrupted', 'ambiguous'].includes(sessionState)) {
    return result('do_not_use', 'Do not use', 'Protected phone or saved-work integrity could not be verified. Repair is required; saved work is retained.');
  }
  if (security.initialized === true && security.available === false) {
    return result('do_not_use', 'Do not use', 'Protected phone security is unavailable. Repair is required; saved work is retained.');
  }
  // A retained queue entry that is not a record cannot be interpreted safely.
  // Keep it visible as an integrity problem; never discard or rewrite the row.
  if (Array.isArray(queue) && queue.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    return result('do_not_use', 'Do not use', 'A saved-work record could not be read safely. Repair is required; saved work is retained.');
  }
  if (input.managerRequired === true || input.enrollmentPending === true || input.authRejected === true
    || nativeState?.rollback_fence_active === true
    || nativeState?.observation === 'NEEDS_MANAGER' || nativeState?.protected_work_admission === 'RECOVERY_REQUIRED'
    || ['unenrolled', 'removing'].includes(security.state)
    || (Array.isArray(queue) && queue.some(row => row.dead_letter === true || row.recoverable === false || ['quarantined', 'dead-letter', 'legacy-quarantine'].includes(row.state)))) {
    return result('needs_manager', 'Phone repair needed', 'Phone verification or saved-work recovery could not finish. Nothing has been erased.');
  }
  if ((Array.isArray(queue) && queue.length > 0) || nativeState?.pending_occurrences === true || nativeState?.unfinished_occurrence === true) {
    return result('needs_internet', 'Saved work awaiting confirmation', 'Saved work is pending confirmation. Automatic sync retains it until acknowledged; an open cleaning still uses the same tag to finish.');
  }
  if (input.connected === true && security.ready === true && security.available === true && security.state === 'enrolled'
    && input.principalPresent === true && input.profileMatches === true && input.serverConfirmed === true
    && input.snapshotAnchored === true && input.startupClear === true && Array.isArray(queue)
    && nativeState?.observation === 'CONFIRMED' && nativeState?.read_only === true
    && nativeState?.native_clock_continuity === 'CONFIRMED' && nativeState?.protected_work_admission === 'CLEAR'
    && nativeState?.rollback_fence_active === false && nativeState?.pending_occurrences === false
    && nativeState?.unfinished_occurrence === false
    && ['none', 'open'].includes(sessionState)) {
    return result('ready', 'Ready for work', 'Last confirmed during this connection: assigned identity, saved-work recovery and native snapshot storage. Each tag tap still requires native admission.');
  }
  return result('needs_internet', 'Needs internet', 'Current work readiness is not confirmed. Reconnect for verification; online alone is not enough. Saved work is retained, and existing tag admission is unchanged.');
}

// Employee presentation is quieter than internal readiness classification.
// A transport/pending state is NOT promoted to Ready/server accepted, and does
// not advertise an ordinary outage. Actionable integrity/recovery stays shown.
export function readinessPresentation(result, input = {}) {
  if (!result || !['ready', 'needs_internet', 'needs_manager', 'do_not_use'].includes(result.state)) {
    return Object.freeze({ state: 'needs_manager', hidden: false, label: 'Phone needs verification', detail: 'Verification could not finish; saved work is retained.' });
  }
  const actionable = ['needs_manager', 'do_not_use'].includes(result.state);
  if (!actionable && input.localReadinessUnavailable === true) {
    return Object.freeze({ ...result, hidden: false, label: 'Saved work verification needed',
      detail: 'The phone could not check protected saved work. Repair is required; do not reset the phone.' });
  }
  // The native observation also uses NEEDS_INTERNET for ordinary work awaiting
  // a finish or receipt. Its exact reason distinguishes that from an expired
  // permission. This presentation never changes native work admission.
  const native = input.nativeState;
  const ordinaryPending = !actionable && native?.observation === 'NEEDS_INTERNET'
    && native.read_only === true && native.native_clock_continuity === 'CONFIRMED'
    && native.protected_work_admission === 'PENDING' && native.pending_occurrences === true
    && native.rollback_fence_active === false;
  if (ordinaryPending && native.reason === 'original_finish_pending'
    && native.unfinished_occurrence === true && input.sessionState === 'open') {
    // The active-cleaning card already identifies the original same-tag Finish.
    return Object.freeze({ ...result, hidden: true, label: '', detail: '' });
  }
  if (ordinaryPending && native.reason === 'original_receipt_pending' && native.unfinished_occurrence === false) {
    return Object.freeze({ ...result, hidden: false, label: 'Saved work awaiting confirmation',
      detail: input.connected === false
        ? 'Saved on this phone. Automatic sync will continue when a connection is available.'
        : 'Saved on this phone. Automatic sync is waiting for confirmation.' });
  }
  // Missing/expired authority, changed identity or clock continuity still needs
  // verification. Merely having Wi-Fi does not resolve those native reasons.
  if (!actionable && input.nativeState?.observation === 'NEEDS_INTERNET') {
    return Object.freeze({ ...result, hidden: false, label: 'Work verification needed',
      detail: 'The phone must verify current permission before new cleaning. Saved work is retained.' });
  }
  return Object.freeze({ ...result, hidden: !actionable,
    label: actionable ? result.label : '', detail: actionable ? result.detail : '' });
}

// Read-only support breadcrumb. Only fixed vocabulary and booleans may leave
// the existing observation; never display identities, records or caller text.
export function readinessSupportCode(input = {}) {
  const security = input.security || {};
  const pick = (value, allowed) => allowed.includes(value) ? value : 'unknown';
  const flag = value => value === true ? '1' : value === false ? '0' : '?';
  const state = pick(security.state, ['checking', 'enrolled', 'unenrolled', 'unavailable', 'quarantined', 'removing']);
  const reason = pick(security.reason, ['', 'custodial_security_state_checking', 'custodial_security_state_unavailable',
    'custodial_browser_preservation_pending', 'custodial_browser_admission_unavailable',
    'custodial_secure_storage_unavailable', 'custodial_state_inspection_failed',
    'custodial_native_vault_blocked', 'custodial_enrollment_removal_pending',
    'installation_binding_missing', 'installation_binding_mismatch', 'device_identity_binding_incomplete',
    'preserved_state_without_protected_enrollment', 'server_credential_rejected']);
  const session = pick(input.sessionState, ['none', 'open', 'corrupted', 'ambiguous']);
  const native = pick(input.nativeState?.observation, ['CONFIRMED', 'NEEDS_INTERNET', 'NEEDS_MANAGER', 'DO_NOT_USE', 'UNKNOWN']);
  const queue = Array.isArray(input.queue) ? input.queue : null;
  const blocked = queue?.find(row => row && (row.dead_letter === true || row.recoverable === false
    || ['quarantined', 'dead-letter', 'legacy-quarantine'].includes(row.state)));
  const actionTypes = ['start_session', 'finish_session', 'complete_session', 'commit_workflow',
    'record_scan_event', 'ping_device', 'evaluate_location_proximity_v2', 'offline_start', 'offline_finish',
    'legacy-quarantine', 'forward-replay-fenced:legacy-quarantine'];
  const type = blocked ? pick(blocked.type, actionTypes) : 'none';
  const sync = pick(input.syncStatus, ['none', 'quarantined', 'recovery-paused', 'compatibility-paused', 'dead-letter',
    'connection-paused', 'security-paused', 'worker-error', 'retrying', 'queued', 'peer-update', 'idle', 'synced', 'startup-recovery-complete', 'receipt-retention-pending']);
  // Only fixed classifications leave the retained rows. In particular, neither
  // last_error nor the preserved original payload is rendered. Include every
  // held category (bounded), so a harmless first row cannot conceal a separate
  // completion hold. This observation does not retry or modify saved work.
  const held = queue?.filter(row => row && (row.dead_letter === true || row.recoverable === false
    || ['quarantined', 'dead-letter', 'legacy-quarantine'].includes(row.state))) || [];
  const schema = value => Number.isInteger(value) && value >= 0 && value <= 6 ? String(value) : 'unknown';
  const details = held.slice(0, 4).map(row => {
    const original = row.preserved_original_record;
    const originalType = original && typeof original === 'object'
      ? pick(typeof original.type === 'string' && original.type.startsWith('forward-replay-fenced:')
        ? original.type.slice('forward-replay-fenced:'.length) : original.type, actionTypes) : 'none';
    const error = [
      ['semantic_completion_mismatch_requires_explicit_resolution', 'semantic-conflict'],
      ['Historical standalone scan evidence has no exact occurrence and requires manager reconciliation.', 'scan-session-missing'],
      ['Queued start lacks exact v6 offline authority and requires manager reconciliation.', 'start-proof-missing'],
      ['Queued completion lacks exact native timestamp proof and requires manager reconciliation.', 'completion-proof-missing'],
    ].find(([message]) => row.last_error === message)?.[1] || (row.last_error ? 'other' : 'none');
    return `${pick(row.type, actionTypes)}/${pick(row.state, ['quarantined','dead-letter','legacy-quarantine'])}`
      + `/V${schema(row.source_schema_version ?? row.schema_version)}/O:${originalType}/C${flag(row.recoverable)}/X:${error}`;
  }).join(';');
  return `S1 ${state}/${reason || 'none'} I${flag(security.initialized)} R${flag(security.ready)} A${flag(security.available)} Q${flag(security.quarantined)} P${flag(input.principalPresent)} J:${session} N:${native} M${flag(input.managerRequired)} E${flag(input.enrollmentPending)} D${queue ? flag(Boolean(blocked)) : '?'} T:${type} Y:${sync}`
    + (held.length ? ` H:${Math.min(held.length, 99)} [${details}]` : '');
}

// Generation-bound observations prevent a late prior-principal/network response
// from promoting the current phone. Tokens are local presentation state only.
export function createReadinessObservation() {
  let generation = 0;
  let positive = null;
  return Object.freeze({
    invalidate() { generation += 1; positive = null; },
    token(principal) { return Object.freeze({ generation, principal }); },
    accept(token, principal, fields) {
      if (!principal || token.generation !== generation || token.principal !== principal) return false;
      positive = Object.freeze({ ...fields });
      return true;
    },
    read(token, principal) {
      return token.generation === generation && token.principal === principal ? positive : null;
    },
    current(token, principal) { return token.generation === generation && token.principal === principal; },
  });
}
