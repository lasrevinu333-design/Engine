// G10 source-only correction controller. It consumes the safe v2 held-review
// row and injected normal manager/session interfaces; it is not auth, a route,
// a writer, or a browser/runtime proof.
export const CORRECTION_SCHEMA = 'custodial.held-event-correction';
export const HELD_STATUS = 'NEEDS_REVIEW';
const HELD_SOURCE = 'events_app_outlook_sync';
const REVIEW_REASONS = new Set(['MISSING_AUTHORITATIVE_END_TIME_AND_VENUE_REFERENCE', 'SOURCE_CONTENT_AMBIGUOUS', 'SOURCE_IDENTITY_UNRESOLVED', 'UNCLASSIFIED_SOURCE_REVIEW']);

const SHA256 = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const VENUE = value => typeof value === 'string' && value.length > 0 && value.length <= 160
  && /^[A-Za-z0-9][A-Za-z0-9._:/ -]*$/.test(value);
const OFFSET_INSTANT = value => typeof value === 'string' && /^(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))$/.test(value)
  && Number.isFinite(Date.parse(value));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const closed = (value, fields) => plain(value) && Object.keys(value).every(k => fields.includes(k))
  && fields.every(k => Object.hasOwn(value, k));
const fail = code => Object.assign(new Error(code), { code });

export function validateCorrectionTarget(row, pageSnapshot) {
  const fields = ['ledger_id', 'event_id', 'revision', 'status', 'source', 'source_provenance_digest', 'received_at',
    'review_reason_code', 'missing_fields', 'published', 'coverage_assigned', 'reminder_eligible'];
  if (!closed(row, fields)
    || typeof row.ledger_id !== 'string' || !UUID.test(row.ledger_id)
    || row.event_id !== null || row.revision !== null || row.status !== HELD_STATUS || row.source !== HELD_SOURCE
    || typeof row.source_provenance_digest !== 'string' || !SHA256.test(row.source_provenance_digest)
    || !ISO(row.received_at) || !REVIEW_REASONS.has(row.review_reason_code)
    || !plain(row.missing_fields) || !['end_time', 'venue_reference'].every(k => Object.hasOwn(row.missing_fields, k))
    || !['MISSING', 'PRESENT', 'UNKNOWN'].includes(row.missing_fields.end_time)
    || !['MISSING', 'PRESENT', 'UNKNOWN'].includes(row.missing_fields.venue_reference)
    || row.published !== false || row.coverage_assigned !== false || row.reminder_eligible !== false
    || typeof pageSnapshot !== 'string' || !SHA256.test(pageSnapshot)) throw fail('invalid_held_correction_target');
  return Object.freeze({ ledger_id: row.ledger_id.toLowerCase(), source_provenance_digest: row.source_provenance_digest,
    expected_review_snapshot_sha256: pageSnapshot });
}

function validatePreview(value, target, choices) {
  const fields = ['schema', 'ledger_id', 'expected_review_snapshot_sha256', 'source_provenance_digest',
    'preview_id', 'preview_sha256', 'corrected_end_at', 'venue_ref', 'state', 'published', 'coverage_assigned', 'reminder_eligible'];
  if (!closed(value, fields) || value.schema !== 'custodial.held-event-correction-preview.v1'
    || value.ledger_id !== target.ledger_id || value.expected_review_snapshot_sha256 !== target.expected_review_snapshot_sha256
    || value.source_provenance_digest !== target.source_provenance_digest || typeof value.preview_id !== 'string'
    || value.preview_id.length < 1 || value.preview_id.length > 200 || !SHA256.test(value.preview_sha256)
    || !ISO(value.corrected_end_at) || value.corrected_end_at !== choices.end_at || !VENUE(value.venue_ref)
    || value.venue_ref !== choices.venue_ref || value.state !== 'PREVIEW_ONLY'
    || value.published !== false || value.coverage_assigned !== false || value.reminder_eligible !== false) {
    throw fail('invalid_correction_preview');
  }
  return Object.freeze(value);
}

function validateConfirmed(value, target, preview) {
  const fields = ['schema', 'ledger_id', 'preview_id', 'preview_sha256', 'event_id', 'revision', 'canonical_event_readback_sha256', 'state', 'published'];
  if (!closed(value, fields) || value.schema !== 'custodial.held-event-correction-confirmed.v1'
    || value.ledger_id !== target.ledger_id || value.preview_id !== preview.preview_id
    || value.preview_sha256 !== preview.preview_sha256 || typeof value.event_id !== 'string' || !UUID.test(value.event_id)
    || !Number.isSafeInteger(value.revision) || value.revision < 1 || !SHA256.test(value.canonical_event_readback_sha256)
    || value.state !== 'ACCEPTED' || value.published !== true) throw fail('unconfirmed_correction');
  return Object.freeze(value);
}

