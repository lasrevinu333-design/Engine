// Offline audit probe only. Immutable owner functions; synthetic IndexedDB and transport.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(process.env.SCAN_SYNC_SOURCE||new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
const segment=(a,b,text=source)=>{const start=text.indexOf(a),end=text.indexOf(b,start);assert(start>=0&&end>start);return text.slice(start,end);};
const clone=value=>structuredClone(value);
function memoryIndexedDb(version,row) {
  const logs=[],records=new Map([['mz_scan_queue',{version,stores:new Map([['actions',{keyPath:'id',rows:new Map([[row.id,clone(row)]]),indexes:[]} ]])}]]);
  const names=arr=>Object.assign([...arr],{contains:n=>arr.includes(n)});
  const later=fn=>setTimeout(fn,0);
  function connection(record) {
    const db={version:record.version,close(){},get objectStoreNames(){return names([...record.stores.keys()]);}};
    function transaction(storeNames,mode,done) {
      let pending=0,finished=false,aborted=false;
      const tx={error:null,abort(){if(finished)return;aborted=true;finished=true;later(()=>{tx.onabort?.({target:tx});done?.(new Error('Abort'));});},objectStore(name){
        const table=record.stores.get(name);assert(table,`store ${name}`);
        const store={get indexNames(){return names(table.indexes);},createIndex(name){table.indexes.push(name);},getAll(){return request(()=>[...table.rows.values()].map(clone));},put(value){return request(()=>{const v=clone(value);table.rows.set(v[table.keyPath],v);return v[table.keyPath];});},openCursor(){
          const req={},keys=[...table.rows.keys()].sort((a,b)=>a-b);let i=0;
          function step(){schedule(()=>{const key=keys[i++];req.result=key===undefined?null:{value:clone(table.rows.get(key)),update(value){return store.put(value);},continue:step};req.onsuccess?.({target:req});});}
          step();return req;
        }};return store;
      }};
      function complete(){later(()=>{if(!pending&&!finished){finished=true;tx.oncomplete?.({target:tx});done?.();}});}
      function schedule(fn){pending++;later(()=>{if(aborted)return;try{fn();}catch(error){tx.error=error;tx.onerror?.({target:tx});tx.abort();}finally{pending--;complete();}});}
      function request(fn){const req={};schedule(()=>{req.result=fn();req.onsuccess?.({target:req});});return req;}
      complete();return tx;
    }
    db.transaction=(stores,mode)=>transaction(stores,mode);
    db.createObjectStore=(name,options)=>{record.stores.set(name,{keyPath:options.keyPath,rows:new Map(),indexes:[]});return db.upgradeTx.objectStore(name);};
    db.upgrade=(done)=>db.upgradeTx=transaction([], 'versionchange',done);
    return db;
  }
  const indexedDB={open(name,wanted){const req={};later(()=>{
    const found=records.get(name),old=found?.version||0,version=wanted??(old||1);
    if(found&&version<old){req.error=new Error('VersionError');req.onerror?.();return;}
    const record=found??{version,stores:new Map()};record.version=version;records.set(name,record);const db=connection(record);req.result=db;
    if(!found||version>old){req.transaction=db.upgrade(error=>{if(error){if(!found)records.delete(name);req.error=error;req.onerror?.();}else req.onsuccess?.();});req.onupgradeneeded?.({oldVersion:old,newVersion:version});}
    else req.onsuccess?.();
  });return req;},deleteDatabase(name){const req={};later(()=>{logs.push({delete:name});records.delete(name);req.onsuccess?.();});return req;}};
  return {indexedDB,records,logs};
}
const operation='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
function fixtureContext(model,calls=[],stop=Error('transport boundary'),text=source) {
  const part=(a,b)=>segment(a,b,text);
  const c={CONFIG:{DB_NAME:'mz_scan_queue',STORE_NAME:'actions',DB_VERSION:4,MAX_KNOWN_DB_VERSION:6,SCHEMA_VERSION:6,ROLLBACK_BACKUP_DB_NAME:'mz_scan_queue_v6_to_v4_backup',REQUIRED_SCAN_CONTRACT_VERSION:'scan.v4.snapshot-bound-authority',API_URL:'/rpc'},window:{setTimeout},indexedDB:model.indexedDB,structuredClone,state:{db:null,deviceId:'KIOSK_08'},nativeQueueSecurityRequired:true,queueMutationSecurity:()=>({}),exactSessionForPayload:()=>null,storageFailure:(context,error)=>Object.assign(new Error(context+': '+error.message),{cause:error}),fetch:async(url,args)=>{calls.push({url,body:JSON.parse(args.body)});throw stop;}};
  vm.createContext(c);
  vm.runInContext(part('  function safeText(','  function canonicalJson(')+part('  function operationIdFor(','  function listActions(')+part('  async function rpc(','  async function persistServerCompletionReceipt(')+part('  async function verifiedServerCompletionReceipt(','  function processResultFailure('),c);
  return c;
}
const output=[];
for(const dbVersion of [4,5,6]) for(const kind of ['future','opaque-legacy','valid-current','valid-legacy']) {
  const original={id:1,schema_version:99,type:'finish_session',operation_id:operation,created_at:1700000000000,last_error:'ORIGINAL-DIAGNOSTIC',payload:{p_device_id:'KIOSK_08',p_session_uuid:session,saved_answer:'SAVED-ANSWER'}};
  if(kind==='opaque-legacy'){original.schema_version=4;original.type='start_session';original.operation_id='LEGACY-OPERATION-42';}
  if(kind==='valid-current')original.schema_version=6;
  if(kind==='valid-legacy')original.schema_version=4;
  const held=kind==='future'||kind==='opaque-legacy';
  const model=memoryIndexedDb(dbVersion,original),calls=[];
  const stop=Object.assign(new Error('Audit stops at transport boundary'),{code:'AUDIT_STOP'});
  const c=fixtureContext(model,calls,stop);
  const checkpoints={count:0,assertCurrent(){this.count++;}};
  await c.openDb(checkpoints);
  const record=model.records.get('mz_scan_queue'),rows=[...record.stores.get('actions').rows.values()].map(clone);
  assert.equal(record.version,4);assert.equal(rows.length,1);assert.equal(rows[0].payload.saved_answer,original.payload.saved_answer);
  const selected=c.nextClaimableAction(rows);
  if(held){
    assert.equal(selected,null);assert.equal(rows[0].recoverable,false);
    assert.deepEqual(rows[0].preserved_original_record,original);
    assert.equal(rows[0].operation_id,original.operation_id);
    assert.equal(rows[0].last_error,original.last_error);
    const saved=clone(rows[0]);
    await c.openDb(checkpoints);await c.openDb(checkpoints);
    const reopened=[...model.records.get('mz_scan_queue').stores.get('actions').rows.values()].map(clone);
    assert.deepEqual(reopened,[saved],'Repeated opening retains exact archived original and held row');
    assert.equal(c.nextClaimableAction(reopened),null);assert.equal(calls.length,0);
  }else{
    assert.equal(selected.schema_version,6);assert.equal(selected.type,'finish_session');
    assert.equal(selected.operation_id,operation);assert.equal(selected.dead_letter,false);
    await assert.rejects(c.processAction(selected),error=>error===stop);
    assert.equal(calls.length,1);assert.equal(calls[0].body.args.p_finish_operation_id,operation);
  }
  output.push({kind,initial_physical_db_version:dbVersion,original_row_schema:original.schema_version,original_retained:held?true:null,backup_retained:model.records.has('mz_scan_queue_v6_to_v4_backup'),selected:!!selected,transport_calls:calls,deletions:model.logs,owner_checkpoints:checkpoints.count});
}
console.log(JSON.stringify({scope:'Actual immutable openDb + all downgrade backup/restore/content-migration owners, selector and processAction/rpc. Synthetic IndexedDB successful event semantics; no native transport, server execution or phone proof. Transport stub stops before response.',cases:output},null,2));

