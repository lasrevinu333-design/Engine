import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eventsHtml = await readFile(path.join(repoRoot, 'events.html'), 'utf8');

assert.doesNotMatch(
  eventsHtml,
  /event\.notes|notesValue|<div class="headerCell">Notes<\/div>/,
  'the public event board must not render internal event notes',
);

for (const publicField of [
  'event.event_name',
  'event.display_location',
  'event.event_date',
  'event.start_time',
  'event.attendee_count',
]) {
  assert.match(eventsHtml, new RegExp(publicField.replace('.', '\\.')));
}

console.log('public event privacy contract tests passed');
