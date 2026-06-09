(() => {
  'use strict';

  const CONFIG = {
    API_BASE: 'https://memphis-zoo-mcp.onrender.com/messaging-api',
    DEVICE_STORAGE_KEY: 'mz_scan_device_id',
    DEV_FALLBACK_DEVICE_ID: '1e74fe4c-dc20b3b9',
    POLL_MS: 30000,
    STARTUP_DELAY_MS: 3500,
    SEEN_PREFIX: 'mz_program_alert_seen:',
    ALERT_LOCK_KEY: 'mz_program_alert_lock',
    RINGTONE_REPEAT_COUNT: 2,
    RINGTONE_REPEAT_GAP_MS: 1450,
    ALERT_POST_RINGTONE_DELAY_MS: 2000,
    VOICE_REPEAT_COUNT: 2,
    VOICE_REPEAT_GAP_MS: 1200,
    ALERT_POST_SPEECH_DELAY_MS: 2000,
    RINGTONE_FILE_CANDIDATES: [
      'file:///product/media/audio/notifications/Moto.ogg',
      'file:///system/product/media/audio/notifications/Moto.ogg',
      'file:///product/media/audio/ringtones/Moto.ogg',
      'file:///system/product/media/audio/ringtones/Moto.ogg'
    ]
  };

  const state = {
    deviceId: '',
    currentUserId: '',
    currentDisplayName: '',
    currentRole: '',
    poller: null,
    activeAlert: null,
    audioCtx: null,
    audioEl: null,
    activeOscillators: [],
    ringtoneDataUrl: '',
    alertSequenceToken: 0,
    ringTimeouts: []
  };

  function resolveDeviceId() {
    const url = new URL(window.location.href);
    const explicit = String(url.searchParams.get('device') || url.searchParams.get('deviceId') || '').trim();
    if (explicit) {
      localStorage.setItem(CONFIG.DEVICE_STORAGE_KEY, explicit);
      return explicit;
    }
    const stored = String(localStorage.getItem(CONFIG.DEVICE_STORAGE_KEY) || '').trim();
    if (stored) return stored;
    if (location.hostname.includes('github.io')) {
      localStorage.setItem(CONFIG.DEVICE_STORAGE_KEY, CONFIG.DEV_FALLBACK_DEVICE_ID);
      return CONFIG.DEV_FALLBACK_DEVICE_ID;
    }
    return '';
  }

  function safeText(value, fallback = '') {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text || fallback;
  }

  function firstName(value, fallback = '') {
    const text = safeText(value, fallback);
    if (!text) return '';
    return text.split(/\s+/)[0] || text;
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function stripLeadingNameForSpeech(value, name) {
    const text = safeText(value);
    if (!text) return '';
    const candidates = Array.from(new Set([
      safeText(name),
      firstName(name)
    ].filter(Boolean))).sort((left, right) => right.length - left.length);
    for (const candidate of candidates) {
      const pattern = new RegExp(`^(?:hey\\s+)?${escapeRegExp(candidate)}\\b\\s*(?:[,;:!\\-–—]+\\s*)?`, 'i');
      const stripped = text.replace(pattern, '').trim();
      if (stripped && stripped !== text) return stripped;
    }
    return text;
  }

  function normalizePersonalizedSpeechText(value, name) {
    const text = safeText(value);
    const first = firstName(name);
    if (!text || !first) return text;
    const leadPattern = new RegExp(`^hey\\s+${escapeRegExp(first)}\\b\\s*(?:[,;:!\\-–—]+\\s*)?`, 'i');
    const leadMatch = text.match(leadPattern);
    if (leadMatch) {
      const remainder = text.slice(leadMatch[0].length);
      const spokenBody = stripLeadingNameForSpeech(remainder, name);
      return `${personalizedLead(name)}${spokenBody}`.trim();
    }
    const spokenBody = stripLeadingNameForSpeech(text, name);
    if (spokenBody && spokenBody !== text) return `${personalizedLead(name)}${spokenBody}`.trim();
    return text;
  }

  function personalizedLead(name) {
    const first = firstName(name);
    return first ? `Hey ${first}, ` : '';
  }

  function alertId(value) {
    return String(value || '').trim();
  }

  function hasSeenId(id) {
    const normalized = alertId(id);
    return !normalized || localStorage.getItem(`${CONFIG.SEEN_PREFIX}${normalized}`) === '1';
  }

  function markSeenId(id) {
    const normalized = alertId(id);
    if (normalized) localStorage.setItem(`${CONFIG.SEEN_PREFIX}${normalized}`, '1');
  }

  function buildMessagesUrl(row) {
    const url = new URL('./messages.html', window.location.href);
    url.searchParams.set('hub', 'employee');
    if (state.deviceId) url.searchParams.set('device', state.deviceId);
    if (row?.msg_user_id || state.currentUserId) url.searchParams.set('user_id', String(row?.msg_user_id || state.currentUserId));
    return url.toString();
  }

  function buildScheduleUrl(row) {
    const url = new URL('./employee-schedule.html', window.location.href);
    url.searchParams.set('hub', 'employee');
    if (state.deviceId) url.searchParams.set('device', state.deviceId);
    const locationCode = safeText(row?.location_code);
    if (locationCode) url.searchParams.set('highlight', locationCode);
    return url.toString();
  }

  function buildThreadUrl(thread) {
    const url = new URL('./thread.html', window.location.href);
    url.searchParams.set('hub', 'employee');
    if (state.deviceId) url.searchParams.set('device', state.deviceId);
    if (state.currentUserId) url.searchParams.set('user_id', state.currentUserId);
    if (thread?.thread_id || thread?.id) url.searchParams.set('thread_id', String(thread.thread_id || thread.id));
    return url.toString();
  }

  function injectStyles() {
    if (document.getElementById('memphis-device-reminder-style')) return;
    const style = document.createElement('style');
    style.id = 'memphis-device-reminder-style';
    style.textContent = `
      body.mz-reminder-active #kiosk-lock-screen{opacity:0 !important;pointer-events:none !important;visibility:hidden !important}
      .mz-reminder-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(2,6,12,.94)}
      .mz-reminder-card{width:min(680px,100%);border-radius:28px;border:2px solid rgba(255,214,102,.9);background:linear-gradient(180deg,#1f2937,#060c14);color:#f8fafc;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:24px;text-align:center;font-family:Arial,sans-serif}
      .mz-reminder-kicker{font-size:.82rem;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#facc15;margin-bottom:10px}
      .mz-reminder-title{font-size:clamp(1.6rem,6vw,2.35rem);font-weight:950;line-height:1.05;margin-bottom:12px;text-shadow:0 2px 16px rgba(0,0,0,.38)}
      .mz-reminder-body{font-size:clamp(1rem,3.8vw,1.22rem);line-height:1.36;color:rgba(248,250,252,.94);margin:0 auto 20px;max-width:58ch}
      .mz-reminder-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
      .mz-reminder-btn{border:0;border-radius:18px;padding:14px 20px;font-size:1.05rem;font-weight:900;cursor:pointer;min-width:160px;box-shadow:0 10px 24px rgba(0,0,0,.22)}
      .mz-reminder-open{background:linear-gradient(180deg,#fcd34d,#f59e0b);color:#111827}
      .mz-reminder-dismiss{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.20);color:#f8fafc}
    `;
    document.head.appendChild(style);
  }

  async function fetchJson(path) {
    const response = await fetch(`${CONFIG.API_BASE}${path}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload.data;
  }

  async function resolveIdentity() {
    if (!state.deviceId) return null;
    const data = await fetchJson(`/me/by-device?device_id=${encodeURIComponent(state.deviceId)}`);
    state.currentUserId = safeText(data?.msg_user_id);
    state.currentDisplayName = safeText(data?.display_name);
    state.currentRole = safeText(data?.role).toLowerCase();
    return data || null;
  }

  async function fetchReminders() {
    if (!state.deviceId) return [];
    const data = await fetchJson(`/device-event-reminders?device_id=${encodeURIComponent(state.deviceId)}&limit=5`);
    return Array.isArray(data) ? data : [];
  }

  async function fetchLocationStatusReminders() {
    if (!state.deviceId) return [];
    const data = await fetchJson(`/device-location-status-reminders?device_id=${encodeURIComponent(state.deviceId)}&limit=5`);
    return Array.isArray(data) ? data : [];
  }

  async function fetchThreads() {
    if (!state.currentUserId) return [];
    const qs = `?user_id=${encodeURIComponent(state.currentUserId)}${state.deviceId ? `&device_id=${encodeURIComponent(state.deviceId)}` : ''}`;
    const data = await fetchJson(`/threads${qs}`);
    return Array.isArray(data) ? data : [];
  }

  function setReminderPresentationActive(active) {
    try {
      document.body?.classList.toggle('mz-reminder-active', Boolean(active));
    } catch (_err) {}
  }

  function isPresentationLocationDemo(metadata) {
    const demoFlag = metadata?.presentation_demo === true || safeText(metadata?.presentation_demo).toLowerCase() === 'true';
    return demoFlag && safeText(metadata?.demo_alert_kind).toLowerCase() === 'location_status';
  }

  function presentationLocationStatusAlert(row, metadata = {}) {
    const messageId = safeText(row?.message_id || row?.id || Date.now());
    const baseCode = safeText(metadata.location_code || metadata.group_code || metadata.location_name || messageId, messageId);
    const alert = locationStatusAlert({
      ...metadata,
      message_id: messageId,
      service_date: safeText(metadata.service_date || row?.sent_at || row?.created_at || 'presentation-demo'),
      location_code: `${baseCode}:demo:${messageId}`,
      location_name: safeText(metadata.location_name || metadata.group_name || row?.body, 'Assigned location'),
      group_name: safeText(metadata.group_name || metadata.location_name || 'Presentation demo'),
      employee_name: safeText(metadata.employee_name || row?.display_name || row?.employee_name || state.currentDisplayName),
      status_code: safeText(metadata.status_code, 'due_soon'),
      form_type: safeText(metadata.form_type, 'exhibit'),
      coverage_purpose: safeText(metadata.coverage_purpose, 'presentation_demo')
    });
    alert.linkedIds = [`thread:${safeText(row?.thread_id)}:${messageId}`];
    return alert;
  }

  function reminderAlert(row) {
    const metadata = row?.metadata_json && typeof row.metadata_json === 'object' ? row.metadata_json : {};
    if (isPresentationLocationDemo(metadata)) return presentationLocationStatusAlert(row, metadata);

    const messageId = safeText(row?.message_id || row?.id);
    const speakerName = state.currentDisplayName || row?.display_name || row?.employee_name;
    const lead = personalizedLead(speakerName);
    const body = safeText(row?.body, 'You have an event reminder from Memphis.');
    const spokenBody = stripLeadingNameForSpeech(body, speakerName);
    const threadId = safeText(row?.thread_id);
    return {
      id: `event:${messageId}`,
      linkedIds: [`thread:${safeText(row?.thread_id)}:${messageId}`],
      kicker: 'Memphis event reminder',
      title: 'Check this event location',
      body,
      openLabel: 'Open Memphis',
      dismissLabel: 'Dismiss',
      openUrl: threadId ? buildThreadUrl({ thread_id: threadId, last_message_id: messageId }) : buildMessagesUrl(row),
      speakerName,
      speechText: `${lead}${spokenBody}`
    };
  }

  function locationStatusAlert(row) {
    const statusCode = safeText(row?.status_code).toLowerCase();
    const locationCode = safeText(row?.location_code || row?.location_id);
    const locationName = safeText(row?.location_name || row?.group_name, 'Assigned location');
    const groupName = safeText(row?.group_name);
    const speakerName = state.currentDisplayName || row?.employee_name;
    const lead = personalizedLead(speakerName);
    const serviceDate = safeText(row?.service_date);
    const isOverdue = statusCode === 'overdue';
    const kicker = isOverdue ? 'Assigned location overdue' : 'Assigned location due soon';
    const title = isOverdue ? `${locationName} is overdue` : `${locationName} is due soon`;
    const groupSuffix = groupName && groupName !== locationName ? ` on ${groupName}` : '';
    const timing = isOverdue
      ? 'needs attention now.'
      : 'is getting close to its next required cleaning window.';
    return {
      id: `location-status:${serviceDate}:${locationCode}:${statusCode}`,
      linkedIds: [],
      kicker,
      title,
      body: `${locationName}${groupSuffix} on your assigned route ${timing}`,
      openLabel: 'Open schedule',
      dismissLabel: 'Dismiss',
      openUrl: buildScheduleUrl(row),
      speakerName,
      speechText: isOverdue
        ? `${lead}${locationName} is overdue on your route. Please handle it now.`
        : `${lead}${locationName} is due soon on your route. Please check it soon.`
    };
  }

  function threadAlert(row) {
    const threadId = safeText(row?.thread_id || row?.id);
    const messageId = safeText(row?.last_message_id);
    const threadTitle = displayThreadTitle(row);
    const senderName = safeText(row?.last_sender_name, threadTitle);
    const isMemphis = safeText(row?.thread_type).toLowerCase() === 'bot' || threadTitle.toLowerCase() === 'memphis';
    const preview = safeText(row?.last_message_body, isMemphis ? 'You have a new Memphis message.' : 'You have a new message.');
    const speakerName = state.currentDisplayName || row?.display_name || row?.employee_name;
    const lead = personalizedLead(speakerName);
    return {
      id: `thread:${threadId}:${messageId}`,
      linkedIds: [],
      kicker: isMemphis ? 'Memphis message' : 'New direct message',
      title: isMemphis ? 'Memphis sent you a message' : senderName,
      body: isMemphis ? preview : `${threadTitle}: ${preview}`,
      openLabel: 'Open thread',
      dismissLabel: 'Dismiss',
      openUrl: buildThreadUrl(row),
      speakerName,
      speechText: isMemphis ? `${lead}Memphis sent you a new message.` : `${lead}${senderName} sent you a new message.`
    };
  }

  function participantCount(row) {
    return safeText(row?.participant_names)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .length;
  }

  function isCustodialTeamThread(row) {
    const type = safeText(row?.thread_type).toLowerCase();
    if (type !== 'group' && type !== 'broadcast') return false;
    const rawTitle = safeText(row?.thread_title || row?.title).toLowerCase();
    if (rawTitle === 'custodial team' || rawTitle === 'everyone') return true;
    return participantCount(row) >= 8;
  }

  function displayThreadTitle(row) {
    if (isCustodialTeamThread(row)) return 'Custodial Team';
    return safeText(row?.thread_title || row?.title, 'Conversation');
  }

  function debugReminderAlert() {
    const speakerName = state.currentDisplayName || 'Markeisha';
    const lead = personalizedLead(speakerName);
    return {
      id: `debug:${Date.now()}`,
      linkedIds: [],
      kicker: 'Memphis reminder test',
      title: 'Moto reminder test',
      body: 'This is a test reminder using Moto.ogg with repeated alert playback.',
      openLabel: 'Open Memphis',
      dismissLabel: 'Dismiss',
      openUrl: buildMessagesUrl(),
      speakerName,
      speechText: `${lead}this is a Memphis reminder test. Please check your phone now.`
    };
  }

  function fullySpeak(text) {
    const normalized = safeText(text);
    if (!normalized) return false;
    try {
      if (window.fully?.textToSpeech) {
        window.fully.textToSpeech(normalized);
        return true;
      }
    } catch (_err) {}
    return false;
  }

  function fullyKioskNudge(alert) {
    const rawText = safeText(alert?.speechText, 'New Memphis notification.');
    const text = normalizePersonalizedSpeechText(rawText, alert?.speakerName || state.currentDisplayName);
    try { if (window.fully?.turnScreenOn) window.fully.turnScreenOn(); } catch (_err) {}
    try { if (window.fully?.bringToForeground) window.fully.bringToForeground(); } catch (_err) {}
    try { if (window.fully?.vibrate) window.fully.vibrate(650); } catch (_err) {}
    try { navigator.vibrate?.([350, 150, 350, 150, 650]); } catch (_err) {}
    startAlertAudioSequence(text, {
      repeatCount: Math.max(CONFIG.RINGTONE_REPEAT_COUNT, CONFIG.VOICE_REPEAT_COUNT)
    });
  }

  function clearPendingRingtoneRepeats() {
    while (state.ringTimeouts.length) {
      window.clearTimeout(state.ringTimeouts.pop());
    }
  }

  function stopActiveSpeech() {
    try { window.fully?.stopTextToSpeech?.(); } catch (_err) {}
    try { window.speechSynthesis?.cancel?.(); } catch (_err) {}
  }

  function stopActiveRingtone() {
    try { window.fully?.stopSound?.(); } catch (_err) {}
    try { window.fully?.stopAudio?.(); } catch (_err) {}
    try {
      if (state.audioEl) {
        state.audioEl.pause?.();
        state.audioEl.currentTime = 0;
      }
    } catch (_err) {}
    while (state.activeOscillators.length) {
      const osc = state.activeOscillators.pop();
      try { osc.stop?.(); } catch (_err) {}
      try { osc.disconnect?.(); } catch (_err) {}
    }
  }

  function estimateSpeechDurationMs(text) {
    const normalized = safeText(text);
    if (!normalized) return 0;
    const words = normalized.split(/\s+/).filter(Boolean).length;
    return Math.max(CONFIG.VOICE_REPEAT_GAP_MS, Math.min(12000, 900 + words * 420));
  }

  function queueAlertStep(callback, delayMs) {
    const timeoutId = window.setTimeout(() => {
      const index = state.ringTimeouts.indexOf(timeoutId);
      if (index >= 0) state.ringTimeouts.splice(index, 1);
      callback();
    }, delayMs);
    state.ringTimeouts.push(timeoutId);
    return timeoutId;
  }

  function speakViaBrowser(text) {
    const normalized = safeText(text);
    if (!normalized || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    try {
      const utterance = new SpeechSynthesisUtterance(normalized);
      utterance.volume = 1;
      utterance.rate = 0.92;
      utterance.pitch = 1;
      window.speechSynthesis.cancel?.();
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function speakOnce(text) {
    const normalized = safeText(text);
    if (!normalized) return false;
    stopActiveSpeech();
    if (fullySpeak(normalized)) return true;
    return speakViaBrowser(normalized);
  }

  function scheduleSpokenAlert(text, repeatCount = CONFIG.VOICE_REPEAT_COUNT) {
    const count = Math.max(1, Number(repeatCount) || 1);
    const normalized = safeText(text);
    if (!normalized) return;
    const spoken = speakOnce(normalized);
    if (!spoken) return;
    for (let index = 1; index < count; index += 1) {
      queueAlertStep(() => {
        speakOnce(normalized);
      }, CONFIG.VOICE_REPEAT_GAP_MS * index);
    }
  }

  function createRingtoneDataUrl() {
    const sampleRate = 22050;
    const toneSeconds = 0.16;
    const gapSeconds = 0.02;
    const tones = [880, 1175, 880, 1175, 1480, 1175];
    const segmentSamples = Math.max(1, Math.floor(toneSeconds * sampleRate));
    const gapSamples = Math.max(0, Math.floor(gapSeconds * sampleRate));
    const totalSamples = tones.length * segmentSamples + Math.max(0, tones.length - 1) * gapSamples;
    const pcm = new Int16Array(totalSamples);
    let cursor = 0;
    tones.forEach((freq, toneIndex) => {
      for (let i = 0; i < segmentSamples; i += 1) {
        const t = i / sampleRate;
        const fadeIn = Math.min(1, i / Math.max(1, sampleRate * 0.012));
        const fadeOut = Math.min(1, (segmentSamples - i) / Math.max(1, sampleRate * 0.02));
        const env = Math.min(fadeIn, fadeOut);
        const sample = Math.sin(2 * Math.PI * freq * t) * env * 0.45;
        pcm[cursor] = Math.max(-1, Math.min(1, sample)) * 32767;
        cursor += 1;
      }
      if (toneIndex < tones.length - 1) cursor += gapSamples;
    });
    const bytesPerSample = 2;
    const dataSize = pcm.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const writeAscii = (offset, value) => {
      for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    };
    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeAscii(36, 'data');
    view.setUint32(40, dataSize, true);
    pcm.forEach((sample, index) => view.setInt16(44 + index * bytesPerSample, sample, true));
    let binary = '';
    const bytes = new Uint8Array(buffer);
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return `data:audio/wav;base64,${btoa(binary)}`;
  }

  function ensureRingtoneDataUrl() {
    if (!state.ringtoneDataUrl) state.ringtoneDataUrl = createRingtoneDataUrl();
    return state.ringtoneDataUrl;
  }

  function primeAudioOutput() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !state.audioCtx) state.audioCtx = new AudioContextClass();
      if (state.audioCtx?.state === 'suspended') state.audioCtx.resume().catch(() => {});
    } catch (_err) {}
    try {
      if (!state.audioEl) {
        state.audioEl = new Audio(ensureRingtoneDataUrl());
        state.audioEl.preload = 'auto';
      }
      state.audioEl.load?.();
    } catch (_err) {}
  }

  function playViaFullyJs(sources) {
    const candidates = Array.isArray(sources) ? sources.filter(Boolean) : [];
    for (const source of candidates) {
      try {
        if (window.fully?.playSound) {
          window.fully.playSound(source, false);
          return true;
        }
      } catch (_err) {}
      try {
        if (window.fully?.playAudio) {
          window.fully.playAudio(source, false, true);
          return true;
        }
      } catch (_err) {}
    }
    return false;
  }

  function playViaHtmlAudio(dataUrl) {
    try {
      const audio = state.audioEl || new Audio(dataUrl);
      state.audioEl = audio;
      audio.pause?.();
      audio.currentTime = 0;
      if (audio.src !== dataUrl) audio.src = dataUrl;
      audio.preload = 'auto';
      audio.volume = 1;
      const maybePromise = audio.play?.();
      if (maybePromise?.catch) maybePromise.catch(() => {});
      return true;
    } catch (_err) {
      return false;
    }
  }

  function playViaWebAudio() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      const ctx = state.audioCtx || new AudioContextClass();
      state.audioCtx = ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime + 0.05;
      const tones = [880, 1175, 880, 1175, 1480, 1175];
      tones.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + index * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.28, now + index * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.18 + 0.14);
        osc.connect(gain).connect(ctx.destination);
        state.activeOscillators.push(osc);
        osc.start(now + index * 0.18);
        osc.stop(now + index * 0.18 + 0.16);
        osc.onended = () => {
          const oscIndex = state.activeOscillators.indexOf(osc);
          if (oscIndex >= 0) state.activeOscillators.splice(oscIndex, 1);
          try { osc.disconnect?.(); } catch (_err) {}
        };
      });
      return true;
    } catch (_err) {
      return false;
    }
  }

  function playOneRingtone() {
    const dataUrl = ensureRingtoneDataUrl();
    primeAudioOutput();
    const fullySources = [...CONFIG.RINGTONE_FILE_CANDIDATES, dataUrl];
    stopActiveRingtone();
    const played = playViaFullyJs(fullySources)
      || playViaHtmlAudio(dataUrl)
      || playViaWebAudio();
    if (!played) {
      queueAlertStep(() => {
        playViaHtmlAudio(dataUrl);
        playViaWebAudio();
      }, 220);
    }
    return played;
  }

  function playRingtone({ repeatCount = CONFIG.RINGTONE_REPEAT_COUNT } = {}) {
    const count = Math.max(1, Number(repeatCount) || 1);
    clearPendingRingtoneRepeats();
    playOneRingtone();
    for (let index = 1; index < count; index += 1) {
      queueAlertStep(() => {
        playOneRingtone();
      }, CONFIG.RINGTONE_REPEAT_GAP_MS * index);
    }
  }

  function startAlertAudioSequence(text, { repeatCount = Math.max(CONFIG.RINGTONE_REPEAT_COUNT, CONFIG.VOICE_REPEAT_COUNT) } = {}) {
    const normalized = safeText(text);
    const count = Math.max(1, Number(repeatCount) || 1);
    if (!normalized) return;
    clearPendingRingtoneRepeats();
    stopActiveRingtone();
    stopActiveSpeech();
    const token = Date.now();
    state.alertSequenceToken = token;
    const runCycle = (index) => {
      if (state.alertSequenceToken !== token || index >= count) {
        stopActiveRingtone();
        stopActiveSpeech();
        return;
      }
      playOneRingtone();
      queueAlertStep(() => {
        if (state.alertSequenceToken !== token) return;
        stopActiveRingtone();
        speakOnce(normalized);
        queueAlertStep(() => {
          if (state.alertSequenceToken !== token) return;
          stopActiveSpeech();
          runCycle(index + 1);
        }, estimateSpeechDurationMs(normalized) + CONFIG.ALERT_POST_SPEECH_DELAY_MS);
      }, CONFIG.RINGTONE_REPEAT_GAP_MS + CONFIG.ALERT_POST_RINGTONE_DELAY_MS);
    };
    runCycle(0);
  }

  function closeActiveAlert() {
    state.alertSequenceToken += 1;
    clearPendingRingtoneRepeats();
    stopActiveRingtone();
    stopActiveSpeech();
    document.querySelector('.mz-reminder-backdrop')?.remove();
    setReminderPresentationActive(false);
    state.activeAlert = null;
    sessionStorage.removeItem(CONFIG.ALERT_LOCK_KEY);
  }

  function showAlert(alert) {
    if (!alert?.id || state.activeAlert || document.querySelector('.mz-reminder-backdrop') || hasSeenId(alert.id)) return;
    state.activeAlert = alert;
    injectStyles();
    setReminderPresentationActive(true);
    sessionStorage.setItem(CONFIG.ALERT_LOCK_KEY, alert.id);

    const backdrop = document.createElement('div');
    backdrop.className = 'mz-reminder-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.innerHTML = `
      <div class="mz-reminder-card">
        <div class="mz-reminder-kicker"></div>
        <div class="mz-reminder-title"></div>
        <div class="mz-reminder-body"></div>
        <div class="mz-reminder-actions">
          <button type="button" class="mz-reminder-btn mz-reminder-open"></button>
          <button type="button" class="mz-reminder-btn mz-reminder-dismiss"></button>
        </div>
      </div>
    `;

    backdrop.querySelector('.mz-reminder-kicker').textContent = safeText(alert.kicker, 'Memphis notification');
    backdrop.querySelector('.mz-reminder-title').textContent = safeText(alert.title, 'New notification');
    backdrop.querySelector('.mz-reminder-body').textContent = safeText(alert.body, 'You have a new Memphis notification.');
    backdrop.querySelector('.mz-reminder-open').textContent = safeText(alert.openLabel, 'Open');
    backdrop.querySelector('.mz-reminder-dismiss').textContent = safeText(alert.dismissLabel, 'Dismiss');

    backdrop.querySelector('.mz-reminder-open').addEventListener('click', () => {
      markSeenId(alert.id);
      (Array.isArray(alert.linkedIds) ? alert.linkedIds : []).forEach(markSeenId);
      closeActiveAlert();
      window.location.href = alert.openUrl || buildMessagesUrl();
    });
    backdrop.querySelector('.mz-reminder-dismiss').addEventListener('click', () => {
      markSeenId(alert.id);
      (Array.isArray(alert.linkedIds) ? alert.linkedIds : []).forEach(markSeenId);
      closeActiveAlert();
    });

    document.body.appendChild(backdrop);
    fullyKioskNudge(alert);
  }

  function pickNextAlert({ locationStatuses = [], reminders = [], threads = [] }) {
    const unseenLocationStatus = locationStatuses
      .map(locationStatusAlert)
      .find((alert) => !hasSeenId(alert.id));
    if (unseenLocationStatus) return unseenLocationStatus;

    const unseenReminder = reminders
      .map(reminderAlert)
      .find((alert) => !hasSeenId(alert.id));
    if (unseenReminder) return unseenReminder;

    const unseenThread = threads
      .filter((row) => Number(row?.unread_count || 0) > 0)
      .filter((row) => safeText(row?.last_message_id))
      .filter((row) => safeText(row?.last_sender_name).toLowerCase() !== state.currentDisplayName.toLowerCase())
      .map(threadAlert)
      .find((alert) => !hasSeenId(alert.id));
    return unseenThread || null;
  }

  async function poll() {
    try {
      if (!state.currentUserId) await resolveIdentity().catch(() => null);
      const [locationStatuses, reminders, threads] = await Promise.all([fetchLocationStatusReminders(), fetchReminders(), fetchThreads()]);
      const next = pickNextAlert({ locationStatuses, reminders, threads });
      if (next) showAlert(next);
    } catch (error) {
      console.warn('Memphis device reminder poll failed', error);
    }
  }

  function runDebugTriggers() {
    const url = new URL(window.location.href);
    const testReminder = String(url.searchParams.get('testReminder') || '').trim().toLowerCase();
    const testRing = String(url.searchParams.get('testRing') || '').trim().toLowerCase();
    const repeatCount = Math.max(1, Number(url.searchParams.get('repeatCount')) || CONFIG.RINGTONE_REPEAT_COUNT);
    if (testReminder === '1' || testReminder === 'true' || testReminder === 'yes') {
      window.setTimeout(async () => {
        await resolveIdentity().catch(() => null);
        showAlert(debugReminderAlert());
      }, 900);
    }
    if (testRing === '1' || testRing === 'true' || testRing === 'yes') {
      window.setTimeout(() => {
        playRingtone({ repeatCount });
      }, 900);
    }
  }

  function init() {
    state.deviceId = resolveDeviceId();
    if (!state.deviceId) return;
    ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
      window.addEventListener(eventName, primeAudioOutput, { once: true, passive: true });
    });
    primeAudioOutput();
    window.MemphisDeviceReminders = {
      poll,
      resolveDeviceId: () => state.deviceId,
      debugPlayRingtone: (repeatCount) => playRingtone({ repeatCount }),
      debugShowSampleAlert: () => showAlert(debugReminderAlert())
    };
    runDebugTriggers();
    setTimeout(poll, CONFIG.STARTUP_DELAY_MS);
    state.poller = setInterval(poll, CONFIG.POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
