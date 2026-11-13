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
export const PROTECTED_BROWSER_DOCUMENT_WRITER_KEY = 'custodialOriginalBrowserWriteAdmission';
const SCHEMA = 'custodial.browser-preservation-hold.v1';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const failure = code => Object.assign(new Error(code), {code});
// Captured at module/document start, not borrowed later from application code.
const idbOwn=Object.getOwnPropertyDescriptor,idbProto=Object.getPrototypeOf,
  idbDefine=Object.defineProperty,idbApply=Reflect.apply,idbConstruct=Reflect.construct,idbFactories=new WeakSet();

// Ordinary sequencing only, not enrollment/capture/ACK authority. Native's
// document-start closure publishes ONLY these existing cooperative operations
// so its IDB wrapper and the shipping credential runtime share one epoch owner.
// A malformed present publication refuses; it never selects a fresh fallback.
export function readDocumentProtectedBrowserWriterAdmission(){
  const field=idbOwn(globalThis,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY);
  if(!field)return null;
  const value=field.value,names=['mutate','requireAdmission','requireMutation'];
  if(field.get||field.set||field.writable!==false||field.enumerable!==false||field.configurable!==false
    ||!value||!Object.isFrozen(value)||Object.getOwnPropertySymbols(value).length
    ||Object.getOwnPropertyNames(value).length!==names.length
    ||names.some(name=>typeof idbOwn(value,name)?.value!=='function'))
    throw failure('custodial_document_browser_writer_unavailable');
  return value;
}

