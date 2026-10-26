import assert from 'node:assert/strict';
import {createSyntheticScheduleLocks} from './synthetic-schedule-locks.mjs';
import {readFileSync} from 'node:fs';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {zooServiceDate,homeBinding,homeIdentity} from '../mobile/src/custodial/home-facts.js';
import {principalIdentity,profileMatchesPrincipal} from '../mobile/src/custodial/protected-principal.js';
const writerOnly=process.argv.includes('--protected-writer-owner-only');
const prelockOnly=process.argv.includes('--schedule-prelock-owner-only'),focusedOnly=writerOnly||prelockOnly;
const html=focusedOnly?'':readFileSync(new URL('../mobile/src/custodial/index.html',import.meta.url),'utf8');
const ids=['home-guest-count','home-guest-details','home-attendance-freshness','home-weather-current','home-weather-icon','home-weather-summary','home-weather-freshness','home-weather-hours','home-hourly-freshness','home-weather-alerts','home-alerts-freshness','home-shift','home-lunch','home-schedule-freshness'];
if(!focusedOnly)for(const id of ids)assert.ok(html.includes(`id="${id}"`),`DOM binding ${id} exists in the actual Home`);
const els=new Map(ids.map(id=>[id,{textContent:'',dataset:{}}])),listeners=[];
const originals={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
const now=Date.now(),stamp=new Date(now).toISOString(),calls=[],storage=new Map();
let timer=null,cleared=false,app;
if(!focusedOnly&&!process.argv.includes('--request-owner-only'))try{
  globalThis.document={getElementById:id=>els.get(id),addEventListener:(name,fn)=>listeners.push([name,fn])};
  globalThis.window={addEventListener:(name,fn)=>listeners.push([name,fn])};
  globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  globalThis.setInterval=(_fn,delay)=>{assert.equal(delay,30000);timer=17;return timer;};
  globalThis.clearInterval=value=>{assert.equal(value,timer);cleared=true;};
  globalThis.fetch=async url=>{calls.push(url);const data=url.includes('current-attendance')?{ok:true,data:{attendance:0,planned:100,source_timestamp:stamp}}:url.includes('api.weather.gov')?{type:'FeatureCollection',features:[]}:{current_units:{time:'unixtime',temperature_2m:'°F',wind_speed_10m:'mp/h'},current:{time:Math.floor(now/1000),temperature_2m:72,weather_code:0,wind_speed_10m:3},hourly_units:{time:'unixtime',temperature_2m:'°F',apparent_temperature:'°F',wind_speed_10m:'mp/h',precipitation_probability:'%'},hourly:{time:Array.from({length:8},(_,i)=>Math.floor(now/3600000)*3600+i*3600),temperature_2m:Array(8).fill(72),apparent_temperature:Array(8).fill(74),weather_code:Array(8).fill(0),wind_speed_10m:Array(8).fill(3),precipitation_probability:Array(8).fill(0)}};return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});};
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const authority={publication_id:'91000000-0000-4000-8000-000000000004',projection_id:'91000000-0000-4000-8000-000000000005'};
  app=installHomeFacts({getProfile:()=>({authenticated:true,canonical_device_id:'KIOSK_08',employee_name:'Fixture Custodian',employee_id:'fixture-employee',credential_id:'fixture-credential'}),getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,security:{mutateProtectedWork:async fn=>fn()},requestJson:async url=>{calls.push(url);return {...authority,service_date:today,employee_id:'fixture-employee',schedule_delivery_mode:'LEGACY_REGISTERED',canonical_device_id:'KIOSK_08',device_id:'KIOSK_08',home_facts:{...authority,service_date:today,employee_id:'fixture-employee',employee_name:'Fixture Custodian',projection_status:'current',shift:{active:true,start:'08:00',end:'17:00'},lunch:{start:'13:00',end:'14:00'}}};}});
  await app.update();
  assert.equal(calls.length,4);assert.equal(els.get('home-guest-count').textContent,'0');
  assert.equal(els.get('home-weather-current').textContent,'72°F · clear');
  assert.equal(els.get('home-weather-summary').textContent,'3 mph · Precipitation 0%');
  assert.equal(els.get('home-weather-freshness').dataset.stale,'false');
  assert.ok(calls.some(url=>url.includes('current=temperature_2m,weather_code,wind_speed_10m')));
  assert.ok(calls.some(url=>url.includes('my-day-summary')));
  assert.equal(els.get('home-shift').textContent,'8:00 AM–5:00 PM');assert.equal(els.get('home-lunch').textContent,'1:00 PM–2:00 PM');
  assert.equal((els.get('home-weather-hours').innerHTML.match(/<li>/g)||[]).length,8);
  assert.match(els.get('home-alerts-freshness').textContent,/No active alerts reported/);
  app.stop();app=null;assert.equal(cleared,true);
  console.log('Custodial original Home DOM bindings: PASS (simulated providers, no phone acceptance claim)');
}finally{
  app?.stop();
  for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
}
// Keep the owning shared-cache regression in the existing Home CI lane.
if(!focusedOnly&&!process.argv.includes('--request-owner-only'))await import('./home-recurring-convergence-tests.mjs');

