(function(global,factory){
 'use strict';
 const api=factory(global);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else global.MemphisSameOriginalRecoveryOriginalStore=api;
})(typeof globalThis==='object'?globalThis:this,function(global){
 'use strict';
 // Unmounted local intent representation. Main supplies the actual protected
 // admission, storage firewall/prefix and authenticated owner. A checksum is
 // neither server acceptance nor permission to resend/finalize/native effects.
 const PREFIX='mz_same_original_recovery_original.v1:';
 const PURPOSE='AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION';
 const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
 const SHA=/^[a-f0-9]{64}$/,DEVICE=/^[A-Za-z0-9_-]{1,128}$/;
 const OWNER=['manager_id','manager_credential_id','manager_device_id','page_generation'];
 const REQUEST=['schema','request_id','challenge_id','expected_challenge_sha256','expected_preview_sha256',
  'expected_manager_id','expected_manager_credential_id','expected_manager_device_id','decision','manager_confirmation'];
 const INTENT_SCHEMA='custodial.same-original-recovery-original-intent.v1';
 const failure=code=>Object.assign(new Error('same_original_recovery_store_'+code),{code:'same_original_recovery_store_'+code});
 function exact(value,keys){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)throw failure('record_invalid');
  const actual=Reflect.ownKeys(value);
  if(actual.length!==keys.length||actual.some(k=>!keys.includes(k)))throw failure('record_invalid');
  const copy={};
  // Preserve original enumeration/serialization order, never canonicalize an
  // original body into a different order. Do not invoke saved/caller getters.
  for(const k of actual){const d=Object.getOwnPropertyDescriptor(value,k);
   if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw failure('record_invalid');copy[k]=d.value;}
  return copy;
 }
 function str(value,pattern){if(typeof value!=='string'||!pattern.test(value))throw failure('record_invalid');}
 function owner(value){const copy=exact(value,OWNER);
  if(!Object.isFrozen(value))throw failure('immutable_owner_required');
  str(copy.manager_id,UUID);str(copy.manager_credential_id,UUID);str(copy.manager_device_id,DEVICE);
  if(!(typeof copy.page_generation==='string'&&copy.page_generation.length>0&&copy.page_generation.length<=128)
   &&!(Number.isSafeInteger(copy.page_generation)&&copy.page_generation>=0))throw failure('record_invalid');
  return Object.freeze(copy);
 }
 function request(value,issuer){const copy=exact(value,REQUEST);
  if(copy.schema!=='custodial.same-original-recovery-approval-request.v1'||copy.decision!==PURPOSE
   ||copy.manager_confirmation!=='CONFIRM_THIS_SAME_ORIGINAL_ONLY')throw failure('record_invalid');
  for(const k of ['request_id','challenge_id','expected_manager_id','expected_manager_credential_id'])str(copy[k],UUID);
  str(copy.expected_challenge_sha256,SHA);str(copy.expected_preview_sha256,SHA);str(copy.expected_manager_device_id,DEVICE);
  if(copy.expected_manager_id!==issuer.manager_id||copy.expected_manager_credential_id!==issuer.manager_credential_id
   ||copy.expected_manager_device_id!==issuer.manager_device_id)throw failure('foreign_original');
  return Object.freeze(copy);
 }
 function decodeRequest(raw,issuer){
  if(typeof raw!=='string'||raw.length<1||raw.length>8192)throw failure('record_invalid');
  let parsed;try{parsed=JSON.parse(raw);}catch{throw failure('record_invalid');}
  const copy=request(parsed,issuer);
  // Reject duplicates, escaped aliases, whitespace, coercion and foreign data;
  // exact producer serialization must survive parsing byte-for-byte.
  if(JSON.stringify(copy)!==raw)throw failure('noncanonical_original');return copy;
 }
 const intentText=(raw,sha)=>JSON.stringify({schema:INTENT_SCHEMA,original_request_utf8:raw,original_request_utf8_sha256:sha});
 function decodeIntent(raw,issuer){
  if(typeof raw!=='string'||raw.length<1||raw.length>32768)throw failure('intent_invalid');
  let parsed;try{parsed=JSON.parse(raw);}catch{throw failure('intent_invalid');}
  const copy=exact(parsed,['schema','original_request_utf8','original_request_utf8_sha256']);
  if(copy.schema!==INTENT_SCHEMA)throw failure('intent_invalid');str(copy.original_request_utf8_sha256,SHA);
  const original=decodeRequest(copy.original_request_utf8,issuer);
  if(intentText(copy.original_request_utf8,copy.original_request_utf8_sha256)!==raw)throw failure('noncanonical_intent');
  return {original,raw:copy.original_request_utf8,sha:copy.original_request_utf8_sha256};
 }
 function createSameOriginalRecoveryOriginalStore({storage,currentOwner,mutate}={}){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'
   ||typeof currentOwner!=='function'||typeof mutate!=='function')throw new TypeError('Protected original storage, current owner and mutate ports are required');
  const getItem=storage.getItem,setItem=storage.setItem,bound=owner(currentOwner());
  const stem=PREFIX+bound.manager_id+':'+bound.manager_credential_id+':'+bound.manager_device_id;
  const originalKey=stem+':original',intentKey=stem+':intent';
  let halted=null,observedOriginal=null,observedIntent=null;
  function hold(code){halted=halted||failure(code);throw halted;}
  function current(){
   if(halted)throw halted;
   let now;try{now=owner(currentOwner());}catch{hold('owner_unavailable');}
   if(!OWNER.every(k=>now[k]===bound[k]))hold('owner_changed');
   if(storage.getItem!==getItem||storage.setItem!==setItem)hold('storage_interface_changed');
  }
  async function awaited(effect){current();const result=await effect();current();return result;}
  function pair(){current();let original,intent;
   try{original=getItem.call(storage,originalKey);intent=getItem.call(storage,intentKey);}catch{hold('storage_read_unknown');}
   current();
   if(original!==null&&typeof original!=='string'||intent!==null&&typeof intent!=='string')hold('storage_read_ambiguous');
   if(observedOriginal!==null&&original!==observedOriginal)hold(original===null?'original_missing_after_observation':'original_changed');
   if(observedIntent!==null&&intent!==observedIntent)hold(intent===null?'intent_missing_after_observation':'intent_changed');
   if(original!==null)observedOriginal=original;if(intent!==null)observedIntent=intent;
   return {original,intent};
  }
  function same(a,b){return a.original===b.original&&a.intent===b.intent;}
  function requirePair(expected){const actual=pair();if(!same(actual,expected))hold('raw_compare_failed');return actual;}
  async function digest(raw){
   if(!global.crypto?.subtle)hold('webcrypto_unavailable');
   const bytes=new TextEncoder().encode(raw);
   const hash=await awaited(()=>global.crypto.subtle.digest('SHA-256',bytes));
   current();
   return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  function write(key,value,expected){
   requirePair(expected);current(); // Immediately before each synchronous write.
   try{setItem.call(storage,key,value);}catch{hold('storage_write_unknown');}
   current();
  }
  async function readOriginal(){
   current();const before=pair();
   if(before.original===null&&before.intent===null){requirePair(before);current();return null;}
   let decoded;try{
    if(before.intent===null)throw failure('original_without_intent');
    decoded=decodeIntent(before.intent,bound);
    if(before.original!==null){decodeRequest(before.original,bound);if(before.original!==decoded.raw)throw failure('original_intent_conflict');}
   }catch(error){hold(error.code?.replace('same_original_recovery_store_','')||'record_invalid');}
   const sha=await digest(decoded.raw);requirePair(before);current();
   if(sha!==decoded.sha)hold('intent_digest_mismatch');
   // A durable intent without a final row is also an exact saved original for
   // status-only recovery. Never repair it, delete it, or authorize a new POST.
   return decoded.original;
  }
  async function retainOriginal(value){
   current();const copy=request(value,bound),raw=JSON.stringify(copy);
   if(raw.length>8192)throw failure('record_invalid');
   const sha=await digest(raw),marker=intentText(raw,sha);let entered=false;
   try{
    await awaited(()=>mutate(()=>{
     if(entered)hold('mutation_reentered');entered=true;current();const before=pair();
     if(before.intent!==null||before.original!==null){
      if(before.intent!==marker||before.original!==raw)hold(before.intent===marker&&before.original===null?'intent_status_only':'original_conflict');
      // Same-byte idempotent retention verifies both original records again;
      // it does not overwrite even its own marker/final row.
      requirePair(before);current();return;
     }
     write(intentKey,marker,before);
     const staged={original:null,intent:marker};requirePair(staged);current();
     write(originalKey,raw,staged);
     requirePair({original:raw,intent:marker});current();
    },{timeoutMs:5000}));
    if(!entered)hold('mutation_not_entered');current();
   }catch(error){if(!halted)halted=failure('mutation_unconfirmed');throw halted;}
  }
  return Object.freeze({retainOriginal,readOriginal});
 }
 return Object.freeze({createSameOriginalRecoveryOriginalStore});
});
