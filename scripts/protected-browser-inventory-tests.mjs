import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {observeProtectedBrowserWork,captureProtectedBrowserWork,inspectCapturedOriginalCompletion,readCapturedOriginalCompletionArguments,
 inspectCapturedOriginalEmployeeFeedback,readCapturedOriginalEmployeeFeedbackRow,
 inspectCapturedOriginalCompletionCensus,readCapturedOriginalCompletionCensusArguments,
 inspectCapturedOriginalBrowserValueFrame,readCapturedOriginalBrowserValueChunk,
 closeCapturedProtectedBrowserWork} from '../mobile/src/custodial/protected-browser-inventory.js';
import {createProtectedBrowserAdmission,PROTECTED_BROWSER_HOLD_KEY,PROTECTED_BROWSER_LOCK}
 from '../mobile/src/custodial/protected-browser-admission.js';
import {createSyntheticScheduleLocks} from './synthetic-schedule-locks.mjs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const direct=!!process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);

// Synthetic Storage/IDB event facades around the actual unmounted module.
// Not Chromium, WebView, cross-process fencing, native ACK or physical proof.
function storage(entries={}){
 const data=new Map(Object.entries(entries));return {data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,
 getItem:key=>data.get(key)??null,setItem(){throw Error('inventory cannot write');},removeItem(){throw Error('inventory cannot remove');},clear(){throw Error('inventory cannot clear');}};
}
function idb(definitions={},options={}){
 const state={opens:0,closes:0,aborts:0,lists:0,transactions:0,modes:[],created:0};
 const api={state,definitions,async databases(){state.lists++;options.onList?.(state.lists);return options.list??Object.entries(definitions).map(([name,value])=>({name,version:value.version??1}));},open(name){
  state.opens++;const request={};let closed=false;
  const source=definitions[name]??{stores:{}};
  const database={version:source.version??1,objectStoreNames:Object.keys(source.stores),close(){if(!closed){closed=true;state.closes++;}},transaction(storeNames,mode){
   assert.equal(mode,'readonly');state.modes.push(mode);state.transactions++;let pending=0,aborted=false;
   const tx={abort(){if(aborted)return;aborted=true;state.aborts++;queueMicrotask(()=>tx.onabort?.());},objectStore(storeName){assert.ok(storeNames.includes(storeName));return {openCursor(){
    pending++;const cursor={};let index=0;
    function step(){queueMicrotask(()=>{if(aborted)return;if(options.cursorError){cursor.onerror?.();return;}
     const item=source.stores[storeName][index++];cursor.result=item?{primaryKey:item.key,value:item.value,continue:step}:null;
     cursor.onsuccess?.();if(!item&&--pending===0)queueMicrotask(()=>options.transactionAbort?tx.abort():tx.oncomplete?.());
    });}step();return cursor;
   }};}};return tx;
  }};
  function success(){request.result=database;request.onsuccess?.();}
  if(options.neverOpen)return request;
  if(options.blocked){queueMicrotask(()=>request.onblocked?.());setTimeout(success,options.lateMs??4);return request;}
  queueMicrotask(()=>{if(options.upgrade){request.result=database;request.transaction={abort(){state.aborts++;}};request.onupgradeneeded?.();request.onerror?.();}
   else if(options.openError)request.onerror?.();else success();});return request;
 },deleteDatabase(){throw Error('inventory cannot delete');}};return api;
}
const call=(local,db,extra={})=>observeProtectedBrowserWork({storage:local,indexedDb:db,cryptoApi:webcrypto,timeoutMs:100,...extra});
function boundaries(result){assert.equal(result.browser_inventory_state,'UNKNOWN');assert.equal(result.native_authority,false);assert.equal(result.frozen,false);assert.equal(result.acknowledged,false);assert.equal(result.phone_released,false);}
function observed(result,db){boundaries(result);assert.equal(result.state,'OBSERVED_NOT_FROZEN');assert.match(result.observation_sha256,/^[a-f0-9]{64}$/);assert.equal(db.state.opens,db.state.closes);assert.ok(db.state.modes.every(x=>x==='readonly'));}
function unknown(result,reason){boundaries(result);assert.equal(result.state,'UNINSPECTABLE');if(reason)assert.equal(result.reason,reason);assert.equal(Object.hasOwn(result,'record_count'),false);assert.equal(Object.hasOwn(result,'records'),false);}
const protectedBrowserIdbFixture=idb;
export {protectedBrowserIdbFixture};
const only=process.argv.find(arg=>arg.startsWith('--case='))?.slice(7);
let passed=0;const test=async(name,run)=>{if(!direct||(only&&!name.includes(only)))return;await run();passed++;console.log('PASS '+name);};
const feedbackOp='22222222-2222-4222-8222-222222222222',holdOp='11111111-1111-4111-8111-111111111111';
const backupSelector={deviceId:'KIOSK_08',employeeId:holdOp,credentialId:'44444444-4444-4444-8444-444444444444',
 assignmentEpoch:'7',operationId:feedbackOp,sourceKind:'RETIREMENT_BACKUP'};

await test('session-area original stored group is captured distinctly from same local key',async()=>{
 const key='mz_chatscope_group_pending:original-user',raw='{"request_id":"original","participant_ids":["retained"]}';
 const local=storage({[key]:'local original'}),session=storage({[key]:raw}),db=idb();
 const first=await call(local,db,{sessionStorage:session});observed(first,db);
 console.log(JSON.stringify({case:'session-area stored original',record_count:first.record_count,stores:first.records.map(r=>r.store),session_rows_present:session.length,scope:'source fixture only'}));
 assert.equal(first.record_count,2,'both actual declared Storage originals must be represented');
 assert.equal(first.session_storage_state,'CAPTURED_READ_ONLY_NOT_AUTHENTICATED');
 assert.equal(first.local_record_count,1);assert.equal(first.session_record_count,1);assert.equal(first.record_count,2);
 assert.deepEqual(first.records.map(r=>r.store),['localStorage','sessionStorage']);
 assert.equal(first.records[0].key_sha256,first.records[1].key_sha256);
 assert.notEqual(first.records[0].body_sha256,first.records[1].body_sha256);
 assert.ok(!JSON.stringify(first).includes(raw));assert.ok(!JSON.stringify(first).includes(key));
 session.data.set(key,raw+' ');const second=await call(local,db,{sessionStorage:session});observed(second,db);
 assert.notEqual(first.observation_sha256,second.observation_sha256);assert.equal(local.getItem(key),'local original');
});
await test('session-area unavailable alias and undeclared cannot become empty complete area',async()=>{
 const local=storage({original:'retained'}),db=idb();
 const partial=await call(local,db);observed(partial,db);
 assert.equal(partial.session_storage_state,'NOT_DECLARED_UNKNOWN');assert.equal(partial.session_record_count,null);
 for(const area of [null,{get length(){throw Error('unavailable');},key(){},getItem(){}}]) {
  const result=await call(local,db,{sessionStorage:area});unknown(result);
 }
 unknown(await call(local,db,{sessionStorage:local}),'storage_area_alias');
 assert.equal(local.getItem('original'),'retained');assert.equal(db.state.created,0);
});
await test('session-area original mutation during database await refuses observation',async()=>{
 const session=storage({retained:'before'}),db=idb({known:{stores:{rows:[]}}},{onList(n){if(n===1)session.data.set('retained','after');}});
 unknown(await call(storage(),db,{sessionStorage:session}),'storage_changed');
 assert.equal(session.getItem('retained'),'after');assert.equal(db.state.opens,db.state.closes);
});
await test('session-area same capture rechecks original session before fixed completion read',async()=>{
 const args={p_device_id:'KIOSK_08',p_client_session_id:holdOp,p_client_completion_id:feedbackOp,p_native_finish_scan_entry_id:backupSelector.credentialId};
 const row={id:1,schema_version:4,type:'commit_workflow',operation_id:backupSelector.credentialId,payload:args};
 const session=storage({original:'\ud800'}),db=idb({mz_scan_queue:{version:4,stores:{actions:[{key:1,value:row}]}}});
 const capture=await captureProtectedBrowserWork({storage:storage(),sessionStorage:session,indexedDb:db,cryptoApi:webcrypto,timeoutMs:100});
 try {
  observed(capture,db);const selector={deviceId:'KIOSK_08',clientSessionId:holdOp,clientCompletionId:feedbackOp,timeoutMs:100};
  const candidate=await inspectCapturedOriginalCompletion(capture,selector);
  const bytes=await readCapturedOriginalCompletionArguments(capture,candidate,{timeoutMs:100});
  try{assert.deepEqual(JSON.parse(new TextDecoder().decode(bytes)),args);}finally{bytes.fill(0);}
  session.data.set('original','\ud801');
  await assert.rejects(readCapturedOriginalCompletionArguments(capture,candidate,{timeoutMs:100}),error=>error.code==='original_browser_capture_changed');
  assert.equal(db.definitions.mz_scan_queue.stores.actions[0].value,row);assert.equal(session.getItem('original'),'\ud801');
 }finally{closeCapturedProtectedBrowserWork(capture);}
 assert.equal(db.state.opens,db.state.closes);assert.equal(db.state.created,0);
});
await test('session-area whole census preserves unknown domains without adopting local operations',async()=>{
 const key='mz_employee_feedback_outbox:KIOSK_08:'+feedbackOp;
 const local=storage({[key]:'local retained invalid'}),session=storage({[key]:'session retained invalid','mz_chatscope_group_pending:original-user':'\ud800'}),db=idb();
 const capture=await captureProtectedBrowserWork({storage:local,sessionStorage:session,indexedDb:db,cryptoApi:webcrypto,timeoutMs:100});
 try{
  observed(capture,db);const census=await inspectCapturedOriginalCompletionCensus(capture,{timeoutMs:100});
  assert.equal(census.state,'WHOLE_CAPTURE_COMPLETION_CENSUS_NOT_AUTHENTICATED');
  assert.equal(census.record_count,3);assert.equal(census.session_record_count,2);assert.equal(census.argument_candidate_count,0);
  assert.deepEqual(census.records.map(r=>r.store),['localStorage','sessionStorage','sessionStorage']);
  assert.ok(census.records.filter(r=>r.store==='sessionStorage').every(r=>r.state==='SESSION_ORIGINAL_RETAINED_UNKNOWN'&&r.automatic_acceptance===false));
  assert.equal(census.domains.find(r=>r.store==='sessionStorage').record_count,2);
  assert.deepEqual(await readCapturedOriginalCompletionCensusArguments(capture,census,{timeoutMs:100}),[]);
  assert.equal(local.getItem(key),'local retained invalid');assert.equal(session.getItem(key),'session retained invalid');
 }finally{closeCapturedProtectedBrowserWork(capture);}
 assert.equal(db.state.opens,db.state.closes);assert.equal(db.state.created,0);
});

