const {currentLeadershipSession}=require('./helpers/current-leadership-session.cjs');
const { test, expect } = require('./helpers/isolated-browser-test.cjs');

const OUTPUT = '/build/batch-0b-shell-browser/manager/index.html';

function sessionEnvelope(){return currentLeadershipSession({displayName:'Operations Manager',deviceId:'manager-home-browser'});}

async function fulfill(route, data, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status >= 400 ? { ok: false, error: 'Unavailable' } : { ok: true, data }),
  });
}

function summary(overdue, dueSoon, inProgress, openProblems, snapshotAt = new Date().toISOString()) {
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
    if(path==='/admin-api/custodial/open-problems')return fulfill(route,{schema:'custodial.open-problems.v1',generated_at:new Date().toISOString(),total:4,items:[]});
    if (path === '/custodial-leadership-api/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionEnvelope()) });
    if (path === '/dashboard-api/summary') return fulfill(route, summary(3, 0, 2, 4));
    if (path === '/dashboard-api/current-attendance') return fulfill(route, {
      attendance: 0,
      planned: 1250,
      stale: false,
      source_timestamp: new Date().toISOString(),
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
  await expect(page.locator('#today-guest-meta')).toContainText('Cumulative guest entries');
  await expect(page.locator('#today-guest-meta')).toContainText('Planned 1,250');
  await expect(page.locator('#today-source')).toContainText('Operational snapshot');
  await expect(page.locator('a[href="./dashboard.html#overdue"]')).toHaveCount(1);
  await expect(page.locator('a[href="./dashboard.html#due-soon"]')).toHaveCount(1);
  await expect(page.locator('a[href="./dashboard.html#being-cleaned"]')).toHaveCount(1);
  await expect(page.locator('a[href="./dashboard.html#tickets-section"]')).toHaveCount(1);
});

test('summary failure cannot hide a stale but available guest gate feed', async ({ page }) => {
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if(path==='/admin-api/custodial/open-problems')return fulfill(route,null,503);
    if (path === '/custodial-leadership-api/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionEnvelope()) });
    if (path === '/dashboard-api/summary') return fulfill(route, null, 503);
    if (path === '/dashboard-api/current-attendance') return fulfill(route, {
      attendance: 17,
      planned: null,
      stale: true,
      source_timestamp: new Date().toISOString(),
    });
    return fulfill(route, {});
  });

  await page.goto(OUTPUT);
  await expect(page.locator('#today-overdue')).toHaveText('Unavailable');
  await expect(page.locator('#today-open-problems')).toHaveText('Unavailable');
  await expect(page.locator('#today-source')).toHaveText('Operational summary unavailable.');
  await expect(page.locator('#today-guest-count')).toHaveText('17');
  await expect(page.locator('#today-guest-count')).toHaveAttribute('data-state', 'stale');
  await expect(page.locator('#today-guest-meta')).toContainText('Last update');
});

test('attendance failure cannot hide current operational counts and missing fields never become zero', async ({ page }) => {
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if(path==='/admin-api/custodial/open-problems')return fulfill(route,{schema:'custodial.open-problems.v1',generated_at:new Date().toISOString(),total:1,items:[]});
    if (path === '/custodial-leadership-api/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionEnvelope()) });
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
    if(path==='/admin-api/custodial/open-problems')return fulfill(route,{schema:'custodial.open-problems.v1',generated_at:new Date().toISOString(),total:0,items:[]});
    if (path === '/custodial-leadership-api/session') {
      authCalls += 1;

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionEnvelope()) });
    }
    if (path === '/dashboard-api/summary') {
      summaryCalls += 1;
      const count=summaryCalls===3?9:1;
      if(summaryCalls===2)await olderGate;
      return fulfill(route, summary(count, 0, 0, 0));
    }
    if (path === '/dashboard-api/current-attendance') return fulfill(route, { attendance: 5, stale: false, source_timestamp: new Date().toISOString() });
    return fulfill(route, {});
  });

  await page.goto(OUTPUT);
  await expect(page.locator('#today-overdue')).toHaveText('1');
  await page.evaluate(() => {
    document.getElementById('refresh').click();
  });
  await expect.poll(()=>summaryCalls).toBe(2);
  await page.locator('#refresh').click();
  await expect(page.locator('#today-overdue')).toHaveText('9');
  releaseOlder();
  await page.waitForTimeout(150);
  await expect(page.locator('#today-overdue')).toHaveText('9');
  expect(summaryCalls).toBe(3);
});
