import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const load = (name) => fs.readFileSync(path.resolve(scriptDir, `../${name}`), 'utf8');

if (process.argv.includes('--phone-metadata-writer-only')) {
  await phoneMetadataWriterCases();process.exit(0);
}

async function phoneMetadataWriterCases() {
  const { createProtectedBrowserAdmission } = await import('../mobile/src/custodial/protected-browser-admission.js');
  const { createSyntheticScheduleLocks } = await import('./synthetic-schedule-locks.mjs');
  const source = load('memphis-ui.js'), selected = process.argv.find(x => x.startsWith('--phone-metadata-case='))?.split('=').slice(1).join('=');
  const start = source.includes('  const PHONE_METADATA_KEYS') ? source.indexOf('  const PHONE_METADATA_KEYS') : source.indexOf('  function markPhoneUnlocked(');
  const body = source.slice(start, source.indexOf('  function handlePhoneVisibilityChange(', start));
  const ownerStart = source.indexOf('  function scanWriterUnavailable('), ownerEnd = source.indexOf('  // Only scan-index metadata', ownerStart);
  const done = [], deferred = () => { let resolve, reject;const promise = new Promise((r, j) => { resolve = r;reject = j; });return { promise, resolve, reject }; };
  function fixture() {
    class Storage {
      rows = new Map();effects = [];
      getItem(key) { return this.rows.get(key) ?? null; }
      setItem(key, value) { this.effects.push(['set', key, value]);this.rows.set(key, String(value));this.after?.(); }
      removeItem(key) { this.effects.push(['remove', key]);this.rows.delete(key);this.after?.(); }
    }
    const local = new Storage(), session = new Storage(), locks = createSyntheticScheduleLocks();
    const gate = createProtectedBrowserAdmission({ storage: local, locks });
    let device = 'KIOSK_06', native = false, generation = 1, principal = 'original', active = false, nav = 0;
    const status = () => ({ ready: true, available: true, quarantined: false, generation, deviceId: device, principal: { device_id: device } });
    const mobile = { principalIdentity: () => principal };
    const security = { native: true, getStatus: status,
      mutateProtectedWork: operation => gate.mutate(() => operation({ deviceId: device, generation,
        assertCurrent() { gate.requireMutation(); } })) };
    const queue = { requireLegacyBrowserMutation: () => gate.requireMutation(),
      mutateProtectedWork: operation => gate.mutate(async () => {
        const original = device;active = true;
        try { return await operation({ deviceId: original, generation: null, state: 'legacy',
          assertCurrent() { assert.equal(active, true);assert.equal(device, original);gate.requireMutation(); } }); }
        finally { active = false; }
      }) };
    const window = { localStorage: local, sessionStorage: session, MemphisScanSync: queue, MemphisMobile: mobile,
      location: { href: 'https://localhost/employee-hub.html?device=KIOSK_06', replace() { nav++; } } };
    Object.defineProperty(window, 'MemphisCustodialSecurity', { get: () => native ? security : null });
    const api = vm.runInNewContext(`const PHONE_UNLOCKED_KEY='mz_phone_unlocked_since_wake',PHONE_SCREEN_OFF_KEY='mz_phone_screen_off_at',PHONE_NAVIGATION_KEY='mz_phone_wake_navigation';let phoneWakeNavigationAt=0;
      ${source.slice(ownerStart, ownerEnd)}\n${body}\n({markPhoneUnlocked,markPhoneScreenOff,handlePhoneWake,phoneUnlockedSinceWake})`, {
      window, localStorage: local, sessionStorage: session, URL, Date, Object, Number, Promise,
      isNativeCustodialAuthority: () => native, normalizePhoneDeviceId: value => value,
      isManagedKioskPhone: () => /^KIOSK_\d{2}$/.test(device), phoneDeviceId: () => device,
      buildPhoneWakeTarget: () => new URL('https://localhost/employee-hub.html?device='+device+'&lock=1'),
    });
    return { api, window, queue, gate, local, session, locks, nav: () => nav,
      setDevice: value => { device = value; }, setNative: value => { native = value; }, setPrincipal: value => { principal = value; }, setGeneration: value => { generation = value; } };
  }
  const drain = async x => { await new Promise(setImmediate);await x.gate.mutate(() => {});await new Promise(setImmediate); };
  const run = async (name, test) => { if (selected && selected !== name) return;await test();done.push(name);console.log(JSON.stringify({ case: name, status: 'PASS_SOURCE_VM_ONLY' })); };
  await run('held-session-markers-and-wake-remain-original', async () => {
    for (const action of ['markPhoneUnlocked', 'markPhoneScreenOff', 'handlePhoneWake']) {
      const x = fixture();x.session.rows.set('mz_phone_unlocked_since_wake', '1');x.session.rows.set('mz_phone_screen_off_at', '12345');
      await x.gate.holdAndObserve({ operationId: '11111111-2222-4333-8444-555555555555' });
      const original = [...x.session.rows];await x.api[action]({ force: true });await new Promise(setImmediate);
      assert.deepEqual(x.session.effects, [], action+' cannot bypass the actual shared hold');
      assert.deepEqual([...x.session.rows], original);assert.equal(x.nav(), 0);
    }
  });
  await run('ordered-unlock-screen-off-wake-and-navigation-cleanup', async () => {
    const x = fixture();assert.equal(x.api.markPhoneUnlocked(), true);await drain(x);
    assert.equal(x.api.phoneUnlockedSinceWake(), true);
    assert.equal(x.api.markPhoneScreenOff(), true);await drain(x);
    assert.equal(x.api.phoneUnlockedSinceWake(), false);
    assert.equal(await x.api.handlePhoneWake({ force: true }), true);assert.equal(x.nav(), 1);
    assert.equal(x.session.getItem('mz_phone_screen_off_at'), null);assert.equal(x.session.getItem('mz_phone_wake_navigation'), '1');
    assert.equal(await x.api.handlePhoneWake({ force: false }), false);
    assert.equal(x.session.getItem('mz_phone_wake_navigation'), null);assert.equal(x.nav(), 1);
  });
  await run('queued-receiver-storage-method-and-native-owner-withdrawal', async () => {
    for (const loss of ['receiver', 'session', 'method', 'queue', 'native']) {
      const x = fixture(), entered = deferred(), release = deferred();
      const prior = x.gate.mutate(async () => { entered.resolve();await release.promise; });await entered.promise;
      const pending = x.api.handlePhoneWake({ force: true });await new Promise(setImmediate);
      if (loss === 'receiver') x.setDevice('KIOSK_07');
      if (loss === 'session') x.window.sessionStorage = {};
      if (loss === 'method') x.session.setItem = () => { throw Error('successor must not receive an effect'); };
      if (loss === 'queue') x.window.MemphisScanSync = { ...x.queue };
      if (loss === 'native') x.setNative(true);
      release.resolve();await prior;assert.equal(await pending, false);
      assert.deepEqual(x.session.effects, []);assert.equal(x.nav(), 0);
    }
  });
  await run('unknown-effect-retains-partial-no-retry-or-navigation', async () => {
    const x = fixture();x.session.rows.set('mz_phone_unlocked_since_wake', '1');
    x.session.after = () => { throw Error('unknown after effect'); };
    x.api.markPhoneScreenOff();await drain(x);const original = [...x.session.rows], effects = x.session.effects.length;
    x.api.markPhoneUnlocked();assert.equal(await x.api.handlePhoneWake({ force: true }), false);await drain(x);
    assert.equal(x.session.effects.length, effects);assert.deepEqual([...x.session.rows], original);assert.equal(x.nav(), 0);
  });
  await run('native-current-owner-and-unknown-metadata-retained', async () => {
    const x = fixture();x.setNative(true);x.api.markPhoneScreenOff();await drain(x);
    assert.ok(x.session.getItem('mz_phone_screen_off_at'));
    const y = fixture();y.session.rows.set('mz_phone_screen_off_at', '{ unknown retained original }');
    const original = [...y.session.rows];y.api.markPhoneScreenOff();await drain(y);
    assert.equal(await y.api.handlePhoneWake({ force: true }), false);assert.deepEqual([...y.session.rows], original);assert.deepEqual(y.session.effects, []);
  });
  await run('actual-page-callers-await-wake-result-before-relock', async () => {
    for (const page of ['index.html', 'employee-hub.html']) for (const accepted of [false, true, 'unavailable']) for (const force of [false, true]) {
      const handler = load(page).split('\n').find(line => line.includes('function handleKioskWakeRelock('));
      assert.ok(handler);let relocks = 0, called = 0;const reply = deferred();
      const wake = vm.runInNewContext(`let kioskScreenOffResetPending=false;${handler};handleKioskWakeRelock`, {
        window: { MemphisUI: { handlePhoneWake() { called++;return reply.promise; } } },
        relockKioskScreen() { relocks++; },
      });
      const pending = wake({ persisted: force });assert.equal(called, 1);assert.equal(relocks, force ? 1 : 0);
      if (accepted === 'unavailable') reply.reject(Error('UI unavailable'));else reply.resolve(accepted);
      await pending;assert.equal(relocks, force || accepted !== true ? 1 : 0);
    }
  });
  await run('overlapping-lifecycle-events-settle-in-original-order', async () => {
    const x = fixture();x.api.markPhoneUnlocked();x.api.markPhoneScreenOff();
    assert.equal(await x.api.handlePhoneWake({ force: true }), true);await drain(x);
    assert.equal(x.nav(), 1);assert.equal(x.session.getItem('mz_phone_unlocked_since_wake'), null);
    assert.equal(x.session.getItem('mz_phone_screen_off_at'), null);assert.equal(x.session.getItem('mz_phone_wake_navigation'), '1');
  });
  await run('native-generation-principal-and-method-withdraw-before-queued-effect', async () => {
    for (const loss of ['generation', 'principal', 'method']) {
      const x = fixture();x.setNative(true);const entered = deferred(), release = deferred();
      const prior = x.gate.mutate(async () => { entered.resolve();await release.promise; });await entered.promise;
      const wake = x.api.handlePhoneWake({ force: true });await new Promise(setImmediate);
      if (loss === 'generation') x.setGeneration(2);
      if (loss === 'principal') x.setPrincipal('successor');
      if (loss === 'method') x.window.MemphisMobile.principalIdentity = () => 'original';
      release.resolve();await prior;assert.equal(await wake, false);assert.deepEqual(x.session.effects, []);assert.equal(x.nav(), 0);
    }
  });
  assert.ok(done.length, 'selected new case must exist');
}

