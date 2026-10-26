import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

if (process.argv[2] === '--native-bootstrap-writer-only') {
  await nativeBootstrapWriterCases();
} else {

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scriptMatch = html.match(/<script>\n([\s\S]*)\n\s*<\/script>/);
assert.ok(scriptMatch, 'scan page inline script should be extractable');
let script = scriptMatch[1];
const startupInvocation = /\n\s*guardedStart\(\)\.catch\(\(err\)=>\{[^\n]*\}\);/;
assert.match(script, startupInvocation, 'scan page startup invocation should be isolated by the unit harness');
script = script.replace(startupInvocation, '\n    // guardedStart() disabled for unit harness');
assert.doesNotMatch(script, startupInvocation, 'scan page startup must not execute inside the unit harness');
const attestationSeed = 'currentScanEntryAttestation=null';
assert.match(script, new RegExp(attestationSeed), 'assigned employee fixture must locate the scan attestation state');
script = script.replace(
  attestationSeed,
  'currentScanEntryAttestation={entry_id:"00000000-0000-4000-8000-000000000001",entry_source:"native-nfc"}'
);

const appNode = { innerHTML: '' };
const syncNode = { textContent: '', addEventListener() {} };
const debugNode = { innerHTML: '' };
const formNode = { addEventListener() {} };
const storage = new Map();
const locationState = {
  href: 'https://example.test/Engine/index.html?device=kiosk_02&code=AQUARIUM',
  search: '?device=kiosk_02&code=AQUARIUM',
  pathname: '/Engine/index.html',
  hostname: 'example.test'
};

const context = {
  console,
  URL,
  URLSearchParams,
  AbortController,
  setInterval() {},
  setTimeout(fn) { return fn(); },
  clearTimeout() {},
  navigator: { onLine: true },
  crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    key: (index) => Array.from(storage.keys())[index] || null,
    get length() { return storage.size; }
  },
  sessionStorage: {
    getItem: () => null,
    setItem() {}
  },
  location: locationState,
  window: {
    location: locationState,
    history: {
      replaceState(_state, _title, url) {
        locationState.href = `https://example.test${url}`;
        locationState.search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
      }
    },
    addEventListener() {}
  },
  document: {
    body: { style: { setProperty() {} } },
    getElementById(id) {
      if (id === 'app') return appNode;
      if (id === 'sync-badge') return syncNode;
      if (id === 'debug-panel') return debugNode;
      if (id === 'start-form') return formNode;
      return { addEventListener() {}, innerHTML: '', textContent: '' };
    }
  },
  fetch: async (_url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : {};
    if (body.fn === 'tool_list_active_employees') {
      return { ok: true, json: async () => ({ ok: true, data: [
        { display_name: 'Alijah Collins' },
        { display_name: 'Tammy Miller' },
        { display_name: 'Kinnaye Peete' },
        { display_name: 'Example Person - Example Title' }
      ] }) };
    }
    throw new Error(`unexpected fetch in test: ${body.fn || _url}`);
  }
};
context.window.window = context.window;
context.window.document = context.document;
context.window.localStorage = context.localStorage;
context.window.sessionStorage = context.sessionStorage;
context.globalThis = context;

vm.createContext(context);
vm.runInContext(script, context, { filename: 'index.html' });

