import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createSyntheticScheduleLocks} from './synthetic-schedule-locks.mjs';
import {protectedPrincipal,principalIdentity,profileMatchesPrincipal,createProtectedFeedbackIdentity} from '../mobile/src/custodial/protected-principal.js';
const turn=()=>new Promise(r=>setImmediate(r));
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const original={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:uuid(1),
 credential_id:uuid(2),credential_operation_id:uuid(3),assignment_epoch:4,
 installation_seal:'fixture-installation-seal-0001',enrolled_at:'2026-07-01T12:00:00.000Z'};
const changed={...original,employee_id:uuid(5),assignment_epoch:5};
function profile(p,name='Fixture Employee'){return {authenticated:true,canonical_device_id:p.device_id,
 employee_id:p.employee_id,credential_id:p.credential_id,assignment_epoch:p.assignment_epoch,employee_name:name};}
let assertions=0;
function check(value,message){assert.ok(value,message);assertions++;}

// Selected new owning product behavior only; the historical bridge/cache and
// Schedule suites below are not executed by this selector.
async function protectedFeedbackIdentityCases(){
 const stateFixture=(p=original)=>{
  let status={ready:true,available:true,quarantined:false,deviceId:'KIOSK_08',generation:3,principal:p};
  let device='KIOSK_08',connected=true,ensure=async()=>{},refresh=async()=>{throw Error('unexpected refresh');},ready=async()=>{},onRead=()=>{};
  const calls={ready:0,ensure:0,refresh:0,refreshOptions:[]};
  const identity=createProtectedFeedbackIdentity({ready:()=>{calls.ready++;return ready();},
   security:{getStatus:()=>{onRead();return status;},ensureSecurityState:async()=>{calls.ensure++;return ensure();}},
   currentDeviceId:()=>device,online:()=>connected,
   refreshStatus:async options=>{calls.refresh++;calls.refreshOptions.push(options);return refresh(options);}});
  return {identity,calls,status:()=>status,patch:patch=>{status={...status,...patch};},
   device:value=>{device=value;},online:value=>{connected=value;},onEnsure:fn=>{ensure=fn;},onRefresh:fn=>{refresh=fn;},onReady:fn=>{ready=fn;},onRead:fn=>{onRead=fn;}};
 };
 const refused=identity=>assert.rejects(identity,{code:'custodial_feedback_identity_unavailable'});
 let cases=0;
 async function run(name,fn){await fn();cases++;console.log('PASS_SOURCE_MOCK '+name);}
 await run('currentProtectedPrincipalNeedsNoCacheOrNetwork',async()=>{
  const f=stateFixture();f.online(false);
  const result=await f.identity({purpose:'save'});
  assert.deepEqual(result,{deviceId:original.device_id,employeeId:original.employee_id,credentialId:original.credential_id,assignmentEpoch:'4'});
  assert.ok(Object.isFrozen(result));assert.equal(f.calls.refresh,0);assert.equal(f.calls.ensure,0);
  assert.deepEqual(Object.keys(result).sort(),['assignmentEpoch','credentialId','deviceId','employeeId']);
  assert.equal(result.installation_seal,undefined);assert.equal(result.credential_operation_id,undefined);
  assert.deepEqual(await f.identity({purpose:'deliver'}),result);assert.equal(f.calls.refresh,0);
 });
 await run('completePrincipalAndGenerationChangeAcrossReadMicrotaskRefused',async()=>{
  for(const patch of [{principal:changed},{principal:{...original,credential_id:uuid(9)}},
   {principal:{...original,installation_seal:'changed-seal-000000001'}},
   {principal:{...original,credential_operation_id:uuid(10)}},{generation:4},{principal:null},
   {quarantined:true},{available:false},{ready:false},{deviceId:'KIOSK_09'}]){
   const f=stateFixture();let reads=0;f.onRead(()=>{if(++reads===1)queueMicrotask(()=>f.patch(patch));});
   await refused(f.identity({purpose:'save'}));assert.equal(f.calls.refresh,0);
  }
  const f=stateFixture();let reads=0;f.onRead(()=>{if(++reads===1)queueMicrotask(()=>f.device('KIOSK_09'));});await refused(f.identity({purpose:'deliver'}));
 });
 await run('firstDirectSaveUsesOneBeforeGenerationStatusAndNativePrincipal',async()=>{
  const f=stateFixture(null);
  f.onRefresh(async options=>{assert.deepEqual(options,{expectedGeneration:3});return profile(original);});
  f.onEnsure(async()=>f.patch({principal:original,generation:4}));
  const result=await f.identity({purpose:'save'});
  assert.equal(result.credentialId,original.credential_id);assert.equal(result.assignmentEpoch,'4');
  assert.equal(f.calls.refresh,1);assert.equal(f.calls.ensure,1);
  // Actual normal refresh may already load native status before returning.
  const loaded=stateFixture(null);loaded.onRefresh(async()=>{loaded.patch({principal:original,generation:4});return profile(original);});
  assert.deepEqual(await loaded.identity({purpose:'save'}),result);assert.equal(loaded.calls.refresh,1);
 });
 await run('unqualifiedMissingOrForeignStatusCannotMintTuple',async()=>{
  for(const value of [undefined,null,{},profile(changed),{...profile(original),authenticated:false},
   {...profile(original),credential_id:undefined},{...profile(original),assignment_epoch:undefined},
   {...profile(original),assignment_epoch:0},{...profile(original),assignment_epoch:'4'},
   {...profile(original),canonical_device_id:'KIOSK_09'},
   {data:profile(original)}, {...profile(original),credential_id:uuid(99)}]){
   const f=stateFixture(null);f.onRefresh(async()=>value);f.onEnsure(async()=>f.patch({principal:original,generation:4}));
   await refused(f.identity({purpose:'save'}));assert.equal(f.calls.refresh,1);
  }
 });
 await run('noNativeCaptureOrChangedOriginalDuringRefreshRefused',async()=>{
  for(const change of [{principal:null,generation:3},{principal:changed,generation:4},
   {principal:original,generation:2},{principal:original,generation:4,quarantined:true}]){
   const f=stateFixture(null);f.onRefresh(async()=>profile(original));f.onEnsure(async()=>f.patch(change));
   await refused(f.identity({purpose:'save'}));assert.equal(f.calls.refresh,1);
  }
  for(const change of [{generation:4},{deviceId:'KIOSK_09'},{available:false}]){
   const f=stateFixture(null);f.onRefresh(async()=>{f.patch(change);return profile(original);});
   await refused(f.identity({purpose:'save'}));assert.equal(f.calls.ensure,0);
  }
  const f=stateFixture(null);f.onRefresh(async()=>{f.patch({principal:original,generation:4});return profile(original);});
  f.onEnsure(async()=>f.patch({generation:5}));await refused(f.identity({purpose:'save'}));
 });
 await run('offlineDeliveryAndMalformedPrivateStatusNeverRefresh',async()=>{
  const offline=stateFixture(null);offline.online(false);await refused(offline.identity({purpose:'save'}));assert.equal(offline.calls.refresh,0);
  const delivery=stateFixture(null);await refused(delivery.identity({purpose:'deliver'}));assert.equal(delivery.calls.refresh,0);
  for(const patch of [{generation:0},{generation:'3'},{generation:NaN},{available:undefined},{quarantined:undefined},
   {principal:{...original,credential_id:null}},{principal:{...original,assignment_epoch:0}},{principal:{}},{deviceId:'KIOSK_09'}]){
   const f=stateFixture();f.patch(patch);await refused(f.identity({purpose:'save'}));assert.equal(f.calls.refresh,0);assert.equal(f.calls.ensure,0);
  }
 });
 await run('readyFenceAndFinalAwaitRecheckUsePrivateSource',async()=>{
  const f=stateFixture();let release;
  f.onReady(()=>new Promise(resolve=>{release=resolve;}));const pending=f.identity({purpose:'save'});
  assert.equal(f.calls.ensure,0);assert.equal(f.calls.refresh,0);release();await pending;
  const late=stateFixture();let reads=0;
  const owner=createProtectedFeedbackIdentity({ready:async()=>{},security:{getStatus:()=>{
    reads++;if(reads===1)queueMicrotask(()=>late.patch({principal:changed}));return late.status();
   },ensureSecurityState:async()=>{}},currentDeviceId:()=>original.device_id,online:()=>false,refreshStatus:async()=>{throw Error('no IO');}});
  await refused(owner({purpose:'deliver'}));
 });
 await run('legacyPrincipalSupportedWithoutLegacyTupleAdoptionOrNewEffects',async()=>{
  const p={schema_version:'custodial-protected-principal.v2',device_id:'KIOSK_08',employee_id:uuid(1),assignment_epoch:7,
   credential_id:uuid(2),activation_operation_id:uuid(3),activation_receipt_sha256:'a'.repeat(64),legacy_binding_id:uuid(4),
   legacy_binding_kind:'authenticated_legacy_installation_observation',installation_binding_sha256:'b'.repeat(64),
   installation_seal:'original-installation-seal-0001',enrolled_at:'2026-07-31T21:52:04Z'};
  const f=stateFixture(p);assert.equal((await f.identity({purpose:'save'})).assignmentEpoch,'7');assert.equal(f.calls.refresh,0);
  await refused(f.identity({purpose:'unknown'}));
  assert.throws(()=>createProtectedFeedbackIdentity({}),TypeError);
 });
 console.log(JSON.stringify({scope:'NEW protected feedback identity factory; synthetic private runtime/status only; no network/cache/feedback effects',cases,failed:0,old_cache_groups_replayed:0}));
}
if(process.argv.includes('--protected-feedback-identity-only')){await protectedFeedbackIdentityCases();process.exit(0);}

