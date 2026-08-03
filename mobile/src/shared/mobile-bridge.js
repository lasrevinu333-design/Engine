import { StatusBar } from '@capacitor/status-bar';
import { managerNativeSecurity } from '../manager/native-security.js';

(() => {
  const API = 'https://memphis-zoo-mcp.onrender.com';
  const PROTECTED_PREFIXES = [
    '/admin-api/', '/analytics-api/', '/auth-api/ops/', '/dashboard-api/', '/events-api',
    '/feedback-api/', '/gemini-api/', '/leadership-api/', '/manager-notifications-api/',
    '/messaging-api/', '/moxie-mobile-api/', '/scan-api/', '/schedule-api/',
  ];
  const rawFetch = window.fetch.bind(window);
  const hideNativeStatusBar = () => { void StatusBar.hide().catch(() => {}); };
  let lastRefreshError = null;
  let inFlight = null;

  hideNativeStatusBar();
  window.addEventListener('focus', hideNativeStatusBar, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) hideNativeStatusBar(); });

  function publicSession(state = managerNativeSecurity.getStatus()) {
    if (!state?.active || state.blocked || state.removal_pending) return null;
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

  function canonicalDeviceId() {
    return String(managerNativeSecurity.getStatus()?.device_id || '');
  }

  async function refresh() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        let state = await managerNativeSecurity.inspect();
        state = await managerNativeSecurity.reconcilePendingState();
        if (!state.active || state.blocked || state.removal_pending) {
          throw new Error(state.reason || 'This app installation is not enrolled.');
        }
        if (!state.roles.length || !state.access_level) {
          const response = await managerNativeSecurity.authorizedFetch(`${API}/dashboard-api/health`, {
            method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error',
          });
          if (!response.ok) throw new Error(`Manager authorization failed: HTTP ${response.status}`);
          state = await managerNativeSecurity.inspect();
        }
        lastRefreshError = null;
        return publicSession(state);
      } catch (error) {
        lastRefreshError = error instanceof Error ? error : new Error(String(error || 'Manager authorization failed.'));
        return null;
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  }

  async function authHeaders() {
    const session = await refresh();
    if (!session) throw lastRefreshError || new Error('This app installation is not enrolled.');
    return {
      ...(session.device_id ? { 'X-Device-Id': session.device_id } : {}),
      'X-Memphis-App-Edition': 'manager',
    };
  }

  function encodedBody(body, headers) {
    if (body === undefined || body === null) return undefined;
    if (typeof body === 'string' || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams) return body;
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return JSON.stringify(body);
  }

  async function requestEnvelope(path, options = {}) {
    const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
    const headers = new Headers(options.headers || {});
    const response = await bridgeFetch(`${API}${normalizedPath}`, {
      method: options.method || 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: options.signal,
      headers,
      body: encodedBody(options.body, headers),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function requestJson(path, options = {}) {
    return (await requestEnvelope(path, options)).data;
  }

  function targetUrl(input) {
    try {
      return new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, window.location.href);
    } catch {
      return null;
    }
  }

  function protectedApi(url) {
    return Boolean(url && url.origin === API && PROTECTED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)));
  }

  async function bridgeFetch(input, init = {}) {
    const url = targetUrl(input);
    if (!url || url.origin !== API) return rawFetch(input, init);
    if (protectedApi(url)) {
      // Legacy browser assets may still construct browser-session headers.
      // Discard them; the native transport alone supplies authorization,
      // device credential, cookies, and device-security capability.
      const source = init.headers || (input instanceof Request ? input.headers : undefined);
      const headers = new Headers(source || {});
      for (const name of [
        'Authorization', 'Cookie', 'Proxy-Authorization', 'X-CSRF-Token',
        'X-Device-Credential', 'X-Device-Security-CSRF', 'X-Memphis-Device-Credential',
      ]) headers.delete(name);
      return managerNativeSecurity.authorizedFetch(input, { ...init, headers });
    }
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method === 'GET' && ['/health', '/version', '/guest-api/status'].includes(url.pathname) && !url.search && !url.hash) {
      return rawFetch(input, init);
    }
    const error = new Error('The Manager native transport refused this endpoint.');
    error.code = 'manager_native_path_refused';
    throw error;
  }

  async function deviceSecuritySession() {
    try {
      return await requestJson('/admin-api/device-security/session');
    } catch (error) {
      return { configured: true, unlocked: false, error: error?.message || String(error) };
    }
  }

  function unlockDeviceSecurity(password) {
    return requestJson('/admin-api/device-security/unlock', {
      method: 'POST',
      body: { password: String(password || '') },
    });
  }

  async function lockDeviceSecurity() {
    try {
      await requestJson('/admin-api/device-security/lock', { method: 'POST' });
      return true;
    } catch {
      return false;
    }
  }

  async function deviceSecurityAuthHeaders() {
    // Cookie and CSRF capabilities remain native-only and are automatically
    // attached by the native transport after a successful unlock.
    return authHeaders();
  }

  function listOpsManagerTrustedDevices() {
    return requestJson('/auth-api/ops/trusted-devices');
  }

  function renameOpsManagerTrustedDevice(credentialId, deviceLabel) {
    return requestJson(`/auth-api/ops/trusted-devices/${encodeURIComponent(credentialId)}`, {
      method: 'PATCH',
      body: { device_label: String(deviceLabel || '').trim().slice(0, 160) },
    });
  }

  function revokeOpsManagerTrustedDevice(credentialId, reason = 'manager_revoke_device') {
    return requestJson(`/auth-api/ops/trusted-devices/${encodeURIComponent(credentialId)}/revoke`, {
      method: 'POST', body: { reason },
    });
  }

  function revokeAllOpsManagerTrustedDevices(reason = 'manager_revoke_all') {
    return requestJson('/auth-api/ops/trusted-devices/revoke-all', { method: 'POST', body: { reason } });
  }

  function install() {
    const auth = window.MemphisAuth;
    if (!auth || auth.__nativeBridgeInstalled) return false;
    auth.__nativeBridgeInstalled = true;
    auth.nativeApp = true;
    auth.getDeviceId = canonicalDeviceId;
    auth.readSession = () => publicSession();
    auth.requireOpsManagerSession = async (options = {}) => {
      const session = await refresh();
      if (!session && options.throwOnFailure) throw lastRefreshError || new Error('This app installation is not enrolled.');
      return session;
    };
    auth.opsManagerAuthHeaders = authHeaders;
    auth.deviceSecurityAuthHeaders = deviceSecurityAuthHeaders;
    auth.requestTrustedOpsSession = refresh;
    auth.requestPublicOpsSession = refresh;
    auth.deviceSecuritySession = deviceSecuritySession;
    auth.unlockDeviceSecurity = unlockDeviceSecurity;
    auth.lockDeviceSecurity = lockDeviceSecurity;
    auth.listOpsManagerTrustedDevices = listOpsManagerTrustedDevices;
    auth.renameOpsManagerTrustedDevice = renameOpsManagerTrustedDevice;
    auth.revokeOpsManagerTrustedDevice = revokeOpsManagerTrustedDevice;
    auth.revokeAllOpsManagerTrustedDevices = revokeAllOpsManagerTrustedDevices;
    auth.isOpsManager = (session = auth.readSession()) => Boolean(session?.native_authenticated && session.role === 'ops_manager');
    auth.isReadOnlySession = (session = auth.readSession()) => Boolean(session?.access_level === 'read_only');
    auth.canMutateOpsManagerSurface = (session = auth.readSession()) => Boolean(auth.isOpsManager(session) && !auth.isReadOnlySession(session));
    auth.hasRole = (role, session = auth.readSession()) => Boolean(
      session && Array.isArray(session.roles)
      && session.roles.map((value) => String(value).toUpperCase()).includes(String(role).toUpperCase())
    );
    auth.redirectToManagerHub = () => window.location.assign('./start_page1.html');
    auth.clearSession = async () => {};
    return true;
  }

  window.fetch = bridgeFetch;
  window.MemphisMobile = Object.freeze({
    refresh,
    authHeaders,
    requestEnvelope,
    requestJson,
    fetch: bridgeFetch,
    readSession: publicSession,
    deviceId: canonicalDeviceId,
  });
  if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
})();
