import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const t=fs.readFileSync(process.argv[2]+'/memphis-scan-sync.js','utf8');
let source=t.slice(t.indexOf('  function releaseStartupRecoveryGate('),t.indexOf('  function safeText('));
if(t.includes('  async function reconcileStartupRecovery(')) source+=t.slice(t.indexOf('  async function reconcileStartupRecovery('),t.indexOf('  async function sync()'));
source+=t.slice(t.indexOf('  async function sync()'),t.indexOf('  function localCompletionReceipt('));
async function attempt(result){let reconciles=0,workers=0,intents=0;
 const c={state:{startupRecoveryPending:true,db:{},deviceId:'KIOSK_08'},safeText:v=>String(v||''),scheduleSync(){},
  ensureWorkerReady:async()=>true,securityPause:async()=>null,securityErrorIsPause:()=>false,dispatchSecurityPause(){},dispatchStatus(){},
  recoverLocalCompletionIntents:async()=>{intents++;},runWorker:async()=>{workers++;return true;},
  navigator:{onLine:true,locks:{request(){}}},window:{MemphisMobile:{ready:Promise.resolve(),reconcileRecoveredPreStart:async()=>{reconciles++;return {state:result};}}}};
 vm.createContext(c);vm.runInContext(source,c);await Promise.all(Array.from({length:20},()=>c.sync()));
 return {reconciles,workers,intents,pending:c.state.startupRecoveryPending};
}
const tests=[];async function check(name,fn){try{await fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:e.message});}}
for(const state of ['none','not_applicable','retired_preserved']) await check(state+' recovers from any worker entry page',async()=>{
 const r=await attempt(state);assert.equal(r.reconciles,1);assert.equal(r.intents,1);assert.equal(r.pending,false);assert.ok(r.workers>0);
});
for(const state of ['manager_required','invalid_state']) await check(state+' never opens unsafe delivery',async()=>{
 const r=await attempt(state);assert.equal(r.workers,0);assert.equal(r.pending,true);
});
console.log(JSON.stringify({scope:'Actual shared-startup and sync source functions; native/storage/worker boundaries simulated',passed:tests.filter(x=>x.passed).length,failed:tests.filter(x=>!x.passed).length,tests},null,2));process.exitCode=tests.some(x=>!x.passed)?1:0;
