import fs from 'node:fs';
import assert from 'node:assert/strict';

const scan = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../memphis-ui.js', import.meta.url), 'utf8');

function slice(start, end) {
  const from = scan.indexOf(start);
  const to = scan.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  assert.ok(to > from, `missing end marker after ${start}: ${end}`);
  return scan.slice(from, to);
}

assert.match(scan, /title:"Full cleaning services"/, 'exact full-cleaning evidence label must remain');
assert.match(scan, /title:"Empty and clean feminine hygiene receptacles"/, 'exact feminine-receptacle evidence label must remain');
assert.match(scan, /title:"Mopped"/, 'exact mopping evidence label must remain');

const connectivity = slice('function setupConnectivityListeners()', 'async function openQueueDb');
assert.doesNotMatch(connectivity, /setAttribute\("role","button"\)|setAttribute\("tabindex"|tap to retry|Retrying \$\{|Online •|Offline •/i, 'sync state must not become an employee control or expose visible queue mechanics');
assert.match(connectivity, /removeAttribute\("role"\)/, 'legacy sync-button role must be removed');
assert.match(connectivity, /removeAttribute\("tabindex"\)/, 'legacy sync-button keyboard control must be removed');
assert.match(connectivity, /Saved\. Will send when connected\./, 'queued work must use plain saved wording');
assert.match(connectivity, /This phone needs a manager\./, 'dead-letter state must use manager-help wording');
assert.match(connectivity, /syncBadge\.hidden=true/, 'clear sync state must hide the badge');

const employeeSelect = slice('async function renderEmployeeSelect', 'function workPositionKey');
assert.match(employeeSelect, />Start Cleaning</);
assert.doesNotMatch(employeeSelect, /Pre-Scan|Device:|assigned to this kiosk by the server|MEMPHIS ZOO CUSTODIAL SCAN/i);

const positionBadge = slice('function showWorkPositionBadge', 'function workPlainPosition');
assert.match(positionBadge, /kind!==['"]alert['"]/);
assert.match(positionBadge, /Return to \$\{workPositionSession/);
assert.doesNotMatch(positionBadge, /GPS|accuracy|distance|boundary|stale/i);

const timer = slice('function renderTimerPage', 'function serviceLabel');
assert.match(timer, /Cleaning In Progress/);
assert.match(timer, /Tap this tag again when finished\./);
assert.doesNotMatch(timer, /Session ID|Server session active|server sync pending|MEMPHIS ZOO CUSTODIAL SCAN/i);

const complete = slice('function renderCompletePage', 'function completionDraftKey');
assert.match(complete, />Continue</);
assert.doesNotMatch(complete, /PRESS TO CONTINUE|Session ID|MEMPHIS ZOO CUSTODIAL SCAN/i);

const form = slice('async function renderCompletionForm', 'function parseRetryAfter');
assert.match(form, /id="full-cleaning"[^>]*checked/);
assert.match(form, />Full cleaning services</);
assert.match(form, />Choose individual work</);
assert.match(form, />Report a problem</);
assert.match(form, /id="individual-work"[^>]*hidden/);
assert.match(form, /id="problem-details"[^>]*hidden/);
assert.match(form, /services\.slice\(1\)/, 'individual-work panel must retain detailed service evidence');
assert.match(form, /maintenance_issues_found/);
assert.match(form, /out_of_order_signed/);
assert.doesNotMatch(form, /Session ID|Submission Saved — Sync Pending|server returns CLOSED|Keep this page open/i);
assert.match(form, /Saved\. It will send when connected\. You may keep working\./);

const completion = slice('async function completeSessionMaybeQueued', 'async function pingDevice');
assert.match(completion, /status:"pending_sync"/);
assert.match(completion, /state:"pending-sync"/);

const openSession = slice('function findAnyOpenLocalSessionForDevice', 'function cleanupStaleLocalSessions');
assert.doesNotMatch(openSession, /pending_sync/);

const localState = slice('async function getScanStateSafe', 'async function startSessionMaybeQueued');
assert.match(localState, /suggested_action:"submission_saved"/);

const wake = slice('async function resumeOpenSessionFromWake', 'async function bootstrap');
assert.doesNotMatch(wake, /pending_sync/);

assert.match(scan, /case"submission_saved"/);
assert.doesNotMatch(scan, /<div id="sync-badge" class="syncBadge">Starting…<\/div>/);
assert.match(scan, /<div id="sync-badge" class="syncBadge" hidden><\/div>/);
assert.doesNotMatch(scan, /renderMessageCard\("title-red","Startup Error","",safeError\(err\)\)/);

assert.match(ui, /OPEN_SCAN_STATUSES=new Set\(\["active","server-active","offline-provisional","pending_submit"\]\)/);
assert.doesNotMatch(ui, /OPEN_SCAN_STATUSES[^;]*pending_sync/);

console.log('Custodial employee scan v23 contracts: PASS');
