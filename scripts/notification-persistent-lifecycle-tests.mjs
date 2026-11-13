import assert from 'node:assert/strict';
import {fixture,data,turn} from './native-notification-arrival-boundary-tests.mjs';
import {createNotificationPresenter} from '../mobile/src/custodial/notification-presentation.js';

let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const arrival=key=>({notification:{title:'Synthetic schedule notice',body:`Synthetic full body ${key}.`,data:{...data,notification_key:key}}});
const rows=f=>[...f.memory.values()].map(JSON.parse).filter(row=>row.schema_version==='native-notification-presentation.v2');
const row=(f,key)=>rows(f).find(item=>item.key===key);
const receiptActions=f=>[...f.memory.values()].map(JSON.parse).filter(item=>item.action).map(item=>item.action);
async function toneThenSpeech(ui,index){
  check(ui.tones.length,index+1,'one tone started, no overlapping/future cycle');
  ui.tones[index].onended();await turn();ui.runTimer(900);await turn();
}
async function finishBrowserEpisode(ui){
  await toneThenSpeech(ui,0);check(ui.utterances.length,1,'speech starts only after tone ended plus gap');
  ui.utterances[0].onend();await turn();ui.runTimer(1200);await turn();
  await toneThenSpeech(ui,1);check(ui.utterances.length,2,'exact second speech follows second completed tone');
  check(ui.utterances[1].text,ui.utterances[0].text,'both speeches contain identical full personalized body');
  ui.utterances[1].onend();await turn();
}

{
 let action;const saved=[];
 const owner=createNotificationPresenter({identity:()=> 'synthetic-principal',nativeMode:()=>false,nativePresent:async()=>false,
  save:async entry=>{entry.queueOrdinal||=1;saved.push(structuredClone(entry));},load:async()=>[],displayed:async()=>true,action:async()=>true});
 owner.registerBrowser((_event,bound)=>{action=bound;bound.onRetire(()=>true);return true;});
 await owner.accept(arrival('durable:data-only'));
 check(await action.beginAudio(),true,'clone-based adapter accepts audio claim without runtime promises/functions');
 check(await action.finishAudio(true),true,'clone-based adapter accepts exact completion');
 check(await action('dismissed'),true,'clone-based adapter accepts terminal action');
 check(saved.every(item=>!('saving' in item)&&!('running' in item)&&!('retireBrowser' in item)),true,'durable snapshots exclude all writer/render lifecycle internals');
 check(saved.at(-1).visualState,'dismissed','data-only snapshots retain real durable state');
}

