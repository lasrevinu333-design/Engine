import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as receipts from '../mobile/src/custodial/notification-receipts.js';
import {protectedPrincipal} from '../mobile/src/custodial/protected-principal.js';
import {createNotificationPresentationMode} from '../mobile/src/custodial/notification-mode.js';
import {createNotificationPresenter} from '../mobile/src/custodial/notification-presentation.js';

const deviceId='KIOSK_08';
const data={kind:'employee_lunch_coverage',notification_key:'lunch:synthetic:start',
  receipt_job_id:'00000000-0000-4000-8000-000000000001',receipt_credential_id:'00000000-0000-4000-8000-000000000002',
  receipt_employee_id:'00000000-0000-4000-8000-000000000003',receipt_assignment_epoch:'7',receipt_device_id:deviceId};
let checks=0;
for(const persist of [async()=>false,async()=>undefined,async()=>{throw new Error('protected storage unavailable');}]){
  const effects=[];
  try{await receipts.receiveNativeNotification({event:{notification:{data}},persist,
    dispatch:()=>effects.push('dispatch'),present:async()=>effects.push('present'),shouldPresent:true,
    flush:async()=>effects.push('flush')});}catch(error){assert.match(error.message,/protected storage unavailable/);}
  assert.deepEqual(effects,[],'rejected or unavailable protected arrival must not dispatch, flush or present');checks++;
}
const principal={schema_version:'custodial-protected-principal.v1',device_id:deviceId,
  employee_id:data.receipt_employee_id,credential_id:data.receipt_credential_id,assignment_epoch:7,
  credential_operation_id:'00000000-0000-4000-8000-000000000004',
  installation_seal:'fixture-installation-seal-0001',enrolled_at:'2026-07-01T12:00:00.000Z'};
const bridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
const begin=bridge.indexOf('  function notificationChannel('),end=bridge.indexOf('  const feedbackOutbox=',begin);
assert.ok(begin>=0&&end>begin);
const modeBegin=bridge.indexOf('  const notificationPresentation ='),modeEnd=bridge.indexOf('  const { credentialStore',modeBegin);
const publishedBegin=bridge.indexOf('  window.MemphisMobile = Object.freeze({'),publishedEnd=bridge.indexOf('\n  });',publishedBegin)+6;
assert.ok(modeBegin>=0&&modeEnd>modeBegin&&publishedBegin>=0&&publishedEnd>publishedBegin);
const published=bridge.slice(publishedBegin,publishedEnd);
const reminderSource=readFileSync(new URL('../memphis-device-reminders.js',import.meta.url),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fullBrowserFixture(context, { rows = [], fetchWait = null } = {}) {
  let card=null,fetches=0;
  const cards=[],session=new Map(),noop=()=>{};
  function element(){const children=new Map();return {textContent:'',attributes:{},classList:{toggle:noop},setAttribute(k,v){this.attributes[k]=v;},
    querySelector:key=>{if(!children.has(key))children.set(key,{listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}});return children.get(key);},
    remove(){if(card===this)card=null;}};}
  context.document.readyState='complete';context.document.getElementById=()=>null;
  context.document.querySelector=selector=>selector==='.mz-reminder-backdrop'?card:null;
  context.document.createElement=element;context.document.head={appendChild:noop};
  context.document.body={dataset:{memphisContext:'employee'},classList:{toggle:noop},appendChild:node=>{card=node;cards.push(node);}};
  context.window.location={href:'https://localhost/employee-schedule.html?hub=employee&device=KIOSK_08'};
  context.window.MemphisCustodialSecurity={native:true,getStatus:()=>({ready:true,available:true,deviceId})};
  context.sessionStorage={getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)};
  Object.assign(context,{URL,Uint8Array,DataView,Float32Array,encodeURIComponent,
    navigator:{vibrate:noop},Audio:class{load(){}play(){return Promise.resolve();}pause(){}},
    setTimeout:()=>1,setInterval:()=>1,clearTimeout:noop,
    btoa:value=>Buffer.from(value,'binary').toString('base64'),fetch:async url=>{
      let payload={};
      if(url.includes('/me/by-device'))payload={msg_user_id:'synthetic',display_name:'Synthetic Custodian'};
      else if(url.includes('/device-location-status-reminders')){fetches++;if(fetchWait)await fetchWait;payload=rows;}
      else if(url.includes('/threads'))payload=[];
      return {ok:true,json:async()=>({ok:true,data:payload})};
    }});
  context.window.setTimeout=context.setTimeout;context.window.setInterval=context.setInterval;
  context.window.clearTimeout=noop;context.window.speechSynthesis={cancel:noop};
  vm.runInContext(reminderSource,context,{filename:'actual-full-memphis-device-reminders.js'});
  return {poll:()=>context.window.MemphisDeviceReminders.poll(),cards,get active(){return card!==null;},get presented(){return cards.length;},get fetches(){return fetches;}};
}
async function fixture({memory=new Map(),offline=true,capable=true,platform='android',receive='granted',display='granted',
  supported=true,actionFailure=false,listenerFailure=false,channelFailure=false,registrationFailure=false,permissionWait=null,initialize=true}={}){
  const native=new Map(),local=new Map(),network=new Map(),windowEvents=new Map(),effects=[],requests=[],scheduled=[],actionTypes=[],modes=[];
  let active=principal,failStorage=false,readbackLost=false,mutationHook=()=>{},presentFailure=false,displayWriteFailure=false;
  let registrationWait=null,scheduleWait=null,registerCalls=0,permissionRequests=0,localChecks=0;
  const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(failStorage)throw Error('synthetic write failure');
    if(displayWriteFailure&&JSON.parse(v).action==='displayed'){displayWriteFailure=false;throw Error('synthetic display receipt write failure');}
    if(!readbackLost)memory.set(k,v);},
    removeItem:k=>memory.delete(k),key:i=>[...memory.keys()][i],get length(){return memory.size;}};
  const context={...receipts,console,createNotificationPresentationMode,createNotificationPresenter,localStorage:storage,NATIVE_NOTIFICATION_OUTBOX_PREFIX:'receipt:',JSON,Date,Number,Math,
    Capacitor:{getPlatform:()=>platform,isPluginAvailable:()=>capable},
    nativeVault:true,bridgeReady:Promise.resolve(),feedbackOutbox:{save(){},flush(){}},profileMatchesPrincipal:()=>true,
    currentPrincipal:()=>protectedPrincipal(active),deviceId:()=>deviceId,
    security:{getStatus:()=>({}),mutateProtectedWork:async operation=>{mutationHook();return operation();}},
    safeNativeRoute:route=>route==='employee-schedule.html'?route:'',
    location:{assign:route=>effects.push(`route:${route}`)},
    CustomEvent:class{constructor(name,options){this.name=name;this.detail=options.detail;}},
    window:{dispatchEvent:event=>{if(event.name==='memphis:native-notification-received')effects.push('dispatch');else modes.push(event.detail);windowEvents.get(event.name)?.(event);},addEventListener:(name,fn)=>windowEvents.set(name,fn)},
    document:{addEventListener:(name,fn)=>windowEvents.set(name,fn),hidden:false},
    requestEnvelope:async(path,options)=>{
      if(path==='/employee-notifications-api/register'){registerCalls++;if(registrationWait)await registrationWait;if(registrationFailure)throw Error('registration unavailable');return {ok:true};}
      requests.push({path,...structuredClone(options)});if(offline)throw Error('synthetic offline');
    },
    LocalNotifications:{registerActionTypes:async types=>{if(actionFailure)throw Error('actions unavailable');actionTypes.push(structuredClone(types));},
      addListener:async(name,fn)=>{if(listenerFailure)throw Error('listener unavailable');local.set(name,fn);},
      checkPermissions:async()=>{localChecks++;if(permissionWait)await permissionWait;return {display};},requestPermissions:async()=>{permissionRequests++;display='granted';return {display};},
      schedule:async payload=>{
        assert.ok([...memory.values()].some(v=>JSON.parse(v).action==='received'),'actual schedule cannot present before durable received');
        if(scheduleWait)await scheduleWait;
        effects.push('present');if(presentFailure)throw Error('presentation failed');scheduled.push(structuredClone(payload));
      }},
    FirebaseMessaging:{addListener:async(name,fn)=>native.set(name,fn),isSupported:async()=>({isSupported:supported}),
      createChannel:async()=>{if(channelFailure)throw Error('channel unavailable');},checkPermissions:async()=>({receive}),
      requestPermissions:async()=>{receive='granted';return {receive};},getToken:async()=>({token:'synthetic-not-a-real-token'})},
    Network:{addListener:async(name,fn)=>network.set(name,fn)},App:{addListener:async()=>{}},
  };
  // Execute the complete published object verbatim. Stub only unrelated API
  // functions, not the source-owned mode, permissions or notification producer.
  for(const [,name] of published.matchAll(/^    (\w+),$/gm))if(!(name in context))context[name]=()=>{};
  context.currentPrincipalIdentity=()=>'';
  vm.createContext(context);vm.runInContext(bridge.slice(modeBegin,modeEnd)+bridge.slice(begin,end)+published,context);
  assert.equal(context.window.MemphisMobile.nativeNotifications,false,'exact published startup defaults to browser fallback');
  await context.installNotificationRouting();
  const registration=context.window.MemphisMobile.ensurePushRegistration();
  if(initialize)await registration;
  return {memory,effects,requests,scheduled,actionTypes,modes,mobile:context.window.MemphisMobile,registration,
    get permissionRequests(){return permissionRequests;},get registerCalls(){return registerCalls;},get localChecks(){return localChecks;},
    holdRegistration:wait=>{registrationWait=wait;},
    holdSchedule:wait=>{scheduleWait=wait;},fullBrowser:options=>fullBrowserFixture(context,options),
    failNextDisplayed:()=>{displayWriteFailure=true;},
    setDisplay:p=>{display=p;},setPrincipal:p=>{active=p;},fail:()=>{failStorage=true;},loseReadback:()=>{readbackLost=true;},
    changeAtMutation:p=>{mutationHook=()=>{active=p;};},failPresentation:()=>{presentFailure=true;},
    async emit(source,name,value){(source==='firebase'?native:local).get(name)(value);await turn();await turn();},
    async reconnect(){windowEvents.get('online')();await turn();await turn();}};
}
const mutations=[
  d=>{d.receipt_device_id='KIOSK_03';},d=>{d.receipt_credential_id='00000000-0000-4000-8000-000000000009';},
  d=>{d.receipt_employee_id='00000000-0000-4000-8000-000000000009';},d=>{d.receipt_assignment_epoch='8';},
  d=>{d.receipt_assignment_epoch='1.5';},d=>{d.receipt_job_id='not-a-job';},d=>{d.kind='unknown';},
];
// Actual public entry point must preserve stronger permission intent while the
// initial passive refresh is awaiting the OS. No unrelated third call allowed.
let permitStartup;
const stronger=await fixture({display:'prompt',permissionWait:new Promise(resolve=>{permitStartup=resolve;}),initialize:false});
const explicitPermission=stronger.mobile.ensurePushRegistration({requestPermission:true});
permitStartup();await Promise.all([stronger.registration,explicitPermission]);
assert.equal(stronger.permissionRequests,1,'concurrent explicit permission request must not be swallowed');
assert.equal(stronger.mobile.nativeNotifications,true);checks+=2;
const newer=await fixture();let permitRegistration;
newer.holdRegistration(new Promise(resolve=>{permitRegistration=resolve;}));
const oldRefresh=newer.mobile.ensurePushRegistration();await turn();
const callsBefore=newer.registerCalls,checksBefore=newer.localChecks;
newer.setDisplay('denied');await newer.reconnect();permitRegistration();await oldRefresh;
assert.ok(newer.registerCalls>callsBefore,'new lifecycle event forces a follow-up pass');
assert.ok(newer.localChecks>checksBefore);
assert.equal(newer.mobile.nativeNotifications,false,'older registration cannot commit stale granted readiness');checks+=3;
const lunchFallback=await fixture({display:'denied'}),lunchBrowser=lunchFallback.fullBrowser();
await lunchFallback.emit('firebase','notificationReceived',{notification:{title:'Lunch coverage',body:'Cover this area',data}});
await lunchBrowser.poll();
assert.equal(lunchBrowser.cards.length,1,'accepted lunch must use actual fallback even when both legitimate poll sources are empty');
assert.equal(lunchFallback.scheduled.length,0);checks+=2;
await lunchBrowser.cards[0].querySelector('.mz-reminder-dismiss').listeners.click();
assert.equal(lunchBrowser.active,false);
assert.deepEqual([...lunchFallback.memory.values()].map(JSON.parse).filter(row=>row.schema_version===receipts.NATIVE_NOTIFICATION_RECEIPT_SCHEMA).map(row=>row.action).sort(),['displayed','received'],
  'actual browser visual dismissal must not fabricate native dismissed or acknowledged');checks+=2;
