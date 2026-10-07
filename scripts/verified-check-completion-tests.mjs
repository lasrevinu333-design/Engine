import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source=readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
const start=source.indexOf('  function validateLocalCompletion(session, action) {');
const end=source.indexOf('  async function persistLocalCompletionUnlocked',start);
assert.ok(start>=0 && end>start,'actual protected completion validator must be found');
const validate=runInNewContext(source.slice(start,end)+'\nvalidateLocalCompletion;',{
  safeText:value=>String(value??'').trim(),
  isUuid:value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  canonicalJson:JSON.stringify,
  storageFailure:(_area,error)=>error,
  nativeLegacyCompletionBindings:new WeakMap(),
});
function pair(outcome,services){
  const response={services_performed:services};
  if(outcome!==undefined)response.work_result=outcome;
  const session={client_session_id:'00000000-0000-4000-8000-000000000001',
    client_completion_id:'00000000-0000-4000-8000-000000000002',
    native_finish_scan_entry_id:'00000000-0000-4000-8000-000000000003',
    device_id:'KIOSK_08',location_code:'SYNTHETIC_TEST_LOCATION',
    started_at:'2026-09-22T15:30:00.000Z',ended_at:'2026-09-22T15:35:00.000Z',
    response_json:response};
  const payload=Object.fromEntries(['client_session_id','client_completion_id','device_id',
    'location_code','native_finish_scan_entry_id'].map(key=>['p_'+key,session[key]]));
  Object.assign(payload,{p_client_started_at:session.started_at,p_client_ended_at:session.ended_at,
    p_response_json:structuredClone(response)});
  return [session,{type:'commit_workflow',payload}];
}
let passed=0;const failures=[];
function test(name,fn){try{fn();passed++;}catch(error){failures.push(name+': '+error.message);}}
for(const outcome of ['details'])
  test('retain cleaning '+outcome,()=>assert.doesNotThrow(()=>validate(...pair(outcome,['Floor']))));
test('new missing outcome rejected',()=>assert.throws(()=>validate(...pair(undefined,['Floor']))));
for(const forged of [{legacy:true},{schema_version:1},{created_at:'2020-01-01'},{native_accepted:true}])
 test('editable legacy marker rejected '+JSON.stringify(forged),()=>{const [s,a]=pair(undefined,['Floor']);Object.assign(a,forged);Object.assign(s,forged);assert.throws(()=>validate(s,a));});
test('full clean is exactly one selection',()=>assert.doesNotThrow(()=>validate(...pair('full',['Full cleaning services']))));
test('full cannot claim individual work',()=>assert.throws(()=>validate(...pair('full',['Floor']))));
test('full cannot combine selections',()=>assert.throws(()=>validate(...pair('full',['Full cleaning services','Floor']))));
test('selective cannot include full',()=>assert.throws(()=>validate(...pair('details',['Full cleaning services','Floor']))));
test('selective cannot alias full through free text',()=>assert.throws(()=>validate(...pair('details',[' full CLEANING services ']))));
test('accept honest check-only',()=>assert.doesNotThrow(()=>validate(...pair('checked_no_cleaning_needed',[]))));
test('reject cleaning services in check-only',()=>assert.throws(()=>validate(...pair('checked_no_cleaning_needed',['Floor']))));
test('reject unknown outcome',()=>assert.throws(()=>validate(...pair('invented_outcome',['Floor']))));
test('reject empty actual cleaning',()=>assert.throws(()=>validate(...pair('full',[]))));
for(const [name,mutate] of [
  ['missing finish',s=>{s.native_finish_scan_entry_id='';}],
  ['different location',s=>{s.location_code='OTHER';}],
  ['different completion',s=>{s.client_completion_id='00000000-0000-4000-8000-000000000099';}],
  ['different answers',s=>{s.response_json.note='unsubmitted';}],
  ['end precedes start',s=>{s.ended_at='2026-09-22T15:00:00.000Z';}],
]) test(name,()=>{const [s,a]=pair('checked_no_cleaning_needed',[]);mutate(s);assert.throws(()=>validate(s,a));});
console.log(JSON.stringify({passed,failed:failures.length,failures},null,2));
if(failures.length)process.exitCode=1;
