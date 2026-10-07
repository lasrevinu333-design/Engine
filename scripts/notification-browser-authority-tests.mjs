import assert from 'node:assert/strict';
import {fixture,data,turn} from './native-notification-arrival-boundary-tests.mjs';
import {NATIVE_NOTIFICATION_RECEIPT_SCHEMA} from '../mobile/src/custodial/notification-receipts.js';
import {createNotificationPresenter} from '../mobile/src/custodial/notification-presentation.js';
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const receipts=f=>[...f.memory.values()].map(JSON.parse).filter(r=>r.schema_version===NATIVE_NOTIFICATION_RECEIPT_SCHEMA);
const arrival=key=>({notification:{title:'Synthetic schedule',body:'Synthetic body',data:{...data,notification_key:key}}});
{
 let current=true;
 const f=await fixture({display:'denied',presentationIsCurrent:()=>current}),ui=f.fullBrowser();
 ui.setHref('https://localhost/messages.html');
 await f.emit('firebase','notificationReceived',arrival('browser-authority'));
 const old=ui.card;check(ui.active,true,'exact accepted browser card initially shown');
 current=false;await f.mobile.retryNotificationPresentation();
 check(ui.active,false,'terminal retires exact card without waiting for click or next poll');
 check(receipts(f).filter(r=>r.action==='opened').length,0,'retirement is not an opened receipt');
 await old.querySelector('.mz-reminder-open').listeners.click();
 check(ui.href,'https://localhost/messages.html','retired Open cannot navigate');
 current=true;await f.emit('firebase','notificationReceived',arrival('replacement'));
 const successor=ui.card;check(ui.active,true,'distinct accepted successor can display');
 await old.querySelector('.mz-reminder-dismiss').listeners.click();
 check(ui.card,successor,'old callback cannot close successor');
}
{
 let current=false;
 const f=await fixture({display:'denied',presentationIsCurrent:()=>current}),ui=f.fullBrowser();
 await f.emit('firebase','notificationReceived',arrival('late-before-view'));
 check(ui.active,false,'late stale arrival does not show a card');
 check(receipts(f).filter(r=>r.action==='displayed').length,0,'late stale arrival has no invented display proof');
 check(receipts(f).filter(r=>r.action==='received').length,1,'received evidence retained');
 current=true;await f.mobile.retryNotificationPresentation();
 check(ui.active,true,'not-yet-known authority can recover without discarding original payload');
}
{
 let current=true;
 const f=await fixture({display:'denied',presentationIsCurrent:()=>current}),ui=f.fullBrowser();
 await f.emit('firebase','notificationReceived',arrival('dismissed-audio'));
 await ui.card.querySelector('.mz-reminder-dismiss').listeners.click();
 check(ui.active,false,'ordinary visual dismissal still hides card');
 const before=ui.audioStops;current=false;await f.mobile.retryNotificationPresentation();
 check(ui.audioStops>before,true,'terminal stops exact old audio even after visual Dismiss');
 await ui.finishTimers();
 check(receipts(f).some(r=>r.action==='opened'||r.action==='acknowledged'),false,'audio retirement does not fabricate employee action');
}
{
 let current=true,release;
 const f=await fixture({display:'denied',presentationIsCurrent:()=>current}),ui=f.fullBrowser();
 ui.setHref('https://localhost/messages.html');await f.emit('firebase','notificationReceived',arrival('in-flight-action'));
 const hold=new Promise(resolve=>{release=resolve;});f.holdNextMutation(hold);
 const opening=ui.card.querySelector('.mz-reminder-open').listeners.click();await turn();
 current=false;await f.mobile.retryNotificationPresentation();release();await opening;
 check(receipts(f).filter(r=>r.action==='opened').length,0,'authority lost during protected mutation fences action');
 check(ui.active,false,'pending Open cannot restore retired card');
 check(ui.href,'https://localhost/messages.html','pending Open cannot navigate');
}
{
 let current=true,removed=false,action,retireCalls=0;
 const owner=createNotificationPresenter({identity:()=> 'A',isCurrent:()=>current,nativeMode:()=>false,
  nativePresent:async()=>false,save:async()=>{},load:async()=>[],displayed:async()=>true,action:async()=>true});
 owner.registerBrowser((_event,boundAction)=>{
  action=boundAction;boundAction.onRetire(()=>{retireCalls++;return removed;});return true;
 });
 await owner.accept(arrival('uncertain-removal'));current=false;
 check(await owner.retry(),[false],'unconfirmed card retirement does not report success');
 check(action.isCurrent(),false,'retired lease denies action even when visual removal failed');
 check(retireCalls,1,'one bounded retirement attempt');
 removed=true;check(await owner.retry(),[false],'retry retires old card, does not claim a new display');
 check(retireCalls,2,'exact same removal retried');
 await owner.retry();check(retireCalls,2,'confirmed removal not repeated');
 current=true;check(await action('opened'),false,'retired action cannot revive through authority ABA');
}
console.log(JSON.stringify({ok:true,checks,scope:'actual bridge/presenter/reminder source with synthetic injected authority and DOM; NOT mounted schedule authority or physical audio proof'}));
