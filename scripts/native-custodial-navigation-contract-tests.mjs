#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../memphis-ui.js', import.meta.url), 'utf8');

function storage(values = {}) {
  const state = new Map(Object.entries(values));
  return {
    getItem: (key) => state.has(key) ? state.get(key) : null,
    setItem: (key, value) => state.set(key, String(value)),
    removeItem: (key) => state.delete(key),
  };
}

function navigationRuntime({ context = 'employee', native = false } = {}) {
  const location = new URL('https://localhost/employee-schedule.html?hub=employee&device=KIOSK_08');
  const window = {
    location,
    localStorage: storage(),
    sessionStorage: storage(),
    addEventListener() {},
    confirm: () => true,
  };
  window.top = window;
  window.self = window;
  if (native) window.MemphisMobileBuildIdentity = Object.freeze({ edition: 'custodial' });

  const document = {
    body: { dataset: { memphisContext: context } },
    documentElement: { classList: { add() {} }, hidden: false },
    readyState: 'loading',
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    visibilityState: 'visible',
  };
  vm.runInNewContext(source, {
    URL,
    window,
    document,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    navigator: { userAgent: native ? 'Android Memphis Zoo Custodial' : 'Browser' },
    Element: class Element {},
    HTMLAnchorElement: class HTMLAnchorElement {},
    HTMLFormElement: class HTMLFormElement {},
    console,
  }, { filename: 'memphis-ui.js' });
  return { ui: window.MemphisUI, localStorage: window.localStorage };
}

const browserEmployeeRuntime = navigationRuntime();
const browserEmployee = browserEmployeeRuntime.ui;
const browserTarget = browserEmployee.canonicalBackTarget();
assert.equal(browserTarget.pathname, '/employee-hub.html');
assert.equal(browserTarget.searchParams.get('hub'), 'employee');
assert.equal(browserTarget.searchParams.get('device'), 'KIOSK_08');

const nativeEmployee = navigationRuntime({ native: true }).ui;
const nativeTarget = nativeEmployee.canonicalBackTarget();
assert.equal(nativeTarget.toString(), 'https://localhost/index.html',
  'native employee modules must return directly to the protected Custodial home');
assert.equal(nativeTarget.search, '',
  'native return must not carry a URL-provided device identity into the protected home');

const browserManager = navigationRuntime({ context: 'manager' }).ui;
assert.equal(browserManager.canonicalBackTarget().pathname, '/start_page1.html');

const firstSession = {
  session_uuid: '11111111-1111-4111-8111-111111111111',
  client_session_id: '11111111-1111-4111-8111-111111111111',
  device_id: 'KIOSK_08',
  location_code: 'NOCX',
  location_name: 'Nocturnal',
  status: 'active',
};
browserEmployeeRuntime.localStorage.setItem(`session:${firstSession.session_uuid}`, JSON.stringify(firstSession));
assert.equal(browserEmployee.indexScanSession(firstSession), true);
const resolvedFirst = browserEmployee.resolveOpenScanSession('KIOSK_08');
assert.equal(resolvedFirst.state, 'open');
assert.equal(resolvedFirst.session.session_uuid, firstSession.session_uuid);
assert.equal(resolvedFirst.session.location_code, firstSession.location_code,
  'the explicit active-work index must resolve the directly-bound session');

const secondSession = {
  ...firstSession,
  session_uuid: '22222222-2222-4222-8222-222222222222',
  client_session_id: '22222222-2222-4222-8222-222222222222',
  location_code: 'AQUARIUM',
  location_name: 'Aquarium Restrooms',
};
browserEmployeeRuntime.localStorage.setItem(`session:${secondSession.session_uuid}`, JSON.stringify(secondSession));
assert.equal(browserEmployee.indexScanSession(secondSession), true);
assert.equal(browserEmployee.resolveOpenScanSession('KIOSK_08').state, 'ambiguous',
  'multiple indexed active contexts must fail closed instead of selecting the newest');
browserEmployee.clearScanView(secondSession.session_uuid, 'KIOSK_08');
assert.equal(browserEmployee.resolveOpenScanSession('KIOSK_08').state, 'open');
browserEmployeeRuntime.localStorage.setItem('mz_phone_scan_resume:KIOSK_08', '{bad json');
assert.equal(browserEmployee.resolveOpenScanSession('KIOSK_08').state, 'corrupted',
  'a malformed active-work index must fail closed');

for (const page of ['employee-schedule.html', 'events.html', 'system-feedback.html']) {
  const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
  assert.match(html, /data-mz-back/, `${page} must delegate Back to the canonical shared route`);
  assert.match(html, /memphis-ui\.js/, `${page} must load the canonical shared route runtime`);
}

console.log(JSON.stringify({
  ok: true,
  browser_employee_target: browserTarget.toString(),
  native_employee_target: nativeTarget.toString(),
  manager_target: browserManager.canonicalBackTarget().toString(),
}));
