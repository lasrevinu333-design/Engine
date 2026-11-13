import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={URL,URLSearchParams,TextEncoder,console};
for(const file of ['memphis-approved-schedule.js','memphis-scheduler-actions.js','coverall-print.js'])
 vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
const A=context.MemphisSchedulerActions,P=context.MemphisApprovedSchedule,C=context.MemphisCoverAllPrint,
 id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,manifest='fe02bbdebc736d95360b55cc7dfe5b73c5a9eaa76f364f1c0f4420a0afb9950f',
 add=(s,n)=>new Date(Date.parse(s+'T12:00Z')+n*86400000).toISOString().slice(0,10),
 snapshot=(start,status='missing')=>({week_start:start,week_end:add(start,6),authority_revision:4,current_service_date:'2026-10-30',projection_status:status,
  current_publication:{publication_id:id(1),version_id:id(2)},latest_projection:null,
  approved_manual_period:{schema:'custodial.approved-manual-period-window.v1',manifestSha256:manifest,publicationId:id(1),versionId:id(2),
   origin:'2026-10-30',frameStart:start,frameEnd:add(start,6),normalSourceLocked:true}}),
 body={start_date:'2026-11-02',end_date:'2026-11-09',expected_revision:4},
 bindings=['2026-10-30','2026-11-06'].map(weekStart=>({weekStart,publicationId:id(1),versionId:id(2),authorityRevision:4}));
const cases=[];
async function test(name,fn){try{await fn();cases.push({name,status:'PASS'});}catch(e){cases.push({name,status:'FAIL',error:e.message});}}
await test('F02 actual activation-period vector accepted',()=>assert.equal(A.staffingBindings({body,weekBindings:bindings}).length,2));
await test('F03 missing projection retains authenticated source period identity',()=>assert.equal(P.validSnapshotWindow(snapshot('2026-10-30'),'2026-11-02'),true));
await test('F03 stale projection retains source period identity',()=>assert.equal(P.validSnapshotWindow(snapshot('2026-10-30','stale'),'2026-10-30'),true));
await test('F09 actual handout handler reaches revision-bound document read',async()=>{
 const source=readFileSync(new URL('../coverall-print.js',import.meta.url),'utf8'),calls=[],els=new Map(),s={...snapshot('2026-10-30'),projection_status:'current',latest_projection:{projection_id:id(3),replay_digest:'a'.repeat(64)}};
 const c={busy:false,linkBusy:false,closed:false,accessDenied:false,sequence:0,entry:null,owner:{managerId:id(4)},clear(){},current(){},monday:C.monday,snapshotPeriod:C.snapshotPeriod,
  el:key=>{if(!els.has(key))els.set(key,{value:'2026-11-02'});return els.get(key);},request:async path=>{calls.push(path);if(path.includes('manager-snapshot'))return s;throw Error('synthetic document boundary reached');},
  validate:x=>x,UUID:/^[0-9a-f-]{36}$/i,HASH:/^[a-f0-9]{64}$/,URLSearchParams,actions:{permissions:()=>({coverall:true})},auth:{}};
 vm.runInNewContext(source.slice(source.indexOf('async function prepare(){'),source.indexOf('const onPrepare=')),c);
 await c.prepare();assert.equal(calls.some(path=>path.startsWith('/static-weekly/coverall-print?')),true,els.get('status')?.textContent);
});

await test('F02 adjacent actual periods inside a calendar week are both read',async()=>{
 const calls=[],range={start_date:'2026-11-05',end_date:'2026-11-06',expected_revision:4};
 const result=await A.readStaffingBindings({snapshot:snapshot('2026-10-30'),body:range,api:async path=>{calls.push(path);return snapshot('2026-11-06');}});
 assert.deepEqual(Array.from(result.bases,b=>b.weekStart),['2026-10-30','2026-11-06']);assert.equal(calls.length,1);assert.ok(calls[0].endsWith('2026-11-06'));
});
for(const change of [b=>b.pop(),b=>b.reverse(),b=>b.push({...b[1]}),b=>b[1].weekStart='2026-11-07',b=>b[1].authorityRevision=5,b=>b[0].publicationId='invalid'])
 await test('F02 invalid or incomplete binding refused '+change.toString(),()=>{const rows=structuredClone(bindings);change(rows);assert.throws(()=>A.staffingBindings({body,weekBindings:rows}));});
