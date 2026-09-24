import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../employee-schedule.html', import.meta.url), 'utf8');

assert.match(html, /<h1>Your areas now<\/h1>/, 'Schedule must describe the employee task in plain language');
assert.match(
  html,
  /\/my-day-summary\?device_id=\$\{encodeURIComponent\(id\)\}/,
  'Schedule must use the current-now summary endpoint with the settled device identity',
);
assert.doesNotMatch(html, /\/my-day\?/, 'Schedule must not use the raw segmented endpoint');
assert.match(html, /Array\.isArray\(data\?\.current_items\)/, 'Schedule must consume only current assignment truth');
assert.doesNotMatch(html, /display_sections|all_items|data\?\.items/, 'Schedule must not reconstruct a route from broad schedule data');
assert.match(html, /function isRestroom\(item\)/, 'Restrooms must receive display priority');
assert.match(html, /Number\(isRestroom\(right\.item\)\)-Number\(isRestroom\(left\.item\)\)/, 'Restroom priority must be a stable display sort');
assert.doesNotMatch(html, /practical cleaning order|first stop|next stop|route/i, 'Schedule must not direct the employee route');
assert.match(html, /employee-schedule-snapshot\.v2/, 'Schedule must retain a protected-principal-scoped offline snapshot');
assert.match(html, /row\.principal===principal&&matches\(row\.data\)/, 'snapshot must match current principal and payload identity');
assert.match(html, /mutateProtectedWork/, 'Schedule snapshots must remain protected native work');
assert.match(html, /No connection — showing only known active windows from your last update/, 'Offline wording must not overclaim stale authority');
assert.match(html, /memphis:schedule-refresh/, 'Schedule must respond to assignment changes');
assert.match(html, /visibilitychange/, 'Schedule must refresh after returning to the app');
assert.match(html, /window\.addEventListener\('online'/, 'Schedule must refresh after connectivity returns');
assert.doesNotMatch(html, />Refresh<|Assigned Areas|Scheduled|Primary Ownership/, 'Employee UI must not expose technical or managerial schedule controls');

console.log('EMPLOYEE_SCHEDULE_CURRENT_AREAS_PASS');
