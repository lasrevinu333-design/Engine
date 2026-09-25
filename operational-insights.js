(() => {
  'use strict';

  const API = 'https://memphis-zoo-mcp.onrender.com';
  const state = {
    activeTab: 'performance',
    performance: [],
    cleanings: [],
    tickets: [],
    ticketWindow: 7,
  };

  const els = {
    refresh: document.getElementById('refresh-insights'),
    status: document.getElementById('global-status'),
    tabs: Array.from(document.querySelectorAll('[data-tab]')),
    panels: Array.from(document.querySelectorAll('[data-panel]')),
    summaryCleanings: document.getElementById('summary-cleanings'),
    summaryDuration: document.getElementById('summary-duration'),
    summaryHotspots: document.getElementById('summary-hotspots'),
    performanceEmployee: document.getElementById('performance-employee'),
    performanceLocation: document.getElementById('performance-location'),
    performanceMinimum: document.getElementById('performance-minimum'),
    performanceList: document.getElementById('performance-list'),
    applyPerformance: document.getElementById('apply-performance'),
    cleaningsFrom: document.getElementById('cleanings-from'),
    cleaningsTo: document.getElementById('cleanings-to'),
    cleaningsEmployee: document.getElementById('cleanings-employee'),
    cleaningsLocation: document.getElementById('cleanings-location'),
    cleaningsList: document.getElementById('cleanings-list'),
    applyCleanings: document.getElementById('apply-cleanings'),
    ticketButtons: Array.from(document.querySelectorAll('[data-window]')),
    ticketsList: document.getElementById('tickets-list'),
  };

  function safe(error) {
    const raw = error instanceof Error ? error.message : String(error || 'Unknown error');
    if (/failed to fetch|network|load failed|internet/i.test(raw)) return 'The service could not be reached. Your selections were kept; retry when the connection returns.';
    if (/custodial manager access/i.test(raw)) return 'Custodial Manager access is required for operational insights.';
    return raw.replace(/^HTTP\s+\d+\s*[-:]?\s*/i, '') || 'The request could not be completed.';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function setStatus(text = '', kind = '') {
    els.status.textContent = text;
    els.status.className = `uxStatus workspaceStatus${kind ? ` ${kind}` : ''}`;
  }



  async function authHeaders() {
    if (window.MemphisMobile?.authHeaders) return window.MemphisMobile.authHeaders();
    const session = await window.MemphisAuth?.requireOpsManagerSession?.({
      accessLevel: 'full_access', interactive: true, redirect: false, throwOnFailure: true,
    });
    if (!session?.token) throw new Error('Custodial Manager access is required.');
    return {
      Authorization: `Bearer ${session.token}`,
      'X-Device-Id': session.device_id || window.MemphisAuth?.getDeviceId?.() || '',
    };
  }

  async function request(path, { method = 'GET', body = null, headers: extraHeaders = {} } = {}) {
    if (window.MemphisMobile?.requestEnvelope) {
      const envelope = await window.MemphisMobile.requestEnvelope(path, { method, body, headers: extraHeaders });
      return envelope.data;
    }
    const headers = { ...(await authHeaders()), ...extraHeaders };
    if (body != null) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${API}${path}`, {
      method,
      cache: 'no-store',
      credentials: 'include',
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload.data;
  }

  function query(path, parameters = {}) {
    const url = new URL(path, API);
    for (const [key, value] of Object.entries(parameters)) if (value !== '' && value != null) url.searchParams.set(key, String(value));
    return `${url.pathname}${url.search}`;
  }

  function number(value, digits = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
  }

  function dateTime(value) {
    const date = new Date(value || 0);
    return Number.isFinite(date.getTime()) ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  }

  function minutes(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '—';
    if (parsed < 60) return `${Math.round(parsed)} min`;
    const hours = Math.floor(parsed / 60);
    const remainder = Math.round(parsed % 60);
    return `${hours}h${remainder ? ` ${remainder}m` : ''}`;
  }


  function uniqueOptions(rows, idKey, labelKey) {
    const map = new Map();
    for (const row of rows) {
      const id = String(row?.[idKey] || '').trim();
      const label = String(row?.[labelKey] || '').trim();
      if (id && label) map.set(id, label);
    }
    return [...map.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }

  function fillSelect(select, options, placeholder) {
    const current = select.value;
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + options.map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`).join('');
    if (options.some(([id]) => id === current)) select.value = current;
  }

  function setTab(name) {
    state.activeTab = name;
    for (const tab of els.tabs) {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of els.panels) {
      const active = panel.dataset.panel === name;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    }
  }

  function renderSummary() {
    const totalCleanings = state.performance.reduce((sum, row) => sum + Number(row.cleaning_count || 0), 0);
    const weightedDuration = state.performance.reduce((sum, row) => sum + Number(row.average_duration_minutes || 0) * Number(row.cleaning_count || 0), 0);
    const hotspots = state.tickets.filter((row) => ['hotspot', 'recurring', 'repeat'].includes(String(row.recurrence_status || ''))).length;
    els.summaryCleanings.textContent = number(totalCleanings);
    els.summaryDuration.textContent = totalCleanings ? minutes(weightedDuration / totalCleanings) : '—';
    els.summaryHotspots.textContent = number(hotspots);
  }

  function renderPerformance() {
    const rows = state.performance;
    if (!rows.length) {
      els.performanceList.innerHTML = '<div class="emptyState">No employee/location comparisons match these filters yet. More completed cleanings will build the baseline.</div>';
      return;
    }
    els.performanceList.innerHTML = rows.map((row) => {
      const delta = Number(row.duration_delta_from_location_minutes);
      const deltaText = Number.isFinite(delta) ? `${delta > 0 ? '+' : ''}${number(delta, 1)} min vs location` : 'No location baseline';
      const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
      return `<article class="dataCard">
        <div>
          <h3>${escapeHtml(row.employee_name || 'Unknown employee')} · ${escapeHtml(row.location_name || row.location_code || 'Unknown location')}</h3>
          <p>${escapeHtml(row.employee_code || '')}${row.cleanings_last_30_days != null ? ` · ${number(row.cleanings_last_30_days)} cleanings in the last 30 days` : ''}</p>
          <div class="dataMeta">
            <span class="metaChip">${number(row.cleaning_count)} total cleanings</span>
            <span class="metaChip">${number(row.maintenance_ticket_count)} linked tickets</span>
          </div>
        </div>
        <div class="metricGrid">
          <div class="metric"><span>Average time</span><strong>${minutes(row.average_duration_minutes)}</strong></div>
          <div class="metric"><span>Median time</span><strong>${minutes(row.median_duration_minutes)}</strong></div>
          <div class="metric"><span>Location comparison</span><strong class="delta ${deltaClass}">${escapeHtml(deltaText)}</strong></div>
        </div>
        <div class="dataAction"><small class="uxMuted">Latest ${escapeHtml(dateTime(row.latest_cleaning_at))}</small></div>
      </article>`;
    }).join('');
  }


  function renderCleanings() {
    const rows = state.cleanings;
    if (!rows.length) {
      els.cleaningsList.innerHTML = '<div class="emptyState">No completed cleaning sessions match these filters.</div>';
      return;
    }
    els.cleaningsList.innerHTML = rows.map((row) => {
      const services = Array.isArray(row.services_performed) ? row.services_performed : [];
      return `<article class="dataCard" data-session-id="${escapeHtml(row.session_id)}">
        <div>
          <h3>${escapeHtml(row.location_name || row.location_code || 'Unknown location')}</h3>
          <p>${escapeHtml(row.employee_name || 'Unknown employee')} · ${escapeHtml(dateTime(row.started_at))}</p>
          <div class="dataMeta">
            <span class="metaChip">${escapeHtml(minutes(row.duration_minutes))}</span>
            <span class="metaChip">${services.length ? escapeHtml(services.join(', ')) : 'No services listed'}</span>
            ${Number(row.maintenance_ticket_count || 0) ? `<span class="metaChip">${number(row.maintenance_ticket_count)} linked ticket${Number(row.maintenance_ticket_count) === 1 ? '' : 's'}</span>` : ''}
          </div>
          ${row.cleaning_note ? `<p>${escapeHtml(row.cleaning_note)}</p>` : ''}
        </div>
        <div class="metricGrid">
          <div class="metric"><span>Open tickets</span><strong>${number(row.open_maintenance_ticket_count || 0)}</strong></div>
          <div class="metric"><span>Finished</span><strong>${escapeHtml(dateTime(row.ended_at || row.completion_submitted_at))}</strong></div>
        </div>
      </article>`;
    }).join('');
  }

  function renderTickets() {
    const countKey = `ticket_count_last_${state.ticketWindow}_days`;
    const rows = state.tickets;
    if (!rows.length) {
      els.ticketsList.innerHTML = `<div class="emptyState">No recurring maintenance patterns were found in the last ${state.ticketWindow} days.</div>`;
      return;
    }
    els.ticketsList.innerHTML = rows.map((row) => {
      const recurrence = String(row.recurrence_status || 'isolated').toLowerCase();
      const fixture = [row.fixture_type, row.fixture_identifier].filter(Boolean).join(' · ') || 'Unspecified fixture';
      return `<article class="dataCard">
        <div>
          <h3>${escapeHtml(row.location_name || row.location_code || 'Unknown location')}</h3>
          <p>${escapeHtml(row.issue_category || row.issue_category_key || 'Uncategorized')} · ${escapeHtml(fixture)}</p>
          <div class="dataMeta">
            <span class="metaChip">${number(row[countKey] || 0)} in ${state.ticketWindow} days</span>
            <span class="metaChip">${number(row.total_ticket_count || 0)} total</span>
            <span class="metaChip">${number(row.open_ticket_count || 0)} open</span>
          </div>
        </div>
        <div class="metricGrid">
          <div class="metric"><span>First reported</span><strong>${escapeHtml(dateTime(row.first_reported_at))}</strong></div>
          <div class="metric"><span>Latest reported</span><strong>${escapeHtml(dateTime(row.latest_reported_at))}</strong></div>
          <div class="metric"><span>Average resolution</span><strong>${row.average_resolution_hours == null ? '—' : `${number(row.average_resolution_hours, 1)} hr`}</strong></div>
          <div class="metric"><span>Issue signature</span><strong>${escapeHtml(String(row.issue_signature || '').slice(0, 8) || '—')}</strong></div>
        </div>
        <div class="dataAction"><span class="trendPill ${escapeHtml(recurrence)}">${escapeHtml(recurrence)}</span></div>
      </article>`;
    }).join('');
  }


  function renderAll() {
    fillSelect(els.performanceEmployee, uniqueOptions([...state.performance, ...state.cleanings], 'employee_id', 'employee_name'), 'All employees');
    fillSelect(els.cleaningsEmployee, uniqueOptions([...state.performance, ...state.cleanings], 'employee_id', 'employee_name'), 'All employees');
    fillSelect(els.performanceLocation, uniqueOptions([...state.performance, ...state.cleanings], 'location_id', 'location_name'), 'All locations');
    fillSelect(els.cleaningsLocation, uniqueOptions([...state.performance, ...state.cleanings], 'location_id', 'location_name'), 'All locations');
    renderSummary();
    renderPerformance();
    renderCleanings();
    renderTickets();
  }

  async function loadPerformance() {
    state.performance = await request(query('/analytics-api/cleaning-performance', {
      employee_id: els.performanceEmployee.value,
      location_id: els.performanceLocation.value,
      minimum_cleanings: els.performanceMinimum.value || 1,
      limit: 500,
    })) || [];
    renderAll();
  }

  async function loadCleanings() {
    state.cleanings = await request(query('/analytics-api/session-facts', {
      employee_id: els.cleaningsEmployee.value,
      location_id: els.cleaningsLocation.value,
      date_from: els.cleaningsFrom.value,
      date_to: els.cleaningsTo.value,
      limit: 500,
    })) || [];
    renderAll();
  }

  async function loadTickets() {
    state.tickets = await request(query('/analytics-api/ticket-trends', {
      window_days: state.ticketWindow,
      minimum_count: state.ticketWindow === 7 ? 2 : 1,
      limit: 500,
    })) || [];
    renderAll();
  }



  async function loadAll() {
    els.refresh.disabled = true;
    setStatus('Loading operational evidence…', 'info');
    const results = await Promise.allSettled([loadPerformance(), loadCleanings(), loadTickets()]);
    const failures = results.filter((result) => result.status === 'rejected');
    els.refresh.disabled = false;
    if (failures.length) {
      setStatus(failures.map((result) => safe(result.reason)).filter((value, index, array) => array.indexOf(value) === index).join(' '), 'error');
    } else {
      const current = `Current through ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
      setStatus(current, 'ok');
    }
  }

  els.tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      const keyMoves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      let nextIndex = keyMoves[event.key] == null ? null : (index + keyMoves[event.key] + els.tabs.length) % els.tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = els.tabs.length - 1;
      if (nextIndex == null) return;
      event.preventDefault();
      setTab(els.tabs[nextIndex].dataset.tab);
      els.tabs[nextIndex].focus();
    });
  });
  els.ticketButtons.forEach((button) => button.addEventListener('click', async () => {
    state.ticketWindow = Number(button.dataset.window);
    els.ticketButtons.forEach((candidate) => candidate.classList.toggle('active', candidate === button));
    setStatus(`Loading ${state.ticketWindow}-day ticket trends…`, 'info');
    try { await loadTickets(); setStatus('Ticket trends current.', 'ok'); } catch (error) { setStatus(safe(error), 'error'); }
  }));
  els.refresh.addEventListener('click', () => void loadAll());
  els.applyPerformance.addEventListener('click', async () => {
    setStatus('Applying performance filters…', 'info');
    try { await loadPerformance(); setStatus('Performance comparison current.', 'ok'); } catch (error) { setStatus(safe(error), 'error'); }
  });
  els.applyCleanings.addEventListener('click', async () => {
    setStatus('Applying cleaning filters…', 'info');
    try { await loadCleanings(); setStatus('Cleaning facts current.', 'ok'); } catch (error) { setStatus(safe(error), 'error'); }
  });
  window.addEventListener('online', () => { if (state.activeTab) setStatus('Connection restored. Refresh to load current work statistics.', 'ok'); });

  void loadAll();
})();