for(const change of [s=>s.approved_manual_period.origin='2026-10-29',s=>s.approved_manual_period.versionId=id(99),s=>s.approved_manual_period.manifestSha256='0'.repeat(64),s=>s.week_end='2026-11-06'])
 await test('F03 invalid period source refused '+change.toString(),()=>{const value=snapshot('2026-10-30');change(value);assert.equal(P.validSnapshotWindow(value,'2026-11-02'),false);});
await test('F02 revision race during subsequent period read leaves whole range unsubmitted',async()=>{
 await assert.rejects(()=>A.readStaffingBindings({snapshot:snapshot('2026-10-30'),body,api:async()=>({...snapshot('2026-11-06'),authority_revision:5})}));
});
await test('F02 actual preview validates actual-period publication vector and rejects calendar substitution',()=>{
 const command={operationId:id(10),semanticDigest:'a'.repeat(64)},record={body:{...body,command_kind:'absence',employee_id:id(11),absence_kind:'pto',client_prepare_key:id(12)},managerId:id(13),command,weekBindings:bindings},
 value={operation_id:command.operationId,expected_revision:4,prepared_by_manager_id:record.managerId,state:'PREPARED',semantic_digest:command.semanticDigest,
 semantic_body:{commandKind:'absence',employeeId:id(11),startDate:body.start_date,endDate:body.end_date,absenceKind:'pto',targetAbsenceId:null},
 preview_digest:'b'.repeat(64),input_digest:'c'.repeat(64),candidate_set_digest:'d'.repeat(64),publication_vector:{expectedRevision:4,weeks:structuredClone(bindings)},
 preview:{schema:'memphis-zoo.staffing-command-preview.v1',weeks:bindings.map(b=>({...b,week_start:b.weekStart,database_projection_identity:'e'.repeat(64),replayDigest:'f'.repeat(64),compilerVersion:'approved-manual-period-v1',sourceDigest:'a'.repeat(64),sourceDigestBasis:'envelope.authority.sourceDigest',projectionAvailabilityBasis:'envelope.authority.projectionAvailability',projectionAvailabilityDigest:'b'.repeat(64),assignments:[],projectionAvailability:[],lunch_loans:[],lunch_responsibilities:[]}))}};
 assert.equal(A.validateStaffingPreview(value,record).state,'PREPARED');value.publication_vector.weeks[0].weekStart='2026-11-02';assert.throws(()=>A.validateStaffingPreview(value,record),/publication or revision changed/);
});
await test('F02 actual page caller prepares bound periods; multiple employees never enter legacy batch',async()=>{
 const source=readFileSync(new URL('../schedule-weekly.js',import.meta.url),'utf8'),calls=[],selection={date:'2026-11-05',endDate:'2026-11-06',absenceCount:1,contractorCount:0,operations:[{payload:{slotId:id(11)},exception_type:'pto'}]},s=snapshot('2026-10-30');
 const c={window:context,state:{actions:{prepareStaffing:async(body,binding)=>{calls.push({body,binding});return {};}},snapshot:s},requireSchedulerPermission(){},needSnapshot:()=>s,dayChangeSelection:()=>selection,
  datedReviewBinding:()=>({}),manualScheduleView:()=>null,busy:fn=>fn(),requireCurrentDatedReview(){},rosterForDate:()=>[{slot_id:id(11),person_id:id(12),staffing_identity_valid:true}],approvedPreviewContext:()=>({}),renderApprovedPreview(){},api:async()=>snapshot('2026-11-06'),setStatus(){},crypto:{randomUUID:()=>id(13)},requireCurrentPreviewContext(){},displayStaffingPreview:async()=>{}};
 vm.runInNewContext(source.slice(source.indexOf('async function applyDayChanges(){'),source.indexOf('function staffingDateUnavailable(){')),c);
 await c.applyDayChanges();assert.deepEqual(Array.from(calls[0].binding.weeks,b=>b.weekStart),['2026-10-30','2026-11-06']);assert.equal(calls[0].body.end_date,'2026-11-06');
 selection.absenceCount=2;await assert.rejects(()=>c.applyDayChanges(),/Select one employee absence/);assert.equal(calls.length,1);
});
await test('F03 actual locked-source recovery handler submits explicit unchanged-period request',async()=>{
 const source=readFileSync(new URL('../schedule-weekly.js',import.meta.url),'utf8'),calls=[],s=snapshot('2026-11-06'),c={state:{manualActivationPanel:{normalLocked:()=>true}},requireSchedulerPermission(){},needSnapshot:()=>s,datedReviewBinding:()=>({}),confirmAction:async message=>{assert.match(message,/unchanged locked normal pattern/);return true;},busy:fn=>fn(),requireCurrentDatedReview(){},commandId:()=> 'synthetic-original',runDated:async(path,body)=>calls.push({path,body})};
 vm.runInNewContext(source.slice(source.indexOf('async function rebuildCurrentProjection(){'),source.indexOf('async function reverseChange(')),c);await c.rebuildCurrentProjection();assert.equal(calls[0].body.week_start,'2026-11-06');assert.equal(calls[0].body.expected_revision,4);
});
await test('F09 saved Friday handout link resumes for revocation; malformed range refused',()=>{
 const source=readFileSync(new URL('../coverall-print.js',import.meta.url),'utf8'),v={schema:'custodial.coverall-link-pending.v1',managerId:id(1),base:'https://synthetic.invalid',requestId:id(2),capacityId:id(3),date:'2026-11-02',week:'2026-10-30',revision:4,projectionId:id(4),ttlHours:24},nodes=new Map(),c={root:{localStorage:{getItem:()=>JSON.stringify(v)}},linkKey:()=> 'synthetic',owner:{managerId:id(1)},base:v.base,UUID:/^[0-9a-f-]{36}$/i,monday:C.monday,snapshotPeriod:C.snapshotPeriod,el:key=>{if(!nodes.has(key))nodes.set(key,{});return nodes.get(key);}};
 vm.runInNewContext(source.slice(source.indexOf('function loadLinkPending(){'),source.indexOf('function renderCapacityControls(){')),c);c.loadLinkPending();assert.equal(c.linkPending.week,'2026-10-30');v.date='2026-11-06';assert.throws(()=>c.loadLinkPending());
});

