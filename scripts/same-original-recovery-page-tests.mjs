import registerTest from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

// Selected Device Security composition only. Exit before historical source
// pins/registrations: those receipts and old member bodies remain unchanged.
if(Boolean(process.argv[1])&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url
 &&process.argv.includes('--inventory-separation-security-page-only')){
 await inventorySeparationDeviceSecurityPageCase(process.argv.at(-1));
 process.exit(0);
}

export const sameOriginalPageHttpSqlJoinSelector='--same-original-page-http-sql-join-only';
const direct=Boolean(process.argv[1])&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
const joinedOnly=process.argv.includes(sameOriginalPageHttpSqlJoinSelector);
// Importing the explicit workflow never registers/runs historical test members.
const test=(...args)=>{if(direct&&!joinedOnly)return registerTest(...args);};

// Actual source composition in the browser UMD entry, recording DOM/Storage/
// Web Locks + synthetic request ports only. No copied controller/panel/store,
// authenticated manager, real browser, SQL, native or production effects.
// Exact historical Source fixtures preserve their original pins; these are not current394/runtime authority.
const main=fileURLToPath(new URL('../test-fixtures/ci/legacy-page',import.meta.url));
for(const [file,sha] of [
 ['frontend/same-original-recovery-client.js','4258f569d9417a6b3a4b0e1153b753409ee2b387499c5dcd4bf9491a187270dc'],
 ['frontend/same-original-recovery-panel.js','f1c9d26178ad9272fc767fbaa32d00fcf80c8f560b2bfcf61edc45d597fca3cf'],
 ['frontend/same-original-recovery-original-store.js','75e256a0a8f8e50f301b1523d06555647a80ae0d51ed9af7ba82b4493ff3a6bb'],
 ['frontend/same-original-recovery-page.js','92dbf9570bab05eb7d7033dda0742e5459541df0ce977198275b482c95139520'],
 // f6604c9 changed this owning page to bind admission to its private raw
 // adapter. Keep all unrelated inputs pinned; qualify that actual page here.
 ['frontend/device-security.html','6c1657bfe626acc6513fe0466dac375cb3f9d1b64daeb7a9d34031d347703f39'],
 // Owning completion workflow consumes the durable mutation epoch and private
 // writer admission added in303a5f2; historical receipts remain at their source.
 ['frontend/mobile/src/custodial/storage-firewall.js','961a4b0750906c19974c44d2ce395ad25f5920002c55044c190860be46436b2c'],
 // fa09ba4 factors capture and adds read-only existing-hold capture. The
 // mutate/holdAndObserve page paths are unchanged; use the current owner,
 // not a stale pin that aborts before the actual joined workflow starts.
 ['frontend/mobile/src/custodial/protected-browser-admission.js','171fd162a1b0f9d0a7971bf4351defab67614eef0adbca0c8dc9c78a480caa6b'],
 ['backend/src/same-original-recovery-wire.js','bc99757cce04e17ac0010169047498d35e71308dad2412aee2e885292bad62e7']
])assert.equal(createHash('sha256').update(readFileSync(main+'/'+file)).digest('hex'),sha);
const require=createRequire(import.meta.url);
const client=require(main+'/frontend/same-original-recovery-client.js');
const panel=require(main+'/frontend/same-original-recovery-panel.js');
const originalStore=require(main+'/frontend/same-original-recovery-original-store.js');
const context=vm.createContext({Object,Reflect,Number,Error,
 MemphisSameOriginalRecovery:client,MemphisSameOriginalRecoveryPanel:panel,MemphisSameOriginalRecoveryOriginalStore:originalStore});
vm.runInContext(readFileSync(main+'/frontend/same-original-recovery-page.js','utf8'),context,{filename:'same-original-recovery-page.js'});
const {mountSameOriginalRecoveryPage}=context.MemphisSameOriginalRecoveryPage;
const {createProtectedBrowserAdmission,PROTECTED_BROWSER_HOLD_KEY,PROTECTED_BROWSER_MUTATION_KEY}=await import(main+'/frontend/mobile/src/custodial/protected-browser-admission.js');
const {CUSTODIAL_PROTECTED_STORAGE_PREFIXES}=await import(main+'/frontend/mobile/src/custodial/storage-firewall.js');
assert(CUSTODIAL_PROTECTED_STORAGE_PREFIXES.includes('mz_same_original_recovery_original.v1:'));
const wire=await import(main+'/backend/src/same-original-recovery-wire.js');
const id=n=>'98000000-0000-4000-8000-'+String(n).padStart(12,'0');
const issuer={manager_id:id(1),manager_credential_id:id(2),manager_device_id:'recording-page-owner'};
const stem='mz_same_original_recovery_original.v1:'+issuer.manager_id+':'+issuer.manager_credential_id+':'+issuer.manager_device_id;
const originalKey=stem+':original',intentKey=stem+':intent';
const PATH='/admin-api/device-security/same-original-recovery/';
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};}
class Element{
 constructor(){this.value='';this.disabled=false;this.hidden=false;this.textContent='';this.listeners=new Map();}
 set innerHTML(_){assert.fail('Composition must not render HTML');}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 async emit(type,force=false){if(type==='click'&&this.disabled&&!force)return;
  await Promise.all([...(this.listeners.get(type)||[])].map(fn=>fn({preventDefault(){}})));}
 count(){return [...this.listeners.values()].reduce((n,s)=>n+s.size,0);}
}
class RecordingRoot extends Element{
 constructor(){super();this.nodes=new Map(['Challenge','Review','Confirm','Status','Summary','Message'].map(n=>['sameOriginal'+n,new Element()]));this.addHook=null;}
 querySelector(selector){return this.nodes.get(selector.slice(1))||null;}
 node(name){return this.nodes.get('sameOriginal'+name);}
 addEventListener(type,fn){super.addEventListener(type,fn);if(this.addHook)this.addHook();}
 total(){return this.count()+[...this.nodes.values()].reduce((n,e)=>n+e.count(),0);}
}
class RecordingStorage{
 constructor(){this.rows=new Map();this.writes=[];this.getHook=null;this.setHook=null;}
 getItem(key){if(this.getHook)this.getHook(key);return this.rows.has(key)?this.rows.get(key):null;}
 setItem(key,value){if(this.setHook)this.setHook(key,value);this.writes.push([key,value]);this.rows.set(key,value);}
 removeItem(){assert.fail('No deletion');}
 clear(){assert.fail('No clear');}
}
class RecordingLocks{
 constructor(){this.tail=Promise.resolve();this.active=0;}
 request(name,options,callback){const work=this.tail.then(async()=>{
  if(options.signal.aborted)throw new Error('Recording abort');assert.equal(this.active,0);this.active++;
  try{return await callback({name,mode:options.mode});}finally{this.active--;}});this.tail=work.catch(()=>{});return work;}
}
function preview(){const p={schema:'custodial.same-original-recovery-review.v1',state:'ORIGINAL_BINDING_REVIEW_ONLY',
 purpose:'AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION',challenge_id:id(9),challenge_sha256:'a'.repeat(64),preview_sha256:'b'.repeat(64),
 expires_at:'2026-10-14T00:05:00.000000Z',limits:{inventory_acknowledged:false,work_accepted:false,replay_allowed:false,finalizer_allowed:false,key_removal:false,phone_released:false},
 original_target:{operation_id:id(11),separation_id:id(12),separation_authority_revision:'7',canonical_device_pk:id(13),canonical_device_id:'KIOSK_08',
 employee_id:id(14),credential_id:id(15),assignment_epoch:'7',original_generation_id:id(16),original_credential_secret_key_id:'a'.repeat(64),principal_digest:'a'.repeat(64),engine_revision:'0',
 original_wire_sha256:'a'.repeat(64),original_frozen_work_sha256:'a'.repeat(64),capsule_sha256:'a'.repeat(64),record_sha256:'a'.repeat(64),frame_sha256:'a'.repeat(64),plan_sha256:'a'.repeat(64),
 aad_binding_sha256:'a'.repeat(64),source_capture_sha256:'a'.repeat(64),values_sha256:'a'.repeat(64),semantic_join_sha256:'a'.repeat(64),layout_sha256:'a'.repeat(64)}};
 p.preview_sha256=wire.recoveryDocumentSha256('preview',p);return p;}
