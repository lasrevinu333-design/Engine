// Extracted exact existing fixture declarations; no product implementation is duplicated.
// Origin scripts/manager-scheduler-client-tests.mjs; declaration hashes are in
// helper-source-fixtures-phase2 evidence. Only URL rebasing and returning the
// already-created print VM context are fixture adaptations. No tests skipped:
// this module contains fixture declarations only and registers zero test cases.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {createHash,webcrypto} from 'node:crypto';
const sourceFixtureUrl=new URL('../manager-scheduler-client-tests.mjs',import.meta.url);
const require=createRequire(sourceFixtureUrl),A=require('../memphis-scheduler-actions.js'),P=require('../memphis-approved-schedule.js');
const MID='11000000-0000-4000-8000-000000000001',CID='12000000-0000-4000-8000-000000000001',PID='13000000-0000-4000-8000-000000000001',SOURCE='14000000-0000-4000-8000-000000000001';

function fixture(){const map=new Map(),calls=[];let account={role:'ops_manager',manager_id:MID,credential_id:CID,device_id:'fixture-browser',token:'fixture-only',expires_at:new Date(Date.now()+3600000).toISOString(),read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,manage_absences:true,manage_coverall:true,regenerate_routes:true,close_scan_tickets:true}},mode='accept',pending=null;
const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},auth={readSession:()=>account};
const reply={revision:43,data:{current_projection:{projection_id:PID,publication_id:SOURCE,week_start:'2026-10-05'}}};
const api=async(path,options)=>{calls.push({path,options});if(pending)await pending;if(mode==='offline')throw Error('network unavailable');if(mode==='reject')throw Object.assign(Error('stale revision'),{status:409,serverRejected:true,code:'40001'});return structuredClone(reply);};
const create=()=>A.create({auth,api,storage,baseUrl:'https://scheduler.onrender.com'});return{map,calls,auth,storage,reply,api,create,setMode:m=>mode=m,setPending:p=>pending=p,patch:p=>account={...account,...p}};}

const body={service_date:'2026-10-06',week_start:'2026-10-05',publication_id:SOURCE,expected_revision:42,idempotency_key:'stable-fixture',operations:[{operation:'exception',exception_type:'daily_absence',payload:{slotId:MID},reason:'fixture'}]};

const path='/static-weekly/day-changes/batch',snapshot={week_start:'2026-10-05',projection_status:'current',authority_revision:43,current_publication:{publication_id:SOURCE},latest_projection:{projection_id:PID}};

