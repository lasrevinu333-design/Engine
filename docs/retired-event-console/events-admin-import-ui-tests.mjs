import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../events-admin.html', import.meta.url), 'utf8');
const eventsHtml = readFileSync(new URL('../events.html', import.meta.url), 'utf8');

function notContains(label, needle) {
  assert.equal(html.includes(needle), false, `${label}: should not contain ${needle}`);
}

function contains(label, needle) {
  assert.equal(html.includes(needle), true, `${label}: should contain ${needle}`);
}

function eventsContains(label, needle) {
  assert.equal(eventsHtml.includes(needle), true, `${label}: events.html should contain ${needle}`);
}

notContains('repair-all flow removed', 'Repair All Review Rows');
notContains('bulk ready import removed', 'Import Ready Rows');
notContains('good-only checkbox removed', 'Import only rows marked ready');
notContains('imported badge list state removed', 'Imported</');
notContains('old parsed area label removed', 'Parsed Event Area');
notContains('old event area display helper removed', 'eventAreaDisplayName');
notContains('old PC invite wording not present in event console', 'Generate PC Invite');
notContains('old phone invite wording not present in event console', 'Generate Phone Invite');

contains('simple import copy', 'Import Spreadsheet');
contains('queue copy', 'Imported Rows');
contains('select row CTA', 'Parse Into Form');
contains('selected import row state', 'selectedImportRowId');
contains('source text intake', 'Quick Paste Intake');
contains('event scope control', 'Event Scope');
contains('event scope option zoo-wide', 'Zoo-wide / Zoo Footprint');
contains('event venue control', 'Event Venue');
contains('event venue excludes restrooms hint', 'Restrooms are intentionally excluded');
contains('coverage location control', 'Custodial Coverage Locations');
contains('coverage separation hint', 'Coverage locations are cleaning/service targets and do not replace Event Location');
contains('normalized preview label', 'Normalized Preview Before Save');
contains('backend parser route', '/parse-ai');
contains('event venues endpoint', '/event-venues');
contains('coverage endpoint', '/coverage-locations');
contains('canonical event_scope payload', 'event_scope');
contains('canonical primary venue payload', 'primary_venue_id');
contains('canonical venue_ids payload', 'venue_ids');
contains('canonical display location payload', 'display_location');
contains('canonical coverage payload', 'coverage_location_ids');
contains('needs review validation retained', 'needs_review');
contains('zoo-wide language helper', 'hasZooWideLanguage');
contains('zoo-wide validation', 'zoo-wide events must display Zoo Footprint');
contains('restroom coverage is separate validation', 'coverage locations must not overwrite the event venue');
contains('save loading text', 'Saving…');
contains('server normalized rows loaded into form', 'normalizeParsedPayload');
contains('spreadsheet copy mentions legacy xls', 'Upload .xlsx, .xls, or .csv');
contains('invalid attendee count validates before save', 'attendance must be a whole number');
contains('reset form clears selected import row', 'state.selectedImportRowId = null;');
contains('startup preserves area-load failures', 'state.eventAreasLoadFailed');
contains('unknown scope blocks save', 'select Zoo Footprint, Offsite, or an eligible event venue before saving');
notContains('event name paste must not auto-parse whole form', "els.eventName.addEventListener('paste'");
notContains('mobile pinch zoom must stay available', 'user-scalable=no');
eventsContains('public events display helper', 'eventLocationDisplayName');
eventsContains('public events prefers canonical display location', 'event.display_location||event.venue_name||event.group_name||event.group_code');
eventsContains('public events label says Event Location', 'Event Location');

const saveIndex = html.indexOf('async function saveEvent()');
const loadEventsIndex = html.indexOf('await loadEvents();', saveIndex);
const resetIndex = html.indexOf('resetForm(false);', saveIndex);
assert.ok(saveIndex >= 0 && loadEventsIndex > saveIndex && resetIndex > loadEventsIndex, 'saveEvent should reload authoritative events then reset the form after save');

const renderIndex = html.indexOf('function renderImportPreview');
const selectHandlerIndex = html.indexOf('data-import-id');
assert.ok(renderIndex >= 0 && selectHandlerIndex > renderIndex, 'import preview should render row selection buttons');

const apiReadyIndex = html.indexOf('const api =');
const initCallIndex = html.indexOf('init().catch');
assert.ok(apiReadyIndex >= 0 && initCallIndex < apiReadyIndex, 'startup init is declared before API helpers but runs asynchronously after script functions are defined');

console.log('events-admin import UI contract tests passed');
