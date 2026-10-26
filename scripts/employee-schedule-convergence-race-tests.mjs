import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {scheduleLocks} from './synthetic-schedule-locks.mjs';
const html=readFileSync(new URL('../employee-schedule.html',import.meta.url),'utf8');
const browserWriterOnly=process.argv.includes('--browser-writer-only');
const originalWriterOnly=process.argv.includes('--original-writer-only')||browserWriterOnly;
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1]
 .replace("void load('launch');",originalWriterOnly?"globalThis.testPage={load,snapshot,atomic,captureSecurity,identity,key,isIdle:()=>!loading&&!queued};":"globalThis.testPage={load,snapshot,isIdle:()=>!loading&&!queued};");
const helper=readFileSync(new URL('../memphis-recurring-schedule-target.js',import.meta.url),'utf8');
const id=n=>`95000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=s=>createHash('sha256').update(s).digest('hex');
const flat=x=>'{'+Object.keys(x).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(x[k])).join(', ')+'}';
const day='2026-09-28',principal={deviceId:id(1),employeeId:id(2),credentialId:id(3),assignmentEpoch:7};
const key='mz_employee_schedule_snapshot:race-principal';
function payload(revision,blocked=false,date=day){
 const view={schema:'static-weekly.recurring-render-view.v1',service_date:date,employee_id:id(2),employee_name:'Fixture',
  publication_id:id(4),projection_id:id(5),projection_status:'current',full_day:true,shift:{start:'07:00',end:'16:00'},
  raw_items:[{name:'Old Area',coverage_start:'07:00',coverage_end:'16:00'}]};
 const target={schema:blocked?'static-weekly.recurring-terminal-target.v1':'static-weekly.recurring-application-target.v1',
  targetType:blocked?'BLOCKED_RECURRING_AUTHORITY':'SCHEDULE',operationId:id(6),publicationId:id(4),serviceDate:date,authorityRevision:revision,
  ...principal,...(blocked?{invalidationId:id(7),reasonCode:'ROSTER_DEPENDENCY_CHANGED'}:{projectionId:id(5),lunchDocumentIdentity:'a'.repeat(64),viewDigest:sha(JSON.stringify(view))})};
 return {...view,canonical_device_id:'KIOSK_08',canonical_device_pk:id(1),credential_id:id(3),assignment_epoch:7,
  ...(blocked?{projection_status:'blocked_recurring_authority',raw_items:[],shift:null}:{}),
  schedule_delivery_mode:blocked?'RECURRING_TERMINAL':'RECURRING_SCHEDULE',recurring_delivery:{intentId:id(revision),target,targetDigest:sha(flat(target)),
   applicationStatus:'PENDING',...(blocked?{replacementCoverageReady:false}:{view,viewJsonText:JSON.stringify(view),viewDigest:target.viewDigest})}};
}
function fixture({importModuleDynamically}={}){
 const stored=new Map(),nodes=new Map(),events=new Map(),calls=[];let readFails=false,writeFails=false,after=()=>{},next=payload(19),status={ready:true,available:true,quarantined:false};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',hidden:false,addEventListener(){}});return nodes.get(id);};
 const now=Date.parse(day+'T17:00:00Z'),FixedDate=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 const context=vm.createContext({Date:FixedDate,Intl,URL,console,crypto:webcrypto,TextEncoder,AbortController,
  document:{getElementById:node,addEventListener(){},hidden:false},setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){},
  localStorage:{getItem:k=>{if(readFails)throw Error('unreadable storage');return stored.get(k)??null;},setItem:(k,v)=>{if(writeFails)throw Error('failed storage');stored.set(k,v);}},
  fetch:async()=>{calls.push('GET');return{ok:true,json:async()=>({ok:true,data:structuredClone(next)})};}});
 context.window={navigator:{locks:scheduleLocks},crypto:webcrypto,addEventListener:(name,fn)=>events.set(name,fn),MemphisCustodialSecurity:{native:true,
  getStatus:()=>({...status,deviceId:'KIOSK_08',principal:{employee_id:id(2),credential_id:id(3),assignment_epoch:7}}),
  mutateProtectedWork:async fn=>{const result=fn();after();return result;}},
  MemphisMobile:{ready:Promise.resolve(),deviceId:()=> 'KIOSK_08',principalIdentity:()=> 'race-principal',
   profileMatchesPrincipal:d=>d.employee_id===id(2)&&d.credential_id===id(3)&&d.assignment_epoch===7,
   requestJson:async(path)=>{calls.push(path);return{};}}};
 vm.runInContext(helper,context);vm.runInContext(inline,context,importModuleDynamically?{importModuleDynamically}:undefined);
 const put=async(data)=>{const prepared=await context.window.MemphisRecurringScheduleTarget.prepare({delivery:data.recurring_delivery,expectedPrincipal:principal,serviceDate:data.service_date});
  stored.set(key,JSON.stringify({schema_version:'employee-schedule-snapshot.v2',device_id:'KIOSK_08',principal:'race-principal',data,recurring_target:prepared}));};
 // Observe the actual owner's completion, not a guessed duration for async
 // WebCrypto preparation. The bound fails a stuck owner without waiting for
 // a desired UI value (which could conceal a wrong settled result).
 const settle=async()=>{const deadline=Date.now()+2000;do{await new Promise(resolve=>setImmediate(resolve));
   if(context.testPage.isIdle())return;
   await new Promise(resolve=>setTimeout(resolve,2));
 }while(Date.now()<deadline);assert.fail('Schedule owner did not settle within bounded fixture deadline');};
 return{context,stored,node,events,calls,put,settle,load:()=>context.testPage.load(),cache:()=>JSON.parse(stored.get(key)||'null'),
  set next(v){next=v;},set readFails(v){readFails=v;},set writeFails(v){writeFails=v;},set after(v){after=v;},set status(v){status=v;}};
}
if(browserWriterOnly){await browserWriterCases();}else if(originalWriterOnly){await originalWriterCases();}else{
const results=[];
async function test(name,work){try{await work();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
await test('storage read failure cannot overwrite terminal',async()=>{const f=fixture();await f.put(payload(20,true));f.readFails=true;await f.load();f.readFails=false;assert.equal(f.cache().recurring_target.target.authorityRevision,20);assert.equal(f.node('content').hidden,true);});
await test('corrupt cache is not absence authority',async()=>{const f=fixture();f.stored.set(key,'broken-json');await f.load();assert.equal(f.stored.get(key),'broken-json');assert.equal(f.node('content').hidden,true);});
await test('failed terminal save remains a live revision floor',async()=>{const f=fixture();await f.load();f.next=payload(20,true);const fetch=f.context.fetch;f.context.fetch=async()=>{const result=await fetch();f.writeFails=true;return result;};await f.load();f.context.fetch=fetch;f.writeFails=false;f.next=payload(19);await f.load();assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');});
await test('prior-day response cannot replace current terminal',async()=>{const f=fixture();await f.put(payload(20,true));f.next=payload(19,false,'2026-09-27');await f.load();assert.equal(f.cache().recurring_target.target.authorityRevision,20);assert.equal(f.node('content').hidden,true);});
await test('post-callback newer stored winner must be rendered',async()=>{const f=fixture();await f.load();const staged=fixture();await staged.put(payload(22,true));const row=staged.stored.get(key);
 f.after=()=>f.stored.set(key,row);f.next=payload(21);await f.load();assert.equal(f.cache().recurring_target.target.authorityRevision,22);assert.equal(f.node('content').hidden,true);});
await test('losing legacy result cannot render or ACK after terminal wins',async()=>{const f=fixture(),staged=fixture();await staged.put(payload(22,true));
 const legacy=payload(21);delete legacy.schedule_delivery_mode;delete legacy.recurring_delivery;
 legacy.schedule_application={application_status:'PENDING',intent_id:id(21),authority_revision:21,publication_id:id(4),projection_id:id(5),lunch_document_identity:'a'.repeat(64)};
 f.after=()=>f.stored.set(key,staged.stored.get(key));f.next=legacy;await f.load();
 assert.equal(f.node('content').hidden,true);assert.ok(!f.calls.some(x=>x.endsWith('application-receipt')));});
await test('browser Schedule preserves terminal floor without native storage',async()=>{const f=fixture();f.context.window.MemphisCustodialSecurity.native=false;
 f.next=payload(20,true);await f.load();f.next=payload(19);await f.load();assert.equal(f.node('content').hidden,true);assert.equal(f.stored.size,0);});
await test('quarantine during target preparation cannot write',async()=>{const f=fixture();await f.load();const api=f.context.window.MemphisRecurringScheduleTarget,prepare=api.prepare;
 f.context.window.MemphisRecurringScheduleTarget={...api,prepare:async args=>{const result=await prepare(args);f.status={ready:false,available:false,quarantined:true};f.events.get('memphis:custodial-security-state')({detail:{ready:false,available:false,quarantined:true}});return result;}};
 f.next=payload(21);await f.load();assert.equal(f.cache().recurring_target.target.authorityRevision,19);assert.equal(f.node('content').hidden,true);});
await test('refresh event during preparation queues latest read',async()=>{const f=fixture();await f.load();const api=f.context.window.MemphisRecurringScheduleTarget,prepare=api.prepare;let first=true;
 f.context.window.MemphisRecurringScheduleTarget={...api,prepare:async args=>{const result=await prepare(args);if(first){first=false;f.next=payload(22,true);f.events.get('memphis:schedule-refresh')();}return result;}};
 f.next=payload(21);await f.load();const end=Date.now()+1500;
 while(f.cache()?.recurring_target.target.authorityRevision!==22&&Date.now()<end)await new Promise(r=>setTimeout(r,5));
 assert.equal(f.cache().recurring_target.target.authorityRevision,22);assert.equal(f.node('content').hidden,true);});
console.log(JSON.stringify({scope:'actual Schedule page with synthetic storage, native mutation, invalidation and transport races',passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results},null,2));
process.exitCode=results.some(x=>!x.passed)?1:0;
}
export {fixture,payload,day,key,id,principal};

async function browserWriterCases(){
 const selected=process.argv.find(x=>x.startsWith('--browser-writer-case='))?.slice('--browser-writer-case='.length),done=[];
 const HOLD='mz_custodial_protected_browser_hold.v1',EPOCH='mz_custodial_protected_browser_mutation.v1',LOCK='memphis-custodial-protected-browser-work.v1';
 const realModule=()=>import('../mobile/src/custodial/protected-browser-admission.js');
 function webFixture(options={}){
  const f=fixture({importModuleDynamically:async specifier=>{
   assert.equal(specifier,'./mobile/src/custodial/protected-browser-admission.js');
   if(options.importWait)await options.importWait();return realModule();
  }});f.context.window.MemphisCustodialSecurity.native=false;
  const p=f.context.testPage.captureSecurity().principal,api=f.context.window.MemphisRecurringScheduleTarget;
  return Object.assign(f,{p,api,avKey:api.availabilityKey(p,day),write(){
   return f.context.testPage.atomic(p,()=>api.writeAvailability(f.context.localStorage,p,day,'AVAILABLE',api.availability(f.context.localStorage,p,day)));
  }});
 }
 async function run(name,work){if(selected&&selected!==name)return;await work();done.push(name);console.log('PASS_NEW_SCHEDULE_BROWSER_WRITER '+name);}
 await run('preexisting-hold-retains-availability',async()=>{
  const f=webFixture();f.stored.set(HOLD,'retained original preservation marker');const before=new Map(f.stored);
  await assert.rejects(f.write());assert.deepEqual(f.stored,before);assert.equal(f.stored.has(f.avKey),false);
 });
 await run('shared-lock-wait-cannot-write-through-arriving-hold',async()=>{
  const f=webFixture();let enter,release;const atLock=new Promise(r=>enter=r);
  const prior=scheduleLocks.request(LOCK,{mode:'exclusive'},async()=>{enter();await new Promise(r=>release=r);});await atLock;
  const pending=f.write();f.stored.set(HOLD,'original hold installed while queued');release();await prior;
  await assert.rejects(pending);assert.equal(f.stored.has(f.avKey),false);assert.equal(f.stored.has(EPOCH),false);
 });
 await run('allowed-original-availability-advances-persisted-epoch',async()=>{
  const f=webFixture();await f.write();assert.equal(f.stored.get(EPOCH),'1');assert.equal(f.api.availability(f.context.localStorage,f.p,day).state,'AVAILABLE');
  await f.write();assert.equal(f.stored.get(EPOCH),'2');assert.equal(f.stored.has(key),false,'browser path must not invent a native offline snapshot');
 });
 await run('missing-lock-and-module-wait-storage-replacement-refuse',async()=>{
  const f=webFixture();f.context.window.navigator={};await assert.rejects(f.write());assert.equal(f.stored.size,0);
  let enter,release;const atImport=new Promise(r=>enter=r),g=webFixture({importWait:()=>{enter();return new Promise(r=>release=r);}});
  const pending=g.write();await atImport;const replacement=new Map();g.context.localStorage={getItem:k=>replacement.get(k)??null,setItem:(k,v)=>replacement.set(k,v)};
  release();await assert.rejects(pending);assert.equal(g.stored.size,0);assert.equal(replacement.size,0);
 });
 await run('hold-arriving-across-callback-await-keeps-attempt-and-refuses-result',async()=>{
  const f=webFixture();let enter,release;const atCallback=new Promise(r=>enter=r);
  const pending=f.context.testPage.atomic(f.p,async()=>{f.stored.set(f.avKey,'retained attempted availability');enter();await new Promise(r=>release=r);return 'not success';});
  await atCallback;f.stored.set(HOLD,'original hold appeared');release();await assert.rejects(pending);
  assert.equal(f.stored.get(f.avKey),'retained attempted availability');assert.equal(f.stored.get(EPOCH),'1');
 });
 await run('superseded-import-caller-cannot-poison-next-current-owner',async()=>{
  let enter,release,owned=true,writes=0;const atImport=new Promise(r=>enter=r),f=webFixture({importWait:()=>{enter();return new Promise(r=>release=r);}});
  const first=f.context.testPage.atomic(f.p,()=>{writes++;},()=>owned);await atImport;owned=false;release();await assert.rejects(first);
  assert.equal(writes,0);assert.equal(f.stored.size,0);await f.write();assert.equal(f.stored.get(EPOCH),'1');
  assert.equal(f.api.availability(f.context.localStorage,f.p,day).state,'AVAILABLE');
 });
 assert(done.length,'unknown browser writer case');console.log(JSON.stringify({new_groups:done.length,old_groups:0,scope:'actual page atomic and actual browser admission module; synthetic storage/locks only',browser:false,native:false,SQL:false,ACK:false}));
}

async function originalWriterCases(){
 const requested=process.argv.find(arg=>arg.startsWith('--original-writer-case='))?.slice('--original-writer-case='.length),completed=[];
 const denied=error=>Boolean(error&&['schedule_cached_state_unavailable','schedule_request_invalidated','custodial_security_generation_changed'].includes(error.code));
 function writerFixture({beforeNative,afterNative,contextFault,web=false}={}){
  const f=fixture(),nativeCalls=[];let closedChecks=0,checks=0;
  const status={ready:true,available:true,quarantined:false,generation:7,deviceId:'KIOSK_08',principal:{
   schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(2),credential_id:id(3),assignment_epoch:7,
   credential_operation_id:id(8),installation_seal:'synthetic-original-installation-seal',enrolled_at:'2026-09-28T00:00:00.000Z'}};
  const mobile=f.context.window.MemphisMobile;mobile.edition='custodial';
  const security=f.context.window.MemphisCustodialSecurity;security.getStatus=()=>status;
  security.mutateProtectedWork=async function(operation,options){
   assert.equal(this,security);nativeCalls.push(options);if(beforeNative)await beforeNative();
   if(options?.expectedGeneration!=null&&options.expectedGeneration!==status.generation)throw Object.assign(Error('native generation changed'),{code:'custodial_security_generation_changed'});
   let active=true;const context={generation:status.generation,deviceId:status.deviceId,assertCurrent(){checks++;
    if(!active){closedChecks++;throw Error('closed context');}
    if(context.generation!==status.generation||context.deviceId!==status.deviceId)throw Object.assign(Error('native generation changed'),{code:'custodial_security_generation_changed'});
   }};if(contextFault)contextFault(context);
   let result;try{result=await operation(context);}finally{active=false;}if(afterNative)await afterNative();return result;
  };
  if(web){security.native=false;delete mobile.edition;}
  Object.defineProperty(f,'status',{value:status,enumerable:true,configurable:true});
  return Object.assign(f,{nativeCalls,mobile,security,checks:()=>checks,closedChecks:()=>closedChecks});
 }
 async function check(name,work){if(requested&&requested!==name)return;await work();completed.push(name);console.log('PASS_NEW_SCHEDULE_WRITER '+name);}
 await check('schedule-lock-wait-cannot-adopt-successor-generation',async()=>{
  const f=writerFixture();await f.put(payload(20,true));const before=new Map(f.stored);let release,entered,writes=0;
  const acquired=new Promise(resolve=>{entered=resolve;}),held=f.context.window.MemphisRecurringScheduleTarget.withScheduleLock('race-principal',async()=>{entered();await new Promise(resolve=>{release=resolve;});});
  await acquired;const pending=f.context.testPage.atomic('race-principal',()=>{writes++;f.stored.set(key,'must not replace original');}).then(()=>null,error=>error);
  f.status.generation++;release();await held;const error=await pending;
  assert.equal(writes,0,'original schedule-lock waiter must not adopt successor generation');assert(denied(error));assert.deepEqual(f.stored,before);assert.equal(f.closedChecks(),0);
 });
 await check('native-FIFO-wait-pins-generation-principal-runtime-and-methods',async()=>{
  for(const fault of ['generation','principal','runtime','mobile','mutate','status-method','principal-method','device-method']){
   let release,entered,writes=0;const queued=new Promise(resolve=>{entered=resolve;}),f=writerFixture({beforeNative:()=>{entered();return new Promise(resolve=>{release=resolve;});}});
   await f.put(payload(20,true));const before=new Map(f.stored);
   const pending=f.context.testPage.atomic('race-principal',()=>{writes++;f.stored.set(key,'must not replace original');}).then(()=>null,error=>error);await queued;
   if(fault==='generation')f.status.generation++;
   if(fault==='principal')f.status.principal.installation_seal='changed retained installation seal';
   if(fault==='runtime')f.context.window.MemphisCustodialSecurity={...f.security};
   if(fault==='mobile')f.context.window.MemphisMobile={...f.mobile};
   if(fault==='mutate')f.security.mutateProtectedWork=async()=>{};
   if(fault==='status-method')f.security.getStatus=()=>f.status;
   if(fault==='principal-method')f.mobile.principalIdentity=()=> 'race-principal';
   if(fault==='device-method')f.mobile.deviceId=()=> 'KIOSK_08';
   release();assert(denied(await pending),fault);assert.equal(writes,0,fault);assert.deepEqual(f.stored,before);assert.equal(f.closedChecks(),0);
  }
 });
 await check('missing-noncallable-and-foreign-native-checkpoints-refuse',async()=>{
  for(const fault of [context=>{delete context.assertCurrent;},context=>{context.assertCurrent=null;},context=>{context.assertCurrent=1;},
   context=>{context.generation=8;},context=>{context.deviceId='KIOSK_09';}]){
   const f=writerFixture({contextFault:fault});let writes=0;const error=await f.context.testPage.atomic('race-principal',()=>{writes++;}).then(()=>null,error=>error);
   assert(denied(error));assert.equal(writes,0);assert.equal(f.closedChecks(),0);
  }
 });
 await check('same-original-success-uses-stable-cache-key-and-pinned-native-options',async()=>{
  const f=writerFixture();await f.put(payload(20,true));const raw=f.stored.get(key),before=f.context.testPage.captureSecurity();
  let writes=0;assert.equal(await f.context.testPage.atomic('race-principal',()=>{writes++;return 'original result';}),'original result');
  assert.equal(writes,1);assert.equal(f.nativeCalls.length,1);assert.equal(f.nativeCalls[0].expectedGeneration,7);assert.equal(f.nativeCalls[0].requireEnrollment,true);
  assert.equal(f.closedChecks(),0);assert(f.checks()>=2);assert.equal(f.stored.get(key),raw);
  f.status.generation++;const after=f.context.testPage.captureSecurity();assert.equal(after.principal,before.principal);
  assert.equal(f.context.testPage.key(after.principal),key,'native generation is never part of persisted cache identity');
  assert.equal(await f.context.testPage.atomic('race-principal',()=> 'new explicit current operation'),'new explicit current operation');
  assert.equal(f.nativeCalls[1].expectedGeneration,8);assert.equal(f.stored.get(key),raw);
 });
 await check('post-operation-and-after-closed-native-promise-loss-refuse-without-rollback',async()=>{
  let release,entered;const called=new Promise(resolve=>{entered=resolve;}),f=writerFixture();
  const pending=f.context.testPage.atomic('race-principal',async()=>{f.stored.set(key,'retained attempted original');entered();await new Promise(resolve=>{release=resolve;});return 'not success';}).then(()=>null,error=>error);
  await called;f.status.principal.assignment_epoch++;release();assert(denied(await pending));assert.equal(f.stored.get(key),'retained attempted original');assert.equal(f.closedChecks(),0);
  let settle,closed;const atClosed=new Promise(resolve=>{closed=resolve;}),g=writerFixture({afterNative:()=>{closed();return new Promise(resolve=>{settle=resolve;});}});
  const result=g.context.testPage.atomic('race-principal',()=> 'not final success').then(()=>null,error=>error);await atClosed;g.status.generation++;settle();
  assert(denied(await result));assert.equal(g.closedChecks(),0);
 });
 await check('native-bootstrap-hints-loss-and-unreadable-runtime-stay-held',async()=>{
  for(const marker of [{MemphisMobileBuildIdentity:{edition:'custodial'}},{MemphisMobile:{edition:'custodial'}},{Capacitor:{isNativePlatform:()=>true}},
   {Capacitor:{getPlatform:()=> 'android'}},{Capacitor:{getPlatform:()=> 'ios'}}]){
   const f=writerFixture();await f.put(payload(20,true));const before=new Map(f.stored);delete f.context.window.MemphisCustodialSecurity;
   delete f.context.window.MemphisMobile.edition;Object.assign(f.context.window,marker);
   assert.equal(f.context.testPage.captureSecurity(),null);delete f.context.window.MemphisMobileBuildIdentity;delete f.context.window.Capacitor;
   f.context.window.MemphisMobile={deviceId:()=> 'KIOSK_08'};assert.equal(f.context.testPage.captureSecurity({recover:true}),null);
   let writes=0;const error=await f.context.testPage.atomic('race-principal',()=>{writes++;}).then(()=>null,error=>error);
   assert(denied(error));assert.equal(writes,0);assert.deepEqual(f.stored,before);
  }
  const f=writerFixture();Object.defineProperty(f.context.window,'MemphisCustodialSecurity',{configurable:true,get(){throw Error('unreadable native runtime');}});
  assert.equal(f.context.testPage.captureSecurity(),null);delete f.context.window.MemphisCustodialSecurity;
  assert.equal(f.context.testPage.captureSecurity({recover:true}),null);
 });
 await check('never-marked-web-stays-online-only-and-explicit-native-recovery-can-observe',async()=>{
  const f=writerFixture({web:true}),captured=f.context.testPage.captureSecurity();assert.equal(captured.native,false);
  assert.equal(captured.principal,'online-only:KIOSK_08');let calls=0;
  assert.equal(await f.context.testPage.atomic(captured.principal,()=>{calls++;return 'web';}),'web');assert.equal(calls,1);assert.equal(f.nativeCalls.length,0);
  const g=writerFixture();g.status.ready=false;assert.equal(g.context.testPage.captureSecurity(),null);
  g.status.ready=true;assert.equal(g.context.testPage.captureSecurity(),null,'quarantine is not silently thawed');
  assert.equal(g.context.testPage.captureSecurity({recover:true}).principal,'race-principal','normal explicit recovery observer remains supported');
 });
 assert(completed.length,'unknown/empty original writer selection');
 console.log(JSON.stringify({scope:'actual Schedule callbacks with existing DOMVM/locks and synthetic native context/storage',new_groups:completed.length,cases:completed,
  old_cases_executed:0,browser:false,SQL:false,native_auth:false,phone:false}));
}
