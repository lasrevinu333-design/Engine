import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const home = read('mobile/src/custodial/index.html');
const homeApp = read('mobile/src/custodial/app.js');
const schedule = read('employee-schedule.html');
const events = read('employee-events.html');
const feedback = read('employee-feedback.html');
const messages = read('messages.html');
const messenger = read('mobile/src/chatscope/app.jsx');
const messengerMobile = read('chatscope-mobile-overrides.css');
const nativeVault = read('mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialNativeVaultPlugin.java');
const scan = read('index.html');
const reminders = read('memphis-device-reminders.js');
const shell = read('mobile/src/shell/AppShell.tsx');
const routes = read('mobile/src/shell/roles/custodial/routes.ts');
const build = read('mobile/scripts/build.mjs');

const homeLabels = [...home.matchAll(/class="homeButton"[^>]*>([^<]+)<\/a>/g)].map((match) => match[1].trim());
assert.deepEqual(homeLabels, ['Schedule', 'Messages', 'Events', 'Feedback']);
assert.match(home, /dashboard-bg_optimized\.webp/);
assert.match(home, /id="employee-name"/);
assert.doesNotMatch(home, /Assigned Areas|bottomNav|navLabel|Scanner|Diagnostics|Refresh|employee-phone|areas-list/);
assert.doesNotMatch(homeApp, /loadAreas|all_items|display_sections|included_locations/);
assert.match(homeApp, /This phone needs a manager/);
assert.match(homeApp, /restore\(\{ quiet: !els\.home\.hidden \}\)/);

for (const [name, source] of [['Schedule', schedule], ['Events', events], ['Feedback', feedback]]) {
  assert.match(source, /memphis-auth\.js/, `${name} must load the build-time native bridge placeholder`);
  assert.match(source, /memphis-scan-sync\.js/, `${name} must keep saved cleaning work moving without adding employee UI`);
}
assert.match(home, /memphis-scan-sync\.js/);
assert.match(build, /employee-events\.html/);
assert.match(build, /employee-feedback\.html/);
assert.match(build, /employee-hub\.html/);
assert.match(build, /cp\(join\(dist, 'employee-events\.html'\), join\(dist, 'events\.html'\)\)/);
assert.match(build, /cp\(join\(dist, 'employee-feedback\.html'\), join\(dist, 'system-feedback\.html'\)\)/);

assert.match(schedule, />Your areas now</);
assert.match(schedule, /Array\.isArray\(data\?\.current_items\)/);
assert.doesNotMatch(schedule, /display_sections|all_items/);
assert.doesNotMatch(schedule, />Refresh<|Assigned Areas|practical cleaning order/);
assert.match(schedule, /No connection — showing your last update/);
assert.match(schedule, /memphis:schedule-refresh/);

