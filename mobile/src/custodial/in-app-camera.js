// Acquisition state only: no external intents, persistence, or receipt authority.
// The owning page supplies an exact native permission gate and binding observer.
export function createInAppCamera({
  binding, visible, subscribeInvalidation, authorize, releaseAuthorization,
  mediaDevices, video, snapshot, encode, onState = () => {}, onError = () => {},
  schedule = setTimeout, unschedule = clearTimeout, timeoutMs = 15000,
}) {
  if (![binding, visible, subscribeInvalidation, authorize, releaseAuthorization, snapshot, encode]
    .every(fn => typeof fn === 'function') || !mediaDevices?.getUserMedia || !video
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw new Error('camera_configuration_unavailable');
  }
  let active = null, generation = 0, disposed = false, pendingAcquisition = false, pendingConversion = false;
  function stop(stream) { for (const track of stream?.getTracks?.() || []) { try { track.stop(); } catch {} } }
  function current(flow) {
    try {
      return !disposed && active === flow && flow.generation === generation
        && visible() === true && binding() === flow.binding;
    } catch { return false; }
  }
  function publish(flow, state) {
    if (!current(flow)) return false;
    flow.state = state;
    onState(Object.freeze({ state, generation: flow.generation }));
    return true;
  }
  function retire(flow) {
    if (!flow || flow.retired) return;
    flow.retired = true;
    if (flow.timer !== null) unschedule(flow.timer);
    flow.timer = null;
    for (const [track, listener] of flow.trackListeners) track.removeEventListener?.('ended', listener);
    flow.trackListeners.length = 0;
    stop(flow.stream);
    if (video.srcObject === flow.stream) video.srcObject = null;
    flow.stream = null;
    closeFrame(flow);
    flow.candidate = null;
    if (flow.authorization !== null) {
      // Ending this exact lease must not revoke a newer flow in a native adapter.
      const lease = flow.authorization; flow.authorization = null;
      try { Promise.resolve(releaseAuthorization(lease)).catch(() => {}); } catch {}
    }
  }
  function closeFrame(flow) {
    const frame = flow.frame;
    flow.frame = null;
    try { frame?.close?.(); } catch {}
  }
  function cancel() {
    const flow = active;
    active = null; generation += 1;
    retire(flow);
    if (!disposed) onState(Object.freeze({ state: 'idle', generation }));
  }
  function fail(flow, reason) {
    const owns = active === flow;
    if (owns) { active = null; generation += 1; }
    retire(flow);
    if (owns && !disposed) {
      onState(Object.freeze({ state: 'idle', generation }));
      onError(reason);
    }
    return false;
  }
  function deadline(flow) {
    if (flow.timer !== null) unschedule(flow.timer);
    flow.timer = schedule(() => fail(flow, 'camera_timed_out'), timeoutMs);
  }
  const unsubscribe = subscribeInvalidation(cancel);
  if (typeof unsubscribe !== 'function') throw new Error('camera_invalidation_unavailable');

  async function begin() {
    if (disposed) return false;
    if (pendingAcquisition || pendingConversion) { onError('camera_finishing_previous'); return false; }
    cancel();
    const identity = binding();
    if (typeof identity !== 'string' || !identity || visible() !== true) return false;
    const flow = { binding: identity, generation, state: 'authorizing', authorization: null,
      stream: null, frame: null, candidate: null, timer: null, trackListeners: [], retired: false };
    active = flow;
    pendingAcquisition = true;
    deadline(flow); publish(flow, 'authorizing');
    try {
      const authorization = await authorize(Object.freeze({ binding: identity, generation }));
      // Even a permission result delivered after cancellation owns a lease to end.
      if (!current(flow)) {
        if (authorization != null) await releaseAuthorization(authorization);
        return fail(flow, 'camera_binding_changed');
      }
      if (authorization == null) return fail(flow, 'camera_setup_required');
      flow.authorization = authorization;
      publish(flow, 'opening');
      const stream = await mediaDevices.getUserMedia({ audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      if (!current(flow)) { stop(stream); return fail(flow, 'camera_binding_changed'); }
      flow.stream = stream;
      const tracks = stream?.getVideoTracks?.() || [];
      if (!tracks.length || (stream.getAudioTracks?.() || []).length) return fail(flow, 'camera_invalid_stream');
      for (const track of tracks) {
        if (track.readyState === 'ended') return fail(flow, 'camera_ended');
        const listener = () => fail(flow, 'camera_ended');
        flow.trackListeners.push([track, listener]); track.addEventListener?.('ended', listener);
      }
      video.muted = true; video.playsInline = true; video.srcObject = stream;
      await video.play();
      if (!current(flow)) return fail(flow, 'camera_binding_changed');
      unschedule(flow.timer); flow.timer = null;
      return publish(flow, 'live');
    } catch { return fail(flow, 'camera_unavailable'); }
    finally { pendingAcquisition = false; }
  }

  async function capture() {
    const flow = active;
    if (!flow || flow.state !== 'live' || !current(flow)) return false;
    pendingConversion = true;
    publish(flow, 'encoding'); deadline(flow);
    let frame;
    try {
      // Snapshot is synchronous. Encoding owns only the frozen frame, never the
      // mutable/live video, so tracks can stop before asynchronous conversion.
      frame = snapshot(video);
      if (!frame || typeof frame.then === 'function') throw new Error('camera_invalid_frame');
      flow.frame = frame;
      for (const [track, listener] of flow.trackListeners) track.removeEventListener?.('ended', listener);
      flow.trackListeners.length = 0;
      stop(flow.stream);
      if (video.srcObject === flow.stream) video.srcObject = null;
      flow.stream = null;
      const candidate = await encode(frame);
      if (!current(flow)) return fail(flow, 'camera_binding_changed');
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('camera_invalid_image');
      flow.candidate = Object.freeze({ ...candidate });
      unschedule(flow.timer); flow.timer = null;
      return publish(flow, 'preview');
    } catch { return fail(flow, 'camera_photo_not_added'); }
    finally { closeFrame(flow); pendingConversion = false; }
  }

  function keep() {
    const flow = active;
    if (!flow || flow.state !== 'preview' || !current(flow)) { cancel(); return null; }
    const result = Object.freeze({ binding: flow.binding, generation: flow.generation, image: flow.candidate });
    cancel();
    // This is a capture result, NOT a saved draft. Only the owning page's exact
    // protected write/readback can report persistence or completion.
    return result;
  }

  return Object.freeze({ begin, capture, keep, cancel, retake: begin,
    state: () => active?.state || 'idle',
    preview: () => active?.state === 'preview' && current(active) ? active.candidate : null,
    dispose() { if (disposed) return; disposed = true; cancel(); unsubscribe(); },
  });
}
