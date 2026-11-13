import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {closedScanOwnerSource} from './scan-owner-vm-context.mjs';
import {createSyntheticScheduleLocks} from './synthetic-schedule-locks.mjs';
import {createCustodialCredentialStore} from '../mobile/src/custodial/credential-store.js';
import {createProtectedBrowserAdmission} from '../mobile/src/custodial/protected-browser-admission.js';
import {createRawStorageAdapter,installCustodialStorageFirewall} from '../mobile/src/custodial/storage-firewall.js';
import * as keys from '../mobile/src/custodial/security-keys.js';
const source=readFileSync(process.env.SCAN_SYNC_SOURCE||new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
const id=n=>'ab000000-0000-4000-8000-'+String(n).padStart(12,'0');

// Actual queue owners, credential store, admission and storage firewall.
// Only persistence, locks, native attestation and transport are synthetic.
async function fixture(kind,change,caller=false){
  class Storage{
    data=new Map();get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}
    getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}
  }
  const storage=new Storage(),secondary=new Storage(),raw=createRawStorageAdapter(storage),locks=createSyntheticScheduleLocks();
  const p={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
    credential_operation_id:id(3),assignment_epoch:7,installation_seal:'synthetic-deferred-completion-seal',enrolled_at:'2026-11-01T00:00:00Z'};
  for(const k of keys.CUSTODIAL_DEVICE_KEYS)raw.setItem(k,p.device_id);
  raw.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,p.installation_seal);
  const secure=new Map([[keys.CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify({schema_version:1,credential:'synthetic-only',device_id:p.device_id,installation_seal:p.installation_seal,principal:p})]]);
  const indexedDb={databases:async()=>[],open(){assert.fail('No real database');}};
  const gate=createProtectedBrowserAdmission({storage:raw,sessionStorage:secondary,indexedDb,locks,cryptoApi:webcrypto});
  const store=createCustodialCredentialStore({storage:raw,indexedDb,cryptoApi:webcrypto,
    protectedWorkAdmission:fn=>gate.mutate(fn),protectedWorkCheckpoint:()=>gate.requireAdmission(),
    secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
  installCustodialStorageFirewall({storage,getSecurityStatus:store.getStatus,requireProtectedWorkMutation:()=>gate.requireMutation()});
  await store.ensureSecurityState();
  const security={native:true,getStatus:store.getStatus,mutateProtectedWork:store.runWhenReady,waitForStableState:store.waitForStableState};
  const session={session_uuid:id(10),client_session_id:id(10),client_completion_id:id(11),device_id:p.device_id,location_code:'WAUW',
    context_id:id(12),submission_proof:'synthetic-accepted-start',started_at:'2026-11-01T12:00:00.000Z',ended_at:'2026-11-01T12:05:00.000Z',
    native_finish_scan_entry_id:id(13),status:'pending_submit',server_acknowledged:true,
    offline_authority_snapshot_id:'a'.repeat(64),offline_authority_employee_id:p.employee_id,offline_authority_assignment_epoch:7,
    scan_evidence:[],response_json:{work_result:'checked_no_cleaning_needed',services_performed:[]}};
  const proof={p_client_ended_at:session.ended_at,p_native_finish_scan_entry_id:id(13),
    p_native_completion_attestation_version:'custodial-native-completion.v2',p_native_completion_attestation:'b'.repeat(64),
    p_native_completion_transport_attestation_version:'custodial-native-completion-transport.v1',p_native_completion_transport_attestation:'c'.repeat(64)};
  if(change==='already-proof')Object.assign(session,{native_completion_attestation_version:proof.p_native_completion_attestation_version,native_completion_attestation:proof.p_native_completion_attestation});
  const key='session:'+session.session_uuid;await store.runWhenReady(()=>storage.setItem(key,JSON.stringify(session)));
  const originalBytes=storage.getItem(key),rows=new Map(),calls=[];let nativeCalls=0,readHook=null;
  const db={objectStoreNames:{contains:n=>n==='actions'},transaction(_name,mode){
    const working=mode==='readwrite'?new Map(structuredClone([...rows])):rows;
    let pending=0,terminal=false;
    const tx={error:null,abort(){if(terminal)return;terminal=true;setTimeout(()=>tx.onabort?.({target:tx}),0);}};
    const complete=()=>setTimeout(()=>{if(pending||terminal)return;terminal=true;if(mode==='readwrite'){rows.clear();for(const [k,v] of working)rows.set(k,v);}tx.oncomplete?.({target:tx});},0);
    const request=fn=>{const req={};pending++;setTimeout(()=>{if(terminal)return;try{req.result=fn();req.onsuccess?.({target:req});}catch(e){req.error=e;tx.error=e;req.onerror?.({target:req});tx.abort();}finally{pending--;complete();}},0);return req;};
    tx.objectStore=()=>({getAll(){return request(()=>{readHook?.();return structuredClone([...working.values()]);});},get(id){return request(()=>structuredClone(working.get(id)));},put(v){return request(()=>{working.set(v.id,structuredClone(v));return v.id;});},delete(id){return request(()=>working.delete(id));}});complete();return tx;
  }};
  const mobile={principalIdentity:()=>JSON.stringify(store.getStatus().principal),nativeOfflineTimeAuthority:true,
    createOfflineCompletionAttestation:async()=>{
      assert.throws(()=>gate.requireMutation(),'Native waits must remain outside protected mutation');nativeCalls++;
      if(nativeCalls===1){
        if(change==='generation')await store.ensureSecurityState();
        if(change==='lease')rows.get(1).lease_token='successor-lease';
        if(change==='session')await store.runWhenReady(()=>storage.setItem(key,JSON.stringify({...session,offline_authority_employee_id:id(99)})));
        if(change==='evidence')await store.runWhenReady(()=>storage.setItem(key,JSON.stringify({...session,scan_evidence:[{client_event_id:id(98),notes:'Saved while native was pending'}]})));
      }
      return {...structuredClone(proof),...(change==='invalid-proof'?{p_native_completion_attestation:'invalid'}:{})};
    }};
  const stop=Object.assign(Error('Synthetic stop before HTTP'),{code:'SYNTHETIC_TRANSPORT_STOP'});
  const context={window:{localStorage:storage,MemphisCustodialSecurity:security,MemphisMobile:mobile,setTimeout,clearTimeout},
    navigator:{locks,onLine:true},indexedDB:indexedDb,localStorage:storage,structuredClone,TextEncoder,crypto:webcrypto,setTimeout,clearTimeout,console,
    state:{sessionQuarantine:[],db,workerId:'synthetic-worker',deviceId:p.device_id},
    verifiedServerCompletionReceipt:async()=>null,
    persistClaimPayload:async(_item,payload)=>{calls.push({kind:'payload',payload:structuredClone(payload)});return true;},
    rpc:async(fn,payload)=>{assert.throws(()=>gate.requireMutation());calls.push({kind:'transport',fn,payload:structuredClone(payload)});throw stop;}};
  let fence=caller==='recoverStaleRollbackFenceForNewWork';
  if(caller){
    Object.assign(context,{ensureWorkerReady:async()=>true,verifyWorkerBackendCompatibility:async()=>true,reportDeviceSyncStatus:async()=>true,scheduleSync(){},CustomEvent:class{}});
    context.window.dispatchEvent=()=>{};delete context.persistClaimPayload;
    Object.assign(mobile,{getOfflineAuthorityState:async()=>({occurrences_awaiting_acknowledgement:false,rollback_fence_active:fence,rollback_fence_id:fence?id(70):null}),beginRollbackFence:async()=>{fence=true;return{rollback_fence_active:true,rollback_fence_id:id(70)};},clearRollbackFence:async()=>{fence=false;}});
    const previousRpc=context.rpc;context.rpc=(fn,p)=>fn==='tool_get_device_rollback_readiness'?{eligible:true,backend_queue_count:0,backend_open_session_count:0}:previousRpc(fn,p);
    if(kind==='historical')await store.runWhenReady(()=>storage.setItem(key,JSON.stringify({...session,status:'closed'})));
  }
  const entries=['processAction','storageRecord','withOwnedQueueLock',...(caller?[caller,'withQueueLock']:[])];
  const code=closedScanOwnerSource(source,entries,context);vm.createContext(context);vm.runInContext(code,context);
  const payload=kind==='historical'?{p_device_id:p.device_id,p_client_event_id:id(20),p_event_type:'scan_error',p_notes:'Original diagnostic',p_payload_json:{session_uuid:session.session_uuid,client_session_id:session.client_session_id}}:
    {p_device_id:p.device_id,p_client_session_id:session.client_session_id,p_client_completion_id:session.client_completion_id,
      p_location_code:session.location_code,p_client_started_at:session.started_at,p_client_ended_at:session.ended_at,
      p_native_finish_scan_entry_id:id(13),p_snapshot_id:session.offline_authority_snapshot_id,p_snapshot_employee_id:p.employee_id,p_snapshot_assignment_epoch:7,
      p_response_json:session.response_json};
  let item={id:1,schema_version:6,state:caller?'processing':'pending',type:kind==='historical'?'record_scan_event':'commit_workflow',operation_id:kind==='historical'?id(20):id(11),
    created_at:Date.parse(session.started_at),lease_owner:'synthetic-worker',lease_token:'original-lease',lease_until:Date.now()+60000,
    security_generation:store.getStatus().generation,payload};
  rows.set(1,structuredClone(context.storageRecord(item)));
  item=structuredClone(context.normalizeRecord(rows.get(1)));
  if(kind==='historical'&&change==='session')readHook=()=>{readHook=null;raw.setItem(key,JSON.stringify({...session,device_id:'KIOSK_09'}));};
  if(kind==='historical'&&change==='event-conflict')readHook=()=>{readHook=null;raw.setItem(key,JSON.stringify({...session,scan_evidence:[{client_event_id:id(20),notes:'Concurrent original evidence'}]}));};
  return{context,item,calls,stop,storage,key,originalBytes,session,store,locks,rows,nativeCalls:()=>nativeCalls};
}
for(const kind of ['completion','historical'])for(const change of kind==='historical'?['none','session','event-conflict']:['none','generation','lease','session','evidence','already-proof','invalid-proof']){
  test(`deferred ${kind} protected writer: ${change}`,async()=>{
    const f=await fixture(kind,change),denied=['generation','lease','session','invalid-proof','event-conflict'].includes(change);
    if(denied){await assert.rejects(()=>f.context.processAction(f.item));assert.equal(f.calls.length,0);
      if(change==='event-conflict')assert.equal(JSON.parse(f.storage.getItem(f.key)).scan_evidence[0].notes,'Concurrent original evidence');
      else if(change!=='session')assert.equal(f.storage.getItem(f.key),f.originalBytes);return;}
    if(kind==='historical'){
      const result=await f.context.processAction(f.item);assert.equal(result.migrated_to_canonical_evidence,true);
      assert.equal(JSON.parse(f.storage.getItem(f.key)).scan_evidence[0].notes,'Original diagnostic');assert.equal(f.calls.length,0);
    }else{
      await assert.rejects(()=>f.context.processAction(f.item),e=>{if(e!==f.stop)throw e;return true;});
      const bytes=f.storage.getItem(f.key),saved=JSON.parse(bytes);assert.equal(saved.native_completion_attestation,'b'.repeat(64));
      assert.equal(saved.client_completion_id,f.session.client_completion_id);assert.equal(saved.submission_proof,f.session.submission_proof);
      if(change==='evidence')assert.equal(saved.scan_evidence[0].notes,'Saved while native was pending');
      await assert.rejects(()=>f.context.processAction(f.item),e=>{if(e!==f.stop)throw e;return true;});
      assert.equal(f.storage.getItem(f.key),bytes,'Retry reads the exact saved proof without replacing it');
      assert.equal(f.calls.filter(c=>c.kind==='transport').length,2);
    }
  });
}

for(const caller of ['sync','drainForNewWork','rollbackReadiness','recoverStaleRollbackFenceForNewWork'])for(const kind of ['historical','completion'])test(`complete ${caller} caller preserves deferred ${kind}`,{timeout:5000},async()=>{
 const f=await fixture(kind,'none',caller);
 const result=await f.context[caller](id(70));
 assert.equal(f.locks.pending,0,'All queue, network-worker and protected-work locks must settle');
 const saved=JSON.parse(f.storage.getItem(f.key));
 if(kind==='historical'){assert.equal(saved.scan_evidence[0].notes,'Original diagnostic');assert.equal(f.rows.size,0);}
 else{assert.equal(saved.native_completion_attestation,'b'.repeat(64));assert.equal(f.rows.size,1,'Transport stop retains the exact queued completion');assert.equal([...f.rows.values()][0].operation_id,f.item.operation_id);}
 assert.notEqual(result,undefined);
});
test('queue ownership cannot be forged or reused after release',async()=>{
 const f=await fixture('historical','none','sync');let expired;
 await f.context.withQueueLock(owner=>{expired=owner;});
 for(const owner of [{queueOwner:{}},expired])await assert.rejects(()=>f.context.withOwnedQueueLock(owner,()=>assert.fail('Invalid owner must not enter')));
 assert.equal(f.locks.pending,0);
});
