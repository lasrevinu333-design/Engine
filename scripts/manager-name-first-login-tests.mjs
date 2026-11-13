import test from 'node:test';import assert from 'node:assert/strict';
import {mountLeadershipEnrollment} from '../custodial-leadership-enrollment.mjs';
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const ids=['leadership-pin','approved-name','status','pin-form','name-form','enrolled','check-session','verify-pin','enroll-browser','revoke-browser','claimed-name'];
const session={identityAssurance:'SELF_ASSERTED_NAME',claimedAccount:{accountId:'account-eric',displayName:'Eric Operle'},cohort:{principalId:'cohort',policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:{token:'synthetic-not-persisted'}};
async function fixture({remembered=false,rememberedName='Eric Operle',challenge='valid',uncertainEnroll=false,pause=async()=>{}}={}){
 const oldOption=globalThis.Option;globalThis.Option=class{constructor(text,value){this.text=text;this.value=value;}};
 const elements=new Map(ids.map(id=>[id,{value:'',textContent:'',hidden:false,disabled:false,listeners:new Map(),options:[],
  addEventListener(t,f){this.listeners.set(t,f);},removeEventListener(t){this.listeners.delete(t);},replaceChildren(...o){this.options=o;this.value='';},add(o){this.options.push(o);},focus(){}}]));
 const e=id=>elements.get(id),calls=[],accepted=[];let enrolled=remembered;
 const fetchImpl=async(url,options)=>{
  const path=new URL(url).pathname,body=options.body&&JSON.parse(options.body);calls.push({path,body,options});
  let value={ok:true},status=200;
  if(path.endsWith('/session'))value={ok:true,enrolled,csrfToken:'synthetic-csrf',session:enrolled?{...session,claimedAccount:{...session.claimedAccount,displayName:rememberedName}}:null};
  else if(path.endsWith('/challenge')){
   if(challenge==='denied'){status=403;value={ok:false};}
   else value={ok:true,approvedNames:challenge==='missing'?[{accountId:'other',displayName:'Other'}]:[{accountId:'account-eric',displayName:'Eric Operle'}]};
  }else if(path.endsWith('/enroll')){assert.equal(body.accountId,'account-eric');enrolled=true;if(uncertainEnroll)throw Error('Synthetic lost response');value={ok:true,enrolled:true,csrfToken:'synthetic-csrf',session};}
  else if(path.endsWith('/revoke'))enrolled=false;else throw Error('Unexpected endpoint');
  await pause(path);return{ok:status===200,status,json:async()=>value};
 };
 const controller=await mountLeadershipEnrollment({document:{getElementById:e},fetchImpl,serviceOrigin:'https://fixture.invalid',onSession:v=>accepted.push(v)});
 const submit=id=>e(id).listeners.get('submit')?.({preventDefault(){}}),click=id=>e(id).listeners.get('click')?.();
 return{e,calls,accepted,submit,click,controller,async signIn(){e('approved-name').value='Eric Operle';await submit('name-form');e('leadership-pin').value='0000';await submit('pin-form');},close(){controller.stop();globalThis.Option=oldOption;}};
}
test('name first, transient PIN second, exact verified account enrolls once',async()=>{const f=await fixture();try{
 assert.equal(f.e('name-form').hidden,false);assert.equal(f.e('pin-form').hidden,true);assert.equal(f.calls.length,1);
 f.e('approved-name').value='Eric Operle';await f.submit('name-form');assert.equal(f.calls.length,1);assert.equal(f.e('pin-form').hidden,false);
 f.e('leadership-pin').value='0000';await f.submit('pin-form');assert.equal(f.e('leadership-pin').value,'');
 assert.deepEqual(f.calls.map(c=>c.path),['/custodial-leadership-api/session','/custodial-leadership-api/challenge','/custodial-leadership-api/enroll']);
 assert.equal(f.e('enrolled').hidden,false);assert.equal(f.accepted.at(-1).session.identityAssurance,'SELF_ASSERTED_NAME');
 assert.ok(f.calls.every(c=>c.options.credentials==='include'&&c.options.cache==='no-store'));assert.equal(f.calls[2].options.headers['X-CSRF-Token'],'synthetic-csrf');
}finally{f.close();}});
test('approved full names are visible without changing challenge selectors or remembered registrations',async()=>{
 const labels=[['Eric McKenney','Eric McKenney'],['Haley Lejman','Haley'],['Brandy Gull','Brandy Gull'],['Jennifer Sheffield','Jennifer'],['Annie Feist','Annie'],['Eric Operle','Eric Operle']];
 const f=await fixture();try{
  assert.deepEqual(f.e('approved-name').options.slice(1).map(o=>[o.text,o.value]),labels);
  f.e('approved-name').value='Haley';await f.submit('name-form');assert.equal(f.e('status').textContent,'Enter the manager PIN for Haley Lejman.');assert.equal(f.calls.length,1);
 }finally{f.close();}
 for(const [fullName,serverName] of labels.filter(([full,server])=>full!==server)){
  const remembered=await fixture({remembered:true,rememberedName:serverName});try{
   assert.equal(remembered.e('claimed-name').textContent,fullName);assert.equal(remembered.accepted[0].session.claimedAccount.displayName,serverName);
   assert.deepEqual(remembered.calls.map(c=>c.path),['/custodial-leadership-api/session']);
  }finally{remembered.close();}
 }
});
test('PIN and browser-save progress remain visible while each request is pending',async()=>{
 let release;const f=await fixture({pause:path=>path.endsWith('/session')?Promise.resolve():new Promise(resolve=>{release=resolve;})});
 try{const pending=f.signIn();await new Promise(r=>setImmediate(r));
  assert.match(f.e('status').textContent,/Checking the manager PIN/);assert.equal(f.e('verify-pin').disabled,true);assert.equal(f.e('leadership-pin').value,'');
  release();await new Promise(r=>setImmediate(r));assert.match(f.e('status').textContent,/Saving this browser/);assert.equal(f.e('verify-pin').disabled,true);
  release();await pending;assert.match(f.e('status').textContent,/ready for manager access/);assert.equal(f.calls.filter(c=>c.path.endsWith('/enroll')).length,1);
 }finally{f.close();}
});
test('verified remembered sign-in opens the requested manager page; unverified binding never navigates',async()=>{
 const source=readFileSync(new URL('../custodial-leadership-enrollment.mjs',import.meta.url),'utf8');
 const callback=source.slice(source.indexOf('onSession:async (body,')+'onSession:'.length,source.indexOf('\n}).catch'));
 for(const requested of ['/Engine/operations-dashboard.html','https://untrusted.invalid/dashboard.html']){
  const nav=[],link={hidden:true},location=new URL('https://lasrevinu333-design.github.io/Engine/ops-manager-hub.html?return='+encodeURIComponent(requested));location.replace=url=>nav.push(url);
  const accepted={...session,registrationId:'registration'},verified={manager_id:'cohort',credential_id:'registration'};
  const auth={refreshLeadershipSession:async()=>verified,isCustodialManagementAdmin:()=>true};
  const invoke=vm.runInNewContext('('+callback+')',{window:{MemphisAuth:auth},document:{getElementById:()=>link},location,URL,URLSearchParams});
  await invoke({enrolled:false});assert.equal(nav.length,0);
  await invoke({enrolled:true,session:accepted});assert.equal(nav.length,1);
  assert.equal(new URL(nav[0]).pathname,requested.startsWith('/Engine/')?requested:'/Engine/start_page1.html');
  location.search='';await invoke({enrolled:true,session:accepted});assert.equal(nav.length,1);assert.equal(link.hidden,false);
  await invoke({enrolled:true,session:accepted},{signedIn:true});assert.equal(nav.length,2);
  verified.credential_id='different';await assert.rejects(invoke({enrolled:true,session:accepted}),/binding changed/);assert.equal(nav.length,2);
 }
});
test('remembered server registration reopens without name, PIN or new enrollment',async()=>{const f=await fixture({remembered:true});try{
 assert.equal(f.e('name-form').hidden,true);assert.equal(f.e('pin-form').hidden,true);assert.equal(f.e('enrolled').hidden,false);assert.equal(f.calls.length,1);
 await f.controller.read();assert.ok(f.calls.every(c=>c.path.endsWith('/session')));
}finally{f.close();}});
for(const challenge of ['denied','missing'])test(`unverified PIN or selected account never enrolls: ${challenge}`,async()=>{const f=await fixture({challenge});try{
 await f.signIn();assert.equal(f.e('leadership-pin').value,'');assert.ok(!f.calls.some(c=>c.path.endsWith('/enroll')));assert.equal(f.e('enrolled').hidden,true);
}finally{f.close();}});
test('uncertain enrollment reconciles original session before another mutation; stop removes callbacks',async()=>{const f=await fixture({uncertainEnroll:true});try{
 await f.signIn();assert.equal(f.e('verify-pin').disabled,true);assert.match(f.e('status').textContent,/unconfirmed/);
 await f.click('check-session');assert.equal(f.e('enrolled').hidden,false);assert.equal(f.calls.filter(c=>c.path.endsWith('/enroll')).length,1);
 f.controller.stop();assert.ok(ids.every(id=>f.e(id).listeners.size===0));assert.equal(f.e('leadership-pin').value,'');
}finally{f.close();}});
