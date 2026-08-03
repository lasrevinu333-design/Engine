import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const home = read('employee-hub.html');
const events = read('employee-events.html');
const feedback = read('employee-feedback.html');
const routes = read('mobile/src/shell/roles/custodial/routes.ts');
const build = read('mobile/scripts/build.mjs');
const bridge = read('mobile/src/custodial/bridge.js');
const notifications = read('mobile/src/custodial/notification-coordinator.js');

assert.match(home, /href="\.\/employee-events\.html\?hub=employee">Events</);
assert.match(home, /href="\.\/employee-feedback\.html\?hub=employee">Feedback</);
assert.doesNotMatch(home, /href="\.\/events\.html|href="\.\/system-feedback\.html/);

assert.match(routes, /custodial\.events[\s\S]*employee-events\.html\?hub=employee/);
assert.match(routes, /custodial\.feedback[\s\S]*employee-feedback\.html\?hub=employee/);
assert.match(build, /custodialCompatibilityFiles[\s\S]*'employee-events\.html'/);
assert.match(build, /custodialCompatibilityFiles[\s\S]*'employee-feedback\.html'/);
assert.match(build, /custodialProhibitedFiles[\s\S]*'events\.html'/);
assert.match(build, /custodialProhibitedFiles[\s\S]*'system-feedback\.html'/);
assert.match(bridge, /allowed = new Set\(\[[^\]]*'employee-events\.html'/);
assert.match(bridge, /allowed = new Set\(\[[^\]]*'employee-feedback\.html'/);
assert.match(notifications, /employee-events\.html\?hub=employee/);

for (const forbidden of [
  /Event Board/i,
  /live backend/i,
  /attendees?/i,
  /Operations Leadership/i,
  /manager triage/i,
  /Acknowledge/i,
  /Resolve/i,
]) {
  assert.doesNotMatch(events, forbidden, `employee Events must not include ${forbidden}`);
}
assert.match(events, /What may affect your work/);
assert.match(events, /custodial_instruction\|\|row\.employee_instruction/);
assert.match(events, /Could not update events\./);
assert.doesNotMatch(events, /HTTP \$\{|payload\.error/);

for (const forbidden of [
  /NFC or scan/i,
  /Phone or device/i,
  /Memphis answer/i,
  /Technical details/i,
  /feedback-inbox/i,
  /Acknowledge/i,
  /Resolve/i,
  /image/i,
]) {
  assert.doesNotMatch(feedback, forbidden, `employee Feedback must not include ${forbidden}`);
}
assert.match(feedback, />Something is broken</);
assert.match(feedback, />I need help</);
assert.match(feedback, />The app confused me</);
assert.match(feedback, /\/feedback-api\/submit/);
assert.match(feedback, /operation_id:id/);
assert.match(feedback, /Idempotency-Key/);

console.log('Custodial employee Events and Feedback contracts: PASS');
