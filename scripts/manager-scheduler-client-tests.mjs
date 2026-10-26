// Frozen synthetic Source-test context: selected scheduler/runtime/shared callable bodies
// are separate from the exact HISTORICAL1043 artifact snapshot. Neither proves
// a current generated backend release, deployed server, SQL or named-manager action.
import nodeTest from 'node:test';import assert from 'node:assert/strict';import{createRequire}from'node:module';
import fs from 'node:fs';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
import {createHash,webcrypto} from 'node:crypto';
const unpublishedCancelEdgeOnly=process.argv.includes('--unpublished-preparation-cancel-edge-only');
const unpublishedCancelOnly=process.argv.includes('--unpublished-preparation-cancel-only')||unpublishedCancelEdgeOnly;
const a1CurrentOnly=process.argv.includes('--a1-current-sql-dto-join-only');
const rosterLiteralOnly=process.argv.includes('--roster-literal-device-only');
const serverDateTurnoverOnly=process.argv.includes('--server-date-turnover-only');
const serverDateMissingOnly=process.argv.includes('--server-date-missing-only');
const turnoverPrincipalOnly=process.argv.includes('--turnover-original-principal-only');
const turnoverPrincipalUnknownOnly=process.argv.includes('--turnover-principal-unknown-only');
const originalResumeOnly=process.argv.includes('--original-confirmation-resume-only');
const originalResumeReproducerOnly=process.argv.includes('--original-resume-reproducer-only');
const weekArrivalOnly=process.argv.includes('--current-week-arrival-only');
const weekArrivalReproducerOnly=process.argv.includes('--week-arrival-reproducer-only');
const approvedRecoveryOnly=process.argv.includes('--approved-confirmation-readonly-recovery-only');
const approvedRecoveryHttpRemainingOnly=process.argv.includes('--approved-recovery-current-http-remaining-only');
const approvedRecoveryHttpOnly=process.argv.includes('--approved-recovery-current-http-only')||approvedRecoveryHttpRemainingOnly;
const approvedRecoveryReproducerOnly=process.argv.includes('--approved-recovery-reproducer-only');
const unresolvedPreviewOnly=process.argv.includes('--approved-unresolved-preview-only');
const missingPatternOriginalRecoveryOnly=process.argv.includes('--staffing-original-empty-selection-recovery-only');
const missingPatternEmptyArrivalOnly=process.argv.includes('--staffing-empty-selection-arrival-guard-only');
const missingPatternOnly=process.argv.includes('--staffing-missing-approved-pattern-only')||missingPatternOriginalRecoveryOnly||missingPatternEmptyArrivalOnly;
const test=(name,...args)=>{if(unpublishedCancelOnly){if(name.startsWith('UNPUBLISHED_PREPARATION_CANCEL_NEW:')&&(!unpublishedCancelEdgeOnly||name.includes('edge ')))return nodeTest(name,...args);return;}if(missingPatternOnly){if(name.startsWith('STAFFING_MISSING_PATTERN_NEW:')&&(!missingPatternEmptyArrivalOnly||name.startsWith('STAFFING_MISSING_PATTERN_NEW: empty-selection arrival'))&&(!missingPatternOriginalRecoveryOnly||name==='STAFFING_MISSING_PATTERN_NEW: saved original reload without live callout checkboxes stays GET-only'))return nodeTest(name,...args);return;}if(unresolvedPreviewOnly){if(name.startsWith('APPROVED_UNRESOLVED_PREVIEW_NEW:'))return nodeTest(name,...args);return;}if(approvedRecoveryHttpOnly){if(name.startsWith('APPROVED_RECOVERY_CURRENT_HTTP_NEW:'))return nodeTest(name,...args);return;}if(approvedRecoveryOnly){if(name.startsWith('APPROVED_CONFIRMATION_RECOVERY_NEW:')&&(!approvedRecoveryReproducerOnly||name==='APPROVED_CONFIRMATION_RECOVERY_NEW: unknown confirmation retry never sends a second POST'))return nodeTest(name,...args);return;}if(weekArrivalOnly){if(name.startsWith('CURRENT_WEEK_ARRIVAL_NEW:')&&(!weekArrivalReproducerOnly||name==='CURRENT_WEEK_ARRIVAL_NEW: queued selection callback while busy cannot acknowledge stale requested week'))return nodeTest(name,...args);return;}if(originalResumeOnly){if(name.startsWith('ORIGINAL_CONFIRMATION_RESUME_NEW:')&&(!originalResumeReproducerOnly||name==='ORIGINAL_CONFIRMATION_RESUME_NEW: principal loss after last API check cannot publish accepted revision CURRENT'))return nodeTest(name,...args);return;}if(turnoverPrincipalOnly){if(name.startsWith('TURNOVER_ORIGINAL_PRINCIPAL_NEW:')&&(!turnoverPrincipalUnknownOnly||name==='TURNOVER_ORIGINAL_PRINCIPAL_NEW: unchanged principal retains one unknown original and blocks successor resubmission'))return nodeTest(name,...args);return;}if(serverDateTurnoverOnly){if(name.startsWith('SERVER_DATE_TURNOVER_NEW:')&&(!serverDateMissingOnly||name==='SERVER_DATE_TURNOVER_NEW: missing invalid or out-of-week server day never falls back to local or selected day'))return nodeTest(name,...args);return;}if(rosterLiteralOnly){if(name.startsWith('ROSTER_LITERAL_DEVICE_NEW:'))return nodeTest(name,...args);return;}if(a1CurrentOnly===name.startsWith('A1 CURRENT SQL DTO:'))return nodeTest(name,...args);};
const require=createRequire(import.meta.url),A=require('../memphis-scheduler-actions.js'),P=require('../memphis-approved-schedule.js');
const MID='11000000-0000-4000-8000-000000000001',CID='12000000-0000-4000-8000-000000000001',PID='13000000-0000-4000-8000-000000000001',SOURCE='14000000-0000-4000-8000-000000000001';

// NEW unpublished-preparation cancellation cases use the existing actual
// page/API/actions VM and inert storage/fetch. No HTTP/SQL/browser authority.
function unpublishedCancellationFixture(initial='PREPARING'){
 const f=missingPatternFixture(),get=f.context.document.getElementById,prior=f.context.fetch;
 f.context.document.getElementById=id=>id==='scheduler-cancel-preparation'&&!f.nodes.has(id)?null:get(id);
 let state='PREPARING',staged=false,mode='ok',hook=async()=>{},readPatch=()=>{},replyPatch=()=>{},dialog=true,dialogs=0,observedMarker=null;
 if(initial==='PREPARED')f.setNextPrepare('prepared');
 const response=data=>({ok:true,status:200,json:async()=>({ok:true,data:structuredClone(data)})});
 const dto=()=>{
  const p=f.prepared(),v={...p,state,created_at:'2026-10-05T08:00:00.000000+00:00',prepared_at:staged?'2026-10-05T08:01:00.000000+00:00':null,
   accepted_at:null,accepted_revision:null,accepted_receipt:null,current_service_date:'2026-10-06',original_cancellation_target:null,
   candidate_row_count:staged?2:null,candidate_bytes:staged?200:null,candidate_summary:staged?{weeks:1,projections:1,lunches:1,scheduleRefreshes:0}:null};
  if(!staged)for(const k of ['preview_digest','candidate_set_digest','input_digest','publication_vector'])v[k]=null;
  if(state!=='PREPARED')v.preview=null;
  if(state==='ACCEPTED')Object.assign(v,f.accepted(),{accepted_at:'2026-10-05T08:02:00.000000+00:00'});
  readPatch(v);return v;
 };
 f.context.fetch=async(url,options)=>{
  const route=new URL(url).pathname;
  if(route===A.staffingCommandPath+'/'+f.operation){
   f.trace.push({route,options});await hook('get-fetch');return{ok:true,status:200,json:async()=>{const data=dto();await hook('get-json');return{ok:true,data};}};
  }
  if(route.endsWith('/cancel')){
   f.trace.push({route,options});observedMarker=structuredClone(f.actions.pending().command.cancellationAttempt);await hook('post-fetch');
   if(mode==='lost-before')throw Error('UNIT cancellation reply unavailable before commit');
   state='CANCELLED';
   if(mode==='lost-after')throw Error('UNIT cancellation reply unavailable after commit');
   const data={operation_id:f.operation,state:'CANCELLED',cancelled:true,replayed:false};replyPatch(data);
   return{ok:true,status:200,json:async()=>{await hook('post-json');return{ok:true,data};}};
  }
  const result=await prior(url,options);
  if(route.endsWith('/prepare')&&initial==='PREPARED'){state='PREPARED';staged=true;}
  if(route.endsWith('/confirm'))state='ACCEPTED';
  return result;
 };
 const headers=f.auth.opsManagerAuthHeaders;f.auth.opsManagerAuthHeaders=async()=>{const h=await headers();await hook('auth');return h;};
 f.context.confirmAction=async(message,options)=>{dialogs++;assert.match(message,/exact unpublished.*does not cancel any accepted schedule/i);
  assert.equal(options.title,'Cancel unpublished preparation');return typeof dialog==='function'?dialog():dialog;};
 return{...f,get actions(){return f.actions;},dto,attach:f.attach,cancel:()=>vm.runInContext('cancelUnpublishedPreparation()',f.context),
  setState:v=>state=v,setMode:v=>mode=v,setHook:v=>hook=v,setReadPatch:v=>readPatch=v,setReplyPatch:v=>replyPatch=v,setDialog:v=>dialog=v,
  dialogs:()=>dialogs,marker:()=>observedMarker,cancels:()=>f.trace.filter(t=>t.route.endsWith('/cancel')),
  raw:()=>[...f.map.values()][0],resume:()=>f.page.resumeStaffingPreview(),
  useAfterApiHook:fn=>{const actions=A.create({auth:f.auth,storage:f.storage,baseUrl:f.page.state.baseUrl,
   api:async(...args)=>{const value=await f.page.api(...args);fn(value);return value;},
   onState:r=>{f.page.state.pending=r;vm.runInContext('renderPending()',f.context);}});
   f.page.state.actions=actions;return actions;},
 };
}
for(const phase of ['PREPARING','PREPARED'])test('UNPUBLISHED_PREPARATION_CANCEL_NEW: deliberate '+phase+' cancel is one original POST and independent GET before local retirement',async()=>{
 const f=unpublishedCancellationFixture(phase);await f.start();const r=structuredClone(f.actions.pending()),view=JSON.stringify(f.page.state.snapshot),n=f.trace.length;
 const button=f.nodes.get('scheduler-cancel-preparation');assert.equal(button.hidden,false);assert.equal(button.textContent,'Cancel unpublished preparation');
 const result=await f.cancel();assert.equal(result.state,'CANCELLED');assert.equal(f.dialogs(),1);
 assert.deepEqual(f.trace.slice(n).map(t=>[t.route,t.options.method||'GET']),[
  [A.staffingCommandPath+'/'+f.operation,'GET'],[A.staffingCommandPath+'/'+f.operation+'/cancel','POST'],[A.staffingCommandPath+'/'+f.operation,'GET']]);
 assert.equal(f.cancels()[0].options.body,'{}');assert.equal(f.marker().encoded,r.encoded);assert.equal(f.marker().operationId,r.command.operationId);
 assert.equal(f.marker().semanticDigest,r.command.semanticDigest);assert.deepEqual(f.marker().weekBindings,r.weekBindings);
 assert.equal(f.marker().principal.credentialId,CID);assert.equal(f.map.size,0);assert.equal(f.actions.pending(),null);
 assert.equal(JSON.stringify(f.page.state.snapshot),view);assert.equal(f.begins().length,1);assert.equal(f.prepares().length,1);
 assert.equal(f.confirmations().length,0);assert.equal(f.confirmationKeys(),0);assert.equal(f.nonces(),1);
 assert.match(f.page.els.status.textContent,/exact original reads CANCELLED.*protected command history remains.*No accepted schedule or route verification/);
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: declining dialog or changing its original form sends no cancel request',async()=>{
 for(const action of ['decline','selection','principal','saved-body']){
  const f=unpublishedCancellationFixture();await f.start();const before=f.raw(),n=f.trace.length;
  f.setDialog(()=>{if(action==='selection')f.changeSelection();if(action==='principal')f.patch({credential_id:SOURCE});
   if(action==='saved-body'){const key=[...f.map.keys()][0],r=JSON.parse(f.raw());r.body.absence_kind='pto';r.encoded=JSON.stringify(r.body);f.map.set(key,JSON.stringify(r));}
   return action!=='decline';});
  if(action==='decline')await f.cancel();else await assert.rejects(f.cancel(),/changed|session|preparation/);
  assert.equal(f.trace.length,n);assert.equal(f.cancels().length,0);if(action!=='saved-body')assert.equal(f.raw(),before);
 }
});
for(const mode of ['lost-before','lost-after'])test('UNPUBLISHED_PREPARATION_CANCEL_NEW: '+mode+' restart is exact GET-only and never resend or confirm',async()=>{
 const f=unpublishedCancellationFixture();await f.start();const original=structuredClone(f.actions.pending());f.setMode(mode);
 await assert.rejects(f.cancel(),/reply unavailable/);const saved=structuredClone(f.actions.pending());assert.ok(saved.command.cancellationAttempt);
 assert.equal(saved.encoded,original.encoded);assert.deepEqual(saved.body,original.body);assert.equal(saved.command.confirmationKey,null);
 assert.match(f.nodes.get('scheduler-pending-text').textContent,/cancellation was attempted.*No cancellation or confirmation will be resent/);
 assert.equal(f.nodes.get('scheduler-cancel-preparation').hidden,true);assert.equal(f.nodes.get('scheduler-prepare-retry').hidden,true);
 const n=f.trace.length;f.setMode('ok');f.attach();assert.equal(f.actions.acknowledgeCancelledStaffing({state:'CANCELLED'}),false);
 await assert.rejects(f.actions.cancelStaffingPreparation(),/unattempted/);await assert.rejects(f.actions.retryStaffingPreparation(),/read-only/);
 await assert.rejects(f.actions.confirmStaffing({}),/unavailable/);await f.resume();
 assert.ok(f.trace.slice(n).every(t=>t.options.method==='GET'));assert.equal(f.cancels().length,1);
 if(mode==='lost-after')assert.equal(f.map.size,0);
 else{assert.equal(f.raw(),JSON.stringify(saved));await f.resume();assert.equal(f.cancels().length,1);assert.equal(f.map.size,1);}
 assert.equal(f.begins().length,1);assert.equal(f.prepares().length,1);assert.equal(f.confirmationKeys(),0);assert.equal(f.confirmations().length,0);
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: accepted or unknown original confirmation cannot acquire cancellation',async()=>{
 for(const kind of ['unknown','accepted','elsewhere','missing-operation']){
  const f=unpublishedCancellationFixture('PREPARED');await f.start();
  if(kind==='unknown')await assert.rejects(f.actions.confirmStaffing(f.prepared()),/lost confirmation/);
  if(kind==='accepted'){f.setConfirmMode('accepted');await f.actions.confirmStaffing(f.prepared());}
  if(kind==='elsewhere')f.setState('ACCEPTED');
  if(kind==='missing-operation'){const key=[...f.map.keys()][0],r=JSON.parse(f.raw());r.command.operationId=null;r.command.phase='BEGIN';f.map.set(key,JSON.stringify(r));f.actions.pending();}
  const before=f.raw(),n=f.trace.length;await assert.rejects(f.actions.cancelStaffingPreparation(),/unattempted|readback/);
  assert.equal(f.raw(),before);assert.equal(f.cancels().length,0);assert.ok(f.trace.slice(n).every(t=>t.options.method==='GET'));
 }
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: short or mismatching cancel reply cannot clear a retained original',async()=>{
 for(const patch of [v=>v.operation_id=PID,v=>v.state='ACCEPTED',v=>v.state='CANCELLED_BY_SUCCESSOR',
  v=>v.cancelled=false,v=>delete v.replayed,v=>v.replayed='false',v=>v.semantic_digest='a'.repeat(64)]){
  const f=unpublishedCancellationFixture();await f.start();const original=f.actions.pending();f.setReplyPatch(patch);
  await assert.rejects(f.cancel(),/response is unconfirmed/);assert.equal(f.cancels().length,1);
  assert.ok(f.actions.pending().command.cancellationAttempt);assert.equal(f.actions.pending().encoded,original.encoded);
  assert.equal(f.actions.acknowledgeCancelledStaffing(),false);assert.equal(f.actions.pending().state,'PENDING');
 }
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: foreign missing malformed or changed terminal GET remains held despite cancelled reply',async()=>{
 for(const patch of [v=>v.operation_id=PID,v=>v.prepared_by_manager_id=SOURCE,v=>v.semantic_digest='b'.repeat(64),
  v=>v.semantic_body.employeeId=PID,v=>v.expected_revision++,v=>v.created_at='2026-10-05T09:00:00Z',
  v=>v.state='CANCELLED_BY_SUCCESSOR',v=>delete v.accepted_receipt,v=>v.accepted_revision=43,
  v=>v.extra=true,v=>v.original_cancellation_target={},v=>v.preview={},v=>v.candidate_bytes=1]){
  const f=unpublishedCancellationFixture();await f.start();const original=f.actions.pending();f.setReadPatch(v=>{if(v.state==='CANCELLED')patch(v);});
  await assert.rejects(f.cancel(),/readback|candidate/);assert.equal(f.map.size,1);assert.equal(f.actions.pending().encoded,original.encoded);
  assert.equal(f.actions.acknowledgeCancelledStaffing(),false);assert.equal(f.confirmations().length,0);
 }
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: malformed original preflight refuses before attempt marker and POST',async()=>{
 for(const patch of [v=>delete v.created_at,v=>v.extra=true,v=>v.expected_revision='42',v=>v.semantic_body.absenceKind='pto',
  v=>v.state='UNKNOWN',v=>v.prepared_by_manager_id=SOURCE,v=>v.preview_digest='b'.repeat(64)]){
  const f=unpublishedCancellationFixture();await f.start();const raw=f.raw();f.setReadPatch(patch);
  await assert.rejects(f.cancel(),/readback|malformed/);assert.equal(f.raw(),raw);assert.equal(f.cancels().length,0);
 }
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: principal and saved-original changes across cancellation awaits cannot clear or overwrite',async()=>{
 for(const stage of ['auth','get-fetch','get-json','post-fetch','post-json'])for(const change of ['credential','semantic']){
  const f=unpublishedCancellationFixture();await f.start();let done=false,changedRaw;
  f.setHook(async actual=>{if(actual!==stage||done)return;done=true;
   if(change==='credential')f.patch({credential_id:SOURCE});
   else {const key=[...f.map.keys()][0],r=JSON.parse(f.raw());r.command.semanticDigest='b'.repeat(64);changedRaw=JSON.stringify(r);f.map.set(key,changedRaw);}
  });
  await assert.rejects(f.cancel(),/changed|preserved|saved/);assert.equal(f.map.size,1);if(change==='semantic')assert.equal(f.raw(),changedRaw);
  assert.ok(f.cancels().length<=1);assert.equal(f.confirmations().length,0);assert.equal(f.nonces(),1);
 }
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: live form Source and selection changes across awaits preserve the original',async()=>{
 for(const stage of ['auth','get-json','post-json'])for(const change of ['empty-selection','source','revision','date']){
  const f=unpublishedCancellationFixture();await f.start();let done=false;
  f.setHook(async actual=>{if(actual!==stage||done)return;done=true;
   if(change==='empty-selection')f.context.document.querySelectorAll=()=>[];
   if(change==='source')f.nodes.get('approved-source').value=SOURCE;
   if(change==='revision')f.page.state.snapshot.authority_revision++;
   if(change==='date')f.page.els.service_date.value='2026-10-07';
  });
  await assert.rejects(f.cancel(),/changed|selection/);assert.equal(f.map.size,1);assert.ok(f.cancels().length<=1);
  assert.equal(f.confirmations().length,0);
 }
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: last API-to-consumer view change cannot retire the verified original',async()=>{
 const f=unpublishedCancellationFixture();await f.start();const original=f.actions.pending();
 f.useAfterApiHook(value=>{if(value.state==='CANCELLED')f.changeSelection();});
 await assert.rejects(f.cancel(),/view or manager changed/);assert.equal(f.map.size,1);assert.equal(f.page.state.actions.pending().encoded,original.encoded);
 assert.ok(f.page.state.actions.pending().command.cancellationAttempt);assert.equal(f.cancels().length,1);
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: concurrent attempts and generic run cannot create a second cancellation POST',async()=>{
 const f=unpublishedCancellationFixture();await f.start();let release,entered;
 const arrived=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let once=false;
 f.setHook(async stage=>{if(stage==='get-fetch'&&!once){once=true;entered();await gate;}});
 const first=f.cancel();await arrived;await assert.rejects(f.actions.cancelStaffingPreparation(),/already in progress/);release();await first;
 assert.equal(f.cancels().length,1);const a=f.actions;await assert.rejects(a.run(A.staffingCommandPath+'/'+f.operation+'/cancel',{expected_revision:42,idempotency_key:'UNIT-not-a-cancel-port'}),/exact saved unpublished/);
 assert.equal(f.cancels().length,1);
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: edge exact named-manager button and empty-form cancellation restart remain bound',async()=>{
 const f=unpublishedCancellationFixture();await f.start();const original=f.actions.pending();
 f.page.state.pending={...original,managerId:SOURCE};f.render();assert.equal(f.nodes.get('scheduler-cancel-preparation').hidden,true);
 f.actions.pending();f.setMode('lost-after');await assert.rejects(f.cancel(),/reply unavailable/);const saved=f.raw(),n=f.trace.length;
 f.context.document.querySelectorAll=()=>[];f.attach();assert.equal(f.raw(),saved);await f.resume();
 assert.ok(f.trace.slice(n).every(t=>t.options.method==='GET'));assert.equal(f.cancels().length,1);assert.equal(f.map.size,0);
 assert.equal(f.nonces(),1);assert.equal(f.confirmations().length,0);assert.equal(f.confirmationKeys(),0);
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: edge valid nonterminal GET remains held after an asserted cancelled reply',async()=>{
 const f=unpublishedCancellationFixture('PREPARED');await f.start();const original=f.actions.pending();
 f.setReadPatch(value=>{if(value.state==='CANCELLED'){value.state='PREPARED';value.preview=f.prepared().preview;}});
 const value=await f.cancel();assert.equal(value.state,'PREPARED');assert.equal(f.actions.pending().encoded,original.encoded);
 assert.ok(f.actions.pending().command.cancellationAttempt);assert.equal(f.actions.acknowledgeCancelledStaffing(),false);
 assert.equal(f.cancels().length,1);assert.equal(f.map.size,1);assert.match(f.page.els.status.textContent,/outcome is unconfirmed/);
});
test('UNPUBLISHED_PREPARATION_CANCEL_NEW: write-ahead marker failure stops before provider prefix and fake readback cannot retire',async()=>{
 const f=unpublishedCancellationFixture();await f.start();const before=f.raw(),put=f.storage.setItem;
 f.storage.setItem=(key,value)=>{if(JSON.parse(value).command.cancellationAttempt)throw Error('UNIT cancellation marker storage failure');return put(key,value);};
 await assert.rejects(f.cancel(),/marker storage failure/);assert.equal(f.raw(),before);assert.equal(f.cancels().length,0);
 assert.equal(f.actions.acknowledgeCancelledStaffing(f.dto()),false);assert.equal(f.map.size,1);
});


// NEW missing-pattern owning component cases. Uses the existing VM/DOM/API
// fixture; all responses are synthetic UNIT DATA, not SQL/browser authority.
const missingPatternText='No release-admitted approved pattern matches the current staffing. The original request is preserved; nothing was accepted.';
function missingPatternFixture(){
 const f=unresolvedPreviewFixture(),get=f.context.document.getElementById,priorFetch=f.context.fetch;
 f.context.document.getElementById=id=>id==='scheduler-prepare-retry'&&!f.nodes.has(id)?null:get(id);
 f.setConflict();let envelopePatch=()=>{},phase='PREPARING',nextPrepare='missing',confirmMode='unknown',confirmationKeys=0,snapshotPatch=()=>{},snapshotGate=null;
 f.setOuterPatch(value=>{for(const key of Object.keys(value))delete value[key];Object.assign(value,{ok:false,code:'static_template_missing_approved_pattern',error:missingPatternText,operation_outcome:'rejected'});envelopePatch(value);});
 const originalSnapshot=structuredClone(f.page.state.snapshot);
 const originalBody=()=>JSON.parse(f.trace.find(t=>t.route===A.staffingCommandPath).options.body);
 const prepared=()=>{const b=originalBody(),binding={weekStart:'2026-10-05',publicationId:SOURCE,versionId:PID,authorityRevision:42};return{
  operation_id:f.operation,expected_revision:42,prepared_by_manager_id:MID,
  semantic_body:{commandKind:'absence',employeeId:MID,startDate:b.start_date,endDate:b.end_date,absenceKind:'daily_absence',targetAbsenceId:null},
  semantic_digest:'a'.repeat(64),state:'PREPARED',preview_digest:'b'.repeat(64),input_digest:'c'.repeat(64),candidate_set_digest:'d'.repeat(64),
  publication_vector:{expectedRevision:42,weeks:[binding]},preview:{schema:'memphis-zoo.staffing-command-preview.v1',weeks:[{
   week_start:binding.weekStart,publicationId:SOURCE,versionId:PID,database_projection_identity:'e'.repeat(64),replayDigest:'f'.repeat(64),
   compilerVersion:'UNIT-inert-only',sourceDigest:'c'.repeat(64),sourceDigestBasis:'envelope.authority.inputDigest',
   assignments:[],projectionAvailability:[],lunch_loans:[],lunch_responsibilities:[]}]}};};
 const accepted=()=>({...prepared(),state:'ACCEPTED',preview:null,accepted_revision:43,accepted_receipt:{event:'ACCEPTED',operation_id:f.operation,manager_id:MID,
  semantic_digest:'a'.repeat(64),preview_digest:'b'.repeat(64),candidate_set_digest:'d'.repeat(64),authority_revision:43,
  projections:{'2026-10-05':{projection_id:PID,publication_id:SOURCE,projection_identity:'e'.repeat(64),lunch_document_identity:'1'.repeat(64)}}}});
 const response=data=>({ok:true,status:200,json:async()=>({ok:true,data:structuredClone(data)})});
 f.context.fetch=async(url,options)=>{
  const route=new URL(url).pathname;
  if(route==='/static-weekly/manager-snapshot'){f.trace.push({route,options});const value=structuredClone(originalSnapshot);if(snapshotGate)await snapshotGate;snapshotPatch(value);return response(value);}
  if(route==='/static-weekly/approved-choices'){f.trace.push({route,options});return response({schema:'custodial.approved-schedule-choices.v1',initial:[]});}
  if(route.endsWith('/prepare')&&nextPrepare==='prepared'){f.trace.push({route,options});phase='PREPARED';return response({operation_id:f.operation,state:phase});}
  if(route.endsWith('/confirm')){f.trace.push({route,options});if(confirmMode==='unknown')throw Error('UNIT lost confirmation reply');phase='ACCEPTED';return response(accepted().accepted_receipt);}
  if(route===A.staffingCommandPath+'/'+f.operation&&phase!=='PREPARING'){f.trace.push({route,options});return response(phase==='ACCEPTED'?accepted():prepared());}
  return priorFetch(url,options);
 };
 let actions;function attach(){actions=A.create({auth:f.auth,storage:f.storage,baseUrl:f.page.state.baseUrl,api:f.page.api,nonce:()=>{confirmationKeys++;return CID;},
  onState:r=>{f.page.state.pending=r;vm.runInContext('renderPending()',f.context);}});f.page.state.actions=actions;return actions;}
 attach();
 return{...f,get actions(){return actions;},attach,prepared,accepted,originalSnapshot,confirmationKeys:()=>confirmationKeys,
  prepares:()=>f.trace.filter(t=>t.route.endsWith('/prepare')),begins:()=>f.trace.filter(t=>t.route===A.staffingCommandPath),
  confirmations:()=>f.trace.filter(t=>t.route.endsWith('/confirm')),
  setNextPrepare:v=>nextPrepare=v,setConfirmMode:v=>confirmMode=v,setEnvelopePatch:v=>envelopePatch=v,setSnapshotPatch:v=>snapshotPatch=v,setSnapshotGate:v=>snapshotGate=v,
  render:()=>vm.runInContext('renderPending();setControls();',f.context),
  retryFromPage:()=>vm.runInContext('retryMissingStaffingPreparation()',f.context),
  reload:async()=>{f.context.loadControlPlaneUrl=async()=>f.page.state.baseUrl;await f.page.init();actions=f.page.state.actions;}};
}
test('STAFFING_MISSING_PATTERN_NEW: exact 409 is a visible bound preparation hold, never command rejection',async()=>{
 const f=missingPatternFixture();await f.start();const r=f.actions.pending();
 assert.equal(r.state,'PENDING');assert.equal(r.command.phase,'PREPARING');assert.equal(r.command.confirmationAttempted,false);
 assert.equal(r.command.preparationIssue.code,'static_template_missing_approved_pattern');assert.equal(r.command.preparationIssue.message,missingPatternText);
 assert.equal(r.command.preparationIssue.encoded,r.encoded);assert.equal(r.command.preparationIssue.operationId,r.command.operationId);
 assert.equal(r.command.preparationIssue.semanticDigest,r.command.semanticDigest);assert.equal(r.command.preparationIssue.principal.credentialId,CID);
 assert.match(f.nodes.get('scheduler-pending-text').textContent,/No release-admitted approved pattern.*nothing was accepted.*No confirmation/);
 assert.equal(f.nodes.get('scheduler-dismiss').hidden,true);assert.equal(f.nodes.get('scheduler-prepare-retry').hidden,false);
 const confirm=f.nodes.get('staffing-confirm-btn');assert.ok(!confirm||confirm.hidden===true||confirm.disabled===true);
 await assert.rejects(f.actions.confirmStaffing({}),/confirmation is unavailable/);assert.equal(f.confirmations().length,0);
 assert.equal(f.prepares().length,1);assert.equal(f.begins().length,1);assert.equal(f.nonces(),1);assert.equal(f.confirmationKeys(),0);
 assert.throws(()=>f.actions.discardRejected(),/explicitly rejected/);assert.equal(f.map.size,1);
});
test('STAFFING_MISSING_PATTERN_NEW: reload refresh and resume remain GET-only with exact body keys and issue',async()=>{
 const f=missingPatternFixture();await f.start();const r=structuredClone(f.actions.pending()),count=f.trace.length;
 await f.reload();await f.actions.reviewStaffing();await f.actions.retry();await f.page.resumeStaffingPreview();
 assert.ok(f.trace.slice(count).every(t=>(t.options.method||'GET')==='GET'));
 const now=f.actions.pending();assert.equal(now.encoded,r.encoded);assert.deepEqual(now.body,r.body);assert.deepEqual(now.command,r.command);
 assert.equal(f.nonces(),1);assert.equal(f.confirmationKeys(),0);assert.equal(f.prepares().length,1);assert.equal(f.begins().length,1);
 assert.match(f.nodes.get('scheduler-pending-text').textContent,/Last preparation: No release-admitted/);
});
test('STAFFING_MISSING_PATTERN_NEW: separate retry button reads original/current basis then sends only one original prepare',async()=>{
 const f=missingPatternFixture();await f.start();const original=f.actions.pending(),n=f.trace.length;
 await f.nodes.get('scheduler-prepare-retry').listeners.get('click')();
 const suffix=f.trace.slice(n);assert.deepEqual(suffix.map(t=>[t.route,t.options.method||'GET']),[
  [A.staffingCommandPath+'/'+f.operation,'GET'],['/static-weekly/manager-snapshot','GET'],[A.staffingCommandPath+'/'+f.operation+'/prepare','POST']]);
 assert.equal(suffix[2].options.body,'{}');assert.equal(f.prepares().length,2);assert.equal(f.begins().length,1);assert.equal(f.confirmations().length,0);
 assert.equal(f.actions.pending().encoded,original.encoded);assert.equal(f.actions.pending().command.operationId,original.command.operationId);
 assert.equal(f.actions.pending().command.confirmationKey,null);assert.equal(f.nonces(),1);assert.equal(f.confirmationKeys(),0);
 assert.equal(f.actions.pending().state,'PENDING');assert.equal(f.actions.pending().command.preparationIssue.message,missingPatternText);
});
test('STAFFING_MISSING_PATTERN_NEW: explicit retry rereads prepared original and clears only the dependency, never accepts',async()=>{
 const f=missingPatternFixture();await f.start();const original=f.actions.pending();f.setNextPrepare('prepared');
 const value=await f.actions.retryStaffingPreparation();assert.equal(value.state,'PREPARED');
 const r=f.actions.pending();assert.equal(r.state,'PENDING');assert.equal(r.command.phase,'PREPARED');assert.equal(r.command.preparationIssue,undefined);
 assert.equal(r.command.confirmationAttempted,false);assert.equal(r.command.confirmationKey,null);assert.equal(r.encoded,original.encoded);
 assert.equal(r.command.operationId,original.command.operationId);assert.equal(f.prepares().length,2);assert.equal(f.nonces(),1);
 assert.equal(f.confirmationKeys(),0);assert.equal(f.confirmations().length,0);
});
test('STAFFING_MISSING_PATTERN_NEW: changed current revision/publication/version refuses before retry POST',async()=>{
 for(const patch of [v=>v.authority_revision++,v=>v.current_publication.publication_id=PID,v=>v.current_publication.version_id=SOURCE]){
  const f=missingPatternFixture();await f.start();const before=structuredClone(f.actions.pending()),n=f.trace.length;f.setSnapshotPatch(patch);
  await assert.rejects(f.actions.retryStaffingPreparation(),/publication\/version\/revision changed/);
  assert.ok(f.trace.slice(n).every(t=>t.options.method==='GET'));assert.deepEqual(f.actions.pending(),before);assert.equal(f.prepares().length,1);
 }
});
test('STAFFING_MISSING_PATTERN_NEW: late principal change cannot retain or display the dependency for another owner',async()=>{
 for(const stage of ['auth','fetch','json'])for(const principal of [{credential_id:SOURCE},{manager_id:SOURCE},{device_id:'UNIT-successor'}]){
  const f=missingPatternFixture();f.setAwaitHook(phase=>{if(phase===stage)f.patch(principal);});await f.start();
  const stored=JSON.parse([...f.map.values()][0]);assert.equal(stored.command.preparationIssue,undefined);
  assert.equal(f.confirmations().length,0);assert.equal(f.nonces(),1);
  assert.doesNotMatch(f.nodes.get('scheduler-pending-text').textContent,/Last preparation: No release-admitted/);
 }
});
test('STAFFING_MISSING_PATTERN_NEW: late Source or saved original replacement cannot save a foreign dependency',async()=>{
 for(const change of ['revision','selected-source','pending-semantic','pending-body']){
  const f=missingPatternFixture();f.setAwaitHook(phase=>{if(phase!=='json')return;
   if(change==='revision')f.page.state.snapshot.authority_revision++;
   if(change==='selected-source')f.nodes.get('approved-source').value=SOURCE;
   if(change.startsWith('pending-')){const key=[...f.map.keys()][0],r=JSON.parse(f.map.get(key));if(change==='pending-semantic')r.command.semanticDigest='b'.repeat(64);
    else {r.body.expected_revision++;r.encoded=JSON.stringify(r.body);r.weekBindings[0].authorityRevision++;}f.map.set(key,JSON.stringify(r));}
  });await f.start();const saved=JSON.parse([...f.map.values()][0]);assert.equal(saved.command.preparationIssue,undefined);
  assert.equal(f.prepares().length,1);assert.equal(f.confirmations().length,0);assert.equal(f.nonces(),1);
 }
});
test('STAFFING_MISSING_PATTERN_NEW: malformed or asserted accepted/unknown envelopes cannot become a held proof',async()=>{
 for(const patch of [v=>v.operation_outcome='accepted',v=>v.operation_outcome='unknown',v=>delete v.operation_outcome,
  v=>v.error='Untrusted raw replacement',v=>v.accepted_result={ok:true},v=>v.operation_id=PID]){
  const f=missingPatternFixture();f.setEnvelopePatch(patch);await f.start();assert.equal(f.actions.pending().command.preparationIssue,undefined);
  assert.equal(f.actions.pending().state,'PENDING');assert.equal(f.confirmations().length,0);
  assert.doesNotMatch(f.page.els.status.textContent,/Untrusted raw replacement/);
 }
});
test('STAFFING_MISSING_PATTERN_NEW: retained issue cannot migrate to a successor credential or modified original',async()=>{
 const f=missingPatternFixture();await f.start();const raw=[...f.map.values()][0],count=f.trace.length;f.patch({credential_id:SOURCE});f.attach();
 assert.throws(()=>f.actions.pending(),/dependency or original manager changed/);f.render();
 assert.doesNotMatch(f.nodes.get('scheduler-pending-text').textContent,/Last preparation: No release-admitted/);
 assert.equal([...f.map.values()][0],raw);assert.equal(f.trace.length,count);
});
test('STAFFING_MISSING_PATTERN_NEW: actual unknown or accepted confirmation can never use preparation retry',async()=>{
 for(const mode of ['unknown','accepted']){
  const f=missingPatternFixture();f.setNextPrepare('prepared');await f.start();f.setConfirmMode(mode);
  if(mode==='unknown')await assert.rejects(f.actions.confirmStaffing(f.prepared()),/lost confirmation/);
  else assert.equal((await f.actions.confirmStaffing(f.prepared())).state,'ACCEPTED');
  const before=structuredClone(f.actions.pending()),count=f.trace.length;
  await assert.rejects(f.actions.retryStaffingPreparation(),/Confirmation recovery is read-only/);assert.equal(f.trace.length,count);
  await f.actions.reviewStaffing();assert.ok(f.trace.slice(count).every(t=>t.options.method==='GET'));
  assert.equal(f.actions.pending().command.confirmationAttempted,true);assert.equal(f.actions.pending().state,mode==='unknown'?'PENDING':'ACCEPTED');
  assert.equal(f.prepares().length,1);assert.equal(f.confirmations().length,1);assert.equal(f.begins().length,1);
  assert.equal(f.actions.pending().encoded,before.encoded);assert.equal(f.actions.pending().command.confirmationKey,before.command.confirmationKey);
 }
});
test('STAFFING_MISSING_PATTERN_NEW: Source changes during explicit current-basis read block its prepare dispatch',async()=>{
 const f=missingPatternFixture();await f.start();const n=f.trace.length;
 f.setSnapshotPatch(()=>f.page.state.snapshot.authority_revision++);
 await assert.rejects(f.retryFromPage(),/changed/);assert.ok(f.trace.slice(n).every(t=>t.options.method==='GET'));
 assert.equal(f.prepares().length,1);assert.equal(f.actions.pending().command.preparationIssue.code,'static_template_missing_approved_pattern');
});
test('STAFFING_MISSING_PATTERN_NEW: concurrent explicit retries cannot enqueue two preparation requests',async()=>{
 const f=missingPatternFixture();await f.start();let release;f.setSnapshotGate(new Promise(r=>release=r));
 const first=f.actions.retryStaffingPreparation();await Promise.resolve();await assert.rejects(f.actions.retryStaffingPreparation(),/already in progress/);
 release();await assert.rejects(first,/No release-admitted/);assert.equal(f.prepares().length,2);assert.equal(f.begins().length,1);
});

