import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const repo = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, repo), 'utf8');

const pages = {
  startPage: read('start_page1.html'),
  dashboard: read('dashboard.html'),
  messages: read('messages.html'),
  messengerRuntime: read('messenger-runtime-patch.js'),
  scheduleSimple: read('schedule-simple.html'),
  schedule: read('schedule.html'),
  scheduleEmployeeDay: read('schedule-employee-day.html'),
  thread: read('thread.html'),
  eventsAdmin: read('events-admin.html'),
  events: read('events.html'),
  feedback: read('system-feedback.html'),
  guestIssues: read('guest-issues.html'),
};

function contains(label, haystack, needle) {
  assert.equal(haystack.includes(needle), true, `${label}: expected to contain ${needle}`);
}

function doesNotContain(label, haystack, needle) {
  assert.equal(haystack.includes(needle), false, `${label}: should not contain ${needle}`);
}

function matches(label, haystack, regex) {
  assert.equal(regex.test(haystack), true, `${label}: expected to match ${regex}`);
}

for (const [label, html] of [
  ['dashboard.html', pages.dashboard],
  ['schedule-simple.html', pages.scheduleSimple],
  ['schedule.html', pages.schedule],
  ['schedule-employee-day.html', pages.scheduleEmployeeDay],
  ['guest-issues.html', pages.guestIssues],
]) {
  contains(`${label} detects Annie origin`, html, 'function isAnnieOrigin');
  contains(`${label} declares Annie return URL`, html, 'ANNIE_RETURN_URL');
  contains(`${label} stores Annie route in tab session`, html, 'ANNIE_ORIGIN_SESSION_KEY');
  contains(`${label} detects Annie referrer fallback`, html, 'document.referrer');
  matches(`${label} routes Annie-origin back to Annie`, html, /ANNIE_RETURN_URL\s*;\s*return\s*;/);
  contains(`${label} provides a separate Annie return control`, html, 'data-mz-annie-back');
  contains(`${label} preserves the canonical Hub control`, html, 'data-mz-back');
}

contains('Program Feedback uses the shared contextual navigation layer', pages.feedback, 'data-memphis-context="contextual"');
contains('Program Feedback preserves the canonical Hub control', pages.feedback, 'data-mz-back');
contains('Program Feedback provides the shared Annie return control', pages.feedback, 'data-mz-annie-back');
contains('Program Feedback loads the shared route layer', pages.feedback, 'memphis-ui.js?v=release-2026.07.18.custodial-v3.11');

contains('ChatScope Messenger loads its route bridge', pages.messages, 'messenger-runtime-patch.js');
contains('ChatScope Messenger declares contextual navigation', pages.messages, 'data-memphis-context="contextual"');
contains('ChatScope route bridge detects Annie origin', pages.messengerRuntime, 'function isAnnieOrigin');
contains('ChatScope route bridge declares Annie return URL', pages.messengerRuntime, 'ANNIE_RETURN_URL');
contains('ChatScope route bridge stores Annie route in tab session', pages.messengerRuntime, 'ANNIE_ORIGIN_SESSION_KEY');
contains('ChatScope route bridge detects Annie referrer fallback', pages.messengerRuntime, 'document.referrer');
contains('ChatScope route bridge intercepts the visible Back control', pages.messengerRuntime, ".mz-chat-toolbar > .mz-button:first-child");
contains('ChatScope route bridge returns Annie-origin sessions to Moxie', pages.messengerRuntime, 'isAnnieOrigin() ? ANNIE_RETURN_URL');
contains('ChatScope route bridge returns employee sessions to the employee Hub', pages.messengerRuntime, "employeeContext ? './employee-hub.html' : managerFallback");
contains('ChatScope route bridge returns native apps to their edition home', pages.messengerRuntime, "nativeApp ? './index.html'");
contains('ChatScope route bridge enforces canonical visible Back copy', pages.messengerRuntime, "button.textContent = 'Back'");
contains('ChatScope route bridge enforces canonical accessible Back copy', pages.messengerRuntime, "button.setAttribute('aria-label', 'Back')");

contains('legacy thread entry redirects into ChatScope Messenger', pages.thread, "new URL('./messages.html'");
contains('legacy thread entry preserves query parameters', pages.thread, 'searchParams.set(key,value)');
contains('legacy thread entry preserves hash state', pages.thread, 'target.hash=location.hash');

contains('guest-issues.html uses deterministic goBack instead of browser history', pages.guestIssues, "els.back.addEventListener('click',goBack)");
doesNotContain('guest-issues.html avoids history.back regression', pages.guestIssues, 'history.back');
contains('start_page1.html detects Annie origin', pages.startPage, 'function isAnnieOrigin');
contains('start_page1.html stores Annie route in tab session', pages.startPage, 'ANNIE_ORIGIN_SESSION_KEY');
contains('start_page1.html preserves Annie origin on hub links', pages.startPage, 'function preserveAnnieOrigin');
contains('start_page1.html propagates Annie origin to dashboard', pages.startPage, "const dashboardUrl=preserveAnnieOrigin(new URL('./dashboard.html'");
contains('start_page1.html propagates Annie origin to events-admin', pages.startPage, "const eventsAdminUrl=preserveAnnieOrigin(new URL('./events-admin.html'");
contains('start_page1.html rewires events-admin app link', pages.startPage, 'els.eventsAdminLink.href=eventsAdminUrl.toString()');
contains('events-admin.html detects Annie origin', pages.eventsAdmin, 'function isAnnieOrigin');
contains('events-admin.html declares Annie return URL', pages.eventsAdmin, 'ANNIE_RETURN_URL');
contains('events-admin.html stores Annie route in tab session', pages.eventsAdmin, 'ANNIE_ORIGIN_SESSION_KEY');
contains('events-admin.html detects Annie referrer fallback', pages.eventsAdmin, 'document.referrer');
contains('events-admin.html exposes a separate Annie return control', pages.eventsAdmin, 'data-mz-annie-back');
doesNotContain('events-admin.html does not overwrite the canonical Hub destination', pages.eventsAdmin, 'els.backHubLink.href=ANNIE_RETURN_URL');
contains('events.html stores Annie route in tab session', pages.events, 'ANNIE_ORIGIN_SESSION_KEY');
contains('events.html detects Annie referrer fallback', pages.events, 'document.referrer');

contains('schedule simple advanced link preserves Annie origin', pages.scheduleSimple, "preserveAnnieOrigin(new URL('./schedule.html'");
contains('schedule simple employee view preserves Annie origin', pages.scheduleSimple, "preserveAnnieOrigin(new URL('./schedule-employee-day.html'");
contains('advanced schedule employee view preserves Annie origin', pages.schedule, "preserveAnnieOrigin(new URL('./schedule-employee-day.html'");

contains('Event Input Console public-board link preserves Annie origin', pages.eventsAdmin, "url.searchParams.set('origin','annie')");
contains('Event Input Console public-board link marks nested admin return', pages.eventsAdmin, "url.searchParams.set('return','events-admin')");
contains('Public Events Board reads nested return marker', pages.events, "searchParams.get('return')");
contains('Public Events Board can return to Event Input Console', pages.events, 'events-admin.html');
contains('Public Events Board preserves Annie origin when returning to Event Input Console', pages.events, "url.searchParams.set('origin','annie')");

console.log('Annie origin return-link contract tests passed');
