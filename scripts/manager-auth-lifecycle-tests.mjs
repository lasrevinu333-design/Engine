import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
const source=readFileSync(new URL('../memphis-auth.js',import.meta.url),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const session=token=>({role:'ops_manager',token,device_id:'manager-test',expires_at:'2099-01-01T00:00:00.000Z',access_level:'full_access'});
const response=token=>({ok:true,status:200,json:async()=>({ok:true,data:{session:session(token)}})});
function fixture(fetch){
 const window={location:new URL('https://lasrevinu333-design.github.io/Engine/dashboard.html')};
 const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
 vm.runInNewContext(source,{window,localStorage,navigator:{platform:'fixture'},URL,Date,AbortSignal,fetch});
 return window.MemphisAuth;
}
test('late trusted-session response after logout cannot revive the manager',async()=>{
 const pending=deferred();const auth=fixture(async url=>String(url).includes('/ops/logout')?{ok:true,status:200}:pending.promise);
 const read=auth.requireOpsManagerSession({interactive:false});
 await auth.clearSession();pending.resolve(response('old-fixture-token'));
 assert.equal(await read,null);assert.equal(auth.readSession(),null);
});
test('late failed old request does not clear a newer successful explicit sign-in',async()=>{
 const pending=deferred();let reads=0;
 const auth=fixture(async url=>{
  if(String(url).includes('/ops/logout'))return{ok:true,status:200};
  if(++reads===1)return pending.promise;return response('new-fixture-token');
 });
 const old=auth.requireOpsManagerSession({interactive:false});await auth.clearSession();
 await auth.requestTrustedOpsSession();
 pending.resolve({ok:false,status:401,json:async()=>({ok:false})});await old;
 assert.equal(auth.readSession()?.token,'new-fixture-token');
});
