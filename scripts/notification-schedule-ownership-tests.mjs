import assert from 'node:assert/strict';
import {createPrincipalNotificationScheduler} from '../mobile/src/custodial/notification-schedule.js';
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const notification=key=>({title:'Exact '+key,body:'Exact body',extra:{kind:'employee_lunch_coverage',notification_key:key}});
function fixture({memory=new Map(),active=new Map()}={}){
 let scope='full-principal-A',tail=Promise.resolve(),calls=0,cancelFailure=false,scheduleFailure=false,
  writeFailure=false,afterInventory=()=>{},afterSchedule=()=>{};
 const cancelled=[];
 const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)??null,
  setItem:(k,v)=>{if(writeFailure)throw Error('journal unavailable');memory.set(k,v);},removeItem:k=>memory.delete(k)};
 const options={identity:()=>scope,storage,prefix:'owned:',mutate:fn=>{
  const result=tail.then(fn,fn);tail=result.catch(()=>{});return result;
 },plugin:{getPending:async()=>{afterInventory();return {notifications:[...active.values()]};},
  getDeliveredNotifications:async()=>({notifications:[{id:1,extra:{unrelated:true}}]}),
  cancel:async({notifications})=>{if(cancelFailure)throw Error('cancel unavailable');for(const n of notifications){cancelled.push(n.id);active.delete(n.id);}},
  schedule:async({notifications})=>{calls++;for(const n of notifications)active.set(n.id,structuredClone(n));afterSchedule();if(scheduleFailure)throw Error('uncertain schedule');}
 }};
 let scheduler=createPrincipalNotificationScheduler(options);
 return {memory,active,cancelled,get calls(){return calls;},get scheduler(){return scheduler;},scope:s=>{scope=s;},
  restart:()=>{scheduler=createPrincipalNotificationScheduler(options);},
  failCancel:v=>{cancelFailure=v;},failSchedule:v=>{scheduleFailure=v;},failWrite:v=>{writeFailure=v;},
  afterInventory:fn=>{afterInventory=fn;},afterSchedule:fn=>{afterSchedule=fn;}};
}
const f=fixture();
check(await f.scheduler.present(notification('one'),'full-principal-A'),true,'valid schedule');
const first=[...f.active.values()][0];check(first.id,2,'unrelated pending/delivered ID is avoided');
check(f.scheduler.ownsAction(first),true,'exact scheduled owner action');
check(f.scheduler.ownsAction({...first,extra:{...first.extra,notification_key:'forged'}}),false,'different payload rejected');
check(f.scheduler.ownsAction({...first,extra:{...first.extra,native_presentation_principal:undefined}}),false,'unscoped callback rejected');
f.restart();await f.scheduler.reconcile();
check(f.active.size,1,'same-principal restart retains exact completed schedule');
check(f.scheduler.ownsAction(first),true,'same-principal cold action remains usable');
f.active.clear();f.restart();await f.scheduler.reconcile();
check(f.scheduler.ownsAction(first),true,'Android removes OS notification before cold-start action; exact confirmed callback still works');
check(await f.scheduler.present(notification('one'),'full-principal-A'),true,'same accepted payload restart recovers ownership');
check(f.calls,1,'already scheduled payload not re-dispatched');
f.scope('full-principal-B');f.restart();await f.scheduler.reconcile();
check(f.active.size,0,'foreign completed schedule cancelled at restart');
check(f.scheduler.ownsAction(first),false,'old complete binding cannot act under B');
check(JSON.parse(f.memory.get('owned:2')).state,'cancelled','history retained');
await f.scheduler.present(notification('one'),'full-principal-B');
check([...f.active.keys()],[3],'retained old ID cannot cancel successor');
check(f.scheduler.ownsAction([...f.active.values()][0]),true,'new owner can act');
await f.scheduler.reconcile();check([...f.active.keys()],[3],'repeat cleanup leaves current owner intact');

const before=fixture();before.afterInventory(()=>before.scope('full-principal-B'));
check(await before.scheduler.present(notification('before'),'full-principal-A'),false,'principal transition before dispatch');
check(before.calls,0,'no stale dispatch');check(before.memory.size,0,'no invented intent');
const during=fixture();during.afterSchedule(()=>during.scope('full-principal-B'));
check(await during.scheduler.present(notification('during'),'full-principal-A'),false,'transition at completion does not claim success');
check(during.active.size,0,'exact compensating cancellation');
check(JSON.parse([...during.memory.values()][0]).state,'cancelled','cancel completion durable');

const uncertain=fixture();uncertain.failSchedule(true);uncertain.failCancel(true);
await assert.rejects(()=>uncertain.scheduler.present(notification('uncertain'),'full-principal-A'),/cancel unavailable/);checks++;
check(uncertain.active.size,1,'uncertain external effect is not fabricated away');
check(JSON.parse([...uncertain.memory.values()][0]).state,'intent','uncertain intent retained for restart');
check(uncertain.scheduler.ownsAction([...uncertain.active.values()][0]),false,'uncertain schedule cannot authorize action');
uncertain.restart();await assert.rejects(()=>uncertain.scheduler.reconcile(),/cancel unavailable/);checks++;
check(JSON.parse([...uncertain.memory.values()][0]).state,'intent','failed cleanup cannot retire ownership');
uncertain.failCancel(false);uncertain.failSchedule(false);await uncertain.scheduler.reconcile();
check(uncertain.active.size,0,'restart cleanup removes exact uncertain schedule');
await uncertain.scheduler.present(notification('uncertain'),'full-principal-A');
check([...uncertain.active.keys()],[3],'retry uses a separately owned ID');

const failedWrite=fixture();failedWrite.failWrite(true);
await assert.rejects(()=>failedWrite.scheduler.present(notification('no-store'),'full-principal-A'),/journal unavailable/);checks++;
check(failedWrite.calls,0,'no OS dispatch before durable intent');
const collision=fixture();
check(await Promise.all(['one','two','three'].map(k=>collision.scheduler.present(notification(k),'full-principal-A'))),[true,true,true],'serialized concurrent schedules');
check([...collision.active.keys()],[2,3,4],'unique owned IDs across concurrent operations');
check(collision.cancelled,[],'no cancellation of another current notification');
await collision.scheduler.present({...notification('one'),body:'Different exact content'},'full-principal-A');
check(collision.active.size,4,'different content never adopts earlier display proof');

console.log(JSON.stringify({ok:true,checks,scope:'actual scheduler source; serialized storage and synthetic OS; restart, failure, ID and action ownership',physical:false}));
