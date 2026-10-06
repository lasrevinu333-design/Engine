import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const page=require('../dashboard-map-page.js');
const html=readFileSync(new URL('../dashboard-map.html',import.meta.url),'utf8');
const hub=readFileSync(new URL('../start_page1.html',import.meta.url),'utf8');
const hubController=readFileSync(new URL('../ops-hub.js',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
const employeeHub=readFileSync(new URL('../employee-hub.html',import.meta.url),'utf8');
let checks=0;
const pass=(name,fn)=>{fn();checks++;console.log('PASS',name);};
const principal={role:'ops_manager',manager_id:'manager-1',credential_id:'credential-1',device_id:'device-1',token:'token-1'};
const summary={meta:{contracts:{dashboard:'dashboard.v1'},generated_at:'2026-10-04T00:00:00.000Z'},restrooms:[],exhibits:[]};
const fixture=({session=principal,required=session,response={ok:true,status:200,data:summary},delayed=null,
 resumeImpl=null,requireSession=null}={})=>{
 let current=session,fetches=0,creates=0,accepted=0,failed=0,invalidated=0,begin=0,authReads=0,suspends=0,resumes=0,stops=0;
 const timers=new Map(),listeners=new Map(),status={textContent:''},section={hidden:true};
 const window={document:{hidden:false,addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);}},
  addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);}};
 const auth={readSession:()=>current,async requireOpsManagerSession(options){authReads++;assert.deepEqual(options,{interactive:false,redirect:true});
  if(requireSession)return requireSession();if(required instanceof Error)throw required;return required;},
  async opsManagerAuthHeaders(options){assert.deepEqual(options,{expectedManagerId:'manager-1'});return {Authorization:'Bearer token-1','X-Device-Id':'device-1'};}};
 const map={async init(){return true;},suspend(){suspends++;},async resume(){resumes++;return resumeImpl?resumeImpl(resumes):true;},stop(){stops++;},checkSession(){return true;},beginRefresh(){begin++;return {generation:begin};},accept(_ticket,data){
  assert.deepEqual(data,summary);accepted++;return true;},fail(){failed++;},invalidate(){invalidated++;}};
 const renderer={create(){creates++;return map;}};
 const fetchImpl=async(url,options)=>{fetches++;assert.equal(url,'https://memphis-zoo-mcp.onrender.com/dashboard-api/summary');
  assert.deepEqual(options,{method:'GET',cache:'no-store',headers:{Authorization:'Bearer token-1','X-Device-Id':'device-1'}});
  if(delayed)return typeof delayed==='function'?delayed():delayed.promise;
  return {ok:response.ok,status:response.status,async json(){return {ok:response.ok,data:response.data};}};
 };
 const controller=page.create({auth,renderer,section,status,fetchImpl,window,
  setIntervalImpl:(fn,ms)=>{timers.set(ms,fn);return ms;},clearIntervalImpl:id=>timers.delete(id)});
 return {controller,section,status,listeners,timers,setSession:value=>{current=value;},
  counts:()=>({fetches,creates,accepted,failed,invalidated,begin,authReads,suspends,resumes,stops})};
};
pass('dedicated manager map uses existing Hub authentication and clear normal return navigation',()=>{
 assert.match(html,/<a[^>]+href="\.\/dashboard\.html">Dashboard<\/a>/);
 assert.match(html,/<a[^>]+href="\.\/start_page1\.html">[\s\S]*?Back to Hub<\/a>/);
 assert.match(hub,/id="dashboard-link"[^>]+href="\.\/dashboard\.html"/);
 assert.match(hub,/id="dashboard-map-link"[^>]+href="\.\/operations-dashboard\.html"/);
 assert.match(hubController,/dashboardMapLink\.href=dashboardMapUrl\.toString\(\)/);
 assert.match(hubController,/requireOpsManagerSession\(\{accessLevel:'full_access',interactive:true,redirect:false,throwOnFailure:true\}\)/);
 assert.doesNotMatch(employeeHub,/dashboard(?:-map)?\.html/);
 assert.match(dashboard,/requireOpsManagerSession\(\{interactive:false,redirect:true\}\)/);
 assert.doesNotMatch(html,/staging_map=1|localhost|manager_access|enroll-form|ticket-marker/i);
});
for(const unauthorized of [null,{role:'employee',token:'employee-token',manager_id:'manager-1',credential_id:'credential-1'},
 {...principal,token:''},{...principal,credential_id:''}]){
 const test=fixture({session:unauthorized,required:unauthorized});
 assert.equal(await test.controller.init(),false);assert.equal(test.section.hidden,true);
 assert.deepEqual(test.counts(),{fetches:0,creates:0,accepted:0,failed:0,invalidated:0,begin:0,authReads:1,suspends:0,resumes:0,stops:0});
 checks++;console.log('PASS direct map route rejects missing/non-manager principal before map assets or API');
}
const deniedAuth=fixture({required:new Error('offline manager auth')});
assert.equal(await deniedAuth.controller.init(),false);
pass('failed manager validation leaves static map hidden with no asset or API read',()=>{
 assert.equal(deniedAuth.section.hidden,true);assert.equal(deniedAuth.counts().creates,0);
 assert.equal(deniedAuth.counts().fetches,0);
});
const accepted=fixture();assert.equal(await accepted.controller.init(),true);
await new Promise(resolve=>setImmediate(resolve));
pass('one existing manager session supplies auth and current Dashboard summary',()=>{
 assert.equal(accepted.section.hidden,false);assert.equal(accepted.counts().fetches,1);
 assert.equal(accepted.counts().accepted,1);assert.equal(accepted.timers.has(30000),true);
 assert.equal(accepted.timers.has(1000),true);
});
accepted.setSession({...principal,token:'different-token'});
assert.equal(await accepted.controller.refresh(),false);
pass('principal change after success hides the route and never fetches as the new principal',()=>{
 assert.equal(accepted.section.hidden,true);assert.equal(accepted.counts().fetches,1);
 assert.ok(accepted.counts().invalidated>=1);
 assert.equal(accepted.timers.size,0);assert.equal(accepted.counts().suspends,1);
});
const denied=fixture({response:{ok:false,status:403,data:null}});assert.equal(await denied.controller.init(),true);
await new Promise(resolve=>setImmediate(resolve));
pass('API role denial cannot be displayed as current cleaning authority',()=>{
 assert.equal(denied.counts().accepted,0);assert.equal(denied.counts().failed,1);
 assert.match(denied.status.textContent,/unavailable/);
});
const bad=fixture({response:{ok:true,status:200,data:{...summary,meta:{contracts:{dashboard:'old'},generated_at:summary.meta.generated_at}}}});
assert.equal(await bad.controller.init(),true);await new Promise(resolve=>setImmediate(resolve));
pass('stale contract cannot be promoted to authenticated map state',()=>{
 assert.equal(bad.counts().accepted,0);assert.equal(bad.counts().failed,1);
 assert.equal(page.dashboardData(summary),true);assert.equal(page.dashboardData({}),false);
});
let resolveFetch;const pending=fixture({delayed:{promise:new Promise(resolve=>{resolveFetch=resolve;})}});
assert.equal(await pending.controller.init(),true);await new Promise(resolve=>setImmediate(resolve));
pending.setSession(null);resolveFetch({ok:true,status:200,async json(){return {ok:true,data:summary};}});
await new Promise(resolve=>setImmediate(resolve));
pass('logout during an in-flight response invalidates without late map acceptance',()=>{
 assert.equal(pending.counts().accepted,0);assert.equal(pending.section.hidden,true);
});
const restored=fixture();assert.equal(await restored.controller.init(),true);await new Promise(resolve=>setImmediate(resolve));
const beforeRestore=restored.counts();
restored.listeners.get('pagehide')({persisted:true});
pass('persisted pagehide suspends both controller and renderer without disposing approved pins',()=>{
 assert.equal(restored.section.hidden,true);assert.equal(restored.timers.size,0);
 assert.equal(restored.counts().suspends,1);assert.equal(restored.counts().stops,0);
 assert.equal(restored.listeners.has('pageshow'),true);
});
restored.listeners.get('pageshow')({persisted:true});await new Promise(resolve=>setImmediate(resolve));
pass('BFCache restoration revalidates existing manager, reopens both gates and one set of timers',()=>{
 assert.equal(restored.counts().authReads,beforeRestore.authReads+1);
 assert.equal(restored.counts().resumes,1);assert.equal(restored.counts().creates,1);
 assert.equal(restored.counts().fetches,beforeRestore.fetches+1);
 assert.equal(restored.section.hidden,false);assert.equal(restored.timers.size,2);
 assert.equal(restored.listeners.size,6);
});
restored.listeners.get('pageshow')({persisted:true});await new Promise(resolve=>setImmediate(resolve));
pass('duplicate pageshow does not create duplicate pins, listeners, timers or refreshes',()=>{
 assert.equal(restored.counts().creates,1);assert.equal(restored.counts().resumes,1);
 assert.equal(restored.counts().fetches,beforeRestore.fetches+1);assert.equal(restored.timers.size,2);
});
restored.listeners.get('pagehide')({persisted:true});restored.setSession({...principal,credential_id:'other'});
restored.listeners.get('pageshow')({persisted:true});await new Promise(resolve=>setImmediate(resolve));
pass('changed principal on restore cannot reuse old pins or accepted status',()=>{
 assert.equal(restored.section.hidden,true);assert.equal(restored.timers.size,0);
 assert.equal(restored.counts().fetches,beforeRestore.fetches+1);
});
let releaseOld;
let delayedCalls=0;
const staleOnRestore=fixture({delayed:()=>++delayedCalls===1
 ?new Promise(resolve=>{releaseOld=resolve;})
 :Promise.resolve({ok:true,status:200,async json(){return {ok:true,data:summary};}})});
