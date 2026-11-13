// This pinned producer is historical Source fixture DATA, not current394/runtime authority.
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInThisContext,runInNewContext} from 'node:vm';
import {getEventListeners} from 'node:events';
import {createProtectedBrowserAdmission,readDocumentProtectedBrowserWriterAdmission,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,
 PROTECTED_BROWSER_HOLD_KEY as KEY,PROTECTED_BROWSER_MUTATION_KEY as EPOCH,PROTECTED_BROWSER_LOCK as LOCK}
  from '../mobile/src/custodial/protected-browser-admission.js';
import {protectedBrowserIdbFixture as idb} from './protected-browser-inventory-tests.mjs';
import {inspectCapturedOriginalCompletion,readCapturedOriginalCompletionArguments,
 inspectCapturedOriginalCompletionCensus,readCapturedOriginalCompletionCensusArguments,closeCapturedProtectedBrowserWork}
 from '../mobile/src/custodial/protected-browser-inventory.js';
import * as Inventory from '../mobile/src/custodial/protected-browser-inventory.js';
import {createRawStorageAdapter,installCustodialStorageFirewall} from '../mobile/src/custodial/storage-firewall.js';
if(process.argv.includes('--document-writer-publication-lifetime-only')){
 // Exact exported receiver in fresh VM globals. A shaped public object is
 // cooperative DATA only, not authenticated document/native/ACK authority.
 const source=readFileSync(new URL('../mobile/src/custodial/protected-browser-admission.js',import.meta.url),'utf8');
 const method=source.match(/export function readDocumentProtectedBrowserWriterAdmission\(\)\{[\s\S]*?\n\}/)?.[0];assert.ok(method);
 let effects=0;const publication=Object.freeze({mutate(){effects++;},requireAdmission(){effects++;},requireMutation(){effects++;}});
 const realm=()=>runInNewContext(`(()=>{const idbOwn=Object.getOwnPropertyDescriptor,
  PROTECTED_BROWSER_DOCUMENT_WRITER_KEY=${JSON.stringify(PROTECTED_BROWSER_DOCUMENT_WRITER_KEY)},
  failure=code=>Object.assign(Error(code),{code});${method.replace('export ','')}
  return{global:globalThis,read:readDocumentProtectedBrowserWriterAdmission};})()`);
 let controls=0;
 const absent=realm();assert.equal(absent.read(),null);controls++;
 const withdrawable=realm();Object.defineProperty(withdrawable.global,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,
  {value:publication,writable:false,enumerable:false,configurable:true});
 assert.throws(()=>withdrawable.read(),error=>error.code==='custodial_document_browser_writer_unavailable');controls++;
 assert.equal(Reflect.deleteProperty(withdrawable.global,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY),true);
 for(const explicit of [true,false]){
  const owner=realm(),field={value:publication,writable:false,enumerable:false,...(explicit?{configurable:false}:{})};
  Object.defineProperty(owner.global,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,field);assert.strictEqual(owner.read(),publication);
  assert.equal(Reflect.deleteProperty(owner.global,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY),false);
  assert.equal(Reflect.defineProperty(owner.global,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,{value:{}}),false);
  assert.equal(Reflect.defineProperty(owner.global,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,{configurable:true}),false);
  Object.defineProperty(owner.global,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,field);assert.strictEqual(owner.read(),publication);controls++;
 }
 assert.equal(effects,0);
 console.log(JSON.stringify({selected:'document-writer-publication-lifetime-only',controls,effects,
  proof:'Exact receiver Source in isolated VM globals; shaped-publication DATA only',native_authority:false,old_groups:0,resources0:true}));
 process.exit(0);
}
const browserDataOnly=process.argv.includes('--browser-original-data-channel-only');
const interactionPreferenceOnly=process.argv.includes('--interaction-preference-writer-only');
const shippingNativePreferenceOnly=process.argv.includes('--shipping-native-preference-writer-only');
const idbQuiescenceOnly=process.argv.includes('--idb-writer-quiescence-only');
const idbImmutableOnly=process.argv.includes('--idb-immutable-writer-hooks-only');
const idbBeforeFenceOnly=process.argv.includes('--idb-before-fence-reproduction-only');
const browserRealDataOnly=process.argv.includes('--browser-original-data-real-codec-only');
const existingHeldBundle=process.argv.find(arg=>arg.startsWith('--existing-held-bundle='))?.slice('--existing-held-bundle='.length);
// The DATA source-callback mode does NOT claim the pending sealed T7 codec is
// linked. Production imports are untouched; only this explicit test mode uses
// data-only opaque handles, with real existing capture/census and WebCrypto.
const installNativeOriginalBrowserPreparation=(idbImmutableOnly||idbQuiescenceOnly||idbBeforeFenceOnly||browserDataOnly||interactionPreferenceOnly||shippingNativePreferenceOnly)?null:
 (await import('../mobile/src/custodial/native-original-browser-preparation.js')).installNativeOriginalBrowserPreparation;

// Actual owner, synthetic FIFO Web Locks and Storage. Browser/native mounting,
// all actual writers, process death and physical phone proof remain separate.
const ID='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function storage(){const rows=new Map();return {rows,get length(){return rows.size;},key:i=>[...rows.keys()][i]??null,
  getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value)};}
function locks(){const queue=[];let running=false;
 const pump=()=>{if(running||!queue.length)return;const item=queue.shift();if(item.aborted){pump();return;}
  running=true;item.entered=true;item.signal.removeEventListener('abort',item.abort);
  Promise.resolve().then(()=>item.work({name:item.name,mode:'exclusive'})).then(item.resolve,item.reject)
   .finally(()=>{running=false;pump();});};
 return {request(name,{mode,signal},work){assert.equal(name,LOCK);assert.equal(mode,'exclusive');
  return new Promise((resolve,reject)=>{const item={name,signal,work,resolve,reject,entered:false,aborted:false};
   item.abort=()=>{if(item.entered)return;item.aborted=true;reject(Object.assign(Error('aborted'),{name:'AbortError'}));};
   if(signal.aborted){item.abort();return;}signal.addEventListener('abort',item.abort,{once:true});queue.push(item);pump();});},
 get active(){return running;},get pending(){return queue.filter(item=>!item.aborted).length;}};
}
function fixture(extra={}){const s=storage(),l=locks(),db={databases:async()=>[],open(){throw Error('no missing database opens');}};
 const options={storage:s,locks:l,indexedDb:db,cryptoApi:webcrypto,...extra};return {s,l,options,gate:createProtectedBrowserAdmission(options)};}
const reject=(promise,code)=>assert.rejects(promise,error=>error.code===code);
const closed=result=>{assert.equal(result.native_authority,false);assert.equal(result.frozen,false);assert.equal(result.acknowledged,false);assert.equal(result.phone_released,false);};
const nativeOriginalOnly=process.argv.includes('--native-original-browser-preparation-only');
const only=idbImmutableOnly||idbQuiescenceOnly||idbBeforeFenceOnly?'IDB_QUIESCENCE_NEW':shippingNativePreferenceOnly?'SHIPPING_NATIVE_PREFERENCE_NEW':interactionPreferenceOnly?'INTERACTION_PREFERENCE_NEW':browserRealDataOnly?'BROWSER_ORIGINAL_REAL_DATA_NEW':browserDataOnly?'BROWSER_ORIGINAL_DATA_NEW':nativeOriginalOnly?'NATIVE_ORIGINAL_BROWSER_NEW':process.argv.find(arg=>arg.startsWith('--case='))?.slice(7);
let passed=0;const test=async(name,work)=>{if(only&&!name.includes(only))return;await work();passed++;console.log('PASS '+name);};
if(interactionPreferenceOnly)await interactionPreferenceWriterCases();
if(shippingNativePreferenceOnly)await interactionPreferenceWriterCases();
if(idbImmutableOnly||idbQuiescenceOnly||idbBeforeFenceOnly)await indexedDbWriterQuiescenceCases();

async function indexedDbWriterQuiescenceCases(){
 // Actual module + Node EventTarget/Event and synthetic IDB native surfaces.
 // This is not a browser, document-start mounting, foreign-realm or ACK proof.
 const turn=()=>new Promise(setImmediate);
 const selected=process.argv.find(arg=>arg.startsWith('--idb-case='))?.slice('--idb-case='.length);
 function documentFixture({install=true,cryptoApi=webcrypto,unsupported=false}={}){
  const originals=new Map(['indexedDB','IDBFactory','IDBDatabase','IDBRequest','IDBTransaction','Event'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const calls=[],targets=[],captures=[];
  const HostEvent=globalThis.Event,emitted=new WeakSet();
  class DocumentEvent extends HostEvent{get isTrusted(){return emitted.has(this);}}
  // This is explicitly fixture metadata, not genuine browser event trust.
  // Script-created Event remains untrusted; only this synthetic IDB port
  // emits its modeled native outcomes. No production test flag is supplied.
  const emit=(object,name,options)=>{const event=new DocumentEvent(name,options);emitted.add(event);object.dispatchEvent(event);};
  class Transaction extends EventTarget{
   constructor(mode){super();this.originalMode=mode;this.aborted=0;targets.push(this);}
   get mode(){return this.originalMode;}
   abort(){this.aborted++;queueMicrotask(()=>emit(this,'abort'));}
   complete(){emit(this,'complete');}
  }
  class Request extends EventTarget{
   constructor(databaseResult=false){super();this.originalTransaction=null;this.originalResult=null;this.databaseResult=databaseResult;targets.push(this);}
   get transaction(){return this.originalTransaction;}
   get result(){return this.originalResult;}
   upgrade(){if(this.databaseResult&&!this.originalResult)this.originalResult=new Database();this.originalTransaction=new Transaction('versionchange');emit(this,'upgradeneeded');return this.originalTransaction;}
   success(){if(this.databaseResult&&!this.originalResult)this.originalResult=new Database();emit(this,'success');}
   error(){emit(this,'error',{cancelable:true});}
   blocked(){emit(this,'blocked');}
  }
  class Database{
   transaction(...args){calls.push({kind:'transaction',receiver:this,args});return new Transaction(args[1]??'readonly');}
  }
  class Factory{
   open(...args){calls.push({kind:'open',receiver:this,args});return new Request(true);}
   deleteDatabase(...args){calls.push({kind:'delete',receiver:this,args});return new Request();}
  }
  const factory=new Factory(),db=new Database(),s=storage(),l=locks();
  for(const [name,value] of Object.entries({indexedDB:factory,IDBFactory:Factory,IDBDatabase:Database,IDBRequest:Request,IDBTransaction:Transaction,Event:DocumentEvent}))
   Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  const rawOpen=factory.open.bind(factory);
  const gate=createProtectedBrowserAdmission({storage:s,locks:l,cryptoApi,
   indexedDb:{databases:async()=>[],open:rawOpen}});
  if(unsupported==='missing')delete Request.prototype.transaction;
  else if(unsupported)Object.defineProperty(Factory.prototype,'deleteDatabase',{...Object.getOwnPropertyDescriptor(Factory.prototype,'deleteDatabase'),writable:false});
  const cleanup=async()=>{
   for(const capture of captures)closeCapturedProtectedBrowserWork(capture);
   // Dispose only this synthetic document's pending event objects. Never
   // uninstall production hooks or delete a durable hold/original row.
   for(const object of targets){if(object instanceof Transaction)object.complete();else object.error();}
   await turn();
   for(const object of targets)for(const name of ['complete','abort','success','error','upgradeneeded'])
    assert.equal(getEventListeners(object,name).length,0,'owned listener cleanup after terminal event');
   for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  };
  const f={gate,s,l,db,factory,Database,Factory,calls,targets,cleanup,
   capture:async(options={})=>{const c=await gate.holdAndCapture({operationId:ID,timeoutMs:200,...options});captures.push(c);return c;}};
  if(install&&!unsupported)gate.installIndexedDbWriteFence();
  return f;
 }
 const run=async(name,work,options)=>{if(selected&&!name.includes(selected))return;
  await test('IDB_QUIESCENCE_NEW '+name,async()=>{const f=documentFixture(options);try{await work(f);}finally{await f.cleanup();}});};
 if(idbImmutableOnly){
  await run('IMMUTABLE_NEW prototype hooks cannot withdraw and restore between capture checks',async f=>{
   const c=await f.capture(),hold=f.s.getItem(KEY),epoch=f.s.getItem(EPOCH);
   for(const [owner,key]of [[f.Database.prototype,'transaction'],[f.Factory.prototype,'open'],[f.Factory.prototype,'deleteDatabase']]){
    const original=Object.getOwnPropertyDescriptor(owner,key),foreign=function(){throw Error('foreign hook');};
    const changed=Reflect.defineProperty(owner,key,{...original,value:foreign});
    if(changed)Object.defineProperty(owner,key,original);
    await f.gate.inspectCapturedHold(c); // A-B-A on the old code evades this boundary.
    assert.equal(changed,false,'owning prototype hook was withdrawable/restorable: '+key);
    assert.equal(original.writable,false);assert.equal(original.configurable,false);
    assert.equal(Reflect.deleteProperty(owner,key),false);
    assert.equal(Reflect.set(owner,key,foreign),false);assert.equal(owner[key],original.value);
   }
   assert.equal(f.s.getItem(KEY),hold);assert.equal(f.s.getItem(EPOCH),epoch);
  });
  await run('IMMUTABLE_NEW factory own shadow cannot select an unfenced hook while held',async f=>{
   const c=await f.capture(),hold=f.s.getItem(KEY),epoch=f.s.getItem(EPOCH),before=f.calls.length;
   for(const key of ['open','deleteDatabase']){
    let foreignCalls=0;
    const changed=Reflect.defineProperty(f.factory,key,{configurable:true,writable:true,value(){foreignCalls++;return 'unfenced lookup';}});
    if(changed){assert.equal(f.factory[key]('original'),'unfenced lookup');Reflect.deleteProperty(f.factory,key);}
    await f.gate.inspectCapturedHold(c);
    assert.equal(changed,false,'own factory shadow selected unfenced '+key);
    assert.equal(foreignCalls,0);assert.throws(()=>f.factory[key]('original'));
    const own=Object.getOwnPropertyDescriptor(f.factory,key);assert(own);
    assert.equal(own.value,f.Factory.prototype[key]);assert.equal(own.writable,false);assert.equal(own.configurable,false);
   }
   assert.equal(f.calls.length,before);assert.equal(f.s.getItem(KEY),hold);assert.equal(f.s.getItem(EPOCH),epoch);
  });
  await run('IMMUTABLE_NEW delivered database own shadow cannot select an unfenced transaction',async f=>{
   const request=f.factory.open('original');request.success();const db=request.result;
   const c=await f.capture(),hold=f.s.getItem(KEY),epoch=f.s.getItem(EPOCH),before=f.calls.length;
   let foreignCalls=0;
   const changed=Reflect.defineProperty(db,'transaction',{configurable:true,writable:true,value(){foreignCalls++;return 'unfenced lookup';}});
   if(changed){assert.equal(db.transaction(['original'],'readwrite'),'unfenced lookup');Reflect.deleteProperty(db,'transaction');}
   await f.gate.inspectCapturedHold(c);
   assert.equal(changed,false,'own database shadow selected an unfenced transaction');
   assert.equal(foreignCalls,0);assert.throws(()=>db.transaction(['original'],'readwrite'));
   const own=Object.getOwnPropertyDescriptor(db,'transaction');assert(own);
   assert.equal(own.value,f.Database.prototype.transaction);assert.equal(own.writable,false);assert.equal(own.configurable,false);
   assert.equal(f.calls.length,before);assert.equal(f.s.getItem(KEY),hold);assert.equal(f.s.getItem(EPOCH),epoch);
  });
  await run('IMMUTABLE_NEW success delivery locks only transaction before app callback and preserves terminal ownership',async f=>{
   f.s.setItem('original','exact retained row');const names=['original'],options={durability:'strict'};
   const request=f.factory.open('original',2);let delivered,callbacks=0;
   request.addEventListener('success',()=>{
    callbacks++;delivered=request.result;
    assert.equal(Reflect.defineProperty(delivered,'transaction',{value(){throw Error('foreign');}}),false);
    delivered.applicationState='normal unrelated property';
   },{once:true});
   request.success();assert.equal(callbacks,1);assert.equal(delivered.applicationState,'normal unrelated property');
   const tx=delivered.transaction(names,'readwrite',options);
   assert.equal(f.calls.at(-1).receiver,delivered);assert.equal(f.calls.at(-1).args[0],names);assert.equal(f.calls.at(-1).args[2],options);
   let published=false;const pending=f.capture().then(c=>{published=true;return c;});await turn();assert.equal(published,false);
   tx.dispatchEvent(new Event('error',{bubbles:true,cancelable:true}));await turn();assert.equal(published,false);
   tx.complete();const c=await pending;assert.equal(c.native_authority,false);
   const epoch=f.s.getItem(EPOCH),before=f.calls.length;
   const read=delivered.transaction(names,'readonly',options);assert.equal(read.mode,'readonly');
   assert.equal(f.calls.at(-1).receiver,delivered);assert.equal(f.calls.at(-1).args[0],names);assert.equal(f.calls.at(-1).args[2],options);
   assert.throws(()=>delivered.transaction(names,'readwrite'));
   assert.equal(f.calls.length,before+1);assert.equal(f.s.getItem(EPOCH),epoch);assert.equal(f.s.getItem('original'),'exact retained row');
   await f.gate.inspectCapturedHold(c);
  });
  await run('IMMUTABLE_NEW upgrade delivery locks database before app callback and drains independent terminal tokens',async f=>{
   const request=f.factory.open('original',3);let callbacks=0;
   request.addEventListener('upgradeneeded',()=>{
    callbacks++;assert.equal(Reflect.defineProperty(request.result,'transaction',{value(){throw Error('foreign');}}),false);
   },{once:true});
   const upgrade=request.upgrade();assert.equal(callbacks,1);
   let published=false;const pending=f.capture().then(c=>{published=true;return c;});await turn();assert.equal(published,false);
   request.blocked();request.success();await turn();assert.equal(published,false);
   upgrade.complete();const c=await pending;assert.equal(c.native_authority,false);
   assert.throws(()=>request.result.transaction(['original'],'readwrite'));await f.gate.inspectCapturedHold(c);
  });
  return;
 }
 if(idbBeforeFenceOnly){
  await run('original pre-hold native writer must finish before capture publication',async f=>{
   const tx=f.db.transaction(['original'],'readwrite');let published=false;
   const pending=f.capture().then(c=>{published=true;return c;});
   // Actual original gate can finish a full capture while this transaction
   // has NOT reached complete/abort. This assertion is expected to fail on
   // the original product; retain its first failure, never call it fixed PASS.
   for(let n=0;n<30&&!published;n++)await turn();
   try{assert.equal(published,false,'pre-hold IDB transaction was not terminal, but capture published');}
   finally{tx.complete();await pending;}
  },{install:false});return;
 }
 await run('held new writers are refused before native invocation while readonly keeps receiver and args',async f=>{
  const c=await f.capture(),epoch=f.s.getItem(EPOCH),before=f.calls.length;
  for(const mode of ['readwrite','readwriteflush'])assert.throws(()=>f.db.transaction(['original'],mode));
  assert.throws(()=>f.factory.open('must-not-create'));assert.throws(()=>f.factory.deleteDatabase('original'));
  assert.equal(f.calls.length,before);
  const names=['original'],options={durability:'strict'},tx=f.db.transaction(names,'readonly',options);
  assert.equal(tx.mode,'readonly');assert.equal(f.calls.at(-1).receiver,f.db);assert.equal(f.calls.at(-1).args[0],names);assert.equal(f.calls.at(-1).args[2],options);
  assert.equal(f.s.getItem(EPOCH),epoch);assert.equal((await f.gate.inspectCapturedHold(c)).mutation_epoch,epoch);
 });
 await run('pre-hold transaction error is not terminal and complete drains before original epoch selection',async f=>{
  f.s.setItem('original','retained');const tx=f.db.transaction(['original'],'readwrite');assert.equal(f.s.getItem(EPOCH),'1');
  let published=false;const pending=f.capture().then(c=>{published=true;return c;});await turn();assert(f.s.getItem(KEY));assert.equal(published,false);
  tx.dispatchEvent(new Event('error',{bubbles:true,cancelable:true}));await turn();assert.equal(published,false);
  f.s.setItem('original','last pre-hold commit');tx.complete();const c=await pending;
  assert.equal(f.s.getItem('original'),'last pre-hold commit');assert.equal((await f.gate.inspectCapturedHold(c)).mutation_epoch,'3');
  const epoch=f.s.getItem(EPOCH);tx.complete();await turn();assert.equal(f.s.getItem(EPOCH),epoch);
 });
 await run('abort is terminal exactly once and an admitted callback can await its own transaction',async f=>{
  assert.equal(await f.gate.mutate(async()=>{const tx=f.db.transaction(['original'],'readwrite');f.gate.requireMutation();tx.abort();await turn();f.gate.requireMutation();return 'same callback';}),'same callback');
  assert.equal(f.s.getItem(EPOCH),'3');const c=await f.capture();assert.equal((await f.gate.inspectCapturedHold(c)).mutation_epoch,'4');
 });
 await run('blocked open waits for request success and separate upgrade transaction termination',async f=>{
  const request=f.factory.open('original',2),upgrade=request.upgrade();
  let published=false;const pending=f.capture().then(c=>{published=true;return c;});await turn();request.blocked();await turn();assert.equal(published,false);
  request.success();await turn();assert.equal(published,false,'request event cannot retire an independent upgrade token');
  upgrade.complete();const c=await pending;assert.equal((await f.gate.inspectCapturedHold(c)).mutation_epoch,f.s.getItem(EPOCH));
 });
 await run('upgrade appearing after durable hold is aborted before application callback and request error drains',async f=>{
  const request=f.factory.open('raced',1);let called=0;const caller=()=>called++;request.addEventListener('upgradeneeded',caller,{once:true});
  const pending=f.capture();await turn();assert(f.s.getItem(KEY));const upgrade=request.upgrade();
  assert.equal(upgrade.aborted,1);assert.equal(called,0);await turn();
  request.removeEventListener('upgradeneeded',caller);
  request.error();const c=await pending;assert.equal(c.native_authority,false);assert(f.s.getItem(KEY));
 });
 await run('blocked delete is not terminal and stuck timeout preserves hold until actual later cleanup',async f=>{
  const request=f.factory.deleteDatabase('original');request.blocked();
  await assert.rejects(f.capture({timeoutMs:25}),e=>e.reason==='browser_idb_quiescence_timeout');
  const hold=f.s.getItem(KEY),epoch=f.s.getItem(EPOCH);assert(hold);assert(getEventListeners(request,'success').length>0);
  assert.throws(()=>f.factory.open('no successor'));request.success();await turn();
  assert.equal(getEventListeners(request,'success').length,0);assert.equal(f.s.getItem(KEY),hold);assert.equal(f.s.getItem(EPOCH),epoch);
 });
 await run('normal delete terminal error drains without treating blocked as success',async f=>{
  const request=f.factory.deleteDatabase('original');let done=false;const pending=f.capture().then(c=>{done=true;return c;});
  request.blocked();await turn();assert.equal(done,false);request.error();const c=await pending;assert.equal(c.native_authority,false);assert.equal(f.s.getItem(EPOCH),'3');
 });
 await run('descriptor withdrawal is irreversible and denied replacement retains original handle',async f=>{
  const c=await f.capture(),original=f.Database.prototype.transaction,hold=f.s.getItem(KEY);
  assert.throws(()=>{f.Database.prototype.transaction=function(){throw Error('foreign');};},TypeError);
  assert.equal(Reflect.defineProperty(f.Database.prototype,'transaction',{value(){throw Error('foreign');}}),false);
  assert.equal(f.Database.prototype.transaction,original);
  await f.gate.inspectCapturedHold(c);assert.equal(f.gate.held(),true);assert.equal(f.s.getItem(KEY),hold);
 });
 {
  const entered=deferred(),resume=deferred();let first=true;
  await run('factory replacement during actual digest await refuses capture and keeps original bytes',async f=>{
   f.s.setItem('original','exact original');const pending=f.capture();await entered.promise;
   Object.defineProperty(globalThis,'indexedDB',{configurable:true,writable:true,value:{}});resume.resolve();
   await assert.rejects(pending);assert.equal(f.s.getItem('original'),'exact original');
   Object.defineProperty(globalThis,'indexedDB',{configurable:true,writable:true,value:f.factory});assert.throws(()=>f.db.transaction(['original'],'readwrite'));
  },{cryptoApi:{subtle:{async digest(...args){if(first){first=false;entered.resolve();await resume.promise;}return webcrypto.subtle.digest(...args);}}}});
 }
 {
  const entered=deferred(),resume=deferred();let first=true;
  await run('epoch change across actual digest await refuses without adopting the successor',async f=>{
   const pending=f.capture();await entered.promise;const held=f.s.getItem(KEY);
   f.s.setItem(EPOCH,String(BigInt(f.s.getItem(EPOCH))+1n));resume.resolve();await assert.rejects(pending);
   assert.equal(f.s.getItem(KEY),held);assert.equal(f.gate.held(),true);
  },{cryptoApi:{subtle:{async digest(...args){if(first){first=false;entered.resolve();await resume.promise;}return webcrypto.subtle.digest(...args);}}}});
 }
 {
  const entered=deferred(),resume=deferred();let first=true;
  await run('pre-hold drain and digest share one original capture budget',async f=>{
   const tx=f.db.transaction(['original'],'readwrite'),pending=f.capture({timeoutMs:120});
   const denied=assert.rejects(pending);await new Promise(resolve=>setTimeout(resolve,35));tx.complete();await entered.promise;
   // A fresh 120ms inventory timeout after draining would incorrectly allow
   // this extra 95ms. Timers bound a fixture resource, not genuine clock proof.
   await new Promise(resolve=>setTimeout(resolve,95));resume.resolve();await denied;assert(f.s.getItem(KEY));
  },{cryptoApi:{subtle:{async digest(...args){if(first){first=false;entered.resolve();await resume.promise;}return webcrypto.subtle.digest(...args);}}}});
 }
 await run('unknown mode cannot execute payload coercion and missing hooks stay denial-only',async f=>{
  let coerced=0;const before=f.calls.length;assert.throws(()=>f.db.transaction(['original'],{toString(){coerced++;return 'readwrite';}}));
  assert.equal(coerced,0);assert.equal(f.calls.length,before);assert.equal(f.gate.held(),true);
 });
 await run('nonreplaceable intrinsic cannot claim installation or capture',async f=>{
  assert.throws(()=>f.gate.installIndexedDbWriteFence(),e=>e.reason==='browser_idb_hook_unavailable');
  await assert.rejects(f.capture());assert.equal(f.calls.length,0);assert.equal(f.s.getItem(KEY),null);
 },{install:false,unsupported:true});
 await run('missing request metadata cannot claim installation or capture',async f=>{
  assert.throws(()=>f.gate.installIndexedDbWriteFence(),e=>e.reason==='browser_idb_intrinsic_unavailable');
  await assert.rejects(f.capture());assert.equal(f.calls.length,0);assert.equal(f.s.getItem(KEY),null);
 },{install:false,unsupported:'missing'});
 await run('installation after a gate capture is refused and never clears its original hold',async f=>{
  await f.capture();const hold=f.s.getItem(KEY);
  assert.throws(()=>f.gate.installIndexedDbWriteFence(),e=>e.reason==='browser_idb_fence_late_installation');
  assert.equal(f.s.getItem(KEY),hold);assert.equal(f.gate.held(),true);
 },{install:false});
 await run('terminal epoch write uncertainty retains original data and removes event listeners',async f=>{
  f.s.setItem('original','keep');const tx=f.db.transaction(['original'],'readwrite'),pending=f.capture();await turn();
  const raw=f.s.setItem;f.s.setItem=(key,value)=>{if(key===EPOCH)throw Error('terminal stamp unknown');return raw(key,value);};tx.complete();
  await assert.rejects(pending);f.s.setItem=raw;assert.equal(f.s.getItem('original'),'keep');assert(f.s.getItem(KEY));assert.equal(f.gate.held(),true);
 });
 await run('script-dispatched transaction completion cannot impersonate a native terminal outcome',async f=>{
  const tx=f.db.transaction(['original'],'readwrite'),pending=f.capture();await turn();
  const denied=assert.rejects(pending);
  tx.dispatchEvent(new Event('complete'));await denied;assert(f.s.getItem(KEY));
 });
 console.log(JSON.stringify({scope:'new same-document IDB fence synthetic EventTarget cases only',document_start_mount:false,real_idb:false,other_realms:false,native_authority:false,acknowledged:false}));
}

await test('durable attempt distinguishes original bytes restored by successive writers',async()=>{
 const {s,options,gate}=fixture(),successor=createProtectedBrowserAdmission(options);
 await gate.mutate(()=>s.setItem('session:original','original bytes'));
 const before=await Inventory.observeProtectedBrowserWork(options);
 assert.equal(before.state,'OBSERVED_NOT_FROZEN');
 await successor.mutate(()=>s.setItem('session:original','changed bytes'));
 await successor.mutate(()=>s.setItem('session:original','original bytes'));
 const after=await Inventory.observeProtectedBrowserWork(options);
 assert.equal(after.state,'OBSERVED_NOT_FROZEN');assert.equal(s.getItem('session:original'),'original bytes');
 assert.notEqual(after.observation_sha256,before.observation_sha256,'restored bytes do not restore the earlier writer generation');
});
await test('durable attempt survives throwing work and a fresh original owner instance',async()=>{
 const {s,gate,options}=fixture();
 await assert.rejects(gate.mutate(()=>{s.setItem('session:original','unknown original effect');throw Error('result lost');}),/result lost/);
 assert.equal(s.getItem(EPOCH),'1');assert.equal(s.getItem('session:original'),'unknown original effect');
 const fresh=createProtectedBrowserAdmission(options);
 assert.equal(await fresh.mutate(()=>s.getItem('session:original')),'unknown original effect');assert.equal(s.getItem(EPOCH),'2');
});
await test('durable attempt must be confirmed before the original body callback',async()=>{
 for(const loss of ['before-write','after-write','false-readback']){
  const f=fixture(),write=f.s.setItem;let entered=0;
  f.s.setItem=(key,value)=>{if(key!==EPOCH)return write(key,value);
   if(loss==='before-write')throw Error('write refused');write(key,loss==='false-readback'?'9':value);
   if(loss==='after-write')throw Error('write result unknown');};
  await assert.rejects(f.gate.mutate(()=>{entered++;}),e=>e.code==='custodial_security_state_unavailable');
  assert.equal(entered,0);assert.equal(f.gate.held(),true);await assert.rejects(f.gate.mutate(()=>{entered++;}));assert.equal(entered,0);
 }
});
await test('durable attempt refuses malformed exhausted missing and regressed control without replacing it',async()=>{
 for(const raw of ['0','01','-1','1.0','NaN','9223372036854775808','9223372036854775807','{}']){
  const f=fixture();f.s.setItem(EPOCH,raw);let entered=false;
  await assert.rejects(f.gate.mutate(()=>{entered=true;}));assert.equal(entered,false);assert.equal(f.s.getItem(EPOCH),raw);
 }
 for(const replacement of [null,'1']){
  const f=fixture();await f.gate.mutate(()=>{});await f.gate.mutate(()=>{});
  if(replacement===null)f.s.rows.delete(EPOCH);else f.s.setItem(EPOCH,replacement);
  await assert.rejects(f.gate.mutate(()=>{throw Error('must not enter');}));assert.equal(f.s.getItem(EPOCH),replacement);
 }
});
await test('durable attempt change during an admitted await refuses success without compensation',async()=>{
 const f=fixture(),entered=deferred(),resume=deferred();
 const operation=f.gate.mutate(async()=>{f.s.setItem('session:original','retained');entered.resolve();await resume.promise;return true;});
 await entered.promise;f.s.setItem(EPOCH,'2');resume.resolve();
 await assert.rejects(operation,e=>e.code==='custodial_security_state_unavailable');
 assert.equal(f.s.getItem('session:original'),'retained');assert.equal(f.s.getItem(EPOCH),'2');
});
await test('durable attempt exact hold retry is read-only and a legacy hold is not silently rebound',async()=>{
 const f=fixture();await f.gate.holdAndObserve({operationId:ID});const epoch=f.s.getItem(EPOCH);
 const first=await f.gate.holdAndObserve({operationId:ID});assert.equal(f.s.getItem(EPOCH),epoch);
 const again=await f.gate.holdAndObserve({operationId:ID});assert.equal(again.observation.observation_sha256,first.observation.observation_sha256);
 const legacy=fixture();legacy.s.setItem(KEY,f.s.getItem(KEY));
 await assert.rejects(legacy.gate.holdAndObserve({operationId:ID}),e=>e.reason==='browser_mutation_epoch_missing');
 assert.equal(legacy.s.getItem(EPOCH),null);assert.equal(legacy.s.getItem(KEY),f.s.getItem(KEY));
});
await test('durable attempt firewall protects its control and latches regressions independently of ready cache',async()=>{
 class Area {
  constructor(){this.rows=new Map();}get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}
  getItem(k){return this.rows.get(k)??null;}setItem(k,v){this.rows.set(k,String(v));}removeItem(k){this.rows.delete(k);}clear(){this.rows.clear();}
 }
 const area=new Area(),raw=createRawStorageAdapter(area);
 raw.setItem(EPOCH,'2');raw.setItem('session:original','original');
 const firewall=installCustodialStorageFirewall({storage:area,getSecurityStatus:()=>({initialized:true,ready:true,available:true,quarantined:false})});
 assert.equal(firewall.blocked(),false);
 for(const effect of [()=>area.setItem(EPOCH,'1'),()=>area.removeItem(EPOCH),()=>area.clear()])
  assert.throws(effect,e=>e.code==='custodial_protected_state_read_only');
 assert.equal(raw.getItem(EPOCH),'2');assert.equal(raw.getItem('session:original'),'original');
 raw.setItem(EPOCH,'1');assert.equal(firewall.blocked(),true);
 raw.setItem(EPOCH,'2');assert.equal(firewall.blocked(),true,'restoring bytes cannot undo observed tamper');
 assert.throws(()=>area.setItem('session:original','must not overwrite'));
 assert.equal(raw.getItem('session:original'),'original');
});
await test('durable attempt forward peer events are not tamper but an ABA control event remains refused',async()=>{
 class Area {
  constructor(){this.rows=new Map();}get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}
  getItem(k){return this.rows.get(k)??null;}setItem(k,v){this.rows.set(k,String(v));}removeItem(k){this.rows.delete(k);}clear(){this.rows.clear();}
 }
 const area=new Area(),raw=createRawStorageAdapter(area),old=globalThis.addEventListener;let observe;
 raw.setItem(EPOCH,'1');
 try{
  globalThis.addEventListener=(name,fn)=>{assert.equal(name,'storage');observe=fn;};
  const firewall=installCustodialStorageFirewall({storage:area,getSecurityStatus:()=>({initialized:true,ready:true,available:true,quarantined:false})});
  assert.equal(firewall.blocked(),false);raw.setItem(EPOCH,'2');
  observe({storageArea:area,key:EPOCH,oldValue:'1',newValue:'2'});assert.equal(firewall.blocked(),false);
  raw.setItem(EPOCH,'3');assert.equal(firewall.blocked(),false);
  observe({storageArea:area,key:EPOCH,oldValue:'1',newValue:'2'});assert.equal(firewall.blocked(),false,'late monotonic peer event is not a regression');
  // Even if later valid bytes already returned, the actual event pair records
  // a regression. No forward event or cached ready state can clear that fact.
  raw.setItem(EPOCH,'4');observe({storageArea:area,key:EPOCH,oldValue:'3',newValue:'1'});
  assert.equal(firewall.blocked(),true);
  observe({storageArea:area,key:EPOCH,oldValue:'1',newValue:'4'});assert.equal(firewall.blocked(),true);
 }finally{if(old===undefined)delete globalThis.addEventListener;else globalThis.addEventListener=old;}
});
await test('durable attempt invalid metadata cannot be repaired by a later raw value in the same facade',async()=>{
 class Area {
  constructor(){this.rows=new Map();}get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}
  getItem(k){return this.rows.get(k)??null;}setItem(k,v){this.rows.set(k,String(v));}removeItem(k){this.rows.delete(k);}clear(){this.rows.clear();}
 }
 const area=new Area(),raw=createRawStorageAdapter(area);raw.setItem(EPOCH,'1');
 const firewall=installCustodialStorageFirewall({storage:area,getSecurityStatus:()=>({initialized:true,ready:true,available:true,quarantined:false})});
 assert.equal(firewall.blocked(),false);raw.setItem(EPOCH,'malformed original counter');assert.equal(firewall.blocked(),true);
 raw.setItem(EPOCH,'1');assert.equal(firewall.blocked(),true);assert.throws(()=>area.setItem('session:retained','must not enter'));
 assert.equal(raw.getItem('session:retained'),null);
});

