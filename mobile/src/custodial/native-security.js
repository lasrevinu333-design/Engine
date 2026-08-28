import { Capacitor } from '@capacitor/core';
import { CustodialNativeVault } from '@memphis-zoo/custodial-native-vault';
import {
  CUSTODIAL_CREDENTIAL_KEY,
  CUSTODIAL_DEVICE_KEYS,
  CUSTODIAL_ENROLLMENT_OPERATION_KEY,
  CUSTODIAL_INSTALLATION_MARKER_KEY,
  CUSTODIAL_INSTALLATION_RECORD_KEY,
  CUSTODIAL_INSTALLATION_SEAL_KEY,
  CUSTODIAL_RECOVERY_RECORD_KEY,
  CUSTODIAL_REMOVAL_COMPLETION_KEY,
  CUSTODIAL_REMOVAL_OPERATION_KEY,
  CUSTODIAL_RESTORE_QUARANTINE_KEY,
} from './security-keys.js';

export const CUSTODIAL_NATIVE_CREDENTIAL_HANDLE = 'custodial-native-vault:v1';

export function nativeCustodialHttpStatus(error) {
  const status = Number(error?.status ?? error?.data?.status ?? 0);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
}

const browserTestBuild = typeof __MZ_CUSTODIAL_BROWSER_TEST__ !== 'undefined'
  && __MZ_CUSTODIAL_BROWSER_TEST__ === true;

function platformName() {
  return String(Capacitor.getPlatform?.() || '').toLowerCase();
}

export function isCustodialNativeVaultPlatform() {
  return Capacitor.isNativePlatform?.() === true && platformName() === 'android';
}

function isLocalBrowserTestRuntime() {
  if (!browserTestBuild || typeof location === 'undefined') return false;
  return location.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(location.hostname);
}

function securityError(code, message = 'Protected Custodial device security is unavailable.') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function canonicalDeviceId(value) {
  const match = String(value || '').trim().match(/^KIOSK[_-]?(\d{1,2})$/i);
  const number = match ? Number(match[1]) : 0;
  return number >= 2 && number <= 10 ? `KIOSK_${String(number).padStart(2, '0')}` : '';
}

function normalizedOperationId(value) {
  const operationId = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(operationId)
    ? operationId
    : '';
}

function parsedInstallationRecord(value) {
  if (typeof value !== 'string' || !value.trim()) throw securityError('custodial_native_invalid_record');
  let record;
  try { record = JSON.parse(value); } catch { throw securityError('custodial_native_invalid_record'); }
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw securityError('custodial_native_invalid_record');
  }
  const allowed = new Set([
    'schema_version',
    'credential',
    'device_id',
    'installation_seal',
    'enrolled_at',
    'migrated_from_credential_only_state',
    'enrollment_operation_id',
  ]);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    throw securityError('custodial_native_invalid_record');
  }
  const deviceId = canonicalDeviceId(record.device_id);
  const operationId = normalizedOperationId(record.enrollment_operation_id);
  const seal = String(record.installation_seal || '').trim();
  const legacyMigration = record.migrated_from_credential_only_state === true;
  if (
    record.schema_version !== 1
    || record.credential !== CUSTODIAL_NATIVE_CREDENTIAL_HANDLE
    || !deviceId
    || (!operationId && !legacyMigration)
    || !/^[A-Za-z0-9._:-]{16,256}$/.test(seal)
  ) {
    throw securityError('custodial_native_invalid_record');
  }
  return {
    operation_id: operationId,
    device_id: deviceId,
    installation_seal: seal,
    enrolled_at: typeof record.enrolled_at === 'string' ? record.enrolled_at : null,
    migrated_from_credential_only_state: legacyMigration,
  };
}

function authoritativeInstallation(current, { operationId = '', deviceId = '' } = {}) {
  const value = current?.installation;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw securityError('custodial_native_binding_missing');
  }
  const authoritativeDevice = canonicalDeviceId(value.device_id);
  const authoritativeOperation = normalizedOperationId(value.enrollment_operation_id);
  const seal = String(value.installation_seal || '').trim();
  if (
    value.schema_version !== 1
    || !authoritativeDevice
    || !/^[A-Za-z0-9._:-]{16,256}$/.test(seal)
    || (deviceId && authoritativeDevice !== canonicalDeviceId(deviceId))
    || (operationId && authoritativeOperation !== normalizedOperationId(operationId))
  ) throw securityError('custodial_native_binding_mismatch');
  return {
    schema_version: 1,
    credential: CUSTODIAL_NATIVE_CREDENTIAL_HANDLE,
    device_id: authoritativeDevice,
    installation_seal: seal,
    enrolled_at: typeof value.enrolled_at === 'string' ? value.enrolled_at : new Date().toISOString(),
    migrated_from_credential_only_state: value.migrated_from_credential_only_state === true,
    enrollment_operation_id: authoritativeOperation || null,
  };
}

function rawStorageAdapter(storage) {
  return Object.freeze({
    getItem: storage.getItem.bind(storage),
    setItem: storage.setItem.bind(storage),
    removeItem: storage.removeItem.bind(storage),
  });
}

