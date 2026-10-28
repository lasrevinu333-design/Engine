import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const identity = readFileSync(new URL(process.argv.includes('--browser-device-identity-old-source')
  ? '../../baseline/memphis-device-identity.js':'../memphis-device-identity.js', import.meta.url), 'utf8');
if (process.argv.includes('--optional-device-enrollment-only')) {
  await optionalEnrollmentCases();
} else if (process.argv.includes('--page-local-device-identity-writer-only')) {
  await browserDeviceIdentityWriterCases();
} else if (process.argv.includes('--browser-device-identity-writer-only')) {
  await browserDeviceIdentityWriterCases();
} else if (process.argv.includes('--native-device-identity-owner-only')) {
  await nativeDeviceIdentityOwnerCases();
} else {
const scan = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const resolverDefinitions = scan.match(/function\s+getFullyDeviceId\s*\(/g) || [];
assert.equal(resolverDefinitions.length, 1, 'index.html must define getFullyDeviceId exactly once');
assert.match(scan, /MemphisDeviceIdentity\?\.resolveFullyIdentifier/);

const resolver = scan.match(/function\s+getFullyDeviceId\s*\([^)]*\)\s*\{[\s\S]*?return'';\}/)?.[0] || '';
assert.ok(resolver, 'canonical getFullyDeviceId implementation must be present');
assert.ok(resolver.indexOf("'getDeviceId'") < resolver.indexOf("'getDeviceName'"), 'hardware ID must be checked before friendly device name');
assert.match(identity, /const fullyCanonical=fully\.find\(\(candidate\)=>isCanonicalKiosk\(candidate\.value\)\)/);
assert.match(identity, /if\(!enrollmentNeeded&&overlay\)/);
assert.match(identity, /enrollment_required:false[\s\S]*status_unavailable:true/);
assert.doesNotMatch(scan, /if\(typeof fully\.getDeviceName==="function"\)[\s\S]{0,500}if\(typeof fully\.getDeviceId==="function"\)/);

console.log('DEVICE_IDENTITY_FOUNDATION_TESTS_PASS');
}

