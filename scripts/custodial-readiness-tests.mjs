import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { installHourlyForecastKeyboard } from '../mobile/src/custodial/hourly-forecast-keyboard.js';
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const moduleSource = read('mobile/src/custodial/readiness.js');
const { classifyReadiness, createReadinessObservation, readinessPresentation, readinessSupportCode } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
const app = read('mobile/src/custodial/app.js');
const html = read('mobile/src/custodial/index.html');
const results = [];
async function check(name, fn) { try { await fn(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.stack }); } }
const security = { initialized: true, ready: true, available: true, quarantined: false, state: 'enrolled', generation: 1 };
const positive = { security, principalPresent: true, profileMatches: true, serverConfirmed: true,
  snapshotAnchored: true, startupClear: true, connected: true, queue: [], sessionState: 'none',
  nativeState: { observation: 'CONFIRMED', read_only: true, native_clock_continuity: 'CONFIRMED', protected_work_admission: 'CLEAR',
    rollback_fence_active: false, pending_occurrences: false, unfinished_occurrence: false } };
await check('support code is a read-only bounded observation, never arbitrary data or authority', () => {
  const input = { ...positive, security: { ...security, state: 'unenrolled', reason: 'private_fixture_credential',
    deviceId: 'private_fixture_device', credential: 'private_fixture_secret' }, sessionState: 'corrupted' };
  const before = JSON.stringify(input);
  const code = readinessSupportCode(input);
  assert.match(code, /^S1 unenrolled\/unknown I1 R1 A1 Q0 P1 J:corrupted N:CONFIRMED M\? E\? D0 T:none Y:unknown$/);
  assert.doesNotMatch(code, /private_fixture/);
  assert.equal(JSON.stringify(input), before);
  assert.equal(classifyReadiness(input).state, 'do_not_use');
  assert.equal(readinessSupportCode({ security: { state: '<script>secret</script>', ready: 'secret' },
    sessionState: 'secret', nativeState: { observation: 'secret' } }),
    'S1 unknown/unknown I? R? A? Q? P? J:unknown N:unknown M? E? D? T:none Y:unknown');
  const retained = { ...positive, managerRequired:false,enrollmentPending:false,syncStatus:'private_fixture_status',
    queue:[{state:'dead-letter',type:'private_fixture_type',last_error:'private_fixture_secret'}]};
  const bytes=JSON.stringify(retained);
  assert.match(readinessSupportCode(retained), /M0 E0 D1 T:unknown Y:unknown H:1 \[unknown\/dead-letter\/Vunknown\/O:none\/C\?\/X:other\]$/);
  assert.doesNotMatch(readinessSupportCode(retained), /private_fixture/);
  assert.equal(JSON.stringify(retained),bytes);
});
await check('held diagnostics distinguish retained legacy work without disclosing its original payload', () => {
  const input = {queue:[{type:'forward-replay-fenced:legacy-quarantine',state:'legacy-quarantine',
    recoverable:false,source_schema_version:4,last_error:'private_fixture_secret',
    preserved_original_record:{type:'record_scan_event',payload:{secret:'private_fixture_payload'}}},
    {type:'commit_workflow',state:'quarantined',schema_version:6,dead_letter:true,
      last_error:'semantic_completion_mismatch_requires_explicit_resolution'}]};
  const before=JSON.stringify(input),code=readinessSupportCode(input);
  assert.match(code,/H:2 \[forward-replay-fenced:legacy-quarantine\/legacy-quarantine\/V4\/O:record_scan_event\/C0\/X:other;commit_workflow\/quarantined\/V6\/O:none\/C\?\/X:semantic-conflict\]/);
  assert.doesNotMatch(code,/private_fixture/);assert.equal(JSON.stringify(input),before);
  assert.equal(classifyReadiness(input).state,'needs_manager');
  const gps = {queue:[{type:'forward-replay-fenced:legacy-quarantine',state:'legacy-quarantine',
    recoverable:false,source_schema_version:6,preserved_original_record:{
      type:'forward-replay-fenced:evaluate_location_proximity_v2',payload:{secret:'private_fixture_payload'}}}]};
  assert.match(readinessSupportCode(gps), /\/V6\/O:evaluate_location_proximity_v2\/C0\/X:none/);
  gps.queue[0].preserved_original_record.type='forward-replay-fenced:private_fixture_type';
  assert.match(readinessSupportCode(gps), /\/O:unknown\//);
  assert.doesNotMatch(readinessSupportCode(gps), /private_fixture/);
});
await check('four exact labels with deterministic integrity/manager/pending priority', () => {
  assert.equal(classifyReadiness(positive).label, 'Ready for work');
  assert.equal(classifyReadiness({ ...positive, queue: [{}] }).label, 'Saved work awaiting confirmation');
  assert.equal(classifyReadiness({ ...positive, authRejected: true }).label, 'Phone repair needed');
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
await check('malformed retained queue rows stay visible as unreadable saved-work integrity state', () => {
  for (const row of [null, undefined, false, 'broken', 7, []]) {
    const queue = [row]; const before = queue.slice();
    const result = classifyReadiness({ ...positive, queue });
    assert.equal(result.state, 'do_not_use');
    const shown = readinessPresentation(result, { localReadinessUnavailable: true });
    assert.equal(shown.hidden, false); assert.equal(shown.label, 'Do not use');
    assert.deepEqual(queue, before);
  }
});
await check('valid queued work remains pending and valid dead-letter remains manager-actionable', () => {
  const queued = { type: 'complete_session', payload: { immutable: 'retained' } };
  assert.equal(classifyReadiness({ ...positive, queue: [queued] }).state, 'needs_internet');
  assert.equal(readinessPresentation(classifyReadiness({ ...positive, queue: [queued] })).hidden, true);
  assert.equal(classifyReadiness({ ...positive, queue: [{ dead_letter: true }] }).state, 'needs_manager');
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
function fixture({ connected = true, anchored = true, pending = [], nativePending = false, session = 'none', authReject = false, cacheOnly = false, startup = 'none', delaySnapshot = false, nativeObservation = 'CONFIRMED', nativeReason = null, delayReadiness = false, localReadinessFailure = false, ownerTestSupport = false, actualSessionRows = null } = {}) {
  const elements = new Map(), listeners = new Map(), calls = [], storage = new Map();
  let principal = 'principal-a', subscriber, releaseSnapshot, releaseReadiness;
  let status = { ...security, deviceId: 'KIOSK_08', principal: { device_id: 'KIOSK_08' } };
  const protectedValues = new Map(Object.entries(actualSessionRows || {})), protectedReads = [], protectedWrites = [];
  let queue = structuredClone(pending);
  let nativeState = { ...positive.nativeState, observation: nativeObservation, reason: nativeReason, pending_occurrences: nativePending, protected_work_admission: nativePending ? 'PENDING' : 'CLEAR', unfinished_occurrence: nativePending && session === 'open' };
  const readinessGate = delayReadiness ? new Promise(resolve => { releaseReadiness = resolve; }) : Promise.resolve();
  const snapshotGate = delaySnapshot ? new Promise(resolve => { releaseSnapshot = resolve; }) : Promise.resolve();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { hidden: id !== 'boot', textContent: '', className: '', addEventListener() {} });
    return elements.get(id);
  };
  const identity = () => ({ authenticated: true, employee_name: 'Fixture Custodian', fixture_principal: principal });
  const oldProfile = identity();
  const sec = { native: true, ready: Promise.resolve(), getStatus: () => ({ ...status }), ensureSecurityState: async () => ({ ...status }), subscribe: fn => { subscriber = fn; }, getPendingEnrollmentOperation: () => null,
    mutateProtectedWork() { throw new Error('Readiness must not mutate protected work'); } };
  const window = { MemphisCustodialSecurity: sec, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
    addEventListener: (name, fn) => listeners.set(name, fn),
    MemphisUI: { resolveOpenScanSession: () => ({ state: session, session: { location_name: 'Original Fixture Place', immutable: 'original-finish' } }), isUnstartedScanSession: () => false },
    MemphisScanSync: { ready: Promise.resolve(true), listActions: async () => { calls.push('readonly-queue'); return queue; }, recoverLocalCompletionIntents: async () => { calls.push('existing-recovery'); }, reconcileStartupRecovery: async () => ({ state: startup }) },
    MemphisMobile: { whenReady: async () => {}, resumePendingSecurityWorkflow: async () => {}, principalIdentity: () => principal,
      readCustodialHomeCache: () => ({ profile: oldProfile }), saveCustodialHomeCache: async () => true,
      profileMatchesPrincipal: value => value?.fixture_principal === principal && status.state === 'enrolled',
      getReadinessObservation: async () => { calls.push('readonly-native'); const captured = { ...nativeState }; await readinessGate; if(localReadinessFailure)throw Error('Synthetic protected local observation failure'); return captured; },
      getOfflineAuthorityState: async () => { throw new Error('Old mutating getter must not be used for readiness.'); },
      saveOfflineScanAuthoritySnapshot: async () => { calls.push('existing-anchor'); await snapshotGate; return anchored; },
      requestJson: async path => {
        calls.push(path); if (authReject) throw Object.assign(new Error('rejected'), { status: 403 });
        if (cacheOnly) throw new Error('connection unavailable');
        return path.startsWith('/device-auth/status') ? identity() : { fixture: 'snapshot' };
      } },
  };
  const context = { window, document: { getElementById: element }, navigator: { onLine: connected }, console,queueMicrotask,
    __MZ_CUSTODIAL_OWNER_TEST_SUPPORT__: ownerTestSupport,
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    classifyReadiness, createReadinessObservation, readinessPresentation, readinessSupportCode, installHourlyForecastKeyboard, installHomeFacts: () => ({ stop() {}, update() {}, authenticatedProfileRestored() { return true; }, async restoreProfileFacts() { return true; } }),
    Network: { addListener: async (name, fn) => listeners.set(name, fn) }, App: { addListener: async (name, fn) => listeners.set(name, fn) }, StatusBar: { hide: async () => {} } };
  vm.createContext(context);
  if (actualSessionRows !== null) {
    const localStorage = { get length() { protectedReads.push('length'); return protectedValues.size; }, key: i => [...protectedValues.keys()][i] ?? null,
      getItem: key => { protectedReads.push(key); return protectedValues.get(key) ?? null; },
      setItem: (key,value) => { protectedWrites.push(key); protectedValues.set(key,String(value)); },
      removeItem: key => { protectedWrites.push(key); protectedValues.delete(key); } };
    window.localStorage = context.localStorage = localStorage;
    window.location = { href: 'https://fixture.invalid/index.html?hub=employee' }; window.top = window; window.self = window;
    context.URL = URL; context.document.readyState = 'loading'; context.document.addEventListener = () => {};
    window.MemphisScanSync.isLocallyCompleted = () => false;
    vm.runInContext(read('memphis-ui.js'), context, { filename: 'actual-memphis-ui.js' });
  }
  vm.runInContext(app.replace(/^import .*;\s*$/gm, '').replace('void (async () => {', 'globalThis.__startup = (async () => {'), context);
  const flush = async () => { await context.__startup; for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
  return { elements, calls, flush, listeners, queueBytes: () => JSON.stringify(queue), releaseSnapshot: () => releaseSnapshot?.(),
    changePrincipal: () => { principal = 'principal-b'; status.generation++; subscriber({ ...status }); },
    changeGeneration: () => { status.generation++; subscriber({ ...status }); },
    releaseReadiness: () => releaseReadiness?.(),
    disconnect: () => { context.navigator.onLine = false; listeners.get('networkStatusChange')({ connected: false }); },
    queueEvent: (rows, state) => { queue = rows; listeners.get('memphis-scan-sync')({ detail: { status: state } }); },
    setFence: () => { nativeState = { ...nativeState, rollback_fence_active: true }; },
    protectedReads, protectedWrites, protectedBytes: () => JSON.stringify([...protectedValues]),
    setOwner: (patch, identity = principal) => { status = { ...status, ...patch }; principal = identity; },
    observeNow: () => vm.runInContext('refreshReadiness()', context) };
}
await check('actual controller presents positive existing restore/anchor and readonly queue observations', async () => {
  const f = fixture(); await f.flush();
  for (const id of ['home-readiness', 'lock-readiness', 'boot-readiness', 'assignment-readiness']) {
    assert.equal(f.elements.get(id).hidden,true);assert.equal(f.elements.get(id).textContent,'');
    assert.match(f.elements.get(id).className,/phoneReadiness ready/);
  }
  assert.equal(f.calls.filter(c => c === 'existing-anchor').length, 1);
  assert.equal(f.elements.get('home').hidden, false);
  assert.equal(f.elements.get('assignment-support').hidden, true);
  assert.equal(f.elements.get('assignment-support').textContent, '');
});
for (const [name, options] of [['no anchor confirmation', { anchored: false }], ['offline cache', { connected: false, cacheOnly: true }], ['pending completion', { pending: [{ type: 'complete_session', payload: { id: 'original' } }] }], ['native pending', { nativePending: true }]]) {
  await check(`controller ${name} is not Ready`, async () => {
    const f = fixture(options); const bytes = f.queueBytes(); await f.flush();
    assert.equal(f.elements.get('home-readiness').textContent,'');assert.equal(f.elements.get('home-readiness').hidden,true);
    assert.match(f.elements.get('home-readiness').className,/needs_internet/);assert.equal(f.queueBytes(), bytes);
    assert.equal(f.elements.get('home').hidden, false);
  });
}
await check('local verification failure warns but retains ordinary cached work',async()=>{
  const f=fixture({connected:false,cacheOnly:true,localReadinessFailure:true,pending:[{type:'start_session',payload:{immutable:'original'}}]});
  const bytes=f.queueBytes();await f.flush();assert.equal(f.elements.get('home-readiness').hidden,false);
  assert.match(f.elements.get('home-readiness').textContent,/^Saved work verification needed/);assert.equal(f.queueBytes(),bytes);
});
await check('actual auth rejection and startup recovery need manager', async () => {
  for (const options of [{ authReject: true }, { startup: 'manager_required' }]) {
    const f = fixture(options); await f.flush(); assert.match(f.elements.get('boot-readiness').textContent, /^Phone repair needed/);
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
  assert.equal(f.elements.get('home-readiness').textContent,'');assert.match(f.elements.get('home-readiness').className,/needs_internet/);
  f.releaseSnapshot(); await f.flush();assert.equal(f.elements.get('home-readiness').textContent,'');assert.match(f.elements.get('home-readiness').className,/needs_internet/);
});
await check('pause removes positive observation without consuming or authorizing work', async () => {
  const f = fixture(); await f.flush(); const before = f.calls.length;
  f.listeners.get('pause')();assert.equal(f.elements.get('home-readiness').textContent,'');assert.match(f.elements.get('home-readiness').className,/needs_internet/);
  await f.flush(); assert.ok(f.calls.slice(before).every(c => c.startsWith('readonly-')));
});
await check('queued error observation resets positive; replay does not erase payload', async () => {
  const f = fixture(); await f.flush(); const rows = [{ dead_letter: true, payload: { private: 'original' } }];
  f.queueEvent(rows, 'dead-letter'); await f.flush();
  assert.match(f.elements.get('home-readiness').textContent, /^Phone repair needed/); assert.equal(f.queueBytes(), JSON.stringify(rows));
});
await check('principal replacement never keeps old positive label while snapshot response is outstanding', async () => {
  const f = fixture({ delaySnapshot: true }); await f.flush(); f.changePrincipal();
  assert.doesNotMatch(f.elements.get('home-readiness').textContent, /^Ready for work/);
  f.releaseSnapshot(); await f.flush(); assert.equal(f.elements.get('employee-name').textContent, 'Fixture Custodian');
});
await check('actual controller shows malformed retained queue as integrity-visible without changing bytes', async () => {
  const f = fixture({ pending: [null] }); const bytes = f.queueBytes(); await f.flush();
  assert.equal(f.elements.get('home-readiness').hidden, false);
  assert.match(f.elements.get('home-readiness').textContent, /^Do not use/);
  assert.equal(f.queueBytes(), bytes);
});
await check('owner-test actionable Home and Unlock reveal only the existing finite support code', async () => {
  const f=fixture({ownerTestSupport:true,pending:[null]});const original=f.queueBytes();await f.flush();
  for(const id of ['home-support','lock-support']){
    assert.equal(f.elements.get(id).hidden,false);
    assert.equal(f.elements.get(id).textContent,'Support code: S1 enrolled/unknown I1 R1 A1 Q0 P1 J:none N:CONFIRMED M0 E0 D0 T:none Y:none');
    assert.doesNotMatch(f.elements.get(id).textContent,/principal-a|KIOSK_08|Fixture Custodian/);
  }
  assert.match(f.elements.get('home-readiness').textContent,/^Do not use/);assert.equal(f.queueBytes(),original);
  f.queueEvent([],'idle');await f.flush();
  for(const id of ['home-support','lock-support']){assert.equal(f.elements.get(id).hidden,true);assert.equal(f.elements.get(id).textContent,'');}
});
await check('normal native build keeps Home and Unlock support hidden without hiding its warning',async()=>{
  const f=fixture({pending:[null]});await f.flush();
  assert.match(f.elements.get('home-readiness').textContent,/^Do not use/);
  for(const id of ['home-support','lock-support']){assert.equal(f.elements.get(id).hidden,true);assert.equal(f.elements.get(id).textContent,'');}
});
await check('owner-test healthy and ordinary pending states do not expose a support breadcrumb',async()=>{
  for(const pending of [[],[{type:'complete_session',payload:{private:'retained'}}]]){
    const f=fixture({ownerTestSupport:true,pending});const original=f.queueBytes();await f.flush();
    for(const id of ['home-support','lock-support']){assert.equal(f.elements.get(id).hidden,true);assert.equal(f.elements.get(id).textContent,'');}
    assert.equal(f.queueBytes(),original);
  }
});
await check('owner-test support retains the actual corrupt-session and native observation distinction',async()=>{
  const f=fixture({ownerTestSupport:true,session:'corrupted'});await f.flush();
  for(const id of ['home-support','lock-support'])assert.match(f.elements.get(id).textContent,/J:corrupted N:CONFIRMED M1 E0 D0 T:none Y:none$/);
  const native=fixture({ownerTestSupport:true,nativeObservation:'DO_NOT_USE'});await native.flush();
  for(const id of ['home-support','lock-support'])assert.match(native.elements.get(id).textContent,/J:none N:DO_NOT_USE M0 E0 D0 T:none Y:none$/);
});
await check('support flag is selected only by owner-test builder and is false in default native builds',()=>{
  assert.match(read('mobile/scripts/build-custodial-first-test.mjs'),/MZ_CUSTODIAL_OWNER_TEST_SUPPORT:'1'/);
  const builder=read('mobile/scripts/build.mjs');
  assert.match(builder,/const ownerTestReadinessSupport = ownerTestSupportFlag === '1'/);
  assert.match(builder,/ownerTestSupportFlag !== '1' \|\| edition !== 'custodial' \|\| custodialBrowserTestBuild/);
  assert.match(builder,/__MZ_CUSTODIAL_OWNER_TEST_SUPPORT__: JSON.stringify\(ownerTestReadinessSupport\)/);
  assert.match(app,/typeof __MZ_CUSTODIAL_OWNER_TEST_SUPPORT__ !== 'undefined'/);
});
await check('native current observation unknown, expired or recovery-required never promotes', async () => {
  for (const [nativeObservation, label] of [['UNKNOWN', ''], ['NEEDS_INTERNET', 'Work verification needed'], ['NEEDS_MANAGER', 'Phone repair needed'], ['DO_NOT_USE', 'Do not use']]) {
    const f = fixture({ nativeObservation });await f.flush();const e=f.elements.get('home-readiness');
    if(label){assert.match(e.textContent,new RegExp('^'+label));assert.equal(e.hidden,false);}else{assert.equal(e.textContent,'');assert.equal(e.hidden,true);assert.match(e.className,/needs_internet/);}
  }
  for (const field of ['pending_occurrences', 'unfinished_occurrence', 'rollback_fence_active'])
    assert.equal(classifyReadiness({ ...positive, nativeState: { ...positive.nativeState, [field]: null } }).state, 'needs_internet');
});

await check('ordinary active native work retains its Finish card without a false permission warning', async () => {
  const f=fixture({nativeObservation:'NEEDS_INTERNET',nativeReason:'original_finish_pending',nativePending:true,session:'open'});
  const before=f.queueBytes();await f.flush();
  assert.equal(f.elements.get('home-readiness').hidden,true);
  assert.equal(f.elements.get('active-cleaning').hidden,false);
  assert.equal(f.queueBytes(),before);
});
await check('pending receipt remains visible without claiming Wi-Fi or permission failure', async () => {
  for(const connected of [true,false]){
    const input={...positive,connected,nativeState:{...positive.nativeState,observation:'NEEDS_INTERNET',reason:'original_receipt_pending',protected_work_admission:'PENDING',pending_occurrences:true}};
    const before=JSON.stringify(input),result=classifyReadiness(input),shown=readinessPresentation(result,input);
    assert.equal(result.state,'needs_internet');assert.equal(shown.hidden,false);
    assert.equal(shown.label,'Saved work awaiting confirmation');assert.match(shown.detail,/Saved on this phone/);
    assert.doesNotMatch(shown.detail,/must verify|before new cleaning/);assert.equal(JSON.stringify(input),before);
  }
  const f=fixture({nativeObservation:'NEEDS_INTERNET',nativeReason:'original_receipt_pending',nativePending:true});await f.flush();
  assert.equal(f.elements.get('home-readiness').hidden,false);assert.match(f.elements.get('home-readiness').textContent,/^Saved work awaiting confirmation/);
});
await check('pending flags cannot hide expired permission, recovery, unknown state or an unmatched original Finish', () => {
  const normal={...positive,nativeState:{...positive.nativeState,observation:'NEEDS_INTERNET',reason:'original_receipt_pending',protected_work_admission:'PENDING',pending_occurrences:true}};
  for(const patch of [{reason:'anchor_expired'},{native_clock_continuity:'EXPIRED'},{read_only:false},{protected_work_admission:'UNKNOWN'},{pending_occurrences:false},{reason:'original_finish_pending',unfinished_occurrence:true}]){
    const input={...normal,nativeState:{...normal.nativeState,...patch}};
    const shown=readinessPresentation(classifyReadiness(input),input);assert.equal(shown.hidden,false);assert.equal(shown.label,'Work verification needed');
  }
  for(const patch of [{authRejected:true},{integrityFailure:true},{localReadinessUnavailable:true}]){
    const input={...normal,...patch};const shown=readinessPresentation(classifyReadiness(input),input);
    assert.equal(shown.hidden,false);assert.notEqual(shown.label,'Saved work awaiting confirmation');
  }
});

await check('security generation change invalidates an outstanding same-principal native observation', async () => {
  const f = fixture({ delayReadiness: true }); await f.flush(); f.changeGeneration();
  assert.doesNotMatch(f.elements.get('home-readiness').textContent, /^Ready for work/);
  f.disconnect();f.releaseReadiness();await f.flush();assert.equal(f.elements.get('home-readiness').textContent,'');assert.match(f.elements.get('home-readiness').className,/needs_internet/);
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
  assert.match(collector, /securityGeneration !== currentSecurity.generation/);
});
await check('real resolver is not asked to classify an unread store while protected owner verification is pending',async()=>{
  for(const [patch,identity]of [[{ready:false},'principal-a'],[{generation:0},'principal-a'],[{},''],
    [{principal:{device_id:'KIOSK_09'}},'principal-a'],[{deviceId:''},'principal-a']]){
    const f=fixture({actualSessionRows:{}});await f.flush();const before=f.protectedBytes();f.protectedReads.length=0;
    f.setOwner(patch,identity);await f.observeNow();const e=f.elements.get('home-readiness');
    assert.equal(f.protectedReads.length,0,'No integrity inspection before its owner prerequisites');
    assert.match(e.className,/needs_internet/);assert.doesNotMatch(e.className,/do_not_use|phoneReadiness ready/);
    assert.equal(f.protectedBytes(),before);assert.equal(f.protectedWrites.length,0);
    f.setOwner({ready:true,generation:1,deviceId:'KIOSK_08',principal:{device_id:'KIOSK_08'}},'principal-a');
    f.queueEvent([],'observed');await f.flush();
    assert.ok(f.protectedReads.length>0,'The ordinary observation event retries after owner recovery');
    assert.match(e.className,/phoneReadiness ready/);assert.equal(f.protectedWrites.length,0);
  }
});
await check('real malformed protected store remains Do not use after owner recovery and never changes bytes',async()=>{
  const f=fixture({actualSessionRows:{'session:ac100000-0000-4000-8000-000000000001':'{malformed original'}});
  await f.flush();const before=f.protectedBytes();await f.observeNow();const e=f.elements.get('home-readiness');
  assert.match(e.className,/do_not_use/);assert.equal(e.hidden,false);
  f.setOwner({ready:false});f.protectedReads.length=0;await f.observeNow();
  assert.equal(f.protectedReads.length,0);assert.doesNotMatch(e.className,/phoneReadiness ready/);
  f.setOwner({ready:true});await f.observeNow();assert.match(e.className,/do_not_use/);
  assert.equal(f.protectedBytes(),before);assert.equal(f.protectedWrites.length,0);
});
await check('pending owner observation cannot suppress hard security or authoritative native refusal',async()=>{
  for(const patch of [{ready:false,quarantined:true},{ready:false,available:false}]){
    const f=fixture({actualSessionRows:{}});await f.flush();f.setOwner(patch);await f.observeNow();
    assert.match(f.elements.get('home-readiness').className,/do_not_use/);assert.equal(f.protectedWrites.length,0);
  }
  const f=fixture({actualSessionRows:{},nativeObservation:'DO_NOT_USE'});await f.flush();f.setOwner({ready:false});await f.observeNow();
  assert.match(f.elements.get('home-readiness').className,/do_not_use/);assert.equal(f.protectedWrites.length,0);
});
console.log(JSON.stringify({ scope: 'OFF-015 pure classifier and actual employee controller, synthetic read-only native/security/backend fixtures; not current native clock, independent audit or phone proof', passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results }, null, 2));
process.exitCode = results.some(r => !r.passed) ? 1 : 0;
