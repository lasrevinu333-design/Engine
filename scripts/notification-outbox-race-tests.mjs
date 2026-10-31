import assert from 'node:assert/strict';
import {
  createNotificationOutboxFlusher,
  settleNotificationOutboxRow,
} from '../mobile/src/custodial/notification-receipts.js';

const pending = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

if (process.env.EVENT_OPEN_CASE) {
  await eventOpenCase(process.env.EVENT_OPEN_CASE);
} else if (process.env.NOTIFICATION_SETTLEMENT_CASE) {
  if (process.env.NOTIFICATION_SETTLEMENT_CASE === 'affected-existing-members') {
    await affectedSettlementMembers();
    console.log(JSON.stringify({case:'affected-existing-members',result:'PASS',scope:'only owning settlement fixture migrated to original runtime binding; unchanged flusher concurrency/recovery group NOT_RUN'}));
  } else await originalSettlementCase(process.env.NOTIFICATION_SETTLEMENT_CASE);
} else {
// Native arrival, app resume and network restoration may all request a drain
// while the same HTTP request is outstanding. They must not send it in parallel.
const first = pending();
let passes = 0;
let active = 0;
let maxActive = 0;
const flush = createNotificationOutboxFlusher(async () => {
  passes += 1;
  active += 1;
  maxActive = Math.max(maxActive, active);
  if (passes === 1) await first.promise;
  active -= 1;
});
const arrival = flush();
await Promise.resolve();
assert.equal(passes, 1);
const resumed = flush();
first.resolve();
await Promise.all([arrival, resumed]);
assert.equal(passes, 2, 'a request arriving mid-flight receives a later pass');
assert.equal(maxActive, 1, 'the two callbacks never run concurrent delivery passes');

await affectedSettlementMembers();

let fail = true;
const recover = createNotificationOutboxFlusher(async () => {
  if (fail) throw new Error('temporary transport failure');
});
await assert.rejects(recover(), /temporary transport failure/);
fail = false;
await recover();

console.log(JSON.stringify({scope:'native notification outbox callback and stale-row races',
  pass:8, maxConcurrentDeliveryPasses:maxActive}));
}

async function affectedSettlementMembers() {
// The newly affected settlement fixture must use a real original/actor/route
// and the existing runtime admission, not the historical bare mutation stub.
const owning = await originalSettlementCase('fixture-only');
const {storage, key, row, encoded, seed} = owning;
let origin;
const settle = options => settleNotificationOutboxRow({...owning.args, ...options, origin,
  response:options.delivered === true ? owning.response : null,
  failure:options.delivered === false ? 'NOT_DELIVERED' : undefined});
seed(encoded);
origin = owning.capture();

assert.equal(await settle({delivered:true}), true);
assert.equal(storage.getItem(key), null);
assert.equal(await settle({delivered:false}), false);
assert.equal(storage.getItem(key), null, 'late failed sender cannot resurrect a settled receipt');

seed(encoded);
origin = owning.capture();
const replacement = JSON.stringify({...row, attempts:1, marker:'newer'});
seed(replacement);
assert.equal(await settle({delivered:true}), false);
assert.equal(storage.getItem(key) === replacement, true, 'late success cannot erase a newer row');

seed(encoded);
origin = owning.capture(); // Original capture precedes the competing retry.
seed(JSON.stringify({...row, attempts:1,
  last_attempt_at:'2026-10-02T04:00:00.000Z'}));
assert.equal(await settle({delivered:true}), true);
assert.equal(storage.getItem(key), null, 'success settles the same operation despite a competing retry increment');

seed(encoded);
origin = owning.capture();
assert.equal(await settle({delivered:false,
  now:()=> '2026-10-02T04:00:00.000Z'}), true);
assert.equal(storage.getItem(key) === JSON.stringify({...row, attempts:1,
  last_attempt_at:'2026-10-02T04:00:00.000Z'}), true);
}

