import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('mobile/src/custodial/index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const implementation = read('mobile/src/custodial/readiness.js').replace(/^export /gm, '')
  + '\n' + read('mobile/src/custodial/hourly-forecast-keyboard.js').replace(/^export /gm, '')
  + '\n' + read('mobile/src/custodial/app.js').replace(/^import .*;\s*$/gm, '');
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport, timezoneId: 'Asia/Tokyo' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // This dedicated headless fixture cannot contact a real server.
    await page.route('**/*', route => route.abort());
    await page.setContent(html);
    await page.evaluate(() => {
      const status = { initialized: true, ready: true, available: true, quarantined: false, state: 'enrolled', deviceId: 'KIOSK_08', generation: 1 };
      const listeners = new Map(); let subscriber; let queue = [];
      const profile = { authenticated: true, employee_name: 'Fixture Custodian', fixture_principal: 'p' };
      window.MemphisCustodialSecurity = { native: true, ready: Promise.resolve(), getStatus: () => ({ ...status }),
        ensureSecurityState: async () => ({ ...status }), subscribe: fn => { subscriber = fn; }, getPendingEnrollmentOperation: () => null };
      window.MemphisUI = { resolveOpenScanSession: () => ({ state: 'open', session: { location_name: 'Original Place' } }), isUnstartedScanSession: () => false };
      window.MemphisScanSync = { ready: Promise.resolve(true), listActions: async () => queue,
        recoverLocalCompletionIntents: async () => {}, reconcileStartupRecovery: async () => ({ state: 'none' }) };
      window.MemphisMobile = { principalIdentity: () => 'p', profileMatchesPrincipal: p => p?.fixture_principal === 'p',
        whenReady: async () => {}, resumePendingSecurityWorkflow: async () => {}, readCustodialHomeCache: () => ({ profile }),
        saveCustodialHomeCache: async () => true, requestJson: async path => path.startsWith('/device-auth/status') ? profile : { fixture: true },
        saveOfflineScanAuthoritySnapshot: async () => true,
        getReadinessObservation: async () => ({ observation: 'CONFIRMED', read_only: true,
          native_clock_continuity: 'CONFIRMED', protected_work_admission: 'CLEAR',
          pending_occurrences: false, unfinished_occurrence: false, rollback_fence_active: false }) };
      window.installHomeFacts = () => ({ stop() {}, update() {}, authenticatedProfileRestored() { return true; } });
      window.Network = { addListener: async (event, fn) => listeners.set(event, fn) };
      window.App = { addListener: async (event, fn) => listeners.set(event, fn) };
      window.StatusBar = { hide: async () => {} };
      window.readinessFixture = {
        pending() { queue = [{ type: 'complete_session', payload: { original: 'protected' } }]; window.dispatchEvent(new CustomEvent('memphis-scan-sync', { detail: { status: 'queued' } })); },
        deadLetter() { queue[0].dead_letter = true; window.dispatchEvent(new CustomEvent('memphis-scan-sync', { detail: { status: 'dead-letter' } })); },
        quarantine() { status.quarantined = true; subscriber({ ...status }); },
        bytes: () => JSON.stringify(queue),
      };
    });
    await page.addScriptTag({ content: implementation });
    await page.waitForFunction(() => document.getElementById('lock-readiness').textContent.startsWith('Ready for work — Last confirmed'));
    assert.equal(await page.locator('#lock-readiness').isVisible(), true);
    const unlockBox = await page.locator('#phone-unlock').boundingBox();
    assert.ok(unlockBox && unlockBox.x >= 0 && unlockBox.x + unlockBox.width <= viewport.width && unlockBox.y + unlockBox.height <= viewport.height, `Unlock remains reachable at ${viewport.width}`);
    await page.locator('#phone-unlock').click();
    async function verify(label, target = '#home-readiness') {
      await page.waitForFunction(({ selector, label }) => document.querySelector(selector).textContent.startsWith(`${label} —`), { selector: target, label });
      assert.equal(await page.locator(target).isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const box = await page.locator(target).boundingBox();
      assert.ok(box && box.width > 100 && box.x >= 0 && box.x + box.width <= viewport.width);
      assert.equal(await page.locator(target).getAttribute('role'), 'status');
      results.push({ viewport: viewport.width, label, passed: true });
    }
    await verify('Ready for work');
    await page.evaluate(() => readinessFixture.pending());
    await verify('Needs internet');
    const saved = await page.evaluate(() => readinessFixture.bytes());
    assert.equal(await page.locator('#active-cleaning').isVisible(), true);
    assert.equal(await page.locator('#active-cleaning-text').textContent(), 'You are cleaning Original Place. Tap the same physical tag when you are done.');
    await page.evaluate(() => readinessFixture.deadLetter());
    await verify('Needs manager');
    assert.equal(await page.evaluate(() => JSON.parse(readinessFixture.bytes())[0].payload.original), JSON.parse(saved)[0].payload.original);
    await page.evaluate(() => readinessFixture.quarantine());
    await verify('Do not use', '#assignment-readiness');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(JSON.stringify({ scope: 'Actual source HTML/CSS and controller in isolated headless Chromium; synthetic native/backend, all external requests denied; no APK/phone', passed: results.length, results }, null, 2));
} finally { await browser.close(); }
