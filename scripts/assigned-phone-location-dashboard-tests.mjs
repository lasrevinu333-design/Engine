// Synthetic source/page regression qualification only. No physical phone, real
// browser, geographic calibration, production service or release claim.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const source=require('../custodial-gps-path-source.js');
const page=require('../dashboard-map-page.js');
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
const phone={ok:true,meta:{contract:'custodial.assigned-phone-location.v1',generated_at:'2026-11-11T18:00:00Z'},data:{phones:[{deviceIdentifier:'synthetic-device'}]}};
const history={ok:true,meta:{contract:'gps-map-context.v1'},data:{work:[{synthetic:true}]}};
let cases=0;
const pass=name=>{cases++;console.log('PASS',name);};
{
 const h=deferred(),updates=[];let historySignal;
 const result=await source.read({headers:{},timeoutMs:100,fetchImpl:async(url,options)=>{
  assert.ok(options.signal instanceof AbortSignal);if(url===source.API){historySignal=options.signal;return h.promise;}return response(phone);
 },onUpdate:value=>updates.push(value)});
 assert.deepEqual(result.phones,phone.data.phones);assert.equal(result.historyPending,true);assert.equal(result.historyVersion,0);
 h.resolve(response(history));await tick();assert.equal(updates.length,1);assert.equal(updates[0].historyVersion,1);assert.deepEqual(updates[0].work,history.data.work);assert.equal(historySignal.aborted,false);
 pass('verified phone is immediate while optional history waits, then updates independently');
}
{
 const p=deferred(),updates=[];const read=source.read({headers:{},timeoutMs:100,fetchImpl:async url=>url===source.API?response(history):p.promise,onUpdate:value=>updates.push(value)});
 await tick();p.resolve(response(phone));const result=await read;assert.equal(result.historyVersion,1);assert.deepEqual(result.work,history.data.work);assert.equal(updates.length,0);
 pass('history-before-phone ordering produces complete first result without duplicate callbacks');
}
{
 const updates=[];let historySignal;const result=await source.read({headers:{},timeoutMs:10,fetchImpl:async(url,options)=>{if(url===source.API){historySignal=options.signal;return new Promise(()=>{});}return response(phone);},onUpdate:value=>updates.push(value)});
 assert.equal(result.historyPending,true);await new Promise(r=>setTimeout(r,20));assert.equal(historySignal.aborted,true);assert.equal(updates.length,1);assert.equal(updates[0].historyUnavailable,true);assert.equal(updates[0].historyPending,false);assert.deepEqual(updates[0].phones,phone.data.phones);
 pass('history timeout aborts its request without losing verified phone');
}
{
 const h=deferred(),errors=[],updates=[];await source.read({headers:{},timeoutMs:100,fetchImpl:async url=>url===source.API?h.promise:response(phone),onUpdate:v=>updates.push(v),onAuthorityError:e=>errors.push(e)});
 h.resolve(response(null,403));await tick();assert.equal(errors.length,1);assert.equal(errors[0].authority,true);assert.equal(updates.length,0);
 pass('late history authority denial is not downgraded to optional-history failure');
}
{
 const h=deferred(),abort=new AbortController(),updates=[],errors=[];await source.read({headers:{},timeoutMs:100,signal:abort.signal,fetchImpl:async url=>url===source.API?h.promise:response(phone),onUpdate:v=>updates.push(v),onAuthorityError:e=>errors.push(e)});
 abort.abort();h.resolve(response(null,403));await tick();assert.equal(updates.length,0);assert.equal(errors.length,0);
 pass('cancelled history cannot publish an update or revoke a newer owner');
}
{
 let phoneSignal;await assert.rejects(source.read({headers:{},timeoutMs:10,fetchImpl:async(url,options)=>{if(url===source.PHONE_API){phoneSignal=options.signal;return new Promise(()=>{});}return response(history);}}),/timed out/);assert.equal(phoneSignal.aborted,true);
 await assert.rejects(source.read({headers:{},timeoutMs:100,fetchImpl:async url=>response(url===source.API?history:null, url===source.API?200:401)}),e=>e.authority===true);
 await assert.rejects(source.read({headers:{},timeoutMs:100,fetchImpl:async url=>response(url===source.API?history:{...phone,meta:{contract:'wrong'}})}),/Verified assigned/);
 pass('phone timeout, denial, and unverified contract never create location authority');
}
const principal=()=>({role:'ops_manager',manager_id:'synthetic-manager',credential_id:'synthetic-credential',device_id:'synthetic-device',token:'synthetic-token',permissions:{schema:'custodial.manager-permissions.v1',read:true}});
const summary={ok:true,data:{meta:{contracts:{dashboard:'dashboard.v1'},generated_at:'2026-11-11T18:00:00Z'},restrooms:[],exhibits:[]}};
function fixture({summaryRead=async()=>response(summary),gpsRead=async()=>({phones:[],historyVersion:0})}={}){
 let session=principal(),ticket=0;const calls={gps:[],fail:0,unavailable:0,suspend:0,clear:0,summary:0,invalidated:0};const intervals=new Map(),listeners=new Map(),section={hidden:true},status={textContent:''};
 const window={document:{addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)},addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
 const auth={readSession:()=>session,hasPermission:(n,s)=>s?.permissions?.[n]===true,requireOpsManagerSession:async()=>session,opsManagerAuthHeaders:async()=>({Authorization:'synthetic'})};
 const map={init:async()=>true,checkSession:()=>true,beginRefresh:()=>({id:++ticket}),accept:()=>{calls.summary++;return true;},acceptGps:(t,v)=>calls.gps.push({t,v}),unavailableGps:()=>calls.unavailable++,clearGps:()=>calls.clear++,fail:()=>calls.fail++,suspend:()=>calls.suspend++,invalidate:()=>calls.invalidated++,stop(){}};
 const controller=page.create({auth,renderer:{create:()=>map},section,status,window,gpsSource:{read:gpsRead},fetchImpl:summaryRead,setIntervalImpl:(fn,ms)=>{intervals.set(ms,fn);return ms;},clearIntervalImpl:id=>intervals.delete(id)});
 return {controller,calls,section,status,intervals,listeners,setSession:v=>{session=v;}};
}
{
 const s=deferred(),f=fixture({summaryRead:()=>s.promise,gpsRead:async()=>({phones:['independent'],historyVersion:0})});
 await f.controller.init();await tick();assert.equal(f.calls.gps.length,1);assert.equal(f.calls.summary,0);s.resolve(response(null,500));await tick();assert.equal(f.calls.fail,1);assert.equal(f.calls.unavailable,0);assert.equal(f.calls.gps[0].v.phones[0],'independent');f.controller.stop();
 pass('phone displays while summary hangs and survives cleaning-summary failure');
}
{
 let callback;const f=fixture({gpsRead:async({onUpdate})=>{callback=onUpdate;onUpdate({phones:['new'],historyVersion:1});return {phones:['old'],historyVersion:0};}});
 await f.controller.init();await tick();assert.equal(f.calls.gps.length,1);assert.equal(f.calls.gps[0].v.phones[0],'new');f.controller.stop();callback({phones:['late'],historyVersion:2});assert.equal(f.calls.gps.length,1);
 pass('early newer callback wins over initial promise and closed page rejects late callbacks');
}
{
 const reads=[],f=fixture({gpsRead:args=>{const d=deferred();reads.push({...d,args});return d.promise;}});
 await f.controller.init();await tick();await f.controller.refresh();await tick();assert.equal(reads.length,2);assert.equal(reads[0].args.signal.aborted,true);
 reads[0].args.onUpdate({phones:['obsolete'],historyVersion:1});reads[0].resolve({phones:['obsolete'],historyVersion:0});reads[1].resolve({phones:['current'],historyVersion:0});await tick();assert.equal(f.calls.gps.length,1);assert.equal(f.calls.gps[0].v.phones[0],'current');
 reads[0].args.onAuthorityError({authority:true});assert.equal(f.calls.suspend,0);f.controller.stop();
 pass('replacement aborts prior read and fences old result and old authority callback');
}
{
 let authority;const f=fixture({gpsRead:async({onAuthorityError})=>{authority=onAuthorityError;return {phones:['private'],historyVersion:0};}});
 await f.controller.init();await tick();authority({authority:true});assert.equal(f.section.hidden,true);assert.equal(f.calls.clear,1);assert.equal(f.calls.suspend,1);assert.equal(f.intervals.size,0);f.controller.stop();
 pass('current location denial clears private state and suspends route');
}
{
 const gps=deferred(),f=fixture({gpsRead:()=>gps.promise});await f.controller.init();await tick();f.setSession(null);f.intervals.get(1000)();gps.resolve({phones:['private'],historyVersion:0});await tick();assert.equal(f.calls.gps.length,0);assert.equal(f.section.hidden,true);assert.equal(f.calls.suspend,1);f.controller.stop();
 pass('principal loss during phone request cannot publish private coordinates');
}
console.log(JSON.stringify({status:'PASS_ASSIGNED_PHONE_SOURCE_PAGE_SYNTHETIC',cases,actual_browser:false,physical_phone:false,production_http:false,release_qualified:false}));