await test('writer fence ready cache cannot authorize a protected write outside the original browser mutation',async()=>{
 class Area {
  constructor(){this.rows=new Map();}get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}
  getItem(k){return this.rows.get(k)??null;}setItem(k,v){this.rows.set(k,String(v));}removeItem(k){this.rows.delete(k);}clear(){this.rows.clear();}
 }
 const area=new Area(),raw=createRawStorageAdapter(area),l=locks();
 raw.setItem('session:original','retained original');
 const gate=createProtectedBrowserAdmission({storage:raw,locks:l,indexedDb:{databases:async()=>[]},cryptoApi:webcrypto});
 installCustodialStorageFirewall({storage:area,getSecurityStatus:()=>({initialized:true,ready:true,available:true}),
  requireProtectedWorkMutation:()=>gate.requireMutation()});
 assert.throws(()=>area.setItem('session:original','unguarded replacement'),error=>error.code==='custodial_protected_state_read_only');
 assert.equal(raw.getItem('session:original'),'retained original');
 await gate.mutate(async()=>{
  area.setItem('session:original','same admitted original');await Promise.resolve();
  area.setItem('session:original','accepted local value');
 });
 assert.equal(raw.getItem(EPOCH),'1');assert.equal(raw.getItem('session:original'),'accepted local value');
 assert.throws(()=>area.removeItem('session:original'),error=>error.code==='custodial_protected_state_read_only');
 await assert.rejects(gate.mutate(()=>{
  raw.setItem(EPOCH,'3');area.setItem('session:original','changed after original epoch');
 }));
 assert.equal(raw.getItem('session:original'),'accepted local value');
 // Missing private owner is not implied by a cached ready object.
 class OtherArea {
  constructor(){this.rows=new Map();}get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}
  getItem(k){return this.rows.get(k)??null;}setItem(k,v){this.rows.set(k,String(v));}removeItem(k){this.rows.delete(k);}clear(){this.rows.clear();}
 }
 const other=new OtherArea();
 installCustodialStorageFirewall({storage:other,getSecurityStatus:()=>({initialized:true,ready:true,available:true})});
 assert.throws(()=>other.setItem('session:unowned','must remain absent'));
 assert.equal(other.getItem('session:unowned'),null);
});

await test('ordinary mutations preserve return and original saved work before hold',async()=>{
 const {s,gate}=fixture();assert.equal(gate.held(),false);
 assert.equal(await gate.mutate(()=>{s.setItem('saved-draft','original');return 7;}),7);assert.equal(s.getItem('saved-draft'),'original');
});
await test('shared origin owner drains asynchronous writers before hold and refuses queued successors',async()=>{
 const {s,options,gate}=fixture(),other=createProtectedBrowserAdmission(options),started=deferred(),finish=deferred();
 const writing=gate.mutate(async()=>{started.resolve();await finish.promise;s.setItem('saved-draft','last admitted original');});
 await started.promise;
 const holding=other.holdAndObserve({operationId:ID}),later=gate.mutate(()=>s.setItem('saved-draft','must not replace'));
 const denied=reject(later,'custodial_browser_preservation_pending');assert.equal(s.getItem(KEY),null);
 finish.resolve();await writing;const result=await holding;await denied;
 closed(result);closed(result.observation);assert.equal(result.observation.state,'OBSERVED_NOT_FROZEN');
 assert.equal(result.observation.record_count,3);assert.equal(s.getItem(EPOCH),'2');assert.equal(s.getItem('saved-draft'),'last admitted original');
 assert.equal(gate.held(),true);assert.equal(other.held(),true);
});
await test('exact retry uses unchanged marker and digests; different operation cannot overwrite',async()=>{
 const {s,gate}=fixture();s.setItem('saved','untouched');const first=await gate.holdAndObserve({operationId:ID}),marker=s.getItem(KEY);
 const again=await gate.holdAndObserve({operationId:ID});assert.equal(s.getItem(KEY),marker);
 assert.equal(again.observation.observation_sha256,first.observation.observation_sha256);
 await reject(gate.holdAndObserve({operationId:OTHER}),'browser_hold_operation_conflict');assert.equal(s.getItem(KEY),marker);assert.equal(s.getItem('saved'),'untouched');
});
await test('new browser owner sees persisted marker and cannot admit work',async()=>{
 const {s,options,gate}=fixture();await gate.holdAndObserve({operationId:ID});const next=createProtectedBrowserAdmission(options);
 assert.equal(next.held(),true);await reject(next.mutate(()=>s.setItem('new','no')),'custodial_browser_preservation_pending');assert.equal(s.getItem('new'),null);
});
await test('malformed foreign marker remains in place and blocks every ordinary mutation',async()=>{
 const {s,gate}=fixture();s.setItem(KEY,'{malformed original');assert.equal(gate.held(),true);
 await reject(gate.mutate(()=>{}),'custodial_browser_preservation_pending');await reject(gate.holdAndObserve({operationId:ID}),'browser_hold_operation_conflict');assert.equal(s.getItem(KEY),'{malformed original');
});
await test('observed marker disappearance does not silently re-admit the same owner',async()=>{
 const {s,gate}=fixture();await gate.holdAndObserve({operationId:ID});s.rows.delete(KEY);
 assert.equal(gate.held(),true);await reject(gate.mutate(()=>{}),'browser_hold_missing_after_observation');
 await reject(gate.holdAndObserve({operationId:ID}),'browser_hold_missing_after_observation');
});
await test('write failure leaves conservative in-process denial and never inspects originals',async()=>{
 const {s,options}=fixture();s.setItem('saved','original');let inspected=0;options.indexedDb.databases=async()=>{inspected++;return [];};
 const gate=createProtectedBrowserAdmission({...options,storage:{...s,setItem(key,value){if(key===KEY)throw Error('quota');return s.setItem(key,value);}}});
 await reject(gate.holdAndObserve({operationId:ID}),'browser_hold_write_unconfirmed');assert.equal(gate.held(),true);
 await reject(gate.mutate(()=>{}),'browser_hold_missing_after_observation');assert.equal(inspected,0);assert.equal(s.getItem('saved'),'original');
});
await test('write that stores then throws preserves exact retry and saved bytes',async()=>{
 const {s,options}=fixture();const original=s.setItem;let throwing=true;s.setItem=(...args)=>{original(...args);if(throwing&&args[0]===KEY)throw Error('uncertain');};
 const gate=createProtectedBrowserAdmission(options);await reject(gate.holdAndObserve({operationId:ID}),'browser_hold_write_unconfirmed');
 const marker=s.getItem(KEY);assert.ok(marker);assert.equal(gate.held(),true);throwing=false;
 const retry=await gate.holdAndObserve({operationId:ID});closed(retry);assert.equal(s.getItem(KEY),marker);
});
await test('uninspectable database remains held UNKNOWN without empty inventory or native authority',async()=>{
 const {s,gate}=fixture({indexedDb:null});s.setItem('saved','original');const result=await gate.holdAndObserve({operationId:ID});closed(result);
 assert.equal(result.observation.state,'UNINSPECTABLE');assert.equal(result.observation.browser_inventory_state,'UNKNOWN');assert.equal(Object.hasOwn(result.observation,'record_count'),false);
 assert.equal(s.getItem('saved'),'original');assert.equal(gate.held(),true);
});
await test('no shared lock or malformed lock never runs mutation or creates hold',async()=>{
 for(const l of [null,{}, {request:async()=>undefined},{request:async(name,options,work)=>work(null)},{request:async(name,options,work)=>work({name:'foreign',mode:'exclusive'})}]){
  const {s,gate}=fixture({locks:l});let ran=false;await reject(gate.mutate(()=>{ran=true;}),'browser_shared_lock_unavailable');
  await reject(gate.holdAndObserve({operationId:ID}),'browser_shared_lock_unavailable');assert.equal(ran,false);assert.equal(s.getItem(KEY),null);
 }
});
await test('waiting timeout never steals the active writer lock or creates a hold',async()=>{
 const {s,gate}=fixture(),started=deferred(),finish=deferred();
 const writer=gate.mutate(async()=>{started.resolve();await finish.promise;s.setItem('saved','finished original');});await started.promise;
 await reject(gate.holdAndObserve({operationId:ID,timeoutMs:5}),'browser_shared_lock_timeout');assert.equal(s.getItem(KEY),null);
 finish.resolve();await writer;assert.equal(s.getItem('saved'),'finished original');await gate.holdAndObserve({operationId:ID});
});
await test('raw foreign hold arriving during async writer refuses success and retains result bytes',async()=>{
 const {s,gate}=fixture();await reject(gate.mutate(async()=>{s.setItem('saved','original');s.setItem(KEY,'foreign');}),'custodial_browser_preservation_pending');
 assert.equal(s.getItem('saved'),'original');assert.equal(s.getItem(KEY),'foreign');
});
await test('guard changed during hashing never returns a successful held observation',async()=>{
 const {s,options}=fixture();let changed=false;const cryptoApi={subtle:{async digest(...args){if(!changed){changed=true;s.setItem(KEY,'foreign');}return webcrypto.subtle.digest(...args);}}};
 const gate=createProtectedBrowserAdmission({...options,cryptoApi});await reject(gate.holdAndObserve({operationId:ID}),'browser_hold_changed_during_observation');assert.equal(s.getItem(KEY),'foreign');
});
await test('invalid identifiers and budgets do not write any state',async()=>{
 const {s,gate}=fixture();for(const operationId of [null,'',ID.toUpperCase(),{},'made-up']){
  // The all-numeric ID has no uppercase distinction; use a genuinely invalid string.
  if(operationId===ID)continue;await reject(gate.holdAndObserve({operationId}),'browser_hold_operation_invalid');
 }
 for(const timeoutMs of [0,-1,30001,Infinity,NaN,'5'])await reject(gate.holdAndObserve({operationId:ID,timeoutMs}),'browser_lock_budget_invalid');
 assert.equal(s.rows.size,0);
});
const originalArguments={p_device_id:'KIOSK_01',p_client_session_id:ID,p_client_completion_id:OTHER,
 p_native_finish_scan_entry_id:'33333333-3333-4333-8333-333333333333',p_response_json:{note:'exact original response'}};
