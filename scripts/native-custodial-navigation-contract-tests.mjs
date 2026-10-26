#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const scanWriterOnly = process.argv.includes('--scan-resume-writer-gate-only');
const scanBrowserOnly = process.argv.includes('--scan-browser-preservation-only');
if (!scanWriterOnly && !scanBrowserOnly) await import('./custodial-navigation-assets-tests.mjs');

const source = readFileSync(new URL(scanBrowserOnly && process.argv.includes('--scan-browser-old-ui')
  ? '../../baseline/memphis-ui.js' : '../memphis-ui.js', import.meta.url), 'utf8');
if (!scanWriterOnly && !scanBrowserOnly) {
const nativeVault = readFileSync(new URL('../mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialNativeVaultPlugin.java', import.meta.url), 'utf8');
assert.match(nativeVault, /@Override\s+public Boolean shouldOverrideLoad\(Uri url\)\s*\{\s*return CustodialNavigationPolicy\.shouldBlock\(url == null \? null : url\.toString\(\)\);\s*\}/,
  'OC24-15 requires the native policy hook, not only a JavaScript link filter');
}

const storageFixtureControls = new WeakMap();
function storage(values = {}) {
  const state = new Map(Object.entries(values));
  let observe = null;
  class FixtureStorage {
    get length() { return state.size; }
    key(index) { return [...state.keys()][index] ?? null; }
    getItem(key) { return state.has(key) ? state.get(key) : null; }
    setItem(key, value) { observe?.('before', 'set', key, String(value)); state.set(key, String(value)); observe?.('after', 'set', key, String(value)); }
    removeItem(key) { observe?.('before', 'remove', key); state.delete(key); observe?.('after', 'remove', key); }
  }
  const area = new FixtureStorage();
  storageFixtureControls.set(area, {
    observe: fn => { observe = fn; },
    rawSet: (key, value) => state.set(key, String(value)),
    rawRemove: key => state.delete(key),
  });
  return area;
}

function navigationRuntime({ context = 'employee', native = false, legacyQueue = false, locks } = {}) {
  const location = new URL('https://localhost/employee-schedule.html?hub=employee&device=KIOSK_08');
  const window = {
    location,
    localStorage: storage(),
    sessionStorage: storage(),
    addEventListener() {},
    confirm: () => true,
  };
  window.top = window;
  window.self = window;
  if (native) window.MemphisMobileBuildIdentity = Object.freeze({ edition: 'custodial' });

  const document = {
    body: { dataset: { memphisContext: context } },
    documentElement: { classList: { add() {} }, hidden: false },
    readyState: 'loading',
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    visibilityState: 'visible',
  };
  const globals = {
    URL,
    window,
    document,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    navigator: { userAgent: native ? 'Android Memphis Zoo Custodial' : 'Browser' },
    Element: class Element {},
    HTMLAnchorElement: class HTMLAnchorElement {},
    HTMLFormElement: class HTMLFormElement {},
    console,
  };
  if (legacyQueue) {
    window.navigator = {locks}; window.crypto = webcrypto;
    Object.assign(globals, {crypto:webcrypto, AbortController, setTimeout, clearTimeout});
    // Execute the actual frozen queue, including its own lazy admission import.
    // No injected checkpoint or synthetic private queue owner is substituted.
    vm.runInNewContext(readFileSync(new URL('../memphis-scan-sync.js', import.meta.url), 'utf8'), globals, {
      filename:fileURLToPath(new URL('../memphis-scan-sync.js', import.meta.url)),
      importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
    });
  }
  vm.runInNewContext(source, globals, { filename: 'memphis-ui.js' });
  return { ui: window.MemphisUI, localStorage: window.localStorage, window };
}