export function createProtectedBrowserAdmission({storage, sessionStorage, indexedDb, locks, cryptoApi=globalThis.crypto}={}) {
  if (!storage || !['getItem','setItem'].every(key=>typeof storage[key]==='function'))
    throw new TypeError('Raw protected browser storage required.');
  // Once this instance observes any hold or ambiguous storage result, absence
  // cannot silently restore admission. A fresh process must consult the native
  // durable fence as well; localStorage alone cannot establish native authority.
  let observedHold = false;
  let activeCapture=null;
  const holdObservations=new WeakMap();
  let greatestEpoch=null,activeEpoch=null,epochUncertain=false;
  let idbFence=null,captureAttempted=false;
  function installIndexedDbWriteFence() {
    if(idbFence)throw failure('browser_idb_fence_already_attempted');
    // Native DOCUMENT START must call this before app code. This cannot find
    // transactions begun before installation, borrowed raw methods, or writers
    // in another realm. Installation itself grants no all-writer authority.
    const active=new Set(),waiters=new Set(),pins=[],databases=new WeakSet();
    let installed=false,unavailable=null;
    const poison=reason=>{
      unavailable??=reason;epochUncertain=true;
      for(const notify of [...waiters])notify();
      return Object.assign(failure('custodial_security_state_unavailable'),{reason:unavailable});
    };
    const same=(a,b)=>!!a===!!b&&(!a||['value','get','set','writable','enumerable','configurable'].every(k=>a[k]===b[k]));
    function pin(object,key){
      const chain=[];let current=object;
      for(let n=0;current&&n<32;n++){
        const descriptor=idbOwn(current,key),prototype=idbProto(current);
        chain.push({object:current,descriptor,prototype});
        if(descriptor){const p={object,key,chain,owner:current,descriptor};pins.push(p);return p;}
        current=prototype;
      }
      throw poison('browser_idb_intrinsic_unavailable');
    }
    const value=(p,receiver)=>'value' in p.descriptor?p.descriptor.value:
      typeof p.descriptor.get==='function'?idbApply(p.descriptor.get,receiver,[]):undefined;
    function current(idle=false){
      if(unavailable||!installed)throw Object.assign(failure('custodial_security_state_unavailable'),{reason:unavailable??'browser_idb_fence_uninstalled'});
      try{
        for(const p of pins)for(const node of p.chain)
          if(idbProto(node.object)!==node.prototype||!same(idbOwn(node.object,p.key),node.descriptor))
            throw failure('browser_idb_intrinsic_changed');
        if(value(factoryPin,globalThis)!==factory)throw failure('browser_idb_factory_changed');
      }catch(error){throw poison(error.code??'browser_idb_intrinsic_uninspectable');}
      if(idle&&active.size)throw failure('browser_idb_writers_not_quiescent');
    }
    function idle(remaining){
      current();
      return new Promise((resolve,reject)=>{
        let timer,done=false;
        const notify=()=>{
          if(done)return;
          try{current();if(active.size)return;done=true;waiters.delete(notify);clearTimeout(timer);resolve();}
          catch(error){done=true;waiters.delete(notify);clearTimeout(timer);reject(error);}
        };
        waiters.add(notify);
        try{timer=setTimeout(()=>{poison('browser_idb_quiescence_timeout');},remaining());notify();}
        catch(error){done=true;waiters.delete(notify);clearTimeout(timer);reject(error);}
      });
    }
    idbFence=Object.freeze({current,idle});
    let factoryPin,factory,add,remove,target,trusted,stop,requestTransaction,requestResult,transactionMode,abort;
    let databasePrototype,transactionDescriptor;
    function protectDatabase(database){
      current();
      if(!database||idbProto(database)!==databasePrototype)throw poison('browser_idb_database_unconfirmed');
      const own=idbOwn(database,'transaction');
      if(databases.has(database)){
        if(!same(own,transactionDescriptor))throw poison('browser_idb_database_hook_changed');
        return;
      }
      if(own)throw poison('browser_idb_database_shadowed');
      // Native open delivers this handle through our listener BEFORE app
      // callbacks. Do not seal the object or restrict unrelated app fields.
      idbDefine(database,'transaction',transactionDescriptor);
      if(!same(idbOwn(database,'transaction'),transactionDescriptor))throw poison('browser_idb_database_hook_unavailable');
      databases.add(database);
    }
    function stamp(){
      if(activeEpoch!==null&&readEpoch()!==activeEpoch)throw epochFailure('browser_mutation_epoch_changed');
      const next=advanceEpoch();if(activeEpoch!==null)activeEpoch=next;
    }
    function begin(){
      current();requireAdmission();
      const record={settled:false,cleanup:[]};active.add(record);
      try{stamp();return record;}catch(error){active.delete(record);throw poison(error.reason??'browser_idb_start_unconfirmed');}
    }
    function settle(record){
      if(record.settled)return;record.settled=true;
      // Request success/error and transaction complete/abort ONLY. A request
      // error bubbling through a transaction and factory blocked are NOT ends.
      for(const clean of record.cleanup)try{clean();}catch{poison('browser_idb_listener_cleanup_unconfirmed');}
      record.cleanup.length=0;
      try{current();stamp();}catch(error){poison(error.reason??'browser_idb_terminal_unconfirmed');}
      active.delete(record);for(const notify of [...waiters])notify();
    }
    function listen(record,object,name,work){
      const listener=event=>{
        try{
          if(idbApply(target,event,[])!==object||idbApply(trusted,event,[])!==true)
            throw failure('browser_idb_unconfirmed_event');
          work(event);
        }
        catch(error){try{idbApply(stop,event,[]);}catch{};poison(error.reason??error.code??'browser_idb_event_unconfirmed');}
      };
      const options={capture:true};
      idbApply(add,object,[name,listener,options]);
      record.cleanup.push(()=>idbApply(remove,object,[name,listener,options]));
    }
    function transaction(record,tx){
      const mode=idbApply(transactionMode,tx,[]);
      if(!['readwrite','readwriteflush','versionchange'].includes(mode))throw poison('browser_idb_transaction_unconfirmed');
      listen(record,tx,'complete',()=>settle(record));listen(record,tx,'abort',()=>settle(record));
    }
    function replace(p,wrapper){
      if(typeof p.descriptor.value!=='function'||!p.descriptor.configurable||!p.descriptor.writable)
        throw poison('browser_idb_hook_unavailable');
      const descriptor={...p.descriptor,value:wrapper,writable:false,configurable:false};idbDefine(p.owner,p.key,descriptor);
      p.descriptor=descriptor;p.chain[p.chain.length-1].descriptor=descriptor;
    }
    try{
      if(captureAttempted||activeCapture||observedHold||activeEpoch!==null||greatestEpoch!==null)
        throw poison('browser_idb_fence_late_installation');
      const ctor=name=>{
        const c=value(pin(globalThis,name),globalThis);
        if(typeof c!=='function')throw poison('browser_idb_intrinsic_unavailable');
        const prototype=value(pin(c,'prototype'),c);if(!prototype)throw poison('browser_idb_intrinsic_unavailable');return prototype;
      };
      const fp=ctor('IDBFactory'),dp=ctor('IDBDatabase'),ep=ctor('EventTarget'),event=ctor('Event'),rp=ctor('IDBRequest'),tp=ctor('IDBTransaction');
      factoryPin=pin(globalThis,'indexedDB');factory=value(factoryPin,globalThis);
      if(!factory||idbFactories.has(factory))throw poison('browser_idb_document_already_fenced');
      const method=(object,key)=>{const p=pin(object,key);if(typeof p.descriptor.value!=='function')throw poison('browser_idb_intrinsic_unavailable');return p;};
      const getter=(object,key)=>{const p=pin(object,key);if(typeof p.descriptor.get!=='function')throw poison('browser_idb_intrinsic_unavailable');return p.descriptor.get;};
      add=method(ep,'addEventListener').descriptor.value;remove=method(ep,'removeEventListener').descriptor.value;
      target=getter(event,'target');stop=method(event,'stopImmediatePropagation').descriptor.value;
      // isTrusted may be a LegacyUnforgeable own accessor instead of a
      // prototype accessor. A never-dispatched fixed probe captures that
      // native getter without accepting a caller event/getter/boolean.
      const probe=idbConstruct(value(pin(globalThis,'Event'),globalThis),['custodial-idb-fence-intrinsic']);
      trusted=getter(probe,'isTrusted');
      if(idbApply(trusted,probe,[])!==false)throw poison('browser_idb_event_intrinsic_unconfirmed');
      requestTransaction=getter(rp,'transaction');requestResult=getter(rp,'result');transactionMode=getter(tp,'mode');abort=method(tp,'abort').descriptor.value;
      const tx=method(dp,'transaction'),open=method(fp,'open'),del=method(fp,'deleteDatabase');
      for(const p of [tx,open,del])if(!p.descriptor.configurable||!p.descriptor.writable)throw poison('browser_idb_hook_unavailable');
      // Pin absence of instance shadows as well as the prototype hooks.
      for(const key of ['open','deleteDatabase'])if(pin(factory,key).owner!==fp)throw poison('browser_idb_factory_shadowed');
      const nativeTransaction=tx.descriptor.value,nativeOpen=open.descriptor.value,nativeDelete=del.descriptor.value;
      replace(tx,function(...args){
        current();protectDatabase(this);
        if(args[1]===undefined||args[1]==='readonly')return idbApply(nativeTransaction,this,args);
        if(args[1]!=='readwrite'&&args[1]!=='readwriteflush')throw poison('browser_idb_mode_uninspectable');
        const record=begin();
        try{const result=idbApply(nativeTransaction,this,args);transaction(record,result);current();return result;}
        catch(error){poison('browser_idb_transaction_start_unconfirmed');settle(record);throw error;}
      });
      databasePrototype=dp;transactionDescriptor={...tx.descriptor};
      const factoryCall=(native,upgrades)=>function(...args){
        // open may create/upgrade even without an explicit version. Private
        // inventory uses its pre-install raw open with its own upgrade abort.
        const record=begin();
        try{
          const request=idbApply(native,this,args);
          listen(record,request,'success',()=>{if(upgrades)protectDatabase(idbApply(requestResult,request,[]));settle(record);});
          listen(record,request,'error',()=>settle(record));
          if(upgrades)listen(record,request,'upgradeneeded',event=>{
            const tx=idbApply(requestTransaction,request,[]);
            // The open token was registered/stamped before native invocation.
            const upgrade={settled:false,cleanup:[]};active.add(upgrade);
            try{current();protectDatabase(idbApply(requestResult,request,[]));stamp();transaction(upgrade,tx);}
            catch(error){poison(error.reason??'browser_idb_upgrade_unconfirmed');idbApply(stop,event,[]);try{idbApply(abort,tx,[]);}catch{};return;}
            let denied=false;
            try{requireAdmission();}catch{denied=true;}
            if(denied){idbApply(stop,event,[]);try{idbApply(abort,tx,[]);}catch{poison('browser_idb_upgrade_abort_unconfirmed');}}
          });
          current();return request;
        }catch(error){poison('browser_idb_factory_start_unconfirmed');settle(record);throw error;}
      };
      replace(open,factoryCall(nativeOpen,true));replace(del,factoryCall(nativeDelete,false));
      // Immutable inherited data methods alone still permit defineProperty
      // instance shadows. Lock the actual document factory's own lookups too.
      for(const p of [open,del]){
        if(idbOwn(factory,p.key))throw poison('browser_idb_factory_shadowed');
        idbDefine(factory,p.key,p.descriptor);
      }
      // The factory lookup pins share these descriptors with the actual hook.
      for(const p of pins){
        for(const node of p.chain)
          if((node.object===fp||node.object===factory)&&(p.key==='open'||p.key==='deleteDatabase'))node.descriptor=idbOwn(node.object,p.key);
        if(p.object===factory&&(p.key==='open'||p.key==='deleteDatabase')){
          p.owner=factory;p.descriptor=idbOwn(factory,p.key);p.chain=p.chain.slice(0,1);
        }
      }
      idbFactories.add(factory);installed=true;current();
    }catch(error){throw poison(error.reason??error.code??'browser_idb_install_unconfirmed');}
  }
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
    idbFence?.current();
    if (rawHold()!==null) throw failure('custodial_browser_preservation_pending');
    const epoch=readEpoch();
    if(activeEpoch!==null&&epoch!==activeEpoch)throw epochFailure('browser_mutation_epoch_changed');
  }
  function held() { try { idbFence?.current();const hold=rawHold();readEpoch();return hold!==null; } catch { return true; } }
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
    captureAttempted=true;
    if(!uuid(operationId))return Promise.reject(failure('browser_hold_operation_invalid'));
    if(!Number.isInteger(lifetimeMs)||lifetimeMs<1||lifetimeMs>30000)
      return Promise.reject(failure('browser_capture_lifetime_invalid'));
    const marker=JSON.stringify({schema:SCHEMA,operation_id:operationId,native_authority:false});
    const started=idbFence?performance.now():null;
    const remaining=()=>{
      const left=Math.floor(timeoutMs-(performance.now()-started));
      if(!Number.isFinite(left)||left<1)throw failure('browser_idb_capture_budget_expired');return left;
    };
    return owned(async()=>{
      idbFence?.current();
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
      // Persist the original hold BEFORE draining pre-hold native writers.
      // No epoch/snapshot is selected until every tracked terminal event.
      if(idbFence){await idbFence.idle(remaining);idbFence.current(true);remaining();}
      const epoch=readEpoch();
      if(epoch===null)throw epochFailure('browser_mutation_epoch_missing');
      if(rawHold()!==marker)throw failure('browser_hold_write_unconfirmed');
      let capture,timer,closed=false,deadline;
      const onClose=()=>{closed=true;clearTimeout(timer);holdObservations.delete(capture);if(activeCapture===capture)activeCapture=null;};
      const assertCurrent=()=>{
        if(closed)throw failure('browser_capture_closed');
        idbFence?.current(true);
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
        capture=await captureProtectedBrowserWork({storage,sessionStorage,indexedDb,cryptoApi,timeoutMs:idbFence?remaining():timeoutMs,captureOwner});
        if(idbFence)remaining();
        assertCurrent();
        if(capture.state!=='OBSERVED_NOT_FROZEN')throw Object.assign(failure('browser_capture_uninspectable'),{reason:capture.reason});
        activeCapture=capture;deadline=performance.now()+lifetimeMs;
        holdObservations.set(capture,Object.freeze({assertCurrent,operationId,marker,epoch}));
        timer=setTimeout(()=>closeCapturedProtectedBrowserWork(capture),lifetimeMs);
        // Return ONLY the existing WeakMap-owned capture. No raw-value getter,
        // owner callback/boolean, thaw or new native/ACK authority is exposed.
        return capture;
      }catch(error){if(capture)closeCapturedProtectedBrowserWork(capture);onClose();throw error;}
    },timeoutMs);
  }
  return Object.freeze({
    installIndexedDbWriteFence,
    // Same WeakMap-owned capture/hold only. Reading this does not create,
    // renew, thaw or authenticate a marker, an epoch, a native ACK or owner.
    inspectCapturedHold(selected,{timeoutMs=5000}={}) {
      const original=holdObservations.get(selected);
      if(!original||selected!==activeCapture)
        return Promise.reject(failure('browser_original_hold_observation_unavailable'));
      return owned(async()=>{
        if(holdObservations.get(selected)!==original||selected!==activeCapture)
          throw failure('browser_original_hold_observation_unavailable');
        original.assertCurrent();
        const result=Object.freeze({schema:'custodial.browser-captured-hold-observation.v1',
          operation_id:original.operationId,mutation_epoch:original.epoch.toString(),
          hold_marker_utf8:original.marker,native_authority:false});
        original.assertCurrent();return result;
      },timeoutMs);
    },
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