function readJson(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

function removalCompletionRecord(storage) {
  const raw = storage.getItem(CUSTODIAL_REMOVAL_COMPLETION_KEY);
  if (raw == null || String(raw).trim() === '') return null;
  const value = readJson(storage, CUSTODIAL_REMOVAL_COMPLETION_KEY);
  const allowed = new Set(['schema_version', 'operation_id', 'device_id', 'status', 'completed_at']);
  const timestamp = Date.parse(String(value?.completed_at || ''));
  const valid = (
    !value
    || Object.keys(value).some((key) => !allowed.has(key))
    || value.schema_version !== 1
    || !normalizedOperationId(value.operation_id)
    || !canonicalDeviceId(value.device_id)
    || value.status !== 'local_cleanup_complete'
    || !Number.isFinite(timestamp)
  ) === false;
  if (!valid) {
    // This local acknowledgement is never authority. Malformed content cannot
    // suppress an exact native replay; discard it so finalized native proof can
    // reconstruct the terminal journal.
    storage.removeItem(CUSTODIAL_REMOVAL_COMPLETION_KEY);
    return null;
  }
  return {
    ...value,
    operation_id: normalizedOperationId(value.operation_id),
    device_id: canonicalDeviceId(value.device_id),
  };
}

function terminalRemovalJournal(storage) {
  const value = readJson(storage, CUSTODIAL_REMOVAL_OPERATION_KEY);
  if (!value) return null;
  const operationId = normalizedOperationId(value.operation_id);
  const deviceId = canonicalDeviceId(value.device_id);
  if (value.schema_version !== 1 || !operationId || !deviceId || value.phase !== 'server_logged_out') {
    throw securityError('custodial_native_removal_reconciliation_mismatch');
  }
  return { ...value, operation_id: operationId, device_id: deviceId };
}

function localRemovalBindingsRemain(storage) {
  return CUSTODIAL_DEVICE_KEYS.some((key) => String(storage.getItem(key) || '').trim())
    || Boolean(String(storage.getItem(CUSTODIAL_INSTALLATION_MARKER_KEY) || '').trim())
    || Boolean(String(storage.getItem(CUSTODIAL_CREDENTIAL_KEY) || '').trim())
    || Boolean(String(storage.getItem(CUSTODIAL_RESTORE_QUARANTINE_KEY) || '').trim());
}

function removalSupersededEnrollmentJournal(storage) {
  const raw = storage.getItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY);
  return raw != null && String(raw).trim() !== '';
}

function recoveryProvesDevice(record, deviceId) {
  const candidates = [];
  for (const value of Object.values(record?.original_device_keys || {})) candidates.push(value);
  for (const identity of Array.isArray(record?.original_identities) ? record.original_identities : []) {
    if (identity?.canonical_device_id) candidates.push(identity.canonical_device_id);
    for (const value of Array.isArray(identity?.original_values) ? identity.original_values : []) {
      candidates.push(value);
    }
  }
  const normalized = candidates.map(canonicalDeviceId);
  return normalized.length > 0
    && normalized.every(Boolean)
    && new Set(normalized).size === 1
    && normalized[0] === deviceId;
}

function recoveryIdForNativeOperation(local, { existing, metadata, operationId, deviceId }) {
  const recovery = readJson(local, CUSTODIAL_RECOVERY_RECORD_KEY);
  const quarantine = readJson(local, CUSTODIAL_RESTORE_QUARANTINE_KEY);
  const recoveryId = String(recovery?.recovery_id || '').trim();
  const nativeRecoveryId = String(metadata?.recovery_id || '').trim();
  const journalRecoveryId = String(existing?.recovery_id || '').trim();
  if (
    !recoveryId
    || recovery?.schema_version !== 1
    || !['pending_manager_recovery', 'resolved'].includes(recovery?.status)
    || !recoveryProvesDevice(recovery, deviceId)
    || (nativeRecoveryId && nativeRecoveryId !== recoveryId)
    || (journalRecoveryId && journalRecoveryId !== recoveryId)
  ) throw securityError('custodial_native_recovery_reconciliation_mismatch');
  if (recovery.status === 'pending_manager_recovery' && (
    !quarantine
    || quarantine.schema_version !== 1
    || quarantine.active !== true
    || quarantine.recovery_id !== recoveryId
  )) throw securityError('custodial_native_recovery_reconciliation_mismatch');
  if (recovery.status === 'resolved' && (
    canonicalDeviceId(recovery.resolved_device_id) !== deviceId
    || normalizedOperationId(recovery.resolution?.enrollment_operation_id) !== operationId
    || recovery.resolution?.method !== 'resumable_manager_code'
  )) {
    throw securityError('custodial_native_recovery_reconciliation_mismatch');
  }
  if (quarantine && (quarantine.schema_version !== 1 || quarantine.recovery_id !== recoveryId)) {
    throw securityError('custodial_native_recovery_reconciliation_mismatch');
  }
  return recoveryId;
}

function preparedRecoveryDisposition(local, existing, { activeOperationId, activeDeviceId }) {
  if (
    !existing
    || existing.status !== 'pending_server'
    || existing.flow !== 'recovery'
    || normalizedOperationId(existing.operation_id) === activeOperationId
    || canonicalDeviceId(existing.device_id) !== activeDeviceId
  ) return '';
  const recovery = readJson(local, CUSTODIAL_RECOVERY_RECORD_KEY);
  const quarantine = readJson(local, CUSTODIAL_RESTORE_QUARANTINE_KEY);
  const recoveryId = String(existing.recovery_id || '').trim();
  if (
    !recoveryId
    || recovery?.schema_version !== 1
    || String(recovery.recovery_id || '').trim() !== recoveryId
    || !recoveryProvesDevice(recovery, activeDeviceId)
  ) return '';
  if (
    recovery.status === 'pending_manager_recovery'
    && quarantine?.schema_version === 1
    && quarantine.active === true
    && String(quarantine.recovery_id || '').trim() === recoveryId
    && String(quarantine.reason || '').trim() === String(recovery.reason || '').trim()
    && String(quarantine.created_at || '').trim() === String(recovery.created_at || '').trim()
    && recoveryProvesDevice(quarantine, activeDeviceId)
  ) return 'preserve';
  if (
    recovery.status === 'resolved'
    && !quarantine
    && canonicalDeviceId(recovery.resolved_device_id) === activeDeviceId
    && recovery.resolution?.method === 'current_native_credential_revalidated'
    && recovery.resolution?.preserved_work_retained === true
  ) return 'retire';
  return '';
}

