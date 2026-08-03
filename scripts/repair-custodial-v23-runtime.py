from pathlib import Path
import re
import subprocess


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def replace_segment(text: str, start: str, end: str, replacement: str, label: str) -> str:
    begin = text.find(start)
    if begin < 0:
        raise SystemExit(f'{label}: start marker not found')
    finish = text.find(end, begin + len(start))
    if finish < 0:
        raise SystemExit(f'{label}: end marker not found')
    return text[:begin] + replacement + text[finish:]


path = Path('index.html')
scan = path.read_text()

scan, count = re.subn(
    r'\.syncBadge\{[^}]+\}',
    '.syncBadge{position:fixed;top:max(8px, env(safe-area-inset-top));right:8px;z-index:9999;background:rgba(0,0,0,.78);color:#fff;padding:9px 13px;border-radius:16px;font-size:.88rem;font-weight:900;border:1px solid rgba(255,255,255,.14);max-width:78vw;line-height:1.25}.syncBadge[hidden]{display:none}',
    scan,
    count=1,
)
if count != 1:
    raise SystemExit(f'sync badge CSS: expected one replacement, found {count}')
scan = replace_once(
    scan,
    '    @media (max-width:640px){',
    '    .formToggle{min-height:56px;margin-top:14px;background:rgba(255,255,255,.10);color:#fff;border:2px solid rgba(255,255,255,.22)}.detailPanel{margin-top:12px;padding-top:2px}.detailPanel[hidden]{display:none}.primaryService{border:2px solid rgba(155,225,31,.58);background:rgba(155,225,31,.13)}.savedCard .title-green{margin-bottom:18px}\n    @media (max-width:640px){',
    'scan form disclosure CSS',
)
scan = replace_once(
    scan,
    '<div id="sync-badge" class="syncBadge">Starting…</div>',
    '<div id="sync-badge" class="syncBadge" hidden></div>',
    'hidden sync badge markup',
)
scan = replace_once(
    scan,
    'guardedStart().catch((err)=>{console.error(err);renderMessageCard("title-red","Startup Error","",safeError(err));updateDebugPanel()});',
    'guardedStart().catch((err)=>{console.error(err);renderMessageCard("title-red","Phone Needs Help","","This phone needs a manager.");updateDebugPanel()});',
    'startup error mapping',
)

render_helpers = r'''function employeeSafeScanMessage(title,message){const combined=`${String(title||"")} ${String(message||"")}`;if(title==="Services Required")return String(message||"Choose the work completed.");if(title==="Session Already Open")return"Finish the cleaning already open on this phone.";if(title==="Blocked")return"This area is already being cleaned.";if(/Missing Location|Invalid Location|Scan Could Not Be Verified|Unknown State|Scan Error/i.test(title))return"Tag not recognized. Tell a manager.";if(title==="System Disabled")return"Cleaning scans are not available right now. Tell a manager.";if(title==="Session Cancelled")return"This saved cleaning record could not be completed. Tell a manager.";if(/server|device|session id|gps|sync|backend|http|credential|unauthorized|configuration|protected/i.test(combined))return"This phone needs a manager.";return String(message||"Wait a moment and tap the tag again.")}
    function employeeSafeScanTitle(title){if(/Missing Location|Invalid Location|Scan Could Not Be Verified|Unknown State|Scan Error/i.test(title))return"Tag Not Recognized";if(/Startup Error|Device Configuration Error|Unauthorized Device|Protected Phone Recovery/i.test(title))return"Phone Needs Help";return String(title||"Phone Needs Help")}
    function renderLoadingCard(title,helper){const safeTitle=title==="Submitting"?"Saving":title==="Starting"?"Starting":"Opening Location";appEl.innerHTML=`<div class="shell"><div class="card"><h1 class="title-blue">${escapeHtml(safeTitle)}</h1></div></div>`}
    function renderMessageCard(titleClass,title,location,message){const safeTitle=employeeSafeScanTitle(title);const safeMessage=employeeSafeScanMessage(title,message);appEl.innerHTML=`<div class="shell"><div class="card"><h1 class="${escapeAttr(titleClass)}">${escapeHtml(safeTitle)}</h1>${location?`<div class="location">${escapeHtml(location)}</div>`:""}<div class="status error">${escapeHtml(safeMessage)}</div></div></div>`}
    '''
