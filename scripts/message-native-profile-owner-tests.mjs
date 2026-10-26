import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {principalIdentity,profileMatchesPrincipal} from '../mobile/src/custodial/protected-principal.js';
const source=readFileSync(new URL('../mobile/src/chatscope/app.jsx',import.meta.url),'utf8');
const part=(a,b)=>{const x=source.indexOf(a),y=source.indexOf(b,x+a.length);assert.ok(x>=0&&y>x);return source.slice(x,y);};
const helpers=part('function custodialNativeWriterRequired()', '\nlet outboxOrderCounter =');
const load=part('  const loadIdentity = useCallback(', '\n  const loadThreads =');
const native=part('function isNativeCustodialAuthority()', '\nfunction employeeDeviceId()');
const P={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:'95000000-0000-4000-8000-000000000002',credential_id:'95000000-0000-4000-8000-000000000004',credential_operation_id:'95000000-0000-4000-8000-000000000005',assignment_epoch:7,installation_seal:'synthetic-original-installation',enrolled_at:'2026-10-12T00:00:00Z'};
const U='95000000-0000-4000-8000-000000000006',other='95000000-0000-4000-8000-000000000007';
function fixture({duringRequest,profileChange,match}={}){
 const status={ready:true,available:true,quarantined:false,generation:1,deviceId:P.device_id,principal:{...P}};
 const profile={msg_user_id:U,employee_id:P.employee_id,credential_id:P.credential_id,assignment_epoch:7,canonical_device_id:P.device_id};profileChange?.(profile);
 const calls=[],views=[];const identityRef={current:null},accessEpoch={current:1},mounted={current:true};
 const security={native:true,getStatus:()=>{f.getStatusHook?.();return status;},mutateProtectedWork:()=>{throw Error('No mutation requested by profile fixture');}};
 const mobile={edition:'custodial',principalIdentity:()=>principalIdentity(status.principal),profileMatchesPrincipal:p=>match?match(p,profileMatchesPrincipal(p,status.principal)):profileMatchesPrincipal(p,status.principal)};
 const window={MemphisCustodialSecurity:security,MemphisMobile:mobile};
 const scope=vm.createContext({window,EMPLOYEE_CONTEXT:true,currentDeviceId:P.device_id,useCallback:f=>f,
  identityRef,accessEpoch,mounted,setIdentity:value=>views.push(value),Object,Array,JSON,Number,String,Error,Date,WeakMap,
  localStorage:{setItem(){throw Error('No native presentation cache expected');}},
  api:async(path,options)=>{calls.push({path,options});await duringRequest?.(f);return {ok:true,data:{...profile},meta:{version:'synthetic'}};}});
 vm.runInContext(native+'\n'+helpers+'\n'+load+'\nthis.load=loadIdentity;this.owner=originalEmployeeMessageOwner;',scope,{timeout:1000});
 const f={scope,status,profile,calls,views,identityRef,accessEpoch,mounted,security,mobile,window};return f;
}
let checks=0;const test=async(name,fn)=>{await fn();checks++;};
await test('normal actual load callback accepts exact shipping DTO without public authenticated flag',async()=>{const f=fixture();const mapped=await f.scope.load();assert.equal(Object.hasOwn(mapped,'authenticated'),false);const owner=f.scope.owner(mapped,P.device_id);assert.equal(owner.userId,U);assert.equal(owner.assignmentEpoch,'7');assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/me/by-device?device_id=KIOSK_08');assert.equal(f.identityRef.current,mapped);assert.equal(f.views[0],mapped);});
await test('direct fabricated same tuple plus authenticated true is refused',async()=>{const f=fixture();assert.throws(()=>f.scope.owner({...f.profile,authenticated:true},P.device_id));});
await test('copy of normally produced object has no provenance',async()=>{const f=fixture(),mapped=await f.scope.load();assert.throws(()=>f.scope.owner({...mapped,authenticated:true},P.device_id));});
for(const [name,change] of [
 ['native generation',f=>f.status.generation++],['native unavailable',f=>f.status.ready=false],['native quarantine',f=>f.status.quarantined=true],
 ['credential',f=>f.status.principal={...P,credential_id:other}],['employee',f=>f.status.principal={...P,employee_id:other}],
 ['assignment epoch',f=>f.status.principal={...P,assignment_epoch:8}],['component epoch',f=>f.accessEpoch.current++],
 ['component closed',f=>f.mounted.current=false],['profile reference',f=>f.identityRef.current={...f.identityRef.current}],
 ['native status callback replacement',f=>f.security.getStatus=()=>f.status],['principal callback replacement',f=>f.mobile.principalIdentity=()=>principalIdentity(f.status.principal)],
 ['profile match callback replacement',f=>f.mobile.profileMatchesPrincipal=()=>true],['profile user mutation',f=>f.identityRef.current.msg_user_id=other],
 ['read-only mutation',f=>f.identityRef.current.read_only=true],['read-only deletion',f=>delete f.identityRef.current.read_only],
])await test('normally produced profile loses owner after '+name,async()=>{const f=fixture(),mapped=await f.scope.load();change(f);assert.throws(()=>f.scope.owner(mapped,P.device_id));});
for(const [name,change] of [['generation',f=>f.status.generation++],['component epoch',f=>f.accessEpoch.current++],['matcher owner',f=>f.mobile.profileMatchesPrincipal=()=>true]])await test('response cannot publish after '+name,async()=>{const f=fixture({duringRequest:change});await assert.rejects(f.scope.load());assert.equal(f.identityRef.current,null);assert.equal(f.views.length,0);});
for(const [name,profileChange] of [['wrong tuple',p=>p.credential_id=other],['read-only',p=>p.read_only=true],['explicit authentication denial',p=>p.authenticated=false]])await test('normal producer refuses '+name,async()=>{const f=fixture({profileChange});await assert.rejects(f.scope.load());assert.equal(f.views.length,0);});
await test('matcher cannot mutate already checked mapping into another sender',async()=>{const f=fixture({match:(p,ok)=>{p.msg_user_id=other;return ok;}});await assert.rejects(f.scope.load());assert.equal(f.views.length,0);});
await test('new normal profile does not revive closed predecessor object',async()=>{const f=fixture(),first=await f.scope.load(),second=await f.scope.load();assert.notEqual(first,second);assert.throws(()=>f.scope.owner(first,P.device_id));assert.equal(f.scope.owner(second,P.device_id).userId,U);});
await test('terminal security callback cannot change mapped sender after live match',async()=>{let armed=false,pending=false;const f=fixture({match:(p,ok)=>{if(armed)pending=true;return ok;}}),mapped=await f.scope.load();armed=true;f.getStatusHook=()=>{if(pending)mapped.msg_user_id=other;};assert.throws(()=>f.scope.owner(mapped,P.device_id));});
await test('last security callback before publication cannot change original mapping',async()=>{let pending=false,seen;const f=fixture({match:(p,ok)=>{seen=p;pending=true;return ok;}});f.getStatusHook=()=>{if(pending)seen.msg_user_id=other;};await assert.rejects(f.scope.load());assert.equal(f.identityRef.current,null);assert.equal(f.views.length,0);});
for(const [name,change] of [
 ['facade replacement',f=>f.window.MemphisCustodialSecurity={...f.security}],
 ['native withdrawal',f=>f.security.native=false],
 ['writer replacement',f=>f.security.mutateProtectedWork=()=>{}],
])await test('last owner callback refuses '+name,async()=>{const f=fixture(),mapped=await f.scope.load();let reads=0;f.getStatusHook=()=>{if(++reads===3)change(f);};assert.throws(()=>f.scope.owner(mapped,P.device_id));});
for(const [name,change] of [
 ['facade replacement',f=>f.window.MemphisCustodialSecurity={...f.security}],
 ['native withdrawal',f=>f.security.native=false],
 ['writer replacement',f=>f.security.mutateProtectedWork=()=>{}],
])await test('last profile-publication callback refuses '+name,async()=>{let pending=false;const f=fixture({match:(p,ok)=>{pending=true;return ok;}});f.getStatusHook=()=>{if(pending)change(f);};await assert.rejects(f.scope.load());assert.equal(f.views.length,0);});
console.log(JSON.stringify({status:'PASS',checks,scope:'actual shipping owner/loadIdentity callbacks; synthetic response/status/component ports only',HTTP:false,SQL:false,native:false,backend_modified:false}));
