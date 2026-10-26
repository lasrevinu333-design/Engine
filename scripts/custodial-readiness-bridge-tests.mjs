import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// Event selectors execute the owning install/action/lifecycle and transport
// bodies plus the REAL outbox, private principal, runtime and admission guards.
// Only unrelated platform callbacks/HTTP completion are recording fixtures.
// Admitted cases are SYNTHETIC operational admission, not release activation.
const source=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
if(process.env.BROWSER_ORIGINAL_HELD_LIFECYCLE_CASE){
 await originalBrowserHeldLifecycleCase(process.env.BROWSER_ORIGINAL_HELD_LIFECYCLE_CASE);
}else if(process.env.OFFLINE_NATIVE_CURRENTNESS_CASE){
 await offlineNativeOperationCurrentnessCase(process.env.OFFLINE_NATIVE_CURRENTNESS_CASE);
}else if(process.env.OFFLINE_SNAPSHOT_WRITER_CASE){
 await offlineSnapshotWriterCurrentnessCase(process.env.OFFLINE_SNAPSHOT_WRITER_CASE);
}else if(process.env.STORAGE_FIREWALL_MULTI_AREA_CASE){
 await storageFirewallMultiAreaCase();
}else if(process.env.COMPLETION_RETIRE_BRIDGE_CASE){
 await completionRetireBridgeCase(process.env.COMPLETION_RETIRE_BRIDGE_CASE);
}else if(process.env.COMPLETION_BRIDGE_CASE){
 await completionBridgeCase(process.env.COMPLETION_BRIDGE_CASE);
}else if(process.env.EVENT_OPEN_BRIDGE_CASE){
 await eventOpenBridgeCase(process.env.EVENT_OPEN_BRIDGE_CASE);
}else if(process.env.NOTIFICATION_BRIDGE_CASE){
 await notificationBridgeCase(process.env.NOTIFICATION_BRIDGE_CASE);
}else{
const method=source.match(/  async function getReadinessObservation\([^]*?\n  \}/)?.[0];
assert.ok(method);
let generation=1, identity='original-principal', device='KIOSK_08', native=true, release, requests=[];
const state={observation:'CONFIRMED'};
const context={bridgeReady:Promise.resolve(),security:{getStatus:()=>({generation})},
 deviceId:()=>device,currentPrincipalIdentity:()=>identity,
 getNativeCustodialReadinessObservation:async(...args)=>{requests.push(args);return new Promise(resolve=>{release=()=>resolve(state);});}};
Object.defineProperty(context,'nativeVault',{get:()=>native});
vm.createContext(context);vm.runInContext(method,context);
let checks=0;
async function started(){release=null;const work=context.getReadinessObservation('KIOSK_08');await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof release,'function');return {work};}
{
 const {work}=await started();release();assert.equal(await work,state);checks++;
 assert.deepEqual(requests[0],['KIOSK_08','original-principal']);checks++;
}

for(const change of [()=>generation++,()=>identity='replacement-principal',()=>device='KIOSK_09']){
 generation=1;identity='original-principal';device='KIOSK_08';const {work}=await started();change();release();
 await assert.rejects(work,/authority changed/);checks++;
}
generation=1;identity='original-principal';device='KIOSK_08';
for(const change of [()=>generation=undefined,()=>identity='',()=>native=false]){
 generation=1;identity='original-principal';native=true;change();const before=requests.length;
 await assert.rejects(context.getReadinessObservation('KIOSK_08'),/unavailable/);assert.equal(requests.length,before);checks++;
}
assert.doesNotMatch(method,/authorize|recover|mutateProtected|setItem|getOfflineAuthorityState|waitForStableState/);checks++;
assert.match(source,/getNativeCustodialReadinessObservation,[^]*from '\.\/native-security.js'/);checks++;
assert.match(source,/window.MemphisMobile = Object.freeze\([^]*getReadinessObservation,/);checks++;
console.log(JSON.stringify({scope:'actual bridge observation method with synthetic native transport and generation/principal races',checks}));
}

