import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createCustodialCredentialStore,CustodialStateInspectionError} from '../src/custodial/credential-store.js';

// Actual credential owner; synthetic storage/IDB events, not native/device proof.
function fixture(){
 const local=new Map(),secure=new Map(),definitions=new Map();let opens=0,closes=0,remote=0;
 const storage={get length(){return local.size;},key:i=>[...local.keys()][i]??null,getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
 const indexedDb={databases:async()=>[...definitions.keys()].map(name=>({name,version:1})),open(name){
  opens++;const request={};queueMicrotask(()=>{const def=definitions.get(name);
   if(def?.blocked){request.onblocked?.();return;}if(def?.error){request.onerror?.();return;}
   assert.ok(def,'inspection must not create absent database');
   const db={objectStoreNames:[def.store??'drafts'],close(){closes++;},transaction(store,mode){assert.equal(mode,'readonly');assert.equal(store,def.store??'drafts');
    const tx={objectStore(){return {getAll(){const r={};queueMicrotask(()=>{r.result=structuredClone(def.rows);r.onsuccess?.();queueMicrotask(()=>def.abort?tx.onabort?.():tx.oncomplete?.());});return r;}};}};return tx;}};
   request.result=db;request.onsuccess?.();});return request;}};
 const store=createCustodialCredentialStore({storage,indexedDb,cryptoApi:webcrypto,secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
 return {store,local,secure,definitions,indexedDb,get opens(){return opens;},get closes(){return closes;},get remote(){return remote;},
  remove:()=>store.removeEnrollment({beforeRemove:async({checkpoint})=>{remote++;await checkpoint('server_logged_out');}})};
}
const draft={session_uuid:'11111111-1111-4111-8111-111111111111',device_id:'KIOSK_08',draft:{note:'original saved work'}};
let passed=0,failed=0;
const test=async(name,work)=>{try{await work();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+error.stack);}};
await test('durable-only draft makes unbound enrollment require recovery',async()=>{
 const f=fixture();f.definitions.set('mz_scan_completion_drafts',{rows:[draft]});
 await assert.rejects(f.store.ensureSecurityState(),error=>error.code==='custodial_restore_quarantine');
 assert.equal(f.store.getStatus().preservedCounts.scan_completion_drafts,1);assert.deepEqual(f.definitions.get('mz_scan_completion_drafts').rows,[draft]);
 assert.equal(f.opens,f.closes);
});
await test('durable-only draft stops removal before logout and preserves exact enrollment',async()=>{
 const f=fixture();await f.store.setEnrollment({deviceId:'KIOSK_08',credential:'synthetic-only-credential'});
 const originalSecure=[...f.secure],originalLocal=[...f.local];f.definitions.set('mz_scan_completion_drafts',{rows:[draft]});
 await assert.rejects(f.remove(),error=>error.code==='custodial_pending_work'&&error.preservedCounts.scan_completion_drafts===1);
 assert.equal(f.remote,0);assert.deepEqual([...f.secure],originalSecure);assert.deepEqual([...f.local],originalLocal);
 assert.deepEqual(f.definitions.get('mz_scan_completion_drafts').rows,[draft]);assert.equal(f.opens,f.closes);
});
await test('local mirror and durable original are both retained and counted conservatively',async()=>{
 const f=fixture();await f.store.setEnrollment({deviceId:'KIOSK_08',credential:'synthetic-only-credential'});
 f.local.set('mz_scan_completion_draft:one',JSON.stringify(draft));f.definitions.set('mz_scan_completion_drafts',{rows:[draft]});
 await assert.rejects(f.remove(),error=>error.code==='custodial_pending_work'&&error.preservedCounts.scan_completion_drafts===2);
 assert.equal(f.remote,0);assert.equal(f.local.get('mz_scan_completion_draft:one'),JSON.stringify(draft));assert.deepEqual(f.definitions.get('mz_scan_completion_drafts').rows,[draft]);
});
await test('unreadable or unexpected draft store never becomes an empty removal inventory',async()=>{
 for(const definition of [{rows:[draft],store:'unknown'},{rows:[draft],abort:true},{rows:null},{rows:[draft],error:true},{rows:[draft],blocked:true}]){
  const f=fixture();await f.store.setEnrollment({deviceId:'KIOSK_08',credential:'synthetic-only-credential'});const originalSecure=[...f.secure];
  f.definitions.set('mz_scan_completion_drafts',definition);
  await assert.rejects(f.remove(),CustodialStateInspectionError);assert.equal(f.remote,0);assert.deepEqual([...f.secure],originalSecure);assert.deepEqual(f.definitions.get('mz_scan_completion_drafts'),definition);
 }
});
await test('missing browser database capability refuses removal without claiming empty',async()=>{
 const f=fixture();await f.store.setEnrollment({deviceId:'KIOSK_08',credential:'synthetic-only-credential'});const originalSecure=[...f.secure];
 f.indexedDb.open=null;await assert.rejects(f.remove(),CustodialStateInspectionError);assert.equal(f.remote,0);assert.deepEqual([...f.secure],originalSecure);
});
await test('historical malformed and unowned durable records retain manager recovery',async()=>{
 for(const row of [null,'malformed',{draft:{note:'missing original device'}}]){
  const f=fixture();f.definitions.set('mz_scan_completion_drafts',{rows:[row]});
  await assert.rejects(f.store.ensureSecurityState(),error=>error.code==='custodial_restore_quarantine');
  assert.equal(f.store.getStatus().preservedCounts.scan_completion_drafts,1);assert.deepEqual(f.definitions.get('mz_scan_completion_drafts').rows,[row]);
  await assert.rejects(f.remove(),error=>error.code==='custodial_pending_work');assert.equal(f.remote,0);
 }
});
await test('explicitly enumerated absent or empty draft database permits existing zero-work removal',async()=>{
 for(const present of [false,true]){
  const f=fixture();await f.store.setEnrollment({deviceId:'KIOSK_08',credential:'synthetic-only-credential'});
  if(present)f.definitions.set('mz_scan_completion_drafts',{rows:[]});
  await f.remove();assert.equal(f.remote,1);assert.equal(f.store.getStatus().state,'unenrolled');assert.equal(f.secure.size,0);
  if(present)assert.deepEqual(f.definitions.get('mz_scan_completion_drafts').rows,[]);assert.equal(f.opens,f.closes);
 }
});
console.log(JSON.stringify({passed,failed,proof:'actual credential-store with synthetic Storage/IDB events; no device or independent review'}));
process.exitCode=failed?1:0;
