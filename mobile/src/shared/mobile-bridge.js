import { StatusBar } from '@capacitor/status-bar';

(() => {
  const API = 'https://memphis-zoo-mcp.onrender.com';
  const DEVICE_KEY = 'memphisAssignedDeviceId';
  const LEGACY_DEVICE_KEY = 'mz_scan_device_id';
  const AUTHENTICATED_API_PREFIXES = [
    '/admin-api/',
    '/dashboard-api/',
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
  const hideNativeStatusBar = () => { void StatusBar.hide().catch(() => {}); };
  hideNativeStatusBar();
  window.addEventListener('focus', hideNativeStatusBar, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) hideNativeStatusBar(); });
  let current = null;
  let inFlight = null;
  let lastRefreshError = null;
  let deviceSecurityCsrfToken = '';

  function canonicalDeviceId(session = current) {
    return String(
      session?.device_id
      || localStorage.getItem(DEVICE_KEY)
      || localStorage.getItem(LEGACY_DEVICE_KEY)
      || '',
    ).trim();
  }

  function storeSession(session) {
    current = session?.token ? session : null;
    if (current?.device_id) {
      localStorage.setItem(DEVICE_KEY, current.device_id);
      localStorage.setItem(LEGACY_DEVICE_KEY, current.device_id);
    }
    return current;
  }

  async function refresh(options = {}) {
    const force = options?.force === true;
    if (!force && current?.token && Date.parse(current.expires_at) > Date.now() + 30_000) return current;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const response = await rawFetch(`${API}/auth-api/session?access_level=full_access`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          signal: AbortSignal.timeout(10000),
          headers: canonicalDeviceId() ? { 'X-Device-Id': canonicalDeviceId() } : {},
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload.data?.session?.token) {
          const error = new Error(payload?.error || `Manager access update failed (${response.status}).`);
          error.status = response.status;
          throw error;
        }
        lastRefreshError = null;
        return storeSession(payload.data.session);
      } catch (error) {
        lastRefreshError = error instanceof Error ? error : new Error(String(error || 'Manager access update failed.'));
        if (lastRefreshError.status === 401 || lastRefreshError.status === 403) storeSession(null);
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

  function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
  function isAbort(error) { return error?.name === 'AbortError' || /aborted/i.test(String(error?.message || '')); }
  function isNetworkFailure(error) {
    return error instanceof TypeError || /failed to fetch|network|connection|load failed|internet/i.test(String(error?.message || ''));
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
      credentials: 'include',
      signal: options.signal,
      headers,
      body: encodedBody(options.body, headers),
    }, true);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `Request failed (${response.status}).`);
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
    } catch { return null; }
  }

  function needsNativeAuth(url) {
    return Boolean(url && url.origin === API && AUTHENTICATED_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)));
  }

  async function bridgeFetch(input, init = {}, retry = true) {
    const url = targetUrl(input);
    if (!url || url.origin !== API) return rawFetch(input, init);
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const signal = init.signal || request?.signal;
    signal?.throwIfAborted();
    const headers = new Headers(init.headers || request?.headers || {});
    const authenticated = needsNativeAuth(url);
    if (authenticated && !headers.has('Authorization')) {
      const values = await authHeaders();
      signal?.throwIfAborted();
      for (const [name, value] of Object.entries(values)) if (value) headers.set(name, value);
    }
    const identity = current;
    const id = canonicalDeviceId();
    if (id && !headers.has('X-Device-Id')) headers.set('X-Device-Id', id);
    const method = String(init.method || request?.method || 'GET').toUpperCase();
    // Clone before a Request body is consumed. An unknown network outcome may
    // retry only reads; a 401 is retried once after verified authentication.
    const retryInput = retry && request ? request.clone() : input;
    let response;
    try { response = await rawFetch(input, { ...init, headers, credentials: 'include' }); }
    catch (error) {
      if (isAbort(error) || signal?.aborted || !retry || !isNetworkFailure(error)
          || !['GET', 'HEAD'].includes(method)) throw error;
      await wait(400);
      signal?.throwIfAborted();
      return bridgeFetch(retryInput, init, false);
    }
    if (retry && authenticated && response.status === 401) {
      const renewed = await refresh({ force: true });
      signal?.throwIfAborted();
      if (!renewed || (!identity && !['GET', 'HEAD'].includes(method))
          || (identity && (identity.manager_id !== renewed.manager_id
          || identity.credential_id !== renewed.credential_id))) return response;
      const renewedHeaders = new Headers(headers);
      renewedHeaders.set('Authorization', `Bearer ${renewed.token}`);
      renewedHeaders.set('X-Device-Id', canonicalDeviceId(renewed));
      return bridgeFetch(retryInput, { ...init, headers: renewedHeaders }, false);
    }
    // A genuine authorization denial is terminal, not a renewal trigger.
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
    auth.readSession = () => current;
    auth.requireOpsManagerSession = async (options = {}) => {
      const session = await refresh({ force: options.forceRefresh === true });
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
    auth.clearSession = async () => { storeSession(null); lastRefreshError = null; };
    return true;
  }

  window.fetch = (input, init) => bridgeFetch(input, init, true);
  window.MemphisMobile = {
    handlesManagerAuthenticationRetry: true,
    refresh,
    authHeaders,
    requestEnvelope,
    requestJson,
    fetch: bridgeFetch,
    adoptSession: storeSession,
    readSession: () => current,
    deviceId: canonicalDeviceId,
  };
  if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
})();
