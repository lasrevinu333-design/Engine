(function(){
  'use strict';
  const API='https://memphis-zoo-mcp.onrender.com';
  const panels=[...document.querySelectorAll('.panel')];
  const tabs=[...document.querySelectorAll('[data-panel]')];
  const metrics=document.getElementById('metrics');
  const eventList=document.getElementById('event-list');
  const dashboardStatus=document.getElementById('dashboard-status');
  const eventsStatus=document.getElementById('events-status');

  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function setStatus(node,text,kind=''){node.textContent=text||'';node.className=`status${kind?` ${kind}`:''}`;}
  function showPanel(id){panels.forEach((panel)=>panel.classList.toggle('active',panel.id===id));tabs.forEach((tab)=>tab.classList.toggle('active',tab.dataset.panel===id));}
  async function getJson(path){const response=await fetch(`${API}${path}`,{cache:'no-store'});const payload=await response.json().catch(()=>null);if(!response.ok||!payload?.ok)throw new Error(payload?.error||`HTTP ${response.status}`);return payload.data;}
  async function loadDashboard(){setStatus(dashboardStatus,'Loading dashboard…');try{const data=await getJson('/viewer-api/dashboard');const cards=[['Locations',data.locations_total,''],['Current',data.locations_current,'current'],['Due soon',data.locations_due_soon,''],['Overdue',data.locations_overdue,'attention'],['In progress',data.locations_in_progress,''],['Cleanings today',data.cleanings_completed_today,'']];metrics.innerHTML=cards.map(([label,value,kind])=>`<article class="metric ${kind}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value??0)}</strong></article>`).join('');setStatus(dashboardStatus,`Updated ${new Date(data.generated_at||Date.now()).toLocaleString()}`);}catch(error){setStatus(dashboardStatus,error.message||String(error),'error');}}
  async function loadEvents(){setStatus(eventsStatus,'Loading events…');try{const data=await getJson('/viewer-api/events?days=90');const rows=Array.isArray(data.events)?data.events:[];eventList.innerHTML=rows.length?rows.map((event)=>{const date=String(event.event_date||'');const end=event.end_date&&event.end_date!==event.event_date?` through ${escapeHtml(event.end_date)}`:'';const time=event.start_time?` · ${escapeHtml(String(event.start_time).slice(0,5))}`:'';const location=event.display_location?` · ${escapeHtml(event.display_location)}`:'';return `<article class="event"><strong>${escapeHtml(event.event_name||'Event')}</strong><div>${escapeHtml(date)}${end}${time}${location}</div></article>`;}).join(''):'<div class="event-empty">No upcoming events are currently published.</div>';setStatus(eventsStatus,`Updated ${new Date(data.generated_at||Date.now()).toLocaleString()}`);}catch(error){setStatus(eventsStatus,error.message||String(error),'error');}}

  tabs.forEach((tab)=>tab.addEventListener('click',()=>showPanel(tab.dataset.panel)));
  document.getElementById('refresh-dashboard').addEventListener('click',loadDashboard);
  document.getElementById('refresh-events').addEventListener('click',loadEvents);
  Promise.allSettled([loadDashboard(),loadEvents()]);
})();
