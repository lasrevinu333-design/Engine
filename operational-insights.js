(() => {
  'use strict';

  const API = 'https://memphis-zoo-mcp.onrender.com';
  const state = {
    activeTab: 'performance',
    performance: [],
    cleanings: [],
    tickets: [],
    inspections: [],
    inspectionCoverage: null,
    performanceAvailable: false,
    ticketsAvailable: false,
    cleaningsAvailable: false,
    inspectionsAvailable: false,
    ticketWindow: 7,
  };

  const els = {
    refresh: document.getElementById('refresh-insights'),
    status: document.getElementById('global-status'),
    tabs: Array.from(document.querySelectorAll('[data-tab]')),
    panels: Array.from(document.querySelectorAll('[data-panel]')),
    summaryCleanings: document.getElementById('summary-cleanings'),
    summaryDuration: document.getElementById('summary-duration'),
    summaryScore: document.getElementById('summary-score'),
    summaryCoverage: document.getElementById('summary-coverage'),
    summaryCoverageDetail: document.getElementById('summary-coverage-detail'),
    coverageCard: document.getElementById('inspection-coverage-card'),
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
    inspectionsList: document.getElementById('inspections-list'),
    evidencePanel: document.getElementById('completion-evidence-panel'),
    evidenceStatus: document.getElementById('completion-evidence-status'),
    evidenceContent: document.getElementById('completion-evidence-content'),
    evidenceHeading: document.getElementById('completion-evidence-heading'),
    closeEvidence: document.getElementById('close-completion-evidence'),
  };

  const evidenceView = window.MemphisCompletionEvidence && els.evidencePanel && els.evidenceStatus && els.evidenceContent
    ? window.MemphisCompletionEvidence.create({
    panel: els.evidencePanel, status: els.evidenceStatus, content: els.evidenceContent,
    focusTarget: els.evidenceHeading, readEnvelope: readCompletionEnvelope,
    }) : null;

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
      accessLevel: 'read_only', interactive: true, redirect: false, throwOnFailure: true,
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
    requireCurrentRead(headers);
    if (body != null) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${API}${path}`, {
      method,
      cache: 'no-store',
      credentials: 'include',
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    requireCurrentRead(headers);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload.data;
  }

  async function readCompletionEnvelope(path, {signal} = {}) {
    const headers = await authHeaders();
    requireCurrentRead(headers);
    if (signal?.aborted) throw new Error('Completion read cancelled.');
    const response = await fetch(`${API}${path}`, {
      method: 'GET', cache: 'no-store', credentials: 'include', redirect: 'error', headers, signal,
    });
    const envelope = await response.json().catch(() => null);
    requireCurrentRead(headers);
    if (!response.ok) throw Object.assign(new Error('Exact completion read unavailable.'), {status:response.status});
    return envelope;
  }

  function requireCurrentRead(headers) {
    // Native reads retain their existing adapter; normal web reads remain bound
    // to the exact signed current session that supplied the request headers.
    if (window.MemphisMobile?.authHeaders) return;
    const current = window.MemphisAuth?.readSession?.();
    if (!window.MemphisAuth?.isOpsManager?.(current) || Date.parse(current.expires_at) <= Date.now() ||
        !Number.isFinite(Date.parse(current.expires_at)) || headers.Authorization !== `Bearer ${current.token}` ||
        headers['X-Device-Id'] !== (current.device_id || window.MemphisAuth?.getDeviceId?.() || '')) {
      throw new Error('Current Custodial Manager session changed. Refresh with the current session.');
    }
  }

  function rows(value) {
    if (!Array.isArray(value) || value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Operational evidence unavailable.');
    return value;
  }

  function query(path, parameters = {}) {
    const url = new URL(path, API);
    for (const [key, value] of Object.entries(parameters)) if (value !== '' && value != null) url.searchParams.set(key, String(value));
    return `${url.pathname}${url.search}`;
  }

  function numeric(value) {
    if (!(typeof value === 'number' || typeof value === 'string' && value.trim())) return null;
    const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null;
  }

  function number(value, digits = 0) {
    const parsed = numeric(value);
    return parsed !== null ? parsed.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
  }

  function dateTime(value) {
    if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return '—';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString([], { timeZone:'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  }

  function minutes(value) {
    const parsed = numeric(value);
    if (parsed === null || parsed < 0) return '—';
    if (parsed < 60) return `${Math.round(parsed)} min`;
    const hours = Math.floor(parsed / 60);
    const remainder = Math.round(parsed % 60);
    return `${hours}h${remainder ? ` ${remainder}m` : ''}`;
  }

  function scoreClass(value) {
    const parsed = numeric(value);
    if (parsed === null || parsed < 0 || parsed > 100) return 'none';
    if (parsed >= 85) return 'good';
    if (parsed >= 70) return 'warn';
    return 'bad';
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
    const countsKnown = state.performanceAvailable && state.performance.every(row => Number.isSafeInteger(numeric(row.cleaning_count)) && numeric(row.cleaning_count) >= 0);
    const totalCleanings = countsKnown ? state.performance.reduce((sum, row) => sum + numeric(row.cleaning_count), 0) : null;
    const durationsKnown = countsKnown && state.performance.every(row => numeric(row.cleaning_count) === 0 || numeric(row.average_duration_minutes) !== null && numeric(row.average_duration_minutes) >= 0);
    const weightedDuration = durationsKnown ? state.performance.reduce((sum, row) => sum + (numeric(row.average_duration_minutes) ?? 0) * numeric(row.cleaning_count), 0) : null;
    const inspectionsKnown = state.performanceAvailable && state.performance.every(row => Number.isSafeInteger(numeric(row.inspection_count)) && numeric(row.inspection_count) >= 0);
    const inspectionRows = state.performance.filter(row => numeric(row.inspection_count) > 0);
    const scoresKnown = inspectionsKnown && inspectionRows.every(row => numeric(row.average_inspection_score) !== null && numeric(row.average_inspection_score) >= 0 && numeric(row.average_inspection_score) <= 100);
    const totalInspections = inspectionsKnown ? inspectionRows.reduce((sum, row) => sum + numeric(row.inspection_count), 0) : null;
    const weightedScore = scoresKnown ? inspectionRows.reduce((sum, row) => sum + numeric(row.average_inspection_score) * numeric(row.inspection_count), 0) : null;
    const hotspots = state.tickets.filter((row) => ['hotspot', 'recurring', 'repeat'].includes(String(row.recurrence_status || ''))).length;
    els.summaryCleanings.textContent = number(totalCleanings);
    els.summaryDuration.textContent = totalCleanings && durationsKnown ? minutes(weightedDuration / totalCleanings) : '—';
    els.summaryScore.textContent = totalInspections && scoresKnown ? `${number(weightedScore / totalInspections, 1)}%` : totalInspections === 0 ? 'Not yet' : '—';
    const coverage = state.inspectionCoverage;
    els.summaryCoverage.textContent = coverage ? number(coverage.inspected_session_count) : '—';
    els.summaryCoverageDetail.textContent = coverage
      ? `${number(coverage.inspected_session_count)} of ${number(coverage.completed_session_count)} sessions sampled · no quota`
      : 'Rolling 30-day sample · no quota';
    els.coverageCard.classList.remove('needsAttention');
    els.summaryHotspots.textContent = number(state.ticketsAvailable ? hotspots : null);
  }

  function renderPerformance() {
    const rows = state.performance;
    if (!state.performanceAvailable) { els.performanceList.innerHTML = '<div class="emptyState">Performance evidence unavailable.</div>'; return; }
    if (!rows.length) {
      els.performanceList.innerHTML = '<div class="emptyState">No employee/location comparisons match these filters yet. More completed cleanings will build the baseline.</div>';
      return;
    }
    els.performanceList.innerHTML = rows.map((row) => {
      const delta = numeric(row.duration_delta_from_location_minutes);
      const score = numeric(row.average_inspection_score);
      const scoreText = score !== null && scoreClass(score) !== 'none' ? `${number(score, 1)}%` : numeric(row.inspection_count) === 0 ? 'No inspections' : 'Inspection score unavailable';
      const deltaText = delta !== null ? `${delta > 0 ? '+' : ''}${number(delta, 1)} min vs location` : 'No location baseline';
      const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
      return `<article class="dataCard">
        <div>
          <h3>${escapeHtml(row.employee_name || 'Unknown employee')} · ${escapeHtml(row.location_name || row.location_code || 'Unknown location')}</h3>
          <p>${escapeHtml(row.employee_code || '')}${row.cleanings_last_30_days != null ? ` · ${number(row.cleanings_last_30_days)} cleanings in the last 30 days` : ''}</p>
          <div class="dataMeta">
            <span class="metaChip">${number(row.cleaning_count)} total cleanings</span>
            <span class="metaChip">${number(row.inspection_count)} inspections</span>
            <span class="metaChip">${number(row.maintenance_ticket_count)} linked tickets</span>
          </div>
        </div>
        <div class="metricGrid">
          <div class="metric"><span>Average time</span><strong>${minutes(row.average_duration_minutes)}</strong></div>
          <div class="metric"><span>Median time</span><strong>${minutes(row.median_duration_minutes)}</strong></div>
          <div class="metric"><span>Location comparison</span><strong class="delta ${deltaClass}">${escapeHtml(deltaText)}</strong></div>
          <div class="metric"><span>Inspection pass rate</span><strong>${row.inspection_pass_rate_pct == null ? '—' : `${number(row.inspection_pass_rate_pct, 1)}%`}</strong></div>
        </div>
        <div class="dataAction"><span class="scorePill ${scoreClass(score)}">${escapeHtml(scoreText)}</span><small class="uxMuted">Latest ${escapeHtml(dateTime(row.latest_cleaning_at))}</small></div>
      </article>`;
    }).join('');
  }

  function renderCleanings() {
    const rows = state.cleanings;
    if (!state.cleaningsAvailable) { els.cleaningsList.innerHTML = '<div class="emptyState">Cleaning history unavailable.</div>'; return; }
    if (!rows.length) {
      els.cleaningsList.innerHTML = '<div class="emptyState">No completed cleaning sessions match these filters.</div>';
      return;
    }
    els.cleaningsList.innerHTML = rows.map((row) => {
      const services = Array.isArray(row.services_performed) ? row.services_performed : [];
      const score = numeric(row.latest_inspection_score);
      const scoreKnown = score !== null && scoreClass(score) !== 'none';
      const scoreUnknown = numeric(row.inspection_count) === 0 ? 'Not inspected' : 'Inspection score unavailable';
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
          <div class="metric"><span>Historical inspection count</span><strong>${number(row.inspection_count)}</strong></div>
          <div class="metric"><span>Historical score</span><strong>${scoreKnown ? `${number(score)}%` : scoreUnknown}</strong></div>
          <div class="metric"><span>Open tickets</span><strong>${number(row.open_maintenance_ticket_count)}</strong></div>
          <div class="metric"><span>Finished</span><strong>${escapeHtml(dateTime(row.ended_at || row.completion_submitted_at))}</strong></div>
        </div>
        <div class="dataAction">
          <span class="scorePill ${scoreClass(score)}">${scoreKnown ? `${number(score)}%` : scoreUnknown}</span>
          <small class="uxMuted">Historical inspection records only; new recording is retired.</small>
          ${evidenceView && window.MemphisCompletionEvidence.canReadRow(row) ? `<button class="uxButton compact" type="button" data-completion-evidence data-session-uuid="${escapeHtml(row.session_uuid)}">View completion record</button>` : `<small class="uxMuted">${evidenceView ? 'Exact session identity unavailable.' : 'Exact completion view unavailable; existing history is preserved.'}</small>`}
        </div>
      </article>`;
    }).join('');
  }

  function renderTickets() {
    const countKey = `ticket_count_last_${state.ticketWindow}_days`;
    const rows = state.tickets;
    if (!state.ticketsAvailable) { els.ticketsList.innerHTML = '<div class="emptyState">Ticket trends unavailable.</div>'; return; }
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
            <span class="metaChip">${number(row[countKey])} in ${state.ticketWindow} days</span>
            <span class="metaChip">${number(row.total_ticket_count)} total</span>
            <span class="metaChip">${number(row.open_ticket_count)} open</span>
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

  function renderInspections() {
    const rows = state.inspections;
    if (!state.inspectionsAvailable) { els.inspectionsList.innerHTML = '<div class="emptyState">Historical inspection evidence unavailable.</div>'; return; }
    if (!rows.length) {
      els.inspectionsList.innerHTML = '<div class="emptyState">No historical inspection records match this view. New inspection recording is not part of this program.</div>';
      return;
    }
    els.inspectionsList.innerHTML = rows.map((row) => `<article class="dataCard">
      <div>
        <h3>${escapeHtml(row.location_name_snapshot || 'Unknown location')}</h3>
        <p>${escapeHtml(row.employee_name_snapshot || 'Unknown employee')} · inspected by ${escapeHtml(row.inspector_name_snapshot || 'Custodial Manager')}</p>
        <div class="dataMeta">
          <span class="metaChip">${escapeHtml(String(row.inspection_type || '').replaceAll('_', ' '))}</span>
          <span class="metaChip">${escapeHtml(minutes(row.session_duration_minutes))} cleaning</span>
          ${row.follow_up_required ? '<span class="metaChip">Follow-up required</span>' : ''}
          ${row.critical_failure ? '<span class="metaChip">Critical failure</span>' : ''}
        </div>
        ${row.notes ? `<p>${escapeHtml(row.notes)}</p>` : ''}
      </div>
      <div class="metricGrid">
        <div class="metric"><span>Appearance</span><strong>${row.appearance_score == null ? '—' : `${number(row.appearance_score)}%`}</strong></div>
        <div class="metric"><span>Sanitation</span><strong>${row.sanitation_score == null ? '—' : `${number(row.sanitation_score)}%`}</strong></div>
        <div class="metric"><span>Detail</span><strong>${row.detail_score == null ? '—' : `${number(row.detail_score)}%`}</strong></div>
        <div class="metric"><span>Inspected</span><strong>${escapeHtml(dateTime(row.inspected_at))}</strong></div>
      </div>
      <div class="dataAction"><span class="scorePill ${row.passed === true ? 'good' : row.passed === false ? 'bad' : 'none'}">${number(row.overall_score)}% · ${row.passed === true ? 'Pass' : row.passed === false ? 'Needs work' : 'Outcome unavailable'}</span></div>
    </article>`).join('');
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
    renderInspections();
  }

  async function loadPerformance() {
    state.performanceAvailable = false;
    state.performance = rows(await request(query('/analytics-api/cleaning-performance', {
      employee_id: els.performanceEmployee.value,
      location_id: els.performanceLocation.value,
      minimum_cleanings: els.performanceMinimum.value || 1,
      limit: 500,
    })));
    state.performanceAvailable = true;
    renderAll();
  }

  async function loadCleanings() {
    evidenceView?.clear();
    state.cleaningsAvailable = false;
    state.cleanings = rows(await request(query('/analytics-api/session-facts', {
      employee_id: els.cleaningsEmployee.value,
      location_id: els.cleaningsLocation.value,
      date_from: els.cleaningsFrom.value,
      date_to: els.cleaningsTo.value,
      limit: 500,
    })));
    state.cleaningsAvailable = true;
    renderAll();
  }

  async function loadTickets() {
    state.ticketsAvailable = false;
    state.tickets = rows(await request(query('/analytics-api/ticket-trends', {
      window_days: state.ticketWindow,
      minimum_count: state.ticketWindow === 7 ? 2 : 1,
      limit: 500,
    })));
    state.ticketsAvailable = true;
    renderAll();
  }

  async function loadInspections() {
    state.inspectionsAvailable = false;
    state.inspections = rows(await request('/analytics-api/inspections?limit=300'));
    state.inspectionsAvailable = true;
    renderAll();
  }

  async function loadInspectionCoverage() {
    state.inspectionCoverage = await request('/analytics-api/inspection-coverage') || null;
    renderSummary();
  }

  async function loadAll() {
    els.refresh.disabled = true;
    setStatus('Loading operational evidence…', 'info');
    const results = await Promise.allSettled([loadPerformance(), loadCleanings(), loadTickets(), loadInspections(), loadInspectionCoverage()]);
    const failures = results.filter((result) => result.status === 'rejected');
    els.refresh.disabled = false;
    if (failures.length) {
      renderAll();
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
  // Historical inspection records stay read-only. Do not create, mutate or
  // delete any legacy browser draft while removing the retired entry surface.
  els.cleaningsList.addEventListener('click', event => {
    const button = event.target.closest('[data-completion-evidence]');
    if (!button) return;
    if (!evidenceView) { setStatus('Exact completion view unavailable. No record was changed.', 'error'); return; }
    const card = button.closest('[data-session-id]');
    const rows = state.cleanings.filter(row => row.session_id === card?.dataset.sessionId && row.session_uuid === button.dataset.sessionUuid);
    if (rows.length !== 1) { evidenceView.clear(); setStatus('Exact session selection changed. Refresh cleaning facts.', 'error'); return; }
    void evidenceView.open(rows[0], button);
  });
  els.closeEvidence?.addEventListener('click', () => evidenceView?.clear({returnToSelection:true}));
  window.addEventListener('pagehide', () => evidenceView?.clear());
  window.addEventListener('online', () => { if (state.activeTab) setStatus('Connection restored. Refresh operational evidence.', 'ok'); });

  void loadAll();
})();
