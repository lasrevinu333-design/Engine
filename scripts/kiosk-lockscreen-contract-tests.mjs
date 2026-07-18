import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function load(name) {
  return fs.readFileSync(path.resolve(scriptDir, `../${name}`), 'utf8');
}

function checkEmployeeHub(source) {
  assert(/<body\b[^>]*class="kiosk-locked"[^>]*>/.test(source), 'Employee hub must first-paint prearm the mock lock before async device resolution');
  assert(source.includes('id="lock-unlock-btn"'), 'Employee hub lock screen must expose an explicit unlock button');
  assert(/lockUnlockBtn:document\.getElementById\('lock-unlock-btn'\)/.test(source), 'Employee hub must wire the unlock button into the element map');
  assert(/if\(els\.lockUnlockBtn\)els\.lockUnlockBtn\.addEventListener\('click',\(event\)=>\{event\.preventDefault\(\);event\.stopPropagation\(\);unlockKioskScreen\(\);\}\);/.test(source), 'Employee hub unlock button must dismiss the lock screen on tap');
  assert(/return isFullyKioskRuntime\(\)&&isEmployeeKioskLockIdentifier\(normalized\);/.test(source), 'Employee hub automatic lockscreen gating must still require Fully Kiosk runtime and an employee device');
}

function checkOpsHub(source) {
  assert(source.includes('id="lock-unlock-btn"'), 'Ops hub lock screen must expose an explicit unlock button');
  assert(/lockUnlockBtn:document\.getElementById\('lock-unlock-btn'\)/.test(source), 'Ops hub must wire the unlock button into the element map');
  assert(/if\(els\.lockUnlockBtn\)els\.lockUnlockBtn\.addEventListener\('click',\(event\)=>\{ event\.preventDefault\(\); event\.stopPropagation\(\); unlockKioskScreen\(\); \}\);/.test(source), 'Ops hub unlock button must dismiss the lock screen on tap');
  assert(/return isFullyKioskRuntime\(\)&&normalized==='KIOSK_01';/.test(source), 'Ops hub automatic lockscreen gating must still require Fully Kiosk runtime');
}

checkEmployeeHub(load('employee-hub.html'));
checkOpsHub(load('start_page1.html'));

console.log(JSON.stringify({
  ok: true,
  checked: [
    'employee_unlock_button',
    'employee_unlock_tap_handler',
    'employee_runtime_gate',
    'ops_unlock_button',
    'ops_unlock_tap_handler',
    'ops_runtime_gate'
  ]
}, null, 2));