function cancellationFixture(){
 const f=pageFixture(),original='81000000-0000-4000-8000-000000000001',occupant='82000000-0000-4000-8000-000000000001',
  target='83000000-0000-4000-8000-000000000001',acceptedOperation='84000000-0000-4000-8000-000000000001',operation='85000000-0000-4000-8000-000000000001';
 const weeks=['2026-10-12','2026-10-19'],pubs=[SOURCE,'86000000-0000-4000-8000-000000000001'],versions=['87000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001'],projections=[PID,'89000000-0000-4000-8000-000000000001'];
 const dates=['2026-10-14','2026-10-19'],requests=[];let phase='PREPARING',confirmationCalls=0,today='2026-10-14',block=null,failConfirm=false,readPatch=null,missingBasis=false,wrongReadback=false;
 const row={id:target+':2026-10-13',type:'pto',serviceDate:'2026-10-13',status:'accepted',actorId:SOURCE,payload:{slotId:CID},staffingAbsenceId:target,
  staffingEmployeeId:original,staffingStartDate:'2026-10-09',staffingEndDate:'2026-10-20',staffingAcceptedOperationId:acceptedOperation};
 const snapshots=weeks.map((week,index)=>({week_start:week,week_end:index?'2026-10-25':'2026-10-18',authority_revision:7,current_service_date:today,projection_status:'current',
  current_publication:{publication_id:pubs[index],version_id:versions[index]},latest_projection:{projection_id:projections[index],replay_digest:(index?'f':'e').repeat(64)},
  roster:[{slot_id:CID,slot_label:'Currently effective position',incumbencies:[{person_id:occupant,person_name:'CURRENT occupant, not original target',effective_start:'2026-10-01'}]}],
  exceptions:[row],availability:[],sources:[],drafts:[]}));
 const bindingWeeks=weeks.map((week,index)=>({weekStart:week,publicationId:pubs[index],versionId:versions[index],authorityRevision:7}));
 const previewWeeks=weeks.map((week,index)=>({week_start:week,publicationId:pubs[index],versionId:versions[index],
  database_projection_identity:String(index+1).repeat(64),replayDigest:(index?'f':'e').repeat(64),compilerVersion:'SYNTHETIC_DTO_NOT_COMPILER_OUTPUT',
  sourceDigest:'a'.repeat(64),sourceDigestBasis:'envelope.authority.inputDigest',geographyDigest:'b'.repeat(64),
  assignments:[{plan_work_id:'fixture-duty-'+index,service_date:dates[index],status:'assigned',owner_slot_id:CID,owner_person_id:occupant,
   work_snapshot:{window:{start:'07:00',end:'09:45'},locationNameSnapshot:'CURRENT accepted plan week '+week,schedulingMode:'flexible_coverage_ownership',serviceEffortMinutes:1}}],
  projectionAvailability:[{dayOfWeek:index?1:3,serviceDate:dates[index],slotId:CID,status:'working',incumbentPersonId:occupant,incumbentName:'DATED current person '+index,
   shift:{start:'07:00',end:'16:00'},lunch:{start:'12:00',end:'13:00'},blockedWindows:[],productiveCapacityProvenanceDigest:'c'.repeat(64)}],
  lunch_loans:[],lunch_responsibilities:[],objective:null,metrics:null}));
 const prepared={operation_id:operation,state:'PREPARED',expected_revision:7,prepared_by_manager_id:MID,current_service_date:today,
  semantic_body:{absenceKind:null,commandKind:'cancel_absence',employeeId:original,startDate:'2026-10-14',endDate:'2026-10-20',targetAbsenceId:target},
  semantic_digest:'a'.repeat(64),preview_digest:'b'.repeat(64),input_digest:'c'.repeat(64),candidate_set_digest:'d'.repeat(64),
  publication_vector:{expectedRevision:7,weeks:bindingWeeks},preview:{schema:'memphis-zoo.staffing-command-preview.v1',weeks:previewWeeks}};
 const accepted={...prepared,state:'ACCEPTED',preview:null,accepted_revision:8,accepted_receipt:{event:'ACCEPTED',operation_id:operation,manager_id:MID,
  semantic_digest:prepared.semantic_digest,preview_digest:prepared.preview_digest,candidate_set_digest:prepared.candidate_set_digest,authority_revision:8,
  projections:Object.fromEntries(weeks.map((week,index)=>[week,{projection_id:projections[index],publication_id:pubs[index],projection_identity:previewWeeks[index].database_projection_identity,lunch_document_identity:(index?'4':'3').repeat(64)}]))}};
 const api=async(path,options={})=>{requests.push({path,options});if(block)await block;
  if(path.startsWith('/static-weekly/manager-snapshot?')){
   const week=new URL(path,'https://fixture.invalid').searchParams.get('week_start'),index=weeks.indexOf(week);assert.ok(index>=0);
   const value=structuredClone(snapshots[index]);value.current_service_date=today;
   if(missingBasis&&index===1)value.current_publication=null;
   if(phase==='ACCEPTED'){value.authority_revision=8;if(wrongReadback&&index===1)value.latest_projection.projection_id=SOURCE;}
   return value;
  }
  if(path==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[]};
  if(path===A.staffingCommandPath){const body=JSON.parse(options.body);assert.equal(body.command_kind,'cancel_absence');assert.equal(body.employee_id,original);assert.equal(body.target_absence_id,target);
   assert.equal(body.start_date,'2026-10-14');assert.equal(body.end_date,'2026-10-20');return{operation_id:operation,expected_revision:7,semantic_digest:prepared.semantic_digest};}
  if(path.endsWith('/prepare')){phase='PREPARED';return{state:'PREPARED',operation_id:operation};}
  if(path.endsWith('/confirm')){confirmationCalls++;assert.equal(actions.pending().command.confirmationAttempted,true);assert.equal(actions.pending().command.confirmationKey,CID);
   assert.deepEqual(JSON.parse(options.body),{preview_digest:prepared.preview_digest,confirmation_key:CID});phase='ACCEPTED';if(failConfirm)throw Error('Unknown confirmation response');return structuredClone(accepted.accepted_receipt);}
  if(path===A.staffingCommandPath+'/'+operation){const value=phase==='ACCEPTED'?structuredClone(accepted):{...structuredClone(prepared),state:phase,preview:phase==='PREPARING'?null:structuredClone(prepared.preview)};
   value.current_service_date=today;if(readPatch)readPatch(value);return value;}
  if(path==='/static-weekly/day-changes/batch'){phase='ACCEPTED';return{revision:8,data:{current_projection:{projection_id:PID,publication_id:pubs[0],week_start:weeks[0]}}};}
  throw Error('Unexpected cancellation fixture route '+path);
 };
 const attach=()=>A.create({auth:f.auth,api,storage:f.storage,baseUrl:'https://scheduler.onrender.com',nonce:()=>CID,onState:value=>f.page.state.pending=value});
 const actions=attach();f.page.state.actions=actions;f.page.state.snapshot=structuredClone(snapshots[0]);f.page.state.principal=A.principal(f.auth);
 f.page.els.week_start.value=weeks[0];f.page.els.service_date.value=row.serviceDate;f.context.api=api;f.context.crypto={randomUUID:()=>CID};f.auth.getCSTDateString=()=> '1999-01-01';
 const button={dataset:{reverseException:row.id}},event={target:{closest:()=>button}};
 return{...f,row,original,occupant,target,operation,prepared,accepted,requests,actions,snapshots,button,event,attach,
  confirmationCount:()=>confirmationCalls,setToday:value=>today=value,setBlocked:value=>block=value,setMissingBasis:()=>missingBasis=true,
  setWrongReadback:()=>wrongReadback=true,setFailConfirm:()=>failConfirm=true,patchRead:fn=>readPatch=fn};
}

