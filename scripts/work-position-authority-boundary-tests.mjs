import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const preservationOnly=process.argv.includes('--position-browser-preservation-only');
const source=readFileSync(new URL(preservationOnly&&process.argv.includes('--position-old-page')
  ? '../../baseline/index.html':'../index.html',import.meta.url),'utf8');
const slice=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);};
if(preservationOnly)await positionBrowserPreservationCases();
else {
const functions=slice('function workPlainPosition(', 'function gpsEvaluatorUnavailable(');
let rpcCalls=0,queueCalls=0;
const sandbox={Date,Number,crypto:{randomUUID:()=> 'test-uuid'},currentDeviceId:'KIOSK_08',workPositionSession:{client_session_id:'session-1',location_code:'NOCX',device_id:'KIOSK_08'},rpcOne:async()=>{rpcCalls++;return {result:'near'};},enqueueAction:async()=>{queueCalls++;},refreshDebugQueueCounts:async()=>{}};
vm.createContext(sandbox);vm.runInContext(functions,sandbox);
const absent=sandbox.workPlainPosition({coords:{latitude:35,longitude:-90,accuracy:5}});
assert.equal(absent.timestamp,null,'missing capture time stays missing');
const zero=sandbox.workPlainPosition({coords:{latitude:35,longitude:-90,accuracy:5},timestamp:0});
assert.equal(zero.timestamp,null,'zero timestamp cannot become arrival time');
const valid=sandbox.workPlainPosition({coords:{latitude:35,longitude:-90,accuracy:5},timestamp:Date.parse('2026-09-25T18:00:00Z')});
assert.equal(valid.timestamp,'2026-09-25T18:00:00.000Z');
const missingResult=await sandbox.evaluateWorkPositionMaybeQueued(absent,'initial','session-1');
assert.equal(missingResult.result,'gps_timestamp_unavailable');
assert.equal(missingResult.authoritative,false);
assert.equal(rpcCalls,0,'no RPC with invented capture time');
assert.equal(queueCalls,0,'no replay queue with invented capture time');
for(const status of ['near','away']){
 const unproven=sandbox.workPositionServerPresentation({result:status,authoritative:true,coordinate_source:'group_center'},null);
 assert.equal(unproven.result,'location_uncalibrated');
 assert.equal(unproven.badgeKind,'warn');
 const exact=sandbox.workPositionServerPresentation({result:status,authoritative:true,authority_scope:'surveyed_location_radius'},null);
 assert.equal(exact.result,status);
 assert.equal(exact.badgeKind,status==='near'?'ok':'alert');
}
assert.equal(sandbox.workPositionServerPresentation(null,{result:'inside_scanned_location',authoritative:true}).badgeKind,'warn','local fallback is never server verification');
await sandbox.evaluateWorkPositionMaybeQueued(valid,'initial','session-1');
assert.equal(rpcCalls,1,'valid capture time reaches RPC');
console.log('work position capture-time and exact authority boundary passed');
}