async function nativeDeviceIdentityOwnerCases() {
  // Actual shipping IIFE in a source VM. All storage/native status/fetch ports
  // below are recording SYNTHETIC fixtures, not runtime authentication.
  const keys=['mz_scan_device_id','mz_employee_hub_device_id','memphisAssignedDeviceId'];
  const selected=process.argv.find(arg=>arg.startsWith('--identity-owner-case='))?.slice('--identity-owner-case='.length),done=[];
  const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
  function fixture({marker=false,platform=null,fully=false,fetch=false}={}) {
    const data=new Map([...keys.map(key=>[key,'KIOSK_09']),['unknown-original','{ retained unknown }']]),writes=[],requests=[],hardware=[];
    const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes.push([key,String(value)]);data.set(key,String(value));},removeItem:key=>{writes.push([key,null]);data.delete(key);}};
    const window={location:new URL('https://example.invalid/employee-hub.html?device=KIOSK_10')};
    if(marker)window.MemphisMobileBuildIdentity={edition:'custodial'};
    if(platform)window.Capacitor=platform;
    if(fully)window.fully={getDeviceId:()=>{hardware.push('getDeviceId');return 'KIOSK_07';}};
    const fetchPort=async(input,init)=>{requests.push({input,init});return {status:200,ok:true,headers:new Headers(),json:async()=>({ok:true,data:{authenticated:true}})};};
    if(fetch)window.fetch=fetchPort;
    vm.runInNewContext(identity,{window,localStorage:storage,navigator:{userAgent:fully?'FullyKiosk':'SourceVM'},URL,Request,Headers,console},{filename:'memphis-device-identity.js'});
    const pending=deferred(),status={ready:true,available:true,quarantined:false,generation:7,deviceId:'KIOSK_08',
      principal:{schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:'11111111-1111-4111-8111-111111111111',credential_id:'22222222-2222-4222-8222-222222222222',credential_operation_id:'33333333-3333-4333-8333-333333333333',assignment_epoch:1,installation_seal:'SYNTHETIC_IDENTITY_SOURCE_SEAL',enrolled_at:'2026-10-14T00:00:00Z'}};
    const security={native:true,ready:pending.promise,getStatus:()=>status};
    const mobile={edition:'custodial',ready:pending.promise,principalIdentity:()=>JSON.stringify(status.principal)};
    return {window,ui:window.MemphisDeviceIdentity,data,writes,requests,hardware,status,security,mobile,pending,fetchPort,
      install(){window.MemphisCustodialSecurity=security;window.MemphisMobile=mobile;},
      rows:()=>JSON.stringify([...data]),before:JSON.stringify([...data])};
  }
  const unavailable=result=>{assert.equal(result.deviceId,'');assert.equal(result.source,'protected_native_unavailable');};
  async function run(name,body){if(selected&&selected!==name)return;await body();done.push(name);console.log(JSON.stringify({case:name,status:'PASS_SOURCE_VM_ONLY'}));}
  await run('native-persist-refuses-foreign-caller-id',async()=>{
    const x=fixture({marker:true});x.install();assert.equal(x.ui.persist('KIOSK_09'),'');
    assert.equal(x.ui.persist('kiosk8'),'KIOSK_08');assert.equal(x.rows(),x.before);assert.equal(x.writes.length,0);
  });
  await run('native-bootstrap-and-platform-never-write-or-use-fallback',async()=>{
    for(const options of [{marker:true},{platform:{isNativePlatform:()=>true}},{platform:{getPlatform:()=> 'android'}},{platform:{getPlatform:()=> 'ios'}}]){
      const x=fixture({...options,fully:true,fetch:true});unavailable(x.ui.resolve());assert.equal(x.ui.persist('KIOSK_10'),'');
      assert.equal(x.ui.readStored(),'');assert.equal(x.ui.resolveFullyIdentifier(),'');unavailable(await x.ui.resolveReady());assert.equal(await x.ui.ready(),null);
      assert.equal(x.rows(),x.before);assert.equal(x.writes.length,0);assert.equal(x.hardware.length,0);assert.equal(x.requests.length,0);assert.equal(x.window.fetch,x.fetchPort);
    }
    for(const missing of ['native','status','principal','quarantine','generation','device','identity']){
      const x=fixture({marker:true});x.install();
      if(missing==='native')x.security.native=false;
      if(missing==='status')x.security.getStatus=null;
      if(missing==='principal')delete x.mobile.principalIdentity;
      if(missing==='quarantine')x.status.quarantined=true;
      if(missing==='generation')x.status.generation=0;
      if(missing==='device')x.status.principal.device_id='KIOSK_09';
      if(missing==='identity')x.mobile.principalIdentity=()=>'';
      unavailable(x.ui.resolve());assert.equal(x.ui.persist('KIOSK_08'),'');assert.equal(x.rows(),x.before);assert.equal(x.writes.length,0);
    }
  });
  await run('native-required-observation-cannot-thaw',async()=>{
    for(const evidence of ['marker','runtime','platform','unreadable']){
      const x=fixture({fully:true});
      if(evidence==='marker')x.window.MemphisMobileBuildIdentity={edition:'custodial'};
      if(evidence==='runtime')x.install();
      if(evidence==='platform')x.window.Capacitor={isNativePlatform:()=>true};
      if(evidence==='unreadable')Object.defineProperty(x.window,'MemphisMobileBuildIdentity',{configurable:true,get(){throw Error('SYNTHETIC_UNREADABLE_MARKER');}});
      x.ui.resolve();delete x.window.MemphisMobileBuildIdentity;delete x.window.Capacitor;delete x.window.MemphisMobile;delete x.window.MemphisCustodialSecurity;
      unavailable(x.ui.resolve());assert.equal(x.ui.persist('KIOSK_10'),'');assert.equal(x.ui.readStored(),'');assert.equal(x.ui.resolveFullyIdentifier(),'');
      assert.equal(x.rows(),x.before);assert.equal(x.writes.length,0);assert.equal(x.hardware.length,0);
    }
  });
  await run('native-ready-pins-original-owner-and-readiness',async()=>{
    for(const change of ['none','runtime','bridge','status-reader','principal-reader','native','security-ready','bridge-ready','generation','employee','credential','epoch','seal','device','not-ready','quarantine','reject']){
      const x=fixture({marker:true});x.install();const resolved=x.ui.resolveReady(),ready=x.ui.ready();
      if(change==='runtime')x.window.MemphisCustodialSecurity={...x.security};
      if(change==='bridge')x.window.MemphisMobile={...x.mobile};
      if(change==='status-reader')x.security.getStatus=()=>x.status;
      if(change==='principal-reader')x.mobile.principalIdentity=()=>JSON.stringify(x.status.principal);
      if(change==='native')x.security.native=false;
      if(change==='security-ready')x.security.ready=Promise.resolve();
      if(change==='bridge-ready')x.mobile.ready=Promise.resolve();
      if(change==='generation')x.status.generation++;
      if(change==='employee')x.status.principal.employee_id='44444444-4444-4444-8444-444444444444';
      if(change==='credential')x.status.principal.credential_id='44444444-4444-4444-8444-444444444444';
      if(change==='epoch')x.status.principal.assignment_epoch++;
      if(change==='seal')x.status.principal.installation_seal='OTHER_SYNTHETIC_INSTALLATION';
      if(change==='device')x.status.deviceId='KIOSK_09';
      if(change==='not-ready')x.status.ready=false;
      if(change==='quarantine')x.status.quarantined=true;
      if(change==='reject')x.pending.reject(Error('SYNTHETIC_READY_REFUSAL'));else x.pending.resolve();
      const result=await resolved,observation=await ready;
      if(change==='none'){assert.equal(result.deviceId,'KIOSK_08');assert.equal(result.source,'protected_native_credential');assert.equal(observation.deviceId,'KIOSK_08');}
      else{unavailable(result);assert.equal(observation,null);}
      assert.equal(x.rows(),x.before);assert.equal(x.writes.length,0);
    }
    const x=fixture({marker:true});x.window.MemphisMobile={edition:'custodial',ready:x.pending.promise};
    const oldRequest=x.ui.resolveReady();x.install();x.pending.resolve();unavailable(await oldRequest);assert.equal(x.writes.length,0);
    const startup=fixture({marker:true});startup.install();startup.status.ready=false;
    const starting=startup.ui.resolveReady();startup.status.ready=true;startup.pending.resolve();unavailable(await starting);
    assert.equal((await startup.ui.resolveReady()).deviceId,'KIOSK_08','a distinct explicit current-owner call is allowed');
  });
  await run('never-marked-web-keeps-identity-and-fetch-routing',async()=>{
    const x=fixture({fully:true,fetch:true});assert.notEqual(x.window.fetch,x.fetchPort);
    assert.equal(x.ui.resolve().deviceId,'KIOSK_07');assert.equal(x.writes.length,3);
    assert.equal(x.ui.persist('kiosk6'),'KIOSK_06');assert.equal(x.ui.readStored(),'KIOSK_06');
    assert.equal(await x.ui.ready(),null);assert.equal((await x.ui.resolveReady()).deviceId,'KIOSK_07');
    await x.window.fetch('https://memphis-zoo-mcp.onrender.com/example-read');
    assert.equal(x.requests.length,1);assert.equal(x.requests[0].input.headers.get('X-Device-Id'),'KIOSK_07');
    const external=fixture({fetch:true});await external.window.fetch('https://example.invalid/read',{method:'GET'});
    assert.equal(external.requests.length,1);assert.equal(external.requests[0].input,'https://example.invalid/read');
    assert.equal(external.data.get('unknown-original'),'{ retained unknown }');
  });
  assert.ok(done.length,'Unknown/empty native identity selector');
  console.log(JSON.stringify({status:'NATIVE_DEVICE_IDENTITY_OWNER_SOURCE_VM_PASS',groups:done.length,cases:done,
    production_iife:true,storage_principal_runtime_fetch_synthetic:true,real_requests:0,native:false,browser:false,SQL:false}));
}

