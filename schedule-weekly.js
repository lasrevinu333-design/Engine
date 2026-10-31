const CONFIG={BOOTSTRAP_URL:`${window.MemphisAuth?.backendOrigin || 'https://memphis-zoo-mcp.onrender.com'}/scheduler-runtime-config`,DEVICE_KEY:'mz_scan_device_id'};
const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const els=Object.fromEntries(['refresh-btn','rebuild-projection-btn','generate-btn','publish-btn','apply-day-btn','week-start','service-date','absence-type','status','subtitle','working-count','absent-count','open-count','revision-count','roster-list','baseline-absences','temporary-absences','contractor-slots','week-title','week-meta','week-head','week-body','changes-list','readiness-list','turnover-dialog','turnover-form','turnover-title','turnover-current','turnover-slot','turnover-mode','replacement-name-field','replacement-name','turnover-effective-date','turnover-reason','turnover-close','turnover-cancel','turnover-submit','turnover-submit-label','action-confirm-dialog','action-confirm-title','action-confirm-message','action-confirm-cancel','action-confirm-accept'].map((id)=>[id.replaceAll('-','_'),document.getElementById(id)]));
const state={baseUrl:'',snapshot:null,busy:false,accessDenied:false,pending:null,actions:null,principal:null,approved:null,approvedPending:null,manualActivationPanel:null,manualPending:null,manualBusy:false,coverallSelection:null,preview:null,staffingPreview:null,unresolvedPreview:null,approvedChoices:null,initialSelection:null,previewSelection:0};
const unresolvedPreviewFailures=new WeakMap();
const missingStaffingPatternCode='static_template_missing_approved_pattern';
const missingStaffingPatternMessage='No release-admitted approved pattern matches the current staffing. The original request is preserved; nothing was accepted.';
let explicitStaffingRetryContext=null;
let unpublishedCancellationContext=null;
const vacancyEls=Object.fromEntries(['vacancy-dialog','vacancy-form','vacancy-current','vacancy-source','vacancy-source-facts','vacancy-state','vacancy-current-duties','vacancy-reason','vacancy-close','vacancy-cancel','vacancy-submit'].map(id=>[id.replaceAll('-','_'),document.getElementById(id)]));
state.vacancySelection=null;let vacancyControlsBound=false;
const schedulerPermissions=()=>state.accessDenied?{read:false,owner:false,management:false,managementAdmin:false,absences:false,coverall:false,routes:false,closeScanTickets:false}:window.MemphisSchedulerActions.permissions(window.MemphisAuth);
function requireSchedulerPermission(kind){if(!schedulerPermissions()[kind])throw new Error('This action is not available for your manager session.');}
init().catch((error)=>setStatus(`Scheduler unavailable: ${safe(error)}`,'error'));
// Load this manager's original recovery even after owner capability is revoked;
// new preview/confirmation still requires owner, and unknown outcomes cannot resume without it.
async function init(){window.lucide?.createIcons?.();await window.MemphisAuth.requireOpsManagerSession({interactive:false,redirect:true,throwOnFailure:true});const params=new URLSearchParams(location.search);const requested=validCivilDate(params.has('date')?params.get('date'):params.has('week_start')?params.get('week_start'):window.MemphisAuth.getCSTDateString());const week=mondayOf(params.has('week_start')?params.get('week_start'):requested);if(mondayOf(requested)!==week)throw new Error('The service date must be inside the selected week.');els.week_start.value=week;els.service_date.value=requested;els.refresh_btn.addEventListener('click',loadSnapshot);els.rebuild_projection_btn.addEventListener('click',()=>rebuildCurrentProjection().catch(e=>setStatus(safe(e),'error')));els.generate_btn.addEventListener('click',()=>generateDraft().catch(e=>setStatus(safe(e),'error')));els.publish_btn.addEventListener('click',()=>publishDraft().catch(e=>setStatus(safe(e),'error')));els.apply_day_btn.addEventListener('click',()=>applyDayChanges().catch(e=>setStatus(safe(e),'error')));els.changes_list.addEventListener('click',e=>reverseChange(e).catch(error=>setStatus(safe(error),'error')));els.roster_list.addEventListener('click',e=>{try{openTurnoverDialog(e);}catch(error){setStatus(safe(error),'error');}});els.turnover_form.addEventListener('submit',e=>submitTurnover(e).catch(error=>setStatus(safe(error),'error')));els.turnover_close.addEventListener('click',closeTurnoverDialog);els.turnover_cancel.addEventListener('click',closeTurnoverDialog);els.week_start.addEventListener('change',()=>{invalidateApprovedPreview();try{els.week_start.value=mondayOf(els.week_start.value);if(mondayOf(els.service_date.value)!==els.week_start.value)els.service_date.value=els.week_start.value;loadSnapshot();}catch(error){setStatus(safe(error),'error');setControls();}});els.service_date.addEventListener('change',()=>{invalidateApprovedPreview();try{selectedServiceDate();if(state.snapshot)render();}catch(error){setStatus(safe(error),'error');setControls();}});document.querySelectorAll('[data-view]').forEach((button)=>button.addEventListener('click',()=>selectView(button.dataset.view)));window.addEventListener('hashchange',applyHashRoute);state.baseUrl=await loadControlPlaneUrl();state.principal=window.MemphisSchedulerActions.principal(window.MemphisAuth);state.actions=window.MemphisSchedulerActions.create({auth:window.MemphisAuth,api,baseUrl:state.baseUrl,onState:r=>{state.pending=r;renderPending();}});state.actions.pending();state.approved=window.MemphisApprovedSchedule.create({api,auth:window.MemphisAuth,managerId:state.principal.managerId,baseUrl:state.baseUrl,onState:r=>{state.approvedPending=r;renderPending();}});state.approved.pending();state.manualActivationPanel=window.MemphisApprovedSchedule.mountManualActivation({container:document.getElementById('approved-source-panel').parentNode,before:document.getElementById('approved-source-panel'),api,auth:window.MemphisAuth,managerId:state.principal.managerId,baseUrl:state.baseUrl,otherPending:()=>state.busy||state.accessDenied||!!state.pending||!!state.approvedPending,available:()=>!state.accessDenied,onState:r=>{state.manualPending=r;setControls();},onBusy:value=>{state.manualBusy=value;setControls();},onAccepted:async()=>{await refreshSnapshot();return state.snapshot;}});if([state.pending,state.approvedPending,state.manualPending].filter(Boolean).length>1)throw new Error('Two saved scheduler operations require manager recovery. Neither request was changed.');const saved=state.pending||state.approvedPending;if(saved){const staffing=window.MemphisSchedulerActions.isStaffingCommand(saved);const rosterOriginal=state.pending&&window.MemphisSchedulerActions.staffingOperation(saved.path);const week=staffing?saved.weekStart:rosterOriginal?mondayOf(saved.body.effective_start):state.pending?saved.body.week_start:saved.body.effective_start;const date=staffing?saved.body.start_date:rosterOriginal?saved.body.effective_start:state.pending?(saved.body.service_date||week):week;if(typeof week!=='string'||mondayOf(week)!==week||mondayOf(validCivilDate(date))!==week)throw new Error('Saved scheduler dates cannot be verified. The request remains preserved.');els.week_start.value=week;els.service_date.value=date;}document.getElementById('approved-source').addEventListener('change',invalidateApprovedPreview);document.getElementById('scheduler-retry').addEventListener('click',()=>busy(async()=>{if(window.MemphisSchedulerActions.isStaffingCommand(state.pending)){await resumeStaffingPreview();return;}if(state.approvedPending)await state.approved.retry();else await state.actions.retry();await refreshSnapshot();}));document.getElementById('scheduler-dismiss').addEventListener('click',()=>busy(dismissRejectedScheduleRequest));try{await state.manualActivationPanel.load();}catch(error){document.querySelector('#manual-activation-panel [role=status]')?.replaceChildren(document.createTextNode(safe(error)));}await loadSnapshot();applyHashRoute();const guard=setInterval(()=>{if(!window.MemphisSchedulerActions.same(state.principal,window.MemphisSchedulerActions.principal(window.MemphisAuth))){clearInterval(guard);withdrawSchedulerAccess();setStatus('Manager access changed. Reload the scheduler; saved requests are preserved.','error');setControls();}},1000);window.addEventListener('pagehide',()=>clearInterval(guard),{once:true});}
async function loadControlPlaneUrl(){const response=await fetch(CONFIG.BOOTSTRAP_URL,{cache:'no-store'});const payload=await response.json().catch(()=>null);const url=String(payload?.data?.public_url||'').replace(/\/+$/,'');const taskPreview=url===window.MemphisAuth?.backendOrigin&&/^http:\/\/(custodian-g12-manager\.localhost|custodian-g12-employee\.localhost)(:\d+)?$/.test(url);if(!response.ok||!payload?.ok||!/^https:\/\//i.test(url)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)&&!taskPreview)throw new Error(payload?.error||'Weekly scheduler service is not configured.');return url;}
async function api(path,options={}){
 const expected=state.principal||window.MemphisSchedulerActions.principal(window.MemphisAuth);
 const unresolvedBinding=captureUnresolvedPreviewRequest(path,options,expected);
 const cancellationBinding=captureUnpublishedCancellationRequest(path,options);
 const preparationBinding=options.method==='POST'&&options.body==='{}'&&window.MemphisSchedulerActions.isStaffingCommand(state.pending)
  &&path===window.MemphisSchedulerActions.staffingCommandPath+'/'+state.pending.command.operationId+'/prepare'
  ?{context:staffingContext(),actions:state.actions,record:JSON.stringify(state.actions.pending())}:null;
 const requirePreparationCurrent=()=>{if(preparationBinding){requireStaffingContext(preparationBinding.context);
  if(explicitStaffingRetryContext)requireStaffingContext(explicitStaffingRetryContext);
  if(state.actions!==preparationBinding.actions||JSON.stringify(state.actions.pending())!==preparationBinding.record)
   throw new Error('The original staffing preparation changed. Nothing new was accepted.');}};
 const auth=await window.MemphisAuth.opsManagerAuthHeaders();
 if(!window.MemphisSchedulerActions.same(expected,window.MemphisSchedulerActions.principal(window.MemphisAuth))){withdrawSchedulerAccess();throw new Error('Manager access changed. Reload the scheduler.');}
 if(unresolvedBinding)requireUnresolvedPreviewCurrent(unresolvedBinding);
 if(cancellationBinding)requireUnpublishedCancellationRequest(cancellationBinding);
 requirePreparationCurrent();
 const {expectedManagerId, ...request}=options;
 if(expectedManagerId&&expectedManagerId!==expected.managerId)throw new Error('Saved request belongs to a different manager.');
 if(request.method==='POST'){
  const approved=Object.values(window.MemphisApprovedSchedule.paths).some(base=>path===base+'/preview'||path===base+'/confirm');
  const manual=path===window.MemphisApprovedSchedule.manualPath+'/preview'||path===window.MemphisApprovedSchedule.manualPath+'/confirm';
  if(state.manualPending&&!manual)throw new Error('Resolve the original approved activation outcome first. No dated request was sent.');
  if(approved||manual)requireSchedulerPermission('management');
  else if(!window.MemphisSchedulerActions.authorized(window.MemphisAuth,path,JSON.parse(request.body)))throw new Error('Scheduler capability changed before dispatch. The original saved request remains preserved.');
 }
 const response=await fetch(`${state.baseUrl}${path}`,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000),...request,headers:{'Content-Type':'application/json',...auth}});
 if(unresolvedBinding)requireUnresolvedPreviewCurrent(unresolvedBinding);
 if(cancellationBinding)requireUnpublishedCancellationRequest(cancellationBinding);
 requirePreparationCurrent();
 const payload=await response.json().catch(()=>null);
 if(!window.MemphisSchedulerActions.same(expected,window.MemphisSchedulerActions.principal(window.MemphisAuth))){withdrawSchedulerAccess();throw new Error('Manager access changed before the response was verified.');}
 if(unresolvedBinding)requireUnresolvedPreviewCurrent(unresolvedBinding);
 if(cancellationBinding)requireUnpublishedCancellationRequest(cancellationBinding);
 requirePreparationCurrent();
 if(payload?.code===missingStaffingPatternCode){
  if(!preparationBinding||response.status!==409||response.ok||payload.ok!==false
   ||payload.operation_outcome!=='rejected'||payload.error!==missingStaffingPatternMessage
   ||Object.keys(payload).sort().join(',')!=='code,error,ok,operation_outcome')
   throw new Error('The original preparation dependency response is unverified. Original work remains saved.');
  const failure=new Error(missingStaffingPatternMessage);failure.status=409;failure.code=missingStaffingPatternCode;
  failure.serverRejected=true;failure.operationOutcome='rejected';throw failure;
 }
 const unresolvedError=[409,422].includes(response.status)&&payload?.ok===false&&payload.code==='static_template_dated_coverage_unresolved';
 const unresolvedData=response.ok&&response.status===200&&payload?.ok===true&&payload.data?.schema==='custodial.approved-static-unresolved-preview.v1';
 if(unresolvedError||unresolvedData){
  if(!unresolvedBinding||(unresolvedError?payload.operation_outcome!==undefined&&payload.operation_outcome!=='rejected':payload.operation_outcome!==undefined)||payload.accepted_result!==undefined)
   throw new Error('The unresolved preview has no current original request binding. Nothing can be confirmed.');
  const value=window.MemphisApprovedSchedule.validateUnresolvedPreview(unresolvedData?payload.data:payload.unresolved_preview,unresolvedBinding.expected);
  requireUnresolvedPreviewCurrent(unresolvedBinding);
  const failure=new Error('Coverage remains unresolved. Review the uncovered windows; nothing can be confirmed.');
  failure.status=response.status;failure.code='static_template_dated_coverage_unresolved';failure.serverRejected=unresolvedError;
  unresolvedPreviewFailures.set(failure,{value,binding:unresolvedBinding});throw failure;
 }
 if(!response.ok||!payload?.ok){if(response.status===401||response.status===403)withdrawSchedulerAccess();const nativeCoverage=preparationBinding&&payload?.code==='approved_manual_dated_coverage_unresolved';const error=new Error(nativeCoverage?'Complete dated coverage could not be prepared. The original request is saved; nothing can be confirmed. Review the actual staffing and coverage before retrying preparation.':payload?.error||`Scheduler request failed (${response.status})`);error.status=response.status;error.code=payload?.code;error.serverRejected=payload?.ok===false&&payload?.operation_outcome!=='unknown'&&payload?.operation_outcome!=='accepted';if(payload?.operation_outcome==='accepted')error.acceptedResult=payload.accepted_result;throw error;}return payload.data;
}
function confirmAction(message,{title='Confirm change',confirmLabel='Continue'}={}){if(els.action_confirm_dialog.open)return Promise.resolve(false);els.action_confirm_title.textContent=title;els.action_confirm_message.textContent=message;els.action_confirm_accept.textContent=confirmLabel;els.action_confirm_dialog.returnValue='';return new Promise((resolve)=>{els.action_confirm_dialog.addEventListener('close',()=>resolve(els.action_confirm_dialog.returnValue==='confirm'),{once:true});els.action_confirm_dialog.showModal();els.action_confirm_accept.focus();});}
async function refreshSnapshot(){
 const originalPrincipal=state.principal||window.MemphisSchedulerActions.principal(window.MemphisAuth),originalActions=state.actions;
 const requireOriginalRead=()=>{
  if(!schedulerPermissions().read||state.actions!==originalActions
   ||!window.MemphisSchedulerActions.same(originalPrincipal,window.MemphisSchedulerActions.principal(window.MemphisAuth))
   ||state.principal&&!window.MemphisSchedulerActions.same(originalPrincipal,state.principal)){
   withdrawSchedulerAccess();throw new Error('Manager access changed before current schedule publication. Saved requests remain preserved.');
  }
 };
 requireOriginalRead();
 invalidateApprovedPreview();
 const requestedWeek=els.week_start.value,arrival=state.previewSelection;
 const currentArrival=()=>state.previewSelection===arrival&&els.week_start.value===requestedWeek;
 setStatus(`Loading week of ${requestedWeek}...`);
 let entry;
 try{entry=await window.MemphisApprovedSchedule.loadInitialEntry({api,weekStart:requestedWeek,owner:schedulerPermissions().management});}
 catch(error){requireOriginalRead();if(!currentArrival())return;throw error;}
 requireOriginalRead();
 if(!currentArrival())return;
 if(entry.mode==='selection'){
  state.snapshot=null;state.initialSelection=entry.metadata;state.preview=null;state.accessDenied=false;
  els.service_date.min=entry.metadata.week_start;els.service_date.max=entry.metadata.week_end;
  state.approvedChoices=entry.metadata;populateApprovedChoices(entry.metadata,true);renderInitialSelection();renderApprovedPreview();renderPending();setControls();
  try{await state.manualActivationPanel?.load();}catch(error){document.querySelector('#manual-activation-panel [role=status]')?.replaceChildren(document.createTextNode(safe(error)));}requireOriginalRead();setStatus('No baseline is published for this week. Select an approved initial pattern, then review its preview.','');return;
 }
 const received=entry.snapshot;
 if(!window.MemphisApprovedSchedule.validSnapshotWindow(received,requestedWeek)||!Number.isSafeInteger(received.authority_revision)||(state.snapshot?.week_start===received.week_start&&received.authority_revision<state.snapshot.authority_revision))throw new Error('The returned schedule does not match the requested current week and revision.');
 state.initialSelection=null;state.snapshot=received;state.accessDenied=false;
 document.querySelector('.workspace').hidden=false;document.querySelector('.summary').hidden=false;document.querySelector('.main').hidden=false;
 document.querySelectorAll('.sidebarSection').forEach(e=>e.hidden=false);document.getElementById('day-changes-section').hidden=false;
 if(els.service_date.value<state.snapshot.week_start||els.service_date.value>state.snapshot.week_end)els.service_date.value=state.snapshot.week_start;
 els.service_date.min=state.snapshot.week_start;els.service_date.max=state.snapshot.week_end;
 if(state.preview?.input.expected_revision!==state.snapshot.authority_revision)state.preview=null;
 await loadApprovedChoices(requestedWeek,arrival);requireOriginalRead();if(!currentArrival())return;
 try{await state.manualActivationPanel?.load();}catch(error){document.querySelector('#manual-activation-panel [role=status]')?.replaceChildren(document.createTextNode(safe(error)));}requireOriginalRead();if(!currentArrival())return;
 let recoveryHeld=false;
 try{state.actions?.acknowledge(state.snapshot);}catch{requireOriginalRead();recoveryHeld=true;}
 if(state.approvedPending?.acceptance){try{state.approved.acknowledge(state.snapshot);}catch{requireOriginalRead();recoveryHeld=true;}}
 render();renderApprovedPreview();renderPending();setStatus(`Loaded ${state.snapshot.week_start} through ${state.snapshot.week_end}.${recoveryHeld?' The original saved request remains held for reconciliation.':''}`,recoveryHeld?'':'done');
}
function renderInitialSelection(){
 document.querySelector('.workspace').hidden=false;document.querySelector('.summary').hidden=true;document.querySelector('.main').hidden=true;
 document.querySelectorAll('.sidebarSection').forEach(e=>e.hidden=true);document.getElementById('day-changes-section').hidden=true;
 els.subtitle.textContent='Approved source selection only — no current schedule is fabricated.';
}

