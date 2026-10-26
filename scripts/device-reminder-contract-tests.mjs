import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const jsPath = process.env.REMINDER_SOURCE || path.resolve(scriptDir, '../memphis-device-reminders.js');
const source = fs.readFileSync(jsPath, 'utf8');

if (process.env.REMINDER_WRITER_CASE) {
  await reminderWriterCase(process.env.REMINDER_WRITER_CASE);
} else {
assert(!source.includes("/device-event-reminders?device_id="), 'Browser reminder polling must never fetch event notifications');
assert(!source.includes('function fetchReminders('), 'Event reminders must be delivered by the native notification client only');
assert(!source.includes('function reminderAlert('), 'The browser overlay must not reconstruct native event notifications');
assert(source.includes("/threads${qs}"), 'Reminder poller must also fetch thread summaries for message notifications');
assert(source.includes("state.currentUserId = safeText(data?.msg_user_id)"), 'Reminder poller must resolve the mapped device user before checking message threads');
assert(source.includes("Number(row?.unread_count || 0) > 0"), 'Reminder poller must alert only on unread message threads');
assert(source.includes("New direct message") || source.includes("Memphis message"), 'Reminder popups must identify unread Messenger threads');
assert(source.includes('window.fully?.textToSpeech'), 'Reminder popups must trigger Fully Kiosk spoken alerts when available');
assert(source.includes('speechSynthesis') && source.includes('SpeechSynthesisUtterance'), 'Reminder popups must also try browser speech synthesis to reinforce quiet TTS on phones');
assert(source.includes('for (let cycle = 0; cycle < 2; cycle += 1)'), 'Reminder popups must run exactly two chime-and-speech cycles');
assert(source.includes('Hey ${first}') || source.includes('Hey ${first}, '), 'Reminder popups must personalize spoken alerts with the employee first name when known');
assert(source.includes('window.fully?.playSound') || source.includes('window.fully?.playAudio'), 'Reminder popups must try Fully Kiosk native sound playback when available');
assert(source.includes("RINGTONE_HOSTED_FILE: 'memphis-alert-tone.wav?v=release-2026.07.19.custodial-v3.12'"), 'Reminder popups must ship the selected hosted fleet ringtone asset');
assert(source.includes('function createRingtoneWaveform'), 'Reminder popups must generate the same fleet ringtone waveform for inline fallback playback');
assert(source.includes('RINGTONE_REPEAT_COUNT: 1'), 'Each notification cycle must play one chime');
assert(source.includes('ALERT_POST_RINGTONE_DELAY_MS: 900'), 'Reminder popups must leave a short clean gap after the alert sound before voice starts');
assert(source.includes('RINGTONE_ESTIMATED_DURATION_MS') && source.includes('CONFIG.RINGTONE_ESTIMATED_DURATION_MS + CONFIG.ALERT_POST_RINGTONE_DELAY_MS'), 'Reminder sequencer must wait through the alert sound duration plus the 2s post-ring gap before voice starts');
assert(source.includes('ALERT_OPEN_GRACE_MS: 1800'), 'Opening an alert must allow a short speech grace period before navigation');
assert(source.includes('debugShowSampleAlert') && source.includes('testReminder'), 'Reminder popups must expose a safe debug trigger for on-device validation');
assert(source.includes('new Audio(hostedUrl)'), 'Reminder popups must preload the hosted ringtone asset for kiosk/browser playback');
assert(source.includes('const fullySources = [hostedUrl, dataUrl];'), 'Reminder popups must force the same hosted/data ringtone sources on every phone');
assert(source.includes("const prefersStreamingApi = /^(?:https?:|data:)/i.test(String(source || ''));"), 'Fully playback must recognize hosted/data ringtone URLs separately from file paths');
assert(source.includes('playViaFullyJs(fullySources)') && source.includes('|| playViaHtmlAudio(hostedUrl)') && source.includes('|| playViaHtmlAudio(dataUrl)') && source.includes('|| playViaWebAudio();'), 'Ringtone playback must fall back through Fully, hosted HTML audio, inline HTML audio, and WebAudio in that order');
assert(source.includes('navigator.vibrate?.'), 'Reminder popups must vibrate when supported');
assert(source.includes('body.mz-reminder-active #kiosk-lock-screen'), 'Reminder popup styling must hide the kiosk lock screen while the alert is open');
assert(source.includes('setReminderPresentationActive(true);'), 'Reminder popup must activate lock-screen suppression while visible');
assert(source.includes('setReminderPresentationActive(false);'), 'Reminder popup must restore the normal lock-screen state when closed');
assert(source.includes("sessionStorage.getItem(CONFIG.ALERT_LOCK_KEY) === alert.id"), 'A reloaded alert must recognize its existing presentation lease');
assert(source.includes('if (!alreadyPresented) fullyKioskNudge(alert);'), 'Reload must restore the alert card without replaying its audio sequence');
assert(source.includes('if (!isEmployeeNotificationContext()) return;'), 'Shared manager Messenger must not activate the employee reminder poller');
assert(source.includes("const acknowledged = await acknowledgeAlert(alert, 'opened');\n      markAlertSeenIfAcknowledged(alert, acknowledged);"), 'Open must suppress an alert only after a successful acknowledgement');
assert(source.includes("const acknowledged = await acknowledgeAlert(alert, 'dismissed');\n      markAlertSeenIfAcknowledged(alert, acknowledged);"), 'Dismiss must suppress an alert only after a successful acknowledgement');
assert(source.includes("if (!alert?.notificationKey) return true;\n    if (!state.deviceId) return false;"), 'Thread alerts may be local-only, but backend notifications must fail closed without device authority');
assert(source.includes('await waitForActiveAlertSpeech();') && source.includes('closeActiveAlert({ stopSpeech: false });') && source.includes('window.location.href = destination;'), 'Opening an alert must wait for the current speech sequence before navigating without cutting it off');
assert(source.includes('const sequence = startAlertAudioSequence(text)') && source.includes('state.activeSequencePromise = sequence;'), 'Alert playback must run through one tracked ringtone-then-voice sequence');
assert(source.includes('function normalizePersonalizedSpeechText'), 'All spoken alert paths must use a central duplicate-name speech normalizer');
assert(source.includes('normalizePersonalizedSpeechText(rawText, alert?.speakerName || state.currentDisplayName)'), 'Fully Kiosk voice playback must de-duplicate final speech text before speaking');
assert(source.includes('speakerName,'), 'Alert objects must carry the intended employee name for central speech de-duplication');
assert(source.includes('stopActiveRingtone();') && source.includes('state.activeSpeechPromise = speakOnce(normalized)'), 'Alert playback must stop the ring before starting one tracked speech operation');
assert(source.includes('const played = playViaFullyJs(fullySources)') && source.includes('|| playViaHtmlAudio(hostedUrl)') && source.includes('|| playViaHtmlAudio(dataUrl)') && source.includes('|| playViaWebAudio();'), 'Ringtone playback must use one fallback chain instead of layered simultaneous playback');
assert(!source.includes('const fullySpoken = fullySpeak(normalized);\n      const browserSpoken = speakViaBrowser(normalized);'), 'Speech playback must not launch Fully TTS and browser TTS simultaneously');
assert(!source.includes('const played = [\n      playViaFullyJs(fullySources),\n      playViaHtmlAudio(dataUrl),\n      playViaWebAudio()\n    ].some(Boolean);'), 'Ringtone playback must not launch all audio engines at once');

assert(source.includes('function objectMetadata'), 'Reminder renderer must parse backend metadata from event rows and thread summaries');
assert(source.includes('last_message_metadata_json'), 'Thread fallback alerts must see last-message metadata so presentation demos do not degrade to generic Ops Manager messages');

const harnessSource = source.replace(
  /\n\}\)\(\);\s*$/,
  '\n  window.__speechTest = { normalizePersonalizedSpeechText, stripLeadingNameForSpeech, locationStatusAlert, threadAlert, markAlertSeenIfAcknowledged, hasSeenId };\n})();\n'
);

