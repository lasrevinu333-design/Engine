import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
assert(source.includes('startAlertAudioSequence(text, {'), 'Alert playback must run through the shared ringtone-then-voice sequencer');
assert(source.includes('stripLeadingNameForSpeech(body, speakerName)'), 'Event reminder spoken body must remove a duplicated leading employee name from backend reminder text');
assert(source.includes('speechText: `${lead}${spokenBody}`'), 'Synthetic/event reminder voice must speak the de-duplicated reminder body for sample notifications');
assert(source.includes('stopActiveRingtone();') && source.includes('stopActiveSpeech();'), 'Alert playback must explicitly stop ringtone and speech before switching phases');
assert(source.includes('const played = playViaFullyJs(fullySources)') && source.includes('|| playViaHtmlAudio(dataUrl)') && source.includes('|| playViaWebAudio();'), 'Ringtone playback must use fallback order instead of layered simultaneous playback');
assert(!source.includes('const fullySpoken = fullySpeak(normalized);\n      const browserSpoken = speakViaBrowser(normalized);'), 'Speech playback must not launch Fully TTS and browser TTS simultaneously');
assert(!source.includes('const played = [\n      playViaFullyJs(fullySources),\n      playViaHtmlAudio(dataUrl),\n      playViaWebAudio()\n    ].some(Boolean);'), 'Ringtone playback must not launch all audio engines at once');

console.log(JSON.stringify({
  ok: true,
  checked: [
    'event_reminders_still_polled',
    'thread_unread_notifications_polled',
    'device_identity_lookup',
    'audible_alerts',
    'fully_kiosk_speech',
    'event_body_spoken_for_samples',
    'duplicate_thread_alert_suppression',
    'sequential_ringtone_voice_playback',
    'two_round_moto_voice_delay_contract'
  ]
}, null, 2));
