import assert from 'node:assert/strict';
import { createMessageHistory } from '../mobile/src/chatscope/message-history.mjs';
const id=n=>`dd000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const row=n=>({id:id(n),body:`message ${n}`,sent_at:'2026-10-31T12:00:00.123456Z',updated_at:'2026-10-31T12:00:00.123456Z',is_deleted:false});
const all=Array.from({length:401},(_,i)=>row(i+1));let passed=0;
function check(name,run){run();passed++;console.log('PASS '+name);}
check('401 messages with tied timestamps traverse strictly by timestamp and ID',()=>{
 const h=createMessageHistory();h.latest(all.slice(-200));assert.equal(h.rows().length,200);assert.equal(h.cursor().before_id,id(202));
 h.older(all.slice(1,201),h.cursor());assert.equal(h.rows().length,400);assert.equal(h.cursor().before_id,id(2));
 h.older(all.slice(0,1),h.cursor());assert.equal(h.rows().length,401);assert.equal(h.hasOlder(),false);assert.deepEqual(h.rows().map(r=>r.id),all.map(r=>r.id));
});
check('latest refresh and overlap cannot discard older pages or duplicate messages',()=>{
 const h=createMessageHistory();h.latest(all.slice(-200));h.older(all.slice(0,202),h.cursor());h.latest(all.slice(-200));assert.equal(h.rows().length,401);assert.equal(new Set(h.rows().map(r=>r.id)).size,401);
});
check('deletion and newer revision beat a delayed older page, at microsecond precision',()=>{
 const h=createMessageHistory();h.latest(all.slice(-200));const cursor=h.cursor();
 h.updates([{...row(1),is_deleted:true,updated_at:'2026-10-31T12:00:00.123458Z'},{...row(2),body:'revised',updated_at:'2026-10-31T12:00:00.123457Z'}]);
 h.older(all.slice(0,201),cursor);assert.equal(h.rows().some(r=>r.id===id(1)),false);assert.equal(h.rows().find(r=>r.id===id(2)).body,'revised');
 h.latest([row(1)]);assert.equal(h.rows().some(r=>r.id===id(1)),false);
});
check('an obsolete overlapping page cannot move the backward cursor forward',()=>{
 const h=createMessageHistory();h.latest(all.slice(-200));const cursor=h.cursor();h.older(all.slice(1,201),cursor);const next=h.cursor();h.older(all.slice(100,202),cursor);assert.deepEqual(h.cursor(),next);
});
check('historical updates do not create a hole in the loaded message range',()=>{
 const h=createMessageHistory();h.latest(all.slice(-200));h.updates([row(1)]);assert.equal(h.rows().length,200);assert.equal(h.cursor().before_id,id(202));
 h.updates([{...row(402),sent_at:'2026-10-31T12:00:01Z',updated_at:'2026-10-31T12:00:01Z'}]);assert.equal(h.rows().length,201);
});
check('a complete 200-row final page permits one empty read then stops',()=>{
 const h=createMessageHistory();h.latest(all.slice(0,200));assert.equal(h.hasOlder(),true);h.older([],h.cursor());assert.equal(h.hasOlder(),false);assert.equal(h.rows().length,200);
});
console.log(JSON.stringify({scope:'Pure retained history merge/cursors; actual caller race test separately required',passed,failed:0}));
