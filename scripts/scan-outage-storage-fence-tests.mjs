import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

// Actual normalize/storage/claim/settle chain; the IndexedDB transaction adapter
// is synthetic. This is NOT browser crash durability or authenticated acceptance.
const source=readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
function slice(from,to){const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const implementation=[slice('  function operationIdFor(','  function downgradeTransition('),
  slice('  function claimNextAction(','  function releaseClaimWithoutAttempt('),
  slice('  function finishClaim(','  function parseRetryAfter(')].join('\n');
let clock=1780000000000,checks=0,applied=0;
const records=new Map();
const context=vm.createContext({CONFIG:{STORE_NAME:'actions',MAX_RETRIES:50,LEASE_MS:60000,SCHEMA_VERSION:6,
  REQUIRED_SCAN_CONTRACT_VERSION:'scan.v4.snapshot-bound-authority'},now:()=>clock,safeText:x=>String(x??'').trim(),
  isUuid:x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x),
  crypto:{randomUUID},exactSessionForPayload:()=>null,
  isTerminalReconciliation:()=>false,applyProcessResult:()=>{applied++;},
  mutateProtectedQueue:operation=>operation({generation:4}),
  state:{workerId:'synthetic-worker',db:{transaction(){let request;const tx={};
    tx.objectStore=()=>({get:id=>(request={result:structuredClone(records.get(id))}),
      getAll:()=>(request={result:[...records.values()].map(x=>structuredClone(x))}),
      put:row=>records.set(row.id,structuredClone(row)),delete:id=>records.delete(id)});
    queueMicrotask(()=>{request.onsuccess();tx.oncomplete();});return tx;}}},
  Math:Object.assign(Object.create(Math),{random:()=>0})});
vm.runInContext(implementation,context);
const original={id:1,type:'commit_workflow',operation_id:randomUUID(),client_id:randomUUID(),
  semantic_fingerprint:'b'.repeat(64),payload:{p_client_session_id:randomUUID(),p_device_id:'SYNTHETIC_PHONE',
    p_response_json:{work_result:'check_only',services_performed:[]}},created_at:clock,state:'pending'};
records.set(1,structuredClone(context.storageRecord(original)));
function check(value,expected,label){assert.deepEqual(value,expected,label);checks++;}
for(let attempt=1;attempt<=150;attempt++){
  const item=await context.claimNextAction();check(item?.id,1,'exact saved operation claimed');
  check(await context.claimNextAction(),null,'live lease cannot be concurrently claimed');
  await context.finishClaim(item,{succeeded:false,error:'HTTP 503',automaticRetry:true});
  const raw=records.get(1),normal=context.normalizeRecord(raw);
  check(raw.dead_letter,true,'older workers remain fenced');
  check(raw.type,'forward-replay-fenced:commit_workflow','older action type remains fenced');
  check(normal.dead_letter,false,'current worker remains eligible after outage');
  check(normal.retry_count,attempt,'retry count preserved through actual storage normalization');
  check(normal.operation_id,original.operation_id,'operation identity unchanged');
  check(JSON.stringify(normal.payload),JSON.stringify(original.payload),'original submitted work unchanged');
  check(normal.semantic_fingerprint,original.semantic_fingerprint,'semantic binding retained');
  check(await context.claimNextAction(),null,'retry delay prevents busy loop');
  clock=normal.next_attempt_at;
}
const recovered=await context.claimNextAction();
await context.finishClaim(recovered,{succeeded:true,result:{status:'closed'}});
check(records.size,0,'accepted result retires exact saved item');check(applied,1,'result applied once');
check(await context.claimNextAction(),null,'no duplicate after acceptance');

records.set(1,structuredClone(context.storageRecord({...original,retry_count:150,dead_letter:true,state:'dead-letter'})));
check(await context.claimNextAction(),null,'old held work is not automatically resurrected');
check(records.size,1,'old held evidence remains retained');
console.log(JSON.stringify({status:'PASS_SCAN_OUTAGE_STORAGE_FENCE',checks,attempts:150,
  limits:'Actual queue normalization/storage fence/claim/settlement; synthetic transaction and result boundary. No browser, device, native receipt, production or independent acceptance.'}));
