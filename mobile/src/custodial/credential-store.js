export const CUSTODIAL_CREDENTIAL_KEY = 'memphis_zoo_custodial_device_credential';
export const CUSTODIAL_INSTALLATION_SEAL_KEY = 'memphis_zoo_custodial_installation_seal';
export const CUSTODIAL_INSTALLATION_RECORD_KEY = 'memphis_zoo_custodial_installation_record_v1';
export const CUSTODIAL_INSTALLATION_MARKER_KEY = 'memphisZooCustodialInstallationSeal';
export const CUSTODIAL_RESTORE_QUARANTINE_KEY = 'memphisZooCustodialRestoreQuarantine';
export const CUSTODIAL_RECOVERY_RECORD_KEY = 'memphisZooCustodialRecoveryRecord';
export const CUSTODIAL_ENROLLMENT_OPERATION_KEY = 'memphisZooCustodialEnrollmentOperationV1';
export const CUSTODIAL_REMOVAL_OPERATION_KEY = 'memphisZooCustodialRemovalOperationV1';

export const CUSTODIAL_DEVICE_KEYS = Object.freeze([
  'memphisAssignedDeviceId',
  'mz_scan_device_id',
  'mz_employee_hub_device_id',
]);

const SESSION_PREFIX = 'session:';
const MESSENGER_OUTBOX_PREFIX = 'mz_messenger_v2_outbox:';
const CHATSCOPE_OUTBOX_PREFIX = 'mz_chatscope_outbox:';
const MESSENGER_DRAFT_PREFIX = 'mz_messenger_v2_draft:';
const SCAN_COMPLETION_DRAFT_PREFIX = 'mz_scan_completion_draft:';
const WORK_POSITION_EVIDENCE_PREFIX = 'mz_work_position_evidence:';
const PHONE_SCAN_RESUME_PREFIX = 'mz_phone_scan_resume:';
const SCAN_QUEUE_DATABASE = 'mz_scan_queue';
const SCAN_QUEUE_STORE = 'actions';
const INSTALLATION_SCHEMA_VERSION = 1;
const RECOVERY_SCHEMA_VERSION = 1;
const ENROLLMENT_OPERATION_SCHEMA_VERSION = 1;
const REMOVAL_OPERATION_SCHEMA_VERSION = 1;
const SHARED_STORE_KEY = Symbol.for('org.memphiszoo.custodial.credential-store');
const IDENTITY_FIELDS = new Set([
  'assigned_device_id',
  'canonical_device_id',
  'device_id',
  'device_identifier',
  'deviceId',
  'deviceIdentifier',
  'p_device_id',
  'p_device_identifier',
]);

/**
 * @typedef {{
 *   get(key: string): Promise<unknown>,
 *   set(key: string, value: string): Promise<unknown>,
 *   remove(key: string): Promise<unknown>
 * }} SecureStorageLike
 */

export class CustodialCredentialQuarantineError extends Error {
  constructor(reason, recovery = null) {
    super('Protected enrollment state does not match this phone. Preserve its offline work and contact the Custodial Manager before re-enrolling.');
    this.name = 'CustodialCredentialQuarantineError';
    this.code = 'custodial_restore_quarantine';
    this.reason = reason;
    this.recovery = recovery;
  }
}

export class CustodialSecureStorageError extends Error {
  constructor(operation, cause) {
    super(`Protected credential storage is unavailable during ${operation}. Restart the app and try again.`);
    this.name = 'CustodialSecureStorageError';
    this.code = 'custodial_secure_storage_unavailable';
    this.operation = operation;
    this.cause = cause;
  }
}

export class CustodialStateInspectionError extends Error {
  constructor(operation, cause) {
    super(`Protected phone state could not be verified during ${operation}. Offline work remains untouched.`);
    this.name = 'CustodialStateInspectionError';
    this.code = 'custodial_security_state_unavailable';
    this.operation = operation;
    this.cause = cause;
  }
}

export class CustodialPendingWorkError extends Error {
  constructor(preservedCounts) {
    super('Enrollment cannot be removed while this phone has preserved sessions, messages, or scan actions. Synchronize or recover that work first.');
    this.name = 'CustodialPendingWorkError';
    this.code = 'custodial_pending_work';
    this.preservedCounts = cloneJson(preservedCounts);
  }
}

export class CustodialRecoveryError extends Error {
  constructor(reason, cause = null) {
    super('Manager recovery was refused because the selected phone identity could not be proven to own the preserved work.');
    this.name = 'CustodialRecoveryError';
    this.code = 'custodial_recovery_refused';
    this.reason = reason;
    this.cause = cause;
  }
}

export class CustodialSecurityTransitionError extends Error {
  constructor(status, reason = '') {
    const code = normalized(reason || status?.reason)
      || (status?.quarantined ? 'custodial_restore_quarantine' : 'custodial_security_state_unavailable');
    super('Protected phone security is not in a stable writable state. Offline work remains untouched.');
    this.name = 'CustodialSecurityTransitionError';
    this.code = code;
    this.reason = code;
    this.recovery = cloneJson(status?.recovery || null);
  }
}

export class CustodialEnrollmentOperationError extends Error {
  constructor(reason) {
    super('The pending enrollment operation must be resumed or explicitly cancelled before another enrollment can begin.');
    this.name = 'CustodialEnrollmentOperationError';
    this.code = 'custodial_enrollment_operation_pending';
    this.reason = reason;
  }
}

export class CustodialEnrollmentRemovalPendingError extends Error {
  constructor(record) {
    super('Enrollment removal is pending. The app will safely resume push unregistration and server logout before erasing local enrollment.');
    this.name = 'CustodialEnrollmentRemovalPendingError';
    this.code = 'custodial_enrollment_removal_pending';
    this.reason = 'custodial_enrollment_removal_pending';
    this.operation = cloneJson(record);
  }
}

function normalized(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function canonicalDeviceId(value) {
  const match = normalized(value).match(/^KIOSK[_-]?(\d{1,2})$/i);
  if (!match) return '';
  const number = Number(match[1]);
  return number >= 2 && number <= 10 ? `KIOSK_${String(number).padStart(2, '0')}` : '';
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function jsonObject(value) {
  if (!normalized(value)) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isoTimestamp(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function randomSeal(cryptoApi) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }
  throw new CustodialSecureStorageError('installation binding', new Error('Secure randomness is unavailable'));
}

function randomOperationId(cryptoApi) {
  const value = typeof cryptoApi?.randomUUID === 'function' ? normalized(cryptoApi.randomUUID()) : '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return value;
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new CustodialSecureStorageError('enrollment operation creation', new Error('Secure UUID generation is unavailable'));
}

function installationRecord(raw) {
  const value = jsonObject(raw);
  if (!value || value.schema_version !== INSTALLATION_SCHEMA_VERSION) return null;
  const credential = normalized(value.credential);
  const deviceId = canonicalDeviceId(value.device_id);
  const seal = normalized(value.installation_seal);
  if (!credential || !deviceId || !seal) return null;
  return { ...value, credential, device_id: deviceId, installation_seal: seal };
}

function recoveryRecord(raw) {
  const value = jsonObject(raw);
  if (!value || value.schema_version !== RECOVERY_SCHEMA_VERSION || !normalized(value.recovery_id)) return null;
  if (!['pending_manager_recovery', 'resolved'].includes(value.status)) return null;
  return value;
}

function enrollmentOperationRecord(raw) {
  const value = jsonObject(raw);
  if (!value || value.schema_version !== ENROLLMENT_OPERATION_SCHEMA_VERSION) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized(value.operation_id))) return null;
  const deviceId = canonicalDeviceId(value.device_id);
  if (!deviceId || !['enrollment', 'recovery'].includes(value.flow)) return null;
  if (!['pending_server', 'local_committed_pending_server_confirmation'].includes(value.status)) return null;
  return { ...value, device_id: deviceId };
}

function removalOperationRecord(raw) {
  const value = jsonObject(raw);
  if (!value || value.schema_version !== REMOVAL_OPERATION_SCHEMA_VERSION) return null;
  if (!normalized(value.operation_id) || !canonicalDeviceId(value.device_id)) return null;
  if (!['pending_push_unregister', 'push_unregistered', 'server_logged_out'].includes(value.phase)) return null;
  return { ...value, device_id: canonicalDeviceId(value.device_id) };
}

function quarantineRecord(raw) {
  const value = jsonObject(raw);
  if (!value || value.schema_version !== RECOVERY_SCHEMA_VERSION || value.active !== true) return null;
  if (!normalized(value.recovery_id) || !normalized(value.reason)) return null;
  return value;
}

function hasName(names, wanted) {
  if (!names) return false;
  if (typeof names.contains === 'function') return names.contains(wanted);
  return Array.from(names).includes(wanted);
}

