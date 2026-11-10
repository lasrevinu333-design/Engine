import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture} from './operations-dashboard-tests.mjs';
const require=createRequire(import.meta.url),V=require('../ops-viewer.js'),D=require('../operations-dashboard-data.js');
const context={module:{exports:{}}};vm.runInNewContext(readFileSync(new URL('../dashboard-map-renderer.js',import.meta.url),'utf8'),context);
const {createPublicRefreshGate,createRefreshGate}=context.module.exports;
const summary={meta:{audience:'public_readonly',contracts:{dashboard:'dashboard.v1'},generated_at:'2026-11-09T18:00:00Z'},restrooms:[],exhibits:[],open_tickets:[]};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('public map refresh owns its generation and cannot accept old or suspended results; manager gate still requires identity',()=>{
 const results=[],gate=createPublicRefreshGate({onState:(...args)=>results.push(args)});
 const first=gate.begin(),second=gate.begin();assert.equal(gate.commit(first,summary),false);assert.equal(gate.commit(second,summary),true);
 gate.suspend();assert.equal(gate.commit(second,summary),false);assert.equal(gate.begin(),null);gate.resume();assert.equal(gate.commit(second,summary),false);
 const next=gate.begin();gate.close();assert.equal(gate.commit(next,summary),false);
 assert.throws(()=>createRefreshGate({readSession:()=>null,onState(){}}),/active named manager/);
});
test('public operational boards never read manager credentials or send authorization, and Events opens read-only in place',async()=>{
 const f=fixture({audience:'public_readonly'}),calls=[];
 f.window.MemphisAuth={readSession(){assert.fail('public board must not read manager identity');}};
 try{
  await f.controller.refresh({headers:{Authorization:'DO_NOT_SEND'},isCurrent:()=>true,summary,fetchImpl:async(url,options)=>{
   calls.push({url,options});return{ok:true,json:async()=>url.endsWith('/operations')?{ok:true,data:{schema:'custodial.operations-board.v1',generated_at:summary.meta.generated_at,timezone:D.ZONE,events:[]}}:null};}});
  assert.equal(calls[0].url,'https://memphis-zoo-mcp.onrender.com/viewer-api/operations');
  for(const call of calls){assert.equal(call.options.method,'GET');assert.equal(call.options.credentials,'omit');assert.equal(call.options.headers,undefined);}
  f.triggers[1].emit('click');assert.equal(f.dialog.open,true);assert.equal(f.navigations.length,0);
 }finally{f.clean();}
});
function pageFixture(){
 const nodes=new Map(),listeners=new Map(),timers=new Set(),timeouts=new Set(),calls=[],accepted=[],pending=[];let id=0;
 const node=key=>{if(!nodes.has(key))nodes.set(key,{hidden:true,value:'',textContent:'',children:[],listeners:new Map(),
  append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},addEventListener(t,fn){this.listeners.set(t,fn);},removeEventListener(t){this.listeners.delete(t);}});return nodes.get(key);};
 const document={hidden:false,getElementById:node,createElement:tag=>node('new-'+tag+(++id))};
 const window={document,addEventListener:(t,fn)=>listeners.set(t,fn),removeEventListener:t=>listeners.delete(t),
  setInterval(fn){timers.add(fn);return fn;},clearInterval:fn=>timers.delete(fn),setTimeout(fn){timeouts.add(fn);return fn;},clearTimeout:fn=>timeouts.delete(fn)};
 Object.defineProperty(window,'MemphisAuth',{get(){assert.fail('public page cannot inspect auth');}});
 const gate=createPublicRefreshGate({onState:(kind,data)=>{if(kind==='current')accepted.push(data);}});
 const map={...gate,beginRefresh:gate.begin,accept:gate.commit,stop:gate.close,async init(){return true;},async resume(){return gate.resume();}};
 const board={activate(){},refresh:async()=>{},unavailable(){},suspend(){},stop(){},tick(){}};
 const response=data=>({ok:true,json:async()=>({ok:true,data})});
 const fetchImpl=async(url,options)=>{calls.push({url,options});if(url.endsWith('/summary'))return pending.length?pending.shift()():response(summary);
  throw Error('Public dashboard must not request schedule or private data');};
 const page=V.create({window,document,fetchImpl,renderer:{create(options){assert.equal(options.auth,undefined);assert.equal(options.audience,'public_readonly');return map;}},boards:{create:()=>board}});
 return{page,nodes,window,listeners,timers,timeouts,calls,accepted,pending,node,clean(){page.stop();assert.equal(timers.size,0);assert.equal(timeouts.size,0);assert.equal(listeners.size,0);}};
}
test('public viewer uses only anonymous summary GETs, omits scheduler reads, and resumes Back without duplicate timers',async()=>{
 const f=pageFixture();try{
  assert.equal(await f.page.init(),true);await flush();assert.equal(f.timers.size,2);assert.equal(f.accepted.length,1);
  assert.equal(f.nodes.has('schedule-date'),false);assert.equal(f.page.schedule,undefined);
  for(let i=0;i<3;i++){f.listeners.get('pagehide')({persisted:true});assert.equal(f.timers.size,0);f.listeners.get('pageshow')({persisted:true});f.listeners.get('pageshow')({persisted:true});await flush();assert.equal(f.timers.size,2);}
  for(const call of f.calls){assert.equal(call.options.method,'GET');assert.equal(call.options.credentials,'omit');assert.equal(call.options.headers,undefined);assert.match(call.url,/\/viewer-api\/summary$/);}
 }finally{f.clean();}
});
test('an old anonymous read cannot overwrite a newer result or publish after page close',async()=>{
 const f=pageFixture();try{
  await f.page.init();await flush();let release;
  f.pending.push(()=>new Promise(resolve=>{release=resolve;}));const first=f.page.refresh();await flush();
  await f.page.refresh();const count=f.accepted.length;release({ok:true,json:async()=>({ok:true,data:summary})});await first;assert.equal(f.accepted.length,count);
  f.pending.push(()=>new Promise(resolve=>{release=resolve;}));const last=f.page.refresh();await flush();f.page.stop();release({ok:true,json:async()=>({ok:true,data:summary})});await last;assert.equal(f.accepted.length,count);
 }finally{f.clean();}
});