function recoveryResolutionForNativeCommit(local, { operation, operationId, deviceId, flow, now }) {
  const recovery = readJson(local, CUSTODIAL_RECOVERY_RECORD_KEY);
  const quarantine = readJson(local, CUSTODIAL_RESTORE_QUARANTINE_KEY);
  const recoveringPhone = flow === 'recovery';
  const repairingFailedCommit = flow === 'enrollment'
    && quarantine?.reason === 'enrollment_commit_rollback_failed';
  if (!recoveringPhone && !repairingFailedCommit) return null;
  if (
    !operation
    || !recovery
    || recovery.schema_version !== 1
    || !String(recovery.recovery_id || '').trim()
    || (recoveringPhone && !recoveryProvesDevice(recovery, deviceId))
  ) throw securityError('custodial_native_recovery_reconciliation_mismatch');
  if (
    recoveringPhone
    && String(operation.recovery_id || '') !== String(recovery.recovery_id)
  ) throw securityError('custodial_native_recovery_reconciliation_mismatch');
  if (
    quarantine
    && (
      quarantine.active !== true
      || quarantine.recovery_id !== recovery.recovery_id
      || (repairingFailedCommit && quarantine.reason !== 'enrollment_commit_rollback_failed')
    )
  ) throw securityError('custodial_native_recovery_reconciliation_mismatch');
  const method = recoveringPhone
    ? 'resumable_manager_code'
    : 'resumed_enrollment_after_local_commit_failure';
  if (recovery.status === 'resolved') {
    if (
      canonicalDeviceId(recovery.resolved_device_id) !== deviceId
      || recovery.resolution?.enrollment_operation_id !== operationId
      || recovery.resolution?.method !== method
    ) throw securityError('custodial_native_recovery_reconciliation_mismatch');
    return recovery;
  }
  if (recovery.status !== 'pending_manager_recovery' || !quarantine) {
    throw securityError('custodial_native_recovery_reconciliation_mismatch');
  }
  return {
    ...recovery,
    status: 'resolved',
    resolved_at: now,
    resolved_device_id: deviceId,
    resolution: {
      method,
      enrollment_operation_id: operationId,
      preserved_work_retained: true,
    },
  };
}

function createBrowserTestProtectedStorage(storage) {
  if (!isLocalBrowserTestRuntime()) {
    throw securityError('custodial_native_vault_required');
  }
  const prefixed = (key) => `capacitor-storage_${String(key)}`;
  return Object.freeze({
    async get(key) {
      const raw = storage.getItem(prefixed(key));
      if (raw == null) return null;
      return JSON.parse(raw);
    },
    async set(key, value) {
      storage.setItem(prefixed(key), JSON.stringify(value));
    },
    async remove(key) {
      const name = prefixed(key);
      const present = storage.getItem(name) !== null;
      storage.removeItem(name);
      return present;
    },
    async finalizeRemoval() {
      // The browser implementation exists only in the explicitly compiled
      // localhost test build. Keep its ordering compatible with the native
      // adapter so the credential-store state machine exercises finalize-last.
      for (const key of [
        CUSTODIAL_INSTALLATION_RECORD_KEY,
        CUSTODIAL_CREDENTIAL_KEY,
        CUSTODIAL_INSTALLATION_SEAL_KEY,
      ]) storage.removeItem(prefixed(key));
      return true;
    },
  });
}

