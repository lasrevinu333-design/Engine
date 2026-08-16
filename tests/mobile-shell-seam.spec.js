const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { expect, test } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const repositoryRoot = resolve(__dirname, '..');
const outputRoot = 'build/batch-0b-shell-browser';
const editions = {
  manager: {
    route: 'today',
    marker: 'MZ_ROLE_MANAGER_ONLY',
    heading: 'Today',
    navigation: ['Today', 'Messages', 'Schedule', 'Locations', 'More'],
  },
  custodial: {
    route: 'schedule',
    marker: 'MZ_ROLE_CUSTODIAL_ONLY',
    heading: 'Schedule',
    navigation: [],
    prohibitedFiles: [
      'admin.html',
      'device-security.html',
      'events-admin.html',
      'gemini-admin.html',
      'manager-access.html',
      'memphis-auth.js',
      'operational-insights.html',
      'phone-assignments.html',
    ],
  },
  viewer: {
    route: 'dashboard',
    marker: 'MZ_ROLE_VIEWER_ONLY',
    heading: 'Dashboard',
    navigation: ['Dashboard', 'Events', 'Feedback'],
  },
};

function outputPath(edition, file = '') {
  return resolve(repositoryRoot, outputRoot, edition, file);
}

test.beforeAll(() => {
  for (const edition of Object.keys(editions)) {
    if (!existsSync(outputPath(edition, 'app-shell.html'))) {
      throw new Error(`Missing ${edition} shell fixture. Run npm run build:batch-0b:browser-fixtures.`);
    }
  }
});

for (const [edition, expected] of Object.entries(editions)) {
  test(`${edition} shell renders only its role registry`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    if (edition === 'custodial') {
      await page.addInitScript(() => {
        localStorage.setItem('memphisAssignedDeviceId', 'KIOSK_04');
        localStorage.setItem('mz_scan_device_id', 'KIOSK_04');
      });
    }
    await page.goto(`/${outputRoot}/${edition}/app-shell.html?shell=stay#/${expected.route}`);
    const shell = page.locator('.shellFrame');
    await expect(shell).toHaveAttribute('data-edition', edition);
    await expect(shell).toHaveAttribute('data-role-marker', expected.marker);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(expected.heading);
    await expect(page.locator('.shellNavigation a')).toHaveCount(expected.navigation.length);
    if (expected.navigation.length) {
      await expect(page.locator('.shellNavigation a')).toHaveText(expected.navigation);
    }
    await expect(page.locator('body')).not.toContainText(/migration-safe|foundation|replacement is built/i);
    await expect(page.locator('iframe')).toHaveCount(0);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(
      accessibility.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact)),
    ).toEqual([]);

    const graph = JSON.parse(readFileSync(outputPath(edition, 'shell-edition-module-graph.json'), 'utf8'));
    expect(graph.edition).toBe(edition);
    expect(graph.role_marker).toBe(expected.marker);
    expect(graph.runtime.react.version).toBe('19.2.8');
    expect(graph.runtime.react_dom.version).toBe('19.2.8');
    expect(graph.runtime.react.package_root).toBe('node_modules/react');
    expect(graph.modules.some((module) => module.startsWith('mobile/node_modules/react/'))).toBe(false);
    for (const other of Object.keys(editions).filter((candidate) => candidate !== edition)) {
      expect(graph.modules.some((module) => module.includes(`/roles/${other}/`))).toBe(false);
    }
    for (const file of expected.prohibitedFiles ?? []) {
      expect(existsSync(outputPath(edition, file))).toBe(false);
    }
  });

  test(`${edition} shell stays inside safe areas, keyboard viewport, and 200% text`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/${outputRoot}/${edition}/app-shell.html?shell=proof#/${expected.route}`);
    await page.evaluate(() => {
      const root = document.documentElement;
      root.style.setProperty('--safe-area-inset-top', '24px');
      root.style.setProperty('--safe-area-inset-right', '9px');
      root.style.setProperty('--safe-area-inset-bottom', '28px');
      root.style.setProperty('--safe-area-inset-left', '7px');
      root.style.fontSize = '200%';
    });
    await expect(page.locator('.shellFrame')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.evaluate(() => {
      document.documentElement.style.setProperty('--mz-visual-viewport-height', '540px');
      document.documentElement.style.setProperty('--mz-keyboard-height', '260px');
      document.documentElement.dataset.keyboardOpen = 'true';
    });
    const geometry = await page.evaluate(() => {
      const frame = document.querySelector('.shellFrame').getBoundingClientRect();
      const navigation = document.querySelector('.shellNavigation').getBoundingClientRect();
      return {
        frameBottom: frame.bottom,
        navigationBottom: navigation.bottom,
        navigationLeft: navigation.left,
        navigationRight: navigation.right,
        viewportWidth: window.innerWidth,
      };
    });
    expect(geometry.frameBottom).toBeLessThanOrEqual(540.5);
    expect(geometry.navigationBottom).toBeLessThanOrEqual(540.5);
    expect(geometry.navigationLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.navigationRight).toBeLessThanOrEqual(geometry.viewportWidth);

    if (expected.navigation.length > 1) {
      const detail = expected.navigation[1];
      await page.getByRole('link', { name: detail, exact: true }).click();
      const back = page.getByRole('button', { name: 'Back', exact: true });
      const box = await back.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.round(box.width)).toBe(116);
      expect(Math.round(box.height)).toBe(52);
    } else {
      await expect(page.locator('.shellNavigation a')).toHaveCount(0);
    }
  });
}