async function loadSnapshot(){return busy(refreshSnapshot);}
async function dismissRejectedScheduleRequest(){await refreshSnapshot();
 if(state.approvedPending){state.approved.discardRejected();state.preview=null;renderApprovedPreview();}
 else state.actions.discardRejected();
 renderPending();
}
async function generateDraft(){if(state.manualActivationPanel?.normalLocked())throw new Error('The approved normal source is active and locked. Use dated staffing actions.');requireSchedulerPermission('management');if(state.pending||state.approvedPending)throw new Error('Resolve the saved schedule request first.');const snapshot=state.snapshot||state.initialSelection;if(!snapshot)throw new Error('Load the weekly scheduler first.');
 const selectedId=document.getElementById('approved-source').value;const selectedInitial=state.approvedChoices?.initial?.find(r=>r.source_id===selectedId);const kind=selectedInitial?'initial':snapshot.current_publication?'recurring':'initial';let input={effective_start:snapshot.week_start,expected_revision:snapshot.authority_revision};
 if(kind==='initial'){const value=document.getElementById('approved-source').value,selected=state.approvedChoices?.initial?.find(r=>r.source_id===value&&r.effective_start===snapshot.week_start);if(!selected)throw new Error('Open the selected approved pattern’s listed effective week before previewing it. No replacement is invented.');input=state.initialSelection?window.MemphisApprovedSchedule.selectInitial({mode:'selection',metadata:state.initialSelection},value):{...input,source_id:selected.source_id,template_id:selected.template_id};}
 const context=approvedPreviewContext();
 await busy(async()=>{state.preview=null;renderApprovedPreview();setStatus('Reading the approved fixed pattern and checking current staffing...');const result=await api(window.MemphisApprovedSchedule.paths[kind]+'/preview',{method:'POST',body:JSON.stringify(input)});requireSchedulerPermission('management');requireCurrentPreviewContext(context);if(state.pending||state.approvedPending)throw new Error('The saved schedule request changed. Review the current preview again.');const preview=window.MemphisApprovedSchedule.validatePreview(kind,result,input,snapshot);state.preview={kind,input,preview,context};renderApprovedPreview();setStatus('Approved preview ready. Review the displayed duties before publishing.','done');});
}
function invalidateApprovedPreview(){state.previewSelection++;state.coverallSelection=null;const coverallPanel=document.getElementById('third-coverall-panel');if(coverallPanel)coverallPanel.hidden=true;state.preview=null;state.staffingPreview=null;state.unresolvedPreview=null;renderApprovedPreview();setControls();}
function approvedPreviewContext(){
 const snapshot=state.snapshot||state.initialSelection,date=selectedServiceDate();
 if(!snapshot||!window.MemphisApprovedSchedule.validSnapshotWindow(snapshot,els.week_start.value))throw new Error('Load the selected week before reviewing the current preview.');
 // Local equality binding only; server digest/CAS and signed-source authority remain unchanged.
 return{snapshot,selection:state.previewSelection,week:els.week_start.value,date,source:document.getElementById('approved-source').value,inputs:JSON.stringify([snapshot,state.approvedChoices])};
}
function requireCurrentPreviewContext(expected){
 const current=approvedPreviewContext();
 if(current.snapshot!==expected.snapshot||current.selection!==expected.selection||current.week!==expected.week||current.date!==expected.date||current.source!==expected.source||current.inputs!==expected.inputs)throw new Error('The reviewed date, pattern, staffing or revision changed. Review the current preview again.');
}
function originalStaffingSelectionIdentity(record){
 // Reading an already-saved original after reload does not require selecting
 // another employee in the new form. The encoded original remains bound by
 // the command owner, SQL semantic and publication/revision checks below.
 // If form controls ARE selected, retain the existing exact form binding;
 // switching between empty/selected during an await is also a changed view.
 const selected=document.querySelectorAll('[data-callout-slot]:checked:not(:disabled)').length
  +document.querySelectorAll('[data-contractor-slot]:checked:not(:disabled)').length;
 return JSON.stringify(selected?{mode:'LIVE_FORM',selection:dayChangeSelection()}:{mode:'SAVED_ORIGINAL_ONLY',encoded:record.encoded});
}
function captureUnresolvedPreviewRequest(path,options,principal){
 const base=window.MemphisSchedulerActions.staffingCommandPath;
 if(!(options.method==='GET'&&path.startsWith(base+'/')&&!path.endsWith('/confirm')
  ||options.method==='POST'&&path.endsWith('/prepare')&&options.body==='{}'))return null;
 const record=state.actions?.pending();
 if(!window.MemphisSchedulerActions.isStaffingCommand(record)||record.body.command_kind!=='absence'||record.body.start_date!==record.body.end_date
  ||record.state!=='PENDING'||record.command.phase!=='PREPARING'||record.command.confirmationAttempted||!record.command.operationId
  ||record.managerId!==principal?.managerId||state.approvedPending)return null;
 if(path!==base+'/'+record.command.operationId&&(path!==base+'/'+record.command.operationId+'/prepare'||options.method!=='POST'))return null;
 const context=approvedPreviewContext(),snapshot=state.snapshot;
 if(!snapshot||context.source!==''||context.date!==record.body.start_date||snapshot.authority_revision!==record.body.expected_revision
  ||snapshot.current_publication?.publication_id!==record.publicationId||snapshot.current_publication?.version_id!==record.versionId
  ||record.weekBindings?.length!==1||record.weekBindings[0].weekStart!==context.week
  ||record.weekBindings[0].publicationId!==record.publicationId||record.weekBindings[0].versionId!==record.versionId
  ||record.weekBindings[0].authorityRevision!==record.body.expected_revision)return null;
 requireSchedulerPermission('absences');
 return{context,principal,actions:state.actions,record:JSON.stringify(record),selection:originalStaffingSelectionIdentity(record),
  expected:{sourcePublicationId:record.publicationId,authorityRevision:record.body.expected_revision,serviceDate:record.body.start_date,kind:'DATED_ABSENCE',templateId:null}};
}
function requireUnresolvedPreviewCurrent(binding){
 if(!window.MemphisSchedulerActions.same(binding.principal,window.MemphisSchedulerActions.principal(window.MemphisAuth))
  ||state.principal&&!window.MemphisSchedulerActions.same(binding.principal,state.principal)){
  withdrawSchedulerAccess();throw new Error('Manager access changed during original preview readback. Saved requests remain preserved.');
 }
 requireSchedulerPermission('absences');requireCurrentPreviewContext(binding.context);
 if(state.actions!==binding.actions||state.approvedPending
  ||!window.MemphisSchedulerActions.same(binding.principal,window.MemphisSchedulerActions.principal(window.MemphisAuth))
  ||state.principal&&!window.MemphisSchedulerActions.same(binding.principal,state.principal)
  ||JSON.stringify(state.actions.pending())!==binding.record||originalStaffingSelectionIdentity(state.actions.pending())!==binding.selection)
  throw new Error('The original employee, manager, saved request or preview selection changed. Review the current original again.');
}
async function publishDraft(){if(state.manualActivationPanel?.normalLocked())throw new Error('The approved normal source is active and locked. Use dated staffing actions.');requireSchedulerPermission('management');if(state.pending||state.approvedPending)throw new Error('Resolve the saved schedule request first.');const choice=state.preview,snapshot=state.snapshot||state.initialSelection;
 if(state.unresolvedPreview)throw new Error('Coverage remains unresolved. Nothing can be confirmed.');
 if(!snapshot||!choice||choice.input.expected_revision!==snapshot.authority_revision||choice.input.effective_start!==snapshot.week_start)throw new Error('Preview the current approved pattern first.');
 if(choice.context)requireCurrentPreviewContext(choice.context);
 if(!await confirmAction(`Publish the reviewed approved pattern for ${snapshot.week_start}? This is a fixed approved schedule, not a newly optimized replacement.`,{title:'Publish approved pattern',confirmLabel:'Publish Reviewed Pattern'}))return;
 await busy(async()=>{requireSchedulerPermission('management');const current=state.snapshot||state.initialSelection;
  if(state.pending||state.approvedPending||state.preview!==choice||!current||choice.input.expected_revision!==current.authority_revision||choice.input.effective_start!==current.week_start||els.week_start.value!==choice.input.effective_start)throw new Error('The reviewed preview changed. Preview the current approved pattern again before publishing.');
  if(choice.context)requireCurrentPreviewContext(choice.context);
  await state.approved.confirm(choice.kind,choice.preview,choice.input);await refreshSnapshot();});
}
function datedReviewBinding(){
 if(state.pending||state.approvedPending)throw new Error('Resolve the saved schedule request first.');
 return{context:approvedPreviewContext(),principal:window.MemphisSchedulerActions.principal(window.MemphisAuth)};
}
function requireCurrentDatedReview(binding,permission){
 requireSchedulerPermission(permission);
 if(state.pending||state.approvedPending)throw new Error('The saved schedule request changed. Resolve it before reviewing another change.');
 if(!window.MemphisSchedulerActions.same(binding.principal,window.MemphisSchedulerActions.principal(window.MemphisAuth)))throw new Error('Manager access changed. Review the current schedule again.');
 requireCurrentPreviewContext(binding.context);
}
function dayChangeSelection(){requireSchedulerPermission('absences');const date=selectedServiceDate();
 const checked=[...document.querySelectorAll('[data-callout-slot]:checked:not(:disabled)')],contractors=[...document.querySelectorAll('[data-contractor-slot]:checked:not(:disabled)')];
 if(!checked.length&&!contractors.length)throw new Error('Select an absence, PTO entry, or CoverAll slot.');if(contractors.length)requireSchedulerPermission('coverall');
 const absenceType=els.absence_type.value==='pto'?'pto':'daily_absence';
 const operations=checked.map(input=>({operation:'exception',exception_type:absenceType,reason:absenceType==='pto'?'Manager recorded PTO':'Manager recorded absence',payload:{slotId:input.dataset.calloutSlot}}));
 for(const input of contractors){const row=input.closest('[data-contractor-row]'),slot=input.dataset.contractorSlot;
  const shift={start:row.querySelector('[data-shift-start]').value,end:row.querySelector('[data-shift-end]').value},choice=row.querySelector('[data-break-choice]').value;
  if(!window.MemphisSchedulerActions.coverAllWindow(shift))throw new Error('Enter the actual CoverAll shift.');
  const capacity={operation:'cover_all',slot_id:slot,shift,reason:'Manager added manual CoverAll coverage'};
  if(choice==='NONE'){capacity.breakChoice='NONE';operations.push(capacity);}else if(choice==='SCHEDULED'){
   const start=row.querySelector('[data-lunch-start]').value,end=row.querySelector('[data-lunch-end]').value,minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
   const validClock=t=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);
   if(!validClock(start)||!validClock(end)||minutes(end)-minutes(start)!==60||start<shift.start||end>shift.end)throw new Error('Enter the actual CoverAll lunch start and end inside its shift.');
   operations.push(capacity,{operation:'exception',exception_type:'lunch',starts_at:start,ends_at:end,reason:'Manager recorded actual CoverAll lunch',payload:{slotId:slot}});
  }else throw new Error('Choose the actual CoverAll break arrangement.');
 }
 const endDate=document.getElementById('absence-end-date')?.value||date;
 window.MemphisSchedulerActions.staffingWeeks(date,endDate);
 if(endDate!==date&&(checked.length!==1||contractors.length))throw new Error('A date window requires exactly one employee and no CoverAll batch. Nothing was shortened or sent.');
 return{date,endDate,operations,absenceCount:checked.length,contractorCount:contractors.length};
}
async function applyDayChanges(){requireSchedulerPermission('absences');const snapshot=needSnapshot(),publication=snapshot.current_publication;
 if(!publication)throw new Error('The approved weekly baseline must be published first.');
 const selection=dayChangeSelection(),binding=datedReviewBinding(),reviewed=JSON.stringify(selection);
 if(manualScheduleView(snapshot)&&selection.contractorCount)throw Error('Record the original third employee absence first, then use its source-bound CoverAll choice. Legacy CoverAll batches cannot replace a native accepted plan.');
 if(selection.absenceCount===1&&selection.contractorCount===0){
  await busy(async()=>{requireCurrentDatedReview(binding,'absences');
   const slot=selection.operations[0].payload.slotId,person=rosterForDate(snapshot,selection.date).find(row=>row.slot_id===slot);
   if(!person?.person_id||!person.staffing_identity_valid)throw new Error('The dated employee identity is unavailable.');
   const context=approvedPreviewContext();state.preview=null;state.staffingPreview=null;renderApprovedPreview();
   const weeks=window.MemphisSchedulerActions.staffingWeeks(selection.date,selection.endDate),bases=[];
   for(const week of weeks){
    const current=window.MemphisSchedulerActions.staffingSnapshotCovers(snapshot,week,{start_date:selection.date,end_date:selection.endDate})?snapshot:await api('/static-weekly/manager-snapshot?week_start='+encodeURIComponent(week));
    requireCurrentDatedReview(binding,'absences');
    if(!window.MemphisSchedulerActions.staffingSnapshotCovers(current,week,{start_date:selection.date,end_date:selection.endDate})||current.authority_revision!==snapshot.authority_revision
     ||!current.current_publication?.publication_id||!current.current_publication?.version_id)
     throw new Error('A current published basis is required for EVERY absence week. The full window remains unsubmitted.');
    bases.push({weekStart:week,publicationId:current.current_publication.publication_id,
     versionId:current.current_publication.version_id,authorityRevision:current.authority_revision});
   }
   if(JSON.stringify(dayChangeSelection())!==reviewed)throw new Error('The dated employee selection changed before preparation. Nothing was sent.');
   setStatus('Preparing this employee’s private dated staffing preview. Nothing is published.');
   const value=await state.actions.prepareStaffing({command_kind:'absence',employee_id:person.person_id,start_date:selection.date,end_date:selection.endDate,
    absence_kind:selection.operations[0].exception_type,client_prepare_key:crypto.randomUUID(),expected_revision:snapshot.authority_revision},
    {...bases[0],weeks:bases});
   requireCurrentPreviewContext(context);if(JSON.stringify(dayChangeSelection())!==reviewed)throw new Error('The employee selection changed while preparing. Read the saved original staffing preview.');await displayStaffingPreview(value,context);
  });return;
 }
 if(!await confirmAction(`Apply ${selection.absenceCount} absence/PTO entries and ${selection.contractorCount} CoverAll slots for ${selection.date}, then update every affected route?`,{title:'Update dated routes',confirmLabel:'Apply and Update Routes'}))return;
 await busy(()=>{requireCurrentDatedReview(binding,'absences');if(JSON.stringify(dayChangeSelection())!==reviewed)throw new Error('The selected absences or CoverAll arrangement changed. Review the dated change again.');
  return runDated('/static-weekly/day-changes/batch',{service_date:selection.date,base_version_id:publication.version_id,version_id:publication.version_id,publication_id:publication.publication_id,operations:selection.operations,expected_revision:snapshot.authority_revision,idempotency_key:commandId('dated-routes'),week_start:snapshot.week_start});});
}
function staffingDateUnavailable(){return ['EXPIRED','UNAVAILABLE'].includes(state.actions?.staffingDateStatus?.().state);}
function showStaffingDateUnavailable(){const status=state.actions?.staffingDateStatus?.();if(!status||status.state==='CURRENT'||status.state==='ACCEPTED')return false;
 state.staffingPreview=null;state.coverallSelection=null;renderApprovedPreview();renderPending();setControls();setStatus(status.message,'error');return true;}
