import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const text=fs.readFileSync(process.argv[2]+'/memphis-device-reminders.js','utf8');
function block(name,next){return text.slice(text.indexOf('  '+name),text.indexOf('  '+next,text.indexOf('  '+name)));}
let source=block('function clearPendingRingtoneRepeats(','function stopActiveSpeech(')+block('function queueAlertStep(','function speakViaBrowser(')+block('async function startAlertAudioSequence(','async function waitForActiveAlertSpeech(')+block('function closeActiveAlert(','function showAlert(');
async function scenario(dismissAt,stopSpeech=false){let clock=0,id=0,finished=false,rings=0;const pending=new Map(),spoken=[];
 const state={ringTimeouts:[],alertSequenceToken:0,activeAlert:{id:'fixture'}};
 const ctx={state,CONFIG:{RINGTONE_ESTIMATED_DURATION_MS:1000,ALERT_POST_RINGTONE_DELAY_MS:100,VOICE_REPEAT_GAP_MS:1500,ALERT_LOCK_KEY:'fixture'},
  safeText:v=>String(v||''),playOneRingtone:()=>{rings++;},stopActiveRingtone(){},stopActiveSpeech(){},
  speakOnce:async s=>{spoken.push(s);return true;},setReminderPresentationActive(){},sessionStorage:{removeItem(){}},
  document:{querySelector:()=>({remove(){}})},Date:{now:()=>clock},
  window:{setTimeout:(fn,delay)=>{const key=++id;pending.set(key,{at:clock+delay,fn});return key;},clearTimeout:key=>pending.delete(key)}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const flush=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
 async function advance(until){let next;while((next=[...pending.entries()].sort((a,b)=>a[1].at-b[1].at)[0])&&next[1].at<=until){clock=next[1].at;pending.delete(next[0]);next[1].fn();await flush();}clock=until;await flush();}
 state.activeSequencePromise=ctx.startAlertAudioSequence('Same complete fixture sentence').finally(()=>{finished=true;state.activeSequencePromise=null;});
 if(dismissAt!==null){await advance(dismissAt);ctx.closeActiveAlert({stopSpeech});await flush();}
 await advance(120000);return {finished,rings,spoken,pending:pending.size,sequenceActive:Boolean(state.activeSequencePromise)};
}
const results=[];async function test(name,fn){try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
for(const at of [null,100,2200])await test('Dismiss at '+at+' does not strand or shorten required two cycles',async()=>{const r=await scenario(at);assert.equal(r.finished,true);assert.equal(r.sequenceActive,false);assert.equal(r.rings,2);assert.deepEqual(r.spoken,['Same complete fixture sentence','Same complete fixture sentence']);assert.equal(r.pending,0);});
await test('explicit stop settles a cancelled wait without a new tone',async()=>{const r=await scenario(100,true);assert.equal(r.finished,true);assert.equal(r.rings,1);assert.equal(r.sequenceActive,false);});
console.log(JSON.stringify({scope:'Actual sequence/wait/dismiss functions with fake clock and stub audio; not physical audibility',passed:results.filter(t=>t.passed).length,failed:results.filter(t=>!t.passed).length,results},null,2));process.exitCode=results.some(t=>!t.passed)?1:0;
