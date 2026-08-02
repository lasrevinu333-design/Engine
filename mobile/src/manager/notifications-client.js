import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { managerNativeSecurity } from './native-security.js';

const API = 'https://memphis-zoo-mcp.onrender.com';
const ALLOWED_ROUTES = new Set([
  'index.html', 'start_page1.html', 'messages.html', 'thread.html',
  'events.html', 'dashboard.html', 'notifications.html',
]);
let listenersInstalled = false;
let safeSessionCache = null;

export function currentDeviceId() {
  return String(managerNativeSecurity.getStatus()?.device_id || '').trim();
}
export function currentSession() {
  return globalThis.MemphisManagerSession?.read?.() || globalThis.MemphisMobile?.readSession?.() || safeSessionCache;
}
export async function refreshManagerSession() {
  const response = await managerNativeSecurity.authorizedFetch(`${API}/mobile-auth-api/session`, {
    method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || payload.data?.session?.role !== 'ops_manager') throw new Error(payload?.error || `HTTP ${response.status}`);
  if ('token' in payload.data.session || 'device_credential' in payload.data) throw new Error('Protected Manager transport returned secret material.');
  safeSessionCache = Object.freeze({ ...payload.data.session, native_authenticated: true });
  payload.data.session = safeSessionCache;
  return payload.data;
}
export async function managerNotificationRequest(path, options = {}) {
  const response = await managerNativeSecurity.authorizedFetch(`${API}${path}`, {
    method: options.method || 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
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
      app_version: '1.0.0',
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
  return { supported: true, receive: permission.receive, registered: true, registration };
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
