import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync(new URL('../schedule-weekly.html',import.meta.url),'utf8');
const source=page.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/^init\(\)\.catch\([^\n]+$/m,'');
const helper=readFileSync(new URL('../memphis-recurring-confirmation.js',import.meta.url),'utf8');
const id=n=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
function fixture(){
 const nodes=new Map(),data=new Map(),calls=[];let accepted=null,readFailure=false,loseReply=false;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,open:false,dataset:{},
  addEventListener(){},classList:{toggle(){}},replaceChildren(){}});return nodes.get(id);};
 const snapshot=()=>({week_start:'2026-09-28',week_end:'2026-10-04',authority_revision:accepted?45:42,drafts:[],
  current_publication:{publication_id:accepted?id(5):id(9)},latest_projection:{projection_id:id(6)},projection_status:'current'});
 const context=vm.createContext({console,URL,URLSearchParams,AbortController,crypto:{randomUUID:()=>id(2)},
  localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
  navigator:{onLine:true,locks:{request:(_n,_o,work)=>work()}},location:{hash:'',search:''},
  document:{hidden:false,getElementById:node,querySelectorAll:()=>[]},
  window:{MemphisAuth:{getCSTDateString:()=> '2026-09-26',opsManagerAuthHeaders:async()=>({Authorization:'Bearer synthetic'})}},
  fetch:async(url,options)=>{
   calls.push({url,...options});let result;
   if(url.endsWith('/confirm')){
    const b=JSON.parse(options.body);accepted={state:'ACCEPTED',operationId:id(3),receipt:{schema:'static-weekly.recurring-confirmation-receipt.v1',
     operationId:id(3),managerId:id(1),confirmationKey:b.confirmation_key,previewDigest:b.preview_digest,effectiveStart:b.effective_start,
     sourceDigest:'b'.repeat(64),sourceId:id(4),publicationId:id(5),projectionId:id(6),requestDigest:'c'.repeat(64),lunchDocumentIdentity:'d'.repeat(64),
     authorityRevision:45,accepted:true,phoneDeliveryState:'PENDING',affectedPhonesUpdated:false}};
    if(loseReply)throw Error('synthetic response loss');result=accepted;
   }else if(url.includes('/confirmations/'))result=accepted||{state:'NOT_FOUND',confirmationKey:id(2)};
   else if(url.includes('/manager-snapshot?')){if(readFailure)throw Error('synthetic readback offline');result=snapshot();}
   else throw Error('unexpected request '+url);
   return{ok:true,json:async()=>({ok:true,data:result})};
  }});
 const run=code=>vm.runInContext(code,context);run(helper);context.window.MemphisRecurringConfirmation=context.MemphisRecurringConfirmation;run(source);
 const authSource=readFileSync(new URL('../memphis-auth.js',import.meta.url),'utf8');
 // Execute the actual optional original-manager header binding, not a mock of
 // that check. Session acquisition alone is synthetic.
 const authFunction=authSource.slice(authSource.indexOf('  async function opsManagerAuthHeaders('),authSource.indexOf('  async function clearSession('));
 run(`globalThis.currentSession={manager_id:'${id(1)}',token:'synthetic',device_id:'synthetic-device'};async function requireOpsManagerSession(){return currentSession;}function getDeviceId(){throw Error('unexpected device fallback');}`+authFunction);
 context.window.MemphisAuth.opsManagerAuthHeaders=context.opsManagerAuthHeaders;
 context.initialSnapshot=snapshot();run(`state.snapshot=initialSnapshot;state.baseUrl='https://synthetic.invalid';
  els.week_start.value='2026-09-28';els.service_date.value='2026-09-28';
  render=()=>{};clearCoverAllPdfs=()=>{};confirmAction=async()=>true;
  state.recurringCoordinator=window.MemphisRecurringConfirmation.create({api,managerId:'${id(1)}',
   onState:r=>{state.recurringConfirmationState=r;renderRecurringRecovery();setControls();}});
  state.recurringPreview={effectiveDate:'2026-09-28',authorityRevision:42,staffedPositions:6,previewDigest:'a'.repeat(64),candidateSourceDigest:'b'.repeat(64),decision:{gaps:{open:[{}],review:[]}}};
  state.recurringPreviewRequest={effective_start:'2026-09-28',expected_revision:42};`);
 return{run,node,calls,data,set readFailure(v){readFailure=v;},set loseReply(v){loseReply=v;}};
}
let checks=0;const same=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
assert.match(page,/<script src="\.\/memphis-recurring-confirmation\.js\?[^" ]+"><\/script>/);checks++;
{
 const f=fixture();await f.run('confirmRecurringStaffing()');same(f.calls.length,2,'one confirmation then current readback');
 same(f.calls.map(x=>x.method||'GET'),['POST','GET'],'no hidden publication sequence');
 same(f.calls[0].headers.Authorization,'Bearer synthetic','actual route uses manager auth');same(f.data.size,0,'verified readback settles own recovery');
 assert.match(f.node('status').textContent,/accepted as revision 45.*Current schedule matches.*Phone updates remain pending/);checks++;
}
{
 const f=fixture();f.readFailure=true;await f.run('confirmRecurringStaffing()');same(f.data.size,1,'accepted but unavailable readback preserves journal');
 assert.match(f.node('status').textContent,/was accepted.*current readback failed/);checks++;
 same(f.node('generate-btn').disabled,true,'uncertain readback blocks competing writes');same(f.node('recurring-recover-btn').disabled,false,'exact recovery remains available');
 f.readFailure=false;await f.run("recoverRecurringConfirmation('recover')");same(f.calls.filter(x=>x.method==='POST').length,1,'recovery does not publish again');same(f.data.size,0,'recovered current readback settles');
}
{
 const f=fixture();f.loseReply=true;await f.run('confirmRecurringStaffing()');same(f.data.size,1,'lost response retains exact key');
 await f.run("recoverRecurringConfirmation('retry')");same(f.calls.filter(x=>x.method==='POST').length,1,'retry checks committed status before any new send');same(f.data.size,0,'lost reply recovered through actual inline route');
}
{
 const f=fixture();f.run('confirmAction=async()=>false');await f.run('confirmRecurringStaffing()');same(f.calls.length,0,'manager cancellation makes no request');same(f.data.size,0,'cancel creates no journal');
}
{
 const f=fixture();f.run('confirmAction=async()=>{state.snapshot={...state.snapshot,authority_revision:43};return true;}');
 await f.run('confirmRecurringStaffing()');same(f.calls.length,0,'snapshot change during confirmation blocks stale command');assert.match(f.node('status').textContent,/preview changed/);checks++;
}
{
 const f=fixture();f.readFailure=true;await f.run('confirmRecurringStaffing()');const prior=f.calls.length;
 await assert.rejects(()=>f.run("api('/static-weekly/day-changes/batch',{method:'POST',body:'{}'})"),/saved recurring confirmation/);checks++;
 same(f.calls.length,prior,'competing write never reaches transport');
}
{
 const f=fixture();f.loseReply=true;await f.run('confirmRecurringStaffing()');const prior=f.calls.length;
 f.run(`currentSession={...currentSession,manager_id:'${id(999)}'};`);
 await f.run("recoverRecurringConfirmation('discardUnaccepted')");
 same(f.calls.length,prior,'manager change cannot request wrong-principal NOT_FOUND');same(f.data.size,1,'different manager cannot discard original recovery');
 assert.match(f.node('status').textContent,/different manager/);checks++;
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual inline manager confirm/recovery API and durable coordinator with synthetic DOM/auth/transport; not live acceptance'}));
