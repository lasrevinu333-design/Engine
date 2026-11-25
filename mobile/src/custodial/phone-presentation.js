// This controls the clock presentation only. Every route still owns its
// protected authorization and retained work.
export function createPhonePresentation({ principal, read }) {
  let observed = null;
  let sequence = 0;
  let lifecycle = 0;
  let pendingRead = null;
  const current = () => observed?.principal === principal() ? observed : null;
  async function update(unlock) {
    const owner = principal(), invocation = ++sequence;
    if (!owner) return false;
    const prior = current();
    if (!unlock && typeof read !== 'function') return prior?.unlocked === true;
    const wake = unlock ? prior?.wake : undefined;
    if (unlock && typeof read === 'function' && !wake) return false;
    const result = typeof read === 'function' ? await Promise.resolve().then(() => read(wake)).catch(() => null) : { unlocked: unlock };
    if (invocation !== sequence || owner !== principal()) return false;
    observed = { principal: owner, wake: result?.wake, unlocked: result?.unlocked === true };
    return observed.unlocked;
  }
  function refresh() {
    const owner = principal();
    if (!owner) return Promise.resolve(false);
    if (pendingRead?.owner === owner) return pendingRead.promise;
    const flight = { owner, promise: update(false) };
    pendingRead = flight;
    return flight.promise.finally(() => {
      if (pendingRead === flight) pendingRead = null;
    });
  }
  async function unlock() {
    const owner = principal(), epoch = lifecycle;
    if (!owner) return false;
    if (typeof read === 'function' && !current()?.wake) await refresh();
    if (epoch !== lifecycle || owner !== principal()) return false;
    return current()?.unlocked === true || update(true);
  }
  return {
    unlocked: () => current()?.unlocked === true,
    refresh,
    unlock,
    reset() { ++lifecycle; ++sequence; observed = null; pendingRead = null; },
  };
}

export function bindPhoneUnlock(surface, button, unlock, viewportHeight = () => window.innerHeight) {
  let start = null;
  button.addEventListener('click', unlock);
  surface.addEventListener('touchstart', event => {
    start = event.touches.length === 1 ? event.touches[0] : null;
  }, { passive: true });
  surface.addEventListener('touchcancel', () => { start = null; });
  surface.addEventListener('touchend', event => {
    const original = start;
    start = null;
    if (!original || event.touches.length) return;
    const final = Array.from(event.changedTouches).find(touch => touch.identifier === original.identifier);
    if (!final) return;
    const up = original.clientY - final.clientY;
    const across = Math.abs(original.clientX - final.clientX);
    // Use the existing Fully clock's deliberate swipe threshold.
    if (up >= Math.max(180, Math.round(viewportHeight() * .22)) && up > across) unlock();
  }, { passive: true });
}

const workPages = new Set(['/messages.html', '/employee-schedule.html', '/events.html', '/employee-feedback.html', '/system-feedback.html']);

export function installWorkPageClock({ app, mobile, document, window }) {
  if (!workPages.has(window.location.pathname) || typeof mobile.phonePresentation !== 'function') return;
  const clock = createPhonePresentation({ principal: mobile.principalIdentity, read: mobile.phonePresentation });
  const dialog = document.createElement('dialog');
  dialog.className = 'phoneLock phoneLockDialog';
  dialog.setAttribute('aria-label', 'Employee phone lock screen');
  dialog.innerHTML = '<div class="phoneLockPanel"><div class="phoneLockBrand">Custodial</div><div class="phoneLockClock"></div><div class="phoneLockDate"></div><div class="phoneLockName">Employee phone</div><button type="button" class="phoneUnlock">Unlock</button></div>';
  const button = dialog.querySelector('button');
  const time = dialog.querySelector('.phoneLockClock');
  const date = dialog.querySelector('.phoneLockDate');
  const name = dialog.querySelector('.phoneLockName');
  let timer = null, lifecycle = 0;
  const drawTime = () => {
    const now = new Date();
    time.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    date.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };
  function close() {
    if (dialog.open) dialog.close();
    window.clearInterval(timer);
    timer = null;
  }
  function show() {
    if (!mobile.principalIdentity()) return close();
    const profile = mobile.readCustodialHomeCache()?.profile;
    name.textContent = profile && mobile.profileMatchesPrincipal(profile)
      ? (profile.employee_name || profile.employee?.display_name || profile.employee?.name || 'Employee phone')
      : 'Employee phone';
    drawTime();
    if (!dialog.open) dialog.showModal();
    if (timer === null) timer = window.setInterval(drawTime, 1000);
  }
  const refresh = async () => {
    const invocation = ++lifecycle;
    const unlocked = await clock.refresh();
    if (invocation !== lifecycle) return;
    if (unlocked) close();
    else show();
  };
  bindPhoneUnlock(dialog, button, async () => {
    const invocation = lifecycle;
    if (await clock.unlock() && invocation === lifecycle) close();
    else if (invocation === lifecycle) await refresh();
  });
  dialog.addEventListener('cancel', event => event.preventDefault());
  const mount = () => {
    if (!document.querySelector('link[data-custodial-phone-clock]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = './custodial-phone-clock.css';
      style.dataset.custodialPhoneClock = '';
      document.head.append(style);
    }
    document.body.append(dialog);
    void app.addListener('pause', () => { ++lifecycle; clock.reset(); show(); });
    void app.addListener('resume', refresh);
    window.addEventListener('memphis:custodial-security-state', () => { clock.reset(); void refresh(); });
    window.addEventListener('pageshow', refresh);
    window.addEventListener('pagehide', () => { ++lifecycle; clock.reset(); close(); });
    void mobile.ready.then(refresh, close);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
}