// Newly affected composition, not a replay of the V1 eight groups. This
// strict synthetic FIFO refuses a nested ensure instead of leaving a promise
// waiting behind its own callback forever. No production lock is bypassed.
async function protectedFeedbackFifoCases(){
 let cases=0;
 async function run(name,fn){await fn();cases++;console.log('PASS_SOURCE_MOCK '+name);}
 function fixture(p=original){
  let status={ready:true,available:true,quarantined:false,deviceId:'KIOSK_08',generation:3,principal:p};
  let device='KIOSK_08',owned=false,tail=Promise.resolve(),reads=0,onRead=()=>{},onEnsure=()=>{},refresh=()=>{throw Error('unexpected refresh');};
  const calls={ensure:0,refresh:0};
  const exclusive=fn=>{
   const operation=tail.then(async()=>{owned=true;try{return await fn();}finally{owned=false;}});
   tail=operation.catch(()=>{});return operation;
  };
  const identity=createProtectedFeedbackIdentity({ready:()=>Promise.resolve(),security:{
   getStatus:()=>{onRead(++reads);return status;},
   ensureSecurityState:()=>{
    calls.ensure++;
    if(owned)throw Object.assign(new Error('Nested ensure would wait behind its awaited FIFO owner.'),{code:'fixture_feedback_fifo_reentrancy'});
    return exclusive(async()=>onEnsure());
   }},currentDeviceId:()=>device,online:()=>true,
   refreshStatus:async options=>{calls.refresh++;return refresh(options);}});
  return {identity,calls,exclusive,patch:x=>{status={...status,...x};},device:x=>{device=x;},onRead:fn=>{onRead=fn;},
   onEnsure:fn=>{onEnsure=fn;},onRefresh:fn=>{refresh=fn;},settled:async()=>{await tail;assert.equal(owned,false);}};
 }
 await run('existingSaveAndDeliverCompleteInsideHeldNonReentrantFifo',async()=>{
  const f=fixture();
  await f.exclusive(async()=>{
   for(const purpose of ['save','deliver']){
    const value=await f.identity({purpose});assert.ok(Object.isFrozen(value));
    assert.deepEqual(value,{deviceId:original.device_id,employeeId:original.employee_id,credentialId:original.credential_id,assignmentEpoch:'4'});
   }
  });
  await f.settled();assert.equal(f.calls.ensure,0);assert.equal(f.calls.refresh,0);
 });
 await run('heldOwnerReadOnlyStillRefusesChangedFullPrincipalGenerationDevice',async()=>{
  for(const patch of [{principal:changed},{principal:{...original,credential_id:uuid(9)}},
   {principal:{...original,installation_seal:'changed-seal-000000001'}},
   {principal:{...original,credential_operation_id:uuid(10)}},{generation:4},{principal:null},{quarantined:true}]){
   const f=fixture();f.onRead(n=>{if(n===1)queueMicrotask(()=>f.patch(patch));});
   await f.exclusive(async()=>assert.rejects(f.identity({purpose:'deliver'}),{code:'custodial_feedback_identity_unavailable'}));
   await f.settled();assert.equal(f.calls.ensure,0);assert.equal(f.calls.refresh,0);
  }
  const f=fixture();f.onRead(n=>{if(n===1)queueMicrotask(()=>f.device('KIOSK_09'));});
  await f.exclusive(async()=>assert.rejects(f.identity({purpose:'save'}),{code:'custodial_feedback_identity_unavailable'}));await f.settled();
 });
 await run('missingPrincipalDeliveryUnderHeldOwnerDoesNotEnterFifoOrRefresh',async()=>{
  const f=fixture(null);await f.exclusive(async()=>assert.rejects(f.identity({purpose:'deliver'}),{code:'custodial_feedback_identity_unavailable'}));
  await f.settled();assert.equal(f.calls.ensure,0);assert.equal(f.calls.refresh,0);
 });
 await run('firstSaveOutsideOwnerCanRefreshAndThenDeliveryIsReadOnly',async()=>{
  const f=fixture(null);f.onRefresh(options=>{assert.deepEqual(options,{expectedGeneration:3});return profile(original);});
  f.onEnsure(()=>f.patch({principal:original,generation:4}));
  const first=await f.identity({purpose:'save'});await f.settled();assert.equal(f.calls.ensure,1);assert.equal(f.calls.refresh,1);
  await f.exclusive(async()=>assert.deepEqual(await f.identity({purpose:'deliver'}),first));await f.settled();
  assert.equal(f.calls.ensure,1);assert.equal(f.calls.refresh,1);
 });
 console.log(JSON.stringify({scope:'NEW existing feedback identity inside strict synthetic non-reentrant protected FIFO; no actual WebLock/native/server proof',cases,failed:0,old_v1_eight_groups_replayed:0,old_cache_groups_replayed:0}));
}
if(process.argv.includes('--protected-feedback-fifo-only')){await protectedFeedbackFifoCases();process.exit(0);}

