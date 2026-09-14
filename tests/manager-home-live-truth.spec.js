const { test, expect } = require('@playwright/test');

const OUTPUT = '/build/batch-0b-shell-browser/manager/index.html';

function sessionEnvelope() {
  return {
    ok: true,
    data: {
      session: {
        token: 'manager-home-session',
        manager_id: '00000000-0000-4000-8000-000000000001',
        manager_display_name: 'Operations Manager',
        roles: ['CUSTODIAL_MANAGER'],
        device_id: 'manager-home-browser',
        expires_at: '2036-09-14T00:00:00.000Z',
      },
      manager: { display_name: 'Operations Manager', job_title: 'Operations Leadership' },
    },
  };
}

async function fulfill(route, data, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status >= 400 ? { ok: false, error: 'Unavailable' } : { ok: true, data }),
  });
}

function summary(overdue, dueSoon, inProgress, openProblems, snapshotAt = '2026-09-14T14:15:00.000Z') {
  return { snapshot: {
    overdue_locations: overdue,
    due_soon_locations: dueSoon,
    in_progress_locations: inProgress,
    open_ticket_count: openProblems,
    snapshot_at: snapshotAt,
  } };
}

test('actual manager Home renders live Today counts, exact zeros, attendance provenance, and preserved drilldowns', async ({ page }) => {
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth-api/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionEnvelope()) });
    if (path === '/dashboard-api/summary') return fulfill(route, summary(3, 0, 2, 4));
    if (path === '/dashboard-api/current-attendance') return fulfill(route, {
      attendance: 0,
      planned: 1250,
      stale: false,
      source_timestamp: '2026-09-14T14:10:00.000Z',
    });
    return fulfill(route, {});
  });

  await page.goto(OUTPUT);
  await expect(page.locator('#hub')).toBeVisible();
  await expect(page.locator('#today-overdue')).toHaveText('3');
  await expect(page.locator('#today-due-soon')).toHaveText('0');
  await expect(page.locator('#today-in-progress')).toHaveText('2');
  await expect(page.locator('#today-open-problems')).toHaveText('4');
  await expect(page.locator('#today-guest-count')).toHaveText('0');
  await expect(page.locator('#today-guest-meta')).toContainText('Gate feed');
  await expect(page.locator('#today-guest-meta')).toContainText('planned 1250');
  await expect(page.locator('#today-source')).toContainText('Operational snapshot');
  await expect(page.locator('a[href="./dashboard.html#overdue"]')).toHaveCount(1);
  await expect(page.locator('a[href="./dashboard.html#due-soon"]')).toHaveCount(1);
  await expect(page.locator('a[href="./dashboard.html#being-cleaned"]')).toHaveCount(1);
  await expect(page.locator('a[href="./dashboard.html#tickets-section"]')).toHaveCount(2);
});

test('summary failure cannot hide a stale but available guest gate feed', async ({ page }) => {
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth-api/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionEnvelope()) });
    if (path === '/dashboard-api/summary') return fulfill(route, null, 503);
    if (path === '/dashboard-api/current-attendance') return fulfill(route, {
      attendance: 17,
      planned: null,
      stale: true,
      source_timestamp: '2026-09-14T12:00:00.000Z',
    });
    return fulfill(route, {});
  });

  await page.goto(OUTPUT);
  await expect(page.locator('#today-overdue')).toHaveText('Unavailable');
  await expect(page.locator('#today-open-problems')).toHaveText('Unavailable');
  await expect(page.locator('#today-source')).toHaveText('Operational summary unavailable.');
  await expect(page.locator('#today-guest-count')).toHaveText('17');
  await expect(page.locator('#today-guest-count')).toHaveAttribute('data-state', 'stale');
  await expect(page.locator('#today-guest-meta')).toContainText('Stale gate feed');
});

test('attendance failure cannot hide current operational counts and missing fields never become zero', async ({ page }) => {
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth-api/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionEnvelope()) });
    if (path === '/dashboard-api/summary') return fulfill(route, summary('8', null, 'bad', 1));
    if (path === '/dashboard-api/current-attendance') return fulfill(route, null, 502);
    return fulfill(route, {});
  });

  await page.goto(OUTPUT);
  await expect(page.locator('#today-overdue')).toHaveText('8');
  await expect(page.locator('#today-due-soon')).toHaveText('Unavailable');
  await expect(page.locator('#today-in-progress')).toHaveText('Unavailable');
  await expect(page.locator('#today-open-problems')).toHaveText('1');
  await expect(page.locator('#today-guest-count')).toHaveText('Unavailable');
  await expect(page.locator('#today-guest-meta')).toHaveText('Gate feed unavailable.');
});

test('a slower older refresh cannot overwrite the newest manager snapshot', async ({ page }) => {
  let authCalls = 0;
  let summaryCalls = 0;
  let releaseOlder;
  const olderGate = new Promise((resolve) => { releaseOlder = resolve; });
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth-api/session') {
      authCalls += 1;
      if (authCalls === 2) await olderGate;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionEnvelope()) });
    }
    if (path === '/dashboard-api/summary') {
      summaryCalls += 1;
      return fulfill(route, summary(summaryCalls === 1 ? 1 : 9, 0, 0, 0));
    }
    if (path === '/dashboard-api/current-attendance') return fulfill(route, { attendance: 5, stale: false, source_timestamp: '2026-09-14T14:10:00.000Z' });
    return fulfill(route, {});
  });

  await page.goto(OUTPUT);
  await expect(page.locator('#today-overdue')).toHaveText('1');
  await page.evaluate(() => {
    document.getElementById('refresh').click();
    document.getElementById('refresh').click();
  });
  await expect(page.locator('#today-overdue')).toHaveText('9');
  releaseOlder();
  await page.waitForTimeout(150);
  await expect(page.locator('#today-overdue')).toHaveText('9');
  expect(summaryCalls).toBe(2);
});
