const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const backendOrigin = 'https://memphis-zoo-mcp.onrender.com';
const frontendOrigin = 'https://lasrevinu333-design.github.io';
const frontendBase = `${frontendOrigin}/Engine`;
const validCode = '24681357';
const invalidCode = '11111111';
const expiredCode = '22222222';
const managerId = '00000000-0000-4000-8000-000000000002';
const managerName = 'Brandy Gull';
const cookieSecret = 'browser-cookie-secret-never-returned-to-js';
const cookieName = 'memphis_ops_trust';
const sessionToken = 'short-session-token-memory-only';
const credentialId = '00000000-0000-4000-8000-000000000044';
const deviceLabelDraftKey = 'memphisOpsManagerDeviceLabelDraft.v1';
const genericCodeError = 'That personal enrollment code is invalid, expired, or already used.';

function sessionPayload(deviceId, deviceLabel) {
  return {
    ok: true,
    data: {
      session: {
        token: sessionToken,
        role: 'ops_manager',
        roles: ['OPS_MANAGER', 'CUSTODIAL_MANAGER'],
        manager_id: managerId,
        manager_display_name: managerName,
        device_id: deviceId,
        credential_id: credentialId,
        access_level: 'full_access',
        read_only: false,
        trusted_device: true,
        expires_at: '2036-08-02T00:00:00.000Z'
      },
      manager: {
        manager_id: managerId,
        display_name: managerName,
        job_title: 'Horticulture Manager',
        roles: ['OPS_MANAGER', 'CUSTODIAL_MANAGER']
      },
      trusted_device: {
        credential_id: credentialId,
        device_id: deviceId,
        device_label: deviceLabel,
        expires_at: '2036-08-02T00:00:00.000Z',
        max_access_level: 'full_access',
        manager_id: managerId
      }
    }
  };
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type,x-device-id',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-max-age': '600',
    vary: 'Origin'
  };
}

