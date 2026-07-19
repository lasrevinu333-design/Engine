import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../start_page1.html', import.meta.url), 'utf8');

function contains(label, needle) {
  assert.equal(html.includes(needle), true, `${label}: expected start_page1.html to contain ${needle}`);
}

function doesNotContain(label, needle) {
  assert.equal(html.includes(needle), false, `${label}: start_page1.html should not contain ${needle}`);
}

function matches(label, regex) {
  assert.equal(regex.test(html), true, `${label}: expected start_page1.html to match ${regex}`);
}

contains('ops mock lock overlay markup', 'id="kiosk-lock-screen"');
contains('ops mock lock overlay is accessible', 'aria-label="Ops Manager kiosk lock screen"');
contains('ops mock lock brand', 'Ops Manager Hub');
contains('ops mock lock clock node', 'id="lock-clock"');
contains('ops mock lock date node', 'id="lock-date"');
contains('ops mock lock device/role node', 'id="lock-assigned"');
contains('ops lock visible name is generic manager name', '<div id="lock-assigned" class="lockAssigned">Ops Manager</div>');
contains('ops lock identity stays generic manager name after device resolution', "els.lockAssigned.textContent='Ops Manager'");
contains('ops mock lock instruction', 'Swipe up to unlock');
doesNotContain('ops manager accidental tap helper is removed', 'Manager tools protected from accidental taps');
doesNotContain('ops lock visible name should not include kiosk id', 'KIOSK_01 • Ops Manager');
doesNotContain('ops lock identity should not render normalized kiosk id', '${normalized} • Ops Manager');
contains('ops mock lock CSS blocks app taps', '.kioskLock{position:fixed;inset:0;z-index:9998');
contains('ops mock lock disables touch scrolling through overlay', 'touch-action:none');
contains('ops lock hidden class', '.kioskLock.unlocked{opacity:0;pointer-events:none');
contains('lock element captured in els map', "kioskLock:document.getElementById('kiosk-lock-screen')");
contains('lock init runs before manager auth', 'async function init(){ initKioskLockScreen(); state.currentDeviceId=resolveDeviceId();');
contains('ops lock auto enables for kiosk 01 only inside Fully Kiosk runtime', "return isFullyKioskRuntime()&&normalized==='KIOSK_01'");
contains('ops lock detects Fully Kiosk JavaScript interface', 'if(window.fully)return true');
contains('ops lock detects Fully Kiosk user agent', "/FullyKiosk/i.test(String(navigator.userAgent||''))");
contains('ops lock bypass parameter', "lockParam==='0'||lockParam==='false'||lockParam==='off'");
contains('ops lock explicit parameter', "lockParam==='1'||lockParam==='true'||lockParam==='on'");
contains('ops lock relocks on screen wake', 'function relockKioskScreen()');
doesNotContain('ops app navigation must not impersonate physical screen-off', "document.addEventListener('visibilitychange', handleKioskVisibilityChange)");
contains('ops unlock persists until a physical screen-off', 'window.MemphisUI?.markPhoneUnlocked?.();');
contains('ops lock delegates wake ownership to the shared lifecycle', 'if(window.MemphisUI?.bindPhoneWakeEvents?.())return;');
contains('ops physical screen-off clears shared unlocked state', 'window.MemphisUI?.markPhoneScreenOff?.();relockKioskScreen();');
contains('ops lock binds Fully screenOn event when available', "fully.bind('screenOn','handleKioskWakeRelock();')");
contains('ops lock swipe start handler', "els.kioskLock.addEventListener('touchstart', handleLockTouchStart");
contains('ops lock swipe move handler', "els.kioskLock.addEventListener('touchmove', handleLockTouchMove");
contains('ops lock swipe end handler', "els.kioskLock.addEventListener('touchend', handleLockTouchEnd");
contains('ops lock pointer fallback', "els.kioskLock.addEventListener('pointerup', handleLockPointerUp");
matches('ops lock requires upward swipe threshold', /const threshold=Math\.max\(180,Math\.round\(window\.innerHeight\*0\.22\)\); if\(touchStartY-lockLastY>=threshold\)/);
matches('ops lock pointer fallback uses the same threshold', /const threshold=Math\.max\(180,Math\.round\(window\.innerHeight\*0\.22\)\); if\(lockPointerActive&&pointerStartY-pointerLastY>=threshold\)/);
doesNotContain('ops lock should not show employee-only assigned label', 'Assigned Employee');

console.log('start-page-ops-kiosk-lock-screen-tests passed');