async function inspectIndexedDbQueue(indexedDb) {
  if (!indexedDb || typeof indexedDb.open !== 'function') {
    return { available: false, databaseExists: false, records: [] };
  }

  if (typeof indexedDb.databases === 'function') {
    try {
      const databases = await indexedDb.databases();
      if (Array.isArray(databases) && !databases.some((item) => item?.name === SCAN_QUEUE_DATABASE)) {
        return { available: true, databaseExists: false, records: [] };
      }
    } catch {
      // Directly opening an existing database is still safe. If it does not exist,
      // the initial version-change transaction is aborted below so no empty queue
      // is left behind by inspection.
    }
  }

  return new Promise((resolve, reject) => {
    let createdByProbe = false;
    let settled = false;
    let database = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try { database?.close?.(); } catch {}
      resolve(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      try { database?.close?.(); } catch {}
      reject(new CustodialStateInspectionError('scan queue inspection', error));
    };

    let request;
    try { request = indexedDb.open(SCAN_QUEUE_DATABASE); }
    catch (error) { fail(error); return; }

    request.onblocked = () => fail(new Error('Scan queue inspection is blocked by another app view'));
    request.onupgradeneeded = () => {
      createdByProbe = true;
      database = request.result;
      try { request.transaction?.abort?.(); } catch {}
    };
    request.onerror = () => {
      if (createdByProbe) finish({ available: true, databaseExists: false, records: [] });
      else fail(request.error || new Error('Scan queue could not be opened'));
    };
    request.onsuccess = () => {
      database = request.result;
      if (createdByProbe) {
        finish({ available: true, databaseExists: false, records: [] });
        return;
      }
      if (!hasName(database?.objectStoreNames, SCAN_QUEUE_STORE)) {
        finish({ available: true, databaseExists: true, records: [] });
        return;
      }

      let transaction;
      let rows = [];
      try {
        transaction = database.transaction(SCAN_QUEUE_STORE, 'readonly');
        const store = transaction.objectStore(SCAN_QUEUE_STORE);
        if (typeof store.getAll === 'function') {
          const all = store.getAll();
          all.onsuccess = () => { rows = Array.isArray(all.result) ? all.result : []; };
          all.onerror = () => fail(all.error || new Error('Scan queue records could not be read'));
        } else {
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            rows.push(current.value);
            current.continue();
          };
          cursor.onerror = () => fail(cursor.error || new Error('Scan queue records could not be read'));
        }
      } catch (error) {
        fail(error);
        return;
      }
      transaction.oncomplete = () => finish({ available: true, databaseExists: true, records: rows });
      transaction.onerror = () => fail(transaction.error || new Error('Scan queue inspection failed'));
      transaction.onabort = () => fail(transaction.error || new Error('Scan queue inspection was aborted'));
    };
  });
}

/**
 * @param {{
 *   secureStorage?: SecureStorageLike,
 *   storage?: Storage,
 *   cryptoApi?: Crypto,
 *   indexedDb?: IDBFactory,
 *   now?: () => Date|string|number,
 *   verifyManagerCode?: (request: object) => Promise<boolean|object>|boolean|object,
 * }} [options]
 */
