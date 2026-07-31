import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');

assert.doesNotMatch(html, /id="recent-activity-section"/, 'dashboard must not render a Recent Scan Activity section');
assert.doesNotMatch(html, /id="recent-activity-wrap"/, 'dashboard must not include a recent activity table mount point');
assert.doesNotMatch(html, /recentActivity\s*:/, 'dashboard state must not track recent activity');
assert.doesNotMatch(html, /payload\.data\?\.recent_activity/, 'dashboard refresh must not read recent_activity from the backend summary payload');
assert.doesNotMatch(html, /function\s+renderRecentActivityTable/, 'dashboard must not render individual recent scan rows');
assert.doesNotMatch(html, /Recent Scan Activity/, 'dashboard heading must be removed');

console.log('dashboard recent activity removal frontend contract tests passed');
