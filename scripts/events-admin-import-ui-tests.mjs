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

notContains('review label removed', 'Needs Review');
notContains('repair-all flow removed', 'Repair All Review Rows');
notContains('bulk ready import removed', 'Import Ready Rows');
notContains('good-only checkbox removed', 'Import only rows marked ready');
notContains('needs_review state removed', 'needs_review');
notContains('imported badge list state removed', 'Imported</');

contains('simple import copy', 'Import Spreadsheet');
contains('queue copy', 'Imported Rows');
contains('select row CTA', 'Parse Into Form');
contains('selected import row state', 'selectedImportRowId');
contains('save removes selected imported row', 'removeSelectedImportRow');
contains('smooth button busy helper', 'setButtonBusy');
contains('loading spinner style', 'btnSpinner');
contains('pressed/busy button style', 'isBusy');
contains('import file loading text', 'Importing…');
contains('save loading text', 'Saving…');
contains('bare attendee-count helper', 'detectBareAttendeeCount');
contains('spreadsheet source-text helper', 'buildSpreadsheetSourceText');
contains('raw event text preferred', "'raw event text'");
contains('snake-case raw event text preferred', "'raw_event_text'");
contains('event area display helper', 'eventAreaDisplayName');
contains('Splash Pad restroom group displayed as event area', "Splash Pad");
contains('Courtyard restroom group displayed as event area', "Courtyard");
contains('known area display avoids restroom label', 'next.location_group_name=eventAreaDisplayName(known.group_name||known.group_code||next.location_group_name)');
contains('detected area display avoids restroom label', 'next.location_group_name=eventAreaDisplayName(areaInfo.group.group_name||areaInfo.group.group_code||next.location_group_name)');
contains('event list display avoids restroom label', "eventAreaDisplayName(e.group_name||e.group_code||'Unknown Area')");
contains('spreadsheet copy mentions legacy xls', 'Upload .xlsx, .xls, or .csv');
contains('invalid attendee count validates before save', 'attendee count must be a whole number');
contains('reset form clears selected import row', 'state.selectedImportRowId=null;renderImportPreview(state.parsedImportRows);');
contains('quick paste clears stale import preview', 'state.selectedImportRowId=null;renderImportPreview(state.parsedImportRows);loadPayloadIntoForm(payload);');
contains('startup preserves area-load failures', 'state.eventAreasLoadFailed');
contains('safe area token matcher prevents PP in happy', 'matchesLocationAlias');
notContains('event name paste must not auto-parse whole form', "els.eventName.addEventListener('paste'");
notContains('mobile pinch zoom must stay available', 'user-scalable=no');
eventsContains('public events display helper', 'eventAreaDisplayName');
eventsContains('public events display avoids restroom label', "eventAreaDisplayName(event.group_name||event.group_code||'Unknown Area')");

const saveIndex = html.indexOf('async function saveEvent()');
const removeIndex = html.indexOf('removeSelectedImportRow();');
assert.ok(saveIndex >= 0 && removeIndex > saveIndex, 'saveEvent should remove the selected import row after a successful post');

const renderIndex = html.indexOf('function renderImportPreview');
const selectHandlerIndex = html.indexOf('window.__selectImportRow');
assert.ok(renderIndex >= 0 && selectHandlerIndex > renderIndex, 'import preview should expose row selection handler');

console.log('events-admin import UI contract tests passed');
