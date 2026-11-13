import {validateInventorySeparationRequest, validateInventorySeparationReview,
 validateInventorySeparationReceipt} from './original-inventory-separation-wire.js';

// Local UNKNOWN/receipt DATA, never an authenticated manager or native grant.
// Main supplies the original raw storage and shared Web Locks resources. No
// localStorage fallback, removeItem, rollback, repair or automatic resend.
const PREFIX='mz_original_inventory_separation.v1:';
const FIELDS=['manager_id','manager_credential_id','manager_device_id','can_authorize','session_binding'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fail=code=>Object.assign(new Error('inventory_separation_store_'+code),{code:'inventory_separation_store_'+code});
function owner(port){
 const source=port(),copy={};
 for(const key of FIELDS){const d=source&&Object.getOwnPropertyDescriptor(source,key);
  if(!d||!Object.hasOwn(d,'value'))throw fail('owner_unavailable');copy[key]=d.value;}
 if(typeof copy.manager_id!=='string'||!UUID.test(copy.manager_id)||typeof copy.manager_credential_id!=='string'
  ||!UUID.test(copy.manager_credential_id)||typeof copy.manager_device_id!=='string'
  ||!/^[A-Za-z0-9_-]{1,128}$/.test(copy.manager_device_id)||typeof copy.can_authorize!=='boolean'
  ||!(typeof copy.session_binding==='string'&&copy.session_binding.length>0
   ||copy.session_binding!==null&&typeof copy.session_binding==='object'))throw fail('owner_unavailable');
 return Object.freeze(copy);
}
const same=(a,b)=>FIELDS.every(k=>a[k]===b[k]);
const jsonEqual=(a,b)=>{
 if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&jsonEqual(a[k],b[k]));
};
function boundRequest(request,review,o){
 if(request.native_request_id!==review.native_request_id||request.expected_review_sha256!==review.review_sha256
  ||request.expected_inventory_manifest_sha256!==review.inventory_manifest_sha256
  ||request.expected_registration_receipt_sha256!==review.registration_receipt_sha256
  ||request.expected_separation_authority_revision!==review.original_target.separation_authority_revision
  ||request.expected_manager_id!==o.manager_id||request.expected_manager_credential_id!==o.manager_credential_id
  ||request.expected_manager_device_id!==o.manager_device_id
  ||review.issuer.manager_id!==o.manager_id||review.issuer.manager_credential_id!==o.manager_credential_id
  ||review.issuer.manager_device_id!==o.manager_device_id)throw fail('foreign_original');
}
function original(raw,o,id){
 if(typeof raw!=='string'||raw.length>65536)throw fail('original_invalid');
 const p=JSON.parse(raw);
 if(!p||Object.keys(p).join(',')!=='schema,phase,original_request_utf8,review'
  ||p.schema!=='custodial.original-inventory-separation-local-original.v1'||p.phase!=='UNKNOWN')throw fail('original_invalid');
 const r=validateInventorySeparationRequest(JSON.parse(p.original_request_utf8)),v=validateInventorySeparationReview(p.review);
 if(JSON.stringify(r)!==p.original_request_utf8||JSON.stringify(p)!==raw||r.native_request_id!==id)throw fail('original_invalid');
 boundRequest(r,v,o);return Object.freeze({body_utf8:p.original_request_utf8,review:v});
}

