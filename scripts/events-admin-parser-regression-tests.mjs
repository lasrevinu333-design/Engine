import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../events-admin.html', import.meta.url), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
assert.ok(inlineScripts.length, 'events-admin.html should include an inline script');

function makeElement(id = '') {
  const element = {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    hidden: false,
    dataset: {},
    style: {},
    files: [],
    options: [],
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    setAttribute() {},
    getAttribute() { return ''; },
    querySelectorAll() { return []; },
    scrollIntoView() {},
  };
  Object.defineProperty(element, 'selectedOptions', {
    get() { return (this.options || []).filter((option) => option.selected); },
  });
  return element;
}

const elements = new Map();
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Date,
  RegExp,
  URL,
  crypto: { randomUUID: () => '90000000-0000-4000-8000-000000000001' },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: [] }) }),
  document: {
    referrer: '',
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelector() { return makeElement(); },
  },
  window: {
    location: { href: 'https://lasrevinu333-design.github.io/Engine/events-admin.html' },
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
sandbox.window.sessionStorage = sandbox.sessionStorage;
sandbox.window.fetch = sandbox.fetch;
sandbox.window.URL = URL;
sandbox.window.crypto = sandbox.crypto;

vm.createContext(sandbox);
for (const script of inlineScripts) vm.runInContext(script, sandbox, { filename: 'events-admin.html' });

assert.equal(typeof sandbox.window.__validateEventPayloadForTest, 'function', 'validation test hook should be exposed');
assert.equal(typeof sandbox.window.__buildEventPayloadForTest, 'function', 'form payload test hook should be exposed');
assert.equal(typeof sandbox.window.__hasZooWideLanguageForTest, 'function', 'zoo-wide language test hook should be exposed');
assert.equal(typeof sandbox.window.__formatEventDateRangeForTest, 'function', 'date range test hook should be exposed');

const ZOO_GROUP_ID = '20000000-0000-4000-8000-000000000000';
const ZOO_VENUE_ID = '10000000-0000-4000-8000-000000000000';
const EVENT_CENTER_GROUP_ID = '00000000-0000-4000-8000-000000000001';
const EVENT_CENTER_VENUE_ID = '10000000-0000-4000-8000-000000000001';
const TETON_GROUP_ID = '00000000-0000-4000-8000-000000000006';
const TETON_VENUE_ID = '10000000-0000-4000-8000-000000000006';
const MEMMEX_GROUP_ID = '30000000-0000-4000-8000-000000000001';

const state = sandbox.window.__eventConsoleState;
state.eventVenues = [
  {
    venue_id: ZOO_VENUE_ID,
    venue_code: 'ZOO_FOOTPRINT',
    display_name: 'Zoo Footprint',
    event_scope: 'ZOO_WIDE',
    location_group_id: ZOO_GROUP_ID,
    eligible_event_venue: false,
  },
  {
    venue_id: EVENT_CENTER_VENUE_ID,
    venue_code: 'EVENT_CENTER',
    display_name: 'Event Center',
    event_scope: 'SINGLE_VENUE',
    location_group_id: EVENT_CENTER_GROUP_ID,
    eligible_event_venue: true,
  },
  {
    venue_id: TETON_VENUE_ID,
    venue_code: 'TETON_LODGE',
    display_name: 'Teton Lodge',
    event_scope: 'SINGLE_VENUE',
    location_group_id: TETON_GROUP_ID,
    eligible_event_venue: true,
  },
];
state.locationGroups = [
  { location_group_id: ZOO_GROUP_ID, group_name: 'Zoo Footprint', group_code: 'ZOO_FOOTPRINT', eligible_custodial_coverage: false },
  { location_group_id: EVENT_CENTER_GROUP_ID, group_name: 'Event Center', group_code: 'EC', eligible_custodial_coverage: true },
  { location_group_id: TETON_GROUP_ID, group_name: 'Teton Lodge', group_code: 'TETON', eligible_custodial_coverage: true },
  { location_group_id: MEMMEX_GROUP_ID, group_name: 'MemMex Restrooms', group_code: 'MEMMEX_RESTROOMS', eligible_custodial_coverage: true, public_restroom: true },
];
state.coverageLocations = state.locationGroups.filter((row) => row.eligible_custodial_coverage !== false);

const eventName = elements.get('event-name');
const eventScope = elements.get('event-scope');
const eventVenue = elements.get('event-venue');
const coverageLocations = elements.get('coverage-locations');
const eventDate = elements.get('event-date');
const startTime = elements.get('start-time');
const endTime = elements.get('end-time');
const attendeeCount = elements.get('attendee-count');
const notes = elements.get('notes');
eventVenue.options = [
  { value: EVENT_CENTER_VENUE_ID, selected: false },
  { value: TETON_VENUE_ID, selected: false },
];
coverageLocations.options = [
  { value: EVENT_CENTER_GROUP_ID, selected: false },
  { value: TETON_GROUP_ID, selected: false },
  { value: MEMMEX_GROUP_ID, selected: false },
];

function setSelected(select, values = []) {
  const wanted = new Set(values);
  for (const option of select.options || []) option.selected = wanted.has(option.value);
}

function setForm({
  name = 'Members Night',
  scope = 'ZOO_WIDE',
  venueIds = [],
  coverageIds = [],
  date = '2026-07-17',
  start = '18:00',
  end = '20:30',
  attendees = '',
  noteText = '',
} = {}) {
  eventName.value = name;
  eventScope.value = scope;
  setSelected(eventVenue, venueIds);
  setSelected(coverageLocations, coverageIds);
  eventDate.value = date;
  startTime.value = start;
  endTime.value = end;
  attendeeCount.value = attendees;
  notes.value = noteText;
}

for (const phrase of ['zoo wide', 'zoo-wide', 'entire zoo', 'across the zoo', 'campus-wide', 'park-wide']) {
  assert.equal(sandbox.window.__hasZooWideLanguageForTest(`Members Night ${phrase}`), true, `${phrase} should be recognized as zoo-wide language`);
}

setForm({ scope: 'ZOO_WIDE', coverageIds: [MEMMEX_GROUP_ID] });
let payload = sandbox.window.__buildEventPayloadForTest();
assert.equal(payload.event_scope, 'ZOO_WIDE');
assert.equal(payload.display_location, 'Zoo Footprint');
assert.equal(payload.location_group_id, ZOO_GROUP_ID);
assert.deepEqual(Array.from(payload.venue_ids), [ZOO_VENUE_ID]);
assert.deepEqual(Array.from(payload.coverage_location_ids), [MEMMEX_GROUP_ID], 'MemMex should stay available as custodial coverage');
assert.equal(sandbox.window.__validateEventPayloadForTest(payload).length, 0, 'zoo-wide Members Night with MemMex coverage should validate');

setForm({ name: 'Restroom Party', scope: 'SINGLE_VENUE', venueIds: [], coverageIds: [MEMMEX_GROUP_ID] });
payload = sandbox.window.__buildEventPayloadForTest();
assert.notEqual(payload.location_group_id, MEMMEX_GROUP_ID, 'restroom coverage must not become primary event location');
assert.match(sandbox.window.__validateEventPayloadForTest(payload).join('; '), /single venue requires exactly one/i, 'single venue cannot save without an eligible venue');

setForm({ name: 'Donor Dinner', scope: 'SINGLE_VENUE', venueIds: [EVENT_CENTER_VENUE_ID], coverageIds: [MEMMEX_GROUP_ID], attendees: '85', noteText: 'Extra restroom check after dessert.' });
payload = sandbox.window.__buildEventPayloadForTest();
assert.equal(payload.event_scope, 'SINGLE_VENUE');
assert.equal(payload.display_location, 'Event Center');
assert.equal(payload.location_group_id, EVENT_CENTER_GROUP_ID);
assert.deepEqual(Array.from(payload.coverage_location_ids), [MEMMEX_GROUP_ID]);
assert.equal(sandbox.window.__validateEventPayloadForTest(payload).length, 0, 'single eligible venue with restroom coverage should validate');

setForm({ name: 'Multi Venue Rental', scope: 'MULTI_VENUE', venueIds: [EVENT_CENTER_VENUE_ID, TETON_VENUE_ID], coverageIds: [MEMMEX_GROUP_ID] });
payload = sandbox.window.__buildEventPayloadForTest();
assert.equal(payload.event_scope, 'MULTI_VENUE');
assert.equal(payload.display_location, 'Event Center, Teton Lodge');
assert.deepEqual(Array.from(payload.venue_ids), [EVENT_CENTER_VENUE_ID, TETON_VENUE_ID]);
assert.equal(sandbox.window.__validateEventPayloadForTest(payload).length, 0, 'multiple venues should validate with two eligible venues');

setForm({ name: 'ARP Zoo Snooze', scope: 'SINGLE_VENUE', venueIds: [TETON_VENUE_ID], date: '2026-06-19', start: '22:00', end: '08:00', noteText: 'Overnight event ends the next morning.' });
payload = sandbox.window.__buildEventPayloadForTest();
assert.equal(sandbox.window.__isOvernightEventPayloadForTest(payload), true, 'overnight event context should permit next-morning end time');
assert.equal(sandbox.window.__validateEventPayloadForTest(payload).length, 0, 'overnight Zoo Snooze can be saved with a next-morning end time');

const sameDayLabel = sandbox.window.__formatEventDateRangeForTest({ event_date: '2026-06-19', end_date: '2026-06-19' });
const overnightLabel = sandbox.window.__formatEventDateRangeForTest({ event_date: '2026-06-19', end_date: '2026-06-20' });
assert.doesNotMatch(sameDayLabel, /→/, 'same-day events should stay as a single date label');
assert.match(overnightLabel, /→/, 'overnight events should display a start-date to end-date range');
assert.match(overnightLabel, /Jun 19|6\/19|06\/19/, 'overnight label should include the start date');
assert.match(overnightLabel, /Jun 20|6\/20|06\/20/, 'overnight label should include the next-day end date');

console.log(JSON.stringify({
  ok: true,
  checked: [
    'zoo_wide_members_night_normalization',
    'restroom_coverage_not_primary_venue',
    'single_and_multi_venue_validation',
    'overnight_event_validation',
  ],
}, null, 2));
