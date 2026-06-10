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
assert.equal(typeof sandbox.window.__validateEventPayloadForTest, 'function', 'validation test hook should be exposed');
sandbox.window.__eventConsoleState.locationGroups = [
  {
    location_group_id: 'event-center',
    group_name: 'Event Center',
    group_code: 'EC',
    included_locations: ['Event Center', 'Event Ctr', 'EC'],
  },
  {
    location_group_id: 'trek-lodge',
    group_name: 'Trek - Lodge Only',
    group_code: 'TREK_LODGE',
    included_locations: ['Trek Lodge', 'Lodge Only'],
  },
  {
    location_group_id: 'northwest-passage',
    group_name: 'Northwest Passage',
    group_code: 'NWP',
    included_locations: ['Northwest Passage', 'North West Passage', 'NWP'],
  },
];

const lisaHortonBirthday = sandbox.window.__parseSpreadsheetRowForTest({
  'Event Name': 'Lisa Horton Birthday',
  Location: 'Event Center',
  Date: '4/28/2026',
  'Start Time': '6:30 PM',
  'End Time': '9:00 PM',
  'Projected Attendance': '50',
  Notes: 'Event Name: Lisa Horton Birthday | Location: Event Center | Projected Attendance: 50 | Host Department: Animal Health | Manager on Duty: TBD',
}, 2);

assert.equal(lisaHortonBirthday.payload.event_name, 'Lisa Horton Birthday');
assert.equal(lisaHortonBirthday.payload.location_group_name, 'Event Center');
assert.equal(lisaHortonBirthday.payload.event_date, '2026-04-28');
assert.equal(lisaHortonBirthday.payload.start_time, '18:30');
assert.equal(lisaHortonBirthday.payload.end_time, '21:00');
assert.equal(lisaHortonBirthday.payload.attendee_count, '50');
assert.equal(lisaHortonBirthday.payload.notes ?? '', '', 'structured labels and host/manager residue should not pollute notes');

const operationalNotes = sandbox.window.__parseSpreadsheetRowForTest({
  'Event Name': 'Overnight Campout',
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
assert.equal(operationalNotes.payload.location_group_name, 'Trek - Lodge Only', 'hyphenated event areas should remain covered');

const arpZooSnooze = sandbox.window.__parseSpreadsheetRowForTest({
  'Event Name': 'ARP Zoo Snooze',
  Location: 'North West Passage',
  Date: '6/19/2026',
  'Start Time': '10 PM',
  'End Time': '8 AM',
  Attendance: '75',
  Notes: 'Overnight event ends the next morning.',
}, 4);

assert.equal(arpZooSnooze.payload.event_name, 'ARP Zoo Snooze');
assert.equal(arpZooSnooze.payload.location_group_name, 'Northwest Passage');
assert.equal(arpZooSnooze.payload.event_date, '2026-06-19');
assert.equal(arpZooSnooze.payload.end_date, '2026-06-20');
assert.equal(arpZooSnooze.payload.start_time, '22:00');
assert.equal(arpZooSnooze.payload.end_time, '08:00');
assert.ok(!arpZooSnooze.reasons.includes('end time must be later than start time'), 'ARP Zoo Snooze can cross midnight without import rejection');
const arpValidationProblems = sandbox.window.__validateEventPayloadForTest(arpZooSnooze.payload);
assert.equal(
  arpValidationProblems.length,
  0,
  'ARP Zoo Snooze can be saved with a next-morning end time'
);

assert.equal(typeof sandbox.window.__formatEventDateRangeForTest, 'function', 'event date range test hook should be exposed');
const sameDayLabel = sandbox.window.__formatEventDateRangeForTest({ event_date: '2026-06-19', end_date: '2026-06-19' });
const overnightLabel = sandbox.window.__formatEventDateRangeForTest({ event_date: '2026-06-19', end_date: '2026-06-20' });
assert.doesNotMatch(sameDayLabel, /→/, 'same-day events should stay as a single date label');
assert.match(overnightLabel, /→/, 'overnight events should display a start-date to end-date range');
assert.match(overnightLabel, /Jun 19|6\/19|06\/19/, 'overnight label should include the start date');
assert.match(overnightLabel, /Jun 20|6\/20|06\/20/, 'overnight label should include the next-day end date');

console.log(JSON.stringify({ ok: true, checked: ['person_name_event_title_preserved', 'operational_notes_preserved', 'overnight_zoo_snooze_validation', 'overnight_end_date_display'] }, null, 2));