function privatePreviewFixture(){
 const dir=process.env.TASK8_CURRENT_JOIN_CAPTURE_DIR??fileURLToPath(new URL('../test-fixtures/ci/task8-current-join',sourceFixtureUrl));if(!dir)throw Error('Exact current captured input directory is required for this new member.');
 const read=(name,sha)=>{const bytes=fs.readFileSync(dir+'/'+name);assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);return JSON.parse(bytes);};
 const record=read('task8-compiler-04-result.json','5cafeac4df36001827bc668d1e7a23eee1779b8f77a0dcf9778829cf14ce1dbc');
 const prepared=read('task8-join-prepared.json','f07ac563074274ba2a87d2f67acd15c65c7315f3788f2ae361a4ef5150b1b062');
 const raw=record.result,a=raw.envelope.authority,vector=prepared.publication_vector.weeks[0];
 const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'); // synthetic DTO hash only, NOT claimed SQL JSONb proof
 const availability=a.projectionAvailability.map(row=>{
  const result={};for(const key of ['dayOfWeek','serviceDate','slotId','status','shift','lunch','blockedWindows','productiveWindows',
   'incumbentSlotId','incumbentSlotLabel','incumbentPersonId','incumbentName','ownerKind','capacityId','productiveCapacityMinutes','maxServiceEffortMinutes',
   'acceptedRouteAnchorLocationId','acceptedRouteStartLocationId','routeAnchorLocationId'])result[key]=structuredClone(row[key]??null);
  for(const key of ['productiveCapacityProvenance','capacityProvenance','acceptedRouteProvenance'])result[key+'Digest']=row[key]==null?null:digest(row[key]);
  return result;
 });
 const enriched={...prepared,preview:{...prepared.preview,weeks:[{...prepared.preview.weeks[0],publicationId:raw.publicationId,versionId:vector.versionId,
  database_projection_identity:raw.envelope.database_projection_identity,replayDigest:raw.replayDigest,compilerVersion:raw.compilerVersion,
  sourceDigest:a.inputDigest,sourceDigestBasis:'envelope.authority.inputDigest',geographyDigest:digest(a.compilerInput.proximity),geographyDigestBasis:'envelope.authority.compilerInput.proximity',
  projectionAvailability:availability,projectionAvailabilityDigest:digest(a.projectionAvailability),projectionAvailabilityBasis:'envelope.authority.projectionAvailability',
  objective:{mode:raw.objective.mode,policyVersion:raw.objective.policyVersion,rankingOrder:raw.objective.rankingOrder},metrics:raw.metrics}]}};
 const f=pageFixture();f.patch({manager_id:prepared.prepared_by_manager_id});
 const body={command_kind:'absence',employee_id:prepared.semantic_body.employeeId,start_date:prepared.semantic_body.startDate,end_date:prepared.semantic_body.endDate,
  absence_kind:prepared.semantic_body.absenceKind,client_prepare_key:'98000000-0000-4000-8000-000000000083',expected_revision:prepared.expected_revision};
 const binding={weekStart:vector.weekStart,publicationId:vector.publicationId,versionId:vector.versionId};
 let phase='PREPARING',confirmCalls=0,failConfirm=false,readPatch=null,awaitRead=null,deny=false;const requests=[];
 const accepted={...prepared,state:'ACCEPTED',preview:null,accepted_revision:prepared.expected_revision+1,accepted_receipt:{
  event:'ACCEPTED',operation_id:prepared.operation_id,manager_id:prepared.prepared_by_manager_id,semantic_digest:prepared.semantic_digest,
  preview_digest:prepared.preview_digest,candidate_set_digest:prepared.candidate_set_digest,authority_revision:prepared.expected_revision+1,
  projections:{[vector.weekStart]:{projection_id:PID,publication_id:vector.publicationId,projection_identity:raw.envelope.database_projection_identity,lunch_document_identity:raw.lunchDocument.document_identity}}}};
 const api=async(path,options={})=>{requests.push({path,options});if(deny)throw Object.assign(Error('denied'),{status:403,serverRejected:true});
  if(path===A.staffingCommandPath){assert.equal(f.map.size,1,'original prepare bytes are saved before dispatch');return{operation_id:prepared.operation_id,semantic_digest:prepared.semantic_digest,expected_revision:prepared.expected_revision,state:phase};}
  if(path.endsWith('/prepare')){phase='PREPARED';return{operation_id:prepared.operation_id,state:phase};}
  if(path.endsWith('/confirm')){confirmCalls++;const saved=actions.pending();assert.equal(saved.command.confirmationAttempted,true);assert.equal(saved.command.confirmationKey,CID);
   assert.deepEqual(JSON.parse(options.body),{preview_digest:prepared.preview_digest,confirmation_key:CID});phase='ACCEPTED';if(failConfirm)throw Error('lost confirmation response');return structuredClone(accepted.accepted_receipt);}
  if(path===A.staffingCommandPath+'/'+prepared.operation_id){if(awaitRead)await awaitRead;const value=phase==='ACCEPTED'?structuredClone(accepted):phase==='PREPARING'?{...prepared,state:'PREPARING',preview:null}:structuredClone(enriched);if(readPatch)readPatch(value);return value;}
  if(path.startsWith('/static-weekly/manager-snapshot?'))return structuredClone(phase==='ACCEPTED'?current:before);
  if(path==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[]};
  throw Error('Unexpected new staffing route '+path);
 };
 const before={week_start:vector.weekStart,week_end:'2026-10-18',current_service_date:prepared.current_service_date,authority_revision:prepared.expected_revision,projection_status:'current',
  current_publication:{publication_id:vector.publicationId,version_id:vector.versionId},latest_projection:{projection_id:SOURCE},
  roster:record.input.slots.map(slot=>({slot_id:slot.id,slot_label:slot.label,contractor_capacity:slot.kind==='CONTRACTOR_CAPACITY',
   incumbencies:(slot.incumbencies||[]).map(person=>({person_id:person.personId,person_name:person.displayName,effective_start:person.effectiveStart,effective_end:person.effectiveEnd}))})),
  availability:record.input.versions[0].slotAvailability.map(row=>({slot_id:row.slotId,day_of_week:row.dayOfWeek,service_date:vector.weekStart,availability_state:row.status})),sources:[],drafts:[],exceptions:[]};
 const current={...before,authority_revision:prepared.expected_revision+1,latest_projection:{projection_id:PID,replay_digest:raw.replayDigest}};
 const actions=A.create({auth:f.auth,api,storage:f.storage,baseUrl:'https://scheduler.onrender.com',nonce:()=>CID,onState:value=>{f.page.state.pending=value;}});
 f.page.state.actions=actions;f.page.state.snapshot=structuredClone(before);f.page.state.principal=A.principal(f.auth);f.page.els.week_start.value=vector.weekStart;f.page.els.service_date.value=body.start_date;
 f.context.api=api;f.page.state.baseUrl='https://scheduler.onrender.com';
 return{...f,body,binding,record,enriched,actions,requests,current,before,accepted,confirmCount:()=>confirmCalls,
  failConfirm:()=>failConfirm=true,patchRead:fn=>readPatch=fn,awaitRead:value=>awaitRead=value,deny:()=>deny=true};
}