assert.equal(context.normalizeDeviceIdentifier('kiosk_02'), 'KIOSK_02');
assert.equal(context.normalizeDeviceIdentifier('kiosk-5'), 'KIOSK_05');
assert.equal(context.normalizeDeviceIdentifier('KIOSK_10'), 'KIOSK_10');
assert.equal(context.normalizeDeviceIdentifier('1e74fe4c-dc20b3b9'), '1e74fe4c-dc20b3b9');
assert.equal(context.normalizeScanLocationCode('TETON'), 'TETX');
assert.equal(context.normalizeScanLocationCode('teton_rr'), 'TETM');
assert.equal(context.normalizeScanLocationCode('TETON_MENS_RESTROOM'), 'TETM');
assert.equal(context.normalizeScanLocationCode('AQUARIUM'), 'AQUARIUM');
assert.equal(context.scanLocationDisplayFallback('NOCX'), 'Nocturnal');
assert.equal(context.scanLocationDisplayFallback('AQUARIUM'), 'AQUARIUM');
assert.equal(
  context.savedScanDisplay('NOCX', 'KIOSK_08').location_name,
  'Nocturnal',
  'NOCX must never leak to the employee when no protected location label is cached',
);
assert.equal(context.scanEmployeeNameOnly('Example Person - Example Title'), 'Example Person');
assert.equal(context.scanEmployeeNameOnly('Second Example – Another Title'), 'Second Example');
assert.equal(context.scanEmployeeNameOnly('Kinnaye Peete'), 'Kinnaye Peete');
assert.equal(context.isReadonlyScanEmployeeDevice('KIOSK_01'), false);
assert.equal(context.isReadonlyScanEmployeeDevice('kiosk_02'), true);
assert.equal(context.isReadonlyScanEmployeeDevice('KIOSK_09'), true);
assert.equal(context.isReadonlyScanEmployeeDevice('KIOSK_10'), true);
assert.equal(context.isReadonlyScanEmployeeDevice('KIOSK_11'), false);

locationState.href = 'https://example.test/Engine/index.html?code=AQUARIUM&device=kiosk_01';
locationState.search = '?code=AQUARIUM&device=kiosk_01';
storage.clear();
assert.equal(context.resolveDeviceId(), 'KIOSK_01', 'startup should resolve and normalize the explicit scan device before lock/init work');
assert.equal(storage.get('mz_scan_device_id'), 'KIOSK_01');
assert.equal(storage.get('memphisAssignedDeviceId'), 'KIOSK_01');

locationState.href = 'https://example.test/Engine/index.html?code=AQUARIUM&device=KIOSK_05';
locationState.search = '?code=AQUARIUM&device=KIOSK_05';
context.window.fully = { getDeviceName: () => 'kiosk_05', getDeviceId: () => '9df6e8a3-9df6e8a3' };
context.fully = context.window.fully;
assert.equal(context.shouldUseKioskLockScreen(), false, 'NFC scan URLs must not auto-cover the scan workflow with the mock lock overlay');
assert.equal(context.shouldUseKioskLockScreen({ allowScanIntentWakeLock: true }), false, 'screen-off/wake prewarm must not re-cover physical scan URLs with the Scan App mock lock overlay');
locationState.href = 'https://example.test/Engine/index.html?code=AQUARIUM&device=KIOSK_05&lock=1';
locationState.search = '?code=AQUARIUM&device=KIOSK_05&lock=1';
assert.equal(context.shouldUseKioskLockScreen(), false, 'physical scan URLs must ignore lock=1 so a bad/stale NFC tag cannot cover the scan workflow');
locationState.href = 'https://example.test/Engine/index.html?device=KIOSK_05&lock=1';
locationState.search = '?device=KIOSK_05&lock=1';
assert.equal(context.shouldUseKioskLockScreen(), true, 'explicit lock=1 can still force the scan-page overlay only when no real scan code/session is present');
locationState.href = 'https://example.test/Engine/index.html?code=AQUARIUM&device=KIOSK_05&lock=0';
locationState.search = '?code=AQUARIUM&device=KIOSK_05&lock=0';
assert.equal(context.shouldUseKioskLockScreen(), false, 'explicit lock=0 should still suppress the scan-page overlay');
delete context.window.fully;
delete context.fully;
locationState.href = 'https://example.test/Engine/index.html?device=kiosk_02&code=AQUARIUM';
locationState.search = '?device=kiosk_02&code=AQUARIUM';

