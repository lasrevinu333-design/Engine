(function(root){'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const paths=new Set(['/static-weekly/exceptions','/static-weekly/contractor-capacity','/static-weekly/day-changes/batch','/static-weekly/rebuild-current-projection','/static-weekly/projections']);
const copy=v=>JSON.parse(JSON.stringify(v));
function principal(auth){const s=auth?.readSession?.();if(s?.role!=='ops_manager'||!UUID.test(s.manager_id||'')||!s.credential_id||!s.token||!(Date.parse(s.expires_at)>Date.now()))return null;return{managerId:s.manager_id,credentialId:s.credential_id,deviceId:s.device_id||''};}
const same=(a,b)=>!!a&&!!b&&a.managerId===b.managerId&&a.credentialId===b.credentialId&&a.deviceId===b.deviceId;
function permissions(auth){const s=auth?.readSession?.(),p=s?.permissions,current=principal(auth),valid=!!current&&p?.schema==='custodial.manager-permissions.v1'&&p.read===true;const owner=valid&&p.owner===true&&s.read_only===false;return{read:valid,owner,absences:valid&&(owner||p.manage_absences===true),coverall:valid&&(owner||p.manage_coverall===true),routes:valid&&(owner||p.regenerate_routes===true),closeScanTickets:valid&&(owner||p.close_scan_tickets===true)};}
function receiptProjection(value){return value?.data?.current_projection||value?.data?.projection||null;}
function accepted(value,record){const p=receiptProjection(value);return Number.isSafeInteger(value?.revision)&&value.revision>=record.body.expected_revision&&UUID.test(p?.projection_id||'')&&(!record.body.publication_id||p.publication_id===record.body.publication_id)&&(!p.week_start||p.week_start===record.body.week_start);}
function create({auth,api,baseUrl,storage=root.localStorage,onState=()=>{}}={}){
 const owner=principal(auth);if(!owner||typeof api!=='function')throw Error('A current manager session is required.');const base=new URL(baseUrl).origin;
 const key='mz_scheduler_dated_operation_v1:'+encodeURIComponent(base)+':'+owner.managerId;let sending=false;
 function identity(){if(!same(owner,principal(auth)))throw Error('Manager access changed. Saved scheduling work remains preserved.');}
 function read(){identity();const raw=storage.getItem(key);if(raw===null)return null;let r;try{r=JSON.parse(raw);}catch{throw Error('Saved scheduler request cannot be read. Preserve it for recovery.');}
  if(raw.length>200000||r?.schema!=='custodial.scheduler-pending.v1'||r.base!==base||r.managerId!==owner.managerId||!paths.has(r.path)
   ||typeof r.encoded!=='string'||r.encoded!==JSON.stringify(r.body)||!Number.isSafeInteger(r.body?.expected_revision)||r.body.expected_revision<0
   ||typeof r.body.idempotency_key!=='string'||!r.body.idempotency_key||!['PENDING','ACCEPTED','REJECTED'].includes(r.state)
   ||(r.state==='ACCEPTED'&&!accepted(r.receipt,r)))throw Error('Saved scheduler request is invalid. No request was sent.');
  return r;
 }
 function save(r){identity();const raw=JSON.stringify(r);storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('Cannot save the exact scheduler request. Nothing new was sent.');onState(copy(r));}
 function pending(){const r=read();onState(r?copy(r):null);return r;}
 async function send(r){identity();if(sending)throw Error('The saved scheduler request is already in progress.');sending=true;
  try{
   const result=await api(r.path,{method:'POST',body:r.encoded,expectedManagerId:owner.managerId});identity();
   if(!accepted(result,r))throw Error('The server response does not prove schedule acceptance. Retry only this saved request.');
   const current=read();if(current?.encoded!==r.encoded)throw Error('Saved scheduler request changed during submission.');
   save({...r,state:'ACCEPTED',receipt:copy(result),error:null});return result;
  }catch(error){
   // Explicit 4xx rejection is not transport uncertainty. Unknown outcomes keep
   // the exact body/key and cannot be replaced by a fresh mutation.
   if(same(owner,principal(auth))&&error?.serverRejected===true&&[400,401,403,409,422].includes(error.status)){
    try{const current=read();if(current?.encoded===r.encoded)save({...current,state:'REJECTED',error:String(error.message).slice(0,600),rejectionCode:error.code||null});}catch{}
   }
   throw error;
  }finally{sending=false;}
 }
 return Object.freeze({pending,
  async run(path,body){if(read())throw Error('Resolve the saved scheduler request before submitting another change.');identity();const p=permissions(auth);
   if(!paths.has(path)||!p.routes||!p.absences||!Number.isSafeInteger(body?.expected_revision)||body.expected_revision<0||typeof body.idempotency_key!=='string'||!body.idempotency_key)throw Error('This scheduler change is not authorized or complete.');
   const r={schema:'custodial.scheduler-pending.v1',base,managerId:owner.managerId,path,body:copy(body),encoded:JSON.stringify(body),state:'PENDING',receipt:null,error:null};save(r);return send(r);
  },
  async retry(){const r=read();if(!r)throw Error('No saved scheduler request.');if(r.state==='ACCEPTED')return r.receipt;return send({...r,state:'PENDING',error:null});},
  acknowledge(snapshot){const r=read();if(!r||r.state!=='ACCEPTED')return false;const p=receiptProjection(r.receipt);
   if(snapshot?.week_start!==r.body.week_start||snapshot.projection_status!=='current'||!Number.isSafeInteger(snapshot.authority_revision)||snapshot.authority_revision<r.receipt.revision
    ||!UUID.test(snapshot.latest_projection?.projection_id||''))return false;
   if(snapshot.authority_revision===r.receipt.revision&&snapshot.latest_projection.projection_id!==p.projection_id)return false;
   storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('Accepted schedule receipt could not be cleared.');onState(null);return true;
  },
  discardRejected(){const r=read();if(!r||r.state!=='REJECTED'||sending)throw Error('Only an explicitly rejected request may be dismissed.');storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('Could not dismiss rejected request.');onState(null);},
  samePrincipal:()=>same(owner,principal(auth)),principal:copy(owner),
 });
}
const api=Object.freeze({create,permissions,principal,same,accepted,receiptProjection});root.MemphisSchedulerActions=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
