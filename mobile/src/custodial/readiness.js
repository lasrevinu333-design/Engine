// Presentation only. No credentials, wall-clock expiry inference, or work admission.
export function classifyReadiness(input = {}) {
  const { security = {}, queue, nativeState, sessionState } = input;
  const result = (state, label, detail) => Object.freeze({ state, label, detail });
  if (security.quarantined === true || input.integrityFailure === true || nativeState?.observation === 'DO_NOT_USE' || ['corrupted', 'ambiguous'].includes(sessionState)) {
    return result('do_not_use', 'Do not use', 'Protected phone or saved-work integrity needs a manager. Saved work is retained.');
  }
  if (security.initialized === true && security.available === false) {
    return result('do_not_use', 'Do not use', 'Protected phone security is unavailable. Ask a manager; saved work is retained.');
  }
  // A retained queue entry that is not a record cannot be interpreted safely.
  // Keep it visible as an integrity problem; never discard or rewrite the row.
  if (Array.isArray(queue) && queue.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    return result('do_not_use', 'Do not use', 'A saved-work record could not be read safely. Ask a manager; saved work is retained.');
  }
  if (input.managerRequired === true || input.enrollmentPending === true || input.authRejected === true
    || nativeState?.rollback_fence_active === true
    || nativeState?.observation === 'NEEDS_MANAGER' || nativeState?.protected_work_admission === 'RECOVERY_REQUIRED'
    || ['unenrolled', 'removing'].includes(security.state)
    || (Array.isArray(queue) && queue.some(row => row.dead_letter === true || row.recoverable === false || ['quarantined', 'dead-letter', 'legacy-quarantine'].includes(row.state)))) {
    return result('needs_manager', 'Needs manager', 'A manager must resolve assignment or protected-work recovery. Nothing has been erased.');
  }
  if ((Array.isArray(queue) && queue.length > 0) || nativeState?.pending_occurrences === true || nativeState?.unfinished_occurrence === true) {
    return result('needs_internet', 'Needs internet', 'Saved work is pending confirmation. Reconnect and let automatic sync finish; an open cleaning still uses the same tag to finish.');
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
    return Object.freeze({ state: 'needs_manager', hidden: false, label: 'Phone needs verification', detail: 'Ask a manager; saved work is retained.' });
  }
  const actionable = ['needs_manager', 'do_not_use'].includes(result.state);
  if (!actionable && input.localReadinessUnavailable === true) {
    return Object.freeze({ ...result, hidden: false, label: 'Saved work verification needed',
      detail: 'The phone could not check protected saved work. Do not reset it; ask a manager for help.' });
  }
  // This is an authoritative native work-verification constraint, not a
  // navigator/network-status observation. Retain a notice without blaming Wi-Fi.
  if (!actionable && input.nativeState?.observation === 'NEEDS_INTERNET') {
    return Object.freeze({ ...result, hidden: false, label: 'Work verification needed',
      detail: 'The phone must verify current permission before new cleaning. Saved work is retained; ask a manager for help.' });
  }
  return Object.freeze({ ...result, hidden: !actionable,
    label: actionable ? result.label : '', detail: actionable ? result.detail : '' });
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
