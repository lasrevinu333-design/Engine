import assert from 'node:assert/strict';
import {test} from 'node:test';
import {webcrypto} from 'node:crypto';
import {createNativeProtectedStorage} from '../mobile/src/custodial/native-security.js';
import {createCustodialCredentialStore} from '../mobile/src/custodial/credential-store.js';
import {createProtectedBrowserAdmission} from '../mobile/src/custodial/protected-browser-admission.js';
import {createSyntheticScheduleLocks} from './synthetic-schedule-locks.mjs';
import * as keys from '../mobile/src/custodial/security-keys.js';
const id=n=>'ac000000-0000-4000-8000-'+String(n).padStart(12,'0');
class Storage{
  data=new Map();get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}
  getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}
}
async function fixture(){
  const storage=new Storage(),sessionStorage=new Storage();
  const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
    credential_operation_id:id(3),assignment_epoch:7,installation_seal:'synthetic-removal-resume-seal',enrolled_at:'2026-11-01T00:00:00Z'};
  let native={state:'ACTIVE',credential_present:true,active_enrollment_operation_id:id(3),principal,
    installation:{schema_version:1,device_id:'KIOSK_08',installation_seal:principal.installation_seal,enrollment_operation_id:id(3),enrolled_at:principal.enrolled_at}};
  for(const k of keys.CUSTODIAL_DEVICE_KEYS)storage.setItem(k,'KIOSK_08');storage.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,principal.installation_seal);
  const finalized=[],reads=[];let readHook=null;
  const plugin={getState:async()=>{reads.push(native.state);const value=structuredClone(native);await readHook?.();return value;},
    finalizeRemoval:async({operation_id})=>{assert.equal(operation_id,native.removal.operation_id);finalized.push(operation_id);
      native={state:'EMPTY',credential_present:false,removal_finalized:true,removal_pending:false,removal_remote_complete:true,removal:native.removal};return structuredClone(native);}};
  const secureStorage=createNativeProtectedStorage(plugin,storage),indexedDb={databases:async()=>[],open(){assert.fail('No real IndexedDB');}};
  const gate=createProtectedBrowserAdmission({storage,sessionStorage,indexedDb,locks:createSyntheticScheduleLocks(),cryptoApi:webcrypto});
  const makeStore=()=>createCustodialCredentialStore({storage,indexedDb,secureStorage,cryptoApi:webcrypto,
    protectedWorkAdmission:fn=>gate.mutate(fn),protectedWorkCheckpoint:()=>gate.requireAdmission()});
  const store=makeStore();await store.ensureSecurityState();
  return{storage,store,makeStore,finalized,reads,secureStorage,principal,get native(){return native;},set native(v){native=v;},hook(fn){readHook=fn;}};
}
for(const restart of [false,true])for(const phase of ['pending_server_removal','pending_push_unregister','push_unregistered','server_logged_out']){
  test(`same original removal resumes ${restart?'after restart':'in process'} from ${phase}`,async()=>{
    const f=await fixture();let operation,calls=0;
    await assert.rejects(()=>f.store.removeEnrollment({beforeRemove:async({operationId,checkpoint})=>{
      operation=operationId;calls++;f.native={...f.native,state:'REMOVAL_REQUESTED',removal_pending:true,
        removal_remote_complete:phase==='server_logged_out',removal:{operation_id:operationId,device_id:'KIOSK_08',remote_complete:phase==='server_logged_out'}};
      if(phase==='pending_push_unregister'||phase==='push_unregistered')await checkpoint('pending_push_unregister');
      if(phase==='push_unregistered')await checkpoint('push_unregistered');
      if(phase==='server_logged_out')await checkpoint('server_logged_out');
      throw Error('Synthetic response interruption');
    }}),/response interruption/);
    assert.equal(f.store.getStatus().ready,false);assert.equal(f.store.getStatus().principal,null);
    let store=f.store;
    if(restart){store=f.makeStore();await assert.rejects(()=>store.ensureSecurityState(),e=>e.code==='custodial_enrollment_removal_pending');}
    const result=await store.removeEnrollment({beforeRemove:async({operationId,deviceId,checkpoint})=>{
      calls++;assert.equal(operationId,operation);assert.equal(deviceId,'KIOSK_08');assert.equal(store.getStatus().ready,false);assert.equal(store.getStatus().principal,null);
      f.native.removal_remote_complete=true;f.native.removal.remote_complete=true;await checkpoint('server_logged_out');
    }});
    assert.equal(result.removed,true);assert.equal(calls,2);assert.deepEqual(f.finalized,[operation]);
    assert.equal(f.storage.getItem(keys.CUSTODIAL_REMOVAL_OPERATION_KEY),null);
    assert.equal(JSON.parse(f.storage.getItem(keys.CUSTODIAL_REMOVAL_COMPLETION_KEY)).operation_id,operation);
  });
}
for(const change of ['native-operation','native-installation','local-marker','pending-work','native-read-race']){
  test('removal resume refuses '+change,async()=>{
    const f=await fixture();let calls=0;
    await assert.rejects(()=>f.store.removeEnrollment({beforeRemove:async({operationId})=>{
      calls++;f.native={...f.native,state:'REMOVAL_REQUESTED',removal_pending:true,removal:{operation_id:operationId,device_id:'KIOSK_08'}};throw Error('Interrupted');}}));
    if(change==='native-operation')f.native.removal.operation_id=id(99);
    if(change==='native-installation'){f.native.installation.installation_seal='synthetic-successor-installation';f.native.principal={...f.principal,installation_seal:f.native.installation.installation_seal};}
    if(change==='local-marker')f.storage.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,'synthetic-successor-local-marker');
    if(change==='pending-work')f.storage.setItem('session:'+id(10),JSON.stringify({session_uuid:id(10),device_id:'KIOSK_08'}));
    if(change==='native-read-race')f.hook(()=>{f.storage.setItem(keys.CUSTODIAL_REMOVAL_OPERATION_KEY,'changed original journal');f.hook(null);});
    const before=new Map(f.storage.data);
    await assert.rejects(()=>f.store.removeEnrollment({beforeRemove:async()=>{calls++;assert.fail('No successor dispatch');}}));
    assert.equal(calls,1);assert.equal(f.finalized.length,0);assert.equal(f.native.state,'REMOVAL_REQUESTED');
    for(const [k,v] of before)if(k.startsWith('session:'))assert.equal(f.storage.getItem(k),v);
  });
}
test('native journal reconstructs missing compatibility journal, then resumes its same operation',async()=>{
  const f=await fixture(),operation=id(20);f.native={...f.native,state:'REMOVAL_REQUESTED',removal_pending:true,removal:{operation_id:operation,device_id:'KIOSK_08'}};
  const store=f.makeStore();await assert.rejects(()=>store.ensureSecurityState(),e=>e.code==='custodial_enrollment_removal_pending');
  assert.equal(JSON.parse(f.storage.getItem(keys.CUSTODIAL_REMOVAL_OPERATION_KEY)).operation_id,operation);
  await store.removeEnrollment({beforeRemove:async({operationId,checkpoint})=>{assert.equal(operationId,operation);f.native.removal_remote_complete=true;await checkpoint('server_logged_out');}});
  assert.deepEqual(f.finalized,[operation]);
});
