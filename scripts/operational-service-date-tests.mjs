#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../memphis-auth.js', import.meta.url), 'utf8');
const localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
const context = {
  console,
  crypto,
  Date,
  fetch,
  Intl,
  localStorage,
  URL,
  window: { location: { href: 'https://example.test/schedule-weekly.html', pathname: '/schedule-weekly.html' } },
};
context.window.window = context.window;
context.window.localStorage = localStorage;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'memphis-auth.js' });

const serviceDate = (instant) => context.window.MemphisAuth.getOperationalServiceDate(new Date(instant));
for (const [instant, expected] of [
  ['2026-08-10T08:59:00.000Z', '2026-08-09'],
  ['2026-08-10T09:00:00.000Z', '2026-08-10'],
  ['2026-03-08T08:59:00.000Z', '2026-03-07'],
  ['2026-03-08T09:00:00.000Z', '2026-03-08'],
  ['2026-11-01T09:59:00.000Z', '2026-10-31'],
  ['2026-11-01T10:00:00.000Z', '2026-11-01'],
]) assert.equal(serviceDate(instant), expected, `${instant} must use the canonical 04:00 Chicago service date`);

assert.equal(context.window.MemphisAuth.getChicagoMinutes(new Date('2026-08-10T08:59:00.000Z')), 239);
assert.equal(context.window.MemphisAuth.getCSTDateString(new Date('2026-08-10T08:59:00.000Z')), '2026-08-09');
console.log('operational service-date boundary tests: PASS');
