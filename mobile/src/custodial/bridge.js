import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';
import { getCustodialBridgeSecurityRuntime } from './security-runtime.js';
import {
  CUSTODIAL_NATIVE_CREDENTIAL_HANDLE,
  acknowledgeNativeCustodialOfflineCompletion,
  authorizeNativeCustodialOfflineNewWork,
  anchorNativeCustodialOfflineAuthoritySnapshot,
  beginNativeCustodialRollbackFence,
  captureNativeCustodialOfflineCompletionTime,
  attestNativeCustodialOfflineCompletion,
  attestNativeCustodialOfflineStart,
  attestNativeCustodialScanIntent,
  bindNativeCustodialScanEntry,
  consumeNativeCustodialScanEntry,
  clearNativeCustodialRollbackFence,
  cancelNativeCustodialEnrollment,
  confirmNativeCustodialEnrollment,
  getCustodialProtectedStorage,
  getNativeCustodialVaultState,
  getNativeCustodialOfflineAuthorityState,
  isCustodialNativeVaultPlatform,
  nativeCustodialAuthorizedFetch,
  nativeCustodialEnroll,
  nativeCustodialHttpStatus,
  nativeCustodialRemoveEnrollment,
  loadNativeCustodialOfflineAuthoritySnapshot,
  reportNativeCustodialRecoveryDiagnostic,
  reportNativeCustodialNfcTransitionDiagnostic,
  recoverNativeCustodialPendingScanIntent,
  resumeNativeCustodialEnrollment,
  verifyNativeCustodialScanEntry,
} from './native-security.js';
import {
  credentialRecoveryReasonForResponse,
  reconcileEnrollmentConfirmationRequired,
} from './transport-policy.js';
import { isCustodialNativeScanDestination, resolveCustodialScanTarget } from './scan-target.ts';

const OFFLINE_SCAN_SNAPSHOT_PREFIX = 'mz_scan_authority_snapshot:';
const SCAN_ENTRY_ATTESTATION_PREFIX = 'mz_native_scan_entry:';
const SCAN_ENTRY_TTL_MS = 15 * 60 * 1000;
const NATIVE_NFC_HANDOFF_PARAMETER = 'mz_nfc_handoff';
const NATIVE_NOTIFICATION_OUTBOX_PREFIX = 'mz_native_notification_outbox:';
const PRESTART_RECOVERY_PREFIX = 'mz_custodial_prestart_recovery:';
const PHONE_SCAN_RESUME_PREFIX = 'mz_phone_scan_resume:';

