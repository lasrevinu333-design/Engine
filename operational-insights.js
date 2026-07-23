(() => {
  'use strict';

  const API = 'https://memphis-zoo-mcp.onrender.com';
  const state = {
    activeTab: 'performance',
    performance: [],
    cleanings: [],
    tickets: [],
    inspections: [],
    ticketWindow: 7,
    selectedSession: null,
    inspectionOperationId: '',
    inspectionPayloadSignature: '',
    toastTimer: 0,
  };

  const els = {
    refresh: document.getElementById('refresh-insights'),
    status: document.getElementById('global-status'),
    tabs: Array.from(document.querySelectorAll('[data-tab]')),
    panels: Array.from(document.querySelectorAll('[data-panel]')),
    summaryCleanings: document.getElementById('summary-cleanings'),
    summaryDuration: document.getElementById('summary-duration'),
    summaryScore: document.getElementById('summary-score'),
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
    overlay: document.getElementById('inspection-overlay'),
    dialog: document.querySelector('.inspectionDialog'),
    closeInspection: document.getElementById('close-inspection'),
    cancelInspection: document.getElementById('cancel-inspection'),
    inspectionForm: document.getElementById('inspection-form'),
    inspectionSummary: document.getElementById('inspection-session-summary'),
    inspectionType: document.getElementById('inspection-type'),
    appearance: document.getElementById('appearance-score'),
    sanitation: document.getElementById('sanitation-score'),
    supplies: document.getElementById('supplies-score'),
    detail: document.getElementById('detail-score'),
    safety: document.getElementById('safety-score'),
    scoreInputs: Array.from(document.querySelectorAll('.scoreInput')),
    overall: document.getElementById('overall-score'),
    overallResult: document.getElementById('overall-result'),
    critical: document.getElementById('critical-failure'),
    followUp: document.getElementById('follow-up-required'),
    notes: document.getElementById('inspection-notes'),
    saveInspection: document.getElementById('save-inspection'),
    inspectionStatus: document.getElementById('inspection-status'),
    toast: document.getElementById('insights-toast'),
  };

  const scoreOptions = [
    [100, 'Excellent'],
    [90, 'Good'],
    [80, 'Acceptable'],
    [65, 'Needs work'],
    [40, 'Failed'],
  ];

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

  function setInspectionStatus(text = '', kind = '') {
    els.inspectionStatus.textContent = text;
    els.inspectionStatus.className = `uxStatus${kind ? ` ${kind}` : ''}`;
  }

  function showToast(message, kind = '') {
    clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.className = `uxToast show ${kind}`.trim();
    state.toastTimer = setTimeout(() => { els.toast.className = 'uxToast'; }, 2600);
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

  function scoreClass(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 'none';
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
    const inspectionRows = state.performance.filter((row) => Number(row.inspection_count || 0) > 0 && Number.isFinite(Number(row.average_inspection_score)));
    const totalInspections = inspectionRows.reduce((sum, row) => sum + Number(row.inspection_count || 0), 0);
    const weightedScore = inspectionRows.reduce((sum, row) => sum + Number(row.average_inspection_score || 0) * Number(row.inspection_count || 0), 0);
    const hotspots = state.tickets.filter((row) => ['hotspot', 'recurring', 'repeat'].includes(String(row.recurrence_status || ''))).length;
    els.summaryCleanings.textContent = number(totalCleanings);
    els.summaryDuration.textContent = totalCleanings ? minutes(weightedDuration / totalCleanings) : '—';
    els.summaryScore.textContent = totalInspections ? `${number(weightedScore / totalInspections, 1)}%` : 'Not yet';
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
      const score = Number(row.average_inspection_score);
      const scoreText = Number.isFinite(score) ? `${number(score, 1)}%` : 'No inspections';
      const deltaText = Number.isFinite(delta) ? `${delta > 0 ? '+' : ''}${number(delta, 1)} min vs location` : 'No location baseline';
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
    if (!rows.length) {
      els.cleaningsList.innerHTML = '<div class="emptyState">No completed cleaning sessions match these filters.</div>';
      return;
    }
    els.cleaningsList.innerHTML = rows.map((row) => {
      const services = Array.isArray(row.services_performed) ? row.services_performed : [];
      const finished = ['closed', 'pending_submit'].includes(String(row.status || '').toLowerCase());
      const score = Number(row.latest_inspection_score);
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
          <div class="metric"><span>Inspection count</span><strong>${number(row.inspection_count || 0)}</strong></div>
          <div class="metric"><span>Latest score</span><strong>${Number.isFinite(score) ? `${number(score)}%` : 'Not inspected'}</strong></div>
          <div class="metric"><span>Open tickets</span><strong>${number(row.open_maintenance_ticket_count || 0)}</strong></div>
          <div class="metric"><span>Finished</span><strong>${escapeHtml(dateTime(row.ended_at || row.completion_submitted_at))}</strong></div>
        </div>
        <div class="dataAction">
          <span class="scorePill ${scoreClass(score)}">${Number.isFinite(score) ? `${number(score)}%` : 'Uninspected'}</span>
          <button class="uxButton primary compact" data-inspect type="button" ${finished ? '' : 'disabled'}>Inspect</button>
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

  function renderInspections() {
    const rows = state.inspections;
    if (!rows.length) {
      els.inspectionsList.innerHTML = '<div class="emptyState">No manager inspections have been recorded yet. Open Recent Cleanings and inspect a finished session.</div>';
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
      <div class="dataAction"><span class="scorePill ${row.passed ? 'good' : 'bad'}">${number(row.overall_score)}% · ${row.passed ? 'Pass' : 'Needs work'}</span></div>
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

  async function loadInspections() {
    state.inspections = await request('/analytics-api/inspections?limit=300') || [];
    renderAll();
  }

  async function loadAll() {
    els.refresh.disabled = true;
    setStatus('Loading operational evidence…', 'info');
    const results = await Promise.allSettled([loadPerformance(), loadCleanings(), loadTickets(), loadInspections()]);
    const failures = results.filter((result) => result.status === 'rejected');
    els.refresh.disabled = false;
    if (failures.length) {
      setStatus(failures.map((result) => safe(result.reason)).filter((value, index, array) => array.indexOf(value) === index).join(' '), 'error');
    } else {
      setStatus(`Current through ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`, 'ok');
    }
  }

  function overallScore() {
    const values = els.scoreInputs.map((input) => Number(input.value)).filter(Number.isFinite);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  }

  function updateOverall() {
    const score = overallScore();
    const passed = !els.critical.checked && score >= 85;
    els.overall.textContent = String(score);
    els.overall.className = score >= 85 && !els.critical.checked ? 'good' : score >= 70 && !els.critical.checked ? 'warn' : 'bad';
    els.overallResult.textContent = els.critical.checked ? 'Critical failure · does not pass' : `${passed ? 'Pass' : 'Needs work'} · threshold 85`;
  }

  function draftKey(sessionId) { return `mz_inspection_draft:${sessionId}`; }

  function readDraft(sessionId) {
    try { return JSON.parse(localStorage.getItem(draftKey(sessionId)) || 'null'); } catch { return null; }
  }

  function writeDraft() {
    if (!state.selectedSession) return;
    const draft = {
      operation_id: state.inspectionOperationId || crypto.randomUUID(),
      inspection_type: els.inspectionType.value,
      appearance_score: Number(els.appearance.value),
      sanitation_score: Number(els.sanitation.value),
      supplies_score: Number(els.supplies.value),
      detail_score: Number(els.detail.value),
      safety_score: Number(els.safety.value),
      critical_failure: els.critical.checked,
      follow_up_required: els.followUp.checked,
      findings: Array.from(els.inspectionForm.querySelectorAll('input[name="finding"]:checked')).map((input) => input.value),
      notes: els.notes.value,
    };
    state.inspectionOperationId = draft.operation_id;
    localStorage.setItem(draftKey(state.selectedSession.session_id), JSON.stringify(draft));
  }

  function populateScoreSelect(select) {
    select.innerHTML = scoreOptions.map(([score, label]) => `<option value="${score}" ${score === 90 ? 'selected' : ''}>${score} · ${escapeHtml(label)}</option>`).join('');
  }

  function openInspection(session) {
    state.selectedSession = session;
    state.inspectionOperationId = '';
    state.inspectionPayloadSignature = '';
    els.inspectionForm.reset();
    for (const select of els.scoreInputs) select.value = '90';
    const draft = readDraft(session.session_id);
    if (draft) {
      state.inspectionOperationId = draft.operation_id || crypto.randomUUID();
      els.inspectionType.value = draft.inspection_type || 'manager_spot_check';
      for (const [element, key] of [[els.appearance, 'appearance_score'], [els.sanitation, 'sanitation_score'], [els.supplies, 'supplies_score'], [els.detail, 'detail_score'], [els.safety, 'safety_score']]) {
        if (draft[key] != null) element.value = String(draft[key]);
      }
      els.critical.checked = draft.critical_failure === true;
      els.followUp.checked = draft.follow_up_required === true;
      els.notes.value = draft.notes || '';
      const findings = new Set(Array.isArray(draft.findings) ? draft.findings : []);
      for (const input of els.inspectionForm.querySelectorAll('input[name="finding"]')) input.checked = findings.has(input.value);
    }
    els.inspectionSummary.textContent = `${session.location_name || session.location_code || 'Location'} · ${session.employee_name || 'Employee'} · ${minutes(session.duration_minutes)} cleaning`;
    setInspectionStatus(draft ? 'A saved inspection draft was restored.' : '');
    updateOverall();
    els.overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => els.inspectionType.focus());
  }

  function closeInspection() {
    els.overlay.hidden = true;
    document.body.style.overflow = '';
    state.selectedSession = null;
    state.inspectionOperationId = '';
    setInspectionStatus('');
  }

  function inspectionPayload() {
    const findings = Array.from(els.inspectionForm.querySelectorAll('input[name="finding"]:checked')).map((input) => ({ code: input.value }));
    return {
      operation_id: state.inspectionOperationId || crypto.randomUUID(),
      session_id: state.selectedSession.session_id,
      inspection_type: els.inspectionType.value,
      rubric_version: 'custodial-v1',
      overall_score: overallScore(),
      appearance_score: Number(els.appearance.value),
      sanitation_score: Number(els.sanitation.value),
      supplies_score: Number(els.supplies.value),
      detail_score: Number(els.detail.value),
      safety_score: Number(els.safety.value),
      pass_threshold: 85,
      critical_failure: els.critical.checked,
      follow_up_required: els.followUp.checked,
      findings_json: findings,
      notes: String(els.notes.value || '').trim() || null,
    };
  }

  async function submitInspection(event) {
    event.preventDefault();
    if (!state.selectedSession) return;
    writeDraft();
    const payload = inspectionPayload();
    state.inspectionOperationId = payload.operation_id;
    const signature = JSON.stringify(payload);
    if (state.inspectionPayloadSignature && state.inspectionPayloadSignature !== signature) {
      payload.operation_id = crypto.randomUUID();
      state.inspectionOperationId = payload.operation_id;
      localStorage.setItem(draftKey(state.selectedSession.session_id), JSON.stringify({ ...payload, findings: payload.findings_json.map((row) => row.code) }));
    }
    state.inspectionPayloadSignature = JSON.stringify(payload);
    els.saveInspection.disabled = true;
    setInspectionStatus('Saving inspection…', 'info');
    try {
      await request('/analytics-api/inspections', {
        method: 'POST',
        body: payload,
        headers: { 'Idempotency-Key': payload.operation_id },
      });
      localStorage.removeItem(draftKey(state.selectedSession.session_id));
      showToast('Inspection saved.', 'ok');
      closeInspection();
      await Promise.all([loadCleanings(), loadPerformance(), loadInspections()]);
    } catch (error) {
      setInspectionStatus(safe(error), 'error');
    } finally {
      els.saveInspection.disabled = false;
    }
  }

  for (const select of els.scoreInputs) populateScoreSelect(select);
  updateOverall();

  els.tabs.forEach((tab) => tab.addEventListener('click', () => setTab(tab.dataset.tab)));
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
  els.cleaningsList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-inspect]');
    if (!button) return;
    const row = button.closest('[data-session-id]');
    const session = state.cleanings.find((item) => String(item.session_id) === String(row?.dataset.sessionId));
    if (session) openInspection(session);
  });
  function inspectionChanged() {
    if (state.inspectionPayloadSignature) state.inspectionOperationId = '';
    state.inspectionPayloadSignature = '';
    updateOverall();
    writeDraft();
  }
  els.scoreInputs.forEach((input) => input.addEventListener('change', inspectionChanged));
  for (const element of [els.inspectionType, els.critical, els.followUp, els.notes, ...Array.from(els.inspectionForm.querySelectorAll('input[name="finding"]'))]) {
    element.addEventListener('input', inspectionChanged);
  }
  els.closeInspection.addEventListener('click', closeInspection);
  els.cancelInspection.addEventListener('click', closeInspection);
  els.overlay.addEventListener('click', (event) => { if (event.target === els.overlay) closeInspection(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !els.overlay.hidden) closeInspection(); });
  els.inspectionForm.addEventListener('submit', submitInspection);
  window.addEventListener('online', () => { if (state.activeTab) setStatus('Connection restored. Refresh or retry any saved inspection.', 'ok'); });

  void loadAll();
})();