// Run only the newly affected installed Home request lifecycle. The first
// protected schedule write completes while its asynchronous lock result is
// held, so retirement happens specifically after begin and before transport.
if(process.argv.includes('--request-owner-only')){
  const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
  const cases=['security-event','profile-replacement','disposal','response-security-event','offline-current','same-current'];
  for(const scenario of cases){
    const saved={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch,
      setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
    const originalLocks=Object.getOwnPropertyDescriptor(globalThis.navigator,'locks');
    const nodes=new Map(ids.map(id=>[id,{textContent:'',dataset:{},innerHTML:''}]));
    const events=new Map(),cache=new Map(),entered=deferred(),release=deferred(),transportEntered=deferred(),transportRelease=deferred();
    let profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_name:'Fixture Custodian',employee_id:'fixture-employee',credential_id:'fixture-credential'};
    let first=true,requests=0,controller;
    try{
      globalThis.document={hidden:false,getElementById:id=>nodes.get(id),addEventListener:(name,fn)=>events.set(name,fn)};
      globalThis.window={addEventListener:(name,fn)=>events.set(name,fn)};
      globalThis.localStorage={getItem:key=>cache.get(key)??null,setItem:(key,value)=>cache.set(key,value)};
      globalThis.setInterval=()=>17;globalThis.clearInterval=()=>{};
      globalThis.fetch=async()=>new Response('{}',{status:503});
      Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:{request:async(_name,_options,work)=>{
        const result=await work();
        if(first){first=false;entered.resolve();await release.promise;}
        return result;
      }}});
      const day=zooServiceDate();
      controller=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,
        security:{mutateProtectedWork:async operation=>operation()},requestJson:async()=>{
          requests++;
          if(scenario==='response-security-event'){transportEntered.resolve();await transportRelease.promise;}
          if(scenario==='offline-current')throw Error('No response');
          return {service_date:day,employee_id:'fixture-employee',employee_name:'Fixture Custodian',schedule_delivery_mode:'LEGACY_REGISTERED',
            canonical_device_id:'KIOSK_08',device_id:'KIOSK_08',publication_id:'91000000-0000-4000-8000-000000000004',
            projection_id:'91000000-0000-4000-8000-000000000005',home_facts:{service_date:day,employee_id:'fixture-employee',
              employee_name:'Fixture Custodian',publication_id:'91000000-0000-4000-8000-000000000004',
              projection_id:'91000000-0000-4000-8000-000000000005',projection_status:'current',
              shift:{active:true,start:'08:00',end:'17:00'},lunch:{start:'13:00',end:'14:00'}}};
        }});
      const pending=controller.update();let entryTimeout;
      await Promise.race([entered.promise,new Promise((_,reject)=>{
        entryTimeout=setTimeout(()=>reject(Error(`${scenario}: schedule begin was not reached`)),500);
      })]).finally(()=>clearTimeout(entryTimeout));
      const before=JSON.stringify([...cache]);
      if(scenario==='response-security-event'){
        release.resolve();await transportEntered.promise;
        events.get('memphis:custodial-security-state')({detail:{ready:false,available:false,quarantined:true}});
        transportRelease.resolve();
      }
      if(scenario==='security-event')events.get('memphis:custodial-security-state')({detail:{ready:false,available:false,quarantined:true}});
      if(scenario==='profile-replacement')profile={...profile,employee_id:'replacement-employee'};
      if(scenario==='disposal')controller.stop();
      release.resolve();await pending;
      assert.equal(requests,['same-current','offline-current','response-security-event'].includes(scenario)?1:0,
        `${scenario}: retired request must not reach schedule transport`);
      if(scenario==='same-current')assert.equal(nodes.get('home-shift').textContent,'8:00 AM–5:00 PM');
      else if(scenario==='offline-current'){
        const availability=[...cache].find(([key])=>key.includes(':availability:'));
        assert.equal(JSON.parse(availability[1]).state,'AVAILABLE','current no-response restores the original availability');
      }
      else assert.equal(JSON.stringify([...cache]),before,`${scenario}: retired request must not change availability`);
    }finally{
      release.resolve();transportRelease.resolve();controller?.stop();
      Object.defineProperty(globalThis.navigator,'locks',originalLocks);
      for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
    }
  }
  console.log('Home schedule request owner: 6 affected lifecycle cases passed');
}

