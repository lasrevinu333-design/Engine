import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weatherFacts } from '../mobile/src/custodial/home-facts.js';
import { installHourlyForecastKeyboard } from '../mobile/src/custodial/hourly-forecast-keyboard.js';

const html = readFileSync(new URL('../mobile/src/custodial/index.html', import.meta.url), 'utf8');
const strip = html.match(/<ul id="home-weather-hours"[^>]*><\/ul>/)?.[0];
assert.ok(strip, 'Actual employee Home forecast strip is required');
assert.match(strip, /\brole="region"/);
assert.match(strip, /\btabindex="0"/);
assert.match(strip, /\baria-label="Hourly weather forecast; use left and right arrow keys to scroll"/);
assert.match(html, /\.hourlyFacts:focus-visible\{outline:3px solid #fff;outline-offset:3px\}/);
const app = readFileSync(new URL('../mobile/src/custodial/app.js', import.meta.url), 'utf8');
assert.match(app, /installHourlyForecastKeyboard\(document\.getElementById\('home-weather-hours'\)\)/);

const handlers = new Map();
const stripNode = {
  clientWidth: 280, scrollWidth: 1000, scrollLeft: 0,
  addEventListener: (kind, listener) => handlers.set(kind, listener),
  removeEventListener: (kind, listener) => {
    if (handlers.get(kind) === listener) handlers.delete(kind);
  },
};
const dispose = installHourlyForecastKeyboard(stripNode);
assert.equal(typeof handlers.get('keydown'), 'function');
function key(keyName, extra = {}) {
  let prevented = false;
  handlers.get('keydown')({ key: keyName, preventDefault: () => { prevented = true; }, ...extra });
  return prevented;
}
assert.equal(key('End'), true);
assert.equal(stripNode.scrollLeft, 720);
assert.equal(key('ArrowRight'), true);
assert.equal(stripNode.scrollLeft, 720, 'edge must not scroll the root page');
assert.equal(key('ArrowLeft'), true);
assert.equal(stripNode.scrollLeft, 510);
assert.equal(key('Home'), true);
assert.equal(stripNode.scrollLeft, 0);
assert.equal(key('ArrowRight'), true);
assert.equal(stripNode.scrollLeft, 210);
assert.equal(key('ArrowLeft'), true);
assert.equal(stripNode.scrollLeft, 0);
assert.equal(key('ArrowRight', { ctrlKey: true }), false);
assert.equal(stripNode.scrollLeft, 0);
assert.equal(key('Tab'), false);
stripNode.scrollWidth = stripNode.clientWidth;
assert.equal(key('End'), false, 'no overflow must retain ordinary page key behavior');
assert.equal(stripNode.scrollLeft, 0);
dispose();
assert.equal(handlers.size, 0);
assert.equal(typeof installHourlyForecastKeyboard(null), 'function');

const now = Date.parse('2026-10-03T15:30:00.000Z');
const floor = Math.floor(now / 3_600_000) * 3600;
const hours = Array.from({ length: 8 }, (_, index) => floor + index * 3600);
const weather = weatherFacts({ hourly_units: { time: 'unixtime', temperature_2m: '°F' },
  hourly: { time: hours, temperature_2m: hours.map((_, index) => 70 + index) } },
new Date(now).toISOString(), now);
assert.equal(weather.hours.length, 8);
assert.equal(weather.hours[0].temperature, '70°F');
assert.equal(weather.hours.at(-1).temperature, '77°F');
console.log('G04_FOCUSABLE_EIGHT_HOUR_SOURCE_CONTRACT_PASS');
