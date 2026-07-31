import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../schedule.html', import.meta.url), 'utf8');

assert.match(html, /const params=new URLSearchParams\(window\.location\.search\);\s*els\.serviceDate\.value=params\.get\('service_date'\)\|\|params\.get\('date'\)\|\|window\.MemphisAuth\.getCSTDateString\(today\);/, 'advanced scheduler should honor service_date/date query links before falling back to today');
assert.match(html, /id="live-schedule-card"/, 'advanced scheduler must include a full live employee schedule details panel');
assert.match(html, /id="live-schedule-employee"/, 'advanced live schedule panel must include an employee dropdown');
assert.match(html, /\/my-day-summary\?service_date=\$\{encodeURIComponent\(serviceDate\)\}&employee_id=\$\{encodeURIComponent\(employeeId\)\}/, 'live schedule panel must use the current real-time employee summary endpoint by employee_id');
assert.match(html, /1 Hour Lunch Coverage/, 'live schedule panel must label lunch coverage exactly as requested');

const scriptMatch = html.match(/<script>\n([\s\S]*)\n\s*<\/script>/);
assert.ok(scriptMatch, 'schedule.html inline script should be extractable');
let script = scriptMatch[1];
script = script.replace(/\n\s*init\(\)\.catch\(\(error\)=>setStatus\(`Startup failed: \$\{safe\(error\)\}`, true\)\);/, '\n    // init() disabled for unit harness');

const nodes = new Map();
function makeNode(id) {
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    files: [],
    addEventListener() {},
    querySelectorAll() { return []; },
  };
}
function getNode(id) {
  if (!nodes.has(id)) nodes.set(id, makeNode(id));
  return nodes.get(id);
}

const context = {
  console,
  URL,
  URLSearchParams,
  Date,
  FileReader: class FileReader {},
  Blob: class Blob {},
  setTimeout() {},
  setInterval() {},
  clearInterval() {},
  window: {
    location: { href: 'https://example.test/Engine/schedule.html', search: '', hostname: 'example.test' },
    MemphisAuth: {
      requireOpsManagerSession: async () => ({}),
      getCSTDateString: () => '2026-07-02',
      opsManagerAuthHeaders: async () => ({}),
    },
  },
  location: { href: 'https://example.test/Engine/schedule.html', search: '', hostname: 'example.test' },
  localStorage: { getItem() { return ''; }, setItem() {} },
  sessionStorage: { getItem() { return ''; }, setItem() {} },
  document: {
    getElementById: getNode,
    querySelectorAll() { return []; },
    createElement() { return makeNode('created'); },
    body: { appendChild() {} },
  },
};
context.window.window = context.window;
context.window.document = context.document;
context.window.localStorage = context.localStorage;
context.window.sessionStorage = context.sessionStorage;
context.globalThis = context;

vm.createContext(context);
vm.runInContext(script, context, { filename: 'schedule.html' });

context.renderLiveScheduleEmployeeOptions([
  { employee_id: 'emp-tammy', display_name: 'Tammy Miller' },
  { employee_id: 'emp-kathy', display_name: 'Kathy Phelps' },
  { employee_id: 'coverall-01', employee_code: 'COVERALL_01', display_name: 'CoverAll_01', absence_eligible: false },
]);
assert.match(getNode('live-schedule-employee').innerHTML, /Tammy Miller/, 'employee dropdown should render live schedule employee options');
assert.match(getNode('live-schedule-employee').innerHTML, /Kathy Phelps/, 'employee dropdown should include every active employee loaded into advanced settings');
assert.match(getNode('live-schedule-employee').innerHTML, /CoverAll_01/, 'live schedule inspector may include CoverAll contractor slots for assignment review');

vm.runInContext(`
state.employees = [
  { employee_id: 'emp-tammy', display_name: 'Tammy Miller' },
  { employee_id: 'emp-kathy', display_name: 'Kathy Phelps' },
  { employee_id: 'coverall-01', employee_code: 'COVERALL_01', display_name: 'CoverAll_01', absence_eligible: false },
  { employee_id: 'coverall-02', employee_code: 'COVERALL_02', display_name: 'CoverAll_02' },
];
renderAbsenceEmployeeOptions(state.employees);
`, context);
assert.match(getNode('employee-list').innerHTML, /Tammy Miller/, 'absence selector should include real custodians');
assert.match(getNode('employee-list').innerHTML, /Kathy Phelps/, 'absence selector should include real custodians');
assert.doesNotMatch(getNode('employee-list').innerHTML, /CoverAll_0[12]/, 'absence selector must exclude CoverAll third-party contractor slots');

const ptoIds = vm.runInContext(`
state.ptoUpcomingRows = [
  { employee_id: 'emp-tammy', employee_name: 'Tammy Miller', start_date: '2026-07-02', end_date: '2026-07-02' },
  { employee_id: 'coverall-01', employee_code: 'COVERALL_01', employee_name: 'CoverAll_01', start_date: '2026-07-02', end_date: '2026-07-02' },
];
ptoEmployeeIdsForServiceDate('2026-07-02');
`, context);
assert.deepEqual(Array.from(ptoIds), ['emp-tammy'], 'PTO auto-selection must ignore CoverAll contractor slots');

context.renderLiveEmployeeSchedule({
  service_date: '2026-07-02',
  employee_name: 'Tammy Miller',
  phase: 'current',
  items: [
    { name: 'East End Restrooms', coverage_purpose: 'restroom_upkeep', coverage_start: '09:45 AM', coverage_end: '02:00 PM' },
    { name: 'Teton', coverage_purpose: 'area_owner', coverage_start: '09:45 AM', coverage_end: '02:00 PM' },
    { name: 'China Restrooms', coverage_purpose: 'lunch_coverage', coverage_start: '12:00 PM', coverage_end: '01:00 PM' },
  ],
});
const rendered = getNode('live-schedule-output').innerHTML;
assert.match(rendered, /Tammy Miller/, 'live schedule output should name the selected employee');
assert.match(rendered, /Restroom Rebalance/, 'live current primary section should render as Restroom Rebalance after 9:45');
assert.match(rendered, /1 Hour Lunch Coverage/, 'live schedule output should render lunch under its own requested title');
assert.ok(rendered.indexOf('Restroom Rebalance') < rendered.indexOf('1 Hour Lunch Coverage'), 'lunch coverage should sit under the restroom rebalance section');
assert.doesNotMatch(rendered, /Morning Full Clean Locations[\s\S]*China Restrooms/, 'lunch coverage must not be mixed into the manager morning schedule');

console.log('schedule-advanced-live-schedule-tests passed');
