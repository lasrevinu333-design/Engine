import assert from 'node:assert/strict';
import test from 'node:test';
import {webcrypto} from 'node:crypto';
import {createCustodialCredentialStore,CustodialStateInspectionError,CustodialPendingWorkError} from '../src/custodial/credential-store.js';

// Actual credential owner, synthetic read-only IDB/Storage/secure-map and mocked
// removal callback. No native, real enrollment, server or physical-device proof.
function fixture(){
  const local=new Map(),secure=new Map(),definitions=new Map();let callbacks=0,opens=0,closes=0;
  const storage={get length(){return local.size;},key:i=>[...local.keys()][i]??null,getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
  const indexedDb={databases:async()=>[...definitions.keys()].map(name=>({name,version:1})),open(name){
    opens++;const request={};queueMicrotask(()=>{
      const definition=definitions.get(name);assert.ok(definition,'Inspection must not create an absent database');
      const db={objectStoreNames:definition.stores,close(){closes++;},transaction(store,mode){
        assert.equal(mode,'readonly');assert.ok(definition.stores.includes(store));
        const tx={objectStore(){return{getAll(){const result={};queueMicrotask(()=>{
          result.result=structuredClone(definition.rows);result.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());
        });return result;}};}};return tx;
      }};request.result=db;request.onsuccess?.();
    });return request;
  }};
  const store=createCustodialCredentialStore({storage,indexedDb,cryptoApi:webcrypto,secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
  return{store,local,secure,definitions,indexedDb,get callbacks(){return callbacks;},get opens(){return opens;},get closes(){return closes;},
    remove:()=>store.removeEnrollment({beforeRemove:async({checkpoint})=>{callbacks++;await checkpoint('server_logged_out');}})};
}
async function enrolled(){const f=fixture();await f.store.setEnrollment({deviceId:'KIOSK_08',credential:'synthetic-only-credential'});return f;}
const saved={id:'synthetic-original',device_id:'KIOSK_08',payload:{note:'synthetic saved cleaning'}};
async function refusal(f,ErrorType){
  const before={local:[...f.local],secure:[...f.secure],databases:structuredClone([...f.definitions])};
  await assert.rejects(f.remove(),ErrorType);
  assert.equal(f.callbacks,0,'No removal/credential callback before a verified empty inventory');
  assert.deepEqual([...f.local],before.local);assert.deepEqual([...f.secure],before.secure);
  assert.deepEqual([...f.definitions],before.databases);assert.equal(f.opens,f.closes);
}
test('unexpected scan-queue store with saved row refuses before removal and preserves exact enrollment',async()=>{
  const f=await enrolled();f.definitions.set('mz_scan_queue',{stores:['legacy_actions'],rows:[saved]});
  await refusal(f,CustodialStateInspectionError);assert.equal(f.store.getStatus().ready,false);
});
test('unexpected scan-queue store is not treated as empty even when supplied rows are empty',async()=>{
  const f=await enrolled();f.definitions.set('mz_scan_queue',{stores:['unknown'],rows:[]});await refusal(f,CustodialStateInspectionError);
});
test('existing scan database without stores remains unknown and preserves original work',async()=>{
  const f=await enrolled();f.definitions.set('mz_scan_queue',{stores:[],rows:[saved]});await refusal(f,CustodialStateInspectionError);
});
test('explicitly absent protected databases retain legitimate zero-work removal',async()=>{
  const f=await enrolled();assert.deepEqual(await f.remove(),{removed:true});assert.equal(f.callbacks,1);
  assert.equal(f.store.getStatus().state,'unenrolled');assert.equal(f.secure.size,0);assert.equal(f.opens,0);
});
test('readable explicitly empty actions store retains legitimate zero-work removal',async()=>{
  const f=await enrolled();f.definitions.set('mz_scan_queue',{stores:['actions'],rows:[]});
  assert.deepEqual(await f.remove(),{removed:true});assert.equal(f.callbacks,1);assert.equal(f.secure.size,0);
  assert.deepEqual(f.definitions.get('mz_scan_queue'),{stores:['actions'],rows:[]});assert.equal(f.opens,f.closes);
});
test('known nonempty actions store retains pending-work refusal without credential handoff',async()=>{
  const f=await enrolled();f.definitions.set('mz_scan_queue',{stores:['actions'],rows:[saved]});await refusal(f,CustodialPendingWorkError);
});
test('unexpected completion-draft store retains existing fail-closed behavior',async()=>{
  const f=await enrolled();f.definitions.set('mz_scan_completion_drafts',{stores:['unknown'],rows:[saved]});await refusal(f,CustodialStateInspectionError);
});
test('unavailable IndexedDB is not converted to a verified-empty removal inventory',async()=>{
  const f=await enrolled();f.indexedDb.open=null;await refusal(f,CustodialStateInspectionError);
});