function saved(p){return{schema:'custodial.same-original-recovery-approval-request.v1',request_id:id(3),challenge_id:p.challenge_id,
 expected_challenge_sha256:p.challenge_sha256,expected_preview_sha256:p.preview_sha256,expected_manager_id:issuer.manager_id,
 expected_manager_credential_id:issuer.manager_credential_id,expected_manager_device_id:issuer.manager_device_id,
 decision:p.purpose,manager_confirmation:'CONFIRM_THIS_SAME_ORIGINAL_ONLY'};}
function receipt(request,p){const r={schema:'custodial.same-original-recovery-approval-receipt.v1',state:'APPROVAL_RECORDED_ONLY',approval_id:id(10),
 original_request:structuredClone(request),original_request_sha256:wire.recoveryDocumentSha256('request',request),issuer:{...issuer},
 challenge_sha256:p.challenge_sha256,preview_sha256:p.preview_sha256,original_target:structuredClone(p.original_target),purpose_admission_id:'same-original-preparation.v1',
 issued_at:'2026-10-14T00:00:00.000000Z',expires_at:p.expires_at,receipt_sha256:'a'.repeat(64),retry_safe:false,limits:{...p.limits}};
 r.receipt_sha256=wire.recoveryDocumentSha256('receipt',r);return r;}
function fixture(){const f={root:new RecordingRoot(),storage:new RecordingStorage(),locks:new RecordingLocks(),owner:Object.freeze({...issuer,page_generation:1}),owns:true,
 p:preview(),r:null,calls:[],requestHook:null,disposer:null};
 f.admission=createProtectedBrowserAdmission({storage:f.storage,locks:f.locks});
 f.ports={root:f.root,storage:f.storage,currentOwner:()=>f.owner,mutate:f.admission.mutate,ownsPage:()=>f.owns,
  request:async call=>{f.calls.push({call,listeners:f.root.total()});if(f.requestHook)return f.requestHook(call);
   if(call.method==='GET')return structuredClone(f.p);
   if(call.path===PATH+'approvals'){f.r=receipt(call.body,f.p);return structuredClone(f.r);}
   assert.equal(call.path,PATH+'approvals/original-status');return f.r?structuredClone(f.r):{state:'UNKNOWN'};}};
 f.seed=async partial=>{const request=saved(f.p);const producer=originalStore.createSameOriginalRecoveryOriginalStore(f.ports);
  if(partial)f.storage.setHook=key=>{if(key===originalKey)throw new Error('Recording interrupted save');};
  if(partial)await assert.rejects(producer.retainOriginal(request));else await producer.retainOriginal(request);
  f.storage.setHook=null;f.r=receipt(request,f.p);return request;};
 f.mount=async()=>{f.disposer=await mountSameOriginalRecoveryPage(f.ports);return f.disposer;};
 f.click=(n,force=false)=>f.root.node(n).emit('click',force);
 f.review=async()=>{f.root.node('Challenge').value=id(9);await f.click('Review');};
 f.approvals=()=>f.calls.filter(c=>c.call.path===PATH+'approvals');f.status=()=>f.calls.filter(c=>c.call.path===PATH+'approvals/original-status');
 f.noDom=()=>{assert.equal(f.root.total(),0);assert.equal(f.root.node('Summary').textContent,'');assert(f.root.node('Summary').hidden);
  assert.equal(f.root.node('Challenge').value,'');for(const n of ['Challenge','Review','Confirm','Status'])assert(f.root.node(n).disabled,n);};
 return f;
}

/** ONE source DOM/storage/Web Locks -> Main-supplied actual manager transport
 * join. No fabricated preview/receipt/authentication/session or server rows.
 * Main alone binds bounded HTTP, current authenticated fixture rights and SQL.
 * Recording DOM/locks/storage are not a genuine browser or named human proof.
 */