async function originalSettlementCase(name) {
  const domain=await import('../mobile/src/custodial/notification-receipts.js');
  const {getCustodialBridgeSecurityRuntime}=await import('../mobile/src/custodial/security-runtime.js');
  const {createRawStorageAdapter}=await import('../mobile/src/custodial/storage-firewall.js');
  const {CUSTODIAL_DEVICE_KEYS,CUSTODIAL_INSTALLATION_MARKER_KEY,CUSTODIAL_INSTALLATION_RECORD_KEY}=
    await import('../mobile/src/custodial/credential-store.js');
  const {principalIdentity}=await import('../mobile/src/custodial/protected-principal.js');
  const {webcrypto}=await import('node:crypto');
  const id=n=>'bd000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const legacyPrincipal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),
    credential_id:id(2),credential_operation_id:id(3),assignment_epoch:7,
    installation_seal:'SYNTHETIC_INSTALLATION_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
  const p=name==='valid-v2-origin'?{schema_version:'custodial-protected-principal.v2',
    device_id:legacyPrincipal.device_id,employee_id:legacyPrincipal.employee_id,credential_id:legacyPrincipal.credential_id,
    assignment_epoch:legacyPrincipal.assignment_epoch,activation_operation_id:id(3),activation_receipt_sha256:'a'.repeat(64),
    legacy_binding_id:id(6),legacy_binding_kind:'authenticated_legacy_installation_observation',
    installation_binding_sha256:'b'.repeat(64),installation_seal:legacyPrincipal.installation_seal,
    enrolled_at:legacyPrincipal.enrolled_at}:legacyPrincipal;
  const HOLD='mz_custodial_protected_browser_hold.v1';
  let fault='',armRead=false,changes=0,lockOwned=false,waiting=false,release;
  class Storage {
    constructor(){this.rows=new Map();}
    get length(){return this.rows.size;}
    key(i){return [...this.rows.keys()][i]??null;}
    getItem(k){
      const value=this.rows.get(k)??null;
      if(armRead&&k.startsWith('mz_native_notification_outbox:')&&fault==='hold-on-read')
        raw.setItem(HOLD,'{foreign hold during original readback');
      return value;
    }
    setItem(k,v){if(k.startsWith('mz_native_notification_outbox:')){
      if(fault==='drop-set')return;if(fault==='throw-set')throw Error('Synthetic original write unavailable');changes++;
    }this.rows.set(k,String(v));}
    removeItem(k){if(k.startsWith('mz_native_notification_outbox:')){
      if(fault==='drop-remove')return;if(fault==='throw-remove')throw Error('Synthetic original removal unavailable');changes++;
    }this.rows.delete(k);}
    clear(){this.rows.clear();}
  }
  const storage=new Storage(),raw=createRawStorageAdapter(storage),secure=new Map();
  for(const k of CUSTODIAL_DEVICE_KEYS)raw.setItem(k,p.device_id);
  raw.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY,p.installation_seal);
  secure.set(CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify({schema_version:1,
    credential:'SYNTHETIC_NOT_A_DEVICE_CREDENTIAL',device_id:p.device_id,
    installation_seal:p.installation_seal,enrolled_at:p.enrolled_at,principal:p}));
  const locks={async request(name,options,callback){assert.equal(lockOwned,false);
    if(waiting)await new Promise(r=>{release=r;});
    lockOwned=true;try{return await callback({name,mode:options.mode});}finally{lockOwned=false;}}};
  const runtime=getCustodialBridgeSecurityRuntime({storage,locks,cryptoApi:webcrypto,indexedDb:{databases:async()=>[]},
    secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
  await runtime.security.ready;assert.equal(runtime.security.getStatus().ready,true);
  const row=domain.createNativeNotificationReceipt({data:{kind:'employee_location_status',notification_key:'synthetic-notification',
    receipt_job_id:id(4),receipt_credential_id:p.credential_id,receipt_employee_id:p.employee_id,
    receipt_assignment_epoch:String(p.assignment_epoch),receipt_device_id:p.device_id},action:'opened',deviceId:p.device_id,
    createdAt:'2026-01-01T00:00:00.000Z'});
  const key='mz_native_notification_outbox:'+row.id,encoded=JSON.stringify(row);
  raw.setItem(key,encoded);changes=0;
  let live=p,generation=runtime.security.getStatus().generation;
  const readers={getPrincipal:()=>live,getPrincipalIdentity:()=>principalIdentity(live),getGeneration:()=>generation};
  const origin=domain.captureNotificationOutboxSettlementOrigin?.({storage,key,encoded,row,
    expectedPrincipalIdentity:principalIdentity(p),expectedGeneration:generation,...readers});
  const request=domain.nativeNotificationReceiptRequest(row);
  const response={ok:true,data:{id:id(5),device_identifier:p.device_id,notification_key:row.notification_key,
    notification_type:row.notification_type,credential_id:p.credential_id,employee_id:p.employee_id,
    assignment_epoch:p.assignment_epoch,notification_job_id:row.receipt_binding.job_id,
    opened_at:'2026-01-01T00:00:00.000000+00:00'},meta:{synthetic:true}};
  const args={storage,mutate:runtime.security.mutateProtectedWork,key,encoded,row,origin,request,response,delivered:true,
    now:()=> '2026-01-01T00:00:00.000Z'};
  const originalIntact=()=>storage.rows.get(key)===encoded; // Never log original row/body.
  // Fixture seeding models a competing writer. Product settlement still uses
  // the actual protected runtime; public Storage writes must remain blocked.
  if(name==='fixture-only')return {storage,key,row,encoded,args,response,seed:value=>raw.setItem(key,value),
    capture:()=>domain.captureNotificationOutboxSettlementOrigin({storage,key,encoded,row,
      expectedPrincipalIdentity:principalIdentity(p),expectedGeneration:generation,...readers})};
  try {
    if(name==='successor-delivered'||name==='successor-retry'){
      await Promise.resolve(); // Models original owning HTTP await, no transport.
      live={...p,employee_id:id(9),credential_id:id(10),assignment_epoch:8};generation++;
      if(name==='successor-retry')Object.assign(args,{delivered:false,response:null,failure:'NOT_DELIVERED'});
      assert.equal(await domain.settleNotificationOutboxRow(args),false);
      assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='missing-origin'||name==='bare-delivered'||name==='unknown-receipt'){
      if(name==='missing-origin')delete args.origin;
      if(name==='bare-delivered')delete args.response;
      if(name==='unknown-receipt')args.response={ok:true,data:{provider_accepted:true}};
      assert.equal(await domain.settleNotificationOutboxRow(args),false);assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='generation-aba'){
      live={...p,assignment_epoch:8};generation++;live=p;generation++;
      assert.equal(await domain.settleNotificationOutboxRow(args),false);assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='hold-on-read'){
      fault='hold-on-read';armRead=true;
      let result;try{result=await domain.settleNotificationOutboxRow(args);}catch{result=false;}
      assert.equal(result,false);assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='unknown-current-principal'){
      live=null;
      assert.equal(await domain.settleNotificationOutboxRow(args),false);assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='forged-origin'||name==='changed-original-argument'){
      if(name==='forged-origin')args.origin=Object.freeze({expectedPrincipalIdentity:principalIdentity(p),expectedGeneration:generation});
      else args.row={...row,action:'acknowledged'};
      assert.equal(await domain.settleNotificationOutboxRow(args),false);assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='origin-reuse-unconfirmed'){
      fault='drop-remove';
      assert.equal(await domain.settleNotificationOutboxRow(args),false);
      fault='';
      assert.equal(await domain.settleNotificationOutboxRow(args),false);
      assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='auth-denied-preserved'){
      Object.assign(args,{delivered:false,response:null,failure:'AUTH_DENIED'});
      assert.equal(await domain.settleNotificationOutboxRow(args),false);assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='valid-original-delivery'||name==='valid-v2-origin'){
      assert.equal(await domain.settleNotificationOutboxRow(args),true);
      assert.equal(storage.rows.has(key),false);assert.equal(changes,1);
    }else if(name==='valid-original-retry'){
      Object.assign(args,{delivered:false,response:null,failure:'NOT_DELIVERED'});
      assert.equal(await domain.settleNotificationOutboxRow(args),true);
      const saved=JSON.parse(storage.rows.get(key));
      assert.equal(saved.attempts,1);
      const {attempts,last_attempt_at,...rest}=saved, {attempts:oldAttempts,...original}=row;
      assert.equal(JSON.stringify(rest)===JSON.stringify(original),true);assert.equal(changes,1);
    }else if(name==='unknown-outcome'){
      Object.assign(args,{delivered:false,response:null,failure:'OUTCOME_UNKNOWN'});
      assert.equal(await domain.settleNotificationOutboxRow(args),false);
      assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='wrong-route'||name==='wrong-body'||name==='wrong-ack-job'){
      if(name==='wrong-route')args.request={...request,path:'/employee-notifications-api/opened'};
      if(name==='wrong-body')args.request={...request,body:{...request.body,action:'acknowledged'}};
      if(name==='wrong-ack-job')args.response={...response,data:{...response.data,notification_job_id:id(8)}};
      assert.equal(await domain.settleNotificationOutboxRow(args),false);assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='gate-held'){
      raw.setItem(HOLD,'{unknown held preservation');
      assert.equal(await domain.settleNotificationOutboxRow(args),false);assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='queued-principal-change'){
      waiting=true;const writing=domain.settleNotificationOutboxRow(args);
      await new Promise(r=>setImmediate(r));
      live={...p,employee_id:id(9),credential_id:id(10),assignment_epoch:8};generation++;
      release?.();waiting=false;
      assert.equal(await writing,false);assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='foreign-replacement'){
      const replacement=JSON.stringify({...row,receipt_binding:{...row.receipt_binding,job_id:id(8)}});
      raw.setItem(key,replacement);changes=0;
      assert.equal(await domain.settleNotificationOutboxRow(args),false);assert.equal(storage.rows.get(key)===replacement,true);assert.equal(changes,0);
    }else if(name==='competing-retry-original'){
      raw.setItem(key,JSON.stringify({...row,attempts:1,last_attempt_at:'2026-01-01T00:00:00.000Z'}));changes=0;
      assert.equal(await domain.settleNotificationOutboxRow(args),true);assert.equal(storage.rows.has(key),false);assert.equal(changes,1);
    }else if(name==='unconfirmed-remove'||name==='unconfirmed-set'){
      fault=name==='unconfirmed-remove'?'drop-remove':'drop-set';
      if(name==='unconfirmed-set')Object.assign(args,{delivered:false,response:null,failure:'NOT_DELIVERED'});
      assert.equal(await domain.settleNotificationOutboxRow(args),false);assert.equal(originalIntact(),true);assert.equal(changes,0);
    }else if(name==='legacy-preserved'){
      const legacy={...row,schema_version:'native-notification-outbox.v2'};
      const legacyRaw=JSON.stringify(legacy);raw.setItem(key,legacyRaw);changes=0;
      const legacyOrigin=domain.captureNotificationOutboxSettlementOrigin?.({storage,key,encoded:legacyRaw,row:legacy,
        expectedPrincipalIdentity:principalIdentity(p),expectedGeneration:generation,...readers});
      assert.equal(legacyOrigin,null);
      assert.equal(await domain.settleNotificationOutboxRow({...args,row:legacy,encoded:legacyRaw,origin:legacyOrigin}),false);
      assert.equal(storage.rows.get(key)===legacyRaw,true);assert.equal(changes,0);
    }else throw Error('Unknown owning case');
    console.log(JSON.stringify({case:name,result:'PASS',scope:'actual settlement/runtime/admission; synthetic current-principal/generation readers/storage/locks, no HTTP/native successor or provider proof'}));
  }finally{release?.();assert.equal(lockOwned,false);}
}

// Event-only member. Actual domain, principal parser, credential runtime and
// protected browser admission execute; all storage/locks/principal changes and
// server replies below are explicit synthetic seams, NOT native/auth/SQL proof.
async function eventOpenCase(name) {
  const {createEventNotificationOpenOutbox}=await import('../mobile/src/custodial/event-notification-receipts.js');
  const {getCustodialBridgeSecurityRuntime}=await import('../mobile/src/custodial/security-runtime.js');
  const {createRawStorageAdapter}=await import('../mobile/src/custodial/storage-firewall.js');
  const {CUSTODIAL_DEVICE_KEYS,CUSTODIAL_INSTALLATION_MARKER_KEY,CUSTODIAL_INSTALLATION_RECORD_KEY}=await import('../mobile/src/custodial/credential-store.js');
  const {webcrypto}=await import('node:crypto');
  if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
  const id=n=>'ce000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const legacy={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
    credential_operation_id:id(3),assignment_epoch:7,installation_seal:'SYNTHETIC_INSTALLATION_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
  const principal=name==='v2-original'?{schema_version:'custodial-protected-principal.v2',device_id:legacy.device_id,employee_id:legacy.employee_id,
    credential_id:legacy.credential_id,assignment_epoch:legacy.assignment_epoch,activation_operation_id:id(3),activation_receipt_sha256:'a'.repeat(64),
    legacy_binding_id:id(6),legacy_binding_kind:'authenticated_legacy_installation_observation',installation_binding_sha256:'b'.repeat(64),
    installation_seal:legacy.installation_seal,enrolled_at:legacy.enrolled_at}:legacy;
  const PREFIX='mz_native_notification_outbox:event-open.v1:',HOLD='mz_custodial_protected_browser_hold.v1';
  let fault='',onRead=null,changes=0,lockOwned=false,queued=false,release,mutateFalse=false;
  class Storage {
    rows=new Map();
    get length(){return this.rows.size;}
    key(index){return [...this.rows.keys()][index]??null;}
    getItem(key){const value=this.rows.get(key)??null;if(key.startsWith(PREFIX))onRead?.();return value;}
    setItem(key,value){if(key.startsWith(PREFIX)&&fault==='drop-set')return;
      if(key.startsWith(PREFIX)&&fault==='throw-before-set')throw Error('Synthetic write unknown');
      this.rows.set(key,String(value));if(key.startsWith(PREFIX)){changes++;if(fault==='throw-after-set')throw Error('Synthetic write unknown after memory effect');}}
    removeItem(key){if(key.startsWith(PREFIX)&&fault==='drop-remove')return;
      if(key.startsWith(PREFIX)&&fault==='throw-before-remove')throw Error('Synthetic remove unknown');
      this.rows.delete(key);if(key.startsWith(PREFIX)){changes++;if(fault==='throw-after-remove')throw Error('Synthetic remove unknown after memory effect');}}
    clear(){this.rows.clear();}
  }
  const storage=new Storage(),raw=createRawStorageAdapter(storage),secure=new Map();
  for(const key of CUSTODIAL_DEVICE_KEYS)raw.setItem(key,principal.device_id);
  raw.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY,principal.installation_seal);
  secure.set(CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify({schema_version:1,credential:'SYNTHETIC_NOT_A_DEVICE_CREDENTIAL',
    device_id:principal.device_id,installation_seal:principal.installation_seal,enrolled_at:principal.enrolled_at,principal}));
  const locks={async request(lockName,options,callback){if(queued)await new Promise(done=>{release=done;});
    assert.equal(lockOwned,false);lockOwned=true;try{return await callback({name:lockName,mode:options.mode});}finally{lockOwned=false;}}};
  const runtime=getCustodialBridgeSecurityRuntime({storage,locks,cryptoApi:webcrypto,indexedDb:{databases:async()=>[]},
    secureStorage:{get:async key=>secure.get(key)??null,set:async(key,value)=>secure.set(key,value),remove:async key=>secure.delete(key)}});
  await runtime.security.ready;assert.equal(runtime.security.getStatus().ready,true);
  let live=runtime.security.getStatus().principal,generation=runtime.security.getStatus().generation;
  const options={storage,getPrincipal:()=>live,getGeneration:()=>generation,
    mutate:async (...args)=>{const result=await runtime.security.mutateProtectedWork(...args);return mutateFalse?false:result;}};
  const domain=createEventNotificationOpenOutbox(options);
  const binding={instance_id:id(10),notification_key:`event:${id(11)}:shift_plus_15:2026-10-12:7`,event_id:id(11),notification_kind:'shift_plus_15',
    credential_id:principal.credential_id,employee_id:principal.employee_id,device_id:id(12),device_identifier:principal.device_id,assignment_epoch:principal.assignment_epoch};
  const serverRow={...binding,scheduled_for:'2026-10-12T14:15:00.000000+00:00',state:'sent',sent_at:'2026-10-12T14:15:01.000000+00:00',
    opened_at:null,event_revision:4,event_validity:'CURRENT'};
  const receipt={schema:'custodial.employee-event-open-receipt.v1',...binding,state:'opened',opened_at:'2026-10-12T14:16:00.123456+00:00'};
  const opened={...serverRow,state:'opened',opened_at:receipt.opened_at,open_receipt:receipt};
  const observe=async(rows=[serverRow])=>{const read=await domain.beginCurrentEventsRead();assert.equal(Boolean(read),true);return domain.acceptCurrentEventsRead(read.token,rows);};
  const entries=()=>[...storage.rows].filter(([key])=>key.startsWith(PREFIX));
  const only=()=>{const rows=entries();assert.equal(rows.length,1);return rows[0];};
  const prepare=()=>domain.prepareOpen(binding.notification_key);
  const dispatch=async()=>{const token=await prepare();assert.equal(Boolean(token),true);const request=await domain.beginOpenDispatch(token);assert.equal(Boolean(request),true);return {token,request};};
  const recover=async token=>{const read=domain.beginOriginalReadback(token);assert.equal(Boolean(read),true);assert.equal(read.request.method,'GET');
    assert.equal(read.request.path.endsWith(encodeURIComponent(binding.notification_key)),true);return domain.settleOriginalReadback(read.token,[opened]);};
  try {
    if(name==='producer-boundary-contract') {
      const wrongTime={...receipt,opened_at:'2026-10-12T14:14:00.000000+00:00'};
      const specimens=[['nonproducer-uuid',{...serverRow,event_id:id(11).replace('-4000-','-7000-')}],
        ['sent-already-open-time',{...serverRow,opened_at:receipt.opened_at}],
        ['opened-null-sent',{...opened,sent_at:null}],
        ['opened-before-sent',{...opened,opened_at:wrongTime.opened_at,open_receipt:wrongTime}],
        ['zero-year-source',{...serverRow,scheduled_for:'0000-10-12T14:15:00Z'}]];
      const accepted=[];for(const [label,row]of specimens)if(await observe([row]))accepted.push(label);
      if(accepted.length)console.log(JSON.stringify({case:name,unconfirmedProducerBoundaries:accepted}));
      assert.equal(accepted.length,0);assert.equal(entries().length,0);
      assert.equal(await observe(),true);const {token}=await dispatch();
      assert.equal((await domain.settleOriginalOpened(token,wrongTime)).state,'PENDING');
      assert.equal((await domain.settleOriginalOpened(token,{...receipt,opened_at:'0000-10-12T14:16:00Z'})).state,'PENDING');
      assert.equal((await domain.settleOriginalOpened(token,receipt)).state,'OPENED');assert.equal(entries().length,0);
    }else if(['source-missing','source-malformed','source-foreign','source-duplicate','source-withheld','source-unknown','source-sent-null-time'].includes(name)) {
      if(name!=='source-missing'){
        let rows=[serverRow];if(name==='source-malformed'){rows=[{...serverRow,assignment_epoch:'7'}];}
        if(name==='source-foreign')rows=[{...serverRow,employee_id:id(90)}];
        if(name==='source-duplicate')rows=[serverRow,{...serverRow}];
        if(name==='source-withheld')rows=[{...serverRow,event_validity:'WITHHELD'}];
        if(name==='source-unknown')rows=[{...serverRow,event_validity:'UNKNOWN'}];
        if(name==='source-sent-null-time')rows=[{...serverRow,sent_at:null}];
        const accepted=await observe(rows);assert.equal(accepted,['source-withheld','source-unknown'].includes(name));
      }
      assert.equal(await prepare(),null);assert.equal(entries().length,0);
    }else if(name==='stale-source-read'){
      const first=await domain.beginCurrentEventsRead(),second=await domain.beginCurrentEventsRead();
      assert.equal(domain.acceptCurrentEventsRead(first.token,[serverRow]),false);
      assert.equal(domain.acceptCurrentEventsRead(second.token,[serverRow]),true);
      assert.equal(domain.unavailableCurrentEvents(first.token),false);assert.equal(Boolean(await prepare()),true);
    }else {
      assert.equal(await observe(),true);
      if(name==='immutable-source-original'){
        serverRow.employee_id=id(99);serverRow.notification_key='edited-card-key';
        assert.equal(await domain.prepareOpen({...binding}),null);const original=await dispatch();
        assert.equal(JSON.stringify(original.request.body)===JSON.stringify({notification_key:binding.notification_key}),true);
        assert.equal((await domain.settleOriginalOpened(original.token,receipt)).state,'OPENED');
      }else if(['drop-create','throw-create','memory-only-create','false-admission-create'].includes(name)){
        fault=name==='drop-create'?'drop-set':name==='throw-create'?'throw-before-set':name==='memory-only-create'?'throw-after-set':'';
        mutateFalse=name==='false-admission-create';assert.equal(await prepare(),null);
        const captured=entries()[0]?.[1];fault='';mutateFalse=false;
        const other=createEventNotificationOpenOutbox(options),read=await other.beginCurrentEventsRead();
        assert.equal(Boolean(read),true);assert.equal(other.acceptCurrentEventsRead(read.token,[serverRow]),true);
        const token=await other.prepareOpen(binding.notification_key);assert.equal(Boolean(token),true);
        if(captured!==undefined)assert.equal(only()[1]===captured,true);
        const request=await other.beginOpenDispatch(token);assert.equal(Boolean(request),true);
        assert.equal(request.headers['Idempotency-Key']===`employee-event-open:${binding.instance_id}:${binding.credential_id}:7:opened`,true);
        assert.equal(JSON.stringify(request.body)===JSON.stringify({notification_key:binding.notification_key}),true);
      }else if(name==='dispatch-marker-drop'){
        const token=await prepare();fault='drop-set';assert.equal(await domain.beginOpenDispatch(token),null);fault='';
        const again=await prepare();assert.equal(Boolean(again),true);assert.equal(await domain.beginOpenDispatch(again),null);
        assert.equal((await recover(again)).state,'OPENED');assert.equal(entries().length,0);
      }else if(name==='queued-successor'){
        const {token}=await dispatch();queued=true;const settling=domain.settleOriginalOpened(token,receipt);
        await new Promise(done=>setImmediate(done));live={...principal,employee_id:id(90),credential_id:id(91),assignment_epoch:8};generation++;
        queued=false;release?.();assert.equal((await settling).state,'PENDING');assert.equal(entries().length,1);
      }else if(name==='source-change-during-storage-read'){
        const {token}=await dispatch();const before=only()[1];onRead=()=>{onRead=null;void domain.beginCurrentEventsRead();};
        assert.equal((await domain.settleOriginalOpened(token,receipt)).state,'PENDING');assert.equal(only()[1]===before,true);
      }else if(name==='gate-held'){
        const {token}=await dispatch();raw.setItem(HOLD,'{synthetic held preservation');
        assert.equal((await domain.settleOriginalOpened(token,receipt)).state,'PENDING');assert.equal(entries().length,1);
      }else if(name==='changed-source-revision'){
        const {token}=await dispatch();assert.equal(await observe([{...serverRow,event_revision:5}]),true);
        assert.equal((await domain.settleOriginalOpened(token,receipt)).state,'PENDING');assert.equal(await prepare(),null);assert.equal(entries().length,1);
      }else if(name==='legacy-preserved'){
        const legacyKey='mz_native_notification_outbox:employee_event:legacy',legacyRow=JSON.stringify({schema_version:'native-notification-outbox.v1',kind:'employee_event',notification_key:binding.notification_key});
        raw.setItem(legacyKey,legacyRow);const token=await prepare();assert.equal(Boolean(token),true);
        assert.equal((await domain.pendingOriginals()).length,1);assert.equal(storage.rows.get(legacyKey)===legacyRow,true);
      }else if(name==='foreign-outbox-replacement'){
        const {token}=await dispatch(),[key,encoded]=only();const value=JSON.parse(encoded);value.binding.employee_id=id(99);const foreign=JSON.stringify(value);raw.setItem(key,foreign);
        assert.equal((await domain.settleOriginalOpened(token,receipt)).state,'PENDING');assert.equal(storage.rows.get(key)===foreign,true);
      }else if(['drop-remove','throw-remove','memory-only-remove'].includes(name)){
        const {token}=await dispatch();fault=name==='drop-remove'?'drop-remove':name==='throw-remove'?'throw-before-remove':'throw-after-remove';
        assert.equal((await domain.settleOriginalOpened(token,receipt)).state,'PENDING');fault='';
        assert.equal(await domain.beginOpenDispatch(token),null);assert.equal((await recover(token)).state,'OPENED');assert.equal(entries().length,0);
      }else if(['fixed-key-not-in-list','offline-readback-keeps-original','new-source-read-supersedes-recovery'].includes(name)){
        const {token}=await dispatch();const before=only()[1];
        if(name==='new-source-read-supersedes-recovery') {
          const read=domain.beginOriginalReadback(token);assert.equal(Boolean(read),true);
          assert.equal(await observe([{...serverRow,event_revision:5}]),true);
          assert.equal((await domain.settleOriginalReadback(read.token,[opened])).state,'PENDING');assert.equal(only()[1]===before,true);
        }else {
          if(name==='fixed-key-not-in-list')assert.equal(await observe([]),true);
          else {const read=await domain.beginCurrentEventsRead();assert.equal(domain.unavailableCurrentEvents(read.token),true);}
          const originals=await domain.pendingOriginals();assert.equal(originals.length,1);
          const read=domain.beginOriginalReadback(originals[0]);assert.equal(Boolean(read),true);
          assert.equal(read.request.path.endsWith(encodeURIComponent(binding.notification_key)),true);
          assert.equal(await domain.beginOpenDispatch(originals[0]),null);
          const result=await domain.settleOriginalReadback(read.token,name==='fixed-key-not-in-list'?[opened]:[]);
          assert.equal(result.state,name==='fixed-key-not-in-list'?'OPENED':'PENDING');
          if(name==='fixed-key-not-in-list')assert.equal(entries().length,0);else assert.equal(only()[1]===before,true);
        }
      }else if(name==='missing-fixed-readback'||name==='duplicate-fixed-readback'||name==='bare-fixed-open'||name==='withheld-fixed-readback'){
        const {token}=await dispatch(),read=domain.beginOriginalReadback(token);let rows=[opened];
        if(name==='missing-fixed-readback')rows=[];if(name==='duplicate-fixed-readback')rows=[opened,opened];
        if(name==='bare-fixed-open'){const {open_receipt,...rest}=opened;rows=[rest];}
        if(name==='withheld-fixed-readback'){const {open_receipt,...rest}=opened;rows=[{...rest,event_validity:'WITHHELD'}];}
        assert.equal((await domain.settleOriginalReadback(read.token,rows)).state,'PENDING');assert.equal(entries().length,1);assert.equal(await domain.beginOpenDispatch(token),null);
      }else {
        const {token,request}=await dispatch();assert.equal(request.generation===generation,true);
        assert.equal(JSON.stringify(request.body)===JSON.stringify({notification_key:binding.notification_key}),true);
        const before=only()[1];let reply=receipt;
        if(name==='bare-opened')reply={opened:true};if(name==='provider-accepted')reply={provider_accepted:true};
        if(name==='wrong-recipient')reply={...receipt,employee_id:id(99)};
        if(name==='wrong-instance')reply={...receipt,instance_id:id(99)};
        if(name==='wrong-key')reply={...receipt,notification_key:'edited-card-key'};
        if(name==='malformed-receipt')reply={...receipt,opened_at:'2026-02-30T14:00:00Z'};
        if(name==='extra-receipt-field')reply={...receipt,provider_message_id:'synthetic'};
        if(name==='successor-after-await'){await Promise.resolve();live={...principal,employee_id:id(99),credential_id:id(98),assignment_epoch:8};generation++;}
        if(name==='generation-aba'){live={...principal,assignment_epoch:8};generation++;live=principal;generation++;}
        if(name==='unknown-principal')live=null;
        if(['bare-opened','provider-accepted','wrong-recipient','wrong-instance','wrong-key','malformed-receipt','extra-receipt-field','successor-after-await','generation-aba','unknown-principal'].includes(name)){
          assert.equal((await domain.settleOriginalOpened(token,reply)).state,'PENDING');assert.equal(only()[1]===before,true);
          assert.equal(await domain.beginOpenDispatch(token),null);
        }else if(name==='unknown-fixed-recovery'){
          assert.equal((await domain.settleOriginalOpened(token,null)).state,'PENDING');assert.equal(await domain.beginOpenDispatch(token),null);
          assert.equal((await recover(token)).state,'OPENED');assert.equal(entries().length,0);
        }else if(name==='valid-original'||name==='v2-original'){
          assert.equal((await domain.settleOriginalOpened(token,receipt)).state,'OPENED');assert.equal(entries().length,0);
          assert.equal(await domain.beginOpenDispatch(token),null);assert.equal(domain.beginOriginalReadback(token),null);
          assert.equal(await prepare(),null);assert.equal((await domain.pendingOriginals()).length,0);
        }else throw Error('Unknown event owning case');
      }
    }
    console.log(JSON.stringify({case:name,result:'PASS',scope:'NEW event-only actual source/runtime/admission, synthetic storage/locks/current readers/server receipt; no auth SQL provider native physical proof',lockClosed:!lockOwned}));
  }finally{queued=false;release?.();assert.equal(lockOwned,false);}
}
