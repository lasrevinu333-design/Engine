import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(name)=>fs.readFileSync(path.resolve(root,name),'utf8');
const auth=read('memphis-auth.js');
const entry=read('ops-manager-hub.html');
const access=read('manager-access.html');
const security=read('device-security.html');
const hub=read('start_page1.html');
const hubController=read('ops-hub.js');
const viewer=read('ops-viewer.html');

if(process.argv.includes('--security-code-lifetime-only')||process.argv.includes('--security-coverage-presentation-only')||process.argv.includes('--security-request-owner-new-only')){
  const script=[...security.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(text=>text.includes("const API='https://memphis-zoo-mcp.onrender.com/admin-api/device-auth'"));
  assert.ok(script,'device security controller script exists');
  function fixture({deferCode=false,failCode=false,expire=false,deferUnlock=false,deferSummary=false,deferSecondSecurityCheck=false,deferFourthManagerSession=false,coverage=null}={}){
    const headerResolvers=[],requests=[];let deferNextHeader=false;
    const elements=new Map(),calls=[],copied=[],codeResolvers=[],summaryResolvers=[];let resolveLock,resolveUnlock,resolveSecurityCheck,resolveManagerSession,securityCheckCalls=0,managerSessionCalls=0,codeCalls=0,reload=false,session={id:'named-manager',roles:['OPS_MANAGER','SECURITY_ADMIN']};
    class Element{constructor(id){this.id=id;this.textContent='';this.innerHTML='';this.dataset={code:'KIOSK_08'};this.handlers={};this.hidden=id==='app';this.classes=new Set(id==='app'?['hidden']:[]);this.classList={add:value=>{this.classes.add(value);this.hidden=this.classes.has('hidden');},remove:value=>{this.classes.delete(value);this.hidden=this.classes.has('hidden');},contains:value=>this.classes.has(value)};}addEventListener(name,fn){this.handlers[name]=fn;}querySelectorAll(selector){if(this.id==='mode-row'&&selector==='[data-mode]'){this.modeButtons??=['observe','enroll','enforce'].map(mode=>Object.assign(new Element(mode),{dataset:{mode}}));return this.modeButtons;}if(this.id==='devices'&&selector==='[data-revoke]'&&coverage){this.revokeButtons??=coverage.devices.filter(row=>row.credential).map(row=>Object.assign(new Element('revoke'),{dataset:{revoke:row.credential.credential_id}}));return this.revokeButtons;}if(this.id==='devices'&&selector.includes('data-code')){this.buttons??=[Object.assign(new Element('generate'),{dataset:{code:'KIOSK_08'}})];return this.buttons;}return [];}scrollIntoView(){}}
    for(const [,id] of security.matchAll(/id="([^"]+)"/g))elements.set(id,new Element(id));
    const response=(data)=>({ok:true,status:200,json:async()=>({ok:true,data})});
    const summary=()=>response({policy:{mode:'enroll'},coverage:coverage??{ready_to_enforce:false,devices:[{device_id:'KIOSK_08',registry_present:true,device_active:true,employee_id:'1',employee_active:true,employee_code:'EMP1',assignment_valid:true}]}});
    const fetch=async(url)=>{calls.push(url);if(url.endsWith('/summary'))return deferSummary?new Promise(resolve=>summaryResolvers.push(()=>resolve(summary()))):summary();if(url.endsWith('/enrollment-code')){if(failCode)return{ok:false,status:503,json:async()=>({ok:false,error:'synthetic failure'})};const n=++codeCalls,result={code_id:`code-${n}`,canonical_device_id:'KIOSK_08',employee_name:'Fixture',enrollment_code:`1234567${n}`,expires_at:new Date(Date.now()+(expire?-1000:600000)).toISOString()};return deferCode?new Promise(resolve=>{codeResolvers[n-1]=()=>resolve(response(result));}):response(result);}return response({});};
    const auth={readSession:()=>session,hasRole:(role,value=session)=>value===session&&value?.roles.includes(role),requireOpsManagerSession:async()=>{managerSessionCalls++;const requestedSession=session;if(deferFourthManagerSession&&managerSessionCalls===4)return new Promise(resolve=>{resolveManagerSession=()=>resolve(requestedSession);});return session;},deviceSecuritySession:async()=>{securityCheckCalls++;if(deferSecondSecurityCheck&&securityCheckCalls===3)return new Promise(resolve=>{resolveSecurityCheck=()=>resolve({unlocked:true});});return{unlocked:true};},deviceSecurityAuthHeaders:async()=>({}),lockDeviceSecurity:()=>new Promise(resolve=>{calls.push('lock');resolveLock=resolve;}),unlockDeviceSecurity:()=>{calls.push('unlock-device-security');return deferUnlock?new Promise(resolve=>{resolveUnlock=()=>resolve({});}):Promise.resolve({});}};
    const location={pathname:'/device-security.html',reload(){reload=true;}};
    const context={window:{MemphisAuth:auth},document:{getElementById:id=>elements.get(id)||new Element(id)},fetch,location,navigator:{clipboard:{writeText:async value=>copied.push(value)}},confirm:()=>true,console,Date,URL,encodeURIComponent};
    if(process.argv.includes('--security-request-owner-new-only')){
      auth.deviceSecurityAuthHeaders=async()=>deferNextHeader?(deferNextHeader=false,new Promise(resolve=>headerResolvers.push(()=>resolve({})))):{};
      context.fetch=(url,options)=>{requests.push({url,method:options?.method,body:options?.body});return fetch(url);};
    }
    vm.runInNewContext(script,context,{filename:'device-security.html'});
    const tick=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
    return{elements,calls,copied,tick,auth,requests,deferHeader:()=>{deferNextHeader=true;},resolveHeader:()=>{assert.equal(headerResolvers.length,1,'own header await reached');headerResolvers.shift()();},removeSecurityRole:()=>{session.roles=['OPS_MANAGER'];},lock:async()=>{const pending=elements.get('lock').handlers.click();await tick();return pending;},get reload(){return reload;},resolveCode:(index=0)=>codeResolvers[index]?.(),resolveSummary:(index=0)=>summaryResolvers[index]?.(),resolveLock:()=>resolveLock?.(),resolveUnlock:()=>resolveUnlock?.(),resolveSecurityCheck:()=>resolveSecurityCheck?.(),resolveManagerSession:()=>resolveManagerSession?.(),changeSession:(id='replacement')=>{session={id,roles:['OPS_MANAGER','SECURITY_ADMIN']};}};
  }
  const check=async(name,fn)=>{await fn();console.log(`PASS ${name}`);};
  if(process.argv.includes('--security-request-owner-new-only')){
    const coverage={ready_to_enforce:true,ready:1,enrolled:1,required_total:1,total:9,coverage_issues:[],missing:[],devices:[{device_id:'KIOSK_08',registry_present:true,device_active:true,employee_id:'fixture-employee',employee_active:true,employee_code:'EMP8',coverage_required:true,assignment_valid:true,credential:{credential_id:'fixture-credential'},confirmed:true,ready:true}]};
    const init=async()=>{const f=fixture({coverage});await f.tick();return f;};
    const mode=f=>f.elements.get('mode-row').querySelectorAll('[data-mode]').find(button=>button.dataset.mode==='enroll').handlers.click();
    const generate=f=>f.elements.get('devices').querySelectorAll('[data-code]')[0].handlers.click();
    const revoke=f=>f.elements.get('devices').querySelectorAll('[data-revoke]')[0].handlers.click();
    const revokeSessions=f=>f.elements.get('revoke-security-sessions').handlers.click();
    const effects=(f,suffix)=>f.requests.filter(row=>row.url.endsWith(suffix));
    const cases=[
      ['mode write cannot dispatch after page lock during original header await',async()=>{const f=await init();f.deferHeader();const action=mode(f);await f.tick();const locked=f.elements.get('lock').handlers.click();await f.tick();f.resolveHeader();await action;f.resolveLock();await locked;assert.equal(effects(f,'/mode').length,0);assert.equal(f.elements.get('app').hidden,true);}],
      ['mode write cannot use a replacement named session after header await',async()=>{const f=await init();f.deferHeader();const action=mode(f);await f.tick();f.changeSession();f.resolveHeader();await action;assert.equal(effects(f,'/mode').length,0);assert.equal(f.elements.get('app').hidden,true);}],
      ['enrollment code write refuses replacement session before dispatch',async()=>{const f=await init();f.deferHeader();const action=generate(f);await f.tick();f.changeSession();f.resolveHeader();await action;assert.equal(effects(f,'/enrollment-code').length,0);assert.equal(f.elements.get('code').textContent,'');}],
      ['credential revoke refuses lost Security Admin role before dispatch',async()=>{const f=await init();f.deferHeader();const action=revoke(f);await f.tick();f.removeSecurityRole();f.resolveHeader();await action;assert.equal(effects(f,'/credentials/fixture-credential/revoke').length,0);}],
      ['security-session revoke refuses replacement original session',async()=>{const f=await init();f.deferHeader();const action=revokeSessions(f).then(()=>null,error=>error);await f.tick();f.changeSession();f.resolveHeader();const error=await action;assert.equal(effects(f,'/sessions/revoke-all').length,0);assert.match(error?.message||'',/no longer current/i);assert.equal(f.reload,true);}],
      ['security-session revoke refuses subsequent page lock generation',async()=>{const f=await init();f.deferHeader();const action=revokeSessions(f).then(()=>null,error=>error);await f.tick();const locked=f.elements.get('lock').handlers.click();await f.tick();f.resolveHeader();const error=await action;f.resolveLock();await locked;assert.equal(effects(f,'/sessions/revoke-all').length,0);assert.match(error?.message||'',/no longer current/i);}],
      ['same original session preserves both helpers methods bodies and fixed endpoints',async()=>{for(const [launch,suffix,body] of [[mode,'/admin-api/device-auth/mode',{mode:'enroll'}],[generate,'/admin-api/device-auth/enrollment-code',{device_id:'KIOSK_08'}],[revoke,'/admin-api/device-auth/credentials/fixture-credential/revoke',{reason:'revoked_from_device_security_console'}],[revokeSessions,'/admin-api/device-security/sessions/revoke-all',null]]){const f=await init();f.deferHeader();const action=launch(f);await f.tick();f.resolveHeader();await f.tick();if(launch===revokeSessions)f.resolveLock();await action;const requests=effects(f,suffix);assert.equal(requests.length,1);assert.equal(requests[0].url,`https://memphis-zoo-mcp.onrender.com${suffix}`);assert.equal(requests[0].method,'POST');assert.deepEqual(requests[0].body?JSON.parse(requests[0].body):null,body);}}]
    ];
    let failed=0,passed=0;
    for(const [name,fn] of process.argv.includes('--security-request-counterexample-only')?cases.slice(0,2):cases){try{await check(name,fn);passed++;}catch(error){failed++;console.error(`FAIL ${name}: ${error.message}`);}}
    console.log(`SECURITY_REQUEST_OWNER_NEW ${passed} passed ${failed} failed; actual page helpers/events, synthetic headers/session/fetch; no actual auth/server effect`);
    process.exit(failed?1:0);
  }
  if(process.argv.includes('--security-coverage-presentation-only')){
    const base={ready_to_enforce:true,ready:6,enrolled:6,required_total:6,total:9,missing:[],coverage_issues:[],devices:[]};
    const readyFixture=async(coverage)=>{const f=fixture({coverage});await f.tick();return f;};
    const enforce=async(f)=>f.elements.get('mode-row').querySelectorAll('[data-mode]').find(button=>button.dataset.mode==='enforce').handlers.click();
    const cases=[
      ['current eligible count is distinct from diagnostic fleet positions',async()=>{for(const required of [6,7]){const f=await readyFixture({...base,ready:required,required_total:required});const html=f.elements.get('summary').innerHTML;assert.match(html,new RegExp(`<strong>${required} / ${required}</strong>Ready / current eligible employees`));assert.match(html,/<strong>9<\/strong>Registry positions/);assert.doesNotMatch(html,/Employee phones/);assert.match(html,/<strong>Yes<\/strong>Ready to enforce/);}}],
      ['missing-empty refusal explains current eligible assignment issue without mode request',async()=>{const f=await readyFixture({...base,ready_to_enforce:false,coverage_issues:['active_employee_not_uniquely_assigned_to_active_canonical_device']});await enforce(f);assert.match(f.elements.get('status').textContent,/current eligible employee is not uniquely assigned to an active canonical device/i);assert.ok(!f.calls.some(url=>url.endsWith('/mode')));assert.match(f.elements.get('summary').innerHTML,/not uniquely assigned/);}],
      ['unknown or absent reason remains meaningful and server false cannot be recomputed',async()=>{for(const issues of [[],['future_unrecognized_issue']]){const f=await readyFixture({...base,ready:9,ready_to_enforce:false,coverage_issues:issues});await enforce(f);assert.match(f.elements.get('status').textContent,/not verified/i);assert.ok(!f.calls.some(url=>url.endsWith('/mode')));assert.match(f.elements.get('summary').innerHTML,/<strong>No<\/strong>Ready to enforce/);}}],
      ['explicit unassigned and inactive nonrequired rows are diagnostics, not missing phones',async()=>{const rows=[{device_id:'KIOSK_09',registry_present:true,device_active:false,employee_id:null,employee_active:false,coverage_required:false},{device_id:'KIOSK_10',registry_present:true,device_active:false,employee_id:'fixture-inactive',employee_active:false,employee_code:'EMP10',coverage_required:false}];const f=await readyFixture({...base,devices:rows});const html=f.elements.get('devices').innerHTML;assert.match(html,/Unassigned registry position — not required/);assert.match(html,/Inactive employee assignment — not required/);assert.doesNotMatch(html,/Reactivate the device record|Assign an active custodial employee/);assert.equal((html.match(/disabled aria-disabled="true"/g)||[]).length,2);}],
      ['missing registry and unknown assigned employee never become vacancy diagnostics',async()=>{const f=await readyFixture({...base,ready_to_enforce:false,devices:[{device_id:'KIOSK_09',registry_present:false,employee_id:null,coverage_required:false},{device_id:'KIOSK_10',registry_present:true,device_active:true,employee_id:'unknown',employee_active:false,employee_code:null,coverage_required:false}]});const html=f.elements.get('devices').innerHTML;assert.match(html,/Registry row missing/);assert.match(html,/Current employee eligibility unknown/);assert.doesNotMatch(html,/not required|vacant/i);}],
      ['required employee still needs enrollment and returned reasons are escaped',async()=>{const f=await readyFixture({...base,ready_to_enforce:false,missing:['KIOSK_08<script>'],devices:[{device_id:'KIOSK_08',registry_present:true,device_active:true,employee_id:'required',employee_active:true,employee_code:'EMP8',coverage_required:true,assignment_valid:true,credential:null}]});assert.match(f.elements.get('devices').innerHTML,/Enrollment needed/);assert.match(f.elements.get('summary').innerHTML,/KIOSK_08&lt;script&gt;/);assert.doesNotMatch(f.elements.get('summary').innerHTML,/<script>/);await enforce(f);assert.match(f.elements.get('status').textContent,/Missing required or registry devices: KIOSK_08<script>/);assert.ok(!f.calls.some(url=>url.endsWith('/mode')));}],
      ['missing required count is unavailable, never fleet count or zero',async()=>{const {required_total,...coverage}=base;const f=await readyFixture({...coverage,ready_to_enforce:false});assert.match(f.elements.get('summary').innerHTML,/<strong>6 \/ Unavailable<\/strong>Ready \/ current eligible employees/);}],
      ['server-ready narrowed roster preserves original mode request path',async()=>{const f=await readyFixture(base);await enforce(f);assert.equal(f.calls.filter(url=>url==='https://memphis-zoo-mcp.onrender.com/admin-api/device-auth/mode').length,1);}]
    ];
    let failed=0,passed=0;
    for(const [name,fn] of process.argv.includes('--security-coverage-counterexample-only')?cases.slice(0,2):cases){try{await check(name,fn);passed++;}catch(error){failed++;console.error(`FAIL ${name}: ${error.message}`);}}
    console.log(`COVERAGE_PRESENTATION_NEW ${passed} passed ${failed} failed; actual page script/VM, synthetic session and fetch, no browser/HTTP/auth authority`);
    process.exit(failed?1:0);
  }
  if(process.argv.includes('--security-code-lifetime-followup-only')){
    await check('older code cannot overwrite a newer result when its security check resolves late',async()=>{const f=fixture({deferSecondSecurityCheck:true});await f.tick();const button=f.elements.get('devices').querySelectorAll('[data-code]')[0];const first=button.handlers.click();await f.tick();const second=button.handlers.click();await f.tick();assert.equal(f.elements.get('code').textContent,'12345672');f.resolveSecurityCheck();await f.tick();await Promise.all([first,second]);assert.equal(f.elements.get('code').textContent,'12345672');});
    await check('explicit Unlock adopts newly refreshed named Security Admin session',async()=>{const f=fixture();await f.tick();await f.elements.get('devices').querySelectorAll('[data-code]')[0].handlers.click();await f.tick();f.changeSession();await f.elements.get('copy-code').handlers.click();assert.equal(f.elements.get('app').hidden,true);const unlock=f.elements.get('unlock').handlers.click();await f.tick();assert.ok(f.calls.includes('unlock-device-security'));await unlock;assert.equal(f.elements.get('app').hidden,false);});
    await check('stale explicit Unlock cannot adopt a session refreshed after its named-session capture',async()=>{const f=fixture({deferFourthManagerSession:true});await f.tick();await f.elements.get('devices').querySelectorAll('[data-code]')[0].handlers.click();await f.tick();f.changeSession('manager-b');await f.elements.get('copy-code').handlers.click();assert.equal(f.elements.get('app').hidden,true);const unlock=f.elements.get('unlock').handlers.click();await f.tick();f.changeSession('manager-c');f.resolveManagerSession();await f.tick();await unlock;assert.equal(f.elements.get('app').hidden,true);assert.ok(!f.calls.includes('unlock-device-security'));});
    process.exit(0);
  }
  await check('Lock clears visible code synchronously before its awaited lock request',async()=>{const f=fixture();await f.tick();await f.elements.get('devices').querySelectorAll('[data-code]')[0].handlers.click();await f.tick();assert.equal(f.elements.get('code').textContent,'12345671');const pending=f.lock();assert.equal(f.elements.get('code').textContent,'');assert.equal(f.elements.get('code-box').classList.contains('show'),false);f.resolveLock();await pending;});
  await check('late generated code cannot reappear after Lock starts',async()=>{const f=fixture({deferCode:true});await f.tick();const button=f.elements.get('devices').querySelectorAll('[data-code]')[0];const generate=button.handlers.click();await f.tick();const lock=f.lock();f.resolveCode(0);await f.tick();assert.equal(f.elements.get('code').textContent,'');f.resolveLock();await Promise.all([generate,lock]);});
  await check('late unlock completion cannot restore protected app after Lock',async()=>{const f=fixture({deferUnlock:true});await f.tick();const unlock=f.elements.get('unlock').handlers.click();await f.tick();const lock=f.lock();assert.equal(f.elements.get('app').hidden,true);f.resolveUnlock();await f.tick();assert.equal(f.elements.get('app').hidden,true);f.resolveLock();await Promise.all([unlock,lock]);});
  await check('late refresh response cannot restore authenticated app after Lock',async()=>{const f=fixture({deferSummary:true});await f.tick();const lock=f.lock();assert.equal(f.elements.get('app').hidden,true);f.resolveSummary();await f.tick();assert.equal(f.elements.get('app').hidden,true);f.resolveLock();await lock;});
  await check('expired code and replaced named session cannot be copied',async()=>{for(const options of [{expire:true},{}]){const f=fixture(options);await f.tick();await f.elements.get('devices').querySelectorAll('[data-code]')[0].handlers.click();await f.tick();if(!options.expire)f.changeSession();await f.elements.get('copy-code').handlers.click();assert.deepEqual(f.copied,[]);}});
  await check('concurrent code responses keep the newest initiated request only',async()=>{const f=fixture({deferCode:true});await f.tick();const button=f.elements.get('devices').querySelectorAll('[data-code]')[0];const first=button.handlers.click();await f.tick();const second=button.handlers.click();await f.tick();f.resolveCode(1);await f.tick();f.resolveCode(0);await f.tick();await Promise.all([first,second]);assert.equal(f.elements.get('code').textContent,'12345672');});
  await check('generation failure leaves no sensitive code visible',async()=>{const f=fixture({failCode:true});await f.tick();const e=f.elements.get('devices').querySelectorAll('[data-code]')[0];await e.handlers.click();await f.tick();assert.equal(f.elements.get('code').textContent,'');assert.equal(f.elements.get('code-title').textContent,'');});
  process.exit(0);
}

for(const symbol of ['requestTrustedOpsSession','renameOpsManagerTrustedDevice','revokeOpsManagerTrustedDevice','revokeAllOpsManagerTrustedDevices'])assert.match(auth,new RegExp(symbol));
assert.match(auth,/DEVICE_SECURITY_URL/);
assert.match(auth,/X-Device-Security-CSRF/);
assert.match(auth,/ops\/trusted-devices/);
assert.match(auth,/credentials:'include'/);
assert.doesNotMatch(auth,/consumeSharedEnrollmentPasscode|createSharedEnrollmentWindow|disableSharedEnrollmentWindow|ops\/shared-enrollment/);
assert.doesNotMatch(auth,/localStorage\.[gs]etItem\([^)]*(passcode|manager.*token|deviceSecurity)/i);
assert.doesNotMatch(auth,/Fully Kiosk PIN/i);

assert.match(entry,/personal enrollment code/i);
assert.match(entry,/auth-api\/ops\/manager-codes\/consume/);
assert.match(entry,/read-only Viewer/i);
assert.doesNotMatch(entry,/shared enrollment|48-hour passcode/i);

for(const text of ['OPERATIONS LEADERSHIP ACCESS','Leadership Accounts','Generate Personal Code','Trusted Devices','Rename','Revoke'])assert.match(access,new RegExp(text));
assert.match(access,/single-use, 15-minute code/i);
assert.match(access,/leadership-api\/roster/);
assert.match(access,/leadership-api\/managers\/.*enrollment-code/);
assert.match(access,/auth-api\/ops\/trusted-devices/);
assert.match(access,/CUSTODIAL_MANAGER/);
assert.match(access,/displayed only now/i);
assert.doesNotMatch(access,/48-Hour|shared enrollment|Generate PC Invite|Generate Phone Invite|Copy Invite Link|Display Invite QR|QRCode|ops_pairing_token|enrollment_url/i);
assert.doesNotMatch(access,/type="password"|localStorage\.[gs]etItem\([^)]*(passcode|manager)/i);

assert.match(hub,/ops-hub\.js/);
assert.match(hubController,/Named manager enrollment required/);
assert.match(hubController,/ops-manager-hub\.html/);
assert.match(hubController,/hasRole\('CUSTODIAL_MANAGER'/);
assert.match(hubController,/hasRole\('SECURITY_ADMIN'/);
assert.match(hubController,/Annie Feist/);
assert.doesNotMatch(hub+hubController,/consumeSharedEnrollmentPasscode|shared enrollment passcode/i);

assert.match(security,/Security Admin unlock required/);
assert.match(security,/separate Device Security password/);
assert.match(security,/Unlock for 15 minutes/);
assert.match(security,/window\.MemphisAuth\.unlockDeviceSecurity/);
assert.doesNotMatch(security,/shared.*passcode|ops_pairing_token/i);

assert.match(viewer,/read-only/i);
assert.doesNotMatch(viewer,/Messenger|Moxie|Scheduler|Device Security|Manager Access/i);

console.log('NAMED_MANAGER_PASSWORDLESS_FRONTEND_TESTS_PASS');
