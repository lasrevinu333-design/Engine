import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),D=require('../operations-dashboard-data.js');
const now=Date.parse('2026-11-19T14:00:00Z'); // 8 a.m. Chicago, independent of host timezone.
const event=(id,start,extra={})=>({id,name:id,date:'2026-11-19',start_at:start,end_at:'2026-11-19T23:00:00Z',status:'SCHEDULED',attendees:25,...extra});
const school=(id,start,extra={})=>({id,name:id,date:'2026-11-19',arrival_at:start,status:'SCHEDULED',students:40,adults:10,unclassified:0,...extra});
test('next fixed event follows actual Chicago start order, excluding already begun and ended/cancelled/review rows',()=>{
 const rows=[event('later','2026-11-19T18:00:00Z'),event('cancelled','2026-11-19T14:01:00Z',{status:'CANCELLED'}),event('past','2026-11-19T13:00:00Z'),event('review','2026-11-19T14:01:00Z',{needs_review:true}),event('next','2026-11-19T15:00:00Z')],before=JSON.stringify(rows);
 const next=D.nextScheduled({events:rows},'events',now);assert.equal(next.id,'next');assert.match(next.when,/Today, Thursday, November 19.*9:00 AM CST/);assert.equal(next.headcount,'25 planned people');assert.equal(JSON.stringify(rows),before);
});
test('UTC date rollover is classified using Chicago date and explicit offsets',()=>{
 const at=Date.parse('2026-11-20T05:45:00Z'); // Nov19 11:45 p.m.
 const rows=[event('tomorrow','2026-11-20T06:30:00Z',{date:'2026-11-20',end_at:'2026-11-20T08:00:00Z'}),event('tonight','2026-11-20T05:50:00Z',{end_at:'2026-11-20T05:59:00Z'})];
 assert.equal(D.nextScheduled({events:rows},'events',at).id,'tonight');assert.match(D.nextScheduled({events:rows},'events',at).when,/Today, Thursday, November 19.*11:50 PM CST/);
 assert.equal(D.nextScheduled({events:rows},'events',Date.parse('2026-11-20T06:01:00Z')).id,'tomorrow');
});
test('fall-back repeated hour sorts by actual instant and spring daylight time uses CDT',()=>{
 const rows=[event('second','2026-11-01T01:30:00-06:00',{date:'2026-11-01',end_at:'2026-11-01T10:00:00Z'}),event('first','2026-11-01T01:30:00-05:00',{date:'2026-11-01',end_at:'2026-11-01T10:00:00Z'})];
 assert.equal(D.nextScheduled({events:rows},'events',Date.parse('2026-11-01T06:00:00Z')).id,'first');
 assert.equal(D.nextScheduled({events:rows},'events',Date.parse('2026-11-01T06:45:00Z')).id,'second');
 const spring=event('spring','2026-03-08T08:30:00Z',{date:'2026-03-08',end_at:'2026-03-08T10:00:00Z'});assert.match(D.nextScheduled({events:[spring]},'events',Date.parse('2026-03-08T08:00:00Z')).when,/3:30 AM CDT/);
});
test('local Central wall times and unknown times remain comparable without fabricated UTC',()=>{
 const rows=[event('unknown',null),event('local',null,{start_time:'09:00'}),event('instant','2026-11-19T16:00:00Z')];
 assert.equal(D.nextScheduled({events:rows},'events',now).id,'local');assert.match(D.nextScheduled({events:rows},'events',now).when,/9:00 a.m. Central/);
 assert.equal(D.nextScheduled({events:[rows[0]]},'events',now).when.endsWith('Time not provided'),true);
});
test('school selection skips elapsed arrivals, sorts Chicago dates and times, and preserves incomplete counts',()=>{
 const rows=[school('late','2026-11-19T18:00:00Z'),school('passed','2026-11-19T13:30:00Z'),school('next','2026-11-19T15:00:00Z',{unclassified:3})];
 const next=D.nextScheduled({schools:{state:'snapshot',rows}},'schools',now);assert.equal(next.id,'next');assert.equal(next.headcount,'50 known people · count incomplete');assert.match(next.when,/9:00 AM CST.*Imported schedule/);
});
test('fixed school selection applies the full board arrival/departure source-review guard',()=>{
 const valid=school('valid-next','2026-11-19T16:00:00Z');
 for(const extra of [{arrival_at:null},{arrival_at:'bad'},{arrival_at:'2026-11-20T15:00:00Z'},{departure_at:'2026-11-19T18:00:00Z'},{departure_source:''}]){
  const invalid=school('invalid-first','2026-11-19T15:00:00Z',extra),feed={state:'current',rows:[invalid,valid]},before=JSON.stringify(feed);
  assert.equal(D.schools(feed,now).cards.find(row=>row.id==='invalid-first').state,'REVIEW_REQUIRED');
  assert.equal(D.nextScheduled({schools:feed},'schools',now).id,'valid-next');
  assert.equal(D.nextScheduled({schools:{...feed,rows:[invalid]}},'schools',now).state,'review');
  assert.equal(JSON.stringify(feed),before);
 }
});
test('mixed local and timestamp starts preserve seconds, exact expiry and stable equal-time ties',()=>{
 const earlier=event('z-instant-earlier','2026-11-19T15:00:10Z'),later=event('a-local-later',null,{start_time:'09:00:50'});
 for(const rows of [[later,earlier],[earlier,later]]){
  assert.equal(D.nextScheduled({events:rows},'events',now).id,'z-instant-earlier');
  assert.equal(D.nextScheduled({events:rows},'events',Date.parse('2026-11-19T15:00:10Z')).id,'z-instant-earlier');
  assert.equal(D.nextScheduled({events:rows},'events',Date.parse('2026-11-19T15:00:11Z')).id,'a-local-later');
 }
 const localEarlier=event('z-local-earlier',null,{start_time:'09:00:05'});
 assert.equal(D.nextScheduled({events:[later,localEarlier]},'events',now).id,'z-local-earlier');
 assert.equal(D.nextScheduled({events:[earlier,event('a-equal-local',null,{start_time:'09:00:10'})]},'events',now).id,'a-equal-local');
});
test('ambiguous fall-back local time is reviewed and mixed representations cannot change order by feed permutation',()=>{
 const extra={date:'2026-11-01',end_at:'2026-11-01T12:00:00Z'},a=event('first','2026-11-01T01:45:00-05:00',extra),b=event('second','2026-11-01T01:15:00-06:00',extra),c=event('ambiguous',null,{...extra,start_time:'01:30'});
 const permutations=[[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]];
 for(const rows of permutations){
  assert.equal(D.nextScheduled({events:rows},'events',Date.parse('2026-11-01T05:00:00Z')).id,'first');
  assert.equal(D.nextScheduled({events:rows},'events',Date.parse('2026-11-01T07:00:00Z')).id,'second');
 }
 assert.equal(D.nextScheduled({events:[c]},'events',Date.parse('2026-11-01T05:00:00Z')).state,'review');
 const unique=event('after-fallback',null,{...extra,start_time:'02:15'});
 assert.equal(D.nextScheduled({events:[unique]},'events',Date.parse('2026-11-01T08:14:59Z')).id,'after-fallback');
 assert.equal(D.nextScheduled({events:[unique]},'events',Date.parse('2026-11-01T08:15:01Z')).state,'empty');
});
test('spring gap local time needs review while valid Central local starts compare with actual instants',()=>{
 const extra={date:'2026-03-08',end_at:'2026-03-08T15:00:00Z'},gap=event('gap',null,{...extra,start_time:'02:30'}),local=event('later',null,{...extra,start_time:'03:30'}),earlier=event('earlier','2026-03-08T08:15:00Z',extra),at=Date.parse('2026-03-08T07:00:00Z');
 assert.equal(D.nextScheduled({events:[gap]},'events',at).state,'review');
 assert.equal(D.nextScheduled({events:[local,earlier,gap]},'events',at).id,'earlier');
 assert.equal(D.nextScheduled({events:[local]},'events',Date.parse('2026-03-08T08:30:01Z')).state,'empty');
});
test('zero, unknown counts, invalid time/date, stable ties, cancellation and unavailable/empty are distinct',()=>{
 assert.equal(D.nextScheduled(null,'events',now).state,'unavailable');assert.equal(D.nextScheduled({events:[]},'events',now).state,'empty');
 assert.equal(D.nextScheduled({schools:{state:'unavailable',rows:[]}},'schools',now).state,'unavailable');assert.equal(D.nextScheduled({schools:{state:'current',rows:[]}},'schools',now).state,'empty');
 assert.equal(D.nextScheduled({events:[event('zero','2026-11-19T15:00:00Z',{attendees:0})]},'events',now).headcount,'0 planned people');
 assert.equal(D.nextScheduled({events:[event('unknown','2026-11-19T15:00:00Z',{attendees:null})]},'events',now).headcount,'Headcount not provided');
 assert.equal(D.nextScheduled({schools:{state:'current',rows:[school('x','2026-11-19T15:00:00Z',{adults:null})]}},'schools',now).headcount,'Headcount not provided');
 assert.equal(D.nextScheduled({events:[event('wrong-day','2026-11-20T15:00:00Z')]},'events',now).state,'review');
 assert.equal(D.nextScheduled({events:[event('cancel','2026-11-19T15:00:00Z',{status:'CANCELLED'})]},'events',now).state,'empty');
 const ties=[event('z','2026-11-19T15:00:00Z'),event('a','2026-11-19T15:00:00Z')];assert.equal(D.nextScheduled({events:ties},'events',now).id,'a');
});
test('both dashboard pages remove Expected cards and keep next details inside original board buttons',()=>{
 for(const filename of ['ops-viewer.html','operations-dashboard.html']){
  const html=readFileSync(new URL('../'+filename,import.meta.url),'utf8');assert.doesNotMatch(html,/ops-(?:events|schools)-expected|EVENTS · EXPECTED|GROUPS · EXPECTED/);
  for(const kind of ['events','schools']){assert.equal((html.match(new RegExp('id="ops-'+kind+'-ticker"','g'))||[]).length,1);assert.ok(html.includes('aria-describedby="ops-'+kind+'-next"'));for(const field of ['title','when','headcount'])assert.ok(html.includes('id="ops-'+kind+'-next-'+field+'"'));}
 }
});