// The actual previous-release writer creates the interrupted backup; the current
// opener must recover raw originals at all durable stages, never replay its lossy view.
const previousSource=fs.readFileSync(new URL('./fixtures/scan-backup-v63-owner.js',import.meta.url),'utf8');
for(const version of [5,6])for(const kind of ['legacy','future','opaque','current'])for(const stage of ['backup-verified','primary-deleted','fenced-v4-written']){
 const original={id:1,schema_version:kind==='current'?6:kind==='future'?99:4,type:'finish_session',operation_id:kind==='opaque'?'opaque-original':operation,
  created_at:1700000000000,last_error:'KEEP-DIAGNOSTIC',payload:{p_device_id:'KIOSK_08',p_session_uuid:session,saved_answer:'KEEP-ANSWER'}};
 const model=memoryIndexedDb(version,original),old=fixtureContext(model,[],null,previousSource),ctx={assertCurrent(){}};
 const interrupted=Error('synthetic interruption '+stage);old.window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__=point=>{if(point===stage)throw interrupted;};
 await assert.rejects(old.openDb(ctx),e=>e===interrupted);
 const backup=clone([...model.records.get('mz_scan_queue_v6_to_v4_backup').stores.get('actions').rows.values()]);
 assert.deepEqual(backup,[original]);
 const current=fixtureContext(model);let verified=false;
 current.window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__=point=>{if(point==='fenced-v4-verified'){verified=true;assert(model.records.has('mz_scan_queue_v6_to_v4_backup'));}};
 await current.openDb(ctx);assert(verified);assert(!model.records.has('mz_scan_queue_v6_to_v4_backup'));
 const rows=[...model.records.get('mz_scan_queue').stores.get('actions').rows.values()];
 assert.equal(rows.length,1);assert.equal(rows[0].payload.saved_answer,'KEEP-ANSWER');assert.equal(rows[0].last_error,'KEEP-DIAGNOSTIC');
 const selected=current.nextClaimableAction(rows);
 if(kind==='future'||kind==='opaque'){assert.equal(selected,null);assert.deepEqual(rows[0].preserved_original_record,original);}
 else{assert.equal(selected.operation_id,operation);assert.equal(selected.type,'finish_session');}
 console.log('PASS historical interrupted backup',version,kind,stage);
}

