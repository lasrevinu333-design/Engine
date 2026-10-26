// Source/VM presentation regression, NOT a browser, handset, outage or delivery
// test. No fetch/server/network settings. Existing authority logic stays exact.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import vm from 'node:vm';
const baselineMode=process.argv.includes('--baseline');
const originalRoot=new URL('./fixtures/quiet-offline-before-bf805a3e/',import.meta.url);
const fixtureBytes=readFileSync(new URL('MANIFEST.json',originalRoot));
assert.equal(createHash('sha256').update(fixtureBytes).digest('hex'),'1df7a7195888a816e382228b33ca1337fa1598229c0c7a7648a4a025c31dbb7e');
const fixture=JSON.parse(fixtureBytes);assert.equal(fixture.source_commit,'bf805a3e5f18577fa83cc28800d30a469d053ecf');
assert.equal(fixture.source_tree,'9cb421d0594994bb1e6b8a1598db444dbd83e054');assert.equal(fixture.files.length,7);
for(const row of fixture.files){const bytes=readFileSync(new URL('source/'+row.path,originalRoot));assert.equal(bytes.length,row.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);}
const baseline=p=>readFileSync(new URL('source/'+p,originalRoot),'utf8');
const read=p=>baselineMode?baseline(p):readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fn(source,name){
 const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name+' source present');
 // Match the full parameter list: an arrow default owns=()=>true and ={}
 // must not make the empty default object look like the function body.
 let parameterDepth=0,parameterEnd=-1;
 for(let i=source.indexOf('(',start);i<source.length;i++){
  if(source[i]==='(')parameterDepth++;else if(source[i]===')'&&--parameterDepth===0){parameterEnd=i;break;}
 }
 assert.ok(parameterEnd>start,name+' parameters closed');
 const brace=source.indexOf('{',parameterEnd);let depth=0,quote=null,escape=false;
 for(let i=brace;i<source.length;i++){
  const c=source[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
  if(c==='{')depth++;else if(c==='}'&&--depth===0)return source.slice(start,i+1);
 }
 throw Error('unclosed '+name);
}
const readiness=read('mobile/src/custodial/readiness.js'),m=await import('data:text/javascript;base64,'+Buffer.from(readiness).toString('base64'));
const app=read('mobile/src/custodial/app.js'),html=read('mobile/src/custodial/index.html');
const security={initialized:true,ready:true,available:true,quarantined:false,state:'enrolled',generation:1};
const good={security,principalPresent:true,profileMatches:true,serverConfirmed:true,snapshotAnchored:true,startupClear:true,connected:true,queue:[],sessionState:'none',nativeState:{observation:'CONFIRMED',read_only:true,native_clock_continuity:'CONFIRMED',protected_work_admission:'CLEAR',rollback_fence_active:false,pending_occurrences:false,unfinished_occurrence:false}};
let checks=0,failed=0;
async function test(name,body){try{await body();checks++;console.log('PASS',name);}catch(e){failed++;console.log('FAIL',name, e.message);}}
function paint(input){const elements=Object.fromEntries(['home-readiness','lock-readiness','boot-readiness','assignment-readiness'].map(id=>[id,{hidden:false,textContent:'old',className:''}]));const ctx={classifyReadiness:m.classifyReadiness,readinessPresentation:m.readinessPresentation,document:{getElementById:id=>elements[id]}};vm.runInNewContext('('+fn(app,'paintReadiness')+')(input)',{...ctx,input});return Object.values(elements);}
await test('ordinary disconnected pending work paints no connectivity warning or false Ready',()=>{const x={...good,connected:false,queue:[{state:'pending'}]};assert.equal(m.classifyReadiness(x).state,'needs_internet');for(const e of paint(x)){assert.equal(e.hidden,true);assert.equal(e.textContent,'');}});
await test('ordinary online Ready label is also quiet without changing internal classification',()=>{assert.equal(m.classifyReadiness(good).state,'ready');for(const e of paint(good))assert.equal(e.hidden,true);});
await test('unknown presentation is not promoted to server accepted',()=>{const x={...good,serverConfirmed:false,queue:null,nativeState:null};assert.notEqual(m.classifyReadiness(x).state,'ready');for(const e of paint(x)){assert.equal(e.hidden,true);assert.equal(e.textContent,'');}});
await test('security and genuine work recovery stay visible offline',()=>{for(const input of [{...good,connected:false,authRejected:true},{...good,queue:[{dead_letter:true}]},{...good,security:{...security,quarantined:true}},{...good,sessionState:'ambiguous'}])for(const e of paint(input)){assert.equal(e.hidden,false);assert.match(e.textContent,/manager|Do not use/i);}});
await test('unknown classifier shape retains actionable verification notice',()=>{const p=m.readinessPresentation({state:'unsupported'});assert.equal(p.hidden,false);assert.match(p.label,/verification/);});
await test('native work verification constraint stays actionable without a Wi-Fi warning',()=>{const input={...good,connected:false,nativeState:{...good.nativeState,observation:'NEEDS_INTERNET'}};for(const e of paint(input)){assert.equal(e.hidden,false);assert.match(e.textContent,/Work verification needed/);assert.doesNotMatch(e.textContent,/internet|connection/i);}});
await test('local saved-work verification failure is never silently hidden',()=>{for(const e of paint({...good,connected:false,localReadinessUnavailable:true})){assert.equal(e.hidden,false);assert.match(e.textContent,/Saved work verification needed/);assert.doesNotMatch(e.textContent,/internet|connection/i);}});
await test('initial Home lock boot have no default Needs internet announcement',()=>{for(const id of ['home-readiness','lock-readiness','boot-readiness'])assert.match(html,new RegExp('<p[^>]*id="'+id+'"[^>]*hidden[^>]*>\\s*</p>'));assert.match(html,/id="assignment-readiness"[^>]*>Needs manager/);});
function schedule(data,options){
 const els=Object.fromEntries(['employee','date','content','areas','lunch','lunchAreas','notice'].map(id=>[id,{hidden:false,textContent:'',innerHTML:''}]));const calls=[];const fences=new WeakMap([[data,{principal:'p',date:'2026-10-08',fence:'valid'}]]);
 const ctx={securityGeneration:1,loadVersion:1,paused:false,activeRender:null,lastView:null,presentationFences:fences,available:()=>true,authorityUnavailable:()=>false,identity:()=> 'p',zooNow:()=>({date:'2026-10-08'}),window:{MemphisRecurringScheduleTarget:{assertAvailability:()=>{}}},localStorage:{},cacheError:()=>Error('cache'),currentItems:d=>d.raw_items,isLunch:i=>i.loan===true,name:i=>i.location_name,details:()=>'',esc:String,date:String,clearTimeout:()=>{},boundary:1,clearPresentation:()=>{},state:(text,error)=>calls.push({text,error}),els,scheduleBoundary:()=>{},commitDisplayedBinding:()=>null,DISPLAY_SUPERSEDED:'superseded'};
 vm.runInNewContext('('+fn(read('employee-schedule.html'),'render')+')(data,options)',{...ctx,data,options});return {els,calls};
}
const scheduled={service_date:'2026-10-08',employee_name:'Synthetic employee',projection_status:'current',raw_items:[{location_name:'Synthetic borrowed restroom',loan:true}],notice:''};
await test('valid cached Schedule stays usable and quiet; assignments still visible',()=>{const x=schedule(scheduled,{offline:true});assert.equal(x.els.content.hidden,false);assert.match(x.els.lunchAreas.innerHTML,/Synthetic borrowed restroom/);assert.equal(x.calls.at(-1).text,'');});
await test('blocked authority is actionable but not a generic connection banner',()=>{const x=schedule({...scheduled,projection_status:'blocked_recurring_authority'},{offline:true});assert.match(x.els.notice.textContent,/manager/);assert.equal(x.els.content.hidden,true);assert.doesNotMatch(x.calls.at(-1).text,/connection|internet/i);});
await test('failed cached persistence notice takes precedence over ordinary signal loss',()=>{const x=schedule(scheduled,{offline:true,cacheWarning:true});assert.match(x.calls.at(-1).text,/could not.*save|could not be saved/i);});
async function badge(items,error=null){const badge={hidden:false,textContent:''};const ctx={syncBadge:badge,getQueuedActions:()=>error?Promise.reject(error):Promise.resolve(items),window:{MemphisMobile:{nativeOfflineTimeAuthority:true}},navigator:{onLine:false}};vm.runInNewContext('('+fn(read('index.html'),'updateSyncBadge')+')()',ctx);await Promise.resolve();await Promise.resolve();return badge;}
await test('ordinary native queued work has no network badge',async()=>{assert.equal((await badge([{state:'pending'}])).hidden,true);});
await test('offline dead letter gets genuine recovery notice not No connection',async()=>{const x=await badge([{dead_letter:true}]);assert.equal(x.hidden,false);assert.equal(x.textContent,'Saved work needs review');});
await test('quarantined local work is never hidden as ordinary queued work',async()=>{const x=await badge([{state:'quarantined'}]);assert.equal(x.hidden,false);assert.equal(x.textContent,'Saved work needs review');});
await test('queue-read failure stays actionable rather than blaming signal',async()=>{const x=await badge([],Error('synthetic protected queue read failure'));assert.equal(x.hidden,false);assert.match(x.textContent,/could not be checked/);});
await test('uncached identity fallback states the real constraint and retains automatic retry',()=>{let title,message,retry=0;vm.runInNewContext('('+fn(app,'showNoConnection')+')()',{showBoot:(a,b)=>{title=a;message=b;},clearRestoreRetry:()=>{},restoreRetryTimer:null,window:{setTimeout:(f,t)=>{retry=t;return 1;}},restore:()=>{}});assert.doesNotMatch(title,/connection|internet/i);assert.match(message,/verified.*assignment|assignment.*verified/i);assert.equal(retry,5000);});
await test('authority classifier and generation-fenced observation implementation unchanged',()=>{for(const name of ['classifyReadiness','createReadinessObservation'])assert.equal(fn(readiness,name),fn(baseline('mobile/src/custodial/readiness.js'),name));});
await test('profile restore and native cleaning admission / receipt paths unchanged',()=>{assert.equal(fn(app,'restoreNow'),fn(baseline('mobile/src/custodial/app.js'),'restoreNow'));for(const name of ['getScanStateSafe','startSessionMaybeQueued','completeSessionMaybeQueued'])assert.equal(fn(read('index.html'),name),fn(baseline('index.html'),name));assert.equal(read('memphis-scan-sync.js'),baseline('memphis-scan-sync.js'));assert.equal(read('mobile/src/chatscope/app.jsx'),baseline('mobile/src/chatscope/app.jsx'));});
console.log(JSON.stringify({checks,failed,scope:'Focused current-source VM/state presentation; no browser/native/device/disconnection/delivery/build/admission proof'}));if(failed)process.exitCode=1;