const initial={source_id:SOURCE,template_id:'approved-six',effective_start:'2026-10-05',expected_revision:42};

const preview={schema:'custodial.approved-static-initial-preview.v1',status:'PREVIEW_ONLY',published:false,solverInvoked:false,sourceId:SOURCE,templateId:'approved-six',serviceDate:'2026-10-05',authorityRevision:42,previewDigest:'a'.repeat(64),mapping:{},lunch:{loans:[],responsibilities:[]},assignments:[{planWorkId:'fixture-work',serviceDate:'2026-10-06',status:'ASSIGNED',personId:MID,slotId:CID,window:{start:'07:00',end:'08:00'}}],constraintView:{schema:'custodial.approved-static-constraint-view.v1',contract:'FIXED_APPROVED_PATTERN_COMPLETE_HARD_CONSTRAINTS_NOT_OPTIMALITY',hardConstraintDigest:'d'.repeat(64),physicalCoverageDigest:'e'.repeat(64),mappingDigest:'f'.repeat(64),hardConstraintCount:1,slotAvailability:[{slot_id:CID,day_of_week:1}],projectionAvailability:[{serviceDate:'2026-10-05',slotId:CID,incumbentPersonId:MID,incumbentName:'Current worker',status:'working'}],balance:{optimized:false},opening:{proven:false}}};