export function createCustodialCredentialStore({
  secureStorage,
  storage,
  cryptoApi = globalThis.crypto,
  indexedDb = globalThis.indexedDB,
  now = () => new Date(),
  verifyManagerCode: defaultManagerVerifier = null,
} = {}) {
  if (!secureStorage || typeof secureStorage.get !== 'function' || typeof secureStorage.set !== 'function' || typeof secureStorage.remove !== 'function') {
    throw new TypeError('A SecureStorage-compatible implementation is required');
  }
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function' || typeof storage.key !== 'function') {
    throw new TypeError('A Storage-compatible implementation is required');
  }

  const listeners = new Set();
  let operationTail = Promise.resolve();
  let activeQuarantine = null;
  let latestRecovery = null;
  let activeCredential = '';
  let pendingEnrollmentOperation = null;
  let pendingRemovalOperation = null;
  let status = {
    state: 'unchecked',
    initialized: false,
    ready: false,
    checked: false,
    available: false,
    quarantined: false,
    reason: 'custodial_security_state_unchecked',
    generation: 0,
    deviceId: '',
    preservedCounts: null,
    recovery: null,
    enrollmentOperation: null,
    removalOperation: null,
  };

  function localRawGet(key, operation = 'local state inspection') {
    try {
      const value = storage.getItem(key);
      return typeof value === 'string' ? value : '';
    }
    catch (error) { throw new CustodialStateInspectionError(operation, error); }
  }

  function localGet(key, operation = 'local state inspection') {
    return normalized(localRawGet(key, operation));
  }

  function localSet(key, value, operation = 'local state write') {
    try { storage.setItem(key, String(value)); }
    catch (error) { throw new CustodialStateInspectionError(operation, error); }
  }

  function localRemove(key, operation = 'local state removal') {
    try { storage.removeItem(key); }
    catch (error) { throw new CustodialStateInspectionError(operation, error); }
  }

  function localKeys() {
    try {
      const keys = [];
      for (let index = 0; index < Number(storage.length || 0); index += 1) {
        const key = storage.key(index);
        if (typeof key === 'string') keys.push(key);
      }
      return keys;
    } catch (error) {
      throw new CustodialStateInspectionError('local state enumeration', error);
    }
  }

  function purgeLegacyPlaintextCredential() {
    try { storage.removeItem(CUSTODIAL_CREDENTIAL_KEY); } catch {}
  }

  async function protectedGet(key, operation) {
    try {
      const value = await secureStorage.get(key);
      if (value == null) return '';
      if (typeof value !== 'string') throw new TypeError('Protected value has an unexpected type');
      return value.trim();
    }
    catch (error) { throw new CustodialSecureStorageError(operation, error); }
  }

  async function protectedSet(key, value, operation) {
    try { await secureStorage.set(key, value); }
    catch (error) { throw new CustodialSecureStorageError(operation, error); }
  }

  async function protectedRemove(key, operation) {
    try { await secureStorage.remove(key); }
    catch (error) { throw new CustodialSecureStorageError(operation, error); }
  }

  async function protectedSnapshot() {
    return {
      [CUSTODIAL_INSTALLATION_RECORD_KEY]: await protectedGet(CUSTODIAL_INSTALLATION_RECORD_KEY, 'installation record read'),
      [CUSTODIAL_CREDENTIAL_KEY]: await protectedGet(CUSTODIAL_CREDENTIAL_KEY, 'legacy credential read'),
      [CUSTODIAL_INSTALLATION_SEAL_KEY]: await protectedGet(CUSTODIAL_INSTALLATION_SEAL_KEY, 'legacy installation binding read'),
    };
  }

  function publish(patch, { force = false } = {}) {
    const candidate = { ...status, ...patch };
    delete candidate.generation;
    const previous = { ...status };
    delete previous.generation;
    if (!force && JSON.stringify(candidate) === JSON.stringify(previous)) return;
    status = { ...candidate, generation: status.generation + 1 };
    const snapshot = getStatus();
    for (const listener of listeners) {
      try { listener(snapshot); } catch {}
    }
  }

  function getStatus() {
    return cloneJson(status);
  }

  function getGeneration() {
    return status.generation;
  }

  function getQuarantine() {
    return cloneJson(activeQuarantine);
  }

  function getRecoveryRecord() {
    return cloneJson(latestRecovery);
  }

  function getPendingEnrollmentOperation() {
    return cloneJson(pendingEnrollmentOperation);
  }

  function getRemovalRecord() {
    return cloneJson(pendingRemovalOperation);
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('A security-state listener function is required');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function exclusive(operation) {
    const result = operationTail.then(operation, operation);
    operationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  function stableStatusOrThrow({
    requireEnrollment = false,
    expectedGeneration = null,
    allowPendingEnrollmentConfirmation = false,
    expectedEnrollmentOperationId = null,
  } = {}) {
    if (
      status.initialized !== true
      || status.ready !== true
      || status.available !== true
      || status.quarantined === true
      || pendingRemovalOperation
    ) {
      throw new CustodialSecurityTransitionError(status);
    }
    if (expectedGeneration != null && Number(expectedGeneration) !== status.generation) {
      throw new CustodialSecurityTransitionError(status, 'custodial_security_generation_changed');
    }
    if (pendingEnrollmentOperation) {
      const confirmationAllowed = allowPendingEnrollmentConfirmation === true
        && pendingEnrollmentOperation.status === 'local_committed_pending_server_confirmation'
        && normalized(expectedEnrollmentOperationId) === pendingEnrollmentOperation.operation_id;
      if (!confirmationAllowed) {
        throw new CustodialSecurityTransitionError(status, 'custodial_enrollment_confirmation_pending');
      }
    }
    if (requireEnrollment && (status.state !== 'enrolled' || !activeCredential || !canonicalDeviceId(status.deviceId))) {
      throw new CustodialSecurityTransitionError(status, 'custodial_device_not_enrolled');
    }
    return getStatus();
  }

  async function initializeIfNeeded() {
    if (status.initialized === true) return;
    await ensureInternal();
  }

  function waitForStableState(options = {}) {
    return exclusive(async () => {
      await initializeIfNeeded();
      return stableStatusOrThrow(options);
    });
  }

  function runWhenReady(operation, options = {}) {
    if (typeof operation !== 'function') throw new TypeError('A protected-work mutation function is required');
    return exclusive(async () => {
      await initializeIfNeeded();
      const snapshot = stableStatusOrThrow(options);
      return operation(Object.freeze({
        deviceId: snapshot.deviceId,
        generation: snapshot.generation,
        state: snapshot.state,
      }));
    });
  }

  // Only the native transport bridge receives this capability. The credential
  // stays inside the exclusive callback and is never returned through the
  // public MemphisCustodialSecurity or MemphisMobile objects. The request is
  // synchronously dispatched under the FIFO, closing the local check/use gap;
  // the response remains outside it so long polls cannot block security state
  // transitions.
  function dispatchAuthorizedTransport(operation, options = {}) {
    if (typeof operation !== 'function') throw new TypeError('An authorized transport function is required');
    return exclusive(async () => {
      await initializeIfNeeded();
      const snapshot = stableStatusOrThrow({ ...options, requireEnrollment: true });
      const completion = operation(Object.freeze({
        credential: activeCredential,
        deviceId: snapshot.deviceId,
        generation: snapshot.generation,
      }));
      // Do not return the transport promise directly: Promise resolution would
      // assimilate it and hold the security FIFO for an entire long poll. The
      // request is dispatched synchronously under the lock; its completion is
      // awaited by the bridge after recovery/removal are free to proceed.
      return Object.freeze({ completion: Promise.resolve(completion), generation: snapshot.generation });
    });
  }

  function addIdentityCandidate(identityMap, rawValue, source) {
    const raw = normalized(rawValue);
    if (!raw) return;
    const canonical = canonicalDeviceId(raw);
    const mapKey = canonical || raw.toUpperCase();
    const current = identityMap.get(mapKey) || {
      device_id: canonical || raw,
      canonical_device_id: canonical || null,
      original_values: [],
      original_value_count: 0,
      sources: [],
      source_count: 0,
    };
    if (!current.original_values.includes(raw)) {
      current.original_value_count += 1;
      if (current.original_values.length < 16) current.original_values.push(raw);
    }
    if (!current.sources.includes(source)) {
      current.source_count += 1;
      if (current.sources.length < 32) current.sources.push(source);
    }
    identityMap.set(mapKey, current);
  }

  function collectObjectIdentities(value, source, identityMap, seen = new WeakSet(), depth = 0) {
    if (!value || typeof value !== 'object' || depth > 8 || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => collectObjectIdentities(item, `${source}[${index}]`, identityMap, seen, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (IDENTITY_FIELDS.has(key)) addIdentityCandidate(identityMap, child, `${source}.${key}`);
      if (child && typeof child === 'object') collectObjectIdentities(child, `${source}.${key}`, identityMap, seen, depth + 1);
    }
  }

  async function inspectPreservedState() {
    const keys = localKeys();
    const identityMap = new Map();
    const originalDeviceKeys = {};
    const counts = {
      sessions: 0,
      messenger_outbox: 0,
      chatscope_outbox: 0,
      messenger_drafts: 0,
      scan_completion_drafts: 0,
      work_position_evidence: 0,
      scan_resume_records: 0,
      scan_queue: 0,
      total_pending: 0,
    };

    for (const key of CUSTODIAL_DEVICE_KEYS) {
      const value = localGet(key);
      if (!value) continue;
      originalDeviceKeys[key] = value;
      addIdentityCandidate(identityMap, value, `localStorage:${key}`);
    }

    for (const key of keys) {
      let kind = '';
      if (key.startsWith(SESSION_PREFIX)) kind = 'sessions';
      else if (key.startsWith(MESSENGER_OUTBOX_PREFIX)) kind = 'messenger_outbox';
      else if (key.startsWith(CHATSCOPE_OUTBOX_PREFIX)) kind = 'chatscope_outbox';
      else if (key.startsWith(MESSENGER_DRAFT_PREFIX)) kind = 'messenger_drafts';
      else if (key.startsWith(SCAN_COMPLETION_DRAFT_PREFIX)) kind = 'scan_completion_drafts';
      else if (key.startsWith(WORK_POSITION_EVIDENCE_PREFIX)) kind = 'work_position_evidence';
      else if (key.startsWith(PHONE_SCAN_RESUME_PREFIX)) kind = 'scan_resume_records';
      if (!kind) continue;
      counts[kind] += 1;
      const value = localGet(key);
      const parsed = jsonObject(value);
      if (parsed) collectObjectIdentities(parsed, `localStorage:${key}`, identityMap);
    }

    const queue = await inspectIndexedDbQueue(indexedDb);
    counts.scan_queue = queue.records.length;
    queue.records.forEach((record, index) => {
      const id = normalized(String(record?.id ?? '')) || String(index);
      collectObjectIdentities(record, `indexedDB:${SCAN_QUEUE_DATABASE}/${SCAN_QUEUE_STORE}:${id}`, identityMap);
    });
    counts.total_pending = counts.sessions
      + counts.messenger_outbox
      + counts.chatscope_outbox
      + counts.messenger_drafts
      + counts.scan_completion_drafts
      + counts.work_position_evidence
      + counts.scan_resume_records
      + counts.scan_queue;

    const originalIdentities = Array.from(identityMap.values())
      .map((item) => ({
        ...item,
        original_values: [...item.original_values].sort(),
        original_values_truncated: item.original_value_count > item.original_values.length,
        sources: [...item.sources].sort(),
        sources_truncated: item.source_count > item.sources.length,
      }))
      .sort((left, right) => left.device_id.localeCompare(right.device_id));
    const canonicalIdentities = originalIdentities.map((item) => item.canonical_device_id).filter(Boolean);
    const invalidIdentities = originalIdentities.filter((item) => !item.canonical_device_id).map((item) => item.device_id);
    const marker = localGet(CUSTODIAL_INSTALLATION_MARKER_KEY);
    const quarantineRaw = localGet(CUSTODIAL_RESTORE_QUARANTINE_KEY);
    const recoveryRaw = localGet(CUSTODIAL_RECOVERY_RECORD_KEY);
    const enrollmentOperationRaw = localGet(CUSTODIAL_ENROLLMENT_OPERATION_KEY);
    const removalOperationRaw = localGet(CUSTODIAL_REMOVAL_OPERATION_KEY);

    return {
      counts,
      scanQueueAvailable: queue.available,
      scanQueueDatabaseExists: queue.databaseExists,
      originalDeviceKeys,
      originalIdentities,
      canonicalIdentities: [...new Set(canonicalIdentities)].sort(),
      invalidIdentities: [...new Set(invalidIdentities)].sort(),
      marker,
      quarantineRaw,
      quarantine: quarantineRecord(quarantineRaw),
      recoveryRaw,
      recovery: recoveryRecord(recoveryRaw),
      enrollmentOperationRaw,
      enrollmentOperation: enrollmentOperationRecord(enrollmentOperationRaw),
      removalOperationRaw,
      removalOperation: removalOperationRecord(removalOperationRaw),
    };
  }

  function recoverySummary(record, currentCounts = null) {
    if (!record) return null;
    return {
      recovery_id: record.recovery_id,
      status: record.status,
      reason: record.reason,
      created_at: record.created_at,
      original_device_keys: cloneJson(record.original_device_keys || {}),
      original_identities: cloneJson(record.original_identities || []),
      preserved_counts: cloneJson(record.preserved_counts || {}),
      current_preserved_counts: cloneJson(currentCounts),
    };
  }

  function newRecovery(reason, inspection, details = {}) {
    const history = Array.isArray(inspection.recovery?.history)
      ? inspection.recovery.history.slice(-7).map(cloneJson)
      : [];
    if (inspection.recovery) {
      history.push({
        recovery_id: inspection.recovery.recovery_id,
        status: inspection.recovery.status,
        reason: inspection.recovery.reason,
        created_at: inspection.recovery.created_at,
        resolved_at: inspection.recovery.resolved_at || null,
        resolved_device_id: inspection.recovery.resolved_device_id || null,
        original_device_keys: cloneJson(inspection.recovery.original_device_keys || {}),
        original_identities: cloneJson(inspection.recovery.original_identities || []),
        preserved_counts: cloneJson(inspection.recovery.preserved_counts || {}),
        resolution: cloneJson(inspection.recovery.resolution || null),
      });
    }
    return {
      schema_version: RECOVERY_SCHEMA_VERSION,
      recovery_id: randomSeal(cryptoApi),
      status: 'pending_manager_recovery',
      reason,
      created_at: isoTimestamp(now),
      original_device_keys: cloneJson(inspection.originalDeviceKeys),
      original_identities: cloneJson(inspection.originalIdentities),
      preserved_counts: cloneJson(inspection.counts),
      details: cloneJson(details),
      history,
    };
  }

  function activeRecordFromRecovery(record) {
    return {
      schema_version: RECOVERY_SCHEMA_VERSION,
      recovery_id: record.recovery_id,
      active: true,
      reason: record.reason,
      created_at: record.created_at,
      original_device_keys: cloneJson(record.original_device_keys || {}),
      original_identities: cloneJson(record.original_identities || []),
      preserved_counts: cloneJson(record.preserved_counts || {}),
    };
  }

  function throwActiveQuarantine(inspection, active = activeQuarantine, recovery = latestRecovery) {
    activeQuarantine = active;
    latestRecovery = recovery;
    activeCredential = '';
    const summary = recoverySummary(recovery || active, inspection.counts);
    publish({
      state: 'quarantined',
      initialized: true,
      ready: false,
      checked: true,
      available: true,
      quarantined: true,
      reason: active.reason,
      deviceId: '',
      preservedCounts: cloneJson(inspection.counts),
      recovery: summary,
      enrollmentOperation: cloneJson(pendingEnrollmentOperation),
      removalOperation: cloneJson(pendingRemovalOperation),
    });
    throw new CustodialCredentialQuarantineError(active.reason, summary);
  }

  function activateQuarantine(reason, inspection, details = {}) {
    let recovery = inspection.recovery?.status === 'pending_manager_recovery'
      ? inspection.recovery
      : newRecovery(reason, inspection, details);
    if (recovery.reason !== reason) {
      recovery = newRecovery(reason, inspection, details);
    }
    const active = activeRecordFromRecovery(recovery);
    localSet(CUSTODIAL_RECOVERY_RECORD_KEY, JSON.stringify(recovery), 'recovery record write');
    try {
      localSet(CUSTODIAL_RESTORE_QUARANTINE_KEY, JSON.stringify(active), 'active quarantine write');
    } catch (error) {
      latestRecovery = recovery;
      activeQuarantine = active;
      publish({
        state: 'quarantined',
        initialized: true,
        ready: false,
        checked: true,
        available: false,
        quarantined: true,
        reason,
        deviceId: '',
        preservedCounts: cloneJson(inspection.counts),
        recovery: recoverySummary(recovery, inspection.counts),
      }, { force: true });
      throw error;
    }
    throwActiveQuarantine(inspection, active, recovery);
  }

  function localSnapshot(keys) {
    try {
      return Object.fromEntries(keys.map((key) => {
        const value = storage.getItem(key);
        return [key, { present: value !== null, value: typeof value === 'string' ? value : '' }];
      }));
    } catch (error) {
      throw new CustodialStateInspectionError('local rollback snapshot', error);
    }
  }

  function restoreLocalSnapshot(snapshot) {
    const failures = [];
    for (const [key, entry] of Object.entries(snapshot)) {
      try {
        if (entry.present) storage.setItem(key, entry.value);
        else storage.removeItem(key);
      } catch (error) {
        failures.push(error);
      }
    }
    return failures;
  }

  async function restoreProtectedSnapshot(snapshot) {
    const failures = [];
    for (const key of [CUSTODIAL_INSTALLATION_RECORD_KEY, CUSTODIAL_CREDENTIAL_KEY, CUSTODIAL_INSTALLATION_SEAL_KEY]) {
      try {
        if (snapshot[key]) await secureStorage.set(key, snapshot[key]);
        else await secureStorage.remove(key);
      } catch (error) {
        failures.push(error);
      }
    }
    return failures;
  }

  async function commitEnrollment({
    credential,
    deviceId,
    seal,
    protectedBefore,
    inspection,
    migrated = false,
    resolvedRecovery = null,
    enrollmentOperation = null,
  }) {
    const localKeysToRestore = [
      ...CUSTODIAL_DEVICE_KEYS,
      CUSTODIAL_INSTALLATION_MARKER_KEY,
      CUSTODIAL_RESTORE_QUARANTINE_KEY,
      ...(resolvedRecovery ? [CUSTODIAL_RECOVERY_RECORD_KEY] : []),
      ...(enrollmentOperation ? [CUSTODIAL_ENROLLMENT_OPERATION_KEY] : []),
    ];
    const localBefore = localSnapshot(localKeysToRestore);
    const record = {
      schema_version: INSTALLATION_SCHEMA_VERSION,
      credential,
      device_id: deviceId,
      installation_seal: seal,
      enrolled_at: isoTimestamp(now),
      migrated_from_credential_only_state: migrated === true,
    };

    try {
      await protectedSet(CUSTODIAL_INSTALLATION_RECORD_KEY, JSON.stringify(record), 'installation record write');
      for (const key of CUSTODIAL_DEVICE_KEYS) localSet(key, deviceId, 'device identity binding');
      localSet(CUSTODIAL_INSTALLATION_MARKER_KEY, seal, 'installation marker write');
      if (resolvedRecovery) {
        localSet(CUSTODIAL_RECOVERY_RECORD_KEY, JSON.stringify(resolvedRecovery), 'recovery resolution write');
      }
      if (enrollmentOperation) {
        localSet(CUSTODIAL_ENROLLMENT_OPERATION_KEY, JSON.stringify(enrollmentOperation), 'enrollment operation checkpoint');
      }
      localRemove(CUSTODIAL_RESTORE_QUARANTINE_KEY, 'active quarantine resolution');
      localRemove(CUSTODIAL_CREDENTIAL_KEY, 'plaintext credential purge');
      await protectedRemove(CUSTODIAL_CREDENTIAL_KEY, 'legacy credential cleanup');
      await protectedRemove(CUSTODIAL_INSTALLATION_SEAL_KEY, 'legacy installation binding cleanup');
    } catch (error) {
      const localFailures = restoreLocalSnapshot(localBefore);
      const protectedFailures = await restoreProtectedSnapshot(protectedBefore);
      if (localFailures.length || protectedFailures.length) {
        activateQuarantine('enrollment_commit_rollback_failed', inspection, {
          local_rollback_failures: localFailures.length,
          protected_rollback_failures: protectedFailures.length,
        });
      }
      if (error instanceof CustodialSecureStorageError || error instanceof CustodialStateInspectionError) throw error;
      throw new CustodialStateInspectionError('enrollment commit', error);
    }
    return record;
  }

  function publishUnavailable(error, inspection = null) {
    activeCredential = '';
    publish({
      state: status.quarantined ? 'quarantined' : 'unavailable',
      initialized: true,
      ready: false,
      checked: true,
      available: false,
      quarantined: status.quarantined,
      reason: status.quarantined
        ? status.reason
        : (normalized(error?.reason || error?.code) || 'custodial_security_state_unavailable'),
      deviceId: status.quarantined ? '' : status.deviceId,
      preservedCounts: cloneJson(inspection?.counts || status.preservedCounts),
      recovery: cloneJson(status.recovery),
      enrollmentOperation: cloneJson(pendingEnrollmentOperation),
      removalOperation: cloneJson(pendingRemovalOperation),
    }, { force: true });
  }

  async function ensureInternal({ holdReady = false } = {}) {
    let inspection;
    try {
      publish({
        state: status.quarantined ? 'quarantined' : 'checking',
        ready: false,
        reason: status.quarantined ? status.reason : 'custodial_security_state_checking',
      }, { force: true });
      // Offline state is inspected first. No credential is read until the real
      // queue, sessions, outboxes, and all three device identity keys are known.
      inspection = await inspectPreservedState();
      activeQuarantine = inspection.quarantine;
      latestRecovery = inspection.recovery;
      pendingEnrollmentOperation = inspection.enrollmentOperation;
      pendingRemovalOperation = inspection.removalOperation;

      if (inspection.enrollmentOperationRaw && !pendingEnrollmentOperation) {
        activateQuarantine('invalid_enrollment_operation_record', inspection);
      }
      if (inspection.removalOperationRaw && !pendingRemovalOperation) {
        activateQuarantine('invalid_removal_operation_record', inspection);
      }

      if (inspection.quarantineRaw && !inspection.quarantine) {
        if (latestRecovery?.status === 'pending_manager_recovery') {
          const reconstructed = activeRecordFromRecovery(latestRecovery);
          localSet(CUSTODIAL_RESTORE_QUARANTINE_KEY, JSON.stringify(reconstructed), 'invalid quarantine reconstruction');
          activeQuarantine = reconstructed;
        } else {
          activateQuarantine('invalid_active_quarantine_record', inspection);
        }
      }
      if (activeQuarantine && (
        !latestRecovery
        || latestRecovery.status !== 'pending_manager_recovery'
        || latestRecovery.recovery_id !== activeQuarantine.recovery_id
      )) {
        latestRecovery = {
          schema_version: RECOVERY_SCHEMA_VERSION,
          recovery_id: activeQuarantine.recovery_id,
          status: 'pending_manager_recovery',
          reason: activeQuarantine.reason,
          created_at: activeQuarantine.created_at || isoTimestamp(now),
          original_device_keys: cloneJson(activeQuarantine.original_device_keys || inspection.originalDeviceKeys),
          original_identities: cloneJson(activeQuarantine.original_identities || inspection.originalIdentities),
          preserved_counts: cloneJson(activeQuarantine.preserved_counts || inspection.counts),
          details: { reconstructed_from_active_quarantine: true },
        };
        localSet(CUSTODIAL_RECOVERY_RECORD_KEY, JSON.stringify(latestRecovery), 'recovery record reconstruction');
      }
      if (!activeQuarantine && latestRecovery?.status === 'pending_manager_recovery') {
        const reconstructed = activeRecordFromRecovery(latestRecovery);
        localSet(CUSTODIAL_RESTORE_QUARANTINE_KEY, JSON.stringify(reconstructed), 'active quarantine reconstruction');
        activeQuarantine = reconstructed;
      }
      if (activeQuarantine) throwActiveQuarantine(inspection);

      if (pendingRemovalOperation) {
        activeCredential = '';
        publish({
          state: 'removing',
          initialized: true,
          ready: false,
          checked: true,
          available: true,
          quarantined: false,
          reason: 'custodial_enrollment_removal_pending',
          deviceId: pendingRemovalOperation.device_id,
          preservedCounts: cloneJson(inspection.counts),
          recovery: recoverySummary(latestRecovery?.status === 'resolved' ? latestRecovery : null, inspection.counts),
          enrollmentOperation: cloneJson(pendingEnrollmentOperation),
          removalOperation: cloneJson(pendingRemovalOperation),
        }, { force: true });
        throw new CustodialEnrollmentRemovalPendingError(pendingRemovalOperation);
      }

      localRemove(CUSTODIAL_CREDENTIAL_KEY, 'plaintext credential purge');
      const protectedBefore = await protectedSnapshot();
      const rawRecord = protectedBefore[CUSTODIAL_INSTALLATION_RECORD_KEY];
      const record = installationRecord(rawRecord);
      if (rawRecord && !record) activateQuarantine('invalid_protected_installation_record', inspection);

      if (record) {
        const directKeysMatch = CUSTODIAL_DEVICE_KEYS.every((key) => canonicalDeviceId(inspection.originalDeviceKeys[key]) === record.device_id);
        const oneIdentity = inspection.canonicalIdentities.length === 1 && inspection.canonicalIdentities[0] === record.device_id;
        if (inspection.marker !== record.installation_seal) activateQuarantine('installation_binding_mismatch', inspection);
        if (!directKeysMatch) activateQuarantine('device_identity_binding_incomplete', inspection, { protected_device_id: record.device_id });
        if (inspection.invalidIdentities.length || !oneIdentity) {
          activateQuarantine('preserved_identity_mismatch', inspection, { protected_device_id: record.device_id });
        }
        const resolvedRecovery = latestRecovery?.status === 'resolved' ? latestRecovery : null;
        activeCredential = record.credential;
        publish({
          state: 'enrolled',
          initialized: true,
          ready: !holdReady,
          checked: true,
          available: true,
          quarantined: false,
          reason: '',
          deviceId: record.device_id,
          preservedCounts: cloneJson(inspection.counts),
          recovery: recoverySummary(resolvedRecovery, inspection.counts),
          enrollmentOperation: cloneJson(pendingEnrollmentOperation),
          removalOperation: null,
        });
        return { credential: record.credential, record, protectedBefore, inspection };
      }

      const legacyCredential = protectedBefore[CUSTODIAL_CREDENTIAL_KEY];
      const legacySeal = protectedBefore[CUSTODIAL_INSTALLATION_SEAL_KEY];
      if (legacyCredential) {
        if (inspection.invalidIdentities.length || inspection.canonicalIdentities.length !== 1) {
          activateQuarantine('legacy_credential_identity_ambiguous', inspection);
        }
        if (Boolean(legacySeal) !== Boolean(inspection.marker) || (legacySeal && legacySeal !== inspection.marker)) {
          activateQuarantine('legacy_installation_binding_mismatch', inspection);
        }
        const deviceId = inspection.canonicalIdentities[0];
        const seal = legacySeal || randomSeal(cryptoApi);
        const migratedRecord = await commitEnrollment({
          credential: legacyCredential,
          deviceId,
          seal,
          protectedBefore,
          inspection,
          migrated: true,
        });
        activeCredential = migratedRecord.credential;
        publish({
          state: 'enrolled',
          initialized: true,
          ready: !holdReady,
          checked: true,
          available: true,
          quarantined: false,
          reason: '',
          deviceId,
          preservedCounts: cloneJson(inspection.counts),
          recovery: recoverySummary(latestRecovery?.status === 'resolved' ? latestRecovery : null, inspection.counts),
          enrollmentOperation: cloneJson(pendingEnrollmentOperation),
          removalOperation: null,
        }, { force: true });
        return { credential: migratedRecord.credential, record: migratedRecord, protectedBefore: {
          ...protectedBefore,
          [CUSTODIAL_INSTALLATION_RECORD_KEY]: JSON.stringify(migratedRecord),
          [CUSTODIAL_CREDENTIAL_KEY]: '',
          [CUSTODIAL_INSTALLATION_SEAL_KEY]: '',
        }, inspection };
      }

      const hasUnboundState = Boolean(
        protectedBefore[CUSTODIAL_INSTALLATION_SEAL_KEY]
        || inspection.marker
        || inspection.originalIdentities.length
        || inspection.counts.total_pending,
      );
      if (hasUnboundState) activateQuarantine('preserved_state_without_protected_enrollment', inspection);

      publish({
        state: 'unenrolled',
        initialized: true,
        ready: !holdReady,
        checked: true,
        available: true,
        quarantined: false,
        reason: '',
        deviceId: '',
        preservedCounts: cloneJson(inspection.counts),
        recovery: recoverySummary(latestRecovery?.status === 'resolved' ? latestRecovery : null, inspection.counts),
        enrollmentOperation: cloneJson(pendingEnrollmentOperation),
        removalOperation: null,
      });
      activeCredential = '';
      return { credential: '', record: null, protectedBefore, inspection };
    } catch (error) {
      if (!(error instanceof CustodialCredentialQuarantineError)) {
        if (error instanceof CustodialSecureStorageError || error instanceof CustodialStateInspectionError) publishUnavailable(error, inspection);
      }
      throw error;
    }
  }

  function ensureSecurityState() {
    return exclusive(async () => {
      await ensureInternal();
      return getStatus();
    });
  }

  function readCredential() {
    return exclusive(async () => {
      if (status.initialized !== true) await ensureInternal();
      stableStatusOrThrow();
      return status.state === 'enrolled' ? activeCredential : '';
    });
  }

  function requireManagerRecovery(reason = 'server_credential_rejected') {
    return exclusive(async () => {
      const requestedReason = normalized(reason) || 'server_credential_rejected';
      if (!/^[a-z][a-z0-9_:-]{0,79}$/.test(requestedReason)) {
        throw new TypeError('A short machine-readable manager recovery reason is required');
      }
      let inspection = null;
      try {
        publish({
          state: status.quarantined ? 'quarantined' : 'checking',
          ready: false,
          reason: status.quarantined ? status.reason : 'custodial_security_state_checking',
        }, { force: true });
        inspection = await inspectPreservedState();
        activeQuarantine = inspection.quarantine;
        latestRecovery = inspection.recovery;

        if (activeQuarantine) {
          if (
            !latestRecovery
            || latestRecovery.status !== 'pending_manager_recovery'
            || latestRecovery.recovery_id !== activeQuarantine.recovery_id
          ) {
            latestRecovery = {
              schema_version: RECOVERY_SCHEMA_VERSION,
              recovery_id: activeQuarantine.recovery_id,
              status: 'pending_manager_recovery',
              reason: activeQuarantine.reason,
              created_at: activeQuarantine.created_at || isoTimestamp(now),
              original_device_keys: cloneJson(activeQuarantine.original_device_keys || inspection.originalDeviceKeys),
              original_identities: cloneJson(activeQuarantine.original_identities || inspection.originalIdentities),
              preserved_counts: cloneJson(activeQuarantine.preserved_counts || inspection.counts),
              details: { reconstructed_from_active_quarantine: true },
            };
            localSet(CUSTODIAL_RECOVERY_RECORD_KEY, JSON.stringify(latestRecovery), 'recovery record reconstruction');
          }
          throwActiveQuarantine(inspection);
        }
        if (latestRecovery?.status === 'pending_manager_recovery') {
          const reconstructed = activeRecordFromRecovery(latestRecovery);
          localSet(CUSTODIAL_RESTORE_QUARANTINE_KEY, JSON.stringify(reconstructed), 'active quarantine reconstruction');
          throwActiveQuarantine(inspection, reconstructed, latestRecovery);
        }
        activateQuarantine(requestedReason, inspection, { requested_by: 'protected_enrollment_runtime' });
      } catch (error) {
        if (error instanceof CustodialSecureStorageError || error instanceof CustodialStateInspectionError) {
          publishUnavailable(error, inspection);
        }
        throw error;
      }
    });
  }

  function setEnrollment(input) {
    return exclusive(async () => {
      const credential = normalized(input?.credential);
      const deviceId = canonicalDeviceId(input?.deviceId);
      if (!credential) throw new TypeError('A non-empty custodial device credential is required');
      if (!deviceId) throw new TypeError('A canonical custodial device ID from KIOSK_02 through KIOSK_10 is required');
      let current;
      try {
        current = await ensureInternal({ holdReady: true });
        if (current.record && current.record.device_id !== deviceId) {
          throw new CustodialRecoveryError('selected_identity_does_not_match_enrollment');
        }
        const seal = randomSeal(cryptoApi);
        const record = await commitEnrollment({
          credential,
          deviceId,
          seal,
          protectedBefore: current.protectedBefore,
          inspection: current.inspection,
        });
        activeQuarantine = null;
        activeCredential = record.credential;
        publish({
          state: 'enrolled',
          initialized: true,
          ready: true,
          checked: true,
          available: true,
          quarantined: false,
          reason: '',
          deviceId,
          preservedCounts: cloneJson(current.inspection.counts),
          recovery: recoverySummary(latestRecovery?.status === 'resolved' ? latestRecovery : null, current.inspection.counts),
        }, { force: true });
        return { deviceId: record.device_id, generation: status.generation };
      } catch (error) {
        if (error instanceof CustodialSecureStorageError || error instanceof CustodialStateInspectionError) {
          publishUnavailable(error, current?.inspection);
        } else if (current && error instanceof CustodialRecoveryError) {
          publish({
            state: current.record ? 'enrolled' : 'unenrolled',
            initialized: true,
            ready: true,
            checked: true,
            available: true,
            quarantined: false,
            reason: '',
            deviceId: current.record?.device_id || '',
            preservedCounts: cloneJson(current.inspection.counts),
          }, { force: true });
        }
        throw error;
      }
    });
  }

  function proveRecoveryIdentity(inspection, selected) {
    const active = inspection.quarantine;
    const recovery = inspection.recovery;
    if (!active || !recovery || recovery.status !== 'pending_manager_recovery' || active.recovery_id !== recovery.recovery_id) {
      throw new CustodialRecoveryError('active_quarantine_required');
    }
    activeQuarantine = active;
    latestRecovery = recovery;

    const identityMap = new Map();
    const addRecoveryIdentities = (records, source) => {
      for (const item of Array.isArray(records) ? records : []) {
        const originals = Array.isArray(item?.original_values) && item.original_values.length
          ? item.original_values
          : [item?.device_id];
        for (const value of originals) addIdentityCandidate(identityMap, value, source);
      }
    };
    addRecoveryIdentities(recovery.original_identities, 'recovery:original');
    addRecoveryIdentities(inspection.originalIdentities, 'recovery:current');
    const identities = Array.from(identityMap.values());
    const canonical = [...new Set(identities.map((item) => item.canonical_device_id).filter(Boolean))];
    const invalid = identities.filter((item) => !item.canonical_device_id);
    if (invalid.length || canonical.length !== 1) {
      throw new CustodialRecoveryError(canonical.length ? 'ambiguous_preserved_identity' : 'missing_preserved_identity');
    }
    if (canonical[0] !== selected) throw new CustodialRecoveryError('selected_identity_mismatch');
    return recovery;
  }

  function prepareEnrollmentOperation(input) {
    return exclusive(async () => {
      const selected = canonicalDeviceId(input?.deviceId);
      const flow = normalized(input?.flow) || 'enrollment';
      if (!selected) throw new CustodialRecoveryError('invalid_selected_identity');
      if (!['enrollment', 'recovery'].includes(flow)) throw new TypeError('Enrollment flow must be enrollment or recovery');

      let inspection;
      try {
        inspection = await inspectPreservedState();
        pendingEnrollmentOperation = inspection.enrollmentOperation;
        if (inspection.enrollmentOperationRaw && !pendingEnrollmentOperation) {
          activateQuarantine('invalid_enrollment_operation_record', inspection);
        }
        if (pendingEnrollmentOperation) {
          const sameRecovery = flow !== 'recovery'
            || pendingEnrollmentOperation.recovery_id === inspection.recovery?.recovery_id;
          if (
            pendingEnrollmentOperation.device_id !== selected
            || pendingEnrollmentOperation.flow !== flow
            || !sameRecovery
          ) {
            throw new CustodialEnrollmentOperationError('enrollment_operation_conflict');
          }
          return cloneJson(pendingEnrollmentOperation);
        }

        let recovery = null;
        if (flow === 'recovery') {
          recovery = proveRecoveryIdentity(inspection, selected);
        } else {
          const current = await ensureInternal({ holdReady: true });
          inspection = current.inspection;
          if (current.record) throw new CustodialEnrollmentOperationError('phone_already_enrolled');
        }

        const operation = {
          schema_version: ENROLLMENT_OPERATION_SCHEMA_VERSION,
          operation_id: randomOperationId(cryptoApi),
          flow,
          device_id: selected,
          recovery_id: recovery?.recovery_id || null,
          status: 'pending_server',
          created_at: isoTimestamp(now),
          server_result_received_at: null,
          local_committed_at: null,
          resume_expires_at: null,
          credential_id: null,
        };
        localSet(CUSTODIAL_ENROLLMENT_OPERATION_KEY, JSON.stringify(operation), 'enrollment operation journal creation');
        pendingEnrollmentOperation = operation;
        if (flow === 'enrollment') {
          publish({
            state: 'unenrolled',
            initialized: true,
            ready: true,
            checked: true,
            available: true,
            quarantined: false,
            reason: '',
            deviceId: '',
            preservedCounts: cloneJson(inspection.counts),
            enrollmentOperation: cloneJson(operation),
          }, { force: true });
        } else {
          publish({ enrollmentOperation: cloneJson(operation) }, { force: true });
        }
        return cloneJson(operation);
      } catch (error) {
        if (error instanceof CustodialSecureStorageError || error instanceof CustodialStateInspectionError) {
          publishUnavailable(error, inspection);
        }
        throw error;
      }
    });
  }

  function commitEnrollmentOperation(input) {
    return exclusive(async () => {
      const operationId = normalized(input?.operationId);
      const credential = normalized(input?.credential);
      const selected = canonicalDeviceId(input?.deviceId);
      if (!operationId || !credential || !selected) throw new TypeError('Operation ID, protected credential, and canonical device ID are required');

      let inspection;
      try {
        inspection = await inspectPreservedState();
        const operation = inspection.enrollmentOperation;
        if (!operation || operation.operation_id !== operationId) {
          throw new CustodialEnrollmentOperationError('unknown_enrollment_operation');
        }
        if (operation.device_id !== selected) throw new CustodialEnrollmentOperationError('enrollment_operation_identity_mismatch');

        const existingProtected = await protectedSnapshot();
        const existingRecord = installationRecord(existingProtected[CUSTODIAL_INSTALLATION_RECORD_KEY]);
        if (operation.status === 'local_committed_pending_server_confirmation') {
          if (!existingRecord || existingRecord.device_id !== selected || existingRecord.credential !== credential) {
            activateQuarantine('enrollment_operation_local_commit_mismatch', inspection);
          }
          activeCredential = existingRecord.credential;
          pendingEnrollmentOperation = operation;
          publish({
            state: 'enrolled', initialized: true, ready: true, checked: true, available: true,
            quarantined: false, reason: '', deviceId: selected,
            preservedCounts: cloneJson(inspection.counts),
            enrollmentOperation: cloneJson(operation), removalOperation: null,
          }, { force: true });
          return { deviceId: selected, generation: status.generation, operationId, resumed: true };
        }

        let resolvedRecovery = null;
        if (operation.flow === 'recovery') {
          const recovery = proveRecoveryIdentity(inspection, selected);
          if (operation.recovery_id !== recovery.recovery_id) {
            throw new CustodialEnrollmentOperationError('enrollment_operation_recovery_mismatch');
          }
          resolvedRecovery = {
            ...recovery,
            status: 'resolved',
            resolved_at: isoTimestamp(now),
            resolved_device_id: selected,
            resolution: {
              method: 'resumable_manager_code',
              enrollment_operation_id: operationId,
              preserved_work_retained: true,
            },
          };
        } else {
          const resumesFailedLocalCommit = operation.status === 'pending_server'
            && inspection.quarantine?.reason === 'enrollment_commit_rollback_failed'
            && inspection.recovery?.status === 'pending_manager_recovery'
            && inspection.quarantine.recovery_id === inspection.recovery.recovery_id;
          if (existingRecord && (
            !resumesFailedLocalCommit
            || existingRecord.device_id !== selected
            || existingRecord.credential !== credential
          )) {
            throw new CustodialEnrollmentOperationError('phone_already_enrolled');
          }
          if ((inspection.quarantine || inspection.recovery?.status === 'pending_manager_recovery') && !resumesFailedLocalCommit) {
            throw new CustodialRecoveryError('manager_recovery_flow_required');
          }
          if (resumesFailedLocalCommit) {
            resolvedRecovery = {
              ...inspection.recovery,
              status: 'resolved',
              resolved_at: isoTimestamp(now),
              resolved_device_id: selected,
              resolution: {
                method: 'resumed_enrollment_after_local_commit_failure',
                enrollment_operation_id: operationId,
                preserved_work_retained: true,
              },
            };
          }
        }

        const committedOperation = {
          ...operation,
          status: 'local_committed_pending_server_confirmation',
          server_result_received_at: isoTimestamp(now),
          local_committed_at: isoTimestamp(now),
          resume_expires_at: normalized(input?.resumeExpiresAt) || null,
          credential_id: normalized(input?.credentialId) || null,
        };
        const record = await commitEnrollment({
          credential,
          deviceId: selected,
          seal: randomSeal(cryptoApi),
          protectedBefore: existingProtected,
          inspection,
          resolvedRecovery,
          enrollmentOperation: committedOperation,
        });
        latestRecovery = resolvedRecovery || latestRecovery;
        activeQuarantine = null;
        activeCredential = record.credential;
        pendingEnrollmentOperation = committedOperation;
        publish({
          state: 'enrolled', initialized: true, ready: true, checked: true, available: true,
          quarantined: false, reason: '', deviceId: selected,
          preservedCounts: cloneJson(inspection.counts),
          recovery: recoverySummary(latestRecovery?.status === 'resolved' ? latestRecovery : null, inspection.counts),
          enrollmentOperation: cloneJson(committedOperation), removalOperation: null,
        }, { force: true });
        return { deviceId: record.device_id, generation: status.generation, operationId, resumed: false };
      } catch (error) {
        if (error instanceof CustodialSecureStorageError || error instanceof CustodialStateInspectionError) {
          publishUnavailable(error, inspection);
        }
        throw error;
      }
    });
  }

  function confirmEnrollmentOperation(operationId) {
    return exclusive(async () => {
      const requested = normalized(operationId);
      const raw = localGet(CUSTODIAL_ENROLLMENT_OPERATION_KEY, 'enrollment confirmation journal read');
      const operation = enrollmentOperationRecord(raw);
      if (!operation || operation.operation_id !== requested) {
        throw new CustodialEnrollmentOperationError('unknown_enrollment_operation');
      }
      if (operation.status !== 'local_committed_pending_server_confirmation') {
        throw new CustodialEnrollmentOperationError('local_enrollment_not_committed');
      }
      stableStatusOrThrow({
        requireEnrollment: true,
        allowPendingEnrollmentConfirmation: true,
        expectedEnrollmentOperationId: requested,
      });
      localRemove(CUSTODIAL_ENROLLMENT_OPERATION_KEY, 'enrollment confirmation journal removal');
      pendingEnrollmentOperation = null;
      publish({ enrollmentOperation: null }, { force: true });
      return { confirmed: true, operationId: requested, generation: status.generation };
    });
  }

  function recoverEnrollment(input) {
    return exclusive(async () => {
      const selected = canonicalDeviceId(input?.deviceId);
      const managerCode = normalized(input?.managerCode);
      const verifier = typeof input?.verifyManagerCode === 'function' ? input.verifyManagerCode : defaultManagerVerifier;
      if (!selected) throw new CustodialRecoveryError('invalid_selected_identity');
      if (!managerCode || typeof verifier !== 'function') throw new CustodialRecoveryError('manager_verification_required');

      const inspection = await inspectPreservedState();
      const recovery = proveRecoveryIdentity(inspection, selected);

      let authorization;
      try {
        authorization = await verifier({
          managerCode,
          deviceId: selected,
          recovery: recoverySummary(recovery, inspection.counts),
        });
      } catch (error) {
        throw new CustodialRecoveryError('manager_verification_failed', error);
      }
      const authorized = authorization === true || authorization?.authorized === true;
      if (!authorized) throw new CustodialRecoveryError('manager_verification_denied');
      const credential = normalized(input?.credential || authorization?.credential || authorization?.device_credential);
      if (!credential) throw new CustodialRecoveryError('replacement_credential_required');

      let protectedBefore;
      try {
        protectedBefore = await protectedSnapshot();
        const resolved = {
          ...recovery,
          status: 'resolved',
          resolved_at: isoTimestamp(now),
          resolved_device_id: selected,
          resolution: { method: 'manager_code', preserved_work_retained: true },
        };
        const record = await commitEnrollment({
          credential,
          deviceId: selected,
          seal: randomSeal(cryptoApi),
          protectedBefore,
          inspection,
          resolvedRecovery: resolved,
        });
        latestRecovery = resolved;
        activeQuarantine = null;
        activeCredential = record.credential;
        publish({
          state: 'enrolled',
          initialized: true,
          ready: true,
          checked: true,
          available: true,
          quarantined: false,
          reason: '',
          deviceId: selected,
          preservedCounts: cloneJson(inspection.counts),
          recovery: recoverySummary(resolved, inspection.counts),
        }, { force: true });
        return { deviceId: record.device_id, generation: status.generation, recoveryId: resolved.recovery_id };
      } catch (error) {
        if (error instanceof CustodialSecureStorageError || error instanceof CustodialStateInspectionError) publishUnavailable(error, inspection);
        throw error;
      }
    });
  }

  async function removeInternal({ beforeRemove = null } = {}) {
    let inspection = null;
    let finalPatch = null;
    const statusBeforeRemoval = getStatus();
    try {
      publish({
        state: status.quarantined ? 'quarantined' : 'removing',
        ready: false,
        reason: status.quarantined ? status.reason : 'custodial_enrollment_removal_in_progress',
      }, { force: true });
      inspection = await inspectPreservedState();
      if (inspection.counts.total_pending > 0) {
        throw new CustodialPendingWorkError(inspection.counts);
      }
      const protectedBefore = await protectedSnapshot();
      const protectedRecord = installationRecord(protectedBefore[CUSTODIAL_INSTALLATION_RECORD_KEY]);
      pendingEnrollmentOperation = inspection.enrollmentOperation;
      if (pendingEnrollmentOperation) {
        throw new CustodialEnrollmentOperationError('enrollment_confirmation_required_before_removal');
      }

      if (protectedRecord) {
        if (typeof beforeRemove !== 'function') {
          throw new TypeError('Remote push unregistration and credential logout are required before local enrollment removal');
        }
        let removal = inspection.removalOperation;
        if (!removal) {
          removal = {
            schema_version: REMOVAL_OPERATION_SCHEMA_VERSION,
            operation_id: randomOperationId(cryptoApi),
            device_id: protectedRecord.device_id,
            phase: 'pending_push_unregister',
            created_at: isoTimestamp(now),
            updated_at: isoTimestamp(now),
          };
          localSet(CUSTODIAL_REMOVAL_OPERATION_KEY, JSON.stringify(removal), 'removal workflow journal creation');
        }
        if (removal.device_id !== protectedRecord.device_id) {
          activateQuarantine('removal_operation_identity_mismatch', inspection);
        }
        pendingRemovalOperation = removal;
        publish({
          state: 'removing', ready: false, available: true,
          reason: 'custodial_enrollment_removal_pending',
          deviceId: protectedRecord.device_id,
          removalOperation: cloneJson(removal),
        }, { force: true });

        const phases = ['pending_push_unregister', 'push_unregistered', 'server_logged_out'];
        const checkpoint = async (nextPhase) => {
          const currentIndex = phases.indexOf(removal.phase);
          const nextIndex = phases.indexOf(nextPhase);
          if (nextIndex < 0 || nextIndex > currentIndex + 1) {
            throw new TypeError('Removal workflow checkpoint is invalid');
          }
          if (nextIndex <= currentIndex) return cloneJson(removal);
          removal = { ...removal, phase: nextPhase, updated_at: isoTimestamp(now) };
          localSet(CUSTODIAL_REMOVAL_OPERATION_KEY, JSON.stringify(removal), 'removal workflow checkpoint');
          pendingRemovalOperation = removal;
          publish({ removalOperation: cloneJson(removal) }, { force: true });
          return cloneJson(removal);
        };
        await beforeRemove(Object.freeze({
          credential: protectedRecord.credential,
          deviceId: protectedRecord.device_id,
          operationId: removal.operation_id,
          phase: removal.phase,
          checkpoint,
        }));
        if (removal.phase !== 'server_logged_out') {
          throw new CustodialEnrollmentRemovalPendingError(removal);
        }
      }
      const pendingRecovery = inspection.recovery?.status === 'pending_manager_recovery'
        ? inspection.recovery
        : (!inspection.recovery && inspection.quarantine
          ? {
              ...inspection.quarantine,
              status: 'pending_manager_recovery',
              original_device_keys: cloneJson(inspection.quarantine.original_device_keys || inspection.originalDeviceKeys),
              original_identities: cloneJson(inspection.quarantine.original_identities || inspection.originalIdentities),
              preserved_counts: cloneJson(inspection.quarantine.preserved_counts || inspection.counts),
            }
          : null);
      const removalRecovery = pendingRecovery
        ? {
            ...pendingRecovery,
            status: 'resolved',
            resolved_at: isoTimestamp(now),
            resolved_device_id: inspection.canonicalIdentities.length === 1 ? inspection.canonicalIdentities[0] : null,
            resolution: {
              method: 'explicit_enrollment_removal',
              preserved_work_retained: true,
              preserved_work_count: 0,
            },
          }
        : inspection.recovery;
      const localBefore = localSnapshot([
        ...CUSTODIAL_DEVICE_KEYS,
        CUSTODIAL_INSTALLATION_MARKER_KEY,
        CUSTODIAL_RESTORE_QUARANTINE_KEY,
        CUSTODIAL_REMOVAL_OPERATION_KEY,
        ...(pendingRecovery ? [CUSTODIAL_RECOVERY_RECORD_KEY] : []),
      ]);
      try {
        await protectedRemove(CUSTODIAL_INSTALLATION_RECORD_KEY, 'installation record removal');
        await protectedRemove(CUSTODIAL_CREDENTIAL_KEY, 'legacy credential removal');
        await protectedRemove(CUSTODIAL_INSTALLATION_SEAL_KEY, 'legacy installation binding removal');
        for (const key of CUSTODIAL_DEVICE_KEYS) localRemove(key, 'device identity removal');
        localRemove(CUSTODIAL_INSTALLATION_MARKER_KEY, 'installation marker removal');
        if (pendingRecovery) {
          localSet(CUSTODIAL_RECOVERY_RECORD_KEY, JSON.stringify(removalRecovery), 'recovery removal resolution');
        }
        localRemove(CUSTODIAL_RESTORE_QUARANTINE_KEY, 'active quarantine removal');
        localRemove(CUSTODIAL_REMOVAL_OPERATION_KEY, 'removal workflow completion');
        localRemove(CUSTODIAL_CREDENTIAL_KEY, 'plaintext credential purge');
      } catch (error) {
        const localFailures = restoreLocalSnapshot(localBefore);
        const protectedFailures = await restoreProtectedSnapshot(protectedBefore);
        if (localFailures.length || protectedFailures.length) {
          activateQuarantine('enrollment_removal_rollback_failed', inspection, {
            local_rollback_failures: localFailures.length,
            protected_rollback_failures: protectedFailures.length,
          });
        }
        throw error;
      }
      activeQuarantine = null;
      activeCredential = '';
      pendingRemovalOperation = null;
      latestRecovery = removalRecovery;
      finalPatch = {
        state: 'unenrolled',
        initialized: true,
        ready: true,
        checked: true,
        available: true,
        quarantined: false,
        reason: '',
        deviceId: '',
        preservedCounts: cloneJson(inspection.counts),
        recovery: recoverySummary(latestRecovery, inspection.counts),
        enrollmentOperation: null,
        removalOperation: null,
      };
      return { removed: true };
    } catch (error) {
      if (error instanceof CustodialPendingWorkError) {
        finalPatch = {
          ...statusBeforeRemoval,
          initialized: true,
          ready: statusBeforeRemoval.ready,
          checked: true,
          preservedCounts: cloneJson(inspection?.counts),
        };
      } else if (error instanceof CustodialCredentialQuarantineError) {
        finalPatch = { ...status };
      } else if (pendingRemovalOperation) {
        activeCredential = '';
        finalPatch = {
          ...status,
          state: 'removing',
          initialized: true,
          ready: false,
          checked: true,
          available: true,
          quarantined: false,
          reason: 'custodial_enrollment_removal_pending',
          deviceId: pendingRemovalOperation.device_id,
          preservedCounts: cloneJson(inspection?.counts || status.preservedCounts),
          removalOperation: cloneJson(pendingRemovalOperation),
        };
      } else {
        finalPatch = {
          ...status,
          state: status.quarantined ? 'quarantined' : 'unavailable',
          initialized: true,
          ready: false,
          checked: true,
          available: false,
          reason: normalized(error?.reason || error?.code) || 'custodial_security_state_unavailable',
          preservedCounts: cloneJson(inspection?.counts || status.preservedCounts),
        };
      }
      throw error;
    } finally {
      publish(finalPatch || { ...status }, { force: true });
    }
  }

  function removeEnrollment(options = {}) {
    return exclusive(() => removeInternal(options));
  }

  // Removal keeps its historical name for the current native callers. Both names
  // enter the same exclusive queue and enforce the same pending-work refusal.
  const removeCredential = removeEnrollment;

  try {
    const rawQuarantine = normalized(storage.getItem(CUSTODIAL_RESTORE_QUARANTINE_KEY));
    const rawRecovery = normalized(storage.getItem(CUSTODIAL_RECOVERY_RECORD_KEY));
    const rawEnrollmentOperation = normalized(storage.getItem(CUSTODIAL_ENROLLMENT_OPERATION_KEY));
    const rawRemovalOperation = normalized(storage.getItem(CUSTODIAL_REMOVAL_OPERATION_KEY));
    activeQuarantine = quarantineRecord(rawQuarantine);
    latestRecovery = recoveryRecord(rawRecovery);
    pendingEnrollmentOperation = enrollmentOperationRecord(rawEnrollmentOperation);
    pendingRemovalOperation = removalOperationRecord(rawRemovalOperation);
    if (rawRemovalOperation) {
      status = {
        ...status,
        state: 'removing',
        reason: pendingRemovalOperation ? 'custodial_enrollment_removal_pending' : 'invalid_removal_operation_record',
        deviceId: pendingRemovalOperation?.device_id || '',
        removalOperation: cloneJson(pendingRemovalOperation),
      };
    } else if (rawQuarantine) {
      const reason = activeQuarantine?.reason || 'invalid_active_quarantine_record';
      status = {
        ...status,
        state: 'quarantined',
        quarantined: true,
        reason,
        recovery: recoverySummary(latestRecovery || activeQuarantine),
      };
    } else if (latestRecovery?.status === 'pending_manager_recovery') {
      status = {
        ...status,
        state: 'quarantined',
        quarantined: true,
        reason: latestRecovery.reason,
        recovery: recoverySummary(latestRecovery),
      };
    }
    status.enrollmentOperation = cloneJson(pendingEnrollmentOperation);
  } catch (error) {
    status = { ...status, state: 'unavailable', reason: 'custodial_security_state_unavailable' };
  }

  return Object.freeze({
    readCredential,
    setEnrollment,
    recoverEnrollment,
    prepareEnrollmentOperation,
    commitEnrollmentOperation,
    confirmEnrollmentOperation,
    removeEnrollment,
    removeCredential,
    requireManagerRecovery,
    ensureSecurityState,
    waitForStableState,
    runWhenReady,
    dispatchAuthorizedTransport,
    getStatus,
    getGeneration,
    getQuarantine,
    getRecoveryRecord,
    getPendingEnrollmentOperation,
    getRemovalRecord,
    subscribe,
    purgeLegacyPlaintextCredential,
  });
}

/**
 * @param {{
 *   secureStorage: SecureStorageLike,
 *   storage?: Storage,
 *   cryptoApi?: Crypto,
 *   indexedDb?: IDBFactory,
 *   now?: () => Date|string|number,
 *   verifyManagerCode?: (request: object) => Promise<boolean|object>|boolean|object,
 * }} options
 */
export function getCustodialCredentialStore({
  secureStorage,
  storage = globalThis.localStorage,
  cryptoApi = globalThis.crypto,
  indexedDb = globalThis.indexedDB,
  now = () => new Date(),
  verifyManagerCode = null,
}) {
  if (!globalThis[SHARED_STORE_KEY]) {
    Object.defineProperty(globalThis, SHARED_STORE_KEY, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: createCustodialCredentialStore({ secureStorage, storage, cryptoApi, indexedDb, now, verifyManagerCode }),
    });
  }
  return globalThis[SHARED_STORE_KEY];
}
