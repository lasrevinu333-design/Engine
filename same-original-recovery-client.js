(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MemphisSameOriginalRecovery=api;
})(typeof globalThis==='object'?globalThis:this,function(root){
 'use strict';
 // Unmounted representation/UI controller. Main alone supplies authenticated
 // full-owner + Security Admin + same-credential password-session/CSRF ports.
 // Neither document hashes nor the owner tuple authenticate those prerequisites.
 const PURPOSE='AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION',ADMISSION='same-original-preparation.v1';
 const PATH='/admin-api/device-security/same-original-recovery/';
 const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
 const SHA=/^[a-f0-9]{64}$/,DEVICE=/^[A-Za-z0-9_-]{1,128}$/;
 const LIMITS=Object.freeze({inventory_acknowledged:false,work_accepted:false,replay_allowed:false,
  finalizer_allowed:false,key_removal:false,phone_released:false});
 const TARGET=['operation_id','separation_id','separation_authority_revision','canonical_device_pk','canonical_device_id',
  'employee_id','credential_id','assignment_epoch','original_generation_id','original_credential_secret_key_id',
  'principal_digest','engine_revision','original_wire_sha256','original_frozen_work_sha256','capsule_sha256','record_sha256',
  'frame_sha256','plan_sha256','aad_binding_sha256','source_capture_sha256','values_sha256','semantic_join_sha256','layout_sha256'];
 const REQUEST=['schema','request_id','challenge_id','expected_challenge_sha256','expected_preview_sha256',
  'expected_manager_id','expected_manager_credential_id','expected_manager_device_id','decision','manager_confirmation'];
 const PREVIEW=['schema','state','purpose','challenge_id','challenge_sha256','preview_sha256','original_target','expires_at','limits'];
 const RECEIPT=['schema','state','approval_id','original_request','original_request_sha256','issuer','challenge_sha256',
  'preview_sha256','original_target','purpose_admission_id','issued_at','expires_at','receipt_sha256','retry_safe','limits'];
 const OWNER=['manager_id','manager_credential_id','manager_device_id','page_generation'];
 const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
 const invalid=()=>fail('same_original_recovery_wire_invalid');
 function own(value,keys){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)invalid();
  const fields=Reflect.ownKeys(value);if(fields.length!==keys.length||fields.some(k=>!keys.includes(k)))invalid();
  const copy={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);
   if(!d||!Object.hasOwn(d,'value')||!d.enumerable)invalid();copy[key]=d.value;}
  return copy;
 }
 function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
 function text(value,pattern){if(typeof value!=='string'||!pattern.test(value))invalid();return value;}
 function decimal(value,zero=false){text(value,zero?/^(?:0|[1-9][0-9]*)$/:/^[1-9][0-9]*$/);
  if(value.length>16||BigInt(value)>9007199254740991n)invalid();}
 function instant(value){
  text(value,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  const [y,m,d,h,n,s,u]=value.match(/\d+/g).map(Number),leap=y%4===0&&(y%100!==0||y%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(y<1||m<1||m>12||d<1||d>days[m-1]||h>23||n>59||s>59)invalid();
  const p=y-1,ordinal=365*p+Math.floor(p/4)-Math.floor(p/100)+Math.floor(p/400)+days.slice(0,m-1).reduce((a,b)=>a+b,0)+d-1;
  return(BigInt(ordinal)*86400n+BigInt(h*3600+n*60+s))*1000000n+BigInt(u);
 }
 function target(value){const v=own(value,TARGET);for(const k of TARGET){
  if(['operation_id','separation_id','canonical_device_pk','employee_id','credential_id','original_generation_id'].includes(k))text(v[k],UUID);
  else if(['separation_authority_revision','assignment_epoch'].includes(k))decimal(v[k]);
  else if(k==='engine_revision')decimal(v[k],true);
  else if(k==='canonical_device_id')text(v[k],/^KIOSK_0[2-9]$|^KIOSK_10$/);else text(v[k],SHA);
 }return v;}
 function limits(value){const v=own(value,Object.keys(LIMITS));for(const k of Object.keys(LIMITS))if(v[k]!==false)invalid();return v;}
 function approvalRequest(value){const v=own(value,REQUEST);
  if(v.schema!=='custodial.same-original-recovery-approval-request.v1'||v.decision!==PURPOSE
   ||v.manager_confirmation!=='CONFIRM_THIS_SAME_ORIGINAL_ONLY')invalid();
  for(const k of ['request_id','challenge_id','expected_manager_id','expected_manager_credential_id'])text(v[k],UUID);
  for(const k of ['expected_challenge_sha256','expected_preview_sha256'])text(v[k],SHA);
  text(v.expected_manager_device_id,DEVICE);return freeze(v);
 }
 function preview(value){const v=own(value,PREVIEW);
  if(v.schema!=='custodial.same-original-recovery-review.v1'||v.state!=='ORIGINAL_BINDING_REVIEW_ONLY'||v.purpose!==PURPOSE)invalid();
  text(v.challenge_id,UUID);text(v.challenge_sha256,SHA);text(v.preview_sha256,SHA);instant(v.expires_at);
  v.original_target=target(v.original_target);v.limits=limits(v.limits);return freeze(v);
 }
 function receipt(value){const v=own(value,RECEIPT);
  if(v.schema!=='custodial.same-original-recovery-approval-receipt.v1'||v.state!=='APPROVAL_RECORDED_ONLY'
   ||v.purpose_admission_id!==ADMISSION||v.retry_safe!==false)invalid();
  text(v.approval_id,UUID);v.original_request=approvalRequest(v.original_request);v.original_target=target(v.original_target);
  for(const k of ['original_request_sha256','challenge_sha256','preview_sha256','receipt_sha256'])text(v[k],SHA);
  v.issuer=own(v.issuer,OWNER.slice(0,3));text(v.issuer.manager_id,UUID);text(v.issuer.manager_credential_id,UUID);text(v.issuer.manager_device_id,DEVICE);
  if(!sameIssuer(v.original_request,v.issuer)||v.original_request.expected_challenge_sha256!==v.challenge_sha256
   ||v.original_request.expected_preview_sha256!==v.preview_sha256)invalid();
  const duration=instant(v.expires_at)-instant(v.issued_at);if(duration<=0n||duration>300000000n)invalid();
  v.limits=limits(v.limits);return freeze(v);
 }
 // Exact purpose-local ASCII-key UTF8 representation; never authentication.
 function canonical(value){if(typeof value==='string'||typeof value==='boolean'||value===null)return JSON.stringify(value);
  return'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
 const equal=(a,b)=>canonical(a)===canonical(b);
 const sameOwner=(a,b)=>OWNER.every(k=>a[k]===b[k]);
 function sameIssuer(r,o){return r.expected_manager_id===o.manager_id&&r.expected_manager_credential_id===o.manager_credential_id
  &&r.expected_manager_device_id===o.manager_device_id;}
 function owner(value){
  if(value===null)fail('same_original_recovery_current_owner_unavailable',403);
  const v=own(value,OWNER);if(!Object.isFrozen(value))fail('same_original_recovery_immutable_owner_required',403);
  text(v.manager_id,UUID);text(v.manager_credential_id,UUID);text(v.manager_device_id,DEVICE);
  if(!(typeof v.page_generation==='string'&&v.page_generation.length>0&&v.page_generation.length<=128)
   &&!(Number.isSafeInteger(v.page_generation)&&v.page_generation>=0))invalid();
  return freeze(v);
 }
 function createSameOriginalRecoveryController({request,currentOwner,retainOriginal,readOriginal}={}){
  const available=[request,currentOwner,retainOriginal,readOriginal].every(p=>typeof p==='function');
  let phase=available?'IDLE':'UNAVAILABLE',busy=false,closed=false,epoch=0,reviewed=null,reviewOwner=null,
   original=null,recorded=null,retentionConfirmed=false,attempted=false;
  const current=()=>owner(currentOwner());
  function token(){if(!available)fail('same_original_recovery_ports_unavailable',503);if(closed)fail('same_original_recovery_closed');return{owner:current(),epoch};}
  function check(t){if(closed||epoch!==t.epoch||!sameOwner(current(),t.owner))fail('same_original_recovery_owner_changed',403);}
  async function awaited(t,effect){check(t);const v=await effect();check(t);return v;}
  async function hash(t,kind,value){
   if(!root.crypto?.subtle)fail('same_original_recovery_webcrypto_unavailable',503);
   const v={...value};if(kind==='preview')delete v.preview_sha256;if(kind==='receipt')delete v.receipt_sha256;
   const bytes=new TextEncoder().encode('custodial.same-original-recovery-'+kind+'.v1\n'+canonical(v));
   const result=await awaited(t,()=>root.crypto.subtle.digest('SHA-256',bytes));
   return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');
  }
  function view(){let visible=false;try{visible=available&&!closed&&reviewOwner!==null&&sameOwner(current(),reviewOwner);}catch{}
   return freeze({state:closed?'CLOSED':!available?'UNAVAILABLE':!visible&&reviewOwner?'HELD':phase,
    purpose:PURPOSE,purpose_admission_id:ADMISSION,
    original_target:visible?(recorded?.original_target||reviewed?.original_target||null):null,
    server_expires_at:visible?(recorded?.expires_at||reviewed?.expires_at||null):null,
    issued_at:visible?(recorded?.issued_at||null):null,
    original_request:visible?original:null,receipt:visible?recorded:null,
    retention_confirmed:retentionConfirmed,can_confirm:visible&&phase==='REVIEW_ONLY'&&!attempted&&!busy,
    can_read_original_status:visible&&original!==null&&!busy,retry_safe:false,limits:LIMITS,
    note:'Preparation metadata only. Server expiry is displayed unchanged; browser time grants no authority. Original-status only after retention; no native effects.'});
  }
  function start(){if(busy)fail('same_original_recovery_busy');const t=token();busy=true;return t;}
  async function invoke(t,method,path,body){return awaited(t,()=>request(Object.freeze({method,path,...(body===undefined?{}:{body})})));}
  async function acceptReceipt(t,value){
   const v=receipt(value);
   if(!equal(v.original_request,original)||!sameIssuer(original,t.owner))invalid();
   if(reviewed&&(!equal(v.original_target,reviewed.original_target)||v.challenge_sha256!==reviewed.challenge_sha256
    ||v.preview_sha256!==reviewed.preview_sha256||instant(v.expires_at)>instant(reviewed.expires_at)))invalid();
   if(v.original_request_sha256!==await hash(t,'request',original)||v.receipt_sha256!==await hash(t,'receipt',v))invalid();
   check(t);if(recorded&&!equal(recorded,v))invalid();recorded=v;phase='RECORDED';
  }
  async function review(challengeId){
   text(challengeId,UUID);if(original||attempted)fail('same_original_recovery_original_status_only');const t=start();
   try{
    phase='REVIEWING';reviewOwner=t.owner;
    const saved=await awaited(t,()=>readOriginal());if(saved!==null){phase='HELD';return view();}
    const v=preview(await invoke(t,'GET',PATH+'challenges/'+challengeId));
    if(v.challenge_id!==challengeId||v.preview_sha256!==await hash(t,'preview',v))invalid();
    if(reviewed?.challenge_id===challengeId&&!equal(reviewed,v))invalid();
    check(t);reviewed=v;phase='REVIEW_ONLY';
   }catch{phase='HELD';}finally{busy=false;}return view();
  }
  async function confirm(...args){
   if(args.length)fail('same_original_recovery_caller_request_forbidden');
   if(phase!=='REVIEW_ONLY'||!reviewed||attempted||original)fail('same_original_recovery_original_status_only');
   const t=start();
   try{
    if(!sameOwner(t.owner,reviewOwner))fail('same_original_recovery_owner_changed',403);
    const saved=await awaited(t,()=>readOriginal());if(saved!==null)fail('same_original_recovery_saved_original_conflict');
    check(t);if(!root.crypto?.randomUUID)fail('same_original_recovery_random_uuid_unavailable',503);
    const requestId=root.crypto.randomUUID();if(TARGET.some(k=>reviewed.original_target[k]===requestId))invalid();
    original=approvalRequest({schema:'custodial.same-original-recovery-approval-request.v1',request_id:requestId,
     challenge_id:reviewed.challenge_id,expected_challenge_sha256:reviewed.challenge_sha256,expected_preview_sha256:reviewed.preview_sha256,
     expected_manager_id:t.owner.manager_id,expected_manager_credential_id:t.owner.manager_credential_id,
     expected_manager_device_id:t.owner.manager_device_id,decision:PURPOSE,manager_confirmation:'CONFIRM_THIS_SAME_ORIGINAL_ONLY'});
    attempted=true;phase='SAVING_ORIGINAL';
    await awaited(t,()=>retainOriginal(original));
    const persisted=approvalRequest(await awaited(t,()=>readOriginal()));if(!equal(persisted,original))invalid();
    retentionConfirmed=true;phase='CONFIRMING';
    await acceptReceipt(t,await invoke(t,'POST',PATH+'approvals',original));
   }catch{phase=original?'UNKNOWN':'HELD';}finally{busy=false;}return view();
  }
  async function resume(...args){
   if(args.length)fail('same_original_recovery_caller_request_forbidden');const t=start();
   try{
    reviewOwner=t.owner;const saved=approvalRequest(await awaited(t,()=>readOriginal()));
    if(!sameIssuer(saved,t.owner)||original&&!equal(original,saved))invalid();
    original=saved;attempted=true;retentionConfirmed=true;phase='UNKNOWN';
    await acceptReceipt(t,await invoke(t,'POST',PATH+'approvals/original-status',original));
   }catch{phase='UNKNOWN';}finally{busy=false;}return view();
  }
  return Object.freeze({getState:view,review,confirm,resume,dispose(){closed=true;epoch++;reviewed=null;recorded=null;phase='CLOSED';}});
 }
 return Object.freeze({createSameOriginalRecoveryController});
});