scan = replace_segment(
    scan,
    'function renderLoadingCard(title,helper)',
    'function buildContinueUrl(params)',
    render_helpers,
    'employee-safe loading and error cards',
)

connectivity = r'''function setupConnectivityListeners(){window.addEventListener("memphis-scan-sync",()=>{refreshDebugQueueCounts();updateSyncBadge()});window.addEventListener("online",()=>{updateSyncBadge();if(backendRecoveryTimer||document.querySelector("#retry-backend"))retryBackendScan().catch(console.warn)});syncBadge.hidden=true;syncBadge.removeAttribute("role");syncBadge.removeAttribute("tabindex");syncBadge.removeAttribute("aria-label")}
    function startSyncLoop(){syncQueue().catch(console.warn)}
    async function syncQueue(){await window.MemphisScanSync.ready;const result=await window.MemphisScanSync.sync();await refreshDebugQueueCounts();updateSyncBadge();return result}
    async function retryStuckQueue(){await window.MemphisScanSync.ready;await window.MemphisScanSync.recoverAllDeadLetters();return syncQueue()}
    function updateSyncBadge(forcedText=null){if(forcedText){syncBadge.textContent=forcedText;syncBadge.hidden=!forcedText;return}getQueuedActions().then((items)=>{const queued=items.length;const deadLetters=items.filter((item)=>item.dead_letter===true).length;if(deadLetters){syncBadge.textContent="This phone needs a manager.";syncBadge.hidden=false}else if(queued){syncBadge.textContent="Saved. Will send when connected.";syncBadge.hidden=false}else{syncBadge.textContent="";syncBadge.hidden=true}}).catch(()=>{syncBadge.textContent="";syncBadge.hidden=true})}
    '''
scan = replace_segment(
    scan,
    'function setupConnectivityListeners()',
    'async function openQueueDb',
    connectivity,
    'employee-safe sync status',
)

scan = replace_segment(
    scan,
    'function findAnyOpenLocalSessionForDevice',
    'function cleanupStaleLocalSessions',
    'function findAnyOpenLocalSessionForDevice(deviceId){cleanupStaleLocalSessions();const sessions=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key||!key.startsWith("session:"))continue;try{const s=JSON.parse(localStorage.getItem(key));if(s&&s.device_id===deviceId&&(["active","server-active","pending_submit","offline-provisional"].includes(String(s.status||"").toLowerCase())))sessions.push(s)}catch{}}sessions.sort((a,b)=>new Date(b.updated_at||b.ended_at||b.started_at||0)-new Date(a.updated_at||a.ended_at||a.started_at||0));return sessions[0]||null}\n    ',
    'exclude synchronized-pending completion from open session',
)

position_badge = r'''function showWorkPositionBadge(text,kind='ok'){let el=document.getElementById('work-position-badge');if(kind!=='alert'){if(el)el.remove();return}if(!el){el=document.createElement('div');el.id='work-position-badge';el.style.cssText='position:fixed;left:8px;top:max(8px, env(safe-area-inset-top));z-index:10000;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:10px 13px;font:900 13px/1.25 Arial,sans-serif;max-width:82vw;box-shadow:0 6px 18px rgba(0,0,0,.24);';document.body.appendChild(el)}el.textContent=`Return to ${workPositionSession&&workPositionSession.location_name||'this area'}.`;el.style.background='rgba(127,29,29,.92)'}
    '''
scan = replace_segment(
    scan,
    'function showWorkPositionBadge',
    'function workPlainPosition',
    position_badge,
    'actionable-only position badge',
)