const noop = () => {};
const storage = new Map();
const context = {
  console,
  URL,
  window: {
    location: { href: 'https://example.test/employee-hub.html?device=KIOSK_10' },
    addEventListener: noop,
    setTimeout: noop,
    setInterval: noop,
    clearTimeout: noop
  },
  document: {
    readyState: 'loading',
    addEventListener: noop
  },
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    key: (index) => Array.from(storage.keys())[index] || null,
    get length() { return storage.size; }
  },
  sessionStorage: { getItem: () => '', setItem: noop, removeItem: noop },
  navigator: { vibrate: noop },
  Audio: class Audio {},
  SpeechSynthesisUtterance: class SpeechSynthesisUtterance {}
};
context.window.window = context.window;
vm.runInNewContext(harnessSource, context, { filename: jsPath });

const {
  normalizePersonalizedSpeechText,
  locationStatusAlert,
  threadAlert,
  markAlertSeenIfAcknowledged,
  hasSeenId
} = context.window.__speechTest;

const recoverableAlert = {
  id: 'location-alert-1',
  linkedIds: ['location-alert-linked-1'],
  notificationKey: 'location-status:2026-08-12:KIOSK_02:AQUARIUM'
};
assert.equal(markAlertSeenIfAcknowledged(recoverableAlert, false), false);
assert.equal(hasSeenId(recoverableAlert.id), false, 'failed acknowledgement must keep the primary alert recoverable');
assert.equal(hasSeenId(recoverableAlert.linkedIds[0]), false, 'failed acknowledgement must keep linked alert evidence recoverable');
assert.equal(markAlertSeenIfAcknowledged(recoverableAlert, true), true);
assert.equal(hasSeenId(recoverableAlert.id), true);
assert.equal(hasSeenId(recoverableAlert.linkedIds[0]), true);
const localThreadAlert = { id: 'thread-alert-1', linkedIds: [] };
assert.equal(markAlertSeenIfAcknowledged(localThreadAlert, false), true, 'local-only thread alerts do not require a notification acknowledgement');
assert.equal(hasSeenId(localThreadAlert.id), true);
const demoLocationAlert = locationStatusAlert({
  message_id: 'demo-message-1',
  service_date: '2026-06-11',
  status_code: 'due_soon',
  form_type: 'restroom',
  group_code: 'SPLASH_PAD_RESTROOMS',
  group_name: 'Splash Pad Restrooms',
  location_code: 'SPLASH_PAD_RESTROOMS',
  location_name: 'Splash Pad Restrooms',
  employee_name: 'Daniel Morgan'
});
assert.equal(demoLocationAlert.kicker, 'Assigned location due soon');
assert.equal(demoLocationAlert.title, 'Splash Pad Restrooms is due soon');
assert.equal(demoLocationAlert.speechText, 'Hey Daniel, Splash Pad Restrooms is due soon. Please check it soon.');

