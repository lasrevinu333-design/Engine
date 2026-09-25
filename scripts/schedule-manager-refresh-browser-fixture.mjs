import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Own a loopback-only synthetic API. No browser is launched, no real auth or data.
const source=readFileSync(new URL('../schedule-weekly.html',import.meta.url),'utf8');
const sourceHash=createHash('sha256').update(source).digest('hex');
let revision=7,reads=0,mutations=0;
const snapshot=()=>({week_start:'2026-09-21',week_end:'2026-09-27',authority_revision:revision,drafts:[],exceptions:[],
 current_publication:{publication_id:'synthetic-publication',version_id:'synthetic-version'},
 sources:[{source_id:'synthetic-source'}],latest_projection:{projection_id:'synthetic-projection-'+revision,assignments:[]},projection_status:'current',assignments:[],
 roster:[{slot_id:'SYNTHETIC_POSITION',slot_label:'Test Position',contractor_capacity:false,
  incumbencies:[{person_id:'SYNTHETIC_PERSON',person_name:'Synthetic Test Custodian',effective_start:'2026-01-01',effective_end:null}]}],
 availability:[0,1,2,3,4,5,6].map(day=>({slot_id:'SYNTHETIC_POSITION',day_of_week:day,availability_state:'working'}))});
const harness=`
const fixtureChecks=[];function fixtureAssert(ok,label){if(!ok)throw Error(label);fixtureChecks.push(label);}
async function fixtureWait(test,timeout=3000){const until=performance.now()+timeout;while(!test()){if(performance.now()>until)throw Error('bounded fixture wait expired');await new Promise(resolve=>setTimeout(resolve,10));}}
document.getElementById('fixture-run').onclick=async()=>{
 try{
 fixtureAssert(state.snapshot?.authority_revision===7,'actual authenticated-startup fixture rendered revision7');
 fixtureAssert(document.getElementById('revision-count').textContent==='7','real revision DOM matches startup');
 const choice=document.querySelector('[data-callout-slot]');fixtureAssert(!!choice,'actual renderer created employee call-out checkbox');choice.click();
 fixtureAssert(choice.checked&&state.scheduleInputDirty,'actual checkbox change protects unconfirmed selection');
 await fetch('/fixture/advance');window.dispatchEvent(new Event('online'));await requestScheduleRefresh();
 fixtureAssert(state.snapshot.authority_revision===7&&choice.checked,'reconnect keeps unconfirmed choice and prior revision');
 fixtureAssert(state.scheduleRefreshQueued===true,'deferred refresh remains visibly unapplied in controller');
 await loadSnapshot();await fixtureWait(()=>!state.scheduleRefreshRunning);fixtureAssert(state.snapshot.authority_revision===8,'explicit read applies newer accepted snapshot');
 fixtureAssert(document.getElementById('revision-count').textContent==='8','new revision actually rendered');
 fixtureAssert(!document.querySelector('[data-callout-slot]').checked&&!state.scheduleInputDirty,'explicit refresh resets only unconfirmed page selection');
 state.dayChangeRequest={date:'2026-09-24',encoded:'SYNTHETIC_EXACT_COMMAND',accepted:false};setControls();
 const pending=JSON.stringify(state.dayChangeRequest);await fetch('/fixture/advance');
 await requestScheduleRefresh();fixtureAssert(JSON.stringify(state.dayChangeRequest)===pending,'unknown write retains exact pending command');
 fixtureAssert(state.snapshot.authority_revision===8,'automatic read cannot rebase unresolved command');
 fixtureAssert(document.getElementById('apply-day-btn').textContent.includes('Retry same'),'actual recovery control keeps retry ownership');
 state.dayChangeRequest=null;setControls();await requestScheduleRefresh();
 fixtureAssert(state.snapshot.authority_revision===9&&document.getElementById('revision-count').textContent==='9','resolved synthetic command allows current revision9 to render');
 fixtureAssert(!document.querySelector('[data-callout-slot]').disabled,'eligible real DOM selection is restored');
 const reverted=document.querySelector('[data-callout-slot]');reverted.click();await requestScheduleRefresh();
 fixtureAssert(state.scheduleInputDirty&&state.scheduleRefreshQueued,'new checked choice retains queued refresh');
 reverted.click();await fixtureWait(()=>!state.scheduleRefreshRunning&&!state.scheduleRefreshQueued);
 fixtureAssert(!state.scheduleInputDirty,'actual checkbox revert resumes queued refresh');
 els.turnover_dialog.showModal();els.turnover_reason.value='Synthetic discarded edit';els.turnover_reason.dispatchEvent(new Event('input',{bubbles:true}));
 await requestScheduleRefresh();closeTurnoverDialog();await fixtureWait(()=>!state.scheduleRefreshRunning&&!state.scheduleRefreshQueued);
 fixtureAssert(!state.scheduleInputDirty&&!els.turnover_dialog.open,'cancelled real turnover dialog releases refresh');
 const generation=generateDraft();fixtureAssert(els.action_confirm_dialog.open,'actual Generate opens real confirmation');
 await requestScheduleRefresh();els.action_confirm_dialog.close('confirm');await generation;
 await fixtureWait(()=>!state.scheduleRefreshRunning&&!state.scheduleRefreshQueued);
 fixtureAssert(state.snapshot.authority_revision===10,'confirmed Generate was accepted before queued automatic read');
 const confirmed=await(await fetch('/fixture/telemetry')).json();fixtureAssert(confirmed.mutations===1,'confirmed command produced exactly one synthetic POST');
 const priorAuth=window.MemphisAuth.opsManagerAuthHeaders;let releaseAuth;
 window.MemphisAuth.opsManagerAuthHeaders=()=>new Promise(resolve=>{releaseAuth=resolve;});
 try{
  const timedRead=requestScheduleRefresh();await fixtureWait(()=>Boolean(releaseAuth));
  const began=performance.now();await fixtureWait(()=>!state.scheduleRefreshRunning,18000);await timedRead;
  fixtureAssert(performance.now()-began>=14000,'actual fifteen-second timeout exercised, not accelerated');
  fixtureAssert(!state.busy&&state.scheduleRefreshQueued,'real abort event releases auth-blocked controls and preserves pending refresh');
  releaseAuth({});await Promise.resolve();await Promise.resolve();
  const after=await(await fetch('/fixture/telemetry')).json();fixtureAssert(after.reads===confirmed.reads,'late auth performs no scheduler fetch');
  fixtureAssert(state.snapshot.authority_revision===10,'late auth preserves current rendered revision');
 }finally{window.MemphisAuth.opsManagerAuthHeaders=priorAuth;releaseAuth?.({});}
 await requestScheduleRefresh();fixtureAssert(!state.scheduleRefreshQueued,'subsequent authorized read recovers normally');
 const telemetry=await (await fetch('/fixture/telemetry')).json();fixtureAssert(telemetry.reads>=3,'only synthetic snapshot reads observed');
 window.dispatchEvent(new PageTransitionEvent('pagehide'));fixtureAssert(!state.scheduleRefreshTimer,'pagehide clears actual interval');
 document.getElementById('fixture-result').textContent=JSON.stringify({status:'PASS',checks:fixtureChecks.length,results:fixtureChecks,source_sha256:${JSON.stringify(sourceHash)},limits:'Real Chrome DOM and actual inline scheduler/renderer functions. Synthetic loopback API and manager auth. No production, SQL, real manager or phone delivery proof.'},null,2);
 }catch(error){document.getElementById('fixture-result').textContent=JSON.stringify({status:'FAIL',error:String(error),checks:fixtureChecks.length,results:fixtureChecks});}
};`;
const bootstrap=`<script>window.MemphisAuth={requireOpsManagerSession:async()=>{},getCSTDateString:()=> '2026-09-24',opsManagerAuthHeaders:async()=>({})};window.lucide={createIcons(){}};</script>`;
const server=createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'none'; object-src 'none'");
 if(req.url==='/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  const origin='http://127.0.0.1:'+server.address().port;
  const page=source.replace(/<script src="[^"]*"><\/script>/g,'').replace('https://memphis-zoo-mcp.onrender.com/scheduler-runtime-config',origin+'/scheduler-runtime-config')
   .replace('<script>','<div style="position:relative;background:#fff;color:#111;padding:16px"><b>OWNED SYNTHETIC BROWSER FIXTURE</b><button id="fixture-run">Run manager refresh checks</button><pre id="fixture-result">NOT RUN</pre></div>'+bootstrap+'<script>')
   .replace('</body>','<script>'+harness+'</script></body>');res.end(page);return;
 }
 res.setHeader('Content-Type','application/json');
 if(req.url==='/scheduler-runtime-config'){res.end(JSON.stringify({ok:true,data:{public_url:'http://127.0.0.1:'+server.address().port}}));return;}
 if(req.url?.startsWith('/static-weekly/manager-snapshot?')){reads++;res.end(JSON.stringify({ok:true,data:snapshot()}));return;}
 if(req.url==='/static-weekly/drafts/replacement'&&req.method==='POST'){mutations++;revision++;res.end(JSON.stringify({ok:true,data:{synthetic:true}}));return;}
 if(req.url==='/fixture/advance'){revision++;res.end(JSON.stringify({revision}));return;}
 if(req.url==='/fixture/telemetry'){res.end(JSON.stringify({reads,revision,mutations}));return;}
 res.writeHead(404);res.end(JSON.stringify({ok:false,error:'No fixture route'}));
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({owned:'manager-refresh browser fixture',pid:process.pid,url:'http://127.0.0.1:'+server.address().port+'/',source_sha256:sourceHash,cleanup:'navigate exact owned tab away; terminate this server'})));
const expiry=setTimeout(()=>{server.close();server.closeAllConnections();},15*60*1000);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{clearTimeout(expiry);server.close(()=>process.exit(0));server.closeAllConnections();});
