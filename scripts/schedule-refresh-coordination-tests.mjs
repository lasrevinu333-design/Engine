import assert from 'node:assert/strict';
import {fixture,turn} from './fixtures/helper-current-schedule-refresh-fixture.mjs';
let checks=0;
function check(value,expected,label){assert.deepEqual(value,expected,label);checks++;}
// MR01 now uses the current explicit publish/remove/materialize handlers.
// Generate is a private-preview action in the current design; the historical
// expectation of immediate generation confirmation is preserved in evidence.
for(const action of ['publishDraft()','reverseChange({target:{closest:()=>({dataset:{reverseException:"exception"}})}})','rebuildCurrentProjection()']){
 const f=fixture();f.run(`state.snapshot.exceptions=[{id:'exception',type:'pto',serviceDate:'2026-09-24'}];
  state.preview={input:{effective_start:'2026-09-21',expected_revision:7},kind:'recurring',preview:{}};
  state.approved={confirm:async(...args)=>recordWrite(...args)};state.actions={run:async(...args)=>recordWrite(...args),acknowledge:()=>false};
  installScheduleAutoRefresh();`);
 if(action!=='publishDraft()')f.run('state.preview=null');
 const work=f.run(action);await turn();check(f.node('action-confirm-dialog').open,true,action+' opens actual dialog');
 await f.run('requestScheduleRefresh()');check(f.calls.length,0,'open review defers background read');
 f.node('action-confirm-dialog').close('confirm');await turn();check(f.writes.length,1,'confirmed handler owns exactly one mutation before queued read');
 await f.fire(0);await work;check(f.writes.length,1,'deferred automatic read never duplicates mutation');
 check(f.calls.every(row=>row.method==='GET'),true,'background transport stays GET-only');await f.cleanup();
}
// MR02: actual edit/close events release only discarded or reverted input.
for(const preserveDayInput of [false,true]){
 const f=fixture();f.run('installScheduleAutoRefresh()');
 if(preserveDayInput){f.choice.checked=true;f.emit('document','change',{target:f.choice});}
 f.node('turnover-dialog').showModal();f.emit('document','input',{target:{closest:selector=>selector.includes('#turnover-form')?{}:null}});
 await f.run('requestScheduleRefresh()');f.run('closeTurnoverDialog()');await f.fire(0);
 check(f.run('state.scheduleInputDirty'),preserveDayInput,'closing turnover preserves actual day choice');
 check(f.calls.length,preserveDayInput?0:2,'close releases read only without remaining choice');await f.cleanup();
}
for(const phase of ['auth','fetch','body']){
 const f=fixture();let release;const gate=new Promise(resolve=>{release=resolve;});
 if(phase==='auth')f.auth.opsManagerAuthHeaders=()=>gate;
 if(phase==='fetch')f.setReadHook(()=>gate);
 if(phase==='body')f.setBodyHook(()=>gate);
 const work=f.run('requestScheduleRefresh()');let settled=false;work.then(()=>settled=true);await turn();
 check(f.timers.size,1,phase+' owns one bounded whole-read timeout');await f.fire(15000);await work;
 check(settled,true,phase+' timeout settles automatic promise');check(f.run('state.busy'),false,phase+' releases controls');
 check(f.run('state.scheduleRefreshRunning'),false,phase+' releases read owner');check(f.run('state.scheduleRefreshQueued'),true,phase+' queues recovery');
 release({});await turn();check(f.calls.length,phase==='auth'?0:1,'late '+phase+' cannot dispatch another obsolete GET');
 check(f.run('state.snapshot.authority_revision'),7,'late '+phase+' cannot publish');check(f.rendered.length,0,'late '+phase+' cannot render');
 check(f.timers.size,0,phase+' leaves no timer');
}
{
 const f=fixture();f.run('installScheduleAutoRefresh()');
 const action=f.run("confirmAction('Synthetic review').then(approved=>{if(approved)return busy(()=>recordWrite('confirmed'));})");
 await f.run('requestScheduleRefresh()');f.node('action-confirm-dialog').close('cancel');await action;await f.fire(0);
 check(f.writes.length,0,'cancelled confirmation never writes');check(f.calls.length,2,'cancelled confirmation releases queued read');
 f.node('turnover-dialog').showModal();await f.run('requestScheduleRefresh()');f.run('closeTurnoverDialog()');
 check([...f.timers.values()].filter(t=>t.delay===0).length,1,'close owns only one deferred task');await f.cleanup();
}
// The real API cannot acquire a new principal after any asynchronous phase.
for(const phase of ['auth','fetch','body']){
 const f=fixture();let release;const gate=new Promise(resolve=>{release=resolve;});
 if(phase==='auth')f.auth.opsManagerAuthHeaders=()=>gate;
 if(phase==='fetch')f.setReadHook(()=>gate);
 if(phase==='body')f.setBodyHook(()=>gate);
 const work=f.run('requestScheduleRefresh()');await turn();f.session.credential_id='replacement-credential';release({});await work;
 check(f.rendered.length,0,phase+' successor credential cannot publish old read');
 check(f.calls.length,phase==='auth'?0:1,phase+' credential change cannot start a later GET');
 check(f.run('state.accessDenied'),true,phase+' withdraws changed session');check(f.timers.size,0,phase+' releases bounded timer');
}
// Metadata is staged with the snapshot. Timeout at the second GET may not
// publish the newer snapshot while leaving old approved choices visible.
{
 const f=fixture();let release;f.setReadHook(path=>path==='/static-weekly/approved-choices'?new Promise(resolve=>{release=resolve;}):Promise.resolve());
 const work=f.run('requestScheduleRefresh()');await turn();check(f.calls.length,2,'snapshot then source choices read');
 await f.fire(15000);await work;release();await turn();check(f.run('state.snapshot.authority_revision'),7,'second-stage timeout retains whole original view');
 check(f.rendered.length,0,'second-stage timeout never partially renders');check(f.timers.size,0,'second-stage timeout owns no timer');
}
for(const phase of ['auth','fetch','body']){
 const f=fixture();f.run('installScheduleAutoRefresh()');let release;const gate=new Promise(resolve=>{release=resolve;});
 if(phase==='auth')f.auth.opsManagerAuthHeaders=()=>gate;if(phase==='fetch')f.setReadHook(()=>gate);if(phase==='body')f.setBodyHook(()=>gate);
 const work=f.run('requestScheduleRefresh()');await turn();f.emit('window','pagehide');await work;release({});await turn();
 check(f.rendered.length,0,phase+' pagehide retires response');check(f.timers.size,0,phase+' pagehide owns no interval/deferred/deadline');
}
{
 const f=fixture();f.run('installScheduleAutoRefresh()');await f.fire(30000);
 check(f.calls.length,2,'existing product cadence checks current read when no event arrives');check(f.writes.length,0,'timer never writes');await f.cleanup();
}
console.log(JSON.stringify({status:'PASS_REFRESH_COORDINATION_CURRENT_SOURCE',checks,failed:0,
 limits:'Actual current page/API permission and publication reader with synthetic DOM, transport and controlled timers. No browser, live auth, SQL, phone or delivery SLA proof.'}));
