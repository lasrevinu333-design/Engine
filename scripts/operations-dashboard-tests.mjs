// Frozen synthetic Source-test context: selected scheduler/runtime/shared callable bodies
// are separate from the exact HISTORICAL1043 artifact snapshot. Neither proves
// a current generated backend release, deployed server, SQL or named-manager action.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
// Main imports only the new owning callable; old node:test groups must not run.
const hubBindingOnly=process.argv.includes('--ops-hub-binding-only');
const hubBindingFollowupsOnly=process.argv.includes('--ops-hub-binding-followups-only');
const hubBindingFirstOnly=process.argv.includes('--ops-hub-binding-first-only');
const test=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)
 ?(name,...args)=>{if(hubBindingFirstOnly?name==='OPS_HUB_BINDING_NEW device changed during original session await cannot publish'
   :hubBindingFollowupsOnly?name.startsWith('OPS_HUB_BINDING_NEW ')&&!name.includes('device changed during original session await')
   :hubBindingOnly?name.startsWith('OPS_HUB_BINDING_NEW '):!name.startsWith('OPS_HUB_BINDING_NEW '))return nodeTest(name,...args);}:()=>{};
const require=createRequire(import.meta.url),D=require('../operations-dashboard-data.js');
const ui=readFileSync(new URL('../operations-dashboard.js',import.meta.url),'utf8');
const noon=Date.parse('2026-10-05T17:00:00Z');

// Existing VM/source-DOM facilities, focused on the actual dashboard.html
// owning refresh and normal ticket controller. Startup/version timers are not
// this member; no browser, auth storage, real token, HTTP or backend mutation.
function dashboardRefreshFixture(){
 const nodes=new Map(),calls=[],gates={summary:[],enrich:[],tickets:[],close:[]},capabilityRequests=[];
 let session={role:'ops_manager',manager_id:'98000000-0000-4000-8000-000000000001',credential_id:'98000000-0000-4000-8000-000000000002',
  device_id:'KIOSK_02',token:'SYNTHETIC-dashboard-session',expires_at:'2030-01-01T00:00:00.000Z',access_level:'full_access',read_only:false,
  roles:['CUSTODIAL_MANAGER'],permissions:{schema:'custodial.manager-permissions.v1',read:true,close_scan_tickets:true}};
 const node=id=>{if(!nodes.has(id)){const classes=new Set(),events=new Map();nodes.set(id,{id,textContent:'',innerHTML:'',disabled:false,open:false,value:'',returnValue:'',
  classList:{toggle(k,on){on?classes.add(k):classes.delete(k);},add:k=>classes.add(k),remove:k=>classes.delete(k)},
  querySelectorAll(){return [];},addEventListener(type,callback,options){const list=events.get(type)||[];list.push({callback,once:options?.once});events.set(type,list);},
  close(){this.open=false;const list=events.get('close')||[];events.set('close',list.filter(entry=>!entry.once));for(const entry of list)entry.callback();},showModal(){this.open=true;},focus(){}});}return nodes.get(id);};
 const response=data=>({ok:true,status:200,json:async()=>data});
 const summary=(label,{active=false}={})=>({ok:true,data:{meta:{version:label},restrooms:[{location_code:label,location_name:label,
  status_code:active?'cleaning_in_progress':'okay',latest_employee_name:label,services_performed:[]}],exhibits:[],
  open_tickets:[{ticket_id:'98000000-0000-4000-8000-000000000003',location_name:label,maintenance_issue:label,reported_by:'SYNTHETIC'}]}});
 const wait=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
 const enqueue=(kind,value)=>{const started=wait(),released=wait();const gate={started:started.promise,release:released.resolve,reject:released.reject};
  gates[kind].push(async()=>{started.resolve();await released.promise;return typeof value==='function'?value():value;});return gate;};
 const auth={readSession:()=>session,requireOpsManagerSession:async()=>session,opsManagerAuthHeaders:async()=>({Authorization:'Bearer '+session?.token,'X-Device-Id':session?.device_id})};
 const fetch=async(url,options={})=>{
  calls.push({url,options});
  if(url.endsWith('/summary'))return gates.summary.length?gates.summary.shift()():response(summary('default'));
  if(url.endsWith('/current-attendance'))return response({ok:true,data:{attendance:12}});
  if(url.endsWith('/rpc'))return gates.enrich.length?gates.enrich.shift()():response({ok:true,data:{latest_session_status:'active',latest_employee_name:'enriched',started_at:'2026-10-05T16:00:00Z'}});
  if(url.includes('/ticket-capabilities')){
   capabilityRequests.push(url);if(gates.tickets.length)return gates.tickets.shift()();
   const ids=new URL(url).searchParams.get('ids').split(',');
   return response({ok:true,data:{schema:'custodial.ticket-capabilities.v1',manager_id:session.manager_id,credential_id:session.credential_id,
    tickets:ids.map(ticket_id=>({ticket_id,found:true,status:'open',scan_session_verified:true,can_close:true}))}});
  }
  if(url.endsWith('/close-ticket')){if(gates.close.length)return gates.close.shift()();const body=JSON.parse(options.body);return response({ok:true,data:{ticket_id:body.ticket_id,status:'closed',outcome:body.outcome,external_work_order_reference:body.external_work_order_reference,closed_at:'2026-10-13T12:00:00.000Z',closed_by:'SYNTHETIC fixture manager'}});}
  return response({ok:true,data:[]});
 };
 const window={location:{href:'https://fixture.invalid/dashboard.html',hash:'',replace(){throw Error('Unexpected stale reload');}},MemphisAuth:auth};
 const document={getElementById:node,querySelectorAll:()=>[]};
 const context=vm.createContext({window,document,MemphisAuth:auth,fetch,URL,URLSearchParams,AbortSignal,Date,console:{error(){},warn(){}},
  localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null,setItem(){}},setInterval(){throw Error('Unexpected startup timer');},setTimeout});
 vm.runInContext(readFileSync(new URL('../memphis-ticket-actions.js',import.meta.url),'utf8'),context);
 window.MemphisTicketActions=context.MemphisTicketActions;
 const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
 const inline=html.match(/<script>\s*(const CONFIG=[\s\S]*?)<\/script>/)[1].replace(/^\s*init\(\);\s*$/m,'');
 vm.runInContext(inline+'\nglobalThis.owningDashboard={refreshData,closeTicket,renderDashboardViews,refreshGpsFreshness,state:dashboardState,get ticketActions(){return ticketActions;}};',context);
 return{page:context.owningDashboard,nodes,node,calls,auth,window,summary,response,enqueue,capabilityRequests,
  session:()=>session,setSession:value=>{session=value;},turn:()=>new Promise(r=>setImmediate(r))};
}
test('DASHBOARD_REFRESH_newest owning refresh wins deferred old response',async()=>{
 const f=dashboardRefreshFixture(),slow=f.enqueue('summary',f.response(f.summary('older')));
 const old=f.page.refreshData();await slow.started;
 const fast=f.enqueue('summary',f.response(f.summary('newest')));const next=f.page.refreshData();await fast.started;fast.release();await next;
 const text=f.node('restroom-wrap').innerHTML,status=f.node('refresh-status').textContent;
 slow.release();await old;assert.equal(f.page.state.restrooms[0].location_code,'newest');
 assert.equal(f.node('restroom-wrap').innerHTML,text);assert.equal(f.node('refresh-status').textContent,status);
 assert.doesNotMatch(f.node('tickets-wrap').innerHTML,/older/);assert.match(status,/Last refresh/);
});
const dashboardTicketId='98000000-0000-4000-8000-000000000003';
function assertDashboardWithdrawn(f){
 for(const key of ['restrooms','exhibits','tickets','workAlerts'])assert.equal(f.page.state[key].length,0,key);
 for(const id of ['restroom-wrap','exhibit-wrap','tickets-wrap'])assert.match(f.node(id).innerHTML,/Dashboard access changed/);
 assert.equal(f.node('tiles').innerHTML,'');assert.equal(f.node('attendance-time').textContent,'--');
 assert.equal(f.page.ticketActions.status(dashboardTicketId),null);assert.doesNotMatch(f.node('tickets-wrap').innerHTML,/closeBtn/);
 assert.match(f.node('refresh-status').textContent,/access changed/);assert.doesNotMatch(f.node('refresh-status').textContent,/Last refresh|Refresh failed|verified/);
 f.page.renderDashboardViews();f.page.refreshGpsFreshness();assert.match(f.node('tickets-wrap').innerHTML,/Dashboard access changed/);
}
async function publishDashboard(f,label='current'){
 const gate=f.enqueue('summary',f.response(f.summary(label))),pending=f.page.refreshData();await gate.started;gate.release();await pending;
}
test('DASHBOARD_REFRESH_old enrichment cannot publish rows or build stamp',async()=>{
 const f=dashboardRefreshFixture(),summary=f.enqueue('summary',f.response(f.summary('old-active',{active:true}))),scan=f.enqueue('enrich',f.response({ok:true,meta:{version:'stale-enrichment'},data:{latest_session_status:'active',latest_employee_name:'old employee'}}));
 const old=f.page.refreshData();await summary.started;summary.release();await scan.started;await publishDashboard(f,'newest');
 const stamp=f.node('build-stamp').textContent,status=f.node('refresh-status').textContent;scan.release();await old;
 assert.equal(f.page.state.restrooms[0].location_code,'newest');assert.equal(f.node('build-stamp').textContent,stamp);assert.equal(f.node('refresh-status').textContent,status);
 assert.doesNotMatch(f.node('restroom-wrap').innerHTML,/old employee|old-active/);
});
test('DASHBOARD_REFRESH_old ticket-access failure cannot clear newer eligibility',async()=>{
 const f=dashboardRefreshFixture(),summary=f.enqueue('summary',f.response(f.summary('old'))),access=f.enqueue('tickets');
 const old=f.page.refreshData();await summary.started;summary.release();await access.started;await publishDashboard(f,'newest');
 const status=f.node('refresh-status').textContent;assert.equal(f.page.ticketActions.status(dashboardTicketId).can_close,true);
 access.reject(Error('old access failure'));await old;assert.equal(f.page.ticketActions.status(dashboardTicketId).can_close,true);
 assert.match(f.node('tickets-wrap').innerHTML,/closeBtn/);assert.equal(f.node('refresh-status').textContent,status);assert.equal(f.page.state.tickets[0].location_name,'newest');
});
test('DASHBOARD_REFRESH_old successful ticket access cannot replace newer read-only result',async()=>{
 const f=dashboardRefreshFixture(),summary=f.enqueue('summary',f.response(f.summary('old'))),s=f.session(),access=f.enqueue('tickets',f.response({ok:true,data:{schema:'custodial.ticket-capabilities.v1',manager_id:s.manager_id,credential_id:s.credential_id,tickets:[{ticket_id:dashboardTicketId,found:true,status:'open',scan_session_verified:true,can_close:true}]}}));
 const old=f.page.refreshData();await summary.started;summary.release();await access.started;
 const newerAccess=f.enqueue('tickets',f.response({ok:true,data:{schema:'custodial.ticket-capabilities.v1',manager_id:s.manager_id,credential_id:s.credential_id,tickets:[{ticket_id:dashboardTicketId,found:true,status:'open',scan_session_verified:true,can_close:false}]}}));newerAccess.release();
 await publishDashboard(f,'newest');access.release();await old;assert.equal(f.page.ticketActions.status(dashboardTicketId).can_close,false);assert.match(f.node('tickets-wrap').innerHTML,/Read only/);assert.doesNotMatch(f.node('tickets-wrap').innerHTML,/closeBtn/);
});
test('DASHBOARD_REFRESH_superseded summary failure cannot replace success status',async()=>{
 const f=dashboardRefreshFixture(),gate=f.enqueue('summary'),old=f.page.refreshData();await gate.started;await publishDashboard(f,'newest');
 const status=f.node('refresh-status').textContent;gate.reject(Error('stale failure'));await old;assert.equal(f.node('refresh-status').textContent,status);assert.equal(f.page.state.restrooms[0].location_code,'newest');
});
test('DASHBOARD_REFRESH_changed actor withdraws original rows during deferred summary',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f,'private original');const gate=f.enqueue('summary',f.response(f.summary('late'))),pending=f.page.refreshData();await gate.started;
 f.setSession({...f.session(),manager_id:'98000000-0000-4000-8000-000000000004'});gate.release();await pending;assertDashboardWithdrawn(f);
 await publishDashboard(f,'new actor');assert.equal(f.page.state.restrooms[0].location_code,'new actor');assert.match(f.node('refresh-status').textContent,/Last refresh/);
});
test('DASHBOARD_REFRESH_changed token after ticket-access await cannot publish',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);const gate=f.enqueue('tickets'),pending=f.page.refreshData();await gate.started;
 f.session().token='SYNTHETIC-rotated-token';gate.reject(Error('late access error'));await pending;assertDashboardWithdrawn(f);
});
test('DASHBOARD_REFRESH_in-place permission change and missing session withdraw cached display',async()=>{
 for(const change of [f=>{f.session().permissions.close_scan_tickets=false;},f=>{f.session().permissions.read=false;},f=>f.setSession(null)]){
  const f=dashboardRefreshFixture();await publishDashboard(f);change(f);f.page.refreshGpsFreshness();assertDashboardWithdrawn(f);
 }
});
test('DASHBOARD_REFRESH_no initial named session performs no requests',async()=>{
 const f=dashboardRefreshFixture();f.setSession(null);await f.page.refreshData();assert.equal(f.calls.length,0);assertDashboardWithdrawn(f);
});
test('DASHBOARD_REFRESH_session change across original auth headers makes no request',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);const count=f.calls.length;
 f.auth.opsManagerAuthHeaders=async()=>{const headers={Authorization:'Bearer '+f.session().token};f.session().credential_id='98000000-0000-4000-8000-000000000005';return headers;};
 await f.page.refreshData();assert.equal(f.calls.length,count);assertDashboardWithdrawn(f);
});
test('DASHBOARD_REFRESH_summary denial withdraws private display without deletion',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);const denied=f.enqueue('summary',{ok:false,status:403,json:async()=>({ok:false,error:'denied'})});denied.release();await f.page.refreshData();assertDashboardWithdrawn(f);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/close-ticket')).length,0);
});
test('DASHBOARD_REFRESH_read-only Jennifer and Annie cannot close tickets',async()=>{
 for(const name of ['Jennifer','Annie']){const f=dashboardRefreshFixture();f.setSession({...f.session(),name,read_only:true,access_level:'read_only',permissions:{schema:'custodial.manager-permissions.v1',read:true,close_scan_tickets:false}});
  await publishDashboard(f,name);assert.match(f.node('restroom-wrap').innerHTML,new RegExp(name));assert.doesNotMatch(f.node('tickets-wrap').innerHTML,/closeBtn/);
  await assert.rejects(f.page.ticketActions.close(dashboardTicketId,{outcome:'mark_fixed'}),/does not permit/);assert.equal(f.calls.filter(c=>c.url.endsWith('/close-ticket')).length,0);
 }
});
function chooseDashboardClosure(f){f.node('ticket-close-outcome').value='mark_fixed';f.node('ticket-close-dialog').returnValue='confirm';f.node('ticket-close-dialog').close();}
test('DASHBOARD_REFRESH_close dialog loses original binding without POST',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);const button=f.node('close'),pending=f.page.closeTicket(dashboardTicketId,button);assert.equal(f.node('ticket-close-dialog').open,true);
 f.setSession(null);chooseDashboardClosure(f);await pending;assertDashboardWithdrawn(f);assert.equal(f.calls.filter(c=>c.url.endsWith('/close-ticket')).length,0);
});
test('DASHBOARD_REFRESH_close header await loses permission without POST',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);f.auth.opsManagerAuthHeaders=async()=>{f.session().permissions.close_scan_tickets=false;return{Authorization:'Bearer SYNTHETIC'};};
 const pending=f.page.closeTicket(dashboardTicketId,f.node('close'));chooseDashboardClosure(f);await pending;assertDashboardWithdrawn(f);assert.equal(f.calls.filter(c=>c.url.endsWith('/close-ticket')).length,0);
});
test('DASHBOARD_REFRESH_close response after session loss cannot publish verified status',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);const gate=f.enqueue('close',f.response({ok:true,data:{ticket_id:dashboardTicketId,status:'closed',outcome:'mark_fixed',closed_at:'2026-10-13T12:00:00.000Z',closed_by:'SYNTHETIC manager'}}));
 const pending=f.page.closeTicket(dashboardTicketId,f.node('close'));chooseDashboardClosure(f);await gate.started;f.session().token='SYNTHETIC-rotated';gate.release();await pending;assertDashboardWithdrawn(f);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/close-ticket')).length,1);
});
test('DASHBOARD_REFRESH_valid close keeps exact controller body and invalidates older snapshot',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);const gate=f.enqueue('summary',f.response(f.summary('pre-close'))),old=f.page.refreshData();await gate.started;
 const pending=f.page.closeTicket(dashboardTicketId,f.node('close'));chooseDashboardClosure(f);await pending;
 assert.equal(f.page.state.tickets.length,0);assert.equal(f.node('refresh-status').textContent,'Ticket closure verified.');gate.release();await old;
 assert.equal(f.page.state.tickets.length,0);assert.equal(f.node('refresh-status').textContent,'Ticket closure verified.');
 const posts=f.calls.filter(c=>c.url.endsWith('/close-ticket'));assert.equal(posts.length,1);assert.deepEqual(JSON.parse(posts[0].options.body),{ticket_id:dashboardTicketId,outcome:'mark_fixed',external_work_order_reference:null,close_notes:null});
});
test('DASHBOARD_REFRESH_body parsing must retain original session binding',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);let begin,finish;
 const started=new Promise(r=>begin=r),released=new Promise(r=>finish=r),gate=f.enqueue('summary',{ok:true,status:200,json:async()=>{begin();await released;return f.summary('late body');}});gate.release();
 const pending=f.page.refreshData();await started;f.setSession({...f.session()});finish();await pending;assertDashboardWithdrawn(f);
});
test('DASHBOARD_REFRESH_require-session cannot substitute a returned caller',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);const count=f.calls.length;
 f.auth.requireOpsManagerSession=async()=>({...f.session()});await f.page.refreshData();assert.equal(f.calls.length,count);assertDashboardWithdrawn(f);
});
test('DASHBOARD_REFRESH_changed permission during enrichment withdraws all cached rows',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);const summary=f.enqueue('summary',f.response(f.summary('active',{active:true}))),scan=f.enqueue('enrich',f.response({ok:true,data:{latest_session_status:'active',latest_employee_name:'late private employee'}}));summary.release();
 const pending=f.page.refreshData();await scan.started;f.session().permissions.read=false;scan.release();await pending;assertDashboardWithdrawn(f);
});
test('DASHBOARD_REFRESH_superseded closure failure cannot overwrite new snapshot or controls',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);const gate=f.enqueue('close'),pending=f.page.closeTicket(dashboardTicketId,f.node('close'));chooseDashboardClosure(f);await gate.started;
 await publishDashboard(f,'newest');const status=f.node('refresh-status').textContent;gate.reject(Error('old close outcome unknown'));await pending;
 assert.equal(f.node('refresh-status').textContent,status);assert.equal(f.page.state.tickets[0].location_name,'newest');assert.equal(f.page.ticketActions.status(dashboardTicketId).can_close,true);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/close-ticket')).length,1);
});
test('DASHBOARD_REFRESH_missing read permission never requests private rows',async()=>{
 const f=dashboardRefreshFixture();delete f.session().permissions.read;await f.page.refreshData();assert.equal(f.calls.length,0);assertDashboardWithdrawn(f);
});
test('DASHBOARD_REFRESH_work-order closure retains exact existing outcome reference and notes',async()=>{
 const f=dashboardRefreshFixture();await publishDashboard(f);const pending=f.page.closeTicket(dashboardTicketId,f.node('close'));
 f.node('ticket-close-outcome').value='work_order_sent';f.node('ticket-close-reference').value='SYNTHETIC-WO-17';f.node('ticket-close-notes').value='Fixture only';f.node('ticket-close-dialog').returnValue='confirm';f.node('ticket-close-dialog').close();await pending;
 const posts=f.calls.filter(c=>c.url.endsWith('/close-ticket'));assert.equal(posts.length,1);assert.deepEqual(JSON.parse(posts[0].options.body),{ticket_id:dashboardTicketId,outcome:'work_order_sent',external_work_order_reference:'SYNTHETIC-WO-17',close_notes:'Fixture only'});assert.equal(f.node('refresh-status').textContent,'Ticket closure verified.');
});