for(let day=0;day<7;day++)await test('manual activation weekday '+day+' is source-aligned across periods',async()=>{
 const origin=add('2026-10-26',day),first=add(origin,7),v=snapshot(first);v.approved_manual_period.origin=origin;
 assert.equal(P.validSnapshotWindow(v,add(first,3)),true);assert.equal(C.snapshotPeriod(v,add(first,3)),first);
 const value=await A.readStaffingBindings({snapshot:v,body:{start_date:add(first,3),end_date:add(first,6),expected_revision:4},api:async()=>{throw Error('unnecessary read');}});
 assert.equal(value.bases[0].weekStart,first);
});
await test('legacy Monday projection remains accepted for exact selected civil day',()=>{
 assert.equal(P.validSnapshotWindow({week_start:'2026-11-02',week_end:'2026-11-08'},'2026-11-04'),true);
 assert.equal(C.snapshotPeriod({week_start:'2026-11-02',week_end:'2026-11-08'},'2026-11-04'),'2026-11-02');
});
await test('source metadata keeps normal generation and publication locked if auxiliary panel read is unavailable',async()=>{
 const source=readFileSync(new URL('../schedule-weekly.js',import.meta.url),'utf8'),c={state:{snapshot:snapshot('2026-10-30')},requireSchedulerPermission(){throw Error('must stop before any new authority');}};
 for(const [start,end,name]of [['async function generateDraft(){','function approvedPreviewContext(){','generateDraft'],['async function publishDraft(){','function dayChangeSelection(){','publishDraft']]){
  const from=source.indexOf(start),next=source.indexOf(end,from);assert.ok(from>=0&&next>from);vm.runInNewContext(source.slice(from,next),c);await assert.rejects(()=>c[name](),/active and locked/);
 }
});
console.log(JSON.stringify({scope:'actual browser modules, synthetic snapshots; no DB or rendered browser',cases},null,2));
if(cases.some(c=>c.status==='FAIL'))process.exitCode=1;
