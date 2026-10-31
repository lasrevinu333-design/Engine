import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url),read=name=>readFileSync(new URL(name,root),'utf8');
if(process.argv.includes('--auth-browser-preservation-only')){await authBrowserPreservationCases();process.exit(0);}
const cases=[],requests=[],local=new Map(),sessionStore=new Map();
const storage=m=>({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)});
const id=n=>'91000000-0000-4000-8000-'+String(n).padStart(12,'0');let mode='valid';
const session=()=>({token:'synthetic-server-manager-token',role:'ops_manager',manager_id:id(1),credential_id:id(2),device_id:'fixture-browser',manager_display_name:'Custodial leadership cohort',auth_mode:'custodial_leadership_pin',owner:false,custodial_management_admin:true,access_level:'full_access',read_only:false,expires_at:'2099-01-01T00:00:00Z',roles:['CUSTODIAL_MANAGER','SECURITY_ADMIN'],permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1,close_scan_tickets:true,manage_absences:true}});
const envelope=()=>{const v={registrationId:id(2),identityAssurance:'SELF_ASSERTED_NAME',claimedAccount:{accountId:id(3),displayName:'Synthetic approved name',contact:null},cohort:{principalId:id(1),policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:session()};if(mode==='missing')delete v.managerSession;if(mode==='wrong-principal')v.managerSession.manager_id=id(3);if(mode==='owner')v.managerSession.owner=true;if(mode==='policy')v.managerSession.permissions.policyVersion=2;return{ok:true,enrolled:true,csrfToken:'synthetic-csrf',session:v};};
const location=new URL('https://example.invalid/ops-manager-hub.html');
const fetch=async(url,options={})=>{requests.push({url:String(url),options});if(String(url).endsWith('/custodial-leadership-api/session'))return{ok:true,status:200,json:async()=>envelope()};if(String(url).endsWith('/custodial-leadership-api/revoke')){assert.equal(options.body,'{}');assert.equal(options.headers['X-CSRF-Token'],'synthetic-csrf');return{ok:true,status:200,json:async()=>({ok:true,revoked:true,enrolled:false})};}if(String(url).endsWith('/admin-api/device-security/session'))return{ok:true,status:200,json:async()=>({ok:true,data:{configured:true,unlocked:true,auth_mode:'custodial_leadership_pin',security_scope:mode==='bad-security'?'unbound':'custodial_device_management',manager_id:id(1),expires_at:'2099-01-01T00:00:00Z',csrf_token:'synthetic-security-csrf'}})};throw Error('Unexpected endpoint '+url);};
const window={location,localStorage:storage(local),sessionStorage:storage(sessionStore),crypto:webcrypto,document:{body:{dataset:{memphisContext:'manager'}}}};
const context=vm.createContext({window,localStorage:window.localStorage,sessionStorage:window.sessionStorage,location,fetch,URL,URLSearchParams,TextEncoder,Date,Intl,AbortSignal,console,crypto:webcrypto,setTimeout,clearTimeout});
vm.runInContext(read('memphis-auth.js'),context);vm.runInContext(read('memphis-scheduler-actions.js'),context);const auth=window.MemphisAuth,scheduler=context.MemphisSchedulerActions;
const valid=await auth.refreshLeadershipSession();assert.equal(valid.token,session().token);assert.equal(valid.manager_id,id(1));assert.equal(valid.credential_id,id(2));cases.push('actual supplied server session binds cohort and browser registration');
assert.equal(valid.owner,false);assert.equal(valid.permissions.owner,false);assert.notEqual(valid.manager_id,id(3));assert.equal(auth.isCustodialManagementAdmin(valid),true);cases.push('self-selected account never becomes actor or owner');
assert.equal(auth.isCustodialManagementAdmin({...valid}),false);cases.push('marker-only copied client object cannot create management authority');
const p=scheduler.permissions(auth);assert.equal(p.owner,false);assert.equal(p.managementAdmin,true);assert.equal(p.management,true);assert.equal(p.absences,true);cases.push('existing scheduler uses separate server management capability');
const prior=requests.length;const headers=await auth.opsManagerAuthHeaders();assert.equal(requests.length,prior);assert.equal(headers.Authorization,'Bearer '+valid.token);assert.equal(headers['X-CSRF-Token'],'synthetic-csrf');cases.push('warm manager session does not loop through login and retains real CSRF');
assert.equal([...local.values(),...sessionStore.values()].some(v=>v.includes(valid.token)),false);assert.equal(typeof auth.signInWithMap,'undefined');cases.push('no bearer persistence or Custodial Map login dependency');
for(const invalid of ['missing','wrong-principal','owner','policy']){mode=invalid;await assert.rejects(()=>auth.refreshLeadershipSession());assert.equal(auth.readSession(),null);cases.push(invalid+' server adapter refused without invented session');}
mode='valid';await auth.refreshLeadershipSession();const security=await auth.deviceSecuritySession();assert.equal(security.unlocked,true);assert.equal((await auth.deviceSecurityAuthHeaders())['X-Device-Security-CSRF'],'synthetic-security-csrf');mode='bad-security';await assert.rejects(()=>auth.deviceSecuritySession());cases.push('security scope and CSRF must come from actual server response');
mode='valid';const phone=read('phone-assignments.js'),phoneHelpers=phone.slice(phone.indexOf('  const ownerAccess ='),phone.indexOf('  async function request(',phone.indexOf('  const ownerAccess =')));vm.runInContext(phoneHelpers,context);assert.equal(vm.runInContext('ownerAccess()',context),true);const phoneHeaders=await vm.runInContext('authHeaders()',context);assert.equal(phoneHeaders['X-CSRF-Token'],'synthetic-csrf');assert.equal(phoneHeaders.Authorization,'Bearer '+valid.token);cases.push('actual phone assignment helper uses verified management and central bearer/CSRF');
await auth.clearSession();assert.equal(auth.readSession(),null);assert.equal(requests.filter(r=>r.url.endsWith('/revoke')).length,1);cases.push('only same-browser confirmed revocation retires local session');
for(const name of ['ops-manager-hub.html','owner-access.html','start_page1.html','manager-access.html'])for(const match of read(name).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1].trim())new vm.Script(match[1],{filename:name});
new vm.Script(read('owner-access.js'));new vm.Script(read('ops-hub.js'));cases.push('actual affected inline and Hub sources parse');
for(const id of ['leadership-pin','approved-name','open-manager'])assert.ok(read('ops-manager-hub.html').includes(`id="${id}"`));for(const id of ['coverage-form','coverage-end','coverage-reason','enable','disable','coverage-state','timezone','status'])assert.ok(read('owner-access.html').includes(`id="${id}"`));cases.push('new enrollment and retained coverage controls exist');
assert.equal(requests.some(r=>/map-session|map-config|manager-codes/.test(r.url)),false);assert.equal(read('start_page1.html').includes('id="events-admin-link"'),false);cases.push('no retired provider/personal-code route or retired input console');
console.log(JSON.stringify({result:'CUSTODIAL_LEADERSHIP_CLIENT_VM_PASS',cases:cases.length,tests:cases,scope:'Actual frontend auth and scheduler code with synthetic server/Storage boundaries; no genuine enrollment, SQL or device.'},null,2));