// Execute the reserved manager Home script through its normal init/callbacks.
// Synthetic responses only; no timers, auth storage, or external requests.
async function managerHomeFixture({attendance,weather,now=Date.parse('2026-10-11T01:00:00Z'),configure}={}) {
 const nodes=new Map(),intervals=new Map(),requests=[];
 const node=id=>{if(!nodes.has(id)){const events=new Map();nodes.set(id,{textContent:'',hidden:false,href:'',disabled:false,
  setAttribute(key,value){this[key]=value;},removeAttribute(key){delete this[key];},
  addEventListener(type,callback){events.set(type,callback);},emit(type,event){events.get(type)?.(event);},
  classList:{values:new Set(),toggle(k,on){on?this.values.add(k):this.values.delete(k);},add(k){this.values.add(k);}}});}return nodes.get(id);};
 class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const navigations=[],events=new Map(),documentEvents=new Map();
 const location={href:'https://fixture.invalid/start_page1.html',origin:'https://fixture.invalid',pathname:'/start_page1.html',search:'',hash:'',replace:url=>navigations.push(url)};
 let session={role:'ops_manager',read_only:true,access_level:'read_only',token:'synthetic-read-session',device_id:'fixture-device',
  manager_id:'98000000-0000-4000-8000-000000000001',credential_id:'98000000-0000-4000-8000-000000000002',
  expires_at:'2030-01-01T00:00:00.000Z',manager_display_name:'SYNTHETIC Jennifer',roles:['CUSTODIAL_MANAGER'],
  permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false}};
 let device=session.device_id;
 const auth={getDeviceId:()=>device,readSession:()=>session,requireOpsManagerSession:async()=>session,
  isOpsManager:s=>Boolean(s?.role==='ops_manager'&&s.token),canMutateOpsManagerSurface:s=>Boolean(s&&!s.read_only&&s.access_level!=='read_only'),
  hasRole:(r,s)=>Boolean(s?.roles?.includes(r))};
 const window={location,MemphisAuth:auth,addEventListener:(type,callback)=>events.set(type,callback)};
 const f={nodes,node,intervals,requests,attendance,weather,navigations,auth,window,session:()=>session,setSession:value=>{session=value;},
  setDevice:value=>{device=value;},emit:type=>events.get(type)?.(),emitDocument:type=>documentEvents.get(type)?.(),
  fetchOverride:null,turn:()=>new Promise(resolve=>setImmediate(resolve))};
 const fetch=async url=>{requests.push(url);if(f.fetchOverride)return f.fetchOverride(url);
  let data=url.includes('open-meteo')?f.weather:url.includes('current-attendance')?{ok:true,data:f.attendance}:{ok:true,data:{enabled:false}};return {ok:true,json:async()=>data};};
 configure?.(f);
 vm.runInNewContext(readFileSync(new URL('../ops-hub.js',import.meta.url),'utf8'),{window,document:{getElementById:node,addEventListener:(type,callback)=>documentEvents.set(type,callback)},localStorage:{getItem:()=>null},URL,URLSearchParams,Date:Clock,Intl,console,setInterval:(fn,delay)=>{intervals.set(delay,fn);return delay;},clearInterval:id=>intervals.delete(id),fetch});
 await new Promise(resolve=>setImmediate(resolve));return f;
}
test('OPS_HUB_BINDING_NEW device changed during original session await cannot publish',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});
 const f=await managerHomeFixture({configure:f=>{f.auth.requireOpsManagerSession=()=>pending;}});
 const original=f.session();f.setDevice('successor-browser');release(original);await f.turn();
 assert.notEqual(f.node('manager-name').textContent,original.manager_display_name);
 assert.ok(!f.node('dashboard-link').href,'old privileged URL must not publish');
 assert.equal(f.requests.length,0);
});
function homeDeferred(){let release,reject;const promise=new Promise((yes,no)=>{release=yes;reject=no;});return{promise,release,reject};}
function homeResponse(data){return{ok:true,json:async()=>data};}
function assertHomeWithdrawn(f){
 assert.equal(f.node('manager-name').textContent,'');
 for(const id of ['messages-link','schedule-link','dashboard-link','dashboard-map-link','guest-issues-link',
  'phone-assignments-link','device-security-link','gemini-console-link','owner-coverage-link']){
  assert.equal(f.node(id).hidden,true,id);assert.ok(!f.node(id).href,id);
 }
 assert.notEqual(f.node('hub-status').textContent,'Access current.');
}
test('OPS_HUB_BINDING_NEW replaced or mutated named session across await stays withdrawn',async()=>{
 for(const mutate of [f=>f.setSession({...f.session(),token:'SYNTHETIC successor'}),
   f=>{f.session().permissions.owner=true;f.session().read_only=false;f.session().access_level='full_access';}]){
  const pending=homeDeferred();const f=await managerHomeFixture({configure:f=>{f.auth.requireOpsManagerSession=()=>pending.promise;}});
  const original=f.session();mutate(f);pending.release(original);await f.turn();
  assertHomeWithdrawn(f);assert.equal(f.requests.length,0);
 }
});
test('OPS_HUB_BINDING_NEW pagehide during admission never starts feeds or late identity',async()=>{
 const pending=homeDeferred();const f=await managerHomeFixture({configure:f=>{f.auth.requireOpsManagerSession=()=>pending.promise;}});
 f.emit('pagehide');pending.release(f.session());await f.turn();
 assertHomeWithdrawn(f);assert.equal(f.requests.length,0);assert.equal(f.intervals.size,0);
});
test('OPS_HUB_BINDING_NEW owner and read-only current sessions preserve existing role tools and exact device',async()=>{
 for(const name of ['SYNTHETIC Jennifer','SYNTHETIC Annie','SYNTHETIC owner']){
  const f=await managerHomeFixture({attendance:{attendance:0},configure:f=>{
   f.session().manager_display_name=name;
   if(name==='SYNTHETIC owner'){f.session().read_only=false;f.session().access_level='full_access';f.session().permissions.owner=true;}
  }});
  assert.equal(f.node('manager-name').textContent,name);
  assert.equal(new URL(f.node('dashboard-link').href).searchParams.get('device'),'fixture-device');
  assert.equal(f.node('owner-coverage-link').hidden,name!=='SYNTHETIC owner');
  assert.equal(f.node('device-security-link').hidden,false);assert.equal(f.node('insights-link').hidden,false);
  assert.match(f.node('access-mode').textContent,name==='SYNTHETIC owner'?/Owner · full control/:/Read-only/);
  assert.equal(f.node('attendance-value').textContent,'0');assert.match(f.node('attendance-meta').textContent,/freshness unknown/);
  f.emit('pagehide');assertHomeWithdrawn(f);assert.equal(f.intervals.size,0);
 }
});
test('OPS_HUB_BINDING_NEW changed identity in feature body await cannot reactivate privileged link',async()=>{
 const body=homeDeferred();
 const f=await managerHomeFixture({configure:f=>{f.fetchOverride=url=>url.includes('guest-api')
  ?{ok:true,json:()=>body.promise}:homeResponse(url.includes('current-attendance')?{ok:true,data:{attendance:4}}:{});}});
 const counts=f.node('attendance-value').textContent,meta=f.node('attendance-meta').textContent;
 f.setDevice('successor-browser');body.release({ok:true,data:{enabled:true}});await f.turn();
 assertHomeWithdrawn(f);assert.equal(f.intervals.size,0);
 assert.equal(f.node('attendance-value').textContent,counts);assert.equal(f.node('attendance-meta').textContent,meta);
});
test('OPS_HUB_BINDING_NEW pagehide suppresses late successes and failures without changing public facts',async()=>{
 for(const fail of [false,true]){
  const body=homeDeferred();
  const f=await managerHomeFixture({attendance:{attendance:0},configure:f=>{f.fetchOverride=url=>url.includes('guest-api')
   ?{ok:true,json:()=>body.promise}:homeResponse(url.includes('current-attendance')?{ok:true,data:{attendance:0}}:{});}});
  const statusBefore=f.node('attendance-meta').textContent;
  f.emit('pagehide');const status=f.node('hub-status').textContent;
  if(fail)body.reject(Error('SYNTHETIC delayed refusal'));else body.release({ok:true,data:{enabled:true}});
  await f.turn();assertHomeWithdrawn(f);assert.equal(f.node('hub-status').textContent,status);
  assert.equal(f.node('attendance-meta').textContent,statusBefore);assert.equal(f.node('attendance-value').textContent,'0');
  assert.equal(f.intervals.size,0);
 }
});
test('OPS_HUB_BINDING_NEW refresh loss during fetch and body leaves facts unchanged and stops controls',async()=>{
 for(const phase of ['fetch','body']){
  const f=await managerHomeFixture({attendance:{attendance:12,stale:false,source_timestamp:'2026-10-11T01:00:00Z'}});
  const before=f.node('attendance-value').textContent,meta=f.node('attendance-meta').textContent;
  const gate=homeDeferred(),refresh=f.intervals.get(30000);
  f.fetchOverride=()=>phase==='fetch'?gate.promise:{ok:true,json:()=>gate.promise};
  const pending=refresh();await f.turn();
  f.setSession(null);
  if(phase==='fetch')gate.release(homeResponse({ok:true,data:{attendance:999}}));
  else gate.release({ok:true,data:{attendance:999}});
  await pending;assertHomeWithdrawn(f);assert.equal(f.intervals.size,0);
  assert.equal(f.node('attendance-value').textContent,before);assert.equal(f.node('attendance-meta').textContent,meta);
  const calls=f.requests.length;await refresh();assert.equal(f.requests.length,calls);
 }
});
test('OPS_HUB_BINDING_NEW in-place permission or token loss on tick withdraws before navigation',async()=>{
 for(const change of [f=>{f.session().roles=[];f.session().permissions.read=false;},
   f=>{f.session().token='SYNTHETIC rotated';},f=>{f.setDevice('successor-browser');}]){
  const f=await managerHomeFixture({attendance:{attendance:0}});
  change(f);let prevented=false;f.node('dashboard-link').emit('click',{preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assertHomeWithdrawn(f);assert.equal(f.intervals.size,0);
 }
});
test('OPS_HUB_BINDING_NEW missing current session or port cannot publish privileged identity',async()=>{
 for(const configure of [f=>{f.auth.readSession=()=>null;},f=>{delete f.auth.readSession;},
   f=>{f.session().device_id='foreign-browser';}]){
  const f=await managerHomeFixture({configure});assertHomeWithdrawn(f);assert.equal(f.requests.length,0);
 }
});
test('PRODUCT Home preserves genuine zero and Central service day without fabricating missing facts',async()=>{
 const at='2026-10-11T01:00:00Z',epoch=Date.parse(at)/1000;
 const f=await managerHomeFixture({attendance:{attendance:0,planned:null,stale:false,source_timestamp:at,service_date:'2026-10-10'},weather:{current:{time:epoch,temperature_2m:0,weather_code:null},current_units:{time:'unixtime',temperature_2m:'°F'}}});
 assert.equal(f.nodes.get('attendance-value').textContent,'0');assert.match(f.nodes.get('attendance-meta').textContent,/Current.*Planned unavailable.*Central/);
 assert.equal(f.nodes.get('weather-value').textContent,'0°F · Conditions unavailable');assert.match(f.nodes.get('weather-meta').textContent,/Daily high\/low unavailable/);
 assert.match(f.nodes.get('date').textContent,/Oct 10/);assert.match(f.nodes.get('clock').textContent,/8:00/);
 assert.ok(f.requests.some(url=>url.includes('temperature_unit=fahrenheit&timeformat=unixtime')));
 for(const attendance of [{attendance:null},{attendance:false},{attendance:0,available:false},{attendance:4,source_timestamp:'2026-10-10T01:00:00Z'},{attendance:4,source_timestamp:'2026-10-11T02:00:00Z'}]){
  f.attendance=attendance;await f.intervals.get(30000)();assert.equal(f.nodes.get('attendance-value').textContent,'Unavailable');
 }
 f.attendance={attendance:9};await f.intervals.get(30000)();assert.equal(f.nodes.get('attendance-value').textContent,'9');assert.match(f.nodes.get('attendance-meta').textContent,/freshness unknown/);assert.ok(f.nodes.get('attendance-meta').classList.values.has('stale'));
});
test('PRODUCT Home rejects absent weather observations and labels stale source time',async()=>{
 const now=Date.parse('2026-10-11T01:00:00Z'),f=await managerHomeFixture({attendance:null,weather:{current:{time:now/1000,temperature_2m:null,weather_code:null},current_units:{time:'unixtime',temperature_2m:'°F'}}});
 assert.equal(f.nodes.get('weather-value').textContent,'Unavailable');
 f.weather={current:{time:now/1000-3600,temperature_2m:71,weather_code:0},current_units:{time:'unixtime',temperature_2m:'°F'},daily:{time:[Date.parse('2026-10-10T05:00:00Z')/1000],temperature_2m_max:[80],temperature_2m_min:[60]},daily_units:{time:'unixtime',temperature_2m_max:'°F',temperature_2m_min:'°F'}};
 await f.intervals.get(600000)();assert.equal(f.nodes.get('weather-value').textContent,'71°F · Clear');assert.match(f.nodes.get('weather-meta').textContent,/High 80° \/ Low 60°.*Stale forecast.*7:00.*Central/);
 for(const patch of [{time:null},{time:false},{temperature_2m:false},{time:now/1000+3600}]){
  f.weather.current={time:now/1000,temperature_2m:71,...patch};await f.intervals.get(600000)();assert.equal(f.nodes.get('weather-value').textContent,'Unavailable');
 }
});
const visit={id:'school-1',name:'Synthetic school',date:'2026-10-05',arrival_at:'2026-10-05T14:30:00Z',departure_at:null,departure_source:null,status:'SCHEDULED',students:50,chaperones:5,teachers:2,adults:7,total:58,unclassified:1,buses:2};
const payload={ok:true,data:{schema:'custodial.operations-board.v1',timezone:D.ZONE,generated_at:'2026-10-05T17:00:00Z',events:[],schools:{state:'unavailable'},spiceworks:{state:'unavailable'}}};
test('operations requires the exact contract and bounded structured feed',()=>{
 assert.equal(D.operations(payload).schools.state,'unavailable');
 for(const change of [{schema:'other'},{timezone:'UTC'},{generated_at:'not-a-time'},{events:null}])assert.throws(()=>D.operations({ok:true,data:{...payload.data,...change}}));
});
test('unknown counts and freshness never become live zero',()=>{
 assert.equal(D.attendance(null).value,'Unavailable');assert.equal(D.attendance({ok:true,data:{attendance:null}}).value,'Unavailable');
 assert.equal(D.attendance({ok:true,data:{attendance:0}}).value,'0');assert.equal(D.attendance({ok:true,data:{attendance:0}}).stale,true);
 assert.match(D.attendance({ok:true,data:{attendance:12}}).note,/unknown/);
 assert.equal(D.attendance({ok:true,data:{attendance:12,stale:false,source_timestamp:'2026-10-05T17:00:00Z'}}).stale,false);
});
test('weather uses real units/times, names stale source, and only the coming hour',()=>{
 const weather={current:{time:noon/1000,temperature_2m:77},current_units:{temperature_2m:'°F'},hourly:{time:[noon/1000+3600],temperature_2m:[79],precipitation_probability:[20]},hourly_units:{temperature_2m:'°F'}};
 assert.equal(D.weather(weather,noon).value,'77°F');assert.match(D.weather(weather,noon).hour,/79°F.*20%/);
 assert.equal(D.weather(weather,noon+3600000).stale,true);assert.match(D.weather(weather,noon+3600000).hour,/unavailable/);
 assert.equal(D.weather({...weather,current_units:{temperature_2m:'°C'}},noon).value,'Unavailable');
});
test('scan ticket removal follows replacement summary; origins remain separate',()=>{
 const summary={open_tickets:[{ticket_id:'12',location_name:'Fixture restroom',maintenance_issue:'Fixture leak'}]};
 const mail={state:'current',rows:[{ticket_id:'12',custodial:true,active:true,status:'Open',title:'Fixture gate'}]};
 const both=D.tickets(summary,mail);assert.deepEqual(both.cards.map(x=>x.source),['Scan session','Spiceworks']);
 assert.equal(D.tickets({open_tickets:[]},mail).cards.length,1);assert.equal(D.tickets({open_tickets:[]},{state:'unavailable'}).cards.length,0);
 assert.equal(D.tickets(null,{state:'current',rows:[{...mail.rows[0],status:'Closed'}]}).cards.length,0);
 assert.match(D.tickets(summary,null).note,/unavailable/);
});
test('imported mail snapshot is visible with explicit unknown freshness/completeness, never live',()=>{
 const snapshot={state:'snapshot',coverage:'imported_only',mailbox_completeness_verified:false,generated_at:'2026-10-05T12:01:00Z',rows:[{ticket_id:'6914',custodial:true,active:true,status:'Open',title:'Synthetic gate'}]};
 const parsed=D.operations({ok:true,data:{...payload.data,spiceworks:snapshot,schools:{...snapshot,rows:[visit]}}});
 assert.equal(parsed.spiceworks.state,'snapshot');const tickets=D.tickets({open_tickets:[]},parsed.spiceworks);
 assert.equal(tickets.cards.length,1);assert.match(tickets.note,/snapshot.*Oct 5/);assert.match(tickets.note,/NOT verified/);
 const schools=D.schools(parsed.schools,noon);assert.equal(schools.cards.length,1);assert.match(schools.note,/snapshot.*NOT verified/);
 const after=D.schools(parsed.schools,Date.parse('2026-10-05T18:00:00Z'));assert.equal(after.cards.length,1);assert.equal(after.history.length,0);assert.match(after.note,/50 students.*57 identified people.*1 unclassified ticket units.*58 reported quantity/);
 for(const patch of [{coverage:'complete'},{mailbox_completeness_verified:true},{generated_at:'yesterday'}])assert.equal(D.operations({ok:true,data:{...payload.data,spiceworks:{...snapshot,...patch}}}).spiceworks.state,'unavailable');
});
test('Events retain missing fields, source status, exact notes and scheduled-end caveat',()=>{
 const row={id:'e',name:'Fixture event',date:'2026-10-05',status:'SCHEDULED',custodial_notes:'8 trash boxes; 1 custodian requested'};
 const card=D.events([row],noon).cards[0];assert.match(card.lines.join('\n'),/Attendees: Not provided/);assert.match(card.lines.join('\n'),/End time\/instant not provided/);
 assert.match(card.lines.join('\n'),/8 trash boxes/);assert.equal(card.active,true);
 for(const status of ['CANCELLED','SUPERSEDED']){const view=D.events([{...row,status}],noon);assert.equal(view.cards.length,0);assert.equal(view.history[0].active,false);}
 assert.equal(D.events([{...row,status:'REVIEW_REQUIRED'}],noon).cards[0].active,false);
 const view=D.events([{...row,end_at:'2026-10-05T16:00:00Z'}],noon),ended=view.history[0];assert.equal(view.cards.length,0);assert.equal(ended.active,false);assert.match(ended.lines.join('\n'),/departure not independently/);
});
test('unknown-end schools stay planned after local 13:00; date rollover is not departure',()=>{
 const feed={state:'current',rows:[visit]};assert.equal(D.schools(feed,noon).cards.length,1);
 assert.equal(D.schools(feed,Date.parse('2026-10-05T17:59:59Z')).cards.length,1);
 const later=D.schools(feed,Date.parse('2026-10-05T18:00:00Z'));assert.equal(later.cards.length,1);assert.equal(later.history.length,0);assert.match(later.note,/50 students.*7 adults.*57 identified people.*1 unclassified ticket units.*58 reported quantity/);
 assert.match(later.cards[0].lines.join('\n'),/Departure not provided/);assert.match(later.cards[0].lines.join('\n'),/presence and departure not independently confirmed/);
 assert.equal(D.schools(feed,Date.parse('2026-10-06T04:59:00Z')).cards.length,1);
 const tomorrow=D.schools(feed,Date.parse('2026-10-06T05:00:00Z'));assert.equal(tomorrow.cards.length,0);assert.equal(tomorrow.history.length,0);assert.match(tomorrow.note,/rollover does not confirm departure/);
 const winter={...visit,date:'2026-11-02',arrival_at:'2026-11-02T15:30:00Z'};
 assert.equal(D.schools({state:'current',rows:[winter]},Date.parse('2026-11-02T18:59:59Z')).cards.length,1);
 assert.equal(D.schools({state:'current',rows:[winter]},Date.parse('2026-11-02T19:00:00Z')).cards.length,1);
});
test('missing school arrival stays review; valid late arrival stays expected without overnight inference',()=>{
 const missing={state:'current',rows:[{...visit,arrival_at:null}]};assert.equal(D.schools(missing,noon).cards[0].state,'REVIEW_REQUIRED');
 const missingLater=D.schools(missing,Date.parse('2026-10-05T20:00:00Z'));assert.equal(missingLater.cards.length,1);assert.equal(missingLater.history.length,0);assert.equal(missingLater.cards[0].state,'REVIEW_REQUIRED');
 for(const arrival_at of ['2026-10-05T18:00:00Z','2026-10-05T20:00:00Z']){
  const feed={state:'current',rows:[{...visit,arrival_at}]},expected=D.schools(feed,noon);assert.equal(expected.cards[0].state,'SCHEDULED');assert.match(expected.cards[0].lines.join('\n'),/Expected later today/);
  const after=D.schools(feed,Date.parse('2026-10-05T20:00:00Z'));assert.equal(after.cards.length,1);assert.equal(after.history.length,0);assert.match(after.cards[0].lines.join('\n'),/not independently confirmed/);
 }
 const legacy=D.schools({state:'current',rows:[{...visit,departure_at:'2026-10-05T18:00:00Z',departure_source:'owner_policy_13:00_America/Chicago'}]},Date.parse('2026-10-05T20:00:00Z'));assert.equal(legacy.cards.length,1);assert.equal(legacy.history.length,0);assert.equal(legacy.cards[0].state,'REVIEW_REQUIRED');
 assert.match(D.schools(null,noon).note,/unknown/);
 const cancelled=D.schools({state:'current',rows:[{...visit,status:'CANCELLED'}]},noon);assert.equal(cancelled.cards.length,0);assert.match(cancelled.note,/0 students/);assert.equal(cancelled.history[0].state,'CANCELLED');
});

// Contract-only DOM fixture: executes the exact controller, not a browser or
// pixel/layout verification. No network, credentials, storage or live records.
function fixture({reduced=false,legacyDialog=false}={}){
 let now=noon,id=0;const frames=new Map(),timeouts=new Map(),all=[];
 class Node{
  constructor(tag='div'){this.tag=tag;this.dataset={};this.attrs={};this.children=[];this.listeners=new Map();this.hidden=false;this.disabled=false;this.open=false;this.inert=false;this.value='32';this.scrollTop=0;this.scrollHeight=1200;this.clientHeight=300;this.textContent='';
   const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,b){if(b??!classes.has(x))classes.add(x);else classes.delete(x);}};all.push(this);}
  addEventListener(t,fn){const list=this.listeners.get(t)||new Set();list.add(fn);this.listeners.set(t,list);}
  removeEventListener(t,fn){this.listeners.get(t)?.delete(fn);if(!this.listeners.get(t)?.size)this.listeners.delete(t);}
  emit(t,event={}){event.target??=this;event.preventDefault??=()=>{};event.stopPropagation??=()=>{};for(const fn of this.listeners.get(t)||[])fn(event);}
  append(...nodes){this.children.push(...nodes);for(const node of nodes)node.parent=this;}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(k,v){this.attrs[k]=v;if(k==='open')this.open=true;}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];if(k==='open')this.open=false;}
  focus(){doc.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  getBoundingClientRect(){return{left:this.x||0,top:0,width:24,height:24};}
  closest(selector){if(selector==='.mzMapPin')return this.pin?this:this.parent?.closest(selector);if(selector==='[data-location-select]')return this.dataset.locationSelect?this:this.parent?.closest(selector);return null;}
  querySelectorAll(selector){const result=[];for(const child of this.children){if(selector==='.mzMapPin'?child.pin:selector==='[data-location-select]'?!!child.dataset.locationSelect:selector==='[data-board]'?!!child.dataset.board:selector==='button,select,[tabindex="0"]'?['button','select'].includes(child.tag)||child.attrs.tabindex==='0':false)result.push(child);result.push(...child.querySelectorAll(selector));}return result;}
  querySelector(selector){if(selector==='[data-map-viewport]')return viewport;return null;}
 }
 const doc=new Node('document'),elements={};doc.createElement=tag=>new Node(tag);doc.getElementById=x=>elements[x];doc.hidden=false;doc.fullscreenEnabled=false;
 const html=readFileSync(new URL('../operations-dashboard.html',import.meta.url),'utf8');
 for(const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Node(match[1]);elements[match[2]]=node;node.id=match[2];}
 const main=new Node('main'),viewport=new Node(),map=elements['dashboard-map'],dialog=elements['operations-board'],content=elements['operations-board-content'];
 doc.body=new Node('body');doc.append(main,dialog);main.append(elements['operations-panels'],map);doc.querySelector=selector=>selector==='main'?main:null;
 dialog.append(elements['operations-board-pause'],elements['operations-board-speed'],elements['operations-board-fullscreen'],elements['operations-board-close'],content);content.attrs.tabindex='0';map.append(viewport);
 const triggers=['tickets','events','schools','locations'].map(kind=>{const node=new Node('button');node.dataset.board=kind;main.append(node);return node;});
 for(let i=0;i<47;i++){const node=new Node('button');node.pin=true;node.x=i*100;node.dataset={locationId:`location-${i}`,status:i<9?'overdue':'clean'};node.attrs['aria-label']=`Location ${i} — ${node.dataset.status}`;viewport.append(node);}
 if(legacyDialog){dialog.showModal=null;dialog.close=null;}
 const window=new Node('window'),motion=new Node();motion.matches=reduced;window.matchMedia=()=>motion;window.document=doc;
 const navigations=[];window.location={href:'https://example.invalid/operations-dashboard.html',assign:value=>navigations.push(value)};
 let session={role:'ops_manager',manager_id:'synthetic-manager',credential_id:'synthetic-credential',device_id:'KIOSK_01',token:'synthetic-session',read_only:true};
 window.MemphisAuth={readSession:()=>session};
 window.requestAnimationFrame=fn=>{const key=++id;frames.set(key,fn);return key;};window.cancelAnimationFrame=key=>frames.delete(key);
 window.setTimeout=(fn,delay)=>{assert.equal(delay,10000);const key=++id;timeouts.set(key,fn);return key;};window.clearTimeout=key=>timeouts.delete(key);
 let backCount=0;window.history={state:{prior:true},pushState(state){this.state=state;},replaceState(state){this.state=state;},back(){backCount++;this.state={prior:true};window.emit('popstate');}};
 doc.exitFullscreen=async()=>{doc.fullscreenElement=null;doc.emit('fullscreenchange');};
 const context={MemphisOperationsData:D,AbortController,Intl,Date,URL,console,module:{exports:{}}};vm.runInNewContext(ui,context);
 const controller=context.module.exports.create({document:doc,window,now:()=>now});let selected=null;
 controller.activate({selectLocation:value=>{selected=value;}});
 const text=node=>[node.textContent,...node.children.map(text)].join(' ');
 return{controller,window,doc,elements,main,triggers,dialog,content,viewport,motion,frames,timeouts,text,all,navigations,
  get selected(){return selected;},get backCount(){return backCount;},setSession:value=>{session=value;},setNow:value=>{now=value;},step(time){const todo=[...frames.values()];frames.clear();for(const fn of todo)fn(time);},
  clean(){controller.stop();assert.equal(frames.size,0);assert.equal(timeouts.size,0);assert.equal(all.reduce((n,node)=>n+node.listeners.size,0),0);}};
}
const loaded=async(f,{operations=payload,scan=[{ticket_id:'1',location_name:'Fixture',maintenance_issue:'Fixture issue'}],summary={open_tickets:scan}}={})=>{
 const calls=[];await f.controller.refresh({headers:{Authorization:'Bearer SYNTHETIC','X-Device-Id':'SYNTHETIC'},isCurrent:()=>true,summary,fetchImpl:async(url,options)=>{
  calls.push({url,options});return{ok:true,json:async()=>url.endsWith('/operations')?operations:url.includes('attendance')?{ok:true,data:{attendance:12,stale:false,source_timestamp:'2026-10-05T17:00:00Z'}}:null};}});return calls;
};
test('non-event tickers retain their modal boards; Events uses one shared page',async()=>{
 const f=fixture();const calls=await loaded(f);assert.equal(calls.length,3);assert.equal(f.timeouts.size,0);
 for(const [i,kind]of [[0,'tickets'],[2,'schools'],[3,'locations']]){
  f.triggers[i].emit('click');assert.equal(f.dialog.open,true);assert.equal(f.frames.size,1);assert.equal(f.doc.activeElement,f.elements['operations-board-close']);
  assert.match(f.elements['operations-board-title'].textContent,new RegExp(kind==='tickets'?'tickets':kind==='locations'?'47':kind,'i'));
  f.elements['operations-board-close'].emit('click');assert.equal(f.dialog.open,false);assert.equal(f.frames.size,0);assert.equal(f.doc.activeElement,f.triggers[i]);
 }assert.equal(f.backCount,3);
 f.triggers[1].emit('click');assert.equal(f.dialog.open,false);assert.equal(f.frames.size,0);assert.equal(f.navigations.length,1);
 const target=new URL(f.navigations[0]);assert.equal(target.pathname,'/events.html');assert.equal(target.searchParams.get('hub'),'manager');assert.equal(target.searchParams.get('device'),'KIOSK_01');assert.equal(target.searchParams.has('token'),false);
 assert.equal(calls.length,3);f.clean();
});
test('auth headers go only to existing backend; forecast receives none',async()=>{
 const f=fixture(),calls=await loaded(f);for(const call of calls.filter(x=>x.url.includes('onrender.com')))assert.equal(call.options.headers.Authorization,'Bearer SYNTHETIC');
 assert.equal(calls.find(x=>x.url.includes('open-meteo.com')).options.headers,undefined);f.clean();
});
test('board speed/pause/reduced motion and Escape work without dropping true alerts',()=>{
 const f=fixture();f.triggers[3].emit('click');assert.equal(f.content.children.length,47);f.step(0);f.step(100);assert.equal(f.content.scrollTop,3.2);
 f.elements['operations-board-speed'].value='48';f.step(200);assert.equal(f.content.scrollTop,8);
 f.elements['operations-board-pause'].emit('click');f.step(300);assert.equal(f.content.scrollTop,8);
 f.dialog.emit('keydown',{key:'Escape'});assert.equal(f.frames.size,0);f.clean();
 const reduced=fixture({reduced:true});reduced.triggers[3].emit('click');reduced.step(0);reduced.step(100);assert.equal(reduced.content.scrollTop,0);reduced.clean();
});
test('fullscreen refusal stays a readable viewport board; fallback isolates focus; Back closes',async()=>{
 const f=fixture({legacyDialog:true});f.triggers[0].emit('click');assert.equal(f.main.inert,true);
 f.elements['operations-board-fullscreen'].emit('click');await Promise.resolve();assert.match(f.elements['operations-board-note'].textContent,/fills the browser window/);
 f.window.emit('popstate');assert.equal(f.dialog.open,false);assert.equal(f.main.inert,false);f.clean();
});
test('map fullscreen fallback exits and never alters pins',async()=>{
 const f=fixture();const positions=f.viewport.children.map(x=>x.x);
 f.elements['operations-map-fullscreen'].emit('click');await Promise.resolve();assert.equal(f.elements['dashboard-map'].classList.contains('is-expanded'),true);
 f.doc.emit('keydown',{key:'Escape'});assert.equal(f.elements['dashboard-map'].classList.contains('is-expanded'),false);
 assert.deepEqual(f.viewport.children.map(x=>x.x),positions);f.clean();
});
test('nearby chooser preserves coordinates and selects canonical stable ID',()=>{
 const f=fixture();f.viewport.children[1].x=10;const pin=f.viewport.children[0];f.viewport.emit('click',{target:pin});
 assert.equal(f.content.children.length,2);const button=f.content.querySelectorAll('[data-location-select]')[1];f.content.emit('click',{target:button});assert.equal(f.selected,'location-1');assert.equal(f.viewport.children[1].x,10);f.clean();
});
test('deletion converges while board open; hostile strings stay text, never HTML',async()=>{
 const f=fixture();await loaded(f,{scan:[{ticket_id:'1',location_name:'<img onerror=bad()>',maintenance_issue:'<script>bad()</script>'}]});f.triggers[0].emit('click');
 assert.match(f.text(f.content),/<script>bad/);assert.equal(f.content.querySelectorAll('img').length,0);
 await loaded(f,{scan:[]});assert.doesNotMatch(f.text(f.content),/bad/);f.clean();
});
test('sign-out/suspend aborts pending reads, closes boards and ignores late responses',async()=>{
 const f=fixture();let resolve;const pending=new Promise(r=>{resolve=r;}),signals=[];
 const run=f.controller.refresh({headers:{},summary:{open_tickets:[]},isCurrent:()=>true,fetchImpl:async(_url,options)=>{signals.push(options.signal);await pending;return{ok:true,json:async()=>payload};}});
 f.triggers[0].emit('click');f.controller.suspend();assert.equal(f.dialog.open,false);assert.equal(f.frames.size,0);assert.equal(f.timeouts.size,0);assert.ok(signals.every(s=>s.aborted));
 resolve();await run;assert.equal(f.elements['operations-panels'].hidden,true);assert.equal(f.elements['ops-attendance'].textContent,'Unavailable');f.clean();
});
test('new generation wins and return reuses the same controls without listener growth',async()=>{
 const f=fixture();let resolve;const pending=new Promise(r=>{resolve=r;});const old=f.controller.refresh({headers:{},summary:{open_tickets:[]},isCurrent:()=>true,fetchImpl:async()=>{await pending;return{ok:true,json:async()=>payload};}});
 await loaded(f);resolve();await old;assert.equal(f.elements['ops-attendance'].textContent,'12');
 const listeners=f.all.reduce((n,x)=>n+x.listeners.size,0);f.controller.suspend();f.controller.activate({});await loaded(f);assert.equal(f.all.reduce((n,x)=>n+x.listeners.size,0),listeners);f.clean();
});
test('unknown school departure stays planned on shared clock tick; next date removes Today card',async()=>{
 const f=fixture();await loaded(f,{operations:{ok:true,data:{...payload.data,schools:{state:'current',generated_at:'2026-10-05T17:00:00Z',rows:[visit]}}}});f.triggers[2].emit('click');
 assert.match(f.text(f.content),/Departure not provided/);f.setNow(Date.parse('2026-10-05T18:00:00Z'));f.controller.tick();
 assert.match(f.text(f.content),/Synthetic school/);assert.doesNotMatch(f.text(f.content),/Daily visit history/);assert.match(f.elements['operations-board-note'].textContent,/57 identified people.*1 unclassified ticket units.*58 reported quantity/);
 f.setNow(Date.parse('2026-10-06T05:00:00Z'));f.controller.tick();assert.doesNotMatch(f.text(f.content),/Synthetic school/);assert.match(f.elements['operations-board-note'].textContent,/rollover does not confirm departure/);f.clean();
});
test('request timeout uses one cancellable deadline and clears unavailable feeds',async()=>{
 const f=fixture();const requests=[];
 const pending=f.controller.refresh({headers:{},summary:{open_tickets:[]},isCurrent:()=>true,fetchImpl:async(_url,{signal})=>new Promise((resolve,reject)=>{requests.push(signal);signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});})});
 assert.equal(f.timeouts.size,1);for(const fn of [...f.timeouts.values()])fn();await pending;assert.ok(requests.every(s=>s.aborted));assert.equal(f.timeouts.size,0);assert.equal(f.elements['ops-attendance'].textContent,'Unavailable');f.clean();
});
test('principal change during response cannot populate any operations data',async()=>{
 const f=fixture();await f.controller.refresh({headers:{},summary:{open_tickets:[]},isCurrent:()=>false,fetchImpl:async()=>({ok:true,json:async()=>payload})});
 assert.notEqual(f.elements['ops-attendance'].textContent,'12');f.clean();
});

