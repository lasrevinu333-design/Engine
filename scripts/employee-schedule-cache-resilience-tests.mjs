import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../employee-schedule.html', import.meta.url), 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1] || '';
assert.ok(inline.includes("void load('launch')"), 'schedule page launch loader must remain present');

const fixedNow = Date.parse('2026-09-21T18:00:00Z');
const FixedDate = class extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
  static now() { return fixedNow; }
};
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    id, textContent: '', innerHTML: '', hidden: false, dataset: {},
    addEventListener() {},
  });
  return elements.get(id);
}
const stored = new Map();
let fetchCalls = 0;
const freshItem = {
  id: 'fixture-area', name: 'Fresh Area', group_name: 'Fresh Area',
  coverage_start: '11:00', coverage_end: '14:00', coverage_purpose: 'area_owner',
};
const freshData = {
  service_date: '2026-09-21', employee_name: 'Fresh Employee', full_day: true,
  raw_items: [freshItem], current_items: [freshItem], notice: 'Fresh schedule',
};
const context = {
  Date: FixedDate, Intl, URL, console,
  document: { getElementById: element, addEventListener() {}, hidden: false },
  localStorage: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  },
  fetch: async () => {
    fetchCalls += 1;
    return { ok: true, json: async () => ({ ok: true, data: freshData }) };
  },
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 2, clearInterval() {},
};
context.window = {
  MemphisMobile: { ready: Promise.resolve(), deviceId: () => 'KIOSK_08' },
  MemphisCustodialSecurity: {
    getStatus: () => ({ deviceId: 'KIOSK_08' }),
    mutateProtectedWork: async () => { throw new Error('offline cache unavailable'); },
  },
  addEventListener() {},
};
vm.createContext(context);
vm.runInContext(inline, context);
await new Promise((resolve) => setTimeout(resolve, 20));

assert.equal(fetchCalls, 1, 'the fresh schedule should be fetched once');
assert.equal(element('employee').textContent, 'Fresh Employee', 'fresh server data must render even when optional cache persistence fails');
assert.equal(element('content').hidden, false, 'fresh schedule content must remain visible');
assert.match(element('areas').innerHTML, /Fresh Area/, 'fresh assignment must be shown');
assert.match(element('state-text').textContent, /offline copy/i, 'cache failure must be disclosed without relabeling a successful network read as offline');
assert.equal(element('retry').hidden, true, 'a cache-only failure must not present the schedule as a failed network request');
assert.equal(stored.size, 0, 'failed protected cache persistence must not fabricate a saved snapshot');

console.log('EMPLOYEE_SCHEDULE_CACHE_RESILIENCE_PASS');