const resolvedDevice = await context.ensureDeviceIdInUrl();
assert.equal(resolvedDevice, 'KIOSK_02');
assert.equal(storage.get('mz_scan_device_id'), 'KIOSK_02');
assert.equal(storage.get('mz_employee_hub_device_id'), 'KIOSK_02');
assert.equal(storage.get('memphisAssignedDeviceId'), 'KIOSK_02');
assert.match(locationState.search, /device=KIOSK_02/);

storage.clear();
locationState.href = 'https://lasrevinu333-design.github.io/Engine/?code=TETM&device=';
locationState.search = '?code=TETM&device=';
locationState.pathname = '/Engine/';
locationState.hostname = 'lasrevinu333-design.github.io';
const fullyStub = { getDeviceId: () => '9df6e8a3-9df6e8a3', getDeviceName: () => 'kiosk_05' };
context.window.fully = fullyStub;
context.fully = fullyStub;
storage.set('mz_scan_device_id', 'KIOSK_01');
const blankDeviceScanResolvedDevice = await context.ensureDeviceIdInUrl();
assert.equal(blankDeviceScanResolvedDevice, 'KIOSK_05');
assert.equal(storage.get('mz_scan_device_id'), 'KIOSK_05');
assert.match(locationState.search, /device=KIOSK_05/);
assert.doesNotMatch(locationState.search, /device=(?:&|$)/);

delete context.window.fully;
delete context.fully;
locationState.hostname = 'example.test';
locationState.pathname = '/Engine/index.html';

locationState.href = 'https://example.test/Engine/index.html?code=TETON_MENS_RESTROOM';
locationState.search = '?code=TETON_MENS_RESTROOM';
storage.clear();
storage.set('mz_scan_device_id', 'KIOSK_05');
const storedScanResolvedDevice = await context.ensureDeviceIdInUrl();
assert.equal(storedScanResolvedDevice, 'KIOSK_05');
assert.match(locationState.search, /device=KIOSK_05/);

locationState.href = 'https://example.test/Engine/index.html?code=TETON_MENS_RESTROOM';
locationState.search = '?code=TETON_MENS_RESTROOM';
storage.clear();
context.window.fully = { getDeviceName: () => 'kiosk_05', getDeviceId: () => '9df6e8a3-9df6e8a3' };
context.fully = context.window.fully;
const fullyNameResolvedDevice = await context.ensureDeviceIdInUrl();
assert.equal(fullyNameResolvedDevice, 'KIOSK_05');
assert.equal(storage.get('mz_scan_device_id'), 'KIOSK_05');
assert.match(locationState.search, /device=KIOSK_05/);

delete context.window.fully;
delete context.fully;
locationState.href = 'https://example.test/Engine/index.html?code=TETON_MENS_RESTROOM';
locationState.search = '?code=TETON_MENS_RESTROOM';
storage.clear();
storage.set('memphisAssignedDeviceId', 'device-random-stale');
const blankScanResolvedDevice = await context.ensureDeviceIdInUrl();
assert.equal(blankScanResolvedDevice, '');
assert.doesNotMatch(locationState.search, /device=/);