async function originalBrowserHeldLifecycleCase(selected){
 assert.ok(['delayed-and-reloaded','writer-publication-lifetime'].includes(selected));
 assert.equal(typeof vm.SourceTextModule,'function','Normal Node VM-module support is required');
 const {webcrypto,createHash}=await import('node:crypto');
 const {getEventListeners}=await import('node:events');
 // Existing exported fixture import is inert with respect to its old groups.
 // Its legacy schedule-lock installer is restored on the host immediately.
 const navigatorField=Object.getOwnPropertyDescriptor(globalThis,'navigator'),hostNavigator=globalThis.navigator;
 const locksField=hostNavigator&&Object.getOwnPropertyDescriptor(hostNavigator,'locks');let idb;
 try{({protectedBrowserIdbFixture:idb}=await import('./protected-browser-inventory-tests.mjs'));}
 finally{if(hostNavigator){if(locksField)Object.defineProperty(hostNavigator,'locks',locksField);else delete hostNavigator.locks;}
  if(navigatorField)Object.defineProperty(globalThis,'navigator',navigatorField);else delete globalThis.navigator;}
 const {createSyntheticScheduleLocks}=await import('./synthetic-schedule-locks.mjs');
 const ID='11111111-1111-4111-8111-111111111111',GEN='22222222-2222-4222-8222-222222222222';
 const KEY='mz_custodial_protected_browser_hold.v1',EPOCH='mz_custodial_protected_browser_mutation.v1';
 const originalArguments={p_device_id:'KIOSK_01',p_client_session_id:ID,p_client_completion_id:GEN,
  p_native_finish_scan_entry_id:'33333333-3333-4333-8333-333333333333',p_response_json:{note:'exact original response α'}};
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
 const turn=()=>new Promise(resolve=>setTimeout(resolve,1));
 const until=async(predicate,label)=>{for(let i=0;i<2000&&!predicate();i++)await turn();assert.ok(predicate(),label);};
 const moduleNames=['native-original-browser-preparation.js','protected-browser-admission.js','protected-browser-inventory.js','storage-firewall.js'];
 const documents=[],unhandled=[],observed=[];const onUnhandled=e=>unhandled.push(e);process.on('unhandledRejection',onUnhandled);
 async function documentFixture(localRows,sessionRows,number){
  const pageEvents=new Map(),portEvents=new Map(),posts=[],timers=new Set(),targets=[];
  const sharedLocks=createSyntheticScheduleLocks(),entered=deferred(),resume=deferred();let delayed=false,armed=null;
  class Area{constructor(rows){this.rows=rows;}get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}
   getItem(k){return this.rows.get(String(k))??null;}setItem(k,v){this.rows.set(String(k),String(v));}
   removeItem(k){this.rows.delete(String(k));}clear(){this.rows.clear();}}
  const local=new Area(localRows),session=new Area(sessionRows),nativeEvents=new WeakSet();
  class DocumentEvent extends Event{get isTrusted(){return nativeEvents.has(this);}}
  class Transaction extends EventTarget{constructor(mode){super();this.originalMode=mode;targets.push(this);}
   get mode(){return this.originalMode;}abort(){queueMicrotask(()=>{const e=new DocumentEvent('abort');nativeEvents.add(e);this.dispatchEvent(e);});}}
  const wrapped=new WeakMap();let fixture;
  class Database{constructor(raw){this.raw=raw;}get name(){return this.raw.name;}get version(){return this.raw.version;}
   get objectStoreNames(){return this.raw.objectStoreNames;}close(){return this.raw.close();}
   transaction(names,mode='readonly'){return this.raw.transaction(names,mode);}}
  class Request extends EventTarget{constructor(raw){super();this.raw=raw;targets.push(this);}
   get transaction(){return this.raw.transaction??null;}get error(){return this.raw.error;}
   get result(){const raw=this.raw.result;if(!raw)return raw;if(!wrapped.has(raw))wrapped.set(raw,new Database(raw));return wrapped.get(raw);}}
  class Factory{databases(){return fixture.databases();}open(...args){const raw=fixture.open(...args),request=new Request(raw);
   for(const name of ['success','error','blocked','upgradeneeded'])raw['on'+name]=()=>{const e=new DocumentEvent(name);nativeEvents.add(e);
    request.dispatchEvent(e);request['on'+name]?.call(request,e);};return request;}
   deleteDatabase(){assert.fail('No IDB delete may reach the fixture');}}
  const grant=String(number===1?'a':'e').repeat(64),reply=String(number===1?'b':'f').repeat(64);
  const port={postMessage(text){assert.equal(this,port);posts.push(JSON.parse(text));},
   addEventListener(name,fn){assert.equal(this,port);portEvents.set(name,fn);},
   removeEventListener(name,fn){assert.equal(this,port);if(portEvents.get(name)===fn)portEvents.delete(name);}};
  const add=(name,fn)=>{if(!pageEvents.has(name))pageEvents.set(name,new Set());pageEvents.get(name).add(fn);};
  const remove=(name,fn)=>pageEvents.get(name)?.delete(fn);
  const cryptoApi={subtle:{async digest(algorithm,bytes){
   if(armed==='capture'||armed==='hold'&&Buffer.from(bytes).toString('utf8').startsWith('{"schema":"custodial.browser-preservation-hold.v1"')){
    armed=null;delayed=true;entered.resolve();await resume.promise;
   }return webcrypto.subtle.digest(algorithm,bytes);
  }}};
  const context=vm.createContext({console,TextEncoder,TextDecoder,AbortController,EventTarget,Event:DocumentEvent,Blob,
   performance,crypto:cryptoApi,btoa:s=>Buffer.from(s,'binary').toString('base64'),
   location:{origin:'https://localhost',protocol:'https:',hostname:'localhost',host:'localhost',port:''},document:{},
   localStorage:local,sessionStorage:session,indexedDB:new Factory(),navigator:{locks:sharedLocks},
   IDBFactory:Factory,IDBDatabase:Database,IDBRequest:Request,IDBTransaction:Transaction,
   custodialOriginalBrowserPreparation:port,addEventListener:add,removeEventListener:remove,
   setTimeout(fn,ms){const handle=setTimeout(()=>{timers.delete(handle);fn();},ms);timers.add(handle);return handle;},
   clearTimeout(handle){timers.delete(handle);clearTimeout(handle);}});
  vm.runInContext('globalThis.top=globalThis;',context);
  // Model IDB's fresh structured clone into each receiving document realm.
  context.seedJson=JSON.stringify({mz_scan_queue:{version:6,stores:{actions:[{key:1,value:{id:1,schema_version:6,type:'commit_workflow',operation_id:ID,payload:originalArguments}}]}}});
  fixture=idb(vm.runInContext('JSON.parse(seedJson)',context));delete context.seedJson;
  const definitionsBefore=JSON.stringify(fixture.definitions),modules=new Map();
  for(const name of moduleNames){const url=new URL('../mobile/src/custodial/'+name,import.meta.url);
   modules.set(url.href,new vm.SourceTextModule(readFileSync(url,'utf8'),{context,identifier:url.href}));}
  const entry=modules.get(new URL('../mobile/src/custodial/native-original-browser-preparation.js',import.meta.url).href);
  await entry.link((specifier,ref)=>{const found=modules.get(new URL(specifier,ref.identifier).href);assert.ok(found,'Closed actual module graph only');return found;});
  await entry.evaluate();entry.namespace.installNativeOriginalBrowserPreparation({grantToken:grant,replyToken:reply});
  assert.equal(posts.length,1,'Actual private bootstrap must install');
  const storageModule=modules.get(new URL('../mobile/src/custodial/storage-firewall.js',import.meta.url).href);
  storageModule.namespace.installCustodialStorageFirewall({storage:local,getSecurityStatus:()=>({initialized:true,ready:false,quarantined:true})});
  const request=(command,n,changes={})=>({schema:'custodial.native-original-browser-capture-request.v1',command,grant_token:grant,
   request_nonce:(number===1?'c':'9').repeat(64),phase_nonce:n.toString(16).padStart(64,'0'),operation_id:ID,
   frame_sha256:'d'.repeat(64),original_generation_id:GEN,native_mutation_stamp:'original native stamp / exact α',...changes});
  const emit=(command,n,changes)=>portEvents.get('message')?.({data:JSON.stringify(request(command,n,changes))});
  const replies=schema=>posts.filter(p=>p.schema===schema);
  const capture=()=>replies('custodial.native-original-browser-capture-response.v1');
  const data=()=>replies('custodial.native-original-browser-data-response.v1');
  const holds=()=>replies('custodial.native-original-browser-hold-fence-response.v1');
  const hide=()=>{for(const listener of [...(pageEvents.get('pagehide')??[])])listener();};
  const admission=modules.get(new URL('../mobile/src/custodial/protected-browser-admission.js',import.meta.url).href);
  const p={context,local,session,fixture,posts,portEvents,pageEvents,timers,targets,sharedLocks,emit,capture,data,holds,hide,entered,resume,
   documentWriter:()=>admission.namespace.readDocumentProtectedBrowserWriterAdmission(),
   installAgain:()=>entry.namespace.installNativeOriginalBrowserPreparation({grantToken:grant,replyToken:reply}),
   arm(stage){armed=stage;},get delayed(){return delayed;},
   async dispose(){resume.resolve();hide();await until(()=>sharedLocks.pending===0&&timers.size===0,'Actual late capture/timers must settle');
    assert.equal(portEvents.size,0);assert.equal(pageEvents.get('pagehide')?.size??0,0);assert.equal(pageEvents.get('pageshow')?.size??0,0);
    assert.equal(fixture.state.opens,fixture.state.closes);assert.equal(fixture.state.created,0);assert.equal(JSON.stringify(fixture.definitions),definitionsBefore);
    for(const target of targets)for(const event of ['success','error','upgradeneeded','complete','abort'])assert.equal(getEventListeners(target,event).length,0);
    pageEvents.clear();}};documents.push(p);return p;
 }
 const denied=fn=>assert.throws(fn,error=>error.code==='custodial_protected_state_read_only');
 const nonAuthority=hold=>{for(const key of ['native_authority','inventory_acknowledged','work_accepted','replay_allowed','finalizer_allowed','key_removal','phone_released'])assert.equal(hold[key],false);};
 async function complete(p,command){
  p.emit(command,1);await until(()=>p.capture().length===1,'Actual initial capture reply');const captured=p.capture()[0];
  assert.equal(captured.state,'CAPTURED_RETAINED_NOT_AUTHORITY');assert.equal(captured.native_mutation_stamp,'original native stamp / exact α');
  assert.deepEqual(JSON.parse(Buffer.from(captured.arguments_base64[0],'base64').toString('utf8')),originalArguments);
  p.emit('DATA_FRAME',2);await until(()=>p.data().length===1,'Actual original value frame');const frame=p.data()[0].data_frame;
  assert.equal(p.data()[0].state,'VALUE_FRAME_RETAINED_NOT_AUTHORITY');const chunks=[];
  for(let i=0;i<frame.chunk_count;i++){p.emit('DATA_CHUNK',3+i);await until(()=>p.data().length===i+2,'Actual original value chunk');
   assert.equal(p.data()[i+1].state,'VALUE_CHUNK_RETAINED_NOT_AUTHORITY');const bytes=Buffer.from(p.data()[i+1].chunk_base64,'base64');assert.equal(hash(bytes),frame.chunk_sha256[i]);chunks.push(bytes);}
  const bytes=Buffer.concat(chunks);assert.equal(hash(bytes),frame.frame_sha256);assert.equal(bytes.length,frame.byte_count);
  p.emit('HOLD_FENCE',100);await until(()=>p.holds().length===1,'Actual durable HOLD_FENCE reply');const hold=p.holds()[0];
  assert.equal(hold.state,'SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK');nonAuthority(hold);
  assert.equal(hold.hold_marker_sha256,hash(p.local.getItem(KEY)));assert.equal(hold.mutation_epoch,p.local.getItem(EPOCH));
  return {frame,bytes,captured,hold};
 }
 let failed=false,failure;try{
  if(selected==='writer-publication-lifetime'){
   const localRows=new Map([['unknown-original','retained original \ud800']]),sessionRows=new Map([['session-original','retained session \ud801']]);
   const p=await documentFixture(localRows,sessionRows,1),key='custodialOriginalBrowserWriteAdmission';
   const writer=p.documentWriter(),publication=Object.getOwnPropertyDescriptor(p.context,key);
   assert.ok(writer&&Object.isFrozen(writer));assert.strictEqual(publication.value,writer);
   const entered=deferred(),resume=deferred();let callbacks=0;
   const pending=writer.mutate(async()=>{callbacks++;entered.resolve();await resume.promise;writer.requireMutation();return 'original async mutation returned';});
   let withdrawn,accepted;
   try{
    await entered.promise;
    withdrawn=Reflect.deleteProperty(p.context,key);
    if(withdrawn){assert.equal(Object.getOwnPropertyDescriptor(p.context,key),undefined);Object.defineProperty(p.context,key,publication);}
    resume.resolve();accepted=await pending;
   }finally{resume.resolve();await pending.catch(()=>{});}
   console.log(JSON.stringify({new_case:'writer-publication-lifetime',withdrawn_between_await_checks:withdrawn,
    same_object_restored:withdrawn&&Object.getOwnPropertyDescriptor(p.context,key)?.value===writer,
    mutation_result:accepted,callbacks,synthetic_platform_only:true,native_authority:false}));
   assert.equal(withdrawn,false,'Original publication withdrew and same-object restoration was accepted across guarded async mutation');
   assert.equal(publication.configurable,false);assert.equal(publication.writable,false);assert.equal(publication.enumerable,false);
   assert.equal(accepted,'original async mutation returned');assert.equal(callbacks,1);
   for(const replacement of [{...publication,configurable:true},{value:{}},{get:()=>writer},{writable:true}]){
    assert.equal(Reflect.defineProperty(p.context,key,replacement),false);assert.strictEqual(p.documentWriter(),writer);
   }
   const lateEntered=deferred(),lateResume=deferred();
   const late=writer.mutate(async()=>{callbacks++;lateEntered.resolve();await lateResume.promise;return 'retired callback';});
   const rejected=assert.rejects(late,/Original document writer unavailable/);
   try{await lateEntered.promise;p.hide();lateResume.resolve();await rejected;}
   finally{lateResume.resolve();await late.catch(()=>{});}
   const postCount=p.posts.length;p.installAgain();
   for(const listener of [...(p.pageEvents.get('pageshow')??[])])listener();
   assert.equal(p.posts.length,postCount,'Same Document cannot rearm after pagehide');
   await assert.rejects(async()=>writer.mutate(()=>callbacks++),/Original document writer unavailable/);
   assert.throws(()=>writer.requireAdmission(),/Original document writer unavailable/);
   assert.throws(()=>writer.requireMutation(),/Original document writer unavailable/);
   assert.equal(callbacks,2);assert.strictEqual(Object.getOwnPropertyDescriptor(p.context,key).value,writer);
   assert.equal(localRows.get('unknown-original'),'retained original \ud800');assert.equal(sessionRows.get('session-original'),'retained session \ud801');
   assert.equal(localRows.has(KEY),false,'No capture/hold synthesized by writer checks');
   await p.dispose();observed.push({case:selected,status:'PASS_NEW_GUARDED_MUTATION_PUBLICATION_LIFETIME',callbacks,
    delete_or_retarget:false,pagehide_retired:true,same_document_rearmed:false,original_values_retained:true,authority:false});
  }else for(const stage of ['capture-await','held-fence-await']){
   const localRows=new Map([['mz_chatscope_group_pending:fixture','{ original saved UNKNOWN \ud800 }'],['unknown-original','raw α bytes']]);
   const sessionRows=new Map([['session-original','saved session \ud801']]);
   const savedLocal=JSON.stringify([...localRows]),savedSession=JSON.stringify([...sessionRows]);
   const first=await documentFixture(localRows,sessionRows,1);let before=null;
   if(stage==='held-fence-await')before=await complete(first,'CAPTURE');
   first.arm(stage==='capture-await'?'capture':'hold');first.emit(stage==='capture-await'?'CAPTURE':'HOLD_FENCE',stage==='capture-await'?1:101);
   await until(()=>first.delayed,'Actual original digest must enter the selected await');assert.ok(localRows.get(KEY));assert.equal(localRows.get(EPOCH),'1');
   const heldLocal=JSON.stringify([...localRows]),postCount=first.posts.length;
   first.hide();first.resume.resolve();await first.dispose();
   assert.equal(first.posts.length,postCount,'Retired original callback must not post a delayed success or refusal');
   assert.equal(JSON.stringify([...localRows]),heldLocal);assert.equal(JSON.stringify([...sessionRows]),savedSession);
   const next=await documentFixture(localRows,sessionRows,2),countBefore=next.posts.length;
   next.emit('CAPTURE_EXISTING_HELD',1,{grant_token:'a'.repeat(64)});await turn();assert.equal(next.posts.length,countBefore,'Old document token must not dispatch');
   const recovered=await complete(next,'CAPTURE_EXISTING_HELD');
   assert.equal(JSON.stringify([...localRows]),heldLocal,'Read-only reload must not rewrite original hold, epoch or values');
   assert.equal(JSON.stringify([...sessionRows]),savedSession);
   assert.equal(JSON.stringify([...localRows].filter(([key])=>key!==KEY&&key!==EPOCH)),savedLocal);
   denied(()=>next.context.localStorage.setItem('unknown-original','replacement'));
   denied(()=>next.context.sessionStorage.removeItem('session-original'));
   assert.equal(recovered.hold.mutation_epoch,'1');
   if(before){assert.deepEqual(recovered.frame,before.frame);assert.ok(recovered.bytes.equals(before.bytes));
    assert.equal(recovered.hold.hold_marker_sha256,before.hold.hold_marker_sha256);assert.deepEqual(recovered.captured.census,before.captured.census);}
   await next.dispose();observed.push({case:stage,status:'PASS_NEW_ORIGINAL_HELD_RELOAD_JOIN',post_hide_late_dispatches:0,
    original_values_unchanged:true,existing_hold_epoch_rewritten:false,original_frame_compared:!!before,authority:false});
  }
 }catch(error){failed=true;failure=error;}
 finally{const cleanup=[];for(const p of documents.toReversed())try{await p.dispose();}catch(error){cleanup.push(error);}
  process.off('unhandledRejection',onUnhandled);if(cleanup.length)throw new AggregateError(failed?[failure,...cleanup]:cleanup,'Original browser join/cleanup failed',{cause:failed?failure:cleanup[0]});}
 if(failed)throw failure;assert.equal(unhandled.length,0);
 console.log(JSON.stringify({scope:'Actual unchanged ESM graph with existing synthetic IDB fixture; isolated VM document lifecycle/Storage/Web Locks/private port only',
  disposition:selected==='writer-publication-lifetime'?'NEW_PUBLICATION_LIFETIME_SOURCE_CHECK':'NO_PRODUCT_DEFECT_REPRODUCED',cases:observed,documents:documents.length,old_groups:0,unhandled:0,message_listeners:0,timers:0,idb_handles:0,
  native_manager_WebView_ACK_or_finalizer_proof:false,resources0:true}));
}

async function storageFirewallMultiAreaCase(){
 const {installCustodialStorageFirewall,createRawStorageAdapter}=await import('../mobile/src/custodial/storage-firewall.js');
 const {PROTECTED_BROWSER_HOLD_KEY}=await import('../mobile/src/custodial/protected-browser-admission.js');
 class Storage{
  constructor(){this.data=new Map();}
  get length(){return this.data.size;}
  key(index){return [...this.data.keys()][index]??null;}
  getItem(key){return this.data.get(String(key))??null;}
  setItem(key,value){this.data.set(String(key),String(value));}
  removeItem(key){this.data.delete(String(key));}
  clear(){this.data.clear();}
 }
 const local=new Storage(),session=new Storage(),rawLocal=createRawStorageAdapter(local),rawSession=createRawStorageAdapter(session);
 const protectedRow='mz_chatscope_group_pending:original';
 rawSession.setItem(protectedRow,'original-pending-row');
 globalThis.localStorage=local;globalThis.sessionStorage=session;
 let primaryCalls=0,secondaryCalls=0;
 const first=installCustodialStorageFirewall({storage:local,getSecurityStatus:()=>{primaryCalls++;return {initialized:true,ready:true};}});
 assert.equal(first.blocked(),false);
 rawLocal.setItem(PROTECTED_BROWSER_HOLD_KEY,'held');
 assert.throws(()=>session.setItem(protectedRow,'replacement'),error=>error?.code==='custodial_protected_state_read_only',
  'First local installation must already guard the actual session area');
 const second=installCustodialStorageFirewall({storage:session,getSecurityStatus:()=>{secondaryCalls++;return {initialized:true,ready:true};}});
 assert.equal(first,second,'One primary hold authority governs both actual Storage areas');
 assert.equal(rawSession.getItem(protectedRow),'original-pending-row');
 assert.equal(first.blocked(),true);
 const denied=fn=>assert.throws(fn,error=>error?.code==='custodial_protected_state_read_only');
 denied(()=>session.setItem(protectedRow,'replacement'));
 denied(()=>Storage.prototype.setItem.call(session,protectedRow,'replacement'));
 denied(()=>session.removeItem(protectedRow));
 denied(()=>session.clear());
 denied(()=>globalThis.sessionStorage[protectedRow]='replacement');
 denied(()=>{delete globalThis.sessionStorage[protectedRow];});
 denied(()=>Object.defineProperty(globalThis.sessionStorage,protectedRow,{value:'replacement',configurable:true}));
 denied(()=>globalThis.sessionStorage.setItem('mz_chatscope_group_pending:new','new'));
 denied(()=>globalThis.sessionStorage.setItem('mz_messenger_user_id','other'));
 assert.equal(rawSession.getItem(protectedRow),'original-pending-row');
 assert.equal(rawLocal.getItem(PROTECTED_BROWSER_HOLD_KEY),'held');
 rawLocal.removeItem(PROTECTED_BROWSER_HOLD_KEY);
 denied(()=>session.setItem(protectedRow,'replacement-after-hold-disappeared'));
 globalThis.sessionStorage.setItem('mz_page_navigation','allowed');
 globalThis.localStorage.setItem('mz_wake_cache','allowed');
 globalThis.sessionStorage.mz_unprotected_cache='allowed';
 assert.equal(rawSession.getItem('mz_page_navigation'),'allowed');
 assert.equal(rawLocal.getItem('mz_wake_cache'),'allowed');
 assert.equal(globalThis.sessionStorage.mz_unprotected_cache,'allowed');
 assert.equal(secondaryCalls,0,'Second installer must not replace the original security callback');
 assert.ok(primaryCalls>0);
 console.log(JSON.stringify({scope:'same-realm local and session Storage hold; original pending row preserved; nonprotected cache still writable',status:'PASS_FOCUSED_SOURCE_FIXTURE'}));
}

