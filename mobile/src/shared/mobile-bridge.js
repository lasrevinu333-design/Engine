(() => {
  const API = 'https://memphis-zoo-mcp.onrender.com';
  const SESSION_KEY = 'mz_native_session';
  const CREDENTIAL_KEY = 'mz_native_device_credential_runtime';
  const DEVICE_KEY = 'memphisAssignedDeviceId';
  let current = readStored();
  let inFlight = null;

  function readStored() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      return value?.token && Date.parse(value.expires_at) > Date.now() ? value : null;
    } catch { return null; }
  }
  function store(session, credential = '') {
    current = session?.token ? session : null;
    if (current) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(current));
      if (current.device_id) localStorage.setItem(DEVICE_KEY, current.device_id);
    } else sessionStorage.removeItem(SESSION_KEY);
    if (credential) sessionStorage.setItem(CREDENTIAL_KEY, credential);
  }
  async function refresh() {
    if (current?.token && Date.parse(current.expires_at) > Date.now() + 30000) return current;
    if (inFlight) return inFlight;
    const credential = sessionStorage.getItem(CREDENTIAL_KEY) || '';
    if (!credential) return null;
    inFlight = fetch(`${API}/mobile-auth-api/session`, {
      method: 'POST', cache: 'no-store',
      headers: { 'X-Memphis-Device-Credential': credential, 'X-Device-Id': localStorage.getItem(DEVICE_KEY) || '' },
    }).then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload.data?.session?.token) throw new Error(payload?.error || `HTTP ${response.status}`);
      store(payload.data.session, credential);
      return current;
    }).catch(() => { store(null); return null; }).finally(() => { inFlight = null; });
    return inFlight;
  }
  async function headers() {
    const session = await refresh();
    if (!session) throw new Error('This app installation is not enrolled.');
    return { Authorization: `Bearer ${session.token}`, 'X-Device-Id': session.device_id || localStorage.getItem(DEVICE_KEY) || '' };
  }
  function install() {
    const auth = window.MemphisAuth;
    if (!auth || auth.__nativeBridgeInstalled) return false;
    auth.__nativeBridgeInstalled = true;
    auth.readSession = () => current || readStored();
    auth.requireOpsManagerSession = async (options = {}) => {
      const session = await refresh();
      if (!session && options.throwOnFailure) throw new Error('This app installation is not enrolled.');
      return session;
    };
    auth.opsManagerAuthHeaders = headers;
    auth.deviceSecurityAuthHeaders = headers;
    auth.requestTrustedOpsSession = refresh;
    auth.requestPublicOpsSession = refresh;
    auth.isOpsManager = (session = auth.readSession()) => Boolean(session?.token && session.role === 'ops_manager');
    auth.isReadOnlySession = (session = auth.readSession()) => Boolean(session?.read_only || session?.access_level === 'read_only');
    auth.canMutateOpsManagerSurface = (session = auth.readSession()) => Boolean(auth.isOpsManager(session) && !auth.isReadOnlySession(session));
    auth.hasRole = (role, session = auth.readSession()) => Boolean(session && Array.isArray(session.roles) && session.roles.map((r) => String(r).toUpperCase()).includes(String(role).toUpperCase()));
    auth.clearSession = async () => {
      const credential = sessionStorage.getItem(CREDENTIAL_KEY) || '';
      try { if (credential) await fetch(`${API}/mobile-auth-api/logout`, { method: 'POST', headers: { 'X-Memphis-Device-Credential': credential } }); } catch {}
      store(null);
      sessionStorage.removeItem(CREDENTIAL_KEY);
    };
    return true;
  }

  window.MemphisMobile = { refresh, authHeaders: headers, adoptSession: store, readSession: () => current || readStored() };
  if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
})();
