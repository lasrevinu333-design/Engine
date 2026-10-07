import assert from 'node:assert/strict';
import {createPrincipalNotificationScheduler} from '../mobile/src/custodial/notification-schedule.js';

// This tests the actual OS-side-effect owner with a synthetic authority reader
// and OS. It does NOT claim the bridge/native provider has mounted that reader.
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
function fixture(){
 const memory=new Map(),pending=new Map(),delivered=new Map(),authority=new Map();
 let scope='principal-A',tail=Promise.resolve(),afterInventory=()=>{},afterSchedule=()=>{},cancelFailure=false,readFailure=false,calls=0;
 const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)??null,
  setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const options={identity:()=>scope,storage,prefix:'owned:',mutate:fn=>{
  const result=tail.then(fn,fn);tail=result.catch(()=>{});return result;
 },isCurrent:(n,s)=>{
  if(readFailure)throw Error('authority unavailable');
  if(n.extra.kind==='employee_message')return true;
  const current=authority.get(JSON.stringify([s,n.extra.service_date]));
  return current?.blocked===false&&current.revision===n.extra.revision;
 },plugin:{getPending:async()=>{afterInventory();return {notifications:[...pending.values()]};},
  getDeliveredNotifications:async()=>({notifications:[...delivered.values()]}),
  cancel:async({notifications})=>{if(cancelFailure)throw Error('cancel uncertain');for(const n of notifications)pending.delete(n.id);},
  removeDeliveredNotifications:async({notifications})=>{for(const n of notifications)delivered.delete(n.id);},
  schedule:async({notifications})=>{calls++;for(const n of notifications)pending.set(n.id,structuredClone(n));afterSchedule();}
 }};
 let scheduler=createPrincipalNotificationScheduler(options);
 const set=(date,revision,blocked=false)=>authority.set(JSON.stringify([scope,date]),{revision,blocked});
 return {pending,delivered,memory,set,get scheduler(){return scheduler;},get calls(){return calls;},
  restart:()=>{scheduler=createPrincipalNotificationScheduler(options);},scope:v=>{scope=v;},
  afterInventory:fn=>{afterInventory=fn;},afterSchedule:fn=>{afterSchedule=fn;},
  failCancel:v=>{cancelFailure=v;},failRead:v=>{readFailure=v;}};
}
const date='2026-09-28',next='2026-09-29';
const notice=(revision,day=date,kind='employee_lunch_coverage')=>({title:'Synthetic notice',body:'Synthetic body',
 extra:{kind,notification_key:`${kind}:${day}:${revision}`,service_date:day,revision}});

{
 const f=fixture();f.set(date,41);await f.scheduler.present(notice(41),'principal-A');const old=[...f.pending.values()][0];
 f.set(date,42,true);
 check(f.scheduler.ownsAction(old),false,'terminal closes old action BEFORE asynchronous OS cleanup');
 await f.scheduler.reconcile();check(f.pending.size,0,'terminal cancels exact old OS effect');
 check(await f.scheduler.present(notice(41),'principal-A'),false,'late old arrival cannot redisplay');
 check(f.calls,1,'no late dispatch');check(JSON.parse(f.memory.get('owned:'+old.id)).state,'cancelled','history retained');
 f.set(date,43);check(await f.scheduler.present(notice(43),'principal-A'),true,'explicit replacement can display');
 check(f.scheduler.ownsAction([...f.pending.values()][0]),true,'exact replacement action');
 check(f.scheduler.ownsAction(old),false,'replacement cannot resurrect old action');
}
{
 const f=fixture();f.set(date,1);f.set(next,1);
 await f.scheduler.present(notice(1),'principal-A');await f.scheduler.present(notice(1,next),'principal-A');
 await f.scheduler.present(notice(1,date,'employee_message'),'principal-A');
 const old=[...f.pending.values()].find(n=>n.extra.kind==='employee_lunch_coverage'&&n.extra.service_date===date);
 f.pending.delete(old.id);f.delivered.set(old.id,old);f.set(date,2,true);f.restart();await f.scheduler.reconcile();
 check(f.delivered.size,0,'restart removes stale delivered item as well as pending');
 check(f.pending.size,2,'other date and unrelated message preserved');
 check([...f.pending.values()].every(n=>f.scheduler.ownsAction(n)),true,'unaffected actions remain usable');
}
{
 const f=fixture();f.set(date,1);f.afterInventory(()=>f.set(date,2,true));
 check(await f.scheduler.present(notice(1),'principal-A'),false,'authority changed during ID inventory');
 check(f.calls,0,'no stale schedule after inventory');
}
{
 const f=fixture();f.set(date,1);f.afterSchedule(()=>f.set(date,2,true));
 check(await f.scheduler.present(notice(1),'principal-A'),false,'authority changed during OS scheduling');
 check(f.pending.size,0,'compensating exact cancellation');
 check(JSON.parse(f.memory.get('owned:1')).state,'cancelled','no stale confirmed owner');
}
{
 const f=fixture();f.set(date,1);await f.scheduler.present(notice(1),'principal-A');const old=[...f.pending.values()][0];
 f.set(date,2,true);f.failCancel(true);
 await assert.rejects(()=>f.scheduler.reconcile(),/cancel uncertain/);checks++;
 check(f.scheduler.ownsAction(old),false,'failed cancellation cannot reauthorize old action');
 check(f.memory.has('owned:unconfirmed:'+old.id),true,'uncertainty guard retained');
 f.restart();check(f.scheduler.ownsAction(old),false,'restart remains fenced');
 f.failCancel(false);await f.scheduler.reconcile();check(f.pending.size,0,'bounded retry cleans exact pending effect');
}
{
 const f=fixture();f.set(date,1);await f.scheduler.present(notice(1),'principal-A');const old=[...f.pending.values()][0];
 f.failRead(true);
 assert.throws(()=>f.scheduler.ownsAction(old),/authority unavailable/);checks++;
 await assert.rejects(()=>f.scheduler.reconcile(),/authority unavailable/);checks++;
 check(f.pending.size,1,'unavailable reader is not fabricated successful cleanup');
 f.failRead(false);check(f.scheduler.ownsAction(old),true,'same authority recovery preserves legitimate action');
}
{
 const f=fixture();f.set(date,1);await f.scheduler.present(notice(1),'principal-A');
 f.set(date,2);check(await f.scheduler.present(notice(1),'principal-A'),false,'old duplicate cannot adopt old scheduled success');
 check(f.pending.size,0,'old confirmed record retired before duplicate shortcut');
 check(await f.scheduler.present(notice(2),'principal-A'),true,'new same-day authority is independently owned');
}
console.log(JSON.stringify({ok:true,checks,scope:'actual notification scheduler; synthetic authority reader and OS; NOT mounted runtime/physical proof'}));
