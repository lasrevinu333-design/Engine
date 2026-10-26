import {inventorySeparationApi as API,inventorySeparationPurpose as PURPOSE,
 inventorySeparationConfirmation as CONFIRMATION,inventorySeparationDeniedEffects as DENIED,
 validateInventorySeparationReview,validateInventorySeparationRequest,
 validateInventorySeparationReceipt} from './original-inventory-separation-wire.js';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const OWNER=['manager_id','manager_credential_id','manager_device_id','can_authorize','session_binding'];
const PORTS=['read','retainOriginal','takeForFirstDispatch','requireOriginal','retainReceipt'];
const failure=code=>Object.assign(new Error('inventory_separation_'+code),{code:'inventory_separation_'+code});
const equal=(a,b)=>{
 if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
};
function owner(currentOwner){
 const v=currentOwner(),o={};for(const k of OWNER){const d=v&&Object.getOwnPropertyDescriptor(v,k);
  if(!d||!Object.hasOwn(d,'value'))throw failure('owner_unavailable');o[k]=d.value;}
 if(typeof o.manager_id!=='string'||!UUID.test(o.manager_id)||typeof o.manager_credential_id!=='string'||!UUID.test(o.manager_credential_id)
  ||typeof o.manager_device_id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(o.manager_device_id)
  ||typeof o.can_authorize!=='boolean'||!(typeof o.session_binding==='string'&&o.session_binding.length>0
   ||o.session_binding!==null&&typeof o.session_binding==='object'))throw failure('owner_unavailable');
 return Object.freeze(o);
}
const issuerMatches=(i,o)=>i.manager_id===o.manager_id&&i.manager_credential_id===o.manager_credential_id&&i.manager_device_id===o.manager_device_id;
function requestMatches(r,v,o){return r.native_request_id===v.native_request_id&&r.expected_review_sha256===v.review_sha256
 &&r.expected_inventory_manifest_sha256===v.inventory_manifest_sha256&&r.expected_registration_receipt_sha256===v.registration_receipt_sha256
 &&r.expected_separation_authority_revision===v.original_target.separation_authority_revision
 &&r.expected_manager_id===o.manager_id&&r.expected_manager_credential_id===o.manager_credential_id&&r.expected_manager_device_id===o.manager_device_id;}

