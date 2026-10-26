import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,webcrypto} from 'node:crypto';
import vm from 'node:vm';

// Exact historical producer + actual migration/read/claim, synthetic IDB adapter.
const source=readFileSync(process.env.SCAN_SYNC_SOURCE || new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
if(process.argv.includes('--dead-letter-original-owner-only')){
 await runDeadLetterOwnerCases();
}else if(process.env.QUEUE_PRESERVATION_CASE){
 await runQueueOpeningCase(process.env.QUEUE_PRESERVATION_CASE);
}else{
const prior=readFileSync(new URL('./fixtures/scan-retry-prior-producer-20260924.js',import.meta.url),'utf8');
const slice=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
const epoch=Date.UTC(2026,8,24,12);let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
function fixture(implementation){
  const records=new Map();let at=epoch;
  const context=vm.createContext({Date,window:{setTimeout},Math:Object.assign(Object.create(Math),{random:()=>0}),
    CONFIG:{STORE_NAME:'actions',SCHEMA_VERSION:6,MAX_RETRIES:50,LEASE_MS:60000,REQUIRED_SCAN_CONTRACT_VERSION:'scan.v4.snapshot-bound-authority'},
    now:()=>at,safeText:x=>String(x??'').trim(),crypto:{randomUUID},exactSessionForPayload:()=>null,
    isUuid:x=>/^[a-f0-9-]{36}$/i.test(x),mutateProtectedQueue:fn=>fn({generation:4}),
    isTerminalReconciliation:()=>false,applyProcessResult:()=>{throw Error('No accepted-result simulation');},
    migrateLegacyRecord:()=>{throw Error('This fixture does not claim old-schema migration proof');},
    state:{workerId:'worker',db:{version:4,transaction(){const tx={};let request;
      const one=result=>{request={result};queueMicrotask(()=>{request.onsuccess();tx.oncomplete?.({target:tx});});return request;};
      tx.objectStore=()=>({get:id=>one(structuredClone(records.get(id))),getAll:()=>one([...records.values()].map(r=>structuredClone(r))),
        put:r=>records.set(r.id,structuredClone(r)),delete:()=>{throw Error('Migration must not delete');},
        openCursor:()=>{const ids=[...records.keys()];request={};let index=0;
          const next=()=>queueMicrotask(()=>{const id=ids[index++];
            request.result=id===undefined?null:{value:structuredClone(records.get(id)),update:r=>records.set(id,structuredClone(r)),continue:next};
            request.onsuccess();if(id===undefined)tx.oncomplete({target:tx});});next();return request;}});return tx;}}}});
  vm.runInContext(implementation,context);
  return {context,records,setTime:value=>{at=value;}};
}
const old=fixture(prior);
const row={id:7,type:'commit_workflow',operation_id:'11111111-1111-4111-8111-111111111111',
  client_id:'22222222-2222-4222-8222-222222222222',semantic_fingerprint:'a'.repeat(64),
  payload:{p_client_session_id:'33333333-3333-4333-8333-333333333333',p_response_json:{work_result:'details',services_performed:['Restock']},p_device_id:'SYNTHETIC'},
  retry_count:49,created_at:epoch-10000,state:'processing',lease_owner:'worker',lease_token:'lease',lease_until:epoch+60000,security_generation:4};
old.records.set(7,structuredClone(old.context.storageRecord(row)));
const priorDelay=old.context.parseRetryAfter('9'.repeat(400));check(priorDelay,Infinity,'exact prior parser produces Infinity');
await old.context.finishClaim(row,{succeeded:false,automaticRetry:true,retryAfterMs:priorDelay,error:'HTTP 503'});
const produced=structuredClone(old.records.get(7));
check(produced.next_attempt_at,Infinity,'actual prior settlement persists Infinity');
check(produced.dead_letter,true,'physical compatibility fence');check(produced.current_dead_letter,false,'logical prior row remains retryable');
const owning=slice('  function custodialSecurity(','  function securityErrorIsPause(')+
  slice('  function queueOpeningCheckpoint(','  function deleteDatabase(')+
  slice('  function operationIdFor(','  function downgradeTransition(')+
  slice('  function legacyMigrationFailure(','  function migrateLegacyRecord(')+
  slice('  async function postOpenContentMigration(','  async function openDb(')+
  slice('  function listActions(','  function claimNextAction(')+
  slice('  function claimNextAction(','  function releaseClaimWithoutAttempt(');
for(const invalid of [Infinity,-Infinity,NaN,-1,Number.MAX_SAFE_INTEGER,8640000000000001,0.5]){
  const f=fixture(owning),input={...produced,next_attempt_at:invalid};f.records.set(7,input);
  await f.context.postOpenContentMigration(f.context.state.db);
  const repaired=structuredClone(f.records.get(7));
  check(repaired.next_attempt_at,epoch,'invalid deadline repaired to captured migration clock');
  for(const field of ['operation_id','logical_identity','semantic_fingerprint','payload','retry_count','current_dead_letter','dead_letter','forward_replay_contract','forward_action_type','lease_owner','lease_token','lease_until','security_generation'])
    check(repaired[field],input[field],'repair preserves '+field);
  f.setTime(epoch+100);await f.context.postOpenContentMigration(f.context.state.db);
  check(f.records.get(7),repaired,'second open does not shift repair deadline or change bytes');
  const listed=await f.context.listActions();check(listed.length,1,'actual read retains row');
  check(f.context.actionCanRun(listed[0],epoch),true,'repaired row is eligible at finite clock');
  const claimed=await f.context.claimNextAction();check(claimed?.operation_id,row.operation_id,'actual claim reaches same repaired operation');
  check(await f.context.claimNextAction(),null,'actual lease excludes duplicate claim');
}
for(const changed of [{current_dead_letter:true,state:'dead-letter'},
  {current_dead_letter:true,state:'quarantined'}, {recoverable:false,state:'legacy-quarantine'},
  {state:'quarantined'},{schema_version:99}]){
  const f=fixture(owning);f.records.set(7,{...produced,...changed});
  await f.context.postOpenContentMigration(f.context.state.db);
  const raw=f.records.get(7),normalized=f.context.normalizeRecord(raw);
  check(raw.next_attempt_at,changed.schema_version===99?Number.MAX_SAFE_INTEGER:Infinity,'hold/future deadline not revived');
  check(f.context.actionCanRun(normalized,epoch),false,'held/unknown evidence not eligible');
  check(raw.payload,produced.payload,'held payload preserved');check(raw.operation_id,produced.operation_id,'held identity preserved');
}
{
  const f=fixture(owning);f.records.set(7,{...produced,lease_owner:'other',lease_token:'live',lease_until:epoch+10000});
  await f.context.postOpenContentMigration(f.context.state.db);check(await f.context.claimNextAction(),null,'repair never breaks live lease');
}
for(const deadline of [0,epoch+120000,8640000000000000]){
  const f=fixture(owning);f.records.set(7,{...produced,next_attempt_at:deadline});
  await f.context.postOpenContentMigration(f.context.state.db);check(f.records.get(7).next_attempt_at,deadline,'valid not-before unchanged');
}
console.log(JSON.stringify({status:'PASS_SCAN_RETRY_MIGRATION',checks,priorProducer:'015c78238488eade762a4a22f09275179ae7cb71be5de82b80d8a0ed0a3faf23',
  limits:'Actual historical producer and current migration/read/claim; synthetic IDB, not actual browser/phone acceptance.'},null,2));
}

async function runDeadLetterOwnerCases(){
 const slice=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start,a);return source.slice(start,end);};
 const implementation=[
  slice('  const CONFIG =','  const state ='),
  slice('  function custodialSecurity()','  function dispatchSecurityPause('),
  slice('  function safeText(','  async function sha256('),
  slice('  function storageFailure(','  function releaseVersionTuple('),
  slice('  function operationIdFor(','  function originalCompletionSession('),
  slice('  function storageRecord(','  function downgradeTransition('),
  slice('  function queueOpeningCheckpoint(','  function queueOpeningConnection('),
  slice('  function queueOpeningRowsMatch(','  function deleteDatabase('),
  slice('  function listActions(','  function actionReferencesSession('),
  slice('  async function recoverDeadLetter(','  function installWorkerListeners(')
 ].join('\n');
 const uuid=n=>'de000000-0000-4000-8000-'+String(n).padStart(12,'0'),device='KIOSK_08';
 function fixture(){
  let generation=7,principal={schema_version:'custodial-protected-principal.v1',device_id:device,employee_id:uuid(2),
   credential_id:uuid(3),credential_operation_id:uuid(4),assignment_epoch:1,installation_seal:'synthetic-dead-letter-owner',
   enrolled_at:'2026-10-01T12:00:00.000Z'},open=false,scheduled=0;
  const rows=new Map(),writes=[],options=[],transactions=[],timers=[],hooks={};
  const security={native:true,getStatus:()=>({native:true,state:'enrolled',ready:true,available:true,quarantined:false,
   generation,deviceId:device,principal}),waitForStableState:async()=>{await hooks.stable?.();},
   mutateProtectedWork:async(fn,bounds)=>{
    options.push(bounds);await hooks.fifo?.();
    if(bounds?.expectedGeneration!=null&&bounds.expectedGeneration!==generation)throw Error('synthetic original generation refused');
    const gen=generation,p=JSON.stringify(principal);open=true;
    const context={deviceId:device,generation:gen,assertCurrent(){assert.equal(open,true,'closed context cannot be used');
     if(gen!==generation||p!==JSON.stringify(principal))throw Error('synthetic native original withdrawn');}};
    if(hooks.missingCheckpoint)delete context.assertCurrent;
    try{return await fn(context);}finally{open=false;hooks.settle?.();}
   }};
  const mobile={principalIdentity:()=>JSON.stringify(principal)};
  const transaction=(_name,mode)=>{
   const tx={mode,error:null,done:false,aborted:false,staged:[],requests:[],
    abort(){if(hooks.abortThrows)throw Error('abort outcome unknown');this.aborted=true;}};
   const request=(kind,key)=>{
    const req={result:null,error:null};tx.requests.push({req,kind,key,read:false});
    if(mode==='readonly')queueMicrotask(()=>{
     hooks.read?.(tx);req.result=structuredClone(kind==='getAll'?[...rows.values()]:rows.get(key));
     req.onsuccess?.({target:req});queueMicrotask(()=>{tx.done=true;tx.oncomplete?.({target:tx});hooks.readTerminal?.(tx);});
    });
    return req;
   };
   tx.objectStore=()=>({get:key=>request('get',key),getAll:()=>request('getAll'),
    put:value=>{const copy=structuredClone(value);writes.push(copy);tx.staged.push(copy);hooks.put?.(tx);return{error:null};}});
   transactions.push(tx);return tx;
  };
  const db={transaction,objectStoreNames:{contains:name=>name==='actions'}},state={db,deviceId:device};
  const scope={window:{MemphisCustodialSecurity:security,MemphisMobile:mobile,setTimeout:fn=>{timers.push(fn);return timers.length;}},
   state,Date,JSON,Number,Math,Object,Reflect,Map,Set,Promise,AggregateError,structuredClone,console,
   ensureWorkerReady:async()=>{await hooks.ready?.();},scheduleSync:()=>{scheduled++;hooks.schedule?.();},
   exactSessionForPayload:()=>null};
  vm.runInNewContext(implementation+'\nthis.recover=recoverDeadLetter;this.all=recoverAllDeadLetters;this.stored=storageRecord;',scope);
  function original(id=1){
   return structuredClone(scope.stored({id,schema_version:6,type:'complete_session',operation_id:uuid(10+id),client_id:uuid(10+id),
    logical_identity:uuid(10+id),logical_key:'complete_session:'+uuid(10+id),created_at:1780000000000,retry_count:9,
    last_error:'Original failure',last_attempt_at:1779999999999,next_attempt_at:1780000050000,
    recoverable:true,dead_letter:true,state:'dead-letter',lease_owner:null,lease_token:null,lease_until:0,security_generation:5,
    replay_binding:{client_session_id:uuid(20+id),client_completion_id:uuid(10+id),employee_id:uuid(2),assignment_epoch:1},
    payload:{p_device_id:device,p_session_uuid:uuid(20+id),p_client_completion_id:uuid(10+id),note:'original body'},
    original_receipt:{state:'unknown original receipt retained'},history:[{original:'prior attempt'}]}));
  }
  rows.set(1,original());
  const terminal=(tx,kind=tx.aborted?'abort':'complete')=>{
   tx.done=true;if(kind==='complete'&&!tx.aborted)for(const row of tx.staged)rows.set(row.id,structuredClone(row));
   hooks.beforeTerminal?.(tx);tx['on'+kind]?.({target:tx});hooks.terminal?.(tx);
  };
  const lookup=tx=>{
   for(const entry of tx.requests.filter(entry=>!entry.read)){
    entry.read=true;hooks.lookup?.(tx,entry);entry.req.result=structuredClone(entry.kind==='getAll'?[...rows.values()]:rows.get(entry.key));
    entry.req.onsuccess?.({target:entry.req});
   }
  };
  async function finish(promise,inspect){
   let done=false,out;promise.then(value=>{done=true;out={value};},error=>{done=true;out={error};});
   for(let i=0;i<200&&!done;i++){
    await new Promise(setImmediate);
    while(timers.length)timers.shift()();
    for(const tx of transactions.filter(t=>t.mode==='readwrite'&&!t.done)){
     inspect?.(tx);lookup(tx);terminal(tx);
    }
   }
   assert.equal(done,true,'new fixture operation must reach an actual direct terminal');
   return out;
  }
  return{scope,state,db,rows,writes,options,transactions,hooks,timers,finish,terminal,lookup,original,security,mobile,
   get open(){return open;},get scheduled(){return scheduled;},
   changeGeneration(){generation++;},changePrincipal(){principal={...principal,installation_seal:'synthetic-successor-installation'};}};
 }
 const selected=process.argv.find(arg=>arg.startsWith('--dead-letter-original-owner-case='))?.slice('--dead-letter-original-owner-case='.length);
 const results=[];
 async function test(name,work){if(selected&&selected!==name)return;try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});}}
 await test('deferred-get-owner-withdrawal',async()=>{
  const f=fixture(),before=JSON.stringify([...f.rows]);f.hooks.lookup=()=>f.changeGeneration();
  const out=await f.finish(f.scope.recover(1));
  assert.equal(f.writes.length,0,'withdrawn deferred recovery must issue zero put requests');assert.ok(out.error);
  assert.equal(JSON.stringify([...f.rows]),before);assert.equal(f.scheduled,0);
 });
 await test('healthy-original-preserves-payload-history-and-physical-fence',async()=>{
  for(const forward of [true,false]){
   const f=fixture();if(!forward){const row=f.rows.get(1);row.type='complete_session';delete row.forward_replay_contract;delete row.forward_action_type;delete row.current_dead_letter;}
   const raw=structuredClone(f.rows.get(1)),out=await f.finish(f.scope.recover(1));
   assert.ifError(out.error);assert.equal(out.value,true);assert.equal(f.writes.length,1);assert.equal(f.scheduled,1);
   const expected={...raw,forward_replay_contract:'scan.v4.snapshot-bound-authority',forward_action_type:'complete_session',
    type:'forward-replay-fenced:complete_session',dead_letter:true,current_dead_letter:false,
    state:'reconciliation-required',next_attempt_at:0,lease_owner:null,lease_token:null,lease_until:0};
   assert.equal(JSON.stringify(f.rows.get(1)),JSON.stringify(expected));
   assert.equal(f.options.length,1,'one original callback owns probe, put, readback and direct terminals');
   for(const options of f.options)assert.equal(options.expectedGeneration,7);
   assert.equal(f.open,false);
  }
 });
 await test('ready-and-native-fifo-withdrawal-before-any-write',async()=>{
  for(const phase of ['ready','first-admission','after-probe']){
   const f=fixture();let admission=0;
   if(phase==='ready')f.hooks.ready=()=>f.changeGeneration();
   else if(phase==='after-probe')f.hooks.readTerminal=()=>f.changeGeneration();
   else f.hooks.fifo=()=>{if(++admission===1)f.changeGeneration();};
   const out=await f.finish(f.scope.recover(1));assert.ok(out.error);assert.equal(f.writes.length,0);assert.equal(f.scheduled,0);
  }
 });
 await test('original-full-principal-runtime-and-methods',async()=>{
  for(const change of [f=>f.changePrincipal(),f=>{f.security.getStatus=()=>null;},
   f=>{f.security.mutateProtectedWork=async()=>assert.fail('no successor writer');},
   f=>{f.security.waitForStableState=async()=>{};},f=>{f.scope.window.MemphisCustodialSecurity={...f.security};},
   f=>{f.mobile.principalIdentity=()=>'';},f=>{f.scope.window.MemphisMobile={...f.mobile};},
   f=>{f.state.db={...f.db};},f=>{f.db.transaction=()=>assert.fail('no successor db method');},f=>{f.state.deviceId='KIOSK_09';}]){
   const f=fixture(),raw=JSON.stringify([...f.rows]);f.hooks.lookup=()=>change(f);
   const out=await f.finish(f.scope.recover(1));assert.ok(out.error);assert.equal(f.writes.length,0);assert.equal(f.scheduled,0);
   assert.equal(JSON.stringify([...f.rows]),raw);
  }
 });
 await test('replacement-or-absent-original-row-never-reset',async()=>{
  for(const change of [f=>{const old=f.rows.get(1);f.rows.set(1,{...old,payload:{...old.payload,note:'successor original'}});},
   f=>f.rows.delete(1),f=>{f.rows.get(1).operation_id=uuid(99);}]){
   const f=fixture();f.hooks.lookup=()=>change(f);const out=await f.finish(f.scope.recover(1));
   assert.ok(out.error);assert.equal(f.writes.length,0);assert.equal(f.scheduled,0);
  }
 });
 await test('foreign-malformed-leased-unknown-original-held',async()=>{
  for(const change of [
   row=>{row.payload.p_device_id='KIOSK_09';},row=>{row.replay_binding.employee_id=uuid(99);},
   row=>{row.replay_binding.assignment_epoch=2;},row=>{delete row.replay_binding.employee_id;},
   row=>{row.schema_version=99;},row=>{row.forward_action_type='unknown_future_work';},
   row=>{row.payload=new Map([['private','held']]);},row=>{row.state='quarantined';},
   row=>{row.lease_owner='live-other-owner';row.lease_token='original lease';row.lease_until=1780000001000;},
   row=>{row.operation_id='not-uuid';},row=>{row.recoverable='true';}
  ]){
   const f=fixture();change(f.rows.get(1));const out=await f.finish(f.scope.recover(1));assert.ok(out.error);
   assert.equal(f.writes.length,0);assert.equal(f.scheduled,0);assert.ok(f.rows.has(1));
  }
 });
 await test('absent-unrecoverable-and-not-dead-are-not-accepted',async()=>{
  for(const change of [f=>f.rows.clear(),f=>{f.rows.get(1).recoverable=false;},f=>{f.rows.get(1).current_dead_letter=false;}]){
   const f=fixture();change(f);const raw=JSON.stringify([...f.rows]),out=await f.finish(f.scope.recover(1));
   assert.ifError(out.error);assert.equal(out.value,false);assert.equal(f.writes.length,0);assert.equal(f.scheduled,0);
   assert.equal(JSON.stringify([...f.rows]),raw);
  }
 });
 await test('missing-checkpoint-invalid-id-and-getter-options',async()=>{
  const f=fixture();f.hooks.missingCheckpoint=true;const out=await f.finish(f.scope.recover(1));assert.ok(out.error);
  assert.equal(f.transactions.length,0);
  for(const id of [{valueOf(){assert.fail('no id coercion');}},'1',0,-1,NaN,1.5]){
   const g=fixture(),out=await g.finish(g.scope.recover(id));assert.ok(out.error);assert.equal(g.options.length,0);
  }
  const g=fixture(),outcome=await g.finish(g.scope.recover(1,Object.defineProperty({},'syncAfter',{get(){assert.fail('option getter never called');}})));
  assert.ok(outcome.error);assert.equal(g.options.length,0);assert.equal(g.writes.length,0);
 });
 await test('sync-option-detached-before-await',async()=>{
  const f=fixture(),options={syncAfter:false};f.hooks.ready=()=>{options.syncAfter=true;};
  const out=await f.finish(f.scope.recover(1,options));assert.ifError(out.error);assert.equal(out.value,true);assert.equal(f.scheduled,0);
 });
 await test('request-and-error-keep-owner-until-direct-terminal-next-task',async()=>{
  for(const phase of ['request','transaction']){
   const f=fixture(),pending=f.scope.recover(1),settlement=Promise.allSettled([pending]);let done=false,tx;
   pending.then(()=>{done=true;},()=>{done=true;});
   for(let i=0;i<200&&!tx;i++){await new Promise(setImmediate);while(f.timers.length)f.timers.shift()();tx=f.transactions.find(t=>t.mode==='readwrite');}
   assert.ok(tx);const req=tx.requests[0].req,error=Error('synthetic recovery '+phase+' error');req.error=tx.error=error;
   if(phase==='request')req.onerror({target:req});else tx.onerror({target:req});
   tx.onabort({target:req});tx.oncomplete({target:req});await new Promise(setImmediate);
   assert.equal(done,false);assert.equal(f.open,true);assert.equal(f.writes.length,0);
   f.terminal(tx,'abort');await Promise.resolve();assert.equal(f.open,true);
   while(f.timers.length)f.timers.shift()();await new Promise(setImmediate);
   assert.equal((await settlement)[0].status,'rejected');assert.equal(f.open,false);assert.equal(f.scheduled,0);
  }
 });
 await test('terminal-settlement-and-readback-withdrawal-no-success-or-schedule',async()=>{
  for(const phase of ['terminal','settlement','readback']){
   const f=fixture();let reads=0;
   if(phase==='terminal')f.hooks.terminal=()=>f.changeGeneration();
   if(phase==='settlement')f.hooks.settle=()=>f.changeGeneration();
   if(phase==='readback')f.hooks.read=()=>{if(++reads===2)f.rows.get(1).payload.note='changed after original effect';};
   const out=await f.finish(f.scope.recover(1));assert.ok(out.error);assert.equal(f.writes.length,1);
   assert.equal(f.scheduled,0);assert.equal(f.rows.get(1).state,'reconciliation-required','no compensation or fabricated rollback');
  }
 });
 await test('failed-abort-after-put-retains-unknown-original-effect',async()=>{
  const f=fixture();f.hooks.abortThrows=true;f.hooks.put=()=>f.changeGeneration();
  const out=await f.finish(f.scope.recover(1));assert.ok(out.error);assert.equal(f.writes.length,1);
  assert.equal(f.rows.get(1).state,'reconciliation-required');assert.equal(f.scheduled,0);
  assert.equal(out.error.code,'custodial_security_state_unavailable');
 });
 await test('batch-actual-recoveries-only-and-no-foreign-revival',async()=>{
  const f=fixture();f.rows.set(2,f.original(2));f.rows.set(3,{...f.original(3),current_dead_letter:false});
  f.rows.set(4,{...f.original(4),recoverable:false});const keep3=JSON.stringify(f.rows.get(3)),keep4=JSON.stringify(f.rows.get(4));
  const out=await f.finish(f.scope.all());assert.ifError(out.error);assert.equal(out.value,2);assert.equal(f.writes.length,2);
  assert.equal(f.scheduled,1);assert.equal(JSON.stringify(f.rows.get(3)),keep3);assert.equal(JSON.stringify(f.rows.get(4)),keep4);
  assert.equal(f.options.length,1,'batch listing and every recovery retain the same original admission');
  for(const options of f.options)assert.equal(options.expectedGeneration,7);
  const g=fixture();g.rows.clear();const empty=await g.finish(g.scope.all());assert.ifError(empty.error);assert.equal(empty.value,0);assert.equal(g.scheduled,0);
 });
 await test('batch-list-wait-stable-and-between-original-recoveries-retain-owner',async()=>{
  for(const phase of ['stable','list-terminal','second-recovery']){
   const f=fixture();f.rows.set(2,f.original(2));let admissions=0;
   if(phase==='stable')f.hooks.stable=()=>f.changeGeneration();
   if(phase==='list-terminal')f.hooks.readTerminal=()=>f.changeGeneration();
   if(phase==='second-recovery')f.hooks.terminal=()=>f.changeGeneration();
   const out=await f.finish(f.scope.all());assert.ok(out.error);assert.equal(f.scheduled,0);
   assert.equal(f.writes.length,phase==='second-recovery'?1:0);
   assert.equal(f.rows.get(2).state,'dead-letter');
  }
 });
 await test('batch-same-generation-successor-raw-row-refused',async()=>{
  const f=fixture();f.rows.set(2,f.original(2));let writes=0;
  f.hooks.lookup=()=>{if(++writes===2)f.rows.set(2,{...f.original(2),payload:{...f.original(2).payload,note:'successor at same key'}});};
  const out=await f.finish(f.scope.all());assert.ok(out.error);assert.equal(f.writes.length,1);assert.equal(f.scheduled,0);
  assert.equal(f.rows.get(2).payload.note,'successor at same key');assert.equal(f.rows.get(2).state,'dead-letter');
 });
 await test('same-bytes-after-observed-owner-change-cannot-refund-generation',async()=>{
  const f=fixture(),raw=structuredClone(f.rows.get(1));f.hooks.lookup=()=>{
   f.rows.set(1,{...raw,payload:{...raw.payload,note:'other bytes'}});f.changeGeneration();f.rows.set(1,raw);
  };
  const out=await f.finish(f.scope.recover(1));assert.ok(out.error);assert.equal(f.writes.length,0);assert.equal(f.scheduled,0);
 });
 await test('native-ready-initial-queue-and-never-marked-legacy-compatibility',async()=>{
  const f=fixture();f.state.db=null;f.state.deviceId='';f.hooks.ready=()=>{f.state.db=f.db;f.state.deviceId='KIOSK_08';};
  const out=await f.finish(f.scope.recover(1));assert.ifError(out.error);assert.equal(out.value,true);
  const g=fixture();delete g.scope.window.MemphisCustodialSecurity;delete g.scope.window.MemphisMobile;
  const legacy=await g.finish(g.scope.recover(1));assert.ifError(legacy.error);assert.equal(legacy.value,true);assert.equal(g.options.length,0);
 });
 await test('observed-terminal-method-loss-cannot-be-refunded-by-later-listener',async()=>{
  const f=fixture(),reader=f.security.getStatus;
  f.hooks.beforeTerminal=()=>{f.security.getStatus=()=>null;};
  f.hooks.terminal=()=>{f.security.getStatus=reader;};
  const out=await f.finish(f.scope.recover(1));assert.ok(out.error);assert.equal(f.writes.length,1);
  assert.equal(f.scheduled,0);assert.equal(f.rows.get(1).state,'reconciliation-required','already committed original is retained, not rolled back');
 });
 console.log(JSON.stringify({scope:'Actual dead-letter functions/helpers; synthetic original native FIFO/Storage-like IDB events only',
  passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,actual_browser:false,native_authentication:false},null,2));
 if(selected)assert.equal(results.length,1,'unknown selected new case');
 if(results.some(r=>!r.passed))process.exitCode=1;
}

