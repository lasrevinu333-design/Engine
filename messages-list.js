(() => {
  const API_BASE = 'https://memphis-zoo-mcp.onrender.com/messaging-api';
  const DEVICE_KEY = 'mz_scan_device_id';
  const USER_KEY = 'mz_messenger_user_id';
  const ANNIE_RETURN_URL = 'https://memphis-zoo-mcp.onrender.com/moxie/';
  const ANNIE_ORIGIN_KEY = 'mz_annie_origin_session';
  const REFRESH_MS = 5000;
  const state = {
    deviceId: '', userId: '', hub: 'manager', managerSession: null,
    identity: null, threads: [], timer: null, busy: false, toastTimer: null,
  };
  const els = {
    back: document.getElementById('back-btn'), newChat: document.getElementById('new-chat-btn'),
    identity: document.getElementById('identity-line'), search: document.getElementById('conversation-search'),
    list: document.getElementById('thread-list'), empty: document.getElementById('empty-state'),
    toast: document.getElementById('status-toast'),
  };

  function safe(error) { return error?.message ? String(error.message) : String(error || 'Unknown error'); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char])); }
  function attr(value) { return esc(value).replace(/`/g, '&#96;'); }
  function normalizeThread(row = {}) {
    return {
      ...row,
      id: String(row.id || row.thread_id || '').trim(),
      title: String(row.thread_title || row.title || 'Conversation').trim(),
      type: String(row.thread_type || 'direct').toLowerCase(),
      participantNames: String(row.participant_names || '').trim(),
      preview: String(row.last_message_body || '').trim(),
      lastSender: String(row.last_sender_name || '').trim(),
      changedAt: row.last_message_at || row.updated_at || '',
      unread: Number(row.unread_count || 0),
      shared: row.is_ops_manager_shared === true || row.system_key === 'ops_manager_shared_chat_v1',
    };
  }
  function isMemphis(thread) { return thread?.type === 'bot' || String(thread?.title || '').trim().toLowerCase() === 'memphis'; }
  function initials(value) {
    return String(value || 'T').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'T';
  }
  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toDateString() === new Date().toDateString()
      ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  function showToast(text, kind = '') {
    clearTimeout(state.toastTimer);
    els.toast.textContent = text || '';
    els.toast.className = `toast${kind ? ` ${kind}` : ''}${text ? '' : ' hidden'}`;
    if (text) state.toastTimer = setTimeout(() => { els.toast.className = 'toast hidden'; }, 3500);
  }
  function resolveHub() {
    return String(new URL(location.href).searchParams.get('hub') || '').toLowerCase() === 'employee' ? 'employee' : 'manager';
  }
  function resolveDeviceId() {
    const url = new URL(location.href);
    const explicit = String(url.searchParams.get('device') || url.searchParams.get('deviceId') || '').trim();
    if (explicit) localStorage.setItem(DEVICE_KEY, explicit);
    return explicit || String(localStorage.getItem(DEVICE_KEY) || localStorage.getItem('memphisAssignedDeviceId') || '').trim();
  }
  function isAnnieOrigin() {
    const url = new URL(location.href);
    const marked = String(url.searchParams.get('origin') || '').toLowerCase() === 'annie';
    const referred = String(document.referrer || '').startsWith(ANNIE_RETURN_URL);
    if (marked || referred) {
      try { sessionStorage.setItem(ANNIE_ORIGIN_KEY, '1'); } catch {}
      return true;
    }
    try { return sessionStorage.getItem(ANNIE_ORIGIN_KEY) === '1'; } catch { return false; }
  }
  function managerHeaders() {
    const session = window.MemphisAuth?.readSession?.() || state.managerSession;
    return session?.token ? { Authorization: `Bearer ${session.token}`, 'X-Device-Id': session.device_id || state.deviceId } : {};
  }
  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET', cache: 'no-store', signal: options.signal,
      headers: { ...managerHeaders(), ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload.data;
  }
  async function establishManagerSession() {
    if (state.hub !== 'manager' || !window.MemphisAuth?.requireOpsManagerSession) return null;
    state.managerSession = await window.MemphisAuth.requireOpsManagerSession({
      accessLevel: 'full_access', interactive: false, redirect: false, throwOnFailure: false,
    }).catch(() => null);
    if (state.managerSession?.device_id) state.deviceId = state.managerSession.device_id;
    return state.managerSession;
  }
  async function resolveIdentity() {
    if (!state.managerSession && !state.deviceId) throw new Error('This device is not registered for Messenger.');
    const path = state.managerSession ? '/me/by-device' : `/me/by-device?device_id=${encodeURIComponent(state.deviceId)}`;
    const mapped = await api(path);
    if (!mapped?.msg_user_id) throw new Error('Messenger identity could not be resolved.');
    state.identity = mapped;
    state.userId = String(mapped.msg_user_id);
    localStorage.setItem(USER_KEY, state.userId);
    const title = String(mapped.role_title || mapped.job_title || '').trim();
    els.identity.textContent = `${mapped.display_name || 'Messenger'}${title ? ` · ${title}` : ''}`;
  }
  function threadUrl({ threadId = '', mode = '' } = {}) {
    const url = new URL('./thread.html', location.href);
    if (threadId) url.searchParams.set('thread_id', threadId);
    if (mode) url.searchParams.set('mode', mode);
    if (state.deviceId) url.searchParams.set('device', state.deviceId);
    if (state.userId) url.searchParams.set('user_id', state.userId);
    url.searchParams.set('hub', state.hub);
    if (isAnnieOrigin()) url.searchParams.set('origin', 'annie');
    return url;
  }
  function goBack(event) {
    event?.preventDefault?.();
    if (isAnnieOrigin()) return location.assign(ANNIE_RETURN_URL);
    const url = new URL(state.hub === 'employee' ? './employee-hub.html' : './start_page1.html', location.href);
    if (state.deviceId) url.searchParams.set('device', state.deviceId);
    location.assign(url);
  }
  function openMemphis() {
    const existing = state.threads.find(isMemphis);
    location.assign(threadUrl(existing ? { threadId: existing.id } : { mode: 'memphis' }));
  }
  function previewFor(thread) {
    if (!thread.preview) return isMemphis(thread) ? 'Ask Memphis an operational question.' : 'No messages yet.';
    if (thread.type === 'group' && thread.lastSender) return `${thread.lastSender}: ${thread.preview}`;
    return thread.preview;
  }
  function rowMarkup(thread, { pinnedMemphis = false } = {}) {
    const memphis = pinnedMemphis || isMemphis(thread);
    const title = memphis ? 'Memphis AI' : thread.title;
    const avatar = memphis
      ? '<div class="avatar"><img src="./memphis_avatar_ui.webp?v=release-2026.07.18.custodial-v3.11" alt=""></div>'
      : `<div class="avatar" aria-hidden="true">${esc(initials(title))}</div>`;
    const time = formatTime(thread.changedAt);
    const menu = memphis ? '' : `<button class="menuBtn" type="button" data-delete-thread="${attr(thread.id)}" aria-label="Delete ${attr(title)} conversation">⋯</button>`;
    return `<article class="threadItem${memphis ? ' memphis' : ''}">
      <button class="threadOpen" type="button" data-open-thread="${attr(thread.id || 'memphis')}">
        ${avatar}
        <span class="threadCopy"><span class="threadName">${esc(title)}</span><span class="threadPreview">${esc(previewFor(thread))}</span></span>
        <span class="threadMeta"><span class="threadTime">${esc(time)}</span>${thread.unread > 0 ? `<span class="unread">${esc(thread.unread)}</span>` : ''}</span>
      </button>${menu}
    </article>`;
  }
  function render() {
    const needle = String(els.search.value || '').trim().toLowerCase();
    const memphisThread = state.threads.find(isMemphis) || normalizeThread({ id: '', title: 'Memphis', thread_type: 'bot' });
    const showMemphis = !needle || `memphis ai operational assistant ${previewFor(memphisThread)}`.toLowerCase().includes(needle);
    const others = state.threads
      .filter((thread) => !isMemphis(thread) && !thread.shared)
      .filter((thread) => !needle || `${thread.title} ${thread.participantNames} ${thread.preview} ${thread.lastSender}`.toLowerCase().includes(needle));
    const rows = [...(showMemphis ? [rowMarkup(memphisThread, { pinnedMemphis: true })] : []), ...others.map((thread) => rowMarkup(thread))];
    els.list.innerHTML = rows.join('');
    els.empty.classList.toggle('hidden', rows.length > 0);
    els.empty.textContent = needle ? 'No conversations match your search.' : 'No conversations yet.';
  }
  async function refresh({ quiet = false } = {}) {
    if (state.busy || !state.userId || document.hidden) return;
    state.busy = true;
    try {
      const query = `?user_id=${encodeURIComponent(state.userId)}${state.deviceId ? `&device_id=${encodeURIComponent(state.deviceId)}` : ''}`;
      const rows = await api(`/threads${query}`);
      state.threads = (Array.isArray(rows) ? rows : []).map(normalizeThread).filter((thread) => thread.id && !thread.shared);
      state.threads.sort((a, b) => Date.parse(b.changedAt || 0) - Date.parse(a.changedAt || 0));
      render();
    } catch (error) {
      if (!quiet) showToast(safe(error), 'error');
    } finally { state.busy = false; }
  }
  async function deleteThread(threadId) {
    const thread = state.threads.find((item) => item.id === threadId);
    if (!thread || isMemphis(thread) || thread.shared) return;
    if (!confirm(`Delete “${thread.title}” for everyone?`)) return;
    try {
      await api(`/thread/${encodeURIComponent(thread.id)}/delete`, {
        method: 'POST', body: { device_id: state.deviceId, operation_id: `delete:${crypto.randomUUID()}` },
      });
      state.threads = state.threads.filter((item) => item.id !== thread.id);
      render();
      showToast('Conversation deleted.');
    } catch (error) { showToast(`Delete failed: ${safe(error)}`, 'error'); }
  }
  function bind() {
    els.back.addEventListener('click', goBack);
    els.newChat.addEventListener('click', () => location.assign(threadUrl({ mode: 'new' })));
    els.search.addEventListener('input', render);
    els.list.addEventListener('click', (event) => {
      const deleteButton = event.target.closest('[data-delete-thread]');
      if (deleteButton) { event.preventDefault(); event.stopPropagation(); void deleteThread(deleteButton.dataset.deleteThread); return; }
      const open = event.target.closest('[data-open-thread]');
      if (!open) return;
      const id = String(open.dataset.openThread || '');
      if (id === 'memphis' || isMemphis(state.threads.find((thread) => thread.id === id))) openMemphis();
      else location.assign(threadUrl({ threadId: id }));
    });
    window.addEventListener('online', () => void refresh());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh({ quiet: true }); });
  }
  async function init() {
    state.hub = resolveHub();
    state.deviceId = resolveDeviceId();
    bind();
    await establishManagerSession();
    await resolveIdentity();
    await refresh();
    state.timer = setInterval(() => void refresh({ quiet: true }), REFRESH_MS);
  }
  init().catch((error) => {
    els.identity.textContent = safe(error);
    els.empty.classList.remove('hidden');
    els.empty.textContent = 'Messenger could not be opened on this device.';
    showToast(safe(error), 'error');
  });
})();
