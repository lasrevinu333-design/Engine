import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createCustodialCredentialStore} from '../src/custodial/credential-store.js';
import {CUSTODIAL_PROTECTED_STORAGE_PREFIXES} from '../src/custodial/storage-firewall.js';

if(process.env.EVENT_OPEN_IDENTITY_CASE){
 await eventOriginalIdentityCase(process.env.EVENT_OPEN_IDENTITY_CASE);
}else{

// Actual SOURCE credential owner. Only synthetic Storage/secure callbacks/IDB
// absence; never a live phone, key, credential, browser, grant or API operation.
const caches=['mz_scan_authority_snapshot:','mz_scan_contract_cache:','mz_custodial_home_cache:','mz_employee_schedule_snapshot:','mz_employee_events_snapshot:'];
const pending=CUSTODIAL_PROTECTED_STORAGE_PREFIXES.filter(p=>!caches.includes(p));
const added=['mz_employee_feedback_outbox:','mz_chatscope_group_pending:','mz_native_notification_outbox:','mz_custodial_prestart_recovery:'];
assert.equal(pending.length,13);assert.equal(caches.length,5);
function fixture(){
 const local=new Map(),secure=new Map();let remote=0,opens=0;
 const storage={get length(){return local.size;},key:i=>[...local.keys()][i]??null,getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
 const indexedDb={databases:async()=>[],open(){opens++;throw Error('no absent DB creation');}};
 const store=createCustodialCredentialStore({storage,indexedDb,cryptoApi:webcrypto,secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
 return {store,storage,local,secure,get remote(){return remote;},get opens(){return opens;},remove:()=>store.removeEnrollment({beforeRemove:async({checkpoint})=>{remote++;await checkpoint('server_logged_out');}})};
}
async function enrolled(){const f=fixture();await f.store.setEnrollment({deviceId:'KIOSK_08',credential:'SYNTHETIC_namespace_only_credential'});return f;}
async function refused(f){
 const beforeSecure=[...f.secure],beforeLocal=[...f.local];
 await assert.rejects(f.remove(),e=>e.code==='custodial_pending_work');
 assert.equal(f.remote,0);assert.deepEqual([...f.secure],beforeSecure);assert.deepEqual([...f.local],beforeLocal);assert.equal(f.opens,0);
}
let passed=0,failed=0;
async function test(name,work){try{await work();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' '+e.stack);}}
for(const prefix of pending)await test('every declared pending prefix stops removal before logout: '+prefix,async()=>{
 const f=await enrolled(),raw=JSON.stringify({device_id:'KIOSK_08',note:'SYNTHETIC exact original bytes'});f.local.set(prefix+'synthetic-original',raw);
 await refused(f);assert.equal(f.store.getStatus().preservedCounts.total_pending,1);
 if(added.includes(prefix))assert.equal(f.store.getStatus().preservedCounts.additional_protected_work,1);
 else assert.equal(Object.hasOwn(f.store.getStatus().preservedCounts,'additional_protected_work'),false);
});
for(const prefix of added)await test('corrupt empty and unowned additional records remain pending: '+prefix,async()=>{
 for(const raw of ['', '{bad-json', 'null', '[1,2]', '{}']){const f=await enrolled();f.local.set(prefix+'synthetic-corrupt',raw);await refused(f);assert.equal(f.local.get(prefix+'synthetic-corrupt'),raw);}
});
for(const prefix of caches)await test('explicit existing cache-only policy remains zero pending: '+prefix,async()=>{
 const f=await enrolled();f.local.set(prefix+'synthetic-cache',JSON.stringify({device_id:'KIOSK_08'}));await f.remove();assert.equal(f.remote,1);assert.equal(f.store.getStatus().preservedCounts.total_pending,0);assert.equal(Object.hasOwn(f.store.getStatus().preservedCounts,'additional_protected_work'),false);
});
await test('empty namespace preserves exact historical count shape and normal removal',async()=>{
 const f=await enrolled();await f.remove();assert.equal(f.remote,1);assert.equal(f.store.getStatus().state,'unenrolled');assert.equal(f.secure.size,0);
 assert.deepEqual(Object.keys(f.store.getStatus().preservedCounts).sort(),['chatscope_delete_outbox','chatscope_outbox','chatscope_read_outbox','messenger_drafts','messenger_outbox','scan_completion_drafts','scan_queue','scan_resume_records','sessions','total_pending','work_position_evidence'].sort());
});
await test('mixed known and additional work counts every original once',async()=>{
 const f=await enrolled();f.local.set('session:old',JSON.stringify({device_id:'KIOSK_08'}));f.local.set(added[0]+'old',JSON.stringify({device_id:'KIOSK_08'}));await refused(f);assert.equal(f.store.getStatus().preservedCounts.total_pending,2);assert.equal(f.store.getStatus().preservedCounts.additional_protected_work,1);
});
await test('nested feedback original identity discovered without accepting it',async()=>{
 const f=fixture();f.local.set(added[0]+'old',JSON.stringify({schema_version:'employee-feedback-outbox.v2',body:{device_id:'KIOSK_08',expected_employee_id:'11111111-1111-4111-8111-111111111111'}}));
 await assert.rejects(f.store.ensureSecurityState(),e=>e.code==='custodial_restore_quarantine');const ids=f.store.getRecoveryRecord().original_identities;
 assert.deepEqual(ids.map(x=>x.canonical_device_id),['KIOSK_08']);assert.equal(f.store.getStatus().preservedCounts.total_pending,1);assert.equal(f.secure.size,0);
});
await test('missing additional identity remains unowned recovery not clean enrollment',async()=>{
 const f=fixture();f.local.set(added[0]+'old',JSON.stringify({body:{note:'SYNTHETIC no device identity'}}));await assert.rejects(f.store.ensureSecurityState(),e=>e.code==='custodial_restore_quarantine');assert.equal(f.store.getStatus().preservedCounts.total_pending,1);assert.ok(f.store.getRecoveryRecord().original_identities.some(x=>x.device_id==='unowned_preserved_work'));
});
console.log(JSON.stringify({passed,failed,scope:'actual SOURCE credential-store; synthetic Storage/secure callback/IDB absence only',all13declared_pending_prefixes:pending,all5explicit_cache_prefixes:caches,phone_or_production_or_key_removal:false}));
process.exitCode=failed?1:0;
}

async function eventOriginalIdentityCase(name){
 const {getCustodialBridgeSecurityRuntime}=await import('../src/custodial/security-runtime.js');
 const {createRawStorageAdapter}=await import('../src/custodial/storage-firewall.js');
 const {createEventNotificationOpenOutbox}=await import('../src/custodial/event-notification-receipts.js');
 const keys=await import('../src/custodial/credential-store.js');
 const id=n=>'be000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const p={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
  credential_operation_id:id(3),assignment_epoch:7,installation_seal:'SYNTHETIC_INSTALLATION_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
 const local=new Map(),secure=new Map();let held=false;
 class Storage{
  get length(){return local.size;}key(i){return [...local.keys()][i]??null;}getItem(k){return local.get(k)??null;}
  setItem(k,v){local.set(k,String(v));}removeItem(k){local.delete(k);}clear(){local.clear();}
 }
 const storage=new Storage();
 const raw=createRawStorageAdapter(storage);
 for(const key of keys.CUSTODIAL_DEVICE_KEYS)raw.setItem(key,p.device_id);
 raw.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,p.installation_seal);
 const enrollment=JSON.stringify({schema_version:1,credential:'SYNTHETIC_NOT_A_DEVICE_CREDENTIAL',device_id:p.device_id,
  installation_seal:p.installation_seal,enrolled_at:p.enrolled_at,principal:p});
 secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,enrollment);
 const runtime=getCustodialBridgeSecurityRuntime({storage,cryptoApi:webcrypto,indexedDb:{databases:async()=>[]},
  locks:{async request(name,options,work){assert.equal(held,false);held=true;try{return await work({name,mode:options.mode});}finally{held=false;}}},
  secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
 await runtime.security.ready;const store=runtime.credentialStore;
 const domain=createEventNotificationOpenOutbox({storage,mutate:runtime.security.mutateProtectedWork,
  getPrincipal:()=>store.getStatus().principal,getGeneration:()=>store.getGeneration()});
 const binding={instance_id:id(4),notification_key:'synthetic-event-original',event_id:id(5),notification_kind:'three_days_before',
  credential_id:p.credential_id,employee_id:p.employee_id,device_id:id(6),device_identifier:p.device_id,assignment_epoch:p.assignment_epoch};
 const source={...binding,scheduled_for:'2026-01-01T09:00:00.123456+00:00',state:'sent',sent_at:'2026-01-01T09:00:01.000000+00:00',
  opened_at:null,event_revision:2,event_validity:'CURRENT'};
 const read=await domain.beginCurrentEventsRead();assert.ok(read);assert.equal(domain.acceptCurrentEventsRead(read.token,[source]),true);
 const original=await domain.prepareOpen(binding.notification_key);assert.ok(original);
 if(name==='dispatch-unknown')assert.ok(await domain.beginOpenDispatch(original));
 const prefix='mz_native_notification_outbox:event-open.v1:';
 let key=[...local.keys()].find(k=>k.startsWith(prefix)),row=JSON.parse(local.get(key));
 const changes={
  'foreign-phone':r=>{r.binding.device_identifier='KIOSK_09';},
  'extra-root':r=>{r.extra=true;},'extra-binding':r=>{r.binding.extra=true;},
  'extra-source':r=>{r.source.extra=true;},'extra-body':r=>{r.body.extra=true;},
  'wrong-body':r=>{r.body.notification_key='foreign';},'wrong-id':r=>{r.id+='changed';},
  'invalid-uuid':r=>{r.binding.device_id=p.device_id;},'invalid-phase':r=>{r.phase='OBSERVED';},
  'bad-principal-hash':r=>{r.principal_sha256='x'.repeat(64);},'bad-revision':r=>{r.source.event_revision='2';},
  'legacy-schema':r=>{r.schema_version='native-notification-outbox.v2';},
  'invalid-kind':r=>{r.binding.notification_kind='day_before';},'bad-date':r=>{r.source.scheduled_for='2026-02-30T09:00:00Z';},
  'bad-epoch':r=>{r.binding.assignment_epoch=0;},'extra-device-alias':r=>{r.binding.deviceId='KIOSK_09';},
  'unbound-owner':r=>{r.principal_sha256=null;},'unknown-action':r=>{r.action='acknowledged';}
 };
 if(changes[name])changes[name](row);
 else if(!['prepared','dispatch-unknown','wrong-key','noncanonical-encoding','foreign-prefix','cold-known-phone'].includes(name))throw Error('Unknown new event identity selector');
 let encoded=JSON.stringify(row);
 if(name==='wrong-key'){raw.removeItem(key);key+='wrong';}
 if(name==='foreign-prefix'){raw.removeItem(key);key='mz_native_notification_outbox:unknown:'+row.id;}
 if(name==='noncanonical-encoding')encoded=' '+encoded;
 raw.setItem(key,encoded);
 const known=['prepared','dispatch-unknown','cold-known-phone'].includes(name);
 if(name==='cold-known-phone'){
  // A NEW actual credential-store owner over the same exact source bytes,
  // not a test reset of old guards or an adoption from current enrollment.
  const cold=createCustodialCredentialStore({storage:raw,indexedDb:{databases:async()=>[]},cryptoApi:webcrypto,
   secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
  await cold.ensureSecurityState();assert.equal(cold.getStatus().quarantined,false);assert.equal(cold.getStatus().ready,true);
  assert.equal(cold.getStatus().preservedCounts.additional_protected_work,1);
 }
 if(known){await store.ensureSecurityState();assert.equal(store.getStatus().ready,true);assert.equal(store.getStatus().quarantined,false);}
 else{await assert.rejects(store.ensureSecurityState(),e=>e.code==='custodial_restore_quarantine');assert.equal(store.getStatus().quarantined,true);}
 assert.equal(store.getStatus().preservedCounts.total_pending,1);assert.equal(store.getStatus().preservedCounts.additional_protected_work,1);
 assert.equal(local.get(key),encoded);assert.equal(secure.get(keys.CUSTODIAL_INSTALLATION_RECORD_KEY),enrollment);assert.equal(held,false);
 if(known)assert.equal(JSON.parse(local.get(key)).binding.device_id,binding.device_id);
 console.log(JSON.stringify({selector:name,result:'PASS_SOURCE_SYNTHETIC',originalRow:'BYTE_PRESERVED',pending:1,
  disposition:known?'KNOWN_PHONE_DISCOVERY_ONLY_NOT_ACTION_AUTHORITY':'QUARANTINED_ORIGINAL_RETAINED',nativeSQLPhysical:'NOT_RUN',oldCasesRun:0}));
}