function captureFixture({rows,dbOptions,...extra}={}){
 const actions=rows??[{key:1,value:{id:1,schema_version:6,type:'commit_workflow',operation_id:ID,payload:originalArguments}}];
 const db=idb({mz_scan_queue:{version:6,stores:{actions}},unknown_db:{stores:{records:[{key:'opaque',value:new Uint8Array([0,255,4])}]}}},dbOptions);
 const f=fixture({indexedDb:db,...extra});f.s.setItem('unknown-original','\ud800 preserved original {');return {...f,db};
}
const selection={deviceId:'KIOSK_01',clientSessionId:ID,clientCompletionId:OTHER};
await test('held-capture retains original completion and entire unknown census then closes without thaw',async()=>{
 const {s,l,db,gate}=captureFixture();let capture;
 try{
  capture=await gate.holdAndCapture({operationId:ID,lifetimeMs:1000});const marker=s.getItem(KEY);
  assert.equal(capture.state,'OBSERVED_NOT_FROZEN');closed(capture);
  assert(!JSON.stringify(capture).includes('exact original response'));assert(!JSON.stringify(capture).includes('preserved original'));
  const candidate=await inspectCapturedOriginalCompletion(capture,selection);
  assert.equal(candidate.state,'ONE_ORIGINAL_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED');assert.equal(candidate.source_authenticated,false);
  const bytes=await readCapturedOriginalCompletionArguments(capture,candidate);
  try{assert.deepEqual(JSON.parse(new TextDecoder().decode(bytes)),originalArguments);}finally{bytes.fill(0);}
  const census=await inspectCapturedOriginalCompletionCensus(capture);assert.equal(census.record_count,5);
  assert.equal(s.getItem(EPOCH),'1');assert.equal(census.unresolved_record_count,5);assert.equal(census.complete_namespace_inventory,false);
  assert(census.records.some(row=>row.state==='OTHER_DOMAIN_ROW_RETAINED_UNKNOWN'));
  const argumentsList=await readCapturedOriginalCompletionCensusArguments(capture,census);
  try{assert.equal(argumentsList.length,1);assert.deepEqual(JSON.parse(new TextDecoder().decode(argumentsList[0])),originalArguments);}
  finally{for(const bytes of argumentsList)bytes.fill(0);}
  closeCapturedProtectedBrowserWork(capture);
  await assert.rejects(inspectCapturedOriginalCompletionCensus(capture));await assert.rejects(readCapturedOriginalCompletionArguments(capture,candidate));
  assert.equal(s.getItem(KEY),marker);assert.equal(gate.held(),true);assert.equal(s.getItem('unknown-original'),'\ud800 preserved original {');
  await reject(gate.mutate(()=>s.setItem('unknown-original','must not change')),'custodial_browser_preservation_pending');
  assert.equal(db.state.opens,db.state.closes);assert(db.state.modes.every(mode=>mode==='readonly'));
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);await Promise.resolve();assert.equal(l.pending,0);}
});
await test('held-capture-negative original marker changes during capture refuse access and preserve all rows',async()=>{
 const f=captureFixture();let changed=false;
 const cryptoApi={subtle:{async digest(...args){if(!changed){changed=true;f.s.setItem(KEY,'foreign original marker');}return webcrypto.subtle.digest(...args);}}};
 const gate=createProtectedBrowserAdmission({...f.options,cryptoApi});
 await reject(gate.holdAndCapture({operationId:ID}),'browser_hold_changed_during_capture');
 assert.equal(f.s.getItem(KEY),'foreign original marker');assert.equal(f.s.getItem('unknown-original'),'\ud800 preserved original {');
 assert.equal(gate.held(),true);assert.equal(f.db.state.opens,f.db.state.closes);
});
await test('held-capture-negative changed missing malformed and unreadable guards cannot revive a retained capture',async()=>{
 for(const change of ['foreign','missing','malformed','unreadable']){
  const f=captureFixture();const capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000}),marker=f.s.getItem(KEY),get=f.s.getItem;
  try{
   if(change==='missing')f.s.rows.delete(KEY);
   else if(change==='unreadable')f.s.getItem=key=>{if(key===KEY)throw Error('ambiguous original guard');return get(key);};
   else f.s.setItem(KEY,change==='malformed'?'{malformed original':'foreign original');
   await assert.rejects(inspectCapturedOriginalCompletion(capture,selection));
   f.s.getItem=get;f.s.rows.set(KEY,marker); // A raw restoration is NOT recapture authority.
   await assert.rejects(inspectCapturedOriginalCompletionCensus(capture));
   assert.equal(f.s.getItem('unknown-original'),'\ud800 preserved original {');assert.equal(f.gate.held(),true);
  }finally{f.s.getItem=get;closeCapturedProtectedBrowserWork(capture);}
 }
});
await test('held-capture-negative every fixed read holds one shared lock and close during await denies late reads',async()=>{
 const f=captureFixture(),started=deferred(),finish=deferred();let armed=false;
 const originalList=f.db.databases;f.db.databases=async()=>{
  assert.equal(f.l.active,true,'capture/read must own same shared lock');
  if(armed){armed=false;started.resolve();await finish.promise;}return originalList();};
 const capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});
 try{
  armed=true;const inspecting=inspectCapturedOriginalCompletion(capture,selection);const denied=assert.rejects(inspecting);
  await started.promise;const census=inspectCapturedOriginalCompletionCensus(capture);const queuedDenied=assert.rejects(census);
  assert.equal(f.l.pending,1);closeCapturedProtectedBrowserWork(capture);assert.equal(f.l.active,true);
  finish.resolve();await denied;await queuedDenied;await new Promise(setImmediate);
  assert.equal(f.l.active,false);assert.equal(f.l.pending,0);assert.equal(f.s.getItem('unknown-original'),'\ud800 preserved original {');
  assert.equal(f.db.state.opens,f.db.state.closes);
 }finally{finish.resolve();closeCapturedProtectedBrowserWork(capture);}
});
await test('held-capture-negative late marker failure wipes fixed argument bytes rather than returning them',async()=>{
 for(const kind of ['candidate','census']){
  const f=captureFixture(),capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});
  const candidate=kind==='candidate'?await inspectCapturedOriginalCompletion(capture,selection):await inspectCapturedOriginalCompletionCensus(capture);
  const Encoder=globalThis.TextEncoder,get=f.s.getItem,buffers=[];let flip=false;
  try{
   globalThis.TextEncoder=class extends Encoder{encode(value){const bytes=super.encode(value);buffers.push(bytes);flip=true;return bytes;}};
   f.s.getItem=key=>{const value=get(key);if(key===KEY&&flip){flip=false;f.s.rows.set(KEY,'foreign after bytes');}return value;};
   await assert.rejects(kind==='candidate'?readCapturedOriginalCompletionArguments(capture,candidate):readCapturedOriginalCompletionCensusArguments(capture,candidate));
   assert(buffers.length>0);assert(buffers.every(bytes=>bytes.every(value=>value===0)),'late denied argument arrays must be wiped');
   assert.equal(get('unknown-original'),'\ud800 preserved original {');await assert.rejects(inspectCapturedOriginalCompletion(capture,selection));
  }finally{globalThis.TextEncoder=Encoder;f.s.getItem=get;closeCapturedProtectedBrowserWork(capture);}
 }
});
await test('held-capture-negative corrupt Unicode and non-JSON IDB originals remain unresolved not empty',async()=>{
 for(const note of ['\ud800',new Date('2026-10-12T10:00:00Z'),new Uint8Array([4,5]),undefined,-0,[,]]){
  const row={id:1,schema_version:6,type:'commit_workflow',operation_id:ID,payload:{...originalArguments,note}};
  const f=captureFixture({rows:[{key:1,value:row}]});let capture;
  try{
   capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});
   const candidate=await inspectCapturedOriginalCompletion(capture,selection);assert.equal(candidate.state,'UNINSPECTABLE_PRIMARY_ROWS_RETAINED');
   const census=await inspectCapturedOriginalCompletionCensus(capture);assert.equal(census.record_count,5);assert.equal(census.unresolved_record_count,5);
   assert.equal(census.argument_candidate_count,0);assert(census.records.some(item=>item.state==='UNINSPECTABLE_PRIMARY_ROW_RETAINED'));
   assert.equal(census.complete_namespace_inventory,false);assert.equal(f.db.definitions.mz_scan_queue.stores.actions[0].value,row);
  }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
 }
});
await test('held-capture-negative ambiguous original completions stay separate and cannot become accepted',async()=>{
 const rows=[1,2].map(id=>({key:id,value:{id,schema_version:6,type:'commit_workflow',operation_id:id===1?ID:OTHER,payload:originalArguments}}));
 const f=captureFixture({rows});let capture;
 try{
  capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});
  const candidate=await inspectCapturedOriginalCompletion(capture,selection);assert.equal(candidate.state,'AMBIGUOUS_ORIGINAL_ROWS_RETAINED');
  await assert.rejects(readCapturedOriginalCompletionArguments(capture,candidate)); // No fixed candidate capability was issued.
  assert.equal(f.db.definitions.mz_scan_queue.stores.actions.length,2);assert.equal(f.gate.held(),true);
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
});
await test('held-capture-negative lifetime expiry closes capture capabilities but never clears durable hold',async()=>{
 const f=captureFixture(),capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:8}),marker=f.s.getItem(KEY);
 try{
  await new Promise(resolve=>setTimeout(resolve,12));await assert.rejects(inspectCapturedOriginalCompletionCensus(capture));
  assert.equal(f.s.getItem(KEY),marker);assert.equal(f.s.getItem('unknown-original'),'\ud800 preserved original {');
  await reject(f.gate.mutate(()=>{}),'custodial_browser_preservation_pending');
 }finally{closeCapturedProtectedBrowserWork(capture);}
});
await test('held-capture-negative unavailable or timed-out inspection remains held without an empty capture',async()=>{
 for(const kind of ['missing-db','hung-digest']){
  const f=captureFixture(),finish=deferred();
  const options=kind==='missing-db'?{...f.options,indexedDb:null}:{...f.options,cryptoApi:{subtle:{digest:()=>finish.promise}}};
  const gate=createProtectedBrowserAdmission(options);
  try{
   await reject(gate.holdAndCapture({operationId:ID,timeoutMs:5}),'browser_capture_uninspectable');
   assert.equal(gate.held(),true);assert.equal(f.s.getItem('unknown-original'),'\ud800 preserved original {');
   assert.equal(f.db.state.opens,f.db.state.closes);
  }finally{finish.resolve(new ArrayBuffer(32));await new Promise(setImmediate);assert.equal(f.l.pending,0);assert.equal(f.l.active,false);}
 }
});
await test('held-capture-negative waiting lock timeout neither steals original writer nor creates capture hold',async()=>{
 const f=captureFixture(),started=deferred(),finish=deferred();
 const writer=f.gate.mutate(async()=>{started.resolve();await finish.promise;f.s.setItem('saved','original writer settled');});
 try{
  await started.promise;await reject(f.gate.holdAndCapture({operationId:ID,timeoutMs:5}),'browser_shared_lock_timeout');
  assert.equal(f.s.getItem(KEY),null);assert.equal(f.l.active,true);
 }finally{finish.resolve();await writer;await new Promise(setImmediate);assert.equal(f.s.getItem('saved'),'original writer settled');assert.equal(f.l.active,false);}
});
await test('held-capture-negative retained capability cannot be cloned replaced or used by foreign operation',async()=>{
 const f=captureFixture(),capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000}),marker=f.s.getItem(KEY);
 try{
  await reject(f.gate.holdAndCapture({operationId:ID}),'browser_capture_already_retained');
  const foreign=createProtectedBrowserAdmission(f.options);await reject(foreign.holdAndCapture({operationId:OTHER}),'browser_hold_operation_conflict');
  await assert.rejects(inspectCapturedOriginalCompletionCensus(structuredClone(capture)));
  assert.equal(f.s.getItem(KEY),marker);assert.equal(f.gate.held(),true);
 }finally{closeCapturedProtectedBrowserWork(capture);}
});
await test('held-capture-budget invalid new lifetimes cannot persist a marker or retain a capability',async()=>{
 const f=captureFixture();
 for(const lifetimeMs of [0,-1,30001,Infinity,NaN,'5',null,{}])
  await reject(f.gate.holdAndCapture({operationId:ID,lifetimeMs}),'browser_capture_lifetime_invalid');
 assert.equal(f.s.getItem(KEY),null);assert.equal(f.db.state.opens,0);assert.equal(f.l.active,false);
 assert.equal(f.s.getItem('unknown-original'),'\ud800 preserved original {');
});
await test('held-capture-budget later read timeout revokes only capability and never steals another active lock',async()=>{
 const f=captureFixture(),capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000}),marker=f.s.getItem(KEY),started=deferred(),finish=deferred();
 const lockOwner=f.l.request(LOCK,{mode:'exclusive',signal:new AbortController().signal},async()=>{started.resolve();await finish.promise;});
 try{
  await started.promise;await reject(inspectCapturedOriginalCompletionCensus(capture,{timeoutMs:5}),'browser_shared_lock_timeout');
  assert.equal(f.l.active,true);assert.equal(f.s.getItem(KEY),marker);assert.equal(f.gate.held(),true);
  await assert.rejects(inspectCapturedOriginalCompletion(capture,selection));
 }finally{finish.resolve();await lockOwner;closeCapturedProtectedBrowserWork(capture);await new Promise(setImmediate);assert.equal(f.l.active,false);assert.equal(f.l.pending,0);}
});
const feedbackKey='mz_employee_feedback_outbox:KIOSK_01:'+OTHER;
const feedbackSelector={deviceId:'KIOSK_01',employeeId:ID,credentialId:'44444444-4444-4444-8444-444444444444',assignmentEpoch:'7',operationId:OTHER};
const feedbackRow=()=>({schema_version:'employee-feedback-outbox.v2',created_at:'2026-10-12T18:00:00.123Z',body:{
 operation_id:OTHER,category:'app_problem',priority:'normal',message:'Exact original Feedback — α',submitted_by:'Synthetic saved employee',
 hub_context:'employee',device_id:'KIOSK_01',page_url:'employee-feedback.html',page_title:'Feedback',expected_employee_id:ID,
 expected_credential_id:feedbackSelector.credentialId,expected_assignment_epoch:'7'}});
function feedbackFixture(raw=JSON.stringify(feedbackRow())){const f=captureFixture();f.s.setItem(feedbackKey,raw);
 f.s.setItem('mz_chatscope_outbox:msg:'+ID,JSON.stringify({schema_version:'chatscope-message-outbox.v2',id:'msg:'+ID,
  user_id:ID,device_id:'KIOSK_01',thread_id:OTHER,body:'Unpinned original Messenger',memphis:false,created_at:1,security_generation:3}));
 return f;}