function pageFixture(){
 let rootNode;
 const nodes=new Map(),node=()=>({set id(value){this._id=value;nodes.set(value,this);},get id(){return this._id;},get ownerDocument(){return document;},get parentNode(){return rootNode;},value:'',hidden:false,textContent:'',children:[],attributes:new Map(),listeners:new Map(),focus(){},scrollIntoView(){},append(...items){this.children.push(...items);},insertBefore(item,before){const index=this.children.indexOf(before);if(index<0)this.children.push(item);else this.children.splice(index,0,item);},replaceChildren(...items){this.children=items;},setAttribute(key,value){this.attributes.set(key,String(value));},add(x){this.children.push(x);},get options(){return this.children;},set selectedIndex(i){this.value=this.children[i]?.value||'';},addEventListener(type,fn){this.listeners.set(type,fn);}});
 const document={getElementById:id=>{if(!id||id==='staffing-confirm-btn'&&!nodes.has(id))return null;if(!nodes.has(id)){const item=node();item.id=id;rootNode.append(item);}return nodes.get(id);},createElement:node,createTextNode:text=>({textContent:text}),querySelectorAll:()=>[],querySelector:id=>id==='#manual-activation-panel [role=status]'?nodes.get('manual-activation-panel')?.children.find(item=>item.attributes?.get('role')==='status'):document.getElementById(id)};
 rootNode=node();
 const f=fixture();f.patch({read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}});
 f.auth.getCSTDateString=()=> '2026-10-05';f.auth.requireOpsManagerSession=async()=>{};
 const context=vm.createContext({document,window:{MemphisSchedulerActions:{...A,create:o=>A.create({...o,storage:f.storage})},MemphisApprovedSchedule:{...P,create:o=>P.create({...o,storage:f.storage,nonce:()=>CID}),mountManualActivation:o=>P.mountManualActivation({...o,storage:f.storage,nonce:()=>CID})},MemphisAuth:f.auth,addEventListener(){}},location:{search:'',hash:''},Option:class{constructor(text,value){this.textContent=text;this.value=value;}},crypto:webcrypto,AbortSignal,TextEncoder,setInterval:()=>1,clearInterval(){},URL,URLSearchParams,Date,Set,Map,console});
 const source=fs.readFileSync(new URL('../schedule-weekly.js',sourceFixtureUrl),'utf8');
 const startup="init().catch((error)=>setStatus(`Scheduler unavailable: ${safe(error)}`,'error'));";
 assert.equal(source.split(startup).length,2);vm.runInContext(source.replace(startup,''),context);
 vm.runInContext('globalThis.page={state,els,renderChanges,renderApprovedPreview,renderApprovedCapacity,publishDraft,generateDraft,applyDayChanges,rebuildCurrentProjection,reverseChange,refreshSnapshot,api,init,mondayOf,setControls,confirmStaffingPreview,resumeStaffingPreview,displayStaffingPreview,vacancyEls,openTurnoverDialog,openVacancyDialog,loadVacancySource,submitVacancy,renderVacancyPreview,renderRoster};',context);
 return{...f,context,nodes,page:context.page};
}

function datedPreviewFixture(){
 const f=pageFixture();f.page.els.week_start.value='2026-10-05';f.page.els.service_date.value='2026-10-05';
 f.page.state.snapshot={week_start:'2026-10-05',week_end:'2026-10-11',authority_revision:42,current_publication:{publication_id:SOURCE},roster:[{slot_id:CID,incumbencies:[{effective_start:'2026-10-05',person_id:MID,person_name:'Current worker'}]}],availability:[{slot_id:CID,day_of_week:1,availability_state:'working',shift_start:'07:00',shift_end:'16:00'}],exceptions:[]};
 f.page.state.approvedChoices={initial:[{source_id:SOURCE,template_id:'approved-six',effective_start:'2026-10-05',staffing_count:6}]};
 const value={...preview,schema:'custodial.approved-static-preview.v1',sourcePublicationId:SOURCE,constraintView:{schema:'custodial.approved-static-constraint-view.v1',contract:'FIXED_APPROVED_PATTERN_COMPLETE_HARD_CONSTRAINTS_NOT_OPTIMALITY',hardConstraintDigest:'d'.repeat(64),physicalCoverageDigest:'e'.repeat(64),mappingDigest:'f'.repeat(64),hardConstraintCount:1,slotAvailability:[{slot_id:CID,day_of_week:1}],projectionAvailability:[{serviceDate:'2026-10-05',slotId:CID,incumbentPersonId:MID,incumbentName:'Current worker',status:'working'}],balance:{optimized:false},opening:{proven:false}}};
 f.context.reply=value;return{...f,value};
}

