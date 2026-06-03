import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const repo = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, repo), 'utf8');
const annieWeb = readFileSync('/home/eric/.hermes/profiles/annie/apps/annie_web.py', 'utf8');

const pages = {
  startPage: read('start_page1.html'),
  dashboard: read('dashboard.html'),
  messages: read('messages.html'),
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

function assertAnnieShortcut(label, href) {
  contains(`Annie shortcut ${label}`, annieWeb, href);
}

assertAnnieShortcut('dashboard', 'dashboard.html?hub=manager&origin=annie');
assertAnnieShortcut('messages', 'messages.html?hub=manager&origin=annie');
assertAnnieShortcut('schedule-simple', 'schedule-simple.html?origin=annie');
assertAnnieShortcut('events-admin', 'events-admin.html?origin=annie');
assertAnnieShortcut('upcoming-events', 'events.html?hub=manager&origin=annie');
assertAnnieShortcut('feedback', 'system-feedback.html?hub=manager&origin=annie');
contains('Annie shortcut upcoming-events image', annieWeb, 'ops-hub/events-shortcut.png');
contains('Annie shortcut feedback image', annieWeb, 'ops-hub/feedback-shortcut.png');
doesNotContain('Annie shortcuts keep Guest Issues removed', annieWeb, 'guest-issues.html?origin=annie');

for (const [label, html] of [
  ['dashboard.html', pages.dashboard],
  ['messages.html', pages.messages],
  ['schedule-simple.html', pages.scheduleSimple],
  ['schedule.html', pages.schedule],
  ['schedule-employee-day.html', pages.scheduleEmployeeDay],
  ['system-feedback.html', pages.feedback],
  ['guest-issues.html', pages.guestIssues],
]) {
  contains(`${label} detects Annie origin`, html, 'function isAnnieOrigin');
  contains(`${label} declares Annie return URL`, html, 'ANNIE_RETURN_URL');
  contains(`${label} stores Annie route in tab session`, html, 'ANNIE_ORIGIN_SESSION_KEY');
  contains(`${label} detects Annie referrer fallback`, html, 'document.referrer');
  matches(`${label} routes Annie-origin back to Annie`, html, /ANNIE_RETURN_URL\s*;\s*return\s*;/);
}
contains('guest-issues.html uses deterministic goBack instead of browser history', pages.guestIssues, 'els.back.addEventListener(\'click\',goBack)');
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
contains('events-admin.html rewires top back link to Annie', pages.eventsAdmin, 'els.backHubLink.href=ANNIE_RETURN_URL');
contains('events-admin.html labels top back link Back to Annie', pages.eventsAdmin, "els.backHubLink.textContent='Back to Annie'");
contains('events.html stores Annie route in tab session', pages.events, 'ANNIE_ORIGIN_SESSION_KEY');
contains('events.html detects Annie referrer fallback', pages.events, 'document.referrer');
contains('thread.html stores Annie route in tab session', pages.thread, 'ANNIE_ORIGIN_SESSION_KEY');
contains('thread.html detects Annie referrer fallback', pages.thread, 'document.referrer');

contains('messages nested thread preserves Annie origin', pages.messages, 'preserveAnnieOrigin(new URL(\'./thread.html\'');
contains('thread back preserves Annie origin to messages', pages.thread, 'preserveAnnieOrigin(new URL(\'./messages.html\'');
contains('schedule simple advanced link preserves Annie origin', pages.scheduleSimple, 'preserveAnnieOrigin(new URL(\'./schedule.html\'');
contains('schedule simple employee view preserves Annie origin', pages.scheduleSimple, 'preserveAnnieOrigin(new URL(\'./schedule-employee-day.html\'');
contains('advanced schedule employee view preserves Annie origin', pages.schedule, 'preserveAnnieOrigin(new URL(\'./schedule-employee-day.html\'');

contains('Event Input Console public-board link preserves Annie origin', pages.eventsAdmin, "url.searchParams.set('origin','annie')");
contains('Event Input Console public-board link marks nested admin return', pages.eventsAdmin, "url.searchParams.set('return','events-admin')");
contains('Public Events Board reads nested return marker', pages.events, "searchParams.get('return')");
contains('Public Events Board can return to Event Input Console', pages.events, "events-admin.html");
contains('Public Events Board preserves Annie origin when returning to Event Input Console', pages.events, "url.searchParams.set('origin','annie')");

console.log('Annie origin return-link contract tests passed');
