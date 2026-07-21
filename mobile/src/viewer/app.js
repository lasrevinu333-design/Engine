import { Network } from '@capacitor/network';

const API = 'https://memphis-zoo-mcp.onrender.com';
const panels = [...document.querySelectorAll('.panel')];
const tabs = [...document.querySelectorAll('[data-tab]')];
const metrics = document.getElementById('metrics');
const eventList = document.getElementById('event-list');
const dashboardStatus = document.getElementById('dashboard-status');
const eventsStatus = document.getElementById('events-status');
const feedbackStatus = document.getElementById('feedback-status');

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function showTab(id) {
  panels.forEach((panel) => panel.classList.toggle('active', panel.id === id));
  tabs.forEach((tab) => tab.classList.toggle('primary', tab.dataset.tab === id));
}
tabs.forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.tab)));

async function getJson(path) {
  const response = await fetch(`${API}${path}`, { cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload.data;
}
async function loadDashboard() {
  dashboardStatus.textContent = 'Loading…';
  try {
    const data = await getJson('/viewer-api/dashboard');
    const cards = [
      ['Locations', data.locations_total], ['Current', data.locations_current], ['Due soon', data.locations_due_soon],
      ['Overdue', data.locations_overdue], ['In progress', data.locations_in_progress], ['Cleanings today', data.cleanings_completed_today],
    ];
    metrics.innerHTML = cards.map(([label, value]) => `<div class="metric">${esc(label)}<strong>${esc(value ?? 0)}</strong></div>`).join('');
    dashboardStatus.textContent = `Updated ${new Date(data.generated_at || Date.now()).toLocaleString()}`;
  } catch (error) { dashboardStatus.textContent = error.message; dashboardStatus.className = 'status error'; }
}
async function loadEvents() {
  eventsStatus.textContent = 'Loading…';
  try {
    const data = await getJson('/viewer-api/events?days=90');
    const rows = Array.isArray(data.events) ? data.events : [];
    eventList.innerHTML = rows.length ? rows.map((event) => `<article class="event"><strong>${esc(event.event_name)}</strong><div class="muted">${esc(event.event_date)}${event.start_time ? ` · ${esc(String(event.start_time).slice(0,5))}` : ''}${event.display_location ? ` · ${esc(event.display_location)}` : ''}</div></article>`).join('') : '<p class="muted">No upcoming events are currently published.</p>';
    eventsStatus.textContent = `Updated ${new Date(data.generated_at || Date.now()).toLocaleString()}`;
  } catch (error) { eventsStatus.textContent = error.message; eventsStatus.className = 'status error'; }
}
document.getElementById('feedback-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  feedbackStatus.textContent = 'Sending…';
  const operationId = crypto.randomUUID();
  const body = {
    operation_id: operationId,
    category: document.getElementById('category').value || 'other',
    priority: 'normal',
    message: String(document.getElementById('message').value || '').trim(),
    submitted_by: String(document.getElementById('name').value || '').trim(),
    hub_context: 'public_viewer',
    device_id: `viewer-${operationId}`,
    page_url: 'memphis-zoo-viewer://feedback',
    page_title: 'Memphis Zoo Viewer',
  };
  try {
    const response = await fetch(`${API}/feedback-api/submit`, {
      method: 'POST', headers: { 'Content-Type':'application/json', 'Idempotency-Key': operationId }, body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    event.target.reset(); feedbackStatus.textContent = 'Feedback accepted for review.'; feedbackStatus.className = 'status ok';
  } catch (error) { feedbackStatus.textContent = error.message; feedbackStatus.className = 'status error'; }
});
Network.addListener('networkStatusChange', ({ connected }) => {
  document.getElementById('offline-banner')?.remove();
  if (!connected) { const banner=document.createElement('div');banner.id='offline-banner';banner.className='offline';banner.textContent='Offline';document.body.appendChild(banner); }
});
await Promise.all([loadDashboard(), loadEvents()]);