async function completionRetireBridgeCase(name){
 if(name==='worker-generation'){
  const worker=readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
  const start=worker.indexOf('  async function runWorker('),end=worker.indexOf('  async function reconcileStartupRecovery(',start);
  assert.ok(start>=0&&end>start);let claims=0,received;
  const row={id:1,type:'commit_workflow',security_generation:19,payload:{p_device_id:'KIOSK_08',p_client_session_id:'original-session'}};
  const context={state:{db:{},deviceId:'KIOSK_08'},navigator:{onLine:true},
   window:{MemphisMobile:{retireAuthenticatedCompletion:async request=>{received=request;return {retired:true};}}},
   securityPause:async()=>null,dispatchSecurityPause:()=>{},custodialSecurity:()=>null,
   recoverOrphanedClaims:async()=>0,claimNextAction:async()=>claims++===0?row:null,
   verifyWorkerBackendCompatibility:async()=>true,processAction:async()=>({status:'closed'}),finishClaim:async()=>true,
   withQueueLock:fn=>fn(),dispatchStatus:()=>{},listActions:async()=>[],hasUnresolvedReconciliationWork:()=>false,
   reportDeviceSyncStatus:async()=>{},nextClaimableAction:()=>null,scheduleSync:()=>{},now:()=>0,
   safeText:x=>String(x??'').trim(),securityErrorIsPause:()=>false,isAutomaticOutageRetry:()=>false};
  vm.createContext(context);vm.runInContext(worker.slice(start,end),context);await context.runWorker();
  assert.equal(received.expectedGeneration,19,'Original settled claim generation must reach local retirement');
  assert.equal(received.completionPayload,row.payload);console.log(JSON.stringify({case:name,status:'PASS_RETIRE_SOURCE',limits:'Actual worker invocation; synthetic queue and native boundary.'}));return;
 }
 const {webcrypto}=await import('node:crypto');
 const {getCustodialBridgeSecurityRuntime}=await import('../mobile/src/custodial/security-runtime.js');
 const {createRawStorageAdapter}=await import('../mobile/src/custodial/storage-firewall.js');
 const keys=await import('../mobile/src/custodial/credential-store.js');
 const {principalIdentity,protectedPrincipal}=await import('../mobile/src/custodial/protected-principal.js');
 const id=n=>'ce000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const p={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
  credential_operation_id:id(3),assignment_epoch:7,installation_seal:'SYNTHETIC_RETIRE_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
 class Storage{constructor(){this.data=new Map();}get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}
  getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}clear(){this.data.clear();}}
 const storage=new Storage(),raw=createRawStorageAdapter(storage),secure=new Map();
 for(const k of keys.CUSTODIAL_DEVICE_KEYS)raw.setItem(k,p.device_id);raw.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,p.installation_seal);
 secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify({schema_version:1,credential:'SYNTHETIC_NOT_REAL',
  device_id:p.device_id,installation_seal:p.installation_seal,enrolled_at:p.enrolled_at,principal:p}));
 let lockOwned=false,releaseLock,lockEntered;
 const locks={async request(label,options,callback){
  if(name==='lock-withdrawal'){lockEntered?.();await new Promise(resolve=>{releaseLock=resolve;});}
  assert.equal(lockOwned,false);lockOwned=true;try{return await callback({name:label,mode:options.mode});}finally{lockOwned=false;}}};
 const runtime=getCustodialBridgeSecurityRuntime({storage,locks,cryptoApi:webcrypto,indexedDb:{databases:async()=>[]},
  secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
 await runtime.security.ready;const store=runtime.credentialStore,security=runtime.security,generation=store.getGeneration();
 let releaseReady,releaseNative,native=true,calls=0,effectOwned=false,transitionFinished=false,transition;
 const payload={p_device_id:p.device_id,p_client_session_id:id(4),p_client_completion_id:id(5),
  p_native_finish_scan_entry_id:id(6),p_native_completion_attestation_version:'custodial-native-completion.v2',
  p_native_completion_attestation:'a'.repeat(64),p_client_started_at:'2026-01-01T10:00:00.000Z',
  p_client_ended_at:'2026-01-01T10:15:00.000Z',p_response_json:{work_result:'checked_no_cleaning_needed',services_performed:[]}};
 const frozen=JSON.stringify(payload),requests=[];
 const context={JSON,Number,Object,bridgeReady:new Promise(resolve=>{releaseReady=resolve;}),security,
  currentPrincipalIdentity:()=>principalIdentity(protectedPrincipal(store.getStatus().principal)),deviceId:()=>store.getStatus().deviceId,
  securityError:code=>Object.assign(new Error(code),{code}),
  async retireNativeAuthenticatedCompletion(request){
   calls++;effectOwned=lockOwned;requests.push(request);
   if(name==='occurrence-present')throw Error('custodial_native_server_receipt_required: original native occurrence still exists');
   if(name==='fifo-transition')transition=store.ensureSecurityState().then(()=>{transitionFinished=true;});
   return new Promise(resolve=>{releaseNative=()=>resolve(name==='native-false'?{retired:false}:{retired:true});});}};
 Object.defineProperty(context,'nativeVault',{get:()=>native});vm.createContext(context);
 const method=source.match(/  async function retireAuthenticatedCompletion\([^]*?\n  \}/)?.[0];assert.ok(method);vm.runInContext(method,context);
 if(name==='expected-mismatch'){
  const work=context.retireAuthenticatedCompletion({deviceId:p.device_id,completionPayload:payload,expectedGeneration:generation-1});work.catch(()=>{});
  releaseReady();await new Promise(resolve=>setImmediate(resolve));releaseNative?.();
  await assert.rejects(work,/generation_changed/);assert.equal(calls,0);
 }else{
  if(name==='no-native')native=false;
  let entered;if(name==='lock-withdrawal')entered=new Promise(resolve=>{lockEntered=resolve;});
  const work=context.retireAuthenticatedCompletion({deviceId:p.device_id,completionPayload:payload,expectedGeneration:generation});work.catch(()=>{});
  if(name==='before-ready-generation')await store.ensureSecurityState();
  if(name==='before-ready-owner'){
   const record=JSON.parse(secure.get(keys.CUSTODIAL_INSTALLATION_RECORD_KEY));
   record.principal={...p,employee_id:id(20),credential_id:id(21),credential_operation_id:id(22),assignment_epoch:8};
   secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify(record));await store.ensureSecurityState();
   assert.equal(store.getStatus().principal.employee_id,id(20));
  }
  if(name==='before-ready-payload')payload.p_response_json.work_result='changed';
  releaseReady();await new Promise(resolve=>setImmediate(resolve));
  if(['before-ready-generation','before-ready-owner','before-ready-payload','no-native'].includes(name)){
   releaseNative?.();
   await assert.rejects(work,/generation_changed|vault_required/);assert.equal(calls,0);
  }else if(name==='lock-withdrawal'){
   if(calls)throw Error('Native retirement escaped protected local mutation lock');
   await entered;for(const k of keys.CUSTODIAL_DEVICE_KEYS)raw.setItem(k,'KIOSK_09');releaseLock();
   await assert.rejects(work,error=>['custodial_security_state_unavailable','custodial_security_generation_changed'].includes(error.code));assert.equal(calls,0);
  }else if(name==='occurrence-present'){
   await assert.rejects(work,/original native occurrence still exists/);assert.equal(calls,1);
  }else{
   assert.equal(calls,1);assert.equal(typeof releaseNative,'function');
   if(name==='native-payload')payload.p_response_json.work_result='changed';
   if(name==='fifo-transition')assert.equal(transitionFinished,false,'Normal credential transition waits for local effect to finish');
   releaseNative();
   if(name==='native-payload')await assert.rejects(work,/generation_changed/);
   else if(name==='fifo-transition')await assert.rejects(work,{code:'custodial_security_generation_changed'});
   else if(name==='native-false')await assert.rejects(work,/server_receipt_required/);
   else {const value=await work;assert.equal(value.retired,true);assert.equal(effectOwned,true);}
   if(transition)await transition;
   assert.equal(JSON.stringify(requests[0].completionPayload),frozen,'Native effect receives original private frozen args');
   assert.notEqual(requests[0].completionPayload,payload);
  }
 }
 console.log(JSON.stringify({case:name,status:'PASS_RETIRE_SOURCE',calls,effectOwned,
  limits:'Actual bridge retirement + real private principal/credential FIFO/protected-work runtime; synthetic storage/shared-lock/native callback. No SDK/phone/native atomic effect proof; post-dispatch rejection is not rollback.'}));
}

async function completionBridgeCase(name){
 if(name.startsWith('read-'))return completionFixedReadBridgeCase(name);
 const method=source.match(/  async function getAuthenticatedCompletion\([^]*?\n  \}/)?.[0];assert.ok(method);
 let generation=7,owner='original-owner',device='KIOSK_08',calls=0,stableCalls=0,native=true;
 let releaseReady,releaseNative,releaseStable;
 const payload={p_device_id:'KIOSK_08',p_client_session_id:'original-session',p_response_json:{work_result:'cleaned'}};
 const context={JSON,Number,Object,bridgeReady:new Promise(resolve=>{releaseReady=resolve;}),
  securityError:code=>Error(code),currentPrincipalIdentity:()=>owner,deviceId:()=>device,
  security:{getStatus:()=>({generation}),async waitForStableState(options){stableCalls++;
   assert.equal(options.requireEnrollment,true);assert.equal(options.expectedGeneration,7);
   if(name==='stable-withdrawal'&&stableCalls===2)await new Promise(resolve=>{releaseStable=resolve;});}},
  async getNativeAuthenticatedCompletion(request){calls++;assert.equal(request.deviceId,'KIOSK_08');
   assert.equal(JSON.stringify(request.completionPayload),JSON.stringify(payload));
   assert.notEqual(request.completionPayload,payload);
   return new Promise(resolve=>{releaseNative=()=>resolve({found:true,result:{status:'closed',original_receipt:true}});});}};
 Object.defineProperty(context,'nativeVault',{get:()=>native});vm.createContext(context);vm.runInContext(method,context);
 if(name==='expected-mismatch'){
  await assert.rejects(context.getAuthenticatedCompletion({deviceId:device,completionPayload:payload,expectedGeneration:6}),/generation_changed/);assert.equal(calls,0);return;
 }
 if(name==='no-native')native=false;
 const work=context.getAuthenticatedCompletion({deviceId:device,completionPayload:payload,expectedGeneration:7});
 work.catch(()=>{}); // The asserted rejection may precede fixture release.
 if(name==='before-ready-ABA'){generation=8;owner='replacement';generation=9;owner='original-owner';}
 releaseReady();await new Promise(resolve=>setImmediate(resolve));
 if(name==='before-ready-ABA'){await assert.rejects(work,/generation_changed/);assert.equal(calls,0);return;}
 if(name==='no-native'){assert.equal((await work).found,false);assert.equal(calls,0);return;}
 assert.equal(calls,1);
 if(name==='native-ABA'){owner='replacement';generation=8;owner='original-owner';generation=9;}
 if(name==='native-device')device='KIOSK_09';
 if(name==='native-payload')payload.p_response_json.work_result='changed';
 releaseNative();
 if(name==='stable-withdrawal'){
  await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof releaseStable,'function');generation=8;releaseStable();
 }
 if(name==='exact'){const result=await work;assert.equal(result.found,true);assert.equal(result.result.original_receipt,true);assert.equal(stableCalls,2);}
 else await assert.rejects(work,/generation_changed/);
 console.log(JSON.stringify({scope:'current owning completion bridge method; synthetic native callback, NOT current SQL/native SDK',case:name,calls,stableCalls}));
}

