import test from 'node:test';
import assert from 'node:assert/strict';
import {createActiveGpsLifecycle,resolveActiveGpsSession} from '../mobile/src/custodial/active-gps-lifecycle.js';
const sid='10000000-0000-4000-8000-000000000001',employee='20000000-0000-4000-8000-000000000001';
const started=Date.parse('2026-10-06T12:00:00Z'),position={coords:{latitude:35.15,longitude:-90.04,accuracy:8},timestamp:started+60000};
function fixture({geo,enqueue,now}={}){
 const row={session_uuid:sid,client_session_id:sid,status:'active',device_id:'KIOSK_08',location_code:'NOCX',employee_id:employee,started_at:new Date(started).toISOString()};
 const map=new Map([['session:'+sid,JSON.stringify(row)]]),queued=[],states=[],timers=new Map();let n=0;
 const storage={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null};
 const lifecycle=createActiveGpsLifecycle({storage,deviceId:()=> 'KIOSK_08',now,enqueue:enqueue|| (async a=>queued.push(a)),geolocation:geo||{getCurrentPosition:done=>done(position)},onStatus:s=>states.push(s),setTimer:()=>1,clearTimer:()=>{},setCaptureTimer:fn=>{timers.set(++n,fn);return n;},clearCaptureTimer:id=>timers.delete(id)});
 return{row,map,storage,queued,states,timers,lifecycle,update:p=>map.set('session:'+sid,JSON.stringify({...row,...p}))};
}
for(const value of[null,'',true,false,'35.15'])test('invalid coordinate is not coerced: '+JSON.stringify(value),async()=>{const f=fixture({geo:{getCurrentPosition:done=>done({...position,coords:{...position.coords,latitude:value}})}});try{assert.equal((await f.lifecycle.capture()).state,'gps_unavailable');assert.equal(f.queued.length,0);}finally{f.lifecycle.dispose();}});
test('zero coordinates remain valid measurements, not missing values',async()=>{const f=fixture({geo:{getCurrentPosition:done=>done({...position,coords:{latitude:0,longitude:0,accuracy:8}})}});try{assert.equal((await f.lifecycle.capture()).state,'queued');}finally{f.lifecycle.dispose();}});
test('failed enqueue does not consume sample or prevent retry',async()=>{let attempts=0;const f=fixture({enqueue:async()=>{attempts++;if(attempts===1)throw Error('storage unavailable');}});try{assert.equal((await f.lifecycle.capture()).state,'queue_unavailable');assert.equal((await f.lifecycle.capture()).state,'queued');assert.equal(attempts,2);}finally{f.lifecycle.dispose();}});
for(const patch of[{location_code:'AQUARIUM'},{employee_id:'20000000-0000-4000-8000-000000000002'},{started_at:'2026-10-06T12:00:30Z'}])test('same UUID cannot conceal changed active context '+Object.keys(patch)[0],async()=>{let done;const f=fixture({geo:{getCurrentPosition:fn=>done=fn}});try{const task=f.lifecycle.capture();f.update(patch);done(position);assert.equal((await task).state,'session_changed');assert.equal(f.queued.length,0);}finally{f.lifecycle.dispose();}});
test('capture older than Start is advisory unavailable, not current work evidence',async()=>{const f=fixture({geo:{getCurrentPosition:done=>done({...position,timestamp:started-1})}});try{assert.equal((await f.lifecycle.capture()).state,'stale_capture');assert.equal(f.queued.length,0);}finally{f.lifecycle.dispose();}});
test('different records sharing one occurrence UUID are ambiguous',()=>{const f=fixture();try{f.map.set('session:duplicate',JSON.stringify({...f.row,location_code:'OTHER'}));assert.equal(resolveActiveGpsSession(f.storage,'KIOSK_08').state,'ambiguous');}finally{f.lifecycle.dispose();}});
test('provider that never calls back is bounded and later captures can recover',async()=>{let done;const f=fixture({geo:{getCurrentPosition:fn=>done=fn}});try{const pending=f.lifecycle.capture();assert.equal(f.timers.size,1);[...f.timers.values()][0]();assert.equal((await pending).state,'gps_unavailable');const next=f.lifecycle.capture();done(position);assert.equal((await next).state,'queued');assert.equal(f.timers.size,0);}finally{f.lifecycle.dispose();}});
test('dispose settles only owned capture and ignores late provider callbacks',async()=>{let done;const f=fixture({geo:{getCurrentPosition:fn=>done=fn}});const pending=f.lifecycle.capture();f.lifecycle.dispose();assert.equal(await Promise.race([pending.then(v=>v.state),new Promise(resolve=>setTimeout(()=>resolve('unsettled'),25))]),'disposed');done(position);assert.equal(f.queued.length,0);assert.equal(f.timers.size,0);});
test('a successfully queued original sample is not announced after disposal',async()=>{let settle;const f=fixture({enqueue:()=>new Promise(r=>settle=r)});const pending=f.lifecycle.capture();await Promise.resolve();await Promise.resolve();f.lifecycle.dispose();settle();await pending;assert.equal(f.states.some(s=>s.state==='queued'),false);});
test('future capture is rejected without consuming the next fresh sample',async()=>{
 const now=started+60000;let timestamp=now+30001;
 const f=fixture({now:()=>now,geo:{getCurrentPosition:done=>done({...position,timestamp})}});
 try{assert.equal((await f.lifecycle.capture()).state,'gps_future_clock');assert.equal(f.queued.length,0);assert.equal(f.lifecycle.state().lastObservedAt,null);
  timestamp=now;assert.equal((await f.lifecycle.capture()).state,'queued');assert.equal(f.queued.length,1);assert.equal(f.queued[0].payload.p_observed_at,new Date(now).toISOString());
 }finally{f.lifecycle.dispose();}
});
test('existing thirty-second clock lead boundary remains accepted',async()=>{
 const now=started+60000;
 const f=fixture({now:()=>now,geo:{getCurrentPosition:done=>done({...position,timestamp:now+30000})}});
 try{assert.equal((await f.lifecycle.capture()).state,'queued');assert.equal(f.queued.length,1);}finally{f.lifecycle.dispose();}
});
test('phone clock correction recovers while retaining original queued capture time',async()=>{
 const fresh=started+60000;let clock=fresh+86400000,timestamp=clock;
 const f=fixture({now:()=>clock,geo:{getCurrentPosition:done=>done({...position,timestamp})}});
 try{assert.equal((await f.lifecycle.capture()).state,'queued');clock=fresh;timestamp=fresh;
  assert.equal((await f.lifecycle.capture()).state,'queued');assert.equal(f.queued.length,2);
  assert.equal(f.queued[0].payload.p_observed_at,new Date(fresh+86400000).toISOString());
  assert.equal(f.queued[1].payload.p_observed_at,new Date(fresh).toISOString());assert.equal(f.lifecycle.state().lastObservedAt,fresh);
  assert.equal((await f.lifecycle.capture()).state,'duplicate_capture');timestamp=fresh-1;assert.equal((await f.lifecycle.capture()).state,'duplicate_capture');
 }finally{f.lifecycle.dispose();}
});
test('clock recovery enqueue failure retains retry eligibility and original watermark',async()=>{
 const fresh=started+60000;let clock=fresh+86400000,timestamp=clock,attempts=0;
 const f=fixture({now:()=>clock,geo:{getCurrentPosition:done=>done({...position,timestamp})},enqueue:async()=>{if(++attempts===2)throw Error('storage unavailable');}});
 try{assert.equal((await f.lifecycle.capture()).state,'queued');clock=fresh;timestamp=fresh;
  assert.equal((await f.lifecycle.capture()).state,'queue_unavailable');assert.equal(f.lifecycle.state().lastObservedAt,fresh+86400000);
  assert.equal((await f.lifecycle.capture()).state,'queued');assert.equal(attempts,3);assert.equal(f.lifecycle.state().lastObservedAt,fresh);
 }finally{f.lifecycle.dispose();}
});
