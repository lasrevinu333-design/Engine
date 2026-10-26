import assert from 'node:assert/strict';
import {createManagerHeldReviewPage} from '../manager-held-review-page.mjs';
import {createHeldEventCorrectionController} from '../manager-held-event-correction.mjs';
process.env.TZ = 'UTC';

const digest = 'a'.repeat(64);
const ledger = '98000000-0000-4000-8000-000000000011';
const session = () => ({role:'ops_manager',manager_id:'98000000-0000-4000-8000-000000000012',credential_id:'FIXTURE_ONLY',device_id:'FIXTURE_BROWSER',token:'SYNTHETIC_NOT_A_CREDENTIAL',session_id:'SESSION_ONLY',expires_at:'2099-01-01T00:00:00.000Z',read_only:false,permissions:{owner:true}});
const row = {ledger_id:ledger,event_id:null,revision:null,status:'NEEDS_REVIEW',source:'events_app_outlook_sync',source_provenance_digest:digest,
  received_at:'2026-10-10T13:00:00.000Z',review_reason_code:'UNCLASSIFIED_SOURCE_REVIEW',missing_fields:{end_time:'UNKNOWN',venue_reference:'UNKNOWN'},published:false,coverage_assigned:false,reminder_eligible:false};
const page = {schema:'custodial.manager-held-review.v2',source:'events_app_outlook_sync',generated_at:'2026-10-10T14:30:00.000Z',coverage:'held_review_only',snapshot_sha256:digest,rows:[row],page_start:0,returned_count:1,consumed_count:1,total_count:1,next_cursor:null};
const preview = {schema:'custodial.held-event-correction-preview.v1',ledger_id:ledger,expected_review_snapshot_sha256:digest,source_provenance_digest:digest,preview_id:'preview-1',preview_sha256:'b'.repeat(64),corrected_end_at:'2026-10-12T13:30:00.000Z',venue_ref:'venue-1',state:'PREVIEW_ONLY',published:false,coverage_assigned:false,reminder_eligible:false};
const confirmed = {schema:'custodial.held-event-correction-confirmed.v1',ledger_id:ledger,preview_id:'preview-1',preview_sha256:'b'.repeat(64),event_id:'98000000-0000-4000-8000-000000000013',revision:1,canonical_event_readback_sha256:'c'.repeat(64),state:'ACCEPTED',published:true};
const previewV2 = {schema:'custodial.held-event-correction-preview.v2',ledger_id:ledger,expected_review_snapshot_sha256:digest,source_provenance_digest:digest,preview_id:'98000000-0000-4000-8000-000000000016',preview_sha256:'d'.repeat(64),normalized_event:{event_name:'Keeper briefing',event_date:'2026-10-12',start_time:'08:30:00',start_instant_utc:'2026-10-12T08:30:00.000Z',end_date:'2026-10-12',end_time:'13:30:00',end_instant_utc:'2026-10-12T13:30:00.000Z',primary_venue_id:'98000000-0000-4000-8000-000000000014',display_location:'Primate Pavilion'},fact_basis:{event_name:'MANAGER_CONFIRMED',start_at:'MANAGER_CONFIRMED',end_at:'MANAGER_CONFIRMED',venue_ref:'MANAGER_CONFIRMED'},source_evidence_status:'ORIGINAL_FACTS_INCOMPLETE',missing_original_fields:['event_name','start_at'],corrected_end_at:'2026-10-12T13:30:00.000Z',venue_ref:'98000000-0000-4000-8000-000000000014',state:'PREVIEW_ONLY',published:false,coverage_assigned:false,reminder_eligible:false};
const confirmedV2 = {schema:'custodial.held-event-correction-confirmed.v2',ledger_id:ledger,preview_id:previewV2.preview_id,preview_sha256:'d'.repeat(64),event_id:'98000000-0000-4000-8000-000000000015',revision:2,canonical_event_readback_sha256:'e'.repeat(64),normalized_event:previewV2.normalized_event,fact_basis:previewV2.fact_basis,source_evidence_status:'ORIGINAL_FACTS_INCOMPLETE',missing_original_fields:['event_name','start_at'],corrected_end_at:'2026-10-12T13:30:00.000Z',venue_ref:'98000000-0000-4000-8000-000000000014',state:'ACCEPTED',published:true,manager_feed_verified:false};
class Target { constructor(){this.listeners=new Map();} addEventListener(k,f){(this.listeners.get(k)||this.listeners.set(k,new Set()).get(k)).add(f);} removeEventListener(k,f){this.listeners.get(k)?.delete(f);} fire(k,e={}){for(const f of [...(this.listeners.get(k)||[])])f(e);} }
class Control extends Target { constructor(){super();this.disabled=false;this.value='';this.textContent='';this.options=[];} append(value){this.options.push(value);} }
class CorrectionCard extends Target { constructor(v2=false){super();this.status=new Control();this.eventName=v2?new Control():null;this.start=v2?new Control():null;this.end=new Control();this.venue=new Control();this.preview=new Control();this.confirm=new Control();this.savedOutcome=new Control();this.confirm.disabled=true;this.savedOutcome.disabled=true;} querySelector(s){return ({'[data-correction-status]':this.status,'[data-correction-form]':this,'[data-correction-event-name]':this.eventName,'[data-correction-start]':this.start,'[data-correction-end]':this.end,'[data-correction-venue]':this.venue,'[data-correction-preview]':this.preview,'[data-correction-confirm]':this.confirm,'[data-correction-status-check]':this.savedOutcome})[s]||null;} querySelectorAll(s){return s==='input,select'?[this.eventName,this.start,this.end,this.venue].filter(Boolean):[];} }
class Card extends Target { constructor(id){super();this.id=id;this.correction=null;this.inserted='';} querySelector(s){if(s==='[data-correction-form]')return this.correction; if(s==='.mz-held-correction')return this.correction; return null;} insertAdjacentHTML(_position,html){this.inserted=html;this.correction=/data-correction-form/.test(html)?new CorrectionCard(/data-correction-event-name/.test(html)):null;} }
class Content extends Target { constructor(){super();this.cards=new Map();this._cards=[];this._html='';} set innerHTML(v){this._html=v;this.cards.clear();this._cards=[new Card('unbound-row')];} get innerHTML(){return this._html;} replaceChildren(){this.innerHTML='';this._cards=[];} querySelectorAll(s){return s==='.mz-held-review-card'?this._cards:[];} querySelector(s){const m=s.match(/\[data-ledger-id="([^"]+)"\]/);return m?this.cards.get(m[1])||null:null;} }
class DocumentFacade extends Target { constructor(){super();this.hidden=false;this.ids=new Map();} getElementById(id){return this.ids.get(id)||null;} createElement(){return new Control();} }
function fixture({correctionApi=null,fetchImpl=null,sessionValue=null}={}) { const w=new Target(),d=new DocumentFacade(),content=new Content(); const ids={
  'manager-held-review-panel':new Control(),'manager-held-review-content':content,'manager-held-review-range':new Control(),'manager-held-review-refresh':new Control(),'manager-held-review-next':new Control()}; for(const [k,v] of Object.entries(ids))d.ids.set(k,v);
  w.document=d;w.setTimeout=(f)=>setTimeout(f,0);w.clearTimeout=clearTimeout;w.setInterval=(f)=>setInterval(f,100000);w.clearInterval=clearInterval;w.MemphisCustodialSecurity={native:false};let s=sessionValue || session();w.MemphisAuth={readSession:()=>s,requireOpsManagerSession:async()=>s};
  const calls=[]; const readResponse=fetchImpl || (async()=>({status:200,ok:true,text:async()=>JSON.stringify({ok:true,data:page})}));
  const p=createManagerHeldReviewPage({window:w,document:d,now:()=>Date.parse('2026-10-10T14:30:00.000Z'),fetchImpl:async(...args)=>{calls.push(args);return readResponse(...args);},correctionApi});
  return {w,d,ids,content,calls,change:x=>{s=x;},page:p}; }
const tests=[];async function test(name,fn){if(process.env.HELD_CASE&&!name.includes(process.env.HELD_CASE))return;if(process.argv.includes('--product-only')&&!name.startsWith('PRODUCT '))return;if(process.argv.includes('--new-main-only')&&!name.startsWith('MAIN '))return;await fn();tests.push(name);console.log(`ok - ${name}`);}
await test('actual copied page mounts correction form and one-confirm flow with safe pins',async()=>{
  const calls=[];const f=fixture({correctionApi:{listEligiblePlaces:async()=>[{ref:'venue-1',label:'Primate Pavilion'}],previewCorrection:async r=>{calls.push(['preview',r]);return preview;},confirmCorrection:async r=>{calls.push(['confirm',r]);return confirmed;}}});
  try { await f.page.init(); const card=f.content._cards[0]; assert.ok(card?.correction); assert.equal(card.correction.eventName,null); assert.equal(card.correction.start,null); assert.equal(card.correction.venue.textContent,''); card.correction.venue.value='venue-1'; card.correction.end.value='2026-10-12T13:30'; card.correction.preview.fire('click'); await new Promise(r=>setImmediate(r)); assert.equal(calls.length,1); assert.equal(card.correction.confirm.disabled,false); card.correction.confirm.fire('click'); await new Promise(r=>setImmediate(r)); assert.equal(calls.length,2); assert.match(card.correction.status.textContent,/Accepted .*canonical/);
  } finally { f.page.stop(); }
});
await test('missing canonical title/start require explicit manager facts and remain held',async()=>{
  const f=fixture();try{await f.page.init();assert.ok(f.content._cards[0].correction);assert.equal(f.content._cards[0].correction.confirm.disabled,true);assert.match(f.content._cards[0].correction.status.textContent,/Held/);}finally{f.page.stop();}
});
await test('V2 manager-confirmed title/start uses closed normalized preview and receipt fields',async()=>{
  const calls=[];const f=fixture({correctionApi:{v2:true,listEligiblePlaces:async()=>[{ref:'98000000-0000-4000-8000-000000000014',label:'Primate Pavilion'}],previewCorrectionV2:async r=>{calls.push(['preview',r]);return previewV2;},confirmCorrectionV2:async r=>{calls.push(['confirm',r]);return confirmedV2;}}});
  // The copied page must mount against the rendered held-row card, not a replacement guard.
  try { await f.page.init();const card=f.content._cards[0].correction;card.eventName.value='Keeper briefing';card.start.value='2026-10-12T08:30';card.end.value='2026-10-12T13:30';card.venue.value='98000000-0000-4000-8000-000000000014';card.preview.fire('click');await new Promise(r=>setImmediate(r));assert.equal(calls[0][1].schema,'custodial.held-event-correction-preview-request.v2');assert.equal(calls[0][1].manager_fact_confirmation,'MANAGER_CONFIRMED_MISSING_ORIGINAL_FACTS');assert.deepEqual(calls[0][1].correction,{event_name:'Keeper briefing',start_at:'2026-10-12T08:30:00.000Z',end_at:'2026-10-12T13:30:00.000Z',venue_ref:'98000000-0000-4000-8000-000000000014'});assert.equal(card.confirm.disabled,false);card.confirm.fire('click');await new Promise(r=>setImmediate(r));assert.equal(calls[1][1].schema,'custodial.held-event-correction-confirm-request.v2');assert.match(card.status.textContent,/Accepted .*canonical/);} finally { f.page.stop(); }
});
await test('default page client uses fixed places/preview/confirm routes and preserves unknown outcome',async()=>{
  const response=(data,status=200)=>({status,ok:status===200,text:async()=>JSON.stringify(status===200?{ok:true,data}:{ok:false,code:data})});
  const f=fixture({fetchImpl:async(url,options={})=>{const path=new URL(url).pathname;
    if(path.endsWith('/held-event-reviews'))return response(page);
    if(path.endsWith('/corrections/places'))return response({schema:'custodial.held-event-correction-places.v1',places:[{venue_ref:'98000000-0000-4000-8000-000000000014',label:'Primate Pavilion'}]});
    if(path.endsWith('/corrections/preview'))return response(previewV2);
    if(path.endsWith('/corrections/confirm'))return response('OUTCOME_UNKNOWN',503);
    throw new Error('unexpected_route');
  }});
  try { await f.page.init();const card=f.content._cards[0].correction;card.eventName.value='Keeper briefing';card.start.value='2026-10-12T08:30';card.end.value='2026-10-12T13:30';card.venue.value='98000000-0000-4000-8000-000000000014';card.preview.fire('click');await new Promise(r=>setImmediate(r));assert.equal(card.confirm.disabled,false);card.confirm.fire('click');await new Promise(r=>setImmediate(r));assert.match(card.status.textContent,/outcome is unknown/i);assert.equal(card.confirm.disabled,true);const paths=f.calls.map(([url])=>new URL(url).pathname);assert.deepEqual(paths,['/dashboard-api/held-event-reviews','/dashboard-api/held-event-reviews/corrections/places','/dashboard-api/held-event-reviews/corrections/preview','/dashboard-api/held-event-reviews/corrections/confirm']);const previewCall=f.calls[2][1],confirmCall=f.calls[3][1];assert.deepEqual(JSON.parse(previewCall.body),{schema:'custodial.held-event-correction-preview-request.v2',ledger_id:ledger,expected_review_snapshot_sha256:digest,source_provenance_digest:digest,correction:{event_name:'Keeper briefing',start_at:'2026-10-12T08:30:00.000Z',end_at:'2026-10-12T13:30:00.000Z',venue_ref:'98000000-0000-4000-8000-000000000014'},manager_fact_confirmation:'MANAGER_CONFIRMED_MISSING_ORIGINAL_FACTS'});assert.deepEqual(JSON.parse(confirmCall.body),{schema:'custodial.held-event-correction-confirm-request.v2',preview_id:previewV2.preview_id,preview_sha256:previewV2.preview_sha256});
  } finally { f.page.stop(); }
});
await test('MAIN read-only manager keeps held review visible without correction controls or requests',async()=>{
  const f=fixture({sessionValue:{...session(),read_only:true,permissions:{owner:false}}});
  try { await f.page.init();const card=f.content._cards[0];assert.equal(card.correction,null);assert.match(card.inserted,/Read-only manager access/);assert.equal(f.calls.length,1);assert.equal(f.content.listeners.size,0); }
  finally { f.page.stop(); }
});
await test('MAIN full-write owner capability mounts correction controls',async()=>{
  const f=fixture();
  try { await f.page.init();const card=f.content._cards[0];assert.ok(card.correction);assert.ok(card.correction.eventName);assert.ok(card.correction.start);assert.equal(f.calls.length,2); }
  finally { f.page.stop(); }
});
await test('late preview after manager change stays denied and never enables confirm',async()=>{
  let resolve;const wait=new Promise(r=>{resolve=r;});const f=fixture({correctionApi:{listEligiblePlaces:async()=>[{ref:'venue-1',label:'Primate Pavilion'}],previewCorrection:async()=>wait,confirmCorrection:async()=>confirmed}});
  try { await f.page.init();const card=f.content._cards[0].correction;card.venue.value='venue-1';card.end.value='2026-10-12T13:30';card.preview.fire('click');f.change({...session(),manager_id:'98000000-0000-4000-8000-000000000099'});resolve(preview);await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));assert.equal(card.confirm.disabled,true);assert.match(card.status.textContent,/held|Manager\/session/i);}finally{f.page.stop();}
});
await test('MAIN real server unknown-state envelope blocks re-preview and shows exact normalized facts',async()=>{
  const f=fixture({fetchImpl:async(url)=>{
    const path=new URL(url).pathname;
    const ok=data=>({status:200,ok:true,text:async()=>JSON.stringify({ok:true,data})});
    if(path.endsWith('/held-event-reviews'))return ok(page);
    if(path.endsWith('/corrections/places'))return ok({schema:'custodial.held-event-correction-places.v1',places:[{venue_ref:previewV2.venue_ref,label:'Primate Pavilion'}]});
    if(path.endsWith('/corrections/preview'))return ok(previewV2);
    if(path.endsWith('/corrections/confirm'))return {status:503,ok:false,text:async()=>JSON.stringify({ok:false,code:'held_correction_write_unconfirmed',state:'OUTCOME_UNKNOWN',retry_safe:false,error:'Do not repeat confirmation'})};
    throw new Error('unexpected_route');
  }});
  try{
    await f.page.init();const c=f.content._cards[0].correction;
    c.eventName.value='Keeper briefing';c.start.value='2026-10-12T08:30';c.end.value='2026-10-12T13:30';c.venue.value=previewV2.venue_ref;
    c.preview.fire('click');await new Promise(r=>setImmediate(r));
    assert.match(c.status.textContent,/Keeper briefing.*2026-10-12.*Primate Pavilion/);
    assert.match(c.status.textContent,/manager-confirmed.*not been recovered/i);
    c.confirm.fire('click');await new Promise(r=>setImmediate(r));
    assert.match(c.status.textContent,/outcome is unknown/i);assert.equal(c.preview.disabled,true);assert.equal(c.confirm.disabled,true);
    const before=f.calls.length;c.preview.fire('click');await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,before);assert.match(c.status.textContent,/outcome is unknown/i);
  }finally{f.page.stop();}
});
await test('MAIN owner checks saved outcome once and accepts only matching confirmed readback',async()=>{
  const response=(data,status=200)=>({status,ok:status===200,text:async()=>JSON.stringify(status===200?{ok:true,data}:{ok:false,code:data,state:'OUTCOME_UNKNOWN',retry_safe:false})});
  const f=fixture({fetchImpl:async(url,options={})=>{const path=new URL(url).pathname;
    if(path.endsWith('/held-event-reviews'))return response(page);
    if(path.endsWith('/corrections/places'))return response({schema:'custodial.held-event-correction-places.v1',places:[{venue_ref:previewV2.venue_ref,label:'Primate Pavilion'}]});
    if(path.endsWith('/corrections/preview'))return response(previewV2);
    if(path.endsWith('/corrections/confirm'))return response('OUTCOME_UNKNOWN',503);
    if(path.endsWith('/corrections/status'))return response(confirmedV2);
    throw new Error('unexpected_route');
  }});
  try { await f.page.init(); const c=f.content._cards[0].correction;
    c.eventName.value='Keeper briefing'; c.start.value='2026-10-12T08:30'; c.end.value='2026-10-12T13:30'; c.venue.value=previewV2.venue_ref;
    c.preview.fire('click'); await new Promise(r=>setImmediate(r)); c.confirm.fire('click'); await new Promise(r=>setImmediate(r));
    assert.match(c.status.textContent,/outcome is unknown/i); assert.equal(c.savedOutcome.disabled,false);
    c.savedOutcome.fire('click'); await new Promise(r=>setImmediate(r));
    assert.match(c.status.textContent,/Accepted .*canonical/); assert.equal(c.confirm.disabled,true);
    const statusCalls=f.calls.filter(([url])=>new URL(url).pathname.endsWith('/corrections/status')); assert.equal(statusCalls.length,1);
    assert.deepEqual(JSON.parse(statusCalls[0][1].body),{schema:'custodial.held-event-correction-status-request.v2',preview_id:previewV2.preview_id,preview_sha256:previewV2.preview_sha256});
  } finally { f.page.stop(); }
});
await test('MAIN pending or mismatched saved outcome stays uncertain and never enables resend',async()=>{
  let statusMode='pending';
  const mismatch={...confirmedV2,preview_id:'98000000-0000-4000-8000-000000000099'};
  const response=(data,status=200)=>({status,ok:status===200,text:async()=>JSON.stringify(status===200?{ok:true,data}:{ok:false,code:'OUTCOME_UNKNOWN',state:'OUTCOME_UNKNOWN',retry_safe:false})});
  const f=fixture({fetchImpl:async(url)=>{const path=new URL(url).pathname;
    if(path.endsWith('/held-event-reviews'))return response(page);
    if(path.endsWith('/corrections/places'))return response({schema:'custodial.held-event-correction-places.v1',places:[{venue_ref:previewV2.venue_ref,label:'Primate Pavilion'}]});
    if(path.endsWith('/corrections/preview'))return response(previewV2);
    if(path.endsWith('/corrections/confirm'))return response('OUTCOME_UNKNOWN',503);
    if(path.endsWith('/corrections/status'))return response(statusMode==='pending'?{state:'HELD',published:false,manager_feed_verified:false,retry_safe:false}:mismatch);
    throw new Error('unexpected_route');
  }});
  try { await f.page.init(); const c=f.content._cards[0].correction;
    c.eventName.value='Keeper briefing'; c.start.value='2026-10-12T08:30'; c.end.value='2026-10-12T13:30'; c.venue.value=previewV2.venue_ref;
    c.preview.fire('click'); await new Promise(r=>setImmediate(r)); c.confirm.fire('click'); await new Promise(r=>setImmediate(r));
    c.savedOutcome.fire('click'); await new Promise(r=>setImmediate(r)); assert.match(c.status.textContent,/still pending/i); assert.equal(c.confirm.disabled,true); assert.equal(c.preview.disabled,true);
    statusMode='mismatch'; c.savedOutcome.fire('click'); await new Promise(r=>setImmediate(r)); assert.match(c.status.textContent,/outcome is unknown/i); assert.equal(c.confirm.disabled,true); assert.equal(c.preview.disabled,true);
  } finally { f.page.stop(); }
});
await test('PRODUCT uncertain correction retains its card and exact identity across attempted refresh and duplicate status click',async()=>{
  let finishStatus; const waiting=new Promise(resolve=>{finishStatus=resolve;});
  const f=fixture({correctionApi:{v2:true,listEligiblePlaces:async()=>[{ref:previewV2.venue_ref,label:'Primate Pavilion'}],previewCorrectionV2:async()=>previewV2,confirmCorrectionV2:async()=>{throw Error('Lost confirm response');},statusCorrectionV2:async body=>{assert.equal(body.preview_id,previewV2.preview_id);return waiting;}}});
  try { await f.page.init(); const c=f.content._cards[0].correction;
    c.eventName.value='Keeper briefing'; c.start.value='2026-10-12T08:30'; c.end.value='2026-10-12T13:30'; c.venue.value=previewV2.venue_ref;
    c.preview.fire('click'); await new Promise(r=>setImmediate(r)); c.confirm.fire('click'); await new Promise(r=>setImmediate(r));
    assert.equal(f.ids['manager-held-review-refresh'].disabled,true); assert.equal(await f.page.init(),false); assert.equal(f.content._cards[0].correction,c);
    c.savedOutcome.fire('click'); c.savedOutcome.fire('click'); c.preview.fire('click'); await new Promise(r=>setImmediate(r));
    assert.match(c.status.textContent,/Checking the saved outcome/); assert.equal(c.preview.disabled,true); assert.equal(c.end.disabled,true); assert.equal(c.savedOutcome.disabled,true);
    finishStatus(confirmedV2); await new Promise(r=>setImmediate(r)); assert.match(c.status.textContent,/Accepted/); assert.equal(f.ids['manager-held-review-refresh'].disabled,false);
  }finally{f.page.stop();}
});
await test('PRODUCT in-flight confirmation invalidation preserves pinned saved-outcome identity and rejects new target',async()=>{
  let finishConfirm;const waiting=new Promise(resolve=>{finishConfirm=resolve;}),b={manager_id:'original',session_epoch:'same'};
  let seen;const c=createHeldEventCorrectionController({api:{previewCorrectionV2:async()=>previewV2,confirmCorrectionV2:async()=>waiting,statusCorrectionV2:async body=>{seen=body;return confirmedV2;}},session:{requireCurrentManager:()=>b},setView:()=>{}});
  c.open(row,digest);c.chooseManagerConfirmed({event_name:'Keeper briefing',start_at:previewV2.normalized_event.start_instant_utc,end_at:previewV2.corrected_end_at,venue_ref:previewV2.venue_ref});await c.preview();const confirming=c.confirm();c.invalidate();assert.equal(c.getState(),'OUTCOME_UNKNOWN');assert.throws(()=>c.open(row,digest),/unresolved/);finishConfirm(confirmedV2);await confirming;assert.equal(c.getState(),'OUTCOME_UNKNOWN');await c.checkSavedOutcome();assert.equal(seen.preview_id,previewV2.preview_id);assert.equal(c.getState(),'ACCEPTED');
});
await test('PRODUCT changed owner during saved-outcome read remains denied after late callback',async()=>{
  let owner={manager_id:'original',session_epoch:'same'};const c=createHeldEventCorrectionController({api:{previewCorrectionV2:async()=>previewV2,confirmCorrectionV2:async()=>{throw Error('Lost');},statusCorrectionV2:async()=>{owner={manager_id:'different',session_epoch:'different'};return confirmedV2;}},session:{requireCurrentManager:()=>owner},setView:()=>{}});
  c.open(row,digest);c.chooseManagerConfirmed({event_name:'Keeper briefing',start_at:previewV2.normalized_event.start_instant_utc,end_at:previewV2.corrected_end_at,venue_ref:previewV2.venue_ref});await c.preview();await assert.rejects(c.confirm());await assert.rejects(c.checkSavedOutcome(),/manager_or_session_changed/);assert.equal(c.getState(),'DENIED');c.invalidate();assert.equal(c.getState(),'DENIED');
});
await test('ROUTE_BINDING eligible long label remains selectable through actual V2 preview and accepted readback',async()=>{
 for(const length of [181,240]){const label='<img onerror=malicious()>'.padEnd(length,'x');
  const longPreview={...previewV2,normalized_event:{...previewV2.normalized_event,display_location:label}};
  const longConfirmed={...confirmedV2,normalized_event:longPreview.normalized_event};let posted;
  const f=fixture({fetchImpl:async(url,options={})=>{
   const path=new URL(url).pathname,ok=data=>({status:200,ok:true,text:async()=>JSON.stringify({ok:true,data})});
   if(path==='/dashboard-api/held-event-reviews')return ok(page);
   if(path==='/dashboard-api/held-event-reviews/corrections/places')return ok({schema:'custodial.held-event-correction-places.v1',places:[{venue_ref:previewV2.venue_ref,label}]});
   if(path==='/dashboard-api/held-event-reviews/corrections/preview'){posted=JSON.parse(options.body);return ok(longPreview);}
   if(path==='/dashboard-api/held-event-reviews/corrections/confirm'){assert.deepEqual(JSON.parse(options.body),{schema:'custodial.held-event-correction-confirm-request.v2',preview_id:previewV2.preview_id,preview_sha256:previewV2.preview_sha256});return ok(longConfirmed);}
   assert.fail('unexpected_route');
  }});
  try{await f.page.init();await new Promise(r=>setImmediate(r));const c=f.content._cards[0].correction;
   assert.equal(c.venue.options.length,1);assert.equal(c.venue.options[0].textContent,label);assert.equal(c.venue.options[0].value,previewV2.venue_ref);
   c.eventName.value='Keeper briefing';c.start.value='2026-10-12T08:30';c.end.value='2026-10-12T13:30';c.venue.value=c.venue.options[0].value;
   c.preview.fire('click');await new Promise(r=>setImmediate(r));assert.equal(posted.correction.venue_ref,previewV2.venue_ref);
   assert.equal(c.confirm.disabled,false);assert.ok(c.status.textContent.includes(label));
   c.confirm.fire('click');await new Promise(r=>setImmediate(r));assert.match(c.status.textContent,/Accepted .*canonical/);
   assert.equal(f.calls.filter(([,o])=>o.method==='POST').length,2);
  }finally{f.page.stop();}
 }
});
await test('ROUTE_BINDING malformed or duplicate eligible-place pages never silently expose a partial selection',async()=>{
 const valid={venue_ref:previewV2.venue_ref,label:'Primate Pavilion'};
 for(const bad of [{...valid,venue_ref:'invalid'},{...valid,label:'x'.repeat(241)},{...valid,label:' '},{...valid,raw_mail:'private'},valid]){
  const f=fixture({fetchImpl:async(url)=>({status:200,ok:true,text:async()=>JSON.stringify({ok:true,data:new URL(url).pathname.endsWith('/corrections/places')?{schema:'custodial.held-event-correction-places.v1',places:[valid,bad]}:page})})});
  try{await f.page.init();await new Promise(r=>setImmediate(r));const c=f.content._cards[0].correction;assert.equal(c.venue.options.length,0);
   assert.equal(c.confirm.disabled,true);assert.match(c.status.textContent,/Eligible places unavailable.*held/);
   assert.equal(f.calls.filter(([,o])=>o.method==='POST').length,0);
  }finally{f.page.stop();}
 }
});
console.log(`TAP version 13\n1..${tests.length}\n# ${tests.length} passed; 0 failed; 0 skipped`);
