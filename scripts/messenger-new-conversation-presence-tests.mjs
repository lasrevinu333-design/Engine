// Exact shipped-source callback under inert UI/list dependencies. No message/API action.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const file='mobile/src/chatscope/app.jsx',source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
const original=execFileSync('git',['show','HEAD:'+file],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
function callback(text){const marker='onCreated={async (id,assertCurrent,retireOriginal) => {',at=text.indexOf(marker);assert.ok(at>=0);const end=text.indexOf(' }} />}',at);assert.ok(end>at);return 'async (id,assertCurrent,retireOriginal) => {'+text.slice(at+marker.length,end)+' }';}
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
async function run(text,{rows=[{id,type:'direct'}],group=false,withdrawAt=0,listFailure=false,delay=false}={}){
 const events=[],retained={thread:{id},messages:[{id:'retained',body:'SYNTHETIC'}],visibility:{hidden_before:'2026-11-01T12:00:00Z'},peerVisibility:{hidden_before:null},deletion:{id:'original',state:'preserved'}};
 const before=JSON.stringify(retained);let checks=0;const gate=deferred(),ctx={Error,Object,loadThreads:async input=>{events.push('list');assert.equal(input.preferId,id);if(delay)await gate.promise;if(listFailure)throw Error('synthetic list refused');return rows;},selectThread:selected=>{assert.equal(selected,id);events.push('select');},setNewConversation:value=>{assert.equal(value,false);events.push('close');}};
 const assertCurrent=()=>{checks++;if(withdrawAt&&checks>=withdrawAt)throw Error('original owner withdrawn');};
 vm.createContext(ctx);const fn=vm.runInContext('('+callback(text)+')',ctx);let error;
 const promise=fn(id,assertCurrent,group?async()=>{events.push('retireGroup');}:null).catch(e=>{error=e;});
 if(delay){assert.deepEqual(events,['list']);gate.resolve();}await promise;assert.equal(JSON.stringify(retained),before);
 return {events,error,checks};
}
const rows=[];let passed=0;
async function check(name,fn){await fn();rows.push({name,pass:true});passed++;}
const baseline=await run(original,{rows:[]});assert.deepEqual(baseline.events,['list','select','close']);assert.equal(baseline.error,undefined);
await check('missing direct conversation no longer claims successful open',async()=>{const r=await run(source,{rows:[]});assert.deepEqual(r.events,['list']);assert.equal(r.error.code,'conversation_not_visible');});
await check('a different visible thread does not confirm Karen',async()=>{const r=await run(source,{rows:[{id:other,type:'direct'}]});assert.deepEqual(r.events,['list']);assert.equal(r.error.code,'conversation_not_visible');});
await check('visible direct conversation opens once with no group retirement',async()=>{const r=await run(source);assert.deepEqual(r.events,['list','select','close']);assert.equal(r.error,undefined);});
await check('a visible read-only thread stays openable without granting send authority',async()=>{const r=await run(source,{rows:[{id,type:'direct',canSend:false}]});assert.equal(r.error,undefined);assert.deepEqual(r.events,['list','select','close']);});
await check('hidden group never retires its saved original',async()=>{const r=await run(source,{rows:[],group:true});assert.deepEqual(r.events,['list']);assert.ok(r.error);});
await check('visible group retires its original before selection',async()=>{const r=await run(source,{rows:[{id,type:'group'}],group:true});assert.deepEqual(r.events,['list','retireGroup','select','close']);});
await check('wrong group type retains original',async()=>{const r=await run(source,{group:true});assert.deepEqual(r.events,['list']);assert.ok(r.error);});
await check('owner loss before list makes no list or local effect',async()=>{const r=await run(source,{withdrawAt:1});assert.deepEqual(r.events,[]);assert.ok(r.error);});
await check('owner loss after delayed list cannot select or close',async()=>{const r=await run(source,{withdrawAt:2,delay:true});assert.deepEqual(r.events,['list']);assert.ok(r.error);});
await check('list failure retains dialog and original',async()=>{const r=await run(source,{listFailure:true,group:true});assert.deepEqual(r.events,['list']);assert.ok(r.error);});
await check('owner loss after group retirement still prevents selection and close',async()=>{const r=await run(source,{rows:[{id,type:'group'}],group:true,withdrawAt:3});assert.deepEqual(r.events,['list','retireGroup']);assert.ok(r.error);});
await check('fixed unavailable guidance is separate from group recovery and raw errors',async()=>{assert.ok(source.includes("error?.code === 'conversation_not_visible' ? 'This conversation is not available in your current list. It was not opened.'"));assert.ok(source.includes("'Group result not confirmed. The original group is saved.'"));});
await check('Reopen Messages still invokes access-recovery reload, not a thread visibility mutation',async()=>{
 const pattern=/\{accessBlocked && <button[^\n]+onClick=\{\(\) => (window\.location\.reload\(\))\}>Reopen Messages<\/button>\}/;const m=pattern.exec(source);assert.ok(m);let reloads=0;vm.runInNewContext(m[1],{window:{location:{reload(){reloads++;}}}});assert.equal(reloads,1);assert.equal(m[0],pattern.exec(original)[0]);
});
const result={scope:'Current JSX callback executed with synthetic dependencies; no app bundle/build, mounted browser, API, message, storage or device action',baselineHiddenFalseSuccessReproduced:true,candidatePassed:passed,cases:rows,deletionAndMessagesUnchanged:true,liveFreezeCauseVerified:false,durableThreadReopenFixed:false};
console.log(JSON.stringify(result,null,2));if(process.env.MZ_PRESENCE_RESULTS)writeFileSync(process.env.MZ_PRESENCE_RESULTS,JSON.stringify(result,null,2)+'\n');
