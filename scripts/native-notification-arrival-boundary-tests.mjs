import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import * as receipts from '../mobile/src/custodial/notification-receipts.js';
import {protectedPrincipal,principalIdentity} from '../mobile/src/custodial/protected-principal.js';
import {createNotificationPresentationMode} from '../mobile/src/custodial/notification-mode.js';
import {createNotificationPresenter} from '../mobile/src/custodial/notification-presentation.js';
import {createEventNotificationOpenOutbox} from '../mobile/src/custodial/event-notification-receipts.js';
import {createPrincipalNotificationScheduler} from '../mobile/src/custodial/notification-schedule.js';
import {createScheduleNotificationAuthority} from '../mobile/src/custodial/notification-schedule-authority.js';
import {CUSTODIAL_RELEASE_CAPABILITIES,custodialNotificationEnabled} from '../mobile/src/custodial/release-scope.js';
import {scopeModule,CLEANING_SCOPE} from '../mobile/scripts/custodial-new-producer-scope-policy.mjs';

const deviceId='KIOSK_08';
const data={kind:'employee_lunch_coverage',notification_key:'lunch:synthetic:start',
  receipt_job_id:'00000000-0000-4000-8000-000000000001',receipt_credential_id:'00000000-0000-4000-8000-000000000002',
  receipt_employee_id:'00000000-0000-4000-8000-000000000003',receipt_assignment_epoch:'7',receipt_device_id:deviceId};
let checks=0;
const permissionOwnerOnly=process.argv.includes('--notification-permission-owner-only');
const presenterWriterOnly=process.argv.includes('--notification-presenter-original-writer-only')||permissionOwnerOnly;
if(!presenterWriterOnly){
for(const persist of [async()=>false,async()=>undefined,async()=>{throw new Error('protected storage unavailable');}]){
  const effects=[];
  try{await receipts.receiveNativeNotification({event:{notification:{data}},persist,
    dispatch:()=>effects.push('dispatch'),present:async()=>effects.push('present'),shouldPresent:true,
    flush:async()=>effects.push('flush')});}catch(error){assert.match(error.message,/protected storage unavailable/);}
  assert.deepEqual(effects,[],'rejected or unavailable protected arrival must not dispatch, flush or present');checks++;
}
}
const principal={schema_version:'custodial-protected-principal.v1',device_id:deviceId,
  employee_id:data.receipt_employee_id,credential_id:data.receipt_credential_id,assignment_epoch:7,
  credential_operation_id:'00000000-0000-4000-8000-000000000004',
  installation_seal:'fixture-installation-seal-0001',enrolled_at:'2026-07-01T12:00:00.000Z'};
const bridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
// Bind the selected module to the maintained profile compiler. The older
// positive notification cases explicitly exercise its full-system test profile;
// a separate cleaning-profile case below proves deferred new admissions.
const selectedScopeProfile=JSON.parse(readFileSync(new URL('../mobile/src/custodial/new-producer-scope.profile.json',import.meta.url),'utf8'));
assert.deepEqual(Object.keys(selectedScopeProfile).sort(),['profile','schema']);
assert.equal(selectedScopeProfile.schema,'custodial.new-producer-scope.v1');
assert.equal(readFileSync(new URL('../mobile/src/custodial/new-producer-scope.js',import.meta.url),'utf8'),scopeModule(selectedScopeProfile.profile));
const begin=bridge.indexOf('  function notificationChannel('),end=bridge.indexOf('  const feedbackOutbox=',begin);
assert.ok(begin>=0&&end>begin);
const modeBegin=bridge.indexOf('  const notificationPresentation ='),modeEnd=bridge.indexOf('  const { credentialStore',modeBegin);
const publishedBegin=bridge.indexOf('  window.MemphisMobile = Object.freeze({'),publishedEnd=bridge.indexOf('\n  });',publishedBegin)+6;
assert.ok(modeBegin>=0&&modeEnd>modeBegin&&publishedBegin>=0&&publishedEnd>publishedBegin);
const published=bridge.slice(publishedBegin,publishedEnd);
const schedulerSource=readFileSync(new URL('../mobile/src/custodial/notification-schedule.js',import.meta.url),'utf8');
function schedulerForFixtureProfile(profile) {
  assert.equal((schedulerSource.match(/^import /gm)||[]).length,2,'review all actual scheduler imports');
  const program=scopeModule(profile).replace(/^export /gm,'')
    +schedulerSource.replace(/^import .*;\r?\n/gm,'').replace('export function createPrincipalNotificationScheduler','function createPrincipalNotificationScheduler')
    +'\nthis.schedulerFactory=createPrincipalNotificationScheduler;';
  const environment={protectedPrincipal,principalIdentity,crypto:webcrypto};
  vm.runInNewContext(program,environment,{filename:'actual-scheduler-explicit-test-profile.js',timeout:1000});
  return environment.schedulerFactory;
}
const notificationOwnerContextNames=Object.freeze([
  ...Object.keys(receipts),'principalIdentity','protectedPrincipal','createEventNotificationOpenOutbox',
  'createNotificationPresentationMode','CUSTODIAL_RELEASE_CAPABILITIES','custodialNotificationEnabled',
  'createNotificationPresenter','createScheduleNotificationAuthority','createPrincipalNotificationScheduler',
  'nativeApplicationSource','nativeVault','providerMirror','bridgeReady','feedbackOutbox','profileMatchesPrincipal',
  'currentPrincipal','currentPrincipalIdentity','deviceId','security','localStorage','NATIVE_NOTIFICATION_OUTBOX_PREFIX',
  'Capacitor','safeNativeRoute','location','CustomEvent','window','document','requestEnvelope',
  'LocalNotifications','FirebaseMessaging','Network','App',
]);
function assertNotificationOwnerContext(context,actualOwnerSource) {
  // This finite version-bound context contract is not a generic identifier parser.
  // Any owner-source change refuses before evaluation and requires its bindings
  // to be reviewed; missing current context names are reported directly.
  assert.equal(createHash('sha256').update(actualOwnerSource).digest('hex'),'f8bb4f54cfb8a0d4c951ac29b0d2fc062aeb699cd5afc1f9eccca4d1bdfbbc47','Frozen notification owner changed; review the exact current import/closure dependencies');
  for(const name of notificationOwnerContextNames)
    assert.ok(Object.hasOwn(context,name)&&context[name]!==undefined,'Missing notification owner context: '+name);
  assert.equal(context.nativeApplicationSource,null,'Fixture selects only the real existing null-default application-source route');
}
let notificationClosureNegativesChecked=false;
const reminderSource=readFileSync(new URL('../memphis-device-reminders.js',import.meta.url),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fullBrowserFixture(context, { rows = [], fetchWait = null, fetchRows = null, fetchIdentity = null, debugReminder = false,
  manualAudio = false, browserSpeech = false, fullySpeech = false, observedAudio = false, onTone = ()=>{} } = {}) {
  let card=null,fetches=0,identityFetches=0,timerId=0,audioStops=0;const httpActions=[],timers=new Map(),timerDelays=new Map();
  const cards=[],session=new Map(),noop=()=>{},wakeCalls=[];
  const tones=[],utterances=[],fullyBindings=new Map(),fullyTexts=[];
  function element(){const children=new Map();return {textContent:'',attributes:{},listeners:{},children:[],appendChild(node){this.children.push(node);},addEventListener(name,fn){this.listeners[name]=fn;},click(){return this.listeners.click?.();},classList:{toggle:noop},setAttribute(k,v){this.attributes[k]=v;},
    querySelector:key=>{if(!children.has(key))children.set(key,element());return children.get(key);},
    remove(){if(card===this)card=null;}};}
  context.document.readyState='complete';context.document.getElementById=()=>null;
  context.document.querySelector=selector=>selector==='.mz-reminder-backdrop'?card:null;
  context.document.createElement=element;context.document.head={appendChild:noop};
  context.document.body={dataset:{memphisContext:'employee'},classList:{toggle:noop},appendChild:node=>{card=node;cards.push(node);}};
  context.window.location={href:'https://localhost/employee-schedule.html?hub=employee&device=KIOSK_08'+(debugReminder?'&testReminder=1':'')};
  // Reuse the fixture's original generation-bound/checkpoint-capable owner.
  // A thin ready/device object is not the current reminder writer protocol.
  context.window.MemphisCustodialSecurity=context.security;
  context.sessionStorage={getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)};
  Object.assign(context,{URL,Uint8Array,DataView,Float32Array,encodeURIComponent,
    navigator:{vibrate:noop},Audio:class{paused=true;load(){}play(){onTone();this.paused=false;tones.push(this);if(!manualAudio)queueMicrotask(()=>this.onended?.());return Promise.resolve();}pause(){if(!this.stuck)this.paused=true;}
      set onended(fn){this.end=fn?()=>{this.paused=true;fn();}:null;}get onended(){return this.end;}},
    setTimeout:(fn,delay)=>{timers.set(++timerId,fn);timerDelays.set(timerId,delay);return timerId;},setInterval:()=>1,clearTimeout:id=>timers.delete(id),
    btoa:value=>Buffer.from(value,'binary').toString('base64'),fetch:async (url,options={})=>{
      if(url.includes('/device-notifications/ack'))httpActions.push(JSON.parse(options.body));
      let payload={};
      if(url.includes('/me/by-device')){identityFetches++;payload=fetchIdentity?await fetchIdentity(identityFetches):{msg_user_id:'synthetic',display_name:'Synthetic Custodian'};}
      else if(url.includes('/device-location-status-reminders')){fetches++;const call=fetches;if(fetchWait)await fetchWait;payload=fetchRows?await fetchRows(call):rows;}
      else if(url.includes('/threads'))payload=[];
      return {ok:true,json:async()=>({ok:true,data:payload})};
    }});
  context.window.setTimeout=context.setTimeout;context.window.setInterval=context.setInterval;
  context.window.clearTimeout=context.clearTimeout;context.window.speechSynthesis={cancel:()=>{audioStops++;}};
  if(observedAudio)Object.assign(context.window.speechSynthesis,{speaking:false,pending:false,cancel(){audioStops++;if(!this.stuck){this.speaking=false;this.pending=false;}}});
  if(browserSpeech){
    context.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
    context.window.SpeechSynthesisUtterance=context.SpeechSynthesisUtterance;
    context.window.speechSynthesis.speak=utterance=>{
      utterances.push(utterance);if(observedAudio){const engine=context.window.speechSynthesis;engine.speaking=true;engine.current=utterance;
        for(const event of ['onend','onerror']){const original=utterance[event];utterance[event]=()=>{if(engine.current===utterance)engine.speaking=false;original?.();};}}
    };
  }
  // Observe only this synthetic renderer's exact wake calls. No real Fully or
  // device is used; these methods do not grant audio or presentation authority.
  context.window.fully={turnScreenOn:()=>wakeCalls.push('turnScreenOn'),bringToForeground:()=>wakeCalls.push('bringToForeground'),vibrate:noop};
  if(fullySpeech)Object.assign(context.window.fully,{bind:(kind,code)=>fullyBindings.set(kind,code),
    textToSpeech:text=>fullyTexts.push(text),stopTextToSpeech:()=>{audioStops++;}});
  // Test-only observation of closed-over state, never a product logic rewrite.
  assert.equal(reminderSource.split('window.MemphisDeviceReminders = {').length,2,
    'actual reminder state observation must have one exact Source anchor');
  assert.equal(reminderSource.split('else init();').length,2,
    'actual async reminder startup must have one exact Source anchor');
  const observedReminderSource=reminderSource
    .replace('window.MemphisDeviceReminders = {','window.__reminderTestState = state; window.MemphisDeviceReminders = {')
    .replace('else init();','else globalThis.__reminderFixtureInitialization = init();');
  assert.equal(vm.runInContext("Object.getOwnPropertyDescriptor(globalThis,'custodialNativeNormalApplicationOwner')",context),undefined,
    'mixed legacy fixture must not bypass a normal-application duplicate-start denial marker');
  vm.runInContext(observedReminderSource,context,{filename:'actual-full-memphis-device-reminders.js'});
  const ready=context.__reminderFixtureInitialization;
  assert.ok(ready&&typeof ready.then==='function','actual reminder initialization promise unavailable');
  return {ready,poll:async()=>{
    await ready;
    assert.equal(typeof context.window.MemphisDeviceReminders?.poll,'function',
      'actual reminder init did not install its current poll owner');
    return context.window.MemphisDeviceReminders.poll();
  },cards,httpActions,tones,utterances,fullyTexts,fullyBindings,wakeCalls,
    get state(){return context.window.__reminderTestState;},get identityFetches(){return identityFetches;},
    runTimer:delay=>{const entry=[...timers].find(([id])=>timerDelays.get(id)===delay);assert.ok(entry,'requested registered timer');timers.delete(entry[0]);return entry[1]();},
    get href(){return context.window.location.href;},setHref:value=>{context.window.location.href=value;},
    async finishTimers(){for(let i=0;i<16&&timers.size;i++){const batch=[...timers.values()];timers.clear();for(const fn of batch)fn();await turn();}},
    get speech(){return context.window.speechSynthesis;},get card(){return card;},get active(){return card!==null;},get presented(){return cards.length;},get fetches(){return fetches;},get audioStops(){return audioStops;}};
}
async function fixture({memory=new Map(),offline=true,capable=true,firebaseAvailable=capable,localAvailable=capable,platform='android',receive='granted',display='granted',
  supported=true,actionFailure=false,listenerFailure=false,channelFailure=false,registrationFailure=false,permissionWait=null,initialize=true,initialPrincipal=principal,presentationIsCurrent=null,scheduleAuthorityFactory=null,providerMirror=null,presenterNativeOwner=false,scopeProfile='full-system'}={}){
  const native=new Map(),local=new Map(),network=new Map(),windowEvents=new Map(),effects=[],requests=[],scheduled=[],actionTypes=[],modes=[],cancelled=[],securityListeners=[];
  const pluginCalls=[],pluginConstructions=new Set();
  let active=initialPrincipal,failStorage=false,readbackLost=false,mutationHook=()=>{},presentFailure=false,displayWriteFailure=false,audioClaimWriteFailure=false,modeHook=()=>{};
  let registrationWait=null,scheduleWait=null,mutationWait=null,registerCalls=0,permissionRequests=0,localChecks=0;
  let generation=11,presenter=null,presentationSaveHook=null;
  const presentationSaves=[];
  const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(failStorage)throw Error('synthetic write failure');
    if(displayWriteFailure&&JSON.parse(v).action==='displayed'){displayWriteFailure=false;throw Error('synthetic display receipt write failure');}
    if(audioClaimWriteFailure&&JSON.parse(v).audioState==='claimed'){audioClaimWriteFailure=false;throw Error('synthetic audio claim write failure');}
    if(!readbackLost)memory.set(k,v);},
    removeItem:k=>memory.delete(k),key:i=>[...memory.keys()][i],get length(){return memory.size;}};
  let scheduleAuthority;
  const context={...receipts,console,principalIdentity,protectedPrincipal,createEventNotificationOpenOutbox,createNotificationPresentationMode,CUSTODIAL_RELEASE_CAPABILITIES,custodialNotificationEnabled,
    createNotificationPresenter:options=>{
      const supplied={...options,...(presentationIsCurrent?{isCurrent:presentationIsCurrent}:{})};
      if(presenterNativeOwner)Object.assign(supplied,{nativeStatus:()=>context.security.getStatus(),requireNativeOwner:true,
        save:async(entry,canWrite,bounds)=>{
          const record={entry,canWrite,bounds};presentationSaves.push(record);
          if(presentationSaveHook)await presentationSaveHook('before',record);
          const result=await options.save(entry,canWrite,bounds);
          if(presentationSaveHook){
            const outcome=await presentationSaveHook('after',record);
            if(outcome!==undefined)return outcome;
          }
          return result;
        }});
      return presenter=createNotificationPresenter(supplied);
    },
    // Existing receipt/permission tests deliberately isolate schedule authority.
    // The new mounted-authority suite supplies the REAL factory plus cache.
    createScheduleNotificationAuthority:options=>(scheduleAuthority=scheduleAuthorityFactory?scheduleAuthorityFactory(options):{
      isCurrent:()=>true,refresh:async()=>true,observe:async()=>true,securityChanged(){},unavailable(){},isStorageKey:()=>false,
      // Legacy receipt fixtures have no accepted-location read. New writer
      // cases above/below use the real schedule-authority factory instead.
      beginAcceptedLocationSessionRead:()=>null,acceptedLocationSessionReadCurrent:()=>false,
      finishAcceptedLocationSessionRead(){},observeAcceptedLocationSession:()=>false}),
    createPrincipalNotificationScheduler:schedulerForFixtureProfile(scopeProfile),nativeApplicationSource:null,localStorage:storage,NATIVE_NOTIFICATION_OUTBOX_PREFIX:'receipt:',JSON,Date,Number,Math,
    Capacitor:{getPlatform:()=>platform,isPluginAvailable:name=>name==='FirebaseMessaging'?firebaseAvailable:name==='LocalNotifications'?localAvailable:false},
    // Existing legacy suite leaves the separately constructed native mirror suspended.
    // Its owning integration suite passes the actual mirror coordinator here.
    nativeVault:true,providerMirror,bridgeReady:Promise.resolve(),feedbackOutbox:{save(){},flush(){}},profileMatchesPrincipal:()=>true,
    currentPrincipal:()=>protectedPrincipal(active),deviceId:()=>deviceId,
    security:{native:true,getStatus:()=>({state:'enrolled',ready:true,available:true,quarantined:false,generation,deviceId,principal:active}),
      subscribe:fn=>{securityListeners.push(fn);return()=>{};},mutateProtectedWork:async(operation,options={})=>{
      if(mutationWait){const wait=mutationWait;mutationWait=null;await wait;}mutationHook();
      if(options.expectedGeneration!=null&&options.expectedGeneration!==generation)throw Error('synthetic native generation refused');
      const original=generation,owner=active;let open=true;
      try{return await operation({deviceId,generation,assertCurrent:()=>{
        assert.equal(open,true,'native callback checkpoint used after closure');
        if(original!==generation||active!==owner)throw Error('synthetic native callback changed');
      }});}finally{open=false;}}},
    safeNativeRoute:route=>route==='employee-schedule.html'?route:'',
    location:{assign:route=>effects.push(`route:${route}`)},
    CustomEvent:class{constructor(name,options){this.name=name;this.detail=options.detail;}},
    window:{dispatchEvent:event=>{if(event.name==='memphis:native-notification-received')effects.push('dispatch');else {modes.push(event.detail);modeHook(event.detail);}windowEvents.get(event.name)?.(event);},addEventListener:(name,fn)=>windowEvents.set(name,fn)},
    document:{addEventListener:(name,fn)=>windowEvents.set(name,fn),hidden:false},
    requestEnvelope:async(path,options)=>{
      if(path==='/employee-notifications-api/register'){registerCalls++;if(registrationWait)await registrationWait;if(registrationFailure)throw Error('registration unavailable');return {ok:true};}
      requests.push({path,...structuredClone(options)});if(offline)throw Error('synthetic offline');
    },
    LocalNotifications:{registerActionTypes:async types=>{if(actionFailure)throw Error('actions unavailable');actionTypes.push(structuredClone(types));},
      addListener:async(name,fn)=>{if(listenerFailure)throw Error('listener unavailable');local.set(name,fn);},
      checkPermissions:async()=>{localChecks++;if(permissionWait)await permissionWait;return {display};},requestPermissions:async()=>{permissionRequests++;display='granted';return {display};},
      cancel:async payload=>{cancelled.push(structuredClone(payload));const ids=new Set(payload.notifications.map(n=>n.id));
        for(let i=scheduled.length-1;i>=0;i--)if(scheduled[i].notifications.some(n=>ids.has(n.id)))scheduled.splice(i,1);},
      getPending:async()=>({notifications:scheduled.flatMap(p=>p.notifications)}),
      getDeliveredNotifications:async()=>({notifications:[]}),
      schedule:async payload=>{
        assert.ok([...memory.values()].some(v=>JSON.parse(v).action==='received'),'actual schedule cannot present before durable received');
        if(scheduleWait)await scheduleWait;
        effects.push('present');if(presentFailure)throw Error('presentation failed');scheduled.push(structuredClone(payload));
      }},
    FirebaseMessaging:{addListener:async(name,fn)=>native.set(name,fn),isSupported:async()=>({isSupported:supported}),
      createChannel:async()=>{if(channelFailure)throw Error('channel unavailable');},checkPermissions:async()=>({receive}),
      requestPermissions:async()=>{receive='granted';return {receive};},getToken:async()=>({token:'synthetic-not-a-real-token'})},
    Network:{addListener:async(name,fn)=>network.set(name,fn)},App:{addListener:async(name,fn)=>windowEvents.set(name,fn)},
  };
  // Model Capacitor's source-owned lazy construction boundary: merely importing
  // the proxy does not materialize the web implementation; invoking a method
  // does. No real Firebase config/provider/browser or network is used here.
  for(const name of ['FirebaseMessaging','LocalNotifications']){
    const target=context[name];
    context[name]=new Proxy(target,{get(object,method){const value=object[method];
      if(typeof value!=='function')return value;
      return (...args)=>{pluginConstructions.add(name);pluginCalls.push({plugin:name,method:String(method)});return value.apply(object,args);};
    }});
  }
  // Execute the complete published object verbatim. Stub only unrelated API
  // functions, not the source-owned mode, permissions or notification producer.
  for(const [,name] of published.matchAll(/^    (\w+),$/gm))if(!(name in context))context[name]=()=>{};
  context.currentPrincipalIdentity=()=>principalIdentity(active);
  const scopeSource=scopeModule(scopeProfile).replace(/^export /gm,'');
  const actualOwnerSource=bridge.slice(modeBegin,modeEnd)+bridge.slice(begin,end)+published;
  assertNotificationOwnerContext(context,actualOwnerSource);
  if(!notificationClosureNegativesChecked){
    const missing={...context};delete missing.nativeApplicationSource;
    assert.throws(()=>assertNotificationOwnerContext(missing,actualOwnerSource),/Missing notification owner context: nativeApplicationSource/);
    assert.throws(()=>assertNotificationOwnerContext(context,actualOwnerSource+'\nnewUnexpectedOwnerDependency();'),/Frozen notification owner changed/);
    notificationClosureNegativesChecked=true;
  }
  vm.createContext(context);vm.runInContext(scopeSource+actualOwnerSource,context);
  assert.equal(context.window.MemphisMobile.nativeNotifications,false,'exact published startup defaults to browser fallback');
  await context.installNotificationRouting();
  const registration=context.window.MemphisMobile.ensurePushRegistration();
  if(initialize)await registration;
  return {memory,effects,requests,scheduled,cancelled,actionTypes,modes,mobile:context.window.MemphisMobile,registration,scheduleAuthority,
    get presenter(){return presenter;},presentationSaves,
    onPresentationSave:fn=>{presentationSaveHook=fn;},advanceGeneration:()=>{generation++;},
    pluginCalls,pluginConstructions,nativeListeners:()=>[...native.keys()],localListeners:()=>[...local.keys()],
    get permissionRequests(){return permissionRequests;},get registerCalls(){return registerCalls;},get localChecks(){return localChecks;},
    holdRegistration:wait=>{registrationWait=wait;},
    holdSchedule:wait=>{scheduleWait=wait;},fullBrowser:options=>fullBrowserFixture(context,options),
    holdNextMutation:wait=>{mutationWait=wait;},
    onMode:fn=>{modeHook=fn;},
    trigger:(kind,value)=>kind==='token'?native.get('tokenReceived')({token:'new-token'}):kind==='network'?network.get('networkStatusChange')({connected:true}):windowEvents.get(kind)(value),
    failNextDisplayed:()=>{displayWriteFailure=true;},
    failNextAudioClaim:()=>{audioClaimWriteFailure=true;},
    setDisplay:p=>{display=p;},setPrincipal:p=>{active=p;for(const fn of securityListeners)fn({principal:p});
      windowEvents.get('memphis:custodial-security-state')?.({detail:{principal:p}});},fail:()=>{failStorage=true;},loseReadback:()=>{readbackLost=true;},
    emitSecurity:detail=>{for(const fn of securityListeners)fn(detail);windowEvents.get('memphis:custodial-security-state')?.({detail});},
    changeAtMutation:p=>{mutationHook=()=>{active=p;};},failPresentation:()=>{presentFailure=true;},
    async emit(source,name,value){(source==='firebase'?native:local).get(name)(value);await turn();await turn();},
    async reconnect(){windowEvents.get('online')();await turn();await turn();}};
}
if(!presenterWriterOnly){
{
  const memory=new Map([['unrelated-retained-fixture',JSON.stringify({schema:'unrelated-retained-fixture',id:'original-unchanged'})]]);
  const original=[...memory];
  const f=await fixture({memory,scopeProfile:CLEANING_SCOPE});
  const result=await f.registration;
  assert.deepEqual(Object.keys(result).sort(),['deferred','reason','registered']);
  assert.equal(result.deferred,true);assert.equal(result.reason,'custodial_new_producer_scope_deferred');assert.equal(result.registered,false);
  assert.equal(f.registerCalls,0);assert.equal(f.permissionRequests,0);assert.equal(f.actionTypes.length,0);assert.equal(f.scheduled.length,0);
  assert.equal(f.pluginCalls.some(call=>['isSupported','createChannel','checkPermissions','requestPermissions','getToken','registerActionTypes','schedule'].includes(call.method)),false);
  assert.deepEqual(f.nativeListeners(),['tokenReceived','notificationReceived','notificationActionPerformed']);
  assert.deepEqual(f.localListeners(),['localNotificationActionPerformed']);
  assert.deepEqual([...memory],original,'deferred new admissions preserve unrelated original fixture bytes');
  checks+=12;
}
const mutations=[
  d=>{d.receipt_device_id='KIOSK_03';},d=>{d.receipt_credential_id='00000000-0000-4000-8000-000000000009';},
  d=>{d.receipt_employee_id='00000000-0000-4000-8000-000000000009';},d=>{d.receipt_assignment_epoch='8';},
  d=>{d.receipt_assignment_epoch='1.5';},d=>{d.receipt_job_id='not-a-job';},d=>{d.kind='unknown';},
];
// Real compiled G01 evidence showed an unhandled Firebase app/no-app rejection
// from unconditional addListener on a web platform whose capability is false.
// This deterministic source-bound regression fails before the routing guard.
const incapableVariants=[{platform:'web'},{capable:false},{firebaseAvailable:false},{localAvailable:false},{platform:'unsupported'}];
for(const unavailable of incapableVariants){
  const memory=new Map([['protected:cleaning','original same-tag Finish bytes'],['protected:queue','original offline operation bytes']]);
  const before=JSON.stringify([...memory]);const f=await fixture({...unavailable,memory});
  assert.deepEqual(f.pluginCalls,[],'incapable platform must not invoke/materialize either native notification plugin');
  assert.equal(f.pluginConstructions.size,0,'native/Firebase web implementation must not be constructed');
  assert.deepEqual(f.nativeListeners(),[]);assert.deepEqual(f.localListeners(),[]);
  assert.equal(f.mobile.nativeNotifications,false);assert.equal(f.registerCalls,0);assert.equal(f.permissionRequests,0);
  assert.equal(JSON.stringify([...memory]),before,'startup retains protected Finish/offline bytes');
  const browser=f.fullBrowser({rows:[{notification_key:'browser:capability-fixture',location_code:'SYNTHETIC',status_code:'due_soon',employee_id:principal.employee_id}]});
  await browser.poll();assert.equal(browser.presented,1,'actual authenticated browser poll fallback remains installed');
  await f.reconnect();await f.mobile.ensurePushRegistration();
  assert.deepEqual(f.pluginCalls,[],'reconnect/registration retries cannot materialize incapable native plugins');
  assert.equal(JSON.stringify([...memory]),before,'browser fallback retains original protected bytes');checks+=11;
}
// F-BRIDGE-001: an imported LocalNotifications proxy must remain inert even
// when a prior capable process left genuine schedule recovery work behind.
// Use the REAL scheduler, valid rows and exact guard bytes, not opaque strings
// alone. A skipped native reconciliation is neither cancellation nor ACK.
for(const unavailable of incapableVariants)for(const retainedState of ['intent','unconfirmed','stale']){
  const retainedPrincipal=retainedState==='stale'?{...principal,assignment_epoch:6}:principal;
  const scope=principalIdentity(retainedPrincipal),id=7,group='mz-custodial-owned:00000000-0000-4000-8000-000000000007';
  const notification={id,title:'Synthetic retained lunch',body:'Synthetic original coverage',group,
    extra:{...data,receipt_assignment_epoch:String(retainedPrincipal.assignment_epoch),
      native_presentation_principal:scope,native_presentation_id:String(id)}};
  const row={schema_version:'native-notification-schedule.v1',id,scope,notification,delivery_ownership_group:group,
    state:retainedState==='intent'?'intent':'scheduled'};
  const rowKey='receipt:schedule:7',guardKey='receipt:schedule:unconfirmed:7';
  // Noncanonical whitespace detects normalization as well as semantic mutation.
  const encoded=JSON.stringify(row,null,2),guard=JSON.stringify({schema_version:'native-notification-schedule-guard.v1',id,scope});
  const memory=new Map([['protected:cleaning','original same-tag Finish bytes'],['protected:queue','original offline operation bytes'],[rowKey,encoded]]);
  if(retainedState==='unconfirmed')memory.set(guardKey,guard);
  const before=JSON.stringify([...memory]),label=JSON.stringify(unavailable)+'/'+retainedState;
  const f=await fixture({...unavailable,memory});
  function preserved(phase){
    assert.deepEqual(f.pluginCalls,[],label+'/'+phase+': zero plugin invocation');
    assert.equal(f.pluginConstructions.size,0,label+'/'+phase+': zero lazy plugin construction');
    assert.equal(JSON.stringify([...memory]),before,label+'/'+phase+': exact retained row, guard and protected bytes');
    assert.equal(f.mobile.nativeNotifications,false,label+'/'+phase+': no native-ready claim');checks+=4;
  }
  preserved('startup');
  const browser=f.fullBrowser({rows:[{notification_key:'browser:retained-schedule-fallback',location_code:'SYNTHETIC',
    status_code:'due_soon',employee_id:principal.employee_id}]});
  await browser.poll();assert.equal(browser.presented,1,label+': actual browser fallback still presents');checks++;
  // Exercise actual mounted lifecycle handlers, including a null-key storage
  // refresh and an explicit registration retry. No invented recovery event.
  for(const [name,invoke] of [
    ['online',()=>f.reconnect()],['storage',()=>f.trigger('storage',{key:null})],
    ['security',()=>f.emitSecurity({ready:true,available:true,principal})],
    ['visibility',()=>f.trigger('visibilitychange')],['resume',()=>f.trigger('resume')],
    ['network',()=>f.trigger('network')],['registration',()=>f.mobile.ensurePushRegistration()],
    ['presentation-retry',async()=>{assert.equal(await f.mobile.retryNotificationPresentation(),false,
      label+': skipped native reconciliation is not cleanup confirmation');checks++;}],
  ]){await invoke();await turn();await turn();preserved(name);}
  assert.equal(f.registerCalls,0);assert.equal(f.permissionRequests,0);checks+=2;
  // A later supported process may reconcile the SAME untouched saved bytes.
  // No fabricated native cancellation was recorded by the incapable process.
  for(const platform of ['android','ios'])for(const display of ['granted','denied']){
    const recoveredMemory=new Map(memory),capable=await fixture({platform,display,memory:recoveredMemory});
    assert.equal(capable.mobile.nativeNotifications,display==='granted',label+'/'+platform+': permission readiness still distinct from capability');
    assert.deepEqual(capable.cancelled,[{notifications:[{id}]}],label+'/'+platform+': exact owned cancellation');
    assert.deepEqual(capable.pluginCalls.filter(c=>['getPending','getDeliveredNotifications','cancel'].includes(c.method)).map(c=>c.method),
      ['getPending','getDeliveredNotifications','cancel','getPending','getDeliveredNotifications']);
    assert.deepEqual(JSON.parse(recoveredMemory.get(rowKey)),{...row,state:'cancelled'},label+'/'+platform+': unchanged cancellation authority');
    assert.equal(recoveredMemory.get(guardKey),guard,label+'/'+platform+': original action guard remains closed');
    assert.equal(recoveredMemory.get('protected:cleaning'),memory.get('protected:cleaning'));
    assert.equal(recoveredMemory.get('protected:queue'),memory.get('protected:queue'));
    assert.deepEqual([...recoveredMemory.keys()].sort(),[...memory.keys(),...(memory.has(guardKey)?[]:[guardKey])].sort(),
      label+'/'+platform+': cancellation does not manufacture received/displayed/Open/ACK');
    assert.deepEqual(capable.scheduled,[]);checks+=9;
  }
}
for(const platform of ['android','ios']){
  const f=await fixture({platform});
  assert.deepEqual([...f.pluginConstructions].sort(),['FirebaseMessaging','LocalNotifications']);
  assert.deepEqual(f.nativeListeners(),['tokenReceived','notificationReceived','notificationActionPerformed']);
  assert.deepEqual(f.localListeners(),['localNotificationActionPerformed']);
  assert.equal(f.mobile.nativeNotifications,true,'capable native still requires existing registration/permission/routing gates');
  await f.emit('firebase','notificationReceived',{notification:{data}});
  assert.equal(f.scheduled.length,1,'supported native still receives and presents exactly once');
  const notification=f.scheduled[0].notifications[0];
  await f.emit('local','localNotificationActionPerformed',{actionId:'acknowledge',notification});
  assert.deepEqual([...f.memory.values()].map(v=>JSON.parse(v)).filter(v=>v.schema_version===receipts.NATIVE_NOTIFICATION_RECEIPT_SCHEMA).map(v=>v.action).sort(),['acknowledged','displayed','received']);checks+=6;
}
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
assert.ok([...pendingRestart.memory.values()].map(JSON.parse).some(row=>row.schema_version==='native-notification-presentation.v2'&&row.owner===null));
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
// These cases have real native capability but unavailable OS permission/setup;
// their actual native callback still needs the existing safe browser fallback.
// Truly absent capability is tested above through its real HTTP-poll producer,
// never by injecting a Firebase callback that cannot legitimately exist.
for(const unavailable of [{supported:false},{display:'denied'},{display:'prompt'},
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
const startupBrowser=unresolved.fullBrowser({rows:[{notification_key:data.notification_key,location_code:'SYNTHETIC',status_code:'due_soon',employee_id:principal.employee_id}]});
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
  await f.emit('firebase','notificationReceived',{notification:{data:{...data,route:'employee-schedule.html'}}});
  const owned=f.scheduled[0].notifications[0];f.effects.length=0;
  await f.emit(source,source==='firebase'?'notificationActionPerformed':'localNotificationActionPerformed',{
    actionId,notification:structuredClone(owned)});
  const actions=[...f.memory.values()].map(v=>JSON.parse(v)).filter(v=>v.schema_version===receipts.NATIVE_NOTIFICATION_RECEIPT_SCHEMA&&!['received','displayed'].includes(v.action)).map(v=>v.action);
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
}
if(presenterWriterOnly&&!permissionOwnerOnly){
 const results=[];
 const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
 const run=async(name,body)=>{try{await body();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.stack});}};
 await run('PRESENTER_WRITER_NEW: queued entry writer cannot adopt same-principal successor generation',async()=>{
  const f=await fixture({display:'denied',presenterNativeOwner:true,scheduleAuthorityFactory:createScheduleNotificationAuthority}),entered=deferred(),release=deferred();
  f.onPresentationSave(async(phase,record)=>{
   if(phase==='after'&&f.presentationSaves[0]===record){entered.resolve();await release.promise;}
  });
  const event={notification:{title:'Synthetic retained original',data}};
  const first=f.presenter.accept(event);await entered.promise;
  const raw=JSON.stringify([...f.memory]),second=f.presenter.accept(event);
  const settled=Promise.allSettled([first,second]);f.advanceGeneration();release.resolve();await settled;
  assert.equal(f.presentationSaves.length,1,'successor generation must never invoke the queued save');
  assert.equal(JSON.stringify([...f.memory]),raw,'first persisted original bytes retained');
  assert.equal(f.scheduled.length,0);assert.equal(f.effects.length,0);
 });
 const setup=options=>fixture({display:'denied',presenterNativeOwner:true,scheduleAuthorityFactory:createScheduleNotificationAuthority,...options});
 const event=()=>({notification:{title:'Synthetic retained original',body:'Original presentation body',data:{...data}}});
 const presentationRows=f=>[...f.memory.values()].map(JSON.parse).filter(row=>row.schema_version==='native-notification-presentation.v2');
 await run('PRESENTER_WRITER_NEW: full original principal is pinned before the entry queue',async()=>{
  const f=await setup(),entered=deferred(),release=deferred();
  f.onPresentationSave(async(phase,record)=>{if(phase==='after'&&f.presentationSaves[0]===record){entered.resolve();await release.promise;}});
  const first=f.presenter.accept(event());await entered.promise;const raw=JSON.stringify([...f.memory]);
  const second=f.presenter.accept(event()),settled=Promise.allSettled([first,second]);
  f.setPrincipal({...principal,installation_seal:'synthetic-successor-installation'});release.resolve();await settled;
  assert.equal(f.presentationSaves.length,1);assert.equal(JSON.stringify([...f.memory]),raw);
  assert.equal(f.scheduled.length,0);
 });
 await run('PRESENTER_WRITER_NEW: original generation option and canWrite survive native writer wait',async()=>{
  const f=await setup(),release=deferred();f.holdNextMutation(release.promise);
  const pending=f.presenter.accept(event());await turn();
  assert.equal(f.presentationSaves.length,1);
  const record=f.presentationSaves[0];
  assert.deepEqual(record.bounds,{expectedGeneration:11});assert.equal(Object.isFrozen(record.bounds),true);
  assert.equal(record.canWrite(),true);f.advanceGeneration();assert.equal(record.canWrite(),false);
  release.resolve();await assert.rejects(pending);assert.equal(f.memory.size,0);
  assert.equal(f.scheduled.length,0);
 });
 await run('PRESENTER_WRITER_NEW: missing or malformed native status cannot save or restore',async()=>{
  for(const nativeStatus of [undefined,()=>({ready:true,available:true,quarantined:false}),
   ()=>{throw Error('synthetic unreadable status');}]){
   let saves=0,loads=0;
   const presenter=createNotificationPresenter({identity:()=>principalIdentity(principal),requireNativeOwner:true,nativeStatus,
    nativeMode:()=>false,nativePresent:async()=>assert.fail('native dispatch'),save:async()=>{saves++;},
    load:async()=>{loads++;return[];},displayed:async()=>assert.fail('displayed'),action:async()=>assert.fail('action')});
   await assert.rejects(presenter.accept(event()));await assert.rejects(presenter.restore());
   assert.equal(saves,0);assert.equal(loads,0);
  }
 });
 await run('PRESENTER_WRITER_NEW: held browser action and audio callbacks cannot adopt native successor',async()=>{
  const f=await setup({presentationIsCurrent:()=>true});let bound,removed=0;
  f.presenter.registerBrowser((payload,actions)=>{assert.deepEqual(payload,event());bound=actions;
   actions.onRetire(()=>{removed++;return true;});return true;});
  await turn();assert.equal(await f.presenter.accept(event()),true);
  const raw=JSON.stringify([...f.memory]);f.advanceGeneration();
  assert.equal(bound.isCurrent(),false);assert.equal(await bound('opened'),false);
  assert.equal(await bound.beginAudio(),false);assert.equal(await bound.finishAudio(true),false);
  assert.equal(JSON.stringify([...f.memory]),raw);await f.presenter.retry();assert.equal(removed,1);
  assert.equal(f.scheduled.length,0);
 });
 await run('PRESENTER_WRITER_NEW: audio completion awaiting save cannot publish a successor result',async()=>{
  const f=await setup({presentationIsCurrent:()=>true});let bound;
  f.presenter.registerBrowser((payload,actions)=>{bound=actions;actions.onRetire(()=>true);return true;});await turn();
  assert.equal(await f.presenter.accept(event()),true);assert.equal(await bound.beginAudio(),true);
  assert.equal(presentationRows(f)[0].audioState,'claimed');
  const entered=deferred(),release=deferred(),raw=JSON.stringify([...f.memory]);
  f.onPresentationSave(async(phase,record)=>{if(phase==='before'&&record.entry.audioState==='completed'){entered.resolve();await release.promise;}});
  const pending=bound.finishAudio(true);await entered.promise;f.advanceGeneration();release.resolve();
  assert.equal(await pending,false);assert.equal(JSON.stringify([...f.memory]),raw);
  assert.equal(presentationRows(f)[0].audioState,'claimed');assert.equal(await bound.beginAudio(),false);
 });
 await run('PRESENTER_WRITER_NEW: action awaiting protected receipt cannot change visual state after loss',async()=>{
  const f=await setup({presentationIsCurrent:()=>true});let bound;
  f.presenter.registerBrowser((payload,actions)=>{bound=actions;actions.onRetire(()=>true);return true;});await turn();
  assert.equal(await f.presenter.accept(event()),true);
  const release=deferred(),raw=JSON.stringify([...f.memory]);f.holdNextMutation(release.promise);
  const pending=bound('opened');await turn();f.advanceGeneration();release.resolve();
  assert.equal(await pending,false);assert.equal(JSON.stringify([...f.memory]),raw);
  assert.equal(presentationRows(f)[0].visualState,'pending');assert.equal(f.requests.length,0);
 });
 await run('PRESENTER_WRITER_NEW: unknown save result or lost reply never adopts an audio claim',async()=>{
  for(const outcome of [false,null,{unknown:true},'throw']){
   const f=await setup({presentationIsCurrent:()=>true});let bound;
   f.presenter.registerBrowser((payload,actions)=>{bound=actions;actions.onRetire(()=>true);return true;});await turn();
   assert.equal(await f.presenter.accept(event()),true);
   const original=presentationRows(f)[0];
   f.onPresentationSave((phase,record)=>{
    if(phase==='after'&&record.entry.audioState==='claimed'){
     if(outcome==='throw')throw Error('synthetic lost save reply');return outcome;
    }
   });
   assert.equal(await bound.beginAudio(),false);
   assert.equal(presentationRows(f)[0].audioState,'claimed','already persisted uncertainty retained');
   assert.deepEqual(presentationRows(f)[0].event,original.event);assert.equal(await bound.finishAudio(true),false);
   assert.equal(await bound.beginAudio(),false,'unknown original audio is never restarted');
  }
 });
 await run('PRESENTER_WRITER_NEW: restore pins owner before load and never inserts stale loaded rows',async()=>{
  const f=await setup();await f.presenter.accept(event());const row=presentationRows(f)[0],raw=JSON.stringify([...f.memory]);
  const entered=deferred(),release=deferred();let generation=11,saves=0,shown=0;
  const presenter=createNotificationPresenter({identity:()=>principalIdentity(principal),requireNativeOwner:true,
   nativeStatus:()=>({ready:true,available:true,quarantined:false,generation,deviceId,principal}),
   nativeMode:()=>false,nativePresent:async()=>assert.fail('native dispatch'),save:async()=>{saves++;},
   load:async()=>{entered.resolve();await release.promise;return[row];},displayed:async()=>true,action:async()=>true});
  presenter.registerBrowser(()=>{shown++;return true;});await turn();
  const pending=presenter.restore();await entered.promise;generation++;release.resolve();await assert.rejects(pending);
  await presenter.retry();assert.equal(saves,0);assert.equal(shown,0);assert.equal(JSON.stringify([...f.memory]),raw);
 });
 await run('PRESENTER_WRITER_NEW: native browser fallback preserves payload and failed retirement remains pending',async()=>{
  const f=await setup({presentationIsCurrent:()=>true});let bound,allowRemoval=false,removals=0,shown=0;
  f.presenter.registerBrowser((payload,actions)=>{shown++;bound=actions;assert.deepEqual(payload,event());
   actions.onRetire(()=>{removals++;return allowRemoval;});return true;});await turn();
  assert.equal(await f.presenter.accept(event()),true);
  const original=presentationRows(f)[0];assert.equal(original.owner,'browser');assert.equal(f.scheduled.length,0);
  assert.ok(f.presentationSaves.every(record=>record.bounds.expectedGeneration===11));
  f.advanceGeneration();await f.presenter.retry();assert.equal(bound.isCurrent(),false);assert.ok(removals>=1);
  allowRemoval=true;await f.presenter.retry();assert.equal(shown,1,'retirement cannot create a successor visual');
  assert.deepEqual(presentationRows(f)[0].event,original.event);
 });
 await run('PRESENTER_WRITER_NEW: explicit nonnative control keeps void-save compatibility',async()=>{
  const f=await fixture({display:'denied',scheduleAuthorityFactory:createScheduleNotificationAuthority,presentationIsCurrent:()=>true});
  let bound;f.presenter.registerBrowser((payload,actions)=>{bound=actions;actions.onRetire(()=>true);return true;});await turn();
  assert.equal(await f.presenter.accept(event()),true);assert.equal(await bound.beginAudio(),true);
  assert.equal(await bound.finishAudio(true),true);assert.equal(presentationRows(f)[0].audioState,'completed');
 });
 await run('PRESENTER_WRITER_NEW: late native port result cannot adopt owner or start browser fallback',async()=>{
  let generation=11,nativeCalls=0,browserCalls=0,displayed=0;const saves=[],entered=deferred(),release=deferred();
  const presenter=createNotificationPresenter({identity:()=>principalIdentity(principal),requireNativeOwner:true,
   nativeStatus:()=>({ready:true,available:true,quarantined:false,generation,deviceId,principal}),nativeMode:()=>true,
   nativePresent:async()=>{nativeCalls++;entered.resolve();await release.promise;return true;},
   save:async(snapshot,canWrite,bounds)=>{assert.equal(canWrite(),true);assert.deepEqual(bounds,{expectedGeneration:11});saves.push(structuredClone(snapshot));},
   load:async()=>[],displayed:async()=>{displayed++;return true;},action:async()=>true});
  presenter.registerBrowser(()=>{browserCalls++;return true;});await turn();
  const pending=presenter.accept(event());await entered.promise;generation++;release.resolve();
  assert.equal(await pending,false);assert.equal(nativeCalls,1);assert.equal(browserCalls,0);assert.equal(displayed,0);
  assert.ok(saves.length>0);assert.ok(saves.every(row=>row.owner===null&&row.receiptRecorded!==true));
  await assert.rejects(presenter.accept(event()),/original native notification presentation owner unavailable/i);
  assert.equal(nativeCalls,1,'same in-flight entry is not rebound/resubmitted');
 });
 await run('PRESENTER_WRITER_NEW: current restart restores exact saved payload without persisting native generation',async()=>{
  const original=await setup();await original.presenter.accept(event());
  const row=presentationRows(original)[0];assert.ok(row);
  const restored=await setup({memory:original.memory,presentationIsCurrent:()=>true});let shown;
  restored.presenter.registerBrowser((payload,actions)=>{shown=payload;actions.onRetire(()=>true);return true;});
  await turn();await restored.presenter.retry();
  assert.deepEqual(shown,event());const after=presentationRows(restored)[0];
  assert.equal(after.queueOrdinal,row.queueOrdinal);assert.equal(after.scope,row.scope);assert.deepEqual(after.event,row.event);
  assert.equal(Object.hasOwn(after,'generation'),false);assert.equal(Object.hasOwn(after,'nativeStatus'),false);
  assert.equal(restored.scheduled.length,0);
 });
 console.log(JSON.stringify({scope:'actual presenter and existing bridge save; synthetic storage/native status/callback ports only',passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results,physical:false},null,2));
 if(results.some(r=>!r.pass))process.exitCode=1;
}