await test('opaque-builtins changed prototypes retain distinct Blob and RegExp originals',async()=>{
 for(const [make,prototype] of [[text=>new RegExp(text),null],[text=>new Blob([text]),Object.prototype]]){
  const results=[];
  for(const text of ['saved-one','saved-two']){
   const value=make(text);Object.setPrototypeOf(value,prototype);
   const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}});
   const result=await call(storage(),db);assert.equal(db.state.opens,db.state.closes);results.push(result);
  }
  for(const result of results)unknown(result,'unsupported_record_type');
 }
});
await test('opaque-builtins captured original cannot be replaced by hidden Blob or RegExp',async()=>{
 const args={p_device_id:'KIOSK_08',p_client_session_id:holdOp,p_client_completion_id:feedbackOp,p_native_finish_scan_entry_id:backupSelector.credentialId};
 const retained={value:'saved'},db=protectedBrowserIdbFixture({mz_scan_queue:{version:4,stores:{actions:[{key:1,value:{id:1,schema_version:4,type:'commit_workflow',operation_id:backupSelector.credentialId,payload:args}}],retained:[{key:1,value:retained}]}}});
 const capture=await captureProtectedBrowserWork({storage:storage(),indexedDb:db,cryptoApi:webcrypto,timeoutMs:100});
 try{
  observed(capture,db);
  for(const value of [new Blob(['different original']),new RegExp('different-original')]){
   Object.setPrototypeOf(value,Object.prototype);retained.value=value;
   await assert.rejects(inspectCapturedOriginalCompletion(capture,{deviceId:'KIOSK_08',clientSessionId:holdOp,clientCompletionId:feedbackOp,timeoutMs:100}),error=>error.code==='unsupported_record_type');
  }
 }finally{closeCapturedProtectedBrowserWork(capture);}
 assert.equal(db.state.opens,db.state.closes);
});
await test('opaque-builtins fake brands and shadowed accessors cannot call saved code',async()=>{
 let invoked=0;
 for(const value of [new Blob(['saved']),new RegExp('saved')]){
  Object.setPrototypeOf(value,null);
  for(const key of ['size','type','source','flags',Symbol.toStringTag])Object.defineProperty(value,key,{get(){invoked++;throw Error('saved getter');}});
  const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}});
  unknown(await call(storage(),db),'unsupported_record_type');assert.equal(db.state.opens,db.state.closes);
 }
 for(const value of [Object.create(Blob.prototype),Object.create(RegExp.prototype)]){
  const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}});
  unknown(await call(storage(),db));assert.equal(db.state.opens,db.state.closes);
 }
 assert.equal(invoked,0);
});

await test('collection-original changed prototypes cannot erase different Map or Set entries',async()=>{
 const pairs=[];
 for(const [kind,make]of [['Map',value=>new Map([['saved',value]])],['Set',value=>new Set([value])]])for(const prototype of [Object.prototype,null]){
  const a=make('one original'),b=make('different original');Object.setPrototypeOf(a,prototype);Object.setPrototypeOf(b,prototype);
  const observations=[];
  for(const value of [a,b]){const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}});
   const result=await call(storage(),db);assert.equal(db.state.opens,db.state.closes);boundaries(result);observations.push(result);}
  pairs.push({kind,prototype:prototype===null?'null':'Object.prototype',observations});
 }
 console.log(JSON.stringify({case:'collection-original prototype erasure',pairs:pairs.map(p=>({kind:p.kind,prototype:p.prototype,
  states:p.observations.map(o=>o.state),digests:p.observations.map(o=>o.observation_sha256??null)})),source_only:true}));
 for(const pair of pairs)for(const result of pair.observations)unknown(result,'unsupported_record_type');
});
await test('collection-original normal empty and shadowed internal collections refuse without invoking caller access',async()=>{
 let invoked=0;
 const values=[new Map(),new Set(),new Map([['saved','original']]),new Set(['original'])];
 for(const C of [Map,Set])for(const prototype of [Object.prototype,null]){
  const value=C===Map?new Map([['saved','original']]):new Set(['original']);Object.setPrototypeOf(value,prototype);
  for(const key of ['size','entries','values','keys',Symbol.iterator,Symbol.toStringTag])Object.defineProperty(value,key,{get(){invoked++;throw Error('caller access must not run');}});
  values.push(value);
 }
 for(const value of values)for(const inspect of [observeProtectedBrowserWork,captureProtectedBrowserWork]){
  // Only the fixture's cached intrinsic getter may examine retained entries.
  const map=Object.getOwnPropertyDescriptor(Map.prototype,'size').get,set=Object.getOwnPropertyDescriptor(Set.prototype,'size').get;
  let before;try{before=map.call(value);}catch{before=set.call(value);}
  const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}});
  const result=await inspect({storage:storage(),indexedDb:db,cryptoApi:webcrypto,timeoutMs:100});unknown(result,'unsupported_record_type');
  assert.equal(db.state.opens,db.state.closes);assert.equal(db.state.created,0);assert.ok(db.state.modes.every(x=>x==='readonly'));
  let after;try{after=map.call(value);}catch{after=set.call(value);}assert.equal(after,before);
  await assert.rejects(inspectCapturedOriginalCompletion(result,{deviceId:'KIOSK_08',clientSessionId:holdOp,clientCompletionId:feedbackOp}));
 }
 assert.equal(invoked,0);
});
await test('collection-original plain shape false brands cycles and budgets remain unchanged',async()=>{
 const normal={size:1,entries:[['saved','original']],values:[1,2],type:'Map'},plain=Object.assign(Object.create(null),normal);
 for(const value of [normal,plain,{nested:{size:0,type:'Set'},array:[null,1,'saved'] }]){
  const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}});observed(await call(storage(),db),db);
 }
 let getters=0;const tag={};Object.defineProperty(tag,Symbol.toStringTag,{get(){getters++;throw Error('tag not authority');}});
 const accessor={};Object.defineProperty(accessor,'size',{enumerable:true,get(){getters++;throw Error('accessor not authority');}});
 const cyclic={};cyclic.self=cyclic;
 const excessive=Object.fromEntries(Array.from({length:4097},(_,i)=>[String(i),i]));
 for(const [value,reason]of [[tag,'unsupported_object_keys'],[accessor,'accessor_value'],[cyclic,'unsupported_or_cyclic_value'],[excessive,'unsupported_object_keys']]){
  const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}});unknown(await call(storage(),db),reason);assert.equal(db.state.opens,db.state.closes);
 }
 assert.equal(getters,0);assert.equal(cyclic.self,cyclic);assert.equal(Object.keys(excessive).length,4097);
});
await test('collection-original nested Map or Set replaces no captured original argument or row',async()=>{
 for(const C of [Map,Set]){
  const args={p_device_id:'KIOSK_08',p_client_session_id:holdOp,p_client_completion_id:feedbackOp,p_native_finish_scan_entry_id:backupSelector.credentialId,answers:['saved original']};
  const row={id:1,schema_version:4,type:'commit_workflow',operation_id:backupSelector.credentialId,payload:args};
  const retained={nested:{value:{}}},defs={mz_scan_queue:{version:4,stores:{actions:[{key:1,value:row}]}},unrecognized:{stores:{rows:[{key:1,value:retained}]}}};
  const db=protectedBrowserIdbFixture(defs),local=storage({unknown:'saved local original'});
  const capture=await captureProtectedBrowserWork({storage:local,indexedDb:db,cryptoApi:webcrypto,timeoutMs:100});
  try{
   observed(capture,db);const candidate=await inspectCapturedOriginalCompletion(capture,{deviceId:'KIOSK_08',clientSessionId:holdOp,clientCompletionId:feedbackOp,timeoutMs:100});
   const bytes=await readCapturedOriginalCompletionArguments(capture,candidate,{timeoutMs:100});
   try{assert.deepEqual(JSON.parse(new TextDecoder().decode(bytes)),args);}finally{bytes.fill(0);}
   const hidden=C===Map?new Map([['internal','saved entry']]):new Set(['saved entry']);Object.setPrototypeOf(hidden,null);retained.nested.value=hidden;
   await assert.rejects(readCapturedOriginalCompletionArguments(capture,candidate,{timeoutMs:100}),error=>error.code==='unsupported_record_type');
   const failed=await captureProtectedBrowserWork({storage:local,indexedDb:db,cryptoApi:webcrypto,timeoutMs:100});unknown(failed,'unsupported_record_type');
   assert.equal(retained.nested.value,hidden);assert.equal(defs.mz_scan_queue.stores.actions[0].value,row);assert.equal(local.getItem('unknown'),'saved local original');
  }finally{closeCapturedProtectedBrowserWork(capture);}
  assert.equal(db.state.opens,db.state.closes);assert.ok(db.state.modes.every(x=>x==='readonly'));
 }
});

