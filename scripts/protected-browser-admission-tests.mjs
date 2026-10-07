import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createProtectedBrowserAdmission,PROTECTED_BROWSER_HOLD_KEY as KEY,PROTECTED_BROWSER_LOCK as LOCK}
  from '../mobile/src/custodial/protected-browser-admission.js';

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
let passed=0;const test=async(name,work)=>{await work();passed++;console.log('PASS '+name);};

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
 assert.equal(result.observation.record_count,2);assert.equal(s.getItem('saved-draft'),'last admitted original');
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
 const gate=createProtectedBrowserAdmission({...options,storage:{...s,setItem(){throw Error('quota');}}});
 await reject(gate.holdAndObserve({operationId:ID}),'browser_hold_write_unconfirmed');assert.equal(gate.held(),true);
 await reject(gate.mutate(()=>{}),'browser_hold_missing_after_observation');assert.equal(inspected,0);assert.equal(s.getItem('saved'),'original');
});
await test('write that stores then throws preserves exact retry and saved bytes',async()=>{
 const {s,options}=fixture();const original=s.setItem;let throwing=true;s.setItem=(...args)=>{original(...args);if(throwing)throw Error('uncertain');};
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
console.log(JSON.stringify({passed,failed:0,proof:'actual unmounted browser admission owner with synthetic Storage/Web Locks; no mounted all-writer/native/phone authority'}));
