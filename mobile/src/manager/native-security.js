import { Capacitor } from '@capacitor/core';
import { ManagerNativeVault } from '@memphis-zoo/manager-native-vault';

const API_ORIGIN = 'https://memphis-zoo-mcp.onrender.com';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE = /^ops-app-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const FORBIDDEN_WEBVIEW_HEADERS = new Set([
  'authorization', 'connection', 'content-length', 'cookie', 'host', 'origin',
  'proxy-authorization', 'set-cookie', 'transfer-encoding', 'x-csrf-token',
  'x-device-credential', 'x-device-security-csrf', 'x-memphis-device-credential',
]);
const SECRET_KEY_NAMES = new Set([
  'authorization', 'bearertoken', 'cookie', 'csrftoken', 'devicecredential',
  'devicesecuritycsrf', 'enrollmentcode', 'iv', 'legacyseal', 'managercode',
  'password', 'plaintextcredential', 'privatekey', 'proxyauthorization',
  'refreshtoken', 'sealedenvelope', 'sessiontoken', 'setcookie', 'token',
  'wrappedcredential', 'xdevicecredential', 'xmemphisdevicecredential',
]);

function securityError(code, message = 'Protected Manager security is unavailable.') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function canonicalOperationId(value) {
  const operationId = String(value || '').trim().toLowerCase();
  return UUID.test(operationId) ? operationId : '';
}

function canonicalDeviceId(value) {
  const match = String(value || '').trim().match(DEVICE);
  return match ? `ops-app-${match[1].toLowerCase()}` : '';
}

function nativeAndroid() {
  return Capacitor.isNativePlatform?.() === true
    && String(Capacitor.getPlatform?.() || '').toLowerCase() === 'android';
}

function secretKey(name) {
  const normalized = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return SECRET_KEY_NAMES.has(normalized);
}

function assertSecretFree(value, path = '$', seen = new WeakSet()) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return;
  if (typeof value === 'string') {
    if (/^Bearer\s|^Device\s/i.test(value) || /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{32,}$/i.test(value)) {
      throw securityError('manager_native_secret_response_refused');
    }
    return;
  }
  if (typeof value !== 'object') throw securityError('manager_native_invalid_response');
  if (seen.has(value)) throw securityError('manager_native_invalid_response');
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSecretFree(item, `${path}[${index}]`, seen));
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (secretKey(key)) throw securityError('manager_native_secret_response_refused');
      assertSecretFree(item, `${path}.${key}`, seen);
    }
  }
  seen.delete(value);
}

function safeState(value) {
  assertSecretFree(value);
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schema_version !== 2) {
    throw securityError('manager_native_state_invalid');
  }
  const state = String(value.state || '').toUpperCase();
  const installation = value.installation && typeof value.installation === 'object'
    ? value.installation
    : null;
  const deviceId = canonicalDeviceId(
    value.device_id || installation?.device_id || value.pending_device_id || value.removal_device_id || '',
  );
  if ((value.active === true || value.removal_pending === true) && !deviceId) {
    throw securityError('manager_native_binding_missing');
  }
  return Object.freeze({
    schema_version: 2,
    state,
    revision: Number(value.revision || 0),
    active: value.active === true,
    blocked: value.blocked === true,
    reason: String(value.reason || ''),
    device_id: deviceId,
    pending_operation_id: canonicalOperationId(value.pending_operation_id),
    pending_flow: String(value.pending_flow || ''),
    legacy_pending: value.legacy_pending === true,
    removal_operation_id: canonicalOperationId(value.removal_operation_id),
    removal_pending: value.removal_pending === true,
    removal_finalized: value.removal_finalized === true,
  });
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const source = String(value || '');
  if (!source) return new Uint8Array();
  const binary = atob(source);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function safeHeaders(source) {
  const result = {};
  for (const [name, value] of new Headers(source || {})) {
    const lower = name.toLowerCase();
    if (FORBIDDEN_WEBVIEW_HEADERS.has(lower)) {
      throw securityError('manager_native_headers_refused');
    }
    result[name] = value;
  }
  return result;
}

