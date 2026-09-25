import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../schedule-weekly.html',import.meta.url),'utf8');
const source=page.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/^init\(\)\.catch\([^\n]+$/m,'');
let checks=0;
function check(value,expected,label){assert.deepEqual(value,expected,label);checks++;}
function fixture(){
 const nodes=new Map(),events=new Map(),timers=new Map();let timerId=0;
 const on=(target,type,fn)=>{const key=target+':'+type;if(!events.has(key))events.set(key,[]);events.get(key).push(fn);};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,open:false,dataset:{},textContent:'',classList:{toggle(){}},replaceChildren(){},addEventListener(type,fn){on(id,type,fn);}});return nodes.get(id);};
 const choice=node('synthetic-callout');choice.dataset.calloutSlot='synthetic-slot';choice.checked=false;
 const document={hidden:false,getElementById:node,querySelectorAll:selector=>selector==='[data-callout-slot],[data-contractor-row] input'?[choice]:[],addEventListener:(type,fn)=>on('document',type,fn)};
 const context=vm.createContext({console,URL,URLSearchParams,AbortController,document,navigator:{onLine:true},
  location:{search:'?date=2026-09-24',hash:''},crypto:{randomUUID:()=> 'test-operation'},
  window:{lucide:{createIcons(){}},MemphisAuth:{requireOpsManagerSession:async()=>({manager_id:'10000000-0000-4000-8000-000000000001'}),getCSTDateString:()=> '2026-09-24'},
   MemphisStaffingCommand:{createStaffingCommandCoordinator:()=>({hasPending:()=>false,recover:async()=>null})},
   addEventListener:(type,fn)=>on('window',type,fn),setInterval:fn=>{timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id),
   setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)}});
 const run=code=>vm.runInContext(code,context);run(source);
 run(`globalThis.calls=[];globalThis.rendered=[];globalThis.nextRevision=8;globalThis.pendingRead=null;globalThis.failRead=false;
  state.baseUrl='https://synthetic.invalid';state.snapshot={week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:7,drafts:[],current_publication:{publication_id:'p'}};
  els.week_start.value='2026-09-21';els.service_date.value='2026-09-24';
  clearCoverAllPdfs=()=>{};render=()=>{rendered.push(state.snapshot.authority_revision);};
  api=async(path,options={})=>{calls.push({path,method:options.method||'GET'});if(pendingRead)return pendingRead;if(failRead)throw Error('synthetic offline');return {week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:nextRevision,drafts:[],current_publication:{publication_id:'p'}};};`);
 const emit=async(target,type,event={})=>{for(const fn of events.get(target+':'+type)||[])await fn(event);await Promise.resolve();await Promise.resolve();};
 const json=code=>JSON.parse(run('JSON.stringify('+code+')'));
 return {run,json,node,context,document,events,timers,emit};
}
{
 const f=fixture();assert.equal(f.run('typeof installScheduleAutoRefresh'),'function','manager refresh implementation exists');checks++;
 f.run('installScheduleAutoRefresh();installScheduleAutoRefresh()');
 for(const [target,type] of [['window','online'],['window','memphis:schedule-refresh'],['window','memphis:native-notification-received'],['document','visibilitychange']]){
  check(f.events.get(target+':'+type)?.length,1,'one listener '+type);
  const before=f.run('calls.length');await f.emit(target,type);check(f.run('calls.length'),before+1,type+' requests current snapshot');
 }
 check(f.json('calls.map(c=>c.method)'),['GET','GET','GET','GET'],'refresh never publishes or rebalances');
 check(f.run('state.snapshot.authority_revision'),8,'current accepted revision rendered');
 check(f.timers.size,1,'one product refresh interval, no orphan timeouts');
 await f.emit('window','pagehide');check(f.timers.size,0,'pagehide clears product interval');
 await f.emit('window','pageshow');check(f.timers.size,1,'bfcache return reinstalls one interval');
}
for(const blocker of ['state.busy=true','state.dayChangeRequest={date:"2026-09-24",encoded:"EXACT",accepted:false}',
 'state.dayChangeRequest={date:"2026-09-24",encoded:"EXACT",accepted:true}','state.turnoverRequest={body:{id:"ORIGINAL"}}',
 'state.staffingCommandState={operationId:"pending"}',
 'state.scheduleInputDirty=true','els.action_confirm_dialog.open=true','els.turnover_dialog.open=true','document.hidden=true','navigator.onLine=false']){
 const f=fixture();f.run(blocker);const pending=f.json('state.dayChangeRequest||state.turnoverRequest||null');
 await f.run('requestScheduleRefresh()');check(f.run('calls.length'),0,'defer while '+blocker);
 check(f.run('state.scheduleRefreshQueued'),true,'remember deferred refresh');
 check(f.json('state.dayChangeRequest||state.turnoverRequest||null'),pending,'preserve exact command');
}
{
 const f=fixture();f.run('state.scheduleInputDirty=true');await f.run('requestScheduleRefresh()');
 f.run('state.scheduleInputDirty=false');await f.run('flushScheduleRefresh()');
 check(f.run('calls.length'),1,'deferred refresh resumes when edit is resolved');
 check(f.run('state.scheduleRefreshQueued'),false,'successful refresh settles flag');
}
{
 const f=fixture();f.run('globalThis.release=null;pendingRead=new Promise(r=>release=r)');
 const first=f.run('requestScheduleRefresh()');await Promise.resolve();
 await f.run('requestScheduleRefresh()');await f.run('requestScheduleRefresh()');
 check(f.run('calls.length'),1,'bursty signals do not overlap fetches');
 f.run('release({week_start:"2026-09-21",week_end:"2026-09-27",authority_revision:8})');await first;
 check(f.run('state.scheduleRefreshQueued'),true,'a signal during read remains queued for next safe pass');
 check(f.run('state.busy'),false,'release read controls');
}
for(const mutation of ['els.week_start.value="2026-09-28"','state.scheduleInputEpoch=(state.scheduleInputEpoch||0)+1','state.snapshot.authority_revision=10']){
 const f=fixture();f.run('globalThis.release=null;pendingRead=new Promise(r=>release=r)');
 const first=f.run('requestScheduleRefresh()');await Promise.resolve();f.run(mutation);
 f.run('release({week_start:"2026-09-21",week_end:"2026-09-27",authority_revision:8})');await first;
 check(f.run('rendered.length'),0,'late response cannot replace current selection/revision: '+mutation);
 check(f.run('state.scheduleRefreshQueued'),true,'stale read remains pending');
}
{
 const f=fixture();f.run('nextRevision=6');await f.run('requestScheduleRefresh()');
 check(f.run('state.snapshot.authority_revision'),7,'older response never regresses displayed authority');
 check(f.run('rendered.length'),0,'older revision not rendered');
}
{
 const f=fixture();f.run('failRead=true');await f.run('requestScheduleRefresh()');
 check(f.run('state.snapshot.authority_revision'),7,'outage retains last snapshot');
 check(f.run('state.scheduleRefreshQueued'),true,'outage remains pending');
 check(f.run('state.busy'),false,'failed read releases controls');
 check(f.run('state.scheduleRefreshRunning'),false,'failed read releases owner');
 f.run('failRead=false');await f.run('requestScheduleRefresh()');check(f.run('state.snapshot.authority_revision'),8,'reconnect recovers without mutation');
}
{
 const f=fixture();
 f.context.fetch=async()=>({ok:true,json:async()=>({ok:true,data:{public_url:'https://synthetic.invalid'}})});
 f.run('applyHashRoute=()=>{}');await f.run('init()');
 check(f.run('state.scheduleRefreshInstalled'),true,'actual authenticated startup installs refresh');
 check(f.run('calls.length'),1,'startup performs one snapshot read');
 await f.emit('window','online');check(f.run('calls.length'),2,'actual init receives reconnect event');
}
{
 const f=fixture();f.run('installScheduleAutoRefresh()');
 f.node('synthetic-callout').checked=true;
 await f.emit('document','input',{target:{closest:()=>({})}});
 check(f.run('state.scheduleInputDirty'),true,'input protects unconfirmed choices');
 check(f.run('state.scheduleInputEpoch'),1,'edit invalidates in-flight read');
 await f.emit('window','online');check(f.run('calls.length'),0,'reconnect preserves in-progress selections');
}
{
 const f=fixture();f.run(`api=async(path,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('bounded abort'))));`);
 const read=f.run('requestScheduleRefresh()');await Promise.resolve();
 check(f.timers.size,1,'one bounded automatic read timeout');
 [...f.timers.values()][0]();await read;
 check(f.run('state.busy'),false,'timeout releases controls');
 check(f.run('state.scheduleRefreshQueued'),true,'timeout retains pending refresh');
 check(f.run('state.snapshot.authority_revision'),7,'timeout retains last displayed revision');
 check(f.timers.size,0,'timeout callback resource cleaned');
}
{
 const f=fixture();f.run('installScheduleAutoRefresh();globalThis.release=null;pendingRead=new Promise(r=>release=r)');
 const read=f.run('requestScheduleRefresh()');await Promise.resolve();await f.emit('window','pagehide');
 f.run('release({week_start:"2026-09-21",week_end:"2026-09-27",authority_revision:8})');await read;
 check(f.run('rendered.length'),0,'late response after pagehide cannot render');
 check(f.timers.size,0,'pagehide and settled request leave no timer');
}
for(const bad of ['null','{week_start:"2026-09-28",week_end:"2026-10-04",authority_revision:8}',
 '{week_start:"2026-09-21",week_end:"bad",authority_revision:8}',
 '{week_start:"2026-09-21",week_end:"2026-09-27",authority_revision:"8"}',
 '{week_start:"2026-09-21",week_end:"2026-09-27",authority_revision:-1}']){
 const f=fixture();f.run('api=async()=>('+bad+')');await f.run('requestScheduleRefresh()');
 check(f.run('state.snapshot.authority_revision'),7,'invalid reply preserves current snapshot');
 check(f.run('state.scheduleRefreshQueued'),true,'invalid reply cannot settle refresh');
}
{
 const f=fixture();f.run('state.dayChangeRequest={date:"2026-09-24",encoded:"EXACT",accepted:true};globalThis.release=null;pendingRead=new Promise(r=>release=r)');
 const read=f.run('refreshSnapshot()');await Promise.resolve();f.run('els.week_start.value="2026-09-28"');
 f.run('release({week_start:"2026-09-21",week_end:"2026-09-27",authority_revision:8})');
 await assert.rejects(read,/selected week changed/);checks++;
 check(f.run('state.dayChangeRequest.encoded'),'EXACT','manual read rejection preserves command bytes');
 check(f.run('state.dayChangeRequest.accepted'),true,'known acceptance remains known');
 check(f.run('rendered.length'),0,'manual stale read cannot be treated as completed refresh');
}
console.log(JSON.stringify({status:'PASS_MANAGER_REFRESH_SOURCE',checks,limits:'Actual page handlers; synthetic DOM/auth/transport/timers. No live manager/device/SQL/revision-delivery proof.'}));
