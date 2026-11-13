import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Recording Storage/Web Locks only, using the actual existing admission and
// controller modules. Not a real browser lock, authenticated owner or disk proof.
// Exact historical Source fixtures preserve their original pins; these are not current394/runtime authority.
const main=fileURLToPath(new URL('../test-fixtures/ci/legacy-store',import.meta.url));
for(const [path,sha] of [
 ['frontend/mobile/src/custodial/protected-browser-admission.js','ebfbbf615880151f4a620f814e1d07ff4bbe6186c1ad3161a81fedd946ce45df'],
 ['frontend/same-original-recovery-client.js','4258f569d9417a6b3a4b0e1153b753409ee2b387499c5dcd4bf9491a187270dc'],
 ['backend/src/same-original-recovery-wire.js','dc79e4f3a7f137c5ea159b1f2b909e864378497c67259f862c27cc9e233335cb']
])assert.equal(createHash('sha256').update(readFileSync(main+'/'+path)).digest('hex'),sha);
const require=createRequire(import.meta.url);
const {createSameOriginalRecoveryOriginalStore}=require('../same-original-recovery-original-store.js');
const {createProtectedBrowserAdmission,PROTECTED_BROWSER_HOLD_KEY,PROTECTED_BROWSER_LOCK}=await import(main+'/frontend/mobile/src/custodial/protected-browser-admission.js');
const {createSameOriginalRecoveryController}=require(main+'/frontend/same-original-recovery-client.js');
const wire=await import(main+'/backend/src/same-original-recovery-wire.js');
const id=n=>'97000000-0000-4000-8000-'+String(n).padStart(12,'0');
const issuer={manager_id:id(1),manager_credential_id:id(2),manager_device_id:'recording-original-owner'};
const initialOwner=()=>Object.freeze({...issuer,page_generation:1});
const stem='mz_same_original_recovery_original.v1:'+issuer.manager_id+':'+issuer.manager_credential_id+':'+issuer.manager_device_id;
const originalKey=stem+':original',intentKey=stem+':intent';
const sha=raw=>createHash('sha256').update(raw,'utf8').digest('hex');
const marker=raw=>JSON.stringify({schema:'custodial.same-original-recovery-original-intent.v1',original_request_utf8:raw,original_request_utf8_sha256:sha(raw)});
function original(n=3){return{schema:'custodial.same-original-recovery-approval-request.v1',request_id:id(n),challenge_id:id(9),
 expected_challenge_sha256:'a'.repeat(64),expected_preview_sha256:'b'.repeat(64),expected_manager_id:issuer.manager_id,
 expected_manager_credential_id:issuer.manager_credential_id,expected_manager_device_id:issuer.manager_device_id,
 decision:'AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION',manager_confirmation:'CONFIRM_THIS_SAME_ORIGINAL_ONLY'};}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};}
class RecordingStorage{
 constructor(){this.rows=new Map();this.writes=[];this.getHook=null;this.setHook=null;}
 getItem(key){if(this.getHook){const result=this.getHook(key);if(result?.override)return result.value;}return this.rows.has(key)?this.rows.get(key):null;}
 setItem(key,value){this.writes.push([key,value]);if(this.setHook&&this.setHook(key,value)===false)return;this.rows.set(key,value);}
 removeItem(){assert.fail('Store must not delete');}
 clear(){assert.fail('Store must not clear');}
}
class RecordingLocks{
 constructor(){this.tail=Promise.resolve();this.calls=[];this.active=0;}
 request(name,options,callback){this.calls.push([name,options.mode]);
  const result=this.tail.then(async()=>{if(options.signal.aborted)throw new Error('recording abort');
   assert.equal(this.active,0);this.active++;try{return await callback({name,mode:options.mode});}finally{this.active--;}});
  this.tail=result.catch(()=>{});return result;
 }
}
function fixture(){const f={storage:new RecordingStorage(),locks:new RecordingLocks(),owner:initialOwner(),mutations:[]};
 f.admission=createProtectedBrowserAdmission({storage:f.storage,locks:f.locks});
 f.options={storage:f.storage,currentOwner:()=>f.owner,mutate:(operation,options)=>{f.mutations.push(options);return f.admission.mutate(operation,options);}};
 f.fresh=()=>createSameOriginalRecoveryOriginalStore(f.options);f.store=f.fresh();
 f.seed=(request=original(),final=true)=>{const raw=JSON.stringify(request);f.storage.rows.set(intentKey,marker(raw));if(final)f.storage.rows.set(originalKey,raw);return raw;};
 return f;
}

