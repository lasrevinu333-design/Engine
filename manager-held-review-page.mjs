import { createManagerHeldReviewController, validateHeldReviewPage } from './manager-held-review-display.mjs';
import { createHeldEventCorrectionController } from './manager-held-event-correction.mjs';

// The shared Events feed remains separate. This manager-only view reads one
// fixed review route and uses fixed correction routes; it never imports mail.
export const MANAGER_HELD_REVIEW_URL = 'https://memphis-zoo-mcp.onrender.com/dashboard-api/held-event-reviews';
const CORRECTION_PLACES_URL = `${MANAGER_HELD_REVIEW_URL}/corrections/places`;
const CORRECTION_PREVIEW_URL = `${MANAGER_HELD_REVIEW_URL}/corrections/preview`;
const CORRECTION_CONFIRM_URL = `${MANAGER_HELD_REVIEW_URL}/corrections/confirm`;
const CORRECTION_STATUS_URL = `${MANAGER_HELD_REVIEW_URL}/corrections/status`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RESPONSE_CHARS = 262144;
const native = w => w.MemphisCustodialSecurity?.native === true || w.MemphisMobile?.edition === 'custodial'
  || w.MemphisMobileBuildIdentity?.edition === 'custodial';
const denied = () => Object.assign(new Error('held_review_auth_withdrawn'), { code: 'AUTH_WITHDRAWN' });
const unavailable = () => new Error('held_review_unavailable');
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

