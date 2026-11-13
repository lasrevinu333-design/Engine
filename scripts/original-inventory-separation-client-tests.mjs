import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createInventorySeparationClient} from '../original-inventory-separation-client.js';
import {createInventorySeparationOriginalStore} from '../original-inventory-separation-original-store.js';
import {mountInventorySeparationPanel} from '../original-inventory-separation-panel.js';
import {inventorySeparationApi as API,inventorySeparationPurpose as PURPOSE,
 inventorySeparationDeniedEffects as DENIED,inventorySeparationNativeNamespaces as NS} from '../original-inventory-separation-wire.js';

// Synthetic review, owner, storage, Web Locks and server-response UNIT DATA.
// No real manager/browser/native/SQL authority, network or finalizer here.
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const sha=n=>String(n).repeat(64),copy=x=>structuredClone(x);
const stamp=ms=>new Date(ms).toISOString().replace(/(\.\d{3})Z$/,'$1000Z');
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
function owner(){return {manager_id:uuid(1),manager_credential_id:uuid(2),manager_device_id:'manager_device',can_authorize:true,session_binding:'synthetic-session-A'};}
function review(){
 const t={operation_id:uuid(10),separation_id:uuid(11),separation_authority_revision:'1',canonical_device_pk:uuid(12),canonical_device_id:'KIOSK_02',
  employee_id:uuid(13),credential_id:uuid(14),assignment_epoch:'2',original_generation_id:uuid(15),engine_revision:'0'};
 for(const k of ['original_credential_secret_key_id','principal_digest','original_wire_sha256','original_frozen_work_sha256','capsule_sha256','record_sha256',
  'frame_sha256','plan_sha256','aad_binding_sha256','source_capture_sha256','values_sha256','semantic_join_sha256','layout_sha256'])t[k]=sha(1);
 const now=Date.now()-1000;
 return {schema:'custodial.original-inventory-separation-review.v1',state:'COMPLETE_ORIGINAL_INVENTORY_REVIEW_ONLY',purpose:PURPOSE,
  native_request_id:uuid(20),original_target:t,original_employee_label:'Synthetic employee <not HTML>',original_device_label:'Synthetic device',
  registration_receipt_sha256:sha(2),inventory_manifest_sha256:sha(3),review_sha256:sha(4),
  issuer:{manager_id:uuid(1),manager_credential_id:uuid(2),manager_device_id:'manager_device'},
  native_namespaces:NS.map(namespace=>({namespace,record_count:3,accepted_exact_original_count:1,unresolved_retained_count:2})),
  browser_summary:{declared_domains:2,record_count:5,accepted_exact_original_count:2,unresolved_retained_count:3,frame_sha256:sha(5),part_set_sha256:sha(6)},
  retained_key_family_count:2,reviewed_at:stamp(now),expires_at:stamp(now+240000),limits:{...DENIED}};
}
function receipt(raw,v){return {schema:'custodial.original-inventory-separation-receipt.v1',state:'INVENTORY_ACK_RECORDED_LOGICAL_SEPARATION_ONLY',
 approval_id:uuid(30),original_request:JSON.parse(raw),original_request_sha256:hash(raw),original_target:copy(v.original_target),issuer:copy(v.issuer),
 inventory_manifest_sha256:v.inventory_manifest_sha256,registration_receipt_sha256:v.registration_receipt_sha256,
 approved_at:stamp(Date.parse(v.reviewed_at)+500),expires_at:v.expires_at,receipt_sha256:sha(7),
 limits:{...DENIED,inventory_acknowledged:true,finalizer_allowed:true},purpose_admission_id:'exact-original-retained-inventory-separation.v1',retry_safe:false};}
