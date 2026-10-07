import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { CORE_ROOT, CORE_SUITES, CORE_SUITE_TIMEOUT_MS, CORE_TOTAL_TIMEOUT_MS,
  coreChildEnvironment, runCoreReleaseGate } from './custodial-core-release-gate.mjs';
const read = name => readFileSync(resolve(CORE_ROOT, name), 'utf8');
const gate = 'scripts/custodial-core-release-gate.mjs';
const self = 'scripts/custodial-core-release-gate-tests.mjs';
const workflows = ['.github/workflows/android-test-apks.yml',
  '.github/workflows/mobile-editions-build.yml', 'codemagic.yaml'];
let cases = 0;
const test = (name, fn) => { fn(); cases++; console.log(`PASS ${name}`); };
function verifyWiring(packageText, workflowTexts) {
  const pkg = JSON.parse(packageText);
  assert.equal(pkg.scripts['test:custodial-core-release'], `node ${self} && node ${gate}`,
    'The package must expose the complete, fail-fast core release gate.');
  for (const [name, source] of Object.entries(workflowTexts)) {
    const lines = source.split('\n').map(line => line.trim());
    const at = lines.indexOf(`node ${self}`);
    assert.ok(at >= 0, `${name}: core gate contract check missing`);
    assert.equal(lines[at + 1], `node ${gate}`, `${name}: complete core gate missing`);
    assert.equal(lines[at + 2], 'npm run --silent test:mobile', `${name}: gate must precede existing mobile contracts`);
    assert.equal(lines.filter(line => line === `node ${gate}`).length, 1);
    if (name.startsWith('.github/')) assert.equal(lines.filter(line => line === "- 'scripts/**'").length, 2,
      `${name}: push and pull-request filters must cover core scripts`);
  }
}
const packageText = read('package.json');
const workflowTexts = Object.fromEntries(workflows.map(name => [name, read(name)]));
test('all build paths run the complete core gate before mobile contracts', () => {
  verifyWiring(packageText, workflowTexts);
});
test('wiring rejects omission, no-op, and reversed execution order', () => {
  const pkg = JSON.parse(packageText);
  pkg.scripts['test:custodial-core-release'] = 'true';
  assert.throws(() => verifyWiring(JSON.stringify(pkg), workflowTexts));
  for (const name of workflows) {
    for (const replacement of ['', 'node --version', `node ${gate} || true`]) {
      const mutated = { ...workflowTexts, [name]: workflowTexts[name].replace(`node ${gate}`, replacement) };
      assert.throws(() => verifyWiring(packageText, mutated), name);
    }
    const mutated = { ...workflowTexts, [name]: workflowTexts[name]
      .replace(`node ${self}`, 'CORE_ORDER_PLACEHOLDER')
      .replace(`node ${gate}`, `node ${self}`)
      .replace('CORE_ORDER_PLACEHOLDER', `node ${gate}`) };
    assert.throws(() => verifyWiring(packageText, mutated), name);
  }
});
test('workflow filters include core test-only changes', () => {
  for (const name of workflows.filter(name => name.startsWith('.github/'))) {
    const mutated = { ...workflowTexts, [name]: workflowTexts[name].replace("- 'scripts/**'", "- 'unrelated/**'") };
    assert.throws(() => verifyWiring(packageText, mutated), name);
  }
});
test('fixed inventory retains every core regression family', () => {
  const expected = `scan-device-employee-default-tests oc24-completion-form-tests
completion-taxonomy-client-tests completion-conditional-browser-tests
verified-check-completion-tests custodial-scan-recovery-classification-tests
custodial-completion-draft-recovery-tests
scan-outage-retry-tests scan-outage-storage-fence-tests scan-retry-after-tests scan-retry-migration-tests
 dashboard-verified-scan-readback-tests dashboard-production-data-tests dashboard-completion-evidence-tests dashboard-completion-evidence-browser-tests
 custodial-readiness-tests custodial-readiness-bridge-tests custodial-readiness-browser-tests
 native-removal-contract-tests provider-composition-contract-tests provider-event-decisions-contract-tests provider-maintenance-contract-tests provider-retained-schedule-contract-tests provider-mirror-contract-tests provider-mirror-renderer-tests
 active-gps-lifecycle-tests active-gps-build-contract-tests
 gps-calibration-integrity-tests custodial-initial-release-scope-tests runtime-sanitation-source-tests custodial-generated-runtime-sanitation-tests custodial-navigation-assets-tests
 custodial-original-home-dom-tests custodial-home-facts-tests custodial-hourly-keyboard-contract-tests custodial-home-ready-profile-order-tests custodial-home-authenticated-restore-tests recurring-schedule-target-tests
 employee-schedule-recurring-delivery-tests employee-schedule-application-receipt-tests
 employee-schedule-cache-resilience-tests employee-schedule-section-tests
 home-schedule-v8-regression-tests home-schedule-v9-regression-tests home-schedule-v10-regression-tests
 home-schedule-v11-regression-tests home-schedule-v12-regression-tests home-schedule-v13-regression-tests
 home-schedule-v14-regression-tests home-schedule-v15-regression-tests home-schedule-v16-regression-tests
 home-schedule-v17-regression-tests home-schedule-v18-regression-tests notification-page-error-fence-tests
 notification-integration-v2-regression-tests notification-integration-v3-regression-tests
 notification-schedule-authority-tests notification-schedule-cache-authority-tests
 notification-response-fence-tests notification-browser-authority-tests notification-reentrant-security-tests
 native-notification-arrival-boundary-tests notification-ownership-principal-settlement-tests
 notification-schedule-ownership-tests`.trim().split(/\s+/).map(name => `scripts/${name}.mjs`);
  assert.equal(expected.length, 64);
  const mapSuites=['dashboard-map-staging-tests','dashboard-map-renderer-tests','dashboard-map-page-contract-tests'].map(name=>`scripts/${name}.mjs`);
  assert.deepEqual(CORE_SUITES.filter(x=>x!=='scripts/provider-event-decision-wire-contract-tests.mjs'&&!mapSuites.includes(x)), expected);
  expected.splice(expected.indexOf('scripts/provider-event-decisions-contract-tests.mjs')+1,0,'scripts/provider-event-decision-wire-contract-tests.mjs');
  assert.equal(expected.length,65);
  expected.splice(expected.indexOf('scripts/dashboard-production-data-tests.mjs')+1,0,...mapSuites);
  assert.equal(expected.length,68);assert.deepEqual(CORE_SUITES,expected);
  assert.equal(new Set(CORE_SUITES).size, CORE_SUITES.length);
  assert.equal(Object.isFrozen(CORE_SUITES), true);
});
const success = () => ({ status: 0, signal: null, stdout: '', stderr: '' });
const silent = () => {};
const regular = () => ({ isFile: () => true, isSymbolicLink: () => false });
for(const name of ['dashboard-map-staging-tests','dashboard-map-renderer-tests','dashboard-map-page-contract-tests','provider-event-decision-wire-contract-tests','provider-event-decisions-contract-tests','provider-retained-schedule-contract-tests','custodial-hourly-keyboard-contract-tests','custodial-home-authenticated-restore-tests','custodial-home-ready-profile-order-tests','dashboard-production-data-tests','provider-maintenance-contract-tests','provider-mirror-contract-tests','provider-mirror-renderer-tests','runtime-sanitation-source-tests','custodial-generated-runtime-sanitation-tests']){
  const suite=`scripts/${name}.mjs`;
  test(`${name} cannot be omitted from preflight`,()=>{
    assert.equal(CORE_SUITES.filter(value=>value===suite).length,1);let calls=0;
    assert.throws(()=>runCoreReleaseGate({clock:()=>0,log:silent,inspect:path=>{if(path===resolve(CORE_ROOT,suite))throw Error('owning_suite_missing');return regular();},execute:()=>{calls++;return success();}}),/owning_suite_missing/);
    assert.equal(calls,0);
  });
  test(`${name} failure blocks remaining source suites`,()=>{
    const calls=[];assert.throws(()=>runCoreReleaseGate({clock:()=>0,log:silent,inspect:regular,execute:(_command,args)=>{calls.push(args[0]);return args[0]===resolve(CORE_ROOT,suite)?{...success(),status:23}:success();}}),/Core suite failed/);
    assert.equal(calls.length,CORE_SUITES.indexOf(suite)+1);assert.equal(calls.at(-1),resolve(CORE_ROOT,suite));
  });
}
test('completion draft recovery is preflighted before any suite executes', () => {
  const draftSuite = 'scripts/custodial-completion-draft-recovery-tests.mjs';
  assert.equal(CORE_SUITES.filter(suite => suite === draftSuite).length, 1);
  let calls = 0;
  assert.throws(() => runCoreReleaseGate({ clock: () => 0, log: silent,
    inspect: path => {
      if (path === resolve(CORE_ROOT, draftSuite)) throw new Error('ENOENT: completion draft recovery');
      return regular();
    }, execute: () => { calls++; return success(); } }), /ENOENT: completion draft recovery/);
  assert.equal(calls, 0);
});
test('a failing completion draft recovery suite blocks all successors', () => {
  const draftSuite = 'scripts/custodial-completion-draft-recovery-tests.mjs';
  const draftIndex = CORE_SUITES.indexOf(draftSuite);
  assert.ok(draftIndex >= 0);
  const calls = [], messages = [];
  assert.throws(() => runCoreReleaseGate({ inspect: regular, clock: () => 0,
    log: message => messages.push(message), execute: (_command, args) => {
      calls.push(args[0]);
      return args[0] === resolve(CORE_ROOT, draftSuite)
        ? { ...success(), status: 17, stdout: 'PASS is not an exit code' } : success();
    } }), /Core suite failed/);
  assert.equal(calls.length, draftIndex + 1);
  assert.equal(calls.at(-1), resolve(CORE_ROOT, draftSuite));
  assert.equal(messages.some(message => String(message).includes('"ok":true')), false);
});
test('dispatcher invokes exact Node and complete ordered source inventory', () => {
  const calls = [], messages = [];
  const result = runCoreReleaseGate({ clock: () => 0, log: message => messages.push(message),
    execute: (command, args, options) => { calls.push({ command, args, options }); return success(); } });
  assert.equal(calls.length, 68);
  calls.forEach((call, index) => {
    assert.equal(call.command, process.execPath);
    assert.deepEqual(call.args, [resolve(CORE_ROOT, CORE_SUITES[index])]);
    assert.equal(call.options.cwd, CORE_ROOT);
    assert.equal(call.options.shell, false);
    assert.equal(call.options.timeout, CORE_SUITE_TIMEOUT_MS);
    assert.equal(call.options.killSignal, 'SIGKILL');
    assert.equal(call.options.maxBuffer, 4 * 1024 * 1024);
    assert.deepEqual(call.options.env, coreChildEnvironment());
  });
  assert.deepEqual(JSON.parse(messages.at(-1)), result);
  assert.equal(result.build_authorized, false);
  assert.equal(result.independent_acceptance, false);
  assert.equal(result.physical_proof, false);
});
test('child environment cannot select a baseline, database, or partial lane', () => {
  const env = coreChildEnvironment({ HOME: '/synthetic/home', PATH: '/untrusted',
    NODE_OPTIONS: '--require /untrusted', NODE_PATH: '/untrusted',
    RECURRING_TARGET_TEST_CONTAINER: 'production', NOTIFICATION_CHALLENGE: 'partial',
    npm_config_script_shell: '/bin/true', LANG: 'invalid', TZ: 'invalid' });
  assert.deepEqual(Object.keys(env).sort(), ['HOME', 'LANG', 'LC_ALL', 'PATH', 'TZ']);
  assert.equal(env.HOME, '/synthetic/home');
  assert.equal(env.LANG, 'C.UTF-8'); assert.equal(env.LC_ALL, 'C.UTF-8');
  assert.equal(env.TZ, 'America/Chicago'); assert.equal(env.PATH.includes('/untrusted'), false);
});
for (const failureAt of [0, 21, 42, CORE_SUITES.length - 1]) test(`failure at suite ${failureAt + 1} stops successors`, () => {
  let calls = 0; const messages = [];
  assert.throws(() => runCoreReleaseGate({ clock: () => 0, log: message => messages.push(message),
    execute: () => calls++ === failureAt ? { ...success(), status: 17, stdout: 'PASS is not an exit code' } : success() }), /Core suite failed/);
  assert.equal(calls, failureAt + 1);
  assert.equal(messages.some(message => String(message).includes('"ok":true')), false);
});
for (const [name, result] of [
  ['missing result', null], ['unknown exit', { status: null }],
  ['signal despite zero exit', { ...success(), signal: 'SIGTERM' }],
  ['timeout despite zero exit', { ...success(), error: new Error('ETIMEDOUT') }],
]) test(name + ' is a failure', () => {
  let calls = 0;
  assert.throws(() => runCoreReleaseGate({ clock: () => 0, log: silent,
    execute: () => { calls++; return result; } }), /Core suite failed/);
  assert.equal(calls, 1);
});
test('a launch exception fails instead of continuing', () => {
  let calls = 0;
  assert.throws(() => runCoreReleaseGate({ clock: () => 0, log: silent,
    execute: () => { calls++; throw new Error('spawn unavailable'); } }), /launch failed/);
  assert.equal(calls, 1);
});
for (const kind of ['missing', 'directory', 'symlink']) test(`${kind} suite rejects the whole inventory before execution`, () => {
  let calls = 0, inspected = 0;
  assert.throws(() => runCoreReleaseGate({ log: silent, clock: () => 0,
    execute: () => { calls++; return success(); }, inspect: () => {
      inspected++;
      if (inspected !== CORE_SUITES.length) return regular();
      if (kind === 'missing') throw new Error('ENOENT');
      return { isFile: () => kind !== 'directory', isSymbolicLink: () => kind === 'symlink' };
    } }));
  assert.equal(calls, 0); assert.equal(inspected, CORE_SUITES.length);
});
test('expired total budget starts no child', () => {
  let ticks = 0, calls = 0;
  assert.throws(() => runCoreReleaseGate({ inspect: regular, log: silent,
    clock: () => ticks++ === 0 ? 0 : CORE_TOTAL_TIMEOUT_MS,
    execute: () => { calls++; return success(); } }), /budget exhausted/);
  assert.equal(calls, 0);
});
test('remaining budget bounds the child timeout', () => {
  let ticks = 0, calls = 0;
  assert.throws(() => runCoreReleaseGate({ inspect: regular, log: silent,
    clock: () => ticks++ === 0 ? 0 : CORE_TOTAL_TIMEOUT_MS - 17,
    execute: (_command, _args, options) => {
      calls++; assert.equal(options.timeout, 17); return { status: null, signal: 'SIGKILL' };
    } }), /Core suite failed/);
  assert.equal(calls, 1);
});
test('total budget includes the final suite', () => {
  let elapsed = 0, calls = 0;
  assert.throws(() => runCoreReleaseGate({ inspect: regular, log: silent, clock: () => elapsed,
    execute: () => { if (++calls === CORE_SUITES.length) elapsed = CORE_TOTAL_TIMEOUT_MS + 1; return success(); } }), /budget exhausted/);
  assert.equal(calls, CORE_SUITES.length);
});
test('CLI rejects arguments without starting any suite', () => {
  const result = spawnSync(process.execPath, [resolve(CORE_ROOT, gate), '--skip'], {
    cwd: CORE_ROOT, encoding: 'utf8', timeout: 3000, env: coreChildEnvironment(),
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /accepts no subset or skip arguments/);
  assert.doesNotMatch(result.stdout, /CORE_SUITE/);
});
console.log(JSON.stringify({ ok: true, cases,
  scope: 'core gate wiring and synthetic dispatcher checks; actual suites run separately',
  independent_acceptance: false, physical_proof: false }));
