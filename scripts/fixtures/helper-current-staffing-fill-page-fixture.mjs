// Exact fixtures extracted from the supplied manager-staffing-tests.mjs.
// Product page/actions/helper code is loaded unchanged; zero test registration.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {mountStaffingPage} from '../../manager-staffing-page.mjs';
const sourceFixtureUrl=new URL('../../manager-staffing-tests.mjs',import.meta.url);
const helperBytes=readFileSync(new URL('./memphis-scheduler-actions.js',sourceFixtureUrl),'utf8');
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
 const nodes=new Map();for(const [,id]of readFileSync(new URL('./staffing-management.html',sourceFixtureUrl),'utf8').matchAll(/id="([^"]+)"/g))nodes.set(id,new Node(['staffing-slot','staffing-kind','staffing-existing-employee'].includes(id)?'select':'div'));
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
export {authority,id,now,sourceId,slotId,employeeId,managerId,publication,digest,snapshot,authFixture,Node,pageFixture,sourceDetails,owningHelper,outcome,settle};
