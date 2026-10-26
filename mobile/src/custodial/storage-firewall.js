import { PROTECTED_BROWSER_HOLD_KEY, PROTECTED_BROWSER_MUTATION_KEY } from './protected-browser-admission.js';

const firewallInstallations = new WeakMap();

export const CUSTODIAL_PROTECTED_STORAGE_KEYS = Object.freeze([
  PROTECTED_BROWSER_HOLD_KEY,
  PROTECTED_BROWSER_MUTATION_KEY,
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
  'mz_chatscope_read_outbox:',
  'mz_chatscope_group_pending:',
  'mz_messenger_v2_outbox:',
  'mz_messenger_v2_draft:',
  'mz_scan_completion_draft:',
  'mz_work_position_evidence:',
  'mz_phone_scan_resume:',
  'mz_scan_authority_snapshot:',
  'mz_scan_contract_cache:',
  'mz_custodial_home_cache:',
  'mz_employee_feedback_outbox:',
  'mz_employee_feedback_retirement_backup:',
  'mz_employee_schedule_snapshot:',
  'mz_employee_events_snapshot:',
  'mz_native_notification_outbox:',
  'mz_custodial_prestart_recovery:',
  'mz_same_original_recovery_original.v1:',
  'mz_original_inventory_separation.v1:',
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

// Capture only fixed Storage reads. Public application accessors/functions
// must not acquire the private branded receiver merely by being callable.
const rawLengthReaders = new WeakMap();
const storageOwn=Object.getOwnPropertyDescriptor,storagePrototype=Object.getPrototypeOf,
  storageGet=Reflect.get,storageApply=Reflect.apply;
function storageProperty(storage, key) {
  for (let owner=storage, depth=0; owner && depth<32; owner=storagePrototype(owner), depth++) {
    const descriptor=storageOwn(owner,key);
    if (descriptor) return {owner,descriptor};
  }
  return null;
}
function sameStorageProperty(a,b) {
  return !!a && !!b && a.owner===b.owner
    && ['value','get','set','writable','enumerable','configurable'].every(key=>a.descriptor[key]===b.descriptor[key]);
}
function storageLengthReader(storage) {
  if (rawLengthReaders.has(storage)) return rawLengthReaders.get(storage);
  const original=storageProperty(storage,'length');
  const invalid=()=>new TypeError('Original Storage length is unavailable');
  if (!original) throw invalid();
  const count=value=>{
    if (typeof value!=='number' || !Number.isSafeInteger(value) || value<0) throw invalid();
    return value;
  };
  let read;
  if ('value' in original.descriptor) {
    // A data count may legitimately change. Inspect its original descriptor
    // path, never invoke a subsequently installed accessor or coerce DATA.
    read=()=>{
      const current=storageProperty(storage,'length');
      if (!current || current.owner!==original.owner || !('value' in current.descriptor)
        || ['writable','enumerable','configurable'].some(key=>current.descriptor[key]!==original.descriptor[key])) throw invalid();
      return count(current.descriptor.value);
    };
  } else {
    const getter=original.descriptor.get;
    if (typeof getter!=='function' || original.descriptor.set!==undefined) throw invalid();
    // Private bootstrap captured this exact getter before firewall/app use.
    // Continue reading its live count without looking up later app getters.
    read=()=>count(storageApply(getter,storage,[]));
  }
  read(); // Unsupported/unavailable is never silently represented as zero.
  const captured=Object.freeze({original,read});
  rawLengthReaders.set(storage,captured);
  return captured;
}

export function createRawStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    throw new TypeError('A Storage-compatible implementation is required');
  }
  const getItem = storage.getItem.bind(storage);
  const setItem = storage.setItem.bind(storage);
  const removeItem = storage.removeItem.bind(storage);
  const key = typeof storage.key === 'function' ? storage.key.bind(storage) : () => null;
  const length = storageLengthReader(storage);
  return Object.freeze({
    getItem,
    setItem,
    removeItem,
    key,
    get length() { return length.read(); },
  });
}

