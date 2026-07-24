import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../memphis-auth.js', import.meta.url), 'utf8');
const storage = new Map();
const requests = [];
const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const context = {
  console,
  URL,
  navigator: { platform: 'test' },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  fetch: async (input) => {
    const url = new URL(String(input));
    const level = url.searchParams.get('access_level') || 'full_access';
    requests.push(level);
    await new Promise((resolve) => setTimeout(resolve, level === 'full_access' ? 15 : 5));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          session: {
            token: `${level}-token-${requests.length}`,
            role: 'ops_manager',
            access_level: level,
            read_only: level === 'read_only',
            expires_at: future,
            device_id: 'manager-browser-test',
            roles: ['OPS_MANAGER'],
          },
          trusted_device: { device_id: 'manager-browser-test' },
        },
      }),
    };
  },
  window: {
    location: {
      href: 'https://example.test/start_page1.html',
      pathname: '/start_page1.html',
      search: '',
      hash: '',
      replace: () => {},
    },
  },
};
context.window.window = context.window;
context.window.localStorage = context.localStorage;
context.window.navigator = context.navigator;
context.window.fetch = context.fetch;
vm.runInNewContext(source, context, { filename: 'memphis-auth.js' });

const auth = context.window.MemphisAuth;
const [full, readOnly] = await Promise.all([
  auth.requireOpsManagerSession({ accessLevel: 'full_access', interactive: false, redirect: false, throwOnFailure: true }),
  auth.requireOpsManagerSession({ accessLevel: 'read_only', interactive: false, redirect: false, throwOnFailure: true }),
]);
assert.equal(full.access_level, 'full_access');
assert.equal(full.read_only, false);
assert.equal(readOnly.access_level, 'read_only');
assert.equal(readOnly.read_only, true);
assert.deepEqual(requests.sort(), ['full_access', 'read_only']);

await auth.clearSession();
requests.length = 0;
const [sameA, sameB] = await Promise.all([
  auth.requireOpsManagerSession({ accessLevel: 'full_access', interactive: false, redirect: false, throwOnFailure: true }),
  auth.requireOpsManagerSession({ accessLevel: 'full_access', interactive: false, redirect: false, throwOnFailure: true }),
]);
assert.equal(sameA.token, sameB.token);
assert.equal(requests.length, 1, 'same-level concurrent requests must coalesce');

console.log('MANAGER_AUTH_CONCURRENCY_PASS');
