import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const home = read('mobile/src/custodial/index.html');
const homeApp = read('mobile/src/custodial/app.js');
const custodialBridge = read('mobile/src/custodial/bridge.js');
const sharedUi = read('memphis-ui.js');
const schedule = read('employee-schedule.html');
const events = read('employee-events.html');
const feedback = read('employee-feedback.html');
const feedbackOutbox = read('mobile/src/custodial/feedback-outbox.js');
const messages = read('messages.html');
const messenger = read('mobile/src/chatscope/app.jsx');
const messengerMobile = read('chatscope-mobile-overrides.css');
const nativeVault = read('mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialNativeVaultPlugin.java');
const nativeJournalStore = read('mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/AndroidOfflineAuthorityTimeStore.java');
const nativeRuntimeTests = read('mobile/plugins/custodial-native-vault/android/src/androidTest/java/org/memphiszoo/custodial/vault/VaultAndroidRuntimeTest.java');
const scan = read('index.html');
const scanSync = read('memphis-scan-sync.js');
const reminders = read('memphis-device-reminders.js');
const shell = read('mobile/src/shell/AppShell.tsx');
const routes = read('mobile/src/shell/roles/custodial/routes.ts');
const build = read('mobile/scripts/build.mjs');

const homeLabels = [...home.matchAll(/class="homeLabel">([^<]+)<\/span>/g)].map((match) => match[1].trim());
assert.deepEqual(homeLabels, ['Memphis Messenger', 'My Schedule', 'Upcoming Events', 'Program Feedback']);
assert.equal([...home.matchAll(/class="homeButton"/g)].length,4);
assert.match(home,/Today’s Weather/);assert.match(home,/Today’s Guest Entries/);assert.match(home,/id="home-clock"/);
// September 21: retain the original menu, plus approved shift/lunch and full hourly facts.
for(const id of ['home-shift','home-lunch','home-weather-hours','home-weather-alerts'])assert.ok(home.includes(`id="${id}"`),`Required Home fact ${id}`);
assert.match(home, /dashboard-bg_optimized\.webp/);
assert.match(home, /id="employee-name"/);
assert.match(home, /id="employee-role"/);
assert.doesNotMatch(home, /time-attendance|Time &amp; Attendance|timekeeping provider/i);
assert.match(homeApp, /function employeeRole\(value\)/);
assert.match(home, /id="phone-lock-name"/);
assert.match(home, /id="phone-unlock"/);
assert.match(homeApp, /els\.phoneLockName\.textContent = name/);
assert.match(homeApp, /PHONE_UNLOCKED_KEY/);
assert.match(homeApp, /App\.addListener\('pause', \(\) => \{ relockPhone\(\); \}\)/);
assert.doesNotMatch(home, /Karen Robinson|Daniel Morgan|NOCX/);
assert.match(home, /You are cleaning|id="active-cleaning-text"/);
assert.match(home, /memphis-ui\.js/);
assert.doesNotMatch(home, /Assigned Areas|bottomNav|navLabel|Scanner|Diagnostics|Refresh|employee-phone|areas-list/);
assert.doesNotMatch(homeApp, /loadAreas|all_items|display_sections|included_locations/);
assert.match(homeApp, /This phone needs a manager/);
assert.match(homeApp, /restore\(\{ quiet: !els\.home\.hidden \}\)/);
assert.doesNotMatch(home, /boot-retry|>Try Again</);
assert.doesNotMatch(homeApp, /Tap Try Again/);
assert.match(homeApp, /This phone will reconnect automatically/);
assert.match(homeApp, /restoreRetryTimer = window\.setTimeout\(\(\) => void restore\(\), 5000\)/);
assert.match(homeApp, /function resumeProtectedCleaning\(\)/);
assert.match(homeApp, /resolveOpenScanSession/);
assert.match(homeApp, /Cleaning did not start at \$\{location\}\. Tap the location tag again\./);
assert.match(homeApp, /You are cleaning \$\{location\}\. Tap the same location tag when you are done\./);
assert.match(homeApp, /reconcileStartupRecovery/);
assert.match(custodialBridge, /reconcileRecoveredPreStart/);
assert.doesNotMatch(homeApp, /localStorage\.length|Math\.min\(localStorage\.length,\s*250\)|window\.location\.replace\(scan/);
assert.match(custodialBridge, /custodial-home-cache\.v4/);
assert.match(custodialBridge, /principalIdentity\(record\.principal\) !== identity/);
assert.match(homeApp, /currentProfile\(cached\)/);
assert.match(custodialBridge, /24 \* 60 \* 60 \* 1000/);
assert.match(custodialBridge, /record\.profile\.authenticated !== true/);
assert.match(homeApp, /const cached = showCachedPhoneIdentity\(\);[\s\S]*profile = await request/,
  'a current protected cached identity must render before the network profile returns');
assert.match(homeApp, /Number\(error\?\.status \|\| 0\) === 401 \|\| Number\(error\?\.status \|\| 0\) === 403\) return showManagerNeeded\(\);[\s\S]*if \(cached && employeeName\(cached\) && currentProfile\(cached\)\)/,
  'an explicit authorization failure must still fail closed before the cached offline fallback');