employee_select = r'''async function renderEmployeeSelect(state,deviceId){renderLoadingCard("Opening Location","");const rawAssignedEmployee=assignedEmployeeFromState(state);const canonicalDeviceId=String(state&&state.canonical_device_id||deviceId||"").trim();const employeeKiosk=isReadonlyScanEmployeeDevice(canonicalDeviceId);if(employeeKiosk&&!rawAssignedEmployee){renderMessageCard("title-red","Phone Needs Help",state&&state.location_name||state&&state.location_code||"","This phone needs a manager.");updateSyncBadge();return}let employeeControl="";let assignedEmployeeMarkup="";if(employeeKiosk){assignedEmployeeMarkup=`<div class="employeeLine scanEmployeeDisplay">${escapeHtml(rawAssignedEmployee)}</div>`;employeeControl=`<input type="hidden" name="employee" value="${escapeAttr(rawAssignedEmployee)}" />`}else{const employees=await getActiveEmployeesSafe();const options=employees.map((emp)=>scanEmployeeNameOnly(emp&&emp.display_name)).filter(Boolean).filter((name,index,names)=>names.findIndex((candidate)=>normalizePersonName(candidate)===normalizePersonName(name))===index).map((name)=>`<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join("");employeeControl=`<select name="employee" required><option value="" selected disabled>Select Employee</option>${options}</select>`}appEl.innerHTML=`<div class="shell"><div class="card"><h1 class="title-green">Start Cleaning</h1><div class="location">${escapeHtml(state.location_name||state.location_code||"")}</div>${assignedEmployeeMarkup}<form id="start-form">${employeeControl}<button class="startBtn" type="submit">Start Cleaning</button></form></div></div>`;document.getElementById("start-form").addEventListener("submit",async(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);const employee=String(form.get("employee")||"").trim();if(!employee)return;const existingOpen=findAnyOpenLocalSessionForDevice(deviceId);if(existingOpen&&["active","server-active","pending_submit","offline-provisional"].includes(String(existingOpen.status||"").toLowerCase())){currentSessionUuid=existingOpen.session_uuid||"";updateDebugPanel();renderMessageCard("title-amber","Session Already Open",existingOpen.location_name||existingOpen.location_code||"","Finish the cleaning already open on this phone.");setTimeout(()=>{if(existingOpen.status==="pending_submit")renderCompletePage(existingOpen,existingOpen.location_code||"",deviceId);else renderTimerPage(existingOpen)},1800);return}renderLoadingCard("Starting","");const started=await startSessionMaybeQueued(locationCodeFromState(state),employee,deviceId,state.form_type||state.location_type,state);await recordScanEventMaybeQueued(locationCodeFromState(state),deviceId,"scan_start","ok","Session started",started||{});currentSessionUuid=started&&started.session_uuid||"";updateDebugPanel();renderTimerPage(started)});updateSyncBadge()}
    '''
scan = replace_segment(
    scan,
    'async function renderEmployeeSelect',
    'function workPositionKey',
    employee_select,
    'simple Start Cleaning screen',
)

timer_and_complete = r'''function renderTimerPage(result){clearWorkPosition();workPositionSession={...result,geofence:result&&result.geofence||currentScanState&&currentScanState.geofence||null};if(result&&result.session_uuid&&navigator.geolocation){getWorkPosition().then((p)=>reportWorkPosition(workPlainPosition(p),'initial')).catch(()=>{});workPositionTimer=setInterval(()=>getWorkPosition().then((p)=>reportWorkPosition(workPlainPosition(p),'timer')).catch(()=>{}),30000)}const startedAt=result&&result.started_at?new Date(result.started_at).getTime():Date.now();currentSessionUuid=result&&result.session_uuid||currentSessionUuid;updateDebugPanel();appEl.innerHTML=`<div class="shell"><div class="card"><h1 class="title-blue">Cleaning In Progress</h1><div class="location">${escapeHtml(result&&result.location_name||"")}</div><div class="employeeLine">${escapeHtml(result&&result.employee_name||"")}</div><div class="timer" id="timer">00:00:00</div><div class="helper helperLarge">Tap this tag again when finished.</div></div></div>`;const timerEl=document.getElementById("timer");const update=()=>{const elapsed=Math.max(0,Date.now()-startedAt);const totalSeconds=Math.floor(elapsed/1000);const hours=Math.floor(totalSeconds/3600);const minutes=Math.floor((totalSeconds%3600)/60);const seconds=totalSeconds%60;timerEl.textContent=`${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`};update();setInterval(update,1000);window.MemphisUI?.rememberScanView?.(result,"timer",{deviceId:result&&result.device_id||currentDeviceId,locationCode:result&&result.location_code||currentScanState&&currentScanState.location_code||""});updateSyncBadge()}
    function serviceLabel(service){return typeof service==="string"?service:String(service&&service.title||"")}
    function serviceDescription(service){return typeof service==="string"?"":String(service&&service.description||"")}
    function renderCompletePage(result,locationCode,deviceId,notice=""){clearWorkPosition();const formKind=resolveLocationKind(result&&result.form_type,result&&result.location_type);currentSessionUuid=result&&result.session_uuid||currentSessionUuid;updateDebugPanel();const continueUrl=buildContinueUrl({code:locationCode,action:"complete",session_uuid:result&&result.session_uuid||"",device:deviceId,employee:result&&result.employee_name||"",location_name:result&&result.location_name||"",location_type:formKind.locationType,form_type:formKind.formType});appEl.innerHTML=`<div class="shell"><div class="card"><h1 class="title-amber">Complete Cleaning</h1><div class="location">${escapeHtml(result&&result.location_name||"")}</div>${notice?`<div class="notice">${escapeHtml(employeeSafeScanMessage("",notice))}</div>`:""}<div class="infoBox"><div class="infoRow"><strong>${escapeHtml(result&&result.employee_name||"")}</strong></div><div class="metric">${escapeHtml(result&&result.duration_display||"")}</div></div><div class="helper helperLarge">Tap Continue.</div><a class="continueBtnLink" href="${escapeAttr(continueUrl)}"><button class="continueBtn" type="button">Continue</button></a></div></div>`;window.MemphisUI?.rememberScanView?.(result,"complete",{deviceId,locationCode});updateSyncBadge()}
    function renderSavedCompletion(locationName,deviceId){clearWorkPosition();currentSessionUuid="";updateDebugPanel();appEl.innerHTML=`<div class="shell"><div class="card savedCard"><h1 class="title-green">Saved</h1>${locationName?`<div class="location">${escapeHtml(locationName)}</div>`:""}<div class="helper helperLarge">Saved. It will send when connected. You may keep working.</div><button id="saved-home" class="startBtn" type="button">Home</button></div></div>`;document.getElementById("saved-home").addEventListener("click",()=>window.location.replace(buildEmployeeHubUrl(deviceId||currentDeviceId||"")));setTimeout(()=>window.location.replace(buildEmployeeHubUrl(deviceId||currentDeviceId||"")),3500);updateSyncBadge()}
    '''
