import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../mobile/src/custodial/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../mobile/src/custodial/index.html',import.meta.url),'utf8');
const results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
function fixture({enrolled=false,reject=false,delay=false}={}){
  let releaseResponse;const responseReady=delay?new Promise(resolve=>{releaseResponse=resolve;}):Promise.resolve();
  let status={native:true,initialized:true,ready:true,available:true,state:enrolled?'enrolled':'unenrolled',deviceId:enrolled?'KIOSK_08':''};
  let subscriber;const elements=new Map(),calls=[],memory=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{hidden:id!=='boot',textContent:'',value:'',className:'',disabled:false,addEventListener(){},insertAdjacentHTML(){}});return elements.get(id);};
  const security={native:true,ready:Promise.resolve(),getStatus:()=>({...status}),ensureSecurityState:async()=>({...status}),getPendingEnrollmentOperation:()=>null,subscribe:fn=>{subscriber=fn;}};
  const window={MemphisCustodialSecurity:security,MemphisUI:{resolveOpenScanSession:()=>({state:'none'})},
    MemphisScanSync:{reconcileStartupRecovery:async()=>({state:'ready'}),recoverLocalCompletionIntents:async()=>{}},
    MemphisMobile:{whenReady:async()=>{},resumePendingSecurityWorkflow:async()=>{calls.push('resume');},readCustodialHomeCache:()=>null,saveCustodialHomeCache:async()=>true,
      requestJson:async path=>{calls.push(path);await responseReady;if(reject)throw Object.assign(new Error('Not authorized'),{status:403});return {authenticated:true,canonical_device_id:'KIOSK_08',employee_name:'Fixture Assigned Custodian',employee_role:'CUSTODIAL_EMPLOYEE'};}},
    setInterval:()=>1,clearInterval(){},setTimeout:()=>2,clearTimeout(){}};
  const context={window,document:{getElementById:element},navigator:{onLine:false},console,
    sessionStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)},
    installHomeFacts:()=>({stop(){},update(){}}),App:{addListener:async()=>{}},Network:{addListener:async()=>{}},StatusBar:{hide:async()=>{}},Promise,Date,Error};
  vm.createContext(context);
  const executable=source.replace(/^import .*;\s*$/gm,'').replace('void (async () => {','globalThis.__startup = (async () => {');
  vm.runInContext(executable+'\nglobalThis.__restore=restore;',context);
  return {context,elements,calls,ready:()=>context.__startup,releaseResponse:()=>releaseResponse?.(),setUnassigned:()=>{status={...status,state:'unenrolled',deviceId:''};subscriber({...status});},setAssigned:()=>{status={...status,state:'enrolled',deviceId:'KIOSK_08'};subscriber({...status});}};
}
await check('employee startup has no phone selector, code field, or login form',()=>{
  assert.doesNotMatch(html,/<(?:form|input|select)\b/i);
  assert.doesNotMatch(html,/Phone number|Manager code|eight.digit|one-time-code|Set Up Phone/i);
});
await check('employee controller never requests a code or asks the employee to enroll',()=>{
  assert.doesNotMatch(source,/els\.(?:code|device|form)\b|managerCode\s*:|Choose the phone number|eight.digit manager code|addEventListener\('submit'/i);
});
await check('unassigned native state waits for manager assignment without inventing an employee',async()=>{
  const f=fixture();await f.ready();
  assert.equal(f.elements.get('assignment').hidden,false);
  assert.match(f.elements.get('assignment-status').textContent,/manager/i);
  assert.equal(f.elements.get('home').hidden,true);
  assert.ok(!f.calls.some(path=>path.startsWith('/device-auth/status')));
});
await check('assigned phone opens using its authenticated assigned employee without user input',async()=>{
  const f=fixture({enrolled:true});await f.ready();
  assert.equal(f.elements.get('home').hidden,false);
  assert.equal(f.elements.get('employee-name').textContent,'Fixture Assigned Custodian');
  assert.ok(f.calls.includes('/device-auth/status?device_id=KIOSK_08'));
});
await check('manager-side assignment triggers startup automatically',async()=>{
  const f=fixture();await f.ready();f.setAssigned();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.elements.get('home').hidden,false);
  assert.equal(f.elements.get('employee-name').textContent,'Fixture Assigned Custodian');
});
await check('server rejection cannot be turned into a fake assigned Home',async()=>{
  const f=fixture({enrolled:true,reject:true});await f.ready();
  assert.equal(f.elements.get('home').hidden,true);
  assert.match(f.elements.get('boot-title').textContent,/manager/i);
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
console.log(JSON.stringify({scope:'Actual employee startup controller with synthetic native assignment and backend responses; no real provisioning or phone acceptance',passed:results.filter(row=>row.passed).length,failed:results.filter(row=>!row.passed).length,results},null,2));
process.exitCode=results.some(row=>!row.passed)?1:0;
