import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createNativeProviderMirrorBridge} from '../mobile/src/custodial/provider-mirror-bridge.js';
import {custodialNotificationEnabled,custodialProviderNotificationEnabled} from '../mobile/src/custodial/release-scope.js';
const f=JSON.parse(readFileSync(new URL('../mobile/plugins/custodial-native-vault/android/src/test/resources/native-schedule-wire.json',import.meta.url))),clone=x=>structuredClone(x);
const id='11111111-1111-4111-8111-111111111111';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
eq(f.actual_SQL_receipt,false);eq(f.native_qualified,false);
eq(custodialNotificationEnabled(f.payload),false,'legacy ingress never admits new protocol');
eq(custodialProviderNotificationEnabled(f.payload),true,'native claim inclusion alone is not authority');
const claim=p=>({claim_id:id,payload:p,play_audio:false,navigation_pending:false,historical:false});
let supplied=claim(clone(f.payload));
const bridge=createNativeProviderMirrorBridge({providerClaimNext:async()=>({claim:supplied})});
const accepted=await bridge.next(id);eq(accepted.payload,f.payload);eq(Object.isFrozen(accepted.payload),true);
supplied.payload.body='late caller mutation';eq(accepted.payload.body,f.payload.body);
for(const [field,value] of [['schema','custodial.native-message-payload.v1'],['route','messages.html?hub=employee'],['channel_id','employee-messages'],
 ['boundary_local','09:46'],['source_revision','0'],['source_reservation_id','not-stable'],['source_window_sha256','bad'],['notification_key','wrong-episode']]){
 supplied=claim(clone(f.payload));supplied.payload[field]=value;await assert.rejects(()=>bridge.next(id),/unavailable/);checks++;
}
for(const field of Object.keys(f.payload)){supplied=claim(clone(f.payload));delete supplied.payload[field];await assert.rejects(()=>bridge.next(id),/unavailable/);checks++;}
supplied=claim(clone(f.payload));supplied.payload.test_delivery='true';await assert.rejects(()=>bridge.next(id),/unavailable/);checks++;
const source=readFileSync(new URL('../memphis-device-reminders.js',import.meta.url),'utf8');
const from=source.indexOf('  function showAcceptedNotification('),to=source.indexOf('\n  function pickNextAlert(',from);assert.ok(from>=0&&to>from);
let rendered=null;
const context={URL,window:{location:{href:'https://localhost/employee-home.html'}},state:{currentDisplayName:'Synthetic current staff'},safeText:(x,fallback='')=>typeof x==='string'?x:fallback,
 showAlert:(value,accepted)=>{rendered={value,accepted};return true;}};
vm.createContext(context);vm.runInContext(source.slice(from,to)+'\nthis.render=showAcceptedNotification;',context);
const event={notification:{title:f.payload.title,body:f.payload.body,data:clone(f.payload)}};
eq(context.render(event),false,'unbound caller cannot use native renderer branch');
eq(context.render(event,()=>true),false,'a function alone is not a provider mirror claim');
const action=async()=>false;action.providerMirror=true;action.playAudio=false;
eq(context.render(event,action),true,'actual renderer function with explicitly simulated native claim');
eq(rendered.accepted,true);eq(rendered.value.notificationType,'schedule_ownership');eq(rendered.value.dismissLabel,'Dismiss');eq(rendered.value.openLabel,'Open schedule');
eq(rendered.value.openUrl,'https://localhost/employee-schedule.html?hub=employee');eq(rendered.value.speechText,f.payload.body);eq(rendered.value.boundReceiptAction,action);
for(const [field,value] of [['schema','legacy'],['notification_type','message'],['channel_id','employee-messages'],['route','https://external.invalid/']]){
 const bad=clone(event);bad.notification.data[field]=value;eq(context.render(bad,action),false);
}
console.log(JSON.stringify({status:'PASS',checks,scope:'Actual native-claim facade and renderer function with modeled claim/VM, not browser/device/receipt/physical audio proof',native_qualified:false,phone:false,browser_review:false}));
