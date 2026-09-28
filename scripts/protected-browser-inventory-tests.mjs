import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {observeProtectedBrowserWork} from '../mobile/src/custodial/protected-browser-inventory.js';

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
let passed=0;const test=async(name,run)=>{await run();passed++;console.log('PASS '+name);};

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
await test('unsupported cycles maps blobs and accessors remain uninspectable',async()=>{
 const cyclic={};cyclic.self=cyclic;let invoked=0;const accessor=Object.defineProperty({},'value',{get(){invoked++;return 'must not invoke';},enumerable:true});
 for(const value of [cyclic,new Map([['a',1]]),new Blob(['historical attachment']),accessor,new Date(NaN)]){
  const db=idb({known:{stores:{records:[{key:1,value}]}}});unknown(await call(storage(),db));assert.equal(db.state.opens,db.state.closes);
 }assert.equal(invoked,0);
});
await test('oversize input is retained and uninspectable never truncated',async()=>{const local=storage({draft:'x'.repeat(4*1024*1024+1)});unknown(await call(local,idb()),'unsupported_or_oversize_value');assert.equal(local.data.get('draft').length,4*1024*1024+1);});
await test('throwing unavailable storage does not manufacture an empty snapshot',async()=>{unknown(await call({get length(){throw Error('unavailable');},key(){},getItem(){}},idb()),'storage_read_failed');});
console.log(JSON.stringify({passed,failed:0,proof:'actual unmounted module with synthetic Storage/IDB and Node WebCrypto; no native/freeze/runtime/phone acceptance'}));