for(const kind of ['employee_lunch_coverage','employee_location_status']){
  const d={...data,kind,notification_key:`synthetic:${kind}:race`};
  let allowPermission,allowFetch;
  const f=await fixture({permissionWait:new Promise(resolve=>{allowPermission=resolve;}),initialize:false});
  const browser=f.fullBrowser({rows:[{notification_key:d.notification_key,location_code:'SYNTHETIC',status_code:'due_soon'}],
    fetchWait:new Promise(resolve=>{allowFetch=resolve;})});
  const poll=browser.poll();await turn();
  await f.emit('firebase','notificationReceived',{notification:{title:kind,body:'Synthetic coverage',data:d}});
  allowPermission();await f.registration;allowFetch();await poll;await turn();
  assert.equal(f.mobile.nativeNotifications,true);
  assert.equal(browser.cards.length+f.scheduled.length,1,'browser-to-native handoff must neither lose nor duplicate accepted key');
  assert.equal(browser.cards[0].attributes['data-notification-key'],d.notification_key);
  await f.emit('firebase','notificationReceived',{notification:{title:kind,data:d}});
  assert.equal(browser.cards.length+f.scheduled.length,1,'duplicate arrival cannot create another presenter');checks+=4;

  const g=await fixture();let allowSchedule;
  g.holdSchedule(new Promise(resolve=>{allowSchedule=resolve;}));
  const fallback=g.fullBrowser({rows:[{notification_key:d.notification_key,location_code:'SYNTHETIC',status_code:'due_soon'}]});
  await g.emit('firebase','notificationReceived',{notification:{title:kind,body:'Synthetic coverage',data:d}});
  g.setDisplay('denied');await g.reconnect();await g.mobile.ensurePushRegistration();await fallback.poll();
  assert.equal(fallback.cards.length,0,'browser cannot acquire key while native scheduling is unresolved');
  allowSchedule();await turn();await turn();await fallback.poll();
  assert.equal(g.mobile.nativeNotifications,false);
  assert.equal(fallback.cards.length+g.scheduled.length,1,'native-to-browser handoff must complete exactly one presenter');
  assert.equal(g.scheduled[0].notifications[0].extra.notification_key,d.notification_key);checks+=4;
}
const pendingRestart=await fixture({display:'denied'});
await pendingRestart.emit('firebase','notificationReceived',{notification:{title:'Saved lunch',data}});
assert.ok([...pendingRestart.memory.values()].map(JSON.parse).some(row=>row.schema_version==='native-notification-presentation.v1'&&row.owner===null));
const restored=await fixture({display:'denied',memory:pendingRestart.memory});
const restoredBrowser=restored.fullBrowser();await restoredBrowser.poll();
assert.equal(restoredBrowser.cards.length,1,'pending accepted payload survives restart without relying on location or thread rows');
assert.equal(restoredBrowser.cards[0].attributes['data-notification-key'],data.notification_key);checks+=3;
const tokenRefresh=await fixture();let allowTokenRegistration;
tokenRefresh.holdRegistration(new Promise(resolve=>{allowTokenRegistration=resolve;}));
const firstTokenRefresh=tokenRefresh.mobile.ensurePushRegistration();await turn();
const tokenCalls=tokenRefresh.registerCalls;
await tokenRefresh.emit('firebase','tokenReceived',{token:'new-synthetic-token'});
allowTokenRegistration();await firstTokenRefresh;
assert.ok(tokenRefresh.registerCalls>tokenCalls,'token event cannot be swallowed by older registration');checks++;
const silentRevoke=await fixture();let allowSilentRegistration;
silentRevoke.holdRegistration(new Promise(resolve=>{allowSilentRegistration=resolve;}));
const silentFlight=silentRevoke.mobile.ensurePushRegistration();await turn();silentRevoke.setDisplay('denied');
allowSilentRegistration();await silentFlight;
assert.equal(silentRevoke.mobile.nativeNotifications,false,'post-registration permissions are reread even without another lifecycle event');checks++;
const receiptRetry=await fixture();receiptRetry.failNextDisplayed();
await receiptRetry.emit('firebase','notificationReceived',{notification:{data}});
assert.equal(receiptRetry.scheduled.length,1);
await receiptRetry.mobile.retryNotificationPresentation();
assert.equal(receiptRetry.scheduled.length,1,'failed displayed receipt retries receipt only, never a completed presenter');
assert.ok([...receiptRetry.memory.values()].map(JSON.parse).some(row=>row.action==='displayed'));checks+=3;
for(const change of mutations){
  const f=await fixture(),bad=structuredClone(data);change(bad);
  await f.emit('firebase','notificationReceived',{notification:{data:bad}});
  assert.deepEqual(f.effects,[]);assert.equal(f.memory.size,0);assert.equal(f.requests.length,0);checks++;
}
for(const setup of [f=>f.fail(),f=>f.loseReadback(),f=>f.setPrincipal(null),
  f=>f.changeAtMutation({...principal,assignment_epoch:8})]){
  const f=await fixture();setup(f);await f.emit('firebase','notificationReceived',{notification:{data}});
  assert.deepEqual(f.effects,[]);assert.equal(f.memory.size,0);assert.equal(f.requests.length,0);checks++;
}
const arrival=await fixture();await arrival.emit('firebase','notificationReceived',{notification:{data}});
assert.deepEqual(arrival.effects,['dispatch','present']);
assert.deepEqual([...arrival.memory.values()].map(v=>JSON.parse(v)).filter(v=>v.schema_version===receipts.NATIVE_NOTIFICATION_RECEIPT_SCHEMA).map(v=>v.action).sort(),['displayed','received']);checks++;
assert.equal(arrival.mobile.nativeNotifications,true);
assert.equal(Object.isFrozen(arrival.mobile),true);
assert.throws(()=>{arrival.mobile.nativeNotifications=false;},TypeError);
assert.equal(arrival.mobile.notificationPresentation.mode,'native');checks++;
const nativeBrowser=arrival.fullBrowser();await nativeBrowser.poll();
assert.equal(nativeBrowser.presented,0);assert.equal(nativeBrowser.fetches,0);
assert.equal(arrival.scheduled.length,1,'one exact selected display path');checks++;
const actualNotification=arrival.scheduled[0].notifications[0];
const actualAction=arrival.actionTypes.flatMap(value=>value.types).find(value=>value.id===actualNotification.actionTypeId).actions[0];
assert.equal(actualAction.id,'acknowledge');
await arrival.emit('local','localNotificationActionPerformed',{actionId:actualAction.id,notification:actualNotification});
assert.deepEqual([...arrival.memory.values()].map(v=>JSON.parse(v)).filter(v=>v.schema_version===receipts.NATIVE_NOTIFICATION_RECEIPT_SCHEMA).map(v=>v.action).sort(),['acknowledged','displayed','received']);checks++;
const failedDisplay=await fixture();failedDisplay.failPresentation();
await failedDisplay.emit('firebase','notificationReceived',{notification:{data}});
assert.deepEqual([...failedDisplay.memory.values()].map(v=>JSON.parse(v)).filter(v=>v.schema_version===receipts.NATIVE_NOTIFICATION_RECEIPT_SCHEMA).map(v=>v.action),['received']);checks++;
assert.equal(failedDisplay.mobile.nativeNotifications,false,'schedule failure restores fallback without fabricated displayed receipt');checks++;
for(const unavailable of [{capable:false},{platform:'web'},{supported:false},{display:'denied'},{display:'prompt'},
  {receive:'denied'},{receive:'prompt'},{actionFailure:true},{listenerFailure:true},{channelFailure:true},{registrationFailure:true}]){
  const f=await fixture(unavailable);
  assert.equal(f.mobile.nativeNotifications,false,JSON.stringify(unavailable));
  await f.emit('firebase','notificationReceived',{notification:{data}});
  assert.equal(f.scheduled.length,0);assert.deepEqual(f.effects,['dispatch']);
  assert.deepEqual([...f.memory.values()].map(v=>JSON.parse(v)).filter(v=>v.schema_version===receipts.NATIVE_NOTIFICATION_RECEIPT_SCHEMA).map(v=>v.action),['received']);
  const browser=f.fullBrowser();await browser.poll();assert.equal(browser.presented,1,'one actual browser presentation while native unavailable');checks++;
}
let releasePermission;
const unresolved=await fixture({permissionWait:new Promise(resolve=>{releasePermission=resolve;}),initialize:false});
assert.equal(unresolved.mobile.nativeNotifications,false);checks++;
const startupBrowser=unresolved.fullBrowser({rows:[{notification_key:data.notification_key,location_code:'SYNTHETIC',status_code:'due_soon'}]});
await startupBrowser.poll();assert.equal(startupBrowser.active,true);checks++;
await unresolved.emit('firebase','notificationReceived',{notification:{data}});
assert.equal(unresolved.scheduled.length,0);checks++;
releasePermission();await unresolved.registration;
assert.equal(unresolved.mobile.nativeNotifications,true);checks++;
assert.equal(startupBrowser.active,true,'capability change cannot discard a card without exact-key native success');checks++;
assert.equal(unresolved.scheduled.length,0,'accepted key already shown by browser cannot schedule again after activation');checks++;
const requested=await fixture({display:'prompt'});
await requested.mobile.ensurePushRegistration({requestPermission:true});
assert.equal(requested.mobile.nativeNotifications,true,'returned permission grant, not stale pre-request value');checks++;
const revoked=await fixture();revoked.setDisplay('denied');
await revoked.emit('firebase','notificationReceived',{notification:{data}});
assert.equal(revoked.mobile.nativeNotifications,false);assert.equal(revoked.scheduled.length,0);
assert.deepEqual([...revoked.memory.values()].map(v=>JSON.parse(v)).filter(v=>v.schema_version===receipts.NATIVE_NOTIFICATION_RECEIPT_SCHEMA).map(v=>v.action),['received']);checks++;
const returnBrowser=revoked.fullBrowser();await returnBrowser.poll();
assert.equal(returnBrowser.presented,1,'revoked permission restores actual fallback');checks++;
const invalidPermission=await fixture();invalidPermission.setDisplay(undefined);
await invalidPermission.emit('firebase','notificationReceived',{notification:{data}});
assert.equal(invalidPermission.mobile.nativeNotifications,false);assert.equal(invalidPermission.scheduled.length,0);checks++;
for(const source of ['firebase','local'])for(const [actionId,expected] of [['tap','opened'],['acknowledge','acknowledged'],['dismiss',null],['dismissed',null],['cancel',null],['unknown',null],[undefined,null]]){
  const f=await fixture();
  await f.emit(source,source==='firebase'?'notificationActionPerformed':'localNotificationActionPerformed',{
    actionId,notification:{[source==='firebase'?'data':'extra']:{...data,route:'employee-schedule.html'}}});
  const actions=[...f.memory.values()].map(v=>JSON.parse(v)).filter(v=>v.schema_version===receipts.NATIVE_NOTIFICATION_RECEIPT_SCHEMA).map(v=>v.action);
  assert.deepEqual(actions,expected?[expected]:[],'one exact actual listener action, no inferred states');
  assert.deepEqual(f.effects,expected?['route:employee-schedule.html']:[]);checks++;
}
for(const actionId of ['tap','acknowledge'])for(const change of mutations){
  const f=await fixture(),bad={...data,route:'employee-schedule.html'};change(bad);
  await f.emit('local','localNotificationActionPerformed',{actionId,notification:{extra:bad}});
  assert.equal(f.memory.size,0);assert.deepEqual(f.effects,[]);assert.equal(f.requests.length,0);checks++;
}
const saved=[...arrival.memory].map(([key,value])=>[key,JSON.parse(value)]).filter(([,row])=>row.schema_version===receipts.NATIVE_NOTIFICATION_RECEIPT_SCHEMA);
const restarted=await fixture({memory:arrival.memory});
restarted.setPrincipal({...principal,employee_id:'00000000-0000-4000-8000-000000000010',assignment_epoch:8});
await restarted.reconnect();
for(const [key,before] of saved){
  const after=JSON.parse(restarted.memory.get(key));
  assert.deepEqual(after.receipt_binding,before.receipt_binding);assert.equal(after.created_at,before.created_at);
  assert.ok(after.attempts>=before.attempts);checks++;
}
for(const request of restarted.requests){assert.deepEqual(request.body.receipt_binding,saved.find(([,row])=>row.action===request.body.action)[1].receipt_binding);checks++;}
assert.deepEqual(restarted.effects,[],'old outbox retry does not re-present for a new occupant');checks++;
// Non-bound existing event/message notifications retain their dispatch path.
const messageEffects=[];
await receipts.receiveNativeNotification({event:{notification:{data:{kind:'employee_message'}}},
  persist:async()=>{throw Error('message is not a lunch receipt');},dispatch:()=>messageEffects.push('dispatch'),
  shouldPresent:true,present:async()=>messageEffects.push('present'),flush:async()=>messageEffects.push('flush')});
assert.deepEqual(messageEffects,['dispatch','present']);checks++;
assert.equal(receipts.NATIVE_NOTIFICATION_LIFECYCLE.swipe_dismissal,'local_only');
assert.ok(!receipts.NATIVE_NOTIFICATION_LIFECYCLE.produced_actions.includes('dismissed'));checks++;
console.log(JSON.stringify({ok:true,checks,scope:'actual registered bridge callbacks; protected-principal synthetic fixture; offline/restart replay',physical:false}));
