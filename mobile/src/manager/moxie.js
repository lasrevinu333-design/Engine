const API_PREFIX = '/moxie-mobile-api';
const els = {
  messages: document.getElementById('messages'),
  chatForm: document.getElementById('chat-form'), chatInput: document.getElementById('chat-input'), chatStatus: document.getElementById('chat-status'),
  newChat: document.getElementById('new-chat'), clearChat: document.getElementById('clear-chat'),
  workspaceOpen: document.getElementById('workspace-open'), workspaceClose: document.getElementById('workspace-close'), workspaceOverlay: document.getElementById('workspace-overlay'),
  savedChats: document.getElementById('saved-chats'),
  notes: document.getElementById('notes'), noteForm: document.getElementById('note-form'), noteContent: document.getElementById('note-content'),
  reminders: document.getElementById('reminders'), reminderForm: document.getElementById('reminder-form'), reminderContent: document.getElementById('reminder-content'), reminderDue: document.getElementById('reminder-due'),
  contacts: document.getElementById('contacts'), contactForm: document.getElementById('contact-form'), contactName: document.getElementById('contact-name'), contactPhone: document.getElementById('contact-phone'), contactEmail: document.getElementById('contact-email'),
};
let history = [];
let savedChats = [];
let revision = 1;
let notes = [];
let reminders = [];
let contacts = [];
let chatBusy = false;

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function safe(error) { return error?.message ? String(error.message) : String(error || 'Unknown error'); }
function id() { try { return crypto.randomUUID(); } catch { return `moxie-${Date.now()}-${Math.random().toString(36).slice(2)}`; } }
function setStatus(text = '', kind = '') { els.chatStatus.textContent = text; els.chatStatus.className = `composerStatus${kind ? ` ${kind}` : ''}`; }
function normalizeHistory(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row && ['user','assistant'].includes(row.role) && typeof row.content === 'string').slice(-40);
}
function normalizeSaved(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: String(row?.id || id()),
    title: String(row?.title || 'Moxie Chat').trim().slice(0, 80) || 'Moxie Chat',
    history: normalizeHistory(row?.history),
    saved_at: String(row?.saved_at || row?.updated_at || row?.created_at || new Date().toISOString()),
  })).filter((row) => row.history.length).slice(0, 30);
}
async function request(path, options = {}) {
  const fullPath = `${API_PREFIX}${path}`;
  if (window.MemphisMobile?.requestJson) return window.MemphisMobile.requestJson(fullPath, options);
  const auth = await window.MemphisMobile.authHeaders();
  const response = await fetch(`https://memphis-zoo-mcp.onrender.com${fullPath}`, {
    method: options.method || 'GET', cache: 'no-store',
    headers: { ...auth, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload.data;
}
function renderMessages() {
  if (!history.length) {
    els.messages.innerHTML = '<div class="emptyChat"><strong>What can Moxie help with?</strong>Ask a work question, write through a problem, or open Workspace for notes, reminders, contacts, and past chats.</div>';
    return;
  }
  els.messages.innerHTML = history.map((message) => `<div class="message ${message.role}">${esc(message.content)}</div>`).join('');
  requestAnimationFrame(() => { els.messages.scrollTop = els.messages.scrollHeight; });
}
function chatTitle(rows = history) {
  const first = rows.find((message) => message.role === 'user' && String(message.content || '').trim());
  const text = String(first?.content || '').replace(/\s+/g, ' ').trim();
  return text ? (text.length > 58 ? `${text.slice(0, 57)}…` : text) : `Moxie Chat · ${new Date().toLocaleDateString()}`;
}
function formatSavedAt(value) {
  const date = new Date(value || 0);
  return Number.isFinite(date.getTime()) ? date.toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '';
}
function renderSavedChats() {
  els.savedChats.innerHTML = savedChats.length ? savedChats.map((chat) => `<div class="savedRow" data-saved-chat="${esc(chat.id)}"><div class="rowCopy"><strong>${esc(chat.title)}</strong><span>${esc(formatSavedAt(chat.saved_at))} · ${chat.history.length} messages</span></div><div class="rowActions"><button class="btn" type="button" data-open-saved="${esc(chat.id)}">Open</button><button class="btn danger" type="button" data-delete-saved="${esc(chat.id)}">Delete</button></div></div>`).join('') : '<p class="muted">No past chats yet. Starting a new chat archives the current one here.</p>';
}
function renderResources(container, rows, formatter, resource) {
  container.innerHTML = rows.length ? rows.map((row) => `<div class="resourceRow" data-resource-id="${esc(row.id)}"><div class="rowCopy">${formatter(row)}</div><div class="rowActions"><button class="btn danger" type="button" data-delete-resource="${esc(resource)}">Delete</button></div></div>`).join('') : '<p class="muted">None saved.</p>';
}
function renderWorkspace() {
  renderSavedChats();
  renderResources(els.notes, notes, (row) => `<strong>${esc(row.content)}</strong>`, '/notes');
  renderResources(els.reminders, reminders, (row) => `<strong>${esc(row.content)}</strong><span>${esc(row.due || '')}</span>`, '/reminders');
  renderResources(els.contacts, contacts, (row) => `<strong>${esc(row.name)}</strong><span>${esc([row.phone,row.email].filter(Boolean).join(' · '))}</span>`, '/contacts');
}
function applyWorkspace(data = {}) {
  history = normalizeHistory(data.chat?.history);
  savedChats = normalizeSaved(data.chat?.saved_chats);
  revision = Number(data.chat?.revision || 1);
  notes = Array.isArray(data.notes) ? data.notes : [];
  reminders = Array.isArray(data.reminders) ? data.reminders : [];
  contacts = Array.isArray(data.contacts) ? data.contacts : [];
  renderMessages();
  renderWorkspace();
}
async function load() { applyWorkspace(await request('/workspace')); }
async function saveChatState() {
  const data = await request('/chat-state', { method: 'PUT', body: { history: history.slice(-40), saved_chats: savedChats.slice(0, 30), expected_revision: revision } });
  revision = Number(data?.revision || revision + 1);
}
async function archiveAndClear({ archive = true } = {}) {
  const current = normalizeHistory(history);
  if (archive && current.length) {
    savedChats = [{ id: id(), title: chatTitle(current), history: current, saved_at: new Date().toISOString() }, ...savedChats].slice(0, 30);
  }
  history = [];
  renderMessages();
  renderSavedChats();
  await saveChatState();
}
async function newChat() {
  if (chatBusy) return;
  chatBusy = true;
  setStatus(history.length ? 'Saving this chat and opening a new one…' : 'Opening a new chat…');
  try { await archiveAndClear({ archive: true }); setStatus('New chat ready.', 'ok'); els.chatInput.focus(); }
  catch (error) { setStatus(safe(error), 'error'); }
  finally { chatBusy = false; }
}
async function clearChat() {
  if (chatBusy || !history.length) return;
  if (!confirm('Clear the current Moxie chat? This removes it instead of saving it to Past Chats.')) return;
  chatBusy = true;
  setStatus('Clearing chat…');
  try { await archiveAndClear({ archive: false }); setStatus('Chat cleared.', 'ok'); }
  catch (error) { setStatus(safe(error), 'error'); }
  finally { chatBusy = false; }
}
async function openSaved(chatId) {
  const chat = savedChats.find((row) => row.id === chatId);
  if (!chat) return;
  chatBusy = true;
  setStatus('Opening past chat…');
  try {
    if (history.length) savedChats = [{ id: id(), title: chatTitle(history), history: normalizeHistory(history), saved_at: new Date().toISOString() }, ...savedChats].slice(0, 30);
    savedChats = savedChats.filter((row) => row.id !== chat.id);
    history = normalizeHistory(chat.history);
    await saveChatState();
    renderMessages(); renderSavedChats(); closeWorkspace(); setStatus('Past chat opened.', 'ok');
  } catch (error) { setStatus(safe(error), 'error'); }
  finally { chatBusy = false; }
}
async function deleteSaved(chatId) {
  const chat = savedChats.find((row) => row.id === chatId);
  if (!chat || !confirm(`Delete “${chat.title}”?`)) return;
  const previous = savedChats;
  savedChats = savedChats.filter((row) => row.id !== chatId);
  renderSavedChats();
  try { await saveChatState(); } catch (error) { savedChats = previous; renderSavedChats(); setStatus(safe(error), 'error'); }
}
function openWorkspace() { els.workspaceOverlay.hidden = false; renderWorkspace(); }
function closeWorkspace() { els.workspaceOverlay.hidden = true; }
function selectTab(name) {
  document.querySelectorAll('[data-workspace-tab]').forEach((button) => button.classList.toggle('active', button.dataset.workspaceTab === name));
  document.querySelectorAll('[data-workspace-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.workspacePanel === name));
}

els.chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (chatBusy) return;
  const text = String(els.chatInput.value || '').trim();
  if (!text) return;
  chatBusy = true;
  history.push({ role: 'user', content: text, createdAt: new Date().toISOString() });
  els.chatInput.value = '';
  renderMessages();
  setStatus('Moxie is thinking…');
  try {
    const data = await request('/chat', { method: 'POST', body: { messages: history.slice(-20) } });
    history.push({ role: 'assistant', content: data.content || 'No response.', createdAt: new Date().toISOString() });
    renderMessages();
    await saveChatState();
    setStatus('');
  } catch (error) { setStatus(safe(error), 'error'); }
  finally { chatBusy = false; }
});
els.newChat.addEventListener('click', () => { void newChat(); });
els.clearChat.addEventListener('click', () => { void clearChat(); });
els.workspaceOpen.addEventListener('click', openWorkspace);
els.workspaceClose.addEventListener('click', closeWorkspace);
els.workspaceOverlay.addEventListener('click', (event) => { if (event.target === els.workspaceOverlay) closeWorkspace(); });
document.querySelectorAll('[data-workspace-tab]').forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.workspaceTab)));
els.savedChats.addEventListener('click', (event) => {
  const open = event.target.closest('[data-open-saved]');
  if (open) return void openSaved(open.dataset.openSaved);
  const remove = event.target.closest('[data-delete-saved]');
  if (remove) void deleteSaved(remove.dataset.deleteSaved);
});
els.noteForm.addEventListener('submit', async (event) => {
  event.preventDefault(); const content = String(els.noteContent.value || '').trim(); if (!content) return;
  try { await request('/notes', { method:'POST', body:{ content } }); els.noteContent.value=''; await load(); selectTab('notes'); }
  catch (error) { setStatus(safe(error), 'error'); }
});
els.reminderForm.addEventListener('submit', async (event) => {
  event.preventDefault(); const content = String(els.reminderContent.value || '').trim(); if (!content) return;
  try { await request('/reminders', { method:'POST', body:{ content, due:els.reminderDue.value || '' } }); els.reminderContent.value=''; els.reminderDue.value=''; await load(); selectTab('reminders'); }
  catch (error) { setStatus(safe(error), 'error'); }
});
els.contactForm.addEventListener('submit', async (event) => {
  event.preventDefault(); const name = String(els.contactName.value || '').trim(); if (!name) return;
  try { await request('/contacts', { method:'POST', body:{ name, phone:els.contactPhone.value || '', email:els.contactEmail.value || '' } }); els.contactName.value=''; els.contactPhone.value=''; els.contactEmail.value=''; await load(); selectTab('contacts'); }
  catch (error) { setStatus(safe(error), 'error'); }
});
document.querySelector('.workspaceBody').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete-resource]');
  if (!button) return;
  const row = button.closest('[data-resource-id]');
  if (!row || !confirm('Delete this item?')) return;
  try { await request(`${button.dataset.deleteResource}/${encodeURIComponent(row.dataset.resourceId)}`, { method:'DELETE' }); await load(); }
  catch (error) { setStatus(safe(error), 'error'); }
});

load().catch((error) => setStatus(safe(error), 'error'));
