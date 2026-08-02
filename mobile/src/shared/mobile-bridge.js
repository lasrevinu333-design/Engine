import { StatusBar } from '@capacitor/status-bar';
import { managerNativeSecurity } from '../manager/native-security.js';

(() => {
  const API = 'https://memphis-zoo-mcp.onrender.com';
  const RETIRED_WEB_SECRET_KEYS = [
    'memphis_zoo_ops_device_credential',
    'mz_native_device_credential_runtime',
    'mz_native_session',
    'mz_device_security_csrf',
  ];
  const PUBLIC_ROUTES = [
    ['GET', /^\/(?:health|version)$/],
    ['GET', /^\/guest-api\/(?:status|locations\/[A-Za-z0-9._~-]+)$/],
    ['POST', /^\/guest-api\/report-cleanliness$/],
    ['GET', /^\/viewer-api\/(?:dashboard|events)$/],
  ];
  const rawFetch = window.fetch.bind(window);
  let current = null;
  let profile = null;
  let inFlight = null;
  let lastRefreshError = null;

  const hideNativeStatusBar = () => { void StatusBar.hide().catch(() => {}); };
  hideNativeStatusBar();
  window.addEventListener('focus', hideNativeStatusBar, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) hideNativeStatusBar(); });

  function purgeRetiredWebSecrets() {
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of RETIRED_WEB_SECRET_KEYS) {
        try { storage.removeItem(key); } catch {}
      }
    }
  }

  function knownDeviceId() {
    const native = String(managerNativeSecurity.getStatus()?.device_id || '').trim();
    if (native) return native;
    for (const key of ['memphisAssignedDeviceId', 'mz_scan_device_id']) {
      const value = String(localStorage.getItem(key) || '').trim();
      if (/^ops-app-[0-9a-f-]{36}$/i.test(value)) return value;
    }
    return '';
  }

  function publishDeviceId(value) {
    const deviceId = String(value || '').trim();
    if (!/^ops-app-[0-9a-f-]{36}$/i.test(deviceId)) return;
    localStorage.setItem('memphisAssignedDeviceId', deviceId);
    localStorage.setItem('mz_scan_device_id', deviceId);
  }

  async function reconcileState() {
    let state = await managerNativeSecurity.inspect();
    if (state.blocked) throw new Error(`This Manager installation is quarantined: ${state.reason || 'protected state requires repair'}.`);
    if (state.legacy_pending) state = await managerNativeSecurity.migrateLegacyEnrollment(knownDeviceId());
    if (state.pending_operation_id) state = await managerNativeSecurity.resumePendingEnrollment();
    if (!state.active) throw new Error('This Manager app installation is not enrolled.');
    publishDeviceId(state.device_id);
    return state;
  }

  async function refresh(options = {}) {
    const force = options?.force === true;
    if (!force && current?.native_authenticated === true && Date.parse(current.expires_at || '') > Date.now() + 30_000) return current;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        await reconcileState();
        const response = await managerNativeSecurity.authorizedFetch(`${API}/mobile-auth-api/session`, {
          method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error',
        });
        const payload = await response.json().catch(() => null);
        const session = payload?.data?.session;
        if (!response.ok || !payload?.ok || session?.role !== 'ops_manager') {
          throw new Error(payload?.error || `Manager session refresh failed: HTTP ${response.status}`);
        }
        if ('token' in session || 'device_credential' in (payload.data || {})) {
          throw new Error('Protected Manager transport returned secret material.');
        }
        current = Object.freeze({ ...session, native_authenticated: true });
        profile = Object.freeze({ ...(payload.data.manager || {}) });
        lastRefreshError = null;
        return current;
      } catch (error) {
        current = null;
        profile = null;
        lastRefreshError = error instanceof Error ? error : new Error(String(error || 'Manager session refresh failed.'));
        throw lastRefreshError;
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  }

  async function authHeaders(options = {}) {
    const session = await refresh(options);
    return { 'X-Device-Id': session.device_id || knownDeviceId() };
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
    try { return new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, window.location.href); }
    catch { return null; }
  }

  function publicRoute(url, method) {
    return url?.origin === API && PUBLIC_ROUTES.some(([verb, pattern]) => verb === method && pattern.test(url.pathname));
  }

  function refuseCallerSecrets(headers) {
    for (const name of new Headers(headers || {}).keys()) {
      if (/^(?:authorization|cookie|proxy-authorization|x-(?:csrf-token|device-credential|device-security-csrf|memphis-device-credential))$/i.test(name)) {
        const error = new Error('Web content cannot supply Manager authentication material.');
        error.code = 'manager_native_headers_refused';
        throw error;
      }
    }
  }

  async function bridgeFetch(input, init = {}, retry = true) {
    const url = targetUrl(input);
    if (!url || url.origin !== API) return rawFetch(input, init);
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const sourceHeaders = init.headers || (input instanceof Request ? input.headers : undefined);
    refuseCallerSecrets(sourceHeaders);
    if (publicRoute(url, method)) {
      return rawFetch(input, { ...init, credentials: 'omit', redirect: 'error' });
    }
    if (url.pathname.startsWith('/manager-device-auth/')) {
      const error = new Error('Manager credential-management routes are available only through typed native operations.');
      error.code = 'manager_native_credential_path_refused';
      throw error;
    }
    try {
      return await managerNativeSecurity.authorizedFetch(input, { ...init, credentials: 'omit', redirect: 'error' });
    } catch (error) {
      if (!retry || init?.signal?.aborted || !/network|connection|failed to fetch|load failed/i.test(String(error?.message || ''))) throw error;
      await new Promise((resolve) => setTimeout(resolve, 350));
      return bridgeFetch(input, init, false);
    }
  }

  async function deviceSecuritySession() {
    try { return await requestJson('/admin-api/device-security/session'); }
    catch (error) { return { configured: true, unlocked: false, error: error?.message || String(error) }; }
  }

  async function unlockDeviceSecurity(password) {
    return requestJson('/admin-api/device-security/unlock', { method: 'POST', body: { password: String(password || '') } });
  }

  async function lockDeviceSecurity() {
    try { await requestJson('/admin-api/device-security/lock', { method: 'POST' }); return true; }
    catch { return false; }
  }

  async function listOpsManagerTrustedDevices() { return requestJson('/auth-api/ops/trusted-devices'); }
  async function renameOpsManagerTrustedDevice(credentialId, deviceLabel) {
    return requestJson(`/auth-api/ops/trusted-devices/${encodeURIComponent(credentialId)}`, {
      method: 'PATCH', body: { device_label: String(deviceLabel || '').trim().slice(0, 160) },
    });
  }
  async function revokeOpsManagerTrustedDevice(credentialId, reason = 'manager_revoke_device') {
    return requestJson(`/auth-api/ops/trusted-devices/${encodeURIComponent(credentialId)}/revoke`, { method: 'POST', body: { reason } });
  }
  async function revokeAllOpsManagerTrustedDevices(reason = 'manager_revoke_all') {
    return requestJson('/auth-api/ops/trusted-devices/revoke-all', { method: 'POST', body: { reason } });
  }

  function getCSTDate(date = new Date()) {
    return date.toLocaleString('en-CA', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    });
  }

  function install() {
    const auth = window.MemphisAuth || (window.MemphisAuth = {});
    if (auth.__managerNativeBridgeInstalled) return false;
    auth.__managerNativeBridgeInstalled = true;
    auth.nativeApp = true;
    auth.getDeviceId = knownDeviceId;
    auth.readSession = () => current;
    auth.requireOpsManagerSession = async (options = {}) => {
      try { return await refresh(); }
      catch (error) {
        if (options.throwOnFailure) throw error;
        return null;
      }
    };
    auth.opsManagerAuthHeaders = authHeaders;
    auth.deviceSecurityAuthHeaders = authHeaders;
    auth.requestTrustedOpsSession = refresh;
    auth.requestPublicOpsSession = refresh;
    auth.deviceSecuritySession = deviceSecuritySession;
    auth.unlockDeviceSecurity = unlockDeviceSecurity;
    auth.lockDeviceSecurity = lockDeviceSecurity;
    auth.listOpsManagerTrustedDevices = listOpsManagerTrustedDevices;
    auth.renameOpsManagerTrustedDevice = renameOpsManagerTrustedDevice;
    auth.revokeOpsManagerTrustedDevice = revokeOpsManagerTrustedDevice;
    auth.revokeAllOpsManagerTrustedDevices = revokeAllOpsManagerTrustedDevices;
    auth.isOpsManager = (session = current) => Boolean(session?.native_authenticated && session.role === 'ops_manager');
    auth.isReadOnlySession = (session = current) => Boolean(session?.read_only || session?.access_level === 'read_only');
    auth.canMutateOpsManagerSurface = (session = current) => Boolean(auth.isOpsManager(session) && !auth.isReadOnlySession(session));
    auth.hasRole = (role, session = current) => Boolean(session && Array.isArray(session.roles)
      && session.roles.map((value) => String(value).toUpperCase()).includes(String(role).toUpperCase()));
    auth.getCSTDate = getCSTDate;
    auth.getCSTDateString = getCSTDate;
    auth.backendOrigin = API;
    auth.authUrl = `${API}/auth-api`;
    auth.opsManagerAuthDisabled = false;
    auth.isOpsManagerOpenSurface = () => false;
    auth.redirectToManagerHub = () => window.location.assign('./start_page1.html');
    auth.clearSession = async () => { current = null; profile = null; lastRefreshError = null; };
    return true;
  }

  purgeRetiredWebSecrets();
  window.fetch = (input, init) => bridgeFetch(input, init, true);
  window.MemphisMobile = Object.freeze({
    edition: 'manager',
    ready: refresh().catch(() => null),
    refresh,
    authHeaders,
    requestEnvelope,
    requestJson,
    fetch: bridgeFetch,
    readSession: () => current,
    readProfile: () => profile,
    deviceId: knownDeviceId,
    authoritativeDeviceId: async () => (await reconcileState()).device_id,
  });
  if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
})();
