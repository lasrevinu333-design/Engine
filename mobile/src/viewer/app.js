import { Network } from '@capacitor/network';

const API = 'https://memphis-zoo-mcp.onrender.com';
const panels = [...document.querySelectorAll('.panel')];
const tabs = [...document.querySelectorAll('[data-tab]')];
const metrics = document.getElementById('metrics');
const eventList = document.getElementById('event-list');
const dashboardStatus = document.getElementById('dashboard-status');
const eventsStatus = document.getElementById('events-status');

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function showTab(id) {
  if (!panels.some((panel) => panel.id === id)) return;
  panels.forEach((panel) => panel.classList.toggle('active', panel.id === id));
  tabs.forEach((tab) => tab.classList.toggle('primary', tab.dataset.tab === id));
}
function selectTab(id, updateLocation = false) {
  showTab(id);
  if (updateLocation) history.replaceState(null, '', `#${id}`);
}
tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab.dataset.tab, true)));
selectTab(location.hash.slice(1) || 'dashboard');

let stopped=false,networkListener=null;
const requests=new Set(),generations={dashboard:0,events:0};
const status=(element,message,error=false)=>{element.textContent=message;element.className=error?'status error':'status';};
const sourceTime=data=>typeof data?.generated_at==='string'&&Number.isFinite(Date.parse(data.generated_at))
  ?`Public source updated ${new Date(data.generated_at).toLocaleString('en-US',{timeZone:'America/Chicago'})} Central.`
  :'Source update time unavailable.';
async function getJson(path) {
  const controller=new AbortController();requests.add(controller);
  const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(`${API}${path}`,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||payload?.ok!==true)throw Error('Public source unavailable.');
    return payload.data;
  }finally{clearTimeout(timer);requests.delete(controller);}
}
async function loadDashboard() {
  if(stopped)return;const generation=++generations.dashboard;
  status(dashboardStatus,'Reading public operational totals…');
  try {
    const data=await getJson('/viewer-api/dashboard');
    if(stopped||generation!==generations.dashboard)return;
    const cards=[['Locations','locations_total'],['Current','locations_current'],['Due soon','locations_due_soon'],
      ['Overdue','locations_overdue'],['In progress','locations_in_progress'],['Cleanings today','cleanings_completed_today']];
    if(cards.some(([,key])=>!Number.isSafeInteger(data?.[key])||data[key]<0))throw Error('Public operational totals are unverified.');
    metrics.innerHTML=cards.map(([label,key])=>`<div class="metric">${esc(label)}<strong>${data[key]}</strong></div>`).join('');
    status(dashboardStatus,sourceTime(data)+' Read-only aggregates; individual records are restricted.');
  }catch{if(!stopped&&generation===generations.dashboard)status(dashboardStatus,'Public totals unavailable. Any displayed totals are from the previous read, not confirmed current.',true);}
}
async function loadEvents() {
  if(stopped)return;const generation=++generations.events;
  status(eventsStatus,'Reading published events…');
  try {
    const data=await getJson('/viewer-api/events?days=90');
    if(stopped||generation!==generations.events)return;
    if(!Array.isArray(data?.events)||data.events.length>250)throw Error('Public event projection unavailable.');
    // Restrict display to existing public fields and escape every source string.
    const rows=data.events.map(event=>({name:typeof event?.event_name==='string'?event.event_name.slice(0,500):'Published event',
      date:typeof event?.event_date==='string'?event.event_date:'Date unavailable',end:typeof event?.end_date==='string'?event.end_date:null,
      time:typeof event?.start_time==='string'?event.start_time.slice(0,5):'',place:typeof event?.display_location==='string'?event.display_location.slice(0,500):''}));
    eventList.innerHTML=rows.length?rows.map(event=>`<article class="event"><strong>${esc(event.name)}</strong><div class="muted">${esc(event.date)}${event.end&&event.end!==event.date?` through ${esc(event.end)}`:''}${event.time?` · ${esc(event.time)}`:''}${event.place?` · ${esc(event.place)}`:''}</div></article>`).join(''):'<p class="muted">No upcoming events are currently published.</p>';
    status(eventsStatus,sourceTime(data));
  }catch{if(!stopped&&generation===generations.events)status(eventsStatus,'Published events unavailable. Any displayed events are from the previous read.',true);}
}
function refresh(){if(!stopped&&!document.hidden){void loadDashboard();void loadEvents();}}
void Network.addListener('networkStatusChange',({connected})=>{
  if(stopped)return;document.getElementById('offline-banner')?.remove();
  if(!connected){const banner=document.createElement('div');banner.id='offline-banner';banner.className='offline';banner.textContent='Offline';document.body.appendChild(banner);}
  else refresh();
}).then(handle=>{if(stopped)void handle.remove();else networkListener=handle;}).catch(()=>{});
const refreshTimer=setInterval(refresh,30000);
window.addEventListener('pagehide',()=>{stopped=true;clearInterval(refreshTimer);for(const request of requests)request.abort();requests.clear();void networkListener?.remove();networkListener=null;},{once:true});
refresh();
