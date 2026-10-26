import assert from 'node:assert/strict';
import {createScheduleNotificationAuthority} from '../mobile/src/custodial/notification-schedule-authority.js';
import {principalIdentity} from '../mobile/src/custodial/protected-principal.js';
import {fixture,principal} from './native-notification-arrival-boundary-tests.mjs';
import {payload,day,id} from './notification-schedule-cache-authority-tests.mjs';
const results=[];
const healthy={ready:true,available:true,quarantined:false};
const second={...principal,employee_id:id(201),credential_id:id(202),assignment_epoch:8};
const identity=name=>({msg_user_id:'user-'+name,display_name:name+' Employee',role:'custodian'});
function schedule(p,revision){const value={...payload(revision),employee_id:p.employee_id,credential_id:p.credential_id,
 assignment_epoch:p.assignment_epoch,schedule_delivery_mode:'LEGACY_REGISTERED'};delete value.recurring_delivery;return value;}
async function test(name,fn){try{await fn();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.stack});}}
for(const oldFails of [false,true])await test('F06-R1 P1 held / P2 current / P1 late / P2 next; rejected='+oldFails,async()=>{
 const f=await fixture({display:'denied',scheduleAuthorityFactory:createScheduleNotificationAuthority});
 await f.scheduleAuthority.observe(schedule(principal,90),principalIdentity(principal));
 let release,reached;const hold=new Promise(r=>release=r),waiting=new Promise(r=>reached=r);
 const ui=f.fullBrowser({fetchIdentity:async call=>{if(call===1){reached();await hold;if(oldFails)throw Error('old request failed');return identity('Old');}return identity('New');},
  fetchRows:async call=>[{notification_key:'p2-location-'+call,employee_id:second.employee_id,employee_name:'New Employee',service_date:day,
   projection_id:id(1091),location_code:'P2 Room',status_code:'due_soon'}]});
 const old=ui.poll();await waiting;
 f.setPrincipal(second);f.emitSecurity(healthy);
 await f.scheduleAuthority.observe(schedule(second,91),principalIdentity(second));
 await ui.poll();assert.equal(ui.identityFetches,2);assert.equal(ui.state.currentDisplayName,'New Employee');
 assert.equal(ui.state.activeAlert.speakerName,'New Employee');
 release();await old;
 assert.equal(ui.state.currentUserId,'user-New','late old identity cannot overwrite current user');
 assert.equal(ui.state.currentDisplayName,'New Employee');
 await ui.finishTimers();await ui.card.querySelector('.mz-reminder-dismiss').listeners.click();await ui.finishTimers();
 await ui.poll();assert.equal(ui.state.activeAlert.speakerName,'New Employee');
 assert.match(ui.state.activeAlert.speechText,/Hey New,/);assert.equal(ui.identityFetches,2);
});
await test('F06-R1 populated identity cleared and rebound after security transition',async()=>{
 const f=await fixture({display:'denied',scheduleAuthorityFactory:createScheduleNotificationAuthority});
 const ui=f.fullBrowser({fetchIdentity:async call=>identity(call===1?'Old':'New')});
 await ui.poll();assert.equal(ui.state.currentDisplayName,'Old Employee');
 f.setPrincipal(second);assert.equal(ui.state.currentUserId,'');assert.equal(ui.state.currentDisplayName,'');assert.equal(ui.state.currentRole,'');
 f.emitSecurity(healthy);await f.scheduleAuthority.observe(schedule(second,92),principalIdentity(second));
 await ui.poll();assert.equal(ui.state.currentDisplayName,'New Employee');assert.equal(ui.identityFetches,2);
});
await test('F06-R1 superseded poll in SAME principal cannot commit identity',async()=>{
 const f=await fixture({display:'denied',scheduleAuthorityFactory:createScheduleNotificationAuthority});
 let release,reached;const hold=new Promise(r=>release=r),waiting=new Promise(r=>reached=r);
 const ui=f.fullBrowser({fetchIdentity:async call=>{if(call===1){reached();await hold;return identity('Old');}return identity('New');}});
 const old=ui.poll();await waiting;await ui.poll();release();await old;
 assert.equal(ui.state.currentDisplayName,'New Employee');
});
await test('F06-R1 delayed debug identity cannot mutate or display after protected transition',async()=>{
 const f=await fixture({display:'denied',scheduleAuthorityFactory:createScheduleNotificationAuthority});
 let release,reached;const hold=new Promise(r=>release=r),waiting=new Promise(r=>reached=r);
 const ui=f.fullBrowser({debugReminder:true,fetchIdentity:async call=>{if(call===1){reached();await hold;return identity('Old');}return identity('New');}});
 const debug=ui.runTimer(900);await waiting;f.setPrincipal(second);f.emitSecurity(healthy);await ui.poll();
 assert.equal(ui.state.currentDisplayName,'New Employee');release();await debug;
 assert.equal(ui.state.currentDisplayName,'New Employee');assert.equal(ui.active,false,'stale debug card not presented');
});
console.log(JSON.stringify({scope:'F06-R1 actual reminder + registered bridge + real schedule authority; synthetic DOM/transport/audio only',passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
