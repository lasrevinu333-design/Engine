(() => {
  'use strict';

  const API = 'https://memphis-zoo-mcp.onrender.com/messaging-api';
  const MEMPHIS_AVATAR = './memphis_avatar_ui.webp';
  const DEVICE_KEYS = ['memphisAssignedDeviceId', 'mz_scan_device_id', 'mz_employee_hub_device_id'];
  const SYSTEM_THREAD_KEY = 'ops_manager_shared_chat_v1';
  const OUTBOX_PREFIX = 'mz_messenger_v2_outbox:';
  const DRAFT_PREFIX = 'mz_messenger_v2_draft:';

  const state = {
    identity: null,
    session: null,
    deviceId: '',
    hub: 'manager',
    threads: [],
    selectedId: '',
    messages: [],
    users: [],
    pollTimer: 0,
    toastTimer: 0,
    busy: false,
  };

  const els = {
    app: document.getElementById('messenger-app'),
    back: document.getElementById('messenger-back'),
    identity: document.getElementById('identity-line'),
    search: document.getElementById('conversation-search'),
    threads: document.getElementById('thread-list'),
    threadEmpty: document.getElementById('thread-empty'),
    chatTitle: document.getElementById('chat-title'),
    chatMeta: document.getElementById('chat-meta'),
    messages: document.getElementById('chat-messages'),
    composer: document.getElementById('composer'),
    input: document.getElementById('compose-input'),
    send: document.getElementById('send-message'),
    mobileChats: document.getElementById('mobile-chats'),
    deleteThread: document.getElementById('delete-thread'),
    memphis: document.getElementById('open-memphis'),
    newChat: document.getElementById('new-chat'),
    overlay: document.getElementById('new-overlay'),
    people: document.getElementById('people-list'),
    groupTitleWrap: document.getElementById('group-title-wrap'),
    groupTitle: document.getElementById('group-title'),
    newStatus: document.getElementById('new-status'),
    create: document.getElementById('create-conversation'),
    cancel: document.getElementById('cancel-conversation'),
    toast: document.getElementById('messenger-toast'),
  };

  function safe(error) {
    return error instanceof Error ? error.message : String(error || 'Unknown error');
  }

  function retainOutboxFailure(entry, error) {
    localStorage.setItem(`${OUTBOX_PREFIX}${entry.id}`, JSON.stringify({
      ...entry,
      retry_count: Number(entry.retry_count || 0) + 1,
      last_attempt_at: Date.now(),
      last_error: safe(error).slice(0, 500),
    }));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function hubContext() {
    const requested = String(new URL(location.href).searchParams.get('hub') || '').trim().toLowerCase();
    return requested === 'employee' ? 'employee' : 'manager';
  }

  function resolveDeviceId() {
    const url = new URL(location.href);
    const explicit = String(url.searchParams.get('device') || url.searchParams.get('deviceId') || '').trim();
    if (explicit) {
      try {
        localStorage.setItem('memphisAssignedDeviceId', explicit);
        localStorage.setItem('mz_scan_device_id', explicit);
      } catch {}
      return explicit;
    }
    const fromAuth = String(window.MemphisAuth?.getDeviceId?.() || '').trim();
    if (fromAuth) return fromAuth;
    for (const key of DEVICE_KEYS) {
      const value = String(localStorage.getItem(key) || '').trim();
      if (value) return value;
    }
    return '';
  }

  function roleTitle(user = {}) {
    const explicit = String(user.role_title || user.job_title || '').trim();
    if (explicit) return explicit;
    const role = String(user.role || '').trim().toLowerCase();
    if (role === 'bot') return 'Memphis AI';
    if (role === 'manager') return 'Operations Leadership';
    return 'Custodial Team';
  }

  async function managerHeaders() {
    if (state.hub !== 'manager') return {};
    if (window.MemphisMobile?.authHeaders) return window.MemphisMobile.authHeaders();
    const session = state.session || await window.MemphisAuth?.requireOpsManagerSession?.({
      accessLevel: 'full_access',
      interactive: true,
      redirect: false,
      throwOnFailure: true,
    });
    if (!session?.token) throw new Error('Manager access is required.');
    state.session = session;
    return {
      Authorization: `Bearer ${session.token}`,
      'X-Device-Id': session.device_id || state.deviceId,
    };
  }

  async function api(path, { method = 'GET', body = null } = {}) {
    if (window.MemphisMobile?.requestEnvelope) {
      return window.MemphisMobile.requestEnvelope(`/messaging-api${path}`, { method, body });
    }
    const headers = new Headers(await managerHeaders());
    if (body != null) headers.set('Content-Type', 'application/json');
    if (state.deviceId && !headers.has('X-Device-Id')) headers.set('X-Device-Id', state.deviceId);
    const response = await fetch(`${API}${path}`, {
      method,
      cache: 'no-store',
      credentials: state.hub === 'manager' ? 'include' : 'omit',
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function query(path, parameters = {}) {
    const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== '' && value != null) search.set(key, String(value));
    }
    const suffix = search.toString();
    return `${normalizedPath}${suffix ? `?${suffix}` : ''}`;
  }

  function normalizeThread(row = {}) {
    return {
      ...row,
      id: String(row.thread_id || row.id || ''),
      title: String(row.thread_title || row.title || 'Conversation'),
      type: String(row.thread_type || 'direct').toLowerCase(),
      systemKey: String(row.system_key || ''),
      canSend: row.viewer_can_send !== false,
      unread: Number(row.unread_count || 0),
      participantNames: String(row.participant_names || ''),
    };
  }

  function isRetiredSystemThread(thread) {
    return thread.systemKey === SYSTEM_THREAD_KEY || thread.is_ops_manager_shared === true;
  }

  function isMemphis(thread) {
    return thread?.type === 'bot' || String(thread?.title || '').trim().toLowerCase() === 'memphis';
  }

  function initials(value) {
    return String(value || 'M').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'M';
  }

  function formatTime(value) {
    const date = new Date(value || 0);
    if (!Number.isFinite(date.getTime())) return '';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function showToast(message, kind = '') {
    clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.className = `uxToast show ${kind}`.trim();
    state.toastTimer = setTimeout(() => { els.toast.className = 'uxToast'; }, 2600);
  }

  async function loadIdentity() {
    const path = state.hub === 'manager'
      ? '/me/by-device'
      : query('/me/by-device', { device_id: state.deviceId });
    const envelope = await api(path);
    const identity = envelope.data || {};
    if (!identity.msg_user_id) throw new Error('This phone does not have a Messenger identity.');
    state.identity = identity;
    localStorage.setItem('mz_messenger_user_id', String(identity.msg_user_id));
    const title = roleTitle(identity);
    els.identity.textContent = `${identity.display_name || 'Memphis Zoo'}${title ? ` · ${title}` : ''}`;
    return identity;
  }

  async function loadThreads({ keepSelection = true } = {}) {
    const identity = state.identity || await loadIdentity();
    const envelope = await api(query('/threads', {
      user_id: identity.msg_user_id,
      device_id: state.deviceId,
    }));
    const rows = (Array.isArray(envelope.data) ? envelope.data : [])
      .map(normalizeThread)
      .filter((thread) => thread.id && !isRetiredSystemThread(thread));
    state.threads = rows;
    renderThreads();
    const requested = new URL(location.href).searchParams.get('thread_id') || '';
    const desired = keepSelection ? (state.selectedId || requested) : requested;
    if (desired && rows.some((thread) => thread.id === desired)) {
      await selectThread(desired, { updateUrl: false });
    } else if (state.selectedId && !rows.some((thread) => thread.id === state.selectedId)) {
      closeThread();
    }
    return rows;
  }

  function filteredThreads() {
    const needle = String(els.search.value || '').trim().toLowerCase();
    if (!needle) return state.threads;
    return state.threads.filter((thread) =>
      `${thread.title} ${thread.participantNames} ${thread.last_message_body || ''}`
        .toLowerCase().includes(needle));
  }

  function renderThreads() {
    const rows = filteredThreads();
    els.threadEmpty.hidden = rows.length > 0;
    els.threads.innerHTML = rows.map((thread) => {
      const memphis = isMemphis(thread);
      const avatar = memphis
        ? `<img src="${MEMPHIS_AVATAR}" alt="">`
        : escapeHtml(initials(thread.title));
      const preview = thread.last_message_body || (memphis ? 'Ask Memphis about schedules, locations, events, or coverage.' : 'No messages yet.');
      return `<button class="threadRow${thread.id === state.selectedId ? ' active' : ''}" type="button" data-thread-id="${escapeHtml(thread.id)}">
        <span class="threadAvatar" aria-hidden="true">${avatar}</span>
        <span class="threadCopy">
          <span class="threadTitle">${escapeHtml(thread.title)}</span>
          <span class="threadPreview">${escapeHtml(preview)}</span>
        </span>
        <span class="threadMeta">
          <span>${escapeHtml(formatTime(thread.last_message_at || thread.updated_at))}</span>
          ${thread.unread ? `<span class="unreadBadge">${thread.unread > 99 ? '99+' : thread.unread}</span>` : ''}
        </span>
      </button>`;
    }).join('');
  }

  async function loadMessages(threadId) {
    const envelope = await api(query(`/thread/${encodeURIComponent(threadId)}/messages`, {
      user_id: state.identity.msg_user_id,
      device_id: state.deviceId,
      limit: 200,
    }));
    state.messages = (Array.isArray(envelope.data) ? envelope.data : []).filter((message) => message.is_deleted !== true);
    renderMessages();
    const thread = state.threads.find((item) => item.id === threadId);
    if (thread?.canSend !== false) {
      void api(`/thread/${encodeURIComponent(threadId)}/read`, {
        method: 'POST',
        body: { user_id: state.identity.msg_user_id, device_id: state.deviceId },
      }).catch(() => {});
    }
  }

  function renderMessages() {
    const thread = state.threads.find((item) => item.id === state.selectedId);
    if (!thread) return;
    if (!state.messages.length) {
      els.messages.innerHTML = '<div class="chatEmpty">No messages yet.<br>Start the conversation when you are ready.</div>';
      return;
    }
    els.messages.innerHTML = state.messages.map((message) => {
      const mine = String(message.sender_user_id) === String(state.identity.msg_user_id);
      const bot = String(message.sender_display_name || '').trim().toLowerCase() === 'memphis';
      const classes = `messageRow${mine ? ' mine' : ''}${bot ? ' bot' : ''}`;
      return `<div class="${classes}">
        <div class="messageBubble">
          ${!mine ? `<div class="messageSender">${escapeHtml(message.sender_display_name || 'Unknown')}</div>` : ''}
          <div>${escapeHtml(message.body || '')}</div>
          <div class="messageTime">${escapeHtml(formatTime(message.sent_at || message.created_at))}${message.failed ? ' · queued' : ''}</div>
        </div>
      </div>`;
    }).join('');
    requestAnimationFrame(() => { els.messages.scrollTop = els.messages.scrollHeight; });
  }

  async function selectThread(threadId, { updateUrl = true } = {}) {
    const thread = state.threads.find((item) => item.id === threadId);
    if (!thread) return;
    state.selectedId = threadId;
    els.app.classList.add('threadOpen');
    els.chatTitle.textContent = thread.title;
    els.chatMeta.textContent = isMemphis(thread)
      ? 'Memphis Zoo operations assistant'
      : (thread.participantNames || (thread.type === 'group' ? 'Group conversation' : 'Direct message'));
    els.deleteThread.hidden = isRetiredSystemThread(thread);
    els.composer.hidden = thread.canSend === false;
    els.input.value = sessionStorage.getItem(`${DRAFT_PREFIX}${threadId}`) || '';
    renderThreads();
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('thread_id', threadId);
      history.replaceState(null, '', url);
    }
    els.messages.innerHTML = '<div class="chatEmpty">Loading conversation…</div>';
    await loadMessages(threadId);
  }

  function closeThread() {
    state.selectedId = '';
    state.messages = [];
    els.app.classList.remove('threadOpen');
    els.messages.innerHTML = '<div class="chatEmpty">Choose a conversation.</div>';
    const url = new URL(location.href);
    url.searchParams.delete('thread_id');
    history.replaceState(null, '', url);
    renderThreads();
  }

  function clientMessageId() {
    return `msg:${crypto.randomUUID()}`;
  }

  async function sendCurrentMessage(event) {
    event.preventDefault();
    if (state.busy || !state.selectedId) return;
    const text = String(els.input.value || '').trim();
    if (!text) return;
    const thread = state.threads.find((item) => item.id === state.selectedId);
    if (!thread) return;
    state.busy = true;
    els.send.disabled = true;
    els.input.value = '';
    sessionStorage.removeItem(`${DRAFT_PREFIX}${thread.id}`);
    const id = clientMessageId();
    const optimistic = {
      id,
      sender_user_id: state.identity.msg_user_id,
      sender_display_name: state.identity.display_name,
      body: text,
      sent_at: new Date().toISOString(),
      optimistic: true,
    };
    state.messages.push(optimistic);
    renderMessages();
    const entry = {
      id,
      thread_id: thread.id,
      user_id: state.identity.msg_user_id,
      device_id: state.deviceId,
      body: text,
      memphis: isMemphis(thread),
      created_at: Date.now(),
    };
    localStorage.setItem(`${OUTBOX_PREFIX}${id}`, JSON.stringify(entry));
    try {
      if (entry.memphis) {
        await api('/memphis/message', {
          method: 'POST',
          body: {
            user_id: entry.user_id,
            device_id: entry.device_id,
            thread_id: entry.thread_id,
            body: entry.body,
            client_message_id: entry.id,
          },
        });
      } else {
        await api(`/thread/${encodeURIComponent(entry.thread_id)}/message`, {
          method: 'POST',
          body: {
            sender_user_id: entry.user_id,
            device_id: entry.device_id,
            body: entry.body,
            client_message_id: entry.id,
          },
        });
      }
      localStorage.removeItem(`${OUTBOX_PREFIX}${id}`);
      await Promise.all([loadMessages(thread.id), loadThreads()]);
    } catch (error) {
      retainOutboxFailure(entry, error);
      state.messages = state.messages.map((message) => message.id === id ? { ...message, failed: true } : message);
      renderMessages();
      showToast(`Saved on this phone. Will retry when connected. ${safe(error)}`, 'error');
    } finally {
      state.busy = false;
      els.send.disabled = false;
      els.input.focus();
    }
  }

  async function retryOutbox() {
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(OUTBOX_PREFIX)) continue;
      try { entries.push(JSON.parse(localStorage.getItem(key))); } catch {}
    }
    for (const entry of entries.sort((a, b) => Number(a.created_at) - Number(b.created_at))) {
      try {
        if (entry.memphis) {
          await api('/memphis/message', {
            method: 'POST',
            body: {
              user_id: entry.user_id,
              device_id: entry.device_id,
              thread_id: entry.thread_id,
              body: entry.body,
              client_message_id: entry.id,
            },
          });
        } else {
          await api(`/thread/${encodeURIComponent(entry.thread_id)}/message`, {
            method: 'POST',
            body: {
              sender_user_id: entry.user_id,
              device_id: entry.device_id,
              body: entry.body,
              client_message_id: entry.id,
            },
          });
        }
        localStorage.removeItem(`${OUTBOX_PREFIX}${entry.id}`);
      } catch (error) {
        retainOutboxFailure(entry, error);
      }
    }
  }

  async function openMemphis() {
    let thread = state.threads.find(isMemphis);
    if (!thread) {
      const envelope = await api('/memphis/thread', {
        method: 'POST',
        body: { user_id: state.identity.msg_user_id, device_id: state.deviceId },
      });
      const id = String(envelope.data?.id || envelope.data?.thread_id || '');
      await loadThreads();
      thread = state.threads.find((item) => item.id === id) || state.threads.find(isMemphis);
    }
    if (thread) await selectThread(thread.id);
  }

  async function openNewConversation() {
    els.overlay.hidden = false;
    els.newStatus.textContent = 'Loading people…';
    els.people.innerHTML = '';
    try {
      const envelope = await api(query('/users', {
        user_id: state.identity.msg_user_id,
        device_id: state.deviceId,
      }));
      state.users = (Array.isArray(envelope.data) ? envelope.data : [])
        .filter((user) => user.is_active !== false && user.role !== 'bot' && String(user.id) !== String(state.identity.msg_user_id));
      els.people.innerHTML = state.users.map((user) => `<label class="personRow">
        <input type="checkbox" value="${escapeHtml(user.id)}">
        <span><span class="personName">${escapeHtml(user.display_name || 'User')}</span><span class="personRole">${escapeHtml(roleTitle(user))}</span></span>
      </label>`).join('') || '<div class="threadEmpty">No available recipients.</div>';
      els.newStatus.textContent = '';
      updateNewConversationState();
    } catch (error) {
      els.newStatus.textContent = safe(error);
      els.newStatus.className = 'uxStatus error';
    }
  }

  function selectedPeople() {
    return Array.from(els.people.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
  }

  function updateNewConversationState() {
    const count = selectedPeople().length;
    els.groupTitleWrap.hidden = count < 2;
    els.create.disabled = count === 0;
  }

  async function createConversation() {
    const members = selectedPeople();
    if (!members.length) return;
    els.create.disabled = true;
    els.newStatus.className = 'uxStatus info';
    els.newStatus.textContent = 'Creating conversation…';
    try {
      let envelope;
      if (members.length === 1) {
        envelope = await api('/thread/direct', {
          method: 'POST',
          body: {
            created_by_user_id: state.identity.msg_user_id,
            other_user_id: members[0],
            device_id: state.deviceId,
          },
        });
      } else {
        envelope = await api('/thread/group', {
          method: 'POST',
          body: {
            created_by_user_id: state.identity.msg_user_id,
            member_user_ids: members,
            title: String(els.groupTitle.value || '').trim() || null,
            device_id: state.deviceId,
            client_thread_id: `thread:${crypto.randomUUID()}`,
          },
        });
      }
      const id = String(envelope.data?.id || envelope.data?.thread_id || '');
      closeNewConversation();
      await loadThreads();
      if (id) await selectThread(id);
    } catch (error) {
      els.newStatus.className = 'uxStatus error';
      els.newStatus.textContent = safe(error);
      els.create.disabled = false;
    }
  }

  function closeNewConversation() {
    els.overlay.hidden = true;
    els.people.innerHTML = '';
    els.groupTitle.value = '';
    els.newStatus.textContent = '';
    els.newStatus.className = 'uxStatus';
  }

  async function deleteCurrentThread() {
    const thread = state.threads.find((item) => item.id === state.selectedId);
    if (!thread || isRetiredSystemThread(thread)) return;
    const prompt = isMemphis(thread)
      ? 'Delete this Memphis conversation from your Messenger? Your next Memphis message will start a clean conversation.'
      : `Delete “${thread.title}” from your Messenger? Other participants keep their copy.`;
    if (!confirm(prompt)) return;
    try {
      await api(`/thread/${encodeURIComponent(thread.id)}/delete`, {
        method: 'POST',
        body: { device_id: state.deviceId, operation_id: `delete:${crypto.randomUUID()}` },
      });
      closeThread();
      await loadThreads({ keepSelection: false });
      showToast('Conversation removed from your Messenger.', 'ok');
    } catch (error) {
      showToast(safe(error), 'error');
    }
  }

  async function refresh() {
    try {
      await retryOutbox();
      await loadThreads();
      if (state.selectedId) await loadMessages(state.selectedId);
    } catch (error) {
      if (navigator.onLine) showToast(safe(error), 'error');
    }
  }

  function bindEvents() {
    els.back.addEventListener('click', (event) => {
      if (els.app.classList.contains('threadOpen') && matchMedia('(max-width:720px)').matches) {
        event.preventDefault();
        closeThread();
      }
    });
    els.mobileChats.addEventListener('click', closeThread);
    els.search.addEventListener('input', renderThreads);
    els.threads.addEventListener('click', (event) => {
      const row = event.target.closest('[data-thread-id]');
      if (row) void selectThread(row.dataset.threadId);
    });
    els.composer.addEventListener('submit', sendCurrentMessage);
    els.input.addEventListener('input', () => {
      if (state.selectedId) sessionStorage.setItem(`${DRAFT_PREFIX}${state.selectedId}`, els.input.value);
    });
    els.memphis.addEventListener('click', () => void openMemphis());
    els.newChat.addEventListener('click', () => void openNewConversation());
    els.cancel.addEventListener('click', closeNewConversation);
    els.overlay.addEventListener('click', (event) => { if (event.target === els.overlay) closeNewConversation(); });
    els.people.addEventListener('change', updateNewConversationState);
    els.create.addEventListener('click', () => void createConversation());
    els.deleteThread.addEventListener('click', () => void deleteCurrentThread());
    window.addEventListener('online', () => void refresh());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  }

  async function init() {
    state.hub = hubContext();
    state.deviceId = resolveDeviceId();
    els.back.href = state.hub === 'employee' ? './employee-hub.html?hub=employee' : './start_page1.html';
    bindEvents();
    await loadIdentity();
    await loadThreads();
    const mode = new URL(location.href).searchParams.get('mode');
    if (mode === 'memphis') await openMemphis();
    if (mode === 'new') await openNewConversation();
    await retryOutbox();
    state.pollTimer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 8000);
  }

  init().catch((error) => {
    els.identity.textContent = safe(error);
    els.identity.style.borderColor = 'rgba(255,107,114,.5)';
    showToast(safe(error), 'error');
  });
})();