export function createInventorySeparationClient({request,currentOwner,originalStore}={}){
 const available=typeof request==='function'&&typeof currentOwner==='function'&&originalStore&&PORTS.every(k=>typeof originalStore[k]==='function');
 const ports=available?Object.fromEntries(PORTS.map(k=>[k,originalStore[k]])):{};
 let phase=available?'IDLE':'UNAVAILABLE',bound=null,review=null,id=null,body=null,receipt=null,busy=false,
  closed=false,halted=null,attempted=false,lastClock=null;
 const listeners=new Set();
 function refuse(code){halted=halted||failure(code);throw halted;}
 function current(){
  if(closed)throw failure('closed');if(halted)throw halted;if(!available)throw failure('unavailable');
  let now;try{now=owner(currentOwner);}catch{refuse('owner_unavailable');}
  if(bound&&!OWNER.every(k=>now[k]===bound[k]))refuse('owner_changed');
  if(PORTS.some(k=>originalStore[k]!==ports[k]))refuse('store_changed');return now;
 }
 function liveReview(){
  const now=Date.now();if(!Number.isSafeInteger(now)||lastClock!==null&&now<lastClock)refuse('clock_unavailable');
  let instant;try{
   const milliseconds=new Date(now).toISOString();
   if(!/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/.test(milliseconds))refuse('clock_unavailable');
   instant=milliseconds.slice(0,-1)+'000Z';
  }catch{refuse('clock_unavailable');}
  lastClock=now;
  // Fixed-width Gregorian UTC strings preserve all original microseconds.
  // This local payload-validity check is not clock or manager authority.
  if(!review||instant<review.reviewed_at||instant>=review.expires_at)throw failure('review_expired');
 }
 function getState(){
  let visible=false,canConfirm=false;
  try{const o=current();visible=bound!==null;
   if(visible&&review&&phase==='REVIEW_ONLY'&&!busy&&!attempted&&o.can_authorize){liveReview();canConfirm=true;}
  }catch{if(phase==='REVIEW_ONLY')phase='HELD';}
  return Object.freeze({state:closed?'CLOSED':halted?'HELD':phase,busy,review:visible?review:null,
   original_request:visible&&body?validateInventorySeparationRequest(JSON.parse(body)):null,
   receipt:visible?receipt:null,can_confirm:canConfirm,
   can_recover_original_status:visible&&body!==null&&!busy&&!closed&&!halted,
   limits:DENIED,note:'Server-reported DATA only. Keep all original work and keys. No phone release, work acceptance or replay.'});
 }
 function publish(){const v=getState();for(const fn of listeners){try{fn(v);}catch{ /* UI cannot change the owning result. */ }}}
 function start(){if(busy)throw failure('busy');const o=current();if(!bound)bound=o;busy=true;publish();return o;}
 async function awaited(effect){current();const result=await effect();current();return result;}
 async function store(method,...args){return awaited(()=>ports[method].apply(originalStore,args));}
 async function call(method,path,raw){
  const descriptor=Object.freeze({method,path,...(raw===undefined?{}:{body_utf8:raw})});
  return awaited(()=>request(descriptor));
 }
 function takeSaved(saved){
  if(!saved||typeof saved.body_utf8!=='string')refuse('original_unavailable');
  const r=validateInventorySeparationRequest(JSON.parse(saved.body_utf8)),v=validateInventorySeparationReview(saved.review);
  if(JSON.stringify(r)!==saved.body_utf8||r.native_request_id!==id||!requestMatches(r,v,bound)||!issuerMatches(v.issuer,bound)
   ||body!==null&&body!==saved.body_utf8||review!==null&&!equal(review,v))refuse('original_mismatch');
  body=saved.body_utf8;review=v;attempted=true;
 }
 async function accept(value){
  const v=validateInventorySeparationReceipt(value),r=validateInventorySeparationRequest(JSON.parse(body));
  if(!equal(v.original_request,r)||!requestMatches(r,review,bound)||!issuerMatches(v.issuer,bound)
   ||!equal(v.original_target,review.original_target)||v.inventory_manifest_sha256!==review.inventory_manifest_sha256
   ||v.registration_receipt_sha256!==review.registration_receipt_sha256
   // Both values have the wire's fixed-width Gregorian microsecond format;
   // compare every digit, without Date.parse truncating sub-millisecond pins.
   ||v.approved_at<review.reviewed_at||v.expires_at>review.expires_at)refuse('receipt_mismatch');
  // These equality/hash checks bind local DATA, not TLS/server/SQL authority.
  if(!globalThis.crypto?.subtle)throw failure('digest_unavailable');
  const digest=await awaited(()=>globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)));
  const hex=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  if(v.original_request_sha256!==hex||receipt!==null&&!equal(receipt,v))refuse('receipt_mismatch');
  await store('requireOriginal',id,body);await store('retainReceipt',id,body,v);
  const saved=await store('requireOriginal',id,body);
  if(!equal(saved.receipt,v))refuse('receipt_not_retained');receipt=v;phase='SERVER_REPORTED_RECORDED';
 }
 async function open(native_request_id){
  if(typeof native_request_id!=='string'||!UUID.test(native_request_id))throw failure('id_invalid');
  if(id!==null&&id!==native_request_id)throw failure('different_original_requires_new_client');
  start();id=native_request_id;phase='OPENING';publish();
  try{
   const saved=await store('read',id);
   if(saved!==null){takeSaved(saved);phase='UNKNOWN';if(saved.receipt)await accept(saved.receipt);}
   else{
    if(body!==null||attempted)refuse('original_missing');
    // Explicit Open reads a review only. Loading an original never sends even
    // this GET, and never performs an approval or status POST automatically.
    const v=validateInventorySeparationReview(await call('GET',API+'/reviews/'+id));
    if(v.native_request_id!==id||!issuerMatches(v.issuer,bound)||review!==null&&!equal(review,v))refuse('review_mismatch');
    review=v;liveReview();phase='REVIEW_ONLY';
   }
  }catch{phase=body?'UNKNOWN':'HELD';}finally{busy=false;publish();}
  return getState();
 }
 async function confirm(...args){
  if(args.length)throw failure('caller_request_forbidden');
  if(phase!=='REVIEW_ONLY'||!review||attempted||body)throw failure('original_status_only');
  const o=start();
  try{
   if(!o.can_authorize)throw failure('readonly');liveReview();
   if(await store('read',id)!==null)refuse('saved_original_conflict');
   const actual=validateInventorySeparationReview(await call('GET',API+'/reviews/'+id));
   if(!equal(review,actual)||!issuerMatches(actual.issuer,bound))refuse('review_changed');liveReview();current();
   if(typeof globalThis.crypto?.randomUUID!=='function')throw failure('uuid_unavailable');
   const requestId=globalThis.crypto.randomUUID();
   if(requestId===id||Object.values(review.original_target).includes(requestId))refuse('generated_id_conflict');
   const r=validateInventorySeparationRequest({schema:'custodial.original-inventory-separation-request.v1',request_id:requestId,
    native_request_id:id,expected_review_sha256:review.review_sha256,expected_inventory_manifest_sha256:review.inventory_manifest_sha256,
    expected_registration_receipt_sha256:review.registration_receipt_sha256,
    expected_separation_authority_revision:review.original_target.separation_authority_revision,
    expected_manager_id:bound.manager_id,expected_manager_credential_id:bound.manager_credential_id,
    expected_manager_device_id:bound.manager_device_id,decision:PURPOSE,manager_confirmation:CONFIRMATION});
   body=JSON.stringify(r);attempted=true;phase='RETAINING_UNKNOWN';publish();
   const claim=await store('retainOriginal',body,review);liveReview();
   const raw=await store('takeForFirstDispatch',claim);
   if(raw!==body)refuse('original_mismatch');liveReview();
   await store('requireOriginal',id,body);current();liveReview();phase='UNKNOWN';publish();
   await accept(await call('POST',API+'/approvals',body));
  }catch{phase=body?'UNKNOWN':'HELD';}finally{busy=false;publish();}
  return getState();
 }
 async function recoverOriginalStatus(...args){
  if(args.length)throw failure('caller_request_forbidden');
  if(!id||!body)throw failure('original_unavailable');start();phase='UNKNOWN';publish();
  try{
   const saved=await store('requireOriginal',id,body);takeSaved(saved);
   // The only recovery network action reads the exact original outcome. No
   // freshness renewal, new request ID, replacement approval or blind retry.
   await accept(await call('POST',API+'/approvals/original-status',body));
  }catch{phase='UNKNOWN';}finally{busy=false;publish();}return getState();
 }
 function subscribe(fn){if(typeof fn!=='function')throw new TypeError('listener required');listeners.add(fn);fn(getState());return()=>listeners.delete(fn);}
 function close(){if(closed)return;closed=true;phase='CLOSED';publish();listeners.clear(); /* Borrowed store remains owned by its shell. */}
 return Object.freeze({open,confirm,recoverOriginalStatus,getState,subscribe,close});
}
