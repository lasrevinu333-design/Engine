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
 const f=fixture();await f.run('applyDayChanges()');const input=f.json('executed[0]');
 same(input,{command_kind:'absence',employee_id:person,start_date:'2026-09-24',end_date:'2026-09-24',absence_kind:'daily_absence',expected_revision:17},'manager UI binds person/date/type/revision to durable command');
 same(f.run('confirmations.length'),1,'one explicit confirmation follows prepared schedule preview');assert.match(f.run('confirmations[0]'),/Kathy — Area A/);checks++;same(f.run('refreshed'),1,'accepted command refreshes authoritative manager view');
 assert.match(f.node('status').textContent,/1 pending/);checks++;
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
