import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {CUSTODIAL_RELEASE_CAPABILITIES,deferredCustodialFeature,custodialNotificationEnabled} from '../mobile/src/custodial/release-scope.js';
import {custodialDeferredPage,custodialInitialReleaseHome} from '../mobile/scripts/custodial-initial-release-pages.mjs';
import {fixture,principal} from './native-notification-arrival-boundary-tests.mjs';
import {principalIdentity} from '../mobile/src/custodial/protected-principal.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
let checks=0;const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const original=read('mobile/src/custodial/index.html'),home=custodialInitialReleaseHome(original);
// October2 complete-system supersedes only disabled-shell expectations.
check(home,original,'all Home source bytes, artwork and facts preserved');
check((home.match(/class="homeButton deferredFeature" disabled aria-disabled="true"/g)||[]).length,0,'no manufactured disabled buttons');
check((home.match(/<a class="homeButton"/g)||[]).length,4,'four enabled source navigation entries');
assert.match(home,/<a class="homeButton" href="\.\/employee-schedule.html\?hub=employee">/);checks++;
check((home.match(/class="memphisHome"/g)||[]).length,1,'direct in-app Memphis preserved');
check(home.includes('deferredFeature'),false,'no deferred styling injected');
for(const feature of ['cleaning','schedule','messenger','events','feedback'])check(CUSTODIAL_RELEASE_CAPABILITIES[feature],true,'included '+feature);
for(const id of ['home-guest-count','home-shift','home-lunch','home-schedule-freshness','employee-name','phone-lock','home-current-weather','home-clock']){
 // IDs not present in the source are not invented by this transform.
 check(home.includes(`id="${id}"`),original.includes(`id="${id}"`),'preserved actual Home marker '+id);
}
check(read('mobile/src/custodial/index.html'),original,'frozen owning Home source unchanged');
assert.throws(()=>custodialInitialReleaseHome(original.replace('class="homeButton"','class="missing"')));checks++;
for(const file of ['messages.html','messages-chatscope.html','thread.html','employee-events.html','events.html','employee-feedback.html','system-feedback.html']){
 check(custodialDeferredPage(file),null,'included page must not become a stub '+file);
}
check(custodialDeferredPage('scan.html'),null);check(custodialDeferredPage('employee-schedule.html'),null);
check(custodialDeferredPage('events.html'),custodialDeferredPage('employee-events.html'),'alias exact bytes');
check(custodialDeferredPage('system-feedback.html'),custodialDeferredPage('employee-feedback.html'),'feedback alias exact bytes');
check(Object.isFrozen(CUSTODIAL_RELEASE_CAPABILITIES),true);
const bridge=read('mobile/src/custodial/bridge.js'),begin=bridge.indexOf('  function safeNativeRoute('),end=bridge.indexOf('  function routeProtectedRecovery(',begin);
const context={URL,location:{href:'https://localhost/index.html',origin:'https://localhost'},deviceId:()=> 'KIOSK_08',deferredCustodialFeature};
vm.createContext(context);vm.runInContext(bridge.slice(begin,end),context);
for(const [route,path] of [['messages.html','messages.html'],['thread.html','thread.html'],['events.html?hub=employee','employee-events.html'],['system-feedback.html','employee-feedback.html'],['employee-feedback.html','employee-feedback.html']])
 check(new URL(context.safeNativeRoute(route)).pathname,'/'+path,'included route stays in canonical employee page '+route);
for(const route of ['https://elsewhere.invalid/employee-schedule.html','javascript:alert(1)','intent://settings','admin.html'])check(context.safeNativeRoute(route),'','unapproved route stays blocked '+route);
check(new URL(context.safeNativeRoute('employee-schedule.html')).pathname,'/employee-schedule.html');
check(custodialNotificationEnabled({kind:'employee_event'}),false);check(custodialNotificationEnabled({kind:'employee_message'}),false);
check(custodialNotificationEnabled({kind:'employee_lunch_coverage'}),true);
const f=await fixture(),ui=f.fullBrowser();
for(const kind of ['employee_message','employee_event'])await f.emit('firebase','notificationReceived',{notification:{title:'Deferred',body:'Must not show',data:{kind,notification_key:kind}}});
check(f.scheduled.length,0,'actual deferred push arrivals not presented');check(ui.active,false,'no browser fallback bypass');
assert.match(bridge,/saveEmployeeFeedback:body=>CUSTODIAL_RELEASE_CAPABILITIES.feedback\?feedbackOutbox.save\(body\)/);checks++;
assert.match(bridge,/flushEmployeeFeedback:\(\)=>CUSTODIAL_RELEASE_CAPABILITIES.feedback\?feedbackOutbox.flush\(\)/);checks++;
const scope=principalIdentity(principal),old={schema_version:'native-notification-schedule.v1',id:42,scope,state:'scheduled',
 notification:{id:42,title:'Saved message',extra:{kind:'employee_message',native_presentation_principal:scope,native_presentation_id:'42'}}};
const memory=new Map([['receipt:schedule:42',JSON.stringify(old)],['saved-feedback-history','"preserved"']]);
const recovered=await fixture({memory});
check(JSON.parse(memory.get('receipt:schedule:42')).state,'cancelled','old owned deferred notification retired on restart');
check(memory.get('saved-feedback-history'),'"preserved"','existing unrelated saved data retained');
check(recovered.cancelled.length,1,'exact existing owned OS ID cancelled, no blanket cancel');
console.log(JSON.stringify({ok:true,checks,scope:'complete source UI; unqualified provider effects remain blocked; no app build or phone runtime acceptance'}));