function coverAllOriginalEligible(r){return !state.accessDenied&&!state.approvedPending&&!state.manualPending&&schedulerPermissions().absences&&schedulerPermissions().coverall
 &&window.MemphisSchedulerActions.isStaffingCommand(r)&&r.state==='PENDING'&&r.body.command_kind==='absence'
 &&r.command.phase==='PREPARING'&&typeof r.command.operationId==='string'&&!r.command.confirmationAttempted&&!r.command.preparationUnknown&&!r.command.cancellationAttempt
  &&(!staffingDateUnavailable()||!!r.command.coverallAttempt);}
function ensureCoverAllPanel(){let panel=document.getElementById('third-coverall-panel');if(panel)return panel;
 panel=document.createElement('section');panel.id='third-coverall-panel';panel.className='status';panel.hidden=true;
 panel.innerHTML='<h2>Third absence — confirmed CoverAll replacement</h2><p>The accepted two-absence plan stays intact. Only the third missing owner is replaced by typed nonemployee capacity. This does not book a vendor or create an employee.</p><p id="third-coverall-status" role="status" aria-live="polite"></p><div id="third-coverall-days"></div><button class="btn primary" type="button" id="third-coverall-prepare">Prepare selected CoverAll preview</button>';
 document.getElementById('scheduler-pending-panel').parentNode.insertBefore(panel,document.getElementById('approved-preview-panel'));
 document.getElementById('third-coverall-prepare').addEventListener('click',()=>busy(prepareThirdCoverAll));return panel;
}
async function readThirdCoverAllOptions(){requireSchedulerPermission('coverall');requireSchedulerPermission('absences');
 const original=state.pending;if(!coverAllOriginalEligible(original))throw Error('Read the original unconfirmed third-absence operation first.');
 const context=staffingContext(),actions=state.actions,options=await actions.readCoverAllOptions();requireStaffingContext(context);
 if(state.actions!==actions)throw Error('Original scheduling owner changed.');
 state.coverallSelection={options,context,actions};renderThirdCoverAll();
 if(state.pending.command.coverallAttempt){const value=await actions.reviewStaffing();requireStaffingContext(context);
  if(value.state==='PREPARED')await displayStaffingPreview(value,context.review);
  else setStatus('The original CoverAll preparation is unresolved. Only its original status was read; no choice, cancellation or confirmation was resent.','error');
 }
}
function renderThirdCoverAll(){const panel=ensureCoverAllPanel(),selected=state.coverallSelection,r=state.pending;
 panel.hidden=!selected||!r||state.accessDenied||!schedulerPermissions().coverall||!schedulerPermissions().absences;
 if(panel.hidden)return;
 try{requireStaffingContext(selected.context);window.MemphisSchedulerActions.validateCoverAllOptions(selected.options,r);}catch{panel.hidden=true;state.coverallSelection=null;return;}
 const attempted=r.command.coverallAttempt,chosen=attempted?JSON.parse(attempted.encoded).days:[],locked=!!attempted||state.busy||staffingDateUnavailable();
 document.getElementById('third-coverall-status').textContent=attempted?'Original choice and actual hours are saved. Recovery reads only that operation; no choice is resent.':'Select each server-listed capacity and lunch helper, then enter and explicitly confirm the actual hours. Template hours are reference only.';
 document.getElementById('third-coverall-days').innerHTML=selected.options.days.map(day=>{const saved=chosen.find(d=>d.service_date===day.serviceDate),disable=locked?'disabled':'';
  return `<fieldset data-coverall-day="${escapeHtml(day.serviceDate)}"><legend>${escapeHtml(day.serviceDate)} · retained two-absence plan</legend><label>Approved nonemployee capacity <select data-coverall-capacity ${disable}><option value="">Select approved capacity</option>${day.capacities.map(c=>`<option value="${escapeHtml(c.capacityId)}" ${saved?.capacity_id===c.capacityId?'selected':''}>${escapeHtml(c.label)} · template ${escapeHtml(c.shift.start)}–${escapeHtml(c.shift.end)} (reference only)</option>`).join('')}</select></label><div class="inline"><label>Confirmed actual shift start <input type="time" data-coverall-start value="${escapeHtml(saved?.shift.start||'')}" ${disable}></label><label>Confirmed actual shift end <input type="time" data-coverall-end value="${escapeHtml(saved?.shift.end||'')}" ${disable}></label></div><div class="inline"><label>Actual full-hour lunch start <input type="time" data-coverall-lunch-start value="${escapeHtml(saved?.lunch.start||'')}" ${disable}></label><label>Actual full-hour lunch end <input type="time" data-coverall-lunch-end value="${escapeHtml(saved?.lunch.end||'')}" ${disable}></label></div><label>Full-hour lunch helper <select data-coverall-helper ${disable}><option value="">Select approved helper</option>${day.lunchCoverers.map(h=>`<option value="${escapeHtml(h.slotId)}" ${saved?.lunch_coverer_slot_id===h.slotId?'selected':''}>${escapeHtml(h.label)} · shift ${escapeHtml(h.shift.start)}–${escapeHtml(h.shift.end)} · own lunch ${escapeHtml(h.lunch.start)}–${escapeHtml(h.lunch.end)}</option>`).join('')}</select></label><label>Actual-hours confirmation reference <input data-coverall-reference maxlength="256" value="${escapeHtml(saved?.confirmation_reference||'')}" ${disable}></label><label><input type="checkbox" data-coverall-confirmed ${saved?.actual_hours_confirmed?'checked':''} ${disable}> I explicitly confirmed these actual CoverAll shift and full-hour lunch times.</label></fieldset>`;
 }).join('');
 document.getElementById('third-coverall-prepare').hidden=!!attempted;document.getElementById('third-coverall-prepare').disabled=locked||!coverAllOriginalEligible(r);
}
function selectedCoverAllDays(){const selected=state.coverallSelection;if(!selected)throw Error('Read current source-bound CoverAll options first.');
 const days=[...document.querySelectorAll('#third-coverall-days [data-coverall-day]')].map(row=>({service_date:row.dataset.coverallDay,capacity_id:row.querySelector('[data-coverall-capacity]').value,
  shift:{start:row.querySelector('[data-coverall-start]').value,end:row.querySelector('[data-coverall-end]').value},lunch:{start:row.querySelector('[data-coverall-lunch-start]').value,end:row.querySelector('[data-coverall-lunch-end]').value},
  lunch_coverer_slot_id:row.querySelector('[data-coverall-helper]').value,confirmation_reference:row.querySelector('[data-coverall-reference]').value,actual_hours_confirmed:row.querySelector('[data-coverall-confirmed]').checked}));
 return window.MemphisSchedulerActions.validateCoverAllDays(selected.options,days);
}
async function prepareThirdCoverAll(){requireSchedulerPermission('coverall');const selection=state.coverallSelection;if(!selection||!coverAllOriginalEligible(state.pending))throw Error('Original third-absence preparation is unavailable.');
 requireStaffingContext(selection.context);if(selection.actions!==state.actions)throw Error('Original scheduling owner changed.');const days=selectedCoverAllDays();
 const captured=JSON.stringify(days),assertCurrent=()=>{requireSchedulerPermission('coverall');requireStaffingContext(selection.context);
  if(selection!==state.coverallSelection||selection.actions!==state.actions||JSON.stringify(selectedCoverAllDays())!==captured)throw Error('The actual CoverAll arrangement or reviewed manager changed before preparation. Review it again.');};
 const result=await state.actions.prepareCoverAll(selection.options,days,{assertCurrent});requireStaffingContext(selection.context);
 await displayStaffingPreview(result,selection.context.review);renderThirdCoverAll();setStatus('CoverAll private preview ready. The retained two-absence plan is preserved; review every staged duty and full-hour helper before the original confirmation.','done');
}
function typedCoverAllOperation(row){const operation=row?.coverAllOperationId??row?.payload?.coverAllOperationId;return typeof operation==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(operation)?operation:null;}

function staffingContext(){const saved=state.pending;
 if(!window.MemphisSchedulerActions.isStaffingCommand(saved))throw new Error('The original staffing operation is unavailable.');
 return{review:approvedPreviewContext(),principal:window.MemphisSchedulerActions.principal(window.MemphisAuth),
  encoded:saved.encoded,operationId:saved.command.operationId};
}
function requireStaffingContext(context){requireSchedulerPermission('absences');requireCurrentPreviewContext(context.review);
 const saved=state.pending;if(!window.MemphisSchedulerActions.same(context.principal,window.MemphisSchedulerActions.principal(window.MemphisAuth))
  ||!window.MemphisSchedulerActions.isStaffingCommand(saved)||saved.encoded!==context.encoded||saved.command.operationId!==context.operationId)
  throw new Error('The reviewed staffing operation or manager changed. Original work remains saved.');
}
async function displayStaffingPreview(value,review){
 requireSchedulerPermission('absences');const saved=state.pending;
 if(value.state==='ACCEPTED'){await verifyStaffingAccepted();state.staffingPreview=null;await refreshSnapshot();return;}
 if(showStaffingDateUnavailable())return;
 window.MemphisSchedulerActions.validateStaffingPreview(value,saved);
 if(value.state!=='PREPARED')throw new Error('The private staffing preview is not prepared. Resume the original request.');
 const context={review,principal:window.MemphisSchedulerActions.principal(window.MemphisAuth),encoded:saved.encoded,operationId:saved.command.operationId};
 await verifyStaffingBasis(saved,context);
 state.staffingPreview={value,context};renderApprovedPreview();renderPending();setControls();
 setStatus(saved.command.confirmationAttempted?'Confirmation outcome remains unconfirmed. Read the original operation; do not confirm again.':'Private staffing preview ready. Review the dated people, duties and constraints before one confirmation.','');
}
async function resumeStaffingPreview(){requireSchedulerPermission('absences');const context=approvedPreviewContext();
 const cancellation=state.pending?.command?.cancellationAttempt;
 const cancellationView=cancellation?{context:staffingContext(),actions:state.actions,original:state.pending,selection:originalStaffingSelectionIdentity(state.pending)}:null;
 const value=await state.actions.reviewStaffing();requireCurrentPreviewContext(context);
 if(!cancellation&&value.state!=='ACCEPTED'&&showStaffingDateUnavailable())return value;
 if(state.pending?.command?.coverallAttempt&&value.state==='PREPARING'){renderPending();setControls();setStatus('Original CoverAll preparation remains unresolved. No choice or confirmation was resent. Read original CoverAll options/status only.','error');return value;}
 if(cancellation){requireUnpublishedCancellationSelection(cancellationView);showUnpublishedCancellationOutcome(value);return value;}
 if(value.state==='PREPARING'&&missingPatternOriginal(state.pending)){renderPending();setControls();setStatus(missingStaffingPatternMessage,'error');return value;}
 await displayStaffingPreview(value,context);
}
function canCancelUnpublishedPreparation(r){
 return !state.accessDenied&&!state.approvedPending&&schedulerPermissions().absences
  &&window.MemphisSchedulerActions.same(state.principal,window.MemphisSchedulerActions.principal(window.MemphisAuth))
  &&window.MemphisSchedulerActions.isStaffingCommand(r)&&r.state==='PENDING'
  &&r.managerId===state.principal.managerId
  &&!staffingDateUnavailable()&&['PREPARING','PREPARED'].includes(r.command.phase)&&typeof r.command.operationId==='string'
  &&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.command.operationId)
  &&/^[a-f0-9]{64}$/.test(r.command.semanticDigest||'')&&!r.command.confirmationAttempted
  &&r.command.confirmationKey===null&&!r.command.preparationUnknown&&!r.command.cancellationAttempt&&(!r.command.coverallAttempt||r.command.coverallAttempt.phase==='PREPARED');
}
function requireUnpublishedCancellationSelection(binding){
 requireSchedulerPermission('absences');requireCurrentPreviewContext(binding.context.review);
 if(state.actions!==binding.actions||state.approvedPending
  ||!window.MemphisSchedulerActions.same(binding.context.principal,window.MemphisSchedulerActions.principal(window.MemphisAuth))
  ||!window.MemphisSchedulerActions.same(state.principal,window.MemphisSchedulerActions.principal(window.MemphisAuth))
  ||originalStaffingSelectionIdentity(binding.original)!==binding.selection)
  throw new Error('The original unpublished cancellation view or manager changed. Original work remains saved.');
}
function captureUnpublishedCancellationRequest(path,options){
 const r=state.pending,base=window.MemphisSchedulerActions.staffingCommandPath;
 if(!window.MemphisSchedulerActions.isStaffingCommand(r)||!r.command.operationId
  ||!r.command.cancellationAttempt&&!unpublishedCancellationContext
  ||!(options.method==='GET'&&path===base+'/'+r.command.operationId
    ||options.method==='POST'&&path===base+'/'+r.command.operationId+'/cancel'&&options.body==='{}'))return null;
 return{context:staffingContext(),actions:state.actions,original:r,record:JSON.stringify(r),selection:originalStaffingSelectionIdentity(r)};
}
function requireUnpublishedCancellationRequest(binding){
 requireUnpublishedCancellationSelection(binding);requireStaffingContext(binding.context);
 if(JSON.stringify(state.actions.pending())!==binding.record)
  throw new Error('The saved original cancellation changed during its response.');
 if(unpublishedCancellationContext)requireUnpublishedCancellationSelection(unpublishedCancellationContext);
}
function showUnpublishedCancellationOutcome(value){
 if(value.state==='CANCELLED'){
  if(!state.actions.acknowledgeCancelledStaffing())throw new Error('The exact original cancellation observation is unavailable. Its local control remains held.');
  state.staffingPreview=null;state.unresolvedPreview=null;renderApprovedPreview();
  setStatus('The exact original reads CANCELLED. Its local pending control was retired; protected command history remains. No accepted schedule or route verification is claimed.','done');
 }else setStatus('Cancellation outcome is unconfirmed. The exact original is saved. Read its status only; do not resend cancellation or confirmation.','error');
 renderPending();setControls();
}
async function cancelUnpublishedPreparation(){
 const original=state.actions?.pending();if(!canCancelUnpublishedPreparation(original))throw new Error('This original unpublished preparation cannot be cancelled. Read its saved outcome.');
 const binding={context:staffingContext(),actions:state.actions,original,selection:originalStaffingSelectionIdentity(original)};
 requireUnpublishedCancellationSelection(binding);
 if(!await confirmAction('Cancel this exact unpublished preparation? Its original status will be checked. This does not cancel any accepted schedule or erase protected history.',
  {title:'Cancel unpublished preparation',confirmLabel:'Cancel Unpublished Preparation'}))return;
 requireUnpublishedCancellationSelection(binding);
 if(JSON.stringify(state.actions.pending())!==JSON.stringify(original)||!canCancelUnpublishedPreparation(state.actions.pending()))
  throw new Error('The original unpublished preparation changed before cancellation.');
 if(unpublishedCancellationContext)throw new Error('Original cancellation is already in progress.');
 unpublishedCancellationContext=binding;
 try{const value=await state.actions.cancelStaffingPreparation();requireUnpublishedCancellationSelection(binding);showUnpublishedCancellationOutcome(value);return value;}
 finally{unpublishedCancellationContext=null;renderPending();setControls();}
}
async function retryMissingStaffingPreparation(){requireSchedulerPermission('absences');
 if(!missingPatternOriginal(state.pending))throw new Error('The original missing-pattern preparation is not retryable. Read the saved outcome.');
 if(explicitStaffingRetryContext)throw new Error('Original staffing preparation is already in progress.');
 const context=staffingContext();requireStaffingContext(context);
 explicitStaffingRetryContext=context;
 try{const value=await state.actions.retryStaffingPreparation();requireStaffingContext(context);
  if(value.state==='PREPARING'){renderPending();setControls();setStatus(missingStaffingPatternMessage,'error');return value;}
  await displayStaffingPreview(value,context.review);
 }finally{explicitStaffingRetryContext=null;}
}
async function verifyStaffingBasis(saved,context){
 const snapshots=[];for(const basis of window.MemphisSchedulerActions.staffingBindings(saved)){
  const current=await api('/static-weekly/manager-snapshot?week_start='+encodeURIComponent(basis.weekStart));requireStaffingContext(context);
  if(!window.MemphisSchedulerActions.staffingSnapshotCovers(current,basis.weekStart,saved.body)||current.authority_revision!==saved.body.expected_revision
   ||current.current_publication?.publication_id!==basis.publicationId||current.current_publication?.version_id!==basis.versionId)
   throw new Error('A remaining week publication/version/revision changed. No confirmation was sent.');
  if(!validServerDate(current.current_service_date)||saved.body.start_date<current.current_service_date)
   throw new Error('The original staffing dates have elapsed or the current server service date is unavailable. Read original status only; its request is preserved.');
  snapshots.push(current);
 }return snapshots;
}
async function verifyStaffingAccepted(){
 const saved=state.pending;if(!window.MemphisSchedulerActions.isStaffingCommand(saved)||saved.state!=='ACCEPTED')throw new Error('The original accepted staffing outcome is unavailable.');
 const context=staffingContext(),snapshots=[];for(const basis of window.MemphisSchedulerActions.staffingBindings(saved)){
  snapshots.push(await api('/static-weekly/manager-snapshot?week_start='+encodeURIComponent(basis.weekStart)));requireStaffingContext(context);
 }
 if(!state.actions.acknowledgeStaffing(snapshots))throw new Error('Accepted staffing is saved until EVERY affected week has exact current projection/replay readback.');
}
function isCanonicalStaffingAbsence(row){return !!row&&(Object.hasOwn(row,'staffingAbsenceId')||Object.hasOwn(row,'canonicalAbsenceId')||/^[0-9a-f-]{36}:\d{4}-\d{2}-\d{2}$/i.test(String(row.id||'')));}
function validServerDate(value){try{return typeof value==='string'&&!value.startsWith('0000-')&&validCivilDate(value)===value;}catch{return false;}}
function originalAbsenceTarget(row){
 const fields=['staffingAbsenceId','staffingEmployeeId','staffingStartDate','staffingEndDate','staffingAcceptedOperationId'],target={};
 for(const field of fields)target[field]=row?.[field];
 const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
 const listed=row?.sourceKind==='canonical_staffing_absence';
 if(!(listed?['daily_absence','pto','unavailable'].includes(row.absenceKind)&&row.status==='accepted'&&uuid(row.actorId):['daily_absence','pto'].includes(row?.type))
  ||!uuid(target.staffingAbsenceId)||!uuid(target.staffingEmployeeId)||!uuid(target.staffingAcceptedOperationId)
  ||!validServerDate(target.staffingStartDate)||!validServerDate(target.staffingEndDate)||target.staffingStartDate>target.staffingEndDate
  ||(listed?target.staffingAcceptedOperationId!==target.staffingAbsenceId:
   !validServerDate(row.serviceDate)||row.id!==target.staffingAbsenceId+':'+row.serviceDate
   ||row.serviceDate<target.staffingStartDate||row.serviceDate>target.staffingEndDate||row.canonicalAbsenceId!=null&&row.canonicalAbsenceId!==target.staffingAbsenceId))
  throw new Error('Original accepted absence employee/target/full range is unavailable. Canonical absence cannot use legacy Remove.');
 return target;
}
function canonicalAbsenceTargets(snapshot){
 if(!Object.hasOwn(snapshot,'canonical_staffing_absences'))return[]; // No inferred hidden targets.
 const rows=snapshot.canonical_staffing_absences;
 if(!Array.isArray(rows)||rows.length>100000||new TextEncoder().encode(JSON.stringify(rows)).byteLength>16777216)
  throw new Error('The complete canonical original absence list is unavailable or exceeds its bounds; it was not truncated.');
 if(!validServerDate(snapshot.week_start)||!validServerDate(snapshot.week_end)||!window.MemphisApprovedSchedule.validSnapshotWindow(snapshot,mondayOf(snapshot.week_start)))
  throw new Error('The original target snapshot must bind one exact current seven-day week.');
 const fields=['staffingAbsenceId','staffingEmployeeId','staffingStartDate','staffingEndDate','staffingAcceptedOperationId','status','absenceKind','actorId','sourceKind'],seen=new Set();
 for(const row of rows){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).length!==fields.length||fields.some(key=>!Object.hasOwn(row,key))
   ||row.sourceKind!=='canonical_staffing_absence')throw new Error('The original accepted absence source row cannot be verified.');
  const target=originalAbsenceTarget(row),today=snapshot.current_service_date;
  window.MemphisSchedulerActions.staffingWeeks(target.staffingStartDate,target.staffingEndDate);
  const remainingStart=validServerDate(today)&&today>target.staffingStartDate?today:target.staffingStartDate;
  if(seen.has(target.staffingAbsenceId)||remainingStart>target.staffingEndDate||remainingStart>snapshot.week_end||target.staffingEndDate<snapshot.week_start)
   throw new Error('Original accepted absence list identity/week binding changed. No different target was inferred.');
  seen.add(target.staffingAbsenceId);
 }return rows;
}
function cancellationSelectionSignature(row){return JSON.stringify({target:originalAbsenceTarget(row),
 ...(row.sourceKind==='canonical_staffing_absence'?{sourceKind:row.sourceKind,absenceKind:row.absenceKind,status:row.status,actorId:row.actorId}:{})});}
