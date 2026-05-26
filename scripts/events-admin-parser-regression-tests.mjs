import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../events-admin.html', import.meta.url), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
assert.ok(inlineScripts.length, 'events-admin.html should include an inline script');

function makeElement() {
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    dataset: {},
    style: {},
    files: [],
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    setAttribute() {},
    getAttribute() { return ''; },
  };
}

const elements = new Map();
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Date,
  RegExp,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: [] }) }),
  document: {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
  },
  window: {
    confirm: () => false,
    MemphisAuth: {
      requireOpsManagerSession: async () => ({ token: 'test-token', role: 'ops_manager' }),
      opsManagerAuthHeaders: async () => ({ Authorization: 'Bearer test-token', 'X-Device-Id': 'test-device' }),
      clearSession() {},
    },
  },
};
sandbox.globalThis = sandbox;
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.fetch = sandbox.fetch;

vm.createContext(sandbox);
for (const script of inlineScripts) vm.runInContext(script, sandbox, { filename: 'events-admin.html' });

assert.equal(typeof sandbox.window.__parseSpreadsheetRowForTest, 'function', 'parser test hook should be exposed');
sandbox.window.__eventConsoleState.locationGroups = [
  {
    location_group_id: 'trek-lodge',
    group_name: 'Trek - Lodge Only',
    group_code: 'TREK_LODGE',
    included_locations: ['Trek Lodge', 'Lodge Only'],
  },
];

const jetDental = sandbox.window.__parseSpreadsheetRowForTest({
  'Event Name': 'JET Dental',
  Location: 'Trek - Lodge Only',
  Date: '4/28/2026',
  'Start Time': '6:30 PM',
  'End Time': '9:00 PM',
  'Projected Attendance': '50',
  Notes: 'Event Name: JET Dental | Location: Trek - Lodge Only | Projected Attendance: 50 | Host Department: Animal Health | Manager on Duty: TBD',
}, 2);

assert.equal(jetDental.payload.event_name, 'JET Dental');
assert.equal(jetDental.payload.location_group_name, 'Trek - Lodge Only');
assert.equal(jetDental.payload.event_date, '2026-04-28');
assert.equal(jetDental.payload.start_time, '18:30');
assert.equal(jetDental.payload.end_time, '21:00');
assert.equal(jetDental.payload.attendee_count, '50');
assert.equal(jetDental.payload.notes ?? '', '', 'structured labels and host/manager residue should not pollute notes');

const operationalNotes = sandbox.window.__parseSpreadsheetRowForTest({
  'Event Name': 'Logan Zoo Snooze',
  Location: 'Trek - Lodge Only',
  Date: '5/2/2026',
  'Start Time': '6 PM',
  'End Time': '9 PM',
  Attendance: '35',
  Notes: 'Needs two trash cans by entrance; keep gate clear for bus pickup.',
}, 3);

assert.equal(
  operationalNotes.payload.notes,
  'Needs two trash cans by entrance; keep gate clear for bus pickup.',
  'real operational notes should be preserved'
);

console.log(JSON.stringify({ ok: true, checked: ['jet_dental_label_residue_removed', 'operational_notes_preserved'] }, null, 2));
