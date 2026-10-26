#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const file = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../index.html');
const html = fs.readFileSync(file, 'utf8');

if (process.argv.includes('--screen-off-unowned-fallback-only')) {
  // Execute the actual page handlers. Synthetic ports prove only this source
  // fallback/caller contract, never Fully, Lock Task or physical wake behavior.
  const handlers = ['handleKioskScreenOffPrewarm', 'handleKioskWakeRelock'].map(name => {
    const line = html.split('\n').find(value => value.trim().startsWith(`function ${name}(`) || value.trim().startsWith(`async function ${name}(`));
    assert.ok(line, `missing actual ${name}`);return line;
  }).join('\n');
  function fixture(ui, reset = false) {
    const effects = [], rows = new Map([['mz_phone_screen_off_at', '{ retained original }']]);
    let relocks = 0;
    const window = { MemphisUI: ui };
    const sessionStorage = {
      getItem: key => rows.get(key) ?? null,
      setItem(key, value) { effects.push(['set', key, value]);rows.set(key, value); },
      removeItem(key) { effects.push(['remove', key]);rows.delete(key); },
    };
    const run = vm.runInNewContext(`let kioskScreenOffResetPending=false;${handlers};
      ({off:handleKioskScreenOffPrewarm,wake:handleKioskWakeRelock,pending:()=>kioskScreenOffResetPending})`,
      { window, sessionStorage, shouldResetScanWorkflowToEmployeeHub: () => reset,
        relockKioskScreen: () => { relocks++; }, Date });
    return { run, effects, rows, relocks: () => relocks };
  }
  for (const reset of [false, true]) {
    const x = fixture(undefined, reset);x.run.off();
    assert.deepEqual(x.effects, [], 'missing writer must not create an unowned session write');
    assert.equal(x.rows.get('mz_phone_screen_off_at'), '{ retained original }');
    assert.equal(x.run.pending(), true);assert.equal(x.relocks(), reset ? 0 : 1);
  }
  console.log('PASS_SOURCE_VM_ONLY absent writer retains originals and wake intent');
  for (const accepted of [false, true]) {
    let calls = 0;
    const x = fixture({ markPhoneScreenOff() { calls++;return accepted; } });x.run.off();
    assert.equal(calls, 1);assert.deepEqual(x.effects, []);
    assert.equal(x.relocks(), accepted ? 0 : 1);assert.equal(x.run.pending(), true);
  }
  console.log('PASS_SOURCE_VM_ONLY unavailable/accepted UI return contracts unchanged');
  let forced;
  const x = fixture({ handlePhoneWake(options) { forced = options.force;return false; } }, true);
  x.run.off();await x.run.wake({ persisted: false });
  assert.equal(forced, true);assert.equal(x.run.pending(), false);assert.equal(x.relocks(), 1);
  assert.deepEqual(x.effects, []);
  console.log('PASS_SOURCE_VM_ONLY pending screen-off still forces owning wake/relock');
  process.exit(0);
}

const mustContain = [
  'id="kiosk-lock-screen" class="kioskLock unlocked"',
  'function initKioskLockScreen()',
  'function resolveDeviceId()',
  'function shouldUseKioskLockScreen(options={})',
  'function relockKioskScreen(options={})',
  'window.location.replace(buildEmployeeHubUrl(context.deviceId||currentDeviceId||""));return',
  "window.fully.bind('screenOn','handleKioskWakeRelock();');",
  'function buildEmployeeHubUrl(deviceId)',
  '.kioskLock{position:fixed;inset:0;z-index:9998;display:flex;',
  'opacity:0;pointer-events:none;visibility:hidden',
  '.kiosk-locked .kioskLock:not(.unlocked){opacity:1;pointer-events:auto;visibility:visible',
  '.kioskLock.unlocked{opacity:0;pointer-events:none;visibility:hidden',
  'kioskScreenOffResetPending=false',
  'function hasScanIntentUrl(url=new URL(window.location.href))',
  'function shouldResetScanWorkflowToEmployeeHub()',
  'function resetScanWorkflowToEmployeeHub()',
  'const shouldBindPrewarm=shouldStartLocked||shouldResetScanWorkflowToEmployeeHub();',
  'function handleKioskScreenOffPrewarm(){kioskScreenOffResetPending=true;if(window.MemphisUI?.markPhoneScreenOff?.())return;',
  'if(hasScanIntentUrl())window.MemphisUI?.markPhoneUnlocked?.();',
  'bindFullyKioskWakeEvents();',
  'async function handleKioskWakeRelock(event){const force=event?Boolean(event.persisted)||kioskScreenOffResetPending:true;if(force)relockKioskScreen();try{if(await window.MemphisUI?.handlePhoneWake?.({force}))return;',
  'async function resumeOpenSessionFromWake(sessionUuid,locationCode,deviceId)',
  'const action=decodeParam(params.get("action")||"").toLowerCase();',
  'if(action==="resume"&&sessionUuid&&await resumeOpenSessionFromWake(sessionUuid,locationCode,deviceId)){updateSyncBadge();return}',
  'if(hasScanIntentUrl(url))return false'
];

const missing = mustContain.filter((needle) => !html.includes(needle));
if (missing.length) {
  console.error('Missing expected scan-page kiosk behavior strings:');
  for (const needle of missing) console.error(`- ${needle}`);
  process.exit(1);
}

const prohibited = [
  "document.addEventListener('visibilitychange',handleKioskVisibilityChange);",
  "function handleKioskVisibilityChange(){if(document.visibilityState==='visible'",
];
const present = prohibited.filter((needle) => html.includes(needle));
if (present.length) {
  console.error('Unsafe page-visibility lock triggers remain on scan page:');
  for (const needle of present) console.error(`- ${needle}`);
  process.exit(1);
}

console.log('index kiosk lock-screen regression: OK');
