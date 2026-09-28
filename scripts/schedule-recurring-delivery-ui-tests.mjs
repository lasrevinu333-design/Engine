import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync(new URL('../schedule-weekly.html',import.meta.url),'utf8');
const source=page.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/^init\(\)\.catch\([^\n]+$/m,'');
const id=n=>`94000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clone=x=>JSON.parse(JSON.stringify(x));
const base={schema:'static-weekly.current-recurring-delivery.v1',serviceDate:'2026-09-28',observedAt:'2026-09-27T01:15:00Z',
 mode:'RECURRING_SCHEDULE',projectionStatus:'current',currentAuthority:{publicationId:id(1),projectionId:id(2),authorityRevision:42,invalidationId:null},
 targets:[{employeeId:id(3),employeeName:'Synthetic <img src=x>',deviceId:id(4),deviceName:'Phone <script>',credentialId:id(5),assignmentEpoch:1,
  intentId:id(6),targetDigest:'a'.repeat(64),status:'PENDING',receiptId:null,receivedAt:null}],
 targetCount:1,reportedCount:0,allCurrentTargetsReported:false,affectedPhonesUpdated:false,coverageReadinessNotInferred:true};
function fixture(){
 const nodes=new Map(),timers=new Map(),calls=[];let timerId=0;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',addEventListener(){}});return nodes.get(id);};
 const context=vm.createContext({console,URL,URLSearchParams,AbortController,document:{getElementById:node},
  window:{setTimeout:f=>{timers.set(++timerId,f);return timerId;},clearTimeout:id=>timers.delete(id)},
  navigator:{onLine:true},location:{}});
 const run=code=>vm.runInContext(code,context);run(source);context.reply=clone(base);context.calls=calls;
 run(`state.managerId='${id(10)}';state.baseUrl='https://synthetic.invalid';state.snapshot={current_publication:{publication_id:'${id(1)}'},
  latest_projection:{projection_id:'${id(2)}'},projection_status:'current'};els.service_date.value='2026-09-28';
  api=async(path,options)=>{calls.push({path,options});return reply;};`);
 return{run,node,calls,timers,context};
}
let checks=0;const same=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
{
 const f=fixture();await f.run('refreshRecurringDelivery()');
 assert.match(f.node('recurring-delivery-summary').textContent,/0 of 1 current targets reported applied/);checks++;
 assert.match(f.node('recurring-delivery-list').innerHTML,/Pending phone application/);checks++;
 assert.ok(!f.node('recurring-delivery-list').innerHTML.includes('<img'));checks++;
 assert.ok(!f.node('recurring-delivery-list').innerHTML.includes('<script>'));checks++;
 same(f.calls[0].options.expectedManagerId,id(10),'report request binds named manager');
 same(f.calls[0].path,'/static-weekly/recurring-adaptation/delivery?service_date=2026-09-28','one finite-date request');
 same(f.timers.size,0,'bounded read timer cleaned');
}
{
 const f=fixture();f.run(`reply.targets[0].status='DEVICE_REPORTED_APPLIED';reply.targets[0].receiptId='${id(7)}';
  reply.targets[0].receivedAt=reply.observedAt;reply.reportedCount=1;reply.allCurrentTargetsReported=true;reply.affectedPhonesUpdated=true;`);
 await f.run('refreshRecurringDelivery()');assert.match(f.node('recurring-delivery-summary').textContent,/1 of 1 current targets reported applied/);checks++;
 assert.match(f.node('recurring-delivery-summary').textContent,/does not certify coverage or current connectivity/);checks++;
}
{
 const f=fixture();f.run(`state.snapshot.projection_status='blocked_recurring_authority';reply.mode='RECURRING_TERMINAL';
  reply.targets[0].status='DEVICE_REPORTED_BLOCKED';reply.targets[0].receiptId='${id(7)}';reply.targets[0].receivedAt=reply.observedAt;
  reply.reportedCount=1;reply.allCurrentTargetsReported=true;`);
 await f.run('refreshRecurringDelivery()');assert.match(f.node('recurring-delivery-summary').textContent,/blocked receipts are not replacement coverage/);checks++;
}
for(const mutation of ["reply.schema='bad'","reply.serviceDate='2026-09-29'","reply.currentAuthority.publicationId='old'",
 "reply.currentAuthority.projectionId='old'","reply.reportedCount=1","reply.affectedPhonesUpdated=true",
 "reply.allCurrentTargetsReported=true","reply.targets[0].status='DELIVERED'",
 "reply.targets.push({...reply.targets[0]});reply.targetCount=2", "reply.mode='RECURRING_TERMINAL'",
 "reply.targets[0].status='DEVICE_REPORTED_APPLIED';reply.reportedCount=1;reply.allCurrentTargetsReported=true;reply.affectedPhonesUpdated=true"]){
 const f=fixture();f.run(mutation);await f.run('refreshRecurringDelivery()');
 assert.match(f.node('recurring-delivery-summary').textContent,/unavailable or stale/);checks++;
 same(f.node('recurring-delivery-list').innerHTML,'','invalid receipt never renders success');same(f.timers.size,0,'failure cleans timer');
}
{
 const f=fixture();await f.run('refreshRecurringDelivery()');f.run("api=async()=>{throw Error('offline');}");
 await f.run('refreshRecurringDelivery()');same(f.node('recurring-delivery-list').innerHTML,'','offline clears prior-success presentation');
 assert.match(f.node('recurring-delivery-summary').textContent,/pending, not confirmed/);checks++;
}
{
 const f=fixture();f.run('api=()=>new Promise(resolve=>{globalThis.resolveOld=resolve;})');const pending=f.run('refreshRecurringDelivery()');
 f.run("els.service_date.value='2026-09-29';api=async()=>({...reply,serviceDate:'2026-09-29'});");
 await f.run('refreshRecurringDelivery()');const current=f.node('recurring-delivery-summary').textContent;
 f.run('resolveOld(reply)');await pending;same(f.node('recurring-delivery-summary').textContent,current,'late old-date read cannot replace new selection');same(f.timers.size,0,'both request timers cleaned');
}
{
 const f=fixture();f.run("reply.mode='UNAVAILABLE';reply.targets=[];reply.targetCount=0;");await f.run('refreshRecurringDelivery()');
 assert.match(f.node('recurring-delivery-summary').textContent,/No phone update is confirmed/);checks++;
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual manager page readback with synthetic DOM/auth/transport; not real manager or phone acceptance'}));
