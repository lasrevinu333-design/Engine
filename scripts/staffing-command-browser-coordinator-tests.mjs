import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../memphis-staffing-command.js',import.meta.url),'utf8');
const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'];
const operation='20000000-0000-4000-8000-000000000001',preview='a'.repeat(64);
const manager='40000000-0000-4000-8000-000000000001',successor='40000000-0000-4000-8000-000000000002';
const previewContent={schema:'memphis-zoo.staffing-command-preview.v1',weeks:[{week_start:'2026-09-28',assignments:[],lunch_responsibilities:[],lunch_loans:[]}]};
function fixture({sharedData=null,managerId=manager}={}){
 const data=sharedData||new Map(),states=[],calls=[];let id=0,phase='none',failAt=null;
 const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 const api=async(path,options={})=>{
  calls.push({path,method:options.method||'GET',body:options.body});
  const marker=`${options.method||'GET'} ${path}`;if(failAt===marker){failAt=null;throw new Error('synthetic lost response');}
  if(path==='/static-weekly/staffing-commands'){phase='preparing';return{operation_id:operation,state:'PREPARING'};}
  if(path===`/static-weekly/staffing-commands/${operation}/prepare`){phase='prepared';return{state:'PREPARED'};}
  if(path===`/static-weekly/staffing-commands/${operation}/confirm`){phase=phase==='reject_on_confirm'?'rejected':'accepted';return{state:phase==='rejected'?'REJECTED':'ACCEPTED'};}
  if(path===`/static-weekly/staffing-commands/${operation}/cancel`){phase='cancelled';return{state:'CANCELLED'};}
  if(path===`/static-weekly/staffing-commands/${operation}/delivery`)return{targets:[{status:'PENDING'}]};
  if(path===`/static-weekly/staffing-commands/${operation}`)return phase==='accepted'?{state:'ACCEPTED'}:phase==='prepared'||phase==='reject_on_confirm'?{state:'PREPARED',preview_digest:preview,preview:previewContent}:phase==='cancelled_by_successor'?{state:'CANCELLED_BY_SUCCESSOR'}:phase==='cancelled'?{state:'CANCELLED'}:phase==='rejected'?{state:'REJECTED'}:{state:'PREPARING'};
  throw new Error(`unexpected ${marker}`);
 };
 const context=vm.createContext({console,JSON,globalThis:{}});vm.runInContext(source,context);
 const coordinator=context.globalThis.MemphisStaffingCommand.createStaffingCommandCoordinator({api,managerId,storage,uuid:()=>ids[id++],onState:value=>states.push(value)});
 return{coordinator,calls,data,states,setPhase:value=>{phase=value;},fail:value=>{failAt=value;}};
}
const command={command_kind:'absence',employee_id:'30000000-0000-4000-8000-000000000001',start_date:'2026-09-28',end_date:'2026-09-28',absence_kind:'daily_absence',expected_revision:12};
let checks=0;const same=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
{
 const f=fixture(),prepared=await f.coordinator.prepare(command);
 same(prepared.phase,'PREPARED','preparation pauses for manager review');
 same(f.calls.some(row=>row.path.endsWith('/confirm')),false,'preparation never auto-confirms');
 const result=await f.coordinator.confirm();
 same(result.delivery.targets[0].status,'PENDING','delivery remains pending until device readback');
 same(f.calls.map(row=>row.path),['/static-weekly/staffing-commands',`/static-weekly/staffing-commands/${operation}`,`/static-weekly/staffing-commands/${operation}/prepare`,`/static-weekly/staffing-commands/${operation}`,`/static-weekly/staffing-commands/${operation}`,`/static-weekly/staffing-commands/${operation}/confirm`,`/static-weekly/staffing-commands/${operation}`,`/static-weekly/staffing-commands/${operation}/delivery`],'begin and prepare pause before separately confirmed acceptance and delivery readback');
 same(f.data.size,0,'recovery record clears only after accepted command and delivery read');
}
{
 const f=fixture();f.fail('POST /static-weekly/staffing-commands');await assert.rejects(()=>f.coordinator.prepare(command),/synthetic lost response/);checks++;
 const first=f.calls[0],prepared=await f.coordinator.recover();same(f.calls[1],first,'lost begin retries byte-identical body and prepare key');same(prepared.phase,'PREPARED','lost begin recovers only to reviewable prepared state');same(f.data.size,1,'unconfirmed preparation stays durable');
}
{
 const f=fixture();await f.coordinator.prepare(command);f.fail(`POST /static-weekly/staffing-commands/${operation}/confirm`);await assert.rejects(()=>f.coordinator.confirm(),/synthetic lost response/);checks++;
 const confirm=f.calls.find(row=>row.path.endsWith('/confirm'));f.setPhase('accepted');const result=await f.coordinator.recover();
 same(result.command.state,'ACCEPTED','unknown confirm resolves from durable accepted ledger');
 same(f.calls.filter(row=>row.path.endsWith('/confirm')).length,1,'accepted readback prevents a second confirm post');
 same(JSON.parse(confirm.body),{preview_digest:preview,confirmation_key:ids[1]},'confirmation binds frozen preview and one persisted key');
}
{
 const f=fixture();f.fail(`POST /static-weekly/staffing-commands/${operation}/prepare`);await assert.rejects(()=>f.coordinator.prepare(command),/synthetic lost response/);checks++;
 assert.throws(()=>f.coordinator.prepare({...command,end_date:'2026-09-29'}),error=>error?.code==='staffing_browser_different_command_pending');checks++;
 same(Boolean(f.states.at(-1)?.pendingWrite),true,'unknown write remains an exact mutation fence');
}
{
 const shared=new Map(),original=fixture({sharedData:shared});original.fail('POST /static-weekly/staffing-commands');
 await assert.rejects(()=>original.coordinator.prepare(command),/synthetic lost response/);checks++;
 const changedManager=fixture({sharedData:shared,managerId:successor});
 same(await changedManager.coordinator.recover(),null,'a different manager has no adoptable local recovery record');
 same(changedManager.calls.length,0,'a different authenticated manager cannot replay or adopt a lost begin');
}
{
 const f=fixture();await f.coordinator.prepare(command);
 f.setPhase('cancelled_by_successor');
 await assert.rejects(()=>f.coordinator.recover(),error=>error?.code==='staffing_browser_command_cancelled_by_successor');checks++;
 same(f.data.size,0,'durable successor cancellation readback clears the obsolete browser fence');
}
{
 const f=fixture();await f.coordinator.prepare(command);const cancelled=await f.coordinator.cancel();
 same(cancelled.state,'CANCELLED','manager can abandon a reviewed preparation without accepting it');
 same(f.calls.some(row=>row.path.endsWith('/confirm')),false,'cancelling a preparation never confirms it');
 same(f.data.size,0,'acknowledged cancellation releases the browser fence');
}
{
 const f=fixture();await f.coordinator.prepare(command);f.setPhase('reject_on_confirm');
 await assert.rejects(()=>f.coordinator.confirm(),error=>error?.code==='staffing_browser_command_rejected');checks++;
 same(f.calls.filter(row=>row.path.endsWith('/confirm')).length,1,'elapsed terminal rejection never auto-retries confirmation');
 same(f.data.size,0,'terminal elapsed rejection releases the originating browser fence');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'browser durable begin/prepare/confirm/readback coordinator; synthetic transport, no PostgreSQL or phone'}));