async function authBrowserPreservationCases(){
  const {createProtectedBrowserAdmission}=await import('../mobile/src/custodial/protected-browser-admission.js');
  const {createSyntheticScheduleLocks}=await import('./synthetic-schedule-locks.mjs');
  const selected=process.argv.find(x=>x.startsWith('--auth-browser-case='))?.split('=')[1];
  const legacy=['memphisOpsManagerSession.v2','memphisOpsManagerOpenSession.v1','memphisOpsAccessKey.v1',
    'memphisOpsFullAccessKey.v1','memphisOpsReadOnlyAccessKey.v1','memphisGeminiAdminSession.v1'];
  const key='memphisAssignedDeviceId',operation='11111111-1111-4111-8111-111111111111';
  const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
  const tick=()=>new Promise(setImmediate);let count=0;
  function fixture({url='https://example.invalid/ops-manager-hub.html?device=KIOSK_08',old=true}={}){
    const effects=[],requests=[];
    class Area{
      constructor(){this.rows=new Map([[key,'KIOSK_09'],['unknown-original','{ exact UNKNOWN }'],
        ...(old?legacy.map((k,i)=>[k,'retired fixture '+i]):[])]);}
      getItem(k){return this.rows.get(k)??null;}
      setItem(k,v){effects.push(['set',k,String(v)]);this.before?.(k);this.rows.set(k,String(v));this.after?.(k);}
      removeItem(k){effects.push(['remove',k]);this.before?.(k);this.rows.delete(k);this.after?.(k);}
    }
    const storage=new Area(),locks=createSyntheticScheduleLocks(),navigator={locks};
    const location=new URL(url),window={location,localStorage:storage,navigator};
    const gate=createProtectedBrowserAdmission({storage,locks});
    const source=read('memphis-auth.js');
    function load(){vm.runInNewContext(source,{window,localStorage:storage,navigator,URL,URLSearchParams,Date,Intl,AbortSignal,
      console,setTimeout,clearTimeout,fetch:(...args)=>{requests.push(args);throw Error('NO_REAL_REQUEST');}},
      {filename:'memphis-auth.js',importModuleDynamically:s=>import(new URL(s,root))});return window.MemphisAuth;}
    return {storage,locks,navigator,window,gate,load,effects,requests,
      data:()=>[key,...legacy,'unknown-original'].map(k=>[k,storage.rows.get(k)??null])};
  }
  async function run(name,body){if(selected&&selected!==name)return;await body();count++;console.log('PASS_NEW_AUTH_BROWSER '+name);}
  await run('startup-retirement-cannot-delete-through-hold',async()=>{
    const x=fixture();await x.gate.holdAndObserve({operationId:operation});const before=x.data();x.load();await tick();
    assert.deepEqual(x.data(),before,'startup retirement must preserve all captured originals under the real shared hold');
    assert.equal(x.effects.filter(([,k])=>legacy.includes(k)).length,0);assert.equal(x.requests.length,0);
  });
  await run('held-retired-session-data-never-restores-authorization',async()=>{
    const x=fixture();x.storage.rows.set(legacy[0],JSON.stringify({role:'ops_manager',token:'retired-source-fixture-token',
      expires_at:new Date(Date.now()+600000).toISOString(),access_level:'full_access',roles:['OPS_MANAGER','SECURITY_ADMIN']}));
    await x.gate.holdAndObserve({operationId:operation});const original=x.data(),api=x.load();await tick();
    assert.equal(api.readSession(),null);assert.equal(api.canMutateOpsManagerSurface(),false);
    assert.equal(api.hasRole('SECURITY_ADMIN'),false);assert.deepEqual(x.data(),original);
    assert.equal(x.requests.length,0,'retained legacy DATA cannot authenticate itself or start a request');
  });
  await run('public-browser-identity-cannot-write-through-hold',async()=>{
    const x=fixture({old:false});await x.gate.holdAndObserve({operationId:operation});const original=x.storage.rows.get(key),api=x.load();
    assert.equal(api.getDeviceId(),'KIOSK_08','sync identity return remains DATA');await tick();
    assert.equal(x.storage.rows.get(key),original,'public identity selector cannot overwrite held original');
    assert.equal(x.effects.filter(([,k])=>k===key).length,0);assert.equal(x.requests.length,0);
  });
  await run('ordinary-original-cache-writes-use-one-shared-owner',async()=>{
    const x=fixture(),api=x.load();assert.equal(api.getDeviceId(),'KIOSK_08');await tick();
    assert.equal(x.storage.rows.get(key),'KIOSK_08');for(const k of legacy)assert.equal(x.storage.rows.has(k),false);
    assert.equal(x.storage.rows.get('unknown-original'),'{ exact UNKNOWN }');assert.equal(x.locks.pending,0);
    assert.equal(x.effects.filter(([,k])=>k===key).length,1);assert.equal(x.requests.length,0);
    api.getDeviceId();await tick();assert.equal(x.effects.filter(([,k])=>k===key).length,1,'same original cache intent must not blindly retry');
  });
  await run('queued-original-and-storage-owner-changes-refuse',async()=>{
    for(const change of ['raw','storage','writer','lock','native']){
      const x=fixture({old:false}),entered=deferred(),release=deferred();
      const blocker=x.gate.mutate(async()=>{entered.resolve();await release.promise;});await entered.promise;
      const api=x.load();api.getDeviceId();await tick();
      if(change==='raw')x.storage.rows.set(key,'{ FOREIGN ORIGINAL }');
      if(change==='storage')x.window.localStorage={};
      if(change==='writer')x.storage.setItem=function(k,v){this.rows.set(k,String(v));};
      if(change==='lock')x.navigator.locks=createSyntheticScheduleLocks();
      if(change==='native')x.window.MemphisMobileBuildIdentity={edition:'custodial'};
      const original=x.storage.rows.get(key);release.resolve();await blocker;await tick();
      assert.equal(x.storage.rows.get(key),original);assert.equal(x.effects.filter(([,k])=>k===key).length,0);
    }
  });
  await run('unknown-retirement-result-never-retries-or-rolls-back',async()=>{
    const x=fixture();let removed=false;
    x.storage.after=k=>{if(legacy.includes(k)&&!removed){removed=true;throw Error('UNKNOWN_AFTER_ORIGINAL_REMOVAL');}};
    const api=x.load();await tick();assert.equal(removed,true);
    const original=x.data(),effects=x.effects.length;
    api.getDeviceId();await tick();api.getDeviceId();await tick();
    assert.deepEqual(x.data(),original);assert.equal(x.effects.length,effects);
    assert.equal(x.storage.rows.get('unknown-original'),'{ exact UNKNOWN }');
  });
  await run('new-browser-id-remains-one-data-selection-while-save-pending',async()=>{
    const x=fixture({old:false,url:'https://example.invalid/ops-manager-hub.html'});x.storage.rows.delete(key);
    const entered=deferred(),release=deferred(),blocker=x.gate.mutate(async()=>{entered.resolve();await release.promise;});await entered.promise;
    const api=x.load(),first=api.getDeviceId(),second=api.getDeviceId();
    assert.match(first,/^manager-browser-/);assert.equal(second,first);release.resolve();await blocker;await tick();
    assert.equal(x.storage.rows.get(key),first);assert.equal(x.effects.filter(([,k])=>k===key).length,1);
    assert.equal(x.requests.length,0);
  });
  assert(count>0,'new selected cache behavior must execute');
  console.log(JSON.stringify({scope:'actual auth IIFE and actual shared browser owner; recording Storage/locks only',passed:count,
    real_auth:false,network:false,browser:false,native:false,SQL:false,old_tests_run:0}));
}