export function createNativeProtectedStorage(plugin, webStorage) {
  const local = rawStorageAdapter(webStorage);
  async function state() {
    const result = await plugin.getState();
    if (!result || typeof result !== 'object' || result.blocked === true) {
      throw securityError('custodial_native_vault_blocked');
    }
    return result;
  }
  return Object.freeze({
    async reconcileLocalState() {
      const current = await state();
      const phase = String(current.state || '').toUpperCase();
      const removalView = current.removal && typeof current.removal === 'object' ? current.removal : {};
      const removalOperationId = normalizedOperationId(
        removalView.operation_id || current.removal_operation_id,
      );
      const removalDeviceId = canonicalDeviceId(removalView.device_id || current.removal_device_id);
      let removalCompletion = removalCompletionRecord(local);
      if (removalCompletion && current.removal_finalized !== true) {
        if (current.removal_pending === true) {
          if (removalCompletion.operation_id === removalOperationId) {
            throw securityError('custodial_native_removal_completion_mismatch');
          }
          // A completed older removal may coexist with the exact journal for a
          // newer removal. Preserve it until the newer native finalization is
          // ready to overwrite the acknowledgement.
        } else {
          // Native has durably left the prior finalized EMPTY proof (normally
          // because a new enrollment began), so its local completion history is
          // no longer needed.
          local.removeItem(CUSTODIAL_REMOVAL_COMPLETION_KEY);
          removalCompletion = null;
        }
      }
      if (current.enrollment_terminal === true || phase === 'CANCELLED') {
        const cancelled = current.cancelled_enrollment && typeof current.cancelled_enrollment === 'object'
          ? current.cancelled_enrollment
          : {};
        const cancelledOperationId = normalizedOperationId(
          cancelled.operation_id || current.cancelled_operation_id,
        );
        const cancelledDeviceId = canonicalDeviceId(
          cancelled.device_id || current.cancelled_device_id,
        );
        const cancelledFlow = String(cancelled.flow || '').trim();
        if (
          !cancelledOperationId
          || !cancelledDeviceId
          || !['enrollment', 'recovery'].includes(cancelledFlow)
          || (cancelled.status && cancelled.status !== 'cancelled')
        ) throw securityError('custodial_native_cancelled_operation_invalid');
        const localOperationRaw = local.getItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY);
        const localOperationPresent = localOperationRaw != null && String(localOperationRaw).trim() !== '';
        const localOperation = readJson(local, CUSTODIAL_ENROLLMENT_OPERATION_KEY);
        if (localOperationPresent) {
          if (localOperation && (
            localOperation.operation_id !== cancelledOperationId
            || canonicalDeviceId(localOperation.device_id) !== cancelledDeviceId
            || localOperation.flow !== cancelledFlow
            || localOperation.status !== 'pending_server'
          )) throw securityError('custodial_native_cancelled_operation_mismatch');
          local.removeItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY);
        }
      }
      const operationId = normalizedOperationId(current.pending_operation_id);
      const deviceId = canonicalDeviceId(current.pending_device_id);
      const flow = String(current.pending_flow || '').trim();
      if (
        operationId
        && deviceId
        && ['enrollment', 'recovery'].includes(flow)
        && ['ENROLLMENT_REQUESTED', 'ENROLLMENT_DISPATCHED', 'CREDENTIAL_STAGED', 'PENDING_SERVER_CONFIRMATION', 'CANCEL_REQUESTED'].includes(phase)
      ) {
        const existing = readJson(local, CUSTODIAL_ENROLLMENT_OPERATION_KEY);
        if (existing?.operation_id && existing.operation_id !== operationId) {
          throw securityError('custodial_native_operation_reconciliation_mismatch');
        }
        const installation = current.installation
          ? authoritativeInstallation(current, { operationId, deviceId })
          : null;
        const metadata = current.pending_enrollment && typeof current.pending_enrollment === 'object'
          ? current.pending_enrollment
          : {};
        const now = new Date().toISOString();
        const locallyCommitted = phase === 'PENDING_SERVER_CONFIRMATION';
        const recoveryId = flow === 'recovery'
          ? recoveryIdForNativeOperation(local, {
              existing, metadata, operationId, deviceId,
            })
          : (existing?.recovery_id || null);
        const journal = {
          schema_version: 1,
          operation_id: operationId,
          flow,
          device_id: deviceId,
          recovery_id: recoveryId,
          status: locallyCommitted ? 'local_committed_pending_server_confirmation' : 'pending_server',
          created_at: existing?.created_at || installation?.enrolled_at || now,
          server_result_received_at: locallyCommitted ? (existing?.server_result_received_at || now) : null,
          local_committed_at: locallyCommitted ? (existing?.local_committed_at || now) : null,
          resume_expires_at: String(metadata.resume_expires_at || existing?.resume_expires_at || '') || null,
          credential_id: String(metadata.credential_id || existing?.credential_id || '') || null,
        };
        const resolvedRecovery = locallyCommitted
          ? recoveryResolutionForNativeCommit(local, {
              operation: journal,
              operationId,
              deviceId,
              flow,
              now,
            })
          : null;
        if (locallyCommitted) {
          if (!installation) throw securityError('custodial_native_binding_missing');
          for (const key of CUSTODIAL_DEVICE_KEYS) local.setItem(key, installation.device_id);
          local.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY, installation.installation_seal);
        }
        local.setItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY, JSON.stringify(journal));
        if (resolvedRecovery) {
          local.setItem(CUSTODIAL_RECOVERY_RECORD_KEY, JSON.stringify(resolvedRecovery));
          const quarantine = readJson(local, CUSTODIAL_RESTORE_QUARANTINE_KEY);
          if (quarantine?.recovery_id === resolvedRecovery.recovery_id) {
            local.removeItem(CUSTODIAL_RESTORE_QUARANTINE_KEY);
          }
        }
      }
      if (phase === 'ACTIVE') {
        const installation = authoritativeInstallation(current);
        const activeOperationId = normalizedOperationId(installation.enrollment_operation_id);
        const activeDeviceId = canonicalDeviceId(installation.device_id);
        const activeFlow = String(current.active_enrollment_flow || '').trim();
        const existingRaw = local.getItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY);
        let existingPresent = existingRaw != null && String(existingRaw).trim() !== '';
        let existing = readJson(local, CUSTODIAL_ENROLLMENT_OPERATION_KEY);
        const preparedRecovery = preparedRecoveryDisposition(local, existing, {
          activeOperationId,
          activeDeviceId,
        });
        if (preparedRecovery === 'retire') {
          // The native status request proved that the still-active credential
          // is current. A local recovery intent written before any native call
          // therefore has no remote or vault effect and can be retired exactly.
          local.removeItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY);
          for (const key of CUSTODIAL_DEVICE_KEYS) local.setItem(key, activeDeviceId);
          local.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY, installation.installation_seal);
          return current;
        }
        if (preparedRecovery === 'preserve') {
          // The compatibility journal is intentionally durable before the
          // first native recovery call. Process death in that narrow window may
          // coexist with the prior ACTIVE native binding. Preserve both until
          // native revalidation accepts or rejects that prior credential.
          for (const key of CUSTODIAL_DEVICE_KEYS) local.setItem(key, activeDeviceId);
          local.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY, installation.installation_seal);
        } else {
          const reconcilable = activeOperationId
            && activeDeviceId
            && ['enrollment', 'recovery'].includes(activeFlow);
          if (existingPresent && !reconcilable) {
            throw securityError('custodial_native_active_reconciliation_mismatch');
          }
          if (!reconcilable) return current;
          if (existing && (
            existing.operation_id !== activeOperationId
            || canonicalDeviceId(existing.device_id) !== activeDeviceId
            || existing.flow !== activeFlow
            || !['pending_server', 'local_committed_pending_server_confirmation'].includes(existing.status)
          )) throw securityError('custodial_native_active_reconciliation_mismatch');
          const recovery = readJson(local, CUSTODIAL_RECOVERY_RECORD_KEY);
          const operation = existing || {
            schema_version: 1,
            operation_id: activeOperationId,
            flow: activeFlow,
            device_id: activeDeviceId,
            recovery_id: activeFlow === 'recovery' ? String(recovery?.recovery_id || '') : null,
            status: 'pending_server',
            created_at: installation.enrolled_at,
          };
          // A same-origin caller can invoke Capacitor methods directly and can
          // mutate Web Storage from another realm. If it confirms the exact
          // native operation before (or after deleting) the compatibility
          // journal, ACTIVE remains authoritative. Heal only the native
          // operation/device/flow; recovery additionally requires its preserved
          // recovery/quarantine proof. A present journal is deleted last.
          const now = new Date().toISOString();
          const resolvedRecovery = recoveryResolutionForNativeCommit(local, {
            operation,
            operationId: activeOperationId,
            deviceId: activeDeviceId,
            flow: activeFlow,
            now,
          });
          for (const key of CUSTODIAL_DEVICE_KEYS) local.setItem(key, activeDeviceId);
          local.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY, installation.installation_seal);
          if (resolvedRecovery) {
            local.setItem(CUSTODIAL_RECOVERY_RECORD_KEY, JSON.stringify(resolvedRecovery));
            const quarantine = readJson(local, CUSTODIAL_RESTORE_QUARANTINE_KEY);
            if (quarantine?.recovery_id === resolvedRecovery.recovery_id) {
              local.removeItem(CUSTODIAL_RESTORE_QUARANTINE_KEY);
            }
          }
          if (existingPresent) local.removeItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY);
        }
      }
      if (current.removal_pending === true || current.removal_finalized === true) {
        if (!removalOperationId || !removalDeviceId) {
          throw securityError('custodial_native_removal_reconciliation_mismatch');
        }
        const supersededEnrollment = removalSupersededEnrollmentJournal(local);
        if (supersededEnrollment) {
          // Native removal is authoritative and has already revoked (or is
          // atomically revoking) this device credential. An enrollment journal
          // left by a direct WebView confirm can no longer be confirmed and
          // must not deadlock terminal removal. Native has no credential secret
          // after the remote tombstone, so no untrusted or corrupt Web Storage
          // journal may retain or resurrect it. Preserved offline work remains
          // independently protected by the credential-store queue inspection.
          local.removeItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY);
        }
      }
      if (current.removal_finalized === true) {
        if (!removalOperationId || !removalDeviceId || phase !== 'EMPTY') {
          throw securityError('custodial_native_removal_reconciliation_mismatch');
        }
        const removal = terminalRemovalJournal(local);
        if (removal && (
          removal.operation_id !== removalOperationId
          || removal.device_id !== removalDeviceId
        )) throw securityError('custodial_native_removal_reconciliation_mismatch');
        const completionMatches = removalCompletion
          && removalCompletion.operation_id === removalOperationId
          && removalCompletion.device_id === removalDeviceId;
        if (removalCompletion && !completionMatches && !removal) {
          throw securityError('custodial_native_removal_completion_mismatch');
        }
        if (!removal && (!completionMatches || localRemovalBindingsRemain(local))) {
          const now = new Date().toISOString();
          local.setItem(CUSTODIAL_REMOVAL_OPERATION_KEY, JSON.stringify({
            schema_version: 1,
            operation_id: removalOperationId,
            device_id: removalDeviceId,
            phase: 'server_logged_out',
            created_at: removalCompletion?.completed_at || now,
            updated_at: now,
          }));
        }
      }
      if (current.removal_pending === true && removalOperationId && removalDeviceId) {
        const removal = readJson(local, CUSTODIAL_REMOVAL_OPERATION_KEY);
        if (removal && (
          normalizedOperationId(removal.operation_id) !== removalOperationId
          || canonicalDeviceId(removal.device_id) !== removalDeviceId
        )) {
          throw securityError('custodial_native_removal_reconciliation_mismatch');
        }
        const now = new Date().toISOString();
        local.setItem(CUSTODIAL_REMOVAL_OPERATION_KEY, JSON.stringify({
          schema_version: 1,
          operation_id: removalOperationId,
          device_id: removalDeviceId,
          phase: removalView.remote_complete === true || current.removal_remote_complete === true
            ? 'server_logged_out'
            : 'pending_server_removal',
          created_at: removal?.created_at || now,
          updated_at: now,
        }));
      }
      return current;
    },
    async get(key) {
      const current = await state();
      if (key === CUSTODIAL_INSTALLATION_RECORD_KEY) {
        const phase = String(current.state || '').toUpperCase();
        if (!['PENDING_SERVER_CONFIRMATION', 'ACTIVE', 'REMOVAL_REQUESTED'].includes(phase)) return null;
        if (!current.installation || typeof current.installation !== 'object') return null;
        return JSON.stringify(authoritativeInstallation(current));
      }
      if (key === CUSTODIAL_CREDENTIAL_KEY) {
        return current.legacy_pending === true && current.credential_present === true
          ? CUSTODIAL_NATIVE_CREDENTIAL_HANDLE
          : null;
      }
      if (key === CUSTODIAL_INSTALLATION_SEAL_KEY) {
        return current.legacy_pending === true ? String(current.legacy_seal || '') : null;
      }
      return null;
    },
    async set(key, value) {
      if (key === CUSTODIAL_INSTALLATION_RECORD_KEY) {
        const binding = parsedInstallationRecord(value);
        let committed;
        if (binding.migrated_from_credential_only_state && !binding.operation_id) {
          committed = await plugin.completeLegacyBinding({ device_id: binding.device_id });
        } else {
          const staged = await state();
          authoritativeInstallation(staged, {
            operationId: binding.operation_id,
            deviceId: binding.device_id,
          });
          committed = await plugin.completeLocalBinding({ operation_id: binding.operation_id });
        }
        return JSON.stringify(authoritativeInstallation(committed, {
          operationId: binding.operation_id,
          deviceId: binding.device_id,
        }));
      }
      const current = await state();
      if (key === CUSTODIAL_CREDENTIAL_KEY) {
        if (
          value !== CUSTODIAL_NATIVE_CREDENTIAL_HANDLE
          || current.credential_present !== true
          || current.legacy_pending !== true
        ) throw securityError('custodial_native_plaintext_credential_refused');
        return;
      }
      if (key === CUSTODIAL_INSTALLATION_SEAL_KEY) {
        if (String(value || '') !== String(current.legacy_seal || '')) {
          throw securityError('custodial_native_legacy_binding_mismatch');
        }
        return;
      }
      throw securityError('custodial_native_invalid_slot');
    },
    async remove(key) {
      if (key === CUSTODIAL_INSTALLATION_RECORD_KEY) {
        // A failed Web Storage compatibility commit must not erase a server-side
        // credential that was already consumed and staged natively. Native
        // removal is an explicit, operation-bound transition performed only
        // after all reversible local cleanup succeeds.
        return true;
      }
      if (key === CUSTODIAL_CREDENTIAL_KEY || key === CUSTODIAL_INSTALLATION_SEAL_KEY) {
        // completeLegacyBinding retires the legacy native state in the same
        // authoritative transaction. These generic-store cleanup calls are
        // compatibility no-ops and must not widen the WebView mutation API.
        return true;
      }
      return false;
    },
    async finalizeRemoval(operationId, deviceId = '') {
      const requestedOperation = normalizedOperationId(operationId);
      const requestedDevice = canonicalDeviceId(deviceId);
      if (!requestedOperation || (deviceId && !requestedDevice)) {
        throw securityError('custodial_native_removal_identity_missing');
      }
      const before = await state();
      const beforeView = before.removal && typeof before.removal === 'object' ? before.removal : {};
      const nativeOperation = normalizedOperationId(
        beforeView.operation_id || before.removal_operation_id,
      );
      const nativeDevice = canonicalDeviceId(beforeView.device_id || before.removal_device_id);
      if (
        nativeOperation !== requestedOperation
        || (requestedDevice && nativeDevice !== requestedDevice)
        || before.removal_remote_complete !== true
      ) throw securityError('custodial_native_removal_not_complete');

      const finalized = await plugin.finalizeRemoval({ operation_id: requestedOperation });
      const finalizedView = finalized?.removal && typeof finalized.removal === 'object'
        ? finalized.removal
        : {};
      if (
        String(finalized?.state || '').toUpperCase() !== 'EMPTY'
        || finalized?.removal_finalized !== true
        || finalized?.credential_present !== false
        || normalizedOperationId(finalizedView.operation_id || finalized?.removal_operation_id) !== requestedOperation
        || canonicalDeviceId(finalizedView.device_id || finalized?.removal_device_id) !== nativeDevice
      ) throw securityError('custodial_native_removal_finalization_invalid');
      return true;
    },
  });
}

