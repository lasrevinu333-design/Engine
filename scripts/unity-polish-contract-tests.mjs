import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (file) => readFileSync(resolve(root, file), 'utf8');

const secondaryPages = new Map([
  ['admin.html', 'manager'],
  ['coverall-print.html', 'manager'],
  ['dashboard.html', 'manager'],
  ['device-security.html', 'manager'],
  ['employee-schedule.html', 'employee'],
  ['events-admin.html', 'manager'],
  ['events.html', 'contextual'],
  ['gemini-admin.html', 'manager'],
  ['guest-issues.html', 'manager'],
  ['manager-access.html', 'manager'],
  ['schedule-employee-day.html', 'manager'],
  ['schedule-simple.html', 'manager'],
  ['schedule.html', 'manager'],
  ['system-feedback.html', 'contextual'],
]);

for (const [file, context] of secondaryPages) {
  const source = read(file);
  assert.match(source, /href="\.\/memphis-ui\.css\?v=release-2026\.07\.24\.custodial-v3\.18"/, `${file} must load the shared design tokens`);
  assert.match(source, /src="\.\/memphis-ui\.js\?v=release-2026\.07\.24\.custodial-v3\.18"/, `${file} must load the shared interaction layer`);
  assert.match(source, new RegExp(`data-memphis-context="${context}"`), `${file} must declare its navigation context`);
  assert.equal((source.match(/data-mz-back(?:\s|=|>)/g) || []).length, 1, `${file} must have exactly one canonical Hub control`);
  assert.match(source, /data-mz-back[^>]*>Back</, `${file} must expose the canonical label before JavaScript runs`);
}

const messages = read('messages.html');
const messengerClient = read('messages-app.js');
const messengerCss = read('messenger-app.css');
const legacyThread = read('thread.html');
assert.match(messages, /href="\.\/memphis-ui\.css\?v=release-2026\.07\.24\.custodial-v3\.18"/, 'Messenger must load the shared design tokens');
assert.match(messages, /src="\.\/memphis-ui\.js\?v=release-2026\.07\.24\.custodial-v3\.18"/, 'Messenger must load the shared interaction layer');
assert.match(messages, /data-memphis-context="contextual"/);
assert.match(messages, /id="messenger-app"/);
assert.match(messages, /messages-app\.js/);
assert.match(messages, /messenger-app\.css/);
assert.doesNotMatch(messages, /chatscope/i);
assert.match(messengerClient, /els\.back\.addEventListener\('click'/);
assert.match(messengerClient, /function startThreadSwipe/);
assert.doesNotMatch(messengerClient, /\bconfirm\s*\(/);
assert.match(messengerCss, /\.threadSwipe\.revealed \.threadRow/);
assert.match(messengerCss, /touch-action:pan-y/);
assert.match(messengerCss, /#messenger-back\{min-width:61px;flex:0 0 auto\}/);
assert.match(legacyThread, /new URL\(['"]\.\/messages\.html['"],location\.href\)/);
assert.match(legacyThread, /searchParams\.set\(key,value\)/);
assert.match(legacyThread, /target\.hash=location\.hash/);

const allProduction = [
  ...secondaryPages.keys(),
  'messages.html',
  'thread.html',
  'employee-hub.html',
  'guest-qr.html',
  'guest-report.html',
  'index.html',
  'ops-manager-hub.html',
  'start_page1.html',
];
for (const file of allProduction) {
  const source = read(file);
  assert.doesNotMatch(source, /data-mz-back[^>]*>\s*(?:Back to Ops Hub|Back to Custodial Hub|Return to Ops Hub|Return to Hub|Back to Dashboard|Back to Hub|Go Back)\s*</i, `${file} must not expose a competing canonical label`);
}

assert.equal(existsSync(resolve(root, 'employee-schedule-mockup.html')), false, 'unreferenced schedule mockup must not ship');
assert.match(read('coverall-print.html'), /schedule-api\/coverall\/assignment/);
assert.doesNotMatch(read('coverall-print.html'), /dashboard-api\/coverall-printable/);

const sharedCss = read('memphis-ui.css');
for (const token of ['--mz-green', '--mz-bg', '--mz-panel', '--mz-text', '--mz-danger', '--mz-focus', '--mz-touch', '--mz-transition']) {
  assert.match(sharedCss, new RegExp(`${token.replace(/-/g, '\\-')}\\s*:`), `shared CSS must define ${token}`);
}
assert.match(sharedCss, /prefers-reduced-motion/);
assert.match(sharedCss, /:focus-visible/);
assert.match(sharedCss, /min-height:\s*var\(--mz-touch\)/);

const sharedJs = read('memphis-ui.js');
assert.match(sharedJs, /const OPS_HUB = "\.\/start_page1\.html"/);
assert.match(sharedJs, /const EMPLOYEE_HUB = "\.\/employee-hub\.html"/);
assert.match(sharedJs, /data-mz-protect-unsaved/);
assert.match(sharedJs, /beforeunload/);
assert.match(sharedJs, /stopImmediatePropagation/);
assert.match(sharedJs, /enforceTopLevelNavigation/);

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
assert.ok(contrast('102106', '84c341') >= 4.5, 'dark text on canonical green must meet WCAG AA normal-text contrast');
assert.ok(contrast('f8fafc', '071018') >= 4.5, 'canonical text on background must meet WCAG AA normal-text contrast');
assert.ok(contrast('d7e0ec', '071018') >= 4.5, 'canonical muted text on background must meet WCAG AA normal-text contrast');

for (const file of ['Header_ui.webp', 'Zoo_Logo_ui.webp', 'Guest_Issues_Icon_ui.webp', 'Event_Icon_Pink_ui.webp', 'Event_Icon_ui.webp', 'scheduler_icon_ui.webp', 'Dashboard_Avatar_ui.webp', 'memphis_avatar_ui.webp', 'Moxie_Owl_Icon_ui.webp']) {
  assert.ok(statSync(resolve(root, file)).size < 120_000, `${file} must remain below 120 KB`);
}

assert.match(read('gemini-admin.html'), /class="gemini-global-back mz-back-link" data-mz-back/);
assert.doesNotMatch(read('gemini-admin.html'), /class="hub-button"/);
assert.match(read('gemini-console.css'), /\.gemini-global-back/);
assert.match(read('system-feedback.html'), /data-mz-protect-unsaved="true"/);
assert.match(read('guest-report.html'), /data-mz-protect-unsaved="true"/);
assert.match(read('404.html'), /Page not found/);
assert.match(read('404.html'), /start_page1\.html/);
assert.match(read('404.html'), /employee-hub\.html/);

console.log(JSON.stringify({
  ok: true,
  classification: 'source-contract',
  secondary_pages_checked: secondaryPages.size,
  optimized_assets_checked: 9,
  release_id: 'release-2026.07.24.custodial-v3.18',
  messenger: 'memphis-custom',
}));
