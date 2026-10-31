const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const W=path.resolve(root,'../solo-main-return-20261028');
const out=path.join(__dirname,'browser-actual03');fs.mkdirSync(out,{recursive:false});
const read=p=>fs.readFileSync(p,'utf8'),load=p=>JSON.parse(read(path.join(W,p))),clone=x=>JSON.parse(JSON.stringify(x));
const prepared=load('OWNED_NATIVE_MANAGER_SAVE_04_20261030/PREPARED_OR_PRIOR.json');
const accepted=load('OWNED_NATIVE_MANAGER_SAVE_04_20261030/ACCEPTED.json');
const snapshot=load('OWNED_NATIVE_MANAGER_SAVE_04_20261030/CURRENT_MANAGER_SNAPSHOT.json');
const base='http://127.0.0.1:41987',calls=[],checks=[];
const check=(condition,label)=>{assert.ok(condition,label);checks.push(label);};
const result={scope:'PRIVATE_HEADLESS_FIXTURE_BROWSER_ONLY',productionWritten:false,genuineManagerBrowser:false,SQLExecuted:false,deviceProof:false,checks,source_head:'6dfd5f4 plus uncommitted frontend delta',fixtureTransformations:['Read-only display uses exact saved revision5 CURRENT_MANAGER_SNAPSHOT unchanged.','PTO lifecycle fixture rewinds only revision metadata to4 and removes second accepted PTO exception/target from revision5 snapshot for entry; this is not an actual pre-accept SQL snapshot.','PREPARED response is exact saved native response; ACCEPTED GET envelope is assembled from that response and exact accepted receipt. Unknown transport failure is synthetic.'],sources:{}};
for(const f of ['schedule-weekly.js','memphis-scheduler-actions.js','memphis-approved-schedule.js','schedule-weekly.html']){const b=fs.readFileSync(path.join(root,f));result.sources[f]={sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};}
let browser;
async function open(mode='current'){
 const context=await browser.newContext({viewport:{width:1450,height:1000},serviceWorkers:'block'});
 const manager=prepared.prepared_by_manager_id;
 await context.addInitScript(({manager,base})=>{window.fixtureSession={role:'ops_manager',manager_id:manager,credential_id:'synthetic-fixture-credential',device_id:'synthetic-browser',token:'synthetic-never-network',expires_at:'2099-01-01T00:00:00Z',read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true,manage_absences:true}};window.MemphisAuth={backendOrigin:base,readSession:()=>window.fixtureSession,requireOpsManagerSession:async()=>{},opsManagerAuthHeaders:async()=>({Authorization:'Bearer synthetic-never-network'}),getCSTDateString:()=> '2026-11-03'};window.lucide={createIcons(){}};},{manager,base});
 let phase='PREPARING',confirmed=false,unknown=mode==='unknown';const before=clone(snapshot);
 before.authority_revision=prepared.expected_revision;before.projection_authority_revision=prepared.expected_revision;
 const target=before.roster.find(r=>r.incumbencies.some(i=>i.person_id===prepared.semantic_body.employeeId)).slot_id;
 before.exceptions=before.exceptions.filter(e=>!(e.type==='pto'&&e.serviceDate===prepared.semantic_body.startDate&&e.payload?.slotId===target));
 before.canonical_staffing_absences=before.canonical_staffing_absences.filter(r=>r.staffingAbsenceId!==prepared.operation_id);
 const json=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base){calls.push({blockedExternal:url.origin});return route.fulfill({status:200,body:''});}
  if(url.pathname==='/scheduler-runtime-config')return json(route,{ok:true,data:{public_url:base}});
  if(url.pathname.startsWith('/static-weekly/')){
   calls.push({mode,path:url.pathname,method:request.method(),body:request.postData()});
   if(url.pathname==='/static-weekly/manager-snapshot')return json(route,{ok:true,data:mode==='current'||confirmed?snapshot:before});
   if(url.pathname==='/static-weekly/approved-choices')return json(route,{ok:true,data:{schema:'custodial.approved-schedule-choices.v1',initial:[]}});
   const command='/static-weekly/staffing-commands';
   if(url.pathname===command){const b=request.postDataJSON();assert.equal(b.employee_id,prepared.semantic_body.employeeId);assert.equal(b.start_date,prepared.semantic_body.startDate);assert.equal(b.absence_kind,'pto');return json(route,{ok:true,data:{operation_id:prepared.operation_id,expected_revision:prepared.expected_revision,semantic_digest:prepared.semantic_digest}});}
   if(url.pathname===command+'/'+prepared.operation_id+'/prepare'){phase='PREPARED';return json(route,{ok:true,data:{prepared:true}});}
   if(url.pathname===command+'/'+prepared.operation_id+'/confirm'){
    const b=request.postDataJSON();assert.equal(b.preview_digest,prepared.preview_digest);confirmed=true;
    if(unknown){unknown=false;return route.abort('failed');}return json(route,{ok:true,data:accepted});
   }
   if(url.pathname===command+'/'+prepared.operation_id){
    const value=clone(prepared);if(confirmed){Object.assign(value,{state:'ACCEPTED',accepted_receipt:accepted,accepted_revision:accepted.authority_revision,accepted_at:accepted.recorded_at});}
    else if(phase==='PREPARING')value.state='PREPARING';
    return json(route,{ok:true,data:value});
   }
   throw Error('Unexpected fixture API '+url.pathname);
  }
  if(['/memphis-auth.js','/memphis-ui.js'].includes(url.pathname))return route.fulfill({status:200,contentType:'text/javascript',body:''});
  const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))return route.fulfill({status:403,body:''});
  if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({status:200,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream',body:fs.readFileSync(file)});
  return route.fulfill({status:404,body:''});
 });
 const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>result.pageErrors=(result.pageErrors||[]).concat(String(e)));
 await page.goto(base+'/schedule-weekly.html?date=2026-11-03',{waitUntil:'load'});
 try{await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Loaded '));}catch(e){result.failurePage=await page.locator('body').innerText();await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw e;}
 return{context,page,target};
}
(async()=>{
 try{
  // Real source predicates, exact native preview, and rolling boundary negatives.
  const c={URL,TextEncoder};vm.runInNewContext(read(path.join(root,'memphis-approved-schedule.js')),c);vm.runInNewContext(read(path.join(root,'memphis-scheduler-actions.js')),c);
  const r={body:{command_kind:'absence',employee_id:prepared.semantic_body.employeeId,start_date:prepared.semantic_body.startDate,end_date:prepared.semantic_body.endDate,absence_kind:'pto',client_prepare_key:'10000000-0000-4000-8000-000000000001',expected_revision:prepared.expected_revision},managerId:prepared.prepared_by_manager_id,weekBindings:prepared.publication_vector.weeks,command:{operationId:prepared.operation_id,semanticDigest:prepared.semantic_digest}};
  check(c.MemphisSchedulerActions.validateStaffingPreview(prepared,r)===prepared,'Exact saved native PREPARED response passes actual selected validator');
  const rolling=clone(snapshot);rolling.week_start='2026-10-30';rolling.week_end='2026-11-05';rolling.approved_manual_schedule.days=Array.from({length:7},(_,i)=>({serviceDate:new Date(Date.UTC(2026,9,30+i)).toISOString().slice(0,10)}));
  check(c.MemphisSchedulerActions.staffingSnapshotCovers(rolling,'2026-11-02',r.body),'Bound rolling seven-day frame covers entire requested PTO day');
  check(!c.MemphisSchedulerActions.staffingSnapshotCovers(rolling,'2026-11-02',{start_date:'2026-11-03',end_date:'2026-11-08'}),'Overlap alone cannot truncate a longer original request');
  rolling.approved_manual_schedule.projectionId='10000000-0000-4000-8000-000000000099';check(!c.MemphisSchedulerActions.staffingSnapshotCovers(rolling,'2026-11-02',r.body),'Wrong manual projection binding remains refused');
  browser=await chromium.launch({headless:true,args:['--disable-background-networking']});
  {const {context,page}=await open();
   check(await page.locator('#week-head th').count()===8,'Actual page renders all seven source-aligned civil dates');
   check((await page.locator('#week-body').innerText()).includes('Zoo Wide Coverage'),'Actual saved current view shows Zoo Wide Coverage');
   check((await page.locator('#week-body').innerText()).includes('Full-hour lunch relief:'),'Actual saved current view names full-hour relief duties');
   check(await page.evaluate(()=>state.snapshot.authority_revision)===5,'Exact saved revision5 snapshot rendered unchanged');
   await page.screenshot({path:path.join(out,'current-manager-week.png'),fullPage:true});await context.close();}
  for(const mode of ['confirm','unknown']){const {context,page,target}=await open(mode);
   await page.locator('#absence-type').selectOption('pto');await page.locator(`[data-callout-slot="${target}"]`).check();await page.locator('#apply-day-btn').click();
   await page.waitForFunction(()=>state.staffingPreview?.value.state==='PREPARED');
   check(await page.locator('#approved-preview-rows tr').count()===prepared.preview.weeks[0].assignments.length,mode+': complete exact saved native prepared duties rendered');
   check((await page.locator('#approved-preview-capacity-rows').innerText()).includes('Full-hour lunch relief'),mode+': preview names relief periods');
   await page.screenshot({path:path.join(out,mode+'-prepared-preview.png'),fullPage:true});
   await page.locator('#staffing-confirm-btn').click();await page.locator('#action-confirm-accept').click();
   if(mode==='unknown'){
    await page.waitForFunction(()=>state.pending?.command?.confirmationAttempted===true&&!state.busy);
    const pending=await page.evaluate(()=>state.pending);check(pending.encoded===JSON.stringify(pending.body),'Unknown confirmation retains original exact encoded body');
    const postsBefore=calls.filter(x=>x.mode===mode&&x.path?.endsWith('/confirm')).length;
    await page.reload();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Loaded '));
    await page.locator('#scheduler-retry').click();
    await page.waitForFunction(()=>state.pending===null);
    check(calls.filter(x=>x.mode===mode&&x.path?.endsWith('/confirm')).length===postsBefore,'Reload/recovery reads exact accepted original without repeating confirmation');
   }else await page.waitForFunction(()=>state.pending===null);
   check(await page.evaluate(()=>state.snapshot.authority_revision)===5,mode+': accepted current projection readback clears only verified pending control');
   check(calls.filter(x=>x.mode===mode&&x.path?.endsWith('/confirm')).length===1,mode+': exactly one fixture confirmation POST');
   await context.close();
  }
  check(!result.pageErrors?.length,'No uncaught page errors');result.status='PASS';
 }catch(e){result.status='FAIL';result.error=String(e.stack||e);if(browser)for(const c of browser.contexts())for(const p of c.pages()){result.lastPage=await p.locator('body').innerText();result.lastPending=await p.evaluate(()=>state.pending).catch(()=>null);await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});}process.exitCode=1;}
 finally{if(browser)await browser.close();result.browserClosed=true;result.calls=calls;fs.writeFileSync(path.join(out,'RESULT.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,checks:checks.length,error:result.error,output:out}));}
})();
