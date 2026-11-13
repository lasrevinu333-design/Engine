import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../schedule-employee-day.html', import.meta.url), 'utf8');

assert.match(html, /Morning Full Clean Locations/, 'employee day page must use the requested Morning Full Clean Locations heading');
assert.match(html, /Restroom Rebalance/, 'employee day page must use the requested Restroom Rebalance heading');
assert.match(html, /\.assignmentSections\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'employee cards must render schedule sections as left/right columns on desktop');
assert.doesNotMatch(html, /const rows=phase==='morning'\?/, 'employee day page must not collapse all assignments into one phase section');

const scriptMatch = html.match(/<script>\n([\s\S]*)\n\s*<\/script>/);
assert.ok(scriptMatch, 'schedule-employee-day inline script should be extractable');
let script = scriptMatch[1];
script = script.replace(/\ninit\(\)\.catch\(\(error\)=>setStatus\(`Startup failed: \$\{safe\(error\)\}`,true\)\);/, '\n// init disabled for unit harness');

function nodeStub() {
  return {
    value: '2026-07-02',
    textContent: '',
    style: {},
    addEventListener() {},
    querySelectorAll() { return []; },
    innerHTML: '',
  };
}

const context = {
  console,
  Date,
  Map,
  Set,
  Array,
  String,
  Number,
  RegExp,
  URL,
  Blob: class Blob {},
  setTimeout() {},
  document: { getElementById: () => nodeStub() },
  localStorage: { getItem() { return ''; }, setItem() {} },
  sessionStorage: { getItem() { return ''; }, setItem() {} },
  location: { href: 'https://example.test/Engine/schedule-employee-day.html?service_date=2026-07-02', search: '?service_date=2026-07-02' },
  window: {
    location: { href: 'https://example.test/Engine/schedule-employee-day.html?service_date=2026-07-02', search: '?service_date=2026-07-02' },
    MemphisAuth: { getCSTDateString: () => '2026-07-02' },
    print() {},
  },
};
context.globalThis = context;
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(script, context, { filename: 'schedule-employee-day.html' });

const employee = {
  employee_id: 'EMP-TAMMY',
  employee_name: 'Tammy Miller',
  assignments: [
    { group_name: 'East End Restrooms', group_code: 'EAST_END_RR', coverage_start: '05:00 AM', coverage_end: '09:00 AM', coverage_purpose: 'deep_clean', notes: 'morning primary owner' },
    { group_name: 'Teton', group_code: 'TETON', coverage_start: '05:00 AM', coverage_end: '09:00 AM', coverage_purpose: 'deep_clean', notes: 'morning primary owner' },
    { group_name: 'East End Break Room', group_code: 'EAST_END_BREAK', coverage_start: '05:00 AM', coverage_end: '05:30 AM', coverage_purpose: 'reminder', notes: 'Friendly reminder only' },
    { group_name: 'North West Passage', group_code: 'NWP', coverage_start: '10:00 AM', coverage_end: '02:00 PM', coverage_purpose: 'area_owner', notes: '9:45 restroom rebalance. Return to owner after lunch' },
    { group_name: 'East End Restrooms', group_code: 'EAST_END_RR', coverage_start: '10:00 AM', coverage_end: '02:00 PM', coverage_purpose: 'restroom_upkeep', notes: '9:45 restroom rebalance' },
    { group_name: 'China Restrooms', group_code: 'CHINA_RR', coverage_start: '12:00 PM', coverage_end: '01:00 PM', coverage_purpose: 'lunch_coverage', notes: '1 hour lunch coverage' },
  ],
};

const sections = context.assignmentSections(employee);
assert.equal(JSON.stringify(sections.map((section) => section.title)), JSON.stringify(['Morning Full Clean Locations', 'Restroom Rebalance']), 'employee cards must split into morning-left and rebalance-right sections');
assert.equal(
  JSON.stringify([...sections[0].rows.map((row) => row.group_name)].sort()),
  JSON.stringify(['East End Break Room', 'East End Restrooms', 'Teton'].sort()),
  'morning section must contain only before-rebalance locations'
);
assert.equal(
  JSON.stringify([...sections[1].rows.map((row) => row.group_name)].sort()),
  JSON.stringify(['East End Restrooms', 'North West Passage'].sort()),
  'manager employee-day page must show only the manager-facing restroom rebalance rows, not lunch coverage'
);

const cardHtml = context.employeeCardHtml(employee);
assert.match(cardHtml, /assignmentSections/, 'employee card must render the side-by-side section container');
assert.ok(cardHtml.indexOf('Morning Full Clean Locations') < cardHtml.indexOf('Restroom Rebalance'), 'morning section must render to the left/before restroom rebalance');
assert.doesNotMatch(cardHtml, /1 Hour Lunch Coverage|Lunch Coverage|China Restrooms/, 'manager hub employee-day page must not include full live lunch schedule sections');
assert.doesNotMatch(cardHtml, /<table class="assignmentTable">/, 'employee card must not render the old single-column table layout');

console.log('schedule-employee-day section tests passed');