async function completionFixedReadBridgeCase(name){
 const method=source.match(/  async function getAuthenticatedCompletion\([^]*?\n  \}/)?.[0];assert.ok(method);
 const envelope=source.match(/  async function requestEnvelope\([^]*?\n  \}/)?.[0];assert.ok(envelope);
 let generation=7,owner='original-owner',device='KIOSK_08',nativeCalls=0,stableCalls=0,httpCalls=0;
 let releaseHttp,releaseFinal,mutations=0;
 const payload={p_device_id:device,p_client_session_id:'original-session',p_client_completion_id:'original-completion',
  p_response_json:{work_result:'cleaned',services_performed:['floor']}};
 const encoded=JSON.stringify(payload),receipt={status:'closed',native_original_receipt:true};
 const requests=[];
 const context={JSON,Number,Object,Headers,FormData,Blob,API:'https://synthetic.invalid',nativeVault:true,bridgeReady:Promise.resolve(),
  currentPrincipalIdentity:()=>owner,deviceId:()=>device,securityError:code=>Error(code),responseError:()=>Error('synthetic unavailable'),
  security:{getStatus:()=>({generation}),async waitForStableState(options){stableCalls++;
   assert.equal(options.expectedGeneration,7);assert.equal(options.requireEnrollment,true);
   if(name==='read-final-stable-ABA'&&nativeCalls===2||name==='read-before-reread-ABA'&&stableCalls===3)
    await new Promise(resolve=>{releaseFinal=resolve;});},
   mutateProtectedWork(){mutations++;throw Error('HTTP must not enter protected mutation');}},
  async getNativeAuthenticatedCompletion(request){nativeCalls++;
   assert.equal(request.deviceId,'KIOSK_08');assert.equal(JSON.stringify(request.completionPayload),encoded);
   assert.notEqual(request.completionPayload,payload);
   if(name==='read-original-immutable'){
    assert.equal(Object.isFrozen(request.completionPayload),true);assert.equal(Object.isFrozen(request.completionPayload.p_response_json),true);
    assert.throws(()=>{request.completionPayload.p_response_json.work_result='edited';},TypeError);
   }
   if(nativeCalls===1)return name==='read-cache-hit'?{found:true,result:receipt}:
    {found:false,...(name==='read-no-capability'?{}:{fixed_read_capture_protocol:name==='read-false-capability'?false:
     name==='read-malformed-capability'?'true':name==='read-boolean-capability'?true:
     name==='read-wrong-protocol'?'native-server-completion-fixed-read.v2':'native-server-completion-fixed-read.v1'})};
   assert.equal(httpCalls,1);
   if(name==='read-reread-malformed')return {found:'true',result:receipt};
   if(name==='read-reread-unknown')throw Error('synthetic native original unknown');
   if(name==='read-no-native-receipt')return {found:false};
   if(name==='read-reread-ABA'){generation=8;owner='replacement';generation=9;owner='original-owner';}
   return {found:true,result:receipt};
  },
  async bridgeFetch(url,options,bounds){httpCalls++;requests.push({url,options,bounds});
   assert.equal(url,'https://synthetic.invalid/scan-api/original-completion');assert.equal(options.method,'POST');
   assert.equal(options.cache,'no-store');assert.equal(options.headers.get('Content-Type'),'application/json');
   assert.equal(options.body,JSON.stringify({completion_payload:JSON.parse(encoded)}));assert.equal(bounds.expectedGeneration,7);
   assert.equal(mutations,0);assert.equal(nativeCalls,1);
   if(name==='read-network-unknown')throw Error('synthetic unavailable');
   if(['read-HTTP-ABA','read-HTTP-payload','read-HTTP-device'].includes(name))await new Promise(resolve=>{releaseHttp=resolve;});
   return {ok:true,json:async()=>({ok:true,data:{found:true,result:{status:'closed',HTTP_IS_NOT_ACCEPTANCE:true}}})};
  }};
 vm.createContext(context);vm.runInContext(envelope+'\n'+method,context);
 const work=context.getAuthenticatedCompletion({deviceId:device,completionPayload:payload,
  ...(name==='read-no-original-generation'?{}:{expectedGeneration:7})});work.catch(()=>{});
 await new Promise(resolve=>setImmediate(resolve));
 if(['read-HTTP-ABA','read-HTTP-payload','read-HTTP-device'].includes(name)){
  assert.equal(typeof releaseHttp,'function');
  if(name==='read-HTTP-ABA'){generation=8;owner='other';generation=9;owner='original-owner';}
  if(name==='read-HTTP-payload')payload.p_response_json.work_result='changed';
  if(name==='read-HTTP-device')device='KIOSK_09';
  releaseHttp();await assert.rejects(work,/generation_changed/);assert.equal(nativeCalls,1);
 }else if(['read-final-stable-ABA','read-before-reread-ABA'].includes(name)){
  assert.equal(typeof releaseFinal,'function');generation=9;releaseFinal();await assert.rejects(work,/generation_changed/);
  assert.equal(nativeCalls,name==='read-before-reread-ABA'?1:2);
 }else if(name==='read-reread-ABA'){
  await assert.rejects(work,/generation_changed/);assert.equal(nativeCalls,2);assert.equal(httpCalls,1);
 }else if(name==='read-network-unknown'){
  await assert.rejects(work,/synthetic unavailable/);assert.equal(nativeCalls,1);assert.equal(httpCalls,1);
 }else if(name==='read-reread-unknown'){
  await assert.rejects(work,/native original unknown/);assert.equal(nativeCalls,2);assert.equal(httpCalls,1);
 }else if(name==='read-reread-malformed'){
  await assert.rejects(work,/server_receipt_required/);assert.equal(nativeCalls,2);assert.equal(httpCalls,1);
 }
 else{
  const result=await work;
  if(['read-no-capability','read-false-capability','read-malformed-capability','read-boolean-capability','read-wrong-protocol','read-cache-hit','read-no-original-generation'].includes(name)){
   assert.equal(httpCalls,0);assert.equal(nativeCalls,1);assert.equal(result.found,name==='read-cache-hit');
  }else{
   assert.equal(httpCalls,1,'cache miss requires one fixed original READ when native capture capability is present');
   assert.equal(nativeCalls,2,'HTTP data cannot replace the owning native journal reread');
   assert.equal(result.found,name!=='read-no-native-receipt');
   if(result.found){assert.equal(result.result.native_original_receipt,true);assert.equal(result.result.HTTP_IS_NOT_ACCEPTANCE,undefined);}
  }
 }
 assert.equal(mutations,0);
 console.log(JSON.stringify({case:name,status:'PASS_FIXED_READ_SOURCE',nativeCalls,httpCalls,stableCalls,
  limits:'Actual owning getter and requestEnvelope; synthetic native capture capability, native receipt and authorized transport boundary. No real native capture/SQL/auth/phone proof. Capability mount remains Main-owned.'}));
}

