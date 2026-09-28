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
check((home.match(/class="homeButton deferredFeature" disabled aria-disabled="true"/g)||[]).length,3,'three genuine disabled buttons');
check((home.match(/<a class="homeButton"/g)||[]).length,1,'one enabled navigation entry');
assert.match(home,/<a class="homeButton" href="\.\/employee-schedule.html\?hub=employee">/);checks++;
check(home.includes('id="home-memphis"'),false,'no alternate Memphis entry bypass');
assert.match(home,/filter:grayscale\(1\)/);checks++;
for(const id of ['home-guest-count','home-shift','home-lunch','home-schedule-freshness','employee-name','phone-lock','home-current-weather','home-clock']){
 // IDs not present in the source are not invented by this transform.
 check(home.includes(`id="${id}"`),original.includes(`id="${id}"`),'preserved actual Home marker '+id);
}
check(read('mobile/src/custodial/index.html'),original,'frozen owning Home source unchanged');
assert.throws(()=>custodialInitialReleaseHome(original.replace('class="homeButton"','class="missing"')));checks++;
for(const file of ['messages.html','messages-chatscope.html','thread.html','employee-events.html','events.html','employee-feedback.html','system-feedback.html']){
 const page=custodialDeferredPage(file);assert.ok(page);checks++;
 check((page.match(/<script/g)||[]).length,1,'only protected bridge boots on '+file);
 check(page.includes('href="./index.html"'),true,'local Home recovery on '+file);
 check(/fetch\(|textarea|<form|chatscope|memphis-device-reminders/.test(page),false,'no deferred product runtime on '+file);
}
check(custodialDeferredPage('scan.html'),null);check(custodialDeferredPage('employee-schedule.html'),null);
check(custodialDeferredPage('events.html'),custodialDeferredPage('employee-events.html'),'alias exact bytes');
check(custodialDeferredPage('system-feedback.html'),custodialDeferredPage('employee-feedback.html'),'feedback alias exact bytes');
check(Object.isFrozen(CUSTODIAL_RELEASE_CAPABILITIES),true);
const bridge=read('mobile/src/custodial/bridge.js'),begin=bridge.indexOf('  function safeNativeRoute('),end=bridge.indexOf('  function routeProtectedRecovery(',begin);
const context={URL,location:{href:'https://localhost/index.html',origin:'https://localhost'},deviceId:()=> 'KIOSK_08',deferredCustodialFeature};
vm.createContext(context);vm.runInContext(bridge.slice(begin,end),context);
for(const route of ['messages.html','thread.html','events.html?hub=employee','system-feedback.html','employee-feedback.html','https://elsewhere.invalid/employee-schedule.html'])
 check(context.safeNativeRoute(route),'','blocked exact old/deferred route '+route);
check(new URL(context.safeNativeRoute('employee-schedule.html')).pathname,'/employee-schedule.html');
check(custodialNotificationEnabled({kind:'employee_event'}),false);check(custodialNotificationEnabled({kind:'employee_message'}),false);
check(custodialNotificationEnabled({kind:'employee_lunch_coverage'}),true);
const f=await fixture(),ui=f.fullBrowser();
for(const kind of ['employee_message','employee_event'])await f.emit('firebase','notificationReceived',{notification:{title:'Deferred',body:'Must not show',data:{kind,notification_key:kind}}});
check(f.scheduled.length,0,'actual deferred push arrivals not presented');check(ui.active,false,'no browser fallback bypass');
await assert.rejects(f.mobile.saveEmployeeFeedback({message:'Do not send'}),/not enabled/);checks++;
check(Array.from(await f.mobile.flushEmployeeFeedback()),[],'deferred feedback flush is idle');
const scope=principalIdentity(principal),old={schema_version:'native-notification-schedule.v1',id:42,scope,state:'scheduled',
 notification:{id:42,title:'Saved message',extra:{kind:'employee_message',native_presentation_principal:scope,native_presentation_id:'42'}}};
const memory=new Map([['receipt:schedule:42',JSON.stringify(old)],['saved-feedback-history','"preserved"']]);
const recovered=await fixture({memory});
check(JSON.parse(memory.get('receipt:schedule:42')).state,'cancelled','old owned deferred notification retired on restart');
check(memory.get('saved-feedback-history'),'"preserved"','existing unrelated saved data retained');
check(recovered.cancelled.length,1,'exact existing owned OS ID cancelled, no blanket cancel');
console.log(JSON.stringify({ok:true,checks,scope:'actual source Home derivation, routes and bridge callbacks; no app build or phone visual/runtime acceptance'}));
