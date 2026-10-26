import { installEmployeeSchedule } from './employee-schedule-runtime.js';
import { custodialNewProducerAdmissionsEnabled, requireCustodialNewProducerAdmission } from './new-producer-scope.js';
import { createActiveGpsLifecycle } from './active-gps-lifecycle.js';
import { createNotificationPresentationMode } from './notification-mode.js';
import { principalIdentity, profileMatchesPrincipal, protectedPrincipal, createProtectedFeedbackIdentity } from './protected-principal.js';
import { createFeedbackOutbox } from './feedback-outbox.js';
import { createEventNotificationOpenOutbox } from './event-notification-receipts.js';
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
  getNativeAuthenticatedCompletion,
  retireNativeAuthenticatedCompletion,
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
  getNativeCustodialReadinessObservation,
  getNativeProviderMirrorBridge,
  isCustodialNativeVaultPlatform,
  nativeCustodialAuthorizedFetch,
  nativeCustodialEnroll,
  nativeCustodialHttpStatus,
  nativeCustodialRemovalPreflight,
  nativeCustodialRemoveEnrollment,
  loadNativeCustodialOfflineAuthoritySnapshot,
  reportNativeCustodialRecoveryDiagnostic,
  recoverNativeCustodialPendingScanIntent,
  resumeNativeCustodialEnrollment,
  verifyNativeCustodialScanEntry,
} from './native-security.js';
import {
  credentialRecoveryReasonForResponse,
  reconcileEnrollmentConfirmationRequired,
} from './transport-policy.js';
import { isCustodialNativeScanDestination, resolveCustodialScanTarget } from './scan-target.ts';
import {
  NATIVE_NOTIFICATION_RECEIPT_SCHEMA,
  createNotificationOutboxFlusher,
  captureNotificationOutboxSettlementOrigin,
  settleNotificationOutboxRow,
  createNativeNotificationReceipt,
  receiptMatchesProtectedPrincipal,
  requiresBoundNotificationReceipt,
  persistBoundNativeNotificationReceipt,
  handleNativeNotificationAction,
  NATIVE_NOTIFICATION_LIFECYCLE,
  nativeNotificationReceiptRequest,
  receiveNativeNotification,
} from './notification-receipts.js';
import { createNotificationPresenter } from './notification-presentation.js';
import { createProviderMirror } from './provider-mirror.js';
import { createPrincipalNotificationScheduler } from './notification-schedule.js';
import { createScheduleNotificationAuthority } from './notification-schedule-authority.js';
import { CUSTODIAL_RELEASE_CAPABILITIES, deferredCustodialFeature, custodialNotificationEnabled } from './release-scope.js';

const OFFLINE_SCAN_SNAPSHOT_PREFIX = 'mz_scan_authority_snapshot:';
const SCAN_ENTRY_ATTESTATION_PREFIX = 'mz_native_scan_entry:';
const SCAN_ENTRY_TTL_MS = 15 * 60 * 1000;
const NATIVE_NFC_HANDOFF_PARAMETER = 'mz_nfc_handoff';
const NATIVE_NOTIFICATION_OUTBOX_PREFIX = 'mz_native_notification_outbox:';
const PRESTART_RECOVERY_PREFIX = 'mz_custodial_prestart_recovery:';
const PHONE_SCAN_RESUME_PREFIX = 'mz_phone_scan_resume:';

