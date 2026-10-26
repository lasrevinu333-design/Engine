import assert from 'node:assert/strict';
import {createProviderMirror} from '../mobile/src/custodial/provider-mirror.js';
import {createNativeProviderMirrorBridge} from '../mobile/src/custodial/provider-mirror-bridge.js';
const id=n=>`77000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const pending=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const turn=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
let checks=0;const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
function fixture({subscribeGate=null,stopGate=null,state='ATTACHED'}={}){
  const f={calls:[],rows:[],shown:[],states:new Map(),deferred:new Map(),timers:new Map(),visible:true,current:true,stop:true,attached:0,serial:0,nextGate:null};
  const record=(name,args)=>{f.calls.push([name,args]);};
  const plugin={
    async addListener(name,fn){record('subscribe',name);f.hint=fn;if(subscribeGate)await subscribeGate.promise;record('subscribed');return{remove:async()=>record('removeListener')};},
    async providerMirrorAttach(){record('attach');return{schema:'custodial.provider-mirror-attachment.v1',attachment_id:id(++f.attached),runtime_incarnation:id(999),revision:'4',state,audio_ready:false};},
    async providerMirrorStopped(args){record('stopped',args);return{stopped:true};},
    async providerClaimNext(args){record('next',args);if(f.nextGate)await f.nextGate.promise;return{claim:f.rows.shift()||null};},
    async providerClaimState(args){record('state',args);return f.states.get(args.claim_id)||{current:true,freshness:'CURRENT',retire_visual:false,stop_audio:false,navigation_pending:false};},
    async providerApplyAction(args){record('apply',args);return{applied:true};},
    async providerRetireClaim(args){record('retire',args);return{retired:true};},
    async providerMirrorDetach(args){record('detach',args);return{detached:true};},
  };
  f.bridge=createNativeProviderMirrorBridge(plugin);f.plugin=plugin;
  f.renderer={
    show(event,action){record('show');const row={event,action};f.shown.push(row);action.onRetire(options=>{record('removeCard',options);return true;});action.onOpen(()=>record('open'));return true;},
    async stopAndReadback(action){record('stopReadback',action?.providerMirror===true);if(stopGate)await stopGate.promise;return f.stop;},
  };
  f.mirror=createProviderMirror({bridge:f.bridge,visible:()=>f.visible,current:()=>f.current,locationMatches:()=>f.matches===true,
    defer:fn=>{const key=++f.serial;f.deferred.set(key,fn);return key;},cancel:key=>f.deferred.delete(key),
    repeat:(fn,delay)=>{const key=++f.serial;f.timers.set(key,{fn,delay});return key;},clearRepeat:key=>f.timers.delete(key)});
  f.add=(n,extra={})=>{const value={claim_id:id(n+100),payload:{schema:'custodial.native-provider-payload.v1',kind:'employee_lunch_coverage',
    notification_key:`original-${n}`,title:'Original native title',body:'Original full native body',route:'employee-schedule.html?hub=employee'},
    play_audio:false,navigation_pending:false,historical:false,...extra};f.rows.push(value);return value;};
  f.start=async()=>{f.mirror.setRenderer(f.renderer);await f.mirror.start();await f.mirror.reconcile();await turn();};
  f.count=name=>f.calls.filter(row=>row[0]===name).length;
  f.nextTurn=async()=>{const first=f.deferred.entries().next().value;if(first){f.deferred.delete(first[0]);first[1]();await f.mirror.reconcile();}await turn();};
  return f;
}
{
 const gate=pending(),f=fixture({subscribeGate:gate});f.add(1);f.mirror.setRenderer(f.renderer);const starting=f.mirror.start();await turn();
 f.hint();await turn();check(f.count('attach'),0,'retained hint during registration cannot precede listener readiness');
 gate.resolve();await starting;await turn();check(f.shown.length,1,'immediate pull after readiness even without a later signal');
 check(f.calls.findIndex(x=>x[0]==='subscribed')<f.calls.findIndex(x=>x[0]==='attach'),true,'subscribe before native observer/snapshot');
 check(f.calls.findIndex(x=>x[0]==='stopped')<f.calls.findIndex(x=>x[0]==='next'),true,'actual stopped handshake before any claim');
 check([...f.timers.values()].map(x=>x.delay),[60000],'one visible sixty-second recovery');await f.mirror.destroy();
}
{
 const f=fixture();for(let i=1;i<=20;i++)f.add(i);await f.start();check(f.shown.length,8,'at most eight claims in one execution');
 check(f.deferred.size,1,'one coalesced next turn');await f.nextTurn();check(f.shown.length,16,'next bounded turn retains native FIFO');
 await f.nextTurn();check(f.shown.length,20,'later records are not dropped');check(f.shown.map(x=>x.event.notification.data.notification_key),Array.from({length:20},(_,i)=>`original-${i+1}`),'exact native admission order');await f.mirror.destroy();
}
{
 const f=fixture();await f.start();f.add(1);f.hint();await turn();check(f.shown.length,1,'foreground arrival needs no lifecycle transition');
 f.add(2);for(const timer of f.timers.values())timer.fn();await turn();check(f.shown.length,2,'lost hint recovered by existing finite foreground repair');
 for(let i=0;i<30;i++)f.hint();await turn();check(f.deferred.size<=1,true,'duplicate hints coalesce rather than start concurrent drains');await f.mirror.destroy();
}
{
 const f=fixture();f.stop=false;f.add(1,{play_audio:true});await f.start();check(f.count('next'),0,'UNKNOWN audio stop prevents claiming');check(f.count('stopped'),0,'UNKNOWN never acknowledged as stopped');
 f.stop=true;await f.mirror.reconcile();await turn();check(f.shown.length,1,'positive later readback recovers without dropping original');
 const action=f.shown[0].action;check(await action.beginAudio(),true,'native durable audio claim permits first sound');
 check(f.calls.filter(x=>x[0]==='apply').map(x=>x[1].action),['displayed','audio_started'],'only finite original native facts, no received/browser outbox');
 f.stop=false;check(await action.finishAudio(false),false,'uncertain stop cannot settle audio');
 check(f.calls.some(x=>x[0]==='apply'&&x[1].action==='audio_completed'),false,'interrupted speech never synthesized completed');
 f.stop=true;check(await action.finishAudio(false),true,'verified interruption releases only capability');
 check(f.calls.at(-1)[1].action,'audio_stopped','interruption remains distinct from completion');await f.mirror.destroy();
}
{
 const f=fixture({state:'SUSPENDED'});f.add(1);await f.start();check(f.count('stopReadback'),0,'NONE/SUSPENDED creates no renderer effect');check(f.count('next'),0,'suspension grants no payload');
 await f.mirror.destroy();check(f.count('stopReadback'),0,'suspended teardown also creates no audio effect');
}
{
 const f=fixture();f.add(1,{play_audio:true});await f.start();const old=f.shown[0].action;await old.beginAudio();
 f.visible=false;f.mirror.changed();await turn();check(f.timers.size,0,'hide cancels periodic work');check(await old('opened'),false,'old hidden action refused');
 check(f.count('removeListener'),1,'hide retires actual old listener');const oldHint=f.hint;
 f.visible=true;f.add(2);f.mirror.changed();await turn();check(f.attached,2,'resume gets new native attachment');
 check(f.count('subscribe'),2,'resume subscribes afresh before snapshot');const pulls=f.count('next');oldHint();await turn();check(f.count('next'),pulls,'retired listener cannot request successor work');
 check(await old.finishAudio(true),false,'late old audio callback cannot settle a successor');check(f.shown.length,2,'resume immediate reconciliation');await f.mirror.destroy();
}
{
 const gate=pending(),f=fixture({subscribeGate:gate});f.mirror.setRenderer(f.renderer);const starting=f.mirror.start();await turn();
 f.visible=false;f.mirror.changed();f.visible=true;f.mirror.changed();gate.resolve();await starting;await turn();
 check(f.count('removeListener'),1,'late old subscription is retired on hide/resume race');check(f.count('attach'),1,'only fresh subscription can attach');
 check(f.count('subscribe'),2,'successor subscription is distinct');await f.mirror.destroy();
}
{
 const f=fixture();await f.start();const gate=pending();f.nextGate=gate;f.add(1,{play_audio:true});const reading=f.mirror.reconcile();await turn();
 f.visible=false;f.mirror.changed();gate.resolve();await reading;await turn();check(f.shown.length,0,'late detached claim response cannot render or play');
 check(f.calls.some(x=>x[0]==='apply'&&x[1].action==='audio_started'),false,'late detached claim has no effect receipt');await f.mirror.destroy();
}
{
 const f=fixture();f.add(1,{play_audio:true});await f.start();const action=f.shown[0].action;
 const results=await Promise.all([action.beginAudio(),action.beginAudio()]);check(results,[true,false],'concurrent audio start has one native call');
 check(f.calls.filter(x=>x[0]==='apply'&&x[1].action==='audio_started').length,1,'one durable audio start per capability');
 f.stop=false;f.plugin.providerClaimState=async()=>{throw Error('synthetic lost state read');};await f.mirror.reconcile();await turn();
 check(f.count('removeListener'),1,'unavailable state retires whole attachment, not fabricated revocation');
 const pulls=f.count('next');for(const timer of f.timers.values())timer.fn();await turn();check(f.count('next'),pulls,'UNKNOWN stop still blocks replacement audio on repair');await f.mirror.destroy();
}
{
 const f=fixture();const row=f.add(1,{play_audio:true});await f.start();await f.shown[0].action.beginAudio();
 f.states.set(row.claim_id,{current:true,freshness:'CURRENT',retire_visual:true,stop_audio:true,navigation_pending:false});f.hint();await turn();
 check(f.calls.some(x=>x[0]==='removeCard'&&x[1].stopAudio===true),true,'native ACK retires exact mirrored card');
 check(f.calls.some(x=>x[0]==='apply'&&x[1].action==='audio_stopped'),true,'native ACK uses verified stop, not completion');await f.mirror.destroy();
}
{
 const f=fixture();const row=f.add(1,{play_audio:true});await f.start();await f.shown[0].action.beginAudio();const stop=f.count('stopReadback');
 f.states.set(row.claim_id,{current:true,freshness:'CURRENT',retire_visual:true,stop_audio:false,navigation_pending:false});f.hint();await turn();
 check(f.calls.some(x=>x[0]==='removeCard'&&x[1].stopAudio===false),true,'native Dismiss retires only visual');check(f.count('stopReadback'),stop,'Dismiss keeps original running speech');await f.mirror.destroy();
}
{
 const f=fixture();const row=f.add(1,{navigation_pending:true,historical:true});f.matches=true;
 f.states.set(row.claim_id,{current:true,freshness:'FRESHNESS_UNAVAILABLE',retire_visual:false,stop_audio:false,navigation_pending:true});await f.start();
 check(f.shown.length,0,'current same-app destination readback consumes pending navigation without a new card');
 check(f.calls.filter(x=>x[0]==='apply').map(x=>x[1].action),['navigation_completed'],'no new historical displayed/audio facts');await f.mirror.destroy();
}
{
 const f=fixture();await assert.rejects(f.bridge.apply(id(1),id(2),'received'));checks++;
 await assert.rejects(f.bridge.apply(id(1),id(2),'sent'));checks++;
 check(f.count('apply'),0,'forbidden received/sent never reaches native');
 f.plugin.providerMirrorAttach=async()=>({state:'ATTACHED',audio_ready:true,attachment_id:id(1)});
 await assert.rejects(f.bridge.attach());checks++;
}
{
 const f=fixture();const row=f.add(1);await f.start();const action=f.shown[0].action,updates=[];action.onState(state=>updates.push(state));
 const before=f.count('apply');
 for(const freshness of ['HISTORICAL_EXPIRED','FRESHNESS_UNAVAILABLE']){
  f.states.set(row.claim_id,{current:true,freshness,retire_visual:false,stop_audio:false,navigation_pending:false});await f.mirror.reconcile();
  check(action.presentationState().freshness,freshness,'exact native classification propagated');
  check(await action('opened'),false,'new noncurrent Open refused');check(await action('acknowledged'),false,'new noncurrent ACK refused');
 }
 check(f.count('apply'),before,'classification never appends effects');check(f.count('show'),1,'classification never renders a second card');
 check(await action('dismissed'),true,'local Dismiss remains allowed with unavailable time');
 f.states.set(row.claim_id,{current:true,freshness:'FRESHNESS_UNAVAILABLE',retire_visual:false,stop_audio:false,navigation_pending:true});await f.mirror.reconcile();
 check(await action('opened'),true,'original durable pending Open replay remains allowed');
 check(updates.at(-1).navigation_pending,true,'original navigation remains visible in readback');await f.mirror.destroy();
}
{
 const f=fixture();const row=f.add(1);await f.start();
 const normal={current:true,freshness:'CURRENT',retire_visual:false,stop_audio:false,navigation_pending:false};
 for(const bad of [{...normal,freshness:'EXPIRED_GUESS'},{...normal,freshness:null},{...normal,freshness:'RETIRED'},
  {...normal,current:false},{...normal,time:1},{current:false,freshness:'RETIRED',retire_visual:true,stop_audio:false,navigation_pending:false}]){
  f.states.set(row.claim_id,bad);await assert.rejects(f.bridge.state(id(1),row.claim_id),/unavailable/);checks++;
 }
 f.states.set(row.claim_id,{current:false,freshness:'RETIRED',retire_visual:true,stop_audio:true,navigation_pending:false});
 await f.mirror.reconcile();check(f.count('removeCard'),1,'definitive retirement removes exact visual');
 check(f.calls.some(x=>x[0]==='apply'&&x[1].action==='audio_completed'),false,'retirement never fabricates audio completion');await f.mirror.destroy();
}
{
 const f=fixture();const row=f.add(1);await f.start();const action=f.shown[0].action,updates=[];action.onState(value=>updates.push(value));
 const gate=pending();f.plugin.providerClaimState=async()=>gate.promise;const reading=f.mirror.reconcile();await turn();
 f.current=false;f.mirror.changed();gate.resolve({current:true,freshness:'CURRENT',retire_visual:false,stop_audio:false,navigation_pending:false});await reading;
 check(updates.length,1,'late snapshot after principal loss cannot relabel old card');check(await action('opened'),false,'late current snapshot grants no old action');await f.mirror.destroy();
}
console.log(JSON.stringify({status:'PROVIDER_MIRROR_LIFECYCLE_PASS',checks,scope:'actual typed JS facade/coordinator; synthetic native and renderer edges; not physical audio or activation'}));
export {fixture as mirrorFixture};