// New owning journey through actual page/api/actions and existing inert DOM.
// Synthetic auth/backend DTOs ONLY: no genuine manager, HTTP, SQL or browser.
test('STAFFING_MISSING_PATTERN_NEW: saved original reload without live callout checkboxes stays GET-only',async()=>{
 const f=missingPatternFixture();await f.start();const original=structuredClone(f.actions.pending());
 // A reloaded page has no newly selected callout. This must not prevent a
 // bound original status read or turn it into another preparation request.
 f.context.document.querySelectorAll=()=>[];f.attach();const n=f.trace.length;
 await f.actions.reviewStaffing();
 assert.ok(f.trace.length>n&&f.trace.slice(n).every(t=>(t.options.method||'GET')==='GET'));
 assert.deepEqual(f.actions.pending(),original);assert.equal(f.prepares().length,1);assert.equal(f.begins().length,1);
 assert.equal(f.confirmations().length,0);
});
test('STAFFING_MISSING_PATTERN_NEW: empty-selection arrival with a new form choice refuses late status',async()=>{
 const f=missingPatternFixture();await f.start();const original=structuredClone(f.actions.pending()),priorSelection=f.context.document.querySelectorAll;
 f.context.document.querySelectorAll=()=>[];f.attach();const n=f.trace.length,priorFetch=f.context.fetch;
 let entered,release;const arrived=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 f.context.fetch=async(url,options)=>{const result=await priorFetch(url,options);if(new URL(url).pathname===A.staffingCommandPath+'/'+f.operation){entered();await gate;}return result;};
 const attempt=f.actions.reviewStaffing();await arrived;f.context.document.querySelectorAll=priorSelection;release();
 await assert.rejects(attempt,/preview selection changed/);
 assert.deepEqual(f.actions.pending(),original);assert.ok(f.trace.slice(n).every(t=>(t.options.method||'GET')==='GET'));
 assert.equal(f.prepares().length,1);assert.equal(f.confirmations().length,0);
});
test('STAFFING_MISSING_PATTERN_NEW: empty-selection arrival explicit retry keeps original and checks current basis',async()=>{
 const f=missingPatternFixture();await f.start();const original=structuredClone(f.actions.pending());
 f.context.document.querySelectorAll=()=>[];f.attach();const n=f.trace.length;
 await assert.rejects(f.actions.retryStaffingPreparation(),/No release-admitted approved pattern/);
 assert.deepEqual(f.actions.pending(),original);
 assert.deepEqual(f.trace.slice(n).map(t=>[t.route,t.options.method||'GET']),[
  [A.staffingCommandPath+'/'+f.operation,'GET'],['/static-weekly/manager-snapshot','GET'],[A.staffingCommandPath+'/'+f.operation+'/prepare','POST']]);
 assert.equal(f.prepares().length,2);assert.equal(f.begins().length,1);assert.equal(f.confirmations().length,0);
 assert.equal(f.confirmationKeys(),0);
});
function unresolvedPreviewFixture(){
 const f=datedPreviewFixture(),operation='17000000-0000-4000-8000-000000000001',trace=[];
 f.page.els.service_date.value='2026-10-06';f.page.els.absence_type.value='daily_absence';
 f.context.document.getElementById('absence-end-date').value='2026-10-06';
 Object.assign(f.page.state.snapshot,{projection_status:'current',latest_projection:{projection_id:PID},
  current_publication:{publication_id:SOURCE,version_id:PID},
  assignments:[{service_date:'2026-10-06',plan_work_id:'2:known-parent',work_snapshot:{workId:'2:known-parent',locationNameSnapshot:'Current known room'}}]});
 f.page.state.snapshot.availability.push({...f.page.state.snapshot.availability[0],day_of_week:2});
 f.page.state.approvedChoices={initial:[]};f.context.document.getElementById('approved-source').value='';
 let checked=CID,gate=null,jsonGate=null,authGate=null,nonces=0,headers=0,patch=()=>{},status=422,envelope='error',awaitHook=()=>{},readData=false,outerPatch=()=>{};
 const value={schema:'custodial.approved-static-unresolved-preview.v1',status:'UNRESOLVED',sourcePublicationId:SOURCE,
  authorityRevision:42,serviceDate:'2026-10-06',kind:'DATED_ABSENCE',templateId:null,unresolved:[
   {dayOfWeek:2,parentWorkId:'2:known-parent',window:{start:'15:00',end:'15:15'},reason:'NO_ELIGIBLE_INTERVAL_OWNER',originalBudget:8,requiredSegments:null},
   {dayOfWeek:2,parentWorkId:'2:unknown-parent',window:{start:'09:45',end:'17:00'},reason:'ORIGINAL_BUDGET_INSUFFICIENT_FOR_POSITIVE_SEGMENTS',originalBudget:3,requiredSegments:5}]};
 f.context.document.querySelectorAll=selector=>selector==='[data-callout-slot]:checked:not(:disabled)'?[{dataset:{calloutSlot:checked}}]:[];
 f.context.crypto={randomUUID:()=>{nonces++;return CID;}};
 f.auth.opsManagerAuthHeaders=async()=>{headers++;if(headers===3){awaitHook('auth');if(authGate)await authGate;}return {'x-source-fixture':'not-real-auth'};};
 f.page.state.baseUrl='https://scheduler.onrender.com';f.page.state.principal=A.principal(f.auth);
 const response=data=>({ok:true,status:200,json:async()=>({ok:true,data})});
 f.context.fetch=async(url,options)=>{
  const route=new URL(url).pathname;trace.push({route,options});
  if(route===A.staffingCommandPath){assert.equal(options.method,'POST');return response({operation_id:operation,expected_revision:42,semantic_digest:'a'.repeat(64)});}
  if(route===A.staffingCommandPath+'/'+operation){if(readData)return response(structuredClone(value));const original=JSON.parse(trace.find(t=>t.route===A.staffingCommandPath).options.body);return response({operation_id:operation,expected_revision:42,prepared_by_manager_id:MID,
   semantic_body:{commandKind:'absence',employeeId:MID,startDate:original.start_date,endDate:original.end_date,absenceKind:'daily_absence',targetAbsenceId:null},
   semantic_digest:'a'.repeat(64),state:'PREPARING'});}
  if(route===A.staffingCommandPath+'/'+operation+'/prepare'){
   assert.equal(options.method,'POST');assert.equal(options.body,'{}');awaitHook('fetch');if(gate)await gate;
   return {ok:status===200,status,json:async()=>{awaitHook('json');if(jsonGate)await jsonGate;const dto=structuredClone(value);patch(dto);
    const payload=envelope==='data'?{ok:true,data:dto}:{ok:false,code:'static_template_dated_coverage_unresolved',error:'Synthetic generic preview failure',unresolved_preview:dto};outerPatch(payload);return payload;}};
  }
  assert.fail('Unmatched Source-only route '+route);
 };
 const actions=A.create({auth:f.auth,storage:f.storage,baseUrl:f.page.state.baseUrl,api:f.page.api,onState:r=>{f.page.state.pending=r;}});
 f.page.state.actions=actions;
 return {...f,operation,trace,value,actions,nonces:()=>nonces,start:()=>f.page.applyDayChanges(),setGate:p=>gate=p,setJsonGate:p=>jsonGate=p,
  setAuthGate:p=>authGate=p,setPatch:fn=>patch=fn,setData:()=>{status=200;envelope='data';},changeSelection:()=>checked=SOURCE,
  setAwaitHook:fn=>awaitHook=fn,setReadData:()=>readData=true,setOuterPatch:fn=>outerPatch=fn,setConflict:()=>{status=409;outerPatch=v=>v.operation_outcome='rejected';}};
}
test('APPROVED_UNRESOLVED_PREVIEW_NEW: actual original prepare failure renders exact windows and disables confirmation',async()=>{
 const f=unresolvedPreviewFixture(),original=structuredClone(f.page.state.snapshot);await f.start();
 assert.equal(f.nodes.get('approved-preview-panel').hidden,false,'Unresolved current window was lost into generic error');
 assert.match(f.nodes.get('approved-preview-summary').textContent,/unresolved|not.*confirm/i);
 assert.equal(f.nodes.get('staffing-confirm-btn').disabled,true);assert.equal(f.page.els.publish_btn.disabled,true);
 const rows=f.nodes.get('approved-preview-rows').children;assert.equal(rows.length,2);
 assert.match(rows[0].children.map(c=>c.textContent).join(' '),/Current known room.*15:00.*15:15/);
 assert.doesNotMatch(rows[1].children.map(c=>c.textContent).join(' '),/Current known room|unknown-parent/);
 assert.equal(f.page.state.preview,null);assert.equal(f.page.state.staffingPreview,null);
 assert.deepEqual(f.page.state.snapshot,original);assert.equal(f.trace.length,3);assert.equal(f.nonces(),1);
 assert.equal(f.actions.pending().state,'PENDING');assert.equal(f.actions.pending().command.confirmationAttempted,false);
});
test('APPROVED_UNRESOLVED_PREVIEW_NEW: closed DTO refuses malformed fields without getter or reason coercion',()=>{
 const f=unresolvedPreviewFixture(),binding={sourcePublicationId:SOURCE,authorityRevision:42,serviceDate:'2026-10-06',kind:'DATED_ABSENCE',templateId:null};
 const accepted=P.validateUnresolvedPreview(f.value,binding);assert.ok(Object.isFrozen(accepted.unresolved[0].window));
 let reads=0;
 for(const change of [v=>v.schema='foreign',v=>v.status='ACCEPTED',v=>v.kind='RECURRING_STAFFING',v=>v.sourcePublicationId=PID,
  v=>v.authorityRevision='42',v=>v.authorityRevision=43,v=>v.serviceDate='2026-10-07',v=>v.templateId='foreign',
  v=>v.previewDigest='a'.repeat(64),v=>v.unresolved=[],v=>v.unresolved[0].dayOfWeek='2',v=>v.unresolved[0].window.end='15:00',
  v=>v.unresolved[0].window.extra=true,v=>v.unresolved[0].reason='made-up',v=>v.unresolved[0].originalBudget=0,
  v=>v.unresolved[1].requiredSegments=3,v=>v.unresolved[0].requiredSegments=1,v=>{delete v.unresolved[0];},
  v=>Object.defineProperty(v,'authorityRevision',{get(){reads++;return 42;}}),
  v=>{v.unresolved[0].reason={toString(){reads++;return 'NO_ELIGIBLE_INTERVAL_OWNER';}};}]){
  const value=structuredClone(f.value);change(value);assert.throws(()=>P.validateUnresolvedPreview(value,binding),/malformed|selection/);
 }
 assert.equal(reads,0);assert.equal(f.trace.length,0);
});
test('APPROVED_UNRESOLVED_PREVIEW_NEW: both response frames remain nonconfirmable and original GET cannot resend prepare',async()=>{
 const f=unresolvedPreviewFixture();f.setData();await f.start();assert.ok(f.page.state.unresolvedPreview);const original=f.actions.pending().encoded;
 const before=f.trace.length;await assert.rejects(f.page.publishDraft(),/saved schedule/);
 await assert.rejects(f.page.confirmStaffingPreview(),/unresolved|original staffing preview/);
 await f.nodes.get('staffing-confirm-btn').listeners.get('click')();assert.equal(f.trace.length,before);
 let approvedNonces=0,approvedCalls=0;
 const approved=P.create({api:async()=>{approvedCalls++;},auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',managerId:MID,nonce:()=>{approvedNonces++;return CID;}});
 await assert.rejects(approved.confirm('recurring',f.value,{effective_start:'2026-10-05',expected_revision:42}),/Review/);
 assert.equal(approvedCalls,0);assert.equal(approvedNonces,0);
 f.setReadData();await vm.runInContext('busy(()=>resumeStaffingPreview())',f.context);
 assert.equal(f.trace.filter(x=>x.route.endsWith('/prepare')).length,1);assert.equal(f.trace.length,before+1);
 assert.equal(f.actions.pending().encoded,original);assert.equal(f.actions.pending().command.confirmationAttempted,false);
 assert.ok(f.page.state.unresolvedPreview);assert.equal(f.nodes.get('staffing-confirm-btn').disabled,true);
});
for(const bad of ['publication','revision','date','template','extra'])test('APPROVED_UNRESOLVED_PREVIEW_NEW: incoming '+bad+' mismatch clears every candidate',async()=>{
 const f=unresolvedPreviewFixture();f.setPatch(value=>{
  if(bad==='publication')value.sourcePublicationId=PID;if(bad==='revision')value.authorityRevision=43;
  if(bad==='date')value.serviceDate='2026-10-07';if(bad==='template')value.templateId='foreign';if(bad==='extra')value.confirmtoken='not-allowed';
 });await f.start();
 assert.equal(f.page.state.unresolvedPreview,null);assert.equal(f.page.state.preview,null);assert.equal(f.page.state.staffingPreview,null);
 assert.equal(f.nodes.get('approved-preview-panel').hidden,true);assert.equal(f.page.els.publish_btn.disabled,true);
 assert.equal(f.trace.length,3);assert.equal(f.actions.pending().state,'PENDING');assert.equal(f.actions.pending().encoded,f.trace[0].options.body);
});
for(const [phase,change]of [['auth','day'],['fetch','revision'],['json','publication'],['json','selection'],['fetch','principal'],['json','permission'],['json','saved'],['json','pattern']])
 test('APPROVED_UNRESOLVED_PREVIEW_NEW: late '+change+' during '+phase+' refuses original response',async()=>{
  const f=unresolvedPreviewFixture();let release,reached;const wait=new Promise(r=>release=r),at=new Promise(r=>reached=r);
  f.setAwaitHook(value=>{if(value===phase)reached();});if(phase==='auth')f.setAuthGate(wait);if(phase==='fetch')f.setGate(wait);if(phase==='json')f.setJsonGate(wait);
  const work=f.start();await at;
  if(change==='day')f.page.els.service_date.value='2026-10-07';
  if(change==='revision')f.page.state.snapshot.authority_revision=43;
  if(change==='publication')f.page.state.snapshot.current_publication.publication_id=PID;
  if(change==='selection')f.changeSelection();if(change==='pattern')f.context.document.getElementById('approved-source').value=SOURCE;
  if(change==='principal')f.patch({credential_id:PID});if(change==='permission')f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,manage_absences:false}});
  if(change==='saved'){const [key,text]=[...f.map.entries()][0],record=JSON.parse(text);record.command.operationId=SOURCE;f.map.set(key,JSON.stringify(record));}
  const originals=[...f.map.values()];release();await work;
  assert.equal(f.page.state.unresolvedPreview,null);assert.equal(f.page.state.preview,null);assert.equal(f.page.state.staffingPreview,null);
  assert.equal(f.nodes.get('approved-preview-panel').hidden,true);assert.equal(f.page.els.publish_btn.disabled,true);
  assert.deepEqual([...f.map.values()],originals);assert.equal(f.nonces(),1);assert.equal(f.trace.some(x=>x.route.endsWith('/confirm')),false);
  if(phase==='auth')assert.equal(f.trace.length,2);
 });
