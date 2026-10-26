import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import './synthetic-schedule-locks.mjs';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
import {principalIdentity,profileMatchesPrincipal} from '../mobile/src/custodial/protected-principal.js';

// Owning sequence, not an invented recovery event: publicSecurity subscribers
// run before the real material-state window event. app clears its profile and
// starts async restore; showHome calls update after the auth response arrives.
const runtime=readFileSync(new URL('../mobile/src/custodial/security-runtime.js',import.meta.url),'utf8');
const shell=readFileSync(new URL('../mobile/src/custodial/app.js',import.meta.url),'utf8');
assert.ok(runtime.indexOf('listener(snapshot)')<runtime.indexOf("new CustomEvent('memphis:custodial-security-state'"));
assert.match(shell,/if \(changed\) \{[\s\S]*?profile = null;[\s\S]*?void restore\(/);
assert.match(shell,/profile = await request\(`[\s\S]*?showHome\(profile\)/);
const uuid=n=>`a3000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const P={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:uuid(1),
 credential_id:uuid(2),credential_operation_id:uuid(3),assignment_epoch:1,
 installation_seal:'synthetic-home-order-seal',enrolled_at:'2026-08-01T00:00:00.000Z'};
const Q={...P,employee_id:uuid(4),credential_id:uuid(5),assignment_epoch:2};
const profile=p=>({authenticated:true,canonical_device_id:p.device_id,device_id:p.device_id,employee_id:p.employee_id,
 employee_name:'Synthetic Custodian',credential_id:p.credential_id,assignment_epoch:p.assignment_epoch});
const ready=(p=P,generation=6)=>({state:'enrolled',ready:true,available:true,quarantined:false,generation,principal:p});
const original=Object.fromEntries(['window','document','localStorage','fetch','setInterval','clearInterval'].map(k=>[k,globalThis[k]]));
let checks=0;const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const cases=[];
function fixture(){
 const elements=new Map(),events=new Map(),stored=new Map([['protected-cleaning-draft','unchanged draft'],['protected-finish-intent','unchanged finish'],['native-provider-uncertain','unchanged uncertain']]);
 let active=P,currentProfile=null,status=ready(),getProfileHook=null,statusHook=null,identityHook=null,requestHook=null;
 const calls=[];const element=k=>{if(!elements.has(k))elements.set(k,{textContent:'',innerHTML:'',dataset:{}});return elements.get(k);};
 globalThis.document={getElementById:element,hidden:false,addEventListener(){}};
 globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:{principalIdentity:()=>identityHook?identityHook():principalIdentity(active),profileMatchesPrincipal:d=>profileMatchesPrincipal(d,active)}};
 globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};
 globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};
 globalThis.fetch=async url=>{calls.push({kind:'informational',url});return new Response(JSON.stringify(url.includes('current-attendance')?{ok:true,data:{attendance:0,source_timestamp:new Date().toISOString()}}:{}),{status:200});};
 const data=(p=active)=>({...profile(p),schedule_delivery_mode:'LEGACY_REGISTERED',service_date:zooServiceDate(),publication_id:uuid(10),projection_id:uuid(p===P?11:12),
  home_facts:{service_date:zooServiceDate(),employee_id:p.employee_id,employee_name:'Synthetic Custodian',publication_id:uuid(10),projection_id:uuid(p===P?11:12),projection_status:'current',shift:{start:'08:00',end:'17:00'},lunch:{start:'13:00',end:'14:00'}}});
 const controller=installHomeFacts({getProfile:()=>{if(getProfileHook)getProfileHook();return currentProfile;},getDeviceId:()=>active?.device_id||'KIOSK_08',isVisible:()=>true,
  security:{native:true,getStatus:()=>{if(statusHook)statusHook();return structuredClone(status);},mutateProtectedWork:async fn=>fn()},
  requestJson:async()=>{calls.push({kind:'schedule'});return requestHook?requestHook():data();}});
 return {controller,calls,element,stored,data,
  profile(value){currentProfile=value;},status(value){status=value;},active(value){active=value;},
  profileHook(value){getProfileHook=value;},statusHook(value){statusHook=value;},identityHook(value){identityHook=value;},requestHook(value){requestHook=value;},
  event(value=status){events.get('memphis:custodial-security-state')({detail:structuredClone(value)});},
  // Mirrors the two owning layers: subscriber invalidates first; then runtime
  // emits its one real material ready event; auth/profile arrives afterward.
  readyBeforeProfile(value=ready()){currentProfile=null;controller.stop();status=value;events.get('memphis:custodial-security-state')({detail:structuredClone(value)});},
  finish(){controller.stop();for(const [k,v] of [['protected-cleaning-draft','unchanged draft'],['protected-finish-intent','unchanged finish'],['native-provider-uncertain','unchanged uncertain']])check(stored.get(k),v,'protected bytes unchanged');},
 };
}
async function scenario(name,run){const f=fixture();try{await run(f);cases.push(name);}finally{f.finish();}}
try{
 await scenario('ready event before authenticated profile',async f=>{
  f.readyBeforeProfile();check(f.calls.length,0,'no effects before current profile');
  f.profile(profile(P));await f.controller.update(true);
  check(f.calls.filter(x=>x.kind==='schedule').length,1,'actual startup ready event survives later matching profile');
  check(f.element('home-shift').textContent,'8:00 AM–5:00 PM','matched schedule rendered');
  check(f.element('home-lunch').textContent,'1:00 PM–2:00 PM','matched lunch rendered');
 });
 await scenario('invalid event requires new positive event, not polling',async f=>{
  f.status({...ready(),ready:false,quarantined:true});f.event();f.profile(profile(P));f.status(ready());await f.controller.update(true);
  check(f.calls.length,0,'healthy polling does not clear quarantine latch');
  f.event();await f.controller.update(true);check(f.element('home-shift').textContent,'8:00 AM–5:00 PM','real verified positive event recovers');
 });
 for(const [label,event,status] of [
  ['stale event generation',ready(P,5),ready(P,6)],
  ['different event principal',ready(Q),ready(P)],
  ['missing event principal',{...ready(),principal:null},ready(P)],
  ['malformed event generation',{...ready(),generation:'6'},ready(P)],
  ['unhealthy current status',ready(),{...ready(),available:false}],
 ])await scenario(label,async f=>{f.status(status);f.event(event);f.profile(profile(P));await f.controller.update(true);check(f.calls.length,0,label+' refuses deferred grant');});
 await scenario('mismatched profile consumes no authority',async f=>{
  f.readyBeforeProfile();f.profile(profile(Q));await f.controller.update(true);check(f.calls.length,0,'wrong employee blocked');
  f.profile(profile(P));await f.controller.update(true);check(f.calls.length,0,'profile correction alone cannot clear invalid read');
  f.event();await f.controller.update(true);check(f.element('home-shift').textContent,'8:00 AM–5:00 PM','new current event restores');
 });
 await scenario('rotation invalidates pending event',async f=>{
  f.readyBeforeProfile();f.active(Q);f.status(ready(Q,7));f.profile(profile(Q));await f.controller.update(true);
  check(f.calls.length,0,'old principal event cannot grant new assignment');
  f.event();await f.controller.update(true);check(f.element('home-shift').textContent,'8:00 AM–5:00 PM','new principal event recovers');
 });
 await scenario('generation changed without positive material event',async f=>{
  f.readyBeforeProfile();f.status(ready(P,7));f.profile(profile(P));await f.controller.update(true);check(f.calls.length,0,'generation mismatch fails closed');
 });
 await scenario('nested revocation during profile capture',async f=>{
  f.readyBeforeProfile();f.profile(profile(P));f.profileHook(()=>{f.profileHook(null);f.status({...ready(),ready:false,quarantined:true});f.event();});
  await f.controller.update(true);check(f.calls.length,0,'outer recovery cannot overtake nested revocation');
 });
 await scenario('throwing profile capture',async f=>{
  f.readyBeforeProfile();f.profileHook(()=>{throw Error('unavailable');});await f.controller.update(true);
  f.profileHook(null);f.profile(profile(P));await f.controller.update(true);check(f.calls.length,0,'exception does not become recovery');
 });
 for(const when of [1,3])await scenario('nested revocation at ready-proof status read '+when,async f=>{
  f.readyBeforeProfile();f.profile(profile(P));let reads=0;
  f.statusHook(()=>{if(++reads===when){f.statusHook(null);f.status({...ready(),ready:false,quarantined:true});f.event();}});
  await f.controller.update(true);check(reads,when,'owning status read reached');check(f.calls.length,0,'nested status revocation wins');
 });
 await scenario('throwing current ready-proof getter',async f=>{
  f.readyBeforeProfile();f.profile(profile(P));f.statusHook(()=>{throw Error('status unavailable');});await f.controller.update(true);
  f.statusHook(null);await f.controller.update(true);check(f.calls.length,0,'throwing status clears pending proof, not denial');
 });
 await scenario('principal changes inside final read',async f=>{
  f.readyBeforeProfile();f.profile(profile(P));f.identityHook(()=>principalIdentity(Q));await f.controller.update(true);check(f.calls.length,0,'captured mobile principal must equal exact ready proof');
 });
 await scenario('unavailable and absent profile may not start requests',async f=>{
  f.readyBeforeProfile();await f.controller.update(true);check(f.calls.length,0,'null profile remains pending without requests');
  f.profile(profile(P));await f.controller.update(true);check(f.element('home-shift').textContent,'8:00 AM–5:00 PM','later profile recovers original live ready proof');
 });
 await scenario('late original response cannot cross rotated ready sequence',async f=>{
  f.readyBeforeProfile();f.profile(profile(P));let release,reached;const waiting=new Promise(r=>{reached=r;});
  f.requestHook(()=>new Promise(r=>{release=r;reached();}));const old=f.controller.update(true);await waiting;
  f.active(Q);f.readyBeforeProfile(ready(Q,7));f.profile(profile(Q));f.requestHook(null);await f.controller.update(true);
  release(f.data(P));await old;
  const snapshots=[...f.stored.values()].filter(v=>v.includes('employee-schedule-snapshot.v2'));
  check(snapshots.length,1,'old unresolved response cannot persist across rotation');
  check(JSON.parse(snapshots[0]).data.employee_id,Q.employee_id,'only current employee snapshot stored');
  check(f.element('home-shift').textContent,'8:00 AM–5:00 PM','current employee view retained');
 });
 console.log(JSON.stringify({status:'PASS',checks,cases,scope:'actual Home controller plus real principal/schedule helpers, synthetic event/profile ordering; no rendered/phone claim'},null,2));
}finally{for(const [k,v] of Object.entries(original)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