assert.match(html, /\.scanEmployeeDisplay\{[^}]*text-align:center/, 'assigned scan employee display should be centered by CSS');
assert.match(
  html,
  /@media \(max-width:640px\)\{html\{font-size:(1[6-8])px\}/,
  'phone scan viewport should use a compact mobile font size instead of scaling larger than desktop'
);

for (let kioskNumber = 2; kioskNumber <= 10; kioskNumber += 1) {
  const kioskId = `KIOSK_${String(kioskNumber).padStart(2, '0')}`;
  const assignedName = `Assigned Employee ${kioskNumber}`;
  await context.renderEmployeeSelect({
    location_code: 'AQUARIUM',
    location_name: 'Aquarium Restrooms',
    assigned_device_employee_name: assignedName
  }, kioskId);
  assert.ok(
    appNode.innerHTML.includes(`<div class="location">Aquarium Restrooms</div><div class="employeeLine scanEmployeeDisplay">${assignedName}</div>`),
    `${kioskId} should center the assigned employee name directly below the location`
  );
  assert.ok(
    appNode.innerHTML.includes(`<input type="hidden" name="employee" value="${assignedName}" />`),
    `${kioskId} should preserve scan submit through a hidden employee field`
  );
  assert.doesNotMatch(appNode.innerHTML, /<select name="employee"/, `${kioskId} assigned scan page should not render an employee dropdown`);
  assert.doesNotMatch(appNode.innerHTML, /selected disabled>Select Employee Name/);
}

await context.renderEmployeeSelect({
  location_code: 'AQUARIUM',
  location_name: 'Aquarium Restrooms',
  assigned_device_employee_name: 'Example Person - Example Title'
}, 'KIOSK_03');
assert.ok(
  appNode.innerHTML.includes('<div class="location">Aquarium Restrooms</div><div class="employeeLine scanEmployeeDisplay">Example Person</div>'),
  'staff scan page should display only the employee name when the assigned-device label includes a title'
);
assert.ok(
  appNode.innerHTML.includes('<input type="hidden" name="employee" value="Example Person" />'),
  'staff scan submit should pass only the employee name, not the display title'
);
assert.doesNotMatch(appNode.innerHTML, /Example Title/, 'scan page must not show or submit title text');

await context.renderEmployeeSelect({
  location_code: 'AQUARIUM',
  location_name: 'Aquarium Restrooms',
  assigned_device_employee_name: 'Manager Should Not Be Locked'
}, 'KIOSK_01');
assert.match(appNode.innerHTML, /<select name="employee" required>/, 'KIOSK_01 should keep the employee dropdown for manager/control use');
assert.match(appNode.innerHTML, /<option value="" selected disabled>Select Employee Name<\/option>/, 'KIOSK_01 should keep no employee preselected');
assert.doesNotMatch(appNode.innerHTML, /Example Title/, 'manager/control scan dropdown should also strip titles from employee choices');
assert.doesNotMatch(appNode.innerHTML, /scanEmployeeDisplay/, 'KIOSK_01 should not render the read-only assigned employee display');
assert.doesNotMatch(appNode.innerHTML, /<input type="hidden" name="employee"/, 'KIOSK_01 should not submit a hidden preselected employee');

await context.renderEmployeeSelect({
  location_code: 'AQUARIUM',
  location_name: 'Aquarium Restrooms'
}, 'unassigned-phone');
assert.match(appNode.innerHTML, /<option value="" selected disabled>Select Employee Name<\/option>/);
assert.match(appNode.innerHTML, /Choose the employee\./);
assert.doesNotMatch(appNode.innerHTML, /Manager\/shared device|device id|technical/i);

console.log('scan-device-employee-default-tests passed');

}

