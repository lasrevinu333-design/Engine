#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'memphis-device-reminders.js'
text = path.read_text(encoding='utf-8')

replacements = [
    ("RINGTONE_REPEAT_COUNT: 1,", "RINGTONE_REPEAT_COUNT: 2,"),
    ("VOICE_REPEAT_COUNT: 1,", "VOICE_REPEAT_COUNT: 2,"),
    ("function personalizedLead(name) {\n    const first = firstName(name);\n    return first ? `Hey ${first}, ` : '';\n  }",
     "function personalizedLead(name) {\n    const first = firstName(name);\n    return first ? `${first}, ` : '';\n  }"),
    ("speechText: isMemphis ? `${lead}Memphis sent you a new message.` : `${lead}${senderName} sent you a new message.`",
     "speechText: isMemphis ? `${lead}you received a message from Memphis.` : `${lead}you received a message from ${senderName}.`"),
    ("? `${lead}${locationName} is overdue on your route. Please handle it now.`\n        : `${lead}${locationName} is due soon on your route. Please check it soon.`",
     "? `${lead}${locationName} is overdue.`\n        : `${lead}${locationName} is due soon.`"),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'missing expected reminder source fragment: {old[:80]}')
    text = text.replace(old, new, 1)

old_sequence = '''  async function startAlertAudioSequence(text) {
    const normalized = safeText(text);
    if (!normalized) return;
    clearPendingRingtoneRepeats();
    stopActiveRingtone();
    stopActiveSpeech();
    const token = Date.now();
    state.alertSequenceToken = token;
    playOneRingtone();
    await new Promise((resolve) => queueAlertStep(resolve, CONFIG.RINGTONE_ESTIMATED_DURATION_MS + CONFIG.ALERT_POST_RINGTONE_DELAY_MS));
    if (state.alertSequenceToken !== token) return;
    stopActiveRingtone();
    state.activeSpeechPromise = speakOnce(normalized);
    await state.activeSpeechPromise;
    state.activeSpeechPromise = null;
    // Do not stop TTS on a timer. The platform finishes naturally; speech is only
    // cancelled when the user dismisses/opens the alert or another alert replaces it.
  }'''
new_sequence = '''  async function startAlertAudioSequence(text) {
    const normalized = safeText(text);
    if (!normalized) return;
    clearPendingRingtoneRepeats();
    stopActiveRingtone();
    stopActiveSpeech();
    const token = Date.now();
    state.alertSequenceToken = token;
    const cycles = Math.max(1, Number(CONFIG.VOICE_REPEAT_COUNT) || 2);
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      if (state.alertSequenceToken !== token) return;
      playOneRingtone();
      await new Promise((resolve) => queueAlertStep(
        resolve,
        CONFIG.RINGTONE_ESTIMATED_DURATION_MS + CONFIG.ALERT_POST_RINGTONE_DELAY_MS,
      ));
      if (state.alertSequenceToken !== token) return;
      stopActiveRingtone();
      state.activeSpeechPromise = speakOnce(normalized);
      await state.activeSpeechPromise;
      state.activeSpeechPromise = null;
      if (cycle + 1 < cycles) {
        await new Promise((resolve) => queueAlertStep(resolve, CONFIG.VOICE_REPEAT_GAP_MS));
      }
    }
    // Exactly two chime/voice cycles are allowed. The persistent card remains
    // visible and silent until Open or Dismiss is selected.
  }'''
if old_sequence not in text:
    raise SystemExit('missing original startAlertAudioSequence')
text = text.replace(old_sequence, new_sequence, 1)

path.write_text(text, encoding='utf-8')
