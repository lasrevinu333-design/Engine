#!/usr/bin/env node

// Source-only stop gate for the owner's complete-system candidate. This does
// not build an APK or assert that any enabled module works end to end.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CUSTODIAL_RELEASE_CAPABILITIES, deferredCustodialFeature } from '../mobile/src/custodial/release-scope.js';
import { custodialInitialReleaseHome } from '../mobile/scripts/custodial-initial-release-pages.mjs';
import { isCleaningScope, readCustodialBuildScope } from '../mobile/scripts/custodial-new-producer-scope-policy.mjs';

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
if (!build.includes('html = custodialInitialReleaseHome(html,{cleaningFirst:isCleaningScope(newProducerScope)})')) {
  findings.push('unexpected_home_build_transform');
}
let profile = null;
try {
  const scope = readCustodialBuildScope(fileURLToPath(new URL('../mobile/', import.meta.url)));
  profile = scope.profile;
  const cleaningFirst = isCleaningScope(scope);
  if (cleaningFirst) findings.push('source_scope_defers_complete_system');
  const generatedHome = custodialInitialReleaseHome(home, { cleaningFirst });
  if (generatedHome.includes('deferredFeature')) findings.push('generated_home_has_disabled_entries');
  if (generatedHome !== home) findings.push('generated_home_changes_complete_system_menu');
} catch (error) {
  findings.push(`build_source_rejects_complete_scope:${String(error?.message || error)}`);
}

const result = {
  status: findings.length ? 'HOLD_COMPLETE_SYSTEM_BUILD_SCOPE' : 'PASS_COMPLETE_SYSTEM_BUILD_SCOPE_SOURCE_ONLY',
  findings,
  profile,
  checked: { capabilities: required.length, employeePages: employeePages.length, homeEntries: 5 },
  limits: 'Source derivation only; no web output, APK, module runtime, provider, mail, phone or physical acceptance.',
};
process.stdout.write(`${JSON.stringify(result)}\n`);
if (findings.length) process.exitCode = 1;
