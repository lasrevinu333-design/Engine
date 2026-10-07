import {observeProtectedBrowserWork} from './protected-browser-inventory.js';

// UNMOUNTED cooperative browser owner. A preservation hold is NOT evidence of
// separation, native authority, a complete frozen inventory, or a server ACK.
// Mount only with all actual browser writers and the native recovery owner.
// There is deliberately no clear/thaw API: active-principal recovery must be
// bound to the native operation before runtime activation, never inferred here.
export const PROTECTED_BROWSER_HOLD_KEY = 'mz_custodial_protected_browser_hold.v1';
export const PROTECTED_BROWSER_LOCK = 'memphis-custodial-protected-browser-work.v1';
const SCHEMA = 'custodial.browser-preservation-hold.v1';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const failure = code => Object.assign(new Error(code), {code});

export function createProtectedBrowserAdmission({storage, indexedDb, locks, cryptoApi=globalThis.crypto}={}) {
  if (!storage || !['getItem','setItem'].every(key=>typeof storage[key]==='function'))
    throw new TypeError('Raw protected browser storage required.');
  // Once this instance observes any hold or ambiguous storage result, absence
  // cannot silently restore admission. A fresh process must consult the native
  // durable fence as well; localStorage alone cannot establish native authority.
  let observedHold = false;
  function rawHold() {
    let value;
    try { value=storage.getItem(PROTECTED_BROWSER_HOLD_KEY); }
    catch { observedHold=true; throw failure('browser_hold_uninspectable'); }
    if (value!==null) observedHold=true;
    else if (observedHold) throw failure('browser_hold_missing_after_observation');
    return value;
  }
  function requireAdmission() {
    if (rawHold()!==null) throw failure('custodial_browser_preservation_pending');
  }
  function held() { try { return rawHold()!==null; } catch { return true; } }
  async function owned(operation, timeoutMs) {
    if (!Number.isInteger(timeoutMs) || timeoutMs<1 || timeoutMs>30000)
      throw failure('browser_lock_budget_invalid');
    const request=locks?.request;
    if (typeof request!=='function') throw failure('browser_shared_lock_unavailable');
    const abort=new AbortController();
    let entered=false;
    const timer=setTimeout(()=>abort.abort(),timeoutMs);
    try {
      const result=await request.call(locks,PROTECTED_BROWSER_LOCK,{mode:'exclusive',signal:abort.signal},lock=>{
        if (entered || abort.signal.aborted || !lock || lock.name!==PROTECTED_BROWSER_LOCK || lock.mode!=='exclusive')
          throw failure('browser_shared_lock_unavailable');
        entered=true;clearTimeout(timer);
        // Never release this lock on a timer while an admitted async writer is
        // still alive. Hold acquisition may time out, but cannot steal its lock.
        return operation();
      });
      if (!entered) throw failure('browser_shared_lock_unavailable');
      return result;
    } catch (error) {
      if (!entered && abort.signal.aborted) throw failure('browser_shared_lock_timeout');
      throw error;
    } finally { clearTimeout(timer); }
  }
  return Object.freeze({
    held,
    requireAdmission,
    mutate(operation,{timeoutMs=5000}={}) {
      if (typeof operation!=='function') throw new TypeError('Protected mutation required.');
      return owned(async()=>{
        requireAdmission();
        const result=await operation();
        // A raw/foreign writer changing the guard during work is not success.
        // This does not roll back the writer or claim cross-realm enforcement.
        requireAdmission();return result;
      },timeoutMs);
    },
    holdAndObserve({operationId,timeoutMs=5000}={}) {
      if (!uuid(operationId)) return Promise.reject(failure('browser_hold_operation_invalid'));
      const marker=JSON.stringify({schema:SCHEMA,operation_id:operationId,native_authority:false});
      return owned(async()=>{
        const prior=rawHold();
        if (prior!==null && prior!==marker) throw failure('browser_hold_operation_conflict');
        // Same-byte retry verifies storage again, rather than using a previous
        // in-memory success. Never replace another operation or malformed row.
        observedHold=true;
        try { storage.setItem(PROTECTED_BROWSER_HOLD_KEY,marker); }
        catch { throw failure('browser_hold_write_unconfirmed'); }
        if (rawHold()!==marker) throw failure('browser_hold_write_unconfirmed');
        const observation=await observeProtectedBrowserWork({storage,indexedDb,cryptoApi,timeoutMs});
        if (rawHold()!==marker) throw failure('browser_hold_changed_during_observation');
        return Object.freeze({schema:'custodial.browser-held-observation.v1',operation_id:operationId,
          state:'PRESERVATION_HOLD',native_authority:false,frozen:false,acknowledged:false,
          phone_released:false,observation});
      },timeoutMs);
    },
  });
}
