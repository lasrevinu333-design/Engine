import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,posix,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
const fixtureRoot=dirname(fileURLToPath(import.meta.url));
const baseline=resolve(fixtureRoot,'..');
const require=createRequire(baseline+'/mobile/package.json');
const {transformSync}=require('esbuild');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pins=new Map();
const syntheticLocksPath=baseline+'/scripts/synthetic-schedule-locks.mjs';
const {createSyntheticScheduleLocks}=await import(syntheticLocksPath);pins.set(relative(baseline,syntheticLocksPath),sha(readFileSync(syntheticLocksPath)));

// Explicit synthetic native/vendor/DOM ports only; all security/employee/
// presenter/scheduler/reminder factories below are the actual normal graph.
const id=n=>`94000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const day='2026-09-28',now=Date.parse(day+'T17:00:00Z');
const FixedDate=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
// Preserve the actual Date intrinsic OWN descriptor expected by the real inventory.
Object.defineProperty(FixedDate.prototype,'getTime',Object.getOwnPropertyDescriptor(Date.prototype,'getTime'));
const nativePrincipal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(2),
 credential_id:id(3),credential_operation_id:id(8),assignment_epoch:7,
 installation_seal:'synthetic-installation-seal-01',enrolled_at:day+'T00:00:00Z'};
const principal={deviceId:id(1),employeeId:id(2),credentialId:id(3),assignmentEpoch:7};
const flat=x=>'{'+Object.keys(x).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(x[k])).join(', ')+'}';
function payload(revision,{blocked=false,oversized=false}={}) {
 const view={schema:'static-weekly.recurring-render-view.v1',service_date:day,employee_id:id(2),employee_name:'Synthetic Employee',
  publication_id:id(4),projection_id:id(5),projection_status:'current',full_day:true,shift:{start:'07:00',end:'16:00'},
  raw_items:[{name:oversized?'S'.repeat(210000):'Synthetic Restroom',coverage_start:'07:00',coverage_end:'16:00'}]};
 const target={schema:blocked?'static-weekly.recurring-terminal-target.v1':'static-weekly.recurring-application-target.v1',
  targetType:blocked?'BLOCKED_RECURRING_AUTHORITY':'SCHEDULE',operationId:id(6),publicationId:id(4),serviceDate:day,
  authorityRevision:revision,...principal,...(blocked?{invalidationId:id(7),reasonCode:'ROSTER_DEPENDENCY_CHANGED'}:
  {projectionId:id(5),lunchDocumentIdentity:'a'.repeat(64),viewDigest:sha(JSON.stringify(view))})};
 const delivery={intentId:id(revision),target,targetDigest:sha(flat(target)),applicationStatus:'PENDING',
  ...(blocked?{replacementCoverageReady:false}:{view,viewJsonText:JSON.stringify(view),viewDigest:target.viewDigest})};
 return {...(blocked?{service_date:day,employee_id:id(2),employee_name:'Synthetic Employee',projection_status:'blocked_recurring_authority',full_day:true,raw_items:[],shift:null}:view),
  canonical_device_id:'KIOSK_08',canonical_device_pk:id(1),credential_id:id(3),assignment_epoch:7,
  schedule_delivery_mode:blocked?'RECURRING_TERMINAL':'RECURRING_SCHEDULE',recurring_delivery:delivery,schedule_application:null};
}
function syntheticState() {return {state:'ACTIVE',active:true,blocked:false,credential_present:true,credential_usable:true,
 recovery_required:false,legacy_pending:false,pending_server_confirmation:false,removal_pending:false,removal_finalized:false,
 active_enrollment_flow:'enrollment',active_enrollment_operation_id:id(8),active_credential_id:id(3),principal:nativePrincipal,
 installation:{schema_version:1,device_id:'KIOSK_08',enrollment_operation_id:id(8),installation_seal:nativePrincipal.installation_seal,
 enrolled_at:nativePrincipal.enrolled_at,migrated_from_credential_only_state:false}};}

const wait=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture({loading=false,closeBeforeImport=false,foreignPage=false,missingPort=false,
 forgedMarker=false,foreignFrame=false,deferState=false,closeCommand=null,active=false,deferReminder=false,deferBridge=false,initial=payload(19)}={}) {
 // A fresh document has its OWN mutable Storage prototype. Reusing a host
 // prototype would preserve the first document's actual installed firewall.
 class StorageArea {
  constructor(){this.rows=new Map();}
  get length(){return this.rows.size;}
  key(i){return [...this.rows.keys()][i]??null;}
  getItem(k){return this.rows.get(String(k))??null;}
  setItem(k,v){this.rows.set(String(k),String(v));}
  removeItem(k){this.rows.delete(String(k));}
  clear(){this.rows.clear();}
 }
 const pages=new Map(),documents=new Map(),portEvents=new Map(),posts=[],calls=[],elements=new Map();
 const add=(map,key,fn)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(fn);};
 const remove=(map,key,fn)=>map.get(key)?.delete(fn);
 const emit=(map,key)=>{for(const fn of [...(map.get(key)??[])])fn();};
 let releaseState;const stateGate=deferState?new Promise(resolve=>{releaseState=resolve;}):Promise.resolve();
 let next=initial,summaryReads=0,releaseResponse=null,holdResponse=null;
 let bridgeRelease=null,bridgeWaiting=0,bridgeReads=0;
 const bridgeGate=deferBridge?new Promise(resolve=>{bridgeRelease=resolve;}):null;
 const bridgeFlight={get waiting(){return bridgeWaiting;},get reads(){return bridgeReads;},
  release(){assert.ok(bridgeRelease);const done=bridgeRelease;bridgeRelease=null;done();}};

 const realmData=value=>vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(value))+')',context);
 const summary={get reads(){return summaryReads;},set(value){next=value;},hold(){assert.equal(holdResponse,null);holdResponse=new Promise(r=>{releaseResponse=r;});},
  release(){assert.ok(releaseResponse);const done=releaseResponse;releaseResponse=null;holdResponse=null;done();}};
 const plugin=new Proxy({getState:async()=>{await stateGate;return active?realmData(syntheticState()):{blocked:true};},
  authorizedRequest:async request=>{
   calls.push({plugin:'native',method:'authorizedRequest',path:request.path,httpMethod:request.method});
   assert.equal(active,true,'Blocked fixture cannot return authenticated DATA');assert.equal(request.method,'GET');
   let data;
   if(request.path.startsWith('/device-auth/status?'))data={employee_id:id(2),credential_id:id(3),assignment_epoch:7,canonical_device_id:'KIOSK_08'};
   else if(request.path.startsWith('/schedule-api/my-day-summary?')){summaryReads++;if(holdResponse)await holdResponse;data=next;}
   else if(request.path.startsWith('/message-api/device-location-status-reminders?')){
    bridgeReads++;if(bridgeGate){bridgeWaiting++;try{await bridgeGate;}finally{bridgeWaiting--;}}
    return realmData({status:200,headers:{'content-type':'application/json'},body_base64:Buffer.from(JSON.stringify({ok:true,data:[],meta:{accepted_location_sessions:[]}})).toString('base64')});
   }

   else throw Error('No synthetic native route: '+request.path);
   return realmData({status:200,headers:{'content-type':'application/json'},body_base64:Buffer.from(JSON.stringify({ok:true,data})).toString('base64')});
  }},{get(target,key){
  if(key in target)return target[key];
  return async()=>{calls.push({plugin:'native',method:String(key)});throw Error('Synthetic blocked native fixture has no effects.');};
 }});
 const recordingPlugin=new Proxy({}, {get(_target,key){return async()=>{
  calls.push({plugin:'platform',method:String(key)});
  if(key==='addListener')return {remove:async()=>{}};
  if(key==='getStatus')return {connected:false};
  if(key==='checkPermissions')return {display:'denied',receive:'denied'};
  throw Error('Unprovided synthetic platform operation: '+String(key));
 };}});
 class NativeNode {get textContent(){return this._text??'';}set textContent(value){this._text=String(value);}}
 class NativeElement extends NativeNode {get innerHTML(){return this._html??'';}set innerHTML(value){this._html=String(value);}}
 class NativeHTMLElement extends NativeElement {get hidden(){return this._hidden??false;}set hidden(value){this._hidden=Boolean(value);}
  addEventListener(){} removeEventListener(){} }
 const doc={readyState:loading?'loading':'complete',hidden:false,
  addEventListener:(name,fn)=>add(documents,name,fn),removeEventListener:(name,fn)=>remove(documents,name,fn),
  getElementById(id){if(!elements.has(id))elements.set(id,new NativeHTMLElement());return elements.get(id);},
  documentElement:{classList:{add(){},remove(){},toggle(){}},style:{setProperty(){}}},body:{dataset:{},classList:{add(){},remove(){}}},
  querySelector(){return null;},querySelectorAll(){return [];}};
 const location={href:foreignPage?'https://localhost/events.html':'https://localhost/employee-schedule.html',
  origin:'https://localhost',protocol:'https:',hostname:'localhost',host:'localhost',pathname:foreignPage?'/events.html':'/employee-schedule.html',search:''};
 const port={postMessage(raw){posts.push(JSON.parse(raw));},addEventListener(name,fn){portEvents.set(name,fn);}};
 const locks=createSyntheticScheduleLocks();
 const context=vm.createContext({Date:FixedDate,Intl,Node:NativeNode,Element:NativeElement,HTMLElement:NativeHTMLElement,console,URL,URLSearchParams,TextEncoder,TextDecoder,Headers,Request,Response,
  AbortController,AbortSignal,DOMException,FormData,Blob,EventTarget,Event,crypto:webcrypto,document:doc,location,
  btoa:raw=>Buffer.from(raw,'binary').toString('base64'),atob:raw=>Buffer.from(raw,'base64').toString('binary'),
  navigator:{locks,onLine:active},localStorage:new StorageArea(),sessionStorage:new StorageArea(),
  indexedDB:{async databases(){return [];},open(){throw Error('No fixture database declaration');}},
  fetch:async()=>{throw Error('No authenticated HTTP supplied by this Source birth fixture.');},
  addEventListener:(name,fn)=>add(pages,name,fn),removeEventListener:(name,fn)=>remove(pages,name,fn),dispatchEvent:()=>true,
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},
  CustomEvent:class extends Event {constructor(type,options={}){super(type);this.detail=options.detail;}},
  custodialRecurringScheduleApplication:port,__MZ_CUSTODIAL_BROWSER_TEST__:false,
 });
 // Response.json must construct ordinary JSON in the SAME document realm.
 // This replaces only the synthetic browser Response primitive, not a producer.
 class RealmResponse extends Response {
  async json(){return realmData(JSON.parse(await this.text()));}
  clone(){const clone=super.clone();clone.json=async()=>realmData(JSON.parse(await clone.text()));return clone;}
 }
 context.Response=RealmResponse;
 // Explicit synthetic native retirement port, never Java/Engine/receipt proof.
 context.syntheticNativeAbortCalls=0;
 context.custodialRecurringOriginalWriterAbort=Object.freeze({abort(grant,reply){
  assert.equal(grant,'a'.repeat(64));assert.equal(reply,'b'.repeat(64));context.syntheticNativeAbortCalls++;return true;
 }});
 vm.runInContext('globalThis.window=globalThis;globalThis.top=globalThis;',context);
 // SAME maintained page script, normally parsed before DOMContentLoaded and
 // the native lazy bridge's employee mount. It is not a synthetic verifier.
 const normalTargetAsset=resolve(baseline,'memphis-recurring-schedule-target.js');
 const normalTargetBytes=readFileSync(normalTargetAsset,'utf8');pins.set(relative(baseline,normalTargetAsset),sha(normalTargetBytes));
 vm.runInContext(normalTargetBytes,context,{filename:'actual-normal-memphis-recurring-schedule-target.js'});
 if(foreignFrame)context.top={};
 if(missingPort)delete context.custodialRecurringScheduleApplication;
 if(forgedMarker)vm.runInContext("Object.defineProperty(globalThis,'custodialNativeNormalApplicationOwner',{value:{schema:'custodial.native-normal-application-owner.v1'}})",context);
 const vendors={
  '@capacitor/core':{Capacitor:{getPlatform:()=> 'android',isNativePlatform:()=>true,isPluginAvailable:()=>true}},
  '@memphis-zoo/custodial-native-vault':{CustodialNativeVault:plugin},
  '@capacitor/app':{App:recordingPlugin},'@capacitor/network':{Network:recordingPlugin},
  '@capacitor/status-bar':{StatusBar:recordingPlugin},'@capacitor/local-notifications':{LocalNotifications:recordingPlugin},
  '@capacitor-firebase/messaging':{FirebaseMessaging:recordingPlugin},
 };
 const modules=new Map(),importErrors=[];let releaseReminder;
 const reminderGate=deferReminder?new Promise(resolve=>{releaseReminder=resolve;}):Promise.resolve();
 function moduleFor(name) {
  if(!vendors[name]&&!existsSync(resolve(baseline,name))){
   name=[name+'.js',name+'.ts'].find(candidate=>existsSync(resolve(baseline,candidate)))??name;
  }
  if(modules.has(name))return modules.get(name);
  if(vendors[name]){const values=vendors[name];const m=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context,identifier:name});modules.set(name,m);return m;}
  const source=resolve(baseline,name);
  const raw=readFileSync(source,'utf8');pins.set(relative(baseline,source),sha(raw));
  const code=name.endsWith('.ts')?transformSync(raw,{loader:'ts',format:'esm',target:'es2022'}).code:raw;
  const m=new vm.SourceTextModule(code,{context,identifier:name,
   async importModuleDynamically(specifier,ref){try{const child=moduleFor(posix.normalize(posix.join(posix.dirname(ref.identifier),specifier)));
    if(child.identifier==='mobile/src/custodial/device-reminders-runtime.js')await reminderGate;
    if(child.status==='unlinked')await child.link(link);if(child.status==='linked')await child.evaluate();return child;
   }catch(error){importErrors.push(error.stack);throw error;}}});
  modules.set(name,m);return m;
 }
 const link=(specifier,ref)=>moduleFor(specifier.startsWith('.')?posix.normalize(posix.join(posix.dirname(ref.identifier),specifier)):specifier);
 const entry=moduleFor('mobile/src/custodial/native-recurring-application.js');await entry.link(link);await entry.evaluate();
 entry.namespace.installNativeRecurringApplication({grantToken:'a'.repeat(64),replyToken:'b'.repeat(64)});
 if(closeBeforeImport)emit(pages,'pagehide');
 if(closeCommand)portEvents.get('message')?.({data:JSON.stringify(closeCommand)});
 if(loading){doc.readyState='interactive';emit(documents,'DOMContentLoaded');}
 for(let i=0;i<30;i++)await wait();
 return {context,posts,calls,portEvents,pages,documents,emit,entry,modules,importErrors,releaseState,summary,elements,releaseReminder,bridgeFlight,
  async ordinaryFallback(){const normal=moduleFor('mobile/src/custodial/bridge.js');
   if(normal.status==='unlinked')await normal.link(link);if(normal.status==='linked')await normal.evaluate();
   for(let i=0;i<30;i++)await wait();}};
}

// Source-only prepared qualification. It must execute in a NEW Root-owned
// process and produce its own exclusive receipt before any PASS is claimed.
let diagnosticOwner=null;const waitFor=async(operation,label)=>{const until=performance.now()+5000;while(performance.now()<until){if(operation())return;await wait();}const f=diagnosticOwner;console.error(JSON.stringify({stage:label,security:f?.context.MemphisCustodialSecurity?.getStatus?.(),summaryReads:f?.summary.reads,calls:f?.calls,posts:f?.posts.length,importErrors:f?.importErrors,contentState:f?.elements.get('state-text')?.textContent}));throw Error(label);};
let phase=1;
function observe(f){const before=f.posts.length;f.portEvents.get('message')({data:JSON.stringify({
 schema:'custodial.native-recurring-document-command.v1',command:'OBSERVE_RAW_DATA',grant_token:'a'.repeat(64),phase:(phase++).toString(16).padStart(64,'0')})});
 return f.posts.length>before?f.posts.at(-1).data:null;}
const rendered=f=>observe(f)?.employee?.original_typed_render??null;
let ordinaryChecks=0;
function command(f,command,holdPhase){const before=f.posts.length,nonce=(phase++).toString(16).padStart(64,'0');
 f.portEvents.get('message')({data:JSON.stringify({schema:'custodial.native-recurring-document-command.v1',command,
 grant_token:'a'.repeat(64),phase:nonce,...(holdPhase?{hold_phase:holdPhase}:{})})});
 return {phase:nonce,reply:f.posts.length>before?f.posts.at(-1):null};}
async function ordinary(f,expectedType){
 // Genuine passive actual-writer observations only; one HOLD after bounded
 // quiescence, never repeated HOLD, fake state reset or new product deadline.
 let state=null;for(let i=0;i<16;i++){
  state=command(f,'OBSERVE_CALLBACK_WRITERS').reply;
  if(state?.active_writer_count===0&&state?.writer_unknown===false&&state?.snapshot_owners_ready===true)break;
  await wait();
 }
 assert.equal(state?.active_writer_count,0);assert.equal(state?.writer_unknown,false);assert.equal(state?.snapshot_owners_ready,true);
 const first=command(f,'HOLD_ORDINARY_DELIVERY_WRITERS');assert.equal(first.reply?.schema,'custodial.native-recurring-ordinary-held-data.v1');ordinaryChecks++;
 assert.equal(first.reply.receipt_eligible,false);assert.equal(first.reply.data.employee.original_typed_render.original_source.schedule_delivery_mode,expectedType);ordinaryChecks++;
 assert.equal(first.reply.data.selector.intent_id,first.reply.data.employee.original_typed_render.original_source.recurring_delivery.intentId);
 assert.equal(first.reply.data.presenter.schema,'custodial.native-presenter-ordinary-target-data.v1');
 assert.equal(first.reply.data.scheduler.schema,'custodial.native-scheduler-ordinary-target-data.v1');
 assert.equal(first.reply.data.reminder.schema,'custodial.native-reminder-ordinary-target-data.v1');ordinaryChecks++;
 const terminal=command(f,'OBSERVE_ORDINARY_HELD_CALLBACK_WRITERS',first.phase);
 assert.equal(terminal.reply?.schema,'custodial.native-recurring-ordinary-held-data.v1');
 assert.equal(terminal.reply.writer_epoch,first.reply.writer_epoch);assert.deepEqual(terminal.reply.data,first.reply.data);ordinaryChecks++;
 const mixed=command(f,'OBSERVE_HELD_CALLBACK_WRITERS',first.phase);assert.equal(mixed.reply?.schema,'custodial.native-recurring-callback-refused-data.v1');
 assert.equal(mixed.reply.kind,'OBSERVATION_FAILED');ordinaryChecks++;
 command(f,'RELEASE_CALLBACK_WRITERS',first.phase);return first.reply;
}

// One actual normal render commits while the real Bridge reconciliation is
// awaiting its accepted-session HTTP. The old untracked flight emitted a wake
// then later entered the held reminder writer (actual547 REMINDER_1636).
let bridgeChecks=0;
const f=await fixture({active:true,deferBridge:true});diagnosticOwner=f;
await waitFor(()=>f.summary.reads>0&&f.elements.get('areas')?.innerHTML.includes('Synthetic Restroom')&&f.bridgeFlight.waiting>0,
 'Actual normal commit and deferred accepted-session bridge flight');
const wakeRows=()=>f.posts.filter(row=>row.schema==='custodial.native-recurring-ordinary-render-wake.v1');
assert.equal(wakeRows().length,0,'A tracked actual bridge continuation cannot emit the original scheduling notice early');
const busy=command(f,'OBSERVE_CALLBACK_WRITERS').reply;
assert.equal(busy.writer_unknown,false);assert.ok(busy.active_writer_count>0,'Whole real bridge Promise remains active across transport');
assert.equal(busy.hold_active,false);bridgeChecks+=4;
f.bridgeFlight.release();
await waitFor(()=>wakeRows().length===1&&command(f,'OBSERVE_CALLBACK_WRITERS').reply?.active_writer_count===0,
 'Original scheduling notice delivered after actual terminal completion');
for(let i=0;i<12;i++)await wait();
assert.equal(wakeRows().length,1,'Terminal completion flushes ONE original notice, no retries');
assert.equal(f.bridgeFlight.waiting,0);assert.equal(rendered(f).original_source.recurring_delivery.target.authorityRevision,19);bridgeChecks+=3;
const initial=command(f,'HOLD_ORDINARY_DELIVERY_WRITERS');
assert.equal(initial.reply?.schema,'custodial.native-recurring-ordinary-held-data.v1');
const terminal=command(f,'OBSERVE_ORDINARY_HELD_CALLBACK_WRITERS',initial.phase);
assert.equal(terminal.reply?.schema,'custodial.native-recurring-ordinary-held-data.v1');
assert.equal(terminal.reply.writer_epoch,initial.reply.writer_epoch);bridgeChecks+=3;
// One NEW genuine bridge invocation is preserved after native denial. It
// cannot supply terminal held evidence or a processed-release ACK afterward.
const before=f.bridgeFlight.reads;
await f.context.MemphisMobile.retryNotificationPresentation();
assert.equal(f.bridgeFlight.reads,before+1);assert.equal(f.context.syntheticNativeAbortCalls,1);
assert.equal(command(f,'OBSERVE_ORDINARY_HELD_CALLBACK_WRITERS',initial.phase).reply,null);
assert.equal(command(f,'RELEASE_ORDINARY_DELIVERY_WRITERS',initial.phase).reply,null);bridgeChecks+=4;
// Explicit synthetic downstream fault at the existing normal callback seam.
// No normal producer/owner/frame is fabricated: this negative proves the fixed
// bridge wrapper returns the same rejection and always terminates its ticket.
const g=await fixture({active:true});
await waitFor(()=>rendered(g)?.original_source?.recurring_delivery?.target.authorityRevision===19&&command(g,'OBSERVE_CALLBACK_WRITERS').reply?.active_writer_count===0&&g.posts.some(row=>row.schema==='custodial.native-recurring-ordinary-render-wake.v1'),'Fresh actual normal owner before original throw');
const gWakes=g.posts.filter(row=>row.schema==='custodial.native-recurring-ordinary-render-wake.v1').length;
const actualReminder=g.context.MemphisDeviceReminders,original=actualReminder.reconcileScheduleAuthority;
const fault=new Error('Synthetic actual bridge downstream fault');
actualReminder.reconcileScheduleAuthority=()=>{throw fault;};
try{await assert.rejects(g.context.MemphisMobile.retryNotificationPresentation(),error=>error===fault);}
finally{actualReminder.reconcileScheduleAuthority=original;}
const afterFault=command(g,'OBSERVE_CALLBACK_WRITERS').reply;
assert.equal(afterFault.active_writer_count,0);assert.equal(afterFault.writer_unknown,false);
assert.equal(g.posts.filter(row=>row.schema==='custodial.native-recurring-ordinary-render-wake.v1').length,gWakes,'Failed unrelated invocation creates no new render notice');bridgeChecks+=3;
g.emit(g.pages,'pagehide');
f.emit(f.pages,'pagehide');
assert.equal(f.calls.some(row=>row.method==='authorizedRequest'&&row.httpMethod!=='GET'),false);bridgeChecks++;
console.log(JSON.stringify({status:'PASS_ACTUAL_NORMAL_BRIDGE_FLIGHT_AND_PENDING_WAKE',bridgeChecks,
 actual_normal_module_files:pins.size,receipt:false,native_owner:false,OS_settlement:false,
 scope:'Actual normal graph with synthetic native/DOM/vendor/authenticated accepted-session HTTP gate. No real Java frame/nativeSDK/backend/receipt proof.'}));
