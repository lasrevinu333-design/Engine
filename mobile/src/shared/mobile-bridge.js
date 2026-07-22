import { SecureStorage } from '@aparajita/capacitor-secure-storage';

(() => {
  const API = 'https://memphis-zoo-mcp.onrender.com';
  const SECURE_CREDENTIAL_KEY = 'memphis_zoo_ops_device_credential';
  const SESSION_KEY = 'mz_native_session';
  const RUNTIME_CREDENTIAL_KEY = 'mz_native_device_credential_runtime';
  const DEVICE_KEY = 'memphisAssignedDeviceId';
  const LEGACY_DEVICE_KEY = 'mz_scan_device_id';
  const AUTHENTICATED_API_PREFIXES = [
    '/admin-api/',
    '/auth-api/ops/',
    '/feedback-api/',
    '/gemini-api/',
    '/leadership-api/',
    '/manager-notifications-api/',
    '/messaging-api/',
    '/moxie-mobile-api/',
    '/scan-api/',
    '/schedule-api/',
  ];
  const rawFetch = window.fetch.bind(window);
  let current = readStoredSession();
  let credentialCache = readRuntimeCredential();
  let inFlight = null;
  let lastRefreshError = null;
  let deviceSecurityCsrfToken = '';

  function readStoredSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      return value?.token && Date.parse(value.expires_at) > Date.now() ? value : null;
    } catch { return null; }
  }

  function readRuntimeCredential() {
    try { return String(sessionStorage.getItem(RUNTIME_CREDENTIAL_KEY) || '').trim(); }
    catch { return ''; }
  }

  function canonicalDeviceId(session = current) {
    return String(
      session?.device_id
      || localStorage.getItem(DEVICE_KEY)
      || localStorage.getItem(LEGACY_DEVICE_KEY)
      || '',
    ).trim();
  }

  function storeSession(session, credential = '') {
    current = session?.token ? session : null;
    if (current) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(current));
      if (current.device_id) {
        localStorage.setItem(DEVICE_KEY, current.device_id);
        localStorage.setItem(LEGACY_DEVICE_KEY, current.device_id);
      }
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
    if (credential) {
      credentialCache = credential;
      sessionStorage.setItem(RUNTIME_CREDENTIAL_KEY, credential);
    }
  }

  async function readCredential() {
    if (credentialCache) return credentialCache;
    const runtime = readRuntimeCredential();
    if (runtime) {
      credentialCache = runtime;
      return runtime;
    }
    try {
      const protectedValue = await SecureStorage.get(SECURE_CREDENTIAL_KEY);
      const value = typeof protectedValue === 'string' ? protectedValue.trim() : '';
      if (value) {
        credentialCache = value;
        sessionStorage.setItem(RUNTIME_CREDENTIAL_KEY, value);
        return value;
      }
    } catch {}
    try {
      const fallback = String(localStorage.getItem(SECURE_CREDENTIAL_KEY) || '').trim();
      if (fallback) {
        credentialCache = fallback;
        sessionStorage.setItem(RUNTIME_CREDENTIAL_KEY, fallback);
        return fallback;
      }
    } catch {}
    return '';
  }

  async function refresh(options = {}) {
    const force = options?.force === true;
    if (!force && current?.token && Date.parse(current.expires_at) > Date.now() + 30_000) return current;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const credential = await readCredential();
      if (!credential) {
        lastRefreshError = new Error('This app installation is not enrolled.');
        storeSession(null);
        return null;
      }
      try {
        const response = await rawFetch(`${API}/mobile-auth-api/session`, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'omit',
          headers: {
            'X-Memphis-Device-Credential': credential,
            'X-Device-Id': canonicalDeviceId(),
          },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload.data?.session?.token) {
          throw new Error(payload?.error || `Manager session refresh failed: HTTP ${response.status}`);
        }
        lastRefreshError = null;
        storeSession(payload.data.session, credential);
        return current;
      } catch (error) {
        lastRefreshError = error instanceof Error ? error : new Error(String(error || 'Manager session refresh failed.'));
        storeSession(null, credential);
        return null;
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  }

  async function authHeaders(options = {}) {
    const session = await refresh(options);
    if (!session) throw lastRefreshError || new Error('This app installation is not enrolled.');
    return {
      Authorization: `Bearer ${session.token}`,
      'X-Device-Id': canonicalDeviceId(session),
    };
  }

  async function requestJson(path, options = {}, retry = true) {
    const headers = {
      ...(await authHeaders({ force: options.forceRefresh === true })),
      ...(options.headers || {}),
    };
    if (options.body !== undefined && options.body !== null && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await rawFetch(`${API}${path}`, {
      method: options.method || 'GET',
      cache: 'no-store',
      credentials: 'omit',
      headers,
      body: options.body === undefined || options.body === null
        ? undefined
        : (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)),
    });
    if (retry && (response.status === 401 || response.status === 403)) {
      await refresh({ force: true });
      return requestJson(path, { ...options, forceRefresh: false }, false);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload.data;
  }

  function targetUrl(input) {
    try {
      return new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, window.location.href);
    } catch { return null; }
  }

  function needsNativeAuth(url) {
    return Boolean(url && url.origin === API && AUTHENTICATED_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)));
  }

  async function bridgeFetch(input, init = {}, retry = true) {
    const url = targetUrl(input);
    if (!url || url.origin !== API || url.pathname === '/mobile-auth-api/session') return rawFetch(input, init);
    const originalHeaders = init.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined);
    const headers = new Headers(originalHeaders || {});
    const authenticated = needsNativeAuth(url);
    if (authenticated && !headers.has('Authorization')) {
      try {
        const values = await authHeaders();
        for (const [name, value] of Object.entries(values)) if (value) headers.set(name, value);
      } catch {}
    }
    const deviceId = canonicalDeviceId();
    if (deviceId && !headers.has('X-Device-Id')) headers.set('X-Device-Id', deviceId);
    const nextInit = { ...init, headers, credentials: 'omit' };
    let response;
    try {
      response = await rawFetch(input, nextInit);
    } catch (error) {
      if (!retry) throw error;
      await refresh({ force: true }).catch(() => null);
      await new Promise((resolve) => setTimeout(resolve, 250));
      return bridgeFetch(input, init, false);
    }
    if (retry && authenticated && (response.status === 401 || response.status === 403)) {
      await refresh({ force: true }).catch(() => null);
      return bridgeFetch(input, init, false);
    }
    return response;
  }

  async function deviceSecuritySession() {
    try {
      return await requestJson('/admin-api/device-security/session');
    } catch (error) {
      return { configured: true, unlocked: false, error: error?.message || String(error) };
    }
  }

  async function unlockDeviceSecurity(password) {
    const data = await requestJson('/admin-api/device-security/unlock', {
      method: 'POST',
      body: { password: String(password || '') },
    });
    deviceSecurityCsrfToken = String(data?.csrf_token || '');
    return data;
  }

  async function lockDeviceSecurity() {
    try {
      await requestJson('/admin-api/device-security/lock', {
        method: 'POST',
        headers: deviceSecurityCsrfToken ? { 'X-Device-Security-CSRF': deviceSecurityCsrfToken } : {},
      });
      return true;
    } catch { return false; }
    finally { deviceSecurityCsrfToken = ''; }
  }

  async function deviceSecurityAuthHeaders() {
    return {
      ...(await authHeaders()),
      ...(deviceSecurityCsrfToken ? { 'X-Device-Security-CSRF': deviceSecurityCsrfToken } : {}),
    };
  }

  async function listOpsManagerTrustedDevices() {
    return requestJson('/auth-api/ops/trusted-devices');
  }

  async function renameOpsManagerTrustedDevice(credentialId, deviceLabel) {
    return requestJson(`/auth-api/ops/trusted-devices/${encodeURIComponent(credentialId)}`, {
      method: 'PATCH',
      body: { device_label: String(deviceLabel || '').trim().slice(0, 160) },
    });
  }

  async function revokeOpsManagerTrustedDevice(credentialId, reason = 'manager_revoke_device') {
    return requestJson(`/auth-api/ops/trusted-devices/${encodeURIComponent(credentialId)}/revoke`, {
      method: 'POST',
      body: { reason },
    });
  }

  async function revokeAllOpsManagerTrustedDevices(reason = 'manager_revoke_all') {
    return requestJson('/auth-api/ops/trusted-devices/revoke-all', {
      method: 'POST',
      body: { reason },
    });
  }

  function install() {
    const auth = window.MemphisAuth;
    if (!auth || auth.__nativeBridgeInstalled) return false;
    auth.__nativeBridgeInstalled = true;
    auth.nativeApp = true;
    auth.getDeviceId = () => canonicalDeviceId();
    auth.readSession = () => current || readStoredSession();
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
    auth.isOpsManager = (session = auth.readSession()) => Boolean(session?.token && session.role === 'ops_manager');
    auth.isReadOnlySession = (session = auth.readSession()) => Boolean(session?.read_only || session?.access_level === 'read_only');
    auth.canMutateOpsManagerSurface = (session = auth.readSession()) => Boolean(auth.isOpsManager(session) && !auth.isReadOnlySession(session));
    auth.hasRole = (role, session = auth.readSession()) => Boolean(session && Array.isArray(session.roles) && session.roles.map((value) => String(value).toUpperCase()).includes(String(role).toUpperCase()));
    auth.redirectToManagerHub = () => window.location.assign('./start_page1.html');
    auth.clearSession = async () => {
      current = null;
      lastRefreshError = null;
      sessionStorage.removeItem(SESSION_KEY);
      // The protected enrollment credential remains in Secure Storage. Browser-style
      // session retries must never silently unenroll a manager's phone.
    };
    return true;
  }

  window.fetch = (input, init) => bridgeFetch(input, init, true);
  window.MemphisMobile = {
    refresh,
    authHeaders,
    requestJson,
    fetch: bridgeFetch,
    adoptSession: storeSession,
    readSession: () => current || readStoredSession(),
    readCredential,
    deviceId: canonicalDeviceId,
  };
  if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
})();
