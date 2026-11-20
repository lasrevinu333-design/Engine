import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './operations-dashboard-tests.mjs';

const stamp='2026-10-05T17:00:00Z';
const response=value=>({ok:true,json:async()=>value});
const gate=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return{promise,release};};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const operations=({city=[],events=[],schools=[]}={})=>({ok:true,data:{schema:'custodial.operations-board.v1',timezone:'America/Chicago',generated_at:stamp,events,
 manager_on_duty:{schema:'custodial.manager-on-duty.v1',state:'confirmed',service_date:'2026-10-05',manager_id:null,name:'Eric McKenney'},
 schools:{state:'current',generated_at:stamp,rows:schools},city:{state:'current',coverage:'city_active_zoo',generated_at:stamp,rows:city},
 spiceworks_activity:{state:'snapshot',coverage:'imported_only',mailbox_completeness_verified:false,generated_at:stamp,rows:[]}}});
const attendance={ok:true,data:{attendance:12,stale:false,source_timestamp:stamp}};
const weather={current:{time:Date.parse(stamp)/1000,temperature_2m:64},current_units:{temperature_2m:'°F'}};
const fetchFor=value=>async url=>response(url.endsWith('/operations')?value:url.includes('attendance')?attendance:weather);

for(const audience of ['manager','public_readonly']){
 test(`${audience}: initial and deferred boxes say loading without claiming unavailable or empty`,async()=>{
  const f=fixture({audience}),wait=gate();
  try{
   for(const id of ['ops-city-ticker','ops-events-ticker','ops-schools-ticker','ops-tickets-ticker','ops-spiceworks-ticker','ops-mod','ops-attendance','ops-weather','ops-events-next-title','ops-schools-next-title']){
    assert.match(f.text(f.elements[id]),/Loading/);assert.doesNotMatch(f.text(f.elements[id]),/unavailable|No upcoming|No open/i);
   }
   assert.equal(f.elements['ops-locations-ticker'].children.length,47,'all approved locations stay visible');
   f.controller.openBoard('city');assert.match(f.elements['operations-board-note'].textContent,/Loading city work orders…/);
   assert.doesNotMatch(f.text(f.content),/No active|unavailable/i);
   const run=f.controller.refresh({summary:{open_tickets:[]},isCurrent:()=>true,fetchImpl:async url=>{if(url.endsWith('/operations'))await wait.promise;return fetchFor(operations())(url);}});
   await turn();assert.equal(f.elements['ops-attendance'].textContent,'12');assert.equal(f.elements['ops-mod'].textContent,'Loading…');
   assert.match(f.text(f.elements['ops-city-ticker']),/Loading city work orders/);
   wait.release();await run;
   assert.equal(f.elements['ops-mod'].textContent,'Eric McKenney');
   assert.match(f.text(f.elements['ops-city-ticker']),/0 Zoo work orders/);
   assert.match(f.text(f.elements['ops-events-ticker']),/No upcoming events loaded/);
   assert.match(f.text(f.elements['ops-schools-ticker']),/No upcoming school visits loaded/);
   assert.equal(f.elements['ops-events-next-title'].textContent,'No upcoming events loaded');assert.equal(f.elements['ops-schools-next-title'].textContent,'No upcoming school visits loaded');
   for(const kind of ['events','schools']){assert.equal(f.elements['ops-'+kind+'-next'].dataset.state,'empty');assert.equal(f.elements['ops-'+kind+'-next-headcount'].textContent,'');}
   assert.doesNotMatch(f.elements['ops-source-status'].textContent,/loading|Updating/i);
  }finally{wait.release();f.clean();}
 });
 test(`${audience}: real request failure ends loading and retains truthful unavailable states`,async()=>{
  const f=fixture({audience});try{
   await f.controller.refresh({isCurrent:()=>true,summary:null,fetchImpl:async()=>{throw Error('Actual synthetic network failure');}});
   for(const id of ['ops-city-ticker','ops-events-ticker','ops-schools-ticker','ops-tickets-ticker','ops-spiceworks-ticker','ops-mod','ops-attendance','ops-weather']){
    assert.match(f.text(f.elements[id]),/unavailable/i);assert.doesNotMatch(f.text(f.elements[id]),/Loading|No upcoming|0 Zoo/);
   }
   for(const kind of ['city','events','schools','tickets']){
    f.controller.openBoard(kind);assert.match(f.elements['operations-board-note'].textContent,/unavailable/i);f.controller.closeBoard();
   }
   for(const kind of ['events','schools']){assert.equal(f.elements['ops-'+kind+'-next'].dataset.state,'unavailable');assert.match(f.elements['ops-'+kind+'-next-title'].textContent,/unavailable/i);assert.equal(f.elements['ops-'+kind+'-next-headcount'].textContent,'');}
   assert.doesNotMatch(f.elements['ops-source-status'].textContent,/loading|Updating/i);
  }finally{f.clean();}
 });
 test(`${audience}: refreshing and failure keep records/scroll and explicitly label last received data`,async()=>{
  const f=fixture({audience}),wait=gate();
  const data=operations({city:[{id:'1',work_order_id:'101',facility:'15Z05 Birdhouse',status:'Approved',description:'Original repair'}]});
  try{
   await f.controller.refresh({isCurrent:()=>true,summary:{open_tickets:[]},fetchImpl:fetchFor(data)});
   const track=f.elements['ops-city-ticker'],original=track.children[0];f.controller.openBoard('city');f.content.scrollTop=99;
   const run=f.controller.refresh({isCurrent:()=>true,preserveSummary:true,fetchImpl:async()=>{await wait.promise;throw Error('Failed update');}});
   assert.equal(track.children[0],original);assert.equal(f.content.scrollTop,99);
   assert.match(f.elements['ops-source-status'].textContent,/Updating.*last received/i);
   assert.match(f.elements['operations-board-note'].textContent,/Updating.*last received/i);
   wait.release();await run;
   assert.equal(track.children[0],original);assert.match(f.elements['operations-board-note'].textContent,/Update delayed.*last received/i);
   assert.equal(f.elements['ops-mod'].textContent,'Unavailable','a failed refresh cannot retain the manager as current');
   assert.match(f.elements['ops-attendance-note'].textContent,/Update delayed/);
  }finally{wait.release();f.clean();}
 });
 test(`${audience}: obsolete response cannot finish a replacement request's loading state`,async()=>{
  const f=fixture({audience}),old=gate(),next=gate();try{
   const a=f.controller.refresh({isCurrent:()=>true,summary:{open_tickets:[]},fetchImpl:async()=>{await old.promise;return response(operations());}});
   const b=f.controller.refresh({isCurrent:()=>true,summary:{open_tickets:[]},fetchImpl:async url=>{await next.promise;return fetchFor(operations())(url);}});
   old.release();await a;assert.equal(f.elements['ops-mod'].textContent,'Loading…');assert.match(f.text(f.elements['ops-city-ticker']),/Loading/);
   next.release();await b;assert.equal(f.elements['ops-mod'].textContent,'Eric McKenney');
  }finally{old.release();next.release();f.clean();}
 });
 test(`${audience}: malformed success remains a failure, never successful empty`,async()=>{
  const f=fixture({audience});try{
   await f.controller.refresh({isCurrent:()=>true,summary:{open_tickets:[]},fetchImpl:fetchFor({ok:true,data:{schema:'wrong'}})});
   assert.match(f.text(f.elements['ops-city-ticker']),/unavailable/i);assert.match(f.text(f.elements['ops-events-ticker']),/unavailable/i);
   assert.doesNotMatch(f.text(f.elements['ops-city-ticker']),/0 Zoo|Loading/);assert.equal(f.elements['ops-mod'].textContent,'Unavailable');
  }finally{f.clean();}
 });
}
