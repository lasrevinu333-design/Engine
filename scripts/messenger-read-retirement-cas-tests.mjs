// Actual callback, synthetic storage/API only. No browser/device/network.
import assert from 'node:assert/strict';import {test} from 'node:test';
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import crypto from 'node:crypto';
const root=path.resolve(new URL('..',import.meta.url).pathname),sourcePath=path.join(root,'mobile/src/chatscope/app.jsx'),source=fs.readFileSync(sourcePath,'utf8');
const a=source.indexOf('  const flushReadOutbox = useCallback('),z=source.indexOf('\n  const markRead = useCallback',a);assert.ok(a>0&&z>a);const callback=source.slice(a,z);
const uuid=n=>`55000000-0000-4000-8000-${String(n).padStart(12,'0')}`,user=uuid(1),thread=uuid(2),key=`mz_chatscope_read_outbox:${user}:${thread}`;
const original={schema_version:'chatscope-read-outbox.v2',id:`${user}:${thread}`,thread_id:thread,user_id:user,device_id:'KIOSK_08',through_message_id:uuid(3),through_at:'2026-10-08T21:50:00Z',created_at:1,security_generation:1},newer={...original,through_message_id:uuid(4),through_at:'2026-10-08T21:51:00Z',created_at:2};
function harness(initial=original,{replaceAt=null,rejectAPI=false,changeIdentity=false}={}){
 const store=new Map([[key,JSON.stringify(initial)]]),calls=[];let replaced=false;
 const identityRef={current:{msg_user_id:user}},accessEpoch={current:1},mounted={current:true};
 const mapped=identityRef.current;let held=false;
 const storage={get length(){return store.size;},key:i=>[...store.keys()][i]??null,getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 const api=async(url,options)=>{calls.push({url,through:options.body.through_message_id,user:options.body.user_id,device:options.body.device_id});if(rejectAPI)throw new Error('synthetic transport loss');if(replaceAt==='API'&&!replaced){storage.setItem(key,JSON.stringify(newer));replaced=true;}if(changeIdentity)accessEpoch.current++;return{ok:true,data:1};};
 const mutateCustodialWork=async(operation)=>{if(replaceAt==='mutation'&&!replaced){storage.setItem(key,JSON.stringify(newer));replaced=true;}return operation();};
 // Current callback requires an explicit owner/epoch. This member tests the
 // manager CAS retirement only; auth, native original admission and HTTP are seams.
 const context=vm.createContext({useCallback:fn=>fn,identityRef,accessEpoch,mounted,
  EMPLOYEE_CONTEXT:false,custodialEmployeeMessage:()=>false,hasEmployeeMessagePins:row=>Object.hasOwn(row||{},'expected_employee_id'),
  originalManagerOutboxOwner:()=>()=>{if(identityRef.current!==mapped||accessEpoch.current!==1||!mounted.current)throw Error('synthetic owner changed');},
  setHeldReadOriginals:value=>{held=value;},currentDeviceId:'KIOSK_08',localStorage:storage,mutateCustodialWork,api});
 new vm.Script(callback+'\nglobalThis.flush=flushReadOutbox;',{filename:sourcePath+':actual-flushReadOutbox'}).runInContext(context,{timeout:1000});
 return{flush:()=>context.flush(),get:()=>storage.getItem(key),held:()=>held,calls};
}
test('exact unchanged accepted acknowledgement retires only its original key',async()=>{const h=harness();await h.flush();assert.equal(h.get(),null);assert.deepEqual(h.calls.map(x=>x.through),[original.through_message_id]);});
test('newer horizon written during HTTP survives and converges on the next flush',async()=>{const h=harness(original,{replaceAt:'API'});await h.flush();assert.equal(h.get(),JSON.stringify(newer));await h.flush();assert.equal(h.get(),null);assert.deepEqual(h.calls.map(x=>x.through),[original.through_message_id,newer.through_message_id]);});
test('unknown legacy original is held without an attempted mutation or send',async()=>{const row={...original,schema_version:'legacy-unbound'},h=harness(row,{replaceAt:'mutation'});await h.flush();assert.equal(h.get(),JSON.stringify(row));assert.equal(h.calls.length,0);assert.equal(h.held(),true);});
test('HTTP rejection keeps exact original pending bytes',async()=>{const h=harness(original,{rejectAPI:true});await h.flush();assert.equal(h.get(),JSON.stringify(original));assert.equal(h.calls.length,1);});
test('another identity pending acknowledgement is neither sent nor erased',async()=>{for(const row of [{...original,user_id:uuid(9)},{...original,device_id:'KIOSK_09'}]){const h=harness(row);await h.flush();assert.equal(h.get(),JSON.stringify(row));assert.equal(h.calls.length,0);}});
test('employee-pinned original never enters manager read retirement',async()=>{const row={...original,expected_employee_id:uuid(8)},h=harness(row);await h.flush();assert.equal(h.get(),JSON.stringify(row));assert.equal(h.calls.length,0);assert.equal(h.held(),true);});
test('manager identity change during acknowledgement cannot retire original',async()=>{const h=harness(original,{changeIdentity:true});await h.flush();assert.equal(h.get(),JSON.stringify(original));assert.equal(h.calls.length,1);});
console.log(JSON.stringify({scope:'actual read-retirement callback only',source_sha256:crypto.createHash('sha256').update(source).digest('hex'),callback_sha256:crypto.createHash('sha256').update(callback).digest('hex'),synthetic_storage_API:true,browser:false,network:false,SQL:false,phone:false}));
