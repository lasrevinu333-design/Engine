#!/usr/bin/env node

import { chromium } from '@playwright/test';
import { createReadStream, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const sourceRoot = resolve(process.env.AUDIT_SOURCE_ROOT || new URL('..', import.meta.url).pathname);
const outputRoot = resolve(process.env.AUDIT_OUTPUT_DIR || './ui-audit-output');
const liveBase = String(process.env.AUDIT_LIVE_BASE_URL || '').replace(/\/$/, '');
const mockBackend = /^(1|true|yes)$/i.test(String(process.env.AUDIT_MOCK_BACKEND || ''));
const label = String(process.env.AUDIT_LABEL || (liveBase ? 'live' : 'local'));
const settleMs = Number(process.env.AUDIT_SETTLE_MS || 350);

const pageFilter = String(process.env.AUDIT_PAGE_FILTER || '').trim();
const pages = [
  ['admin', 'admin.html'],
  ['coverall-print', 'coverall-print.html'],
  ['dashboard', 'dashboard.html'],
  ['device-security', 'device-security.html'],
  ['employee-hub', 'employee-hub.html?device=KIOSK_02&lock=0'],
  ['employee-schedule', 'employee-schedule.html?device=KIOSK_02&hub=employee'],
  ['events-admin', 'events-admin.html'],
  ['events', 'events.html?hub=manager'],
  ['gemini-admin', 'gemini-admin.html'],
  ['guest-issues', 'guest-issues.html'],
  ['guest-qr', 'guest-qr.html'],
  ['guest-report', 'guest-report.html'],
  ['manager-access', 'manager-access.html'],
  ['messages', 'messages.html?hub=manager'],
  ['ops-manager-hub', 'ops-manager-hub.html'],
  ['scan', 'index.html'],
  ['schedule-employee-day', 'schedule-employee-day.html'],
  ['schedule-simple', 'schedule-simple.html'],
  ['schedule', 'schedule.html'],
  ['start-page', 'start_page1.html?lock=0'],
  ['system-feedback', 'system-feedback.html?hub=manager'],
  ['thread', 'thread.html?hub=manager&thread_id=00000000-0000-4000-8000-000000000903'],
  ['not-found', '404.html'],
].filter(([name]) => !pageFilter || name === pageFilter);

const viewports = [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 667 }],
];

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.wav', 'audio/wav'],
]);

