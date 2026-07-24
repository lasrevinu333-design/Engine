import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const repo = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, repo), 'utf8');

const pages = {
  startPage: read('start_page1.html'),
  startPageController: read('ops-hub.js'),
  dashboard: read('dashboard.html'),
  messages: read('messages.html'),
  messengerClient: read('messages-app.js'),
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
contains('Program Feedback loads the shared route layer', pages.feedback, 'memphis-ui.js?v=release-2026.07.24.custodial-v3.13');

contains('Custom Messenger loads its production client', pages.messages, 'messages-app.js');
contains('Custom Messenger declares contextual navigation', pages.messages, 'data-memphis-context="contextual"');
contains('Custom Messenger detects Annie origin', pages.messengerClient, 'function isAnnieOrigin');
contains('Custom Messenger declares Annie return URL', pages.messengerClient, 'ANNIE_RETURN_URL');
contains('Custom Messenger stores Annie route in tab session', pages.messengerClient, 'ANNIE_ORIGIN_SESSION_KEY');
contains('Custom Messenger detects Annie referrer fallback', pages.messengerClient, 'document.referrer');
contains('Custom Messenger returns Annie-origin sessions to Moxie', pages.messengerClient, '? ANNIE_RETURN_URL');
contains('Custom Messenger returns employee sessions to the employee Hub', pages.messengerClient, "'./employee-hub.html?hub=employee'");

contains('legacy thread entry redirects into the custom Messenger', pages.thread, "new URL('./messages.html'");
contains('legacy thread entry preserves query parameters', pages.thread, 'searchParams.set(key,value)');
contains('legacy thread entry preserves hash state', pages.thread, 'target.hash=location.hash');

contains('guest-issues.html uses deterministic goBack instead of browser history', pages.guestIssues, "els.back.addEventListener('click',goBack)");
doesNotContain('guest-issues.html avoids history.back regression', pages.guestIssues, 'history.back');
contains('unified Hub loads its route controller', pages.startPage, 'ops-hub.js');
contains('unified Hub controller detects Annie origin', pages.startPageController, 'function isAnnieOrigin');
contains('unified Hub controller stores Annie route in tab session', pages.startPageController, 'ANNIE_ORIGIN_SESSION_KEY');
contains('unified Hub controller preserves Annie origin on links', pages.startPageController, 'function preserveAnnieOrigin');
contains('unified Hub controller propagates Annie origin to dashboard', pages.startPageController, "const dashboardUrl=preserveAnnieOrigin(new URL('./dashboard.html'");
contains('unified Hub controller propagates Annie origin to events-admin', pages.startPageController, "const eventsAdminUrl=preserveAnnieOrigin(new URL('./events-admin.html'");
contains('unified Hub controller rewires events-admin app link', pages.startPageController, 'els.eventsAdminLink.href=eventsAdminUrl.toString()');
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
