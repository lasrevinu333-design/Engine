import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../mobile/src/chatscope/app.jsx',import.meta.url),'utf8');
const begin=source.indexOf('async function resolveAuthHeaders() {'),end=source.indexOf('\nfunction deviceId()',begin);
assert.ok(begin>0&&end>begin,'exact owning resolver located');
let passed=0;const failures=[];
async function check(name,run){try{await run();passed++;}catch(error){failures.push({name,error:error.message});}}
function fixture({employee=false,helper=true,reject=false}={}){
 let calls=0;const expected={Authorization:'Bearer synthetic-current-cohort','X-Device-Id':'synthetic-registration','X-CSRF-Token':'synthetic-current-csrf'};
 const auth={requireOpsManagerSession:async()=>({token:'synthetic-current-cohort',device_id:'synthetic-registration'}),getDeviceId:()=> 'synthetic-registration'};
 if(helper)auth.opsManagerAuthHeaders=async()=>{calls++;if(reject)throw Error('Synthetic current session refused');return {...expected};};
 const context={EMPLOYEE_CONTEXT:employee,employeeDeviceId:()=> 'KIOSK_08',window:{MemphisAuth:auth},Error};vm.createContext(context);
 vm.runInContext(source.slice(begin,end)+'\nglobalThis.resolve=resolveAuthHeaders;',context);
 return {resolve:context.resolve,expected,calls:()=>calls};
}
await check('cohort token/device/CSRF obtained from one current helper snapshot',async()=>{const f=fixture();assert.deepEqual(JSON.parse(JSON.stringify(await f.resolve())),f.expected);assert.equal(f.calls(),1);});
await check('missing manager helper fails closed instead of assembling incomplete headers',async()=>{const f=fixture({helper:false});await assert.rejects(f.resolve());});
await check('current helper refusal cannot fall back to an older bearer',async()=>{const f=fixture({reject:true});await assert.rejects(f.resolve(),/Synthetic current session refused/);});
await check('non-native employee path retains only its device header',async()=>{const f=fixture({employee:true});assert.deepEqual(JSON.parse(JSON.stringify(await f.resolve())),{'X-Device-Id':'KIOSK_08'});assert.equal(f.calls(),0);});
console.log(JSON.stringify({scope:'Exact current website Messenger header resolver; synthetic auth only, no request/provider/browser',passed,failed:failures.length,failures},null,2));
if(failures.length)process.exitCode=1;
