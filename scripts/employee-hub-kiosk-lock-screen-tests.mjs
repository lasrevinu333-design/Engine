import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../employee-hub.html', import.meta.url), 'utf8');

function contains(label, needle) {
  assert.equal(html.includes(needle), true, label + ': expected employee-hub.html to contain ' + needle);
}

function doesNotContain(label, needle) {
  assert.equal(html.includes(needle), false, label + ': employee-hub.html should not contain ' + needle);
}

const appAnchors = [...html.matchAll(/<a\b[^>]*\bclass="app"[^>]*>/g)].map((match) => match[0]);
assert.equal(appAnchors.length, 4, 'normal Employee Home must expose exactly four choices');
assert.deepEqual(
  [...html.matchAll(/<span class="label">([^<]+)<\/span>/g)].map((match) => match[1]),
  ['Schedule', 'Messages', 'Events', 'Feedback'],
  'normal Employee Home labels and order must exactly match the accepted contract',
);

for (const [id, route] of [
  ['schedule-link', './employee-schedule.html'],
  ['messages-link', './messages.html'],
  ['events-link', './events.html'],
  ['feedback-link', './system-feedback.html'],
]) {
  const expected = '<a id="' + id + '" class="app" href="' + route + '">';
  assert.ok(html.includes(expected), id + ' must target ' + route);
}

contains('employee Home preserves the original path background', "url('./dashboard-bg_optimized.webp?v=release-2026.07.19.custodial-v3.12')");
contains('employee Home uses a two-by-two choice grid', 'grid-template-columns:repeat(2,minmax(0,1fr))');
contains('employee Home choices remain large touch targets', '.app{min-height:200px');
contains('employee Home propagates enrolled device context to each module', "target.searchParams.set('device',state.currentDeviceId)");

for (const forbidden of [
  'Team Devices',
  'Today’s Weather',
  'Today’s Guest Entries',
  'Assigned Employee',
  'Memphis Messenger',
  'My Schedule',
  'Upcoming Events',
  'Program Feedback',
  'build-stamp',
  'bottomLogoWrap',
  'api.open-meteo.com',
  'dashboard-api/current-attendance',
  'SCHEDULE_ME_URL',
  'LOCK_DEVICE_LABEL_HINTS',
  'Karen Robinson',
  'Daniel Morgan',
  'Scanner',
]) {
  doesNotContain('employee Home excludes ' + forbidden, forbidden);
}

assert.match(html, /<body\b[^>]*class="kiosk-locked"[^>]*>/, 'first paint must remain locked before asynchronous device resolution');
contains('lock overlay markup', 'id="kiosk-lock-screen"');
contains('lock overlay is accessible', 'aria-label="Kiosk lock screen"');
contains('lock clock node', 'id="lock-clock"');
contains('lock date node', 'id="lock-date"');
contains('lock uses generic non-authoritative identity text', '<div class="lockAssigned">Memphis Zoo</div>');
contains('lock instruction remains plain language', 'Swipe up to unlock');
contains('lock exposes a large explicit unlock control', 'id="lock-unlock-btn"');
contains('lock CSS blocks app taps', '.kioskLock{position:fixed;inset:0;z-index:9998');
contains('lock hides underlying Home while locked', '.kiosk-locked .page{visibility:hidden}');
contains('lock restores Home after unlock', '.kiosk-unlocked .page{visibility:visible}');
contains('lock disables touch scrolling through overlay', 'touch-action:none');
contains('lock unlock function marks body', "document.body.classList.add('kiosk-unlocked')");
contains('lock relock function restores body state after screen wake', 'function relockKioskScreen()');
doesNotContain('ordinary page visibility must not impersonate physical screen-off', "document.addEventListener('visibilitychange'");
contains('unlock persists through ordinary navigation', 'window.MemphisUI?.markPhoneUnlocked?.()');
contains('physical screen-off clears shared unlocked state', 'window.MemphisUI?.markPhoneScreenOff?.();relockKioskScreen()');
contains('lock delegates Fully lifecycle ownership when available', 'if(window.MemphisUI?.bindPhoneWakeEvents?.())return');
contains('lock binds Fully screenOn event', "window.fully.bind('screenOn','handleKioskWakeRelock();')");
contains('lock swipe start handler', "els.kioskLock.addEventListener('touchstart',handleLockTouchStart");
contains('lock pointer fallback handler', "els.kioskLock.addEventListener('pointerup',handleLockPointerUp");
contains('lock uses dynamic swipe threshold', 'function getUnlockSwipeThreshold()');
assert.match(html, /touchStartY-lockLastY>=getUnlockSwipeThreshold\(\)/, 'lock must require the upward swipe threshold');
assert.match(html, /return isFullyKioskRuntime\(\)&&normalized!==''&&normalized!=='KIOSK_01'/, 'automatic lock must remain scoped to configured employee Fully Kiosk devices');
contains('lock detects Fully JavaScript interface', 'if(window.fully)return true');
contains('lock detects Fully user agent', "/FullyKiosk/i.test(String(navigator.userAgent||''))");

console.log(JSON.stringify({
  ok: true,
  employee_home_choices: ['Schedule', 'Messages', 'Events', 'Feedback'],
  kiosk_lock: 'preserved',
  synthetic_employee_hints: 'removed',
}, null, 2));