test('Custodial compatibility handoff uses the enrolled phone and no iframe', async ({ page }) => {
  await page.addInitScript(({ deviceId, credential, seal }) => {
    const installationRecord = JSON.stringify({
      schema_version: 1,
      credential,
      device_id: deviceId,
      installation_seal: seal,
      enrolled_at: '2026-08-01T00:00:00.000Z',
      migrated_from_credential_only_state: false,
    });
    // SecureStorageWeb stores the JSON representation of each protected value
    // below its plugin prefix. This mirrors SecureStorage.set(recordKey, value)
    // instead of teaching production code to trust an unprotected device ID.
    localStorage.setItem(
      'capacitor-storage_memphis_zoo_custodial_installation_record_v1',
      JSON.stringify(installationRecord),
    );
    for (const key of ['memphisAssignedDeviceId', 'mz_scan_device_id', 'mz_employee_hub_device_id']) {
      localStorage.setItem(key, deviceId);
    }
    localStorage.setItem('memphisZooCustodialInstallationSeal', seal);
  }, {
    deviceId: 'KIOSK_04',
    credential: 'shell-seam-protected-device-credential',
    seal: 'shell-seam-installation-seal',
  });
  await page.goto(`/${outputRoot}/custodial/app-shell.html?shell=stay#/messages`);
  await Promise.all([
    page.waitForURL(/messages\.html\?hub=employee&device=KIOSK_04$/),
    page.getByTestId('legacy-handoff').click(),
  ]);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('fresh Custodial shell cannot hand an unenrolled phone to a protected legacy page', async ({ page }) => {
  await page.goto(`/${outputRoot}/custodial/app-shell.html?shell=stay#/messages`);
  await expect(page.getByTestId('legacy-handoff')).toHaveText('Open phone setup');
  await Promise.all([
    page.waitForURL(/\/custodial\/index\.html$/),
    page.getByTestId('legacy-handoff').click(),
  ]);
  expect(page.url()).not.toMatch(/messages\.html/);
});

test('fresh Custodial compatibility deep link returns to enrollment before protected traffic', async ({ page }) => {
  let protectedRequests = 0;
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    protectedRequests += 1;
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' });
  });
  await page.goto(`/${outputRoot}/custodial/messages.html?hub=employee`);
  await page.waitForURL(/\/custodial\/index\.html(?:\?.*)?$/);
  expect(protectedRequests).toBe(0);
});