await test('binary-original collision cannot substitute own buffer for original bytes',async()=>{
 const real=new Uint8Array([1,2]),shadowed=new Uint8Array([9,9]);
 Object.defineProperty(shadowed,'buffer',{value:real.buffer});
 const observe=async value=>{const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}});
  const result=await call(storage(),db);observed(result,db);return result;};
 const a=await observe(real),b=await observe(shadowed);
 console.log(JSON.stringify({case:'binary-original collision',real_digest:a.observation_sha256,shadowed_digest:b.observation_sha256,
  different_original_bytes:[...real].join()!==[...shadowed].join(),source_only:true}));
 assert.notEqual(a.observation_sha256,b.observation_sha256,'different intrinsic original bytes must not collapse');
 assert.deepEqual([...shadowed],[9,9]);assert.deepEqual([...real],[1,2]);
});
await test('binary-original intrinsic type range and getters preserve exact supported bytes',async()=>{
 let getters=0;
 const observe=async value=>{const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}});
  const result=await call(storage(),db);observed(result,db);return result.observation_sha256;};
 const plain=new Uint8Array([1,2]),poisoned=new Uint8Array([1,2]);
 for(const key of ['buffer','byteLength','byteOffset',Symbol.toStringTag])Object.defineProperty(poisoned,key,{get(){getters++;throw Error('must not read caller getter');}});
 assert.equal(await observe(poisoned),await observe(plain));assert.equal(getters,0);
 const spoofed=new Uint8Array([1,2]);Object.defineProperty(spoofed,Symbol.toStringTag,{value:'Int8Array'});
 assert.equal(await observe(spoofed),await observe(plain));assert.notEqual(await observe(spoofed),await observe(new Int8Array([1,2])));
 const backingA=new Uint8Array([7,1,2,8]),backingB=new Uint8Array([6,1,2,8]);
 const offsetA=new Uint8Array(backingA.buffer,1,2),offsetB=new Uint8Array(backingB.buffer,1,2);
 assert.notEqual(await observe(offsetA),await observe(offsetB),'whole original backing bytes remain part of identity');
 assert.notEqual(await observe(offsetA),await observe(plain),'original view range remains part of identity');
 const view=new DataView(backingA.buffer,1,2),shadowView=new DataView(backingA.buffer,1,2);
 for(const key of ['buffer','byteLength','byteOffset',Symbol.toStringTag])Object.defineProperty(shadowView,key,{get(){getters++;throw Error('must not read caller getter');}});
 assert.equal(await observe(shadowView),await observe(view));assert.equal(getters,0);
 const arrayBuffer=new Uint8Array([1,2]).buffer;Object.defineProperty(arrayBuffer,Symbol.toStringTag,{get(){getters++;throw Error('tag is not authority');}});
 assert.equal(await observe(arrayBuffer),await observe(new Uint8Array([1,2]).buffer));assert.equal(getters,0);
 for(const C of [Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array]){
  const original=new C(2);new Uint8Array(original.buffer).fill(9);const before=[...new Uint8Array(original.buffer)];
  await observe(original);assert.deepEqual([...new Uint8Array(original.buffer)],before);
 }
 for(const empty of [new ArrayBuffer(0),new Uint8Array(0),new DataView(new ArrayBuffer(0))])await observe(empty);
 assert.deepEqual([...backingA],[7,1,2,8]);assert.deepEqual([...backingB],[6,1,2,8]);
});
await test('binary-original detached shared resizable and unsupported inputs refuse observation and capture',async()=>{
 const detached=new ArrayBuffer(2),detachedView=new Uint8Array(detached),detachedData=new DataView(detached);
 structuredClone(detached,{transfer:[detached]});
 const shared=new SharedArrayBuffer(2),sharedView=new Uint8Array(shared),sharedData=new DataView(shared);
 sharedView.set([9,9]);Object.defineProperty(sharedView,'buffer',{value:new ArrayBuffer(2)});
 Object.setPrototypeOf(shared,Object.prototype); // Shared brand cannot become a plain record by changing its prototype.
 const values=[detached,detachedView,detachedData,shared,sharedView,sharedData,
  Object.create(Uint8Array.prototype),Object.create(ArrayBuffer.prototype),new Proxy(new Uint8Array([1,2]),{})];
 if(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')){
  const resizable=new ArrayBuffer(2,{maxByteLength:4});values.push(resizable,new Uint8Array(resizable),new DataView(resizable));
 }
 for(const value of values)for(const inspect of [observeProtectedBrowserWork,captureProtectedBrowserWork]){
  const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}}),local=storage();
  const result=await inspect({storage:local,indexedDb:db,cryptoApi:webcrypto,timeoutMs:100});unknown(result);
  assert.equal(db.state.opens,db.state.closes);assert.equal(db.state.created,0);assert.ok(db.state.modes.every(x=>x==='readonly'));
  await assert.rejects(inspectCapturedOriginalCompletion(result,{deviceId:'KIOSK_08',clientSessionId:holdOp,clientCompletionId:feedbackOp}));
 }
 assert.deepEqual([...new Uint8Array(shared)],[9,9]);
});
await test('binary-original capture read notices changed intrinsic bytes and preserves unrelated originals',async()=>{
 const binary=new Uint8Array([9,9]);Object.defineProperty(binary,'buffer',{value:new Uint8Array([1,2]).buffer});
 const args={p_device_id:'KIOSK_08',p_client_session_id:holdOp,p_client_completion_id:feedbackOp,p_native_finish_scan_entry_id:backupSelector.credentialId,answers:['saved original']};
 const row={id:1,schema_version:4,type:'commit_workflow',operation_id:backupSelector.credentialId,payload:args};
 const defs={mz_scan_queue:{version:4,stores:{actions:[{key:1,value:row}]}},unknown_binary:{stores:{retained:[{key:1,value:binary}]}}};
 const db=protectedBrowserIdbFixture(defs),local=storage({unknown:'unmodified original'});
 const capture=await captureProtectedBrowserWork({storage:local,indexedDb:db,cryptoApi:webcrypto,timeoutMs:100});
 try{
  observed(capture,db);
  const candidate=await inspectCapturedOriginalCompletion(capture,{deviceId:'KIOSK_08',clientSessionId:holdOp,clientCompletionId:feedbackOp,timeoutMs:100});
  assert.equal(candidate.state,'ONE_ORIGINAL_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED');assert.equal(candidate.source_authenticated,false);
  const bytes=await readCapturedOriginalCompletionArguments(capture,candidate,{timeoutMs:100});
  try{assert.deepEqual(JSON.parse(new TextDecoder().decode(bytes)),args);}finally{bytes.fill(0);}
  binary[0]=8;
  await assert.rejects(readCapturedOriginalCompletionArguments(capture,candidate,{timeoutMs:100}));
  assert.deepEqual([...binary],[8,9]);assert.equal(local.getItem('unknown'),'unmodified original');assert.equal(defs.mz_scan_queue.stores.actions[0].value,row);
 }finally{closeCapturedProtectedBrowserWork(capture);}
 await assert.rejects(readCapturedOriginalCompletionArguments(capture,{}, {timeoutMs:100}));
 assert.equal(db.state.opens,db.state.closes);assert.ok(db.state.modes.every(x=>x==='readonly'));
});
await test('binary-original oversized backing cannot masquerade as a small empty view',async()=>{
 const backing=new ArrayBuffer(8*1024*1024+1),original=new Uint8Array(backing);
 original[0]=7;original[original.length-1]=8;
 for(const value of [new Uint8Array(backing,1,0),new DataView(backing,1,0)])for(const inspect of [observeProtectedBrowserWork,captureProtectedBrowserWork]){
  const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}});
  const result=await inspect({storage:storage(),indexedDb:db,cryptoApi:webcrypto,timeoutMs:100});unknown(result,'inventory_size_limit');
  assert.equal(db.state.opens,db.state.closes);assert.ok(db.state.modes.every(x=>x==='readonly'));
 }
 assert.equal(backing.byteLength,8*1024*1024+1);assert.equal(original[0],7);assert.equal(original[original.length-1],8);
});