assert.match(homeApp, /if \(resumeProtectedCleaning\(\)\) return;/);
// Manager-side assignment resumes the same protected startup, without an employee enrollment form.
const startupStart = homeApp.indexOf('async function restoreNow(');
const startupEnd = homeApp.indexOf('function restore(options', startupStart);
assert.ok(startupStart >= 0 && startupEnd > startupStart);
const assignedStartupBody = homeApp.slice(startupStart, startupEnd);
assert.match(assignedStartupBody, /await saveProfile\(\);[\s\S]*if \(resumeProtectedCleaning\(\)\) return;[\s\S]*showHome\(profile\)/);
assert.doesNotMatch(homeApp, /async function enroll\(event\)|els\.code|els\.form/);
assert.match(sharedUi, /SCAN_RESUME_SCHEMA_VERSION = 2/);
assert.match(sharedUi, /function resolveOpenScanSession/);
assert.match(sharedUi, /function isUnstartedScanSession/);
assert.match(sharedUi, /state: "ambiguous"/);
assert.match(sharedUi, /localStorage\.getItem\(`session:\$\{entry\.session_uuid\}`\)/);
assert.doesNotMatch(sharedUi, /function scanSessionRows/);

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
assert.match(schedule, /No connection — showing only known active windows from your last update/);
assert.match(schedule, /id="lunch-areas"/);
assert.match(schedule, /clock.seconds<end/);
assert.match(schedule, /memphis:schedule-refresh/);

