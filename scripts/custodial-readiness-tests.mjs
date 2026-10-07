import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { installHourlyForecastKeyboard } from '../mobile/src/custodial/hourly-forecast-keyboard.js';
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const moduleSource = read('mobile/src/custodial/readiness.js');
const { classifyReadiness, createReadinessObservation } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
const app = read('mobile/src/custodial/app.js');
const html = read('mobile/src/custodial/index.html');
const results = [];
async function check(name, fn) { try { await fn(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.stack }); } }
const security = { initialized: true, ready: true, available: true, quarantined: false, state: 'enrolled', generation: 1 };
const positive = { security, principalPresent: true, profileMatches: true, serverConfirmed: true,
  snapshotAnchored: true, startupClear: true, connected: true, queue: [], sessionState: 'none',
  nativeState: { observation: 'CONFIRMED', read_only: true, native_clock_continuity: 'CONFIRMED', protected_work_admission: 'CLEAR',
    rollback_fence_active: false, pending_occurrences: false, unfinished_occurrence: false } };
await check('four exact labels with deterministic integrity/manager/pending priority', () => {
  assert.equal(classifyReadiness(positive).label, 'Ready for work');
  assert.equal(classifyReadiness({ ...positive, queue: [{}] }).label, 'Needs internet');
  assert.equal(classifyReadiness({ ...positive, authRejected: true }).label, 'Needs manager');
  assert.equal(classifyReadiness({ ...positive, security: { ...security, quarantined: true }, authRejected: true }).label, 'Do not use');
});
for (const field of ['principalPresent', 'profileMatches', 'serverConfirmed', 'snapshotAnchored', 'startupClear', 'connected']) {
  await check(`missing ${field} cannot promote online phone`, () => assert.equal(classifyReadiness({ ...positive, [field]: false }).state, 'needs_internet'));
}
for (const [field, value] of [['queue', null], ['nativeState', null], ['sessionState', undefined]]) {
  await check(`unknown ${field} fails closed`, () => assert.equal(classifyReadiness({ ...positive, [field]: value }).state, 'needs_internet'));
}
await check('pending native occurrence is not called delivered or manager failure', () => {
  const r = classifyReadiness({ ...positive, nativeState: { ...positive.nativeState, pending_occurrences: true } });
  assert.equal(r.state, 'needs_internet'); assert.match(r.detail, /pending confirmation/);
});
await check('dead-letter, legacy quarantine, removal and rollback fence need manager', () => {
  for (const input of [{ queue: [{ dead_letter: true }] }, { queue: [{ recoverable: false }] },
    { queue: [{ state: 'quarantined' }] }, { security: { ...security, state: 'removing' } },
    { security: { ...security, state: 'unenrolled' } }, { enrollmentPending: true },
    { nativeState: { ...positive.nativeState, rollback_fence_active: true } }]) assert.equal(classifyReadiness({ ...positive, ...input }).state, 'needs_manager');
});
await check('corrupt protected session/unavailable security never hides integrity', () => {
  for (const input of [{ sessionState: 'corrupted' }, { sessionState: 'ambiguous' },
    { security: { ...security, available: false } }]) assert.equal(classifyReadiness({ ...positive, ...input }).state, 'do_not_use');
});
await check('Ready is explicitly last-confirmed, not an offline clock grant', () => {
  const result = classifyReadiness(positive);
  assert.match(result.detail, /Last confirmed/); assert.match(result.detail, /native admission/);
  assert.doesNotMatch(moduleSource, /Date\.|new Date|authorizeOfflineNewWork|localStorage|fetch\(/);
});
await check('classification retains source bytes, protected queue and open Finish', () => {
  const input = structuredClone({ ...positive, queue: [{ type: 'complete_session', payload: { immutable: 'protected' } }], sessionState: 'open' });
  const before = JSON.stringify(input); classifyReadiness(input); assert.equal(JSON.stringify(input), before);
  assert.equal(classifyReadiness({ ...positive, sessionState: 'open' }).state, 'ready');
});
await check('generation and principal binding reject ambiguous late positive response', () => {
  const o = createReadinessObservation(); const token = o.token('a');
  assert.equal(o.accept(token, 'b', positive), false); assert.equal(o.read(token, 'a'), null);
  o.invalidate(); assert.equal(o.accept(token, 'a', positive), false);
  const next = o.token('a'); assert.equal(o.accept(next, 'a', positive), true);
  o.invalidate(); assert.equal(o.read(next, 'a'), null);
});
function fixture({ connected = true, anchored = true, pending = [], nativePending = false, session = 'none', authReject = false, cacheOnly = false, startup = 'none', delaySnapshot = false, nativeObservation = 'CONFIRMED', delayReadiness = false } = {}) {
  const elements = new Map(), listeners = new Map(), calls = [], storage = new Map();
  let principal = 'principal-a', subscriber, releaseSnapshot, releaseReadiness;
  let status = { ...security, deviceId: 'KIOSK_08' };
  let queue = structuredClone(pending);
  let nativeState = { ...positive.nativeState, observation: nativeObservation, pending_occurrences: nativePending };
  const readinessGate = delayReadiness ? new Promise(resolve => { releaseReadiness = resolve; }) : Promise.resolve();
  const snapshotGate = delaySnapshot ? new Promise(resolve => { releaseSnapshot = resolve; }) : Promise.resolve();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { hidden: id !== 'boot', textContent: '', className: '', addEventListener() {} });
    return elements.get(id);
  };
  const identity = () => ({ authenticated: true, employee_name: 'Fixture Custodian', fixture_principal: principal });
  const oldProfile = identity();
  const sec = { native: true, ready: Promise.resolve(), getStatus: () => ({ ...status }), ensureSecurityState: async () => ({ ...status }), subscribe: fn => { subscriber = fn; }, getPendingEnrollmentOperation: () => null };
  const window = { MemphisCustodialSecurity: sec, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
    addEventListener: (name, fn) => listeners.set(name, fn),
    MemphisUI: { resolveOpenScanSession: () => ({ state: session, session: { location_name: 'Original Fixture Place', immutable: 'original-finish' } }), isUnstartedScanSession: () => false },
    MemphisScanSync: { ready: Promise.resolve(true), listActions: async () => { calls.push('readonly-queue'); return queue; }, recoverLocalCompletionIntents: async () => { calls.push('existing-recovery'); }, reconcileStartupRecovery: async () => ({ state: startup }) },
    MemphisMobile: { whenReady: async () => {}, resumePendingSecurityWorkflow: async () => {}, principalIdentity: () => principal,
      readCustodialHomeCache: () => ({ profile: oldProfile }), saveCustodialHomeCache: async () => true,
      profileMatchesPrincipal: value => value?.fixture_principal === principal && status.state === 'enrolled',
      getReadinessObservation: async () => { calls.push('readonly-native'); const captured = { ...nativeState }; await readinessGate; return captured; },
      getOfflineAuthorityState: async () => { throw new Error('Old mutating getter must not be used for readiness.'); },
      saveOfflineScanAuthoritySnapshot: async () => { calls.push('existing-anchor'); await snapshotGate; return anchored; },
      requestJson: async path => {
        calls.push(path); if (authReject) throw Object.assign(new Error('rejected'), { status: 403 });
        if (cacheOnly) throw new Error('connection unavailable');
        return path.startsWith('/device-auth/status') ? identity() : { fixture: 'snapshot' };
      } },
  };
  const context = { window, document: { getElementById: element }, navigator: { onLine: connected }, console,
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    classifyReadiness, createReadinessObservation, installHourlyForecastKeyboard, installHomeFacts: () => ({ stop() {}, update() {}, authenticatedProfileRestored() { return true; } }),
    Network: { addListener: async (name, fn) => listeners.set(name, fn) }, App: { addListener: async (name, fn) => listeners.set(name, fn) }, StatusBar: { hide: async () => {} } };
  vm.createContext(context);
  vm.runInContext(app.replace(/^import .*;\s*$/gm, '').replace('void (async () => {', 'globalThis.__startup = (async () => {'), context);
  const flush = async () => { await context.__startup; for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
  return { elements, calls, flush, listeners, queueBytes: () => JSON.stringify(queue), releaseSnapshot: () => releaseSnapshot?.(),
    changePrincipal: () => { principal = 'principal-b'; status.generation++; subscriber({ ...status }); },
    changeGeneration: () => { status.generation++; subscriber({ ...status }); },
    releaseReadiness: () => releaseReadiness?.(),
    disconnect: () => { context.navigator.onLine = false; listeners.get('networkStatusChange')({ connected: false }); },
    queueEvent: (rows, state) => { queue = rows; listeners.get('memphis-scan-sync')({ detail: { status: state } }); },
    setFence: () => { nativeState = { ...nativeState, rollback_fence_active: true }; } };
}
await check('actual controller presents positive existing restore/anchor and readonly queue observations', async () => {
  const f = fixture(); await f.flush();
  for (const id of ['home-readiness', 'lock-readiness', 'boot-readiness', 'assignment-readiness']) assert.match(f.elements.get(id).textContent, /^Ready for work — Last confirmed/);
  assert.equal(f.calls.filter(c => c === 'existing-anchor').length, 1);
  assert.equal(f.elements.get('home').hidden, false);
});
for (const [name, options] of [['no anchor confirmation', { anchored: false }], ['offline cache', { connected: false, cacheOnly: true }], ['pending completion', { pending: [{ type: 'complete_session', payload: { id: 'original' } }] }], ['native pending', { nativePending: true }]]) {
  await check(`controller ${name} is not Ready`, async () => {
    const f = fixture(options); const bytes = f.queueBytes(); await f.flush();
    assert.match(f.elements.get('home-readiness').textContent, /^Needs internet/); assert.equal(f.queueBytes(), bytes);
    assert.equal(f.elements.get('home').hidden, false);
  });
}
await check('actual auth rejection and startup recovery need manager', async () => {
  for (const options of [{ authReject: true }, { startup: 'manager_required' }]) {
    const f = fixture(options); await f.flush(); assert.match(f.elements.get('boot-readiness').textContent, /^Needs manager/);
    assert.equal(f.elements.get('home').hidden, true);
  }
});
await check('open same-tag Finish display survives pending readiness and is not blocked', async () => {
  const f = fixture({ session: 'open', pending: [{ type: 'start_session', payload: { id: 'original' } }] });
  await f.flush(); assert.equal(f.elements.get('active-cleaning').hidden, false);
  assert.equal(f.elements.get('active-cleaning-text').textContent, 'You are cleaning Original Fixture Place. Tap the same physical tag when you are done.');
  const bytes = f.queueBytes(); f.disconnect(); await f.flush(); assert.equal(f.queueBytes(), bytes);
  assert.equal(f.elements.get('active-cleaning').hidden, false);
});
await check('network loss invalidates immediately and late anchor cannot restore Ready', async () => {
  const f = fixture({ delaySnapshot: true }); await f.flush(); f.disconnect();
  assert.match(f.elements.get('home-readiness').textContent, /^Needs internet/);
  f.releaseSnapshot(); await f.flush(); assert.match(f.elements.get('home-readiness').textContent, /^Needs internet/);
});
await check('pause removes positive observation without consuming or authorizing work', async () => {
  const f = fixture(); await f.flush(); const before = f.calls.length;
  f.listeners.get('pause')(); assert.match(f.elements.get('home-readiness').textContent, /^Needs internet/);
  await f.flush(); assert.ok(f.calls.slice(before).every(c => c.startsWith('readonly-')));
});
await check('queued error observation resets positive; replay does not erase payload', async () => {
  const f = fixture(); await f.flush(); const rows = [{ dead_letter: true, payload: { private: 'original' } }];
  f.queueEvent(rows, 'dead-letter'); await f.flush();
  assert.match(f.elements.get('home-readiness').textContent, /^Needs manager/); assert.equal(f.queueBytes(), JSON.stringify(rows));
});
await check('principal replacement never keeps old positive label while snapshot response is outstanding', async () => {
  const f = fixture({ delaySnapshot: true }); await f.flush(); f.changePrincipal();
  assert.doesNotMatch(f.elements.get('home-readiness').textContent, /^Ready for work/);
  f.releaseSnapshot(); await f.flush(); assert.equal(f.elements.get('employee-name').textContent, 'Fixture Custodian');
});
await check('native current observation unknown, expired or recovery-required never promotes', async () => {
  for (const [nativeObservation, label] of [['UNKNOWN', 'Needs internet'], ['NEEDS_INTERNET', 'Needs internet'], ['NEEDS_MANAGER', 'Needs manager'], ['DO_NOT_USE', 'Do not use']]) {
    const f = fixture({ nativeObservation }); await f.flush(); assert.match(f.elements.get('home-readiness').textContent, new RegExp('^' + label));
  }
  for (const field of ['pending_occurrences', 'unfinished_occurrence', 'rollback_fence_active'])
    assert.equal(classifyReadiness({ ...positive, nativeState: { ...positive.nativeState, [field]: null } }).state, 'needs_internet');
});
await check('security generation change invalidates an outstanding same-principal native observation', async () => {
  const f = fixture({ delayReadiness: true }); await f.flush(); f.changeGeneration();
  assert.doesNotMatch(f.elements.get('home-readiness').textContent, /^Ready for work/);
  f.disconnect(); f.releaseReadiness(); await f.flush(); assert.match(f.elements.get('home-readiness').textContent, /^Needs internet/);
});
await check('HTML has independent readable status on Home, lock, boot and assignment, no color-only meaning', () => {
  for (const id of ['home-readiness', 'lock-readiness', 'boot-readiness', 'assignment-readiness']) assert.match(html, new RegExp(`id="${id}"[^>]*role="status"`));
  assert.match(html, /overflow-wrap:anywhere/);
});
await check('collector cannot authorize, drain, sync, rewrite or date-expire protected work', () => {
  const collector = app.slice(app.indexOf('const readinessObservation'), app.indexOf('const homeFactsUI'));
  assert.doesNotMatch(collector, /authorizeOfflineNewWork|\.sync\(|\.drain|recoverLocal|saveOffline|setItem|Date\./);
  assert.match(collector, /\.listActions\(\)/); assert.match(collector, /getReadinessObservation/);
  assert.doesNotMatch(collector, /getOfflineAuthorityState/);
  assert.match(collector, /securityGeneration !== security.getStatus\(\).generation/);
});
console.log(JSON.stringify({ scope: 'OFF-015 pure classifier and actual employee controller, synthetic read-only native/security/backend fixtures; not current native clock, independent audit or phone proof', passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results }, null, 2));
process.exitCode = results.some(r => !r.passed) ? 1 : 0;