// Capture is a historical snapshot. A later wall clock or local-session view
// cannot be used to reconstruct it, and a captured success is not replay proof.
for(const writer of ['v63','current'])for(const version of [5,6])for(const change of ['clock','session-removed','session-changed','unsupported-neighbor'])for(const stage of ['backup-verified','primary-deleted','fenced-v4-written']){
 const original={id:1,schema_version:4,type:'finish_session',operation_id:operation,
  payload:{p_device_id:'KIOSK_08',p_session_uuid:session,saved_answer:'ORIGINAL-ANSWER'}};
 if(change!=='clock')original.created_at=1700000000000;
 const model=memoryIndexedDb(version,original),ctx={assertCurrent(){}},old=fixtureContext(model,[],null,writer==='v63'?previousSource:source);
 const historicalSession={session_uuid:session,offline_authority_employee_id:'ORIGINAL-EMPLOYEE',offline_authority_assignment_epoch:7,offline_authority_snapshot_id:'ORIGINAL-SNAPSHOT'};
 old.now=()=>1700000000000;old.exactSessionForPayload=()=>historicalSession;
 const opaque={id:2,schema_version:99,type:'finish_session',operation_id:'opaque-original',payload:{saved_answer:'HELD-ANSWER'}};
 if(change==='unsupported-neighbor')model.records.get('mz_scan_queue').stores.get('actions').rows.set(2,clone(opaque));
 const stop=Error('captured '+stage);old.window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__=point=>{if(point===stage)throw stop;};
 await assert.rejects(old.openDb(ctx),e=>e===stop);
 const current=fixtureContext(model);current.now=()=>1700000060000;
 current.exactSessionForPayload=()=>change==='session-removed'?null:{...historicalSession,offline_authority_employee_id:'SUCCESSOR-EMPLOYEE',offline_authority_assignment_epoch:8};
 await current.openDb(ctx);
 const rows=[...model.records.get('mz_scan_queue').stores.get('actions').rows.values()],healthy=rows.find(row=>row.id===1);
 assert.equal(model.records.get('mz_scan_queue').version,4);assert(!model.records.has('mz_scan_queue_v6_to_v4_backup'));
 assert.equal(healthy.created_at,1700000000000);assert.equal(healthy.replay_binding.employee_id,'ORIGINAL-EMPLOYEE');
 assert.equal(healthy.replay_binding.assignment_epoch,7);assert.equal(healthy.payload.saved_answer,'ORIGINAL-ANSWER');
 assert.equal(current.nextClaimableAction(rows).operation_id,operation);
 if(change==='unsupported-neighbor')assert.deepEqual(rows.find(row=>row.id===2).preserved_original_record,opaque);
 console.log('PASS captured backup survives ambient change',writer,version,change,stage);
}

