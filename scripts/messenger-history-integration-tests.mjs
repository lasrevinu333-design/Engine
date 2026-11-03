import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createMessageHistory } from '../mobile/src/chatscope/message-history.mjs';
const source=readFileSync(new URL('../mobile/src/chatscope/app.jsx',import.meta.url),'utf8');
const start=source.indexOf('  const loadMessages = useCallback('),end=source.indexOf('  const selectThread = useCallback(',start);
assert.ok(start>0&&end>start);
const id=n=>`dd000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const all=Array.from({length:201},(_,i)=>({id:id(i+1),body:'synthetic',sent_at:'2026-10-31T12:00:00.123456Z',updated_at:'2026-10-31T12:00:00.123456Z'}));
function fixture(){
 let messages=[],earlier=false,reads=0;const requests=[];
 const mapped={msg_user_id:id(999),read_only:false};
 const state={identityRef:{current:mapped},accessEpoch:{current:1},selectedRef:{current:id(888)},mounted:{current:true},historyRef:{current:null},messageLoadSequence:{current:0},threadsRef:{current:[]},mobileThreadRef:{current:false},currentDeviceId:'synthetic-device',EMPLOYEE_CONTEXT:false,
  useCallback:fn=>fn,createMessageHistory,loadIdentity:async()=>mapped,originalManagerOutboxOwner:()=>()=>{},custodialWorkUnavailable:()=>Error('Stale actor'),
  setMessages:value=>{messages=typeof value==='function'?value(messages):value;},setLoadingMessages:()=>{},setLoadingOlderMessages:()=>{},setHasOlderMessages:value=>{earlier=value;},mergePendingMessages:rows=>rows,
  markRead:async()=>{reads++;},window:{matchMedia:()=>({matches:false})},document:{visibilityState:'hidden'},encodeURIComponent,
  api:async path=>{requests.push(path);return {data:path.includes('before=')?all.slice(0,1):all.slice(1)};},
 };
 vm.createContext(state);vm.runInContext(source.slice(start,end)+'\nglobalThis.load=loadMessages;globalThis.older=typeof loadEarlierMessages === "function" ? loadEarlierMessages : null;',state);
 return {state,load:state.load,older:state.older,messages:()=>messages,earlier:()=>earlier,reads:()=>reads,requests};
}
let passed=0;const failures=[];async function check(name,run){try{await run();passed++;}catch(error){failures.push({name,error:error.message});}}
await check('actual reader exposes and retains row 201 across refresh with strict tied-time cursor',async()=>{
 const f=fixture();await f.load();assert.equal(typeof f.older,'function','older-message callback required');assert.equal(f.earlier(),true);
 await f.older();assert.equal(f.messages().length,201);assert.match(f.requests[1],/before=2026-10-31T12%3A00%3A00.123456Z&before_id=dd000000-0000-4000-8000-000000000002/);
 await f.load();assert.equal(f.messages().length,201);assert.equal(f.earlier(),false);assert.equal(f.reads(),0);
});
await check('late older page after thread switch cannot publish or acknowledge read',async()=>{
 const f=fixture();await f.load();assert.equal(typeof f.older,'function');let complete;f.state.api=()=>new Promise(resolve=>{complete=resolve;});
 const pending=f.older();f.state.selectedRef.current=id(887);complete({data:all.slice(0,1)});await pending;assert.equal(f.messages().length,200);assert.equal(f.reads(),0);
});
await check('late older page after actor epoch change cannot publish',async()=>{
 const f=fixture();await f.load();assert.equal(typeof f.older,'function');let complete;f.state.api=()=>new Promise(resolve=>{complete=resolve;});
 const pending=f.older();f.state.accessEpoch.current++;complete({data:all.slice(0,1)});await pending;assert.equal(f.messages().length,200);
});
await check('duplicate earlier requests share one flight while latest refresh is safe',async()=>{
 const f=fixture();await f.load();assert.equal(typeof f.older,'function');let complete,calls=0;f.state.api=path=>{calls++;return path.includes('before=')?new Promise(resolve=>{complete=resolve;}):Promise.resolve({data:all.slice(1)});};
 const pending=f.older();await f.older();await f.load();complete({data:all.slice(0,1)});await pending;assert.equal(calls,2);assert.equal(f.messages().length,201);
});
await check('earlier control is wired to the owning callback and actual busy state',async()=>{
 assert.ok(/onClick=\{\(\) => void loadEarlierMessages\(\)/.test(source),'earlier callback wired');assert.ok(/loadingMore=\{loadingOlderMessages\}/.test(source),'busy state wired');
 assert.ok(/historyRef\.current\.state\.updates\(envelope\.data\)/.test(source),'live tombstones merged');
});
console.log(JSON.stringify({scope:'Exact shipped-source reader callbacks in VM; synthetic pages and deferred actor/thread races',passed,failed:failures.length,failures},null,2));if(failures.length)process.exitCode=1;