async function nativeBootstrapWriterCases() {
  let groups = 0;
  const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  function fixture() {
    const storage = new Map([['mz_scan_device_id','KIOSK_09'],['memphisAssignedDeviceId','KIOSK_09']]);
    const location = { href:'https://example.test/index.html?device=KIOSK_08&code=AQUARIUM',search:'?device=KIOSK_08&code=AQUARIUM',pathname:'/index.html',hostname:'example.test' };
    let writes=0, navigations=0, fallbacks=0, admissionCalls=0, checkpoints=0;
    const window = { location, addEventListener(){}, MemphisCompletionTaxonomy:{services:()=>[],issues:()=>[]},
      history:{replaceState(_a,_b,url){navigations++;location.href='https://example.test'+url;location.search=url.includes('?')?url.slice(url.indexOf('?')):'';}},
      MemphisDeviceIdentity:{resolve(){fallbacks++;return {deviceId:'KIOSK_07'};}},
      MemphisDeviceReminders:{resolveDeviceId(){fallbacks++;return 'KIOSK_06';}},
      fully:{getDeviceName(){fallbacks++;return 'KIOSK_05';}} };
    const status = {ready:true,available:true,quarantined:false,state:'enrolled',deviceId:'KIOSK_02',generation:7,
      principal:{schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_02',
        employee_id:'00000000-0000-4000-8000-000000000001',credential_id:'00000000-0000-4000-8000-000000000002',
        credential_operation_id:'00000000-0000-4000-8000-000000000003',assignment_epoch:3,
        installation_seal:'synthetic-installation-seal',enrolled_at:'2026-10-14T12:00:00.000Z'}};
    const security = {native:true,getStatus(){return structuredClone(status);},async waitForStableState(){return security.getStatus();},
      async mutateProtectedWork(operation,options){admissionCalls++;assert.equal(options.expectedGeneration,7);
        const context=Object.freeze({deviceId:'KIOSK_02',generation:7,state:'enrolled',assertCurrent(){checkpoints++;}});
        return operation(context);}};
    const sandbox = {console,URL,URLSearchParams,AbortController,window,location,navigator:{onLine:true},
      localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){writes++;storage.set(k,String(v));},removeItem(){throw Error('no original removal');},
        key:i=>[...storage.keys()][i]||null,get length(){return storage.size;}},
      sessionStorage:{getItem:()=>null,setItem(){throw Error('no session write');}},
      document:{getElementById:()=>({innerHTML:'',textContent:'',addEventListener(){}})},
      setInterval(){throw Error('no timer');},setTimeout(){throw Error('no timer');},clearTimeout(){},
      fetch(){throw Error('no network');}};
    let script=page.match(/<script>\n([\s\S]*)\n\s*<\/script>/)[1];
    script=script.replace(/\n\s*guardedStart\(\)\.catch\(\(err\)=>\{[^\n]*\}\);/,'\n // original startup disabled by existing VM harness');
    vm.createContext(sandbox);vm.runInContext(script,sandbox,{filename:'index.html',timeout:1000});
    return {sandbox,window,security,status,storage,counters:()=>({writes,navigations,fallbacks,admissionCalls,checkpoints})};
  }
  const denied = async action => assert.rejects(action,error=>/^custodial_security_/.test(error.code));
  if(process.argv[3]==='checkpoint-required'){
    const variants=['missing',undefined,null,false,'not-a-checkpoint',{}];
    for(const checkpoint of variants){
      const f=fixture();f.window.MemphisCustodialSecurity=f.security;let rawCallbacks=0;
      f.security.mutateProtectedWork=async (operation,options)=>{
        assert.equal(options.expectedGeneration,7);
        const context={deviceId:'KIOSK_02',generation:7,state:'enrolled'};
        if(checkpoint!=='missing')Object.defineProperty(context,'assertCurrent',{value:checkpoint});
        return operation(Object.freeze(context));
      };
      await denied(()=>f.sandbox.mutateCustodialWork(()=>++rawCallbacks));
      assert.equal(rawCallbacks,0);assert.equal(f.counters().writes,0);
    }
    console.log(JSON.stringify({selector:'native-bootstrap-writer-only',member:'checkpoint-required',cases:1,variants:variants.length,result:'PASS',prior30:'NOT_REPLAYED',limits:'Actual shipping functions in VM; synthetic admission/status, not browser locks/native authority.'}));
    return;
  }
  for (const marker of ['mobile','build','platform','native']) {
    const f=fixture();
    if(marker==='mobile')f.window.MemphisMobile={edition:'custodial'};
    if(marker==='build')f.window.MemphisMobileBuildIdentity={edition:'custodial'};
    if(marker==='platform')f.window.Capacitor={isNativePlatform:()=>true};
    if(marker==='native')f.window.MemphisCustodialSecurity=f.security;
    if(marker==='native')assert.equal(f.sandbox.custodialSecurityPausedNow(),false);
    delete f.window.MemphisCustodialSecurity;
    let called=0;
    await denied(()=>f.sandbox.mutateCustodialWork(()=>++called));assert.equal(called,0);
    assert.equal(f.sandbox.custodialSecurityPausedNow(),true);
    assert.equal((await f.sandbox.custodialSecurityPause()).ready,false);
    assert.throws(()=>f.sandbox.persistDeviceId('KIOSK_10'),error=>/^custodial_security_/.test(error.code));
    assert.equal(f.sandbox.resolveDeviceId(),'');
    await denied(()=>f.sandbox.ensureDeviceIdInUrl());
    assert.deepEqual(f.counters(),{writes:0,navigations:0,fallbacks:0,admissionCalls:0,checkpoints:0});
    delete f.window.MemphisMobile;delete f.window.MemphisMobileBuildIdentity;delete f.window.Capacitor;
    await denied(()=>f.sandbox.mutateCustodialWork(()=>++called));assert.equal(called,0);groups++;
  }
  for(const bad of [null,{}, {native:false}, {native:true,getStatus:()=>null,waitForStableState:async()=>{},mutateProtectedWork:async()=>{throw Error('not admitted');}}]) {
    const f=fixture();f.window.MemphisMobile={edition:'custodial'};f.window.MemphisCustodialSecurity=bad;
    let called=0;await denied(()=>f.sandbox.mutateCustodialWork(()=>++called));assert.equal(called,0);
    assert.equal(f.sandbox.resolveDeviceId(),'');assert.equal(f.sandbox.custodialSecurityPausedNow(),true);groups++;
  }
  for(const change of [
    s=>{s.ready=false;},s=>{s.available=false;},s=>{s.quarantined=true;},s=>{s.generation=NaN;},
    s=>{s.principal=null;},s=>{s.principal.device_id='KIOSK_03';},s=>{s.principal.assignment_epoch=0;}
  ]) {
    const f=fixture();f.window.MemphisCustodialSecurity=f.security;change(f.status);
    let called=0;await denied(()=>f.sandbox.mutateCustodialWork(()=>++called));assert.equal(called,0);
    assert.equal(f.sandbox.resolveDeviceId(),'');await denied(()=>f.sandbox.ensureDeviceIdInUrl());assert.equal(f.counters().writes,0);groups++;
  }
  {
    const f=fixture();f.window.MemphisCustodialSecurity=f.security;let called=0;
    assert.equal(await f.sandbox.mutateCustodialWork(context=>{called++;assert.equal(context.deviceId,'KIOSK_02');return 'owned';}),'owned');
    assert.equal(called,1);assert.equal(f.counters().admissionCalls,1);assert.ok(f.counters().checkpoints>=2);
    assert.equal(f.sandbox.resolveDeviceId(),'KIOSK_02');f.sandbox.persistDeviceId('KIOSK_10');
    assert.equal(await f.sandbox.ensureDeviceIdInUrl(),'KIOSK_02');assert.match(f.window.location.search,/device=KIOSK_02/);
    assert.equal(f.counters().writes,0);assert.equal(f.counters().fallbacks,0);assert.equal(f.sandbox.custodialSecurityPausedNow(),false);
    assert.equal(await f.sandbox.custodialSecurityPause(),null);groups++;
  }
  for(const fault of ['replacement','generation','principal','device','unavailable','checkpoint']) {
    const f=fixture();f.window.MemphisCustodialSecurity=f.security;let release;
    const queued=new Promise(resolve=>{release=resolve;});let called=0;
    f.security.mutateProtectedWork=async (operation,options)=>{assert.equal(options.expectedGeneration,7);await queued;
      return operation({deviceId:'KIOSK_02',generation:7,state:'enrolled',assertCurrent(){if(fault==='checkpoint')throw Object.assign(Error('held'),{code:'custodial_security_state_unavailable'});}});};
    const pending=f.sandbox.mutateCustodialWork(()=>++called);
    if(fault==='replacement')f.window.MemphisCustodialSecurity={...f.security};
    if(fault==='generation')f.status.generation++;
    if(fault==='principal')f.status.principal.credential_id='00000000-0000-4000-8000-000000000004';
    if(fault==='device')f.status.deviceId='KIOSK_03';
    if(fault==='unavailable')delete f.window.MemphisCustodialSecurity;
    release();await denied(()=>pending);assert.equal(called,0);assert.equal(f.counters().writes,0);groups++;
  }
  {
    const f=fixture();f.window.MemphisCustodialSecurity=f.security;let settle;
    const reply=new Promise(resolve=>{settle=resolve;});let calls=0;
    const pending=f.sandbox.mutateCustodialWork(async()=>{calls++;await reply;return 'stale';});
    await Promise.resolve();f.status.generation++;settle();
    await denied(()=>pending);assert.equal(calls,1);assert.equal(f.counters().writes,0);groups++;
  }
  {
    const f=fixture();f.window.MemphisCustodialSecurity=f.security;let settle;
    f.security.waitForStableState=()=>new Promise(resolve=>{settle=resolve;});
    const paused=f.sandbox.custodialSecurityPause();f.window.MemphisCustodialSecurity={...f.security};settle();
    assert.equal((await paused).ready,false);groups++;
  }
  {
    const f=fixture();f.window.MemphisCustodialSecurity=f.security;const original=Error('original native failure');
    await assert.rejects(()=>f.sandbox.mutateCustodialWork(()=>{throw original;}),error=>error===original);
    assert.equal(f.counters().writes,0);groups++;
  }
  {
    const f=fixture();delete f.window.MemphisDeviceIdentity;delete f.window.fully;
    assert.equal(await f.sandbox.mutateCustodialWork(()=>42),42);assert.equal(f.sandbox.custodialSecurityPausedNow(),false);
    assert.equal(await f.sandbox.custodialSecurityPause(),null);assert.equal(f.sandbox.resolveDeviceId(),'KIOSK_08');
    assert.equal(f.storage.get('memphisAssignedDeviceId'),'KIOSK_08');assert.equal(await f.sandbox.ensureDeviceIdInUrl(),'KIOSK_08');
    assert.equal(f.sandbox.isReadonlyScanEmployeeDevice('KIOSK_02'),true);assert.equal(f.sandbox.isReadonlyScanEmployeeDevice('KIOSK_01'),false);groups++;
  }
  {
    const f=fixture();f.window.MemphisCustodialSecurity={native:false,getStatus:()=>({ready:false,available:false})};
    assert.equal(f.sandbox.custodialSecurityPausedNow(),true);assert.equal((await f.sandbox.custodialSecurityPause()).ready,false);
    assert.equal(await f.sandbox.mutateCustodialWork(()=>42),42);groups++;
  }
  {
    const f=fixture();f.window.Capacitor={isNativePlatform(){throw Error('unavailable platform');}};
    let called=0;await denied(()=>f.sandbox.mutateCustodialWork(()=>++called));delete f.window.Capacitor;
    await denied(()=>f.sandbox.mutateCustodialWork(()=>++called));assert.equal(called,0);groups++;
  }
  {
    const f=fixture();f.window.MemphisCustodialSecurity=f.security;let invoked=0;
    f.security.getStatus=()=>{const s=structuredClone(f.status);Object.defineProperty(s.principal,'employee_id',{get(){invoked++;return 'untrusted';},enumerable:true});return s;};
    await denied(()=>f.sandbox.mutateCustodialWork(()=>{throw Error('no operation');}));assert.equal(invoked,0);groups++;
  }
  {
    const f=fixture();f.window.MemphisCustodialSecurity=f.security;let called=0;
    await denied(()=>f.sandbox.mutateCustodialWork(()=>++called,{requireEnrollment:true,expectedGeneration:6}));
    assert.equal(called,0);assert.equal(f.counters().admissionCalls,0);groups++;
  }
  console.log(JSON.stringify({selector:'native-bootstrap-writer-only',groups,result:'PASS',limits:'Actual shipping functions in existing VM harness; synthetic security admission/status only, not real browser locks/native authority.'}));
}
