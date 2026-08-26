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

test('protected Custodial lock and Home show the current enrolled employee without changing the four-choice Home', async ({ page }) => {
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
    sessionStorage.removeItem('mz_custodial_phone_unlocked_since_wake_v1');
  }, {
    deviceId: 'KIOSK_08',
    credential: 'native-lock-protected-device-credential',
    seal: 'native-lock-installation-seal',
  });
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname === '/device-auth/status'
      ? { authenticated: true, canonical_device_id: 'KIOSK_08', device_id: 'KIOSK_08', employee_name: 'Karen Robinson' }
      : {};
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });

  await page.goto(`${output}/index.html`);
  await expect(page.locator('#phone-lock')).toBeVisible();
  await expect(page.locator('#phone-lock-name')).toHaveText('Karen Robinson');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.locator('#phone-lock')).toBeHidden();
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('.homeMenu .homeButton')).toHaveCount(4);
  await expect(page.locator('.homeMenu .homeButton')).toHaveText(['Schedule', 'Messages', 'Events', 'Feedback']);
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

test('a stale launch handoff is not reclaimed after reaching its protected scan route', async ({ page }) => {
  const handoff = '22222222-2222-4222-8222-222222222222';
  await page.addInitScript(({ deviceId, credential, seal, launchUrl }) => {
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
    window.__MZ_CUSTODIAL_NATIVE_LAUNCH_URL_FOR_TEST__ = launchUrl;
  }, {
    deviceId: 'KIOSK_08',
    credential: 'native-navigation-protected-device-credential',
    seal: 'native-navigation-installation-seal',
    launchUrl: `memphiszoo://scan?code=NOCX&mz_nfc_handoff=${handoff}`,
  });
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname === '/device-auth/status'
      ? { authenticated: true, canonical_device_id: 'KIOSK_08', device_id: 'KIOSK_08', employee_name: 'Karen Robinson' }
      : (pathname.includes('/my-day-summary') ? { service_date: '2026-08-02', groups: [] } : {});
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });

  await page.goto(`${output}/events.html?hub=employee`);
  await page.waitForURL((url) => url.pathname.endsWith('/scan.html')
    && url.searchParams.get('code') === 'NOCX'
    && url.searchParams.get('source') === 'native-nfc');
  await page.evaluate(() => window.MemphisNativeScanHandoffReady);

  expect(await page.evaluate(() => sessionStorage.getItem('mz_custodial_native_launch_calls_for_test'))).toBe('1');
  expect(new URL(page.url()).searchParams.get('device')).toBe('KIOSK_08');
});