async function prepareAbsenceCancellation(row,button){
 requireSchedulerPermission('absences');const listed=row.sourceKind==='canonical_staffing_absence',binding=datedReviewBinding(),
  id=listed?row.staffingAbsenceId:row.id,target=originalAbsenceTarget(row),signature=cancellationSelectionSignature(row);
 await busy(async()=>{
  const selected=await api('/static-weekly/manager-snapshot?week_start='+encodeURIComponent(binding.context.week));requireCurrentDatedReview(binding,'absences');
  const fresh=listed?canonicalAbsenceTargets(selected).find(item=>item.staffingAbsenceId===id):effectiveExceptions(selected).find(item=>item.id===id);
  if(!window.MemphisApprovedSchedule.validSnapshotWindow(selected,binding.context.week)||selected.authority_revision!==state.snapshot.authority_revision||!fresh
   ||cancellationSelectionSignature(fresh)!==signature||(listed?button.dataset.cancelOriginalAbsence:button.dataset.reverseException)!==id)
   throw new Error('The original accepted cancellation target changed. Refresh and review it again.');
  const today=selected.current_service_date;if(!validServerDate(today))throw new Error('Server current_service_date is unavailable. No local-date or selected-week fallback is allowed.');
  const start=target.staffingStartDate>today?target.staffingStartDate:today,end=target.staffingEndDate;
  if(start>end)throw new Error('The original absence is fully elapsed; there is no remaining window to cancel.');
  const weeks=window.MemphisSchedulerActions.staffingWeeks(start,end),snapshots=[],bases=[];
  for(const week of weeks){
   const current=week===selected.week_start?selected:await api('/static-weekly/manager-snapshot?week_start='+encodeURIComponent(week));requireCurrentDatedReview(binding,'absences');
   const publication=current.current_publication;
   if(!window.MemphisSchedulerActions.staffingSnapshotCovers(current,week,{start_date:start,end_date:end})||current.authority_revision!==selected.authority_revision||current.current_service_date!==today
    ||typeof publication?.publication_id!=='string'||typeof publication?.version_id!=='string')
    throw new Error('A current publication/version/server-date basis is missing for a remaining week. The entire cancellation was refused, not shortened.');
   snapshots.push(current);bases.push({weekStart:week,publicationId:publication.publication_id,versionId:publication.version_id,authorityRevision:current.authority_revision});
  }
  // Every current basis came from normal readers, not accepted historic source.
  state.snapshot=snapshots[0];els.week_start.value=weeks[0];els.service_date.value=start;invalidateApprovedPreview();
  const context=approvedPreviewContext(),first=bases[0];
  const value=await state.actions.prepareStaffing({command_kind:'cancel_absence',employee_id:target.staffingEmployeeId,start_date:start,end_date:end,
   target_absence_id:target.staffingAbsenceId,client_prepare_key:crypto.randomUUID(),expected_revision:selected.authority_revision},
   {...first,weeks:bases,target,currentServiceDate:today});
  requireCurrentPreviewContext(context);await displayStaffingPreview(value,context);
 });
}
async function confirmStaffingPreview(){if(state.unresolvedPreview)throw new Error('Coverage remains unresolved. Nothing can be confirmed.');const choice=state.staffingPreview;if(!choice)throw new Error('Read the original staffing preview first.');
 requireStaffingContext(choice.context);const saved=state.pending;
 if(saved.command.confirmationAttempted)throw new Error('This original confirmation has already been attempted. Read its outcome, never resend.');
 const cancelling=saved.body.command_kind==='cancel_absence';
 if(!await confirmAction(`${cancelling?'Cancel the ORIGINAL absence for its exact remaining window':'Publish this exact prepared absence'} ${saved.body.start_date} through ${saved.body.end_date}? Review ALL ${window.MemphisSchedulerActions.staffingBindings(saved).length} weeks. The currently effective accepted plan is used, never a historical restore. Planned windows and balance indices are not performed-opening proof.`,{title:'Confirm reviewed staffing',confirmLabel:cancelling?'Cancel Reviewed Remaining Absence':'Publish Reviewed Staffing'}))return;
 await busy(async()=>{requireStaffingContext(choice.context);
  await verifyStaffingBasis(saved,choice.context);
  setStatus('Confirming the one reviewed staffing candidate; original outcome will be read back.');
  const accepted=await state.actions.confirmStaffing(choice.value);
  if(accepted.state!=='ACCEPTED')throw new Error('Acceptance is unconfirmed. Read the original operation; do not confirm again.');
  await verifyStaffingAccepted();state.staffingPreview=null;await refreshSnapshot();
  if(state.pending)throw new Error('Accepted staffing is saved, but its exact current projection/readback is unavailable.');
 });
}
async function rebuildCurrentProjection(){if(state.manualActivationPanel?.normalLocked())throw new Error('The approved normal source is active and locked. Use dated staffing actions.');requireSchedulerPermission('routes');const snapshot=needSnapshot();if(!snapshot.current_publication)throw new Error('No approved published schedule exists.');
 const binding=datedReviewBinding();
 if(!await confirmAction('Regenerate all routes using the currently published plan and accepted dated absences and CoverAll coverage?',{title:'Regenerate routes',confirmLabel:'Regenerate'}))return;
 await busy(()=>{requireCurrentDatedReview(binding,'routes');return runDated('/static-weekly/rebuild-current-projection',{week_start:snapshot.week_start,expected_revision:snapshot.authority_revision,idempotency_key:commandId('regenerate-routes')});});
}
async function reverseChange(event){
 const originalButton=event.target.closest('[data-cancel-original-absence]');
 if(originalButton?.dataset.cancelOriginalAbsence){
  requireSchedulerPermission('absences');const snapshot=needSnapshot();
  if(!snapshot.current_publication)throw new Error('A current publication is required before original absence cancellation.');
  const row=canonicalAbsenceTargets(snapshot).find(item=>item.staffingAbsenceId===originalButton.dataset.cancelOriginalAbsence);
  if(!row)throw new Error('This original accepted absence is unavailable. Refresh; no occupant or legacy target was substituted.');
  await prepareAbsenceCancellation(row,originalButton);return;
 }
 requireSchedulerPermission('absences');const button=event.target.closest('[data-reverse-exception]');if(!button)return;
 const snapshot=needSnapshot(),publication=snapshot.current_publication;if(!publication)return;
 const id=button.dataset.reverseException,active=effectiveExceptions(snapshot),row=active.find(item=>item.id===id);
 if(!row)throw new Error('This dated change is no longer active. Review the current schedule again.');
 if(isCanonicalStaffingAbsence(row)){await prepareAbsenceCancellation(row,button);return;}
 const coverallOperation=typedCoverAllOperation(row);if(coverallOperation){const original=canonicalAbsenceTargets(snapshot).find(item=>item.staffingAbsenceId===coverallOperation);if(!original)throw Error('The original accepted third-absence target is unavailable. Refresh; no legacy CoverAll reversal was substituted.');await prepareAbsenceCancellation(original,button);return;}
 if(!canReverseDated(snapshot,row))throw new Error('This change is owner-only.');
 let targets=[row];if(row.type==='cover_all'){const slot=row.payload?.availability?.slotId;targets=targets.concat(active.filter(r=>r.type==='lunch'&&r.serviceDate===row.serviceDate&&r.payload?.slotId===slot));}
 const binding=datedReviewBinding();
 if(!await confirmAction(`Remove this ${labelType(row.type).toLowerCase()} and its linked CoverAll lunch, when applicable, then regenerate routes?`,{title:'Remove dated change',confirmLabel:'Remove and Update Routes'}))return;
 await busy(()=>{requireCurrentDatedReview(binding,'absences');if(button.dataset.reverseException!==id)throw new Error('The selected dated change changed. Review it again.');if(!canReverseDated(snapshot,row))throw new Error('This change is owner-only.');
  return runDated('/static-weekly/day-changes/batch',{service_date:row.serviceDate,base_version_id:publication.version_id,version_id:publication.version_id,publication_id:publication.publication_id,
  operations:targets.map(r=>({operation:'exception',exception_type:'reverse',reason:'Manager removed dated schedule change',payload:{reversesExceptionId:r.id},reverses_exception_id:r.id})),expected_revision:snapshot.authority_revision,idempotency_key:commandId('reverse-dated'),week_start:snapshot.week_start});});
}
function openTurnoverDialog(event){const button=event.target.closest('[data-turnover-slot]');if(!button||state.busy)return;if(state.pending||state.approvedPending)throw new Error('Resolve the saved scheduler request first.');requireSchedulerPermission('management');if(button.dataset.turnoverMode==='vacate'){openVacancyDialog(button);return;}const snapshot=needSnapshot(),today=snapshot.current_service_date;if(!validServerDate(today)||!validServerDate(snapshot.week_start)||!validServerDate(snapshot.week_end)||today<snapshot.week_start||today>snapshot.week_end)throw new Error('Employee changes are available only from the current operational week.');const row=rosterForDate(snapshot,today).find((item)=>item.slot_id===button.dataset.turnoverSlot);if(!row?.person_id||!row.staffing_identity_valid)throw new Error('No current employee is bound to this staffing record.');const mode=button.dataset.turnoverMode;if(!['replace','departed'].includes(mode))throw new Error('Choose an existing staffing operation.');state.turnoverSelection=Object.freeze({principal:Object.freeze(window.MemphisSchedulerActions.principal(window.MemphisAuth)),slotId:row.slot_id,personId:row.person_id,date:today,mode,revision:snapshot.authority_revision,weekStart:snapshot.week_start,publicationId:snapshot.current_publication?.publication_id});els.turnover_slot.value=row.slot_id;els.turnover_mode.value=mode;els.turnover_effective_date.value=today;els.turnover_effective_date.min=today;els.turnover_effective_date.max=today;els.turnover_current.textContent=row.person_name||row.slot_label;els.replacement_name.value='';els.replacement_name.required=mode==='replace';els.replacement_name_field.hidden=mode!=='replace';els.turnover_title.textContent=mode==='replace'?'Add replacement':'Mark employee gone';els.turnover_reason.value=mode==='replace'?'New employee hired':'Employee no longer working';els.turnover_submit_label.textContent=mode==='replace'?'Add Employee':'Mark Gone';els.turnover_dialog.showModal();if(mode==='replace')els.replacement_name.focus();else els.turnover_reason.focus();window.lucide?.createIcons?.();}
function closeTurnoverDialog(){state.turnoverSelection=null;els.turnover_dialog.close();}
function closeVacancyDialog(){state.vacancySelection=null;vacancyEls.vacancy_dialog.close?.();vacancyEls.vacancy_submit.disabled=true;clearVacancyPreview();}
function clearVacancyPreview(){document.getElementById('vacancy-preview').hidden=true;
 for(const id of ['vacancy-preview-work','vacancy-preview-availability','vacancy-preview-lunch'])document.getElementById(id).replaceChildren();
 document.getElementById('vacancy-preview-metrics').textContent='';vacancyEls.vacancy_submit.textContent='Review affected vacancy plan';}