let protectedStorage = null;

export function getCustodialProtectedStorage({
  plugin = CustodialNativeVault,
  storage = globalThis.localStorage,
} = {}) {
  if (!protectedStorage) {
    protectedStorage = isCustodialNativeVaultPlatform()
      ? createNativeProtectedStorage(plugin, storage)
      : createBrowserTestProtectedStorage(storage);
  }
  return protectedStorage;
}

function bytesToBase64(bytes) {
  let binary = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let index = 0; index < view.length; index += 0x8000) {
    binary += String.fromCharCode(...view.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function responseFromNative(result, method = 'GET') {
  const status = Number(result?.status || 0);
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    throw securityError('custodial_native_invalid_response');
  }
  const headers = new Headers(result?.headers || {});
  const noBody = method === 'HEAD' || status === 204 || status === 205 || status === 304;
  return new Response(noBody ? null : base64ToBytes(result?.body_base64), { status, headers });
}

async function abortableNativeCall(start, signal) {
  if (typeof start !== 'function') throw securityError('custodial_native_invalid_operation');
  if (!signal) return start();
  if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  let rejectAbort;
  const aborted = new Promise((_resolve, reject) => { rejectAbort = reject; });
  const onAbort = () => rejectAbort(new DOMException('The operation was aborted.', 'AbortError'));
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    return await Promise.race([Promise.resolve().then(start), aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

function sanitizedHeaders(input) {
  const headers = new Headers(input || {});
  for (const name of [
    'Authorization',
    'X-Device-Credential',
    'X-Memphis-Device-Credential',
    'X-Device-Id',
    'X-Memphis-App-Edition',
    'X-Memphis-Native-Attestation-Version',
    'X-Memphis-Native-Request-Id',
    'X-Memphis-Native-Request-Timestamp',
    'X-Memphis-Native-Request-Attestation',
  ]) headers.delete(name);
  return Object.fromEntries(headers.entries());
}

export async function nativeCustodialAuthorizedFetch({ input, init = {}, resolvedUrl, deviceId }) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  const url = resolvedUrl instanceof URL ? resolvedUrl : new URL(String(input), globalThis.location?.href);
  const request = input instanceof Request
    ? new Request(input, init)
    : new Request(url.toString(), init);
  const method = request.method.toUpperCase();
  const body = ['GET', 'HEAD'].includes(method) ? new Uint8Array() : new Uint8Array(await request.clone().arrayBuffer());
  const canonicalId = canonicalDeviceId(deviceId);
  if (!canonicalId) throw securityError('custodial_native_device_identity_missing');
  const result = await abortableNativeCall(() => CustodialNativeVault.authorizedRequest({
    path: `${url.pathname}${url.search}`,
    method,
    device_id: canonicalId,
    headers: sanitizedHeaders(request.headers),
    body_base64: bytesToBase64(body),
  }), request.signal);
  return responseFromNative(result, method);
}

export async function reportNativeCustodialRecoveryDiagnostic({
  reason = '', outcome = 'not_attempted', detail = 'no_additional_detail',
} = {}) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  if (typeof CustodialNativeVault.reportRecoveryDiagnostic !== 'function') {
    throw securityError('custodial_recovery_diagnostic_capability_missing');
  }
  return CustodialNativeVault.reportRecoveryDiagnostic({
    reason: String(reason || ''),
    outcome: String(outcome || 'not_attempted'),
    detail: String(detail || 'no_additional_detail'),
  });
}

export async function getNativeCustodialVaultState() {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  const state = await CustodialNativeVault.getState();
  if (!state || typeof state !== 'object' || state.blocked === true) {
    throw securityError('custodial_native_vault_blocked');
  }
  return state;
}

export async function nativeCustodialEnroll({ deviceId, managerCode, operationId, flow }) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.enroll({
    device_id: canonicalDeviceId(deviceId),
    enrollment_code: String(managerCode || ''),
    operation_id: normalizedOperationId(operationId),
    flow: String(flow || ''),
  });
}

export async function resumeNativeCustodialEnrollment(operationId) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.resumeEnrollment({ operation_id: normalizedOperationId(operationId) });
}