assert.equal(await staleOnRestore.controller.init(),true);
await new Promise(resolve=>setImmediate(resolve));
staleOnRestore.listeners.get('pagehide')({persisted:true});
staleOnRestore.listeners.get('pageshow')({persisted:true});
await new Promise(resolve=>setImmediate(resolve));
releaseOld({ok:true,status:200,async json(){return {ok:true,data:summary};}});
await new Promise(resolve=>setImmediate(resolve));
pass('old in-flight response cannot overwrite fresh restored manager readback',()=>{
 assert.equal(staleOnRestore.counts().fetches,2);
 assert.equal(staleOnRestore.counts().accepted,1);
 assert.equal(staleOnRestore.section.hidden,false);
});
const transient=fixture({resumeImpl:attempt=>{
 if(attempt===1)throw Error('transient approved-anchor failure');return true;
}});
assert.equal(await transient.controller.init(),true);await new Promise(resolve=>setImmediate(resolve));
transient.listeners.get('pagehide')({persisted:true});
assert.equal(await transient.controller.resume(),false);
pass('failed current restore leaves page retryable without disposing its existing renderer',()=>{
 assert.equal(transient.section.hidden,true);assert.equal(transient.timers.size,0);
 assert.equal(transient.counts().creates,1);assert.equal(transient.counts().stops,0);
});
assert.equal(await transient.controller.resume(),true);await new Promise(resolve=>setImmediate(resolve));
pass('healthy direct retry restores same renderer and one fresh authenticated summary read',()=>{
 assert.equal(transient.counts().creates,1);assert.equal(transient.counts().resumes,2);
 assert.equal(transient.counts().fetches,2);assert.equal(transient.timers.size,2);
});
transient.listeners.get('pagehide')({persisted:true});
transient.listeners.get('pageshow')({persisted:true});await new Promise(resolve=>setImmediate(resolve));
pass('later persisted cycle performs its own fresh read without duplicate renderer or timers',()=>{
 assert.equal(transient.counts().creates,1);assert.equal(transient.counts().fetches,3);
 assert.equal(transient.section.hidden,false);assert.equal(transient.timers.size,2);
});
let rejectObsolete;
const superseded=fixture({resumeImpl:attempt=>attempt===1
 ?new Promise((_,reject)=>{rejectObsolete=reject;}) :true});