function invalidateVacancyCandidate(){const current=state.vacancySelection;if(current&&!current.inFlight){current.preview=null;current.body=null;clearVacancyPreview();}}
function requireVacancySelection(expected){
 requireCurrentDatedReview(expected.binding,'owner');
 const s=needSnapshot(),date=s.current_service_date,current=validServerDate(date)?rosterForDate(s,date).find(row=>row.slot_id===expected.slotId):null;
 if(state.vacancySelection!==expected||date!==expected.date||s.week_start!==expected.weekStart||s.authority_revision!==expected.revision
  ||s.current_publication?.publication_id!==expected.publicationId||!current?.staffing_identity_valid||current.person_id!==expected.employeeId)
  throw new Error('The vacancy employee/source/week/server date or revision changed. Close and review the current position again.');
}
function openVacancyDialog(button){
 requireSchedulerPermission('management');const s=needSnapshot(),date=s.current_service_date;
 if(!validServerDate(date)||date<s.week_start||date>s.week_end)throw new Error('Stable vacancy requires the server current service date inside this week; no device-date fallback is allowed.');
 if(!s.current_publication||s.projection_status!=='current')throw new Error('Load the current published plan before reviewing a stable vacancy.');
 const current=rosterForDate(s,date).find(row=>row.slot_id===button.dataset.turnoverSlot);
 if(!current?.person_id||!current.staffing_identity_valid||current.contractor_capacity)throw new Error('A genuine current employee/stable position is required for vacancy.');
 const sources=s.sources;
 if(!Array.isArray(sources)||sources.length>1024||sources.some(row=>typeof row.source_id!=='string'||!/^[a-f0-9-]{36}$/.test(row.source_id)
  ||typeof row.source_digest!=='string'||!/^[a-f0-9]{64}$/.test(row.source_digest))||new Set(sources.map(row=>row.source_id)).size!==sources.length)
  throw new Error('The complete registered source list is unavailable. No vacancy source is invented.');
 state.vacancySelection={binding:datedReviewBinding(),slotId:current.slot_id,employeeId:current.person_id,date,
  weekStart:s.week_start,revision:s.authority_revision,publicationId:s.current_publication.publication_id,
  sources:JSON.parse(JSON.stringify(sources)),readSequence:0,details:null,preview:null,body:null};
 vacancyEls.vacancy_current.textContent=`${current.person_name||current.slot_label} • Employee ${current.person_id} • Position ${current.slot_id} • Server date ${date} • Revision ${s.authority_revision}`;
 vacancyEls.vacancy_source.replaceChildren(new Option('Select a registered source — no default',''));
 for(const row of sources)vacancyEls.vacancy_source.add(new Option('Registered source '+row.source_id,row.source_id));
 vacancyEls.vacancy_source.value='';vacancyEls.vacancy_reason.value='';vacancyEls.vacancy_source_facts.textContent='';clearVacancyPreview();
 vacancyEls.vacancy_state.textContent=sources.length?'Choose a registered vacancy source. Nothing is changed by reading it.':'No registered source is available. Stable vacancy is held; employee departure is a different action.';
 vacancyEls.vacancy_submit.disabled=true;vacancyEls.vacancy_current_duties.replaceChildren();
 for(const row of displayAssignments(s).filter(row=>row.owner_person_id===current.person_id&&row.service_date>=date)){
  const tr=document.createElement('tr');for(const text of[row.service_date,row.work_snapshot?.locationNameSnapshot||row.plan_work_id||'Current duty',row.work_snapshot?.window?row.work_snapshot.window.start+'–'+row.work_snapshot.window.end:'Time unavailable']){
   const td=document.createElement('td');td.textContent=text;tr.append(td);
  }vacancyEls.vacancy_current_duties.append(tr);
 }
 if(!vacancyControlsBound){vacancyControlsBound=true;
  vacancyEls.vacancy_close.addEventListener('click',closeVacancyDialog);vacancyEls.vacancy_cancel.addEventListener('click',closeVacancyDialog);
  vacancyEls.vacancy_dialog.addEventListener('cancel',closeVacancyDialog);
  vacancyEls.vacancy_source.addEventListener('change',()=>loadVacancySource().catch(error=>{vacancyEls.vacancy_state.textContent=safe(error);}));
  vacancyEls.vacancy_reason.addEventListener('input',invalidateVacancyCandidate);
  vacancyEls.vacancy_form.addEventListener('submit',event=>submitVacancy(event).catch(error=>{vacancyEls.vacancy_state.textContent=safe(error);}));
 }
 vacancyEls.vacancy_dialog.showModal();vacancyEls.vacancy_source.focus();
}
async function loadVacancySource(){
 const expected=state.vacancySelection;if(!expected)throw new Error('Open a current stable-vacancy review first.');requireVacancySelection(expected);
 const sourceId=vacancyEls.vacancy_source.value,sequence=++expected.readSequence;
 expected.details=null;expected.preview=null;expected.body=null;clearVacancyPreview();vacancyEls.vacancy_submit.disabled=true;vacancyEls.vacancy_source_facts.textContent='';
 if(!sourceId){vacancyEls.vacancy_state.textContent='Choose a registered vacancy source. No source is selected by default.';return;}
 const registered=expected.sources.find(row=>row.source_id===sourceId);if(!registered)throw new Error('Choose an actual registered source; no supplied source was admitted.');
 vacancyEls.vacancy_state.textContent='Reading the current registered source and position — not a vacancy plan preview.';
 const details=await api('/static-weekly/staffing/source-details?source_id='+encodeURIComponent(sourceId)+'&effective_start='+encodeURIComponent(expected.date)+'&expected_revision='+expected.revision);
 requireVacancySelection(expected);
 if(sequence!==expected.readSequence||vacancyEls.vacancy_source.value!==sourceId)return; // Refuse stale source readback.
 if(details?.schema!=='custodial.roster-source-details.v1'||details.manager_id!==expected.binding.principal.managerId
  ||details.source_id!==sourceId||details.effective_start!==expected.date||details.week_start!==expected.weekStart
  ||details.authority_revision!==expected.revision||details.publication_id!==expected.publicationId||details.phone_released!==false
  ||typeof details.current_source_digest!=='string'||!/^[a-f0-9]{64}$/.test(details.current_source_digest)
  ||details.registered_source_digest!==registered.source_digest||!Array.isArray(details.current_roster))
  throw new Error('The actual source/manager/publication/employee/date/revision binding could not be verified.');
 const current=rosterForDate({...needSnapshot(),roster:details.current_roster},expected.date).find(row=>row.slot_id===expected.slotId);
 const original=details.registered_compiler_input;
 if(!current?.staffing_identity_valid||current.person_id!==expected.employeeId||!Array.isArray(original?.slots)
  ||original.slots.filter(row=>row.id===expected.slotId).length!==1
  ||!Array.isArray(original.version?.vacancyCapableSlotIds)||!original.version.vacancyCapableSlotIds.includes(expected.slotId)
  ||!Array.isArray(original.version?.vacantSlotIds)||!original.version.vacantSlotIds.includes(expected.slotId))
  throw new Error('This registered source does not declare the exact stable position vacancy-capable and vacant. No flags or replacement pattern were invented.');
 expected.details=details;
 vacancyEls.vacancy_source_facts.textContent=`Source ${sourceId} • Registered digest ${details.registered_source_digest} • Current digest ${details.current_source_digest} • Current employee ${expected.employeeId} • Server date ${expected.date}`;
 vacancyEls.vacancy_state.textContent='Source identity verified. Enter a reason and review the actual affected vacancy plan; source details alone do not authorize confirmation.';
 vacancyEls.vacancy_submit.disabled=false;
}
function vacancyBinding(expected){return{managerId:state.principal.managerId,slotId:expected.slotId,publicationId:expected.publicationId,
 currentSourceDigest:expected.details.current_source_digest,registeredSourceDigest:expected.details.registered_source_digest,
 assertCurrent:()=>{requireVacancySelection(expected);if(expected.body&&(vacancyEls.vacancy_source.value!==expected.body.source_id||vacancyEls.vacancy_reason.value.trim()!==expected.body.reason))throw Error('The vacancy review inputs changed before dispatch.');}};}