for(const stage of ['backup-verified','primary-deleted','fenced-v4-written']){
 const original={id:1,schema_version:4,type:'commit_workflow',operation_id:operation,created_at:1700000000000,
  payload:{p_device_id:'KIOSK_08',p_session_uuid:session,p_client_completion_id:operation,saved_answer:'RETAIN-WITHOUT-PROOF'}};
 const model=memoryIndexedDb(5,original),ctx={assertCurrent(){}},writer=fixtureContext(model);
 writer.exactSessionForPayload=()=>({session_uuid:session,context_id:'CAPTURED-CONTEXT',submission_proof:'CAPTURED-PROOF'});
 const stop=Error('captured '+stage);writer.window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__=point=>{if(point===stage)throw stop;};
 await assert.rejects(writer.openDb(ctx),e=>e===stop);
 const current=fixtureContext(model);await current.openDb(ctx);
 const rows=[...model.records.get('mz_scan_queue').stores.get('actions').rows.values()];
 assert.equal(current.nextClaimableAction(rows),null);assert.deepEqual(rows[0].preserved_original_record,original);
 assert.equal(rows[0].recoverable,false);assert(!model.records.has('mz_scan_queue_v6_to_v4_backup'));
 console.log('PASS captured eligibility never replaces current proof',stage);
}

for(const stage of ['backup-verified','primary-deleted','fenced-v4-written']){
 const original={id:1,schema_version:4,type:'commit_workflow',operation_id:operation,created_at:1700000000000,
  payload:{p_device_id:'KIOSK_08',p_session_uuid:session,p_client_completion_id:operation,saved_answer:'HELD-UNTIL-PROOF'}};
 const model=memoryIndexedDb(5,original),ctx={assertCurrent(){}},writer=fixtureContext(model),stop=Error('held '+stage);
 writer.window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__=point=>{if(point===stage)throw stop;};
 await assert.rejects(writer.openDb(ctx),e=>e===stop);
 const current=fixtureContext(model);
 current.exactSessionForPayload=()=>({session_uuid:session,context_id:'AVAILABLE-CONTEXT',submission_proof:'AVAILABLE-PROOF',offline_authority_employee_id:'ORIGINAL-EMPLOYEE'});
 const backup=await current.readDowngradeBackup(ctx),restored=current.fencedDowngradeRows(backup.rows,backup.capturedRows);
 assert.equal(restored[0].recoverable,false);
 assert.deepEqual(clone(restored[0].preserved_original_record),original);
 await current.openDb(ctx);
 const rows=[...model.records.get('mz_scan_queue').stores.get('actions').rows.values()];
 assert.equal(current.nextClaimableAction(rows),null);
 assert.equal(rows[0].payload.saved_answer,'HELD-UNTIL-PROOF');
 assert(!model.records.has('mz_scan_queue_v6_to_v4_backup'));
 console.log('PASS held capture remains quarantined when ambient proof appears',stage);
}

for(const writerKind of ['v63','current'])for(const version of [5,6])for(const firstStage of ['backup-verified','primary-deleted','fenced-v4-written'])for(const secondStage of ['fenced-v4-written','fenced-v4-verified']){
 const original={id:1,schema_version:4,type:'commit_workflow',operation_id:operation,created_at:1700000000000,
  payload:{p_device_id:'KIOSK_08',p_session_uuid:session,p_client_completion_id:operation,saved_answer:'RETAIN-THROUGH-TWO-RESTARTS'}};
 const healthy={id:2,schema_version:6,type:'finish_session',operation_id:'33333333-3333-4333-8333-333333333333',created_at:1700000000001,
  payload:{p_device_id:'KIOSK_08',p_session_uuid:session,saved_answer:'HEALTHY-NEIGHBOR'}};
 const model=memoryIndexedDb(version,original),ctx={assertCurrent(){}},valid={session_uuid:session,context_id:'ORIGINAL-CONTEXT',submission_proof:'ORIGINAL-PROOF'};
 model.records.get('mz_scan_queue').stores.get('actions').rows.set(2,clone(healthy));
 const writer=fixtureContext(model,[],null,writerKind==='v63'?previousSource:source),first=Error('first interruption');
 writer.exactSessionForPayload=()=>valid;
 writer.window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__=point=>{if(point===firstStage)throw first;};
 await assert.rejects(writer.openDb(ctx),e=>e===first);
 const recovery=fixtureContext(model),second=Error('recovery interruption');
 recovery.window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__=point=>{if(point===secondStage)throw second;};
 await assert.rejects(recovery.openDb(ctx),e=>e===second);
 const savedHeld=clone(model.records.get('mz_scan_queue').stores.get('actions').rows.get(1));
 assert.equal(savedHeld.recoverable,false);assert.deepEqual(savedHeld.preserved_original_record,original);
 const reopened=fixtureContext(model);reopened.exactSessionForPayload=()=>valid;
 await reopened.openDb(ctx);await reopened.openDb(ctx);
 const rows=[...model.records.get('mz_scan_queue').stores.get('actions').rows.values()];
 assert.deepEqual(rows.find(row=>row.id===1),savedHeld);
 assert.equal(reopened.nextClaimableAction(rows).operation_id,healthy.operation_id);
 assert(!model.records.has('mz_scan_queue_v6_to_v4_backup'));
 console.log('PASS recovery interruption retains exact quarantine and healthy neighbor',writerKind,version,firstStage,secondStage);
}