test('event navigation requires a current named session and never opens a duplicate board',()=>{const f=fixture();f.window.MemphisAuth.readSession=()=>null;f.triggers[1].emit('click');assert.equal(f.navigations.length,0);assert.equal(f.dialog.open,false);f.clean();});

const recordId=n=>`98000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const recordRow=()=>({location_id:recordId(1),location_code:'FIXTURE_RR',location_name:'Fixture restroom',
 status_code:'in_progress',open_session_status:'pending_submit',open_session_uuid:recordId(2),open_session_employee_name:'Current saved worker',
 latest_completed_session_id:recordId(41),latest_completed_session_uuid:recordId(3),latest_completed_at:'2026-10-05T16:30:00.123456Z',
 latest_employee_name:'Previous closed worker',services_performed:['Trash emptied'],duration_display:'12 min'});
const recordSummary=row=>({meta:{contracts:{dashboard:'dashboard.v1'},generated_at:'2026-10-05T17:00:00Z'},restrooms:[row],exhibits:[],open_tickets:[]});
function recordFixture(){const f=fixture();f.viewport.children[0].dataset.locationId=recordId(1);
 f.viewport.children[0].attrs['aria-label']='Fixture restroom: Clean';f.viewport.children[0].dataset.status='clean';return f;}
test('PRODUCT record board separates saved pending work from the prior closed cleaning record, then replaces exact server row',async()=>{
 const f=recordFixture();try{
  const calls=await loaded(f,{summary:recordSummary(recordRow())});f.triggers[3].emit('click');
  const pending=f.text(f.content);assert.match(pending,/Saved pending.*not accepted/i);
  assert.match(pending,/Current saved worker/);assert.match(pending,/Previous closed worker/);
  assert.match(pending,/Prior closed cleaning record/);assert.match(pending,new RegExp(recordId(3)));
  assert.match(pending,/original completion.*unavailable/i);assert.doesNotMatch(pending,/Receipt accepted|Queued.*completed/);
  const closed={...recordRow(),status_code:'okay',open_session_status:null,open_session_uuid:null,open_session_employee_name:null,
   latest_completed_session_id:recordId(42),latest_completed_session_uuid:recordId(2),latest_completed_at:'2026-10-05T16:58:00.654321Z',latest_employee_name:'Current saved worker'};
  await loaded(f,{summary:recordSummary(closed)});const text=f.text(f.content);
  assert.match(text,/Closed cleaning record/);assert.match(text,/Current saved worker/);assert.doesNotMatch(text,/Previous closed worker|Saved pending/);
  assert.match(text,new RegExp(recordId(2)));assert(calls.every(c=>c.options.method==='GET')); // readonly manager never writes
  for(const bad of [
   {...closed,latest_completed_session_uuid:null},
   {...closed,latest_employee_name:null},
   {...closed,latest_completed_at:'2026-02-30T12:00:00Z'},
   {...closed,latest_completed_session_uuid:recordId(2),open_session_uuid:recordId(2),open_session_status:'pending_submit'},
   {...closed,location_id:recordId(9)}
  ]){await loaded(f,{summary:recordSummary(bad)});assert.doesNotMatch(f.text(f.content),/Closed cleaning record ·/i);}
  await loaded(f,{summary:{...recordSummary(closed),restrooms:[closed,closed]}});assert.doesNotMatch(f.text(f.content),/Closed cleaning record ·/i);
 }finally{f.clean();}
});
test('PRODUCT record controller refuses a foreign named session before any private request and withdraws changed awaited identity',async()=>{
 const f=recordFixture();try{
  let calls=0;await f.controller.refresh({summary:recordSummary(recordRow()),headers:{},isCurrent:()=>false,
   fetchImpl:async()=>{calls++;return {ok:true,json:async()=>payload};}});
  assert.equal(calls,0);assert.equal(f.timeouts.size,0);
  // Restore only the existing normal fixture principal, not a new auth adapter.
  f.controller.activate({});await loaded(f,{summary:recordSummary(recordRow())});f.triggers[3].emit('click');
  let release;const pending=new Promise(r=>{release=r;}),signals=[];
  const run=f.controller.refresh({summary:recordSummary(recordRow()),headers:{},isCurrent:()=>true,
   fetchImpl:async(_url,{signal})=>{signals.push(signal);await pending;return {ok:true,json:async()=>payload};}});
  f.setSession({role:'ops_manager',manager_id:'successor',credential_id:'successor',device_id:'KIOSK_01',token:'successor',read_only:true});
  release();await run;assert.equal(f.dialog.open,false);assert.doesNotMatch(f.text(f.content),/worker/);
  assert(signals.every(s=>s.aborted));assert.equal(f.timeouts.size,0);
 }finally{f.clean();}
});
test('PRODUCT record read generation cannot retain false map cleanliness or a revoked session record on the next tick',async()=>{
 const f=recordFixture();try{
  await loaded(f,{summary:recordSummary({...recordRow(),latest_completed_session_uuid:null,latest_completed_at:null,latest_employee_name:null})});
  f.triggers[3].emit('click');assert.match(f.text(f.content),/not accepted/i);
  assert.doesNotMatch(f.elements['ops-status-counts'].children.map(n=>n.textContent).join(' '),/\bclean\b/);
  f.setSession(null);f.controller.tick();assert.equal(f.dialog.open,false);assert.equal(f.timeouts.size,0);
 }finally{f.clean();}
});
test('PRODUCT completion source requires explicit no-open-work fields, never missing/unknown state as a closed-current claim',async()=>{
 const f=recordFixture();try{
  const closed={...recordRow(),status_code:'okay',open_session_status:null,open_session_uuid:null,open_session_employee_name:null};
  for(const row of [
   {...closed,open_session_status:'outcome_unknown',open_session_uuid:recordId(2)},
   {...closed,open_session_status:undefined},
   {...closed,open_session_uuid:undefined},
   {...closed,open_session_status:null,open_session_uuid:recordId(3)}
  ]){await loaded(f,{summary:recordSummary(row)});f.triggers[3].emit('click');
   assert.doesNotMatch(f.text(f.content),/Closed cleaning record ·/i);f.controller.closeBoard();}
  await loaded(f,{summary:recordSummary(closed)});f.triggers[3].emit('click');assert.match(f.text(f.content),/Closed cleaning record ·/);
 }finally{f.clean();}
});
// Source-recording fixture only: execute the exact current pure permission
// predicate, not the auth module's startup/cache/network body. This is not
// proof of a real manager session or server authentication.
function recordPageAuthFixture(f){
 const source=readFileSync(new URL('../memphis-auth.js',import.meta.url),'utf8');
 const start=source.indexOf('  function hasPermission('),end=source.indexOf('  async function signInWithMap(',start);
 assert(start>=0&&end>start,'current owning pure permission callable required');
 const hasPermission=vm.runInNewContext(source.slice(start,end)+'\nhasPermission;',{window:f.window});
 assert.equal(typeof hasPermission,'function');
 const current=f.window.MemphisAuth.readSession();
 f.setSession({...current,roles:['CUSTODIAL_MANAGER'],access_level:'read_only',
  permissions:{schema:'custodial.manager-permissions.v1',read:true,close_scan_tickets:false}});
 f.window.MemphisAuth.hasPermission=hasPermission;
 const admitted=f.window.MemphisAuth.readSession();
 assert.equal(hasPermission('read',admitted),true);
 assert.equal(hasPermission('read',null),false);
 assert.equal(hasPermission('read',{...admitted,permissions:undefined}),false);
 assert.equal(hasPermission('read',{...admitted,permissions:{schema:'other',read:true}}),false);
 assert.equal(hasPermission('read',{...admitted,permissions:{...admitted.permissions,read:false}}),false);
 assert.equal(hasPermission('close_scan_tickets',admitted),false);
 return f;
}
test('PRODUCT caller record keeps the newest summary when an older read fails and rejects its late GPS work',async()=>{
 const f=recordPageAuthFixture(recordFixture()),page=require('../dashboard-map-page.js'),intervals=new Map(),accepted=[],gps=[],gpsReads=[];
 let response=recordSummary(recordRow()),wait=null,release,stopCount=0;
 f.window.MemphisAuth.requireOpsManagerSession=async()=>f.window.MemphisAuth.readSession();
 f.window.MemphisAuth.opsManagerAuthHeaders=async()=>({Authorization:'Bearer synthetic-session','X-Device-Id':'KIOSK_01'});
 const map={init:async()=>true,resume:async()=>true,checkSession:()=>true,beginRefresh:()=>({}),
  accept(_ticket,s){accepted.push(s);return true;},fail(){return false;},invalidate(){},suspend(){},stop(){stopCount++;},
  acceptGps(_ticket,value){gps.push(value);},unavailableGps(){}};
 const caller=page.create({auth:f.window.MemphisAuth,renderer:{create:()=>map},section:f.elements['dashboard-map'],
  status:f.elements['map-page-status'],window:f.window,operations:f.controller,
  gpsSource:{read(){return new Promise(resolve=>gpsReads.push(resolve));}},
  setIntervalImpl:(fn,ms)=>{intervals.set(ms,fn);return ms;},clearIntervalImpl:id=>intervals.delete(id),
  fetchImpl:async url=>{if(url.endsWith('/summary')){if(wait)await wait;return {ok:response!==null,json:async()=>({ok:response!==null,data:response})};}
   return{ok:true,json:async()=>url.endsWith('/operations')?payload:null};}});
 try{
  assert.equal(await caller.init(),true);await new Promise(r=>setImmediate(r));
  f.triggers[3].emit('click');assert.equal(f.dialog.open,true);
  wait=new Promise(r=>{release=r;});const old=caller.refresh();await new Promise(r=>setImmediate(r));
  assert.equal(f.dialog.open,true);assert.doesNotMatch(f.text(f.content),/worker/);
  wait=null;response=recordSummary({...recordRow(),status_code:'okay',open_session_status:null,open_session_uuid:null,
   latest_completed_session_uuid:recordId(4),latest_employee_name:'Newest closed worker'});
  assert.equal(await caller.refresh(),true);await new Promise(r=>setImmediate(r));
  assert.equal(accepted.at(-1),response);assert.match(f.text(f.content),/Newest closed worker/);
  gpsReads[0]({old:true});await Promise.resolve();
  response=null;release();assert.equal(await old,false);
  assert.match(f.text(f.content),/Newest closed worker/);assert.equal(f.dialog.open,true);
  assert.deepEqual(gps,[]);
 }finally{caller.stop();release?.();for(const resolve of gpsReads)resolve(null);await Promise.resolve();
  assert.equal(intervals.size,0);assert.equal(stopCount,1);f.clean();}
});
test('PRODUCT caller record suspends exact operations reads and resumes only the same normal named session',async()=>{
 const f=recordPageAuthFixture(recordFixture()),page=require('../dashboard-map-page.js'),intervals=new Map();let release,feeds=0;
 const held=new Promise(resolve=>{release=resolve;}),signals=[],gpsReads=[];
 f.window.MemphisAuth.requireOpsManagerSession=async()=>f.window.MemphisAuth.readSession();
 f.window.MemphisAuth.opsManagerAuthHeaders=async()=>({Authorization:'Bearer synthetic-session','X-Device-Id':'KIOSK_01'});
 const map={init:async()=>true,resume:async()=>true,checkSession:()=>true,beginRefresh:()=>({}),accept:()=>true,
  fail(){},invalidate(){},suspend(){},stop(){},acceptGps(){throw Error('Old suspended GPS must not publish');},unavailableGps(){}};
 const caller=page.create({auth:f.window.MemphisAuth,renderer:{create:()=>map},section:f.elements['dashboard-map'],
  status:f.elements['map-page-status'],window:f.window,operations:f.controller,
  gpsSource:{read:()=>new Promise(resolve=>gpsReads.push(resolve))},
  setIntervalImpl:(fn,ms)=>{intervals.set(ms,fn);return ms;},clearIntervalImpl:id=>intervals.delete(id),
  fetchImpl:async(url,options)=>{if(url.endsWith('/summary'))return{ok:true,json:async()=>({ok:true,data:recordSummary(recordRow())})};
   signals.push(options.signal);if(++feeds<=3)await held;return{ok:true,json:async()=>url.endsWith('/operations')?payload:null};}});
 try{
  assert.equal(await caller.init(),true);await new Promise(r=>setImmediate(r));assert.equal(f.timeouts.size,1);
  caller.suspend();assert(signals.every(s=>s.aborted));assert.equal(f.timeouts.size,0);assert.equal(intervals.size,0);
  assert.equal(await caller.resume(),true);await new Promise(r=>setImmediate(r));f.triggers[3].emit('click');
  assert.match(f.text(f.content),/Saved pending/);release();gpsReads[0](null);await new Promise(r=>setImmediate(r));
  assert.match(f.text(f.content),/Current saved worker/);
  f.setSession({role:'ops_manager',manager_id:'synthetic-manager',credential_id:'synthetic-credential',device_id:'KIOSK_01',token:'changed-session',read_only:true});
  assert.equal(caller.checkPrincipal(),false);assert.equal(f.dialog.open,false);assert.equal(intervals.size,0);
  assert.equal(await caller.resume(),false);
 }finally{caller.stop();release();for(const resolve of gpsReads)resolve(null);await Promise.resolve();
  assert.equal(intervals.size,0);f.clean();}
});

const originalCompletion=()=>({schema:'custodial.dashboard-original-completion.v1',state:'SERVER_ACCEPTED_ORIGINAL_RECORD',
 reconciliation_id:recordId(10),context_id:recordId(11),occurrence_id:recordId(12),occurrence_fingerprint:'a'.repeat(64),payload_fingerprint:'b'.repeat(64),
 employee_id:recordId(13),employee_name:'Accepted original worker',device_id:recordId(14),credential_id:recordId(15),assignment_epoch:'4',
 location_id:recordId(1),session_uuid:recordId(3),client_session_id:recordId(16),client_completion_id:recordId(17),snapshot_id:'c'.repeat(64),
 started_at:'2026-10-05T16:00:00.000Z',completed_at:'2026-10-05T16:30:00.123000Z',accepted_at:'2026-10-05T16:30:01.654321+00:00',
 work_result:'full',services_performed:['Full cleaning services'],schedule_authority_revision:null,schedule_authority_revision_available:false});

test('PRODUCT SQL UUID record keys and exact opaque session identities are displayed without numeric coercion',async()=>{
 const f=recordFixture();try{
  const key='98000000-0000-7000-0000-000000000041',session='native-attestation-session-1';
  const row={...recordRow(),open_session_status:null,open_session_uuid:null,latest_completed_session_id:key,latest_completed_session_uuid:session};
  await loaded(f,{summary:recordSummary(row)});f.triggers[3].emit('click');
  const text=f.text(f.content);assert.match(text,/Closed cleaning record ·/);assert(text.includes(`Closed session: ${session} · Record ${key}`));
  assert.doesNotMatch(text,/server-accepted original/i);
  for(const bad of [41,'41',null,{},key.slice(1),'98000000-0000-7000-0000-00000000004g']){
   await loaded(f,{summary:recordSummary({...row,latest_completed_session_id:bad})});
   assert.doesNotMatch(f.text(f.content),/Closed cleaning record ·/i);
  }
 }finally{f.clean();}
});
test('PRODUCT canonical original text session identities preserve SQL character length and HTTP completion UUID domain',async()=>{
 const f=recordFixture();try{
  for(const session of ['native-attestation-session-1','s'.repeat(200),'😀'.repeat(200)]){
   const original={...originalCompletion(),session_uuid:session,client_session_id:session,
    reconciliation_id:'98000000-0000-7000-0000-000000000010'};
   const before=JSON.stringify(original);
   await loaded(f,{summary:recordSummary({...recordRow(),open_session_status:null,open_session_uuid:null,latest_original_completion:original})});
   f.triggers[3].emit('click');const text=f.text(f.content);
   assert.match(text,/Server-accepted original record/);assert(text.includes(`Original session: ${session} · Client session: ${session}`));
   assert(text.includes(original.client_completion_id));assert.match(text,/not physical or overall current-source proof/);
   assert.equal(JSON.stringify(original),before);f.controller.closeBoard();
  }
  const original=originalCompletion();
  for(const bad of ['',null,7,{},' '.repeat(2),' session','session ','s'.repeat(201),'😀'.repeat(201),'session\0id']){
   for(const field of ['session_uuid','client_session_id']){
    await loaded(f,{summary:recordSummary({...recordRow(),latest_original_completion:{...original,[field]:bad}})});
    f.triggers[3].emit('click');assert.doesNotMatch(f.text(f.content),/server-accepted original/i);f.controller.closeBoard();
   }
  }
  for(const bad of ['opaque-completion-id','98000000-0000-7000-0000-000000000017']){
   await loaded(f,{summary:recordSummary({...recordRow(),latest_original_completion:{...original,client_completion_id:bad}})});
   f.triggers[3].emit('click');assert.doesNotMatch(f.text(f.content),/server-accepted original/i);f.controller.closeBoard();
  }
 }finally{f.clean();}
});
test('PRODUCT original SQL timestamps preserve valid offsets and microsecond ordering without rewriting Source strings',async()=>{
 const f=recordFixture();try{
  const times=[
   {started_at:'2026-10-05T11:00:00.000-05:00',completed_at:'2026-10-05T11:30:00.123001-05:00',accepted_at:'2026-10-05T11:30:01.654321-05:00'},
   {started_at:'2026-10-05T21:45:00.000+05:45',completed_at:'2026-10-05T22:15:00.123456+05:45',accepted_at:'2026-10-05T22:15:01.654321+05:45'},
   {started_at:'2026-10-05T11:30:00.123456-05:00',completed_at:'2026-10-05T16:30:00.123457Z',accepted_at:'2026-10-05T11:21:00.654321-05:00'}
  ];
  for(const time of times){
   const original={...originalCompletion(),...time},before=JSON.stringify(original);
   await loaded(f,{summary:recordSummary({...recordRow(),open_session_status:null,open_session_uuid:null,latest_original_completion:original})});
   f.triggers[3].emit('click');const text=f.text(f.content);assert.match(text,/Server-accepted original record/);
   for(const value of Object.values(time))assert(text.includes(value),'keep exact SQL offset/fraction string');
   assert.match(text,/Native clock alignment: unavailable/);assert.equal(JSON.stringify(original),before);f.controller.closeBoard();
  }
  for(const time of [
   {started_at:'2026-10-05T11:30:00.123456-05:00',completed_at:'2026-10-05T16:30:00.123456Z'},
   {started_at:'2026-10-05T11:30:00.123456-05:00',completed_at:'2026-10-05T16:30:00.123455Z'},
   {completed_at:'2026-10-05T11:30:00.1234567-05:00'},
   {completed_at:'2026-10-05T11:30:00.123456+24:00'}
  ]){
   const original={...originalCompletion(),...time},before=JSON.stringify(original);
   await loaded(f,{summary:recordSummary({...recordRow(),latest_original_completion:original})});
   f.triggers[3].emit('click');assert.doesNotMatch(f.text(f.content),/server-accepted original/i);
   assert.equal(JSON.stringify(original),before);f.controller.closeBoard();
  }
 }finally{f.clean();}
});

test('PRODUCT canonical work-result service relationships reject malformed originals without rewriting retained answers',async()=>{
 const f=recordFixture();try{
  for(const [work_result,services_performed] of [
   ['full',['Full cleaning services']],['full',['\u2000FULL cleaning SERVICES\u00a0']],
   ['details',['Trash emptied']],['selective',['Sinks cleaned','Floor swept']],['checked_no_cleaning_needed',[]]
  ]){
   const original={...originalCompletion(),work_result,services_performed},before=JSON.stringify(original);
   await loaded(f,{summary:recordSummary({...recordRow(),open_session_status:null,open_session_uuid:null,latest_original_completion:original})});
   f.triggers[3].emit('click');assert.match(f.text(f.content),/Server-accepted original record/);
   assert.equal(JSON.stringify(original),before);f.controller.closeBoard();
  }
  for(const [work_result,services_performed] of [
   ['full',[]],['full',['Trash emptied']],['full',['Full cleaning services','Trash emptied']],
   ['full',['Full cleaning services','Full cleaning services']],['details',[]],['selective',[]],
   ['details',['Full cleaning services']],['details',['Trash emptied','\u2000FULL CLEANING SERVICES\u00a0']],
   ['selective',['full cleaning services']],['checked_no_cleaning_needed',['Trash emptied']],
   ['details',['\u2000\u00a0']],['details',['valid',{}]],['details',null]
  ]){
   const original={...originalCompletion(),work_result,services_performed},before=JSON.stringify(original);
   await loaded(f,{summary:recordSummary({...recordRow(),latest_original_completion:original})});
   f.triggers[3].emit('click');assert.doesNotMatch(f.text(f.content),/server-accepted original/i);
   assert.equal(JSON.stringify(original),before);f.controller.closeBoard();
  }
 }finally{f.clean();}
});

test('PRODUCT producer-valid large service selections retain receipt validity with explicit bounded presentation',async()=>{
 const f=recordFixture();try{
  const original={...originalCompletion(),work_result:'details',
   services_performed:['L'.repeat(2000)+'UNSHOWN_SUFFIX',...Array.from({length:200},(_,i)=>`service-${i}`)]};
  const before=JSON.stringify(original);
  await loaded(f,{summary:recordSummary({...recordRow(),latest_original_completion:original})});f.triggers[3].emit('click');
  const text=f.text(f.content);assert.match(text,/server-accepted original record/i);
  assert.match(text,/Showing the first 200 of 201 original service entries/);
  assert.match(text,/limited to 2000 characters per entry/);assert(text.includes('service-198'));
  assert(!text.includes('service-199'));assert(!text.includes('UNSHOWN_SUFFIX'));assert(text.length<20000);
  assert.equal(JSON.stringify(original),before);
  for(const bad of [null,{},[''],['   '],['valid',{}],[...original.services_performed,{}]]){
   await loaded(f,{summary:recordSummary({...recordRow(),latest_original_completion:{...original,services_performed:bad}})});
   assert.doesNotMatch(f.text(f.content),/server-accepted original/i);
  }
 }finally{f.clean();}
});
test('PRODUCT opaque pending identity cannot be promoted by matching original or case-normalized identity',async()=>{
 const f=recordFixture();try{
  const session='native-attestation-session-1',original={...originalCompletion(),session_uuid:session,client_session_id:session};
  const row={...recordRow(),open_session_uuid:session,latest_completed_session_uuid:session,latest_original_completion:original};
  await loaded(f,{summary:recordSummary(row)});f.triggers[3].emit('click');let text=f.text(f.content);
  assert.match(text,/Saved pending.*not accepted/);assert.doesNotMatch(text,/server-accepted original|Closed cleaning record ·/i);
  await loaded(f,{summary:recordSummary({...row,open_session_uuid:session.toUpperCase()})});text=f.text(f.content);
  assert.match(text,/Preceding server-accepted original record/);assert(text.includes(`Current session: ${session.toUpperCase()}`));
  assert(text.includes(`Original session: ${session}`)); // Opaque identity is exact, never lowercased.
 }finally{f.clean();}
});

test('PRODUCT canonical details completion is rendered as selective work without rewriting the original',async()=>{
 const f=recordFixture();try{
  const original={...originalCompletion(),work_result:'details',services_performed:['Sweep the floor']};
  await loaded(f,{summary:recordSummary({...recordRow(),open_session_status:null,open_session_uuid:null,latest_original_completion:original})});
  f.triggers[3].emit('click');const text=f.text(f.content);
  assert.match(text,/Server-accepted original record/);assert.match(text,/Recorded work: Selective cleaning/);
  assert.match(text,/Sweep the floor/);assert.doesNotMatch(text,/Check only|Full cleaning/);
  assert.equal(original.work_result,'details');
 }finally{f.clean();}
});
test('PRODUCT original completion presentation keeps original accepted tuple separate from current pending worker and replaces it on refresh',async()=>{
 const f=recordFixture();try{
  const original=originalCompletion(),summary=recordSummary({...recordRow(),latest_original_completion:original});
  const calls=await loaded(f,{summary});f.triggers[3].emit('click');const text=f.text(f.content);
  assert.match(text,/Saved pending.*not accepted/);assert.match(text,/Current saved worker/);
  assert.match(text,/Preceding server-accepted original record/);assert.match(text,/Accepted original worker/);
  assert.doesNotMatch(text,/Previous closed worker/);
  for(const field of ['employee_id','location_id','session_uuid','client_session_id','client_completion_id','occurrence_id',
   'occurrence_fingerprint','payload_fingerprint','snapshot_id','credential_id','device_id','context_id','reconciliation_id','started_at','completed_at','accepted_at'])
   assert(text.includes(original[field]),field);
  assert.match(text,/Original assignment epoch: 4/);assert.match(text,/Full cleaning/);assert.match(text,/Full cleaning services/);
  assert.match(text,/Original schedule authority revision: unavailable/);assert.match(text,/not.*physical.*current-source/i);
  assert(calls.every(call=>call.options.method==='GET')); // Normal readonly manager has no mutation control/API.
  const newer={...original,session_uuid:recordId(2),client_completion_id:recordId(18),employee_name:'New accepted original',work_result:'selective',services_performed:['Sinks cleaned'],
   completed_at:'2026-10-05T16:55:00Z',accepted_at:'2026-10-05T16:56:00Z'};
  await loaded(f,{summary:recordSummary({...recordRow(),open_session_status:null,open_session_uuid:null,latest_original_completion:newer})});
  assert.match(f.text(f.content),/Server-accepted original record/);assert.match(f.text(f.content),/New accepted original/);
  assert.doesNotMatch(f.text(f.content),/Accepted original worker|Saved pending/);assert.match(f.text(f.content),/Selective cleaning/);
  await loaded(f,{summary:recordSummary({...recordRow(),latest_original_completion:null})});
  assert.doesNotMatch(f.text(f.content),/server-accepted original/i);
 }finally{f.clean();}
});
test('PRODUCT original completion malformed or foreign receipt cannot promote bool/name/cache or invented revision',async()=>{
 const f=recordFixture();try{
  const original=originalCompletion(),cases=[null,true,{state:original.state,employee_name:original.employee_name},
   {...original,state:'PENDING'}, {...original,location_id:recordId(99)}, {...original,employee_id:null},
   {...original,assignment_epoch:4},{...original,assignment_epoch:'0'},{...original,assignment_epoch:'01'},
   {...original,assignment_epoch:'1e4'}, {...original,occurrence_fingerprint:'bad'}, {...original,snapshot_id:null},
   {...original,schedule_authority_revision:0},{...original,schedule_authority_revision_available:true},
   {...original,services_performed:[{}]}, {...original,work_result:'provider_accepted'}, {...original,provider_accepted:true},
   {...original,started_at:'2026-02-30T12:00:00Z'}, {...original,completed_at:'2026-10-05T24:00:00Z'},
   {...original,completed_at:original.started_at},
   {...original,completed_at:'2026-10-05T16:30:00+01:00'},
   ...Object.keys(original).map(key=>{const copy={...original};delete copy[key];return copy;})];
  for(const receipt of cases){await loaded(f,{summary:recordSummary({...recordRow(),latest_original_completion:receipt})});
   f.triggers[3].emit('click');assert.doesNotMatch(f.text(f.content),/server-accepted original/i);f.controller.closeBoard();}
  // A current uncompleted session cannot simultaneously be the accepted closed original.
  await loaded(f,{summary:recordSummary({...recordRow(),open_session_uuid:original.session_uuid,latest_original_completion:original})});
  f.triggers[3].emit('click');assert.doesNotMatch(f.text(f.content),/server-accepted original/i);
 }finally{f.clean();}
});
test('PRODUCT original completion check-only stays check-only and its original strings stay accessible text',async()=>{
 const f=recordFixture();try{
  const original={...originalCompletion(),session_uuid:recordId(40),employee_name:'<img onerror=bad()>',work_result:'checked_no_cleaning_needed',services_performed:[]};
  await loaded(f,{summary:recordSummary({...recordRow(),open_session_status:null,open_session_uuid:null,latest_original_completion:original})});
  f.triggers[3].emit('click');const text=f.text(f.content);
  assert.match(text,/Server-accepted original record/);assert.match(text,/Check only.*no cleaning reported needed/);
  assert.match(text,/<img onerror=bad\(\)>/);assert.equal(f.content.querySelectorAll('img').length,0);
  assert.match(text,/Reported services: none \(check only\)/);assert.doesNotMatch(text,/Full cleaning|Selective cleaning/);
  // Previous ordinary cleaning projection survives as separate history, not a promoted check.
  assert.match(text,/Previous closed worker/);
  await loaded(f,{summary:recordSummary({...recordRow(),latest_original_completion:{...original,services_performed:['Trash emptied']}})});
  assert.doesNotMatch(f.text(f.content),/server-accepted original/i);
 }finally{f.clean();}
});
test('PRODUCT original receipt ownership snapshots source facts and withdraws accepted display on changed awaited named session',async()=>{
 const f=recordFixture();let release;try{
  const original=originalCompletion(),summary=recordSummary({...recordRow(),latest_original_completion:original});
  let held=new Promise(resolve=>{release=resolve;}),signals=[];
  const start=()=>f.controller.refresh({summary,headers:{},isCurrent:()=>true,fetchImpl:async(_url,{signal})=>{
   signals.push(signal);await held;return{ok:true,json:async()=>payload};}});
  const first=start();f.triggers[3].emit('click');assert.match(f.text(f.content),/Accepted original worker/);
  original.employee_name='Mutated late worker';original.client_completion_id=recordId(98);release();await first;
  assert.match(f.text(f.content),/Accepted original worker/);assert.doesNotMatch(f.text(f.content),/Mutated late worker/);
  held=new Promise(resolve=>{release=resolve;});const next=start();
  f.setSession({role:'ops_manager',manager_id:'another-manager',credential_id:'another-credential',device_id:'KIOSK_01',token:'another-session',read_only:true});
  release();await next;assert.equal(f.dialog.open,false);assert.doesNotMatch(f.text(f.content),/server-accepted original/i);
  assert(signals.slice(-3).every(signal=>signal.aborted));assert.equal(f.timeouts.size,0);
 }finally{release?.();f.clean();}
});
test('PRODUCT SQL employee names remain valid verbatim receipt strings with bounded display only',async()=>{
 const f=recordFixture();try{
  for(const employee_name of ['', ' \t\u2000', 'Known worker '+ 'N'.repeat(2100)+'UNSHOWN_NAME_TAIL']){
   const original={...originalCompletion(),employee_name},before=JSON.stringify(original);
   await loaded(f,{summary:recordSummary({...recordRow(),open_session_status:null,open_session_uuid:null,latest_original_completion:original})});
   f.triggers[3].emit('click');const text=f.text(f.content);assert.match(text,/Server-accepted original record/);
   if(employee_name.trim()){
    assert(text.includes(employee_name.trim().slice(0,2000)));assert(!text.includes('UNSHOWN_NAME_TAIL'));
   }else assert.match(text,/Original employee: Not provided/);
   assert.equal(JSON.stringify(original),before);f.controller.closeBoard();
  }
  for(const employee_name of [null,7,{},[],true]){
   const original={...originalCompletion(),employee_name};
   await loaded(f,{summary:recordSummary({...recordRow(),latest_original_completion:original})});
   f.triggers[3].emit('click');assert.doesNotMatch(f.text(f.content),/server-accepted original/i);f.controller.closeBoard();
  }
 }finally{f.clean();}
});

test('PRODUCT DB receipt acceptance does not require agreement with the Node summary clock',async()=>{
 const f=recordFixture();try{
  for(const accepted_at of ['2026-10-05T17:01:00.000001Z','2026-10-05T12:01:00.654321-05:00','2026-10-06T18:00:00.123456Z']){
   const original={...originalCompletion(),accepted_at},before=JSON.stringify(original);
   const summary=recordSummary({...recordRow(),open_session_status:null,open_session_uuid:null,latest_original_completion:original});
   assert(Date.parse(accepted_at)>Date.parse(summary.meta.generated_at),'explicitly model independent DB and Node clocks');
   await loaded(f,{summary});f.triggers[3].emit('click');const text=f.text(f.content);
   assert.match(text,/Server-accepted original record/);assert(text.includes(accepted_at));
   assert.match(text,/Native clock alignment: unavailable/);assert.equal(JSON.stringify(original),before);f.controller.closeBoard();
  }
  // Node-generated summary currentness remains a separate policy; receipt bytes
  // do not manufacture a fresh summary when that policy refuses it.
  const original=originalCompletion(),summary=recordSummary({...recordRow(),latest_original_completion:original});
  summary.meta.generated_at='2026-10-05T17:02:00Z';
  await loaded(f,{summary});f.triggers[3].emit('click');assert.doesNotMatch(f.text(f.content),/server-accepted original/i);
 }finally{f.clean();}
});

test('PRODUCT original acceptance clock preserves legitimate earlier SQL transaction clock without native alignment authority',async()=>{
 const f=recordFixture();try{
  for(const original of [
   {...originalCompletion(),accepted_at:'2026-10-05T16:21:00Z'},
   {...originalCompletion(),accepted_at:'2026-10-05T16:30:00.122999Z'},
   {...originalCompletion(),started_at:'2026-10-05T16:25:00Z',accepted_at:'2026-10-05T16:21:00Z'}
  ]){await loaded(f,{summary:recordSummary({...recordRow(),latest_original_completion:original})});
   f.triggers[3].emit('click');const text=f.text(f.content);assert.match(text,/server-accepted original record/i);
   assert(text.includes(original.accepted_at));assert(text.includes(original.completed_at));
   assert.match(text,/Native clock alignment: unavailable/);assert.match(text,/Original schedule authority revision: unavailable/);
   assert.doesNotMatch(text,/clock (?:verified|aligned)|10.min(?:ute)?/i);f.controller.closeBoard();}
 }finally{f.clean();}
});

/** Actual producer values only; no reconstruction of the accepted DTO here.
 * Main supplies SQL-produced pending/accepted summaries + original readback.
 * The existing DOM and session facade remain SOURCE fixtures, never G12 auth.
 */
export async function originalCompletionDashboardPresentationProof({pendingSummary,acceptedSummary,result,readback,expected}){
 const f=fixture();let release;try{
  const rows=[...acceptedSummary.restrooms,...acceptedSummary.exhibits];
  const acceptedRow=rows.find(row=>row.location_id===expected.location_id),accepted=acceptedRow?.latest_original_completion;
  const checkOnly=expected.work_result==='checked_no_cleaning_needed';
  assert.ok(acceptedRow,'one exact location row required');
  if(checkOnly){
   assert.equal(accepted,null,'a newer check-only receipt is not the latest-cleaning original');
   assert.notEqual(acceptedRow.latest_completed_session_uuid,result.session_uuid);
   assert.equal(acceptedRow.latest_verified_check_session_uuid,result.session_uuid);
   assert.equal(acceptedRow.latest_verified_check_completion_id,result.client_completion_id);
   assert.equal(acceptedRow.latest_verified_checker_name,expected.employee_name);
   assert.equal(Date.parse(acceptedRow.latest_verified_check_at),Date.parse(expected.completed_at));
  }else{
   assert.ok(accepted,'actual source same-session original required');
   assert.equal(accepted.session_uuid,acceptedRow.latest_completed_session_uuid);
   assert.equal(accepted.client_completion_id,result.client_completion_id);
   assert.equal(accepted.reconciliation_id,readback.readback.reconciliation_id);
  }
  const pin=f.viewport.children[0];pin.dataset.locationId=expected.location_id;
  f.setNow(Date.parse(acceptedSummary.meta.generated_at));
  const calls=await loaded(f,{summary:pendingSummary});f.triggers[3].emit('click');
  const before=f.text(f.content);assert.match(before,/Saved pending.*not accepted|Work in progress.*not completed/i);
  assert(!before.includes(expected.client_completion_id),'unaccepted original must not display as done');
  await loaded(f,{summary:acceptedSummary});const text=f.text(f.content);
  assert.doesNotMatch(text,/Saved pending|Work in progress/);
  if(checkOnly){
   // The unchanged cleaning card does not display a separate verified-check
   // receipt. Its metadata remains in the summary; never invent an original.
   assert.doesNotMatch(text,/server-accepted original record|Recorded work: (?:Full|Selective) cleaning/i);
   assert.match(text,/Original completion receipt.*unavailable or unconfirmed/i);
   assert(!text.includes(result.client_completion_id));
   assert.deepEqual(expected.services_performed,[]);
  }else{
   assert.match(text,/Server-accepted original record/);
   for(const key of ['employee_id','employee_name','location_id','session_uuid','client_session_id','client_completion_id',
    'occurrence_id','occurrence_fingerprint','payload_fingerprint','reconciliation_id','context_id','snapshot_id','started_at','completed_at','accepted_at'])
    assert(text.includes(accepted[key]),'actual rendered original '+key);
   assert(text.includes('Original assignment epoch: '+accepted.assignment_epoch));
   assert(text.includes(accepted.work_result==='full'?'Recorded work: Full cleaning':'Recorded work: Selective cleaning'));
   for(const service of accepted.services_performed.slice(0,200))assert(text.includes(service.trim().slice(0,2000)));
   assert.match(text,/Original schedule authority revision: unavailable/);assert.match(text,/Native clock alignment: unavailable/);
  }
  assert(calls.every(call=>call.options.method==='GET'),'readonly manager never sends mutation');
  const wait=new Promise(resolve=>{release=resolve;}),signals=[];
  const pending=f.controller.refresh({summary:acceptedSummary,headers:{},isCurrent:()=>true,
   fetchImpl:async(_url,{signal})=>{signals.push(signal);await wait;return {ok:true,json:async()=>payload};}});
  f.setSession({role:'ops_manager',manager_id:'successor-fixture',credential_id:'successor-fixture',device_id:'KIOSK_01',token:'successor-fixture',read_only:true});
  release();await pending;assert.equal(f.dialog.open,false);assert(!f.text(f.content).includes(expected.client_completion_id));
  assert(signals.every(signal=>signal.aborted));assert.equal(f.timeouts.size,0);
  return {qualifying_surface:'actual-dashboard-data-controller-in-process-DOM',
   stages:['actual uncompleted row not done',checkOnly?'exact verified-check metadata retained; latest-cleaning original unavailable':'actual same-session original result rendered','source-fixture awaited named-session withdrawal'],
   readonly_mutations:0,limits:'Input provenance belongs to main normal SQL/reader receipt; this DOM/session facade is not browser or real-manager authentication.'};
 }finally{release?.();f.clean();}
}

test('PRODUCT current original SQL-summary-dashboard callable source composition needs real capabilities and preserves work outcomes',async()=>{
 const {currentOriginalCompletionDashboardProof}=await import('../test-fixtures/ci/current-backend/scripts/verified-visit-completion-integration-tests.mjs');
 await assert.rejects(currentOriginalCompletionDashboardProof({}),/normal SQL\/writer\/readback\/presenter capability required/);
 for(const {work_result,priorCleaning} of [
  {work_result:'full',priorCleaning:false},
  {work_result:'checked_no_cleaning_needed',priorCleaning:false},
  {work_result:'checked_no_cleaning_needed',priorCleaning:true}
 ]){
  // Recording callbacks are deliberate SOURCE-only inputs; no SQL or named
  // manager authentication occurs here. Main runs this same callable with its
  // actual protected SQL/writer/readback resources, not these recording inputs.
  const at=Date.now(),priorAt=new Date(at-120000).toISOString(),original={...originalCompletion(),work_result,
   session_uuid:'native-attestation-session-1',client_session_id:'native-attestation-session-1',
   services_performed:work_result==='full'?['Full cleaning services']:[],
   started_at:new Date(at-60000).toISOString(),completed_at:new Date(at-30000).toISOString(),
   accepted_at:new Date(at-90000).toISOString()};
  const sourceFixture=Object.fromEntries(['employee_id','employee_name','location_id','device_id','credential_id','context_id',
   'occurrence_id','snapshot_id','assignment_epoch','client_session_id','client_completion_id','started_at','completed_at','work_result','services_performed']
   .map(key=>[key,original[key]]));
  const result={status:'closed',client_session_id:original.client_session_id,client_completion_id:original.client_completion_id,
   session_uuid:original.session_uuid,started_at:original.started_at,ended_at:original.completed_at};
  const readback={schema:'custodial.original-completion-readback.v1',found:true,result,readback:{
   reconciliation_id:original.reconciliation_id,context_id:original.context_id,occurrence_id:original.occurrence_id,
   original_employee_id:original.employee_id,original_credential_id:original.credential_id,device_id:original.device_id,
   location_id:original.location_id,payload_fingerprint:original.payload_fingerprint,assignment_epoch:4}};
  let committed=false,writes=0,reads=0,presented=0;const queries=[];
  const runReadOnlySql=async sql=>{
   queries.push(sql);assert.doesNotMatch(sql,/\b(insert|update|delete|grant)\b/i);
   if(sql.includes('from public.v_admin_health_snapshot'))return [{}];
   if(sql.includes('from public.v_location_dashboard_status')){
    assert.match(sql,/left join custodial_release_identity\.read_current_original_dashboard_completions_v1\(\) as original_completion/);
    assert.match(sql,/original_completion\.location_id = location\.location_id/);
    assert.match(sql,/location\.latest_completed_session_uuid = \(original_completion\.latest_original_completion->>'session_uuid'\)/);
    const cleaning=committed&&work_result==='full';
    return [{...recordRow(),open_session_status:committed?null:'pending_submit',open_session_uuid:committed?null:original.client_session_id,
     latest_completed_session_id:cleaning?recordId(42):priorCleaning?recordId(41):null,
     latest_completed_session_uuid:cleaning?original.session_uuid:priorCleaning?'prior-cleaning-source-session':null,
     // This is a synthetic SQL response, not an implementation of the join.
     // A newer check-only original or older mismatched original is NULL for
     // the latest-cleaning identity; verified-check data has its own query.
     latest_original_completion:cleaning?original:null,
     latest_completed_at:cleaning?original.completed_at:priorCleaning?priorAt:null,
     latest_checked_at:committed?original.completed_at:priorCleaning?priorAt:null,
     latest_employee_name:cleaning?original.employee_name:priorCleaning?'Previous closed worker':null}];
   }
   if(sql.includes('from public.v_open_maintenance_tickets'))return [];
   assert.match(sql,/^\s*select location_id,latest_verified_check_at,latest_verified_checker_name,\s*latest_verified_check_session_uuid,latest_verified_check_completion_id\s+from custodial_release_identity\.read_current_verified_dashboard_checks_v1\(\)\s*$/);
   return committed&&work_result==='checked_no_cleaning_needed'?[{location_id:original.location_id,
    latest_verified_check_at:original.completed_at,latest_verified_checker_name:original.employee_name,
    latest_verified_check_session_uuid:original.session_uuid,latest_verified_check_completion_id:original.client_completion_id}]:[];
  };
  const options={runReadOnlySql,readRole:'SOURCE_RECORDING_ONLY_NO_SQL_ROLE',sourceFixture,
   commitOriginalVisit:async()=>{writes++;committed=true;return result;},
   readOriginalCompletion:async()=>{reads++;return readback;},
   presentDashboard:async input=>{presented++;return originalCompletionDashboardPresentationProof(input);}};
  const value=await currentOriginalCompletionDashboardProof(options);
  assert.equal(writes,1);assert.equal(reads,1);assert.equal(presented,1);assert.equal(queries.length,8);
  assert.equal(queries.filter(sql=>sql.includes('left join custodial_release_identity.read_current_original_dashboard_completions_v1()')).length,2);
  assert.equal(queries.filter(sql=>sql.includes('from custodial_release_identity.read_current_verified_dashboard_checks_v1()')).length,2);
  assert.equal(value.aggregate_timestamps.before_latest_completed_at,priorCleaning?priorAt:null);
  assert.equal(value.aggregate_timestamps.after_latest_completed_at,work_result==='full'?original.completed_at:priorCleaning?priorAt:null);
  assert.equal(value.original_projection,work_result==='full'?'EXACT_LATEST_CLEANING_SESSION':'UNAVAILABLE_FOR_LATEST_CLEANING_SESSION');
  assert.equal(value.aggregate_timestamps.after_latest_checked_at,original.completed_at);
  assert.equal(value.work_result,work_result);assert.equal(value.presentation.readonly_mutations,0);
  assert.match(value.limits,/main must bind actual normal SQL/);
  if(work_result==='full'){
   const normalRead=options.runReadOnlySql;
   for(const mismatch of [{...original,session_uuid:'older-mismatched-session'}, {...original,location_id:recordId(99)}]){
    writes=0;reads=0;presented=0;committed=false;
    options.runReadOnlySql=async sql=>{const rows=await normalRead(sql);
     return committed&&sql.includes('from public.v_location_dashboard_status')
      ?rows.map(row=>({...row,latest_original_completion:mismatch})):rows;};
    await assert.rejects(currentOriginalCompletionDashboardProof(options));
    assert.equal(writes,1);assert.equal(reads,1);assert.equal(presented,0);
   }
   options.runReadOnlySql=normalRead;
  }
  // A foreign original receipt cannot reach the presenter or trigger another
  // writer. Use a new source fixture callback only for this negative, no resend.
  writes=0;reads=0;presented=0;committed=false;
  options.readOriginalCompletion=async()=>{reads++;return {...readback,readback:{...readback.readback,context_id:recordId(99)}};};
  await assert.rejects(currentOriginalCompletionDashboardProof(options));assert.equal(writes,1);assert.equal(reads,1);assert.equal(presented,0);
 }
});