test('Custodial protected transport fails closed after cross-realm Web Storage tamper', async ({ page }) => {
  let tamperProbeRequests = 0;
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('tamper_probe') === '1') tamperProbeRequests += 1;
    const data = url.pathname === '/device-auth/status'
      ? {
          authenticated: true,
          canonical_device_id: 'KIOSK_04',
          device_id: 'KIOSK_04',
          employee_name: 'Protected Test Employee',
        }
      : (url.pathname === '/schedule-api/my-day-summary' ? { groups: [] } : {});
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data }),
    });
  });
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
    deviceId: 'KIOSK_04',
    credential: 'cross-realm-protected-device-credential',
    seal: 'cross-realm-installation-seal',
  });

  await page.goto(`/${outputRoot}/custodial/index.html`);
  await expect.poll(() => page.evaluate(() => ({
    state: window.MemphisCustodialSecurity?.getStatus?.().state,
    ready: window.MemphisCustodialSecurity?.getStatus?.().ready,
    deviceId: window.MemphisMobile?.deviceId?.(),
  }))).toEqual({ state: 'enrolled', ready: true, deviceId: 'KIOSK_04' });

  const bypass = await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.hidden = true;
    document.body.append(iframe);
    const foreignWindow = iframe.contentWindow;
    foreignWindow.Storage.prototype.setItem.call(
      foreignWindow.localStorage,
      'memphisAssignedDeviceId',
      'KIOSK_02',
    );
    foreignWindow.localStorage.mz_scan_device_id = 'KIOSK_02';
    const descriptor = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');
    const result = {
      primary: localStorage.getItem('memphisAssignedDeviceId'),
      secondary: localStorage.getItem('mz_scan_device_id'),
      parentWrapperConfigurable: descriptor?.configurable,
      parentWrapperWritable: descriptor?.writable,
    };
    iframe.remove();
    return result;
  });
  expect(bypass).toEqual({
    primary: 'KIOSK_02',
    secondary: 'KIOSK_02',
    parentWrapperConfigurable: false,
    parentWrapperWritable: false,
  });

  const rejected = await page.evaluate(async () => {
    try {
      await window.MemphisMobile.requestEnvelope('/device-auth/status?tamper_probe=1');
      return { rejected: false };
    } catch (error) {
      return {
        rejected: true,
        code: String(error?.code || ''),
        status: window.MemphisMobile.securityStatus(),
      };
    }
  });
  expect(rejected.rejected).toBe(true);
  expect(rejected.code).toBe('custodial_security_state_unavailable');
  expect(rejected.status).toMatchObject({
    state: 'unavailable',
    ready: false,
    available: false,
    deviceId: '',
  });
  expect(tamperProbeRequests).toBe(0);

  const reconciled = await page.evaluate(async () => {
    try { await window.MemphisCustodialSecurity.ensureSecurityState(); } catch {}
    return window.MemphisCustodialSecurity.getStatus();
  });
  expect(reconciled).toMatchObject({
    state: 'quarantined',
    ready: false,
    quarantined: true,
    reason: 'device_identity_binding_incomplete',
    deviceId: '',
  });
});

test('default shell entry immediately preserves the current edition launcher', async ({ page }) => {
  await page.goto(`/${outputRoot}/manager/app-shell.html`);
  await page.waitForURL(/\/manager\/index\.html$/);
});

test('an explicit incoming shell hash is preserved before HashRouter initializes', async ({ page }) => {
  await page.goto(`/${outputRoot}/manager/app-shell.html#/messages`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Messages');
  expect(page.url()).toMatch(/app-shell\.html#\/messages$/);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today');
  expect(page.url()).toMatch(/app-shell\.html#\/today$/);
});

test('Viewer compatibility handoff activates the requested legacy panel', async ({ page }) => {
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const events = route.request().url().includes('/viewer-api/events');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: events ? { events: [] } : {} }),
    });
  });
  for (const panel of ['events', 'feedback']) {
    await page.goto(`/${outputRoot}/viewer/app-shell.html?shell=stay#/${panel}`);
    await Promise.all([
      page.waitForURL(new RegExp(`/viewer/index\\.html#${panel}$`)),
      page.getByTestId('legacy-handoff').click(),
    ]);
    await expect(page.locator(`#${panel}`)).toHaveClass(/active/);
    await expect(page.locator(`[data-tab="${panel}"]`)).toHaveClass(/primary/);
  }
});
