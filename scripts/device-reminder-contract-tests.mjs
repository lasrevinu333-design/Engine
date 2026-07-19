import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const jsPath = path.resolve(scriptDir, '../memphis-device-reminders.js');
const source = fs.readFileSync(jsPath, 'utf8');

assert(source.includes("/device-event-reminders?device_id="), 'Reminder poller must still fetch event reminders');
assert(source.includes("/threads${qs}"), 'Reminder poller must also fetch thread summaries for message notifications');
assert(source.includes("state.currentUserId = safeText(data?.msg_user_id)"), 'Reminder poller must resolve the mapped device user before checking message threads');
assert(source.includes("Number(row?.unread_count || 0) > 0"), 'Reminder poller must alert only on unread message threads');
assert(source.includes("New direct message") || source.includes("Memphis message"), 'Reminder popups must differentiate message alerts from event reminders');
assert(source.includes('window.fully?.textToSpeech'), 'Reminder popups must trigger Fully Kiosk spoken alerts when available');
assert(source.includes('speechSynthesis') && source.includes('SpeechSynthesisUtterance'), 'Reminder popups must also try browser speech synthesis to reinforce quiet TTS on phones');
assert(source.includes('VOICE_REPEAT_COUNT: 1'), 'Reminder popups must speak each alert only once');
assert(source.includes('Hey ${first}') || source.includes('Hey ${first}, '), 'Reminder popups must personalize spoken alerts with the employee first name when known');
assert(source.includes('window.fully?.playSound') || source.includes('window.fully?.playAudio'), 'Reminder popups must try Fully Kiosk native sound playback when available');
assert(source.includes("RINGTONE_HOSTED_FILE: 'memphis-alert-tone.wav?v=release-2026.07.18.custodial-v3.11'"), 'Reminder popups must ship the selected hosted fleet ringtone asset');
assert(source.includes('function createRingtoneWaveform'), 'Reminder popups must generate the same fleet ringtone waveform for inline fallback playback');
assert(source.includes('RINGTONE_REPEAT_COUNT: 1'), 'Reminder popups must ring only once per alert instance');
assert(source.includes('ALERT_POST_RINGTONE_DELAY_MS: 900'), 'Reminder popups must leave a short clean gap after the alert sound before voice starts');
assert(source.includes('RINGTONE_ESTIMATED_DURATION_MS') && source.includes('CONFIG.RINGTONE_ESTIMATED_DURATION_MS + CONFIG.ALERT_POST_RINGTONE_DELAY_MS'), 'Reminder sequencer must wait through the alert sound duration plus the 2s post-ring gap before voice starts');
assert(source.includes('ALERT_OPEN_GRACE_MS: 1800'), 'Opening an alert must allow a short speech grace period before navigation');
assert(source.includes('debugShowSampleAlert') && source.includes('testReminder'), 'Reminder popups must expose a safe debug trigger for on-device validation');
assert(source.includes('new Audio(hostedUrl)'), 'Reminder popups must preload the hosted ringtone asset for kiosk/browser playback');
assert(source.includes('const fullySources = [hostedUrl, dataUrl];'), 'Reminder popups must force the same hosted/data ringtone sources on every phone');
assert(source.includes("const prefersStreamingApi = /^(?:https?:|data:)/i.test(String(source || ''));"), 'Fully playback must recognize hosted/data ringtone URLs separately from file paths');
assert(source.includes('playViaFullyJs(fullySources)') && source.includes('|| playViaHtmlAudio(hostedUrl)') && source.includes('|| playViaHtmlAudio(dataUrl)') && source.includes('|| playViaWebAudio();'), 'Ringtone playback must fall back through Fully, hosted HTML audio, inline HTML audio, and WebAudio in that order');
assert(source.includes('navigator.vibrate?.'), 'Reminder popups must vibrate when supported');
assert(source.includes('body.mz-reminder-active #kiosk-lock-screen'), 'Reminder popup styling must hide the kiosk lock screen while the alert is open');
assert(source.includes('setReminderPresentationActive(true);'), 'Reminder popup must activate lock-screen suppression while visible');
assert(source.includes('setReminderPresentationActive(false);'), 'Reminder popup must restore the normal lock-screen state when closed');
assert(source.includes("linkedIds: [`thread:${safeText(row?.thread_id)}:${messageId}`]"), 'Event reminder popups must suppress duplicate thread popups for the same message');
assert(source.includes("openUrl: threadId ? buildThreadUrl({ thread_id: threadId, last_message_id: messageId }) : buildMessagesUrl(row)"), 'Opening an event reminder must go straight to the thread so backend read receipts clear repeat alerts');
assert(source.includes('await waitForActiveAlertSpeech();') && source.includes('closeActiveAlert({ stopSpeech: false });') && source.includes('window.location.href = destination;'), 'Opening an alert must wait for the current speech sequence before navigating without cutting it off');
assert(source.includes('const sequence = startAlertAudioSequence(text)') && source.includes('state.activeSequencePromise = sequence;'), 'Alert playback must run through one tracked ringtone-then-voice sequence');
assert(source.includes('stripLeadingNameForSpeech(body, speakerName)'), 'Event reminder spoken body must remove a duplicated leading employee name from backend reminder text');
assert(source.includes('speechText: `${lead}${spokenBody}`'), 'Synthetic/event reminder voice must speak the de-duplicated reminder body for sample notifications');
assert(source.includes('function normalizePersonalizedSpeechText'), 'All spoken alert paths must use a central duplicate-name speech normalizer');
assert(source.includes('normalizePersonalizedSpeechText(rawText, alert?.speakerName || state.currentDisplayName)'), 'Fully Kiosk voice playback must de-duplicate final speech text before speaking');
assert(source.includes('speakerName,'), 'Alert objects must carry the intended employee name for central speech de-duplication');
assert(source.includes('stopActiveRingtone();') && source.includes('state.activeSpeechPromise = speakOnce(normalized)'), 'Alert playback must stop the ring before starting one tracked speech operation');
assert(source.includes('const played = playViaFullyJs(fullySources)') && source.includes('|| playViaHtmlAudio(hostedUrl)') && source.includes('|| playViaHtmlAudio(dataUrl)') && source.includes('|| playViaWebAudio();'), 'Ringtone playback must use one fallback chain instead of layered simultaneous playback');
assert(!source.includes('const fullySpoken = fullySpeak(normalized);\n      const browserSpoken = speakViaBrowser(normalized);'), 'Speech playback must not launch Fully TTS and browser TTS simultaneously');
assert(!source.includes('const played = [\n      playViaFullyJs(fullySources),\n      playViaHtmlAudio(dataUrl),\n      playViaWebAudio()\n    ].some(Boolean);'), 'Ringtone playback must not launch all audio engines at once');

