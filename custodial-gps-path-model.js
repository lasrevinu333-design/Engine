(function (root) {
  'use strict';
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const fail = reason => { throw new Error(`GPS path: ${reason}`); };
  const captureTime = raw => typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw)
    ? Date.parse(raw) : NaN;

  // History is supplied by an existing named-manager read boundary. Nothing
  // here polls, collects a phone, interpolates missing samples or joins actors.
  function path({ registration, observations, session, now = Date.now(), maximumGapMs = 90000 }) {
    if (!registration?.project || !Array.isArray(observations) || !session?.uuid ||
        !session.locationCode || !session.deviceIdentifier || !session.employeeId ||
        !['active', 'offline-provisional'].includes(session.status) ||
        !finite(now) || !finite(maximumGapMs) || maximumGapMs <= 0)
      fail('active session identity and admitted registration are required');
    const start = captureTime(session.startedAt);
    if (!finite(start)) fail('session start time is required');
    const accepted = [], rejected = [];
    let chronologyUnknown = false;
    for (const item of observations) {
      const p = item?.payload_json || {};
      const observed = captureTime(p.observed_at);
      const eventSession = !!session.sessionId && item?.session_id === session.sessionId;
      const payloadSession = p.session_uuid === session.uuid ||
        (!!session.clientSessionId && p.client_session_id === session.clientSessionId);
      const identity = item?.session_uuid === session.uuid && (eventSession || payloadSession) &&
        (!p.session_uuid || p.session_uuid === session.uuid) &&
        (!p.client_session_id || p.client_session_id === session.clientSessionId) &&
        item.location_code === session.locationCode && (!p.location_code || p.location_code === session.locationCode) &&
        item.device_identifier === session.deviceIdentifier &&
        (!p.device_identifier || p.device_identifier === session.deviceIdentifier) &&
        item.employee_id === session.employeeId;
      if (!identity || !finite(observed) || observed < start || observed > now + 30000 ||
          item.event_type !== 'work_position_check') {
        if (!finite(observed)) chronologyUnknown = true;
        rejected.push({ eventId: item?.id ?? null, reason: 'identity_time_or_type', observed }); continue;
      }
      if (![p.client_latitude, p.client_longitude, p.accuracy_m].every(finite)) {
        rejected.push({ eventId: item?.id ?? null, reason: 'missing_measured_position', observed }); continue;
      }
      const projected = registration.project(p.client_latitude, p.client_longitude, p.accuracy_m);
      if (!projected.ok) { rejected.push({ eventId: item?.id ?? null, reason: projected.reason, observed }); continue; }
      accepted.push({ eventId: item?.id ?? null, observed, ...projected });
    }
    accepted.sort((a, b) => a.observed - b.observed || String(a.eventId).localeCompare(String(b.eventId)));
    // An unplaced rejected reading might lie anywhere between valid captures,
    // including after the latest one. Receipt time is not phone capture time.
    if (chronologyUnknown) return Object.freeze({ segments: [], rejected, current: null,
      lastObserved: null, chronologyUnknown: true, source: 'SESSION_BOUND_MEASURED_OBSERVATIONS' });
    const segments = []; let segment = [], previous = null;
    for (const item of accepted) {
      // A missing or rejected reading creates a break even when adjacent valid
      // captures happen to be close together.
      const interruption = rejected.some(r => finite(r.observed) && previous && r.observed > previous.observed && r.observed < item.observed);
      if (previous && (item.observed - previous.observed > maximumGapMs || interruption || item.observed === previous.observed)) {
        if (segment.length) segments.push(segment); segment = [];
      }
      segment.push(item); previous = item;
    }
    if (segment.length) segments.push(segment);
    const latest = accepted.at(-1);
    const newerRejected = latest && rejected.some(item => finite(item.observed) && item.observed > latest.observed);
    return Object.freeze({ segments, rejected, current: latest && !newerRejected && latest.observed <= now && now - latest.observed <= 120000 ? latest : null,
      lastObserved: latest?.observed ?? null, chronologyUnknown: false, source: 'SESSION_BOUND_MEASURED_OBSERVATIONS' });
  }

  const api = Object.freeze({ path });
  root.MemphisCustodialGpsPathModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
