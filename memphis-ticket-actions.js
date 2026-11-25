(function(root){'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function principal(auth){
 const s=auth?.readSession?.(),p=s?.permissions;
 // The existing PIN adapter binds this cohort permission to the live server
 // session. A copied flag or chosen display name is not manager authority.
 const canClose=s?.auth_mode==='custodial_leadership_pin'
  ?auth?.isCustodialManagementAdmin?.(s)===true:p?.close_scan_tickets===true;
 if(s?.role!=='ops_manager'||!s.token||!UUID.test(s.manager_id||'')||!UUID.test(s.credential_id||'')||!(Date.parse(s.expires_at)>Date.now())||p?.schema!=='custodial.manager-permissions.v1'||p.read!==true||!canClose)return null;
 return[s.manager_id,s.credential_id,s.device_id||''].join('|');
}
function create({auth=root.MemphisAuth,fetchImpl=(...args)=>root.fetch(...args),origin='https://memphis-zoo-mcp.onrender.com',journal=createJournal(),getToken=()=>auth?.readSession?.()?.token}={}){
 let current=null,records=new Map(),generation=0;const checked=new Map();
 function clear(){current=null;records=new Map();generation++;}
 function status(id){return current&&current===principal(auth)?records.get(String(id).toLowerCase())||null:null;}
 async function readCapabilities(owner,ids,valid){
  const token=getToken();
  const headers=await auth.opsManagerAuthHeaders();if(principal(auth)!==owner||getToken()!==token||!valid())return null;
  const next=new Map();
  for(let i=0;i<ids.length;i+=100){const group=ids.slice(i,i+100),expected=new Set(group);
   const response=await fetchImpl(origin+'/dashboard-api/ticket-capabilities?ids='+encodeURIComponent(group.join(',')),{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
   const body=await response.json().catch(()=>null),data=body?.data;
   if(principal(auth)!==owner||getToken()!==token||!valid())return null;
   if(!response.ok||body?.ok!==true||data?.schema!=='custodial.ticket-capabilities.v1'||[data.manager_id,data.credential_id,auth.readSession()?.device_id||''].join('|')!==owner||!Array.isArray(data.tickets)||data.tickets.length!==group.length)throw Error('Ticket closure eligibility could not be verified.');
   for(const item of data.tickets){const id=String(item?.ticket_id||'').toLowerCase();if(!expected.delete(id)||typeof item.found!=='boolean'||typeof item.scan_session_verified!=='boolean'||typeof item.can_close!=='boolean'||(item.can_close&&(!item.found||item.status!=='open')))throw Error('Ticket closure response has invalid identities.');next.set(id,Object.freeze({...item,ticket_id:id}));}
   if(expected.size)throw Error('Ticket closure response is incomplete.');
  }
  return next;
 }
 async function refresh(rows){
  const owner=principal(auth),attempt=++generation;records=new Map();current=null;
  if(!owner)return false;
  const ids=[...new Set(rows.map(r=>r.ticket_id).filter(id=>UUID.test(id||'')).map(id=>id.toLowerCase()))];
  if(ids.length>500)throw Error('Ticket eligibility list exceeds its safe bound.');
  const next=await readCapabilities(owner,ids,()=>attempt===generation);
  if(!next||attempt!==generation||principal(auth)!==owner)return false;
  records=next;current=owner;return true;
 }
 const recoveryOwner=()=>{const owner=principal(auth);return owner&&JSON.stringify([owner,auth.readSession()?.claimed_manager_id||null,auth.readSession()?.auth_mode||null]);};
 function recoveries(){const owner=recoveryOwner();return owner?journal.list(owner):[];}
 function original(id){return recoveries().find(item=>item.ticket_id===id)||null;}
 async function readOriginal(id){
  const owner=principal(auth),recovery=recoveryOwner(),token=getToken();if(!owner||!recovery)throw Error('Manager access changed.');
  return journal.lock(recovery,id,async()=>{
   const saved=original(id);if(!saved)throw Error('The original closure could not be found.');
   const result=await readCapabilities(owner,[id],()=>recoveryOwner()===recovery);
   const ticket=result?.get(id);
   if(!ticket||getToken()!==token||recoveryOwner()!==recovery)throw Error('Ticket state could not be checked.');
   checked.set(id,JSON.stringify([recovery,token,saved]));
   return ticket;
  });
 }
 async function dispatch(id,body,{retry=false}={}){
  const owner=principal(auth),recovery=recoveryOwner(),token=getToken();if(!owner||!recovery)throw Error('Your current access does not permit closing this ticket.');
  return journal.lock(recovery,id,async()=>{
   const prior=original(id);
   if(retry){if(!prior||checked.get(id)!==JSON.stringify([recovery,token,prior]))throw Error('Check the original closure before retrying.');body=prior;}
   else if(prior)throw Error('Check the original closure before sending anything else.');
   else if(current!==owner||status(id)?.can_close!==true)throw Error('Your current access does not permit closing this ticket.');
   const headers=await auth.opsManagerAuthHeaders();
   if(recoveryOwner()!==recovery||getToken()!==token)throw Error('Manager access changed before closure.');
   journal.save(recovery,body);checked.delete(id);
   const response=await fetchImpl(origin+'/dashboard-api/close-ticket',{method:'POST',headers:{'Content-Type':'application/json',...headers},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),body:JSON.stringify(body)});
   const payload=await response.json().catch(()=>null),receipt=payload?.data;
   if(recoveryOwner()!==recovery||getToken()!==token){clear();throw Error('Manager access changed. Check the original closure after signing in.');}
   if(!response.ok||payload?.ok!==true){
    if(payload?.ok===false&&((response.status===409&&payload.code==='40901')||(!retry&&[400,401,403,404,422].includes(response.status)))){
     journal.remove(recovery,id);
    }
    throw Error(payload?.error||'Closure outcome unavailable. Check the original ticket.');
   }
   if(receipt?.ticket_id?.toLowerCase()!==id||receipt.status!=='closed'||receipt.outcome!==body.outcome||(receipt.external_work_order_reference||null)!==body.external_work_order_reference||!Number.isFinite(Date.parse(receipt.closed_at))||!String(receipt.closed_by||'').trim())throw Error('Closure receipt could not be verified. Check the original ticket.');
   journal.remove(recovery,id);records.set(id,Object.freeze({...records.get(id),status:'closed',can_close:false}));return receipt;
  });
 }
 async function close(id,{outcome,reference=null,notes=null}={}){
  const orderReference=String(reference||'').trim();id=String(id||'').toLowerCase();
  if(!UUID.test(id)||!['mark_fixed','work_order_sent'].includes(outcome)||(outcome==='work_order_sent'&&(!orderReference||orderReference.length>120))||(outcome==='mark_fixed'&&orderReference)||String(notes||'').length>1000)throw Error('Choose the actual closure outcome and work-order reference when applicable.');
  return dispatch(id,{ticket_id:id,outcome,external_work_order_reference:orderReference||null,close_notes:String(notes||'').trim()||null});
 }
 return Object.freeze({refresh,status,close,clear,recoveries,readOriginal,retry:id=>dispatch(id,null,{retry:true})});
}
function createJournal({storage,locks}={}){
 const scope=owner=>'mz_ticket_closure:v1:'+encodeURIComponent(owner)+':';
 const key=(owner,id)=>scope(owner)+id;
 const fallback=new Map(),active=new Set();
 const read=key=>storage?storage.getItem(key):fallback.get(key)??null;
 function valid(value,id){
  return value?.ticket_id===id&&UUID.test(id)&&['mark_fixed','work_order_sent'].includes(value.outcome)
   &&(value.outcome==='mark_fixed'?value.external_work_order_reference===null:typeof value.external_work_order_reference==='string'&&value.external_work_order_reference.length>0&&value.external_work_order_reference.length<=120)
   &&(value.close_notes===null||typeof value.close_notes==='string'&&value.close_notes.length<=1000);
 }
 return Object.freeze({
  async lock(owner,id,action){
   const idKey=key(owner,id);
   if(locks?.request)return locks.request(idKey,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('The original closure is already being checked.');return action();});
   if(storage)throw Error('Safe ticket closure storage is unavailable in this browser.');
   if(active.has(idKey))throw Error('The original closure is already being checked.');
   active.add(idKey);try{return await action();}finally{active.delete(idKey);}
  },
  list(owner){
   const prefix=scope(owner),keys=storage?Array.from({length:storage.length},(_,index)=>storage.key(index)):[...fallback.keys()];
   return keys.filter(name=>name?.startsWith(prefix)).flatMap(name=>{
    const raw=read(name);if(raw===null)return[];
    const value=JSON.parse(raw);if(!valid(value,name.slice(prefix.length)))throw Error('Saved ticket closure could not be verified.');
    return[value];
   });
  },
  save(owner,value){
   const name=key(owner,value.ticket_id),raw=JSON.stringify(value),prior=read(name);
   if(prior!==null&&prior!==raw)throw Error('A different original closure is already saved.');
   if(storage)storage.setItem(name,raw);else fallback.set(name,raw);
   if(read(name)!==raw)throw Error('The original closure could not be saved.');
  },
  remove(owner,id){const name=key(owner,id);if(storage)storage.removeItem(name);else fallback.delete(name);},
 });
}
const api=Object.freeze({create,createJournal,principal});root.MemphisTicketActions=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