test('required ports/immutable owner reject without raw writes or alternate lock',()=>{
 assert.throws(()=>createSameOriginalRecoveryOriginalStore(),/ports are required/);
 const f=fixture();assert.throws(()=>createSameOriginalRecoveryOriginalStore({...f.options,mutate:null}),/ports are required/);
 f.owner={...initialOwner()};assert.throws(f.fresh,/immutable_owner_required/);
 assert.equal(f.storage.writes.length,0);assert.equal(f.locks.calls.length,0);
});
test('one protected CAS writes/verifies full original intent before final and same-byte retention never overwrites',async()=>{
 const f=fixture(),request=original(),raw=JSON.stringify(request);assert.equal(await f.store.readOriginal(),null);
 await f.store.retainOriginal(request);assert.deepEqual(f.storage.writes,[[intentKey,marker(raw)],[originalKey,raw]]);
 assert.deepEqual(f.mutations,[{timeoutMs:5000}]);assert.deepEqual(f.locks.calls,[[PROTECTED_BROWSER_LOCK,'exclusive']]);
 const result=await f.store.readOriginal();assert.deepEqual(result,request);assert(Object.isFrozen(result));assert.equal(JSON.stringify(result),raw);
 await f.store.retainOriginal(request);assert.equal(f.storage.writes.length,2);assert.equal(f.locks.active,0);
});
test('competing same original callers share existing admission; exactly one pair of raw writes',async()=>{
 const f=fixture(),other=f.fresh();await Promise.all([f.store.retainOriginal(original()),other.retainOriginal(original())]);
 assert.equal(f.storage.writes.length,2);assert.equal(f.locks.calls.length,2);assert.equal(f.locks.active,0);
 assert.deepEqual(await f.fresh().readOriginal(),original());
});
test('competing different originals cannot overwrite winner or adopt another request',async()=>{
 const f=fixture(),other=f.fresh();const outcomes=await Promise.allSettled([f.store.retainOriginal(original(3)),other.retainOriginal(original(4))]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);
 assert.equal(f.storage.writes.length,2);const result=await f.fresh().readOriginal();
 assert([id(3),id(4)].includes(result.request_id));assert.equal(f.storage.rows.get(originalKey),JSON.stringify(result));
});
test('raw original field order is preserved on restart; order-changing same logical input conflicts',async()=>{
 const f=fixture(),request=Object.fromEntries(Object.entries(original()).reverse()),raw=JSON.stringify(request);
 await f.store.retainOriginal(request);const read=await f.fresh().readOriginal();assert.equal(JSON.stringify(read),raw);
 assert.deepEqual(Object.keys(read),Object.keys(request));await assert.rejects(f.fresh().retainOriginal(original()),/original_conflict/);
 assert.equal(f.storage.rows.get(originalKey),raw);assert.equal(f.storage.writes.length,2);
});
test('caller accessors/extra/inherited/wrong issuer input never reaches mutation or getter',async()=>{
 for(const shape of ['getter','extra','inherited','foreign']){const f=fixture();let getters=0,request=original();
  if(shape==='getter')Object.defineProperty(request,'decision',{enumerable:true,get(){getters++;return 'x';}});
  if(shape==='extra')request.approved=true;if(shape==='inherited')request=Object.assign(Object.create({foo:'x'}),request);
  if(shape==='foreign')request.expected_manager_id=id(99);
  await assert.rejects(f.store.retainOriginal(request));assert.equal(getters,0);assert.equal(f.mutations.length,0);assert.equal(f.storage.writes.length,0);
 }
});
test('durable marker-only interrupted save is restart-readable original-status only and cannot complete on retry',async()=>{
 const f=fixture();f.storage.setHook=key=>{if(key===originalKey)throw new Error('recording second write failed');};
 await assert.rejects(f.store.retainOriginal(original()),/storage_write_unknown/);
 assert.equal(f.storage.rows.has(originalKey),false);const raw=JSON.stringify(original());assert.equal(f.storage.rows.get(intentKey),marker(raw));
 f.storage.setHook=null;const restart=f.fresh();assert.equal(JSON.stringify(await restart.readOriginal()),raw);
 const before=f.storage.rows.get(intentKey),count=f.storage.writes.length;
 await assert.rejects(restart.retainOriginal(original()),/intent_status_only/);
 assert.equal(f.storage.rows.get(intentKey),before);assert.equal(f.storage.rows.has(originalKey),false);assert.equal(f.storage.writes.length,count);
});
test('first write/error or silent storage failure latches uncertainty, never a successful empty read',async()=>{
 for(const mode of ['throw','silent']){const f=fixture();f.storage.setHook=()=>{if(mode==='throw')throw new Error('recording first write error');return false;};
  await assert.rejects(f.store.retainOriginal(original()));const count=f.storage.writes.length;
  await assert.rejects(f.store.readOriginal());await assert.rejects(f.store.retainOriginal(original(4)));
  assert.equal(f.storage.writes.length,count);assert.equal(f.storage.rows.size,0);
 }
});
test('storage read error/undefined after an empty observation is latched rather than treated as missing',async()=>{
 for(const mode of ['error','undefined']){const f=fixture();assert.equal(await f.store.readOriginal(),null);
  f.storage.getHook=()=>{if(mode==='error')throw new Error('recording read error');return{override:true,value:undefined};};
  await assert.rejects(f.store.readOriginal(),/storage_read/);f.storage.getHook=null;
  await assert.rejects(f.store.readOriginal());await assert.rejects(f.store.retainOriginal(original()));assert.equal(f.storage.writes.length,0);
 }
});
test('original/intent missing after observation remains held even if rows later reappear',async()=>{
 for(const key of [originalKey,intentKey]){const f=fixture();f.seed();await f.store.readOriginal();const before=f.storage.rows.get(key);
  f.storage.rows.delete(key);await assert.rejects(f.store.readOriginal(),/missing_after_observation/);
  f.storage.rows.set(key,before);await assert.rejects(f.store.readOriginal());assert.equal(f.storage.writes.length,0);
 }
});
test('duplicate/escaped/extra/foreign/noncanonical original rows remain byte-exact held, never adopted',async()=>{
 const request=original(),raw=JSON.stringify(request);
 const variants=[raw.replace('"schema":','"schema":"duplicate","schema":'),raw.replace('schema','\\u0073chema'),
  raw.slice(0,-1)+',"extra":true}',JSON.stringify({...request,expected_manager_id:id(99)}),' '+raw];
 for(const value of variants){const f=fixture();f.storage.rows.set(intentKey,marker(value));f.storage.rows.set(originalKey,value);
  await assert.rejects(f.store.readOriginal());assert.equal(f.storage.rows.get(originalKey),value);
  await assert.rejects(f.store.retainOriginal(request));assert.equal(f.storage.rows.get(intentKey),marker(value));assert.equal(f.storage.writes.length,0);
 }
});
test('corrupt/escaped/foreign/checksum mismatched markers and legacy final-only row refuse without repair',async()=>{
 const raw=JSON.stringify(original()),good=marker(raw),parsed=JSON.parse(good);
 const variants=['{broken',good.replace('schema','\\u0073chema'),JSON.stringify({...parsed,original_request_utf8_sha256:'f'.repeat(64)}),
  JSON.stringify({...parsed,extra:false}),marker(JSON.stringify({...original(),expected_manager_device_id:'foreign'})),null];
 for(const value of variants){const f=fixture();f.storage.rows.set(originalKey,raw);if(value!==null)f.storage.rows.set(intentKey,value);
  await assert.rejects(f.store.readOriginal());assert.equal(f.storage.rows.get(originalKey),raw);assert.equal(f.storage.writes.length,0);
 }
});
test('raw mutation during checksum await refuses and preserves changed rows rather than cached success',async()=>{
 const f=fixture();f.seed();const work=f.store.readOriginal(),changed=JSON.stringify(original(4));
 f.storage.rows.set(originalKey,changed);await assert.rejects(work,/original_changed/);
 assert.equal(f.storage.rows.get(originalKey),changed);assert.equal(f.storage.writes.length,0);
});
test('owner/epoch drift during digest refuses before protected mutate; successor cannot reuse store',async()=>{
 for(const field of ['manager_id','manager_credential_id','manager_device_id','page_generation']){
  const f=fixture(),work=f.store.retainOriginal(original());f.owner=Object.freeze({...initialOwner(),[field]:field==='page_generation'?2:field==='manager_device_id'?'new-device':id(99)});
  await assert.rejects(work,/owner_changed/);f.owner=initialOwner();await assert.rejects(f.store.readOriginal(),/owner_changed/);
  assert.equal(f.mutations.length,0);assert.equal(f.storage.writes.length,0);
 }
});
test('owner loss while actual admission waits for its shared lock causes zero callback writes',async()=>{
 const f=fixture(),entered=deferred(),release=deferred(),queued=deferred();
 const blocker=f.admission.mutate(async()=>{entered.resolve();await release.promise;});await entered.promise;
 const real=f.options.mutate;f.options.mutate=(operation,options)=>{queued.resolve();return real(operation,options);};const store=f.fresh();
 const work=store.retainOriginal(original());await queued.promise;f.owner=null;release.resolve();await blocker;
 await assert.rejects(work,/owner_unavailable/);assert.equal(f.storage.writes.length,0);assert.equal(f.locks.active,0);
});
test('owner loss after marker write prevents final write and preserves marker for same-issuer new-generation status',async()=>{
 const f=fixture();f.storage.setHook=key=>{if(key===intentKey)f.owner=Object.freeze({...issuer,page_generation:2});};
 await assert.rejects(f.store.retainOriginal(original()),/owner_changed/);assert.equal(f.storage.rows.has(originalKey),false);
 assert.equal(f.storage.rows.get(intentKey),marker(JSON.stringify(original())));f.storage.setHook=null;
 assert.deepEqual(await f.fresh().readOriginal(),original());assert.equal(f.storage.writes.length,1);
});
test('owner loss during final write rejects retention success while keeping exact pair for status',async()=>{
 const f=fixture();f.storage.setHook=key=>{if(key===originalKey)f.owner=Object.freeze({...issuer,page_generation:2});};
 await assert.rejects(f.store.retainOriginal(original()),/owner_changed/);f.storage.setHook=null;
 assert.deepEqual(await f.fresh().readOriginal(),original());assert.equal(f.storage.writes.length,2);
});
test('changed storage methods and skipped mutation callbacks are unavailable, not substitute admission',async()=>{
 const f=fixture();const work=f.store.retainOriginal(original());f.storage.setItem=()=>assert.fail('Successor setter must not run');
 await assert.rejects(work,/storage_interface_changed/);assert.equal(f.storage.writes.length,0);
 const g=fixture(),store=createSameOriginalRecoveryOriginalStore({...g.options,mutate:async()=>{}});
 await assert.rejects(store.retainOriginal(original()),/mutation_not_entered/);assert.equal(g.storage.writes.length,0);
});
test('existing actual admission preservation hold prevents writes; read-only original inspection does not erase hold',async()=>{
 const f=fixture();f.seed();const originalRaw=f.storage.rows.get(originalKey);f.storage.rows.set(PROTECTED_BROWSER_HOLD_KEY,'recording hold');
 assert.deepEqual(await f.store.readOriginal(),original());await assert.rejects(f.store.retainOriginal(original()),/mutation_unconfirmed/);
 assert.equal(f.storage.rows.get(originalKey),originalRaw);assert.equal(f.storage.rows.get(PROTECTED_BROWSER_HOLD_KEY),'recording hold');assert.equal(f.storage.writes.length,0);
});