async function encodedRequest(input, init = {}) {
  const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== API_ORIGIN || url.username || url.password || url.hash) {
    throw securityError('manager_native_origin_refused');
  }
  if (request.redirect !== 'follow' && request.redirect !== 'error') {
    throw securityError('manager_native_redirect_refused');
  }
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD'
    ? new Uint8Array()
    : new Uint8Array(await request.clone().arrayBuffer());
  return {
    path: `${url.pathname}${url.search}`,
    method,
    headers: safeHeaders(request.headers),
    body_base64: bytesToBase64(body),
  };
}

export function createManagerNativeSecurity({ plugin = ManagerNativeVault } = {}) {
  let current = Object.freeze({
    schema_version: 2, state: 'CHECKING', revision: 0, active: false, blocked: false,
    reason: '', device_id: '', pending_operation_id: '', pending_flow: '',
    legacy_pending: false, removal_operation_id: '', removal_pending: false,
    removal_finalized: false,
  });
  let inFlightState = null;

  async function inspect() {
    if (!nativeAndroid()) throw securityError('manager_native_vault_required');
    if (!inFlightState) {
      inFlightState = plugin.getState()
        .then((value) => { current = safeState(value); return current; })
        .finally(() => { inFlightState = null; });
    }
    return inFlightState;
  }

  async function enroll({ code, operationId = '' } = {}) {
    const state = await inspect();
    const operation = state.pending_operation_id || canonicalOperationId(operationId) || crypto.randomUUID();
    const normalizedCode = String(code || '').replace(/[\s-]+/g, '');
    if (!/^\d{8}$/.test(normalizedCode)) throw securityError('manager_native_invalid_enrollment', 'Enter the eight-digit personal manager code.');
    const result = state.pending_operation_id
      ? await plugin.resumeEnrollment({ operation_id: operation })
      : await plugin.enroll({
          operation_id: operation,
          flow: 'enrollment',
          enrollment_code: normalizedCode,
        });
    assertSecretFree(result);
    current = safeState(result?.payload?.data?.vault_state || await plugin.getState());
    return Object.freeze({ state: current, data: result?.payload?.data || {} });
  }

  async function resumePendingEnrollment() {
    const state = await inspect();
    if (!state.pending_operation_id) return state;
    const result = await plugin.resumeEnrollment({ operation_id: state.pending_operation_id });
    assertSecretFree(result);
    current = safeState(result?.payload?.data?.vault_state || await plugin.getState());
    return current;
  }

  async function migrateLegacyEnrollment(deviceId) {
    const state = await inspect();
    if (!state.legacy_pending) return state;
    const installation = canonicalDeviceId(deviceId);
    if (!installation) throw securityError('manager_native_legacy_identity_required');
    current = safeState(await plugin.migrateLegacyEnrollment({ device_id: installation }));
    return current;
  }

  async function remove({ operationId = '' } = {}) {
    const state = await inspect();
    if (!state.active && !state.removal_pending) return state;
    const operation = state.removal_operation_id || canonicalOperationId(operationId) || crypto.randomUUID();
    const result = await plugin.removeEnrollment({ operation_id: operation });
    assertSecretFree(result);
    current = safeState(result?.payload?.data?.vault_state || await plugin.getState());
    return current;
  }

  async function authorizedFetch(input, init = {}) {
    const state = await inspect();
    if (!state.active || state.blocked || state.removal_pending) {
      throw securityError('manager_native_not_authorized');
    }
    if (init?.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    const request = await encodedRequest(input, { ...init, credentials: 'omit', redirect: 'error' });
    const result = await plugin.authorizedRequest(request);
    if (init?.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    const headers = new Headers(result?.headers || {});
    for (const name of headers.keys()) {
      if (FORBIDDEN_WEBVIEW_HEADERS.has(name.toLowerCase())) throw securityError('manager_native_secret_response_refused');
    }
    const body = base64ToBytes(result?.body_base64);
    const response = new Response(body, { status: Number(result?.status || 0), headers });
    const type = String(headers.get('content-type') || '').toLowerCase();
    if (type.includes('json') && body.length) assertSecretFree(await response.clone().json());
    return response;
  }

  return Object.freeze({
    native: true,
    ready: inspect(),
    getStatus: () => current,
    inspect,
    enroll,
    resumePendingEnrollment,
    migrateLegacyEnrollment,
    remove,
    authorizedFetch,
  });
}

export const managerNativeSecurity = createManagerNativeSecurity();
