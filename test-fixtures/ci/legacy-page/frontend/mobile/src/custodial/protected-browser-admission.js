import {observeProtectedBrowserWork,captureProtectedBrowserWork,closeCapturedProtectedBrowserWork}
  from './protected-browser-inventory.js';

// UNMOUNTED cooperative browser owner. A preservation hold is NOT evidence of
// separation, native authority, a complete frozen inventory, or a server ACK.
// Mount only with all actual browser writers and the native recovery owner.
// There is deliberately no clear/thaw API: active-principal recovery must be
// bound to the native operation before runtime activation, never inferred here.
export const PROTECTED_BROWSER_HOLD_KEY = 'mz_custodial_protected_browser_hold.v1';
// Rejection metadata only. This never authenticates a principal or grants an
// ACK: it prevents participating original-byte writers from hiding an A-B-A.
export const PROTECTED_BROWSER_MUTATION_KEY = 'mz_custodial_protected_browser_mutation.v1';
export const PROTECTED_BROWSER_LOCK = 'memphis-custodial-protected-browser-work.v1';
const SCHEMA = 'custodial.browser-preservation-hold.v1';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const failure = code => Object.assign(new Error(code), {code});

export function createProtectedBrowserAdmission({storage, sessionStorage, indexedDb, locks, cryptoApi=globalThis.crypto}={}) {
  if (!storage || !['getItem','setItem'].every(key=>typeof storage[key]==='function'))
    throw new TypeError('Raw protected browser storage required.');
  // Once this instance observes any hold or ambiguous storage result, absence
  // cannot silently restore admission. A fresh process must consult the native
  // durable fence as well; localStorage alone cannot establish native authority.
  let observedHold = false;
  let activeCapture=null;
  let greatestEpoch=null,activeEpoch=null,epochUncertain=false;
  function epochFailure(reason) {
    epochUncertain=true;
    return Object.assign(failure('custodial_security_state_unavailable'),{reason});
  }
  function readEpoch() {
    if(epochUncertain)throw epochFailure('browser_mutation_epoch_unconfirmed');
    let raw;
    try{raw=storage.getItem(PROTECTED_BROWSER_MUTATION_KEY);}
    catch{throw epochFailure('browser_mutation_epoch_uninspectable');}
    if(raw===null){
      if(greatestEpoch!==null)throw epochFailure('browser_mutation_epoch_missing');
      return null; // Absence is not a frozen generation or an empty-work proof.
    }
    if(typeof raw!=='string'||!/^[1-9][0-9]{0,18}$/.test(raw))throw epochFailure('browser_mutation_epoch_invalid');
    const value=BigInt(raw);
    if(value>9223372036854775807n||greatestEpoch!==null&&value<greatestEpoch)
      throw epochFailure('browser_mutation_epoch_invalid');
    greatestEpoch=value;return raw;
  }
  function advanceEpoch() {
    const original=readEpoch(),previous=original===null?0n:BigInt(original);
    if(previous===9223372036854775807n)throw epochFailure('browser_mutation_epoch_exhausted');
    const next=String(previous+1n);
    // The stamp precedes the callback. Failed/throwing work keeps its stamp;
    // an unconfirmed stamp never permits an original body effect or refund.
    try{storage.setItem(PROTECTED_BROWSER_MUTATION_KEY,next);}
    catch{throw epochFailure('browser_mutation_epoch_write_unconfirmed');}
    if(readEpoch()!==next)throw epochFailure('browser_mutation_epoch_write_unconfirmed');
    return next;
  }
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
    const epoch=readEpoch();
    if(activeEpoch!==null&&epoch!==activeEpoch)throw epochFailure('browser_mutation_epoch_changed');
  }
  function held() { try { const hold=rawHold();readEpoch();return hold!==null; } catch { return true; } }
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
  // Existing-hold capture is READ ONLY: it cannot create/renew a missing
  // marker or epoch. Both entrypoints share the same original-source guards.
  function captureUnderHold({operationId,timeoutMs=5000,lifetimeMs=30000}={},existingOnly=false) {
    if(!uuid(operationId))return Promise.reject(failure('browser_hold_operation_invalid'));
    if(!Number.isInteger(lifetimeMs)||lifetimeMs<1||lifetimeMs>30000)
      return Promise.reject(failure('browser_capture_lifetime_invalid'));
    const marker=JSON.stringify({schema:SCHEMA,operation_id:operationId,native_authority:false});
    return owned(async()=>{
      if(activeCapture)throw failure('browser_capture_already_retained');
      const prior=rawHold();
      if(prior!==null&&prior!==marker)throw failure('browser_hold_operation_conflict');
      if(existingOnly&&prior!==marker){observedHold=true;throw failure('browser_existing_hold_required');}
      observedHold=true;
      if(prior===null){
        advanceEpoch();
        try{storage.setItem(PROTECTED_BROWSER_HOLD_KEY,marker);}
        catch{throw failure('browser_hold_write_unconfirmed');}
      }
      const epoch=readEpoch();
      if(epoch===null)throw epochFailure('browser_mutation_epoch_missing');
      if(rawHold()!==marker)throw failure('browser_hold_write_unconfirmed');
      let capture,timer,closed=false,deadline;
      const onClose=()=>{closed=true;clearTimeout(timer);if(activeCapture===capture)activeCapture=null;};
      const assertCurrent=()=>{
        if(closed)throw failure('browser_capture_closed');
        if(deadline!==undefined&&performance.now()>=deadline){
          closeCapturedProtectedBrowserWork(capture);throw failure('browser_capture_expired');
        }
        if(rawHold()!==marker)throw failure('browser_hold_changed_during_capture');
        if(readEpoch()!==epoch)throw epochFailure('browser_mutation_epoch_changed');
      };
      const captureOwner=Object.freeze({assertCurrent,onClose,
        withRead:(read,budget)=>owned(async()=>{assertCurrent();const result=await read();assertCurrent();return result;},budget)});
      try{
        assertCurrent();
        capture=await captureProtectedBrowserWork({storage,sessionStorage,indexedDb,cryptoApi,timeoutMs,captureOwner});
        assertCurrent();
        if(capture.state!=='OBSERVED_NOT_FROZEN')throw Object.assign(failure('browser_capture_uninspectable'),{reason:capture.reason});
        activeCapture=capture;deadline=performance.now()+lifetimeMs;
        timer=setTimeout(()=>closeCapturedProtectedBrowserWork(capture),lifetimeMs);
        // Return ONLY the existing WeakMap-owned capture. No raw-value getter,
        // owner callback/boolean, thaw or new native/ACK authority is exposed.
        return capture;
      }catch(error){if(capture)closeCapturedProtectedBrowserWork(capture);onClose();throw error;}
    },timeoutMs);
  }
  return Object.freeze({
    held,
    requireAdmission,
    requireMutation() {
      if(activeEpoch===null)throw failure('custodial_browser_original_mutation_required');
      requireAdmission();
    },
    mutate(operation,{timeoutMs=5000}={}) {
      if (typeof operation!=='function') throw new TypeError('Protected mutation required.');
      return owned(async()=>{
        requireAdmission();
        activeEpoch=advanceEpoch();
        try{
          const result=await operation();
          // A raw/foreign writer changing the guard during work is not success.
          // This does not roll back the writer or claim cross-realm enforcement.
          requireAdmission();return result;
        }finally{activeEpoch=null;}
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
        if(prior===null){
          advanceEpoch();
          try { storage.setItem(PROTECTED_BROWSER_HOLD_KEY,marker); }
          catch { throw failure('browser_hold_write_unconfirmed'); }
        }
        const epoch=readEpoch();
        if(epoch===null)throw epochFailure('browser_mutation_epoch_missing');
        if (rawHold()!==marker) throw failure('browser_hold_write_unconfirmed');
        const observation=await observeProtectedBrowserWork({storage,sessionStorage,indexedDb,cryptoApi,timeoutMs});
        if (rawHold()!==marker) throw failure('browser_hold_changed_during_observation');
        if(readEpoch()!==epoch)throw epochFailure('browser_mutation_epoch_changed');
        return Object.freeze({schema:'custodial.browser-held-observation.v1',operation_id:operationId,
          state:'PRESERVATION_HOLD',native_authority:false,frozen:false,acknowledged:false,
          phone_released:false,observation});
      },timeoutMs);
    },
    holdAndCapture(options={}) { return captureUnderHold(options,false); },
    captureExistingHold(options={}) { return captureUnderHold(options,true); },
  });
}
