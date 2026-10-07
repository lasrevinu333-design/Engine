import { protectedPrincipal } from './protected-principal.js';

const keys = ['schema','canonical_device_id','principal_identity','snapshot_id','observed_boot_count','observed_elapsed_realtime_ms',
  'pending_occurrences','unfinished_occurrence','rollback_fence_active','observation','reason','native_clock_continuity','protected_work_admission','read_only'].sort();
const reasons = new Set(['observation_unavailable','request_invalid','native_enrollment_unavailable','principal_changed',
  'protected_work_recovery_required','observation_changed','principal_or_protected_state_changed','scan_journal_recovery_required',
  'rollback_fence_active','anchor_missing','snapshot_binding_unverified','snapshot_principal_changed','clock_observation_changed',
  'original_finish_pending','original_receipt_pending','native_scan_pending','current_native_snapshot_observed','anchor_expired',
  'clock_continuity_changed','clock_unavailable','protected_state_unavailable']);
const fail = () => { throw new Error('custodial_readiness_observation_invalid'); };
export function validateNativeReadinessObservation(value, deviceId, expectedIdentity) {
  let principal; try { principal = protectedPrincipal(JSON.parse(expectedIdentity)); } catch { fail(); }
  if (!principal || principal.device_id !== deviceId || !value || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== keys.join('|') || value.schema !== 'custodial.phone-readiness-observation.v1'
    || value.read_only !== true || !reasons.has(value.reason)
    || !['CONFIRMED','NEEDS_INTERNET','NEEDS_MANAGER','DO_NOT_USE','UNKNOWN'].includes(value.observation)
    || !['CONFIRMED','UNVERIFIED','EXPIRED'].includes(value.native_clock_continuity)
    || !['CLEAR','PENDING','RECOVERY_REQUIRED','UNKNOWN'].includes(value.protected_work_admission)) fail();
  if ((value.canonical_device_id !== null && value.canonical_device_id !== deviceId)
    || (value.principal_identity !== null && value.principal_identity !== expectedIdentity)
    || (value.snapshot_id !== null && !/^[a-f0-9]{64}$/.test(value.snapshot_id))) fail();
  for (const field of ['observed_boot_count','observed_elapsed_realtime_ms'])
    if (value[field] !== null && (!Number.isSafeInteger(value[field]) || value[field] < 0)) fail();
  for (const field of ['pending_occurrences','unfinished_occurrence','rollback_fence_active'])
    if (value[field] !== null && typeof value[field] !== 'boolean') fail();
  if (value.observation === 'CONFIRMED' && (value.reason !== 'current_native_snapshot_observed'
    || value.canonical_device_id !== deviceId || value.principal_identity !== expectedIdentity || value.snapshot_id === null
    || value.observed_boot_count === null || value.observed_elapsed_realtime_ms === null
    || value.pending_occurrences !== false || value.unfinished_occurrence !== false || value.rollback_fence_active !== false
    || value.native_clock_continuity !== 'CONFIRMED' || value.protected_work_admission !== 'CLEAR')) fail();
  return Object.freeze({ ...value });
}