test('APPROVED_UNRESOLVED_PREVIEW_NEW: rendered candidate is retired on changed current facts without touching schedule or original bytes',async()=>{
 const f=unresolvedPreviewFixture();await f.start();const saved=[...f.map.values()];assert.ok(f.page.state.unresolvedPreview);
 f.page.state.snapshot.authority_revision=43;f.page.setControls();assert.equal(f.page.state.unresolvedPreview,null);
 assert.equal(f.nodes.get('approved-preview-panel').hidden,true);assert.equal(f.nodes.get('approved-preview-rows').children.length,0);
 assert.equal(f.nodes.get('staffing-confirm-btn').disabled,true);assert.equal(f.page.els.publish_btn.disabled,true);
 assert.deepEqual([...f.map.values()],saved);assert.equal(f.trace.length,3);
});
test('APPROVED_UNRESOLVED_PREVIEW_NEW: contradictory acceptance frames and unknown error codes cannot become an unresolved or accepted candidate',async()=>{
 for(const change of [v=>v.operation_outcome='accepted',v=>v.operation_outcome='unknown',v=>v.accepted_result={ok:true},v=>v.code='23514']){
  const f=unresolvedPreviewFixture();f.setOuterPatch(change);await f.start();
  assert.equal(f.page.state.unresolvedPreview,null);assert.equal(f.page.state.preview,null);assert.equal(f.page.state.staffingPreview,null);
  assert.equal(f.page.els.publish_btn.disabled,true);assert.equal(f.actions.pending().state,'PENDING');assert.equal(f.trace.length,3);
 }
});
test('APPROVED_UNRESOLVED_PREVIEW_NEW: literal current work labels are text only and foreign or historic facts are never adopted',async()=>{
 const f=unresolvedPreviewFixture(),label='<img src=x onerror=not_executed>';
 f.page.state.snapshot.assignments[0].work_snapshot.locationNameSnapshot=label;
 f.page.state.snapshot.assignments.push({service_date:'2026-10-05',work_snapshot:{workId:'2:unknown-parent',locationNameSnapshot:'Historical room'}});
 await f.start();const rows=f.nodes.get('approved-preview-rows').children;
 assert.ok(rows[0].children[2].textContent.includes(label));assert.equal(rows[0].children[2].innerHTML,undefined);
 assert.doesNotMatch(rows[1].children[2].textContent,/Historical room|unknown-parent/);
 assert.equal(f.trace.length,3);assert.equal(f.actions.pending().command.confirmationAttempted,false);
});
test('APPROVED_UNRESOLVED_PREVIEW_NEW: singleton wrapper never truncates or substitutes for an original multi-day absence',async()=>{
 const f=unresolvedPreviewFixture();f.context.document.getElementById('absence-end-date').value='2026-10-07';await f.start();
 assert.equal(f.actions.pending().body.end_date,'2026-10-07');assert.equal(f.page.state.unresolvedPreview,null);
 assert.equal(f.page.state.preview,null);assert.equal(f.nodes.get('approved-preview-panel').hidden,true);
 assert.equal(f.trace.length,3);assert.equal(f.actions.pending().encoded,f.trace[0].options.body);assert.equal(f.page.els.publish_btn.disabled,true);
});
test('APPROVED_UNRESOLVED_PREVIEW_NEW: existing runtime 409 rejected framing displays DATA without treating original confirmation as rejected or absent',async()=>{
 const f=unresolvedPreviewFixture();f.setConflict();await f.start();assert.ok(f.page.state.unresolvedPreview);
 assert.equal(f.nodes.get('staffing-confirm-btn').disabled,true);assert.equal(f.actions.pending().state,'PENDING');
 assert.equal(f.actions.pending().command.confirmationAttempted,false);assert.equal(f.trace.length,3);
 assert.equal(f.actions.pending().encoded,f.trace[0].options.body);
});
test('APPROVED_UNRESOLVED_PREVIEW_NEW: label uses the existing current projected view rather than stale baseline rows',async()=>{
 const f=unresolvedPreviewFixture();f.page.state.snapshot.latest_projection.assignments=structuredClone(f.page.state.snapshot.assignments);
 f.page.state.snapshot.latest_projection.assignments[0].work_snapshot.locationNameSnapshot='Current projected room';
 f.page.state.snapshot.assignments[0].work_snapshot.locationNameSnapshot='Stale baseline room';await f.start();
 const text=f.nodes.get('approved-preview-rows').children[0].children[2].textContent;
 assert.match(text,/Current projected room/);assert.doesNotMatch(text,/Stale baseline room/);
 assert.equal(f.nodes.get('staffing-confirm-btn').disabled,true);assert.equal(f.trace.length,3);
});
function fixture(){const map=new Map(),calls=[];let account={role:'ops_manager',manager_id:MID,credential_id:CID,device_id:'fixture-browser',token:'fixture-only',expires_at:new Date(Date.now()+3600000).toISOString(),read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,manage_absences:true,manage_coverall:true,regenerate_routes:true,close_scan_tickets:true}},mode='accept',pending=null;
const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},auth={readSession:()=>account};
const reply={revision:43,data:{current_projection:{projection_id:PID,publication_id:SOURCE,week_start:'2026-10-05'}}};
const api=async(path,options)=>{calls.push({path,options});if(pending)await pending;if(mode==='offline')throw Error('network unavailable');if(mode==='reject')throw Object.assign(Error('stale revision'),{status:409,serverRejected:true,code:'40001'});return structuredClone(reply);};
const create=()=>A.create({auth,api,storage,baseUrl:'https://scheduler.onrender.com'});return{map,calls,auth,storage,reply,api,create,setMode:m=>mode=m,setPending:p=>pending=p,patch:p=>account={...account,...p}};}
const body={service_date:'2026-10-06',week_start:'2026-10-05',publication_id:SOURCE,expected_revision:42,idempotency_key:'stable-fixture',operations:[{operation:'exception',exception_type:'daily_absence',payload:{slotId:MID},reason:'fixture'}]};
const path='/static-weekly/day-changes/batch',snapshot={week_start:'2026-10-05',projection_status:'current',authority_revision:43,current_publication:{publication_id:SOURCE},latest_projection:{projection_id:PID}};
// Actual immutable current270 SQL output, served by a SOURCE/DOM recording
// adapter only. It does not execute HTTP/SQL or mint accepted response fields.
function a1CurrentSqlDtoFixture(){
 const dir=process.env.TASK8_A1_CURRENT_SQL_CAPTURE_DIR;
 assert.ok(dir,'Pinned Main current270 capture directory required; missing input is not a PASS');
 const pins={
  'task8-join-prepared.json':'5ccaca0bab0986d0752e386211f71ac413df3dc2a48039a91da3b67c568504ac',
  'task8-cancel-prepared.json':'942e91e2284907499149c00c312a9d1e716978a5ca6d7dfae5d331b9d2cda7ac',
  'task8-join-input.json':'b98ad9b718704b8548366fb0ff84feefde256bf539b292ce4cd303821587d32a',
  'task8-cancel-current-source-inputs.json':'409c7af776a4e162326bd1ef74aec085012479de949123abd282b1619cc1240d',
  'task8-a1-two-publication-input.json':'ab0e39fb897500791b5c297623bfebadcc769b10bda46e3e2f37f1369f3f2d8d',
  'task8-join-result.json':'195c0b8ba8511ea24a91ac7042837e80bb3fd76f45f5db6291b430998e72552d',
  'task8-cancel-result.json':'441de862817106b5c27185c0cdaafab887942b0308cc22a61dfb0d38d03d4df1',
  'task8-join-begin.json':'8c24d0cbe29a0eb7e4023db4192d3687cc5dbb2bd03aca124bee4617346068de',
  'task8-cancel-begin.json':'3b418e156ca32cf356ec2fe141cd709b7f639b04e4d8e390b3827396bd5628dc'
 };
 const read=name=>{const bytes=fs.readFileSync(dir+'/'+name);assert.equal(createHash('sha256').update(bytes).digest('hex'),pins[name],name);return JSON.parse(bytes);};
 const captured=Object.fromEntries(Object.keys(pins).map(name=>[name,read(name)]));
 const joined=captured['task8-join-result.json'],cancelled=captured['task8-cancel-result.json'],basis=captured['task8-a1-two-publication-input.json'];
 assert.deepEqual(joined.window.weeks,['2026-10-19','2026-10-26']);assert.equal(joined.window.dates.length,8);
 assert.equal(cancelled.originalOperationId,'f6c42b94-7e1a-4ea4-bd23-c67a96df1fe5');
 const data={create:{prepared:captured['task8-join-prepared.json'],before:basis.before,after:joined.after,
  request:basis.request,begin:captured['task8-join-begin.json'].begun,accepted:joined.persistedCommand,key:joined.confirmationKey},
 cancel:{prepared:captured['task8-cancel-prepared.json'],before:joined.after,after:cancelled.after,
  request:cancelled.request,begin:captured['task8-cancel-begin.json'],accepted:cancelled.recovered,key:cancelled.confirmationKey}};
 for(const mode of ['create','cancel']){
  const d=data[mode],inputs=mode==='create'?captured['task8-join-input.json'].weeks:captured['task8-cancel-current-source-inputs.json'];
  assert.deepEqual(d.prepared.preview.weeks.map(w=>w.week_start),joined.window.weeks);
  assert.deepEqual(d.prepared.publication_vector.weeks,inputs.map(w=>w.publication));
  assert.equal(d.prepared.prepared_by_manager_id,'98000000-0000-4000-8000-000000000220');
  assert.equal(d.accepted.state,'ACCEPTED');assert.equal(d.accepted.operation_id,d.prepared.operation_id);
 }
 const f=pageFixture();f.patch({manager_id:data.create.prepared.prepared_by_manager_id,read_only:true,
  permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,manage_absences:true}});
 let mode='create',accepted=false,wrongBasis=false,wrongReadback=false,unknownReply=false,hold=null;const calls=[];
 const expectedBody=()=>{const r=data[mode].request;return{command_kind:r.commandKind,employee_id:r.employeeId,start_date:r.startDate,end_date:r.endDate,
  ...(r.commandKind==='absence'?{absence_kind:r.absenceKind}:{target_absence_id:r.targetAbsenceId}),client_prepare_key:r.clientPrepareKey,expected_revision:r.expectedRevision};};
 const api=async(route,options={})=>{
  calls.push({mode,route,options});const d=data[mode];
  if(route.startsWith('/static-weekly/manager-snapshot?')){
   if(hold)await hold;
   const week=new URL('https://fixture.invalid'+route).searchParams.get('week_start');
   const value=structuredClone((accepted?d.after:d.before).find(s=>s.week_start===week));assert.ok(value);
   if(wrongBasis&&week==='2026-10-26')value.current_publication.publication_id=SOURCE;
   if(wrongReadback&&accepted&&week==='2026-10-26')value.latest_projection.projection_id=SOURCE;
   return value;
  }
  if(route==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[]};
  if(route===A.staffingCommandPath){assert.deepEqual(JSON.parse(options.body),expectedBody());assert.equal(f.map.size,1);return structuredClone(d.begin);}
  if(route===A.staffingCommandPath+'/'+d.prepared.operation_id)return structuredClone(accepted?d.accepted:d.prepared);
  if(route===A.staffingCommandPath+'/'+d.prepared.operation_id+'/confirm'){
   assert.deepEqual(JSON.parse(options.body),{preview_digest:d.prepared.preview_digest,confirmation_key:d.key});
   assert.equal(actions.pending().command.confirmationAttempted,true);accepted=true;
   if(unknownReply)throw Error('Source recording: original confirmation response lost');
   return structuredClone(d.accepted.accepted_receipt);
  }
  throw Error('Unrecorded A1 route refused: '+route);
 };
 const actions=A.create({auth:f.auth,api,storage:f.storage,baseUrl:'https://scheduler.onrender.com',nonce:()=>data[mode].key,
  onState:value=>f.page.state.pending=value});
 f.page.state.actions=actions;f.page.state.principal=A.principal(f.auth);f.page.state.snapshot=structuredClone(data.create.before[0]);
 f.page.state.baseUrl='https://scheduler.onrender.com';f.page.els.week_start.value='2026-10-19';f.page.els.service_date.value='2026-10-19';
 f.context.document.getElementById('absence-end-date').value='2026-10-26';f.page.els.absence_type.value='daily_absence';f.context.api=api;
 const slot=data.create.before[0].roster.find(r=>r.incumbencies.some(i=>i.person_id===basis.request.employeeId));assert.ok(slot);
 f.context.document.querySelectorAll=selector=>selector==='[data-callout-slot]:checked:not(:disabled)'?[{dataset:{calloutSlot:slot.slot_id}}]:[];
 f.context.crypto={randomUUID:()=>data[mode].request.clientPrepareKey};
 return{...f,data,calls,actions,expectedBody,prepare:()=>f.page.applyDayChanges(),
  confirmations:()=>calls.filter(c=>c.route.endsWith('/confirm')),
  setWrongBasis:()=>wrongBasis=true,setWrongReadback:value=>wrongReadback=value,setUnknown:()=>unknownReply=true,setHold:value=>hold=value,
  async cancel(){mode='cancel';accepted=false;wrongReadback=false;unknownReply=false;
   const button={dataset:{cancelOriginalAbsence:cancelled.originalOperationId}};
   await f.page.reverseChange({target:{closest:selector=>selector==='[data-cancel-original-absence]'?button:null}});},
  assertOriginalInputs(){for(const name of Object.keys(pins))read(name);}};
}
function assertA1CurrentRows(f,mode){
 const p=f.data[mode].prepared,rows=f.nodes.get('approved-preview-rows').children;
 assert.equal(rows.length,12);assert.deepEqual([...new Set(rows.map(r=>r.children[0].textContent))],['2026-10-19','2026-10-26']);
 for(const week of p.preview.weeks)assert.equal(rows.filter(r=>r.children[0].textContent===week.week_start).length,week.assignments.length);
 assert.equal(f.nodes.get('approved-preview-capacity-rows').children.length,p.preview.weeks.reduce((n,w)=>n+w.projectionAvailability.length,0));
 const saved=f.actions.pending();assert.deepEqual(saved.body,f.expectedBody());assert.equal(saved.command.operationId,p.operation_id);
 assert.deepEqual(saved.weekBindings.map(b=>b.publicationId),p.publication_vector.weeks.map(b=>b.publicationId));
 assert.equal(saved.body.end_date,'2026-10-26');assert.equal(f.nodes.get('staffing-confirm-btn').disabled,false);
 assert.equal(A.permissions(f.auth).owner,false);assert.equal(A.authorized(f.auth,'/static-weekly/employees/departed',{}),false);
 assert.match(f.nodes.get('approved-preview-summary').textContent,/ALL 2 remaining weeks.*12 staged duties/);
 assert.match(f.nodes.get('approved-preview-summary').textContent,/performed readiness are not established/);
}
test('A1 CURRENT SQL DTO: actual page selection and factory preserve both publication previews then original cancellation with one confirmation each',async()=>{
 const f=a1CurrentSqlDtoFixture();await f.prepare();assertA1CurrentRows(f,'create');assert.equal(f.confirmations().length,0);
 f.context.confirmAction=async()=>true;await f.nodes.get('staffing-confirm-btn').listeners.get('click')();
 assert.equal(f.confirmations().length,1);assert.equal(f.map.size,0);assert.equal(f.page.state.snapshot.authority_revision,13);
 await f.cancel();assertA1CurrentRows(f,'cancel');assert.equal(f.confirmations().length,1);
 assert.equal(f.actions.pending().body.target_absence_id,'f6c42b94-7e1a-4ea4-bd23-c67a96df1fe5');
 assert.match(f.nodes.get('approved-preview-summary').textContent,/original employee.*CURRENT effective plan.*never a historical restore/);
 await f.nodes.get('staffing-confirm-btn').listeners.get('click')();assert.equal(f.confirmations().length,2);assert.equal(f.map.size,0);
 assert.equal(f.page.state.snapshot.authority_revision,14);assert.match(f.nodes.get('coverall-print-link').href,/expected_revision=14/);
 f.assertOriginalInputs();
});
test('A1 CURRENT SQL DTO: wrong second current basis refuses confirmation and preserves the original two-week request',async()=>{
 const f=a1CurrentSqlDtoFixture();await f.prepare();const original=f.actions.pending().encoded;f.setWrongBasis();f.context.confirmAction=async()=>true;
 await f.nodes.get('staffing-confirm-btn').listeners.get('click')();assert.equal(f.confirmations().length,0);
 assert.equal(f.actions.pending().encoded,original);assert.equal(f.actions.pending().weekBindings.length,2);assert.equal(f.map.size,1);
 assert.match(f.page.els.status.textContent,/remaining week.*changed/i);f.assertOriginalInputs();
});
test('A1 CURRENT SQL DTO: unknown reply and wrong second projection remain saved until original GET-only complete readback',async()=>{
 const f=a1CurrentSqlDtoFixture();await f.prepare();const original=f.actions.pending().encoded;f.setUnknown();f.context.confirmAction=async()=>true;
 await f.nodes.get('staffing-confirm-btn').listeners.get('click')();assert.equal(f.confirmations().length,1);assert.equal(f.map.size,1);
 assert.equal(f.actions.pending().encoded,original);assert.equal(f.actions.pending().command.confirmationAttempted,true);
 f.setWrongReadback(true);const before=f.calls.length;await assert.rejects(f.page.resumeStaffingPreview(),/EVERY affected week/);
 assert.equal(f.map.size,1);assert.equal(f.actions.pending().encoded,original);assert.equal(f.actions.pending().state,'ACCEPTED');
 f.setWrongReadback(false);await f.page.resumeStaffingPreview();assert.equal(f.map.size,0);assert.equal(f.confirmations().length,1);
 assert.ok(f.calls.slice(before).every(c=>c.options.method==='GET'||c.route.startsWith('/static-weekly/manager-snapshot?')||c.route==='/static-weekly/approved-choices'));
 f.assertOriginalInputs();
});
test('A1 CURRENT SQL DTO: withdrawn delegate capability during current-basis await prevents confirmation without discarding originals',async()=>{
 const f=a1CurrentSqlDtoFixture();await f.prepare();const original=f.actions.pending().encoded;let release;
 f.setHold(new Promise(r=>release=r));f.context.confirmAction=async()=>true;
 const work=f.nodes.get('staffing-confirm-btn').listeners.get('click')();
 f.patch({permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,manage_absences:false}});
 f.page.setControls();release();await work;assert.equal(f.confirmations().length,0);assert.equal(f.map.size,1);
 assert.equal(f.actions.pending().encoded,original);assert.equal(f.nodes.get('staffing-confirm-btn').disabled,true);f.assertOriginalInputs();
});
test('audit A1: delegated manager completes original multiweek cancellation without owner authority',async()=>{
 const f=cancellationFixture();f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,manage_absences:true}});
 await f.page.reverseChange(f.event);assert.equal(f.actions.pending()?.body.end_date,'2026-10-20');
 assert.equal(f.actions.pending()?.weekBindings.length,2);assert.equal(f.confirmationCount(),0);
 f.context.confirmAction=async()=>true;await f.nodes.get('staffing-confirm-btn').listeners.get('click')();
 assert.equal(f.confirmationCount(),1);assert.equal(f.map.size,0);assert.equal(A.permissions(f.auth).owner,false);
 assert.equal(A.authorized(f.auth,'/static-weekly/employees/departed',{}),false);
});
test('audit A1: delegated multiweek absence preserves full dates and refuses unbound weeks or revoked capability',async()=>{
 const f=fixture(),calls=[],week1='2026-10-12',week2='2026-10-19';
 const request={command_kind:'absence',employee_id:MID,start_date:'2026-10-14',end_date:'2026-10-20',absence_kind:'pto',client_prepare_key:CID,expected_revision:7};
 const basis={weekStart:week1,publicationId:PID,versionId:SOURCE,weeks:[
  {weekStart:week1,publicationId:PID,versionId:SOURCE,authorityRevision:7},
  {weekStart:week2,publicationId:SOURCE,versionId:PID,authorityRevision:7}]};
 const actions=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://fixture.invalid',api:async(path,options)=>{
  calls.push({path,options});throw Error('Synthetic transport unavailable; retain original');}});
 await assert.rejects(actions.prepareStaffing(request,basis),/Synthetic transport unavailable/);assert.equal(calls.length,1);
 assert.deepEqual(JSON.parse(calls[0].options.body),request);assert.equal(actions.pending().weekBindings.length,2);
 assert.equal(A.authorized(f.auth,A.staffingCommandPath,{command_kind:'vacate_roster_slot'}),false);
 const other=fixture(),a=A.create({auth:other.auth,storage:other.storage,baseUrl:'https://fixture.invalid',api:async()=>{throw Error('Must not send');}});
 await assert.rejects(a.prepareStaffing(request,{...basis,weeks:basis.weeks.slice(0,1)}),/EVERY/);assert.equal(other.map.size,0);
 other.patch({permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,manage_absences:false}});
 await assert.rejects(a.prepareStaffing(request,basis),/absence permission/);assert.equal(other.map.size,0);
});
test('audit A1: actual website start/through selection reads both current weeks before one original prepare',async()=>{
 const f=cancellationFixture();f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,manage_absences:true}});
 f.page.els.service_date.value='2026-10-14';f.page.els.absence_type.value='pto';
 f.context.document.getElementById('absence-end-date').value='2026-10-20';
 f.context.document.querySelectorAll=selector=>selector==='[data-callout-slot]:checked:not(:disabled)'?[{dataset:{calloutSlot:CID}}]:[];
 const calls=[];f.page.state.actions={prepareStaffing:async(...args)=>{calls.push(args);throw Error('Synthetic stopped after original prepare binding');}};
 await f.page.applyDayChanges();assert.equal(calls.length,1);
 assert.equal(calls[0][0].start_date,'2026-10-14');assert.equal(calls[0][0].end_date,'2026-10-20');
 assert.equal(calls[0][0].employee_id,f.occupant);assert.equal(calls[0][1].weeks.length,2);
 assert.equal(f.requests.filter(x=>x.path.includes('manager-snapshot?week_start=2026-10-19')).length,1);
 assert.equal(A.permissions(f.auth).owner,false);assert.equal(f.confirmationCount(),0);
});
// NEW cancellation-only owning member. All HTTP/SQL replies and people here
// are synthetic DTO fixtures, NOT solver output, a persisted real cancellation
// or a physical/browser claim. Uses the existing page/helper VM facilities.
function cancellationFixture(){
 const f=pageFixture(),original='81000000-0000-4000-8000-000000000001',occupant='82000000-0000-4000-8000-000000000001',
  target='83000000-0000-4000-8000-000000000001',acceptedOperation='84000000-0000-4000-8000-000000000001',operation='85000000-0000-4000-8000-000000000001';
 const weeks=['2026-10-12','2026-10-19'],pubs=[SOURCE,'86000000-0000-4000-8000-000000000001'],versions=['87000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001'],projections=[PID,'89000000-0000-4000-8000-000000000001'];
 const dates=['2026-10-14','2026-10-19'],requests=[];let phase='PREPARING',confirmationCalls=0,today='2026-10-14',block=null,failConfirm=false,readPatch=null,missingBasis=false,wrongReadback=false;
 const row={id:target+':2026-10-13',type:'pto',serviceDate:'2026-10-13',status:'accepted',actorId:SOURCE,payload:{slotId:CID},staffingAbsenceId:target,
  staffingEmployeeId:original,staffingStartDate:'2026-10-09',staffingEndDate:'2026-10-20',staffingAcceptedOperationId:acceptedOperation};
 const snapshots=weeks.map((week,index)=>({week_start:week,week_end:index?'2026-10-25':'2026-10-18',authority_revision:7,current_service_date:today,projection_status:'current',
  current_publication:{publication_id:pubs[index],version_id:versions[index]},latest_projection:{projection_id:projections[index],replay_digest:(index?'f':'e').repeat(64)},
  roster:[{slot_id:CID,slot_label:'Currently effective position',incumbencies:[{person_id:occupant,person_name:'CURRENT occupant, not original target',effective_start:'2026-10-01'}]}],
  exceptions:[row],availability:[],sources:[],drafts:[]}));
 const bindingWeeks=weeks.map((week,index)=>({weekStart:week,publicationId:pubs[index],versionId:versions[index],authorityRevision:7}));
 const previewWeeks=weeks.map((week,index)=>({week_start:week,publicationId:pubs[index],versionId:versions[index],
  database_projection_identity:String(index+1).repeat(64),replayDigest:(index?'f':'e').repeat(64),compilerVersion:'SYNTHETIC_DTO_NOT_COMPILER_OUTPUT',
  sourceDigest:'a'.repeat(64),sourceDigestBasis:'envelope.authority.inputDigest',geographyDigest:'b'.repeat(64),
  assignments:[{plan_work_id:'fixture-duty-'+index,service_date:dates[index],status:'assigned',owner_slot_id:CID,owner_person_id:occupant,
   work_snapshot:{window:{start:'07:00',end:'09:45'},locationNameSnapshot:'CURRENT accepted plan week '+week,schedulingMode:'flexible_coverage_ownership',serviceEffortMinutes:1}}],
  projectionAvailability:[{dayOfWeek:index?1:3,serviceDate:dates[index],slotId:CID,status:'working',incumbentPersonId:occupant,incumbentName:'DATED current person '+index,
   shift:{start:'07:00',end:'16:00'},lunch:{start:'12:00',end:'13:00'},blockedWindows:[],productiveCapacityProvenanceDigest:'c'.repeat(64)}],
  lunch_loans:[],lunch_responsibilities:[],objective:null,metrics:null}));
 const prepared={operation_id:operation,state:'PREPARED',expected_revision:7,prepared_by_manager_id:MID,current_service_date:today,
  semantic_body:{absenceKind:null,commandKind:'cancel_absence',employeeId:original,startDate:'2026-10-14',endDate:'2026-10-20',targetAbsenceId:target},
  semantic_digest:'a'.repeat(64),preview_digest:'b'.repeat(64),input_digest:'c'.repeat(64),candidate_set_digest:'d'.repeat(64),
  publication_vector:{expectedRevision:7,weeks:bindingWeeks},preview:{schema:'memphis-zoo.staffing-command-preview.v1',weeks:previewWeeks}};
 const accepted={...prepared,state:'ACCEPTED',preview:null,accepted_revision:8,accepted_receipt:{event:'ACCEPTED',operation_id:operation,manager_id:MID,
  semantic_digest:prepared.semantic_digest,preview_digest:prepared.preview_digest,candidate_set_digest:prepared.candidate_set_digest,authority_revision:8,
  projections:Object.fromEntries(weeks.map((week,index)=>[week,{projection_id:projections[index],publication_id:pubs[index],projection_identity:previewWeeks[index].database_projection_identity,lunch_document_identity:(index?'4':'3').repeat(64)}]))}};
 const api=async(path,options={})=>{requests.push({path,options});if(block)await block;
  if(path.startsWith('/static-weekly/manager-snapshot?')){
   const week=new URL(path,'https://fixture.invalid').searchParams.get('week_start'),index=weeks.indexOf(week);assert.ok(index>=0);
   const value=structuredClone(snapshots[index]);value.current_service_date=today;
   if(missingBasis&&index===1)value.current_publication=null;
   if(phase==='ACCEPTED'){value.authority_revision=8;if(wrongReadback&&index===1)value.latest_projection.projection_id=SOURCE;}
   return value;
  }
  if(path==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[]};
  if(path===A.staffingCommandPath){const body=JSON.parse(options.body);assert.equal(body.command_kind,'cancel_absence');assert.equal(body.employee_id,original);assert.equal(body.target_absence_id,target);
   assert.equal(body.start_date,'2026-10-14');assert.equal(body.end_date,'2026-10-20');return{operation_id:operation,expected_revision:7,semantic_digest:prepared.semantic_digest};}
  if(path.endsWith('/prepare')){phase='PREPARED';return{state:'PREPARED',operation_id:operation};}
  if(path.endsWith('/confirm')){confirmationCalls++;assert.equal(actions.pending().command.confirmationAttempted,true);assert.equal(actions.pending().command.confirmationKey,CID);
   assert.deepEqual(JSON.parse(options.body),{preview_digest:prepared.preview_digest,confirmation_key:CID});phase='ACCEPTED';if(failConfirm)throw Error('Unknown confirmation response');return structuredClone(accepted.accepted_receipt);}
  if(path===A.staffingCommandPath+'/'+operation){const value=phase==='ACCEPTED'?structuredClone(accepted):{...structuredClone(prepared),state:phase,preview:phase==='PREPARING'?null:structuredClone(prepared.preview)};
   value.current_service_date=today;if(readPatch)readPatch(value);return value;}
  if(path==='/static-weekly/day-changes/batch'){phase='ACCEPTED';return{revision:8,data:{current_projection:{projection_id:PID,publication_id:pubs[0],week_start:weeks[0]}}};}
  throw Error('Unexpected cancellation fixture route '+path);
 };
 const attach=()=>A.create({auth:f.auth,api,storage:f.storage,baseUrl:'https://scheduler.onrender.com',nonce:()=>CID,onState:value=>f.page.state.pending=value});
 const actions=attach();f.page.state.actions=actions;f.page.state.snapshot=structuredClone(snapshots[0]);f.page.state.principal=A.principal(f.auth);
 f.page.els.week_start.value=weeks[0];f.page.els.service_date.value=row.serviceDate;f.context.api=api;f.context.crypto={randomUUID:()=>CID};f.auth.getCSTDateString=()=> '1999-01-01';
 const button={dataset:{reverseException:row.id}},event={target:{closest:()=>button}};
 return{...f,row,original,occupant,target,operation,prepared,accepted,requests,actions,snapshots,button,event,attach,
  confirmationCount:()=>confirmationCalls,setToday:value=>today=value,setBlocked:value=>block=value,setMissingBasis:()=>missingBasis=true,
  setWrongReadback:()=>wrongReadback=true,setFailConfirm:()=>failConfirm=true,patchRead:fn=>readPatch=fn};
}
test('staffing cancellation: canonical undo prepares FULL remaining two-week current plan for original employee, then one confirmation and all-week readback',async()=>{
 const f=cancellationFixture();await f.page.reverseChange(f.event);assert.equal(f.confirmationCount(),0);const r=f.actions.pending();
 assert.equal(r.body.employee_id,f.original);assert.notEqual(r.body.employee_id,f.occupant);assert.equal(r.body.target_absence_id,f.target);
 assert.equal(r.body.start_date,'2026-10-14');assert.equal(r.body.end_date,'2026-10-20');assert.equal(r.weekBindings.length,2);assert.notEqual(r.weekBindings[0].publicationId,r.weekBindings[1].publicationId);
 assert.equal(f.requests.some(x=>x.path==='/static-weekly/day-changes/batch'),false);assert.equal(f.nodes.get('approved-preview-rows').children.length,2);
 assert.equal(f.nodes.get('approved-preview-capacity-rows').children.length,2);assert.match(f.nodes.get('approved-preview-summary').textContent,/ALL 2 remaining weeks/);assert.match(f.nodes.get('approved-preview-summary').textContent,/never a historical restore/);
 f.context.confirmAction=async()=>true;await f.nodes.get('staffing-confirm-btn').listeners.get('click')();assert.equal(f.confirmationCount(),1);assert.equal(f.map.size,0);
 assert.match(f.nodes.get('coverall-print-link').href,/expected_revision=8/);
});
test('staffing cancellation: missing original employee/range metadata cannot fall through to legacy composite-id reversal',async()=>{
 const f=cancellationFixture();delete f.page.state.snapshot.exceptions[0].staffingEmployeeId;
 await assert.rejects(f.page.reverseChange(f.event),/original accepted absence/i);assert.equal(f.requests.length,0);assert.equal(f.map.size,0);
});
test('staffing cancellation: missing server civil day refuses without device-clock fallback or BEGIN',async()=>{
 const f=cancellationFixture();f.setToday(undefined);await f.page.reverseChange(f.event);
 assert.equal(f.requests.some(x=>x.options.method==='POST'),false);assert.equal(f.map.size,0);assert.match(f.page.els.status.textContent,/current_service_date.*unavailable/);
});
test('staffing cancellation: missing current future-week publication refuses WHOLE window before BEGIN, never truncates',async()=>{
 const f=cancellationFixture();f.setMissingBasis();await f.page.reverseChange(f.event);
 assert.equal(f.requests.some(x=>x.options.method==='POST'),false);assert.equal(f.map.size,0);assert.match(f.page.els.status.textContent,/entire cancellation.*not shortened/);
});
test('staffing cancellation: missing second prepared week refuses confirmation and preserves original full body',async()=>{
 const f=cancellationFixture();f.patchRead(value=>{if(value.state==='PREPARED')value.preview.weeks.pop();});await f.page.reverseChange(f.event);
 assert.equal(f.actions.pending().body.end_date,'2026-10-20');assert.equal(f.confirmationCount(),0);assert.match(f.page.els.status.textContent,/COMPLETE remaining/);
});
test('staffing cancellation: wrong second-week accepted projection keeps receipt and hides handout rather than clearing on first-week success',async()=>{
 const f=cancellationFixture();await f.page.reverseChange(f.event);f.setWrongReadback();f.context.confirmAction=async()=>true;await f.nodes.get('staffing-confirm-btn').listeners.get('click')();
 assert.equal(f.confirmationCount(),1);assert.equal(f.actions.pending().state,'ACCEPTED');assert.equal(f.map.size,1);assert.equal(f.nodes.get('coverall-print-link').hidden,true);assert.match(f.page.els.status.textContent,/EVERY affected week/);
});
test('staffing cancellation: unknown confirmation reload resumes GET-only original target/op/key with complete multiweek recovery',async()=>{
 const f=cancellationFixture();await f.page.reverseChange(f.event);const encoded=f.actions.pending().encoded;f.setFailConfirm();f.context.confirmAction=async()=>true;
 await f.nodes.get('staffing-confirm-btn').listeners.get('click')();assert.equal(f.confirmationCount(),1);assert.equal(f.actions.pending().command.confirmationAttempted,true);
 const n=f.requests.length;f.page.state.actions=f.attach();await f.page.resumeStaffingPreview();
 assert.ok(f.requests.slice(n).every(x=>x.options.method!=='POST'));assert.equal(f.confirmationCount(),1);assert.equal(f.map.size,0);assert.equal(JSON.parse(encoded).target_absence_id,f.target);
});
test('staffing cancellation: server civil day advancement during reviewed confirmation refuses instead of changing original start',async()=>{
 const f=cancellationFixture();await f.page.reverseChange(f.event);f.context.confirmAction=async()=>{f.setToday('2026-10-15');return true;};
 await f.nodes.get('staffing-confirm-btn').listeners.get('click')();assert.equal(f.confirmationCount(),0);assert.equal(f.actions.pending().body.start_date,'2026-10-14');assert.match(f.page.els.status.textContent,/server civil date advanced/i);
});
test('staffing cancellation: legacy UUID-only accepted exception still uses its existing reverse batch',async()=>{
 const f=cancellationFixture(),legacy={id:SOURCE,type:'daily_absence',serviceDate:'2026-10-13',payload:{slotId:CID}};
 f.page.state.snapshot.exceptions=[legacy];for(const s of f.snapshots)s.exceptions=[legacy];f.button.dataset.reverseException=SOURCE;f.context.confirmAction=async()=>true;
 await f.page.reverseChange(f.event);const post=f.requests.find(x=>x.path==='/static-weekly/day-changes/batch');assert.ok(post);assert.equal(JSON.parse(post.options.body).operations[0].reverses_exception_id,SOURCE);
 assert.equal(f.requests.some(x=>x.path===A.staffingCommandPath),false);
});
test('staffing cancellation: corrupt original-target metadata on reload refuses without changing saved request or invoking GET',async()=>{
 const f=cancellationFixture();await f.page.reverseChange(f.event);const key=[...f.map.keys()][0],record=JSON.parse(f.map.get(key));
 record.cancellationTarget.staffingEmployeeId=f.occupant;const corrupt=JSON.stringify(record);f.map.set(key,corrupt);const count=f.requests.length;
 assert.throws(()=>f.actions.pending(),/original accepted target/);assert.equal(f.map.get(key),corrupt);assert.equal(f.requests.length,count);assert.equal(f.confirmationCount(),0);
});
test('staffing cancellation: awaited original metadata or credential change refuses before BEGIN',async()=>{
 for(const change of ['metadata','credential']){const f=cancellationFixture();
  if(change==='metadata')f.row.staffingEndDate='2026-10-21';
  else{let release;f.setBlocked(new Promise(r=>release=r));const work=f.page.reverseChange(f.event);f.patch({credential_id:SOURCE});release();await work;
   assert.equal(f.requests.some(x=>x.options.method==='POST'),false);assert.equal(f.map.size,0);continue;}
  await f.page.reverseChange(f.event);assert.equal(f.requests.some(x=>x.options.method==='POST'),false);assert.equal(f.map.size,0);assert.match(f.page.els.status.textContent,/target changed/);
 }
});
test('staffing cancellation: UTF-8 oversized week refuses whole review instead of treating character count as byte bound',async()=>{
 const f=cancellationFixture();f.patchRead(value=>{if(value.state==='PREPARED')value.preview.weeks[1].assignments[0].work_snapshot.locationNameSnapshot='é'.repeat(2200000);});
 await f.page.reverseChange(f.event);assert.equal(f.confirmationCount(),0);assert.equal(f.actions.pending().body.end_date,'2026-10-20');
 assert.match(f.page.els.status.textContent,/bounded UTF-8.*not truncated/);assert.equal(f.page.state.staffingPreview,null);
});
// Newly affected snapshot original-ledger LIST consumer. Exact Task7 row
// contract; synthetic network replies only, not a SQL or manager-browser run.
function originalAbsenceListFixture(){
 const f=cancellationFixture(),row={staffingAbsenceId:f.target,staffingEmployeeId:f.original,
  staffingStartDate:'2026-10-09',staffingEndDate:'2026-10-20',staffingAcceptedOperationId:f.target,
  status:'accepted',absenceKind:'pto',actorId:SOURCE,sourceKind:'canonical_staffing_absence'};
 for(const s of f.snapshots){s.exceptions=[];s.canonical_staffing_absences=[row];}
 f.page.state.snapshot=structuredClone(f.snapshots[0]);delete f.button.dataset.reverseException;
 f.button.dataset.cancelOriginalAbsence=f.target;
 return{...f,sourceRow:row};
}
test('staffing original list: hidden original target is visible without current-name/slot/reason invention and prepares exact full-range current plan',async()=>{
 const f=originalAbsenceListFixture();f.page.renderChanges(f.page.state.snapshot);const html=f.page.els.changes_list.innerHTML;
 assert.match(html,/Canonical accepted Pto/);assert.match(html,new RegExp(f.original));assert.match(html,/Original 2026-10-09 through 2026-10-20/);
 assert.match(html,/Remaining 2026-10-14 through 2026-10-20/);assert.match(html,/never reactivate old people/);
 assert.doesNotMatch(html,/CURRENT occupant|staffingAbsenceId.*:2026|data-reverse-exception|private leave reason/);
 await f.page.reverseChange(f.event);const saved=f.actions.pending();assert.equal(saved.body.employee_id,f.original);assert.equal(saved.body.target_absence_id,f.target);
 assert.equal(saved.body.start_date,'2026-10-14');assert.equal(saved.body.end_date,'2026-10-20');assert.equal(saved.weekBindings.length,2);
 const sent=JSON.parse(f.requests.find(x=>x.path===A.staffingCommandPath).options.body);
 assert.equal(Object.hasOwn(sent,'originalCancellationTarget'),false);assert.equal(Object.hasOwn(sent,'original_cancellation_target'),false);
 assert.equal(Object.keys(sent).length,7);assert.equal(f.requests.some(x=>x.path==='/static-weekly/day-changes/batch'),false);assert.equal(f.confirmationCount(),0);
 f.context.confirmAction=async()=>true;await f.nodes.get('staffing-confirm-btn').listeners.get('click')();assert.equal(f.confirmationCount(),1);assert.equal(f.map.size,0);
});
test('staffing original list: source plus dated target shows one original cancellation, leaving unrelated legacy change intact',()=>{
 const f=originalAbsenceListFixture(),snapshot=f.page.state.snapshot;
 snapshot.exceptions=[f.row,{id:PID,type:'partial_absence',serviceDate:'2026-10-14',reason:'Ordinary legacy change',payload:{slotId:CID}}];
 f.page.renderChanges(snapshot);const html=f.page.els.changes_list.innerHTML;
 assert.equal((html.match(/data-cancel-original-absence=/g)||[]).length,1);assert.equal((html.match(/data-reverse-exception=/g)||[]).length,1);
 assert.match(html,/Ordinary legacy change/);assert.doesNotMatch(html,new RegExp(f.target+':2026-10-13'));
});
test('staffing original list: awaited original actor/kind/range drift or manager credential change refuses before BEGIN',async()=>{
 for(const change of ['actor','kind','range','credential']){
  const f=originalAbsenceListFixture();
  if(change==='actor')f.sourceRow.actorId=PID;if(change==='kind')f.sourceRow.absenceKind='unavailable';if(change==='range')f.sourceRow.staffingEndDate='2026-10-21';
  if(change==='credential'){let release;f.setBlocked(new Promise(r=>release=r));const work=f.page.reverseChange(f.event);f.patch({credential_id:SOURCE});release();await work;}
  else await f.page.reverseChange(f.event);
  assert.equal(f.requests.some(x=>x.options.method==='POST'),false);assert.equal(f.map.size,0);assert.equal(f.confirmationCount(),0);
 }
});
test('staffing original list: missing DTO/server day and hostile identity/status never substitute current occupant or legacy reverse',async()=>{
 const absent=originalAbsenceListFixture();delete absent.page.state.snapshot.canonical_staffing_absences;
 await assert.rejects(absent.page.reverseChange(absent.event),/original accepted absence.*unavailable/i);assert.equal(absent.requests.length,0);
 const clock=originalAbsenceListFixture();delete clock.page.state.snapshot.current_service_date;clock.page.renderChanges(clock.page.state.snapshot);
 assert.match(clock.page.els.changes_list.innerHTML,/cancellation held/);assert.match(clock.page.els.changes_list.innerHTML,/disabled/);
 clock.setToday(undefined);await clock.page.reverseChange(clock.event);assert.equal(clock.requests.some(x=>x.options.method==='POST'),false);
 for(const changed of [{staffingEmployeeId:[MID]},{staffingAcceptedOperationId:PID},{status:'held'},{sourceKind:'legacy_guess'},{absenceKind:'unknown'},
  {staffingStartDate:'2026-02-31'},{privateReason:'must not be rendered'}]){
  const f=originalAbsenceListFixture();Object.assign(f.page.state.snapshot.canonical_staffing_absences[0],changed);
  assert.throws(()=>f.page.renderChanges(f.page.state.snapshot));assert.doesNotMatch(f.page.els.changes_list.innerHTML,/data-cancel-original-absence/);
  await assert.rejects(f.page.reverseChange(f.event));assert.equal(f.requests.length,0);assert.equal(f.map.size,0);
 }
});
test('staffing original list: ordinary delegates cannot cancel original target and missing remaining-week basis refuses whole window',async()=>{
 const delegate=originalAbsenceListFixture();delegate.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,manage_absences:false}});
 delegate.page.renderChanges(delegate.page.state.snapshot);assert.match(delegate.page.els.changes_list.innerHTML,/hidden/);
 await assert.rejects(delegate.page.reverseChange(delegate.event),/not available for your manager session/i);assert.equal(delegate.requests.length,0);
 const f=originalAbsenceListFixture();f.setMissingBasis();await f.page.reverseChange(f.event);
 assert.equal(f.requests.some(x=>x.options.method==='POST'),false);assert.equal(f.map.size,0);assert.match(f.page.els.status.textContent,/entire cancellation.*not shortened/);
});
test('staffing original list: ambiguous confirmation stays exact original operation and recovers through GET-only all-week readback',async()=>{
 const f=originalAbsenceListFixture();await f.page.reverseChange(f.event);const original=f.actions.pending().encoded;
 f.setFailConfirm();f.context.confirmAction=async()=>true;await f.nodes.get('staffing-confirm-btn').listeners.get('click')();
 assert.equal(f.confirmationCount(),1);const n=f.requests.length;f.page.state.actions=f.attach();await f.page.resumeStaffingPreview();
 assert.ok(f.requests.slice(n).every(x=>x.options.method!=='POST'));assert.equal(f.confirmationCount(),1);assert.equal(f.map.size,0);
 assert.equal(JSON.parse(original).target_absence_id,f.target);assert.equal(JSON.parse(original).employee_id,f.original);
});
test('staffing original list: full original range and bounded complete source list refuse rather than selecting a prefix or shortened week',async()=>{
 for(const change of ['range','week','duplicate','rows']){
  const f=originalAbsenceListFixture(),s=f.page.state.snapshot;
  if(change==='range')s.canonical_staffing_absences[0].staffingStartDate='2020-01-01';
  if(change==='week')s.week_end='2026-10-19';
  if(change==='duplicate')s.canonical_staffing_absences.push(structuredClone(s.canonical_staffing_absences[0]));
  if(change==='rows')s.canonical_staffing_absences=Array(100001).fill(s.canonical_staffing_absences[0]);
  assert.throws(()=>f.page.renderChanges(s));assert.doesNotMatch(f.page.els.changes_list.innerHTML,/data-cancel-original-absence/);
  await assert.rejects(f.page.reverseChange(f.event));assert.equal(f.requests.length,0);assert.equal(f.map.size,0);
 }
});
// Newly affected member over retained ACTUAL compiler/old-reader captures,
// with explicitly synthetic SQL/HTTP responses and the exact proposed safe DTO.
// No solve, DB, browser, publication or unchanged older test execution here.
// The two tracked Task8 roots retain exact hash-pinned SYNTHETIC historical
// captures (their broader original runs ended1). They prove test input identity,
// never current SQL/manager/phone acceptance. Explicit environment overrides
// remain supported and must satisfy every original exact hash assertion.
function privatePreviewFixture(){
 const dir=process.env.TASK8_CURRENT_JOIN_CAPTURE_DIR??fileURLToPath(new URL('../test-fixtures/ci/task8-current-join',import.meta.url));if(!dir)throw Error('Exact current captured input directory is required for this new member.');
 const read=(name,sha)=>{const bytes=fs.readFileSync(dir+'/'+name);assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);return JSON.parse(bytes);};
 const record=read('task8-compiler-04-result.json','5cafeac4df36001827bc668d1e7a23eee1779b8f77a0dcf9778829cf14ce1dbc');
 const prepared=read('task8-join-prepared.json','f07ac563074274ba2a87d2f67acd15c65c7315f3788f2ae361a4ef5150b1b062');
 const raw=record.result,a=raw.envelope.authority,vector=prepared.publication_vector.weeks[0];
 const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'); // synthetic DTO hash only, NOT claimed SQL JSONb proof
 const availability=a.projectionAvailability.map(row=>{
  const result={};for(const key of ['dayOfWeek','serviceDate','slotId','status','shift','lunch','blockedWindows','productiveWindows',
   'incumbentSlotId','incumbentSlotLabel','incumbentPersonId','incumbentName','ownerKind','capacityId','productiveCapacityMinutes','maxServiceEffortMinutes',
   'acceptedRouteAnchorLocationId','acceptedRouteStartLocationId','routeAnchorLocationId'])result[key]=structuredClone(row[key]??null);
  for(const key of ['productiveCapacityProvenance','capacityProvenance','acceptedRouteProvenance'])result[key+'Digest']=row[key]==null?null:digest(row[key]);
  return result;
 });
 const enriched={...prepared,preview:{...prepared.preview,weeks:[{...prepared.preview.weeks[0],publicationId:raw.publicationId,versionId:vector.versionId,
  database_projection_identity:raw.envelope.database_projection_identity,replayDigest:raw.replayDigest,compilerVersion:raw.compilerVersion,
  sourceDigest:a.inputDigest,sourceDigestBasis:'envelope.authority.inputDigest',geographyDigest:digest(a.compilerInput.proximity),geographyDigestBasis:'envelope.authority.compilerInput.proximity',
  projectionAvailability:availability,projectionAvailabilityDigest:digest(a.projectionAvailability),projectionAvailabilityBasis:'envelope.authority.projectionAvailability',
  objective:{mode:raw.objective.mode,policyVersion:raw.objective.policyVersion,rankingOrder:raw.objective.rankingOrder},metrics:raw.metrics}]}};
 const f=pageFixture();f.patch({manager_id:prepared.prepared_by_manager_id});
 const body={command_kind:'absence',employee_id:prepared.semantic_body.employeeId,start_date:prepared.semantic_body.startDate,end_date:prepared.semantic_body.endDate,
  absence_kind:prepared.semantic_body.absenceKind,client_prepare_key:'98000000-0000-4000-8000-000000000083',expected_revision:prepared.expected_revision};
 const binding={weekStart:vector.weekStart,publicationId:vector.publicationId,versionId:vector.versionId};
 let phase='PREPARING',confirmCalls=0,failConfirm=false,readPatch=null,awaitRead=null,deny=false;const requests=[];
 const accepted={...prepared,state:'ACCEPTED',preview:null,accepted_revision:prepared.expected_revision+1,accepted_receipt:{
  event:'ACCEPTED',operation_id:prepared.operation_id,manager_id:prepared.prepared_by_manager_id,semantic_digest:prepared.semantic_digest,
  preview_digest:prepared.preview_digest,candidate_set_digest:prepared.candidate_set_digest,authority_revision:prepared.expected_revision+1,
  projections:{[vector.weekStart]:{projection_id:PID,publication_id:vector.publicationId,projection_identity:raw.envelope.database_projection_identity,lunch_document_identity:raw.lunchDocument.document_identity}}}};
 const api=async(path,options={})=>{requests.push({path,options});if(deny)throw Object.assign(Error('denied'),{status:403,serverRejected:true});
  if(path===A.staffingCommandPath){assert.equal(f.map.size,1,'original prepare bytes are saved before dispatch');return{operation_id:prepared.operation_id,semantic_digest:prepared.semantic_digest,expected_revision:prepared.expected_revision,state:phase};}
  if(path.endsWith('/prepare')){phase='PREPARED';return{operation_id:prepared.operation_id,state:phase};}
  if(path.endsWith('/confirm')){confirmCalls++;const saved=actions.pending();assert.equal(saved.command.confirmationAttempted,true);assert.equal(saved.command.confirmationKey,CID);
   assert.deepEqual(JSON.parse(options.body),{preview_digest:prepared.preview_digest,confirmation_key:CID});phase='ACCEPTED';if(failConfirm)throw Error('lost confirmation response');return structuredClone(accepted.accepted_receipt);}
  if(path===A.staffingCommandPath+'/'+prepared.operation_id){if(awaitRead)await awaitRead;const value=phase==='ACCEPTED'?structuredClone(accepted):phase==='PREPARING'?{...prepared,state:'PREPARING',preview:null}:structuredClone(enriched);if(readPatch)readPatch(value);return value;}
  if(path.startsWith('/static-weekly/manager-snapshot?'))return structuredClone(phase==='ACCEPTED'?current:before);
  if(path==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[]};
  throw Error('Unexpected new staffing route '+path);
 };
 const before={week_start:vector.weekStart,week_end:'2026-10-18',authority_revision:prepared.expected_revision,projection_status:'current',
  current_publication:{publication_id:vector.publicationId,version_id:vector.versionId},latest_projection:{projection_id:SOURCE},
  roster:record.input.slots.map(slot=>({slot_id:slot.id,slot_label:slot.label,contractor_capacity:slot.kind==='CONTRACTOR_CAPACITY',
   incumbencies:(slot.incumbencies||[]).map(person=>({person_id:person.personId,person_name:person.displayName,effective_start:person.effectiveStart,effective_end:person.effectiveEnd}))})),
  availability:record.input.versions[0].slotAvailability.map(row=>({slot_id:row.slotId,day_of_week:row.dayOfWeek,service_date:vector.weekStart,availability_state:row.status})),sources:[],drafts:[],exceptions:[]};
 const current={...before,authority_revision:prepared.expected_revision+1,latest_projection:{projection_id:PID,replay_digest:raw.replayDigest}};
 const actions=A.create({auth:f.auth,api,storage:f.storage,baseUrl:'https://scheduler.onrender.com',nonce:()=>CID,onState:value=>{f.page.state.pending=value;}});
 f.page.state.actions=actions;f.page.state.snapshot=structuredClone(before);f.page.state.principal=A.principal(f.auth);f.page.els.week_start.value=vector.weekStart;f.page.els.service_date.value=body.start_date;
 f.context.api=api;f.page.state.baseUrl='https://scheduler.onrender.com';
 return{...f,body,binding,record,enriched,actions,requests,current,before,accepted,confirmCount:()=>confirmCalls,
  failConfirm:()=>failConfirm=true,patchRead:fn=>readPatch=fn,awaitRead:value=>awaitRead=value,deny:()=>deny=true};
}
test('staffing private preview: exact staged candidate is reviewed once then cleared only by current persisted readback',async()=>{
 const f=privatePreviewFixture(),view=await f.actions.prepareStaffing(f.body,f.binding);
 assert.equal(view.state,'PREPARED');assert.equal(f.confirmCount(),0);assert.equal(f.actions.pending().command.operationId,view.operation_id);
 assert.ok(JSON.stringify(f.actions.pending()).length<4000,'large rows/certificates are not stored in the UI pending record');
 const result=await f.actions.confirmStaffing(view);assert.equal(result.state,'ACCEPTED');assert.equal(f.confirmCount(),1);
 assert.equal(f.actions.acknowledge({...f.current,authority_revision:f.current.authority_revision+1}),false);
 assert.equal(f.actions.acknowledge({...f.current,latest_projection:{projection_id:PID,replay_digest:'0'.repeat(64)}}),false);
 assert.equal(f.actions.acknowledge(f.current),true);assert.equal(f.map.size,0);
});
test('staffing private preview: lost confirmation reply resumes GET only, never another confirmation or prepare key',async()=>{
 const f=privatePreviewFixture(),view=await f.actions.prepareStaffing(f.body,f.binding);const encoded=f.actions.pending().encoded;f.failConfirm();
 await assert.rejects(f.actions.confirmStaffing(view),/lost confirmation/);assert.equal(f.actions.pending().command.confirmationAttempted,true);
 const count=f.requests.length;const value=await f.actions.retry();assert.equal(value.state,'ACCEPTED');assert.equal(f.confirmCount(),1);
 assert.ok(f.requests.slice(count).every(r=>r.options.method==='GET'));assert.equal(f.actions.pending().encoded,encoded);
});
test('staffing private preview: same digest with changed rendered candidate refuses before confirmation',async()=>{
 const f=privatePreviewFixture(),view=await f.actions.prepareStaffing(f.body,f.binding);f.patchRead(value=>{value.preview.weeks[0].assignments[0].work_snapshot.locationNameSnapshot='Changed after review';});
 await assert.rejects(f.actions.confirmStaffing(view),/preview changed/);assert.equal(f.confirmCount(),0);assert.equal(f.actions.pending().command.confirmationAttempted,false);
});
test('staffing private preview: credential change while awaiting current read cannot consume response or confirm',async()=>{
 const f=privatePreviewFixture(),view=await f.actions.prepareStaffing(f.body,f.binding);let release;f.awaitRead(new Promise(r=>release=r));
 const work=f.actions.confirmStaffing(view);f.patch({credential_id:SOURCE});release();await assert.rejects(work,/access changed/);assert.equal(f.confirmCount(),0);assert.equal(f.map.size,1);
});
test('staffing private preview: manager DOM renders actual dated capacity, source policy and honest duration limits before one confirm',async()=>{
 const f=privatePreviewFixture();await f.actions.prepareStaffing(f.body,f.binding);await f.page.resumeStaffingPreview();
 const duties=f.nodes.get('approved-preview-rows').children;assert.equal(duties.length,f.enriched.preview.weeks[0].assignments.length);
 assert.ok(duties.every(row=>row.children[1].textContent.startsWith('CoverAll capacity')));assert.ok(duties.every(row=>row.children[0].textContent==='2026-10-12'));
 const text=f.nodes.get('approved-preview-summary').textContent;assert.match(text,/Relative weekly equity index/);assert.match(text,/not a ≤0.5/);assert.match(text,/performed readiness are not established/);
 const capacity=f.nodes.get('approved-preview-capacity-rows').children;assert.ok(capacity.some(row=>row.children[3].textContent.includes('source effort min')));
 assert.ok(capacity.every(row=>row.children[5].textContent.startsWith('Unknown')));assert.equal(f.nodes.get('staffing-confirm-btn').disabled,false);
 f.context.confirmAction=async()=>true;await f.page.confirmStaffingPreview();assert.equal(f.confirmCount(),1);assert.equal(f.map.size,0);
 assert.match(f.nodes.get('coverall-print-link').href,/expected_revision=7/);assert.match(f.nodes.get('coverall-print-link').href,/projection_id=/);
});
test('staffing private preview: existing one-absence button mounts private preparation without generic mutation, then renders the reviewed candidate',async()=>{
 const f=privatePreviewFixture(),slot=f.record.input.slots.find(row=>row.incumbencies?.some(person=>person.personId===f.body.employee_id));
 f.context.document.querySelectorAll=selector=>selector==='[data-callout-slot]:checked:not(:disabled)'?[{dataset:{calloutSlot:slot.id}}]:[];
 f.page.els.absence_type.value=f.body.absence_kind;f.context.crypto={randomUUID:()=>f.body.client_prepare_key};
 await f.page.applyDayChanges();assert.equal(f.actions.pending().command.phase,'PREPARED');assert.equal(f.confirmCount(),0);
 assert.equal(f.requests.filter(row=>row.path===A.staffingCommandPath).length,1);
 assert.equal(f.requests.some(row=>row.path==='/static-weekly/day-changes/batch'),false);
 assert.equal(f.nodes.get('approved-preview-panel').hidden,false);assert.equal(f.nodes.get('staffing-confirm-btn').disabled,false);
 assert.equal(f.page.state.preview,null);assert.equal(f.page.state.staffingPreview.value.operation_id,f.enriched.operation_id);
});
test('staffing private preview: missing shift/provenance/metrics stays unknown and never borrows selected-day person identity',async()=>{
 const f=privatePreviewFixture();f.patchRead(value=>{if(value.state!=='PREPARED')return;const week=value.preview.weeks[0];week.metrics=null;
  for(const row of week.projectionAvailability){row.shift=null;row.productiveCapacityProvenanceDigest=null;row.capacityProvenanceDigest=null;}
 });await f.actions.prepareStaffing(f.body,f.binding);await f.page.resumeStaffingPreview();
 const rows=f.nodes.get('approved-preview-capacity-rows').children;assert.ok(rows.every(row=>row.children[2].textContent.includes('Available time unknown')));
 assert.match(f.nodes.get('approved-preview-summary').textContent,/equity index unknown/);assert.equal(f.confirmCount(),0);
});
test('staffing private preview: absence permission revocation during awaited candidate read preserves original bytes and refuses confirmation',async()=>{
 const f=privatePreviewFixture(),view=await f.actions.prepareStaffing(f.body,f.binding);const bytes=f.actions.pending().encoded;let release;
 f.awaitRead(new Promise(r=>release=r));const work=f.actions.confirmStaffing(view);f.patch({read_only:true});release();
 await assert.rejects(work,/Staffing absence permission changed\./);assert.equal(f.confirmCount(),0);assert.equal(f.actions.pending().encoded,bytes);assert.equal(f.actions.pending().command.confirmationAttempted,false);
});
test('staffing private preview: in-flight preparation rejects another prepare before replacing saved work',async()=>{
 const f=privatePreviewFixture();let release;f.awaitRead(new Promise(r=>release=r));const work=f.actions.prepareStaffing(f.body,f.binding);
 const original=f.actions.pending().encoded;
 await assert.rejects(f.actions.prepareStaffing({...f.body,client_prepare_key:CID},f.binding),/already in progress/);
 assert.equal(f.actions.pending().encoded,original);assert.equal(f.requests.filter(row=>row.path===A.staffingCommandPath).length,1);
 release();await work;assert.equal(f.actions.pending().command.phase,'PREPARED');assert.equal(f.confirmCount(),0);
});
test('staffing private preview: mounted confirmation button invokes the real page handler and one exact persisted readback',async()=>{
 const f=privatePreviewFixture();await f.actions.prepareStaffing(f.body,f.binding);await f.page.resumeStaffingPreview();
 const button=f.nodes.get('staffing-confirm-btn');assert.ok(button);assert.equal(button.type,'button');assert.equal(button.disabled,false);
 assert.equal(typeof button.listeners.get('click'),'function');assert.equal(f.nodes.get('approved-preview-panel').children.includes(button),true);
 f.context.confirmAction=async()=>true;await button.listeners.get('click')();assert.equal(f.confirmCount(),1);assert.equal(f.map.size,0);
 assert.match(f.nodes.get('coverall-print-link').href,/expected_revision=7/);
});
test('staffing private preview: actual persisted Task7 DTO binds and renders without substitute enrichment or new SQL',()=>{
 const dir=process.env.TASK8_CONFIRMED_JOIN_CAPTURE_DIR??fileURLToPath(new URL('../test-fixtures/ci/task8-confirmed-join',import.meta.url));assert.ok(dir,'exact completed main capture required');
 const read=(name,sha)=>{const bytes=fs.readFileSync(dir+'/'+name);assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);return JSON.parse(bytes);};
 const join=read('task8-join-result.json','d94202cae24a58ec2fe332423c73695edad3b79d9f3e340607ed96b902e28065');
 const setup=read('task8-setup-ready.json','d2a04cdf024358b1dc814b55a2b3a187dec7e80df0063f8ec7e5165307bab8a0');
 const value=read('task8-join-prepared.json','4a3683a9a86dac920252c9b6049a9cd70fc697c6d0ea6ecae899e312d6b5343a');
 const f=pageFixture(),week=value.preview.weeks[0],request=setup.request;
 const body={command_kind:request.commandKind,employee_id:request.employeeId,start_date:request.startDate,end_date:request.endDate,
  absence_kind:request.absenceKind,client_prepare_key:request.clientPrepareKey,expected_revision:request.expectedRevision};
 const record={path:A.staffingCommandPath,body,encoded:JSON.stringify(body),weekStart:week.week_start,publicationId:week.publicationId,versionId:week.versionId,
  managerId:value.prepared_by_manager_id,state:'PENDING',command:{phase:'PREPARED',operationId:value.operation_id,semanticDigest:value.semantic_digest,
   previewDigest:value.preview_digest,inputDigest:value.input_digest,candidateSetDigest:value.candidate_set_digest,
   projectionIdentity:week.database_projection_identity,replayDigest:week.replayDigest,confirmationAttempted:false,confirmationKey:null}};
 f.patch({manager_id:record.managerId});f.page.state.pending=record;f.page.state.principal=A.principal(f.auth);
 f.page.state.snapshot={week_start:week.week_start,authority_revision:request.expectedRevision,current_publication:{publication_id:week.publicationId,version_id:week.versionId}};
 f.page.els.week_start.value=week.week_start;f.page.els.service_date.value=request.startDate;
 assert.equal(A.validateStaffingPreview(value,record).operation_id,join.operationId);
 f.context.inputPrepared=value;vm.runInContext('state.staffingPreview={value:inputPrepared,context:staffingContext()};renderApprovedPreview();',f.context);
 assert.equal(f.nodes.get('approved-preview-rows').children.length,week.assignments.length);
 assert.equal(f.nodes.get('approved-preview-capacity-rows').children.length,week.projectionAvailability.length);
 assert.match(f.nodes.get('approved-preview-summary').textContent,new RegExp(String(week.metrics.weekly.normalizedInequity)));
 assert.match(f.nodes.get('approved-preview-summary').textContent,new RegExp(week.geographyDigest));
 assert.equal(f.nodes.get('staffing-confirm-btn').disabled,false);assert.equal(f.requests,undefined,'no helper HTTP/SQL/confirmation was invoked');
 assert.equal(join.confirmationCalls,1);assert.equal(join.realManagerBrowserProven,false);assert.equal(join.phoneDeliveryProven,false);
});
test('staffing private preview: date or publication change during confirmation dialog sends nothing',async()=>{
 for(const change of ['date','publication']){const f=privatePreviewFixture();await f.actions.prepareStaffing(f.body,f.binding);await f.page.resumeStaffingPreview();
  f.context.confirmAction=async()=>{if(change==='date')f.page.els.service_date.value='2026-10-13';else f.page.state.snapshot.current_publication.publication_id=SOURCE;return true;};
  await f.page.confirmStaffingPreview();assert.equal(f.confirmCount(),0);assert.equal(f.actions.pending().command.confirmationAttempted,false);
  assert.match(f.page.els.status.textContent,/changed/);
 }
});
test('read-only manager gets only the intended UI capabilities',()=>{const f=fixture();assert.deepEqual(A.permissions(f.auth),{read:true,owner:false,absences:true,coverall:true,routes:true,closeScanTickets:true});f.patch({permissions:{schema:'wrong',read:true,owner:true}});assert.equal(A.permissions(f.auth).owner,false);});
test('exact request is durable before network dispatch',async()=>{const f=fixture(),a=f.create();await a.run(path,body);assert.equal(f.map.size,1);assert.equal(a.pending().encoded,f.calls[0].options.body);assert.equal(a.pending().state,'ACCEPTED');assert.equal(a.acknowledge(snapshot),true);assert.equal(f.map.size,0);});
test('unknown outcome preserves identical body/key across reload and retry',async()=>{const f=fixture(),a=f.create();f.setMode('offline');await assert.rejects(a.run(path,body));assert.equal(a.pending().state,'PENDING');f.setMode('accept');await f.create().retry();assert.equal(f.calls[0].options.body,f.calls[1].options.body);assert.equal(JSON.parse(f.calls[1].options.body).idempotency_key,'stable-fixture');});
test('unresolved request prevents a second mutation',async()=>{const f=fixture(),a=f.create();f.setMode('offline');await assert.rejects(a.run(path,body));await assert.rejects(a.run(path,{...body,idempotency_key:'different'}));assert.equal(f.calls.length,1);});
test('storage failure prevents request',async()=>{const f=fixture();f.storage.setItem=()=>{throw Error('storage full');};await assert.rejects(f.create().run(path,body));assert.equal(f.calls.length,0);});
test('a malformed successful response is not accepted',async()=>{const f=fixture(),a=f.create();f.reply.revision=0;await assert.rejects(a.run(path,body));assert.equal(a.pending().state,'PENDING');});
test('accepted request is retained until exact current readback',async()=>{const f=fixture(),a=f.create();await a.run(path,body);assert.equal(a.acknowledge({...snapshot,projection_status:'stale_staffing_change'}),false);assert.equal(a.acknowledge({...snapshot,latest_projection:{projection_id:SOURCE}}),false);assert.equal(a.pending().state,'ACCEPTED');assert.equal(a.acknowledge(snapshot),true);});
test('accepted receipt retry never sends another HTTP request',async()=>{const f=fixture(),a=f.create();await a.run(path,body);await a.retry();assert.equal(f.calls.length,1);});
test('only explicit rejection can be dismissed',async()=>{const f=fixture(),a=f.create();f.setMode('offline');await assert.rejects(a.run(path,body));assert.throws(()=>a.discardRejected());f.setMode('reject');await assert.rejects(a.retry());assert.equal(a.pending().state,'REJECTED');a.discardRejected();assert.equal(f.map.size,0);});
test('corrupt saved operation fails closed',async()=>{const f=fixture(),a=f.create();f.setMode('offline');await assert.rejects(a.run(path,body));const key=[...f.map.keys()][0];f.map.set(key,'broken JSON');await assert.rejects(a.retry());assert.equal(f.calls.length,1);});
test('different manager never receives or submits original saved operation',async()=>{const f=fixture(),a=f.create();f.setMode('offline');await assert.rejects(a.run(path,body));f.patch({manager_id:SOURCE});assert.throws(()=>a.pending());await assert.rejects(a.retry());assert.equal(f.calls.length,1);assert.equal(f.create().pending(),null);});
test('credential change during response cannot accept it',async()=>{const f=fixture(),a=f.create();let release;f.setPending(new Promise(r=>release=r));const task=a.run(path,body);f.patch({credential_id:SOURCE});release();await assert.rejects(task);assert.equal(f.map.size,1);});
test('regeneration without publication in request verifies returned routes',async()=>{const f=fixture(),a=f.create();const input={week_start:'2026-10-05',expected_revision:42,idempotency_key:'regenerate'};await a.run('/static-weekly/rebuild-current-projection',input);assert.equal(a.acknowledge(snapshot),true);});
test('ordinary administrative path cannot use dated action helper',async()=>{const f=fixture();await assert.rejects(f.create().run('/static-weekly/roster/vacant-slots',body));assert.equal(f.calls.length,0);});
const initial={source_id:SOURCE,template_id:'approved-six',effective_start:'2026-10-05',expected_revision:42};
const preview={schema:'custodial.approved-static-initial-preview.v1',status:'PREVIEW_ONLY',published:false,solverInvoked:false,sourceId:SOURCE,templateId:'approved-six',serviceDate:'2026-10-05',authorityRevision:42,previewDigest:'a'.repeat(64),mapping:{},lunch:{loans:[],responsibilities:[]},assignments:[{planWorkId:'fixture-work',serviceDate:'2026-10-06',status:'ASSIGNED',personId:MID,slotId:CID,window:{start:'07:00',end:'08:00'}}],constraintView:{schema:'custodial.approved-static-constraint-view.v1',contract:'FIXED_APPROVED_PATTERN_COMPLETE_HARD_CONSTRAINTS_NOT_OPTIMALITY',hardConstraintDigest:'d'.repeat(64),physicalCoverageDigest:'e'.repeat(64),mappingDigest:'f'.repeat(64),hardConstraintCount:1,slotAvailability:[{slot_id:CID,day_of_week:1}],projectionAvailability:[{serviceDate:'2026-10-05',slotId:CID,incumbentPersonId:MID,incumbentName:'Current worker',status:'working'}],balance:{optimized:false},opening:{proven:false}}};
test('approved initial preview is complete and selector-bound',()=>{assert.equal(P.validatePreview('initial',preview,initial,{}).templateId,'approved-six');for(const patch of[{sourceId:CID},{serviceDate:'2026-10-12'},{solverInvoked:true},{authorityRevision:41},{assignments:[]},{templateId:'other'}])assert.throws(()=>P.validatePreview('initial',{...preview,...patch},initial,{}));});
test('browser assignments cannot substitute for approved source selectors',()=>{assert.throws(()=>P.selectors('initial',{...initial,assignments:[]}));assert.throws(()=>P.selectors('initial',{...initial,effective_start:'2026-10-06'}));});
test('duplicate approved duty identities fail',()=>assert.throws(()=>P.validatePreview('initial',{...preview,assignments:[preview.assignments[0],preview.assignments[0]]},initial,{})));
test('approved confirmation has stable retry and separate current-readback',async()=>{const f=fixture();f.patch({read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}});let mode='offline';const calls=[];const response={schema:'custodial.approved-static-initial-confirmation.v1',status:'PERSISTED_CURRENT',ok:true,persistence_status:'PERSISTED',solverInvoked:false,source_id:SOURCE,publication_id:SOURCE,projection_id:PID,lunch_document_identity:'b'.repeat(64),authority_revision:43,previewDigest:'a'.repeat(64)};
const a=P.create({auth:f.auth,managerId:MID,baseUrl:'https://scheduler.onrender.com',storage:f.storage,nonce:()=>CID,api:async(path,request)=>{calls.push({path,request});if(mode==='offline')throw Error('network');assert.equal(request.method,'GET');return{schema:'custodial.approved-static-confirmation-status.v1',kind:'initial',state:'ACCEPTED',confirmationKey:CID,request:{sourceId:SOURCE,effectiveStart:initial.effective_start,templateId:initial.template_id,expectedRevision:42,previewDigest:preview.previewDigest,idempotencyKey:CID},receipt:response};}});await assert.rejects(a.confirm('initial',preview,initial));mode='normal';await a.retry();assert.equal(calls[1].request.body,undefined);assert.equal(calls[1].path,P.paths.initial+'/confirmations/'+CID);assert.equal(a.pending().acceptance.status,'PERSISTED_CURRENT');assert.throws(()=>a.acknowledge({...snapshot,projection_status:'missing'}));a.acknowledge(snapshot);assert.equal(a.pending(),null);});

