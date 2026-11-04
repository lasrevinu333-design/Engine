import assert from 'node:assert/strict';
import test from 'node:test';
import {createNativeProtectedStorage} from '../src/custodial/native-security.js';
import {createCustodialCredentialStore} from '../src/custodial/credential-store.js';
import * as keys from '../src/custodial/security-keys.js';

const oldId='11000000-0000-4000-8000-000000000001';
const activeId='11000000-0000-4000-8000-000000000002';
const device='KIOSK_08', seal='test-only-installation-seal-12345678';
const archiveKey='memphisZooCustodialSupersededEnrollmentV1:'+oldId;
const journal={schema_version:1,operation_id:oldId,device_id:device,flow:'enrollment',
  status:'pending_server',recovery_id:null,created_at:'2026-11-04T13:44:00.000Z',
  server_result_received_at:null,local_committed_at:null,resume_expires_at:null,credential_id:null};
function nativeState(){
  const enrolled='2026-11-04T17:42:00.000Z';
  return {schema_version:2,state:'ACTIVE',active:true,credential_present:true,blocked:false,
    active_enrollment_operation_id:activeId,active_enrollment_flow:'enrollment',
    active_credential_id:'11000000-0000-4000-8000-000000000003',
    installation:{schema_version:1,device_id:device,installation_seal:seal,enrolled_at:enrolled,
      enrollment_operation_id:activeId,migrated_from_credential_only_state:false},
    principal:{schema_version:'custodial-protected-principal.v1',device_id:device,
      employee_id:'11000000-0000-4000-8000-000000000004',credential_id:'11000000-0000-4000-8000-000000000003',
      credential_operation_id:activeId,assignment_epoch:1,installation_seal:seal,enrolled_at:enrolled},
    assigned_activation:{schema_version:'native-assigned-activation.v1',operation_id:activeId,
      device_id:device,flow:'enrollment',installation_seal:seal,enrolled_at:enrolled,lineage_operation_id:activeId}};
}
function fixture({row=journal,extra={},failure=null}={}){
  const raw=typeof row==='string'?row:JSON.stringify(row,null,2);
  const values=new Map(Object.entries({[keys.CUSTODIAL_ENROLLMENT_OPERATION_KEY]:raw,
    'mz_custodial_draft:original':'original draft bytes','mz_scan_session:original':'original queued-work bytes',...extra}));
  let armed=Boolean(failure);
  const check=(op,key,after)=>{if(armed&&failure.op===op&&failure.key===key&&Boolean(failure.after)===after){armed=false;throw Error('injected storage failure');}};
  const storage={get length(){return values.size;},key:index=>[...values.keys()][index]??null,
    getItem:key=>values.get(key)??null,
    setItem(key,value){check('set',key,false);values.set(key,String(value));check('set',key,true);},
    removeItem(key){check('remove',key,false);values.delete(key);check('remove',key,true);}};
  return {values,storage,raw};
}
async function reconcile(f,native=nativeState(),onRead=()=>{}){
  return createNativeProtectedStorage({async getState(){onRead();return structuredClone(native);}},f.storage).reconcileLocalState();
}
function assertPreserved(f){
  assert.equal(f.values.get('mz_custodial_draft:original'),'original draft bytes');
  assert.equal(f.values.get('mz_scan_session:original'),'original queued-work bytes');
}
function assertCompleted(f){
  assert.equal(f.values.has(keys.CUSTODIAL_ENROLLMENT_OPERATION_KEY),false);
  const held=JSON.parse(f.values.get(archiveKey));
  assert.equal(held.original_journal,f.raw);
  assert.equal(held.current_operation_id,activeId);
  assert.equal(held.disposition,'preserved_uncommitted_intent');
  for(const k of keys.CUSTODIAL_DEVICE_KEYS)assert.equal(f.values.get(k),device);
  assert.equal(f.values.get(keys.CUSTODIAL_INSTALLATION_MARKER_KEY),seal);
  assertPreserved(f);
}
test('confirmed receiver activation preserves the older uncommitted renderer journal and opens the current binding',async()=>{
  const f=fixture();await reconcile(f);assertCompleted(f);
  const before=[...f.values];await reconcile(f);assert.deepEqual([...f.values],before);
});
test('the actual credential store becomes enrolled with the original principal and preserved history',async()=>{
  const f=fixture(),n=nativeState();
  const store=createCustodialCredentialStore({storage:f.storage,
    secureStorage:createNativeProtectedStorage({async getState(){return structuredClone(n);}},f.storage),
    indexedDb:{databases:async()=>[],open(){throw Error('No absent fixture database may be created');}},
    cryptoApi:{randomUUID:()=>oldId}});
  await store.ensureSecurityState();
  assert.equal(store.getStatus().state,'enrolled');assert.equal(store.getStatus().ready,true);
  assert.deepEqual(store.getStatus().principal,n.principal);
  assert.equal(store.getPendingEnrollmentOperation(),null);assertCompleted(f);
});
for(const failure of [
  ...[false,true].map(after=>({op:'set',key:archiveKey,after})),
  ...keys.CUSTODIAL_DEVICE_KEYS.map(key=>({op:'set',key})),
  {op:'set',key:keys.CUSTODIAL_INSTALLATION_MARKER_KEY},
  ...[false,true].map(after=>({op:'remove',key:keys.CUSTODIAL_ENROLLMENT_OPERATION_KEY,after})),
])test(`restart preserves history after ${JSON.stringify(failure)}`,async()=>{
  const f=fixture({failure});await assert.rejects(()=>reconcile(f),/injected storage failure/);
  assertPreserved(f);
  assert.ok(f.values.get(keys.CUSTODIAL_ENROLLMENT_OPERATION_KEY)===f.raw
    ||JSON.parse(f.values.get(archiveKey)).original_journal===f.raw);
  await reconcile(f);assertCompleted(f);
});
for(const [name,change] of Object.entries({
  absent_provenance:n=>{delete n.assigned_activation;},
  wrong_operation:n=>{n.assigned_activation.operation_id=oldId;},
  wrong_device:n=>{n.assigned_activation.device_id='KIOSK_09';},
  wrong_lineage:n=>{n.assigned_activation.lineage_operation_id=oldId;},
  wrong_seal:n=>{n.assigned_activation.installation_seal+='x';},
  wrong_enrolled_at:n=>{n.assigned_activation.enrolled_at='2026-01-01T00:00:00Z';},
  wrong_flow:n=>{n.assigned_activation.flow='recovery';},
  extra_proof:n=>{n.assigned_activation.extra=true;},
  absent_principal:n=>{delete n.principal;},
  wrong_principal_operation:n=>{n.principal.credential_operation_id=oldId;},
  wrong_principal_device:n=>{n.principal.device_id='KIOSK_09';},
  wrong_credential:n=>{n.principal.credential_id=oldId;},
  inactive:n=>{n.active=false;},
  unreadable_credential:n=>{n.credential_present=false;},
  removal:n=>{n.removal_pending=true;},
}))test(`refuses ${name}`,async()=>{
  const f=fixture(),n=nativeState();change(n);const before=[...f.values];
  await assert.rejects(()=>reconcile(f,n));assert.deepEqual([...f.values],before);
});
for(const [name,change] of Object.entries({
  different_device:{device_id:'KIOSK_09'},recovery:{flow:'recovery'},
  recovery_proof:{recovery_id:'retained-recovery'},credential:{credential_id:activeId},
  staged:{server_result_received_at:'2026-11-04T13:44:01Z'},
  committed:{local_committed_at:'2026-11-04T13:44:01Z'},
  confirmation:{status:'local_committed_pending_server_confirmation'},unknown:{extra:'retained unknown'},
}))test(`preserves ${name} journal without adoption`,async()=>{
  const f=fixture({row:{...journal,...change}}),before=[...f.values];
  await assert.rejects(()=>reconcile(f));assert.deepEqual([...f.values],before);
});
for(const [key,value] of [
  [archiveKey,'foreign history bytes'],[keys.CUSTODIAL_RESTORE_QUARANTINE_KEY,'{}'],
  [keys.CUSTODIAL_RECOVERY_RECORD_KEY,'{}'],[keys.CUSTODIAL_REMOVAL_OPERATION_KEY,'{}'],
  [keys.CUSTODIAL_DEVICE_KEYS[0],'KIOSK_09'],[keys.CUSTODIAL_INSTALLATION_MARKER_KEY,'different-original-seal'],
])test(`preserves conflicting ${key}`,async()=>{
  const f=fixture({extra:{[key]:value}}),before=[...f.values];
  await assert.rejects(()=>reconcile(f));assert.deepEqual([...f.values],before);
});
test('other realm replacement while native observation is awaited is retained exactly',async()=>{
  const f=fixture();await assert.rejects(()=>reconcile(f,nativeState(),()=>{
    f.values.set(keys.CUSTODIAL_ENROLLMENT_OPERATION_KEY,'foreign changed bytes');
  }),{code:'custodial_native_original_local_state_changed'});
  assert.equal(f.values.get(keys.CUSTODIAL_ENROLLMENT_OPERATION_KEY),'foreign changed bytes');
  assert.equal(f.values.has(archiveKey),false);assertPreserved(f);
});
