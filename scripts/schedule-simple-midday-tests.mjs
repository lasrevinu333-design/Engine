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
  Date,
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

const midday = new Date(2026, 5, 5, 14, 12, 0); // Jun 5 2026, 2:12 PM local
assert.equal(context.localIsoDate(midday), '2026-06-05');
assert.equal(context.localTimeString(midday), '14:12:00');
assert.equal(context.normalizeClockTime('14:00'), '14:00:00');

assert.equal(
  context.hasReassignableCoverage({ employee_name: 'Karen Robinson', shift_end: '14:00:00', last: '14:00' }, '2026-06-05', midday),
  false,
  'today midday list must exclude Karen after her 2pm shift end'
);
assert.equal(
  context.hasReassignableCoverage({ employee_name: 'Tammy Miller', shift_end: '14:00:00', last: '14:00' }, '2026-06-05', midday),
  false,
  'today midday list must exclude Tammy after her 2pm shift end'
);
assert.equal(
  context.hasReassignableCoverage({ employee_name: 'Alijah Collins', shift_end: '16:00:00', last: '16:00' }, '2026-06-05', midday),
  true,
  'today midday list must keep employees with future coverage'
);
assert.equal(
  context.hasReassignableCoverage({ employee_name: 'Karen Robinson', shift_end: '14:00:00', last: '14:00' }, '2026-06-06', midday),
  true,
  'future dates should still show full scheduled roster for planning'
);

assert.match(script, /els\.serviceDate\.value=localIsoDate\(\)/, 'default date must use local calendar date, not UTC ISO date');
assert.match(script, /filter\(\(row\)=>hasReassignableCoverage\(row,els\.serviceDate\.value\)\)/, 'available absence list must filter clocked-out staff');

console.log('schedule-simple-midday-tests passed');