function renderVacancyPreview(value){const p=value.preview,append=(id,values)=>{const tr=document.createElement('tr');
 for(const value of values){const td=document.createElement('td');td.textContent=String(value??'Unavailable');tr.append(td);}document.getElementById(id).append(tr);};
 clearVacancyPreview();const clock=window=>window?.start&&window?.end?window.start+'–'+window.end:'Unavailable';
 for(const row of p.assignments)append('vacancy-preview-work',[row.serviceDate,row.workSnapshot.locationNameSnapshot||row.workId,
  `${row.ownerPersonId||row.capacityId||'No person'} / ${row.ownerSlotId||'No position'} / ${row.status}`,clock(row.workSnapshot.window)]);
 for(const row of p.projectionAvailability){const load=p.metrics?.daily?.find(day=>day.dayOfWeek===row.dayOfWeek)?.loads?.find(load=>load.slotId===row.slotId);
  const capacity=typeof row.productiveCapacityMinutes==='number'?row.productiveCapacityMinutes:load?.productiveCapacityMinutes;
  append('vacancy-preview-availability',[row.serviceDate,
  `${row.incumbentName||row.incumbentPersonId||row.capacityId||'No current person'} / ${row.slotId}`,row.status,
  `Shift ${clock(row.shift)}; lunch ${clock(row.lunch)}; productive capacity ${typeof capacity==='number'?capacity+' min (source-planned)':'Unavailable (not inferred)'}`]);}
 for(const row of p.lunchDocument.loans)append('vacancy-preview-lunch',[row.serviceDate,row.normalOwnerPersonId||row.normalOwnerCapacityId||'No person',row.coverageStart+'–'+row.coverageEnd,'Coverage loan']);
 for(const row of p.lunchDocument.responsibilities)append('vacancy-preview-lunch',[row.serviceDate,
  `${row.normalOwnerPersonId||'No person'} / coverer ${row.covererPersonId||row.covererCapacityId||'No person'}`,row.coverageStart+'–'+row.coverageEnd,row.coveragePurpose]);
 document.getElementById('vacancy-preview-metrics').textContent=JSON.stringify({objective:p.objective,metrics:p.metrics},null,2);
 document.getElementById('vacancy-preview').hidden=false;vacancyEls.vacancy_submit.textContent='Confirm reviewed stable vacancy';
}
async function submitVacancy(event){event.preventDefault();const expected=state.vacancySelection;if(!expected)throw new Error('Open the current stable vacancy first.');requireVacancySelection(expected);
 if(expected.inFlight||state.busy||state.pending||state.approvedPending)throw new Error('Resolve the original vacancy/scheduler work first.');
 const source=vacancyEls.vacancy_source.value,reason=vacancyEls.vacancy_reason.value.trim();
 if(expected.details?.source_id!==source||!reason||reason.length>500||/[\x00-\x1f\x7f]/.test(reason))throw new Error('A verified source and bounded plain-text vacancy reason are required.');
 const matches=body=>body?.source_id===source&&body.reason===reason;
 if(expected.preview&&!matches(expected.body)){invalidateVacancyCandidate();throw new Error('The source or reason changed. Review the actual plan again.');}
 expected.inFlight=true;vacancyEls.vacancy_submit.disabled=true;vacancyEls.vacancy_source.disabled=true;vacancyEls.vacancy_reason.disabled=true;
 try{
  if(!expected.preview){const body={source_id:source,employee_id:expected.employeeId,effective_start:expected.date,reason,
    expected_revision:expected.revision,idempotency_key:commandId('vacancy')};
   const value=await api('/static-weekly/roster/'+expected.slotId+'/vacate/preview',{method:'POST',body:JSON.stringify(body),expectedManagerId:state.principal.managerId});
   requireVacancySelection(expected);if(vacancyEls.vacancy_source.value!==source||vacancyEls.vacancy_reason.value.trim()!==reason)throw new Error('The vacancy review inputs changed.');
   await window.MemphisSchedulerActions.validateVacancyPreview(value,body,vacancyBinding(expected));requireVacancySelection(expected);
   if(vacancyEls.vacancy_source.value!==source||vacancyEls.vacancy_reason.value.trim()!==reason)throw new Error('The vacancy review inputs changed.');
   expected.body=body;expected.preview=value;renderVacancyPreview(value);
   vacancyEls.vacancy_state.textContent=`Unsubmitted reviewed candidate retained privately; not published. No roster, people/history, source or projection change has been accepted. Revision ${expected.revision} → vacancy ${value.projectionExpectedRevision} → proposed persisted plan ${value.resultingRevision}. Review dated owners, work, availability and paired lunch before one confirmation.`;return;
  }
  if(!await confirmAction(`Make position ${expected.slotId} a stable vacancy for current employee ${expected.employeeId} from server date ${expected.date}, using the displayed plan? This is not departure or recurring-pattern publication.`,{title:'Confirm reviewed stable vacancy',confirmLabel:'Confirm stable vacancy once'}))return;
  requireVacancySelection(expected);if(!matches(expected.body)||vacancyEls.vacancy_source.value!==source||vacancyEls.vacancy_reason.value.trim()!==reason)throw new Error('The reviewed vacancy inputs changed.');
  await busy(async()=>{await state.actions.runVacancy(expected.body,expected.preview,vacancyBinding(expected));closeVacancyDialog();await refreshSnapshot();
   if(state.pending)throw new Error('The original vacancy outcome is retained. Exact persisted/current-plan readback is not yet verified; Resume reads GET only.');
   setStatus('Stable vacancy and matching current plan read back. No phone or performed-work proof is implied.','done');});
  if(state.pending)closeVacancyDialog();
 }catch(error){if(state.pending){closeVacancyDialog();setStatus('Original vacancy saved; no new key or repeat POST. Use Resume for GET-only outcome/current-plan recovery. '+safe(error),'error');}throw error;
 }finally{expected.inFlight=false;vacancyEls.vacancy_source.disabled=false;vacancyEls.vacancy_reason.disabled=false;vacancyEls.vacancy_submit.disabled=state.vacancySelection!==expected||!expected.details;}
}
async function submitTurnover(event){
 requireSchedulerPermission('management');event.preventDefault();if(state.busy)return;
 if(state.pending||state.approvedPending)throw new Error('Resolve the saved scheduler request first.');
 const snapshot=needSnapshot(),publication=snapshot.current_publication;
 if(!publication)throw new Error('Publish the weekly baseline before changing the roster.');
 const mode=els.turnover_mode.value,binding=state.turnoverSelection;
 const requireOriginalTurnover=()=>{
  requireSchedulerPermission('management');
  if(state.pending||state.approvedPending)throw new Error('Resolve the saved scheduler request first.');
  if(!window.MemphisSchedulerActions.same(binding?.principal,window.MemphisSchedulerActions.principal(window.MemphisAuth)))
   throw new Error('Manager access changed. Review the current schedule again.');
  const currentSnapshot=needSnapshot(),today=currentSnapshot.current_service_date;
  const currentWeek=validServerDate(today)&&validServerDate(currentSnapshot.week_start)&&validServerDate(currentSnapshot.week_end)
   &&today>=currentSnapshot.week_start&&today<=currentSnapshot.week_end;
  const current=currentWeek?rosterForDate(currentSnapshot,today).find(row=>row.slot_id===els.turnover_slot.value):null;
  if(!binding||state.turnoverSelection!==binding||!currentWeek||binding.date!==today||binding.mode!==mode
   ||binding.mode!==els.turnover_mode.value||binding.slotId!==els.turnover_slot.value||binding.personId!==current?.person_id
   ||!current?.staffing_identity_valid||binding.revision!==currentSnapshot.authority_revision
   ||binding.weekStart!==currentSnapshot.week_start||binding.publicationId!==currentSnapshot.current_publication?.publication_id
   ||els.turnover_effective_date.value!==binding.date)
   throw new Error('The staffing record changed. Close this dialog and review the current employee again.');
 };
 requireOriginalTurnover();
 const replacementName=els.replacement_name.value.trim();
 if(mode==='replace'&&replacementName.length<2){els.replacement_name.focus();return;}
 const path=mode==='replace'?'/static-weekly/employees/replacements':'/static-weekly/employees/departed';
 const body={slot_id:els.turnover_slot.value,reason:els.turnover_reason.value.trim(),expected_revision:snapshot.authority_revision,
  idempotency_key:commandId(mode==='replace'?'replacement':'departure'),week_start:snapshot.week_start};
 if(mode==='replace')body.new_employee_name=replacementName;
 await busy(()=>{
  requireOriginalTurnover();
  if(els.turnover_reason.value.trim()!==body.reason||(mode==='replace'&&els.replacement_name.value.trim()!==replacementName))
   throw new Error('The staffing review inputs changed. Review the original employee again.');
  els.turnover_dialog.close();
  requireOriginalTurnover();
  state.turnoverSelection=null;els.service_date.value=binding.date;
  return runDated(path,body,'Updating staffing and regenerating current routes...');
 });
}
function render(){const s=needSnapshot();const rows=activeRoster(s);const staffing=effectiveStaffing(s,selectedServiceDate());const assignments=displayAssignments(s);const open=assignments.filter(row=>String(row.status).toLowerCase()!=='assigned');els.working_count.textContent=String(staffing.working);els.absent_count.textContent=String(staffing.absent);document.getElementById('vacancy-count').textContent=String(staffing.vacant);document.getElementById('contractor-count').textContent=String(staffing.contractors);document.getElementById('partial-count').textContent=String(staffing.partial);els.open_count.textContent=s.projection_status==='current'?String(open.length):'—';els.revision_count.textContent=String(s.authority_revision||0);els.week_title.textContent=`${formatDate(s.week_start)} - ${formatDate(s.week_end)}`;const stage=projectionNeedsRebuild(s)?'Schedule rebuild required':s.drafts?.length?'Draft ready':s.current_publication?'Published baseline':'No baseline';els.week_meta.textContent=`${stage} • ${assignments.length} work items • revision ${s.authority_revision}`;els.subtitle.textContent=s.current_publication?'Repeats until a later schedule is published':'Approved source required before first publication';renderRoster(s,rows);renderAbsences(s,rows);renderContractors(s,rows);renderWeek(s,rows,assignments);renderChanges(s);renderReadiness(s,assignments);els.rebuild_projection_btn.hidden=!s.current_publication||!projectionNeedsRebuild(s);els.generate_btn.disabled=state.busy||Boolean(s.drafts?.length);els.publish_btn.disabled=state.busy||!s.drafts?.length;els.apply_day_btn.disabled=state.busy||!s.current_publication;setControls();window.lucide?.createIcons?.();}
function renderRoster(s,rows){const staff=rows.filter((row)=>!row.contractor_capacity);const today=s.current_service_date;const currentWeek=validServerDate(today)&&validServerDate(s.week_start)&&validServerDate(s.week_end)&&today>=s.week_start&&today<=s.week_end;els.roster_list.innerHTML=staff.length?staff.map((row)=>{const absent=row.availability_state==='departed_named_absent';const phones=(row.device_ids||[]).join(', ')||'No phone';const action=absent?'replace':'departed';const enabled=schedulerPermissions().management&&Boolean(s.current_publication)&&currentWeek;const title=!s.current_publication?'Publish the weekly baseline first':!currentWeek?'Open the current week to change employees':absent?'Add replacement':'Mark employee gone';const serverDate=s.current_service_date,current=validServerDate(serverDate)&&serverDate>=s.week_start&&serverDate<=s.week_end?rosterForDate(s,serverDate).find(r=>r.slot_id===row.slot_id):null;const vacancyEnabled=schedulerPermissions().management&&!state.busy&&!state.pending&&!state.approvedPending&&s.projection_status==='current'&&Boolean(s.current_publication)&&Boolean(current?.person_id)&&current.staffing_identity_valid;return `<div class="rosterRow ${absent?'absentFixed':''}"><div><strong>${escapeHtml(row.person_name||row.slot_label)}</strong><small>${absent?'Absent until replacement':escapeHtml(phones)}</small></div><button class="iconBtn small" ${schedulerPermissions().management?'':'hidden'} type="button" data-turnover-slot="${escapeHtml(row.slot_id)}" data-turnover-mode="${action}" title="${title}" aria-label="${absent?'Add replacement for':'Mark gone'} ${escapeHtml(row.person_name||row.slot_label)}" ${enabled?'':'disabled'}><span data-lucide="${absent?'user-plus':'user-minus'}"></span></button><button class="btn secondary small" ${schedulerPermissions().management?'':'hidden'} type="button" data-turnover-slot="${escapeHtml(row.slot_id)}" data-turnover-mode="vacate" ${vacancyEnabled?'':'disabled'} title="Review stable vacancy using the current server-day employee and registered source">Stable vacancy</button></div>`;}).join(''):'<div class="empty">No employee slots.</div>';}
function renderAbsences(s,rows){const date=selectedServiceDate();const selected=availabilityForDate(s,date);const bySlot=new Map(rows.map((row)=>[row.slot_id,row]));const baseline=[...new Set(selected.filter((row)=>row.availability_state==='departed_named_absent').map((row)=>row.slot_id))];els.baseline_absences.innerHTML=baseline.length?baseline.map((id)=>`<div class="checkRow absentFixed"><span data-lucide="user-x"></span><div><strong>${escapeHtml(bySlot.get(id)?.person_name||bySlot.get(id)?.slot_label||'Departed slot')}</strong><small>Absent until replacement</small></div></div>`).join(''):'<div class="empty">No baseline absent slots.</div>';const callouts=activeExceptionSlots(s,date,'daily_absence');const pto=activeExceptionSlots(s,date,'pto');const active=new Set([...callouts,...pto]);const working=rows.filter((row)=>!row.contractor_capacity&&row.person_id&&row.staffing_identity_valid&&selected.some((item)=>item.slot_id===row.slot_id&&item.availability_state==='working'));els.temporary_absences.innerHTML=working.map((row)=>{const applied=pto.has(row.slot_id)?'PTO already applied':callouts.has(row.slot_id)?'Call-out already applied':'Working in baseline';return `<label class="checkRow"><input type="checkbox" data-callout-slot="${escapeHtml(row.slot_id)}" ${active.has(row.slot_id)?'checked disabled':''}><span><strong>${escapeHtml(row.person_name||row.slot_label)}</strong><small>${applied}</small></span></label>`;}).join('')||'<div class="empty">No working employees.</div>';}
function renderContractors(s,rows){if(manualScheduleView(s)){els.contractor_slots.innerHTML='<div class="empty">For a third missing employee, prepare that employee’s original absence first, then choose approved nonemployee CoverAll on the saved operation. Confirm actual shift and full-hour lunch; reference template hours are not an automatic shift extension.</div>';return;}const date=selectedServiceDate(),active=activeExceptionSlots(s,date,'cover_all'),contractors=rows.filter(r=>r.contractor_capacity);
 els.contractor_slots.innerHTML=contractors.length?contractors.map(row=>{const disabled=active.has(row.slot_id)||!schedulerPermissions().coverall;return `<div class="checkRow" data-contractor-row><input type="checkbox" data-contractor-slot="${escapeHtml(row.slot_id)}" ${active.has(row.slot_id)?'checked':''} ${disabled?'disabled':''}><div><strong>${escapeHtml(row.person_name||row.slot_label)}</strong><small>${active.has(row.slot_id)?'CoverAll already active for this day':'Temporary CoverAll coverage — no employee account or phone required'}</small><div class="inline"><label>Actual start <input data-shift-start type="time" ${disabled?'disabled':''}></label><label>Actual end <input data-shift-end type="time" ${disabled?'disabled':''}></label></div><label>Break <select data-break-choice ${disabled?'disabled':''}><option value="">Select actual arrangement</option><option value="SCHEDULED">Scheduled lunch — enter actual start and end</option><option value="NONE">No break during this shift</option></select></label><div class="inline"><label>Lunch start <input data-lunch-start type="time" ${disabled?'disabled':''}></label><label>Lunch end <input data-lunch-end type="time" ${disabled?'disabled':''}></label></div></div></div>`;}).join(''):'<div class="empty">No approved CoverAll capacity slots are registered.</div>';
}
function renderWeek(s,rows,assignments){const dates=weekDates(s.week_start);els.week_head.innerHTML=`<tr><th>Employee</th>${dates.map((date,index)=>`<th>${DAY_NAMES[new Date(date+'T12:00:00Z').getUTCDay()]}<br>${escapeHtml(date.slice(5))}</th>`).join('')}</tr>`;const byOwner=new Map();for(const assignment of assignments){const key=`${assignment.owner_slot_id||'OPEN'}|${assignment.day_of_week}`;if(!byOwner.has(key))byOwner.set(key,[]);byOwner.get(key).push(assignment);}const displayRows=[...rows.filter(row=>!row.contractor_capacity||assignments.some(a=>a.owner_slot_id===row.slot_id)),{slot_id:'OPEN',slot_label:'Open work',person_name:'Open work'}];els.week_body.innerHTML=displayRows.map((row)=>{const cells=dates.map((date,index)=>{const day=new Date(date+'T12:00:00Z').getUTCDay();const available=availabilityForDate(s,date).find(item=>item.slot_id===row.slot_id);const absent=activeExceptionSlots(s,date,'daily_absence').has(row.slot_id)||activeExceptionSlots(s,date,'pto').has(row.slot_id);if(absent)return '<td><div class="dayOff">Absent / PTO</div></td>';const items=byOwner.get(`${row.slot_id}|${day}`)||[];if(row.slot_id!=='OPEN'&&!row.contractor_capacity&&available?.availability_state!=='working')return `<td><div class="dayOff">${available?.availability_state==='departed_named_absent'?'Absent until replaced':'Not scheduled'}</div></td>`;if(!items.length&&!manualScheduleView(s)?.days?.find(d=>d.serviceDate===date)?.phases.some(p=>p.owners.some(o=>o.slotId===row.slot_id)))return '<td><div class="dayOff">No assigned areas</div></td>';return `<td>${renderManualLoad(s,row.slot_id,date)}${renderManualAssignments(s,row.slot_id,date,items)}</td>`;}).join('');const load=assignments.filter((item)=>item.owner_slot_id===row.slot_id).reduce((sum,item)=>sum+Number(item.workload_points||item.work_snapshot?.serviceEffortMinutes||0),0);const max=Math.max(1,...rows.map((r)=>assignments.filter((item)=>item.owner_slot_id===r.slot_id).reduce((sum,item)=>sum+Number(item.workload_points||item.work_snapshot?.serviceEffortMinutes||0),0)));return `<tr><td><div class="employeeHead">${escapeHtml(row.week_person_names||row.person_name||row.slot_label)}<small>${row.slot_id==='OPEN'?'Requires manager review':manualScheduleView(s)?'Group ratings':`${Math.round(load)} load units`}</small></div>${manualScheduleView(s)?'':`<div class="loadBar ${load/max>.85?'loadHigh':''}"><span style="width:${Math.min(100,Math.round(load/max*100))}%"></span></div>`}</td>${cells}</tr>`;}).join('');}
function manualScheduleView(s){const v=s.approved_manual_schedule;return s.projection_status==='current'&&v?.schema==='custodial.approved-manual-manager-view.v1'&&v.publicationId===s.current_publication?.publication_id&&v.projectionId===s.latest_projection?.projection_id&&Array.isArray(v.groups)&&Array.isArray(v.days)?v:null;}
function renderManualLoad(s,slotId,date){const day=manualScheduleView(s)?.days.find(d=>d.serviceDate===date);if(!day)return '';const ranges=[];for(const phase of day.phases){const owner=phase.owners.find(o=>o.slotId===slotId);if(!owner)continue;const label=phase.zooWideCoverage?'Zoo Wide Coverage':`${owner.points} group rating points`,last=ranges.at(-1);if(last&&last.end===phase.start&&last.label===label)last.end=phase.end;else ranges.push({start:phase.start,end:phase.end,label});}return ranges.length?`<div class="dayLoad">${ranges.map(r=>`<small>${escapeHtml(r.start)}–${escapeHtml(r.end)} · ${escapeHtml(r.label)}</small>`).join('')}</div>`:'';}
function renderManualAssignments(s,slotId,date,items){
 const view=manualScheduleView(s),day=view?.days.find(d=>d.serviceDate===date);
 if(!day)return items.map(renderAssignment).join('');
 const names=new Map(view.groups.map(g=>[g.code,g.name])),ranges=[],reliefRanges=new Map();
 for(const phase of day.phases){const owner=phase.owners.find(o=>o.slotId===slotId);if(!owner)continue;
  for(const code of owner.lunchGroups){const pieces=reliefRanges.get(code)||[],prior=pieces.at(-1);
   if(prior&&prior.end===phase.start)prior.end=phase.end;else pieces.push({start:phase.start,end:phase.end});reliefRanges.set(code,pieces);}
  const groups=owner.groups.map(code=>names.get(code)||code),
   label=phase.zooWideCoverage?'Zoo Wide Coverage':groups.join(', '),detail='',previous=ranges.at(-1);
  if(previous&&previous.end===phase.start&&previous.label===label&&previous.detail===detail)previous.end=phase.end;
  else ranges.push({start:phase.start,end:phase.end,label,detail});
 }
 const relief=[...reliefRanges].flatMap(([code,pieces])=>pieces.map(r=>`<div class="assignment"><strong>Full-hour lunch relief: ${escapeHtml(names.get(code)||code)}</strong><small>${escapeHtml(r.start)}–${escapeHtml(r.end)}</small></div>`)).join('');
 return ranges.map(r=>`<div class="assignment"><strong>${escapeHtml(r.label)}</strong><small>${escapeHtml(r.start)}–${escapeHtml(r.end)}</small></div>`).join('')+relief;
}
function renderAssignment(item){const name=item.location_name||item.work_snapshot?.locationNameSnapshot||item.workSnapshot?.locationNameSnapshot||item.work_id||item.workId;const status=String(item.status||'').toLowerCase();const restroom=/restroom|bathroom|toilet/i.test(`${name} ${item.location_code||''}`);return `<div class="assignment ${status!=='assigned'?'open':restroom?'restroom':''}"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(item.coverage_start||item.work_snapshot?.window?.start||item.workSnapshot?.window?.start||'')} - ${escapeHtml(item.coverage_end||item.work_snapshot?.window?.end||item.workSnapshot?.window?.end||'')}${Number.isInteger(item.approved_group_rating)?` · ${item.approved_group_rating} points`:''} • ${status||'assigned'}</small></div>`;}
function renderChanges(s){
 let originals;try{originals=canonicalAbsenceTargets(s);}catch(error){els.changes_list.innerHTML='<div class="empty">Original accepted absence targets cannot be verified. No original cancellation is available until refreshed.</div>';throw error;}
 const sourceIds=new Set(originals.map(row=>row.staffingAbsenceId));
 const exceptions=effectiveExceptions(s).filter(row=>!isCanonicalStaffingAbsence(row)||!sourceIds.has(row.staffingAbsenceId));
 const sourceRows=originals.map(row=>{
  const target=originalAbsenceTarget(row),today=s.current_service_date,knownDay=validServerDate(today),start=knownDay&&today>target.staffingStartDate?today:target.staffingStartDate;
  const remaining=knownDay?`Remaining ${start} through ${target.staffingEndDate}`:'Server civil date unavailable — cancellation held';
  const blocked=state.busy||!!state.pending||!!state.approvedPending||!knownDay||!s.current_publication;
  return `<div class="listRow"><div><strong>Canonical accepted ${escapeHtml(labelType(row.absenceKind))}</strong><small>Original employee ${escapeHtml(target.staffingEmployeeId)} • Original ${escapeHtml(target.staffingStartDate)} through ${escapeHtml(target.staffingEndDate)} • ${escapeHtml(remaining)}. Cancel only the remaining original fact; use the current plan, never reactivate old people.</small></div><button class="iconBtn small" ${schedulerPermissions().absences?'':'hidden'} ${blocked?'disabled':''} type="button" data-cancel-original-absence="${escapeHtml(target.staffingAbsenceId)}" title="Preview original absence cancellation" aria-label="Preview cancellation of original ${escapeHtml(labelType(row.absenceKind))}"><span data-lucide="undo-2"></span></button></div>`;
 });
 const datedRows=exceptions.map((row)=>`<div class="listRow"><div><strong>${escapeHtml(labelType(row.type))}</strong><small>${escapeHtml(row.serviceDate)} • ${escapeHtml(row.reason||'Accepted manager change')}</small></div><button class="iconBtn small" ${canReverseDated(s,row)?'':'hidden'} type="button" data-reverse-exception="${escapeHtml(row.id)}" title="Remove change" aria-label="Remove ${escapeHtml(labelType(row.type))}"><span data-lucide="undo-2"></span></button></div>`);
 els.changes_list.innerHTML=sourceRows.length||datedRows.length?sourceRows.join('')+datedRows.join(''):'<div class="empty">No dated changes are active for this week.</div>';
}
function renderReadiness(s,assignments){const checks=[['Scheduler service',Boolean(state.baseUrl)],['Named manager session',schedulerPermissions().read],['Registered source',Boolean(s.sources?.length)],['Published baseline',Boolean(s.current_publication)],['Draft waiting',Boolean(s.drafts?.length)],['Current staffing projection',Boolean(s.latest_projection)&&s.projection_status==='current'],['All required work assigned',s.projection_status==='current'&&assignments.length>0&&!assignments.some(row=>String(row.status).toLowerCase()!=='assigned')]];els.readiness_list.innerHTML=checks.map(([label,ok])=>`<div><strong>${escapeHtml(label)}</strong><span class="pill ${ok?'ok':'warn'}">${ok?'Ready':'Attention'}</span></div>`).join('');}
function displayAssignments(s){if(projectionNeedsRebuild(s))return[];const projected=s.latest_projection?.assignments;const ratings=new Map((manualScheduleView(s)?.groups||[]).map(g=>[g.code,g.score]));return Array.isArray(projected)&&projected.length?projected.map((row)=>({...row,approved_group_rating:ratings.get(row.work_snapshot?.locationCodeSnapshot||row.workSnapshot?.locationCodeSnapshot),owner_name:activeRoster(s).find((item)=>item.slot_id===(row.owner_slot_id||row.slotId))?.person_name,owner_slot_id:row.owner_slot_id||row.slotId,day_of_week:row.service_date||row.serviceDate?new Date(`${row.service_date||row.serviceDate}T12:00:00Z`).getUTCDay():Number(row.day_of_week),location_name:row.work_snapshot?.locationNameSnapshot||row.workSnapshot?.locationNameSnapshot,coverage_start:row.work_snapshot?.window?.start||row.workSnapshot?.window?.start,coverage_end:row.work_snapshot?.window?.end||row.workSnapshot?.window?.end,workload_points:row.work_snapshot?.serviceEffortMinutes||row.workSnapshot?.serviceEffortMinutes})):Array.isArray(s.assignments)?s.assignments:[];}
function rosterForDate(s,date){const day=new Date(`${date}T12:00:00Z`).getUTCDay();return(Array.isArray(s.roster)?s.roster:[]).map(slot=>{
 const week=Array.isArray(slot.week_staffing)?slot.week_staffing:[],dated=week.filter(x=>x.service_date===date);
 const incumbents=(slot.incumbencies||[]).filter(x=>x.effective_start<=date&&(!x.effective_end||date<x.effective_end));
 const current=incumbents.length===1?incumbents[0]:{},staffing=dated.length===1?dated[0]:null;
 const fallback=availabilityForDate(s,date).find(x=>x.slot_id===slot.slot_id)||{};
 const identity=staffing||current;const valid=dated.length<=1&&incumbents.length<=1;
 const names=[...new Set(week.map(x=>x.person_name).filter(Boolean))];
 return{...slot,...staffing,person_name:valid?identity.person_name:null,person_id:valid?identity.person_id:null,
   staffing_identity_valid:valid,week_person_names:names.join(' / '),availability_state:staffing?.availability_state||fallback.availability_state||null,
   device_ids:Array.isArray(staffing?.device_ids)?staffing.device_ids:[]};
 });}