const demoThreadFallbackAlert = threadAlert({
  thread_id: 'thread-2',
  thread_type: 'direct',
  thread_title: 'Ops Manager',
  unread_count: 1,
  last_message_id: 'demo-message-2',
  last_sender_name: 'Ops Manager',
  last_message_body: "Jennifer, demo assigned location alert: East Admin Women's Restroom is overdue on your route.",
  last_message_type: 'bot_response',
  last_message_metadata_json: {
    presentation_demo: true,
    demo_alert_kind: 'location_status',
    service_date: '2026-06-11',
    status_code: 'overdue',
    form_type: 'restroom',
    group_code: 'EAST_ADMIN',
    group_name: 'East Admin',
    location_code: 'EADW',
    location_name: "East Admin Women's Restroom",
    employee_name: 'Jennifer Sheffield'
  }
});
assert.equal(demoThreadFallbackAlert.kicker, 'Assigned location overdue');
assert.equal(demoThreadFallbackAlert.title, "East Admin Women's Restroom is overdue");
assert.equal(demoThreadFallbackAlert.speechText, "Hey Jennifer, East Admin Women's Restroom is overdue and needs attention now.");
assert.notEqual(demoThreadFallbackAlert.speechText, 'Hey Jennifer, Ops Manager sent you a new message.', 'Presentation demos must never fall back to generic Ops Manager TTS');

