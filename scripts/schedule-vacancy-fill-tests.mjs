import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {A,MID,CID,PID,SOURCE,fixture,vacancyPageFixture,vacancyProductFixture} from './fixtures/helper-current-scheduler-contract-fixtures.mjs';
import {pageFixture as staffingPageFixture,snapshot as staffingSnapshot,sourceDetails as staffingSourceDetails,
 owningHelper,settle,id,sourceId,slotId,managerId,publication,digest,outcome as staffingOutcome}
 from './fixtures/helper-current-staffing-fill-page-fixture.mjs';
let checks=0;const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
// The original absent fill-dialog adapter is archived with the phase baseline.
// Current vacancy review is exercised at the page; the retained fill route is
// exercised at its real actions boundary, with readonly original recovery.
{
 const f=await vacancyPageFixture();assert.match(f.page.vacancyEls.vacancy_current.textContent,/Actual Tuesday person/);checks++;
 assert.doesNotMatch(f.page.vacancyEls.vacancy_current.textContent,/Selected Monday person/);checks++;
 check(f.page.vacancyEls.vacancy_source.value,SOURCE,'selected exact published source');
 await f.page.submitVacancy(f.submit);check(f.calls.filter(r=>r.o.method==='POST').length,1,'only private preview before confirmation');
 check(f.calls.some(r=>r.path===f.data.route),false,'review does not mutate roster');check(f.map.size,0,'private preview creates no accepted original');
 check(f.nodes.get('vacancy-preview').hidden,false,'actual dated preview visible');
 const work=f.nodes.get('vacancy-preview-work').children[0];check(work.children[0].textContent,'2026-10-06','affected literal server day');
 check(work.children[1].textContent,'Actual affected duty <not HTML>','duty rendered as text');
 assert.match(f.page.vacancyEls.vacancy_state.textContent,/retained privately; not published/);checks++;
 f.context.confirmAction=async()=>false;await f.page.submitVacancy(f.submit);check(f.calls.filter(r=>r.o.method==='POST').length,1,'cancel makes no commit');
 let confirms=0;f.context.confirmAction=async()=>{confirms++;return true;};await f.page.submitVacancy(f.submit);
 const writes=f.calls.filter(r=>r.o.method==='POST');check(writes.length,2,'one preview and one accepted commit');check(confirms,1,'one explicit acceptance');
 const original=JSON.parse(writes[0].o.body),confirmed=JSON.parse(writes[1].o.body);
 check(original.source_id,SOURCE,'source identity survives review');check(original.employee_id,MID,'server-day employee, never selected-week alternate');
 check(original.effective_start,'2026-10-06','exact effective day');check(original.expected_revision,42,'exact reviewed revision');
 check(confirmed,{...original,preview_digest:f.data.preview.previewDigest},'commit carries reviewed bytes and witness');
 check(writes[1].path,f.data.route,'exact slot route');check(f.page.state.snapshot.authority_revision,44,'acceptance reaches verified current snapshot');check(f.map.size,0,'clear only after current readback');
}
for(const kind of ['missing','string','false','published']){
 const f=await vacancyPageFixture();if(kind==='missing'){delete f.data.preview.preview_retained;delete f.data.preview.published;}
 if(kind==='string')f.data.preview.preview_retained='true';if(kind==='false')f.data.preview.preview_retained=false;if(kind==='published')f.data.preview.published=true;
 await assert.rejects(f.page.submitVacancy(f.submit),/retained.*unpublished/);checks++;
 check(f.page.state.vacancySelection.preview,null,kind+' cannot become reviewed plan');check(f.nodes.get('vacancy-preview').hidden,true,kind+' not presented as ready');
 check(f.calls.some(r=>r.path===f.data.route),false,kind+' cannot mutate');check(f.map.size,0,kind+' cannot save a new original');
}
for(const changed of ['actor','source','day','revision']){
 const f=await vacancyPageFixture();let release;f.setGate(new Promise(resolve=>release=resolve));const work=f.page.submitVacancy(f.submit);
 if(changed==='actor')f.patch({credential_id:SOURCE});if(changed==='source')f.page.vacancyEls.vacancy_source.value=PID;
 if(changed==='day')f.page.state.snapshot.current_service_date='2026-10-07';if(changed==='revision')f.page.state.snapshot.authority_revision++;
 release();await assert.rejects(work,/changed/);checks++;
 check(f.page.state.vacancySelection.preview,null,changed+' drift drops stale preview');check(f.calls.some(r=>r.path===f.data.route),false,changed+' drift cannot commit');check(f.map.size,0,changed+' drift cannot save replacement');
}
{
 const f=await vacancyPageFixture();await f.page.submitVacancy(f.submit);f.setMissing();f.context.confirmAction=async()=>true;await f.page.submitVacancy(f.submit);
 check(f.page.state.pending.state,'PENDING','incomplete original witness remains unresolved');const raw=[...f.map.values()],before=f.calls.length;
 f.context.loadControlPlaneUrl=async()=> 'https://scheduler.onrender.com';await f.page.init();
 check(f.page.els.week_start.value,'2026-10-05','reload restores original week');check(f.page.els.service_date.value,'2026-10-06','reload restores original day');
 await assert.rejects(f.page.state.actions.retry(),/unconfirmed/);checks++;
 check(f.calls.slice(before).every(r=>r.o.method!=='POST'),true,'unknown original only GETs after reload');check([...f.map.values()],raw,'unconfirmed read preserves durable bytes');
}
for(const changed of ['projection','publication','revision','occupied']){
 const f=await vacancyProductFixture(),a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async(_path,o)=>{if(o.method==='POST')throw Error('lost');return f.outcome;}});
 await assert.rejects(a.runVacancy(f.request,f.preview,f.binding));checks++;await a.retry();const raw=[...f.map.values()],current=structuredClone(f.current);
 if(changed==='projection')current.latest_projection.projection_id=CID;if(changed==='publication')current.current_publication.publication_id=PID;
 if(changed==='revision')current.authority_revision++;if(changed==='occupied')current.roster[0].week_staffing[0].person_id=MID;
 check(a.acknowledge(current),false,changed+' cannot settle different projected vacancy');check([...f.map.values()],raw,changed+' cannot erase accepted original');
 check(a.acknowledge(f.current),true,'matching projected vacancy settles');
}
function fillFixture(){
 const f=fixture();f.patch({read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}});
 const route='/static-weekly/roster/vacant-slots/'+CID+'/fill',request={source_id:SOURCE,effective_start:'2026-10-06',reason:'Synthetic hire',expected_revision:42,idempotency_key:'stable-fill',new_employee_name:'Synthetic New Custodian'};
 const outcome={schema:'custodial.original-staffing-outcome.v1',state:'ACCEPTED_ORIGINAL',manager_id:MID,operation:'fill_vacant_slot',idempotency_key:request.idempotency_key,
  command_id:PID,original_request:A.staffingRequest({path:route,body:request,managerId:MID}),original_request_digest:'a'.repeat(64),
  receipt:{revision:43,data:{completion_mode:'mutation_only',original_publication_id:null}},retry_safe:false,phone_released:false};
 const calls=[];let read=outcome;const a=A.create({auth:f.auth,storage:f.storage,baseUrl:'https://scheduler.onrender.com',api:async(path,o)=>{calls.push({path,o});if(o.method==='POST')throw Error('synthetic lost fill response');return structuredClone(read);}});
 return{...f,route,request,outcome,calls,a,setRead:value=>read=value};
}
{
 const f=fillFixture();await assert.rejects(f.a.run(f.route,f.request),/lost fill/);checks++;const saved=f.a.pending().encoded;
 check(JSON.parse(saved),f.request,'fill route keeps exact requested source/name/day/revision/key');check(f.a.pending().state,'PENDING','lost fill response remains original');
 await f.a.retry();await f.a.retry();check(f.calls.length,2,'one fill POST and one original GET; known acceptance adds none');
 check(f.calls[0].path,f.route,'exact vacant-slot endpoint');check(f.calls[1].o.method,'GET','fill recovery is readonly');
 assert.match(f.calls[1].path,/\/staffing\/operations\/stable-fill\?operation=fill_vacant_slot$/);checks++;
 check(f.a.pending().encoded,saved,'fill recovery never recreates nonce or body');check(f.a.pending().state,'ACCEPTED','original read confirms original fill');
 check(f.a.acknowledge({week_start:'2026-10-05',authority_revision:42}),false,'old revision cannot clear');
 check(f.a.acknowledge({week_start:'2026-10-12',authority_revision:43}),false,'foreign week cannot clear');
 check(f.a.acknowledge({week_start:'2026-10-05',authority_revision:43}),true,'current original-week read clears mutation-only receipt');check(f.map.size,0,'fill storage clears after original acknowledgement');
}
for(const changed of ['source','name','blank','date','extra']){
 const f=fillFixture(),bad=structuredClone(f.request);if(changed==='source')delete bad.source_id;if(changed==='name')bad.new_employee_name=' Unreviewed trim ';
 if(changed==='blank')bad.new_employee_name='';if(changed==='date')bad.effective_start='2026-02-31';if(changed==='extra')bad.employee_active=true;
 await assert.rejects(f.a.run(f.route,bad));checks++;check(f.calls.length,0,changed+' invalid fill cannot dispatch');check(f.map.size,0,changed+' invalid fill cannot replace original');
}
for(const changed of ['actor','key','body','completion','unknown']){
 const f=fillFixture();await assert.rejects(f.a.run(f.route,f.request));checks++;const raw=[...f.map.values()],bad=structuredClone(f.outcome);
 if(changed==='actor')bad.manager_id=SOURCE;if(changed==='key')bad.idempotency_key='foreign';if(changed==='body')bad.original_request.source_id=PID;
 if(changed==='completion')delete bad.receipt.data.completion_mode;if(changed==='unknown')bad.state='OUTCOME_UNCONFIRMED';f.setRead(bad);
 await assert.rejects(f.a.retry());checks++;check(f.a.pending().state,'PENDING',changed+' does not confirm original');check([...f.map.values()],raw,changed+' keeps exact original');
 check(f.calls.filter(r=>r.o.method==='POST').length,1,changed+' never repeats fill POST');
}
{
 const f=fillFixture();f.patch({read_only:true});await assert.rejects(f.a.run(f.route,f.request),/not authorized/);checks++;check(f.calls.length,0,'fill remains owner-only');
}
// Current manager fill UI is Manager Hub > Staffing positions. This exact
// extracted existing page fixture drives that form and the real saved helper;
// the response data below is synthetic server output, not an alternate client.
function staffingFillFixture({selected='2026-10-12',eligibility=null,lost=false,owner=true}={}){
 const calls=[];let helper,committed=false,body=null,postGate=null,revision=12,sourceDrift=false;
 const before={...staffingSnapshot(),week_start:'2026-10-12',week_end:'2026-10-18',
  roster:[{...staffingSnapshot().roster[0],incumbencies:[],week_staffing:[{service_date:selected,person_id:null,employee_active:null,availability_state:'vacant_unfilled'}]}]};
 if(eligibility==='occupied'){before.roster[0].incumbencies=staffingSnapshot().roster[0].incumbencies;Object.assign(before.roster[0].week_staffing[0],{person_id:id(3),person_name:'Current employee',employee_active:true,availability_state:'working'});}
 if(eligibility==='future')before.roster[0].incumbencies=[{person_id:id(80),person_name:'Future employee',effective_start:'2026-10-16',effective_end:null}];
 if(eligibility==='contractor')before.roster[0].contractor_capacity=true;
 if(eligibility==='missing-source')delete before.current_publication.authority_source_id;
 if(eligibility==='ambiguous-source')before.sources.push({...before.sources[0]});
 const current=()=>({...structuredClone(before),authority_revision:14,projection_status:'current',latest_projection:{projection_id:id(73)},
  roster:[{...structuredClone(before.roster[0]),incumbencies:[{person_id:id(81),person_name:body.new_employee_name,effective_start:selected,effective_end:null}],
   week_staffing:[{service_date:selected,person_id:id(81),person_name:body.new_employee_name,employee_active:true,availability_state:'working'}]}]});
 const originalOutcome=()=>{const value=staffingOutcome(body),mutation={slot_id:slotId,source_id:sourceId,source_digest:digest,effective_start:selected,
   new_employee_name:body.new_employee_name,new_employee_id:id(81),phone_assignment:null,completion_mode:'projection_required',original_publication_id:publication};
  value.operation='fill_vacant_slot';delete value.original_request.employee_id;Object.assign(value.original_request,{operation:'fill_vacant_slot',new_employee_name:body.new_employee_name});
  value.receipt.data={...mutation,mutation,current_projection:{projection_id:id(73),publication_id:publication,week_start:before.week_start}};return value;};
 const f=staffingPageFixture({owner,savedRequestsFactory:(auth,api)=>{helper=owningHelper(auth,api);return helper;},api:async(path,o={})=>{
  calls.push({path,o});
  if(path.includes('/manager-snapshot'))return structuredClone(path.includes('week_start=2026-10-12')?(committed?current():{...before,authority_revision:revision}):staffingSnapshot());
  if(path.includes('/source-details?')){const date=new URLSearchParams(path.split('?')[1]).get('effective_start');if(date!==selected)return staffingSourceDetails();
   const s=committed?current():{...before,authority_revision:revision},details={...staffingSourceDetails(s),effective_start:selected,week_start:before.week_start};
   if(eligibility==='unregistered')details.registered_compiler_input.version.vacancyCapableSlotIds=[];
   if(sourceDrift)details.current_source_digest='c'.repeat(64);return structuredClone(details);}
  if(o.method==='POST'){
   check(path,'/static-weekly/roster/vacant-slots/'+slotId+'/fill','actual staffing form reaches exact fill route');
   check(helper.pending().encoded,o.body,'real helper persists exact bytes before fill dispatch');check(helper.pending().state,'PENDING','dispatch owns saved original');
   body=JSON.parse(o.body);committed=true;if(postGate)await postGate;if(lost)throw Error('Synthetic lost fill response');return{};
  }
  if(path.includes('/staffing/operations/'))return originalOutcome();throw Error('Unexpected staffing fill fixture request '+path);
 }});
 const open=async()=>{await f.page.init();f.nodes.get('staffing-date').value=selected;await f.nodes.get('staffing-date').fire('change');await settle();
  f.nodes.get('staffing-slot').value=slotId;await f.nodes.get('staffing-slot').fire('change');
  return f.nodes.get('staffing-kind').children.map(option=>option.value);};
 const preview=async(name=' Synthetic New Custodian ')=>{const eligible=f.page.view().rows.some(row=>row.slot_id===slotId&&row.capabilities.fill);
  f.nodes.get('staffing-kind').value='fill';if(eligible)await f.nodes.get('staffing-kind').fire('change');
  f.nodes.get('staffing-new-name').value=name;await f.nodes.get('staffing-new-name').fire('input');
  f.nodes.get('staffing-reason').value='Fill the stable vacancy';await f.nodes.get('staffing-reason').fire('input');
  // Negative cases deliberately forge the unavailable choice to verify the
  // owning form/controller guard, beyond its absence from visible options.
  if(!eligible)f.nodes.get('staffing-kind').value='fill';await f.nodes.get('staffing-form').fire('submit');await settle();};
 const confirm=async()=>{await f.nodes.get('staffing-confirm').fire('click');await settle();};
 const refresh=async()=>{await f.nodes.get('staffing-refresh').fire('click');await settle();};
 return{...f,calls,open,preview,confirm,refresh,saved:()=>helper.pending(),setPostGate:value=>postGate=value,setRevision:value=>revision=value,
  changeSource:()=>sourceDrift=true,expected:()=>({source_id:sourceId,effective_start:selected,reason:'Fill the stable vacancy',expected_revision:12,
   new_employee_name:'Synthetic New Custodian',idempotency_key:'staffing-fill-'+id(90)})};
}
{
 const hub=readFileSync(new URL('../start_page1.html',import.meta.url),'utf8'),page=readFileSync(new URL('../staffing-management.html',import.meta.url),'utf8');
 assert.match(hub,/<a id="staffing-link"[^>]*href="\.\/staffing-management\.html\?hub=manager"/);checks++;
 assert.match(page,/<script type="module" src="\.\/manager-staffing-runtime\.mjs"><\/script>/);checks++;
}
{
 const f=staffingFillFixture();try{
  const choices=await f.open();check(choices.includes('fill'),true,'current eligible vacancy visibly offers Fill with a new employee');check(choices.includes('restore'),false,'history never invents eligible restoration');
  await f.preview();check(f.page.view().state,'PREVIEW','actual fill form displays private factual preview');check(f.nodes.get('staffing-preview').hidden,false,'fill preview visible');
  check(f.nodes.get('staffing-new-name-field').hidden,false,'actual Fill choice reveals the new employee input');
  check(f.nodes.get('staffing-confirm').disabled,false,'one explicit confirmation is available');check(f.saved(),null,'preview does not create submitted original');
  check(f.calls.some(row=>row.o.method==='POST'),false,'fill preview never commits automatically');
  check(f.page.view().preview.body,f.expected(),'visible form binds exact source/name/effective week/revision/key');
  for(const text of ['Fill vacant position with a new employee','Synthetic New Custodian','Effective date: 2026-10-12','Expected revision: 12',sourceId,slotId]){
   check(f.nodes.get('staffing-preview-text').textContent.includes(text),true,'factual review includes '+text);
  }
  let release;f.setPostGate(new Promise(resolve=>release=resolve));await f.confirm();const original=f.saved().encoded;
  check(f.page.view().state,'CONFIRM_PENDING','one confirmed request remains owned while transport waits');check(f.nodes.get('staffing-confirm').disabled,true,'double confirmation disabled');
  check(f.nodes.get('staffing-new-name').disabled,true,'new-person input fenced while original pending');await f.confirm();check(f.calls.filter(row=>row.o.method==='POST').length,1,'double confirmation never dispatches twice');
  release();await settle();check(f.page.view().state,'ACCEPTED','canonical original outcome accepts exact fill');check(f.saved().state,'ACCEPTED','real saved helper retains acceptance until current readback');
  check(f.saved().encoded,original,'accepted fill preserves original bytes');check(f.calls.filter(row=>row.path.includes('/staffing/operations/')).length,1,'single canonical original GET');
  check(f.calls.find(row=>row.o.method==='POST').o.body,JSON.stringify(f.expected()),'exact dispatch matches reviewed input bytes');
  await f.refresh();check(f.page.view().state,'READY','current readback returns current staffing view');check(f.saved(),null,'current readback acknowledges original fill');
  check(f.page.view().rows[0].person_name,'Synthetic New Custodian','accepted new incumbent rendered in stable position');check(f.page.view().rows[0].slot_id,slotId,'position identity survives new employee');
  check(f.page.view().rows[0].capabilities.fill,false,'occupied position cannot be filled again');check(f.calls.filter(row=>row.o.method==='POST').length,1,'readback never repeats fill');
 }finally{f.page.stop();check(f.timers.size,0,'fill page timer released');}
}
{
 const f=staffingFillFixture({lost:true});try{await f.open();await f.preview();await f.confirm();const original=f.saved().encoded;
  check(f.page.view().state,'OUTCOME_UNKNOWN','lost fill response stays unknown');check(f.nodes.get('staffing-check-outcome').disabled,false,'original recovery is available');
  f.nodes.get('staffing-new-name').value='Changed after lost response';await f.nodes.get('staffing-new-name').fire('input');check(f.saved().encoded,original,'hostile name edit cannot replace original fill');
  const count=f.calls.length;await f.nodes.get('staffing-check-outcome').fire('click');await settle();check(f.page.view().state,'ACCEPTED','original fill is recovered');
  check(f.calls.slice(count).every(row=>row.o.method==='GET'),true,'actual fill-page unknown recovery uses only GET');check(f.calls.filter(row=>row.o.method==='POST').length,1,'actual fill page never resends unknown mutation');
  await f.refresh();check(f.saved(),null,'recovered fill clears after current readback');check(f.page.view().rows[0].person_name,'Synthetic New Custodian','recovery keeps original employee name');
 }finally{f.page.stop();}
}
for(const eligibility of ['occupied','future','contractor','unregistered','missing-source','ambiguous-source']){
 const f=staffingFillFixture({eligibility});try{const choices=await f.open();check(choices.includes('fill'),false,eligibility+' never exposes eligible fill action');
  await f.preview();check(f.page.view().preview,null,eligibility+' forged form cannot prepare fill');check(f.calls.some(row=>row.o.method==='POST'),false,eligibility+' cannot dispatch');check(f.saved(),null,eligibility+' cannot save original');
 }finally{f.page.stop();}
}
{
 const f=staffingFillFixture({selected:'2026-10-13'});try{check((await f.open()).includes('fill'),false,'midweek fill does not masquerade as recurring effective Monday');
  await f.preview();check(f.page.view().preview,null,'midweek forged form refuses');check(f.calls.some(row=>row.o.method==='POST'),false,'midweek fill never dispatches');
 }finally{f.page.stop();}
}
for(const name of ['', 'A', 'Unsafe\nName']){
 const f=staffingFillFixture();try{await f.open();await f.preview(name);check(f.page.view().preview,null,'invalid new employee name cannot prepare');
  check(f.calls.some(row=>row.o.method==='POST'),false,'invalid name cannot dispatch');check(f.saved(),null,'invalid name creates no saved original');
 }finally{f.page.stop();}
}
for(const change of ['revision','source','actor']){
 const f=staffingFillFixture();try{await f.open();await f.preview();if(change==='revision')f.setRevision(13);if(change==='source')f.changeSource();if(change==='actor')f.f.change();
  await f.confirm();check(f.calls.some(row=>row.o.method==='POST'),false,change+' changed before fill acceptance refuses before write');
  if(change==='actor'){assert.throws(()=>f.saved(),/Manager access changed/);checks++;}else check(f.saved(),null,change+' cannot persist unreviewed fill');
  check(f.page.view().state,change==='actor'?'DENIED':'HELD',change+' visibly withdraws original preview');
 }finally{f.page.stop();}
}
{
 const f=staffingFillFixture({owner:false});try{await f.open();check(f.nodes.get('staffing-form').hidden,true,'readonly manager has no fill form');
  await f.preview();await f.confirm();check(f.calls.some(row=>row.o.method==='POST'),false,'readonly page installs no fill submission');check(f.saved(),null,'readonly page creates no original');
 }finally{f.page.stop();}
}
console.log(JSON.stringify({status:'PASS_CURRENT_VACANCY_AND_FILL_UI',checks,actualPageHandlers:true,
 scope:'Actual weekly vacancy page and separate Manager Hub Staffing positions fill form, exact saved helper dispatch, original GET recovery and current readback; inert transport/DOM. No SQL, rendered-browser, phone or release proof.'}));
