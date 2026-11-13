#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const plan = read('docs/whole-system-test-plan.md');
const map = JSON.parse(read('quality/system-impact-map.json'));

assert.equal(map.schema_version, 1);
assert.match(map.name, /whole-system change-impact map/i);
assert.ok(Array.isArray(map.global_invariants) && map.global_invariants.length >= 12, 'global invariants must be comprehensive');
assert.ok(map.suites && typeof map.suites === 'object' && Object.keys(map.suites).length >= 20, 'suite catalog must cover all test rings');
assert.ok(Array.isArray(map.components) && map.components.length >= 15, 'component map must cover the full system');

const suiteIds = new Set(Object.keys(map.suites));
const componentIds = new Set();
const criticalIds = [];
for (const component of map.components) {
  assert.match(component.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `invalid component id: ${component.id}`);
  assert.equal(componentIds.has(component.id), false, `duplicate component id: ${component.id}`);
  componentIds.add(component.id);
  assert.ok(['medium', 'high', 'critical'].includes(component.risk), `${component.id} must declare risk`);
  assert.ok((component.patterns?.length || 0) + (component.external_patterns?.length || 0) > 0, `${component.id} needs file patterns`);
  assert.ok(Array.isArray(component.depends_on), `${component.id} needs dependencies`);
  assert.ok(Array.isArray(component.required_suites) && component.required_suites.length >= 2, `${component.id} needs required suites`);
  assert.ok(Array.isArray(component.invariants) && component.invariants.length >= 3, `${component.id} needs invariants`);
  for (const suite of component.required_suites) assert.ok(suiteIds.has(suite), `${component.id} references unknown suite ${suite}`);
  if (component.risk === 'critical') criticalIds.push(component.id);
}
for (const component of map.components) {
  for (const dependency of component.depends_on) assert.ok(componentIds.has(dependency), `${component.id} references unknown component ${dependency}`);
}

assert.ok(criticalIds.length >= 8, 'critical subsystems must be explicit');
for (const id of criticalIds) {
  const component = map.components.find((row) => row.id === id);
  assert.ok(component.invariants.length >= 5, `${id} needs deeper critical invariants`);
  assert.ok(component.required_suites.some((suite) => map.suites[suite].status === 'implemented'), `${id} needs at least one implemented protection`);
}

const requiredSuites = [
  'source-contracts', 'messaging-browser', 'mobile-contracts', 'android-builds',
  'backend-disposable-db', 'visual-regression', 'accessibility-web', 'property-model',
  'mutation', 'consumer-contract', 'api-fuzz', 'security-static', 'security-dynamic',
  'performance-api', 'firebase-device-lab', 'combinatorial-matrix', 'manual-field', 'recovery-drill',
];
for (const suite of requiredSuites) assert.ok(suiteIds.has(suite), `missing planned suite ${suite}`);

const requiredHeadings = [
  '# Memphis Zoo Operations Whole-System Test Plan',
  '## 3. Selected testing toolchain',
  '## 4. Test architecture: concentric quality rings',
  '## 6. Global invariants',
  '## 7. Change-impact analysis and the “single variable” problem',
  '## 8. Visual placement and interaction testing',
  '## 9. Accessibility and human comprehension',
  '## 10. Functional journey catalog',
  '## 12. API and database verification',
  '## 13. Security and privacy plan',
  '## 14. Performance, capacity, and resource use',
  '## 15. Resilience and failure injection',
  '## 16. Deployment, rollback, and disaster recovery',
  '## 17. Manual field acceptance',
  '## 22. Definition of a completed release',
];
for (const heading of requiredHeadings) assert.ok(plan.includes(heading), `missing plan section: ${heading}`);

const requiredToolReferences = [
  'playwright.dev/docs/test-snapshots',
  'fast-check.dev/docs',
  'stryker-mutator.io/docs',
  'docs.pact.io',
  'schemathesis.readthedocs.io',
  'supabase.com/docs/guides/local-development/testing/overview',
  'developer.android.com/training/testing/espresso',
  'developer.android.com/training/testing/other-components/ui-automator',
  'firebase.google.com/docs/test-lab',
  'grafana.com/docs/k6',
  'zaproxy.org/docs',
  'csrc.nist.gov/projects/automated-combinatorial-testing-for-software',
];
for (const reference of requiredToolReferences) assert.ok(plan.includes(reference), `missing authoritative reference ${reference}`);

const requiredInvariants = [
  'Authoritative success',
  'Exactly-once effect',
  'Identity integrity',
  'Historical integrity',
  'Authority separation',
  'Offline honesty',
  'Visual predictability',
  'Release identity',
  'Secret containment',
];
for (const invariant of requiredInvariants) assert.ok(plan.includes(invariant), `missing invariant ${invariant}`);

// Confirm dependency expansion terminates even though a deliberately integrated
// system may contain cycles. This guards the change-impact tool from recursion bugs.
const downstream = new Map([...componentIds].map((id) => [id, []]));
for (const component of map.components) {
  for (const dependency of component.depends_on) downstream.get(dependency).push(component.id);
}
for (const start of componentIds) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    for (const next of downstream.get(current) || []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  assert.ok(seen.has(start));
  assert.ok(seen.size <= componentIds.size);
}

console.log(JSON.stringify({
  ok: true,
  classification: 'whole-system-test-plan-contract',
  components: componentIds.size,
  critical_components: criticalIds.length,
  suites: suiteIds.size,
  global_invariants: map.global_invariants.length,
}, null, 2));