await test('feedback-capture emits one fixed original saved row with full original pins and retains other domains UNKNOWN',async()=>{
 const f=feedbackFixture();let capture;
 try{
  capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});
  const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
  assert.equal(candidate.state,'ONE_ORIGINAL_FEEDBACK_CANDIDATE_NOT_AUTHENTICATED');
  assert.equal(candidate.source_authenticated,false);assert.equal(candidate.native_authority,false);assert.equal(candidate.work_accepted,false);
  assert.equal(candidate.original_credential_id,feedbackSelector.credentialId);assert.equal(candidate.original_assignment_epoch,'7');
  assert.equal(candidate.original_created_at,feedbackRow().created_at);assert.equal(candidate.operation_id,OTHER);
  assert(!JSON.stringify(candidate).includes('Exact original Feedback'));assert(!JSON.stringify(candidate).includes('Unpinned original Messenger'));
  const bytes=await Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate);
  try{
   assert.equal(new TextDecoder().decode(bytes),f.s.getItem(feedbackKey));
   assert.deepEqual(JSON.parse(new TextDecoder().decode(bytes)),feedbackRow());
   const hash=[...new Uint8Array(await webcrypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
   assert.equal(hash,candidate.raw_original_utf8_sha256);
  }finally{bytes.fill(0);}
  const census=await inspectCapturedOriginalCompletionCensus(capture);assert.equal(census.record_count,7);assert.equal(census.unresolved_record_count,7);
  assert.equal(census.complete_namespace_inventory,false);assert(f.s.getItem('mz_chatscope_outbox:msg:'+ID).includes('Unpinned original Messenger'));
  closeCapturedProtectedBrowserWork(capture);await assert.rejects(Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate));
  assert.equal(f.s.getItem(feedbackKey),JSON.stringify(feedbackRow()));assert.equal(f.gate.held(),true);
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
});
await test('feedback-negative legacy missing credential epoch actor and foreign pins stay preserved without a value capability',async()=>{
 const cases=[
  row=>{delete row.body.expected_credential_id;},row=>{delete row.body.expected_assignment_epoch;},row=>{delete row.body.expected_employee_id;},
  row=>{row.body.expected_credential_id=OTHER;},row=>{row.body.expected_employee_id=OTHER;},row=>{row.body.expected_assignment_epoch='8';},
  row=>{row.body.expected_assignment_epoch=7;},row=>{row.body.expected_assignment_epoch='07';},row=>{row.body.expected_assignment_epoch='9007199254740992';},
  row=>{row.body.device_id='KIOSK_02';},row=>{row.body.hub_context='manager';}
 ];
 for(const change of cases){const row=feedbackRow();change(row);const raw=JSON.stringify(row),f=feedbackFixture(raw);let capture;
  try{
   capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
   assert.match(candidate.state,/RETAINED_UNKNOWN/);assert.equal(candidate.source_authenticated,false);
   await assert.rejects(Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate));assert.equal(f.s.getItem(feedbackKey),raw);assert.equal(f.gate.held(),true);
  }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
 }
});
await test('feedback-negative malformed duplicate-key unknown fields and Unicode originals are UNKNOWN not normalized',async()=>{
 const row=feedbackRow(),raw=JSON.stringify(row);const badRows=[
  '{ original malformed',JSON.stringify([]),JSON.stringify({...row,schema_version:'employee-feedback-outbox.v1'}),
  JSON.stringify({...row,created_at:'2026-10-12T24:00:00.000Z'}),JSON.stringify({...row,created_at:'2026-02-30T12:00:00.000Z'}),
  JSON.stringify({...row,unknown_private_field:'never emitted'}),JSON.stringify({...row,body:{...row.body,message:'\ud800'}}),
  JSON.stringify({...row,body:{...row.body,role:'manager',accepted:true}}),JSON.stringify({...row,body:{...row.body,message:{raw:'not a string'}}}),
  raw.replace('"priority":"normal"','"priority":"high","priority":"normal"'),JSON.stringify(row,null,2),
  JSON.stringify({...row,body:{...row.body,body:'ambiguous alias'}})
 ];
 for(const original of badRows){const f=feedbackFixture(original);let capture;
  try{
   capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
   assert.match(candidate.state,/UNKNOWN/);assert(!JSON.stringify(candidate).includes('never emitted'));
   assert.equal(f.s.getItem(feedbackKey),original);await assert.rejects(Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate));
  }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
 }
});
await test('feedback-negative exact source-key aliases cannot hide ambiguous target rows',async()=>{
 const f=feedbackFixture();f.s.setItem(feedbackKey+':copy',JSON.stringify(feedbackRow()));let capture;
 try{
  capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
  assert.equal(candidate.state,'UNINSPECTABLE_OR_FOREIGN_FEEDBACK_TARGET_RETAINED_UNKNOWN');assert.equal(candidate.feedback_row_count,2);
  assert.equal(candidate.unresolved_feedback_rows,2);assert.equal(f.s.getItem(feedbackKey+':copy'),JSON.stringify(feedbackRow()));
  await assert.rejects(Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate));
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
});
await test('feedback-negative closed image shape preserves exact photo bytes and refuses unknown malformed images',async()=>{
 const original=feedbackRow();original.body.image_attachment={name:'original.png',type:'image/png',data_url:'data:image/png;base64,AQIDBA=='};
 const f=feedbackFixture(JSON.stringify(original));let capture;
 try{
  capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
  const bytes=await Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate);
  try{assert.equal(new TextDecoder().decode(bytes),JSON.stringify(original));}finally{bytes.fill(0);}
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
 for(const image_attachment of [null,[],{name:'n',type:'image/jpeg',data_url:'data:image/png;base64,AQID'},
  {name:'n',type:'image/png',data_url:'data:image/png;base64,AQID',credential:'unknown'},
  {name:'n',type:'image/png',data_url:'data:image/png;base64,<script>'}]){
  const raw=JSON.stringify({...feedbackRow(),body:{...feedbackRow().body,image_attachment}}),f=feedbackFixture(raw);let capture;
  try{
   capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
   assert.match(candidate.state,/UNKNOWN/);assert.equal(f.s.getItem(feedbackKey),raw);
  }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
 }
});
await test('feedback-tail stale original bytes cannot survive close or be rebound after raw restoration',async()=>{
 const f=feedbackFixture(),original=f.s.getItem(feedbackKey);let capture;
 try{
  capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
  f.s.setItem(feedbackKey,JSON.stringify({...feedbackRow(),body:{...feedbackRow().body,message:'foreign replacement'}}));
  await assert.rejects(Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate));assert(f.s.getItem(feedbackKey).includes('foreign replacement'));
  f.s.setItem(feedbackKey,original);await assert.rejects(Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate));
  assert.equal(f.gate.held(),true);
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
});
await test('feedback-tail Feedback capability is same-capture only and cannot be forged or used as completion',async()=>{
 for(const kind of ['clone','completion','foreign-parent']){
  const f=feedbackFixture(),other=feedbackFixture();let capture,foreign;
  try{
   capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
   if(kind==='clone')await assert.rejects(Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,structuredClone(candidate)));
   else if(kind==='completion')await assert.rejects(readCapturedOriginalCompletionArguments(capture,candidate));
   else{foreign=await other.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});await assert.rejects(Inventory.readCapturedOriginalEmployeeFeedbackRow(foreign,candidate));}
   assert.equal(f.s.getItem(feedbackKey),JSON.stringify(feedbackRow()));
  }finally{if(capture)closeCapturedProtectedBrowserWork(capture);if(foreign)closeCapturedProtectedBrowserWork(foreign);}
 }
});
await test('feedback-tail changed guard after fixed row allocation wipes bytes and leaves original pending',async()=>{
 const f=feedbackFixture(),Encoder=globalThis.TextEncoder,get=f.s.getItem,buffers=[];let capture,flip=false;
 try{
  capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
  globalThis.TextEncoder=class extends Encoder{encode(value){const bytes=super.encode(value);buffers.push(bytes);flip=true;return bytes;}};
  f.s.getItem=key=>{const value=get(key);if(key===KEY&&flip){flip=false;f.s.rows.set(KEY,'foreign after allocation');}return value;};
  await assert.rejects(Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate));
  assert(buffers.length>0);assert(buffers.every(bytes=>bytes.every(value=>value===0)));assert.equal(get(feedbackKey),JSON.stringify(feedbackRow()));
 }finally{globalThis.TextEncoder=Encoder;f.s.getItem=get;if(capture)closeCapturedProtectedBrowserWork(capture);}
});
await test('feedback-tail IDB shadow and unpinned Messenger never supply employee Feedback values',async()=>{
 const f=feedbackFixture();f.s.rows.delete(feedbackKey);
 f.db.definitions.unknown_db.stores.records.push({key:feedbackKey,value:feedbackRow()});let capture;
 try{
  capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
  assert.equal(candidate.state,'ORIGINAL_FEEDBACK_NOT_FOUND_UNKNOWN');assert.equal(candidate.feedback_row_count,0);
  await assert.rejects(Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate));
  assert.equal(f.db.definitions.unknown_db.stores.records.length,2);assert(f.s.getItem('mz_chatscope_outbox:msg:'+ID).includes('Unpinned original Messenger'));
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
});
await test('feedback-producer exact sealed Mail v2 saves actual original bytes consumed by held Feedback reader',async()=>{
 // Read-only owning producer proposal, not a copied serializer or actual auth.
 // Main's packet must integrate this producer/current-principal seam separately.
 const producerUrl=new URL('../test-fixtures/ci/legacy-feedback-producer/feedback-outbox.js',import.meta.url);
 const hash=()=>createHash('sha256').update(readFileSync(producerUrl)).digest('hex');
 const expectedHash='4f3908c66e29c262f3654bac104a622f05089828e473641f07f072fcb0b58dd3';assert.equal(hash(),expectedHash);
 const {createFeedbackOutbox}=await import(producerUrl.href),f=captureFixture();let capture;
 try{
  const body={operation_id:OTHER,message:'Actual source saved original',category:'app_problem',priority:'normal',page_url:'employee-feedback.html'};
  const outbox=createFeedbackOutbox({storage:f.s,online:()=>false,
   identity:async()=>({deviceId:'KIOSK_01',employeeId:ID,credentialId:feedbackSelector.credentialId,assignmentEpoch:7}),
   mutate:work=>f.gate.mutate(()=>work({deviceId:'KIOSK_01',generation:7,assertCurrent:()=>f.gate.requireAdmission()})),
   request:async()=>{throw Error('no request or delivery in SOURCE producer join');}});
  await outbox.save(body);const raw=f.s.getItem(feedbackKey);assert.equal(JSON.parse(raw).body.expected_assignment_epoch,'7');
  capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:1000});const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
  assert.equal(candidate.state,'ONE_ORIGINAL_FEEDBACK_CANDIDATE_NOT_AUTHENTICATED');assert.equal(candidate.source_authenticated,false);
  const bytes=await Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate);
  try{assert.equal(new TextDecoder().decode(bytes),raw);assert.equal(JSON.parse(raw).created_at,candidate.original_created_at);}
  finally{bytes.fill(0);}
  assert.equal(hash(),expectedHash);assert.equal(f.s.getItem(feedbackKey),raw);
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
});
await test('feedback-expiry bounded held lifetime revokes Feedback child and preserves exact saved row',async()=>{
 const f=feedbackFixture();let capture;
 try{
  capture=await f.gate.holdAndCapture({operationId:ID,lifetimeMs:100});const marker=f.s.getItem(KEY);
  const candidate=await Inventory.inspectCapturedOriginalEmployeeFeedback(capture,feedbackSelector);
  await new Promise(resolve=>setTimeout(resolve,120));
  await assert.rejects(Inventory.readCapturedOriginalEmployeeFeedbackRow(capture,candidate));
  assert.equal(f.s.getItem(feedbackKey),JSON.stringify(feedbackRow()));assert.equal(f.s.getItem(KEY),marker);assert.equal(f.gate.held(),true);
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
});
await test('HOLD_FENCE_NEW original owned hold observation is exact read-only metadata',async()=>{
 const f=fixture({sessionStorage:storage()});let capture;
 try{
  capture=await f.gate.holdAndCapture({operationId:ID});
  const before=JSON.stringify([...f.s.rows]);let writes=0;
  f.s.setItem=()=>{writes++;throw Error('hold observation cannot write');};
  const first=await f.gate.inspectCapturedHold(capture),second=await f.gate.inspectCapturedHold(capture);
  assert.deepEqual(first,second);assert.notEqual(first,second);assert(Object.isFrozen(first));
  assert.deepEqual(first,{schema:'custodial.browser-captured-hold-observation.v1',operation_id:ID,
   mutation_epoch:'1',hold_marker_utf8:f.s.getItem(KEY),native_authority:false});
  assert.equal(JSON.stringify([...f.s.rows]),before);assert.equal(writes,0);
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
 await assert.rejects(f.gate.inspectCapturedHold(capture));assert(f.gate.held());
});
await test('HOLD_FENCE_NEW foreign copied and closed capture never select an owner',async()=>{
 const a=fixture({sessionStorage:storage()}),b=fixture({sessionStorage:storage()});let first,other;
 try{
  first=await a.gate.holdAndCapture({operationId:ID});other=await b.gate.holdAndCapture({operationId:OTHER});
  const saved=JSON.stringify([...a.s.rows]);
  for(const wrong of [null,{},Object.freeze({...first}),other])await assert.rejects(a.gate.inspectCapturedHold(wrong));
  assert.equal(JSON.stringify([...a.s.rows]),saved);
  closeCapturedProtectedBrowserWork(first);await assert.rejects(a.gate.inspectCapturedHold(first));
 }finally{if(first)closeCapturedProtectedBrowserWork(first);if(other)closeCapturedProtectedBrowserWork(other);}
});
await test('HOLD_FENCE_NEW changed epoch marker or close during queued read retains originals',async()=>{
 for(const change of ['epoch','marker','closed']){
  const f=fixture({sessionStorage:storage()});f.s.rows.set('session:original','keep original');let capture;
  try{
   capture=await f.gate.holdAndCapture({operationId:ID});
   const waiting=deferred(),release=deferred();
   const prior=f.l.request(LOCK,{mode:'exclusive',signal:new AbortController().signal},async()=>{waiting.resolve();await release.promise;});
   await waiting.promise;
   const pending=f.gate.inspectCapturedHold(capture);pending.catch(()=>{});
   if(change==='epoch')f.s.rows.set(EPOCH,'2');
   else if(change==='marker')f.s.rows.set(KEY,'foreign');
   else closeCapturedProtectedBrowserWork(capture);
   release.resolve();await prior;await assert.rejects(pending);
   assert.equal(f.s.getItem('session:original'),'keep original');
  }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
 }
});
await test('EXISTING_HOLD_NEW exact held capture is read-only and closes without thaw',async()=>{
 const f=fixture({sessionStorage:storage()});
 f.s.rows.set(KEY,JSON.stringify({schema:'custodial.browser-preservation-hold.v1',operation_id:ID,native_authority:false}));
 f.s.rows.set(EPOCH,'4');f.s.rows.set('session:original','exact original');
 const before=JSON.stringify([...f.s.rows]);let writes=0,capture;
 f.s.setItem=()=>{writes++;throw Error('Existing capture must not write');};
 try{
  capture=await f.gate.captureExistingHold({operationId:ID});
  assert.equal(capture.state,'OBSERVED_NOT_FROZEN');assert.equal(capture.native_authority,false);
  assert.equal(JSON.stringify([...f.s.rows]),before);assert.equal(writes,0);
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
 assert.equal(f.gate.held(),true);assert.equal(JSON.stringify([...f.s.rows]),before);
});
await test('EXISTING_HOLD_NEW missing foreign and uninspectable held state never creates a replacement',async()=>{
 for(const kind of ['missing','foreign','epoch-missing']){
  const f=fixture({sessionStorage:storage()});let writes=0;
  if(kind!=='missing')f.s.rows.set(KEY,JSON.stringify({schema:'custodial.browser-preservation-hold.v1',operation_id:kind==='foreign'?OTHER:ID,native_authority:false}));
  if(kind!=='epoch-missing')f.s.rows.set(EPOCH,'4');
  const before=JSON.stringify([...f.s.rows]);f.s.setItem=()=>{writes++;throw Error('Must not repair hold');};
  await assert.rejects(f.gate.captureExistingHold({operationId:ID}));
  await assert.rejects(f.gate.mutate(()=>{throw Error('Missing hold must not restore ordinary mutation');}));
  assert.equal(JSON.stringify([...f.s.rows]),before);assert.equal(writes,0);assert.equal(f.gate.held(),true);
 }
});
await test('EXISTING_HOLD_NEW capture refuses an epoch successor without adopting saved values',async()=>{
 const f=fixture({sessionStorage:storage()});f.s.rows.set(KEY,JSON.stringify({schema:'custodial.browser-preservation-hold.v1',operation_id:ID,native_authority:false}));
 f.s.rows.set(EPOCH,'4');f.s.rows.set('session:original','exact original');let capture;
 try{
  capture=await f.gate.captureExistingHold({operationId:ID});f.s.rows.set(EPOCH,'5');
  await assert.rejects(Inventory.inspectCapturedOriginalCompletionCensus(capture));
  assert.equal(f.s.getItem('session:original'),'exact original');assert.equal(f.s.getItem(EPOCH),'5');
 }finally{if(capture)closeCapturedProtectedBrowserWork(capture);}
});
if(nativeOriginalOnly)await nativeOriginalBrowserPreparationCases();
if(browserDataOnly)await nativeOriginalBrowserPreparationCases({dataOnly:true});
if(browserRealDataOnly)await nativeOriginalBrowserPreparationCases({realDataOnly:true});
assert.ok(passed>0,'selected owning browser-admission case must execute');
console.log(JSON.stringify({passed,failed:0,proof:'actual browser admission owner; synthetic Storage/Web Locks; writer mutation is runtime-mounted, capture/native/all-writer/crash/phone authority remains unqualified'}));

async function interactionPreferenceWriterCases(){
 const preference='mz_haptics_enabled',selected=process.argv.find(arg=>arg.startsWith('--preference-case='))?.split('=')[1];
 const source=readFileSync(new URL(shippingNativePreferenceOnly
   ? (process.argv.includes('--shipping-preference-old-source')?'../../baseline/mobile/src/shared/interaction-feedback.js':'../mobile/src/shared/interaction-feedback.js')
   :process.argv.includes('--preference-v1-source')
   ? '../../previous/memphis-interaction-feedback.js':process.argv.includes('--preference-old-source')
   ? '../../baseline/memphis-interaction-feedback.js':'../memphis-interaction-feedback.js',import.meta.url),'utf8');
 const run=async(name,body)=>{
  if(shippingNativePreferenceOnly!==name.startsWith('shipping-'))return;
  if(!selected||selected===name)await test((shippingNativePreferenceOnly?'SHIPPING_NATIVE_PREFERENCE_NEW ':'INTERACTION_PREFERENCE_NEW ')+name,body);
 };
 const plain=x=>JSON.parse(JSON.stringify(x));
 function setup({native=false}={}){
  class Area{
   constructor(){this.rows=new Map();}
   get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}
   getItem(k){if(this.readFailure)throw Error('SYNTHETIC_STORAGE_READ_FAILURE');return this.rows.get(k)??null;}
   setItem(k,v){
    if(k===preference){writes.push([k,String(v)]);if(this.writeFailure==='before')throw Error('SYNTHETIC_WRITE_DENIED');}
    this.rows.set(k,String(v));this.afterWrite?.(k);
    if(k===preference&&this.writeFailure==='after')throw Error('SYNTHETIC_WRITE_UNKNOWN');
   }
   removeItem(k){this.rows.delete(k);}clear(){this.rows.clear();}
  }
  const writes=[],s=new Area(),session=new Area(),l=locks(),jobs=[],events=[],vibrations=[];
  s.rows.set(preference,'0');s.rows.set('retained-original','{ original UNKNOWN bytes }');
  const w={localStorage:s,sessionStorage:session,indexedDB:{databases:async()=>[],open(){throw Error('no IDB writes');}},
    navigator:{locks:l,vibrate:p=>{vibrations.push(p);return true;}},crypto:webcrypto,
    matchMedia:()=>({matches:false}),addEventListener:(...args)=>events.push(['window',...args])};
  const status={ready:true,available:true,quarantined:false,state:'enrolled',deviceId:'KIOSK_08',generation:7,
    principal:{device_id:'KIOSK_08',employee_id:ID,credential_id:OTHER,assignment_epoch:2}};
  const security={native:true,getStatus:()=>plain(status),mutateProtectedWork:(operation,options)=>new Promise((resolve,reject)=>jobs.push({operation,options,resolve,reject}))};
  const mobile={edition:'custodial'};
  if(native){w.MemphisCustodialSecurity=security;w.MemphisMobile=mobile;}
  const document={addEventListener:(...args)=>events.push(['document',...args])};
  runInNewContext(source,{window:w,localStorage:s,sessionStorage:session,navigator:w.navigator,document,console},{
    filename:'memphis-interaction-feedback.js',importModuleDynamically:specifier=>import(new URL(shippingNativePreferenceOnly?'../mobile/src/shared/'+specifier:'../'+specifier,import.meta.url))});
  let afterCallback;
  async function flush(){
   while(jobs.length){
    const job=jobs.shift();let active=true;
    const context={deviceId:status.deviceId,generation:status.generation,state:status.state,
     assertCurrent(){if(!active)throw Error('CLOSED_RECORDING_OWNER');}};
    try{assert.equal(job.options.requireEnrollment,true);assert.equal(job.options.expectedGeneration,7);
     const result=await job.operation(context);afterCallback?.();job.resolve(result);
    }catch(error){job.reject(error);}finally{active=false;}
   }
   await Promise.resolve();
  }
  return {w,s,session,l,jobs,writes,events,vibrations,status,security,mobile,api:w.MemphisInteraction,flush,
   afterCallback:fn=>{afterCallback=fn;},gate:createProtectedBrowserAdmission({storage:s,sessionStorage:session,
    indexedDb:w.indexedDB,locks:l,cryptoApi:webcrypto})};
 }
 await run('shipping-native-refusal-is-terminal-before-effect',async()=>{
  const x=setup({native:true});let admissions=0;
  x.security.mutateProtectedWork=async()=>{admissions++;throw Error('SYNTHETIC_NATIVE_PRESERVATION_REFUSAL');};
  const result=await x.api.setHapticsEnabled(true);
  assert.equal(x.writes.length,0,'shipping PUBLIC setter must not write outside refused native owner');
  assert.equal(x.s.getItem(preference),'0');assert.equal(result,false);assert.equal(admissions,1);
  assert.equal(x.s.getItem('retained-original'),'{ original UNKNOWN bytes }');assert.equal(x.vibrations.length,0);
 });
 await run('shipping-native-allowed-write-is-single-and-settled',async()=>{
  const x=setup({native:true});let settled=false;
  const pending=x.api.setHapticsEnabled(true).then(value=>{settled=true;return value;});
  assert.equal(x.jobs.length,1);assert.equal(x.writes.length,0);assert.equal(settled,false);
  x.afterCallback(()=>{assert.equal(settled,false);assert.deepEqual(x.writes,[[preference,'1']]);});
  await x.flush();assert.equal(await pending,true);assert.equal(settled,true);assert.equal(x.jobs.length,0);
  assert.equal(x.s.getItem(preference),'1');assert.equal(x.vibrations.length,0);
 });
 await run('shipping-native-fifo-owner-and-original-substitution-refuse',async()=>{
  for(const change of ['employee','credential','epoch','state','device','generation','runtime','mobile','build','writer','reader','raw','storage-reader','storage-writer']){
   const x=setup({native:true}),pending=x.api.setHapticsEnabled(true);assert.equal(x.jobs.length,1);
   if(change==='employee')x.status.principal.employee_id=OTHER;
   if(change==='credential')x.status.principal.credential_id=ID;
   if(change==='epoch')x.status.principal.assignment_epoch++;
   if(change==='state')x.status.state='requested';
   if(change==='device')x.status.deviceId='KIOSK_09';
   if(change==='generation')x.status.generation++;
   if(change==='runtime')delete x.w.MemphisCustodialSecurity;
   if(change==='mobile')x.w.MemphisMobile={...x.mobile};
   if(change==='build')x.w.MemphisMobileBuildIdentity={edition:'custodial'};
   if(change==='writer')x.security.mutateProtectedWork=async()=>true;
   if(change==='reader')x.security.getStatus=()=>plain(x.status);
   if(change==='raw')x.s.rows.set(preference,'foreign exact preference');
   if(change==='storage-reader')x.s.getItem=function(k){return this.rows.get(k)??null;};
   if(change==='storage-writer')x.s.setItem=function(k,v){this.rows.set(k,String(v));};
   const original=x.s.rows.get(preference);await x.flush();assert.equal(await pending,false);
   assert.equal(x.s.rows.get(preference),original);assert.equal(x.writes.length,0);
  }
 });
 await run('shipping-native-missing-invalid-and-unreadable-refuse',async()=>{
  for(const change of ['owner','writer','status','bootstrap','principal','employee','credential','epoch','generation','quarantined','state']){
   const x=setup({native:true});
   if(change==='owner')delete x.w.MemphisCustodialSecurity;
   if(change==='writer')delete x.security.mutateProtectedWork;
   if(change==='status')x.security.getStatus=()=>{throw Error('UNREADABLE_NATIVE_STATUS');};
   if(change==='bootstrap')Object.defineProperty(x.w,'MemphisCustodialSecurity',{get(){throw Error('UNREADABLE_NATIVE_BOOTSTRAP');}});
   if(change==='principal')x.status.principal=null;
   if(change==='employee')delete x.status.principal.employee_id;
   if(change==='credential')delete x.status.principal.credential_id;
   if(change==='epoch')x.status.principal.assignment_epoch=0;
   if(change==='generation')x.status.generation=0;
   if(change==='quarantined')x.status.quarantined=true;
   if(change==='state')x.status.state='requested';
   assert.equal(await x.api.setHapticsEnabled(true),false);assert.equal(x.jobs.length,0);assert.equal(x.writes.length,0);
  }
 });
 await run('shipping-native-callback-checkpoint-and-one-shot-refuse',async()=>{
  for(const change of ['missing','device','generation','state','closed','duplicate']){
   const x=setup({native:true});let callbacks=0;
   x.security.mutateProtectedWork=async(operation,options)=>{
    assert.equal(options.requireEnrollment,true);assert.equal(options.expectedGeneration,7);
    const context={deviceId:'KIOSK_08',generation:7,state:'enrolled',assertCurrent(){if(change==='closed')throw Error('WITHDRAWN_NATIVE_CALLBACK');}};
    if(change==='missing')delete context.assertCurrent;
    if(change==='device')context.deviceId='KIOSK_09';
    if(change==='generation')context.generation=8;
    if(change==='state')context.state='requested';
    callbacks++;const value=operation(context);
    if(change==='duplicate'){callbacks++;operation(context);}
    return value;
   };
   if(change==='duplicate')x.s.rows.set(preference,'1'); // Same-value replay must still be rejected.
   assert.equal(await x.api.setHapticsEnabled(true),false);
   assert.equal(callbacks,change==='duplicate'?2:1);assert.equal(x.writes.length,change==='duplicate'?1:0);
   assert.equal(x.s.getItem(preference),change==='duplicate'?'1':'0');
  }
 });
 await run('shipping-native-unknown-result-never-retries-or-rolls-back',async()=>{
  for(const failure of ['before','after','foreign','settlement-throw','settlement-owner-loss','settlement-false']){
   const x=setup({native:true});
   if(failure==='before'||failure==='after')x.s.writeFailure=failure;
   if(failure==='foreign')x.s.afterWrite=k=>{if(k===preference)x.s.rows.set(k,'foreign successor');};
   if(failure==='settlement-throw')x.afterCallback(()=>{throw Error('UNKNOWN_NATIVE_SETTLEMENT');});
   if(failure==='settlement-owner-loss')x.afterCallback(()=>{x.status.generation++;});
   if(failure==='settlement-false')x.security.mutateProtectedWork=async operation=>{
    await operation({deviceId:'KIOSK_08',generation:7,state:'enrolled',assertCurrent(){}});return false;
   };
   const pending=x.api.setHapticsEnabled(true);await x.flush();assert.equal(await pending,false);
   assert.equal(x.writes.length,1);assert.equal(x.s.getItem(preference),failure==='before'?'0':failure==='foreign'?'foreign successor':'1');
   assert.equal(x.s.getItem('retained-original'),'{ original UNKNOWN bytes }');
  }
 });
 await run('shipping-native-loss-is-sticky-without-ignored-rejection',async()=>{
  const x=setup({native:true}),pending=x.api.setHapticsEnabled(true);assert.equal(x.jobs.length,1);
  x.w.MemphisCustodialSecurity={native:false};delete x.w.MemphisMobile;
  x.w.MemphisMobileBuildIdentity={edition:'manager'};
  await x.flush();assert.equal(await pending,false);assert.equal(await x.api.setHapticsEnabled(true),false);
  const unhandled=[],listener=error=>unhandled.push(error);process.on('unhandledRejection',listener);
  try{void x.api.setHapticsEnabled(true);await new Promise(setImmediate);assert.equal(unhandled.length,0);}
  finally{process.removeListener('unhandledRejection',listener);}
  assert.equal(x.writes.length,0);assert.equal(x.s.getItem(preference),'0');
 });
 await run('shipping-other-editions-use-real-admission-with-cues-unchanged',async()=>{
  for(const edition of ['manager','viewer']){
   const x=setup();x.w.MemphisMobileBuildIdentity={edition};x.w.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android'};
   x.w.MemphisCustodialSecurity={native:false};delete x.w.sessionStorage;delete x.w.indexedDB;delete x.w.crypto;
   assert.equal(await x.api.setHapticsEnabled(true),true);assert.deepEqual(x.writes,[[preference,'1']]);assert.equal(x.vibrations.length,0);
   assert.equal(x.events.length,2);assert.equal(x.events[0][1],'pointerdown');assert.equal(x.events[1][1],'memphis:feedback');
   x.w.matchMedia=()=>({matches:true});for(const method of ['selection','success','warning','error'])assert.equal(x.api[method](),false);
   assert.equal(x.vibrations.length,0);
   await x.gate.holdAndObserve({operationId:ID});assert.equal(await x.api.setHapticsEnabled(false),false);
   assert.equal(x.s.getItem(preference),'1');assert.equal(x.writes.length,1);assert.equal(x.l.active,false);
  }
 });
 await run('never-native-false-facade-persists',async()=>{
  const x=setup();x.w.MemphisCustodialSecurity={native:false};
  assert.equal(x.w.MemphisMobile,undefined);assert.equal(x.w.Capacitor,undefined);
  assert.equal(await x.api.setHapticsEnabled(true),true,'never-native false facade must retain ordinary web preference persistence');
  assert.deepEqual(x.writes,[[preference,'1']]);assert.equal(x.s.getItem(preference),'1');
  assert.equal(x.s.getItem('retained-original'),'{ original UNKNOWN bytes }');assert.equal(x.l.active,false);
  assert.equal(x.vibrations.length,0);
 });
 await run('minimal-web-resources-persist',async()=>{
  for(const unrelated of ['absent','unreadable','storage-methods-only']){
   const x=setup();
   for(const key of ['sessionStorage','indexedDB','crypto']){
    if(unrelated!=='unreadable')delete x.w[key];
    else Object.defineProperty(x.w,key,{get(){throw Error('UNRELATED_BROWSER_RESOURCE_MUST_NOT_BE_READ');}});
   }
   // This mutation does not enumerate inventory rows or acquire a cipher.
   if(unrelated==='storage-methods-only')delete Object.getPrototypeOf(x.s).key;
   else assert.equal(typeof Object.getPrototypeOf(x.s).key,'function');
   assert.equal(await x.api.setHapticsEnabled(true),true,'local preference mutation needs raw local storage and the shared lock only');
   assert.deepEqual(x.writes,[[preference,'1']]);assert.equal(x.s.getItem(preference),'1');
   assert.equal(x.s.getItem('retained-original'),'{ original UNKNOWN bytes }');assert.equal(x.l.active,false);
   assert.equal(x.vibrations.length,0);
  }
 });
 await run('false-facade-shared-hold-and-owner-withdrawal-refuse',async()=>{
  const held=setup();held.w.MemphisCustodialSecurity={native:false};
  await held.gate.holdAndObserve({operationId:ID});
  assert.equal(await held.api.setHapticsEnabled(true),false);assert.equal(held.s.getItem(preference),'0');assert.equal(held.writes.length,0);
  for(const change of ['locks','request','raw-reader','raw-writer','native','raw-preference']){
   const x=setup(),entered=deferred(),resume=deferred();x.w.MemphisCustodialSecurity={native:false};
   const prior=x.gate.mutate(async()=>{entered.resolve();await resume.promise;});await entered.promise;
   const pending=x.api.setHapticsEnabled(true);await new Promise(setImmediate);
   assert.equal(x.l.pending,1,'actual preference mutation must wait behind the original shared lock');
   if(change==='locks')x.w.navigator.locks=locks();
   if(change==='request')x.l.request=()=>{throw Error('REPLACED_LOCK_REQUEST');};
   if(change==='raw-reader')x.s.getItem=function(k){return this.rows.get(k)??null;};
   if(change==='raw-writer')x.s.setItem=function(k,v){this.rows.set(k,String(v));};
   if(change==='native')x.w.MemphisCustodialSecurity=x.security;
   if(change==='raw-preference')x.s.rows.set(preference,'foreign original');
   const original=x.s.rows.get(preference);resume.resolve();await prior;
   assert.equal(await pending,false);assert.equal(x.s.rows.get(preference),original);assert.equal(x.writes.length,0);
   assert.equal(x.l.active,false);
  }
 });
 await run('false-facade-never-clears-native-required-latch',async()=>{
  for(const marker of ['mobile','build','capacitor-native','capacitor-platform','unknown-facade','unreadable']){
   const x=setup();x.w.MemphisCustodialSecurity={native:false};
   if(marker==='mobile')x.w.MemphisMobile={edition:'custodial'};
   if(marker==='build')x.w.MemphisMobileBuildIdentity={edition:'custodial'};
   if(marker==='capacitor-native')x.w.Capacitor={isNativePlatform:()=>true};
   if(marker==='capacitor-platform')x.w.Capacitor={getPlatform:()=> 'android'};
   if(marker==='unknown-facade')x.w.MemphisCustodialSecurity={};
   if(marker==='unreadable')Object.defineProperty(x.w,'MemphisCustodialSecurity',{configurable:true,get(){throw Error('UNREADABLE_NATIVE_BOOTSTRAP');}});
   assert.equal(await x.api.setHapticsEnabled(true),false);
   delete x.w.MemphisCustodialSecurity;delete x.w.MemphisMobile;delete x.w.MemphisMobileBuildIdentity;delete x.w.Capacitor;
   x.w.MemphisCustodialSecurity={native:false};
   assert.equal(await x.api.setHapticsEnabled(true),false);assert.equal(x.writes.length,0);assert.equal(x.s.getItem(preference),'0');
  }
  const x=setup({native:true}),pending=x.api.setHapticsEnabled(true);assert.equal(x.jobs.length,1);
  x.w.MemphisCustodialSecurity={native:false};delete x.w.MemphisMobile;
  await x.flush();assert.equal(await pending,false);
  assert.equal(await x.api.setHapticsEnabled(true),false);assert.equal(x.writes.length,0);assert.equal(x.s.getItem(preference),'0');
 });
 await run('existing-hold-blocks-public-setter',async()=>{
  const x=setup();await x.gate.holdAndObserve({operationId:ID});const original=x.s.getItem(preference);
  await x.api.setHapticsEnabled(true);
  assert.equal(x.writes.length,0,'PUBLIC preference setter must not bypass the actual shared preservation hold');
  assert.equal(x.s.getItem(preference),original);assert.equal(x.s.getItem('retained-original'),'{ original UNKNOWN bytes }');
 });
 await run('web-allowed-exact-write-and-no-feedback-side-effect',async()=>{
  const x=setup();assert.equal(await x.api.setHapticsEnabled(true),true);
  assert.deepEqual(x.writes,[[preference,'1']]);assert.equal(x.s.getItem(preference),'1');
  assert.equal(x.s.getItem('retained-original'),'{ original UNKNOWN bytes }');assert.equal(x.l.active,false);
  assert.equal(x.vibrations.length,0);assert.equal(x.events.length,2);
  assert.equal(x.events[0][1],'pointerdown');assert.equal(x.events[1][1],'memphis:feedback');
 });
 await run('web-original-replacement-before-lock-is-retained',async()=>{
  const x=setup(),entered=deferred(),resume=deferred();
  const prior=x.gate.mutate(async()=>{entered.resolve();await resume.promise;});
  await entered.promise;const pending=x.api.setHapticsEnabled(true);
  x.s.rows.set(preference,'{ foreign original replacement }');resume.resolve();await prior;
  assert.equal(await pending,false);assert.equal(x.s.getItem(preference),'{ foreign original replacement }');
  assert.equal(x.writes.length,0);assert.equal(x.l.active,false);
 });
 await run('native-allowed-callback-settles-before-confirmation',async()=>{
  const x=setup({native:true});let settled=false;
  const pending=x.api.setHapticsEnabled(true).then(value=>{settled=true;return value;});
  assert.equal(x.jobs.length,1);assert.equal(x.writes.length,0);assert.equal(settled,false);
  await x.flush();assert.equal(await pending,true);assert.deepEqual(x.writes,[[preference,'1']]);
  assert.equal(x.vibrations.length,0);
 });
 await run('native-recipient-epoch-and-runtime-loss-never-fall-back',async()=>{
  for(const change of ['employee','credential','epoch','device','generation','runtime','mobile','writer','reader','raw']){
   const x=setup({native:true}),pending=x.api.setHapticsEnabled(true);assert.equal(x.jobs.length,1);
   if(change==='employee')x.status.principal.employee_id=OTHER;
   if(change==='credential')x.status.principal.credential_id=ID;
   if(change==='epoch')x.status.principal.assignment_epoch++;
   if(change==='device')x.status.deviceId='KIOSK_09';
   if(change==='generation')x.status.generation++;
   if(change==='runtime')delete x.w.MemphisCustodialSecurity;
   if(change==='mobile')x.w.MemphisMobile={...x.mobile};
   if(change==='writer')x.security.mutateProtectedWork=async()=>true;
   if(change==='reader')x.security.getStatus=()=>plain(x.status);
   if(change==='raw')x.s.rows.set(preference,'foreign original');
   const original=x.s.getItem(preference);await x.flush();assert.equal(await pending,false);
   assert.equal(x.s.getItem(preference),original);assert.equal(x.writes.length,0);
   if(change==='runtime'){assert.equal(await x.api.setHapticsEnabled(false),false);assert.equal(x.writes.length,0);}
  }
 });
 await run('native-missing-checkpoint-and-unreadable-bootstrap-refuse',async()=>{
  for(const change of ['missing','status','bootstrap','checkpoint']){
   const x=setup({native:true});
   if(change==='missing')delete x.security.mutateProtectedWork;
   if(change==='status')x.security.getStatus=()=>{throw Error('UNREADABLE_STATUS');};
   if(change==='bootstrap')Object.defineProperty(x.w,'MemphisCustodialSecurity',{get(){throw Error('UNREADABLE_BOOTSTRAP');}});
   if(change==='checkpoint')x.security.mutateProtectedWork=async operation=>operation({deviceId:'KIOSK_08',generation:7,state:'enrolled'});
   assert.equal(await x.api.setHapticsEnabled(true),false);assert.equal(x.writes.length,0);
  }
 });
 await run('uncertain-persistence-is-false-without-retry-or-rollback',async()=>{
  for(const native of [false,true])for(const failure of ['before','after','foreign','lost-owner-result']){
   const x=setup({native});if(failure==='before'||failure==='after')x.s.writeFailure=failure;
   if(failure==='foreign')x.s.afterWrite=k=>{if(k===preference)x.s.rows.set(k,'foreign successor');};
   if(failure==='lost-owner-result'){
    if(native)x.afterCallback(()=>{throw Error('UNCONFIRMED_NATIVE_RESULT');});
    else x.s.afterWrite=k=>{if(k===preference)x.s.rows.set(EPOCH,'999');};
   }
   const pending=x.api.setHapticsEnabled(true);if(native)await x.flush();
   assert.equal(await pending,false);assert.equal(x.writes.length,1);
   assert.equal(x.s.getItem(preference),failure==='before'?'0':failure==='foreign'?'foreign successor':'1');
   assert.equal(x.s.getItem('retained-original'),'{ original UNKNOWN bytes }');
  }
 });
 await run('storage-read-failure-is-disabled-and-ignored-setter-never-rejects',async()=>{
  const x=setup(),unhandled=[];const listener=error=>unhandled.push(error);
  process.on('unhandledRejection',listener);
  try{
   x.s.readFailure=true;assert.equal(x.api.hapticsEnabled(),false);assert.equal(x.api.selection(),false);
   assert.equal(await x.api.setHapticsEnabled(true),false);void x.api.setHapticsEnabled(false);
   await new Promise(setImmediate);assert.equal(unhandled.length,0);assert.equal(x.vibrations.length,0);assert.equal(x.writes.length,0);
  }finally{process.removeListener('unhandledRejection',listener);}
 });
 await run('installed-firewall-is-not-rebound-as-raw-web-admission',async()=>{
  const x=setup();installCustodialStorageFirewall({storage:x.s,getSecurityStatus:()=>({ready:true,available:true,initialized:true,quarantined:false})});
  assert.equal(await x.api.setHapticsEnabled(true),false);assert.equal(x.writes.length,0);assert.equal(x.s.getItem(preference),'0');
 });
}

async function nativeOriginalBrowserPreparationCases({dataOnly=false,realDataOnly=false}={}){
 const grant='a'.repeat(64),reply='b'.repeat(64),exchange='c'.repeat(64),phase=n=>n.toString(16).padStart(64,'0');
 const request=(command='CAPTURE',n=1,changes={})=>({schema:'custodial.native-original-browser-capture-request.v1',
  command,grant_token:grant,request_nonce:exchange,phase_nonce:phase(n),operation_id:ID,frame_sha256:'d'.repeat(64),
  original_generation_id:OTHER,native_mutation_stamp:'original native stamp / exact α',...changes});
 function platform({origin='https://localhost',mainframe=true,databases=true,locksAvailable=true,cryptoApi=webcrypto,dbOptions,
  dataApi=null,postSink=null,sourceUrl=null,idbWriterSurface=true,publicStorageSurface=false}={}){
  const f=captureFixture({dbOptions}),globals=['top','document','location','localStorage','sessionStorage','indexedDB','navigator','crypto',
   'custodialOriginalBrowserPreparation','addEventListener','removeEventListener','performance','setTimeout','clearTimeout',
   'IDBFactory','IDBDatabase','IDBRequest','IDBTransaction','Event',PROTECTED_BROWSER_DOCUMENT_WRITER_KEY];
  const saved=new Map(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const nativeSetTimeout=globalThis.setTimeout,nativeClearTimeout=globalThis.clearTimeout;
  const pageEvents=new Map(),nativeEvents=new Map(),posts=[],expiryTimers=new Map();let time=0;
  class Area{
   constructor(rows=new Map()){this.rows=rows;}get length(){return this.rows.size;}
   key(i){return [...this.rows.keys()][i]??null;}getItem(key){return this.rows.get(key)??null;}
   setItem(key,value){this.rows.set(key,String(value));}removeItem(key){this.rows.delete(key);}
  }
  const local=new Area(f.s.rows),session=new Area(new Map([['session-original','never remove']]));
  if(publicStorageSurface)Object.defineProperty(Area.prototype,'clear',{configurable:true,writable:true,
   value(){this.rows.clear();}});
  const document={},port={postMessage(text){assert.equal(this,port);posts.push(postSink?postSink(text):text);},
   addEventListener(name,fn){assert.equal(this,port);nativeEvents.set(name,fn);},
   removeEventListener(name,fn){assert.equal(this,port);if(nativeEvents.get(name)===fn)nativeEvents.delete(name);}};
  const set=(key,value)=>Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  set('top',mainframe?globalThis:{});set('document',document);
  set('location',{origin,protocol:origin.startsWith('https:')?'https:':'http:',hostname:'localhost',port:'',host:'localhost'});
  const idbCalls=[],idbTransactions=[],emitted=new WeakSet();
  const OriginalEvent=globalThis.Event;
  class DocumentEvent extends OriginalEvent{get isTrusted(){return emitted.has(this);}}
  const terminal=(object,name)=>{const e=new DocumentEvent(name);emitted.add(e);object.dispatchEvent(e);};
  class Transaction extends EventTarget{
   constructor(mode){super();this.originalMode=mode;idbTransactions.push(this);}
   get mode(){return this.originalMode;}
   complete(){terminal(this,'complete');}
   abort(){queueMicrotask(()=>terminal(this,'abort'));}
  }
  const deliveredDatabases=new WeakMap();
  class Request extends EventTarget{
   constructor(raw){super();this.raw=raw;}
   get transaction(){return this.raw.transaction??null;}
   get result(){
    const result=this.raw.result;
    if(!result||typeof result.transaction!=='function'||!result.objectStoreNames)return result;
    let database=deliveredDatabases.get(result);
    if(!database){database=new Database(result);deliveredDatabases.set(result,database);}
    return database;
   }
   get error(){return this.raw.error;}
  }
  class Database{
   constructor(raw=null){this.raw=raw;}
   get objectStoreNames(){return this.raw?.objectStoreNames;}
   get name(){return this.raw?.name;}
   get version(){return this.raw?.version;}
   close(){return this.raw?.close();}
   transaction(names,mode='readonly',...rest){
    idbCalls.push({names,mode,rest});
    return this.raw?this.raw.transaction(names,mode,...rest):new Transaction(mode);
   }
  }
  class Factory{
   databases(){return f.db.databases();}
   open(...args){
    const raw=f.db.open(...args),request=new Request(raw);
    for(const name of ['success','error','blocked','upgradeneeded'])raw['on'+name]=()=>{
     const event=new DocumentEvent(name);emitted.add(event);request.dispatchEvent(event);request['on'+name]?.call(request,event);
    };
    return request;
   }
   deleteDatabase(){assert.fail('denied app delete reached native fixture');}
  }
  const idbFactory=new Factory(),idbDatabase=new Database();
  set('localStorage',local);set('sessionStorage',session);set('indexedDB',databases?(idbWriterSurface?idbFactory:f.db):null);
  if(idbWriterSurface)for(const [key,value]of Object.entries({IDBFactory:Factory,IDBDatabase:Database,
   IDBRequest:Request,IDBTransaction:Transaction,Event:DocumentEvent}))set(key,value);
  set('navigator',{locks:locksAvailable?f.l:null});set('crypto',cryptoApi);set('custodialOriginalBrowserPreparation',port);
  set('addEventListener',(name,fn)=>pageEvents.set(name,fn));
  set('removeEventListener',(name,fn)=>{if(pageEvents.get(name)===fn)pageEvents.delete(name);});
  // The sealed real codec pins original platform intrinsics. Keep its genuine
  // performance object unchanged; expiry still closes through the owned timer.
  if(!realDataOnly)set('performance',{now:()=>time});
  set('setTimeout',(fn,ms)=>{if(ms===30000){const handle={};expiryTimers.set(handle,fn);return handle;}return nativeSetTimeout(fn,ms);});
  set('clearTimeout',handle=>{if(!expiryTimers.delete(handle))nativeClearTimeout(handle);});
  const install=()=>{
   let installer=installNativeOriginalBrowserPreparation;
   if(existingHeldBundle&&!dataOnly){
    const module={exports:{}};
    installer=runInThisContext('(function(module,exports){'+readFileSync(existingHeldBundle,'utf8')+
     '\nreturn module.exports.installNativeOriginalBrowserPreparation;})',{filename:'actual-isolated-native-browser-cjs-asset'})(module,module.exports);
    assert.equal(typeof installer,'function');
   }
   if(dataOnly){
    const source=readFileSync(sourceUrl||new URL('../mobile/src/custodial/native-original-browser-preparation.js',import.meta.url),'utf8')
     .replace(/^import [\s\S]*?from '\.\/protected-browser-admission\.js';\n/,'')
     .replace(/^import [\s\S]*?from '\.\/storage-firewall\.js';\n/,'')
     .replace(/^import [\s\S]*?from '\.\/protected-browser-inventory\.js';\n/,'')
     .replace('export function installNativeOriginalBrowserPreparation','function installNativeOriginalBrowserPreparation');
    installer=runInThisContext('(function(createProtectedBrowserAdmission,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,createRawStorageAdapter,'+
     'inspectCapturedOriginalCompletionCensus,readCapturedOriginalCompletionCensusArguments,'+
     'inspectCapturedOriginalBrowserValueFrame,readCapturedOriginalBrowserValueChunk,closeCapturedProtectedBrowserWork){'+
     source+'\nreturn installNativeOriginalBrowserPreparation;})',{filename:'actual-DATA-consumer-source.vm.js'})(
      createProtectedBrowserAdmission,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,createRawStorageAdapter,inspectCapturedOriginalCompletionCensus,
      readCapturedOriginalCompletionCensusArguments,dataApi.inspect,dataApi.read,closeCapturedProtectedBrowserWork);
   }
   return installer({grantToken:grant,replyToken:reply});
  };
  const emit=value=>nativeEvents.get('message')?.({data:typeof value==='string'?value:JSON.stringify(value)});
  const messagePosts=()=>posts.map(text=>JSON.parse(text)).filter(row=>row.schema.endsWith('capture-response.v1'));
  const wait=async(count=1)=>{for(let i=0;i<1000&&messagePosts().length<count;i++)
   await new Promise(dataOnly||realDataOnly?resolve=>nativeSetTimeout(resolve,1):setImmediate);
   assert.equal(messagePosts().length,count,'bounded fixture expected native source response');return messagePosts()[count-1];};
  const dataPosts=()=>posts.map(text=>JSON.parse(text)).filter(row=>row.schema.endsWith('data-response.v1'));
  const waitData=async(count=1)=>{for(let i=0;i<1000&&dataPosts().length<count;i++)await new Promise(resolve=>nativeSetTimeout(resolve,1));
   assert.equal(dataPosts().length,count,'bounded fixture expected DATA source response');return dataPosts()[count-1];};
  const holdPosts=()=>posts.map(text=>JSON.parse(text)).filter(row=>row.schema.endsWith('hold-fence-response.v1'));
  const waitHold=async(count=1)=>{for(let i=0;i<1000&&holdPosts().length<count;i++)await new Promise(resolve=>nativeSetTimeout(resolve,1));
   assert.equal(holdPosts().length,count,'bounded fixture expected held-fence source response');return holdPosts()[count-1];};
  const cleanup=async({terminalProcess=false}={})=>{
   pageEvents.get('pagehide')?.();for(const fn of [...expiryTimers.values()])fn();
   for(const tx of idbTransactions)tx.complete();
   try{
    for(let i=0;i<10000&&(f.l.active||f.l.pending);i++)await new Promise(setImmediate);
    assert.equal(expiryTimers.size,0);assert.equal(f.l.pending,0);assert.equal(f.l.active,false);
    assert.equal(f.db.state.opens,f.db.state.closes);
   }finally{for(const [key,descriptor]of saved){
    // The actual security runtime intentionally makes Storage facades
    // nonreplaceable. Only the single-case terminal Node process may keep
    // those until process exit; never relax the production firewall to clean.
    if(terminalProcess&&Object.getOwnPropertyDescriptor(globalThis,key)?.configurable===false)continue;
    if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
   }}
  };
  return{...f,local,session,document,port,posts,pageEvents,nativeEvents,install,emit,wait,messagePosts,dataPosts,waitData,holdPosts,waitHold,cleanup,
   idbDatabase,idbFactory,idbCalls,Database,
   expire(){time=30001;for(const fn of [...expiryTimers.values()])fn();},hide(){pageEvents.get('pagehide')?.();}};
 }
 if(dataOnly){await browserOriginalDataCases({platform,request,phase,reply});return;}
 if(realDataOnly){await browserOriginalRealDataCases({platform,request,phase,reply});return;}
 const selected=process.argv.find(value=>value.startsWith('--native-original-browser-case='))?.slice('--native-original-browser-case='.length);
 const testNew=(name,fn)=>selected&&!name.includes(selected)?Promise.resolve():test('NATIVE_ORIGINAL_BROWSER_NEW '+name,fn);
 await testNew('existing held command matches its exact request then rechecks without writes',async()=>{
  const p=platform();try{
   p.local.rows.set(KEY,JSON.stringify({schema:'custodial.browser-preservation-hold.v1',operation_id:ID,native_authority:false}));
   p.local.rows.set(EPOCH,'4');const before=JSON.stringify([...p.local.rows]);
   p.local.setItem=()=>{throw Error('Existing held source must not write');};
   p.install();p.emit(request('CAPTURE_EXISTING_HELD'));const result=await p.wait();
   assert.equal(result.command,'CAPTURE_EXISTING_HELD');assert.equal(result.state,'CAPTURED_RETAINED_NOT_AUTHORITY');
   assert.equal(result.census.native_authority,false);assert.equal(result.census.acknowledged,false);
   p.emit(request('RECHECK',2));assert.equal((await p.wait(2)).state,'RECHECKED_RETAINED_NOT_AUTHORITY');
   assert.equal(JSON.stringify([...p.local.rows]),before);
  }finally{await p.cleanup();}
 });
 await testNew('existing held command refuses missing marker rather than silently preserving fresh DATA',async()=>{
  const p=platform();try{
   const before=JSON.stringify([...p.local.rows]);p.install();p.emit(request('CAPTURE_EXISTING_HELD'));
   assert.equal((await p.wait()).state,'UNRESOLVED_RETAINED');assert.equal(JSON.stringify([...p.local.rows]),before);
  }finally{await p.cleanup();}
 });
 await testNew('private bootstrap capture closed DTO whole original arguments and no public capability',async()=>{
  const p=platform();try{
   assert.equal(p.install(),undefined);assert.deepEqual(JSON.parse(p.posts[0]),{schema:'custodial.native-original-browser-bootstrap.v1',reply_token:reply});
   assert.deepEqual([...p.nativeEvents.keys()],['message']);assert.equal(p.pageEvents.has('message'),false,'no generic window message');
   p.emit(request());const result=await p.wait();assert.equal(result.state,'CAPTURED_RETAINED_NOT_AUTHORITY');
   assert.equal(result.phase_nonce,phase(1));assert.equal(result.reply_token,reply);assert.equal(result.reason,'');
   assert.deepEqual(JSON.parse(Buffer.from(result.arguments_base64[0],'base64').toString()),originalArguments);
   assert.equal(result.arguments_base64.length,1);assert.equal(result.census.unresolved_record_count,result.census.record_count);
   closed(result.observation);assert.equal(result.census.source_authenticated,false);assert.equal(result.census.key_removal,false);
   assert.equal(p.session.getItem('session-original'),'never remove');assert(p.local.getItem(KEY));assert.equal(p.local.getItem('unknown-original'),'\ud800 preserved original {');
   assert(!JSON.stringify([...p.local.rows]).includes(reply));assert(!JSON.stringify([...p.session.rows]).includes(reply));
   assert.deepEqual(Object.keys(result).sort(),['schema','command','reply_token','request_nonce','phase_nonce','operation_id',
    'frame_sha256','original_generation_id','native_mutation_stamp','state','observation','census','arguments_base64','reason'].sort());
  }finally{await p.cleanup();}
 });
 await testNew('wrong tokens malformed duplicate extra nonstring and stale phase refuse before hold',async()=>{
  const p=platform();try{
   p.install();const valid=request();
   for(const bad of [{...valid,grant_token:reply},{...valid,reply_token:reply},{...valid,phase_nonce:null},
    {...valid,phase_nonce:phase(1).toUpperCase()+'X'},{...valid,native_mutation_stamp:'\ud800'},
    {...valid,native_mutation_stamp:'x'.repeat(4097)},{...valid,operation_id:'not-original'}, {...valid,command:'SEND'},
    {...valid,command:'RECHECK'},{...valid,command:'CLOSE'}])p.emit(bad);
   p.emit(JSON.stringify(valid).replace('"phase_nonce":','"phase_nonce":"'+phase(3)+'","phase_nonce":'));
   p.emit('{broken');await new Promise(setImmediate);
   assert.equal(p.local.getItem(KEY),null);assert.equal(p.messagePosts().length,0);assert.equal(p.posts.length,1);
   p.emit(valid);const out=await p.wait();assert.equal(out.phase_nonce,phase(1));
  }finally{await p.cleanup();}
 });
 await testNew('captured native post function cannot be replaced by page global or public callback',async()=>{
  const p=platform();try{
   p.install();p.port.postMessage=()=>assert.fail('successor public post must not receive reply token');
   globalThis.custodialOriginalBrowserPreparation={postMessage(){assert.fail('foreign object');}};
   p.emit(request());assert.equal((await p.wait()).state,'CAPTURED_RETAINED_NOT_AUTHORITY');
   p.emit(request());p.install();await new Promise(setImmediate);assert.equal(p.messagePosts().length,1);
  }finally{await p.cleanup();}
 });
 await testNew('pending capture consumes once duplicate concurrent and foreign original phases cannot stand in',async()=>{
  const entered=deferred(),resume=deferred(),p=platform();let pending;
  try{
   const list=p.db.databases;let held=false;p.db.databases=async()=>{if(!held){held=true;entered.resolve();await resume.promise;}return list();};
   p.install();p.emit(request());await entered.promise;
   p.emit(request());p.emit(request('RECHECK',2));p.emit(request('RECHECK',3,{request_nonce:'e'.repeat(64)}));
   resume.resolve();assert.equal((await p.wait()).phase_nonce,phase(1));
   p.emit(request('RECHECK',2));await new Promise(setImmediate);assert.equal(p.messagePosts().length,1,'unsolicited early phase consumed, never replayed later');
   p.emit(request('RECHECK',4));const out=await p.wait(2);
   assert.equal(out.phase_nonce,phase(4));assert.notEqual(out.phase_nonce,phase(2));
   assert.equal(out.state,'RECHECKED_RETAINED_NOT_AUTHORITY');
   assert.deepEqual(out.arguments_base64,[]);assert.equal(out.census.source_authenticated,false);
   assert.equal(out.reason,'');assert(p.local.getItem(KEY));
  }finally{resume.resolve();await p.cleanup();}
 });
 await testNew('same private census revalidates repeated fresh phases without new hold or census',async()=>{
  const p=platform();try{
   p.install();p.emit(request());await p.wait();const marker=p.local.getItem(KEY),epoch=p.local.getItem(EPOCH);
   p.emit(request('RECHECK',1));await new Promise(setImmediate);assert.equal(p.messagePosts().length,1,'CAPTURE phase cannot be reused');
   p.emit(request('RECHECK',2));const out=await p.wait(2);assert.equal(out.state,'RECHECKED_RETAINED_NOT_AUTHORITY');
   p.emit(request('RECHECK',3));const next=await p.wait(3);assert.equal(next.state,'RECHECKED_RETAINED_NOT_AUTHORITY');
   assert.deepEqual(next.census,out.census);assert.deepEqual(next.observation,out.observation);
   assert.deepEqual(next.arguments_base64,[]);assert.equal(p.local.getItem(KEY),marker);assert.equal(p.local.getItem(EPOCH),epoch);
  }finally{await p.cleanup();}
 });
 await testNew('CLOSE matching fresh phase and pagehide permanently close without thaw or BFCache reopen',async()=>{
  for(const end of ['close','pagehide','expiry']){
   const p=platform();try{
    p.install();p.emit(request());await p.wait();const marker=p.local.getItem(KEY),show=p.pageEvents.get('pageshow');
    p.emit(request('CLOSE',1));assert.equal(p.nativeEvents.has('message'),true,'reused phase cannot close');
    p.emit(request('CLOSE',2,{frame_sha256:'e'.repeat(64)}));assert.equal(p.nativeEvents.has('message'),true,'foreign tuple cannot close');
    if(end==='close')p.emit(request('CLOSE',3));else if(end==='pagehide')p.hide();else p.expire();
    const count=p.posts.length;show();p.install();p.emit(request('CAPTURE',4));await new Promise(setImmediate);
    assert.equal(p.posts.length,count);assert.equal(p.nativeEvents.size,0);assert.equal(p.pageEvents.size,0);
    assert.equal(p.local.getItem(KEY),marker);assert.equal(p.session.getItem('session-original'),'never remove');
   }finally{await p.cleanup();}
  }
 });
 await testNew('close during asynchronous capture denies late response and retains original hold',async()=>{
  for(const end of ['pagehide','expiry']){
   const p=platform(),entered=deferred(),resume=deferred();let held=false;
   try{
    const list=p.db.databases;p.db.databases=async()=>{if(!held){held=true;entered.resolve();await resume.promise;}return list();};
    p.install();p.emit(request());await entered.promise;if(end==='pagehide')p.hide();else p.expire();resume.resolve();
    for(let i=0;i<100;i++)await new Promise(setImmediate);
    assert.equal(p.messagePosts().length,0);assert(p.local.getItem(KEY));assert.equal(p.nativeEvents.size,0);
   }finally{resume.resolve();await p.cleanup();}
  }
 });
 await testNew('changed raw original before emission yields minimal unresolved retained response',async()=>{
  const p=platform();try{
   let lists=0;const list=p.db.databases;p.db.databases=async()=>{if(++lists===7)p.local.setItem('unknown-original','changed original retained');return list();};
   p.install();p.emit(request());const out=await p.wait();assert.equal(out.state,'UNRESOLVED_RETAINED');
   assert.deepEqual(out.arguments_base64,[]);assert.equal(out.observation,null);assert.equal(out.reason,'browser_original_observation_unavailable');
   assert.equal(p.local.getItem('unknown-original'),'changed original retained');assert(p.local.getItem(KEY));
  }finally{await p.cleanup();}
 });
 await testNew('wrong origin subframe missing actual ports no hello no capture or hold',async()=>{
  for(const options of [{origin:'http://localhost'},{origin:'https://foreign.example'},{mainframe:false},{databases:false},{locksAvailable:false}]){
   const p=platform(options);try{p.install();p.emit(request());assert.equal(p.posts.length,0);assert.equal(p.local.getItem(KEY),null);
   }finally{await p.cleanup();}
  }
 });
 await testNew('owned outgoing argument buffers wiped after bound native post',async()=>{
  const p=platform(),OriginalEncoder=globalThis.TextEncoder,buffers=[];
  try{
   globalThis.TextEncoder=class extends OriginalEncoder{encode(value){const bytes=super.encode(value);buffers.push({value,bytes});return bytes;}};
   p.install();p.emit(request());await p.wait();
   const emitted=Buffer.from(p.messagePosts()[0].arguments_base64[0],'base64').toString();
   const originals=buffers.filter(row=>row.value===emitted);assert(originals.length>=2);
   assert(originals.every(row=>row.bytes.every(byte=>byte===0)),'both sent and validation-only argument buffers are wiped');
  }finally{globalThis.TextEncoder=OriginalEncoder;await p.cleanup();}
 });
 await testNew('page JSON and inherited serialization hooks cannot observe private reply stamp',async()=>{
  const p=platform(),original=JSON.stringify,seen=[],oldObject=Object.getOwnPropertyDescriptor(Object.prototype,'toJSON'),
   oldArray=Object.getOwnPropertyDescriptor(Array.prototype,'toJSON');
  try{
   p.install();const encoded=original(request());
   JSON.stringify=function(value,...rest){seen.push(original(value));return original(value,...rest);};
   Object.defineProperty(Object.prototype,'toJSON',{configurable:true,value(){seen.push(Object.keys(this).includes('reply_token')?'LEAK':'metadata');return this;}});
   Object.defineProperty(Array.prototype,'toJSON',{configurable:true,value(){seen.push('array metadata');return this;}});
   p.emit(encoded);const out=await p.wait();assert.equal(out.state,'CAPTURED_RETAINED_NOT_AUTHORITY');
   assert.equal(seen.some(text=>text==='LEAK'||text.includes(reply)),false);
  }finally{
   JSON.stringify=original;
   if(oldObject)Object.defineProperty(Object.prototype,'toJSON',oldObject);else delete Object.prototype.toJSON;
   if(oldArray)Object.defineProperty(Array.prototype,'toJSON',oldArray);else delete Array.prototype.toJSON;
   await p.cleanup();
  }
 });
 await testNew('recheck collector failure retains saved work without false empty list or renewal',async()=>{
  const dbOptions={cursorError:false},p=platform({dbOptions});try{
   p.install();p.emit(request());await p.wait();const marker=p.local.getItem(KEY),epoch=p.local.getItem(EPOCH);
   dbOptions.cursorError=true;
   p.emit(request('RECHECK',2));const out=await p.wait(2);
   assert.equal(out.state,'UNRESOLVED_RETAINED');assert.equal(out.census,null);assert.equal(out.observation,null);
   assert.deepEqual(out.arguments_base64,[]);assert.equal(out.phase_nonce,phase(2));
   assert.equal(out.reason,'browser_original_observation_unavailable');assert.equal(p.local.getItem(KEY),marker);
   assert.equal(p.local.getItem(EPOCH),epoch);assert.equal(p.nativeEvents.size,0);
  }finally{await p.cleanup();}
 });
 await testNew('same bytes restored with changed writer stamp cannot return rechecked metadata',async()=>{
  const p=platform();try{
   p.install();p.emit(request());await p.wait();const raw=p.local.getItem('unknown-original'),hold=p.local.getItem(KEY);
   p.local.setItem('unknown-original','other bytes');p.local.setItem('unknown-original',raw);
   p.local.setItem(EPOCH,'2');p.emit(request('RECHECK',2));const out=await p.wait(2);
   assert.equal(out.state,'UNRESOLVED_RETAINED');assert.equal(out.census,null);
   assert.equal(p.local.getItem('unknown-original'),raw);assert.equal(p.local.getItem(KEY),hold);
   assert.equal(p.local.getItem(EPOCH),'2');assert.equal(p.nativeEvents.size,0);
  }finally{await p.cleanup();}
 });
}

async function browserOriginalDataCases({platform,request,phase,reply}){
 // DATA-ONLY values/opaque handle: NOT T7's MZBRV001 record codec or private
 // provenance. Actual installer source, normal gate/census/currentness, binary
 // buffers, WebCrypto and native-port callbacks execute. No native authority.
 const selected=process.argv.find(v=>v.startsWith('--browser-data-case='))?.slice('--browser-data-case='.length);
 const sourceUrl=process.argv.find(v=>v.startsWith('--browser-data-source='))?.slice('--browser-data-source='.length);
 const check=(name,work)=>selected&&!name.includes(selected)?Promise.resolve():test('BROWSER_ORIGINAL_DATA_NEW '+name,work);
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 function values({size=37,metadata=frame=>frame,readHook=null,inspectHook=null,corrupt=false,readResult=null}={}){
  const chunks=Math.ceil(size/1048576),hashes=[],whole=createHash('sha256'),owned=[];let original=null,handle=null,inspects=0,reads=[];
  const bytes=index=>{
   const value=new Uint8Array(Math.min(1048576,size-index*1048576));value.fill(index%251);
   if(index===0)value.set(Buffer.from('MZBRV001').subarray(0,value.length));return value;
  };
  for(let i=0;i<chunks;i++){const value=bytes(i);hashes.push(hash(value));whole.update(value);value.fill(0);}
  const frameHash=whole.digest('hex');
  const api={async inspect(capture){
   inspects++;assert.equal(inspects,1,'one original frame');original=capture;
   if(inspectHook)await inspectHook(capture);
   handle=metadata({schema:'custodial.browser-original-value-frame.v1',encoding:'MZBRV001',
    observation_sha256:capture.observation_sha256,frame_sha256:frameHash,byte_count:size,chunk_bytes:1048576,chunk_count:chunks,
    record_count:capture.record_count,session_storage_state:capture.session_storage_state,chunk_sha256:Object.freeze(hashes.slice()),
    native_authority:false,durable_retention:false,inventory_acknowledged:false,finalizer_allowed:false,key_removal:false});
   return Object.freeze(handle);
  },async read(capture,frame,index){
   assert.equal(capture,original);assert.equal(frame,handle,'reader receives original opaque handle, not its detached projection');
   reads.push(index);if(readHook)await readHook(index);
   let value=bytes(index);if(corrupt)value[value.length-1]^=1;if(readResult)value=readResult(value);
   if(value instanceof Uint8Array)owned.push(value);return value;
  }};
  return {api,owned,reads,get inspects(){return inspects;},frameHash,hashes,size};
 }
 const setup=async(options={},platformOptions={})=>{
  const v=values(options),p=platform({dataApi:v.api,sourceUrl,...platformOptions});
  try{
   p.install();p.emit(request());const captured=await p.wait();assert.equal(captured.state,'CAPTURED_RETAINED_NOT_AUTHORITY');
   return {p,v,captured};
  }catch(error){await p.cleanup();throw error;}
 };
 const frame=async p=>{p.emit(request('DATA_FRAME',2));return p.waitData();};
 const held=p=>{assert(p.local.getItem(KEY));assert.equal(p.local.getItem('unknown-original'),'\ud800 preserved original {');
  assert.equal(p.session.getItem('session-original'),'never remove');};
 const wiped=v=>{assert(v.owned.every(bytes=>bytes.every(byte=>byte===0)),'owned chunk buffers wiped');};
 const unresolved=out=>{
  assert.equal(out.state,'UNRESOLVED_RETAINED');assert.equal(out.data_frame,null);assert.equal(out.chunk_index,null);
  assert.equal(out.chunk_base64,'');assert.equal(out.reason,'browser_original_values_unavailable');
 };
 await check('digest mismatch refuses original chunk before any value success',async()=>{
  const {p,v}=await setup({corrupt:true});try{
   assert.equal((await frame(p)).state,'VALUE_FRAME_RETAINED_NOT_AUTHORITY');
   p.emit(request('DATA_CHUNK',3));unresolved(await p.waitData(2));wiped(v);held(p);assert.equal(p.nativeEvents.size,0);
  }finally{await p.cleanup();}
 });
 await check('healthy actual source sends closed ordered frame and owned bytes then observation-only recheck',async()=>{
  const {p,v,captured}=await setup({size:1048576+19});try{
   const metadata=await frame(p);assert.equal(metadata.state,'VALUE_FRAME_RETAINED_NOT_AUTHORITY');assert.equal(metadata.chunk_index,null);
   assert.equal(metadata.chunk_base64,'');assert.equal(metadata.data_frame.observation_sha256,captured.observation.observation_sha256);
   assert.equal(metadata.reply_token,reply);assert.equal(Object.keys(metadata.data_frame).length,15);assert.equal(Object.keys(metadata).length,14);
   assert.equal(metadata.frame_sha256,'d'.repeat(64),'native original binding is not the browser binary frame hash');
   const whole=createHash('sha256');
   for(let i=0;i<2;i++){
    p.emit(request('DATA_CHUNK',3+i));const out=await p.waitData(2+i);
    assert.equal(out.state,'VALUE_CHUNK_RETAINED_NOT_AUTHORITY');assert.equal(out.chunk_index,i);assert.equal(out.phase_nonce,phase(3+i));
    const bytes=Buffer.from(out.chunk_base64,'base64');assert.equal(bytes.length,i?19:1048576);assert.equal(hash(bytes),v.hashes[i]);whole.update(bytes);
    assert.deepEqual(out.data_frame,metadata.data_frame);assert.equal(out.reason,'');wiped(v);
   }
   assert.equal(whole.digest('hex'),v.frameHash);assert.deepEqual(v.reads,[0,1]);
   p.emit(request('RECHECK',5));const rechecked=await p.wait(2);assert.equal(rechecked.state,'RECHECKED_RETAINED_NOT_AUTHORITY');
   assert.deepEqual(rechecked.arguments_base64,[]);assert.equal(rechecked.census.source_authenticated,false);held(p);
  }finally{await p.cleanup();}
 });
 await check('closed metadata bounds types binding counts flags and chunk list refuse',async()=>{
  const changes=[{extra:false},{encoding:'other'},{schema:'other'},{observation_sha256:'0'.repeat(64)},
   {frame_sha256:'A'.repeat(64)},{byte_count:0},{byte_count:67108865},{byte_count:'37'},{chunk_bytes:524288},
   {chunk_count:2},{record_count:0},{session_storage_state:'READY'},{chunk_sha256:[]},{chunk_sha256:['X'.repeat(64)]},
   {native_authority:true},{durable_retention:true},{inventory_acknowledged:true},{finalizer_allowed:true},{key_removal:true}];
  for(const change of changes){
   const {p,v}=await setup({metadata:f=>({...f,...change})});try{unresolved(await frame(p));assert.equal(v.reads.length,0);held(p);}
   finally{await p.cleanup();}
  }
 });
 await check('frame accessors sparse hashes unknown hidden keys refuse without invoking getters',async()=>{
  const edits=[f=>Object.defineProperty(f,'frame_sha256',{enumerable:true,get(){assert.fail('caller getter');}}),
   f=>Object.defineProperty(f,'hidden',{value:true}),f=>({...f,chunk_sha256:Object.assign(new Array(1),{other:'0'.repeat(64)})}),
   f=>({...f,chunk_sha256:Object.defineProperty(new Array(1),'0',{enumerable:true,get(){assert.fail('hash getter');}})}),
   f=>({...f,chunk_sha256:new Array(1000000)})];
  for(const metadata of edits){const {p}=await setup({metadata});try{unresolved(await frame(p));held(p);}finally{await p.cleanup();}}
 });
 await check('malformed owned chunk lengths or types never post value bytes',async()=>{
  for(const readResult of [()=>new Uint8Array(0),()=>new Uint8Array(38),()=>[],()=>null]){
   const {p,v}=await setup({readResult});try{
    await frame(p);p.emit(request('DATA_CHUNK',3));unresolved(await p.waitData(2));wiped(v);held(p);
   }finally{await p.cleanup();}
  }
 });
 await check('unavailable frame or chunk collector closes without fabricating an empty success',async()=>{
  for(const stage of ['inspect','read']){
   const hook=async()=>{throw Error('data-only collector unavailable');};
   const {p,v}=await setup({[stage==='inspect'?'inspectHook':'readHook']:hook});try{
    if(stage==='read')await frame(p);
    p.emit(request(stage==='inspect'?'DATA_FRAME':'DATA_CHUNK',stage==='inspect'?2:3));
    unresolved(await p.waitData(stage==='inspect'?1:2));assert.equal(p.nativeEvents.size,0);held(p);wiped(v);
   }finally{await p.cleanup();}
  }
 });
 await check('failed native post cannot advance or resend a chunk under a fresh phase',async()=>{
  let failed=false;const {p,v}=await setup({}, {postSink:text=>{
   const row=JSON.parse(text);if(row.state==='VALUE_CHUNK_RETAINED_NOT_AUTHORITY'){failed=true;throw Error('post result unknown');}return text;
  }});try{
   await frame(p);p.emit(request('DATA_CHUNK',3));unresolved(await p.waitData(2));assert.equal(failed,true);wiped(v);
   p.emit(request('DATA_CHUNK',4));await new Promise(setImmediate);assert.deepEqual(v.reads,[0]);held(p);
  }finally{await p.cleanup();}
 });
 await check('DATA before capture wrong tuple public index grant phase and duplicate events cannot retarget',async()=>{
  const v=values(),p=platform({dataApi:v.api,sourceUrl});try{
   p.install();p.emit(request('DATA_FRAME',2));p.emit(request('DATA_CHUNK',3));await new Promise(setImmediate);
   assert.equal(v.inspects,0);assert.equal(p.local.getItem(KEY),null);
   p.emit(request());await p.wait();
   for(const bad of [{command:'DATA_FRAME',request_nonce:'e'.repeat(64)},{command:'DATA_FRAME',phase_nonce:phase(1)},
    {command:'DATA_FRAME',grant_token:reply},{command:'DATA_CHUNK',chunk_index:0},{command:'DATA_FRAME',operation_id:OTHER}])
    p.emit(request(bad.command,2,bad));
   await new Promise(setImmediate);assert.equal(v.inspects,0);assert.equal(p.dataPosts().length,0);
   await frame(p);p.emit(request('DATA_FRAME',2));p.emit(request('DATA_CHUNK',3));await p.waitData(2);
   p.emit(request('DATA_CHUNK',3));await new Promise(setImmediate);assert.deepEqual(v.reads,[0]);held(p);
  }finally{await p.cleanup();}
 });
 await check('concurrent unsolicited phase is consumed and cannot stand in for a later chunk',async()=>{
  const entered=deferred(),resume=deferred(),{p,v}=await setup({readHook:async()=>{entered.resolve();await resume.promise;}});
  try{
   await frame(p);p.emit(request('DATA_CHUNK',3));await entered.promise;p.emit(request('DATA_CHUNK',4));resume.resolve();
   assert.equal((await p.waitData(2)).phase_nonce,phase(3));p.emit(request('DATA_CHUNK',4));await new Promise(setImmediate);
   assert.equal(p.dataPosts().length,2);assert.deepEqual(v.reads,[0]);wiped(v);
  }finally{resume.resolve();await p.cleanup();}
 });
 await check('recheck incomplete declared frame and repeated frame or exhausted chunk stay held unresolved',async()=>{
  for(const command of ['RECHECK','DATA_FRAME','DATA_CHUNK']){
   const {p,v}=await setup();try{
    await frame(p);
    if(command==='DATA_CHUNK'){p.emit(request(command,3));await p.waitData(2);p.emit(request(command,4));unresolved(await p.waitData(3));}
    else if(command==='RECHECK'){p.emit(request(command,3));const out=await p.wait(2);assert.equal(out.state,'UNRESOLVED_RETAINED');}
    else{p.emit(request(command,3));unresolved(await p.waitData(2));}
    held(p);wiped(v);assert.equal(p.nativeEvents.size,0);
   }finally{await p.cleanup();}
  }
 });
 await check('read and inspect await pagehide expiry or CLOSE prevent late response and wipe bytes',async()=>{
  for(const stage of ['inspect','read'])for(const end of ['pagehide','expiry','CLOSE']){
   const entered=deferred(),resume=deferred(),hook=async()=>{entered.resolve();await resume.promise;};
   const {p,v}=await setup({[stage==='inspect'?'inspectHook':'readHook']:hook});try{
    if(stage==='read')await frame(p);
    p.emit(request(stage==='inspect'?'DATA_FRAME':'DATA_CHUNK',stage==='inspect'?2:3));await entered.promise;
    if(end==='pagehide')p.hide();else if(end==='expiry')p.expire();else p.emit(request('CLOSE',9));
    resume.resolve();for(let i=0;i<100;i++)await new Promise(setImmediate);
    assert.equal(p.dataPosts().length,stage==='inspect'?0:1);wiped(v);held(p);assert.equal(p.nativeEvents.size,0);
   }finally{resume.resolve();await p.cleanup();}
  }
 });
 await check('whole original census revalidated after value read rejects changed hold writer or raw storage',async()=>{
  for(const target of ['hold','writer','raw']){
   let p;const setupResult=await setup({readHook:async()=>{
    p.local.setItem(target==='hold'?KEY:target==='writer'?EPOCH:'unknown-original',target==='writer'?'2':'changed original');
   }});p=setupResult.p;const v=setupResult.v;
   try{await frame(p);p.emit(request('DATA_CHUNK',3));unresolved(await p.waitData(2));wiped(v);assert(p.local.getItem(KEY));}
   finally{await p.cleanup();}
  }
 });
 await check('digest await close wipes active chunk immediately and cannot send it later',async()=>{
  const entered=deferred(),resume=deferred();let armed=false;
  const cryptoApi={subtle:{async digest(algorithm,bytes){
   if(armed&&bytes.byteLength===37){entered.resolve();await resume.promise;}return webcrypto.subtle.digest(algorithm,bytes);
  }}};
  const {p,v}=await setup({}, {cryptoApi});try{
   await frame(p);armed=true;p.emit(request('DATA_CHUNK',3));await entered.promise;p.hide();wiped(v);resume.resolve();
   for(let i=0;i<100;i++)await new Promise(setImmediate);assert.equal(p.dataPosts().length,1);held(p);
  }finally{resume.resolve();await p.cleanup();}
 });
 await check('bound encoder native post JSON and byte access cannot expose private reply or original chunk to page hooks',async()=>{
  const {p,v}=await setup();const originalEncode=TextEncoder.prototype.encode,originalSub=Uint8Array.prototype.subarray,
   originalStringify=JSON.stringify,originalPost=p.port.postMessage;let leaked=0;
  try{
   await frame(p);
   TextEncoder.prototype.encode=function(text){if(String(text).includes(reply))leaked++;return originalEncode.call(this,text);};
   Uint8Array.prototype.subarray=function(...args){leaked++;return originalSub.apply(this,args);};
   JSON.stringify=value=>{if(originalStringify(value).includes(reply))leaked++;return originalStringify(value);};
   p.port.postMessage=()=>{leaked++;};p.emit(originalStringify(request('DATA_CHUNK',3)));
   const out=await p.waitData(2);assert.equal(out.state,'VALUE_CHUNK_RETAINED_NOT_AUTHORITY');assert.equal(leaked,0);wiped(v);
  }finally{TextEncoder.prototype.encode=originalEncode;Uint8Array.prototype.subarray=originalSub;JSON.stringify=originalStringify;
   p.port.postMessage=originalPost;await p.cleanup();}
 });
 await check('full 64MiB sequential source budget transfers without truncation using bounded retained chunks',async()=>{
  let transferred=0,index=0;const all=createHash('sha256');
  const {p,v}=await setup({size:64*1048576},{postSink:text=>{
   const row=JSON.parse(text);if(row.schema==='custodial.native-original-browser-data-response.v1'&&row.command==='DATA_CHUNK'){
    assert.equal(row.state,'VALUE_CHUNK_RETAINED_NOT_AUTHORITY');assert.equal(row.chunk_index,index++);
    const bytes=Buffer.from(row.chunk_base64,'base64');assert.equal(bytes.length,1048576);all.update(bytes);transferred+=bytes.length;
    row.chunk_base64='';return JSON.stringify(row);
   }return text;
  }});try{
   assert.equal((await frame(p)).data_frame.chunk_count,64);
   for(let i=0;i<64;i++){p.emit(request('DATA_CHUNK',3+i));await p.waitData(2+i);wiped(v);v.owned.length=0;}
   assert.equal(transferred,67108864);assert.equal(all.digest('hex'),v.frameHash);assert.equal(v.reads.length,64);
   p.emit(request('RECHECK',100));assert.equal((await p.wait(2)).state,'RECHECKED_RETAINED_NOT_AUTHORITY');held(p);
  }finally{await p.cleanup();}
 });
 console.log(JSON.stringify({proof:'SOURCE callback DATA-only opaque value fixture; actual existing capture/census + WebCrypto',
  real_T7_value_codec_join:'NOT_RUN: sealed new inventory API dependency not supplied',native_browser_authority:false}));
}

async function browserOriginalRealDataCases({platform,request,phase,reply}){
 // Direct production-module imports and genuine sealed T7 private frame/chunk
 // handles; no Source-VM import substitution or DATA fixtures in this mode.
 // Only the existing platform Storage/IDB/locks/native port remain synthetic.
 const selected=process.argv.find(v=>v.startsWith('--browser-real-data-case='))?.slice('--browser-real-data-case='.length);
 const check=(name,work)=>selected&&!name.includes(selected)?Promise.resolve():test('BROWSER_ORIGINAL_REAL_DATA_NEW '+name,work);
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const utf16=value=>Buffer.from(value,'utf16le').swap16();
 const setup=async({seed=null,...options}={})=>{
  const p=platform(options);
  try{
   if(seed)seed(p);p.install();p.emit(request());const captured=await p.wait();
   assert.equal(captured.state,'CAPTURED_RETAINED_NOT_AUTHORITY');return {p,captured};
  }catch(error){await p.cleanup();throw error;}
 };
 const frame=async p=>{p.emit(request('DATA_FRAME',2));return p.waitData();};
 await check('idb-shipping actual runtime and packaged capture keep immutable writer hooks',async()=>{
  assert(existingHeldBundle,'new integration case requires actual normal CJS asset');
  assert.equal(selected,'idb-shipping actual runtime and packaged capture keep immutable writer hooks',
   'nonreplaceable real runtime globals require one selected terminal Node case');
  const p=platform({publicStorageSurface:true});try{
   p.install();assert.equal(p.posts.length,1,'private bootstrap installed');
   await publicRuntime(p); // Actual security/firewall owner, not a ready stub.
   const epochBefore=BigInt(p.local.getItem(EPOCH)||'0');
   const tx=p.idbDatabase.transaction(['original'],'readwrite');
   p.emit(request());for(let i=0;i<20&&!p.local.getItem(KEY);i++)await new Promise(setImmediate);
   assert(p.local.getItem(KEY));assert.equal(p.messagePosts().length,0,'capture cannot publish before original write terminal');
   tx.complete();const captured=await p.wait();assert.equal(captured.state,'CAPTURED_RETAINED_NOT_AUTHORITY');
   const calls=p.idbCalls.length;assert.throws(()=>p.idbDatabase.transaction(['original'],'readwrite'));
   assert.throws(()=>p.idbFactory.deleteDatabase('original'));assert.equal(p.idbCalls.length,calls);
   const metadata=(await frame(p)).data_frame;
   for(let i=0;i<metadata.chunk_count;i++){p.emit(request('DATA_CHUNK',3+i));await p.waitData(2+i);}
   p.emit(request('HOLD_FENCE',100));const first=await p.waitHold();
   assert.equal(first.state,'SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK');
   assert.equal(first.mutation_epoch,p.local.getItem(EPOCH));assert.equal(first.mutation_epoch,String(epochBefore+3n));
   assert.equal(first.finalizer_allowed,false);assert.equal(first.inventory_acknowledged,false);
   const original=p.Database.prototype.transaction;
   assert.throws(()=>{p.Database.prototype.transaction=function(){assert.fail('foreign write');};},TypeError);
   assert.equal(Reflect.defineProperty(p.Database.prototype,'transaction',{value(){assert.fail('foreign write');}}),false);
   assert.equal(p.Database.prototype.transaction,original);
   p.emit(request('HOLD_FENCE',101));assert.equal((await p.waitHold(2)).state,'SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK');
   assert.throws(()=>p.idbDatabase.transaction(['original'],'readwrite'));
   assert.equal(p.local.getItem('unknown-original'),'\ud800 preserved original {');assert(p.local.getItem(KEY));
  }finally{await p.cleanup({terminalProcess:true});}
 });
 await check('idb-cooperative ordinary security owner and document-start transaction share one original write epoch',async()=>{
  const p=platform();try{
   p.install();assert.equal(p.posts.length,1);
   const app=readDocumentProtectedBrowserWriterAdmission();assert(app);
   const result=await app.mutate(async()=>{
    const tx=p.idbDatabase.transaction(['original'],'readwrite');
    tx.complete();await new Promise(setImmediate);app.requireMutation();return 'original app writer completed';
   });
   assert.equal(result,'original app writer completed');assert.equal(p.idbCalls.length,1);
   assert.equal(p.local.getItem(EPOCH),'3');assert.deepEqual(Object.keys(app).sort(),['mutate','requireAdmission','requireMutation']);
   p.emit(request());assert.equal((await p.wait()).state,'CAPTURED_RETAINED_NOT_AUTHORITY');
   let invoked=0;await assert.rejects(app.mutate(()=>invoked++));assert.equal(invoked,0);assert(p.local.getItem(KEY));
  }finally{await p.cleanup();}
 });
 await check('idb-cooperative shared owner never adopts a foreign epoch and published withdrawal never revives',async()=>{
  for(const kind of ['foreign-epoch','descriptor']){
   const p=platform();try{
    p.install();const app=readDocumentProtectedBrowserWriterAdmission();assert(app);
    const original=Object.getOwnPropertyDescriptor(globalThis,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY);
    let callback=0;
    await assert.rejects(app.mutate(async()=>{
     callback++;
     if(kind==='foreign-epoch')p.local.rows.set(EPOCH,String(BigInt(p.local.getItem(EPOCH))+1n));
     else Object.defineProperty(globalThis,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,{...original,value:{}});
     await new Promise(setImmediate);
    }));
    assert.equal(callback,1);
    if(kind==='descriptor')Object.defineProperty(globalThis,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,original);
    await assert.rejects(async()=>app.mutate(()=>callback++));assert.equal(callback,1);
   }finally{await p.cleanup();}
  }
 });
 await check('idb-cooperative actual credential runtime keeps ordinary original transaction admission after native install',async()=>{
  // This member runs alone in its Node process: the actual runtime publishes
  // its nonreplaceable public status facade, never a forged native principal.
  assert.equal(selected,'idb-cooperative actual credential runtime keeps ordinary original transaction admission after native install',
   'nonreplaceable real runtime fixture must run alone in its terminal Node process');
  const p=platform();try{
   p.install();assert(readDocumentProtectedBrowserWriterAdmission());
   const {getCustodialBridgeSecurityRuntime}=await import('../mobile/src/custodial/security-runtime.js');
   const {CUSTODIAL_DEVICE_KEYS,CUSTODIAL_INSTALLATION_MARKER_KEY,CUSTODIAL_INSTALLATION_RECORD_KEY}=
    await import('../mobile/src/custodial/credential-store.js');
   const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:ID,
    credential_id:OTHER,credential_operation_id:'33333333-3333-4333-8333-333333333333',assignment_epoch:7,
    installation_seal:'SYNTHETIC_INSTALLATION_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
   p.db.definitions.mz_scan_queue.stores.actions[0].value.payload={...originalArguments,p_device_id:principal.device_id};
   for(const key of CUSTODIAL_DEVICE_KEYS)p.local.setItem(key,principal.device_id);
   p.local.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY,principal.installation_seal);
   const secure=new Map([[CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify({schema_version:1,
    credential:'SYNTHETIC_NOT_A_DEVICE_CREDENTIAL',device_id:principal.device_id,installation_seal:principal.installation_seal,
    enrolled_at:principal.enrolled_at,migrated_from_credential_only_state:false,
    credential_operation_id:principal.credential_operation_id,principal})]]);
   const runtime=getCustodialBridgeSecurityRuntime({storage:p.local,sessionStorage:p.session,indexedDb:p.idbFactory,
    locks:p.l,cryptoApi:webcrypto,secureStorage:{get:async key=>secure.get(key)??null,
     set:async(key,value)=>secure.set(key,value),remove:async key=>secure.delete(key)}});
   await runtime.security.ready;assert.equal(runtime.security.getStatus().ready,true,JSON.stringify(runtime.security.getStatus()));
   let called=0;const result=await runtime.security.mutateProtectedWork(async()=>{
    called++;const tx=p.idbDatabase.transaction(['original'],'readwrite');tx.complete();await new Promise(setImmediate);
    return 'ordinary original transaction completed';
   });
   assert.equal(result,'ordinary original transaction completed');assert.equal(called,1);
   p.emit(request());assert.equal((await p.wait()).state,'CAPTURED_RETAINED_NOT_AUTHORITY');
   await assert.rejects(runtime.security.mutateProtectedWork(()=>called++));assert.equal(called,1);
   for(const area of [globalThis.localStorage,globalThis.sessionStorage]){
    assert.throws(()=>area.setItem('future-unclassified-original','late write'),e=>e.code==='custodial_protected_state_read_only');
    assert.throws(()=>{area['future-unclassified-original']='late named write';},e=>e.code==='custodial_protected_state_read_only');
    assert.equal(area.getItem('future-unclassified-original'),null);
   }
   assert.equal(p.session.getItem('session-original'),'never remove');
  }catch(error){console.error('OWNING_RUNTIME_CASE_FAILURE',error);throw error;}
  finally{await p.cleanup({terminalProcess:true});}
 });
 await check('idb-publication malformed presence cannot select fallback and closed document cannot run callbacks',async()=>{
  {
   const p=platform();try{
    assert.equal(readDocumentProtectedBrowserWriterAdmission(),null);
    Object.defineProperty(globalThis,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,{configurable:true,value:Object.freeze({}),writable:false});
    assert.throws(()=>readDocumentProtectedBrowserWriterAdmission(),e=>e.code==='custodial_document_browser_writer_unavailable');
    p.install();assert.equal(p.posts.length,0);assert.equal(p.local.getItem(KEY),null);
   }finally{await p.cleanup();}
  }
  {
   const p=platform(),entered=deferred(),resume=deferred();try{
    p.install();const app=readDocumentProtectedBrowserWriterAdmission(),epoch=p.local.getItem(EPOCH);
    assert.throws(()=>app.mutate(null),TypeError);assert.equal(p.local.getItem(EPOCH),epoch);
    let called=0;const pending=app.mutate(async()=>{called++;entered.resolve();await resume.promise;return 'late';});
    const denied=assert.rejects(pending);await entered.promise;p.hide();resume.resolve();await denied;
    await assert.rejects(async()=>app.mutate(()=>called++));assert.equal(called,1);
    assert.equal(p.nativeEvents.size,0);assert.equal(p.local.getItem('unknown-original'),'\ud800 preserved original {');
   }finally{resume.resolve();await p.cleanup();}
  }
 });
 await check('idb-shipping unsupported prototypes cannot announce an unfenced private bootstrap',async()=>{
  const p=platform({idbWriterSurface:false});try{
   p.install();p.emit(request());await new Promise(setImmediate);
   assert.equal(p.posts.length,0);assert.equal(p.nativeEvents.size,0);assert.equal(p.local.getItem(KEY),null);
   assert.equal(p.local.getItem('unknown-original'),'\ud800 preserved original {');
  }finally{await p.cleanup();}
 });
 await check('idb-shipping pagehide while original writer drains retains hold and cannot reply after terminal',async()=>{
  const p=platform();try{
   p.install();const tx=p.idbDatabase.transaction(['original'],'readwrite');p.emit(request());
   for(let i=0;i<20&&!p.local.getItem(KEY);i++)await new Promise(setImmediate);
   assert(p.local.getItem(KEY));p.hide();tx.complete();
   for(let i=0;i<20;i++)await new Promise(setImmediate);
   assert.equal(p.messagePosts().length,0);assert.equal(p.nativeEvents.size,0);assert(p.local.getItem(KEY));
   assert.throws(()=>p.idbDatabase.transaction(['original'],'readwrite'));
  }finally{await p.cleanup();}
 });
 if(existingHeldBundle||selected?.includes('shipping-bundle'))await check('shipping-bundle hold observation uses packaged private entry and exact original chunks',async()=>{
  assert(existingHeldBundle,'this NEW owning case requires the isolated normal CJS recipe artifact');
  const {p,captured}=await setup();try{
   const metadata=(await frame(p)).data_frame;
   for(let i=0;i<metadata.chunk_count;i++){
    p.emit(request('DATA_CHUNK',3+i));assert.equal((await p.waitData(2+i)).state,'VALUE_CHUNK_RETAINED_NOT_AUTHORITY');
   }
   const saved=JSON.stringify([...p.local.rows]);p.emit(request('HOLD_FENCE',100));const out=await p.waitHold();
   assert.equal(out.state,'SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK');assert.equal(Object.keys(out).length,20);
   assert.equal(out.hold_marker_sha256,hash(Buffer.from(p.local.getItem(KEY))));assert.equal(out.mutation_epoch,p.local.getItem(EPOCH));
   assert.equal(out.observation_sha256,captured.census.observation_sha256);assert.equal(out.reply_token,reply);
   assert.equal(JSON.stringify([...p.local.rows]),saved);
   for(const key of ['native_authority','inventory_acknowledged','work_accepted','replay_allowed','finalizer_allowed','key_removal','phone_released'])assert.equal(out[key],false);
  }finally{await p.cleanup();}
 });
 const held=p=>{assert(p.local.getItem(KEY));assert.equal(p.local.getItem('unknown-original'),'\ud800 preserved original {');
  assert.equal(p.session.getItem('session-original'),'never remove');};
 const unresolved=out=>{
  assert.equal(out.state,'UNRESOLVED_RETAINED');assert.equal(out.data_frame,null);assert.equal(out.chunk_index,null);
  assert.equal(out.chunk_base64,'');assert.equal(out.reason,'browser_original_values_unavailable');
 };
 const completeValues=async p=>{
  const metadata=(await frame(p)).data_frame;
  for(let i=0;i<metadata.chunk_count;i++){
   p.emit(request('DATA_CHUNK',3+i));assert.equal((await p.waitData(2+i)).state,'VALUE_CHUNK_RETAINED_NOT_AUTHORITY');
  }
 };
 await check('public-containment missing-runtime cannot announce positive held Source',async()=>{
  const {p}=await setup({publicStorageSurface:true});try{
   await completeValues(p);p.emit(request('HOLD_FENCE',100));const out=await p.waitHold();
   if(out.state==='SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK'){
    // Original-body counterexample only: actual public methods are still raw
    // and can mutate a captured unknown row despite this positive reply.
    globalThis.localStorage.setItem('public-uncontained-original','late local write');
    globalThis.sessionStorage.setItem('public-uncontained-original','late session write');
    console.log('FIRST_PUBLIC_CONTAINMENT_COUNTEREXAMPLE',JSON.stringify({state:out.state,
     local:p.local.getItem('public-uncontained-original'),session:p.session.getItem('public-uncontained-original')}));
   }
   assert.equal(out.state,'UNRESOLVED_RETAINED');assert.equal(out.hold_marker_sha256,'');assert.equal(out.mutation_epoch,'');
   held(p);assert.equal(p.nativeEvents.size,0);
  }finally{await p.cleanup();}
 });
 await check('public-containment unavailable alias getter or substituted raw area refuses',async()=>{
  for(const change of ['alias','getter','replacement']){
   const {p}=await setup({publicStorageSurface:true});try{
    await completeValues(p);
    if(change==='alias')globalThis.sessionStorage=globalThis.localStorage;
    if(change==='replacement')globalThis.localStorage=Object.create(Object.getPrototypeOf(p.local));
    if(change==='getter')Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw Error('unavailable public facade');}});
    p.emit(request('HOLD_FENCE',100));assert.equal((await p.waitHold()).state,'UNRESOLVED_RETAINED');
    held(p);assert.equal(p.nativeEvents.size,0);
   }finally{await p.cleanup();}
  }
 });
 async function publicRuntime(p,{beforeReady=null,expectedReady=true}={}){
  assert(p.posts.length===1&&!p.local.getItem(KEY),'actual runtime must install after document start but before original capture');
  const {getCustodialBridgeSecurityRuntime}=await import('../mobile/src/custodial/security-runtime.js');
  const {CUSTODIAL_DEVICE_KEYS,CUSTODIAL_INSTALLATION_MARKER_KEY,CUSTODIAL_INSTALLATION_RECORD_KEY}=
   await import('../mobile/src/custodial/credential-store.js');
  const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:ID,
   credential_id:OTHER,credential_operation_id:'33333333-3333-4333-8333-333333333333',assignment_epoch:7,
   installation_seal:'SYNTHETIC_INSTALLATION_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
  p.db.definitions.mz_scan_queue.stores.actions[0].value.payload={...originalArguments,p_device_id:principal.device_id};
  for(const key of CUSTODIAL_DEVICE_KEYS)p.local.setItem(key,principal.device_id);
  p.local.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY,principal.installation_seal);
  const secure=new Map([[CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify({schema_version:1,
   credential:'SYNTHETIC_NOT_A_DEVICE_CREDENTIAL',device_id:principal.device_id,installation_seal:principal.installation_seal,
   enrolled_at:principal.enrolled_at,migrated_from_credential_only_state:false,
   credential_operation_id:principal.credential_operation_id,principal})]]);
  const runtime=getCustodialBridgeSecurityRuntime({storage:p.local,sessionStorage:p.session,indexedDb:p.idbFactory,
   locks:p.l,cryptoApi:webcrypto,secureStorage:{get:async key=>secure.get(key)??null,
    set:async(key,value)=>secure.set(key,value),remove:async key=>secure.delete(key)}});
  if(beforeReady)beforeReady(runtime);
  await runtime.security.ready;assert.equal(runtime.security.getStatus().ready,expectedReady,JSON.stringify(runtime.security.getStatus()));
  return runtime;
 }
 const terminalPublicCase=name=>assert.equal(selected,name,'actual nonreplaceable runtime case must run ALONE in its terminal Node process');
 await check('readiness actual warm runtime projects private hold pending on every current public read',async()=>{
  terminalPublicCase('readiness actual warm runtime projects private hold pending on every current public read');
  const p=platform({publicStorageSurface:true});try{
   p.install();const runtime=await publicRuntime(p),security=runtime.security;
   const {getCustodialShellSecurityFacade}=await import('../mobile/src/custodial/security-runtime.js');
   const shell=getCustodialShellSecurityFacade(),healthy=security.getStatus();
   assert.equal(healthy.ready,true);assert.equal(healthy.available,true);
   assert.deepEqual(shell.getStatus(),healthy);assert.deepEqual(await security.ready,healthy);
   p.emit(request());assert.equal((await p.wait()).state,'CAPTURED_RETAINED_NOT_AUTHORITY');
   const original=JSON.stringify([[...p.local.rows],[...p.session.rows]]);
   const publicStatus=security.getStatus(),shellStatus=shell.getStatus(),resolved=await security.ready,seen=[];
   const unsubscribe=security.subscribe(value=>seen.push(value));
   let calls=0;await assert.rejects(security.mutateProtectedWork(()=>calls++));assert.equal(calls,0);
   console.log('HELD_READINESS_OBSERVATION',JSON.stringify({public_ready:publicStatus.ready,shell_ready:shellStatus.ready,
    ready_resolution:resolved.ready,initial_subscription:seen[0]?.ready,work_callbacks:calls}));
   for(const value of [publicStatus,shellStatus,resolved,seen[0]]){
    assert.equal(value.ready,false);assert.equal(value.available,false);
    assert.equal(value.state,'unavailable');assert.equal(value.reason,'custodial_browser_preservation_pending');
    for(const key of ['deviceId','generation','principal','preservedCounts','recovery','enrollmentOperation','removalOperation'])
     assert.deepEqual(value[key],healthy[key],key+' original credential DATA must stay original');
   }
   assert.equal(runtime.credentialStore.getStatus().ready,true,'projection must not rewrite internal credential status');
   for(const owner of [security,shell]){
    await assert.rejects(owner.ensureSecurityState());
    await assert.rejects(owner.waitForStableState());
   }
   unsubscribe();assert.equal(JSON.stringify([[...p.local.rows],[...p.session.rows]]),original);held(p);
  }finally{await p.cleanup({terminalProcess:true});}
 });
 for(const change of ['publisher-withdrawal','document-close'])await check('readiness actual runtime '+change+' cannot project cached operational state',async()=>{
  terminalPublicCase('readiness actual runtime '+change+' cannot project cached operational state');
  const p=platform({publicStorageSurface:true});let restore=()=>{};
  try{
   p.install();const runtime=await publicRuntime(p),security=runtime.security;
   const {getCustodialShellSecurityFacade}=await import('../mobile/src/custodial/security-runtime.js');
   const shell=getCustodialShellSecurityFacade(),original=JSON.stringify([[...p.local.rows],[...p.session.rows]]);
   assert.equal(security.getStatus().ready,true);
   if(change==='publisher-withdrawal'){
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY);
    restore=()=>Object.defineProperty(globalThis,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,descriptor);
    delete globalThis[PROTECTED_BROWSER_DOCUMENT_WRITER_KEY];
   }else p.hide();
   let snapshot;const unsubscribe=security.subscribe(value=>{snapshot=value;});
   for(const value of [security.getStatus(),shell.getStatus(),await security.ready,snapshot]){
    assert.equal(value.ready,false);assert.equal(value.available,false);
    assert.equal(value.reason,'custodial_browser_admission_unavailable');
   }
   restore();assert.equal(security.getStatus().ready,false,'withdrawn original publisher cannot be silently replaced');
   let calls=0;await assert.rejects(security.mutateProtectedWork(()=>calls++));assert.equal(calls,0);
   for(const owner of [security,shell]){
    await assert.rejects(owner.ensureSecurityState());await assert.rejects(owner.waitForStableState());
   }
   assert.equal(JSON.stringify([[...p.local.rows],[...p.session.rows]]),original);unsubscribe();
  }finally{restore();await p.cleanup({terminalProcess:true});}
 });
 await check('readiness initial fallback after actual Source withdrawal never resolves cached ready',async()=>{
  terminalPublicCase('readiness initial fallback after actual Source withdrawal never resolves cached ready');
  const p=platform({publicStorageSurface:true});let withheld=false;
  try{
   p.install();const runtime=await publicRuntime(p,{expectedReady:false,beforeReady:runtime=>{
    runtime.credentialStore.subscribe(status=>{
     if(status.ready===true&&!withheld){withheld=true;p.hide();}
    });
   }});
   assert.equal(withheld,true,'actual credential owner reached ready before Source closed during initial completion');
   const status=await runtime.security.ready;assert.equal(status.ready,false);assert.equal(status.available,false);
   assert.equal(status.reason,'custodial_browser_admission_unavailable');
   let initial;const unsubscribe=runtime.security.subscribe(value=>{initial=value;});
   assert.equal(initial.ready,false);assert.equal(initial.available,false);
   let called=0;await assert.rejects(runtime.security.mutateProtectedWork(()=>called++));assert.equal(called,0);
   unsubscribe();assert.equal(p.nativeEvents.size,0);
  }finally{await p.cleanup({terminalProcess:true});}
 });
 await check('readiness healthy public and shell ensure wait preserve actual original output',async()=>{
  terminalPublicCase('readiness healthy public and shell ensure wait preserve actual original output');
  const p=platform({publicStorageSurface:true});try{
   p.install();const runtime=await publicRuntime(p),security=runtime.security;
   const {getCustodialShellSecurityFacade}=await import('../mobile/src/custodial/security-runtime.js');
   const shell=getCustodialShellSecurityFacade();
   const before=[...p.local.rows].filter(([key])=>key!==EPOCH);
   for(const owner of [security,shell]){
    const ensured=await owner.ensureSecurityState();
    assert.equal(ensured.ready,true);assert.equal(ensured.available,true);assert.equal(ensured.state,'enrolled');
    assert.deepEqual(ensured,runtime.credentialStore.getStatus());
    const waited=await owner.waitForStableState({requireEnrollment:true,expectedGeneration:ensured.generation});
    assert.deepEqual(waited,runtime.credentialStore.getStatus());assert.equal(waited.ready,true);
   }
   assert.deepEqual([...p.local.rows].filter(([key])=>key!==EPOCH),before);
   assert.equal(p.local.getItem(KEY),null);assert.equal(p.session.getItem('session-original'),'never remove');
  }finally{await p.cleanup({terminalProcess:true});}
 });
 await check('readiness existing publish rechecks Source after an earlier listener closes owner',async()=>{
  terminalPublicCase('readiness existing publish rechecks Source after an earlier listener closes owner');
  const p=platform({publicStorageSurface:true}),later=[];let closed=false,firstReady;
  const subscriptions=[];
  try{
   p.install();const runtime=await publicRuntime(p,{expectedReady:false,beforeReady:runtime=>{
    subscriptions.push(runtime.security.subscribe(status=>{
     if(status.ready===true&&!closed){firstReady=status;closed=true;p.hide();}
    }));
    subscriptions.push(runtime.security.subscribe(status=>later.push(status)));
   }});
   assert.equal(closed,true);assert.equal(firstReady.ready,true,'healthy earlier read preceded actual Source close');
   assert(later.length>=2);assert(later.every(status=>status.ready===false&&status.available===false),
    'later listener cannot inherit a pre-withdrawal publication snapshot');
   assert.equal(later.at(-1).reason,'custodial_browser_admission_unavailable');
   assert.deepEqual(later.at(-1).principal,firstReady.principal);
   assert.equal((await runtime.security.ready).ready,false);
   let calls=0;await assert.rejects(runtime.security.mutateProtectedWork(()=>calls++));assert.equal(calls,0);
  }finally{for(const unsubscribe of subscriptions)unsubscribe();await p.cleanup({terminalProcess:true});}
 });
 await check('public-containment actual runtime keeps both held public areas contained',async()=>{
  terminalPublicCase('public-containment actual runtime keeps both held public areas contained');
  const p=platform({publicStorageSurface:true});try{
   p.install();await publicRuntime(p);p.emit(request());assert.equal((await p.wait()).state,'CAPTURED_RETAINED_NOT_AUTHORITY');
   await completeValues(p);const before=JSON.stringify([[...p.local.rows],[...p.session.rows]]);
   p.emit(request('HOLD_FENCE',100));const out=await p.waitHold();
   assert.equal(out.state,'SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK');
   for(const area of [globalThis.localStorage,globalThis.sessionStorage]){
    assert.throws(()=>area.setItem('public-unknown-retained','late write'),e=>e.code==='custodial_protected_state_read_only');
    assert.throws(()=>area.removeItem('public-unknown-retained'),e=>e.code==='custodial_protected_state_read_only');
    assert.throws(()=>area.clear(),e=>e.code==='custodial_protected_state_read_only');
    assert.throws(()=>{area['public-unknown-retained']='late named';},e=>e.code==='custodial_protected_state_read_only');
    assert.throws(()=>{delete area['public-unknown-retained'];},e=>e.code==='custodial_protected_state_read_only');
    assert.throws(()=>Object.defineProperty(area,'public-unknown-retained',{value:'late defined'}),e=>e.code==='custodial_protected_state_read_only');
   }
   p.emit(request('HOLD_FENCE',101));const again=await p.waitHold(2);
   assert.deepEqual({...again,phase_nonce:out.phase_nonce},out);
   assert.equal(JSON.stringify([[...p.local.rows],[...p.session.rows]]),before);held(p);
   for(const key of ['native_authority','inventory_acknowledged','work_accepted','replay_allowed','finalizer_allowed','key_removal','phone_released'])assert.equal(out[key],false);
  }finally{await p.cleanup({terminalProcess:true});}
 });
 await check('public-containment failed actual facade installation remains unresolved',async()=>{
  terminalPublicCase('public-containment failed actual facade installation remains unresolved');
  const p=platform({publicStorageSurface:true});try{
   p.install();Object.defineProperty(globalThis,'sessionStorage',{configurable:false,get:()=>p.session});
   await publicRuntime(p);p.emit(request());assert.equal((await p.wait()).state,'CAPTURED_RETAINED_NOT_AUTHORITY');
   await completeValues(p);p.emit(request('HOLD_FENCE',100));assert.equal((await p.waitHold()).state,'UNRESOLVED_RETAINED');
   assert.equal(p.nativeEvents.size,0);held(p);
  }finally{await p.cleanup({terminalProcess:true});}
 });
 for(const change of ['prototype','method'])await check('public-containment actual runtime '+change+' withdrawal across digest stays retired',async()=>{
  terminalPublicCase('public-containment actual runtime '+change+' withdrawal across digest stays retired');
  const entered=deferred(),resume=deferred();let armed=false;
  const cryptoApi={subtle:{async digest(algorithm,bytes){
   if(armed&&Buffer.from(bytes).toString().startsWith('{"schema":"custodial.browser-preservation-hold.v1"')){
    armed=false;entered.resolve();await resume.promise;
   }return webcrypto.subtle.digest(algorithm,bytes);
  }}};
  const p=platform({publicStorageSurface:true,cryptoApi});let restore=()=>{};
  try{
   p.install();await publicRuntime(p);p.emit(request());await p.wait();await completeValues(p);
   p.emit(request('HOLD_FENCE',100));assert.equal((await p.waitHold()).state,'SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK');
   armed=true;p.emit(request('HOLD_FENCE',101));await entered.promise;
   if(change==='prototype'){
    const original=Object.getPrototypeOf(p.local);restore=()=>Object.setPrototypeOf(p.local,original);
    Object.setPrototypeOf(p.local,Object.create(original));
   }else{
    const original=p.local.getItem;restore=()=>{delete p.local.getItem;};
    Object.defineProperty(p.local,'getItem',{configurable:true,value:function(key){return original.call(this,key);}});
   }
   resume.resolve();assert.equal((await p.waitHold(2)).state,'UNRESOLVED_RETAINED');
   restore();p.emit(request('HOLD_FENCE',102));await new Promise(setImmediate);
   assert.equal(p.holdPosts().length,2,'restored facade bytes cannot revive the retired capture');
   assert.equal(p.nativeEvents.size,0);held(p);
  }finally{restore();resume.resolve();await p.cleanup({terminalProcess:true});}
 });
 await check('hold-fence complete original transfer observes same marker epoch without effects or renewal',async()=>{
  const {p,captured}=await setup();try{
   await completeValues(p);const marker=p.local.getItem(KEY),before=JSON.stringify([...p.local.rows]);
   p.emit(request('HOLD_FENCE',100));const first=await p.waitHold();
   assert.equal(Object.keys(first).length,20);assert.equal(first.command,'HOLD_FENCE');
   assert.equal(first.state,'SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK');
   assert.equal(first.reply_token,reply);assert.equal(first.request_nonce,request().request_nonce);assert.equal(first.phase_nonce,phase(100));
   for(const key of ['operation_id','frame_sha256','original_generation_id','native_mutation_stamp'])assert.equal(first[key],request()[key]);
   assert.equal(first.hold_marker_sha256,hash(Buffer.from(marker)));assert.equal(first.mutation_epoch,p.local.getItem(EPOCH));
   assert.equal(first.observation_sha256,captured.census.observation_sha256);
   for(const key of ['native_authority','inventory_acknowledged','work_accepted','replay_allowed','finalizer_allowed','key_removal','phone_released'])assert.equal(first[key],false);
   p.emit(request('HOLD_FENCE',101));const terminal=await p.waitHold(2);
   assert.deepEqual({...terminal,phase_nonce:first.phase_nonce},first);assert.equal(JSON.stringify([...p.local.rows]),before);held(p);
  }finally{await p.cleanup();}
 });
 await check('post-decision same original Source phase follows terminal and never renews authority',async()=>{
  const {p}=await setup();try{
   await completeValues(p);const before=JSON.stringify([...p.local.rows]);
   p.emit(request('HOLD_FENCE',100));const initial=await p.waitHold();
   p.emit(request('RECHECK',102));assert.equal((await p.wait(2)).state,'RECHECKED_RETAINED_NOT_AUTHORITY');
   p.emit(request('HOLD_FENCE',101));const terminal=await p.waitHold(2);
   await new Promise(setImmediate); // Owning caller's intervening asynchronous decision boundary.
   p.emit(request('HOLD_FENCE',103));const afterDecision=await p.waitHold(3);
   assert.deepEqual({...terminal,phase_nonce:initial.phase_nonce},initial);
   assert.deepEqual({...afterDecision,phase_nonce:initial.phase_nonce},initial);
   assert.notEqual(afterDecision.phase_nonce,terminal.phase_nonce);
   assert.equal(JSON.stringify([...p.local.rows]),before);
   for(const key of ['native_authority','inventory_acknowledged','work_accepted','replay_allowed','finalizer_allowed','key_removal','phone_released'])
    assert.equal(afterDecision[key],false);
   p.expire();p.emit(request('HOLD_FENCE',104));
   for(let i=0;i<20;i++)await new Promise(setImmediate);
   assert.equal(p.holdPosts().length,3,'later phase cannot renew original capture expiry');
   assert.equal(p.nativeEvents.size,0);held(p);
  }finally{await p.cleanup();}
 });
 await check('post-decision Source refuses original changes after previously checked terminal phase',async()=>{
  for(const change of ['epoch','original-row','idb-descriptor','pagehide']){
   const {p}=await setup();try{
    await completeValues(p);p.emit(request('HOLD_FENCE',100));await p.waitHold();
    p.emit(request('RECHECK',102));await p.wait(2);
    p.emit(request('HOLD_FENCE',101));await p.waitHold(2);
    await new Promise(setImmediate);
    if(change==='epoch')p.local.rows.set(EPOCH,'2');
    if(change==='original-row')p.local.rows.set('unknown-original','changed during manager HTTP');
    if(change==='idb-descriptor')p.Database.prototype.transaction=function(){assert.fail('replacement must not run');};
    if(change==='pagehide')p.hide();
    p.emit(request('HOLD_FENCE',103));
    if(change==='pagehide'){
     for(let i=0;i<20;i++)await new Promise(setImmediate);
     assert.equal(p.holdPosts().length,2);
    }else{
     const after=await p.waitHold(3);assert.equal(after.state,'UNRESOLVED_RETAINED');
     assert.equal(after.hold_marker_sha256,'');assert.equal(after.mutation_epoch,'');
    }
    assert.equal(p.nativeEvents.size,0);
    if(change==='original-row'){
     assert.equal(p.local.getItem('unknown-original'),'changed during manager HTTP','refusal cannot roll back a foreign successor');
     assert(p.local.getItem(KEY));assert.equal(p.session.getItem('session-original'),'never remove');
    }else held(p);
   }finally{await p.cleanup();}
  }
 });
 await check('hold-fence incomplete value transfer refuses and preserves originals',async()=>{
  for(const started of [false,true]){
   const {p}=await setup();try{
    if(started)await frame(p);p.emit(request('HOLD_FENCE',100));const out=await p.waitHold();
    assert.equal(out.state,'UNRESOLVED_RETAINED');assert.equal(out.hold_marker_sha256,'');assert.equal(out.mutation_epoch,'');
    held(p);assert.equal(p.nativeEvents.size,0);
   }finally{await p.cleanup();}
  }
 });
 await check('hold-fence changed epoch or marker cannot produce current held observation',async()=>{
  for(const target of [EPOCH,KEY]){
   const {p}=await setup();try{
    await completeValues(p);p.local.rows.set(target,target===EPOCH?'2':'foreign hold');
    p.emit(request('HOLD_FENCE',100));assert.equal((await p.waitHold()).state,'UNRESOLVED_RETAINED');
    assert.equal(p.local.getItem(target),target===EPOCH?'2':'foreign hold');held(p);
   }finally{await p.cleanup();}
  }
 });
 await check('hold-fence awaited marker digest rechecks original epoch and lifecycle before reply',async()=>{
  for(const change of ['epoch','pagehide']){
   const entered=deferred(),resume=deferred();let armed=false;
   const cryptoApi={subtle:{async digest(algorithm,bytes){
    if(armed&&Buffer.from(bytes).toString().startsWith('{"schema":"custodial.browser-preservation-hold.v1"')){
     armed=false;entered.resolve();await resume.promise;
    }return webcrypto.subtle.digest(algorithm,bytes);
   }}};
   const {p}=await setup({cryptoApi});try{
    await completeValues(p);armed=true;p.emit(request('HOLD_FENCE',100));await entered.promise;
    if(change==='epoch')p.local.rows.set(EPOCH,'2');else p.hide();resume.resolve();
    if(change==='epoch')assert.equal((await p.waitHold()).state,'UNRESOLVED_RETAINED');
    else{for(let i=0;i<100;i++)await new Promise(setImmediate);assert.equal(p.holdPosts().length,0);}
    held(p);assert.equal(p.nativeEvents.size,0);
   }finally{resume.resolve();await p.cleanup();}
  }
 });
 await check('private argument buffers never visit successor page array map or iterator hooks',async()=>{
  for(const hook of ['map','iterator'])for(const flow of ['RECHECK','DATA']){
   const p=platform(),originalMap=Array.prototype.map,originalIterator=Array.prototype[Symbol.iterator];let exposed=0,originalText;
   const hasOriginal=values=>{
    for(let i=0;i<values.length;i++)if(values[i] instanceof Uint8Array
      &&Buffer.from(values[i]).toString()===originalText)return true;
    return false;
   };
   try{
    p.install();p.emit(request());const captured=await p.wait();
    originalText=Buffer.from(captured.arguments_base64[0],'base64').toString();
    if(hook==='map')Array.prototype.map=function(...args){
     if(hasOriginal(this))exposed++;return originalMap.apply(this,args);
    };
    else Array.prototype[Symbol.iterator]=function(){
     if(hasOriginal(this))exposed++;return originalIterator.call(this);
    };
    if(flow==='DATA'){
     p.emit(request('DATA_FRAME',2));const frame=await p.waitData();
     // The real value codec independently refuses changed page intrinsics.
     // Preserve that refusal; this is not an accepted DATA-transfer witness.
     assert.equal(frame.state,'UNRESOLVED_RETAINED');assert.equal(frame.data_frame,null);
     assert(p.local.getItem(KEY));assert.equal(p.nativeEvents.size,0);
    }else{
     p.emit(request('RECHECK',100));
     assert.equal((await p.wait(2)).state,'RECHECKED_RETAINED_NOT_AUTHORITY');
    }
    assert.equal(exposed,0,'successor page hook must not receive an array of private original argument buffers');
   }finally{
    Array.prototype.map=originalMap;Array.prototype[Symbol.iterator]=originalIterator;await p.cleanup();
   }
  }
 });
 await check('direct sealed codec original frame through source DATA channel and status-only recheck',async()=>{
  const {p,captured}=await setup();let joined;
  try{
   const out=await frame(p);assert.equal(out.state,'VALUE_FRAME_RETAINED_NOT_AUTHORITY');assert.equal(out.reply_token,reply);
   assert.equal(out.phase_nonce,phase(2));assert.equal(out.chunk_index,null);assert.equal(out.chunk_base64,'');
   assert.equal(Object.keys(out).length,14);const meta=out.data_frame;assert.equal(Object.keys(meta).length,15);
   assert.equal(meta.schema,'custodial.browser-original-value-frame.v1');assert.equal(meta.encoding,'MZBRV001');
   assert.equal(meta.observation_sha256,captured.observation.observation_sha256);assert.equal(meta.record_count,captured.census.record_count);
   assert.equal(meta.session_storage_state,captured.observation.session_storage_state);
   for(const key of ['native_authority','durable_retention','inventory_acknowledged','finalizer_allowed','key_removal'])assert.equal(meta[key],false);
   const parts=[];
   for(let i=0;i<meta.chunk_count;i++){
    p.emit(request('DATA_CHUNK',3+i));const row=await p.waitData(2+i);
    assert.equal(row.state,'VALUE_CHUNK_RETAINED_NOT_AUTHORITY');assert.equal(row.chunk_index,i);assert.equal(row.phase_nonce,phase(3+i));
    assert.deepEqual(row.data_frame,meta);assert.equal(row.frame_sha256,'d'.repeat(64));
    const bytes=Buffer.from(row.chunk_base64,'base64');assert.equal(hash(bytes),meta.chunk_sha256[i]);parts.push(bytes);
   }
   joined=Buffer.concat(parts);for(const bytes of parts)bytes.fill(0);
   assert.equal(joined.length,meta.byte_count);assert.equal(hash(joined),meta.frame_sha256);assert.equal(joined.subarray(0,8).toString(),'MZBRV001');
   assert.equal(joined.subarray(8,40).toString('hex'),captured.observation.observation_sha256);
   assert.deepEqual([40,44,48,52].map(i=>joined.readInt32BE(i)),[captured.observation.local_record_count,
    captured.observation.session_record_count,captured.observation.database_count,captured.observation.record_count]);
   for(const original of ['\ud800 preserved original {','session-original','never remove','exact original response'])
    assert(joined.includes(utf16(original)),'full original UTF16 content, including surrogate, is carried without JSON coercion');
   p.emit(request('RECHECK',100));const status=await p.wait(2);
   assert.equal(status.state,'RECHECKED_RETAINED_NOT_AUTHORITY');assert.deepEqual(status.arguments_base64,[]);
   assert.deepEqual(status.census,captured.census);assert.equal(status.census.source_authenticated,false);held(p);
  }finally{if(joined)joined.fill(0);await p.cleanup();}
 });
 await check('real segmented codec transfers every original byte and rejects incomplete RECHECK',async()=>{
  const large='x'.repeat(600000)+'\ud800';
  for(const finish of [true,false]){
   const {p}=await setup({seed:p=>p.local.setItem('large-original',large)});let joined;
   try{
    const metadata=(await frame(p)).data_frame;assert.equal(metadata.chunk_count,2);const parts=[];
    p.emit(request('DATA_CHUNK',3));const first=await p.waitData(2);parts.push(Buffer.from(first.chunk_base64,'base64'));
    assert.equal(parts[0].length,1048576);assert.equal(hash(parts[0]),metadata.chunk_sha256[0]);
    if(finish){
     p.emit(request('DATA_CHUNK',4));const second=await p.waitData(3);assert.equal(second.chunk_index,1);
     parts.push(Buffer.from(second.chunk_base64,'base64'));assert.equal(parts[1].length,metadata.byte_count-1048576);
     assert.equal(hash(parts[1]),metadata.chunk_sha256[1]);joined=Buffer.concat(parts);
     assert.equal(hash(joined),metadata.frame_sha256);assert(joined.includes(utf16(large)));
    }
    for(const bytes of parts)bytes.fill(0);
    p.emit(request('RECHECK',5));assert.equal((await p.wait(2)).state,finish?'RECHECKED_RETAINED_NOT_AUTHORITY':'UNRESOLVED_RETAINED');
    assert.equal(p.local.getItem('large-original'),large);held(p);
   }finally{if(joined)joined.fill(0);await p.cleanup();}
  }
 });
 await check('actual private chunk reader refuses changed original Storage or durable writer stamp',async()=>{
  for(const target of ['session','writer']){
   const {p}=await setup();try{
    assert.equal((await frame(p)).state,'VALUE_FRAME_RETAINED_NOT_AUTHORITY');
    if(target==='session')p.session.setItem('session-original','changed retained original');else p.local.setItem(EPOCH,'2');
    p.emit(request('DATA_CHUNK',3));unresolved(await p.waitData(2));assert.equal(p.nativeEvents.size,0);assert(p.local.getItem(KEY));
    if(target==='session')assert.equal(p.session.getItem('session-original'),'changed retained original');
    else assert.equal(p.local.getItem(EPOCH),'2');
   }finally{await p.cleanup();}
  }
 });
 await check('actual frame digest await pagehide or expiry closes and wipes real retained encoder arrays',async()=>{
  for(const end of ['pagehide','expiry']){
   const entered=deferred(),resume=deferred(),refs=[];let armed=false,paused=false;
   const cryptoApi={subtle:{async digest(algorithm,bytes){
    if(armed&&bytes[0]===77&&bytes[1]===90){refs.push(bytes);if(!paused){paused=true;entered.resolve();await resume.promise;}}
    return webcrypto.subtle.digest(algorithm,bytes);
   }}};
   const {p}=await setup({cryptoApi});try{
    armed=true;p.emit(request('DATA_FRAME',2));await entered.promise;
    if(end==='pagehide')p.hide();else p.expire();
    assert(refs.length>0);assert(refs.every(bytes=>bytes.every(n=>n===0)),'real T7 active full-frame buffers wiped on close');
    resume.resolve();for(let i=0;i<100;i++)await new Promise(setImmediate);
    assert.equal(p.dataPosts().length,0);assert.equal(p.nativeEvents.size,0);held(p);
   }finally{resume.resolve();await p.cleanup();}
  }
 });
 await check('actual retained codec and returned chunk wiped after uncertain native post without resend',async()=>{
  const refs=[];let armed=false,failed=false;
  const cryptoApi={subtle:{digest(algorithm,bytes){if(armed&&bytes[0]===77&&bytes[1]===90)refs.push(bytes);return webcrypto.subtle.digest(algorithm,bytes);}}};
  const {p}=await setup({cryptoApi,postSink:text=>{
   const row=JSON.parse(text);if(row.state==='VALUE_CHUNK_RETAINED_NOT_AUTHORITY'){failed=true;throw Error('native post outcome unknown');}return text;
  }});try{
   armed=true;assert.equal((await frame(p)).state,'VALUE_FRAME_RETAINED_NOT_AUTHORITY');
   p.emit(request('DATA_CHUNK',3));unresolved(await p.waitData(2));assert(failed);assert(refs.length>=3);
   assert(refs.every(bytes=>bytes.every(n=>n===0)),'real whole, retained and returned original buffers wiped after close');
   p.emit(request('DATA_CHUNK',4));await new Promise(setImmediate);assert.equal(p.dataPosts().length,2);held(p);
  }finally{await p.cleanup();}
 });
 console.log(JSON.stringify({proof:existingHeldBundle?'isolated normal CJS shipping recipe + bundled original capture/value codec + normal WebCrypto':
  'direct shipping DATA caller + actual sealed f83b7efd codec/private frame handles + normal WebCrypto',
  platform:'synthetic Storage/IDB/WebLocks/native port; not a WebView or Android transport',depth256_correction:'NOT_QUALIFIED',native_authority:false}));
}
