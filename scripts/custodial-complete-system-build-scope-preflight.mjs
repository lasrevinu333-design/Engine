#!/usr/bin/env node

// Source-only stop gate for the owner's complete-system candidate. This does
// not build an APK or assert that any enabled module works end to end.
import { readFileSync } from 'node:fs';
import { CUSTODIAL_RELEASE_CAPABILITIES, deferredCustodialFeature } from '../mobile/src/custodial/release-scope.js';
import { custodialInitialReleaseHome } from '../mobile/scripts/custodial-initial-release-pages.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const required = ['cleaning', 'schedule', 'messenger', 'events', 'feedback'];
const employeePages = [
  'messages.html', 'messages-chatscope.html', 'thread.html',
  'events.html', 'employee-feedback.html', 'system-feedback.html',
];
const home = read('mobile/src/custodial/index.html');
const build = read('mobile/scripts/build.mjs');
const findings = [];

for (const feature of required) {
  if (CUSTODIAL_RELEASE_CAPABILITIES[feature] !== true) findings.push(`capability_${feature}_disabled`);
}
for (const page of employeePages) {
  if (deferredCustodialFeature(page)) findings.push(`employee_page_stubbed:${page}`);
}
for (const page of ['messages.html', 'events.html', 'employee-feedback.html', 'employee-schedule.html']) {
  if (!home.includes(`href="./${page}?hub=employee"`) && !home.includes(`href="./${page}"`)) {
    findings.push(`home_entry_missing:${page}`);
  }
}
if (!home.includes('class="memphisHome"')) findings.push('memphis_home_entry_missing');
if (!build.includes("html = custodialInitialReleaseHome(html)")) findings.push('unexpected_home_build_transform');
try {
  const generatedHome = custodialInitialReleaseHome(home);
  if (generatedHome.includes('deferredFeature')) findings.push('generated_home_has_disabled_entries');
  if (!generatedHome.includes('class="memphisHome"')) findings.push('generated_home_omits_memphis');
} catch (error) {
  findings.push(`home_build_transform_rejects_complete_scope:${String(error?.message || error)}`);
}

const result = {
  status: findings.length ? 'HOLD_COMPLETE_SYSTEM_BUILD_SCOPE' : 'PASS_COMPLETE_SYSTEM_BUILD_SCOPE_SOURCE_ONLY',
  findings,
  checked: { capabilities: required.length, employeePages: employeePages.length, homeEntries: 5 },
  limits: 'Source derivation only; no web output, APK, module runtime, provider, mail, phone or physical acceptance.',
};
process.stdout.write(`${JSON.stringify(result)}\n`);
if (findings.length) process.exitCode = 1;
