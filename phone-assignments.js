(() => {
  'use strict';

  const API = 'https://memphis-zoo-mcp.onrender.com';
  const state = { data: null, toastTimer: 0, activating: new Set() };
  const activationKey = 'custodial.manager.activation-requests.v1';
  const terminalActivation = new Set(['native_active','not_required','expired','cancelled','error']);
  const els = {
    list: document.getElementById('phone-list'),
    status: document.getElementById('assignment-status'),
    search: document.getElementById('phone-search'),
    refresh: document.getElementById('refresh-assignments'),
    toast: document.getElementById('assignment-toast'),
  };

  function safe(error) { return error instanceof Error ? error.message : String(error || 'Unknown error'); }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }
  function operationId() { return crypto.randomUUID(); }
  function expectedAssignment(device) {
    const expectedAssignmentPresent = Object.prototype.hasOwnProperty.call(device || {}, 'assigned_employee_id');
    if (!expectedAssignmentPresent) return { present: false, value: undefined };
    const raw = device.assigned_employee_id;
    return { present: true, value: raw == null || raw === '' ? null : String(raw) };
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
  async function request(path, { method = 'GET', body = null, headers: extraHeaders = {} } = {}) {
    if (window.MemphisMobile?.requestEnvelope) return (await window.MemphisMobile.requestEnvelope(path, { method, body, headers: extraHeaders })).data;
    const headers = { ...await authHeaders(), ...extraHeaders };
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
  function timestamp(value) {
    const parsed = new Date(value || '');
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : '';
  }
  function operationalWarnings(device) {
    const warnings = [];
    const pending = Math.max(0, Number(device.pending_work_count || 0));
    const reported = timestamp(device.pending_work_reported_at);
    if (device.pending_work_status === 'unavailable') warnings.push('Pending phone-work status is unavailable');
    else if (device.pending_work_status === 'stale') warnings.push(`Pending phone-work status is stale${reported ? ` (last reported ${reported})` : ''}`);
    const groups = Array.isArray(device.pending_work_groups) ? device.pending_work_groups : [];
    for (const group of groups) {
      const count = Math.max(0, Number(group.queue_count || 0));
      if (!count) continue;
      const actor = state.data?.employees?.find((employee) => employee.id === group.employee_id);
      const actorLabel = group.employee_name || actor?.display_name || 'prior employee';
      const epoch = Number(group.assignment_epoch);
      const oldest = timestamp(group.oldest_item_at);
      warnings.push(`${count} pending phone item${count === 1 ? '' : 's'} for ${actorLabel}${Number.isSafeInteger(epoch) ? ` at assignment ${epoch}` : ''}${oldest ? `; oldest ${oldest}` : ''}`);
    }
    const unbound = Math.max(0, Number(device.pending_work_unbound_count ?? (pending - groups.reduce((total, group) => total + Math.max(0, Number(group.queue_count || 0)), 0))));
    if (unbound > 0) warnings.push(`${unbound} pending phone item${unbound === 1 ? '' : 's'} without frozen actor details${reported ? ` (reported ${reported})` : ''}`);
    else if (pending > 0 && !groups.length) {
      const oldest = timestamp(device.pending_work_oldest_at);
      warnings.push(`${pending} pending phone item${pending === 1 ? '' : 's'}${oldest ? `; oldest ${oldest}` : ''}${reported ? ` (reported ${reported})` : ''}`);
    }
    const authorityExpires = timestamp(device.offline_authority_expires_at);
    if (authorityExpires && Date.parse(device.offline_authority_expires_at) > Date.now()) {
      const actor = state.data?.employees?.find((employee) => employee.id === device.offline_authority_employee_id);
      const sameActor = String(device.offline_authority_employee_id || '') === String(device.assigned_employee_id || '');
      const actorLabel = device.offline_authority_employee_name || actor?.display_name || (sameActor ? device.employee_name : '') || 'prior employee';
      const epoch = Number(device.offline_authority_assignment_epoch);
      warnings.push(`Offline work authority for ${actorLabel}${Number.isSafeInteger(epoch) ? ` at assignment ${epoch}` : ''} expires ${authorityExpires}`);
    }
    return warnings;
  }
  function rowView(device) {
    const current = device.employee_name || 'Unassigned';
    const search = `${device.device_id} ${device.device_name || ''} ${current}`.toLowerCase();
    const needle = String(els.search.value || '').trim().toLowerCase();
    const hidden = needle && !search.includes(needle);
    return `<article class="phoneRow${hidden ? ' hidden' : ''}" data-device="${escapeHtml(device.device_id)}" data-current="${escapeHtml(device.assigned_employee_id || '')}">
      <div>
        <div class="phoneId">${escapeHtml(device.device_id)}</div>
        <div class="phoneCurrent">Current employee: <strong>${escapeHtml(current)}</strong>${device.employee_code ? ` · ${escapeHtml(device.employee_code)}` : ''}</div>
        <div class="phoneLastSeen">${device.last_seen_at ? `Last seen ${escapeHtml(new Date(device.last_seen_at).toLocaleString())}` : 'No recent heartbeat'}${device.assignment_epoch == null ? '' : ` · Assignment ${escapeHtml(device.assignment_epoch)}`}</div>
        ${operationalWarnings(device).length ? `<div class="phoneOperationalWarning">${operationalWarnings(device).map(escapeHtml).join('<br>')}</div>` : ''}
      </div>
      <div class="phoneControls">
        <select class="uxSelect" data-employee aria-label="Employee for ${escapeHtml(device.device_id)}">${employeeOptions(device)}</select>
      </div>
      <div class="phoneActionRow"><button class="uxButton primary compact" data-save type="button">Save Assignment</button></div>
      <div class="rowStatus" data-row-status></div>
      <div class="phoneActivation">
        <p>Saving an assignment does not activate the phone. Activation uses the trusted maintenance computer with this phone connected by USB; saved work is retained.</p>
        <div class="phoneActionRow"><button class="uxButton compact" data-activate type="button" ${!device.assigned_employee_id?'disabled':''}>Activate / recover phone</button>
        <button class="uxButton compact" data-activation-status type="button">Check activation status</button></div>
        <div class="rowStatus" data-activation-result role="status" aria-live="polite">No current activation result checked.</div>
      </div>
    </article>`;
  }
  function render() {
    const devices = state.data?.devices || [];
    els.list.innerHTML = devices.map(rowView).join('') || '<div class="uxMuted">No employee kiosk phones were found.</div>';
  }
  async function load() {
    setStatus(els.status, 'Loading phone assignments…', 'info');
    try {
      state.data = await request('/leadership-api/phone-assignments');
      render();
      setStatus(els.status, `${state.data.devices?.length || 0} kiosk assignments loaded. Phone activation is verified separately.`, 'ok');
    } catch (error) {
      setStatus(els.status, safe(error), 'error');
    }
  }

  function savedActivation(deviceId) {
    const raw=localStorage.getItem(activationKey);
    if(!raw)return null;
    const saved=JSON.parse(raw);
    if(saved.version!==1||!Array.isArray(saved.requests))throw new Error('Saved activation request history is unreadable. No activation was sent.');
    return saved.requests.filter(item=>item.device_id===deviceId).at(-1)||null;
  }
  function persistActivation(record) {
    const raw=localStorage.getItem(activationKey),saved=raw?JSON.parse(raw):{version:1,requests:[]};
    if(saved.version!==1||!Array.isArray(saved.requests))throw new Error('Saved activation request history is unreadable. No activation was sent.');
    saved.requests.push(record);
    const text=JSON.stringify(saved);localStorage.setItem(activationKey,text);
    if(localStorage.getItem(activationKey)!==text)throw new Error('Could not save the exact activation request. No activation was sent.');
  }
  function activationMessage(result,record) {
    if(result?.operation_id!==record.operation_id||result.device_id!==record.device_id
      ||result.employee_id!==record.expected_employee_id||result.assignment_epoch!==record.expected_assignment_epoch
      ||!['requested','prepared','delivered','delivery_unknown',...terminalActivation].includes(result.state))
      throw new Error('Activation status does not match this exact phone assignment. Refresh assignments.');
    const labels={requested:'Requested — connect this phone to the trusted maintenance computer.',prepared:'Prepared — waiting for phone delivery.',
      delivered:'Delivered — waiting for the phone’s authenticated confirmation.',delivery_unknown:'Delivery outcome unknown — retry the same request from the maintenance computer.',
      native_active:'Phone activation confirmed by its authenticated native receipt.',not_required:'Phone authenticated successfully; no credential change was needed.',
      expired:'Request expired. A new request may be created.',cancelled:'Request cancelled because its assignment changed.',error:'Activation failed. Check the maintenance result before retrying.'};
    return `${labels[result.state]} Request: ${record.operation_id}`;
  }
  async function activationRow(row,start) {
    const deviceId=row.dataset.device;
    if(state.activating.has(deviceId))return;
    const output=row.querySelector('[data-activation-result]'),buttons=[row.querySelector('[data-activate]'),row.querySelector('[data-activation-status]')];
    state.activating.add(deviceId);buttons.forEach(button=>{button.disabled=true;});
    output.textContent='Checking exact activation request…';output.className='rowStatus';
    try {
      let record=savedActivation(deviceId),result;
      if(!start){
        if(!record){output.textContent='No activation request saved on this manager device. Nothing was sent.';return;}
        result=await request(`/custodial-admin-api/assigned-activation-operations/${encodeURIComponent(record.operation_id)}`);
      }else{
        const device=state.data.devices.find(item=>item.device_id===deviceId);
        if(!device?.assigned_employee_id||!Number.isSafeInteger(device.assignment_epoch)||device.assignment_epoch<1)
          throw new Error('Refresh and save the intended phone assignment before activation.');
        if(row.querySelector('[data-employee]').value!==device.assigned_employee_id)
          throw new Error('The employee selection has not been saved. Save Assignment first.');
        // An unknown initial response must replay the same POST, not mint a new
        // operation. Only an actual terminal server result permits a new one.
        if(record){
          try{result=await request(`/custodial-admin-api/assigned-activation-operations/${encodeURIComponent(record.operation_id)}`);}
          catch{result=null;}
          if(result){activationMessage(result,record);if(terminalActivation.has(result.state))record=null;}
        }
        if(!record){
          record={device_id:deviceId,operation_id:operationId(),expected_employee_id:device.assigned_employee_id,
            expected_assignment_epoch:device.assignment_epoch,action:'activate_or_recover'};
          persistActivation(record); // durable BEFORE request/possible issuance
        }
        if(record.expected_employee_id!==device.assigned_employee_id||record.expected_assignment_epoch!==device.assignment_epoch)
          throw new Error('The prior request belongs to an older assignment. Check its server status before another request.');
        result=await request(`/leadership-api/phone-assignments/${encodeURIComponent(deviceId)}/activation-operations`,{
          method:'POST',headers:{'Idempotency-Key':record.operation_id},body:{operation_id:record.operation_id,
            expected_employee_id:record.expected_employee_id,expected_assignment_epoch:record.expected_assignment_epoch,action:record.action}});
      }
      output.textContent=activationMessage(result,record);
      output.className=`rowStatus${['native_active','not_required'].includes(result.state)?' ok':''}`;
    }catch(error){output.textContent=`${safe(error)} Keep the same request when retrying; activation is not confirmed.`;output.className='rowStatus error';}
    finally{state.activating.delete(deviceId);buttons.forEach(button=>{button.disabled=false;});}
  }
  async function saveRow(row) {
    const deviceId = row.dataset.device;
    const employeeId = row.querySelector('[data-employee]').value || null;
    const device = state.data.devices.find((item) => item.device_id === deviceId) || {};
    const expected = expectedAssignment(device);
    if (!expected.present) return showToast('Phone assignment state is unavailable. Refresh before saving.', 'error');
    const currentId = expected.value;
    if (String(employeeId || '') === String(currentId || '')) return showToast('That phone is already assigned to that employee.');
    const nextLabel = employeeId
      ? (state.data.employees.find((employee) => employee.id === employeeId)?.display_name || 'selected employee')
      : 'Unassigned';
    const warnings = operationalWarnings(device);
    const warningText = warnings.length ? `\n\nOutstanding phone state remains attributed to its original employee:\n- ${warnings.join('\n- ')}` : '';
    if (!confirm(`Change ${deviceId} to ${nextLabel}?${warningText}`)) return;
    const button = row.querySelector('[data-save]');
    const status = row.querySelector('[data-row-status]');
    button.disabled = true;
    status.textContent = 'Saving…';
    status.className = 'rowStatus';
    try {
      const data = await request(`/leadership-api/phone-assignments/${encodeURIComponent(deviceId)}`, {
        method: 'POST',
        body: {
          operation_id: operationId(), employee_id: employeeId,
          expected_current_employee_id: expected.value,
        },
      });
      status.textContent = `Assigned to ${data.employee?.display_name || 'Unassigned'}.`;
      status.className = 'rowStatus ok';
      showToast('Phone assignment updated.', 'ok');
      await load();
    } catch (error) {
      status.textContent = safe(error);
      status.className = 'rowStatus error';
      button.disabled = false;
    }
  }


  els.list.addEventListener('click', (event) => {
    const save = event.target.closest('[data-save]');
    if (save) return void saveRow(save.closest('[data-device]'));
    const activate=event.target.closest('[data-activate]');
    if(activate)return void activationRow(activate.closest('[data-device]'),true);
    const status=event.target.closest('[data-activation-status]');
    if(status)return void activationRow(status.closest('[data-device]'),false);
  });
  els.search.addEventListener('input', render);
  els.refresh.addEventListener('click', () => void load());
  void load();
})();
