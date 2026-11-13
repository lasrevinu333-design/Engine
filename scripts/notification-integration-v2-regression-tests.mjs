import {syntheticNotificationWriter} from './synthetic-notification-writer.mjs';
import assert from 'node:assert/strict';
import {custodialNotificationEnabled} from '../mobile/src/custodial/release-scope.js';
import {createScheduleNotificationAuthority} from '../mobile/src/custodial/notification-schedule-authority.js';
import {fixture as actualFixture,principal,data,turn} from './native-notification-arrival-boundary-tests.mjs';
import {payload,event,scope,day,id} from './notification-schedule-cache-authority-tests.mjs';
const fixtureTime=Date.parse('2026-10-25T17:15:00.000Z');
class FixtureDate extends Date{constructor(...args){super(...(args.length?args:[fixtureTime]));}static now(){return fixtureTime;}}
const currentAuthority=options=>createScheduleNotificationAuthority({...options,now:()=>fixtureTime});
const fixture=options=>actualFixture({...options,clock:FixtureDate,...(options?.scheduleAuthorityFactory?{scheduleAuthorityFactory:currentAuthority}:{})});
const results=[];
async function test(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
for(const bad of [{notification_type:'message',route:'messages.html'}, {kind:'Employee_Message'},
 {notification_type:'event',route:'events.html'}, {kind:'employee_lunch_coverage',notification_type:'message'},
 {kind:'employee_location_status',route:'messages.html'}, {kind:'employee_location_status',type:'event'},
 {kind:' employee_location_status'}, {kind:null}, {kind:'employee_location_status',route:'https://evil.invalid/employee-schedule.html'},
 {kind:'employee_location_status',route:'../messages.html'}, {kind:'employee_location_status',route:42}])await test('F09 malformed/deferred protocol '+JSON.stringify(bad),async()=>{
 assert.equal(custodialNotificationEnabled(bad),false);
 const f=await fixture();await f.emit('firebase','notificationReceived',{notification:{title:'Not enabled',body:'Do not display',data:{...data,...bad,kind:bad.kind}}});
 assert.equal(f.scheduled.length,0);assert.equal(f.effects.includes('dispatch'),false);
});
for(const kind of ['employee_lunch_coverage','employee_location_status'])await test('F09 exact enabled protocol '+kind,async()=>{
 const d={...data,kind,notification_type:kind.slice(9),route:'employee-schedule.html?hub=employee'};
 assert.equal(custodialNotificationEnabled(d),true);const f=await fixture();await f.emit('firebase','notificationReceived',{notification:{data:d}});assert.equal(f.scheduled.length,1);
});
await test('F06 old delayed HTTP poll cannot retire newer valid card/audio',async()=>{
 const f=await fixture({display:'denied',scheduleAuthorityFactory:createScheduleNotificationAuthority});await f.scheduleAuthority.observe(payload(90));
 let release,reached;const waiting=new Promise(r=>reached=r),hold=new Promise(r=>release=r);
 const reminder=revision=>({notification_key:'poll:'+revision,employee_id:principal.employee_id,service_date:day,projection_id:id(revision+1000),location_code:'FIXTURE',status_code:'due_soon'});
 const ui=f.fullBrowser({fetchRows:async call=>{if(call===1){reached();await hold;return[reminder(89)];}return[reminder(90)];}});
 const old=ui.poll();await waiting;await ui.poll();assert.equal(ui.active,true);const card=ui.card,stops=ui.audioStops,actions=ui.httpActions.length;
 release();await old;assert.equal(ui.card,card);assert.equal(ui.audioStops,stops);assert.equal(ui.httpActions.length,actions);
});
for(const reader of ['identity','principal','status property'])await test('F01 every protected reader failure quarantines '+reader,async()=>{
 let broken=false;
 const health=()=>broken&&reader==='status property'?Object.defineProperty({},'ready',{get(){throw Error('ready failure');}}):{ready:true,available:true,quarantined:false,generation:11,deviceId:principal.device_id,principal};
 const owner=createScheduleNotificationAuthority({identity:()=>{if(broken&&reader==='identity')throw Error('identity failure');return scope;},
  principal:()=>{if(broken&&reader==='principal')throw Error('principal failure');return principal;},
  status:health,storage:{getItem:()=>null},now:()=>fixtureTime,mutate:syntheticNotificationWriter(health)});
 await owner.observe(payload(90),scope);const late=owner.observe(payload(91),scope);broken=true;
 assert.equal(owner.isCurrent(event(90).notification.data,scope),false);broken=false;
 assert.equal(owner.isCurrent(event(90).notification.data,scope),false,'healthy getter alone must not recover');
 assert.equal(await late,false,'failure invalidates prior asynchronous preparation');
 owner.securityChanged(health());await owner.observe(payload(92),scope);
 assert.equal(owner.isCurrent(event(92).notification.data,scope),true);
});
await test('F03 midnight cannot relabel a prior-day row as next-day authority',async()=>{
 for(let switchAt=1;switchAt<=16;switchAt++){
  let calls=0,forceNext=false;const before=Date.parse('2026-09-29T04:59:59.999Z'),after=before+2;
  const owner=createScheduleNotificationAuthority({identity:()=>scope,principal:()=>principal,status:()=>({ready:true,available:true,quarantined:false,generation:11,deviceId:principal.device_id,principal}),storage:{getItem:()=>null},mutate:syntheticNotificationWriter(()=>({ready:true,available:true,quarantined:false,generation:11,deviceId:principal.device_id,principal})),
   now:()=>forceNext||++calls>=switchAt?after:before});
  const d={...payload(90),service_date:'2026-09-28',schedule_delivery_mode:'LEGACY_REGISTERED'};delete d.recurring_delivery;
  await owner.observe(d,scope).catch(()=>false);forceNext=true;
  assert.equal(owner.isCurrent({...event(90).notification.data,kind:'employee_location_status',service_date:'2026-09-29'},scope),false,'midnight cut '+switchAt);
 }
});
console.log(JSON.stringify({scope:'notification V1 changed-input F01/F03/F06/F09; actual source with synthetic OS/DOM; no physical proof',passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