export async function sameOriginalRecoveryPageHttpSqlJoin({request,currentOwner,challengeId}={}){
 assert.equal(typeof request,'function','Main bounded guarded request port required');
 assert.equal(typeof currentOwner,'function','Main current authenticated fixture owner port required');
 assert.equal(typeof challengeId,'string');
 assert.match(challengeId,/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.equal(typeof globalThis.crypto?.randomUUID,'function','Normal WebCrypto required; no substitute');
 assert.equal(typeof globalThis.crypto?.subtle?.digest,'function','Normal WebCrypto required; no substitute');
 const fields=['manager_id','manager_credential_id','manager_device_id','page_generation'];
 function ownerSnapshot(){
  const live=currentOwner();assert(live&&Object.getPrototypeOf(live)===Object.prototype&&Object.isFrozen(live));
  const keys=Reflect.ownKeys(live);assert.equal(keys.length,4);assert(keys.every(k=>fields.includes(k)));
  const copy={};for(const k of fields){const d=Object.getOwnPropertyDescriptor(live,k);assert(d&&Object.hasOwn(d,'value')&&d.enumerable);copy[k]=d.value;}
  return {live,copy:Object.freeze(copy)};
 }
 const bound=ownerSnapshot().copy;
 function current(){const now=ownerSnapshot();assert.deepEqual(now.copy,bound,'Original current owner changed');return now.live;}
 const keyStem='mz_same_original_recovery_original.v1:'+bound.manager_id+':'+bound.manager_credential_id+':'+bound.manager_device_id;
 const original=keyStem+':original',intent=keyStem+':intent';
 const storage=new RecordingStorage(),locks=new RecordingLocks();
 const admission=createProtectedBrowserAdmission({storage,locks});
 const calls=[],pages=[];let primary=null,originalUtf8=null,stagedRows=null;
 const count=path=>calls.filter(row=>row.call.path===PATH+path).length;
 function sameRows(){if(stagedRows!==null)assert.deepEqual([...storage.rows],stagedRows,'Original raw rows changed');}
 function noAuthority(value){assert.deepEqual(value.limits,wire.recoveryDeniedEffects);assert.equal(value.retry_safe,false);}
 function summaryMatches(root,review){const t=review.original_target,s=root.node('Summary');assert.equal(s.hidden,false);
  for(const value of [wire.recoveryPreparationPurpose,t.canonical_device_id,t.canonical_device_pk,t.employee_id,t.operation_id,t.original_generation_id,
   t.capsule_sha256,t.source_capture_sha256,review.expires_at])assert(s.textContent.includes(value));}
 function quiet(root){assert.equal(root.total(),0);assert.equal(root.node('Summary').textContent,'');assert(root.node('Summary').hidden);
  assert.equal(root.node('Challenge').value,'');for(const name of ['Challenge','Review','Confirm','Status'])assert(root.node(name).disabled);}
 async function mount(){
  current();const page={root:new RecordingRoot(),owned:true,dispose:null};pages.push(page);
  page.dispose=await mountSameOriginalRecoveryPage({root:page.root,storage,currentOwner:current,mutate:admission.mutate,
   ownsPage:()=>{try{current();return page.owned;}catch{return false;}},request:async call=>{
    current();assert.equal(locks.active,0,'HTTP must not hold the protected storage lock');
    const review=call.method==='GET'&&call.path===PATH+'challenges/'+challengeId;
    const confirm=call.method==='POST'&&call.path===PATH+'approvals';
    const status=call.method==='POST'&&call.path===PATH+'approvals/original-status';
    assert(review||confirm||status,'Unexpected transport operation');
    if(confirm||status){
     wire.validateRecoveryApprovalRequest(call.body);
     const raw=JSON.stringify(call.body);assert.equal(storage.getItem(original),raw,'Exact original must precede transport');
     const marker=JSON.parse(storage.getItem(intent));assert.equal(marker.original_request_utf8,raw);
     assert.equal(marker.original_request_utf8_sha256,createHash('sha256').update(raw).digest('hex'));
     if(confirm){assert.equal(count('approvals'),0,'Only ONE original confirmation');originalUtf8=raw;stagedRows=[...storage.rows];}
     else{assert.equal(raw,originalUtf8,'Status must read the SAME original');sameRows();}
    }
    const row={call,listeners:page.root.total(),response:null};calls.push(row);
    // Preserve Main's exact body and returned DTO. Unknown/error is not a
    // manufactured receipt; the actual controller decides its held state.
    row.response=await request(call);current();sameRows();return row.response;
   }});
  current();return page;
 }
 function close(page){if(!page)return;page.owned=false;const dispose=page.dispose;page.dispose=null;if(dispose)dispose();quiet(page.root);sameRows();}
 try{
  const first=await mount();assert.equal(calls.length,0);assert.equal(storage.writes.length,0);
  first.root.node('Challenge').value=challengeId;await first.root.node('Challenge').emit('input');current();
  await first.root.node('Review').emit('click');current();
  assert.equal(calls.length,1);assert.equal(first.root.node('Confirm').disabled,false,'Actual review did not enable confirmation');
  const review=wire.validateRecoveryPreview(calls[0].response);assert.equal(review.challenge_id,challengeId);
  assert.deepEqual(review.limits,wire.recoveryDeniedEffects);summaryMatches(first.root,review);
  await first.root.node('Confirm').emit('click');current();
  assert.equal(count('approvals'),1);assert(originalUtf8!==null);sameRows();
  assert.match(first.root.node('Message').textContent,/Preparation recorded ONLY/,'Actual confirmation remains unknown/held');
  const confirmRow=calls.find(row=>row.call.path===PATH+'approvals'),recorded=wire.validateRecoveryApprovalReceipt(confirmRow.response);
  noAuthority(recorded);assert.deepEqual(recorded.original_request,JSON.parse(originalUtf8));
  assert.deepEqual(recorded.original_target,review.original_target);assert.equal(recorded.challenge_sha256,review.challenge_sha256);
  assert.equal(recorded.preview_sha256,review.preview_sha256);summaryMatches(first.root,recorded);
  await first.root.node('Status').emit('click');current();sameRows();
  assert.equal(count('approvals/original-status'),1);
  const status=wire.validateRecoveryApprovalReceipt(calls.at(-1).response);noAuthority(status);assert.deepEqual(status,recorded);
  assert.match(first.root.node('Message').textContent,/Preparation recorded ONLY/);close(first);
  const writes=storage.writes.length,second=await mount();current();sameRows();
  assert.equal(count('approvals/original-status'),2);assert.equal(calls.at(-1).listeners,0,'Hydration status must precede listeners');
  noAuthority(wire.validateRecoveryApprovalReceipt(calls.at(-1).response));assert.deepEqual(calls.at(-1).response,status);
  assert.equal(storage.writes.length,writes);assert(second.root.node('Review').disabled);assert(second.root.node('Confirm').disabled);
  assert.equal(second.root.node('Status').disabled,false);assert.match(second.root.node('Message').textContent,/Preparation recorded ONLY/);
  const before=calls.length;await second.root.node('Review').emit('click',true);await second.root.node('Confirm').emit('click',true);
  current();sameRows();assert.equal(calls.length,before,'Remount cannot review or confirm a replacement');
  assert.equal(count('approvals'),1);assert.equal(calls.filter(row=>row.call.method==='GET').length,1);close(second);
  assert.equal(locks.active,0);
  return Object.freeze({schema:'custodial.test.same-original-page-http-sql-join.v1',classification:'SOURCE_DOM_WITH_MAIN_SUPPLIED_FIXTURE_PORTS',
   review_count:1,confirmation_count:1,original_status_count:2,original_request_utf8:originalUtf8,
   original_request_sha256:recorded.original_request_sha256,approval_id:recorded.approval_id,challenge_id:challengeId,
   preview_sha256:recorded.preview_sha256,receipt_sha256:recorded.receipt_sha256,server_expires_at:recorded.expires_at,
   issuer:recorded.issuer,original_target:recorded.original_target,limits:recorded.limits,original_rows_retained:true,
   note:'Main must bind actual HTTP/SQL/auth evidence; this recording DOM is not a genuine manager/browser/native approval.'});
 }catch(error){primary=error;
  try{error.joinEvidence={confirmation_count:count('approvals'),status_count:count('approvals/original-status'),
   original_request_utf8:originalUtf8,original_rows:[...storage.rows],messages:pages.map(page=>page.root.node('Message').textContent)};}catch{}
  throw error;
 }finally{
  for(const page of pages)try{close(page);}catch(cleanup){if(primary){try{(primary.cleanupErrors??=[]).push(cleanup);}catch{}}else throw cleanup;}
 }
}

test('empty original hydrates IDLE with zero status/intent/UUID effects before listeners',async()=>{
 const f=fixture();await f.mount();assert.equal(f.calls.length,0);assert.equal(f.storage.writes.length,0);assert.equal(f.storage.rows.size,0);
 assert(f.root.total()>0);assert.equal(f.root.node('Review').disabled,false);assert(f.root.node('Confirm').disabled);assert(f.root.node('Status').disabled);
 assert.match(f.root.node('Message').textContent,/Enter the exact original challenge/);f.disposer();f.noDom();
});
test('saved original performs exact status before panel listener mount; review/confirm stay disabled',async()=>{
 const f=fixture(),request=await f.seed(false),rows=[...f.storage.rows];await f.mount();assert.equal(f.status().length,1);
 assert.equal(f.status()[0].listeners,0);assert.deepEqual(f.status()[0].call.body,request);assert.equal(f.approvals().length,0);
 assert.deepEqual([...f.storage.rows],rows);assert(f.root.node('Review').disabled);assert(f.root.node('Confirm').disabled);assert.equal(f.root.node('Status').disabled,false);
 assert.match(f.root.node('Message').textContent,/Preparation recorded ONLY/);await f.click('Review',true);await f.click('Confirm',true);assert.equal(f.calls.length,1);
 f.disposer();f.noDom();assert.deepEqual([...f.storage.rows],rows);
});
test('marker-only saved original hydrates status-only with no final-row repair or new confirmation',async()=>{
 const f=fixture(),request=await f.seed(true),marker=f.storage.rows.get(intentKey),writes=f.storage.writes.length;f.r=null;await f.mount();
 assert.equal(f.status().length,1);assert.equal(f.status()[0].listeners,0);assert.deepEqual(f.status()[0].call.body,request);
 assert.equal(f.storage.rows.has(originalKey),false);assert.equal(f.storage.rows.get(intentKey),marker);assert.equal(f.storage.writes.length,writes);
 assert.match(f.root.node('Message').textContent,/Outcome unknown/);assert(f.root.node('Review').disabled);assert(f.root.node('Confirm').disabled);
 await f.click('Confirm',true);await f.click('Review',true);assert.equal(f.approvals().length,0);f.disposer();f.noDom();
});
test('deferred original-status hydration has no listeners until exact reply settles',async()=>{
 const f=fixture();await f.seed(false);const entered=deferred(),reply=deferred();f.requestHook=async()=>{entered.resolve();await reply.promise;return f.r;};
 const mounting=f.mount();await entered.promise;f.noDom();reply.resolve();await mounting;assert(f.root.total()>0);assert.equal(f.status().length,1);f.disposer();
});
test('exact owner manager/credential/device/page-generation change across status await rejects mount without row changes',async()=>{
 for(const field of ['manager_id','manager_credential_id','manager_device_id','page_generation']){
  const f=fixture();await f.seed(false);const rows=[...f.storage.rows],entered=deferred(),reply=deferred();
  f.requestHook=async()=>{entered.resolve();await reply.promise;return f.r;};const mounting=f.mount();await entered.promise;
  f.owner=Object.freeze({...f.owner,[field]:field==='page_generation'?2:field==='manager_device_id'?'changed-device':id(99)});
  reply.resolve();await assert.rejects(mounting,/mount_unconfirmed/);f.noDom();assert.deepEqual([...f.storage.rows],rows);assert.equal(f.approvals().length,0);
 }
});
test('ownsPage loss across status await rejects mount and cannot publish accepted-looking response',async()=>{
 const f=fixture();await f.seed(false);const rows=[...f.storage.rows],entered=deferred(),reply=deferred();
 f.requestHook=async()=>{entered.resolve();await reply.promise;return f.r;};const mounting=f.mount();await entered.promise;
 f.owns=false;reply.resolve();await assert.rejects(mounting,/mount_unconfirmed/);f.noDom();assert.deepEqual([...f.storage.rows],rows);
 assert.equal(f.root.node('Message').textContent.includes('recorded ONLY'),false);
});
test('owner or page loss during initial retained read performs no status and adds no DOM',async()=>{
 for(const kind of ['owner','page']){const f=fixture();await f.seed(false);const rows=[...f.storage.rows];let once=false;
  f.storage.getHook=key=>{if(key===originalKey&&!once){once=true;if(kind==='owner')f.owner=null;else f.owns=false;}};
  await assert.rejects(f.mount(),/mount_unconfirmed/);f.noDom();assert.equal(f.calls.length,0);assert.deepEqual([...f.storage.rows],rows);
 }
});
test('corrupt/foreign original or ambiguous read rejects hydration before any listener or HTTP',async()=>{
 for(const mode of ['corrupt','foreign','read']){const f=fixture();await f.seed(false);
  if(mode==='corrupt')f.storage.rows.set(originalKey,'{broken');
  if(mode==='foreign')f.storage.rows.set(originalKey,JSON.stringify({...saved(f.p),expected_manager_id:id(99)}));
  if(mode==='read')f.storage.getHook=()=>{throw new Error('Recording ambiguous read');};
  const rows=[...f.storage.rows];await assert.rejects(f.mount(),/mount_unconfirmed/);f.noDom();assert.equal(f.calls.length,0);assert.deepEqual([...f.storage.rows],rows);
 }
});
test('failed status transport closes hydration without listeners, retry or private error rendering',async()=>{
 const f=fixture();await f.seed(false);const rows=[...f.storage.rows];f.requestHook=()=>{throw new Error('private-error-token');};
 await assert.rejects(f.mount(),/mount_unconfirmed/);f.noDom();assert.equal(f.status().length,1);assert.equal(f.approvals().length,0);
 assert.equal(f.root.node('Message').textContent.includes('private-error-token'),false);assert.deepEqual([...f.storage.rows],rows);
});
test('all ports required and readonly page unavailable; no fallback authority or storage writes',async()=>{
 for(const port of ['storage','currentOwner','mutate','request','ownsPage']){const f=fixture();
  await assert.rejects(mountSameOriginalRecoveryPage({...f.ports,[port]:null}),/ports_unavailable/);f.noDom();assert.equal(f.calls.length,0);assert.equal(f.storage.writes.length,0);
 }
 const f=fixture();f.owns=false;await assert.rejects(f.mount(),/mount_unconfirmed/);f.noDom();assert.equal(f.calls.length,0);
});
test('actual three-module user confirmation persists exact pair BEFORE one approval POST',async()=>{
 const f=fixture();await f.mount();await f.review();f.requestHook=call=>{
  assert.equal(call.path,PATH+'approvals');assert.equal(f.storage.rows.get(originalKey),JSON.stringify(call.body));
  const marker=JSON.parse(f.storage.rows.get(intentKey));assert.equal(marker.original_request_utf8,JSON.stringify(call.body));
  assert.equal(marker.original_request_utf8_sha256,createHash('sha256').update(marker.original_request_utf8).digest('hex'));
  f.r=receipt(call.body,f.p);return f.r;};
 await f.click('Confirm');const rows=[...f.storage.rows];assert.equal(f.approvals().length,1);assert.match(f.root.node('Message').textContent,/Preparation recorded ONLY/);
 await f.click('Confirm',true);assert.equal(f.approvals().length,1);f.disposer();f.disposer();f.noDom();assert.deepEqual([...f.storage.rows],rows);
});
test('actual current admission hold blocks new intent/POST and preserves its existing hold',async()=>{
 const f=fixture();f.storage.rows.set(PROTECTED_BROWSER_HOLD_KEY,'recording current hold');await f.mount();await f.review();await f.click('Confirm');
 assert.equal(f.storage.writes.length,0);assert.equal(f.storage.rows.has(originalKey),false);assert.equal(f.storage.rows.has(intentKey),false);
 assert.equal(f.approvals().length,0);assert.equal(f.storage.rows.get(PROTECTED_BROWSER_HOLD_KEY),'recording current hold');f.disposer();f.noDom();
});
test('synchronous page disposal while retention waits for real admission callback prevents late writes/POST',async()=>{
 const f=fixture();await f.mount();await f.review();const entered=deferred(),release=deferred(),queued=deferred();
 const blocker=f.admission.mutate(async()=>{entered.resolve();await release.promise;});await entered.promise;
 const originalRequest=f.locks.request;f.locks.request=function(...args){queued.resolve();return originalRequest.apply(this,args);};
 const confirming=f.click('Confirm');await queued.promise;f.disposer();f.noDom();const message=f.root.node('Message').textContent;
 release.resolve();await blocker;await confirming;
 // Admission stamps rejection metadata before each callback, including the
 // blocker and the disposed queued callback. Neither may persist an original.
 assert.deepEqual(f.storage.writes,[[PROTECTED_BROWSER_MUTATION_KEY,'1'],[PROTECTED_BROWSER_MUTATION_KEY,'2']]);
 assert.deepEqual([...f.storage.rows],[[PROTECTED_BROWSER_MUTATION_KEY,'2']]);
 assert.equal(f.storage.getItem(originalKey),null);assert.equal(f.storage.getItem(intentKey),null);
 assert.equal(f.approvals().length,0);
 assert.equal(f.root.node('Message').textContent,message);assert.equal(f.locks.active,0);
});
test('late approval reply after disposal cannot render stale receipt/error or mutate retained originals',async()=>{
 const f=fixture();await f.mount();await f.review();const entered=deferred(),reply=deferred();
 f.requestHook=async call=>{f.r=receipt(call.body,f.p);entered.resolve();await reply.promise;return f.r;};
 const confirming=f.click('Confirm');await entered.promise;const rows=[...f.storage.rows];f.disposer();f.noDom();
 const closed=f.root.node('Message').textContent;reply.resolve();await confirming;f.noDom();assert.equal(f.root.node('Message').textContent,closed);
 assert.deepEqual([...f.storage.rows],rows);assert.equal(f.approvals().length,1);await f.click('Status',true);assert.equal(f.status().length,0);
});
test('observed page retirement closes both lifetimes before a forced stale action',async()=>{
 const f=fixture();await f.mount();await f.review();f.owns=false;await f.root.emit('pointerdown');f.noDom();
 f.owns=true;await f.click('Confirm',true);await f.click('Review',true);assert.equal(f.storage.writes.length,0);assert.equal(f.approvals().length,0);f.disposer();
});
test('retirement observed inside panel setup still removes returned listener lifetime',async()=>{
 const f=fixture();f.root.addHook=()=>{f.owns=false;};await assert.rejects(f.mount(),/mount_unconfirmed/);f.noDom();
 assert.equal(f.calls.length,0);assert.equal(f.storage.writes.length,0);
});

if(direct&&joinedOnly)throw new Error('Joined workflow requires Main to import sameOriginalRecoveryPageHttpSqlJoin with actual request/currentOwner/challengeId ports; NOT_RUN');

async function inventorySeparationDeviceSecurityPageCase(selected){
 // Actual complete inline page + unchanged imported shipping modules, executed
 // in the existing Node VM facility. Storage/DOM/locks/auth/fetch are recording
 // UNIT ports, not genuine browser, named manager, credential, native or SQL.
 const {dirname}=await import('node:path');
 const {fileURLToPath}=await import('node:url');
 const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const uid=n=>'99000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const sha=n=>String(n).repeat(64),iso=t=>new Date(t).toISOString().replace(/(\.\d{3})Z$/,'$1000Z');
 const pause=()=>new Promise(r=>setImmediate(r));
 const gate=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
 const namespace=['MemphisZooCustodialNativeVaultV2','MemphisZooCustodialOfflineAuthorityTimeV1','MemphisZooCustodialRetainedAttemptV1',
  'MemphisZooCustodialRetainedReadQueryV1','MemphisZooCustodialRetainedBatchV1','MemphisZooCustodialNativeProviderV1','MemphisZooCustodialNativeVaultV1','WSSecureStorageSharedPreferences'];
 const denied={inventory_acknowledged:false,work_accepted:false,replay_allowed:false,finalizer_allowed:false,key_removal:false,phone_released:false};
 const api='https://memphis-zoo-mcp.onrender.com/admin-api/device-security/original-inventory-separation';
 const holdKey='mz_custodial_protected_browser_hold.v1',epochKey='mz_custodial_protected_browser_mutation.v1';
 function review(){const t={operation_id:uid(10),separation_id:uid(11),separation_authority_revision:'1',canonical_device_pk:uid(12),canonical_device_id:'KIOSK_02',
  employee_id:uid(13),credential_id:uid(14),assignment_epoch:'1',original_generation_id:uid(15),engine_revision:'0'};
  for(const k of ['original_credential_secret_key_id','principal_digest','original_wire_sha256','original_frozen_work_sha256','capsule_sha256','record_sha256','frame_sha256','plan_sha256','aad_binding_sha256','source_capture_sha256','values_sha256','semantic_join_sha256','layout_sha256'])t[k]=sha(1);
  return {schema:'custodial.original-inventory-separation-review.v1',state:'COMPLETE_ORIGINAL_INVENTORY_REVIEW_ONLY',purpose:'AUTHORIZE_EXACT_ORIGINAL_RETAINED_INVENTORY_SEPARATION',
   native_request_id:uid(20),original_target:t,original_employee_label:'Synthetic employee <literal>',original_device_label:'Synthetic device',registration_receipt_sha256:sha(2),inventory_manifest_sha256:sha(3),review_sha256:sha(4),
   issuer:{manager_id:uid(1),manager_credential_id:uid(2),manager_device_id:'fixture-manager'},native_namespaces:namespace.map(namespace=>({namespace,record_count:2,accepted_exact_original_count:1,unresolved_retained_count:1})),
   browser_summary:{declared_domains:2,record_count:3,accepted_exact_original_count:1,unresolved_retained_count:2,frame_sha256:sha(5),part_set_sha256:sha(6)},retained_key_family_count:2,
   reviewed_at:iso(Date.now()-1000),expires_at:iso(Date.now()+239000),limits:{...denied}};
 }
 async function fixture({baseline=false,readonly=false,held=false,rowsSeed=[],reviewSeed=null,unavailable=null,floorLifetimeMs=300000}={}){
  const f={calls:[],rows:new Map(rowsSeed),writes:[],activeLocks:new Set(),lockRows:[],observers:new Set(),timers:new Set(),listeners:new Map(),review:reviewSeed||review(),hook:null,authHook:null,bodyHook:null,errors:[]};
  let ctx;
  const notify=()=>{for(const ob of f.observers)if(ob.active)queueMicrotask(()=>{if(ob.active)ob.fn([]);});};
  class Element{
   constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.events=new Map();this.attrs={};this.value='';this.disabled=false;this.hidden=false;this._text='';this.dataset={};
    const names=new Set();this.classList={add:n=>{names.add(n);notify();},remove:n=>{names.delete(n);notify();},contains:n=>names.has(n)};}
   set textContent(s){this._text=s;for(const n of this.children)n.parentElement=null;this.children=[];notify();}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
   set innerHTML(s){assert.notEqual(this.id,'inventorySeparationPanel','New panel must use textContent');this._text=s;this.children=[];notify();}
   setAttribute(k,v){this.attrs[k]=v;}appendChild(n){n.parentElement=this;this.children.push(n);notify();return n;}
   remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;notify();}}
   querySelectorAll(s){const all=this.children.flatMap(n=>[n,...n.querySelectorAll('*')]);return s==='*'?all:s.startsWith('#')?all.filter(n=>n.id===s.slice(1)):[];}
   querySelector(s){return this.querySelectorAll(s)[0]||null;}
   addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);}
   removeEventListener(type,fn){this.events.get(type)?.delete(fn);}
   async emit(type){if(type==='click'&&this.disabled)return;await Promise.all([...(this.events.get(type)||[])].map(fn=>fn({preventDefault(){}})));}
   scrollIntoView(){}
  }
  const html=readFileSync(resolve(base,baseline?'../original/device-security.html':'device-security.html'),'utf8');
  const doc=new Element('document'),htmlRoot=new Element('html');doc.documentElement=htmlRoot;doc.appendChild(htmlRoot);const nodes=new Map();
  for(const [,id] of html.matchAll(/\bid="([^"]+)"/g)){const n=new Element();n.id=id;nodes.set(id,n);}
  const app=nodes.get('app');htmlRoot.appendChild(app);app.classList.add('hidden');
  for(const [id,n] of nodes)if(id!=='app')app.appendChild(n);
  doc.getElementById=id=>nodes.get(id)||null;doc.createElement=tag=>{const n=new Element(tag);n.ownerDocument=doc;return n;};
  for(const n of nodes.values())n.ownerDocument=doc;
  const initialInventoryText=html.match(/id="inventorySeparationPanel"[^>]*>\s*<p[^>]*>([^<]*)<\/p>/)?.[1];
  if(initialInventoryText)nodes.get('inventorySeparationPanel').textContent=initialInventoryText;
  f.doc=doc;f.nodes=nodes;
  f.session={role:'ops_manager',manager_id:uid(1),credential_id:uid(2),device_id:'fixture-manager',access_level:'full_access',read_only:readonly,trusted_device:true,
   permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:!readonly},roles:['SECURITY_ADMIN'],expires_at:new Date(Date.now()+600000).toISOString()};
  f.floor={manager_id:uid(1),unlocked:true,expires_at:new Date(Date.now()+floorLifetimeMs).toISOString()};
  class Storage{
   getItem(k){return f.rows.get(k)??null;}
   setItem(k,v){if(k.startsWith('mz_original_inventory_separation.v1:')){
    assert(f.activeLocks.has('memphis-custodial-protected-browser-work.v1'),'Original persistence must own shared admission');
    assert([...f.activeLocks].some(n=>n.startsWith('mz_original_inventory_separation.v1:')),'Original persistence must own exact scope lock');
    assert.match(f.rows.get(epochKey),/^[1-9][0-9]*$/);
   }f.writes.push([k,v]);f.rows.set(k,v);}
   removeItem(){assert.fail('No original removal');}clear(){assert.fail('No history deletion');}key(i){return [...f.rows.keys()][i]??null;}get length(){return f.rows.size;}
  }
  if(held)f.rows.set(holdKey,'synthetic preexisting hold (denial DATA only)');
  const raw=new Storage(),tails=new Map();
  f.locks={request(name,options,fn){
   const previous=tails.get(name)||Promise.resolve();
   const result=previous.catch(()=>{}).then(async()=>{
    if(options.signal?.aborted)throw new Error('Recording abort');assert(!f.activeLocks.has(name),'No recursive/same-name lock');
    f.activeLocks.add(name);f.lockRows.push({name,mode:options.mode});
    try{return await fn({name,mode:options.mode});}finally{f.activeLocks.delete(name);}
   });tails.set(name,result.catch(()=>{}));return result;
  }};
  function data(value){return vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(value))+')',ctx);}
  const payload=(value,status=200)=>({ok:status===200,status,json:async()=>{if(f.bodyHook)await f.bodyHook();return data({ok:status===200,data:value});}});
  f.auth={readSession:()=>f.session,getDeviceId:()=>f.session.device_id,hasRole:()=>true,
   requireOpsManagerSession:async()=>f.session,deviceSecuritySession:async()=>({...f.floor}),
   deviceSecurityAuthHeaders:async()=>{if(f.authHook)await f.authHook();return {'X-Unit-Session':'SYNTHETIC-not-a-credential'};},
   lockDeviceSecurity:async()=>{},unlockDeviceSecurity:async()=>{}};
  const winEvents=new Map();f.windowEmit=async type=>{await Promise.all([...(winEvents.get(type)||[])].map(fn=>fn({})));await pause();};
  const globals={console,crypto:globalThis.crypto,TextEncoder,TextDecoder,URL,Uint8Array,AbortController,performance,
   setTimeout(fn,ms){let t;t=setTimeout(()=>{f.timers.delete(t);fn();},ms);f.timers.add(t);return t;},clearTimeout(t){clearTimeout(t);f.timers.delete(t);},queueMicrotask,
   document:doc,Storage,localStorage:raw,sessionStorage:new Storage(),navigator:{locks:f.locks},location:{reload(){}},confirm:()=>false,
   MemphisAuth:f.auth,addEventListener(type,fn){if(!winEvents.has(type))winEvents.set(type,new Set());winEvents.get(type).add(fn);},removeEventListener(type,fn){winEvents.get(type)?.delete(fn);},
   MutationObserver:class{constructor(fn){this.fn=fn;this.active=false;f.observers.add(this);}observe(){this.active=true;}disconnect(){this.active=false;}},
   async fetch(url,options){
    f.calls.push({url,options});if(url.endsWith('/device-auth/summary'))return payload({policy:{},coverage:{devices:[]}});
    assert(url.startsWith(api),'New path must remain at fixed original origin');
    assert.equal(f.activeLocks.size,0,'HTTP must not hold provider/storage locks');
    assert.equal(options.cache,'no-store');assert.equal(options.credentials,'include');assert(options.signal);
    if(f.hook){const v=await f.hook(url,options);if(v!==undefined)return v;}
    if(url===api+'/reviews/'+uid(20)){assert.equal(options.method,'GET');assert.equal(options.body,undefined);return payload(f.review);}
    assert.equal(options.method,'POST');assert([api+'/approvals',api+'/approvals/original-status'].includes(url));
    const rawRequest=[...f.rows.entries()].find(([k])=>k.endsWith(':request'))?.[1];assert.equal(options.body,rawRequest,'Exact UTF8, never JSON.stringify(body_utf8)');
    const r={schema:'custodial.original-inventory-separation-receipt.v1',state:'INVENTORY_ACK_RECORDED_LOGICAL_SEPARATION_ONLY',approval_id:uid(30),
     original_request:JSON.parse(options.body),original_request_sha256:createHash('sha256').update(options.body).digest('hex'),original_target:f.review.original_target,
     issuer:f.review.issuer,inventory_manifest_sha256:f.review.inventory_manifest_sha256,registration_receipt_sha256:f.review.registration_receipt_sha256,
     approved_at:iso(Date.parse(f.review.reviewed_at)+500),expires_at:f.review.expires_at,receipt_sha256:sha(7),limits:{...denied,inventory_acknowledged:true,finalizer_allowed:true},purpose_admission_id:'exact-original-retained-inventory-separation.v1',retry_safe:false};
    return payload(r);
   }};
  ctx=vm.createContext(globals);ctx.window=ctx;ctx.globalThis=ctx;
  // Node's VM has no browser structuredClone intrinsic. Use the normal host
  // clone and re-enter its JSON-only DTO result in the receiving realm, just
  // as response.json does; no modified wire validator or private capability.
  ctx.structuredClone=value=>data(globalThis.structuredClone(value));
  const modules=new Map();let imports=Promise.resolve();
  function moduleAt(file){if(modules.has(file))return modules.get(file);
   const source=baseline&&file.endsWith('/mobile/src/custodial/storage-firewall.js')?resolve(base,'../original/mobile/src/custodial/storage-firewall.js'):file;
   const m=new vm.SourceTextModule(readFileSync(source,'utf8'),{context:ctx,identifier:file});modules.set(file,m);return m;
  }
  const linker=(name,m)=>moduleAt(resolve(dirname(m.identifier),name));
  const load=(name,from)=>{const work=imports.then(async()=>{const m=moduleAt(resolve(dirname(from.identifier||resolve(base,'device-security.html')),name));if(m.status==='unlinked')await m.link(linker);if(m.status==='linked')await m.evaluate();return m;});imports=work.catch(()=>{});return work;};
  if(unavailable==='locks')ctx.navigator.locks=null;
  if(unavailable==='firewall'){
   const installed=await load('./mobile/src/custodial/storage-firewall.js',{identifier:resolve(base,'device-security.html')});
   installed.namespace.installCustodialStorageFirewall({storage:raw,getSecurityStatus:()=>({initialized:false,ready:false,available:false})});
  }
  for(const file of ['same-original-recovery-client.js','same-original-recovery-panel.js','same-original-recovery-original-store.js','same-original-recovery-page.js'])
   vm.runInContext(readFileSync(resolve(base,file),'utf8'),ctx,{filename:resolve(base,file)});
  const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];assert(inline,'Actual inline Device Security owner required');
  const work=new vm.Script(inline,{filename:resolve(base,'device-security.html'),importModuleDynamically:load}).runInContext(ctx);
  await work;await imports;await pause();f.ctx=ctx;
  if(!readonly&&!unavailable){assert.equal(nodes.get('sameOriginalChallenge').disabled,false,'Existing preparation owner must actually mount before the new workflow is tested: '+nodes.get('sameOriginalMessage').textContent);
   assert.match(nodes.get('sameOriginalMessage').textContent,/Enter the exact original challenge/,'Existing preparation panel must reach its actual owned IDLE state');}
  f.panel=()=>nodes.get('inventorySeparationPanel');
  f.buttons=()=>f.panel()?.querySelectorAll('*').filter(n=>n.tagName==='BUTTON')||[];
  f.wait=async predicate=>{for(let i=0;i<250;i++){if(predicate())return;await pause();}assert.fail('Expected selected page action to settle: '+f.panel()?.textContent);};
  f.open=async()=>{const input=f.panel()?.querySelectorAll('*').find(n=>n.tagName==='INPUT');assert(input,'Actual Device Security page must mount the inventory panel');input.value=uid(20);await f.buttons()[0].emit('click');await f.wait(()=>!f.buttons()[1]?.disabled);};
  f.confirm=async()=>{await f.buttons()[1].emit('click');await f.wait(()=>/page closed/.test(f.panel().textContent)
   ||/Server-reported DATA|Outcome UNKNOWN|Action held/.test(f.panel().textContent)&&f.buttons()[2]?.disabled===false);};
  f.cleanup=async()=>{await f.windowEmit('pagehide');await imports;await pause();assert.equal(f.activeLocks.size,0);assert.equal(f.timers.size,0);assert.equal([...f.observers].filter(x=>x.active).length,0);};
  return f;
 }
 const cases={
  async original_expiry_retires_idle_panel(){const f=await fixture({floorLifetimeMs:1000});try{
   await f.open();const deadline=Date.parse(f.floor.expires_at);await new Promise(r=>setTimeout(r,Math.max(1,deadline-Date.now()+15)));
   assert.match(f.panel().textContent,/page closed/);assert.equal(f.writes.length,0);assert.equal(f.calls.filter(c=>c.url===api+'/approvals').length,0);
   assert.equal(f.timers.size,0);assert.equal([...f.observers].filter(x=>x.active).length,0);
  }finally{await f.cleanup();}},
  async missing_lock_and_preinstalled_firewall(){for(const unavailable of ['locks','firewall']){const f=await fixture({unavailable});try{
   assert.equal(f.buttons().length,0);assert.equal(f.calls.filter(c=>c.url.startsWith(api)).length,0);assert.equal(f.writes.length,0);
   assert.match(f.panel().textContent,/unavailable/);
  }finally{await f.cleanup();}}},
  async guarded_transport_withdrawal(){const f=await fixture();try{
   await f.open();const entered=gate(),resume=gate();f.authHook=async()=>{entered.resolve();await resume.promise;};
   await f.buttons()[1].emit('click');await entered.promise;f.ctx.fetch=()=>{assert.fail('No replacement transport');};resume.resolve();
   await f.wait(()=>/page closed/.test(f.panel().textContent));assert.equal(f.calls.filter(c=>c.url===api+'/approvals').length,0);assert.equal(f.writes.length,0);
  }finally{await f.cleanup();}},
  async restored_receipt_readonly(){
   const first=await fixture();let saved;
   try{await first.open();await first.confirm();saved=[...first.rows];}finally{await first.cleanup();}
   for(const held of [false,true]){const f=await fixture({rowsSeed:saved,reviewSeed:first.review,held});const before=[...f.rows];try{
    const input=f.panel().querySelectorAll('*').find(n=>n.tagName==='INPUT');input.value=uid(20);await f.buttons()[0].emit('click');
    await f.wait(()=>/Server-reported DATA/.test(f.panel().textContent));
    assert.equal(f.calls.filter(c=>c.url.startsWith(api)).length,0,'Restored receipt must not query or approve automatically');
    assert.equal(f.writes.length,0,'Validating an existing receipt must not advance epoch or rewrite rows');assert.deepEqual([...f.rows],before);
   }finally{await f.cleanup();}}
  },
  async lost_reply_reload_exact_status(){
   const first=await fixture();let saved,raw;
   try{await first.open();first.hook=url=>{if(url===api+'/approvals')throw new Error('Synthetic lost reply');};await first.confirm();
    saved=[...first.rows];raw=first.calls.find(c=>c.url===api+'/approvals').options.body;
   }finally{await first.cleanup();}
   const f=await fixture({rowsSeed:saved,reviewSeed:first.review});try{
    const input=f.panel().querySelectorAll('*').find(n=>n.tagName==='INPUT');input.value=uid(20);await f.buttons()[0].emit('click');
    await f.wait(()=>f.buttons()[2]?.disabled===false);assert.equal(f.buttons()[1].disabled,true);assert.equal(f.writes.length,0);
    assert.equal(f.calls.filter(c=>c.url.startsWith(api)).length,0);await f.buttons()[2].emit('click');
    await f.wait(()=>/Server-reported DATA/.test(f.panel().textContent));
    const requests=f.calls.filter(c=>c.url.startsWith(api));assert.equal(requests.length,1);assert.equal(requests[0].url,api+'/approvals/original-status');
    assert.equal(requests[0].options.body,raw);assert.equal(f.writes.filter(([k])=>k.endsWith(':original')||k.endsWith(':request')).length,0);
   }finally{await f.cleanup();}
  },
  async baseline_unreachable(){const f=await fixture({baseline:true});try{await f.open();}finally{await f.cleanup();}},
  async exact_transport_and_durable_admission(){const f=await fixture();try{
   assert.equal(f.calls.filter(c=>c.url.startsWith(api)).length,0,'No automatic inventory network on mount');
   await f.open();assert.equal(f.writes.filter(([k])=>k.startsWith('mz_original_inventory_separation.v1:')).length,0,'Review remains readonly');
   await f.confirm();assert.match(f.panel().textContent,/Server-reported DATA/);
   assert.equal(f.calls.filter(c=>c.url===api+'/approvals').length,1);assert.equal(f.writes.filter(([k])=>k.startsWith('mz_original_inventory_separation.v1:')).length,3);
   assert.equal(f.activeLocks.size,0);assert.equal([...f.rows.keys()].filter(k=>k.startsWith('mz_original_inventory_separation.v1:')).length,3);
   assert.throws(()=>vm.runInContext("localStorage.setItem('mz_original_inventory_separation.v1:unowned','x')",f.ctx),/cannot change/,'New prefix must be firewalled');
  }finally{await f.cleanup();}},
  async hold_refusal_and_readonly(){for(const opts of [{held:true},{readonly:true}]){const f=await fixture(opts);try{
   if(opts.held){await f.open();await f.confirm();assert.equal(f.rows.get(holdKey),'synthetic preexisting hold (denial DATA only)');}
   else assert.equal(f.buttons().length,0,'Readonly owner never receives a full-owner mount');
   assert.equal(f.calls.filter(c=>c.url===api+'/approvals').length,0);assert.equal(f.writes.length,0);
  }finally{await f.cleanup();}}},
  async session_await_and_retirement(){const f=await fixture();try{
   await f.open();const entered=gate(),resume=gate();f.authHook=async()=>{entered.resolve();await resume.promise;};
   await f.buttons()[1].emit('click');await entered.promise;f.session={...f.session,credential_id:uid(90)};resume.resolve();
   await f.wait(()=>/page closed/.test(f.panel().textContent));assert.equal(f.calls.filter(c=>c.url===api+'/approvals').length,0);assert.equal(f.writes.length,0);
  }finally{await f.cleanup();}},
  async late_response_abort_and_dom(){const f=await fixture();try{
   await f.open();const entered=gate(),resume=gate();let signal;
   f.hook=async(url,options)=>{if(url===api+'/approvals'){signal=options.signal;entered.resolve();await resume.promise;}};
   await f.buttons()[1].emit('click');await entered.promise;const retained=JSON.stringify([...f.rows]);
   f.panel().querySelectorAll('*').find(n=>n.tagName==='INPUT').remove();await pause();assert.equal(signal.aborted,true);
   resume.resolve();await f.wait(()=>/page closed/.test(f.panel().textContent));await pause();assert.equal(JSON.stringify([...f.rows]),retained);assert.equal(f.calls.filter(c=>c.url===api+'/approvals').length,1);
  }finally{await f.cleanup();}},
  async password_floor_and_lock_loss(){for(const kind of ['floor','locks']){const f=await fixture();try{
   await f.open();if(kind==='floor')f.floor={...f.floor,expires_at:new Date(Date.now()+290000).toISOString()};
   else f.ctx.navigator.locks={request(){assert.fail('No replacement lock owner');}};
   await f.buttons()[1].emit('click');await f.wait(()=>/page closed/.test(f.panel().textContent));
   assert.equal(f.writes.length,0);assert.equal(f.calls.filter(c=>c.url===api+'/approvals').length,0);
  }finally{await f.cleanup();}}}
 };
 assert(Object.hasOwn(cases,selected),'Select one new owning Device Security case');await cases[selected]();
 console.log('PASS '+selected+' — actual page/module composition, recording UNIT ports only; no real HTTP/SQL/browser/native authority');
}