scan = replace_segment(
    scan,
    'function renderTimerPage',
    'function completionDraftKey',
    timer_and_complete,
    'simple timer and completion screens',
)

completion_form = r'''async function renderCompletionForm(context){const localSession=getLocalSessionById(context.sessionUuid);const kind=resolveLocationKind(context.formType,context.locationType,localSession&&localSession.form_type,localSession&&localSession.location_type);const locationName=context.locationName||(localSession&&localSession.location_name)||context.locationCode||"";const employeeName=context.employeeName||(localSession&&localSession.employee_name)||"";const isRestroom=kind.isRestroom;const services=isRestroom?RESTROOM_SERVICES:EXHIBIT_SERVICES;const issues=isRestroom?RESTROOM_ISSUES:EXHIBIT_ISSUES;currentSessionUuid=context.sessionUuid||currentSessionUuid;updateDebugPanel();appEl.innerHTML=`<div class="shell"><div class="card"><h1 class="title-amber">Complete Cleaning</h1><div class="location">${escapeHtml(locationName)}</div><div class="employeeLine">${escapeHtml(employeeName)}</div><form id="completion-form"><div class="checkboxRow primaryService"><input type="checkbox" name="services" id="full-cleaning" value="Full cleaning services" checked /><label for="full-cleaning" class="checkboxLabel"><span class="checkboxTitle">Full cleaning services</span></label></div><button id="individual-toggle" class="formToggle" type="button" aria-expanded="false">Choose individual work</button><div id="individual-work" class="detailPanel" hidden><div class="sectionTitle">Work completed</div>${services.slice(1).map((service,i)=>{const label=serviceLabel(service);const description=serviceDescription(service);return`<div class="checkboxRow"><input type="checkbox" name="services" id="svc_${i}" value="${escapeAttr(label)}" /><label for="svc_${i}" class="checkboxLabel"><span class="checkboxTitle">${escapeHtml(label)}</span>${description?`<span class="checkboxDesc">${escapeHtml(description)}</span>`:""}</label></div>`}).join("")}<label>Other work</label><input name="services_other" type="text" /></div><button id="problem-toggle" class="formToggle" type="button" aria-expanded="false">Report a problem</button><div id="problem-details" class="detailPanel" hidden><div class="sectionTitle">Problem found</div>${issues.map((label,i)=>`<div class="checkboxRow"><input type="checkbox" name="issues" id="issue_${i}" value="${escapeAttr(label)}" /><label for="issue_${i}" class="checkboxLabel">${escapeHtml(label)}</label></div>`).join("")}${isRestroom?`<div class="sectionTitle">Out of Order</div><div class="radioWrap"><div class="radioRow"><input type="radio" name="out_of_order_signed" id="ooo_yes" value="Yes" /><label for="ooo_yes" class="radioLabel">Yes</label></div><div class="radioRow"><input type="radio" name="out_of_order_signed" id="ooo_no" value="No" /><label for="ooo_no" class="radioLabel">No</label></div></div><label>What was out of order?</label><textarea name="out_of_order_details"></textarea>`:""}<label>Notes</label><textarea name="note"></textarea></div><button class="submitBtn" type="submit">Submit Completion</button></form></div></div>`;const completionForm=document.getElementById("completion-form");const fullCleaning=document.getElementById("full-cleaning");const individualToggle=document.getElementById("individual-toggle");const individualPanel=document.getElementById("individual-work");const problemToggle=document.getElementById("problem-toggle");const problemPanel=document.getElementById("problem-details");const setPanel=(button,panel,open)=>{panel.hidden=!open;button.setAttribute("aria-expanded",String(open))};individualToggle.addEventListener("click",()=>{const open=individualPanel.hidden;setPanel(individualToggle,individualPanel,open);if(open)fullCleaning.checked=false;saveCompletionDraft(context.sessionUuid,completionForm)});problemToggle.addEventListener("click",()=>setPanel(problemToggle,problemPanel,problemPanel.hidden));restoreCompletionDraft(context.sessionUuid,completionForm);const hasIndividual=Array.from(completionForm.querySelectorAll('input[name="services"]')).some((control)=>control.id!=="full-cleaning"&&control.checked)||Boolean(completionForm.elements.services_other&&completionForm.elements.services_other.value);const hasProblem=Array.from(completionForm.querySelectorAll('input[name="issues"]')).some((control)=>control.checked)||Boolean(completionForm.elements.note&&completionForm.elements.note.value)||Boolean(completionForm.elements.out_of_order_details&&completionForm.elements.out_of_order_details.value)||Boolean(completionForm.querySelector('input[name="out_of_order_signed"]:checked'));if(hasIndividual)setPanel(individualToggle,individualPanel,true);if(hasProblem)setPanel(problemToggle,problemPanel,true);completionForm.addEventListener("input",()=>saveCompletionDraft(context.sessionUuid,completionForm));completionForm.addEventListener("change",()=>saveCompletionDraft(context.sessionUuid,completionForm));window.MemphisUI?.rememberScanView?.(localSession||{session_uuid:context.sessionUuid,device_id:context.deviceId,location_code:context.locationCode,status:"pending_submit"},"completion-form",context);completionForm.addEventListener("submit",async(event)=>{event.preventDefault();saveCompletionDraft(context.sessionUuid,event.currentTarget);const form=new FormData(event.currentTarget);const selectedServices=form.getAll("services").map(String).filter(Boolean);const servicesOther=String(form.get("services_other")||"").trim();if(servicesOther)selectedServices.push(servicesOther);if(!selectedServices.length){renderMessageCard("title-red","Services Required",locationName||"","Choose the work completed.");setTimeout(()=>renderCompletionForm(context),1800);return}const responseJson={form_type:kind.formType,services_performed:selectedServices,maintenance_issues_found:form.getAll("issues").map(String).filter(Boolean),note:String(form.get("note")||"").trim()};if(isRestroom){responseJson.out_of_order_signed=String(form.get("out_of_order_signed")||"").trim();responseJson.out_of_order_details=String(form.get("out_of_order_details")||"").trim()}renderLoadingCard("Submitting","");const completed=await completeSessionMaybeQueued(context.sessionUuid,responseJson,employeeName||null,context.deviceId||null);if(completed&&completed.status==="closed"&&completed.server_acknowledged!==false){clearCompletionDraft(context.sessionUuid);window.MemphisUI?.clearScanView?.(context.sessionUuid,context.deviceId);await recordScanEventMaybeQueued(context.locationCode||"",context.deviceId||"","scan_resume_pending","ok","Completion confirmed by server",completed||{});currentSessionUuid="";updateDebugPanel();window.location.replace(buildEmployeeHubUrl(context.deviceId||currentDeviceId||""));return}if(completed&&(completed.discard_local_workflow===true||completed.terminal===true||completed.status==="cancelled")){clearCompletionDraft(context.sessionUuid);window.MemphisUI?.clearScanView?.(context.sessionUuid,context.deviceId);currentSessionUuid="";updateDebugPanel();renderMessageCard("title-amber","Session Cancelled",locationName||context.locationCode||"","This phone needs a manager.");setTimeout(()=>window.location.replace(buildEmployeeHubUrl(context.deviceId||currentDeviceId||"")),2500);return}clearCompletionDraft(context.sessionUuid);window.MemphisUI?.clearScanView?.(context.sessionUuid,context.deviceId);renderSavedCompletion(locationName||context.locationCode||"",context.deviceId);syncQueue().catch(console.warn)});updateSyncBadge()}
    '''