// Execute the actual bridge Home-cache implementation, not a substitute cache.
const bridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
const begin=bridge.indexOf('  function currentPrincipal()'),end=bridge.indexOf('  function readScanEntryAttestation(',begin);
assert.ok(begin>=0&&end>begin);
let principal=original,mutationHook=()=>{};
const memory=new Map([['draft:preserve','draft bytes'],['native-notification-outbox:v1','legacy bytes'],
 ['mz_custodial_home_cache:KIOSK_08',JSON.stringify({schema_version:'custodial-home-cache.v3',device_id:'KIOSK_08',cached_at:new Date().toISOString(),profile:profile(original)})]]);
const beforeSaved=[...memory.entries()];
const localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const context={protectedPrincipal,principalIdentity,profileMatchesPrincipal,Date,JSON,encodeURIComponent,
 bridgeReady:Promise.resolve(),deviceId:()=>principal?.device_id||'KIOSK_08',localStorage,
 security:{getStatus:()=>({principal}),mutateProtectedWork:async fn=>{mutationHook();return fn();}}};
vm.createContext(context);vm.runInContext(bridge.slice(begin,end),context);
check(context.readCustodialHomeCache()===null,'legacy KIOSK-only cache is preserved but not displayed');
await context.saveCustodialHomeCache({profile:profile(original)});
check(context.readCustodialHomeCache()?.profile.employee_id===original.employee_id,'exact protected Home cache is readable');
for(const p of [changed,{...original,credential_id:uuid(9)},{...original,assignment_epoch:6},
 {...original,credential_operation_id:uuid(8)},{...original,installation_seal:'another-seal-00000001'},null]){
 principal=p;check(context.readCustodialHomeCache()===null,'changed principal must not see old Home cache');
}
principal=original;mutationHook=()=>{principal=changed;};
await assert.rejects(context.saveCustodialHomeCache({profile:profile(original)}),/identity changed/);assertions++;
mutationHook=()=>{};await assert.rejects(context.saveCustodialHomeCache({profile:profile(original)}),/identity changed/);assertions++;
for(const [k,v] of beforeSaved)check(memory.get(k)===v,'legacy caches and saved work remain byte-identical');