function activeRoster(s){return rosterForDate(s,selectedServiceDate());}
function effectiveStaffing(s,date){
 const rows=rosterForDate(s,date),availability=availabilityForDate(s,date),working=new Set(),absent=new Set(),partial=new Set();
 const fullAway=new Set([...activeExceptionSlots(s,date,'daily_absence'),...activeExceptionSlots(s,date,'pto')]);const part=activeExceptionSlots(s,date,'partial_absence');
 for(const row of rows){if(row.contractor_capacity||!row.person_id||!row.staffing_identity_valid)continue;
  if(fullAway.has(row.slot_id)||row.availability_state==='departed_named_absent'){absent.add(row.person_id);continue;}
  if(row.availability_state==='working'||availability.some(x=>x.slot_id===row.slot_id&&x.availability_state==='working')){working.add(row.person_id);if(part.has(row.slot_id))partial.add(row.person_id);}}
 const contractors=activeExceptionSlots(s,date,'cover_all');
 return{working:working.size,absent:absent.size,partial:partial.size,vacant:rows.filter(r=>!r.contractor_capacity&&!r.person_id).length,
  contractors:rows.filter(r=>r.contractor_capacity&&contractors.has(r.slot_id)).length};
}
function availabilityForDate(s,date){const day=new Date(`${date}T12:00:00Z`).getUTCDay();return (s.availability||[]).filter((row)=>row.service_date?row.service_date===date:Number(row.day_of_week)===day);}
function effectiveExceptions(s){const rows=Array.isArray(s.exceptions)?s.exceptions:[];const reversed=new Set(rows.filter(r=>r.type==='reverse').map(r=>r.reversesExceptionId||r.reverses_exception_id||r.payload?.reversesExceptionId).filter(Boolean));return rows.filter(r=>r.type!=='reverse'&&!r.reversed_at&&r.reversed!==true&&!reversed.has(r.id));}
function activeExceptionSlots(s,date,type){return new Set(effectiveExceptions(s).filter(r=>r.serviceDate===date&&r.type===type).map(r=>r.payload?.slotId||r.payload?.availability?.slotId).filter(Boolean));}
function projectionNeedsRebuild(s){return s.projection_status!=='current';}
function validCivilDate(value){const date=new Date(`${value}T12:00:00Z`);if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error('Enter a valid calendar date (YYYY-MM-DD).');return value;}
function selectedServiceDate(){const date=validCivilDate(els.service_date.value),window=state.snapshot||state.initialSelection;if(window&&(date<window.week_start||date>window.week_end))throw new Error('The service date must be inside the selected schedule.');return date;}
function weekDates(start){const date=new Date(`${validCivilDate(start)}T12:00:00Z`);return Array.from({length:7},(_,index)=>new Date(date.getTime()+index*86400000).toISOString().slice(0,10));}
function mondayOf(value){const date=new Date(`${validCivilDate(value)}T12:00:00Z`);const day=date.getUTCDay();date.setUTCDate(date.getUTCDate()-((day+6)%7));return date.toISOString().slice(0,10);}
function formatDate(value){return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});}
function commandId(label){return `${label}-${Date.now()}-${crypto.randomUUID()}`;}
function selectView(view){document.querySelectorAll('[data-view]').forEach((button)=>button.classList.toggle('active',button.dataset.view===view));document.querySelectorAll('.panel').forEach((panel)=>panel.classList.toggle('active',panel.id===`${view}-panel`));}
function applyHashRoute(){const hash=String(location.hash||'').slice(1).toLowerCase();const targetByHash={coverage:'coverage-section',absence:'absence-section','day-changes':'day-changes-section'};if(hash==='changes'){selectView('changes');document.querySelector('.main')?.scrollIntoView({block:'start'});return;}const target=document.getElementById(targetByHash[hash]);if(target)target.scrollIntoView({block:'start'});}
async function busy(work){if(state.busy)return;if(state.unresolvedPreview){state.unresolvedPreview=null;renderApprovedPreview();}state.busy=true;setControls();try{return await work();}catch(error){
 const unresolved=unresolvedPreviewFailures.get(error);
 if(unresolved){try{requireUnresolvedPreviewCurrent(unresolved.binding);state.preview=null;state.staffingPreview=null;state.unresolvedPreview=unresolved;renderApprovedPreview();}
  catch(stale){state.preview=null;state.staffingPreview=null;state.unresolvedPreview=null;renderApprovedPreview();error=stale;}}
 const accepted=state.pending?.state==='ACCEPTED'||state.approvedPending?.acceptance;setStatus((accepted?'Changes accepted; current readback remains pending. ':'')+safe(error),'error');return null;
 }finally{state.busy=false;setControls();}}
function setControls(){const p=schedulerPermissions(),blocked=state.busy||state.manualBusy||state.accessDenied||!!state.pending||!!state.approvedPending||!!state.manualPending;const printLink=document.getElementById('coverall-print-link'),snapshot=state.snapshot,date=els.service_date.value;
 if(state.unresolvedPreview){try{requireUnresolvedPreviewCurrent(state.unresolvedPreview.binding);}catch{state.unresolvedPreview=null;state.preview=null;state.staffingPreview=null;renderApprovedPreview();}}
 const printReady=!blocked&&snapshot?.projection_status==='current'&&Number.isSafeInteger(snapshot.authority_revision)&&snapshot.authority_revision>=0&&snapshot.current_publication?.publication_id&&snapshot.latest_projection?.projection_id&&weekDates(snapshot.week_start).includes(date);
 printLink.hidden=!p.coverall||!printReady;printLink.href=printReady?'./coverall-print.html?'+new URLSearchParams({date,expected_revision:String(snapshot.authority_revision),projection_id:snapshot.latest_projection.projection_id}):'./coverall-print.html';els.refresh_btn.disabled=state.busy;
 const normalLocked=state.manualActivationPanel?.normalLocked()===true;els.generate_btn.hidden=!p.management||normalLocked;els.publish_btn.hidden=!p.management||normalLocked;els.generate_btn.disabled=blocked||(!state.snapshot?.current_publication&&!document.getElementById('approved-source').value);els.publish_btn.disabled=blocked||!state.preview||!!state.unresolvedPreview;
 els.rebuild_projection_btn.hidden=!p.routes||!state.snapshot?.current_publication||normalLocked;els.rebuild_projection_btn.disabled=blocked||!state.snapshot?.current_publication;
 els.apply_day_btn.hidden=!p.absences;els.apply_day_btn.disabled=blocked||!state.snapshot?.current_publication;
 if(p.absences)els.apply_day_btn.textContent='Preview One Absence / Update Routes';
 els.week_start.disabled=blocked;els.service_date.disabled=blocked;els.absence_type.disabled=blocked||!p.absences;
 const absenceEnd=document.getElementById('absence-end-date');if(absenceEnd)absenceEnd.disabled=blocked||!p.absences;
 for(const input of document.querySelectorAll('[data-callout-slot]:not(:checked)'))input.disabled=blocked||!p.absences;
 for(const input of document.querySelectorAll('[data-contractor-slot]:not(:checked)'))input.disabled=blocked||!p.coverall;
 const saved=state.pending||state.approvedPending,accepted=saved?.state==='ACCEPTED'||!!saved?.acceptance;
 const resumeAllowed=p.read&&!!saved&&(accepted||(state.approvedPending?p.management:window.MemphisSchedulerActions.authorized(window.MemphisAuth,saved.path,saved.body)));
 renderStaffingHistory();const archive=document.getElementById('scheduler-preserve-expired');if(archive){archive.hidden=!canArchiveElapsedStaffing(state.pending);archive.disabled=state.busy||!canArchiveElapsedStaffing(state.pending);}
 state.manualActivationPanel?.refreshControls();if(normalLocked)document.getElementById('approved-source-panel').hidden=true;
 document.getElementById('scheduler-retry').disabled=state.busy||!resumeAllowed||saved?.state==='REJECTED';document.getElementById('scheduler-retry').hidden=saved?.state==='REJECTED';document.getElementById('scheduler-dismiss').disabled=state.busy;document.getElementById('approved-source').disabled=blocked||!p.management;
 const staffingConfirm=document.getElementById('staffing-confirm-btn');if(staffingConfirm){staffingConfirm.hidden=!state.staffingPreview&&!state.unresolvedPreview;staffingConfirm.disabled=state.busy||!p.absences||!state.staffingPreview||!!state.unresolvedPreview||state.pending?.command?.confirmationAttempted===true||!!state.pending?.command?.cancellationAttempt||staffingDateUnavailable();}
 const prepareRetry=document.getElementById('scheduler-prepare-retry');if(prepareRetry){prepareRetry.hidden=!missingPatternOriginal(state.pending);prepareRetry.disabled=state.busy||!p.absences||!missingPatternOriginal(state.pending);}
 const coverallButton=document.getElementById('scheduler-coverall-choice');if(coverallButton){coverallButton.hidden=!coverAllOriginalEligible(state.pending);coverallButton.disabled=state.busy||!coverAllOriginalEligible(state.pending);}
 const coverallSubmit=document.getElementById('third-coverall-prepare');if(coverallSubmit)coverallSubmit.disabled=state.busy||!coverAllOriginalEligible(state.pending)||!!state.pending?.command?.coverallAttempt;
 const cancelPreparation=document.getElementById('scheduler-cancel-preparation');if(cancelPreparation){cancelPreparation.hidden=!canCancelUnpublishedPreparation(state.pending);cancelPreparation.disabled=state.busy||!canCancelUnpublishedPreparation(state.pending);}
 // These controls are rendered during a busy snapshot read. Re-evaluate them
 // when that read settles, using the same current source/target guards.
 if(state.snapshot&&!state.accessDenied)renderChanges(state.snapshot);
}
function needSnapshot(){if(!state.snapshot)throw new Error('Load the weekly scheduler first.');return state.snapshot;}
function setStatus(text,type=''){els.status.textContent=text;els.status.className=`status ${type}`.trim();}
function labelType(value){return String(value||'change').replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase());}
function safe(error){return error?.message?String(error.message):String(error||'Unknown error');}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}

function canReverseDated(snapshot,row){if(isCanonicalStaffingAbsence(row)||typedCoverAllOperation(row))return schedulerPermissions().absences;if(schedulerPermissions().management)return true;if(!schedulerPermissions().absences)return false;if(['daily_absence','partial_absence','pto','cover_all'].includes(row.type))return true;return row.type==='lunch'&&activeRoster(snapshot).some(r=>r.contractor_capacity&&r.slot_id===row.payload?.slotId);}
function missingPatternOriginal(r){const issue=r?.command?.preparationIssue,principal=window.MemphisSchedulerActions.principal(window.MemphisAuth);
 return !state.accessDenied&&window.MemphisSchedulerActions.isStaffingCommand(r)&&r.state==='PENDING'&&r.command.phase==='PREPARING'&&!r.command.confirmationAttempted&&!r.command.cancellationAttempt&&!r.command.coverallAttempt&&!staffingDateUnavailable()
  &&issue?.code===missingStaffingPatternCode&&issue.message===missingStaffingPatternMessage
  &&window.MemphisSchedulerActions.same(issue.principal,principal)&&(!state.principal||window.MemphisSchedulerActions.same(state.principal,principal))
  &&issue.encoded===r.encoded&&issue.operationId===r.command.operationId&&issue.semanticDigest===r.command.semanticDigest
  &&JSON.stringify(issue.weekBindings)===JSON.stringify(window.MemphisSchedulerActions.staffingBindings(r));
}

function canArchiveElapsedStaffing(r){const status=state.actions?.staffingDateStatus?.();return !state.busy&&!state.accessDenied&&schedulerPermissions().absences&&window.MemphisSchedulerActions.isStaffingCommand(r)&&r.state==='PENDING'&&['PREPARING','PREPARED'].includes(r.command.phase)&&status?.state==='EXPIRED'&&r.body.end_date<status.currentServiceDate&&!r.command.confirmationAttempted&&!r.command.confirmationKey&&!r.command.preparationUnknown&&!r.command.cancellationAttempt&&(!r.command.coverallAttempt||r.command.coverallAttempt.phase==='PREPARED');}
async function preserveElapsedOriginalForNewRequest(){const r=state.actions?.pending();if(!canArchiveElapsedStaffing(r))throw Error('Read the fully elapsed original first. UNKNOWN or still-active work cannot be replaced.');
 const original=JSON.stringify(r);if(!await confirmAction('Preserve this complete elapsed original in read-only browser history and open a separate new dated request? The original server request remains unchanged. No new request is sent and no date is shifted.',{title:'Preserve elapsed original',confirmLabel:'Preserve and start separately'}))return;
 if(JSON.stringify(state.actions.pending())!==original||!canArchiveElapsedStaffing(state.actions.pending()))throw Error('The original request changed; nothing was released.');
 await busy(async()=>{await state.actions.archiveElapsedStaffingOriginal();state.staffingPreview=null;state.coverallSelection=null;state.unresolvedPreview=null;await refreshSnapshot();renderPending();setStatus('The complete elapsed original is preserved in read-only history. Choose and review new current or future dates explicitly; the new request will use a separate identity.','done');});
}
function renderStaffingHistory(){let panel=document.getElementById('scheduler-original-history');if(!panel){panel=document.createElement('section');panel.id='scheduler-original-history';panel.className='status';document.getElementById('scheduler-pending-panel').parentNode.insertBefore(panel,document.getElementById('scheduler-pending-panel'));}
 panel.hidden=state.accessDenied||!schedulerPermissions().read;if(panel.hidden)return;const rows=state.actions?.expiredStaffingHistory?.()||[];panel.hidden=!rows.length;if(panel.hidden)return;
 panel.innerHTML='<h3>Preserved elapsed originals — read only</h3><p>These original server requests were not cancelled or accepted by moving them here. Request keys are kept privately in this browser and are not displayed.</p>'+rows.map(r=>'<div><span>'+escapeHtml(r.startDate+' through '+r.endDate+' · '+r.commandKind+' · observed '+r.observedState)+'</span> <button type="button" class="btn secondary" data-history-original="'+escapeHtml(r.operationId)+'">Read original status</button></div>').join('');
 for(const b of panel.querySelectorAll('[data-history-original]')){b.disabled=state.busy||!schedulerPermissions().absences;b.addEventListener('click',()=>busy(async()=>{const v=await state.actions.readExpiredStaffingOriginal(b.dataset.historyOriginal);setStatus('Preserved original '+v.startDate+' through '+v.endDate+': '+v.state+'. Read only; no request was resent.');}));}
}

function renderPending(){renderStaffingHistory();if(state.accessDenied){document.getElementById('scheduler-pending-panel').hidden=true;return;}const r=state.pending||state.approvedPending,panel=document.getElementById('scheduler-pending-panel');panel.hidden=!r;
 let prepareRetry=document.getElementById('scheduler-prepare-retry');if(!prepareRetry){prepareRetry=document.createElement('button');prepareRetry.id='scheduler-prepare-retry';prepareRetry.type='button';prepareRetry.className='btn secondary';prepareRetry.textContent='Retry original preparation';prepareRetry.addEventListener('click',()=>busy(retryMissingStaffingPreparation));panel.append(prepareRetry);}
 prepareRetry.hidden=!missingPatternOriginal(r);prepareRetry.disabled=state.busy||!schedulerPermissions().absences;
 let cancelPreparation=document.getElementById('scheduler-cancel-preparation');if(!cancelPreparation){cancelPreparation=document.createElement('button');cancelPreparation.id='scheduler-cancel-preparation';cancelPreparation.type='button';cancelPreparation.className='btn secondary';cancelPreparation.textContent='Cancel unpublished preparation';cancelPreparation.addEventListener('click',()=>busy(cancelUnpublishedPreparation));panel.append(cancelPreparation);}
 cancelPreparation.hidden=!canCancelUnpublishedPreparation(r);cancelPreparation.disabled=state.busy||!canCancelUnpublishedPreparation(r);
 let coverallButton=document.getElementById('scheduler-coverall-choice');if(!coverallButton){coverallButton=document.createElement('button');coverallButton.id='scheduler-coverall-choice';coverallButton.type='button';coverallButton.className='btn secondary';coverallButton.addEventListener('click',()=>busy(readThirdCoverAllOptions));panel.append(coverallButton);}
 coverallButton.hidden=!coverAllOriginalEligible(r);coverallButton.disabled=state.busy||!coverAllOriginalEligible(r);coverallButton.textContent=r?.command?.coverallAttempt?'Read original CoverAll choice/status':'Choose approved CoverAll for third absence';
 renderThirdCoverAll();
 let archive=document.getElementById('scheduler-preserve-expired');if(!archive){archive=document.createElement('button');archive.id='scheduler-preserve-expired';archive.type='button';archive.className='btn secondary';archive.textContent='Preserve expired original / start separately';archive.addEventListener('click',()=>preserveElapsedOriginalForNewRequest().catch(error=>setStatus(safe(error),'error')));panel.append(archive);}
 archive.hidden=!canArchiveElapsedStaffing(r);archive.disabled=state.busy||!canArchiveElapsedStaffing(r);
 if(!r)return;document.getElementById('scheduler-pending-text').textContent=(r.state==='ACCEPTED'||r.acceptance)?'Changes were accepted; current route readback is pending.':r.state==='REJECTED'?`Request rejected: ${r.error}. Refresh before making a corrected request.`:'A dated scheduler request is saved. Resume it with the same operation identity; do not submit another.';document.getElementById('scheduler-dismiss').hidden=r.state!=='REJECTED';document.getElementById('scheduler-retry').textContent=(r.state==='ACCEPTED'||r.acceptance)?'Verify accepted routes':'Resume exact request';
 if(window.MemphisSchedulerActions.isStaffingCommand(r)&&r.state!=='ACCEPTED'){
  document.getElementById('scheduler-pending-text').textContent=r.command.confirmationAttempted?'The original staffing confirmation outcome is unresolved. Read its exact operation; do not confirm again.':'An original private staffing operation is saved. Read its prepared candidate before one confirmation.';
  document.getElementById('scheduler-retry').textContent=r.command.confirmationAttempted?'Read original confirmation outcome':'Read original staffing status';
  if(missingPatternOriginal(r)){document.getElementById('scheduler-pending-text').textContent='Last preparation: '+missingStaffingPatternMessage+' No confirmation is available. Resume only reads the original; retry preparation separately after a current basis check.';
   document.getElementById('scheduler-retry').textContent='Read original preparation status';document.getElementById('scheduler-dismiss').hidden=true;}
  if(r.command.preparationUnknown){document.getElementById('scheduler-pending-text').textContent='The original preparation outcome is UNKNOWN. Read original status only; do not prepare, cancel or replace it.';document.getElementById('scheduler-retry').textContent='Read original preparation outcome';document.getElementById('scheduler-dismiss').hidden=true;}
   const dateStatus=state.actions?.staffingDateStatus?.();if(dateStatus&&['EXPIRED','UNAVAILABLE'].includes(dateStatus.state)){document.getElementById('scheduler-pending-text').textContent=dateStatus.message;document.getElementById('scheduler-retry').textContent='Read original status only';document.getElementById('scheduler-dismiss').hidden=true;}
   if(r.command.cancellationAttempt){document.getElementById('scheduler-pending-text').textContent='An original unpublished cancellation was attempted. Its outcome is unconfirmed until exact original GET readback. No cancellation or confirmation will be resent; protected history is retained.';
   document.getElementById('scheduler-retry').textContent='Read original cancellation outcome';document.getElementById('scheduler-dismiss').hidden=true;}
 }
}
async function runDated(path,body,message='Applying dated changes and regenerating routes...'){setStatus(message);await state.actions.run(path,body);try{await refreshSnapshot();}catch(error){setStatus('Changes accepted, but route readback is unavailable. The saved receipt is retained. '+safe(error),'error');throw error;}}

