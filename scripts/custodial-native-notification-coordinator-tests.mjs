import assert from 'node:assert/strict';
import {
  normalizeEmployeeAlert,
  runTwoCycleAudio,
} from '../mobile/src/custodial/notification-coordinator.js';

const trace = [];
await runTwoCycleAudio({
  text: 'Tammy, you received a message from Alijah Collins.',
  playChime: async () => { trace.push('chime'); },
  speak: async (value) => { trace.push(`voice:${value}`); },
  wait: async () => {},
});
assert.deepEqual(trace, [
  'chime',
  'voice:Tammy, you received a message from Alijah Collins.',
  'chime',
  'voice:Tammy, you received a message from Alijah Collins.',
]);

let cancelledAfterFirstSpeech = false;
const cancelledTrace = [];
await runTwoCycleAudio({
  text: 'Tammy, Teton Restrooms is due soon.',
  playChime: async () => { cancelledTrace.push('chime'); },
  speak: async (value) => {
    cancelledTrace.push(`voice:${value}`);
    cancelledAfterFirstSpeech = true;
  },
  wait: async () => {},
  isCancelled: () => cancelledAfterFirstSpeech,
});
assert.deepEqual(cancelledTrace, [
  'chime',
  'voice:Tammy, Teton Restrooms is due soon.',
]);

const routeResolver = (route) => `safe:${route}`;
const message = normalizeEmployeeAlert({
  employeeName: 'Tammy Miller',
  routeResolver,
  notification: {
    title: 'Alijah Collins',
    body: 'Private message contents must not be spoken.',
    data: {
      kind: 'employee_message',
      notification_key: 'message:123',
      sender_name: 'Alijah Collins',
    },
  },
});
assert.equal(message.id, 'message:123');
assert.equal(message.speech, 'Tammy, you received a message from Alijah Collins.');
assert.equal(message.body, 'Alijah Collins sent you a message.');
assert.ok(!message.speech.includes('Private message contents'));
assert.equal(message.route, 'safe:./messages.html?hub=employee');

const dueSoon = normalizeEmployeeAlert({
  employeeName: 'Tammy Miller',
  routeResolver,
  notification: {
    data: {
      kind: 'employee_location_status',
      status_code: 'due_soon',
      location_name: 'Teton Restrooms',
      notification_key: 'location:teton:due',
    },
  },
});
assert.equal(dueSoon.speech, 'Tammy, Teton Restrooms is due soon.');
assert.ok(!dueSoon.speech.toLowerCase().includes('route'));

const overdue = normalizeEmployeeAlert({
  employeeName: 'Tammy Miller',
  routeResolver,
  notification: {
    data: {
      kind: 'employee_location_status',
      status_code: 'overdue',
      location_name: 'Teton Restrooms',
      notification_key: 'location:teton:overdue',
    },
  },
});
assert.equal(overdue.speech, 'Tammy, Teton Restrooms is overdue. Please handle it now.');

const cases = [
  ['employee_restroom_rebalance', 'Tammy, your restroom assignments have changed.'],
  ['employee_lunch_coverage_start', 'Tammy, lunch coverage has been assigned.'],
  ['employee_lunch_coverage_end', 'Tammy, your lunch coverage has ended.'],
  ['employee_areas_inherited', 'Tammy, additional areas have been assigned to you.'],
  ['employee_areas_transferred', 'Tammy, some areas were removed from your schedule.'],
  ['employee_manager_reassignment', 'Tammy, your assignments have changed.'],
];
for (const [kind, expected] of cases) {
  const alert = normalizeEmployeeAlert({
    employeeName: 'Tammy Miller',
    routeResolver,
    notification: { data: { kind, notification_key: `test:${kind}` } },
  });
  assert.equal(alert.speech, expected, kind);
  assert.equal(alert.openLabel, 'Open Schedule', kind);
}

console.log('custodial native notification coordinator tests: PASS');
