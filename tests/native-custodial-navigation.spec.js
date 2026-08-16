const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { expect, test } = require('@playwright/test');

const output = '/build/batch-0b-shell-browser/custodial';
const outputDirectory = resolve(__dirname, '..', output.slice(1));
const modules = [
  ['employee-schedule.html', ''],
  ['events.html', '?hub=employee'],
  ['system-feedback.html', '?hub=employee'],
];

test.beforeAll(() => {
  for (const [file] of modules) {
    if (!existsSync(resolve(outputDirectory, file))) {
      throw new Error(`Missing compiled Custodial fixture ${file}. Run npm run build:batch-0b:browser-fixtures.`);
    }
  }
  expect(readFileSync(resolve(outputDirectory, 'memphis-ui.js'), 'utf8'))
    .toContain('nativeCustodialHome ? "./index.html"');
});

for (const [file, query] of modules) {
  test(`compiled native Custodial ${file} returns to protected home`, async ({ page }) => {
    await page.addInitScript(({ deviceId, credential, seal }) => {
      const installationRecord = JSON.stringify({
        schema_version: 1,
        credential,
        device_id: deviceId,
        installation_seal: seal,
        enrolled_at: '2026-08-01T00:00:00.000Z',
        migrated_from_credential_only_state: false,
      });
      localStorage.setItem(
        'capacitor-storage_memphis_zoo_custodial_installation_record_v1',
        JSON.stringify(installationRecord),
      );
      for (const key of ['memphisAssignedDeviceId', 'mz_scan_device_id', 'mz_employee_hub_device_id']) {
        localStorage.setItem(key, deviceId);
      }
      localStorage.setItem('memphisZooCustodialInstallationSeal', seal);
    }, {
      deviceId: 'KIOSK_08',
      credential: 'native-navigation-protected-device-credential',
      seal: 'native-navigation-installation-seal',
    });
    await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const data = pathname === '/device-auth/status'
        ? { authenticated: true, canonical_device_id: 'KIOSK_08', device_id: 'KIOSK_08', employee_name: 'Karen Robinson' }
        : (pathname.includes('/events')
          ? []
          : (pathname.includes('/my-day-summary') ? { service_date: '2026-08-02', groups: [] } : {}));
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data }),
      });
    });
    await page.goto(`${output}/${file}${query}`);
    await expect.poll(() => page.evaluate(() => Boolean(window.MemphisUI))).toBe(true);

    const expectedPath = `${output}/index.html`;
    const target = await page.evaluate(() => window.MemphisUI.canonicalBackTarget('employee').toString());
    expect(new URL(target).pathname).toBe(expectedPath);
    expect(new URL(target).search).toBe('');

    await page.locator('[data-mz-back]').first().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(expectedPath);
  });
}

test('native NFC remains ambient on compatibility modules and accepts the same tag twice', async ({ page }) => {
  await page.addInitScript(({ deviceId, credential, seal }) => {
    const installationRecord = JSON.stringify({
      schema_version: 1,
      credential,
      device_id: deviceId,
      installation_seal: seal,
      enrolled_at: '2026-08-01T00:00:00.000Z',
      migrated_from_credential_only_state: false,
    });
    localStorage.setItem(
      'capacitor-storage_memphis_zoo_custodial_installation_record_v1',
      JSON.stringify(installationRecord),
    );
    for (const key of ['memphisAssignedDeviceId', 'mz_scan_device_id', 'mz_employee_hub_device_id']) {
      localStorage.setItem(key, deviceId);
    }
    localStorage.setItem('memphisZooCustodialInstallationSeal', seal);
  }, {
    deviceId: 'KIOSK_08',
    credential: 'native-navigation-protected-device-credential',
    seal: 'native-navigation-installation-seal',
  });
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname === '/device-auth/status'
      ? { authenticated: true, canonical_device_id: 'KIOSK_08', device_id: 'KIOSK_08', employee_name: 'Karen Robinson' }
      : (pathname.includes('/my-day-summary') ? { service_date: '2026-08-02', groups: [] } : {});
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data }),
    });
  });

  await page.goto(`${output}/events.html?hub=employee`);
  await expect.poll(() => page.evaluate(() => window.MemphisMobile?.securityStatus?.().state)).toBe('enrolled');
  await expect.poll(() => page.evaluate(() => typeof window.__dispatchCustodialNativeScanForTest)).toBe('function');

  const scan = 'memphiszoo://scan?code=RESTROOM_TRACE&token=secret&mz_nfc_handoff=11111111-1111-4111-8111-111111111111';
  await page.evaluate((url) => window.__dispatchCustodialNativeScanForTest(url), scan);
  await page.waitForURL((url) => url.pathname.endsWith('/scan.html') && url.searchParams.get('code') === 'RESTROOM_TRACE');
  let target = new URL(page.url());
  expect(target.searchParams.get('device')).toBe('KIOSK_08');
  expect(target.searchParams.get('source')).toBe('native-nfc');
  expect(target.searchParams.get('token')).toBeNull();
  expect(target.searchParams.get('mz_nfc_handoff')).toBeNull();

  await expect.poll(() => page.evaluate(() => typeof window.__dispatchCustodialNativeScanForTest)).toBe('function');
  await Promise.all([
    page.waitForNavigation(),
    page.evaluate((url) => window.__dispatchCustodialNativeScanForTest(url), scan),
  ]);
  target = new URL(page.url());
  expect(target.pathname).toContain('/scan.html');
  expect(target.searchParams.get('code')).toBe('RESTROOM_TRACE');
});
