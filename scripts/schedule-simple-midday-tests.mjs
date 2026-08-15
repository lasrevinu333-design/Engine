import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../schedule-simple.html', import.meta.url), 'utf8');
const scriptMatch = html.match(/<script>\n([\s\S]*)\n\s*<\/script>/);
assert.ok(scriptMatch, 'schedule-simple inline script should be extractable');
let script = scriptMatch[1];
script = script.replace(/\n\s*init\(\)\.catch\(\(error\)=>setStatus\(`Startup failed: \$\{safe\(error\)\}`,true,'error'\)\);/, '\n    // init() disabled for unit harness');

const nodes = new Map();
function makeNode(id) {
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: { add() {}, remove() {} },
    addEventListener() {},
    querySelectorAll() { return []; },
  };
}
function getNode(id) {
  if (!nodes.has(id)) nodes.set(id, makeNode(id));
  return nodes.get(id);
}

let fakeNow = new Date(2026, 5, 5, 14, 12, 0); // Jun 5 2026, 2:12 PM local
class FixedDate extends Date {
  constructor(...args) {
    if (args.length) super(...args);
    else super(fakeNow.getTime());
  }
  static now() { return fakeNow.getTime(); }
  static parse(value) { return Date.parse(value); }
  static UTC(...args) { return Date.UTC(...args); }
}

const storage = new Map();
const locationState = {
  href: 'https://example.test/Engine/schedule-simple.html?device=KIOSK_01',
  search: '?device=KIOSK_01',
  pathname: '/Engine/schedule-simple.html',
  hostname: 'example.test',
};

const context = {
  console,
  URL,
  URLSearchParams,
  Date: FixedDate,
  setTimeout() {},
  setInterval() {},
  navigator: { clipboard: { writeText: async () => {} } },
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  sessionStorage: { getItem: () => null, setItem() {} },
  window: {
    location: locationState,
    MemphisAuth: {
      requireOpsManagerSession: async () => {},
      opsManagerAuthHeaders: async () => ({}),
      getOperationalServiceDate: () => '2026-06-05',
    },
    confirm: () => true,
    prompt: () => null,
  },
  document: {
    referrer: '',
    getElementById: getNode,
  },
};
context.window.window = context.window;
context.window.document = context.document;
context.window.localStorage = context.localStorage;
context.window.sessionStorage = context.sessionStorage;
context.globalThis = context;

vm.createContext(context);
vm.runInContext(script, context, { filename: 'schedule-simple.html' });

assert.equal(context.localIsoDate(fakeNow), '2026-06-05');
assert.equal(context.localTimeString(fakeNow), '14:12:00');

const employeeIds = Array.from({ length: 8 }, (_, index) => `emp-${index + 1}`);
const day = {
  roster: employeeIds.map((id, index) => ({
    employee_id: id,
    employee_name: `Employee ${index + 1}`,
    shift_start: '05:00:00',
    shift_end: index < 5 ? '14:00:00' : '17:30:00',
  })),
  groups: employeeIds.map((id, index) => ({
    group_name: `Area ${index + 1}`,
    segments: [{
      assigned_employee_id: id,
      assigned_employee_name: `Employee ${index + 1}`,
      status: 'ASSIGNED',
      owner_type: 'EMPLOYEE',
      coverage_start: '05:00 AM',
      coverage_end: index < 5 ? '02:00 PM' : '05:30 PM',
    }],
  })),
};

getNode('service-date').value = '2026-06-05';
context.renderAvailableEmployees(day, new Set());
assert.equal(
  getNode('available-count').textContent,
  '8',
  'today absence/reassignment list must keep the full scheduled roster even after some shifts have ended'
);
assert.match(getNode('employee-list').innerHTML, /Employee 1/);
assert.match(getNode('employee-list').innerHTML, /Employee 8/);
assert.doesNotMatch(getNode('employee-list').innerHTML, /Still scheduled today/);
assert.doesNotMatch(getNode('employee-list').innerHTML, /off shift|clocked out/i);

assert.match(script, /els\.serviceDate\.value=localIsoDate\(\)/, 'default date must use local calendar date, not UTC ISO date');
assert.doesNotMatch(script, /filter\(\(row\)=>hasReassignableCoverage\(row,els\.serviceDate\.value\)\)/, 'available absence list must not filter same-day scheduled staff by current time');
assert.doesNotMatch(script, /off shift\/clocked out/i, 'empty-state copy must not imply scheduled employees are hidden because their shift ended');

console.log('schedule-simple-midday-tests passed');
