import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHomeAssistantEntry} from '../mobile/src/chatscope/home-assistant-entry.mjs';

// NEW mount-adapter cases on actual current source body. Previously completed
// task-local five helper cases are not repeated. No whole React app/browser,
// service, SQL, native device, credentials or API connection is invoked.
const app=fs.readFileSync(new URL('../mobile/src/chatscope/app.jsx',import.meta.url),'utf8');
const home=fs.readFileSync(new URL('../mobile/src/custodial/index.html',import.meta.url),'utf8');
const match=app.match(/const resolveHomeAssistant = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[currentDeviceId, deviceIdentity\.generation, loadIdentity, loadThreads, selectThread\]\);/);
assert.ok(match,'actual bounded source adapter must exist');
assert.match(home,/id="home-memphis"[^>]+assistant=memphis/);
assert.match(app,/EMPLOYEE_CONTEXT && PAGE_URL\.searchParams\.get\('assistant'\) === 'memphis'/);
assert.match(app,/await resolveHomeAssistant\(\);\s*await retryOutbox\(\);/,'explicit Home assistant must not be blocked behind unrelated outbox failure');
assert.match(app,/void resolveHomeAssistant\(\)\.catch\(error => setNotice\(safe\(error\), 'error'\)\);\s*void retryOutbox\(\)\.catch/,'online/resume assistant request remains independent from unrelated retry result');
assert.match(app,/const selectThread = useCallback\(\(id\) => \{\s*homeAssistantEntry\.current\.cancel\(\);/);
assert.match(app,/const withdraw = \(\) => \{\s*homeAssistantEntry\.current\.cancel\(\);/);
assert.equal((app.match(/setInterval\([\s\S]{0,250}resolveHomeAssistant/g)||[]).length,0,'no new assistant polling');
let checks=8;
const id='10000000-0000-4000-8000-000000000001';
function fixture(){const actor={msg_user_id:'synthetic-user',read_only:false};const calls=[],selected=[];
 const ctx={accessEpoch:{current:1},selectedRef:{current:''},deviceIdentity:{generation:7},mounted:{current:true},
  identityRef:{current:actor},currentDeviceId:'synthetic-device',homeAssistantEntry:{current:createHomeAssistantEntry(true)},
  actualDevice:'synthetic-device',actualGeneration:7,pending:new Set(),window:{MemphisCustodialSecurity:{getStatus:()=>({generation:ctx.actualGeneration})}},
  deviceId:()=>ctx.actualDevice,isNativeCustodialAuthority:()=>true,loadIdentity:async()=>actor,
  pendingDeletedThreadIds:()=>ctx.pending,loadThreads:async()=>[{id,type:'bot',is_active:true}],
  api:async(p,options)=>{calls.push({p,options});return {ok:true,data:{id,thread_type:'bot',is_active:true}};},
  selectThread:value=>selected.push(value)};
 const run=vm.runInNewContext('(function(){'+match[1]+'\n})',ctx,{timeout:1000});
 return {ctx,actor,calls,selected,run};}
async function test(name,run){await run();checks++;console.log('PASS '+name);}
await test('actual adapter binds mapped employee device and selects verified bot',async()=>{const f=fixture();assert.equal(await f.run(),true);assert.deepEqual(f.calls[0].options.body,{user_id:f.actor.msg_user_id,device_id:'synthetic-device'});assert.equal(f.calls[0].p,'/memphis/thread');assert.deepEqual(f.selected,[id]);});
for(const [name,change]of [
 ['withdrawn epoch',f=>f.ctx.accessEpoch.current++],['unmounted owner',f=>f.ctx.mounted.current=false],
 ['changed mapped actor',f=>f.ctx.identityRef.current={...f.actor,msg_user_id:'other'}],
 ['different current device',f=>f.ctx.actualDevice='other-device'],['changed native generation',f=>f.ctx.actualGeneration=8],
 ['read-only mapped actor',f=>f.actor.read_only=true],['manual thread selection',f=>f.ctx.selectedRef.current='other-thread'],
])await test('late reply refuses '+name,async()=>{const f=fixture();f.ctx.api=async()=>{change(f);return {ok:true,data:{id,thread_type:'bot',is_active:true}};};assert.equal(await f.run(),false);assert.deepEqual(f.selected,[]);});
await test('pending current actor deletion blocks callback before API',async()=>{const f=fixture();f.ctx.pending.add('pending-delete');await assert.rejects(f.run(),/saved conversation deletion/);assert.equal(f.calls.length,0);assert.deepEqual(f.selected,[]);});
await test('unverified filtered thread list never selects response id',async()=>{const f=fixture();f.ctx.loadThreads=async()=>[];await assert.rejects(f.run(),/load your Memphis conversation/);assert.deepEqual(f.selected,[]);});
await test('generation drift while thread list is read cannot select',async()=>{const f=fixture();f.ctx.loadThreads=async()=>{f.ctx.actualGeneration++;return [{id,type:'bot',is_active:true}];};assert.equal(await f.run(),false);assert.deepEqual(f.selected,[]);});
console.log(JSON.stringify({status:'SOURCE_ADAPTER_PASS',checks,actual_source_adapter:true,React_browser_SQL_or_phone:false,unaffected_five_helper_cases_rerun:false}));
