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

contains('mock lock overlay markup', 'id="kiosk-lock-screen"');
contains('mock lock overlay is accessible', 'aria-label="Kiosk lock screen"');
contains('mock lock clock node', 'id="lock-clock"');
contains('mock lock date node', 'id="lock-date"');
contains('mock lock instruction', 'Swipe up to unlock');
doesNotContain('mock lock avoids extra staff-facing helper text', 'Prevents accidental app taps');
contains('mock lock CSS blocks app taps', '.kioskLock{position:fixed;inset:0;z-index:9998');
contains('mock lock CSS disables touch scrolling through overlay', 'touch-action:none');
contains('mock lock hidden class', '.kioskLock.unlocked{opacity:0;pointer-events:none');
contains('lock element captured in els map', 'kioskLock:document.getElementById(\'kiosk-lock-screen\')');
contains('lock clock element captured in els map', 'lockClock:document.getElementById(\'lock-clock\')');
contains('lock date element captured in els map', 'lockDate:document.getElementById(\'lock-date\')');
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
matches('lock requires upward swipe threshold', /touchStartY-lockLastY\s*>\s*=\s*90/);
matches('lock allows kiosk_02 canonical id', /return\s+normalized\.startsWith\('KIOSK_'\)/);

console.log('employee-hub-kiosk-lock-screen-tests passed');