function currentBinding(w, now) {
  if (native(w)) return null;
  const s = w.MemphisAuth?.readSession?.();
  if (s?.role !== 'ops_manager' || typeof s.manager_id !== 'string' || !UUID.test(s.manager_id)
    || typeof s.credential_id !== 'string' || !s.credential_id.trim() || s.credential_id.length > 200
    || typeof s.device_id !== 'string' || !s.device_id || s.device_id.length > 96
    || typeof s.token !== 'string' || !s.token || s.token.length > 8192
    || typeof s.expires_at !== 'string' || !(Date.parse(s.expires_at) > now)) return null;
  // Original in-memory references only. No token/session serialization to
  // storage, UI, telemetry or a caller-selected identity/URL.
  return { manager: s.manager_id, credential: s.credential_id, device: s.device_id,
    token: s.token, expires: s.expires_at, mode: s.auth_mode,
    canCorrect: s.read_only === false && plain(s.permissions) && s.permissions.owner === true };
}
const same = (a, b) => !!a && !!b && Object.keys(a).every(key => a[key] === b[key]);
function bounded(promise, signal) {
  if (signal.aborted) return Promise.reject(unavailable());
  return new Promise((resolve, reject) => {
    const aborted = () => reject(unavailable());
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

export function createManagerHeldReviewPage({ window: w = globalThis, document: d = w.document,
  fetchImpl = (...args) => w.fetch(...args), now = () => Date.now(), correctionApi = null } = {}) {
  const el = id => d.getElementById(id), panel = el('manager-held-review-panel'), content = el('manager-held-review-content'),
    range = el('manager-held-review-range'), refreshButton = el('manager-held-review-refresh'), nextButton = el('manager-held-review-next');
  if (!panel || !content || !range || !refreshButton || !nextButton) throw new Error('held_review_page_missing');
  const listeners = [], requests = new Set();
  const listen = (target, type, fn) => { target?.addEventListener?.(type, fn); listeners.push([target, type, fn]); };
  let owner = null, controller = null, page = null, rawPage = null, closed = false, suspended = false, authPending = false,
    generation = 0, requestSequence = 0, guard = null;
  let activeCorrectionApi = correctionApi;
  const correctionControllers = new Map();
  const unresolvedCorrection = () => [...correctionControllers.values()].some(local => ['CONFIRM_PENDING', 'STATUS_PENDING', 'OUTCOME_UNKNOWN'].includes(local.getState()));
  function syncNavigation() {
    const unresolved = unresolvedCorrection();
    refreshButton.disabled = authPending || unresolved;
    nextButton.disabled = unresolved || !page?.next_cursor;
  }
  const correctionSession = { requireCurrentManager: () => {
    const currentOwner = currentBinding(w, now());
    if (!currentOwner || !same(owner, currentOwner)) throw denied();
    return { manager_id: currentOwner.manager, session_epoch: `${currentOwner.credential}:${currentOwner.device}:${currentOwner.expires}` };
  } };
  async function correctionCall(url, init = {}) {
    const captured = owner, abort = new AbortController();
    if (!captured || !same(captured, currentBinding(w, now()))) throw denied();
    const timer = w.setTimeout(() => abort.abort(), 10000);
    const request = { abort, timer }; requests.add(request);
    try {
      const response = await bounded(fetchImpl(url, { ...init, cache: 'no-store', credentials: 'omit', redirect: 'error',
        headers: { ...(init.headers || {}), Authorization: `Bearer ${captured.token}`, 'X-Device-Id': captured.device }, signal: abort.signal }), abort.signal);
      if ([401, 403].includes(response.status)) { withdraw(); throw denied(); }
      const text = await bounded(response.text(), abort.signal);
      if (typeof text !== 'string' || text.length > MAX_RESPONSE_CHARS) throw unavailable();
      let envelope;
      try { envelope = JSON.parse(text); } catch { throw unavailable(); }
      if (!same(captured, currentBinding(w, now()))) throw denied();
      if (!plain(envelope) || envelope.ok !== true || !Object.hasOwn(envelope, 'data') || Object.keys(envelope).some(key => !['ok', 'data'].includes(key))) {
        const code = plain(envelope) && typeof envelope.code === 'string' ? envelope.code : null;
        const state = plain(envelope) ? envelope.state : null;
        if (state === 'OUTCOME_UNKNOWN' || state === 'READBACK_UNCONFIRMED')
          throw Object.assign(new Error(state), { code: state });
        if (code === 'OUTCOME_UNKNOWN' || code === 'READBACK_UNCONFIRMED') throw Object.assign(new Error(code), { code });
        throw unavailable();
      }
      const data = envelope.data;
      if (plain(data) && (data.state === 'OUTCOME_UNKNOWN' || data.state === 'READBACK_UNCONFIRMED')) {
        throw Object.assign(new Error(data.state), { code: data.state });
      }
      if (!same(captured, currentBinding(w, now()))) throw denied();
      return data;
    } catch (error) {
      if (error?.code === 'OUTCOME_UNKNOWN' || error?.code === 'READBACK_UNCONFIRMED' || error?.code === 'AUTH_WITHDRAWN') throw error;
      if (!same(captured, currentBinding(w, now()))) throw denied();
      throw error?.code === 'held_review_unavailable' ? error : unavailable();
    } finally { w.clearTimeout(timer); requests.delete(request); }
  }
  const makeCorrectionApi = () => ({
    v2: true,
    listEligiblePlaces: async () => {
      const data = await correctionCall(CORRECTION_PLACES_URL, { method: 'GET' });
      if (!plain(data) || Object.keys(data).length !== 2 || data.schema !== 'custodial.held-event-correction-places.v1'
        || !Array.isArray(data.places) || data.places.length > 100) throw unavailable();
      const seen = new Set();
      return data.places.map(place => {
        if (!plain(place) || Object.keys(place).length !== 2 || typeof place.venue_ref !== 'string' || !UUID.test(place.venue_ref)
          || typeof place.label !== 'string' || !place.label.trim() || place.label.length > 240
          || seen.has(place.venue_ref.toLowerCase())) throw unavailable();
        seen.add(place.venue_ref.toLowerCase());
        return { ref: place.venue_ref, label: place.label };
      });
    },
    previewCorrectionV2: body => correctionCall(CORRECTION_PREVIEW_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    confirmCorrectionV2: body => correctionCall(CORRECTION_CONFIRM_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    statusCorrectionV2: body => correctionCall(CORRECTION_STATUS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function correctionMarkup(row) {
    if (!owner?.canCorrect) return '<p class="mz-held-correction-readonly" data-correction-status>Read-only manager access: held review status only. Corrections require full write capability.</p>';
    if (!activeCorrectionApi) return '<p class="mz-held-correction-missing" data-correction-status>Correction interface is not available; this row remains held.</p>';
    const v2 = activeCorrectionApi.v2 === true;
    return `<div class="mz-held-correction" data-ledger-id="${escape(row.ledger_id)}"><p data-correction-status>Choose explicit details, then preview. Original title/start are not available in this safe row.</p><form data-correction-form novalidate>${v2 ? '<label>Manager-confirmed event title <input data-correction-event-name maxlength="180" required></label><label>Manager-confirmed start <input data-correction-start type="datetime-local" required></label>' : ''}<label>End time <input data-correction-end type="datetime-local" required></label><label>Eligible place <select data-correction-venue required><option value="">Choose an eligible place</option></select></label><button type="button" data-correction-preview>Preview correction</button><button type="button" data-correction-confirm disabled>Confirm exactly this preview</button>${v2 ? '<button type="button" data-correction-status-check disabled>Check saved outcome</button>' : ''}</form></div>`;
  }
  function correctionState(card, state, detail = null) {
    const status = card.querySelector('[data-correction-status]');
    const previewButton = card.querySelector('[data-correction-preview]');
    const confirmButton = card.querySelector('[data-correction-confirm]');
    const statusButton = card.querySelector('[data-correction-status-check]');
    if (status) status.textContent = ({HELD:'Held: explicit choices required.', READY:'Choices ready; preview before confirmation.', PREVIEW_PENDING:'Preview pending; do not leave this page.', PREVIEW_ONLY:'Preview is pinned; confirm exactly this preview once.', CONFIRM_PENDING:'Confirmation pending; the row remains held until canonical readback.', STATUS_PENDING:'Checking the saved outcome once; do not resend confirmation.', OUTCOME_UNKNOWN: detail === 'HELD' ? 'Saved outcome is still pending. Do not resend confirmation; check saved outcome again only explicitly.' : detail === 'READBACK_UNCONFIRMED' ? 'Saved outcome could not be independently read back. Do not resend confirmation.' : 'Confirmation outcome is unknown. Check saved outcome; do not resend confirmation.', ACCEPTED:'Accepted after canonical readback; manager-feed display verification is still pending.', DENIED:'Manager/session access changed; row remains held.'}[state] || 'Correction remains held.');
    if (previewButton) previewButton.disabled = ['PREVIEW_PENDING','CONFIRM_PENDING','STATUS_PENDING','OUTCOME_UNKNOWN','ACCEPTED','DENIED'].includes(state);
    if (confirmButton) confirmButton.disabled = state !== 'PREVIEW_ONLY';
    if (statusButton) { statusButton.disabled = state !== 'OUTCOME_UNKNOWN'; statusButton.textContent = 'Check saved outcome'; }
    for (const input of card.querySelectorAll?.('input,select') || [])
      input.disabled = ['PREVIEW_PENDING','PREVIEW_ONLY','CONFIRM_PENDING','STATUS_PENDING','OUTCOME_UNKNOWN','ACCEPTED','DENIED'].includes(state);
    if (state === 'PREVIEW_ONLY' && detail?.normalized_event && status) {
      const event = detail.normalized_event;
      status.textContent = `Preview — ${event.event_name}; ${event.event_date} ${event.start_time} to ${event.end_date} ${event.end_time} (Zoo local time); ${event.display_location}. All four facts are manager-confirmed; unavailable original title/start have not been recovered. Confirm exactly these facts once.`;
    }
    syncNavigation();
  }
  function mountCorrections(raw) {
    if (!raw?.rows || !activeCorrectionApi) return;
    const cards = [...(content.querySelectorAll?.('.mz-held-review-card') || [])];
    for (const [index, row] of raw.rows.entries()) {
      const card = content.querySelector(`[data-ledger-id="${row.ledger_id}"]`) || cards[index];
      if (!card || card.querySelector('[data-correction-form]')) continue;
      card.insertAdjacentHTML('beforeend', correctionMarkup(row));
      const correctionCard = card.querySelector('.mz-held-correction');
      const form = correctionCard?.querySelector('[data-correction-form]');
      if (!form) continue;
      const eventName = form.querySelector('[data-correction-event-name]'), startInput = form.querySelector('[data-correction-start]'), endInput = form.querySelector('[data-correction-end]'), venue = form.querySelector('[data-correction-venue]');
      const previewButton = form.querySelector('[data-correction-preview]'), confirmButton = form.querySelector('[data-correction-confirm]'), statusButton = form.querySelector('[data-correction-status-check]');
      const localApi = { listEligiblePlaces: activeCorrectionApi.listEligiblePlaces, previewCorrection: activeCorrectionApi.previewCorrection, confirmCorrection: activeCorrectionApi.confirmCorrection, previewCorrectionV2: activeCorrectionApi.previewCorrectionV2, confirmCorrectionV2: activeCorrectionApi.confirmCorrectionV2, statusCorrectionV2: activeCorrectionApi.statusCorrectionV2 };
      const local = createHeldEventCorrectionController({api: localApi, session: correctionSession, setView: view => correctionState(correctionCard, view.state, view.detail)});
      correctionControllers.set(row.ledger_id, local); local.open(row, raw.snapshot_sha256);
      if (typeof activeCorrectionApi.listEligiblePlaces === 'function') {
        Promise.resolve(activeCorrectionApi.listEligiblePlaces()).then(places => {
          if (!Array.isArray(places) || !same(owner, currentBinding(w, now()))) return;
          for (const place of places) if (plain(place) && typeof place.ref === 'string' && typeof place.label === 'string') {
            const option = d.createElement('option'); option.value = place.ref; option.textContent = place.label; venue.append(option);
          }
        }).catch(() => {
          if (!same(owner, currentBinding(w, now()))) return;
          correctionState(correctionCard, local.getState());
          const status = correctionCard.querySelector('[data-correction-status]');
          if (status && local.getState() === 'HELD') status.textContent = 'Eligible places unavailable. This row remains held; recheck current manager access and reviews.';
        });
      }
      previewButton.addEventListener('click', async () => {
        try {
          if (!endInput.value || !venue.value) throw new Error('invalid_correction_choices');
          if (activeCorrectionApi.v2 === true) {
            if (!eventName?.value || !startInput?.value) throw new Error('invalid_manager_confirmed_facts');
            local.chooseManagerConfirmed({ event_name: eventName.value, start_at: new Date(startInput.value).toISOString(), end_at: new Date(endInput.value).toISOString(), venue_ref: venue.value });
          } else local.choose({ end_at: new Date(endInput.value).toISOString(), venue_ref: venue.value });
          await local.preview();
        } catch (error) { correctionState(correctionCard, error?.code === 'AUTH_WITHDRAWN' ? 'DENIED' : local.getState(), error?.code); }
      });
      confirmButton.addEventListener('click', async () => { try { await local.confirm(); } catch (error) { correctionState(correctionCard, error?.code === 'AUTH_WITHDRAWN' ? 'DENIED' : local.getState(), error?.code); } });
      statusButton?.addEventListener('click', async () => { try { await local.checkSavedOutcome(); } catch (error) { correctionState(correctionCard, error?.code === 'AUTH_WITHDRAWN' ? 'DENIED' : local.getState(), error?.code); } });
    }
  }
  const current = () => !closed && !suspended && !d.hidden && same(owner, currentBinding(w, now()));
  function clearRows() { content.replaceChildren(); range.textContent = ''; page = null; rawPage = null; correctionControllers.clear(); nextButton.disabled = true; }
  function abortRequests() { for (const request of requests) request.abort.abort(); }
  function clearGuard() { if (guard !== null) w.clearInterval(guard); guard = null; }
  function withdraw() {
    page = null; nextButton.disabled = true; abortRequests(); controller?.withdrawAuth(); owner = null; clearGuard();
    if (native(w)) { panel.hidden = true; clearRows(); } else if (!closed && !suspended) {
      panel.hidden = false; range.textContent = 'Return to the Map if manager access cannot be re-established.';
    }
  }
  function render(html) {
    if (closed || suspended || native(w) || d.hidden) { clearRows(); panel.hidden = true; return; }
    if (!same(owner, currentBinding(w, now()))) {
      clearRows(); range.textContent = 'Current manager access is required.'; return;
    }
    content.innerHTML = html;
    mountCorrections(rawPage);
    if (!html.includes('data-state="ready"')) { page = null; nextButton.disabled = true; range.textContent = ''; return; }
    nextButton.disabled = !page?.next_cursor;
    range.textContent = page ? `Held records ${page.page_start + 1}–${page.consumed_count} of ${page.total_count}.` : '';
  }
  async function readPage(cursor) {
    if (!current()) throw denied();
    const captured = owner, instance = generation, sequence = ++requestSequence;
    const abort = new AbortController(), request = { abort, timer: null };
    requests.add(request); request.timer = w.setTimeout(() => abort.abort(), 10000);
    const check = () => {
      if (instance !== generation || !same(captured, owner) || !current()) throw denied();
      if (abort.signal.aborted) throw unavailable();
    };
    try {
      // Existing normal auth helper, no cookie/token extraction or identity
      // fallback. The server route rechecks current registry before/after SQL.
      await bounded(w.MemphisAuth.requireOpsManagerSession({ interactive: false, redirect: false, throwOnFailure: true }), abort.signal);
      check();
      const url = new URL(MANAGER_HELD_REVIEW_URL); url.searchParams.set('limit', '100');
      if (cursor !== null) url.searchParams.set('cursor', cursor);
      const response = await bounded(fetchImpl(url.toString(), { method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error',
        headers: { Authorization: `Bearer ${captured.token}`, 'X-Device-Id': captured.device }, signal: abort.signal }), abort.signal);
      // Even a late denial is intentionally fail-closed, never ignored as stale
      // availability noise. A new controller needs a separate normal check.
      if ([401, 403].includes(response.status)) throw Object.assign(denied(), { status: response.status });
      check();
      if (response.ok !== true) throw Object.assign(unavailable(), { status: response.status });
      const text = await bounded(response.text(), abort.signal); check();
      if (typeof text !== 'string' || text.length > MAX_RESPONSE_CHARS) throw unavailable();
      let envelope;
      try { envelope = JSON.parse(text); } catch { throw unavailable(); }
      if (!plain(envelope) || envelope.ok !== true || !Object.hasOwn(envelope, 'data')
        || Object.keys(envelope).some(key => !['ok', 'data'].includes(key))) throw unavailable();
      const verified = validateHeldReviewPage(envelope.data, cursor); check();
      if (sequence === requestSequence) { page = verified; rawPage = envelope.data; }
      return envelope.data;
    } catch (error) {
      if ([401, 403].includes(error?.status) || error?.code === 'AUTH_WITHDRAWN') throw denied();
      if (!same(captured, owner) || !same(captured, currentBinding(w, now()))) throw denied();
      // Never display private auth/source errors or return their payloads.
      throw unavailable();
    } finally { w.clearTimeout(request.timer); requests.delete(request); }
  }
  async function init() {
    if (closed || suspended || d.hidden || authPending) return false;
    if (native(w)) { panel.hidden = true; clearRows(); return false; }
    // Retain the original in-memory preview while a write may have committed.
    // Refresh/pagination must not replace it with a new editable held form.
    if (current() && unresolvedCorrection()) {
      range.textContent = 'Check the saved outcome before refreshing held reviews. Do not resend confirmation.';
      syncNavigation(); return false;
    }
    authPending = true; const attempt = ++generation;
    const abort = new AbortController(), request = { abort, timer: w.setTimeout(() => abort.abort(), 10000) };
    requests.add(request);
    for (const old of requests) if (old !== request) old.abort.abort();
    controller?.withdrawAuth(); owner = null; controller = null; clearRows(); refreshButton.disabled = true;
    panel.hidden = false; range.textContent = 'Checking current manager access…';
    try {
      // Explicit refresh / initial / bfcache restoration independently checks
      // normal access. Denied reader calls NEVER silently create new instances.
      await bounded(w.MemphisAuth?.requireOpsManagerSession?.({ interactive: false, redirect: false, throwOnFailure: true, forceRefresh: true }), abort.signal);
      if (closed || suspended || d.hidden || attempt !== generation || native(w)) return false;
      owner = currentBinding(w, now());
      if (!owner) throw denied();
      activeCorrectionApi = correctionApi || makeCorrectionApi();
      controller = createManagerHeldReviewController({ readPage, setHtml: html => { if (attempt === generation) render(html); } });
      if (guard === null) guard = w.setInterval(() => { if (owner && !same(owner, currentBinding(w, now()))) withdraw(); }, 1000);
      await controller.load(); return !!owner;
    } catch {
      if (attempt === generation && !closed && !suspended) { clearRows(); range.textContent = 'Current manager access is required. Return to the Map and sign in normally.'; }
      return false;
    } finally { w.clearTimeout(request.timer); requests.delete(request); authPending = false; if (!closed) syncNavigation(); }
  }
  async function next() { if (current() && page?.next_cursor && !nextButton.disabled) await controller.next(page.next_cursor); }
  function stop() {
    if (closed) return; closed = true; generation++; abortRequests(); controller?.withdrawAuth(); owner = controller = null; correctionControllers.clear();
    clearGuard();
    for (const [target, type, fn] of listeners) target?.removeEventListener?.(type, fn);
    listeners.length = 0; clearRows(); panel.hidden = true;
  }
  // No auth/listeners/timers/reads are installed for the employee edition.
  if (native(w)) { panel.hidden = true; clearRows(); return Object.freeze({ init, next, stop }); }
  listen(refreshButton, 'click', () => { void init(); }); listen(nextButton, 'click', () => { void next(); });
  listen(w, 'offline', withdraw);
  listen(w, 'memphis:custodial-security-state', () => { if (native(w) || (owner && !same(owner, currentBinding(w, now())))) withdraw(); });
  listen(d, 'visibilitychange', () => {
    if (d.hidden) { abortRequests(); controller?.withdrawAuth(); owner = null; clearGuard(); clearRows(); panel.hidden = true; }
    else if (!closed && !suspended && !native(w)) { panel.hidden = false; range.textContent = 'Reviews were hidden. Recheck manager access to read them again.'; }
  });
  listen(w, 'pagehide', event => { if (!event.persisted) return stop(); suspended = true; generation++; abortRequests(); controller?.withdrawAuth(); owner = controller = null; clearGuard(); clearRows(); panel.hidden = true; });
  listen(w, 'pageshow', event => { if (event.persisted && !closed) { suspended = false; void init(); } });
  return Object.freeze({ init, next, stop });
}
if (globalThis.document?.getElementById('manager-held-review-panel')) void createManagerHeldReviewPage().init();
