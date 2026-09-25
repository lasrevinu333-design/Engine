import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHomeAssistantEntry } from '../mobile/src/chatscope/home-assistant-entry.mjs';

// Actual entry controller and list normalizer; HTTP, identity, React selection
// and lifecycle are synthetic. This is not a browser/native/AI/physical pass.
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const app = read('mobile/src/chatscope/app.jsx');
const home = read('mobile/src/custodial/index.html');
const context = vm.createContext({});
vm.runInContext(app.slice(app.indexOf('function isMemphisRow('), app.indexOf('function isRetiredThread('))
  + app.slice(app.indexOf('function normalizedThread('), app.indexOf('function isMemphis(thread)')), context);
const normalize = context.normalizedThread;
const ID = '20000000-0000-4000-8000-000000000001';
const OTHER = '20000000-0000-4000-8000-000000000002';
const identity = { msg_user_id: '10000000-0000-4000-8000-000000000001' };
let checks = 0;
function equal(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++; }
function fixture(enabled = true, changes = {}) {
  const entry = createHomeAssistantEntry(enabled);
  const calls = [], opened = [];
  const deps = {
    resolveIdentity: async () => identity, deviceId: 'KIOSK_SYNTHETIC',
    isCurrent: mapped => mapped === identity, hasPendingDeletion: () => false,
    request: async (path, options) => { calls.push({ path, options }); return { ok: true, data: { id: ID, thread_type: 'bot', is_active: true } }; },
    readThreads: async () => [normalize({ thread_id: ID, thread_type: 'bot', thread_title: 'Memphis' })],
    select: id => opened.push(id), ...changes,
  };
  return { entry, deps, calls, opened, run: () => entry.run(deps) };
}
{
  const f = fixture(false, { resolveIdentity() { throw Error('ordinary Messenger must do no assistant work'); } });
  equal(await f.run(), false, 'ordinary Messenger / manager navigation has no implicit assistant');
  equal(f.calls.length, 0, 'no hidden restoration request');
}
{
  const f = fixture(); equal(await f.run(), true, 'explicit Home entry opens');
  equal(f.opened, [ID], 'canonical readback-selected thread');
  equal(f.calls, [{ path: '/memphis/thread', options: { method: 'POST', body: { user_id: identity.msg_user_id, device_id: 'KIOSK_SYNTHETIC' } } }], 'only existing authenticated assistant route, no send/schedule action');
  equal(await f.run(), false, 'consumed Home intent never reopens on resume');
  equal(f.calls.length, 1, 'exactly one canonical lookup');
}
for (const [label, changes] of [
  ['missing device', { deviceId: '' }],
  ['missing user', { resolveIdentity: async () => ({}), isCurrent: () => true }],
  ['pending deletion', { hasPendingDeletion: () => true }],
]) {
  const f = fixture(true, changes); await assert.rejects(f.run()); checks++;
  equal(f.calls.length, 0, label + ' does not create/restore'); equal(f.opened, [], label + ' does not open');
}
for (const data of [null, { id: 'not-an-id', thread_type: 'bot' }, { id: ID, thread_type: 'direct', title: 'Memphis' }, { id: ID }, { id: ID, thread_type: 'bot', is_active: false }]) {
  const f = fixture(true, { request: async () => ({ ok: true, data }) });
  await assert.rejects(f.run(), /Could not verify/); checks++; equal(f.opened, [], 'malformed/non-bot/retired response cannot select');
}
{
  const f = fixture(true, { request: async () => ({ ok: false, data: { id: ID, thread_type: 'bot' } }) });
  await assert.rejects(f.run(), /Could not verify/); checks++; equal(f.opened, [], 'error envelope cannot select');
}
for (const rows of [[], [{ id: OTHER, thread_type: 'bot' }], [{ id: ID, thread_type: 'direct', title: 'Memphis' }], [{ id: ID, thread_type: 'bot', is_active: false }]]) {
  const f = fixture(true, { readThreads: async () => rows.map(normalize) });
  await assert.rejects(f.run(), /Could not load/); checks++; equal(f.opened, [], 'missing/other/title-spoofed/inactive list readback cannot select');
}
{
  const f = fixture(); const request = f.deps.request; let failed = false;
  f.deps.request = async (...args) => { if (!failed) { failed = true; throw Error('synthetic offline'); } return request(...args); };
  await assert.rejects(f.run(), /synthetic offline/); checks++; equal(f.opened, [], 'offline is not success');
  equal(await f.run(), true, 'next existing online/resume event can retry'); equal(f.opened, [ID], 'retry selects once');
}
for (const boundary of ['resolveIdentity', 'request', 'readThreads']) {
  const f = fixture(); const operation = f.deps[boundary]; let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { entered = resolve; });
  f.deps[boundary] = async (...args) => { entered(); await gate; return operation(...args); };
  const one = f.run(), two = f.run(); equal(one, two, boundary + ' concurrent resumes coalesce');
  await reached; f.entry.cancel(); release(); equal(await one, false, boundary + ' navigation cancels late opening');
  equal(f.opened, [], boundary + ' no navigation hijack'); equal(await f.run(), false, boundary + ' canceled intent remains canceled');
}
for (const boundary of ['resolveIdentity', 'request', 'readThreads']) {
  const f = fixture(); const operation = f.deps[boundary]; let current = true;
  f.deps.isCurrent = () => current;
  f.deps[boundary] = async (...args) => { const result = await operation(...args); current = false; return result; };
  equal(await f.run(), false, boundary + ' stale identity cannot select'); equal(f.opened, [], 'identity change has no stale view');
  current = true; equal(await f.run(), false, 'stale intent is not rebound to another identity');
}
{
  const f = fixture(); let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { entered = resolve; });
  const request = f.deps.request;
  f.deps.request = async (...args) => { entered(); await gate; return request(...args); };
  const first = f.run(); await reached; const second = f.run();
  equal(first, second, 'overlapping successful resume shares in-flight operation');
  release(); equal(await first, true, 'shared operation succeeds'); await second;
  equal(f.calls.length, 1, 'shared success has one POST'); equal(f.opened, [ID], 'shared success selects once');
}
// Execute the actual React useCallback body with synthetic hook/dependencies,
// not a separately reimplemented route. No React/browser runtime is claimed.
{
  const f = fixture();
  const wiring = vm.createContext({ useCallback: fn => fn, homeAssistantEntry: { current: f.entry },
    loadIdentity: f.deps.resolveIdentity, currentDeviceId: f.deps.deviceId,
    mounted: { current: true }, identityRef: { current: identity }, deviceId: () => f.deps.deviceId,
    pendingDeletedThreadIds: () => new Set(), api: f.deps.request, loadThreads: f.deps.readThreads, selectThread: f.deps.select });
  const start = app.indexOf('  const resolveHomeAssistant = useCallback(');
  const end = app.indexOf('  const flushMessageOutbox = useCallback(', start);
  assert.ok(start > 0 && end > start); checks++;
  vm.runInContext(app.slice(start, end) + '\nglobalThis.invoke = resolveHomeAssistant;', wiring);
  equal(await wiring.invoke(), true, 'actual component callback opens own readback-verified assistant');
  equal(f.opened, [ID], 'actual callback uses component selector');
  equal(f.calls[0].options.body.user_id, identity.msg_user_id, 'actual callback uses resolved user');
  equal(f.calls[0].options.body.device_id, f.deps.deviceId, 'actual callback uses current device');
}
// Binding checks ensure the tested controller is actually used by the page.
assert.match(home, /id="home-memphis"[^>]+href="\.\/messages\.html\?hub=employee&amp;assistant=memphis"[^>]+aria-label="Ask Memphis"/); checks++;
assert.match(home, /<strong>Ask Memphis<\/strong>/); checks++;
equal([...home.matchAll(/class="homeLabel">([^<]+)/g)].map(row => row[1]), ['Memphis Messenger', 'My Schedule', 'Upcoming Events', 'Program Feedback'], 'original four choices intact');
assert.match(app, /import \{ createHomeAssistantEntry \} from '\.\/home-assistant-entry\.mjs'/); checks++;
assert.match(app, /EMPLOYEE_CONTEXT && PAGE_URL\.searchParams\.get\('assistant'\) === 'memphis'/); checks++;
assert.match(app, /await loadIdentity\(\);\s*await loadThreads\(\);\s*await retryOutbox\(\);\s*await resolveHomeAssistant\(\)/); checks++;
assert.match(app, /isCurrent: \(mapped\) => mounted\.current && identityRef\.current === mapped && deviceId\(\) === currentDeviceId/); checks++;
assert.match(app, /request: api,\s*readThreads: loadThreads,\s*select: selectThread/); checks++;
assert.match(app, /const selectThread = useCallback\(\(id\) => \{\s*cancelHomeAssistant\(\)/); checks++;
assert.match(app, /const deleteThread = useCallback\(async \(threadId = selectedRef\.current\) => \{\s*cancelHomeAssistant\(\)/); checks++;
assert.match(app, /url\.searchParams\.delete\('assistant'\)/); checks++;
equal((app.match(/retryOutbox\(\)\.then\(resolveHomeAssistant\)/g) || []).length, 2, 'online and foreground retry existing intent');
console.log(JSON.stringify({ status: 'PASS_MEMPHIS_HOME_ENTRY_LOCAL', checks, actualController: true, actualThreadNormalizer: true,
  synthetic: ['HTTP', 'identity', 'React selection', 'lifecycle'], notProven: ['browser layout/tap', 'native phone', 'server auth/RPC', 'AI answers', 'independent review'] }));