scan = replace_segment(
    scan,
    'async function renderCompletionForm',
    'function parseRetryAfter',
    completion_form,
    'progressive employee completion form',
)

backend_recovery = r'''function renderBackendRecovery(state,locationCode,deviceId){backendRecoveryAttempt+=1;const delay=Math.min(30000,5000*Math.max(1,backendRecoveryAttempt));appEl.innerHTML=`<div class="shell"><div class="card"><h1 class="title-amber">Wait a Moment</h1><div class="location">${escapeHtml(state.location_name||locationCode||"")}</div><div class="status">The phone will try again.</div><button id="retry-backend" class="startBtn" type="button">Try Again</button><button id="return-lock" type="button">Home</button></div></div>`;document.getElementById("retry-backend").addEventListener("click",()=>retryBackendScan().catch(console.warn));document.getElementById("return-lock").addEventListener("click",()=>window.location.replace(buildEmployeeHubUrl(deviceId||currentDeviceId||"")));scheduleBackendRecovery(delay)}
    function renderThrottledRecovery(state,locationCode,deviceId){const retryMs=Math.max(1000,Number(state.retry_after_ms)||15000);appEl.innerHTML=`<div class="shell"><div class="card"><h1 class="title-amber">Please Wait</h1><div class="location">${escapeHtml(state.location_name||locationCode||"")}</div><div class="status">The phone will try again.</div><button id="return-lock" type="button">Home</button></div></div>`;document.getElementById("return-lock").addEventListener("click",()=>window.location.replace(buildEmployeeHubUrl(deviceId||currentDeviceId||"")));scheduleBackendRecovery(retryMs)}
    '''