// New retirement-reader owning cases use the unchanged actual admission and
// capture/read path, synthetic Storage/IDB/Web Locks, and real Node WebCrypto.
const activeKey='mz_employee_feedback_outbox:KIOSK_08:'+feedbackOp,backupKey='mz_employee_feedback_retirement_backup:KIOSK_08:'+feedbackOp;
const feedbackOriginal=()=>JSON.stringify({schema_version:'employee-feedback-outbox.v2',created_at:'2026-10-12T18:00:00.123Z',body:{
 operation_id:feedbackOp,category:'app_problem',priority:'normal',message:'Exact original — α \\ retained',hub_context:'employee',
 device_id:'KIOSK_08',expected_employee_id:holdOp,expected_credential_id:backupSelector.credentialId,expected_assignment_epoch:'7'}});
const backupOriginal=raw=>JSON.stringify({schema_version:'employee-feedback-retirement-backup.v1',original_key:activeKey,original_encoded:raw});
function retirementFixture(entries){
 const local=storage(entries),db=idb(),locks=createSyntheticScheduleLocks();let writes=0;
 local.setItem=(key,value)=>{assert.equal(key,PROTECTED_BROWSER_HOLD_KEY);writes++;local.data.set(key,value);};
 const gate=createProtectedBrowserAdmission({storage:local,indexedDb:db,locks,cryptoApi:webcrypto});
 return {local,db,locks,gate,get writes(){return writes;}};
}
function feedbackNoAuthority(value){
 assert.equal(value.browser_inventory_state,'UNKNOWN');
 for(const key of ['native_authority','source_authenticated','complete_namespace_inventory','current_server_readback','frozen',
  'acknowledged','work_accepted','key_removal','phone_released','automatic_acceptance','inventory_acknowledged','removal_allowed','finalizer_allowed','resend_allowed'])
  assert.equal(value[key],false,key);
}
async function closeRetirement(capture,f){if(capture)closeCapturedProtectedBrowserWork(capture);await new Promise(setImmediate);assert.equal(f.locks.pending,0);assert.equal(f.db.state.opens,f.db.state.closes);}
await test('retirement-reader exact original backup bytes with no active fallback or write',async()=>{
 const raw=feedbackOriginal(),encoded=backupOriginal(raw),f=retirementFixture({[backupKey]:encoded});let capture;
 try{
  capture=await f.gate.holdAndCapture({operationId:holdOp,lifetimeMs:1000});
  const value=await inspectCapturedOriginalEmployeeFeedback(capture,backupSelector);feedbackNoAuthority(value);
  assert.equal(value.state,'ONE_ORIGINAL_FEEDBACK_CANDIDATE_NOT_AUTHENTICATED');assert.equal(value.source_kind,'RETIREMENT_BACKUP');
  assert.equal(value.matching_original_copy_count,1);assert.equal(value.retirement_backup_row_count,1);
  assert.equal(value.original_assignment_epoch,'7');assert.equal(value.original_created_at,'2026-10-12T18:00:00.123Z');
  const bytes=await readCapturedOriginalEmployeeFeedbackRow(capture,value);
  try{assert.equal(new TextDecoder().decode(bytes),raw);assert.notEqual(new TextDecoder().decode(bytes),encoded);
   const hash=[...new Uint8Array(await webcrypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');assert.equal(hash,value.raw_original_utf8_sha256);
  }finally{bytes.fill(0);}
  const active=await inspectCapturedOriginalEmployeeFeedback(capture,{...backupSelector,sourceKind:'ACTIVE_OUTBOX'});
  assert.equal(active.state,'ORIGINAL_FEEDBACK_NOT_FOUND_UNKNOWN');await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(capture,active));
  assert.equal(f.local.getItem(activeKey),null);assert.equal(f.local.getItem(backupKey),encoded);assert.equal(f.writes,1);
  assert(!JSON.stringify(value).includes('Exact original'));assert(!Object.hasOwn(value,'original_encoded'));
 }finally{await closeRetirement(capture,f);}
});
await test('retirement-reader matching active and backup remain separate unaccepted physical copies',async()=>{
 const raw=feedbackOriginal(),encoded=backupOriginal(raw),f=retirementFixture({[activeKey]:raw,[backupKey]:encoded});let capture;
 try{
  capture=await f.gate.holdAndCapture({operationId:holdOp,lifetimeMs:1000});
  const active=await inspectCapturedOriginalEmployeeFeedback(capture,{...backupSelector,sourceKind:'ACTIVE_OUTBOX'});
  const backup=await inspectCapturedOriginalEmployeeFeedback(capture,backupSelector);assert.notEqual(active,backup);
  for(const value of [active,backup]){feedbackNoAuthority(value);assert.equal(value.matching_rows,1);assert.equal(value.matching_original_copy_count,2);assert.equal(value.unresolved_feedback_rows,2);
   const bytes=await readCapturedOriginalEmployeeFeedbackRow(capture,value);try{assert.equal(new TextDecoder().decode(bytes),raw);}finally{bytes.fill(0);}}
  assert.notEqual(active.source_key_sha256,backup.source_key_sha256);assert.notEqual(active.source_row_sha256,backup.source_row_sha256);
  assert.equal(active.raw_original_utf8_sha256,backup.raw_original_utf8_sha256);assert.equal(f.local.getItem(activeKey),raw);assert.equal(f.local.getItem(backupKey),encoded);
 }finally{await closeRetirement(capture,f);}
});
await test('retirement-reader conflicting same-operation copies deny both capabilities preserve every byte',async()=>{
 const raw=feedbackOriginal(),different=JSON.parse(raw);different.body.message='Conflicting original';const encoded=backupOriginal(JSON.stringify(different));
 const f=retirementFixture({[activeKey]:raw,[backupKey]:encoded});let capture;
 try{capture=await f.gate.holdAndCapture({operationId:holdOp,lifetimeMs:1000});
  const values=[];
  for(const sourceKind of ['ACTIVE_OUTBOX','RETIREMENT_BACKUP']){const value=await inspectCapturedOriginalEmployeeFeedback(capture,{...backupSelector,sourceKind});
   feedbackNoAuthority(value);assert.equal(value.state,'CONFLICTING_ORIGINAL_FEEDBACK_COPIES_RETAINED_UNKNOWN');values.push(value);}
  // Refusing an invalid held capability closes that capture conservatively.
  // Inspect both dispositions first; neither can then produce row bytes.
  for(const value of values)await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(capture,value));
  assert.equal(f.local.getItem(activeKey),raw);assert.equal(f.local.getItem(backupKey),encoded);
 }finally{await closeRetirement(capture,f);}
});
await test('retirement-reader malformed foreign and unpinned wrappers retain UNKNOWN without coercion',async()=>{
 const raw=feedbackOriginal(),base=JSON.parse(backupOriginal(raw)),bad=[];
 bad.push('{bad',JSON.stringify({...base,extra:true}),JSON.stringify({...base,schema_version:'wrong'}),JSON.stringify({...base,original_key:backupKey}),
  JSON.stringify({...base,original_encoded:7}),JSON.stringify({...base,original_encoded:JSON.parse(raw)}),JSON.stringify({...base,original_key:null}),
  JSON.stringify({...base,original_encoded:' '+raw}),JSON.stringify(base).replace('"schema_version":','"schema_version":"duplicate","schema_version":'));
 for(const [key,value] of [['expected_assignment_epoch',7],['expected_assignment_epoch','07'],['expected_assignment_epoch','9007199254740992'],
  ['expected_assignment_epoch',null],['expected_credential_id',feedbackOp],['expected_employee_id',feedbackOp],['device_id','KIOSK_09']]){
  const row=JSON.parse(raw);row.body[key]=value;bad.push(backupOriginal(JSON.stringify(row)));
 }
 for(const encoded of bad){const f=retirementFixture({[activeKey]:raw,[backupKey]:encoded});let capture;
  try{capture=await f.gate.holdAndCapture({operationId:holdOp,lifetimeMs:1000});
   const values=[];
   for(const sourceKind of ['ACTIVE_OUTBOX','RETIREMENT_BACKUP']){const value=await inspectCapturedOriginalEmployeeFeedback(capture,{...backupSelector,sourceKind});
    feedbackNoAuthority(value);assert.match(value.state,/RETAINED_UNKNOWN/);values.push(value);}
   for(const value of values)await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(capture,value));
   assert.equal(f.local.getItem(activeKey),raw);assert.equal(f.local.getItem(backupKey),encoded);
  }finally{await closeRetirement(capture,f);}
 }
});
await test('retirement-reader private capability clone foreign capture and lifetime closure refuse',async()=>{
 const encoded=backupOriginal(feedbackOriginal()),f=retirementFixture({[backupKey]:encoded}),other=retirementFixture({[backupKey]:encoded});let capture,foreign;
 try{
  capture=await f.gate.holdAndCapture({operationId:holdOp,lifetimeMs:1000});foreign=await other.gate.holdAndCapture({operationId:holdOp,lifetimeMs:1000});
  const value=await inspectCapturedOriginalEmployeeFeedback(capture,backupSelector);
  await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(capture,structuredClone(value)));await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(foreign,value));
  closeCapturedProtectedBrowserWork(capture);await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(capture,value));assert.equal(f.local.getItem(backupKey),encoded);
 }finally{await closeRetirement(capture,f);await closeRetirement(foreign,other);}
 const expiry=retirementFixture({[backupKey]:encoded});let expired;
 try{expired=await expiry.gate.holdAndCapture({operationId:holdOp,lifetimeMs:5});const value=await inspectCapturedOriginalEmployeeFeedback(expired,backupSelector);
  await new Promise(resolve=>setTimeout(resolve,8));await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(expired,value));assert.equal(expiry.local.getItem(backupKey),encoded);
 }finally{await closeRetirement(expired,expiry);}
});
await test('retirement-reader owns same origin lock and invalidated guard cannot revive old capability',async()=>{
 const encoded=backupOriginal(feedbackOriginal()),f=retirementFixture({[backupKey]:encoded});let capture,release,start;
 try{
  capture=await f.gate.holdAndCapture({operationId:holdOp,lifetimeMs:1000});const value=await inspectCapturedOriginalEmployeeFeedback(capture,backupSelector);
  const begun=new Promise(resolve=>{start=resolve;}),end=new Promise(resolve=>{release=resolve;});
  const held=f.locks.request(PROTECTED_BROWSER_LOCK,{mode:'exclusive'},async()=>{start();await end;});await begun;
  let finished=false;const pending=readCapturedOriginalEmployeeFeedbackRow(capture,value).then(bytes=>{finished=true;return bytes;});
  await new Promise(setImmediate);assert.equal(finished,false);release();await held;const bytes=await pending;bytes.fill(0);
  const marker=f.local.getItem(PROTECTED_BROWSER_HOLD_KEY);f.local.data.set(PROTECTED_BROWSER_HOLD_KEY,'foreign original hold');
  await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(capture,value));f.local.data.set(PROTECTED_BROWSER_HOLD_KEY,marker);
  await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(capture,value));assert.equal(f.local.getItem(backupKey),encoded);
 }finally{release?.();await closeRetirement(capture,f);}
});
await test('retirement-reader exact wrapper key and post-capture bytes remain immutable original pins',async()=>{
 const raw=feedbackOriginal(),encoded=backupOriginal(raw),foreignKey=backupKey.replace('KIOSK_08','KIOSK_09');
 const wrong=retirementFixture({[foreignKey]:encoded});let foreign;
 try{foreign=await wrong.gate.holdAndCapture({operationId:holdOp,lifetimeMs:1000});
  const value=await inspectCapturedOriginalEmployeeFeedback(foreign,backupSelector);assert.match(value.state,/RETAINED_UNKNOWN/);
  await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(foreign,value));assert.equal(wrong.local.getItem(foreignKey),encoded);
 }finally{await closeRetirement(foreign,wrong);}
 const f=retirementFixture({[backupKey]:encoded});let capture;
 try{capture=await f.gate.holdAndCapture({operationId:holdOp,lifetimeMs:1000});const value=await inspectCapturedOriginalEmployeeFeedback(capture,backupSelector);
  // Even a changed wrapper with identical original bytes invalidates this
  // capture. Restoring source bytes cannot revive a closed old capability.
  const altered=JSON.stringify({original_encoded:raw,original_key:activeKey,schema_version:'employee-feedback-retirement-backup.v1'});
  f.local.data.set(backupKey,altered);await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(capture,value));
  assert.equal(f.local.getItem(backupKey),altered);f.local.data.set(backupKey,encoded);
  await assert.rejects(readCapturedOriginalEmployeeFeedbackRow(capture,value));
 }finally{await closeRetirement(capture,f);}
});
await test('retirement-reader max safe decimal epoch remains exact original text',async()=>{
 const row=JSON.parse(feedbackOriginal());row.body.expected_assignment_epoch='9007199254740991';const raw=JSON.stringify(row),encoded=backupOriginal(raw);
 const f=retirementFixture({[backupKey]:encoded});let capture;
 try{capture=await f.gate.holdAndCapture({operationId:holdOp,lifetimeMs:1000});
  const value=await inspectCapturedOriginalEmployeeFeedback(capture,{...backupSelector,assignmentEpoch:'9007199254740991'});
  assert.equal(value.state,'ONE_ORIGINAL_FEEDBACK_CANDIDATE_NOT_AUTHENTICATED');assert.equal(value.original_assignment_epoch,'9007199254740991');
  const bytes=await readCapturedOriginalEmployeeFeedbackRow(capture,value);try{assert.equal(new TextDecoder().decode(bytes),raw);}finally{bytes.fill(0);}
  feedbackNoAuthority(value);assert.equal(f.local.getItem(backupKey),encoded);
 }finally{await closeRetirement(capture,f);}
});

