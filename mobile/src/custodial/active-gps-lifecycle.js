const ACTIVE_STATUSES = new Set(['active', 'server-active', 'offline-provisional']);

const clean = (value) => String(value || '').trim();
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value));
const locationCode = (value) => /^[A-Z0-9._:-]{1,100}$/.test(clean(value).toUpperCase())
  ? clean(value).toUpperCase() : '';

function normalizedSession(row, expectedDevice) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  if (!ACTIVE_STATUSES.has(clean(row.status).toLowerCase())) return null;
  const clientSessionId = clean(row.client_session_id || row.session_uuid).toLowerCase();
  const deviceId = clean(row.device_id).toUpperCase();
  const location = locationCode(row.location_code);
  if (!uuid(clientSessionId) || !deviceId || deviceId !== expectedDevice || !location) return null;
  return Object.freeze({
    clientSessionId,
    deviceId,
    locationCode: location,
    employeeId: clean(row.offline_authority_employee_id || row.employee_id).toLowerCase() || null,
    startedAt: clean(row.started_at) || null,
  });
}

export function resolveActiveGpsSession(storage, deviceId) {
  const expectedDevice = clean(deviceId).toUpperCase();
  if (!storage || !expectedDevice) return Object.freeze({ state: 'none', session: null });
  const matches = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith('session:')) continue;
    let row = null;
    try { row = JSON.parse(storage.getItem(key) || 'null'); } catch { return Object.freeze({ state: 'corrupted', session: null }); }
    const session = normalizedSession(row, expectedDevice);
    if (session) matches.push(session);
  }
  const byId=new Map();
  for(const item of matches){const prior=byId.get(item.clientSessionId);if(prior&&JSON.stringify(prior)!==JSON.stringify(item))return Object.freeze({state:'ambiguous',session:null});byId.set(item.clientSessionId,item);}
  const unique = [...byId.values()];
  if (unique.length === 0) return Object.freeze({ state: 'none', session: null });
  if (unique.length !== 1) return Object.freeze({ state: 'ambiguous', session: null });
  return Object.freeze({ state: 'active', session: unique[0] });
}

const finite=value=>value!=null&&['number','string'].includes(typeof value)&&!(typeof value==='string'&&!value.trim())&&Number.isFinite(Number(value))?Number(value):null;
const sameSession=(a,b)=>!!a&&!!b&&JSON.stringify(a)===JSON.stringify(b);
function normalizedPosition(position) {
  const coords = position?.coords || position || {};
  const latitude = finite(coords.latitude);
  const longitude = finite(coords.longitude);
  const accuracyRaw = coords.accuracy ?? position?.accuracy_m;
  const accuracy = finite(accuracyRaw);
  const timestamp = finite(position?.timestamp);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0)) return null;
  if (!Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(new Date(timestamp).getTime())) return null;
  return Object.freeze({ latitude, longitude, accuracy, timestamp });
}