if (scanBrowserOnly) {
  await scanBrowserPreservationCases();
} else if (scanWriterOnly) {
  await scanResumeWriterGateCases();
} else {
const { PROTECTED_BROWSER_LOCK } = await import('../mobile/src/custodial/protected-browser-admission.js');
let mutationTail = Promise.resolve();
const currentBrowserLocks = { request(name, options, operation) {
  assert.equal(name, PROTECTED_BROWSER_LOCK); assert.equal(options.mode, 'exclusive');
  const pending = mutationTail.then(() => operation({name, mode:'exclusive'}));
  mutationTail = pending.catch(() => {}); return pending;
} };
const browserEmployeeRuntime = navigationRuntime({legacyQueue:true, locks:currentBrowserLocks});
const actualBrowserQueue = browserEmployeeRuntime.window.MemphisScanSync;
const browserEmployee = browserEmployeeRuntime.ui;
const browserTarget = browserEmployee.canonicalBackTarget();
assert.equal(browserTarget.pathname, '/employee-hub.html');
assert.equal(browserTarget.searchParams.get('hub'), 'employee');
assert.equal(browserTarget.searchParams.get('device'), 'KIOSK_08');

const nativeEmployee = navigationRuntime({ native: true }).ui;
const nativeTarget = nativeEmployee.canonicalBackTarget();
assert.equal(nativeTarget.toString(), 'https://localhost/index.html',
  'native employee modules must return directly to the protected Custodial home');
assert.equal(nativeTarget.search, '',
  'native return must not carry a URL-provided device identity into the protected home');

const browserManager = navigationRuntime({ context: 'manager' }).ui;
assert.equal(browserManager.canonicalBackTarget().pathname, '/start_page1.html');

const firstSession = {
  session_uuid: '11111111-1111-4111-8111-111111111111',
  client_session_id: '11111111-1111-4111-8111-111111111111',
  device_id: 'KIOSK_08',
  location_code: 'NOCX',
  location_name: 'Nocturnal',
  status: 'active',
};
browserEmployeeRuntime.localStorage.setItem(`session:${firstSession.session_uuid}`, JSON.stringify(firstSession));
assert.equal(browserEmployee.indexScanSession(firstSession), false, 'unadmitted sync writes remain refused');
assert.equal(await actualBrowserQueue.mutateProtectedWork(context => {
  context.assertCurrent(); const result=browserEmployee.indexScanSession(firstSession); context.assertCurrent(); return result;
}), true);
const resolvedFirst = browserEmployee.resolveOpenScanSession('KIOSK_08');
assert.equal(resolvedFirst.state, 'open');
assert.equal(resolvedFirst.session.session_uuid, firstSession.session_uuid);
assert.equal(resolvedFirst.session.location_code, firstSession.location_code,
  'the explicit active-work index must resolve the directly-bound session');

const secondSession = {
  ...firstSession,
  session_uuid: '22222222-2222-4222-8222-222222222222',
  client_session_id: '22222222-2222-4222-8222-222222222222',
  location_code: 'AQUARIUM',
  location_name: 'Aquarium Restrooms',
};
browserEmployeeRuntime.localStorage.setItem(`session:${secondSession.session_uuid}`, JSON.stringify(secondSession));
assert.equal(browserEmployee.indexScanSession(secondSession), false, 'unadmitted sync writes remain refused');
assert.equal(await actualBrowserQueue.mutateProtectedWork(context => {
  context.assertCurrent(); const result=browserEmployee.indexScanSession(secondSession); context.assertCurrent(); return result;
}), true);
assert.equal(browserEmployee.resolveOpenScanSession('KIOSK_08').state, 'ambiguous',
  'multiple indexed active contexts must fail closed instead of selecting the newest');
assert.equal(await browserEmployee.clearScanView(secondSession.session_uuid, 'KIOSK_08'), true);
assert.equal(browserEmployee.resolveOpenScanSession('KIOSK_08').state, 'open');
browserEmployeeRuntime.localStorage.setItem('mz_phone_scan_resume:KIOSK_08', '{bad json');
assert.equal(browserEmployee.resolveOpenScanSession('KIOSK_08').state, 'corrupted',
  'a malformed active-work index must fail closed');

for (const page of ['employee-schedule.html', 'system-feedback.html']) {
  const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
  assert.match(html, /data-mz-back/, `${page} must delegate Back to the canonical shared route`);
  assert.match(html, /memphis-ui\.js/, `${page} must load the canonical shared route runtime`);
}

// Shared scrolling Events intentionally owns its one role-aware Back handler,
// rather than installing a second memphis-ui click handler on the same button.
const eventsHtml=readFileSync(new URL('../events.html',import.meta.url),'utf8');
assert.match(eventsHtml,/id="events-back"/);assert.match(eventsHtml,/events-view\.js/);
const eventContext={URL,module:{exports:{}}};
vm.runInNewContext(readFileSync(new URL('../events-view.js',import.meta.url),'utf8'),eventContext);
const nativeEvents={location:{href:'https://localhost/events.html?hub=manager&device=OTHER'},MemphisMobile:{edition:'custodial'}};
assert.equal(eventContext.MemphisSharedEvents.returnTarget(nativeEvents,{kind:'employee',device:'KIOSK_08'}),'https://localhost/index.html');
const managerEvents={location:{href:'https://example.invalid/events.html?return=https://bad.invalid'}};
assert.equal(new URL(eventContext.MemphisSharedEvents.returnTarget(managerEvents,{kind:'manager',device:'verified-browser'})).pathname,'/operations-dashboard.html');

console.log(JSON.stringify({
  ok: true,
  browser_employee_target: browserTarget.toString(),
  native_employee_target: nativeTarget.toString(),
  manager_target: browserManager.canonicalBackTarget().toString(),
}));
}

