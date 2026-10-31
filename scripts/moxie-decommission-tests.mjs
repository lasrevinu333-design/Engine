import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const activePages = [
  'start_page1.html', 'dashboard.html', 'events.html',
  'guest-issues.html', 'schedule.html', 'schedule-simple.html',
  'schedule-employee-day.html', 'system-feedback.html',
];
for (const path of activePages) {
  assert.doesNotMatch(read(path), /\/moxie\/|moxie-link|data-mz-annie-back|ANNIE_RETURN_URL/, path);
}
for (const path of [
  'mobile/src/manager/moxie.html', 'mobile/src/manager/moxie.js',
  'Moxie_Owl_Icon_ui.webp', 'Moxie_Owl_Icon.jpg',
]) assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, path);


// October 5–6 consolidation retired manual event intake. Preserve only a
// compatibility entry to the one shared Events page; no old writer UI returns.
assert.equal(existsSync(new URL('../events-admin.html', import.meta.url)), true, 'retained Events compatibility entry');
const retainedEventsAdmin = read('events-admin.html');
assert.doesNotMatch(retainedEventsAdmin, /\/moxie(?:[\/?#\s"'`]|$)|moxie-link|data-mz-annie-back|ANNIE_RETURN_URL|ANNIE_ORIGIN_SESSION_KEY|isAnnieOrigin|preserveAnnieOrigin/);
assert.match(retainedEventsAdmin, /window\.location\.replace\(new URL\('\.\/events\.html', window\.location\.href\)\.href\)/);
assert.match(retainedEventsAdmin, /href="\.\/events\.html"/);
assert.doesNotMatch(retainedEventsAdmin, /<form|<input|<button|admin-api|saveEvent|deleteEvent|loadEventForEdit|fetch\(/);

assert.doesNotMatch(read('mobile/src/manager/index.html'), /moxie-mobile|moxie-tile/i);
assert.doesNotMatch(read('mobile/src/shell/roles/manager/routes.ts'), /manager\.moxie|moxie-mobile/i);
assert.doesNotMatch(read('mobile/scripts/build.mjs'), /moxie-mobile|manager\/moxie/i);
assert.doesNotMatch(read('mobile/src/shared/mobile-bridge.js'), /moxie-mobile-api/i);
assert.doesNotMatch(read('ops-hub.js'), /moxie-link|ANNIE_RETURN_URL/);
assert.doesNotMatch(read('mobile/src/chatscope/app.jsx'), /ANNIE_RETURN_URL|isAnnieOrigin/);
assert.match(read('mobile/src/chatscope/home-assistant-entry.mjs'), /request\('\/memphis\/thread'/);
assert.match(read('mobile/src/chatscope/app.jsx'), /createHomeAssistantEntry/);
assert.match(read('mobile/src/manager/index.html'), /Manager Access/);

console.log('MOXIE_DECOMMISSION_FRONTEND_PASS');