const html=readFileSync(new URL('../employee-schedule.html',import.meta.url),'utf8');
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const recurringHelper=readFileSync(new URL('../memphis-recurring-schedule-target.js',import.meta.url),'utf8');
const snapshots=storage=>[...storage.values()].filter(value=>JSON.parse(value)?.schema_version==='employee-schedule-snapshot.v2');
function scheduleFixture(initial=original,storage=new Map()){
 let active=initial,offline=false,pending=null,networkData;
 const events=new Map(),elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',innerHTML:'',addEventListener(){}});return elements.get(id);};
 const makeData=(p,name)=>({...profile(p,name),service_date:'2026-09-21',full_day:true,
  raw_items:[{name:`${name} area`,coverage_start:'11:00',coverage_end:'14:00'}]});
 networkData=active?makeData(active,'Original'):null;
 const DateFixed=class extends Date{constructor(...a){super(...(a.length?a:['2026-09-21T18:00:00Z']));}static now(){return Date.parse('2026-09-21T18:00:00Z');}};
 const status=()=>({ready:!!active,available:true,quarantined:!active,deviceId:'KIOSK_08',principal:active});
 const window={navigator:{locks:createSyntheticScheduleLocks()},crypto:webcrypto,
  MemphisMobile:{ready:Promise.resolve(),deviceId:()=>active?.device_id||'KIOSK_08',
  principalIdentity:()=>principalIdentity(active),profileMatchesPrincipal:v=>profileMatchesPrincipal(v,active),
  requestJson:async()=>{if(offline)throw new Error('offline');return profile(active);}},
  MemphisCustodialSecurity:{native:true,getStatus:status,mutateProtectedWork:async fn=>fn()},
  addEventListener:(event,fn)=>events.set(event,fn)};
 const ctx={window,document:{getElementById:element,addEventListener(){}},Date:DateFixed,Intl,JSON,console,AbortController,TextEncoder,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  fetch:async()=>{if(offline)throw new Error('offline');if(pending){const p=pending;pending=null;return p;}return {ok:true,json:async()=>({ok:true,data:networkData})};},
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){}};
 vm.createContext(ctx);vm.runInContext(recurringHelper,ctx);vm.runInContext(inline,ctx);
 return {element,storage,setOffline:v=>{offline=v;},refresh:()=>events.get('online')(),
  defer:()=>{let done;pending=new Promise(r=>{done=r;});return data=>done({ok:true,json:async()=>({ok:true,data})});},
  data:makeData,
  assign:p=>{active=p;networkData=p?makeData(p,'New'):null;events.get('memphis:custodial-security-state')({detail:status()});}};
}
const f=scheduleFixture();await turn();await turn();
check(f.element('employee').textContent==='Original','initial authenticated schedule renders');
check(snapshots(f.storage).length===1,'exact principal cache is saved');
check(f.storage.size===2,'one snapshot and its real durable availability fence are saved');
f.setOffline(true);f.refresh();await turn();
check(/No connection/.test(f.element('state-text').textContent),'same-principal offline schedule is retained');
f.setOffline(false);const release=f.defer();f.refresh();await turn();
f.assign(changed);
check(f.element('employee').textContent==='Employee'&&f.element('content').hidden,'assignment change immediately clears displayed old employee');
await turn();await turn();check(f.element('employee').textContent==='New','new assignment renders');
release(f.data(original,'Late old'));await turn();await turn();
check(f.element('employee').textContent==='New'&&!f.element('areas').innerHTML.includes('Late old'),'late old response cannot overwrite new identity or schedule');
check([...f.storage.values()].every(v=>!v.includes('Late old')),'late response cannot poison either cache');
f.setOffline(true);f.assign({...changed,credential_id:uuid(9),credential_operation_id:uuid(10)});await turn();
check(f.element('content').hidden&&f.element('employee').textContent==='Employee','same employee after credential recovery cannot reuse prior-credential cache');
check(snapshots(f.storage).length===2,'old assignment caches are retained, not deleted or reattributed');
f.assign(null);await turn();check(f.element('content').hidden,'quarantined principal has no schedule presentation');
const legacy=new Map([['mz_employee_schedule_snapshot:KIOSK_08',JSON.stringify({schema_version:'employee-schedule-snapshot.v1',device_id:'KIOSK_08',data:f.data(original,'Legacy')})]]);
const l=scheduleFixture(null,legacy);l.setOffline(true);await turn();await turn();
check(l.element('content').hidden&&legacy.size===1,'legacy device-only schedule retained but uninspectable without bound principal');
const legacyPrincipal={schema_version:'custodial-protected-principal.v2',device_id:'KIOSK_08',employee_id:uuid(1),
 assignment_epoch:7,credential_id:uuid(2),activation_operation_id:uuid(3),activation_receipt_sha256:'a'.repeat(64),
 legacy_binding_id:uuid(4),legacy_binding_kind:'authenticated_legacy_installation_observation',
 installation_binding_sha256:'b'.repeat(64),installation_seal:'original-installation-seal-0001',enrolled_at:'2026-07-31T21:52:04Z'};