function datedDialogFixture(){
 const f=datedPreviewFixture(),callout={dataset:{calloutSlot:CID}},clock={value:'08:00'},end={value:'13:00'},breakChoice={value:'NONE'};
 const row={querySelector:selector=>({'[data-shift-start]':clock,'[data-shift-end]':end,'[data-break-choice]':breakChoice})[selector]};
 const contractor={dataset:{contractorSlot:SOURCE},closest:()=>row};let selected=[callout],contractors=[];
 f.context.document.querySelectorAll=selector=>selector==='[data-callout-slot]:checked:not(:disabled)'?selected:selector==='[data-contractor-slot]:checked:not(:disabled)'?contractors:[];
 f.page.els.absence_type.value='daily_absence';f.page.state.snapshot.current_publication.version_id=PID;
 f.page.state.actions=A.create({auth:f.auth,storage:f.storage,api:f.api,baseUrl:'https://scheduler.onrender.com',onState:r=>{f.page.state.pending=r;}});
 vm.runInContext('refreshSnapshot=async()=>{};',f.context);
 return{...f,clock,selectCallouts:x=>selected=x,selectContractors:()=>{selected=[];contractors=[contractor];}};
}

function staffingFixture(){const f=fixture();f.patch({read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}});
 const route='/static-weekly/roster/'+CID+'/vacate',request={source_id:SOURCE,employee_id:MID,effective_start:'2026-10-06',reason:'Current position vacancy',expected_revision:42,idempotency_key:'original-vacancy'};
 const record={path:route,body:request,managerId:MID};
 const outcome={schema:'custodial.original-staffing-outcome.v1',state:'ACCEPTED_ORIGINAL',manager_id:MID,operation:'vacate_roster_slot',
  idempotency_key:request.idempotency_key,command_id:PID,original_request:A.staffingRequest(record),original_request_digest:'a'.repeat(64),
  receipt:{revision:43,data:{completion_mode:'mutation_only',original_publication_id:null}},retry_safe:false,phone_released:false};
 return{...f,route,request,outcome};}

async function vacancyProductFixture(){
 const f=staffingFixture(),hash=text=>createHash('sha256').update(text).digest('hex'),H=n=>n.repeat(64);
 const binding={managerId:MID,slotId:CID,publicationId:SOURCE,currentSourceDigest:H('c'),registeredSourceDigest:H('d')};
 const preview={schema:'custodial.stable-vacancy-preview.v1',managerId:MID,sourceId:SOURCE,slotId:CID,employeeId:MID,
  effectiveStart:f.request.effective_start,weekStart:'2026-10-05',expectedRevision:42,projectionExpectedRevision:43,resultingRevision:44,
  idempotencyKey:f.request.idempotency_key,projectionIdempotencyKey:'projection-'+hash(f.request.idempotency_key),reasonDigest:hash(f.request.reason),
  currentSourceDigest:H('c'),registeredSourceDigest:H('d'),publicationId:SOURCE,previewDigest:H('a'),workerCandidateDigest:H('e'),accepted:false,persisted:false,phoneUpdated:false,
  preview_retained:true,published:false,
  preview:{weekStart:'2026-10-05',weekEnd:'2026-10-11',compilerVersion:'SYNTHETIC_PUBLIC_DTO_NOT_SOLVER_OUTPUT',exceptionSetDigest:H('f'),databaseProjectionIdentity:H('9'),
   sourceDigest:H('8'),sourceDigestBasis:'envelope.authority.inputDigest',replayDigest:H('b'),authorityDigest:H('7'),objective:{mode:'SOURCE_PLANNED'},metrics:{},
   assignments:[{planWorkId:'affected-work',workId:'work',dayOfWeek:2,serviceDate:'2026-10-06',status:'open',ownerSlotId:null,ownerPersonId:null,
    workSnapshot:{workId:'work',locationNameSnapshot:'Actual affected duty <not HTML>',window:{start:'07:00',end:'09:45'}}}],
   projectionAvailability:[{dayOfWeek:2,serviceDate:'2026-10-06',slotId:CID,status:'vacant_unfilled',incumbentPersonId:null,shift:{start:'07:00',end:'16:00'},lunch:{start:'12:00',end:'12:30'}},
    {dayOfWeek:3,serviceDate:'2026-10-07',slotId:PID,status:'working',incumbentPersonId:SOURCE,incumbentName:'Wednesday person',shift:{start:'08:00',end:'13:00'},lunch:{start:'12:00',end:'12:30'},productiveCapacityMinutes:270}],
   lunchDocument:{documentIdentity:H('6'),weekStart:'2026-10-05',baseAuthorityDigest:H('7'),baseReplayDigest:H('b'),sourceInputDigest:H('8'),candidateDigest:H('5'),loans:[],responsibilities:[]}}};
 const outcome=structuredClone(f.outcome);outcome.receipt={revision:44,data:{completion_mode:'projection_required',original_publication_id:SOURCE,
  worker_candidate_digest:preview.workerCandidateDigest,persisted_projection_digest:H('4'),paired_lunch_document_identity:H('6'),projection_authority_digest:H('7'),
  current_projection:{projection_id:PID,publication_id:SOURCE,week_start:'2026-10-05',replay_digest:H('b')}}};
 const current={week_start:'2026-10-05',week_end:'2026-10-11',authority_revision:44,projection_status:'current',current_publication:{publication_id:SOURCE},
  latest_projection:{projection_id:PID,replay_digest:H('b')},roster:[{slot_id:CID,week_staffing:[{service_date:'2026-10-06',person_id:null,availability_state:'vacant_unfilled'}]}]};
 return{...f,binding,preview,outcome,current,hash};
}

