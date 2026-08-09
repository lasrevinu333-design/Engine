import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../employee-schedule.html', import.meta.url), 'utf8');
const scriptMatch = html.match(/<script>\n([\s\S]*)\n\s*<\/script>/);
assert.ok(scriptMatch, 'employee-schedule inline script should be extractable');
assert.match(html, /\/my-day-summary\?device_id=\$\{encodeURIComponent\(state\.currentDeviceId\)\}/, 'device Schedule must use the current-now summary endpoint');
assert.doesNotMatch(html, /Startup failed:|Refresh failed:|HTTP \$\{response\.status\}/, 'ordinary employees must not see raw startup, refresh, or HTTP language');
assert.match(html, /visibilitychange/, 'Schedule must refresh on foreground return');
assert.match(html, /window\.addEventListener\('online'/, 'Schedule must refresh on network reconnection');
assert.match(html, /memphis:native-notification-received/, 'Schedule must refresh when a native notification arrives');
assert.match(html, /scheduleBoundaryTimer/, 'Schedule must refresh at the next assignment-window boundary');
assert.doesNotMatch(html, />Refresh</, 'Schedule must not expose a permanent Refresh button');

let script = scriptMatch[1];
script = script.replace(/\n\s*void init\(\);/, '\n    // init disabled for unit harness');

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
const listeners = new Map();
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
  setInterval() { return 1; },
  clearInterval() {},
  setTimeout() { return 2; },
  clearTimeout() {},
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  window: {
    location: locationState,
    addEventListener(name, callback) { listeners.set(name, callback); },
    MemphisMobile: { enqueueEmployeeNotification: async () => true },
  },
  location: locationState,
  document: {
    hidden: false,
    visibilityState: 'visible',
    getElementById: getNode,
    addEventListener(name, callback) { listeners.set(`document:${name}`, callback); },
  },
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
  phase: 'morning',
  items: [
    { name: 'North West Passage', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM', coverage_end: '09:45 AM' },
    { name: 'East Admin', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM', coverage_end: '09:45 AM' },
    { name: 'Primate Pavilion', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM', coverage_end: '09:45 AM' },
    { name: 'East End Restrooms', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM', coverage_end: '09:45 AM' },
    { name: 'Teton Restrooms', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM', coverage_end: '09:45 AM' },
    { name: 'Teton', coverage_purpose: 'deep_clean', coverage_start: '05:00 AM', coverage_end: '09:45 AM' },
  ],
});

let rendered = getNode('assignment-grid').innerHTML;
assert.equal(getNode('employee-name').textContent, 'Tammy Miller');
assert.match(rendered, /Your areas now/);
assert.doesNotMatch(rendered, /Morning Full Clean Schedule|Restroom Rebalance Schedule|Primary Ownership Locations/);
assert.ok(rendered.indexOf('East End Restrooms') < rendered.indexOf('Teton'));
assert.ok(rendered.indexOf('Teton') < rendered.indexOf('Teton Restrooms'));
assert.ok(rendered.indexOf('North West Passage') < rendered.indexOf('East Admin'));
assert.ok(rendered.indexOf('East Admin') < rendered.indexOf('Primate Pavilion'));

const currentData = {
  service_date: '2026-06-09',
  employee_name: 'Tammy Miller',
  schedule_version: 'version-2',
  phase: 'current',
  items: [
    { name: 'East End Restrooms', coverage_purpose: 'restroom_upkeep', coverage_start: '09:45 AM', coverage_end: '02:00 PM' },
    { name: 'Teton', coverage_purpose: 'area_owner', coverage_start: '09:45 AM', coverage_end: '02:00 PM' },
    { name: 'China Restrooms', coverage_purpose: 'lunch_coverage', coverage_start: '12:00 PM', coverage_end: '01:00 PM' },
    { name: 'Northwest Passage', coverage_purpose: 'late_coverage', coverage_start: '03:00 PM', coverage_end: '05:00 PM' },
  ],
};
context.renderSchedule(currentData);
rendered = getNode('assignment-grid').innerHTML;
assert.match(rendered, /Your areas now/);
assert.match(rendered, /Lunch coverage until 0?1:00 PM/);
assert.match(rendered, /Added areas/);
assert.ok(rendered.indexOf('Your areas now') < rendered.indexOf('Lunch coverage until'));
assert.ok(rendered.indexOf('Lunch coverage until') < rendered.indexOf('Added areas'));

const previous = context.scheduleSnapshot({
  service_date: '2026-06-09',
  schedule_version: 'version-1',
  items: [
    { name: 'East End Restrooms', coverage_purpose: 'restroom_upkeep' },
  ],
});
const lunchAdded = context.scheduleSnapshot(currentData);
assert.equal(context.scheduleChangeNotification(previous, lunchAdded).kind, 'employee_lunch_coverage_start');
const lunchEnded = context.scheduleSnapshot({
  service_date: '2026-06-09',
  schedule_version: 'version-3',
  items: [{ name: 'East End Restrooms', coverage_purpose: 'restroom_upkeep' }],
});
assert.equal(context.scheduleChangeNotification(lunchAdded, lunchEnded).kind, 'employee_lunch_coverage_end');

context.setStatus('Could not update.', true);
assert.equal(getNode('status-pill').hidden, false);
assert.equal(getNode('retry-btn').hidden, false);
context.setStatus('');
assert.equal(getNode('status-pill').hidden, true);
assert.equal(getNode('retry-btn').hidden, true);

console.log('employee current-ownership Schedule tests: PASS');