export function installCustodialStorageFirewall({ storage, getSecurityStatus, requireProtectedWorkMutation }) {
  if (!storage || typeof getSecurityStatus !== 'function') {
    throw new TypeError('Custodial storage firewall requires storage and getSecurityStatus');
  }
  const prototype = Object.getPrototypeOf(storage);
  if (!prototype || typeof prototype.setItem !== 'function' || typeof prototype.removeItem !== 'function') {
    throw new TypeError('Custodial storage firewall requires a mutable Storage prototype');
  }
  if (firewallInstallations.has(prototype)) {
    const installation = firewallInstallations.get(prototype);
    installation.registerArea(storage);
    return installation;
  }

  const original = Object.freeze({
    getItem: prototype.getItem,
    setItem: prototype.setItem,
    removeItem: prototype.removeItem,
    clear: prototype.clear,
  });
  let crossContextTamper = false;
  let observedPreservationHold = false;
  let greatestMutationEpoch = null;
  const guardedAreas = new WeakSet();
  const parseMutationEpoch = value => {
    if (value === null) return null;
    if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value)) throw new Error('Mutation epoch unavailable');
    const epoch = BigInt(value);
    if (epoch > 9223372036854775807n) throw new Error('Mutation epoch unavailable');
    return epoch;
  };
  const preservationBlocked = () => {
    if (observedPreservationHold) return true;
    try {
      if (original.getItem.call(storage, PROTECTED_BROWSER_HOLD_KEY) !== null) observedPreservationHold = true;
    } catch {
      // An unavailable original hold cannot become permission for an unknown
      // row. Once observed, loss/read recovery is never an implicit thaw.
      observedPreservationHold = true;
    }
    return observedPreservationHold;
  };
  const blocked = () => {
    if (crossContextTamper) return true;
    try {
      // Cached ready state must not outlive a durable browser preservation
      // hold. Disappearance after observation is uncertainty, not a thaw.
      if (preservationBlocked()) return true;
      let value;
      try { value=parseMutationEpoch(original.getItem.call(storage, PROTECTED_BROWSER_MUTATION_KEY)); }
      catch { crossContextTamper=true; return true; }
      if (value === null) {
        if (greatestMutationEpoch !== null) { crossContextTamper = true; return true; }
      } else {
        if (greatestMutationEpoch !== null && value < greatestMutationEpoch) {
          crossContextTamper = true; return true;
        }
        greatestMutationEpoch = value;
      }
      const status = getSecurityStatus();
      return status?.initialized !== true
        || status?.ready !== true
        || status?.available === false
        || status?.quarantined === true;
    } catch { return true; }
  };

  // Readiness alone is not write ownership. The shipping runtime supplies the
  // private browser lock/epoch checkpoint; a missing owner must fail closed.
  const writeBlocked = () => {
    if(blocked()||typeof requireProtectedWorkMutation!=='function')return true;
    try{requireProtectedWorkMutation();return false;}catch{return true;}
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
      if (guardedAreas.has(this) && (preservationBlocked() || storeOwnedKey(key) || (protectedWorkKey(key) && writeBlocked()))) {
        throw new CustodialProtectedStateMutationError(typeof key === 'string' ? key : null);
      }
      return original.setItem.call(this, key, value);
    },
  });
  Object.defineProperty(prototype, 'removeItem', {
    configurable: false,
    writable: false,
    value(key) {
      if (guardedAreas.has(this) && (preservationBlocked() || storeOwnedKey(key) || (protectedWorkKey(key) && writeBlocked()))) {
        throw new CustodialProtectedStateMutationError(typeof key === 'string' ? key : null);
      }
      return original.removeItem.call(this, key);
    },
  });
  if (typeof original.clear === 'function') {
    Object.defineProperty(prototype, 'clear', {
      configurable: false,
      writable: false,
      value() {
        if (guardedAreas.has(this)) throw new CustodialProtectedStateMutationError(null);
        return original.clear.call(this);
      },
    });
  }

  // Storage is a legacy named-property object: indexed writes through either
  // public storage area do not call Storage.prototype.setItem. Replace each
  // realm accessor with a non-replaceable facade so cooperative application code has
  // one guard for method, named-property, delete, and defineProperty writes.
  // The credential store captured bound raw methods before installation and
  // remains the only writer for store-owned identity journals.
  function registerArea(area) {
    if (!area || Object.getPrototypeOf(area) !== prototype || guardedAreas.has(area)) return;
    guardedAreas.add(area);
    for (const name of ['localStorage', 'sessionStorage']) {
      try {
        if (globalThis[name] !== area) continue;
        const boundMethods = new WeakMap();
        const publicFunctions = new WeakMap();
        const fixedMethods = new Map();
        for (const key of ['getItem','key','setItem','removeItem','clear']) {
          const member=storageProperty(prototype,key);
          // A matching name on an application/instance shadow is not the
          // captured prototype Storage method and must not acquire raw this.
          if (typeof member?.descriptor.value==='function'
            && sameStorageProperty(storageProperty(area,key),member)) fixedMethods.set(key,member);
        }
        const length=storageLengthReader(area);
        const publicStorage = new Proxy(area, {
        get(target, property, receiver) {
          const member=storageProperty(target,property),fixed=fixedMethods.get(property);
          if (fixed && sameStorageProperty(member,fixed)) {
            // In particular these are the INSTALLED guarded write methods,
            // never the unguarded originals retained by the credential owner.
            const method=fixed.descriptor.value;
            if (!boundMethods.has(method)) boundMethods.set(method,method.bind(target));
            return boundMethods.get(method);
          }
          if (property==='length' && sameStorageProperty(member,length.original)) return length.read();
          const value = storageGet(target, property, receiver);
          const own=storageOwn(target,property);
          // A Proxy cannot substitute an own frozen data value. Refuse the
          // unsafe raw/callable shape rather than violate that invariant or
          // expose an unmediated function result. Ordinary scalar DATA stays.
          if (own && 'value' in own && !own.configurable && !own.writable
            && (value===target || typeof value==='function')) throw new TypeError('Unsafe immutable Storage property');
          if (value===target) return publicStorage;
          if (typeof value!=='function') return value;
          if (!publicFunctions.has(value)) publicFunctions.set(value,function(...args) {
            const result=storageApply(value,this===target?publicStorage:this,args);
            return result===target?publicStorage:result;
          });
          return publicFunctions.get(value);
        },
        set(target, property, value) {
          if (
            preservationBlocked() || (typeof property === 'string'
            && (storeOwnedKey(property) || (protectedWorkKey(property) && writeBlocked())))
          ) {
            throw new CustodialProtectedStateMutationError(typeof property === 'string' ? property : null);
          }
          return Reflect.set(target, property, value, target);
        },
        deleteProperty(target, property) {
          if (
            preservationBlocked() || (typeof property === 'string'
            && (storeOwnedKey(property) || (protectedWorkKey(property) && writeBlocked())))
          ) {
            throw new CustodialProtectedStateMutationError(typeof property === 'string' ? property : null);
          }
          return Reflect.deleteProperty(target, property);
        },
        defineProperty(target, property, descriptor) {
          if (
            preservationBlocked() || (typeof property === 'string'
            && (storeOwnedKey(property) || (protectedWorkKey(property) && writeBlocked())))
          ) {
            throw new CustodialProtectedStateMutationError(typeof property === 'string' ? property : null);
          }
          return Reflect.defineProperty(target, property, descriptor);
        },
        });
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, {
          configurable: false,
          enumerable: descriptor?.enumerable ?? true,
          writable: false,
          value: publicStorage,
        });
        guardedAreas.add(publicStorage);
      } catch {
        // Some hosts expose a non-replaceable accessor. Method guards still
        // apply; privileged capabilities revalidate the untrusted binding.
      }
    }
  }

  // The runtime installs with localStorage once. Register the other actual
  // same-realm Storage area at that point; later installers can add an area,
  // but cannot replace the first installation's security callback.
  registerArea(storage);
  try { registerArea(globalThis.sessionStorage); } catch { /* unavailable area */ }
  try { registerArea(globalThis.localStorage); } catch { /* unavailable area */ }

  // A same-origin document has its own Storage realm and can mutate the shared
  // storage area without traversing this realm's facade. Latch protected cache
  // writes closed when the browser reports that cross-context tamper. Credential
  // authority remains in SecureStorage and is synchronously revalidated by the
  // credential runtime before use.
  try {
    globalThis.addEventListener?.('storage', (event) => {
      if ((!event.storageArea || guardedAreas.has(event.storageArea)) && event.key === PROTECTED_BROWSER_MUTATION_KEY) {
        try {
          const before=parseMutationEpoch(event.oldValue),after=parseMutationEpoch(event.newValue);
          const actual=parseMutationEpoch(original.getItem.call(storage,PROTECTED_BROWSER_MUTATION_KEY));
          if(after===null||actual===null||(before!==null&&after<=before)||actual<after
            ||(greatestMutationEpoch!==null&&actual<greatestMutationEpoch)) throw new Error('Mutation epoch regressed');
          // A forward attempt stamp is expected from a cooperating document,
          // including read-only callbacks. It is NOT a credential/work edit.
          // Delayed events may precede our latest stamp; never refund it.
          greatestMutationEpoch=actual;
        } catch { crossContextTamper=true; }
        return;
      }
      if (
        (!event.storageArea || guardedAreas.has(event.storageArea))
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
    registerArea,
  });
  firewallInstallations.set(prototype, installation);
  return installation;
}
