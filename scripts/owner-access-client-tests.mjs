import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
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
assert.equal(node('events-admin-link').hidden,true);assert.equal(node('manager-access-link').hidden,true);assert.equal(node('owner-coverage-link').hidden,true);cases.push('owner-only Hub controls are hidden from delegates');
for(const id of ['map-email','map-password','map-login-form'])assert.ok(read('ops-manager-hub.html').includes(`id="${id}"`));
for(const id of ['coverage-form','coverage-end','coverage-reason','enable','disable','coverage-state','timezone','status'])assert.ok(read('owner-access.html').includes(`id="${id}"`));cases.push('sign-in and coverage controls have their required DOM targets');
console.log(JSON.stringify({result:'OWNER_ACCESS_CLIENT_VM_PASS',cases:cases.length,tests:cases,scope:'Actual JavaScript in an isolated VM with synthetic network/storage/DOM; HTML script syntax and control targets. Not a rendered-browser or live-password test.'},null,2));
