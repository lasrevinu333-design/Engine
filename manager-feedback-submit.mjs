const KEY='custodial.manager-feedback-original.v1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail=message=>new Error(message);
function actor(value){
 if(value?.role!=='ops_manager'||value.read_only===true||value.access_level!=='full_access'
  ||!UUID.test(value.manager_id||'')||!UUID.test(value.credential_id||'')||typeof value.device_id!=='string'||!value.device_id)
  throw fail('Current full manager access is required. Saved feedback remains retained.');
 return {manager_id:value.manager_id,credential_id:value.credential_id,device_id:value.device_id};
}
function readOriginal(raw){
 let original;try{original=JSON.parse(raw);}catch{throw fail('Saved feedback needs review. Do not replace it.');}
 const b=original?.body;
 if(!original||Object.keys(original).sort().join('|')!=='body|schema'||original.schema!==KEY||!b
  ||!UUID.test(b.operation_id||'')||!UUID.test(b.expected_manager_id||'')||!UUID.test(b.expected_credential_id||'')
  ||b.hub_context!=='manager'||typeof b.device_id!=='string'||!b.device_id||typeof b.message!=='string'||!b.message
  ||JSON.stringify(original)!==raw||raw.length>4*1024*1024)throw fail('Saved feedback needs review. Do not replace it.');
 return original;
}
// One exact original across response loss, reload, edits and retry. The private
// browser journal is DATA; only a fresh matching server receipt retires it.
export function createManagerFeedbackSubmitter({storage,current,send,uuid=()=>crypto.randomUUID(),locks=globalThis.navigator?.locks}){
 let pending=null,flight=null;
 function original(){
  const raw=storage.getItem(KEY);
  if(pending){if((raw===null&&pending.persisted)||(raw!==null&&raw!==pending.raw))throw fail('Saved feedback changed in another tab. Reload to read current saved work.');return pending;}
  if(raw!==null)pending={raw,persisted:true,...readOriginal(raw)};
  return pending;
 }
 async function submitOnce(selected){
  const owner=actor(await current());
  let prior=original();
  if(!prior){
   const body={...selected,operation_id:uuid(),hub_context:'manager',device_id:owner.device_id,
    expected_manager_id:owner.manager_id,expected_credential_id:owner.credential_id};
   const raw=JSON.stringify({schema:KEY,body});readOriginal(raw);pending={raw,persisted:false,schema:KEY,body};prior=pending;
  }
  const b=prior.body;
  const same=who=>who.manager_id===b.expected_manager_id&&who.credential_id===b.expected_credential_id&&who.device_id===b.device_id;
  if(!same(owner))throw fail('Saved feedback belongs to an earlier sign-in. Keep it for recovery.');
  // Persist before sending; an uncertain write preserves this exact in-memory
  // original and is never replaced with edited text or a new operation ID.
  if(storage.getItem(KEY)===null)storage.setItem(KEY,prior.raw);
  if(storage.getItem(KEY)!==prior.raw)throw fail('Feedback save is unconfirmed. Retry keeps the same original.');
  prior.persisted=true;
  if(!same(actor(await current())))throw fail('Manager changed. Feedback remains saved.');
  const response=await send(JSON.stringify(b),b.operation_id);
  if(!same(actor(await current())))throw fail('Manager changed. Feedback outcome is unconfirmed.');
  const item=response?.data?.item;
  if(response?.ok!==true||!UUID.test(item?.id||'')||item.operation_id!==b.operation_id)
   throw fail('Original feedback receipt is unconfirmed. Retry keeps the same original.');
  if(storage.getItem(KEY)!==prior.raw)throw fail('Saved feedback changed. Keep the original receipt for review.');
  storage.removeItem(KEY);
  if(storage.getItem(KEY)!==null)throw fail('Saved feedback retirement is unconfirmed.');
  pending=null;return item;
 }
 return Object.freeze({hasPending:()=>Boolean(original()),submit(draft){
  if(flight)return flight;
  const selected=JSON.parse(JSON.stringify(draft));
  if(typeof locks?.request!=='function')return Promise.reject(fail('Exclusive feedback storage is unavailable. Keep your draft and retry.'));
  const request=locks.request(KEY,{mode:'exclusive'},()=>submitOnce(selected)).finally(()=>{if(flight===request)flight=null;});flight=request;return request;
 }});
}
