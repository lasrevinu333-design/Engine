import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

const API = 'https://memphis-zoo-mcp.onrender.com';
const CREDENTIAL_KEY = 'memphis_zoo_ops_device_credential';
const SESSION_KEY = 'mz_native_session';
const RUNTIME_CREDENTIAL_KEY = 'mz_native_device_credential_runtime';
const DEVICE_KEY = 'memphisAssignedDeviceId';
const ALLOWED_ROUTES = new Set([
  'index.html', 'start_page1.html', 'messages.html', 'thread.html',
  'events.html', 'dashboard.html', 'notifications.html',
]);
let listenersInstalled = false;

export function currentDeviceId() {
  return String(localStorage.getItem(DEVICE_KEY) || localStorage.getItem('mz_scan_device_id') || '').trim();
}
export function currentSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return value?.token ? value : null;
  } catch { return null; }
}
export async function readDeviceCredential() {
  try {
    const value = await SecureStorage.get(CREDENTIAL_KEY);
    return typeof value === 'string' ? value : '';
  } catch { return localStorage.getItem(CREDENTIAL_KEY) || ''; }
}
export async function refreshManagerSession() {
  const credential = await readDeviceCredential();
  if (!credential) throw new Error('This phone is not enrolled for manager access.');
  const response = await fetch(`${API}/mobile-auth-api/session`, {
    method: 'POST', cache: 'no-store',
    headers: { 'X-Memphis-Device-Credential': credential, 'X-Device-Id': currentDeviceId() },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload.data?.session?.token) throw new Error(payload?.error || `HTTP ${response.status}`);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload.data.session));
  sessionStorage.setItem(RUNTIME_CREDENTIAL_KEY, credential);
  return payload.data;
}
export async function managerNotificationRequest(path, options = {}) {
  let session = currentSession();
  if (!session || Date.parse(session.expires_at || '') <= Date.now() + 5000) session = (await refreshManagerSession()).session;
  const response = await fetch(`${API}${path}`, {
    method: options.method || 'GET', cache: 'no-store',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'X-Device-Id': session.device_id || currentDeviceId(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload.data;
}
function safeRoute(value) {
  const raw = String(value || '').trim().replace(/^\.\//, '');
  if (!raw) return '';
  const url = new URL(raw, window.location.href);
  const file = url.pathname.split('/').pop() || '';
  return url.origin === window.location.origin && ALLOWED_ROUTES.has(file) ? url.toString() : '';
}
async function registerToken(token) {
  const platform = Capacitor.getPlatform();
  if (!['ios', 'android'].includes(platform) || !token) return null;
  return managerNotificationRequest('/manager-notifications-api/register', {
    method: 'POST',
    body: {
      token,
      platform,
      app_version: '0.2.0',
      app_build: String(window.MemphisMobileBuild || ''),
    },
  });
}
export async function notificationPermission() {
  try {
    const support = await FirebaseMessaging.isSupported();
    if (!support.isSupported) return { supported: false, receive: 'unsupported' };
    const status = await FirebaseMessaging.checkPermissions();
    return { supported: true, receive: status.receive };
  } catch (error) {
    return { supported: false, receive: 'unavailable', error: error?.message || String(error) };
  }
}
export async function ensurePushRegistration({ requestPermission = false } = {}) {
  const platform = Capacitor.getPlatform();
  if (!['ios', 'android'].includes(platform)) return { supported: false, receive: 'unsupported' };
  const support = await FirebaseMessaging.isSupported();
  if (!support.isSupported) return { supported: false, receive: 'unsupported' };
  if (platform === 'android') {
    try {
      await FirebaseMessaging.createChannel({
        id: 'operations', name: 'Operations', description: 'Manager messages, events and custodial alerts',
        importance: 5, visibility: 1, vibration: true, sound: 'default',
      });
    } catch {}
  }
  let permission = await FirebaseMessaging.checkPermissions();
  if (permission.receive !== 'granted' && requestPermission && permission.receive !== 'denied') {
    permission = await FirebaseMessaging.requestPermissions();
  }
  if (permission.receive !== 'granted') return { supported: true, receive: permission.receive, registered: false };
  const result = await FirebaseMessaging.getToken();
  const registration = await registerToken(result.token);
  return { supported: true, receive: permission.receive, registered: true, token: result.token, registration };
}
export async function unregisterPushNotifications() {
  try { await managerNotificationRequest('/manager-notifications-api/register', { method: 'DELETE' }); } catch {}
  try { await FirebaseMessaging.deleteToken(); } catch {}
}
export async function installNotificationRouting() {
  if (listenersInstalled) return;
  listenersInstalled = true;
  try {
    await FirebaseMessaging.addListener('tokenReceived', (event) => { void registerToken(event.token).catch(() => {}); });
    await FirebaseMessaging.addListener('notificationReceived', (event) => {
      window.dispatchEvent(new CustomEvent('memphis:notification-received', { detail: event || {} }));
    });
    await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      const route = safeRoute(event?.notification?.data?.route);
      if (route) window.location.assign(route);
    });
  } catch {}
}