for(const corrupt of ['held-original','held-reason','held-binding']){
 const original={id:1,schema_version:4,type:'commit_workflow',operation_id:operation,created_at:1700000000000,
  payload:{p_device_id:'KIOSK_08',p_session_uuid:session,p_client_completion_id:operation,saved_answer:'KEEP'}};
 const model=memoryIndexedDb(5,original),ctx={assertCurrent(){}},writer=fixtureContext(model),first=Error('first');
 writer.exactSessionForPayload=()=>({session_uuid:session,context_id:'CONTEXT',submission_proof:'PROOF'});
 writer.window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__=point=>{if(point==='backup-verified')throw first;};
 await assert.rejects(writer.openDb(ctx),e=>e===first);
 const recovery=fixtureContext(model),second=Error('second');
 recovery.window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__=point=>{if(point==='fenced-v4-written')throw second;};
 await assert.rejects(recovery.openDb(ctx),e=>e===second);
 const primary=model.records.get('mz_scan_queue').stores.get('actions').rows.get(1);
 if(corrupt==='held-original')primary.preserved_original_record.payload.saved_answer='CHANGED';
 if(corrupt==='held-reason')primary.quarantine_reason='CHANGED';
 if(corrupt==='held-binding')primary.replay_binding={employee_id:'CHANGED'};
 const before=clone(primary);
 await assert.rejects(fixtureContext(model).openDb(ctx));
 assert(model.records.has('mz_scan_queue_v6_to_v4_backup'));
 assert.deepEqual(model.records.get('mz_scan_queue').stores.get('actions').rows.get(1),before);
 console.log('PASS changed held primary remains untouched with backup',corrupt);
}

for(const corrupt of ['captured-payload','captured-clock','captured-binding','duplicate-id','raw-original','primary-changed']){
 const original={id:1,schema_version:4,type:'finish_session',operation_id:operation,created_at:1700000000000,
  replay_binding:{employee_id:'PINNED-EMPLOYEE'},payload:{p_device_id:'KIOSK_08',p_session_uuid:session,saved_answer:'KEEP'}};
 const model=memoryIndexedDb(5,original),ctx={assertCurrent(){}},writer=fixtureContext(model,[],null,previousSource),stop=Error('capture');
 writer.window.__MZ_SCAN_SYNC_DOWNGRADE_TEST_HOOK__=point=>{if(point==='fenced-v4-written')throw stop;};
 await assert.rejects(writer.openDb(ctx),e=>e===stop);
 const backup=model.records.get('mz_scan_queue_v6_to_v4_backup'),metadata=backup.stores.get('metadata').rows.get('capture'),captured=JSON.parse(metadata.canonical_fenced_rows);
 if(corrupt==='captured-payload')captured[0].payload.saved_answer='CHANGED';
 if(corrupt==='captured-clock')captured[0].created_at=null;
 if(corrupt==='captured-binding')captured[0].replay_binding.employee_id='DIFFERENT';
 if(corrupt==='duplicate-id')captured.push(clone(captured[0]));
 if(corrupt==='raw-original')backup.stores.get('actions').rows.get(1).payload.saved_answer='CHANGED';
 if(corrupt==='primary-changed')model.records.get('mz_scan_queue').stores.get('actions').rows.get(1).payload.saved_answer='CHANGED';
 metadata.canonical_fenced_rows=writer.canonicalRows(captured);
 const before=clone([...model.records.get('mz_scan_queue').stores.get('actions').rows.values()]);
 await assert.rejects(fixtureContext(model).openDb(ctx));
 assert(model.records.has('mz_scan_queue_v6_to_v4_backup'));
 assert.deepEqual([...model.records.get('mz_scan_queue').stores.get('actions').rows.values()],before);
 console.log('PASS malformed or changed backup remains held',corrupt);
}
