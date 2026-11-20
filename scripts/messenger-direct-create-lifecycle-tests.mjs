// Actual NewConversation JS and parent callback in VM; synthetic hooks/API only.
// This does not mount React, emit an app bundle, send a live message or touch a phone.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const source=readFileSync(new URL('../mobile/src/chatscope/app.jsx',import.meta.url),'utf8');
const begin=source.indexOf('function NewConversation('),end=source.indexOf('  return <div',begin);
assert.ok(begin>0&&end>begin);
const marker='onCreated={async (id,assertCurrent,retireOriginal) => {';
const at=source.indexOf(marker),last=source.indexOf(' }} />}',at);
assert.ok(at>0&&last>at);
const parent='async (id,assertCurrent,retireOriginal) => {'+source.slice(at+marker.length,last)+' }';
const id=n=>`da000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=id(1),peer=id(2),intent=id(3),thread=id(4);
function fixture({rows=[{id:thread,type:'direct'}],employee=false,readOnly=false}={}){
 const calls=[],local=[],statuses=[],effects=[],events=[];
 let clock=Date.parse('2026-11-19T18:00:00Z'),stateIndex=0,device='SYNTHETIC_DEVICE';
 const mapped={msg_user_id:actor,read_only:readOnly,canonical_device_id:device};let current=mapped;
 const session={token:'SYNTHETIC_NOT_A_CREDENTIAL',role:'ops_manager',access_level:'full_access',read_only:false,device_id:device,expires_at:'2026-11-20T18:00:00Z',permissions:{schema:'custodial.manager-permissions.v1',read:true}};
 const storage={getItem(){return null;},setItem(){local.push('set');},removeItem(){local.push('remove');}};
 class Clock extends Date {constructor(...args){super(...(args.length?args:[clock]));} static now(){return clock;}}
 const ctx={Date:Clock,Error,Object,Set,JSON,crypto:webcrypto,isUuid:v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v),EMPLOYEE_CONTEXT:employee,
  useRef:value=>({current:value}),useEffect:fn=>effects.push(fn),useState:initial=>{const index=stateIndex++;let value=typeof initial==='function'?initial():initial;if(index===2&&!employee)value=new Set([peer]);return[value,next=>{value=typeof next==='function'?next(value):next;if(index===4)statuses.push(value);if(index===6)events.push(['busy',value]);}];},
  readOriginalGroupIntent:()=>({row:null,raw:null,legacyRaw:null,held:false}),deviceId:()=>device,custodialEmployeeMessage:()=>false,localStorage:storage,sessionStorage:storage,
  window:{MemphisAuth:{readSession:()=>session}},document:{activeElement:null},
  mutateCustodialWork:async()=>{throw Error('Unexpected direct storage mutation');},
  api:async(path,args)=>{calls.push({path,body:structuredClone(args.body)});args.assertCurrent?.();if(path==='/thread/direct-intent')return{ok:true,meta:{open_protocol:2},data:{intent_id:intent,request_id:args.body.request_id}};return{ok:true,data:{id:thread}};},
  loadThreads:async({assertCurrent})=>{assertCurrent?.();events.push(['list']);return rows;},selectThread:id=>events.push(['select',id]),setNewConversation:v=>events.push(['dialog',v]),
 };
 vm.createContext(ctx);vm.runInContext('globalThis.parent='+parent+';'+source.slice(begin,end)+'return {create,unmount:()=>{alive.current=false;},attempt:()=>directAttempt.current};}\nglobalThis.dialog=NewConversation({currentUserId:'+JSON.stringify(actor)+',currentDeviceId:"SYNTHETIC_DEVICE",getCurrentIdentity:()=>globalThis.getIdentity(),onClose:()=>{},onCreated:globalThis.parent});',Object.assign(ctx,{getIdentity:()=>current}));
 return{ctx,calls,local,statuses,events,run:()=>ctx.dialog.create(peer),unmount:()=>ctx.dialog.unmount(),attempt:()=>ctx.dialog.attempt(),advance:ms=>clock+=ms,changeOwner:()=>{current={...mapped};},changeDevice:()=>{device='OTHER_SYNTHETIC_DEVICE';}};
}
let passed=0;const failures=[];
async function check(name,run){try{await run();passed++;}catch(error){failures.push({name,error:error.message});}}
await check('complete direct create lists and selects before closing without persistent write',async()=>{const f=fixture();await f.run();assert.equal(f.calls.length,2);assert.deepEqual(f.events.filter(e=>e[0]!=='busy'),[['list'],['select',thread],['dialog',false]]);assert.deepEqual(f.local,[]);});
await check('employee uses the same original-owner protected direct protocol',async()=>{const f=fixture({employee:true});await f.run();assert.equal(f.calls.length,2);assert.equal(f.calls[0].body.created_by_user_id,actor);assert.deepEqual(f.local,[]);});
await check('hidden thread retains dialog and gives missing-list guidance',async()=>{const f=fixture({rows:[]});await f.run();assert.ok(f.statuses.includes('This conversation is not available in your current list. It was not opened.'));assert.ok(!f.events.some(e=>e[0]==='select'||e[0]==='dialog'));assert.deepEqual(f.local,[]);});
await check('uncertain issuer retries identical request identity and timestamp',async()=>{const f=fixture(),api=f.ctx.api;let first=true;f.ctx.api=async(...args)=>{const result=await api(...args);if(first){first=false;throw Error('Synthetic lost issuer response');}return result;};await f.run();await f.run();assert.deepEqual(f.calls[0].body,f.calls[1].body);assert.equal(f.calls.length,3);});
await check('uncertain consume retries same server intent without reissuance',async()=>{const f=fixture(),api=f.ctx.api;let first=true;f.ctx.api=async(...args)=>{const result=await api(...args);if(first&&args[0]==='/thread/direct'){first=false;throw Error('Synthetic lost consume response');}return result;};await f.run();await f.run();assert.equal(f.calls.length,3);assert.deepEqual(f.calls[1].body,f.calls[2].body);});
await check('concurrent tap cannot mint a second request',async()=>{const f=fixture(),api=f.ctx.api;let release;f.ctx.api=async(...args)=>{if(args[0]==='/thread/direct-intent')await new Promise(r=>{release=r;});return api(...args);};const pending=f.run();await f.run();assert.equal(f.calls.length,0);release();await pending;assert.equal(f.calls.length,2);});
await check('owner change after issuance blocks consume and selection',async()=>{const f=fixture(),api=f.ctx.api;f.ctx.api=async(...args)=>{const result=await api(...args);f.changeOwner();return result;};await f.run();assert.equal(f.calls.length,1);assert.ok(!f.events.some(e=>e[0]==='select'));});
await check('device change after issuance blocks consume and selection',async()=>{const f=fixture(),api=f.ctx.api;f.ctx.api=async(...args)=>{const result=await api(...args);f.changeDevice();return result;};await f.run();assert.equal(f.calls.length,1);assert.ok(!f.events.some(e=>e[0]==='select'));});
await check('late issuance after dialog retirement cannot consume or publish status',async()=>{const f=fixture(),api=f.ctx.api;let release;f.ctx.api=async(...args)=>{await new Promise(r=>{release=r;});return api(...args);};const pending=f.run();const statuses=f.statuses.length;f.unmount();release();await pending;assert.equal(f.calls.length,1);assert.equal(f.statuses.length,statuses);assert.ok(!f.events.some(e=>e[0]==='select'));});
await check('read-only owner cannot issue or mutate anything',async()=>{const f=fixture({readOnly:true});await f.run();assert.equal(f.calls.length,0);assert.deepEqual(f.local,[]);});
await check('expired uncertain attempt is held and explains deliberate renewal',async()=>{const f=fixture(),api=f.ctx.api;f.ctx.api=async(...args)=>{const r=await api(...args);if(args[0]==='/thread/direct')throw Error('Synthetic uncertain consume');return r;};await f.run();const count=f.calls.length,original=f.attempt();f.advance(15*60*1000);await f.run();assert.equal(f.calls.length,count);assert.equal(f.attempt(),original);assert.ok(f.statuses.includes('This open request expired. Close this window and choose the person again.'));});
await check('singleton-array direct result remains supported',async()=>{const f=fixture(),api=f.ctx.api;f.ctx.api=async(...args)=>{const r=await api(...args);return args[0]==='/thread/direct'?{...r,data:[r.data]}:r;};await f.run();assert.ok(f.events.some(e=>e[0]==='select'&&e[1]===thread));});
console.log(JSON.stringify({scope:'Actual current create/owner and parent callbacks with synthetic hooks and HTTP dependencies; no mounted React or emitted app',passed,failed:failures.length,failures},null,2));if(failures.length)process.exitCode=1;
