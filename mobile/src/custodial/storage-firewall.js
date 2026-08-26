const firewallInstallations = new WeakMap();

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
  'memphisZooCustodialRemovalCompletionV1',
  'mz_messenger_user_id',
]);

export const CUSTODIAL_PROTECTED_STORAGE_PREFIXES = Object.freeze([
  'session:',
  'mz_chatscope_outbox:',
  'mz_chatscope_delete_outbox:',
  'mz_messenger_v2_outbox:',
  'mz_messenger_v2_draft:',
  'mz_scan_completion_draft:',
  'mz_work_position_evidence:',
  'mz_phone_scan_resume:',
  'mz_scan_authority_snapshot:',
  'mz_scan_contract_cache:',
  'mz_custodial_home_cache:',
  'mz_employee_feedback_outbox:',
  'mz_employee_schedule_snapshot:',
  'mz_native_notification_outbox:',
  'mz_custodial_prestart_recovery:',
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
  if (firewallInstallations.has(prototype)) return firewallInstallations.get(prototype);

  const original = Object.freeze({
    setItem: prototype.setItem,
    removeItem: prototype.removeItem,
    clear: prototype.clear,
  });
  let crossContextTamper = false;
  const blocked = () => {
    if (crossContextTamper) return true;
    try {
      const status = getSecurityStatus();
      return status?.initialized !== true
        || status?.ready !== true
        || status?.available === false
        || status?.quarantined === true;
    } catch { return true; }
  };

  // This wrapper is a cooperative sequencing guard for the app's current realm,
  // not the source of enrollment authority. Browser named-property writes and
  // other same-origin realms can reach Web Storage without these methods, so the
  // credential store independently revalidates the protected installation
  // binding before every privileged capability use.

  Object.defineProperty(prototype, 'setItem', {
    configurable: false,
    writable: false,
    value(key, value) {
      if (this === storage && (storeOwnedKey(key) || (protectedWorkKey(key) && blocked()))) {
        throw new CustodialProtectedStateMutationError(String(key));
      }
      return original.setItem.call(this, key, value);
    },
  });
  Object.defineProperty(prototype, 'removeItem', {
    configurable: false,
    writable: false,
    value(key) {
      if (this === storage && (storeOwnedKey(key) || (protectedWorkKey(key) && blocked()))) {
        throw new CustodialProtectedStateMutationError(String(key));
      }
      return original.removeItem.call(this, key);
    },
  });
  if (typeof original.clear === 'function') {
    Object.defineProperty(prototype, 'clear', {
      configurable: false,
      writable: false,
      value() {
        if (this === storage) throw new CustodialProtectedStateMutationError(null);
        return original.clear.call(this);
      },
    });
  }

  // Storage is a legacy named-property object: `localStorage[key] = value`
  // does not call Storage.prototype.setItem. Replace this realm's public
  // accessor with a non-replaceable facade so cooperative application code has
  // one guard for method, named-property, delete, and defineProperty writes.
  // The credential store captured bound raw methods before installation and
  // remains the only writer for store-owned identity journals.
  let publicStorage = storage;
  try {
    if (globalThis.localStorage === storage) {
      const boundMethods = new WeakMap();
      publicStorage = new Proxy(storage, {
        get(target, property) {
          const value = Reflect.get(target, property, target);
          if (typeof value !== 'function') return value;
          if (!boundMethods.has(value)) boundMethods.set(value, value.bind(target));
          return boundMethods.get(value);
        },
        set(target, property, value) {
          if (
            typeof property === 'string'
            && (storeOwnedKey(property) || (protectedWorkKey(property) && blocked()))
          ) {
            throw new CustodialProtectedStateMutationError(property);
          }
          return Reflect.set(target, property, value, target);
        },
        deleteProperty(target, property) {
          if (
            typeof property === 'string'
            && (storeOwnedKey(property) || (protectedWorkKey(property) && blocked()))
          ) {
            throw new CustodialProtectedStateMutationError(property);
          }
          return Reflect.deleteProperty(target, property);
        },
        defineProperty(target, property, descriptor) {
          if (
            typeof property === 'string'
            && (storeOwnedKey(property) || (protectedWorkKey(property) && blocked()))
          ) {
            throw new CustodialProtectedStateMutationError(property);
          }
          return Reflect.defineProperty(target, property, descriptor);
        },
      });
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: false,
        enumerable: descriptor?.enumerable ?? true,
        writable: false,
        value: publicStorage,
      });
    }
  } catch {
    // Some hosts expose a non-replaceable accessor. Method guards still apply;
    // privileged capabilities independently revalidate the untrusted binding.
    publicStorage = storage;
  }

  // A same-origin document has its own Storage realm and can mutate the shared
  // storage area without traversing this realm's facade. Latch protected cache
  // writes closed when the browser reports that cross-context tamper. Credential
  // authority remains in SecureStorage and is synchronously revalidated by the
  // credential runtime before use.
  try {
    globalThis.addEventListener?.('storage', (event) => {
      if (
        (!event.storageArea || event.storageArea === storage || event.storageArea === publicStorage)
        && (event.key === null || protectedKey(event.key))
      ) {
        crossContextTamper = true;
      }
    });
  } catch {
    crossContextTamper = true;
  }

  const installation = Object.freeze({
    protectedKey,
    blocked,
    crossContextTampered: () => crossContextTamper,
  });
  firewallInstallations.set(prototype, installation);
  return installation;
}
