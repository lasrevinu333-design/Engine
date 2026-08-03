import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { managerNativeSecurity } from './native-security.js';

const API = 'https://memphis-zoo-mcp.onrender.com';
const ALLOWED_ROUTES = new Set([
  'index.html', 'start_page1.html', 'messages.html', 'thread.html',
  'events.html', 'dashboard.html', 'notifications.html',
]);
let listenersInstalled = false;

function sessionFromState(state) {
  if (!state?.active || state?.blocked || state?.removal_pending) return null;
  return Object.freeze({
    native_authenticated: true,
    role: 'ops_manager',
    roles: Object.freeze([...(state.roles || [])]),
    access_level: state.access_level,
    device_id: state.device_id,
    manager_id: state.manager_id,
    key_security_level: state.key_security_level,
  });
}

export function currentDeviceId() {
  return String(managerNativeSecurity.getStatus()?.device_id || '');
}

export function currentSession() {
  return sessionFromState(managerNativeSecurity.getStatus());
}

export async function refreshManagerSession() {
  let state = await managerNativeSecurity.inspect();
  state = await managerNativeSecurity.reconcilePendingState();
  if (!state.active || state.blocked || state.removal_pending) {
    throw new Error(state.reason || 'This phone is not enrolled for manager access.');
  }
  // The native transport creates/refreshes an attested session and retains the
  // bearer entirely outside the WebView. Only sanitized status is read back.
  const response = await managerNativeSecurity.authorizedFetch(`${API}/dashboard-api/health`, {
    method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error',
  });
  if (!response.ok) throw new Error(`Manager authorization failed: HTTP ${response.status}`);
  state = await managerNativeSecurity.inspect();
  const session = sessionFromState(state);
  if (!session) throw new Error('This phone is not enrolled for manager access.');
  return Object.freeze({ session, manager: Object.freeze({ manager_id: state.manager_id }) });
}

export async function managerNotificationRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  let body;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }
  const response = await managerNativeSecurity.authorizedFetch(`${API}${path}`, {
    method, cache: 'no-store', credentials: 'omit', redirect: 'error', headers, body,
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
      app_version: '2.0.0',
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
