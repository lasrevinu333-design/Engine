import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
// Separate owning print workflow. No Home/viewport groups or rewritten assets.
if(process.argv.includes('--coverall-owner-lifetime-only')||process.argv.includes('--coverall-owner-lifetime-tail-only')){
  const tailOnly=process.argv.includes('--coverall-owner-lifetime-tail-only');
  const {createHash}=await import('node:crypto');
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  const assetPins=[
    ['coverall-print.html','2f3c7365cbcb0a72cdad0e7a780019c89792823af15337c10993865e6aee03ce','text/html'],
    ['coverall-print.js','2e9eeeb8c0a652e727483fcb5a2ec3808675969b314c8926d1386d51e4060990','application/javascript'],
    ['memphis-auth.js','4b3ab53e1fcf593bf5dfd285aa53a3656b6d6917b8036594b45990880c5484ff','application/javascript'],
    ['memphis-scheduler-actions.js','d9d2db2aab3d7e8552d1fbf8a6017524a1dc952756534fe85b6ccb39ac9d47d1','application/javascript'],
    ['memphis-ui.js','cf29ef7e8be9bc4c42b98cff5bbc0556b96264f07cbf204397ae9105c12af5ca','application/javascript'],
    ['memphis-ui.css','dce51f36c6a051dcb4e474821bce0f49d53de106f75902ad05eccfff339580ae','text/css'],
    ['coverall-print.css','d5af5e81cab89fffd8068bb86b17b97a18b8cb664bc563c77a8766dcb0d738f5','text/css'],
    ['dashboard_tiger_icon.svg','9ee5266fc4dfe0e9b2b49eacd93a1ae2bbbab40c45bcb6ab295d46aeedc3a403','image/svg+xml'],
    ['mobile/src/custodial/protected-browser-admission.js','f988eb79b03683110f0b43175df34789f165fcfeb500edaa093919e5687ee757','application/javascript'],
    ['mobile/src/custodial/protected-browser-inventory.js','56d4917ee6e04b96dcf891f7c4d1c42d3cbeed17d060ac31471af35984fde826','application/javascript']
  ];
  const assets=new Map(assetPins.map(([name,sha256,contentType])=>{
    const body=readFileSync(new URL('../'+name,import.meta.url));
    assert.equal(digest(body),sha256,name+' frozen input');return['/'+name,{body,contentType}];
  }));
  const id=n=>'98000000-0000-4000-8000-'+String(n).padStart(12,'0'),date='2026-10-12',week=date,revision=7;
  const session={role:'ops_manager',manager_id:id(9),credential_id:id(10),device_id:'SYNTHETIC_COVERALL_BROWSER',
    token:'SYNTHETIC_BROWSER_FIXTURE_NOT_A_CREDENTIAL',expires_at:'2099-01-01T00:00:00.000Z',
    access_level:'full_access',read_only:false,roles:['OPS_MANAGER'],
    permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true,manage_coverall:true}};
  const snapshot={week_start:week,projection_status:'current',authority_revision:revision,
    current_publication:{publication_id:id(2)},latest_projection:{projection_id:id(3),replay_digest:'b'.repeat(64)}};
  const text='SYNTHETIC CoverAll route — English / Español. Not an accepted real schedule.';
  const file=language=>{const bytes=Buffer.from('%PDF-1.4\nSYNTHETIC '+language+' retained fixture bytes\n%%EOF\n');
    return{language,filename:'CoverAll_'+date+'_r'+revision+'_'+language+'.pdf',sha256:digest(bytes),base64:bytes.toString('base64')};};
  const pair={schema:'custodial.coverall-pdf-pair.v1',document:{serviceDate:date,authorityRevision:revision,
    projectionId:id(3),publicationId:id(2),replayDigest:'b'.repeat(64),managerContact:{managerId:id(9)},
    documentDigest:'a'.repeat(64),contractors:[{name:'Synthetic contractor route'}]},
    files:[file('en'),file('es')],bilingualFile:file('en-es'),
    texts:[{language:'en-es',text,sha256:digest(text),documentDigest:'a'.repeat(64)}]};
  const origin='https://localhost',backend='https://memphis-zoo-mcp.onrender.com',service='https://synthetic-coverall.onrender.com';
  const cors={'access-control-allow-origin':origin,'access-control-allow-credentials':'true',
    'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'authorization,x-device-id,content-type'};
  const states=new Map(),checks=[],unmatched=[],observations=[],errors=[],routeTasks=new Set();
  let browser,context,browserClosed=false;
  const pause=async state=>{state.enteredResolve();await state.releasePromise;};
  async function atPause(state){
    let timer;try{await Promise.race([state.enteredPromise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(state.mode+' did not reach its owning await')),5000);})]);}
    finally{clearTimeout(timer);}
  }
  const ready=page=>page.waitForFunction(()=>document.getElementById('prepare').disabled===false);
  const json=(route,value,status=200)=>route.fulfill({status,headers:cors,contentType:'application/json',body:JSON.stringify(value)});
  async function serve(route){
    const request=route.request(),url=new URL(request.url());let page;
    try{page=request.frame().page();}catch{return route.abort();}
    const state=states.get(page);if(!state)return route.abort();
    const method=request.method();
    if(url.origin===origin&&method==='GET'){
      if(url.pathname==='/coverall-fixture-retired.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><title>Retired fixture</title></head><body>Original print document retired</body></html>'});
      if(url.pathname==='/coverall-fixture-port/headers'||url.pathname==='/coverall-fixture-port/digest'){
        assert.equal(url.pathname,'/coverall-fixture-port/'+(state.mode==='retire-headers'?'headers':'digest'));
        state.requests.push({kind:'timing-port',path:url.pathname});await pause(state);
        return route.fulfill({contentType:'text/plain',body:'release synthetic timing only'});
      }
      if(assets.has(url.pathname)){state.served.push(url.pathname);return route.fulfill(assets.get(url.pathname));}
    }
    const auth=url.origin===backend&&url.pathname==='/auth-api/session'&&url.search==='?access_level=full_access';
    const config=url.origin===backend&&url.pathname==='/scheduler-runtime-config'&&url.search==='';
    const logout=url.origin===backend&&url.pathname==='/auth-api/ops/logout'&&url.search==='';
    const schedule=url.origin===service&&url.pathname==='/static-weekly/manager-snapshot'&&url.searchParams.get('week_start')===week&&[...url.searchParams].length===1;
    const print=url.origin===service&&url.pathname==='/static-weekly/coverall-print'
      &&url.searchParams.get('week_start')===week&&url.searchParams.get('service_date')===date
      &&url.searchParams.get('expected_revision')===String(revision)&&url.searchParams.get('projection_id')===id(3)&&[...url.searchParams].length===4;
    if((auth||config||logout||schedule||print)&&method==='OPTIONS')return route.fulfill({status:204,headers:cors});
    if(auth&&method==='GET'){
      assert.equal(request.headers()['x-device-id'],session.device_id);
      state.requests.push({kind:'auth',path:url.pathname});if(state.mode==='retire-auth')await pause(state);
      return json(route,{ok:true,data:{session,trusted_device:{device_id:session.device_id}}});
    }
    if(config&&method==='GET'){
      state.requests.push({kind:'config',path:url.pathname});if(state.mode==='retire-config')await pause(state);
      return json(route,{ok:true,data:{public_url:service}});
    }
    if(logout&&method==='POST'&&state.mode==='withdraw'){
      state.requests.push({kind:'logout',path:url.pathname});return json(route,{ok:true,data:{}});
    }
    if((schedule||print)&&method==='GET'){
      assert.equal(request.headers().authorization,'Bearer '+session.token);assert.equal(request.headers()['x-device-id'],session.device_id);
      state.requests.push({kind:schedule?'snapshot':'handout',path:url.pathname});
      if(print&&state.mode==='withdraw')await pause(state);
      if(schedule){state.snapshots++;return json(route,{ok:true,data:state.mode==='stale'&&state.snapshots===2?{...snapshot,authority_revision:revision+1}:snapshot});}
      return json(route,{ok:true,data:pair});
    }
    unmatched.push({case:state.mode,url:url.href,method});return route.abort();
  }
  async function makePage(mode){
    const page=await context.newPage();let release,enteredResolve;
    const state={mode,page,served:[],requests:[],snapshots:0,retired:false,
      releasePromise:new Promise(resolve=>{release=resolve;}),enteredPromise:new Promise(resolve=>{enteredResolve=resolve;}),release:()=>release(),enteredResolve:()=>enteredResolve()};
    states.set(page,state);page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(5000);
    page.on('pageerror',error=>errors.push({case:mode,message:error.message}));
    // Measurement and declared auth/crypto timing ports only. Actual auth,
    // controller, shared UI, CSP and DOM bytes are never replaced/re-written.
    await page.addInitScript(({mode})=>{
      if(location.pathname!=='/coverall-print.html')return;
      const report=(kind,value={})=>{void window.coverallBrowserObservation({mode,kind,...value});};
      const intervals=new Set(),set=window.setInterval,clear=window.clearInterval;
      window.setInterval=function(...args){const value=Reflect.apply(set,this,args);intervals.add(value);report('interval-created');return value;};
      window.clearInterval=function(value){intervals.delete(value);return Reflect.apply(clear,this,[value]);};
      const create=URL.createObjectURL,revoke=URL.revokeObjectURL;
      URL.createObjectURL=function(...args){const value=Reflect.apply(create,this,args);report('url-created');return value;};
      URL.revokeObjectURL=function(...args){report('url-revoked');return Reflect.apply(revoke,this,args);};
      addEventListener('pagehide',event=>{
        report('pagehide',{trusted:event.isTrusted,persisted:event.persisted});
      },{capture:true});
      // The controller registers its normal pagehide cleanup while its script
      // executes, before load. Register this non-capture observer from load so
      // it runs AFTER that cleanup, not at a checkpoint inside an early listener.
      addEventListener('load',()=>{
        addEventListener('pagehide',event=>report('retired-controls',{
          trusted:event.isTrusted,disabled:document.getElementById('prepare')?.disabled===true,intervals:intervals.size
        }),{once:true});
      },{once:true});
      addEventListener('unhandledrejection',event=>report('unhandled',{message:String(event.reason?.message||event.reason)}));
      if(mode==='retire-headers'){
        // Real cached auth headers otherwise settle immediately. Delay only
        // their unchanged result through this fixed synthetic external port.
        Object.defineProperty(window,'MemphisAuth',{configurable:true,set(value){
          const original=value.opsManagerAuthHeaders;let used=false;
          value.opsManagerAuthHeaders=async function(...args){const headers=await Reflect.apply(original,this,args);
            if(!used){used=true;await fetch('/coverall-fixture-port/headers',{cache:'no-store'});}return headers;};
          Object.defineProperty(window,'MemphisAuth',{value,writable:true,configurable:true});
        }});
      }
      if(mode==='retire-digest'){
        const original=crypto.subtle.digest;let used=false;
        crypto.subtle.digest=async function(...args){const bytes=await Reflect.apply(original,this,args);
          if(!used){used=true;await fetch('/coverall-fixture-port/digest',{cache:'no-store'});}return bytes;};
      }
    },{mode});
    // Settle load, including registration of the late terminal observer,
    // before any selected click, pause release or real retirement navigation.
    await page.goto(origin+'/coverall-print.html?date='+date+'&expected_revision='+revision+'&projection_id='+id(3)+'&device='+session.device_id,{waitUntil:'load'});
    return state;
  }
  try{
    browser=await chromium.launch({headless:true});
    context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Chicago'});
    await context.exposeBinding('coverallBrowserObservation',(_,event)=>observations.push(event));
    await context.route('**/*',route=>{
      const task=serve(route).catch(error=>{
        // An actual retirement cancels the owned original request. Preserve
        // that fact; unexpected route/contract failures still fail the case.
        let state;try{state=states.get(route.request().frame().page());}catch{}
        if(state?.retired&&/closed|cancel|Invalid InterceptionId|already handled|disposed/i.test(error.message)){
          state.cancelledReply=true;return;
        }
        errors.push({case:state?.mode||'route',message:error.message});throw error;
      });
      routeTasks.add(task);void task.finally(()=>routeTasks.delete(task)).catch(()=>{});return task;
    });
    if(!tailOnly){
    const healthy=await makePage('healthy');await ready(healthy.page);
    assert.equal(await healthy.page.locator('#date').inputValue(),date);
    assert((await healthy.page.locator('#status').textContent()).includes('reviewed Schedule revision 7'));
    assert.equal(await healthy.page.locator('#back').getAttribute('data-mz-back'),'');
    assert.equal(await healthy.page.locator('meta[http-equiv="Content-Security-Policy"]').count(),1);
    await healthy.page.locator('#prepare').click();
    await healthy.page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Verified '));
    const files=[],links=healthy.page.locator('#downloads a');
    assert.equal(await links.count(),3);
    for(let index=0;index<3;index++){
      const link=links.nth(index),label=await link.textContent();
      const [download]=await Promise.all([healthy.page.waitForEvent('download'),link.click()]);
      let stream;
      try{
        assert.equal(await download.failure(),null,'actual anchor download completed');
        stream=await download.createReadStream();assert(stream,'completed download provides its public byte stream');
        const chunks=[];let length=0;
        for await(const chunk of stream){length+=chunk.length;assert(length<=2*1024*1024,'bounded original PDF download');chunks.push(Buffer.from(chunk));}
        files.push({filename:download.suggestedFilename(),label,base64:Buffer.concat(chunks).toString('base64')});
      }finally{stream?.destroy();await download.delete();}
    }
    assert.deepEqual(files.map(row=>row.filename),[...pair.files,pair.bilingualFile].map(row=>row.filename));
    assert.deepEqual(files.map(row=>row.base64),[...pair.files,pair.bilingualFile].map(row=>row.base64));
    assert.deepEqual(files.map(row=>row.label),['English PDF','Español PDF','English + Español PDF']);
    assert.equal(await healthy.page.locator('#copy-text').textContent(),text);assert.equal(healthy.snapshots,2);
    for(const path of ['/coverall-print.html','/memphis-auth.js','/memphis-scheduler-actions.js','/memphis-ui.js','/coverall-print.js','/memphis-ui.css','/coverall-print.css'])
      assert(healthy.served.includes(path),path+' actual unchanged asset loaded');
    checks.push('exact full HTML/CSP/shared Back, real auth/actions/controller: reviewed pins, final snapshot, EN/ES/bilingual blob bytes and text');
    await healthy.page.close();
    const stale=await makePage('stale');await ready(stale.page);await stale.page.locator('#prepare').click();
    await stale.page.waitForFunction(()=>document.getElementById('status').textContent.includes('changed while verifying'));
    assert.equal(await stale.page.locator('#downloads a').count(),0);assert.equal(stale.snapshots,2);await stale.page.close();
    checks.push('changed final accepted revision refuses every download link');
    }
    for(const mode of tailOnly?['retire-headers','retire-digest']:['retire-auth','retire-config','retire-headers','retire-digest']){
      const state=await makePage(mode);
      if(mode==='retire-headers'||mode==='retire-digest'){await ready(state.page);await state.page.locator('#prepare').click();}
      await atPause(state);const protectedBefore=state.requests.filter(row=>row.kind==='snapshot'||row.kind==='handout').length;
      state.retired=true;
      await state.page.goto(origin+'/coverall-fixture-retired.html');
      await state.page.waitForFunction(()=>document.title==='Retired fixture');
      state.release();await Promise.all([...routeTasks]);
      assert(observations.some(row=>row.mode===mode&&row.kind==='pagehide'&&row.trusted===true),mode+' actual trusted retirement');
      const terminal=observations.find(row=>row.mode===mode&&row.kind==='retired-controls');
      assert(terminal&&terminal.trusted===true&&terminal.disabled===true&&terminal.intervals===0,mode+' terminal controls/guard refused');
      assert.equal(state.requests.filter(row=>row.kind==='snapshot'||row.kind==='handout').length,protectedBefore);
      assert.equal(observations.filter(row=>row.mode===mode&&row.kind==='url-created').length,0);
      if(mode==='retire-auth')assert.equal(state.requests.filter(row=>row.kind==='config').length,0);
      assert.equal(await state.page.locator('#prepare').count(),0);
      await state.page.close();checks.push(mode+': true trusted pagehide during original await, no later protected GET/control revival/URL');
    }
    const withdrawn=await makePage('withdraw');await ready(withdrawn.page);await withdrawn.page.locator('#prepare').click();await atPause(withdrawn);
    await withdrawn.page.evaluate(()=>MemphisAuth.clearSession());withdrawn.release();await Promise.all([...routeTasks]);
    await withdrawn.page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Manager access changed'));
    assert.equal(await withdrawn.page.locator('#downloads a').count(),0);assert.equal(withdrawn.snapshots,1);await withdrawn.page.close();
    checks.push('actual auth clearSession while handout awaits refuses links and final readback');
    assert.deepEqual(errors,[]);assert(!observations.some(row=>row.kind==='unhandled'));
    assert.deepEqual(unmatched,[],'no unrecognized request is permitted or hidden');
    console.log(JSON.stringify({case:tailOnly?'COVERALL_BROWSER_OWNER_REMAINING_TAIL_NEW':'COVERALL_BROWSER_OWNER_NEW',checks,assetPins,states:[...states.values()].map(({mode,served,requests,cancelledReply})=>({mode,served,requests,cancelledReply})),
      proof:'Real unchanged page/assets/rendered controller and browser lifecycle; synthetic session/backend/PDF DATA only. Fixed public auth-result/real-digest timing ports do not grant authority. Not genuine manager/service/physical print/browser-cache continuation/SQL proof.'},null,2));
  }catch(error){
    console.error(JSON.stringify({case:'COVERALL_BROWSER_FIRST_FAILURE',message:error.message,checks,errors,unmatched,observations,
      states:await Promise.all([...states.values()].map(async state=>({mode:state.mode,requests:state.requests,served:state.served,
        actual:state.page.isClosed()?null:await state.page.evaluate(()=>({url:location.href,status:document.getElementById('status')?.textContent,prepareDisabled:document.getElementById('prepare')?.disabled,links:document.querySelectorAll('#downloads a').length})).catch(()=>null)})))},null,2));throw error;
  }finally{
    for(const state of states.values())state.release();
    try{if(context)await context.close();}finally{if(browser){await browser.close();browserClosed=true;}}
    await Promise.allSettled([...routeTasks]);
    console.log(JSON.stringify({case:'COVERALL_BROWSER_RESOURCES',contexts_remaining:browser?browser.contexts().length:0,browser_closed:browser?browserClosed:null,listeners:0,browser_acquired:!!browser}));
  }
  process.exit(0);
}
const html = read('mobile/src/custodial/index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const implementation = read('mobile/src/custodial/readiness.js').replace(/^export /gm, '')
  + '\n' + read('mobile/src/custodial/hourly-forecast-keyboard.js').replace(/^export /gm, '')
  + '\n' + read('mobile/src/custodial/app.js').replace(/^import .*;\s*$/gm, '');
// Focused actual Source counterexample; no Chromium/native/manager authority.
if(process.argv.includes('--home-refresh-source-only')){
  const {createSyntheticScheduleLocks}=await import('./synthetic-schedule-locks.mjs');
  const {webcrypto}=await import('node:crypto');
  const locks=createSyntheticScheduleLocks(),rows=new Map([['SYNTHETIC_ORIGINAL_WORK','{"original":"retained"}']]),nodes=new Map();
  const listeners=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',dataset:{},hidden:false});return nodes.get(id);};
  const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',
    employee_id:'11111111-1111-4111-8111-111111111111',credential_id:'22222222-2222-4222-8222-222222222222',
    credential_operation_id:'33333333-3333-4333-8333-333333333333',assignment_epoch:1,
    installation_seal:'SYNTHETIC_FIXTURE_ONLY',enrolled_at:'2026-10-16T00:00:00.000Z'};
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_name:'Fixture Custodian',
    employee_id:principal.employee_id,credential_id:principal.credential_id,assignment_epoch:1};
  let writerTail=Promise.resolve(),writes=0,reads=0,releaseLock,app;
  const security={native:true,getStatus:()=>({ready:true,available:true,quarantined:false,generation:1,deviceId:'KIOSK_08',principal}),
    mutateProtectedWork:(fn,options)=>{assert.equal(options.expectedGeneration,1);const pending=writerTail.then(async()=>{
      let active=true;const assertCurrent=()=>assert(active,'closed Source callback');
      try{writes++;return await fn(Object.freeze({deviceId:'KIOSK_08',generation:1,state:'enrolled',assertCurrent}));}finally{active=false;}
    });writerTail=pending.catch(()=>{});return pending;}};
  const names=['window','document','localStorage','fetch','setInterval','clearInterval'];
  const originals=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]);
  let held;
  try{
    globalThis.window={navigator:{locks},crypto:webcrypto,addEventListener:(name,fn)=>listeners.set(name,fn),
      MemphisCustodialSecurity:security,MemphisMobile:{principalIdentity:()=>JSON.stringify(principal),
        profileMatchesPrincipal:p=>p?.employee_id===profile.employee_id&&p?.credential_id===profile.credential_id
          &&p?.assignment_epoch===1&&p?.canonical_device_id==='KIOSK_08'}};
    globalThis.document={hidden:false,getElementById:node,addEventListener:(name,fn)=>listeners.set(name,fn)};
    globalThis.localStorage={getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value)};
    globalThis.fetch=async()=>{throw Error('Synthetic informational provider unavailable');};
    globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};
    const {installHomeFacts}=await import('../mobile/src/custodial/home-facts-dom.js');
    const {zooServiceDate}=await import('../mobile/src/custodial/home-facts.js');
    let entered;const atLock=new Promise(resolve=>entered=resolve);
    held=locks.request('memphis-schedule-authority:'+encodeURIComponent(JSON.stringify(principal)),{mode:'exclusive'},()=>{
      entered();return new Promise(resolve=>releaseLock=resolve);
    });await atLock;
    app=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,security,
      requestJson:async path=>{assert(path.startsWith('/schedule-api/my-day-summary?'));reads++;
        return {service_date:zooServiceDate(),canonical_device_id:'KIOSK_08',employee_id:profile.employee_id,
          credential_id:profile.credential_id,assignment_epoch:1,schedule_delivery_mode:'UNAVAILABLE'};}});
    // Exact same owner/security, a second ordinary invocation while the first
    // original capture is queued. Never release/adopt the stale callback.
    const first=app.update(),second=app.update();
    releaseLock();await held;await Promise.all([first,second]);
    assert.equal(reads,1,'new current same-owner invocation needs its OWN eligible read, not the invalidated original flight');
    assert.equal(writes,3,'only current read-ahead, unavailable settlement and its optional fact cache may invoke the synthetic writer');
    assert.equal(rows.get('SYNTHETIC_ORIGINAL_WORK'),'{"original":"retained"}');
    assert.equal(node('home-shift').textContent,'Schedule unavailable');
    assert.equal(node('home-lunch').textContent,'Lunch unavailable');
    assert.equal([...rows.keys()].filter(key=>key.startsWith('mz_employee_schedule_snapshot:')&&!key.includes(':availability:')).length,0);
    console.log(JSON.stringify({case:'HOME_SAME_OWNER_REFRESH_SOURCE_NEW',reads,writes,proof:'Actual Home/convergence/runtime with synthetic document, native port and FIFO lock; not browser/native/accepted authority'}));
  }finally{
    releaseLock?.();await held;app?.stop();await writerTail;
    for(const [name,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
  }
  const {createHomeFacts}=await import('../mobile/src/custodial/home-facts-runtime.js');
  const {zooServiceDate}=await import('../mobile/src/custodial/home-facts.js');
  let sourcePhase=1;const pending=[],saved=new Map(),rendered=[];
  const id={deviceId:'KIOSK_08',employeeId:'SYNTHETIC_EMPLOYEE',employeeName:'Source Fixture'};
  const runtime=createHomeFacts({identity:()=>id,sourceVersion:()=>sourcePhase,
    storage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)},mutate:fn=>fn(),
    request:(kind,identity,signal)=>new Promise(resolve=>pending.push({kind,identity,signal,resolve})),
    render:value=>rendered.push(value.schedule.shift),kinds:['schedule']});
  try{
    const original=runtime.refresh(),same=runtime.refresh();
    assert.equal(pending.length,1,'unchanged original source still joins its live flight');
    sourcePhase++;const replacement=runtime.refresh();
    assert.equal(pending.length,2,'new source phase must launch, not join the original');
    assert.equal(pending[0].signal.aborted,true);
    const data=start=>({service_date:zooServiceDate(),canonical_device_id:'KIOSK_08',employee_id:id.employeeId,
      shift:{start,end:'16:00'},lunch:{start:'12:00',end:'12:30'}});
    pending[0].resolve(data('09:00'));pending[1].resolve(data('07:00'));
    await Promise.all([original,same,replacement]);
    assert.equal(rendered.at(-1),'7:00 AM–4:00 PM');
    assert(!rendered.includes('9:00 AM–4:00 PM'),'stale old response never renders');
    const exact=[...saved];sourcePhase++;await runtime.refresh();
    assert.equal(pending.length,2,'fresh same-owner records retain their TTL even after source renewal');
    assert.deepEqual([...saved],exact,'TTL reuse does not gratuitously persist or reidentify facts');
    console.log(JSON.stringify({case:'HOME_REFRESH_SOURCE_TTL_NEW',requests:pending.length,proof:'Actual facts runtime DATA/abort/TTL only; no browser/native authority'}));
  }finally{runtime.dispose();}
  process.exit(0);
}

