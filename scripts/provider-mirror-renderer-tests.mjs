import assert from 'node:assert/strict';
import {fixture,turn} from './native-notification-arrival-boundary-tests.mjs';
import {mirrorFixture} from './provider-mirror-lifecycle-tests.mjs';
let checks=0;const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
async function actual({historical=false,play=true}={}){
 const native=mirrorFixture(),f=await fixture({display:'denied',providerMirror:native.mirror});
 const apply=native.plugin.providerApplyAction;
 native.plugin.providerApplyAction=async args=>{
  await apply(args);const state=native.states.get(args.claim_id)||{current:true,freshness:'CURRENT',retire_visual:false,stop_audio:false,navigation_pending:false};
  if(args.action==='dismissed')state.retire_visual=true;
  if(args.action==='acknowledged'){state.retire_visual=true;state.stop_audio=true;}
  if(args.action==='opened')state.navigation_pending=true;
  if(args.action==='navigation_completed')state.navigation_pending=false;
  native.states.set(args.claim_id,state);return{applied:true};
 };
 const actions=()=>native.calls.filter(x=>x[0]==='apply').map(x=>x[1].action);
 const ui=f.fullBrowser({manualAudio:true,browserSpeech:true,observedAudio:true,
  onTone:()=>{const applied=native.calls.filter(x=>x[0]==='apply').map(x=>x[1]);
   check(applied.findLast(x=>x.action==='audio_started')?.claim_id,applied.findLast(x=>x.action==='displayed')?.claim_id,'actual tone follows confirmed original native durable claim');}});
 const first=native.add(1,{play_audio:play,historical,navigation_pending:historical});
 if(historical)native.states.set(first.claim_id,{current:true,freshness:'FRESHNESS_UNAVAILABLE',retire_visual:false,stop_audio:false,navigation_pending:true});
 await native.mirror.start();await native.mirror.reconcile();await turn();
 return{native,f,ui,first,actions};
}
async function cycle(ui,tone,speech){
 check(ui.tones.length,tone+1,'one exact tone, no next-cycle overlap');ui.tones[tone].onended();await turn();ui.runTimer(900);await turn();
 check(ui.utterances.length,speech+1,'speech only after completed tone and gap');ui.utterances[speech].onend();await turn();
}
async function episode(ui,tone=0,speech=0){await cycle(ui,tone,speech);ui.runTimer(1200);await turn();await cycle(ui,tone+1,speech+1);}
// Eric's 2026-10-03 payload-expiry choice applies only to a validly started,
// uninterrupted original episode. These cases do not select sample-loss policy.
for(const expiryAfterStep of [0,1,2,3,4,5,6]){
 const {native,ui,first,actions}=await actual();
 const card=ui.card,steps=[()=>ui.tones[0].onended(),()=>ui.runTimer(900),()=>ui.utterances[0].onend(),
  ()=>ui.runTimer(1200),()=>ui.tones[1].onended(),()=>ui.runTimer(900),()=>ui.utterances[1].onend()];
 for(let i=0;i<expiryAfterStep;i++){steps[i]();await turn();}
 native.states.set(first.claim_id,{current:true,freshness:'HISTORICAL_EXPIRED',retire_visual:false,stop_audio:false,navigation_pending:false});
 await native.mirror.reconcile();await turn();
 check(ui.card===card,true,'payload expiry keeps original card and original audio owner at step '+expiryAfterStep);
 check(card.querySelector('.mz-reminder-body').textContent.startsWith('Expired notice'),true,'expiry readback truthfully relabels while original episode continues');
 check(card.querySelector('.mz-reminder-open').disabled,true,'expiry continuation grants no new Open');
 check(actions().filter(x=>x==='audio_started').length,1,'expiry creates no second native audio start');
 check(actions().includes('audio_completed'),false,'expiry relabel does not fabricate completion');
 for(let i=expiryAfterStep;i<steps.length;i++){steps[i]();await turn();}
 check(ui.tones.length,2,'original expiry-crossing episode has exactly two tones');
 check(ui.utterances.length,2,'original expiry-crossing episode has exactly two speeches');
 check(ui.utterances.map(x=>x.text),['Original full native body','Original full native body'],'both expiry-crossing cycles retain exact original text');
 check(actions().filter(x=>x==='audio_completed').length,1,'only actual final callback completes original episode');
 check(actions().filter(x=>x==='displayed').length,1,'expiry adds no display receipt');
 check(actions().includes('audio_stopped'),false,'payload expiry alone does not interrupt original episode');
 for(let i=0;i<3;i++){native.hint();await native.mirror.reconcile();await turn();}
 check(ui.tones.length,2,'poll and duplicate hints cannot create a third cycle after expiry');
 check(ui.utterances.length,2,'completed original speech never replays after expiry');
 check(ui.card===card,true,'completed expiry-crossing episode leaves original persistent visual');
 await native.mirror.destroy();
}
{
 const {native,ui,first,actions}=await actual();
 await ui.card.querySelector('.mz-reminder-dismiss').click();await turn();
 native.states.set(first.claim_id,{current:true,freshness:'HISTORICAL_EXPIRED',retire_visual:true,stop_audio:false,navigation_pending:false});
 await native.mirror.reconcile();await episode(ui);
 check(ui.active,false,'local Dismiss remains closed across original audio expiry');
 check(ui.utterances.length,2,'Dismiss plus expiry preserves both original cycles');
 check(actions().filter(x=>x==='audio_completed').length,1,'dismissed expiry-crossing episode has one completion');
 check(actions().includes('acknowledged'),false,'Dismiss and expiry do not synthesize server ACK');
 await native.mirror.destroy();
}
{
 const {native,ui,first,actions}=await actual();
 ui.tones[0].onended();await turn();ui.runTimer(900);await turn();
 const late=ui.utterances[0].onend;ui.speech.stuck=true;
 // This is readback of an original accepted ACK, not permission for a new
 // expired ACK. The native original-event case owns that identity proof.
 native.states.set(first.claim_id,{current:true,freshness:'HISTORICAL_EXPIRED',retire_visual:true,stop_audio:true,navigation_pending:false});
 await native.mirror.reconcile();await turn();
 check(actions().includes('audio_completed'),false,'expiry exception cannot turn ACK interruption into completed speech');
 check(actions().includes('audio_stopped'),false,'ACK with unknown physical silence retains original audio fence');
 check(ui.utterances.length,1,'ACK still prevents the second original cycle even after expiry');
 ui.speech.stuck=false;ui.speech.speaking=false;await native.mirror.reconcile();await turn();
 check(actions().includes('audio_stopped'),true,'exact stop readback releases ACK-interrupted expired capability');
 late();await turn();check(ui.utterances.length,1,'late ACK-interrupted speech callback cannot resume expired episode');
 check(actions().includes('audio_completed'),false,'late callback never fabricates completion');
 await native.mirror.destroy();
}
{
 const {native,f,ui,actions}=await actual();
 check(ui.cards.length,1,'actual shared bridge registered actual renderer');check(actions().slice(0,2),['displayed','audio_started'],'native displayed precedes native audio start');
 await episode(ui);check(actions().filter(x=>x==='audio_completed').length,1,'two actual cycle completions record one native completed fact');
 check(ui.active,true,'completed audio leaves persistent full-text visual');check(ui.utterances[0].text,ui.utterances[1].text,'same full personalized sentence both cycles');
 await native.mirror.reconcile();check(ui.tones.length,2,'reconcile cannot replay completed sound');
 check([...f.memory.values()].map(JSON.parse).filter(x=>x.action).length,0,'native mirror creates no duplicate JS receipt outbox');check(ui.httpActions.length,0,'no device-header legacy ACK fallback');
 await native.mirror.destroy();
}
{
 const {native,ui,actions}=await actual();native.add(2,{play_audio:true});await native.mirror.reconcile();
 const original=ui.card;await original.querySelector('.mz-reminder-dismiss').click();await turn();
 check(ui.active,false,'Dismiss durably hides visual immediately');check(actions().includes('acknowledged'),false,'Dismiss never becomes ACK');
 check(ui.tones.length,1,'queued native notice cannot interrupt dismissed speech');await episode(ui);await native.mirror.reconcile();await turn();
 check(ui.card.attributes['data-notification-key'],'original-2','next native FIFO card renders after prior exact audio');check(ui.tones.length,3,'one successor audio sequence');
 await original.querySelector('.mz-reminder-dismiss').click();check(ui.card.attributes['data-notification-key'],'original-2','retired callback cannot close successor');await native.mirror.destroy();
}
{
 const {native,ui,actions}=await actual();ui.tones[0].onended();await turn();ui.runTimer(900);await turn();
 const late=ui.utterances[0].onend;ui.speech.stuck=true;
 const button=ui.card.querySelector('.mz-reminder-actions').children.find(x=>x.className.includes('mz-reminder-acknowledge'));
 await button.click();await turn();native.add(2,{play_audio:true});await native.mirror.reconcile();await turn();
 check(actions().includes('acknowledged'),true,'actual Acknowledge persists original native action');check(actions().includes('audio_completed'),false,'cancel is never completed speech');
 check(actions().includes('audio_stopped'),false,'UNKNOWN physical stop does not release native audio capability');check(ui.tones.length,1,'stuck speech blocks successor');
 ui.speech.stuck=false;ui.speech.speaking=false;await native.mirror.reconcile();await turn();
 check(actions().includes('audio_stopped'),true,'positive engine readback releases interruption without completion');check(ui.tones.length,2,'successor starts only after positive stop');
 late();await turn();check(ui.tones.length,2,'late original callback cannot complete or extend successor');await native.mirror.destroy();
}
{
 const {native,ui,actions}=await actual();const opening=ui.card.querySelector('.mz-reminder-open').click();await turn();
 check(actions().includes('opened'),true,'Open durable native action before any navigation');check(ui.active,true,'Open waits actual current speech');
 await episode(ui);await ui.finishTimers();await opening;
 check(ui.href,'https://localhost/employee-schedule.html?hub=employee','provider navigates exact native route with no invented query');
 check(ui.active,false,'actual card closes only after audio and grace');await native.mirror.destroy();
}
{
 const {native,ui,actions}=await actual({historical:true,play:false});
 check(ui.card.querySelector('.mz-reminder-body').textContent.startsWith('Notice freshness unavailable'),true,'original pending navigation is explicitly noncurrent');
 check(ui.tones.length,0,'original pending navigation never wakes audio');check(actions(),['opened'],'only original durable Open replay, no fresh displayed/audio fact');await native.mirror.destroy();
}
{
 const {native,ui,first,actions}=await actual({play:false});const card=ui.card,before=actions().slice();
 native.states.set(first.claim_id,{current:true,retire_visual:false,stop_audio:false,navigation_pending:false,freshness:'HISTORICAL_EXPIRED'});
 await native.mirror.reconcile();await turn();
 check(ui.card===card,true,'expiry relabel retains the exact already-visible card');
 check(card.querySelector('.mz-reminder-body').textContent.startsWith('Expired notice'),true,'native expiry readback relabels visible notice');
 check(card.querySelector('.mz-reminder-open').disabled,true,'new expired Open disabled');
 const ack=card.querySelector('.mz-reminder-actions').children.find(x=>x.className.includes('mz-reminder-acknowledge'));
 check(ack.disabled,true,'new expired ACK disabled');check(card.querySelector('.mz-reminder-dismiss').disabled,false,'local Dismiss remains available');
 await card.querySelector('.mz-reminder-open').click();await ack.click();check(actions(),before,'disabled stale actions create no fact');
 native.states.set(first.claim_id,{current:true,retire_visual:false,stop_audio:false,navigation_pending:false,freshness:'FRESHNESS_UNAVAILABLE'});
 await native.mirror.reconcile();check(card.querySelector('.mz-reminder-body').textContent.startsWith('Notice freshness unavailable'),true,'unknown is not guessed expired');
 native.states.set(first.claim_id,{current:true,retire_visual:false,stop_audio:false,navigation_pending:false,freshness:'CURRENT'});
 await native.mirror.reconcile();check(card.querySelector('.mz-reminder-body').textContent,'Original full native body','later native current readback removes only status prefix');
 check(card.querySelector('.mz-reminder-open').disabled,false,'fresh readback permits attempt, native still owns final action');
 check(ui.cards.length,1,'all relabels reuse one actual DOM card');check(ui.tones.length,0,'all relabels create no audio');
 check(actions(),before,'relabel creates no displayed/audio/action fact');
 await native.mirror.destroy();
}
{
 const {native,ui,first,actions}=await actual();const card=ui.card,opening=card.querySelector('.mz-reminder-open').click();await turn();
 native.states.set(first.claim_id,{current:true,freshness:'FRESHNESS_UNAVAILABLE',retire_visual:false,stop_audio:false,navigation_pending:true});
 await native.mirror.reconcile();check(ui.card===card,true,'expiry does not discard already-durable pending Open');
 await episode(ui);await ui.finishTimers();await opening;
 check(ui.href,'https://localhost/employee-schedule.html?hub=employee','original Open navigates canonical destination after time loss');
 check(actions().filter(x=>x==='opened').length,1,'already-running Open not clicked a second time by state hint');
 check(actions().filter(x=>x==='displayed').length,1,'pending Open relabel adds no display receipt');await native.mirror.destroy();
}
{
 const {native,ui,first,actions}=await actual({play:false});
 native.states.set(first.claim_id,{current:true,freshness:'HISTORICAL_EXPIRED',retire_visual:false,stop_audio:false,navigation_pending:false});
 await native.mirror.reconcile();await ui.card.querySelector('.mz-reminder-dismiss').click();await turn();
 check(ui.active,false,'expired existing card can be locally dismissed');check(actions().includes('acknowledged'),false,'expired Dismiss remains distinct from ACK');await native.mirror.destroy();
}
console.log(JSON.stringify({status:'PROVIDER_MIRROR_RENDERER_PASS',checks,scope:'actual bridge publication + reminder DOM/audio + typed mirror; synthetic native facade and engine callbacks; no phone/provider activation'}));
