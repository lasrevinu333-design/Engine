const API = '/moxie-mobile-api';
const state = { history: [], savedChats: [], revision: 1, workspace: null, busy: false, toastTimer: 0 };

const els = {
  tabs: [...document.querySelectorAll('[data-tab]')],
  panels: [...document.querySelectorAll('[data-panel]')],
  chatHistory: document.getElementById('chat-history'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  chatSend: document.getElementById('chat-send'),
  chatStatus: document.getElementById('chat-status'),
  newChat: document.getElementById('new-chat'),
  clearChat: document.getElementById('clear-chat'),
  noteForm: document.getElementById('note-form'),
  noteInput: document.getElementById('note-input'),
  notesList: document.getElementById('notes-list'),
  reminderForm: document.getElementById('reminder-form'),
  reminderInput: document.getElementById('reminder-input'),
  reminderDue: document.getElementById('reminder-due'),
  remindersList: document.getElementById('reminders-list'),
  contactForm: document.getElementById('contact-form'),
  contactName: document.getElementById('contact-name'),
  contactPhone: document.getElementById('contact-phone'),
  contactEmail: document.getElementById('contact-email'),
  contactNotes: document.getElementById('contact-notes'),
  contactsList: document.getElementById('contacts-list'),
  toast: document.getElementById('moxie-toast'),
};

function safe(error) { return error instanceof Error ? error.message : String(error || 'Unknown error'); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function api(path, { method = 'GET', body } = {}) {
  if (window.MemphisMobile?.requestEnvelope) {
    return window.MemphisMobile.requestEnvelope(path, { method, body });
  }
  const response = await fetch(path, {
    method,
    cache: 'no-store',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function showToast(message, kind = '') {
  clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.className = `toast show ${kind}`.trim();
  state.toastTimer = setTimeout(() => { els.toast.className = 'toast'; }, 2400);
}

function selectTab(name) {
  els.tabs.forEach((button) => {
    const active = button.dataset.tab === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  els.panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === name));
  history.replaceState(null, '', `#${name}`);
}

function titleForHistory(history) {
  const first = history.find((message) => message.role === 'user')?.content || 'Moxie chat';
  return String(first).trim().replace(/\s+/g, ' ').slice(0, 64) || 'Moxie chat';
}

async function loadWorkspace() {
  const envelope = await api(`${API}/workspace`);
  state.workspace = envelope.data || {};
  state.history = Array.isArray(state.workspace.chat?.history) ? state.workspace.chat.history : [];
  state.savedChats = Array.isArray(state.workspace.chat?.saved_chats) ? state.workspace.chat.saved_chats : [];
  state.revision = Number(state.workspace.chat?.revision || 1);
  renderAll();
}

async function saveChat(history = state.history, savedChats = state.savedChats) {
  const envelope = await api(`${API}/chat-state`, {
    method: 'PUT',
    body: {
      expected_revision: state.revision,
      history,
      saved_chats: savedChats,
    },
  });
  state.revision = Number(envelope.data?.revision || state.revision + 1);
}

function renderChat() {
  if (!state.history.length) {
    els.chatHistory.innerHTML = '<div class="emptyState">Start a new conversation with Moxie. Your notes, reminders, and contacts are in their own tabs.</div>';
    return;
  }
  els.chatHistory.innerHTML = state.history.map((message) =>
    `<div class="message ${message.role === 'user' ? 'user' : 'assistant'}">${escapeHtml(message.content || '')}</div>`
  ).join('');
  requestAnimationFrame(() => { els.chatHistory.scrollTop = els.chatHistory.scrollHeight; });
}

async function sendChat(event) {
  event.preventDefault();
  if (state.busy) return;
  const content = String(els.chatInput.value || '').trim();
  if (!content) return;
  const previous = state.history.slice();
  state.history = [...state.history, { role: 'user', content }];
  els.chatInput.value = '';
  renderChat();
  state.busy = true;
  els.chatSend.disabled = true;
  els.chatStatus.className = 'status info';
  els.chatStatus.textContent = 'Moxie is thinking…';
  try {
    const response = await api(`${API}/chat`, {
      method: 'POST',
      body: { messages: state.history.slice(-20) },
    });
    state.history.push({ role: 'assistant', content: String(response.data?.content || '') });
    await saveChat();
    renderChat();
    els.chatStatus.className = 'status ok';
    els.chatStatus.textContent = 'Saved.';
    setTimeout(() => { if (els.chatStatus.textContent === 'Saved.') els.chatStatus.textContent = ''; }, 1300);
  } catch (error) {
    state.history = previous;
    renderChat();
    els.chatInput.value = content;
    els.chatStatus.className = 'status error';
    els.chatStatus.textContent = safe(error);
  } finally {
    state.busy = false;
    els.chatSend.disabled = false;
    els.chatInput.focus();
  }
}

async function startNewChat() {
  if (state.busy) return;
  const previousHistory = state.history.slice();
  const previousSaved = state.savedChats.slice();
  if (state.history.length) {
    state.savedChats = [{
      id: crypto.randomUUID(),
      title: titleForHistory(state.history),
      saved_at: new Date().toISOString(),
      history: state.history.slice(),
    }, ...state.savedChats].slice(0, 30);
  }
  state.history = [];
  renderChat();
  try {
    await saveChat();
    showToast(previousHistory.length ? 'Previous chat saved. New chat started.' : 'New chat ready.', 'ok');
    els.chatInput.focus();
  } catch (error) {
    state.history = previousHistory;
    state.savedChats = previousSaved;
    renderChat();
    showToast(safe(error), 'error');
  }
}

async function clearChat() {
  if (!state.history.length) return showToast('Chat is already clear.');
  if (!confirm('Clear the current Moxie chat? This does not delete notes, reminders, or contacts.')) return;
  const previous = state.history.slice();
  state.history = [];
  renderChat();
  try {
    await saveChat();
    showToast('Current chat cleared.', 'ok');
  } catch (error) {
    state.history = previous;
    renderChat();
    showToast(safe(error), 'error');
  }
}

function renderItems(container, rows, { type, title, detail }) {
  const items = Array.isArray(rows) ? rows : [];
  container.innerHTML = items.length ? items.map((row) =>
    `<div class="listRow">
      <div class="listRowMain"><div class="listRowTitle">${escapeHtml(title(row))}</div>${detail(row) ? `<div class="listRowMeta">${escapeHtml(detail(row))}</div>` : ''}</div>
      <button class="iconBtn" type="button" data-delete-type="${type}" data-id="${escapeHtml(row.id)}" aria-label="Delete">×</button>
    </div>`
  ).join('') : '<div class="emptyState">Nothing here yet.</div>';
}

function renderAll() {
  renderChat();
  renderItems(els.notesList, state.workspace?.notes, { type: 'notes', title: (row) => row.content, detail: () => '' });
  renderItems(els.remindersList, state.workspace?.reminders, { type: 'reminders', title: (row) => row.content, detail: (row) => row.due || '' });
  renderItems(els.contactsList, state.workspace?.contacts, { type: 'contacts', title: (row) => row.name, detail: (row) => [row.phone, row.email, row.notes].filter(Boolean).join(' · ') });
}

async function addResource(path, body, form) {
  try {
    await api(`${API}/${path}`, { method: 'POST', body });
    form.reset();
    await loadWorkspace();
    showToast('Saved.', 'ok');
  } catch (error) { showToast(safe(error), 'error'); }
}

async function deleteResource(type, id) {
  if (!id || !confirm('Delete this item?')) return;
  try {
    await api(`${API}/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadWorkspace();
    showToast('Deleted.', 'ok');
  } catch (error) { showToast(safe(error), 'error'); }
}

function bindEvents() {
  els.tabs.forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.tab)));
  els.chatForm.addEventListener('submit', sendChat);
  els.newChat.addEventListener('click', () => void startNewChat());
  els.clearChat.addEventListener('click', () => void clearChat());
  els.noteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const content = String(els.noteInput.value || '').trim();
    if (content) void addResource('notes', { content }, els.noteForm);
  });
  els.reminderForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const content = String(els.reminderInput.value || '').trim();
    if (content) void addResource('reminders', { content, due: String(els.reminderDue.value || '').trim() }, els.reminderForm);
  });
  els.contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = String(els.contactName.value || '').trim();
    if (name) void addResource('contacts', {
      name,
      phone: String(els.contactPhone.value || '').trim(),
      email: String(els.contactEmail.value || '').trim(),
      notes: String(els.contactNotes.value || '').trim(),
    }, els.contactForm);
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-type][data-id]');
    if (button) void deleteResource(button.dataset.deleteType, button.dataset.id);
  });
}

bindEvents();
selectTab(['chat', 'notes', 'reminders', 'contacts'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'chat');
loadWorkspace().catch((error) => {
  els.chatStatus.className = 'status error';
  els.chatStatus.textContent = safe(error);
});
