import assert from 'node:assert/strict';
import {createManagerHeldReviewController,renderManagerHeldReview,validateHeldReviewPage} from '../manager-held-review-display.mjs';
// Retained controller cases, rebound to the current v2 fixture shape. Their
// earlier v1 executions are historical. Owning bound-reader compositions now
// live in manager-held-review-page-tests.mjs; no unbound v1 handler is mounted.
export async function runHeldReviewIntegrationCases(backend) {
  const row={ledger_id:'98000000-0000-4000-8000-000000000001',event_id:null,revision:null,status:'NEEDS_REVIEW',source:'events_app_outlook_sync',
    source_provenance_digest:'a'.repeat(64),received_at:'2026-10-10T13:00:00.000Z',review_reason_code:'SOURCE_CONTENT_AMBIGUOUS',
    missing_fields:{end_time:'UNKNOWN',venue_reference:'MISSING'},published:false,coverage_assigned:false,reminder_eligible:false};
  const page={schema:'custodial.manager-held-review.v2',source:'events_app_outlook_sync',generated_at:row.received_at,coverage:'held_review_only',snapshot_sha256:'b'.repeat(64),rows:[row],page_start:0,consumed_count:1,returned_count:1,total_count:1,next_cursor:null};
  const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
  const test=async(name,fn)=>{await fn();console.log('ok - '+name);};
  await test('NEW1 older success cannot overwrite the latest requested view',async()=>{
    const old=deferred(),fresh=deferred();let calls=0,html='';const c=createManagerHeldReviewController({readPage:()=>++calls===1?old.promise:fresh.promise,setHtml:v=>html=v});
    const a=c.load(),b=c.load();fresh.resolve({...page,rows:[{...row,review_reason_code:'MISSING_AUTHORITATIVE_END_TIME_AND_VENUE_REFERENCE'}]});await b;
    const expected=html;old.resolve(page);await a;assert.equal(html,expected);assert.match(html,/Missing authoritative end time and venue reference/);
  });
  await test('NEW2 access denial latches and subsequent load performs no reader call',async()=>{
    for(const denial of[{status:401},{status:403},{code:'AUTH_WITHDRAWN'}]){
      let html='',calls=0;const c=createManagerHeldReviewController({readPage:async()=>{calls++;throw denial;},setHtml:v=>html=v});
      await c.load();await c.load();assert.equal(calls,1);assert.match(html,/data-state="authwithdrawn"/);assert.doesNotMatch(html,/a{64}/);
    }
  });
  await test('NEW3 response page must match the requested original cursor',async()=>{
    let html='';const c=createManagerHeldReviewController({readPage:async()=>page,setHtml:v=>html=v});await c.next('hr2:1:'+'b'.repeat(64));assert.match(html,/data-state="malformed"/);
  });
  await test('NEW4 stale generic failure cannot replace a newer successful view',async()=>{
    const old=deferred();let html='',calls=0;const c=createManagerHeldReviewController({readPage:()=>++calls===1?old.promise:Promise.resolve(page),setHtml:v=>html=v});
    const a=c.load();await c.load();const expected=html;old.reject(new Error('PRIVATE_SYNTHETIC_ERROR'));await a;assert.equal(html,expected);assert.doesNotMatch(html,/PRIVATE_SYNTHETIC_ERROR/);
  });
  await test('NEW5 explicit auth withdrawal blocks pending success and future reads',async()=>{
    const d=deferred();let html='',calls=0;const c=createManagerHeldReviewController({readPage:()=>{calls++;return d.promise;},setHtml:v=>html=v});
    const a=c.load();c.withdrawAuth();d.resolve(page);await a;await c.load();assert.equal(calls,1);assert.match(html,/data-state="authwithdrawn"/);
  });
  await test('NEW6 a denial from an older outstanding reader still fails closed',async()=>{
    const old=deferred();let html='',calls=0;const c=createManagerHeldReviewController({readPage:()=>++calls===1?old.promise:Promise.resolve(page),setHtml:v=>html=v});
    const a=c.load();await c.load();old.reject({status:403});await a;await c.load();assert.equal(calls,2);assert.match(html,/data-state="authwithdrawn"/);
  });
  await test('NEW7 malformed and outside-owner-bound cursors do not invoke reader',async()=>{
    let calls=0,html='';const c=createManagerHeldReviewController({readPage:async()=>{calls++;return page;},setHtml:v=>html=v});
    for(const cursor of['hr1:01','hr1:1000000001','hr1:9999999999','hr1:-1','not_cursor',{},0]){await c.load(cursor);assert.match(html,/data-state="malformed"/);}
    assert.equal(calls,0);
  });
  await test('NEW8 unknown page row and nested fields are rejected instead of trusting a denylist',async()=>{
    for(const raw of[{...page,unexpected_private:{secret:'SYNTHETIC'}},{...page,rows:[{...row,unexpected_private:'SYNTHETIC'}]},
      {...page,rows:[{...row,missing_fields:{...row.missing_fields,private_note:'SYNTHETIC'}}]}])assert.throws(()=>validateHeldReviewPage(raw),/malformed_held_review/);
  });
  await test('NEW9 exact backend UUID and canonical received instant are required',async()=>{
    for(const change of[{ledger_id:'ledger-1'},{ledger_id:' '+row.ledger_id},{received_at:'PRIVATE <script>not time</script>'},
      {received_at:'2026-10-10T13:00:00Z'},{received_at:123},{source_provenance_digest:'A'.repeat(64)}])
      assert.throws(()=>renderManagerHeldReview({...page,rows:[{...row,...change}]}),/malformed_held_review_row/);
  });
  await test('NEW10 duplicate case-insensitive ledger UUID and over-100 rows fail closed',async()=>{
    assert.throws(()=>validateHeldReviewPage({...page,rows:[row,{...row,ledger_id:row.ledger_id.toUpperCase()}],consumed_count:2,returned_count:2,total_count:2}),/malformed_held_review_row/);
    assert.throws(()=>validateHeldReviewPage({...page,rows:Array.from({length:101},()=>row),consumed_count:101,returned_count:101,total_count:101}),/malformed_held_review_page/);
  });
  await test('NEW11 required v2 snapshot metadata and plain object shape only',async()=>{
    assert.doesNotThrow(()=>validateHeldReviewPage({...page,coverage:'held_review_only',generated_at:row.received_at}));
    for(const raw of[{...page,coverage:'published'},{...page,generated_at:'unknown'},Object.assign(Object.create({inherited:'private'}),page)])
      assert.throws(()=>validateHeldReviewPage(raw),/malformed_held_review_page/);
  });
  await test('NEW12 independently frozen validated DTO cannot be changed by caller',async()=>{
    const raw=structuredClone(page),v=validateHeldReviewPage(raw);raw.rows[0].received_at='changed';raw.rows[0].missing_fields.end_time='changed';
    assert.equal(v.rows[0].received_at,row.received_at);assert.equal(v.rows[0].missing_fields.end_time,'UNKNOWN');
    assert.ok(Object.isFrozen(v)&&Object.isFrozen(v.rows)&&Object.isFrozen(v.rows[0])&&Object.isFrozen(v.rows[0].missing_fields));
  });
  // Three owning handler compositions were replaced by the current bound v2
  // manager-page cases. Do not execute the retired unbound hr1 handler here.
  console.log(JSON.stringify({CURRENT_V2_REBOUND_CONTROLLER_FIXTURES:12,
    affected_bound_reader_compositions:'manager-held-review-page-tests.mjs',
    not_prior_v1_execution_or_actual_browser_SQL_auth_proof:true}));
}