export function createInventorySeparationOriginalStore({storage,locks,currentOwner}={}){
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'
  ||!locks||typeof locks.request!=='function'||typeof currentOwner!=='function')throw fail('resources_unavailable');
 const get=storage.getItem,set=storage.setItem,lock=locks.request,bound=owner(currentOwner);
 const stem=PREFIX+bound.manager_id+':'+bound.manager_credential_id+':'+bound.manager_device_id+':';
 const seen=new Map(),claims=new WeakMap();let halted=null,closed=false;
 function stop(code){halted=halted||fail(code);throw halted;}
 function current(){
  if(halted)throw halted;if(closed)stop('closed');
  let now;try{now=owner(currentOwner);}catch{stop('owner_unavailable');}
  if(!same(now,bound))stop('owner_changed');
  if(storage.getItem!==get||storage.setItem!==set||locks.request!==lock)stop('resource_changed');
 }
 function key(id){if(typeof id!=='string'||!UUID.test(id))throw fail('id_invalid');return stem+id;}
 function pair(id){current();const k=key(id);let p;
   try{p={original:get.call(storage,k+':original'),request:get.call(storage,k+':request'),receipt:get.call(storage,k+':receipt')};}catch{stop('read_unknown');}
  current();if(Object.values(p).some(x=>x!==null&&typeof x!=='string'))stop('read_unknown');
  const old=seen.get(k);if(old&&!equalPair(old,p))stop('original_changed');
  seen.set(k,p);return p;
 }
 function equalPair(a,b){return a.original===b.original&&a.request===b.request&&a.receipt===b.receipt;}
 function exactPair(id,p){if(!equalPair(pair(id),p))stop('raw_changed');}
 async function locked(id,effect){
  current();let entered=false,settled=false;
  try{const value=await lock.call(locks,key(id),{mode:'exclusive'},async actual=>{
   if(entered||!actual||actual.mode!=='exclusive'||actual.name!==key(id))stop('lock_unavailable');
   entered=true;current();const result=await effect();current();settled=true;return result;
  });current();if(!entered||!settled)stop('lock_unconfirmed');return value;
  }catch(error){if(!halted)halted=fail('operation_unknown');throw halted;}
 }
 function write(id,suffix,value,p){
  exactPair(id,p);current();
  try{set.call(storage,key(id)+suffix,value);}catch{stop('write_unknown');}
  current();const expected={...p,[suffix.slice(1)]:value};
  // Only this exact synchronous own write may advance the observed vector.
  seen.set(key(id),expected);exactPair(id,expected);return expected;
 }
 function decode(id,p){
  if(p.original===null){if(p.request!==null||p.receipt!==null)stop('partial_original_retained');return null;}
  let v;try{v=original(p.original,bound,id);
   // A surviving UNKNOWN is sufficient for original-status only, even if
   // publication of the second raw request row never completed. Never repair
   // or reissue it. A contradictory row refuses, rather than choosing latest.
   if(p.request!==null&&p.request!==v.body_utf8)throw fail('request_conflict');
   if(p.receipt!==null){const r=validateInventorySeparationReceipt(JSON.parse(p.receipt));
    if(!jsonEqual(r.original_request,JSON.parse(v.body_utf8))||!jsonEqual(r.original_target,v.review.original_target)
     ||JSON.stringify(r)!==p.receipt)throw fail('receipt_conflict');}
  }catch{stop('record_invalid');}
  return Object.freeze({...v,receipt:p.receipt===null?null:validateInventorySeparationReceipt(JSON.parse(p.receipt))});
 }
 async function read(id){return locked(id,()=>{const p=pair(id),v=decode(id,p);exactPair(id,p);return v;});}
 async function retainOriginal(body_utf8,review){
  current();if(bound.can_authorize!==true)stop('readonly');
  const r=validateInventorySeparationRequest(JSON.parse(body_utf8)),v=validateInventorySeparationReview(review);
  if(JSON.stringify(r)!==body_utf8)throw fail('noncanonical_request');boundRequest(r,v,bound);
  const raw=JSON.stringify({schema:'custodial.original-inventory-separation-local-original.v1',phase:'UNKNOWN',original_request_utf8:body_utf8,review:v});
  // Validate the exact representation before its only write.
  original(raw,bound,r.native_request_id);
  return locked(r.native_request_id,()=>{
   const p=pair(r.native_request_id);
   if(p.original!==null||p.request!==null||p.receipt!==null)stop('original_status_only');
   const unknown=write(r.native_request_id,':original',raw,p);current();
   const committed=write(r.native_request_id,':request',body_utf8,unknown);current();
   const claim=Object.freeze({});claims.set(claim,{id:r.native_request_id,body_utf8,p:committed,taken:false});return claim;
  });
 }
 async function takeForFirstDispatch(claim){
  const c=claims.get(claim);if(!c||c.taken)stop('first_claim_unavailable');
  c.taken=true; // Consume before validation, lock acquisition or any effect.
  return locked(c.id,()=>{exactPair(c.id,c.p);decode(c.id,c.p);current();return c.body_utf8;});
 }
 async function requireOriginal(id,body_utf8){return locked(id,()=>{
  const p=pair(id),v=decode(id,p);if(!v||v.body_utf8!==body_utf8)stop('original_changed');exactPair(id,p);return v;
 });}
 async function retainReceipt(id,body_utf8,value){
  const r=validateInventorySeparationReceipt(value),raw=JSON.stringify(r);
  return locked(id,()=>{const p=pair(id),v=decode(id,p);
   if(!v||v.body_utf8!==body_utf8||!jsonEqual(r.original_request,JSON.parse(body_utf8))
    ||!jsonEqual(r.original_target,v.review.original_target))stop('receipt_conflict');
   if(p.receipt!==null){if(p.receipt!==raw)stop('receipt_conflict');exactPair(id,p);return;}
   write(id,':receipt',raw,p);
  });
 }
 return Object.freeze({read,retainOriginal,takeForFirstDispatch,requireOriginal,retainReceipt,
  close(){closed=true;}});
}
