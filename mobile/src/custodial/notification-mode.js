// One source-owned choice for native presentation and the browser fallback.
// Pending/denied permissions and partial setup must never disable the fallback.
export function createNotificationPresentationMode({ capable, changed = () => {} }) {
  let state = Object.freeze({ capable: capable === true, routingReady: false,
    receivePermission: 'pending', displayPermission: 'pending', registered: false });
  const native = () => state.capable && state.routingReady && state.registered
    && state.receivePermission === 'granted' && state.displayPermission === 'granted';
  const snapshot = () => Object.freeze({ ...state, mode: native() ? 'native' : 'browser' });
  return Object.freeze({
    get native() { return native(); },
    snapshot,
    update(patch) {
      const previous = native();
      state = Object.freeze({ ...state,
        routingReady: patch.routingReady === undefined ? state.routingReady : patch.routingReady === true,
        registered: patch.registered === undefined ? state.registered : patch.registered === true,
        receivePermission: patch.receivePermission ?? state.receivePermission,
        displayPermission: patch.displayPermission ?? state.displayPermission });
      if (native() !== previous) changed(snapshot());
      return snapshot();
    },
  });
}