let server;
let baseUrl = liveBase;
if (!baseUrl) {
  server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://local').pathname);
    const candidate = resolve(sourceRoot, `.${pathname === '/' ? '/start_page1.html' : pathname}`);
    if (candidate !== sourceRoot && !candidate.startsWith(`${sourceRoot}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    try {
      if (!statSync(candidate).isFile()) throw new Error('not a file');
      response.writeHead(200, { 'Content-Type': types.get(extname(candidate)) || 'application/octet-stream', 'Cache-Control': 'no-store' });
      createReadStream(candidate).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    }
  });
  await new Promise((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

function managerSession() {
  return {
    ok: true,
    data: {
      session: {
        token: 'nonsecret-ui-audit-token',
        role: 'ops_manager',
        roles: ['CUSTODIAL_MANAGER', 'SECURITY_ADMIN'],
        manager_id: '00000000-0000-4000-8000-000000000901',
        credential_id: '00000000-0000-4000-8000-000000000902',
        device_id: 'ui-audit-browser',
        access_level: 'full_access',
        trusted_device: true,
        expires_at: '2036-07-18T00:00:00.000Z',
      },
      trusted_device: { credential_id: '00000000-0000-4000-8000-000000000902', device_id: 'ui-audit-browser' },
    },
  };
}

async function installMocks(context) {
  if (!mockBackend) return;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth-api/session') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(managerSession()) });
      return;
    }
    if (url.pathname === '/version') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: 'release-2026.07.18.custodial-v3.11' }) });
      return;
    }
    const payload = request.method() === 'GET' ? { ok: true, data: [], meta: { next_cursor: null } } : { ok: true, data: {} };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await context.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: {}, daily: {}, hourly: {} }) }));
  await context.route('https://unpkg.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.docx={};' }));
}

mkdirSync(outputRoot, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const allResults = [];

try {
  for (const [viewportName, viewport] of viewports) {
    const imageDir = resolve(outputRoot, viewportName);
    mkdirSync(imageDir, { recursive: true });
    for (const [name, pagePath] of pages) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
      await installMocks(context);
      const page = await context.newPage();
      const consoleErrors = [];
      const failedRequests = [];
      const abortedRequests = [];
      const responses = [];
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('requestfailed', (request) => {
        const item = { url: request.url(), error: request.failure()?.errorText || 'failed' };
        if (item.error === 'net::ERR_ABORTED') abortedRequests.push(item);
        else failedRequests.push(item);
      });
      page.on('response', (response) => responses.push({ url: response.url(), status: response.status(), type: response.request().resourceType() }));

      const requestedUrl = `${baseUrl}/${pagePath}`;
      const coldStart = performance.now();
      let navigationError = '';
      try { await page.goto(requestedUrl, { waitUntil: 'load', timeout: 20_000 }); } catch (error) { navigationError = String(error?.message || error); }
      await page.waitForTimeout(settleMs);
      const coldElapsedMs = performance.now() - coldStart;
      const warmStart = performance.now();
      try { await page.reload({ waitUntil: 'load', timeout: 20_000 }); } catch (error) { navigationError ||= String(error?.message || error); }
      await page.waitForTimeout(settleMs);
      const warmElapsedMs = performance.now() - warmStart;

      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const resources = performance.getEntriesByType('resource');
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        const unlabeledControlElements = Array.from(document.querySelectorAll('button,a,input,select,textarea')).filter((element) => {
          if (element.matches('[type="hidden"],[hidden],[aria-hidden="true"]')) return false;
          const id = element.id;
          const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
          const implicitLabel = element.closest('label');
          return !String(element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || element.getAttribute('alt') || element.getAttribute('placeholder') || '').trim() && !label && !implicitLabel;
        });
        return {
          dom_content_loaded_ms: nav?.domContentLoadedEventEnd || 0,
          load_ms: nav?.loadEventEnd || 0,
          first_contentful_paint_ms: fcp?.startTime || 0,
          transfer_bytes: resources.reduce((sum, entry) => sum + Number(entry.transferSize || 0), 0),
          resource_count: resources.length,
          failed_resource_entries: resources.filter((entry) => Number(entry.responseStatus || 200) >= 400).length,
          scroll_width: document.documentElement.scrollWidth,
          client_width: document.documentElement.clientWidth,
          scroll_height: document.documentElement.scrollHeight,
          client_height: document.documentElement.clientHeight,
          headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((heading) => Number(heading.tagName.slice(1))),
          images_missing_alt: document.querySelectorAll('img:not([alt])').length,
          unlabeled_controls: unlabeledControlElements.length,
          unlabeled_control_details: unlabeledControlElements.map((element) => ({ tag: element.tagName.toLowerCase(), id: element.id || '', class: element.className || '', type: element.getAttribute('type') || '' })),
          canonical_back_controls: document.querySelectorAll('[data-mz-back]').length,
          title: document.title,
        };
      }).catch((error) => ({ capture_error: String(error?.message || error) }));

      await page.screenshot({ path: resolve(imageDir, `${name}.png`), fullPage: true });
      allResults.push({
        label,
        viewport: viewportName,
        name,
        requested_url: requestedUrl,
        final_url: page.url(),
        cold_elapsed_ms: Math.round(coldElapsedMs),
        warm_elapsed_ms: Math.round(warmElapsedMs),
        navigation_error: navigationError,
        console_errors: consoleErrors,
        failed_requests: failedRequests,
        aborted_requests: abortedRequests,
        response_count: responses.length,
        responses,
        metrics,
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
}

const resultPath = resolve(outputRoot, `${label}-ui-audit.json`);
writeFileSync(resultPath, `${JSON.stringify(allResults, null, 2)}\n`);
const medians = (values) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};
const summary = Object.fromEntries(viewports.map(([viewportName]) => {
  const rows = allResults.filter((row) => row.viewport === viewportName);
  return [viewportName, {
    pages: rows.length,
    median_cold_elapsed_ms: medians(rows.map((row) => row.cold_elapsed_ms)),
    median_warm_elapsed_ms: medians(rows.map((row) => row.warm_elapsed_ms)),
    median_transfer_bytes: medians(rows.map((row) => row.metrics.transfer_bytes || 0)),
    console_error_pages: rows.filter((row) => row.console_errors.length).length,
    failed_request_pages: rows.filter((row) => row.failed_requests.length).length,
    horizontal_overflow_pages: rows.filter((row) => (row.metrics.scroll_width || 0) > (row.metrics.client_width || 0) + 2).length,
    missing_alt_total: rows.reduce((sum, row) => sum + Number(row.metrics.images_missing_alt || 0), 0),
    unlabeled_controls_total: rows.reduce((sum, row) => sum + Number(row.metrics.unlabeled_controls || 0), 0),
  }];
}));
writeFileSync(resolve(outputRoot, `${label}-summary.json`), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, source_root: sourceRoot, base_url: baseUrl, output_root: outputRoot, result_path: resultPath, summary }, null, 2));
