import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(process.argv[2]+'/index.html','utf8');
const source=html.slice(html.indexOf('    async function admitNewScanWork('),html.indexOf('    async function recoverVerifiedRollbackFenceForNewWork('));
const tests=[];
async function test(name,fn){try{await fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:e.message});}}
function fixture(code,online=true,alwaysFail=false){let calls=0,refresh=0;const snapshot={snapshot_id:'a'.repeat(64)};
 const ctx={navigator:{onLine:online},managerRecoveryError:message=>Error(message),
  refreshScanAuthoritySnapshot:async()=>{refresh++;return snapshot;},
  window:{MemphisScanSync:{admitNewLocalWork:async fn=>({admitted:true,value:await fn()})},MemphisMobile:{
   loadOfflineAuthoritySnapshot:async()=>snapshot,
   authorizeOfflineNewWork:async()=>{calls++;if(code&&(calls===1||alwaysFail))throw Object.assign(Error(code),{code});return {authorized:true};}
  }}};vm.createContext(ctx);vm.runInContext(source,ctx);return {run:()=>ctx.admitNewScanWork('KIOSK_08'),get refresh(){return refresh;},get calls(){return calls;}};
}
for(const code of ['custodial_native_offline_anchor_expired','custodial_native_offline_anchor_continuity_changed'])await test(code+' refreshes once online then reauthorizes',async()=>{const f=fixture(code);await f.run();assert.equal(f.refresh,1);assert.equal(f.calls,2);});
await test('expired offline authority is not fabricated',async()=>{const f=fixture('custodial_native_offline_anchor_expired',false);await assert.rejects(f.run());assert.equal(f.refresh,0);});
for(const code of ['custodial_native_vault_decrypt_failed','custodial_native_rollback_fence_active','custodial_native_queue_admission_refused','custodial_native_device_binding_mismatch'])await test(code+' is not refresh authority',async()=>{const f=fixture(code);await assert.rejects(f.run());assert.equal(f.refresh,0);});
await test('refresh failure does not loop or bypass second refusal',async()=>{const f=fixture('custodial_native_offline_anchor_expired',true,true);await assert.rejects(f.run());assert.equal(f.refresh,1);assert.equal(f.calls,2);});
await test('valid authority needs no network refresh',async()=>{const f=fixture(null);await f.run();assert.equal(f.refresh,0);assert.equal(f.calls,1);});
console.log(JSON.stringify({scope:'Exact admission source with isolated native/network result fixtures',passed:tests.filter(t=>t.passed).length,failed:tests.filter(t=>!t.passed).length,tests},null,2));process.exitCode=tests.some(t=>!t.passed)?1:0;