{
 const f=await fixture({display:'denied'}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true});
 await f.emit('firebase','notificationReceived',arrival('fifo:first'));
 await f.emit('firebase','notificationReceived',arrival('fifo:second'));
 check(rows(f).map(r=>[r.key,r.queueOrdinal]),[['fifo:first',1],['fifo:second',2]],'durable ordinals reflect accepted order without wall clock');
 check(ui.cards.length,1,'later alert cannot erase earlier unhandled visual');
 check(row(f,'fifo:first').audioState,'claimed','audio claim is durable before tone effect');
 await finishBrowserEpisode(ui);
 check(row(f,'fifo:first').audioState,'completed','only two actual tone/speech completions record completed');
 await f.mobile.retryNotificationPresentation();
 check(ui.tones.length,2,'poll/duplicate retry cannot add third cycle');
 check(ui.cards.length,1,'completed audio does not dismiss visual');
 await ui.card.querySelector('.mz-reminder-dismiss').listeners.click();await turn();
 check(row(f,'fifo:first').visualState,'dismissed','Dismiss durably resolves only the first visual');
 check(ui.card.attributes['data-notification-key'],'fifo:second','next durable FIFO notice becomes visible');
 check(ui.tones.length,3,'second episode begins after first finishes and first visual resolves');
 check(receiptActions(f).some(a=>a==='acknowledged'||a==='dismissed'||a==='opened'),false,'local Dismiss invents no server ack or task completion');
}
{
 const f=await fixture({display:'denied'}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true});
 await f.emit('firebase','notificationReceived',arrival('restart:unhandled'));
 const saved=new Map(f.memory);
 const restored=await fixture({display:'denied',memory:saved}),again=restored.fullBrowser({manualAudio:true,browserSpeech:true});
 await again.poll();await turn();
 check(again.cards.length,1,'restart restores displayed but unhandled plaintext visual');
 check(again.tones.length,0,'uncertain claimed audio is not blindly replayed after restart');
 check(row(restored,'restart:unhandled').audioState,'claimed','uncertainty stays explicit, not completed');
 check(receiptActions(restored).filter(a=>a==='displayed').length,1,'restored visual does not create a second logical displayed receipt');
 await again.card.querySelector('.mz-reminder-dismiss').listeners.click();await turn();
 const third=await fixture({display:'denied',memory:new Map(restored.memory)}),last=third.fullBrowser();await last.poll();
 check(last.cards.length,0,'durable Dismiss survives another restart');
 check(ui.tones.length,1,'restoration did not touch original runtime instance');
}
{
 const f=await fixture({display:'denied'}),ui=f.fullBrowser();
 await f.emit('firebase','notificationReceived',arrival('dismiss:retry'));
 let reject;f.holdNextMutation(new Promise((_resolve,no)=>{reject=no;}));
 const card=ui.card,button=card.querySelector('.mz-reminder-dismiss');
 const dismissing=button.listeners.click();reject(Error('synthetic protected write rejection'));await dismissing;
 check(ui.card,card,'failed Dismiss persistence retains exact visual');
 check(button.disabled,false,'failed Dismiss re-enables action');
 check(row(f,'dismiss:retry').visualState,'pending','failed Dismiss is not recorded as completed');
 await button.listeners.click();await turn();
 check(ui.active,false,'retry closes only after durable visual action');
 check(row(f,'dismiss:retry').visualState,'dismissed','retry persists exact same episode');
}
{
 const f=await fixture({display:'denied'}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true});
 await f.emit('firebase','notificationReceived',arrival('speech:no-timeout'));
 await toneThenSpeech(ui,0);
 await ui.finishTimers();
 check(ui.utterances.length,1,'arbitrary timer advancement cannot complete a speaking utterance');
 check(ui.tones.length,1,'no second tone overlaps a long or stalled first speech');
 check(row(f,'speech:no-timeout').audioState,'claimed','missing completion remains pending, not success');
 ui.utterances[0].onerror();await turn();
 check(row(f,'speech:no-timeout').audioState,'incomplete','speech error truthfully leaves incomplete episode');
 check(ui.tones.length,1,'speech failure does not launch a second cycle');
}
{
 const f=await fixture({display:'denied'}),ui=f.fullBrowser({manualAudio:true,fullySpeech:true,browserSpeech:true});
 await f.emit('firebase','notificationReceived',arrival('fully:bound'));
 await finishBrowserEpisode(ui);
 check(ui.fullyTexts.length,0,'uncorrelated Fully TTS is not used as a completion authority');
 check(ui.fullyBindings.size,0,'no global Fully TTS handler or unrelated owner is replaced');
 check(row(f,'fully:bound').audioState,'completed','exact WebView utterance completions persist episode completion');
 check(ui.tones.length,2,'no third audio cycle');
}
{
 const f=await fixture({display:'denied'}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true});
 await f.emit('firebase','notificationReceived',arrival('dismiss:audio'));
 await f.emit('firebase','notificationReceived',arrival('dismiss:queued'));
 await ui.card.querySelector('.mz-reminder-dismiss').listeners.click();await turn();
 check(ui.active,false,'visual Dismiss does not wait for audio');
 check(ui.tones.length,1,'pending next alert cannot overlap dismissed card audio');
 await finishBrowserEpisode(ui);
 await ui.poll();await turn();
 check(ui.card.attributes['data-notification-key'],'dismiss:queued','next FIFO visual becomes available after exact prior audio finishes');
}
{
 const f=await fixture({display:'denied'});
 await f.emit('firebase','notificationReceived',arrival('reordered:first'));
 await f.emit('firebase','notificationReceived',arrival('reordered:second'));
 const reversed=new Map([...f.memory].reverse());
 const restored=await fixture({display:'denied',memory:reversed}),ui=restored.fullBrowser({manualAudio:true,browserSpeech:true});
 await ui.poll();await turn();
 check(ui.card.attributes['data-notification-key'],'reordered:first','restart uses durable ordinal, not storage enumeration order');
 check(ui.cards.length,1,'restart never overlaps restored FIFO cards');
}
{
 const f=await fixture({display:'denied'}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true});
 f.failNextAudioClaim();await f.emit('firebase','notificationReceived',arrival('audio:claim-failed'));
 check(ui.active,true,'audio persistence failure does not erase accessible visual');
 check(ui.tones.length,0,'no audio effect precedes confirmed durable claim');
 await f.mobile.retryNotificationPresentation();await turn();
 check(ui.tones.length,0,'uncertain claim is never blindly replayed');
}
{
 const f=await fixture({display:'denied'}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true});
 await f.emit('firebase','notificationReceived',arrival('legacy:displayed'));
 const memory=new Map(f.memory);
 for(const [key,value] of memory){const item=JSON.parse(value);if(item.schema_version!=='native-notification-presentation.v2')continue;
   delete item.queueOrdinal;delete item.queueOrderSource;delete item.visualState;delete item.audioState;memory.set(key,JSON.stringify(item));}
 const restored=await fixture({display:'denied',memory}),again=restored.fullBrowser({manualAudio:true,browserSpeech:true});
 await again.poll();await turn();
 check(again.active,true,'legacy displayed row recovers visual without claiming historical action');
 check(again.tones.length,0,'legacy unknown audio history is not a fresh episode');
 check(row(restored,'legacy:displayed').audioState,'legacy-unknown','legacy audio provenance remains explicit');
 check(row(restored,'legacy:displayed').queueOrderSource,'legacy-recovered','legacy queue cannot invent original arrival ordering');
}
{
 const f=await fixture({display:'denied'}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true});
 await f.emit('firebase','notificationReceived',arrival('detach:pending'));
 const old=ui.card;f.trigger('pagehide');await turn();
 check(ui.active,false,'pagehide removes only owned visual and cancels its audio');
 check(row(f,'detach:pending').audioState,'claimed','interrupted detach does not claim complete audio');
 await f.mobile.retryNotificationPresentation();check(ui.active,false,'detached renderer cannot display another card');
 f.trigger('pageshow');await turn();await turn();
 check(ui.active,true,'bfcache-style pageshow restores unresolved visual');
 check(ui.card===old,false,'restored card has a fresh action lease');
 check(ui.tones.length,1,'pageshow cannot replay claimed audio');
 const current=ui.card;await old.querySelector('.mz-reminder-dismiss').listeners.click();
 check(ui.card,current,'old detached click cannot close reattached card');
}
{
 let current=true;
 const f=await fixture({display:'denied',presentationIsCurrent:()=>current}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true});
 await f.emit('firebase','notificationReceived',arrival('stale-audio:first'));
 await toneThenSpeech(ui,0);const lateDone=ui.utterances[0].onend;
 current=false;await f.mobile.retryNotificationPresentation();
 current=true;await f.emit('firebase','notificationReceived',arrival('stale-audio:successor'));
 await toneThenSpeech(ui,1);
 lateDone();await turn();
 check(ui.state.activeSpeechPromise!==null,true,'late cancelled utterance cannot settle successor speech');
 check(ui.tones.length,2,'late old completion cannot launch a successor cycle');
 check(row(f,'stale-audio:successor').audioState,'claimed','successor stays honestly pending until its own callback');
}
{
 let current=true,release;
 const f=await fixture({display:'denied',presentationIsCurrent:()=>current}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true});
 await f.emit('firebase','notificationReceived',arrival('dismiss:retired-save'));
 f.holdNextMutation(new Promise(resolve=>{release=resolve;}));
 const pending=ui.card.querySelector('.mz-reminder-dismiss').listeners.click();await turn();
 current=false;await f.mobile.retryNotificationPresentation();current=true;
 release();await pending;
 check(row(f,'dismiss:retired-save').visualState,'pending','retired local save cannot commit terminal action through authority ABA');
 check(ui.active,false,'retired action cannot revive its removed card');
}
{
 const f=await fixture({display:'denied'}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true});
 const event=arrival('serialized:state');await f.emit('firebase','notificationReceived',event);
 await toneThenSpeech(ui,0);ui.utterances[0].onend();await turn();ui.runTimer(1200);await turn();
 await toneThenSpeech(ui,1);
 let release;f.holdNextMutation(new Promise(resolve=>{release=resolve;}));
 const dismissing=ui.card.querySelector('.mz-reminder-dismiss').listeners.click();await turn();
 ui.utterances[1].onend();await turn();
 await f.emit('firebase','notificationReceived',event);
 check(row(f,'serialized:state').visualState,'pending','unconfirmed action is not leaked into another writer snapshot');
 release();await dismissing;await turn();await turn();
 check(row(f,'serialized:state').visualState,'dismissed','concurrent audio/duplicate save preserves durable visual terminal');
 check(row(f,'serialized:state').audioState,'completed','serialized terminal save preserves later actual audio completion');
 check(ui.tones.length,2,'duplicate and interleaved saves cannot replay audio');
}
{
 const f=await fixture({display:'denied'}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true});
 await f.emit('firebase','notificationReceived',arrival('open:durable'));
 const opening=ui.card.querySelector('.mz-reminder-open').listeners.click();await turn();
 check(row(f,'open:durable').visualState,'opened','Open action is durable before navigation');
 check(receiptActions(f).filter(a=>a==='opened').length,1,'Open keeps exact protected receipt identity');
 check(ui.active,true,'Open preserves card while its audio finishes');
 await finishBrowserEpisode(ui);await ui.finishTimers();await opening;
 check(ui.active,false,'Open closes after actual audio and grace');
 assert.match(ui.href,/employee-schedule\.html/);checks++;
 const restarted=await fixture({display:'denied',memory:new Map(f.memory)}),again=restarted.fullBrowser();await again.poll();
 check(again.cards.length,0,'handled Open never replays visual after restart');
}
console.log(JSON.stringify({ok:true,checks,scope:'actual protected bridge + presenter + reminder DOM/audio source with synthetic completion events; not provider/native-claim, independent review or phone proof'}));
