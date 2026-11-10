import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
const source=readFileSync(new URL('../memphis-auth.js',import.meta.url),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const id=n=>'91000000-0000-4000-8000-'+String(n).padStart(12,'0');
const session=token=>({role:'ops_manager',token,device_id:'manager-test',manager_id:id(1),credential_id:id(2),expires_at:'2099-01-01T00:00:00.000Z',access_level:'full_access',read_only:false,auth_mode:'custodial_leadership_pin',owner:false,custodial_management_admin:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1}});
const response=token=>({ok:true,status:200,json:async()=>({ok:true,enrolled:true,csrfToken:'synthetic-csrf',session:{registrationId:id(2),identityAssurance:'SELF_ASSERTED_NAME',claimedAccount:{accountId:id(3)},cohort:{principalId:id(1),policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:session(token)}})});
const revoked=()=>({ok:true,status:200,json:async()=>({ok:true,revoked:true,enrolled:false})});
function fixture(fetch){
 const navigations=[],location=new URL('https://lasrevinu333-design.github.io/Engine/dashboard.html');location.replace=url=>navigations.push(url);
 const window={location};
 const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
 vm.runInNewContext(source,{window,localStorage,navigator:{platform:'fixture'},URL,Date,AbortSignal,fetch});
 return Object.assign(window.MemphisAuth,{fixtureNavigations:navigations});
}
for(const failure of ['unavailable','timeout','malformed','denied'])test(`session ${failure} is not a request to sign in again`,async()=>{
 const auth=fixture(async()=>{
  if(failure==='timeout')throw new TypeError('Synthetic network failure');
  return failure==='malformed'?{ok:true,status:200,json:async()=>({ok:true})}:
   {ok:false,status:failure==='denied'?403:503,json:async()=>({ok:false,error:'leadership_unavailable'})};
 });
 await assert.rejects(auth.requireOpsManagerSession({redirect:true,throwOnFailure:true}),error=>error.code!=='MANAGER_SIGN_IN_REQUIRED');
 assert.equal(auth.fixtureNavigations.length,0);assert.equal(auth.readSession(),null);
});
test('only confirmed missing registration routes to the shared sign-in page',async()=>{
 const auth=fixture(async()=>({ok:true,status:200,json:async()=>({ok:true,enrolled:false,csrfToken:'synthetic'})}));
 await assert.rejects(auth.requireOpsManagerSession({redirect:true,throwOnFailure:true}),error=>error.code==='MANAGER_SIGN_IN_REQUIRED'&&error.status===401);
 assert.equal(auth.fixtureNavigations.length,1);assert.match(auth.fixtureNavigations[0],/ops-manager-hub\.html/);
});
test('simultaneous page components share one remembered-session read without PIN submission',async()=>{
 const pending=deferred(),calls=[];const auth=fixture((url,options)=>{calls.push({url,options});return pending.promise;});
 const a=auth.requireOpsManagerSession({redirect:true}),b=auth.requireOpsManagerSession({redirect:true});
 pending.resolve(response('remembered'));assert.equal(await a,await b);assert.equal(calls.length,1);
 assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.credentials,'include');assert.equal(auth.fixtureNavigations.length,0);
});
test('late trusted-session response after logout cannot revive the manager',async()=>{
 const pending=deferred();let reads=0;const auth=fixture(async url=>String(url).endsWith('/revoke')?revoked():++reads===1?pending.promise:response('logout-reader'));
 const read=auth.requireOpsManagerSession({interactive:false});
 await auth.clearSession();pending.resolve(response('old-fixture-token'));
 assert.equal(await read,null);assert.equal(auth.readSession(),null);
});
test('late failed old request does not clear a newer successful explicit sign-in',async()=>{
 const pending=deferred();let reads=0;
 const auth=fixture(async url=>{
  if(String(url).endsWith('/revoke'))return revoked();
  if(++reads===1)return pending.promise;return response('new-fixture-token');
 });
 const old=auth.requireOpsManagerSession({interactive:false});await auth.clearSession();
 await auth.requestTrustedOpsSession();
 pending.resolve({ok:false,status:401,json:async()=>({ok:false})});await old;
 assert.equal(auth.readSession()?.token,'new-fixture-token');
});
