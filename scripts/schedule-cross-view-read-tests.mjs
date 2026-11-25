import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createScheduleHomeConvergence } from '../mobile/src/custodial/schedule-home-convergence.js';
import { fixture, payload, day, key, id } from './employee-schedule-convergence-race-tests.mjs';

const source = readFileSync(new URL('../mobile/src/custodial/employee-schedule-runtime.js', import.meta.url), 'utf8')
  .replace('export function installEmployeeSchedule', 'function installEmployeeSchedule')
  .replace("void load('launch');", 'globalThis.loadMountedSchedule=load;') + '\ninstallEmployeeSchedule();';
const signal = new AbortController().signal;
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  return { promise: new Promise(done => { resolve = done; }), resolve };
}

for (const homeFirst of [true, false]) {
  for (const denied of [false, true]) {
    test(`${homeFirst ? 'Home' : 'Schedule'} first, ${denied ? 'observed denial' : 'no HTTP result'}`, { timeout: 4000 }, async () => {
      const f = fixture();
      const owner = { deviceId: 'KIOSK_08', employeeId: id(2), employeeName: 'Fixture',
        credentialId: id(3), assignmentEpoch: 7, protectedBinding: 'race-principal' };
      const storage = f.context.localStorage;
      const api = f.context.window.MemphisRecurringScheduleTarget;
      const current = () => api.availability(storage, owner.protectedBinding, day);
      const home = createScheduleHomeConvergence({ identity: () => owner, storage,
        mutate: async fn => fn(), matches: () => true, now: () => Date.parse(day + 'T17:00:00Z') });
      await f.put(payload(19));
      api.writeAvailability(storage, owner.protectedBinding, day, 'AVAILABLE', null);
      const saved = f.stored.get(key);
      const homeEntered = deferred(), scheduleEntered = deferred();
      const finishHome = deferred(), finishSchedule = deferred();
      f.context.fetch = async () => {
        scheduleEntered.resolve();
        await finishSchedule.promise;
        if (denied) return { ok: false, status: 403, json: async () => ({ ok: false }) };
        throw new Error('Synthetic transport disconnected');
      };
      vm.runInContext(source, f.context);
      const startHome = () => home.readExclusively(owner, day, signal, async () => {
        const original = await home.begin(owner);
        homeEntered.resolve();
        await finishHome.promise;
        await home.cancel(owner, original);
      });
      const startSchedule = () => f.context.loadMountedSchedule();
      const first = homeFirst ? startHome() : startSchedule();
      await (homeFirst ? homeEntered.promise : scheduleEntered.promise);
      const before = current();
      assert.equal(before.priorState, 'AVAILABLE');
      const second = homeFirst ? startSchedule() : startHome();
      await tick();
      if (homeFirst) f.events.get('storage')({ key: api.availabilityKey(owner.protectedBinding) });
      assert.equal(current().stamp, before.stamp, 'the waiting view cannot claim a second read fence');
      (homeFirst ? finishHome : finishSchedule).resolve();
      await first;
      await (homeFirst ? scheduleEntered.promise : homeEntered.promise);
      assert.equal(current().priorState, !homeFirst && denied ? 'UNAVAILABLE' : 'AVAILABLE');
      (homeFirst ? finishSchedule : finishHome).resolve();
      await second;
      assert.equal(f.stored.get(key), saved);
      assert.equal(current().state, denied ? (homeFirst ? 'READING' : 'UNAVAILABLE') : 'AVAILABLE');
      if (!denied) {
        assert.equal(f.node('content').hidden, false);
        assert.match(f.node('state-text').textContent, /Showing a saved schedule/);
      }
    });
  }
}
