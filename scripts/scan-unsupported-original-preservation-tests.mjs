// Offline audit probe only. Immutable owner functions; synthetic IndexedDB and transport.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(process.env.SCAN_SYNC_SOURCE||new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
const segment=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start);return source.slice(start,end);};
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
const output=[];
for(const dbVersion of [4,5,6]) for(const kind of ['future','opaque-legacy','valid-current','valid-legacy']) {
  const original={id:1,schema_version:99,type:'finish_session',operation_id:operation,created_at:1700000000000,last_error:'ORIGINAL-DIAGNOSTIC',payload:{p_device_id:'KIOSK_08',p_session_uuid:session,saved_answer:'SAVED-ANSWER'}};
  if(kind==='opaque-legacy'){original.schema_version=4;original.type='start_session';original.operation_id='LEGACY-OPERATION-42';}
  if(kind==='valid-current')original.schema_version=6;
  if(kind==='valid-legacy')original.schema_version=4;
  const held=kind==='future'||kind==='opaque-legacy';
  const model=memoryIndexedDb(dbVersion,original),calls=[];
  const stop=Object.assign(new Error('Audit stops at transport boundary'),{code:'AUDIT_STOP'});
  const c={CONFIG:{DB_NAME:'mz_scan_queue',STORE_NAME:'actions',DB_VERSION:4,MAX_KNOWN_DB_VERSION:6,SCHEMA_VERSION:6,ROLLBACK_BACKUP_DB_NAME:'mz_scan_queue_v6_to_v4_backup',REQUIRED_SCAN_CONTRACT_VERSION:'scan.v4.snapshot-bound-authority',API_URL:'/rpc'},window:{setTimeout},indexedDB:model.indexedDB,structuredClone,state:{db:null,deviceId:'KIOSK_08'},nativeQueueSecurityRequired:true,queueMutationSecurity:()=>({}),exactSessionForPayload:()=>null,storageFailure:(context,error)=>Object.assign(new Error(context+': '+error.message),{cause:error}),fetch:async(url,args)=>{calls.push({url,body:JSON.parse(args.body)});throw stop;}};
  vm.createContext(c);
  vm.runInContext(segment('  function safeText(','  function canonicalJson(')+segment('  function operationIdFor(','  function listActions(')+segment('  async function rpc(','  async function persistServerCompletionReceipt(')+segment('  async function verifiedServerCompletionReceipt(','  function processResultFailure('),c);
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
