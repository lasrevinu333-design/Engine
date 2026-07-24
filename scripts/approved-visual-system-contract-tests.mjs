import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const text = async (path) => String(await read(path));
const sha256 = async (path) => createHash('sha256').update(await read(path)).digest('hex');

const expectedAssets = {
  'manager-icon-e-zoo-heritage.png': 'd1dd7012cc048f124bbc3971265916330386cb37a39be58882d1fcaab07f12d0',
  'theme-bg-hub.png': 'fef0ce2a0ede4a85de7f09c1c2588e39dbfd1fa688b58bddf9853160c2db03c7',
  'theme-bg-insights.png': 'da61fec25fb777052c5e6e4d79cab84084f5396075b6db578f2abea4d59a3bf7',
  'theme-bg-messenger.png': '08803b8cf3ad69013cf3f0ed2640694f09d73dddc9af6d8ca590dff02aa37b65',
  'theme-bg-operations.png': '45374151fc536fea802f8ddc658c782801f389c98de54b887b85fa40d02b75e1',
  'theme-bg-planning.png': '4b62c95945a1a9572d28043383a361434e1ae83a7dd4da49d05c644c3cb444ff',
  'theme-bg-scan.png': '8b645a047e7ca270ce3ed740d89d4b3192612fe44954f0f6e034bd0745080130',
};

for (const [asset, expected] of Object.entries(expectedAssets)) {
  assert.equal(await sha256(asset), expected, `${asset} must remain the exact approved visual asset`);
}

const [theme, ui, hub, hubCss, manager, custodial, messenger, messengerClient, messengerCss, branding] =
  await Promise.all([
    text('memphis-theme.css'),
    text('memphis-ui.js'),
    text('start_page1.html'),
    text('ops-hub.css'),
    text('mobile/src/manager/index.html'),
    text('mobile/src/custodial/index.html'),
    text('messages.html'),
    text('messages-app.js'),
    text('messenger-app.css'),
    text('mobile/scripts/configure-branding.mjs'),
  ]);

for (const [family, accent, asset] of [
  ['hub', '#35d1b2', 'theme-bg-hub.png'],
  ['operations', '#9dff35', 'theme-bg-operations.png'],
  ['planning', '#f2ac3c', 'theme-bg-planning.png'],
  ['messenger', '#aa8cff', 'theme-bg-messenger.png'],
  ['insights', '#8bdbff', 'theme-bg-insights.png'],
  ['scan', '#2cc7ea', 'theme-bg-scan.png'],
]) {
  assert.match(theme, new RegExp(`data-mz-theme="${family}"[\\s\\S]*?${accent}[\\s\\S]*?${asset.replace('.', '\\.')}`));
}

for (const [page, family] of [
  ['dashboard.html', 'operations'],
  ['guest-issues.html', 'operations'],
  ['phone-assignments.html', 'operations'],
  ['schedule.html', 'planning'],
  ['events.html', 'planning'],
  ['messages.html', 'messenger'],
  ['notifications.html', 'messenger'],
  ['operational-insights.html', 'insights'],
  ['index.html', 'scan'],
]) {
  assert.match(ui, new RegExp(`\\["${page.replace('.', '\\.')}", "${family}"\\]`));
}

assert.match(hub, /manager-icon-e-zoo-heritage\.png/);
assert.match(hub, /<h1>Custodial Hub<\/h1>/);
for (const family of ['operations', 'planning', 'messenger', 'insights']) {
  assert.match(hub, new RegExp(`data-family="${family}"`));
}
assert.match(hubCss, /hubTile\[data-family="operations"\]\{--tile-accent:#9dff35\}/);
assert.match(manager, /manager-icon-e-zoo-heritage\.png/);
assert.match(manager, /theme-bg-hub\.png/);
assert.match(manager, /data-family="operations"/);
assert.match(custodial, /theme-bg-hub\.png/);
assert.match(custodial, /data-family="messenger"/);
assert.match(messenger, /data-mz-theme="messenger"/);
assert.match(messenger, /messages-app\.js/);
assert.doesNotMatch(messenger, /chatscope/i);
assert.match(messengerClient, /function startThreadSwipe/);
assert.match(messengerClient, /function startThreadUpdates/);
assert.match(messengerClient, /function startMessageUpdates/);
assert.match(messengerClient, /operation_id:\s*crypto\.randomUUID\(\)/);
assert.doesNotMatch(messengerClient, /\bconfirm\s*\(/);
assert.match(messengerCss, /\.threadSwipe\.revealed \.threadRow/);
assert.match(branding, /manager_icon_e_art\.png/);
assert.match(branding, /manager-icon-e-zoo-heritage\.png/);

console.log('APPROVED_VISUAL_SYSTEM_CONTRACT_PASS');
