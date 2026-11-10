import test from 'node:test';import assert from 'node:assert/strict';
import {mountLeadershipEnrollment} from '../custodial-leadership-enrollment.mjs';
const ids=['leadership-pin','approved-name','status','pin-form','name-form','enrolled','check-session','verify-pin','enroll-browser','revoke-browser','claimed-name'];
const session={identityAssurance:'SELF_ASSERTED_NAME',claimedAccount:{accountId:'account-eric',displayName:'Eric Operle'},cohort:{principalId:'cohort',policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:{token:'synthetic-not-persisted'}};
async function fixture({remembered=false,challenge='valid',uncertainEnroll=false}={}){
 const oldOption=globalThis.Option;globalThis.Option=class{constructor(text,value){this.text=text;this.value=value;}};
 const elements=new Map(ids.map(id=>[id,{value:'',textContent:'',hidden:false,disabled:false,listeners:new Map(),options:[],
  addEventListener(t,f){this.listeners.set(t,f);},removeEventListener(t){this.listeners.delete(t);},replaceChildren(...o){this.options=o;this.value='';},add(o){this.options.push(o);},focus(){}}]));
 const e=id=>elements.get(id),calls=[],accepted=[];let enrolled=remembered;
 const fetchImpl=async(url,options)=>{
  const path=new URL(url).pathname,body=options.body&&JSON.parse(options.body);calls.push({path,body,options});
  let value={ok:true},status=200;
  if(path.endsWith('/session'))value={ok:true,enrolled,csrfToken:'synthetic-csrf',session:enrolled?session:null};
  else if(path.endsWith('/challenge')){
   if(challenge==='denied'){status=403;value={ok:false};}
   else value={ok:true,approvedNames:challenge==='missing'?[{accountId:'other',displayName:'Other'}]:[{accountId:'account-eric',displayName:'Eric Operle'}]};
  }else if(path.endsWith('/enroll')){assert.equal(body.accountId,'account-eric');enrolled=true;if(uncertainEnroll)throw Error('Synthetic lost response');value={ok:true,enrolled:true,csrfToken:'synthetic-csrf',session};}
  else if(path.endsWith('/revoke'))enrolled=false;else throw Error('Unexpected endpoint');
  return{ok:status===200,status,json:async()=>value};
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
