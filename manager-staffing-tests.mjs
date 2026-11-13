import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createStaffingActions} from './manager-staffing-actions.mjs';
import {mountStaffingPage} from './manager-staffing-page.mjs';
import {mountStaffingRuntime} from './manager-staffing-runtime.mjs';

// Exact committed helper, not a replacement permission guard. Only API/data
// boundaries are synthetic. No browser, credentials, storage or live SQL.
assert.ok(process.env.STAFFING_HELPER_PATH && /^[a-f0-9]{64}$/.test(process.env.STAFFING_HELPER_SHA256||''),'Supply the exact committed or sealed main-owned helper input and hash.');
const helperBytes=readFileSync(process.env.STAFFING_HELPER_PATH,'utf8');
test('MAIN_MOUNT normal authenticated website runtime binds fixed service and preserves readonly/native boundaries',async()=>{
 const id='11000000-0000-4000-8000-000000000001',calls=[],timers=new Set(),events=new Map();let helpers=0,owner=false,apiSeen;
 const session={role:'ops_manager',manager_id:id,credential_id:'current-fixture',device_id:'fixture-web',token:'synthetic-only',expires_at:new Date(Date.now()+3600000).toISOString(),read_only:true,permissions:{}};
 const w={MemphisAuth:{readSession:()=>session,opsManagerAuthHeaders:async()=>({Authorization:'Bearer synthetic-only'})},
  MemphisSchedulerActions:{principal:()=>({managerId:id,credentialId:session.credential_id,deviceId:session.device_id}),permissions:()=>({read:true,owner}),create:()=>{helpers++;return{pending:()=>null};}},
  setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn),addEventListener:(n,fn)=>events.set(n,fn),removeEventListener:n=>events.delete(n)};
 const fetchImpl=async(url,options)=>{calls.push({url,options});return{ok:true,status:200,json:async()=>({ok:true,data:url.endsWith('/scheduler-runtime-config')?{public_url:'https://scheduler-fixture.onrender.com'}:{current:true}})};};
 const mount=deps=>({init:async()=>{apiSeen=deps.api;await deps.api('/static-weekly/manager-snapshot?week_start=2026-10-05',{method:'GET',expectedManagerId:id});return true;},stop:()=>{}});
 const read=await mountStaffingRuntime({w,d:{},fetchImpl,mount});assert.equal(helpers,0);assert.equal(calls.length,2);
 assert.equal(calls[1].url,'https://scheduler-fixture.onrender.com/static-weekly/manager-snapshot?week_start=2026-10-05');
 assert.equal(calls[1].options.headers.Authorization,'Bearer synthetic-only');assert.equal(timers.size,0);
 await assert.rejects(apiSeen('/static-weekly/staffing/source-details',{expectedManagerId:'foreign'}));assert.equal(calls.length,2);read.stop();assert.equal(events.size,0);
 owner=true;session.read_only=false;const write=await mountStaffingRuntime({w,d:{},fetchImpl,mount});assert.equal(helpers,1);
 session.token='changed-synthetic-session';await assert.rejects(apiSeen('/static-weekly/manager-snapshot'));write.stop();
 const prior=calls.length;w.MemphisMobile={edition:'custodial'};assert.equal(await mountStaffingRuntime({w,d:{},fetchImpl,mount}),null);assert.equal(calls.length,prior);
});
assert.equal(createHash('sha256').update(helperBytes).digest('hex'),process.env.STAFFING_HELPER_SHA256,'Exact owning helper bytes; never a replacement authorization guard.');
const context={URL};vm.runInNewContext(helperBytes,context);const authority=context.MemphisSchedulerActions;
const id=n=>`98000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=Date.parse('2026-10-11T17:00:00Z'),sourceId=id(1),slotId=id(2),employeeId=id(3),managerId=id(4),publication=id(5),digest='a'.repeat(64);
const snapshot=()=>({schema:'memphis-zoo.static-weekly-manager-snapshot.v1',week_start:'2026-10-05',week_end:'2026-10-11',authority_revision:12,
  sources:[{source_id:sourceId,source_digest:digest}],current_publication:{authority_source_id:sourceId,publication_id:publication},
  roster:[{slot_id:slotId,slot_label:'North <script>not executable</script>',contractor_capacity:false,
    incumbencies:[{person_id:employeeId,person_name:'Original <img> person',effective_start:'2026-09-01',effective_end:null}],
    week_staffing:[{service_date:'2026-10-11',person_id:employeeId,person_name:'Original <img> person',employee_active:true,availability_state:'working'}]}]});
function authFixture(owner=true){let session={role:'ops_manager',manager_id:managerId,manager_display_name:'Synthetic manager',credential_id:id(6),device_id:'synthetic-device',token:'synthetic-session-only',expires_at:'2099-01-01T00:00:00Z',read_only:!owner,
  permissions:{schema:'custodial.manager-permissions.v1',read:true,owner,manage_absences:true}};
  const calls=[],auth={readSession:()=>session,requireOpsManagerSession:async opts=>{calls.push(opts);return session;},getCSTDateString:()=> '2026-10-11'};
  return {auth,calls,change:()=>{session={...session,credential_id:id(20),token:'changed-synthetic-session'};},expire:()=>{session={...session,expires_at:'2020-01-01T00:00:00Z'};},readonly:()=>{session={...session,read_only:true,permissions:{...session.permissions,owner:false}};}};
}
class Node {
  constructor(tag='div'){this.tag=tag;this.children=[];this.listeners=new Map();this.hidden=false;this.disabled=false;this.value='';this.textContent='';}
  appendChild(n){this.children.push(n);return n;}replaceChildren(...nodes){this.children=[...nodes];if(this.tag==='select')this.value=nodes[0]?.value||'';}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}async fire(type){for(const fn of this.listeners.get(type)||[])await fn({preventDefault(){}});await new Promise(r=>setImmediate(r));}
}
function pageFixture({owner=true,native=false,api=null,savedRequests=null,savedRequestsFactory=null,readSourceDetails=null,readOriginalOutcome=null}={}){
 const nodes=new Map();for(const [,id]of readFileSync(new URL('./staffing-management.html',import.meta.url),'utf8').matchAll(/id="([^"]+)"/g))nodes.set(id,new Node(['staffing-slot','staffing-kind','staffing-existing-employee'].includes(id)?'select':'div'));
 const f=authFixture(owner),calls=[],w=new Node(),d=new Node();d.getElementById=id=>nodes.get(id);d.createElement=tag=>new Node(tag);
 w.MemphisMobileBuildIdentity=native?{edition:'custodial'}:undefined;const timers=new Map();w.setInterval=fn=>{timers.set(1,fn);return 1;};w.clearInterval=id=>timers.delete(id);
 const request=api||(async(path,opts)=>{calls.push({path,opts});return snapshot();});
 if(savedRequestsFactory)savedRequests=savedRequestsFactory(f.auth,request);
 const page=mountStaffingPage({w,d,auth:f.auth,authority,api:request,savedRequests,readSourceDetails,readOriginalOutcome,now:()=>now,makeKey:()=>id(90)});
 return {nodes,w,d,f,calls,timers,page,text:n=>[n.textContent,...n.children.map(child=>[child.textContent,...child.children.map(x=>x.textContent)].join(' '))].join(' ')};
}
function sourceDetails(s=snapshot()){return {schema:'custodial.roster-source-details.v1',manager_id:managerId,source_id:sourceId,effective_start:'2026-10-11',week_start:'2026-10-05',authority_revision:s.authority_revision,
 current_source_digest:'b'.repeat(64),registered_source_digest:digest,compiler_input:{slots:[{id:slotId,incumbencies:[]}],version:{vacancyCapableSlotIds:[slotId]}},
 registered_compiler_input:{slots:[{id:slotId,incumbencies:[{personId:employeeId,displayName:'Historic person',effectiveStart:'2026-10-11'}]}],version:{vacancyCapableSlotIds:[slotId]}},current_roster:s.roster,publication_id:publication,phone_released:false};}
function owningHelper(auth,api){const values=new Map();return authority.create({auth,api,baseUrl:'https://synthetic.invalid',storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}});}
function outcome(body){const mutation={slot_id:slotId,source_id:sourceId,source_digest:digest,effective_start:body.effective_start,former_employee_id:employeeId,replacement_employee_id:null,history_preserved:true,completion_mode:'projection_required',original_publication_id:publication,employee_status:{separation_id:id(72)}};
 return {schema:'custodial.original-staffing-outcome.v1',state:'ACCEPTED_ORIGINAL',manager_id:managerId,operation:'vacate_roster_slot',idempotency_key:body.idempotency_key,command_id:id(71),
 original_request:{actor_manager_id:managerId,reason:body.reason,slot_id:slotId,operation:'vacate_roster_slot',expected_revision:body.expected_revision,effective_start:body.effective_start,employee_id:body.employee_id,source_id:body.source_id},original_request_digest:digest,retry_safe:false,phone_released:false,
 receipt:{operation:'materialize_projection',revision:14,request_digest:digest,content_digest:digest,output_digest:digest,data:{...mutation,mutation,current_projection:{projection_id:id(73),publication_id:publication,week_start:'2026-10-05'}}}};}
async function settle(){for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));}
async function previewVacancy(f){await f.page.init();f.nodes.get('staffing-slot').value=slotId;await f.nodes.get('staffing-slot').fire('change');f.nodes.get('staffing-kind').value='vacate';f.nodes.get('staffing-reason').value='Manager confirmed vacancy';await f.nodes.get('staffing-form').fire('submit');}
test('READONLY actual page renders roster but creates no staffing listeners or owner-only reads',async()=>{
  // Existing readonly behavior remains separate from main's new pattern entry.
 let sources=0,saved=0,outcomes=0;const f=pageFixture({owner:false,savedRequests:{pending(){saved++;return null;},run(){throw Error('Must not mutate');}},readSourceDetails:()=>{sources++;},readOriginalOutcome:()=>{outcomes++;}});
 try{assert.equal(await f.page.init(),true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].opts.method,'GET');assert.match(f.calls[0].path,/manager-snapshot/);
  assert.equal(sources+saved+outcomes,0);assert.equal(f.nodes.get('staffing-form').hidden,true);assert.equal(f.nodes.get('staffing-action').hidden,true);
  assert.match(f.nodes.get('staffing-status').textContent,/Read-only roster/);assert.match(f.text(f.nodes.get('staffing-roster')),/<script>not executable/);
  for(const id of ['staffing-form','staffing-confirm','staffing-check-outcome','staffing-read-separation','staffing-kind','staffing-new-name'])assert.equal(f.nodes.get(id).listeners.size,0,id);
 }finally{f.page.stop();}assert.equal(f.timers.size,0);
});
test('MAIN_PATTERN current position-pattern review goes to Scheduler without employee reactivation',async()=>{
 const f=pageFixture({owner:false});await f.page.init();
 const target=new URL(f.nodes.get('staffing-pattern-link').href,'https://manager-fixture.invalid');
 assert.equal(target.pathname,'/schedule-weekly.html');assert.equal(target.searchParams.get('date'),'2026-10-11');
 assert.equal(target.searchParams.get('hub'),'manager');assert.equal(f.calls.some(c=>c.path.includes('/employees/restores')),false);
 assert.equal(f.page.view().rows[0].capabilities.restore,false);f.page.stop();
});
test('NATIVE actual page installs zero auth calls, requests, listeners or timers',async()=>{
 const f=pageFixture({native:true});assert.equal(await f.page.init(),false);assert.equal(f.f.calls.length,0);assert.equal(f.calls.length,0);assert.equal(f.timers.size,0);
 assert.ok([...f.nodes.values()].every(n=>n.listeners.size===0));f.page.stop();
});
test('MISSING exact source details disable owner actions without inventing source or employee',async()=>{
 const f=pageFixture({savedRequests:{pending:()=>null,run:()=>{throw Error('Must not write');}}});
 try{await f.page.init();assert.equal(f.page.view().rows[0].capabilities.vacate,false);assert.equal(f.page.view().rows[0].capabilities.restore,false);
  f.nodes.get('staffing-slot').value=slotId;await f.nodes.get('staffing-slot').fire('change');assert.equal(f.nodes.get('staffing-kind').disabled,true);assert.equal(f.nodes.get('staffing-preview-button').disabled,true);assert.match(f.nodes.get('staffing-action-note').textContent,/source details.*unavailable/);
 }finally{f.page.stop();}
});
test('SEPARATION actual page keeps empty/unknown protected-work evidence Pending and denies foreign identity',async()=>{
 let result={slot_id:slotId,state:'NONE'};const f=pageFixture({api:async(path)=>path.includes('/separation')?result:snapshot()});
 try{await f.page.init();f.nodes.get('staffing-slot').value=slotId;await f.nodes.get('staffing-slot').fire('change');await f.nodes.get('staffing-read-separation').fire('click');
  assert.match(f.nodes.get('staffing-separation-text').textContent,/Pending.*No matching separation record/);
  result={slot_id:slotId,employee_id:employeeId,separation_id:id(7),command_id:id(8),authority_revision:13,separated_at:'2026-10-11T17:00:00Z',state:'PENDING_RECONCILIATION',native_inventory_state:'UNKNOWN',assigned_devices_retained:[],database_active_sessions:0,database_activated_offline_contexts:0,phone_released:false};
  await f.nodes.get('staffing-read-separation').fire('click');assert.match(f.nodes.get('staffing-separation-text').textContent,/Pending.*Empty database counts/);
  result={...result,state:'FINALIZED'};await f.nodes.get('staffing-read-separation').fire('click');assert.equal(f.page.view().separation.state,'Pending');
  result={...result,slot_id:id(99),native_inventory_state:'RECONCILED'};await f.nodes.get('staffing-read-separation').fire('click');assert.match(f.nodes.get('staffing-status').textContent,/mismatched.*Pending/);assert.equal(f.page.view().separation.state,'Pending');
 }finally{f.page.stop();}
});
test('SEPARATION_WITHDRAW old Complete is withdrawn immediately on a new mismatched or unavailable read',async()=>{
 let result={slot_id:slotId,employee_id:employeeId,separation_id:id(7),command_id:id(8),authority_revision:13,separated_at:'2026-10-11T17:00:00Z',state:'FINALIZED',native_inventory_state:'RECONCILED',assigned_devices_retained:[],database_active_sessions:0,database_activated_offline_contexts:0,phone_released:false};
 let release;const f=pageFixture({api:async path=>path.includes('/separation')?await new Promise(resolve=>{release=resolve;}):snapshot()});
 try{await f.page.init();f.nodes.get('staffing-slot').value=slotId;
  const first=f.nodes.get('staffing-read-separation').fire('click');release(result);await first;assert.equal(f.page.view().separation.state,'Complete');
  const next=f.nodes.get('staffing-read-separation').fire('click');assert.equal(f.page.view().separation.state,'Pending');assert.match(f.nodes.get('staffing-separation-text').textContent,/Previous readback is not current proof/);
  release({...result,slot_id:id(99)});await next;assert.equal(f.page.view().separation.state,'Pending');assert.doesNotMatch(f.nodes.get('staffing-separation-text').textContent,/Complete:/);
 }finally{f.page.stop();}
});
test('CHANGED_MANAGER actual pending roster read aborts and cannot render another session response',async()=>{
 let release,signal;const f=pageFixture({api:async(path,opts)=>{signal=opts.signal;return await new Promise(resolve=>{release=resolve;});}});
 const init=f.page.init();await new Promise(resolve=>setImmediate(resolve));assert.ok(signal);f.f.change();release(snapshot());assert.equal(await init,false);
 assert.equal(signal.aborted,true);assert.equal(f.page.view().state,'DENIED');assert.equal(f.nodes.get('staffing-roster').children.length,0);assert.equal(f.nodes.get('staffing-form').hidden,true);f.page.stop();
});
test('ORIGINAL_PENDING actual page preserves local encoded identity and refuses an invented server byte echo',async()=>{
 const body={source_id:sourceId,effective_start:'2026-10-11',reason:'Original retained request',expected_revision:12,employee_id:employeeId,idempotency_key:'original-vacancy'};
 const record={schema:'custodial.scheduler-pending.v1',managerId,path:`/static-weekly/roster/${slotId}/vacate`,body,encoded:JSON.stringify(body),state:'PENDING'};
 const original=record.encoded;let sends=0,reads=0;
 const f=pageFixture({savedRequests:{pending:()=>record,run:()=>{sends++;throw Error('No resend');}},readOriginalOutcome:async saved=>{reads++;assert.equal(saved.encoded,original);return {...record,receipt:{operation:'vacate_roster_slot',revision:13,request_digest:digest,content_digest:digest,output_digest:digest,data:{slot_id:slotId,source_id:sourceId,source_digest:digest,effective_start:'2026-10-11',former_employee_id:employeeId,replacement_employee_id:null,history_preserved:true,completion_mode:'mutation_only',original_publication_id:null}}};}});
 try{await f.page.init();assert.equal(f.page.view().state,'OUTCOME_UNKNOWN');assert.equal(f.nodes.get('staffing-confirm').disabled,true);
  await f.nodes.get('staffing-check-outcome').fire('click');assert.equal(reads,1);assert.equal(sends,0);assert.equal(record.encoded,original);assert.equal(f.page.view().state,'OUTCOME_UNKNOWN');
  await f.nodes.get('staffing-refresh').fire('click');assert.equal(record.encoded,original);assert.equal(sends,0);assert.equal(f.page.view().state,'OUTCOME_UNKNOWN');
 }finally{f.page.stop();}
});
test('OWNER_CONFIRM actual page/helper preview, one POST and original GET acceptance keeps separation Pending',async()=>{
 assert.equal(typeof authority.acceptedStaffing,'function','Requires sealed main staffing helper extension');let body,posts=0,gets=0,release;
 const f=pageFixture({savedRequestsFactory:owningHelper,api:async(path,opts)=>{
  if(path.includes('/manager-snapshot'))return snapshot();if(path.includes('/source-details?'))return sourceDetails();
  if(opts.method==='POST'){posts++;body=JSON.parse(opts.body);return await new Promise(resolve=>{release=resolve;});}
  if(path.includes('/staffing/operations/')){gets++;return outcome(body);}throw Error('Unexpected path');}});
 try{await previewVacancy(f);assert.equal(f.page.view().state,'PREVIEW');assert.equal(f.nodes.get('staffing-confirm').disabled,false);
  assert.match(f.nodes.get('staffing-preview-text').textContent,/Existing employee identity:.*98000000/);assert.match(f.nodes.get('staffing-preview-text').textContent,/Current hydrated source digest: b{64}/);
  await f.nodes.get('staffing-confirm').fire('click');await settle();assert.equal(posts,1);await f.nodes.get('staffing-confirm').fire('click');assert.equal(posts,1);
  release({});await settle();assert.equal(gets,1);assert.equal(f.page.view().state,'ACCEPTED');assert.match(f.nodes.get('staffing-status').textContent,/Protected separation is still Pending/);assert.equal(f.nodes.get('staffing-confirm').disabled,true);
 }finally{f.page.stop();}
});
test('OWNER_RECOVERY lost reply checks canonical reordered values once via owning GET, never resends',async()=>{
 let body,posts=0,gets=0,revision=12;const f=pageFixture({savedRequestsFactory:owningHelper,api:async(path,opts)=>{
  if(path.includes('/manager-snapshot'))return {...snapshot(),authority_revision:revision};if(path.includes('/source-details?'))return sourceDetails({...snapshot(),authority_revision:revision});
  if(opts.method==='POST'){posts++;body=JSON.parse(opts.body);throw Error('Synthetic lost commit response');}
  if(path.includes('/staffing/operations/')){gets++;return outcome(body);}throw Error('Unexpected path');}});
 try{await previewVacancy(f);await f.nodes.get('staffing-confirm').fire('click');await settle();assert.equal(f.page.view().state,'OUTCOME_UNKNOWN');assert.equal(posts,1);
  const before=JSON.stringify(f.page.view().preview.body);await f.nodes.get('staffing-reason').fire('input');assert.equal(JSON.stringify(f.page.view().preview.body),before);
  await f.nodes.get('staffing-check-outcome').fire('click');await settle();assert.equal(gets,1);assert.equal(posts,1);assert.equal(f.page.view().state,'ACCEPTED');
  revision=14;await f.nodes.get('staffing-refresh').fire('click');await settle();assert.equal(f.page.view().state,'READY');assert.equal(f.page.view().pending,false);assert.equal(posts,1);
 }finally{f.page.stop();}
});
test('OWNER_FOREIGN_PENDING empty and wrong original request stay unknown without resend or replacement',async()=>{
 let body,posts=0,mode='empty';const f=pageFixture({savedRequestsFactory:owningHelper,api:async(path,opts)=>{
  if(path.includes('/manager-snapshot'))return snapshot();if(path.includes('/source-details?'))return sourceDetails();
  if(opts.method==='POST'){posts++;body=JSON.parse(opts.body);throw Error('Synthetic lost reply');}
  if(path.includes('/staffing/operations/')){if(mode==='empty')return {schema:'custodial.original-staffing-outcome.v1',state:'OUTCOME_UNCONFIRMED'};const r=outcome(body);r.original_request.employee_id=id(88);return r;}throw Error('Unexpected path');}});
 try{await previewVacancy(f);await f.nodes.get('staffing-confirm').fire('click');await settle();const encoded=JSON.stringify(f.page.view().preview.body);
  await f.nodes.get('staffing-check-outcome').fire('click');await settle();assert.equal(f.page.view().state,'OUTCOME_UNKNOWN');mode='foreign';
  await f.nodes.get('staffing-check-outcome').fire('click');await settle();assert.equal(f.page.view().state,'OUTCOME_UNKNOWN');assert.equal(posts,1);assert.equal(JSON.stringify(f.page.view().preview.body),encoded);assert.equal(f.nodes.get('staffing-confirm').disabled,true);
 }finally{f.page.stop();}
});
test('OWNER_SOURCE_GUARD distinct digests admitted, historic restoration and stale/foreign source refused',async()=>{
 let details=sourceDetails(),s=snapshot(),posts=0;const f=pageFixture({savedRequestsFactory:owningHelper,api:async(path,opts)=>{
  if(path.includes('/manager-snapshot'))return s;if(path.includes('/source-details?'))return details;if(opts.method==='POST'){posts++;throw Error('No write allowed');}throw Error('Unexpected path');}});
 try{await previewVacancy(f);assert.equal(f.page.view().preview.can_confirm,true);assert.equal(f.page.view().rows[0].capabilities.restore,false);assert.deepEqual(f.page.view().rows[0].restore_choices,[]);
  details={...details,authority_revision:99};await f.nodes.get('staffing-confirm').fire('click');await settle();assert.equal(posts,0);assert.equal(f.page.view().state,'HELD');
  details={...sourceDetails(),manager_id:id(99)};await f.nodes.get('staffing-refresh').fire('click');await settle();assert.equal(f.page.view().rows[0].capabilities.vacate,false);
 }finally{f.page.stop();}
});
test('EXPIRY_WITHDRAW actual currentness timer removes owner data and aborts callbacks on expired access',async()=>{
 const f=pageFixture({savedRequestsFactory:owningHelper,api:async path=>path.includes('/source-details?')?sourceDetails():snapshot()});
 try{await previewVacancy(f);assert.equal(f.page.view().preview.can_confirm,true);f.f.expire();for(const tick of f.timers.values())tick();
  assert.equal(f.page.view().state,'DENIED');assert.equal(f.nodes.get('staffing-action').hidden,true);assert.equal(f.nodes.get('staffing-preview-text').textContent,'');assert.equal(f.nodes.get('staffing-roster').children.length,0);
  await f.nodes.get('staffing-confirm').fire('click');assert.equal(f.page.view().state,'DENIED');
 }finally{f.page.stop();}
});
test('FILL_CHOICES actual page rejects missing/control names and previews new person without historical restoration',async()=>{
 const s={...snapshot(),week_start:'2026-10-12',week_end:'2026-10-18',roster:[{...snapshot().roster[0],incumbencies:[],week_staffing:[{service_date:'2026-10-12',person_id:null,employee_active:null,availability_state:'vacant_unfilled'}]}]};
 const details={...sourceDetails(s),effective_start:'2026-10-12',week_start:'2026-10-12'};let posts=0;
 const f=pageFixture({savedRequestsFactory:owningHelper,api:async(path,opts)=>{if(opts.method==='POST'){posts++;throw Error('Unexpected write');}
  if(path.includes('/source-details?'))return path.includes('effective_start=2026-10-12')?details:sourceDetails();return path.includes('week_start=2026-10-12')?s:snapshot();}});
 try{await f.page.init();f.nodes.get('staffing-date').value='2026-10-12';await f.nodes.get('staffing-date').fire('change');await settle();
  f.nodes.get('staffing-slot').value=slotId;await f.nodes.get('staffing-slot').fire('change');f.nodes.get('staffing-kind').value='fill';f.nodes.get('staffing-reason').value='Fill the stable vacancy';
  for(const name of ['', 'A','Unsafe\nName']){f.nodes.get('staffing-new-name').value=name;await f.nodes.get('staffing-form').fire('submit');assert.equal(f.page.view().preview,null);assert.match(f.nodes.get('staffing-status').textContent,/required employee name/);}
  f.nodes.get('staffing-new-name').value=' New <script>Employee</script> ';await f.nodes.get('staffing-form').fire('submit');
  assert.equal(f.page.view().preview.kind,'fill');assert.equal(f.page.view().preview.body.new_employee_name,'New <script>Employee</script>');assert.equal(f.page.view().preview.body.employee_id,undefined);
  assert.equal(f.page.view().rows[0].capabilities.restore,false);assert.match(f.nodes.get('staffing-preview-text').textContent,/not restoration/);assert.equal(posts,0);
 }finally{f.page.stop();}
});
test('EXACT_SEPARATION_COMMAND same person/slot foreign command cannot finalize an accepted vacancy',async()=>{
 let body,command=id(99);const f=pageFixture({savedRequestsFactory:owningHelper,api:async(path,opts)=>{
  if(path.includes('/manager-snapshot'))return snapshot();if(path.includes('/source-details?'))return sourceDetails();
  if(opts.method==='POST'){body=JSON.parse(opts.body);return {};}
  if(path.includes('/staffing/operations/'))return outcome(body);
  if(path.endsWith('/separation'))return {slot_id:slotId,employee_id:employeeId,separation_id:id(72),command_id:command,authority_revision:13,separated_at:'2026-10-11T17:00:00Z',state:'FINALIZED',native_inventory_state:'RECONCILED',assigned_devices_retained:[],database_active_sessions:0,database_activated_offline_contexts:0,phone_released:false};throw Error('Unexpected path');}});
 try{await previewVacancy(f);await f.nodes.get('staffing-confirm').fire('click');await settle();assert.equal(f.page.view().state,'ACCEPTED');
  await f.nodes.get('staffing-read-separation').fire('click');assert.equal(f.page.view().separation.state,'Pending');assert.match(f.nodes.get('staffing-status').textContent,/mismatched/);
  command=id(71);await f.nodes.get('staffing-read-separation').fire('click');assert.equal(f.page.view().separation.state,'Complete');assert.match(f.nodes.get('staffing-separation-text').textContent,/No phone release/);
 }finally{f.page.stop();}
});
test('EXPLICIT_REJECTION owning helper denial stays held, not acceptance/unknown/resend',async()=>{
 let posts=0;const f=pageFixture({savedRequestsFactory:owningHelper,api:async(path,opts)=>{
  if(path.includes('/manager-snapshot'))return snapshot();if(path.includes('/source-details?'))return sourceDetails();
  if(opts.method==='POST'){posts++;throw Object.assign(Error('Synthetic stale request'),{status:409,serverRejected:true});}throw Error('No status call for a rejected request');}});
 try{await previewVacancy(f);await f.nodes.get('staffing-confirm').fire('click');await settle();assert.equal(f.page.view().state,'HELD');assert.match(f.nodes.get('staffing-status').textContent,/explicitly rejected/);
  assert.equal(f.nodes.get('staffing-confirm').disabled,true);assert.equal(f.nodes.get('staffing-check-outcome').disabled,true);assert.equal(f.nodes.get('staffing-kind').disabled,true);
  await f.nodes.get('staffing-reason').fire('input');assert.equal(f.page.view().state,'HELD');await f.nodes.get('staffing-confirm').fire('click');assert.equal(posts,1);
 }finally{f.page.stop();}
});
test('CAPABILITY_WITHDRAW owner input callback immediately withdraws after permission ceiling changes',async()=>{
 const f=pageFixture({savedRequestsFactory:owningHelper,api:async path=>path.includes('/source-details?')?sourceDetails():snapshot()});
 try{await previewVacancy(f);f.f.readonly();await f.nodes.get('staffing-reason').fire('input');assert.equal(f.page.view().state,'DENIED');
  assert.equal(f.nodes.get('staffing-form').hidden,true);assert.equal(f.nodes.get('staffing-roster').children.length,0);assert.equal(f.nodes.get('staffing-preview-text').textContent,'');
 }finally{f.page.stop();}
});
test('PUBLICATION_RECEIPT known publication cannot accept a no-publication mutation-only receipt',async()=>{
 let body;const f=pageFixture({savedRequestsFactory:owningHelper,api:async(path,opts)=>{
  if(path.includes('/manager-snapshot'))return snapshot();if(path.includes('/source-details?'))return sourceDetails();if(opts.method==='POST'){body=JSON.parse(opts.body);return {};}
  if(path.includes('/staffing/operations/')){const result=outcome(body);result.receipt.operation='vacate_roster_slot';result.receipt.revision=13;result.receipt.data={...result.receipt.data.mutation,completion_mode:'mutation_only',original_publication_id:null};return result;}throw Error('Unexpected path');}});
 try{await previewVacancy(f);await f.nodes.get('staffing-confirm').fire('click');await settle();assert.equal(f.page.view().state,'OUTCOME_UNKNOWN');assert.equal(f.page.view().pending,true);assert.equal(f.nodes.get('staffing-confirm').disabled,true);
 }finally{f.page.stop();}
});