export function createActiveGpsLifecycle({
  storage,
  deviceId,
  enqueue,
  geolocation,
  randomUuid = () => crypto.randomUUID(),
  setTimer = (fn, ms) => setInterval(fn, ms),
  clearTimer = (id) => clearInterval(id),
  intervalMs = 30000,
  setDeadline=(fn,ms)=>setTimeout(fn,ms),
  clearDeadline=id=>clearTimeout(id),
  onStatus = () => {},
} = {}) {
  if (!storage || typeof deviceId !== 'function' || typeof enqueue !== 'function') {
    throw new Error('Active GPS lifecycle dependencies are incomplete.');
  }
  let timer = null;
  let flight = null;
  let disposed = false;
  let lastSessionId = '';
  let lastObservedAt = 0;
  let cancelCapture=null;

  function stopTimer() {
    if (timer != null) clearTimer(timer);
    timer = null;
  }

  function current() {
    return resolveActiveGpsSession(storage, deviceId());
  }

  async function capture(reason = 'timer') {
    if (disposed) return Object.freeze({ state: 'disposed' });
    const before = current();
    if (before.state !== 'active') {
      stopTimer();
      lastSessionId = '';
      onStatus({ state: before.state });
      return Object.freeze({ state: before.state });
    }
    if (!geolocation?.getCurrentPosition) {
      onStatus({ state: 'gps_unavailable', sessionId: before.session.clientSessionId });
      return Object.freeze({ state: 'gps_unavailable' });
    }
    if (flight) return flight;
    const requested = before.session;
    flight = new Promise((resolve) => {
      let settled=false,deadline=null;
      const finish=value=>{if(settled)return;settled=true;if(deadline!==null)clearDeadline(deadline);cancelCapture=null;resolve(value);};
      cancelCapture=()=>finish(null);
      deadline=setDeadline(()=>finish(null),15000);
      try { geolocation.getCurrentPosition(finish,()=>finish(null),{
        enableHighAccuracy:true,timeout:15000,maximumAge:10000,
      }); } catch { finish(null); }
    }).then(async (position) => {
      if (disposed) return Object.freeze({ state: 'disposed' });
      const sample = normalizedPosition(position);
      if (!sample) {
        onStatus({ state: 'gps_unavailable', sessionId: requested.clientSessionId });
        return Object.freeze({ state: 'gps_unavailable' });
      }
      const after = current();
      if (after.state !== 'active' || !sameSession(after.session,requested)) {
        return Object.freeze({ state: 'session_changed' });
      }
      if (lastSessionId === requested.clientSessionId && sample.timestamp <= lastObservedAt) {
        return Object.freeze({ state: 'duplicate_capture' });
      }
      const eventId = `gps:${requested.clientSessionId}:${randomUuid()}`;
      const payload = Object.freeze({
        p_location_code: requested.locationCode,
        p_device_identifier: requested.deviceId,
        p_latitude: sample.latitude,
        p_longitude: sample.longitude,
        p_accuracy_m: sample.accuracy,
        p_session_uuid: requested.clientSessionId,
        p_client_event_id: eventId,
        p_correlation_id: `gps:${requested.clientSessionId}:${reason}:${sample.timestamp}`,
        p_observed_at: new Date(sample.timestamp).toISOString(),
      });
      await enqueue(Object.freeze({
        type: 'evaluate_location_proximity_v2',
        client_id: eventId,
        payload,
      }));
      lastSessionId = requested.clientSessionId;
      lastObservedAt = sample.timestamp;
      if(!disposed&&sameSession(current().session,requested))onStatus({ state: 'queued', sessionId: requested.clientSessionId, observedAt: payload.p_observed_at });
      return Object.freeze({ state: 'queued', payload });
    }).catch((error) => {
      if(!disposed&&sameSession(current().session,requested))onStatus({ state: 'queue_unavailable', sessionId: requested.clientSessionId });
      return Object.freeze({ state: 'queue_unavailable', error });
    }).finally(() => { flight = null; });
    return flight;
  }

  function ensureTimer() {
    if (timer != null || disposed) return;
    timer = setTimer(() => { void capture('timer'); }, intervalMs);
  }

  async function reconcile(reason = 'reconcile') {
    if(disposed)return Object.freeze({state:'disposed'});
    const resolved = current();
    if (resolved.state !== 'active') {
      stopTimer();
      lastSessionId = '';
      onStatus({ state: resolved.state });
      return Object.freeze({ state: resolved.state });
    }
    ensureTimer();
    return capture(reason);
  }
  function dispose() {
    disposed = true;
    cancelCapture?.();
    stopTimer();
    lastSessionId = '';
  }

  return Object.freeze({
    capture,
    reconcile,
    dispose,
    state: () => Object.freeze({
      activeSessionId: lastSessionId || null,
      lastObservedAt: lastObservedAt || null,
      timerActive: timer != null,
      disposed,
    }),
  });
}