check(protectedPrincipal(legacyPrincipal)!==null,'exact terminal-derived legacy principal accepted');
check(protectedPrincipal({...legacyPrincipal,credential_operation_id:uuid(8)})===null,'mixed v1/v2 principal rejected');
check(protectedPrincipal({...original,legacy_binding_id:uuid(8)})===null,'legacy binding cannot be grafted onto v1');
principal=legacyPrincipal;await context.saveCustodialHomeCache({profile:profile(principal)});
check(context.readCustodialHomeCache()?.profile.employee_id===principal.employee_id,'actual Home cache supports protected legacy principal');
for(const [field,value] of Object.entries({schema_version:'wrong',device_id:'KIOSK_09',employee_id:uuid(9),assignment_epoch:8,
 credential_id:uuid(10),activation_operation_id:uuid(11),activation_receipt_sha256:'c'.repeat(64),
 legacy_binding_id:uuid(12),legacy_binding_kind:'confirmed_enrollment_operation',installation_binding_sha256:'d'.repeat(64),
 installation_seal:'changed-installation-seal-0001',enrolled_at:'2026-07-31T21:52:05Z'})){
 principal={...legacyPrincipal,[field]:value};
 check(principalIdentity(principal)!==principalIdentity(legacyPrincipal),'legacy cache identity includes '+field);
 check(context.readCustodialHomeCache()===null,'legacy Home cache refuses changed '+field);
}
const v2schedule=scheduleFixture(legacyPrincipal);await turn();await turn();
check(v2schedule.element('employee').textContent==='Original','actual Schedule controller renders legacy principal');
v2schedule.setOffline(true);v2schedule.refresh();await turn();
check(/No connection/.test(v2schedule.element('state-text').textContent),'legacy Schedule survives offline exact-principal restart');
v2schedule.assign({...legacyPrincipal,legacy_binding_id:uuid(90)});await turn();
check(v2schedule.element('content').hidden,'new legacy observation invalidates prior Schedule cache');
check(snapshots(v2schedule.storage).length===1,'old schedule bytes retained not reassigned');
console.log(JSON.stringify({scope:'actual bridge Home cache and Schedule controller; synthetic protected principal and network; no physical claim',assertions,failed:0},null,2));
