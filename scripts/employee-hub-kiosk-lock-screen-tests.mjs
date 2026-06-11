import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../employee-hub.html', import.meta.url), 'utf8');

function contains(label, needle) {
  assert.equal(html.includes(needle), true, `${label}: expected employee-hub.html to contain ${needle}`);
}

function doesNotContain(label, needle) {
  assert.equal(html.includes(needle), false, `${label}: employee-hub.html should not contain ${needle}`);
}

function matches(label, regex) {
  assert.equal(regex.test(html), true, `${label}: expected employee-hub.html to match ${regex}`);
}

contains('employee hub first-paint starts prearmed before async device resolution', '<body class="kiosk-locked">');
contains('employee hub centers feedback under schedule', '#feedback-link{grid-column:2}');
contains('mock lock overlay markup', 'id="kiosk-lock-screen"');
contains('mock lock overlay is accessible', 'aria-label="Kiosk lock screen"');
contains('mock lock clock node', 'id="lock-clock"');
contains('mock lock date node', 'id="lock-date"');
contains('mock lock assigned employee node', 'id="lock-assigned"');
doesNotContain('mock lock should not show generic team-device label', '>Team Device<');
contains('mock lock instruction', 'Swipe up to unlock');
doesNotContain('mock lock avoids extra staff-facing helper text', 'Prevents accidental app taps');
contains('mock lock CSS blocks app taps', '.kioskLock{position:fixed;inset:0;z-index:9998');
contains('mock lock hides underlying hub while locked to prevent loading flashes', '.kiosk-locked .page{visibility:hidden}');
contains('mock lock restores hub visibility after unlock', '.kiosk-unlocked .page{visibility:visible}');
contains('mock lock CSS disables touch scrolling through overlay', 'touch-action:none');
contains('mock lock hidden class', '.kioskLock.unlocked{opacity:0;pointer-events:none');
contains('lock element captured in els map', 'kioskLock:document.getElementById(\'kiosk-lock-screen\')');
contains('lock clock element captured in els map', 'lockClock:document.getElementById(\'lock-clock\')');
contains('lock date element captured in els map', 'lockDate:document.getElementById(\'lock-date\')');
contains('lock assigned employee element captured in els map', 'lockAssigned:document.getElementById(\'lock-assigned\')');
contains('lock initialization runs before async feeds', 'initKioskLockScreen();state.currentDeviceId=resolveDeviceId();');
contains('lock only enabled for team/kiosk device hub', 'function shouldUseKioskLockScreen()');
contains('lock can be bypassed by URL parameter', "lockParam==='0'||lockParam==='false'||lockParam==='off'");
contains('lock unlock function marks body', "document.body.classList.add('kiosk-unlocked')");
contains('lock unlock function hides overlay', "els.kioskLock.classList.add('unlocked')");
contains('lock relock function restores body state after screen wake', 'function relockKioskScreen()');
contains('lock relock function shows overlay after screen wake', "els.kioskLock.classList.remove('unlocked')");
contains('lock listens for WebView visibility restore', "document.addEventListener('visibilitychange', handleKioskVisibilityChange)");
contains('lock relocks on visible wake state', "document.visibilityState==='visible'");
contains('lock listens for pageshow restore', "window.addEventListener('pageshow', handleKioskWakeRelock)");
contains('lock binds Fully Kiosk screenOn event when available', "fully.bind('screenOn','handleKioskWakeRelock();')");
contains('lock safely checks Fully JavaScript interface', "if(window.fully&&typeof window.fully.bind==='function')");
contains('lock swipe start handler', "els.kioskLock.addEventListener('touchstart', handleLockTouchStart");
contains('lock swipe move handler', "els.kioskLock.addEventListener('touchmove', handleLockTouchMove");
contains('lock swipe end handler', "els.kioskLock.addEventListener('touchend', handleLockTouchEnd");
contains('lock mouse fallback handler', "els.kioskLock.addEventListener('pointerup', handleLockPointerUp");
contains('lock uses dynamic swipe threshold helper', 'function getUnlockSwipeThreshold()');
contains('lock uses dynamic drag cap helper', 'function getUnlockDragCap()');
matches('lock requires upward swipe threshold', /touchStartY-lockLastY\s*>\s*=\s*getUnlockSwipeThreshold\(\)/);
matches('lock allows kiosk canonical ids only inside Fully Kiosk runtime', /return\s+isFullyKioskRuntime\(\)&&normalized\.startsWith\('KIOSK_'\)/);
contains('lock detects Fully Kiosk JavaScript interface', 'if(window.fully)return true');
contains('lock detects Fully Kiosk user agent', "/FullyKiosk/i.test(String(navigator.userAgent||''))");
contains('doc employee also appears on lock screen', "if(els.lockAssigned)els.lockAssigned.textContent=docEmployee;");
contains('first-paint lock assigned fallback is not async-loading text', '<div id="lock-assigned" class="lockAssigned">Memphis Zoo</div>');
contains('KIOSK_02 baseline employee hint is available before async feeds', "KIOSK_02:'Alijah Collins'");
contains('currently connected KIOSK_04 employee hint is available before async feeds', "KIOSK_04:'Tammy Miller'");
contains('all kiosk employee hints share the same first-paint map', 'const LOCK_DEVICE_LABEL_HINTS=');
contains('first-paint assigned employee is applied before async feeds', 'applyFirstPaintLockAssigned(state.currentDeviceId);updateLinks();startClock();');
contains('resolved API employee is cached for future first-paint lock rendering', 'cacheLockAssignedName(state.currentDeviceId,employeeName);');
contains('resolved API employee still appears on lock screen', 'if(els.lockAssigned)els.lockAssigned.textContent=employeeName;');
contains('front lock retains leadership title for Jennifer', "KIOSK_03:'Jennifer Sheffield - Director of Operations'");
contains('front lock retains leadership title for Clayton', "KIOSK_08:'Clayton Jones - Chief Operating Officer'");
contains('unlocked employee card strips titles from first paint', 'els.employeeValue.textContent=personNameOnly(hinted);');
contains('unlocked employee card strips titles from API employee name', 'els.employeeValue.textContent=personNameOnly(employeeName);');
contains('unlocked employee meta strips titles from API device name', '`${personNameOnly(data.device_name)} • Read-only schedule and events view`');

console.log('employee-hub-kiosk-lock-screen-tests passed');