assert.equal(await superseded.controller.init(),true);await new Promise(resolve=>setImmediate(resolve));
superseded.listeners.get('pagehide')({persisted:true});
const oldRestore=superseded.controller.resume();await new Promise(resolve=>setImmediate(resolve));
superseded.listeners.get('pagehide')({persisted:true});
const newRestore=superseded.controller.resume();assert.equal(await newRestore,true);
rejectObsolete(Error('superseded anchor rejection'));assert.equal(await oldRestore,false);
await new Promise(resolve=>setImmediate(resolve));
pass('obsolete failed restore cannot suspend a newer successful generation',()=>{
 assert.equal(superseded.section.hidden,false);assert.equal(superseded.timers.size,2);
 assert.equal(superseded.counts().creates,1);assert.equal(superseded.counts().stops,0);
});
superseded.listeners.get('pagehide')({persisted:true});superseded.setSession({...principal,credential_id:'changed'});
assert.equal(await superseded.controller.resume(),false);
pass('principal denial after a pending restoration closes only its current owned renderer',()=>{
 assert.equal(superseded.section.hidden,true);assert.equal(superseded.timers.size,0);
 assert.equal(superseded.counts().stops,1);
});
let rejectClosedRestore;
const closedPending=fixture({resumeImpl:()=>new Promise((_,reject)=>{rejectClosedRestore=reject;})});
assert.equal(await closedPending.controller.init(),true);await new Promise(resolve=>setImmediate(resolve));
closedPending.listeners.get('pagehide')({persisted:true});
const pendingRestore=closedPending.controller.resume();await new Promise(resolve=>setImmediate(resolve));
closedPending.controller.stop();rejectClosedRestore(Error('late anchor failure after final close'));
assert.equal(await pendingRestore,false);
pass('final disposal during pending restore prevents late failure from reopening page or renderer',()=>{
 assert.equal(closedPending.section.hidden,true);assert.equal(closedPending.timers.size,0);
 assert.equal(closedPending.listeners.size,0);assert.equal(closedPending.counts().stops,1);
 assert.equal(closedPending.controller.resume() instanceof Promise,true);
});
const disposed=fixture();assert.equal(await disposed.controller.init(),true);
disposed.listeners.get('pagehide')({persisted:false});
pass('nonpersisted pagehide permanently disposes the exact page controller',()=>{
 assert.equal(disposed.counts().stops,1);assert.equal(disposed.listeners.size,0);
 assert.equal(disposed.timers.size,0);assert.equal(disposed.section.hidden,true);
});
assert.equal(await disposed.controller.init(),false);
accepted.controller.stop();denied.controller.stop();bad.controller.stop();pending.controller.stop();
restored.controller.stop();staleOnRestore.controller.stop();disposed.controller.stop();
transient.controller.stop();superseded.controller.stop();
closedPending.controller.stop();
pass('owned page timers and listeners close without touching other pages',()=>{
 assert.equal(accepted.timers.size,0);assert.equal(accepted.listeners.size,0);
});
console.log('PASS Dashboard Map page contract',checks,'SOURCE_VM_NO_BROWSER_NO_BACKEND');
