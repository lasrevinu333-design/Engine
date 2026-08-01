#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureSource = String.raw`
  import {
    CUSTODIAL_DEVICE_KEYS,
    CUSTODIAL_INSTALLATION_MARKER_KEY,
    CUSTODIAL_INSTALLATION_RECORD_KEY,
  } from '../src/custodial/credential-store.js';
  import { getCustodialBridgeSecurityRuntime } from '../src/custodial/security-runtime.js';
  import { installCustodialStorageFirewall } from '../src/custodial/storage-firewall.js';

  const deviceId = 'KIOSK_08';
  const secret = 'browser-private-device-credential';
  const seal = 'browser-private-installation-seal';
  let rawStorage;
  let runtime;
  let installation;

  globalThis.firewallFixture = Object.freeze({
    async start() {
      rawStorage = globalThis.localStorage;
      rawStorage.clear();
      for (const key of CUSTODIAL_DEVICE_KEYS) rawStorage.setItem(key, deviceId);
      rawStorage.setItem(CUSTODIAL_INSTALLATION_MARKER_KEY, seal);
      const protectedValues = new Map([[
        CUSTODIAL_INSTALLATION_RECORD_KEY,
        JSON.stringify({
          schema_version: 1,
          credential: secret,
          device_id: deviceId,
          installation_seal: seal,
          enrolled_at: '2026-08-01T00:00:00.000Z',
          migrated_from_credential_only_state: false,
        }),
      ]]);
      const secureStorage = {
        async get(key) { return protectedValues.get(String(key)) ?? null; },
        async set(key, value) { protectedValues.set(String(key), String(value)); },
        async remove(key) { protectedValues.delete(String(key)); },
      };
      runtime = getCustodialBridgeSecurityRuntime({
        secureStorage,
        storage: rawStorage,
        cryptoApi: globalThis.crypto,
        indexedDb: globalThis.indexedDB,
      });
      installation = installCustodialStorageFirewall({
        storage: rawStorage,
        getSecurityStatus: runtime.security.getStatus,
      });
      await runtime.security.ready;
      return this.snapshot();
    },
    snapshot() {
      const status = runtime.security.getStatus();
      return {
        status,
        cacheDeviceId: rawStorage.getItem('memphisAssignedDeviceId'),
        crossContextTampered: installation.crossContextTampered(),
        firewallBlocked: installation.blocked(),
        publicCredentialExposed: JSON.stringify(globalThis.MemphisCustodialSecurity).includes(secret),
      };
    },
    async attemptAuthorizedTransport() {
      let callbackCalled = false;
      let error = null;
      try {
        await runtime.credentialStore.dispatchAuthorizedTransport(() => {
          callbackCalled = true;
          throw new Error('credential callback must not run after cache tamper');
        });
      } catch (caught) {
        error = { name: caught?.name || '', code: caught?.code || '', message: caught?.message || '' };
      }
      return { callbackCalled, error, status: runtime.security.getStatus() };
    },
    async revalidate() {
      let error = null;
      try { await runtime.security.ensureSecurityState(); }
      catch (caught) {
        error = { name: caught?.name || '', code: caught?.code || '', message: caught?.message || '' };
      }
      return { error, status: runtime.security.getStatus() };
    },
  });
