import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const guestReport = read('guest-report.html');
const guestQr = read('guest-qr.html');
const guestIssues = read('guest-issues.html');
const managerHub = read('start_page1.html');
const opsHub = read('ops-hub.js');
const feedback = read('system-feedback.html');

for (const source of [guestReport, guestQr, guestIssues, opsHub]) {
  assert.match(source, /guest-api\/status/, 'every guest entry point must honor the backend approval state');
}
assert.match(guestReport, /Awaiting Memphis Zoo approval/);
assert.match(guestQr, /Awaiting Memphis Zoo approval/);
assert.match(guestReport, /Marketing review/i);
assert.match(guestReport, /custodian currently assigned|current(?:ly)? assigned custodian/i);
assert.match(guestIssues, /No guest submissions are being accepted/);
assert.match(managerHub, /id="guest-issues-link"[^>]*hidden/);
assert.match(opsHub, /guest-issues-link/);
assert.match(opsHub, /data\?\.enabled===true/);
assert.doesNotMatch(guestIssues, /Marketing approve|data-action="approve"|data-action="reject"/);
assert.match(guestIssues, /data-action="resolve"/);

assert.match(feedback, /image_attachment\s*=\s*\{/);
assert.match(feedback, /data_url:\s*state\.image\.dataUrl/);
assert.match(feedback, /'Content-Type':\s*'application\/json'/);
assert.doesNotMatch(feedback, /new FormData|multipart\/form-data/i);
assert.match(feedback, /id="feedback-inbox"/);
assert.match(feedback, /dashboard-api\/system-feedback/);
assert.match(feedback, /data-action="acknowledged"/);
assert.match(feedback, /data-action="resolved"/);

console.log('audit 5 feedback and guest frontend contract tests passed');
