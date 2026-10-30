#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
const root=resolve(new URL('..',import.meta.url).pathname),read=file=>readFileSync(resolve(root,file),'utf8');
const html=read('schedule-weekly.html'),script=read('schedule-weekly.js'),approved=read('memphis-approved-schedule.js'),dated=read('memphis-scheduler-actions.js');
const localScriptPaths=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
 .map(([,src])=>new URL(src,'https://source-contract.invalid/'))
 .filter(url=>url.origin==='https://source-contract.invalid').map(url=>url.pathname);
for(const asset of ['schedule-weekly.js','memphis-approved-schedule.js','memphis-scheduler-actions.js'])assert.equal(localScriptPaths.filter(value=>value==='/'+asset).length,1,asset+' must be one shipped local page dependency; cache query/hash is not a missing file');
assert.ok(localScriptPaths.indexOf('/memphis-approved-schedule.js')<localScriptPaths.indexOf('/schedule-weekly.js'),'approved-source helper must load before its weekly controller');
new vm.Script(script,{filename:'schedule-weekly.js'});
const rollingWindowContext={};vm.runInNewContext(approved,rollingWindowContext);
const windowAccepted=rollingWindowContext.MemphisApprovedSchedule.validSnapshotWindow,
 currentManual={week_start:'2026-10-30',week_end:'2026-11-05',current_publication:{publication_id:'10000000-0000-4000-8000-000000000001'},latest_projection:{projection_id:'10000000-0000-4000-8000-000000000002'}};
currentManual.approved_manual_schedule={schema:'custodial.approved-manual-manager-view.v1',manifestSha256:'fe02bbdebc736d95360b55cc7dfe5b73c5a9eaa76f364f1c0f4420a0afb9950f',publicationId:currentManual.current_publication.publication_id,projectionId:currentManual.latest_projection.projection_id,
 days:['2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05'].map(serviceDate=>({serviceDate}))};