function checkEmployeeHub(source) {
  assert(/<body\b[^>]*class="kiosk-locked"[^>]*>/.test(source), 'Employee hub must first-paint prearm the mock lock before async device resolution');
  assert(source.includes('id="lock-unlock-btn"'), 'Employee hub lock screen must expose an explicit unlock button');
  assert(/lockUnlockBtn:document\.getElementById\('lock-unlock-btn'\)/.test(source), 'Employee hub must wire the unlock button into the element map');
  assert(/if\(els\.lockUnlockBtn\)els\.lockUnlockBtn\.addEventListener\('click',\(event\)=>\{event\.preventDefault\(\);event\.stopPropagation\(\);unlockKioskScreen\(\);\}\);/.test(source), 'Employee hub unlock button must dismiss the lock screen on tap');
  assert(/return isFullyKioskRuntime\(\)&&normalized!==''&&normalized!=='KIOSK_01'/.test(source), 'Employee hub automatic lockscreen gating must still require Fully Kiosk runtime and a configured non-manager device');
}

function checkManagerHub(html, controller) {
  assert.doesNotMatch(html, /id="kiosk-lock-screen"|lock-unlock-btn|Swipe up to unlock/i, 'Manager phones are ordinary personal/work apps, not Fully Kiosk devices');
  assert.doesNotMatch(controller, /isFullyKioskRuntime|KIOSK_01.*lock|unlockKioskScreen/i, 'Manager Hub controller must not restore the retired Fully Kiosk lock layer');
  assert.match(controller, /requireOpsManagerSession/);
  assert.match(controller, /Named manager enrollment required/);
  assert.match(controller, /ops-manager-hub\.html/);
}

checkEmployeeHub(load('employee-hub.html'));
checkManagerHub(load('start_page1.html'), load('ops-hub.js'));

console.log(JSON.stringify({
  ok: true,
  checked: [
    'employee_unlock_button',
    'employee_unlock_tap_handler',
    'employee_runtime_gate',
    'manager_fully_kiosk_retired',
    'manager_named_enrollment_gate',
  ],
}, null, 2));
