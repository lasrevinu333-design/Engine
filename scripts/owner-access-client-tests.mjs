import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
if(process.argv.includes('--auth-browser-preservation-only')){
  await authBrowserPreservationCases();process.exit(0);
}
const cases=[];
const local=new Map(),sessionStore=new Map();
const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i],get length(){return map.size;}});
const nodes=new Map(),redirects=[],requests=[];
const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',className:'',href:'',classList:{toggle(){},add(){},remove(){}}});return nodes.get(id);};
let isOwner=true,validConfig=true;
const expiry=()=>new Date(Date.now()+600000).toISOString();
const mockSession=()=>({role:'ops_manager',manager_id:'91000000-0000-4000-8000-000000000001',manager_display_name:isOwner?'Fixture owner':'Fixture delegate',device_id:'fixture-browser',credential_id:'92000000-0000-4000-8000-000000000001',token:'fixture-custodial-token',expires_at:expiry(),roles:isOwner?['OPS_MANAGER','CUSTODIAL_MANAGER','SECURITY_ADMIN']:['OPS_MANAGER'],access_level:isOwner?'full_access':'read_only',read_only:!isOwner,trusted_device:true,identity_source:'memphis_map',permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:isOwner,close_scan_tickets:true,manage_absences:true}});
const location={href:'https://lasrevinu333-design.github.io/Engine/start_page1.html',pathname:'/Engine/start_page1.html',search:'',hash:'',origin:'https://lasrevinu333-design.github.io',replace:url=>redirects.push(url)};
const fetch=async(url,options={})=>{
 requests.push({url:String(url),options});
 if(String(url).endsWith('/auth-api/map-config'))return {ok:true,json:async()=>({ok:true,data:{url:validConfig?'https://dwzdqekusvivjbxsapdu.supabase.co':'https://wrong.invalid',publishable_key:'sb_publishable_fixture'}})};
 if(String(url).includes('/auth/v1/token?grant_type=password')){
  assert.equal(url,'https://dwzdqekusvivjbxsapdu.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  assert.equal(JSON.parse(options.body).password,'fixture-password');
  return {ok:true,json:async()=>({access_token:'fixture-map-token',refresh_token:'fixture-provider-refresh'})};
 }
 if(String(url).endsWith('/auth-api/map-session')){
  assert.equal(options.credentials,'include');assert.deepEqual(JSON.parse(options.body),{access_token:'fixture-map-token'});
  return {ok:true,json:async()=>({ok:true,data:{session:mockSession(),identity_source:'memphis_map'}})};
 }
 if(String(url).includes('/auth-api/session'))return {ok:true,json:async()=>({ok:true,data:{session:mockSession()}})};
 return {ok:false,status:503,json:async()=>({ok:false})};
};
const document={referrer:'',getElementById:node,body:{dataset:{memphisContext:'manager'}}};
const window={location,localStorage:storage(local),sessionStorage:storage(sessionStore),crypto:webcrypto,document};
const context=vm.createContext({window,document,localStorage:window.localStorage,sessionStorage:window.sessionStorage,location,fetch,URL,URLSearchParams,Date,Intl,AbortSignal,console,crypto:webcrypto,setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout});
vm.runInContext(read('memphis-auth.js'),context);
await window.MemphisAuth.signInWithMap('owner@example.invalid','fixture-password');
assert.equal(window.MemphisAuth.canMutateOpsManagerSurface(),true);cases.push('owner session exposes full controls');
assert.equal(requests.filter(r=>String(r.options.body).includes('fixture-password')).length,1);cases.push('password goes only to pinned Map provider');
assert.equal([...local.values(),...sessionStore.values()].some(v=>/fixture-password|fixture-map-token|fixture-custodial-token|fixture-provider-refresh/.test(v)),false);cases.push('no password or access/refresh token stored in browser storage');
isOwner=false;await window.MemphisAuth.signInWithMap('delegate@example.invalid','fixture-password');
assert.equal(window.MemphisAuth.canMutateOpsManagerSurface(),false);assert.equal(window.MemphisAuth.hasPermission('close_scan_tickets'),true);cases.push('delegate has read-only session plus explicit exceptions');
const prior=requests.length;await window.MemphisAuth.opsManagerAuthHeaders();assert.equal(requests.length,prior);cases.push('projected delegate session does not cause a refresh loop');
validConfig=false;await assert.rejects(()=>window.MemphisAuth.signInWithMap('delegate@example.invalid','fixture-password'));validConfig=true;cases.push('wrong identity-provider configuration is rejected');
for(const name of ['ops-manager-hub.html','owner-access.html','start_page1.html']){
 const html=read(name);
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1].trim())new vm.Script(match[1],{filename:name});
 cases.push(name+' inline JavaScript syntax');
}
new vm.Script(read('owner-access.js'));new vm.Script(read('ops-hub.js'));
vm.runInContext(read('ops-hub.js'),context);await new Promise(r=>setTimeout(r,10));
assert.equal(redirects.length,0,'a valid read-only manager must enter the Hub instead of looping back to login');
assert.match(node('access-mode').textContent,/Read-only/);cases.push('read-only manager Hub entry and label');
assert.equal(read('start_page1.html').includes('id="events-admin-link"'),false,'retired input console has no Hub element');assert.equal(node('manager-access-link').hidden,true);assert.equal(node('owner-coverage-link').hidden,true);cases.push('owner-only Hub controls are hidden from delegates');
for(const id of ['map-email','map-password','map-login-form'])assert.ok(read('ops-manager-hub.html').includes(`id="${id}"`));
for(const id of ['coverage-form','coverage-end','coverage-reason','enable','disable','coverage-state','timezone','status'])assert.ok(read('owner-access.html').includes(`id="${id}"`));cases.push('sign-in and coverage controls have their required DOM targets');
console.log(JSON.stringify({result:'OWNER_ACCESS_CLIENT_VM_PASS',cases:cases.length,tests:cases,scope:'Actual JavaScript in an isolated VM with synthetic network/storage/DOM; HTML script syntax and control targets. Not a rendered-browser or live-password test.'},null,2));

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
