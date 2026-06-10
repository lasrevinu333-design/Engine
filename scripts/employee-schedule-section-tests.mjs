import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../employee-schedule.html', import.meta.url), 'utf8');
const scriptMatch = html.match(/<script>\n([\s\S]*)\n\s*<\/script>/);
assert.ok(scriptMatch, 'employee-schedule inline script should be extractable');
let script = scriptMatch[1];
script = script.replace(/\n\s*init\(\)\.catch\(\(error\) => setStatus\(`Startup failed: \$\{safe\(error\)\}`, true\)\);/, '\n    // init() disabled for unit harness');

const nodes = new Map();
function makeNode(id) {
  return {
    id,
    textContent: '',
    innerHTML: '',
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

function segment(coverage_purpose, coverage_start = '06:00 AM', coverage_end = '10:00 AM', notes = '') {
  return { coverage_purpose, coverage_start, coverage_end, notes, segment_number: 1 };
}
function group(group_name, group_code, segments) {
  return { group_name, group_code, included_locations: [group_name], segments };
}

context.renderSchedule({
  service_date: '2026-06-09',
  employee_name: 'Tammy Miller',
  device_name: 'KIOSK_03',
  groups: [
    group('Teton', 'TETON', [segment('deep_clean')]),
    group('East End Restrooms', 'EAST_END_RESTROOMS', [segment('restroom_upkeep', '09:45 AM', '02:00 PM')]),
    group('Courtyard Restrooms', 'COURTYARD_RESTROOMS', [segment('lunch_coverage', '10:00 AM', '11:00 AM')]),
  ],
});
let rendered = getNode('assignment-grid').innerHTML;
assert.match(rendered, /Primary Ownership Locations/, 'primary section should render when primary assignments exist');
assert.doesNotMatch(rendered, /<h3 class="sectionTitle">9:45 AM Restroom Rebalance<\/h3>/, '9:45 changes must stay under Primary Ownership, not a separate heading');
assert.match(rendered, /9:45 AM Restroom Ownership/, '9:45 restroom ownership details should still be labeled inside Primary Ownership');
assert.match(rendered, /Lunch Coverage/, 'lunch section should render when lunch coverage assignments exist');
assert.match(rendered, /Teton/, 'primary item should render');
assert.match(rendered, /East End Restrooms/, '9:45 restroom item should render under Primary Ownership');

context.renderSchedule({
  service_date: '2026-06-09',
  employee_name: 'Kathy Phelps',
  device_name: 'KIOSK_04',
  groups: [group('Aquarium', 'AQUARIUM', [segment('deep_clean')])],
});
rendered = getNode('assignment-grid').innerHTML;
assert.match(rendered, /Primary Ownership Locations/, 'primary-only schedules should still show the primary heading');
assert.doesNotMatch(rendered, /9:45 AM Restroom Rebalance/, 'empty 9:45 section heading must be omitted');
assert.doesNotMatch(rendered, /<h3 class="sectionTitle">Lunch Coverage<\/h3>/, 'empty lunch section heading must be omitted');

context.renderSchedule({
  service_date: '2026-06-09',
  employee_name: 'Tammy Miller',
  device_name: 'Employee lookup',
  phase: 'current',
  notice: 'Assigned locations for today.',
  shift: { start: '05:00 AM', end: '02:00 PM' },
  items: [
    { name: 'East End Restrooms', status: 'Scheduled', is_public_restroom: true },
    { name: 'Teton', status: 'Scheduled', group_code: 'TETON' },
  ],
});
rendered = getNode('assignment-grid').innerHTML;
assert.match(rendered, /Primary Ownership Locations/, 'summary schedules should use the simple primary ownership heading');
assert.doesNotMatch(rendered, /Daily Coverage/, 'summary schedules should not show Daily Coverage');
assert.doesNotMatch(rendered, /current/, 'summary schedules should not show the current phase chip');
assert.doesNotMatch(rendered, /05:00 AM to 02:00 PM/, 'summary schedules should not show the shift time pill');
assert.doesNotMatch(rendered, /Scheduled/, 'summary location cards should not show Scheduled chips');
assert.doesNotMatch(rendered, /Assigned locations for today\./, 'summary schedules should not show filler explanatory copy');

context.renderSchedule({
  service_date: '2026-06-09',
  employee_name: 'Michael McWright',
  device_name: 'KIOSK_10',
  groups: [group('Zambezi', 'ZAMBEZI', [segment('late_coverage', '05:30 PM', 'Close')])],
});
rendered = getNode('assignment-grid').innerHTML;
assert.match(rendered, /Afternoon Call Coverage/, 'Michael late coverage should keep its own broad-coverage section');
assert.doesNotMatch(rendered, /<h3 class="sectionTitle">Lunch Coverage<\/h3>/, 'Michael page should not show empty lunch title');

console.log('employee-schedule-section-tests passed');