function reviewDocument(){const p={schema:'custodial.same-original-recovery-review.v1',state:'ORIGINAL_BINDING_REVIEW_ONLY',purpose:original().decision,
 challenge_id:id(9),challenge_sha256:'a'.repeat(64),preview_sha256:'b'.repeat(64),expires_at:'2026-10-14T00:05:00.000000Z',
 limits:{inventory_acknowledged:false,work_accepted:false,replay_allowed:false,finalizer_allowed:false,key_removal:false,phone_released:false},
 original_target:{operation_id:id(11),separation_id:id(12),separation_authority_revision:'7',canonical_device_pk:id(13),canonical_device_id:'KIOSK_08',
 employee_id:id(14),credential_id:id(15),assignment_epoch:'7',original_generation_id:id(16),original_credential_secret_key_id:'a'.repeat(64),
 principal_digest:'a'.repeat(64),engine_revision:'0',original_wire_sha256:'a'.repeat(64),original_frozen_work_sha256:'a'.repeat(64),capsule_sha256:'a'.repeat(64),
 record_sha256:'a'.repeat(64),frame_sha256:'a'.repeat(64),plan_sha256:'a'.repeat(64),aad_binding_sha256:'a'.repeat(64),source_capture_sha256:'a'.repeat(64),
 values_sha256:'a'.repeat(64),semantic_join_sha256:'a'.repeat(64),layout_sha256:'a'.repeat(64)}};p.preview_sha256=wire.recoveryDocumentSha256('preview',p);return p;}
