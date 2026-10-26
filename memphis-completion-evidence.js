(function installCompletionEvidence(root) {
  'use strict';
  // Canonical Start uses PostgreSQL btrim(text): ASCII spaces only, then
  // at most 200 SQL characters. Preserve the persisted identity verbatim.
  function sessionIdentity(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 400
      || value[0] === ' ' || value[value.length - 1] === ' ' || value.includes('\0')) return false;
    let characters = 0;
    for (const point of value) {
      const code = point.codePointAt(0);
      if ((code >= 0xd800 && code <= 0xdfff) || ++characters > 200) return false;
    }
    return true;
  }
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const digestPattern = /^[0-9a-f]{64}$/;
  const identityKeys = ['session_id', 'session_uuid', 'employee_id', 'location_id', 'device_id'];
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = value => typeof value === 'string' && value.length ? value : 'Not provided';
  function selection(row) {
    if (!object(row)) throw new Error('Exact session selection is required.');
    const result = {};
    for (const key of identityKeys) {
      const value = row[key];
      if (key === 'session_uuid' ? !sessionIdentity(value) : typeof value !== 'string' || !uuidPattern.test(value)) {
        throw new Error('Exact session identity is unavailable.');
      }
      result[key] = value;
    }
    if (row.completion_response_id != null) {
      if (typeof row.completion_response_id !== 'string' || !uuidPattern.test(row.completion_response_id)) throw new Error('Exact completion identity is unavailable.');
      result.completion_response_id = row.completion_response_id;
    }
    for (const key of ['employee_name', 'location_name']) if (typeof row[key] === 'string') result[key] = row[key];
    return Object.freeze(result);
  }
  function canReadRow(row) { try { selection(row); return true; } catch { return false; } }
  function readPath(row) {
    const chosen = selection(row);
    return `/admin-api/custodial/cleaning-sessions/completion-evidence?session_uuid=${encodeURIComponent(chosen.session_uuid)}`;
  }
  function validateEnvelope(envelope, chosen) {
    const expected = selection(chosen);
    if (envelope?.ok !== true || envelope.contract_version !== 'completion-evidence.v1' || !object(envelope.data)) throw new Error('Exact completion contract is unavailable.');
    const data = envelope.data;
    for (const key of identityKeys) if (data[key] !== expected[key]) throw new Error('Selected session identity changed.');
    if (typeof data.completion_recorded !== 'boolean' || data.inspection_evaluation !== 'not_performed_by_this_reader') throw new Error('Completion evidence status is unavailable.');
    if (!data.completion_recorded) {
      if (expected.completion_response_id || data.classification !== 'no_completion_record') throw new Error('Selected completion record changed.');
      return data;
    }
    if (typeof data.completion_response_id !== 'string' || !uuidPattern.test(data.completion_response_id)) throw new Error('Exact completion record identity is unavailable.');
    if (expected.completion_response_id && data.completion_response_id !== expected.completion_response_id) throw new Error('Selected completion record changed.');
    const raw = data.original_response;
    const admitted = data.native_exact_receipt_admitted === true;
    const assertedWork = data.classification === 'checked_only' || String(data.classification || '').startsWith('cleaned_');
    if (assertedWork && !admitted) throw new Error('Completion classification contradicts its receipt status.');
    if (String(data.classification || '').startsWith('cleaned_') && !['full', 'details'].includes(raw?.work_result)) throw new Error('Cleaning classification contradicts the original work answer.');
    if (admitted && data.classification === 'historical_or_unverified_completion') throw new Error('Historical classification contradicts its receipt status.');
    if (admitted && !object(raw)) throw new Error('Admitted completion answers are unavailable.');
    if (object(raw) && data.work_result != null && data.work_result !== raw.work_result) throw new Error('Original work answer changed.');
    if (data.classification === 'checked_only' && (raw?.work_result !== 'checked_no_cleaning_needed' || !Array.isArray(raw.services_performed) || raw.services_performed.length)) throw new Error('Check-only evidence contradicts cleaning services.');
    if (data.taxonomy_status === 'versioned_current_catalog') {
      const t = raw?.taxonomy;
      if (!object(t) || typeof t.version !== 'string' || typeof t.digest !== 'string' || !digestPattern.test(t.digest)
        || data.taxonomy_version !== t.version || data.taxonomy_digest !== t.digest || data.catalog_digest !== t.digest
        || data.catalog?.version !== t.version) throw new Error('Versioned taxonomy binding is unavailable.');
    }
    return data;
  }
  function field(label, value) { return `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`; }
  function list(label, value) {
    if (!Array.isArray(value)) return `<h4>${label}</h4><p>Original list not provided or legacy shape not interpreted.</p>`;
    if (!value.length) return `<h4>${label}</h4><p>No items reported in the original answer.</p>`;
    const shown = value.slice(0, 200), unsupported = shown.some(x => typeof x !== 'string');
    return `<h4>${label}</h4><ul>${shown.filter(x => typeof x === 'string').map(x => `<li>${escape(x)}</li>`).join('')}</ul>`
      + (unsupported ? '<p>Unsupported original item shapes remain preserved; they are not interpreted here.</p>' : '')
      + (value.length > 200 ? `<p>Showing the first 200 of ${value.length} original items.</p>` : '');
  }
  function renderEvidence(data, chosen = {}) {
    const identity = `<dl>${field('Selected row employee display label', text(chosen.employee_name))}${field('Selected row location display label', text(chosen.location_name))}${identityKeys.map(key => field(key.replaceAll('_', ' '), data[key])).join('')}${field('Started', text(data.started_at))}${field('Ended', text(data.ended_at))}</dl>`;
    if (!data.completion_recorded) return `<p>${data.session_status === 'pending_submit' ? 'This session is waiting for its completion record. ' : ''}No completion record exists for this exact session. No cleaning completion or inspection is inferred.</p>${identity}`;
    const raw = object(data.original_response) ? data.original_response : null;
    const native = data.native_exact_receipt_admitted === true ? 'Server reports an exact native receipt binding; this view does not prove physical cleaning or inspection.'
      : 'Historical or unverified native receipt. Persisted answers alone are not accepted native-work proof.';
    const taxonomy = data.taxonomy_status === 'versioned_current_catalog' ? 'Server-bound versioned catalog record.'
      : data.taxonomy_status === 'unversioned_historical_or_protected_draft' ? 'Unversioned historical or protected record. No current taxonomy is invented.'
        : 'Taxonomy metadata is unverified; original answers are not relabelled.';
    const work = ({full:'Full cleaning reported.', details:'Selected cleaning services reported.', checked_no_cleaning_needed:'Check only — no cleaning reported.'})[raw?.work_result] || text(raw?.work_result);
    const followUp = ({none_reported:'No issues reported in the original answers.', required_or_unresolved:'Follow-up required or unresolved.', linked_tickets_marked_fixed_coverage_unverified:'Linked tickets marked fixed; coverage of all reported issues is not verified.', unknown:'Issue and follow-up status is unknown.'})[data.follow_up] || text(data.follow_up);
    const attention = typeof raw?.attention_needed === 'boolean' ? (raw.attention_needed ? 'Yes' : 'No') : text(raw?.attention_needed);
    // Never dump the complete response, catalog, credentials, reconciliation
    // proofs, attachment URLs, or arbitrary extra fields into the website.
    return `<p>Persisted completion record (read-only). No inspection or quality PASS is awarded by this view.</p>${identity}`
      + `<dl>${field('Completion record', data.completion_response_id)}${field('Submitted', text(data.submitted_at))}${field('Original work answer', work)}${field('Server classification', text(data.classification))}${field('Needs attention — original answer', attention)}${field('Follow-up from this record', followUp)}</dl>`
      + `<p>${escape(native)}</p><p>${escape(taxonomy)}</p><dl>${field('Taxonomy version', text(data.taxonomy_version))}${field('Taxonomy digest — server binding', text(data.taxonomy_digest))}</dl>`
      + (raw ? list('Services — original answers', raw.services_performed) + list('Issues — original answers', raw.maintenance_issues_found)
        + `<dl>${field('Out of order — original answer', text(raw.out_of_order_signed))}${field('Out-of-order details', text(raw.out_of_order_details))}${field('Original note', text(raw.note ?? raw.notes))}</dl>`
        : '<p>The original legacy response shape is preserved but is not interpreted by this view.</p>');
  }
  function create({panel, status, content, readEnvelope, focusTarget}) {
    if (!panel || !status || !content || typeof readEnvelope !== 'function') throw new Error('Completion evidence view requires the existing read adapter.');
    let generation = 0, controller = null, returnFocus = null;
    function clear({returnToSelection = false} = {}) {
      generation += 1; controller?.abort(); controller = null;
      panel.hidden = true; status.textContent = ''; content.textContent = '';
      const target = returnFocus; returnFocus = null;
      if (returnToSelection && target?.isConnected) target.focus?.();
    }
    async function open(row, origin = null) {
      clear();
      const current = generation;
      let chosen;
      try { chosen = selection(row); } catch { status.textContent = 'Exact session identity unavailable. Refresh cleaning facts; no location-based guess was made.'; panel.hidden = false; return false; }
      controller = new AbortController(); returnFocus = origin;
      panel.hidden = false; status.textContent = 'Reading this exact session’s completion record…'; content.textContent = '';
      focusTarget?.focus?.();
      try {
        const envelope = await readEnvelope(readPath(chosen), {signal:controller.signal});
        if (current !== generation) return false;
        const data = validateEnvelope(envelope, chosen);
        content.innerHTML = renderEvidence(data, chosen);
        status.textContent = 'Exact session read confirmed. Record presence, native receipt, and inspection remain separate facts.';
        controller = null; return true;
      } catch (error) {
        if (current !== generation) return false;
        content.textContent = '';
        status.textContent = error?.status === 401 || error?.status === 403 ? 'Named-manager read access is required. No record was changed.'
          : 'Exact completion record unavailable or selection changed. Refresh cleaning facts. No record was changed.';
        controller = null; return false;
      }
    }
    return Object.freeze({open, clear});
  }
  const api = Object.freeze({canReadRow, selection, readPath, validateEnvelope, renderEvidence, create});
  root.MemphisCompletionEvidence = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
