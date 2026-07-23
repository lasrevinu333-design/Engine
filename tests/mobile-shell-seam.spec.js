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
    route: 'today',
    marker: 'MZ_ROLE_CUSTODIAL_ONLY',
    heading: 'Today',
    navigation: ['Today', 'Messages', 'Schedule', 'Report'],
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
    await expect(page.locator('.shellNavigation a')).toHaveText(expected.navigation);
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

    const detail = expected.navigation[1];
    await page.getByRole('link', { name: detail, exact: true }).click();
    const back = page.getByRole('button', { name: 'Back', exact: true });
    const box = await back.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box.width)).toBe(116);
    expect(Math.round(box.height)).toBe(52);
  });
}

test('Custodial compatibility handoff uses the enrolled phone and no iframe', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('memphisAssignedDeviceId', 'KIOSK_04');
    localStorage.setItem('mz_scan_device_id', 'KIOSK_04');
  });
  await page.goto(`/${outputRoot}/custodial/app-shell.html?shell=stay#/messages`);
  await Promise.all([
    page.waitForURL(/messages\.html\?hub=employee&device=KIOSK_04$/),
    page.getByTestId('legacy-handoff').click(),
  ]);
  await expect(page.locator('iframe')).toHaveCount(0);
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
