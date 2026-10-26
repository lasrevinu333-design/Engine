import assert from 'node:assert/strict';
import {fixture,payload,id} from './employee-schedule-convergence-race-tests.mjs';
const results=[],tick=()=>new Promise(r=>setImmediate(r)),receipt='/schedule-api/my-day-summary/application-receipt';
async function test(name,work){try{await work();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
async function until(predicate){const end=Date.now()+2000;while(Date.now()<end){if(predicate())return;await new Promise(r=>setTimeout(r,5));}assert.ok(predicate(),'bounded receipt result reached');}
function legacy(){const d=payload(21);delete d.schedule_delivery_mode;delete d.recurring_delivery;
 d.schedule_application={application_status:'PENDING',intent_id:id(21),authority_revision:21,publication_id:id(4),projection_id:id(5),lunch_document_identity:'a'.repeat(64)};return d;}
for(const event of ['memphis:schedule-refresh','online','memphis:native-notification-received','memphis:custodial-security-state','pagehide'])for(const throws of [false,true])
 await test('V16-01 own call accessor is not evaluated by receipt '+event+(throws?' throws':' returns'),async()=>{
  const f=fixture(),mobile=f.context.window.MemphisMobile,original=mobile.requestJson;let callReads=0,nested=0,sentThis,finished=false;
  function request(path,options){if(path===receipt){sentThis=this;finished=true;}return original(path,options);}
  Object.defineProperty(request,'call',{get(){callReads++;if(callReads===2){nested++;finished=true;mobile.ready=new Promise(()=>{});
   f.events.get(event)(event==='memphis:custodial-security-state'?{detail:{ready:true,available:true,quarantined:false}}:undefined);
   if(throws)throw Error('retired own-call property');
  }return Function.prototype.call;}});
  mobile.requestJson=request;
  try{f.next=legacy();await f.load();await until(()=>finished);await tick();
   const calls=f.calls.filter(x=>x===receipt).length;
   assert.equal(callReads,1,'only unchanged auth call may read own call; receipt must call directly');
   assert.equal(nested,0,'receipt must not evaluate effectful call property');assert.equal(calls,1,'untainted current receipt remains usable');assert.equal(sentThis,undefined,'actual bridge arrow does not require a receiver');
   assert.equal(f.node('content').hidden,false);
  }finally{f.events.get('pagehide')();await tick();}
 });
// V18 removes the V17 primitive acquisition completely. Assert that the former
// injected capture cannot execute, while the current valid receipt still works.
for(const event of ['memphis:schedule-refresh','online','memphis:native-notification-received','memphis:custodial-security-state','pagehide'])for(const throws of [false,true])
 await test('removed apply lookup cannot retire original owner '+event+(throws?' throws':' returns'),async()=>{
  const f=fixture(),mobile=f.context.window.MemphisMobile;let nested=0;
  f.context.Reflect={get apply(){nested++;mobile.ready=new Promise(()=>{});
   f.events.get(event)(event==='memphis:custodial-security-state'?{detail:{ready:true,available:true,quarantined:false}}:undefined);
   if(throws)throw Error('retired primitive capture');return Reflect.apply;
  }};
  try{f.next=legacy();await f.load();await until(()=>nested||f.calls.some(x=>x===receipt));await tick();
   assert.equal(nested,0,'removed primitive acquisition must never be reached');assert.equal(f.calls.filter(x=>x===receipt).length,1,'unretired current frame still dispatches');
  }finally{f.events.get('pagehide')();await tick();}
 });
console.log(JSON.stringify({scope:'V16-01 actual Schedule callable-call accessor plus V18 elimination of V17 apply-capture seam; synthetic only',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
