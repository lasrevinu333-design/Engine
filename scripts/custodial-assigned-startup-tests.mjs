import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {assertOwnerContextClosed} from './scan-owner-vm-context.mjs';
import { installHourlyForecastKeyboard } from '../mobile/src/custodial/hourly-forecast-keyboard.js';
const source=readFileSync(new URL('../mobile/src/custodial/app.js',import.meta.url),'utf8');
const { classifyReadiness, createReadinessObservation, readinessPresentation, readinessSupportCode } = await import(`data:text/javascript;base64,${Buffer.from(readFileSync(new URL('../mobile/src/custodial/readiness.js',import.meta.url),'utf8')).toString('base64')}`);
const html=readFileSync(new URL('../mobile/src/custodial/index.html',import.meta.url),'utf8');
const results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
function fixture({enrolled=false,reject=false,delay=false,cached=null,missingPrincipal=false,capturePrincipal=true,mismatchedProfile=false,offline=false,recoveryBlocked=false}={}){
  let releaseResponse;const responseReady=delay?new Promise(resolve=>{releaseResponse=resolve;}):Promise.resolve();
  let status={native:true,initialized:true,ready:true,available:true,quarantined:false,generation:1,state:enrolled?'enrolled':'unenrolled',deviceId:enrolled?'KIOSK_08':''};
  let subscriber;const elements=new Map(),calls=[],memory=new Map();
  let principal=missingPrincipal?'':'original',name='Fixture Assigned Custodian',failNetwork=offline;
  const element=id=>{if(!elements.has(id))elements.set(id,{hidden:id!=='boot',textContent:'',value:'',className:'',disabled:false,addEventListener(){},insertAdjacentHTML(){}});return elements.get(id);};
  const security={native:true,ready:Promise.resolve(),getStatus:()=>({...status}),ensureSecurityState:async()=>({...status}),getPendingEnrollmentOperation:()=>null,subscribe:fn=>{subscriber=fn;}};
  const window={MemphisCustodialSecurity:security,MemphisUI:{resolveOpenScanSession:()=>({state:'none'})},
    MemphisScanSync:{reconcileStartupRecovery:async()=>{calls.push('protected-recovery');return {state:!principal||recoveryBlocked?'manager_required':'not_applicable'};},recoverLocalCompletionIntents:async()=>{calls.push('completion-recovery');}},
    MemphisMobile:{whenReady:async()=>{},resumePendingSecurityWorkflow:async()=>{calls.push('resume');},readCustodialHomeCache:()=>cached,saveCustodialHomeCache:async()=>true,
      principalIdentity:()=>status.state==='enrolled'?principal:'',
      profileMatchesPrincipal:value=>Boolean(principal)&&status.state==='enrolled'&&value?.authenticated===true&&value?.canonical_device_id==='KIOSK_08'&&value?.fixture_principal===principal,
      requestJson:async(path,options)=>{calls.push(path);const original=status;const value={authenticated:true,canonical_device_id:'KIOSK_08',employee_name:name,employee_role:'CUSTODIAL_EMPLOYEE',fixture_principal:principal||'original'};await responseReady;if(reject)throw Object.assign(new Error('Not authorized'),{status:403});if(failNetwork)throw Error('offline');if(options?.expectedGeneration!=null&&original!==status)throw Error('retired request');if(!principal&&capturePrincipal){principal='original';status={...status,generation:status.generation+1};subscriber?.({...status});}if(mismatchedProfile)value.fixture_principal='foreign';return value;}},
    setInterval:()=>1,clearInterval(){},setTimeout:()=>2,clearTimeout(){}};
  const context={window,document:{getElementById:element},navigator:{onLine:false},console,queueMicrotask,classifyReadiness,createReadinessObservation,readinessPresentation,readinessSupportCode,installHourlyForecastKeyboard,
    __MZ_CUSTODIAL_OWNER_TEST_SUPPORT__:false,
    sessionStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)},
    installHomeFacts:()=>({stop(){},update(){},authenticatedProfileRestored(){return true;},async restoreProfileFacts(){return true;}}),App:{addListener:async()=>{}},Network:{addListener:async()=>{}},StatusBar:{hide:async()=>{}},Promise,Date,Error};
  vm.createContext(context);
  const executable=source.replace(/^import .*;\s*$/gm,'').replace('void (async () => {','globalThis.__startup = (async () => {');
  const closed=executable+'\nglobalThis.__restore=restore;';
  assertOwnerContextClosed(closed,context,'complete Custodial Home owner');
  vm.runInContext(closed,context);
  return {context,elements,calls,ready:()=>context.__startup,releaseResponse:()=>releaseResponse?.(),setUnassigned:()=>{status={...status,state:'unenrolled',deviceId:''};subscriber({...status});},setAssigned:()=>{status={...status,state:'enrolled',deviceId:'KIOSK_08'};subscriber({...status});},
    replacePrincipal:({offline=false}={})=>{principal='replacement';name='Replacement Custodian';failNetwork=offline;subscriber({...status});}};
}
await check('owner closure names missing and newly introduced free dependencies before execution',()=>{
  assert.throws(()=>assertOwnerContextClosed('readinessPresentation({});',{}),/readinessPresentation/);
  assert.doesNotThrow(()=>assertOwnerContextClosed('readinessPresentation({});',{readinessPresentation}));
  assert.throws(()=>assertOwnerContextClosed('function owner(){return introducedOwnerDependency;} owner();',{}),/introducedOwnerDependency/);
});
await check('employee startup has no phone selector, code field, or login form',()=>{
  assert.doesNotMatch(html,/<(?:form|input|select)\b/i);
  assert.doesNotMatch(html,/Phone number|Manager code|eight.digit|one-time-code|Set Up Phone/i);
});
await check('employee controller never requests a code or asks the employee to enroll',()=>{
  assert.doesNotMatch(source,/els\.(?:code|device|form)\b|managerCode\s*:|Choose the phone number|eight.digit manager code|addEventListener\('submit'/i);
});
await check('startup and readiness never direct custodians to manager assignment or PIN approval',()=>{
  assert.doesNotMatch(source,/This phone needs a manager|Ask a manager|showManagerNeeded/);
  assert.doesNotMatch(html,/Needs manager|Ask a manager|manager assignment|Manager code/i);
  for(const path of ['index.html','events-view.js','employee-schedule.html','chatscope-messenger.js',
    'mobile/src/custodial/employee-schedule-runtime.js','mobile/src/chatscope/app.jsx']){
    assert.doesNotMatch(readFileSync(new URL('../'+path,import.meta.url),'utf8'),/This phone needs a manager|Ask (?:a|your) manager/i,path);
  }
  for(const input of [{managerRequired:true},{authRejected:true},{security:{quarantined:true}},{sessionState:'corrupted'}]){
    const shown=readinessPresentation(classifyReadiness(input),input);
    assert.equal(shown.hidden,false);assert.doesNotMatch(shown.label+' '+shown.detail,/manager|PIN|approval/i);
  }
});
await check('missing native identity reports saved setup repair without inventing an employee',async()=>{
  const f=fixture();await f.ready();
  assert.equal(f.elements.get('assignment').hidden,false);
  assert.match(f.elements.get('assignment-status').textContent,/saved setup/i);
  assert.doesNotMatch(f.elements.get('assignment-status').textContent,/manager|PIN|sign.in/i);
  assert.equal(f.elements.get('home').hidden,true);
  assert.ok(!f.calls.some(path=>path.startsWith('/device-auth/status')));
});
await check('assigned phone opens using its authenticated assigned employee without user input',async()=>{
  const f=fixture({enrolled:true});await f.ready();
  assert.equal(f.elements.get('home').hidden,false);
  assert.equal(f.elements.get('employee-name').textContent,'Fixture Assigned Custodian');
  assert.ok(f.calls.includes('/device-auth/status?device_id=KIOSK_08'));
});
await check('first assigned activation captures native principal before protected recovery',async()=>{
  const f=fixture({enrolled:true,missingPrincipal:true});await f.ready();
  assert.equal(f.elements.get('home').hidden,false);
  assert.ok(f.calls.indexOf('/device-auth/status?device_id=KIOSK_08')<f.calls.indexOf('protected-recovery'));
  assert.equal(f.elements.get('employee-name').textContent,'Fixture Assigned Custodian');
});
for(const options of [{reject:true},{offline:true},{capturePrincipal:false},{mismatchedProfile:true}])await check(`first-principal failure preserves startup hold ${JSON.stringify(options)}`,async()=>{
  const f=fixture({enrolled:true,missingPrincipal:true,...options});await f.ready();
  assert.equal(f.elements.get('home').hidden,true);
  // A native principal publication queues a second restore. Even when that
  // valid principal allows local recovery, the mismatched profile cannot open Home.
  if(!options.mismatchedProfile){
    assert.ok(!f.calls.includes('protected-recovery'));
    assert.ok(!f.calls.includes('completion-recovery'));
  }
});
await check('first-principal capture does not bypass protected recovery refusal',async()=>{
  const f=fixture({enrolled:true,missingPrincipal:true,recoveryBlocked:true});await f.ready();
  assert.equal(f.elements.get('home').hidden,true);assert.ok(f.calls.includes('protected-recovery'));
});
await check('late first-principal response after removal cannot enter protected recovery or Home',async()=>{
  const f=fixture({enrolled:true,missingPrincipal:true,delay:true});await new Promise(resolve=>setImmediate(resolve));
  f.setUnassigned();f.releaseResponse();await f.ready();
  assert.equal(f.elements.get('home').hidden,true);assert.ok(!f.calls.includes('protected-recovery'));
});
await check('offline existing principal retains cached Home and protected recovery',async()=>{
  const cached={authenticated:true,canonical_device_id:'KIOSK_08',employee_name:'Fixture Assigned Custodian',fixture_principal:'original'};
  const f=fixture({enrolled:true,offline:true,cached:{profile:cached}});await f.ready();
  assert.equal(f.elements.get('home').hidden,false);
  assert.ok(f.calls.indexOf('protected-recovery')<f.calls.indexOf('/device-auth/status?device_id=KIOSK_08'));
});
await check('manager-side assignment triggers startup automatically',async()=>{
  const f=fixture();await f.ready();f.setAssigned();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.elements.get('home').hidden,false);
  assert.equal(f.elements.get('employee-name').textContent,'Fixture Assigned Custodian');
});
await check('server rejection cannot be turned into a fake assigned Home',async()=>{
  const f=fixture({enrolled:true,reject:true});await f.ready();
  assert.equal(f.elements.get('home').hidden,true);
  assert.match(f.elements.get('boot-title').textContent,/setup needs repair/i);
  assert.doesNotMatch(f.elements.get('boot-title').textContent+' '+f.elements.get('boot-status').textContent,/manager|PIN|approval/i);
});
await check('existing protected-work and backend authorization checks remain in the startup path',()=>{
  assert.match(source,/security\.ensureSecurityState\(\)/);
  assert.match(source,/reconcileProtectedStartup\(\)/);
  assert.match(source,/profile\?\.authenticated/);
  assert.match(source,/resumePendingSecurityWorkflow/);
});
await check('revoked assignment cannot leave the previous employee Home visible',async()=>{
  const f=fixture({enrolled:true});await f.ready();f.setUnassigned();
  assert.equal(f.elements.get('home').hidden,true);
  assert.equal(f.elements.get('assignment').hidden,false);
});
await check('a late response after assignment removal cannot restore the prior employee',async()=>{
  const f=fixture({enrolled:true,delay:true});await new Promise(resolve=>setImmediate(resolve));
  f.setUnassigned();f.releaseResponse();await f.ready();
  assert.equal(f.elements.get('home').hidden,true);
});
await check('same-KIOSK principal change clears old Home immediately and ignores late old response',async()=>{
  const f=fixture({enrolled:true,delay:true});await new Promise(resolve=>setImmediate(resolve));
  f.replacePrincipal();assert.equal(f.elements.get('employee-name').textContent,'');assert.equal(f.elements.get('home').hidden,true);
  f.releaseResponse();await f.ready();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.elements.get('employee-name').textContent,'Replacement Custodian');
  assert.equal(f.elements.get('home').hidden,false);
});
await check('a prior principal cache cannot reappear after recovery while offline',async()=>{
  const old={authenticated:true,canonical_device_id:'KIOSK_08',employee_name:'Prior private name',fixture_principal:'original'};
  const f=fixture({enrolled:true,cached:{profile:old}});await f.ready();f.replacePrincipal({offline:true});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.elements.get('employee-name').textContent,'');assert.equal(f.elements.get('phone-lock-name').textContent,'');
  assert.equal(f.elements.get('home').hidden,true);
});
console.log(JSON.stringify({scope:'Actual employee startup controller with synthetic native assignment and backend responses; no real provisioning or phone acceptance',passed:results.filter(row=>row.passed).length,failed:results.filter(row=>!row.passed).length,results},null,2));
process.exitCode=results.some(row=>!row.passed)?1:0;