async function runQueueOpeningCase(name){
 const terminalCases=['migration-terminal-complete-dispatch','migration-terminal-abort-dispatch','migration-cursor-withdrawal-before-update','migration-complete-withdrawal-during-dispatch'];
 const terminalCase=terminalCases.includes(name);
 const draftCases=['draft-expected-before-fifo','draft-load-generation-before-fifo','draft-exists-generation-before-fifo','draft-load-runtime-before-fifo','draft-exists-terminal-dispatch','draft-error-terminal-dispatch','draft-load-integrity-withdrawal','draft-readback-integrity-withdrawal','draft-owned-positive-absence','draft-get-withdrawal','draft-missing-open-terminal-dispatch','draft-invalid-record-not-absence'];
 const draftCase=draftCases.includes(name);
 const names=['hold-before-entry','hold-after-backup','binding-after-backup','missing-backup-read',
  'malformed-backup','changed-primary','checkpoint-lifetime','admitted-downgrade','retained-backup-resume',
  'hold-before-content-update','corrupted-backup','missing-checkpoint','blocked-delete-ownership','admitted-legacy-upgrade','migration-error-ownership','changed-undefined-original','retained-undefined-original'];
 assert.ok(names.includes(name)||terminalCase||draftCase,'Unknown owning case');
 const {getCustodialBridgeSecurityRuntime}=await import(name==='missing-checkpoint'?new URL('../../baseline/mobile/src/custodial/security-runtime.js',import.meta.url):new URL('../mobile/src/custodial/security-runtime.js',import.meta.url));
 const {createRawStorageAdapter}=await import('../mobile/src/custodial/storage-firewall.js');
 const {CUSTODIAL_DEVICE_KEYS,CUSTODIAL_INSTALLATION_MARKER_KEY,CUSTODIAL_INSTALLATION_RECORD_KEY}=await import('../mobile/src/custodial/credential-store.js');
 const HOLD='mz_custodial_protected_browser_hold.v1',PRIMARY='mz_scan_queue',BACKUP='mz_scan_queue_v6_to_v4_backup';
 class Storage{constructor(){this.values=new Map();}get length(){return this.values.size;}key(i){return [...this.values.keys()][i]??null;}getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}clear(){this.values.clear();}}
 const storage=new Storage(),raw=createRawStorageAdapter(storage),secure=new Map();
 const installationSeal=draftCase?'SYNTHETIC_SEAL_16':'SYNTHETIC_SEAL';
 for(const key of CUSTODIAL_DEVICE_KEYS)raw.setItem(key,'KIOSK_08');raw.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY,installationSeal);
 secure.set(CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify({schema_version:1,credential:'SYNTHETIC_NOT_A_DEVICE_CREDENTIAL',device_id:'KIOSK_08',installation_seal:installationSeal,enrolled_at:'2026-01-01T00:00:00.000Z',
  ...(draftCase?{principal:{schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:'33333333-3333-4333-8333-333333333333',
   credential_id:'66666666-6666-4666-8666-666666666666',credential_operation_id:'77777777-7777-4777-8777-777777777777',
   assignment_epoch:1,installation_seal:'SYNTHETIC_SEAL_16',enrolled_at:'2026-01-01T00:00:00.000Z'}}:{})}));
 // Extends this owning member's Map/request/cursor transaction adapter. This
 // models source ordering and transaction abort, not real IDB/crash durability.
 const databases=new Map(),effects=[],handles=new Set(),timers=new Set(),terminalObservations=[];
 const originalLocalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 let finishBlockedDelete,finishMigrationAbort,finishMigrationCursor,originalContext;
 let observedTerminal,cursorEntered,finishDraftGet,finishDraftDigest,draftGetEntered,draftDigestEntered;
 let deferDraftDigest=false;
 const draftGetReady=new Promise(resolve=>{draftGetEntered=resolve;}),draftDigestReady=new Promise(resolve=>{draftDigestEntered=resolve;});
 const terminalObserved=new Promise(resolve=>{observedTerminal=resolve;}),cursorReady=new Promise(resolve=>{cursorEntered=resolve;});
 const cloneMap=m=>new Map([...m].map(([k,v])=>[k,structuredClone(v)]));
 function transaction(db,storeNames,mode,onFinish=()=>{}){
  const selected=Array.isArray(storeNames)?storeNames:[storeNames],stage=new Map(selected.map(k=>[k,cloneMap(db.stores.get(k)||new Map())]));
  const migration=terminalCase&&db.name===PRIMARY&&mode==='readwrite',draftRead=draftCase&&db.name==='mz_scan_completion_drafts'&&mode==='readonly',listeners=new Map();
  if(draftRead)effects.push({effect:'draft-read'});
  const dispatch=(type,success)=>{
   const event={type,target:tx,currentTarget:tx};tx['on'+type]?.(event);
   const finish=()=>{for(const listener of listeners.get(type)||[])listener(event);onFinish(success);};
   // Model the native callback cleanup checkpoint: drain Promise reactions
   // before the later direct terminal listener, but BEFORE any next task.
   // This is Source ordering, not real IndexedDB/browser qualification.
   if(migration||draftRead)process.nextTick(finish);else finish();
  };
  let pending=0,ended=false;const tx={error:null,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},
   abort(){if(ended)return;ended=true;queueMicrotask(()=>dispatch('abort',false));}};
  if(migration){const late=event=>{
    let code=null;try{originalContext.assertCurrent();}catch(error){code=error.code||'unknown';}
    terminalObservations.push({type:event.type,direct:event.target===tx,lockOwned,contextCode:code});
    if(name==='migration-complete-withdrawal-during-dispatch')raw.setItem(HOLD,'{ foreign hold during complete dispatch }');
    observedTerminal();
   };tx.addEventListener('complete',late);tx.addEventListener('abort',late);}
  if(draftRead){const late=event=>{
    let code=null;try{originalContext.assertCurrent();}catch(error){code=error.code||'unknown';}
    terminalObservations.push({type:event.type,direct:event.target===tx,lockOwned,contextCode:code});observedTerminal();
   };tx.addEventListener('complete',late);tx.addEventListener('abort',late);}
  const done=()=>{if(ended||pending)return;ended=true;if(mode!=='readonly'){for(const [k,v]of stage)db.stores.set(k,v);effects.push({effect:'transaction',database:db.name,mode});}dispatch('complete',true);};
  const schedule=fn=>{pending++;queueMicrotask(()=>{if(ended)return;try{fn();}catch(error){tx.error=error;tx.abort();}pending--;queueMicrotask(done);});};
  const request=work=>{const req={};schedule(()=>{
   if(draftRead&&name==='draft-error-terminal-dispatch'){
    req.error=tx.error=Error('SYNTHETIC_DRAFT_READ_ERROR');req.onerror?.({target:req});tx.onerror?.({target:tx});
    queueMicrotask(()=>tx.abort());return;
   }
   req.result=work();
   if(draftRead&&name==='draft-get-withdrawal'){pending++;finishDraftGet=()=>{pending--;req.onsuccess?.();queueMicrotask(done);};draftGetEntered();return;}
   req.onsuccess?.();
  });return req;};
  tx.objectStore=k=>{if(!stage.has(k))throw Error('Unknown synthetic store');const rows=stage.get(k);
   return {indexNames:{contains:()=>true},createIndex(){},get:key=>request(()=>{if(draftRead)effects.push({effect:'draft-get'});return structuredClone(rows.get(key));}),getKey:key=>request(()=>{if(draftRead)effects.push({effect:'draft-get'});return rows.has(key)?key:undefined;}),getAll:()=>request(()=>[...rows.values()].map(v=>structuredClone(v))),
    put:value=>request(()=>{if(mode==='readonly')throw Error('Readonly mutation');rows.set(value.id??value.key,structuredClone(value));}),
    openCursor:()=>{const req={},keys=[...rows.keys()];let at=0;const next=()=>schedule(()=>{const key=keys[at++];if(name==='migration-error-ownership'&&db.name===PRIMARY&&mode==='readwrite'){pending++;finishMigrationAbort=()=>tx.abort();req.error=Error('Synthetic IDB cursor error');req.onerror?.();return;}
     if(migration&&name==='migration-terminal-abort-dispatch'){req.error=Error('SYNTHETIC_MIGRATION_CURSOR_ERROR');req.onerror?.({target:req});tx.abort();return;}
     req.result=key===undefined?null:{value:structuredClone(rows.get(key)),update:value=>request(()=>{if(migration)effects.push({effect:'cursor-update',id:key});return rows.set(key,structuredClone(value));}),continue:next};
     if(migration&&name==='migration-cursor-withdrawal-before-update'&&key!==undefined){pending++;finishMigrationCursor=()=>{pending--;req.onsuccess?.();queueMicrotask(done);};cursorEntered();return;}
     if(name==='hold-before-content-update'&&db.name===PRIMARY&&mode==='readwrite'&&key!==undefined)raw.setItem(HOLD,'{foreign hold before update');req.onsuccess?.();});next();return req;}};};
  queueMicrotask(done);return tx;
 }
 function connection(db){const c={version:db.version,objectStoreNames:{contains:k=>db.stores.has(k),get length(){return db.stores.size;}},close(){handles.delete(c);},transaction:(names,mode)=>transaction(db,names,mode),
  createObjectStore(k){if(db.stores.has(k))throw Error('Duplicate store');db.stores.set(k,new Map());return {indexNames:{contains:()=>false},createIndex(){},put:value=>db.stores.get(k).set(value.id??value.key,structuredClone(value))};}};handles.add(c);return c;}
 const idb={databases:async()=>[...databases.values()].map(d=>({name:d.name,version:d.version})),open(dbName,version){
  const req={};queueMicrotask(()=>{const saved=databases.get(dbName),upgrade=!saved||(version!==undefined&&version>saved.version);
   if(saved&&version!==undefined&&version<saved.version){req.error=Error('VersionError');req.onerror?.();return;}
   const db=upgrade?{name:dbName,version:version||1,stores:new Map(saved?[...saved.stores].map(([k,v])=>[k,cloneMap(v)]):[])}:saved;
   req.result=connection(db);
   if(upgrade){let aborted=false;req.transaction={abort(){aborted=true;},objectStore:k=>({indexNames:{contains:()=>false},createIndex(){},put:value=>db.stores.get(k).set(value.id??value.key,structuredClone(value))})};req.onupgradeneeded?.({oldVersion:saved?.version||0,newVersion:db.version});
    if(aborted){req.result.close();req.error=Object.assign(Error('Aborted missing database open'),{name:'AbortError'});req.onerror?.();
     if(draftCase&&name==='draft-missing-open-terminal-dispatch')process.nextTick(()=>{
      let code=null;try{originalContext.assertCurrent();}catch(error){code=error.code||'unknown';}
      terminalObservations.push({type:'open-error',lockOwned,contextCode:code});observedTerminal();
     });return;}
    databases.set(dbName,db);effects.push({effect:'upgrade',database:dbName});}
   req.onsuccess?.();});return req;
  },deleteDatabase(dbName){const req={};queueMicrotask(()=>{const finish=()=>{databases.delete(dbName);effects.push({effect:'delete',database:dbName});req.onsuccess?.();};if(name==='blocked-delete-ownership'&&dbName===PRIMARY){finishBlockedDelete=finish;req.onblocked?.();}else finish();});return req;}};
 const original={id:91,schema_version:6,type:'complete_session',operation_id:'11111111-1111-4111-8111-111111111111',client_id:'11111111-1111-4111-8111-111111111111',
  payload:{p_device_id:'KIOSK_08',p_session_uuid:'22222222-2222-4222-8222-222222222222',p_client_completion_id:'11111111-1111-4111-8111-111111111111',note:'SYNTHETIC retained original'},created_at:1780000000000,retry_count:0,dead_letter:false,state:'pending'};
 databases.set(PRIMARY,{name:PRIMARY,version:terminalCase||['hold-before-content-update','migration-error-ownership'].includes(name)?4:name==='admitted-legacy-upgrade'?3:6,stores:new Map([['actions',new Map([[91,structuredClone(original)]])]])});
 if(['changed-undefined-original','retained-undefined-original'].includes(name))databases.get(PRIMARY).stores.get('actions').get(91).retained_optional=undefined;
 let lockOwned=false;const locks={request:async(name,options,fn)=>{assert.equal(lockOwned,false);lockOwned=true;try{return await fn({name,mode:options.mode});}finally{lockOwned=false;}}};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
 const runtime=getCustodialBridgeSecurityRuntime({storage,indexedDb:idb,locks,cryptoApi:webcrypto,secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
 await runtime.security.ready;assert.equal(runtime.security.getStatus().ready,true);effects.length=0;
 const rows=()=>[...databases.get(PRIMARY)?.stores.get('actions')?.values()||[]].map(v=>structuredClone(v));
 const slice=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
 const implementation=slice('  function custodialSecurity(','  function dispatchSecurityPause(')+slice('  function storageFailure(','  function releaseVersionTuple(')
  +slice('  function operationIdFor(','  function listActions(')+slice('  async function init()','  function ensureWorkerReady(');
 const config=vm.runInNewContext(source.slice(source.indexOf('  const CONFIG ='),source.indexOf('  const state ='))+'\nCONFIG;');
 const active=[];
 function worker(hook){
  // Forward the ORIGINAL context from the real runtime admission. This does
  // not construct/copy an assertCurrent capability or substitute auth.
  const security=(terminalCase||draftCase)?Object.freeze({...runtime.security,mutateProtectedWork:(operation,options)=>runtime.security.mutateProtectedWork(context=>{originalContext=context;return operation(context);},options)}):runtime.security;
  const state={db:null,deviceId:'',channel:null,timer:null},window={MemphisCustodialSecurity:security,indexedDB:idb,__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__:hook,setInterval:()=>1,
   setTimeout(fn,delay){const timer=setTimeout(()=>{timers.delete(timer);fn();},delay);timers.add(timer);return timer;}};
  const c=vm.createContext({window,state,CONFIG:config,indexedDB:idb,localStorage:globalThis.localStorage,crypto:draftCase?{randomUUID,subtle:{async digest(...args){if(deferDraftDigest){draftDigestEntered();await new Promise(resolve=>{finishDraftDigest=resolve;});}return webcrypto.subtle.digest(...args);}}}:webcrypto,TextEncoder,Uint8Array,Date,Map,Set,JSON,Number,Math,
   safeText:x=>String(x??'').trim(),now:()=>1780000000000,isUuid:x=>/^[a-f0-9-]{36}$/i.test(x),exactSessionForPayload:()=>null,resolveDeviceId:()=> 'KIOSK_08',installWorkerListeners(){},scheduleSync(){}});
  vm.runInContext(implementation+(draftCase?slice('  function canonicalJson(','  function storageFailure(')+slice('  function openCompletionDraftDb(','  async function saveCompletionDraft(')+slice('  async function readCompletionDraftWithinOwnedContext(','  async function deleteCompletionDraft('):''),c);active.push(state);return c;
 }
 const start=async c=>{try{return {opened:await c.init(),error:null};}catch(error){return {opened:false,error};}};
 try{
  if(draftCase){
   assert.equal(runtime.security.getStatus().principal?.employee_id,'33333333-3333-4333-8333-333333333333','actual Source runtime must publish the complete synthetic protected principal');
   const c=worker(),expected={contract_version:config.REQUIRED_SCAN_CONTRACT_VERSION,session_uuid:'22222222-2222-4222-8222-222222222222',client_completion_id:'11111111-1111-4111-8111-111111111111',device_id:'KIOSK_08',employee_id:'33333333-3333-4333-8333-333333333333',location_code:'NOCX'};
   const originalDraft=await c.completionDraftRecord({...expected,draft:{note:'SYNTHETIC original exact draft',count:17}});
   const successorId='44444444-4444-4444-8444-444444444444';
   const successorDraft=await c.completionDraftRecord({...expected,session_uuid:successorId,draft:{note:'SYNTHETIC successor must not be adopted'}});
   const draftRows=new Map([[expected.session_uuid,structuredClone(originalDraft)],[successorId,structuredClone(successorDraft)]]);
   if(name==='draft-invalid-record-not-absence')draftRows.set(expected.session_uuid,true); // Labelled corrupt test copy, not an absent row.
   databases.set(config.COMPLETION_DRAFT_DB_NAME,{name:config.COMPLETION_DRAFT_DB_NAME,version:1,stores:new Map([[config.COMPLETION_DRAFT_STORE_NAME,draftRows]])});
   const originalBytes=JSON.stringify([...draftRows]),primaryBytes=JSON.stringify(rows());
   const outcome=promise=>Promise.resolve(promise).then(value=>({value,error:null}),error=>({value:null,error}));
   let result;
   if(name.endsWith('before-fifo')){
    let entered,release;const held=new Promise(resolve=>{entered=resolve;});
    const holder=runtime.security.mutateProtectedWork(async context=>{context.assertCurrent();entered();await new Promise(resolve=>{release=resolve;});context.assertCurrent();});
    await held;
    const generation=runtime.security.getStatus().generation;
    const transition=name.includes('generation')?runtime.security.ensureSecurityState():Promise.resolve();
    const pending=outcome(name.includes('exists')?c.completionDraftExists(expected.session_uuid):c.loadCompletionDraft(expected));
    if(name==='draft-expected-before-fifo')expected.session_uuid=successorId;
    if(name==='draft-load-runtime-before-fifo')c.window.MemphisCustodialSecurity=Object.freeze({...c.window.MemphisCustodialSecurity});
    release();await holder;await transition;result=await pending;
    if(name==='draft-expected-before-fifo'){
     assert.equal(result.error,null);assert.equal(result.value.session_uuid,originalDraft.session_uuid,'queued load must use its invocation-original identity, not caller successor');
    }else{
     if(name.includes('generation'))assert.ok(runtime.security.getStatus().generation>generation,'actual runtime transition must change generation');
     assert.ok(result.error,'queued original read must refuse successor generation/runtime');
     assert.equal(effects.filter(e=>e.effect==='draft-get').length,0,'refuse before reading any successor draft (the real ensure inspection may enumerate rows)');
    }
   }else if(name==='draft-load-integrity-withdrawal'||name==='draft-readback-integrity-withdrawal'){
    deferDraftDigest=true;
    const operation=name==='draft-readback-integrity-withdrawal'
     ?runtime.security.mutateProtectedWork(context=>{originalContext=context;return c.readCompletionDraftWithinOwnedContext(expected,context);})
     :c.loadCompletionDraft(expected);
    const pending=outcome(operation);await draftDigestReady;assert.equal(lockOwned,true);originalContext.assertCurrent();
    raw.setItem(HOLD,'{ foreign hold while actual draft SHA is pending }');finishDraftDigest();result=await pending;
    assert.ok(result.error,'completed SHA cannot publish after original checkpoint withdrawal');
   }else if(name==='draft-get-withdrawal'){
    const pending=outcome(c.loadCompletionDraft(expected));await draftGetReady;assert.equal(lockOwned,true);
    raw.setItem(HOLD,'{ foreign hold before deferred actual get callback }');finishDraftGet();result=await pending;assert.ok(result.error);
   }else if(name==='draft-missing-open-terminal-dispatch'){
    databases.delete(config.COMPLETION_DRAFT_DB_NAME);
    const pending=outcome(c.completionDraftExists(expected.session_uuid));await terminalObserved;result=await pending;
    assert.equal(terminalObservations.length,1);assert.equal(terminalObservations[0].lockOwned,true);
    assert.equal(terminalObservations[0].contextCode,null);assert.equal(result.error,null);assert.equal(result.value,false);
    assert.equal(databases.has(config.COMPLETION_DRAFT_DB_NAME),false);
   }else if(name==='draft-invalid-record-not-absence'){
    result=await outcome(c.loadCompletionDraft(expected));assert.ok(result.error,'corrupt present row is UNKNOWN, never empty');assert.equal(result.error.code,'custodial_storage_unavailable');
   }else if(name==='draft-owned-positive-absence'){
    result=await outcome(c.loadCompletionDraft(expected));assert.equal(result.error,null);assert.equal(JSON.stringify(result.value),JSON.stringify(originalDraft));
    assert.equal(await c.completionDraftExists(expected.session_uuid),true);
    assert.equal(await c.loadCompletionDraft({...expected,session_uuid:'55555555-5555-4555-8555-555555555555'}),null);
    assert.equal(await c.completionDraftExists('55555555-5555-4555-8555-555555555555'),false);
    databases.delete(config.COMPLETION_DRAFT_DB_NAME);
    assert.equal(await c.loadCompletionDraft(expected),null);assert.equal(await c.completionDraftExists(expected.session_uuid),false);
    assert.equal(databases.has(config.COMPLETION_DRAFT_DB_NAME),false,'read cannot create an absent DB');
   }else{
    const pending=outcome(c.completionDraftExists(expected.session_uuid));await terminalObserved;result=await pending;
    const late=terminalObservations.at(-1);assert.equal(late.direct,true);
    assert.equal(late.lockOwned,true,'draft read must retain original admission through terminal listener dispatch');
    assert.equal(late.contextCode,null,'draft terminal listener must retain the actual live original context');
    if(name==='draft-error-terminal-dispatch')assert.ok(result.error);else{assert.equal(result.error,null);assert.equal(result.value,true);}
   }
   assert.equal(JSON.stringify([...draftRows]),originalBytes,'read/uncertainty must not alter either draft original');
   assert.equal(JSON.stringify(rows()),primaryBytes);assert.equal(lockOwned,false);
   if(originalContext)assert.throws(()=>originalContext.assertCurrent(),error=>error.code==='custodial_protected_operation_closed');
   assert.equal(effects.filter(e=>['upgrade','delete','transaction','cursor-update'].includes(e.effect)).length,0,'no read may create/modify/retry original storage');
  }else if(terminalCase){
   const before=rows();let settled=false;const writing=start(worker()).then(result=>{settled=true;return result;});
   if(name==='migration-cursor-withdrawal-before-update'){
    await cursorReady;assert.equal(settled,false);assert.equal(lockOwned,true);raw.setItem(HOLD,'{ foreign hold before deferred cursor update }');finishMigrationCursor();
   }
   await terminalObserved;const result=await writing;
   assert.equal(terminalObservations.length,1);const late=terminalObservations[0];assert.equal(late.direct,true);
   assert.equal(late.lockOwned,true,'original admission must cover later terminal listeners after the Promise checkpoint');
   if(name==='migration-cursor-withdrawal-before-update')assert.equal(late.contextCode,'custodial_browser_preservation_pending');
   else assert.equal(late.contextCode,null,'original native context must remain open for the late terminal listener');
   assert.equal(lockOwned,false);assert.throws(()=>originalContext.assertCurrent(),error=>error.code==='custodial_protected_operation_closed');
   if(name==='migration-terminal-complete-dispatch'){
    assert.equal(result.opened,true);assert.deepEqual(rows()[0].payload,original.payload);assert.equal(rows()[0].operation_id,original.operation_id);assert.equal(rows()[0].client_id,original.client_id);assert.equal(rows()[0].created_at,original.created_at);
    assert.equal(effects.filter(e=>e.effect==='transaction'&&e.database===PRIMARY&&e.mode==='readwrite').length,1);
   }else if(name==='migration-complete-withdrawal-during-dispatch'){
    assert.equal(result.opened,false);assert.equal(result.error.code,'custodial_browser_preservation_pending');
    assert.deepEqual(rows()[0].payload,original.payload);assert.equal(rows()[0].operation_id,original.operation_id);
    assert.equal(effects.filter(e=>e.effect==='transaction'&&e.database===PRIMARY&&e.mode==='readwrite').length,1,'already committed migration is not rolled back or retried after withdrawal');
   }else{
    assert.equal(result.opened,false);assert.deepEqual(rows(),before);assert.equal(effects.filter(e=>['transaction','cursor-update'].includes(e.effect)&&e.mode!=='readonly').length,0);
    if(name==='migration-cursor-withdrawal-before-update')assert.equal(result.error.code,'custodial_browser_preservation_pending');
    else assert.match(result.error.message,/SYNTHETIC_MIGRATION_CURSOR_ERROR/);
   }
  }else if(name==='hold-before-entry'){
   raw.setItem(HOLD,'{retained unknown hold');const before=JSON.stringify(rows());const result=await start(worker());
   assert.equal(result.opened,false);assert.equal(result.error.code,'custodial_browser_preservation_pending');assert.equal(effects.length,0);assert.equal(JSON.stringify(rows()),before);
  }else if(name==='hold-after-backup'||name==='binding-after-backup'){
   const before=JSON.stringify(rows());const result=await start(worker(point=>{if(point==='backup-verified')raw.setItem(name==='hold-after-backup'?HOLD:'memphisAssignedDeviceId',name==='hold-after-backup'?'{foreign hold':'KIOSK_02');}));
   assert.equal(result.opened,false);assert.equal(JSON.stringify(rows()),before,'primary original changed after protection changed');
   assert.ok(databases.has(BACKUP));assert.equal(effects.filter(e=>e.effect==='delete'&&e.database===PRIMARY).length,0);
  }else if(name==='missing-backup-read'){
   const c=worker();assert.equal(await c.readDowngradeBackup(),null);assert.equal(databases.has(BACKUP),false);assert.equal(effects.length,0);
  }else if(name==='malformed-backup'){
   databases.set(BACKUP,{name:BACKUP,version:1,stores:new Map([['retained-unknown',new Map([['evidence',{note:'original unknown backup'}]])]])});
   const before=JSON.stringify(rows());const result=await start(worker());assert.equal(result.opened,false);assert.ok(databases.has(BACKUP));assert.equal(JSON.stringify(rows()),before);assert.equal(effects.length,0);
  }else if(name==='changed-primary'||name==='retained-backup-resume'||name==='changed-undefined-original'||name==='retained-undefined-original'){
   const captured=await start(worker(point=>{if(point==='backup-verified')throw Error('Source fixture stop after exact backup');}));assert.equal(captured.opened,false);assert.ok(databases.has(BACKUP));
   effects.length=0;
   if(name==='changed-primary'||name==='changed-undefined-original'){if(name==='changed-primary')databases.get(PRIMARY).stores.get('actions').set(91,{...original,payload:{...original.payload,note:'newer retained original'}});else delete databases.get(PRIMARY).stores.get('actions').get(91).retained_optional;const before=JSON.stringify(rows());
    const result=await start(worker());assert.equal(result.opened,false);assert.equal(JSON.stringify(rows()),before);assert.ok(databases.has(BACKUP));assert.equal(effects.length,0);
   }else{if(name==='retained-backup-resume')databases.delete(PRIMARY);const result=await start(worker());assert.equal(result.opened,true);assert.equal(databases.get(PRIMARY).version,4);assert.equal(databases.has(BACKUP),false);assert.equal(rows()[0].operation_id,original.operation_id);if(name==='retained-undefined-original'){assert.equal(Object.hasOwn(rows()[0],'retained_optional'),true);assert.equal(rows()[0].retained_optional,undefined);assert.deepEqual(rows()[0].payload,original.payload);}}
  }else if(name==='hold-before-content-update'){
   const before=JSON.stringify(rows());const result=await start(worker());assert.equal(result.opened,false);assert.equal(result.error.code,'custodial_browser_preservation_pending');
   assert.equal(JSON.stringify(rows()),before);assert.equal(effects.filter(e=>e.effect==='transaction'&&e.database===PRIMARY).length,0);
  }else if(name==='corrupted-backup'){
   databases.set(BACKUP,{name:BACKUP,version:1,stores:new Map([['metadata',new Map([['capture',{key:'capture',source_version:6,canonical_rows:'[]',canonical_fenced_rows:'[]'}]])],['actions',new Map([[91,structuredClone(original)]])]])});
   const before=JSON.stringify(rows());const result=await start(worker());assert.equal(result.opened,false);assert.equal(JSON.stringify(rows()),before);
   assert.ok(databases.has(BACKUP));assert.equal(effects.length,0);
  }else if(name==='missing-checkpoint'){
   const before=JSON.stringify(rows());const result=await start(worker());assert.equal(result.opened,false);assert.equal(result.error.code,'custodial_protected_checkpoint_unavailable');
   assert.equal(JSON.stringify(rows()),before);assert.equal(effects.length,0);
  }else if(name==='blocked-delete-ownership'){
   let settled=false;const writing=start(worker()).then(result=>{settled=true;return result;});
   await new Promise(r=>setImmediate(r));assert.equal(typeof finishBlockedDelete,'function');assert.equal(settled,false);assert.equal(lockOwned,true);
   finishBlockedDelete();const result=await writing;assert.equal(result.opened,true);assert.equal(lockOwned,false);assert.equal(databases.get(PRIMARY).version,4);
  }else if(name==='migration-error-ownership'){
   let settled=false;const before=JSON.stringify(rows());const writing=start(worker()).then(result=>{settled=true;return result;});
   await new Promise(r=>setImmediate(r));assert.equal(typeof finishMigrationAbort,'function');assert.equal(settled,false);assert.equal(lockOwned,true);
   finishMigrationAbort();const result=await writing;assert.equal(result.opened,false);assert.equal(lockOwned,false);assert.equal(JSON.stringify(rows()),before);
  }else if(name==='admitted-legacy-upgrade'){
   const result=await start(worker());assert.equal(result.opened,true);assert.equal(databases.get(PRIMARY).version,4);assert.equal(rows()[0].operation_id,original.operation_id);
   const db=active.at(-1).db;assert.equal(typeof db.onversionchange,'function');db.onversionchange();assert.equal(active.at(-1).db,null);
  }else if(name==='checkpoint-lifetime'){
   let captured;await runtime.security.mutateProtectedWork(context=>{captured=context;assert.equal(typeof context.assertCurrent,'function');assert.deepEqual(Object.keys(context).sort(),['deviceId','generation','state']);assert.equal(Object.isFrozen(context),true);assert.equal(Object.getOwnPropertyDescriptor(context,'assertCurrent').enumerable,false);context.assertCurrent();});
   assert.throws(()=>captured.assertCurrent(),error=>error.code==='custodial_protected_operation_closed');assert.equal(Object.hasOwn(runtime.security.getStatus(),'assertCurrent'),false);
   await assert.rejects(runtime.security.mutateProtectedWork(context=>{captured=context;throw Error('Synthetic rejected callback');}));
   await runtime.security.mutateProtectedWork(context=>{context.assertCurrent();assert.throws(()=>captured.assertCurrent(),error=>error.code==='custodial_protected_operation_closed');});
  }else if(name==='admitted-downgrade'){
   const result=await start(worker());assert.equal(result.opened,true);assert.equal(databases.get(PRIMARY).version,4);assert.equal(databases.has(BACKUP),false);
   assert.equal(rows()[0].operation_id,original.operation_id);assert.deepEqual(rows()[0].payload,original.payload);assert.equal(rows()[0].dead_letter,true);assert.match(rows()[0].type,/^forward-replay-fenced:/);
  }
  console.log('PASS_QUEUE_PRESERVATION '+name+' (actual runtime/queue source, synthetic storage/IDB/locks only)');
 }finally{for(const state of active)state.db?.close();for(const db of [...handles])db.close();assert.equal(handles.size,0);assert.equal(timers.size,0);
  if(terminalCase||draftCase){
   const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
   // The ACTUAL firewall deliberately seals this standalone Source realm.
   // Never undo that guard; process exit discards only the synthetic area.
   if(descriptor?.configurable===false)assert.equal(descriptor.writable,false);
   else if(originalLocalStorage)Object.defineProperty(globalThis,'localStorage',originalLocalStorage);else delete globalThis.localStorage;
  }
 }
}
