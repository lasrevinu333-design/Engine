#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const syncSource = readFileSync(new URL('../memphis-scan-sync.js', import.meta.url), 'utf8');
const server = createServer((request, response) => {
  if (request.url === '/memphis-scan-sync.js') {
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
    response.end(syncSource);
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><script>
    window.MemphisCustodialSecurity = {
      native: true,
      getStatus: () => ({ ready: true, available: true, quarantined: false, deviceId: 'KIOSK_08' }),
      waitForStableState: async () => true,
      mutateProtectedWork: async (operation) => operation({ deviceId: 'KIOSK_08', generation: 1, state: 'ready' }),
    };
    window.MemphisDeviceIdentity = { resolve: () => ({ deviceId: 'KIOSK_08' }) };
    window.fetch = async () => ({ ok: false, status: 503, json: async () => null, headers: new Headers() });
  </script><script src="/memphis-scan-sync.js"></script>`);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  assert.equal(await page.evaluate(() => window.MemphisScanSync.ready), true);

  const identity = {
    contract_version: 'scan.v4.snapshot-bound-authority',
    session_uuid: '11111111-1111-4111-8111-111111111111',
    client_completion_id: '22222222-2222-4222-8222-222222222222',
    device_id: 'KIOSK_08',
    employee_id: '33333333-3333-4333-8333-333333333333',
    location_code: 'NOCX',
  };
  const saved = await page.evaluate((input) => window.MemphisScanSync.saveCompletionDraft({
    ...input,
    draft: { work_result: 'details', issues: ['Sink'], note: 'Slow drain' },
  }), identity);
  assert.match(saved.integrity_sha256, /^[a-f0-9]{64}$/);

  await page.evaluate(() => localStorage.clear());
  const recovered = await page.evaluate((input) => window.MemphisScanSync.loadCompletionDraft(input), identity);
  assert.deepEqual(recovered.draft, { issues: ['Sink'], note: 'Slow drain', work_result: 'details' },
    'the completion answers must survive browser-local storage loss');

  await page.reload();
  assert.equal(await page.evaluate(() => window.MemphisScanSync.ready), true);
  const recoveredAfterProcessRecreation = await page.evaluate((input) => window.MemphisScanSync.loadCompletionDraft(input), identity);
  assert.deepEqual(recoveredAfterProcessRecreation.draft, recovered.draft,
    'the durable draft must survive renderer/process recreation');

  await page.evaluate((record) => {
    localStorage.setItem(`mz_scan_completion_draft:${record.session_uuid}`, JSON.stringify(record));
  }, recoveredAfterProcessRecreation);
  await page.evaluate(async (sessionUuid) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mz_scan_completion_drafts', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').delete(sessionUuid);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, identity.session_uuid);
  assert.equal(await page.evaluate((input) => window.MemphisScanSync.loadCompletionDraft(input), identity), null,
    'clearing IndexedDB must not fabricate completion answers from a weaker browser copy');
  assert.ok(await page.evaluate((sessionUuid) => localStorage.getItem(`mz_scan_completion_draft:${sessionUuid}`), identity.session_uuid),
    'the surviving weaker copy remains available for the application to quarantine for manager recovery');

  await page.evaluate((input) => window.MemphisScanSync.saveCompletionDraft({
    ...input,
    draft: { work_result: 'details', issues: ['Sink'], note: 'Slow drain' },
  }), identity);

  const mismatch = await page.evaluate(async (input) => {
    try {
      await window.MemphisScanSync.loadCompletionDraft({ ...input, location_code: 'AQUARIUM' });
      return null;
    } catch (error) { return { code: error?.code || '', message: error?.message || '' }; }
  }, identity);
  assert.equal(mismatch.code, 'custodial_storage_unavailable');

  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mz_scan_completion_drafts', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      const request = store.get('11111111-1111-4111-8111-111111111111');
      request.onsuccess = () => store.put({ ...request.result, draft: { work_result: 'full' } });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  const tampered = await page.evaluate(async (input) => {
    try { await window.MemphisScanSync.loadCompletionDraft(input); return null; }
    catch (error) { return { code: error?.code || '', message: error?.message || '' }; }
  }, identity);
  assert.equal(tampered.code, 'custodial_storage_unavailable');
  assert.match(tampered.message, /integrity check failed/);

  await page.evaluate((sessionUuid) => window.MemphisScanSync.deleteCompletionDraft(sessionUuid), identity.session_uuid);
  assert.equal(await page.evaluate((input) => window.MemphisScanSync.loadCompletionDraft(input), identity), null);
  console.log('CUSTODIAL_COMPLETION_DRAFT_RECOVERY_PASS');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
