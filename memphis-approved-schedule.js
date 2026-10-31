(function(root){
'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH=/^[a-f0-9]{64}$/;
const COPY=x=>JSON.parse(JSON.stringify(x));
const paths={initial:'/static-weekly/approved-initial',recurring:'/static-weekly/recurring-adaptation'};
const schemas={initial:'custodial.approved-static-initial',recurring:'custodial.approved-static'};
const error=message=>{throw new Error(message);};
function monday(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value&&d.getUTCDay()===1;}
function selectors(kind,input){
 if(!Object.hasOwn(paths,kind)||!input||!monday(input.effective_start)||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0)error('Invalid approved schedule selection.');
 const keys=kind==='initial'?['source_id','template_id','effective_start','expected_revision']:['effective_start','expected_revision',...(Object.hasOwn(input,'template_id')?['template_id']:[])];
 if(Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k)))error('Schedule requests accept approved source identities only.');
 if(kind==='initial'&&!UUID.test(input.source_id||''))error('Select the registered approved baseline.');
 if(Object.hasOwn(input,'template_id')&&(typeof input.template_id!=='string'||!input.template_id.trim()||input.template_id!==input.template_id.trim()||input.template_id.length>128))error('Invalid approved template identity.');
 return COPY(input);
}
function validatePreview(kind,value,input,snapshot){
 const selected=selectors(kind,input);
 const view=value?.constraintView;
 if(value?.schema!==schemas[kind]+'-preview.v1'||value.status!=='PREVIEW_ONLY'||value.published!==false||value.solverInvoked!==false
  ||value.serviceDate!==selected.effective_start||value.authorityRevision!==selected.expected_revision||!HASH.test(value.previewDigest||'')
  ||typeof value.templateId!=='string'||!value.templateId||!Array.isArray(value.assignments)||!value.assignments.length||value.assignments.length>10000
  ||!Array.isArray(value.lunch?.loans)||!Array.isArray(value.lunch?.responsibilities)||value.lunch.loans.length>1000||value.lunch.responsibilities.length>10000
  ||!value.mapping||typeof value.mapping!=='object'
  ||view?.schema!=='custodial.approved-static-constraint-view.v1'
  ||view.contract!=='FIXED_APPROVED_PATTERN_COMPLETE_HARD_CONSTRAINTS_NOT_OPTIMALITY'
  ||!HASH.test(view.hardConstraintDigest||'')||!HASH.test(view.physicalCoverageDigest||'')||!HASH.test(view.mappingDigest||'')
  ||!Number.isSafeInteger(view.hardConstraintCount)||view.hardConstraintCount<1
  ||!Array.isArray(view.slotAvailability)||!view.slotAvailability.length||!Array.isArray(view.projectionAvailability)||!view.projectionAvailability.length
  ||view.balance?.optimized!==false||view.opening?.proven!==false)error('The approved schedule preview is incomplete or mismatched. Nothing was published.');
 if(selected.template_id&&value.templateId!==selected.template_id)error('The approved template changed.');
 if(kind==='initial'&&value.sourceId!==selected.source_id)error('The registered baseline changed.');
 if(kind==='recurring'&&value.sourcePublicationId!==snapshot?.current_publication?.publication_id)error('The published pattern changed.');
 const start=Date.parse(selected.effective_start+'T12:00:00Z'),seen=new Set();
 for(const row of value.assignments){
  const key=row?.planWorkId,at=Date.parse(String(row?.serviceDate)+'T12:00:00Z');
  if(typeof key!=='string'||!key||seen.has(key)||!Number.isFinite(at)||at<start||at>=start+7*86400000
   ||!['ASSIGNED','OPEN'].includes(row.status)||!row.window||typeof row.window.start!=='string'||typeof row.window.end!=='string'
   ||(row.status==='ASSIGNED'&&(!UUID.test(row.personId||'')||!UUID.test(row.slotId||'')))
   ||(row.status==='OPEN'&&(row.personId!==null||row.slotId!==null)))error('The returned duties contain invalid or repeated identities.');
  seen.add(key);
 }
 return COPY(value);
}
function validateReceipt(kind,receipt,body){
 if(receipt?.schema!==schemas[kind]+'-confirmation.v1'||!['PERSISTED_CURRENT','ACCEPTED_ORIGINAL_RECEIPT'].includes(receipt.status)
  ||receipt.ok!==true||receipt.persistence_status!=='PERSISTED'||receipt.solverInvoked!==false
  ||!UUID.test(receipt.publication_id||'')||!UUID.test(receipt.projection_id||'')||!HASH.test(receipt.lunch_document_identity||'')
  ||!Number.isSafeInteger(receipt.authority_revision)||receipt.authority_revision<=body.expected_revision
  ||receipt.previewDigest!==body.preview_digest)error('Schedule acceptance is not verified. Keep the exact saved request; do not publish again.');
 if(kind==='initial'&&receipt.source_id!==body.source_id)error('Accepted baseline source mismatch.');
 return COPY(receipt);
}
const unresolvedReasons=Object.freeze({
 NO_ELIGIBLE_INTERVAL_OWNER:'No eligible employee can cover this interval.',
 ORIGINAL_BUDGET_INSUFFICIENT_FOR_POSITIVE_SEGMENTS:'The original workload budget cannot cover the required positive segments.',
 NAMED_HANDOFF_UNAVAILABLE:'The required named handoff is unavailable.',
 FIXED_VISIT_REQUIRES_SINGLE_AVAILABLE_OWNER:'This fixed visit needs one employee available for its whole window.',
 LOCKED_PARENT_UNAVAILABLE:'The locked original duty owner is unavailable.'
});
function validateUnresolvedPreview(value,binding){
 const bad=()=>error('The unresolved preview is malformed or no longer matches the original selection. Nothing can be confirmed.');
 const data=(v,keys)=>{
  if(!v||typeof v!=='object'||Array.isArray(v)||Reflect.ownKeys(v).length!==keys.length
   ||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!keys.includes(k)))bad();
  const result={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value'))bad();result[key]=d.value;}return result;
 };
 const wanted=data(binding,['sourcePublicationId','authorityRevision','serviceDate','kind','templateId']);
 const v=data(value,['schema','status',...Object.keys(wanted),'unresolved']);
 const date=typeof v.serviceDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.serviceDate)?new Date(v.serviceDate+'T12:00:00Z'):null;
 if(v.schema!=='custodial.approved-static-unresolved-preview.v1'||v.status!=='UNRESOLVED'||v.kind!=='DATED_ABSENCE'
  ||typeof v.sourcePublicationId!=='string'||!UUID.test(v.sourcePublicationId)
  ||!Number.isSafeInteger(v.authorityRevision)||v.authorityRevision<0||!date||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==v.serviceDate
  ||!(v.templateId===null||typeof v.templateId==='string'&&v.templateId.trim()===v.templateId&&v.templateId.length>0&&v.templateId.length<=128)
  ||Object.keys(wanted).some(key=>v[key]!==wanted[key]))bad();
 const rows=v.unresolved;if(!Array.isArray(rows)||rows.length<1||rows.length>10000||Reflect.ownKeys(rows).length!==rows.length+1)bad();
 const parsed=[];
 for(let i=0;i<rows.length;i++){
  const d=Object.getOwnPropertyDescriptor(rows,String(i));if(!d||!Object.hasOwn(d,'value'))bad();
  const r=data(d.value,['dayOfWeek','parentWorkId','window','reason','originalBudget','requiredSegments']),w=data(r.window,['start','end']);
  if(r.dayOfWeek!==date.getUTCDay()||typeof r.parentWorkId!=='string'||!r.parentWorkId||r.parentWorkId.trim()!==r.parentWorkId
   ||r.parentWorkId.length>512||/[\x00-\x1f\x7f]/.test(r.parentWorkId)||typeof r.reason!=='string'||!Object.hasOwn(unresolvedReasons,r.reason)
   ||typeof w.start!=='string'||typeof w.end!=='string'||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(w.start)
   ||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(w.end)||w.start>=w.end
   ||!Number.isSafeInteger(r.originalBudget)||r.originalBudget<1
   ||(r.reason==='ORIGINAL_BUDGET_INSUFFICIENT_FOR_POSITIVE_SEGMENTS'
    ?!Number.isSafeInteger(r.requiredSegments)||r.requiredSegments<=r.originalBudget:r.requiredSegments!==null))bad();
  parsed.push({...r,window:w});
 }
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
 return freeze({...v,unresolved:parsed});
}
const refusedMessages=new Set(['initial manager snapshot requires one active registered recurring source','initial manager snapshot requires exactly one active registered recurring source']);
function end(s){return new Date(Date.parse(s+'T12:00:00Z')+6*86400000).toISOString().slice(0,10);}
function validSnapshotWindow(snapshot,requestedWeek){
 if(!monday(requestedWeek)||typeof snapshot?.week_start!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.week_start))return false;
 const start=new Date(snapshot.week_start+'T12:00:00Z');
 if(!Number.isFinite(start.getTime())||start.toISOString().slice(0,10)!==snapshot.week_start||snapshot.week_end!==end(snapshot.week_start))return false;
 if(snapshot.week_start===requestedWeek)return true;
 const manual=snapshot.approved_manual_schedule;
 if(manual?.schema!=='custodial.approved-manual-manager-view.v1'
  ||manual.manifestSha256!=='fe02bbdebc736d95360b55cc7dfe5b73c5a9eaa76f364f1c0f4420a0afb9950f'
  ||!UUID.test(manual.publicationId||'')||!UUID.test(manual.projectionId||'')
  ||manual.publicationId!==snapshot.current_publication?.publication_id||manual.projectionId!==snapshot.latest_projection?.projection_id
  ||!Array.isArray(manual.days)||manual.days.length!==7)return false;
 const dates=manual.days.map(d=>d.serviceDate).sort(),expected=Array.from({length:7},(_,n)=>new Date(start.getTime()+n*86400000).toISOString().slice(0,10));
 return JSON.stringify(dates)===JSON.stringify(expected)&&snapshot.week_start<=end(requestedWeek)&&snapshot.week_end>=requestedWeek;
}
async function loadInitialEntry({api,weekStart,owner}){
 if(typeof api!=='function'||!monday(weekStart))throw Error('Invalid week');
 try{return {mode:'snapshot',snapshot:await api('/static-weekly/manager-snapshot?week_start='+encodeURIComponent(weekStart))};}
 catch(error){if(!owner||error.status!==409||error.code!=='23514'||!refusedMessages.has(error.message))throw error;}
 const selection=await api('/static-weekly/approved-initial/selection?week_start='+encodeURIComponent(weekStart));
 if(selection?.schema!=='custodial.approved-initial-selection.v1'||selection.week_start!==weekStart||selection.week_end!==end(weekStart)
  ||!Number.isSafeInteger(selection.authority_revision)||selection.authority_revision<0||selection.published!==false
  ||selection.snapshot_authority!=='SELECTION_METADATA_ONLY'||!Array.isArray(selection.initial)||selection.initial.length>256)throw Error('Invalid approved selection metadata');
 const seen=new Set();for(const row of selection.initial){
  if(!UUID.test(row.source_id||'')||typeof row.template_id!=='string'||!row.template_id.trim()||row.template_id.length>128
   ||!monday(row.effective_start)||!Number.isSafeInteger(row.staffing_count)||row.staffing_count<1||row.staffing_count>256
   ||seen.has(row.source_id))throw Error('Invalid or duplicate approved pattern');seen.add(row.source_id);
 }
 return {mode:'selection',metadata:COPY(selection),published:false,snapshot:null};
}
function selectInitial(entry,sourceId){
 if(entry?.mode!=='selection')throw Error('Approved selection is required');
 const row=entry.metadata.initial.find(r=>r.source_id===sourceId&&r.effective_start===entry.metadata.week_start);
 if(!row)throw Error('No approved pattern matches this source and week');
 return {source_id:row.source_id,template_id:row.template_id,effective_start:row.effective_start,expected_revision:entry.metadata.authority_revision};
}