export async function confirmNativeCustodialEnrollment(operationId) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.confirmEnrollment({ operation_id: normalizedOperationId(operationId) });
}

export async function cancelNativeCustodialEnrollment(operationId) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.cancelEnrollment({ operation_id: normalizedOperationId(operationId) });
}

export async function attestNativeCustodialScanIntent(url) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.attestScanIntent({ url: String(url || '') });
}

export async function recoverNativeCustodialPendingScanIntent() {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.recoverPendingScanIntent();
}

export async function reportNativeCustodialNfcTransitionDiagnostic(stage, outcome) {
  if (!isCustodialNativeVaultPlatform()) return { reported: false };
  try {
    return await CustodialNativeVault.reportNfcTransitionDiagnostic({
      stage: String(stage || ''),
      outcome: String(outcome || ''),
    });
  } catch {
    return { reported: false };
  }
}

export async function attestNativeCustodialOfflineStart({
  deviceId, locationCode, clientSessionId, snapshotId, snapshotEmployeeId, snapshotAssignmentEpoch, snapshotCredentialId, nativeScanEntryId,
  originalNativeStartAttestationVersion = '', originalNativeStartAttestation = '',
}) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.attestOfflineStart({
    device_id: canonicalDeviceId(deviceId),
    location_code: String(locationCode || ''),
    client_session_id: String(clientSessionId || ''),
    snapshot_id: String(snapshotId || ''),
    snapshot_employee_id: String(snapshotEmployeeId || ''),
    snapshot_assignment_epoch: Number(snapshotAssignmentEpoch),
    snapshot_credential_id: String(snapshotCredentialId || ''),
    entry_id: String(nativeScanEntryId || ''),
    original_native_start_attestation_version: String(originalNativeStartAttestationVersion || ''),
    original_native_start_attestation: String(originalNativeStartAttestation || ''),
  });
}