function locks(){
 const tails=new Map();return {request(name,options,fn){
  assert.deepEqual(options,{mode:'exclusive'});const prior=tails.get(name)||Promise.resolve();
  const task=prior.catch(()=>{}).then(()=>fn({name,mode:'exclusive'}));tails.set(name,task.catch(()=>{}));return task;
 }};
}
function fixture(shared={}){
 let current=owner();const rows=shared.rows||new Map(),lock=shared.locks||locks();
 const storage=shared.storage||{getItem(k){return rows.has(k)?rows.get(k):null;},setItem(k,v){rows.set(k,v);}};
 const f={rows,locks:lock,storage,review:review(),calls:[],post:null,get:null,receiptTransform:null,
  currentOwner:()=>current,setOwner:o=>{current=o;}};
 const request=async d=>{
  assert.equal(Object.isFrozen(d),true);assert.deepEqual(Object.keys(d),d.method==='GET'?['method','path']:['method','path','body_utf8']);
  f.calls.push(d);
  if(d.method==='GET'){assert.equal(d.path,API+'/reviews/'+f.review.native_request_id);return f.get?f.get(d):copy(f.review);}
  assert.equal(typeof d.body_utf8,'string');assert.ok([API+'/approvals',API+'/approvals/original-status'].includes(d.path));
  const stored=[...rows.entries()].find(([k])=>k.endsWith(':original'))?.[1];
  assert.ok(stored,'durable UNKNOWN must precede all POSTs');const p=JSON.parse(stored);
  assert.equal(p.phase,'UNKNOWN');assert.equal(p.original_request_utf8,d.body_utf8);
  if(f.post)return f.post(d);
  const value=receipt(d.body_utf8,f.review);return f.receiptTransform?f.receiptTransform(value):value;
 };
 f.make=()=>{
  const store=createInventorySeparationOriginalStore({storage,locks:lock,currentOwner:f.currentOwner});
  const client=createInventorySeparationClient({request,currentOwner:f.currentOwner,originalStore:store});
  return {client,store};
 };
 Object.assign(f,f.make());return f;
}
const approvals=f=>f.calls.filter(x=>x.path===API+'/approvals');
const status=f=>f.calls.filter(x=>x.path===API+'/approvals/original-status');
const close=f=>{f.client.close();f.store.close();};
// NEW focused payload-clock fixtures only: not server freshness, a genuine
// clock, manager authentication or current native/SQL authority.
async function microClock(run){
 const original=Date.now;let current=Date.parse('2026-10-16T12:00:00.123Z');
 Date.now=()=>current;
 try{return await run({get:()=>current,set:value=>{current=value;}});}
 finally{Date.now=original;}
}
const groups={
 async MICRO_REVIEW_future_one_microsecond_start(){
  await microClock(async clock=>{
   const f=fixture();try{
    f.review.reviewed_at=stamp(clock.get()).replace(/000Z$/,'001Z');
    f.review.expires_at=stamp(clock.get()+10000);
    const state=await f.client.open(f.review.native_request_id);
    assert.equal(state.can_confirm,false,'one microsecond in the future is NOT live review DATA');
    assert.equal(state.state,'HELD');assert.equal(f.rows.size,0);assert.equal(approvals(f).length,0);
    await assert.rejects(f.client.confirm(),/original_status_only/);
   }finally{close(f);}
  });
 },
 async MICRO_REVIEW_expiry_one_microsecond_still_live(){
  await microClock(async clock=>{
   const f=fixture();try{
    f.review.expires_at=stamp(clock.get()).replace(/000Z$/,'001Z');
    const state=await f.client.open(f.review.native_request_id);
    assert.equal(state.can_confirm,true,'one remaining microsecond must not be truncated to expired');
    const confirmed=await f.client.confirm();assert.equal(confirmed.state,'SERVER_REPORTED_RECORDED');
    assert.equal(approvals(f).length,1);assert.equal(f.rows.size,3);
    assert.equal(f.client.getState().review.expires_at,f.review.expires_at,'original microseconds preserved');
   }finally{close(f);}
  });
 },
 async MICRO_REVIEW_exact_start_and_expiry_boundaries(){
  await microClock(async clock=>{
   const f=fixture();try{
    f.review.reviewed_at=stamp(clock.get());f.review.expires_at=stamp(clock.get()+10000);
    assert.equal((await f.client.open(f.review.native_request_id)).can_confirm,true);
    assert.equal((await f.client.confirm()).state,'SERVER_REPORTED_RECORDED');assert.equal(approvals(f).length,1);
    await assert.rejects(f.client.confirm(),/original_status_only/);
   }finally{close(f);}
   for(const expires of [stamp(clock.get()),stamp(clock.get()-1).replace(/000Z$/,'999Z')]){
    const g=fixture();try{
     g.review.expires_at=expires;
     assert.equal((await g.client.open(g.review.native_request_id)).can_confirm,false);
     assert.equal(approvals(g).length,0);assert.equal(g.rows.size,0);
    }finally{close(g);}
   }
  });
 },
 async MICRO_REVIEW_await_crossing_before_effect_and_after_retention(){
  await microClock(async clock=>{
   const initial=clock.get(),f=fixture();try{
    f.review.expires_at=stamp(initial+1);
    await f.client.open(f.review.native_request_id);
    f.get=async()=>{await Promise.resolve();clock.set(initial+1);return copy(f.review);};
    assert.equal((await f.client.confirm()).state,'HELD');
    assert.equal(f.calls.filter(x=>x.method==='GET').length,2);
    assert.equal(approvals(f).length,0);assert.equal(f.rows.size,0);
   }finally{close(f);}
   const beforeRetention=clock.get(),actual=locks();let completedLocks=0;
   const wrapped={async request(name,options,fn){
    const value=await actual.request(name,options,fn);
    if(++completedLocks===3)clock.set(beforeRetention+1);
    return value;
   }};
   const g=fixture({locks:wrapped});try{
    g.review.expires_at=stamp(beforeRetention+1);
    await g.client.open(g.review.native_request_id);
    assert.equal((await g.client.confirm()).state,'UNKNOWN');
    assert.equal(completedLocks,3,'cross only after actual UNKNOWN retention callback settles');
    assert.equal(g.rows.size,2);assert.equal(approvals(g).length,0);
    const originals=[...g.rows.entries()];
    await assert.rejects(g.client.confirm(),/original_status_only/);
    assert.deepEqual([...g.rows.entries()],originals,'expiry must not replace or delete the UNKNOWN original');
   }finally{close(g);}
  });
 },
 async MICRO_REVIEW_backward_clock_remains_sticky(){
  await microClock(async clock=>{
   const original=clock.get(),f=fixture();try{
    assert.equal((await f.client.open(f.review.native_request_id)).can_confirm,true);
    clock.set(original-1);assert.equal(f.client.getState().can_confirm,false);
    clock.set(original);assert.equal(f.client.getState().state,'HELD');
    assert.equal(f.client.getState().can_confirm,false);
    assert.equal(approvals(f).length,0);assert.equal(f.rows.size,0);
   }finally{close(f);}
  });
 },
 async MICRO_REVIEW_malformed_and_unrepresentable_clock_refuses(){
  await microClock(async clock=>{
   const valid=clock.get();
   for(const bad of [NaN,Infinity,-Infinity,undefined,null,'1770000000000',1.5,
    Number.MAX_SAFE_INTEGER+1,Number.MAX_SAFE_INTEGER,-Number.MAX_SAFE_INTEGER,
    Date.parse('0000-01-01T00:00:00.000Z'),Date.parse('+010000-01-01T00:00:00.000Z')]){
    clock.set(valid);const f=fixture();try{
     clock.set(bad);const state=await f.client.open(f.review.native_request_id);
     assert.equal(state.can_confirm,false,'malformed/unrepresentable synthetic clock '+String(bad));
     clock.set(valid);assert.equal(f.client.getState().can_confirm,false,'observed clock refusal remains sticky');
     assert.equal(f.rows.size,0);assert.equal(approvals(f).length,0);
    }finally{close(f);}
   }
  });
 },
 async missing_original_never_reopens_confirmation(){
  const f=fixture();f.post=()=>{throw new Error('synthetic lost reply');};await f.client.open(f.review.native_request_id);await f.client.confirm();
  const original=[...f.rows.keys()].find(k=>k.endsWith(':original'));f.rows.delete(original);close(f);
  const before=f.calls.length;Object.assign(f,f.make());const s=await f.client.open(f.review.native_request_id);
  assert.equal(s.can_confirm,false,'missing original with surviving request history must not reopen a confirmation');
  assert.equal(f.calls.length,before,'partial original loss must not read a replacement review');close(f);
  const g=fixture();g.post=()=>{throw new Error('synthetic lost reply');};await g.client.open(g.review.native_request_id);await g.client.confirm();
  const raw=approvals(g)[0].body_utf8;const requestKey=[...g.rows.keys()].find(k=>k.endsWith(':request'));
  g.rows.delete(requestKey);close(g);const beforeReload=g.calls.length;Object.assign(g,g.make());
  assert.equal((await g.client.open(g.review.native_request_id)).state,'UNKNOWN');assert.equal(g.calls.length,beforeReload);
  await assert.rejects(g.client.confirm(),/original_status_only/);g.post=null;
  assert.equal((await g.client.recoverOriginalStatus()).state,'SERVER_REPORTED_RECORDED');
  assert.equal(status(g)[0].body_utf8,raw);assert.equal(g.rows.has(requestKey),false,'status must not repair a missing request row');
  assert.equal(approvals(g).length,1);close(g);
 },
 async exact_receipt_time_and_final_original(){
  const f=fixture();await f.client.open(f.review.native_request_id);
  const s=await f.client.confirm();assert.equal(s.state,'SERVER_REPORTED_RECORDED');assert.equal(approvals(f).length,1);
  const before=[...f.rows.entries()];close(f);assert.deepEqual([...f.rows.entries()],before);
  for(const edge of ['early','late']){
   const g=fixture();
   // Exactly one microsecond across a reviewed boundary: wire-valid DATA
   // whose millisecond truncation would hide the mismatch.
   if(edge==='early')g.review.reviewed_at=g.review.reviewed_at.replace(/000Z$/,'001Z');
   else g.review.expires_at=g.review.expires_at.replace(/000Z$/,'001Z');
   g.receiptTransform=r=>edge==='early'?{...r,approved_at:g.review.reviewed_at.replace(/001Z$/,'000Z')}:
    {...r,expires_at:g.review.expires_at.replace(/001Z$/,'002Z')};
   await g.client.open(g.review.native_request_id);await g.client.confirm();
   assert.equal(g.client.getState().receipt,null);assert.equal(g.rows.size,2);assert.equal(approvals(g).length,1);close(g);
  }
 },
 async queued_and_terminal_withdrawal(){
  let resume,announce;
  const entered=new Promise(r=>{announce=r;});
  const gate=new Promise(r=>{resume=r;});let block=false;
  const actual=locks(),queued={request(name,options,fn){
   if(block){block=false;announce();return gate.then(()=>actual.request(name,options,fn));}
   return actual.request(name,options,fn);
  }};
  const f=fixture({locks:queued});await f.client.open(f.review.native_request_id);
  block=true;const pending=f.client.confirm();await entered;
  f.setOwner({...f.currentOwner(),session_binding:'changed-while-queued'});resume();await pending;
  assert.equal(f.rows.size,0);assert.equal(approvals(f).length,0);close(f);
  const terminalRows=new Map();let withdraw=()=>{};
  const g=fixture({rows:terminalRows,storage:{getItem:k=>terminalRows.get(k)??null,setItem(k,v){terminalRows.set(k,v);withdraw();}}});
  await g.client.open(g.review.native_request_id);withdraw=()=>g.setOwner({...g.currentOwner(),can_authorize:false});
  await g.client.confirm();assert.equal(terminalRows.size,1);assert.equal(approvals(g).length,0);close(g);
  const h=fixture();await h.client.open(h.review.native_request_id);let closes=0;
  h.client.subscribe(s=>{if(s.state==='CLOSED'){closes++;h.client.close();}});
  h.client.close();h.client.close();assert.equal(closes,1);assert.equal(approvals(h).length,0);h.store.close();
 },
 async confirm_original(){
  const f=fixture();assert.equal(f.calls.length,0);assert.equal(f.rows.size,0);
  const s=await f.client.open(f.review.native_request_id);assert.equal(s.can_confirm,true);assert.equal(f.rows.size,0);assert.equal(approvals(f).length,0);
  const result=await f.client.confirm();assert.equal(result.state,'SERVER_REPORTED_RECORDED');assert.equal(approvals(f).length,1);
  assert.equal(Object.keys(JSON.parse(approvals(f)[0].body_utf8)).length,12);assert.equal(f.rows.size,3);
  assert.equal(JSON.stringify([...f.rows.values()]).includes('synthetic-session-A'),false,'session binding never stored');
  await assert.rejects(f.client.confirm(),/original_status_only/);assert.equal(approvals(f).length,1);
  assert.ok([...f.rows.keys()].every(k=>k.startsWith('mz_original_inventory_separation.v1:')));
  close(f);assert.equal(f.rows.size,3);
 },
 async owner_session_withdrawal(){
  for(const field of ['manager_id','manager_credential_id','manager_device_id','can_authorize','session_binding']){
   const f=fixture();await f.client.open(f.review.native_request_id);
   const original=f.currentOwner();f.get=()=>{f.setOwner({...original,[field]:field==='can_authorize'?false:field==='manager_device_id'?'successor':field==='session_binding'?'session-B':uuid(40)});return copy(f.review);};
   await f.client.confirm();assert.equal(approvals(f).length,0);assert.equal(f.rows.size,0);
   f.setOwner(original);assert.equal(f.client.getState().can_confirm,false,'observed withdrawal cannot revive');close(f);
  }
  const f=fixture();f.get=()=>{f.setOwner({...f.currentOwner(),session_binding:'new-session'});return copy(f.review);};
  assert.equal((await f.client.open(f.review.native_request_id)).state,'HELD');assert.equal(f.rows.size,0);close(f);
 },
 async changed_review(){
  for(const field of ['review_sha256','inventory_manifest_sha256','registration_receipt_sha256','original_target','native_namespaces']){
   const f=fixture();await f.client.open(f.review.native_request_id);
   f.get=()=>{const v=copy(f.review);v[field]=field==='original_target'?{...v.original_target,operation_id:uuid(50)}:
    field==='native_namespaces'?v.native_namespaces.map((n,i)=>i? n:{...n,record_count:4,unresolved_retained_count:3}):sha(8);return v;};
   await f.client.confirm();assert.equal(f.rows.size,0);assert.equal(approvals(f).length,0);close(f);
  }
 },
 async unknown_reload_status_only(){
  const f=fixture();f.post=()=>{throw new Error('synthetic lost reply');};await f.client.open(f.review.native_request_id);
  assert.equal((await f.client.confirm()).state,'UNKNOWN');const raw=approvals(f)[0].body_utf8;assert.equal(f.rows.size,2);close(f);
  const before=f.calls.length;Object.assign(f,f.make());
  assert.equal((await f.client.open(f.review.native_request_id)).state,'UNKNOWN');assert.equal(f.calls.length,before,'restore must not send or query automatically');
  await assert.rejects(f.client.confirm(),/original_status_only/);
  f.post=null;assert.equal((await f.client.recoverOriginalStatus()).state,'SERVER_REPORTED_RECORDED');
  assert.equal(status(f).length,1);assert.equal(status(f)[0].body_utf8,raw);assert.equal(approvals(f).length,1);assert.equal(f.rows.size,3);close(f);
 },
 async duplicate_tabs_and_claim(){
  const f=fixture(),other=f.make();await Promise.all([f.client.open(f.review.native_request_id),other.client.open(f.review.native_request_id)]);
  await Promise.all([f.client.confirm(),other.client.confirm()]);assert.equal(approvals(f).length,1);assert.equal(f.rows.size,3);
  await assert.rejects(other.store.takeForFirstDispatch(Object.freeze({})),/first_claim_unavailable|operation_unknown|original_changed/);
  close(f);other.client.close();other.store.close();
  const g=fixture();await g.client.open(g.review.native_request_id);
  const v=g.client.getState().review;
  const command={schema:'custodial.original-inventory-separation-request.v1',request_id:uuid(60),native_request_id:v.native_request_id,
   expected_review_sha256:v.review_sha256,expected_inventory_manifest_sha256:v.inventory_manifest_sha256,
   expected_registration_receipt_sha256:v.registration_receipt_sha256,expected_separation_authority_revision:'1',
   expected_manager_id:uuid(1),expected_manager_credential_id:uuid(2),expected_manager_device_id:'manager_device',decision:PURPOSE,
   manager_confirmation:'CONFIRM_LOGICAL_SEPARATION_KEEP_ALL_ORIGINAL_WORK_AND_KEYS'};
  const claim=await g.store.retainOriginal(JSON.stringify(command),v);
  assert.equal(await g.store.takeForFirstDispatch(claim),JSON.stringify(command));
  await assert.rejects(g.store.takeForFirstDispatch(claim),/first_claim_unavailable/);assert.equal(g.calls.length,1);close(g);
 },
 async resources_and_unknown_storage(){
  for(const ports of [{storage:null,locks:locks()},{storage:{getItem(){},setItem(){}},locks:null},{storage:{getItem(){}},locks:locks()}])
   assert.throws(()=>createInventorySeparationOriginalStore({...ports,currentOwner:owner}),/resources_unavailable/);
  for(const which of ['get','set','locks']){
   const f=fixture();await f.client.open(f.review.native_request_id);
   f.get=()=>{if(which==='get')f.storage.getItem=()=>null;else if(which==='set')f.storage.setItem=()=>{};else f.locks.request=()=>{};return copy(f.review);};
   await f.client.confirm();assert.equal(approvals(f).length,0);assert.equal(f.rows.size,0);close(f);
  }
  const f=fixture();await f.client.open(f.review.native_request_id);
  const rawSet=f.storage.setItem;f.storage.setItem=function(k,v){rawSet.call(this,k,v);throw new Error('uncertain synchronous write');};
  // Changed methods are denied before write, not rebound as raw originals.
  await f.client.confirm();assert.equal(f.rows.size,0);assert.equal(approvals(f).length,0);close(f);
  const rows=new Map();const g=fixture({rows,storage:{getItem:k=>rows.get(k)??null,setItem(k,v){rows.set(k,v);throw new Error('write outcome unknown');}}});
  await g.client.open(g.review.native_request_id);await g.client.confirm();assert.equal(g.rows.size,1);assert.equal(approvals(g).length,0);
  const retained=[...rows.values()][0];close(g);assert.equal([...rows.values()][0],retained);
 },
 async readonly_and_missing_session(){
  for(const name of ['Jennifer','Annie','other-no-full-write']){
   const f=fixture();f.setOwner({...f.currentOwner(),can_authorize:false});
   // Construct with the actual readonly snapshot, not an authorization grant in a review.
   Object.assign(f,f.make());assert.equal((await f.client.open(f.review.native_request_id)).can_confirm,false,name);
   await f.client.confirm();assert.equal(approvals(f).length,0);assert.equal(f.rows.size,0);close(f);
  }
  assert.throws(()=>createInventorySeparationOriginalStore({storage:{getItem(){},setItem(){}},locks:locks(),currentOwner:()=>({...owner(),session_binding:''})}),/owner_unavailable/);
 },
 async receipt_refusals(){
  const changes=[r=>({...r,limits:{...r.limits,key_removal:true}}),r=>({...r,original_target:{...r.original_target,operation_id:uuid(70)}}),
   r=>({...r,original_request:{...r.original_request,request_id:uuid(71)}}),r=>({...r,original_request_sha256:sha(9)}),
   r=>({...r,issuer:{...r.issuer,manager_device_id:'foreign'}}),r=>({...r,extra:true}),r=>({...r,retry_safe:true})];
  for(const change of changes){const f=fixture();f.receiptTransform=change;await f.client.open(f.review.native_request_id);
   const result=await f.client.confirm();assert.equal(result.receipt,null);assert.notEqual(result.state,'SERVER_REPORTED_RECORDED');
   assert.equal(f.rows.size,2);assert.equal(approvals(f).length,1);close(f);}
 },
 async response_owner_loss_and_raw_replacement(){
  const f=fixture();await f.client.open(f.review.native_request_id);const prior=f.currentOwner();
  f.post=d=>{f.setOwner({...prior,session_binding:'successor'});return receipt(d.body_utf8,f.review);};
  await f.client.confirm();assert.equal(f.rows.size,2);assert.equal(f.client.getState().receipt,null);f.setOwner(prior);
  assert.equal(f.client.getState().can_recover_original_status,false);close(f);
  const g=fixture();g.post=d=>{const key=[...g.rows.keys()][0];g.rows.set(key,g.rows.get(key)+' ');return receipt(d.body_utf8,g.review);};
  await g.client.open(g.review.native_request_id);await g.client.confirm();assert.equal(g.rows.size,2);assert.equal(g.client.getState().receipt,null);close(g);
 },
 async PANEL_INVALID_REFERENCE_refusesLocallyThenReviewsExactOriginal(){
  // Existing lightweight DOM fixture pattern; actual client/store, synthetic UNIT DATA only.
  class Node{
   constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.children=[];this.listeners=new Map();this.value='';this.disabled=false;this.textContent='';this.attrs={};}
   set innerHTML(_){throw new Error('arbitrary HTML forbidden');}setAttribute(k,v){this.attrs[k]=v;}
   appendChild(n){this.children.push(n);n.parent=this;return n;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
   addEventListener(k,f){this.listeners.set(k,f);}removeEventListener(k){this.listeners.delete(k);}
   click(){this.listeners.get('click')?.();}all(){return [this,...this.children.flatMap(n=>n.all())];}
  }
  const doc={createElement:tag=>new Node(tag,doc)},root=new Node('root',doc),f=fixture();
  f.review.native_request_id='abcdef01-2345-4234-9abc-abcdef012345';
  const unmount=mountInventorySeparationPanel(root,{client:f.client});
  try{
   const input=root.all().find(n=>n.tag==='input'),buttons=root.all().filter(n=>n.tag==='button');
   const message=root.all().find(n=>n.attrs.role==='status'),canonical=f.review.native_request_id;
   for(const entered of ['', 'not-a-uuid', ' ', ' '+canonical, canonical+' ', canonical+'\n', canonical.toUpperCase()]){
    input.value=entered;input.listeners.get('input')();buttons[0].click();
    await new Promise(r=>setImmediate(r));
    assert.equal(message.textContent,'Enter the exact canonical original native request UUID. No request was sent.');
    assert.equal(input.value,entered,'entered reference bytes are never normalized');
    assert.equal(f.calls.length,0);assert.equal(f.rows.size,0);
    assert.equal(f.client.getState().state,'IDLE');assert.equal(f.client.getState().busy,false);
    assert.equal(input.disabled,false);assert.equal(buttons[0].disabled,false);
    assert.equal(buttons[1].disabled,true);assert.equal(buttons[2].disabled,true);
   }
   input.value=canonical;input.listeners.get('input')();
   assert.equal(message.textContent,'Enter the exact original native request, then explicitly review.');
   buttons[0].click();for(let i=0;i<20&&f.client.getState().busy;i++)await new Promise(r=>setImmediate(r));
   assert.deepEqual(f.calls,[{method:'GET',path:API+'/reviews/'+canonical}]);
   assert.equal(f.client.getState().state,'REVIEW_ONLY');
   assert.equal(f.client.getState().review.native_request_id,canonical);assert.equal(input.value,canonical);
   assert.equal(buttons[1].disabled,false,'existing explicit confirmation remains separate from review');
   assert.equal(approvals(f).length,0);assert.equal(status(f).length,0);assert.equal(f.rows.size,0);
  }finally{unmount();f.store.close();}
 },
 async panel_explicit_and_text_only(){
  class Node{
   constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.children=[];this.listeners=new Map();this.value='';this.disabled=false;this.textContent='';this.attrs={};}
   set innerHTML(_){throw new Error('arbitrary HTML forbidden');}setAttribute(k,v){this.attrs[k]=v;}
   appendChild(n){this.children.push(n);n.parent=this;return n;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
   addEventListener(k,f){this.listeners.set(k,f);}removeEventListener(k){this.listeners.delete(k);}
   click(){this.listeners.get('click')?.();}all(){return [this,...this.children.flatMap(n=>n.all())];}
  }
  const doc={createElement:tag=>new Node(tag,doc)},root=new Node('root',doc),f=fixture();
  const unmount=mountInventorySeparationPanel(root,{client:f.client});assert.equal(f.calls.length,0);
  const input=root.all().find(n=>n.tag==='input'),buttons=root.all().filter(n=>n.tag==='button');input.value=f.review.native_request_id;
  buttons[0].click();for(let i=0;i<20&&f.client.getState().busy;i++)await new Promise(r=>setImmediate(r));
  assert.equal(approvals(f).length,0);assert.equal(buttons[1].disabled,false);
  const text=root.all().map(n=>n.textContent).join('\n');for(const n of NS)assert.ok(text.includes(n));
  assert.ok(text.includes('Synthetic employee <not HTML>'));assert.ok(text.includes('Keep ALL original work and keys'));
  input.value=uuid(90);input.listeners.get('input')();assert.equal(buttons[1].disabled,true);
  unmount();assert.equal(root.children.length,0);assert.equal(f.client.getState().state,'CLOSED');f.store.close();
 }
};
// Zero arguments runs the complete existing corpus; this literal list also
// refuses a deleted/renamed group instead of silently accepting 19 of 20.
const expectedGroups=[
  "MICRO_REVIEW_future_one_microsecond_start",
  "MICRO_REVIEW_expiry_one_microsecond_still_live",
  "MICRO_REVIEW_exact_start_and_expiry_boundaries",
  "MICRO_REVIEW_await_crossing_before_effect_and_after_retention",
  "MICRO_REVIEW_backward_clock_remains_sticky",
  "MICRO_REVIEW_malformed_and_unrepresentable_clock_refuses",
  "missing_original_never_reopens_confirmation",
  "exact_receipt_time_and_final_original",
  "queued_and_terminal_withdrawal",
  "confirm_original",
  "owner_session_withdrawal",
  "changed_review",
  "unknown_reload_status_only",
  "duplicate_tabs_and_claim",
  "resources_and_unknown_storage",
  "readonly_and_missing_session",
  "receipt_refusals",
  "response_owner_loss_and_raw_replacement",
  "PANEL_INVALID_REFERENCE_refusesLocallyThenReviewsExactOriginal",
  "panel_explicit_and_text_only"
];
const args=process.argv.slice(2);
assert.ok(args.length<=1,'Select zero or exactly one existing group; extra arguments are refused');
let selected;
if(args.length===0){
 assert.deepEqual(Object.keys(groups),expectedGroups,'The complete fixed 20-group corpus must remain present and ordered');
 selected=expectedGroups;
}else{
 assert.ok(Object.hasOwn(groups,args[0]),'Select exactly one NEW group: '+Object.keys(groups).join(', '));
 selected=args;
}
for(const name of selected){
 await groups[name]();console.log('PASS '+name+' — synthetic unit DATA only; no SQL/native/manager authority or external effects');
}
console.log(JSON.stringify({status:'PASS_ORIGINAL_INVENTORY_SEPARATION_UNIT_DATA',groups:selected.length,selected,
 scope:'All existing selected group bodies executed once; no SQL/native/manager authority or external effects'}));