function create({api,auth=root.MemphisAuth,managerId,baseUrl,storage=root.localStorage,nonce=()=>root.crypto.randomUUID(),onState=()=>{}}={}){
 if(typeof api!=='function'||!UUID.test(managerId||'')||typeof baseUrl!=='string')error('Current manager and scheduler service are required.');
 const base=new URL(baseUrl).origin,key='mz_approved_schedule_pending_v1:'+encodeURIComponent(base)+':'+managerId;
 let busy=false,broken=false;
 function read(){
  let text;try{text=storage.getItem(key);}catch{broken=true;error('Saved schedule recovery cannot be read.');}
  if(!text)return null;
  try{
   const record=JSON.parse(text);if(text.length>12000||record.schema!=='custodial.approved-schedule-pending.v1'||record.managerId!==managerId||record.base!==base
    ||!Object.hasOwn(paths,record.kind)||record.path!==paths[record.kind]+'/confirm'||typeof record.encoded!=='string'||JSON.stringify(record.body)!==record.encoded
    ||(record.state!==undefined&&!['PENDING','ACCEPTED','REJECTED'].includes(record.state))
    ||(record.state==='ACCEPTED'&&!record.acceptance)
    ||(record.state==='REJECTED'&&(record.acceptance||![400,401,403,409,422].includes(record.rejectionStatus)||typeof record.error!=='string')))throw Error();
   const {preview_digest,idempotency_key,confirmation_key,...input}=record.body;
   selectors(record.kind,input);if(!HASH.test(preview_digest||''))throw Error();
   const operationKey=record.kind==='initial'?idempotency_key:confirmation_key;
   if(!UUID.test(operationKey||'')||(record.kind==='initial'?confirmation_key!==undefined:idempotency_key!==undefined))throw Error();
   if(record.acceptance)validateReceipt(record.kind,record.acceptance,record.body);
   return record;
  }catch{broken=true;error('Saved schedule request is invalid. Preserve it for manager recovery; no request was sent.');}
 }
 function save(record){const encoded=JSON.stringify(record);storage.setItem(key,encoded);if(storage.getItem(key)!==encoded)error('Schedule recovery could not be saved. Nothing was sent.');onState(COPY(record));}
 function pending(){const record=read();onState(record?COPY(record):null);return record;}
 async function send(record){
  if(busy)error('The exact schedule request is already in progress.');busy=true;
  try{let result,coordinationPending=false;
   try{result=await api(record.path,{method:'POST',body:record.encoded,expectedManagerId:managerId});}
   catch(failure){
    // The normal HTTP owner can return a committed, exact receipt alongside
    // failed later lease coordination. Validate it exactly like HTTP success.
    // Missing/unbound receipt is still uncertainty, never an invented success.
    if(failure?.acceptedResult!==undefined){result=validateReceipt(record.kind,failure.acceptedResult,record.body);coordinationPending=true;}
    else{if(failure?.serverRejected===true&&[400,401,403,409,422].includes(failure.status)){
     const current=read();if(current?.encoded===record.encoded)save({...current,state:'REJECTED',rejectionStatus:failure.status,error:String(failure.message||'Request rejected').slice(0,600)});
    }throw failure;}
   }
   const receipt=validateReceipt(record.kind,result,record.body);
   const current=read();if(!current||current.encoded!==record.encoded)error('Saved operation changed while the response was pending.');
   save({...current,state:'ACCEPTED',acceptance:receipt,coordination_pending:coordinationPending});return receipt;
  }finally{busy=false;}
 }
 function statusData(value,keys){
  if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype
   ||Reflect.ownKeys(value).length!==keys.length||Reflect.ownKeys(value).some(key=>typeof key!=='string'||!keys.includes(key)))
   error('The original confirmation status is malformed; preserve the saved request.');
  const copy={};for(const key of keys){const field=Object.getOwnPropertyDescriptor(value,key);
   if(!field||!Object.hasOwn(field,'value'))error('The original confirmation status requires exact data fields.');copy[key]=field.value;}return copy;
 }
 function statusReceipt(record,value){
  const body=record.body,confirmationKey=record.kind==='initial'?body.idempotency_key:body.confirmation_key;
  const status=statusData(value,['schema','kind','state','confirmationKey','request','receipt']);
  if(status.schema!=='custodial.approved-static-confirmation-status.v1'||status.kind!==record.kind
   ||status.confirmationKey!==confirmationKey||!['NOT_FOUND','ACCEPTED'].includes(status.state))
   error('The original confirmation status does not match its saved operation.');
  if(status.state==='NOT_FOUND'){
   if(status.request!==null||status.receipt!==null)error('The original confirmation status is contradictory.');
   error('The original confirmation was not found. Its outcome remains unresolved; do not submit it again.');
  }
  const expected=record.kind==='initial'?{sourceId:body.source_id,effectiveStart:body.effective_start,
   templateId:body.template_id,expectedRevision:body.expected_revision,previewDigest:body.preview_digest,idempotencyKey:confirmationKey}:
   {publicationId:null,serviceDate:body.effective_start,kind:'RECURRING_STAFFING',templateId:body.template_id??null,
    expectedRevision:body.expected_revision,previewDigest:body.preview_digest,idempotencyKey:confirmationKey};
  const request=statusData(status.request,Object.keys(expected));
  if(Object.keys(expected).some(key=>request[key]!==expected[key]))error('The accepted original request differs from the saved selection.');
  return validateReceipt(record.kind,status.receipt,body);
 }
 async function readOriginalStatus(record){
  if(busy)error('The exact schedule request is already in progress.');
  const scheduler=root.MemphisSchedulerActions;
  const principal=()=>{const current=scheduler?.principal(auth);
   if(!current||current.managerId!==managerId||!scheduler.permissions(auth).management)
    error('Current named-manager write access is required to read the original confirmation.');return current;};
  const originalPrincipal=principal(),originalText=storage.getItem(key),originalRecord=JSON.stringify(record);
  const current=()=>{
   if(!scheduler.same(originalPrincipal,principal()))error('Manager access changed during original confirmation readback.');
   const observed=read();if(storage.getItem(key)!==originalText||JSON.stringify(observed)!==originalRecord)
    error('Saved operation changed during original confirmation readback. Preserve its current bytes.');
   return observed;
  };
  const confirmationKey=record.kind==='initial'?record.body.idempotency_key:record.body.confirmation_key;
  busy=true;
  try{
   current();
   const value=await api(paths[record.kind]+'/confirmations/'+encodeURIComponent(confirmationKey),{method:'GET',expectedManagerId:managerId});
   current();const receipt=statusReceipt(record,value);const observed=current();
   save({...observed,state:'ACCEPTED',acceptance:receipt});return receipt;
  }finally{busy=false;}
 }
 return Object.freeze({pending,isBlocked:()=>broken||!!read(),
  async confirm(kind,preview,input){if(read()||broken)error('Resolve the existing saved schedule confirmation first.');
   const selected=selectors(kind,input);if(preview?.previewDigest==null)error('Review an approved plan first.');
   const id=nonce();if(!UUID.test(id))error('Operation identity unavailable.');
   const body={...selected,preview_digest:preview.previewDigest,...(kind==='initial'?{idempotency_key:id}:{confirmation_key:id})};
   const record={schema:'custodial.approved-schedule-pending.v1',managerId,base,kind,path:paths[kind]+'/confirm',body,encoded:JSON.stringify(body),state:'PENDING',acceptance:null};
   save(record);return send(record);
  },
  async retry(){const record=read();if(!record)error('No saved schedule confirmation.');if(record.state==='REJECTED')error('This request was conclusively rejected. Refresh and dismiss it before reviewing a corrected preview.');return record.acceptance||readOriginalStatus(record);},
  discardRejected(){const record=read();if(busy||record?.state!=='REJECTED')error('Only an explicitly rejected request may be dismissed.');storage.removeItem(key);if(storage.getItem(key)!==null)error('Could not dismiss rejected request.');onState(null);},
  acknowledge(snapshot){const record=read();if(!record?.acceptance)error('Verified acceptance is required before clearing recovery.');
   const receipt=record.acceptance;
   if(snapshot?.week_start!==record.body.effective_start||snapshot.projection_status!=='current'||!Number.isSafeInteger(snapshot.authority_revision)
    ||snapshot.authority_revision<receipt.authority_revision||!snapshot.current_publication?.publication_id||!snapshot.latest_projection?.projection_id)error('Current schedule readback is incomplete; the accepted request stays saved.');
   if(snapshot.authority_revision===receipt.authority_revision&&(snapshot.current_publication.publication_id!==receipt.publication_id||snapshot.latest_projection.projection_id!==receipt.projection_id))error('Current schedule does not match its acceptance.');
   storage.removeItem(key);if(storage.getItem(key)!==null)error('Accepted receipt could not be cleared.');onState(null);return {current:snapshot.authority_revision===receipt.authority_revision,receipt:COPY(receipt)};
  }});
}
const api=Object.freeze({create,selectors,validatePreview,validateReceipt,validateUnresolvedPreview,unresolvedReasons,validSnapshotWindow,loadInitialEntry,selectInitial,paths});root.MemphisApprovedSchedule=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
