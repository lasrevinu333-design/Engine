import {withoutReleaseAdmission} from './provider-release-admission-source-boundary.mjs';
import {withoutProviderNoWake} from './provider-no-wake-source-boundary.mjs';
// Focused integration regression; no real release profile is admitted.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createNativeProviderMirrorBridge} from '../mobile/src/custodial/provider-mirror-bridge.js';
import * as scope from '../mobile/src/custodial/release-scope.js';
import {requiredKindPins,validateRequiredKindPins,withoutRequiredKinds} from './provider-required-kind-source-boundary.mjs';

// Conditional native-claim fixtures, NOT server reservation, clock qualification,
// actual provider transport or permission to dispatch a legacy notification.
const id=n=>`77000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=value=>createHash('sha256').update(value).digest('hex');
const sign=value=>{delete value.content_sha256;value.content_sha256=sha(JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0))));return value;};
export function requiredKindFixture(kind){
 const event=kind==='employee_event';
 const value={schema:event?'custodial.native-event-payload.v1':'custodial.native-message-payload.v1',
  generation_id:id(1),principal_digest:'a'.repeat(64),token_digest:'b'.repeat(64),receipt_job_id:id(2),
  receipt_credential_id:id(3),receipt_employee_id:id(4),receipt_device_id:'KIOSK_08',receipt_assignment_epoch:'1',
  reservation_at:'2026-10-04T14:00:00.000000Z',valid_until:'2026-10-04T14:01:00.000000Z',
  kind,notification_type:event?'event':'message',title:event?'Assigned event reminder':'Operations Manager',
  body:'Karen, this is the exact original full message.',channel_id:event?'employee-events':'employee-messages',
  service_date:'2026-10-04',source_revision:'c'.repeat(64)};
 if(event)Object.assign(value,{event_id:id(5),instance_id:id(6),event_revision:'7',notification_kind:'shift_plus_15',recipient_device_uuid:id(7),
  notification_key:`event:${id(5)}:7:2026-10-04:${id(4)}:${id(7)}:1:shift_plus_15`,route:`events.html?hub=employee&event_id=${id(5)}`});
 else Object.assign(value,{message_id:id(5),thread_id:id(6),recipient_user_id:id(7),notification_key:`message:${id(5)}`,route:`messages.html?hub=employee&thread_id=${id(6)}`});
 return sign(value);
}
let checks=0;const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
check(requiredKindPins.files.length,4,'exact authorized product paths');
for(const row of requiredKindPins.files){
 const source=withoutProviderNoWake(row.name,readFileSync(new URL('../'+row.path,import.meta.url),'utf8'));
 check(sha(source),row.current_sha256,'current required-kind source is present');
 const prior=withoutRequiredKinds(row.name,source);check(sha(prior),row.prior_sha256,'whole original source recovered');
 check(withoutRequiredKinds(row.name,prior),prior,'exact predecessor idempotent');
 for(const changed of [source+'\n// outside owning change',source.slice(1),source.replace(row.hunks[0].after[0],row.hunks[0].after[0]+' ')]){
  assert.throws(()=>withoutRequiredKinds(row.name,changed));checks++;
 }
}
for(const mutate of [v=>v.extra=true,v=>v.files.pop(),v=>v.files.reverse(),v=>v.files.push(v.files[0]),
 v=>v.files[0].prior_sha256='0'.repeat(64),v=>v.files[0].hunks[0].after.push(''),v=>v.files[0].hunks[0].new_count++]){
 const changed=structuredClone(requiredKindPins);mutate(changed);assert.throws(()=>validateRequiredKindPins(changed));checks++;
}
async function claim(payload){
 const bridge=createNativeProviderMirrorBridge({async providerClaimNext(){return{claim:{claim_id:id(10),payload,play_audio:true,navigation_pending:false,historical:false}};}});
 return bridge.next(id(11));
}
for(const kind of ['employee_event','employee_message']){
 const value=requiredKindFixture(kind),result=await claim(value);
 check(result.payload,value,'qualified-claim facade supports exact '+kind);
 check(Object.isFrozen(result.payload),true,'immutable mirror copy');
 check(scope.custodialProviderNotificationEnabled(value),true,'separate exact native protocol inclusion');
 check(scope.custodialNotificationEnabled(value),false,'legacy FCM cannot acquire native admission');
 check(scope.custodialNotificationEnabled({kind,notification_key:value.notification_key,route:value.route}),false,'old unbound producer stays blocked');
 for(const field of Object.keys(value)){
  const missing={...value};delete missing[field];await assert.rejects(claim(missing),/attachment is unavailable/);checks++;
 }
 for(const mutate of [v=>v.extra='unreviewed',v=>v.kind='employee_lunch_coverage',v=>v.schema='custodial.native-provider-payload.v1',
  v=>v.receipt_assignment_epoch='01',v=>v.receipt_employee_id='foreign',v=>v.source_revision='not-a-digest',
  v=>v.route+='&device=KIOSK_09',v=>v.route='https://elsewhere.invalid/'+v.route,
  v=>v.notification_type='location_status',v=>v.channel_id='employee-lunch-coverage',v=>v.content_sha256=42]){
  const changed={...value};mutate(changed);await assert.rejects(claim(changed),/attachment is unavailable/);checks++;
 }
}
const event=requiredKindFixture('employee_event');
for(const [field,value] of [['event_id',id(90)],['recipient_device_uuid',id(91)],['event_revision','8'],['receipt_employee_id',id(92)],
 ['receipt_assignment_epoch','2'],['service_date','2026-10-05'],['notification_kind','test']]){
 const changed={...event,[field]:value};await assert.rejects(claim(changed),/attachment is unavailable/);checks++;
}
const message=requiredKindFixture('employee_message');
for(const [field,value] of [['message_id',id(90)],['thread_id',id(91)],['recipient_user_id','not-a-uuid']]){
 await assert.rejects(claim({...message,[field]:value}),/attachment is unavailable/);checks++;
}
// Execute the actual existing renderer function with a finite owning seam; no
// timers, DOM, speech engine, network, Java, APK or handset are involved.
const source=readFileSync(new URL('../memphis-device-reminders.js',import.meta.url),'utf8');
const start=source.indexOf('  function showAcceptedNotification('),end=source.indexOf('\n  function pickNextAlert(',start);
assert.ok(start>=0&&end>start);checks++;
const shown=[],context={URL,window:{location:{href:'https://localhost/index.html'}},state:{currentDisplayName:'Karen'},
 safeText:(v,fallback='')=>typeof v==='string'&&v?v:fallback,buildScheduleUrl:()=>{throw new Error('required kind used schedule fallback');},
 showAlert:value=>{shown.push(value);return true;}};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
const baseline=withoutRequiredKinds('memphis-device-reminders.js',source);
const baselineStart=baseline.indexOf('  function showAcceptedNotification(');
const baselineEnd=baseline.indexOf('\n  function pickNextAlert(',baselineStart);
assert.ok(baselineStart>=0&&baselineEnd>baselineStart);
const beforeContext={...context};vm.createContext(beforeContext);
vm.runInContext(baseline.slice(baselineStart,baselineEnd),beforeContext);
for(const kind of ['employee_event','employee_message']){
 const payload=requiredKindFixture(kind),action=Object.assign(()=>true,{providerMirror:true});
 check(beforeContext.showAcceptedNotification({notification:{title:payload.title,body:payload.body,data:payload}},action),false,'actual inherited renderer refuses '+kind+' before correction');
}
for(const kind of ['employee_event','employee_message']){
 const payload=requiredKindFixture(kind),event={notification:{title:payload.title,body:payload.body,data:payload}},action=Object.assign(()=>true,{providerMirror:true});
 check(context.showAcceptedNotification(event,action),true,'actual native-only renderer supports '+kind);
 const rendered=shown.at(-1);check(rendered.body,payload.body,'complete text unchanged');check(rendered.speechText,payload.body,'speech is same exact body');
 check(rendered.dismissLabel,'Dismiss','explicit pop-up dismissal remains outside chat creation');
 check(rendered.notificationType,payload.notification_type,'kind-specific receipt meaning');check(rendered.boundReceiptAction,action,'one original native capability');
 check(rendered.openUrl,new URL(payload.route,context.window.location.href).toString(),'original exact same-app destination');
 check(rendered.openLabel,kind==='employee_event'?'Open event':'Open message','honest destination label');
 for(const badAction of [null,()=>true,{providerMirror:false}])check(context.showAcceptedNotification(event,badAction),false,'no legacy/browser authority bypass');
 for(const data of [{...payload,schema:'custodial.native-provider-payload.v1'},{...payload,route:'https://elsewhere.invalid/'}])
  check(context.showAcceptedNotification({notification:{...event.notification,data}},action),false,'renderer rejects schema/route drift');
}
const runtime=withoutReleaseAdmission('CustodialNativeRuntime.java',readFileSync(new URL('../mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialNativeRuntime.java',import.meta.url),'utf8'));
assert.match(runtime,/Delivery\(NativeProviderTime.Profiles.NONE,/);checks++;
for(const type of ['NativeProviderIngressRuntime','NativeProviderComponentRuntime']){assert.match(runtime,new RegExp('return '+type+'\\.SUSPENDED;'));checks++;}
console.log(JSON.stringify({status:'REQUIRED_KIND_CONDITIONAL_CONSUMER_PASS',checks,synthetic:true,qualifiedClock:false,productionActivation:false,legacyAdmission:false}));