assert.match(messages, /<title>Messages<\/title>/);
assert.match(messenger, /<h2>\{EMPLOYEE_CONTEXT \? 'New Message' : 'Start Conversation'\}<\/h2>/);
assert.match(messenger, /Tap the person you want to message/);
assert.match(messenger, /\/thread\/direct/);
assert.match(messenger, /!EMPLOYEE_CONTEXT && selected\.size > 1/);
assert.match(messenger, /!EMPLOYEE_CONTEXT && <button className="mz-button primary"/);
assert.match(messenger, /disabled=\{busy \|\| !selected\.size\}>Create<\/button>/);
assert.doesNotMatch(messenger, /Create Group|selectedUserIds|openMemphis/);
assert.match(messenger, /function SwipeConversation/);
assert.match(messenger, />Delete<\/button>/);
assert.match(messenger, /!mobileThread && <button className="mz-button primary"/);
assert.match(messenger, /!EMPLOYEE_CONTEXT && <ConversationHeader\.Back/);
assert.match(messenger, /!EMPLOYEE_CONTEXT && <button className="mz-button mz-chat-mobile-back"/);
assert.match(messenger, /info=\{EMPLOYEE_CONTEXT \? ''/);
assert.match(messengerMobile, /\.mz-chat-swipe-content\{position:relative;background:#0c1622;/);
assert.match(messengerMobile, /\.cs-conversation-header__content \.cs-conversation-header__user-name,\.cs-conversation-header__content \.cs-conversation-header__info\{background-color:transparent!important\}/);
assert.match(messengerMobile, /\.mz-chat-new-list>\.mz-chat-empty\{height:auto;min-height:112px;/);
assert.match(messengerMobile, /\.mz-chat-toolbar\.thread-toolbar\{grid-template-columns:var\(--mz-chat-back-width\) minmax\(0,1fr\);grid-template-areas:'back brand'!important\}/);
assert.match(messenger, /mz_chatscope_delete_outbox:/);
assert.match(messenger, /setMessages\(\[\]\);\s*setLoadingMessages\(true\)/);
assert.match(messenger, /<strong>\{EMPLOYEE_CONTEXT \? 'Messages' : 'Memphis Messenger'\}<\/strong>/);
assert.match(messenger, /setTimeout\(\(\) => controller\.abort\(\), 15000\)/);
assert.match(messenger, /People could not load\./);
assert.match(messenger, />Try Again<\/button>/);
assert.doesNotMatch(messenger, /Secure Zoo messaging|Protected phone identity is not ready/);
assert.match(nativeVault, /new ThreadPoolExecutor\(/);
assert.match(nativeVault, /AUTHORIZED_REQUEST_THREADS = 6/);
assert.match(nativeVault, /AUTHORIZED_REQUEST_QUEUE = 24/);
assert.match(nativeVault, /public void authorizedRequest\(PluginCall call\) \{\s*executeAuthorizedRequest/);

assert.match(events, /<h1>Events<\/h1>/);
assert.match(events, /Information only/);
assert.match(events, /Cancelled/);
assert.doesNotMatch(events, /schedule-api|mutation|reschedule|assign/i);

assert.deepEqual(
  [...feedback.matchAll(/name="category" value="[^"]+" required><span>([^<]+)<\/span>/g)].map((match) => match[1]),
  ['Something is broken', 'I need help', 'The app confused me'],
);
assert.match(feedback, /Tell us more \(optional\)/);
assert.match(feedback, />Add Photo<\/button>/);
assert.match(feedback, /mz_employee_feedback_outbox:/);
assert.match(feedback, /Idempotency-Key/);
assert.match(feedback, /Saved\. It will send when connected/);

assert.match(scan, /<h1 class="title-green">Start Cleaning<\/h1>/);
assert.match(scan, /Check the location and your name/);
assert.match(scan, /Cleaning in Progress/);
assert.match(scan, /Tap this same location tag again when you are done/);
assert.match(scan, /<h1 class="title-amber">Finish Cleaning<\/h1>/);
assert.match(scan, /Full cleaning finished/);
assert.match(scan, /Something needs attention/);
assert.match(scan, /Saved work must finish sending before new cleaning can start/);
assert.match(scan, /This phone needs a manager\. Your saved work has not been erased/);
assert.match(scan, /\.debugPanel\{display:none !important\}/);
assert.match(scan, /\.eyebrow\{display:none\}/);
assert.doesNotMatch(scan, />Pre-Scan|>Scanner|>Server|>Device ID|>Session ID/);

assert.match(reminders, /for \(let cycle = 0; cycle < 2; cycle \+= 1\)/);
assert.match(reminders, /playOneRingtone\(\)[\s\S]*speakOnce\(normalized\)/);
assert.match(reminders, /currentAlertIds/);
assert.match(reminders, /closeActiveAlert\(\{ stopSpeech: true \}\)/);
assert.match(read('mobile/src/custodial/bridge.js'), /nativeNotifications: false/);

assert.doesNotMatch(shell, /compileProofRequested[\s\S]*shouldStayInShell/);
for (const route of ['employee-schedule.html', 'messages.html', 'employee-events.html', 'employee-feedback.html']) {
  assert.match(routes, new RegExp(route.replace('.', '\\.')));
}
assert.doesNotMatch(routes, /navigation:\s*true/);

console.log('CUSTODIAL_EMPLOYEE_EXPERIENCE_CONTRACT_PASS');
