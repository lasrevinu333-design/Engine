import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,payload,id} from './employee-schedule-convergence-race-tests.mjs';
const results=[],receipt='/schedule-api/my-day-summary/application-receipt';
const bridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
const apiSource=bridge.match(/requestJson: (async \(path, options\) => \(await requestEnvelope\(path, options\)\)\.data),/);
assert.ok(apiSource,'actual bridge receiver-independent requestJson arrow must match, not a guessed API contract');
const tick=()=>new Promise(r=>setImmediate(r));
async function until(predicate){const end=Date.now()+2000;while(Date.now()<end){if(predicate())return;await new Promise(r=>setTimeout(r,5));}assert.ok(predicate(),'bounded receipt result reached');}
async function test(name,work){try{await work();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
function legacy(){const d=payload(21);delete d.schedule_delivery_mode;delete d.recurring_delivery;
 d.schedule_application={application_status:'PENDING',intent_id:id(21),authority_revision:21,publication_id:id(4),projection_id:id(5),lunch_document_identity:'a'.repeat(64)};return d;}
// Execute the EXACT production API arrow, with an explicitly synthetic inner
// requestEnvelope. This proves only receiver/dispatch contract, not native HTTP.
function installActualArrow(f){const mobile=f.context.window.MemphisMobile,original=mobile.requestJson;
 const calls=[];const api=vm.runInNewContext('('+apiSource[1]+')',{requestEnvelope:async(path,options)=>{
  calls.push({path,options});return{data:await original(path,options)};
 }});mobile.requestJson=api;return calls;
}
for(const event of ['memphis:schedule-refresh','online','memphis:native-notification-received','memphis:custodial-security-state','pagehide'])
 for(const mode of ['function','proxy','throw'])await test('V17-01 eliminated invocation indirection '+event+' '+mode,async()=>{
  const f=fixture(),mobile=f.context.window.MemphisMobile,calls=installActualArrow(f);let reads=0,invoked=0,nested=0;
  const wrapper=(request,receiver,args)=>{invoked++;nested++;mobile.ready=new Promise(()=>{});
   f.events.get(event)(event==='memphis:custodial-security-state'?{detail:{ready:true,available:true,quarantined:false}}:undefined);
   if(mode==='throw')throw Error('retired invocation wrapper');return Reflect.apply(request,receiver,args);
  };
  f.context.Reflect={get apply(){reads++;return mode==='proxy'?new Proxy(Reflect.apply,{apply(_t,_r,args){return wrapper(...args);}}):wrapper;}};
  try{f.next=legacy();await f.load();await until(()=>invoked||calls.some(x=>x.path===receipt));await tick();
   assert.equal(reads,0,'removed helper must not be consulted');assert.equal(invoked,0,'no injected helper executes');assert.equal(nested,0,'no helper-induced retirement');
   assert.equal(calls.filter(x=>x.path===receipt).length,1,'real bridge arrow remains usable');assert.equal(f.calls.filter(x=>x===receipt).length,1);
   assert.equal(f.node('content').hidden,false);
  }finally{f.events.get('pagehide')();await tick();}
 });
await test('actual production requestJson is receiver-independent and preserves exact result and options',async()=>{
 const calls=[],expected={accepted:true};const options={method:'POST',body:'exact-body'};
 const request=vm.runInNewContext('('+apiSource[1]+')',{requestEnvelope:async(path,value)=>{calls.push({path,value});return{data:expected};}});
 assert.equal(await request(receipt,options),expected);assert.equal(await request.call({unrelated:true},receipt,options),expected);
 assert.equal(calls.length,2);for(const call of calls){assert.equal(call.path,receipt);assert.equal(call.value,options);}
});
console.log(JSON.stringify({scope:'V17-01 actual lifecycle fixture with exact production API arrow and synthetic inner transport; no phone/native runtime proof',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
