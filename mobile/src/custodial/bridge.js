import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { StatusBar } from '@capacitor/status-bar';

(() => {
  const API = 'https://memphis-zoo-mcp.onrender.com';
  const CREDENTIAL_KEY = 'memphis_zoo_custodial_device_credential';
  const DEVICE_KEY = 'memphisAssignedDeviceId';
  const PREFIXES = ['/device-auth/', '/events-api/', '/feedback-api/', '/messaging-api/', '/scan-api/', '/schedule-api/'];
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
  window.fetch = bridgeFetch;
  window.MemphisMobile = { fetch: bridgeFetch, requestEnvelope, requestJson: async (path, options) => (await requestEnvelope(path, options)).data, authHeaders, readCredential, deviceId };
  const install = () => {
    window.MemphisAuth = {
      ...(window.MemphisAuth || {}),
      getDeviceId: deviceId,
      opsManagerAuthHeaders: authHeaders,
      readSession: () => null,
      isOpsManager: () => false,
    };
  };
  install(); document.addEventListener('DOMContentLoaded', install, { once: true });
})();
