import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../schedule-weekly.html',import.meta.url),'utf8');
const source=page.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/^init\(\)\.catch\([^\n]+$/m,'');
let checks=0;const failures=[];
const check=(actual,expected,label)=>{checks++;try{assert.deepEqual(actual,expected,label);}catch{failures.push({label,actual,expected});}};
const turns=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture(){
 const events=new Map(),nodes=new Map(),timers=new Map();let nextTimer=0;
 const on=(target,type,fn,opts={})=>{const key=target+':'+type;const list=events.get(key)||[];list.push({fn,once:opts.once});events.set(key,list);};
 const emit=(target,type,event={})=>{const key=target+':'+type,list=(events.get(key)||[]).slice();for(const item of list){if(item.once)events.set(key,(events.get(key)||[]).filter(x=>x!==item));item.fn(event);}};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',checked:false,disabled:false,open:false,dataset:{},textContent:'',classList:{toggle(){}},replaceChildren(){},focus(){},
  showModal(){this.open=true;},close(value){if(value!==undefined)this.returnValue=value;this.open=false;emit(id,'close');},
  addEventListener(type,fn,opts){on(id,type,fn,opts);}});return nodes.get(id);};
 const choice=node('callout');choice.dataset.calloutSlot='slot1';choice.closest=selector=>selector.includes('data-callout-slot')?choice:null;
 const document={hidden:false,getElementById:node,addEventListener:(type,fn)=>on('document',type,fn),
  querySelectorAll:selector=>selector==='[data-callout-slot],[data-contractor-row] input'?[choice]:[]};
 const context=vm.createContext({console,URL,URLSearchParams,AbortController,document,navigator:{onLine:true},location:{search:'',hash:''},crypto:{randomUUID:()=> 'synthetic-operation'},
  window:{lucide:{createIcons(){}},MemphisAuth:{opsManagerAuthHeaders:async()=>({}),getCSTDateString:()=> '2026-09-24'},addEventListener:(type,fn)=>on('window',type,fn),
   setTimeout:(fn,delay)=>{timers.set(++nextTimer,{fn,delay});return nextTimer;},clearTimeout:id=>timers.delete(id),
   setInterval:(fn,delay)=>{timers.set(++nextTimer,{fn,delay,interval:true});return nextTimer;},clearInterval:id=>timers.delete(id)}});
 const run=code=>vm.runInContext(code,context);run(source);
 run(`globalThis.actualApi=api;globalThis.calls=[];globalThis.releaseRead=null;globalThis.heldRead=null;
  state.baseUrl='https://synthetic.invalid';state.snapshot={week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:7,drafts:[],sources:[{source_id:'source'}],current_publication:{publication_id:'publication',version_id:'version'},exceptions:[{id:'exception',type:'pto',serviceDate:'2026-09-24'}]};
  els.week_start.value='2026-09-21';els.service_date.value='2026-09-24';els.absence_type.value='daily_absence';
  clearCoverAllPdfs=()=>{};render=()=>{};globalThis.readResult=()=>({week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:8,drafts:[],current_publication:{publication_id:'publication'}});
  api=async(path,options={})=>{calls.push({path,method:options.method||'GET'});if(options.method==='POST')return{};if(heldRead)return heldRead;return readResult();};`);
 const fire=delay=>{for(const [id,timer] of [...timers])if(timer.delay===delay&&!timer.interval){timers.delete(id);timer.fn();}};
 return {run,node,choice,context,document,emit,timers,fire};
}

// MR01: dispatch close listeners synchronously like a real DOM event, then let
// the confirmed handler's promise continuation run before a later task.
for(const action of ['generateDraft()','publishDraft()','reverseChange({target:{closest:()=>({dataset:{reverseException:"exception"}})}})']){
 const f=fixture();if(action==='publishDraft()')f.run('state.snapshot.drafts=[{version_id:"draft",revision:1}]');
 f.run('installScheduleAutoRefresh();heldRead=new Promise(resolve=>releaseRead=resolve)');
 const execution=f.run(action);await turns();
 check(f.node('action-confirm-dialog').open,true,action+' opens actual confirmation');
 await f.run('requestScheduleRefresh()');
 f.node('action-confirm-dialog').close('confirm');await turns();
 check(f.run('calls.filter(c=>c.method==="POST").length'),1,action+' confirmed write owns lane before refresh');
 f.fire(0);await turns();
 check(f.run('calls.filter(c=>c.method==="POST").length'),1,action+' deferred read never duplicates write');
 f.run('releaseRead(readResult())');await execution;await turns();
 f.emit('window','pagehide');
}

