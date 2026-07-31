import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
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
      const id = deviceId(); if (id) headers.set('X-Device-Id', id); headers.set('X-Memphis-App-Edition', 'custodial');
    }
    return rawFetch(input, { ...init, headers, credentials: 'omit' });
  }
  async function requestEnvelope(path, options = {}) {
    const headers = new Headers(options.headers || {}); let body = options.body;
    if (body != null && typeof body !== 'string' && !(body instanceof FormData) && !(body instanceof Blob)) { headers.set('Content-Type', 'application/json'); body = JSON.stringify(body); }
    const response = await bridgeFetch(`${API}${String(path).startsWith('/') ? path : `/${path}`}`, { method: options.method || 'GET', cache: 'no-store', signal: options.signal, headers, body });
    const payload = await response.json().catch(() => null); if (!response.ok || !payload?.ok) { const error = new Error(payload?.error || `HTTP ${response.status}`); error.status = response.status; error.payload = payload; throw error; } return payload;
  }
  async function authHeaders() { const value = await readCredential(); return { ...(value ? { 'X-Device-Credential': value, 'X-Memphis-Device-Credential': value } : {}), 'X-Device-Id': deviceId(), 'X-Memphis-App-Edition': 'custodial' }; }
  function safeEventRoute(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, location.href);
      const file = url.pathname.split('/').pop() || '';
      return url.origin === location.origin && file === 'events.html' ? url.toString() : '';
    } catch { return ''; }
  }
  async function registerPushToken(token) {
    if (!token || !['android', 'ios'].includes(Capacitor.getPlatform())) return null;
    return requestEnvelope('/employee-notifications-api/register', {
      method: 'POST',
      body: {
        token,
        platform: Capacitor.getPlatform(),
        app_version: '0.2.0',
        app_build: String(window.MemphisMobileBuild || ''),
      },
    });
  }
  async function ensurePushRegistration({ requestPermission = false } = {}) {
    if (!['android', 'ios'].includes(Capacitor.getPlatform())) return { supported: false, receive: 'unsupported' };
    const support = await FirebaseMessaging.isSupported();
    if (!support.isSupported) return { supported: false, receive: 'unsupported' };
    if (Capacitor.getPlatform() === 'android') {
      try {
        await FirebaseMessaging.createChannel({
          id: 'employee-events',
          name: 'Assigned events',
          description: 'Event reminders for assigned custodial work',
          importance: 5,
          visibility: 1,
          vibration: true,
          sound: 'default',
        });
      } catch {}
    }
    let permission = await FirebaseMessaging.checkPermissions();
    if (permission.receive !== 'granted' && requestPermission && permission.receive !== 'denied') {
      permission = await FirebaseMessaging.requestPermissions();
    }
    if (permission.receive !== 'granted') return { supported: true, receive: permission.receive, registered: false };
    const result = await FirebaseMessaging.getToken();
    const registration = await registerPushToken(result.token);
    return { supported: true, receive: permission.receive, registered: true, registration };
  }
  async function installNotificationRouting() {
    try {
      await FirebaseMessaging.addListener('tokenReceived', (event) => { void registerPushToken(event.token).catch(() => {}); });
      await FirebaseMessaging.addListener('notificationReceived', (event) => {
        window.dispatchEvent(new CustomEvent('memphis:event-notification-received', { detail: event || {} }));
      });
      await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        const data = event?.notification?.data || {};
        const route = safeEventRoute(data.route);
        if (data.notification_key) {
          void requestEnvelope('/employee-notifications-api/opened', {
            method: 'POST',
            body: { notification_key: data.notification_key },
          }).catch(() => {});
        }
        if (route) location.assign(route);
      });
    } catch {}
  }
  window.fetch = bridgeFetch;
  window.MemphisMobile = { fetch: bridgeFetch, requestEnvelope, requestJson: async (path, options) => (await requestEnvelope(path, options)).data, authHeaders, readCredential, deviceId, ensurePushRegistration };
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