async function eventOpenBridgeCase(name){
 const {webcrypto}=await import('node:crypto');
 const events=await import('../mobile/src/custodial/event-notification-receipts.js');
 const receipts=await import('../mobile/src/custodial/notification-receipts.js');
 const principal=await import('../mobile/src/custodial/protected-principal.js');
 const policy=await import('../mobile/src/custodial/transport-policy.js');
 const release=await import('../mobile/src/custodial/release-scope.js');
 const {getCustodialBridgeSecurityRuntime}=await import('../mobile/src/custodial/security-runtime.js');
 const {createRawStorageAdapter}=await import('../mobile/src/custodial/storage-firewall.js');
 const keys=await import('../mobile/src/custodial/credential-store.js');
 const id=n=>'be000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const p={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
  credential_operation_id:id(3),assignment_epoch:7,installation_seal:'SYNTHETIC_INSTALLATION_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
 const prefix='mz_native_notification_outbox:event-open.v1:';
 let writes=0,lockOwned=false,admitted=!['current-disabled','disabled-successor-action'].includes(name),paused=false,releaseLock,enteredLock;
 class Storage{
  constructor(){this.data=new Map();}get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}
  getItem(k){return this.data.get(k)??null;}setItem(k,v){if(k.startsWith(prefix))writes++;
   if(name==='unknown-fence-write-failure'&&k.startsWith(prefix)&&String(v).includes('"phase":"DISPATCH_UNKNOWN"'))return;
   this.data.set(k,String(v));}
  removeItem(k){if(k.startsWith(prefix))writes++;this.data.delete(k);}clear(){this.data.clear();}
 }
 const storage=new Storage(),raw=createRawStorageAdapter(storage),secure=new Map();
 const record=principal=>({schema_version:1,credential:'SYNTHETIC_NOT_A_DEVICE_CREDENTIAL',device_id:p.device_id,
  installation_seal:p.installation_seal,enrolled_at:p.enrolled_at,principal});
 for(const k of keys.CUSTODIAL_DEVICE_KEYS)raw.setItem(k,p.device_id);
 raw.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,p.installation_seal);
 secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify(record(p)));
 const locks={async request(name,options,callback){
  if(paused){enteredLock?.();await new Promise(r=>{releaseLock=r;});}
  assert.equal(lockOwned,false);lockOwned=true;try{return await callback({name,mode:options.mode});}finally{lockOwned=false;}
 }};
 const runtime=getCustodialBridgeSecurityRuntime({storage,locks,cryptoApi:webcrypto,indexedDb:{databases:async()=>[]},
  secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
 await runtime.security.ready;
 const store=runtime.credentialStore,security=runtime.security;
 const binding={instance_id:id(4),notification_key:'synthetic-event-original',event_id:id(5),notification_kind:'three_days_before',
  credential_id:p.credential_id,employee_id:p.employee_id,device_id:id(6),device_identifier:p.device_id,assignment_epoch:p.assignment_epoch};
 const row={...binding,scheduled_for:'2026-01-01T09:00:00.000000+00:00',state:'sent',sent_at:'2026-01-01T09:00:01.000000+00:00',
  opened_at:null,event_revision:2,event_validity:'CURRENT'};
 const typed={schema:'custodial.employee-event-open-receipt.v1',...binding,state:'opened',opened_at:'2026-01-01T09:00:02.123456+00:00'};
 const opened={...row,state:'opened',opened_at:typed.opened_at,open_receipt:typed};
 const eventRows=()=>[...storage.data].filter(([key])=>key.startsWith(prefix));
 const legacy=[['mz_native_notification_outbox:legacy-v1',JSON.stringify({schema_version:'native-notification-outbox.v1',device_id:p.device_id,kind:'employee_event',notification_key:binding.notification_key})],
  ['mz_native_notification_outbox:legacy-v2',JSON.stringify({schema_version:'native-notification-outbox.v2',device_id:p.device_id,kind:'employee_event',notification_key:binding.notification_key})]];
 for(const [key,value] of legacy)raw.setItem(key,value);
 const captureDomain=events.createEventNotificationOpenOutbox({storage,mutate:security.mutateProtectedWork,
  getPrincipal:()=>store.getStatus().principal,getGeneration:()=>store.getGeneration()});
 const seed=async()=>{const read=await captureDomain.beginCurrentEventsRead();assert.ok(read);
  assert.equal(captureDomain.acceptCurrentEventsRead(read.token,[row]),true);
  const original=await captureDomain.prepareOpen(binding.notification_key);assert.ok(original);
  assert.ok(await captureDomain.beginOpenDispatch(original));return original;};
 if(['current-disabled','startup-readback','startup-absent','startup-withheld','incapable-readback','reinspected-original-readback'].includes(name))await seed();
 if(name==='reinspected-original-readback'){
  await store.ensureSecurityState();assert.equal(store.getStatus().quarantined,false);
  assert.equal(store.getStatus().preservedCounts.additional_protected_work,3);assert.equal(eventRows().length,1);
 }
 writes=0;
 const delayed=['generation-source','principal-source','generation-post','principal-post','pagehide-source','pagehide-post','card-source','gate-source'];
 let networkRelease,delayPhase=name==='concurrent-double-tap'?'GET':delayed.includes(name)?(name.endsWith('-source')?'GET':'POST'):null,lateResponse;
 let responseRows=[row],postData=typed,offline=false;
 if(['startup-readback','incapable-readback','already-opened','reinspected-original-readback'].includes(name))responseRows=[opened];
 if(['missing-source','startup-absent'].includes(name))responseRows=[];
 if(name==='foreign-source')responseRows=[{...row,employee_id:id(99)}];
 if(name==='wrong-key')responseRows=[{...row,notification_key:'foreign-key'}];
 if(name==='duplicate-source')responseRows=[row,row];
 if(name==='withheld-source'||name==='startup-withheld')responseRows=[{...row,event_validity:'WITHHELD'}];
 if(name==='unknown-source')responseRows=[{...row,event_validity:'UNKNOWN'}];
 if(name==='bare-opened')postData={opened:true};
 if(name==='wrong-receipt')postData={...typed,employee_id:id(99)};
 if(name==='provider-accepted')postData={provider_accepted:true};
 if(name==='offline-source')offline=true;
 const sent=[],navigated=[],listeners=new Map();
 const response=data=>new Response(JSON.stringify({ok:true,data,meta:{synthetic:true}}),{status:200});
 const nativeFetch=({init,resolvedUrl,deviceId})=>{
  assert.equal(lockOwned,false,'No protected browser mutation lock is held over native transport completion; actual credential FIFO dispatch executes below');
  const method=init.method||'GET';
  sent.push({method,path:resolvedUrl.pathname,query:resolvedUrl.searchParams.get('notification_key'),body:init.body,
   key:new Headers(init.headers).get('Idempotency-Key'),deviceId});
  if(offline||(name==='offline-post'&&method==='POST'))return Promise.reject(Object.assign(Error('Synthetic unavailable'),{name:'TypeError'}));
  const result=response(method==='GET'?responseRows:postData);
  if(['pagehide-cleanup','gate-cleanup'].includes(name)&&method==='POST')paused=true;
  if(name==='concurrent-double-tap'&&method==='POST')responseRows=[opened];
  if(method===delayPhase){delayPhase=null;lateResponse=result;return new Promise(resolve=>{networkRelease=()=>resolve(lateResponse);});}
  return Promise.resolve(result);
 };
 const listen=(target,type,callback)=>{const key=target+':'+type;if(!listeners.has(key))listeners.set(key,[]);listeners.get(key).push(callback);};
 const fire=(target,type,arg={})=>{for(const fn of listeners.get(target+':'+type)||[])fn(arg);};
 const slice=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
 const install=slice('  async function installNotificationRouting()','  const feedbackOutbox=');
 // Test-only terminal exposure of actual closures; no body/guard is replaced.
 const end=install.lastIndexOf('  }');assert.ok(end>0);
 const program=slice('  function target(','  function safeEnrollmentTerminalMessage(')
  +slice('  function currentPrincipal(','  function homeCacheKey(')
  +slice('  async function requireRecoveryForRejectedCredential(','  function publicUnauthenticatedRoute(')
  +slice('  function publicUnauthenticatedRoute(','  async function confirmPendingEnrollment(')
  +slice('  function safeNativeRoute(','  function routeProtectedRecovery(')
  +install.slice(0,end)+'    return {handleAction,flushEventOpenOutbox};\n'+install.slice(end);
 const context={...events,...receipts,...principal,...policy,...release,
  custodialNotificationEnabled:data=>admitted&&data?.kind==='employee_event'?true:release.custodialNotificationEnabled(data),
  API:'https://memphis-zoo-mcp.onrender.com',API_ORIGIN:'https://memphis-zoo-mcp.onrender.com',
  NATIVE_NOTIFICATION_OUTBOX_PREFIX:'mz_native_notification_outbox:',credentialStore:store,security,localStorage:storage,
  nativeVault:true,browserTestBuild:false,browserCredentialTransport:null,nativeCustodialAuthorizedFetch:nativeFetch,
  rawFetch:()=>{throw Error('Unexpected raw transport');},confirmPendingEnrollment:()=>{throw Error('Unrelated enrollment excluded');},
  deviceId:()=>store.getStatus().deviceId,
  location:{href:'https://synthetic.invalid/employee-hub.html',origin:'https://synthetic.invalid',assign:value=>navigated.push(value)},
  notificationFallback:null,notificationPresenter:null,createNotificationPresenter:()=>({restore:async()=>{},retry:async()=>{},registerBrowser:()=>{}}),
  notificationPresentation:{snapshot:()=>({capable:name!=='incapable-readback'}),update:()=>{},native:false},
  scheduleNotificationAuthority:{securityChanged:()=>{},isStorageKey:()=>false,isCurrent:()=>false},
  nativeNotificationScheduler:{ownsAction:()=>false},reconcileScheduleNotifications:async()=>{},ensurePushRegistration:async()=>{},
  presentForegroundNotification:()=>{throw Error('Unrelated display not exercised by event action source checks');},
  LocalNotifications:{registerActionTypes:async()=>{},addListener:async(type,fn)=>listen('local',type,fn)},
  FirebaseMessaging:{addListener:async(type,fn)=>listen('firebase',type,fn)},
  App:{addListener:async(type,fn)=>listen('app',type,fn)},Network:{addListener:async(type,fn)=>listen('network',type,fn)},
  window:{addEventListener:(type,fn)=>listen('window',type,fn)},document:{hidden:false,addEventListener:(type,fn)=>listen('document',type,fn)},
  URL,Request,Headers,Response,FormData,Blob,JSON,Promise,AbortSignal,TextEncoder};
 vm.createContext(context);vm.runInContext(program,context);
 const api=await context.installNotificationRouting();
 const tick=()=>new Promise(r=>setImmediate(r));
 const settled=async()=>{for(let i=0;i<8;i++)await tick();};
 await api.flushEventOpenOutbox();await settled();
 const card={kind:'employee_event',notification_key:binding.notification_key,route:'employee-events.html'};
 const tap=()=>api.handleAction({data:card},'tap');
 const posts=()=>sent.filter(item=>item.method==='POST');
 const assertHistory=()=>{for(const [key,value] of legacy)assert.equal(storage.data.get(key),value);};
 if(name==='disabled-successor-action'){
  secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify(record({...p,employee_id:id(90),credential_id:id(91),assignment_epoch:8})));
  await store.ensureSecurityState();assert.equal(store.getStatus().principal.employee_id,id(90));
  assert.equal(await tap(),false);fire('window','online');fire('app','resume');await api.flushEventOpenOutbox();await settled();
  assert.equal(sent.length,0);assert.equal(writes,0);assert.equal(navigated.length,0);assert.equal(eventRows().length,0);
 }else if(name==='concurrent-double-tap'){
  const first=tap(),second=tap();for(let i=0;i<30&&!networkRelease;i++)await tick();assert.equal(typeof networkRelease,'function');
  networkRelease();assert.equal(await first,true);assert.equal(await second,true);await settled();
  assert.equal(posts().length,1);assert.equal(eventRows().length,0);assert.equal(navigated.length,2);
 }else if(name==='current-disabled'){
  const saved=eventRows()[0][1];assert.equal(release.custodialNotificationEnabled(card),false);
  assert.equal(await tap(),false);fire('window','online');fire('app','resume');fire('network','networkStatusChange',{connected:true});
  await api.flushEventOpenOutbox();await settled();
  assert.equal(sent.length,0);assert.equal(writes,0);assert.equal(navigated.length,0);assert.equal(eventRows()[0][1],saved);
 }else if(['startup-readback','incapable-readback','reinspected-original-readback'].includes(name)){
  assert.equal(eventRows().length,0);assert.equal(posts().length,0);assert.equal(navigated.length,0);
  assert.equal(sent[0].query,binding.notification_key);
  if(name==='incapable-readback')assert.equal(listeners.has('local:localNotificationActionPerformed'),false);
 }else if(['startup-absent','startup-withheld'].includes(name)){
  assert.equal(eventRows().length,1);assert.equal(posts().length,0);assert.equal(writes,0);assert.equal(navigated.length,0);
 }else if(['missing-source','foreign-source','wrong-key','duplicate-source','withheld-source','unknown-source','offline-source'].includes(name)){
  assert.equal(await tap(),false);assert.equal(posts().length,0);assert.equal(eventRows().length,0);assert.equal(navigated.length,0);
 }else if(['generation-source','principal-source','generation-post','principal-post','pagehide-source','pagehide-post','card-source','gate-source'].includes(name)){
  const work=tap();for(let i=0;i<30&&!networkRelease;i++)await tick();assert.equal(typeof networkRelease,'function');
  if(name.startsWith('principal-'))secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify(record({...p,employee_id:id(90),credential_id:id(91),assignment_epoch:8})));
  if(name.startsWith('principal-')||name.startsWith('generation-')){
   const before=store.getGeneration();
   await store.ensureSecurityState();
   assert.ok(store.getGeneration()>before);
  }
  if(name.startsWith('pagehide-')){fire('window','pagehide');fire('window','pageshow');}
  if(name==='card-source'){card.notification_key='edited-card';card.route='messages.html';}
  if(name==='gate-source')admitted=false;
  networkRelease();const result=await work;await settled();
  if(name==='card-source'){
   assert.equal(result,true);assert.equal(posts().length,1);assert.equal(JSON.parse(posts()[0].body).notification_key,binding.notification_key);
   assert.match(navigated[0],/\/events.html\?/);assert.equal(eventRows().length,0);
  }else{
   assert.equal(result,false);assert.equal(navigated.length,0);assert.equal(posts().length,name.endsWith('-post')?1:0);
   assert.equal(eventRows().length,name.endsWith('-post')?1:0);
  }
 }else if(name==='pagehide-cleanup'||name==='gate-cleanup'){
  const entered=new Promise(r=>{enteredLock=r;});const work=tap();await entered;
  if(name==='pagehide-cleanup'){fire('window','pagehide');fire('window','pageshow');}else admitted=false;
  paused=false;releaseLock();
  assert.equal(await work,false);await settled();assert.equal(posts().length,1);assert.equal(eventRows().length,1);assert.equal(navigated.length,0);
 }else if(name==='unknown-fence-write-failure'){
  assert.equal(await tap(),false);await settled();assert.equal(posts().length,0);assert.equal(navigated.length,0);
  assert.equal(eventRows().length,1);assert.equal(JSON.parse(eventRows()[0][1]).phase,'PREPARED');
 }else if(name==='gate-mutation'){
  const entered=new Promise(r=>{enteredLock=r;});
  // Pause actual protected candidate admission after GET, then withdraw before any POST.
  paused=true;const work=tap();await entered;admitted=false;paused=false;releaseLock();
  await work;await settled();assert.equal(posts().length,0);assert.equal(eventRows().length,0);assert.equal(navigated.length,0);
 }else if(['bare-opened','wrong-receipt','provider-accepted','offline-post'].includes(name)){
  assert.equal(await tap(),true);await settled();assert.equal(posts().length,1);assert.equal(eventRows().length,1);
  const saved=eventRows()[0][1];assert.equal(JSON.parse(saved).phase,'DISPATCH_UNKNOWN');
  await tap();fire('window','online');fire('app','resume');fire('document','visibilitychange');
  await api.flushEventOpenOutbox();await settled();assert.equal(posts().length,1);assert.equal(eventRows()[0][1],saved);
  offline=false;responseRows=[opened];await api.flushEventOpenOutbox();assert.equal(eventRows().length,0);assert.equal(posts().length,1);
 }else if(name==='typed-open'||name==='already-opened'){
  assert.equal(await tap(),true,JSON.stringify({requests:sent.length,writes,generation:store.getGeneration(),pending:eventRows().length}));await settled();assert.equal(eventRows().length,0);assert.equal(navigated.length,1);
  assert.equal(posts().length,name==='typed-open'?1:0);
  if(name==='typed-open'){
   assert.equal(posts()[0].body,JSON.stringify({notification_key:binding.notification_key}));
   assert.equal(posts()[0].key,`employee-event-open:${binding.instance_id}:${binding.credential_id}:${binding.assignment_epoch}:opened`);
   assert.equal(posts()[0].deviceId,p.device_id);
  }
 }else throw Error('Unknown NEW event bridge selector');
 assertHistory();assert.equal(lockOwned,false);assert.equal(Boolean(networkRelease&&delayPhase!==null),false);
 console.log(JSON.stringify({selector:name,result:'PASS_SOURCE_SYNTHETIC',admission:['current-disabled','disabled-successor-action'].includes(name)?'ACTUAL_DISABLED_POLICY':'SYNTHETIC_ADMITTED_OPERATIONAL_SCOPE',
  executed:'actual event domain, bridge install/action/lifecycle/requestEnvelope/credential dispatch/private runtime; recording native HTTP and unrelated presentation',
  postCount:posts().length,requestCount:sent.length,remainingOriginals:eventRows().length,legacyHistory:'unchanged',physicalSQLAuth:'NOT_RUN',
  sharedIdentityInspector:name==='reinspected-original-readback'?'ACTUAL_REINSPECTION_FIXED_KNOWN_PHONE_PENDING_RETAINED':'not_reinspected_after_pending_row'}));
}