async function installPublishedFrontendFixture(context) {
  const root = path.resolve(__dirname, '..');
  const mimeTypes = {
    '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav'
  };
  await context.route(`${frontendBase}/**`, async (route) => {
    const url = new URL(route.request().url());
    const relative = decodeURIComponent(url.pathname.slice('/Engine/'.length)) || 'index.html';
    const file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) return route.fulfill({ status: 400, body: 'Invalid path.' });
    try {
      return route.fulfill({ status: 200, contentType: mimeTypes[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    } catch (error) {
      if (error?.code === 'ENOENT') return route.fulfill({ status: 404, body: 'Not found.' });
      throw error;
    }
  });
}

async function installNamedEnrollmentBackend(context) {
  const audit = {
    consumeBodies: [],
    consumeOrigins: [],
    deniedOrigins: [],
    legacyRequests: 0,
    requestedPaths: [],
    sessionCookieHeaders: [],
    enrollmentFailures: []
  };
  let enrolled = null;
  await installPublishedFrontendFixture(context);

  await context.route(`${backendOrigin}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const headers = request.headers();
    const origin = String(headers.origin || '');
    audit.requestedPaths.push(`${method} ${url.pathname}`);

    const json = async (status, body, extraHeaders = {}) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { ...(origin === frontendOrigin ? corsHeaders(origin) : {}), ...extraHeaders },
      body: JSON.stringify(body)
    });

    if (method === 'OPTIONS') {
      if (origin !== frontendOrigin) {
        audit.deniedOrigins.push(origin || '<missing>');
        return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Origin denied.' }) });
      }
      return route.fulfill({ status: 204, headers: corsHeaders(origin), body: '' });
    }

    if (url.pathname === '/auth-api/ops/manager-codes/consume') {
      audit.legacyRequests += 1;
      return json(410, { ok: false, error: 'This enrollment route is retired.' });
    }

    if (url.pathname === '/leadership-api/enrollment/consume' && method === 'POST') {
      audit.consumeOrigins.push(origin || '<missing>');
      if (origin !== frontendOrigin) {
        audit.deniedOrigins.push(origin || '<missing>');
        return json(403, { ok: false, error: 'Origin denied.' });
      }
      const body = request.postDataJSON();
      audit.consumeBodies.push(body);
      if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(['code', 'device_id', 'device_label'])) {
        return json(400, { ok: false, error: 'Malformed enrollment request.' });
      }
      if ([invalidCode, expiredCode].includes(String(body.code))) {
        audit.enrollmentFailures.push({ code: String(body.code), status: 401, error: genericCodeError });
        return json(401, { ok: false, error: genericCodeError });
      }
      if (String(body.code) !== validCode || !body.device_id || !body.device_label) {
        audit.enrollmentFailures.push({ code: String(body.code || ''), status: 401, error: genericCodeError });
        return json(401, { ok: false, error: genericCodeError });
      }
      enrolled = { deviceId: String(body.device_id), deviceLabel: String(body.device_label) };
      return json(200, sessionPayload(enrolled.deviceId, enrolled.deviceLabel), {
        'set-cookie': `${cookieName}=${credentialId}.${cookieSecret}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=None`
      });
    }

    if (url.pathname === '/auth-api/session' && method === 'GET') {
      const cookie = String(headers.cookie || '');
      audit.sessionCookieHeaders.push(cookie);
      if (!enrolled || !cookie.includes(`${cookieName}=${credentialId}.${cookieSecret}`)) {
        return json(401, { ok: false, error: 'Enrollment required.' });
      }
      return json(200, sessionPayload(enrolled.deviceId, enrolled.deviceLabel));
    }

    return json(200, { ok: true, data: {} });
  });

  return { audit, enrolled: () => enrolled };
}

async function openEnrollment(page) {
  await page.goto(`${frontendBase}/start_page1.html`);
  await expect(page).toHaveURL(/\/ops-manager-hub\.html/);
  await expect(page.getByRole('heading', { name: 'Operations Leadership Hub' })).toBeVisible();
  await expect(page.getByText('This browser is not enrolled. Enter the personal code created for your leadership account.')).toBeVisible();
}

test('personal code binds a stable browser installation to one named manager and reloads from its HttpOnly cookie', async ({ browser }) => {
  const context = await browser.newContext();
  const backend = await installNamedEnrollmentBackend(context);
  const page = await context.newPage();
  await openEnrollment(page);

  const stableDeviceId = await page.evaluate(() => window.MemphisAuth.getDeviceId());
  expect(stableDeviceId).toMatch(/^manager-browser-[a-z0-9-]+$/);
  const deviceLabel = 'Brandy Work Desktop';
  await page.getByLabel('Browser name').fill(deviceLabel);
  await page.getByLabel('Personal enrollment code').fill('2468 1357');
  await page.getByRole('button', { name: 'Enroll This Browser' }).click();

  await expect(page).toHaveURL(/\/start_page1\.html\?manager_access=full_access$/);
  await expect(page.locator('#access-mode')).toContainText(`Full-access Ops Manager · ${managerName}`);
  expect(backend.audit.consumeBodies).toEqual([{ code: validCode, device_id: stableDeviceId, device_label: deviceLabel }]);
  expect(backend.audit.consumeOrigins).toEqual([frontendOrigin]);
  expect(backend.enrolled()).toEqual({ deviceId: stableDeviceId, deviceLabel });
  expect(backend.audit.requestedPaths.join('\n')).not.toMatch(/shared-enrollment|pairing\/consume|pairing-links/);

  const cookies = await context.cookies(backendOrigin);
  const trustCookie = cookies.find((cookie) => cookie.name === cookieName);
  expect(trustCookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'None', value: `${credentialId}.${cookieSecret}` });
  const storage = await page.evaluate((draftKey) => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    documentCookie: document.cookie,
    draft: sessionStorage.getItem(draftKey)
  }), deviceLabelDraftKey);
  const serializedStorage = JSON.stringify(storage);
  for (const forbidden of [validCode, cookieSecret, sessionToken, credentialId]) expect(serializedStorage).not.toContain(forbidden);
  expect(storage.documentCookie).not.toContain(cookieName);
  expect(storage.draft).toBeNull();

  await page.reload();
  await expect(page.locator('#access-mode')).toContainText(`Full-access Ops Manager · ${managerName}`);
  expect(backend.audit.consumeBodies).toHaveLength(1);
  expect(backend.audit.sessionCookieHeaders.some((value) => value.includes(`${cookieName}=${credentialId}.${cookieSecret}`))).toBe(true);
  expect(await page.evaluate(() => window.MemphisAuth.getDeviceId())).toBe(stableDeviceId);
  await context.close();
});

test('invalid and expired personal codes receive the same generic failure and leave no trusted state', async ({ browser }) => {
  const context = await browser.newContext();
  const backend = await installNamedEnrollmentBackend(context);
  const page = await context.newPage();
  await openEnrollment(page);

  for (const rejected of [invalidCode, expiredCode]) {
    await page.getByLabel('Personal enrollment code').fill(rejected);
    await page.getByRole('button', { name: 'Enroll This Browser' }).click();
    await expect(page.locator('#status')).toHaveText(genericCodeError);
    await expect(page.getByLabel('Personal enrollment code')).toHaveValue('');
  }

  expect(backend.audit.enrollmentFailures).toEqual([
    { code: invalidCode, status: 401, error: genericCodeError },
    { code: expiredCode, status: 401, error: genericCodeError }
  ]);
  expect((await context.cookies(backendOrigin)).find((cookie) => cookie.name === cookieName)).toBeUndefined();
  expect(backend.enrolled()).toBeNull();
  await context.close();
});

test('legacy manager-code consumption stays retired and the enrollment page has no shared identity path', async ({ browser }) => {
  const context = await browser.newContext();
  const backend = await installNamedEnrollmentBackend(context);
  const page = await context.newPage();
  await openEnrollment(page);

  await expect(page.getByLabel('Personal enrollment code')).toBeVisible();
  await expect(page.getByText(/shared 48-hour|shared enrollment|Generate PC Invite|Generate Phone Invite|Copy Invite Link|Pair Manager Device/i)).toHaveCount(0);
  const retired = await page.evaluate(async ({ origin, codeValue }) => {
    const response = await fetch(`${origin}/auth-api/ops/manager-codes/consume`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeValue })
    });
    return { status: response.status, payload: await response.json() };
  }, { origin: backendOrigin, codeValue: validCode });
  expect(retired).toEqual({ status: 410, payload: { ok: false, error: 'This enrollment route is retired.' } });
  expect(backend.audit.legacyRequests).toBe(1);
  expect(backend.audit.consumeBodies).toHaveLength(0);
  await context.close();
});

test('CORS permits the deployed frontend origin and denies an unrelated origin before code consumption', async ({ browser }) => {
  const context = await browser.newContext();
  const backend = await installNamedEnrollmentBackend(context);
  await context.route('https://evil.example/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><title>Untrusted origin</title>'
  }));
  const page = await context.newPage();
  await page.goto('https://evil.example/');
  const outcome = await page.evaluate(async ({ origin, codeValue }) => {
    try {
      const response = await fetch(`${origin}/leadership-api/enrollment/consume`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeValue, device_id: 'evil-browser', device_label: 'Evil browser' })
      });
      return { readable: true, status: response.status, allowedOrigin: response.headers.get('access-control-allow-origin') };
    } catch (error) {
      return { readable: false, name: error.name };
    }
  }, { origin: backendOrigin, codeValue: validCode });
  // Playwright's network interception exposes the synthetic 403 to the page,
  // so assert both the denial and the absence of an allow-origin response.
  expect(outcome).toEqual({ readable: true, status: 403, allowedOrigin: null });
  expect(backend.audit.deniedOrigins).toContain('https://evil.example');
  expect(backend.audit.consumeBodies).toHaveLength(0);
  await context.close();
});

test('runtime enrollment assets contain no shared path or embedded enrollment credential material', async () => {
  const root = path.resolve(__dirname, '..');
  const entry = fs.readFileSync(path.join(root, 'ops-manager-hub.html'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'ops-manager-enrollment.js'), 'utf8');
  const auth = fs.readFileSync(path.join(root, 'memphis-auth.js'), 'utf8');
  const runtime = `${entry}\n${controller}\n${auth}`;
  expect(runtime).toContain('/leadership-api/enrollment/consume');
  expect(runtime).not.toMatch(/auth-api\/ops\/manager-codes\/consume|ops\/shared-enrollment|consumeSharedEnrollmentPasscode/);
  expect(runtime).not.toContain(cookieSecret);
  expect(runtime).not.toContain(validCode);
  expect(controller).not.toMatch(/localStorage\.[gs]etItem|sessionStorage\.setItem\([^)]*(code|token|credential|secret)/i);
});
