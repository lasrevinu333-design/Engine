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


// The retired Moxie/Annie routes remain forbidden. The owner subsequently
// restored manual Events intake through the current authenticated cohort API.
assert.equal(existsSync(new URL('../events-admin.html', import.meta.url)), true, 'current manual Events input');
const retainedEventsAdmin = read('events-admin.html');
assert.doesNotMatch(retainedEventsAdmin, /\/moxie(?:[\/?#\s"'`]|$)|moxie-link|data-mz-annie-back|ANNIE_RETURN_URL|ANNIE_ORIGIN_SESSION_KEY|isAnnieOrigin|preserveAnnieOrigin/);
assert.match(retainedEventsAdmin, /https:\/\/memphis-zoo-mcp\.onrender\.com\/admin-api\/manual-events/);
assert.match(retainedEventsAdmin, /requireOpsManagerSession\(\{interactive:false,redirect:true\}\)/);
assert.match(retainedEventsAdmin, /MemphisAuth\.opsManagerAuthHeaders\(\)/);
assert.match(retainedEventsAdmin, /manual-event-operation\.v1/);
assert.doesNotMatch(retainedEventsAdmin, /\/admin-api\/events(?:[\/?#"']|$)/, 'retired direct event writer stays absent');

assert.doesNotMatch(read('mobile/src/manager/index.html'), /moxie-mobile|moxie-tile/i);
assert.doesNotMatch(read('mobile/src/shell/roles/manager/routes.ts'), /manager\.moxie|moxie-mobile/i);
assert.doesNotMatch(read('mobile/scripts/build.mjs'), /moxie-mobile|manager\/moxie/i);
assert.doesNotMatch(read('mobile/src/shared/mobile-bridge.js'), /moxie-mobile-api/i);
assert.doesNotMatch(read('ops-hub.js'), /moxie-link|ANNIE_RETURN_URL/);
assert.doesNotMatch(read('mobile/src/chatscope/app.jsx'), /ANNIE_RETURN_URL|isAnnieOrigin/);
assert.match(read('mobile/src/chatscope/home-assistant-entry.mjs'), /request\('\/memphis\/thread'/);
assert.match(read('mobile/src/chatscope/app.jsx'), /createHomeAssistantEntry/);
assert.doesNotMatch(read('mobile/src/manager/index.html'), /Manager Access/); // Owner removed the extra access page.

console.log('MOXIE_DECOMMISSION_FRONTEND_PASS');
