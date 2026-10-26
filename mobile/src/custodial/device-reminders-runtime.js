// Exact maintained normal reminder/browser/audio owner; private native sink only.
export function installDeviceReminders(options) {
  'use strict';
  const { nativeApplicationSource = null } = options ?? {};
  const sourceWriter=(diagnosticSite,operation,asyncResult=false)=>nativeApplicationSource
    ?nativeApplicationSource.wrapNativeWriter(operation,asyncResult,diagnosticSite):operation;

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
    RINGTONE_HOSTED_FILE: 'memphis-alert-tone.wav?v=release-2026.07.19.custodial-v3.12'
  };

  const ordinaryAlertOrigins=new WeakMap(); // SAME normal renderer objects, DATA only.
  const state = {
    deviceId: '',
    currentUserId: '',
    currentDisplayName: '',
    currentRole: '',
    identityPrincipal: null,
    poller: null,
    pollSequence: 0,
    authorityGeneration: 0,
    activeAlert: null,
    activeAudioAlert: null,
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

  async function persistDeviceId(value) {
    const normalized = normalizeDeviceId(value);
    if (window.MemphisCustodialSecurity?.native === true) {
      const status = window.MemphisCustodialSecurity.getStatus?.();
      return status?.ready === true && normalizeDeviceId(status.deviceId) === normalized ? normalized : '';
    }
    const authority = captureReminderWriterAuthority(normalized);
    if (!authority) return '';
    let original;
    try { original = localStorage.getItem(CONFIG.DEVICE_STORAGE_KEY); } catch { return ''; }
    if (original && normalizeDeviceId(original) !== normalized) return '';
    const saved = await mutateReminderStorage(authority, context => {
      assertReminderWriter(context, authority);
      if (localStorage.getItem(CONFIG.DEVICE_STORAGE_KEY) !== original) return false;
      assertReminderWriter(context, authority);
      if (original !== normalized) localStorage.setItem(CONFIG.DEVICE_STORAGE_KEY, normalized);
      assertReminderWriter(context, authority);
      return localStorage.getItem(CONFIG.DEVICE_STORAGE_KEY) === normalized;
    });
    return saved === true ? normalized : '';
  }

  async function resolveDeviceId() {
    try {
    if (window.MemphisCustodialSecurity?.native === true) {
      const status = window.MemphisCustodialSecurity.getStatus?.();
      return status?.ready === true && status?.available === true ? normalizeDeviceId(status.deviceId) : '';
    }
    const shared = window.MemphisDeviceIdentity?.resolve?.({ url: new URL(window.location.href) });
    if (shared?.deviceId) return persistDeviceId(shared.deviceId);
    const stored = normalizeDeviceId(localStorage.getItem(CONFIG.DEVICE_STORAGE_KEY) || '');
    if (!stored || /^visitor-|^device-/i.test(stored)) return '';
    return await persistDeviceId(stored);
    } catch { return ''; } // Uninspectable identity never starts a recipient poll.
  }

  function isEmployeeNotificationContext() {
    if (window.MemphisCustodialSecurity?.native === true) return true;
    if (window.MemphisMobileBuildIdentity?.edition === 'custodial') return true;
    const hub = String(new URL(window.location.href).searchParams.get('hub') || '').trim().toLowerCase();
    return hub === 'employee' || document.body?.dataset?.memphisContext === 'employee';
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

  // Legacy suppression pairs contain no recipient/principal. They are not
  // disposable caches or accepted-scan evidence. Never migrate/relabel them.
  // Only exact pairs this document wrote under current authority may be pruned.
  const ownedSeenPairs = new Map();

  function captureReminderWriterAuthority(deviceId = state.deviceId, requireRecipient = false) {
    const security = window.MemphisCustodialSecurity;
    try {
      const status = security?.getStatus?.();
      const principal = window.MemphisMobile?.principalIdentity?.();
      if (typeof security?.mutateProtectedWork !== 'function' || status?.ready !== true
        || status?.available !== true || status?.quarantined === true
        || !Number.isSafeInteger(status.generation) || !deviceId
        || normalizeDeviceId(status.deviceId) !== deviceId || typeof principal !== 'string' || !principal
        || requireRecipient && (!state.currentUserId || state.identityPrincipal !== principal)) return null;
      const generation = status.generation, authorityGeneration = state.authorityGeneration,
        userId = state.currentUserId, originalDevice = state.deviceId;
      const current = () => {
        const live = security.getStatus?.();
        const livePrincipal = window.MemphisMobile?.principalIdentity?.();
        return window.MemphisCustodialSecurity === security && live?.ready === true && live?.available === true
          && live?.quarantined !== true && live.generation === generation
          && normalizeDeviceId(live.deviceId) === deviceId && state.deviceId === originalDevice
          && state.authorityGeneration === authorityGeneration
          && livePrincipal === principal
          && (!requireRecipient || state.currentUserId === userId && state.identityPrincipal === principal);
      };
      return current() ? Object.freeze({security, deviceId, generation, principal, userId, current}) : null;
    } catch { return null; }
  }

  function assertReminderWriter(context, authority) {
    if (typeof context?.assertCurrent !== 'function') throw new Error('Owned reminder writer checkpoint unavailable.');
    context.assertCurrent();
    if (context.deviceId !== authority.deviceId || context.generation !== authority.generation || !authority.current())
      throw new Error('Original reminder recipient changed.');
    context.assertCurrent();
  }

  async function mutateReminderStorage(authority, operation) {
    try {
      if (!authority?.current()) return false;
      const saved = await authority.security.mutateProtectedWork(context => {
        assertReminderWriter(context, authority);
        return operation(context);
      }, {requireEnrollment: true, expectedGeneration: authority.generation});
      return authority.current() && saved === true;
    } catch { return false; } // Unknown/denied storage is pending, never acceptance.
  }

  function markSeenId(id, context, authority) {
    const normalized = alertId(id);
    if (!normalized) return false;
    assertReminderWriter(context, authority);
    const key = CONFIG.SEEN_PREFIX + normalized, stampKey = key + ':ts',
      prior = localStorage.getItem(key), priorStamp = localStorage.getItem(stampKey);
    if (prior !== null || priorStamp !== null) {
      // Preserve ambiguous/foreign originals; even a known pair is not ours.
      return prior === '1' && /^\d{1,16}$/.test(priorStamp || '')
        && Number.isSafeInteger(Number(priorStamp)) && Number(priorStamp) > 0;
    }
    const stamp = String(Date.now());
    assertReminderWriter(context, authority);
    localStorage.setItem(stampKey, stamp);
    assertReminderWriter(context, authority);
    if (localStorage.getItem(stampKey) !== stamp) return false;
    // Flag is last. Failed timestamp persistence must not suppress a notice.
    assertReminderWriter(context, authority);
    localStorage.setItem(key, '1');
    assertReminderWriter(context, authority);
    if (localStorage.getItem(key) !== '1' || localStorage.getItem(stampKey) !== stamp) return false;
    ownedSeenPairs.set(key, {stamp, principal: authority.principal, userId: authority.userId,
      deviceId: authority.deviceId, generation: authority.generation});
    return true;
  }

  function cleanupStaleSeenKeys(context, authority) {
    if (!context || !authority) return false; // No unowned inventory deletion.
    assertReminderWriter(context, authority);
    const keys = [...ownedSeenPairs].filter(([, pair]) => pair.principal === authority.principal
      && pair.userId === authority.userId && pair.deviceId === authority.deviceId && pair.generation === authority.generation);
    keys.sort((a, b) => Number(a[1].stamp) - Number(b[1].stamp));
    for (const [key, pair] of keys.slice(0, Math.max(0, keys.length - 200))) {
      assertReminderWriter(context, authority);
      if (localStorage.getItem(key) !== '1' || localStorage.getItem(key + ':ts') !== pair.stamp) continue;
      assertReminderWriter(context, authority);
      localStorage.removeItem(key);
      assertReminderWriter(context, authority);
      if (localStorage.getItem(key) !== null) return false;
      assertReminderWriter(context, authority);
      localStorage.removeItem(key + ':ts');
      assertReminderWriter(context, authority);
      if (localStorage.getItem(key + ':ts') !== null) return false;
      ownedSeenPairs.delete(key);
    }
    return true;
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

  // Only a fetch rejection before a response is ordinary transport pending.
  // HTTP denial, malformed JSON/data and local storage/authority exceptions
  // remain visible. Quiet pending never means an accepted receipt or empty set.
  const pendingTransportFailures = new WeakSet();
  async function reminderFetch(url, options) {
    try { return await fetch(url, options); }
    catch (error) {
      if (error && typeof error === 'object' && ['TypeError', 'AbortError', 'TimeoutError'].includes(error.name))
        pendingTransportFailures.add(error);
      throw error;
    }
  }

  async function fetchJson(path) {
    const response = await reminderFetch(`${CONFIG.API_BASE}${path}`, { cache: 'no-store', headers: { 'X-Device-Id': state.deviceId } });
    const payload = await response.json().catch(() => null);
    if (response.ok !== true || !payload || payload.ok !== true) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload.data;
  }

  async function postJson(path, body) {
    const response = await reminderFetch(`${CONFIG.API_BASE}${path}`, {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': state.deviceId },
      body: JSON.stringify(body || {})
    });
    const payload = await response.json().catch(() => null);
    if (response.ok !== true || !payload || payload.ok !== true) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload.data;
  }

  async function acknowledgeAlert(alert, action) {
    if(!alertCurrent(alert))return false;
    if(typeof alert?.boundReceiptAction === 'function')return alert.boundReceiptAction(action);
    if (!alert?.notificationKey) return true;
    if (!state.deviceId) return false;
    try {
      await postJson('/device-notifications/ack', {
        device_id: state.deviceId,
        notification_key: alert.notificationKey,
        notification_type: alert.notificationType || 'notification',
        action,
        message_id: alert.messageId || null,
        metadata: { page_url: window.location.href, alert_id: alert.id || null }
      });
      return true;
    } catch (error) {
      if (!pendingTransportFailures.has(error)) console.warn('Notification acknowledgement failed', error);
      return false;
    }
  }

  async function markAlertSeenIfAcknowledged(alert, acknowledged, authority) {
    if (!alert?.id || (alert.notificationKey && acknowledged !== true)) return false;
    // Native owning receipt already controls repeat/retirement; the legacy
    // local seen flag must never stand in for that receipt or accepted START.
    if (alert.boundReceiptAction) return acknowledged === true && alertCurrent(alert);
    const originalId = alert.id, originalLinked = [...(Array.isArray(alert.linkedIds) ? alert.linkedIds : [])];
    const ids = [...new Set([originalId, ...originalLinked])];
    return mutateReminderStorage(authority, context => {
      if (!alertCurrent(alert)) return false;
      const linked = Array.isArray(alert.linkedIds) ? alert.linkedIds : [];
      if (alert.id !== originalId || linked.length !== originalLinked.length
        || linked.some((id, index) => id !== originalLinked[index])) return false;
      for (const id of ids) if (!markSeenId(id, context, authority)) return false;
      return cleanupStaleSeenKeys(context, authority);
    });
  }

  function clearIdentity() {
    state.currentUserId = '';
    state.currentDisplayName = '';
    state.currentRole = '';
    state.identityPrincipal = null;
  }

  function captureIdentityAuthority() {
    const sequence=state.pollSequence,generation=state.authorityGeneration,deviceId=state.deviceId;
    let principal;
    try { principal=window.MemphisMobile?.principalIdentity?.(); } catch { return null; }
    const current=()=>{
      if(sequence!==state.pollSequence||generation!==state.authorityGeneration||deviceId!==state.deviceId)return false;
      let live;try{live=window.MemphisMobile?.principalIdentity?.();}catch{return false;}
      // A protected read can synchronously dispatch a security transition.
      return live===principal&&sequence===state.pollSequence&&generation===state.authorityGeneration&&deviceId===state.deviceId;
    };
    return current()?{principal,deviceId,current}:null;
  }

  async function resolveIdentity(deviceId) {
    if (!deviceId) return null;
    // Fetch into a local value only. The originating authority must still own
    // the result before any shared identity field is committed.
    const data = await fetchJson(`/me/by-device?device_id=${encodeURIComponent(deviceId)}`);
    if (!data || typeof data !== 'object' || Array.isArray(data)
      || typeof data.display_name !== 'string' || !data.display_name.trim()
      || data.msg_user_id != null && typeof data.msg_user_id !== 'string'
      || data.role != null && typeof data.role !== 'string') throw new Error('Reminder identity response malformed.');
    return data;
  }

  function commitIdentity(data, token) {
    const currentUserId=safeText(data?.msg_user_id),currentDisplayName=safeText(data?.display_name),
      currentRole=safeText(data?.role).toLowerCase();
    if(!token?.current())return false;
    Object.assign(state,{currentUserId,currentDisplayName,currentRole,identityPrincipal:token.principal});
    return true;
  }

  async function fetchLocationStatusReminders() {
    if (!state.deviceId) return [];
    const data = await fetchJson(`/device-location-status-reminders?device_id=${encodeURIComponent(state.deviceId)}&limit=5`);
    if (!Array.isArray(data) || data.some(row => !row || typeof row !== 'object' || Array.isArray(row)
      || !['due_soon', 'overdue'].includes(row.status_code))) throw new Error('Location reminder response malformed.');
    return data;
  }

  async function fetchThreads() {
    if(window.MemphisMobile?.releaseCapabilities?.messenger===false)return [];
    if (!state.currentUserId) return [];
    const qs = `?user_id=${encodeURIComponent(state.currentUserId)}${state.deviceId ? `&device_id=${encodeURIComponent(state.deviceId)}` : ''}`;
    const data = await fetchJson(`/threads${qs}`);
    if (!Array.isArray(data) || data.some(row => !row || typeof row !== 'object' || Array.isArray(row)))
      throw new Error('Reminder thread response malformed.');
    return data;
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

  function locationStatusAlert(row) {
    const scope=window.MemphisMobile?.principalIdentity?.();
    const boundRow=JSON.parse(JSON.stringify(row||{}));
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
      : 'is getting close to its next cleaning time.';
    const notificationKey = safeText(row?.notification_key, `location-status:${serviceDate}:${locationCode}:${statusCode}`);
    const ordinaryAlert={
      id: notificationKey,
      notificationKey,
      notificationType: 'location_status',
      currentAuthority:window.MemphisCustodialSecurity?.native===true||window.MemphisMobileBuildIdentity?.edition==='custodial'
        ?()=>window.MemphisMobile?.isScheduleReminderCurrent?.(boundRow,scope)===true:null,
      linkedIds: [],
      kicker,
      title,
      body: `${locationName}${groupSuffix} in your current areas ${timing}`,
      openLabel: 'Open schedule',
      dismissLabel: 'Dismiss',
      openUrl: buildScheduleUrl(row),
      speakerName,
      speechText: isOverdue
        ? `${lead}${locationName} is overdue and needs attention now.`
        : `${lead}${locationName} is due soon. Please check it soon.`
    };
    if(nativeApplicationSource)try{ordinaryAlertOrigins.set(ordinaryAlert,nativeApplicationSource.copyOriginalTypedRenderData({
      producer:'NORMAL_LOCATION_POLL_ROW_NOT_SETTLEMENT',principal:scope,data:boundRow,notification_key:notificationKey,receipt_eligible:false}));}
    catch{/* Passive DATA failure never changes the original poll alert. */}
    return ordinaryAlert;
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

  function displayThreadTitle(row) {
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

  function fullyKioskNudge(alert) {
    if(alert.boundReceiptAction?.providerMirror===true){providerKioskNudge(alert);return;}
    const rawText = safeText(alert?.speechText, 'New Memphis notification.');
    const text = normalizePersonalizedSpeechText(rawText, alert?.speakerName || state.currentDisplayName);
    // Notification audio never changes display sleep or launches a surface.
    // The existing pending card remains for the owner's later manual wake.
    try { if (window.fully?.vibrate) window.fully.vibrate(650); } catch (_err) {}
    try { navigator.vibrate?.([350, 150, 350]); } catch (_err) {}
    state.activeAudioAlert = alert;
    const sequence = sourceWriter('REMINDER_580',async()=>{
      if (alert.boundReceiptAction?.beginAudio && !await alert.boundReceiptAction.beginAudio()) return false;
      if (!alertCurrent(alert)) return false;
      const completed=await startAlertAudioSequence(text);
      await alert.boundReceiptAction?.finishAudio?.(completed===true);
      return completed;
    },true)().catch(sourceWriter('REMINDER_586',(error) => {
      console.warn('Memphis alert audio sequence failed', error);
    }));
    state.activeSequencePromise = sequence;
    sequence.finally(sourceWriter('REMINDER_590',() => {
      if (state.activeSequencePromise === sequence) {
        state.activeSequencePromise = null;
        if (state.activeAudioAlert === alert) state.activeAudioAlert = null;
        if (state.activeAlert !== alert) clearLunchCutoff(alert);
      }
      if (!state.activeAlert) window.setTimeout(() => poll().catch(() => {}), 250);
    }));
  }

  // Native mirrors use this SAME renderer/sequence state. Nothing audible or
  // tactile precedes the original native durable audio claim/readback.
  function providerKioskNudge(alert){
    if(alert.boundReceiptAction.playAudio!==true)return;
    state.activeAudioAlert=alert;
    const sequence=sourceWriter('REMINDER_605',async()=>{
      if(!await alert.boundReceiptAction.beginAudio()||!alertCurrent(alert))return false;
      // Exact native audio admission is not permission to wake the display.
      // Keep its current sleep state; manual wake must not replay this episode.
      try{window.fully?.vibrate?.(650);}catch{}
      try{navigator.vibrate?.([350,150,350]);}catch{}
      const text=normalizePersonalizedSpeechText(safeText(alert.speechText),alert.speakerName||state.currentDisplayName);
      const completed=await startAlertAudioSequence(text);
      await alert.boundReceiptAction.finishAudio(completed===true);return completed;
    },true)().catch(()=>false);
    state.activeSequencePromise=sequence;
    sequence.finally(sourceWriter('REMINDER_616',()=>{
      if(state.activeSequencePromise===sequence){state.activeSequencePromise=null;if(state.activeAudioAlert===alert)state.activeAudioAlert=null;}
      window.MemphisMobile?.retryProviderMirror?.();
    }));
  }
  async function stopProviderAudioAndReadback(expected){
    const active=state.activeAudioAlert||state.activeAlert;
    // Never cancel an unrelated legacy/help/debug producer to acquire the lane.
    if(active&&active.boundReceiptAction?.providerMirror!==true)return false;
    if(expected&&active&&active.boundReceiptAction!==expected)return false;
    if(state.activeOscillators.length)return false; // Legacy WebAudio/debug has no provider capability.
    if(active){
      if(!expected&&state.activeAlert===active)closeActiveAlert({stopSpeech:true,nextPresentation:false});
      else stopAlertAudio();
    }
    await Promise.resolve();
    const speech=window.speechSynthesis;
    // cancel/void Fully calls are not silence receipts. Observe this WebView
    // engine and owned HTML audio; unknown properties keep the barrier closed.
    return Boolean(speech&&speech.speaking===false&&speech.pending===false
      &&(!state.audioEl||state.audioEl.paused===true)&&!state.sequenceTone&&!state.browserSpeech
      &&state.activeOscillators.length===0&&state.ringTimeouts.length===0&&!state.activeSequencePromise&&!state.activeSpeechPromise);
  }

  function clearPendingRingtoneRepeats() {
    while (state.ringTimeouts.length) {
      const handle=state.ringTimeouts.pop();
      window.clearTimeout(handle);
      const settle=state.ringWaitResolvers?.get(handle);
      state.ringWaitResolvers?.delete(handle);
      settle?.(false);
    }
  }

  function stopActiveSpeech() {
    try { window.fully?.stopTextToSpeech?.(); } catch (_err) {}
    try { window.speechSynthesis?.cancel?.(); } catch (_err) {}
    state.browserSpeech?.finish(false);
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
    state.sequenceTone?.finish(false);
  }

  function queueAlertStep(callback, delayMs) {
    const timeoutId = window.setTimeout(sourceWriter('REMINDER_674',() => {
      const index = state.ringTimeouts.indexOf(timeoutId);
      if (index >= 0) state.ringTimeouts.splice(index, 1);
      callback();
    }), delayMs);
    state.ringTimeouts.push(timeoutId);
    return timeoutId;
  }

  function waitForAlertStep(delayMs) {
    state.ringWaitResolvers ||= new Map();
    return new Promise(resolve=>{
      const handle=queueAlertStep(()=>{state.ringWaitResolvers.delete(handle);resolve(true);},delayMs);
      state.ringWaitResolvers.set(handle,resolve);
    });
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
        const finish = sourceWriter('REMINDER_701',(value) => {
          if (settled) return;
          settled = true;
          if(state.browserSpeech?.utterance===utterance)state.browserSpeech=null;
          resolve(value);
        });
        state.browserSpeech={utterance,finish};
        utterance.onend = () => finish(true);
        utterance.onerror = () => finish(false);
        window.speechSynthesis.cancel?.();
        window.speechSynthesis.speak(utterance);
      } catch (_err) {
        state.browserSpeech=null;
        resolve(false);
      }
    });
  }

  async function speakOnce(text) {
    const normalized = safeText(text);
    if (!normalized) return false;
    // Fully textToSpeech is a void call; broadcast ttsTextQueued/Done IDs are
    // not an issuing-call token. Do not infer this utterance completed from
    // another producer or a timer. Fully still owns kiosk/volume policy; an
    // unavailable exact WebView utterance callback leaves audio incomplete.
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
    if(state.activeSequencePromise||state.sequenceTone)return;
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
      source.onended = sourceWriter('REMINDER_945',() => {
        const sourceIndex = state.activeOscillators.indexOf(source);
        if (sourceIndex >= 0) state.activeOscillators.splice(sourceIndex, 1);
        try { source.disconnect?.(); } catch (_err) {}
      });
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
    const token = Number(state.alertSequenceToken || 0) + 1;
    state.alertSequenceToken = token;
    for (let cycle = 0; cycle < 2; cycle += 1) {
      if (state.alertSequenceToken !== token) return;
      if (!await playSequenceTone()) return false;
      if (!await waitForAlertStep(CONFIG.ALERT_POST_RINGTONE_DELAY_MS)) return false;
      if (state.alertSequenceToken !== token) return;
      stopActiveRingtone();
      const speech = speakOnce(normalized);
      state.activeSpeechPromise = speech;
      const spoken=await speech;
      if (state.activeSpeechPromise === speech) state.activeSpeechPromise = null;
      if(spoken!==true)return false;
      if (state.alertSequenceToken !== token) return;
      if (cycle === 0 && !await waitForAlertStep(CONFIG.VOICE_REPEAT_GAP_MS)) return;
    }
    return true;
  }

  function playSequenceTone() {
    // HTML ended/error observes this exact waveform's playback. The old debug
    // fallback's timer/void Fully call cannot establish tone completion.
    return new Promise(resolve=>{
      let audio;
      try { audio=new Audio(ensureRingtoneDataUrl()); } catch { resolve(false);return; }
      const pending={finish:sourceWriter('REMINDER_1018',value=>{
        if(state.sequenceTone!==pending)return;
        state.sequenceTone=null;
        audio.onended=null;audio.onerror=null;
        resolve(value);
      })};
      state.sequenceTone=pending;state.audioEl=audio;audio.volume=1;
      audio.onended=()=>pending.finish(true);
      audio.onerror=()=>pending.finish(false);
      try {
        const started=audio.play();
        if(started?.catch)started.catch(()=>pending.finish(false));
      } catch { pending.finish(false); }
    });
  }

  async function waitForActiveAlertSpeech() {
    const active = state.activeSequencePromise || state.activeSpeechPromise;
    if (!active) {
      await new Promise((resolve) => window.setTimeout(resolve, CONFIG.ALERT_OPEN_GRACE_MS));
      return;
    }
    await Promise.resolve(active).catch(() => null);
    await new Promise((resolve) => window.setTimeout(resolve, CONFIG.ALERT_POST_SPEECH_DELAY_MS));
  }

  function stopAlertAudio(alert) {
    if (alert && state.activeAudioAlert !== alert) return;
    if(state.activeAlert!==state.activeAudioAlert)clearLunchCutoff(state.activeAudioAlert);
    state.alertSequenceToken += 1;
    clearPendingRingtoneRepeats();
    stopActiveRingtone();
    stopActiveSpeech();
    state.activeSpeechPromise = null;
    state.activeSequencePromise = null;
    state.activeAudioAlert = null;
  }

  function closeActiveAlert(options = {}) {
    const closed=state.activeAlert;
    state.activeAlert?.boundReceiptAction?.retire?.();
    const releasePresentation = state.activeAlert?.releasePresentation;
    const stopSpeech = options.stopSpeech !== false;
    if (stopSpeech) {
      stopAlertAudio();
    }
    // Visual Dismiss leaves both required audio cycles intact.
    document.querySelector('.mz-reminder-backdrop')?.remove();
    setReminderPresentationActive(false);
    state.activeAlert = null;
    if(state.activeAudioAlert!==closed)clearLunchCutoff(closed);
    sessionStorage.removeItem(CONFIG.ALERT_LOCK_KEY);
    releasePresentation?.();
    if(options.nextPresentation!==false)void window.MemphisMobile?.retryNotificationPresentation?.();
  }

  function alertCurrent(alert){
    if(alert?.boundReceiptAction&&!alert.boundReceiptAction.isCurrent())return false;
    return typeof alert?.currentAuthority!=='function'||alert.currentAuthority()===true;
  }
  function hasLunchCutoff(alert){return alert?.notificationType==='lunch_coverage'
    &&alert.boundReceiptAction?.providerMirror!==true&&typeof alert.originalLunchCutoff==='string';}
  function clearLunchCutoff(alert){
    const timer=alert?.lunchCutoffTimer;if(timer==null)return;alert.lunchCutoffTimer=null;
    try{window.clearTimeout(timer);}catch{}
  }
  function armLunchCutoff(alert){
    clearLunchCutoff(alert);
    if(!hasLunchCutoff(alert)||state.detached||state.activeAlert!==alert&&state.activeAudioAlert!==alert)return;
    // Original UTC cutoff is a wake hint only, never replacement currentness
    // or native clock/claim proof. Round up, not down, at submillisecond bounds.
    const m=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(alert.originalLunchCutoff);
    if(!m)return;const fraction=(m[2]||'').padEnd(6,'0'),text=m[1]+'.'+fraction.slice(0,3)+'Z';
    const millis=Date.parse(text),now=Date.now();
    if(!Number.isFinite(millis)||!Number.isFinite(now)||new Date(millis).toISOString()!==text)return;
    const deadline=millis+(fraction.slice(3)==='000'?0:1);if(deadline<=now){recheckLunchCutoff(alert,false);return;}
    const timer=window.setTimeout(sourceWriter('REMINDER_1094',()=>{
      if(alert.lunchCutoffTimer!==timer)return;alert.lunchCutoffTimer=null;recheckLunchCutoff(alert);
    }),Math.min(2147483647,deadline-now));
    alert.lunchCutoffTimer=timer;
    if(state.detached||state.activeAlert!==alert&&state.activeAudioAlert!==alert)clearLunchCutoff(alert);
  }
  function recheckLunchCutoff(alert,rearm=true){
    if(!hasLunchCutoff(alert)||state.detached||state.activeAlert!==alert&&state.activeAudioAlert!==alert)return;
    let current=false;try{current=alertCurrent(alert);}catch{}
    if(state.detached||state.activeAlert!==alert&&state.activeAudioAlert!==alert){clearLunchCutoff(alert);return;}
    if(current){if(rearm)armLunchCutoff(alert);return;}
    if(state.activeAlert===alert)closeActiveAlert({stopSpeech:state.activeAudioAlert===alert});
    if(state.activeAudioAlert===alert)stopAlertAudio(alert);
    clearLunchCutoff(alert);
  }
  function recheckOwnedLunchCutoffs(){
    const visual=state.activeAlert,audio=state.activeAudioAlert;
    recheckLunchCutoff(visual);if(audio!==visual)recheckLunchCutoff(audio);
  }
  function reconcileScheduleAuthority(invalidatePolls=true){
    if(invalidatePolls)state.authorityGeneration++;
    const visual=state.activeAlert,audio=state.activeAudioAlert;
    if(visual&&!alertCurrent(visual))closeActiveAlert({stopSpeech:true});
    if(audio&&!alertCurrent(audio))stopAlertAudio(audio);
    armLunchCutoff(state.activeAlert);if(state.activeAudioAlert!==state.activeAlert)armLunchCutoff(state.activeAudioAlert);
    return (!state.activeAlert||alertCurrent(state.activeAlert))&&(!state.activeAudioAlert||alertCurrent(state.activeAudioAlert));
  }
  function showAlert(alert, owned = false) {
    if(state.detached||document.hidden===true)return false;
    if (!owned && window.MemphisMobile?.nativeNotifications === true) return false;
    if (!alertCurrent(alert)) return false;
    if (!alert?.id || state.activeAlert || state.activeSequencePromise || state.activeSpeechPromise || document.querySelector('.mz-reminder-backdrop') || (!alert.boundReceiptAction && hasSeenId(alert.id))) return false;
    if (!owned && window.MemphisMobile?.presentBrowserNotification) {
      return window.MemphisMobile.presentBrowserNotification(alert.notificationKey || alert.id,
        releasePresentation => {
          const originalContinuation={...alert,releasePresentation};
          // SAME function-created normal clone receives only an existing
          // private origin. No supplied marker/callback can mint an origin.
          if(nativeApplicationSource)try{const origin=ordinaryAlertOrigins.get(alert);
            if(origin!==undefined)ordinaryAlertOrigins.set(originalContinuation,origin);
          }catch{/* DATA unavailable; original normal continuation still runs. */}
          return showAlert(originalContinuation,true);
        });
    }
    const writerAuthority = captureReminderWriterAuthority(state.deviceId, true);
    if (!alert.boundReceiptAction && !writerAuthority) return false;
    const writerAlertId = alert.id, writerLinkedIds = JSON.stringify(alert.linkedIds || []);
    let alreadyPresented = false;
    try { alreadyPresented = sessionStorage.getItem(CONFIG.ALERT_LOCK_KEY) === alert.id; } catch {}
    state.activeAlert = alert;
    injectStyles();
    setReminderPresentationActive(true);
    sessionStorage.setItem(CONFIG.ALERT_LOCK_KEY, alert.id);

    const backdrop = document.createElement('div');
    backdrop.className = 'mz-reminder-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('data-notification-key', alert.notificationKey || alert.id);
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

    let providerOpening=false,providerDismissing=false,providerAcknowledging=false,providerAcknowledge=null;
    function recipientCurrent() {
      try { return alertCurrent(alert) && (alert.boundReceiptAction || writerAuthority?.current() === true
        && alert.id === writerAlertId && JSON.stringify(alert.linkedIds || []) === writerLinkedIds); }
      catch { return false; }
    }
    function pendingSeenWrite() {
      if (!recipientCurrent()) { closeActiveAlert({stopSpeech:true}); return; }
      backdrop.querySelector('.mz-reminder-body').textContent =
        'Local notification action unconfirmed — reminder remains pending. ' + safeText(alert.body);
    }
    function refreshProviderView(){
      if(alert.boundReceiptAction?.providerMirror!==true||state.activeAlert!==alert)return;
      const observed=alert.boundReceiptAction.presentationState();
      const prefix=observed.freshness==='CURRENT'?'':observed.freshness==='HISTORICAL_EXPIRED'
        ?'Expired notice — current responsibility is not confirmed. '
        :'Notice freshness unavailable — current responsibility is not confirmed. ';
      // Relabel this existing visual only. Immutable speech text, audio episode,
      // displayed receipt and original notification identity are untouched.
      backdrop.querySelector('.mz-reminder-body').textContent=prefix+safeText(alert.body,'You have a new Memphis notification.');
      backdrop.setAttribute('data-native-freshness',observed.freshness);
      const busy=providerOpening||providerDismissing||providerAcknowledging;
      backdrop.querySelector('.mz-reminder-open').disabled=busy||!(observed.freshness==='CURRENT'||observed.navigation_pending);
      backdrop.querySelector('.mz-reminder-dismiss').disabled=busy;
      if(providerAcknowledge)providerAcknowledge.disabled=busy||observed.freshness!=='CURRENT';
    }

    backdrop.querySelector('.mz-reminder-open').addEventListener('click', sourceWriter('REMINDER_1198',async () => {
      if(state.activeAlert!==alert)return;
      if(!recipientCurrent()){closeActiveAlert({stopSpeech:true});return;}
      const openButton = backdrop.querySelector('.mz-reminder-open');
      const dismissButton = backdrop.querySelector('.mz-reminder-dismiss');
      if(openButton?.disabled)return;
      providerOpening=true;
      if (openButton) { openButton.disabled = true; openButton.textContent = 'Opening after reminder…'; }
      if (dismissButton) dismissButton.disabled = true;
      let acknowledged;
      try{acknowledged=await acknowledgeAlert(alert, 'opened');}
      catch{
        if(state.activeAlert!==alert)return;
        if(!recipientCurrent())closeActiveAlert({stopSpeech:true});
        else { providerOpening=false;if(openButton){openButton.disabled=false;openButton.textContent=safeText(alert.openLabel,'Open');} if(dismissButton)dismissButton.disabled=false;refreshProviderView(); }
        return;
      }
      if(state.activeAlert!==alert)return;
      if(!recipientCurrent()||alert.boundReceiptAction&&acknowledged!==true){
        if(state.activeAlert===alert&&!recipientCurrent())closeActiveAlert({stopSpeech:true});
        else { providerOpening=false;if(openButton){openButton.disabled=false;openButton.textContent=safeText(alert.openLabel,'Open');} if(dismissButton)dismissButton.disabled=false;refreshProviderView(); }
        return;
      }
      const seen = await markAlertSeenIfAcknowledged(alert, acknowledged, writerAuthority);
      if (state.activeAlert !== alert) return;
      if (!seen) {
        providerOpening=false;
        if(openButton){openButton.disabled=false;openButton.textContent=safeText(alert.openLabel,'Open');}
        if(dismissButton)dismissButton.disabled=false;
        refreshProviderView();
        pendingSeenWrite();
        return;
      }
      const destination = alert.openUrl || buildMessagesUrl();
      await waitForActiveAlertSpeech();
      if(state.activeAlert!==alert)return;
      if(alert.boundReceiptAction?.providerMirror===true&&await alert.boundReceiptAction.recheck()!==true){
        if(state.activeAlert===alert)closeActiveAlert({stopSpeech:true});return;
      }
      if(state.activeAlert!==alert)return;
      if(!recipientCurrent()){
        if(state.activeAlert===alert)closeActiveAlert({stopSpeech:true});
        return;
      }
      closeActiveAlert({ stopSpeech: false, nextPresentation:false });
      window.location.href = destination;
    },true));
    backdrop.querySelector('.mz-reminder-dismiss').addEventListener('click', sourceWriter('REMINDER_1245',async () => {
      if(state.activeAlert!==alert)return;
      if(!recipientCurrent()){closeActiveAlert({stopSpeech:true});return;}
      const openButton=backdrop.querySelector('.mz-reminder-open');
      const dismissButton=backdrop.querySelector('.mz-reminder-dismiss');
      if(dismissButton?.disabled)return;
      providerDismissing=true;
      if(openButton)openButton.disabled=true;
      if(dismissButton)dismissButton.disabled=true;
      let acknowledged;
      try { acknowledged=await acknowledgeAlert(alert, 'dismissed'); } catch { acknowledged=false; }
      if(state.activeAlert!==alert)return;
      if(!recipientCurrent()){closeActiveAlert({stopSpeech:true});return;}
      if(alert.boundReceiptAction&&acknowledged!==true){
        providerDismissing=false;
        if(openButton)openButton.disabled=false;
        if(dismissButton)dismissButton.disabled=false;
        refreshProviderView();
        return;
      }
      const seen = await markAlertSeenIfAcknowledged(alert, acknowledged, writerAuthority);
      if (state.activeAlert !== alert) return;
      if (!seen) {
        providerDismissing=false;
        if(openButton)openButton.disabled=false;
        if(dismissButton)dismissButton.disabled=false;
        refreshProviderView();
        pendingSeenWrite();
        return;
      }
      // Dismiss the card immediately, but let the current spoken sentence finish.
      closeActiveAlert({ stopSpeech: false });
    },true));

    document.body.appendChild(backdrop);
    alert.boundReceiptAction?.onRetire?.(sourceWriter('REMINDER_1280',(options) => {
      const stopAudio=alert.boundReceiptAction?.providerMirror!==true||options?.stopAudio!==false;
      if (state.activeAlert === alert) closeActiveAlert({stopSpeech:stopAudio});
      if(stopAudio)stopAlertAudio(alert); // Dismiss may have hidden this card while audio continued.
      // Never remove a successor or report a still-visible old card retired.
      return state.activeAlert !== alert && (!stopAudio||state.activeAudioAlert !== alert)
        && document.querySelector('.mz-reminder-backdrop') !== backdrop;
    }));
    if(alert.boundReceiptAction?.providerMirror===true){
      alert.boundReceiptAction.onOpen(sourceWriter('REMINDER_1289',()=>backdrop.querySelector('.mz-reminder-open')?.click()));
      const acknowledge=document.createElement('button');acknowledge.type='button';acknowledge.className='mz-reminder-btn mz-reminder-acknowledge';acknowledge.textContent='Acknowledge';
      providerAcknowledge=acknowledge;
      acknowledge.addEventListener('click',sourceWriter('REMINDER_1292',async()=>{
        if(acknowledge.disabled||state.activeAlert!==alert||!alertCurrent(alert))return;providerAcknowledging=true;acknowledge.disabled=true;
        let saved=false;try{saved=await alert.boundReceiptAction('acknowledged');}catch{}
        if(state.activeAlert!==alert)return;
        if(saved===true)closeActiveAlert({stopSpeech:true});else{providerAcknowledging=false;acknowledge.disabled=false;refreshProviderView();}
      },true));
      backdrop.querySelector('.mz-reminder-actions').appendChild(acknowledge);
      alert.boundReceiptAction.onState(sourceWriter('REMINDER_1299',refreshProviderView));
    }
    if(!alert.boundReceiptAction)acknowledgeAlert(alert, 'displayed');
    if (!alreadyPresented||alert.boundReceiptAction?.providerMirror===true) fullyKioskNudge(alert);
    armLunchCutoff(alert);
    return true;
  }

  function showAcceptedNotification(event, boundReceiptAction) {
    const notification=event?.notification||{},data=notification.data||{};
    if(!data.notification_key)return false;
    const requiredKind=data.kind==='employee_event'?'event':data.kind==='employee_message'?'message':null;
    if(requiredKind){
      // Only the native-owned claim path can supply these protocols. Legacy
      // unbound FCM/poll notices do not become admitted through a UI flag.
      const sourceId=data[requiredKind==='event'?'event_id':'thread_id'];
      const route=requiredKind==='event'?`events.html?hub=employee&event_id=${sourceId}`:`messages.html?hub=employee&thread_id=${sourceId}`;
      if(typeof boundReceiptAction!=='function'||boundReceiptAction.providerMirror!==true
        ||data.schema!==`custodial.native-${requiredKind}-payload.v1`||data.notification_type!==requiredKind
        ||typeof sourceId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(sourceId)||data.route!==route)return false;
      const body=safeText(notification.body);
      if(!body)return false;
      return showAlert({id:data.notification_key,notificationKey:data.notification_key,notificationType:requiredKind,boundReceiptAction,
        kicker:requiredKind==='event'?'Event reminder':'Message',title:safeText(notification.title,'Memphis Zoo'),body,
        openLabel:requiredKind==='event'?'Open event':'Open message',dismissLabel:'Dismiss',openUrl:new URL(route,window.location.href).toString(),
        speakerName:state.currentDisplayName,speechText:body},true);
    }
    if(data.kind==='employee_schedule_ownership'){
      if(typeof boundReceiptAction!=='function'||boundReceiptAction.providerMirror!==true
        ||data.schema!=='custodial.native-schedule-payload.v1'||data.notification_type!=='schedule_ownership'
        ||data.channel_id!=='employee-schedule-ownership'||data.route!=='employee-schedule.html?hub=employee')return false;
      const body=safeText(notification.body);if(!body)return false;
      return showAlert({id:data.notification_key,notificationKey:data.notification_key,title:safeText(notification.title,'Memphis Zoo'),body,
        notificationType:'schedule_ownership',boundReceiptAction,kicker:'Assignment update',
        openLabel:'Open schedule',dismissLabel:'Dismiss',openUrl:new URL(data.route,window.location.href).toString(),
        speakerName:state.currentDisplayName,speechText:body},true);
    }
    const ordinaryAlert=acceptedRecurringAlert(notification,data,boundReceiptAction);
    return ordinaryAlert?showAlert(ordinaryAlert,true):false;
  }

  function acceptedRecurringAlert(notification,data,boundReceiptAction){
    if(!['employee_lunch_coverage','employee_location_status'].includes(data.kind))return false;
    const lunch=data.kind==='employee_lunch_coverage';
    const body=safeText(notification.body,'Please check your schedule.');
    const scope=window.MemphisMobile?.principalIdentity?.(),original=JSON.parse(JSON.stringify(data));
    if(lunch&&boundReceiptAction?.providerMirror!==true){
      const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
      freeze(original);
    }
    // Native mirror leases carry their own freshness contract. An accepted
    // START adds only a confirmed old-cycle retirement; missing/offline
    // observations do not relabel or withdraw a native-owned notice.
    // Ordinary JS presentation uses the exact original accepted payload/scope.
    // This is not a substitute for a native mirror's claim/clock authority.
    const currentAuthority=lunch?(boundReceiptAction?.providerMirror===true?null:()=>{
      try{return window.MemphisMobile?.isLunchNotificationCurrent?.(original,scope)===true;}
      catch{return false;}
    }):()=>{
      try{return window.MemphisMobile?.isLocationReminderRetired?.(original,scope)!==true;}
      catch{return true;}
    };
    const ordinaryAlert={id:data.notification_key,notificationKey:data.notification_key,
      notificationType:lunch?'lunch_coverage':'location_status',boundReceiptAction,currentAuthority,
      originalLunchCutoff:lunch&&boundReceiptAction?.providerMirror!==true?original.valid_until:undefined,
      kicker:lunch?'Lunch coverage':'Schedule reminder',title:safeText(notification.title,'Memphis Zoo'),body,
      openLabel:'Open schedule',dismissLabel:'Dismiss',openUrl:boundReceiptAction?.providerMirror===true?new URL(data.route,window.location.href).toString():buildScheduleUrl(data),
      speakerName:state.currentDisplayName,speechText:body};
    if(nativeApplicationSource)try{ordinaryAlertOrigins.set(ordinaryAlert,nativeApplicationSource.copyOriginalTypedRenderData({
      producer:'NORMAL_ACCEPTED_NOTIFICATION_NOT_SETTLEMENT',principal:scope,data:original,notification_key:data.notification_key,receipt_eligible:false}));}
    catch{/* Original renderer behavior is unchanged when passive DATA is unavailable. */}
    return ordinaryAlert;
  }

  function completeOrdinaryExpectedPlan(selector){
    let plan;try{plan=nativeApplicationSource.readOrdinaryExpectedPlan(selector);}
    catch{return {schema:'custodial.normal-expected-notification-plan-unavailable.v1',complete:false,receipt_eligible:false};}
    const derived=[];
    for(let effectIndex=0;effectIndex<plan.required_effects.length;effectIndex++){
      const effect=plan.required_effects[effectIndex];
      const alert=effect.origin==='FULL_ACCEPTED_LUNCH_DOCUMENT'
        ?acceptedRecurringAlert(effect.notification,effect.notification?.data||{},null):effect.origin==='EXHAUSTIVE_NORMAL_CURRENT_LOCATION_CYCLES'
          ?locationStatusAlert(effect.data):null;
      if(!alert||alert.notificationKey!==effect.notification_key)throw Error('Normal complete-plan derivation unavailable');
      // Full source enumeration, independent of active/presented subset. No
      // showAlert, timer, audio, provider, ACK or reconciliation is invoked.
      derived.push({notification_key:alert.notificationKey,notification_type:alert.notificationType,
        kicker:alert.kicker,title:alert.title,body:alert.body,open_label:alert.openLabel,dismiss_label:alert.dismissLabel,
        open_url:alert.openUrl,speech_text:alert.speechText,speaker_name:alert.speakerName??null,required_audio:true});
    }
    return {...plan,normal_derivation:{schema:'custodial.normal-complete-notification-derivation.v1',
      producer:'SAME_NORMAL_LOCATION_AND_ACCEPTED_RENDERER_FORMATTERS_NOT_OBSERVED_SUBSET',effects:derived}};
  }

  function pickNextAlert({ locationStatuses = [], threads = [] }) {
    const unseenLocationStatus = locationStatuses
      .map(locationStatusAlert)
      .filter(alertCurrent)
      .find((alert) => !hasSeenId(alert.id));
    if (unseenLocationStatus) return unseenLocationStatus;

    const unseenThread = threads
      .filter((row) => Number(row?.unread_count || 0) > 0)
      .filter((row) => safeText(row?.last_message_id))
      .filter((row) => safeText(row?.last_sender_name).toLowerCase() !== state.currentDisplayName.toLowerCase())
      .map(threadAlert)
      .find((alert) => !hasSeenId(alert.id));
    return unseenThread || null;
  }

  function currentAlertIds({ locationStatuses = [], threads = [] }) {
    const ids = locationStatuses.map(locationStatusAlert).filter(alertCurrent).map((alert) => alert.id);
    for (const row of threads) {
      if (Number(row?.unread_count || 0) <= 0 || !safeText(row?.last_message_id)) continue;
      if (safeText(row?.last_sender_name).toLowerCase() === state.currentDisplayName.toLowerCase()) continue;
      const alert=threadAlert(row);if(alertCurrent(alert))ids.push(alert.id);
    }
    return new Set(ids.filter(Boolean));
  }

  async function poll() {
    if(state.detached)return;
    const sequence=++state.pollSequence;
    let principal;try{principal=window.MemphisMobile?.principalIdentity?.();}catch{return;}
    await window.MemphisMobile?.retryNotificationPresentation?.();
    try{if(sequence!==state.pollSequence||principal!==window.MemphisMobile?.principalIdentity?.())return;}catch{return;}
    // Startup presentation reconciliation can legitimately advance generation.
    // Bind identity transport only AFTER that work settles for this same poll.
    const token=captureIdentityAuthority();
    if(!token||sequence!==state.pollSequence||principal!==token.principal)return;
    const {current}=token;
    reconcileScheduleAuthority(false);
    if (window.MemphisMobile?.nativeNotifications === true) return;
    try {
      if(state.identityPrincipal!==token.principal)clearIdentity();
      if (!state.currentUserId) {
        const identity=await resolveIdentity(token.deviceId);
        if(!commitIdentity(identity,token))return;
      }
      if(!current())return;
      const [locationStatuses, threads] = await Promise.all([fetchLocationStatusReminders(), fetchThreads()]);
      if(!current())return;
      if (window.MemphisMobile?.nativeNotifications === true) return;
      // Recheck after transport: main's authenticated accepted-session read
      // owns the observation, including native mode. Due/overdue candidate
      // rows and their absence cannot be promoted into accepted START proof.
      reconcileScheduleAuthority(false);
      const available = currentAlertIds({ locationStatuses, threads });
      if(!current())return;
      if (state.activeAlert && !state.activeAlert.boundReceiptAction && !String(state.activeAlert.id || '').startsWith('debug:') && !available.has(state.activeAlert.id)) {
        closeActiveAlert({ stopSpeech: true });
      }
      const next = pickNextAlert({ locationStatuses, threads });
      if (next&&current()) showAlert(next);
    } catch (error) {
      if (!pendingTransportFailures.has(error)) console.warn('Memphis device reminder poll failed', error);
    }
  }

  function runDebugTriggers() {
    const url = new URL(window.location.href);
    const testReminder = String(url.searchParams.get('testReminder') || '').trim().toLowerCase();
    const testRing = String(url.searchParams.get('testRing') || '').trim().toLowerCase();
    const repeatCount = Math.max(1, Number(url.searchParams.get('repeatCount')) || CONFIG.RINGTONE_REPEAT_COUNT);
    if (testReminder === '1' || testReminder === 'true' || testReminder === 'yes') {
      window.setTimeout(sourceWriter('REMINDER_1464',async () => {
        const token=captureIdentityAuthority();if(!token)return;
        const identity=await resolveIdentity(token.deviceId).catch(() => null);
        if(commitIdentity(identity,token)&&token.current())showAlert(debugReminderAlert());
      },true), 900);
    }
    if (testRing === '1' || testRing === 'true' || testRing === 'yes') {
      window.setTimeout(() => {
        playRingtone({ repeatCount });
      }, 900);
    }
  }


  // Read-only raw owner DATA. Opaque work/functions/getters remain UNKNOWN;
  // no promise fulfillment, empty count or Boolean is a settlement receipt.
  const reminderOwnKeys=Reflect.ownKeys,reminderDescriptor=Object.getOwnPropertyDescriptor;
  function snapshotReminderState() {
    const result={__proto__:null,schema:'custodial.native-browser-reminder-state-data.v1',
      scope:'RAW_PENDING_ACTIVE_UNKNOWN_NOT_SETTLEMENT',receipt_eligible:false,properties:{__proto__:null},unknown:{__proto__:null}};
    let keys;try{keys=reminderOwnKeys(state);}catch{return {__proto__:null,schema:result.schema,state:'UNKNOWN',receipt_eligible:false};}
    if(keys.length>64)return {__proto__:null,schema:result.schema,state:'UNKNOWN_BOUND',receipt_eligible:false};
    let unknown=0,total=0;
    for(const key of keys) {
      if(typeof key!=='string'){result.unknown[String(unknown++)]='non_string_key';continue;}
      let descriptor;try{descriptor=reminderDescriptor(state,key);}catch{descriptor=null;}
      if(!descriptor||!('value' in descriptor)){result.unknown[key]='accessor_or_unreadable';unknown++;continue;}
      const value=descriptor.value,type=typeof value;
      if(value===null||type==='boolean'||type==='number'&&Number.isFinite(value))result.properties[key]=value;
      else if(type==='string') {
        total+=value.length;
        if(value.length>16384||total>65536){result.unknown[key]='string_bound';unknown++;}
        else result.properties[key]=value;
      } else if(Array.isArray(value)) {
        result.properties[key]={__proto__:null,kind:'array',length:value.length};
        // A pending array is never converted to an acknowledged/empty queue.
        if(value.length){result.unknown[key]='opaque_pending_array';unknown++;}
      } else {
        result.properties[key]={__proto__:null,kind:type,present:value!==undefined};
        result.unknown[key]='opaque_owner_value';unknown++;
      }
    }
    result.unknown_count=unknown;return result;
  }

  function snapshotOrdinaryReminderData(selector){
    if(!nativeApplicationSource||!selector||typeof selector.principal!=='string'||typeof selector.service_date!=='string')
      throw new Error('Native ordinary renderer DATA unavailable');
    const active=[];
    for(const [role,alert]of [['visual',state.activeAlert],['audio',state.activeAudioAlert]]){
      if(!alert)continue;
      const origin=ordinaryAlertOrigins.get(alert)??null;
      active.push({role,origin,notification_key:typeof alert.notificationKey==='string'?alert.notificationKey:null,
        notification_type:typeof alert.notificationType==='string'?alert.notificationType:null,
        native_origin_present:origin!==null,receipt_eligible:false});
    }
    // Presence/count is kept explicitly. No Promise/callback/AudioContext is
    // silently replaced with a false or an empty acknowledged queue.
    const length=value=>Array.isArray(value)&&Number.isSafeInteger(value.length)?value.length:null;
    return {schema:'custodial.native-reminder-ordinary-target-data.v1',receipt_eligible:false,
      scope:'SAME_NORMAL_RENDERER_ORIGIN_AND_LIFETIME_DATA_NOT_AUDIO_SETTLEMENT',selector,active,
      sequence_pending:state.activeSequencePromise!=null,speech_pending:state.activeSpeechPromise!=null,
      active_oscillators:length(state.activeOscillators),ring_timeouts:length(state.ringTimeouts),
      raw_owner_state:{...snapshotReminderState(),
        expected_plan:completeOrdinaryExpectedPlan(selector),
        browser_audio_lane:{scope:'SAME_NORMAL_BROWSER_LANE_NOT_NATIVE_AUDIO_SETTLEMENT',
          detached:state.detached===true,sequence_pending:state.activeSequencePromise!=null,
          speech_pending:state.activeSpeechPromise!=null,browser_speech_pending:state.browserSpeech!=null,
          sequence_tone_pending:state.sequenceTone!=null,audio_alert_present:state.activeAudioAlert!=null,
          html_audio_present:state.audioEl!=null,
          html_audio_paused:state.audioEl==null?true:state.audioEl.paused===true,
          active_oscillators:length(state.activeOscillators),ring_timeouts:length(state.ringTimeouts)}}};
  }

  async function init() {
    if (!isEmployeeNotificationContext()) return;
    state.deviceId = await resolveDeviceId();
    nativeApplicationSource?.requireReminderBirth();
    if (!state.deviceId) return;
    ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
      window.addEventListener(eventName, primeAudioOutput, { once: true, passive: true });
    });
    primeAudioOutput();
    nativeApplicationSource?.requireReminderBirth();
    window.MemphisDeviceReminders = {
      poll,
      reconcileScheduleAuthority,
      resolveDeviceId: () => state.deviceId,
      debugPlayRingtone: (repeatCount) => playRingtone({ repeatCount }),
      debugShowSampleAlert: () => showAlert(debugReminderAlert())
    };
    if(nativeApplicationSource) {
      // SAME actual normal renderer/audio owner; only the private native-born
      // sink receives it. Public fallback registration never creates evidence.
      nativeApplicationSource.bindReminderOwner(Object.freeze({
        present:showAcceptedNotification,
        provider:Object.freeze({show:showAcceptedNotification,stopAndReadback:stopProviderAudioAndReadback}),
        snapshot:()=>snapshotReminderState(),
        ordinarySnapshot:selector=>snapshotOrdinaryReminderData(selector),
      }));
    } else {
    window.MemphisMobile?.registerNotificationFallback?.(showAcceptedNotification);
    window.MemphisMobile?.registerProviderMirrorRenderer?.(Object.freeze({show:showAcceptedNotification,stopAndReadback:stopProviderAudioAndReadback}));
    }
    nativeApplicationSource?.requireReminderBirth();
    window.addEventListener('memphis:custodial-security-state',sourceWriter('REMINDER_1569',()=>{
      clearIdentity();
      reconcileScheduleAuthority();
    }));
    window.addEventListener('pagehide',sourceWriter('REMINDER_1573',()=>{
      state.detached=true;
      const alert=state.activeAlert||state.activeAudioAlert;
      if(state.activeAlert)closeActiveAlert({stopSpeech:true,nextPresentation:false});
      else stopAlertAudio();
      alert?.boundReceiptAction?.detach?.();
    }));
    window.addEventListener('pageshow',sourceWriter('REMINDER_1580',()=>{state.detached=false;recheckOwnedLunchCutoffs();void poll();}));
    runDebugTriggers();
    setTimeout(poll, CONFIG.STARTUP_DELAY_MS);
    state.poller = setInterval(poll, CONFIG.POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) {recheckOwnedLunchCutoffs();poll();} });
    window.addEventListener('memphis:native-notification-received', () => { poll(); });
    window.addEventListener('memphis:notification-mode-changed', () => {
      // Capability is not proof that this card was scheduled elsewhere. The
      // per-key coordinator preserves its owner across mode transitions.
      if (window.MemphisMobile?.nativeNotifications !== true) void poll();
    });
  }

  // SAME actual normal callbacks; no alternate renderer/audio owner. The
  // original Promise is retained through terminal completion, including timer
  // and UI callbacks that outlive init/poll/showAlert. No timers are changed.
  if(nativeApplicationSource){
    persistDeviceId=sourceWriter('REMINDER_1597',persistDeviceId,true);
    resolveDeviceId=sourceWriter('REMINDER_1598',resolveDeviceId,true);
    mutateReminderStorage=sourceWriter('REMINDER_1599',mutateReminderStorage,true);
    markSeenId=sourceWriter('REMINDER_1600',markSeenId);
    cleanupStaleSeenKeys=sourceWriter('REMINDER_1601',cleanupStaleSeenKeys);
    acknowledgeAlert=sourceWriter('REMINDER_1602',acknowledgeAlert,true);
    markAlertSeenIfAcknowledged=sourceWriter('REMINDER_1603',markAlertSeenIfAcknowledged,true);
    clearIdentity=sourceWriter('REMINDER_1604',clearIdentity);
    resolveIdentity=sourceWriter('REMINDER_1605',resolveIdentity,true);
    commitIdentity=sourceWriter('REMINDER_1606',commitIdentity);
    setReminderPresentationActive=sourceWriter('REMINDER_1607',setReminderPresentationActive);
    injectStyles=sourceWriter('REMINDER_1608',injectStyles);
    fullyKioskNudge=sourceWriter('REMINDER_1609',fullyKioskNudge);
    providerKioskNudge=sourceWriter('REMINDER_1610',providerKioskNudge);
    stopProviderAudioAndReadback=sourceWriter('REMINDER_1611',stopProviderAudioAndReadback,true);
    clearPendingRingtoneRepeats=sourceWriter('REMINDER_1612',clearPendingRingtoneRepeats);
    stopActiveSpeech=sourceWriter('REMINDER_1613',stopActiveSpeech);
    stopActiveRingtone=sourceWriter('REMINDER_1614',stopActiveRingtone);
    queueAlertStep=sourceWriter('REMINDER_1615',queueAlertStep);
    waitForAlertStep=sourceWriter('REMINDER_1616',waitForAlertStep,true);
    speakViaBrowser=sourceWriter('REMINDER_1617',speakViaBrowser,true);
    speakOnce=sourceWriter('REMINDER_1618',speakOnce,true);
    scheduleSpokenAlert=sourceWriter('REMINDER_1619',scheduleSpokenAlert,true);
    ensureRingtoneDataUrl=sourceWriter('REMINDER_1620',ensureRingtoneDataUrl);
    primeAudioOutput=sourceWriter('REMINDER_1621',primeAudioOutput);
    playViaFullyJs=sourceWriter('REMINDER_1622',playViaFullyJs);
    playViaHtmlAudio=sourceWriter('REMINDER_1623',playViaHtmlAudio);
    playViaWebAudio=sourceWriter('REMINDER_1624',playViaWebAudio);
    playOneRingtone=sourceWriter('REMINDER_1625',playOneRingtone);
    playRingtone=sourceWriter('REMINDER_1626',playRingtone);
    startAlertAudioSequence=sourceWriter('REMINDER_1627',startAlertAudioSequence,true);
    playSequenceTone=sourceWriter('REMINDER_1628',playSequenceTone,true);
    waitForActiveAlertSpeech=sourceWriter('REMINDER_1629',waitForActiveAlertSpeech,true);
    stopAlertAudio=sourceWriter('REMINDER_1630',stopAlertAudio);
    closeActiveAlert=sourceWriter('REMINDER_1631',closeActiveAlert);
    clearLunchCutoff=sourceWriter('REMINDER_1632',clearLunchCutoff);
    armLunchCutoff=sourceWriter('REMINDER_1633',armLunchCutoff);
    recheckLunchCutoff=sourceWriter('REMINDER_1634',recheckLunchCutoff);
    recheckOwnedLunchCutoffs=sourceWriter('REMINDER_1635',recheckOwnedLunchCutoffs);
    reconcileScheduleAuthority=sourceWriter('REMINDER_1636',reconcileScheduleAuthority);
    showAlert=sourceWriter('REMINDER_1637',showAlert);
    showAcceptedNotification=sourceWriter('REMINDER_1638',showAcceptedNotification);
    poll=sourceWriter('REMINDER_1639',poll,true);
    runDebugTriggers=sourceWriter('REMINDER_1640',runDebugTriggers);
    init=sourceWriter('REMINDER_1641',init,true);
  }

  if(nativeApplicationSource) {
    nativeApplicationSource.requireReminderBirth();
    if(document.readyState==='loading')throw new Error('Native reminder factory document is not initialized');
    return init(); // Actual native bootstrap observes the init promise/refusal.
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}
