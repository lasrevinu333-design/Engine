import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
// Installed under scripts/fixtures; real permission, publication and actions
// clients are used. Only DOM, storage, transport and time are synthetic.
const A=require('../../memphis-scheduler-actions.js'),P=require('../../memphis-approved-schedule.js');
export const turn=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
export function fixture(){
 const nodes=new Map(),events=new Map(),timers=new Map(),calls=[],writes=[],rendered=[],storageMap=new Map();let timerId=0,root;
 const session={role:'ops_manager',manager_id:'11000000-0000-4000-8000-000000000001',credential_id:'12000000-0000-4000-8000-000000000001',device_id:'synthetic',token:'inert-test-token',expires_at:'2099-01-01T00:00:00.000Z',read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}};
 const on=(target,type,fn,options={})=>{const key=target+':'+type;events.set(key,[...(events.get(key)||[]),{fn,once:options.once}]);};
 const emit=(target,type,event={})=>{const key=target+':'+type;for(const item of [...events.get(key)||[]]){if(item.once)events.set(key,(events.get(key)||[]).filter(row=>row!==item));item.fn(event);}};
 const element=(id='')=>({id,value:'',checked:false,disabled:false,hidden:false,open:false,dataset:{},textContent:'',children:[],attributes:new Map(),classList:{toggle(){}},
  get parentNode(){return root;},get ownerDocument(){return document;},get options(){return this.children;},set selectedIndex(index){this.value=this.children[index]?.value||'';},
  append(...children){this.children.push(...children);},add(child){this.children.push(child);},insertBefore(child){this.children.push(child);},replaceChildren(...children){this.children=children;},
  setAttribute(name,value){this.attributes.set(name,value);},focus(){},scrollIntoView(){},showModal(){this.open=true;},close(value){if(value!==undefined)this.returnValue=value;this.open=false;emit(this.id,'close');},
  addEventListener(type,fn,options){on(this.id,type,fn,options);},closest(selector){return selector.includes('#'+this.id)||selector.includes('[data-callout-slot]')&&this.dataset.calloutSlot?this:null;}});
 const node=id=>{if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);};root=element('root');
 const choice=node('test-callout');choice.dataset.calloutSlot='22000000-0000-4000-8000-000000000001';
 const inputs=[choice,...['absence-end-date','absence-type','approved-source','manual-activation-choice'].map(node)];
 node('absence-type').value='daily_absence';node('manual-activation-confirm').hidden=true;
 const document={hidden:false,getElementById:node,createElement:()=>element(),createTextNode:text=>({textContent:text}),addEventListener:(name,fn,options)=>on('document',name,fn,options),
  querySelector:selector=>node(selector),querySelectorAll:selector=>{
   if(selector.startsWith('[data-callout-slot],[data-contractor-row] input,'))return inputs;
   if(selector==='[data-callout-slot]:checked:not(:disabled)')return choice.checked&&!choice.disabled?[choice]:[];
   if(selector==='[data-callout-slot]:not(:checked)')return choice.checked?[]:[choice];
   return [];
  }};
 const clock={setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay,interval:false});return timerId;},clearTimeout:id=>timers.delete(id),
  setInterval:(fn,delay)=>{timers.set(++timerId,{fn,delay,interval:true});return timerId;},clearInterval:id=>timers.delete(id)};
 const storage={getItem:key=>storageMap.get(key)||null,setItem:(key,value)=>storageMap.set(key,String(value)),removeItem:key=>storageMap.delete(key)};
 const auth={readSession:()=>session,opsManagerAuthHeaders:async()=>({'X-Synthetic':'inert'}),getCSTDateString:()=> '2026-09-24',requireOpsManagerSession:async()=>session};
 const snapshot={week_start:'2026-09-21',week_end:'2026-09-27',current_service_date:'2026-09-24',authority_revision:7,drafts:[],projection_status:'current',
  current_publication:{publication_id:'33000000-0000-4000-8000-000000000001',version_id:'44000000-0000-4000-8000-000000000001'},latest_projection:{projection_id:'55000000-0000-4000-8000-000000000001'},
  roster:[],assignments:[],availability:[],exceptions:[],sources:[]};
 let nextSnapshot=structuredClone({...snapshot,authority_revision:8}),readHook=async()=>{},bodyHook=async()=>{},fail=false,renderHook=()=>{};
 const context=vm.createContext({console,URL,URLSearchParams,AbortController,AbortSignal,TextEncoder,document,navigator:{onLine:true},location:{search:'?week_start=2026-09-21&date=2026-09-24',hash:''},crypto:{randomUUID:()=> '66000000-0000-4000-8000-000000000001'},
  Option:class{constructor(text,value){this.textContent=text;this.value=value;}},...clock,
  window:{...clock,MemphisAuth:auth,MemphisSchedulerActions:{...A,create:options=>A.create({...options,storage})},
   MemphisApprovedSchedule:{...P,create:options=>P.create({...options,storage}),mountManualActivation:()=>({load:async()=>{},refreshControls(){},normalLocked:()=>false})},lucide:{createIcons(){}},addEventListener:(name,fn,options)=>on('window',name,fn,options)},
  fetch:async(url,options={})=>{
   const path=new URL(url).pathname;
   calls.push({path,url:String(url),method:options.method||'GET',body:options.body,signal:options.signal});
   if(options.method==='POST')throw Error('Unexpected mutation in read-only fixture');
   await readHook(path,options);if(fail)throw Error('synthetic offline');
   const data=path==='/scheduler-runtime-config'?{public_url:'https://synthetic.invalid'}:path==='/static-weekly/approved-choices'?{schema:'custodial.approved-schedule-choices.v1',initial:[]}:structuredClone(nextSnapshot);
   return{ok:true,status:200,json:async()=>{await bodyHook(path);return{ok:true,data};}};
  }});
 const source=readFileSync(new URL('../../schedule-weekly.js',import.meta.url),'utf8').replace(/^init\(\)\.catch\([^\n]+$/m,'');
 vm.runInContext(source,context);const run=code=>vm.runInContext(code,context);
 context.initialSnapshot=structuredClone(snapshot);context.recordRender=revision=>{rendered.push(revision);renderHook();};context.recordWrite=(...args)=>writes.push(args);
 run(`state.baseUrl='https://synthetic.invalid';state.snapshot=initialSnapshot;state.principal=window.MemphisSchedulerActions.principal(window.MemphisAuth);
  state.actions=window.MemphisSchedulerActions.create({auth:window.MemphisAuth,api,baseUrl:state.baseUrl,onState:r=>state.pending=r});
  els.week_start.value='2026-09-21';els.service_date.value='2026-09-24';
  render=()=>recordRender(state.snapshot.authority_revision);renderChanges=()=>{};renderStaffingHistory=()=>{};renderApprovedPreview=()=>{};renderPending=()=>{};
  rememberScheduleInputs();`);
 const fire=async delay=>{for(const [id,timer] of [...timers])if(timer.delay===delay){if(!timer.interval)timers.delete(id);timer.fn();}await turn();};
 const json=code=>JSON.parse(run('JSON.stringify('+code+')'));
 const edit=(target,value)=>{target.value=value;emit('document','input',{target});};
 const cleanup=async()=>{emit('window','pagehide');await turn();assert.equal(timers.size,0,'fixture owns no remaining timer');};
 return{run,json,node,choice,inputs,context,document,events,timers,calls,writes,rendered,session,auth,storageMap,snapshot,emit,fire,edit,cleanup,
  setSnapshot:value=>nextSnapshot=value,setReadHook:value=>readHook=value,setBodyHook:value=>bodyHook=value,setFail:value=>fail=value,setRenderHook:value=>renderHook=value};
}
