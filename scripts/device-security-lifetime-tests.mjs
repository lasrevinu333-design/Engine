import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const root=process.argv[2]||new URL('..',import.meta.url).pathname,mode=process.argv[3]||'stable';const nodes=new Map(),events=new Map(),docEvents=new Map(),calls=[];const id=n=>'ba000000-0000-4000-8000-'+String(n).padStart(12,'0');
const node=k=>{if(!nodes.has(k)){const classes=new Set(k==='app'?['hidden']:[]);nodes.set(k,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,style:{},listeners:new Map(),classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)},addEventListener(k,f){this.listeners.set(k,f)},querySelector:s=>node(s),querySelectorAll:()=>[],scrollIntoView(){}})}return nodes.get(k)};
let now=Date.parse('2026-11-14T12:00:00Z');class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
const session={role:'ops_manager',roles:['OPS_MANAGER','SECURITY_ADMIN'],token:'SYNTHETIC_ONLY',device_id:'synthetic-device',manager_id:id(2),credential_id:id(3),expires_at:'2026-11-14T12:01:00Z',auth_mode:'custodial_leadership_pin',owner:false,custodial_management_admin:true,read_only:false,access_level:'full_access',permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1}};
let serverSession=session,releaseSummary,releaseCode,deferSummary=false,deferCode=false;const timers=new Map();let timerId=0;
const storage=new Map([['retained-original-history','SYNTHETIC_ORIGINAL_BYTES']]),localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const fetch=async(url,options={})=>{const path=new URL(url).pathname;calls.push({path,method:options.method||'GET'});let body;
if(path==='/custodial-leadership-api/session')body={ok:true,enrolled:true,csrfToken:'SYNTHETIC_CSRF',session:{identityAssurance:'SELF_ASSERTED_NAME',registrationId:id(3),claimedAccount:{accountId:id(1)},cohort:{principalId:serverSession.manager_id,policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:serverSession}};
else if(path==='/custodial-leadership-api/revoke')body={ok:true,revoked:true};
else if(path==='/admin-api/device-security/session')body={ok:true,data:{configured:true,unlocked:true,auth_mode:'custodial_leadership_pin',security_scope:'custodial_device_management',manager_id:session.manager_id,csrf_token:'SYNTHETIC_SECURITY_CSRF',expires_at:mode==='unlock-expiry'?'2026-11-14T12:00:20Z':'2026-11-14T12:01:00Z'}};
else if(path==='/admin-api/device-auth/summary'){if(deferSummary)await new Promise(r=>releaseSummary=r);body={ok:true,data:{policy:{mode:'enroll'},coverage:{required_total:1,devices:[{device_id:'SYNTHETIC_PHONE',employee_name:'SYNTHETIC_EMPLOYEE',credential:{credential_id:id(8)},registry_present:true,employee_id:id(9),employee_active:true,device_active:true,employee_code:'EMP999',assignment_valid:true}]}}};}
else if(path==='/admin-api/device-auth/enrollment-code'){if(deferCode)await new Promise(r=>releaseCode=r);body={ok:true,data:{canonical_device_id:'SYNTHETIC_PHONE',enrollment_code:'SYNTHETIC-NEVER-VALID-ENROLLMENT',code_id:id(70),expires_at:mode==='code-expiry'?'2026-11-14T12:00:15Z':'2026-11-14T12:10:00Z'}};}
else throw Error('unexpected '+path);return {ok:true,status:200,json:async()=>body};};
const win={fetch,localStorage,navigator:{},location:new URL('https://synthetic.invalid/device-security.html'),setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id},clearTimeout:id=>timers.delete(id),addEventListener(k,f){const l=events.get(k)||[];l.push(f);events.set(k,l)},dispatchEvent(e){for(const f of events.get(e.type)||[])f(e)},CustomEvent:class{constructor(type){this.type=type}},document:{getElementById:node,documentElement:node('html'),addEventListener(k,f){const l=docEvents.get(k)||[];l.push(f);docEvents.set(k,l)}},URL,AbortSignal,AbortController,Date:Clock,Intl,performance,console,crypto:{randomUUID:()=>id(99)}};win.window=win;const context=vm.createContext(win);
vm.runInContext(readFileSync(root+'/memphis-auth.js','utf8'),context);
const html=readFileSync(root+'/device-security.html','utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);let source=scripts[0][1];const needle='    try{const session=await window.MemphisAuth.requireOpsManagerSession';assert.equal(source.split(needle).length,2);source=source.replace(needle,'    globalThis.auditGenerateCode=generateCode;globalThis.auditRefresh=refresh;\n'+needle);
await vm.runInContext(source,context,{filename:'actual-device-security-inline.js',importModuleDynamically:async()=>{throw Error('Synthetic test leaves optional protected recovery panels unavailable; no custody fixture invented')}});await context.auditGenerateCode('SYNTHETIC_PHONE');assert.equal(node('code').textContent,'SYNTHETIC-NEVER-VALID-ENROLLMENT');assert.equal(node('app').classList.contains('hidden'),false);
const fireTimers=()=>{for(const[id,t]of[...timers])if(t.at<=now){timers.delete(id);t.fn();}};
if(mode==='revoke'){await win.MemphisAuth.clearSession();assert.equal(node('code').textContent,'','immediate event withdrawal');}
else if(mode==='expiry-timer'){now+=61000;fireTimers();}
else if(mode==='unlock-expiry'){now+=21000;fireTimers();}
else if(mode==='code-expiry'){now+=16000;fireTimers();}
else if(mode==='renewal'||mode==='successor'){serverSession={...session,token:'SYNTHETIC_RENEWAL',manager_id:mode==='successor'?id(44):session.manager_id,expires_at:'2026-11-14T12:03:00Z'};await win.MemphisAuth.refreshLeadershipSession();}
else if(mode==='late-summary'||mode==='late-code'){
 if(mode==='late-summary')deferSummary=true;else deferCode=true;
 const pending=mode==='late-summary'?context.auditRefresh():context.auditGenerateCode('SYNTHETIC_PHONE');await new Promise(r=>setImmediate(r));
 assert.equal(typeof(mode==='late-summary'?releaseSummary:releaseCode),'function');await win.MemphisAuth.clearSession();
 (mode==='late-summary'?releaseSummary:releaseCode)();await pending;
}else if(mode==='pagehide')win.dispatchEvent({type:'pagehide'});
else if(mode==='adapter-change'){win.MemphisAuth={...win.MemphisAuth};win.dispatchEvent({type:'focus'});}
else assert.equal(mode,'stable');
await new Promise(r=>setImmediate(r));
if(mode==='stable'){assert.equal(node('code').textContent,'SYNTHETIC-NEVER-VALID-ENROLLMENT');assert.equal(node('app').classList.contains('hidden'),false);assert.match(node('devices').innerHTML,/SYNTHETIC_PHONE/);}
else {assert.equal(node('code').textContent,'');if(mode==='code-expiry'){assert.equal(node('app').classList.contains('hidden'),false);assert.match(node('devices').innerHTML,/SYNTHETIC_PHONE/);}else{assert.equal(node('app').classList.contains('hidden'),true);assert.equal(node('devices').innerHTML,'');assert.equal(node('summary').innerHTML,'');assert.equal(node('mode-row').innerHTML,'');}}
assert.equal(storage.get('retained-original-history'),'SYNTHETIC_ORIGINAL_BYTES');
const mutations=calls.filter(x=>x.method!=='GET'&&x.path!=='/custodial-leadership-api/revoke');
assert.equal(mutations.length,mode==='late-code'?2:1,'no automatic enrollment/replay or replacement');
assert.ok(mutations.every(x=>x.path==='/admin-api/device-auth/enrollment-code'));
console.log(JSON.stringify({mode,status:'PASS',original_history_preserved:true,synthetic_mutations:mutations.length,optional_panels:'unavailable; main lifetime independent'}));
