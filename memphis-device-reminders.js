(() => {
  'use strict';

  const CONFIG = {
    API_BASE: 'https://memphis-zoo-mcp.onrender.com/messaging-api',
    DEVICE_STORAGE_KEY: 'mz_scan_device_id',
    POLL_MS: 30000,
    STARTUP_DELAY_MS: 3500,
    SEEN_PREFIX: 'mz_program_alert_seen:',
    ALERT_LOCK_KEY: 'mz_program_alert_lock',
    RINGTONE_REPEAT_COUNT: 1,
    RINGTONE_REPEAT_GAP_MS: 1250,
    RINGTONE_ESTIMATED_DURATION_MS: 1250,
    ALERT_POST_RINGTONE_DELAY_MS: 900,
    VOICE_REPEAT_COUNT: 1,
    VOICE_REPEAT_GAP_MS: 1200,
    ALERT_POST_SPEECH_DELAY_MS: 3500,
    ALERT_OPEN_GRACE_MS: 1800,
    RINGTONE_HOSTED_FILE: 'memphis-alert-tone.wav?v=release-2026.07.14.scheduler-alerts-gps.3'
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
    ringTimeouts: [],
    activeSpeechPromise: null,
    activeSequencePromise: null
  };

  function normalizeDeviceId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^kiosk[-_]?\d{1,2}$/i.test(raw)) {
      const digits = (raw.match(/\d+/) || [''])[0].padStart(2, '0');
      return `KIOSK_${digits}`;
    }
    return raw;
  }

  function persistDeviceId(value) {
    const normalized = normalizeDeviceId(value);
    if (normalized) localStorage.setItem(CONFIG.DEVICE_STORAGE_KEY, normalized);
    return normalized;
  }

  function resolveDeviceId() {
    const shared = window.MemphisDeviceIdentity?.resolve?.({ url: new URL(window.location.href) });
    if (shared?.deviceId) return persistDeviceId(shared.deviceId);
    const stored = normalizeDeviceId(localStorage.getItem(CONFIG.DEVICE_STORAGE_KEY) || '');
    if (!stored || /^visitor-|^device-/i.test(stored)) return '';
    return persistDeviceId(stored);
  }

  function safeText(value, fallback = '') {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text || fallback;
  }

  function objectMetadata(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      } catch (_err) {}
    }
    return {};
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
    if (normalized) {
      localStorage.setItem(`${CONFIG.SEEN_PREFIX}${normalized}`, '1');
      localStorage.setItem(`${CONFIG.SEEN_PREFIX}${normalized}:ts`, String(Date.now()));
      cleanupStaleSeenKeys();
    }
  }

  function cleanupStaleSeenKeys() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CONFIG.SEEN_PREFIX) && !key.endsWith(':ts')) {
          keys.push({ key, ts: Number(localStorage.getItem(key + ':ts') || 0) });
        }
      }
      if (keys.length <= 200) return;
      keys.sort((a, b) => a.ts - b.ts);
      const toRemove = keys.length - 200;
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(keys[i].key);
        localStorage.removeItem(keys[i].key + ':ts');
      }
    } catch (_e) {}
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
    const response = await fetch(`${CONFIG.API_BASE}${path}`, { cache: 'no-store', headers: { 'X-Device-Id': state.deviceId } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload.data;
  }

  async function postJson(path, body) {
    const response = await fetch(`${CONFIG.API_BASE}${path}`, {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': state.deviceId },
      body: JSON.stringify(body || {})
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload.data;
  }

  async function acknowledgeAlert(alert, action) {
    if (!alert?.notificationKey || !state.deviceId) return null;
    try {
      return await postJson('/device-notifications/ack', {
        device_id: state.deviceId,
        notification_key: alert.notificationKey,
        notification_type: alert.notificationType || 'notification',
        action,
        message_id: alert.messageId || null,
        metadata: { page_url: window.location.href, alert_id: alert.id || null }
      });
    } catch (error) {
      console.warn('Notification acknowledgement failed', error);
      return null;
    }
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
    const metadata = objectMetadata(row?.metadata_json);
    if (isPresentationLocationDemo(metadata)) return presentationLocationStatusAlert(row, metadata);

    const messageId = safeText(row?.message_id || row?.id);
    const notificationKey = safeText(row?.notification_key, `event:${messageId}`);
    const speakerName = state.currentDisplayName || row?.display_name || row?.employee_name;
    const lead = personalizedLead(speakerName);
    const body = safeText(row?.body, 'You have an event reminder from Memphis.');
    const spokenBody = stripLeadingNameForSpeech(body, speakerName);
    const threadId = safeText(row?.thread_id);
    return {
      id: notificationKey,
      notificationKey,
      notificationType: 'event',
      messageId,
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
    const notificationKey = safeText(row?.notification_key, `location-status:${serviceDate}:${locationCode}:${statusCode}`);
    return {
      id: notificationKey,
      notificationKey,
      notificationType: 'location_status',
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
    const metadata = objectMetadata(row?.last_message_metadata_json || row?.metadata_json);
    if (isPresentationLocationDemo(metadata)) {
      return presentationLocationStatusAlert({
        ...row,
        id: messageId,
        message_id: messageId,
        thread_id: threadId,
        body: row?.last_message_body,
        display_name: state.currentDisplayName || row?.display_name || row?.employee_name
      }, metadata);
    }
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
      title: 'Fleet alert sound test',
      body: 'This is a test reminder using the shared Memphis fleet alert sound.',
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
    try { navigator.vibrate?.([350, 150, 350]); } catch (_err) {}
    const sequence = startAlertAudioSequence(text).catch((error) => {
      console.warn('Memphis alert audio sequence failed', error);
    });
    state.activeSequencePromise = sequence;
    sequence.finally(() => {
      if (state.activeSequencePromise === sequence) state.activeSequencePromise = null;
      if (!state.activeAlert) window.setTimeout(() => poll().catch(() => {}), 250);
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
    return Math.max(5000, Math.min(45000, 3000 + words * 700));
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
    if (!normalized || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        const utterance = new SpeechSynthesisUtterance(normalized);
        utterance.volume = 1;
        utterance.rate = 0.88;
        utterance.pitch = 1;
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        utterance.onend = () => finish(true);
        utterance.onerror = () => finish(false);
        window.speechSynthesis.cancel?.();
        window.speechSynthesis.speak(utterance);
        window.setTimeout(() => finish(true), estimateSpeechDurationMs(normalized) + 8000);
      } catch (_err) {
        resolve(false);
      }
    });
  }

  async function speakOnce(text) {
    const normalized = safeText(text);
    if (!normalized) return false;
    if (fullySpeak(normalized)) {
      // Fully Kiosk does not expose a reliable completion callback. Wait a generous
      // amount before allowing another sound, but never force-stop the speech.
      await new Promise((resolve) => window.setTimeout(resolve, estimateSpeechDurationMs(normalized)));
      return true;
    }
    return speakViaBrowser(normalized);
  }

  function scheduleSpokenAlert(text) {
    return speakOnce(text);
  }

  function createRingtoneWaveform(sampleRate = 32000) {
    const totalSeconds = 1.25;
    const totalSamples = Math.max(1, Math.floor(totalSeconds * sampleRate));
    const samples = new Float32Array(totalSamples);
    const addTone = ({
      startSeconds,
      durationSeconds,
      freqs,
      amplitude = 0.3,
      attackSeconds = 0.01,
      releaseSeconds = 0.12,
      vibratoDepth = 0,
      vibratoHz = 5.3,
      harmonics = []
    }) => {
      const start = Math.max(0, Math.floor(startSeconds * sampleRate));
      const length = Math.max(1, Math.floor(durationSeconds * sampleRate));
      const attack = Math.max(1, Math.floor(attackSeconds * sampleRate));
      const release = Math.max(1, Math.floor(releaseSeconds * sampleRate));
      for (let i = 0; i < length && start + i < samples.length; i += 1) {
        const t = i / sampleRate;
        let env = 1;
        if (i < attack) env = i / attack;
        else if (i > length - release) env = Math.max(0, (length - i) / release);
        let sample = 0;
        freqs.forEach((baseFreq) => {
          const modulatedFreq = baseFreq * (1 + vibratoDepth * Math.sin(2 * Math.PI * vibratoHz * t));
          sample += Math.sin(2 * Math.PI * modulatedFreq * t);
          harmonics.forEach(({ multiplier, weight }) => {
            sample += weight * Math.sin(2 * Math.PI * modulatedFreq * multiplier * t);
          });
        });
        samples[start + i] += (sample / Math.max(1, freqs.length)) * amplitude * env;
      }
    };

    addTone({
      startSeconds: 0.0,
      durationSeconds: 0.18,
      freqs: [784],
      amplitude: 0.23,
      harmonics: [{ multiplier: 2, weight: 0.15 }],
      vibratoDepth: 0.001
    });
    addTone({
      startSeconds: 0.18,
      durationSeconds: 0.18,
      freqs: [1046.5],
      amplitude: 0.27,
      harmonics: [{ multiplier: 2, weight: 0.12 }],
      vibratoDepth: 0.001
    });
    addTone({
      startSeconds: 0.39,
      durationSeconds: 0.30,
      freqs: [1396.9],
      amplitude: 0.30,
      harmonics: [
        { multiplier: 2, weight: 0.10 },
        { multiplier: 3, weight: 0.03 }
      ],
      vibratoDepth: 0.002
    });
    addTone({
      startSeconds: 0.78,
      durationSeconds: 0.14,
      freqs: [1046.5],
      amplitude: 0.13,
      harmonics: [{ multiplier: 2, weight: 0.05 }]
    });

    let peak = 0;
    samples.forEach((sample) => {
      peak = Math.max(peak, Math.abs(sample));
    });
    const gain = peak > 0 ? 0.82 / peak : 1;
    samples.forEach((sample, index) => {
      samples[index] = Math.max(-1, Math.min(1, sample * gain));
    });
    return { sampleRate, samples };
  }

  function createRingtoneDataUrl() {
    const { sampleRate, samples } = createRingtoneWaveform();
    const bytesPerSample = 2;
    const dataSize = samples.length * bytesPerSample;
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
    samples.forEach((sample, index) => view.setInt16(44 + index * bytesPerSample, Math.round(sample * 32767), true));
    let binary = '';
    const bytes = new Uint8Array(buffer);
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return `data:audio/wav;base64,${btoa(binary)}`;
  }

  function ensureRingtoneDataUrl() {
    if (!state.ringtoneDataUrl) state.ringtoneDataUrl = createRingtoneDataUrl();
    return state.ringtoneDataUrl;
  }

  function buildHostedRingtoneUrl() {
    return new URL(`./${CONFIG.RINGTONE_HOSTED_FILE}`, window.location.href).toString();
  }

  function primeAudioOutput() {
    const hostedUrl = buildHostedRingtoneUrl();
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !state.audioCtx) state.audioCtx = new AudioContextClass();
      if (state.audioCtx?.state === 'suspended') state.audioCtx.resume().catch(() => {});
    } catch (_err) {}
    try {
      if (!state.audioEl) {
        state.audioEl = new Audio(hostedUrl);
        state.audioEl.preload = 'auto';
      }
      if (state.audioEl.src !== hostedUrl) state.audioEl.src = hostedUrl;
      state.audioEl.load?.();
    } catch (_err) {}
  }

  function playViaFullyJs(sources) {
    const candidates = Array.isArray(sources) ? sources.filter(Boolean) : [];
    for (const source of candidates) {
      const prefersStreamingApi = /^(?:https?:|data:)/i.test(String(source || ''));
      if (prefersStreamingApi) {
        try {
          if (window.fully?.playAudio) {
            window.fully.playAudio(source, false, true);
            return true;
          }
        } catch (_err) {}
        try {
          if (window.fully?.playSound) {
            window.fully.playSound(source, false);
            return true;
          }
        } catch (_err) {}
        continue;
      }
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

  function playViaHtmlAudio(source) {
    const audioSource = safeText(source);
    if (!audioSource) return false;
    try {
      const audio = state.audioEl || new Audio(audioSource);
      state.audioEl = audio;
      audio.pause?.();
      audio.currentTime = 0;
      if (audio.src !== audioSource) audio.src = audioSource;
      audio.preload = 'auto';
      audio.volume = 1;
      const maybePromise = audio.play?.();
      if (maybePromise?.catch) {
        maybePromise.catch(() => {
          queueAlertStep(() => {
            playViaWebAudio();
          }, 60);
        });
      }
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
      const { sampleRate, samples } = createRingtoneWaveform(ctx.sampleRate || 32000);
      const buffer = ctx.createBuffer(1, samples.length, sampleRate);
      buffer.getChannelData(0).set(samples);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      state.activeOscillators.push(source);
      source.onended = () => {
        const sourceIndex = state.activeOscillators.indexOf(source);
        if (sourceIndex >= 0) state.activeOscillators.splice(sourceIndex, 1);
        try { source.disconnect?.(); } catch (_err) {}
      };
      source.start(ctx.currentTime + 0.05);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function playOneRingtone() {
    const dataUrl = ensureRingtoneDataUrl();
    const hostedUrl = buildHostedRingtoneUrl();
    primeAudioOutput();
    const fullySources = [hostedUrl, dataUrl];
    stopActiveRingtone();
    const played = playViaFullyJs(fullySources)
      || playViaHtmlAudio(hostedUrl)
      || playViaHtmlAudio(dataUrl)
      || playViaWebAudio();
    if (!played) {
      queueAlertStep(() => {
        playViaHtmlAudio(hostedUrl) || playViaHtmlAudio(dataUrl);
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

  async function startAlertAudioSequence(text) {
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
  }

  async function waitForActiveAlertSpeech() {
    const active = state.activeSequencePromise || state.activeSpeechPromise;
    if (!active) {
      await new Promise((resolve) => window.setTimeout(resolve, CONFIG.ALERT_OPEN_GRACE_MS));
      return;
    }
    await Promise.race([
      Promise.resolve(active).catch(() => null),
      new Promise((resolve) => window.setTimeout(resolve, 60000)),
    ]);
    await new Promise((resolve) => window.setTimeout(resolve, CONFIG.ALERT_POST_SPEECH_DELAY_MS));
  }

  function closeActiveAlert(options = {}) {
    const stopSpeech = options.stopSpeech !== false;
    if (stopSpeech) {
      state.alertSequenceToken += 1;
      stopActiveSpeech();
      state.activeSpeechPromise = null;
      state.activeSequencePromise = null;
    }
    clearPendingRingtoneRepeats();
    stopActiveRingtone();
    document.querySelector('.mz-reminder-backdrop')?.remove();
    setReminderPresentationActive(false);
    state.activeAlert = null;
    sessionStorage.removeItem(CONFIG.ALERT_LOCK_KEY);
  }

  function showAlert(alert) {
    if (!alert?.id || state.activeAlert || state.activeSequencePromise || state.activeSpeechPromise || document.querySelector('.mz-reminder-backdrop') || hasSeenId(alert.id)) return;
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

    backdrop.querySelector('.mz-reminder-open').addEventListener('click', async () => {
      markSeenId(alert.id);
      (Array.isArray(alert.linkedIds) ? alert.linkedIds : []).forEach(markSeenId);
      const openButton = backdrop.querySelector('.mz-reminder-open');
      const dismissButton = backdrop.querySelector('.mz-reminder-dismiss');
      if (openButton) { openButton.disabled = true; openButton.textContent = 'Opening after reminder…'; }
      if (dismissButton) dismissButton.disabled = true;
      await acknowledgeAlert(alert, 'opened');
      const destination = alert.openUrl || buildMessagesUrl();
      await waitForActiveAlertSpeech();
      closeActiveAlert({ stopSpeech: false });
      window.location.href = destination;
    });
    backdrop.querySelector('.mz-reminder-dismiss').addEventListener('click', async () => {
      markSeenId(alert.id);
      (Array.isArray(alert.linkedIds) ? alert.linkedIds : []).forEach(markSeenId);
      await acknowledgeAlert(alert, 'dismissed');
      // Dismiss the card immediately, but let the current spoken sentence finish.
      closeActiveAlert({ stopSpeech: false });
    });

    document.body.appendChild(backdrop);
    acknowledgeAlert(alert, 'displayed');
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
