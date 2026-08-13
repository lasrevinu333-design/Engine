import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';
import { getCustodialBridgeSecurityRuntime } from './security-runtime.js';
import {
  CUSTODIAL_NATIVE_CREDENTIAL_HANDLE,
  attestNativeCustodialScanIntent,
  bindNativeCustodialScanEntry,
  consumeNativeCustodialScanEntry,
  cancelNativeCustodialEnrollment,
  confirmNativeCustodialEnrollment,
  getCustodialProtectedStorage,
  isCustodialNativeVaultPlatform,
  nativeCustodialAuthorizedFetch,
  nativeCustodialEnroll,
  nativeCustodialHttpStatus,
  nativeCustodialRemoveEnrollment,
  resumeNativeCustodialEnrollment,
  verifyNativeCustodialScanEntry,
} from './native-security.js';
import { reconcileEnrollmentConfirmationRequired } from './transport-policy.js';
import { resolveCustodialScanTarget } from './scan-target.ts';

const OFFLINE_SCAN_SNAPSHOT_PREFIX = 'mz_scan_authority_snapshot:';
const SCAN_ENTRY_ATTESTATION_PREFIX = 'mz_native_scan_entry:';
const SCAN_ENTRY_TTL_MS = 15 * 60 * 1000;
const NATIVE_NOTIFICATION_OUTBOX_PREFIX = 'mz_native_notification_outbox:';

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

  const bridgeReady = Promise.resolve(security.ready).then(() => {
    const status = security.getStatus();
    window.dispatchEvent(new CustomEvent('memphis:mobile-ready', {
      detail: {
        edition: 'custodial',
        deviceId: deviceId(),
        status,
      },
    }));
    return status;
  });

  async function authoritativeDeviceId() {
    await bridgeReady;
    return deviceId();
  }

  async function saveOfflineScanAuthoritySnapshot(snapshot) {
    await bridgeReady;
    const id = deviceId();
    if (
      !id
      || !snapshot
      || snapshot.schema_version !== 'offline-scan-snapshot.v1'
      || snapshot.contract_version !== 'scan.v3.offline-authority'
      || String(snapshot.canonical_device_id || '').trim().toUpperCase() !== id
      || !/^[A-Za-z0-9._:-]{8,200}$/.test(String(snapshot.snapshot_id || ''))
      || !/^[0-9a-f-]{36}$/i.test(String(snapshot.employee_id || ''))
      || !/^[A-Za-z0-9._:-]{8,200}$/.test(String(snapshot.credential_id || ''))
      || !Number.isSafeInteger(Number(snapshot.assignment_epoch))
      || Number(snapshot.assignment_epoch) < 1
    ) throw new Error('The offline scan authority snapshot does not match this enrolled phone.');
    await security.mutateProtectedWork(() => localStorage.setItem(`${OFFLINE_SCAN_SNAPSHOT_PREFIX}${id}`, JSON.stringify(snapshot)));
    return true;
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
      || !['native-nfc', 'manual-qr-fallback'].includes(source)
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
    const entryId = crypto.randomUUID();
    const target = resolveCustodialScanTarget(rawValue, location.href, id, entrySource, entryId);
    if (!target) return null;
    const now = Date.now();
    const record = {
      schema_version: 'scan-entry-attestation.v1',
      entry_id: entryId,
      entry_source: entrySource,
      device_id: id,
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

  async function bindScanEntryAttestation(entryId, clientSessionId) {
    await bridgeReady;
    if (nativeVault) {
      await bindNativeCustodialScanEntry(entryId, clientSessionId);
      return true;
    }
    const record = readScanEntryAttestation(entryId);
    const sessionId = String(clientSessionId || '').trim();
    if (!record || !/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error('The native scan handoff cannot be bound to this session.');
    if (record.client_session_id && record.client_session_id !== sessionId) throw new Error('The native scan handoff is already bound to another session.');
    sessionStorage.setItem(`${SCAN_ENTRY_ATTESTATION_PREFIX}${record.entry_id}`, JSON.stringify({ ...record, client_session_id: sessionId }));
    return true;
  }

  async function consumeScanEntryAttestation(entryId, clientSessionId) {
    await bridgeReady;
    if (nativeVault) {
      await consumeNativeCustodialScanEntry(entryId, clientSessionId);
      return true;
    }
    const record = readScanEntryAttestation(entryId);
    const sessionId = String(clientSessionId || '').trim();
    if (!record || record.client_session_id !== sessionId) throw new Error('The native scan handoff cannot be consumed by this session.');
    sessionStorage.removeItem(`${SCAN_ENTRY_ATTESTATION_PREFIX}${record.entry_id}`);
    return true;
  }

  async function handleNativeScanUrl(url) {
    await bridgeReady;
    const status = security.getStatus();
    const id = deviceId();
    if (status.ready !== true || status.available !== true || status.state !== 'enrolled' || !id) return;
    let scan = null;
    if (nativeVault) {
      const attestation = await attestNativeCustodialScanIntent(url);
      const target = resolveCustodialScanTarget(
        attestation.url,
        location.href,
        id,
        'native-nfc',
        attestation.entry_id,
      );
      scan = target?.toString() || null;
    } else if (browserTestBuild) {
      scan = await prepareScanTarget(url, 'native-nfc');
    }
    if (scan) location.assign(scan);
  }

  async function installNativeScanRouting() {
    MZ_CUSTODIAL_BROWSER_TEST: {
      if (browserTestBuild) window.__dispatchCustodialNativeScanForTest = handleNativeScanUrl;
    }
    await App.addListener('appUrlOpen', ({ url }) => { void handleNativeScanUrl(url); });
    const launch = await App.getLaunchUrl().catch(() => null);
    if (launch?.url) await handleNativeScanUrl(launch.url);
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
    if (![401, 403].includes(Number(response?.status || 0))) return;
    const reason = String(payload?.code || 'server_credential_rejected').trim().toLowerCase();
    await credentialStore.requireManagerRecovery(
      /^[a-z][a-z0-9_:-]{0,79}$/.test(reason) ? reason : 'server_credential_rejected',
    );
  }

  function publicUnauthenticatedRoute(url, method) {
    if (method !== 'GET') return false;
    return url.pathname === '/version'
      || url.pathname === '/dashboard-api/current-attendance'
      || url.pathname === '/dashboard-api/events'
      || url.pathname.startsWith('/dashboard-api/events/');
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
            if (error?.code !== 'custodial_native_enrollment_resume_refused') throw error;
            if (!/^\d{8}$/.test(code)) throw new Error('Re-enter the eight-digit manager code to start the saved operation.');
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
      const file = url.pathname.split('/').pop() || '';
      const allowed = new Set(['events.html', 'messages.html', 'messages-chatscope.html', 'thread.html', 'employee-schedule.html', 'index.html']);
      if (url.origin !== location.origin || !allowed.has(file)) return '';
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
        ['employee-events', 'Assigned events', 'Event reminders for assigned custodial work'],
        ['employee-messages', 'Messages', 'New Memphis and team messages'],
        ['employee-due-soon', 'Due soon', 'Assigned locations approaching their cleaning window'],
        ['employee-overdue', 'Overdue', 'Assigned locations that need attention now'],
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
        void presentForegroundNotification(event).catch(() => {});
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
    prepareManualQrScanTarget: (value) => prepareScanTarget(value, 'manual-qr-fallback'),
    verifyScanEntryAttestation,
    bindScanEntryAttestation,
    consumeScanEntryAttestation,
    enrollDevice,
    cancelPendingEnrollment,
    removeEnrollment,
    resumePendingSecurityWorkflow,
    ensurePushRegistration,
    securityStatus: security.getStatus,
    nativeNotifications: true,
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
  void installNativeScanRouting().catch(() => {});
  void bridgeReady
    .then(() => resumePendingSecurityWorkflow())
    .then(() => installNotificationRouting())
    .then(() => ensurePushRegistration({ requestPermission: false }))
    .catch(() => {});
  document.addEventListener('DOMContentLoaded', install, { once: true });
})();