assert.equal(
  normalizePersonalizedSpeechText('Hey Sherita, Sherita Herpetarium is due soon.', 'Sherita Wilbon'),
  'Hey Sherita, Herpetarium is due soon.'
);
assert.equal(
  normalizePersonalizedSpeechText('Hey Sherita, Sherita Wilbon, Herpetarium is overdue.', 'Sherita Wilbon'),
  'Hey Sherita, Herpetarium is overdue.'
);
assert.equal(
  normalizePersonalizedSpeechText('Sherita Herpetarium is due soon.', 'Sherita Wilbon'),
  'Hey Sherita, Herpetarium is due soon.'
);
assert.equal(
  normalizePersonalizedSpeechText('Hey Kinnaye, Kinnaye Elephant Trunk Gift Shop is due soon.', 'Kinnaye Peete'),
  'Hey Kinnaye, Elephant Trunk Gift Shop is due soon.'
);

console.log(JSON.stringify({
  ok: true,
  checked: [
    'native_event_notifications_not_browser_polled',
    'thread_unread_notifications_polled',
    'device_identity_lookup',
    'audible_alerts',
    'fully_kiosk_speech',
    'location_status_body_spoken_for_samples',
    'presentation_demo_location_alerts',
    'presentation_demo_thread_metadata_fallback',
    'central_duplicate_name_speech_guard',
    'duplicate_thread_alert_suppression',
    'acknowledgement_before_local_suppression',
    'failed_acknowledgement_recovery',
    'sequential_ringtone_voice_playback',
    'single_alert_instance_with_speech_completion_grace'
  ]
}, null, 2));
}

