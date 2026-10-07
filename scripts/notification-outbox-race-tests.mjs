import assert from 'node:assert/strict';
import {
  createNotificationOutboxFlusher,
  settleNotificationOutboxRow,
} from '../mobile/src/custodial/notification-receipts.js';

const pending = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

// Native arrival, app resume and network restoration may all request a drain
// while the same HTTP request is outstanding. They must not send it in parallel.
const first = pending();
let passes = 0;
let active = 0;
let maxActive = 0;
const flush = createNotificationOutboxFlusher(async () => {
  passes += 1;
  active += 1;
  maxActive = Math.max(maxActive, active);
  if (passes === 1) await first.promise;
  active -= 1;
});
const arrival = flush();
await Promise.resolve();
assert.equal(passes, 1);
const resumed = flush();
first.resolve();
await Promise.all([arrival, resumed]);
assert.equal(passes, 2, 'a request arriving mid-flight receives a later pass');
assert.equal(maxActive, 1, 'the two callbacks never run concurrent delivery passes');

const saved = new Map();
const storage = {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value),
  removeItem: key => saved.delete(key),
};
const mutate = operation => Promise.resolve(operation());
const key = 'mz_native_notification_outbox:receipt';
const row = {schema_version:'native-notification-outbox.v3', id:'receipt', attempts:0};
const encoded = JSON.stringify(row);
storage.setItem(key, encoded);

assert.equal(await settleNotificationOutboxRow({storage, mutate, key, encoded, row, delivered:true}), true);
assert.equal(storage.getItem(key), null);
assert.equal(await settleNotificationOutboxRow({storage, mutate, key, encoded, row, delivered:false}), false);
assert.equal(storage.getItem(key), null, 'late failed sender cannot resurrect a settled receipt');

storage.setItem(key, encoded);
const replacement = JSON.stringify({...row, attempts:1, marker:'newer'});
storage.setItem(key, replacement);
assert.equal(await settleNotificationOutboxRow({storage, mutate, key, encoded, row, delivered:true}), false);
assert.equal(storage.getItem(key), replacement, 'late success cannot erase a newer row');

storage.setItem(key, JSON.stringify({...row, attempts:1,
  last_attempt_at:'2026-10-02T04:00:00.000Z'}));
assert.equal(await settleNotificationOutboxRow({storage, mutate, key, encoded, row, delivered:true}), true);
assert.equal(storage.getItem(key), null, 'success settles the same operation despite a competing retry increment');

storage.setItem(key, encoded);
assert.equal(await settleNotificationOutboxRow({storage, mutate, key, encoded, row, delivered:false,
  now:()=> '2026-10-02T04:00:00.000Z'}), true);
assert.deepEqual(JSON.parse(storage.getItem(key)), {...row, attempts:1,
  last_attempt_at:'2026-10-02T04:00:00.000Z'});

let fail = true;
const recover = createNotificationOutboxFlusher(async () => {
  if (fail) throw new Error('temporary transport failure');
});
await assert.rejects(recover(), /temporary transport failure/);
fail = false;
await recover();

console.log(JSON.stringify({scope:'native notification outbox callback and stale-row races',
  pass:8, maxConcurrentDeliveryPasses:maxActive}));