function validateV2Preview(value, target, choices) {
  const fields = ['schema', 'ledger_id', 'expected_review_snapshot_sha256', 'source_provenance_digest', 'preview_id', 'preview_sha256',
    'normalized_event', 'fact_basis', 'source_evidence_status', 'missing_original_fields', 'corrected_end_at', 'venue_ref',
    'state', 'published', 'coverage_assigned', 'reminder_eligible'];
  const eventFields = ['event_name', 'event_date', 'start_time', 'start_instant_utc', 'end_date', 'end_time', 'end_instant_utc', 'primary_venue_id', 'display_location'];
  const basisFields = ['event_name', 'start_at', 'end_at', 'venue_ref'];
  if (!closed(value, fields) || value.schema !== 'custodial.held-event-correction-preview.v2'
    || value.ledger_id !== target.ledger_id || value.expected_review_snapshot_sha256 !== target.expected_review_snapshot_sha256
    || value.source_provenance_digest !== target.source_provenance_digest || !UUID.test(value.preview_id || '')
    || !SHA256.test(value.preview_sha256) || !closed(value.normalized_event, eventFields)
    || !closed(value.fact_basis, basisFields) || !value.normalized_event.event_name
    || value.normalized_event.event_name !== choices.event_name || !OFFSET_INSTANT(value.normalized_event.start_instant_utc)
    || new Date(value.normalized_event.start_instant_utc).toISOString() !== new Date(choices.start_at).toISOString()
    || new Date(value.normalized_event.end_instant_utc).toISOString() !== choices.end_at
    || value.normalized_event.primary_venue_id !== choices.venue_ref
    || !OFFSET_INSTANT(value.normalized_event.end_instant_utc) || !UUID.test(value.normalized_event.primary_venue_id)
    || value.fact_basis.event_name !== 'MANAGER_CONFIRMED' || value.fact_basis.start_at !== 'MANAGER_CONFIRMED'
    || value.fact_basis.end_at !== 'MANAGER_CONFIRMED' || value.fact_basis.venue_ref !== 'MANAGER_CONFIRMED'
    || value.source_evidence_status !== 'ORIGINAL_FACTS_INCOMPLETE'
    || JSON.stringify(value.missing_original_fields) !== JSON.stringify(['event_name', 'start_at'])
    || !ISO(value.corrected_end_at) || value.corrected_end_at !== choices.end_at
    || !UUID.test(value.venue_ref || '') || value.venue_ref !== choices.venue_ref
    || value.state !== 'PREVIEW_ONLY' || value.published !== false || value.coverage_assigned !== false || value.reminder_eligible !== false) throw fail('invalid_correction_preview_v2');
  return Object.freeze(value);
}

function validateV2Confirmed(value, target, preview) {
  const fields = ['schema', 'ledger_id', 'preview_id', 'preview_sha256', 'event_id', 'revision', 'canonical_event_readback_sha256',
    'normalized_event', 'fact_basis', 'source_evidence_status', 'missing_original_fields', 'corrected_end_at', 'venue_ref',
    'state', 'published', 'manager_feed_verified'];
  if (!closed(value, fields) || value.schema !== 'custodial.held-event-correction-confirmed.v2'
    || value.ledger_id !== target.ledger_id || value.preview_id !== preview.preview_id || value.preview_sha256 !== preview.preview_sha256
    || !UUID.test(value.event_id) || !Number.isSafeInteger(value.revision) || value.revision < 1 || !SHA256.test(value.canonical_event_readback_sha256)
    || !closed(value.normalized_event, ['event_name', 'event_date', 'start_time', 'start_instant_utc', 'end_date', 'end_time', 'end_instant_utc', 'primary_venue_id', 'display_location'])
    || JSON.stringify(value.normalized_event) !== JSON.stringify(preview.normalized_event)
    || !closed(value.fact_basis, ['event_name', 'start_at', 'end_at', 'venue_ref']) || value.fact_basis.event_name !== 'MANAGER_CONFIRMED'
    || value.fact_basis.start_at !== 'MANAGER_CONFIRMED' || value.fact_basis.end_at !== 'MANAGER_CONFIRMED' || value.fact_basis.venue_ref !== 'MANAGER_CONFIRMED'
    || value.source_evidence_status !== 'ORIGINAL_FACTS_INCOMPLETE' || JSON.stringify(value.missing_original_fields) !== JSON.stringify(['event_name', 'start_at'])
    || !ISO(value.corrected_end_at) || value.corrected_end_at !== preview.corrected_end_at
    || !UUID.test(value.venue_ref || '') || value.venue_ref !== preview.venue_ref
    || value.state !== 'ACCEPTED' || value.published !== true || value.manager_feed_verified !== false) throw fail('unconfirmed_correction_v2');
  return Object.freeze(value);
}

