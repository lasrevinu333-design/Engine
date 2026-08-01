#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  createRawStorageAdapter,
  installCustodialStorageFirewall,
} from '../src/custodial/storage-firewall.js';

class TestStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
  clear() { this.values.clear(); }
}

const local = new TestStorage({
  'session:preserved': 'session-bytes',
  'mz_chatscope_outbox:preserved': 'outbox-bytes',
  harmless: 'ordinary-value',
});
const session = new TestStorage();
const raw = createRawStorageAdapter(local);
let status = { initialized: false, ready: false, available: true, quarantined: false };
installCustodialStorageFirewall({ storage: local, getSecurityStatus: () => status });

assert.throws(() => local.setItem('memphisAssignedDeviceId', 'KIOSK_08'), /cannot change/);
assert.throws(() => local.removeItem('session:preserved'), /cannot change/);
assert.throws(() => local.clear(), /cannot change/);
assert.equal(local.getItem('session:preserved'), 'session-bytes');
assert.equal(local.getItem('mz_chatscope_outbox:preserved'), 'outbox-bytes');

local.setItem('harmless', 'changed-before-security-ready');
assert.equal(local.getItem('harmless'), 'changed-before-security-ready');
raw.setItem('memphisAssignedDeviceId', 'KIOSK_08');
assert.equal(local.getItem('memphisAssignedDeviceId'), 'KIOSK_08', 'credential store must retain a private raw adapter');

status = { initialized: true, ready: false, available: true, quarantined: false };
assert.throws(() => local.setItem('mz_scan_device_id', 'KIOSK_08'), /cannot change/);
assert.throws(() => local.removeItem('memphis_zoo_custodial_device_credential'), /cannot change/);

status = { initialized: true, ready: true, available: true, quarantined: false };
assert.throws(() => local.setItem('mz_scan_device_id', 'KIOSK_08'), /cannot change/);
assert.equal(local.getItem('mz_scan_device_id'), null);
local.setItem('session:ready-work', 'ready-session');
assert.equal(local.getItem('session:ready-work'), 'ready-session');
assert.throws(() => local.clear(), /cannot change/);

status = { initialized: true, ready: false, available: true, quarantined: true };
assert.throws(() => local.setItem('mz_employee_hub_device_id', 'KIOSK_02'), /cannot change/);
assert.throws(() => local.removeItem('mz_chatscope_outbox:preserved'), /cannot change/);
assert.equal(local.getItem('mz_chatscope_outbox:preserved'), 'outbox-bytes');

session.setItem('session:draft', 'session-storage-is-not-durable-work');
assert.equal(session.getItem('session:draft'), 'session-storage-is-not-durable-work');

console.log('CUSTODIAL_STORAGE_FIREWALL_PASS');