test('accepted database result survives failed later coordination without a second POST',async()=>{const f=fixture();let calls=0;const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async()=>{calls++;throw Object.assign(Error('lease settlement unavailable'),{status:503,serverRejected:false,acceptedResult:f.reply});}});await a.run(path,body);assert.equal(a.pending().state,'ACCEPTED');assert.equal(a.pending().coordination_pending,true);await a.retry();assert.equal(calls,1);assert.equal(a.acknowledge(snapshot),true);});
test('unbound claimed acceptance is not used as a schedule receipt',async()=>{const f=fixture();const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async()=>{throw Object.assign(Error('invalid acceptance'),{status:503,acceptedResult:{...f.reply,revision:0}});}});await assert.rejects(a.run(path,body));assert.equal(a.pending().state,'PENDING');});
test('a conclusively rejected request is never resent by Retry',async()=>{const f=fixture(),a=f.create();f.setMode('reject');await assert.rejects(a.run(path,body));await assert.rejects(a.retry(),/conclusively rejected/);assert.equal(f.calls.length,1);});

test('scheduler integration: route-only manager can regenerate, not record absences',async()=>{
 const f=fixture();f.patch({permissions:{schema:'custodial.manager-permissions.v1',read:true,regenerate_routes:true}});
 const a=f.create();await a.run('/static-weekly/rebuild-current-projection',{week_start:'2026-10-05',expected_revision:42,idempotency_key:'route-only'});
 assert.equal(a.acknowledge(snapshot),true);await assert.rejects(a.run(path,body),/not authorized/);assert.equal(f.calls.length,1);
});
test('scheduler integration: absence-only manager can submit absences, not regenerate',async()=>{
 const f=fixture();f.patch({permissions:{schema:'custodial.manager-permissions.v1',read:true,manage_absences:true}});
 const a=f.create();await a.run(path,body);assert.equal(a.acknowledge(snapshot),true);
 await assert.rejects(a.run('/static-weekly/rebuild-current-projection',{week_start:'2026-10-05',expected_revision:43,idempotency_key:'not-routes'}),/not authorized/);assert.equal(f.calls.length,1);
});
test('scheduler integration: pending retry respects revoked route capability without losing bytes',async()=>{
 const f=fixture(),a=f.create();f.setMode('offline');await assert.rejects(a.run('/static-weekly/rebuild-current-projection',{week_start:'2026-10-05',expected_revision:42,idempotency_key:'keep-route'}));
 const encoded=a.pending().encoded;f.patch({permissions:{schema:'custodial.manager-permissions.v1',read:true,manage_absences:true}});
 await assert.rejects(a.retry(),/not authorized/);assert.equal(f.calls.length,1);assert.equal(a.pending().encoded,encoded);assert.equal(a.pending().state,'PENDING');
});
test('scheduler integration: manual CoverAll batch cannot bypass its distinct capability',async()=>{
 const f=fixture();f.patch({permissions:{schema:'custodial.manager-permissions.v1',read:true,manage_absences:true,regenerate_routes:true}});
 await assert.rejects(f.create().run(path,{...body,operations:[{operation:'cover_all',slotId:CID}]}),/not authorized/);assert.equal(f.calls.length,0);assert.equal(f.map.size,0);
});
async function weekArrivalFixture(){
 const f=initialWeekFixture();await f.page.init();
 const firstWeek='2026-10-05',secondWeek='2026-10-12',base=structuredClone(f.page.state.snapshot);
 const snapshots=new Map([[firstWeek,base],[secondWeek,{...structuredClone(base),week_start:secondWeek,
  week_end:'2026-10-18',authority_revision:base.authority_revision+1}]]);
 const calls=[],gates=[];let choices=0,unpublished=null;
 f.page.state.baseUrl='https://scheduler.onrender.com';f.context.api=f.page.api;
 f.auth.opsManagerAuthHeaders=async()=>({'X-Test-Input':'SYNTHETIC_NOT_AUTHENTICATION'});
 f.context.fetch=async(url,options)=>{
  const parsed=new URL(url),path=parsed.pathname+parsed.search;calls.push({path,options});
  let ok=true,status=200,data;
  if(parsed.pathname==='/static-weekly/manager-snapshot'){
   const week=parsed.searchParams.get('week_start');assert.ok(snapshots.has(week));data=structuredClone(snapshots.get(week));
   if(week===unpublished){ok=false;status=409;data=null;}
  }else if(parsed.pathname==='/static-weekly/approved-initial/selection')data=structuredClone(f.metadata);
  else if(path==='/static-weekly/approved-choices')data={schema:'custodial.approved-schedule-choices.v1',initial:[{
   source_id:SOURCE,template_id:'TEST_INPUT_choice_'+(++choices),effective_start:f.page.els.week_start.value,staffing_count:6}]};
  else throw Error('Unexpected transport in arrival fixture: '+path);
  const gate=gates.find(value=>!value.used&&value.path===path);
  if(gate){gate.used=true;gate.entered();await gate.promise;}
  const payload=ok?{ok:true,data}:{ok:false,code:'23514',error:'initial manager snapshot requires one active registered recurring source'};
  return{ok,status,json:async()=>JSON.parse(JSON.stringify(payload))};
 };
 const hold=path=>{let entered,release,reject;const ready=new Promise(resolve=>entered=resolve);
  const promise=new Promise((resolve,refuse)=>{release=resolve;reject=refuse;});promise.catch(()=>{});
  gates.push({path,promise,entered,used:false});return{ready,release,reject};};
 const select=week=>{f.page.els.week_start.value=week;f.page.els.service_date.value=week;};
 const seedAccepted=async()=>{
  const request={...body,service_date:firstWeek,week_start:firstWeek,expected_revision:base.authority_revision-1,
   publication_id:base.current_publication.publication_id,idempotency_key:'arrival-original'};
  const actions=A.create({auth:f.auth,storage:f.storage,baseUrl:f.page.state.baseUrl,onState:value=>f.page.state.pending=value,
   api:async()=>({revision:base.authority_revision,data:{current_projection:{projection_id:base.latest_projection.projection_id,
    publication_id:base.current_publication.publication_id,week_start:firstWeek}}})});
  await actions.run(path,request);f.page.state.actions=actions;
  return [...f.map.values()][0];
 };
 return{...f,firstWeek,secondWeek,base,calls,snapshots,hold,select,seedAccepted,setUnpublished:week=>unpublished=week};
}
test('CURRENT_WEEK_ARRIVAL_NEW: queued selection callback while busy cannot acknowledge stale requested week',async()=>{
 const f=await weekArrivalFixture(),saved=await f.seedAccepted();
 const gate=f.hold('/static-weekly/manager-snapshot?week_start='+f.firstWeek);
 const work=f.page.els.refresh_btn.listeners.get('click')();await gate.ready;
 assert.equal(f.page.state.busy,true);assert.equal(f.page.els.week_start.disabled,true);
 f.select(f.secondWeek);
 // Deliver the existing change callback, not an invented load implementation.
 // The DOM stub models a queued callback; no genuine browser timing is claimed.
 f.page.els.week_start.listeners.get('change')();
 assert.equal(f.calls.filter(row=>row.path.startsWith('/static-weekly/manager-snapshot')).length,1,
  'Existing busy gate prevents a second network read, but selection already changed');
 gate.release();await work;
 assert.equal(f.map.size,1,'Stale old-week response cleared an unrelated original accepted request');
 assert.equal([...f.map.values()][0],saved);assert.equal(f.page.els.week_start.value,f.secondWeek);
 assert.equal(f.page.els.service_date.value,f.secondWeek,'Stale response rewrote the selected service day');
 assert.equal(f.page.state.busy,false);assert.ok(f.calls.every(row=>!row.options.method||row.options.method==='GET'));
});
test('CURRENT_WEEK_ARRIVAL_NEW: older week response cannot overwrite newer direct owner read or its status',async()=>{
 const f=await weekArrivalFixture(),saved=await f.seedAccepted(),gate=f.hold('/static-weekly/manager-snapshot?week_start='+f.firstWeek);
 const old=f.page.refreshSnapshot();await gate.ready;f.select(f.secondWeek);await f.page.refreshSnapshot();
 const current=f.page.state.snapshot,choices=f.page.state.approvedChoices,status=f.page.els.status.textContent;
 assert.equal(current.week_start,f.secondWeek);gate.release();await old;
 assert.equal(f.page.state.snapshot,current);assert.equal(f.page.state.approvedChoices,choices);assert.equal(f.page.els.status.textContent,status);
 assert.equal(f.page.els.service_date.value,f.secondWeek);assert.equal([...f.map.values()][0],saved);
 assert.equal(f.page.state.accessDenied,false);assert.ok(f.calls.every(row=>!row.options.method||row.options.method==='GET'));
});
test('CURRENT_WEEK_ARRIVAL_NEW: old choices cannot overwrite newer same-week or different-week generation',async()=>{
 for(const sameWeek of [false,true]){
  const f=await weekArrivalFixture(),saved=await f.seedAccepted(),gate=f.hold('/static-weekly/approved-choices');
  const old=f.page.refreshSnapshot();await gate.ready;
  assert.equal([...f.map.values()][0],saved,'Receipt must remain until this complete read is current');
  f.select(sameWeek?f.firstWeek:f.secondWeek);await f.page.refreshSnapshot();
  const choices=f.page.state.approvedChoices,status=f.page.els.status.textContent,current=f.page.state.snapshot;
  gate.release();await old;assert.equal(f.page.state.approvedChoices,choices);assert.equal(f.page.state.snapshot,current);
  assert.equal(f.page.els.status.textContent,status);assert.equal(choices.initial[0].template_id,'TEST_INPUT_choice_2');
  assert.equal(f.map.size,sameWeek?0:1);
 }
});
test('CURRENT_WEEK_ARRIVAL_NEW: stale snapshot or choices errors do not erase newer choices or overwrite loaded status',async()=>{
 for(const kind of ['snapshot','choices']){
  const f=await weekArrivalFixture(),gate=f.hold(kind==='snapshot'?'/static-weekly/manager-snapshot?week_start='+f.firstWeek:'/static-weekly/approved-choices');
  const old=f.page.refreshSnapshot();await gate.ready;f.select(f.secondWeek);await f.page.refreshSnapshot();
  const current=f.page.state.snapshot,choices=f.page.state.approvedChoices,status=f.page.els.status.textContent;
  gate.reject(Error('SYNTHETIC old response failed'));await old;
  assert.equal(f.page.state.snapshot,current);assert.equal(f.page.state.approvedChoices,choices);
  assert.equal(f.page.els.status.textContent,status);assert.equal(f.page.state.accessDenied,false);
 }
});
test('CURRENT_WEEK_ARRIVAL_NEW: stale unpublished selection cannot replace newer published week',async()=>{
 const f=await weekArrivalFixture();f.setUnpublished(f.secondWeek);f.select(f.secondWeek);
 const gate=f.hold('/static-weekly/approved-initial/selection?week_start='+f.secondWeek);
 const old=f.page.refreshSnapshot();await gate.ready;f.select(f.firstWeek);await f.page.refreshSnapshot();
 const snapshot=f.page.state.snapshot,choices=f.page.state.approvedChoices,status=f.page.els.status.textContent;
 gate.release();await old;assert.equal(f.page.state.snapshot,snapshot);assert.equal(f.page.state.initialSelection,null);
 assert.equal(f.page.state.approvedChoices,choices);assert.equal(f.page.els.status.textContent,status);
 assert.equal(f.nodes.get('day-changes-section').hidden,false);
});
test('CURRENT_WEEK_ARRIVAL_NEW: current completed read acknowledges once while selected-only stale read preserves original',async()=>{
 const f=await weekArrivalFixture(),saved=await f.seedAccepted(),gate=f.hold('/static-weekly/approved-choices');
 const read=f.page.refreshSnapshot();await gate.ready;assert.equal([...f.map.values()][0],saved);
 f.select(f.secondWeek);gate.release();await read;
 assert.equal([...f.map.values()][0],saved);assert.doesNotMatch(f.page.els.status.textContent,/Loaded/);
 f.select(f.firstWeek);await f.page.refreshSnapshot();assert.equal(f.map.size,0);
 assert.equal(f.page.state.snapshot.week_start,f.firstWeek);assert.match(f.page.els.status.textContent,/Loaded 2026-10-05 through 2026-10-11/);
 assert.ok(f.calls.every(row=>!row.options.method||row.options.method==='GET'));
});

