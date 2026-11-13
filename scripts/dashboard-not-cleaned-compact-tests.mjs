import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [dashboard, sharedCss] = await Promise.all([
  readFile(new URL('dashboard.html', root), 'utf8'),
  readFile(new URL('memphis-ui.css', root), 'utf8'),
]);

assert.match(dashboard, /id="restroom-wrap"/);
assert.match(dashboard, /id="exhibit-wrap"/);
assert.match(dashboard, /status-not_cleaned/);
assert.match(sharedCss, /#restroom-wrap tbody tr:has\(\.status-not_cleaned\) td:nth-child\(n \+ 3\)/);
assert.match(sharedCss, /#exhibit-wrap tbody tr:has\(\.status-not_cleaned\) td:nth-child\(n \+ 3\)/);
assert.match(sharedCss, /display:\s*none\s*!important/);
assert.match(sharedCss, /In-progress and completed rows keep all available data/);

console.log('DASHBOARD_NOT_CLEANED_COMPACT_PASS');
