import assert from 'node:assert/strict';
import {privatePreviewFixture,cancellationFixture,A} from './fixtures/helper-current-scheduler-contract-fixtures.mjs';
let checks=0;const same=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
function selectedAbsence(){const f=privatePreviewFixture(),slot=f.record.input.slots.find(row=>row.incumbencies?.some(person=>person.personId===f.body.employee_id));
 const checked={dataset:{calloutSlot:slot.id},checked:true,disabled:false};
 f.context.document.querySelectorAll=selector=>selector==='[data-callout-slot]:checked:not(:disabled)'?[checked]:[];
 f.page.els.absence_type.value=f.body.absence_kind;f.context.crypto={randomUUID:()=>f.body.client_prepare_key};return{...f,checked};}
{
 const f=selectedAbsence();await f.page.applyDayChanges();const begin=f.requests.find(row=>row.path===A.staffingCommandPath);
 same(JSON.parse(begin.options.body),f.body,'actual manager UI binds exact person/date/type/revision/preparation key');
 same(f.actions.pending().body,f.body,'saved original body equals selected input');same(f.actions.pending().command.phase,'PREPARED','private candidate is prepared');
 same(f.confirmCount(),0,'preparation never automatically publishes');same(f.nodes.get('approved-preview-panel').hidden,false,'actual dated candidate is visible before confirmation');
 const duties=f.nodes.get('approved-preview-rows').children;same(duties.length,f.enriched.preview.weeks[0].assignments.length,'review contains each actual prepared duty');
 same(duties.every(row=>row.children[0].textContent===f.body.start_date),true,'review duties bind original requested day');
 same(duties.every(row=>row.children[1].textContent.startsWith('CoverAll capacity')),true,'review displays actual prepared capacity owner');
 assert.match(f.nodes.get('approved-preview-summary').textContent,/Relative weekly equity index/);checks++;
 same(f.requests.some(row=>row.path==='/static-weekly/day-changes/batch'),false,'single employee uses durable staffing protocol');
 const original=f.actions.pending().encoded;let dialogs=0;f.context.confirmAction=async()=>{dialogs++;return false;};
 await f.nodes.get('staffing-confirm-btn').listeners.get('click')();same(f.confirmCount(),0,'cancel keeps private preview unconfirmed');same(f.actions.pending().encoded,original,'cancel preserves exact original');
 f.context.confirmAction=async()=>{dialogs++;return true;};await f.nodes.get('staffing-confirm-btn').listeners.get('click')();
 same(dialogs,2,'one cancelled review then one explicit accepted review');same(f.confirmCount(),1,'exactly one authoritative confirmation');
 same(f.map.size,0,'accepted original clears only after current persisted readback');same(f.page.state.snapshot.authority_revision,f.current.authority_revision,'current accepted manager view refreshed');
 same(f.requests.filter(row=>row.path.endsWith('/confirm')).length,1,'one confirmation endpoint call');
}
{
 const f=cancellationFixture();await f.page.reverseChange(f.event);const input=f.actions.pending().body;
 same(input,{command_kind:'cancel_absence',employee_id:f.original,start_date:'2026-10-14',end_date:'2026-10-20',target_absence_id:f.target,client_prepare_key:f.context.crypto.randomUUID(),expected_revision:7},'cancel binds original employee and entire remaining accepted window');
 same(input.employee_id===f.occupant,false,'current occupant never substitutes for original absent employee');same(f.actions.pending().weekBindings.length,2,'both remaining weeks are bound');
 same(f.confirmationCount(),0,'cancellation first exposes private current-plan preview');
 assert.match(f.nodes.get('approved-preview-summary').textContent,/ALL 2 remaining weeks/);checks++;
 f.context.confirmAction=async()=>true;await f.nodes.get('staffing-confirm-btn').listeners.get('click')();
 same(f.confirmationCount(),1,'one explicit remaining-window cancellation confirmation');same(f.map.size,0,'all-week accepted readback settles original cancellation');
}
{
 const f=selectedAbsence();f.page.state.snapshot.approved_manual_period={schema:'custodial.approved-manual-period-window.v1',
  manifestSha256:'fe02bbdebc736d95360b55cc7dfe5b73c5a9eaa76f364f1c0f4420a0afb9950f',publicationId:f.before.current_publication.publication_id,
  versionId:f.before.current_publication.version_id,frameStart:f.before.week_start,frameEnd:f.before.week_end,origin:f.before.week_start,normalSourceLocked:true};
 f.context.document.querySelectorAll=selector=>selector==='[data-callout-slot]:checked:not(:disabled)'?[f.checked,{dataset:{calloutSlot:'other'},disabled:false}]:[];
 await assert.rejects(f.page.applyDayChanges(),/one employee absence/i);checks++;
 same(f.requests.length,0,'approved manual plan never dispatches a partial multi-employee command');same(f.map.size,0,'invalid multiple selection saves no original');
}
{
 const f=selectedAbsence();await f.page.applyDayChanges();const bytes=f.actions.pending().encoded;f.failConfirm();f.context.confirmAction=async()=>true;
 await f.nodes.get('staffing-confirm-btn').listeners.get('click')();same(f.confirmCount(),1,'lost reply still records one attempted confirmation');
 same(f.actions.pending().encoded,bytes,'unknown reply retains exact original input');const before=f.requests.length;
 await f.page.resumeStaffingPreview();same(f.requests.slice(before).every(row=>row.options.method!=='POST'),true,'unknown confirmation resumes GET-only');
 same(f.confirmCount(),1,'recovery never reconfirms');same(f.map.size,0,'exact accepted readback clears original after recovery');
}
for(const change of ['employee','range','server-day','future-basis']){
 const f=cancellationFixture();if(change==='employee')delete f.page.state.snapshot.exceptions[0].staffingEmployeeId;
 if(change==='range')delete f.page.state.snapshot.exceptions[0].staffingEndDate;if(change==='server-day')f.setToday(undefined);if(change==='future-basis')f.setMissingBasis();
 try{await f.page.reverseChange(f.event);}catch(error){assert.match(error.message,/original accepted absence/i);}
 same(f.requests.some(row=>row.options.method==='POST'),false,change+' cannot prepare an inferred/truncated cancellation');same(f.map.size,0,change+' preserves no fabricated original');
}
console.log(JSON.stringify({status:'PASS_CURRENT_STAFFING_MANAGER_BINDING',checks,scope:'Actual current page/actions private preparation, one explicit confirmation, full remaining-window cancellation and GET-only original recovery; exact extracted synthetic fixtures. No live auth/SQL/phone proof.'}));