// Existing DOM/controller/DTO fixture; the transport remains explicitly
// synthetic DATA, not named-manager, browser, compiler or SQL evidence.
async function originalResumeFixture(){
 const f=cancellationFixture();await f.page.reverseChange(f.event);
 const before=f.actions.pending();assert.equal(before.command.confirmationAttempted,false);
 f.setFailConfirm(true);f.context.confirmAction=async()=>true;await f.page.confirmStaffingPreview();
 assert.equal(f.confirmationCount(),1);const saved=f.actions.pending();assert.equal(saved.command.confirmationAttempted,true);
 const raw=f.storage.getItem([...f.map.keys()][0]);
 // Reload the REAL controller from the original stored bytes, then use the
 // REAL page API (including its post-json principal check), not the fixture
 // api function directly. Only fetch/headers supply inert transport DATA.
 const server=f.context.api;f.context.api=f.page.api;f.page.state.baseUrl='https://scheduler.onrender.com';
 f.auth.opsManagerAuthHeaders=async()=>({'X-Test-Input':'SYNTHETIC_NOT_AUTHENTICATION'});
 let holdPath=null,release=null,entered=null,latePatch=null,armLate=false;
 const transport=[];
 const originalSession=f.auth.readSession;
 f.auth.readSession=()=>{const value=originalSession();if(armLate){armLate=false;queueMicrotask(()=>f.patch(latePatch));}return value;};
 f.context.fetch=async(url,options)=>{
  const parsed=new URL(url),path=parsed.pathname+parsed.search;transport.push({path,options});
  if(path===holdPath){entered?.();await new Promise(resolve=>release=resolve);}
  const value=await server(path,options);
  return{ok:true,status:200,json:async()=>{
   if(latePatch&&path==='/static-weekly/approved-choices')armLate=true;
   return JSON.parse(JSON.stringify({ok:true,data:value}));
  }};
 };
 const attach=()=>A.create({auth:f.auth,api:f.page.api,storage:f.storage,baseUrl:f.page.state.baseUrl,
  nonce:()=>{throw Error('Resume must not create a new command or confirmation identity');},onState:value=>f.page.state.pending=value});
 const reloaded=attach();f.page.state.actions=reloaded;reloaded.pending();
 return{...f,reloaded,transport,raw,saved,attach,
  latePrincipalPatch:value=>latePatch=value,
  hold(path){holdPath=path;return new Promise(resolve=>entered=resolve);},release(){holdPath=null;release();}};
}
test('ORIGINAL_CONFIRMATION_RESUME_NEW: principal loss after last API check cannot publish accepted revision CURRENT',async()=>{
 const f=await originalResumeFixture();f.latePrincipalPatch({credential_id:SOURCE});
 let failure;try{await f.page.resumeStaffingPreview();}catch(error){failure=error;}
 assert.ok(failure,'Predecessor published CURRENT after synthetic credential withdrawal between API and renderer continuations');
 assert.match(failure.message,/Manager access changed/);assert.equal(f.page.state.accessDenied,true);
 assert.equal(f.page.state.snapshot,null);assert.equal(f.nodes.get('.workspace').hidden,true);
 assert.doesNotMatch(f.page.els.status.textContent,/Loaded .* through/);
 assert.equal(f.confirmationCount(),1);assert.ok(f.transport.every(row=>!row.options.method||row.options.method==='GET'));
});
test('ORIGINAL_CONFIRMATION_RESUME_NEW: delayed original status refuses manager credential device loss and retains exact confirmed bytes',async()=>{
 for(const patch of [{manager_id:SOURCE},{credential_id:SOURCE},{device_id:'changed-test-device'},
  {expires_at:'2000-01-01T00:00:00.000Z'},
  {permissions:{schema:'custodial.manager-permissions.v1',read:false,owner:false}}]){
  const f=await originalResumeFixture();const entered=f.hold(A.staffingCommandPath+'/'+f.operation);
  const work=f.page.resumeStaffingPreview();await entered;f.patch(patch);f.release();
  await assert.rejects(work,/Manager access changed|permission changed|not available/);
  assert.equal(f.map.size,1);assert.equal([...f.map.values()][0],f.raw);assert.equal(f.confirmationCount(),1);
  assert.ok(f.transport.every(row=>row.options.method==='GET'));
 }
});
test('ORIGINAL_CONFIRMATION_RESUME_NEW: delayed accepted week readback loses session without clearing original or creating command',async()=>{
 const f=await originalResumeFixture();const entered=f.hold('/static-weekly/manager-snapshot?week_start=2026-10-19');
 const work=f.page.resumeStaffingPreview();await entered;
 const accepted=f.reloaded.pending();assert.equal(accepted.state,'ACCEPTED');
 const saved=[...f.map.values()][0];f.patch({credential_id:SOURCE});f.release();
 await assert.rejects(work,/Manager access changed/);assert.equal([...f.map.values()][0],saved);
 assert.equal(f.page.state.snapshot,null);assert.equal(f.page.state.accessDenied,true);assert.equal(f.confirmationCount(),1);
 assert.ok(f.transport.every(row=>!row.options.method||row.options.method==='GET'));
});
test('ORIGINAL_CONFIRMATION_RESUME_NEW: late manager device revocation or controller replacement hides accepted view immediately',async()=>{
 for(const patch of [{manager_id:SOURCE},{device_id:'late-test-device'},{expires_at:'2000-01-01T00:00:00.000Z'},
  {permissions:{schema:'custodial.manager-permissions.v1',read:false,owner:false}}]){
  const f=await originalResumeFixture();f.latePrincipalPatch(patch);
  await assert.rejects(f.page.resumeStaffingPreview(),/Manager access changed/);
  assert.equal(f.page.state.accessDenied,true);assert.equal(f.page.state.snapshot,null);
  assert.equal(f.nodes.get('.workspace').hidden,true);assert.equal(f.confirmationCount(),1);
  assert.ok(f.transport.every(row=>!row.options.method||row.options.method==='GET'));
 }
 const f=await originalResumeFixture(),entered=f.hold('/static-weekly/approved-choices');
 const work=f.page.resumeStaffingPreview();await entered;f.page.state.actions=f.attach();f.release();
 await assert.rejects(work,/Manager access changed/);assert.equal(f.page.state.snapshot,null);assert.equal(f.confirmationCount(),1);
});
test('ORIGINAL_CONFIRMATION_RESUME_NEW: unchanged original reload reads GET only and publishes exact current accepted revision',async()=>{
 const f=await originalResumeFixture();await f.page.resumeStaffingPreview();
 assert.equal(f.map.size,0);assert.equal(f.page.state.snapshot.authority_revision,f.accepted.accepted_revision);
 assert.equal(f.page.state.snapshot.latest_projection.projection_id,f.accepted.accepted_receipt.projections['2026-10-12'].projection_id);
 assert.equal(f.page.state.accessDenied,false);assert.match(f.page.els.status.textContent,/Loaded 2026-10-12 through 2026-10-18/);
 assert.equal(f.confirmationCount(),1);assert.ok(f.transport.every(row=>!row.options.method||row.options.method==='GET'));
 await assert.rejects(f.page.state.actions.reviewStaffing(),/No saved staffing preview/);
 assert.equal(f.confirmationCount(),1);
});

function pageFixture(){
 const nodes=new Map(),node=()=>({set id(value){this._id=value;nodes.set(value,this);},get id(){return this._id;},value:'',hidden:false,textContent:'',children:[],listeners:new Map(),focus(){},scrollIntoView(){},append(x){this.children.push(x);},replaceChildren(...items){this.children=items;},add(x){this.children.push(x);},get options(){return this.children;},set selectedIndex(i){this.value=this.children[i]?.value||'';},addEventListener(type,fn){this.listeners.set(type,fn);}});
 const document={getElementById:id=>{if(!id||id==='staffing-confirm-btn'&&!nodes.has(id))return null;if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,querySelectorAll:()=>[],querySelector:id=>document.getElementById(id)};
 const f=fixture();f.patch({read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}});
 f.auth.getCSTDateString=()=> '2026-10-05';f.auth.requireOpsManagerSession=async()=>{};
 const context=vm.createContext({document,window:{MemphisSchedulerActions:{...A,create:o=>A.create({...o,storage:f.storage})},MemphisApprovedSchedule:{...P,create:o=>P.create({...o,storage:f.storage,nonce:()=>CID})},MemphisAuth:f.auth,addEventListener(){}},location:{search:'',hash:''},Option:class{constructor(text,value){this.textContent=text;this.value=value;}},crypto:webcrypto,AbortSignal,TextEncoder,setInterval:()=>1,clearInterval(){},URL,URLSearchParams,Date,Set,Map,console});
 const source=fs.readFileSync(new URL('../schedule-weekly.js',import.meta.url),'utf8');
 const startup="init().catch((error)=>setStatus(`Scheduler unavailable: ${safe(error)}`,'error'));";
 assert.equal(source.split(startup).length,2);vm.runInContext(source.replace(startup,''),context);
 vm.runInContext('globalThis.page={state,els,renderChanges,renderApprovedPreview,renderApprovedCapacity,publishDraft,generateDraft,applyDayChanges,rebuildCurrentProjection,reverseChange,refreshSnapshot,api,init,mondayOf,setControls,confirmStaffingPreview,resumeStaffingPreview,displayStaffingPreview,vacancyEls,openTurnoverDialog,openVacancyDialog,loadVacancySource,submitVacancy,renderVacancyPreview,renderRoster};',context);
 return{...f,context,nodes,page:context.page};
}
function serverDayTurnoverFixture(){
 const f=pageFixture(),s={week_start:'2026-10-05',week_end:'2026-10-11',current_service_date:'2026-10-06',projection_status:'current',authority_revision:42,
  current_publication:{publication_id:PID},availability:[],roster:[{slot_id:CID,week_staffing:[
   {service_date:'2026-10-05',person_id:MID,person_name:'Local Monday person'},
   {service_date:'2026-10-06',person_id:SOURCE,person_name:'Server Tuesday person'},
   {service_date:'2026-10-07',person_id:SOURCE,person_name:'Same person next day'}]}]};
 let nonces=0,localReads=0;f.page.state.snapshot=s;f.auth.getCSTDateString=()=>{localReads++;return '2026-10-12';};
 f.page.els.week_start.value=s.week_start;f.page.els.service_date.value='2026-10-05';
 f.page.els.turnover_dialog.showModal=()=>{};f.page.els.turnover_dialog.close=()=>{};
 f.context.crypto={randomUUID:()=>{nonces++;return CID;}};
 f.page.state.actions=A.create({auth:f.auth,api:f.api,baseUrl:'https://scheduler.onrender.com',storage:f.storage,onState:r=>f.page.state.pending=r});
 vm.runInContext('busy=async(work)=>work();refreshSnapshot=async()=>{};globalThis.submitFromSource=submitTurnover;',f.context);
 const open=(mode='departed')=>f.page.openTurnoverDialog({target:{closest:()=>({dataset:{turnoverSlot:CID,turnoverMode:mode}})}});
 return{...f,s,open,submit:()=>f.context.submitFromSource({preventDefault(){}}),nonces:()=>nonces,localReads:()=>localReads};
}
test('TURNOVER_ORIGINAL_PRINCIPAL_NEW: successor owner cannot inherit original open review with remounted current actions',async()=>{
 const f=serverDayTurnoverFixture();f.open();const original=f.page.state.turnoverSelection;let closes=0;
 f.page.els.turnover_dialog.close=()=>{closes++;};f.patch({manager_id:PID});
 // Existing Source auth/action DATA fixture, not actual manager authority.
 // Remount the actual actions helper for CURRENT synthetic owner without
 // reopening/changing the original dialog or server-day/person tuple.
 f.page.state.actions=A.create({auth:f.auth,api:f.api,baseUrl:'https://scheduler.onrender.com',storage:f.storage,onState:r=>f.page.state.pending=r});
 f.setMode('offline');let error;try{await f.submit();}catch(caught){error=caught;}
 assert.equal(f.calls.length,0,'Successor owner inherited old review and reached recorded sender');
 assert.match(error?.message||'',/Manager access changed/);assert.equal(f.nonces(),0);assert.equal(closes,0);
 assert.equal(f.map.size,0);assert.equal(f.page.state.turnoverSelection,original);
});
test('TURNOVER_ORIGINAL_PRINCIPAL_NEW: manager credential device changes and revocation refuse before new command or close',async()=>{
 for(const patch of [{manager_id:PID},{credential_id:SOURCE},{device_id:'successor-device'},
  {read_only:true},{credential_id:null},{permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false}}]){
  const f=serverDayTurnoverFixture();f.open();const original=f.page.state.turnoverSelection;let closes=0;
  f.page.els.turnover_dialog.close=()=>{closes++;};f.patch(patch);
  await assert.rejects(f.submit(),/Manager access changed|not available|not authorized/);
  assert.equal(f.nonces(),0);assert.equal(closes,0);assert.equal(f.calls.length,0);assert.equal(f.map.size,0);
  assert.equal(f.page.state.turnoverSelection,original);
 }
});
test('TURNOVER_ORIGINAL_PRINCIPAL_NEW: private principal is detached frozen identity without token authority',()=>{
 const f=serverDayTurnoverFixture(),expected=A.principal(f.auth);f.open();const selected=f.page.state.turnoverSelection;
 assert.ok(Object.isFrozen(selected)&&Object.isFrozen(selected.principal));
 assert.deepEqual(Object.keys(selected.principal).sort(),['credentialId','deviceId','managerId']);
 assert.deepEqual({...selected.principal},expected);assert.equal(A.same(selected.principal,A.principal(f.auth)),true);
 for(const key of Object.keys(selected.principal)){
  assert.equal(Reflect.set(selected.principal,key,'changed'),false);assert.equal(Reflect.deleteProperty(selected.principal,key),false);
  assert.equal(Reflect.defineProperty(selected.principal,key,{value:'changed'}),false);
 }
 f.patch({manager_id:PID,credential_id:SOURCE,device_id:'new-device'});
 assert.deepEqual({...selected.principal},expected);assert.equal(A.same(selected.principal,A.principal(f.auth)),false);
 assert.equal(f.nonces(),0);assert.equal(f.calls.length,0);assert.equal(f.map.size,0);
});
test('TURNOVER_ORIGINAL_PRINCIPAL_NEW: queued and close-callback principal changes refuse before persistence or send',async()=>{
 for(const patch of [{manager_id:PID},{credential_id:SOURCE},{device_id:'new-device'},{read_only:true}]){
  const queued=serverDayTurnoverFixture();queued.open();const original=queued.page.state.turnoverSelection;let release,closes=0;
  queued.page.els.turnover_dialog.close=()=>{closes++;};
  queued.context.waitPrincipalCheck=new Promise(resolve=>release=resolve);
  vm.runInContext('busy=async(work)=>{await waitPrincipalCheck;return work();};',queued.context);
  const pending=queued.submit();queued.patch(patch);release();
  await assert.rejects(pending,/Manager access changed|not available|not authorized/);
  assert.equal(closes,0);assert.equal(queued.calls.length,0);assert.equal(queued.map.size,0);
  assert.equal(queued.page.state.turnoverSelection,original);assert.equal(queued.nonces(),1,'Only pre-queue original key allocation; no successor command');
  const closing=serverDayTurnoverFixture();closing.open();const selected=closing.page.state.turnoverSelection;
  closing.page.els.turnover_dialog.close=()=>closing.patch(patch);
  await assert.rejects(closing.submit(),/Manager access changed|not available|not authorized/);
  assert.equal(closing.calls.length,0);assert.equal(closing.map.size,0);assert.equal(closing.page.state.turnoverSelection,selected);
 }
});
test('TURNOVER_ORIGINAL_PRINCIPAL_NEW: unchanged principal retains one unknown original and blocks successor resubmission',async()=>{
 // Existing synthetic auth/DOM/transport data only. No actual manager,
 // endpoint authorization, browser, HTTP/SQL or performed-work claim.
 for(const mode of ['departed','replace']){
  const f=serverDayTurnoverFixture();f.open(mode);const selected=f.page.state.turnoverSelection;
  f.patch({device_id:'fixture-browser'});assert.equal(A.same(selected.principal,A.principal(f.auth)),true);
  f.page.els.replacement_name.value='Original reviewed replacement';f.setMode('offline');
  await assert.rejects(f.submit(),/network unavailable/);
  const saved=f.page.state.actions.pending(),encoded=saved.encoded;
  assert.equal(saved.state,'PENDING');assert.equal(saved.managerId,selected.principal.managerId);
  assert.equal(f.calls.length,1);assert.equal(f.nonces(),1);assert.equal(f.page.state.turnoverSelection,null);
  const originalStored=[...f.map.entries()];
  f.patch({manager_id:PID});assert.throws(()=>f.open(mode),/Resolve the saved scheduler request/);
  await assert.rejects(f.submit(),/Resolve the saved scheduler request/);
  assert.throws(()=>f.page.state.actions.pending(),/Manager access changed/);
  assert.deepEqual([...f.map.entries()],originalStored);assert.equal(saved.encoded,encoded);
  assert.equal(f.calls.length,1);assert.equal(f.nonces(),1);
 }
});
test('SERVER_DATE_TURNOVER_NEW: wrong local week cannot disable server-current roster or select local incumbent',()=>{
 const f=pageFixture(),s={week_start:'2026-10-05',week_end:'2026-10-11',current_service_date:'2026-10-06',
  projection_status:'current',authority_revision:42,current_publication:{publication_id:PID},availability:[],roster:[{slot_id:CID,
   week_staffing:[{service_date:'2026-10-05',person_id:MID,person_name:'Monday original'},{service_date:'2026-10-06',person_id:SOURCE,person_name:'Server Tuesday original'}]}]};
 f.page.state.snapshot=s;f.auth.getCSTDateString=()=> '2026-10-12';f.page.els.turnover_dialog.showModal=()=>{};
 f.page.renderRoster(s,[{slot_id:CID,person_id:SOURCE,person_name:'Server Tuesday original',availability_state:'working'}]);
 const buttons=[...f.page.els.roster_list.innerHTML.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]);
 assert.equal(buttons.length,2);assert.ok(!buttons[0].includes('disabled'),'Server-current week must not depend on client clock');
 f.page.openTurnoverDialog({target:{closest:()=>({dataset:{turnoverSlot:CID,turnoverMode:'departed'}})}});
 assert.equal(f.page.state.turnoverSelection.date,'2026-10-06');assert.equal(f.page.state.turnoverSelection.personId,SOURCE);
 assert.equal(f.page.els.turnover_current.textContent,'Server Tuesday original');assert.equal(f.page.els.turnover_effective_date.value,'2026-10-06');
 assert.equal(f.calls.length,0);assert.equal(f.map.size,0);
});
test('SERVER_DATE_TURNOVER_NEW: missing invalid or out-of-week server day never falls back to local or selected day',async()=>{
 for(const date of [undefined,null,'','2026-02-30','2026-10-06 ','2026-10-04','2026-10-12']){
  const f=serverDayTurnoverFixture(),originalSelection=f.page.state.turnoverSelection;f.s.current_service_date=date;
  f.page.renderRoster(f.s,[{slot_id:CID,person_id:SOURCE,person_name:'Retained person'}]);
  const buttons=[...f.page.els.roster_list.innerHTML.matchAll(/<button\b[^>]*>/g)].map(m=>m[0]);
  assert.ok(buttons.every(button=>button.includes('disabled')));
  assert.throws(()=>f.open(),/current operational week/);assert.equal(f.page.state.turnoverSelection,originalSelection);
  assert.equal(f.calls.length,0);assert.equal(f.map.size,0);assert.equal(f.nonces(),0);assert.equal(f.localReads(),0);
 }
});
test('SERVER_DATE_TURNOVER_NEW: original server day person revision publication and dialog stay bound before submit',async()=>{
 for(const change of ['day','missing-day','invalid-day','person','revision','publication','week','effective-day','mode']){
  const f=serverDayTurnoverFixture();f.open();const original=f.page.state.turnoverSelection;
  assert.ok(Object.isFrozen(original));assert.equal(original.personId,SOURCE);assert.equal(original.date,'2026-10-06');
  if(change==='day')f.s.current_service_date='2026-10-07';if(change==='missing-day')delete f.s.current_service_date;
  if(change==='invalid-day')f.s.current_service_date='2026-02-30';if(change==='person')f.s.roster[0].week_staffing[1].person_id=MID;
  if(change==='revision')f.s.authority_revision++;if(change==='publication')f.s.current_publication={publication_id:SOURCE};
  if(change==='week')f.s.week_start='2026-10-06';if(change==='effective-day')f.page.els.turnover_effective_date.value='2026-10-05';
  if(change==='mode')f.page.els.turnover_mode.value='replace';
  await assert.rejects(f.submit(),/staffing record changed/);
  assert.equal(f.page.state.turnoverSelection,original);assert.equal(f.calls.length,0);assert.equal(f.map.size,0);assert.equal(f.nonces(),0);assert.equal(f.localReads(),0);
 }
});
test('SERVER_DATE_TURNOVER_NEW: date withdrawal while queued or closing dialog refuses without dispatch',async()=>{
 const queued=serverDayTurnoverFixture();queued.open();let release;
 queued.context.waitBeforeTurnover=new Promise(resolve=>release=resolve);
 vm.runInContext('busy=async(work)=>{await waitBeforeTurnover;return work();};',queued.context);
 const pending=queued.submit();queued.s.current_service_date='2026-10-07';release();
 await assert.rejects(pending,/staffing record changed/);assert.equal(queued.calls.length,0);assert.equal(queued.map.size,0);
 const closing=serverDayTurnoverFixture();closing.open();const original=closing.page.state.turnoverSelection;
 closing.page.els.turnover_dialog.close=()=>{closing.s.current_service_date='2026-10-07';};
 await assert.rejects(closing.submit(),/staffing record changed/);
 assert.equal(closing.page.state.turnoverSelection,original);assert.equal(closing.calls.length,0);assert.equal(closing.map.size,0);
});
test('SERVER_DATE_TURNOVER_NEW: actual authorization unchanged and unknown awaited original is retained without resubmit',async()=>{
 // Existing auth/action/transport DATA fixture only, NOT a real manager or
 // endpoint policy/HTTP/SQL/performed-work claim. No authorized() override.
 for(const mode of ['departed','replace']){
  const f=serverDayTurnoverFixture(),route=mode==='replace'?'/static-weekly/employees/replacements':'/static-weekly/employees/departed';
  assert.equal(A.authorized(f.auth,route,{}),true,'Existing synthetic owner contract, not new admission');
  f.open(mode);f.page.els.replacement_name.value='Original replacement review';
  f.setMode('offline');let release;f.setPending(new Promise(resolve=>release=resolve));
  const pending=f.submit();const saved=f.page.state.actions.pending(),encoded=saved.encoded;
  assert.equal(f.calls.length,1);assert.equal(saved.state,'PENDING');assert.equal(saved.path,route);
  assert.equal(f.page.els.service_date.value,'2026-10-06');assert.equal(f.page.state.turnoverSelection,null);
  const sent=JSON.parse(encoded);assert.equal(sent.slot_id,CID);assert.equal(sent.expected_revision,42);assert.equal(sent.week_start,'2026-10-05');
  assert.equal(Object.hasOwn(sent,'service_date'),false);assert.equal(Object.hasOwn(sent,'effective_start'),false);
  if(mode==='replace')assert.equal(sent.new_employee_name,'Original replacement review');
  f.s.current_service_date='2026-10-07';release();await assert.rejects(pending,/network unavailable/);
  assert.equal(f.page.state.actions.pending().encoded,encoded);assert.equal(f.page.state.actions.pending().state,'PENDING');
  assert.throws(()=>f.open(mode),/Resolve the saved scheduler request/);await assert.rejects(f.submit(),/Resolve the saved scheduler request/);
  assert.equal(f.calls.length,1);assert.equal(f.nonces(),1);assert.equal(f.localReads(),0);
 }
 const denied=serverDayTurnoverFixture();denied.patch({read_only:true});
 for(const route of ['/static-weekly/employees/departed','/static-weekly/employees/replacements'])assert.equal(A.authorized(denied.auth,route,{}),false);
 assert.throws(()=>denied.open(),/not available|not authorized/);assert.equal(denied.calls.length,0);assert.equal(denied.map.size,0);
});
test('ROSTER_LITERAL_DEVICE_NEW: actual roster renderer escapes original labels without changing controls',()=>{
 // Existing VM/DOM recording only: innerHTML is recorded, not browser-parsed.
 // No HTTP/SQL, live manager, event execution or genuine browser/XSS proof.
 const f=pageFixture(),row={slot_id:CID,slot_label:'Position',person_id:MID,person_name:'Worker & <Name>',
  staffing_identity_valid:true,availability_state:'working',device_ids:['KIOSK08','legacy desk phone',
   'legacy & <label> "desk" \'alpha\'','<span data-device="inert" onpointerover="INERT_MARKER">phone</span>'],
  week_staffing:[{service_date:'2026-10-05',person_id:MID,person_name:'Worker & <Name>',availability_state:'working'}]};
 const s={week_start:'2026-10-05',week_end:'2026-10-11',current_service_date:'2026-10-05',projection_status:'current',
  current_publication:{publication_id:SOURCE},availability:[],roster:[row]};
 const before=JSON.stringify(s);
 const render=(view=s,rows=[row])=>{f.page.renderRoster(view,rows);return f.page.els.roster_list.innerHTML;};
 const html=render();
 assert.ok(html.includes('<small>KIOSK08, legacy desk phone, legacy &amp; &lt;label&gt; &quot;desk&quot; &#39;alpha&#39;, &lt;span data-device=&quot;inert&quot; onpointerover=&quot;INERT_MARKER&quot;&gt;phone&lt;/span&gt;</small>'),html);
 assert.ok(!html.includes('<label>')&&!html.includes('<span data-device="inert"'));
 assert.ok(html.includes('<strong>Worker &amp; &lt;Name&gt;</strong>'));
 assert.equal(JSON.stringify(s),before,'Rendering must not normalize/delete original identifiers or row data');
 const buttons=value=>[...value.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]);
 let controls=buttons(html);assert.equal(controls.length,2);
 assert.ok(controls.every(button=>!button.includes('hidden')&&!button.includes('disabled')));
 assert.ok(controls[0].includes('data-turnover-mode="departed"')&&controls[1].includes('data-turnover-mode="vacate"'));
 for(const device_ids of [undefined,[],['']]){
  const normal={...row,device_ids};assert.ok(render(s,[normal]).includes('<small>No phone</small>'));
 }
 for(const device_ids of [['KIOSK08'],['legacy desk phone','phone-2019']]){
  assert.ok(render(s,[{...row,device_ids}]).includes('<small>'+device_ids.join(', ')+'</small>'));
 }
 const absent=render(s,[{...row,availability_state:'departed_named_absent'}]);
 assert.ok(absent.includes('<small>Absent until replacement</small>'));assert.ok(!absent.includes('INERT_MARKER'));
 assert.ok(buttons(absent)[0].includes('data-turnover-mode="replace"'));
 f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false}});
 controls=buttons(render());assert.ok(controls.every(button=>button.includes('hidden')&&button.includes('disabled')));
 f.patch({read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}});
 controls=buttons(render({...s,current_publication:null}));
 assert.ok(controls.every(button=>button.includes('disabled')));assert.ok(controls[0].includes('Publish the weekly baseline first'));
 controls=buttons(render({...s,week_start:'2026-10-12',week_end:'2026-10-18'}));
 assert.ok(controls.every(button=>button.includes('disabled')));assert.ok(controls[0].includes('Open the current week to change employees'));
 f.page.state.pending={state:'PENDING'};controls=buttons(render());
 assert.ok(!controls[0].includes('disabled')&&controls[1].includes('disabled'));f.page.state.pending=null;
 assert.equal(render(s,[{...row,contractor_capacity:true}]),'<div class="empty">No employee slots.</div>');
 assert.equal(render(s,[]),'<div class="empty">No employee slots.</div>');
 assert.equal(f.calls.length,0);assert.equal(f.map.size,0);assert.equal(JSON.stringify(s),before);
});
test('scheduler integration: weekly preview labels the dated employee, never the selected-day incumbent',()=>{
 const f=pageFixture();f.page.els.service_date.value='2026-10-05';f.page.state.snapshot={roster:[{slot_id:CID,week_staffing:[{service_date:'2026-10-05',person_id:MID,person_name:'Monday worker'},{service_date:'2026-10-06',person_id:SOURCE,person_name:'Tuesday worker'}]}]};
 f.page.state.preview={preview:{templateId:'approved-six',authorityRevision:42,assignments:[{serviceDate:'2026-10-06',personId:SOURCE,slotId:CID,status:'ASSIGNED',window:{start:'07:00',end:'09:45'}}]}};
 f.page.renderApprovedPreview();assert.equal(f.nodes.get('approved-preview-rows').children[0].children[1].textContent,'Tuesday worker');
});
test('scheduler integration: preview does not relabel a historical person or an OPEN duty with current occupant',()=>{
 const f=pageFixture();f.page.els.service_date.value='2026-10-05';f.page.state.snapshot={roster:[{slot_id:CID,slot_label:'Slot',week_staffing:[{service_date:'2026-10-05',person_id:MID,person_name:'Current worker'}]}]};
 const base={serviceDate:'2026-10-05',slotId:CID,window:{start:'07:00',end:'09:45'}};
 f.page.state.preview={preview:{templateId:'approved-six',authorityRevision:42,assignments:[{...base,personId:SOURCE,status:'ASSIGNED',displayName:'Bound historical worker'},{...base,personId:null,status:'OPEN'}]}};
 f.page.renderApprovedPreview();const rows=f.nodes.get('approved-preview-rows').children;assert.equal(rows[0].children[1].textContent,'Bound historical worker');assert.equal(rows[1].children[1].textContent,'Open');
});
for(const change of ['preview','revision','week','capability'])test(`scheduler integration: publication rechecks ${change} after review dialog`,async()=>{
 const f=pageFixture();let sent=0;f.page.state.snapshot={week_start:'2026-10-05',authority_revision:42};
 f.page.state.preview={kind:'recurring',input:{effective_start:'2026-10-05',expected_revision:42},preview:{previewDigest:'a'.repeat(64)}};
 f.page.state.approved={confirm:async()=>{sent++;}};
 vm.runInContext('busy=async(work)=>work();refreshSnapshot=async()=>{};',f.context);
 f.context.confirmAction=async()=>{if(change==='preview')f.page.state.preview=null;if(change==='revision')f.page.state.snapshot.authority_revision=43;if(change==='week')f.page.els.week_start.value='2026-10-12';if(change==='capability')f.patch({permissions:{schema:'custodial.manager-permissions.v1',read:true}});return true;};
 f.page.els.week_start.value='2026-10-05';await assert.rejects(f.page.publishDraft());assert.equal(sent,0);
});
test('scheduler integration: unchanged reviewed pattern still confirms its exact original selection',async()=>{
 const f=pageFixture(),calls=[];f.page.state.snapshot={week_start:'2026-10-05',authority_revision:42};f.page.els.week_start.value='2026-10-05';
 const choice={kind:'recurring',input:{effective_start:'2026-10-05',expected_revision:42},preview:{previewDigest:'a'.repeat(64)}};f.page.state.preview=choice;
 f.page.state.approved={confirm:async(...args)=>calls.push(args)};vm.runInContext('busy=async(work)=>work();refreshSnapshot=async()=>{};',f.context);f.context.confirmAction=async()=>true;
 await f.page.publishDraft();assert.equal(calls.length,1);assert.deepEqual(calls[0],[choice.kind,choice.preview,choice.input]);
});
test('scheduler integration: a permitted manual CoverAll batch keeps the exact manager-entered operation',async()=>{
 const f=fixture(),input={...body,operations:[{operation:'cover_all',slotId:CID,shift:{start:'08:00',end:'13:00'},breakChoice:'no_lunch',reason:'Manual'}]};
 await f.create().run(path,input);assert.deepEqual(JSON.parse(f.calls[0].options.body),input);
});
test('scheduler preview: source-timed capacity and own lunch never turn workload points into remaining minutes',()=>{
 const f=pageFixture();
 const p1='15000000-0000-4000-8000-000000000001',p2='15000000-0000-4000-8000-000000000002';
 const view={projectionAvailability:[
  {serviceDate:'2026-10-05',slotId:CID,incumbentPersonId:p1,incumbentName:'Monday worker',status:'working',shift:{start:'07:00',end:'16:00'},lunch:{start:'11:00',end:'11:30'},blockedWindows:[{start:'11:15',end:'12:00'}],productiveCapacityProvenance:'Accepted dated shift/lunch'},
  {serviceDate:'2026-10-06',slotId:CID,incumbentPersonId:p2,incumbentName:'Tuesday worker',status:'working',shift:{start:'08:00',end:'13:00'},lunch:{start:'12:00',end:'12:30'},blockedWindows:[],productiveCapacityProvenance:'Accepted dated shift/lunch'},
  {serviceDate:'2026-10-07',slotId:SOURCE,incumbentPersonId:p2,incumbentName:'Wednesday worker',status:'working'}
 ]};
 const assignments=[
  {planWorkId:'mon-duty',serviceDate:'2026-10-05',personId:p1,slotId:CID,status:'ASSIGNED',serviceEffortMinutes:30,locationNameSnapshot:'Monday duty',window:{start:'07:00',end:'08:00'}},
  {planWorkId:'tue-duty',serviceDate:'2026-10-06',personId:p2,slotId:CID,status:'ASSIGNED',serviceEffortMinutes:20,locationNameSnapshot:'Tuesday duty',window:{start:'08:00',end:'09:45'}},
  {planWorkId:'wrong-person',serviceDate:'2026-10-05',personId:p2,slotId:CID,status:'ASSIGNED',serviceEffortMinutes:99,locationNameSnapshot:'Must not borrow another incumbent'},
  {planWorkId:'wed-duty',serviceDate:'2026-10-07',personId:p2,slotId:SOURCE,status:'ASSIGNED',locationNameSnapshot:'Wednesday duty'}
 ];
 f.page.state.preview={preview:{templateId:'approved-six',authorityRevision:42,assignments,lunch:{responsibilities:[{service_date:'2026-10-05',normal_owner_person_id:p2,coverer_person_id:p1,coverer_slot_id:CID,coverage_purpose:'lunch_coverage',coverage_start:'12:30',coverage_end:'13:00'},{service_date:'2026-10-06',coverer_person_id:p2,coverer_slot_id:CID,coverage_purpose:'lunch_coverage'}]},constraintView:view}};
 f.page.renderApprovedPreview();const rows=f.nodes.get('approved-preview-capacity-rows').children;
 assert.equal(rows.length,3);assert.match(rows[0].children[0].textContent,/2026-10-05/);assert.match(rows[0].children[1].textContent,/Monday worker/);assert.match(rows[0].children[2].textContent,/07:00–16:00/);
 assert.match(rows[0].children[2].textContent,/480 min available before assigned work/);assert.match(rows[0].children[3].textContent,/Monday duty 07:00–08:00 · 30 workload points/);assert.doesNotMatch(rows[0].children[3].textContent,/Must not borrow/);
 assert.match(rows[0].children[4].textContent,/Own lunch 11:00–11:30/);assert.match(rows[0].children[4].textContent,/Covering lunch 12:30–13:00/);assert.match(rows[0].children[5].textContent,/Unknown.*work.*travel/);assert.doesNotMatch(rows[0].children[5].textContent,/450|30 min/);
 assert.match(rows[1].children[1].textContent,/Tuesday worker/);assert.match(rows[1].children[2].textContent,/08:00–13:00.*270 min available/);assert.match(rows[1].children[3].textContent,/Tuesday duty 08:00–09:45/);assert.doesNotMatch(rows[1].children[3].textContent,/Monday duty/);assert.match(rows[1].children[4].textContent,/Own lunch 12:00–12:30.*Covering lunch Time unavailable/);
 assert.match(rows[2].children[2].textContent,/Time unavailable.*Available time unknown/);assert.match(rows[2].children[3].textContent,/Wednesday duty Time unavailable/);assert.match(rows[2].children[4].textContent,/Own lunch Time unavailable/);assert.match(rows[2].children[5].textContent,/Unknown/);
 assert.match(f.nodes.get('approved-preview-summary').textContent,/optimized balance and opening readiness are not established/);
});
test('scheduler resume UI: absence-only pending work has an operational Resume button',()=>{
 const f=pageFixture();f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,manage_absences:true}});
 f.page.state.pending={state:'PENDING',path,body};f.page.setControls();assert.equal(f.nodes.get('scheduler-retry').disabled,false);
});
test('scheduler resume UI: revoked absence capability cannot resume just because routes remain enabled',()=>{
 const f=pageFixture();f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,regenerate_routes:true}});
 f.page.state.pending={state:'PENDING',path,body};f.page.setControls();assert.equal(f.nodes.get('scheduler-retry').disabled,true);
});
test('scheduler resume UI: accepted readback is allowed without a new mutation capability',()=>{
 const f=pageFixture();f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true}});
 f.page.state.pending={state:'ACCEPTED',path,body};f.page.setControls();assert.equal(f.nodes.get('scheduler-retry').disabled,false);
});