scan = replace_segment(
    scan,
    'function renderBackendRecovery',
    'async function getSystemSettingsSafe',
    backend_recovery,
    'employee-safe reconnect screens',
)

state_start = scan.find('async function getScanStateSafe')
state_end = scan.find('async function startSessionMaybeQueued', state_start)
if state_start < 0 or state_end < 0:
    raise SystemExit('getScanStateSafe segment unavailable')
state_segment = scan[state_start:state_end]
old_pending = 'if(local&&(["pending_submit","pending_sync"].includes(String(local.status||"").toLowerCase())))return{location_code:locationCode,location_name:local.location_name||locationCode,location_type:localKind.locationType,form_type:localKind.formType,device_approved:false,latest_session_uuid:local.session_uuid,latest_session_status:"pending_submit",latest_employee_name:local.employee_name,latest_device_id:deviceId,started_at:local.started_at,ended_at:local.ended_at,duration_display:local.duration_display,geofence:local.geofence||null,suggested_action:"resume_pending_submit",offline_state:true};'
new_pending = 'if(local&&String(local.status||"").toLowerCase()==="pending_sync")return{location_code:locationCode,location_name:local.location_name||locationCode,location_type:localKind.locationType,form_type:localKind.formType,device_approved:false,latest_session_uuid:local.session_uuid,latest_session_status:"pending_sync",latest_employee_name:local.employee_name,latest_device_id:deviceId,started_at:local.started_at,ended_at:local.ended_at,duration_display:local.duration_display,geofence:local.geofence||null,suggested_action:"submission_saved",offline_state:true};if(local&&String(local.status||"").toLowerCase()==="pending_submit")return{location_code:locationCode,location_name:local.location_name||locationCode,location_type:localKind.locationType,form_type:localKind.formType,device_approved:false,latest_session_uuid:local.session_uuid,latest_session_status:"pending_submit",latest_employee_name:local.employee_name,latest_device_id:deviceId,started_at:local.started_at,ended_at:local.ended_at,duration_display:local.duration_display,geofence:local.geofence||null,suggested_action:"resume_pending_submit",offline_state:true};'
state_segment = replace_once(state_segment, old_pending, new_pending, 'pending completion state split')
scan = scan[:state_start] + state_segment + scan[state_end:]

