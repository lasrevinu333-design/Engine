import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';

// Exact historical producer + actual migration/read/claim, synthetic IDB adapter.
const source=readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
const prior=readFileSync(new URL('./fixtures/scan-retry-prior-producer-20260924.js',import.meta.url),'utf8');
const slice=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
const epoch=Date.UTC(2026,8,24,12);let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
function fixture(implementation){
  const records=new Map();let at=epoch;
  const context=vm.createContext({Date,Math:Object.assign(Object.create(Math),{random:()=>0}),
    CONFIG:{STORE_NAME:'actions',SCHEMA_VERSION:6,MAX_RETRIES:50,LEASE_MS:60000,REQUIRED_SCAN_CONTRACT_VERSION:'scan.v4.snapshot-bound-authority'},
    now:()=>at,safeText:x=>String(x??'').trim(),crypto:{randomUUID},exactSessionForPayload:()=>null,
    isUuid:x=>/^[a-f0-9-]{36}$/i.test(x),mutateProtectedQueue:fn=>fn({generation:4}),
    isTerminalReconciliation:()=>false,applyProcessResult:()=>{throw Error('No accepted-result simulation');},
    migrateLegacyRecord:()=>{throw Error('This fixture does not claim old-schema migration proof');},
    state:{workerId:'worker',db:{version:4,transaction(){const tx={};let request;
      const one=result=>{request={result};queueMicrotask(()=>{request.onsuccess();tx.oncomplete?.();});return request;};
      tx.objectStore=()=>({get:id=>one(structuredClone(records.get(id))),getAll:()=>one([...records.values()].map(r=>structuredClone(r))),
        put:r=>records.set(r.id,structuredClone(r)),delete:()=>{throw Error('Migration must not delete');},
        openCursor:()=>{const ids=[...records.keys()];request={};let index=0;
          const next=()=>queueMicrotask(()=>{const id=ids[index++];
            request.result=id===undefined?null:{value:structuredClone(records.get(id)),update:r=>records.set(id,structuredClone(r)),continue:next};
            request.onsuccess();if(id===undefined)tx.oncomplete();});next();return request;}});return tx;}}}});
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
const owning=slice('  function operationIdFor(','  function downgradeTransition(')+
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