export async function acknowledgeNativeCustodialOfflineCompletion({
  deviceId, locationCode, clientSessionId, nativeFinishScanEntryId, clientStartedAt, clientEndedAt,
}) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.acknowledgeOfflineCompletion({
    device_id: canonicalDeviceId(deviceId),
    location_code: String(locationCode || ''),
    client_session_id: String(clientSessionId || ''),
    native_finish_scan_entry_id: String(nativeFinishScanEntryId || ''),
    client_started_at: String(clientStartedAt || ''),
    client_ended_at: String(clientEndedAt || ''),
  });
}

export async function attestNativeCustodialOfflineCompletion({
  deviceId, locationCode, clientSessionId, clientCompletionId, contextId, nativeFinishScanEntryId, clientStartedAt,
  originalNativeCompletionAttestationVersion = '', originalNativeCompletionAttestation = '',
}) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.attestOfflineCompletion({
    device_id: canonicalDeviceId(deviceId),
    location_code: String(locationCode || ''),
    client_session_id: String(clientSessionId || ''),
    client_completion_id: String(clientCompletionId || ''),
    context_id: String(contextId || ''),
    native_finish_scan_entry_id: String(nativeFinishScanEntryId || ''),
    client_started_at: String(clientStartedAt || ''),
    original_native_completion_attestation_version: String(originalNativeCompletionAttestationVersion || ''),
    original_native_completion_attestation: String(originalNativeCompletionAttestation || ''),
  });
}