async function nativePermissionOwnerCases(){
 const before=process.argv.includes('--before-native-permission');
 const code=before?execFileSync('git',['show','e440d64a873b28ef5b14eda7311406b2958e0bf3:mobile/src/custodial/bridge.js'],{encoding:'utf8',maxBuffer:2*1024*1024}):bridge;
 const start=code.indexOf('  async function presentForegroundNotification('),end=code.indexOf('\n  async function registerPushToken(',start);
 const guard=code.indexOf('  function captureOriginalNotificationWriter(');
 assert.ok(start>=0&&end>start);
 const implementation=(guard>=0?code.slice(guard,start):'')+code.slice(start,end);
 const cases=['changed-generation','same-original','changed-original-payload'];
 const selected=process.argv.find(x=>x.startsWith('--native-permission-case='))?.split('=').slice(1).join('=');
 if(selected)assert.ok(cases.includes(selected));
 for(const name of cases.filter(x=>!selected||x===selected)){
  let enter,release,generation=11,scheduled=0;
  const entered=new Promise(r=>enter=r),waiting=new Promise(r=>release=r);
  const scope={console,JSON,Object,Number,principalIdentity,nativeVault:true,
   currentPrincipalIdentity:()=>principalIdentity(principal),currentPrincipal:()=>principal,deviceId:()=>deviceId,
   security:{native:true,getStatus:()=>({state:'enrolled',ready:true,available:true,quarantined:false,generation,deviceId,principal}),mutateProtectedWork(){}},
   notificationPresentation:{native:true,update(){}},custodialNotificationEnabled:()=>true,
   LocalNotifications:{checkPermissions:async()=>{enter();await waiting;return{display:'granted'};}},
   requiresBoundNotificationReceipt:()=>false,notificationChannel:()=> 'synthetic-only',
   nativeNotificationScheduler:{present:async()=>{scheduled++;return true;}}};
  vm.runInNewContext(implementation+'\nthis.present=presentForegroundNotification;',scope,{timeout:1000});
  const event={notification:{title:'Synthetic original',data:{kind:'employee_message'}}};
  const result=scope.present(event,principalIdentity(principal));
  await entered;if(name==='changed-generation')generation++;
  if(name==='changed-original-payload')event.notification.title='Must not replace the original';
  release();
  const observed=await result;
  assert.equal(scheduled,name==='same-original'?1:0,'old permission await must not invoke a successor scheduler');
  assert.equal(observed,name==='same-original');
  console.log('NATIVE_PERMISSION_OWNER_NEW '+name+': PASS (actual private bridge function, synthetic permission/status/OS port; no native effect)');
 }
}
export {fixture,principal,data,turn,schedulerForFixtureProfile};
if(permissionOwnerOnly)await nativePermissionOwnerCases();
