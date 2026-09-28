import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../schedule-weekly.html',import.meta.url),'utf8');
const source=page.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/^init\(\)\.catch\([^\n]+$/m,'');
const person='10000000-0000-4000-8000-000000000001',slot='20000000-0000-4000-8000-000000000001',absence='30000000-0000-4000-8000-000000000001';
function fixture(){
 const nodes=new Map(),calls=[];const checked={dataset:{calloutSlot:slot},checked:true,disabled:false};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,hidden:false,open:false,dataset:{},addEventListener(){},replaceChildren(){},classList:{toggle(){}}});return nodes.get(id);};
 const document={hidden:false,getElementById:node,querySelectorAll:selector=>selector==='[data-callout-slot]:checked:not(:disabled)'?[checked]:selector==='[data-contractor-slot]:checked:not(:disabled)'?[]:selector==='[data-callout-slot],[data-contractor-row] input'?[checked]:selector==='[data-turnover-slot],[data-reverse-exception]'?[]:[]};
 const context=vm.createContext({console,URL,URLSearchParams,AbortController,document,navigator:{onLine:true},location:{hash:'',search:''},crypto:{randomUUID:()=>absence},window:{lucide:{createIcons(){}},MemphisAuth:{getCSTDateString:()=> '2026-09-24'}}});
 const run=code=>vm.runInContext(code,context);run(source);
 run(`globalThis.executed=[];globalThis.refreshed=0;globalThis.confirmations=[];
  state.snapshot={week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:17,drafts:[],
   current_publication:{publication_id:'publication',version_id:'version'},availability:[],assignments:[],exceptions:[],
   roster:[{slot_id:${JSON.stringify(slot)},slot_label:'Karen position',incumbencies:[{person_id:${JSON.stringify(person)},person_name:'Karen',effective_start:'2020-01-01',effective_end:null}],week_staffing:[{service_date:'2026-09-24',person_id:${JSON.stringify(person)},person_name:'Karen',availability_state:'working',device_ids:['KIOSK_08']}]}]};
  els.week_start.value='2026-09-21';els.service_date.value='2026-09-24';els.absence_type.value='daily_absence';
  confirmAction=async(message)=>{confirmations.push(message);return true;};refreshSnapshot=async()=>{refreshed++;};
  state.staffingCoordinator={hasPending:()=>false,recover:async()=>null,prepare:async(input)=>{executed.push(input);return{phase:'PREPARED',command:{state:'PREPARED',semantic_body:{commandKind:input.command_kind,startDate:input.start_date,endDate:input.end_date}},preview:{schema:'memphis-zoo.staffing-command-preview.v1',weeks:[{week_start:'2026-09-21',assignments:[{service_date:input.start_date,status:'assigned',owner_name_snapshot:'Kathy',work_id:'Area A',work_snapshot:{locationNameSnapshot:'Area A',window:{start:'07:00',end:'09:00'}}}],lunch_responsibilities:[]}]}};},confirm:async()=>({command:{state:'ACCEPTED'},delivery:{targets:[{status:'PENDING'}]}}),cancel:async()=>({state:'CANCELLED'})};`);
 context.__calls=calls;
 return{run,node,checked,json:value=>JSON.parse(run(`JSON.stringify(${value})`)),context};
}
let checks=0;const same=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
{
 const f=fixture();f.run(`state.snapshot.projection_status='blocked_recurring_authority';
  state.snapshot.latest_projection={projection_id:'old',assignments:[{work_id:'stale-area',status:'assigned'}]};
  state.snapshot.assignments=[{work_id:'fallback-old',status:'assigned'}];`);
 same(f.json('displayAssignments(state.snapshot)'),[],'blocked recurring authority cannot display stale projection or fallback assignments');
 f.run('renderReadiness(state.snapshot,[]);renderWeek(state.snapshot,[],[]);setControls()');
 assert.match(f.node('week-body').innerHTML,/blocked|repair/i);checks++;
 same(f.node('rebuild-projection-btn').disabled,true,'ordinary rebuild cannot clear a terminal recurring range');
 same(f.node('coverall-pdfs-btn').disabled,true,'blocked coverage cannot produce apparently current PDFs');
 assert.doesNotMatch(f.node('readiness-list').innerHTML,/Current staffing projection<\/strong><span class="pill ok"/);checks++;
 assert.doesNotMatch(f.node('readiness-list').innerHTML,/Open required work<\/strong><span class="pill ok"/);checks++;
}
{
 const f=fixture();await f.run('applyDayChanges()');const input=f.json('executed[0]');
 same(input,{command_kind:'absence',employee_id:person,start_date:'2026-09-24',end_date:'2026-09-24',absence_kind:'daily_absence',expected_revision:17},'manager UI binds person/date/type/revision to durable command');
 same(f.run('confirmations.length'),1,'one explicit confirmation follows prepared schedule preview');assert.match(f.run('confirmations[0]'),/Kathy — Area A/);checks++;same(f.run('refreshed'),1,'accepted command refreshes authoritative manager view');
 assert.match(f.node('status').textContent,/1 pending/);checks++;
}
{
 const f=fixture();f.node('absence-end-date').value='2026-10-06';await f.run('applyDayChanges()');
 same(f.json('executed[0].end_date'),'2026-10-06','manager-entered multiweek last absent day reaches the durable preview command');
 assert.match(f.run('confirmations[0]'),/2026-09-24 through 2026-10-06/);checks++;
}
{
 const f=fixture();f.node('absence-end-date').value='2026-09-23';
 await assert.rejects(()=>f.run('applyDayChanges()'),/last absent day/);checks++;
 same(f.run('executed.length'),0,'reversed absence window never reaches the durable command');
}
{
 const f=fixture(),pending='50000000-0000-4000-8000-000000000001';
 f.run(`globalThis.serverCancelled=false;globalThis.serverCalls=[];
  api=async(path,options={})=>{serverCalls.push([path,options.method||'GET']);
   if(path==='/static-weekly/staffing-commands/pending?limit=50')return{commands:serverCancelled?[]:[{operation_id:${JSON.stringify(pending)},state:'PREPARED'}]};
   if(path==='/static-weekly/staffing-commands/${pending}/cancel'){serverCancelled=true;return{state:'CANCELLED_BY_SUCCESSOR'};}
   if(path==='/static-weekly/staffing-commands/${pending}')return{state:serverCancelled?'CANCELLED_BY_SUCCESSOR':'PREPARED'};
   throw Error('unexpected server path '+path);};`);
 await f.run('discoverRemotePendingStaffing()');
 same(f.run('state.remotePendingStaffing.operation_id'),pending,'fresh manager browser discovers unfinished command from authenticated server');
 same(f.run('blockCompetingDayChange()'),true,'server-discovered unfinished command fences new schedule writes');
 same(f.run('serverCalls.some(row=>row[1]==="POST")'),false,'discovery never cancels or accepts on its own');
 await f.run('applyDayChanges()');
 same(f.run('serverCancelled'),true,'manager-confirmed successor cancellation reaches server ledger');
 same(f.run('state.remotePendingStaffing'),null,'terminal server readback and fresh pending inventory clear fence');
 same(f.run('confirmations.length'),1,'successor sees explicit confirmation before cancelling unaccepted work');
 same(f.run('serverCalls.some(row=>row[0].endsWith("/confirm"))'),false,'lost local confirmation key is never fabricated');
}
{
 const f=fixture();f.run(`api=async()=>{throw Error('synthetic inventory outage')}`);
 await assert.rejects(()=>f.run('discoverRemotePendingStaffing()'),/synthetic inventory outage/);checks++;
 same(f.run('state.remotePendingStaffing.state'),'UNINSPECTABLE','failed authenticated discovery retains a write-blocking state');
 same(f.run('blockCompetingDayChange()'),true,'inventory outage never permits a blind manager mutation');
}
{
 const f=fixture(),source='60000000-0000-4000-8000-000000000001';
 f.run(`state.snapshot.sources=[{source_id:${JSON.stringify(source)},configured_at:'2026-07-01T00:00:00Z'}];els.pattern_source.value=${JSON.stringify(source)};
  api=async(path,options)=>{executed.push({path,body:JSON.parse(options.body)});return{}};`);
 await f.run('generateDraft()');
 same(f.json('executed[0].path'),'/static-weekly/drafts/initial','selected registered position template uses source-hydrated draft path');
 same(f.json('executed[0].body.source_id'),source,'manager draft binds selected immutable source identity');
 same(f.run('refreshed'),1,'validated draft creation reloads authoritative snapshot before publication');
}
{
 const f=fixture();f.node('pattern-source').value='current';
 f.run(`api=async(path,options)=>{executed.push({path,body:JSON.parse(options.body)});return{}};`);
 await f.run('generateDraft()');
 same(f.json('executed[0].path'),'/static-weekly/drafts/replacement','default current-pattern draft still uses published-source lineage');
 same(f.json('executed[0].body.source_publication_id'),'publication','default recurring pattern binds the exact current publication');
}
{
 const f=fixture();f.node('pattern-source').value='unregistered-source';
 await assert.rejects(()=>f.run('generateDraft()'),/unavailable/);checks++;
 same(f.run('executed.length'),0,'unregistered or retired position template never reaches a write');
}
{
 const f=fixture();f.run('state.snapshot=null;setControls()');
 same(f.node('generate-btn').disabled,true,'missing authoritative snapshot disables new draft writes');
 same(f.node('publish-btn').disabled,true,'missing authoritative snapshot disables publication');
 same(f.node('refresh-btn').disabled,false,'manager can retry an unavailable snapshot read');
}
{
 const f=fixture();f.run(`state.snapshot.exceptions=[{id:${JSON.stringify(absence+':2026-09-24')},staffingAbsenceId:${JSON.stringify(absence)},type:'daily_absence',serviceDate:'2026-09-24'}];
  api=async(path)=>({state:'ACCEPTED',semantic_body:{commandKind:'absence',employeeId:${JSON.stringify(person)},endDate:'2026-09-26'}});`);
 await f.run(`reverseChange({target:{closest:()=>({dataset:{reverseException:${JSON.stringify(absence+':2026-09-24')}}})}})`);
 same(f.json('executed[0]'),{command_kind:'cancel_absence',employee_id:person,start_date:'2026-09-24',end_date:'2026-09-26',target_absence_id:absence,expected_revision:17},'return action cancels exact remaining accepted absence window');
 same(f.run('refreshed'),1,'accepted cancellation refreshes manager view');
}
{
 const f=fixture();f.context.document.querySelectorAll=selector=>selector==='[data-callout-slot]:checked:not(:disabled)'?[f.checked,{dataset:{calloutSlot:'other'},disabled:false}]:[];
 await assert.rejects(()=>f.run('applyDayChanges()'),/one employee absence at a time/);checks++;
 same(f.run('executed.length'),0,'multiple employees cannot become a partial pseudo-atomic command');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual manager page durable absence/cancellation binding; synthetic coordinator and DOM, no live auth/SQL/phone'}));
