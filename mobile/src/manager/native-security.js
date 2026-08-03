import { Capacitor } from '@capacitor/core';
import { ManagerNativeVault } from '@memphis-zoo/manager-native-vault';

const API_ORIGIN = 'https://memphis-zoo-mcp.onrender.com';
const CONTRACT = 'manager-device-auth.v2';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE = /^ops-app-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const CANONICAL_ROLES = Object.freeze([
  'OPS_MANAGER', 'CUSTODIAL_MANAGER', 'DIRECTOR', 'SECURITY_ADMIN',
]);
const ROLES = new Set(CANONICAL_ROLES);
const ACCESS_LEVELS = new Set(['', 'full_access']);
const KEY_SECURITY_LEVELS = new Set(['', 'trusted_environment', 'strongbox', 'secure_enclave']);
const PUBLIC_STATES = new Set([
  'EMPTY', 'ENROLLING', 'PENDING_CONFIRMATION', 'ACTIVE', 'CANCELLING',
  'CANCELLED', 'REMOVING', 'LEGACY_PENDING', 'BLOCKED',
]);
const STATE_KEYS = new Set([
  'schema_version', 'contract_version', 'state', 'revision', 'active', 'blocked', 'reason',
  'device_id', 'manager_id', 'roles', 'access_level', 'key_security_level',
  'pending_operation_id', 'pending_flow', 'removal_operation_id', 'removal_pending',
]);
const MUTATION_KEYS = new Set(['operation_id', 'replayed', 'vault_state']);
const FORBIDDEN_WEBVIEW_HEADERS = new Set([
  'authorization', 'connection', 'content-length', 'cookie', 'host', 'origin',
  'proxy-authorization', 'set-cookie', 'transfer-encoding', 'x-csrf-token',
  'x-device-credential', 'x-device-security-csrf', 'x-memphis-device-credential',
]);
export const MANAGER_SECRET_KEY_NAMES = Object.freeze([
  'accesstoken', 'authorization', 'bearer', 'bearertoken', 'ciphertext', 'cookie',
  'credential', 'credentialsecret', 'csrftoken', 'devicecredential',
  'devicesecuritycsrf', 'enrollmentcode', 'envelope', 'iv', 'legacyseal',
  'managercode', 'opssession', 'password', 'plaintextcredential', 'privatekey',
  'proof', 'proxyauthorization', 'refreshtoken', 'salt', 'sealedenvelope', 'secret',
  'sessiontoken', 'setcookie', 'signature', 'token', 'wrappedcredential',
  'xdevicecredential', 'xmemphisdevicecredential',
]);
const SECRET_KEY_NAMES = new Set(MANAGER_SECRET_KEY_NAMES);

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

function nativeManagerPlatform() {
  const platform = String(Capacitor.getPlatform?.() || '').toLowerCase();
  return Capacitor.isNativePlatform?.() === true && (platform === 'android' || platform === 'ios');
}

function secretKey(name) {
  return SECRET_KEY_NAMES.has(String(name || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
}

export function assertManagerSecretFree(value, seen = new WeakSet(), disclosedSecretKeys = new Set()) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return;
  if (typeof value === 'string') {
    if (/^(?:Bearer|Device)\s/i.test(value) || /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{32,}$/i.test(value)) {
      throw securityError('manager_native_secret_response_refused');
    }
    return;
  }
  if (typeof value !== 'object' || seen.has(value)) throw securityError('manager_native_invalid_response');
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => assertManagerSecretFree(item, seen, disclosedSecretKeys));
  } else {
    for (const [key, item] of Object.entries(value)) {
      const normalized = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (secretKey(key) && !disclosedSecretKeys.has(normalized)) {
        throw securityError('manager_native_secret_response_refused');
      }
      assertManagerSecretFree(item, seen, disclosedSecretKeys);
    }
  }
  seen.delete(value);
}

function exactKeys(value, expected, code) {
  const keys = Object.keys(value || {});
  if (keys.length !== expected.size || keys.some((key) => !expected.has(key))) throw securityError(code);
}