function datedPreviewFixture(){
 const f=pageFixture();f.page.els.week_start.value='2026-10-05';f.page.els.service_date.value='2026-10-05';
 f.page.state.snapshot={week_start:'2026-10-05',week_end:'2026-10-11',authority_revision:42,current_publication:{publication_id:SOURCE},roster:[{slot_id:CID,incumbencies:[{effective_start:'2026-10-05',person_id:MID,person_name:'Current worker'}]}],availability:[{slot_id:CID,day_of_week:1,availability_state:'working',shift_start:'07:00',shift_end:'16:00'}],exceptions:[]};
 f.page.state.approvedChoices={initial:[{source_id:SOURCE,template_id:'approved-six',effective_start:'2026-10-05',staffing_count:6}]};
 const value={...preview,schema:'custodial.approved-static-preview.v1',sourcePublicationId:SOURCE,constraintView:{schema:'custodial.approved-static-constraint-view.v1',contract:'FIXED_APPROVED_PATTERN_COMPLETE_HARD_CONSTRAINTS_NOT_OPTIMALITY',hardConstraintDigest:'d'.repeat(64),physicalCoverageDigest:'e'.repeat(64),mappingDigest:'f'.repeat(64),hardConstraintCount:1,slotAvailability:[{slot_id:CID,day_of_week:1}],projectionAvailability:[{serviceDate:'2026-10-05',slotId:CID,incumbentPersonId:MID,incumbentName:'Current worker',status:'working'}],balance:{optimized:false},opening:{proven:false}}};
 f.context.reply=value;return{...f,value};
}
for(const date of ['2026-02-30','2026-13-01','not-a-date',''])test(`scheduler current-date: reject civil date ${JSON.stringify(date)} without substitution`,()=>{
 const f=pageFixture();assert.throws(()=>f.page.mondayOf(date),/valid.*date/i);
 assert.equal(f.page.mondayOf('2024-02-29'),'2024-02-26');
});
for(const search of ['?date=2026-02-30','?date=bad','?date=','?week_start=2026-02-30','?week_start=2026-10-05&date=2026-10-13'])test(`scheduler current-date: visibly refuse initial query ${search}`,async()=>{
 const f=pageFixture();f.context.location.search=search;let bootstrap=0;f.context.loadControlPlaneUrl=async()=>{bootstrap++;throw Error('bootstrap should not be reached');};
 await vm.runInContext("init().catch(error=>setStatus('Scheduler unavailable: '+safe(error),'error'))",f.context);
 assert.match(f.page.els.status.textContent,/valid.*date|selected week/i);assert.match(f.page.els.status.className,/error/);assert.equal(bootstrap,0);assert.equal(f.map.size,0);
});
for(const change of ['date','week','revision','source','template','availability','staffing','publication'])test(`scheduler current-date: refuse awaited preview after ${change} changes`,async()=>{
 const f=datedPreviewFixture();let release;const deferred=new Promise(r=>release=r);let requests=0;
 f.context.api=async()=>{requests++;await deferred;return f.value;};const pending=f.page.generateDraft();
 if(change==='date')f.page.els.service_date.value='2026-10-06';if(change==='week')f.page.els.week_start.value='2026-10-12';
 if(change==='revision')f.page.state.snapshot.authority_revision=43;if(change==='source')f.nodes.get('approved-source').value=SOURCE;
 if(change==='template')f.page.state.approvedChoices.initial[0].template_id='another-pattern';
 if(change==='availability')f.page.state.snapshot.availability[0].shift_end='13:00';
 if(change==='staffing')f.page.state.snapshot.roster[0].incumbencies[0].person_id=SOURCE;
 if(change==='publication')f.page.state.snapshot.current_publication.publication_id=PID;
 release();await pending;assert.equal(requests,1);assert.equal(f.page.state.preview,null);assert.match(f.page.els.status.textContent,/changed|current.*preview/i);assert.equal(f.map.size,0);
});
test('scheduler current-date: staffing pattern link opens ordinary current-date review and one exact confirmation',async()=>{
 const f=datedPreviewFixture(),html=fs.readFileSync(new URL('../staffing-management.html',import.meta.url),'utf8');
 const href=html.match(/id="staffing-pattern-link" href="([^"]+)"/)[1];const url=new URL(href,'https://fixture.invalid/staffing-management.html');
 assert.equal(url.pathname,'/schedule-weekly.html');f.context.location.search=url.search;
 f.auth.getCSTDateString=()=> '2026-10-07';f.context.loadControlPlaneUrl=async()=> 'https://scheduler.onrender.com';let confirms=0,previews=0;
 f.context.api=async(path,options)=>{
  if(path.startsWith('/static-weekly/manager-snapshot?'))return{...f.page.state.snapshot,authority_revision:confirms?43:42,projection_status:'current',latest_projection:{projection_id:PID,lunch_document_identity:'b'.repeat(64)}};
  if(path==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[]};
  if(path===P.paths.recurring+'/preview'){previews++;assert.deepEqual(JSON.parse(options.body),{effective_start:'2026-10-05',expected_revision:42});return f.value;}
  if(path===P.paths.recurring+'/confirm'){confirms++;const body=JSON.parse(options.body);assert.equal(body.preview_digest,f.value.previewDigest);assert.equal(body.expected_revision,42);return approvedReceipt('recurring');}
  throw Error('Unexpected route '+path);
 };
 await f.page.init();assert.equal(f.page.els.week_start.value,'2026-10-05');assert.equal(f.page.els.service_date.value,'2026-10-07');
 await f.page.generateDraft();assert.equal(previews,1);assert.equal(f.page.state.preview.preview.templateId,'approved-six');
 f.context.confirmAction=async()=>true;await f.page.publishDraft();assert.equal(confirms,1);assert.equal(f.page.state.approvedPending,null);assert.equal(f.map.size,0);assert.equal(f.page.els.service_date.value,'2026-10-07');
});
test('scheduler current-date: change during confirmation refuses generated preview without saving or posting',async()=>{
 const f=datedPreviewFixture();f.context.api=async()=>f.value;await f.page.generateDraft();let sent=0;
 f.page.state.approved={confirm:async()=>{sent++;}};f.context.confirmAction=async()=>{f.page.state.snapshot.availability[0].shift_end='13:00';return true;};
 await f.page.publishDraft();assert.equal(sent,0);assert.equal(f.map.size,0);assert.match(f.page.els.status.textContent,/changed/);
});
test('scheduler date-controls: explicit week and valid dated query keep the requested day; invalid controls stay visibly unsubmitted',async()=>{
 const f=datedPreviewFixture();f.context.location.search='?week_start=2026-10-05&date=2026-10-07';let reads=0;
 f.context.loadControlPlaneUrl=async()=> 'https://scheduler.onrender.com';
 f.context.api=async(path)=>{reads++;if(path.startsWith('/static-weekly/manager-snapshot?'))return{...f.page.state.snapshot,projection_status:'current'};if(path==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[]};throw Error('Unexpected request');};
 await f.page.init();assert.equal(f.page.els.service_date.value,'2026-10-07');const readCount=reads;
 f.page.els.week_start.value='2026-02-30';f.page.els.week_start.listeners.get('change')();
 assert.equal(f.page.els.week_start.value,'2026-02-30');assert.match(f.page.els.status.textContent,/valid calendar date/);assert.equal(reads,readCount);
 f.page.els.week_start.value='2026-10-05';f.page.els.service_date.value='';f.page.els.service_date.listeners.get('change')();
 assert.equal(f.page.els.service_date.value,'');assert.match(f.page.els.status.textContent,/valid calendar date/);assert.equal(reads,readCount);assert.equal(f.page.state.preview,null);
});
test('scheduler date-controls: a date selection away and back cannot accept its already pending preview',async()=>{
 const f=datedPreviewFixture();f.context.loadControlPlaneUrl=async()=> 'https://scheduler.onrender.com';
 f.context.api=async(path)=>path.startsWith('/static-weekly/manager-snapshot?')?{...f.page.state.snapshot,projection_status:'current'}:{schema:'custodial.approved-schedule-choices.v1',initial:[]};await f.page.init();
 let release;const deferred=new Promise(r=>release=r);f.context.api=async()=>{await deferred;return f.value;};const pending=f.page.generateDraft();
 for(const date of ['2026-10-06','2026-10-05']){f.page.els.service_date.value=date;f.page.els.service_date.listeners.get('change')();}
 release();await pending;assert.equal(f.page.state.preview,null);assert.match(f.page.els.status.textContent,/changed/);assert.equal(f.map.size,0);
});
function datedDialogFixture(){
 const f=datedPreviewFixture(),callout={dataset:{calloutSlot:CID}},clock={value:'08:00'},end={value:'13:00'},breakChoice={value:'NONE'};
 const row={querySelector:selector=>({'[data-shift-start]':clock,'[data-shift-end]':end,'[data-break-choice]':breakChoice})[selector]};
 const contractor={dataset:{contractorSlot:SOURCE},closest:()=>row};let selected=[callout],contractors=[];
 f.context.document.querySelectorAll=selector=>selector==='[data-callout-slot]:checked:not(:disabled)'?selected:selector==='[data-contractor-slot]:checked:not(:disabled)'?contractors:[];
 f.page.els.absence_type.value='daily_absence';f.page.state.snapshot.current_publication.version_id=PID;
 f.page.state.actions=A.create({auth:f.auth,storage:f.storage,api:f.api,baseUrl:'https://scheduler.onrender.com',onState:r=>{f.page.state.pending=r;}});
 vm.runInContext('refreshSnapshot=async()=>{};',f.context);
 return{...f,clock,selectCallouts:x=>selected=x,selectContractors:()=>{selected=[];contractors=[contractor];}};
}
for(const action of ['applyDayChanges','rebuildCurrentProjection'])for(const change of ['date','week','revision','publication','availability','staffing','pending','credential'])test(`scheduler dated-review: ${action} refuses ${change} changed during dialog`,async()=>{
 const f=datedDialogFixture();if(action==='applyDayChanges')f.selectContractors();f.context.confirmAction=async()=>{
  if(change==='date')f.page.els.service_date.value='2026-10-06';if(change==='week')f.page.els.week_start.value='2026-10-12';
  if(change==='revision')f.page.state.snapshot.authority_revision=43;if(change==='publication')f.page.state.snapshot.current_publication.version_id=SOURCE;
  if(change==='availability')f.page.state.snapshot.availability[0].shift_end='13:00';if(change==='staffing')f.page.state.snapshot.roster[0].incumbencies[0].person_id=SOURCE;
  if(change==='pending')f.page.state.approvedPending={state:'PENDING'};if(change==='credential')f.patch({credential_id:SOURCE});return true;};
 await f.page[action]();assert.equal(f.calls.length,0);assert.equal(f.map.size,0);assert.match(f.page.els.status.textContent,/changed|saved|access|selected week/i);
});
for(const change of ['slots','absence-type','coverall-shift'])test(`scheduler dated-review: batch refuses changed ${change} without a saved command`,async()=>{
 const f=datedDialogFixture();f.selectContractors();if(change!=='coverall-shift')f.selectCallouts([{dataset:{calloutSlot:CID}}]);f.context.confirmAction=async()=>{if(change==='slots')f.selectCallouts([{dataset:{calloutSlot:SOURCE}}]);if(change==='absence-type')f.page.els.absence_type.value='pto';if(change==='coverall-shift')f.clock.value='09:00';return true;};
 await f.page.applyDayChanges();assert.equal(f.calls.length,0);assert.equal(f.map.size,0);assert.match(f.page.els.status.textContent,/changed/);
});
test('scheduler dated-review: unchanged manual dated batch sends once and retains exact accepted receipt',async()=>{
 const f=datedDialogFixture();f.selectContractors();let dialogs=0;f.context.confirmAction=async()=>{dialogs++;return true;};
 await f.page.applyDayChanges();assert.equal(dialogs,1);assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/static-weekly/day-changes/batch');
 const input=JSON.parse(f.calls[0].options.body);assert.equal(input.service_date,'2026-10-05');assert.equal(input.expected_revision,42);assert.equal(input.publication_id,SOURCE);assert.equal(input.base_version_id,PID);assert.equal(input.week_start,'2026-10-05');
 assert.deepEqual(input.operations,[{operation:'cover_all',slot_id:SOURCE,shift:{start:'08:00',end:'13:00'},reason:'Manager added manual CoverAll coverage',breakChoice:'NONE'}]);
 assert.equal(f.page.state.pending.state,'ACCEPTED');assert.equal(f.page.state.pending.encoded,f.calls[0].options.body);assert.equal(f.map.size,1);
});
test('scheduler dated-review: unchanged current projection rebuild sends once with reviewed week and revision',async()=>{
 const f=datedDialogFixture();f.context.confirmAction=async()=>true;await f.page.rebuildCurrentProjection();assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].path,'/static-weekly/rebuild-current-projection');const input=JSON.parse(f.calls[0].options.body);assert.equal(input.week_start,'2026-10-05');assert.equal(input.expected_revision,42);assert.equal(f.page.state.pending.state,'ACCEPTED');assert.equal(f.page.state.pending.encoded,f.calls[0].options.body);
});
test('scheduler dated-loss: unknown batch outcome preserves the original reviewed date and bytes; changed selection cannot create a new command',async()=>{
 const f=datedDialogFixture();f.selectContractors();f.context.confirmAction=async()=>true;f.setMode('offline');await f.page.applyDayChanges();
 assert.equal(f.calls.length,1);assert.equal(f.page.state.pending.state,'PENDING');const original=f.page.state.pending.encoded;
 assert.equal(original,f.calls[0].options.body);assert.equal(JSON.parse(original).service_date,'2026-10-05');
 f.page.els.service_date.value='2026-10-06';await assert.rejects(f.page.applyDayChanges(),/saved schedule request/);
 assert.equal(f.calls.length,1);assert.equal(f.page.state.pending.encoded,original);assert.equal(f.map.size,1);
});
function reversalFixture(){
 const f=datedDialogFixture(),coverall={id:'16000000-0000-4000-8000-000000000001',serviceDate:'2026-10-06',type:'cover_all',payload:{availability:{slotId:SOURCE}}};
 const lunch={id:'16000000-0000-4000-8000-000000000002',serviceDate:coverall.serviceDate,type:'lunch',payload:{slotId:SOURCE},startsAt:'12:00',endsAt:'13:00'};
 f.page.state.snapshot.exceptions=[coverall,lunch];const event={target:{closest:()=>({dataset:{reverseException:coverall.id}})}};
 return{...f,coverall,lunch,event};
}
for(const change of ['selected-date','revision','publication','removed-exception','reversed-exception','linked-lunch','credential','pending'])test(`scheduler reverse-review: refuse ${change} changed after remove confirmation`,async()=>{
 const f=reversalFixture();f.context.confirmAction=async()=>{
  if(change==='selected-date')f.page.els.service_date.value='2026-10-07';if(change==='revision')f.page.state.snapshot.authority_revision=43;
  if(change==='publication')f.page.state.snapshot.current_publication.version_id=SOURCE;
  if(change==='removed-exception')f.page.state.snapshot.exceptions=f.page.state.snapshot.exceptions.filter(r=>r.id!==f.coverall.id);
  if(change==='reversed-exception')f.page.state.snapshot.exceptions.push({id:PID,type:'reverse',serviceDate:f.coverall.serviceDate,payload:{reversesExceptionId:f.coverall.id}});
  if(change==='linked-lunch')f.lunch.endsAt='12:30';if(change==='credential')f.patch({credential_id:SOURCE});if(change==='pending')f.page.state.approvedPending={state:'PENDING'};return true;};
 await f.page.reverseChange(f.event);assert.equal(f.calls.length,0);assert.equal(f.map.size,0);assert.match(f.page.els.status.textContent,/changed|saved|access/);
});
test('scheduler reverse-review: stale remove button cannot reverse an already withdrawn exception',async()=>{
 const f=reversalFixture();f.page.state.snapshot.exceptions.push({id:PID,type:'reverse',serviceDate:f.coverall.serviceDate,payload:{reversesExceptionId:f.coverall.id}});let dialogs=0;
 f.context.confirmAction=async()=>{dialogs++;return true;};await assert.rejects(f.page.reverseChange(f.event),/current|changed|active|withdrawn/);
 assert.equal(dialogs,0);assert.equal(f.calls.length,0);assert.equal(f.map.size,0);
});
test('scheduler reverse-review: exact active linked lunch is reversed atomically, never withdrawn or other-date/slot lunch',async()=>{
 const f=reversalFixture(),withdrawn={...f.lunch,id:'16000000-0000-4000-8000-000000000003',reversed_at:'2026-10-05T12:00:00Z'},otherDate={...f.lunch,id:'16000000-0000-4000-8000-000000000004',serviceDate:'2026-10-07'},otherSlot={...f.lunch,id:'16000000-0000-4000-8000-000000000005',payload:{slotId:CID}};
 f.page.state.snapshot.exceptions.push(withdrawn,otherDate,otherSlot);let dialogs=0;f.context.confirmAction=async()=>{dialogs++;return true;};
 await f.page.reverseChange(f.event);assert.equal(dialogs,1);assert.equal(f.calls.length,1);const input=JSON.parse(f.calls[0].options.body);
 assert.equal(input.service_date,'2026-10-06');assert.equal(input.expected_revision,42);assert.equal(input.base_version_id,PID);assert.equal(input.publication_id,SOURCE);
 assert.deepEqual(input.operations.map(r=>r.reverses_exception_id),[f.coverall.id,f.lunch.id]);assert.ok(input.operations.every(r=>r.payload.reversesExceptionId===r.reverses_exception_id));
 assert.equal(f.page.state.pending.state,'ACCEPTED');assert.equal(f.page.state.pending.encoded,f.calls[0].options.body);
});
test('scheduler reverse-review: ordinary absence delegate cannot remove owner-only employee lunch',async()=>{
 const f=reversalFixture();f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,manage_absences:true}});f.event.target.closest=()=>({dataset:{reverseException:f.lunch.id}});f.lunch.payload.slotId=CID;
 let dialogs=0;f.context.confirmAction=async()=>{dialogs++;return true;};await assert.rejects(f.page.reverseChange(f.event),/owner-only/);assert.equal(dialogs,0);assert.equal(f.calls.length,0);assert.equal(f.map.size,0);
});
test('scheduler reverse-owner-change: owner-only lunch cannot be removed after owner authority is revoked during confirmation',async()=>{
 const f=reversalFixture();f.event.target.closest=()=>({dataset:{reverseException:f.lunch.id}});f.lunch.payload.slotId=CID;
 f.context.confirmAction=async()=>{f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,manage_absences:true}});return true;};
 await f.page.reverseChange(f.event);assert.equal(f.calls.length,0);assert.equal(f.map.size,0);assert.match(f.page.els.status.textContent,/owner-only|access|changed/);
});
test('scheduler reverse-workflow: cancelled review preserves the active exception and linked lunch without a command',async()=>{
 const f=reversalFixture();f.context.confirmAction=async()=>false;const original=JSON.stringify(f.page.state.snapshot.exceptions);
 await f.page.reverseChange(f.event);assert.equal(f.calls.length,0);assert.equal(f.map.size,0);assert.equal(JSON.stringify(f.page.state.snapshot.exceptions),original);
});
test('scheduler reverse-workflow: absence delegate removes exact CoverAll/lunch together and actual page readback clears the accepted original',async()=>{
 const f=reversalFixture(),before=structuredClone(f.page.state.snapshot),writes=[];let accepted=false,reads=0;
 f.context.refreshSnapshot=f.page.refreshSnapshot;
 f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,manage_absences:true}});
 f.context.loadControlPlaneUrl=async()=> 'https://scheduler.onrender.com';f.context.api=async(path,options)=>{
  if(path.startsWith('/static-weekly/manager-snapshot?')){reads++;return{...structuredClone(before),authority_revision:accepted?43:42,projection_status:'current',latest_projection:{projection_id:PID},exceptions:accepted?[...before.exceptions,...[f.coverall,f.lunch].map((row,index)=>({id:index?CID:PID,type:'reverse',serviceDate:row.serviceDate,payload:{reversesExceptionId:row.id}}))]:before.exceptions};}
  if(path==='/static-weekly/day-changes/batch'){writes.push(options.body);accepted=true;return f.reply;}throw Error('Unexpected route '+path);
 };
 await f.page.init();f.context.confirmAction=async()=>true;await f.page.reverseChange(f.event);
 assert.equal(writes.length,1);assert.equal(reads,2);const body=JSON.parse(writes[0]);assert.equal(body.service_date,'2026-10-06');assert.equal(body.expected_revision,42);assert.deepEqual(body.operations.map(r=>r.reverses_exception_id),[f.coverall.id,f.lunch.id]);
 assert.equal(f.page.state.snapshot.authority_revision,43);assert.equal(f.page.state.pending,null);assert.equal(f.map.size,0);assert.match(f.nodes.get('changes-list').innerHTML,/No dated changes are active/);
});
test('scheduler reverse-workflow: unknown removal resumes from actual Resume handler with identical key/body, then verifies current readback',async()=>{
 const f=reversalFixture(),before=structuredClone(f.page.state.snapshot),writes=[];let accepted=false,reads=0,unknown=true;
 f.context.refreshSnapshot=f.page.refreshSnapshot;
 f.context.loadControlPlaneUrl=async()=> 'https://scheduler.onrender.com';f.context.api=async(path,options)=>{
  if(path.startsWith('/static-weekly/manager-snapshot?')){reads++;return{...structuredClone(before),authority_revision:accepted?43:42,projection_status:'current',latest_projection:{projection_id:PID}};}
  if(path==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[]};
  if(path==='/static-weekly/day-changes/batch'){writes.push(options.body);if(unknown)throw Error('Unconfirmed response');accepted=true;return f.reply;}throw Error('Unexpected route '+path);
 };
 await f.page.init();f.context.confirmAction=async()=>true;await f.page.reverseChange(f.event);
 assert.equal(f.page.state.pending.state,'PENDING');const bytes=f.page.state.pending.encoded;assert.equal(bytes,writes[0]);assert.equal(f.map.size,1);
 unknown=false;await f.nodes.get('scheduler-retry').listeners.get('click')();assert.equal(writes.length,2);assert.equal(writes[1],bytes);assert.equal(reads,2);assert.equal(f.page.state.snapshot.authority_revision,43);assert.equal(f.page.state.pending,null);assert.equal(f.map.size,0);
});
function initialWeekFixture(){
 const f=datedPreviewFixture(),published=structuredClone(f.page.state.snapshot),metadata={schema:'custodial.approved-initial-selection.v1',week_start:'2026-10-12',week_end:'2026-10-18',authority_revision:42,published:false,snapshot_authority:'SELECTION_METADATA_ONLY',initial:[{source_id:SOURCE,template_id:'approved-six',effective_start:'2026-10-12',staffing_count:6}]};
 const writes=[];f.context.loadControlPlaneUrl=async()=> 'https://scheduler.onrender.com';let current=false;
 f.context.api=async(path,options)=>{
  if(path==='/static-weekly/manager-snapshot?week_start=2026-10-05')return{...structuredClone(published),projection_status:'current',latest_projection:{projection_id:PID}};
  if(path==='/static-weekly/manager-snapshot?week_start=2026-10-12'){
   if(!current)throw Object.assign(Error('initial manager snapshot requires one active registered recurring source'),{status:409,code:'23514'});
   return{...structuredClone(published),week_start:metadata.week_start,week_end:metadata.week_end,authority_revision:43,projection_status:'current',latest_projection:{projection_id:PID}};
  }
  if(path==='/static-weekly/approved-initial/selection?week_start=2026-10-12')return structuredClone(metadata);
  if(path==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[...metadata.initial]};
  if(path===P.paths.initial+'/preview')return{...structuredClone(f.value),schema:'custodial.approved-static-initial-preview.v1',serviceDate:metadata.week_start,sourceId:SOURCE,assignments:[{...f.value.assignments[0],serviceDate:'2026-10-13'}],constraintView:{...structuredClone(f.value.constraintView),projectionAvailability:[{serviceDate:'2026-10-13',slotId:CID,incumbentPersonId:MID,incumbentName:'Current worker',status:'working'}]}};
  if(path===P.paths.initial+'/confirm'){writes.push(options.body);current=true;return approvedReceipt();}throw Error('Unexpected route '+path);
 };
 return{...f,metadata,writes};
}
test('scheduler unpublished-week: selection refresh updates previous-week date limits without fabricating a published snapshot',async()=>{
 const f=initialWeekFixture();await f.page.init();assert.equal(f.page.els.service_date.min,'2026-10-05');assert.equal(f.page.els.service_date.max,'2026-10-11');
 f.page.els.week_start.value='2026-10-12';f.page.els.service_date.value='2026-10-12';await f.page.refreshSnapshot();
 assert.equal(f.page.els.service_date.min,'2026-10-12');assert.equal(f.page.els.service_date.max,'2026-10-18');assert.equal(f.page.els.service_date.value,'2026-10-12');
 assert.equal(f.page.state.snapshot,null);assert.equal(f.page.state.initialSelection.snapshot_authority,'SELECTION_METADATA_ONLY');assert.equal(f.nodes.get('day-changes-section').hidden,true);assert.equal(f.writes.length,0);
});
test('scheduler initial-create: approved selection supports cancel then one exact confirmation and matching page readback',async()=>{
 const f=initialWeekFixture();await f.page.init();f.page.els.week_start.value='2026-10-12';f.page.els.service_date.value='2026-10-12';await f.page.refreshSnapshot();
 await f.page.generateDraft();assert.equal(f.page.state.preview.kind,'initial');assert.equal(f.page.state.preview.input.source_id,SOURCE);assert.equal(f.page.state.preview.input.effective_start,'2026-10-12');assert.equal(f.page.state.preview.preview.constraintView.opening.proven,false);
 f.context.confirmAction=async()=>false;await f.page.publishDraft();assert.equal(f.writes.length,0);assert.equal(f.map.size,0);assert.equal(f.page.state.snapshot,null);
 f.context.confirmAction=async()=>true;await f.page.publishDraft();assert.equal(f.writes.length,1);const body=JSON.parse(f.writes[0]);assert.equal(body.source_id,SOURCE);assert.equal(body.template_id,'approved-six');assert.equal(body.effective_start,'2026-10-12');assert.equal(body.expected_revision,42);assert.equal(body.preview_digest,f.value.previewDigest);
 assert.equal(f.page.state.snapshot.week_start,'2026-10-12');assert.equal(f.page.state.snapshot.authority_revision,43);assert.equal(f.page.state.initialSelection,null);assert.equal(f.page.state.approvedPending,null);assert.equal(f.map.size,0);assert.equal(f.nodes.get('day-changes-section').hidden,false);
});
for(const outcome of ['unknown','accepted'])test(`scheduler permission-recovery: ${outcome} approved request remains visible after owner capability is revoked`,async()=>{
 const f=datedPreviewFixture(),writes=[];
 const seed=P.create({managerId:MID,baseUrl:'https://scheduler.onrender.com',storage:f.storage,nonce:()=>CID,api:async()=>{if(outcome==='unknown')throw Error('Unconfirmed original');return approvedReceipt('recurring');}});
 if(outcome==='unknown')await assert.rejects(seed.confirm('recurring',f.value,{effective_start:'2026-10-05',expected_revision:42}));else await seed.confirm('recurring',f.value,{effective_start:'2026-10-05',expected_revision:42});
 const original=seed.pending().encoded;f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,manage_absences:true}});
 f.context.loadControlPlaneUrl=async()=> 'https://scheduler.onrender.com';f.context.api=async(path,options)=>{if(path.startsWith('/static-weekly/manager-snapshot?'))return{...structuredClone(f.page.state.snapshot),authority_revision:42,projection_status:'current',latest_projection:{projection_id:PID}};writes.push({path,options});throw Error('No mutation or selection allowed');};
 await f.page.init();assert.ok(f.page.state.approvedPending);assert.equal(f.page.state.approvedPending.encoded,original);assert.equal(f.map.size,1);assert.equal(f.nodes.get('scheduler-pending-panel').hidden,false);assert.equal(f.page.els.apply_day_btn.disabled,true);
 assert.equal(f.nodes.get('scheduler-retry').disabled,outcome==='unknown');assert.equal(writes.length,0);
 if(outcome==='accepted'){
  f.context.api=async(path)=>{assert.match(path,/manager-snapshot/);return{...structuredClone(f.page.state.snapshot),authority_revision:43,projection_status:'current',latest_projection:{projection_id:PID}};};
  await f.nodes.get('scheduler-retry').listeners.get('click')();assert.equal(f.map.size,0);assert.equal(f.page.state.approvedPending,null);assert.equal(writes.length,0);
 }
});
for(const kind of ['approved','dated'])test(`scheduler dispatch-revocation: ${kind} request loses capability while headers await and remains original PENDING without HTTP`,async()=>{
 const f=pageFixture();f.page.state.baseUrl='https://scheduler.onrender.com';f.page.state.principal=A.principal(f.auth);
 let release;const headers=new Promise(r=>release=r);f.auth.opsManagerAuthHeaders=async()=>headers;let posts=0;
 f.context.fetch=async()=>{posts++;return{ok:false,status:403,json:async()=>({ok:false,error:'Current permission denied'})};};
 const actions=kind==='approved'?P.create({managerId:MID,baseUrl:f.page.state.baseUrl,storage:f.storage,nonce:()=>CID,api:f.page.api}):A.create({auth:f.auth,baseUrl:f.page.state.baseUrl,storage:f.storage,api:f.page.api});
 const work=kind==='approved'?actions.confirm('recurring',preview,{effective_start:'2026-10-05',expected_revision:42}):actions.run(path,body);
 const saved=actions.pending().encoded;f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true}});release({});await assert.rejects(work);
 assert.equal(posts,0);assert.equal(actions.pending().encoded,saved);assert.equal(actions.pending().state,'PENDING');assert.equal(f.map.size,1);
});
for(const kind of ['approved','dated'])test(`scheduler guarded-dispatch: unchanged ${kind} capability sends the original body once and binds actual transport receipt`,async()=>{
 const f=pageFixture();f.page.state.baseUrl='https://scheduler.onrender.com';f.page.state.principal=A.principal(f.auth);f.auth.opsManagerAuthHeaders=async()=>({});const calls=[];
 f.context.fetch=async(url,options)=>{calls.push({url,options});return{ok:true,status:200,json:async()=>({ok:true,data:kind==='approved'?approvedReceipt('recurring'):f.reply})};};
 const actions=kind==='approved'?P.create({managerId:MID,baseUrl:f.page.state.baseUrl,storage:f.storage,nonce:()=>CID,api:f.page.api}):A.create({auth:f.auth,baseUrl:f.page.state.baseUrl,storage:f.storage,api:f.page.api});
 if(kind==='approved')await actions.confirm('recurring',preview,{effective_start:'2026-10-05',expected_revision:42});else await actions.run(path,body);
 assert.equal(calls.length,1);assert.equal(actions.pending().state,'ACCEPTED');assert.equal(calls[0].options.body,actions.pending().encoded);assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.cache,'no-store');assert.equal(f.map.size,1);
 assert.equal(calls[0].url,'https://scheduler.onrender.com'+(kind==='approved'?P.paths.recurring+'/confirm':path));
});
function approvedReceipt(kind='initial'){return{schema:kind==='initial'?'custodial.approved-static-initial-confirmation.v1':'custodial.approved-static-confirmation.v1',status:'PERSISTED_CURRENT',ok:true,persistence_status:'PERSISTED',source_id:SOURCE,publication_id:SOURCE,projection_id:PID,lunch_document_identity:'b'.repeat(64),authority_revision:43,previewDigest:'a'.repeat(64),solverInvoked:false};}
// NEW existing page/controller/fetch recording journey. All manager sessions,
// HTTP responses and receipts below are synthetic DATA, not SQL/auth proof.
function approvedRecoveryFixture(kind='recurring'){
 const f=datedPreviewFixture(),week=kind==='initial'?'2026-10-12':'2026-10-05',trace=[];
 const s={posts:0,statusGets:0,nonces:0,dialogs:0,committed:false,postOutcome:'lost',statusMode:'ACCEPTED',
  statusPatch:null,statusWait:null,afterStatus:null,readbackMismatch:false,postBody:null};
 const base={...structuredClone(f.page.state.snapshot),week_start:week,week_end:kind==='initial'?'2026-10-18':'2026-10-11',
  projection_status:'current',latest_projection:{projection_id:PID}};
 const input={...(kind==='initial'?{source_id:SOURCE,template_id:'approved-six'}:{}),effective_start:week,expected_revision:42};
 const value={...structuredClone(f.value),schema:kind==='initial'?'custodial.approved-static-initial-preview.v1':'custodial.approved-static-preview.v1',
  sourceId:SOURCE,serviceDate:week,assignments:f.value.assignments.map(row=>({...row,serviceDate:week})),
  constraintView:{...structuredClone(f.value.constraintView),projectionAvailability:f.value.constraintView.projectionAvailability.map(row=>({...row,serviceDate:week}))}};
 const metadata={schema:'custodial.approved-initial-selection.v1',week_start:week,week_end:base.week_end,authority_revision:42,published:false,
  snapshot_authority:'SELECTION_METADATA_ONLY',initial:[{source_id:SOURCE,template_id:'approved-six',effective_start:week,staffing_count:6}]};
 const status=()=>{const b=s.postBody,key=kind==='initial'?b.idempotency_key:b.confirmation_key;
  const data={schema:'custodial.approved-static-confirmation-status.v1',kind,state:s.statusMode,confirmationKey:key,
   request:s.statusMode==='NOT_FOUND'?null:kind==='initial'?{sourceId:b.source_id,effectiveStart:b.effective_start,templateId:b.template_id,
    expectedRevision:b.expected_revision,previewDigest:b.preview_digest,idempotencyKey:key}:
    {publicationId:null,serviceDate:b.effective_start,kind:'RECURRING_STAFFING',templateId:b.template_id??null,
     expectedRevision:b.expected_revision,previewDigest:b.preview_digest,idempotencyKey:key},
   receipt:s.statusMode==='NOT_FOUND'?null:approvedReceipt(kind)};
  s.statusPatch?.(data);return data;
 };
 const response=data=>({ok:true,status:200,json:async()=>({ok:true,data})});
 f.auth.opsManagerAuthHeaders=async()=>({'x-synthetic-session':'Source fixture only'});
 f.context.loadControlPlaneUrl=async()=> 'https://scheduler.onrender.com';
 f.context.fetch=async(url,options={})=>{
  const path=new URL(url).pathname+new URL(url).search;trace.push({path,options});
  if(path.startsWith('/static-weekly/manager-snapshot?')){
   if(kind==='initial'&&!s.committed)return{ok:false,status:409,json:async()=>({ok:false,code:'23514',error:'initial manager snapshot requires one active registered recurring source'})};
   return response({...structuredClone(base),authority_revision:s.committed?43:42,
    latest_projection:{projection_id:s.readbackMismatch?CID:PID}});
  }
  if(path==='/static-weekly/approved-initial/selection?week_start='+week)return response(metadata);
  if(path==='/static-weekly/approved-choices')return response({schema:'custodial.approved-schedule-choices.v1',initial:kind==='initial'?metadata.initial:[]});
  if(path===P.paths[kind]+'/preview')return response(structuredClone(value));
  if(path===P.paths[kind]+'/confirm'){
   assert.equal(options.method,'POST');s.posts++;s.postBody??=JSON.parse(options.body);
   if(s.postOutcome==='reject')return{ok:false,status:409,json:async()=>({ok:false,error:'Synthetic conclusive original rejection',code:'40001'})};
   s.committed=true;if(s.postOutcome==='lost'&&s.posts===1)throw Error('Synthetic lost original POST response');
   return response(approvedReceipt(kind));
  }
  if(path===P.paths[kind]+'/confirmations/'+CID){
   s.statusGets++;assert.equal(options.method,'GET');assert.equal(options.body,undefined);
   if(s.statusWait)await s.statusWait;
   if(s.statusMode==='network')throw Error('Synthetic lost original GET response');
   if(s.statusMode==='denied')return{ok:false,status:403,json:async()=>({ok:false,error:'Synthetic current-manager status denial'})};
   if(s.statusMode==='rpc-unavailable')return{ok:false,status:503,json:async()=>({ok:false,error:'Synthetic original status reader unavailable',code:'42883'})};
   return response(status());
  }
  assert.fail('Unexpected Source fixture route '+path);
 };
 const wrap=api=>async(path,options)=>{assert.equal(options?.expectedManagerId,MID,'Original manager bound before API strips routing metadata');
  const result=await api(path,options);if(path.includes('/confirmations/'))s.afterStatus?.();return result;};
 const attach=()=>P.create({auth:f.auth,managerId:MID,baseUrl:'https://scheduler.onrender.com',storage:f.storage,
  nonce:()=>{s.nonces++;return CID;},api:wrap(f.page.api),onState:r=>{f.page.state.approvedPending=r;}});
 f.context.window.MemphisApprovedSchedule.create=o=>P.create({...o,storage:f.storage,nonce:()=>{s.nonces++;return CID;},api:wrap(o.api)});
 f.page.state.baseUrl='https://scheduler.onrender.com';f.page.state.principal=A.principal(f.auth);f.page.state.approved=attach();
 f.page.els.week_start.value=week;f.page.els.service_date.value=week;
 if(kind==='initial'){f.page.state.snapshot=null;f.page.state.initialSelection=structuredClone(metadata);f.page.state.approvedChoices=structuredClone(metadata);f.context.document.getElementById('approved-source').value=SOURCE;}
 else f.page.state.approvedChoices={initial:[]};
 const start=async()=>{await f.page.generateDraft();assert.ok(f.page.state.preview);f.context.confirmAction=async()=>{s.dialogs++;return true;};
  await f.page.publishDraft();assert.equal(s.posts,1);assert.equal(s.nonces,1);return f.page.state.approved.pending();};
 return{...f,s,trace,status,attach,start,week,input,async reload(){
  // A fresh page has fresh transient state, not the prior document's sticky
  // withdrawn-access flag. Keep ONLY original persistent storage/transport.
  Object.assign(f.page.state,{baseUrl:'',snapshot:null,busy:false,accessDenied:false,pending:null,actions:null,principal:null,
   approved:null,approvedPending:null,preview:null,staffingPreview:null,approvedChoices:null,initialSelection:null,previewSelection:0});
  await f.page.init();return f.page.state.approved;
 }};
}
test('APPROVED_CONFIRMATION_RECOVERY_NEW: unknown confirmation retry never sends a second POST',async()=>{
 const f=approvedRecoveryFixture();await f.start();const original=f.page.state.approved.pending().encoded;
 await f.page.state.approved.retry();
 console.log('APPROVED_UNKNOWN_RECOVERY_TRACE',JSON.stringify({confirmationPosts:f.s.posts,statusGets:f.s.statusGets,nonces:f.s.nonces}));
 assert.equal(f.s.posts,1,'Unknown original was blindly POSTed again');assert.equal(f.s.statusGets,1);assert.equal(f.s.nonces,1);
 assert.equal(f.page.state.approved.pending().encoded,original);assert.equal(f.page.state.approved.pending().state,'ACCEPTED');
});
test('APPROVED_CONFIRMATION_RECOVERY_NEW: both mounted Resume journeys GET original status then current readback without another confirmation',async()=>{
 for(const kind of ['initial','recurring']){
  const f=approvedRecoveryFixture(kind);await f.start();const original=f.page.state.approved.pending().encoded;
  const saved=[...f.map.values()][0];await f.reload();assert.equal([...f.map.values()][0],saved);
  await f.nodes.get('scheduler-retry').listeners.get('click')();
  assert.equal(f.s.posts,1);assert.equal(f.s.statusGets,1);assert.equal(f.s.dialogs,1);assert.equal(f.s.nonces,1);
  assert.equal(f.map.size,0);assert.equal(f.page.state.approvedPending,null);assert.equal(f.page.state.snapshot.authority_revision,43);
  assert.ok(f.trace.some(row=>row.path===P.paths[kind]+'/confirmations/'+JSON.parse(original)[kind==='initial'?'idempotency_key':'confirmation_key']));
 }
});
test('APPROVED_CONFIRMATION_RECOVERY_NEW: NOT_FOUND denied and lost status reads preserve exact unresolved original through reload',async()=>{
 for(const mode of ['NOT_FOUND','denied','network']){
  const f=approvedRecoveryFixture();await f.start();const saved=[...f.map.values()][0];f.s.statusMode=mode;
  await assert.rejects(f.page.state.approved.retry());assert.equal([...f.map.values()][0],saved);assert.equal(f.s.posts,1);assert.equal(f.s.nonces,1);
  f.s.statusMode='ACCEPTED';await f.reload();await f.nodes.get('scheduler-retry').listeners.get('click')();
  assert.equal(f.s.posts,1);assert.equal(f.s.statusGets,2);assert.equal(f.map.size,0);
 }
});
test('APPROVED_CONFIRMATION_RECOVERY_NEW: exact closed wrapper request and receipt refuse contradictions without changing saved bytes',async()=>{
 for(const kind of ['initial','recurring'])for(const change of [
  d=>{d.schema='foreign';},d=>{d.kind=kind==='initial'?'recurring':'initial';},d=>{d.confirmationKey=SOURCE;},
  d=>{d.extra=true;},d=>{d.state='UNKNOWN';},d=>{d.request=null;},d=>{d.receipt=null;},
  d=>{d.state='NOT_FOUND';},d=>{d.request.extra=true;},d=>{d.request.expectedRevision='42';},
  d=>{d.request.previewDigest='c'.repeat(64);},d=>{d.request.idempotencyKey=SOURCE;},
  d=>{d.request.templateId='another-pattern';},d=>{d.request[kind==='initial'?'effectiveStart':'serviceDate']='2026-10-19';},
  d=>{if(kind==='initial')d.request.sourceId=CID;else d.request.publicationId=SOURCE;},
  d=>{d.receipt.previewDigest='c'.repeat(64);},d=>{d.receipt.solverInvoked=true;},d=>{d.receipt.authority_revision=42;},
 ]){
  const f=approvedRecoveryFixture(kind);await f.start();const saved=[...f.map.values()][0];f.s.statusPatch=change;
  await assert.rejects(f.page.state.approved.retry());assert.equal([...f.map.values()][0],saved);assert.equal(f.s.posts,1);assert.equal(f.s.nonces,1);
 }
});
test('APPROVED_CONFIRMATION_RECOVERY_NEW: principal permission and saved-record changes across GET cannot adopt old result',async()=>{
 for(const patch of [{manager_id:SOURCE},{credential_id:SOURCE},{device_id:'different-device'},
  {expires_at:'2000-01-01T00:00:00.000Z'},{read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true}}]){
  const f=approvedRecoveryFixture();await f.start();const saved=[...f.map.values()][0];
  f.s.afterStatus=()=>queueMicrotask(()=>f.patch(patch));await assert.rejects(f.page.state.approved.retry());
  assert.equal([...f.map.values()][0],saved);assert.equal(f.s.posts,1);assert.equal(f.s.statusGets,1);
 }
 const f=approvedRecoveryFixture();await f.start();const original=[...f.map.values()][0],key=[...f.map.keys()][0];
 f.s.afterStatus=()=>{f.storage.setItem(key,original+' ');};
 await assert.rejects(f.page.state.approved.retry());assert.equal(f.storage.getItem(key),original+' ');assert.equal(f.s.posts,1);
});
test('APPROVED_CONFIRMATION_RECOVERY_NEW: accepted local receipt needs no IO and incomplete current readback cannot clear it',async()=>{
 const f=approvedRecoveryFixture();await f.start();await f.page.state.approved.retry();
 const raw=[...f.map.values()][0],count=f.trace.length;const receipt=await f.page.state.approved.retry();
 assert.equal(f.trace.length,count);assert.equal(receipt.previewDigest,'a'.repeat(64));assert.equal([...f.map.values()][0],raw);
 f.s.readbackMismatch=true;await f.page.refreshSnapshot();assert.equal(f.map.size,1);assert.equal(f.page.state.approvedPending.state,'ACCEPTED');
 f.s.readbackMismatch=false;await f.nodes.get('scheduler-retry').listeners?.get('click')?.();
 await f.page.refreshSnapshot();assert.equal(f.map.size,0);assert.equal(f.s.posts,1);assert.equal(f.s.nonces,1);
});
test('APPROVED_CONFIRMATION_RECOVERY_NEW: conclusive original POST rejection stays read-only and dismissible',async()=>{
 const f=approvedRecoveryFixture();f.s.postOutcome='reject';const record=await f.start();assert.equal(record.state,'REJECTED');
 const saved=[...f.map.values()][0];await assert.rejects(f.page.state.approved.retry(),/conclusively rejected/);
 assert.equal(f.s.statusGets,0);assert.equal(f.s.posts,1);assert.equal([...f.map.values()][0],saved);
 f.page.state.approved.discardRejected();assert.equal(f.map.size,0);
});
test('APPROVED_CONFIRMATION_RECOVERY_NEW: overlapping Resume shares no second dispatch and accessor status is never read',async()=>{
 const f=approvedRecoveryFixture();await f.start();let release;f.s.statusWait=new Promise(resolve=>{release=resolve;});
 const work=f.page.state.approved.retry();
 try{
  for(let i=0;i<20&&!f.s.statusGets;i++)await new Promise(setImmediate);
  assert.equal(f.s.statusGets,1);await assert.rejects(f.page.state.approved.retry(),/in progress/);
  assert.equal(f.s.statusGets,1);assert.equal(f.s.posts,1);release();await work;
 }finally{release();await work.catch(()=>{});}
 let getters=0;const other=approvedRecoveryFixture('initial');await other.start();const raw=[...other.map.values()][0];
 other.s.statusPatch=data=>{Object.defineProperty(data.request,'sourceId',{enumerable:true,get(){getters++;throw Error('Untrusted status accessor');}});};
 await assert.rejects(other.page.state.approved.retry());assert.equal(getters,0);assert.equal([...other.map.values()][0],raw);
 assert.equal(other.s.posts,1);assert.equal(other.s.statusGets,1);
});
test('APPROVED_CONFIRMATION_RECOVERY_NEW: unavailable status RPC retains exact unresolved original without resend',async()=>{
 for(const kind of ['initial','recurring']){
  const f=approvedRecoveryFixture(kind);await f.start();const raw=[...f.map.values()][0];f.s.statusMode='rpc-unavailable';
  await assert.rejects(f.page.state.approved.retry(),/unavailable/);
  assert.equal([...f.map.values()][0],raw);assert.equal(f.page.state.approved.pending().state,'PENDING');
  assert.equal(f.page.state.approved.pending().acceptance,null);assert.equal(f.s.posts,1);assert.equal(f.s.statusGets,1);assert.equal(f.s.nonces,1);
 }
});
// NEW bounded loopback join, not database/manager/browser proof. The current
// runtime authenticates an explicitly public UNIT HMAC session. Its actual
// approved-status controller owns the SQL reader selection and actor checks;
// only the writer, protected registry/lease ports and SQL DATA are recordings.
async function approvedRecoveryCurrentHttpJourney(kind,mode){
 const [{createServer},{createOpsManagerSession},{createStaticWeeklyControlPlaneRuntime},{createStaticWeeklyControlPlane}]=await Promise.all([
  import('node:http'),import('../test-fixtures/ci/current-backend/src/auth/shared-access-auth.js'),
  import('../test-fixtures/ci/current-backend/src/static-weekly-control-plane-runtime.js'),import('../test-fixtures/ci/current-backend/src/static-weekly-control-plane.js')]);
 const f=approvedRecoveryFixture(kind),nativeFetch=globalThis.fetch,sourceFetch=f.context.fetch;
 const env={NODE_ENV:'test',SUPABASE_URL:'https://approved-recovery-UNIT.invalid',
  SUPABASE_SERVICE_ROLE_KEY:'PUBLIC-UNIT-NOT-A-SERVICE-CREDENTIAL',
  OPS_MANAGER_SESSION_SECRET:'PUBLIC-UNIT-approved-recovery-current-http-20261017'};
 const manager={manager_id:MID,display_name:'Synthetic UNIT named manager',system_key:'eric_custodial_manager',
  is_system_principal:false,roles:['OPS_MANAGER'],active:true};
 const signed=createOpsManagerSession({credentialId:CID,deviceId:'fixture-browser',manager,
  authMode:'trusted_device',accessLevel:'full_access',maximumAccessLevel:'full_access',env});
 f.patch({token:signed.token,expires_at:signed.expires_at});
 const current=()=>({credential_id:CID,device_id:'fixture-browser',max_access_level:'full_access',
  created_at:new Date(Date.now()-60000).toISOString(),expires_at:new Date(Date.now()+60000).toISOString(),
  manager_id:MID,manager:{...manager}});
 let registry=current(),ledger=null,fixtureCommits=0,checkedOut=0,released=0,connections=0,ended=0;
 const sql=[],http=[],leases=[],readers=[];
 const reader=kind==='initial'?'static_weekly_read_approved_initial_confirmation':'static_weekly_read_approved_template_confirmation';
 const database={async connect(){connections++;checkedOut++;let returned=false;return{
  async query(query,values=[]){
   sql.push({query,values:structuredClone(values)});const result=data=>({rows:[{result:data}]});
   if(['begin','commit','rollback','set local role static_weekly_control_plane','select public.custodial_begin_application_mutation()'].includes(query)
    ||/^set local statement_timeout = '\d+ms'$/.test(query))return{rows:[]};
   if(query==='select public.custodial_action_actor_v1($1,$2,$3,$4,$5) as result'){
    assert.deepEqual(values,[MID,CID,'fixture-browser','full_access','write']);
    return result({manager_id:MID,credential_id:CID,device_id:'fixture-browser',owner:true});
   }
   if(query==='select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1,0))'){
    assert.deepEqual(values,['memphis-static-weekly-authority']);return{rows:[]};
   }
   if(query===`select public.${reader}($1,$2) as result`){
    assert.deepEqual(values,[MID,CID]);assert.equal(fixtureCommits,1);readers.push({function:reader,manager_id:values[0],key:values[1]});
    assert.ok(sql.slice(0,-1).some(entry=>entry.query.includes('pg_advisory_xact_lock')),'Actual status authority lock precedes ledger read');
    if(mode==='missing-reader')throw Object.assign(Error('SYNTHETIC missing approved SQL reader'),{code:'42883'});
    return result(structuredClone(ledger));
   }
   assert.fail('Unexpected SQL in approved recovery recording: '+query);
  },release(){assert.equal(returned,false);returned=true;checkedOut--;released++;}
 };},async end(){ended++;assert.equal(checkedOut,0);}};
 const actual=createStaticWeeklyControlPlane({database});
 const write=async input=>{
  assert.equal(input.manager.manager_id,MID);assert.equal(input.manager.credential_id,CID);
  assert.equal(input.manager.device_id,'fixture-browser');assert.equal(fixtureCommits,0);
  const request=kind==='initial'?{sourceId:input.sourceId,effectiveStart:input.effectiveStart,templateId:input.templateId,
   expectedRevision:input.expectedRevision,previewDigest:input.previewDigest,idempotencyKey:input.idempotencyKey}:
   {publicationId:null,serviceDate:input.serviceDate,kind:'RECURRING_STAFFING',templateId:input.templateId,
    expectedRevision:input.expectedRevision,previewDigest:input.previewDigest,idempotencyKey:input.idempotencyKey};
  assert.equal(request.idempotencyKey,CID);assert.equal(request.expectedRevision,42);
  const receipt={...approvedReceipt(kind),revision:43,feasibility_digest:'c'.repeat(64)};
  ledger={request,receipt};fixtureCommits++;f.s.committed=true;return structuredClone(receipt);
 };
 // Deliberately override ONLY the original fixture writer. Both status methods
 // and runManagerOperation remain the actual current production functions.
 const controller={...actual,[kind==='initial'?'publishApprovedInitialBaseline':'confirmApprovedStaticPattern']:write};
 assert.equal(controller.getApprovedInitialConfirmationStatus,actual.getApprovedInitialConfirmationStatus);
 assert.equal(controller.getApprovedStaticConfirmationStatus,actual.getApprovedStaticConfirmationStatus);
 const runtime=createStaticWeeklyControlPlaneRuntime({env,database,controlPlane:controller,datedTransitionController:null,
  trustedDeviceStore:{async find(){return registry;}},supabase:{async rpc(name,args){leases.push({name,args});
   assert.ok(['custodial_begin_application_mutation_lease','custodial_release_application_mutation_lease'].includes(name));
   return{data:name==='custodial_begin_application_mutation_lease'?{mutations_paused:false,state:'READY',authority_generation:0,restore_id:null}:true,error:null};}}});
 const sockets=new Set(),server=createServer((req,res)=>{http.push({method:req.method,path:req.url});runtime.app(req,res);});
 server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 let listening=false;
 try{
  // One normal bind attempt; a denied local listener is an actual first
  // failure, not a reason to change hosts/controllers or bypass protection.
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});listening=true;
  const origin=`http://127.0.0.1:${server.address().port}`;
  f.auth.opsManagerAuthHeaders=async()=>({Authorization:`Bearer ${signed.token}`});
  f.context.fetch=async(url,options={})=>{
   const route=new URL(url).pathname;
   if(route!==P.paths[kind]+'/confirm'&&!route.startsWith(P.paths[kind]+'/confirmations/'))return sourceFetch(url,options);
   const response=await nativeFetch(origin+route,{...options,signal:AbortSignal.timeout(5000)});
   if(route.endsWith('/confirm')){
    f.s.posts++;f.s.postBody??=JSON.parse(options.body);
    assert.equal(response.status,200,await response.clone().text());await response.text();
    assert.equal(fixtureCommits,1);throw Error('UNIT client lost original HTTP POST reply AFTER fixture commit/response');
   }
   f.s.statusGets++;assert.equal(options.method,'GET');assert.equal(options.body,undefined);return response;
  };
  await f.start();assert.equal(fixtureCommits,1);assert.equal(f.page.state.approved.pending().state,'PENDING');
  const original=[...f.map.values()][0],encoded=f.page.state.approved.pending().encoded;
  const leaseCount=leases.length;
  assert.deepEqual(leases.map(row=>row.name),['custodial_begin_application_mutation_lease','custodial_release_application_mutation_lease']);
  await f.reload();assert.equal([...f.map.values()][0],original,'Reload preserves original bytes before explicit Resume');
  if(mode==='foreign')registry={...current(),manager_id:SOURCE,manager:{...manager,manager_id:SOURCE}};
  if(mode==='withdrawn')registry={...current(),revoked_at:new Date().toISOString()};
  await f.nodes.get('scheduler-retry').listeners.get('click')();
  assert.equal(f.s.posts,1);assert.equal(f.s.nonces,1);assert.equal(f.s.dialogs,1);assert.equal(fixtureCommits,1);
  assert.equal(f.s.statusGets,1);assert.equal(leases.length,leaseCount,'Read-only GET cannot obtain a mutation lease');
  assert.deepEqual(http,[{method:'POST',path:P.paths[kind]+'/confirm'},{method:'GET',path:P.paths[kind]+'/confirmations/'+CID}]);
  if(mode==='accepted'){
   assert.equal(f.map.size,0);assert.equal(f.page.state.approvedPending,null);assert.equal(f.page.state.snapshot.authority_revision,43);
   assert.deepEqual(readers,[{function:reader,manager_id:MID,key:CID}]);
   assert.equal(connections,1);assert.equal(sql.filter(row=>row.query.includes('custodial_action_actor_v1')).length,2);
   assert.equal(sql.at(-1).query,'commit');
  }else{
   assert.equal([...f.map.values()][0],original);assert.equal(f.page.state.approved.pending().encoded,encoded);
   assert.equal(f.page.state.approved.pending().acceptance,null);assert.equal(f.page.state.approved.pending().state,'PENDING');
   if(mode==='missing-reader'){assert.equal(readers.length,1);assert.equal(sql.at(-1).query,'rollback');}
   else{assert.equal(readers.length,0);assert.equal(connections,0,'Current signed-session association refusal precedes SQL');}
  }
  assert.equal(released,connections);assert.equal(checkedOut,0);
  console.log('APPROVED_RECOVERY_CURRENT_HTTP_JOIN',JSON.stringify({kind,mode,http,readerCalls:readers,originalConfirmationPosts:f.s.posts,
   statusGets:f.s.statusGets,nonces:f.s.nonces,fixtureCommits,actualHTTP:true,normalUNITSessionHmac:true,
   actualStatusMethods:true,actualSQL:false,genuineManager:false,browser:false,storageCleared:f.map.size===0}));
 }finally{
  // Drain current requests, close ONLY this listener/its sockets, then the
  // actual controller queue and recording database. No provider/SQL leases.
  // Subscribe BEFORE any close/destroy call: server.close's completion does
  // not itself prove that every owned socket's close event has been drained.
  const socketClosures=[...sockets].map(socket=>new Promise(resolve=>socket.once('close',resolve)));
  const closed=listening?new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())):Promise.resolve();
  server.closeIdleConnections();server.closeAllConnections();for(const socket of sockets)socket.destroy();
  try{await Promise.all([closed,...socketClosures]);}finally{await actual.close();}
  assert.equal(server.listening,false);assert.equal(sockets.size,0);assert.equal(checkedOut,0);assert.equal(ended,1);
 }
}
test('APPROVED_RECOVERY_CURRENT_HTTP_NEW: original lost confirmation joins signed current GET ledger selection and page acknowledgement',{timeout:15000},async()=>{
 for(const [kind,mode]of [['initial','accepted'],['recurring','accepted'],['recurring','foreign'],['recurring','withdrawn'],['recurring','missing-reader']]){
  if(approvedRecoveryHttpRemainingOnly&&kind==='initial')continue;
  await approvedRecoveryCurrentHttpJourney(kind,mode);
 }
});
function staffingFixture(){const f=fixture();f.patch({read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}});
 const route='/static-weekly/roster/'+CID+'/vacate',request={source_id:SOURCE,employee_id:MID,effective_start:'2026-10-06',reason:'Current position vacancy',expected_revision:42,idempotency_key:'original-vacancy'};
 const record={path:route,body:request,managerId:MID};
 const outcome={schema:'custodial.original-staffing-outcome.v1',state:'ACCEPTED_ORIGINAL',manager_id:MID,operation:'vacate_roster_slot',
  idempotency_key:request.idempotency_key,command_id:PID,original_request:A.staffingRequest(record),original_request_digest:'a'.repeat(64),
  receipt:{revision:43,data:{completion_mode:'mutation_only',original_publication_id:null}},retry_safe:false,phone_released:false};
 return{...f,route,request,outcome};}
