import { createCustodialCredentialStore } from './credential-store.js';
import {
  createRawStorageAdapter,
  installCustodialStorageFirewall,
} from './storage-firewall.js';

let sharedRuntime = null;

function materialSecurityState(status) {
  if (!status || typeof status !== 'object') return '';
  if (status.quarantined === true) return `quarantined:${status.reason || ''}`;
  if (status.initialized === true && status.available === false) return `unavailable:${status.reason || ''}`;
  if (status.ready === true && status.available === true) return `ready:${status.deviceId || ''}`;
  return '';
}

/**
 * Creates the one native Custodial security boundary for this compiled module
 * graph. The credential store receives bound original Storage methods before
 * the public localStorage firewall is installed. Privileged objects never leave
 * this module except through the bridge-only capability returned below.
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
function createCustodialSecurityRuntime({
  secureStorage,
  storage = globalThis.localStorage,
  cryptoApi = globalThis.crypto,
  indexedDb = globalThis.indexedDB,
} = {}) {
  const rawStorage = createRawStorageAdapter(storage);
  const store = createCustodialCredentialStore({
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
  const publicSecurity = Object.freeze({
    native: true,
    ready: initialCheck,
    ensureSecurityState: store.ensureSecurityState,
    getStatus: store.getStatus,
    getPendingEnrollmentOperation: store.getPendingEnrollmentOperation,
    waitForStableState: store.waitForStableState,
    mutateProtectedWork: store.runWhenReady,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('A security-state listener function is required');
      listeners.add(listener);
      try { listener(store.getStatus()); } catch {}
      return () => listeners.delete(listener);
    },
  });
  const shellSecurity = Object.freeze({
    ensureSecurityState: store.ensureSecurityState,
    getStatus: store.getStatus,
    waitForStableState: store.waitForStableState,
  });
  const bridge = Object.freeze({ credentialStore: store, security: publicSecurity });
  return Object.freeze({ bridge, publicSecurity, shellSecurity });
}

function getOrCreateRuntime(options) {
  if (!sharedRuntime) sharedRuntime = createCustodialSecurityRuntime(options);
  return sharedRuntime;
}

function installPublicSecurity(security) {
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
}

/**
 * Returns the privileged native transport capability. Only the compiled bridge
 * imports this function; the returned credential store is never published on a
 * string or symbol property of globalThis.
 */
export function getCustodialBridgeSecurityRuntime(options = {}) {
  const runtime = getOrCreateRuntime(options);
  installPublicSecurity(runtime.publicSecurity);
  return runtime.bridge;
}

/**
 * Returns the status-only capability required by the role shell. Enrollment,
 * credential reads, removal, raw storage, and authorized transport are absent.
 */
export function getCustodialShellSecurityFacade(options = {}) {
  return getOrCreateRuntime(options).shellSecurity;
}