assert(source.includes('function objectMetadata'), 'Reminder renderer must parse backend metadata from event rows and thread summaries');
assert(source.includes('last_message_metadata_json'), 'Thread fallback alerts must see last-message metadata so presentation demos do not degrade to generic Ops Manager messages');

const harnessSource = source.replace(
  /\n\}\)\(\);\s*$/,
  '\n  window.__speechTest = { normalizePersonalizedSpeechText, stripLeadingNameForSpeech, reminderAlert, locationStatusAlert, threadAlert };\n})();\n'
);

const noop = () => {};
const context = {
  console,
  URL,
  window: {
    location: { href: 'https://example.test/employee-hub.html?device=KIOSK_10' },
    addEventListener: noop,
    setTimeout: noop,
    setInterval: noop,
    clearTimeout: noop
  },
  document: {
    readyState: 'loading',
    addEventListener: noop
  },
  localStorage: { getItem: () => '', setItem: noop, removeItem: noop },
  sessionStorage: { getItem: () => '', setItem: noop, removeItem: noop },
  navigator: { vibrate: noop },
  Audio: class Audio {},
  SpeechSynthesisUtterance: class SpeechSynthesisUtterance {}
};
context.window.window = context.window;
vm.runInNewContext(harnessSource, context, { filename: jsPath });

