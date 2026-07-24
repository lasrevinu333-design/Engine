(() => {
  'use strict';

  const API = 'https://memphis-zoo-mcp.onrender.com';
  const state = { data: null, toastTimer: 0 };
  const els = {
    list: document.getElementById('phone-list'),
    status: document.getElementById('assignment-status'),
    search: document.getElementById('phone-search'),
    refresh: document.getElementById('refresh-assignments'),
    newForm: document.getElementById('new-employee-form'),
    newName: document.getElementById('new-employee-name'),
    newDevice: document.getElementById('new-employee-device'),
    newOffboardWrap: document.getElementById('new-offboard-wrap'),
    newOffboard: document.getElementById('new-offboard'),
    newStatus: document.getElementById('new-status'),
    create: document.getElementById('create-employee'),
    toast: document.getElementById('assignment-toast'),
  };

  function safe(error) { return error instanceof Error ? error.message : String(error || 'Unknown error'); }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }
  function operationId() { return crypto.randomUUID(); }
  function operationStorageKey(scope, values) {
    return `mz_phone_assignment_operation:${scope}:${JSON.stringify(values)}`;
  }
  function pendingOperation(scope, values) {
    const key = operationStorageKey(scope, values);
    let id = '';
    try { id = String(sessionStorage.getItem(key) || ''); } catch {}
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      id = operationId();
      try { sessionStorage.setItem(key, id); } catch {}
    }
    return { id, clear: () => { try { sessionStorage.removeItem(key); } catch {} } };
  }
  function setStatus(element, text, kind = '') {
    element.textContent = text || '';
    element.className = `uxStatus${kind ? ` ${kind}` : ''}`;
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
  async function request(path, { method = 'GET', body = null } = {}) {
    if (window.MemphisMobile?.requestEnvelope) return window.MemphisMobile.requestEnvelope(path, { method, body });
    const headers = await authHeaders();
    if (body != null) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${API}${path}`, {
      method, cache: 'no-store', credentials: 'include', headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload.data;
  }
  function employeeOptions(device) {
    const current = String(device.assigned_employee_id || '');
    return [
      '<option value="">Unassigned</option>',
      ...(state.data?.employees || []).map((employee) => {
        const assignedElsewhere = employee.assigned_device_id && employee.assigned_device_id !== device.device_id;
        const suffix = assignedElsewhere ? ` · ${employee.assigned_device_id}` : '';
        return `<option value="${escapeHtml(employee.id)}" ${employee.id === current ? 'selected' : ''} ${assignedElsewhere ? 'disabled' : ''}>${escapeHtml(employee.display_name)} · ${escapeHtml(employee.employee_code || '')}${escapeHtml(suffix)}</option>`;
      }),
    ].join('');
  }
  function rowView(device) {
    const current = device.employee_name || 'Unassigned';
    const search = `${device.device_id} ${device.device_name || ''} ${current}`.toLowerCase();
    const needle = String(els.search.value || '').trim().toLowerCase();
    const hidden = needle && !search.includes(needle);
    const canOffboard = Boolean(device.assigned_employee_id);
    return `<article class="phoneRow${hidden ? ' hidden' : ''}" data-device="${escapeHtml(device.device_id)}" data-current="${escapeHtml(device.assigned_employee_id || '')}">
      <div>
        <div class="phoneId">${escapeHtml(device.device_id)}</div>
        <div class="phoneCurrent">Current employee: <strong>${escapeHtml(current)}</strong>${device.employee_code ? ` · ${escapeHtml(device.employee_code)}` : ''}</div>
        <div class="phoneLastSeen">${device.last_seen_at ? `Last seen ${escapeHtml(new Date(device.last_seen_at).toLocaleString())}` : 'No recent heartbeat'}</div>
      </div>
      <div class="phoneControls">
        <select class="uxSelect" data-employee aria-label="Employee for ${escapeHtml(device.device_id)}">${employeeOptions(device)}</select>
        <label class="offboard${canOffboard ? '' : ' hidden'}"><input data-offboard type="checkbox"><span>Deactivate ${escapeHtml(current)} after this phone is moved.</span></label>
      </div>
      <div class="phoneActionRow"><button class="uxButton primary compact" data-save type="button">Save Assignment</button><button class="uxButton compact" data-code type="button" ${device.assigned_employee_id ? '' : 'disabled'}>Generate App Code</button></div>
      <div class="appCode hidden" data-app-code></div>
      <div class="rowStatus" data-row-status></div>
    </article>`;
  }
  function render() {
    const devices = state.data?.devices || [];
    els.list.innerHTML = devices.map(rowView).join('') || '<div class="uxMuted">No employee kiosk phones were found.</div>';
    const selected = els.newDevice.value;
    els.newDevice.innerHTML = '<option value="">Create without a phone</option>' + devices.map((device) =>
      `<option value="${escapeHtml(device.device_id)}">${escapeHtml(device.device_id)} · ${escapeHtml(device.employee_name || 'Unassigned')}</option>`
    ).join('');
    if (devices.some((device) => device.device_id === selected)) els.newDevice.value = selected;
    updateNewOffboard();
  }
  async function load() {
    setStatus(els.status, 'Loading phone assignments…', 'info');
    try {
      state.data = await request('/leadership-api/phone-assignments');
      render();
      setStatus(els.status, `${state.data.devices?.length || 0} kiosk phones ready.`, 'ok');
    } catch (error) {
      setStatus(els.status, safe(error), 'error');
    }
  }
  function updateNewOffboard() {
    const device = (state.data?.devices || []).find((row) => row.device_id === els.newDevice.value);
    els.newOffboardWrap.classList.toggle('hidden', !device?.assigned_employee_id);
    if (!device?.assigned_employee_id) els.newOffboard.checked = false;
  }
  async function saveRow(row) {
    const deviceId = row.dataset.device;
    const employeeId = row.querySelector('[data-employee]').value || null;
    const currentId = row.dataset.current || null;
    const offboard = row.querySelector('[data-offboard]').checked;
    if (String(employeeId || '') === String(currentId || '')) return showToast('That phone is already assigned to that employee.');
    const nextLabel = employeeId
      ? (state.data.employees.find((employee) => employee.id === employeeId)?.display_name || 'selected employee')
      : 'Unassigned';
    if (!confirm(`Change ${deviceId} to ${nextLabel}?${offboard ? ' The former employee will also be deactivated.' : ''}`)) return;
    const button = row.querySelector('[data-save]');
    const status = row.querySelector('[data-row-status]');
    button.disabled = true;
    status.textContent = 'Saving…';
    status.className = 'rowStatus';
    const pending = pendingOperation('assign', { deviceId, employeeId, currentId, offboard });
    try {
      const data = await request(`/leadership-api/phone-assignments/${encodeURIComponent(deviceId)}`, {
        method: 'POST',
        body: {
          operation_id: pending.id, employee_id: employeeId,
          expected_current_employee_id: currentId, deactivate_previous: offboard,
        },
      });
      status.textContent = `Assigned to ${data.employee?.display_name || 'Unassigned'}.`;
      status.className = 'rowStatus ok';
      pending.clear();
      showToast('Phone assignment updated.', 'ok');
      await load();
    } catch (error) {
      status.textContent = safe(error);
      status.className = 'rowStatus error';
      button.disabled = false;
    }
  }

  async function generateCode(row) {
    const deviceId = row.dataset.device;
    const button = row.querySelector('[data-code]');
    const output = row.querySelector('[data-app-code]');
    button.disabled = true;
    output.classList.remove('hidden');
    output.textContent = 'Generating single-use app code…';
    try {
      const data = await request(`/leadership-api/phone-assignments/${encodeURIComponent(deviceId)}/enrollment-code`, { method: 'POST', body: { operation_id: operationId() } });
      const code = data.display_code || String(data.enrollment_code || '').replace(/(\d{4})(\d{4})/, '$1 $2');
      const expires = data.expires_at ? new Date(data.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
      output.innerHTML = `<div><span class="codeLabel">Employee app code</span><strong class="codeValue">${escapeHtml(code)}</strong><span class="codeExpiry">Single use${expires ? ` · expires ${escapeHtml(expires)}` : ''}</span></div><button class="uxButton compact" data-copy-code="${escapeHtml(String(data.enrollment_code || code).replace(/\D/g, ''))}" type="button">Copy Code</button>`;
      showToast('Employee app code generated.', 'ok');
    } catch (error) {
      output.textContent = safe(error);
      output.classList.add('error');
      button.disabled = false;
    }
  }

  async function createEmployee(event) {
    event.preventDefault();
    const name = String(els.newName.value || '').trim();
    if (!name) return setStatus(els.newStatus, 'Enter the new employee’s name.', 'error');
    const deviceId = els.newDevice.value || null;
    const device = (state.data?.devices || []).find((row) => row.device_id === deviceId);
    const offboard = Boolean(deviceId && els.newOffboard.checked);
    if (!confirm(`Create ${name}${deviceId ? ` and assign ${deviceId}` : ''}?${offboard && device?.employee_name ? ` ${device.employee_name} will be deactivated.` : ''}`)) return;
    els.create.disabled = true;
    setStatus(els.newStatus, 'Creating employee and assignment…', 'info');
    const pending = pendingOperation('create', {
      name: name.toLowerCase(),
      deviceId,
      expected: device?.assigned_employee_id || null,
      offboard,
    });
    try {
      const data = await request(`/leadership-api/phone-assignments/${encodeURIComponent(deviceId || 'unassigned')}`, {
        method: 'POST',
        body: {
          operation_id: pending.id, new_employee_name: name,
          expected_current_employee_id: device?.assigned_employee_id || null,
          deactivate_previous: offboard,
        },
      });
      els.newForm.reset();
      pending.clear();
      setStatus(els.newStatus, `${data.employee.display_name} created as ${data.employee.employee_code}${data.device?.device_id ? ` and assigned to ${data.device.device_id}` : ''}.`, 'ok');
      showToast('New employee created.', 'ok');
      await load();
    } catch (error) {
      setStatus(els.newStatus, safe(error), 'error');
    } finally {
      els.create.disabled = false;
    }
  }

  els.list.addEventListener('click', (event) => {
    const save = event.target.closest('[data-save]');
    if (save) return void saveRow(save.closest('[data-device]'));
    const code = event.target.closest('[data-code]');
    if (code) return void generateCode(code.closest('[data-device]'));
    const copy = event.target.closest('[data-copy-code]');
    if (copy) { navigator.clipboard?.writeText(copy.dataset.copyCode || '').then(() => showToast('Code copied.', 'ok')).catch(() => showToast('Could not copy code.', 'error')); }
  });
  els.search.addEventListener('input', render);
  els.refresh.addEventListener('click', () => void load());
  els.newDevice.addEventListener('change', updateNewOffboard);
  els.newForm.addEventListener('submit', createEmployee);
  void load();
})();