async function vacancyPageFixture(){
 const data=await vacancyProductFixture(),f=datedPreviewFixture();f.page.state.principal=A.principal(f.auth);f.page.state.baseUrl='https://scheduler.onrender.com';
 const s=f.page.state.snapshot;s.current_service_date='2026-10-06';s.projection_status='current';s.sources=[{source_id:SOURCE,source_digest:data.binding.registeredSourceDigest}];
 s.latest_projection={projection_id:PID,assignments:[]};s.roster[0].week_staffing=[{service_date:'2026-10-05',person_id:SOURCE,person_name:'Selected Monday person'},
  {service_date:'2026-10-06',person_id:MID,person_name:'Actual Tuesday person',availability_state:'working'}];
 const details={schema:'custodial.roster-source-details.v1',manager_id:MID,source_id:SOURCE,effective_start:'2026-10-06',week_start:s.week_start,authority_revision:42,
  current_source_digest:data.binding.currentSourceDigest,registered_source_digest:data.binding.registeredSourceDigest,publication_id:SOURCE,phone_released:false,
  current_roster:structuredClone(s.roster),registered_compiler_input:{slots:[{id:CID}],version:{vacancyCapableSlotIds:[CID],vacantSlotIds:[CID]}}};
 const calls=[];let outcome=false,missing=false,previewGate=null;f.context.api=async(path,o={})=>{calls.push({path,o});
  if(path.startsWith('/static-weekly/staffing/source-details?'))return structuredClone(details);
  if(path===data.route+'/preview'){if(previewGate)await previewGate;const b=JSON.parse(o.body);return{...structuredClone(data.preview),idempotencyKey:b.idempotency_key,
   projectionIdempotencyKey:'projection-'+data.hash(b.idempotency_key),reasonDigest:data.hash(b.reason)};}
  if(path===data.route){outcome=true;return{};}
  if(path.startsWith('/static-weekly/staffing/operations/')){const receipt=structuredClone(data.outcome),key=decodeURIComponent(path.split('/').at(-1).split('?')[0]);receipt.idempotency_key=key;
   if(missing)delete receipt.receipt.data.worker_candidate_digest;return receipt;}
  if(path.startsWith('/static-weekly/manager-snapshot?'))return outcome?structuredClone(data.current):structuredClone(s);
  if(path==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[]};throw Error('Unexpected '+path);
 };
 f.page.state.actions=A.create({auth:f.auth,storage:f.storage,baseUrl:f.page.state.baseUrl,api:f.context.api,onState:r=>f.page.state.pending=r});
 f.nodes.get('vacancy-dialog').showModal=()=>{};f.nodes.get('vacancy-dialog').close=()=>{};
 const button={dataset:{turnoverMode:'vacate',turnoverSlot:CID}},event={target:{closest:()=>button}},submit={preventDefault(){}};
 f.page.openTurnoverDialog(event);f.page.vacancyEls.vacancy_source.value=SOURCE;await f.page.loadVacancySource();f.page.vacancyEls.vacancy_reason.value=data.request.reason;
 return{...f,data,calls,submit,setMissing:()=>missing=true,setGate:gate=>previewGate=gate};
}