export function installCustodialBridge({ nativeApplicationSource = null } = {}) {
  const API = 'https://memphis-zoo-mcp.onrender.com';
  const API_ORIGIN = new URL(API).origin;
  const browserTestBuild = typeof __MZ_CUSTODIAL_BROWSER_TEST__ !== 'undefined'
    && __MZ_CUSTODIAL_BROWSER_TEST__ === true;
  const nativeVault = isCustodialNativeVaultPlatform();
  const notificationPresentation = createNotificationPresentationMode({
    capable: ['android', 'ios'].includes(Capacitor.getPlatform())
      && Capacitor.isPluginAvailable('FirebaseMessaging')
      && Capacitor.isPluginAvailable('LocalNotifications'),
    changed: detail => window.dispatchEvent(new CustomEvent('memphis:notification-mode-changed', { detail })),
  });
  let pushRegistrationInFlight = null;
  let pushRegistrationGeneration = 0;
  let pushPermissionRequested = false;
  let notificationPresenter = null;
  let notificationFallback = null;
  const { credentialStore, security } = getCustodialBridgeSecurityRuntime({
    secureStorage: getCustodialProtectedStorage(),
  });
  // Provider mirror is shared by EVERY employee page. Native attachment remains
  // NONE/SUSPENDED until its independent source/configuration gates are met.
  let providerMirror=null,providerPageVisible=true,providerAppActive=true;
  if(nativeVault&&custodialNewProducerAdmissionsEnabled()){
    providerMirror=createProviderMirror({bridge:getNativeProviderMirrorBridge(),
      visible:()=>providerPageVisible&&providerAppActive&&document.hidden!==true,
      current:()=>security.getStatus().ready===true,
      locationMatches:route=>{
        const actual=new URL(window.location.href),expected=new URL(route,actual);
        return actual.origin==='https://localhost'&&expected.origin===actual.origin&&actual.pathname===expected.pathname&&actual.search===expected.search;
      }});
    document.addEventListener('visibilitychange',()=>providerMirror.changed());
    window.addEventListener('pagehide',()=>{providerPageVisible=false;void providerMirror.suspend();});
    window.addEventListener('pageshow',()=>{providerPageVisible=true;providerMirror.changed();});
    window.addEventListener('memphis:custodial-security-state',()=>{void providerMirror.suspend().then(()=>providerMirror.changed());});
    window.addEventListener('online',()=>providerMirror.changed());
    App.addListener('appStateChange',({isActive})=>{providerAppActive=isActive===true;providerMirror.changed();});
    void providerMirror.start();
  }
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
    const archiveRaw = localStorage.getItem(archiveKey);
    const validated = validatedPreStartArchive(
      archiveRaw,
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
    const queueOwner = window.MemphisScanSync;
    const retireQueuedStart = queueOwner?.retirePreservedInterruptedStart;
    if (typeof retireQueuedStart !== 'function') return { state: 'manager_required' };
    try {
      // Archival is not authority to delete whatever occupies this key later.
      // Pin the actual original writer and all three raw records BEFORE the
      // queue/FIFO waits. No caller ID/old archive grants current native work.
      const reader = security.getStatus, writer = security.mutateProtectedWork;
      if (security.native !== true || window.MemphisCustodialSecurity !== security
        || typeof reader !== 'function' || typeof writer !== 'function') throw securityError('custodial_prestart_owner_unavailable');
      const original = reader.call(security), generation = original?.generation;
      const identity = principalIdentity(original?.principal);
      if (!identity || !Number.isSafeInteger(generation) || generation < 1) throw securityError('custodial_prestart_owner_unavailable');
      const requireOriginal = (expectedSession = activeRaw, expectedIndex = indexRaw) => {
        if (window.MemphisCustodialSecurity !== security || security.native !== true
          || security.getStatus !== reader || security.mutateProtectedWork !== writer
          || window.MemphisScanSync !== queueOwner || queueOwner.retirePreservedInterruptedStart !== retireQueuedStart)
          throw securityError('custodial_prestart_owner_changed');
        const live = reader.call(security);
        if (live?.ready !== true || live.available !== true || live.quarantined !== false
          || live.state !== 'enrolled' || live.deviceId !== enrolledDevice || live.generation !== generation
          || principalIdentity(live.principal) !== identity
          || localStorage.getItem(archiveKey) !== archiveRaw
          || localStorage.getItem(sessionKey) !== expectedSession || localStorage.getItem(indexKey) !== expectedIndex)
          throw securityError('custodial_prestart_owner_changed');
      };
      const checkpoint = (context, expectedSession, expectedIndex) => {
        if (typeof context?.assertCurrent !== 'function' || context.deviceId !== enrolledDevice || context.generation !== generation)
          throw securityError('custodial_prestart_owner_unavailable');
        context.assertCurrent(); requireOriginal(expectedSession, expectedIndex); context.assertCurrent();
      };
      requireOriginal();
      const retirement = await retireQueuedStart.call(queueOwner, sessionId, async (currentActions, preservationEvidence) => {
        requireOriginal();
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
      requireOriginal();
      let completed = false;
      const result = await writer.call(security, context => {
        checkpoint(context, activeRaw, indexRaw);
        if (activeRaw !== null) localStorage.removeItem(sessionKey);
        checkpoint(context, null, indexRaw);
        // The exact original index was validated above as one original entry.
        // Never prune a successor index or re-adopt a changed session.
        localStorage.removeItem(indexKey);
        checkpoint(context, null, null);
        completed = true; return true;
      }, { requireEnrollment: true, expectedGeneration: generation });
      if (result !== true || !completed) return { state: 'manager_required' };
      // The native callback lease has closed. Recheck its actual owner/raw
      // readers, never call the expired context or compensate uncertain effects.
      requireOriginal(null, null);
    } catch {
      return { state: 'manager_required' };
    }
    return { state: 'retired_preserved', session_id: sessionId, resumed: true };
  }

  // Private rejection-only owner for the existing recovery journey. No IDs,
  // credentials, ACK or finalizer capability leaves this compiled closure.
  function capturePreStartRecoveryWriter(enrolledDevice) {
    const reader=security.getStatus,writer=security.mutateProtectedWork;
    if(security.native!==true||window.MemphisCustodialSecurity!==security
      ||typeof reader!=='function'||typeof writer!=='function')throw securityError('custodial_prestart_owner_unavailable');
    const original=reader.call(security),generation=original?.generation,identity=principalIdentity(original?.principal);
    if(!identity||!Number.isSafeInteger(generation)||generation<1)throw securityError('custodial_prestart_owner_unavailable');
    const current=()=>{
      if(window.MemphisCustodialSecurity!==security||security.native!==true||security.getStatus!==reader||security.mutateProtectedWork!==writer)
        throw securityError('custodial_prestart_owner_changed');
      const live=reader.call(security);
      if(live?.state!=='enrolled'||live.ready!==true||live.available!==true||live.quarantined!==false
        ||live.deviceId!==enrolledDevice||live.generation!==generation||principalIdentity(live.principal)!==identity)
        throw securityError('custodial_prestart_owner_changed');
    };
    current();
    return Object.freeze({current,async mutate(operation){
      current();
      const result=await writer.call(security,async context=>{
        const check=()=>{if(typeof context?.assertCurrent!=='function'||context.deviceId!==enrolledDevice||context.generation!==generation)
          throw securityError('custodial_prestart_owner_unavailable');context.assertCurrent();current();context.assertCurrent();};
        check();try{return await operation(check);}finally{check();}
      },{requireEnrollment:true,expectedGeneration:generation});
      current();return result; // Native context is closed: actual owner only.
    }});
  }

  async function reconcileRecoveredPreStart() {
    if (!nativeVault) return { state: 'not_applicable' };
    const enrolledDevice = deviceId();
    if (!enrolledDevice) return { state: 'manager_required' };
    try {
    const originalOwner=capturePreStartRecoveryWriter(enrolledDevice);
    const nativeState = await getNativeCustodialVaultState();
    originalOwner.current();
    const disposition = scanJournalDisposition(nativeState.scan_journal_disposition, enrolledDevice);
    if (!disposition) {
      return nativeState.scan_journal_recovery_required === true
        ? { state: 'manager_required' }
        : { state: 'not_applicable' };
    }

    const resumedRetirement = await finishArchivedPreStartRetirement(enrolledDevice, disposition);
    originalOwner.current();
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

    const queueOwner=window.MemphisScanSync;
    const retireQueuedStart=queueOwner?.retirePreservedInterruptedStart,draftReader=queueOwner?.completionDraftExists;
    const sessionKey = `session:${interruptedStart.sessionId}`;
    const archiveKey = `${PRESTART_RECOVERY_PREFIX}${interruptedStart.sessionId}`;
    const indexKey=`${PHONE_SCAN_RESUME_PREFIX}${enrolledDevice}`;
    const originalSessionRaw=localStorage.getItem(sessionKey),originalIndexRaw=localStorage.getItem(indexKey);
    let expectedArchiveRaw=localStorage.getItem(archiveKey);
    const requireBrowser=(expectedSession=originalSessionRaw,expectedIndex=originalIndexRaw)=>{
      originalOwner.current();
      if(window.MemphisScanSync!==queueOwner||queueOwner?.retirePreservedInterruptedStart!==retireQueuedStart||queueOwner?.completionDraftExists!==draftReader
        ||localStorage.getItem(sessionKey)!==expectedSession||localStorage.getItem(indexKey)!==expectedIndex
        ||localStorage.getItem(archiveKey)!==expectedArchiveRaw)throw securityError('local_session_changed');
    };
    const queueReady = await queueOwner?.ready;
    originalOwner.current();
    if (queueReady !== true) return interruptedStartManagerRequired('queue_not_ready');
    if (typeof retireQueuedStart !== 'function') return interruptedStartManagerRequired('queue_retirement_unavailable');
    if (typeof draftReader !== 'function') {
      return interruptedStartManagerRequired('durable_draft_reader_unavailable');
    }

    requireBrowser();
    let retirement;
    try {
      retirement = await retireQueuedStart.call(queueOwner, interruptedStart.sessionId, async (queueActions, preservationEvidence) => {
        requireBrowser();
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
          durableCompletionDraft = await draftReader.call(queueOwner,interruptedStart.sessionId);
        } catch { throw securityError('durable_draft_check_failed'); }
        requireBrowser();
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
        requireBrowser();
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
        requireBrowser();
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
        await originalOwner.mutate(check => {
          check();requireBrowser();
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
          expectedArchiveRaw=localStorage.getItem(archiveKey);
          requireBrowser();check();
        });
        requireBrowser();
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

    requireBrowser();
    if (!originalSessionRaw) return interruptedStartManagerRequired('local_session_missing');
    // Derive the exact remaining index from the original bytes, never from a
    // replacement inserted while the queue/server/native owners were awaited.
    const originalIndex=JSON.parse(originalIndexRaw);
    if(originalIndex?.schema_version!==2||!Array.isArray(originalIndex.sessions)||originalIndex.sessions.length>4)
      throw securityError('custodial_prestart_index_corrupted');
    const remaining=originalIndex.sessions.filter(row=>canonicalSessionId(row?.session_uuid)!==interruptedStart.sessionId);
    if(remaining.length!==originalIndex.sessions.length-1)throw securityError('custodial_prestart_index_corrupted');
    const nextIndex=remaining.length?JSON.stringify({...originalIndex,sessions:remaining,updated_at:new Date().toISOString()}):null;
    await originalOwner.mutate(check => {
      check();requireBrowser();
      localStorage.removeItem(sessionKey);
      requireBrowser(null,originalIndexRaw);check();
      if(nextIndex===null)localStorage.removeItem(indexKey);else localStorage.setItem(indexKey,nextIndex);
      requireBrowser(null,nextIndex);check();
    });
    requireBrowser(null,nextIndex);
    recordInterruptedStartRecovery(interruptedStart.startState, 'retired_preserved');
    return { state: 'retired_preserved', session_id: interruptedStart.sessionId };
    } catch { return {state:'manager_required'}; }
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
    const before = security.getStatus(), id = deviceId(), owner = currentPrincipalIdentity();
    const generation = before.generation;
    validateOfflineScanAuthoritySnapshot(snapshot, id);
    const encoded = JSON.stringify(snapshot);
    const freeze = value => {
      if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
      return value;
    };
    const original = freeze(JSON.parse(encoded));
    validateOfflineScanAuthoritySnapshot(original, id);
    const current = (context = null) => {
      context?.assertCurrent?.();
      const status = security.getStatus();
      if (!Number.isSafeInteger(generation) || generation < 0 || !owner
        || status.ready !== true || status.available !== true || status.quarantined !== false || status.state !== 'enrolled'
        || generation !== status.generation || id !== status.deviceId || id !== deviceId() || owner !== currentPrincipalIdentity()
        || encoded !== JSON.stringify(snapshot)
        || (context && (context.generation !== generation || context.deviceId !== id || context.state !== 'enrolled')))
        throw securityError('custodial_security_generation_changed');
    };
    current();
    if (typeof security.mutateProtectedWork !== 'function') throw securityError('custodial_secure_storage_unavailable');
    const result = await security.mutateProtectedWork(async context => {
      current(context);
      if (nativeVault) {
        const anchored = await anchorNativeCustodialOfflineAuthoritySnapshot({
          deviceId: id,
          snapshotId: original.snapshot_id,
          generatedAt: original.generated_at,
          expiresAt: original.expires_at,
          snapshot: original,
        });
        current(context);
        if (anchored?.anchored !== true) throw new Error('The protected offline time anchor could not be saved.');
      } else if (!browserTestBuild) {
        throw new Error('The native vault is required to save offline employee authority.');
      }
      current(context);
      localStorage.setItem(`${OFFLINE_SCAN_SNAPSHOT_PREFIX}${id}`, encoded);
      current(context);
      return true;
    }, { requireEnrollment: true, expectedGeneration: generation });
    current();
    return result;
  }

  async function loadOfflineAuthoritySnapshot(requestedDeviceId) {
    await bridgeReady;
    const before = security.getStatus(), id = deviceId(), owner = currentPrincipalIdentity();
    const generation = before.generation;
    if (!id || String(requestedDeviceId || '').trim().toUpperCase() !== id) {
      throw new Error('The protected device identity is unavailable for offline work admission.');
    }
    if (!nativeVault) throw new Error('The protected offline-authority capability is unavailable on this phone.');
    const current = (context = null) => {
      context?.assertCurrent?.();
      const status = security.getStatus();
      if (!Number.isSafeInteger(generation) || generation < 0 || !owner
        || status.ready !== true || status.available !== true || status.quarantined !== false || status.state !== 'enrolled'
        || generation !== status.generation || id !== status.deviceId || id !== deviceId() || owner !== currentPrincipalIdentity()
        || (context && (context.generation !== generation || context.deviceId !== id || context.state !== 'enrolled')))
        throw securityError('custodial_security_generation_changed');
    };
    current();
    if (typeof security.mutateProtectedWork !== 'function') throw securityError('custodial_secure_storage_unavailable');
    const result = await security.mutateProtectedWork(async context => {
      current(context);
      const loaded = await loadNativeCustodialOfflineAuthoritySnapshot(id);
      current(context);
      const snapshot = loaded?.snapshot && typeof loaded.snapshot === 'object' ? loaded.snapshot : loaded;
      validateOfflineScanAuthoritySnapshot(snapshot, id);
      const encoded = JSON.stringify(snapshot);
      const freeze = value => {
        if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
        return value;
      };
      const original = freeze(JSON.parse(encoded));
      validateOfflineScanAuthoritySnapshot(original, id);
      current(context);
      localStorage.setItem(`${OFFLINE_SCAN_SNAPSHOT_PREFIX}${id}`, encoded);
      current(context);
      return original;
    }, { requireEnrollment: true, expectedGeneration: generation });
    current();
    return result;
  }

  async function authorizeOfflineNewWork(requestedDeviceId, snapshotId) {
    await bridgeReady;
    const before = security.getStatus(), id = deviceId(), owner = currentPrincipalIdentity();
    const generation = before.generation, originalDevice = String(requestedDeviceId || '').trim().toUpperCase();
    const originalSnapshotId = String(snapshotId || '');
    if (!id || originalDevice !== id || !/^[0-9a-f]{64}$/.test(originalSnapshotId)) {
      throw new Error('The protected offline authority is invalid for new work admission.');
    }
    if (!nativeVault) throw new Error('The protected offline-authority capability is unavailable on this phone.');
    const current = (context = null) => {
      context?.assertCurrent?.();
      const status = security.getStatus();
      if (!Number.isSafeInteger(generation) || generation < 0 || !owner
        || status.ready !== true || status.available !== true || status.quarantined !== false || status.state !== 'enrolled'
        || generation !== status.generation || id !== status.deviceId || id !== deviceId() || owner !== currentPrincipalIdentity()
        || (context && (context.generation !== generation || context.deviceId !== id || context.state !== 'enrolled')))
        throw securityError('custodial_security_generation_changed');
    };
    current();
    if (typeof security.mutateProtectedWork !== 'function') throw securityError('custodial_secure_storage_unavailable');
    const value = await security.mutateProtectedWork(async context => {
      current(context);
      const result = await authorizeNativeCustodialOfflineNewWork(id, originalSnapshotId);
      current(context);
      if (!result || typeof result !== 'object' || Array.isArray(result) || result.authorized !== true)
        throw new Error('The protected offline authority did not authorize new work.');
      const observed = Object.freeze({ authorized: true });
      current(context);
      return observed;
    }, { requireEnrollment: true, expectedGeneration: generation });
    current();
    return value;
  }

  async function getOfflineAuthorityState(requestedDeviceId) {
    await bridgeReady;
    const before = security.getStatus(), id = deviceId(), owner = currentPrincipalIdentity();
    const generation = before.generation, originalDevice = String(requestedDeviceId || '').trim().toUpperCase();
    if (!id || originalDevice !== id || !nativeVault) {
      throw new Error('The protected offline-authority capability is unavailable on this phone.');
    }
    const current = (context = null) => {
      context?.assertCurrent?.();
      const status = security.getStatus();
      if (!Number.isSafeInteger(generation) || generation < 0 || !owner
        || status.ready !== true || status.available !== true || status.quarantined !== false || status.state !== 'enrolled'
        || generation !== status.generation || id !== status.deviceId || id !== deviceId() || owner !== currentPrincipalIdentity()
        || (context && (context.generation !== generation || context.deviceId !== id || context.state !== 'enrolled')))
        throw securityError('custodial_security_generation_changed');
    };
    current();
    if (typeof security.mutateProtectedWork !== 'function') throw securityError('custodial_secure_storage_unavailable');
    const value = await security.mutateProtectedWork(async context => {
      current(context);
      const result = await getNativeCustodialOfflineAuthorityState(id);
      current(context);
      if (!result || typeof result !== 'object' || Array.isArray(result))
        throw new Error('The protected offline-authority state is unavailable or ambiguous.');
      const awaiting = result.occurrences_awaiting_acknowledgement, active = result.rollback_fence_active, fenceId = result.rollback_fence_id;
      if (typeof awaiting !== 'boolean' || typeof active !== 'boolean'
        || (active ? typeof fenceId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(fenceId) : fenceId !== null))
        throw new Error('The protected offline-authority state is unavailable or ambiguous.');
      const observed = Object.freeze({ occurrences_awaiting_acknowledgement: awaiting, rollback_fence_active: active, rollback_fence_id: fenceId });
      current(context);
      return observed;
    }, { requireEnrollment: true, expectedGeneration: generation });
    current();
    return value;
  }

  async function getReadinessObservation(requestedDeviceId) {
    await bridgeReady;
    const before = security.getStatus();
    const id = deviceId(), identity = currentPrincipalIdentity();
    if (!nativeVault || !id || id !== requestedDeviceId || !identity || !Number.isSafeInteger(before.generation)) {
      throw new Error('Current native readiness observation is unavailable.');
    }
    const result = await getNativeCustodialReadinessObservation(id, identity);
    const after = security.getStatus();
    if (before.generation !== after.generation || id !== deviceId() || identity !== currentPrincipalIdentity()) {
      throw new Error('Phone authority changed during readiness observation.');
    }
    return result;
  }

  async function beginRollbackFence(requestedDeviceId) {
    await bridgeReady;
    const before = security.getStatus(), id = deviceId(), owner = currentPrincipalIdentity();
    const generation = before.generation, originalDevice = String(requestedDeviceId || '').trim().toUpperCase();
    if (!id || originalDevice !== id || !nativeVault) {
      throw new Error('The protected rollback-fence capability is unavailable on this phone.');
    }
    const current = (context = null) => {
      context?.assertCurrent?.();
      const status = security.getStatus();
      if (!Number.isSafeInteger(generation) || generation < 0 || !owner
        || status.ready !== true || status.available !== true || status.quarantined !== false || status.state !== 'enrolled'
        || generation !== status.generation || id !== status.deviceId || id !== deviceId() || owner !== currentPrincipalIdentity()
        || (context && (context.generation !== generation || context.deviceId !== id || context.state !== 'enrolled')))
        throw securityError('custodial_security_generation_changed');
    };
    current();
    if (typeof security.mutateProtectedWork !== 'function') throw securityError('custodial_secure_storage_unavailable');
    const value = await security.mutateProtectedWork(async context => {
      current(context);
      const result = await beginNativeCustodialRollbackFence(id);
      current(context);
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('The protected rollback fence was not durably established.');
      const active = result.rollback_fence_active, fenceId = result.rollback_fence_id;
      if (active !== true || typeof fenceId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(fenceId))
        throw new Error('The protected rollback fence was not durably established.');
      const observed = Object.freeze({ rollback_fence_active: true, rollback_fence_id: fenceId.toLowerCase() });
      current(context);
      return observed;
    }, { requireEnrollment: true, expectedGeneration: generation });
    current();
    return value;
  }

  async function clearRollbackFence(requestedDeviceId, rollbackFenceId) {
    await bridgeReady;
    const before = security.getStatus(), id = deviceId(), owner = currentPrincipalIdentity();
    const generation = before.generation, originalDevice = String(requestedDeviceId || '').trim().toUpperCase();
    const originalFenceId = String(rollbackFenceId || '');
    if (!id || originalDevice !== id || !nativeVault) {
      throw new Error('The protected rollback-fence capability is unavailable on this phone.');
    }
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(originalFenceId))
      throw new Error('The protected rollback fence identifier is invalid.');
    const current = (context = null) => {
      context?.assertCurrent?.();
      const status = security.getStatus();
      if (!Number.isSafeInteger(generation) || generation < 0 || !owner
        || status.ready !== true || status.available !== true || status.quarantined !== false || status.state !== 'enrolled'
        || generation !== status.generation || id !== status.deviceId || id !== deviceId() || owner !== currentPrincipalIdentity()
        || (context && (context.generation !== generation || context.deviceId !== id || context.state !== 'enrolled')))
        throw securityError('custodial_security_generation_changed');
    };
    current();
    if (typeof security.mutateProtectedWork !== 'function') throw securityError('custodial_secure_storage_unavailable');
    const value = await security.mutateProtectedWork(async context => {
      current(context);
      const result = await clearNativeCustodialRollbackFence(id, originalFenceId);
      current(context);
      if (!result || typeof result !== 'object' || Array.isArray(result) || result.cleared !== true)
        throw new Error('The protected rollback fence was not cleared.');
      const observed = Object.freeze({ cleared: true });
      current(context);
      return observed;
    }, { requireEnrollment: true, expectedGeneration: generation });
    current();
    return value;
  }

  function currentPrincipal() { return protectedPrincipal(security.getStatus()?.principal); }
  function currentPrincipalIdentity() { return principalIdentity(currentPrincipal()); }
  function homeCacheKey(principal) { return `mz_custodial_home_cache:${encodeURIComponent(principalIdentity(principal))}`; }

  async function saveCustodialHomeCache(value) {
    await bridgeReady;
    const id = deviceId();
    if (!id || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The employee Home cache is invalid.');
    const principal = currentPrincipal(), identity = principalIdentity(principal);
    if (!identity || !profileMatchesPrincipal(value.profile, principal) || value.profile?.authenticated !== true) throw new Error('Employee identity changed.');
    const record = {
      schema_version: 'custodial-home-cache.v4',
      device_id: id,
      principal,
      cached_at: new Date().toISOString(),
      profile: value.profile && typeof value.profile === 'object' ? value.profile : null,
    };
    if (!record.profile) throw new Error('Employee identity is required for the Home cache.');
    const encoded = JSON.stringify(record);
    await security.mutateProtectedWork(() => {
      if (identity !== currentPrincipalIdentity()) throw new Error('Employee identity changed.');
      localStorage.setItem(homeCacheKey(principal), encoded);
      if (localStorage.getItem(homeCacheKey(principal)) !== encoded) throw new Error('Employee Home cache write verification failed.');
    });
    return record;
  }

  function readCustodialHomeCache() {
    const id = deviceId();
    const principal = currentPrincipal(), identity = principalIdentity(principal);
    if (!id || !identity) return null;
    try {
      const record = JSON.parse(localStorage.getItem(homeCacheKey(principal)) || 'null');
      if (record?.device_id !== id || !record.profile) return null;
      if (record.schema_version !== 'custodial-home-cache.v4' || principalIdentity(record.principal) !== identity
        || !profileMatchesPrincipal(record.profile, principal)) return null;
      const cachedAt = Date.parse(String(record.cached_at || ''));
      const profileDevice = String(record.profile.canonical_device_id || record.profile.device_id || '').trim().toUpperCase();
      if (!Number.isFinite(cachedAt) || Date.now() - cachedAt < 0 || Date.now() - cachedAt > 24 * 60 * 60 * 1000) return null;
      if (record.profile.authenticated !== true || profileDevice !== id) return null;
      return { schema_version: 'custodial-home-cache.v4', principal, device_id: id, cached_at: record.cached_at, profile: record.profile };
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

  async function getAuthenticatedCompletion({deviceId:requestedDeviceId,completionPayload,expectedGeneration=null}) {
    // This is a stored native HTTPS-captured original receipt, NOT fresh SQL.
    // Capture caller bounds before either initialization or native await; an
    // A->B->A principal return must not authorize an old asynchronous result.
    const before=security.getStatus(),owner=currentPrincipalIdentity();
    const generation=expectedGeneration===null?before.generation:expectedGeneration;
    if(!Number.isSafeInteger(generation)||generation<0||before.generation!==generation||!owner)
      throw securityError('custodial_security_generation_changed');
    const encoded=JSON.stringify(completionPayload);
    if(typeof encoded!=='string')throw securityError('custodial_native_server_receipt_required');
    const freeze=value=>{
      if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
      return value;
    };
    const original=freeze(JSON.parse(encoded));
    await bridgeReady;
    const id=deviceId();
    if (!id || String(requestedDeviceId||'').trim().toUpperCase()!==id) throw securityError('custodial_native_device_binding_mismatch');
    const current=()=>{
      if(generation!==security.getStatus()?.generation||owner!==currentPrincipalIdentity()
        ||id!==deviceId()||encoded!==JSON.stringify(completionPayload))
        throw securityError('custodial_security_generation_changed');
    };
    current();
    if (!nativeVault) return Object.freeze({found:false});
    await security.waitForStableState({requireEnrollment:true,expectedGeneration:generation});current();
    let value=await getNativeAuthenticatedCompletion({deviceId:id,completionPayload:original});
    current();
    await security.waitForStableState({requireEnrollment:true,expectedGeneration:generation});current();
    if (typeof value?.found!=='boolean') throw securityError('custodial_native_server_receipt_required');
    // Only Main's native-owned fixed READ/capture mount may advertise this
    // capability. Old native getters omit it: platform/path presence alone
    // never enables the lookup. This hint is NOT completion acceptance.
    if(value.found||value.fixed_read_capture_protocol!=='native-server-completion-fixed-read.v1'||expectedGeneration===null)return value;
    if(!original||typeof original!=='object'||Array.isArray(original))
      throw securityError('custodial_native_server_receipt_required');
    current();
    // Outside any protected mutation: the existing authorized native dispatch
    // fences the ORIGINAL generation. No WRITE resend or replacement original
    // operation/payload; only the fixed READ envelope wraps those same values.
    // Ignore HTTP found/result: actual native TLS capture must retain the READ
    // purpose before a subsequent native journal reread can supply acceptance.
    await requestEnvelope('/scan-api/original-completion',{
      method:'POST',body:{completion_payload:original},expectedGeneration:generation,
    });
    current();
    await security.waitForStableState({requireEnrollment:true,expectedGeneration:generation});current();
    value=await getNativeAuthenticatedCompletion({deviceId:id,completionPayload:original});
    current();
    await security.waitForStableState({requireEnrollment:true,expectedGeneration:generation});current();
    // No native receipt is NOT server nonacceptance or a new resend grant.
    // Preserve existing original-idempotent submission authorization separately;
    // actual native/transport unknown errors propagate, never becoming false.
    if(typeof value?.found!=='boolean')throw securityError('custodial_native_server_receipt_required');
    return value;
  }
  async function retireAuthenticatedCompletion({deviceId:requestedDeviceId,completionPayload,expectedGeneration=null}) {
    // Local native effect only: keep its lifetime inside the EXISTING protected
    // FIFO. Neither cached receipt shape nor this JS fence is current SQL proof.
    const before=security.getStatus(),owner=currentPrincipalIdentity(),id=deviceId();
    const generation=expectedGeneration===null?before.generation:expectedGeneration;
    if(!Number.isSafeInteger(generation)||generation<0||before.generation!==generation||!owner)
      throw securityError('custodial_security_generation_changed');
    if(!id||String(requestedDeviceId||'').trim().toUpperCase()!==id)
      throw securityError('custodial_native_device_binding_mismatch');
    const encoded=JSON.stringify(completionPayload);
    if(typeof encoded!=='string'||!completionPayload||typeof completionPayload!=='object'||Array.isArray(completionPayload))
      throw securityError('custodial_native_server_receipt_required');
    const freeze=(value)=>{
      if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
      return value;
    };
    const original=freeze(JSON.parse(encoded));
    const current=(context=null)=>{
      context?.assertCurrent?.();
      if(generation!==security.getStatus()?.generation||owner!==currentPrincipalIdentity()||id!==deviceId()
        ||String(requestedDeviceId||'').trim().toUpperCase()!==id||encoded!==JSON.stringify(completionPayload)
        ||(context&&(context.generation!==generation||context.deviceId!==id)))
        throw securityError('custodial_security_generation_changed');
    };
    await bridgeReady;current();
    if(!nativeVault)throw securityError('custodial_native_vault_required');
    if(typeof security.mutateProtectedWork!=='function')throw securityError('custodial_secure_storage_unavailable');
    const value=await security.mutateProtectedWork(async(context)=>{
      current(context);
      // The plugin still requires the original accepted native receipt and no
      // remaining native occurrence. Do not add another deletion authority.
      const result=await retireNativeAuthenticatedCompletion({deviceId:id,completionPayload:original});
      current(context);
      if(result?.retired!==true)throw securityError('custodial_native_server_receipt_required');
      return Object.freeze({retired:true});
    },{requireEnrollment:true,expectedGeneration:generation});
    current();return value;
  }

  async function acknowledgeOfflineCompletion({
    deviceId: requestedDeviceId, locationCode, clientSessionId, nativeFinishScanEntryId, clientStartedAt, clientEndedAt, completionPayload,
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
      deviceId: id, locationCode, clientSessionId, nativeFinishScanEntryId, clientStartedAt, clientEndedAt, completionPayload,
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
          scan = nativeScanTargetFromAttestation(attestation, id);
        } else if (browserTestBuild) {
          scan = await prepareScanTarget(url, 'native-nfc');
        }
        if (!scan) throw Object.assign(new Error('The physical NFC destination was refused.'), {
          code: 'custodial_native_scan_target_refused',
        });
        setNativeScanRoutingState('navigating');
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
    MZ_CUSTODIAL_BROWSER_TEST: {
      if (browserTestBuild) window.__dispatchCustodialNativeScanForTest = handleNativeScanUrl;
    }
    await App.addListener('appUrlOpen', ({ url }) => {
      if (nativeNfcHandoffId(url)) void handleNativeScanUrl(url).catch(() => {});
    });
    if (nativeNfcHandoffId(location.href)) return handleNativeScanUrl(location.href);
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

  async function bridgeFetch(input, init = {}, { confirmationRetry = false, expectedGeneration = null } = {}) {
    const url = target(input);
    if (!url || url.origin !== API_ORIGIN) return rawFetch(input, init);
    const requestMethod = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    // Browser builds may call these public reads directly. The native WebView must
    // use the attested transport so startup does not depend on browser CORS.
    if (!nativeVault && publicUnauthenticatedRoute(url, requestMethod)) return rawFetch(input, init);
    const retryInput = input instanceof Request ? input.clone() : input;
    const supplied = init.headers || (input instanceof Request ? input.headers : undefined) || {};
    const schedulePrincipal = currentPrincipalIdentity();
    const scheduleResponseTicket = url.pathname === '/schedule-api/my-day-summary' && requestMethod === 'GET' && schedulePrincipal
      ? await scheduleNotificationAuthority.beginResponse(schedulePrincipal) : null;
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
    }, {expectedGeneration});
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
        retry: () => bridgeFetch(retryInput, init, { confirmationRetry: true, expectedGeneration }),
        requireManagerRecovery: credentialStore.requireManagerRecovery,
      });
      if (reconciliation.handled) return reconciliation.response;
    }
    if (response.status === 401 || response.status === 403) {
      const payload = await responsePayload(response);
      await requireRecoveryForRejectedCredential(response, payload);
    }
    // Native status capture has already authenticated and persisted the exact
    // assignment. Refresh only after the old dispatch-generation check above.
    if (nativeVault && url.pathname === '/device-auth/status' && requestMethod === 'GET' && response.ok) {
      await credentialStore.ensureSecurityState();
    }
    if (url.pathname === '/schedule-api/my-day-summary' && requestMethod === 'GET'
      && schedulePrincipal && schedulePrincipal === currentPrincipalIdentity()) {
      if(response.ok){
        const payload=await responsePayload(response);
        try{
          if(payload?.ok!==true)throw Error('Schedule response unavailable.');
          if(await scheduleNotificationAuthority.observe(payload.data,schedulePrincipal,scheduleResponseTicket)!==true)
            await scheduleNotificationAuthority.unavailable(schedulePrincipal,scheduleResponseTicket);
        }catch{await scheduleNotificationAuthority.unavailable(schedulePrincipal,scheduleResponseTicket);}
      }else await scheduleNotificationAuthority.unavailable(schedulePrincipal,scheduleResponseTicket);
      // Observe the exact authenticated response before any Home/Schedule cache
      // write. Failed storage cannot revive an already-observed terminal alert.
      void reconcileScheduleNotifications();
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
    }, {expectedGeneration: options.expectedGeneration});
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
    // Reject missing original admission before credential-store stages a
    // durable browser intent or clears its active-enrollment presentation.
    // The native effect repeats the owning admission under its own fence.
    if (nativeVault) await nativeCustodialRemovalPreflight();
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
        ['employee-events.html', 'events.html'],
        ['system-feedback.html', 'employee-feedback.html'],
        ['employee-hub.html', 'index.html'],
        ['start_page1.html', 'index.html'],
      ]);
      const file = aliases.get(requestedFile) || requestedFile;
      if(deferredCustodialFeature(file))return '';
      const allowed = new Set(['events.html', 'employee-feedback.html', 'messages.html', 'messages-chatscope.html', 'thread.html', 'employee-schedule.html', 'index.html']);
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
    if (data.kind === 'employee_lunch_coverage') return 'employee-lunch-coverage';
    if (data.kind === 'employee_location_status' && data.status_code === 'overdue') return 'employee-overdue';
    if (data.kind === 'employee_location_status') return 'employee-due-soon';
    return 'employee-messages';
  }

  const scheduleNotificationAuthority=createScheduleNotificationAuthority({
    identity:currentPrincipalIdentity,principal:currentPrincipal,status:security.getStatus,storage:localStorage,
    mutate:security.mutateProtectedWork,
  });
  let acceptedLocationSessionRead=null;
  async function refreshAcceptedLocationSessions(){
    const scope=currentPrincipalIdentity(),p=currentPrincipal();
    const health=security.getStatus();
    const generation=health?.generation;
    if(!scope||!p||health?.ready!==true||health?.available!==true||health?.quarantined===true
      ||!Number.isSafeInteger(generation)||generation<0)return false;
    // A single flight belongs to its original principal/generation/schedule
    // read token. An invalidated flight is not today's read merely because
    // its HTTP is still settling. Keep its cleanup private and let only a
    // currently admitted owner request the next read; never replay a START.
    if(acceptedLocationSessionRead?.current())return acceptedLocationSessionRead.task;
    const owner=JSON.stringify([p.device_id,p.employee_id,p.credential_id,p.assignment_epoch]);
    const read=scheduleNotificationAuthority.beginAcceptedLocationSessionRead(scope);
    const current=()=>security.getStatus()?.generation===generation&&currentPrincipalIdentity()===scope
      &&owner===JSON.stringify([currentPrincipal()?.device_id,currentPrincipal()?.employee_id,currentPrincipal()?.credential_id,currentPrincipal()?.assignment_epoch])
      &&scheduleNotificationAuthority.acceptedLocationSessionReadCurrent(read,scope);
    if(!read||!current())return false;
    const task=(async()=>{
      try{
        if(!current())return false;
        const payload=await requestEnvelope(`/message-api/device-location-status-reminders?device_id=${encodeURIComponent(p.device_id)}&limit=5&accepted_sessions=1`,
          {expectedGeneration:generation,signal:AbortSignal.timeout(8000)});
        if(!current())return false;
        const rows=payload?.meta?.accepted_location_sessions;
        if(!Array.isArray(rows)||rows.length>128)return false;
        for(const row of rows){
          if(!current()||!scheduleNotificationAuthority.observeAcceptedLocationSession(row,scope,read))return false;
        }
        return current();
      }catch{return false;}finally{scheduleNotificationAuthority.finishAcceptedLocationSessionRead(read);}
    })();
    const flight=Object.freeze({task,current});
    acceptedLocationSessionRead=flight;
    try{return await task;}finally{if(acceptedLocationSessionRead===flight)acceptedLocationSessionRead=null;}
  }
  async function reconcileScheduleNotifications(){
    try{await scheduleNotificationAuthority.refresh();}catch{await scheduleNotificationAuthority.unavailable();}
    await refreshAcceptedLocationSessions();
    const pollRetired=window.MemphisDeviceReminders?.reconcileScheduleAuthority?.();
    // Both paths retain failed cancellation/removal work. This is NOT an ACK.
    // Capability is the immutable platform/plugin boundary, not permission or
    // registration readiness. Do not materialize a plugin to cancel retained
    // work on an incapable platform. False reports skipped/preserved, not ACK
    // or successful native cleanup; the browser presenter still retries.
    const nativeReconciliation=notificationPresentation.snapshot().capable
      ?nativeNotificationScheduler.reconcile():Promise.resolve(false);
    const results=await Promise.allSettled([nativeReconciliation,notificationPresenter?.retry()]);
    return pollRetired!==false&&results.every(result=>result.status==='fulfilled')&&results[0].value!==false;
  }
  // The actual normal reconciliation owns its ENTIRE async continuation,
  // including accepted-session transport and later reminder/native writers.
  // This keeps a committed render's scheduling notice pending until that real
  // invocation terminates; it does not replay a callback or admit a receipt.
  if(nativeApplicationSource)reconcileScheduleNotifications=nativeApplicationSource.wrapNativeWriter(
    reconcileScheduleNotifications,true,'BRIDGE_RECONCILE');
  const nativeNotificationScheduler = createPrincipalNotificationScheduler({
    nativeApplicationSource,
    identity:currentPrincipalIdentity,mutate:security.mutateProtectedWork,storage:localStorage,
    nativeStatus:security.getStatus,requireNativeOwner:nativeVault,
    prefix:`${NATIVE_NOTIFICATION_OUTBOX_PREFIX}schedule:`,plugin:LocalNotifications,
    isCurrent:(notification,scope)=>custodialNotificationEnabled(notification?.extra)
      &&scheduleNotificationAuthority.isCurrent(notification?.extra,scope),
  });

  function notificationId(data = {}) {
    const value = String(data.notification_key || data.message_id || `${Date.now()}-${Math.random()}`);
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 2147483647 || 1;
  }

  // Rejection-only owner for these private notification ports. A principal
  // string alone cannot let an old permission/writer await adopt a new native
  // generation. The existing native mutator still owns every actual write.
  function captureOriginalNotificationWriter(expectedPrincipal, expectedGeneration) {
    const reader=security.getStatus,writer=security.mutateProtectedWork;
    if(security.native!==true||typeof reader!=='function'||typeof writer!=='function')throw new Error('Original native notification writer unavailable.');
    const before=reader.call(security),generation=before?.generation,principal=principalIdentity(before?.principal),device=before?.deviceId;
    if(!principal||principal!==expectedPrincipal||!Number.isSafeInteger(generation)||generation<1
      ||expectedGeneration!==undefined&&expectedGeneration!==generation)throw new Error('Original native notification writer changed.');
    const current=()=>{
      try {
      if(security.native!==true||security.getStatus!==reader||security.mutateProtectedWork!==writer)return false;
      const now=reader.call(security);
      return now?.state==='enrolled'&&now.ready===true&&now.available===true&&now.quarantined===false
        &&now.generation===generation&&now.deviceId===device&&principalIdentity(now.principal)===principal
        &&currentPrincipalIdentity()===principal;
      } catch { return false; }
    };
    const requireCurrent=()=>{if(!current())throw new Error('Original native notification writer changed.');};
    requireCurrent();
    return Object.freeze({generation,current,requireCurrent,checkpoint(context){
      if(typeof context?.assertCurrent!=='function'||context.generation!==generation||context.deviceId!==device)
        throw new Error('Original native notification checkpoint unavailable.');
      context.assertCurrent();requireCurrent();context.assertCurrent();
    }});
  }

  async function presentForegroundNotification(event, expectedPrincipal = currentPrincipalIdentity()) {
    if(!custodialNotificationEnabled(event?.notification?.data))return false;
    if (!notificationPresentation.native) return false;
    // OS permission can change while this page is alive. Never record displayed
    // for a schedule skipped because permission was revoked or setup changed.
    let original=null;
    try {
      original=nativeVault?captureOriginalNotificationWriter(expectedPrincipal):null;
      const notificationRaw=JSON.stringify(event?.notification||{}),notification=JSON.parse(notificationRaw);
      original?.requireCurrent();
      const permission = await LocalNotifications.checkPermissions();
      if(original&&!original.current())return false;
      if(JSON.stringify(event?.notification||{})!==notificationRaw)return false;
      notificationPresentation.update({ displayPermission: permission.display || 'unavailable' });
      if (!notificationPresentation.native || expectedPrincipal !== currentPrincipalIdentity()) return false;
      const data = notification.data && typeof notification.data === 'object' ? notification.data : {};
      if(requiresBoundNotificationReceipt(data)&&!receiptMatchesProtectedPrincipal(
        createNativeNotificationReceipt({data,action:'received',deviceId:deviceId()}),currentPrincipal()))return false;
      const presented = await nativeNotificationScheduler.present({
          title: String(notification.title || 'Memphis Zoo'),
          body: String(notification.body || 'You have a new notification.'),
          channelId: notificationChannel(data),
          actionTypeId: ['employee_lunch_coverage','employee_location_status'].includes(data.kind) ? 'custodial-receipt-actions' : undefined,
          extra: data,
          autoCancel: true,
      },expectedPrincipal);
      original?.requireCurrent();
      if(!presented)notificationPresentation.update({displayPermission:'unavailable'});
      return presented;
    } catch {
      if(!original||original.current())notificationPresentation.update({ displayPermission: 'unavailable' });
      // Preserve uncertain intent; do not create a competing browser display.
      throw new Error('Notification scheduling requires owned reconciliation.');
    }
  }

  async function registerPushToken(token) {
    requireCustodialNewProducerAdmission();
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
    if (!custodialNewProducerAdmissionsEnabled()) {
      return Object.freeze({ deferred: true, reason: 'custodial_new_producer_scope_deferred', registered: false });
    }
    pushRegistrationGeneration += 1;
    pushPermissionRequested ||= requestPermission === true;
    // New lifecycle/permission intent invalidates earlier readiness immediately.
    // It cannot be answered by an older token-registration response.
    notificationPresentation.update({ registered: false });
    if (pushRegistrationInFlight) return pushRegistrationInFlight.promise;
    const flight = { promise: null };
    pushRegistrationInFlight = flight;
    flight.promise = (async () => {
      try {
      let result;
      let generation;
      do {
        generation = pushRegistrationGeneration;
        const requestPermission = pushPermissionRequested;
        pushPermissionRequested = false;
        result = await refreshPushRegistration({ requestPermission, generation });
      } while (generation !== pushRegistrationGeneration || pushPermissionRequested);
      // No await between the last generation observation and slot release.
      // A later caller starts its own successor, never joins a settled runner.
      if (pushRegistrationInFlight === flight) pushRegistrationInFlight = null;
      return result;
      } finally {
        if (pushRegistrationInFlight === flight) pushRegistrationInFlight = null;
      }
    })();
    return flight.promise;
  }

  async function refreshPushRegistration({ requestPermission, generation }) {
    requireCustodialNewProducerAdmission();
    const commit = patch => {
      if (generation === pushRegistrationGeneration) notificationPresentation.update(patch);
    };
    if (!notificationPresentation.snapshot().capable) return { supported: false, receive: 'unsupported', registered: false };
    try {
    const support = await FirebaseMessaging.isSupported();
    if (!support.isSupported) {
      commit({ receivePermission: 'unsupported', registered: false });
      return { supported: false, receive: 'unsupported', registered: false };
    }
    if (Capacitor.getPlatform() === 'android') {
      const channels = [
        ['employee-events', 'Events', 'Zoo event updates'],
        ['employee-messages', 'Messages', 'New messages'],
        ['employee-due-soon', 'Schedule updates', 'Your areas have changed'],
        ['employee-overdue', 'Schedule reminders', 'An assigned area needs attention'],
        ['employee-lunch-coverage', 'Lunch coverage', 'Temporary coverage during coworker lunches'],
      ];
      for (const [id, name, description] of channels) {
        await FirebaseMessaging.createChannel({ id, name, description, importance: 5, visibility: 1, vibration: true, sound: 'default' });
      }
    }
    let permission = await FirebaseMessaging.checkPermissions();
    if (permission.receive !== 'granted' && requestPermission && permission.receive !== 'denied') {
      permission = await FirebaseMessaging.requestPermissions();
    }
    commit({ receivePermission: permission.receive || 'unavailable' });
    if (permission.receive !== 'granted') {
      commit({ registered: false });
      return { supported: true, receive: permission.receive, registered: false };
    }
    let localPermission = await LocalNotifications.checkPermissions();
    if (localPermission.display !== 'granted' && requestPermission && localPermission.display !== 'denied') {
      localPermission = await LocalNotifications.requestPermissions();
    }
    commit({ displayPermission: localPermission.display || 'unavailable' });
    const result = await FirebaseMessaging.getToken();
    if (!result.token) throw new Error('Notification token unavailable.');
    const registration = await registerPushToken(result.token);
    // Registration crossed a network boundary. Re-read both OS permissions,
    // then publish only if no later token/lifecycle/explicit request superseded it.
    permission = await FirebaseMessaging.checkPermissions();
    localPermission = await LocalNotifications.checkPermissions();
    commit({ receivePermission: permission.receive || 'unavailable',
      displayPermission: localPermission.display || 'unavailable', registered: true });
    return { supported: true, receive: permission.receive, registered: true, registration };
    } catch {
      commit({ registered: false });
      return { supported: true, receive: 'unavailable', registered: false };
    }
  }

  async function installNotificationRouting() {
    let eventOpenWork=Promise.resolve(),eventRoutingEpoch=0,eventRoutingClosed=false,activeEventOwner=null;
    const eventOwner=(data={kind:'employee_event'})=>({scope:currentPrincipalIdentity(),generation:security.getStatus()?.generation,
      epoch:eventRoutingEpoch,href:location.href,data});
    const eventOwnerCurrent=owner=>!eventRoutingClosed&&custodialNotificationEnabled(owner.data)&&owner.scope&&Number.isSafeInteger(owner.generation)
      &&owner.scope===currentPrincipalIdentity()&&owner.generation===security.getStatus()?.generation
      &&owner.epoch===eventRoutingEpoch&&owner.href===location.href;
    const eventOpenOutbox=createEventNotificationOpenOutbox({storage:localStorage,mutate:security.mutateProtectedWork,
      // Recheck this exact action/read owner INSIDE the domain's protected
      // mutation callback too. A new pageshow cannot revive an older epoch.
      getPrincipal:()=>activeEventOwner&&eventOwnerCurrent(activeEventOwner)?currentPrincipal():null,
      getGeneration:()=>security.getStatus()?.generation});
    // Serialize only this Event source/operation owner; never hold protected
    // mutation or the credential FIFO over a network await.
    const queueEventOpen=(owner,work)=>{
      const next=eventOpenWork.then(async()=>{
        if(!eventOwnerCurrent(owner))return false;
        activeEventOwner=owner;try{return await work();}finally{activeEventOwner=null;}
      });
      eventOpenWork=next.catch(()=>{});return next;
    };
    const flushEventOpenOutbox=createNotificationOutboxFlusher(()=>{
      const owner=eventOwner();
      return queueEventOpen(owner,async()=>{
        if(!eventOwnerCurrent(owner))return false;
        const originals=await eventOpenOutbox.pendingOriginals();
        for(const original of originals){
          if(!eventOwnerCurrent(owner))return false;
          const read=eventOpenOutbox.beginOriginalReadback(original);
          if(!read||read.generation!==owner.generation)continue;
          try{
            const response=await requestEnvelope(read.request.path,{method:'GET',expectedGeneration:read.generation,signal:AbortSignal.timeout(8000)});
            if(!eventOwnerCurrent(owner))return false;
            await eventOpenOutbox.settleOriginalReadback(read.token,response.data);
          }catch{ /* Unknown/offline/denied originals remain saved; GET never renews POST. */ }
        }
        return true;
      });
    });
    window.addEventListener('pagehide',()=>{eventRoutingClosed=true;eventRoutingEpoch++;});
    window.addEventListener('pageshow',()=>{eventRoutingClosed=false;void flushEventOpenOutbox();});
    async function persistDeviceNotificationReceipt(data, action, expectedPrincipal = currentPrincipalIdentity(), ownedNotification = null, actionIsCurrent = () => true) {
      return persistBoundNativeNotificationReceipt({data,action,deviceId:deviceId(),
        getPrincipal:()=>expectedPrincipal === currentPrincipalIdentity()
          && (data.native_presentation_principal === undefined || data.native_presentation_principal === expectedPrincipal)
          && actionIsCurrent()
          && (!ownedNotification || nativeNotificationScheduler.ownsAction(ownedNotification))
          ? currentPrincipal() : null,mutate:security.mutateProtectedWork,storage:localStorage,
        prefix:NATIVE_NOTIFICATION_OUTBOX_PREFIX});
    }
    const presentationPrefix = `${NATIVE_NOTIFICATION_OUTBOX_PREFIX}presentation:`;
    // Exact bytes from THIS normal save/readback and exact snapshot object.
    // Lexical weak identity only: no public registry or supplied acceptance flag.
    const nativePresentationSaves=nativeApplicationSource?new WeakMap():null;
    const presentationIdentity = currentPrincipalIdentity;
    const validPresentation = entry => entry && entry.scope === presentationIdentity()
      && ['native','browser',null].includes(entry.owner)
      && entry.key === entry.event?.notification?.data?.notification_key
      && receiptMatchesProtectedPrincipal(createNativeNotificationReceipt({
        data:entry.event.notification.data,action:'received',deviceId:deviceId()}),currentPrincipal());
    notificationPresenter = createNotificationPresenter({
      nativeApplicationSource,
      // Lexical SAME normal storage reader; no public registration/Boolean.
      readSavedNativeData:(scope,key)=>localStorage.getItem(presentationPrefix+JSON.stringify([scope,key])),
      returnedSaveNativeData:snapshot=>nativePresentationSaves?.get(snapshot)??null,
      identity:presentationIdentity,nativeMode:()=>notificationPresentation.native,
      nativeStatus:security.getStatus,requireNativeOwner:nativeVault,
      isCurrent:(event,scope)=>custodialNotificationEnabled(event?.notification?.data)
        &&scheduleNotificationAuthority.isCurrent(event?.notification?.data,scope),
      nativePresent:presentForegroundNotification,
      save:(entry,canWrite=()=>true,bounds={})=>{
        if(nativeVault&&(!Number.isSafeInteger(bounds.expectedGeneration)||bounds.expectedGeneration<1))
          throw new Error('Original notification generation required.');
        const original=nativeVault?captureOriginalNotificationWriter(entry.scope,bounds.expectedGeneration):null;
        return security.mutateProtectedWork(context=>{
        const checkpoint=()=>{original?.checkpoint(context);
          if(!validPresentation(entry)||canWrite()!==true)throw new Error('Notification presentation principal or action lease changed.');
          original?.checkpoint(context);};
        checkpoint();
        if (!Number.isSafeInteger(entry.queueOrdinal) || entry.queueOrdinal<1) {
          let last=0;
          for(let i=0;i<localStorage.length;i++){
            const storedKey=localStorage.key(i);if(!storedKey?.startsWith(presentationPrefix))continue;
            try { const stored=JSON.parse(localStorage.getItem(storedKey));
              if(stored.scope===entry.scope&&Number.isSafeInteger(stored.queueOrdinal))last=Math.max(last,stored.queueOrdinal);
            } catch {}
          }
          if(last>=Number.MAX_SAFE_INTEGER)throw new Error('Notification queue ordinal exhausted.');
          entry.queueOrdinal=last+1;
        }
        const key = presentationPrefix + JSON.stringify([entry.scope,entry.key]);
        const encoded = JSON.stringify({schema_version:'native-notification-presentation.v2',
          scope:entry.scope,key:entry.key,event:entry.event,owner:entry.owner,receiptRecorded:entry.receiptRecorded===true,
          queueOrdinal:entry.queueOrdinal,queueOrderSource:entry.queueOrderSource,
          visualState:entry.visualState,audioState:entry.audioState});
        checkpoint();
        localStorage.setItem(key,encoded);
        checkpoint();
        if (localStorage.getItem(key)!==encoded) throw new Error('Notification presentation readback failed.');
        checkpoint();
        try{nativePresentationSaves?.set(entry,encoded);}catch{/* DATA unavailable; ordinary save remains unchanged. */}
        return true;
      },{requireEnrollment:true,...(original?{expectedGeneration:original.generation}:{})});
      },
      load:()=>security.mutateProtectedWork(()=>{
        const pending=[];
        for(let i=0;i<localStorage.length;i++){
          const key=localStorage.key(i);if(!key?.startsWith(presentationPrefix))continue;
          try{const entry=JSON.parse(localStorage.getItem(key));
            // Reduced-scope v1 rows remain untouched, never rebound or adopted.
            if(entry?.schema_version==='native-notification-presentation.v2'&&validPresentation(entry))pending.push(entry);
          }catch{}
        }
        return pending;
      }),
      displayed:async (event,scope,isCurrent)=>{
        const saved=await persistDeviceNotificationReceipt(event.notification.data,'displayed',scope,null,isCurrent);
        if(saved===true)void flushNativeNotificationOutbox();
        return saved;
      },
      action:async(event,kind,scope,isCurrent)=>{
        if(kind==='dismissed')return true; // Visual dismissal is local only.
        if(!['opened','acknowledged'].includes(kind))return false;
        const saved=await persistDeviceNotificationReceipt(event.notification.data,kind,scope,null,isCurrent);
        if(saved===true)void flushNativeNotificationOutbox();
        return saved;
      },
    });
    // Exact normal owners; no browser callback constitutes OS settlement/ACK.
    nativeApplicationSource?.bindNotificationOwners(Object.freeze({
      presenter: notificationPresenter, scheduler: nativeNotificationScheduler,
      authority: scheduleNotificationAuthority, security, providerMirror,
      principal: currentPrincipalIdentity,
    }));
    if(!nativeApplicationSource&&notificationFallback)notificationPresenter.registerBrowser(notificationFallback);
    window.addEventListener('memphis:notification-mode-changed',()=>{void notificationPresenter.retry();});
    async function persistOpenedNotification(data,owner=eventOwner()) {
      const notificationKey = String(data?.notification_key || '').trim();
      const kind = String(data?.kind || '').trim();
      if (!notificationKey) return;
      if (kind !== 'employee_event') {
        await persistDeviceNotificationReceipt(data, 'opened');
        return;
      }
      // Keep the exact key, not a clipped/trimmed card value or a new v1 row.
      const originalKey=data?.notification_key;
      if(typeof originalKey!=='string'||originalKey!==originalKey.trim()||!originalKey
        ||/[\u0000-\u001f\u007f]/.test(originalKey)||new TextEncoder().encode(originalKey).length>240)return false;
      return queueEventOpen(owner,async()=>{
        if(!eventOwnerCurrent(owner))return false;
        const source=await eventOpenOutbox.beginCurrentEventsRead();
        if(!source||source.generation!==owner.generation||!eventOwnerCurrent(owner))return false;
        let alreadyOpened=false;
        try{
          const response=await requestEnvelope(`/employee-notifications-api/events?notification_key=${encodeURIComponent(originalKey)}`,
            {method:'GET',expectedGeneration:source.generation,signal:AbortSignal.timeout(8000)});
          if(!eventOwnerCurrent(owner)){eventOpenOutbox.unavailableCurrentEvents(source.token);return false;}
          // This is the fixed ORIGINAL read, not a capped-list/card substitute.
          if(!Array.isArray(response.data)||response.data.length!==1||response.data[0]?.notification_key!==originalKey){
            eventOpenOutbox.unavailableCurrentEvents(source.token);return false;
          }
          if(!eventOpenOutbox.acceptCurrentEventsRead(source.token,response.data))return false;
          alreadyOpened=response.data[0].event_validity==='CURRENT'&&response.data[0].state==='opened';
        }catch{eventOpenOutbox.unavailableCurrentEvents(source.token);return false;}
        if(!eventOwnerCurrent(owner))return false;
        // acceptCurrentEventsRead validated the exact typed first-open receipt.
        // Navigation may use that observation; it does not create another POST.
        if(alreadyOpened)return true;
        const original=await eventOpenOutbox.prepareOpen(originalKey);
        if(!original||!eventOwnerCurrent(owner))return false;
        const request=await eventOpenOutbox.beginOpenDispatch(original);
        if(!request){
          // Existing UNKNOWN or failed fence readback is not a successful
          // action. Keep the same original and request only fixed GET recovery.
          void flushEventOpenOutbox();return false;
        }
        if(request.generation!==owner.generation||!eventOwnerCurrent(owner))return false;
        try{
          const response=await requestEnvelope(request.path,{method:'POST',headers:request.headers,body:request.body,
            expectedGeneration:request.generation,signal:AbortSignal.timeout(8000)});
          if(!eventOwnerCurrent(owner))return false;
          await eventOpenOutbox.settleOriginalOpened(original,response.data);
        }catch{ /* DISPATCH_UNKNOWN was saved BEFORE HTTP. No generic retry or cleanup. */ }
        return eventOwnerCurrent(owner);
      });
    }
    const flushNativeNotificationOutbox = createNotificationOutboxFlusher(async () => {
      const entries = [];
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(NATIVE_NOTIFICATION_OUTBOX_PREFIX)) continue;
        try {
          const encoded = localStorage.getItem(key);
          const row = JSON.parse(encoded || 'null');
          if (['native-notification-outbox.v1','native-notification-outbox.v2', NATIVE_NOTIFICATION_RECEIPT_SCHEMA].includes(row?.schema_version)) entries.push([key, row, encoded]);
        } catch {}
      }
      for (const [key, row, encoded] of entries) {
        try {
          if(!custodialNotificationEnabled(row))continue; // Preserve deferred history/outbox; do not mass-send it.
          const originalPrincipal = currentPrincipal();
          const expectedPrincipalIdentity = principalIdentity(originalPrincipal);
          const expectedGeneration = security.getStatus()?.generation;
          const origin = captureNotificationOutboxSettlementOrigin({
            storage:localStorage,key,encoded,row,expectedPrincipalIdentity,expectedGeneration,
            getPrincipal:currentPrincipal,getPrincipalIdentity:currentPrincipalIdentity,
            getGeneration:()=>security.getStatus()?.generation,
          });
          // Legacy Event/v1/v2/unknown originals cannot acquire the next
          // occupant's binding. The separate Event domain is mounted by main.
          if (!origin) continue;
          const request = nativeNotificationReceiptRequest(row);
          if (!request || currentPrincipalIdentity() !== expectedPrincipalIdentity
            || security.getStatus()?.generation !== expectedGeneration) continue;
          const response = await requestEnvelope(request.path, {
            method:'POST',headers:request.headers,body:request.body,expectedGeneration,
          });
          if (currentPrincipalIdentity() !== expectedPrincipalIdentity
            || security.getStatus()?.generation !== expectedGeneration
            || !receiptMatchesProtectedPrincipal(row,currentPrincipal())) continue;
          await settleNotificationOutboxRow({storage:localStorage,mutate:security.mutateProtectedWork,
            key,encoded,row,origin,request,response,delivered:true});
        } catch {
          // Generic transport/denial/confirmation/unknown errors cannot prove
          // NOT_DELIVERED. Preserve the original without attempts or cleanup.
        }
      }
    });
    const handleAction = (notification, actionId) => {
      const data=notification?.data||notification?.extra||{},bound=requiresBoundNotificationReceipt(data);
      if(!custodialNotificationEnabled(data))return Promise.resolve(false);
      if(data.kind==='employee_event'){
        const original=Object.freeze({...data}),owner=eventOwner(original),route=safeNativeRoute(original.route);
        if(actionId!=='tap'||!eventOwnerCurrent(owner)
          ||(data.native_presentation_principal!==undefined&&data.native_presentation_principal!==owner.scope))return Promise.resolve(false);
        return persistOpenedNotification(original,owner).then(saved=>{
          if(saved!==true||!eventOwnerCurrent(owner))return false;
          void flushEventOpenOutbox();if(route)location.assign(route);return true;
        });
      }
      const scope=bound?data.native_presentation_principal:currentPrincipalIdentity();
      if(bound&&(!scope||scope!==currentPrincipalIdentity()))return Promise.resolve(false);
      return handleNativeNotificationAction({notification,actionId,
      persist:(value,action)=>persistDeviceNotificationReceipt(value,action,scope,notification),persistEventOpened:persistOpenedNotification,
      flush:flushNativeNotificationOutbox,navigate:data=>{
        if(scope!==currentPrincipalIdentity()||(bound&&!nativeNotificationScheduler.ownsAction(notification)))return;
        const route=safeNativeRoute(data.route);if(route)location.assign(route);
      }});
    };
    // Invoking a Capacitor proxy can construct its web implementation before
    // the awaited method settles. Never instantiate native notification plugins
    // on an incapable platform; retain the shared browser recovery below.
    if (notificationPresentation.snapshot().capable) {
    let localRoutingReady = false;
    try {
      if(custodialNewProducerAdmissionsEnabled())await LocalNotifications.registerActionTypes({types:[{id:'custodial-receipt-actions',actions:[{id:'acknowledge',title:'Acknowledge'}]}]});
      await LocalNotifications.addListener('localNotificationActionPerformed', (event) => { void handleAction(event?.notification || {}, event?.actionId).catch(() => {}); });
      localRoutingReady = true;
    } catch {}
    try {
      await FirebaseMessaging.addListener('tokenReceived', () => { void ensurePushRegistration(); });
      await FirebaseMessaging.addListener('notificationReceived', (event) => {
        if(!custodialNotificationEnabled(event?.notification?.data))return;
        const arrivalPrincipal = currentPrincipalIdentity();
        void receiveNativeNotification({event,persist:(data,action)=>persistDeviceNotificationReceipt(data,action,arrivalPrincipal),
          dispatch:value=>window.dispatchEvent(new CustomEvent('memphis:native-notification-received',{detail:value||{}})),
          present:async value=>{
            if(requiresBoundNotificationReceipt(value?.notification?.data||{})){
              if(arrivalPrincipal !== currentPrincipalIdentity())return false;
              await notificationPresenter.accept(value);
              return false; // Coordinator owns the exact display receipt.
            }
            return presentForegroundNotification(value,arrivalPrincipal);
          },shouldPresent:true,
          flush:flushNativeNotificationOutbox}).catch(() => {});
      });
      await FirebaseMessaging.addListener('notificationActionPerformed', (event) => { void handleAction(event?.notification || {}, event?.actionId).catch(() => {}); });
      notificationPresentation.update({ routingReady: localRoutingReady });
    } catch { notificationPresentation.update({ routingReady: false }); }
    }
    security.subscribe(value=>{scheduleNotificationAuthority.securityChanged(value);void reconcileScheduleNotifications();});
    window.addEventListener('storage',event=>{
      if(event.key===null||scheduleNotificationAuthority.isStorageKey(event.key))void reconcileScheduleNotifications();
    });
    await reconcileScheduleNotifications();
    await notificationPresenter.restore();
    void flushEventOpenOutbox();
    const refreshNotifications = () => { void ensurePushRegistration(); void flushNativeNotificationOutbox(); void reconcileScheduleNotifications(); void flushEventOpenOutbox(); };
    window.addEventListener('online', refreshNotifications);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshNotifications(); });
    try {
      await App.addListener('resume', refreshNotifications);
      await Network.addListener('networkStatusChange', (status) => {
        if (status.connected) refreshNotifications();
      });
      await flushNativeNotificationOutbox();
    } catch {}
  }

  const feedbackOutbox=createFeedbackOutbox({
    storage:localStorage,
    mutate:operation=>security.mutateProtectedWork(operation),
    identity:createProtectedFeedbackIdentity({ready:()=>bridgeReady,security,currentDeviceId:deviceId,
      online:()=>navigator.onLine!==false,
      refreshStatus:async({expectedGeneration})=>{
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
        try{return (await requestEnvelope('/device-auth/status',{expectedGeneration,signal:controller.signal})).data;}
        finally{clearTimeout(timer);}
      }}),
    request:async(path,options)=>{
      const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
      try{return await requestEnvelope(path,{...options,signal:abort.signal});}finally{clearTimeout(timer);}
    },
    lock:operation=>navigator.locks?.request
      ? navigator.locks.request('memphis-staff-feedback-outbox',{mode:'exclusive',ifAvailable:true},held=>held?operation():[]):operation(),
    onStatus:detail=>window.dispatchEvent(new CustomEvent('memphis:staff-feedback-sync',{detail})),
  });
  const flushFeedback=()=>{if(CUSTODIAL_RELEASE_CAPABILITIES.feedback)void feedbackOutbox.flush().catch(()=>{});};
  const feedbackVisible=()=>{if(!document.hidden)flushFeedback();};
  let feedbackInterval=null,feedbackNetworkListener=null;
  void bridgeReady.then(async()=>{
    if(!CUSTODIAL_RELEASE_CAPABILITIES.feedback)return;
    flushFeedback();feedbackInterval=setInterval(flushFeedback,30000);
    window.addEventListener('online',flushFeedback);document.addEventListener('visibilitychange',feedbackVisible);
    try{feedbackNetworkListener=await Network.addListener('networkStatusChange',state=>{if(state.connected)flushFeedback();});}catch{}
  }).catch(()=>{});
  window.addEventListener('pagehide',()=>{
    if(feedbackInterval)clearInterval(feedbackInterval);
    window.removeEventListener('online',flushFeedback);document.removeEventListener('visibilitychange',feedbackVisible);
    void feedbackNetworkListener?.remove?.();
  },{once:true});

  let activeGpsLifecycle = null;
  let activeGpsNetworkListener = null;
  let activeGpsResumeListener = null;
  let activeGpsGeneration = 0;
  let activeGpsSuspended = false;
  let activeGpsInstalling = false;
  let activeGpsInstalled = false;
  const activeGpsVisible = () => { if (!document.hidden) void reconcileActiveGps('visible'); };
  const activeGpsOnline = () => { void reconcileActiveGps('online'); };
  const removeGpsListener = handle => { try { void Promise.resolve(handle?.remove?.()).catch(() => {}); } catch {} };

  function ensureActiveGpsLifecycle() {
    if (activeGpsLifecycle) return activeGpsLifecycle;
    activeGpsLifecycle = createActiveGpsLifecycle({
      storage: localStorage, deviceId, geolocation: navigator.geolocation,
      enqueue: async (action) => {
        const sync = window.MemphisScanSync;
        if (typeof sync?.enqueue !== 'function' || await sync.ready !== true) {
          throw new Error('The protected GPS outbox is unavailable.');
        }
        return sync.enqueue(action);
      },
      onStatus: detail => { if (!activeGpsSuspended) window.dispatchEvent(new CustomEvent('memphis:active-gps-state', { detail })); },
    });
    return activeGpsLifecycle;
  }

  async function reconcileActiveGps(reason = 'bridge') {
    const generation = activeGpsGeneration;
    await bridgeReady;
    if (activeGpsSuspended || generation !== activeGpsGeneration) return Object.freeze({state:'disposed'});
    if (await window.MemphisScanSync?.ready !== true) return Object.freeze({state:'queue_unavailable'});
    if (activeGpsSuspended || generation !== activeGpsGeneration) return Object.freeze({state:'disposed'});
    return ensureActiveGpsLifecycle().reconcile(reason);
  }

  async function installActiveGpsLifecycle() {
    if (activeGpsSuspended || activeGpsInstalling || activeGpsInstalled) return;
    activeGpsInstalling = true;
    const generation = ++activeGpsGeneration;
    const current = () => !activeGpsSuspended && generation === activeGpsGeneration;
    try {
      await bridgeReady;
      if (!current()) return;
      ensureActiveGpsLifecycle();
      await window.MemphisScanSync?.ready;
      if (!current()) return;
      void reconcileActiveGps('page_load');
      window.addEventListener('online', activeGpsOnline);
      document.addEventListener('visibilitychange', activeGpsVisible);
      const resume = await App.addListener('resume', () => { if(current())void reconcileActiveGps('app_resume'); });
      if (!current()) { removeGpsListener(resume); return; }
      activeGpsResumeListener = resume;
      const network = await Network.addListener('networkStatusChange', status => {
        if(current() && status.connected) void reconcileActiveGps('network_reconnected');
      });
      if (!current()) { removeGpsListener(network); return; }
      activeGpsNetworkListener = network;
      activeGpsInstalled = true;
    } catch {
      if(current())window.dispatchEvent(new CustomEvent('memphis:active-gps-state', {detail:{state:'gps_unavailable'}}));
    } finally { if(generation === activeGpsGeneration) activeGpsInstalling = false; }
  }

  window.addEventListener('pagehide', () => {
    activeGpsSuspended = true;activeGpsGeneration++;
    activeGpsInstalling = false;activeGpsInstalled = false;
    activeGpsLifecycle?.dispose();activeGpsLifecycle = null;
    window.removeEventListener('online', activeGpsOnline);
    document.removeEventListener('visibilitychange', activeGpsVisible);
    removeGpsListener(activeGpsResumeListener);activeGpsResumeListener = null;
    removeGpsListener(activeGpsNetworkListener);activeGpsNetworkListener = null;
  });
  window.addEventListener('pageshow', event => {
    if(event.persisted && activeGpsSuspended) { activeGpsSuspended = false;void installActiveGpsLifecycle(); }
  });

  window.fetch = bridgeFetch;
  security.subscribe(routeProtectedRecovery);
  window.MemphisMobile = Object.freeze({
    edition: 'custodial',
    releaseCapabilities:CUSTODIAL_RELEASE_CAPABILITIES,
    ready: bridgeReady,
    whenReady: () => bridgeReady,
    requestEnvelope,
    saveEmployeeFeedback:body=>CUSTODIAL_RELEASE_CAPABILITIES.feedback?feedbackOutbox.save(body):Promise.reject(new Error('Feedback is not enabled in this release.')),
    flushEmployeeFeedback:()=>CUSTODIAL_RELEASE_CAPABILITIES.feedback?feedbackOutbox.flush():Promise.resolve([]),
    pendingEmployeeFeedback:()=>CUSTODIAL_RELEASE_CAPABILITIES.feedback?feedbackOutbox.readPending():Promise.resolve(Object.freeze({state:'unavailable'})),
    activeGpsLifecycle: true,
    reconcileActiveGps,
    requestJson: async (path, options) => (await requestEnvelope(path, options)).data,
    deviceId,
    authoritativeDeviceId,
    saveOfflineScanAuthoritySnapshot,
    loadOfflineAuthoritySnapshot,
    authorizeOfflineNewWork,
    getOfflineAuthorityState,
    getReadinessObservation,
    beginRollbackFence,
    clearRollbackFence,
    saveCustodialHomeCache,
    readCustodialHomeCache,
    principalIdentity: currentPrincipalIdentity,
    profileMatchesPrincipal: (value) => profileMatchesPrincipal(value, currentPrincipal()),
    verifyScanEntryAttestation,
    bindScanEntryAttestation,
    consumeScanEntryAttestation,
    createOfflineStartAttestation,
    acknowledgeOfflineCompletion,
    getAuthenticatedCompletion,
    retireAuthenticatedCompletion,
    captureOfflineCompletionTime,
    createOfflineCompletionAttestation,
    enrollDevice,
    cancelPendingEnrollment,
    removeEnrollment,
    resumePendingSecurityWorkflow,
    reportProtectedRecoveryDiagnostic,
    reconcileRecoveredPreStart,
    ensurePushRegistration,
    securityStatus: security.getStatus,
    nativeOfflineTimeAuthority: Boolean(nativeVault),
    get nativeNotifications() { return notificationPresentation.native; },
    get notificationPresentation() { return notificationPresentation.snapshot(); },
    registerNotificationFallback(handler) {
      if(nativeApplicationSource)return; // Fixed native renderer cannot be publicly replaced.
      if(typeof handler!=='function')return;
      notificationFallback=handler;
      notificationPresenter?.registerBrowser(handler);
    },
    registerProviderMirrorRenderer(renderer){if(nativeApplicationSource)return;providerMirror?.setRenderer(renderer);},
    retryProviderMirror(){void providerMirror?.reconcile();},
    presentBrowserNotification(key,show) { return notificationPresenter?.presentBrowser(key,show) === true; },
    isLunchNotificationCurrent(data,scope) {
      // Ordinary JS presentation only. Original accepted source/recipient/
      // bounds are checked without synthesizing receipt fields. This is not
      // native claim/clock, ACK, delivery, finalizer or key authority.
      const p=currentPrincipal();
      if(!p||!scope||scope!==currentPrincipalIdentity()||data?.kind!=='employee_lunch_coverage')return false;
      return scheduleNotificationAuthority.isCurrent(data,scope);
    },
    isScheduleReminderCurrent(row,scope) {
      const p=currentPrincipal();
      if(!p||!scope||scope!==currentPrincipalIdentity()||row?.employee_id!==p.employee_id)return false;
      // Only presentation of an authenticated HTTP poll row. Never synthesize
      // a provider job, native receipt or missing schedule projection.
      return scheduleNotificationAuthority.isCurrent({kind:'employee_location_status',
        service_date:row.service_date,projection_id:row.projection_id,
        location_id:row.location_id,notification_key:row.notification_key,
        ...(row.schedule_authority_revision==null?{}:{schedule_authority_revision:row.schedule_authority_revision}),
        receipt_device_id:p.device_id,receipt_employee_id:p.employee_id,
        receipt_credential_id:p.credential_id,receipt_assignment_epoch:p.assignment_epoch},scope);
    },
    retryNotificationPresentation() { return reconcileScheduleNotifications(); },
    isLocationReminderRetired(row,scope) {
      const p=currentPrincipal();
      if(!p||!scope||scope!==currentPrincipalIdentity())return false;
      if(row?.employee_id!==undefined&&row.employee_id!==p.employee_id)return false;
      if(row?.receipt_employee_id!==undefined&&row.receipt_employee_id!==p.employee_id)return false;
      if(row?.receipt_device_id!==undefined&&row.receipt_device_id!==p.device_id)return false;
      if(row?.receipt_credential_id!==undefined&&row.receipt_credential_id!==p.credential_id)return false;
      if(row?.receipt_assignment_epoch!==undefined&&String(row.receipt_assignment_epoch)!==String(p.assignment_epoch))return false;
      return scheduleNotificationAuthority.isLocationReminderRetired({
        ...row,kind:'employee_location_status',
        receipt_device_id:p.device_id,receipt_employee_id:p.employee_id,
        receipt_credential_id:p.credential_id,receipt_assignment_epoch:p.assignment_epoch},scope);
    },
    notificationLifecycle: NATIVE_NOTIFICATION_LIFECYCLE,
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
  setNativeScanRoutingState('idle');
  window.MemphisNativeScanHandoffReady = installNativeScanRouting().catch(() => false);
  if (document.readyState === 'complete') void installActiveGpsLifecycle();
  else window.addEventListener('load', () => { void installActiveGpsLifecycle(); }, { once: true });
  void bridgeReady
    .then(() => resumePendingSecurityWorkflow())
    .then(() => installNotificationRouting())
    .then(() => ensurePushRegistration({ requestPermission: false }))
    .catch(() => {});
  document.addEventListener('DOMContentLoaded', install, { once: true });
  const installSchedule = () => {
    if (new URL(window.location.href).pathname !== '/employee-schedule.html'||!custodialNewProducerAdmissionsEnabled()) return;
    installEmployeeSchedule({ nativeApplicationSource });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installSchedule, { once: true });
  else installSchedule();
  // Native-owned reminder factory starts only after THIS normal bridge's
  // initial security check. This is initialization, never receipt admission.
  if(nativeApplicationSource)void bridgeReady.then(()=>nativeApplicationSource.mountReminderOwner()).catch(()=>{});
}


// Denial-only duplicate startup marker: no private sink or native evidence.
// Forging it can prevent startup; it cannot create a native producer.
if (!Object.getOwnPropertyDescriptor(globalThis, 'custodialNativeNormalApplicationOwner')) {
  installCustodialBridge();
}