test('unavailable public locations retain approved names without claiming live work facts',()=>{
 const f=fixture({audience:'public_readonly'});
 try{
  f.viewport.children[0].dataset.approvedLocationName='West Admin Upstairs Women\'s Restroom';
  f.viewport.children[0].attrs['aria-label']='DO NOT ADOPT stale worker and completion';
  f.controller.unavailable();
  assert.match(f.elements['ops-locations-ticker'].textContent,/West Admin Upstairs Women's Restroom/);
  assert.doesNotMatch(f.elements['ops-locations-ticker'].textContent,/Location location-|DO NOT ADOPT|stale worker/);
  f.triggers[3].emit('click');
  assert.equal(f.content.children[0].dataset.state,'unknown');
  assert.match(f.text(f.content.children[0]),/Current cleaning record unavailable/);
  assert.doesNotMatch(f.text(f.content.children[0]),/DO NOT ADOPT|stale worker/);
 }finally{f.clean();}
});
test('approved names are labels only; untrusted or missing current rows stay unknown',()=>{
 const id='98000000-0000-4000-8000-000000000001',approved=[{id,name:'Approved fixture name'}];
 for(const value of [null,{...summary,meta:{...summary.meta,contracts:{dashboard:'untrusted'}}}]){
  const view=D.publicCleaning(value,approved,Date.parse(summary.meta.generated_at));
  assert.equal(view.cards[0].title,'Approved fixture name');assert.equal(view.cards[0].state,'unknown');
  assert.equal(view.cards[0].lines.some(line=>line.startsWith('Current worker:')),false);
 }
 assert.equal(D.publicCleaning(null,[{id}],Date.now()).cards[0].title,'Location name unavailable');
 const source={...summary,restrooms:[{location_id:id,location_name:'Current source name',status_code:'not_cleaned'}]};
 assert.equal(D.publicCleaning(source,approved,Date.parse(summary.meta.generated_at)).cards[0].title,'Current source name');
});
test('operations skin excludes pins and normal public map owns usable height separately from fullscreen',()=>{
 const css=readFileSync(new URL('../operations-dashboard.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/\.operationsPage button\s*[,\{]/);
 assert.match(css,/\.operationsPage button:not\(\.mzMapPin\),\.operationsPage select/);
 assert.match(css,/\.operationsPage button:not\(\.mzMapPin\)\{min-height:34px/);
 assert.match(css,/\.operationsPage \.commandPage\.mapPage\{height:auto;min-height:100dvh/);
 assert.match(css,/\.commandMap:not\(:fullscreen\):not\(\.is-expanded\)\{flex:none/);
 assert.match(css,/\.commandMap:not\(:fullscreen\):not\(\.is-expanded\) \.mzMapViewport\{height:clamp\(280px,40vw,760px\);min-height:280px/);
 assert.match(css,/\.commandMap:fullscreen,\.commandMap\.is-expanded\{[^}]*height:100dvh/);
});

test('both dashboard documents restore one Activity band and horizontal map without embedded scheduler',()=>{
 for(const name of ['ops-viewer.html','operations-dashboard.html']){
  const html=readFileSync(new URL('../'+name,import.meta.url),'utf8');
  assert.equal((html.match(/data-board="activity"/g)||[]).length,1);
  assert.match(html,/ACTIVITY/);assert.doesNotMatch(html,/data-board="(?:tickets|events|schools)"/);
  assert.match(html,/data-map-presentation="original-horizontal"/);
  assert.doesNotMatch(html,/public-schedule|schedule-date|schedule-roster|schedule-assignments/);
 }
});
test('one public Activity board combines real sources and reports unavailable feeds without invented rows',async()=>{
 const f=fixture({audience:'public_readonly'});try{
  f.triggers[4].emit('click');assert.equal(f.dialog.open,true);assert.equal(f.elements['operations-board-title'].textContent,'Activity');
  assert.match(f.elements['ops-activity-ticker'].textContent,/TICKETS:.*EVENTS:.*SCHOOLS:/);
  assert.match(f.elements['operations-board-note'].textContent,/unavailable/);
  assert.equal(f.navigations.length,0);
 }finally{f.clean();}
});