const { normalizePersonalizedSpeechText, reminderAlert, threadAlert } = context.window.__speechTest;
const demoLocationAlert = reminderAlert({
  message_id: 'demo-message-1',
  thread_id: 'thread-1',
  display_name: 'Daniel Morgan',
  body: 'Daniel, demo assigned location alert: Splash Pad Restrooms are due soon on your route.',
  metadata_json: {
    presentation_demo: true,
    demo_alert_kind: 'location_status',
    service_date: '2026-06-11',
    status_code: 'due_soon',
    form_type: 'restroom',
    group_code: 'SPLASH_PAD_RESTROOMS',
    group_name: 'Splash Pad Restrooms',
    location_code: 'SPLASH_PAD_RESTROOMS',
    location_name: 'Splash Pad Restrooms',
    employee_name: 'Daniel Morgan'
  }
});
assert.equal(demoLocationAlert.kicker, 'Assigned location due soon');
assert.equal(demoLocationAlert.title, 'Splash Pad Restrooms is due soon');
assert.match(demoLocationAlert.id, /demo-message-1/, 'Presentation location alerts must be unique per sent demo message so morning test and real run can both play');
assert.deepEqual([...demoLocationAlert.linkedIds], ['thread:thread-1:demo-message-1'], 'Presentation location demos must suppress the duplicate unread thread alert for the same message');
assert.equal(demoLocationAlert.speechText, 'Hey Daniel, Splash Pad Restrooms is due soon on your route. Please check it soon.');

const demoThreadFallbackAlert = threadAlert({
  thread_id: 'thread-2',
  thread_type: 'direct',
  thread_title: 'Ops Manager',
  unread_count: 1,
  last_message_id: 'demo-message-2',
  last_sender_name: 'Ops Manager',
  last_message_body: "Jennifer, demo assigned location alert: East Admin Women's Restroom is overdue on your route.",
  last_message_type: 'bot_response',
  last_message_metadata_json: {
    presentation_demo: true,
    demo_alert_kind: 'location_status',
    service_date: '2026-06-11',
    status_code: 'overdue',
    form_type: 'restroom',
    group_code: 'EAST_ADMIN',
    group_name: 'East Admin',
    location_code: 'EADW',
    location_name: "East Admin Women's Restroom",
    employee_name: 'Jennifer Sheffield'
  }
});
assert.equal(demoThreadFallbackAlert.kicker, 'Assigned location overdue');
assert.equal(demoThreadFallbackAlert.title, "East Admin Women's Restroom is overdue");
assert.equal(demoThreadFallbackAlert.speechText, "Hey Jennifer, East Admin Women's Restroom is overdue on your route. Please handle it now.");
assert.notEqual(demoThreadFallbackAlert.speechText, 'Hey Jennifer, Ops Manager sent you a new message.', 'Presentation demos must never fall back to generic Ops Manager TTS');

assert.equal(
  normalizePersonalizedSpeechText('Hey Sherita, Sherita Herpetarium is due soon on your route.', 'Sherita Wilbon'),
  'Hey Sherita, Herpetarium is due soon on your route.'
);
assert.equal(
  normalizePersonalizedSpeechText('Hey Sherita, Sherita Wilbon, Herpetarium is overdue on your route.', 'Sherita Wilbon'),
  'Hey Sherita, Herpetarium is overdue on your route.'
);
assert.equal(
  normalizePersonalizedSpeechText('Sherita Herpetarium is due soon on your route.', 'Sherita Wilbon'),
  'Hey Sherita, Herpetarium is due soon on your route.'
);
assert.equal(
  normalizePersonalizedSpeechText('Hey Kinnaye, Kinnaye Elephant Trunk Gift Shop is due soon.', 'Kinnaye Peete'),
  'Hey Kinnaye, Elephant Trunk Gift Shop is due soon.'
);

console.log(JSON.stringify({
  ok: true,
  checked: [
    'event_reminders_still_polled',
    'thread_unread_notifications_polled',
    'device_identity_lookup',
    'audible_alerts',
    'fully_kiosk_speech',
    'event_body_spoken_for_samples',
    'presentation_demo_location_alerts',
    'presentation_demo_thread_metadata_fallback',
    'central_duplicate_name_speech_guard',
    'duplicate_thread_alert_suppression',
    'sequential_ringtone_voice_playback',
    'single_alert_instance_with_speech_completion_grace'
  ]
}, null, 2));
