import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eventsHtml = await readFile(path.join(repoRoot, 'events.html'), 'utf8');

assert.doesNotMatch(
  eventsHtml,
  /event\.notes|notesValue|<div class="headerCell">Notes<\/div>/,
  'the public event board must not render internal event notes',
);

// The HTML now loads the shared renderer. Exercise its actual public
// projection rather than requiring obsolete inline field names.
assert.match(eventsHtml, /src="\.\/events-view\.js/);
const require=createRequire(import.meta.url),data=require('../operations-dashboard-data.js');
const view=await readFile(path.join(repoRoot,'events-view.js'),'utf8');
assert.match(view,/const v=data\.events\(feed\.rows,now\(\)\)/);
assert.match(view,/node\('h3',c\.title\)/);
assert.match(view,/for\(const line of c\.lines\)a\.append\(node\('p',line\)\)/);
const row={id:'11111111-1111-4111-8111-111111111111',revision:1,name:'PUBLIC_EVENT',location:'PUBLIC_LOCATION',
 date:'2026-11-02',start_time:'09:30',end_time:'10:30',attendees:42,status:'SCHEDULED',
 notes:'PRIVATE_INTERNAL_NOTE',source_mail:'PRIVATE_SOURCE_MAIL',raw_email:'PRIVATE_RAW_EMAIL',
 requirements:['Approved public setup'],custodial_notes:'Approved operational guidance'};
const projection=data.events([row],Date.parse('2026-11-01T12:00:00Z'));
const shown=JSON.stringify(projection);
for(const value of ['PUBLIC_EVENT','PUBLIC_LOCATION','2026-11-02','9:30 a.m. Central','42','Approved public setup','Approved operational guidance'])assert.ok(shown.includes(value),'Public operational field: '+value);
for(const value of ['PRIVATE_INTERNAL_NOTE','PRIVATE_SOURCE_MAIL','PRIVATE_RAW_EMAIL'])assert.ok(!shown.includes(value),'Private source field must not render: '+value);
assert.doesNotMatch(view,/node\([^\n]*r\.(?:notes|source_mail|raw_email)/);

console.log('public event privacy contract tests passed');