function safeState(value) {
  assertManagerSecretFree(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw securityError('manager_native_state_invalid');
  exactKeys(value, STATE_KEYS, 'manager_native_state_invalid');
  if (value.schema_version !== 2 || value.contract_version !== CONTRACT) throw securityError('manager_native_state_invalid');
  const state = String(value.state || '').toUpperCase();
  const revision = Number(value.revision);
  const deviceId = value.device_id ? canonicalDeviceId(value.device_id) : '';
  const pendingOperationId = value.pending_operation_id ? canonicalOperationId(value.pending_operation_id) : '';
  const removalOperationId = value.removal_operation_id ? canonicalOperationId(value.removal_operation_id) : '';
  const pendingFlow = String(value.pending_flow || '');
  const accessLevel = String(value.access_level || '');
  const keySecurityLevel = String(value.key_security_level || '');
  const roles = Array.isArray(value.roles) ? value.roles.map(String) : null;
  if (!PUBLIC_STATES.has(state) || !Number.isSafeInteger(revision) || revision < 0 || !roles
      || roles.some((role, index) => !ROLES.has(role)
          || roles.indexOf(role) !== index
          || CANONICAL_ROLES.indexOf(role) <= (index ? CANONICAL_ROLES.indexOf(roles[index - 1]) : -1))
      || !ACCESS_LEVELS.has(accessLevel) || !KEY_SECURITY_LEVELS.has(keySecurityLevel)
      || !['', 'enroll', 'recover', 'replace'].includes(pendingFlow)
      || (value.device_id && !deviceId) || (value.pending_operation_id && !pendingOperationId)
      || (value.removal_operation_id && !removalOperationId)
      || ((value.active === true || value.removal_pending === true) && !deviceId)
      || (value.active === true && (
        !keySecurityLevel
        || !(
          state === 'ACTIVE'
          || (['ENROLLING', 'PENDING_CONFIRMATION', 'CANCELLING'].includes(state)
              && ['recover', 'replace'].includes(pendingFlow))
        )
        || (roles.length > 0 && (roles[0] !== 'OPS_MANAGER' || accessLevel !== 'full_access'))
      ))
      || (state === 'ACTIVE' && value.active !== true)
      || (state === 'BLOCKED' && value.blocked !== true)
      || (['ENROLLING', 'PENDING_CONFIRMATION', 'CANCELLING'].includes(state)
          && (!pendingOperationId || !pendingFlow))
      || (state === 'REMOVING' && (!removalOperationId || value.removal_pending !== true))) {
    throw securityError('manager_native_state_invalid');
  }
  return Object.freeze({
    schema_version: 2,
    contract_version: CONTRACT,
    state,
    revision,
    active: value.active === true,
    blocked: value.blocked === true,
    reason: String(value.reason || ''),
    device_id: deviceId,
    manager_id: String(value.manager_id || ''),
    roles: Object.freeze([...roles]),
    access_level: accessLevel,
    key_security_level: keySecurityLevel,
    pending_operation_id: pendingOperationId,
    pending_flow: pendingFlow,
    removal_operation_id: removalOperationId,
    removal_pending: value.removal_pending === true,
  });
}

function safeMutation(value, expectedOperationId) {
  assertManagerSecretFree(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw securityError('manager_native_mutation_invalid');
  exactKeys(value, MUTATION_KEYS, 'manager_native_mutation_invalid');
  const operationId = canonicalOperationId(value.operation_id);
  if (!operationId || operationId !== expectedOperationId || typeof value.replayed !== 'boolean') {
    throw securityError('manager_native_mutation_invalid');
  }
  return Object.freeze({ operation_id: operationId, replayed: value.replayed, vault_state: safeState(value.vault_state) });
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
    if (FORBIDDEN_WEBVIEW_HEADERS.has(name.toLowerCase())) throw securityError('manager_native_headers_refused');
    result[name] = value;
  }
  return result;
}

async function encodedRequest(input, init = {}) {
  const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== API_ORIGIN || url.username || url.password || url.hash) throw securityError('manager_native_origin_refused');
  if (request.redirect !== 'follow' && request.redirect !== 'error') throw securityError('manager_native_redirect_refused');
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? new Uint8Array() : new Uint8Array(await request.clone().arrayBuffer());
  return { path: `${url.pathname}${url.search}`, method, headers: safeHeaders(request.headers), body_base64: bytesToBase64(body) };
}