`;

const bundle = await build({
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  write: false,
  stdin: {
    contents: fixtureSource,
    loader: 'js',
    resolveDir: scriptsDirectory,
    sourcefile: 'custodial-storage-firewall-browser-fixture.js',
  },
});
const fixtureJavaScript = bundle.outputFiles[0].text;
const server = createServer((request, response) => {
  if (request.url === '/fixture.js') {
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
    response.end(fixtureJavaScript);
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(request.url === '/frame'
    ? '<!doctype html><title>same-origin frame</title>'
    : '<!doctype html><title>firewall fixture</title><script src="/fixture.js"></script>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true });
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const mutation of ['write', 'delete']) {
    const page = await browser.newPage();
    await page.goto(origin);
    const initial = await page.evaluate(() => globalThis.firewallFixture.start());
    assert.equal(initial.status.state, 'enrolled');
    assert.equal(initial.status.deviceId, 'KIOSK_08');
    assert.equal(initial.publicCredentialExposed, false);

    const mainRealm = await page.evaluate(() => {
      const attempts = {};
      for (const [name, operation] of Object.entries({
        namedWrite: () => { localStorage.memphisAssignedDeviceId = 'KIOSK_02'; },
        namedDelete: () => { delete localStorage.memphisAssignedDeviceId; },
        defineProperty: () => Object.defineProperty(localStorage, 'memphisAssignedDeviceId', { value: 'KIOSK_02' }),
        replaceSetItem: () => Object.defineProperty(Storage.prototype, 'setItem', { value() {} }),
      })) {
        try { operation(); attempts[name] = 'allowed'; }
        catch (error) { attempts[name] = error.name; }
      }
      localStorage.ordinary_cache_key = 'ordinary-value';
      localStorage['session:ready-work'] = 'preserved-session';
      return {
        attempts,
        deviceId: localStorage.getItem('memphisAssignedDeviceId'),
        ordinary: localStorage.getItem('ordinary_cache_key'),
        protectedWork: localStorage.getItem('session:ready-work'),
        setItemDescriptor: Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem'),
        localStorageDescriptor: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
      };
    });
    assert.deepEqual(mainRealm.attempts, {
      namedWrite: 'CustodialProtectedStateMutationError',
      namedDelete: 'CustodialProtectedStateMutationError',
      defineProperty: 'CustodialProtectedStateMutationError',
      replaceSetItem: 'TypeError',
    });
    assert.equal(mainRealm.deviceId, 'KIOSK_08');
    assert.equal(mainRealm.ordinary, 'ordinary-value');
    assert.equal(mainRealm.protectedWork, 'preserved-session');
    assert.equal(mainRealm.setItemDescriptor.configurable, false);
    assert.equal(mainRealm.setItemDescriptor.writable, false);
    assert.equal(mainRealm.localStorageDescriptor.configurable, false);
    assert.equal(mainRealm.localStorageDescriptor.writable, false);

    await page.evaluate(async (kind) => {
      const changed = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('cross-context storage event timed out')), 3000);
        const listener = (event) => {
          if (event.key !== 'memphisAssignedDeviceId') return;
          clearTimeout(timeout);
          globalThis.removeEventListener('storage', listener);
          resolve();
        };
        globalThis.addEventListener('storage', listener);
      });
      const frame = document.createElement('iframe');
      frame.src = '/frame';
      document.body.append(frame);
      await new Promise((resolve, reject) => {
        frame.addEventListener('load', resolve, { once: true });
        frame.addEventListener('error', reject, { once: true });
      });
      if (kind === 'write') frame.contentWindow.localStorage.memphisAssignedDeviceId = 'KIOSK_02';
      else delete frame.contentWindow.localStorage.memphisAssignedDeviceId;
      await changed;
    }, mutation);

    const tampered = await page.evaluate(() => globalThis.firewallFixture.snapshot());
    assert.equal(tampered.cacheDeviceId, mutation === 'write' ? 'KIOSK_02' : null);
    assert.equal(tampered.crossContextTampered, true);
    assert.equal(tampered.firewallBlocked, true);
    assert.equal(tampered.status.state, 'enrolled', 'untrusted cache must not directly rewrite active authority');
    assert.equal(tampered.status.deviceId, 'KIOSK_08');
    assert.equal(tampered.publicCredentialExposed, false);

    const transport = await page.evaluate(() => globalThis.firewallFixture.attemptAuthorizedTransport());
    assert.equal(transport.callbackCalled, false, 'tampered cache must fail before credential handoff');
    assert.ok(transport.error, 'tampered cache must reject authorized transport');
    assert.equal(transport.status.ready, false);
    assert.equal(transport.status.deviceId, '');

    const revalidated = await page.evaluate(() => globalThis.firewallFixture.revalidate());
    assert.ok(revalidated.error, 'explicit revalidation must reject the tampered binding');
    assert.equal(revalidated.status.quarantined, true);
    assert.equal(revalidated.status.deviceId, '');
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

console.log('CUSTODIAL_STORAGE_FIREWALL_BROWSER_PASS');