function populateApprovedChoices(data,initial=false){
 const panel=document.getElementById('approved-source-panel');panel.hidden=!schedulerPermissions().management;if(panel.hidden)return;
 const select=document.getElementById('approved-source'),previous=select.value,week=state.snapshot?.week_start||state.initialSelection?.week_start;
 select.replaceChildren(new Option(state.snapshot?.current_publication?'Use the currently published approved pattern':'Select an approved initial pattern',''));
 for(const row of data.initial)select.add(new Option(`${row.staffing_count} staff · ${row.template_id} · effective ${row.effective_start}`,row.source_id));
 if([...select.options].some(o=>o.value===previous))select.value=previous;
 if(!state.snapshot?.current_publication&&select.options.length===2&&data.initial[0].effective_start===week)select.selectedIndex=1;
 document.getElementById('approved-source-state').textContent=select.options.length>1?'Select an approved pattern for its listed effective week. Nothing is published by selecting it.':'No approved initial patterns are registered. No replacement is generated.';
}
async function loadApprovedChoices(requestedWeek,arrival){const panel=document.getElementById('approved-source-panel');panel.hidden=!schedulerPermissions().management;if(panel.hidden)return;
 const currentArrival=()=>state.previewSelection===arrival&&els.week_start.value===requestedWeek;
 try{const data=await api('/static-weekly/approved-choices');if(!currentArrival())return;if(data?.schema!=='custodial.approved-schedule-choices.v1'||!Array.isArray(data.initial))throw new Error('Approved source list is unavailable.');state.approvedChoices=data;populateApprovedChoices(data);}
 catch(error){if(!currentArrival())return;if(state.accessDenied)throw error;state.approvedChoices=null;document.getElementById('approved-source').replaceChildren(new Option('Unavailable',''));document.getElementById('approved-source-state').textContent=safe(error);}
}

function approvedAssignmentName(item){if(item.status==='OPEN')return 'Open';
 const roster=state.snapshot?rosterForDate(state.snapshot,item.serviceDate):[],who=roster.find(r=>r.slot_id===item.slotId&&r.person_id===item.personId&&r.staffing_identity_valid);
 return who?.person_name||item.displayName||item.personId||'Unknown employee';
}
function clockMinute(value){return typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value)?Number(value.slice(0,2))*60+Number(value.slice(3)):null;}
function sourceWindow(value){const start=clockMinute(value?.start),end=clockMinute(value?.end);return start!==null&&end!==null&&end>start?{start,end}:null;}
function clockRange(value){return sourceWindow(value)?`${value.start}–${value.end}`:'Time unavailable';}
function minutes(value){return Number.isSafeInteger(value)&&value>=0?value:null;}
// Mirror the source's protected-window union, not its weighted effort index.
// This is available shift time BEFORE work/travel, never remaining free time.
function availableShiftMinutes(available){const shift=sourceWindow(available.shift),lunch=sourceWindow(available.lunch),blocked=available.blockedWindows??[];
 if(available.status!=='working'||!shift||!lunch||!Array.isArray(blocked)||blocked.length>1000||!(available.productiveCapacityProvenance||available.capacityProvenance||available.productiveCapacityProvenanceDigest||available.capacityProvenanceDigest))return null;
 const windows=[lunch,...blocked.map(sourceWindow)];if(windows.some(window=>!window))return null;
 const intervals=windows.map(window=>({start:Math.max(shift.start,window.start),end:Math.min(shift.end,window.end)})).filter(window=>window.end>window.start).sort((a,b)=>a.start-b.start||a.end-b.end);
 let excluded=0,end=shift.start;for(const interval of intervals){excluded+=Math.max(0,interval.end-Math.max(end,interval.start));end=Math.max(end,interval.end);}return shift.end-shift.start-excluded;
}
function previewList(rows,format){return rows.slice(0,40).map(format).join('; ')+(rows.length>40?`; ${rows.length-40} additional records not displayed`:'');}
function renderApprovedCapacity(view,assignments,lunch,metrics=null,append=false){const body=document.getElementById('approved-preview-capacity-rows');if(!body)return;if(!append)body.replaceChildren();const availability=Array.isArray(view?.projectionAvailability)?view.projectionAvailability:[];
 if(!availability.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=6;cell.textContent='Validated per-person availability is unavailable for this preview.';row.append(cell);body.append(row);return;}
 const loans=Array.isArray(lunch?.responsibilities)?lunch.responsibilities:[];
 for(const available of availability.slice(0,1792).sort((a,b)=>String(a.serviceDate).localeCompare(String(b.serviceDate))||String(a.slotId).localeCompare(String(b.slotId)))){const date=available.serviceDate||'Date unavailable',person=available.incumbentPersonId||null,capacityId=available.ownerKind==='CONTRACTOR_CAPACITY'?available.capacityId:null,dayAssignments=assignments.filter(item=>item.status==='ASSIGNED'&&item.serviceDate===date&&item.slotId===available.slotId&&(person&&item.personId===person||capacityId&&item.capacityId===capacityId&&item.personId===null));
  const personLunch=loans.filter(item=>item.service_date===date&&person&&item.coverer_person_id===person&&item.coverer_slot_id===available.slotId);
  const workText=dayAssignments.length?previewList(dayAssignments,item=>{const effort=minutes(item.serviceEffortMinutes);return `${String(item.locationNameSnapshot||item.locationName||item.planWorkId||'Duty').slice(0,160)} ${clockRange(item.window)}${effort!==null?` · ${effort} ${item.effortUnit||'workload points'}`:''}`;}):'No assigned work in this preview';
  const lunchText=`Own lunch ${clockRange(available.lunch)}`+(personLunch.length?`; ${previewList(personLunch,item=>{const work=(item.segments||[]).map(segment=>dayAssignments.find(a=>a.planWorkId===segment.planWorkId)?.locationName||assignments.find(a=>a.planWorkId===segment.planWorkId)?.locationName||segment.workId||'Named duty unavailable');return `Full-hour lunch relief ${clockRange({start:item.coverage_start,end:item.coverage_end})} · ${work.join(', ')}`;})}`:'');
  const sourceLoads=metrics?.daily?.find(day=>day.dayOfWeek===available.dayOfWeek)?.loads,sourceLoad=Array.isArray(sourceLoads)?sourceLoads.find(load=>load.slotId===available.slotId):null;
  const capacity=availableShiftMinutes(available),sourceCapacity=minutes(sourceLoad?.productiveCapacityMinutes),capacityText=capacity!==null?`${capacity} min available before assigned work`:sourceCapacity!==null?`${sourceCapacity} source productive-capacity min; not remaining free time`:'Available time unknown';
  const name=capacityId?`CoverAll capacity · ${available.incumbentSlotLabel||capacityId}`:available.incumbentName||person||'Person unavailable';
  const values=[date,name,`${available.status||'Availability unavailable'} · ${clockRange(available.shift)} · ${capacityText}`,workText,lunchText,'Unknown — physical work and travel durations are not provided'];const row=document.createElement('tr');for(const value of values){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}body.append(row);
 }
 if(availability.length>1792){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=6;cell.textContent=`${availability.length-1792} additional availability records not displayed.`;row.append(cell);body.append(row);}
}
function staffingConfirmButton(){let button=document.getElementById('staffing-confirm-btn');if(!button){button=document.createElement('button');button.id='staffing-confirm-btn';button.type='button';button.className='btn primary';button.textContent='Confirm Reviewed Staffing';button.addEventListener('click',()=>confirmStaffingPreview().catch(error=>setStatus(safe(error),'error')));document.getElementById('approved-preview-panel').append(button);}return button;}
function renderStaffingPreview(){const choice=state.staffingPreview,saved=state.pending,button=staffingConfirmButton();
 const panel=document.getElementById('approved-preview-panel');panel.hidden=!choice;button.hidden=!choice;if(!choice)return;
 window.MemphisSchedulerActions.validateStaffingPreview(choice.value,saved);requireStaffingContext(choice.context);
 const weeks=choice.value.preview.weeks,rows=[],weekRows=[];
 document.querySelector('#approved-preview-panel h2').textContent=saved.body.command_kind==='cancel_absence'?'Cancel remaining original absence — private preview, not published':'Private staffing preview — not published';
 for(const week of weeks){const availability=week.projectionAvailability;
 const datedRows=week.assignments.map(item=>{const source=availability.find(a=>a.serviceDate===item.service_date&&a.slotId===item.owner_slot_id
  &&(item.owner_person_id&&a.incumbentPersonId===item.owner_person_id||item.owner_kind==='CONTRACTOR_CAPACITY'&&a.ownerKind==='CONTRACTOR_CAPACITY'&&a.capacityId===item.capacity_id));
  return{serviceDate:item.service_date,personId:item.owner_person_id??null,capacityId:item.capacity_id??null,slotId:item.owner_slot_id,status:String(item.status).toUpperCase(),
   displayName:item.owner_kind==='CONTRACTOR_CAPACITY'?`CoverAll capacity · ${source?.incumbentSlotLabel||item.capacity_id||'identity unavailable'}`:source?.incumbentName||item.owner_person_id||'Person unavailable',
   window:item.work_snapshot?.window,locationName:item.work_snapshot?.locationNameSnapshot,planWorkId:item.plan_work_id,serviceEffortMinutes:item.work_snapshot?.serviceEffortMinutes,
   effortUnit:item.work_snapshot?.schedulingMode==='flexible_coverage_ownership'?'workload points (not elapsed minutes)':'source effort min (not measured completion)'};});
 rows.push(...datedRows);weekRows.push({week,rows:datedRows});}
 const numeric=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?String(value):'unknown';
 const facts=weeks.map(week=>{const order=Array.isArray(week.objective?.rankingOrder)?week.objective.rankingOrder.slice(0,16).map(value=>String(value).slice(0,180)).join(' → '):'not provided';
 return `${week.week_start}: actual policy ${order}; relative weekly equity index ${numeric(week.metrics?.weekly?.normalizedInequity)}; directed route cost ${numeric(week.metrics?.weekly?.incrementalDirectedRouteCost)}; geometry binding ${typeof week.geographyDigest==='string'?week.geographyDigest:'unknown'}`;}).join(' | ');
 const early=rows.filter(row=>{const window=sourceWindow(row.window);return window&&window.start<540&&window.end>0;}).length;
 document.getElementById('approved-preview-summary').textContent=`Operation ${saved.command.operationId} · ${saved.body.start_date} through ${saved.body.end_date} · ALL ${weeks.length} remaining weeks · ${rows.length} staged duties · revision ${saved.body.expected_revision}.${saved.body.command_kind==='cancel_absence'?` Original target ${saved.body.target_absence_id}, original employee ${saved.body.employee_id}; returns to the CURRENT effective plan, never a historical restore.`:''} ${early} source windows intersect before 09:00; opening-critical classification and performed readiness are not established. ${facts}. Relative weekly equity index is not a ≤0.5 component-weight proof; flexible proximity scores are not elapsed travel. Physical duration/time-feasibility and optimal opening/balance are not established.`;
 const body=document.getElementById('approved-preview-rows');body.replaceChildren();for(const item of rows){const row=document.createElement('tr');for(const value of[item.serviceDate,item.status==='ASSIGNED'?item.displayName:item.status,item.locationName||item.planWorkId,clockRange(item.window)]){const cell=document.createElement('td');cell.textContent=String(value??'Not provided');row.append(cell);}body.append(row);}
 for(const [index,part] of weekRows.entries())renderApprovedCapacity(part.week,part.rows,{responsibilities:part.week.lunch_responsibilities},part.week.metrics,index>0);
 button.disabled=state.busy||!schedulerPermissions().absences||saved.command.confirmationAttempted;
}
function renderApprovedUnresolvedPreview(){
 const choice=state.unresolvedPreview,panel=document.getElementById('approved-preview-panel');
 try{requireUnresolvedPreviewCurrent(choice.binding);}catch{state.unresolvedPreview=null;state.preview=null;state.staffingPreview=null;panel.hidden=true;
  document.getElementById('approved-preview-rows').replaceChildren();document.getElementById('approved-preview-capacity-rows').replaceChildren();
  const confirm=document.getElementById('staffing-confirm-btn');if(confirm){confirm.hidden=true;confirm.disabled=true;}return;}
 const value=choice.value;panel.hidden=false;
 document.querySelector('#approved-preview-panel h2').textContent='Unresolved approved coverage — not published';
 document.getElementById('approved-preview-summary').textContent=`${value.serviceDate} · revision ${value.authorityRevision} · ${value.unresolved.length} unresolved windows. Nothing can be confirmed; the original request and current schedule are retained.`;
 const body=document.getElementById('approved-preview-rows');body.replaceChildren();document.getElementById('approved-preview-capacity-rows').replaceChildren();
 for(const item of value.unresolved){
  const known=state.snapshot.projection_status==='current'?displayAssignments(state.snapshot).filter(row=>(row.service_date||row.serviceDate)===value.serviceDate
   &&(row.work_snapshot||row.workSnapshot)?.workId===item.parentWorkId):[];
  const names=[...new Set(known.map(row=>(row.work_snapshot||row.workSnapshot).locationNameSnapshot).filter(name=>typeof name==='string'&&name.trim()))];
  const label=names.length===1?names[0]:'Unresolved duty — current label unavailable';
  const reason=window.MemphisApprovedSchedule.unresolvedReasons[item.reason]+(item.requiredSegments===null?'':` Original budget ${item.originalBudget}; required segments ${item.requiredSegments}.`);
  const row=document.createElement('tr');for(const text of[value.serviceDate,'No safe assignment',label+' — '+reason,clockRange(item.window)]){
   const cell=document.createElement('td');cell.textContent=text;row.append(cell);}body.append(row);
 }
 const confirm=staffingConfirmButton();confirm.hidden=false;confirm.disabled=true;
}
function renderApprovedPreview(){if(state.unresolvedPreview){renderApprovedUnresolvedPreview();return;}if(state.staffingPreview){renderStaffingPreview();return;}const panel=document.getElementById('approved-preview-panel'),choice=state.preview;panel.hidden=!choice;const confirm=document.getElementById('staffing-confirm-btn');if(confirm)confirm.hidden=true;if(!choice){document.getElementById('approved-preview-rows').replaceChildren();document.getElementById('approved-preview-capacity-rows').replaceChildren();return;}
 document.querySelector('#approved-preview-panel h2').textContent='Approved preview — not published';
 const rows=choice.preview.assignments,view=choice.preview.constraintView;
 const facts=view&&Number.isSafeInteger(view.hardConstraintCount)&&Array.isArray(view.slotAvailability)?` · ${view.slotAvailability.length} availability records · ${view.hardConstraintCount} verified hard rows`:'';
 document.getElementById('approved-preview-summary').textContent=`${rows.length} dated duties · template ${choice.preview.templateId} · revision ${choice.preview.authorityRevision}${facts}. Not published; optimized balance and opening readiness are not established by this preview.`;
 const body=document.getElementById('approved-preview-rows');body.replaceChildren();for(const item of rows){const tr=document.createElement('tr');for(const value of[item.serviceDate,approvedAssignmentName(item),item.locationNameSnapshot||item.locationName||item.locationId||item.planWorkId,clockRange(item.window)]){const td=document.createElement('td');td.textContent=String(value||'Not provided');tr.append(td);}body.append(tr);}
 renderApprovedCapacity(view,rows,choice.preview.lunch);
}

function withdrawSchedulerAccess(){
 closeVacancyDialog();vacancyEls.vacancy_current.textContent='';vacancyEls.vacancy_source_facts.textContent='';vacancyEls.vacancy_current_duties.replaceChildren();
 state.accessDenied=true;state.coverallSelection=null;document.getElementById('third-coverall-panel')?.setAttribute('hidden','');state.snapshot=null;state.initialSelection=null;state.preview=null;state.staffingPreview=null;state.unresolvedPreview=null;state.approvedChoices=null;
 for(const id of['roster-list','baseline-absences','temporary-absences','contractor-slots','week-head','week-body','changes-list','readiness-list','approved-preview-rows','approved-preview-capacity-rows'])document.getElementById(id)?.replaceChildren();
 for(const id of['working-count','absent-count','vacancy-count','contractor-count','partial-count','open-count','revision-count'])document.getElementById(id).textContent='—';
 document.getElementById('manual-activation-panel')?.setAttribute('hidden','');document.querySelector('.workspace').hidden=true;for(const id of['approved-source-panel','approved-preview-panel','scheduler-pending-panel'])document.getElementById(id).hidden=true;
 for(const dialog of[els.turnover_dialog,els.action_confirm_dialog])if(dialog?.open)dialog.close();
 els.subtitle.textContent='Current manager access is required.';setControls();
}