async function scanBrowserPreservationCases() {
  const id='11111111-1111-4111-8111-111111111111',device='KIOSK_08',key='mz_phone_scan_resume:'+device;
  const session={session_uuid:id,client_session_id:id,device_id:device,location_code:'NOCX',
    location_name:'Nocturnal',status:'active',updated_at:'2026-10-14T00:00:00Z'};
  const indexed=JSON.stringify({schema_version:2,device_id:device,sessions:[{...session,view:'timer'}],updated_at:session.updated_at});
  const {createProtectedBrowserAdmission,PROTECTED_BROWSER_HOLD_KEY,PROTECTED_BROWSER_LOCK}
    =await import('../mobile/src/custodial/protected-browser-admission.js');
  const selected=process.argv.find(arg=>arg.startsWith('--scan-browser-case='))?.split('=')[1],completed=[];
  const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
  const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
  function fixture({unindexed=false}={}) {
    // Recording Web Locks/Storage only; actual UI, queue and admission code.
    let tail=Promise.resolve(),active=0,entries=0;
    const locks={request(name,options,body) {
      const job=tail.then(async()=>{
        if(options.signal?.aborted)throw Error('SYNTHETIC_LOCK_ABORT');
        assert.equal(name,PROTECTED_BROWSER_LOCK);assert.equal(options.mode,'exclusive');
        assert.equal(active,0);active++;entries++;
        try{return await body({name,mode:'exclusive'});}finally{active--;}
      });tail=job.catch(()=>{});return job;
    }};
    const x=navigationRuntime({legacyQueue:true,locks}),s=x.localStorage,writes=[];
    s.setItem('session:'+id,JSON.stringify(session));s.setItem('mz_scan_device_id',device);
    s.setItem('retained-unknown-row','{ exact retained unknown }');
    if(!unindexed)s.setItem(key,indexed);
    const {rawSet,rawRemove,observe}=storageFixtureControls.get(s);
    let afterWrite=null;
    observe((phase,method,key,value)=>{
      if(phase==='before')writes.push({method,key,...(method==='set'?{value}: {})});
      else afterWrite?.();
    });
    const originals=()=>Object.fromEntries(Array.from({length:s.length},(_,i)=>s.key(i)).filter(k=>k!== 'mz_custodial_protected_browser_mutation.v1').sort().map(k=>[k,s.getItem(k)]));
    const before=originals();
    return {...x,locks,writes,rawSet,rawRemove,originals,before,session,
      active:()=>active,entries:()=>entries,afterWrite:fn=>{afterWrite=fn;}};
  }
  async function run(name,body){if(selected&&selected!==name)return;await body();completed.push(name);console.log(JSON.stringify({case:name,status:'PASS_SOURCE_VM_ONLY'}));}
  await run('preexisting-hold-denies-sync-and-async',async()=>{
    const x=fixture();x.rawSet(PROTECTED_BROWSER_HOLD_KEY,'{ retained existing hold }');const before=x.originals();
    assert.equal(x.ui.rememberScanView(session,'complete'),false);
    assert.equal(await x.ui.clearScanView(id,device),false);
    same(x.originals(),before);assert.equal(x.writes.filter(w=>w.key===key).length,0);
  });
  await run('same-active-queue-callback-only',async()=>{
    const x=fixture(),queue=x.window.MemphisScanSync;
    assert.equal(x.ui.indexScanSession(session,'complete'),false);
    let staleContext;
    assert.equal(await queue.mutateProtectedWork(context=>{
      staleContext=context;context.assertCurrent();
      assert.equal(x.active(),1);assert.equal(x.ui.rememberScanView(session,'complete'),true);
      context.assertCurrent();return true;
    }),true);
    assert.throws(()=>staleContext.assertCurrent());
    assert.equal(x.ui.indexScanSession(session,'timer',{assertCurrent(){}}),false);
    assert.equal(JSON.parse(x.localStorage.getItem(key)).sessions[0].view,'complete');
    assert.equal(x.writes.filter(w=>w.key===key).length,1);
    assert.equal(x.localStorage.getItem('session:'+id),x.before['session:'+id]);
  });
  await run('async-clear-exactly-once-and-terminal-lock',async()=>{
    const x=fixture(),block=deferred(),entered=deferred(),queue=x.window.MemphisScanSync;
    const first=queue.mutateProtectedWork(async context=>{
      entered.resolve();await block.promise;context.assertCurrent();return true;
    });
    await entered.promise;let settled=false;
    const clear=x.ui.clearScanView(id,device).then(result=>{settled=true;return result;});
    await Promise.resolve();assert.equal(settled,false);assert.equal(x.localStorage.getItem(key),indexed);
    block.resolve();assert.equal(await first,true);assert.equal(await clear,true);
    assert.equal(x.active(),0);assert.equal(x.localStorage.getItem(key),null);
    assert.equal(x.writes.filter(w=>w.key===key).length,1);
    assert.equal(x.localStorage.getItem('session:'+id),x.before['session:'+id]);
    assert.equal(x.localStorage.getItem('retained-unknown-row'),x.before['retained-unknown-row']);
  });
  await run('hold-waits-for-original-terminal-callback',async()=>{
    const x=fixture(),block=deferred(),entered=deferred(),queue=x.window.MemphisScanSync;
    const work=queue.mutateProtectedWork(async context=>{
      assert.equal(x.ui.indexScanSession(session,'complete'),true);
      entered.resolve();await block.promise;context.assertCurrent();return true;
    });
    await entered.promise;
    const other=createProtectedBrowserAdmission({storage:x.localStorage,sessionStorage:x.window.sessionStorage,
      indexedDb:{databases:async()=>[]},locks:x.locks,cryptoApi:webcrypto});
    const held=other.holdAndObserve({operationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
    await Promise.resolve();assert.equal(x.localStorage.getItem(PROTECTED_BROWSER_HOLD_KEY),null);
    assert.equal(x.active(),1);block.resolve();assert.equal(await work,true);await held;
    assert.notEqual(x.localStorage.getItem(PROTECTED_BROWSER_HOLD_KEY),null);
    const count=x.writes.filter(w=>w.key===key).length,before=x.originals();
    assert.equal(await x.ui.clearScanView(id,device),false);same(x.originals(),before);
    assert.equal(x.writes.filter(w=>w.key===key).length,count);assert.equal(x.active(),0);
  });
  await run('queued-original-and-owner-withdrawal-retains-successors',async()=>{
    for(const change of ['index','session','device','queue','writer','checkpoint','native']) {
      const x=fixture(),block=deferred(),entered=deferred(),queue=x.window.MemphisScanSync;
      const previous=queue.mutateProtectedWork(async()=>{entered.resolve();await block.promise;return true;});
      await entered.promise;const clear=x.ui.clearScanView(id,device);
      if(change==='index')x.rawSet(key,'{ foreign index }');
      if(change==='session')x.rawSet('session:'+id,'{ foreign session }');
      if(change==='device')x.rawSet('mz_scan_device_id','KIOSK_09');
      if(change==='queue')x.window.MemphisScanSync={...queue};
      if(change==='writer')queue.mutateProtectedWork=async()=>true;
      if(change==='checkpoint')queue.requireLegacyBrowserMutation=()=>{};
      if(change==='native')x.window.MemphisMobileBuildIdentity={edition:'custodial'};
      const before=x.originals();block.resolve();
      await previous.catch(()=>{});assert.equal(await clear,false);
      same(x.originals(),before);assert.equal(x.writes.filter(w=>w.key===key).length,0);assert.equal(x.active(),0);
    }
  });
  await run('uncertain-effect-never-compensates-or-reports-success',async()=>{
    for(const change of ['index','session','queue','native']) {
      const x=fixture();let calls=0;
      x.afterWrite(()=>{
        // Trigger only the index effect, not the admission epoch write.
        if(x.writes.at(-1)?.key!==key)return;calls++;
        if(change==='index')x.rawSet(key,'{ unknown successor }');
        if(change==='session')x.rawSet('session:'+id,'{ unknown session successor }');
        if(change==='queue')x.window.MemphisScanSync={...x.window.MemphisScanSync};
        if(change==='native')x.window.MemphisMobileBuildIdentity={edition:'custodial'};
      });
      assert.equal(await x.ui.clearScanView(id,device),false);
      assert.equal(calls,1);assert.equal(x.writes.filter(w=>w.key===key).length,1);
      if(change==='index')assert.equal(x.localStorage.getItem(key),'{ unknown successor }');
      if(change==='session')assert.equal(x.localStorage.getItem('session:'+id),'{ unknown session successor }');
      assert.equal(x.localStorage.getItem('retained-unknown-row'),x.before['retained-unknown-row']);
      assert.equal(x.active(),0);
    }
  });
  await run('readonly-restart-does-not-create-index',async()=>{
    const x=fixture({unindexed:true}),before=x.originals();
    assert.equal(x.ui.resolveOpenScanSession(device).state,'open');
    same(x.originals(),before);assert.equal(x.writes.length,0);assert.equal(x.entries(),0);
    assert.equal(await x.window.MemphisScanSync.mutateProtectedWork(()=>x.ui.indexScanSession(session)),true);
    assert.notEqual(x.localStorage.getItem(key),null);assert.equal(x.writes.filter(w=>w.key===key).length,1);
  });
  await run('sync-retirement-and-restoration-use-same-active-owner',async()=>{
    // This is the queue's existing LOCAL completion DATA receipt, not a
    // native/SQL receipt or an authenticated completion capability.
    const saved={...session,status:'saved_pending_sync',completion_pending:true};
    saved.local_completion_receipt=JSON.stringify({completion:'',device,end:'',finish:'',location:'NOCX',
      response:null,session:id,start:''});
    for(const held of [false,true]) {
      const x=fixture(),queue=x.window.MemphisScanSync;
      x.rawSet('session:'+id,JSON.stringify(saved));
      assert.equal(queue.isLocallyCompleted(saved),true);
      if(held)x.rawSet(PROTECTED_BROWSER_HOLD_KEY,'{ existing hold }');
      const before=x.originals();
      assert.equal(x.ui.retireCompletedScanView(saved),false);
      same(x.originals(),before);assert.equal(x.writes.filter(w=>w.key===key).length,0);
      if(!held) {
        assert.equal(await queue.mutateProtectedWork(()=>x.ui.retireCompletedScanView(saved)),true);
        assert.equal(JSON.parse(x.localStorage.getItem(key)).sessions.length,0);
        assert.equal(x.localStorage.getItem('session:'+id),JSON.stringify(saved));
        assert.equal(x.writes.filter(w=>w.key===key).length,1);
      }
    }
    const restored=fixture({unindexed:true});
    assert.equal(await restored.window.MemphisScanSync.mutateProtectedWork(()=>{
      assert.equal(restored.ui.resolveOpenScanSession(device).state,'open');return true;
    }),true);
    assert.equal(JSON.parse(restored.localStorage.getItem(key)).sessions[0].session_uuid,id);
    assert.equal(restored.localStorage.getItem('session:'+id),restored.before['session:'+id]);
    assert.equal(restored.writes.filter(w=>w.key===key).length,1);
  });
  await run('post-callback-withdrawal-is-unknown-without-replay',async()=>{
    for(const change of ['session','queue','native']) {
      const x=fixture();let changed;
      x.afterWrite(()=>{
        if(x.writes.at(-1)?.key!==key)return;
        changed=Promise.resolve().then(()=>{
          if(change==='session')x.rawSet('session:'+id,'{ terminal foreign session }');
          if(change==='queue')x.window.MemphisScanSync={...x.window.MemphisScanSync};
          if(change==='native')x.window.MemphisMobileBuildIdentity={edition:'custodial'};
        });
      });
      assert.equal(await x.ui.clearScanView(id,device),false);await changed;
      assert.equal(x.writes.filter(w=>w.key===key).length,1);
      assert.equal(x.localStorage.getItem(key),null);
      if(change==='session')assert.equal(x.localStorage.getItem('session:'+id),'{ terminal foreign session }');
      assert.equal(x.active(),0);
    }
  });
  await run('missing-checkpoint-corrupt-index-and-native-never-fall-through',async()=>{
    for(const change of ['absent','writer','checkpoint','corrupt','native']) {
      const x=fixture(),queue=x.window.MemphisScanSync;
      if(change==='absent')delete x.window.MemphisScanSync;
      if(change==='writer')queue.mutateProtectedWork=null;
      if(change==='checkpoint')queue.requireLegacyBrowserMutation=null;
      if(change==='corrupt')x.rawSet(key,'{ retained malformed index }');
      if(change==='native')x.window.MemphisMobileBuildIdentity={edition:'custodial'};
      const before=x.originals();assert.equal(x.ui.indexScanSession(session),false);
      assert.equal(await x.ui.clearScanView(id,device),false);same(x.originals(),before);
      assert.equal(x.writes.filter(w=>w.key===key).length,0);assert.equal(x.active(),0);
    }
  });
  assert.ok(completed.length,'Unknown/empty browser preservation selector');
  console.log(JSON.stringify({status:'SCAN_BROWSER_PRESERVATION_SOURCE_VM_PASS',groups:completed.length,cases:completed,
    actual_ui_queue_admission:true,storage_locks_inventory_synthetic:true,browser:false,native:false,SQL:false,ACK:false}));
}

async function scanResumeWriterGateCases() {
  const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',device='KIOSK_08',key='mz_phone_scan_resume:'+device;
  const session={session_uuid:id,client_session_id:id,device_id:device,location_code:'NOCX',location_name:'Nocturnal',status:'active',updated_at:'2026-10-14T00:00:00Z'};
  const indexed=sessions=>JSON.stringify({schema_version:2,device_id:device,sessions:sessions.map(s=>({...s,view:'timer'})),updated_at:'2026-10-14T00:00:00Z'});
  const principal={schema_version:'custodial-protected-principal.v1',device_id:device,employee_id:'33333333-3333-4333-8333-333333333333',
    credential_id:'44444444-4444-4444-8444-444444444444',credential_operation_id:'55555555-5555-4555-8555-555555555555',assignment_epoch:1,
    installation_seal:'SYNTHETIC_source_installation',enrolled_at:'2026-10-14T00:00:00Z'};
  const selected=process.argv.find(arg=>arg.startsWith('--scan-writer-case='))?.slice('--scan-writer-case='.length),completed=[];
  const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
  function fixture({native=false,unindexed=false}={}) {
    const x=navigationRuntime({native}),s=x.localStorage,writes=[],jobs=[],errors=[];
    s.setItem('session:'+id,JSON.stringify(session));s.setItem('retained-unknown-row','{ original unknown }');
    if(!unindexed)s.setItem(key,indexed([session]));
    const original=()=>Object.fromEntries(Array.from({length:s.length},(_,i)=>s.key(i)).sort().map(k=>[k,s.getItem(k)]));
    const before=original(),{rawSet,rawRemove,observe}=storageFixtureControls.get(s);
    let failSet=false,afterSet=null,afterCallback=null;
    observe((phase,method,key,value)=>{
      if(phase==='before'){
        writes.push({method,key,...(method==='set'?{value}: {})});
        if(method==='set'&&failSet)throw Error('SYNTHETIC_SELECTIVE_WRITE_FAILURE');
      }else if(method==='set')afterSet?.();
    });
    const status={ready:true,available:true,quarantined:false,generation:1,deviceId:device,principal:{...principal}};
    const security={native:true,getStatus:()=>status,mutateProtectedWork:(operation,options)=>new Promise((resolve,reject)=>{jobs.push({operation,options,resolve,reject});})};
    function install() {x.window.MemphisCustodialSecurity=security;x.window.MemphisMobile={edition:'custodial',principalIdentity:()=>JSON.stringify(status.principal)};}
    async function flush() {while(jobs.length){const job=jobs.shift();let active=true;const generation=status.generation;
      try{assert.equal(job.options.requireEnrollment,true);assert.equal(job.options.expectedGeneration,generation);
        const context={generation,deviceId:device,assertCurrent:()=>{if(!active||status.generation!==generation||status.quarantined)throw Error('SYNTHETIC_ADMISSION_WITHDRAWAL');}};
        const result=await job.operation(context);afterCallback?.();job.resolve(result);
      }catch(error){errors.push(error);job.reject(error);}finally{active=false;}
    }await Promise.resolve();await Promise.resolve();}
    return {...x,before,original,writes,jobs,errors,status,security,install,flush,rawSet,rawRemove,failWrites:()=>{failSet=true;},afterWrite:fn=>{afterSet=fn;},afterCallback:fn=>{afterCallback=fn;}};
  }
  const originalPins=x=>Object.freeze({deviceId:x.status.deviceId,generation:x.status.generation,
    principalIdentity:x.window.MemphisMobile.principalIdentity(),sessionRaw:x.localStorage.getItem('session:'+id)});
  async function run(name,body){if(selected&&selected!==name)return;await body();completed.push(name);console.log(JSON.stringify({case:name,status:'PASS_SOURCE_VM_ONLY'}));}
  await run('native-preboot-has-no-raw-index-writer',async()=>{
    const x=fixture({native:true});assert.equal(x.ui.rememberScanView(session),false);
    assert.equal(x.ui.indexScanSession(session),false);x.ui.clearScanView(id,device);
    same(x.original(),x.before);assert.equal(x.writes.length,0);
    for(const malformed of ['non-native','writer','status','principal']){
      const y=fixture({native:true});y.install();
      if(malformed==='non-native')y.security.native=false;
      if(malformed==='writer')y.security.mutateProtectedWork=null;
      if(malformed==='status')y.security.getStatus=null;
      if(malformed==='principal')delete y.window.MemphisMobile.principalIdentity;
      assert.equal(y.ui.rememberScanView(session),false);y.ui.clearScanView(id,device);assert.equal(y.ui.indexScanSession(session),false);
      same(y.original(),y.before);assert.equal(y.writes.length,0);assert.equal(y.jobs.length,0);
    }
  });
  await run('native-sync-read-recovery-and-completion-remain-read-only',async()=>{
    const x=fixture({native:true,unindexed:true});x.install();
    const resolved=x.ui.resolveOpenScanSession(device);assert.equal(resolved.state,'open');assert.equal(resolved.session.session_uuid,id);
    assert.equal(x.localStorage.getItem(key),null);assert.equal(x.jobs.length,0);assert.equal(x.writes.length,0);
    const completedSession={...session,status:'saved_pending_sync',completion_pending:true};
    x.rawSet('session:'+id,JSON.stringify(completedSession));x.rawSet(key,indexed([session]));
    x.window.MemphisScanSync={isLocallyCompleted:s=>s?.status==='saved_pending_sync'};
    assert.equal(x.ui.resolveOpenScanSession(device).state,'none');assert.equal(x.localStorage.getItem(key),indexed([session]));
    assert.equal(x.jobs.length,0);assert.equal(x.writes.length,0);
    const remaining={...session,session_uuid:other,client_session_id:other,location_code:'AQUARIUM'};
    x.rawSet('session:'+other,JSON.stringify(remaining));
    assert.equal(x.ui.resolveOpenScanSession(device).session.session_uuid,other);
    assert.equal(x.localStorage.getItem(key),indexed([session]));assert.equal(x.jobs.length,0);assert.equal(x.writes.length,0);
  });
  await run('native-delayed-callback-pins-principal-generation-and-original-bytes',async()=>{
    for(const change of ['employee','credential','epoch','seal','generation','runtime','writer','reader','principal-reader','device','ready','quarantine','index','session']){
      const x=fixture({native:true});x.install();const pending=x.ui.indexScanSessionConfirmed(session,'complete',originalPins(x));
      assert.equal(x.jobs.length,1);same(x.original(),x.before);
      if(change==='employee')x.status.principal.employee_id=other;
      if(change==='credential')x.status.principal.credential_id=other;
      if(change==='epoch')x.status.principal.assignment_epoch++;
      if(change==='seal')x.status.principal.installation_seal='CHANGED_SYNTHETIC_installation';
      if(change==='generation')x.status.generation++;
      if(change==='runtime')delete x.window.MemphisCustodialSecurity;
      if(change==='writer')x.security.mutateProtectedWork=async()=>{};
      if(change==='reader')x.security.getStatus=()=>x.status;
      if(change==='principal-reader')x.window.MemphisMobile.principalIdentity=()=>JSON.stringify(x.status.principal);
      if(change==='device')x.status.deviceId='KIOSK_09';
      if(change==='ready')x.status.ready=false;
      if(change==='quarantine')x.status.quarantined=true;
      if(change==='index')x.rawSet(key,'{ changed original index }');
      if(change==='session')x.rawSet('session:'+id,'{ changed original session }');
      const changed=x.original();await x.flush();assert.equal(await pending,false);same(x.original(),changed);assert.equal(x.writes.length,0);
    }
  });
  await run('native-admitted-one-shot-index-writes-and-selective-clear',async()=>{
    const x=fixture({native:true});x.install();const pending=x.ui.indexScanSessionConfirmed(session,'complete',originalPins(x));
    assert.equal(x.jobs.length,1);assert.equal(x.writes.length,0);await x.flush();assert.equal(await pending,true);
    assert.equal(x.writes.length,1);assert.equal(JSON.parse(x.localStorage.getItem(key)).sessions[0].view,'complete');
    x.ui.clearScanView(id,device);assert.equal(x.jobs.length,1);await x.flush();
    assert.equal(x.localStorage.getItem(key),null);assert.equal(x.localStorage.getItem('session:'+id),x.before['session:'+id]);
    assert.equal(x.localStorage.getItem('retained-unknown-row'),x.before['retained-unknown-row']);
  });
  await run('failed-selective-cleanup-never-deletes-whole-index-or-replacement',async()=>{
    for(const native of [false,true]){
      const x=fixture({native});if(native)x.install();
      const second={...session,session_uuid:other,client_session_id:other,location_code:'AQUARIUM'};
      x.rawSet('session:'+other,JSON.stringify(second));x.rawSet(key,indexed([session,second]));const original=x.original();
      x.failWrites();x.ui.clearScanView(id,device);if(native)await x.flush();
      same(x.original(),original);assert.equal(x.writes.filter(w=>w.method==='remove').length,0);assert.equal(x.writes.length,1);
    }
    for(const native of [false,true]){
      const x=fixture({native});if(native)x.install();
      const second={...session,session_uuid:other,client_session_id:other,location_code:'AQUARIUM'};
      x.rawSet('session:'+other,JSON.stringify(second));x.rawSet(key,indexed([session,second]));
      x.afterWrite(()=>x.rawSet(key,'{ foreign replacement after uncertain write }'));
      x.ui.clearScanView(id,device);if(native)await x.flush();
      assert.equal(x.localStorage.getItem(key),'{ foreign replacement after uncertain write }');
      assert.equal(x.writes.length,1);assert.equal(x.writes.filter(w=>w.method==='remove').length,0);
      assert.equal(x.localStorage.getItem('session:'+id),x.before['session:'+id]);
      assert.equal(x.localStorage.getItem('retained-unknown-row'),x.before['retained-unknown-row']);
    }
  });
  await run('native-explicit-retirement-pins-stored-completion-before-admitted-write',async()=>{
    for(const change of ['none','session','predicate']){
      const x=fixture({native:true});x.install();
      const saved={...session,status:'saved_pending_sync',completion_pending:true};x.rawSet('session:'+id,JSON.stringify(saved));
      x.window.MemphisScanSync={isLocallyCompleted:s=>s?.status==='saved_pending_sync'};
      const pending=x.ui.retireCompletedScanViewConfirmed(saved,originalPins(x));assert.equal(x.jobs.length,1);assert.equal(x.writes.length,0);
      if(change==='session')x.rawSet('session:'+id,'{ changed completed original }');
      if(change==='predicate')x.window.MemphisScanSync.isLocallyCompleted=()=>true;
      const before=x.original();await x.flush();assert.equal(await pending,change==='none');
      if(change==='none'){assert.equal(JSON.parse(x.localStorage.getItem(key)).sessions.length,0);assert.equal(x.writes.length,1);assert.equal(x.localStorage.getItem('session:'+id),JSON.stringify(saved));}
      else{same(x.original(),before);assert.equal(x.writes.length,0);}
    }
  });
  await run('two-queued-native-updates-cannot-adopt-earlier-callback-write',async()=>{
    const x=fixture({native:true});x.install();
    const first=x.ui.indexScanSessionConfirmed(session,'complete',originalPins(x)),second=x.ui.indexScanSessionConfirmed(session,'timer',originalPins(x));
    assert.equal(x.jobs.length,2);assert.equal(x.writes.length,0);await x.flush();
    assert.equal(await first,true);assert.equal(await second,false);
    assert.equal(x.writes.length,1);assert.equal(JSON.parse(x.localStorage.getItem(key)).sessions[0].view,'complete');
    assert.equal(x.errors.length,1);assert.equal(x.localStorage.getItem('session:'+id),x.before['session:'+id]);
  });
  await run('native-evidence-loss-never-thaws-and-unmarked-web-stays-compatible',async()=>{
    const x=fixture({native:true});x.ui.rememberScanView(session);delete x.window.MemphisMobileBuildIdentity;
    assert.equal(x.ui.rememberScanView(session),false);x.ui.clearScanView(id,device);same(x.original(),x.before);assert.equal(x.writes.length,0);
    const web=fixture({unindexed:true});assert.equal(web.ui.resolveOpenScanSession(device).state,'open');assert.ok(web.localStorage.getItem(key));
    assert.equal(web.ui.rememberScanView(session,'complete'),true);assert.equal(web.ui.scanResumeView(session,device),'complete');
    web.ui.clearScanView(id,device);assert.equal(web.localStorage.getItem(key),null);
    assert.equal(web.ui.canonicalBackTarget().pathname,'/employee-hub.html');
  });
  await run('native-confirmed-writer-outside-original-callback',async()=>{
    // Source VM/recording owner only: original session writer settles BEFORE
    // the separate fixed index writer is admitted. Pins reject; they do not
    // supply a context, operation callback or authentication capability.
    const x=fixture({native:true});x.install();let pins,closedContext;
    const stored={...session,location_name:'Exact originally saved view'},storedRaw=JSON.stringify(stored);
    const saved=x.security.mutateProtectedWork(context=>{
      context.assertCurrent();closedContext=context;
      x.localStorage.setItem('session:'+id,storedRaw);
      pins=originalPins(x);
      assert.equal(x.ui.indexScanSession(stored,'complete'),false);
      assert.equal(x.ui.rememberScanView(stored,'complete'),false);
      assert.equal(x.jobs.length,0,'sync API must not enqueue under the original protected FIFO');
      context.assertCurrent();return true;
    },{requireEnrollment:true,expectedGeneration:1});
    await x.flush();assert.equal(await saved,true);assert.throws(()=>closedContext.assertCurrent());
    assert.equal(x.jobs.length,0);const writesBefore=x.writes.length;let settled=false;
    const confirmed=x.ui.indexScanSessionConfirmed({...stored,location_name:'Caller projection must not replace raw original'},'complete',pins)
      .then(result=>{settled=true;return result;});
    await Promise.resolve();assert.equal(settled,false);assert.equal(x.jobs.length,1);assert.equal(x.writes.length,writesBefore);
    await x.flush();assert.equal(await confirmed,true);assert.equal(x.jobs.length,0);assert.equal(x.writes.length,writesBefore+1);
    const indexedOriginal=JSON.parse(x.localStorage.getItem(key)).sessions[0];
    assert.equal(indexedOriginal.view,'complete');assert.equal(indexedOriginal.location_name,stored.location_name);
    assert.equal(x.localStorage.getItem('session:'+id),storedRaw);assert.equal(x.localStorage.getItem('retained-unknown-row'),x.before['retained-unknown-row']);
    for(const change of ['generation','principal','device','raw']){
      const y=fixture({native:true});y.install();const old=originalPins(y);
      if(change==='generation')y.status.generation++;
      if(change==='principal')y.status.principal.credential_id=other;
      if(change==='device')y.status.deviceId='KIOSK_09';
      if(change==='raw')y.rawSet('session:'+id,'{ replacement original session }');
      const before=y.original();assert.equal(await y.ui.indexScanSessionConfirmed(session,'complete',old),false);
      assert.equal(y.jobs.length,0);assert.equal(y.writes.length,0);same(y.original(),before);
    }
    for(const change of ['principal','raw']){
      const y=fixture({native:true});y.install();const pending=y.ui.indexScanSessionConfirmed(session,'complete',originalPins(y));
      assert.equal(y.jobs.length,1);
      if(change==='principal')y.status.principal.assignment_epoch++;
      else y.rawSet('session:'+id,'{ replacement during queued confirmation }');
      const before=y.original();await y.flush();assert.equal(await pending,false);assert.equal(y.writes.length,0);same(y.original(),before);
    }
    const retired=fixture({native:true});retired.install();
    const completedSession={...session,status:'saved_pending_sync',completion_pending:true};
    retired.rawSet('session:'+id,JSON.stringify(completedSession));
    retired.window.MemphisScanSync={isLocallyCompleted:s=>s?.status==='saved_pending_sync'};
    assert.equal(retired.ui.retireCompletedScanView(completedSession),false);assert.equal(retired.jobs.length,0);
    const retirement=retired.ui.retireCompletedScanViewConfirmed(completedSession,originalPins(retired));
    assert.equal(retired.jobs.length,1);assert.equal(retired.writes.length,0);await retired.flush();assert.equal(await retirement,true);
    assert.equal(JSON.parse(retired.localStorage.getItem(key)).sessions.length,0);
    assert.equal(retired.localStorage.getItem('session:'+id),JSON.stringify(completedSession));
    for(const change of ['lost-result','principal','index','session']){
      const y=fixture({native:true});y.install();
      y.afterCallback(()=>{
        if(change==='lost-result')throw Error('SYNTHETIC_POST_CALLBACK_UNKNOWN');
        if(change==='principal')y.status.principal.credential_id=other;
        if(change==='index')y.rawSet(key,'{ foreign index after callback }');
        if(change==='session')y.rawSet('session:'+id,'{ foreign session after callback }');
      });
      const pending=y.ui.indexScanSessionConfirmed(session,'complete',originalPins(y));await y.flush();
      assert.equal(await pending,false);assert.equal(y.jobs.length,0);assert.equal(y.writes.length,1,'uncertain effect must not retry or compensate');
      assert.equal(y.writes[0].method,'set');
      if(change==='index')assert.equal(y.localStorage.getItem(key),'{ foreign index after callback }');
      else assert.equal(JSON.parse(y.localStorage.getItem(key)).sessions[0].view,'complete');
      assert.equal(y.localStorage.getItem('session:'+id),change==='session'?'{ foreign session after callback }':y.before['session:'+id]);
      assert.equal(y.localStorage.getItem('retained-unknown-row'),y.before['retained-unknown-row']);
    }
    const web=fixture();assert.equal(web.ui.indexScanSession(session,'complete'),true);assert.equal(web.jobs.length,0);
  });
  assert.ok(completed.length>0,'Unknown/empty scan writer selector');
  console.log(JSON.stringify({status:'SCAN_RESUME_WRITER_GATE_SOURCE_VM_PASS',groups:completed.length,cases:completed,
    actual_memphis_ui:true,storage_runtime_principal_admission_synthetic:true,real_native:false,browser:false,SQL:false,network:false}));
}
