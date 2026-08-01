const FIREWALL_INSTALLATION = Symbol.for('org.memphiszoo.custodial.storage-firewall');

export const CUSTODIAL_PROTECTED_STORAGE_KEYS = Object.freeze([
  'memphisAssignedDeviceId',
  'mz_scan_device_id',
  'mz_employee_hub_device_id',
  'memphis_zoo_custodial_device_credential',
  'memphisZooCustodialInstallationSeal',
  'memphisZooCustodialRestoreQuarantine',
  'memphisZooCustodialRecoveryRecord',
  'memphisZooCustodialEnrollmentOperationV1',
  'memphisZooCustodialRemovalOperationV1',
  'mz_messenger_user_id',
]);

export const CUSTODIAL_PROTECTED_STORAGE_PREFIXES = Object.freeze([
  'session:',
  'mz_chatscope_outbox:',
  'mz_messenger_v2_outbox:',
  'mz_messenger_v2_draft:',
  'mz_scan_completion_draft:',
  'mz_work_position_evidence:',
  'mz_phone_scan_resume:',
]);

function storeOwnedKey(key) {
  return CUSTODIAL_PROTECTED_STORAGE_KEYS.includes(String(key || ''));
}

function protectedWorkKey(key) {
  const value = String(key || '');
  return CUSTODIAL_PROTECTED_STORAGE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function protectedKey(key) {
  return storeOwnedKey(key) || protectedWorkKey(key);
}

export class CustodialProtectedStateMutationError extends Error {
  constructor(key) {
    super(`Protected custodial phone state cannot change while security reconciliation is pending${key ? ` (${key})` : ''}.`);
    this.name = 'CustodialProtectedStateMutationError';
    this.code = 'custodial_protected_state_read_only';
    this.key = key || null;
  }
}

export function createRawStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    throw new TypeError('A Storage-compatible implementation is required');
  }
  const getItem = storage.getItem.bind(storage);
  const setItem = storage.setItem.bind(storage);
  const removeItem = storage.removeItem.bind(storage);
  const key = typeof storage.key === 'function' ? storage.key.bind(storage) : () => null;
  return Object.freeze({
    getItem,
    setItem,
    removeItem,
    key,
    get length() { return Number(storage.length || 0); },
  });
}

export function installCustodialStorageFirewall({ storage, getSecurityStatus }) {
  if (!storage || typeof getSecurityStatus !== 'function') {
    throw new TypeError('Custodial storage firewall requires storage and getSecurityStatus');
  }
  const prototype = Object.getPrototypeOf(storage);
  if (!prototype || typeof prototype.setItem !== 'function' || typeof prototype.removeItem !== 'function') {
    throw new TypeError('Custodial storage firewall requires a mutable Storage prototype');
  }
  if (prototype[FIREWALL_INSTALLATION]) return prototype[FIREWALL_INSTALLATION];

  const original = Object.freeze({
    setItem: prototype.setItem,
    removeItem: prototype.removeItem,
    clear: prototype.clear,
  });
  const blocked = () => {
    try {
      const status = getSecurityStatus();
      return status?.initialized !== true
        || status?.ready !== true
        || status?.available === false
        || status?.quarantined === true;
    } catch { return true; }
  };

  Object.defineProperty(prototype, 'setItem', {
    configurable: true,
    writable: true,
    value(key, value) {
      if (this === storage && (storeOwnedKey(key) || (protectedWorkKey(key) && blocked()))) {
        throw new CustodialProtectedStateMutationError(String(key));
      }
      return original.setItem.call(this, key, value);
    },
  });
  Object.defineProperty(prototype, 'removeItem', {
    configurable: true,
    writable: true,
    value(key) {
      if (this === storage && (storeOwnedKey(key) || (protectedWorkKey(key) && blocked()))) {
        throw new CustodialProtectedStateMutationError(String(key));
      }
      return original.removeItem.call(this, key);
    },
  });
  if (typeof original.clear === 'function') {
    Object.defineProperty(prototype, 'clear', {
      configurable: true,
      writable: true,
      value() {
        if (this === storage) throw new CustodialProtectedStateMutationError(null);
        return original.clear.call(this);
      },
    });
  }

  const installation = Object.freeze({ protectedKey, blocked });
  Object.defineProperty(prototype, FIREWALL_INSTALLATION, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: installation,
  });
  return installation;
}
