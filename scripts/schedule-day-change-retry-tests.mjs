import assert from 'node:assert/strict';
import vm from 'node:vm';
import {A,CID,PID,SOURCE,datedDialogFixture,printFixture} from './fixtures/helper-current-scheduler-contract-fixtures.mjs';
let checks=0;const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const turns=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function fixture({absence=false,lunch=true}={}){
 const f=datedDialogFixture(),values={'[data-shift-start]':'07:00','[data-shift-end]':'15:00','[data-break-choice]':lunch?'SCHEDULED':'NONE','[data-lunch-start]':'11:00','[data-lunch-end]':'12:00'};
 const row={querySelector:selector=>({value:values[selector]})},contractor={checked:true,disabled:false,dataset:{contractorSlot:SOURCE},closest:()=>row};
 const callout={checked:true,disabled:false,dataset:{calloutSlot:CID}},eligible={checked:false,disabled:false,dataset:{calloutSlot:PID}};
 const selected=absence?[callout]:[];f.context.document.querySelectorAll=selector=>selector==='[data-callout-slot]:checked:not(:disabled)'?selected:
  selector==='[data-contractor-slot]:checked:not(:disabled)'?[contractor]:selector==='[data-callout-slot]:not(:checked)'?[eligible]:
  selector.startsWith('[data-callout-slot],[data-contractor-row] input,')?[...selected,contractor,eligible]:[];
 const before=structuredClone(f.page.state.snapshot);Object.assign(before,{projection_status:'current',latest_projection:{projection_id:CID},drafts:[],sources:[]});f.page.state.snapshot=before;
 let accepted=false,failReads=0,confirmations=0,approve=true,confirmHook=async()=>{},readValue=null;const reads=[];
 const api=async(path,options={})=>{
  if(options.method==='POST'){const result=await f.api(path,options);accepted=true;return result;}
  reads.push(path);if(failReads-->0)throw Error('synthetic current read unavailable');
  if(path.startsWith('/static-weekly/manager-snapshot?'))return structuredClone(readValue||{...before,authority_revision:accepted?43:42,latest_projection:{projection_id:accepted?PID:CID}});
  if(path==='/static-weekly/approved-choices')return{schema:'custodial.approved-schedule-choices.v1',initial:[]};throw Error('Unexpected read '+path);
 };
 const attach=()=>A.create({auth:f.auth,storage:f.storage,api,baseUrl:'https://scheduler.onrender.com',onState:r=>f.page.state.pending=r});
 f.page.state.actions=attach();f.page.state.principal=A.principal(f.auth);f.context.api=api;f.context.refreshSnapshot=f.page.refreshSnapshot;
 f.context.confirmAction=async()=>{confirmations++;await confirmHook();return approve;};
 const retry=async()=>{await f.page.state.actions.retry();await f.page.refreshSnapshot();};
 return{...f,api,reads,values,selected,contractor,eligible,attach,retry,confirmations:()=>confirmations,setApprove:value=>approve=value,
  setConfirmHook:hook=>confirmHook=hook,failReads:count=>failReads=count,setRead:value=>readValue=value};
}
{
 const f=fixture();f.setMode('offline');await f.page.applyDayChanges();
 check(f.page.state.pending.state,'PENDING','unknown outcome stays saved');check(f.page.els.service_date.disabled,true,'date locked to uncertain operation');
 check(f.page.els.absence_type.disabled,true,'reason locked while unresolved');check(f.eligible.disabled,true,'new competing selection disabled');
 check(f.nodes.get('coverall-print-link').hidden,true,'unresolved mutation hides handout link');check(f.nodes.get('scheduler-retry').disabled,false,'same original recovery remains available');
 const original=f.page.state.pending.encoded;f.page.els.service_date.value='2026-10-06';f.page.state.snapshot.authority_revision=99;f.values['[data-shift-start]']='09:00';
 f.setRead({...f.page.state.snapshot,authority_revision:99,projection_status:'current',latest_projection:{projection_id:PID}});f.setMode('accept');await f.retry();
 check(f.calls.length,2,'one original dispatch plus exact compatible-route retry');check(f.calls[0],f.calls[1],'same endpoint and exact encoded body despite hostile controls');
 check(JSON.parse(f.calls[1].options.body).expected_revision,42,'unknown retry never silently rebases authority');check(f.confirmations(),1,'same original replay does not ask again');
 check(f.page.state.pending,null,'clear after accepted response and verified current read');check(f.map.size,0,'durable original clears only after current readback');
 check(f.page.els.service_date.disabled,false,'date releases after readback');check(JSON.parse(original).service_date,'2026-10-05','original date stays immutable');
}
{
 const f=fixture();f.failReads(1);await f.page.applyDayChanges();check(f.page.state.pending.state,'ACCEPTED','accepted mutation survives read failure');
 assert.match(f.page.els.status.textContent,/accepted|receipt|readback/i);checks++;
 await f.retry();check(f.calls.length,1,'known accepted mutation is not posted again');check(f.confirmations(),1,'accepted read repair never reconfirms');check(f.map.size,0,'read repair settles exact original');
}
{
 const f=fixture();f.setApprove(false);await f.page.applyDayChanges();check(f.calls.length,0,'cancel has no mutation');check(f.map.size,0,'cancel has no pending original');
}
for(const change of ['date','revision','selection']){
 const f=fixture();f.setConfirmHook(async()=>{if(change==='date')f.page.els.service_date.value='2026-10-06';if(change==='revision')f.page.state.snapshot.authority_revision=98;if(change==='selection')f.values['[data-shift-start]']='09:00';});
 await f.page.applyDayChanges();check(f.calls.length,0,change+' changed while reviewing refuses before dispatch');check(f.map.size,0,change+' cannot save an unreviewed replacement');
}
{
 const f=fixture();let release;f.setPending(new Promise(resolve=>{release=resolve;}));const first=f.page.applyDayChanges();await turns();
 check(f.page.state.busy,true,'first request owns mutation while transport pending');
 await assert.rejects(f.page.applyDayChanges(),/saved schedule request/);checks++;check(f.calls.length,1,'double click cannot dispatch a competing original');
 release();await first;check(f.confirmations(),1,'double click never opens second review');
}
{
 const f=fixture();f.setMode('offline');await f.page.applyDayChanges();for(let i=0;i<2;i++){await assert.rejects(f.page.state.actions.retry());checks++;}
 f.setMode('accept');await f.retry();check(f.calls.length,4,'three unknown responses then exact recovery');
 check(new Set(f.calls.map(row=>row.options.body)).size,1,'all compatible legacy retries preserve exact bytes');check(f.confirmations(),1,'all retries remain one confirmed command');
}
{
 const f=fixture({absence:true});f.setMode('offline');await f.page.applyDayChanges();check(f.nodes.get('coverall-print-link').hidden,true,'unknown absence/capacity/lunch batch exposes no handout');
 const body=JSON.parse(f.calls[0].options.body);check(body.operations.map(row=>row.operation),['exception','cover_all','exception'],'absence/capacity/actual lunch remain one atomic compatibility batch');
 check(body.operations[2].ends_at,'12:00','exact actual lunch end is captured');f.values['[data-lunch-end]']='12:30';f.setMode('accept');await f.retry();
 check(f.calls[0].options.body,f.calls[1].options.body,'captured capacity and lunch bytes survive changed controls');
 check(f.nodes.get('coverall-print-link').hidden,false,'explicit handout link enabled only after accepted current readback');
 check(f.reads.some(path=>path.includes('coverall-print')),false,'mutation recovery does not silently prepare another dated PDF');
}
{
 const f=fixture();await f.page.applyDayChanges();const print=await printFixture({corrupt:true});try{await print.prepare();
  check(print.created.length,0,'failed PDF digest exposes no download');check(f.calls.length,1,'independent print failure never repeats schedule mutation');check(f.page.state.pending,null,'print error cannot revive settled schedule original');
 }finally{print.events.get('pagehide')?.();}
}
{
 const f=fixture();f.values['[data-lunch-end]']='10:30';await assert.rejects(f.page.applyDayChanges(),/actual CoverAll lunch/);checks++;
 check(f.confirmations(),0,'invalid actual lunch rejected before confirmation');check(f.calls.length,0,'invalid actual hours never mutate');
}
// Current renderers mark accepted absences/capacity checked and disabled.
// The controls pass only changes unchecked actionable selections; accepted
// business state survives repeated pending and settled control passes.
for(const accepted of [false,true]){
 const f=fixture();if(accepted)f.failReads(1);else f.setMode('offline');await f.page.applyDayChanges();
 const applied={checked:true,disabled:true,dataset:{calloutSlot:CID}},newAbsence={checked:false,disabled:false,dataset:{calloutSlot:PID}},
  appliedCapacity={checked:true,disabled:true,dataset:{contractorSlot:SOURCE}},newCapacity={checked:false,disabled:false,dataset:{contractorSlot:PID}};
 f.context.document.querySelectorAll=selector=>selector==='[data-callout-slot]:not(:checked)'?[newAbsence]:
  selector==='[data-contractor-slot]:not(:checked)'?[newCapacity]:selector.startsWith('[data-callout-slot],[data-contractor-row] input,')?[applied,newAbsence,appliedCapacity,newCapacity]:[];
 f.page.setControls();f.page.setControls();check([applied,newAbsence,appliedCapacity,newCapacity].map(x=>x.disabled),[true,true,true,true],'new rendered selections fenced with accepted business state preserved');
 f.setMode('accept');await f.retry();f.page.setControls();f.page.setControls();
 check([applied,newAbsence,appliedCapacity,newCapacity].map(x=>x.disabled),[true,false,true,false],'recovery restores only eligible fresh selections');
 check(f.calls.length,accepted?1:2,'control recovery never repeats known accepted write');check(f.confirmations(),1,'control recovery never reconfirms');
 f.patch({read_only:true,permissions:{schema:'custodial.manager-permissions.v1',read:true,manage_absences:true}});f.page.setControls();
 check(newCapacity.disabled,true,'business-disabled capacity remains unavailable without capability');check(applied.disabled,true,'already accepted absence remains disabled');
}
for(const accepted of [false,true]){
 const f=fixture();if(accepted)f.failReads(1);else f.setMode('offline');await f.page.applyDayChanges();const bytes=f.page.state.pending.encoded,stored=[...f.map.values()];
 for(const handler of ['generateDraft()','publishDraft()','rebuildCurrentProjection()',
  'reverseChange({target:{closest:()=>({dataset:{reverseException:"missing"}})}})',
  ...['departed','replace','vacate'].map(mode=>`openTurnoverDialog({target:{closest:()=>({dataset:{turnoverSlot:"${CID}",turnoverMode:"${mode}"}})}})`),
  'submitTurnover({preventDefault(){}})']){
  try{await vm.runInContext(handler,f.context);}catch{} // Current handlers either refuse or hold visibly; neither may dispatch.
  check(f.calls.length,1,handler+' cannot compete while original pending');check(f.confirmations(),1,handler+' cannot create competing confirmation');
  check(f.page.state.pending.encoded,bytes,handler+' cannot replace original body');check([...f.map.values()],stored,handler+' cannot alter durable bytes');
 }
 for(const id of ['generate-btn','publish-btn','rebuild-projection-btn','apply-day-btn'])check(f.nodes.get(id).disabled,true,id+' is fenced');
 check(f.nodes.get('coverall-print-link').hidden,true,'PDF ownership stays fenced');
 for(const path of ['/static-weekly/day-changes/batch','/static-weekly/rebuild-current-projection','/static-weekly/unknown-future-write']){
  await assert.rejects(f.page.state.actions.run(path,{}));checks++;
 }
 check(f.calls.length,1,'real actions boundary rejects altered and future competing writes');
 await f.page.refreshSnapshot();check(f.page.state.pending?.encoded,accepted?undefined:bytes,'read-only current refresh settles only known acceptance');
 if(!accepted){check([...f.map.values()],stored,'unknown current read preserves durable original');f.setMode('accept');await f.retry();}
 check(f.map.size,0,'exact acceptance/readback releases original');
}
console.log(JSON.stringify({status:'PASS_CURRENT_DAY_CHANGE_RETRY',checks,actualPageHandlers:true,
 scope:'Actual current page and durable actions client, inert transport/DOM. Legacy batch is selected explicitly; single employee staffing preparation is covered by the current binding contract. No reload durability, SQL, browser, phone or independent review claim.'}));
