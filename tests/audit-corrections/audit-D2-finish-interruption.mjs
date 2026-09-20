import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(process.argv[2]+'/index.html','utf8');
const start=html.indexOf('    async function finishSessionMaybeQueued(');
const end=html.indexOf('    async function completeSessionMaybeQueued(',start);
const source=html.slice(start,end);
const SESSION='10000000-0000-4000-8000-000000000001', ENTRY='20000000-0000-4000-8000-000000000001';
const START='2026-09-18T12:00:00.000Z', END='2026-09-18T12:20:00.000Z';
function setup(fault='') {
  let saved={session_uuid:SESSION,client_session_id:SESSION,location_code:'NOCX',location_name:'Nocturnal',
    device_id:'KIOSK_08',started_at:START,status:'active',employee_name:'Test Custodian',scan_evidence:[],server_acknowledged:false};
  let proof=null, captureCalls=0, faultPending=true;
  const ctx={crypto:{randomUUID:()=>SESSION},currentScanEntryAttestation:{entry_id:ENTRY},currentScanState:null,
    isReadonlyScanEmployeeDevice:()=>true,resolveLocationKind:()=>({locationType:'exhibit',formType:'exhibit'}),
    getLatestLocalSessionForLocation:async()=>structuredClone(saved),completionIdForSession:async()=>SESSION,
    saveLocalSession:async row=>{
      if(faultPending&&((fault==='intent_write'&&row.finish_capture_pending===true)||(fault==='final_write'&&row.status==='pending_submit'))){faultPending=false;throw Error('injected disk failure');}
      saved=structuredClone(row);
    },window:{MemphisMobile:{nativeOfflineTimeAuthority:true,
      bindScanEntryAttestation:async id=>{if(proof)throw Error('temporary entry already retired');assert.equal(id,ENTRY);},
      captureOfflineCompletionTime:async input=>{captureCalls++;assert.equal(input.nativeFinishScanEntryId,ENTRY);
        proof??={p_native_finish_scan_entry_id:ENTRY,p_client_ended_at:END};
        if(fault==='native_reply_lost'&&faultPending){faultPending=false;throw Error('renderer lost native reply');}
        return {...proof};
      }}}};vm.createContext(ctx);vm.runInContext(source,ctx);
  return {ctx,get saved(){return saved;},get proof(){return proof;},get calls(){return captureCalls;}};
}
const results=[];
async function test(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
await test('ordinary Finish keeps exact identity/time and required form pending',async()=>{
 const s=setup();await s.ctx.finishSessionMaybeQueued('NOCX','KIOSK_08');
 assert.equal(s.saved.native_finish_scan_entry_id,ENTRY);assert.equal(s.saved.ended_at,END);assert.equal(s.saved.status,'pending_submit');
});
await test('a failed pre-capture intent write performs no native Finish mutation',async()=>{
 const s=setup('intent_write');await assert.rejects(s.ctx.finishSessionMaybeQueued('NOCX','KIOSK_08'));
 assert.equal(s.calls,0);assert.equal(s.proof,null);assert.equal(s.saved.status,'active');
});
for(const fault of ['final_write','native_reply_lost']) await test(fault+': restart resumes same physical Finish without a new scan',async()=>{
 const s=setup(fault);await assert.rejects(s.ctx.finishSessionMaybeQueued('NOCX','KIOSK_08'));
 assert.equal(s.saved.native_finish_scan_entry_id,ENTRY);assert.equal(s.saved.finish_capture_pending,true);
 assert.equal(s.saved.status,'active');s.ctx.currentScanEntryAttestation=null;
 await s.ctx.finishSessionMaybeQueued('NOCX','KIOSK_08');
 assert.equal(s.saved.native_finish_scan_entry_id,ENTRY);assert.equal(s.saved.ended_at,END);
 assert.equal(s.saved.finish_capture_pending,false);assert.equal(s.saved.status,'pending_submit');
 assert.equal(s.saved.server_acknowledged,false);assert.equal(s.saved.scan_evidence.length,1);
});
await test('a replacement tag cannot change a previously captured Finish identity',async()=>{
 const s=setup('native_reply_lost');await assert.rejects(s.ctx.finishSessionMaybeQueued('NOCX','KIOSK_08'));
 s.ctx.currentScanEntryAttestation={entry_id:'30000000-0000-4000-8000-000000000001'};
 await s.ctx.finishSessionMaybeQueued('NOCX','KIOSK_08');assert.equal(s.saved.native_finish_scan_entry_id,ENTRY);assert.equal(s.saved.ended_at,END);
});
console.log(JSON.stringify({scope:'Exact source function, isolated storage/native fault simulations; not physical phone',passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results},null,2));
process.exitCode=results.some(x=>!x.passed)?1:0;