completion_start = scan.find('async function completeSessionMaybeQueued')
completion_end = scan.find('async function pingDevice', completion_start)
if completion_start < 0 or completion_end < 0:
    raise SystemExit('completion queue segment unavailable')
completion_segment = scan[completion_start:completion_end]
completion_segment = replace_once(
    completion_segment,
    'status:"pending_submit",started_at:startedAt,ended_at:endedAt,response_json:responseJson,completion_pending:true,offline:true,server_acknowledged:false,sync_status:"submission_pending"',
    'status:"pending_sync",state:"pending-sync",started_at:startedAt,ended_at:endedAt,response_json:responseJson,completion_pending:true,offline:true,server_acknowledged:false,sync_status:"submission_pending"',
    'pending completion local status',
)
scan = scan[:completion_start] + completion_segment + scan[completion_end:]

wake_start = scan.find('async function resumeOpenSessionFromWake')
wake_end = scan.find('async function bootstrap', wake_start)
if wake_start < 0 or wake_end < 0:
    raise SystemExit('wake resume segment unavailable')
wake_segment = scan[wake_start:wake_end].replace(',"pending_sync"', '')
scan = scan[:wake_start] + wake_segment + scan[wake_end:]

scan = replace_once(
    scan,
    'if(openLocalForDevice&&(["active","server-active","pending_submit","pending_sync","offline-provisional"].includes(openLocalForDevice.status))',
    'if(openLocalForDevice&&(["active","server-active","pending_submit","offline-provisional"].includes(openLocalForDevice.status))',
    'bootstrap open-session pending sync exclusion',
)
scan = replace_once(
    scan,
    'if(localSameLocation&&["pending_submit","pending_sync"].includes(localSameLocation.status)){currentSessionUuid=localSameLocation.session_uuid||"";updateDebugPanel();renderCompletePage(localSameLocation,locationCode,deviceId,"This session is waiting on form submission.");updateSyncBadge();return}',
    'if(localSameLocation&&localSameLocation.status==="pending_sync"){renderSavedCompletion(localSameLocation.location_name||locationCode,deviceId);return}if(localSameLocation&&localSameLocation.status==="pending_submit"){currentSessionUuid=localSameLocation.session_uuid||"";updateDebugPanel();renderCompletePage(localSameLocation,locationCode,deviceId);updateSyncBadge();return}',
    'same-location pending completion behavior',
)
scan = replace_once(
    scan,
    'case"resume_pending_submit":currentSessionUuid=state.latest_session_uuid||"";updateDebugPanel();renderCompletePage({session_uuid:state.latest_session_uuid,location_code:locationCode,location_name:state.location_name,employee_name:state.latest_employee_name,device_id:state.latest_device_id,status:state.latest_session_status,started_at:state.started_at,ended_at:state.ended_at,duration_display:state.duration_display,location_type:stateKind.locationType,form_type:stateKind.formType},locationCode,deviceId,"This session is waiting on form submission.");break;case"blocked_location_active"',
    'case"resume_pending_submit":currentSessionUuid=state.latest_session_uuid||"";updateDebugPanel();renderCompletePage({session_uuid:state.latest_session_uuid,location_code:locationCode,location_name:state.location_name,employee_name:state.latest_employee_name,device_id:state.latest_device_id,status:state.latest_session_status,started_at:state.started_at,ended_at:state.ended_at,duration_display:state.duration_display,location_type:stateKind.locationType,form_type:stateKind.formType},locationCode,deviceId);break;case"submission_saved":renderSavedCompletion(state.location_name||locationCode,deviceId);break;case"blocked_location_active"',
    'submission saved scan state',
)
path.write_text(scan)

ui_path = Path('memphis-ui.js')
ui = ui_path.read_text()
ui = replace_once(
    ui,
    'const OPEN_SCAN_STATUSES = new Set(["active", "server-active", "offline-provisional", "pending_submit", "pending_sync"]);',
    'const OPEN_SCAN_STATUSES = new Set(["active", "server-active", "offline-provisional", "pending_submit"]);',
    'wake-active scan statuses',
)
ui_path.write_text(ui)

subprocess.run(['node', 'scripts/custodial-scan-v23-contract-tests.mjs'], check=True)
subprocess.run(['npm', 'run', '--silent', 'release:manifest:refresh'], check=True)
Path(__file__).unlink()
print('Installed the employee-safe NFC cleaning runtime and progressive completion form.')