function freshOperationId(value) {
  const supplied = canonicalOperationId(value);
  if (supplied) return supplied;
  const generated = canonicalOperationId(globalThis.crypto?.randomUUID?.());
  if (!generated) throw securityError('manager_native_operation_id_unavailable');
  return generated;
}

export function createManagerNativeSecurity({ plugin = ManagerNativeVault } = {}) {
  let current = Object.freeze({
    schema_version: 2, contract_version: CONTRACT, state: 'CHECKING', revision: 0,
    active: false, blocked: false, reason: '', device_id: '', manager_id: '', roles: Object.freeze([]),
    access_level: '', key_security_level: '', pending_operation_id: '', pending_flow: '',
    removal_operation_id: '', removal_pending: false,
  });
  let inFlightState = null;

  async function inspect() {
    if (!nativeManagerPlatform()) throw securityError('manager_native_vault_required');
    if (!inFlightState) {
      inFlightState = plugin.getStatus()
        .then((value) => { current = safeState(value); return current; })
        .finally(() => { inFlightState = null; });
    }
    return inFlightState;
  }

  async function enroll({ code, flow = 'enroll', operationId = '', deviceLabel = 'Memphis Zoo Ops Device' } = {}) {
    const state = await inspect();
    const publicFlow = String(flow || '');
    if (!['enroll', 'recover', 'replace'].includes(publicFlow)) throw securityError('manager_native_invalid_enrollment');
    if (state.pending_operation_id && state.pending_flow !== publicFlow) {
      throw securityError('manager_native_enrollment_conflict');
    }
    if (state.pending_operation_id && operationId
        && canonicalOperationId(operationId) !== state.pending_operation_id) {
      throw securityError('manager_native_enrollment_conflict');
    }
    if (publicFlow === 'replace' && !state.pending_operation_id
        && !(state.state === 'ACTIVE' && state.active)
        && !(['BLOCKED', 'LEGACY_PENDING'].includes(state.state)
          && state.reason === 'manager_native_replacement_required')) {
      throw securityError('manager_native_replacement_refused');
    }
    const operation = state.pending_operation_id || freshOperationId(operationId);
    const normalizedCode = String(code || '').replace(/[\s-]+/g, '');
    const label = String(deviceLabel || '').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!/^\d{8}$/.test(normalizedCode)) throw securityError('manager_native_invalid_enrollment', 'Enter the eight-digit personal manager code.');
    if (!label || [...label].length > 160) throw securityError('manager_native_invalid_device_label');
    const raw = state.pending_operation_id
      ? await plugin.resumeEnrollment({ operation_id: operation })
      : await plugin.enroll({
          operation_id: operation,
          flow: publicFlow,
          enrollment_code: normalizedCode,
          device_label: label,
          requested_access_level: 'full_access',
        });
    const result = safeMutation(raw, operation);
    current = result.vault_state;
    return result;
  }

  async function resumePendingEnrollment() {
    const state = await inspect();
    if (!state.pending_operation_id) return state;
    if (state.state !== 'ENROLLING') throw securityError('manager_native_enrollment_resume_refused');
    const result = safeMutation(
      await plugin.resumeEnrollment({ operation_id: state.pending_operation_id }),
      state.pending_operation_id,
    );
    current = result.vault_state;
    return current;
  }

  async function reconcilePendingState() {
    let state = await inspect();
    if (state.state === 'REMOVING' || state.removal_pending) {
      const operation = state.removal_operation_id;
      if (!operation) throw securityError('manager_native_removal_conflict');
      const result = safeMutation(await plugin.remove({ operation_id: operation }), operation);
      current = result.vault_state;
      return current;
    }
    const operation = state.pending_operation_id;
    if (!operation) return state;
    if (state.state === 'CANCELLING') {
      const result = safeMutation(await plugin.cancelEnrollment({ operation_id: operation }), operation);
      current = result.vault_state;
      return current;
    }
    if (state.state === 'PENDING_CONFIRMATION') {
      const result = safeMutation(await plugin.confirmEnrollment({ operation_id: operation }), operation);
      current = result.vault_state;
      return current;
    }
    if (state.state !== 'ENROLLING') throw securityError('manager_native_enrollment_resume_refused');
    const resumed = safeMutation(await plugin.resumeEnrollment({ operation_id: operation }), operation);
    current = resumed.vault_state;
    state = current;
    if (state.state === 'PENDING_CONFIRMATION') {
      const confirmed = safeMutation(await plugin.confirmEnrollment({ operation_id: operation }), operation);
      current = confirmed.vault_state;
    }
    return current;
  }

  async function confirmEnrollment(operationId = '') {
    const state = await inspect();
    const operation = state.pending_operation_id || canonicalOperationId(operationId);
    if (!operation) throw securityError('manager_native_enrollment_conflict');
    const result = safeMutation(await plugin.confirmEnrollment({ operation_id: operation }), operation);
    current = result.vault_state;
    return result;
  }

  async function cancelEnrollment(operationId = '') {
    const state = await inspect();
    const operation = state.pending_operation_id || canonicalOperationId(operationId);
    if (!operation) return state;
    const result = safeMutation(await plugin.cancelEnrollment({ operation_id: operation }), operation);
    current = result.vault_state;
    return result;
  }

  async function remove({ operationId = '' } = {}) {
    const state = await inspect();
    if (!state.active && !state.blocked && !state.removal_pending) return state;
    const operation = state.removal_operation_id || freshOperationId(operationId);
    const result = safeMutation(await plugin.remove({ operation_id: operation }), operation);
    current = result.vault_state;
    return result;
  }

  async function authorizedFetch(input, init = {}) {
    const state = await inspect();
    if (!state.active || state.blocked || state.removal_pending) throw securityError('manager_native_not_authorized');
    if (init?.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    const request = await encodedRequest(input, { ...init, credentials: 'omit', redirect: 'error' });
    const disclosedSecretKeys = request.path === '/admin-api/device-auth/enrollment-code'
      ? new Set(['enrollmentcode'])
      : new Set();
    let result;
    try {
      result = await plugin.authorizedRequest(request);
    } catch (error) {
      try { current = safeState(await plugin.getStatus()); } catch {}
      throw error;
    }
    assertManagerSecretFree(result, new WeakSet(), disclosedSecretKeys);
    if (init?.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    const headers = new Headers(result?.headers || {});
    for (const name of headers.keys()) {
      if (FORBIDDEN_WEBVIEW_HEADERS.has(name.toLowerCase())) throw securityError('manager_native_secret_response_refused');
    }
    const body = base64ToBytes(result?.body_base64);
    const status = Number(result?.status || 0);
    if (!Number.isInteger(status) || status < 100 || status > 599) throw securityError('manager_native_invalid_response');
    const response = new Response(body, { status, headers });
    const type = String(headers.get('content-type') || '').toLowerCase();
    if (type.includes('json') && body.length) {
      assertManagerSecretFree(await response.clone().json(), new WeakSet(), disclosedSecretKeys);
    }
    current = safeState(await plugin.getStatus());
    return response;
  }

  return Object.freeze({
    native: true,
    ready: inspect(),
    getStatus: () => current,
    inspect,
    enroll,
    resumePendingEnrollment,
    reconcilePendingState,
    confirmEnrollment,
    cancelEnrollment,
    remove,
    authorizedFetch,
  });
}

export const managerNativeSecurity = createManagerNativeSecurity();
