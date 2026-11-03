import assert from 'node:assert/strict';
import {fixture,turn} from './fixtures/helper-current-schedule-refresh-fixture.mjs';
// The immutable original lives in the repair evidence. These cases preserve
// its convergence/fencing intents against current page/actions APIs; they do
// not reinstate dayChangeRequest, staffingCoordinator or automatic mutations.
let checks=0;
function check(value,expected,label){assert.deepEqual(value,expected,label);checks++;}
{
 const f=fixture();f.run('installScheduleAutoRefresh();installScheduleAutoRefresh()');
 for(const [target,type] of [['window','online'],['window','memphis:schedule-refresh'],['window','memphis:native-notification-received'],['document','visibilitychange']]){
  check(f.events.get(target+':'+type)?.length,1,'one listener '+type);const before=f.calls.length;
  f.emit(target,type);await turn();check(f.calls.length,before+2,type+' reads current snapshot and choices');
 }
 check(f.calls.every(row=>row.method==='GET'),true,'automatic refresh only reads');check(f.run('state.snapshot.authority_revision'),8,'accepted revision rendered');
 check(f.timers.size,1,'one lifecycle interval without orphan timeout');await f.cleanup();
 f.emit('window','pageshow');await turn();check(f.timers.size,1,'bfcache resumes one interval');await f.cleanup();
}
for(const blocker of ['state.busy=true','state.manualBusy=true','state.accessDenied=true',
 "state.pending={state:'PENDING',encoded:'EXACT'}","state.pending={state:'ACCEPTED',encoded:'EXACT'}",
 "state.approvedPending={state:'PENDING',encoded:'EXACT'}","state.manualPending={state:'PENDING',encoded:'EXACT'}",
 'state.preview={}','state.staffingPreview={}','state.unresolvedPreview={}','state.coverallSelection={}',
 'state.turnoverSelection={}','state.vacancySelection={}','els.action_confirm_dialog.open=true','els.turnover_dialog.open=true','vacancyEls.vacancy_dialog.open=true',
 'document.hidden=true','navigator.onLine=false',"document.getElementById('manual-activation-confirm').hidden=false"]){
 const f=fixture();f.run('installScheduleAutoRefresh()');f.run(blocker);const pending=f.json('[state.pending,state.approvedPending,state.manualPending]');
 await f.run('requestScheduleRefresh()');check(f.calls.length,0,'defer while '+blocker);check(f.run('state.scheduleRefreshQueued'),true,'remember queued read');
 check(f.json('[state.pending,state.approvedPending,state.manualPending]'),pending,'preserve every original command');await f.cleanup();
}
{
 const f=fixture();f.run('installScheduleAutoRefresh()');f.choice.checked=true;f.emit('document','change',{target:f.choice});
 await f.run('requestScheduleRefresh()');check(f.calls.length,0,'unconfirmed choice defers read');check(f.run('state.scheduleInputDirty'),true,'choice is dirty');
 f.choice.checked=false;f.emit('document','change',{target:f.choice});await f.fire(0);
 check(f.run('state.scheduleInputDirty'),false,'revert releases dirty ownership');check(f.calls.length,2,'reverted choice permits queued read');await f.cleanup();
}
for(const id of ['absence-end-date','absence-type','approved-source','manual-activation-choice']){
 const f=fixture();f.run('installScheduleAutoRefresh()');const before=f.node(id).value;f.edit(f.node(id),'changed');await f.run('requestScheduleRefresh()');
 check(f.calls.length,0,id+' unconfirmed edit retained');f.edit(f.node(id),before);await f.fire(0);check(f.calls.length,2,id+' exact revert releases read');await f.cleanup();
}
{
 const f=fixture();f.run('installScheduleAutoRefresh()');let release;f.setReadHook(()=>new Promise(resolve=>{release=resolve;}));
 const first=f.run('requestScheduleRefresh()');await turn();await f.run('requestScheduleRefresh()');await f.run('requestScheduleRefresh()');
 check(f.calls.length,1,'burst coalesces to one in-flight GET');f.setReadHook(async()=>{});release();await first;
 check(f.run('state.scheduleRefreshQueued'),true,'signal during read remains queued');check(f.run('state.busy'),false,'release read controls');
 await f.run('flushScheduleRefresh()');check(f.calls.length,4,'one safe follow-up reads current state');await f.cleanup();
}
for(const mutation of ["els.week_start.value='2026-09-28'","els.service_date.value='2026-09-25'",'state.scheduleInputEpoch++',
 'state.previewSelection++','state.snapshot.authority_revision=10','state.actions={}',"state.pending={state:'PENDING',encoded:'LATER'}"]){
 const f=fixture();f.run('installScheduleAutoRefresh()');let release;f.setReadHook(()=>new Promise(resolve=>{release=resolve;}));
 const first=f.run('requestScheduleRefresh()');await turn();f.run(mutation);f.setReadHook(async()=>{});release();await first;
 check(f.rendered.length,0,'late response cannot replace changed context: '+mutation);check(f.run('state.scheduleRefreshQueued'),true,'stale read stays queued');await f.cleanup();
}
for(const changed of [null,{week_start:'2026-09-28',week_end:'2026-10-04',authority_revision:8},
 {week_start:'2026-09-21',week_end:'bad',authority_revision:8},{week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:'8'},
 {week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:-1},{week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:6}]){
 const f=fixture();f.run('installScheduleAutoRefresh()');f.setSnapshot(changed);await f.run('requestScheduleRefresh()');
 check(f.run('state.snapshot.authority_revision'),7,'invalid/older reply preserves last snapshot');check(f.rendered.length,0,'invalid/older response not rendered');
 check(f.run('state.scheduleRefreshQueued'),true,'invalid response cannot settle queue');await f.cleanup();
}
{
 const f=fixture();f.run("els.week_start.value='2026-09-28';els.service_date.value='2026-09-29';installScheduleAutoRefresh()");
 f.setSnapshot({...f.snapshot,week_start:'2026-09-28',week_end:'2026-10-04',authority_revision:6});await f.run('requestScheduleRefresh()');
 check(f.run('state.snapshot.week_start'),'2026-09-28','new selected week reads its own valid snapshot');
 check(f.run('state.snapshot.authority_revision'),6,'same-week anti-regression does not compare unrelated window revisions');await f.cleanup();
}
{
 const f=fixture();f.run('installScheduleAutoRefresh()');f.setFail(true);await f.run('requestScheduleRefresh()');
 check(f.run('state.snapshot.authority_revision'),7,'outage retains current view');check(f.run('state.scheduleRefreshQueued'),true,'outage keeps recovery queued');
 check(f.run('state.busy||state.scheduleRefreshRunning'),false,'outage releases controls and owner');check(f.timers.size,1,'outage creates no immediate retry loop');
 f.setFail(false);f.emit('window','online');await turn();check(f.run('state.snapshot.authority_revision'),8,'reconnect recovers GET-only');await f.cleanup();
}
{
 const f=fixture();await f.run('init()');check(f.run('state.scheduleRefreshInstalled'),true,'actual authenticated startup installs convergence');
 const before=f.calls.length;f.emit('window','online');await turn();check(f.calls.length,before+2,'actual startup receives reconnect');
 check(f.calls.every(row=>row.method==='GET'),true,'startup and reconnect read only');await f.cleanup();
}
{
 const f=fixture();f.run('installScheduleAutoRefresh()');let release;f.setBodyHook(()=>new Promise(resolve=>{release=resolve;}));
 const read=f.run('requestScheduleRefresh()');await turn();f.emit('window','pagehide');await read;release();await turn();
 check(f.rendered.length,0,'pagehide retires late body');check(f.timers.size,0,'pagehide and late body own no timers');
 check(f.run('state.snapshot.authority_revision'),7,'hidden old response cannot publish');
}
// Existing manual current-read behavior remains independent of background
// convergence and retains known acceptance until its actual acknowledgement.
{
 const f=fixture();f.run('installScheduleAutoRefresh()');
 await assert.rejects(()=>f.run("state.actions.run('/static-weekly/rebuild-current-projection',{week_start:'2026-09-21',expected_revision:7,idempotency_key:'synthetic-original'})"));checks++;
 const bytes=[...f.storageMap.values()],calls=f.calls.length;
 check(bytes.length,1,'real actions client retained unknown original before transport');
 await f.run('requestScheduleRefresh()');await f.fire(30000);
 check(f.calls.length,calls,'automatic read never retries or competes with real original');
 check([...f.storageMap.values()],bytes,'real durable request stays byte-identical');
 check(f.run('state.pending.state'),'PENDING','unknown original remains unresolved');await f.cleanup();
}
{
 const f=fixture();f.run('installScheduleAutoRefresh()');f.run("state.pending={state:'ACCEPTED',encoded:'EXACT'};globalThis.acks=0;state.actions={acknowledge:()=>{acks++;}}");
 await f.run('requestScheduleRefresh()');check(f.calls.length,0,'automatic read never acknowledges accepted original');
 await f.run('refreshSnapshot()');check(f.run('acks'),1,'explicit current read still acknowledges through current actions');check(f.run('state.pending.encoded'),'EXACT','automatic work did not replace original bytes');await f.cleanup();
}
console.log(JSON.stringify({status:'PASS_MANAGER_REFRESH_CURRENT_SOURCE',checks,limits:'Actual current page/API/actions permissions and publication reader; synthetic DOM/auth/transport/timers. No browser, live manager, SQL, phone or numeric delivery SLA proof.'}));