test('stable vacancy product: projected original GET receipt cannot clear on wrong current plan or revision',async()=>{
 for(const changed of ['projection','publication','revision','occupied']){
  const f=await vacancyProductFixture();
  const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async(_path,options)=>{if(options.method==='POST')throw Error('lost');return f.outcome;}});
  await assert.rejects(a.runVacancy(f.request,f.preview,f.binding));
  await a.retry();const saved=f.storage.getItem([...f.map.keys()][0]);
  const current={week_start:'2026-10-05',projection_status:'current',authority_revision:44,current_publication:{publication_id:SOURCE},
   latest_projection:{projection_id:PID,replay_digest:'b'.repeat(64)},roster:[{slot_id:CID,week_staffing:[{service_date:'2026-10-06',person_id:null,availability_state:'vacant_unfilled'}]}]};
  if(changed==='projection')current.latest_projection.projection_id=CID;if(changed==='publication')current.current_publication.publication_id=PID;
  if(changed==='revision')current.authority_revision=45;if(changed==='occupied')current.roster[0].week_staffing[0].person_id=MID;
  assert.equal(a.acknowledge(current),false,changed);assert.equal(f.map.size,1);assert.equal(f.storage.getItem([...f.map.keys()][0]),saved);
 }
});
// New vacancy-only DTOs use the actual released public contract, not compiler
// or SQL output. The existing VM/storage fixtures exercise owning consumers.
async function vacancyProductFixture(){
 const f=staffingFixture(),hash=text=>createHash('sha256').update(text).digest('hex'),H=n=>n.repeat(64);
 const binding={managerId:MID,slotId:CID,publicationId:SOURCE,currentSourceDigest:H('c'),registeredSourceDigest:H('d')};
 const preview={schema:'custodial.stable-vacancy-preview.v1',managerId:MID,sourceId:SOURCE,slotId:CID,employeeId:MID,
  effectiveStart:f.request.effective_start,weekStart:'2026-10-05',expectedRevision:42,projectionExpectedRevision:43,resultingRevision:44,
  idempotencyKey:f.request.idempotency_key,projectionIdempotencyKey:'projection-'+hash(f.request.idempotency_key),reasonDigest:hash(f.request.reason),
  currentSourceDigest:H('c'),registeredSourceDigest:H('d'),publicationId:SOURCE,previewDigest:H('a'),workerCandidateDigest:H('e'),accepted:false,persisted:false,phoneUpdated:false,
  preview_retained:true,published:false,
  preview:{weekStart:'2026-10-05',weekEnd:'2026-10-11',compilerVersion:'SYNTHETIC_PUBLIC_DTO_NOT_SOLVER_OUTPUT',exceptionSetDigest:H('f'),databaseProjectionIdentity:H('9'),
   sourceDigest:H('8'),sourceDigestBasis:'envelope.authority.inputDigest',replayDigest:H('b'),authorityDigest:H('7'),objective:{mode:'SOURCE_PLANNED'},metrics:{},
   assignments:[{planWorkId:'affected-work',workId:'work',dayOfWeek:2,serviceDate:'2026-10-06',status:'open',ownerSlotId:null,ownerPersonId:null,
    workSnapshot:{workId:'work',locationNameSnapshot:'Actual affected duty <not HTML>',window:{start:'07:00',end:'09:45'}}}],
   projectionAvailability:[{dayOfWeek:2,serviceDate:'2026-10-06',slotId:CID,status:'vacant_unfilled',incumbentPersonId:null,shift:{start:'07:00',end:'16:00'},lunch:{start:'12:00',end:'12:30'}},
    {dayOfWeek:3,serviceDate:'2026-10-07',slotId:PID,status:'working',incumbentPersonId:SOURCE,incumbentName:'Wednesday person',shift:{start:'08:00',end:'13:00'},lunch:{start:'12:00',end:'12:30'},productiveCapacityMinutes:270}],
   lunchDocument:{documentIdentity:H('6'),weekStart:'2026-10-05',baseAuthorityDigest:H('7'),baseReplayDigest:H('b'),sourceInputDigest:H('8'),candidateDigest:H('5'),loans:[],responsibilities:[]}}};
 const outcome=structuredClone(f.outcome);outcome.receipt={revision:44,data:{completion_mode:'projection_required',original_publication_id:SOURCE,
  worker_candidate_digest:preview.workerCandidateDigest,persisted_projection_digest:H('4'),paired_lunch_document_identity:H('6'),projection_authority_digest:H('7'),
  current_projection:{projection_id:PID,publication_id:SOURCE,week_start:'2026-10-05',replay_digest:H('b')}}};
 const current={week_start:'2026-10-05',week_end:'2026-10-11',authority_revision:44,projection_status:'current',current_publication:{publication_id:SOURCE},
  latest_projection:{projection_id:PID,replay_digest:H('b')},roster:[{slot_id:CID,week_staffing:[{service_date:'2026-10-06',person_id:null,availability_state:'vacant_unfilled'}]}]};
 return{...f,binding,preview,outcome,current,hash};
}
test('vacancy retention consumer: missing or nonliteral retained/unpublished flags refuse before witness and POST',async()=>{
 for(const badFlags of [{preview_retained:undefined,published:undefined},{preview_retained:undefined,published:false},
  {preview_retained:true,published:undefined},{preview_retained:'true',published:false},{preview_retained:true,published:'false'},
  {preview_retained:false,published:false},{preview_retained:true,published:true}]){
  const f=await vacancyProductFixture();for(const[key,value]of Object.entries(badFlags)){if(value===undefined)delete f.preview[key];else f.preview[key]=value;}
  const original=JSON.stringify(f.preview),a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async()=>{throw Error('Unexpected POST');}});
  await assert.rejects(A.validateVacancyPreview(f.preview,f.request,f.binding),/retained.*unpublished/);
  await assert.rejects(a.runVacancy(f.request,f.preview,f.binding),/retained.*unpublished/);
  assert.equal(f.map.size,0);assert.equal(a.pending(),null);assert.equal(JSON.stringify(f.preview),original,'no fake marker backfill/source rewrite');
 }
});
test('vacancy retention consumer: valid retained contract preserves hash/body witness and unknown original GET-only recovery',async()=>{
 const f=await vacancyProductFixture(),originalPreview=JSON.stringify(f.preview);let posts=0,gets=0;
 assert.equal(await A.validateVacancyPreview(f.preview,f.request,f.binding),f.preview);assert.equal(JSON.stringify(f.preview),originalPreview);
 const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async(_p,o)=>{
  if(o.method==='POST'){posts++;throw Error('Original response lost');}gets++;return{schema:'custodial.original-staffing-outcome.v1',state:'OUTCOME_UNCONFIRMED',retry_safe:false};}});
 await assert.rejects(a.runVacancy(f.request,f.preview,f.binding),/lost/);const saved=a.pending(),raw=f.storage.getItem([...f.map.keys()][0]);
 assert.deepEqual(saved.body,{...f.request,preview_digest:f.preview.previewDigest});assert.equal(saved.vacancy.workerCandidateDigest,f.preview.workerCandidateDigest);
 assert.equal(saved.vacancy.previewDigest,f.preview.previewDigest);assert.equal(Object.hasOwn(saved.body,'preview_retained'),false);assert.equal(Object.hasOwn(saved.body,'published'),false);
 assert.equal(Object.hasOwn(saved.vacancy,'preview_retained'),false);assert.equal(Object.hasOwn(saved.vacancy,'published'),false,'no new flag/binder authority inferred in persisted witness');
 delete f.preview.preview_retained;delete f.preview.published;await assert.rejects(a.retry(),/unconfirmed/);
 assert.equal(posts,1);assert.equal(gets,1);assert.equal(a.pending().state,'PENDING');assert.equal(f.storage.getItem([...f.map.keys()][0]),raw);
});
test('vacancy retention consumer: changed marker during hash await or witness creation refuses before save/POST',async()=>{
 for(const phase of ['await','witness']){
  const f=await vacancyProductFixture();let posts=0;
  const binding=phase==='witness'?{...f.binding,assertCurrent:()=>{f.preview.published=true;}}:f.binding;
  const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async()=>{posts++;}});
  const work=a.runVacancy(f.request,f.preview,binding);if(phase==='await')f.preview.preview_retained=false;
  await assert.rejects(work,/retained.*unpublished/);assert.equal(posts,0);assert.equal(f.map.size,0);assert.equal(a.pending(),null);
 }
});
test('stable vacancy product: one confirmed candidate and unknown response recover GET-only with bounded saved witnesses',async()=>{
 const f=await vacancyProductFixture();let writes=0,reads=0;
 const api=async(path,options)=>{if(options.method==='POST'){writes++;assert.equal(path,f.route);throw Error('Original response lost');}reads++;return f.outcome;};
 const attach=()=>A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api});let a=attach();
 await assert.rejects(a.runVacancy(f.request,f.preview,f.binding),/lost/);const saved=a.pending(),bytes=saved.encoded;
 assert.equal(JSON.parse(bytes).preview_digest,f.preview.previewDigest);assert.equal(Object.keys(JSON.parse(bytes)).length,7);
 assert.equal(saved.vacancy.workerCandidateDigest,f.preview.workerCandidateDigest);assert.equal(Object.hasOwn(saved.vacancy,'preview'),false);assert.equal(Object.hasOwn(saved.vacancy,'preparedProjectionDigest'),false);
 a=attach();await a.retry();await a.retry();assert.equal(writes,1);assert.equal(reads,1);assert.equal(a.pending().encoded,bytes);
 assert.notEqual(f.outcome.receipt.data.persisted_projection_digest,f.preview.workerCandidateDigest);assert.equal(a.acknowledge(f.current),true);assert.equal(f.map.size,0);
});
test('stable vacancy product: missing or mismatched fixed worker/lunch/authority/semantic evidence remains original PENDING',async()=>{
 for(const field of ['worker_candidate_digest','persisted_projection_digest','paired_lunch_document_identity','projection_authority_digest','revision','semantic']){
  const f=await vacancyProductFixture();let posts=0;
  const bad=structuredClone(f.outcome);if(field==='revision')bad.receipt.revision=45;else if(field==='semantic')bad.original_request.employee_id=SOURCE;else delete bad.receipt.data[field];
  const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async(_path,o)=>{if(o.method==='POST'){posts++;return{};}return bad;}});
  await assert.rejects(a.runVacancy(f.request,f.preview,f.binding),/unconfirmed/);const raw=f.storage.getItem([...f.map.keys()][0]);
  await assert.rejects(a.retry(),/unconfirmed/);assert.equal(posts,1);assert.equal(a.pending().state,'PENDING');assert.equal(f.storage.getItem([...f.map.keys()][0]),raw);
 }
});
test('stable vacancy product: wrong source/revision/date/digest and revoked awaited actor refuse before POST',async()=>{
 for(const field of ['currentSourceDigest','registeredSourceDigest','resultingRevision','workerCandidateDigest','effectiveStart','assignmentDate','contractor']){
  const f=await vacancyProductFixture();let calls=0;const bad=structuredClone(f.preview);
  if(field==='resultingRevision')bad.resultingRevision=43;else if(field==='effectiveStart')bad.effectiveStart='2026-02-31';
  else if(field==='assignmentDate')bad.preview.assignments[0].serviceDate='2026-10-13';
  else if(field==='contractor')Object.assign(bad.preview.assignments[0],{ownerKind:'CONTRACTOR_CAPACITY',ownerPersonId:MID,capacityId:PID});else bad[field]='invalid';
  const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async()=>{calls++;}});
  await assert.rejects(a.runVacancy(f.request,bad,f.binding));assert.equal(calls,0);assert.equal(f.map.size,0);
 }
 const f=await vacancyProductFixture();let calls=0;const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async()=>{calls++;}});
 const work=a.runVacancy(f.request,f.preview,f.binding);f.patch({credential_id:SOURCE});await assert.rejects(work,/access changed/);assert.equal(calls,0);assert.equal(f.map.size,0);
 await assert.rejects(A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async()=>{calls++;}}).run(f.route,f.request),/candidate first/);assert.equal(calls,0);
});
async function vacancyPageFixture(){
 const data=await vacancyProductFixture(),f=datedPreviewFixture();f.page.state.principal=A.principal(f.auth);f.page.state.baseUrl='https://scheduler.onrender.com';
 const s=f.page.state.snapshot;s.current_service_date='2026-10-06';s.projection_status='current';s.sources=[{source_id:SOURCE,source_digest:data.binding.registeredSourceDigest}];
 s.latest_projection={projection_id:PID,assignments:[]};s.roster[0].week_staffing=[{service_date:'2026-10-05',person_id:SOURCE,person_name:'Selected Monday person'},
  {service_date:'2026-10-06',person_id:MID,person_name:'Actual Tuesday person',availability_state:'working'}];
 const details={schema:'custodial.roster-source-details.v1',manager_id:MID,source_id:SOURCE,effective_start:'2026-10-06',week_start:s.week_start,authority_revision:42,
  current_source_digest:data.binding.currentSourceDigest,registered_source_digest:data.binding.registeredSourceDigest,publication_id:SOURCE,phone_released:false,
  current_roster:structuredClone(s.roster),registered_compiler_input:{slots:[{id:CID}],version:{vacancyCapableSlotIds:[CID],vacantSlotIds:[CID]}}};
 const calls=[];let outcome=false,missing=false,previewGate=null;f.context.api=async(path,o={})=>{calls.push({path,o});
  if(path.startsWith('/static-weekly/staffing/source-details?'))return structuredClone(details);
  if(path===data.route+'/preview'){if(previewGate)await previewGate;const b=JSON.parse(o.body);return{...structuredClone(data.preview),idempotencyKey:b.idempotency_key,
   projectionIdempotencyKey:'projection-'+data.hash(b.idempotency_key),reasonDigest:data.hash(b.reason)};}
  if(path===data.route){outcome=true;return{};}
  if(path.startsWith('/static-weekly/staffing/operations/')){const receipt=structuredClone(data.outcome),key=decodeURIComponent(path.split('/').at(-1).split('?')[0]);receipt.idempotency_key=key;
   if(missing)delete receipt.receipt.data.worker_candidate_digest;return receipt;}
  if(path.startsWith('/static-weekly/manager-snapshot?'))return outcome?structuredClone(data.current):structuredClone(s);
  if(path==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[]};throw Error('Unexpected '+path);
 };
 f.page.state.actions=A.create({auth:f.auth,storage:f.storage,baseUrl:f.page.state.baseUrl,api:f.context.api,onState:r=>f.page.state.pending=r});
 f.nodes.get('vacancy-dialog').showModal=()=>{};f.nodes.get('vacancy-dialog').close=()=>{};
 const button={dataset:{turnoverMode:'vacate',turnoverSlot:CID}},event={target:{closest:()=>button}},submit={preventDefault(){}};
 f.page.openTurnoverDialog(event);f.page.vacancyEls.vacancy_source.value=SOURCE;await f.page.loadVacancySource();f.page.vacancyEls.vacancy_reason.value=data.request.reason;
 return{...f,data,calls,submit,setMissing:()=>missing=true,setGate:gate=>previewGate=gate};
}
test('vacancy retention consumer: page holds old DTOs and displays only unsubmitted retained review with unchanged one-confirm body',async()=>{
 for(const kind of ['missing','string','false','published']){
  const f=await vacancyPageFixture();if(kind==='missing'){delete f.data.preview.preview_retained;delete f.data.preview.published;}
  if(kind==='string')f.data.preview.preview_retained='true';if(kind==='false')f.data.preview.preview_retained=false;if(kind==='published')f.data.preview.published=true;
  await assert.rejects(f.page.submitVacancy(f.submit),/retained.*unpublished/);
  assert.equal(f.page.state.vacancySelection.preview,null);assert.equal(f.nodes.get('vacancy-preview').hidden,true);assert.equal(f.map.size,0);
  assert.equal(f.calls.some(r=>r.path===f.data.route),false);assert.equal(f.page.vacancyEls.vacancy_submit.textContent,'Review affected vacancy plan');
 }
 const f=await vacancyPageFixture();await f.page.submitVacancy(f.submit);
 assert.match(f.page.vacancyEls.vacancy_state.textContent,/Unsubmitted reviewed candidate retained privately; not published/);
 assert.match(f.page.vacancyEls.vacancy_state.textContent,/No roster, people\/history, source or projection change has been accepted/);
 const previewRequest=f.calls.find(r=>r.path===f.data.route+'/preview').o.body;let confirms=0;f.context.confirmAction=async()=>{confirms++;return true;};
 await f.page.submitVacancy(f.submit);const acceptedRequest=f.calls.find(r=>r.path===f.data.route).o.body;
 assert.deepEqual(JSON.parse(acceptedRequest),{...JSON.parse(previewRequest),preview_digest:f.data.preview.previewDigest});assert.equal(confirms,1);assert.equal(f.map.size,0);
});
test('vacancy retention consumer: retained page response still refuses stale original actor/source/day/revision across await',async()=>{
 for(const changed of ['actor','source','day','revision']){
  const f=await vacancyPageFixture();let release;f.setGate(new Promise(r=>release=r));const work=f.page.submitVacancy(f.submit);
  if(changed==='actor')f.patch({credential_id:SOURCE});if(changed==='source')f.page.vacancyEls.vacancy_source.value=PID;
  if(changed==='day')f.page.state.snapshot.current_service_date='2026-10-07';if(changed==='revision')f.page.state.snapshot.authority_revision++;
  release();await assert.rejects(work,/changed/);assert.equal(f.page.state.vacancySelection.preview,null);assert.equal(f.map.size,0);assert.equal(f.calls.some(r=>r.path===f.data.route),false);
 }
});
test('stable vacancy product: actual page uses server-day person, renders affected dated plan and confirms once after explicit review',async()=>{
 const f=await vacancyPageFixture();assert.match(f.page.vacancyEls.vacancy_current.textContent,/Actual Tuesday person/);assert.doesNotMatch(f.page.vacancyEls.vacancy_current.textContent,/Selected Monday person/);
 await f.page.submitVacancy(f.submit);assert.equal(f.calls.filter(r=>r.o.method==='POST').length,1);assert.equal(f.map.size,0);
 assert.equal(f.nodes.get('vacancy-preview').hidden,false);const work=f.nodes.get('vacancy-preview-work').children[0];assert.equal(work.children[0].textContent,'2026-10-06');assert.equal(work.children[1].textContent,'Actual affected duty <not HTML>');
 const rows=f.nodes.get('vacancy-preview-availability').children;assert.match(rows[0].children[3].textContent,/Unavailable \(not inferred\)/);assert.match(rows[1].children[1].textContent,/Wednesday person/);assert.match(rows[1].children[3].textContent,/270 min/);
 f.context.confirmAction=async()=>false;await f.page.submitVacancy(f.submit);assert.equal(f.map.size,0);assert.equal(f.calls.filter(r=>r.o.method==='POST').length,1);
 let confirmations=0;f.context.confirmAction=async()=>{confirmations++;return true;};await f.page.submitVacancy(f.submit);
 const writes=f.calls.filter(r=>r.o.method==='POST');assert.equal(writes.length,2);assert.equal(writes[1].path,f.data.route);assert.equal(confirmations,1);
 const before=JSON.parse(writes[0].o.body),confirmed=JSON.parse(writes[1].o.body);assert.equal(before.employee_id,MID);assert.equal(before.effective_start,'2026-10-06');
 assert.deepEqual(confirmed,{...before,preview_digest:f.data.preview.previewDigest});assert.equal(f.map.size,0);assert.equal(f.page.state.snapshot.authority_revision,44);
});
test('stable vacancy product: awaited preview drift refuses and missing witness reload recovers same original GET-only operation',async()=>{
 const drift=await vacancyPageFixture();let release;drift.setGate(new Promise(r=>release=r));const work=drift.page.submitVacancy(drift.submit);
 drift.page.state.snapshot.authority_revision=43;release();await assert.rejects(work,/changed/);assert.equal(drift.page.state.vacancySelection.preview,null);assert.equal(drift.map.size,0);
 const f=await vacancyPageFixture();await f.page.submitVacancy(f.submit);f.setMissing();f.context.confirmAction=async()=>true;await f.page.submitVacancy(f.submit);
 assert.equal(f.page.state.pending.state,'PENDING');const raw=f.storage.getItem([...f.map.keys()][0]);const before=f.calls.length;
 f.context.loadControlPlaneUrl=async()=> 'https://scheduler.onrender.com';await f.page.init();assert.equal(f.page.els.week_start.value,'2026-10-05');assert.equal(f.page.els.service_date.value,'2026-10-06');
 await assert.rejects(f.page.state.actions.retry(),/unconfirmed/);assert.ok(f.calls.slice(before).every(r=>r.o.method!=='POST'));assert.equal(f.storage.getItem([...f.map.keys()][0]),raw);
});
test('stable vacancy source DTO: capacity is an opaque source ID and capacity minutes come from same dated slot metric',async()=>{
 const f=await vacancyProductFixture(),row=f.preview.preview.assignments[0],availability=f.preview.preview.projectionAvailability[1];
 Object.assign(row,{status:'assigned',ownerSlotId:PID,ownerPersonId:null,ownerKind:'CONTRACTOR_CAPACITY',capacityId:'manual-capacity:2026-10-06'});
 Object.assign(availability,{ownerKind:'CONTRACTOR_CAPACITY',capacityId:'manual-capacity:2026-10-07',incumbentPersonId:null});delete availability.productiveCapacityMinutes;
 f.preview.preview.metrics={daily:[{dayOfWeek:3,loads:[{slotId:PID,productiveCapacityMinutes:255}]}]};
 await A.validateVacancyPreview(f.preview,f.request,f.binding);
 const page=pageFixture();page.page.renderVacancyPreview(f.preview);const rendered=page.nodes.get('vacancy-preview-availability').children;
 assert.match(rendered[1].children[3].textContent,/255 min \(source-planned\)/);assert.match(rendered[0].children[3].textContent,/Unavailable \(not inferred\)/);
 assert.match(page.nodes.get('vacancy-preview-work').children[0].children[2].textContent,/manual-capacity:2026-10-06/);
 const bad=structuredClone(f.preview);bad.preview.assignments[0].ownerPersonId=MID;await assert.rejects(A.validateVacancyPreview(bad,f.request,f.binding));
});
test('stable vacancy source DTO: privilege or review context changing during await leaves original work untouched',async()=>{
 const f=await vacancyProductFixture();let release,posts=0;const gate=new Promise(r=>release=r);
 const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async(_p,o)=>{if(o.method==='POST'){posts++;throw Error('lost');}await gate;return f.outcome;}});
 await assert.rejects(a.runVacancy(f.request,f.preview,f.binding));const saved=f.storage.getItem([...f.map.keys()][0]);const get=a.retry();
 f.patch({read_only:true});release();await assert.rejects(get,/access changed/);assert.equal(posts,1);assert.equal(f.storage.getItem([...f.map.keys()][0]),saved);
 const next=await vacancyProductFixture();let calls=0;const helper=A.create({auth:next.auth,storage:next.storage,baseUrl:'https://scheduler.onrender.com',api:async()=>{calls++;}});
 await assert.rejects(helper.runVacancy(next.request,next.preview,{...next.binding,assertCurrent:()=>{throw Error('review day changed');}}),/review day changed/);
 assert.equal(next.map.size,0);assert.equal(calls,0);
});
test('stable vacancy source DTO: legacy six-field saved projected operation without a reviewed witness stays GET-only PENDING',async()=>{
 const f=await vacancyProductFixture(),record={schema:'custodial.scheduler-pending.v1',base:'https://scheduler.onrender.com',managerId:MID,path:f.route,
  body:f.request,encoded:JSON.stringify(f.request),state:'PENDING',receipt:null,error:null};
 const key='mz_scheduler_dated_operation_v1:'+encodeURIComponent(record.base)+':'+MID;f.storage.setItem(key,JSON.stringify(record));const bytes=f.storage.getItem(key);let calls=0;
 const a=A.create({auth:f.auth,storage:f.storage,baseUrl:record.base,api:async(_p,o)=>{calls++;assert.equal(o.method,'GET');return f.outcome;}});
 await assert.rejects(a.retry(),/unconfirmed/);assert.equal(calls,1);assert.equal(a.pending().state,'PENDING');assert.equal(f.storage.getItem(key),bytes);
});
test('staffing recovery: lost response resumes by original readonly outcome without a second POST',async()=>{
 const f=await vacancyProductFixture();let writes=0,reads=0;
 const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async(path,options)=>{
  if(options.method==='POST'){writes++;throw Error('response lost');}reads++;assert.match(path,/original-vacancy\?operation=vacate_roster_slot$/);return f.outcome;}});
 await assert.rejects(a.runVacancy(f.request,f.preview,f.binding));const bytes=a.pending().encoded;await a.retry();await a.retry();
 assert.equal(writes,1);assert.equal(reads,1);assert.equal(a.pending().encoded,bytes);assert.equal(a.pending().state,'ACCEPTED');
 assert.equal(a.acknowledge(f.current),true);assert.equal(f.map.size,0);assert.equal(f.outcome.phone_released,false);
});
test('staffing recovery: denied read after a committed POST cannot classify original mutation as rejected',async()=>{
 const f=await vacancyProductFixture();let writes=0;
 const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async(path,options)=>{
  if(options.method==='POST'){writes++;return{revision:43};}throw Object.assign(Error('read denied'),{status:403,serverRejected:true});}});
 await assert.rejects(a.runVacancy(f.request,f.preview,f.binding));assert.equal(a.pending().state,'PENDING');assert.throws(()=>a.discardRejected());
 await assert.rejects(a.retry());assert.equal(writes,1);assert.equal(a.pending().state,'PENDING');
});
test('staffing recovery: missing foreign and changed-original outcomes preserve exact pending bytes',async()=>{
 for(const change of ['missing','actor','key','body','completion']){const f=await vacancyProductFixture();let writes=0;
  const bad=structuredClone(f.outcome);if(change==='missing')bad.state='OUTCOME_UNCONFIRMED';if(change==='actor')bad.manager_id=SOURCE;
  if(change==='key')bad.idempotency_key='foreign';if(change==='body')bad.original_request.reason='Changed reason';if(change==='completion')delete bad.receipt.data.completion_mode;
  const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async(path,options)=>{if(options.method==='POST'){writes++;throw Error('lost');}return bad;}});
  await assert.rejects(a.runVacancy(f.request,f.preview,f.binding));const bytes=a.pending().encoded;await assert.rejects(a.retry());assert.equal(a.pending().encoded,bytes);assert.equal(a.pending().state,'PENDING');assert.equal(writes,1);
 }
});
test('staffing recovery: source routes stay owner-only and unknown fields are not dispatched',async()=>{
 const f=staffingFixture();f.patch({read_only:true});await assert.rejects(f.create().run(f.route,f.request));assert.equal(f.calls.length,0);
 f.patch({read_only:false});await assert.rejects(f.create().run(f.route,{...f.request,employee_active:true}));assert.equal(f.calls.length,0);
 assert.equal(A.staffingOperation('/static-weekly/roster/not-a-slot/vacate'),null);
});
test('scheduler workflow: approved accepted-result recovery never resends after coordination failure',async()=>{
 for(const kind of ['initial','recurring']){const f=fixture();let sent=0;const receipt=approvedReceipt(kind);
  const a=P.create({managerId:MID,baseUrl:'https://scheduler.onrender.com',storage:f.storage,nonce:()=>CID,api:async()=>{sent++;throw Object.assign(Error('lease settlement pending'),{status:503,serverRejected:false,acceptedResult:receipt});}});
  const input=kind==='initial'?initial:{effective_start:initial.effective_start,expected_revision:initial.expected_revision};
  assert.deepEqual(await a.confirm(kind,preview,input),receipt);const bytes=a.pending().encoded;assert.equal(a.pending().coordination_pending,true);
  assert.deepEqual(await a.retry(),receipt);assert.equal(sent,1);assert.equal(a.pending().encoded,bytes);
  assert.throws(()=>a.acknowledge({...snapshot,latest_projection:{projection_id:CID}}));assert.equal(a.pending().acceptance.authority_revision,43);
  a.acknowledge(snapshot);assert.equal(a.pending(),null);assert.equal(sent,1);
 }
});
test('scheduler workflow: unbound acceptance remains pending and explicit approved rejection cannot be resent',async()=>{
 const f=fixture();f.patch({read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}});let sent=0,mode='unbound';const a=P.create({auth:f.auth,managerId:MID,baseUrl:'https://scheduler.onrender.com',storage:f.storage,nonce:()=>CID,api:async(_path,options)=>{sent++;if(mode==='unbound')throw Object.assign(Error('unbound result'),{status:503,acceptedResult:{...approvedReceipt(),previewDigest:'c'.repeat(64)}});assert.equal(options.method,'GET');throw Object.assign(Error('status read rejected'),{status:409,serverRejected:true,code:'40001'});}});
 await assert.rejects(a.confirm('initial',preview,initial));const encoded=a.pending().encoded;assert.equal(a.pending().acceptance,null);assert.throws(()=>a.discardRejected());
 mode='reject';await assert.rejects(a.retry());assert.equal(a.pending().state,'PENDING');assert.equal(a.pending().encoded,encoded);assert.equal(sent,2);
 assert.throws(()=>a.discardRejected());
 const rejected=fixture();let rejectedPosts=0;const rejectedClient=P.create({auth:rejected.auth,managerId:MID,baseUrl:'https://scheduler.onrender.com',storage:rejected.storage,nonce:()=>CID,api:async()=>{rejectedPosts++;throw Object.assign(Error('conclusive original rejection'),{status:409,serverRejected:true,code:'40001'});}});
 await assert.rejects(rejectedClient.confirm('initial',preview,initial));assert.equal(rejectedClient.pending().state,'REJECTED');await assert.rejects(rejectedClient.retry());assert.equal(rejectedPosts,1);
 const ui=pageFixture();ui.page.state.approvedPending=rejectedClient.pending();ui.page.setControls();assert.equal(ui.nodes.get('scheduler-retry').hidden,true);assert.equal(ui.nodes.get('scheduler-dismiss').disabled,false);
 rejectedClient.discardRejected();assert.equal(rejectedClient.pending(),null);assert.equal(a.pending().encoded,encoded);
});
test('scheduler workflow: print link binds visible revision and projection and withdraws while recovery is unresolved',()=>{
 const f=pageFixture();f.page.els.service_date.value='2026-10-06';f.page.state.snapshot=snapshot;f.page.setControls();
 const link=f.nodes.get('coverall-print-link'),url=new URL(link.href,'https://fixture.invalid');assert.equal(link.hidden,false);assert.equal(url.searchParams.get('expected_revision'),'43');assert.equal(url.searchParams.get('projection_id'),PID);
 f.page.state.approvedPending={acceptance:approvedReceipt()};f.page.setControls();assert.equal(link.hidden,true);
 f.page.state.approvedPending=null;f.page.state.snapshot={...snapshot,projection_status:'stale_staffing_change'};f.page.setControls();assert.equal(link.hidden,true);
 f.page.state.snapshot=snapshot;f.page.els.service_date.value='2026-10-13';f.page.setControls();assert.equal(link.hidden,true);
});
test('scheduler workflow: dismissing rejected preview forces a new review even at the same revision',async()=>{
 const f=pageFixture();f.page.state.snapshot={week_start:'2026-10-05',authority_revision:42};f.page.state.preview={kind:'initial',input:initial,preview};f.page.state.approvedPending={state:'REJECTED'};let discarded=0,dated=0;
 f.page.state.approved={discardRejected:()=>{discarded++;f.page.state.approvedPending=null;}};f.page.state.actions={discardRejected:()=>{dated++;}};
 const source=fs.readFileSync(new URL('../schedule-weekly.js',import.meta.url),'utf8'),inline=source.match(/'scheduler-dismiss'\)\.addEventListener\('click',\(\)=>busy\((async\(\)=>\{.*?\})\)\);/)?.[1];
 vm.runInContext(`refreshSnapshot=async()=>{};globalThis.dismissFromSource=typeof dismissRejectedScheduleRequest==='function'?dismissRejectedScheduleRequest:${inline||'undefined'};`,f.context);
 await f.context.dismissFromSource();assert.equal(discarded,1);assert.equal(dated,0);assert.equal(f.page.state.preview,null);assert.equal(f.nodes.get('approved-preview-panel').hidden,true);
});
test('scheduler workflow: roster form keeps unknown departure/replacement requests for exact owner-only resume',async()=>{
 for(const mode of ['departed','replace']){const f=pageFixture();f.page.state.snapshot={...snapshot,authority_revision:42,week_end:'2026-10-11',current_service_date:'2026-10-05',roster:[{slot_id:CID,week_staffing:[{service_date:'2026-10-05',person_id:MID,person_name:'Current incumbent'}]}]};f.page.els.service_date.value='2026-10-05';f.page.els.turnover_dialog.showModal=()=>{};f.page.els.turnover_dialog.close=()=>{};
  f.page.state.actions=A.create({auth:f.auth,api:f.api,baseUrl:'https://scheduler.onrender.com',storage:f.storage,onState:r=>f.page.state.pending=r});let refreshed=0;
  f.context.api=f.api;f.context.refreshCount=()=>refreshed++;f.context.crypto={randomUUID:()=>CID};vm.runInContext('busy=async(work)=>work();refreshSnapshot=async()=>refreshCount();globalThis.openFromSource=openTurnoverDialog;globalThis.submitFromSource=submitTurnover;',f.context);
  f.context.openFromSource({target:{closest:()=>({dataset:{turnoverSlot:CID,turnoverMode:mode}})}});f.page.els.replacement_name.value='New dated incumbent';
  f.setMode('offline');await assert.rejects(f.context.submitFromSource({preventDefault(){}}));const saved=f.page.state.actions.pending();assert.equal(saved?.state,'PENDING');assert.equal(refreshed,0);
  assert.equal(saved.path,mode==='replace'?'/static-weekly/employees/replacements':'/static-weekly/employees/departed');assert.equal(saved.body.slot_id,CID);assert.equal(saved.body.expected_revision,42);if(mode==='replace')assert.equal(saved.body.new_employee_name,'New dated incumbent');
  f.setMode('accept');await f.page.state.actions.retry();assert.equal(f.calls[0].options.body,f.calls[1].options.body);assert.equal(f.page.state.actions.acknowledge(snapshot),true);
  const delegate=fixture();await assert.rejects(delegate.create().run(saved.path,saved.body),/not authorized/);assert.equal(delegate.calls.length,0);
 }
});
test('scheduler workflow: roster confirmation refuses a dialog bound to an older revision or another dated employee',async()=>{
 for(const change of ['revision','person']){const f=pageFixture();f.page.state.snapshot={...snapshot,authority_revision:42,week_end:'2026-10-11',current_service_date:'2026-10-05',roster:[{slot_id:CID,week_staffing:[{service_date:'2026-10-05',person_id:MID,person_name:'Monday incumbent'},{service_date:'2026-10-06',person_id:SOURCE,person_name:'Tuesday incumbent'}]}]};f.page.els.service_date.value='2026-10-06';f.page.els.turnover_dialog.showModal=()=>{};f.page.els.turnover_dialog.close=()=>{};
  let sent=0;f.page.state.actions={run:async()=>{sent++;}};f.context.crypto={randomUUID:()=>CID};vm.runInContext('busy=async(work)=>work();refreshSnapshot=async()=>{};globalThis.openFromSource=openTurnoverDialog;globalThis.submitFromSource=submitTurnover;',f.context);
  f.context.openFromSource({target:{closest:()=>({dataset:{turnoverSlot:CID,turnoverMode:'departed'}})}});assert.equal(f.page.els.turnover_current.textContent,'Monday incumbent');
  if(change==='revision')f.page.state.snapshot.authority_revision=43;else f.page.state.snapshot.roster[0].week_staffing[0].person_id=SOURCE;
  await assert.rejects(f.context.submitFromSource({preventDefault(){}}),/staffing record changed/);assert.equal(sent,0);
 }
});

