import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');

assert.match(html, /id="recent-activity-section"/, 'dashboard must render a Recent Scan Activity section');
assert.match(html, /id="recent-activity-wrap"/, 'dashboard must include a recent activity table mount point');
assert.match(html, /recentActivity\s*:\s*\[\]/, 'dashboard state must track recent activity independently from per-location status rows');
assert.match(html, /payload\.data\?\.recent_activity/, 'dashboard refresh must read recent_activity from the backend summary payload');
assert.match(html, /function\s+renderRecentActivityTable/, 'dashboard must render individual recent scan rows');
assert.match(html, /Recent Scan Activity/, 'dashboard heading must name the scan-history section clearly');
assert.match(html, /session_uuid/, 'recent activity rows must keep session UUIDs so rapid same-location scans stay distinct');

console.log('dashboard recent activity frontend contract tests passed');