await test('separate durable draft database plus queue and all local originals',async()=>{
 const local=storage({'session:one':'{"original":"actor"}','mz_scan_completion_draft:one':'malformed original {'});
 const db=idb({mz_scan_queue:{stores:{actions:[{key:1,value:{id:1,body:'original queued cleaning'}}]}},mz_scan_completion_drafts:{stores:{drafts:[{key:'one',value:{session_uuid:'one',answers:['original answer']}}]}}});
 const result=await call(local,db);observed(result,db);assert.equal(result.record_count,4);assert.equal(result.database_count,2);assert.equal(result.local_record_count,2);
 assert.deepEqual(result.records.filter(x=>x.store==='indexedDB').map(x=>x.database),['mz_scan_completion_drafts','mz_scan_queue']);
 assert.equal(local.data.get('mz_scan_completion_draft:one'),'malformed original {');assert.ok(!JSON.stringify(result).includes('original answer'));
 assert.ok(!JSON.stringify(result).includes('original queued cleaning'));assert.ok(Object.isFrozen(result));assert.ok(result.records.every(Object.isFrozen));
});
await test('empty observation never becomes inventory ACK or reuse',async()=>{const db=idb(),result=await call(storage(),db);observed(result,db);assert.equal(result.record_count,0);});
await test('database API unavailable is UNKNOWN not empty',async()=>{unknown(await call(storage(),null),'database_inventory_unavailable');unknown(await call(storage(),{open(){throw Error('must not guess');}}),'database_inventory_unavailable');});
await test('database metadata absent malformed duplicate or excessive is refused',async()=>{
 for(const list of [null,{},[{name:'a',version:'1'}],[{name:'a',version:1},{name:'a',version:1}],Array.from({length:33},(_,i)=>({name:String(i),version:1}))]){
  const db=idb();db.databases=async()=>list;unknown(await call(storage(),db));assert.equal(db.state.opens,0);
 }
});
await test('database disappearance aborts creation and closes late handle',async()=>{const db=idb({known:{stores:{}}},{upgrade:true});unknown(await call(storage(),db),'database_changed');assert.equal(db.state.aborts,1);assert.equal(db.state.opens,db.state.closes);assert.equal(db.state.created,0);});
await test('database version change is refused without reading',async()=>{const db=idb({known:{version:2,stores:{}}},{list:[{name:'known',version:1}]});unknown(await call(storage(),db),'database_changed');assert.equal(db.state.transactions,0);assert.equal(db.state.opens,db.state.closes);});
await test('blocked open late success closes its exact resource',async()=>{const db=idb({known:{stores:{}}},{blocked:true});unknown(await call(storage(),db),'database_blocked');await new Promise(r=>setTimeout(r,8));assert.equal(db.state.opens,db.state.closes);});
await test('hung open and enumeration are bounded',async()=>{
 unknown(await call(storage(),idb({known:{stores:{}}},{neverOpen:true}),{timeoutMs:5}),'storage_inspection_timeout');
 const db=idb();db.databases=()=>new Promise(()=>{});unknown(await call(storage(),db,{timeoutMs:5}),'storage_inspection_timeout');
});
await test('hung digest obeys the same overall budget',async()=>{
 const db=idb();const cryptoApi={subtle:{digest:()=>new Promise(()=>{})}};
 unknown(await call(storage({draft:'retained'}),db,{timeoutMs:5,cryptoApi}),'storage_inspection_timeout');assert.equal(db.state.opens,db.state.closes);
});
await test('cursor failure and transaction abort never report empty',async()=>{
 for(const options of [{cursorError:true},{transactionAbort:true}]){const db=idb({known:{stores:{records:[{key:1,value:'saved'}]}}},options);unknown(await call(storage(),db),'database_read_failed');assert.equal(db.state.opens,db.state.closes);}
});
await test('unknown databases stores backup and records remain inventoried',async()=>{
 const db=idb({mz_scan_queue_v6_to_v4_backup:{stores:{metadata:[{key:'capture',value:{old:6}}],actions:[{key:9,value:{original:'backup'}}]}},unknown_future_db:{stores:{unrecognized:[{key:1,value:{unknown:true}}],empty:[]}}});
 const result=await call(storage({'unknown-future-local':'retained'}),db);observed(result,db);assert.equal(result.record_count,4);assert.equal(result.database_count,2);
});
await test('local change during asynchronous database read is refused',async()=>{
 const local=storage({draft:'before'}),db=idb({}, {onList:n=>{if(n===1)local.data.set('draft','after');}});unknown(await call(local,db),'storage_changed');assert.equal(local.data.get('draft'),'after');
});
await test('database changes between complete observations are refused',async()=>{
 const defs={known:{stores:{records:[{key:1,value:{body:'before'}}]}}};const db=idb(defs,{onList:n=>{if(n===3)defs.known.stores.records[0].value.body='after';}});
 unknown(await call(storage(),db),'storage_changed');assert.equal(db.state.opens,db.state.closes);
});
await test('local mutation during asynchronous digest is refused',async()=>{
 const local=storage({draft:'before'}),db=idb();let once=false;const cryptoApi={subtle:{async digest(...args){if(!once){once=true;local.data.set('draft','after');}return webcrypto.subtle.digest(...args);}}};
 unknown(await call(local,db,{cryptoApi}),'storage_changed');
});
await test('lossless original strings do not collapse corrupt surrogate values',async()=>{
 const digests=[];for(const value of ['\ud800','\ud801','\ufffd'])digests.push((await call(storage({draft:value}),idb())).observation_sha256);assert.equal(new Set(digests).size,3);
});
await test('typed queue values distinguish null undefined missing Date binary holes and negative zero',async()=>{
 const values=[null,undefined,{},new Date('2026-09-26T10:00:00Z'),'2026-09-26T10:00:00.000Z',new Uint8Array([1,2]),[1,2],[,],[undefined],-0,0];const digests=[];
 for(const value of values){const db=idb({known:{stores:{records:[{key:1,value}]}}});const result=await call(storage(),db);observed(result,db);digests.push(result.observation_sha256);}assert.equal(new Set(digests).size,values.length);
});
await test('date-intrinsic internal slots survive changed prototypes and ignore caller methods',async()=>{
 const values=[new Date(1),new Date(2)],digests=[];let invoked=0;
 for(const value of values){Object.setPrototypeOf(value,Object.prototype);Object.defineProperty(value,'getTime',{get(){invoked++;throw Error('caller method must not run');}});
  const db=protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}}),result=await call(storage(),db);observed(result,db);digests.push(result.observation_sha256);}
 const ordinary=await call(storage(),protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value:{}}]}}}));
 const anotherOrdinary=await call(storage(),protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value:{}}]}}}));
 assert.notEqual(digests[0],digests[1]);assert.equal(invoked,0);assert.equal(ordinary.observation_sha256,anotherOrdinary.observation_sha256);
});
await test('date-intrinsic fake and invalid Date slots fail closed',async()=>{
 const invalid=new Date(NaN);Object.setPrototypeOf(invalid,Object.prototype);
 for(const value of [Object.create(Date.prototype),invalid])unknown(await call(storage(),protectedBrowserIdbFixture({known:{stores:{records:[{key:1,value}]}}})));
});
await test('date-intrinsic mutation after capture invalidates current read',async()=>{
 const date=new Date(1),args={p_device_id:'KIOSK_08',p_client_session_id:holdOp,p_client_completion_id:feedbackOp,p_native_finish_scan_entry_id:backupSelector.credentialId};
 const row={id:1,schema_version:4,type:'commit_workflow',operation_id:backupSelector.credentialId,payload:args};
 const db=protectedBrowserIdbFixture({mz_scan_queue:{version:4,stores:{actions:[{key:1,value:row}],retained:[{key:1,value:date}]}}});
 const capture=await captureProtectedBrowserWork({storage:storage(),indexedDb:db,cryptoApi:webcrypto,timeoutMs:100});
 try{observed(capture,db);Date.prototype.setTime.call(date,2);await assert.rejects(inspectCapturedOriginalCompletion(capture,{deviceId:'KIOSK_08',clientSessionId:holdOp,clientCompletionId:feedbackOp,timeoutMs:100}));}
 finally{closeCapturedProtectedBrowserWork(capture);}
});
await test('unsupported cycles maps blobs and accessors remain uninspectable',async()=>{
 const cyclic={};cyclic.self=cyclic;let invoked=0;const accessor=Object.defineProperty({},'value',{get(){invoked++;return 'must not invoke';},enumerable:true});
 for(const value of [cyclic,new Map([['a',1]]),new Blob(['historical attachment']),accessor,new Date(NaN)]){
  const db=idb({known:{stores:{records:[{key:1,value}]}}});unknown(await call(storage(),db));assert.equal(db.state.opens,db.state.closes);
 }assert.equal(invoked,0);
});
await test('oversize input is retained and uninspectable never truncated',async()=>{const local=storage({draft:'x'.repeat(4*1024*1024+1)});unknown(await call(local,idb()),'unsupported_or_oversize_value');assert.equal(local.data.get('draft').length,4*1024*1024+1);});
await test('throwing unavailable storage does not manufacture an empty snapshot',async()=>{unknown(await call({get length(){throw Error('unavailable');},key(){},getItem(){}},idb()),'storage_read_failed');});
await test('Main admission declares actual session area and rejects its later change',async()=>{
 const local=storage({original:'local original'}),session=storage({'mz_chatscope_group_pending:USER':'original group'}),db=idb();
 local.setItem=(key,value)=>local.data.set(key,String(value));
 const gate=createProtectedBrowserAdmission({storage:local,sessionStorage:session,indexedDb:db,
  locks:createSyntheticScheduleLocks(),cryptoApi:webcrypto});
 let capture;
 try{
  capture=await gate.holdAndCapture({operationId:'98000000-0000-4000-8000-000000000001',lifetimeMs:1000});
  assert.equal(capture.state,'OBSERVED_NOT_FROZEN');assert.equal(capture.session_record_count,1);
  assert.equal(capture.session_storage_state,'CAPTURED_READ_ONLY_NOT_AUTHENTICATED');
  assert.equal(capture.local_record_count,2);assert.equal(capture.record_count,3);
  assert.equal(capture.records.filter(row=>row.store==='sessionStorage').length,1);
  assert.equal(capture.native_authority,false);assert.equal(gate.held(),true);
  session.data.set('mz_chatscope_group_pending:USER','changed group');
  await assert.rejects(inspectCapturedOriginalCompletionCensus(capture));
 }finally{closeCapturedProtectedBrowserWork(capture);}
 assert.equal(db.state.opens,db.state.closes);assert.equal(db.state.created,0);
});
// NEW full-value tests: actual held owner/read protocol, existing SYN Storage/
// IDB/Web Locks facades and real Node SHA-256. Never browser/native custody.
function valueFrameFixture({entries={},session=storage(),definitions={},cryptoApi=webcrypto}={}){
 const local=storage(entries),db=idb(definitions),locks=createSyntheticScheduleLocks();
 local.setItem=(key,value)=>{assert.ok([PROTECTED_BROWSER_HOLD_KEY,'mz_custodial_protected_browser_mutation.v1'].includes(key));local.data.set(key,value);};
 const gate=createProtectedBrowserAdmission({storage:local,sessionStorage:session,indexedDb:db,locks,cryptoApi});
 return {local,session,db,locks,gate};
}
async function valueFrameCapture(f,lifetimeMs=5000){
 const capture=await f.gate.holdAndCapture({operationId:holdOp,lifetimeMs});assert.equal(capture.state,'OBSERVED_NOT_FROZEN');return capture;
}
function expectedValueFrame(capture,tree){
 const parts=[Buffer.from('MZBRV001'),Buffer.from(capture.observation_sha256,'hex')],counts=Buffer.alloc(16);
 [capture.local_record_count,capture.session_record_count===null?-1:capture.session_record_count,capture.database_count,capture.record_count]
  .forEach((n,i)=>counts.writeInt32BE(n,i*4));parts.push(counts);
 const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
 const emit=value=>{
  if(value===null){parts.push(Buffer.from([0]));return;}
  if(typeof value==='boolean'){parts.push(Buffer.from([value?2:1]));return;}
  if(typeof value==='number'){const b=Buffer.alloc(9);b[0]=3;b.writeDoubleBE(value,1);parts.push(b);return;}
  if(typeof value==='string'){parts.push(Buffer.from([4]),u32(value.length),Buffer.from(value,'utf16le').swap16());return;}
  assert.ok(Array.isArray(value));parts.push(Buffer.from([5]),u32(value.length));value.forEach(emit);
 };emit(tree);return Buffer.concat(parts);
}
async function valueFrameBytes(capture,frame){
 const {createHash}=await import('node:crypto'),parts=[];
 for(let i=0;i<frame.chunk_count;i++){
  const b=await readCapturedOriginalBrowserValueChunk(capture,frame,i);try{
   assert.equal(createHash('sha256').update(b).digest('hex'),frame.chunk_sha256[i]);parts.push(Buffer.from(b));
  }finally{b.fill(0);}
 }
 return Buffer.concat(parts);
}
await test('VALUE_FRAME_NEW exact tagged originals full backing UTF16 and private detached chunks',async()=>{
 const backing=new Uint8Array([9,1,2,8]),view=new Uint8Array(backing.buffer,1,2);
 const original={foreign:'KIOSK_09',payload:[null,false,true,-0,0,NaN,Infinity,undefined,, '\ud800',new Date(123),view]};
 const refs=[],cryptoApi={subtle:{digest(algorithm,bytes){if(bytes[0]===77&&bytes[1]===90)refs.push(bytes);return webcrypto.subtle.digest(algorithm,bytes);}}};
 const f=valueFrameFixture({entries:{a:'saved\ud801'},session:storage({secondary:'exact\udfff'}),
  definitions:{foreign_unknown:{version:7,stores:{empty:[],rows:[{key:1,value:original}]}}},cryptoApi});let capture;
 try{
  capture=await valueFrameCapture(f);const frame=await inspectCapturedOriginalBrowserValueFrame(capture);
  const keys=['schema','encoding','observation_sha256','frame_sha256','byte_count','chunk_bytes','chunk_count','record_count','session_storage_state','chunk_sha256',
   'native_authority','durable_retention','inventory_acknowledged','finalizer_allowed','key_removal'].sort();
  assert.deepEqual(Object.keys(frame).sort(),keys);assert.ok(Object.isFrozen(frame));assert.ok(Object.isFrozen(frame.chunk_sha256));
  for(const k of ['native_authority','durable_retention','inventory_acknowledged','finalizer_allowed','key_removal'])assert.equal(frame[k],false);
  assert.equal(frame.encoding,'MZBRV001');assert.equal(frame.chunk_bytes,1048576);assert.equal(frame.chunk_count,1);assert.equal(frame.record_count,5);
  const expectedPayload=['array',[['null'],['boolean',false],['boolean',true],['float64','8000000000000000'],['float64','0000000000000000'],
   ['float64','7ff8000000000000'],['float64','7ff0000000000000'],['undefined'],['hole'],['string','\ud800'],['date',123],
   ['binary','[object Uint8Array]',1,2,4,'09010208']]];
  const tree=[Object.entries(Object.fromEntries(f.local.data)).sort(([a],[b])=>a.localeCompare(b)),[['secondary','exact\udfff']],
   [[['foreign_unknown',7],[['empty',[]],['rows',[[['float64','3ff0000000000000'],['object',[['foreign',['string','KIOSK_09']],['payload',expectedPayload]]]]]]]]]];
  const expected=expectedValueFrame(capture,tree),actual=await valueFrameBytes(capture,frame);
  assert.deepEqual(actual,expected);assert.equal(frame.byte_count,expected.length);
  const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(actual).digest('hex'),frame.frame_sha256);
  const copy=await readCapturedOriginalBrowserValueChunk(capture,frame,0);copy.fill(17);
  assert.deepEqual(await valueFrameBytes(capture,frame),expected);copy.fill(0);
  assert.ok(!JSON.stringify(frame).includes('saved'));assert.ok(!JSON.stringify(frame).includes('foreign_unknown'));
  assert.deepEqual([...backing],[9,1,2,8]);assert.equal(f.db.definitions.foreign_unknown.stores.rows[0].value,original);
  closeCapturedProtectedBrowserWork(capture);assert.ok(refs.length>=2);for(const ref of refs)assert.ok(ref.every(n=>n===0));
  await assert.rejects(readCapturedOriginalBrowserValueChunk(capture,frame,0));actual.fill(0);expected.fill(0);
 }finally{await closeRetirement(capture,f);}
});
await test('VALUE_FRAME_NEW empty and undeclared session remain distinct complete tree',async()=>{
 for(const declared of [true,false]){
  const f=valueFrameFixture();if(!declared)f.gate=createProtectedBrowserAdmission({storage:f.local,indexedDb:f.db,locks:f.locks,cryptoApi:webcrypto});let capture;
  try{capture=await valueFrameCapture(f);const frame=await inspectCapturedOriginalBrowserValueFrame(capture),bytes=await valueFrameBytes(capture,frame);
   const tree=[Object.entries(Object.fromEntries(f.local.data)).sort(([a],[b])=>a.localeCompare(b)),declared?[]:null,[]];
   assert.deepEqual(bytes,expectedValueFrame(capture,tree));assert.equal(bytes.readInt32BE(44),declared?0:-1);
   assert.equal(frame.session_storage_state,declared?'CAPTURED_READ_ONLY_NOT_AUTHENTICATED':'NOT_DECLARED_UNKNOWN');bytes.fill(0);
  }finally{await closeRetirement(capture,f);}
 }
});
await test('VALUE_FRAME_NEW segmented bytes offsets and hashes no truncation',async()=>{
 const original='x'.repeat(600000)+'\ud800',f=valueFrameFixture({entries:{large:original}});let capture;
 try{capture=await valueFrameCapture(f);const frame=await inspectCapturedOriginalBrowserValueFrame(capture);
  assert.equal(frame.chunk_count,2);const first=await readCapturedOriginalBrowserValueChunk(capture,frame,0),last=await readCapturedOriginalBrowserValueChunk(capture,frame,1);
  assert.equal(first.length,1048576);assert.equal(last.length,frame.byte_count-1048576);
  const expected=expectedValueFrame(capture,[Object.entries(Object.fromEntries(f.local.data)).sort(([a],[b])=>a.localeCompare(b)),[],[]]);
  assert.deepEqual(Buffer.concat([first,last]),expected);first.fill(0);last.fill(0);expected.fill(0);assert.equal(f.local.getItem('large'),original);
 }finally{await closeRetirement(capture,f);}
 // The predecessor 4MiB-per-string guard is tighter than the new 64MiB
 // aggregate frame ceiling here; never fabricate a private over-limit tree.
 const local=storage({oversize:'x'.repeat(4*1024*1024+1)}),db=idb();
 const rejected=await captureProtectedBrowserWork({storage:local,indexedDb:db,cryptoApi:webcrypto});unknown(rejected,'unsupported_or_oversize_value');
 await assert.rejects(inspectCapturedOriginalBrowserValueFrame(rejected));assert.equal(local.getItem('oversize').length,4*1024*1024+1);
});
await test('VALUE_FRAME_NEW one frame clone foreign unheld and invalid indices refuse',async()=>{
 const unheld=await captureProtectedBrowserWork({storage:storage(),indexedDb:idb(),cryptoApi:webcrypto});
 await assert.rejects(inspectCapturedOriginalBrowserValueFrame(unheld),e=>e.code==='held_browser_capture_required');closeCapturedProtectedBrowserWork(unheld);
 for(const mode of ['second','clone','foreign',-1,0.5,1,NaN,'0',null]){
  const f=valueFrameFixture(),other=valueFrameFixture();let capture,foreign;
  try{capture=await valueFrameCapture(f);const frame=await inspectCapturedOriginalBrowserValueFrame(capture);
   if(mode==='second')await assert.rejects(inspectCapturedOriginalBrowserValueFrame(capture),e=>e.code==='original_value_frame_already_retained');
   else if(mode==='clone')await assert.rejects(readCapturedOriginalBrowserValueChunk(capture,structuredClone(frame),0));
   else if(mode==='foreign'){foreign=await valueFrameCapture(other);await assert.rejects(readCapturedOriginalBrowserValueChunk(foreign,frame,0));}
   else await assert.rejects(readCapturedOriginalBrowserValueChunk(capture,frame,mode),e=>e.code==='original_value_frame_chunk_index_invalid');
   assert.equal(f.local.getItem(PROTECTED_BROWSER_HOLD_KEY)!==null,true);
  }finally{await closeRetirement(capture,f);await closeRetirement(foreign,other);}
 }
});
await test('VALUE_FRAME_NEW stamp source and expired lifetime refuse without deleting originals',async()=>{
 for(const change of ['source','stamp','expired']){
  const f=valueFrameFixture({entries:{original:'saved'}});let capture;
  try{capture=await valueFrameCapture(f,change==='expired'?100:5000);const frame=await inspectCapturedOriginalBrowserValueFrame(capture);
   if(change==='expired')await new Promise(r=>setTimeout(r,120));
   else f.local.data.set(change==='source'?'original':'mz_custodial_protected_browser_mutation.v1',change==='source'?'changed':'99');
   await assert.rejects(readCapturedOriginalBrowserValueChunk(capture,frame,0));
   assert.equal(f.local.getItem('original'),change==='source'?'changed':'saved');assert.ok(f.local.getItem(PROTECTED_BROWSER_HOLD_KEY));
  }finally{await closeRetirement(capture,f);}
 }
});
await test('VALUE_FRAME_NEW detected inherited hooks and array methods never invoked',async()=>{
 for(const [target,key]of [[Object.prototype,'toJSON'],[Array.prototype,'toJSON'],[Array.prototype,'map'],[Array.prototype,Symbol.iterator],[JSON,'stringify']]){
  const f=valueFrameFixture({entries:{original:'saved'}});let capture,called=0,error;const previous=Object.getOwnPropertyDescriptor(target,key);
  try{capture=await valueFrameCapture(f);const frame=await inspectCapturedOriginalBrowserValueFrame(capture);
   Object.defineProperty(target,key,{value(){called++;throw Error('page hook must not receive originals');},writable:true,configurable:true});
   try{await readCapturedOriginalBrowserValueChunk(capture,frame,0);}catch(e){error=e;}
   if(previous)Object.defineProperty(target,key,previous);else delete target[key];
   assert.equal(called,0);assert.equal(error?.code,'original_value_frame_intrinsics_changed');
   await assert.rejects(readCapturedOriginalBrowserValueChunk(capture,frame,0));
   assert.equal(f.local.getItem('original'),'saved');
  }finally{if(previous)Object.defineProperty(target,key,previous);else delete target[key];await closeRetirement(capture,f);}
 }
});
await test('VALUE_FRAME_NEW digest await drift closes wipes unpublished buffers',async()=>{
 let armed=false,called=0;const refs=[],cryptoApi={subtle:{async digest(kind,bytes){
  const result=await webcrypto.subtle.digest(kind,bytes);
  if(armed&&bytes[0]===77&&bytes[1]===90){refs.push(bytes);Object.defineProperty(Array.prototype,'toJSON',{value(){called++;throw Error('must not run');},configurable:true});}
  return result;
 }}};
 const f=valueFrameFixture({entries:{original:'saved'},cryptoApi});let capture,error;
 try{capture=await valueFrameCapture(f);armed=true;
  try{await inspectCapturedOriginalBrowserValueFrame(capture);}catch(e){error=e;}
  delete Array.prototype.toJSON;assert.equal(error?.code,'original_value_frame_intrinsics_changed');assert.equal(called,0);
  assert.equal(refs.length,1);assert.ok(refs[0].every(n=>n===0));assert.equal(f.local.getItem('original'),'saved');
 }finally{delete Array.prototype.toJSON;await closeRetirement(capture,f);}
});
await test('VALUE_FRAME_NEW original lock queued withdrawal refuses before copying',async()=>{
 const f=valueFrameFixture({entries:{original:'saved'}});let capture,release,start;
 try{capture=await valueFrameCapture(f);const frame=await inspectCapturedOriginalBrowserValueFrame(capture);
  const begun=new Promise(r=>{start=r;}),end=new Promise(r=>{release=r;});
  const held=f.locks.request(PROTECTED_BROWSER_LOCK,{mode:'exclusive'},async()=>{start();await end;});await begun;
  const lists=f.db.state.lists;let settled=false;
  const pending=readCapturedOriginalBrowserValueChunk(capture,frame,0).then(b=>{settled=true;b.fill(0);return null;},e=>{settled=true;return e;});
  await new Promise(setImmediate);assert.equal(settled,false);assert.equal(f.db.state.lists,lists);
  f.local.data.set('mz_custodial_protected_browser_mutation.v1','99');release();await held;
  assert.ok(await pending);assert.equal(f.local.getItem('original'),'saved');assert.ok(f.local.getItem(PROTECTED_BROWSER_HOLD_KEY));
 }finally{release?.();await closeRetirement(capture,f);}
});
await test('VALUE_FRAME_NEW list await intrinsic drift refuses before dynamic observation hooks',async()=>{
 const f=valueFrameFixture({entries:{original:'saved'}});let capture,error,called=0;
 try{capture=await valueFrameCapture(f);const frame=await inspectCapturedOriginalBrowserValueFrame(capture),original=f.db.databases;
  f.db.databases=async()=>{const list=await original();Object.defineProperty(Array.prototype,'toJSON',{value(){called++;throw Error('must not run');},configurable:true});return list;};
  try{await readCapturedOriginalBrowserValueChunk(capture,frame,0);}catch(e){error=e;}
  delete Array.prototype.toJSON;assert.equal(called,0);assert.equal(error?.code,'original_value_frame_intrinsics_changed');
  assert.equal(f.local.getItem('original'),'saved');
 }finally{delete Array.prototype.toJSON;await closeRetirement(capture,f);}
});
await test('VALUE_FRAME_DEPTH_NEW original depth63 is lossless and Set iterator drift refuses',async()=>{
 let original='deep original\ud800',tagged=['string',original];
 for(let i=0;i<63;i++){original={child:original};tagged=['object',[['child',tagged]]];}
 const f=valueFrameFixture({definitions:{deep_unknown:{version:1,stores:{originals:[{key:1,value:original}]}}}});let capture;
 const iterator=Object.getOwnPropertyDescriptor(Set.prototype,Symbol.iterator);let invoked=0;
 try{
  capture=await valueFrameCapture(f);const frame=await inspectCapturedOriginalBrowserValueFrame(capture),bytes=await valueFrameBytes(capture,frame);
  const tree=[Object.entries(Object.fromEntries(f.local.data)).sort(([a],[b])=>a.localeCompare(b)),[],
   [[['deep_unknown',1],[['originals',[[['float64','3ff0000000000000'],tagged]]]]]]];
  const expected=expectedValueFrame(capture,tree);assert.deepEqual(bytes,expected);assert.equal(bytes.length,frame.byte_count);
  let cursor=original;for(let i=0;i<63;i++)cursor=cursor.child;assert.equal(cursor,'deep original\ud800');
  assert.equal(f.db.definitions.deep_unknown.stores.originals[0].value,original);bytes.fill(0);expected.fill(0);
  Object.defineProperty(Set.prototype,Symbol.iterator,{value(){invoked++;throw Error('page Set iterator must not see originals');},configurable:true,writable:true});
  let error;try{await readCapturedOriginalBrowserValueChunk(capture,frame,0);}catch(e){error=e;}
  Object.defineProperty(Set.prototype,Symbol.iterator,iterator);
  assert.equal(invoked,0);assert.equal(error?.code,'original_value_frame_intrinsics_changed');
  assert.ok(f.local.getItem(PROTECTED_BROWSER_HOLD_KEY));
 }finally{Object.defineProperty(Set.prototype,Symbol.iterator,iterator);await closeRetirement(capture,f);}
});
if(direct)console.log(JSON.stringify({passed,failed:0,proof:'actual unmounted module with synthetic Storage/IDB and Node WebCrypto; no native/freeze/runtime/phone acceptance'}));