// Existing source-only DOM seam, extended for the owning print controller.
// Actual SHA-256/file verification runs; fixture HTTP is not real SQL/browser.
async function printFixture({entryRevision=43,readbackRevision=43,corrupt=false,pin=true,denied=false,search=null,documentPatch={},readbackPatch={},distinctLanguages=false}={}){
 const nodes=new Map(),requests=[],created=[],revoked=[],events=new Map(),blobs=[];let reads=0;
 const node=()=>({value:'',hidden:true,disabled:true,textContent:'',children:[],listeners:new Map(),append(x){this.children.push(x);},replaceChildren(){this.children=[];},addEventListener(name,fn){this.listeners.set(name,fn);},removeEventListener(name,fn){if(this.listeners.get(name)===fn)this.listeners.delete(name);}});
 const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
 const f=fixture();f.auth.opsManagerAuthHeaders=async()=>({Authorization:'fixture only'});f.auth.requireOpsManagerSession=async()=>{};f.auth.getCSTDateString=()=> '2026-10-06';
 const bytes=Buffer.from('%PDF synthetic route fixture'),hash=v=>createHash('sha256').update(v).digest('hex'),text='Synthetic English / Español route',docHash='d'.repeat(64);
 class PrintURL extends URL{static createObjectURL(blob){const url='blob:fixture-'+created.length;created.push(url);blobs.push(blob);return url;}static revokeObjectURL(url){revoked.push(url);}}
 const context=vm.createContext({document,MemphisAuth:f.auth,MemphisSchedulerActions:A,URL:PrintURL,URLSearchParams,AbortController,setTimeout,clearTimeout,AbortSignal,Blob,TextEncoder,Uint8Array,crypto:webcrypto,atob:value=>Buffer.from(value,'base64').toString('binary'),location:{search:search??('?date=2026-10-06'+(pin?'&expected_revision=43&projection_id='+PID:''))},addEventListener:(name,fn)=>events.set(name,fn),setInterval:()=>1,clearInterval:()=>{},fetch:async value=>{
  const url=new URL(value);requests.push(url);let data;
  if(url.pathname==='/scheduler-runtime-config')data={public_url:'https://scheduler.onrender.com'};
  else if(url.pathname==='/static-weekly/manager-snapshot'){reads++;if(denied)return{ok:false,status:403,json:async()=>({ok:false,error:'Current manager access denied'})};data={...snapshot,latest_projection:{...snapshot.latest_projection,replay_digest:'a'.repeat(64)},authority_revision:reads===1?entryRevision:readbackRevision,...(reads>1?readbackPatch:{})};}
  else if(url.pathname==='/static-weekly/coverall-print'){const revision=Number(url.searchParams.get('expected_revision'));const files=['en','es','en-es'].map(language=>{const content=distinctLanguages?Buffer.from('%PDF synthetic '+language+' route fixture'):bytes;return{language,filename:`CoverAll_2026-10-06_r${revision}_${language}.pdf`,sha256:corrupt?'e'.repeat(64):hash(content),base64:content.toString('base64')};});data={schema:'custodial.coverall-pdf-pair.v1',document:{serviceDate:'2026-10-06',authorityRevision:revision,publicationId:SOURCE,replayDigest:'a'.repeat(64),projectionId:PID,managerContact:{managerId:MID},documentDigest:docHash,contractors:[{name:'Manual CoverAll'}],...documentPatch},files:files.slice(0,2),bilingualFile:files[2],texts:[{language:'en-es',documentDigest:docHash,text,sha256:hash(text)}]};}
  else throw Error('Unexpected fixture route '+url.pathname);
  return{ok:true,json:async()=>({ok:true,data})};
 }});
 // Return the existing event's promise for the bounded Node seam; the DOM
 // ignores handler return values. No test-only product export is introduced.
 const originalSource=fs.readFileSync(new URL('../coverall-print.js',import.meta.url),'utf8');
 const prepareSeam='()=>void prepare()',initSeam='void init().catch(';
 assert.equal(originalSource.split(prepareSeam).length,2,'Exact prepare return seam must remain unique');
 assert.equal(originalSource.split(initSeam).length,2,'Exact once-only init promise seam must remain unique');
 const source=originalSource.replace(prepareSeam,'()=>prepare()').replace(initSeam,'globalThis.fixtureInit = init().catch(');
 // Preserve the complete actual init/catch body and all refusal/currentness
 // guards. Capture only its original promise; never call init a second time.
 vm.runInContext(source,context);await context.fixtureInit;
 return{nodes,requests,created,revoked,events,blobs,prepare:()=>nodes.get('prepare').listeners.get('click')()};
}
test('scheduler workflow: pinned PDFs refuse changed entry or verification-time revision before issuing links',{timeout:2000},async()=>{
 for(const options of [{entryRevision:44},{readbackRevision:44}]){const f=await printFixture(options);await f.prepare();assert.equal(f.created.length,0);assert.equal(f.nodes.get('downloads').hidden,true);assert.match(f.nodes.get('status').textContent,/schedule changed/i);}
});
test('scheduler workflow: exact pinned PDF pair exposes only verified languages and clears on date/page exit',{timeout:2000},async()=>{
 const f=await printFixture();await f.prepare();assert.equal(f.created.length,3);assert.equal(f.nodes.get('downloads').hidden,false);
 assert.deepEqual(f.nodes.get('downloads').children.map(link=>link.download),['en','es','en-es'].map(language=>`CoverAll_2026-10-06_r43_${language}.pdf`));assert.equal(f.requests.filter(url=>url.pathname==='/static-weekly/manager-snapshot').length,2);assert.match(f.nodes.get('status').textContent,/revision 43/);
 f.nodes.get('date').value='2026-10-07';f.nodes.get('date').listeners.get('change')();assert.equal(f.nodes.get('downloads').hidden,true);assert.equal(f.revoked.length,3);f.events.get('pagehide')();assert.equal(f.nodes.get('copy-text').textContent,'');
 const broken=await printFixture({corrupt:true});await broken.prepare();assert.equal(broken.created.length,0);assert.match(broken.nodes.get('status').textContent,/verification failed/);
});
test('scheduler workflow: print permission denial latches and prevents any further request in this page',{timeout:2000},async()=>{
 const f=await printFixture({denied:true});await f.prepare();assert.equal(f.nodes.get('prepare').disabled,true);assert.equal(f.created.length,0);const requests=f.requests.length;
 await f.prepare();assert.equal(f.requests.length,requests);assert.equal(f.nodes.get('downloads').hidden,true);
});

test('contractor source binding: different publication cannot issue an otherwise matching dated pair',{timeout:2000},async()=>{
 const f=await printFixture({documentPatch:{publicationId:CID}});await f.prepare();assert.equal(f.created.length,0);assert.equal(f.nodes.get('downloads').hidden,true);assert.match(f.nodes.get('status').textContent,/accepted.*source|source.*accepted/i);
});
test('contractor source binding: different replay cannot issue an otherwise matching dated pair',{timeout:2000},async()=>{
 const f=await printFixture({documentPatch:{replayDigest:'b'.repeat(64)}});await f.prepare();assert.equal(f.created.length,0);assert.equal(f.nodes.get('copy-section').hidden,true);assert.match(f.nodes.get('status').textContent,/accepted.*source|source.*accepted/i);
});
test('contractor source binding: same revision and projection with changed replay during verification withdraws the whole pair',{timeout:2000},async()=>{
 const f=await printFixture({readbackPatch:{latest_projection:{projection_id:PID,replay_digest:'b'.repeat(64)}}});await f.prepare();assert.equal(f.created.length,0);assert.equal(f.nodes.get('downloads').hidden,true);assert.match(f.nodes.get('status').textContent,/schedule changed/i);
});
for(const dateQuery of ['', 'date=&'])test('contractor source binding: pinned '+(dateQuery?'empty':'missing')+' date cannot silently select today',{timeout:2000},async()=>{
 const f=await printFixture({search:'?'+dateQuery+'expected_revision=43&projection_id='+PID});assert.equal(f.nodes.get('prepare').disabled,true);assert.equal(f.nodes.get('prepare').listeners.has('click'),false);assert.equal(f.requests.filter(url=>url.pathname.startsWith('/static-weekly/')).length,0);assert.match(f.nodes.get('status').textContent,/service date|schedule identity/i);
});
test('contractor source binding: current explicit dated selection issues distinct verified EN and ES bytes from one accepted source',{timeout:2000},async()=>{
 const f=await printFixture({distinctLanguages:true});await f.prepare();assert.equal(f.created.length,3);assert.equal(f.nodes.get('downloads').hidden,false);assert.deepEqual(await Promise.all(f.blobs.map(blob=>blob.text())),['en','es','en-es'].map(language=>'%PDF synthetic '+language+' route fixture'));
 assert.deepEqual(f.nodes.get('downloads').children.map(link=>link.download),['en','es','en-es'].map(language=>`CoverAll_2026-10-06_r43_${language}.pdf`));
 const reads=f.requests.filter(url=>url.pathname==='/static-weekly/manager-snapshot');assert.equal(reads.length,2);assert.ok(reads.every(url=>url.searchParams.get('week_start')==='2026-10-05'));
 const query=f.requests.find(url=>url.pathname==='/static-weekly/coverall-print').searchParams;assert.equal(query.get('service_date'),'2026-10-06');assert.equal(query.get('expected_revision'),'43');assert.equal(query.get('projection_id'),PID);assert.equal(f.requests.some(url=>url.pathname.includes('confirm')),false);
});
