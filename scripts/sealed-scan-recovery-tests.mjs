import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const baseline=process.argv.includes('--baseline-stdin')?JSON.parse(readFileSync(0,'utf8')):null;
const source=path=>baseline
  ?baseline[path]
  :readFileSync(new URL('../'+path,import.meta.url),'utf8');
const uiSource=source('memphis-ui.js'),queueSource=source('memphis-scan-sync.js');
const slice=(source,start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);};
const id=n=>`ac100000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const device='KIOSK_08',indexKey=`mz_phone_scan_resume:${device}`;
const session=n=>({session_uuid:id(n),client_session_id:id(n),device_id:device,location_code:`PLACE${n}`,
  location_name:`Original place ${n}`,status:'active',started_at:'2026-10-31T15:00:00.000Z',employee_id:id(9),employee_name:'Original actor'});
const index=rows=>JSON.stringify({schema_version:2,device_id:device,sessions:rows});
function fixture(initial){
  const values=new Map(Object.entries(initial)),writes=[];
  const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,
    getItem:key=>values.get(key)??null,setItem(key,value){writes.push(['set',key,value]);values.set(key,String(value));},
    removeItem(key){writes.push(['remove',key]);values.delete(key);}};
  const state={deviceId:device,sessionQuarantine:[]};
  const status={native:true,state:'enrolled',ready:true,available:true,quarantined:false,generation:7,deviceId:device,principal:{device_id:device}};
  const win={localStorage:storage,location:{href:'https://fixture.invalid/index.html?hub=employee'},
    MemphisCustodialSecurity:{native:true,getStatus:()=>status,mutateProtectedWork(){assert.fail('read-only recovery cannot mutate original records');}},
    MemphisMobile:{principalIdentity:()=> 'original-principal'},MemphisScanSync:{isLocallyCompleted:s=>s?.testCompleted===true}};
  win.top=win;win.self=win;
  const scope={window:win,document:{readyState:'loading',addEventListener(){}},navigator:{},localStorage:storage,URL,console};
  vm.runInNewContext(uiSource,scope,{filename:'memphis-ui.js'});
  const q={localStorage:storage,state,console,window:win,navigator:{locks:{request(){}}},
    ensureWorkerReady:async()=>true,withQueueLock:fn=>fn(),listActions:async()=>[],
    dispatchStatus(){},safeText:value=>String(value??'').trim()};
  const queueCode=slice(queueSource,'  function storageFailure(','  function releaseVersionTuple(')
    +slice(queueSource,'  function allSessions()','  function exactSessionForPayload(')
    +slice(queueSource,'  async function recoverLocalCompletionIntentsUnlocked()','  async function drainForNewWorkUnlocked(');
  vm.runInNewContext(queueCode+'\nthis.rows=allSessions;this.recover=recoverLocalCompletionIntents;this.admit=admitNewLocalWork;',q);
  const snapshot=()=>JSON.stringify([...values].sort(([a],[b])=>a.localeCompare(b)));
  return {ui:win.MemphisUI,q,storage,writes,snapshot,status};
}
const cases=[];
async function check(name,run){try{await run();cases.push({name,passed:true});}catch(error){cases.push({name,passed:false,error:error.message});}}
const a=session(1),b=session(2),keyA=`session:${id(1)}`,keyB=`session:${id(2)}`,badKey=`session:${id(3)}`;
for(const indexed of [true,false])await check(`two valid contexts are ambiguous (${indexed?'partial index':'no index'})`,()=>{
  const f=fixture({[keyA]:JSON.stringify(a),[keyB]:JSON.stringify(b),...(indexed?{[indexKey]:index([a])}:{})}),before=f.snapshot();
  assert.equal(f.ui.resolveOpenScanSession(device).state,'ambiguous');assert.equal(f.snapshot(),before);assert.equal(f.writes.length,0);
});
await check('complete inventory includes a second session beyond 250 unrelated keys',()=>{
  const initial={[keyA]:JSON.stringify(a),[indexKey]:index([a])};for(let i=0;i<300;i++)initial[`noise:${i}`]='unrelated';initial[keyB]=JSON.stringify(b);
  assert.equal(fixture(initial).ui.resolveOpenScanSession(device).state,'ambiguous');
});
await check('single current session preserves original identity and ignores another device',()=>{
  const f=fixture({[keyA]:JSON.stringify(a),[keyB]:JSON.stringify({...b,device_id:'KIOSK_09'}),[indexKey]:index([a])});
  const got=f.ui.resolveOpenScanSession(device);assert.equal(got.state,'open');assert.equal(got.session.employee_id,a.employee_id);assert.equal(got.session.session_uuid,a.session_uuid);
});
for(const indexed of [true,false])for(const badFirst of [true,false])await check(`malformed row isolated; indexed=${indexed}, badFirst=${badFirst}`,async()=>{
  const initial=Object.fromEntries(badFirst?[[badKey,'{original malformed'],[keyA,JSON.stringify(a)]]:[[keyA,JSON.stringify(a)],[badKey,'{original malformed']]);
  if(indexed)initial[indexKey]=index([a]);const f=fixture(initial),before=f.snapshot();
  const got=f.ui.resolveOpenScanSession(device);assert.equal(got.state,'open');assert.equal(got.session.session_uuid,a.session_uuid);
  assert.ok(got.quarantined?.some(row=>row.key===badKey));
  assert.equal(f.q.rows().length,1);await f.q.recover();assert.ok(f.q.state.sessionQuarantine.some(row=>row.key===badKey));
  assert.equal(f.snapshot(),before);assert.equal(f.writes.length,0);
});
for(const includesValid of [true,false])await check(`malformed indexed row remains quarantined while valid original is recoverable; validIndexed=${includesValid}`,()=>{
  const bad=session(3),initial={[badKey]:'{original malformed',[keyA]:JSON.stringify(a),[indexKey]:index(includesValid?[bad,a]:[bad])};
  const f=fixture(initial),before=f.snapshot(),got=f.ui.resolveOpenScanSession(device);
  assert.equal(got.state,'open');assert.equal(got.session.session_uuid,a.session_uuid);assert.ok(got.quarantined.some(row=>row.key===badKey));assert.equal(f.snapshot(),before);assert.equal(f.writes.length,0);
});
await check('unknown-only storage refuses new work and never discards raw bytes',async()=>{
  const f=fixture({[badKey]:'{original malformed'}),before=f.snapshot();let admitted=0;
  assert.equal(f.ui.resolveOpenScanSession(device).state,'corrupted');
  await assert.rejects(()=>f.q.admit(async()=>{admitted++;}),{code:'custodial_storage_unavailable'});
  assert.equal(admitted,0);assert.equal(f.snapshot(),before);assert.equal(f.writes.length,0);
});
await check('queue startup isolates malformed original independently of UI recovery',async()=>{
  const f=fixture({[badKey]:'{original malformed',[keyA]:JSON.stringify(a)}),before=f.snapshot();
  assert.equal(f.q.rows().length,1);await f.q.recover();
  assert.ok(f.q.state.sessionQuarantine.some(row=>row.key===badKey));assert.equal(f.snapshot(),before);assert.equal(f.writes.length,0);
});
await check('storage I/O failure remains unavailable, not an empty inventory',()=>{
  const f=fixture({[keyA]:JSON.stringify(a)});f.storage.getItem=()=>{throw Error('storage denied');};
  assert.equal(f.ui.resolveOpenScanSession(device).state,'corrupted');assert.throws(()=>f.q.rows(),{code:'custodial_storage_unavailable'});
});
await check('completed original does not conflict with remaining active work',()=>{
  const f=fixture({[keyA]:JSON.stringify({...a,status:'pending_sync',testCompleted:true}),[keyB]:JSON.stringify(b),[indexKey]:index([a])});
  const got=f.ui.resolveOpenScanSession(device);assert.equal(got.state,'open');assert.equal(got.session.session_uuid,b.session_uuid);
});
console.log(JSON.stringify({scope:'Exact current UI and queue recovery owners; synthetic storage/principal, no browser/native/device acceptance',passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length,cases},null,2));
process.exitCode=cases.some(c=>!c.passed)?1:0;