export async function captureNativeCustodialOfflineCompletionTime({
  deviceId, locationCode, clientSessionId, nativeFinishScanEntryId, clientStartedAt,
}) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.captureOfflineCompletionTime({
    device_id: canonicalDeviceId(deviceId),
    location_code: String(locationCode || ''),
    client_session_id: String(clientSessionId || ''),
    native_finish_scan_entry_id: String(nativeFinishScanEntryId || ''),
    client_started_at: String(clientStartedAt || ''),
  });
}

export async function anchorNativeCustodialOfflineAuthoritySnapshot({
  deviceId, snapshotId, generatedAt, expiresAt, snapshot,
}) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.anchorOfflineAuthoritySnapshot({
    device_id: canonicalDeviceId(deviceId),
    snapshot_id: String(snapshotId || ''),
    generated_at: String(generatedAt || ''),
    expires_at: String(expiresAt || ''),
    snapshot: snapshot && typeof snapshot === 'object' ? snapshot : null,
  });
}

export async function loadNativeCustodialOfflineAuthoritySnapshot(deviceId) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  if (typeof CustodialNativeVault.loadOfflineAuthoritySnapshot !== 'function') {
    throw securityError('custodial_offline_authority_capability_missing', 'This phone needs the current protected offline-authority update before starting new work.');
  }
  return CustodialNativeVault.loadOfflineAuthoritySnapshot({ device_id: canonicalDeviceId(deviceId) });
}

export async function authorizeNativeCustodialOfflineNewWork(deviceId, snapshotId) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  if (typeof CustodialNativeVault.authorizeOfflineNewWork !== 'function') {
    throw securityError('custodial_offline_authority_capability_missing', 'This phone needs the current protected offline-authority update before starting new work.');
  }
  return CustodialNativeVault.authorizeOfflineNewWork({
    device_id: canonicalDeviceId(deviceId),
    snapshot_id: String(snapshotId || ''),
  });
}

export async function getNativeCustodialOfflineAuthorityState(deviceId) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  if (typeof CustodialNativeVault.getOfflineAuthorityState !== 'function') {
    throw securityError('custodial_offline_authority_capability_missing', 'This phone needs the current rollback-readiness update.');
  }
  return CustodialNativeVault.getOfflineAuthorityState({ device_id: canonicalDeviceId(deviceId) });
}

export async function beginNativeCustodialRollbackFence(deviceId) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  if (typeof CustodialNativeVault.beginRollbackFence !== 'function') {
    throw securityError('custodial_rollback_fence_capability_missing', 'This phone needs the current rollback-fence update.');
  }
  return CustodialNativeVault.beginRollbackFence({ device_id: canonicalDeviceId(deviceId) });
}

export async function clearNativeCustodialRollbackFence(deviceId, rollbackFenceId) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  if (typeof CustodialNativeVault.clearRollbackFence !== 'function') {
    throw securityError('custodial_rollback_fence_capability_missing', 'This phone needs the current rollback-fence update.');
  }
  return CustodialNativeVault.clearRollbackFence({
    device_id: canonicalDeviceId(deviceId),
    rollback_fence_id: String(rollbackFenceId || ''),
  });
}

export async function verifyNativeCustodialScanEntry(entryId) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.verifyScanEntry({ entry_id: String(entryId || '') });
}

export async function bindNativeCustodialScanEntry(entryId, clientSessionId, locationCode, action, deviceId) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.bindScanEntry({
    entry_id: String(entryId || ''),
    client_session_id: String(clientSessionId || ''),
    location_code: String(locationCode || ''),
    action: String(action || ''),
    device_id: canonicalDeviceId(deviceId),
  });
}

export async function consumeNativeCustodialScanEntry(entryId, clientSessionId, locationCode, action, deviceId) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.consumeScanEntry({
    entry_id: String(entryId || ''),
    client_session_id: String(clientSessionId || ''),
    location_code: String(locationCode || ''),
    action: String(action || ''),
    device_id: canonicalDeviceId(deviceId),
  });
}

export async function nativeCustodialRemoveEnrollment({ operationId, deviceId }) {
  if (!isCustodialNativeVaultPlatform()) throw securityError('custodial_native_vault_required');
  return CustodialNativeVault.removeEnrollment({
    operation_id: normalizedOperationId(operationId),
    device_id: canonicalDeviceId(deviceId),
  });
}
