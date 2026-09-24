import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {protectedPrincipal,principalIdentity,profileMatchesPrincipal} from '../mobile/src/custodial/protected-principal.js';
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
function scheduleFixture(initial=original,storage=new Map()){
 let active=initial,offline=false,pending=null,networkData;
 const events=new Map(),elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',innerHTML:'',addEventListener(){}});return elements.get(id);};
 const makeData=(p,name)=>({...profile(p,name),service_date:'2026-09-21',full_day:true,
  raw_items:[{name:`${name} area`,coverage_start:'11:00',coverage_end:'14:00'}]});
 networkData=active?makeData(active,'Original'):null;
 const DateFixed=class extends Date{constructor(...a){super(...(a.length?a:['2026-09-21T18:00:00Z']));}static now(){return Date.parse('2026-09-21T18:00:00Z');}};
 const window={MemphisMobile:{ready:Promise.resolve(),deviceId:()=>active?.device_id||'KIOSK_08',
  principalIdentity:()=>principalIdentity(active),profileMatchesPrincipal:v=>profileMatchesPrincipal(v,active),
  requestJson:async()=>{if(offline)throw new Error('offline');return profile(active);}},
  MemphisCustodialSecurity:{native:true,mutateProtectedWork:async fn=>fn()},
  addEventListener:(event,fn)=>events.set(event,fn)};
 const ctx={window,document:{getElementById:element,addEventListener(){}},Date:DateFixed,Intl,JSON,console,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  fetch:async()=>{if(offline)throw new Error('offline');if(pending){const p=pending;pending=null;return p;}return {ok:true,json:async()=>({ok:true,data:networkData})};},
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){}};
 vm.createContext(ctx);vm.runInContext(inline,ctx);
 return {element,storage,setOffline:v=>{offline=v;},refresh:()=>events.get('online')(),
  defer:()=>{let done;pending=new Promise(r=>{done=r;});return data=>done({ok:true,json:async()=>({ok:true,data})});},
  data:makeData,
  assign:p=>{active=p;networkData=p?makeData(p,'New'):null;events.get('memphis:custodial-security-state')({detail:{ready:!!p,available:true,quarantined:!p}});}};
}
const f=scheduleFixture();await turn();await turn();
check(f.element('employee').textContent==='Original','initial authenticated schedule renders');
check(f.storage.size===1,'exact principal cache is saved');
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
check(f.storage.size===2,'old assignment caches are retained, not deleted or reattributed');
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
check(v2schedule.storage.size===1,'old schedule bytes retained not reassigned');
console.log(JSON.stringify({scope:'actual bridge Home cache and Schedule controller; synthetic protected principal and network; no physical claim',assertions,failed:0},null,2));