async function reminderWriterCase(name) {
  const {webcrypto} = await import('node:crypto');
  const {getCustodialBridgeSecurityRuntime} = await import('../mobile/src/custodial/security-runtime.js');
  const {createRawStorageAdapter} = await import('../mobile/src/custodial/storage-firewall.js');
  const {CUSTODIAL_DEVICE_KEYS,CUSTODIAL_INSTALLATION_MARKER_KEY,CUSTODIAL_INSTALLATION_RECORD_KEY} =
    await import('../mobile/src/custodial/credential-store.js');
  const HOLD='mz_custodial_protected_browser_hold.v1', PREFIX='mz_program_alert_seen:';
  const id=n=>'ab000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',
    employee_id:id(1),credential_id:id(2),credential_operation_id:id(3),assignment_epoch:7,
    installation_seal:'SYNTHETIC_INSTALLATION_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
  let fault='',releaseLock,waiting=false,lockOwned=false,changes=[];
  class Storage {
    constructor(){this.data=new Map();}
    get length(){return this.data.size;}
    key(i){return [...this.data.keys()][i]??null;}
    getItem(k){
      if(fault==='device-read'&&k==='mz_scan_device_id')throw Error('Synthetic identity storage unreadable');
      const value=this.data.get(k)??null;
      if(fault==='readback-hold'&&k.startsWith(PREFIX)&&k.endsWith(':ts')&&value!==null)
        raw.setItem(HOLD,'{hold changed at storage readback');
      return value;
    }
    setItem(k,v){
      if(k.startsWith(PREFIX)&&fault==='throw')throw Error('Synthetic durable storage unavailable');
      if(k.startsWith(PREFIX)&&fault==='drop')return;
      if(k.startsWith(PREFIX))changes.push(['set',k]);
      this.data.set(k,String(v));
      if(k.startsWith(PREFIX)&&fault==='mid-hold')raw.setItem(HOLD,'{hold during pair write');
    }
    removeItem(k){if(fault==='prune-denied'&&k.startsWith(PREFIX))throw Error('Synthetic original suppression removal denied');changes.push(['remove',k]);this.data.delete(k);}
    clear(){this.data.clear();}
  }
  const storage=new Storage(),raw=createRawStorageAdapter(storage),secure=new Map();
  for(const k of CUSTODIAL_DEVICE_KEYS)raw.setItem(k,principal.device_id);
  raw.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY,principal.installation_seal);
  secure.set(CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify({schema_version:1,
    credential:'SYNTHETIC_NOT_A_DEVICE_CREDENTIAL',device_id:principal.device_id,
    installation_seal:principal.installation_seal,enrolled_at:principal.enrolled_at,principal}));
  const locks={async request(name,options,callback){
    assert.equal(lockOwned,false,'No nested admission');
    if(waiting)await new Promise(r=>{releaseLock=r;});
    lockOwned=true;try{return await callback({name,mode:options.mode});}finally{lockOwned=false;}
  }};
  const runtime=getCustodialBridgeSecurityRuntime({storage,locks,cryptoApi:webcrypto,
    indexedDb:{databases:async()=>[]},
    secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
  await runtime.security.ready;assert.equal(runtime.security.getStatus().ready,true);
  let currentPrincipal=JSON.stringify(runtime.security.getStatus().principal);
  const effects=[];
  const element=()=>({listeners:{},disabled:false,textContent:'',setAttribute(){},appendChild(){},
    addEventListener(n,fn){this.listeners[n]=fn;},remove(){card=null;}});
  let card=null;const children=new Map();
  const document={readyState:'loading',hidden:false,addEventListener(){},getElementById:()=>true,
    querySelector:()=>card,head:{appendChild(){}},body:{dataset:{memphisContext:'employee'},
      classList:{toggle(){}},appendChild(v){card=v;}},createElement(){
        const node=element();node.querySelector=key=>{if(!children.has(key))children.set(key,element());return children.get(key);};return node;}};
  const window={location:{href:'https://synthetic.invalid/employee-hub.html?device=KIOSK_08'},
    MemphisCustodialSecurity:runtime.security,MemphisMobile:{principalIdentity:()=>currentPrincipal},
    setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,addEventListener(){}};
  const session=new Map();
  const context={window,document,localStorage:storage,
    sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)},
    console:{warn:(...x)=>effects.push(x)},URL,Date,Math,Map,Set,WeakMap,WeakSet,Number,JSON,
    setTimeout:()=>1,setInterval:()=>1,clearTimeout(){},crypto:webcrypto,
    navigator:{vibrate(){}},Audio:class{play(){return Promise.resolve();}pause(){}},
    SpeechSynthesisUtterance:class{},fetch:async()=>{throw Error('No transport in writer qualification');}};
  const testSource=source.replace(/\n\}\)\(\);\s*$/,
    '\nwindow.__writer={state,persistDeviceId,markSeenId,markAlertSeenIfAcknowledged,cleanupStaleSeenKeys,showAlert,hasSeenId,captureReminderWriterAuthority:typeof captureReminderWriterAuthority==="function"?captureReminderWriterAuthority:null};\n})();');
  vm.runInNewContext(testSource,context,{filename:jsPath});
  const ui=window.__writer;Object.assign(ui.state,{deviceId:'KIOSK_08',currentUserId:id(1),
    currentDisplayName:'Synthetic Employee',identityPrincipal:currentPrincipal});
  const alert={id:'thread:original-recipient:message',linkedIds:[],currentAuthority:()=>true};
  const token=()=>ui.captureReminderWriterAuthority?.('KIOSK_08',true);
  changes=[];
  try {
    if(name==='device-storage-uninspectable') {
      window.MemphisCustodialSecurity=Object.freeze({...runtime.security,native:false});
      fault='device-read';
      assert.equal(await ui.persistDeviceId('kiosk8'),'');assert.equal(changes.length,0);
    } else if(name==='device-api-current'||name==='device-api-hold'||name==='device-api-reassignment') {
      // Exercise the non-native consumer branch; all admission/status methods
      // still delegate to the actual runtime, not an injected authorization bool.
      window.MemphisCustodialSecurity=Object.freeze({...runtime.security,native:false});
      const before=[...storage.data];
      if(name==='device-api-hold')raw.setItem(HOLD,'{retained browser hold');
      if(name==='device-api-reassignment')waiting=true;
      const writing=ui.persistDeviceId('kiosk8');
      if(name==='device-api-reassignment'){
        await new Promise(r=>setImmediate(r));
        raw.setItem('memphisAssignedDeviceId','KIOSK_09');releaseLock?.();waiting=false;
      }
      assert.equal(await writing,name==='device-api-current'?'KIOSK_08':'');
      assert.equal(storage.getItem('mz_scan_device_id'),'KIOSK_08');
      assert.equal(changes.length,0,'No public credential-store binding overwrite');
      if(name==='device-api-current')assert.deepEqual([...storage.data],before);
    } else if(name==='open-saved'||name==='open-late-reassignment') {
      session.set('mz_program_alert_lock',alert.id);
      window.setTimeout=callback=>{
        if(name==='open-late-reassignment') {
          currentPrincipal=JSON.stringify({...principal,employee_id:id(9),assignment_epoch:8});
          ui.state.currentUserId=id(9);ui.state.authorityGeneration++;
        }
        queueMicrotask(callback);return 1;
      };
      const originalUrl=window.location.href;
      assert.equal(ui.showAlert({...alert,body:'Synthetic original notice'}),true);
      await children.get('.mz-reminder-open').listeners.click();
      assert.equal(card,null);
      if(name==='open-saved')assert.match(window.location.href,/messages\.html/);
      else assert.equal(window.location.href,originalUrl,'Old recipient cannot navigate after the UI await');
    } else if(name==='dismiss-saved'||name==='dismiss-pending'||name==='old-dismiss-reassignment'||name==='old-dismiss-alert-id') {
      session.set('mz_program_alert_lock',alert.id); // Reloaded visual, no audio replay.
      assert.equal(ui.showAlert({...alert,body:'Synthetic original notice'}),true);
      const originalCard=card;
      if(name==='dismiss-pending')fault='drop';
      if(name==='old-dismiss-reassignment') {
        currentPrincipal=JSON.stringify({...principal,employee_id:id(9),assignment_epoch:8});
        ui.state.currentUserId=id(9);ui.state.authorityGeneration++;
      }
      if(name==='old-dismiss-alert-id')ui.state.activeAlert.id='foreign-recipient-message';
      await children.get('.mz-reminder-dismiss').listeners.click();
      if(name==='dismiss-pending') {
        assert.equal(card,originalCard);assert.equal(children.get('.mz-reminder-dismiss').disabled,false);
        assert.match(children.get('.mz-reminder-body').textContent,/unconfirmed.*pending/);
      } else assert.equal(card,null);
      assert.equal(storage.getItem(PREFIX+alert.id),name==='dismiss-saved'?'1':null);
    } else if(name==='mid-pair-hold'||name==='readback-hold-before-flag') {
      fault=name==='mid-pair-hold'?'mid-hold':'readback-hold';
      assert.equal(await ui.markAlertSeenIfAcknowledged(alert,true,token()),false);
      assert.equal(storage.getItem(PREFIX+alert.id),null);
      assert.ok(storage.getItem(PREFIX+alert.id+':ts')); // Retain uncertain original, no cleanup rollback.
    } else if(name==='owned-prune'||name==='prune-storage-denied') {
      raw.setItem(PREFIX+'foreign','1');raw.setItem(PREFIX+'foreign:ts','1');
      for(let i=0;i<201;i++){
        if(i===200&&name==='prune-storage-denied')fault='prune-denied';
        assert.equal(await ui.markAlertSeenIfAcknowledged({...alert,id:'own:'+i},true,token()),i!==200||name!=='prune-storage-denied');
      }
      assert.equal(storage.getItem(PREFIX+'foreign'),'1');assert.equal(storage.getItem(PREFIX+'foreign:ts'),'1');
      assert.equal(storage.getItem(PREFIX+'own:0'),name==='owned-prune'?null:'1');
      assert.equal(storage.getItem(PREFIX+'own:0:ts')===null,name==='owned-prune');
      assert.equal(storage.getItem(PREFIX+'own:200'),'1');
    } else if(name==='bound-receipt-no-legacy-write') {
      const action=()=>true;action.isCurrent=()=>true;
      assert.equal(await ui.markAlertSeenIfAcknowledged({...alert,boundReceiptAction:action},true),true);
      assert.equal(changes.length,0);
    } else if(name==='unknown-principal') {
      currentPrincipal='';
      assert.equal(await ui.markAlertSeenIfAcknowledged(alert,true,token()),false);
      assert.equal(changes.length,0);
    } else if(name==='seen-hold') {
      raw.setItem(HOLD,'{retained unknown hold');
      const before=[...storage.data];const result=await ui.markAlertSeenIfAcknowledged(alert,true,token());
      assert.equal(result,false);assert.deepEqual([...storage.data],before);assert.equal(changes.length,0);
    } else if(name==='prune-hold'||name==='foreign-prune') {
      for(let i=0;i<201;i++){raw.setItem(PREFIX+'foreign:'+i,'1');raw.setItem(PREFIX+'foreign:'+i+':ts',String(i+1));}
      changes=[];const before=[...storage.data];if(name==='prune-hold')raw.setItem(HOLD,'{retained hold');
      await ui.cleanupStaleSeenKeys();
      assert.equal(changes.length,0);assert.deepEqual([...storage.data].filter(([k])=>k.startsWith(PREFIX)),before.filter(([k])=>k.startsWith(PREFIX)));
    } else if(name==='queued-reassignment'||name==='queued-alert-identity') {
      waiting=true;
      const original=token();const writing=ui.markAlertSeenIfAcknowledged(alert,true,original);
      await new Promise(r=>setImmediate(r));
      if(name==='queued-reassignment'){
        currentPrincipal=JSON.stringify({...principal,employee_id:id(9),assignment_epoch:8});
        ui.state.currentUserId=id(9);ui.state.authorityGeneration++;
      } else alert.id='foreign-recipient-message';
      releaseLock?.();waiting=false;
      assert.equal(await writing,false);assert.equal(changes.length,0);
    } else if(name==='missing-api-device') {
      window.MemphisCustodialSecurity=undefined;
      const before=[...storage.data];assert.equal(await ui.persistDeviceId('kiosk8'),'');
      assert.deepEqual([...storage.data],before);
    } else if(name==='admitted-seen'||name==='failed-storage'||name==='memory-only-storage') {
      fault=name==='failed-storage'?'throw':name==='memory-only-storage'?'drop':'';
      const result=await ui.markAlertSeenIfAcknowledged(alert,true,token());
      assert.equal(result,name==='admitted-seen');
      if(name==='admitted-seen'){assert.equal(ui.hasSeenId(alert.id),true);assert.equal(storage.getItem(PREFIX+alert.id),'1');}
      else assert.equal(storage.getItem(PREFIX+alert.id),null);
    } else if(name==='changed-original-pair') {
      raw.setItem(PREFIX+alert.id,'unknown-original');raw.setItem(PREFIX+alert.id+':ts','unclassified');
      changes=[];const before=[...storage.data];
      assert.equal(await ui.markAlertSeenIfAcknowledged(alert,true,token()),false);
      assert.deepEqual([...storage.data],before);assert.equal(changes.length,0);
    } else if(name==='native-device-read') {
      const before=[...storage.data];assert.equal(await ui.persistDeviceId('kiosk8'),'KIOSK_08');
      assert.deepEqual([...storage.data],before);assert.equal(changes.length,0);
    } else throw Error('Unknown owning case '+name);
    console.log(JSON.stringify({case:name,result:'PASS',scope:'actual reminder producer and actual security runtime/admission with synthetic storage/locks; no browser/native/provider proof'}));
  } finally {releaseLock?.();assert.equal(lockOwned,false);}
}
