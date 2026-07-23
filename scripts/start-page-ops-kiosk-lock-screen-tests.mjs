import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../start_page1.html', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../ops-hub.js', import.meta.url), 'utf8');

assert.doesNotMatch(html, /id="kiosk-lock-screen"|aria-label="Ops Manager kiosk lock screen"|Swipe up to unlock|lock-unlock-btn/i);
assert.doesNotMatch(controller, /isFullyKioskRuntime|initKioskLockScreen|unlockKioskScreen|relockKioskScreen|KIOSK_01.*lock/i);
assert.match(html, /Restoring manager access/);
assert.match(html, /ops-hub\.js/);
assert.match(controller, /requireOpsManagerSession/);
assert.match(controller, /Named manager enrollment required/);
assert.match(controller, /ops-manager-hub\.html/);
assert.match(controller, /accessLevel:'full_access'/);
assert.doesNotMatch(controller, /FullyKiosk|window\.fully|navigator\.userAgent.*FullyKiosk/i);

console.log('START_PAGE_MANAGER_KIOSK_RETIREMENT_PASS');