async function printFixture({entryRevision=43,readbackRevision=43,corrupt=false,pin=true,denied=false,search=null,documentPatch={},readbackPatch={},distinctLanguages=false}={}){
 const nodes=new Map(),requests=[],created=[],revoked=[],events=new Map(),blobs=[];let reads=0;
 const node=()=>({value:'',hidden:true,disabled:true,textContent:'',children:[],listeners:new Map(),append(x){this.children.push(x);},replaceChildren(){this.children=[];},addEventListener(name,fn){this.listeners.set(name,fn);},removeEventListener(name,fn){if(this.listeners.get(name)===fn)this.listeners.delete(name);}});
 const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
 const f=fixture();f.auth.opsManagerAuthHeaders=async()=>({Authorization:'fixture only'});f.auth.requireOpsManagerSession=async()=>{};f.auth.getCSTDateString=()=> '2026-10-06';
 const bytes=Buffer.from('%PDF synthetic route fixture'),hash=v=>createHash('sha256').update(v).digest('hex'),text='Synthetic English / Español route',docHash='d'.repeat(64);
 class PrintURL extends URL{static createObjectURL(blob){const url='blob:fixture-'+created.length;created.push(url);blobs.push(blob);return url;}static revokeObjectURL(url){revoked.push(url);}}
 const context=vm.createContext({document,localStorage:f.storage,MemphisAuth:f.auth,MemphisSchedulerActions:A,URL:PrintURL,URLSearchParams,AbortController,setTimeout,clearTimeout,AbortSignal,Blob,TextEncoder,Uint8Array,crypto:webcrypto,atob:value=>Buffer.from(value,'base64').toString('binary'),location:{search:search??('?date=2026-10-06'+(pin?'&expected_revision=43&projection_id='+PID:''))},addEventListener:(name,fn)=>events.set(name,fn),setInterval:()=>1,clearInterval:()=>{},fetch:async value=>{
  const url=new URL(value);requests.push(url);let data;
  if(url.pathname==='/scheduler-runtime-config')data={public_url:'https://scheduler.onrender.com'};
  else if(url.pathname==='/static-weekly/manager-snapshot'){reads++;if(denied)return{ok:false,status:403,json:async()=>({ok:false,error:'Current manager access denied'})};data={...snapshot,week_end:'2026-10-11',latest_projection:{...snapshot.latest_projection,replay_digest:'a'.repeat(64)},authority_revision:reads===1?entryRevision:readbackRevision,...(reads>1?readbackPatch:{})};}
  else if(url.pathname==='/static-weekly/coverall-print'){const revision=Number(url.searchParams.get('expected_revision'));const files=['en','es','en-es'].map(language=>{const content=distinctLanguages?Buffer.from('%PDF synthetic '+language+' route fixture'):bytes;return{language,filename:`CoverAll_2026-10-06_r${revision}_${language}.pdf`,sha256:corrupt?'e'.repeat(64):hash(content),base64:content.toString('base64')};});data={schema:'custodial.coverall-pdf-pair.v1',document:{serviceDate:'2026-10-06',authorityRevision:revision,publicationId:SOURCE,replayDigest:'a'.repeat(64),projectionId:PID,managerContact:{managerId:MID},documentDigest:docHash,contractors:[{slotId:CID,name:'Manual CoverAll'}],...documentPatch},files:files.slice(0,2),bilingualFile:files[2],texts:[{language:'en-es',documentDigest:docHash,text,sha256:hash(text)}]};}
  else throw Error('Unexpected fixture route '+url.pathname);
  return{ok:true,json:async()=>({ok:true,data})};
 }});
 // Return the existing event's promise for the bounded Node seam; the DOM
 // ignores handler return values. No test-only product export is introduced.
 const originalSource=fs.readFileSync(new URL('../coverall-print.js',sourceFixtureUrl),'utf8');
 const prepareSeam='()=>void prepare()',initSeam='void init().catch(';
 assert.equal(originalSource.split(prepareSeam).length,2,'Exact prepare return seam must remain unique');
 assert.equal(originalSource.split(initSeam).length,2,'Exact once-only init promise seam must remain unique');
 const source=originalSource.replace(prepareSeam,'()=>prepare()').replace(initSeam,'globalThis.fixtureInit = init().catch(');
 // Preserve the complete actual init/catch body and all refusal/currentness
 // guards. Capture only its original promise; never call init a second time.
 vm.runInContext(source,context);await context.fixtureInit;
 return{context,nodes,requests,created,revoked,events,blobs,prepare:()=>{assert.equal(typeof nodes.get('prepare').listeners.get('click'),'function',nodes.get('status').textContent);return nodes.get('prepare').listeners.get('click')();}};
}

const U=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0'),H=n=>String(n).repeat(64),base='https://fixture.invalid';

function options(){return{schema:'custodial.approved-manual-coverall-options.v1',operationId:U(4),semanticDigest:H('a'),expectedRevision:7,state:'PREPARING',originalCommandPreserved:true,vendorBooked:false,choice:null,days:[{
 serviceDate:'2026-11-02',sourceId:U(5),publicationId:U(2),retainedProjectionId:U(6),retainedEnvelopeIdentity:H('b'),retainedPlanDigest:H('c'),
 capacities:[{capacityId:U(7),label:'Synthetic nonemployee capacity',shift:{start:'08:00',end:'17:00'},lunch:{start:'12:00',end:'13:00'}}],
 lunchCoverers:[{slotId:U(8),label:'Synthetic available helper',shift:{start:'05:00',end:'14:00'},lunch:{start:'12:00',end:'13:00'}}]}]};}

function days(){return[{service_date:'2026-11-02',capacity_id:U(7),shift:{start:'05:00',end:'14:00'},lunch:{start:'11:00',end:'12:00'},lunch_coverer_slot_id:U(8),confirmation_reference:'Synthetic manager confirmed actual hours',actual_hours_confirmed:true}];}
export {A,P,MID,CID,PID,SOURCE,fixture,body,path,snapshot,cancellationFixture,privatePreviewFixture,initial,preview,pageFixture,datedPreviewFixture,datedDialogFixture,staffingFixture,vacancyProductFixture,vacancyPageFixture,printFixture,options as typedCoverAllOptions,days as typedCoverAllDays};
