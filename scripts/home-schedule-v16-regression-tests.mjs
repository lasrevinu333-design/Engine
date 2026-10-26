import assert from 'node:assert/strict';
import {fixture,payload,id,key} from './employee-schedule-convergence-race-tests.mjs';
const results=[],tick=()=>new Promise(r=>setImmediate(r));
const receipt='/schedule-api/my-day-summary/application-receipt';
async function test(name,work){try{await work();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
async function until(predicate){const deadline=Date.now()+2000;while(Date.now()<deadline){if(predicate())return;await new Promise(r=>setTimeout(r,5));}assert.ok(predicate(),'bounded receipt handoff reached');}
function legacy(){const d=payload(21);delete d.schedule_delivery_mode;delete d.recurring_delivery;
 d.schedule_application={application_status:'PENDING',intent_id:id(21),authority_revision:21,publication_id:id(4),projection_id:id(5),lunch_document_identity:'a'.repeat(64)};return d;}
async function exercise({event,throws=false,site='method'}={}){
 const f=fixture(),mobile=f.context.window.MemphisMobile,request=mobile.requestJson;let getterReads=0,nested=0,handed=false,receiptOptions,boundThis;
 const healthy={ready:true,available:true,quarantined:false};
 const trigger=()=>{if(nested)return;nested++;mobile.ready=new Promise(()=>{});
  f.events.get(event)(event==='memphis:custodial-security-state'?{detail:healthy}:undefined);
  if(throws)throw Error('retired receipt accessor');};
 const wrapped=function(path,options){if(path===receipt){receiptOptions=options;boundThis=this;}return request.call(this,path,options);};
 Object.defineProperty(mobile,'requestJson',{configurable:true,get(){getterReads++;if(getterReads===2){handed=true;if(event&&site==='method')trigger();}return wrapped;}});
 if(site==='body'){
  // The fixture's Date subclass owns this override; host prototypes are untouched.
  const original=f.context.Date.prototype.toISOString;
  f.context.Date.prototype.toISOString=function(){const value=original.call(this);if(handed&&event)trigger();return value;};
 }
 try{
  f.next=legacy();await f.load();await until(()=>handed);await tick();await tick();
  assert.equal(getterReads,2,'auth and receipt method captures, successor remains held');
  assert.equal(f.cache().data.schedule_application.authority_revision,21,'saved accepted snapshot retained');
  assert.equal(JSON.parse(f.stored.get('mz_employee_schedule_snapshot:availability:race-principal')).state,'AVAILABLE');
  if(event){assert.equal(nested,1,'actual registered lifecycle handler ran');assert.equal(f.calls.filter(p=>p===receipt).length,0,'retired receipt must not dispatch');}
  else{
   assert.equal(f.calls.filter(p=>p===receipt).length,1);assert.equal(boundThis,undefined,'direct call matches actual receiver-independent bridge arrow; no mutable invocation helper');
   assert.equal(f.node('content').hidden,false);assert.ok(f.stored.has(key));
   const body=JSON.parse(receiptOptions.body);assert.equal(receiptOptions.method,'POST');assert.equal(body.intent_id,id(21));assert.match(body.rendered_digest,/^[0-9a-f]{64}$/);
   assert.deepEqual(Object.keys(body).sort(),['applied_at','authority_revision','intent_id','lunch_document_identity','projection_id','rendered_digest']);
  }
 }finally{f.events.get('pagehide')();await tick();}
}
await test('current receipt preserves exact payload, saved view and direct bridge call',()=>exercise());
for(const event of ['memphis:schedule-refresh','online','memphis:native-notification-received','memphis:custodial-security-state','pagehide'])
 for(const site of ['method','body'])for(const throws of [false,true])
  await test('V15-01 '+site+' '+event+(throws?' throws':' returns'),()=>exercise({event,site,throws}));
console.log(JSON.stringify({scope:'V15-01 actual Schedule receipt dispatch with actual lifecycle handlers; synthetic VM/bridge/DOM only',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
