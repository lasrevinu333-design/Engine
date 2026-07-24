#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const syncSource = readFileSync(new URL('../memphis-scan-sync.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} is not balanced`);
}

class FakeLocalStorage {
  constructor(entries) {
    this.values = new Map(entries);
  }
  get length() {
    return this.values.size;
  }
  key(index) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
const recent = new Date().toISOString();
const durableStatuses = ['active', 'server-active', 'pending_submit', 'pending_sync', 'offline-provisional'];
const entries = durableStatuses.map((status) => [
  `session:${status}`,
  JSON.stringify({ status, started_at: old, updated_at: old }),
]);
entries.push(
  ['session:old-closed', JSON.stringify({ status: 'closed', started_at: old, ended_at: old, updated_at: old })],
  ['session:recent-closed', JSON.stringify({ status: 'closed', started_at: old, ended_at: recent, updated_at: recent })],
  ['session:malformed', '{'],
  ['unrelated', 'keep'],
);

const localStorage = new FakeLocalStorage(entries);
const context = vm.createContext({ localStorage, Date, Set });
vm.runInContext(`${extractFunction('cleanupStaleLocalSessions')}; cleanupStaleLocalSessions();`, context);

for (const status of durableStatuses) {
  assert.ok(localStorage.values.has(`session:${status}`), `${status} recovery state must never be age-purged`);
}
assert.equal(localStorage.values.has('session:old-closed'), false, 'old terminal state should be purged');
assert.equal(localStorage.values.has('session:recent-closed'), true, 'recent terminal state should remain');
assert.equal(localStorage.values.has('session:malformed'), false, 'malformed session state should be purged');
assert.equal(localStorage.values.has('unrelated'), true, 'unrelated local storage must remain untouched');

assert.match(
  source,
  /\["pending_submit","pending_sync","offline-provisional"\]\.includes\(localStatus\)\)continue/,
  'server reconciliation must preserve unacknowledged local work until the durable queue resolves it',
);
assert.match(
  source,
  /\["active","server-active","pending_submit","pending_sync","offline-provisional"\]/,
  'all resumable session states must participate in reconciliation',
);
assert.match(
  syncSource,
  /local_session_is_no_longer_active/,
  'queued GPS telemetry must be discarded when its local session is no longer active',
);
assert.match(
  syncSource,
  /session does not belong\|session is no longer active\|active session not found/i,
  'a server-rejected stale GPS/session relationship must not retry forever',
);
assert.match(
  syncSource,
  /disposableTelemetry[\s\S]{0,240}\{ succeeded: true \}/,
  'permanently rejected GPS telemetry must leave the durable queue instead of becoming a dead letter',
);

console.log('scan local-session retention tests passed');
