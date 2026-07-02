import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../employee-schedule.html', import.meta.url), 'utf8');
const scriptMatch = html.match(/<script>\n([\s\S]*)\n\s*<\/script>/);
assert.ok(scriptMatch, 'employee-schedule inline script should be extractable');
assert.match(html, /\/my-day-summary\?device_id=\$\{encodeURIComponent\(state\.currentDeviceId\)\}/, 'device schedule page must use the current-now summary endpoint');
assert.doesNotMatch(html, /\/my-day\?device_id=\$\{encodeURIComponent\(state\.currentDeviceId\)\}/, 'device schedule page must not use the raw segmented endpoint');
let script = scriptMatch[1];
script = script.replace(/\n\s*init\(\)\.catch\(\(error\) => setStatus\(`Startup failed: \$\{safe\(error\)\}`, true\)\);/, '\n    // init() disabled for unit harness');

const nodes = new Map();
function makeNode(id) {
  return {
    id,
    textContent: '',
    innerHTML: '',
    hidden: false,
    style: {},
    addEventListener() {},
  };
}
function getNode(id) {
  if (!nodes.has(id)) nodes.set(id, makeNode(id));
  return nodes.get(id);
}

const storage = new Map();
const locationState = {
  href: 'https://example.test/Engine/employee-schedule.html?employee_name=Tammy%20Miller',
  search: '?employee_name=Tammy%20Miller',
  pathname: '/Engine/employee-schedule.html',
  hostname: 'example.test',
};

const context = {
  console,
  URL,
  URLSearchParams,
  Date,
  setInterval() {},
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  window: { location: locationState },
  location: locationState,
  document: { getElementById: getNode },
};
context.window.window = context.window;
context.window.document = context.document;
context.window.localStorage = context.localStorage;
context.globalThis = context;

vm.createContext(context);
vm.runInContext(script, context, { filename: 'employee-schedule.html' });

context.renderSchedule({
  service_date: '2026-06-09',
  employee_name: 'Tammy Miller',
  device_name: 'Employee lookup',
  phase: 'morning',
  items: [
    { name: 'North West Passage', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM' },
    { name: 'East Admin', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM' },
    { name: 'Primate Pavilion', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM' },
    { name: 'East End Restrooms', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM' },
    { name: 'Teton Restrooms', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM' },
    { name: 'Teton', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM' },
  ],
});

let rendered = getNode('assignment-grid').innerHTML;
assert.equal(getNode('employee-name').textContent, 'Tammy Miller', 'hero should show the employee name only');
assert.match(getNode('service-date').textContent, /Tuesday, June 9, 2026/, 'hero should show the full weekday/date only');
assert.match(rendered, /Morning Full Clean Schedule/, 'morning schedules should use the morning full clean label');
assert.doesNotMatch(rendered, /Primary Ownership|Lunch Coverage|Afternoon Call Coverage|Scheduled|Assigned locations for today\./, 'employee schedule should not show old metadata labels or filler copy');
assert.ok(rendered.indexOf('East End Restrooms') < rendered.indexOf('Teton'), 'public restrooms should list before exhibit/restroom pairs');
assert.ok(rendered.indexOf('Teton') < rendered.indexOf('Teton Restrooms'), 'paired exhibit should list before its restroom');
assert.ok(rendered.indexOf('Teton Restrooms') < rendered.indexOf('North West Passage'), 'paired exhibit/restroom areas should come before remaining public exhibits');
assert.ok(rendered.indexOf('North West Passage') < rendered.indexOf('East Admin'), 'private admin areas should come after public areas');
assert.ok(rendered.indexOf('EastAdmin') === -1, 'rendered HTML should keep readable location names');
assert.ok(rendered.indexOf('East Admin') < rendered.indexOf('Primate Pavilion'), 'primate pavilion should stay last');

context.renderSchedule({
  service_date: '2026-06-09',
  employee_name: 'Tammy Miller',
  device_name: 'Employee lookup',
  phase: 'current',
  items: [
    { name: 'North West Passage', coverage_purpose: 'area_owner', coverage_start: '10:00 AM', coverage_end: '02:00 PM' },
    { name: 'Primate Canyon', coverage_purpose: 'area_owner', coverage_start: '10:00 AM', coverage_end: '02:00 PM' },
    { name: 'East End Restrooms', coverage_purpose: 'restroom_upkeep', coverage_start: '10:00 AM', coverage_end: '02:00 PM' },
    { name: 'Teton', coverage_purpose: 'area_owner', coverage_start: '10:00 AM', coverage_end: '02:00 PM' },
    { name: 'East Admin Restrooms', coverage_purpose: 'area_owner', coverage_start: '10:00 AM', coverage_end: '02:00 PM' },
    { name: 'China Restrooms', coverage_purpose: 'lunch_coverage', coverage_start: '12:00 PM', coverage_end: '01:00 PM' },
  ],
});
rendered = getNode('assignment-grid').innerHTML;
assert.match(rendered, /Restroom Rebalance/, 'rebalance schedules should keep the restroom rebalance label');
assert.match(rendered, /1 Hour Lunch Coverage/, 'lunch coverage should be added under the rebalance schedule with the requested title');
assert.ok(rendered.indexOf('Restroom Rebalance') < rendered.indexOf('1 Hour Lunch Coverage'), 'lunch coverage should render below the restroom rebalance schedule');
assert.doesNotMatch(rendered, /<h3 class="sectionTitle">Lunch Coverage<\/h3>|10:00 AM|02:00 PM|Scheduled|Notes|current/, 'employee schedule should not show old lunch title, timing, or phase metadata');
assert.ok(rendered.indexOf('East End Restrooms') < rendered.indexOf('Teton'), 'restrooms should stay first during rebalance');
assert.ok(rendered.indexOf('Teton') < rendered.indexOf('North West Passage'), 'paired exhibits should stay ahead of remaining exhibits during rebalance');
assert.ok(rendered.indexOf('North West Passage') < rendered.indexOf('East Admin Restrooms'), 'private admin restrooms should stay after public areas during rebalance');
assert.ok(rendered.indexOf('East Admin Restrooms') < rendered.indexOf('Primate Canyon'), 'always-last exhibits should remain last during rebalance');
assert.ok(rendered.indexOf('Primate Canyon') < rendered.indexOf('1 Hour Lunch Coverage'), 'lunch coverage must not be mixed into the restroom rebalance location list');
assert.match(rendered.slice(rendered.indexOf('1 Hour Lunch Coverage')), /China Restrooms/, 'lunch coverage section should contain lunch locations');
assert.equal(getNode('status-pill').hidden, false, 'status pill node should still exist for runtime errors/loading states');
context.setStatus('');
assert.equal(getNode('status-pill').hidden, true, 'successful loads should hide the status pill');

console.log('employee-schedule-section-tests passed');