async function notificationBridgeCase(name){
 const {webcrypto}=await import('node:crypto');
 const domain=await import('../mobile/src/custodial/notification-receipts.js');
 const {getCustodialBridgeSecurityRuntime}=await import('../mobile/src/custodial/security-runtime.js');
 const {createRawStorageAdapter}=await import('../mobile/src/custodial/storage-firewall.js');
 const {CUSTODIAL_DEVICE_KEYS,CUSTODIAL_INSTALLATION_MARKER_KEY,CUSTODIAL_INSTALLATION_RECORD_KEY}=
  await import('../mobile/src/custodial/credential-store.js');
 const principalDomain=await import('../mobile/src/custodial/protected-principal.js');
 const policy=await import('../mobile/src/custodial/transport-policy.js');
 const {custodialNotificationEnabled}=await import('../mobile/src/custodial/release-scope.js');
 const id=n=>'be000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const p={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),
  credential_id:id(2),credential_operation_id:id(3),assignment_epoch:7,
  installation_seal:'SYNTHETIC_INSTALLATION_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
 const prefix='mz_native_notification_outbox:',holdKey='mz_custodial_protected_browser_hold.v1';
 let lockOwned=false,waiting=false,releaseLock,networkRelease,networkCount=0,writeCount=0,confirmCount=0;
 class Storage{
  constructor(){this.data=new Map();}
  get length(){return this.data.size;}
  key(i){return [...this.data.keys()][i]??null;}
  getItem(k){return this.data.get(k)??null;}
  setItem(k,v){if(k.startsWith(prefix))writeCount++;this.data.set(k,String(v));}
  removeItem(k){if(k.startsWith(prefix))writeCount++;this.data.delete(k);}
  clear(){this.data.clear();}
 }
 const storage=new Storage(),raw=createRawStorageAdapter(storage),secure=new Map();
 for(const k of CUSTODIAL_DEVICE_KEYS)raw.setItem(k,p.device_id);
 raw.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY,p.installation_seal);
 const record=principal=>({schema_version:1,credential:'SYNTHETIC_NOT_A_DEVICE_CREDENTIAL',
  device_id:p.device_id,installation_seal:p.installation_seal,enrolled_at:p.enrolled_at,principal});
 secure.set(CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify(record(p)));
 const locks={async request(name,options,callback){assert.equal(lockOwned,false);
  if(waiting)await new Promise(r=>{releaseLock=r;});
  lockOwned=true;try{return await callback({name,mode:options.mode});}finally{lockOwned=false;}}};
 const runtime=getCustodialBridgeSecurityRuntime({storage,locks,cryptoApi:webcrypto,indexedDb:{databases:async()=>[]},
  secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
 await runtime.security.ready;
 const store=runtime.credentialStore,security=runtime.security;
 const row=domain.createNativeNotificationReceipt({data:{kind:name==='typed-lunch-cleanup'?'employee_lunch_coverage':'employee_location_status',notification_key:'synthetic-current-original',
  receipt_job_id:id(4),receipt_credential_id:p.credential_id,receipt_employee_id:p.employee_id,
  receipt_assignment_epoch:String(p.assignment_epoch),receipt_device_id:p.device_id},action:'opened',
  deviceId:p.device_id,createdAt:'2026-01-01T00:00:00.000Z'});
 const key=prefix+row.id,encoded=JSON.stringify(row);
 raw.setItem(key,encoded);writeCount=0;
 const ack={ok:true,data:{id:id(5),device_identifier:p.device_id,notification_key:row.notification_key,
  notification_type:row.notification_type,credential_id:p.credential_id,employee_id:p.employee_id,
  assignment_epoch:p.assignment_epoch,notification_job_id:row.receipt_binding.job_id,
  opened_at:'2026-01-01T00:00:00.000000+00:00'},meta:{synthetic:true}};
 const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const sent=[];let facade=store;
 if(name.startsWith('confirmation-'))facade=Object.freeze({...store,
  getPendingEnrollmentOperation:()=>({status:'local_committed_pending_server_confirmation',operation_id:id(7)})});
 const makeGenerationAdvance=async()=>{
  const before=store.getGeneration();
  await store.ensureSecurityState();
  assert.ok(store.getGeneration()>before,'Actual credential store generation advanced from changed inspected counts');
  assert.equal(store.getStatus().ready,true);
 };
 const nativeFetch=async({input,init,resolvedUrl,deviceId})=>{
  networkCount++;sent.push({path:resolvedUrl.pathname,headers:new Headers(init.headers),body:init.body,deviceId,credentials:init.credentials});
  if(name==='offline-unknown')throw Object.assign(Error('Synthetic transport outcome unavailable'),{name:'TypeError'});
  if(name.startsWith('confirmation-')&&networkCount===1)
   return response({ok:false,code:'device_enrollment_confirmation_required'},409);
  if(['generation-after-http','principal-after-http','mutation-wait-binding'].includes(name))
   return new Promise(resolve=>{networkRelease=()=>resolve(response(ack));});
  if(name==='malformed-ack')return response({ok:true,data:{provider_accepted:true}});
  if(name==='invalid-json')return new Response('{',{status:200});
  if(name==='auth-denied')return response({ok:false,code:'device_permission_denied'},403);
  if(name==='wrong-ack-job')return response({...ack,data:{...ack.data,notification_job_id:id(9)}});
  return response(ack);
 };
 const slice=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
 const program=slice('  function target(','  function safeEnrollmentTerminalMessage(')
  +slice('  function currentPrincipal(','  function homeCacheKey(')
  +slice('  async function requireRecoveryForRejectedCredential(','  function publicUnauthenticatedRoute(')
  +slice('  function publicUnauthenticatedRoute(','  async function confirmPendingEnrollment(')
  +slice('    const flushNativeNotificationOutbox =','    const handleAction =')
  +'\nglobalThis.owning={bridgeFetch,requestEnvelope,flushNativeNotificationOutbox};';
 const context={...domain,...principalDomain,...policy,custodialNotificationEnabled,
  API:'https://memphis-zoo-mcp.onrender.com',API_ORIGIN:'https://memphis-zoo-mcp.onrender.com',
  NATIVE_NOTIFICATION_OUTBOX_PREFIX:prefix,credentialStore:facade,security,localStorage:storage,
  nativeVault:true,browserTestBuild:false,browserCredentialTransport:null,
  nativeCustodialAuthorizedFetch:nativeFetch,
  rawFetch:()=>{throw Error('No raw fetch allowed in owning source fixture');},
  scheduleNotificationAuthority:{beginResponse:()=>{throw Error('Unrelated schedule route excluded');}},
  reconcileScheduleNotifications:()=>{throw Error('Unrelated schedule mutation excluded');},
  confirmPendingEnrollment:async()=>{confirmCount++;if(name==='confirmation-generation-change')await makeGenerationAdvance();},
  location:{href:'https://synthetic.invalid/employee-hub.html'},URL,Request,Headers,Response,FormData,Blob,JSON,Promise};
 vm.createContext(context);vm.runInContext(program,context);
 const api=context.owning, request=domain.nativeNotificationReceiptRequest(row);
 const dispatchOptions={method:'POST',headers:request.headers,body:request.body,expectedGeneration:store.getGeneration()};
 const originalIntact=()=>storage.data.get(key)===encoded; // Never log body/row/credentials.
 try{
  if(name==='generation-before-dispatch'){
   const advancing=makeGenerationAdvance(); // Queued before dispatch; no fake generation guard.
   let failed=false;
   try{await api.requestEnvelope(request.path,dispatchOptions);}catch{failed=true;}
   await advancing;
   assert.equal(failed,true);assert.equal(networkCount,0);assert.equal(originalIntact(),true);assert.equal(writeCount,0);
  }else if(name==='confirmation-generation-change'){
   let failed=false;try{await api.requestEnvelope(request.path,dispatchOptions);}catch{failed=true;}
   assert.equal(failed,true);assert.equal(confirmCount,1);assert.equal(networkCount,1);
   assert.equal(originalIntact(),true);assert.equal(writeCount,0);
  }else if(name==='confirmation-same-generation'){
   const result=await api.requestEnvelope(request.path,dispatchOptions);
   assert.equal(result.ok,true);assert.equal(confirmCount,1);assert.equal(networkCount,2);assert.equal(originalIntact(),true);
  }else if(name==='typed-ack-cleanup'||name==='typed-lunch-cleanup'){
   await api.flushNativeNotificationOutbox();
   assert.equal(storage.data.has(key),false);assert.equal(networkCount,1);assert.equal(writeCount,1);
   assert.equal(sent[0].path,request.path);assert.equal(sent[0].headers.get('Idempotency-Key'),row.id);
   assert.equal(sent[0].body===JSON.stringify(request.body),true);assert.equal(sent[0].credentials,'omit');
  }else if(['malformed-ack','wrong-ack-job','offline-unknown','invalid-json','auth-denied'].includes(name)){
   await api.flushNativeNotificationOutbox();
   assert.equal(originalIntact(),true);assert.equal(writeCount,0);assert.equal(networkCount,1);
   if(name==='auth-denied')assert.equal(store.getStatus().ready,true,'Operational denial must not invent enrollment recovery');
  }else if(name==='legacy-preserved'){
   raw.removeItem(key);
   const legacy={...row,schema_version:'native-notification-outbox.v2'};
   const legacyRaw=JSON.stringify(legacy);raw.setItem(key,legacyRaw);writeCount=0;
   await api.flushNativeNotificationOutbox();
   assert.equal(networkCount,0);assert.equal(storage.data.get(key)===legacyRaw,true);assert.equal(writeCount,0);
  }else if(name==='generation-after-http'||name==='principal-after-http'){
   const writing=api.flushNativeNotificationOutbox();await new Promise(r=>setImmediate(r));
   assert.equal(typeof networkRelease,'function');
   if(name==='principal-after-http')secure.set(CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify(record({...p,
    employee_id:id(9),credential_id:id(10),assignment_epoch:8})));
   await makeGenerationAdvance(); // HTTP promise is NOT holding credential FIFO.
   networkRelease();await writing;
   assert.equal(originalIntact(),true);assert.equal(writeCount,0);assert.equal(networkCount,1);
  }else if(name==='mutation-wait-binding'){
   const writing=api.flushNativeNotificationOutbox();await new Promise(r=>setImmediate(r));
   waiting=true;networkRelease();await new Promise(r=>setImmediate(r));
   secure.set(CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify(record({...p,
    employee_id:id(9),credential_id:id(10),assignment_epoch:8})));
   // The settlement currently owns the FIFO; external native record cannot be
   // refreshed recursively. A raw original device binding change is observable
   // to its actual assertCurrent immediately, without a nested native wait.
   raw.setItem('memphisAssignedDeviceId','KIOSK_09');releaseLock?.();waiting=false;
   await writing;assert.equal(originalIntact(),true);assert.equal(writeCount,0);
  }else if(name==='generation-scalar-no-authority'){
   // Remove only the synthetic fixture's enrollment, never an actual device
   // credential. Matching a counter cannot admit an unavailable principal.
   secure.delete(CUSTODIAL_INSTALLATION_RECORD_KEY);
   try{await store.ensureSecurityState();}catch{}
   assert.equal(store.getStatus().ready,false);
   let refused=false;
   try{await api.requestEnvelope(request.path,{...dispatchOptions,expectedGeneration:store.getGeneration()});}catch{refused=true;}
   assert.equal(refused,true);assert.equal(networkCount,0);assert.equal(originalIntact(),true);
  }else if(name==='no-option-compatible'){
   const result=await api.requestEnvelope(request.path,{method:'POST',headers:request.headers,body:request.body});
   assert.equal(result.ok,true);assert.equal(networkCount,1);assert.equal(originalIntact(),true);
  }else throw Error('Unknown owning selector');
  console.log(JSON.stringify({case:name,result:'PASS',scope:'actual extracted bridge callbacks and sealed domain/runtime/store/policy with synthetic native transport/secure storage/locks; NOT actual native SDK/HTTP proof'}));
 }finally{networkRelease?.();releaseLock?.();assert.equal(lockOwned,false);}
}

// NEW owning caller cases only. Actual runtime/store/private admission, with
// synthetic Storage/Web Locks/native replies. Status overrides explicitly test
// caller-boundary races; they are NOT authenticated principal transitions.
async function offlineSnapshotWriterCurrentnessCase(name){
 const cases=['save-healthy','load-healthy','save-browser-test','save-native-generation','load-native-generation',
  'save-native-owner','load-native-owner','save-native-device','load-native-device','save-native-ABA','load-native-ABA',
  'save-queued-generation','load-queued-generation','save-queued-owner','load-queued-owner','save-queued-device','load-queued-device',
  'save-queued-binding','load-queued-binding','save-held','load-held','save-lock-unavailable','load-lock-unavailable',
  'save-native-hold','load-native-hold','save-mutable-input','load-detached-reply','save-native-error','load-native-error',
  'save-native-false','load-native-false','save-unavailable','load-unavailable','save-fifo-transition','load-fifo-transition',
  'save-return-generation','load-return-generation'];
 assert.ok(cases.includes(name),'Unknown new snapshot selector');
 const saving=name.startsWith('save-'),phase=name.slice(name.indexOf('-')+1);
 const {webcrypto}=await import('node:crypto');
 const base=process.env.OFFLINE_SNAPSHOT_RUNTIME_ROOT
  ? new URL(`file://${process.env.OFFLINE_SNAPSHOT_RUNTIME_ROOT.replace(/\/$/,'')}/mobile/src/custodial/`)
  : new URL('../mobile/src/custodial/',import.meta.url);
 const {getCustodialBridgeSecurityRuntime}=await import(new URL('security-runtime.js',base));
 const {createRawStorageAdapter}=await import(new URL('storage-firewall.js',base));
 const keys=await import(new URL('credential-store.js',base));
 const {principalIdentity,protectedPrincipal}=await import(new URL('protected-principal.js',base));
 const {PROTECTED_BROWSER_HOLD_KEY}=await import(new URL('protected-browser-admission.js',base));
 const id=n=>'df000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
  credential_operation_id:id(3),assignment_epoch:7,installation_seal:'SYNTHETIC_OFFLINE_SNAPSHOT_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
 const snapshot={schema_version:'offline-scan-snapshot.v2',contract_version:'scan.v4.snapshot-bound-authority',
  canonical_device_id:principal.device_id,snapshot_id:'a'.repeat(64),employee_id:principal.employee_id,credential_id:principal.credential_id,
  assignment_epoch:principal.assignment_epoch,generated_at:'2026-10-14T00:00:00.000Z',expires_at:'2026-10-14T00:05:00.000Z',
  proof:{original:'SYNTHETIC_ORIGINAL_PROOF'},rows:[{value:'SYNTHETIC_ORIGINAL_VALUE'}]};
 const encoded=JSON.stringify(snapshot),key='mz_scan_authority_snapshot:'+principal.device_id;
 let writes=0,calls=0,lockOwned=false,lockOnNative=false,releaseLock,releaseNative,queue=false,override=null,transition,transitionDone=false;
 const previous='SYNTHETIC_PREVIOUS_CACHE_BYTES';
 class Storage{constructor(){this.data=new Map();}get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}
  getItem(k){return this.data.get(k)??null;}setItem(k,v){if(k===key)writes++;this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}clear(){this.data.clear();}}
 const storage=new Storage(),raw=createRawStorageAdapter(storage),secure=new Map();
 for(const k of keys.CUSTODIAL_DEVICE_KEYS)raw.setItem(k,principal.device_id);
 raw.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,principal.installation_seal);raw.setItem(key,previous);writes=0;
 secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify({schema_version:1,credential:'SYNTHETIC_NOT_REAL',
  device_id:principal.device_id,installation_seal:principal.installation_seal,enrolled_at:principal.enrolled_at,principal}));
 const locks={async request(label,options,callback){
  if(queue)await new Promise(resolve=>{releaseLock=resolve;});
  assert.equal(lockOwned,false);lockOwned=true;
  try{return await callback({name:label,mode:options.mode});}finally{lockOwned=false;}}};
 const runtime=getCustodialBridgeSecurityRuntime({storage,sessionStorage:undefined,locks:phase==='lock-unavailable'?{}:locks,
  cryptoApi:webcrypto,indexedDb:{databases:async()=>[]},
  secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
 await runtime.security.ready;
 const store=runtime.credentialStore,originalGeneration=store.getGeneration();
 const status=()=>({...store.getStatus(),...override});
 const options=[],nativeRequests=[],nativeError=Error('SYNTHETIC_NATIVE_ERROR_UNCHANGED');
 const security={...runtime.security,getStatus:status,async mutateProtectedWork(operation,bounds){
  options.push(bounds);
  const result=await runtime.security.mutateProtectedWork(operation,bounds);
  if(phase==='return-generation')override={generation:originalGeneration+1};
  return result;
 }};
 const native=async request=>{
  calls++;lockOnNative=lockOwned;nativeRequests.push(request);
  return new Promise((resolve,reject)=>{releaseNative=()=>phase==='native-error'?reject(nativeError):
   resolve(phase==='native-false'?(saving?{anchored:false}:{snapshot:null,found:false}):saving?{anchored:true}:{snapshot});});
 };
 const context={JSON,Number,Object,String,Array,bridgeReady:Promise.resolve(),security,
  nativeVault:phase!=='browser-test',browserTestBuild:phase==='browser-test',OFFLINE_SCAN_SNAPSHOT_PREFIX:'mz_scan_authority_snapshot:',
  localStorage:storage,deviceId:()=>status().deviceId,
  currentPrincipalIdentity:()=>principalIdentity(protectedPrincipal(status().principal)),
  securityError:code=>Object.assign(Error(code),{code}),
  anchorNativeCustodialOfflineAuthoritySnapshot:native,loadNativeCustodialOfflineAuthoritySnapshot:native};
 vm.createContext(context);
 for(const methodName of ['exactNativeTimestamp','validateOfflineScanAuthoritySnapshot','saveOfflineScanAuthoritySnapshot','loadOfflineAuthoritySnapshot']){
  const method=source.match(new RegExp(`  (?:async )?function ${methodName}\\([^]*?\\n  \\}`))?.[0];
  assert.ok(method,methodName);vm.runInContext(method,context);
 }
 const change=kind=>{
  if(kind==='generation')override={generation:originalGeneration+1};
  if(kind==='owner')override={principal:{...principal,employee_id:id(9),credential_id:id(10)}};
  if(kind==='device')override={deviceId:'KIOSK_09'};
  if(kind==='ABA')override={generation:originalGeneration+2,principal:{...principal}};
 };
 let work;
 try{
  if(phase==='held')raw.setItem(PROTECTED_BROWSER_HOLD_KEY,'SYNTHETIC_HELD');
  if(phase==='unavailable')override={ready:false,available:false};
  if(phase.startsWith('queued-'))queue=true;
  work=saving?context.saveOfflineScanAuthoritySnapshot(snapshot):context.loadOfflineAuthoritySnapshot('KIOSK_08');
  work.catch(()=>{});
  await new Promise(resolve=>setImmediate(resolve));
  if(phase.startsWith('queued-')){
   assert.equal(calls,0,'No native touching work before FIFO/shared admission');
   assert.equal(typeof releaseLock,'function');
   if(phase==='queued-binding')for(const k of keys.CUSTODIAL_DEVICE_KEYS)raw.setItem(k,'KIOSK_09');
   else change(phase.slice(7));
   releaseLock();queue=false;
  }else if(['held','lock-unavailable','unavailable'].includes(phase)){
   releaseNative?.();await assert.rejects(work);assert.equal(calls,0);
  }else if(phase==='browser-test'){
   assert.equal(await work,true);assert.equal(calls,0);assert.equal(writes,1);
  }else{
   assert.equal(calls,1);assert.equal(typeof releaseNative,'function');
   if(phase.startsWith('native-')&&!['native-error','native-false','native-hold'].includes(phase))change(phase.slice(7));
   if(phase==='native-hold')raw.setItem(PROTECTED_BROWSER_HOLD_KEY,'SYNTHETIC_HELD_DURING_NATIVE');
   if(phase==='mutable-input')snapshot.proof.original='CHANGED_CALLER_PAYLOAD';
   if(phase==='fifo-transition'){
    transition=store.ensureSecurityState().then(()=>{transitionDone=true;});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(transitionDone,false,'Normal transition must wait for owning native work');
   }
   releaseNative();
  }
  if(phase.startsWith('queued-')||phase.startsWith('native-')||phase==='mutable-input'||phase==='return-generation'){
   if(phase==='native-error')await assert.rejects(work,error=>error===nativeError);
   else await assert.rejects(work);
  }else if(phase==='healthy'||phase==='detached-reply'){
   const value=await work;
   if(saving)assert.equal(value,true);
   else{
    assert.equal(JSON.stringify(value),encoded);assert.equal(Object.isFrozen(value),true);
    if(phase==='detached-reply'){
     snapshot.proof.original='CHANGED_NATIVE_REPLY';assert.equal(value.proof.original,'SYNTHETIC_ORIGINAL_PROOF');
     assert.equal(Object.isFrozen(value.proof),true);assert.equal(Object.isFrozen(value.rows),true);
    }
   }
  }else if(phase==='fifo-transition'){
   // Final return may refuse if the queued normal transition wins its boundary.
   await work.catch(error=>assert.match(error.code||error.message,/generation_changed/));
   await transition;assert.equal(transitionDone,true);
  }
  const noWrite=phase.startsWith('queued-')||phase.startsWith('native-')||['held','lock-unavailable','unavailable','mutable-input'].includes(phase);
  if(noWrite){assert.equal(writes,0,'Old/denied reply must not publish browser cache');assert.equal(raw.getItem(key),previous);}
  else {assert.equal(writes,1);assert.equal(raw.getItem(key),encoded);}
  if(calls){assert.equal(lockOnNative,true,'Native callback must own existing private admission');}
  if(saving&&calls){assert.equal(JSON.stringify(nativeRequests[0].snapshot),encoded);assert.notEqual(nativeRequests[0].snapshot,snapshot);
   assert.equal(Object.isFrozen(nativeRequests[0].snapshot.proof),true);}
  if(!['unavailable'].includes(phase)){
   assert.equal(options.length,1);assert.equal(options[0].requireEnrollment,true);assert.equal(options[0].expectedGeneration,originalGeneration);
  }
  assert.equal(lockOwned,false);
  console.log(JSON.stringify({case:name,status:'PASS_NEW_SNAPSHOT_CALLER',calls,writes,lockOnNative,
   limits:'Actual extracted bridge bodies + real credential FIFO/private browser admission; SYNTHETIC storage/Web Locks/native replies and explicit status race injections. NOT native auth/all-writer ABA/browser/Android proof; post-write refusal is not rollback.'}));
 }catch(error){console.log(JSON.stringify({case:name,status:'FAIL_NEW_SNAPSHOT_CALLER',calls,writes,lockOnNative,cachePreserved:raw.getItem(key)===previous}));throw error;
 }finally{releaseNative?.();releaseLock?.();if(transition)await transition;assert.equal(lockOwned,false);}
}

// NEW four-operation caller qualification ONLY. Real runtime/FIFO/admission;
// Storage, Web Locks, native replies and explicit status races are SYNTHETIC.
async function offlineNativeOperationCurrentnessCase(name){
 const operations={authorize:['authorizeOfflineNewWork','authorizeNativeCustodialOfflineNewWork'],
  state:['getOfflineAuthorityState','getNativeCustodialOfflineAuthorityState'],
  begin:['beginRollbackFence','beginNativeCustodialRollbackFence'],
  clear:['clearRollbackFence','clearNativeCustodialRollbackFence']};
 const split=name.indexOf('-'),operation=name.slice(0,split),phase=name.slice(split+1);
 const phases=['healthy','queued-generation','queued-owner','queued-device','queued-binding','native-generation','native-owner',
  'native-device','native-ABA','held','lock-unavailable','native-hold','native-error','lost-reply','malformed-reply','unavailable',
  'fifo-transition','return-generation','mutable-device','argument-getter-owner','reply-getter-owner',
  'mutable-token','invalid-token','inactive-state','bad-fence-state'];
 assert.ok(operations[operation]&&phases.includes(phase),'Unknown new offline operation selector');
 assert.ok(!['mutable-token','invalid-token'].includes(phase)||['authorize','clear'].includes(operation));
 assert.ok(!['inactive-state','bad-fence-state'].includes(phase)||operation==='state');
 const {webcrypto,createHash}=await import('node:crypto');
 const base=process.env.OFFLINE_NATIVE_RUNTIME_ROOT
  ? new URL('file://'+process.env.OFFLINE_NATIVE_RUNTIME_ROOT.replace(/\/$/,'')+'/mobile/src/custodial/')
  : new URL('../mobile/src/custodial/',import.meta.url);
 const pins={'security-runtime.js':'185385517c1efdd3d21f7df975a9ae45f683313445c1d319f5c762b78ec12793',
  'credential-store.js':'3df780caf607fe404ce56928c90c9b7558c66d720dedecf1d02fcf3f6293d70f',
  'native-security.js':'4aa5d1e3287029434a355bbd0b2b00a63b8cb646cb3ac084330c1fc74b5ead82',
  'protected-principal.js':'bf17128f92a9104d4febe8e2431c60f93dcdcc57b5e788dc7fdbd3905e0a6d37',
  'storage-firewall.js':'59b9f10e7b0b2222ecc687f577e96520e3cb1bc10ed9249101756f328f02715f',
  'protected-browser-admission.js':'ebfbbf615880151f4a620f814e1d07ff4bbe6186c1ad3161a81fedd946ce45df'};
 const verifyPins=()=>{for(const [file,hash]of Object.entries(pins))
  assert.equal(createHash('sha256').update(readFileSync(new URL(file,base))).digest('hex'),hash,'Changed READONLY dependency: '+file);};
 verifyPins();
 const {getCustodialBridgeSecurityRuntime}=await import(new URL('security-runtime.js',base));
 const {createRawStorageAdapter}=await import(new URL('storage-firewall.js',base));
 const keys=await import(new URL('credential-store.js',base));
 const {principalIdentity,protectedPrincipal}=await import(new URL('protected-principal.js',base));
 const {PROTECTED_BROWSER_HOLD_KEY}=await import(new URL('protected-browser-admission.js',base));
 const id=n=>'ed000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
  credential_operation_id:id(3),assignment_epoch:7,installation_seal:'SYNTHETIC_OFFLINE_OPERATION_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
 const snapshotId='a'.repeat(64),fenceId=id(4),pendingKey='mz_chatscope_group_pending:SYNTHETIC_ORIGINAL';
 // Only the normal-refresh fixture needs a readable ORIGINAL device field,
 // per credential-store.collectObjectIdentities; not a permission/approval.
 const pendingRaw=phase==='fifo-transition'?JSON.stringify({device_id:principal.device_id,
  original:'SYNTHETIC_PENDING_ORIGINAL_BYTES'}):'SYNTHETIC_PENDING_ORIGINAL_BYTES';
 let calls=0,lockOwned=false,lockOnNative=false,releaseLock,releaseNative,queue=false,override=null;
 let transition,transitionDone=false,writeCount=0;
 class Storage{constructor(){this.data=new Map();}get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}
  getItem(k){return this.data.get(k)??null;}setItem(k,v){const bytes=String(v);if(this.data.get(k)!==bytes)writeCount++;this.data.set(k,bytes);}
  // A normal credential refresh purges an ABSENT plaintext credential key.
  // Measure actual byte changes, not that harmless removeItem attempt.
  removeItem(k){if(this.data.has(k))writeCount++;this.data.delete(k);}clear(){if(this.data.size)writeCount++;this.data.clear();}}
 const storage=new Storage(),raw=createRawStorageAdapter(storage),secure=new Map();
 for(const k of keys.CUSTODIAL_DEVICE_KEYS)raw.setItem(k,principal.device_id);
 raw.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,principal.installation_seal);
 secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify({schema_version:1,credential:'SYNTHETIC_NOT_REAL',
  device_id:principal.device_id,installation_seal:principal.installation_seal,enrolled_at:principal.enrolled_at,principal}));
 const secureBefore=[...secure.entries()];
 const locks={async request(label,options,callback){
  if(queue)await new Promise(resolve=>{releaseLock=resolve;});
  assert.equal(lockOwned,false);lockOwned=true;
  try{return await callback({name:label,mode:options.mode});}finally{lockOwned=false;}}};
 const runtime=getCustodialBridgeSecurityRuntime({storage,sessionStorage:undefined,locks:phase==='lock-unavailable'?{}:locks,
  cryptoApi:webcrypto,indexedDb:{databases:async()=>[]},
  secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
 await runtime.security.ready;
 assert.equal(runtime.security.getStatus().ready,true,'Synthetic enrollment must initialize before opaque preserved test row');
 raw.setItem(pendingKey,pendingRaw);writeCount=0;
 const store=runtime.credentialStore,generation=store.getGeneration();
 const status=()=>({...store.getStatus(),...override});
 const changedOwner=()=>{override={principal:{...principal,employee_id:id(9),credential_id:id(10)}};};
 const options=[],requests=[],nativeError=Error('SYNTHETIC_NATIVE_ERROR_UNCHANGED'),lostError=Error('SYNTHETIC_LOST_NATIVE_REPLY');
 let deviceValue=principal.device_id,tokenValue=operation==='authorize'?snapshotId:fenceId;
 const deviceArgument=['mutable-device','argument-getter-owner'].includes(phase)?{toString(){
  if(phase==='argument-getter-owner')changedOwner();return deviceValue;}}:principal.device_id;
 const tokenArgument=phase==='mutable-token'?{toString(){return tokenValue;}}:phase==='invalid-token'?'INVALID_ORIGINAL_TOKEN':tokenValue;
 const expected=operation==='authorize'?{authorized:true}:operation==='clear'?{cleared:true}:operation==='begin'?
  {rollback_fence_active:true,rollback_fence_id:fenceId}:
  {occurrences_awaiting_acknowledgement:true,rollback_fence_active:true,rollback_fence_id:fenceId};
 const nativeReply=()=>{
  if(phase==='malformed-reply')return operation==='state'?{}:operation==='begin'?{rollback_fence_active:true,rollback_fence_id:'invalid'}:
   operation==='authorize'?{authorized:'true'}:{cleared:'true'};
  if(phase==='bad-fence-state')return {...expected,rollback_fence_id:null};
  if(phase==='inactive-state')return {occurrences_awaiting_acknowledgement:false,rollback_fence_active:false,rollback_fence_id:null};
  if(phase==='reply-getter-owner'){
   const reply={...expected},field=Object.keys(expected)[0];
   Object.defineProperty(reply,field,{get(){changedOwner();return expected[field];},enumerable:true});return reply;
  }
  return {...expected};
 };
 const native=async(...args)=>{
  calls++;lockOnNative=lockOwned;requests.push(args);
  return new Promise((resolve,reject)=>{releaseNative=()=>phase==='native-error'?reject(nativeError):phase==='lost-reply'?reject(lostError):resolve(nativeReply());});
 };
 const security={...runtime.security,getStatus:status,async mutateProtectedWork(callback,bounds){
  options.push(bounds);const value=await runtime.security.mutateProtectedWork(callback,bounds);
  if(phase==='return-generation')override={generation:generation+1};return value;
 }};
 const context={JSON,Number,Object,String,Array,bridgeReady:Promise.resolve(),security,nativeVault:true,
  deviceId:()=>status().deviceId,currentPrincipalIdentity:()=>principalIdentity(protectedPrincipal(status().principal)),
  securityError:code=>Object.assign(Error(code),{code}),[operations[operation][1]]:native};
 vm.createContext(context);
 const method=source.match(new RegExp('  async function '+operations[operation][0]+'\\([^]*?\\n  \\}'))?.[0];
 assert.ok(method);vm.runInContext(method,context);
 const change=kind=>{
  if(kind==='generation')override={generation:generation+1};
  if(kind==='owner')changedOwner();
  if(kind==='device')override={deviceId:'KIOSK_09'};
  if(kind==='ABA')override={generation:generation+2,principal:{...principal}};
 };
 let work,returned=false;
 try{
  if(phase==='held'){raw.setItem(PROTECTED_BROWSER_HOLD_KEY,'SYNTHETIC_HELD');writeCount=0;}
  if(phase==='unavailable')override={ready:false,available:false};
  if(phase.startsWith('queued-')||phase.startsWith('mutable-'))queue=true;
  work=context[operations[operation][0]](deviceArgument,tokenArgument);work.catch(()=>{});
  await new Promise(resolve=>setImmediate(resolve));
  if(queue){
   assert.equal(calls,0,'Native work before FIFO/shared admission');assert.equal(typeof releaseLock,'function');
   if(phase==='queued-binding'){for(const k of keys.CUSTODIAL_DEVICE_KEYS)raw.setItem(k,'KIOSK_09');writeCount=0;}
   else if(phase.startsWith('queued-'))change(phase.slice(7));
   else if(phase==='mutable-device')deviceValue='KIOSK_09';
   else tokenValue=operation==='authorize'?'b'.repeat(64):id(8);
   releaseLock();queue=false;await new Promise(resolve=>setImmediate(resolve));
  }
  const preDenied=['held','lock-unavailable','unavailable','argument-getter-owner','invalid-token'].includes(phase)||phase.startsWith('queued-');
  if(preDenied){
   releaseNative?.();await assert.rejects(work);assert.equal(calls,0);
  }else{
   assert.equal(calls,1);assert.equal(typeof releaseNative,'function');
   if(['native-generation','native-owner','native-device','native-ABA'].includes(phase))change(phase.slice(7));
   if(phase==='native-hold'){raw.setItem(PROTECTED_BROWSER_HOLD_KEY,'SYNTHETIC_NATIVE_HOLD');writeCount=0;}
   if(phase==='fifo-transition'){
    transition=store.ensureSecurityState().then(()=>{transitionDone=true;});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(transitionDone,false,'Normal transition must wait for native operation');
   }
   releaseNative();
   const denied=phase.startsWith('native-')||['lost-reply','malformed-reply','bad-fence-state','reply-getter-owner','return-generation'].includes(phase);
   if(denied){
    if(phase==='native-error')await assert.rejects(work,error=>error===nativeError);
    else if(phase==='lost-reply')await assert.rejects(work,error=>error===lostError);
    else await assert.rejects(work);
   }else if(phase==='fifo-transition'){
    await work.catch(error=>assert.match(error.code||error.message,/generation_changed/));await transition;assert.equal(transitionDone,true);
   }else{
    const value=await work;returned=true;
    const wanted=phase==='inactive-state'?{occurrences_awaiting_acknowledgement:false,rollback_fence_active:false,rollback_fence_id:null}:expected;
    assert.equal(JSON.stringify(value),JSON.stringify(wanted));assert.equal(Object.isFrozen(value),true);
   }
   assert.equal(lockOnNative,true,'Native callback outside private admission');
   assert.equal(requests[0][0],principal.device_id);assert.equal(typeof requests[0][0],'string');
   if(['authorize','clear'].includes(operation)){
    assert.equal(requests[0][1],operation==='authorize'?snapshotId:fenceId);assert.equal(typeof requests[0][1],'string');
   }else assert.equal(requests[0].length,1);
  }
  assert.equal(calls<=1,true,'No retry after unknown/denied native reply');
  assert.equal(raw.getItem(pendingKey),pendingRaw);assert.deepEqual([...secure.entries()],secureBefore);
  assert.equal(writeCount,0,'Operation caller must not destroy/write browser originals');
  if(!['unavailable','argument-getter-owner','invalid-token'].includes(phase)){
   assert.equal(options.length,1);assert.equal(options[0].requireEnrollment,true);assert.equal(options[0].expectedGeneration,generation);
  }
  verifyPins();assert.equal(lockOwned,false);
  console.log(JSON.stringify({case:name,status:'PASS_NEW_OFFLINE_OPERATION',calls,returned,lockOnNative,originalsPreserved:true,
   limits:'Actual four bridge bodies + real store/FIFO/private admission; SYNTHETIC storage/locks/native replies/status injections. Native begin/clear effects are NOT rolled back by JS refusal; no real Android/all-writer/authority proof.'}));
 }catch(error){
  console.log(JSON.stringify({case:name,status:'FAIL_NEW_OFFLINE_OPERATION',calls,returned,lockOnNative,originalsPreserved:raw.getItem(pendingKey)===pendingRaw}));throw error;
 }finally{releaseNative?.();releaseLock?.();if(transition)await transition;assert.equal(lockOwned,false);}
}
