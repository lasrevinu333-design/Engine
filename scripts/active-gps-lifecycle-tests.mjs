import assert from 'node:assert/strict';
import { createActiveGpsLifecycle, resolveActiveGpsSession } from '../mobile/src/custodial/active-gps-lifecycle.js';

const SESSION_A='10000000-0000-4000-8000-000000000001';
const SESSION_B='20000000-0000-4000-8000-000000000002';
const DEVICE='KIOSK_08';
const row=(sessionId=SESSION_A,status='active')=>({
  session_uuid:sessionId,client_session_id:sessionId,device_id:DEVICE,
  location_code:'NOCX',status,started_at:'2026-09-18T12:00:00.000Z',
});
function storage(...rows){
  const map=new Map(rows.map(item=>[`session:${item.session_uuid}`,JSON.stringify(item)]));
  return {map,get length(){return map.size;},key:i=>[...map.keys()][i]??null,
    getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
}
const tests=[];async function test(name,fn){try{await fn();tests.push({name,passed:true});}catch(error){tests.push({name,passed:false,error:error.message});}}
const geo=({position,wait}={})=>({getCurrentPosition(resolve,reject){
  if(wait)return wait.then(resolve,reject);
  if(position instanceof Error)return reject(position);
  resolve(position??{coords:{latitude:35.15,longitude:-90.04,accuracy:8},timestamp:Date.parse('2026-09-18T18:00:00Z')});
}});
await test('one active session resolves with exact identity',()=>{
  const resolved=resolveActiveGpsSession(storage(row()),DEVICE);
  assert.equal(resolved.state,'active');assert.equal(resolved.session.clientSessionId,SESSION_A);
  assert.equal(resolved.session.locationCode,'NOCX');
});
await test('completed work stops GPS',()=>{
  assert.equal(resolveActiveGpsSession(storage(row(SESSION_A,'pending_submit')),DEVICE).state,'none');
});
await test('wrong-device and ambiguous sessions cannot be sampled',()=>{
  assert.equal(resolveActiveGpsSession(storage({...row(),device_id:'KIOSK_07'}),DEVICE).state,'none');
  assert.equal(resolveActiveGpsSession(storage(row(),row(SESSION_B)),DEVICE).state,'ambiguous');
});
await test('fresh coordinate is queued with original capture time and active identity',async()=>{
  const s=storage(row()),queued=[];
  const lifecycle=createActiveGpsLifecycle({storage:s,deviceId:()=>DEVICE,geolocation:geo(),
    enqueue:async action=>queued.push(action),randomUuid:()=> '30000000-0000-4000-8000-000000000003',
    setTimer:()=>1,clearTimer:()=>{}});
  const result=await lifecycle.reconcile('test');
  assert.equal(result.state,'queued');assert.equal(queued.length,1);
  assert.equal(queued[0].payload.p_session_uuid,SESSION_A);
  assert.equal(queued[0].payload.p_location_code,'NOCX');
  assert.equal(queued[0].payload.p_device_identifier,DEVICE);
  assert.equal(queued[0].payload.p_observed_at,'2026-09-18T18:00:00.000Z');
  lifecycle.dispose();
});
await test('offline-style enqueue failure never changes active work',async()=>{
  const s=storage(row()),states=[];
  const lifecycle=createActiveGpsLifecycle({storage:s,deviceId:()=>DEVICE,geolocation:geo(),
    enqueue:async()=>{throw new Error('queue unavailable')},onStatus:value=>states.push(value),
    setTimer:()=>1,clearTimer:()=>{}});
  assert.equal((await lifecycle.reconcile()).state,'queue_unavailable');
  assert.equal(resolveActiveGpsSession(s,DEVICE).state,'active');
  assert.equal(states.at(-1).state,'queue_unavailable');lifecycle.dispose();
});
await test('missing or invalid capture time is never queued as now',async()=>{
  for(const timestamp of [undefined,null,0,Number.NaN]){
    const queued=[],s=storage(row());
    const lifecycle=createActiveGpsLifecycle({storage:s,deviceId:()=>DEVICE,
      geolocation:geo({position:{coords:{latitude:35.15,longitude:-90.04,accuracy:8},timestamp}}),
      enqueue:async action=>queued.push(action),setTimer:()=>1,clearTimer:()=>{}});
    assert.equal((await lifecycle.reconcile()).state,'gps_unavailable');assert.equal(queued.length,0);lifecycle.dispose();
  }
});
await test('out-of-range coordinates never enter the durable queue',async()=>{
  for(const coords of [{latitude:91,longitude:-90},{latitude:35,longitude:-181}]){
    const queued=[],lifecycle=createActiveGpsLifecycle({storage:storage(row()),deviceId:()=>DEVICE,
      geolocation:geo({position:{coords:{...coords,accuracy:5},timestamp:Date.now()}}),
      enqueue:async action=>queued.push(action),setTimer:()=>1,clearTimer:()=>{}});
    assert.equal((await lifecycle.reconcile()).state,'gps_unavailable');assert.equal(queued.length,0);lifecycle.dispose();
  }
});
await test('late coordinate from a replaced session cannot attach to the next cleaning',async()=>{
  let resolvePosition;const wait=new Promise(resolve=>{resolvePosition=resolve});
  const s=storage(row()),queued=[];
  const lifecycle=createActiveGpsLifecycle({storage:s,deviceId:()=>DEVICE,geolocation:geo({wait}),
    enqueue:async action=>queued.push(action),setTimer:()=>1,clearTimer:()=>{}});
  const pending=lifecycle.reconcile();
  s.map.delete(`session:${SESSION_A}`);s.map.set(`session:${SESSION_B}`,JSON.stringify(row(SESSION_B)));
  resolvePosition({coords:{latitude:35.15,longitude:-90.04,accuracy:5},timestamp:Date.now()});
  assert.equal((await pending).state,'session_changed');assert.equal(queued.length,0);lifecycle.dispose();
});
await test('a new document lifecycle resumes the same active cleaning without changing identity',async()=>{
  const s=storage(row()),queued=[];
  const make=timestamp=>createActiveGpsLifecycle({storage:s,deviceId:()=>DEVICE,
    geolocation:geo({position:{coords:{latitude:35.15,longitude:-90.04,accuracy:5},timestamp}}),
    enqueue:async action=>queued.push(action),randomUuid:()=>crypto.randomUUID(),setTimer:()=>1,clearTimer:()=>{}});
  const first=make(Date.parse('2026-09-18T18:00:00Z'));await first.reconcile('page_one');first.dispose();
  const second=make(Date.parse('2026-09-18T18:01:00Z'));await second.reconcile('page_two');second.dispose();
  assert.equal(queued.length,2);assert.ok(queued.every(action=>action.payload.p_session_uuid===SESSION_A));
});
await test('finish state on next document prevents further location requests',async()=>{
  const s=storage(row()),queued=[];let calls=0;
  const lifecycle=createActiveGpsLifecycle({storage:s,deviceId:()=>DEVICE,
    geolocation:{getCurrentPosition(){calls+=1}},enqueue:async action=>queued.push(action),
    setTimer:()=>1,clearTimer:()=>{}});
  s.map.set(`session:${SESSION_A}`,JSON.stringify(row(SESSION_A,'pending_submit')));
  assert.equal((await lifecycle.reconcile('finish')).state,'none');assert.equal(calls,0);assert.equal(queued.length,0);
  lifecycle.dispose();
});
console.log(JSON.stringify({scope:'Shared active-cleaning GPS lifecycle with synthetic browser geolocation/storage; no physical GPS',passed:tests.filter(t=>t.passed).length,failed:tests.filter(t=>!t.passed).length,tests},null,2));
process.exitCode=tests.some(t=>!t.passed)?1:0;
