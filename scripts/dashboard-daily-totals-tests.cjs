const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../operations-dashboard-data.js');
const now=Date.parse('2026-11-12T22:00:00Z');
const event=(id,n,extra={})=>({id,date:'2026-11-12',status:'SCHEDULED',attendees:n,...extra});
const school=(id,n,extra={})=>({id,date:'2026-11-12',status:'SCHEDULED',students:n,adults:5,unclassified:0,...extra});
const run=(events=[],rows=[],extra={})=>D.dailyExpected({events,schools:{state:'current',rows},...extra},now);
test('separate whole-day totals; earlier events retained',()=>{const r=run([event('a',10,{end_at:'2026-11-12T17:00:00Z'}),event('b',20)],[school('s',30)]);assert.equal(r.events.value,'30');assert.equal(r.schools.value,'35');});
test('exclude future/past/cancelled/superseded',()=>assert.equal(run([event('a',9,{date:'2026-11-13'}),event('b',8,{status:'CANCELLED'}),event('c',5,{date:'2026-11-11'}),event('d',3,{status:'SUPERSEDED'})]).events.value,'0'));
test('unavailable is unknown not zero',()=>{const r=D.dailyExpected(null,now);assert.equal(r.events.value,'Unknown');assert.equal(r.schools.value,'Unknown');});
test('missing count not zero',()=>assert.equal(run([event('a',20),event('b',null)]).events.value,'20 known · incomplete'));
test('duplicates once; conflicting duplicates flagged',()=>{const a=event('a',20);assert.equal(run([a,a]).events.value,'20');assert.match(run([a,event('a',21)]).events.value,/incomplete/);});
test('school unidentified quantities not treated as people',()=>assert.match(run([],[school('a',20,{unclassified:3})]).schools.value,/incomplete/));
test('multiday allocation unavailable',()=>assert.match(run([event('a',100,{date:'2026-11-11',end_date:'2026-11-13'})]).events.value,/Unknown/));
test('source-review rows cannot make exact total',()=>assert.match(run([event('a',20,{needs_review:true})]).events.value,/Unknown/));
test('Central date across UTC midnight',()=>assert.equal(D.dailyExpected({events:[event('a',20)]},Date.parse('2026-11-13T01:00:00Z')).events.value,'20'));
test('snapshot visibly qualified',()=>assert.match(run([],[],{schools:{state:'snapshot',rows:[]}}).schools.note,/freshness unverified/));
test('both page families contain distinct labelled fields within telemetry',()=>{const fs=require('node:fs');for(const name of ['operations-dashboard.html','ops-viewer.html']){const s=fs.readFileSync(__dirname+'/../'+name,'utf8');for(const id of ['ops-schools-expected','ops-events-expected']){assert.equal(s.split('id="'+id+'"').length,2);assert.ok(s.indexOf('id="'+id+'"')<s.indexOf('</header>',s.indexOf('<header class="telemetry')));}}});

test('reversed event date range is incomplete not zero',()=>assert.match(run([event('a',50,{end_date:'2026-11-11'})]).events.value,/Unknown.*incomplete/));