assert.equal(windowAccepted({week_start:'2026-10-26',week_end:'2026-11-01'},'2026-10-26'),true);
assert.equal(windowAccepted(currentManual,'2026-10-26'),true);
assert.equal(windowAccepted(currentManual,'2026-11-02'),true);
assert.equal(windowAccepted(currentManual,'2026-11-09'),false);
for(const mutate of [s=>{s.week_end='2026-11-01';},s=>{s.approved_manual_schedule.manifestSha256='0'.repeat(64);},
 s=>{s.approved_manual_schedule.days[1].serviceDate=s.approved_manual_schedule.days[0].serviceDate;},s=>{s.latest_projection.projection_id='10000000-0000-4000-8000-000000000099';}]){
 const invalid=JSON.parse(JSON.stringify(currentManual));mutate(invalid);assert.equal(windowAccepted(invalid,'2026-10-26'),false);
}
assert.match(script,/requireOpsManagerSession\(\{interactive:false,redirect:true,throwOnFailure:true\}\)/,'workspace requires current named manager');
assert.match(script,/opsManagerAuthHeaders\(\)/,'all scheduler calls carry current manager authentication');
assert.doesNotMatch(script,/(?<![\w.])(?:window\.)?confirm\(/,'no blocking native browser confirmation');
assert.match(html,/id="action-confirm-dialog"/);assert.match(script,/function confirmAction\(/,'one accessible confirmation flow');
assert.match(script,/\/scheduler-runtime-config/,'configured scheduler origin');
assert.doesNotMatch(script,/\/schedule-api|supabase\.co|service_role/i,'no legacy schedule or direct database authority');
assert.match(script,/window\.MemphisApprovedSchedule\.loadInitialEntry\(\{api,weekStart:requestedWeek,owner:schedulerPermissions\(\)\.owner\}\)/,'snapshot is loaded through the current approved-source owner');
assert.match(approved,/api\('\/static-weekly\/manager-snapshot\?week_start='\+encodeURIComponent\(weekStart\)\)/,'delegated owner must call the actual named-manager snapshot route');
assert.match(approved,/if\(!owner\|\|error\.status!==409\|\|error\.code!=='23514'\|\|!refusedMessages\.has\(error\.message\)\)throw error/,'only exact unpublished-source failure can enter owner-only source selection');
for(const route of ['/static-weekly/approved-choices','/static-weekly/day-changes/batch','/static-weekly/employees/departed','/static-weekly/employees/replacements','/static-weekly/rebuild-current-projection'])assert.ok(script.includes(route),route+' must be connected');
for(const route of ['/static-weekly/approved-initial','/static-weekly/recurring-adaptation'])assert.ok(approved.includes(route),route+' must use approved source identity');
assert.doesNotMatch(script,/\/static-weekly\/drafts\//,'new baseline publication must not fall back to optimizer drafts');
assert.match(script,/validatePreview\(kind,result,input,snapshot\)/,'approved preview must be checked against current selection and snapshot');
assert.match(script,/state\.approved\.confirm\(choice\.kind,choice\.preview,choice\.input\)/,'publish exact reviewed source/digest');
assert.match(approved,/preview_digest:preview\.previewDigest/);assert.match(approved,/expected_revision/);assert.match(approved,/idempotency_key/);
assert.match(script,/requireSchedulerPermission\('owner'\)/,'permanent roster and approved baseline publication remain owner only');
assert.match(script,/requireSchedulerPermission\('absences'\)/);assert.match(script,/requireSchedulerPermission\('coverall'\)/);assert.match(script,/requireSchedulerPermission\('routes'\)/);
assert.match(script,/operation:'cover_all'/,'only published contractor capacity is selected');
assert.match(script,/breakChoice='NONE'/,'no-break arrangement is explicitly selected');
assert.match(script,/actual CoverAll lunch start and end/,'actual contractor lunch endpoints are required');
assert.doesNotMatch(script,/One-hour lunch|minutes\(end\)-minutes\(start\)!==60/,'CoverAll duration is not forced to one hour');
assert.match(script,/departed_named_absent/,'departed slots remain visible, not deleted');
assert.match(script,/activeExceptionSlots/,'accepted dated overlays prevent duplicate controls');
assert.match(script,/exception_type:'reverse'/,'dated changes are reversibly removable');
assert.doesNotMatch(script,/\/static-weekly\/projections/,'UI never separates a staffing mutation from its atomic projection');
assert.match(script,/week_start:snapshot\.week_start/,'all date actions bind current week');
assert.match(script,/runDated\('\/static-weekly\/day-changes\/batch'/,'absence and CoverAll use one transaction');
assert.match(dated,/storage\.setItem\(key,raw\)/);assert.match(dated,/body:r\.encoded/,'retry carries exact saved request, not a new identity');
assert.match(dated,/snapshot\.latest_projection\.projection_id!==p\.projection_id/,'accepted projection requires actual current readback');
assert.match(html,/id="rebuild-projection-btn"[\s\S]*?Regenerate Routes/,'explicit manager route regeneration control');
assert.match(script,/rebuild_projection_btn\.hidden=!p\.routes\|\|!state\.snapshot\?\.current_publication/,'route control is available only on a published plan');
assert.match(script,/function projectionNeedsRebuild\(s\)\{return s\.projection_status!=='current';\}/,'any unverified projection is withheld');
assert.match(script,/function displayAssignments\(s\)\{if\(projectionNeedsRebuild\(s\)\)return\[\]/,'stale rows never masquerade as current assignments');
assert.match(script,/body\.new_employee_name=replacementName/,'owner replacement uses atomic backend operation');
assert.match(script,/async function refreshSnapshot/,'acceptance followed by coherent current readback');
assert.match(script,/state\.actions\?\.acknowledge\(state\.snapshot\)/,'dated receipt is not cleared before readback');
assert.match(read('schedule-weekly.css'),/\[hidden\]\{display:none!important\}/,'layout CSS cannot expose permission-hidden controls');
for(const action of ['generateDraft','publishDraft','applyDayChanges','reverseChange']){
 const at=script.indexOf(`async function ${action}(`);assert.ok(at>=0);const next=script.indexOf('\nasync function ',at+1);const body=script.slice(at,next<0?undefined:next);assert.doesNotMatch(body,/await loadSnapshot\(\)/,action+' cannot nest a second busy lock');
}
for(const file of ['start_page1.html','ops-hub.js','mobile/src/manager/index.html','mobile/src/manager/notifications.html','mobile/src/shell/roles/manager/routes.ts'])assert.match(read(file),/schedule-weekly\.html/,file+' routes to canonical weekly workspace');
assert.match(read('schedule-employee-day.html'),/new URL\('\.\/schedule-weekly\.html'/,'detail view returns to canonical manager workspace');
const build=read('mobile/scripts/build.mjs');
for(const file of ['schedule-weekly.html','schedule-weekly.js','memphis-approved-schedule.js','memphis-scheduler-actions.js','memphis-ticket-actions.js'])assert.ok(build.slice(build.indexOf('const custodialProhibitedFiles')).includes(`'${file}'`),file+' must stay out of employee edition');
assert.match(read('schedule-simple.html'),/<title>/,'historical rollback asset preserved');
console.log('weekly manager workspace and approved/durable permission contracts: PASS');

// Actual selected normal UI producer: retain actual endpoints, no duration buckets.
const actualLunchProducer=script.slice(script.indexOf('function dayChangeSelection(){'),script.indexOf('async function applyDayChanges(){'));
assert.ok(actualLunchProducer.startsWith('function dayChangeSelection(){'));
let actualLunchChecks=0;
function selectActualLunch(start,end,choice='SCHEDULED'){
 const slot='20000000-0000-4000-8000-000000000011',values={'[data-shift-start]':'07:00','[data-shift-end]':'16:00','[data-break-choice]':choice,'[data-lunch-start]':start,'[data-lunch-end]':end};
 const input={dataset:{contractorSlot:slot},closest:()=>({querySelector:selector=>({value:values[selector]})})};
 const context={requireSchedulerPermission:()=>{},selectedServiceDate:()=>'2026-10-05',els:{absence_type:{value:'daily_absence'}},
  document:{querySelectorAll:selector=>selector.startsWith('[data-contractor-slot]')?[input]:[],getElementById:()=>({value:'2026-10-05'})},window:{MemphisSchedulerActions:{staffingWeeks(){}}}};
 vm.runInNewContext(actualLunchProducer,context);return JSON.parse(JSON.stringify(context.dayChangeSelection()));
}
for(const [start,end]of[['11:00','11:01'],['11:00','11:15'],['11:00','11:30'],['11:00','11:37'],['11:00','12:00'],['11:00','12:38'],['11:00','14:39']]){
 const value=selectActualLunch(start,end);assert.equal(value.operations.length,2);assert.equal(value.operations[0].operation,'cover_all');
 assert.equal(value.operations[1].starts_at,start);assert.equal(value.operations[1].ends_at,end);assert.equal(value.operations[1].payload.slotId,value.operations[0].slot_id);actualLunchChecks++;
}
for(const [start,end]of[['',''],['11:00',''],['','12:00'],['11:00','11:00'],['12:00','11:00'],['06:59','07:30'],['15:30','16:01'],['24:00','25:00'],['11:60','12:30'],['junk','12:00']]){
 assert.throws(()=>selectActualLunch(start,end),/actual CoverAll lunch start and end/);actualLunchChecks++;
}
const noBreak=selectActualLunch('','','NONE');assert.equal(noBreak.operations.length,1);assert.equal(noBreak.operations[0].breakChoice,'NONE');actualLunchChecks++;
assert.throws(()=>selectActualLunch('11:00','12:00',''),/Choose the actual CoverAll break arrangement/);actualLunchChecks++;
console.log(JSON.stringify({scope:'ACTUAL_NORMAL_UI_COVERALL_LUNCH_ENDPOINT_PRODUCER',checks:actualLunchChecks,arbitrary_duration_limit:false,SQL:false,browser:false}));

// Execute the real selected-date guard and renderer with a Friday origin.
// Labels and owner lookup must follow each civil date, not a Monday index.
const functionSource=name=>{const start=script.indexOf('function '+name+'(');assert.ok(start>=0);const end=script.indexOf('\nfunction ',start+1);return script.slice(start,end<0?undefined:end);};
const dates=['2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05'];
const dateContext={state:{snapshot:{week_start:dates[0],week_end:dates[6]}},els:{service_date:{value:dates[0]}},validCivilDate:x=>x};
vm.runInNewContext(functionSource('selectedServiceDate'),dateContext);
for(const date of dates){dateContext.els.service_date.value=date;assert.equal(dateContext.selectedServiceDate(),date);}
for(const date of ['2026-10-29','2026-11-06']){dateContext.els.service_date.value=date;assert.throws(()=>dateContext.selectedServiceDate(),/inside the selected schedule/);}
const renderContext={DAY_NAMES:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],weekDates:()=>dates,els:{week_head:{},week_body:{}},
 escapeHtml:String,availabilityForDate:()=>[{slot_id:'custodian',availability_state:'working'}],activeExceptionSlots:()=>new Set(),
 manualScheduleView:()=>({}),renderManualLoad:()=>'',renderManualAssignments:(_s,_slot,date,rows)=>rows.map(r=>r.marker+'@'+date).join(',')};
vm.runInNewContext(functionSource('renderWeek'),renderContext);
renderContext.renderWeek({week_start:dates[0]},[{slot_id:'custodian',person_name:'Custodian'}],dates.map(date=>({owner_slot_id:'custodian',day_of_week:new Date(date+'T12:00:00Z').getUTCDay(),marker:date})));
for(const date of dates){const day=new Date(date+'T12:00:00Z').getUTCDay();assert.ok(renderContext.els.week_head.innerHTML.includes(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]+'<br>'+date.slice(5)));assert.ok(renderContext.els.week_body.innerHTML.includes(date+'@'+date));}
console.log('actual rolling-week renderer and date guard: PASS (all seven dates)');
