export const ENROLLMENT_CONFIRMATION_REQUIRED_CODE = 'device_enrollment_confirmation_required';
export const DEVICE_CREDENTIAL_REQUIRED_CODE = 'device_credential_required';
export const DEVICE_CREDENTIAL_RECOVERY_REQUIRED_CODE = 'device_credential_recovery_required';

/**
 * Only the canonical authentication middleware's exact missing/invalid
 * credential response may convert an enrolled phone into durable manager
 * recovery. Operational authorization failures (assignment, route, request
 * attestation, or policy) fail closed for that request without destroying the
 * phone's otherwise valid enrollment.
 */
export function credentialRecoveryReasonForResponse(status, payload) {
  const code = String(payload?.code || '').trim().toLowerCase();
  if (Number(status) !== 401) return '';
  return [DEVICE_CREDENTIAL_REQUIRED_CODE, DEVICE_CREDENTIAL_RECOVERY_REQUIRED_CODE].includes(code) ? code : '';
}

export function isEnrollmentConfirmationRequired(status, payload) {
  return Number(status) === 409
    && String(payload?.code || '') === ENROLLMENT_CONFIRMATION_REQUIRED_CODE;
}

/**
 * Reconcile the backend's fail-closed pre-confirmation response exactly once.
 * A valid local journal resumes its idempotent confirmation before one replay;
 * without that proof, the credential is quarantined instead of being polled.
 */
export async function reconcileEnrollmentConfirmationRequired({
  status,
  payload,
  pendingOperation,
  confirmationRetry = false,
  confirm,
  retry,
  requireManagerRecovery,
}) {
  if (!isEnrollmentConfirmationRequired(status, payload)) return { handled: false, response: null };
  if (
    confirmationRetry !== true
    && pendingOperation?.status === 'local_committed_pending_server_confirmation'
    && typeof confirm === 'function'
    && typeof retry === 'function'
  ) {
    await confirm();
    return { handled: true, response: await retry() };
  }
  if (typeof requireManagerRecovery === 'function') {
    await requireManagerRecovery(ENROLLMENT_CONFIRMATION_REQUIRED_CODE);
  }
  const error = new Error('The server requires enrollment confirmation, but this phone has no matching resumable enrollment journal.');
  error.code = ENROLLMENT_CONFIRMATION_REQUIRED_CODE;
  throw error;
}
