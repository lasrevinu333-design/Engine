import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../schedule-weekly.html',import.meta.url),'utf8');
const slice=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const functions=slice('function contractorOperations(','async function rebuildCurrentProjection(');
const value={start:'07:00',end:'16:00',lunchStart:'11:00',lunchEnd:'12:00'};
function fixture(){
 const state={busy:false},sent=[];let shift={...value},confirm=async()=>true,failWrite=false,failRead=false;
 const row={querySelector(selector){return{value:({'[data-shift-start]':shift.start,'[data-shift-end]':shift.end,'[data-lunch-start]':shift.lunchStart,'[data-lunch-end]':shift.lunchEnd})[selector]};}};
 const contractor={dataset:{contractorSlot:'CONTRACTOR'},closest:()=>row},employee={dataset:{calloutSlot:'EMPLOYEE'}};
 const snapshot={current_publication:{version_id:'VERSION',publication_id:'PUBLICATION'},authority_revision:7,week_start:'2026-10-05'};
 const context=vm.createContext({state,els:{absence_type:{value:'daily_absence'}},document:{querySelectorAll:selector=>selector.startsWith('[data-callout')?[employee]:[contractor]},needSnapshot:()=>snapshot,selectedServiceDate:()=> '2026-10-06',confirmAction:(...args)=>confirm(...args),commandId:()=> 'ONE-EXACT-COMMAND',busy:async fn=>{state.busy=true;try{return await fn();}finally{state.busy=false;}},api:async(path,options)=>{sent.push({path,...options});if(failWrite)throw Error('network response unknown');return {};},refreshSnapshot:async()=>{if(failRead)throw Error('read unavailable');}});
 vm.runInContext(functions,context);
 return{context,state,sent,contractor,employee,snapshot,setShift:change=>Object.assign(shift,change),setConfirm:fn=>{confirm=fn;},setFailWrite:x=>{failWrite=x;},setFailRead:x=>{failRead=x;}};
}
test('actual contractor form emits capacity and one-hour lunch',()=>{const f=fixture(),ops=f.context.contractorOperations(f.contractor);assert.equal(ops.length,2);assert.equal(ops[1].starts_at,'11:00');assert.equal(ops[1].ends_at,'12:00');});
for(const [name,change]of[['missing lunch',{lunchStart:''}],['short lunch',{lunchEnd:'11:30'}],['outside shift',{lunchStart:'16:00',lunchEnd:'17:00'}]])test('actual contractor form rejects '+name,()=>{const f=fixture();f.setShift(change);assert.throws(()=>f.context.contractorOperations(f.contractor));});
test('confirmation freezes selected employees, times and revision',async()=>{const f=fixture();let accept;f.setConfirm(()=>new Promise(resolve=>{accept=resolve;}));const pending=f.context.applyDayChanges();f.employee.dataset.calloutSlot='CHANGED';f.setShift({lunchStart:'13:00',lunchEnd:'14:00'});f.snapshot.authority_revision=99;accept(true);await pending;const body=JSON.parse(f.sent[0].body);assert.equal(body.expected_revision,7);assert.equal(body.operations[0].payload.slotId,'EMPLOYEE');assert.equal(body.operations[2].starts_at,'11:00');});
test('unknown write outcome retries exact bytes and idempotency key',async()=>{const f=fixture();f.setFailWrite(true);await assert.rejects(()=>f.context.applyDayChanges());const first=f.sent[0].body;f.setShift({lunchStart:'13:00',lunchEnd:'14:00'});f.setFailWrite(false);await f.context.applyDayChanges();assert.equal(f.sent[1].body,first);assert.equal(f.state.dayChangeRequest,null);});
test('accepted write plus failed refresh never publishes again',async()=>{const f=fixture();f.setFailRead(true);await assert.rejects(()=>f.context.applyDayChanges());assert.equal(f.state.dayChangeRequest.accepted,true);f.setFailRead(false);await f.context.applyDayChanges();assert.equal(f.sent.length,1);assert.equal(f.state.dayChangeRequest,null);});
test('cancelled confirmation does not publish',async()=>{const f=fixture();f.setConfirm(async()=>false);await f.context.applyDayChanges();assert.equal(f.sent.length,0);});
test('the scheduler has no assumed contractor lunch',()=>{assert.match(html,/data-lunch-start type="time" value=""/);assert.match(html,/data-lunch-end type="time" value=""/);assert.match(html,/els\.generate_btn\.disabled=!owner/);assert.match(html,/els\.publish_btn\.disabled=!owner/);});