// MR02: the actual edit/change events must distinguish a reverted choice and a
// discarded turnover form from a genuinely unsaved day selection.
{
 const f=fixture();f.run('installScheduleAutoRefresh()');
 f.choice.checked=true;f.emit('document','change',{target:f.choice});
 check(f.run('state.scheduleInputDirty'),true,'checked callout remains protected');
 await f.run('requestScheduleRefresh()');check(f.run('calls.length'),0,'unsaved callout defers read');
 f.choice.checked=false;f.emit('document','change',{target:f.choice});await turns();f.fire(0);await turns();
 check(f.run('state.scheduleInputDirty'),false,'reverted choice releases dirty ownership');
 check(f.run('calls.length'),1,'revert permits queued read without manual refresh');
 f.emit('window','pagehide');
}
for(const preserveDayInput of [false,true]){
 const f=fixture();f.run('installScheduleAutoRefresh()');
 if(preserveDayInput){f.choice.checked=true;f.emit('document','change',{target:f.choice});}
 f.node('turnover-dialog').showModal();
 f.emit('document','input',{target:{closest:selector=>selector.includes('#turnover-form')?{}:null}});
 await f.run('requestScheduleRefresh()');f.run('closeTurnoverDialog()');f.fire(0);await turns();
 check(f.run('state.scheduleInputDirty'),preserveDayInput,'cancelled turnover preserves only actual day choices');
 check(f.run('calls.length'),preserveDayInput?0:1,'cancel releases refresh only if no remaining choice');
 f.emit('window','pagehide');
}

// MR03: use the real API, not an abort-aware replacement. Authentication can
// settle late; neither its late completion nor the old response may own UI.
for(const phase of ['auth','fetch','body']){
 const f=fixture();let releaseStep;let fetchCalls=0;
 const pending=new Promise(resolve=>{releaseStep=resolve;});
 const payload={ok:true,data:{week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:99}};
 const response={ok:true,json:async()=>phase==='body'?pending:payload};
 if(phase==='auth')f.context.window.MemphisAuth.opsManagerAuthHeaders=()=>pending;
 f.context.fetch=async()=>{fetchCalls++;return phase==='fetch'?pending:response;};
 f.run('api=actualApi');const execution=f.run('requestScheduleRefresh()');let settled=false;execution.then(()=>settled=true);
 await turns();f.fire(15000);await turns();
 check(settled,true,phase+' timeout settles automatic refresh promise');
 check(f.run('state.busy'),false,phase+' timeout releases manager controls');
 check(f.run('state.scheduleRefreshRunning'),false,phase+' timeout releases refresh owner');
 check(f.run('state.scheduleRefreshQueued'),true,phase+' timeout retains queued recovery');
 releaseStep(phase==='auth'?{Authorization:'synthetic-only'}:phase==='fetch'?response:payload);await turns();
 check(fetchCalls,phase==='auth'?0:1,'late '+phase+' cannot start another obsolete scheduler read');
 check(f.run('state.snapshot.authority_revision'),7,'late '+phase+' cannot render stale result');
 check(f.timers.size,0,'completed timeout leaves no owned timer');
}

{
 const f=fixture();f.run('installScheduleAutoRefresh()');
 const action=f.run('generateDraft()');await turns();await f.run('requestScheduleRefresh()');
 f.node('action-confirm-dialog').close('cancel');await action;f.fire(0);await turns();
 check(f.run('calls.filter(c=>c.method==="POST").length'),0,'cancelled confirmation never writes');
 check(f.run('calls.filter(c=>c.method==="GET").length'),1,'cancelled confirmation releases queued read');
 f.node('turnover-dialog').showModal();f.run('closeTurnoverDialog()');
 check([...f.timers.values()].filter(t=>t.delay===0).length,1,'one deferred close task is owned');
 f.emit('window','pagehide');check(f.timers.size,0,'pagehide cleans deferred task and interval');
}

console.log(JSON.stringify({status:failures.length?'HOLD_REFRESH_COORDINATION':'PASS_REFRESH_COORDINATION',checks,failed:failures.length,failures,
 limits:'Actual inline functions with synchronous synthetic DOM dispatch and controlled auth/transport/timers; not browser, live auth, SQL or phone proof.'},null,2));
if(failures.length)process.exitCode=1;
