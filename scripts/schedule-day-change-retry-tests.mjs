import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../schedule-weekly.html',import.meta.url),'utf8');
const source=page.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/^init\(\)\.catch\([^\n]+$/m,'');
function fixture(){
 const nodes=new Map();let serial=0;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,hidden:false,addEventListener(){},classList:{toggle(){}},replaceChildren(){}});return nodes.get(id);};
 const checked=[{dataset:{calloutSlot:'slot-A'},disabled:false}],contractors=[],renderedSelections=[];
 const mutationButtons=[{dataset:{turnoverSlot:'slot-A'},disabled:false},{dataset:{reverseException:'exception-A'},disabled:true}];
 const context=vm.createContext({console,URL,URLSearchParams,crypto:{randomUUID:()=>`synthetic-${++serial}`},
  document:{getElementById:node,querySelectorAll:s=>s==='[data-callout-slot]:checked:not(:disabled)'?checked.filter(x=>!x.disabled):s==='[data-contractor-slot]:checked:not(:disabled)'?contractors.filter(x=>!x.disabled):s==='[data-callout-slot],[data-contractor-row] input'?[...checked,...contractors,...renderedSelections]:s==='[data-turnover-slot],[data-reverse-exception]'?mutationButtons:[]},
  window:{lucide:{createIcons(){}}}});
 const run=code=>vm.runInContext(code,context);run(source);
 run(`globalThis.calls=[];globalThis.confirmations=0;globalThis.refreshes=0;globalThis.failPosts=0;globalThis.failRefreshes=0;
  globalThis.approve=true;globalThis.confirmHook=()=>{};globalThis.postHook=async()=>{};globalThis.pdfs=0;
  globalThis.actualPrepareCoverAllPdfs=prepareCoverAllPdfs;globalThis.actualApi=api;
  prepareCoverAllPdfs=async()=>{pdfs++;};
  state.snapshot={week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:7,drafts:[],current_publication:{publication_id:'pub-A',version_id:'version-A'}};
  els.week_start.value='2026-09-21';els.service_date.value='2026-09-24';els.absence_type.value='daily_absence';
  api=async(path,options)=>{calls.push({path,encoded:options.body});await postHook();if(failPosts-->0)throw new Error('synthetic unknown outcome');return {revision:9};};
  confirmAction=async()=>{confirmations++;await confirmHook();return approve;};
  refreshSnapshot=async()=>{refreshes++;if(failRefreshes-->0)throw new Error('synthetic read failure');};`);
 return {run,node,checked,contractors,renderedSelections,mutationButtons,context,json:expression=>JSON.parse(run(`JSON.stringify(${expression})`))};
}
function contractor(lunchEnd='12:00'){return {disabled:false,dataset:{contractorSlot:'contractor-A'},closest:()=>({querySelector:selector=>({value:{'[data-shift-start]':'07:00','[data-shift-end]':'15:00','[data-lunch-start]':'11:00','[data-lunch-end]':lunchEnd}[selector]})})};}
let checks=0;
function check(value,expected,message){assert.deepEqual(value,expected,message);checks++;}
{
 const f=fixture();f.run('failPosts=1');await f.run('applyDayChanges()');
 check(f.run('state.dayChangeRequest.accepted'),false,'unknown outcome stays pending');
 check(f.node('service-date').disabled,true,'date is locked to the uncertain command');
 check(f.node('absence-type').disabled,true,'reason cannot be changed while outcome unknown');
 check(f.checked[0].disabled,true,'original selections remain locked');
 assert.match(f.node('apply-day-btn').textContent,/Retry same 2026-09-24/);checks++;
 // Hostile DOM/snapshot edits still cannot alter the encoded original retry.
 f.node('service-date').value='2026-09-25';f.run('state.snapshot.authority_revision=99');f.checked[0].dataset.calloutSlot='slot-B';
 await f.run('applyDayChanges()');const calls=f.json('calls');
 check(calls.length,2,'one attempted command plus one exact retry');
 check(calls[0],calls[1],'same key, exact body and endpoint despite edited controls');
 check(JSON.parse(calls[1].encoded).expected_revision,7,'never silently rebase uncertain command');
 check(f.run('confirmations'),1,'confirmation is not repeated on same operation retry');
 check(f.run('state.dayChangeRequest'),null,'clear recovery only after successful refresh');
 check(f.node('service-date').disabled,false,'release date control after verified response and refresh');
}
{
 const f=fixture();f.run('failRefreshes=1');await f.run('applyDayChanges()');
 check(f.run('state.dayChangeRequest.accepted'),true,'successful mutation response remains known after read failure');
 assert.match(f.node('apply-day-btn').textContent,/Refresh saved 2026-09-24/);checks++;
 await f.run('applyDayChanges()');check(f.json('calls').length,1,'accepted command is not posted again to repair a read failure');
 check(f.run('refreshes'),2,'retry repairs snapshot read');check(f.run('confirmations'),1,'no second confirmation');
}
{
 const f=fixture();f.run('approve=false');await f.run('applyDayChanges()');
 check(f.json('calls').length,0,'cancel has no authoritative write');check(Boolean(f.run('state.dayChangeRequest')),false,'cancel has no pending command');
}
{
 const f=fixture();f.run("confirmHook=()=>{els.service_date.value='2026-09-25';state.snapshot.authority_revision=98;}");
 await f.run('applyDayChanges()');const body=JSON.parse(f.json('calls')[0].encoded);
 check(body.service_date,'2026-09-24','confirmed date captured before asynchronous dialog');check(body.expected_revision,7,'confirmed revision captured before asynchronous dialog');
 check(body.operations[0].payload.slotId,'slot-A','original selected person-position input is retained');
}
{
 const f=fixture();f.run('globalThis.finishPost=null;postHook=()=>new Promise(resolve=>{finishPost=resolve;})');
 const first=f.run('applyDayChanges()');await Promise.resolve();await Promise.resolve();
 check(f.run('state.busy'),true,'first request owns mutation while HTTP pending');
 await f.run('applyDayChanges()');check(f.json('calls').length,1,'double click cannot dispatch competing request');
 f.run('finishPost()');await first;check(f.run('confirmations'),1,'double click does not open new confirmation');
}
{
 const f=fixture();f.run('failPosts=3');for(let i=0;i<4;i++)await f.run('applyDayChanges()');
 const calls=f.json('calls');check(calls.length,4,'three unknown responses then recovery');
 check(new Set(calls.map(x=>x.encoded)).size,1,'all ambiguous retries retain exact bytes');
 check(f.run('confirmations'),1,'repeated network loss is still one confirmed command');
}
{
 const f=fixture();f.contractors.push(contractor());f.run('failPosts=1');await f.run('applyDayChanges()');
 check(f.run('pdfs'),0,'unknown write is not represented by downloadable PDFs');
 await f.run('applyDayChanges()');const calls=f.json('calls'),body=JSON.parse(calls[0].encoded);
 check(calls[0],calls[1],'capacity and actual lunch share the exact retry body');
 check(body.operations.map(x=>x.operation),['exception','cover_all','exception'],'absence/capacity/lunch remain one atomic batch');
 check(body.operations[2].ends_at,'12:00','captured actual lunch end survives retry');
 check(f.run('pdfs'),1,'PDF preparation follows accepted write plus successful refresh');
}
{
 const f=fixture();f.contractors.push(contractor());f.run("refreshSnapshot=async()=>{refreshes++;els.service_date.value='2026-09-25';}");
 await f.run('applyDayChanges()');check(f.run('pdfs'),0,'never substitute another selected date for accepted PDF output');
 assert.match(f.node('status').textContent,/Select 2026-09-24/);checks++;
 check(f.run('state.dayChangeRequest'),null,'PDF date warning cannot cause a repeated schedule mutation');
}
{
 const f=fixture();f.contractors.push(contractor());f.run("prepareCoverAllPdfs=async()=>{throw new Error('synthetic PDF failure');}");
 await f.run('applyDayChanges()');check(f.json('calls').length,1,'PDF failure does not replay schedule write');
 check(f.run('state.dayChangeRequest'),null,'accepted command is settled separately from PDF download');
 assert.match(f.node('status').textContent,/Schedule changes saved\. PDFs need attention/);checks++;
}
{
 const f=fixture();f.contractors.push(contractor('11:30'));await assert.rejects(()=>f.run('applyDayChanges()'),/actual CoverAll shift/);checks++;
 check(f.run('confirmations'),0,'invalid contractor data rejected before confirmation');
 check(f.json('calls').length,0,'invalid data never mutates authority');
}
// An unresolved command owns ALL mutation controls and handler entry points,
// including a known accepted command whose authoritative readback failed.
// R1-C: a successful snapshot render happens BEFORE pending ownership clears.
// New DOM controls reflect business rules; the temporary fence must preserve them.
for(const accepted of [false,true]){
 const f=fixture();f.run(accepted?'failRefreshes=1':'failPosts=1');await f.run('applyDayChanges()');
 const original=f.json('calls')[0];
 f.context.renderAcceptedSelectionControls=()=>{
  f.checked.splice(0,f.checked.length);f.contractors.splice(0,f.contractors.length);
  f.renderedSelections.splice(0,f.renderedSelections.length,
   {dataset:{calloutSlot:'already-applied'},disabled:true},
   {dataset:{calloutSlot:'eligible-other'},disabled:false},
   ...['contractorSlot','shiftStart','shiftEnd','lunchStart','lunchEnd'].map(key=>({dataset:{[key]:'contractor-B'},disabled:false})),
   {dataset:{contractorSlot:'business-ineligible'},disabled:true});
 };
 f.run('refreshSnapshot=async()=>{refreshes++;renderAcceptedSelectionControls();setControls();setControls();}');
 await f.run('applyDayChanges()');
 check(f.run('state.dayChangeRequest'),null,'clear pending only after read succeeds');
 check(f.renderedSelections.map(n=>n.disabled),[true,false,false,false,false,false,false,true],
  'restore newly rendered callout/contractor/shift/lunch business eligibility after recovery');
 check(f.renderedSelections.every(n=>n.dataset.pendingMutationDisabled===undefined),true,'remove temporary fence metadata');
 check(f.node('service-date').disabled,false,'fixed controls recover too');
 check(f.mutationButtons.map(n=>n.disabled),[false,true],'do not enable business-disabled roster actions');
 const calls=f.json('calls');check(calls.length,accepted?1:2,'known acceptance never sends another write');
 check(calls[calls.length-1],original,'unknown replay preserves exact original command bytes');
 check(f.run('confirmations'),1,'no new confirmation for read repair');
 f.run('setControls()');
 check(f.renderedSelections.map(n=>n.disabled),[true,false,false,false,false,false,false,true],'repeated idle refresh preserves business eligibility');
}
for(const accepted of [false,true]){
 for(const handler of ['generateDraft()','publishDraft()','rebuildCurrentProjection()',
  'reverseChange({target:{closest:()=>({dataset:{reverseException:"exception-A"}})}})',
  ...['departed','replace','fill'].map(mode=>`openTurnoverDialog({target:{closest:()=>({dataset:{turnoverSlot:"slot-A",turnoverMode:"${mode}"}})}})`),
  ...['departed','replace','fill'].map(mode=>`els.turnover_mode.value="${mode}";submitTurnover({preventDefault(){}})`),
  'actualPrepareCoverAllPdfs()']){
  const f=fixture();f.run(accepted?'failRefreshes=1':'failPosts=1');await f.run('applyDayChanges()');
  const original=f.run('state.dayChangeRequest.encoded');
  f.run(`state.snapshot.drafts=[{version_id:'draft-A',revision:1}];
    state.snapshot.exceptions=[{id:'exception-A',type:'daily_absence',serviceDate:'2026-09-24'}];
    state.snapshot.projection_status='stale_staffing_change';state.snapshot.latest_projection={projection_id:'projection-A'};setControls();`);
  for(const id of ['generate-btn','publish-btn','rebuild-projection-btn','turnover-submit','coverall-pdfs-btn'])
    check(f.node(id).disabled,true,`${id} disabled while ${accepted?'accepted read':'unknown write'} pending`);
  await f.run(handler);
  check(f.json('calls').length,1,handler+' cannot dispatch a competing mutation or stale PDF');
  check(f.run('confirmations'),1,handler+' cannot ask for a competing confirmation');
  check(f.run('state.dayChangeRequest.encoded'),original,handler+' cannot clear or rebase the pending command');
 }
}
{
 const f=fixture();f.run('failPosts=1');await f.run('applyDayChanges()');
 f.run('setControls();setControls()');check(f.mutationButtons.map(b=>b.disabled),[true,true],'repeated control refresh keeps roster and reverse buttons fenced');
 await f.run('applyDayChanges()');check(f.mutationButtons.map(b=>b.disabled),[false,true],'recovery restores prior eligibility without enabling a business-disabled action');
}
for(const accepted of [false,true]){
 const f=fixture();f.run(accepted?'failRefreshes=1':'failPosts=1');await f.run('applyDayChanges()');
 f.run(`globalThis.transportCalls=[];window.MemphisAuth={opsManagerAuthHeaders:async()=>({})};
 fetch=async(path,options)=>{transportCalls.push({path,body:options.body});return{ok:true,json:async()=>({ok:true,data:{}})};};`);
 for(const path of ['/static-weekly/drafts/draft-A/publish','/static-weekly/employees/departed','/static-weekly/unknown-future-write']){
  await assert.rejects(()=>f.run(`actualApi(${JSON.stringify(path)},{method:'POST',body:'{}'})`),/pending day change/);checks++;
 }
 await assert.rejects(()=>f.run("actualApi('/static-weekly/day-changes/batch',{method:'POST',body:'{}'})"),/pending day change/);checks++;
 check(f.json('transportCalls').length,0,'transport fence rejects unknown/new paths and altered replay before auth/fetch');
 await f.run("actualApi('/static-weekly/manager-snapshot')");
 check(f.json('transportCalls').length,1,'read-only refresh remains allowed without clearing ownership');
 if(accepted){await assert.rejects(()=>f.run("actualApi('/static-weekly/day-changes/batch',{method:'POST',body:state.dayChangeRequest.encoded})"),/pending day change/);checks++;}
 else{await f.run("actualApi('/static-weekly/day-changes/batch',{method:'POST',body:state.dayChangeRequest.encoded})");check(f.json('transportCalls').length,2,'only exact unknown command is replayable');}
}
console.log(JSON.stringify({status:'PASS_SAME_PAGE_RETRY_ONLY',checks,actualPageHandlers:true,
 notProven:['reload durability','absence preview/date-window','manager change','PostgreSQL','phone convergence','independent review']}));