async function browserDeviceIdentityWriterCases() {
  const pageOnly=process.argv.includes('--page-local-device-identity-writer-only');
  // Actual IIFE + actual existing browser owner; only the ports are synthetic.
  const {createProtectedBrowserAdmission,PROTECTED_BROWSER_MUTATION_KEY:EPOCH}=await import('../mobile/src/custodial/protected-browser-admission.js');
  const {createSyntheticScheduleLocks}=await import('./synthetic-schedule-locks.mjs');
  const {webcrypto}=await import('node:crypto');
  const keys=['mz_scan_device_id','mz_employee_hub_device_id','memphisAssignedDeviceId'];
  const ID='11111111-1111-4111-8111-111111111111',selected=process.argv.find(arg=>arg.startsWith('--identity-writer-case='))?.slice('--identity-writer-case='.length),done=[];
  const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};};
  const plain=value=>JSON.parse(JSON.stringify(value));
  function fixture({url='https://example.invalid/employee-hub.html?device=KIOSK_10',fully=false,rows}={}) {
    const writes=[],hardware=[];
    class Area {
      constructor(rows=[]){this.rows=new Map(rows);}
      get length(){return this.rows.size;}key(index){return [...this.rows.keys()][index]??null;}
      getItem(key){if(this.unreadable)throw Error('UNREADABLE_ORIGINAL_STORAGE');return this.rows.get(key)??null;}
      setItem(key,value){
        writes.push([key,String(value)]);this.beforeWrite?.(key,String(value));
        this.rows.set(key,String(value));this.afterWrite?.(key,String(value));
      }
    }
    const s=new Area(rows||[[keys[0],' kiosk9 '],[keys[1],'KIOSK_08'],[keys[2],'KIOSK_07'],['unknown-original','{ retained UNKNOWN }']]);
    const session=new Area(),locks=createSyntheticScheduleLocks(),navigator={userAgent:fully?'FullyKiosk':'SourceVM',locks};
    const window={location:new URL(url),localStorage:s,sessionStorage:session,navigator,
      indexedDB:{databases:async()=>[],open(){throw Error('NO_IDB_CREATION');}},crypto:webcrypto};
    if(fully)window.fully={getDeviceId:()=>{hardware.push('getDeviceId');return 'KIOSK_07';}};
    vm.runInNewContext(identity,{window,localStorage:s,navigator,URL,Request,Headers,console},{
      filename:'memphis-device-identity.js',
      importModuleDynamically:specifier=>import(new URL('../'+specifier,import.meta.url)),
    });
    const gate=createProtectedBrowserAdmission({storage:s,sessionStorage:session,indexedDb:window.indexedDB,locks,cryptoApi:webcrypto});
    return {window,s,locks,navigator,gate,ui:window.MemphisDeviceIdentity,writes,hardware,rows:()=>JSON.stringify([...s.rows])};
  }
  const unavailable=result=>{assert.equal(result.deviceId,'');assert.equal(result.source,'browser_persistence_unavailable');};
  const options=value=>({url:new URL('https://example.invalid/employee-hub.html?device='+value)});
  const run=async(name,body)=>{if(pageOnly!==name.startsWith('page-')||selected&&selected!==name)return;await body();done.push(name);console.log(JSON.stringify({case:name,status:'PASS_SOURCE_VM_ONLY'}));};
  function pageWriter(x,page){
    const source=readFileSync(new URL('../'+page,import.meta.url),'utf8');
    const config=source.match(/\bconst CONFIG=\{[^;\n]+\};/)?.[0];
    const normalize=source.split('\n').find(line=>line.trim().startsWith('function normalizeDeviceIdentifier('))?.trim();
    const begin=source.indexOf('function persistDeviceId(deviceId){'),end=source.indexOf('function resolveDeviceId()',begin);
    assert.ok(config&&normalize&&begin>=0&&end>begin,'exact existing page definitions must be present');
    const writer=source.slice(begin,end).trim();
    let native='';
    if(page==='index.html'){
      const first=source.indexOf('let scanNativeSecurityRequired=false;'),last=source.indexOf('function scanProtectedOwner(',first);
      assert.ok(first>=0&&last>first);native=source.slice(first,last);
    }else native=source.split('\n').find(line=>line.trim().startsWith('function protectedNativeDeviceId(')).trim();
    return vm.runInNewContext(config+'\n'+native+'\n'+normalize+'\n'+writer+'\npersistDeviceId',{
      window:x.window,localStorage:x.s,navigator:x.navigator,URL,console,
    },{filename:page+'#actual-persistDeviceId'});
  }
  for(const page of ['index.html','employee-hub.html'])await run('page-'+page+'-hold-refuses-direct-writes',async()=>{
    const x=fixture(),writer=pageWriter(x,page);await x.gate.holdAndObserve({operationId:ID});const before=x.rows();
    const value=writer('kiosk6');
    assert.equal(value,page==='index.html'?undefined:'KIOSK_06','preserve the actual synchronous page DATA shape');
    await new Promise(setImmediate);
    assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,0,'actual '+page+' writer must not bypass the shared hold');
    assert.equal(x.rows(),before);assert.equal(x.locks.pending,0);
  });
  function trackRequests(x){
    let count=0;const waiting=[],request=x.locks.request;
    x.locks.request=function(...args){
      count++;for(const item of waiting)if(count>=item.number)item.resolve();
      return request.apply(this,args);
    };
    return {get count(){return count;},when(number){
      if(count>=number)return Promise.resolve();const wait=deferred();waiting.push({number,resolve:wait.resolve});return wait.promise;
    }};
  }
  async function pageEffect(x,writer,value,tracker){
    const next=tracker.count+1,returned=writer(value);await tracker.when(next);
    await x.gate.mutate(()=>{});await new Promise(setImmediate);
    return returned; // Recorded terminal fixture state, NOT a public receipt.
  }
  const pageDataRows=()=>[[keys[0],'AAAAAA-BBBBBB'],[keys[1],'CCCCCC-DDDDDD'],[keys[2],'{ exact original third UNKNOWN }'],['unknown-original','{ retained UNKNOWN }']];
  await run('page-nonkiosk-verbatim-two-key-policy',async()=>{
    for(const page of ['index.html','employee-hub.html'])for(const value of ['ABCDEF-GHIJKL','kiosk 6','visitor-existing-raw']){
      const x=fixture({rows:pageDataRows()}),tracker=trackRequests(x),writer=pageWriter(x,page),third=x.s.rows.get(keys[2]);
      const returned=await pageEffect(x,writer,value,tracker);
      assert.equal(returned,page==='index.html'?undefined:value);
      assert.deepEqual(x.writes.filter(([key])=>keys.includes(key)),keys.slice(0,2).map(key=>[key,value]));
      assert.equal(x.s.rows.get(keys[2]),third);assert.equal(x.s.rows.get('unknown-original'),'{ retained UNKNOWN }');assert.equal(x.locks.pending,0);
    }
  });
  await run('page-kiosk-policy-writes-fixed-third-only',async()=>{
    for(const page of ['index.html','employee-hub.html']){
      const x=fixture(),tracker=trackRequests(x),writer=pageWriter(x,page);
      assert.equal(await pageEffect(x,writer,'kiosk6',tracker),page==='index.html'?undefined:'KIOSK_06');
      assert.deepEqual(x.writes.filter(([key])=>keys.includes(key)),keys.map(key=>[key,'KIOSK_06']));
      assert.equal(x.s.rows.get('unknown-original'),'{ retained UNKNOWN }');assert.equal(x.locks.pending,0);
    }
  });
  await run('page-absent-changed-or-unavailable-owner-has-no-fallback',async()=>{
    for(const page of ['index.html','employee-hub.html'])for(const loss of ['absent','missing','clone','denied']){
      const x=fixture(),writer=pageWriter(x,page),original=x.rows(),api=x.ui.persistPageDeviceId;
      if(loss==='absent')delete x.window.MemphisDeviceIdentity;
      if(loss==='missing')delete x.ui.persistPageDeviceId;
      if(loss==='clone')x.window.MemphisDeviceIdentity={...x.ui};
      if(loss==='denied')x.ui.persistPageDeviceId=()=>{throw Error('WITHDRAWN_SHARED_DATA_WRITER');};
      assert.equal(writer('kiosk6'),page==='index.html'?undefined:'KIOSK_06');
      assert.equal(api('KIOSK_06'),'','captured original API must refuse a changed published owner/method');
      await new Promise(setImmediate);assert.equal(x.rows(),original);assert.equal(x.writes.length,0);
    }
  });
  await run('page-original-third-resources-and-public-owner-withdrawal',async()=>{
    for(const page of ['index.html','employee-hub.html'])for(const loss of ['third','storage','request','owner','method','native']){
      const x=fixture({rows:pageDataRows()}),tracker=trackRequests(x),writer=pageWriter(x,page),entered=deferred(),release=deferred();
      const prior=x.gate.mutate(async()=>{entered.resolve();await release.promise;});await entered.promise;
      const next=tracker.count+1;assert.equal(writer('ABCDEF-GHIJKL'),page==='index.html'?undefined:'ABCDEF-GHIJKL');
      await tracker.when(next);
      if(loss==='third')x.s.rows.set(keys[2],'{ foreign third must not be adopted }');
      if(loss==='storage')x.window.localStorage={};
      if(loss==='request')x.locks.request=()=>{throw Error('WITHDRAWN_REQUEST');};
      if(loss==='owner')x.window.MemphisDeviceIdentity={...x.ui};
      if(loss==='method')x.ui.persistPageDeviceId=()=> '';
      if(loss==='native')x.window.MemphisMobileBuildIdentity={edition:'custodial'};
      const original=keys.map(key=>x.s.rows.get(key)),attempts=x.writes.filter(([key])=>keys.includes(key)).length;
      release.resolve();await prior;await new Promise(setImmediate);
      assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,attempts);
      assert.deepEqual(keys.map(key=>x.s.rows.get(key)),original);assert.equal(x.locks.pending,0);
    }
  });
  await run('page-partial-unknown-keeps-third-and-never-rebaselines',async()=>{
    for(const failure of ['before-first','after-first','foreign-third']){
      const x=fixture({rows:pageDataRows()}),tracker=trackRequests(x),writer=pageWriter(x,'employee-hub.html');
      const original=keys.map(key=>x.s.rows.get(key));
      x.s.beforeWrite=key=>{if(failure==='before-first'&&key===keys[0])throw Error('UNKNOWN_EFFECT');};
      x.s.afterWrite=key=>{
        if(key!==keys[0])return;
        if(failure==='after-first')throw Error('UNKNOWN_AFTER_FIRST');
        if(failure==='foreign-third')x.s.rows.set(keys[2],'{ foreign exact third }');
      };
      await pageEffect(x,writer,'ABCDEF-GHIJKL',tracker);
      const retained=keys.map(key=>x.s.rows.get(key)),attempts=x.writes.filter(([key])=>keys.includes(key)).length;
      assert.deepEqual(retained,failure==='before-first'?original:['ABCDEF-GHIJKL',original[1],failure==='foreign-third'?'{ foreign exact third }':original[2]]);
      assert.equal(writer('ABCDEF-GHIJKL'),'ABCDEF-GHIJKL');
      assert.equal(x.ui.persistPageDeviceId('MNOPQR-STUVWX'),'MNOPQR-STUVWX');
      unavailable(await x.ui.resolveReady({url:new URL('https://example.invalid/?device=ABCDEF-GHIJKL')}));
      await new Promise(setImmediate);assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,attempts);
      assert.deepEqual(keys.map(key=>x.s.rows.get(key)),retained);assert.equal(x.s.rows.get('unknown-original'),'{ retained UNKNOWN }');
    }
  });
  await run('page-policy-cannot-be-root-ready-settlement',async()=>{
    const x=fixture({rows:pageDataRows()}),tracker=trackRequests(x),writer=pageWriter(x,'employee-hub.html'),entered=deferred(),release=deferred();
    const prior=x.gate.mutate(async()=>{entered.resolve();await release.promise;});await entered.promise;
    const next=tracker.count+1;writer('ABCDEF-GHIJKL');
    const ready=x.ui.resolveReady({url:new URL('https://example.invalid/?device=ABCDEF-GHIJKL')});
    await tracker.when(next);release.resolve();await prior;
    assert.equal((await ready).deviceId,'ABCDEF-GHIJKL');
    assert.deepEqual(x.writes.filter(([key])=>keys.includes(key)),keys.map(key=>[key,'ABCDEF-GHIJKL']),'root must run its own three-key policy, not credit the page batch');
    const count=x.writes.length;
    assert.equal((await x.ui.resolveReady({url:new URL('https://example.invalid/?device=ABCDEF-GHIJKL')})).deviceId,'ABCDEF-GHIJKL');
    assert.equal(x.writes.length,count);
  });
  await run('page-same-value-withdraws-old-root-policy-not-adopts-it',async()=>{
    const x=fixture({rows:pageDataRows()}),tracker=trackRequests(x),writer=pageWriter(x,'index.html'),entered=deferred(),release=deferred(),third=x.s.rows.get(keys[2]);
    const prior=x.gate.mutate(async()=>{entered.resolve();await release.promise;});await entered.promise;
    const next=tracker.count+1,ready=x.ui.resolveReady({url:new URL('https://example.invalid/?device=ABCDEF-GHIJKL')});
    assert.equal(writer('ABCDEF-GHIJKL'),undefined);await tracker.when(next);
    release.resolve();await prior;unavailable(await ready);await x.gate.mutate(()=>{});await new Promise(setImmediate);
    assert.deepEqual(x.writes.filter(([key])=>keys.includes(key)),keys.slice(0,2).map(key=>[key,'ABCDEF-GHIJKL']));
    assert.equal(x.s.rows.get(keys[2]),third);
    assert.equal(writer('ABCDEF-GHIJKL'),undefined);await new Promise(setImmediate);
    assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,2);
  });
  await run('page-reentrant-policy-change-retains-partial-original',async()=>{
    const x=fixture({rows:pageDataRows()}),tracker=trackRequests(x),writer=pageWriter(x,'index.html'),original=keys.map(key=>x.s.rows.get(key));
    x.s.afterWrite=key=>{if(key===keys[0])x.ui.persist('ABCDEF-GHIJKL');};
    await pageEffect(x,writer,'ABCDEF-GHIJKL',tracker);
    unavailable(await x.ui.resolveReady({url:new URL('https://example.invalid/?device=ABCDEF-GHIJKL')}));
    assert.deepEqual(keys.map(key=>x.s.rows.get(key)),['ABCDEF-GHIJKL',original[1],original[2]]);
    assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,1);
  });
  await run('page-api-is-string-data-only-and-native-never-falls-back',async()=>{
    const x=fixture(),before=x.rows();let coerced=0;
    for(const invalid of ['',null,undefined,123,{toString(){coerced++;return 'KIOSK_06';}}])assert.equal(x.ui.persistPageDeviceId(invalid),'');
    assert.equal(coerced,0);assert.equal(x.rows(),before);
    for(const marker of ['custodial','platform','unreadable']){
      const n=fixture(),original=n.rows();
      if(marker==='custodial')n.window.MemphisMobileBuildIdentity={edition:'custodial'};
      if(marker==='platform')n.window.Capacitor={getPlatform:()=> 'android'};
      if(marker==='unreadable')Object.defineProperty(n.window,'MemphisMobileBuildIdentity',{configurable:true,get(){throw Error('UNREADABLE_NATIVE');}});
      assert.equal(n.ui.persistPageDeviceId('KIOSK_06'),'');
      delete n.window.MemphisMobileBuildIdentity;delete n.window.Capacitor;
      assert.equal(n.ui.persistPageDeviceId('KIOSK_06'),'');await new Promise(setImmediate);
      assert.equal(n.rows(),original);assert.equal(n.writes.length,0);
    }
  });
  for(const method of ['persist','resolve'])await run('web-'+method+'-cannot-write-through-shared-hold',async()=>{
    const x=fixture(),original=x.rows();await x.gate.holdAndObserve({operationId:ID});const held=x.rows();
    const value=method==='persist'?x.ui.persist('kiosk6'):x.ui.resolve();
    if(method==='persist'){assert.equal(value,'KIOSK_06');assert.equal(typeof value,'string');}
    else{assert.equal(value.deviceId,'KIOSK_10');assert.equal(value.source,'url_canonical');assert.equal(value.then,undefined);}
    await new Promise(setImmediate);
    assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,0,'PUBLIC '+method+' must not write the three identity keys through the real shared hold');
    unavailable(await x.ui.resolveReady(method==='persist'?options('KIOSK_06'):{}));
    assert.equal(x.rows(),held);assert.equal(x.s.rows.get('unknown-original'),'{ retained UNKNOWN }');assert.notEqual(held,original);
    assert.equal(x.locks.pending,0);
  });
  await run('web-sync-data-and-ready-join-one-original-attempt',async()=>{
    const x=fixture(),entered=deferred(),release=deferred();
    const prior=x.gate.mutate(async()=>{entered.resolve();await release.promise;});await entered.promise;
    const value=x.ui.persist('kiosk6');assert.equal(value,'KIOSK_06');assert.equal(typeof value,'string');
    assert.equal(x.ui.readStored(),'KIOSK_09','readonly storage must not adopt a pending selected identity');
    const source=options('KIOSK_06');let settled=false;
    const ready=x.ui.resolveReady(source).then(value=>{settled=true;return value;});
    await new Promise(setImmediate);assert.equal(settled,false);assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,0);
    source.url.searchParams.set('device','KIOSK_10'); // Captured DATA must not become this later identity.
    release.resolve();await prior;const result=await ready;
    assert.equal(result.deviceId,'KIOSK_06');assert.equal(result.source,'url_canonical');
    assert.deepEqual(x.writes.filter(([key])=>keys.includes(key)),keys.map(key=>[key,'KIOSK_06']));
    assert.equal(x.ui.readStored(),'KIOSK_06');assert.equal(x.s.rows.get('unknown-original'),'{ retained UNKNOWN }');assert.equal(x.locks.pending,0);
    assert.equal((await x.ui.resolveReady(options('KIOSK_06'))).deviceId,'KIOSK_06');
    assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,3,'settlement must join, never blindly repeat the writes');
  });
  await run('web-original-raw-and-owner-withdrawal-before-effect',async()=>{
    for(const change of ['raw','storage','reader','writer','locks','request','native','unreadable-native']){
      const x=fixture(),entered=deferred(),release=deferred();
      const prior=x.gate.mutate(async()=>{entered.resolve();await release.promise;});await entered.promise;
      const ready=x.ui.resolveReady(options('KIOSK_06'));await new Promise(setImmediate);
      if(change==='raw')x.s.rows.set(keys[1],'{ foreign exact identity row }');
      if(change==='storage')x.window.localStorage={};
      if(change==='reader')x.s.getItem=function(key){return this.rows.get(key)??null;};
      if(change==='writer')x.s.setItem=function(key,value){this.rows.set(key,String(value));};
      if(change==='locks')x.navigator.locks=createSyntheticScheduleLocks();
      if(change==='request')x.locks.request=()=>{throw Error('REPLACED_REQUEST');};
      if(change==='native')x.window.MemphisMobileBuildIdentity={edition:'custodial'};
      if(change==='unreadable-native')Object.defineProperty(x.window,'MemphisMobileBuildIdentity',{configurable:true,get(){throw Error('UNREADABLE_NATIVE_MARKER');}});
      const original=keys.map(key=>x.s.rows.get(key));release.resolve();await prior;unavailable(await ready);
      assert.deepEqual(keys.map(key=>x.s.rows.get(key)),original);assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,0);
      assert.equal(x.s.rows.get('unknown-original'),'{ retained UNKNOWN }');assert.equal(x.locks.pending,0);
      if(change==='native'||change==='unreadable-native'){
        delete x.window.MemphisMobileBuildIdentity;assert.equal(x.ui.persist('KIOSK_06'),'');
        assert.equal((await x.ui.resolveReady(options('KIOSK_06'))).source,'protected_native_unavailable');
      }
    }
  });
  await run('web-partial-or-unknown-save-is-retained-without-retry',async()=>{
    for(const failure of ['before-first','after-first','before-second','foreign-other-row','epoch','owner']){
      const x=fixture();const original=keys.map(key=>x.s.rows.get(key));let effects=0;
      x.s.beforeWrite=key=>{
        if(!keys.includes(key))return;
        if(failure==='before-first'||failure==='before-second'&&key===keys[1])throw Error('UNKNOWN_WRITE_PREREQUISITE');
      };
      x.s.afterWrite=key=>{
        if(!keys.includes(key))return;effects++;
        if(failure==='after-first'&&key===keys[0])throw Error('UNKNOWN_AFTER_EFFECT');
        if(failure==='foreign-other-row'&&key===keys[0])x.s.rows.set(keys[2],'{ foreign successor }');
        if(failure==='epoch'&&key===keys[2])x.s.rows.set(EPOCH,'999');
        if(failure==='owner'&&key===keys[2])x.navigator.locks=createSyntheticScheduleLocks();
      };
      unavailable(await x.ui.resolveReady(options('KIOSK_06')));
      const retained=keys.map(key=>x.s.rows.get(key)),attempts=x.writes.filter(([key])=>keys.includes(key)).length;
      if(failure==='before-first'){assert.equal(effects,0);assert.deepEqual(retained,original);}
      if(failure==='after-first'||failure==='before-second'){assert.deepEqual(retained,['KIOSK_06',original[1],original[2]]);assert.equal(effects,1);}
      if(failure==='foreign-other-row'){assert.deepEqual(retained,['KIOSK_06',original[1],'{ foreign successor }']);assert.equal(effects,1);}
      if(failure==='epoch'||failure==='owner'){assert.deepEqual(retained,keys.map(()=> 'KIOSK_06'));assert.equal(effects,3);}
      unavailable(await x.ui.resolveReady(options('KIOSK_06')));
      assert.equal(x.ui.persist('KIOSK_07'),'KIOSK_07');unavailable(await x.ui.resolveReady(options('KIOSK_07')));
      assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,attempts,'unknown persistence cannot trigger a retry/rebaseline/rollback');
      assert.deepEqual(keys.map(key=>x.s.rows.get(key)),retained);assert.equal(x.s.rows.get('unknown-original'),'{ retained UNKNOWN }');
    }
  });
  await run('web-writer-retains-lock-through-all-three-effects',async()=>{
    const x=fixture();let held;
    x.s.afterWrite=key=>{if(key===keys[0])held=x.gate.holdAndObserve({operationId:ID});};
    const result=await x.ui.resolveReady(options('KIOSK_06'));assert.ok(held);await held;
    const attempts=x.writes.filter(([key])=>keys.includes(key));
    assert.deepEqual(attempts,keys.map(key=>[key,'KIOSK_06']));
    assert.deepEqual(keys.map(key=>x.s.rows.get(key)),keys.map(()=> 'KIOSK_06'));
    // A later hold can make terminal confirmation unavailable, never a partial
    // callback or an admission/ACK witness. Original fixed data stays retained.
    assert.ok(result.deviceId===''||result.deviceId==='KIOSK_06');
    assert.equal(x.locks.pending,0);assert.equal(x.s.rows.get('unknown-original'),'{ retained UNKNOWN }');
  });
  await run('web-resolver-precedence-is-original-data',async()=>{
    const cases=[
      {fixture:{fully:true},expected:'KIOSK_07',source:'fully_device_id'},
      {fixture:{},expected:'KIOSK_10',source:'url_canonical'},
      {fixture:{url:'https://example.invalid/employee-hub.html'},expected:'KIOSK_09',source:'storage_canonical'},
      {fixture:{url:'https://example.invalid/employee-hub.html?device=ABCDEF-GHIJKL',rows:[]},expected:'ABCDEF-GHIJKL',source:'url'},
      {fixture:{url:'https://example.invalid/employee-hub.html',rows:[]},expected:'',source:'unconfigured'},
    ];
    for(const row of cases){
      const x=fixture(row.fixture),value=x.ui.resolve();assert.equal(value.then,undefined);
      assert.equal(value.deviceId,row.expected);assert.equal(value.source,row.source);
      const ready=await x.ui.resolveReady();assert.equal(ready.deviceId,row.expected);assert.equal(ready.source,row.source);
      assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,row.expected?3:0);
    }
  });
  await run('web-missing-raw-owner-and-ignored-call-never-confirm',async()=>{
    for(const failure of ['read','locks','raw-wrapper']){
      const x=fixture(),unhandled=[],listener=error=>unhandled.push(error);
      if(failure==='read')x.s.unreadable=true;
      if(failure==='locks')delete x.navigator.locks;
      if(failure==='raw-wrapper')Object.defineProperty(x.s,'setItem',{value:(key,value)=>x.s.rows.set(key,String(value))});
      process.on('unhandledRejection',listener);
      try{
        assert.equal(x.ui.persist('KIOSK_06'),'KIOSK_06');unavailable(await x.ui.resolveReady(options('KIOSK_06')));
        void x.ui.persist('KIOSK_06');await new Promise(setImmediate);assert.equal(unhandled.length,0);
        assert.equal(x.writes.filter(([key])=>keys.includes(key)).length,0);
      }finally{process.removeListener('unhandledRejection',listener);}
    }
  });
  assert.ok(done.length,'Unknown/empty browser identity selector');
  console.log(JSON.stringify({status:'BROWSER_DEVICE_IDENTITY_WRITER_SOURCE_VM_PASS',groups:done.length,cases:done,
    real_requests:0,native:false,browser:false,SQL:false}));
}

