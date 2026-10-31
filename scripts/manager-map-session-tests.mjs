import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MEMPHIS_MAP_AUTH_STORAGE_KEY,
  MEMPHIS_MAP_ORIGIN,
  currentMemphisMapAccessToken,
  isMemphisMapDashboardSession,
} from '../mobile/src/manager/map-session.js';

const NOW = Date.parse('2026-09-21T21:20:00.000Z');
const storage = (value) => ({ getItem: (key) => key === MEMPHIS_MAP_AUTH_STORAGE_KEY ? value : null });
const valid = JSON.stringify({ access_token: 'map-access-token-fixture', expires_at: Math.floor(NOW / 1000) + 900 });

assert.equal(currentMemphisMapAccessToken({ origin: 'https://lasrevinu333-design.github.io', storage: storage(valid), now: () => NOW }), '');
assert.equal(currentMemphisMapAccessToken({ origin: MEMPHIS_MAP_ORIGIN, storage: storage(valid), now: () => NOW }), 'map-access-token-fixture');
assert.equal(currentMemphisMapAccessToken({ origin: MEMPHIS_MAP_ORIGIN, storage: storage('{bad'), now: () => NOW }), '');
assert.equal(currentMemphisMapAccessToken({ origin: MEMPHIS_MAP_ORIGIN, storage: storage(JSON.stringify({ access_token: 'old', expires_at: Math.floor(NOW / 1000) + 5 })), now: () => NOW }), '');
assert.equal(isMemphisMapDashboardSession({ auth_mode: 'map_identity:jennifer_sheffield_director_operations', access_level: 'read_only', read_only: true }), true);
assert.equal(isMemphisMapDashboardSession({ auth_mode: 'trusted_device', access_level: 'full_access', read_only: false }), false);

const app = readFileSync(new URL('../mobile/src/manager/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../mobile/src/manager/index.html', import.meta.url), 'utf8');
// The independent Map helper above remains unchanged. Custodial management no
// longer imports it or consumes Map/provider/personal-code credentials.
assert.doesNotMatch(app,/currentMemphisMapAccessToken|auth-api\/map-session|manager-codes\/consume/);
assert.match(app,/window\.MemphisAuth\?\.requireOpsManagerSession/);assert.match(app,/window\.MemphisAuth\.clearSession/);
assert.match(html,/ops-manager-hub\.html/);assert.doesNotMatch(html,/map-signin-link|personal eight-digit code/i);
console.log('SEPARATE_MAP_HELPER_AND_CUSTODIAL_DECOUPLING_TESTS_PASS');
