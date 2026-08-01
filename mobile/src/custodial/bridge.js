import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar } from '@capacitor/status-bar';

(() => {
  const API = 'https://memphis-zoo-mcp.onrender.com';
  const CREDENTIAL_KEY = 'memphis_zoo_custodial_device_credential';
  const DEVICE_KEY = 'memphisAssignedDeviceId';
  const PREFIXES = ['/device-auth/', '/employee-notifications-api/', '/events-api/', '/feedback-api/', '/messaging-api/', '/scan-api/', '/schedule-api/'];
  const rawFetch = window.fetch.bind(window);
  document.documentElement.classList.add('mz-native-app', /Android/i.test(navigator.userAgent || '') ? 'mz-native-android' : 'mz-native-ios');
  const hide = () => { void StatusBar.hide().catch(() => {}); }; hide(); window.addEventListener('focus', hide); document.addEventListener('visibilitychange', () => { if (!document.hidden) hide(); });
  let credential = '';
  function deviceId() { return String(localStorage.getItem(DEVICE_KEY) || localStorage.getItem('mz_scan_device_id') || '').trim().toUpperCase(); }
  async function readCredential() { if (credential) return credential; try { credential = String(await SecureStorage.get(CREDENTIAL_KEY) || '').trim(); } catch { credential = String(localStorage.getItem(CREDENTIAL_KEY) || '').trim(); } return credential; }
  function target(input) { try { return new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href); } catch { return null; } }
  async function bridgeFetch(input, init = {}) {
    const url = target(input); if (!url || url.origin !== API) return rawFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined) || {});
    if (PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      const value = await readCredential(); if (value) { headers.set('X-Device-Credential', value); headers.set('X-Memphis-Device-Credential', value); }
      const id = deviceId(); if (id) headers.set('X-Device-Id', id);
    }
    return rawFetch(input, { ...init, headers, credentials: 'omit' });
  }
  async function requestEnvelope(path, options = {}) {
    const headers = new Headers(options.headers || {}); let body = options.body;
    if (body != null && typeof body !== 'string' && !(body instanceof FormData) && !(body instanceof Blob)) { headers.set('Content-Type', 'application/json'); body = JSON.stringify(body); }
    const response = await bridgeFetch(`${API}${String(path).startsWith('/') ? path : `/${path}`}`, { method: options.method || 'GET', cache: 'no-store', signal: options.signal, headers, body });
    const payload = await response.json().catch(() => null); if (!response.ok || !payload?.ok) { const error = new Error(payload?.error || `HTTP ${response.status}`); error.status = response.status; error.payload = payload; throw error; } return payload;
  }
  async function authHeaders() { const value = await readCredential(); return { ...(value ? { 'X-Device-Credential': value, 'X-Memphis-Device-Credential': value } : {}), 'X-Device-Id': deviceId() }; }
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
          method: 'POST',
          body: { notification_key: data.notification_key },
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
      await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        handleAction(event?.notification || {});
      });
      await LocalNotifications.addListener('localNotificationActionPerformed', (event) => handleAction(event?.notification || {}));
    } catch {}
  }
  window.fetch = bridgeFetch;
  window.MemphisMobile = { fetch: bridgeFetch, requestEnvelope, requestJson: async (path, options) => (await requestEnvelope(path, options)).data, authHeaders, readCredential, deviceId, ensurePushRegistration, nativeNotifications: true };
  const install = () => {
    window.MemphisAuth = {
      ...(window.MemphisAuth || {}),
      getDeviceId: deviceId,
      opsManagerAuthHeaders: authHeaders,
      readSession: () => null,
      isOpsManager: () => false,
    };
  };
  install();
  void installNotificationRouting().then(() => ensurePushRegistration({ requestPermission: false })).catch(() => {});
  document.addEventListener('DOMContentLoaded', install, { once: true });
})();