async function optionalEnrollmentCases(){
  // Execute the owning UI admission functions, with recording status/dialog
  // ports only. No browser identity, enrollment code, request or policy change.
  const block=(a,b)=>identity.slice(identity.indexOf(a),identity.indexOf(b,identity.indexOf(a)));
  const code=block('  function optionalEnrollment(status){','  async function refreshCredentialStatus(')
    +block('  async function ensureCredential(','  if(hasDom&&hasNativeFetch');
  const cases=[
    ['observe optional',{authenticated:false,enrollment_required:false,policy_mode:'observe',canonical_device_id:'KIOSK_02'},true,true],
    ['required enroll',{authenticated:false,enrollment_required:true,policy_mode:'enroll',canonical_device_id:'KIOSK_02'},true,true],
    ['required enforce',{authenticated:false,enrollment_required:true,policy_mode:'enforce',canonical_device_id:'KIOSK_02'},true,true],
    ['unassigned status unavailable',null,false,false],
    ['authenticated',{authenticated:true,enrollment_required:false,policy_mode:'observe',canonical_device_id:'KIOSK_02'},false,false],
    ['manager device',{authenticated:false,enrollment_required:false,policy_mode:'observe',canonical_device_id:'KIOSK_01'},false,false],
    ['foreign current device',{authenticated:false,enrollment_required:false,policy_mode:'observe',canonical_device_id:'KIOSK_03'},false,false],
    ['failed status',{authenticated:false,enrollment_required:false,policy_mode:'observe',canonical_device_id:'KIOSK_02',status_unavailable:true},false,false],
    ['unknown policy',{authenticated:false,enrollment_required:false,policy_mode:'unknown',canonical_device_id:'KIOSK_02'},false,false],
    ['unverified auth field',{enrollment_required:false,policy_mode:'observe',canonical_device_id:'KIOSK_02'},false,false],
  ];let checks=0;
  for(const [name,status,visible,dialog]of cases){
    const banner={hidden:true,textContent:''},overlay={hidden:true,querySelector:()=>null},shown=[],refreshes=[];
    const context={credentialStatus:status,banner,overlay,enrollmentPromise:null,
      isEmployeeKiosk:x=>/^KIOSK_(0[2-9]|10)$/.test(x||''),currentDeviceId:()=> 'KIOSK_02',
      ready:fn=>fn(),installUi:()=>true,isNativeCustodialSecurity:()=>false,
      refreshCredentialStatus:async options=>{refreshes.push(options);return status;},
      showEnrollmentDialog:async value=>{shown.push(value);return true;}};
    vm.runInNewContext(code+';globalThis.ui={updateBanner,ensureCredential};',context);
    context.ui.updateBanner();assert.equal(!banner.hidden,visible,name+' visible ordinary control');checks++;
    await context.ui.ensureCredential({interactive:true,force:true});assert.equal(shown.length,dialog?1:0,name+' normal dialog admission');checks++;
    assert.equal(refreshes.length,1,name+' revalidates normal status');checks++;
  }
  for(const mode of ['observe','enforce']){
    const status={authenticated:false,enrollment_required:mode==='enforce',policy_mode:mode,canonical_device_id:'KIOSK_02'},shown=[];
    const c={credentialStatus:status,banner:{},overlay:{},enrollmentPromise:null,isEmployeeKiosk:()=>true,currentDeviceId:()=> 'KIOSK_02',ready:f=>f(),installUi:()=>true,isNativeCustodialSecurity:()=>false,refreshCredentialStatus:async()=>status,showEnrollmentDialog:async()=>{shown.push(true);return true;}};
    vm.runInNewContext(code+';globalThis.run=ensureCredential;',c);await c.run({interactive:false,force:true});assert.equal(shown.length,mode==='enforce'?1:0,'optional enrollment requires user action; enforce retains automatic path');checks++;
  }
  assert.match(identity,/credentialStatus=null;updateBanner\(\);return null;/,'failed or unassigned status clears stale optional UI');checks++;
  console.log(JSON.stringify({result:'OPTIONAL_OBSERVE_DEVICE_ENROLLMENT_OWNING_UI_PASS',checks,scope:'Recording synthetic status/dialog ports only; no browser, enrollment code, network, SQL or policy change'}));
}
