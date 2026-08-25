import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const load = (name) => fs.readFileSync(path.resolve(scriptDir, `../${name}`), 'utf8');

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