function binding(session) {
  if (!session || typeof session.requireCurrentManager !== 'function') throw fail('manager_session_interface_required');
  const value = session.requireCurrentManager();
  if (!plain(value) || typeof value.manager_id !== 'string' || !value.manager_id
    || typeof value.session_epoch !== 'string' || !value.session_epoch) throw fail('manager_session_unavailable');
  return value;
}
const sameBinding = (a, b) => a?.manager_id === b?.manager_id && a?.session_epoch === b?.session_epoch;

export function createHeldEventCorrectionController({ api, session, setView } = {}) {
  if (!plain(api) || (!((typeof api.previewCorrection === 'function' && typeof api.confirmCorrection === 'function')
    || (typeof api.previewCorrectionV2 === 'function' && typeof api.confirmCorrectionV2 === 'function')))
    || typeof setView !== 'function') throw new TypeError('correction_interfaces_required');
  let target = null, choices = null, preview = null, previewBinding = null, state = 'IDLE', generation = 0, busy = false;
  const view = (next, detail = null) => { state = next; setView(Object.freeze({ state, detail })); };
  const current = () => binding(session);
  function open(row, snapshot) {
    if (busy || ['CONFIRM_PENDING', 'STATUS_PENDING', 'OUTCOME_UNKNOWN'].includes(state)) throw fail('correction_outcome_unresolved');
    target = validateCorrectionTarget(row, snapshot); choices = null; preview = null; previewBinding = null; generation++; busy = false; view('HELD');
  }
  function choose({ end_at, venue_ref } = {}) {
    if (!target || busy || ['ACCEPTED','OUTCOME_UNKNOWN','DENIED'].includes(state)) throw fail('correction_not_editable');
    if (!ISO(end_at) || !VENUE(venue_ref)) throw fail('invalid_correction_choices');
    choices = Object.freeze({ ...(choices || {}), end_at, venue_ref }); view('READY');
  }
  function chooseManagerConfirmed({ event_name, start_at, end_at, venue_ref } = {}) {
    if (!target || busy || ['ACCEPTED','OUTCOME_UNKNOWN','DENIED'].includes(state)) throw fail('correction_not_editable');
    if (typeof event_name !== 'string' || event_name.trim().length < 1 || event_name.trim().length > 180
      || !OFFSET_INSTANT(start_at) || !ISO(end_at) || !UUID.test(venue_ref || '')) throw fail('invalid_manager_confirmed_facts');
    choices = Object.freeze({ event_name: event_name.trim(), start_at, end_at, venue_ref }); view('READY');
  }
  async function previewCorrection() {
    if (!target || !choices || busy || ['ACCEPTED','OUTCOME_UNKNOWN','DENIED'].includes(state)) throw fail('preview_not_allowed');
    const owner = current(), mine = ++generation; busy = true;
    view('PREVIEW_PENDING');
    try {
      const isV2 = typeof api.previewCorrectionV2 === 'function' && choices?.event_name;
      const raw = isV2 ? await api.previewCorrectionV2({ schema: 'custodial.held-event-correction-preview-request.v2', ledger_id: target.ledger_id,
        expected_review_snapshot_sha256: target.expected_review_snapshot_sha256, source_provenance_digest: target.source_provenance_digest,
        correction: { event_name: choices.event_name, start_at: choices.start_at, end_at: choices.end_at, venue_ref: choices.venue_ref },
        manager_fact_confirmation: 'MANAGER_CONFIRMED_MISSING_ORIGINAL_FACTS' })
        : await api.previewCorrection({ target, correction: choices, binding: owner });
      if (mine !== generation) return null;
      if (!sameBinding(owner, current())) { view('DENIED', 'manager_or_session_changed'); throw fail('manager_or_session_changed'); }
      preview = isV2 ? validateV2Preview(raw, target, choices) : validatePreview(raw, target, choices); previewBinding = owner; view('PREVIEW_ONLY', preview); return preview;
    } catch (error) {
      if (mine === generation && state !== 'ACCEPTED') view(error?.code === 'AUTH_WITHDRAWN' || state === 'DENIED' ? 'DENIED' : 'HELD', error?.code || 'preview_denied');
      throw error;
    } finally { if (mine === generation) busy = false; }
  }
  async function confirmCorrection() {
    if (!preview || !previewBinding || busy || state !== 'PREVIEW_ONLY') throw fail('confirm_not_allowed');
    const owner = current(), mine = ++generation; busy = true;
    if (!sameBinding(owner, previewBinding)) { busy = false; preview = null; view('DENIED', 'manager_or_session_changed'); throw fail('manager_or_session_changed'); }
    view('CONFIRM_PENDING');
    try {
      const isV2 = preview.schema === 'custodial.held-event-correction-preview.v2';
      const raw = isV2 ? await api.confirmCorrectionV2({ schema: 'custodial.held-event-correction-confirm-request.v2', preview_id: preview.preview_id, preview_sha256: preview.preview_sha256 })
        : await api.confirmCorrection({ preview_id: preview.preview_id, preview_sha256: preview.preview_sha256, binding: owner });
      if (mine !== generation) return null;
      if (!sameBinding(owner, current())) { preview = null; view('DENIED', 'manager_or_session_changed'); throw fail('manager_or_session_changed'); }
      const confirmed = isV2 ? validateV2Confirmed(raw, target, preview) : validateConfirmed(raw, target, preview); view('ACCEPTED', confirmed); return confirmed;
    } catch (error) {
      if (mine === generation && state !== 'ACCEPTED') {
        // A lost response does not invalidate the original identity. Keep the
        // pinned preview and manager binding so the owner can ask the server
        // for the saved outcome instead of blindly resending confirmation.
        if (error?.code === 'AUTH_WITHDRAWN' || state === 'DENIED') { preview = null; previewBinding = null; view('DENIED', error.code); }
        else view('OUTCOME_UNKNOWN', error?.code || 'confirmation_unconfirmed');
      }
      throw error;
    } finally { if (mine === generation) busy = false; }
  }
  async function checkSavedOutcome() {
    if (!preview || !previewBinding || busy || state !== 'OUTCOME_UNKNOWN' || typeof api.statusCorrectionV2 !== 'function') throw fail('saved_outcome_check_not_allowed');
    const owner = current(), mine = ++generation; busy = true;
    if (!sameBinding(owner, previewBinding)) { busy = false; preview = null; previewBinding = null; view('DENIED', 'manager_or_session_changed'); throw fail('manager_or_session_changed'); }
    view('STATUS_PENDING');
    try {
      const raw = await api.statusCorrectionV2({ schema: 'custodial.held-event-correction-status-request.v2', preview_id: preview.preview_id, preview_sha256: preview.preview_sha256 });
      if (mine !== generation) return null;
      if (!sameBinding(owner, current())) { preview = null; previewBinding = null; view('DENIED', 'manager_or_session_changed'); throw fail('manager_or_session_changed'); }
      if (closed(raw, ['state', 'published', 'manager_feed_verified', 'retry_safe']) && raw.state === 'HELD' && raw.published === false && raw.manager_feed_verified === false && raw.retry_safe === false) {
        view('OUTCOME_UNKNOWN', 'HELD'); return null;
      }
      if (closed(raw, ['state', 'published', 'manager_feed_verified', 'retry_safe']) && raw.state === 'READBACK_UNCONFIRMED' && raw.published === false && raw.manager_feed_verified === false && raw.retry_safe === false) {
        view('OUTCOME_UNKNOWN', 'READBACK_UNCONFIRMED'); return null;
      }
      const isV2 = preview.schema === 'custodial.held-event-correction-preview.v2';
      const confirmed = isV2 ? validateV2Confirmed(raw, target, preview) : validateConfirmed(raw, target, preview);
      view('ACCEPTED', confirmed); return confirmed;
    } catch (error) {
      if (mine === generation && state !== 'ACCEPTED') {
        if (error?.code === 'AUTH_WITHDRAWN' || state === 'DENIED') { preview = null; previewBinding = null; view('DENIED', error.code); }
        else view('OUTCOME_UNKNOWN', error?.code || 'saved_outcome_unconfirmed');
      }
      throw error;
    } finally { if (mine === generation) busy = false; }
  }
  function invalidate(reason = 'stale_request') {
    const uncertain = ['CONFIRM_PENDING', 'OUTCOME_UNKNOWN', 'STATUS_PENDING'].includes(state);
    generation++; busy = false;
    if (uncertain) view('OUTCOME_UNKNOWN', reason);
    else { preview = null; previewBinding = null; if (state !== 'DENIED') view('HELD', reason); }
  }
  return Object.freeze({ open, choose, chooseManagerConfirmed, preview: previewCorrection, confirm: confirmCorrection, checkSavedOutcome, invalidate, getState: () => state });
}
