import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar } from '@capacitor/status-bar';
import { getCustodialSecurityRuntime } from './security-runtime.js';
import { reconcileEnrollmentConfirmationRequired } from './transport-policy.js';

(() => {
  const API = 'https://memphis-zoo-mcp.onrender.com';
  const API_ORIGIN = new URL(API).origin;
  const { store: credentialStore, security } = getCustodialSecurityRuntime({ secureStorage: SecureStorage });
  const rawFetch = window.fetch.bind(window);
  let confirmationInFlight = null;
  let removalInFlight = null;

  document.documentElement.classList.add(
    'mz-native-app',
    /Android/i.test(navigator.userAgent || '') ? 'mz-native-android' : 'mz-native-ios',
  );
  const hide = () => { void StatusBar.hide().catch(() => {}); };
  hide();
  window.addEventListener('focus', hide);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) hide(); });

  function deviceId() {
    return String(credentialStore.getStatus().deviceId || '').trim().toUpperCase();
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

  async function requireRecoveryForRejectedCredential(response, payload = null) {
    if (![401, 403].includes(Number(response?.status || 0))) return;
    const reason = String(payload?.code || 'server_credential_rejected').trim().toLowerCase();
    await credentialStore.requireManagerRecovery(
      /^[a-z][a-z0-9_:-]{0,79}$/.test(reason) ? reason : 'server_credential_rejected',
    );
  }

  function credentialHeaders(credential, id, initial = {}) {
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

  async function bridgeFetch(input, init = {}, { confirmationRetry = false } = {}) {
    const url = target(input);
    if (!url || url.origin !== API_ORIGIN) return rawFetch(input, init);
    const retryInput = input instanceof Request ? input.clone() : input;
    const supplied = init.headers || (input instanceof Request ? input.headers : undefined) || {};
    const dispatched = await credentialStore.dispatchAuthorizedTransport(({ credential, deviceId: enrolledDevice }) => (
      rawFetch(input, {
        ...init,
        headers: credentialHeaders(credential, enrolledDevice, supplied),
        credentials: 'omit',
      })
    ));
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

  async function rawCredentialRequest(path, { method = 'POST', credential, requestedDeviceId, body = null } = {}) {
    const headers = credentialHeaders(credential, requestedDeviceId, { Accept: 'application/json' });
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

  async function confirmPendingEnrollment() {
    if (confirmationInFlight) return confirmationInFlight;
    const operation = credentialStore.getPendingEnrollmentOperation();
    if (!operation || operation.status !== 'local_committed_pending_server_confirmation') return null;
    const task = (async () => {
      let response;
      try {
        const dispatched = await credentialStore.dispatchAuthorizedTransport(
          ({ credential, deviceId: enrolledDevice }) => rawCredentialRequest(
            `/custodial-device-auth/enrollment-operations/${encodeURIComponent(operation.operation_id)}/confirm`,
            {
              method: 'POST',
              credential,
              requestedDeviceId: enrolledDevice,
              body: { operation_id: operation.operation_id },
            },
          ),
          {
            allowPendingEnrollmentConfirmation: true,
            expectedEnrollmentOperationId: operation.operation_id,
          },
        );
        response = await dispatched.completion;
        await credentialStore.waitForStableState({
          requireEnrollment: true,
          expectedGeneration: dispatched.generation,
          allowPendingEnrollmentConfirmation: true,
          expectedEnrollmentOperationId: operation.operation_id,
        });
      } catch (error) {
        if (error?.status === 401 || error?.status === 403) {
          await credentialStore.requireManagerRecovery('enrollment_confirmation_rejected');
        }
        throw error;
      }
      await credentialStore.confirmEnrollmentOperation(operation.operation_id);
      return response.data || {};
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
    if (!/^\d{8}$/.test(code)) throw new Error('An eight-digit manager code is required.');
    if (!['enrollment', 'recovery'].includes(flow)) throw new Error('The enrollment flow is invalid.');

    const operation = await credentialStore.prepareEnrollmentOperation({ deviceId: selected, flow });
    if (operation.status === 'local_committed_pending_server_confirmation') {
      await confirmPendingEnrollment();
      return { operation_id: operation.operation_id, flow, device_id: selected, replayed: true };
    }

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
    if (!response.ok || !payload?.ok) throw responseError(response, payload);
    const data = payload.data || {};
    const returnedDevice = String(data.device_id || '').trim().toUpperCase();
    const returnedOperation = String(data.operation_id || '').trim();
    const returnedFlow = String(data.flow || '').trim();
    const credential = String(data.device_credential || '').trim();
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
    const { device_credential: _secret, ...safeData } = data;
    return safeData;
  }

  async function removeEnrollment() {
    if (removalInFlight) return removalInFlight;
    const task = credentialStore.removeEnrollment({
      beforeRemove: async ({ credential, deviceId: enrolledDevice, phase, checkpoint }) => {
        if (phase === 'pending_push_unregister') {
          await rawCredentialRequest('/employee-notifications-api/register', {
            method: 'DELETE', credential, requestedDeviceId: enrolledDevice,
          });
          await checkpoint('push_unregistered');
          phase = 'push_unregistered';
        }
        if (phase === 'push_unregistered') {
          await rawCredentialRequest('/device-auth/logout', {
            method: 'POST', credential, requestedDeviceId: enrolledDevice,
            body: { device_id: enrolledDevice },
          });
          await checkpoint('server_logged_out');
        }
      },
    });
    const tracked = task.finally(() => {
      if (removalInFlight === tracked) removalInFlight = null;
    });
    removalInFlight = tracked;
    return tracked;
  }

  async function resumePendingSecurityWorkflow() {
    if (credentialStore.getRemovalRecord()) return removeEnrollment();
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
    const blocked = status?.quarantined === true
      || status?.state === 'removing'
      || (status?.initialized === true && status?.available === false);
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
    const handleAction = (notification) => {
      const data = notification?.data || notification?.extra || {};
      const route = safeNativeRoute(data.route);
      if (data.kind === 'employee_event' && data.notification_key) {
        void requestEnvelope('/employee-notifications-api/opened', {
          method: 'POST', body: { notification_key: data.notification_key },
        }).catch(() => {});
      }
      if (data.kind === 'employee_location_status' && data.notification_key) {
        void requestEnvelope('/messaging-api/device-notifications/ack', {
          method: 'POST',
          body: {
            device_id: deviceId(),
            notification_key: data.notification_key,
            notification_type: 'location_status',
            action: 'opened',
            metadata: { source: 'native_notification_action' },
          },
        }).catch(() => {});
      }
      if (route) location.assign(route);
    };
    try {
      await FirebaseMessaging.addListener('tokenReceived', (event) => { void registerPushToken(event.token).catch(() => {}); });
      await FirebaseMessaging.addListener('notificationReceived', (event) => {
        window.dispatchEvent(new CustomEvent('memphis:native-notification-received', { detail: event || {} }));
        void presentForegroundNotification(event).catch(() => {});
      });
      await FirebaseMessaging.addListener('notificationActionPerformed', (event) => handleAction(event?.notification || {}));
      await LocalNotifications.addListener('localNotificationActionPerformed', (event) => handleAction(event?.notification || {}));
    } catch {}
  }

  window.fetch = bridgeFetch;
  security.subscribe(routeProtectedRecovery);
  window.MemphisMobile = Object.freeze({
    edition: 'custodial',
    requestEnvelope,
    requestJson: async (path, options) => (await requestEnvelope(path, options)).data,
    deviceId,
    enrollDevice,
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
  void security.ready
    .then(() => resumePendingSecurityWorkflow())
    .then(() => installNotificationRouting())
    .then(() => ensurePushRegistration({ requestPermission: false }))
    .catch(() => {});
  document.addEventListener('DOMContentLoaded', install, { once: true });
})();