(() => {
  const API = 'https://memphis-zoo-mcp.onrender.com';
  const API_ORIGIN = new URL(API).origin;
  const browserTestBuild = typeof __MZ_CUSTODIAL_BROWSER_TEST__ !== 'undefined'
    && __MZ_CUSTODIAL_BROWSER_TEST__ === true;
  const nativeVault = isCustodialNativeVaultPlatform();
  const { credentialStore, security } = getCustodialBridgeSecurityRuntime({
    secureStorage: getCustodialProtectedStorage(),
  });
  const rawFetch = window.fetch.bind(window);
  let confirmationInFlight = null;
  let enrollmentResumeInFlight = null;
  let enrollmentResumeOperationId = '';
  let removalInFlight = null;
  let browserCredentialTransport = null;

  MZ_CUSTODIAL_BROWSER_TEST: {
    function credentialHeaders(credential, id, initial = {}) {
      if (!browserTestBuild || nativeVault) {
        throw Object.assign(new Error('JavaScript credential transport is unavailable in the Custodial APK.'), {
          code: 'custodial_native_vault_required',
        });
      }
      const headers = new Headers(initial);
      for (const name of [
        'Authorization',
        'X-Device-Credential',
        'X-Memphis-Device-Credential',
        'X-Device-Id',
        'X-Memphis-App-Edition',
      ]) headers.delete(name);
      headers.set('Authorization', `Device ${credential}`);
      headers.set('X-Device-Credential', credential);
      headers.set('X-Memphis-Device-Credential', credential);
      headers.set('X-Device-Id', id);
      headers.set('X-Memphis-App-Edition', 'custodial');
      return headers;
    }

    async function request(path, {
      method = 'POST', credential, requestedDeviceId, body = null, operationId = '',
    } = {}) {
      const headers = credentialHeaders(credential, requestedDeviceId, { Accept: 'application/json' });
      if (operationId) headers.set('Idempotency-Key', operationId);
      let encodedBody;
      if (body != null) {
        headers.set('Content-Type', 'application/json');
        encodedBody = JSON.stringify(body);
      }
      const response = await rawFetch(`${API}${path}`, {
        method,
        cache: 'no-store',
        credentials: 'omit',
        headers,
        body: encodedBody,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw responseError(response, payload);
      return payload;
    }

    browserCredentialTransport = Object.freeze({
      authorizedFetch(input, init, supplied, credential, enrolledDevice) {
        return rawFetch(input, {
          ...init,
          headers: credentialHeaders(credential, enrolledDevice, supplied),
          credentials: 'omit',
        });
      },
      request,
      async enroll({ selected, code, operation, flow }) {
        const endpoint = flow === 'recovery' ? '/custodial-device-auth/recover' : '/custodial-device-auth/enroll';
        const response = await rawFetch(`${API}${endpoint}`, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'omit',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Idempotency-Key': operation.operation_id,
            'X-Device-Id': selected,
            'X-Memphis-App-Edition': 'custodial',
          },
          body: JSON.stringify({
            device_id: selected,
            enrollment_code: code,
            device_label: `${selected} Memphis Zoo Custodial`,
            operation_id: operation.operation_id,
            flow,
          }),
        });
        const payload = await response.json().catch(() => null);
        const data = payload?.data || {};
        const { device_credential: credential, ...safeData } = data;
        return { response, payload, credential: String(credential || '').trim(), data: safeData };
      },
    });
  }

  document.documentElement.classList.add(
    'mz-native-app',
    /Android/i.test(navigator.userAgent || '') ? 'mz-native-android' : 'mz-native-ios',
  );
  const hide = () => { void StatusBar.hide().catch(() => {}); };
  hide();
  window.addEventListener('focus', hide);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) hide(); });

  function deviceId() {
    const status = credentialStore.getStatus();
    if (status?.ready !== true || status?.available !== true || status?.quarantined === true) return '';
    return String(status.deviceId || '').trim().toUpperCase();
  }

  function boundedServerRevalidationDetail(response, payload) {
    const status = Number(response?.status);
    const code = String(payload?.code || '').trim().toLowerCase();
    const exact = new Map([
      ['401:device_credential_required', 'http_401_device_credential_required'],
      ['401:device_credential_recovery_required', 'http_401_device_credential_recovery_required'],
      ['401:device_id_required', 'http_401_device_id_required'],
      ['401:device_not_registered', 'http_401_device_not_registered'],
      ['403:device_not_eligible', 'http_403_device_not_eligible'],
      ['409:device_enrollment_confirmation_required', 'http_409_enrollment_confirmation_required'],
      ['503:device_auth_unavailable', 'http_503_device_auth_unavailable'],
    ]).get(`${status}:${code}`);
    if (exact) return exact;
    if (status === 200 && payload?.ok === true) {
      return payload?.data?.authenticated === true
        ? 'no_additional_detail'
        : 'http_200_not_authenticated';
    }
    if ([401, 403, 409, 503].includes(status)) return `http_${status}_unclassified`;
    return 'http_other_response';
  }

  async function revalidateRecoverableServerQuarantine() {
    if (!nativeVault || credentialStore.getStatus().quarantined !== true) return false;
    let serverRevalidationDetail = 'no_additional_detail';
    const result = await credentialStore.reconcileAuthenticatedServerQuarantine(async ({ deviceId: enrolledDevice }) => {
      const url = new URL('/device-auth/status', API_ORIGIN);
      url.searchParams.set('device_id', enrolledDevice);
      const response = await nativeCustodialAuthorizedFetch({
        input: url.toString(),
        init: { method: 'GET', cache: 'no-store', credentials: 'omit' },
        resolvedUrl: url,
        deviceId: enrolledDevice,
      });
      const payload = await response.json().catch(() => null);
      serverRevalidationDetail = boundedServerRevalidationDetail(response, payload);
      const data = payload?.data || {};
      return {
        authenticated: response.ok && payload?.ok === true && data.authenticated === true,
        deviceId: data.canonical_device_id,
        credentialId: data.credential_id,
      };
    });
    await reportProtectedRecoveryDiagnostic({
      reason: result.priorReason || credentialStore.getStatus().reason,
      outcome: result.reconciled === true ? 'reconciled' : result.reason,
      detail: result.diagnostic || serverRevalidationDetail,
    }).catch(() => false);
    if (result.reconciled === true) {
      console.info('[MemphisCustodial] retired historical server quarantine after current native proof', result.priorReason);
    } else {
      console.info(
        '[MemphisCustodial] retained protected quarantine',
        credentialStore.getStatus().reason,
        result.reason,
      );
    }
    return result.reconciled === true;
  }

  async function reportProtectedRecoveryDiagnostic(value = {}) {
    if (!nativeVault) return false;
    await reportNativeCustodialRecoveryDiagnostic({
      reason: String(value.reason || ''),
      outcome: String(value.outcome || 'not_attempted'),
      detail: String(value.detail || 'no_additional_detail'),
    });
    return true;
  }

  function canonicalSessionId(value) {
    const candidate = String(value || '').trim().toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(candidate)
      ? candidate
      : '';
  }

  function scanJournalDisposition(value, enrolledDevice) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const operationId = String(value.manager_recovery_operation_id || '').trim().toLowerCase();
    const recoveryId = String(value.recovery_id || '').trim().toLowerCase();
    const resolvedAt = String(value.resolved_at || '').trim();
    if (
      value.schema_version !== 'custodial-scan-journal-disposition.v1'
      || value.state !== 'RESOLVED'
      || value.preserved !== true
      || value.manager_recovery_required !== false
      || String(value.device_id || '').trim().toUpperCase() !== enrolledDevice
      || !canonicalSessionId(operationId)
      || !canonicalSessionId(recoveryId)
      || !/^[a-f0-9]{64}$/.test(String(value.source_sha256 || ''))
      || !/^[a-f0-9]{64}$/.test(String(value.replacement_journal_sha256 || ''))
      || !Number.isFinite(Date.parse(resolvedAt))
    ) return null;
    return { ...value, manager_recovery_operation_id: operationId, recovery_id: recoveryId, resolved_at: resolvedAt };
  }

  function exactUnstartedPreStart(session, enrolledDevice, disposition) {
    const sessionId = canonicalSessionId(session?.session_uuid);
    const clientSessionId = canonicalSessionId(session?.client_session_id);
    const updatedAt = String(session?.updated_at || '').trim();
    const exact = sessionId
      && sessionId === clientSessionId
      && String(session?.device_id || '').trim().toUpperCase() === enrolledDevice
      && String(session?.status || '').trim().toLowerCase() === 'offline-provisional'
      && String(session?.state || '').trim().toLowerCase() === 'offline-provisional'
      && session?.server_acknowledged !== true
      && String(session?.sync_status || '').trim() === 'activation_queued'
      && String(session?.entry_attestation || '').trim() === 'native-entry-pending.v1'
      && String(session?.started_at || '').trim() === ''
      && !String(session?.native_start_attestation || '').trim()
      && canonicalSessionId(session?.entry_id)
      && Number.isFinite(Date.parse(updatedAt))
      && Date.parse(updatedAt) <= Date.parse(disposition.resolved_at);
    return exact ? { sessionId, updatedAt } : null;
  }

  function exactInterruptedStart(session, enrolledDevice, disposition) {
    const sessionId = canonicalSessionId(session?.session_uuid);
    const clientSessionId = canonicalSessionId(session?.client_session_id);
    const entryId = canonicalSessionId(session?.entry_id);
    const updatedAt = String(session?.updated_at || '').trim();
    const scanEvidence = Array.isArray(session?.scan_evidence) ? session.scan_evidence : [];
    const hasCompletionEvidence = session?.completion_pending === true
      || session?.native_completion_time_captured === true
      || session?.response_json != null
      || [
        session?.client_completion_id,
        session?.ended_at,
        session?.native_finish_scan_entry_id,
        session?.native_completion_attestation_version,
        session?.native_completion_attestation,
        session?.context_id,
        session?.submission_proof,
      ].some((value) => String(value || '').trim())
      || scanEvidence.some((event) => String(event?.event_type || '').trim().toLowerCase() === 'scan_finish');
    const common = sessionId
      && sessionId === clientSessionId
      && entryId
      && String(session?.device_id || '').trim().toUpperCase() === enrolledDevice
      && String(session?.status || '').trim().toLowerCase() === 'offline-provisional'
      && String(session?.state || '').trim().toLowerCase() === 'offline-provisional'
      && session?.server_acknowledged === false
      && String(session?.sync_status || '').trim() === 'activation_queued'
      && Number.isFinite(Date.parse(updatedAt))
      && Date.parse(updatedAt) <= Date.parse(disposition.resolved_at)
      && !hasCompletionEvidence;
    if (!common) return null;

    const neverStarted = exactUnstartedPreStart(session, enrolledDevice, disposition);
    if (neverStarted) return { ...neverStarted, startState: 'never_started' };

    const startedAt = String(session?.started_at || '').trim();
    const nativeStarted = session?.offline_provisional === true
      && String(session?.entry_source || '').trim().toLowerCase() === 'native-nfc'
      && String(session?.entry_attestation || '').trim() === 'native-start-proof.v1'
      && String(session?.native_start_attestation_version || '').trim() === 'custodial-native-start.v1'
      && /^[a-f0-9]{64}$/.test(String(session?.native_start_attestation || '').trim())
      && /^[a-f0-9]{64}$/.test(String(session?.offline_authority_snapshot_id || '').trim())
      && canonicalSessionId(session?.offline_authority_employee_id)
      && canonicalSessionId(session?.offline_authority_credential_id)
      && Number.isSafeInteger(Number(session?.offline_authority_assignment_epoch))
      && Number(session.offline_authority_assignment_epoch) >= 1
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(startedAt)
      && Date.parse(startedAt) <= Date.parse(updatedAt);
    return nativeStarted
      ? { sessionId, updatedAt, startState: 'native_started_server_unaccepted' }
      : null;
  }

  function canonicalRecoveryValue(value) {
    if (Array.isArray(value)) return value.map(canonicalRecoveryValue);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((result, key) => {
        if (value[key] !== undefined) result[key] = canonicalRecoveryValue(value[key]);
        return result;
      }, {});
    }
    return value;
  }

  function canonicalRecoveryActions(actions) {
    return JSON.stringify(canonicalRecoveryValue(
      [...actions].sort((left, right) => Number(left?.id || 0) - Number(right?.id || 0)),
    ));
  }

  function queuedInterruptedStartMismatch(item, session, enrolledDevice, interruptedStart, { requireQuiescent = true } = {}) {
    const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {};
    const binding = item?.replay_binding && typeof item.replay_binding === 'object' ? item.replay_binding : {};
    const sessionId = interruptedStart?.sessionId || '';
    const assignmentEpoch = Number(session?.offline_authority_assignment_epoch);
    const leaseIsLive = String(item?.lease_owner || '').trim() && Number(item?.lease_until || 0) > Date.now();
    const checks = [
      ['queue_chain_type', String(item?.type || '').trim() === 'start_session'],
      ['queue_chain_recoverable', item?.recoverable !== false],
      ['queue_chain_schema', Number(item?.schema_version) === 6],
      ['queue_chain_replay_contract', String(item?.forward_replay_contract || '').trim() === 'scan.v4.snapshot-bound-authority'],
      ['queue_chain_forward_type', String(item?.forward_action_type || '').trim() === 'start_session'],
      ['queue_chain_live_lease', !requireQuiescent || !leaseIsLive],
      ['queue_chain_client_id', canonicalSessionId(item?.client_id) === sessionId],
      ['queue_chain_operation_id', canonicalSessionId(item?.operation_id) === sessionId],
      ['queue_chain_logical_identity', canonicalSessionId(item?.logical_identity) === sessionId],
      ['queue_chain_logical_key', String(item?.logical_key || '').trim() === `start_session:${sessionId}`],
      ['queue_chain_payload_session', canonicalSessionId(payload.p_client_session_id) === sessionId],
      ['queue_chain_binding_session', canonicalSessionId(binding.client_session_id) === sessionId],
      ['queue_chain_device', String(payload.p_device_id || '').trim().toUpperCase() === enrolledDevice],
      ['queue_chain_location', String(payload.p_location_code || '').trim().toUpperCase() === String(session?.location_code || '').trim().toUpperCase()],
      ['queue_chain_started_at', String(payload.p_client_started_at || '').trim() === String(session?.started_at || '').trim()],
      ['queue_chain_snapshot', String(payload.p_snapshot_id || '').trim() === String(session?.offline_authority_snapshot_id || '').trim()],
      ['queue_chain_employee', canonicalSessionId(payload.p_snapshot_employee_id) === canonicalSessionId(session?.offline_authority_employee_id)],
      ['queue_chain_epoch', Number(payload.p_snapshot_assignment_epoch) === assignmentEpoch],
      ['queue_chain_credential', canonicalSessionId(payload.p_snapshot_credential_id) === canonicalSessionId(session?.offline_authority_credential_id)],
      ['queue_chain_entry', canonicalSessionId(payload.p_native_scan_entry_id) === canonicalSessionId(session?.entry_id)],
      ['queue_chain_attestation_version', String(payload.p_native_start_attestation_version || '').trim() === String(session?.native_start_attestation_version || '').trim()],
      ['queue_chain_attestation', String(payload.p_native_start_attestation || '').trim() === String(session?.native_start_attestation || '').trim()],
      ['queue_chain_binding_snapshot', String(binding.snapshot_id || '').trim() === String(session?.offline_authority_snapshot_id || '').trim()],
      ['queue_chain_binding_employee', canonicalSessionId(binding.employee_id) === canonicalSessionId(session?.offline_authority_employee_id)],
      ['queue_chain_binding_epoch', Number(binding.assignment_epoch) === assignmentEpoch],
    ];
    return checks.find(([, matches]) => !matches)?.[0] || '';
  }

  function exactQueuedInterruptedStart(item, session, enrolledDevice, interruptedStart, options = {}) {
    return queuedInterruptedStartMismatch(item, session, enrolledDevice, interruptedStart, options) === '';
  }

  function recordInterruptedStartRecovery(reason, outcome = 'preserved') {
    const detail = String(reason || 'unspecified').trim().slice(0, 120);
    console.warn('Custodial interrupted start recovery', { outcome, reason: detail });
    void reportProtectedRecoveryDiagnostic({
      reason: 'interrupted_start_recovery',
      outcome,
      detail,
    }).catch(() => false);
  }

  function interruptedStartManagerRequired(reason) {
    recordInterruptedStartRecovery(reason);
    return { state: 'manager_required' };
  }

  function interruptedStartFailureDetail(error) {
    const code = String(error?.code || '').trim();
    const direct = new Set([
      'browser_completion_draft_present',
      'durable_completion_draft_present',
      'durable_draft_check_failed',
      'local_session_changed',
      'local_session_corrupted',
      'local_session_missing',
      'location_code_invalid',
      'server_authority_mismatch',
      'server_does_not_allow_retirement',
    ]);
    if (direct.has(code)) return code;
    if (code.startsWith('queue_chain_')) return code;
    if (code.includes('ambiguous')) return 'queue_session_chain_ambiguous';
    if (code.includes('queue_changed')) return 'queue_session_chain_changed';
    if (code.includes('not_retirable') || code === 'queue_session_chain_invalid') return 'queue_session_chain_invalid';
    if (code.includes('archive') || code.includes('canonical_mismatch')) return 'queue_archive_failed';
    return 'queue_retirement_failed';
  }

  function retirePreStartIndex(enrolledDevice, sessionId) {
    const key = `${PHONE_SCAN_RESUME_PREFIX}${enrolledDevice}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    let index;
    try { index = JSON.parse(raw); } catch { throw securityError('custodial_prestart_index_corrupted'); }
    if (index?.schema_version !== 2 || !Array.isArray(index.sessions) || index.sessions.length > 4) {
      throw securityError('custodial_prestart_index_corrupted');
    }
    const remaining = index.sessions.filter((record) => canonicalSessionId(record?.session_uuid) !== sessionId);
    if (remaining.length === index.sessions.length) return;
    if (remaining.length) {
      localStorage.setItem(key, JSON.stringify({ ...index, sessions: remaining, updated_at: new Date().toISOString() }));
    } else {
      localStorage.removeItem(key);
    }
  }

  function validatedPreStartArchive(raw, enrolledDevice, disposition, expectedSessionId = '') {
    if (!raw) return null;
    let archive;
    let preservedSession;
    let preservedQueueActions = [];
    try {
      archive = JSON.parse(raw);
      preservedSession = JSON.parse(String(archive?.preserved_session_raw || ''));
      if (archive?.schema_version === 'custodial-interrupted-start-recovery.v3') {
        preservedQueueActions = JSON.parse(String(archive?.preserved_queue_actions_json || ''));
      }
    } catch { return null; }
    const sessionId = canonicalSessionId(archive?.session_uuid);
    const interruptedStart = exactInterruptedStart(preservedSession, enrolledDevice, disposition);
    const serverSessionId = archive?.resolution?.server_session_uuid == null
      ? ''
      : canonicalSessionId(archive.resolution.server_session_uuid);
    const serverStatus = String(archive?.resolution?.server_session_status || '').trim().toLowerCase();
    const serverSuggestedAction = String(archive?.resolution?.server_suggested_action || '').trim();
    const terminalMatch = serverSessionId === sessionId
      && ['closed', 'cancelled', 'quarantined', 'recovery_required'].includes(serverStatus);
    const schemaVersion = String(archive?.schema_version || '');
    const queuedActionCount = Number(archive?.resolution?.queued_action_count);
    const legacyArchive = ['custodial-prestart-recovery.v1', 'custodial-interrupted-start-recovery.v2'].includes(schemaVersion);
    const queuedArchive = schemaVersion === 'custodial-interrupted-start-recovery.v3';
    if (
      (!legacyArchive && !queuedArchive)
      || archive?.resolution?.method !== 'preserved_native_journal_manager_recovery'
      || (legacyArchive && queuedActionCount !== 0)
      || (queuedArchive && queuedActionCount !== 1)
      || Number(archive?.resolution?.completion_draft_count || 0) !== 0
      || sessionId !== interruptedStart?.sessionId
      || (expectedSessionId && sessionId !== expectedSessionId)
      || String(archive?.device_id || '').trim().toUpperCase() !== enrolledDevice
      || canonicalSessionId(archive?.native_scan_journal_recovery_id) !== disposition.recovery_id
      || canonicalSessionId(archive?.manager_recovery_operation_id) !== disposition.manager_recovery_operation_id
      || String(archive?.preserved_at || '') !== interruptedStart.updatedAt
      || !Number.isFinite(Date.parse(String(archive?.resolved_at || '')))
      || (!terminalMatch && serverSuggestedAction !== 'start_session')
    ) return null;
    if (schemaVersion === 'custodial-prestart-recovery.v1'
      && interruptedStart.startState !== 'never_started') return null;
    if (schemaVersion === 'custodial-interrupted-start-recovery.v2'
      && String(archive?.resolution?.local_start_state || '') !== interruptedStart.startState) return null;
    if (queuedArchive && (
      interruptedStart.startState !== 'native_started_server_unaccepted'
      || String(archive?.resolution?.local_start_state || '') !== interruptedStart.startState
      || !Array.isArray(preservedQueueActions)
      || preservedQueueActions.length !== 1
      || !exactQueuedInterruptedStart(
        preservedQueueActions[0],
        preservedSession,
        enrolledDevice,
        interruptedStart,
        { requireQuiescent: false },
      )
    )) return null;
    return { archive, preservedSession, preservedQueueActions, sessionId };
  }

  async function finishArchivedPreStartRetirement(enrolledDevice, disposition) {
    const indexKey = `${PHONE_SCAN_RESUME_PREFIX}${enrolledDevice}`;
    const indexRaw = localStorage.getItem(indexKey);
    if (!indexRaw) return null;
    let index;
    try { index = JSON.parse(indexRaw); } catch { return { state: 'manager_required' }; }
    if (index?.schema_version !== 2 || !Array.isArray(index.sessions) || index.sessions.length !== 1) {
      return null;
    }
    const sessionId = canonicalSessionId(index.sessions[0]?.session_uuid);
    if (!sessionId) return { state: 'manager_required' };
    const archiveKey = `${PRESTART_RECOVERY_PREFIX}${sessionId}`;
    const validated = validatedPreStartArchive(
      localStorage.getItem(archiveKey),
      enrolledDevice,
      disposition,
      sessionId,
    );
    if (!validated) return null;
    const sessionKey = `session:${sessionId}`;
    const activeRaw = localStorage.getItem(sessionKey);
    if (activeRaw != null && activeRaw !== validated.archive.preserved_session_raw) {
      return { state: 'manager_required' };
    }
    const retireQueuedStart = window.MemphisScanSync?.retirePreservedInterruptedStart;
    if (typeof retireQueuedStart !== 'function') return { state: 'manager_required' };
    try {
      const retirement = await retireQueuedStart(sessionId, async (currentActions, preservationEvidence) => {
        if (!Array.isArray(currentActions) || currentActions.length > 1) {
          throw securityError('custodial_prestart_queue_ambiguous');
        }
        if (validated.preservedQueueActions.length === 0) {
          if (currentActions.length !== 0) throw securityError('custodial_prestart_queue_appeared');
        } else if (currentActions.length === 1
          && canonicalRecoveryActions(currentActions) !== canonicalRecoveryActions(validated.preservedQueueActions)) {
          throw securityError('custodial_prestart_queue_archive_mismatch');
        }
        if (preservationEvidence?.canonical_actions !== canonicalRecoveryActions(currentActions)) {
          throw securityError('custodial_prestart_queue_canonical_mismatch');
        }
        return { preserved: true, canonical_actions: preservationEvidence.canonical_actions };
      });
      if (retirement?.contract_version !== 'custodial-interrupted-start-retirement.v1') {
        return { state: 'manager_required' };
      }
    } catch {
      return { state: 'manager_required' };
    }
    await security.mutateProtectedWork(() => {
      localStorage.removeItem(sessionKey);
      retirePreStartIndex(enrolledDevice, sessionId);
      if (localStorage.getItem(sessionKey) != null || localStorage.getItem(indexKey) != null) {
        throw securityError('custodial_prestart_retirement_failed');
      }
    });
    return { state: 'retired_preserved', session_id: sessionId, resumed: true };
  }

  async function reconcileRecoveredPreStart() {
    if (!nativeVault) return { state: 'not_applicable' };
    const enrolledDevice = deviceId();
    if (!enrolledDevice) return { state: 'manager_required' };
    const nativeState = await getNativeCustodialVaultState();
    const disposition = scanJournalDisposition(nativeState.scan_journal_disposition, enrolledDevice);
    if (!disposition) {
      return nativeState.scan_journal_recovery_required === true
        ? { state: 'manager_required' }
        : { state: 'not_applicable' };
    }

    const resumedRetirement = await finishArchivedPreStartRetirement(enrolledDevice, disposition);
    if (resumedRetirement) return resumedRetirement;

    const resolved = window.MemphisUI?.resolveOpenScanSession?.(enrolledDevice)
      || { state: 'none', session: null };
    if (['ambiguous', 'corrupted'].includes(resolved.state)) return { state: 'manager_required' };
    if (resolved.state !== 'open') return { state: 'none' };
    const interruptedStart = exactInterruptedStart(resolved.session, enrolledDevice, disposition);
    if (!interruptedStart) {
      recordInterruptedStartRecovery('local_shape_not_eligible', 'not_applicable');
      return { state: 'not_applicable' };
    }

    const queueReady = await window.MemphisScanSync?.ready;
    if (queueReady !== true) return interruptedStartManagerRequired('queue_not_ready');
    const retireQueuedStart = window.MemphisScanSync?.retirePreservedInterruptedStart;
    if (typeof retireQueuedStart !== 'function') return interruptedStartManagerRequired('queue_retirement_unavailable');
    if (typeof window.MemphisScanSync?.completionDraftExists !== 'function') {
      return interruptedStartManagerRequired('durable_draft_reader_unavailable');
    }

    const sessionKey = `session:${interruptedStart.sessionId}`;
    const archiveKey = `${PRESTART_RECOVERY_PREFIX}${interruptedStart.sessionId}`;
    let retirement;
    try {
      retirement = await retireQueuedStart(interruptedStart.sessionId, async (queueActions, preservationEvidence) => {
        if (!Array.isArray(queueActions) || queueActions.length > 1) {
          throw securityError('queue_session_chain_ambiguous');
        }

        const rawSession = localStorage.getItem(sessionKey);
        if (!rawSession) throw securityError('local_session_missing');
        let currentSession;
        try { currentSession = JSON.parse(rawSession); } catch { throw securityError('local_session_corrupted'); }
        const currentInterruptedStart = exactInterruptedStart(currentSession, enrolledDevice, disposition);
        if (currentInterruptedStart?.sessionId !== interruptedStart.sessionId
          || currentInterruptedStart.startState !== interruptedStart.startState
          || currentInterruptedStart.updatedAt !== interruptedStart.updatedAt) {
          throw securityError('local_session_changed');
        }
        if (queueActions.length === 1) {
          const mismatch = queuedInterruptedStartMismatch(
            queueActions[0],
            currentSession,
            enrolledDevice,
            interruptedStart,
          );
          if (mismatch) throw securityError(mismatch);
        }

        if (localStorage.getItem(`mz_scan_completion_draft:${interruptedStart.sessionId}`) != null) {
          throw securityError('browser_completion_draft_present');
        }
        let durableCompletionDraft;
        try {
          durableCompletionDraft = await window.MemphisScanSync.completionDraftExists(interruptedStart.sessionId);
        } catch { throw securityError('durable_draft_check_failed'); }
        if (durableCompletionDraft !== false) throw securityError('durable_completion_draft_present');

        const localLocationCode = String(currentSession.location_code || '').trim().toUpperCase();
        if (!/^[A-Z0-9._:-]{1,100}$/.test(localLocationCode)) throw securityError('location_code_invalid');
        // A paused physical canary permits this one read-only native call so the
        // exact enrolled phone can prove its transport before an operator resumes
        // the canary. Keep it inside the interrupted-start tribunal: ordinary
        // Home startup does not gain another network dependency, and the scan
        // queue remains fenced until the full recovery decision succeeds.
        const transportProof = await requestEnvelope('/scan-api/rpc', {
          method: 'POST',
          body: {
            device_id: enrolledDevice,
            fn: 'tool_get_system_settings',
            args: {},
          },
        });
        if (!transportProof?.data || typeof transportProof.data !== 'object') {
          throw securityError('release_canary_transport_probe_invalid');
        }
        const server = await requestEnvelope('/scan-api/rpc', {
          method: 'POST',
          body: {
            device_id: enrolledDevice,
            fn: 'tool_get_location_scan_state',
            args: {
              p_location_code: localLocationCode,
              p_device_id: enrolledDevice,
            },
          },
        });
        const serverState = server?.data || {};
        if (String(serverState.location_code || '').trim().toUpperCase() !== localLocationCode
          || serverState.device_approved !== true) throw securityError('server_authority_mismatch');
        const serverSessionId = canonicalSessionId(serverState.latest_session_uuid);
        const serverStatus = String(serverState.latest_session_status || '').trim().toLowerCase();
        const serverMatches = serverSessionId === interruptedStart.sessionId;
        const terminal = ['closed', 'cancelled', 'quarantined', 'recovery_required'].includes(serverStatus);
        const freshStartAllowed = String(serverState.suggested_action || '').trim() === 'start_session';
        if ((!serverMatches || !terminal) && !freshStartAllowed) {
          throw securityError('server_does_not_allow_retirement');
        }

        const queuedActionCount = queueActions.length;
        const archive = {
          schema_version: queuedActionCount === 1
            ? 'custodial-interrupted-start-recovery.v3'
            : (interruptedStart.startState === 'never_started'
              ? 'custodial-prestart-recovery.v1'
              : 'custodial-interrupted-start-recovery.v2'),
          session_uuid: interruptedStart.sessionId,
          device_id: enrolledDevice,
          native_scan_journal_recovery_id: disposition.recovery_id,
          manager_recovery_operation_id: disposition.manager_recovery_operation_id,
          preserved_session_raw: rawSession,
          preserved_queue_actions_json: queuedActionCount === 1
            ? canonicalRecoveryActions(queueActions)
            : undefined,
          preserved_at: interruptedStart.updatedAt,
          resolved_at: new Date().toISOString(),
          resolution: {
            method: 'preserved_native_journal_manager_recovery',
            queued_action_count: queuedActionCount,
            completion_draft_count: 0,
            local_start_state: interruptedStart.startState,
            server_session_uuid: serverSessionId || null,
            server_session_status: serverStatus || null,
            server_suggested_action: String(serverState.suggested_action || '') || null,
          },
        };
        await security.mutateProtectedWork(() => {
          const existingRaw = localStorage.getItem(archiveKey);
          if (existingRaw) {
            const existing = validatedPreStartArchive(existingRaw, enrolledDevice, disposition, interruptedStart.sessionId);
            if (!existing || existing.archive.preserved_session_raw !== rawSession
              || canonicalRecoveryActions(existing.preservedQueueActions) !== canonicalRecoveryActions(queueActions)) {
              throw securityError('custodial_prestart_archive_mismatch');
            }
          } else {
            localStorage.setItem(archiveKey, JSON.stringify(archive));
          }
          const verified = validatedPreStartArchive(
            localStorage.getItem(archiveKey),
            enrolledDevice,
            disposition,
            interruptedStart.sessionId,
          );
          if (!verified || verified.archive.preserved_session_raw !== rawSession
            || canonicalRecoveryActions(verified.preservedQueueActions) !== canonicalRecoveryActions(queueActions)) {
            throw securityError('custodial_prestart_archive_failed');
          }
        });
        if (preservationEvidence?.canonical_actions !== canonicalRecoveryActions(queueActions)) {
          throw securityError('custodial_prestart_queue_canonical_mismatch');
        }
        return { preserved: true, canonical_actions: preservationEvidence.canonical_actions };
      });
    } catch (error) {
      return interruptedStartManagerRequired(interruptedStartFailureDetail(error));
    }
    if (retirement?.contract_version !== 'custodial-interrupted-start-retirement.v1') {
      return interruptedStartManagerRequired('queue_retirement_unverified');
    }

    const rawSession = localStorage.getItem(sessionKey);
    if (!rawSession) return interruptedStartManagerRequired('local_session_missing');
    await security.mutateProtectedWork(() => {
      localStorage.removeItem(sessionKey);
      retirePreStartIndex(enrolledDevice, interruptedStart.sessionId);
      if (localStorage.getItem(sessionKey) != null) throw securityError('custodial_prestart_retirement_failed');
    });
    recordInterruptedStartRecovery(interruptedStart.startState, 'retired_preserved');
    return { state: 'retired_preserved', session_id: interruptedStart.sessionId };
  }

  const bridgeReady = Promise.resolve(security.ready).then(async () => {
    if (nativeVault && credentialStore.getStatus().quarantined === true) {
      await revalidateRecoverableServerQuarantine().catch(() => false);
    }
    const status = security.getStatus();
    const id = deviceId();
    if (nativeVault && id) {
      try {
        const loaded = await loadNativeCustodialOfflineAuthoritySnapshot(id);
        const snapshot = loaded?.snapshot && typeof loaded.snapshot === 'object' ? loaded.snapshot : null;
        if (snapshot) {
          validateOfflineScanAuthoritySnapshot(snapshot, id);
          await security.mutateProtectedWork(() => localStorage.setItem(
            `${OFFLINE_SCAN_SNAPSHOT_PREFIX}${id}`,
            JSON.stringify(snapshot),
          ));
        } else {
          await security.mutateProtectedWork(() => localStorage.removeItem(`${OFFLINE_SCAN_SNAPSHOT_PREFIX}${id}`));
        }
      } catch {
        await security.mutateProtectedWork(() => localStorage.removeItem(`${OFFLINE_SCAN_SNAPSHOT_PREFIX}${id}`));
      }
    }
    window.dispatchEvent(new CustomEvent('memphis:mobile-ready', {
      detail: {
        edition: 'custodial',
        deviceId: id,
        status,
      },
    }));
    return status;
  });

  async function authoritativeDeviceId() {
    await bridgeReady;
    return deviceId();
  }

  function validateOfflineScanAuthoritySnapshot(snapshot, id) {
    if (
      !id
      || !snapshot
      || snapshot.schema_version !== 'offline-scan-snapshot.v2'
      || snapshot.contract_version !== 'scan.v4.snapshot-bound-authority'
      || String(snapshot.canonical_device_id || '').trim().toUpperCase() !== id
      || !/^[0-9a-f]{64}$/.test(String(snapshot.snapshot_id || ''))
      || !/^[0-9a-f-]{36}$/i.test(String(snapshot.employee_id || ''))
      || !/^[0-9a-f-]{36}$/i.test(String(snapshot.credential_id || ''))
      || !Number.isSafeInteger(Number(snapshot.assignment_epoch))
      || Number(snapshot.assignment_epoch) < 1
      || !exactNativeTimestamp(snapshot.generated_at)
      || !exactNativeTimestamp(snapshot.expires_at)
    ) throw new Error('The offline scan authority snapshot does not match this enrolled phone.');
    return snapshot;
  }

  async function saveOfflineScanAuthoritySnapshot(snapshot) {
    await bridgeReady;
    const id = deviceId();
    validateOfflineScanAuthoritySnapshot(snapshot, id);
    if (nativeVault) {
      const anchored = await anchorNativeCustodialOfflineAuthoritySnapshot({
        deviceId: id,
        snapshotId: snapshot.snapshot_id,
        generatedAt: snapshot.generated_at,
        expiresAt: snapshot.expires_at,
        snapshot,
      });
      if (anchored?.anchored !== true) throw new Error('The protected offline time anchor could not be saved.');
    } else if (!browserTestBuild) {
      throw new Error('The native vault is required to save offline employee authority.');
    }
    await security.mutateProtectedWork(() => localStorage.setItem(`${OFFLINE_SCAN_SNAPSHOT_PREFIX}${id}`, JSON.stringify(snapshot)));
    return true;
  }

  async function loadOfflineAuthoritySnapshot(requestedDeviceId) {
    await bridgeReady;
    const id = deviceId();
    if (!id || String(requestedDeviceId || '').trim().toUpperCase() !== id) {
      throw new Error('The protected device identity is unavailable for offline work admission.');
    }
    if (!nativeVault) throw new Error('The protected offline-authority capability is unavailable on this phone.');
    const loaded = await loadNativeCustodialOfflineAuthoritySnapshot(id);
    const snapshot = loaded?.snapshot && typeof loaded.snapshot === 'object' ? loaded.snapshot : loaded;
    validateOfflineScanAuthoritySnapshot(snapshot, id);
    await security.mutateProtectedWork(() => localStorage.setItem(`${OFFLINE_SCAN_SNAPSHOT_PREFIX}${id}`, JSON.stringify(snapshot)));
    return Object.freeze({ ...snapshot });
  }

  async function authorizeOfflineNewWork(requestedDeviceId, snapshotId) {
    await bridgeReady;
    const id = deviceId();
    if (!id || String(requestedDeviceId || '').trim().toUpperCase() !== id || !/^[0-9a-f]{64}$/.test(String(snapshotId || ''))) {
      throw new Error('The protected offline authority is invalid for new work admission.');
    }
    if (!nativeVault) throw new Error('The protected offline-authority capability is unavailable on this phone.');
    const result = await authorizeNativeCustodialOfflineNewWork(id, snapshotId);
    if (result?.authorized !== true) throw new Error('The protected offline authority did not authorize new work.');
    return Object.freeze({ authorized: true });
  }

  async function getOfflineAuthorityState(requestedDeviceId) {
    await bridgeReady;
    const id = deviceId();
    if (!id || String(requestedDeviceId || '').trim().toUpperCase() !== id || !nativeVault) {
      throw new Error('The protected offline-authority capability is unavailable on this phone.');
    }
    const result = await getNativeCustodialOfflineAuthorityState(id);
    return Object.freeze({
      occurrences_awaiting_acknowledgement: result?.occurrences_awaiting_acknowledgement === true,
      rollback_fence_active: result?.rollback_fence_active === true,
      rollback_fence_id: result?.rollback_fence_active === true ? String(result?.rollback_fence_id || '') : null,
    });
  }

  async function beginRollbackFence(requestedDeviceId) {
    await bridgeReady;
    const id = deviceId();
    if (!id || String(requestedDeviceId || '').trim().toUpperCase() !== id || !nativeVault) {
      throw new Error('The protected rollback-fence capability is unavailable on this phone.');
    }
    const result = await beginNativeCustodialRollbackFence(id);
    if (result?.rollback_fence_active !== true || !/^[0-9a-f-]{36}$/i.test(String(result?.rollback_fence_id || ''))) {
      throw new Error('The protected rollback fence was not durably established.');
    }
    return Object.freeze({ rollback_fence_active: true, rollback_fence_id: String(result.rollback_fence_id).toLowerCase() });
  }

  async function clearRollbackFence(requestedDeviceId, rollbackFenceId) {
    await bridgeReady;
    const id = deviceId();
    if (!id || String(requestedDeviceId || '').trim().toUpperCase() !== id || !nativeVault) {
      throw new Error('The protected rollback-fence capability is unavailable on this phone.');
    }
    const result = await clearNativeCustodialRollbackFence(id, rollbackFenceId);
    if (result?.cleared !== true) throw new Error('The protected rollback fence was not cleared.');
    return Object.freeze({ cleared: true });
  }

  function homeCacheKey(id = deviceId()) { return `mz_custodial_home_cache:${String(id || '').trim().toUpperCase()}`; }

  async function saveCustodialHomeCache(value) {
    await bridgeReady;
    const id = deviceId();
    if (!id || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The employee Home cache is invalid.');
    const record = {
      schema_version: 'custodial-home-cache.v3',
      device_id: id,
      cached_at: new Date().toISOString(),
      profile: value.profile && typeof value.profile === 'object' ? value.profile : null,
    };
    if (!record.profile) throw new Error('Employee identity is required for the Home cache.');
    const encoded = JSON.stringify(record);
    await security.mutateProtectedWork(() => {
      localStorage.setItem(homeCacheKey(id), encoded);
      if (localStorage.getItem(homeCacheKey(id)) !== encoded) throw new Error('Employee Home cache write verification failed.');
    });
    return record;
  }

  function readCustodialHomeCache() {
    const id = deviceId();
    if (!id) return null;
    try {
      const record = JSON.parse(localStorage.getItem(homeCacheKey(id)) || 'null');
      if (record?.device_id !== id || !record.profile) return null;
      if (!['custodial-home-cache.v1', 'custodial-home-cache.v2', 'custodial-home-cache.v3'].includes(record.schema_version)) return null;
      const cachedAt = Date.parse(String(record.cached_at || ''));
      const profileDevice = String(record.profile.canonical_device_id || record.profile.device_id || '').trim().toUpperCase();
      if (!Number.isFinite(cachedAt) || Date.now() - cachedAt < 0 || Date.now() - cachedAt > 24 * 60 * 60 * 1000) return null;
      if (record.profile.authenticated !== true || profileDevice !== id) return null;
      return { schema_version: 'custodial-home-cache.v3', device_id: id, cached_at: record.cached_at, profile: record.profile };
    } catch { return null; }
  }

  function readScanEntryAttestation(entryId) {
    const canonicalEntryId = String(entryId || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(canonicalEntryId)) return null;
    let record = null;
    try { record = JSON.parse(sessionStorage.getItem(`${SCAN_ENTRY_ATTESTATION_PREFIX}${canonicalEntryId}`) || 'null'); } catch {}
    const source = String(record?.entry_source || '').trim();
    const expiresAt = new Date(record?.expires_at || '').getTime();
    if (
      record?.schema_version !== 'scan-entry-attestation.v1'
      || record?.entry_id !== canonicalEntryId
      || source !== 'native-nfc'
      || String(record?.device_id || '').trim().toUpperCase() !== deviceId()
      || !Number.isFinite(expiresAt)
      || expiresAt <= Date.now()
    ) return null;
    return record;
  }

  async function prepareScanTarget(rawValue, entrySource) {
    await bridgeReady;
    const status = security.getStatus();
    const id = deviceId();
    if (status.ready !== true || status.available !== true || status.state !== 'enrolled' || !id) return null;
    if (nativeVault) return null;
    const entryId = crypto.randomUUID();
    const target = resolveCustodialScanTarget(rawValue, location.href, id, entrySource, entryId);
    if (!target) return null;
    const now = Date.now();
    const record = {
      schema_version: 'scan-entry-attestation.v1',
      entry_id: entryId,
      entry_source: entrySource,
      device_id: id,
      location_code: String(target.searchParams.get('code') || target.searchParams.get('location') || target.searchParams.get('loc') || '').trim().toUpperCase(),
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + SCAN_ENTRY_TTL_MS).toISOString(),
      client_session_id: null,
    };
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith(SCAN_ENTRY_ATTESTATION_PREFIX)) continue;
      let prior = null;
      try { prior = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch {}
      if (new Date(prior?.expires_at || '').getTime() <= now) sessionStorage.removeItem(key);
    }
    sessionStorage.setItem(`${SCAN_ENTRY_ATTESTATION_PREFIX}${entryId}`, JSON.stringify(record));
    return target.toString();
  }

  async function verifyScanEntryAttestation(entryId) {
    await bridgeReady;
    if (nativeVault) return Object.freeze({ ...await verifyNativeCustodialScanEntry(entryId) });
    const record = readScanEntryAttestation(entryId);
    if (!record) throw new Error('The native scan handoff is missing or expired.');
    return Object.freeze({ ...record });
  }

  async function bindScanEntryAttestation(entryId, clientSessionId, locationCode, action) {
    await bridgeReady;
    if (nativeVault) {
      await bindNativeCustodialScanEntry(entryId, clientSessionId, locationCode, action, deviceId());
      return true;
    }
    const record = readScanEntryAttestation(entryId);
    const sessionId = String(clientSessionId || '').trim();
    const canonicalLocation = String(locationCode || '').trim().toUpperCase();
    if (!record || !/^[0-9a-f-]{36}$/i.test(sessionId) || record.location_code !== canonicalLocation || !['start', 'finish'].includes(action)) throw new Error('The native scan handoff cannot be bound to this session.');
    if (record.client_session_id && record.client_session_id !== sessionId) throw new Error('The native scan handoff is already bound to another session.');
    sessionStorage.setItem(`${SCAN_ENTRY_ATTESTATION_PREFIX}${record.entry_id}`, JSON.stringify({ ...record, client_session_id: sessionId, action }));
    return true;
  }

  async function consumeScanEntryAttestation(entryId, clientSessionId, locationCode, action) {
    await bridgeReady;
    if (nativeVault) {
      await consumeNativeCustodialScanEntry(entryId, clientSessionId, locationCode, action, deviceId());
      return true;
    }
    const record = readScanEntryAttestation(entryId);
    const sessionId = String(clientSessionId || '').trim();
    if (!record || record.client_session_id !== sessionId || record.location_code !== String(locationCode || '').trim().toUpperCase() || record.action !== action) throw new Error('The native scan handoff cannot be consumed by this session.');
    sessionStorage.removeItem(`${SCAN_ENTRY_ATTESTATION_PREFIX}${record.entry_id}`);
    return true;
  }

  function exactNativeTimestamp(value) {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(String(value || ''))
      ? String(value)
      : '';
  }

  function exactNativeSignature(value) {
    const signature = String(value || '');
    return /^[0-9a-f]{64}$/.test(signature) ? signature : '';
  }

  async function browserTestAttestation(version, fields, timestamp) {
    const encoded = new TextEncoder().encode(JSON.stringify([version, ...fields, timestamp]));
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, '0')).join('');
  }

  async function createOfflineStartAttestation({
    deviceId: requestedDeviceId, locationCode, clientSessionId, snapshotId, snapshotEmployeeId, snapshotAssignmentEpoch, snapshotCredentialId, nativeScanEntryId,
    clientStartedAt = '', originalNativeStartAttestationVersion = '', originalNativeStartAttestation = '',
  }) {
    await bridgeReady;
    const frozenStartVersion = String(originalNativeStartAttestationVersion || '').trim();
    const frozenStartSignatureRaw = String(originalNativeStartAttestation || '').trim().toLowerCase();
    const frozenStartSignature = exactNativeSignature(frozenStartSignatureRaw);
    if ((frozenStartVersion || frozenStartSignatureRaw)
      && (frozenStartVersion !== 'custodial-native-start.v1' || !frozenStartSignature)) {
      throw new Error('The frozen cleaning-start proof is incomplete.');
    }
    const id = deviceId();
    if (!id || String(requestedDeviceId || '').trim().toUpperCase() !== id) {
      throw new Error('The protected device identity is unavailable for this cleaning start.');
    }
    let result;
    if (nativeVault) {
      result = await attestNativeCustodialOfflineStart({
        deviceId: id,
        locationCode,
        clientSessionId,
        snapshotId,
        snapshotEmployeeId,
        snapshotAssignmentEpoch,
        snapshotCredentialId,
        nativeScanEntryId,
        originalNativeStartAttestationVersion: frozenStartVersion,
        originalNativeStartAttestation: frozenStartSignature,
      });
    } else {
      if (!browserTestBuild) throw new Error('The native vault is required to start employee cleaning.');
      await bindScanEntryAttestation(nativeScanEntryId, clientSessionId, locationCode, 'start');
      const startedAt = exactNativeTimestamp(clientStartedAt) || new Date().toISOString();
      const hasOriginal = frozenStartVersion === 'custodial-native-start.v1' && Boolean(frozenStartSignature);
      const originalSignature = hasOriginal
        ? frozenStartSignature
        : await browserTestAttestation('custodial-native-start.v1', [
          id, locationCode, clientSessionId, snapshotId, snapshotEmployeeId, snapshotAssignmentEpoch, snapshotCredentialId, nativeScanEntryId,
        ], startedAt);
      result = {
        p_client_started_at: startedAt,
        p_native_scan_entry_id: nativeScanEntryId,
        p_native_start_attestation_version: 'custodial-native-start.v1',
        p_native_start_attestation: originalSignature,
        ...(hasOriginal ? {
          p_native_start_transport_attestation_version: 'custodial-native-start-transport.v1',
          p_native_start_transport_attestation: await browserTestAttestation('custodial-native-start-transport.v1', [
            id, locationCode, clientSessionId, snapshotId, snapshotEmployeeId, snapshotAssignmentEpoch,
            snapshotCredentialId, nativeScanEntryId, startedAt, 'custodial-native-start.v1', originalSignature,
          ], startedAt),
        } : {}),
      };
      await consumeScanEntryAttestation(nativeScanEntryId, clientSessionId, locationCode, 'start');
    }
    const startedAt = exactNativeTimestamp(result?.p_client_started_at);
    const signature = exactNativeSignature(result?.p_native_start_attestation);
    const transportVersion = String(result?.p_native_start_transport_attestation_version || '').trim();
    const transportSignatureRaw = String(result?.p_native_start_transport_attestation || '').trim().toLowerCase();
    const transportSignature = exactNativeSignature(transportSignatureRaw);
    if (result?.p_native_start_attestation_version !== 'custodial-native-start.v1'
      || result?.p_native_scan_entry_id !== nativeScanEntryId || !startedAt || !signature
      || ((transportVersion || transportSignatureRaw)
        && (transportVersion !== 'custodial-native-start-transport.v1' || !transportSignature))
      || (frozenStartSignature && signature !== frozenStartSignature)) {
      throw new Error('The protected device did not return a valid cleaning-start attestation.');
    }
    return Object.freeze({
      p_client_started_at: startedAt,
      p_native_scan_entry_id: nativeScanEntryId,
      p_native_start_attestation_version: 'custodial-native-start.v1',
      p_native_start_attestation: signature,
      ...(transportVersion ? {
        p_native_start_transport_attestation_version: transportVersion,
        p_native_start_transport_attestation: transportSignature,
      } : {}),
    });
  }

  async function acknowledgeOfflineCompletion({
    deviceId: requestedDeviceId, locationCode, clientSessionId, nativeFinishScanEntryId, clientStartedAt, clientEndedAt,
  }) {
    await bridgeReady;
    const id = deviceId();
    if (!id || String(requestedDeviceId || '').trim().toUpperCase() !== id) {
      throw new Error('The protected device identity is unavailable for this cleaning acknowledgement.');
    }
    if (!nativeVault) {
      if (!browserTestBuild) throw new Error('The native vault is required to acknowledge employee cleaning.');
      return Object.freeze({ acknowledged: true });
    }
    const result = await acknowledgeNativeCustodialOfflineCompletion({
      deviceId: id, locationCode, clientSessionId, nativeFinishScanEntryId, clientStartedAt, clientEndedAt,
    });
    if (result?.acknowledged !== true) throw new Error('The protected completion journal was not acknowledged.');
    return Object.freeze({ acknowledged: true });
  }

  async function createOfflineCompletionAttestation({
    deviceId: requestedDeviceId, locationCode, clientSessionId, clientCompletionId, contextId, nativeFinishScanEntryId, clientStartedAt,
    clientEndedAt = '', originalNativeCompletionAttestationVersion = '', originalNativeCompletionAttestation = '',
  }) {
    await bridgeReady;
    const frozenCompletionVersion = String(originalNativeCompletionAttestationVersion || '').trim();
    const frozenCompletionSignatureRaw = String(originalNativeCompletionAttestation || '').trim().toLowerCase();
    const frozenCompletionSignature = exactNativeSignature(frozenCompletionSignatureRaw);
    if ((frozenCompletionVersion || frozenCompletionSignatureRaw)
      && (frozenCompletionVersion !== 'custodial-native-completion.v2' || !frozenCompletionSignature)) {
      throw new Error('The frozen cleaning-completion proof is incomplete.');
    }
    const id = deviceId();
    if (!id || String(requestedDeviceId || '').trim().toUpperCase() !== id) {
      throw new Error('The protected device identity is unavailable for this cleaning completion.');
    }
    let result;
    if (nativeVault) {
      result = await attestNativeCustodialOfflineCompletion({
        deviceId: id,
        locationCode,
        clientSessionId,
        clientCompletionId,
        contextId,
        nativeFinishScanEntryId,
        clientStartedAt,
        originalNativeCompletionAttestationVersion: frozenCompletionVersion,
        originalNativeCompletionAttestation: frozenCompletionSignature,
      });
    } else {
      if (!browserTestBuild) throw new Error('The native vault is required to complete employee cleaning.');
      const endedAt = exactNativeTimestamp(clientEndedAt) || new Date().toISOString();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(nativeFinishScanEntryId || ''))) {
        throw new Error('The protected finish scan identity is unavailable.');
      }
      const hasOriginal = frozenCompletionVersion === 'custodial-native-completion.v2' && Boolean(frozenCompletionSignature);
      const originalSignature = hasOriginal
        ? frozenCompletionSignature
        : await browserTestAttestation('custodial-native-completion.v2', [
          id, locationCode, clientSessionId, clientCompletionId, contextId, nativeFinishScanEntryId, clientStartedAt,
        ], endedAt);
      result = {
        p_client_ended_at: endedAt,
        p_native_finish_scan_entry_id: String(nativeFinishScanEntryId).toLowerCase(),
        p_native_completion_attestation_version: 'custodial-native-completion.v2',
        p_native_completion_attestation: originalSignature,
        ...(hasOriginal ? {
          p_native_completion_transport_attestation_version: 'custodial-native-completion-transport.v1',
          p_native_completion_transport_attestation: await browserTestAttestation('custodial-native-completion-transport.v1', [
            id, locationCode, clientSessionId, clientCompletionId, contextId, nativeFinishScanEntryId,
            clientStartedAt, endedAt, 'custodial-native-completion.v2', originalSignature,
          ], endedAt),
        } : {}),
      };
    }
    const endedAt = exactNativeTimestamp(result?.p_client_ended_at);
    const finishScanEntryId = String(result?.p_native_finish_scan_entry_id || '').trim().toLowerCase();
    const signature = exactNativeSignature(result?.p_native_completion_attestation);
    const transportVersion = String(result?.p_native_completion_transport_attestation_version || '').trim();
    const transportSignatureRaw = String(result?.p_native_completion_transport_attestation || '').trim().toLowerCase();
    const transportSignature = exactNativeSignature(transportSignatureRaw);
    if (result?.p_native_completion_attestation_version !== 'custodial-native-completion.v2'
      || finishScanEntryId !== String(nativeFinishScanEntryId || '').trim().toLowerCase()
      || !endedAt || !signature
      || ((transportVersion || transportSignatureRaw)
        && (transportVersion !== 'custodial-native-completion-transport.v1' || !transportSignature))
      || (frozenCompletionSignature && signature !== frozenCompletionSignature)) {
      throw new Error('The protected device did not return a valid cleaning-completion attestation.');
    }
    return Object.freeze({
      p_client_ended_at: endedAt,
      p_native_finish_scan_entry_id: finishScanEntryId,
      p_native_completion_attestation_version: 'custodial-native-completion.v2',
      p_native_completion_attestation: signature,
      ...(transportVersion ? {
        p_native_completion_transport_attestation_version: transportVersion,
        p_native_completion_transport_attestation: transportSignature,
      } : {}),
    });
  }

  async function captureOfflineCompletionTime({
    deviceId: requestedDeviceId, locationCode, clientSessionId, nativeFinishScanEntryId, clientStartedAt,
  }) {
    await bridgeReady;
    const id = deviceId();
    if (!id || String(requestedDeviceId || '').trim().toUpperCase() !== id) {
      throw new Error('The protected device identity is unavailable for this cleaning completion.');
    }
    const result = nativeVault
      ? await captureNativeCustodialOfflineCompletionTime({
        deviceId: id, locationCode, clientSessionId, nativeFinishScanEntryId, clientStartedAt,
      })
      : (browserTestBuild ? { p_client_ended_at: new Date().toISOString(), p_native_finish_scan_entry_id: nativeFinishScanEntryId } : null);
    const endedAt = exactNativeTimestamp(result?.p_client_ended_at);
    const finishScanEntryId = String(result?.p_native_finish_scan_entry_id || '').trim().toLowerCase();
    if (!endedAt || finishScanEntryId !== String(nativeFinishScanEntryId || '').trim().toLowerCase()) {
      throw new Error('The protected device did not freeze the cleaning-completion time.');
    }
    return Object.freeze({ p_client_ended_at: endedAt, p_native_finish_scan_entry_id: finishScanEntryId });
  }

  const nativeScanRouting = new Map();

  function nativeNfcHandoffId(url) {
    try {
      const values = new URL(String(url || ''), location.href).searchParams.getAll(NATIVE_NFC_HANDOFF_PARAMETER);
      const value = String(values[0] || '').trim().toLowerCase();
      return values.length === 1 && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
        ? value
        : '';
    } catch { return ''; }
  }

  function setNativeScanRoutingState(state, reason = '') {
    window.MemphisNativeScanHandoffState = Object.freeze({ state, reason });
  }

  function nativeScanTargetFromAttestation(attestation, id) {
    return resolveCustodialScanTarget(
      attestation?.url,
      location.href,
      id,
      'native-nfc',
      attestation?.entry_id,
    )?.toString() || null;
  }

  async function handleNativeScanUrl(url) {
    const handoffId = nativeNfcHandoffId(url);
    if (!handoffId) return false;
    if (nativeScanRouting.has(handoffId)) return nativeScanRouting.get(handoffId);
    const task = (async () => {
      setNativeScanRoutingState('claiming');
      void reportNativeCustodialNfcTransitionDiagnostic('native_claim_started', 'started');
      try {
        await bridgeReady;
        const status = security.getStatus();
        const id = deviceId();
        if (status.ready !== true || status.available !== true || status.state !== 'enrolled' || !id) {
          throw Object.assign(new Error('The enrolled device identity is unavailable.'), {
            code: 'custodial_native_binding_missing',
          });
        }
        let scan = null;
        if (nativeVault) {
          const attestation = await attestNativeCustodialScanIntent(url);
          void reportNativeCustodialNfcTransitionDiagnostic('native_claim_completed', 'accepted');
          scan = nativeScanTargetFromAttestation(attestation, id);
        } else if (browserTestBuild) {
          scan = await prepareScanTarget(url, 'native-nfc');
        }
        if (!scan) throw Object.assign(new Error('The physical NFC destination was refused.'), {
          code: 'custodial_native_scan_target_refused',
        });
        setNativeScanRoutingState('navigating');
        void reportNativeCustodialNfcTransitionDiagnostic('scan_navigation_started', 'started');
        location.replace(scan);
        return true;
      } catch (error) {
        const candidate = String(error?.code || 'custodial_native_nfc_handoff_failed').toLowerCase();
        const reason = /^custodial_native_[a-z0-9_]{1,80}$/.test(candidate)
          ? candidate
          : 'custodial_native_nfc_handoff_failed';
        setNativeScanRoutingState('failed', reason);
        console.warn(`Custodial NFC handoff failed: ${reason}`);
        throw error;
      }
    })();
    nativeScanRouting.set(handoffId, task);
    return task;
  }

  async function getNativeLaunchUrl() {
    MZ_CUSTODIAL_BROWSER_TEST: {
      const testUrl = browserTestBuild
        ? String(window.__MZ_CUSTODIAL_NATIVE_LAUNCH_URL_FOR_TEST__ || '')
        : '';
      if (testUrl) {
        const key = 'mz_custodial_native_launch_calls_for_test';
        sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) || '0') + 1));
        return { url: testUrl };
      }
    }
    return App.getLaunchUrl().catch(() => null);
  }

  async function installNativeScanRouting() {
    void reportNativeCustodialNfcTransitionDiagnostic('legacy_router_started', 'started');
    MZ_CUSTODIAL_BROWSER_TEST: {
      if (browserTestBuild) window.__dispatchCustodialNativeScanForTest = handleNativeScanUrl;
    }
    await App.addListener('appUrlOpen', ({ url }) => {
      if (nativeNfcHandoffId(url)) void handleNativeScanUrl(url).catch(() => {});
    });
    void reportNativeCustodialNfcTransitionDiagnostic('legacy_listener_ready', 'ready');
    if (nativeNfcHandoffId(location.href)) {
      void reportNativeCustodialNfcTransitionDiagnostic('legacy_location_handoff', 'accepted');
      return handleNativeScanUrl(location.href);
    }
    await bridgeReady;
    if (isCustodialNativeScanDestination(location.href, deviceId())) {
      setNativeScanRoutingState('navigated');
      return false;
    }
    if (nativeVault) {
      await bridgeReady;
      const status = security.getStatus();
      const id = deviceId();
      if (status.ready === true && status.available === true && status.state === 'enrolled' && id) {
        const recovered = await recoverNativeCustodialPendingScanIntent();
        void reportNativeCustodialNfcTransitionDiagnostic(
          'legacy_recovery_checked',
          recovered?.recovered === true ? 'recovered' : 'empty',
        );
        if (recovered?.recovered === true) {
          const scan = nativeScanTargetFromAttestation(recovered, id);
          if (!scan) throw Object.assign(new Error('The recovered physical NFC destination was refused.'), {
            code: 'custodial_native_scan_target_refused',
          });
          setNativeScanRoutingState('navigating');
          location.replace(scan);
          return true;
        }
      }
    }
    const launch = await getNativeLaunchUrl();
    if (nativeNfcHandoffId(launch?.url)) return handleNativeScanUrl(launch.url);
    return false;
  }

  function target(input) {
    try {
      return new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href);
    } catch { return null; }
  }

  async function responsePayload(response) {
    return response.clone().json().catch(() => null);
  }

  function responseError(response, payload) {
    const error = new Error(payload?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    return error;
  }

  function safeEnrollmentTerminalMessage(error) {
    const reason = String(error?.data?.reason || error?.reason || '').trim().toLowerCase();
    if (reason === 'invalid_enrollment_code') return 'That manager code is invalid or has already been used. Ask for a current code and try again.';
    if (reason === 'device_not_eligible') return 'This phone is not eligible for that enrollment. Confirm its assigned KIOSK number with the Custodial Manager.';
    if (['operation_cancelled', 'operation_expired', 'credential_unavailable'].includes(reason)) {
      return 'That protected setup has expired or was cancelled. Ask for a current manager code and try again.';
    }
    return 'That manager code was rejected before a phone credential was created. Check the code and try again.';
  }

  async function reconcileTerminalEnrollmentFailure(error, operation) {
    if (error?.code !== 'custodial_native_enrollment_terminal') return;
    let reconciliationFailure = null;
    try { await credentialStore.ensureSecurityState(); }
    catch (failure) { reconciliationFailure = failure; }
    const remaining = credentialStore.getPendingEnrollmentOperation();
    if (remaining) {
      throw Object.assign(new Error('The rejected enrollment could not be reconciled safely. Restart the Custodial app before trying again.'), {
        code: 'custodial_native_terminal_reconciliation_failed',
        cause: reconciliationFailure || error,
      });
    }
    if (reconciliationFailure && security.getStatus().quarantined !== true) throw reconciliationFailure;
    throw Object.assign(new Error(safeEnrollmentTerminalMessage(error)), {
      code: 'custodial_native_enrollment_terminal',
      status: nativeCustodialHttpStatus(error),
      operation_id: operation.operation_id,
      cause: error,
    });
  }

  async function requireRecoveryForRejectedCredential(response, payload = null) {
    const reason = credentialRecoveryReasonForResponse(response?.status, payload);
    if (reason) await credentialStore.requireManagerRecovery(reason);
  }

  function publicUnauthenticatedRoute(url, method) {
    if (method !== 'GET') return false;
    return url.pathname === '/version'
      || url.pathname === '/dashboard-api/current-attendance';
  }

  async function bridgeFetch(input, init = {}, { confirmationRetry = false } = {}) {
    const url = target(input);
    if (!url || url.origin !== API_ORIGIN) return rawFetch(input, init);
    const requestMethod = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (publicUnauthenticatedRoute(url, requestMethod)) return rawFetch(input, init);
    const retryInput = input instanceof Request ? input.clone() : input;
    const supplied = init.headers || (input instanceof Request ? input.headers : undefined) || {};
    const dispatched = await credentialStore.dispatchAuthorizedTransport(({
      credential,
      deviceId: enrolledDevice,
    }) => {
      if (nativeVault) {
        return nativeCustodialAuthorizedFetch({
          input,
          init: { ...init, headers: supplied, credentials: 'omit' },
          resolvedUrl: url,
          deviceId: enrolledDevice,
        });
      }
      if (!browserTestBuild) {
        throw Object.assign(new Error('The first-party Custodial native vault is unavailable.'), {
          code: 'custodial_native_vault_required',
        });
      }
      if (!browserCredentialTransport) throw new Error('Custodial browser test transport is unavailable.');
      return browserCredentialTransport.authorizedFetch(input, init, supplied, credential, enrolledDevice);
    });
    const response = await dispatched.completion;
    await credentialStore.waitForStableState({
      requireEnrollment: true,
      expectedGeneration: dispatched.generation,
    });
    if (response.status === 409) {
      const payload = await responsePayload(response);
      const reconciliation = await reconcileEnrollmentConfirmationRequired({
        status: response.status,
        payload,
        pendingOperation: credentialStore.getPendingEnrollmentOperation(),
        confirmationRetry,
        confirm: confirmPendingEnrollment,
        retry: () => bridgeFetch(retryInput, init, { confirmationRetry: true }),
        requireManagerRecovery: credentialStore.requireManagerRecovery,
      });
      if (reconciliation.handled) return reconciliation.response;
    }
    if (response.status === 401 || response.status === 403) {
      const payload = await responsePayload(response);
      await requireRecoveryForRejectedCredential(response, payload);
    }
    return response;
  }

  async function requestEnvelope(path, options = {}) {
    const headers = new Headers(options.headers || {});
    let body = options.body;
    if (body != null && typeof body !== 'string' && !(body instanceof FormData) && !(body instanceof Blob)) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
    const response = await bridgeFetch(`${API}${String(path).startsWith('/') ? path : `/${path}`}`, {
      method: options.method || 'GET',
      cache: 'no-store',
      signal: options.signal,
      headers,
      body,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw responseError(response, payload);
    return payload;
  }

  async function confirmPendingEnrollment() {
    if (confirmationInFlight) return confirmationInFlight;
    const operation = credentialStore.getPendingEnrollmentOperation();
    if (!operation || operation.status !== 'local_committed_pending_server_confirmation') return null;
    const task = (async () => {
      let response;
      try {
        const dispatched = await credentialStore.dispatchAuthorizedTransport(({
          credential,
          deviceId: enrolledDevice,
        }) => {
          if (nativeVault) return confirmNativeCustodialEnrollment(operation.operation_id);
          if (!browserCredentialTransport) throw new Error('Custodial browser test transport is unavailable.');
          return browserCredentialTransport.request(
            `/custodial-device-auth/enrollment-operations/${encodeURIComponent(operation.operation_id)}/confirm`,
            {
              method: 'POST',
              credential,
              requestedDeviceId: enrolledDevice,
              body: { operation_id: operation.operation_id },
              operationId: operation.operation_id,
            },
          );
        }, {
          allowPendingEnrollmentConfirmation: true,
          expectedEnrollmentOperationId: operation.operation_id,
        });
        response = await dispatched.completion;
        await credentialStore.waitForStableState({
          requireEnrollment: true,
          expectedGeneration: dispatched.generation,
          allowPendingEnrollmentConfirmation: true,
          expectedEnrollmentOperationId: operation.operation_id,
        });
      } catch (error) {
        if ([401, 403].includes(nativeCustodialHttpStatus(error))) {
          await credentialStore.requireManagerRecovery('enrollment_confirmation_rejected');
        }
        throw error;
      }
      await credentialStore.confirmEnrollmentOperation(operation.operation_id);
      return response?.payload?.data || response?.data || {};
    })();
    const tracked = task.finally(() => {
      if (confirmationInFlight === tracked) confirmationInFlight = null;
    });
    confirmationInFlight = tracked;
    return tracked;
  }

  async function enrollDevice({ deviceId: requestedDevice, managerCode, flow = 'enrollment' } = {}) {
    const selected = String(requestedDevice || '').trim().toUpperCase();
    const code = String(managerCode || '').replace(/\D/g, '').slice(0, 8);
    if (!/^KIOSK_(0[2-9]|10)$/.test(selected)) throw new Error('A canonical employee phone identity is required.');
    if (!['enrollment', 'recovery'].includes(flow)) throw new Error('The enrollment flow is invalid.');

    const operation = await credentialStore.prepareEnrollmentOperation({ deviceId: selected, flow });
    if (operation.status === 'local_committed_pending_server_confirmation') {
      await confirmPendingEnrollment();
      return { operation_id: operation.operation_id, flow, device_id: selected, replayed: true };
    }

    let response;
    let payload;
    let data;
    let credential;
    if (nativeVault) {
      let result;
      try {
        if (operation.newly_created === true) {
          if (!/^\d{8}$/.test(code)) throw new Error('An eight-digit manager code is required.');
          result = await nativeCustodialEnroll({
            deviceId: selected,
            managerCode: code,
            operationId: operation.operation_id,
            flow,
          });
        } else {
          try {
            result = await resumeNativeCustodialEnrollment(operation.operation_id);
          } catch (error) {
            if (![
              'custodial_native_enrollment_resume_refused',
              'custodial_native_enrollment_conflict',
            ].includes(error?.code)) throw error;
            if (!/^\d{8}$/.test(code)) throw new Error('Re-enter the eight-digit manager code to start the saved operation.');
            // A recovery journal is written before its first native call. If
            // the prior credential is still ACTIVE after process death, the
            // native vault—not Web Storage—revalidates it against the exact
            // server status contract before allowing this operation to start.
            result = await nativeCustodialEnroll({
              deviceId: selected,
              managerCode: code,
              operationId: operation.operation_id,
              flow,
            });
          }
        }
      } catch (error) {
        await reconcileTerminalEnrollmentFailure(error, operation);
        throw error;
      }
      response = { status: Number(result?.status || 0), ok: Number(result?.status) >= 200 && Number(result?.status) < 300 };
      payload = result?.payload || null;
      data = payload?.data || {};
      if (Object.hasOwn(data, 'device_credential')) {
        throw Object.assign(new Error('The native vault attempted to expose protected credential material.'), {
          code: 'custodial_native_credential_exposure_refused',
        });
      }
      credential = CUSTODIAL_NATIVE_CREDENTIAL_HANDLE;
    } else {
      if (!browserTestBuild) {
        throw Object.assign(new Error('The first-party Custodial native vault is unavailable.'), {
          code: 'custodial_native_vault_required',
        });
      }
      if (!browserCredentialTransport) throw new Error('Custodial browser test transport is unavailable.');
      if (!/^\d{8}$/.test(code)) throw new Error('An eight-digit manager code is required.');
      const result = await browserCredentialTransport.enroll({ selected, code, operation, flow });
      ({ response, payload, data, credential } = result);
    }
    if (!response.ok || !payload?.ok) throw responseError(response, payload);
    const returnedDevice = String(data.device_id || '').trim().toUpperCase();
    const returnedOperation = String(data.operation_id || '').trim();
    const returnedFlow = String(data.flow || '').trim();
    if (returnedDevice !== selected || returnedOperation !== operation.operation_id || returnedFlow !== flow || !credential) {
      throw new Error('The enrollment response did not prove the requested resumable phone operation.');
    }

    await credentialStore.commitEnrollmentOperation({
      operationId: operation.operation_id,
      credential,
      deviceId: selected,
      credentialId: data.credential_id,
      resumeExpiresAt: data.resume_expires_at,
    });
    await confirmPendingEnrollment();
    return data;
  }

  async function removeEnrollment() {
    if (removalInFlight) return removalInFlight;
    const task = credentialStore.removeEnrollment({
      beforeRemove: async ({ credential, deviceId: enrolledDevice, operationId, checkpoint }) => {
        let result;
        if (nativeVault) {
          result = await nativeCustodialRemoveEnrollment({ operationId, deviceId: enrolledDevice });
        } else {
          if (!browserCredentialTransport) throw new Error('Custodial browser test transport is unavailable.');
          result = await browserCredentialTransport.request('/custodial-device-auth/remove', {
            method: 'POST',
            credential,
            requestedDeviceId: enrolledDevice,
            operationId,
            body: { operation_id: operationId, device_id: enrolledDevice },
          });
        }
        const statusCode = Number(result?.status || 200);
        const payload = result?.payload || result;
        if (statusCode < 200 || statusCode >= 300 || payload?.ok === false) {
          throw responseError({ status: statusCode }, payload);
        }
        await checkpoint('server_logged_out');
      },
    });
    const tracked = task.finally(() => {
      if (removalInFlight === tracked) removalInFlight = null;
    });
    removalInFlight = tracked;
    return tracked;
  }

  async function cancelPendingEnrollment() {
    const operation = credentialStore.getPendingEnrollmentOperation();
    if (!operation || operation.status !== 'pending_server') {
      throw new Error('There is no uncommitted enrollment operation to cancel.');
    }
    if (!nativeVault) {
      throw new Error('Browser-test enrollment cancellation requires native state and is unavailable.');
    }
    await cancelNativeCustodialEnrollment(operation.operation_id);
    return credentialStore.cancelPreparedEnrollmentOperation(operation.operation_id);
  }

  async function resumeNativePendingEnrollment(operation) {
    if (!nativeVault || !operation || operation.status !== 'pending_server') return null;
    if (enrollmentResumeInFlight) {
      if (enrollmentResumeOperationId !== operation.operation_id) {
        throw Object.assign(new Error('A different protected enrollment resume is already active.'), {
          code: 'custodial_native_enrollment_conflict',
        });
      }
      return enrollmentResumeInFlight;
    }
    const task = (async () => {
      let result;
      try {
        result = await resumeNativeCustodialEnrollment(operation.operation_id);
      } catch (error) {
        // The local journal is durably written before the first native call. A
        // crash in that narrow window leaves nothing native to resume; the setup
        // form safely asks for the same manager code and starts this exact UUID.
        if (error?.code === 'custodial_native_enrollment_resume_refused') return null;
        if (error?.code === 'custodial_native_enrollment_cancelled') {
          // resumeEnrollment may durably finish a previously requested native
          // cancellation and then report its terminal result as an error. Re-run
          // exact native/local reconciliation in this same boot so the CANCELLED
          // tombstone retires only its matching pending_server journal.
          await credentialStore.ensureSecurityState();
          if (credentialStore.getPendingEnrollmentOperation()) {
            throw Object.assign(new Error('Cancelled native enrollment did not retire its exact local journal.'), {
              code: 'custodial_native_cancelled_operation_mismatch',
            });
          }
          return null;
        }
        throw error;
      }
      const statusCode = Number(result?.status || 0);
      const payload = result?.payload || null;
      const data = payload?.data || {};
      if (statusCode < 200 || statusCode >= 300 || payload?.ok !== true) {
        throw responseError({ status: statusCode }, payload);
      }
      if (Object.hasOwn(data, 'device_credential')) {
        throw Object.assign(new Error('The native vault attempted to expose protected credential material.'), {
          code: 'custodial_native_credential_exposure_refused',
        });
      }
      if (
        String(data.operation_id || '') !== operation.operation_id
        || String(data.device_id || '').toUpperCase() !== operation.device_id
        || String(data.flow || '') !== operation.flow
      ) throw new Error('The resumed native enrollment does not match the durable phone operation.');
      await credentialStore.commitEnrollmentOperation({
        operationId: operation.operation_id,
        credential: CUSTODIAL_NATIVE_CREDENTIAL_HANDLE,
        deviceId: operation.device_id,
        credentialId: data.credential_id,
        resumeExpiresAt: data.resume_expires_at,
      });
      await confirmPendingEnrollment();
      return data;
    })();
    enrollmentResumeOperationId = operation.operation_id;
    const tracked = task.finally(() => {
      if (enrollmentResumeInFlight === tracked) {
        enrollmentResumeInFlight = null;
        enrollmentResumeOperationId = '';
      }
    });
    enrollmentResumeInFlight = tracked;
    return tracked;
  }

  async function resumePendingSecurityWorkflow() {
    if (credentialStore.getRemovalRecord()) return removeEnrollment();
    const enrollment = credentialStore.getPendingEnrollmentOperation();
    if (enrollment?.status === 'pending_server') {
      const resumed = await resumeNativePendingEnrollment(enrollment);
      if (resumed) return resumed;
    }
    return confirmPendingEnrollment();
  }

  function safeNativeRoute(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, location.href);
      const requestedFile = url.pathname.split('/').pop() || '';
      const aliases = new Map([
        ['events.html', 'employee-events.html'],
        ['system-feedback.html', 'employee-feedback.html'],
        ['employee-hub.html', 'index.html'],
        ['start_page1.html', 'index.html'],
      ]);
      const file = aliases.get(requestedFile) || requestedFile;
      const allowed = new Set(['employee-events.html', 'employee-feedback.html', 'messages.html', 'messages-chatscope.html', 'thread.html', 'employee-schedule.html', 'index.html']);
      if (url.origin !== location.origin || !allowed.has(file)) return '';
      if (file !== requestedFile) url.pathname = `${url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1)}${file}`;
      url.searchParams.set('hub', 'employee');
      const id = deviceId();
      if (id) url.searchParams.set('device', id);
      return url.toString();
    } catch { return ''; }
  }

  function routeProtectedRecovery(status) {
    const enrolled = status?.state === 'enrolled'
      && status?.initialized === true
      && status?.ready === true
      && status?.available === true
      && /^KIOSK_(0[2-9]|10)$/.test(String(status?.deviceId || ''));
    const blocked = status?.initialized === true && !enrolled;
    if (!blocked) return;
    const current = location.pathname.split('/').pop() || 'index.html';
    if (current === 'index.html' || current === 'start_page1.html') return;
    const home = new URL('./index.html', location.href);
    home.searchParams.set('protected_recovery', '1');
    location.replace(home.toString());
  }

  function notificationChannel(data = {}) {
    if (data.kind === 'employee_event') return 'employee-events';
    if (data.kind === 'employee_message') return 'employee-messages';
    if (data.kind === 'employee_location_status' && data.status_code === 'overdue') return 'employee-overdue';
    if (data.kind === 'employee_location_status') return 'employee-due-soon';
    return 'employee-messages';
  }

  function notificationId(data = {}) {
    const value = String(data.notification_key || data.message_id || `${Date.now()}-${Math.random()}`);
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 2147483647 || 1;
  }

  async function presentForegroundNotification(event) {
    const notification = event?.notification || {};
    const data = notification.data && typeof notification.data === 'object' ? notification.data : {};
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId(data),
        title: String(notification.title || 'Memphis Zoo'),
        body: String(notification.body || 'You have a new notification.'),
        channelId: notificationChannel(data),
        extra: data,
        autoCancel: true,
      }],
    });
  }

  async function registerPushToken(token) {
    if (!token || !['android', 'ios'].includes(Capacitor.getPlatform())) return null;
    return requestEnvelope('/employee-notifications-api/register', {
      method: 'POST',
      body: {
        token,
        platform: Capacitor.getPlatform(),
        app_version: '1.0.0',
        app_build: String(window.MemphisMobileBuild || ''),
      },
    });
  }

  async function ensurePushRegistration({ requestPermission = false } = {}) {
    if (!['android', 'ios'].includes(Capacitor.getPlatform())) return { supported: false, receive: 'unsupported' };
    const support = await FirebaseMessaging.isSupported();
    if (!support.isSupported) return { supported: false, receive: 'unsupported' };
    if (Capacitor.getPlatform() === 'android') {
      const channels = [
        ['employee-events', 'Events', 'Zoo event updates'],
        ['employee-messages', 'Messages', 'New messages'],
        ['employee-due-soon', 'Schedule updates', 'Your areas have changed'],
        ['employee-overdue', 'Schedule reminders', 'An assigned area needs attention'],
      ];
      for (const [id, name, description] of channels) {
        try {
          await FirebaseMessaging.createChannel({ id, name, description, importance: 5, visibility: 1, vibration: true, sound: 'default' });
        } catch {}
      }
    }
    let permission = await FirebaseMessaging.checkPermissions();
    if (permission.receive !== 'granted' && requestPermission && permission.receive !== 'denied') {
      permission = await FirebaseMessaging.requestPermissions();
    }
    if (permission.receive !== 'granted') return { supported: true, receive: permission.receive, registered: false };
    const localPermission = await LocalNotifications.checkPermissions();
    if (localPermission.display !== 'granted' && requestPermission && localPermission.display !== 'denied') {
      await LocalNotifications.requestPermissions();
    }
    const result = await FirebaseMessaging.getToken();
    const registration = await registerPushToken(result.token);
    return { supported: true, receive: permission.receive, registered: true, registration };
  }

  async function installNotificationRouting() {
    async function persistOpenedNotification(data) {
      const notificationKey = String(data?.notification_key || '').trim();
      const kind = String(data?.kind || '').trim();
      if (!notificationKey || !['employee_event', 'employee_location_status'].includes(kind)) return;
      const id = `${kind}:${notificationKey}`;
      await security.mutateProtectedWork(() => localStorage.setItem(`${NATIVE_NOTIFICATION_OUTBOX_PREFIX}${id}`, JSON.stringify({
        schema_version: 'native-notification-outbox.v1', id, kind, notification_key: notificationKey,
        device_id: deviceId(), created_at: new Date().toISOString(), attempts: 0,
      })));
    }
    async function flushNativeNotificationOutbox() {
      const entries = [];
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(NATIVE_NOTIFICATION_OUTBOX_PREFIX)) continue;
        try { const row = JSON.parse(localStorage.getItem(key) || 'null'); if (row?.schema_version === 'native-notification-outbox.v1') entries.push([key, row]); } catch {}
      }
      for (const [key, row] of entries) {
        try {
          if (row.kind === 'employee_event') await requestEnvelope('/employee-notifications-api/opened', {
            method: 'POST', headers: { 'Idempotency-Key': row.id }, body: { notification_key: row.notification_key },
          });
          else await requestEnvelope('/messaging-api/device-notifications/ack', {
            method: 'POST', headers: { 'Idempotency-Key': row.id }, body: {
              device_id: row.device_id, notification_key: row.notification_key, notification_type: 'location_status',
              action: 'opened', metadata: { source: 'native_notification_action' },
            },
          });
          await security.mutateProtectedWork(() => localStorage.removeItem(key));
        } catch {
          await security.mutateProtectedWork(() => localStorage.setItem(key, JSON.stringify({ ...row, attempts: Number(row.attempts || 0) + 1, last_attempt_at: new Date().toISOString() })));
        }
      }
    }
    const handleAction = async (notification) => {
      const data = notification?.data || notification?.extra || {};
      const route = safeNativeRoute(data.route);
      await persistOpenedNotification(data);
      void flushNativeNotificationOutbox();
      if (route) location.assign(route);
    };
    try {
      await FirebaseMessaging.addListener('tokenReceived', (event) => { void registerPushToken(event.token).catch(() => {}); });
      await FirebaseMessaging.addListener('notificationReceived', (event) => {
        window.dispatchEvent(new CustomEvent('memphis:native-notification-received', { detail: event || {} }));
        if (window.MemphisMobile?.nativeNotifications === true) void presentForegroundNotification(event).catch(() => {});
      });
      await FirebaseMessaging.addListener('notificationActionPerformed', (event) => { void handleAction(event?.notification || {}); });
      await LocalNotifications.addListener('localNotificationActionPerformed', (event) => { void handleAction(event?.notification || {}); });
      window.addEventListener('online', () => { void flushNativeNotificationOutbox(); });
      await Network.addListener('networkStatusChange', (status) => {
        if (status.connected) void flushNativeNotificationOutbox();
      });
      await flushNativeNotificationOutbox();
    } catch {}
  }

  window.fetch = bridgeFetch;
  security.subscribe(routeProtectedRecovery);
  window.MemphisMobile = Object.freeze({
    edition: 'custodial',
    ready: bridgeReady,
    whenReady: () => bridgeReady,
    requestEnvelope,
    requestJson: async (path, options) => (await requestEnvelope(path, options)).data,
    deviceId,
    authoritativeDeviceId,
    saveOfflineScanAuthoritySnapshot,
    loadOfflineAuthoritySnapshot,
    authorizeOfflineNewWork,
    getOfflineAuthorityState,
    beginRollbackFence,
    clearRollbackFence,
    saveCustodialHomeCache,
    readCustodialHomeCache,
    verifyScanEntryAttestation,
    bindScanEntryAttestation,
    consumeScanEntryAttestation,
    createOfflineStartAttestation,
    acknowledgeOfflineCompletion,
    captureOfflineCompletionTime,
    createOfflineCompletionAttestation,
    enrollDevice,
    cancelPendingEnrollment,
    removeEnrollment,
    resumePendingSecurityWorkflow,
    reportProtectedRecoveryDiagnostic,
    reportNfcTransitionDiagnostic: reportNativeCustodialNfcTransitionDiagnostic,
    reconcileRecoveredPreStart,
    ensurePushRegistration,
    securityStatus: security.getStatus,
    nativeOfflineTimeAuthority: Boolean(nativeVault),
    nativeNotifications: false,
  });

  const install = () => {
    window.MemphisAuth = {
      ...(window.MemphisAuth || {}),
      getDeviceId: deviceId,
      readSession: () => null,
      isOpsManager: () => false,
    };
    delete window.MemphisAuth.opsManagerAuthHeaders;
  };
  install();
  const reportVisibleStartScreen = () => {
    const heading = document.querySelector('h1.title-green');
    if (String(heading?.textContent || '').trim() !== 'Start Cleaning') return false;
    void reportNativeCustodialNfcTransitionDiagnostic('start_screen_visible', 'visible');
    return true;
  };
  if (!reportVisibleStartScreen()) {
    const startScreenObserver = new MutationObserver(() => {
      if (reportVisibleStartScreen()) startScreenObserver.disconnect();
    });
    startScreenObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
  setNativeScanRoutingState('idle');
  window.MemphisNativeScanHandoffReady = installNativeScanRouting().catch(() => false);
  void bridgeReady
    .then(() => resumePendingSecurityWorkflow())
    .then(() => installNotificationRouting())
    .then(() => ensurePushRegistration({ requestPermission: false }))
    .catch(() => {});
  document.addEventListener('DOMContentLoaded', install, { once: true });
})();
