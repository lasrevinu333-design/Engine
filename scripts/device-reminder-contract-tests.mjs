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
assert(source.includes('VOICE_REPEAT_COUNT: 2'), 'Reminder popups must run two spoken alert rounds for the current phone-notification pattern');
assert(source.includes('Hey ${first}') || source.includes('Hey ${first}, '), 'Reminder popups must personalize spoken alerts with the employee first name when known');
assert(source.includes('window.fully?.playSound') || source.includes('window.fully?.playAudio'), 'Reminder popups must try Fully Kiosk native sound playback when available');
assert(source.includes('Moto.ogg'), 'Reminder popups must prefer the device Moto.ogg sound when available');
assert(source.includes('RINGTONE_REPEAT_COUNT: 2'), 'Reminder popups must run two Moto.ogg alert rounds');
assert(source.includes('ALERT_POST_RINGTONE_DELAY_MS: 2000'), 'Reminder popups must wait 2s after Moto.ogg before starting the voice message');
assert(source.includes('ALERT_POST_SPEECH_DELAY_MS: 2000'), 'Reminder popups must wait 2s after the voice message before the next Moto.ogg round');
assert(source.includes('debugShowSampleAlert') && source.includes('testReminder'), 'Reminder popups must expose a safe debug trigger for on-device validation');
assert(source.includes('new Audio(ensureRingtoneDataUrl())'), 'Reminder popups must preload a real ringtone asset for kiosk playback');
assert(source.includes('playRingtone({ repeatCount: CONFIG.RINGTONE_REPEAT_COUNT })') || source.includes('playRingtone({ repeatCount })'), 'Reminder popups must play an audible ringtone');
assert(source.includes('navigator.vibrate?.'), 'Reminder popups must vibrate when supported');
assert(source.includes('body.mz-reminder-active #kiosk-lock-screen'), 'Reminder popup styling must hide the kiosk lock screen while the alert is open');
assert(source.includes('setReminderPresentationActive(true);'), 'Reminder popup must activate lock-screen suppression while visible');
assert(source.includes('setReminderPresentationActive(false);'), 'Reminder popup must restore the normal lock-screen state when closed');
assert(source.includes("linkedIds: [`thread:${safeText(row?.thread_id)}:${messageId}`]"), 'Event reminder popups must suppress duplicate thread popups for the same message');
assert(source.includes("openUrl: threadId ? buildThreadUrl({ thread_id: threadId, last_message_id: messageId }) : buildMessagesUrl(row)"), 'Opening an event reminder must go straight to the thread so backend read receipts clear repeat alerts');
assert(source.includes('closeActiveAlert();\n      window.location.href = alert.openUrl || buildMessagesUrl();'), 'Opening an alert must stop repeated ringtone/TTS before navigation');
assert(source.includes('startAlertAudioSequence(text, {'), 'Alert playback must run through the shared ringtone-then-voice sequencer');
assert(source.includes('stripLeadingNameForSpeech(body, speakerName)'), 'Event reminder spoken body must remove a duplicated leading employee name from backend reminder text');
assert(source.includes('speechText: `${lead}${spokenBody}`'), 'Synthetic/event reminder voice must speak the de-duplicated reminder body for sample notifications');
assert(source.includes('function normalizePersonalizedSpeechText'), 'All spoken alert paths must use a central duplicate-name speech normalizer');
assert(source.includes('normalizePersonalizedSpeechText(rawText, alert?.speakerName || state.currentDisplayName)'), 'Fully Kiosk voice playback must de-duplicate final speech text before speaking');
assert(source.includes('speakerName,'), 'Alert objects must carry the intended employee name for central speech de-duplication');
assert(source.includes('stopActiveRingtone();') && source.includes('stopActiveSpeech();'), 'Alert playback must explicitly stop ringtone and speech before switching phases');
assert(source.includes('const played = playViaFullyJs(fullySources)') && source.includes('|| playViaHtmlAudio(dataUrl)') && source.includes('|| playViaWebAudio();'), 'Ringtone playback must use fallback order instead of layered simultaneous playback');
assert(!source.includes('const fullySpoken = fullySpeak(normalized);\n      const browserSpoken = speakViaBrowser(normalized);'), 'Speech playback must not launch Fully TTS and browser TTS simultaneously');
assert(!source.includes('const played = [\n      playViaFullyJs(fullySources),\n      playViaHtmlAudio(dataUrl),\n      playViaWebAudio()\n    ].some(Boolean);'), 'Ringtone playback must not launch all audio engines at once');

const harnessSource = source.replace(
  /\n\}\)\(\);\s*$/,
  '\n  window.__speechTest = { normalizePersonalizedSpeechText, stripLeadingNameForSpeech };\n})();\n'
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

const { normalizePersonalizedSpeechText } = context.window.__speechTest;
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
    'central_duplicate_name_speech_guard',
    'duplicate_thread_alert_suppression',
    'sequential_ringtone_voice_playback',
    'two_round_moto_voice_delay_contract'
  ]
}, null, 2));