// One changed owning Home/immutable-realm join, not the legacy viewport matrix.
// The exact emitted Java script is an immutable input; ports/principal/backend
// below are synthetic fixture DATA, not native/current-manager authority.
if(process.argv.includes('--home-realm-only')||process.argv.includes('--home-known-facts-realm-only')||process.argv.includes('--home-shipping-known-facts-only')){
  const shipping=process.argv.includes('--home-shipping-known-facts-only');
  const knownFacts=shipping||process.argv.includes('--home-known-facts-realm-only');
  const {createHash}=await import('node:crypto');
  const sourcePath=process.argv.find(arg=>arg.startsWith('--realm-source='))?.slice('--realm-source='.length);
  assert(sourcePath,'Exact emitted realm source is required');
  const realmSource=readFileSync(sourcePath,'utf8');
  assert.equal(createHash('sha256').update(realmSource).digest('hex'),'702f0a54358d333223d0ccfe380c557c32820eae6199c0c9d98d25e04e12d964');
  const policy="frame-src 'none'; worker-src 'none'; object-src 'none'";
  // Keep actual inline class initialization/HTML/CSS. Only existing externally
  // bundled entrypoints are replaced by actual unbundled Home module imports.
  const originalHtml=read('mobile/src/custodial/index.html');
  assert.equal(createHash('sha256').update(originalHtml).digest('hex'),'88258a5d8167e98f26f8853de2953ac744a89602ae9edd95dc65c40f38e52bfd');
  assert.equal(createHash('sha256').update(read('mobile/src/custodial/app.js')).digest('hex'),'e9704bee8c1765015be2b6911dc98fc0cea7bd3824225e1c1815187c5c0fa7e3');
  let homeHtml=originalHtml.replace(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>[\s\S]*?<\/script>/gi,'')
    .replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+policy+'">')
    .replace('</head>','<script type="importmap">{"imports":{"@capacitor/app":"/fixture-capacitor.js","@capacitor/network":"/fixture-capacitor.js","@capacitor/status-bar":"/fixture-capacitor.js"}}</script><script type="module" src="/mobile/src/custodial/app.js"></script></head>');
  const modules=new Map(['app.js','readiness.js','hourly-forecast-keyboard.js','home-facts-dom.js','home-facts.js','home-facts-runtime.js','schedule-home-convergence.js','protected-principal.js']
    .map(name=>['/mobile/src/custodial/'+name,read('mobile/src/custodial/'+name)]));
  modules.set('/memphis-recurring-schedule-target.js',read('memphis-recurring-schedule-target.js'));
  let shippingInputs=null;const shippingAssets=new Map(),shippingExclusions=new Map();
  if(shipping){
    const {join}=await import('node:path');
    const directory=process.argv.find(arg=>arg.startsWith('--shipping-dist='))?.slice('--shipping-dist='.length);
    assert(directory,'Exact immutable emitted distribution is required; never rebuild or substitute Source');
    const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
    const pinned=(name,expected)=>{const bytes=readFileSync(join(directory,name));assert.equal(digest(bytes),expected,name+' exact emitted bytes');return bytes;};
    const build=JSON.parse(pinned('build.json','1ac8535b5f728e1b2071868a48df2eb737ee3fc0f2fc2adbaca6802dd5356c96'));
    const manifest=JSON.parse(pinned('runtime-asset-manifest.json','a6b069a03c22e19f8955cd54eb684fee41ff308bfed75aa7c0fc1545a819dfe8'));
    assert.equal(build.edition,'custodial');assert.equal(build.source_commit,'06ecb51d69548a43c5b9d26766bf7eb2fe748ee5');
    assert.equal(build.source_tree,'0cb4797449cead028a7e6f4dd8826e9e8014a0d5');
    const home=pinned('start_page1.html','0e5a32fb8351ee1d21609b10e03fdeb46b1cd9a8b5c9016cd399c6e253d156af');
    assert.deepEqual(home,pinned('index.html','0e5a32fb8351ee1d21609b10e03fdeb46b1cd9a8b5c9016cd399c6e253d156af'));
    homeHtml=home; // Buffer passed straight to fulfill: NO HTML rewrite/importmap.
    shippingAssets.set('/start_page1.html',{body:home,contentType:'text/html'});
    shippingAssets.set('/index.html',{body:home,contentType:'text/html'});
    const app=pinned('mobile-custodial.js','92a1ce7429b17d8b7713417d809d4876fbbd71e58022198794f42cdaf34cef8f');
    shippingAssets.set('/mobile-custodial.js',{body:app,contentType:'application/javascript'});
    // These four non-app scripts were excluded by the existing ESM fixture.
    // Keep exact packaged HTML, but explicitly substitute only those ports.
    const excluded={'memphis-custodial-bridge.js':'synthetic security/principal/backend port, NOT native auth',
      'memphis-scan-sync.js':'synthetic retained original queue, NOT native storage',
      'memphis-device-reminders.js':'native notification effects excluded',
      'memphis-ui.js':'synthetic original open-cleaning presentation port'};
    for(const [name,reason]of Object.entries(excluded)){
      pinned(name,manifest.asset_hashes_sha256[name]);shippingExclusions.set('/'+name,{reason,sha256:manifest.asset_hashes_sha256[name]});
    }
    for(const [name,contentType]of [['memphis-build-identity.js','application/javascript'],['memphis-native-layout.js','application/javascript'],['memphis-interaction-feedback.js','application/javascript'],
      ['dashboard-bg_optimized.webp','image/webp'],['memphis_avatar_ui.webp','image/webp'],['scheduler_icon_ui.webp','image/webp'],
      ['Event_Icon_ui.webp','image/webp'],['Zoo_Logo_ui.webp','image/webp'],['assets/supply_request_icon.svg','image/svg+xml']])
      shippingAssets.set('/'+name,{body:pinned(name,manifest.asset_hashes_sha256[name]),contentType});
    shippingInputs={build,manifest_sha256:'a6b069a03c22e19f8955cd54eb684fee41ff308bfed75aa7c0fc1545a819dfe8',
      app_sha256:digest(app),home_sha256:digest(home),excluded:[...shippingExclusions].map(([path,entry])=>({path,...entry}))};
  }
  const fixture=String.raw`
    const portEvents=new EventTarget(),messages=[],unhandled=[];
    const port=Object.freeze({postMessage:raw=>messages.push(JSON.parse(raw)),
      addEventListener:portEvents.addEventListener.bind(portEvents),
      removeEventListener:portEvents.removeEventListener.bind(portEvents)});
    Object.defineProperty(globalThis,'custodialOriginalBrowserPreparation',{value:port});
    addEventListener('unhandledrejection',event=>unhandled.push(String(event.reason?.stack||event.reason)));
    const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',
      employee_id:'11111111-1111-4111-8111-111111111111',credential_id:'22222222-2222-4222-8222-222222222222',
      credential_operation_id:'33333333-3333-4333-8333-333333333333',assignment_epoch:1,
      installation_seal:'SYNTHETIC_FIXTURE_ONLY',enrolled_at:'2026-10-16T00:00:00.000Z'};
    const identity=JSON.stringify(principal),subscribers=new Set(),listeners=new Map();
    const status={initialized:true,ready:true,available:true,quarantined:false,state:'enrolled',deviceId:'KIOSK_08',generation:1,principal};
    const profile={authenticated:true,employee_name:'Fixture Custodian',employee_id:principal.employee_id,
      credential_id:principal.credential_id,assignment_epoch:1,canonical_device_id:'KIOSK_08'};
    const original=JSON.stringify({id:'44444444-4444-4444-8444-444444444444',type:'complete_session',payload:{original:'protected',location:'Original Place'}});
    const storageKey='SYNTHETIC_HOME_ORIGINAL_WORK_ONLY';localStorage.setItem(storageKey,original);
    let queue=[],callbackCalls=0,queueReads=0,nativeReadinessReads=0;
    window.MemphisCustodialSecurity={native:true,ready:Promise.resolve(),getStatus:()=>({...status}),
      ensureSecurityState:async()=>({...status}),subscribe:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);},
      getPendingEnrollmentOperation:()=>null,mutateProtectedWork:()=>{callbackCalls++;throw Error('Synthetic optional cache writer unavailable');}};
    window.MemphisUI={resolveOpenScanSession:()=>({state:'open',session:{location_name:'Original Place'}}),isUnstartedScanSession:()=>false};
    window.MemphisScanSync={ready:Promise.resolve(true),listActions:async()=>{queueReads++;return queue;},
      recoverLocalCompletionIntents:async()=>{},reconcileStartupRecovery:async()=>({state:'none'})};
    window.MemphisMobile={principalIdentity:()=>identity,
      profileMatchesPrincipal:p=>p?.employee_id===principal.employee_id&&p?.credential_id===principal.credential_id&&p?.assignment_epoch===1&&p?.canonical_device_id==='KIOSK_08',
      whenReady:async()=>{},resumePendingSecurityWorkflow:async()=>{},readCustodialHomeCache:()=>({profile}),
      saveCustodialHomeCache:async()=>true,
      requestJson:async path=>path.startsWith('/device-auth/status')?profile:{fixture:true},
      saveOfflineScanAuthoritySnapshot:async()=>true,
      getReadinessObservation:async()=>{nativeReadinessReads++;return {observation:'CONFIRMED',read_only:true,native_clock_continuity:'CONFIRMED',
        protected_work_admission:'CLEAR',pending_occurrences:false,unfinished_occurrence:false,rollback_fence_active:false};}};
    window.App={addListener:async(event,fn)=>listeners.set(event,fn)};
    window.Network={addListener:async(event,fn)=>listeners.set(event,fn)};
    window.StatusBar={hide:async()=>{}};
    window.homeRealmFixture={messages,unhandled,original,
      emit(phase){portEvents.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({
        schema:'custodial.native-original-browser-capture-request.v1',command:'REALM_FENCE',grant_token:'a'.repeat(64),
        request_nonce:'c'.repeat(64),phase_nonce:phase,operation_id:'55555555-5555-4555-8555-555555555555',
        frame_sha256:'e'.repeat(64),original_generation_id:'66666666-6666-4666-8666-666666666666',native_mutation_stamp:'SYNTHETIC_REPRESENTATION_ONLY'})}));},
      pending(){queue=[JSON.parse(original)];dispatchEvent(new CustomEvent('memphis-scan-sync',{detail:{status:'queued'}}));},
      failure(){queue=queue.map(row=>({...row,dead_letter:true}));dispatchEvent(new CustomEvent('memphis-scan-sync',{detail:{status:'dead-letter'}}));},
      quarantine(){Object.assign(status,{quarantined:true,ready:false,available:false});for(const fn of subscribers)fn({...status});
        dispatchEvent(new CustomEvent('memphis:custodial-security-state',{detail:{...status}}));},
      saved:()=>localStorage.getItem(storageKey),queue:()=>JSON.stringify(queue),callbackCalls:()=>callbackCalls,
      readCounts:()=>({queue:queueReads,native:nativeReadinessReads})};
  `;
  const shippingBootstrap=String.raw`
    // Fixture DTO service date only, not a clock/authority port. No raw ESM
    // helper is loaded into the page running the emitted application.
    const serviceParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const part=name=>serviceParts.find(value=>value.type===name).value;
    const startupEvents=[];
    for(const name of ['DOMContentLoaded','load','pageshow','visibilitychange','online','offline','memphis:schedule-refresh','memphis:custodial-security-state'])
      (name==='DOMContentLoaded'||name==='visibilitychange'?document:window).addEventListener(name,event=>{
        if(startupEvents.length<32)startupEvents.push({name,readyState:document.readyState,hidden:document.hidden,persisted:event.persisted===true});
      });
    window.homeShippingFixture={serviceDate:part('year')+'-'+part('month')+'-'+part('day'),startupEvents};
    // The IIFE owns its actual Capacitor SDK web implementation. Do not
    // substitute the existing ESM fixture's three fake plugin exports.
    delete window.App;delete window.Network;delete window.StatusBar;
  `;
  const knownFixture=String.raw`
    // Synthetic native ports only: actual Home modules still perform all their
    // own principal/generation/row/DTO checks. No Engine control or native ACK.
    let currentProfile=profile,currentIdentity=identity,currentOwner=0,scheduleReads=0,lateResolve,lateSignal;
    let lateDelivered=false,lateStarted=false,writeCount=0,writerTail=Promise.resolve(),delayArmed=false,delayConsumed=false;
    const mutationTrace=[],requestTrace=[];
    const failureData=error=>({code:error?.code??null,message:String(error?.message??error),stack:String(error?.stack??'').slice(0,2000)});
    const fixedId=n=>'95000000-0000-4000-8000-'+String(n).padStart(12,'0');
    const canonicalDevicePk=fixedId(1);
    const clone=value=>JSON.parse(JSON.stringify(value));
    const counts={oldRequests:0,newRequests:0};
    const currentStatus=()=>({...status,principal:clone(status.principal)});
    const current=()=>status.ready===true&&status.available===true&&status.quarantined===false;
    const security=window.MemphisCustodialSecurity,mobile=window.MemphisMobile;
    security.getStatus=currentStatus;security.ensureSecurityState=async()=>currentStatus();
    security.mutateProtectedWork=(fn,{requireEnrollment=false,expectedGeneration=null}={})=>{
      // Match runWhenReady's actual FIFO/options/finite callback contract.
      // Keep the exact private callback result; never clone/serialize it.
      const trace={requireEnrollment,expectedGeneration,stage:'queued'};mutationTrace.push(trace);
      const pending=writerTail.then(async()=>{
        let owned=false;
        try{
          trace.stage='admission';
          if(!current()||requireEnrollment&&status.state!=='enrolled'
            ||expectedGeneration!==null&&Number(expectedGeneration)!==status.generation)
            throw Object.assign(Error('Synthetic admission withdrawn'),{code:'schedule_request_invalidated'});
          const expectedIdentity=currentIdentity,generation=status.generation;
          const assertCurrent=()=>{if(!owned||!current()||currentIdentity!==expectedIdentity||status.generation!==generation)
            throw Object.assign(Error('Synthetic callback closed or owner withdrawn'),{code:'schedule_request_invalidated'});};
          const context={generation,deviceId:'KIOSK_08',state:status.state};
          Object.defineProperty(context,'assertCurrent',{value:assertCurrent});Object.freeze(context);
          owned=true;assertCurrent();writeCount++;trace.stage='callback';
          const result=await fn(context);
          trace.stage='terminal';assertCurrent();trace.stage='complete';return result;
        }catch(error){trace.failure=failureData(error);throw error;}
        finally{owned=false;}
      });
      writerTail=pending.then(()=>undefined,()=>undefined);
      return pending;
    };
    mobile.principalIdentity=()=>currentIdentity;
    mobile.profileMatchesPrincipal=p=>p?.employee_id===currentProfile.employee_id
      &&p?.credential_id===currentProfile.credential_id&&p?.assignment_epoch===currentProfile.assignment_epoch
      &&p?.canonical_device_id==='KIOSK_08';
    mobile.readCustodialHomeCache=()=>({profile:currentProfile});
    async function dayFor(owner,revision,late=false){
      const day=globalThis.homeShippingFixture?.serviceDate??(await import('/mobile/src/custodial/home-facts.js')).zooServiceDate();
      const who=owner===0?profile:currentProfile;
      if(owner!==0)return {service_date:day,canonical_device_id:'KIOSK_08',canonical_device_pk:canonicalDevicePk,
        employee_id:who.employee_id,employee_name:who.employee_name,credential_id:who.credential_id,assignment_epoch:who.assignment_epoch,
        schedule_delivery_mode:'UNAVAILABLE',projection_status:'unavailable',shift:null,lunch:null,full_day:true,raw_items:[]};
      const view={schema:'static-weekly.recurring-render-view.v1',service_date:day,employee_id:who.employee_id,
        employee_name:who.employee_name,publication_id:fixedId(4),projection_id:fixedId(5),projection_status:'current',
        full_day:true,shift:{start:late?'09:00':'07:00',end:late?'18:00':'16:00'},raw_items:[{name:late?'OLD OWNER LATE':'Original Area',coverage_start:'07:00',coverage_end:'16:00'}]};
      const api=window.MemphisRecurringScheduleTarget,viewJsonText=JSON.stringify(view);
      const target={schema:'static-weekly.recurring-application-target.v1',targetType:'SCHEDULE',operationId:fixedId(6),
        publicationId:fixedId(4),serviceDate:day,authorityRevision:revision,deviceId:canonicalDevicePk,
        employeeId:who.employee_id,credentialId:who.credential_id,assignmentEpoch:who.assignment_epoch,
        projectionId:fixedId(5),lunchDocumentIdentity:'a'.repeat(64),viewDigest:api.sha256Text(viewJsonText)};
      // Same fixed flat target transcript used by the existing Source fixture.
      const targetText='{'+Object.keys(target).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0))
        .map(key=>JSON.stringify(key)+': '+JSON.stringify(target[key])).join(', ')+'}';
      return {...view,canonical_device_id:'KIOSK_08',canonical_device_pk:canonicalDevicePk,
        credential_id:who.credential_id,assignment_epoch:who.assignment_epoch,
        schedule_delivery_mode:'RECURRING_SCHEDULE',recurring_delivery:{intentId:fixedId(revision),target,
          targetDigest:api.sha256Text(targetText),applicationStatus:'DEVICE_REPORTED_APPLIED',
          view,viewJsonText,viewDigest:target.viewDigest},
        home_facts:{service_date:day,employee_id:who.employee_id,publication_id:fixedId(4),projection_id:fixedId(5),
          projection_status:'current',shift:view.shift,lunch:{start:late?'13:00':'12:00',end:late?'13:30':'12:30'}}};
    }
    mobile.requestJson=async(path,options)=>{
      if(path.startsWith('/device-auth/status'))return currentProfile;
      if(path.startsWith('/schedule-api/my-day-summary?')){
        const owner=currentOwner;
        if(owner===0)scheduleReads++;
        // Snapshot/consume the deliberate arm BEFORE any DTO/lock await.
        // Startup repeats return the same original DTO; count is diagnostic,
        // never authority to hold a shipping reply.
        const delayed=owner===0&&delayArmed;
        if(delayed){delayArmed=false;delayConsumed=true;}
        const trace={path,owner,stage:'entered',delayed,sequence:scheduleReads,
          startupEvents:globalThis.homeShippingFixture?.startupEvents.slice()};requestTrace.push(trace);
        if(owner===0)counts.oldRequests++;else counts.newRequests++;
        let day;
        try{trace.stage='building';day=await dayFor(owner,owner===0?(delayed?42:41):43,delayed);trace.stage='built';}
        catch(error){trace.failure=failureData(error);throw error;}
        if(!delayed)return day;
        lateSignal=options?.signal;lateStarted=true;
        trace.stage='awaiting_armed_reply';
        return await new Promise(resolve=>{lateResolve=()=>{lateDelivered=true;trace.stage='delivered_armed_reply';resolve(day);};});
      }
      return {fixture:true};
    };
    const notify=()=>{
      for(const fn of subscribers)fn(currentStatus());
      dispatchEvent(new CustomEvent('memphis:custodial-security-state',{detail:currentStatus()}));
    };
    window.knownFactsFixture={
      oldIdentity:identity,
      stats:()=>({lateStarted,lateDelivered,lateAborted:lateSignal?.aborted===true,...counts,writeCount,delayArmed,delayConsumed,mutationTrace,requestTrace,
        startupEvents:globalThis.homeShippingFixture?.startupEvents}),
      refresh:()=>{
        if(delayArmed||delayConsumed)throw Error('Deliberate refresh already armed/consumed');
        delayArmed=true;
        dispatchEvent(new Event('memphis:schedule-refresh'));
      },
      withdraw(){
        Object.assign(status,{ready:false,available:false,generation:status.generation+1});notify();
      },
      successor(){
        const p={...principal,employee_id:fixedId(12),credential_id:fixedId(13),credential_operation_id:fixedId(14),assignment_epoch:2};
        currentProfile={...profile,employee_name:'Fixture Successor',employee_id:p.employee_id,credential_id:p.credential_id,assignment_epoch:2};
        currentIdentity=JSON.stringify(p);currentOwner=1;
        Object.assign(status,{ready:true,available:true,quarantined:false,generation:status.generation+1,principal:p});notify();
      },
      release:()=>{if(!lateResolve)throw Error('No actual old-owner request awaiting reply');lateResolve();},
      rows:()=>Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('mz_employee_schedule_snapshot:')||key.startsWith('mz_custodial_home_cache:')).sort().map(key=>[key,localStorage.getItem(key)])),
    };
    homeRealmFixture.pending(); // Original work is retained throughout; never drain/relabel it.
  `;
  const browser=await chromium.launch({headless:true});
  let context,closed=false,successorWeather=false;const errors=[],checks=[],externalAborts=[],served=[],consoleFailures=[],requestFailures=[],scriptResponses=[],fixtureWeather=[],excludedScripts=[];
  try{
    context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',serviceWorkers:'allow'});
    const page=await context.newPage();page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(8000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(['error','warning'].includes(message.type()))consoleFailures.push({type:message.type(),text:message.text().slice(0,1000)});});
    page.on('requestfailed',request=>requestFailures.push({url:request.url(),type:request.resourceType(),error:request.failure()?.errorText}));
    page.on('response',response=>{if(response.request().resourceType()==='script')scriptResponses.push({url:response.url(),status:response.status()});});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(knownFacts&&url.origin==='https://api.open-meteo.com'&&url.pathname==='/v1/forecast'){
        fixtureWeather.push({owner:successorWeather?'successor-unavailable':'original-known'});
        return route.fulfill({status:successorWeather?503:200,contentType:'application/json',body:JSON.stringify(successorWeather?{unavailable:true}:{
          current:{temperature_2m:72,time:Math.floor(Date.now()/1000),weather_code:0},current_units:{temperature_2m:'°F',time:'unixtime'}})});
      }
      if(url.origin!=='https://localhost'){externalAborts.push(url.origin);return route.abort();}
      if(shipping){
        const excluded=shippingExclusions.get(url.pathname);
        if(excluded){excludedScripts.push(url.pathname);return route.fulfill({contentType:'application/javascript',body:'/* Explicit fixture exclusion: '+excluded.reason+' */'});}
        const asset=shippingAssets.get(url.pathname);
        if(asset){served.push(url.pathname);return route.fulfill(asset);}
        return route.abort(); // No ESM helpers, plugin shims or unpinned assets.
      }
      if(url.pathname==='/home.html')return route.fulfill({contentType:'text/html',body:homeHtml});
      if(url.pathname==='/fixture-capacitor.js')return route.fulfill({contentType:'application/javascript',
        body:'export const App=window.App,Network=window.Network,StatusBar=window.StatusBar;'});
      if(modules.has(url.pathname)){served.push(url.pathname);return route.fulfill({contentType:'application/javascript',body:modules.get(url.pathname)});}
      return route.abort();
    });
    // ONE document-start script preserves setup/guard ordering. Application
    // modules and actual facts DOM renderer execute only after it installs.
    await page.addInitScript({content:fixture+'\n'+(shipping?shippingBootstrap+'\n':'')+(knownFacts?knownFixture+'\n':'')+realmSource});
    await page.goto(shipping?'https://localhost/start_page1.html':'https://localhost/home.html');
    const label=async(selector,value)=>{
      await page.waitForFunction(({selector,value})=>document.querySelector(selector).textContent.startsWith(value+' —'),{selector,value});
      assert(await page.locator(selector).isVisible());
      assert.equal(await page.locator(selector).getAttribute('role'),'status');
    };
    try{
      if(knownFacts){
        if(shipping)await page.waitForFunction(()=>homeShippingFixture.startupEvents.some(event=>event.name==='pageshow'));
        await page.waitForFunction(()=>!document.getElementById('home').hidden
          &&document.getElementById('phone-lock-name').textContent==='Fixture Custodian'
          &&document.getElementById('home-shift').textContent==='7:00 AM–4:00 PM'
          &&document.getElementById('home-lunch').textContent==='12:00 PM–12:30 PM'
          &&document.getElementById('home-weather-current').textContent==='72°F · clear');
        await page.locator('#phone-unlock').click();
        assert(await page.locator('#home').isVisible());
        const saved=await page.evaluate(()=>homeRealmFixture.saved());
        const originalQueue=await page.evaluate(()=>homeRealmFixture.queue());
        const initial=await page.evaluate(()=>{
          const key='mz_employee_schedule_snapshot:'+encodeURIComponent(knownFactsFixture.oldIdentity);
          return {row:JSON.parse(localStorage.getItem(key)),facts:knownFactsFixture.rows()};
        });
        assert.equal(initial.row.recurring_target.target.authorityRevision,41);
        assert.equal(initial.row.recurring_target.target.employeeId,initial.row.data.employee_id);
        assert.equal(initial.row.recurring_target.target.serviceDate,initial.row.data.service_date);
        assert.equal(initial.row.data.recurring_delivery.applicationStatus,'DEVICE_REPORTED_APPLIED');
        assert.equal(initial.row.data.home_facts.projection_id,initial.row.recurring_target.target.projectionId);
        assert.equal(initial.row.data.home_facts.publication_id,initial.row.recurring_target.target.publicationId);
        assert.equal(await page.locator('#home-schedule-freshness').getAttribute('data-stale'),'false');
        assert(Object.keys(initial.facts).some(key=>key.startsWith('mz_custodial_home_cache:')));
        if(shipping){
          const startup=await page.evaluate(()=>knownFactsFixture.stats());
          assert.equal(startup.delayArmed,false);assert.equal(startup.delayConsumed,false);assert.equal(startup.lateStarted,false);
          assert(startup.requestTrace.filter(trace=>trace.owner===0).every(trace=>trace.delayed===false));
          assert.deepEqual(await page.evaluate(()=>({platform:Capacitor.getPlatform(),native:Capacitor.isNativePlatform(),
            fakeApp:typeof window.App,fakeNetwork:typeof window.Network,fakeStatusBar:typeof window.StatusBar})),
            {platform:'web',native:false,fakeApp:'undefined',fakeNetwork:'undefined',fakeStatusBar:'undefined'});
          assert.equal(served.filter(path=>path==='/mobile-custodial.js').length,1);
          assert.equal(served.filter(path=>path==='/memphis-build-identity.js').length,1);
          assert.equal(await page.evaluate(()=>MemphisMobileBuildIdentity.source_commit),shippingInputs.build.source_commit);
          assert(!served.some(path=>path.startsWith('/mobile/src/')||path==='/fixture-capacitor.js'));
          assert.deepEqual([...excludedScripts].sort(),[...shippingExclusions.keys()].sort());
        }
        checks.push('typed same-person/date/revision synthetic schedule + paired lunch and known weather render via actual Home modules and original cache path');
        await page.evaluate(()=>knownFactsFixture.refresh());
        await page.waitForFunction(()=>knownFactsFixture.stats().lateStarted);
        if(shipping){
          const armed=await page.evaluate(()=>knownFactsFixture.stats());
          assert.equal(armed.delayArmed,false);assert.equal(armed.delayConsumed,true);
          assert.equal(armed.requestTrace.filter(trace=>trace.delayed).length,1,'only explicit caller refresh owns held reply');
          assert((await page.evaluate(()=>knownFactsFixture.stats().oldRequests))>=2,'same-owner refresh reaches actual emitted schedule request');
          assert.equal(await page.locator('#employee-name').textContent(),'Fixture Custodian');
          assert.equal(await page.evaluate(()=>homeRealmFixture.saved()),saved);
        }
        const oldKeys=Object.keys(await page.evaluate(()=>knownFactsFixture.rows()));
        await page.evaluate(()=>knownFactsFixture.withdraw());
        assert.deepEqual(await page.evaluate(()=>[document.getElementById('home-shift').textContent,document.getElementById('home-lunch').textContent]),
          ['Schedule unavailable','Lunch unavailable'],'actual security withdrawal clears old schedule synchronously');
        await page.waitForFunction(()=>knownFactsFixture.stats().lateAborted);
        checks.push('actual schedule-refresh creates old-owner awaited request; security-state withdrawal aborts its signal and clears shift/lunch');
        successorWeather=true;
        await page.evaluate(()=>knownFactsFixture.successor());
        await page.waitForFunction(()=>!document.getElementById('home').hidden
          &&document.getElementById('employee-name').textContent==='Fixture Successor'
          &&knownFactsFixture.stats().newRequests>0
          &&document.getElementById('home-shift').textContent==='Schedule unavailable'
          &&document.getElementById('home-lunch').textContent==='Lunch unavailable'
          &&document.getElementById('home-weather-current').textContent==='Unavailable');
        // Snapshot exact old-owner cache rows after all legitimate old-owner
        // read-ahead writes, before delivering the deliberately stale reply.
        const oldBefore=await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),oldKeys);
        await page.evaluate(()=>knownFactsFixture.release());
        await page.waitForFunction(()=>knownFactsFixture.stats().lateDelivered);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),oldKeys),oldBefore,
          'late response must not rewrite ANY original owner cache or availability row');
        assert.deepEqual(await page.evaluate(()=>[document.getElementById('employee-name').textContent,
          document.getElementById('home-shift').textContent,document.getElementById('home-lunch').textContent,
          document.getElementById('home-weather-current').textContent]),
          ['Fixture Successor','Schedule unavailable','Lunch unavailable','Unavailable']);
        assert.equal(await page.evaluate(()=>homeRealmFixture.saved()),saved);
        assert.equal(await page.evaluate(()=>homeRealmFixture.queue()),originalQueue);
        assert(!await page.locator('#home').textContent().then(text=>text.includes('OLD OWNER LATE')));
        checks.push('late old-owner response cannot repopulate old shift/lunch or rewrite retained owner rows; unavailable successor stays truthful and original pending work is byte-exact');
        const phase='f'.repeat(64);
        await page.evaluate(value=>homeRealmFixture.emit(value),phase);
        await page.waitForFunction(value=>homeRealmFixture.messages.some(message=>message.phase_nonce===value),phase);
        assert.equal(await page.evaluate(value=>homeRealmFixture.messages.find(message=>message.phase_nonce===value).state,phase),
          'PACKAGED_DOCUMENT_REALM_PRECONDITIONS_OBSERVED_NOT_AUTHORITY');
        assert.deepEqual(await page.evaluate(()=>{
          const pin=Object.getOwnPropertyDescriptor(Document.prototype,'createElement'),html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
          return {method:pin.writable===false&&pin.configurable===false,setter:html.configurable===false,
            childCount:document.querySelectorAll('iframe,frame,frameset,object,embed,portal,fencedframe').length};
        }),{method:true,setter:true,childCount:0});
        assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>homeRealmFixture.unhandled),[]);
        checks.push('known-facts/owner-change DOM work leaves actual immutable hooks and same-document realm DATA intact; no unhandled errors');
      }else{
      // Current readinessPresentation deliberately hides nonactionable healthy
      // AND pending labels. Wait for real controller/identity rendering, not a
      // retired visible-positive string (which would timeout on a working Home).
      await page.waitForFunction(()=>!document.getElementById('home').hidden
        &&!document.getElementById('phone-lock').hidden
        &&document.getElementById('phone-lock-name').textContent==='Fixture Custodian');
      const quiet=async()=>assert.deepEqual(await page.evaluate(()=>['home-readiness','lock-readiness'].map(id=>{
        const el=document.getElementById(id);return {hidden:el.hidden,text:el.textContent};
      })),[{hidden:true,text:''},{hidden:true,text:''}]);
      await quiet();
      assert.equal(await page.locator('#phone-lock-name').textContent(),'Fixture Custodian');
      const unlock=await page.locator('#phone-unlock').boundingBox();
      assert(unlock&&unlock.x>=0&&unlock.y>=0&&unlock.x+unlock.width<=390&&unlock.y+unlock.height<=844);
      await page.locator('#phone-unlock').click();
      await quiet();
      assert(await page.locator('#home').isVisible());
      assert.equal(await page.locator('#phone-lock').isVisible(),false);
      await page.waitForFunction(()=>document.getElementById('home-weather-freshness').dataset.stale==='true');
      assert(await page.locator('#active-cleaning').isVisible());
      assert.equal(await page.locator('#active-cleaning-text').textContent(),'You are cleaning Original Place. Tap the same physical tag when you are done.');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.equal(served.filter(path=>path.endsWith('/home-facts-dom.js')).length,1,'actual facts renderer, not stub');
      checks.push('actual Home/Unlock/active-cleaning and actual facts DOM rendering work with document-start immutable guards');
      const phase='d'.repeat(64);
      await page.evaluate(phase=>homeRealmFixture.emit(phase),phase);
      await page.waitForFunction(phase=>homeRealmFixture.messages.some(message=>message.phase_nonce===phase),phase);
      const reply=await page.evaluate(phase=>homeRealmFixture.messages.find(message=>message.phase_nonce===phase),phase);
      assert.equal(reply.state,'PACKAGED_DOCUMENT_REALM_PRECONDITIONS_OBSERVED_NOT_AUTHORITY');
      assert.equal(reply.reply_token,'b'.repeat(64));
      checks.push('same original clean document returns realm DATA only');
      const beforePending=await page.evaluate(()=>homeRealmFixture.readCounts());
      await page.evaluate(()=>homeRealmFixture.pending());
      await page.waitForFunction(before=>{
        const after=homeRealmFixture.readCounts();return after.queue>before.queue&&after.native>before.native;
      },beforePending);
      await quiet();
      assert(await page.locator('#home').isVisible());
      assert(await page.locator('#active-cleaning').isVisible());
      const saved=await page.evaluate(()=>homeRealmFixture.saved());
      await page.evaluate(()=>homeRealmFixture.failure());await label('#home-readiness','Needs manager');
      assert.equal(await page.evaluate(()=>homeRealmFixture.saved()),saved);
      const queued=await page.evaluate(()=>JSON.parse(homeRealmFixture.queue()));
      assert.equal(queued[0].dead_letter,true);assert.equal(queued[0].payload.original,'protected');
      assert.deepEqual(queued[0].payload,JSON.parse(saved).payload);
      await page.evaluate(()=>homeRealmFixture.quarantine());await label('#assignment-readiness','Do not use');
      assert(await page.locator('#assignment').isVisible());
      assert.equal(await page.evaluate(()=>homeRealmFixture.saved()),saved);
      assert.equal(await page.evaluate(()=>homeRealmFixture.original),saved);
      checks.push('pending -> genuine dead-letter fixture failure -> quarantine presentation retains original queued work bytes');
      const blocked=await page.evaluate(()=>{
        const method=Object.getOwnPropertyDescriptor(Document.prototype,'createElement');
        const setter=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
        let reason='';try{document.createElement('iframe');}catch(error){reason=error.message;}
        return {reason,methodImmutable:method.writable===false&&method.configurable===false,setterImmutable:setter.configurable===false,
          children:document.querySelectorAll('iframe,frame,frameset,object,embed,portal,fencedframe').length};
      });
      assert.deepEqual(blocked,{reason:'custodial_original_browser_realm_creation_refused',methodImmutable:true,setterImmutable:true,children:0});
      assert(await page.evaluate(()=>homeRealmFixture.messages.some(message=>message.schema==='custodial.native-original-browser-realm-withdrawal.v1')));
      assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>homeRealmFixture.unhandled),[]);
      checks.push('child creation still refuses and retires reader; no live child or unhandled error');
      }
    }catch(error){
      console.error(JSON.stringify({case:'HOME_REALM_FIRST_FAILURE',message:error.message,checks,errors,
        served,scriptResponses,consoleFailures,requestFailures,externalAborts,shippingInputs,excludedScripts,
        actual:await page.evaluate(()=>({boot:document.querySelector('#boot-status').textContent,
          home:document.querySelector('#home-readiness').textContent,lock:document.querySelector('#lock-readiness').textContent,
          assignment:document.querySelector('#assignment-readiness').textContent,
          unhandled:globalThis.homeRealmFixture?.unhandled,messages:globalThis.homeRealmFixture?.messages,
          documentState:document.readyState,homeHidden:document.querySelector('#home').hidden,
          lockHidden:document.querySelector('#phone-lock').hidden,lockName:document.querySelector('#phone-lock-name').textContent,
          fixtureInstalled:typeof globalThis.homeRealmFixture==='object',readCounts:globalThis.homeRealmFixture?.readCounts(),
          knownFacts:globalThis.knownFactsFixture?.stats(),knownRows:globalThis.knownFactsFixture?.rows(),
          scripts:[...document.scripts].map(script=>({src:script.src,type:script.type})),
          resources:performance.getEntriesByType('resource').filter(entry=>entry.initiatorType==='script').map(entry=>({name:entry.name,duration:entry.duration}))}))},null,2));throw error;
    }
    console.log(JSON.stringify({case:shipping?'HOME_EMITTED_KNOWN_FACTS_NEW':knownFacts?'HOME_KNOWN_FACTS_REALM_NEW':'HOME_REALM_COMPATIBILITY_NEW',checks,served,external_requests_aborted:externalAborts,fixture_weather:fixtureWeather,
      shippingInputs,excludedScripts,
      startup_flow:shipping?await page.evaluate(()=>knownFactsFixture.stats()):undefined,
      proof:shipping?'Exact emitted Home/IIFE/layout/feedback assets + real SDK web behavior; four explicit non-app port exclusions and synthetic security/actor/backend/provider DATA. NOT APK/native auth/schedule publication/SQL/manager/TLS/clock/ACK/all-writer proof.':
        'Actual Home HTML/controller/facts + emitted guards in headless Chromium; synthetic Capacitor/security/port/backend/provider DTOs only. NOT schedule publication/SQL acceptance/genuine native/manager/TLS/clock/ACK/all-writer proof.'},null,2));
  }finally{
    try{if(context)await context.close();}finally{await browser.close();closed=true;}
    console.log(JSON.stringify({case:'HOME_REALM_RESOURCES',contexts_remaining:browser.contexts().length,browser_closed:closed,listeners:0}));
  }
  process.exit(0);
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport, timezoneId: 'Asia/Tokyo' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // This dedicated headless fixture cannot contact a real server.
    await page.route('**/*', route => route.abort());
    await page.setContent(html);
    await page.evaluate(() => {
      const status = { initialized: true, ready: true, available: true, quarantined: false, state: 'enrolled', deviceId: 'KIOSK_08', generation: 1 };
      const listeners = new Map(); let subscriber; let queue = [];
      const profile = { authenticated: true, employee_name: 'Fixture Custodian', fixture_principal: 'p' };
      window.MemphisCustodialSecurity = { native: true, ready: Promise.resolve(), getStatus: () => ({ ...status }),
        ensureSecurityState: async () => ({ ...status }), subscribe: fn => { subscriber = fn; }, getPendingEnrollmentOperation: () => null };
      window.MemphisUI = { resolveOpenScanSession: () => ({ state: 'open', session: { location_name: 'Original Place' } }), isUnstartedScanSession: () => false };
      window.MemphisScanSync = { ready: Promise.resolve(true), listActions: async () => queue,
        recoverLocalCompletionIntents: async () => {}, reconcileStartupRecovery: async () => ({ state: 'none' }) };
      window.MemphisMobile = { principalIdentity: () => 'p', profileMatchesPrincipal: p => p?.fixture_principal === 'p',
        whenReady: async () => {}, resumePendingSecurityWorkflow: async () => {}, readCustodialHomeCache: () => ({ profile }),
        saveCustodialHomeCache: async () => true, requestJson: async path => path.startsWith('/device-auth/status') ? profile : { fixture: true },
        saveOfflineScanAuthoritySnapshot: async () => true,
        getReadinessObservation: async () => ({ observation: 'CONFIRMED', read_only: true,
          native_clock_continuity: 'CONFIRMED', protected_work_admission: 'CLEAR',
          pending_occurrences: false, unfinished_occurrence: false, rollback_fence_active: false }) };
      window.installHomeFacts = () => ({ stop() {}, update() {}, authenticatedProfileRestored() { return true; } });
      window.Network = { addListener: async (event, fn) => listeners.set(event, fn) };
      window.App = { addListener: async (event, fn) => listeners.set(event, fn) };
      window.StatusBar = { hide: async () => {} };
      window.readinessFixture = {
        pending() { queue = [{ type: 'complete_session', payload: { original: 'protected' } }]; window.dispatchEvent(new CustomEvent('memphis-scan-sync', { detail: { status: 'queued' } })); },
        deadLetter() { queue[0].dead_letter = true; window.dispatchEvent(new CustomEvent('memphis-scan-sync', { detail: { status: 'dead-letter' } })); },
        quarantine() { status.quarantined = true; subscriber({ ...status }); },
        bytes: () => JSON.stringify(queue),
      };
    });
    await page.addScriptTag({ content: implementation });
    await page.waitForFunction(() => document.getElementById('lock-readiness').textContent.startsWith('Ready for work — Last confirmed'));
    assert.equal(await page.locator('#lock-readiness').isVisible(), true);
    const unlockBox = await page.locator('#phone-unlock').boundingBox();
    assert.ok(unlockBox && unlockBox.x >= 0 && unlockBox.x + unlockBox.width <= viewport.width && unlockBox.y + unlockBox.height <= viewport.height, `Unlock remains reachable at ${viewport.width}`);
    await page.locator('#phone-unlock').click();
    async function verify(label, target = '#home-readiness') {
      await page.waitForFunction(({ selector, label }) => document.querySelector(selector).textContent.startsWith(`${label} —`), { selector: target, label });
      assert.equal(await page.locator(target).isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const box = await page.locator(target).boundingBox();
      assert.ok(box && box.width > 100 && box.x >= 0 && box.x + box.width <= viewport.width);
      assert.equal(await page.locator(target).getAttribute('role'), 'status');
      results.push({ viewport: viewport.width, label, passed: true });
    }
    await verify('Ready for work');
    await page.evaluate(() => readinessFixture.pending());
    await verify('Needs internet');
    const saved = await page.evaluate(() => readinessFixture.bytes());
    assert.equal(await page.locator('#active-cleaning').isVisible(), true);
    assert.equal(await page.locator('#active-cleaning-text').textContent(), 'You are cleaning Original Place. Tap the same physical tag when you are done.');
    await page.evaluate(() => readinessFixture.deadLetter());
    await verify('Needs manager');
    assert.equal(await page.evaluate(() => JSON.parse(readinessFixture.bytes())[0].payload.original), JSON.parse(saved)[0].payload.original);
    await page.evaluate(() => readinessFixture.quarantine());
    await verify('Do not use', '#assignment-readiness');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(JSON.stringify({ scope: 'Actual source HTML/CSS and controller in isolated headless Chromium; synthetic native/backend, all external requests denied; no APK/phone', passed: results.length, results }, null, 2));
} finally { await browser.close(); }
