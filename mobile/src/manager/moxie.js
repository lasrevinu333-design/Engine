const API = 'https://memphis-zoo-mcp.onrender.com/moxie-mobile-api';
const els = {
  messages: document.getElementById('messages'), chatForm: document.getElementById('chat-form'), chatInput: document.getElementById('chat-input'), chatStatus: document.getElementById('chat-status'),
  notes: document.getElementById('notes'), noteForm: document.getElementById('note-form'), noteContent: document.getElementById('note-content'),
  reminders: document.getElementById('reminders'), reminderForm: document.getElementById('reminder-form'), reminderContent: document.getElementById('reminder-content'), reminderDue: document.getElementById('reminder-due'),
  contacts: document.getElementById('contacts'), contactForm: document.getElementById('contact-form'), contactName: document.getElementById('contact-name'), contactPhone: document.getElementById('contact-phone'), contactEmail: document.getElementById('contact-email'),
};
let history = [];
let revision = 1;

async function request(path, options = {}) {
  const auth = await window.MemphisMobile.authHeaders();
  const response = await fetch(`${API}${path}`, {
    method: options.method || 'GET', cache: 'no-store',
    headers: { ...auth, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload.data;
}
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function renderMessages() {
  els.messages.innerHTML = history.length ? history.map((m) => `<div class="message ${m.role}">${esc(m.content)}</div>`).join('') : '<p class="muted">No current chat. Ask Moxie something.</p>';
  els.messages.scrollTop = els.messages.scrollHeight;
}
function renderList(container, rows, formatter, path) {
  container.innerHTML = rows.length ? rows.map((row) => `<div class="event" data-id="${esc(row.id)}">${formatter(row)} <button class="btn" data-delete="${esc(path)}" type="button">Delete</button></div>`).join('') : '<p class="muted">None saved.</p>';
}
function renderWorkspace(data) {
  history = Array.isArray(data.chat?.history) ? data.chat.history.filter((m) => ['user','assistant'].includes(m.role)) : [];
  revision = Number(data.chat?.revision || 1);
  renderMessages();
  renderList(els.notes, data.notes || [], (r) => `<strong>${esc(r.content)}</strong>`, '/notes');
  renderList(els.reminders, data.reminders || [], (r) => `<strong>${esc(r.content)}</strong><div class="muted">${esc(r.due || '')}</div>`, '/reminders');
  renderList(els.contacts, data.contacts || [], (r) => `<strong>${esc(r.name)}</strong><div class="muted">${esc([r.phone,r.email].filter(Boolean).join(' · '))}</div>`, '/contacts');
}
async function load() { renderWorkspace(await request('/workspace')); }
async function saveChat() {
  const data = await request('/chat-state', { method: 'PUT', body: { history: history.slice(-40), saved_chats: [], expected_revision: revision } });
  revision = Number(data?.revision || revision + 1);
}
els.chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = String(els.chatInput.value || '').trim(); if (!text) return;
  history.push({ role: 'user', content: text, createdAt: new Date().toISOString() }); renderMessages(); els.chatInput.value='';
  els.chatStatus.textContent='Moxie is thinking…';
  try {
    const data = await request('/chat', { method: 'POST', body: { messages: history.slice(-20) } });
    history.push({ role: 'assistant', content: data.content || 'No response.', createdAt: new Date().toISOString() }); renderMessages(); await saveChat(); els.chatStatus.textContent='';
  } catch (error) { els.chatStatus.textContent=error.message; els.chatStatus.className='status error'; }
});
els.noteForm.addEventListener('submit', async (event) => { event.preventDefault(); const content=String(els.noteContent.value||'').trim(); if(!content)return; await request('/notes',{method:'POST',body:{content}}); els.noteContent.value=''; await load(); });
els.reminderForm.addEventListener('submit', async (event) => { event.preventDefault(); const content=String(els.reminderContent.value||'').trim(); if(!content)return; await request('/reminders',{method:'POST',body:{content,due:els.reminderDue.value||''}}); els.reminderContent.value='';els.reminderDue.value='';await load(); });
els.contactForm.addEventListener('submit', async (event) => { event.preventDefault(); const name=String(els.contactName.value||'').trim(); if(!name)return; await request('/contacts',{method:'POST',body:{name,phone:els.contactPhone.value||'',email:els.contactEmail.value||''}}); els.contactName.value='';els.contactPhone.value='';els.contactEmail.value='';await load(); });
document.addEventListener('click', async (event) => { const button=event.target.closest('[data-delete]'); if(!button)return; const row=button.closest('[data-id]'); if(!row||!confirm('Delete this item?'))return; await request(`${button.dataset.delete}/${encodeURIComponent(row.dataset.id)}`,{method:'DELETE'}); await load(); });
load().catch((error) => { els.chatStatus.textContent=error.message; els.chatStatus.className='status error'; });
