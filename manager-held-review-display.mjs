// Read-only source component. The owning page must establish a current named
// manager and supply its fixed authenticated reader. This module is NOT auth,
// an intake collector, a publication/correction route or a browser verdict.
export const HELD_REVIEW_SCHEMA = 'custodial.manager-held-review.v2';
export const HELD_REVIEW_SOURCE = 'events_app_outlook_sync';
export const HELD_REVIEW_STATUS = 'NEEDS_REVIEW';

const SHA256 = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURSOR = /^hr2:([1-9][0-9]{0,3}):([a-f0-9]{64})$/;
const MAX_OFFSET = 999;
const MAX_TOTAL = 1000;
const REASONS = new Set([
  'MISSING_AUTHORITATIVE_END_TIME_AND_VENUE_REFERENCE',
  'SOURCE_CONTENT_AMBIGUOUS',
  'SOURCE_IDENTITY_UNRESOLVED',
  'UNCLASSIFIED_SOURCE_REVIEW',
]);
const MISSING = new Set(['MISSING', 'PRESENT', 'UNKNOWN']);
const PAGE_FIELDS = ['schema', 'source', 'generated_at', 'coverage', 'snapshot_sha256', 'rows', 'page_start', 'consumed_count', 'returned_count', 'total_count', 'next_cursor'];
const ROW_FIELDS = ['ledger_id', 'event_id', 'revision', 'status', 'source', 'source_provenance_digest', 'received_at',
  'review_reason_code', 'missing_fields', 'published', 'coverage_assigned', 'reminder_eligible'];
const REASON_LABELS = Object.freeze({
  MISSING_AUTHORITATIVE_END_TIME_AND_VENUE_REFERENCE: 'Missing authoritative end time and venue reference',
  SOURCE_CONTENT_AMBIGUOUS: 'Source content is ambiguous',
  SOURCE_IDENTITY_UNRESOLVED: 'Source identity is unresolved',
  UNCLASSIFIED_SOURCE_REVIEW: 'Source needs review',
});

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeState = value => MISSING.has(value) ? value : 'UNKNOWN';
const safeReason = value => REASONS.has(value) ? value : null;
const isPlainObject = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const closed = (value, fields, optional = []) => isPlainObject(value)
  && fields.every(field => Object.hasOwn(value, field))
  && Object.keys(value).every(field => fields.includes(field) || optional.includes(field));
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
function offset(cursor) {
  if (cursor === null) return { value: 0, digest: null };
  if (typeof cursor !== 'string' || cursor.length > 74 || !CURSOR.test(cursor)) throw new Error('malformed_held_review_cursor');
  const [, raw, digest] = cursor.match(CURSOR);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_OFFSET) throw new Error('malformed_held_review_cursor');
  return { value, digest };
}

export function validateHeldReviewPage(value, requestedCursor = null) {
  const requested = offset(requestedCursor);
  if (!closed(value, PAGE_FIELDS) || value.schema !== HELD_REVIEW_SCHEMA || value.source !== HELD_REVIEW_SOURCE
    || !instant(value.generated_at) || value.coverage !== 'held_review_only'
    || typeof value.snapshot_sha256 !== 'string' || !SHA256.test(value.snapshot_sha256)
    || !Array.isArray(value.rows) || value.rows.length > 100 || !Number.isSafeInteger(value.returned_count)
    || !Number.isSafeInteger(value.page_start) || value.page_start < 0 || value.page_start > MAX_OFFSET
    || !Number.isSafeInteger(value.consumed_count) || value.consumed_count < value.page_start || value.consumed_count > MAX_TOTAL
    || !Number.isSafeInteger(value.total_count) || value.total_count > MAX_TOTAL || value.returned_count !== value.rows.length
    || value.returned_count !== value.consumed_count - value.page_start || value.consumed_count > value.total_count
    || value.page_start !== requested.value || (requested.digest !== null && value.snapshot_sha256 !== requested.digest)
    || (value.next_cursor !== null && typeof value.next_cursor !== 'string')) {
    throw new Error('malformed_held_review_page');
  }
  if (value.next_cursor === null) {
    if (value.consumed_count !== value.total_count) throw new Error('malformed_held_review_pagination');
  } else {
    const next = offset(value.next_cursor);
    if (next.digest !== value.snapshot_sha256 || next.value !== value.consumed_count || next.value >= value.total_count || next.value <= value.page_start) throw new Error('malformed_held_review_pagination');
  }
  const seen = new Set();
  const rows = value.rows.map((row) => {
    if (!closed(row, ROW_FIELDS) || typeof row.ledger_id !== 'string' || !UUID.test(row.ledger_id)
      || seen.has(row.ledger_id.toLowerCase()) || row.event_id !== null || row.revision !== null || row.status !== HELD_REVIEW_STATUS
      || row.source !== HELD_REVIEW_SOURCE || typeof row.source_provenance_digest !== 'string' || !SHA256.test(row.source_provenance_digest)
      || !instant(row.received_at) || !safeReason(row.review_reason_code)
      || !closed(row.missing_fields, ['end_time', 'venue_reference']) || !MISSING.has(row.missing_fields.end_time)
      || !MISSING.has(row.missing_fields.venue_reference) || row.published !== false
      || row.coverage_assigned !== false || row.reminder_eligible !== false) {
      throw new Error('malformed_held_review_row');
    }
    seen.add(row.ledger_id.toLowerCase());
    return Object.freeze({
      ledger_id: row.ledger_id.toLowerCase(), status: HELD_REVIEW_STATUS, source_provenance_digest: row.source_provenance_digest,
      received_at: row.received_at, review_reason_code: row.review_reason_code,
      missing_fields: Object.freeze({ end_time: safeState(row.missing_fields.end_time), venue_reference: safeState(row.missing_fields.venue_reference) }),
    });
  });
  return Object.freeze({
    schema: value.schema, source: value.source, rows: Object.freeze(rows), page_start: value.page_start,
    consumed_count: value.consumed_count, returned_count: value.returned_count, total_count: value.total_count, next_cursor: value.next_cursor,
  });
}

