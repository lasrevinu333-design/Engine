import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../events-admin.html', import.meta.url), 'utf8');

function notContains(label, needle) {
  assert.equal(html.includes(needle), false, `${label}: should not contain ${needle}`);
}

function contains(label, needle) {
  assert.equal(html.includes(needle), true, `${label}: should contain ${needle}`);
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

const saveIndex = html.indexOf('async function saveEvent()');
const removeIndex = html.indexOf('removeSelectedImportRow();');
assert.ok(saveIndex >= 0 && removeIndex > saveIndex, 'saveEvent should remove the selected import row after a successful post');

const renderIndex = html.indexOf('function renderImportPreview');
const selectHandlerIndex = html.indexOf('window.__selectImportRow');
assert.ok(renderIndex >= 0 && selectHandlerIndex > renderIndex, 'import preview should expose row selection handler');

console.log('events-admin import UI contract tests passed');