async function positionBrowserPreservationCases(){
 const {PROTECTED_BROWSER_HOLD_KEY,PROTECTED_BROWSER_LOCK,createProtectedBrowserAdmission}
   =await import('../mobile/src/custodial/protected-browser-admission.js');
 const selected=process.argv.find(arg=>arg.startsWith('--position-case='))?.split('=')[1],completed=[];
 const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
 const plain=value=>JSON.parse(JSON.stringify(value));
 function storage(){
   const values=new Map();return{get length(){return values.size;},key:i=>[...values.keys()][i]??null,
     getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 }
 function fixture(){
   let tail=Promise.resolve(),active=0,entries=0,requests=0;
   const locks={request(name,options,callback){
     requests++;
     const pending=tail.then(async()=>{
       if(options.signal?.aborted)throw Error('SYNTHETIC_LOCK_ABORT');
       assert.equal(name,PROTECTED_BROWSER_LOCK);assert.equal(options.mode,'exclusive');assert.equal(active,0);active++;entries++;
       try{return await callback({name,mode:'exclusive'});}finally{active--;}
     });tail=pending.catch(()=>{});return pending;
   }};
   const localStorage=storage(),sessionStorage=storage(),writes=[],rpc=[],queued=[],badges=[];
   const rawSet=localStorage.setItem,rawRemove=localStorage.removeItem;
   const session={session_uuid:'11111111-1111-4111-8111-111111111111',client_session_id:'11111111-1111-4111-8111-111111111111',
     device_id:'KIOSK_08',employee_name:'Synthetic fixture only',location_code:'NOCX',location_name:'Nocturnal'};
   const key='mz_work_position_evidence:'+session.session_uuid;
   rawSet(key,'{ original UNKNOWN position evidence }');rawSet('retained-history','{ exact unrelated history }');
   const window={localStorage,sessionStorage,navigator:{locks},crypto:webcrypto,addEventListener(){}};
   const location=new URL('https://localhost/index.html?device=KIOSK_08');window.location=location;
   const sandbox={window,location,localStorage,sessionStorage,navigator:window.navigator,document:{addEventListener(){},hidden:false},
     URL,Date,Number,crypto:webcrypto,AbortController,setTimeout,clearTimeout,console,
     currentDeviceId:session.device_id,currentScanState:null,workPositionSession:session,workPositionLastSentAt:Date.now(),
     workPositionLastResult:'gps_unconfigured',workPositionPreviousReading:null,scanNativeSecurityRequired:false,
     rpcOne:async(name,payload)=>{rpc.push({name,payload:plain(payload)});return{result:'near',authoritative:true,authority_scope:'surveyed_location_radius',
       distance_m:2,accuracy_m:5,target_latitude:35,target_longitude:-90,allowed_radius_m:10};},
     enqueueAction:async item=>queued.push(plain(item)),refreshDebugQueueCounts:async()=>{},
     showWorkPositionBadge:(...args)=>badges.push(args)};
   vm.createContext(sandbox);
   vm.runInContext(readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8'),sandbox,{
     filename:'memphis-scan-sync.js',importModuleDynamically:specifier=>import(new URL('../'+specifier,import.meta.url))});
   const pageFunctions=slice('function scanSecurityUnavailable(', 'guardedStart().catch(')
     +slice('async function mutateCustodialWork(', 'function updateDebugPanel(')
     +slice('function workPositionKey(', 'function clearWorkPosition(')
     +slice('function workPlainPosition(', 'function sampleWorkPosition(');
   vm.runInContext(pageFunctions,sandbox,{filename:'index.html:selected-position-and-owning-functions'});
   localStorage.setItem=(k,v)=>{writes.push({key:k,value:String(v),active:active>0});rawSet(k,v);};
   localStorage.removeItem=k=>{writes.push({key:k,remove:true,active:active>0});rawRemove(k);};
   const position={latitude:35,longitude:-90,accuracy_m:5,timestamp:'2026-10-14T18:00:00.000Z'};
   return{sandbox,window,localStorage,sessionStorage,session,key,position,writes,rpc,queued,badges,locks,rawSet,rawRemove,
     active:()=>active,entries:()=>entries,requests:()=>requests,
     originals:()=>Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i))
       .filter(k=>k!=='mz_custodial_protected_browser_mutation.v1').sort().map(k=>[k,localStorage.getItem(k)]))};
 }
 async function run(name,body){if(selected&&selected!==name)return;await body();completed.push(name);console.log(JSON.stringify({case:name,status:'PASS_SOURCE_VM_ONLY'}));}
 await run('preexisting-hold-preserves-original-evidence',async()=>{
   const x=fixture();x.rawSet(PROTECTED_BROWSER_HOLD_KEY,'{ actual preexisting hold DATA }');const before=x.originals();
   await x.sandbox.reportWorkPosition(x.position);
   assert.equal(x.writes.filter(w=>w.key===x.key).length,0,'Position evidence must not bypass the shared preservation hold');
   assert.deepEqual(x.originals(),before);assert.equal(x.rpc.length,0);assert.equal(x.queued.length,0);assert.equal(x.active(),0);
 });
 await run('no-hold-persists-original-once-through-actual-owner',async()=>{
   const x=fixture();await x.sandbox.reportWorkPosition(x.position);
   const writes=x.writes.filter(w=>w.key===x.key);assert.equal(writes.length,1);assert.equal(writes[0].active,true);
   const row=JSON.parse(x.localStorage.getItem(x.key));
   assert.deepEqual(row.position,x.position);assert.equal(row.session_uuid,x.session.session_uuid);
   assert.equal(row.client_session_id,x.session.client_session_id);assert.equal(row.employee_name,x.session.employee_name);
   assert.equal(row.authoritative,false);assert.equal(row.server_evaluated,false);assert.equal(row.authority_scope,null);
   assert.equal(x.localStorage.getItem('retained-history'),'{ exact unrelated history }');
   assert.equal(x.entries(),1);assert.equal(x.active(),0);assert.equal(x.rpc.length,0);assert.equal(x.queued.length,0);
 });
 await run('owner-withdrawal-before-effect-retains-original',async()=>{
   for(const change of ['queue','writer','native','hold']){
     const x=fixture(),entered=deferred(),release=deferred(),queue=x.window.MemphisScanSync;
     const prior=queue.mutateProtectedWork(async()=>{entered.resolve();await release.promise;return true;});
     await entered.promise;const pending=x.sandbox.reportWorkPosition(x.position);
     if(change==='queue')x.window.MemphisScanSync={...queue};
     if(change==='writer')queue.mutateProtectedWork=async()=>true;
     if(change==='native')x.window.MemphisMobileBuildIdentity={edition:'custodial'};
     if(change==='hold')x.rawSet(PROTECTED_BROWSER_HOLD_KEY,'{ withdrawal hold DATA }');
     const before=x.originals();release.resolve();await prior.catch(()=>{});await pending;
     assert.deepEqual(x.originals(),before);assert.equal(x.writes.filter(w=>w.key===x.key).length,0);
     assert.equal(x.active(),0);assert.equal(x.rpc.length,0);assert.equal(x.queued.length,0);
   }
 });
 await run('shared-hold-acquisition-obeys-terminal-owner',async()=>{
   const x=fixture(),entered=deferred(),release=deferred(),queue=x.window.MemphisScanSync;
   const prior=queue.mutateProtectedWork(async()=>{entered.resolve();await release.promise;return true;});
   await entered.promise;const pending=x.sandbox.reportWorkPosition(x.position);
   // The real queue first awaits its already-created admission owner. Verify
   // its request actually reached Web Locks before enqueueing the later hold.
   await Promise.resolve();assert.equal(x.requests(),2);
   const owner=createProtectedBrowserAdmission({storage:x.localStorage,sessionStorage:x.sessionStorage,
     indexedDb:{databases:async()=>[]},locks:x.locks,cryptoApi:webcrypto});
   const held=owner.holdAndObserve({operationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
   await Promise.resolve();assert.equal(x.localStorage.getItem(PROTECTED_BROWSER_HOLD_KEY),null);
   assert.equal(x.writes.filter(w=>w.key===x.key).length,0);release.resolve();await prior;await pending;await held;
   const writes=x.writes.filter(w=>w.key===x.key);assert.equal(writes.length,1);assert.equal(writes[0].active,true);
   const retained=x.localStorage.getItem(x.key);assert.notEqual(x.localStorage.getItem(PROTECTED_BROWSER_HOLD_KEY),null);
   await x.sandbox.reportWorkPosition(x.position);assert.equal(x.localStorage.getItem(x.key),retained);
   assert.equal(x.writes.filter(w=>w.key===x.key).length,1);assert.equal(x.active(),0);
 });
 await run('server-flags-and-capture-time-remain-original',async()=>{
   const x=fixture();await x.sandbox.reportWorkPosition(x.position,'initial');
   assert.equal(x.rpc.length,1);assert.equal(x.rpc[0].name,'tool_evaluate_location_proximity_v2');
   assert.equal(x.rpc[0].payload.p_observed_at,x.position.timestamp);assert.equal(x.rpc[0].payload.p_session_uuid,x.session.session_uuid);
   assert.equal(x.queued.length,0);const row=JSON.parse(x.localStorage.getItem(x.key));
   assert.deepEqual(row.position,x.position);assert.equal(row.authoritative,true);assert.equal(row.server_evaluated,true);
   assert.equal(row.authority_scope,'surveyed_location_radius');assert.equal(row.reason,'initial');assert.equal(x.active(),0);
 });
 await run('mutable-position-cannot-substitute-original-capture',async()=>{
   const x=fixture(),entered=deferred(),release=deferred(),rpc=x.sandbox.rpcOne;
   x.sandbox.rpcOne=async(name,payload)=>{const result=await rpc(name,payload);entered.resolve();await release.promise;return result;};
   const before=x.originals(),pending=x.sandbox.reportWorkPosition(x.position,'initial');
   await entered.promise;assert.equal(x.rpc[0].payload.p_latitude,35);x.position.latitude=36;
   release.resolve();await pending;
   assert.equal(x.writes.filter(w=>w.key===x.key).length,0,'A mutable successor cannot replace the original RPC capture');
   assert.deepEqual(x.originals(),before);assert.equal(x.rpc.length,1);assert.equal(x.queued.length,0);assert.equal(x.active(),0);
 });
 await run('late-original-session-history-is-not-rebound',async()=>{
   const x=fixture(),entered=deferred(),release=deferred(),queue=x.window.MemphisScanSync;
   const prior=queue.mutateProtectedWork(async()=>{entered.resolve();await release.promise;return true;});
   await entered.promise;const pending=x.sandbox.reportWorkPosition(x.position);
   x.sandbox.workPositionSession={...x.session,session_uuid:'22222222-2222-4222-8222-222222222222',
     client_session_id:'22222222-2222-4222-8222-222222222222',employee_name:'Different displayed session'};
   release.resolve();await prior;await pending;
   const row=JSON.parse(x.localStorage.getItem(x.key));assert.equal(row.session_uuid,x.session.session_uuid);
   assert.equal(row.employee_name,x.session.employee_name);assert.deepEqual(row.position,x.position);
   assert.equal(x.localStorage.getItem('mz_work_position_evidence:'+x.sandbox.workPositionSession.session_uuid),null);
   assert.equal(x.writes.filter(w=>w.key===x.key).length,1);assert.equal(x.active(),0);
 });
 await run('position-change-during-admission-never-replaces-original',async()=>{
   const x=fixture(),entered=deferred(),release=deferred(),queue=x.window.MemphisScanSync;
   const prior=queue.mutateProtectedWork(async()=>{entered.resolve();await release.promise;return true;});
   await entered.promise;const pending=x.sandbox.reportWorkPosition(x.position),before=x.originals();
   x.position.timestamp='2026-10-14T18:01:00.000Z';x.position.latitude=36;
   release.resolve();await prior;await pending;
   assert.equal(x.writes.filter(w=>w.key===x.key).length,0);assert.deepEqual(x.originals(),before);
   assert.equal(x.rpc.length,0);assert.equal(x.queued.length,0);assert.equal(x.active(),0);
 });
 assert.ok(completed.length,'Unknown/empty position selector');
 console.log(JSON.stringify({status:'POSITION_BROWSER_PRESERVATION_SOURCE_VM_PASS',groups:completed.length,cases:completed,
   actual_page_queue_admission:true,storage_web_locks_rpc_synthetic:true,browser:false,GPS:false,native:false,SQL:false,ACK:false}));
}
