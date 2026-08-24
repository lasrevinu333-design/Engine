#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const page = read('schedule-weekly.html');

assert.match(page, /requireOpsManagerSession\(\{interactive:false,redirect:true,throwOnFailure:true\}\)/, 'the workspace requires a current named manager session');
assert.match(page, /opsManagerAuthHeaders\(\)/, 'every scheduler read and action carries the trusted manager session');
assert.doesNotMatch(page, /\bconfirm\(/, 'scheduler actions must not depend on browser-native confirmation dialogs');
assert.match(page, /id="action-confirm-dialog"[\s\S]*function confirmAction\(/, 'scheduler actions use one accessible in-page confirmation path');
assert.match(page, /\/scheduler-runtime-config/, 'the browser discovers the separately deployed scheduler origin from backend configuration');
assert.doesNotMatch(page, /\/schedule-api|supabase\.co|service_role/i, 'the manager workspace must not use legacy scheduler or database authority');
for (const route of [
  '/static-weekly/manager-snapshot',
  '/static-weekly/drafts/initial',
  '/static-weekly/drafts/replacement',
  '/static-weekly/day-changes/batch',
  '/static-weekly/exceptions',
  '/static-weekly/employees/departed',
  '/static-weekly/employees/replacements',
  '/static-weekly/rebuild-current-projection',
]) assert.match(page, new RegExp(route.replaceAll('/', '\\/')), `${route} must be wired`);
assert.match(page, /\/static-weekly\/drafts\/\$\{encodeURIComponent\(draft\.version_id\)\}\/publish/, 'draft publication must bind the exact version ID');
assert.match(page, /operation:'cover_all'/, 'only registered contractor-capacity slots may be offered as CoverAll');
assert.match(page, /departed_named_absent/, 'departed named slots remain visible as baseline absences');
assert.match(page, /activeExceptionSlots/, 'existing dated overlays must disable duplicate manager submissions');
assert.match(page, /exception_type:'reverse'/, 'dated changes remain reversibly removable');
assert.doesNotMatch(page, /async function materializeProjection|await materializeProjection\(/, 'the UI must never split a staffing mutation from projection materialization');
assert.doesNotMatch(page, /\/static-weekly\/projections/, 'the UI must use the named rebuild recovery command instead of raw projection materialization');
assert.match(page, /week_start:snapshot\.week_start/, 'every authority mutation must bind its Monday-aligned projection week');
assert.match(page, /async function applyDayChanges\(\)\{[\s\S]*\/static-weekly\/day-changes\/batch[\s\S]*operations[\s\S]*expected_revision:snapshot\.authority_revision[\s\S]*await refreshSnapshot\(\)/, 'daily call-outs and CoverAll capacity must commit through one atomic batch');
assert.match(page, /id="rebuild-projection-btn"[\s\S]*data-lucide="refresh-cw"[\s\S]*Rebuild Projection/, 'the stale-projection recovery command must be an icon/text scheduler control');
assert.match(page, /function projectionNeedsRebuild\(s\)\{return s\.projection_status==='stale_staffing_change'\|\|s\.projection_status==='missing';\}/, 'the recovery command is limited to stale or missing projections');
assert.match(page, /rebuild_projection_btn\.hidden=!s\.current_publication\|\|!projectionNeedsRebuild\(s\)/, 'the recovery command remains hidden whenever the projection is current');
assert.match(page, /async function rebuildCurrentProjection\(\)\{[\s\S]*\/static-weekly\/rebuild-current-projection[\s\S]*await refreshSnapshot\(\)/, 'the explicit rebuild command must refresh the coherent snapshot after recovery');
assert.match(page, /function displayAssignments\(s\)\{if\(projectionNeedsRebuild\(s\)\)return\[\]/, 'stale or missing assignments must never be displayed as current');
assert.match(page, /new_employee_name:replacementName|body\.new_employee_name=replacementName/, 'one replacement action must send the new employee name through the atomic backend transaction');
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
