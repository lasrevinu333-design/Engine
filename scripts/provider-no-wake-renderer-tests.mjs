import assert from 'node:assert/strict';
import {fixture,turn,principal} from './native-notification-arrival-boundary-tests.mjs';
import {mirrorFixture} from './provider-mirror-lifecycle-tests.mjs';
import {requiredKindFixture} from './provider-required-kind-integration-tests.mjs';
let checks=0;const check=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
async function cycles(ui){
 for(let index=0;index<2;index++){
  check(ui.tones.length,index+1,'one exact tone per required September cycle');
  ui.tones[index].onended();await turn();ui.runTimer(900);await turn();
  check(ui.utterances.length,index+1,'full speech follows exact tone completion');
  ui.utterances[index].onend();await turn();
  if(index===0){ui.runTimer(1200);await turn();}
 }
}
for(const kind of ['employee_lunch_coverage','employee_event','employee_message']){
 const native=mirrorFixture(),f=await fixture({display:'denied',providerMirror:native.mirror});
 const ui=f.fullBrowser({manualAudio:true,browserSpeech:true,observedAudio:true});
 const extra=kind==='employee_lunch_coverage'?{}:{payload:requiredKindFixture(kind)};
 const row=native.add(1,{...extra,play_audio:true,historical:false,navigation_pending:false});
 await native.mirror.start();await native.mirror.reconcile();await turn();
 check(ui.cards.length,1,'one actual full-text native mirror card for '+kind);
 // This assertion is the fail-before reproducer: the old owning renderer
 // directly invoked both Fully wake APIs immediately after durable audio start.
 check(ui.wakeCalls,[],'notification must never turn an off display on or foreground it: '+kind);
 await cycles(ui);
 check(ui.wakeCalls,[],'both original speech cycles preserve no-wake policy');
 check(ui.utterances.map(x=>x.text),[row.payload.body,row.payload.body],'both announcements retain exact original full text');
 check(native.calls.filter(x=>x[0]==='apply'&&x[1].action==='audio_started').length,1,'one original durable audio start');
 check(native.calls.filter(x=>x[0]==='apply'&&x[1].action==='audio_completed').length,1,'only actual final callback completes audio');
 for(let index=0;index<3;index++){native.hint();await native.mirror.reconcile();await turn();}
 check(ui.tones.length,2,'duplicate hints/manual foreground reconciliation do not replay tone');
 check(ui.utterances.length,2,'same original episode does not replay speech');
 check(ui.card.querySelector('.mz-reminder-dismiss').disabled!==true,true,'Dismiss remains available');
 await native.mirror.destroy();
}
{
 const f=await fixture({platform:'web'}),ui=f.fullBrowser({manualAudio:true,browserSpeech:true,observedAudio:true,
  rows:[{notification_key:'no-wake:browser:due-soon',location_code:'SYNTHETIC',status_code:'due_soon',employee_id:principal.employee_id}]});
 await ui.poll();await turn();
 check(ui.cards.length,1,'existing authenticated browser fallback still presents');
 check(ui.wakeCalls,[],'browser fallback notification also preserves no-wake policy');
 await cycles(ui);check(ui.wakeCalls,[],'fallback speech never invokes Fully wake');
}
console.log(JSON.stringify({status:'NO_NOTIFICATION_WAKE_RENDERER_PASS',checks,actual_renderer:true,synthetic_native_and_audio:true,physical_screen_off:false,voice4_qualified:false,background_delivery:false}));
