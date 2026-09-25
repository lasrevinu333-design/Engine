import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// CUA-driven isolated real-Chrome storage test. Does not launch/control a browser.
// Product bytes are frozen in memory; only a named test export is injected.
const source=readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
const sha=createHash('sha256').update(source).digest('hex');
const prior=readFileSync(new URL('./fixtures/scan-retry-prior-producer-20260924.js',import.meta.url),'utf8');
const seam='  window.MemphisScanSync = {';
if(source.split(seam).length!==2)throw Error('Exact test-export seam missing');
const instrumented=source.replace(seam,'  window.__ownedStorageTest = {state,CONFIG,now,safeText,isUuid,mutateProtectedQueue,exactSessionForPayload,storageRecord,normalizeRecord,claimNextAction,finishClaim,parseRetryAfter,postOpenContentMigration};\n'+seam);
const oldProducer='(function(){const {state,CONFIG,now,safeText,isUuid,mutateProtectedQueue,exactSessionForPayload}=window.__ownedStorageTest;\n'+prior+'\nwindow.__priorRetryProducer={finishClaim,parseRetryAfter};})();';
const setup=`window.testGeneration=4;
window.MemphisCustodialSecurity={native:true,getStatus:()=>({ready:true,available:true,quarantined:false,deviceId:'KIOSK_08'}),waitForStableState:async()=>true,
mutateProtectedWork:async(fn,options={})=>{if(options.expectedGeneration!=null&&options.expectedGeneration!==window.testGeneration)throw Object.assign(new Error('changed test generation'),{code:'custodial_security_generation_changed'});return fn({deviceId:'KIOSK_08',generation:window.testGeneration,state:'ready'});}};
window.MemphisDeviceIdentity={resolve:()=>({deviceId:'KIOSK_08'})};
window.fetch=async()=>{throw new TypeError('Synthetic network-disabled boundary');};`;
const harness=`
const results=[];
const assert=(condition,label)=>{if(!condition)throw Error(label);results.push(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const identity={contract_version:'scan.v4.snapshot-bound-authority',session_uuid:'11111111-1111-4111-8111-111111111111',client_completion_id:'22222222-2222-4222-8222-222222222222',device_id:'KIOSK_08',employee_id:'33333333-3333-4333-8333-333333333333',location_code:'SYNTHETIC_STORAGE_TEST'};
const draft={work_result:'details',issues:['Synthetic sink issue'],note:'Synthetic retained note'};
const operation='44444444-4444-4444-8444-444444444444';
const payload={p_device_id:'KIOSK_08',p_client_session_id:identity.session_uuid,p_client_completion_id:identity.client_completion_id,p_response_json:{work_result:'checked_no_cleaning_needed',services_performed:[]}};
async function storeRow(row){const t=window.__ownedStorageTest;await new Promise((resolve,reject)=>{const tx=t.state.db.transaction('actions','readwrite');tx.objectStore('actions').put(t.storageRecord(row));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function rawRow(){const t=window.__ownedStorageTest;return new Promise((resolve,reject)=>{const tx=t.state.db.transaction('actions','readonly'),request=tx.objectStore('actions').get(7);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function run(){
 const sync=window.MemphisScanSync,t=window.__ownedStorageTest;
 assert(await sync.ready===true,'actual queue opens');t.state.startupRecoveryPending=true;
 if(location.pathname==='/verify-migration'){
  const raw=await rawRow(),row=t.normalizeRecord(raw);
  assert(Number.isSafeInteger(raw.next_attempt_at)&&raw.next_attempt_at<=Date.now(),'real post-open migration repaired prior Infinity');
  assert(raw.dead_letter===true&&raw.current_dead_letter===false,'migration preserves rollback fence');
  assert(row.operation_id===operation&&same(row.payload,payload),'migration preserves exact saved operation and answers');
  assert(row.retry_count===50&&!row.dead_letter&&row.state==='retrying','migration preserves count and logical retry state');
  const before=JSON.stringify(raw);await t.postOpenContentMigration(t.state.db);
  assert(JSON.stringify(await rawRow())===before,'second actual IndexedDB migration is byte-idempotent');
  const claim=await t.claimNextAction();assert(claim?.operation_id===operation,'actual recovered IndexedDB row is claimable');
  assert(await t.claimNextAction()===null,'recovered row retains single live lease');
  const recovered=await sync.loadCompletionDraft(identity);assert(same(recovered.draft,{issues:draft.issues,note:draft.note,work_result:draft.work_result}),'migration preserves independent draft');
 }else if(location.pathname==='/migration-seed'){
  await sync.saveCompletionDraft({...identity,draft});
  await storeRow({id:7,type:'commit_workflow',operation_id:operation,client_id:identity.client_completion_id,payload,created_at:Date.now(),retry_count:49,state:'pending',next_attempt_at:0,dead_letter:false});
  const claim=await t.claimNextAction(),old=window.__priorRetryProducer;
  assert(old.parseRetryAfter('9'.repeat(400))===Infinity,'exact historical parser produces Infinity');
  await old.finishClaim(claim,{succeeded:false,automaticRetry:true,retryAfterMs:old.parseRetryAfter('9'.repeat(400)),error:'Synthetic HTTP503'});
  const raw=await rawRow();assert(raw.next_attempt_at===Infinity,'actual historical settlement stores Infinity in real IndexedDB');
  assert(raw.current_dead_letter===false&&raw.dead_letter===true,'historical saved row retains logical retry and rollback fence');
  assert(raw.operation_id===operation&&same(raw.payload,payload),'historical producer retains original operation and answers');
 }else if(location.pathname==='/verify'){
  const recovered=await sync.loadCompletionDraft(identity);
  assert(recovered&&same(recovered.draft,{issues:draft.issues,note:draft.note,work_result:draft.work_result}),'actual IndexedDB draft survives new document');
  const row=(await sync.listActions()).find(value=>value.id===7);
  assert(row&&row.operation_id===operation,'same queued operation survives new document');
  assert(same(row.payload,payload),'queue payload survives new document');
  assert(row.retry_count===151&&!row.dead_letter&&row.state==='retrying','retryable state persists above50');
  assert(Number.isSafeInteger(row.next_attempt_at),'finite persisted retry time after new document');
  assert(await t.claimNextAction()===null,'persisted server delay prevents immediate replay');
 }else{
  const saved=await sync.saveCompletionDraft({...identity,draft});
  assert(/^[a-f0-9]{64}$/.test(saved.integrity_sha256),'actual draft hash/readback');
  const recovered=await sync.loadCompletionDraft(identity);assert(same(recovered.draft,saved.draft),'actual draft answers retained');
  for(const count of [49,50,150,Number.MAX_SAFE_INTEGER]){
   await storeRow({id:7,type:'commit_workflow',operation_id:operation,client_id:identity.client_completion_id,payload,created_at:Date.now(),retry_count:count,state:'pending',next_attempt_at:0,dead_letter:false});
   const claim=await t.claimNextAction();assert(claim?.id===7,'actual IndexedDB claim at '+count);
   assert(await t.claimNextAction()===null,'actual live lease excludes a second claim');
   assert(await t.finishClaim({...claim,lease_token:'stale'},{succeeded:false,automaticRetry:true})===false,'stale lease cannot settle');
   window.testGeneration=5;let denied=false;
   try{await t.finishClaim(claim,{succeeded:false,automaticRetry:true});}catch(error){denied=error.code==='custodial_security_generation_changed';}finally{window.testGeneration=4;}
   assert(denied,'changed generation rejects before IndexedDB write');
   assert(await t.finishClaim(claim,{succeeded:false,automaticRetry:true,retryAfterMs:t.parseRetryAfter('1800')})===true,'actual outage transaction settles');
   const raw=await rawRow(),row=t.normalizeRecord(raw);
   assert(raw.dead_letter===true&&raw.current_dead_letter===false,'physical rollback fence and current eligibility distinct');
   assert(!row.dead_letter&&row.state==='retrying','confirmed outage retained as retryable above threshold');
   assert(Number.isSafeInteger(row.retry_count)&&Number.isSafeInteger(row.next_attempt_at),'actual stored numeric values finite');
   assert(row.operation_id===operation&&same(row.payload,payload),'operation and answers unchanged');
   assert(row.next_attempt_at>Date.now()+1790000,'valid server not-before stored');
   assert(await t.claimNextAction()===null,'actual persisted retry delay honored');
  }
  await storeRow({id:7,type:'commit_workflow',operation_id:operation,client_id:identity.client_completion_id,payload,created_at:Date.now(),retry_count:150,state:'pending',next_attempt_at:0,dead_letter:false});
  const claim=await t.claimNextAction();await t.finishClaim(claim,{succeeded:false,automaticRetry:true,retryAfterMs:t.parseRetryAfter('9'.repeat(400))});
  const row=t.normalizeRecord(await rawRow());assert(Number.isSafeInteger(row.next_attempt_at)&&row.next_attempt_at>Date.now(),'oversized header stores ordinary finite backoff');
 }
 document.getElementById('result').textContent=JSON.stringify({status:'PASS',phase:location.pathname,source_sha256:'${sha}',checks:results.length,results,limits:'Real Chrome IndexedDB and page reload; synthetic identity/generation and network boundaries, test-only internal exports. NOT Android/process-death/native receipt/NFC/production/dashboard acceptance.'},null,2);
}
document.getElementById('run').onclick=()=>run().catch(error=>{document.getElementById('result').textContent=JSON.stringify({status:'FAIL',error:String(error),results},null,2);});`;
const cleanup=`document.getElementById('run').onclick=async()=>{try{for(const name of ['mz_scan_queue','mz_scan_completion_drafts'])await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=resolve;r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('owned database still open'));});document.getElementById('result').textContent=JSON.stringify({status:'CLEANED',remaining:await indexedDB.databases()});}catch(error){document.getElementById('result').textContent=JSON.stringify({status:'FAIL',error:String(error)});}};`;
const server=createServer((req,res)=>{
 res.setHeader('cache-control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-src 'none'");
 if(req.url==='/worker.js'){res.setHeader('content-type','application/javascript');res.end(instrumented);return;}
 if(req.url==='/prior.js'){res.setHeader('content-type','application/javascript');res.end(oldProducer);return;}
 if(!['/','/verify','/migration-seed','/verify-migration','/cleanup'].includes(req.url)){res.writeHead(404);res.end();return;}
 const clearing=req.url==='/cleanup';res.setHeader('content-type','text/html; charset=utf-8');
 res.end('<!doctype html><html><head><title>Custodial isolated storage proof</title></head><body><h1>Isolated synthetic custodial storage proof</h1><p>No production or phone data. Source '+sha+'</p><button id="run">'+(clearing?'Remove isolated test databases':req.url==='/verify'?'Verify after page reload':'Run real IndexedDB checks')+'</button><a href="/verify">Reload and verify saved work</a> <a href="/migration-seed">Create exact historical retry row</a> <a href="/verify-migration">Reopen and verify migration</a> <a href="/cleanup">Clean up owned test data</a><pre id="result">NOT RUN</pre>'+(clearing?'':'<script>'+setup+'</script><script src="/worker.js"></script>'+(req.url==='/migration-seed'?'<script src="/prior.js"></script>':''))+'<script>'+(clearing?cleanup:harness)+'</script></body></html>');
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({owned:'isolated storage fixture',pid:process.pid,url:'http://127.0.0.1:'+server.address().port+'/',source_sha256:sha,cleanup:'Use /cleanup, close exact task tab, terminate this exact server; auto-expires after15minutes'})));
const expiry=setTimeout(()=>server.close(),15*60*1000);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{clearTimeout(expiry);server.close(()=>process.exit(0));server.closeAllConnections();});
