#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const page = read('schedule-weekly.html');

assert.match(page, /requireOpsManagerSession\(\{interactive:false,redirect:true,throwOnFailure:true\}\)/, 'the workspace requires a current named manager session');
assert.match(page, /opsManagerAuthHeaders\(\)/, 'every scheduler read and action carries the trusted manager session');
assert.match(page, /\/scheduler-runtime-config/, 'the browser discovers the separately deployed scheduler origin from backend configuration');
assert.doesNotMatch(page, /\/schedule-api|supabase\.co|service_role/i, 'the manager workspace must not use legacy scheduler or database authority');
for (const route of [
  '/static-weekly/manager-snapshot',
  '/static-weekly/drafts/initial',
  '/static-weekly/drafts/replacement',
  '/static-weekly/contractor-capacity',
  '/static-weekly/exceptions',
  '/static-weekly/projections',
]) assert.match(page, new RegExp(route.replaceAll('/', '\\/')), `${route} must be wired`);
assert.match(page, /\/static-weekly\/drafts\/\$\{encodeURIComponent\(draft\.version_id\)\}\/publish/, 'draft publication must bind the exact version ID');
assert.match(page, /contractor_capacity/, 'only registered contractor-capacity slots may be offered as CoverAll');
assert.match(page, /departed_named_absent/, 'departed named slots remain visible as baseline absences');
assert.match(page, /activeExceptionSlots/, 'existing dated overlays must disable duplicate manager submissions');
assert.match(page, /exception_type:'reverse'/, 'dated changes remain reversibly removable');
assert.match(page, /const reversed=await api\('\/static-weekly\/exceptions'[\s\S]*materializeProjection\(publication\.publication_id,reversed\.revision,snapshot\.week_start\)/, 'reversing a dated change must rebuild the compiled week at the returned authority revision');
assert.match(page, /async function refreshSnapshot/, 'mutations must refresh the coherent manager snapshot');
for (const action of ['generateDraft', 'publishDraft', 'applyDayChanges', 'reverseChange']) {
  const line = page.split('\n').find((candidate) => candidate.includes(`function ${action}(`));
  assert.ok(line, `${action} must exist`);
  assert.doesNotMatch(line, /await loadSnapshot\(\)/, `${action} must not deadlock behind a nested busy-lock refresh`);
}

for (const file of [
  'start_page1.html',
  'ops-hub.js',
  'mobile/src/manager/index.html',
  'mobile/src/manager/moxie.html',
  'mobile/src/manager/notifications.html',
  'mobile/src/shell/roles/manager/routes.ts',
]) {
  assert.match(read(file), /schedule-weekly\.html/, `${file} must route Schedule to the weekly authority workspace`);
}
assert.match(read('schedule-employee-day.html'), /new URL\('\.\/schedule-weekly\.html'/, 'the detailed day view returns to the weekly workspace');
assert.match(read('mobile/scripts/build.mjs'), /custodialProhibitedFiles[\s\S]*schedule-weekly\.html/, 'the manager scheduler must remain absent from the employee edition');
assert.match(read('schedule-simple.html'), /<title>/, 'the prior manager scheduler remains available as a rollback asset');

console.log('static weekly manager workspace contract tests: PASS');
