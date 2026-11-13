#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  assertCustodialAndroidToolchainPolicy,
  custodialAndroidToolchainPolicyForPlatform,
} from './custodial-android-toolchain-policy.mjs';

const linux = custodialAndroidToolchainPolicyForPlatform('linux');
const macos = custodialAndroidToolchainPolicyForPlatform('darwin');

assert.equal(linux.platform, 'linux');
assert.equal(linux.archive.size_bytes, 61_959_297);
assert.equal(linux.archive.sha256, '5993499f3229a021b89f87088c57242aeefaa62316bf3d69da7de40bfd5350f1');
assert.equal(macos.platform, 'macosx');
assert.equal(macos.archive.size_bytes, 76_857_925);
assert.equal(macos.archive.sha256, 'c01e4b763da96ae5ef67e8bdf2abc94fb6cb3e73a42209581feb6a7019a51b9c');
assert.notEqual(linux.installed_files_sha256.aapt2, macos.installed_files_sha256.aapt2);
assert.notEqual(linux.installed_files_sha256.zipalign, macos.installed_files_sha256.zipalign);
assert.equal(linux.installed_files_sha256.apksigner, macos.installed_files_sha256.apksigner);
assert.ok(Object.isFrozen(linux));

const mutableLinux = JSON.parse(JSON.stringify(linux));
delete mutableLinux.policy_file;
delete mutableLinux.sha256;

for (const mutate of [
  (value) => { value.extra = true; },
  (value) => { value.platform = 'macosx'; },
  (value) => { value.archive.url = 'https://example.invalid/build-tools.zip'; },
  (value) => { value.archive.size_bytes += 1; },
  (value) => { value.archive.sha1 = '0'.repeat(40); },
  (value) => { value.archive.sha256 = '0'.repeat(64); },
  (value) => { delete value.installed_files_sha256.aapt2; },
  (value) => { value.installed_files_sha256.unreviewed = '0'.repeat(64); },
  (value) => { value.installed_files_sha256.aapt2 = 'not-a-digest'; },
]) {
  const candidate = structuredClone(mutableLinux);
  mutate(candidate);
  assert.throws(() => assertCustodialAndroidToolchainPolicy(candidate, 'linux'));
}

assert.throws(
  () => custodialAndroidToolchainPolicyForPlatform('win32'),
  /does not support host platform win32/,
);

console.log('Custodial Android host toolchain policy tests passed.');

