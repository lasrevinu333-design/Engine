(function installRecurringConfirmation(root){
 'use strict';
 const SCHEMA='memphis-zoo.recurring-confirmation-browser.v1';
 const PREFIX='mz_recurring_confirmation_v1:';
 const PATH='/static-weekly/recurring-adaptation/confirm';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
 const hash=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
 const fail=message=>new Error(message);
 const monday=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value
  &&new Date(value+'T12:00:00Z').getUTCDay()===1;
 function requestBody(value){
  const keys=['confirmation_key','effective_start','expected_revision','preview_digest','full_nine_source_id'];
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length!==keys.length
   ||keys.some(key=>!Object.hasOwn(value,key))||!uuid(value.confirmation_key)||!monday(value.effective_start)
   ||!Number.isSafeInteger(value.expected_revision)||value.expected_revision<0||!hash(value.preview_digest)
   ||(value.full_nine_source_id!==null&&!uuid(value.full_nine_source_id)))throw fail('Invalid saved recurring confirmation; no request was sent.');
  return Object.fromEntries(keys.map(key=>[key,value[key]]));
 }
 function validateReceipt(response,record){
  const r=response?.receipt,b=record.body;
  if(response?.state!=='ACCEPTED'||!uuid(response.operationId)||r?.schema!=='static-weekly.recurring-confirmation-receipt.v1'
   ||r.operationId!==response.operationId||r.managerId!==record.managerId||r.confirmationKey!==b.confirmation_key
   ||r.previewDigest!==b.preview_digest||r.effectiveStart!==b.effective_start||r.sourceDigest!==record.sourceDigest
   ||!uuid(r.sourceId)||!uuid(r.publicationId)||!uuid(r.projectionId)||!hash(r.requestDigest)||!hash(r.lunchDocumentIdentity)
   ||!Number.isSafeInteger(r.authorityRevision)||r.authorityRevision<=b.expected_revision||r.accepted!==true
   ||r.phoneDeliveryState!=='PENDING'||r.affectedPhonesUpdated!==false)throw fail('The exact recurring acceptance receipt could not be verified. Keep this operation pending.');
  return clone(response);
 }
 function create({api,managerId,storage=root.localStorage,locks=root.navigator?.locks,newUuid=()=>root.crypto.randomUUID(),onState=()=>{}}={}){
  if(typeof api!=='function'||!uuid(managerId)||!storage?.getItem||!storage?.setItem||!storage?.removeItem)
   throw fail('Durable recurring confirmation storage and authenticated manager are required.');
  const storageKey=PREFIX+managerId;
  const emit=record=>onState(record?clone(record):null);
  function load(){
   const raw=storage.getItem(storageKey);if(raw===null){emit(null);return null;}
   let record;try{record=JSON.parse(raw);}catch{throw fail('Unreadable recurring recovery record; do not replace it.');}
   if(record?.schema!==SCHEMA||record.managerId!==managerId||!hash(record.sourceDigest))throw fail('Invalid recurring recovery identity; do not replace it.');
   record.body=requestBody(record.body);
   if(record.encoded!==JSON.stringify(record.body))throw fail('Saved recurring request bytes changed.');
   if(record.acceptance)validateReceipt(record.acceptance,record);
   emit(record);return record;
  }
  function save(record){const raw=JSON.stringify(record);storage.setItem(storageKey,raw);
   if(storage.getItem(storageKey)!==raw)throw fail('Recurring recovery storage readback failed; no new request may be sent.');emit(record);}
  function locked(operation){
   if(typeof locks?.request!=='function')throw fail('This browser cannot safely coordinate recurring confirmation across tabs. Use the supported manager browser.');
   return locks.request(storageKey,{mode:'exclusive'},operation);
  }
  const statusPath=record=>PATH+'ations/'+encodeURIComponent(record.body.confirmation_key);
  async function inspect(record){
   const result=await api(statusPath(record),{expectedManagerId:managerId});
   if(result?.state==='NOT_FOUND'&&result.confirmationKey===record.body.confirmation_key){
    if(record.acceptance)throw fail('Previously accepted recurring confirmation is missing; preserve recovery evidence.');
    return{state:'NOT_FOUND',confirmationKey:record.body.confirmation_key};
   }
   const accepted=validateReceipt(result,record);record.acceptance=accepted;save(record);return accepted;
  }
  async function send(record){
   // Save/read back exact bytes BEFORE the only mutation. Any transport error
   // retains them. Recovery uses the locking exact-manager/key status route.
   save(record);
   const response=await api(PATH,{method:'POST',body:record.encoded,expectedManagerId:managerId});
   const accepted=validateReceipt(response,record);record.acceptance=accepted;save(record);return accepted;
  }
  return Object.freeze({storageKey,
   hasPending(){return Boolean(load());},
   confirm({effectiveStart,expectedRevision,previewDigest,sourceDigest,fullNineSourceId=null}){
    return locked(async()=>{
     if(load())throw fail('Resolve the saved recurring confirmation before another plan.');
     if(!hash(sourceDigest))throw fail('Exact preview source identity is required.');
     const body=requestBody({confirmation_key:newUuid(),effective_start:effectiveStart,expected_revision:expectedRevision,
      preview_digest:previewDigest,full_nine_source_id:fullNineSourceId});
     const record={schema:SCHEMA,managerId,sourceDigest,body,encoded:JSON.stringify(body)};
     return send(record);
    });
   },
   recover(){return locked(async()=>{const record=load();return record?inspect(record):null;});},
   retry(){return locked(async()=>{const record=load();if(!record)throw fail('No saved recurring confirmation.');
    const status=await inspect(record);return status.state==='ACCEPTED'?status:send(record);});},
   discardUnaccepted(){return locked(async()=>{const record=load();if(!record)return null;
    const status=await inspect(record);if(status.state!=='NOT_FOUND')return status;
    storage.removeItem(storageKey);if(storage.getItem(storageKey)!==null)throw fail('Recovery record removal failed.');emit(null);return{state:'DISCARDED_NOT_FOUND'};});},
   acknowledgeReadback(operationId){return locked(async()=>{const record=load();
    if(!record?.acceptance||record.acceptance.operationId!==operationId)throw fail('Exact accepted operation required before ending local recovery.');
    storage.removeItem(storageKey);if(storage.getItem(storageKey)!==null)throw fail('Recovery record removal failed.');emit(null);
    return{state:'ACKNOWLEDGED',currentCoverageNotInferred:true,phoneDeliveryNotInferred:true};});},
  });
 }
 root.MemphisRecurringConfirmation=Object.freeze({SCHEMA,PREFIX,create});
})(globalThis);