test('new store/controller join has exact durable pair before its single approval POST and status does not resend',async()=>{
 const f=fixture(),p=reviewDocument(),calls=[];
 const controller=createSameOriginalRecoveryController({currentOwner:f.options.currentOwner,...f.store,request:async call=>{
  calls.push(call);if(call.method==='GET')return p;
  assert.equal(f.storage.rows.get(originalKey),JSON.stringify(call.body));assert.equal(f.storage.rows.get(intentKey),marker(JSON.stringify(call.body)));
  throw new Error('recording uncertain HTTP reply');}});
 await controller.review(id(9));assert.equal((await controller.confirm()).state,'UNKNOWN');const raw=f.storage.rows.get(originalKey);
 assert.equal(calls.filter(c=>c.path.endsWith('/approvals')).length,1);await controller.resume();
 assert.equal(calls.filter(c=>c.path.endsWith('/approvals')).length,1);assert.equal(calls.filter(c=>c.path.endsWith('/original-status')).length,1);
 assert.equal(f.storage.rows.get(originalKey),raw);assert.equal(f.storage.writes.length,2);
});
test('interrupted marker/controller restart invokes only status, never a new approval or final write',async()=>{
 const f=fixture();const raw=f.seed(original(),false),calls=[];
 const controller=createSameOriginalRecoveryController({currentOwner:f.options.currentOwner,...f.store,
  request:async call=>{calls.push(call);return{state:'UNKNOWN'};}});
 assert.equal((await controller.review(id(9))).state,'HELD');assert.equal(calls.length,0);
 assert.equal((await controller.resume()).state,'UNKNOWN');assert.equal(calls.length,1);assert(calls[0].path.endsWith('/original-status'));
 assert.equal(JSON.stringify(calls[0].body),raw);assert.equal(f.storage.rows.has(originalKey),false);assert.equal(f.storage.writes.length,0);
});
