import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Supported CUA drives this loopback fixture. No browser is launched here.
// Real Web Locks/localStorage across two documents; native/queue/security are synthetic.
const worker=readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
function slice(source,a,b){const start=source.indexOf(a),end=source.indexOf(b,start);if(start<0||end<=start)throw Error('fixture seam missing: '+a);return source.slice(start,end);}
const workerCode=[slice(worker,'  function sessionKey(id)','  function exactSessionForPayload('),
 slice(worker,'  async function withQueueLock(','  async function enqueue(action)'),
 slice(worker,'  async function verifiedServerCompletionReceipt(item){','  async function processAction(item)'),
 slice(worker,'  const nativeLegacyCompletionBindings = new WeakMap();','  async function admitNewLocalWork(')].join('\n');
const pageCode=slice(page,'    async function mutateLocalSessions(operation)','    function findAnyOpenLocalSessionForDevice(');
const frame=`
window.testState={writes:0,queue:[],cleared:0,pause:null};
window.MemphisScanSync=(()=>{
 const CONFIG={WEB_LOCK_NAME:'memphis-scan-queue-v4'},state={deviceId:'SYNTHETIC_LOCK_PHONE'};
 const safeText=v=>String(v??'').trim(),canonicalJson=JSON.stringify,isUuid=v=>/^[a-f0-9-]{36}$/.test(v);
 const storageFailure=(_area,e)=>e,processResultFailure=m=>Error(m),ensureWorkerReady=async()=>true;
 const mutateProtectedQueue=async fn=>{const value=await fn();window.testState.writes++;return value;};
 const listActions=async()=>window.testState.queue;
 const enqueueUnlocked=async action=>{window.testState.queue.push(structuredClone(action));window.testState.writes++;};
 const validateProcessResult=(item,result)=>{if(item.payload.p_client_session_id!==result.client_session_id||item.payload.p_client_completion_id!==result.client_completion_id)throw Error('native result mismatch');};
 window.MemphisMobile={getAuthenticatedCompletion:async({completionPayload:p})=>{
  if(window.testState.pause){window.testState.pause.entered();await window.testState.pause.wait;}
  return {found:true,result:{status:'closed',client_session_id:p.p_client_session_id,client_completion_id:p.p_client_completion_id}};
 }};
 ${workerCode}
 return {recoverLocalCompletionIntents,mutateLocalSessions};
})();
window.pageWriters=(()=>{
 const getLocalSessionById=id=>JSON.parse(localStorage.getItem('session:'+id)||'null');
 const sessionStorageKey=id=>'session:'+id,managerRecoveryError=m=>Error(m),currentDeviceId='SYNTHETIC_LOCK_PHONE';
 const mutateCustodialWork=async fn=>fn(),clearCompletionDraft=async()=>{window.testState.cleared++;};
 window.MemphisUI={resolveOpenScanSession:()=>({state:'none'}),indexScanSession:()=>true,clearScanView:()=>{}};
 ${pageCode.replace(/    function getLocalSessionById\(sessionUuid\)\{[^\n]*\}\n/,'')}
 return {saveLocalSession,removeLocalSession};
})();
window.ready=true;`;
const harness=`
const results=[],assert=(v,m)=>{if(!v)throw Error(m);results.push(m);};
const id='7b111111-1111-4111-8111-111111111111',completion='7b222222-2222-4222-8222-222222222222';
const key='session:'+id;
function fixture(){const response={services_performed:['Floor'],note:'ORIGINAL_ACCEPTED'};
const session={session_uuid:id,client_session_id:id,client_completion_id:completion,native_finish_scan_entry_id:'7b333333-3333-4333-8333-333333333333',device_id:'SYNTHETIC_LOCK_PHONE',location_code:'SYNTHETIC_LOCATION',started_at:'2026-09-24T15:00:00.000Z',ended_at:'2026-09-24T15:05:00.000Z',response_json:response,status:'pending_sync'};
session.completion_outbox={type:'commit_workflow',payload:{p_client_session_id:id,p_client_completion_id:completion,p_native_finish_scan_entry_id:session.native_finish_scan_entry_id,p_device_id:session.device_id,p_location_code:session.location_code,p_client_started_at:session.started_at,p_client_ended_at:session.ended_at,p_response_json:structuredClone(response)}};return session;}
function reset(a,b){for(const w of [a,b])Object.assign(w.testState,{writes:0,queue:[],cleared:0,pause:null});localStorage.setItem(key,JSON.stringify(fixture()));}
function pause(w){let entered,release;const reached=new Promise(r=>entered=r),wait=new Promise(r=>release=r);w.testState.pause={entered,wait};return {reached,release};}
document.getElementById('run').onclick=async()=>{
 let activePause=null;
 try{
 const a=document.getElementById('a').contentWindow,b=document.getElementById('b').contentWindow;
 assert(a.ready&&b.ready,'two actual browser documents initialized');assert(!!navigator.locks?.request,'real Web Locks available');
 reset(a,b);await a.MemphisScanSync.recoverLocalCompletionIntents();
 assert(a.testState.queue.length===1,'unchanged native-accepted synthetic operation queued once');
 assert(JSON.parse(localStorage.getItem(key)).status==='saved_pending_sync','actual localStorage completion saved');
 reset(a,b);activePause=pause(a);const recovery=a.MemphisScanSync.recoverLocalCompletionIntents().then(()=>null,e=>e);
 await activePause.reached;
 const edited=fixture();edited.response_json.note='CONCURRENT_DURABLE_EDIT';edited.completion_outbox.payload.p_response_json.note='CONCURRENT_DURABLE_EDIT';
 b.localStorage.setItem(key,JSON.stringify(edited));const editBytes=b.localStorage.getItem(key);
 activePause.release();activePause=null;assert(!!await recovery,'detached durable replacement during native await rejected');
 assert(a.testState.writes===0&&a.testState.queue.length===0,'changed durable record produces zero recovery writes/enqueues');
 assert(localStorage.getItem(key)===editBytes,'exact replacement bytes preserved');
 for(const action of ['save','remove']){
 reset(a,b);activePause=pause(a);const recovering=a.MemphisScanSync.recoverLocalCompletionIntents();await activePause.reached;
 const before=localStorage.getItem(key),requested=fixture();requested.manager_note='SERIALIZED_AFTER_RECOVERY';
 const writing=action==='save'?b.pageWriters.saveLocalSession(requested):b.pageWriters.removeLocalSession(id);
 await Promise.resolve();await Promise.resolve();
 const locks=await navigator.locks.query();
 assert(locks.held.some(x=>x.name==='memphis-scan-queue-v4')&&locks.pending.some(x=>x.name==='memphis-scan-queue-v4'),action+' page writer waits on the actual shared recovery lock');
 assert(localStorage.getItem(key)===before&&b.testState.cleared===0,action+' has no early session/draft effect');
 activePause.release();activePause=null;await recovering;await writing;
 assert(action==='save'?JSON.parse(localStorage.getItem(key)).manager_note==='SERIALIZED_AFTER_RECOVERY':localStorage.getItem(key)===null,action+' completes only after recovery releases lock');
 }
 localStorage.removeItem(key);assert(localStorage.getItem(key)===null,'exact synthetic session key cleaned');
 document.getElementById('result').textContent=JSON.stringify({status:'PASS',checks:results.length,results,source_hashes:${JSON.stringify({worker:hash(worker),page:hash(page)})},limits:'Real Chrome Web Locks and localStorage with two same-origin documents. Extracted actual worker/page writer functions; synthetic native receipt, protected security and queue. NOT device/Android/NFC or production.'},null,2);
 }catch(error){document.getElementById('result').textContent=JSON.stringify({status:'FAIL',error:String(error),results});}
 finally{activePause?.release();localStorage.removeItem(key);}
};`;
const server=createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'none'; frame-src 'self'; object-src 'none'");
 res.setHeader('Content-Type','text/html; charset=utf-8');
 if(req.url==='/frame'){res.end('<!doctype html><title>Owned synthetic lock frame</title><script>'+frame+'</script>');return;}
 if(req.url!=='/'){res.writeHead(404);res.end();return;}
 res.end('<!doctype html><title>Custodial session-lock proof</title><h1>Isolated cross-document saved-work lock</h1><p>No phone or production data.</p><iframe id="a" src="/frame"></iframe><iframe id="b" src="/frame"></iframe><button id="run">Run shared-lock checks</button><pre id="result">NOT RUN</pre><script>'+harness+'</script>');
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({owned:'session-lock browser fixture',pid:process.pid,url:'http://127.0.0.1:'+server.address().port+'/',source_hashes:{worker:hash(worker),page:hash(page)},cleanup:'button-run finally removes exact synthetic key; close task tab and terminate exact server'})));
const expiry=setTimeout(()=>{server.close();server.closeAllConnections();},15*60*1000);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{clearTimeout(expiry);server.close(()=>process.exit(0));server.closeAllConnections();});
