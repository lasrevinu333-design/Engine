import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash,randomUUID,webcrypto} from 'node:crypto';
import {createFeedbackOutbox} from '../mobile/src/custodial/feedback-outbox.js';
import {createCustodialCredentialStore} from '../mobile/src/custodial/credential-store.js';
import * as keys from '../mobile/src/custodial/security-keys.js';
import {createProtectedBrowserAdmission} from '../mobile/src/custodial/protected-browser-admission.js';
import {createSyntheticScheduleLocks} from './synthetic-schedule-locks.mjs';

// Actual outbox, credential store and browser admission; only Storage,
// secure persistence, Web Locks, IndexedDB inventory and HTTP are synthetic.
class Storage {
  data=new Map();get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}
  getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}
}
async function fixture(mode){
  const storage=new Storage(),secondary=new Storage(),secure=new Map(),calls=[];
  const p={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:randomUUID(),credential_id:randomUUID(),
    credential_operation_id:randomUUID(),assignment_epoch:7,installation_seal:'synthetic-feedback-restart-seal',enrolled_at:'2026-11-01T00:00:00Z'};
  for(const k of keys.CUSTODIAL_DEVICE_KEYS)storage.setItem(k,p.device_id);
  storage.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,p.installation_seal);
  const record=JSON.stringify({schema_version:1,credential:'synthetic-only',device_id:p.device_id,installation_seal:p.installation_seal,principal:p});
  secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,record);
  const indexedDb={databases:async()=>[],open(){assert.fail('No database creation');}};
  const gate=createProtectedBrowserAdmission({storage,sessionStorage:secondary,indexedDb,locks:createSyntheticScheduleLocks(),cryptoApi:webcrypto});
  const makeStore=()=>createCustodialCredentialStore({storage,indexedDb,cryptoApi:webcrypto,
    protectedWorkAdmission:fn=>gate.mutate(fn),protectedWorkCheckpoint:()=>gate.requireAdmission(),
    secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
  const store=makeStore();await store.ensureSecurityState();
  const identity={deviceId:p.device_id,employeeId:p.employee_id,credentialId:p.credential_id,assignmentEpoch:p.assignment_epoch};
  const box=createFeedbackOutbox({storage,identity:async()=>identity,mutate:fn=>store.runWhenReady(fn),online:()=>true,
    request:async(path,{body})=>{calls.push(path);if(mode==='unknown-outcome')throw Error('Synthetic lost response');
      return{ok:true,meta:{contract_version:'feedback.v3.enrolled-authority'},data:{item:{id:randomUUID(),operation_id:body.operation_id,
        binding:{schema:'employee-feedback-receipt.v1',device_id:p.device_id,employee_id:p.employee_id,
          content_sha256:createHash('sha256').update(JSON.stringify(['other','normal',body.message,null,null])).digest('hex')}}}};}});
  const body={operation_id:randomUUID(),message:'Retain the exact original ñ'};
  await box.save(body);const originalKey='mz_employee_feedback_outbox:'+p.device_id+':'+body.operation_id;
  const original=storage.getItem(originalKey);
  if(mode==='interrupted-retirement'){
    const remove=storage.removeItem.bind(storage);storage.removeItem=k=>{if(k===originalKey)throw Error('Synthetic interrupted retirement');remove(k);};
  }
  await box.flush();
  const backupKey='mz_employee_feedback_retirement_backup:'+p.device_id+':'+body.operation_id;
  return{storage,secure,record,makeStore,original,originalKey,backupKey,calls,p};
}
for(const mode of ['acknowledged','unknown-outcome','interrupted-retirement','invalid-json','unknown-schema','extra-field','wrong-key','foreign-device','foreign-employee','foreign-credential','foreign-epoch']){
  test('feedback retirement then credential restart: '+mode,async()=>{
    const f=await fixture(mode),allowed=['acknowledged','unknown-outcome','interrupted-retirement'].includes(mode);
    if(!allowed){
      const backup=JSON.parse(f.storage.getItem(f.backupKey));
      const original=JSON.parse(backup.original_encoded);
      if(mode==='unknown-schema')backup.schema_version='unknown';
      if(mode==='extra-field')backup.accepted=true;
      if(mode==='wrong-key')backup.original_key+='different';
      if(mode==='foreign-device')original.body.device_id='KIOSK_09';
      if(mode==='foreign-employee')original.body.expected_employee_id=randomUUID();
      if(mode==='foreign-credential')original.body.expected_credential_id=randomUUID();
      if(mode==='foreign-epoch')original.body.expected_assignment_epoch='8';
      backup.original_encoded=JSON.stringify(original);
      f.storage.setItem(f.backupKey,mode==='invalid-json'?'{malformed':JSON.stringify(backup));
    }
    const before=new Map([...f.storage.data].filter(([k])=>k.startsWith('mz_employee_feedback_')));
    for(let restart=0;restart<2;restart++){
      const next=f.makeStore();
      if(allowed){await next.ensureSecurityState();assert.equal(next.getStatus().ready,true);assert.equal(next.getStatus().deviceId,'KIOSK_08');}
      else await assert.rejects(()=>next.ensureSecurityState(),e=>e.code==='custodial_restore_quarantine');
      assert.equal(f.secure.get(keys.CUSTODIAL_INSTALLATION_RECORD_KEY),f.record);
      assert.deepEqual(new Map([...f.storage.data].filter(([k])=>k.startsWith('mz_employee_feedback_'))),before);
      assert.equal(f.calls.length,1,'Initialization must not submit or accept feedback');
    }
    if(mode==='acknowledged')assert.equal(JSON.parse(f.storage.getItem(f.backupKey)).original_encoded,f.original);
    if(mode!=='acknowledged'&&allowed)assert.equal(f.storage.getItem(f.originalKey),f.original);
  });
}