function stateView(state, message) {
  const labels = { loading: 'Loading held reviews…', empty: 'No held event emails need review.', unavailable: 'Held review is temporarily unavailable.', malformed: 'Held review data could not be verified.', authwithdrawn: 'Manager access changed; held review is hidden.' };
  return `<section class="mz-held-review" data-state="${escapeHtml(state)}" aria-live="polite"><h2>Held event email review</h2><p>${escapeHtml(message || labels[state])}</p></section>`;
}
function rowView(row) {
  const reason = REASON_LABELS[row.review_reason_code];
  return `<article class="mz-held-review-card" data-status="NEEDS_REVIEW"><header><span class="mz-held-review-status">NEEDS_REVIEW</span><span class="mz-held-review-reason">${escapeHtml(reason)}</span></header><dl><div><dt>End time</dt><dd>${escapeHtml(row.missing_fields.end_time)}</dd></div><div><dt>Venue reference</dt><dd>${escapeHtml(row.missing_fields.venue_reference)}</dd></div><div><dt>Received</dt><dd>${escapeHtml(row.received_at)}</dd></div><div><dt>Provenance digest</dt><dd><code>${escapeHtml(row.source_provenance_digest)}</code></dd></div></dl></article>`;
}
export function renderManagerHeldReview(value, requestedCursor = null) {
  const page = validateHeldReviewPage(value, requestedCursor);
  if (page.rows.length === 0) return stateView('empty');
  return `<section class="mz-held-review" data-state="ready" aria-labelledby="mz-held-review-title"><h2 id="mz-held-review-title">Held event email review</h2><p class="mz-held-review-intro">These source records are held for review. No action controls are available here.</p><div class="mz-held-review-list">${page.rows.map(rowView).join('')}</div></section>`;
}

export function createManagerHeldReviewController({ readPage, setHtml } = {}) {
  if (typeof readPage !== 'function' || typeof setHtml !== 'function') throw new TypeError('held_review_controller_callbacks_required');
  let withdrawn = false, sequence = 0;
  const renderState = state => setHtml(stateView(state));
  const withdraw = () => { withdrawn = true; sequence++; renderState('authwithdrawn'); };
  async function load(cursor = null) {
    if (withdrawn) return renderState('authwithdrawn');
    const attempt = ++sequence;
    let requestedStart;
    try { requestedStart = offset(cursor); } catch { return renderState('malformed'); }
    renderState('loading');
    try {
      const raw = await readPage(cursor);
      if (withdrawn || sequence !== attempt) return;
      const page = validateHeldReviewPage(raw, cursor);
      setHtml(renderManagerHeldReview(raw, cursor));
    } catch (error) {
      // A denial never silently re-enables this controller. The owning page
      // must independently re-establish auth and create a new bound instance.
      if (error?.code === 'AUTH_WITHDRAWN' || error?.status === 401 || error?.status === 403) return withdraw();
      if (withdrawn || sequence !== attempt) return;
      renderState(error?.message?.startsWith('malformed_held_review') ? 'malformed' : 'unavailable');
    }
  }
  return Object.freeze({ load, next: load, withdrawAuth: withdraw });
}