assert.match(messages, /<title>Messages<\/title>/);
assert.match(messages, /chatscope-messenger\.css\?v=release-2026\.09\.16\.chatscope-v2/);
assert.match(messages, /chatscope-mobile-overrides\.css\?v=release-2026\.09\.16\.chatscope-v2/);
assert.match(messages, /chatscope-messenger\.js\?v=release-2026\.09\.16\.chatscope-v2/);
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
assert.match(messengerMobile, /\.mz-chat-shell\{width:100%;max-width:1100px;min-width:0;display:grid;grid-template-columns:minmax\(0,1fr\);grid-template-rows:auto minmax\(0,1fr\)/);
assert.match(messengerMobile, /\.mz-chat-toolbar\{height:auto!important;min-height:80px;min-width:0;max-width:100%/);
assert.match(messengerMobile, /\.mz-chat-stage\{height:auto!important;min-height:0;min-width:0;max-width:100%\}/);
assert.match(messengerMobile, /\.cs-conversation__last-activity-time\{flex:0 0 auto!important;white-space:nowrap!important\}/);
assert.match(messengerMobile, /\.mz-chat-shell:not\(\.mobile-thread\) \.cs-search\{display:flex!important;[^}]*max-width:calc\(100% - 16px\)!important;[^}]*margin:8px!important\}/);
assert.match(messengerMobile, /\.mz-chat-shell:not\(\.mobile-thread\) \.cs-conversation__content\{display:flex!important;flex:1 1 0!important;min-width:0!important;margin-right:8px!important\}/);
assert.match(messengerMobile, /\.mz-chat-shell:not\(\.mobile-thread\) \.cs-conversation__last-activity-time\{display:flex!important;flex:0 0 auto!important;white-space:nowrap!important\}/);
assert.doesNotMatch(messengerMobile, /grid-template-areas:'back brand new' 'memphis memphis memphis'/);
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
assert.match(nativeVault, /preserveUnreadableScanJournal\(error\.code\)/);
assert.match(nativeVault, /scan_journal_state", scanJournalReady \? "READY" : "CORRUPTED_PRESERVED"/);
assert.doesNotMatch(nativeVault, /catch \(VaultFailure error\) \{[\s\S]{0,220}saveScanEntries\(copyScanEntriesLocked\(\)\)[\s\S]{0,100}scanJournalReady = true/);
assert.match(nativeJournalStore, /SCAN_JOURNAL_QUARANTINE_PREFIX/);
assert.match(nativeJournalStore, /protectedRecord\.equals\(preferences\.getString\(SCAN_ENTRIES_KEY, null\)\)/);
assert.match(nativeJournalStore, /manager_recovery_required/);
assert.match(nativeJournalStore, /resolvePreservedScanJournal/);
assert.match(nativeJournalStore, /SCAN_JOURNAL_DISPOSITION_PREFIX/);
assert.match(custodialBridge, /custodial-prestart-recovery\.v1/);
assert.match(custodialBridge, /custodial-interrupted-start-recovery\.v2/);
assert.match(custodialBridge, /preserved_native_journal_manager_recovery/);
assert.match(scanSync, /completionDraftExists/);
assert.match(custodialBridge, /const queuedActionCount = queueActions\.length/);
assert.match(custodialBridge, /queued_action_count: queuedActionCount/);
assert.match(scanSync, /startupRecoveryPending: typeof window\.MemphisMobile\?\.reconcileRecoveredPreStart === 'function'/);
assert.match(scanSync, /releaseStartupRecoveryGate/);
assert.match(homeApp, /const preStart = await reconcileProtectedStartup\(\);[\s\S]{0,180}profile = await request/);
assert.match(nativeRuntimeTests, /malformedScanJournalIsPreservedAndNeverReplacedWithEmptyState/);
assert.match(nativeRuntimeTests, /laterExactManagerRecoveryPreservesCorruptJournalAndStartsNewJournalExactlyOnce/);
assert.match(nativeRuntimeTests, /corruptionAfterManagerRecoveryRequiresAnotherManagerRecovery/);

assert.match(events, /<h1>Events<\/h1>/);
assert.doesNotMatch(events, /Information only/);
assert.match(events, /Expected guests:/);
assert.match(events, /attendee_count===null\|\|row\.attendee_count===undefined\|\|row\.attendee_count===''/,
  'Events must distinguish a supplied zero attendee count from a missing count');
assert.match(events, /row\.notes/);
assert.match(events, /Scheduled/);
assert.match(events, /Cancelled/);
assert.match(events, /\/employee-events-api/);
assert.doesNotMatch(events, /\/dashboard-api\/events/);
assert.match(events, /employee-events-snapshot\.v1/);
assert.match(events, /mz_employee_events_snapshot:/);
assert.match(events, /mutateProtectedWork/);
assert.match(events, /No connection — showing your last update/);
assert.match(events, /timeZone:'UTC'/);
assert.match(events, /row\.display_location\|\|row\.venue_name/);
assert.doesNotMatch(custodialBridge, /publicUnauthenticatedRoute[\s\S]{0,500}dashboard-api\/events/,
  'Employee Events must not bypass enrolled-phone authentication');
assert.match(events, /if\(!endValue\)return `\$\{day\} · \$\{first\}`/);
assert.match(events, /end\.getTime\(\)===start\.getTime\(\)/);
assert.doesNotMatch(events, /\/schedule-api|reschedule|method:\s*['"](?:POST|PUT|PATCH|DELETE)/i,
  'Employee Events must remain a read-only surface even though its cache is assignment-bound');

assert.deepEqual(
  [...feedback.matchAll(/name="category" value="[^"]+" required><span>([^<]+)<\/span>/g)].map((match) => match[1]),
  ['Something is broken', 'I need help', 'The app confused me'],
);
assert.match(feedback, /Tell us more \(optional\)/);
assert.match(feedback, />Add Photo<\/button>/);
assert.match(feedbackOutbox, /mz_employee_feedback_outbox:/);
assert.match(feedbackOutbox, /Idempotency-Key/);
assert.match(feedback, /Saved\. It will send when connected/);

assert.match(scan, /<h1 class="title-green">Start Cleaning<\/h1>/);
assert.match(scan, /Check the location and your name/);
assert.match(scan, /Cleaning in Progress/);
assert.match(scan, /Tap this same location tag again when you are done/);
assert.match(scan, /indexScanSession/);
assert.doesNotMatch(scan, /function findAnyOpenLocalSessionForDevice\(deviceId\)\{cleanupStaleLocalSessions\(\);const sessions=\[\]/);
assert.match(scan, /<h1 class="title-amber">Finish Cleaning<\/h1>/);
assert.match(scan, /Full cleaning finished/);
assert.match(scan, /Something needs attention/);
assert.match(scan, /Saved work must finish sending before new cleaning can start/);
assert.match(scan, /getSystemSettingsSafe\(\)\{try\{return await rpcOne\("tool_get_system_settings"\)\}catch\{return null\}\}/);
assert.match(scan, /getActiveEmployeesSafe\(\)\{try\{return await rpcArray\("tool_list_active_employees"\)\}catch\{throw Object\.assign\(new Error\("Active employee list unavailable\."\),\{code:"employee_list_unavailable"\}\)\}\}/);
assert.match(scan, /No cleaning was started\. Try again when the connection returns\./);
assert.match(scan, /No cleaning was started\. The phone will try again\./);
assert.doesNotMatch(scan, /id="retry-backend"/);
assert.doesNotMatch(scan, /retryStuckQueue|Tap to try again|role","button"/);
assert.match(scan, /Saved work needs review/);
assert.match(scan, /savedScanDisplay/);
assert.match(scan, /scanLocationDisplayFallback/);
assert.match(scan, /NOCX:"Nocturnal"/);
assert.match(scan, /readCustodialHomeCache/);
assert.doesNotMatch(scan, /catch\{return\[\{display_name:"Alijah Collins"\}/);
assert.match(scan, /completionDraftBinding/);
assert.match(scan, /MemphisScanSync\.saveCompletionDraft/);
assert.match(scan, /await restoreCompletionDraft/);
assert.match(scanSync, /COMPLETION_DRAFT_DB_NAME: 'mz_scan_completion_drafts'/);
assert.match(scanSync, /custodial-native-start-transport\.v1/);
assert.match(scanSync, /custodial-native-completion-transport\.v1/);
assert.match(scanSync, /originalNativeStartAttestation/);
assert.match(scanSync, /originalNativeCompletionAttestation/);
assert.match(scan, /This phone needs a manager\. Your saved work has not been erased/);
assert.match(scan, /storage_unavailable\|manager_recovery/);
assert.match(scan, /manager recovery\|saved answers/);
assert.ok(scan.indexOf('/binding_missing|device_binding_mismatch') < scan.indexOf('/queue|saved(?: cleaning)? work'));
assert.match(scan, /function managerRecoveryError\(message\)\{return Object\.assign\(new Error\(message\),\{code:"custodial_manager_recovery_required"\}\)\}/);
assert.match(scan, /throw managerRecoveryError\("Saved cleaning work needs manager recovery\."\)/);
assert.match(scan, /throw managerRecoveryError\("Saved answers need manager recovery\."\)/);
assert.match(scan, /\.debugPanel\{display:none !important\}/);
assert.match(scan, /\.eyebrow\{display:none\}/);
assert.doesNotMatch(scan, />Pre-Scan|>Scanner|>Server|>Device ID|>Session ID/);

assert.match(reminders, /for \(let cycle = 0; cycle < 2; cycle \+= 1\)/);
assert.match(reminders, /playOneRingtone\(\)[\s\S]*speakOnce\(normalized\)/);
assert.match(reminders, /currentAlertIds/);
assert.match(reminders, /closeActiveAlert\(\{ stopSpeech: true \}\)/);
assert.match(read('mobile/src/custodial/bridge.js'), /get nativeNotifications\(\) \{ return notificationPresentation\.native; \}/);
assert.doesNotMatch(read('mobile/src/custodial/bridge.js'), /nativeNotifications:\s*(?:true|false)/,
  'notification ownership must use the source-owned live mode, not a fixed flag');

assert.doesNotMatch(shell, /compileProofRequested[\s\S]*shouldStayInShell/);
for (const route of ['employee-schedule.html', 'messages.html', 'employee-events.html', 'employee-feedback.html']) {
  assert.match(routes, new RegExp(route.replace('.', '\\.')));
}
assert.doesNotMatch(routes, /navigation:\s*true/);

console.log('CUSTODIAL_EMPLOYEE_EXPERIENCE_CONTRACT_PASS');
