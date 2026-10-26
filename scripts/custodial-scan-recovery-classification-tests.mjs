import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {principalIdentity} from '../mobile/src/custodial/protected-principal.js';
import {createSyntheticScheduleLocks} from './synthetic-schedule-locks.mjs';
if(process.argv.includes('--completion-draft-owner-only')) {
 await completionDraftOwnerCases();
} else if(process.argv.includes('--interrupted-start-queue-owner-only')) {
 await interruptedStartQueueOwnerCases();
} else if(process.argv.includes('--archived-retirement-owner-only')) {
 await archivedRetirementOwnerCases();
} else {
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('async function getScanStateSafe('),end=source.indexOf('\n    async function startSessionMaybeQueued(',start);
assert.ok(start>=0&&end>start);const implementation=source.slice(start,end);
async function run(error,local=null){const saved=local&&JSON.stringify(local);const context={window:{MemphisMobile:{nativeOfflineTimeAuthority:false}},offlineStartState:()=>null,rpcOne:async()=>{throw error;},getLatestLocalSessionForLocation:async()=>local,resolveLocationKind:()=>({locationType:'restroom',formType:'restroom'}),savedScanDisplay:()=>({location_name:'Fixture Restrooms',assigned_device_employee_name:'Fixture Custodian'}),parseRetryAfter:()=>15000,safeError:error=>String(error?.message||'Fixture error'),backendRecoveryAttempt:0};vm.createContext(context);vm.runInContext(implementation,context);const result=await context.getScanStateSafe('FIXTURE','KIOSK_08');if(local)assert.equal(JSON.stringify(local),saved,'Classifying a failed read cannot rewrite saved work');return result;}
const results=[];async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
for(const code of ['custodial_native_offline_anchor_refused','custodial_native_offline_occurrence_refused','custodial_storage_unavailable','custodial_manager_recovery_required','custodial_restore_quarantine','custodial_secure_storage_unavailable','custodial_security_state_unavailable']){
 await check(`Protected failure ${code} is not a network reconnect loop`,async()=>{const result=await run({code,httpStatus:0,message:'Protected work is unavailable'});assert.equal(result.suggested_action,'protected_work_recovery_required');assert.equal(result.device_approved,false);assert.notEqual(result.transport_error,true);});
}
await check('An actual network failure still retries as unavailable transport',async()=>assert.equal((await run({httpStatus:0,message:'Failed to fetch'})).suggested_action,'backend_unavailable'));
await check('An actual server outage still retries',async()=>assert.equal((await run({httpStatus:503,message:'Service unavailable'})).suggested_action,'backend_unavailable'));
await check('Unauthorized, unknown-location and throttled responses retain their specific outcomes',async()=>{for(const [httpStatus,action] of [[401,'unauthorized_device'],[403,'unauthorized_device'],[404,'invalid_location'],[429,'throttled'],[422,'scan_rejected']])assert.equal((await run({httpStatus,message:'Server response'})).suggested_action,action);});
await check('Existing active local cleaning remains available for its finish flow',async()=>{const result=await run({code:'custodial_native_offline_anchor_refused'}, {status:'active',session_uuid:'fixture-session',employee_name:'Original Actor',started_at:'2026-09-21T18:00:00Z',location_name:'Fixture Restrooms'});assert.equal(result.suggested_action,'finish_session');assert.equal(result.latest_employee_name,'Original Actor');assert.equal(result.latest_session_uuid,'fixture-session');});
await check('Pending local completion remains pending, never replaced with new work',async()=>{const result=await run({code:'custodial_native_offline_anchor_refused'},{status:'pending_sync',session_uuid:'fixture-session',employee_name:'Original Actor',started_at:'2026-09-21T18:00:00Z',ended_at:'2026-09-21T18:10:00Z'});assert.equal(result.suggested_action,'resume_pending_submit');assert.equal(result.latest_session_uuid,'fixture-session');});
await check('Recovery-required outcome has an explicit manager screen, not automatic retry',()=>assert.match(source,/case"protected_work_recovery_required":renderMessageCard\("title-red","This Phone Needs a Manager"/));
console.log(JSON.stringify({scope:'Actual scan-state read function with synthetic native/transport failures; no real scan or native recovery',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));
process.exitCode=results.some(r=>!r.passed)?1:0;
}

async function completionDraftOwnerCases(){
 const source=readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
 const slice=(a,b)=>{const x=source.indexOf(a),y=source.indexOf(b,x);assert.ok(x>=0&&y>x,a);return source.slice(x,y);};
 const implementation=[
  slice('  const CONFIG =','  const state ='),
  slice('  function custodialSecurity()','  function dispatchSecurityPause('),
  slice('  function safeText(','  async function sha256('),
  slice('  function storageFailure(','  function releaseVersionTuple('),
  slice('  function openCompletionDraftDb(','  async function verifyWorkerBackendCompatibility('),
  slice('  function queueOpeningConnection(','  function queueOpeningRowsMatch('),
  slice('  function canonicalizeSemanticValue(','  function completionClientIdFor('),
  slice('  function queueOpeningCheckpoint(','  function queueOpeningConnection('),
  slice('  function queueOpeningRowsMatch(','  function deleteDatabase('),
 ].join('\n');
 const id=n=>'cf000000-0000-4000-8000-'+String(n).padStart(12,'0'),device='KIOSK_08';
 const input=()=>({contract_version:'scan.v4.snapshot-bound-authority',session_uuid:id(1),client_completion_id:id(2),
  device_id:device,employee_id:id(3),location_code:'FIXTURE',draft:{original:'unchanged',answers:[1,false,'x']}});
 function fixture(){
  let generation=7,open=false,settled=false,principal={schema_version:'custodial-protected-principal.v1',device_id:device,
   employee_id:id(3),credential_id:id(4),credential_operation_id:id(5),assignment_epoch:1,
   installation_seal:'synthetic-completion-draft-owner',enrolled_at:'2026-10-01T12:00:00.000Z'};
  const rows=new Map(),writes=[],transactions=[],bounds=[],hooks={},timers=[];
  const security={native:true,waitForStableState:async()=>{},getStatus:()=>({native:true,state:'enrolled',ready:true,
   available:true,quarantined:false,deviceId:device,generation,principal}),mutateProtectedWork:async(fn,options)=>{
   bounds.push(options);if(hooks.fifo)await hooks.fifo();
   if(options?.expectedGeneration!=null&&options.expectedGeneration!==generation)throw Error('original generation refused');
   const gen=generation,p=JSON.stringify(principal);open=true;
   const context={deviceId:device,generation:gen,assertCurrent(){
    assert.equal(open,true,'closed callback checkpoint');if(gen!==generation||p!==JSON.stringify(principal))throw Error('native owner withdrawn');
   }};if(hooks.noCheckpoint)delete context.assertCurrent;
   try{return await fn(context);}finally{open=false;hooks.settle?.();}
  }};
  const mobile={principalIdentity:()=>principalIdentity(principal)};
  const db={version:1,objectStoreNames:{contains:n=>n==='drafts'},close(){},transaction(_name,mode){
   const tx={mode,error:null,done:false,aborted:false,staged:[],abort(){if(hooks.abortThrows)throw Error('abort unknown');this.aborted=true;}};
   const store={get(key){const req={result:null,error:null};tx.lookup=req;tx.key=key;
    if(mode==='readonly')queueMicrotask(()=>{hooks.read?.(tx);req.result=structuredClone(rows.get(key));
     req.onsuccess?.({target:req});queueMicrotask(()=>{tx.done=true;tx.oncomplete?.({target:tx});});});
    return req;},put(value){writes.push(['put',structuredClone(value)]);tx.staged.push(['put',structuredClone(value)]);hooks.write?.(tx);return{error:null};},
    delete(key){writes.push(['delete',key]);tx.staged.push(['delete',key]);hooks.write?.(tx);return{error:null};}};
   tx.objectStore=()=>store;transactions.push(tx);return tx;
  }};
  const indexedDB={open(){const req={result:db,error:null};queueMicrotask(()=>{hooks.open?.();req.onsuccess?.({target:req});});return req;}};
  const scope={console,Date,JSON,Map,Set,Object,Number,Promise,AggregateError,structuredClone,state:{deviceId:device},
   window:{indexedDB,MemphisCustodialSecurity:security,MemphisMobile:mobile,setTimeout:fn=>{timers.push(fn);return timers.length;}},
   indexedDB,sha256:async text=>(await import('node:crypto')).createHash('sha256').update(text).digest('hex')};
  vm.runInNewContext(implementation+'\nthis.save=saveCompletionDraft;this.remove=deleteCompletionDraft;this.record=completionDraftRecord;',scope);
  const terminal=(tx,kind=tx.aborted?'abort':'complete')=>{
   tx.done=true;if(kind==='complete'&&!tx.aborted)for(const [type,v] of tx.staged){if(type==='put')rows.set(v.session_uuid,structuredClone(v));else rows.delete(v);}
   tx['on'+kind]?.({target:tx});hooks.terminal?.(tx);
  };
  async function finish(promise,inspect){
   let result;promise.then(value=>{result={value};settled=true;},error=>{result={error};settled=true;});
   for(let i=0;i<100&&!settled;i++){
    await new Promise(r=>setImmediate(r));
    for(const tx of transactions.filter(t=>t.mode==='readwrite'&&!t.done)){
     inspect?.(tx);if(tx.lookup&&!tx.looked){tx.looked=true;hooks.lookup?.(tx);tx.lookup.result=structuredClone(rows.get(tx.key));tx.lookup.onsuccess?.({target:tx.lookup});}
     terminal(tx);
    }
    while(timers.length)timers.shift()();
   }
   assert.ok(settled,'fixture must reach a direct transaction terminal');return result;
  }
  return{scope,rows,writes,transactions,bounds,hooks,security,mobile,terminal,timers,finish,
   get open(){return open;},changeGeneration(){generation++;},changePrincipal(){principal={...principal,installation_seal:'successor-draft-installation'};}};
 }
 const results=[],selected=process.argv.find(a=>a.startsWith('--completion-draft-owner-case='))?.split('=').slice(1).join('=');
 async function run(name,body){if(selected&&selected!==name)return;try{await body();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
 await run('fifo-generation',async()=>{
  const f=fixture();f.hooks.fifo=()=>f.changeGeneration();const out=await f.finish(f.scope.save(input()));
  assert.equal(f.writes.length,0,'queued original must not write under successor generation');assert.ok(out.error);
 });
 await run('detached-input',async()=>{
  const f=fixture(),original=input();f.hooks.fifo=()=>{original.draft.original='successor input';original.client_completion_id=id(90);};
  const out=await f.finish(f.scope.save(original));assert.ifError(out.error);assert.equal(out.value.client_completion_id,id(2));
  assert.equal(out.value.draft.original,'unchanged');assert.equal(f.bounds[0].expectedGeneration,7);
 });
 await run('same-original-save-readback',async()=>{
  const f=fixture(),out=await f.finish(f.scope.save(input()));assert.ifError(out.error);assert.equal(f.writes.length,1);
  assert.equal(JSON.stringify(out.value),JSON.stringify(f.rows.get(id(1))));assert.equal(f.open,false);
 });
 await run('owner-and-method-loss',async()=>{
  for(const change of [f=>f.changePrincipal(),f=>f.changeGeneration(),f=>{f.security.getStatus=()=>null;},
   f=>{f.scope.window.MemphisCustodialSecurity={...f.security};},f=>{f.mobile.principalIdentity=()=>'';}]){
   const f=fixture();f.hooks.lookup=()=>change(f);const out=await f.finish(f.scope.save(input()));
   assert.ok(out.error);assert.equal(f.writes.length,0);
  }
 });
 await run('missing-checkpoint',async()=>{
  const f=fixture();f.hooks.noCheckpoint=true;const out=await f.finish(f.scope.save(input()));assert.ok(out.error);assert.equal(f.writes.length,0);
 });
 await run('delete-replacement',async()=>{
  const f=fixture(),record=await f.scope.record(input());f.rows.set(id(1),record);
  f.hooks.lookup=()=>f.rows.set(id(1),{...record,client_completion_id:id(90),draft:{original:'foreign successor'}});
  const out=await f.finish(f.scope.remove(id(1)));assert.ok(out.error);assert.equal(f.writes.length,0);
  assert.equal(f.rows.get(id(1)).client_completion_id,id(90));
 });
 await run('delete-corrupt-and-foreign',async()=>{
  for(const alter of [r=>({...r,integrity_sha256:'0'.repeat(64)}),r=>({...r,device_id:'KIOSK_09'}),
   r=>({...r,draft:new Map([['unknown','retained']])}),r=>({...r,extra:'unknown'})]){
   const f=fixture(),record=alter(await f.scope.record(input()));f.rows.set(id(1),record);
   const out=await f.finish(f.scope.remove(id(1)));assert.ok(out.error);assert.equal(f.writes.length,0);assert.ok(f.rows.has(id(1)));
  }
 });
 await run('same-original-delete-and-absence',async()=>{
  for(const present of [true,false]){
   const f=fixture();if(present)f.rows.set(id(1),await f.scope.record(input()));
   const out=await f.finish(f.scope.remove(id(1)));assert.ifError(out.error);assert.equal(out.value,true);
   assert.equal(f.writes.length,present?1:0);assert.equal(f.rows.size,0);
   for(const options of f.bounds)assert.equal(options.expectedGeneration,7);
  }
 });
 await run('delete-generation',async()=>{
  const f=fixture();f.rows.set(id(1),await f.scope.record(input()));f.hooks.fifo=()=>f.changeGeneration();
  const out=await f.finish(f.scope.remove(id(1)));assert.ok(out.error);assert.equal(f.writes.length,0);assert.equal(f.rows.size,1);
  const g=fixture(),bad=await g.finish(g.scope.remove(id(1),8));assert.ok(bad.error);assert.equal(g.transactions.length,0);
 });
 await run('errors-hold-until-terminal',async()=>{
  const f=fixture();let checked=false;
  const out=await f.finish(f.scope.save(input()),tx=>{
   if(checked)return;checked=true;tx.error=Error('synthetic transaction error');tx.onerror?.({target:tx});
   assert.equal(f.open,true,'request/error cannot release admission before terminal');
  });assert.ok(out.error);assert.equal(checked,true);assert.equal(f.writes.length,0);
 });
 await run('late-terminal-and-settlement-loss',async()=>{
  for(const phase of ['terminal','settlement']){
   const f=fixture();f.hooks[phase==='settlement'?'settle':phase]=()=>f.changeGeneration();const out=await f.finish(f.scope.save(input()));
   assert.ok(out.error,'late owner loss cannot claim saved result');assert.equal(f.rows.size,1,'no rollback or compensation');
  }
 });
 await run('delete-unknown-abort',async()=>{
  const f=fixture();f.rows.set(id(1),await f.scope.record(input()));f.hooks.abortThrows=true;f.hooks.write=()=>f.changeGeneration();
  const out=await f.finish(f.scope.remove(id(1)));assert.ok(out.error);assert.equal(f.writes.length,1);
  assert.equal(f.rows.size,0,'failed abort may commit; no fabricated rollback');
 });
 await run('direct-terminal-ownership',async()=>{
  for(const phase of ['lookup','transaction']){
   const f=fixture(),pending=f.scope.save(input()),outcome=Promise.allSettled([pending]);let finished=false;
   pending.then(()=>{finished=true;},()=>{finished=true;});
   let tx=null;for(let i=0;i<100&&!tx;i++){
    await new Promise(r=>setImmediate(r));while(f.timers.length)f.timers.shift()();
    tx=f.transactions.find(t=>t.mode==='readwrite');
   }
   assert.ok(tx);const error=Error('synthetic '+phase+' request error');tx.error=error;tx.lookup.error=error;
   if(phase==='lookup')tx.lookup.onerror({target:tx.lookup});else tx.onerror({target:tx.lookup});
   tx.oncomplete({target:tx.lookup});tx.onabort({target:tx.lookup});
   await new Promise(r=>setImmediate(r));while(f.timers.length)f.timers.shift()();
   assert.equal(f.open,true);assert.equal(finished,false,'not settled by error or bubbled event');assert.equal(f.writes.length,0);
   f.terminal(tx,'abort');await Promise.resolve();assert.equal(f.open,true,'direct dispatch is not yet settled');
   while(f.timers.length)f.timers.shift()();await new Promise(r=>setImmediate(r));
   assert.equal((await outcome)[0].status,'rejected');assert.equal(f.open,false);
  }
 });
 await run('save-unknown-abort',async()=>{
  const f=fixture();f.hooks.abortThrows=true;f.hooks.write=()=>f.changeGeneration();
  const out=await f.finish(f.scope.save(input()));assert.ok(out.error);assert.equal(f.writes.length,1);
  assert.equal(out.error.code,'custodial_security_state_unavailable');assert.equal(f.rows.size,1);
  assert.equal(f.rows.get(id(1)).draft.original,'unchanged','uncertain staged original remains, never compensated');
 });
 await run('caller-accessors-and-unknown-input',async()=>{
  for(const bad of [Object.defineProperty(input(),'draft',{get(){assert.fail('getter must not run');}}),
   Object.defineProperty(input(),Symbol.toStringTag,{get(){assert.fail('symbol getter must not run');}}),
   {...input(),draft:new Map([['unknown','retained']])}]){
   const f=fixture(),out=await f.finish(f.scope.save(bad));assert.ok(out.error);assert.equal(f.writes.length,0);
  }
 });
 await run('save-conflicting-row-and-readback',async()=>{
  for(const phase of ['probe','lookup','readback']){
   const f=fixture(),record=await f.scope.record(input());
   if(phase==='probe')f.rows.set(id(1),{...record,client_completion_id:id(90)});
   if(phase==='lookup')f.hooks.lookup=()=>f.rows.set(id(1),{...record,draft:{original:'replacement'}});
   if(phase==='readback')f.hooks.terminal=()=>f.rows.set(id(1),{...record,draft:{original:'unverified readback'}});
   const out=await f.finish(f.scope.save(input()));assert.ok(out.error);
   assert.equal(f.writes.length,phase==='readback'?1:0);assert.ok(f.rows.has(id(1)));
  }
 });
 await run('delete-absence-replaced-before-write',async()=>{
  const f=fixture(),record=await f.scope.record(input());let admissions=0;
  f.hooks.fifo=()=>{if(++admissions===2)f.rows.set(id(1),record);};
  const out=await f.finish(f.scope.remove(id(1)));assert.ok(out.error);assert.equal(f.writes.length,0);assert.equal(f.rows.size,1);
 });
 await run('delete-terminal-and-settlement-loss',async()=>{
  for(const phase of ['terminal','settle']){
   const f=fixture();f.rows.set(id(1),await f.scope.record(input()));f.hooks[phase]=()=>f.changeGeneration();
   const out=await f.finish(f.scope.remove(id(1)));assert.ok(out.error);
   assert.equal(f.writes.length,phase==='settle'?0:1);
   assert.equal(f.rows.size,phase==='settle'?1:0);
  }
 });
 await run('legacy-roundtrip',async()=>{
  const f=fixture();delete f.scope.window.MemphisCustodialSecurity;delete f.scope.window.MemphisMobile;
  const saved=await f.finish(f.scope.save(input()));assert.ifError(saved.error);assert.equal(f.bounds.length,0);
  const g=fixture();delete g.scope.window.MemphisCustodialSecurity;delete g.scope.window.MemphisMobile;
  g.rows.set(id(1),saved.value);const removed=await g.finish(g.scope.remove(id(1)));
  assert.ifError(removed.error);assert.equal(removed.value,true);assert.equal(g.rows.size,0);
 });
 if(selected)assert.equal(results.length,1,'unknown selected new case');
 console.log(JSON.stringify({scope:'actual completion draft functions, synthetic native FIFO and deferred IDB only',passed:results.filter(r=>r.pass).length,
  failed:results.filter(r=>!r.pass).length,results,browser:false,native:false},null,2));if(results.some(r=>!r.pass))process.exitCode=1;
}

async function archivedRetirementOwnerCases(){
 const bridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
 const start=bridge.indexOf('  function canonicalSessionId('),end=bridge.indexOf('\n  async function reconcileRecoveredPreStart(',start);
 assert.ok(start>=0&&end>start);
 const recoveryEnd=bridge.indexOf('\n  const bridgeReady =',end);assert.ok(recoveryEnd>end);
 const id=n=>'af000000-0000-4000-8000-'+String(n).padStart(12,'0'),device='KIOSK_08',sessionId=id(1);
 const session={session_uuid:sessionId,client_session_id:sessionId,device_id:device,entry_id:id(2),location_code:'FIXTURE',
  status:'offline-provisional',state:'offline-provisional',server_acknowledged:false,sync_status:'activation_queued',
  entry_attestation:'native-entry-pending.v1',started_at:'',updated_at:'2026-10-14T12:00:00.000Z'};
 const disposition={schema_version:'custodial-scan-journal-disposition.v1',state:'RESOLVED',preserved:true,
  manager_recovery_required:false,device_id:device,recovery_id:id(3),manager_recovery_operation_id:id(4),
  source_sha256:'a'.repeat(64),replacement_journal_sha256:'b'.repeat(64),resolved_at:'2026-10-14T12:01:00.000Z'};
 const principal={schema_version:'custodial-protected-principal.v1',device_id:device,employee_id:id(5),credential_id:id(6),
  assignment_epoch:1,credential_operation_id:id(7),installation_seal:'synthetic-retirement-installation',enrolled_at:'2026-10-01T12:00:00.000Z'};
 const archive={schema_version:'custodial-prestart-recovery.v1',session_uuid:sessionId,device_id:device,
  native_scan_journal_recovery_id:disposition.recovery_id,manager_recovery_operation_id:disposition.manager_recovery_operation_id,
  preserved_session_raw:JSON.stringify(session),preserved_at:session.updated_at,resolved_at:disposition.resolved_at,
  resolution:{method:'preserved_native_journal_manager_recovery',queued_action_count:0,completion_draft_count:0,
   server_suggested_action:'start_session'}};
 const key='session:'+sessionId,indexKey='mz_phone_scan_resume:'+device,archiveKey='mz_custodial_prestart_recovery:'+sessionId;
 const cases=['changed-session-after-queue','changed-index-after-queue','changed-archive-after-queue',
  'changed-generation-after-queue','changed-principal-after-queue','changed-writer-after-queue',
  'changed-generation-at-FIFO','missing-context-checkpoint','same-original-confirmed',
  'post-effect-owner-loss','post-effect-lost-result','reentrant-foreign-index','unarchived-changed-session-after-queue',
  'unarchived-same-original-confirmed','unarchived-owner-loss-after-queue','unarchived-reentrant-foreign-index'];
 const selected=process.argv.find(a=>a.startsWith('--archived-retirement-case='))?.split('=').slice(1).join('=');
 const skip=process.argv.find(a=>a.startsWith('--archived-retirement-skip='))?.split('=').slice(1).join('=');
 if(selected)assert.ok(cases.includes(selected),'unknown selected case');
 for(const name of cases.filter(x=>(!selected||x===selected)&&x!==skip)){
  const rows=new Map([[key,archive.preserved_session_raw],[indexKey,JSON.stringify({schema_version:2,sessions:[{session_uuid:sessionId}]})],[archiveKey,JSON.stringify(archive)]]);
  const unarchived=name.startsWith('unarchived-');if(unarchived)rows.delete(archiveKey);
  const changes=[],writerOptions=[];let generation=7,livePrincipal=principal;
  const status=()=>({native:true,state:'enrolled',ready:true,available:true,quarantined:false,deviceId:device,generation,principal:livePrincipal});
  const security={native:true,getStatus:status,mutateProtectedWork:async(fn,options)=>{
   writerOptions.push(options);
   if(!unarchived||options){assert.equal(options?.requireEnrollment,true);assert.equal(options?.expectedGeneration,7);}
   if(name==='changed-generation-at-FIFO')generation++;
   let open=true;const original=generation;
   const context={deviceId:device,generation:original,assertCurrent(){assert.ok(open);assert.equal(generation,original);}};
   if(name==='missing-context-checkpoint')delete context.assertCurrent;
   let result;
   try{result=await fn(context);}finally{open=false;}
   if(name==='post-effect-owner-loss')generation++;
   if(name==='post-effect-lost-result')throw Error('synthetic result lost after effect');
   return result;
  }};
  const foreignIndex=JSON.stringify({schema_version:2,sessions:[{session_uuid:id(99),original:'foreign index'}]});
  const localStorage={getItem:k=>rows.get(k)??null,setItem:(k,v)=>{changes.push(['set',k]);rows.set(k,v);},removeItem:k=>{
   changes.push(['remove',k]);rows.delete(k);
   if(name.endsWith('reentrant-foreign-index')&&k===key)rows.set(indexKey,foreignIndex);
  }};
  const replacement=JSON.stringify({...session,updated_at:'2026-10-14T12:02:00.000Z',original:'foreign replacement retained'});
  const retire=async(_id,preserve)=>{
   await preserve([],{canonical_actions:'[]'});
   if(name==='changed-session-after-queue'||name==='unarchived-changed-session-after-queue')rows.set(key,replacement);
   if(name==='changed-index-after-queue')rows.set(indexKey,foreignIndex);
   if(name==='changed-archive-after-queue')rows.set(archiveKey,'foreign archive retained');
   if(name==='changed-generation-after-queue')generation++;
   if(name==='unarchived-owner-loss-after-queue')generation++;
   if(name==='changed-principal-after-queue')livePrincipal={...principal,credential_id:id(88)};
   if(name==='changed-writer-after-queue')security.mutateProtectedWork=async()=>{throw Error('must not adopt new writer');};
   return {contract_version:'custodial-interrupted-start-retirement.v1'};
  };
  const scope={console,Date,JSON,Map,Set,security,localStorage,nativeVault:true,principalIdentity,
   PHONE_SCAN_RESUME_PREFIX:'mz_phone_scan_resume:',PRESTART_RECOVERY_PREFIX:'mz_custodial_prestart_recovery:',
   window:{MemphisCustodialSecurity:security,MemphisScanSync:{ready:Promise.resolve(true),retirePreservedInterruptedStart:retire,completionDraftExists:async()=>false},
    MemphisUI:{resolveOpenScanSession:()=>({state:'open',session:JSON.parse(archive.preserved_session_raw)})}},
   getNativeCustodialVaultState:async()=>({scan_journal_disposition:disposition}),reportProtectedRecoveryDiagnostic:async()=>{},
   requestEnvelope:async()=>({data:{location_code:'FIXTURE',device_approved:true,suggested_action:'start_session'}}),
   deviceId:()=>device,securityError:code=>Object.assign(Error(code),{code})};
  vm.runInNewContext(bridge.slice(start,unarchived?recoveryEnd:end)+'\nthis.finish=finishArchivedPreStartRetirement;'+(unarchived?'\nthis.recover=reconcileRecoveredPreStart;':''),scope);
  const result=unarchived?await scope.recover():await scope.finish(device,disposition);
  if(unarchived){
   assert.equal(result.state,name==='unarchived-same-original-confirmed'?'retired_preserved':'manager_required');
   assert.ok(rows.has(archiveKey),'actual archive retained');
   assert.equal(JSON.parse(rows.get(archiveKey)).preserved_session_raw,archive.preserved_session_raw);
   if(name==='unarchived-same-original-confirmed'){
    assert.equal(rows.has(key),false);assert.equal(rows.has(indexKey),false);
    assert.equal(writerOptions.length,2);for(const o of writerOptions){assert.equal(o.requireEnrollment,true);assert.equal(o.expectedGeneration,7);}
   }else if(name==='unarchived-reentrant-foreign-index'){
    assert.equal(rows.has(key),false);assert.equal(rows.get(indexKey),foreignIndex);
    assert.equal(changes.filter(([kind])=>kind==='remove').length,1);
   }else{
    assert.equal(rows.get(key),name==='unarchived-changed-session-after-queue'?replacement:archive.preserved_session_raw);
    assert.ok(rows.has(indexKey));assert.equal(changes.filter(([kind])=>kind==='remove').length,0);
   }
   console.log('ARCHIVED_RETIREMENT_OWNER_NEW '+name+': PASS (actual bridge recovery, synthetic readback/native context; not SQL/Android)');continue;
  }
  const hadEffect=['same-original-confirmed','post-effect-owner-loss','post-effect-lost-result','reentrant-foreign-index'].includes(name);
  assert.equal(result.state,name==='same-original-confirmed'?'retired_preserved':'manager_required');
  if(!hadEffect){
   assert.equal(changes.length,0,'no retirement effects after original changed');
   assert.equal(rows.get(key),name==='changed-session-after-queue'?replacement:archive.preserved_session_raw);
  }else{
   assert.equal(rows.has(key),false);
   if(name==='reentrant-foreign-index'){
    assert.equal(changes.length,1);assert.equal(rows.get(indexKey),foreignIndex,'never remove foreign replacement index');
   }else{
    assert.equal(changes.length,2);assert.equal(rows.has(indexKey),false,'no compensation/retry on unknown settlement');
   }
  }
  if(name==='changed-index-after-queue')assert.equal(rows.get(indexKey),foreignIndex);
  assert.equal(rows.get(archiveKey),name==='changed-archive-after-queue'?'foreign archive retained':JSON.stringify(archive),'archive always retained');
  console.log('ARCHIVED_RETIREMENT_OWNER_NEW '+name+': PASS (actual bridge function, synthetic storage/native context; not Android/SQL)');
 }
}

async function interruptedStartQueueOwnerCases(){
 const source=readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
 const slice=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);};
 const implementation=[
  slice('  const CONFIG =','  const state ='),
  slice('  function custodialSecurity()','  function dispatchSecurityPause('),
  slice('  function safeText(','  async function sha256('),
  slice('  function operationIdFor(','  function replayBindingFor('),
  slice('  function replayBindingFor(','  function sameClaimedQueueRow('),
  slice('  function storageRecord(','  function fencedDowngradeRows('),
  slice('  function queueOpeningCheckpoint(','  function queueOpeningConnection('),
  slice('  function queueOpeningRowsMatch(','  function deleteDatabase('),
  slice('  function readRawRows(','  function createQueueDatabase('),
  slice('  function listActions()','  async function enqueueUnlocked('),
  slice('  async function withQueueLock(','  async function enqueue(action)'),
 ].join('\n');
 const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
 const id=n=>'bf000000-0000-4000-8000-'+String(n).padStart(12,'0'),sessionId=id(1),device='KIOSK_08';
 function fixture(){
  const principal={schema_version:'custodial-protected-principal.v1',device_id:device,employee_id:id(2),credential_id:id(3),
   assignment_epoch:1,credential_operation_id:id(4),installation_seal:'synthetic-queue-retirement-owner',enrolled_at:'2026-10-01T12:00:00.000Z'};
  let generation=7,livePrincipal=principal,open=false,settled=false;
  const rows=new Map(),transactions=[],timers=[],options=[],archives=[],rwReady=deferred(),changes=[];
  let rw=null;
  const hooks={preserve:null,ready:null,beforeMutation:null,settle:null,afterDelete:null,onLock:null,abortThrows:false,missingCheckpoint:false};
  const security={native:true,waitForStableState:async()=>{},getStatus:()=>({native:true,state:'enrolled',ready:true,available:true,
   quarantined:false,deviceId:device,generation,principal:livePrincipal}),mutateProtectedWork:async(fn,bounds)=>{
   options.push(bounds);if(hooks.beforeMutation)await hooks.beforeMutation();
   if(bounds?.expectedGeneration!=null&&bounds.expectedGeneration!==generation)throw Error('synthetic generation refused');
   const captured=generation,p=livePrincipal;open=true;
   const context={deviceId:device,generation,assertCurrent:()=>{
    assert.equal(open,true,'checkpoint cannot outlive native callback');
    if(generation!==captured||livePrincipal!==p)throw Error('synthetic native callback withdrawn');
   }};
   if(hooks.missingCheckpoint)delete context.assertCurrent;
   let value;try{value=await fn(context);context.assertCurrent?.();}finally{open=false;}
   if(hooks.settle)await hooks.settle();return value;
  }};
  function transaction(_name,mode){
   const tx={mode,error:null,aborted:false,done:false,deleted:[],objectStore:()=>store,
    abort(){if(hooks.abortThrows)throw Error('synthetic abort unavailable');this.aborted=true;}};
   const store={getAll:()=>{
    const request={result:null,error:null};tx.lookup=request;
    if(mode==='readonly')queueMicrotask(()=>{request.result=structuredClone([...rows.values()]);request.onsuccess?.({target:request});
     queueMicrotask(()=>{tx.done=true;tx.oncomplete?.({target:tx});});});
    else{rw=tx;rwReady.resolve(tx);}return request;
   },delete:key=>{assert.equal(tx.done,false);changes.push(['delete',key]);tx.deleted.push(key);hooks.afterDelete?.();return{error:null};}};
   transactions.push(tx);return tx;
  }
  const db={transaction,objectStoreNames:{contains:name=>name==='actions'}},state={db,deviceId:device};
  const mobile={principalIdentity:()=>principalIdentity(livePrincipal)};
  const locks=createSyntheticScheduleLocks(),requestLock=locks.request;
  locks.request=function(...args){hooks.onLock?.();return requestLock.apply(this,args);};
  const scope={console,Date,JSON,Map,Set,Object,Number,Promise,AggregateError,structuredClone,state,
   window:{MemphisCustodialSecurity:security,MemphisMobile:mobile,setTimeout:fn=>{timers.push(fn);return timers.length;}},
   navigator:{locks},ensureWorkerReady:async()=>{if(hooks.ready)await hooks.ready();},
   recoverOrphanedClaims:async()=>0,exactSessionForPayload:()=>null};
  vm.runInNewContext(implementation+'\nthis.retire=retirePreservedInterruptedStart;this.normalize=normalizeRecord;this.stored=storageRecord;this.canonical=canonicalRows;',scope);
  rows.set(1,JSON.parse(JSON.stringify(scope.stored({id:1,type:'start_session',client_id:sessionId,operation_id:sessionId,
   logical_identity:sessionId,logical_key:'start_session:'+sessionId,created_at:1234,recoverable:true,state:'pending',schema_version:6,
   forward_replay_contract:'scan.v4.snapshot-bound-authority',forward_action_type:'start_session',
   payload:{p_client_session_id:sessionId,p_device_id:device,original:'never changed'},replay_binding:{client_session_id:sessionId}}))));
  const preserve=async(actions,evidence)=>{archives.push({actions:JSON.stringify(actions),canonical_actions:evidence.canonical_actions});
   if(hooks.preserve){const result=await hooks.preserve(actions,evidence);if(result!==undefined)return result;}
   return{preserved:true,canonical_actions:evidence.canonical_actions};};
  const start=()=>{const promise=scope.retire(sessionId,preserve);promise.then(()=>{settled=true;},()=>{settled=true;});return promise;};
  const terminal=(kind=rw.aborted?'abort':'complete')=>{
   rw.done=true;
   if(kind==='complete'&&!rw.aborted)for(const key of rw.deleted)rows.delete(key);
   rw['on'+kind]?.({target:rw});
  };
  return{rows,archives,changes,options,hooks,scope,security,mobile,state,db,transactions,rwReady,start,
   get rw(){return rw;},get open(){return open;},get settled(){return settled;},
   changeGeneration:()=>{generation++;},changePrincipal:()=>{livePrincipal={...livePrincipal,installation_seal:'synthetic-successor-queue-owner'};},
   lookup(value=structuredClone([...rows.values()])){rw.lookup.result=value;rw.lookup.onsuccess?.({target:rw.lookup});},
   terminal,async flush(){while(timers.length){timers.shift()();await Promise.resolve();}await new Promise(r=>setImmediate(r));}};
 }
 const results=[];const run=async(name,body)=>{try{await body();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.stack});}};
 await run('INTERRUPTED_QUEUE_OWNER_NEW: deferred lookup cannot delete after native generation withdrawal',async()=>{
  const f=fixture(),raw=JSON.stringify([...f.rows]),pending=f.start(),settled=Promise.allSettled([pending]);
  await f.rwReady.promise;f.changeGeneration();f.lookup();const attempted=f.changes.length;
  f.terminal();await f.flush();await settled;
  assert.equal(attempted,0,'withdrawn native callback must run zero delete requests');
  assert.equal(JSON.stringify([...f.rows]),raw);assert.equal(f.archives.length,1);
 });
 await run('INTERRUPTED_QUEUE_OWNER_NEW: same original commits only after direct terminal dispatch and readback',async()=>{
  const f=fixture(),pending=f.start();await f.rwReady.promise;
  assert.deepEqual(JSON.parse(JSON.stringify(f.options)),[{requireEnrollment:true,expectedGeneration:7}]);
  assert.equal(f.rows.get(1).type,'forward-replay-fenced:start_session','actual producer layout');
  assert.equal(f.archives[0].canonical_actions,f.scope.canonical([...f.rows.values()].map(row=>f.scope.normalize(row))));
  f.lookup();assert.equal(f.changes.length,1);assert.equal(f.rows.size,1,'delete is not commit');
  f.terminal('complete');await Promise.resolve();await Promise.resolve();
  assert.equal(f.open,true,'native admission retained outside complete dispatch');assert.equal(f.settled,false);
  await f.flush();const result=await pending;
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{contract_version:'custodial-interrupted-start-retirement.v1',
   session_uuid:sessionId,preserved_action_count:1,retired_action_count:1,already_absent:false});
  assert.equal(Object.isFrozen(result),true);assert.equal(f.rows.size,0);assert.equal(f.open,false);
 });
 await run('INTERRUPTED_QUEUE_OWNER_NEW: worker queue archive and native FIFO waits retain original generation',async()=>{
  for(const phase of ['worker','lock','archive','native']){
   const f=fixture(),entered=deferred(),release=deferred();let holding=null;
   if(phase==='worker')f.hooks.ready=async()=>{entered.resolve();await release.promise;};
   if(phase==='archive')f.hooks.preserve=async()=>{entered.resolve();await release.promise;};
   if(phase==='native')f.hooks.beforeMutation=async()=>{entered.resolve();await release.promise;};
   if(phase==='lock'){
    const held=deferred();holding=f.scope.navigator.locks.request('memphis-scan-queue-v4',{mode:'exclusive'},async()=>{held.resolve();await release.promise;});
    await held.promise;f.hooks.onLock=()=>entered.resolve();
   }
   const pending=f.start();await entered.promise;f.changeGeneration();release.resolve();
   await assert.rejects(pending);if(holding)await holding;
   assert.equal(f.changes.length,0);assert.equal(f.rows.size,1);assert.equal(f.rw,null);
  }
 });
 await run('INTERRUPTED_QUEUE_OWNER_NEW: runtime method full principal and database changes refuse at deferred lookup',async()=>{
  for(const change of [
   f=>f.changePrincipal(),
   f=>{const read=f.security.getStatus;f.security.getStatus=()=>read();},
   f=>{f.security.mutateProtectedWork=async()=>assert.fail('must not adopt successor writer');},
   f=>{f.scope.window.MemphisMobile={...f.mobile};},
   f=>{const read=f.mobile.principalIdentity;f.mobile.principalIdentity=()=>read();},
   f=>{f.scope.window.MemphisCustodialSecurity={...f.security};},
   f=>{f.state.db={...f.db};},
   f=>{const transaction=f.db.transaction;f.db.transaction=(...args)=>transaction(...args);}
  ]){
   const f=fixture(),raw=JSON.stringify([...f.rows]),pending=f.start(),settled=Promise.allSettled([pending]);await f.rwReady.promise;
   change(f);f.lookup();assert.equal(f.changes.length,0);f.terminal();await f.flush();
   assert.equal((await settled)[0].status,'rejected');assert.equal(JSON.stringify([...f.rows]),raw);
  }
 });
 await run('INTERRUPTED_QUEUE_OWNER_NEW: archive body mutation or mismatched preservation cannot retire originals',async()=>{
  for(const mutate of [
   (actions)=>{actions[0].payload.original='changed only in preservation callback';},
   ()=>({preserved:false,canonical_actions:'unknown'}),
   (_actions,evidence)=>({preserved:true,canonical_actions:evidence.canonical_actions+' '}),
   (actions,evidence)=>{assert.equal(Object.isFrozen(actions),true);assert.equal(Object.isFrozen(evidence),true);throw Error('archive unknown');}
  ]){
   const f=fixture(),raw=JSON.stringify([...f.rows]);f.hooks.preserve=mutate;
   await assert.rejects(f.start());assert.equal(f.changes.length,0);assert.equal(f.rw,null);assert.equal(JSON.stringify([...f.rows]),raw);
  }
 });
 await run('INTERRUPTED_QUEUE_OWNER_NEW: changed mixed or unknown raw queue never deletes matched work',async()=>{
  for(const alter of [
   f=>{const row=f.rows.get(1);f.rows.set(1,{...row,payload:{...row.payload,original:'foreign changed body'}});},
   f=>{f.rows.set(2,{...f.rows.get(1),id:2,type:'finish_session',forward_action_type:'finish_session'});},
   f=>{f.rows.set(1,{...f.rows.get(1),schema_version:99});}
  ]){
   const f=fixture(),pending=f.start(),settled=Promise.allSettled([pending]);await f.rwReady.promise;
   alter(f);const raw=JSON.stringify([...f.rows]);f.lookup();assert.equal(f.changes.length,0);f.terminal();await f.flush();
   assert.equal((await settled)[0].status,'rejected');assert.equal(JSON.stringify([...f.rows]),raw);
  }
  const collision=fixture();collision.rows.get(1).payload.originalObject={};
  const pending=collision.start(),settled=Promise.allSettled([pending]);await collision.rwReady.promise;
  collision.rows.get(1).payload.originalObject=new Map([['unrecognised','retained']]);
  collision.lookup();assert.equal(collision.changes.length,0);collision.terminal();await collision.flush();
  assert.equal((await settled)[0].status,'rejected');
  assert.equal(collision.rows.get(1).payload.originalObject.get('unrecognised'),'retained','unknown body is not collapsed into archive JSON');
  const unknown=fixture();unknown.rows.get(1).payload.originalObject=new Map([['original','held']]);
  await assert.rejects(unknown.start());assert.equal(unknown.archives.length,0);assert.equal(unknown.changes.length,0);
  assert.equal(unknown.rows.get(1).payload.originalObject.get('original'),'held');
 });
 await run('INTERRUPTED_QUEUE_OWNER_NEW: lookup and transaction errors do not release ownership before terminal',async()=>{
  for(const phase of ['lookup','transaction']){
   const f=fixture(),raw=JSON.stringify([...f.rows]),pending=f.start(),settled=Promise.allSettled([pending]);await f.rwReady.promise;
   const error=Error('synthetic '+phase+' failure');f.rw.lookup.error=error;
   if(phase==='lookup')f.rw.lookup.onerror({target:f.rw.lookup});else f.rw.onerror({target:f.rw.lookup});
   await Promise.resolve();await Promise.resolve();
   assert.equal(f.open,true);assert.equal(f.settled,false);assert.equal(f.changes.length,0);
   f.rw.onabort({target:f.rw.lookup});f.rw.oncomplete({target:f.rw.lookup});
   await f.flush();assert.equal(f.open,true,'bubbled child events are not terminal');
   f.terminal('abort');await f.flush();assert.equal((await settled)[0].status,'rejected');
   assert.equal(JSON.stringify([...f.rows]),raw);assert.equal(f.open,false);
  }
 });
 await run('INTERRUPTED_QUEUE_OWNER_NEW: withdrawal after staged delete and failed abort never fabricate rollback or success',async()=>{
  for(const abortThrows of [false,true]){
   const f=fixture(),raw=JSON.stringify([...f.rows]),pending=f.start(),settled=Promise.allSettled([pending]);await f.rwReady.promise;
   f.hooks.abortThrows=abortThrows;f.hooks.afterDelete=()=>f.changeGeneration();f.lookup();
   assert.equal(f.changes.length,1);assert.equal(f.open,true);assert.equal(f.settled,false);
   f.terminal(abortThrows?'complete':'abort');await f.flush();
   assert.equal((await settled)[0].status,'rejected');assert.equal(f.archives.length,1);
   if(abortThrows)assert.equal(f.rows.size,0,'actual synthetic commit is uncertainty, not rollback');
   else assert.equal(JSON.stringify([...f.rows]),raw);
  }
 });
 await run('INTERRUPTED_QUEUE_OWNER_NEW: direct completion or result settlement loss cannot return a retirement claim',async()=>{
  for(const phase of ['terminal','settlement']){
   const f=fixture(),pending=f.start(),settled=Promise.allSettled([pending]);await f.rwReady.promise;f.lookup();
   if(phase==='settlement')f.hooks.settle=()=>f.changeGeneration();
   f.terminal('complete');if(phase==='terminal')f.changeGeneration();await f.flush();
   assert.equal((await settled)[0].status,'rejected');assert.equal(f.rows.size,0);assert.equal(f.archives.length,1);
  }
 });
 await run('INTERRUPTED_QUEUE_OWNER_NEW: absent original and unrelated rows keep exact local-only result shape',async()=>{
  for(const absent of [false,true]){
   const f=fixture();if(absent)f.rows.clear();
   const foreign={...f.rows.get(1),id:9,type:'unknown',client_id:id(90),operation_id:id(90),logical_identity:id(90),
    payload:{p_client_session_id:id(90),original:'foreign held'},replay_binding:{client_session_id:id(90)}};
   f.rows.set(9,foreign);const raw=JSON.stringify(foreign),pending=f.start();await f.rwReady.promise;
   f.lookup();f.terminal('complete');await f.flush();const result=await pending;
   assert.equal(result.preserved_action_count,absent?0:1);assert.equal(result.retired_action_count,absent?0:1);
   assert.equal(result.already_absent,absent);assert.equal(JSON.stringify(f.rows.get(9)),raw);
   assert.equal(f.changes.length,absent?0:1);
  }
 });
 await run('INTERRUPTED_QUEUE_OWNER_NEW: missing native callback checkpoint and invalid session refuse without writes',async()=>{
  const f=fixture();f.hooks.missingCheckpoint=true;await assert.rejects(f.start());assert.equal(f.changes.length,0);assert.equal(f.rw,null);
  const g=fixture();await assert.rejects(g.scope.retire({toString:()=>sessionId},async()=>assert.fail('invalid archive')));
  assert.equal(g.options.length,0);assert.equal(g.changes.length,0);
 });
 await run('INTERRUPTED_QUEUE_OWNER_NEW: never-marked legacy queue retains local-only compatibility',async()=>{
  const f=fixture();delete f.scope.window.MemphisCustodialSecurity;delete f.scope.window.MemphisMobile;
  const pending=f.start();await f.rwReady.promise;f.lookup();f.terminal('complete');await f.flush();
  const result=await pending;assert.equal(result.retired_action_count,1);assert.equal(result.already_absent,false);
  assert.equal(f.options.length,0,'no invented native mutator, generation or permission');
  assert.equal(f.rows.size,0);assert.equal(f.archives.length,1);
 });
 console.log(JSON.stringify({scope:'actual interrupted retirement closure/helpers with synthetic Web Locks/native context/deferred IDB events only',passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results,physical:false},null,2));
 if(results.some(r=>!r.pass))process.exitCode=1;
}
