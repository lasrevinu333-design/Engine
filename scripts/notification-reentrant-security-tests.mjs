import assert from 'node:assert/strict';
import './synthetic-schedule-locks.mjs';
import {createScheduleNotificationAuthority} from '../mobile/src/custodial/notification-schedule-authority.js';
import {principalIdentity} from '../mobile/src/custodial/protected-principal.js';
const id=n=>`af000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const p={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),assignment_epoch:7,
 credential_operation_id:id(3),installation_seal:'synthetic-installation',enrolled_at:'2026-07-01T12:00:00.000Z'};
const scope=principalIdentity(p),day='2026-09-28',good=()=>({ready:true,available:true,quarantined:false});
const data={canonical_device_id:p.device_id,employee_id:p.employee_id,credential_id:p.credential_id,assignment_epoch:7,
 service_date:day,schedule_delivery_mode:'LEGACY_REGISTERED',projection_status:'current',projection_id:id(10),publication_id:id(20),
 projection_authority_revision:10,full_day:true,shift:{start:'07:00',end:'16:00'},raw_items:[]};
const event={kind:'employee_location_status',service_date:day,projection_id:id(10),receipt_device_id:p.device_id,
 receipt_employee_id:p.employee_id,receipt_credential_id:p.credential_id,receipt_assignment_epoch:'7'};
const results=[];
for(const reader of ['ready property','identity','principal']){
 try{let armed=false,nested=false,owner;
  const reenter=()=>{if(!armed)return;armed=false;nested=true;assert.equal(owner.isCurrent(event,scope),false);nested=false;};
  owner=createScheduleNotificationAuthority({identity:()=>{if(reader==='identity')reenter();return scope;},principal:()=>{if(reader==='principal')reenter();return p;},
   status:()=>{if(nested)throw Error('nested current-reader failure');return reader==='ready property'?Object.defineProperty(good(),'ready',{get(){reenter();return true;}}):good();},
   storage:{getItem:()=>null},now:()=>Date.parse(day+'T15:00:00Z')});
  assert.equal(await owner.observe(data,scope),true);assert.equal(owner.isCurrent(event,scope),true);
  armed=true;owner.securityChanged(good());assert.equal(owner.isCurrent(event,scope),false,'nested failure cannot be overwritten by outer recovery');
  assert.equal(await owner.observe(data,scope),false,'healthy ordinary observation cannot clear quarantine');
  owner.securityChanged(good());assert.equal(await owner.observe(data,scope),true);assert.equal(owner.isCurrent(event,scope),true);
  results.push({reader,pass:true});
 }catch(e){results.push({reader,pass:false,error:e.stack});}
}
console.log(JSON.stringify({scope:'F01 reentrant live security normalization, actual owner with synthetic callbacks; no physical proof',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