if(writerOnly)await homeProtectedWriterCases();
if(prelockOnly)await homeProtectedWriterCases({prelock:true});
async function homeProtectedWriterCases({prelock=false}={}){
  // Actual installed Home DOM/convergence/runtime; all profile, security,
  // providers, Storage and schedule locks below are SYNTHETIC SOURCE ports.
  const selected=process.argv.find(x=>x.startsWith(prelock?'--home-prelock-case=':'--home-writer-case='))?.split('=')[1],completed=[];
  const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
  async function run(name,body){if(selected&&selected!==name)return;await body();completed.push(name);console.log(JSON.stringify({case:name,status:'PASS_SOURCE_DOM_ONLY'}));}
  async function fixture(body){
    const saved={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
    const lockDescriptor=Object.getOwnPropertyDescriptor(globalThis.navigator,'locks'),locks=createSyntheticScheduleLocks();
    const nodes=new Map(ids.map(id=>[id,{textContent:'',dataset:{},innerHTML:''}])),events=new Map(),cache=new Map(),writes=[],mutations=[],intervals=new Set(),entered=deferred(),release=deferred();
    let proof={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:'81000000-0000-4000-8000-000000000001',credential_id:'81000000-0000-4000-8000-000000000002',credential_operation_id:'81000000-0000-4000-8000-000000000003',assignment_epoch:1,installation_seal:'synthetic-home-writer-seal',enrolled_at:'2026-10-14T00:00:00Z'};
    const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_name:'Fixture Custodian',employee_id:proof.employee_id,credential_id:proof.credential_id,assignment_epoch:1};
    let status={ready:true,available:true,quarantined:false,deviceId:'KIOSK_08',generation:1},first=true,requests=0,controller,pending,afterFirst=null,lost=false,badContext='',failWrite=0,held=null,watchLock=false;
    const holderRelease=deferred(),lockQueued=deferred(),lockRequest=locks.request;
    locks.request=function(...args){const result=lockRequest.apply(this,args);if(watchLock)lockQueued.resolve();return result;};
    const principal=principalIdentity(proof),identity={...homeIdentity(profile,'KIOSK_08'),protectedBinding:principal};
    const keys={snapshot:'mz_employee_schedule_snapshot:'+encodeURIComponent(principal),availability:'mz_employee_schedule_snapshot:availability:'+encodeURIComponent(principal),facts:'mz_custodial_home_cache:'+encodeURIComponent(homeBinding(identity))+':facts'};
    const security={native:true,getStatus:()=>({...status,principal:proof}),mutateProtectedWork:async(operation,options)=>{
      const initial=first;first=false;const generation=status.generation;mutations.push(options);
      if(initial){entered.resolve();await release.promise;}
      let open=true;
      const context={generation:badContext==='generation'?generation+1:generation,deviceId:badContext==='device'?'KIOSK_09':'KIOSK_08',
        ...(badContext==='checkpoint'?{}:{assertCurrent:()=>{assert.ok(open);assert.equal(status.ready,true);assert.equal(status.quarantined,false);}})};
      try{const result=operation(badContext==='missing'?undefined:context);if(initial){afterFirst?.();if(lost)throw Error('SYNTHETIC_WRITER_LOST_RESULT');}return result;}finally{open=false;}
    }};
    const mobile={principalIdentity:()=>principalIdentity(proof),profileMatchesPrincipal:p=>profileMatchesPrincipal(p,proof)};
    try{
      globalThis.document={hidden:false,getElementById:id=>nodes.get(id),addEventListener:(name,fn)=>events.set(name,fn)};
      globalThis.window={MemphisCustodialSecurity:security,MemphisMobile:mobile,addEventListener:(name,fn)=>events.set(name,fn)};
      globalThis.localStorage={getItem:key=>cache.get(key)??null,setItem:(key,value)=>{writes.push([key,value]);if(failWrite===writes.length)throw Error('SYNTHETIC_PARTIAL_STORAGE_FAILURE');cache.set(key,value);}};
      globalThis.setInterval=()=>{const handle={};intervals.add(handle);return handle;};globalThis.clearInterval=handle=>intervals.delete(handle);
      globalThis.fetch=async()=>new Response('{}',{status:503});
      Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:locks});
      controller=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,security,requestJson:async()=>{
        requests++;const day=zooServiceDate(),publication_id='91000000-0000-4000-8000-000000000004',projection_id='91000000-0000-4000-8000-000000000005';
        return {...profile,service_date:day,employee_id:profile.employee_id,employee_name:profile.employee_name,schedule_delivery_mode:'LEGACY_REGISTERED',canonical_device_id:'KIOSK_08',device_id:'KIOSK_08',publication_id,projection_id,
          home_facts:{service_date:day,employee_id:profile.employee_id,employee_name:profile.employee_name,publication_id,projection_id,projection_status:'current',shift:{active:true,start:'08:00',end:'17:00'},lunch:{start:'13:00',end:'14:00'}}};
      }});
      await body({nodes,events,cache,writes,mutations,keys,security,mobile,controller,locks,
        patchStatus:x=>{status={...status,...x};},patchProof:x=>{proof={...proof,...x};},after:fn=>{afterFirst=fn;},lose:()=>{lost=true;},context:x=>{badContext=x;},failAt:x=>{failWrite=x;},requests:()=>requests,
        async begin(){pending=controller.update();let timeout;try{await Promise.race([entered.promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('owning protected writer not reached')),500);})]);}finally{clearTimeout(timeout);}},
        async beginPrelock(){
          const holderEntered=deferred(),api=globalThis.MemphisRecurringScheduleTarget;
          held=api.withScheduleLock(principal,async()=>{holderEntered.resolve();await holderRelease.promise;});
          await holderEntered.promise;watchLock=true;release.resolve();pending=controller.update();
          let timeout;try{await Promise.race([lockQueued.promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Home schedule did not queue behind the held lock')),500);})]);}finally{clearTimeout(timeout);}
          assert.equal(mutations.length,0,'capture must not enter native FIFO while waiting for the shared lock');
        },
        async releasePrelock(){holderRelease.resolve();await held;await pending;},
        async settle(){release.resolve();await pending;},async refresh(){await controller.update(true);}
      });
    }finally{
      release.resolve();holderRelease.resolve();controller?.stop();await held?.catch(()=>{});await pending?.catch(()=>{});await Promise.resolve();
      assert.equal(intervals.size,0);assert.equal(locks.pending,0);
      Object.defineProperty(globalThis.navigator,'locks',lockDescriptor);
      for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
    }
  }
  if(!prelock){
  await run('native-generation-change-before-deferred-mutation-refuses',async()=>{
    await fixture(async f=>{await f.begin();f.patchStatus({generation:2});await f.settle();assert.equal(f.writes.length,0);assert.equal(f.requests(),0);assert.equal(f.mutations[0]?.expectedGeneration,1);assert.equal(f.mutations[0]?.requireEnrollment,true);});
  });
  await run('original-raw-rows-cannot-change-before-native-callback',async()=>{
    for(const kind of ['snapshot','availability','facts'])await fixture(async f=>{
      await f.begin();f.cache.set(f.keys[kind],'{ exact changed original '+kind+' }');const original=JSON.stringify([...f.cache]);await f.settle();
      assert.equal(JSON.stringify([...f.cache]),original);assert.equal(f.writes.length,0);assert.equal(f.requests(),0);
    });
  });
  await run('runtime-method-principal-and-live-context-are-required',async()=>{
    for(const change of ['runtime','writer','reader','bridge','identity-reader','matcher','principal','native','missing','checkpoint','generation','device'])await fixture(async f=>{
      await f.begin();
      if(change==='runtime')window.MemphisCustodialSecurity={...f.security};
      if(change==='writer')f.security.mutateProtectedWork=async()=>true;
      if(change==='reader'){const read=f.security.getStatus;f.security.getStatus=()=>read();}
      if(change==='bridge')window.MemphisMobile={...f.mobile};
      if(change==='identity-reader'){const read=f.mobile.principalIdentity;f.mobile.principalIdentity=()=>read();}
      if(change==='matcher'){const matches=f.mobile.profileMatchesPrincipal;f.mobile.profileMatchesPrincipal=p=>matches(p);}
      if(change==='principal')f.patchProof({installation_seal:'synthetic-other-home-installation'});
      if(change==='native')f.security.native=false;
      if(['missing','checkpoint','generation','device'].includes(change))f.context(change);
      await f.settle();assert.equal(f.writes.length,0);assert.equal(f.requests(),0);
    });
  });
  await run('lost-or-withdrawn-settlement-preserves-actual-original-bytes',async()=>{
    for(const change of ['lost','generation','replacement'])await fixture(async f=>{
      if(change==='lost')f.lose();
      f.after(()=>{if(change==='generation')f.patchStatus({generation:2});if(change==='replacement')f.cache.set(f.keys.availability,'{ foreign post-write fence }');});
      await f.begin();await f.settle();assert.equal(f.writes.length,1);assert.equal(f.requests(),0);assert.equal(f.mutations.length,1);
      if(change==='replacement')assert.equal(f.cache.get(f.keys.availability),'{ foreign post-write fence }');
      else assert.equal(JSON.parse(f.cache.get(f.keys.availability)).state,'READING');
    });
  });
  await run('partial-schedule-write-is-not-compensated-or-retried',async()=>{
    await fixture(async f=>{f.failAt(3);await f.begin();await f.settle();assert.equal(f.requests(),1);assert.equal(f.writes.length,3);
      assert.ok(f.cache.has(f.keys.snapshot));assert.equal(JSON.parse(f.cache.get(f.keys.availability)).state,'READING');assert.equal(f.cache.has(f.keys.facts),false);
    });
  });
  await run('unchanged-owner-keeps-shared-cache-and-status-refresh-compatible',async()=>{
    await fixture(async f=>{await f.begin();await f.settle();assert.equal(f.nodes.get('home-shift').textContent,'8:00 AM–5:00 PM');
      assert.ok(f.cache.has(f.keys.snapshot));assert.ok(f.cache.has(f.keys.availability));assert.ok(f.cache.has(f.keys.facts));
      const originalKeys=[...f.cache.keys()].sort();f.patchStatus({generation:9});await f.refresh();assert.deepEqual([...f.cache.keys()].sort(),originalKeys);
      assert.equal(f.nodes.get('home-shift').textContent,'8:00 AM–5:00 PM');assert.ok(f.mutations.some(options=>options?.expectedGeneration===9));
    });
  });
  }else{
    await run('prelock-generation-change-cannot-become-a-new-original',async()=>{
      await fixture(async f=>{await f.beginPrelock();f.patchStatus({generation:2});await f.releasePrelock();
        assert.equal(f.writes.length,0);assert.equal(f.requests(),0);assert.equal(f.mutations.length,0);
      });
    });
    await run('prelock-original-rows-cannot-be-adopted-after-lock-grant',async()=>{
      for(const kind of ['snapshot','availability','facts'])await fixture(async f=>{
        await f.beginPrelock();f.cache.set(f.keys[kind],'{ exact newer prelock '+kind+' }');const original=JSON.stringify([...f.cache]);
        await f.releasePrelock();assert.equal(JSON.stringify([...f.cache]),original);assert.equal(f.writes.length,0);assert.equal(f.requests(),0);assert.equal(f.mutations.length,0);
      });
    });
    await run('prelock-native-owner-and-method-cannot-be-replaced',async()=>{
      for(const change of ['runtime','writer','reader','bridge','identity-reader','principal','native'])await fixture(async f=>{
        await f.beginPrelock();
        if(change==='runtime')window.MemphisCustodialSecurity={...f.security};
        if(change==='writer')f.security.mutateProtectedWork=async()=>true;
        if(change==='reader'){const read=f.security.getStatus;f.security.getStatus=()=>read();}
        if(change==='bridge')window.MemphisMobile={...f.mobile};
        if(change==='identity-reader'){const read=f.mobile.principalIdentity;f.mobile.principalIdentity=()=>read();}
        if(change==='principal')f.patchProof({installation_seal:'synthetic-prelock-successor'});
        if(change==='native')f.security.native=false;
        await f.releasePrelock();assert.equal(f.writes.length,0);assert.equal(f.requests(),0);assert.equal(f.mutations.length,0);
      });
    });
    await run('unchanged-prelock-owner-enters-native-only-under-lock',async()=>{
      await fixture(async f=>{
        await f.beginPrelock();assert.equal(f.writes.length,0);assert.equal(f.requests(),0);await f.releasePrelock();
        assert.equal(f.requests(),1);assert.equal(f.nodes.get('home-shift').textContent,'8:00 AM–5:00 PM');
        assert.ok(f.cache.has(f.keys.snapshot));assert.ok(f.cache.has(f.keys.availability));assert.ok(f.cache.has(f.keys.facts));
        assert.ok(f.mutations.length>=3);assert.ok(f.mutations.every(x=>x?.requireEnrollment===true&&x.expectedGeneration===1));
      });
    });
  }
  assert.ok(completed.length,'Unknown/empty Home writer selector');console.log(JSON.stringify({status:prelock?'HOME_SCHEDULE_PRELOCK_OWNER_SOURCE_DOM_PASS':'HOME_ORIGINAL_WRITER_SOURCE_DOM_PASS',groups:completed.length,cases:completed,actual_installed_dom_runtime_convergence:true,storage_profile_native_and_schedule_locks_synthetic:true,real_network:0,browser:false,SQL:false}));
}
