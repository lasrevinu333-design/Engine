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
  return response({service_date:node('schedule-date').value,projection_status:'current',roster:[{employee_name:'<Karen>',shift_start:'07:00',shift_end:'16:00',lunch_start:'11:00',lunch_end:'12:00'}],assignments:[]});};
 const page=V.create({window,document,fetchImpl,renderer:{create(options){assert.equal(options.auth,undefined);assert.equal(options.audience,'public_readonly');return map;}},boards:{create:()=>board}});
 return{page,nodes,window,listeners,timers,timeouts,calls,accepted,pending,node,clean(){page.stop();assert.equal(timers.size,0);assert.equal(timeouts.size,0);assert.equal(listeners.size,0);}};
}
test('public viewer uses only anonymous GETs, renders source names as text, and resumes Back without duplicate timers',async()=>{
 const f=pageFixture();try{
  assert.equal(await f.page.init(),true);await flush();assert.equal(f.timers.size,2);assert.equal(f.accepted.length,1);
  assert.equal(f.node('schedule-roster').children[0].children[0].textContent,'<Karen>');
  for(let i=0;i<3;i++){f.listeners.get('pagehide')({persisted:true});assert.equal(f.timers.size,0);f.listeners.get('pageshow')({persisted:true});f.listeners.get('pageshow')({persisted:true});await flush();assert.equal(f.timers.size,2);}
  for(const call of f.calls){assert.equal(call.options.method,'GET');assert.equal(call.options.credentials,'omit');assert.equal(call.options.headers,undefined);assert.match(call.url,/\/viewer-api\/(summary|schedule)/);}
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
