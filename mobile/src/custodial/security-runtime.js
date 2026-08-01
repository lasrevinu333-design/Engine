import { getCustodialCredentialStore } from './credential-store.js';
import {
  createRawStorageAdapter,
  installCustodialStorageFirewall,
} from './storage-firewall.js';

const SHARED_RUNTIME_KEY = Symbol.for('org.memphiszoo.custodial.security-runtime');

function materialSecurityState(status) {
  if (!status || typeof status !== 'object') return '';
  if (status.quarantined === true) return `quarantined:${status.reason || ''}`;
  if (status.initialized === true && status.available === false) return `unavailable:${status.reason || ''}`;
  if (status.ready === true && status.available === true) return `ready:${status.deviceId || ''}`;
  return '';
}

/**
 * Installs the one native Custodial security boundary shared by the bridge,
 * enrollment UI, and role shell. The credential store receives bound original
 * Storage methods before the public localStorage firewall is installed.
 *
 * @param {{
 *   secureStorage: {
 *     get(key: string): Promise<unknown>,
 *     set(key: string, value: string): Promise<unknown>,
 *     remove(key: string): Promise<unknown>,
 *   },
 *   storage?: Storage,
 *   cryptoApi?: Crypto,
 *   indexedDb?: IDBFactory,
 * }} options
 */
export function getCustodialSecurityRuntime({
  secureStorage,
  storage = globalThis.localStorage,
  cryptoApi = globalThis.crypto,
  indexedDb = globalThis.indexedDB,
} = {}) {
  if (globalThis[SHARED_RUNTIME_KEY]) return globalThis[SHARED_RUNTIME_KEY];

  const rawStorage = createRawStorageAdapter(storage);
  const store = getCustodialCredentialStore({
    secureStorage,
    storage: rawStorage,
    cryptoApi,
    indexedDb,
  });
  installCustodialStorageFirewall({ storage, getSecurityStatus: store.getStatus });

  const listeners = new Set();
  let lastMaterialState = '';
  const publish = (status) => {
    const materialState = materialSecurityState(status);
    if (!materialState || materialState === lastMaterialState) return;
    lastMaterialState = materialState;
    const snapshot = store.getStatus();
    for (const listener of listeners) {
      try { listener(snapshot); } catch {}
    }
    try {
      globalThis.dispatchEvent?.(new CustomEvent('memphis:custodial-security-state', { detail: snapshot }));
    } catch {}
  };
  store.subscribe(publish);

  const initialCheck = Promise.resolve()
    .then(() => store.ensureSecurityState())
    .catch(() => store.getStatus());
  const security = Object.freeze({
    native: true,
    ready: initialCheck,
    ensureSecurityState: store.ensureSecurityState,
    getStatus: store.getStatus,
    getGeneration: store.getGeneration,
    getRecoveryRecord: store.getRecoveryRecord,
    getPendingEnrollmentOperation: store.getPendingEnrollmentOperation,
    getRemovalRecord: store.getRemovalRecord,
    waitForStableState: store.waitForStableState,
    mutateProtectedWork: store.runWhenReady,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('A security-state listener function is required');
      listeners.add(listener);
      try { listener(store.getStatus()); } catch {}
      return () => listeners.delete(listener);
    },
  });
  const runtime = Object.freeze({ store, security, rawStorage, ready: initialCheck });

  if (globalThis.MemphisCustodialSecurity && globalThis.MemphisCustodialSecurity !== security) {
    throw new Error('A conflicting Custodial security runtime is already installed');
  }
  if (!globalThis.MemphisCustodialSecurity) {
    Object.defineProperty(globalThis, 'MemphisCustodialSecurity', {
      configurable: false,
      enumerable: true,
      writable: false,
      value: security,
    });
  }
  Object.defineProperty(globalThis, SHARED_RUNTIME_KEY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: runtime,
  });
  return runtime;
}
