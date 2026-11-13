import { createCustodialCredentialStore } from './credential-store.js';
import { principalIdentity } from './protected-principal.js';
import { createProtectedBrowserAdmission, readDocumentProtectedBrowserWriterAdmission } from './protected-browser-admission.js';
import {
  createRawStorageAdapter,
  installCustodialStorageFirewall,
} from './storage-firewall.js';

let sharedRuntime = null;

function materialSecurityState(status) {
  if (!status || typeof status !== 'object') return '';
  if (status.quarantined === true) return `quarantined:${status.reason || ''}`;
  if (status.initialized === true && status.available === false) return `unavailable:${status.reason || ''}`;
  if (status.ready === true && status.available === true) return `ready:${status.deviceId || ''}:${principalIdentity(status.principal)}`;
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
 *   locks?: LockManager,
 * }} options
 */
function createCustodialSecurityRuntime({
  secureStorage,
  storage = globalThis.localStorage,
  sessionStorage = globalThis.sessionStorage,
  cryptoApi = globalThis.crypto,
  indexedDb = globalThis.indexedDB,
  locks = globalThis.navigator?.locks,
} = {}) {
  const rawStorage = createRawStorageAdapter(storage);
  // Preserve the actual secondary area's identity. Missing declaration stays
  // unknown; an aliased area must remain aliased so the collector refuses it.
  const rawSessionStorage = sessionStorage === undefined ? undefined
    : sessionStorage === storage ? rawStorage : createRawStorageAdapter(sessionStorage);
  // Private cooperative browser writer admission only. Never publish the
  // preservation owner or derive native/enrollment/removal authority from it.
  const browserAdmission = readDocumentProtectedBrowserWriterAdmission()
    ?? createProtectedBrowserAdmission({ storage: rawStorage, sessionStorage: rawSessionStorage, indexedDb, locks, cryptoApi });
  const store = createCustodialCredentialStore({
    secureStorage,
    storage: rawStorage,
    cryptoApi,
    indexedDb,
    protectedWorkAdmission: operation => browserAdmission.mutate(operation),
    protectedWorkCheckpoint: () => browserAdmission.requireAdmission(),
  });
  installCustodialStorageFirewall({ storage, getSecurityStatus: store.getStatus,
    requireProtectedWorkMutation: () => browserAdmission.requireMutation() });

  // Current readiness DATA must not outlive this SAME private browser owner.
  // Refusal only: this cannot authenticate a principal or admit a mutation,
  // and never changes the underlying credential record/status or selects a
  // fallback owner. Preserve existing nonoperational/quarantine diagnostics.
  const getStatus = () => {
    const snapshot = store.getStatus();
    try { browserAdmission.requireAdmission(); }
    catch (error) {
      if (snapshot.quarantined === true || snapshot.initialized !== true
        || (snapshot.ready !== true && snapshot.available !== true)) {
        return { ...snapshot, ready: false, available: false };
      }
      const pending = error?.code === 'custodial_browser_preservation_pending'
        || error?.code === 'browser_hold_missing_after_observation';
      return { ...snapshot, state: 'unavailable', ready: false, available: false,
        reason: pending ? 'custodial_browser_preservation_pending' : 'custodial_browser_admission_unavailable' };
    }
    return snapshot;
  };
  const ensureSecurityState = () => store.ensureSecurityState().then(status => {
    browserAdmission.requireAdmission();return status;
  });
  const waitForStableState = options => store.waitForStableState(options).then(status => {
    browserAdmission.requireAdmission();return status;
  });
  const listeners = new Set();
  let lastMaterialState = '';
  const publish = () => {
    const materialState = materialSecurityState(getStatus());
    if (!materialState || materialState === lastMaterialState) return;
    lastMaterialState = materialState;
    for (const listener of listeners) {
      try { listener(getStatus()); } catch {}
    }
    try {
      globalThis.dispatchEvent?.(new CustomEvent('memphis:custodial-security-state', { detail: getStatus() }));
    } catch {}
  };
  store.subscribe(publish);

  const initialCheck = Promise.resolve()
    .then(() => store.ensureSecurityState())
    .then(() => getStatus())
    .catch(() => getStatus());
  const publicSecurity = Object.freeze({
    native: true,
    // A later readiness read must not reuse an earlier fulfilled ready
    // snapshot after a hold. Previously returned DATA is not a live lease.
    get ready() { return initialCheck.then(() => getStatus()); },
    ensureSecurityState,
    getStatus,
    getPendingEnrollmentOperation: store.getPendingEnrollmentOperation,
    waitForStableState,
    mutateProtectedWork: store.runWhenReady,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('A security-state listener function is required');
      listeners.add(listener);
      try { listener(getStatus()); } catch {}
      return () => listeners.delete(listener);
    },
  });
  const shellSecurity = Object.freeze({
    ensureSecurityState,
    getStatus,
    waitForStableState,
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
