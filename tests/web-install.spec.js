const { test, expect, chromium } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { createReadStream, statSync } = require('node:fs');
const { cp, mkdtemp, rm } = require('node:fs/promises');
const { createServer } = require('node:http');
const { extname, resolve, sep } = require('node:path');
const { tmpdir } = require('node:os');

const repoRoot = resolve(__dirname, '..');
const mobileDist = resolve(repoRoot, 'mobile/mobile-dist');
const providedProofRoot = String(process.env.MZ_WEB_INSTALL_PROOF_ROOT || '').trim();
const editions = {
  manager: {
    name: 'Memphis Zoo Custodial Manager',
    cachePrefix: 'memphis-zoo-custodial-manager-shell-',
    offlineText: 'Your manager access and current operational information cannot be verified right now.',
  },
  viewer: {
    name: 'Memphis Zoo Custodial Viewer',
    cachePrefix: 'memphis-zoo-custodial-viewer-shell-',
    offlineText: 'The current dashboard and event information cannot be verified right now.',
  },
};

let proofRoot = providedProofRoot ? resolve(providedProofRoot) : '';
let removeProofRoot = false;
let server;
let baseUrl;
let browser;

function buildEdition(edition, destination) {
  execFileSync('npm', ['run', `build:${edition}`], {
    cwd: repoRoot,
    env: { ...process.env, FORCE_COLOR: '0' },
    stdio: 'pipe',
  });
  return cp(mobileDist, destination, { recursive: true });
}

function startStaticServer(root) {
  const types = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.wav', 'audio/wav'],
    ['.webmanifest', 'application/manifest+json'],
    ['.webp', 'image/webp'],
  ]);
  const instance = createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const candidate = resolve(root, `.${pathname}`);
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    try {
      if (!statSync(candidate).isFile()) throw new Error('not a file');
      response.writeHead(200, {
        'Content-Type': types.get(extname(candidate)) || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      createReadStream(candidate).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('Not found');
    }
  });
  return instance;
}

test.beforeAll(async () => {
  if (!proofRoot) {
    proofRoot = await mkdtemp(resolve(tmpdir(), 'mz-web-install-proof-'));
    removeProofRoot = true;
    for (const edition of Object.keys(editions)) {
      await buildEdition(edition, resolve(proofRoot, edition));
    }
  }
  for (const edition of Object.keys(editions)) {
    expect(statSync(resolve(proofRoot, edition, 'index.html')).isFile()).toBe(true);
  }
  server = startStaticServer(proofRoot);
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});

test.afterAll(async () => {
  await browser?.close();
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  if (removeProofRoot) await rm(proofRoot, { recursive: true, force: true });
});

for (const [edition, expected] of Object.entries(editions)) {
  test(`${edition} web app installs an isolated exact-source shell and fails closed offline`, async () => {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/auth-api/session') {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Enrollment required' }) });
        return;
      }
      const data = path === '/viewer-api/events'
        ? { events: [], generated_at: '2026-08-25T12:00:00.000Z' }
        : { generated_at: '2026-08-25T12:00:00.000Z' };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/${edition}/`);

    const registration = await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready;
      return { scope: ready.scope, script: ready.active?.scriptURL || '' };
    });
    expect(registration.scope).toBe(`${baseUrl}/${edition}/`);
    expect(registration.script).toBe(`${baseUrl}/${edition}/service-worker.js`);
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '')).toBe(registration.script);

    const client = await context.newCDPSession(page);
    const appManifest = await client.send('Page.getAppManifest');
    expect(appManifest.errors || []).toEqual([]);
    const manifest = JSON.parse(appManifest.data);
    expect(manifest.name).toBe(expected.name);
    expect(manifest.id).toBe(`/${edition}/`);
    expect(manifest.start_url).toBe(`/${edition}/`);
    expect(manifest.scope).toBe(`/${edition}/`);
    expect(manifest.display).toBe('standalone');

    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const entries = [];
      for (const key of keys) {
        for (const request of await (await caches.open(key)).keys()) entries.push(request.url);
      }
      return { keys, entries };
    });
    expect(cached.keys.filter((key) => key.startsWith(expected.cachePrefix))).toHaveLength(1);
    expect(cached.keys.some((key) => Object.values(editions).some(({ cachePrefix }) => cachePrefix !== expected.cachePrefix && key.startsWith(cachePrefix)))).toBe(false);
    expect(cached.entries).toContain(`${baseUrl}/${edition}/offline.html`);

    await page.evaluate(async () => {
      await fetch('./probe-api/health', { headers: { Authorization: 'Bearer browser-proof' } }).catch(() => null);
    });
    const afterSensitiveRequest = await page.evaluate(async () => {
      const entries = [];
      for (const key of await caches.keys()) {
        for (const request of await (await caches.open(key)).keys()) entries.push(request.url);
      }
      return entries;
    });
    expect(afterSensitiveRequest.some((url) => url.includes('/probe-api/'))).toBe(false);

    await context.setOffline(true);
    await page.goto(`${baseUrl}/${edition}/`);
    await expect(page.locator('h1')).toHaveText('No connection');
    await expect(page.locator('main')).toContainText(expected.offlineText);
    await context.close();
  });
}
