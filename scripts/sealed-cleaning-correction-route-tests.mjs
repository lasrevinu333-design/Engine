import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import '../memphis-completion-evidence.js';
const UUID=n=>`98000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
class Element {constructor(tag='div'){this.tagName=tag;this.children=[];this.textContent='';this.innerHTML='';this.value='';this.dataset={};this.listeners=new Map();this.classList={toggle(){},remove(){}};}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;this.textContent='';}addEventListener(k,fn){this.listeners.set(k,fn);}querySelectorAll(tag){return all(this).filter(e=>e.tagName===tag);}setAttribute(){}focus(){}}
const all=node=>[node,...node.children.flatMap(all)];
const nodes=new Map(),element=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
const document={getElementById:element,querySelectorAll:()=>[],createElement:tag=>new Element(tag),addEventListener(){}};
let session={role:'ops_manager',manager_id:UUID(8),credential_id:'SYNTHETIC_REGISTRATION',device_id:'SYNTHETIC_BROWSER',token:'SYNTHETIC_TOKEN',expires_at:'2099-01-01T00:00:00Z',read_only:false,permissions:{owner:true}};
const row={session_id:UUID(1),session_uuid:'opaque original / ? identity',employee_id:UUID(2),location_id:UUID(3),device_id:UUID(4),employee_name:'Original person',location_name:'Primate',started_at:'2026-10-31T13:00:00Z',ended_at:'2026-10-31T13:15:00Z'};
let truth={session_id:row.session_id,session_uuid:row.session_uuid,status:'completed',correction_id:null,original_employee_id:UUID(2),current_employee_id:UUID(2),original_employee_name:'Original person',current_employee_name:'Original person',original_location_id:UUID(3),current_location_id:UUID(3),original_location_name:'Primate',current_location_name:'Primate',original_device_id:UUID(4),current_device_id:UUID(4),original_device_name:'Assigned phone',current_device_name:'Assigned phone',original_started_at:row.started_at,current_started_at:row.started_at,original_ended_at:row.ended_at,current_ended_at:row.ended_at};
const choices={employees:[{id:UUID(2),label:'Original person'},{id:UUID(5),label:'Corrected person'}],locations:[{id:UUID(3),label:'Primate'}],devices:[{id:UUID(4),label:'Assigned phone'}]};
const calls=[],listeners=new Map();let receipt;
const window={location:{hash:'#panel-cleanings'},addEventListener:(event,fn)=>listeners.set(event,fn),MemphisCompletionEvidence:globalThis.MemphisCompletionEvidence,MemphisAuth:{readSession:()=>session,requireOpsManagerSession:async()=>session,isOpsManager:s=>s===session,getDeviceId:()=>session.device_id,canMutateOpsManagerSurface:()=>true,opsManagerAuthHeaders:async()=>({Authorization:'Bearer '+session.token,'X-Device-Id':session.device_id,'X-CSRF-Token':'SYNTHETIC_CSRF'})}};
const fetch=async(raw,options)=>{calls.push({raw,options});const path=new URL(raw).pathname;let data,contract='operational-analytics.v1';
 if(path.startsWith('/analytics-api/'))data=path.endsWith('/session-facts')?[row]:path.endsWith('/inspection-coverage')?null:[];
 else if(path==='/admin-api/custodial/cleaning-correction-choices'){data=choices;contract='cleaning-correction-choices.v1';}
 else if(path.endsWith('/truth')){data=structuredClone(truth);contract='cleaning-truth.v1';}
 else if(options.method==='POST'&&path.endsWith('/corrections')){const body=JSON.parse(options.body);receipt={correction_id:UUID(11),session_id:UUID(1),operation_id:options.headers['Idempotency-Key'],changed_fields:['employee'],created_at:'2026-10-31T19:00:00Z',replayed:false};truth={...truth,correction_id:receipt.correction_id,current_employee_id:body.corrected_employee_id,current_employee_name:'Corrected person',corrected_by_manager_name_snapshot:'Synthetic self-asserted manager',corrected_at:receipt.created_at,correction_reason:body.reason};data=receipt;contract='cleaning-truth.v1';}
 else if(path.endsWith('/corrections/'+receipt?.operation_id)){data={found:true,...receipt,replayed:true,actor_manager_id:UUID(8),actor_name:'Synthetic manager (shared PIN; self-asserted)',reason:'Verified attribution correction'};contract='cleaning-truth.v1';}
 else throw new Error('Unexpected route '+path);
 return{ok:true,status:200,json:async()=>({ok:true,contract_version:contract,data})};};
vm.runInNewContext(readFileSync(new URL('../operational-insights.js',import.meta.url),'utf8'),{window,document,fetch,URL,Date,console,AbortController,setTimeout,clearTimeout},{filename:fileURLToPath(new URL('../operational-insights.js',import.meta.url)),importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER});
const settle=()=>new Promise(r=>setImmediate(r));await settle();
assert.match(element('cleanings-list').innerHTML,/data-cleaning-correction/);
const card={dataset:{sessionId:row.session_id}},button={dataset:{sessionUuid:row.session_uuid},closest:selector=>selector==='[data-session-id]'?card:null};
element('cleanings-list').listeners.get('click')({target:{closest:selector=>selector==='[data-cleaning-correction]'?button:null}});
await settle();await settle();const content=element('cleaning-correction-content');
const field=name=>all(content).find(e=>e.name===name),click=label=>{const b=all(content).find(e=>e.tagName==='button'&&e.textContent===label);assert.ok(b,'button '+label);b.listeners.get('click')();};
assert.ok(field('reason'));field('employee_id').value=UUID(5);field('reason').value='Verified attribution correction';click('Preview correction');await settle();assert.equal(element('cleaning-correction-status').dataset.state,'preview');
assert.equal(calls.filter(c=>c.options.method==='POST').length,0);click('Confirm this correction once');await settle();await settle();
assert.equal(element('cleaning-correction-status').dataset.state,'saved');const mutations=calls.filter(c=>c.options.method==='POST');assert.equal(mutations.length,1);const mutation=mutations[0];assert.equal(new URL(mutation.raw).pathname,`/admin-api/custodial/cleaning-sessions/${UUID(1)}/corrections`);assert.equal(mutation.options.headers['X-CSRF-Token'],'SYNTHETIC_CSRF');assert.equal(mutation.options.headers.Authorization,'Bearer SYNTHETIC_TOKEN');assert.equal(mutation.options.headers['X-Device-Id'],'SYNTHETIC_BROWSER');assert.match(mutation.options.headers['Idempotency-Key'],/^[0-9a-f-]{36}$/);
assert.deepEqual(JSON.parse(mutation.options.body),{reason:'Verified attribution correction',expected_correction_id:null,expected_session_uuid:row.session_uuid,corrected_employee_id:UUID(5)});
assert.ok(calls.some(c=>c.options.method==='GET'&&new URL(c.raw).pathname===`/admin-api/custodial/cleaning-sessions/${UUID(1)}/corrections/${receipt.operation_id}`));assert.equal(truth.original_employee_name,'Original person');
listeners.get('pagehide')();console.log(JSON.stringify({suite:'actual insights click → dynamically imported completed-record panel → exact mocked routes → saved original operation',passed:1,failed:0,privateRequests:calls.filter(c=>c.raw.includes('/admin-api/')).map(c=>({path:new URL(c.raw).pathname,method:c.options.method})),noNetwork:true,noSQL:true,noBuild:true,independentAcceptance:false}));
