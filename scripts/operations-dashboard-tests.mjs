import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),D=require('../operations-dashboard-data.js');
const ui=readFileSync(new URL('../operations-dashboard.js',import.meta.url),'utf8');
const noon=Date.parse('2026-10-05T17:00:00Z');
const visit={id:'school-1',name:'Synthetic school',date:'2026-10-05',arrival_at:'2026-10-05T14:30:00Z',departure_at:'2026-10-05T18:00:00Z',departure_source:'owner_policy_13:00_America/Chicago',status:'SCHEDULED',students:50,chaperones:5,teachers:2,adults:7,total:58,unclassified:1,buses:2};
const payload={ok:true,data:{schema:'custodial.operations-board.v1',timezone:D.ZONE,generated_at:'2026-10-05T17:00:00Z',events:[],schools:{state:'unavailable'},spiceworks:{state:'unavailable'}}};
test('operations requires the exact contract and bounded structured feed',()=>{
 assert.equal(D.operations(payload).schools.state,'unavailable');
 for(const change of [{schema:'other'},{timezone:'UTC'},{generated_at:'not-a-time'},{events:null}])assert.throws(()=>D.operations({ok:true,data:{...payload.data,...change}}));
});
test('unknown counts and freshness never become live zero',()=>{
 assert.equal(D.attendance(null).value,'Unavailable');assert.equal(D.attendance({ok:true,data:{attendance:null}}).value,'Unavailable');
 assert.equal(D.attendance({ok:true,data:{attendance:0}}).value,'0');assert.equal(D.attendance({ok:true,data:{attendance:0}}).stale,true);
 assert.match(D.attendance({ok:true,data:{attendance:12}}).note,/unknown/);
 assert.equal(D.attendance({ok:true,data:{attendance:12,stale:false,source_timestamp:'2026-10-05T17:00:00Z'}}).stale,false);
});
test('weather uses real units/times, names stale source, and only the coming hour',()=>{
 const weather={current:{time:noon/1000,temperature_2m:77},current_units:{temperature_2m:'°F'},hourly:{time:[noon/1000+3600],temperature_2m:[79],precipitation_probability:[20]},hourly_units:{temperature_2m:'°F'}};
 assert.equal(D.weather(weather,noon).value,'77°F');assert.match(D.weather(weather,noon).hour,/79°F.*20%/);
 assert.equal(D.weather(weather,noon+3600000).stale,true);assert.match(D.weather(weather,noon+3600000).hour,/unavailable/);
 assert.equal(D.weather({...weather,current_units:{temperature_2m:'°C'}},noon).value,'Unavailable');
});
test('scan ticket removal follows replacement summary; origins remain separate',()=>{
 const summary={open_tickets:[{ticket_id:'12',location_name:'Fixture restroom',maintenance_issue:'Fixture leak'}]};
 const mail={state:'current',rows:[{ticket_id:'12',custodial:true,active:true,status:'Open',title:'Fixture gate'}]};
 const both=D.tickets(summary,mail);assert.deepEqual(both.cards.map(x=>x.source),['Scan session','Spiceworks']);
 assert.equal(D.tickets({open_tickets:[]},mail).cards.length,1);assert.equal(D.tickets({open_tickets:[]},{state:'unavailable'}).cards.length,0);
 assert.equal(D.tickets(null,{state:'current',rows:[{...mail.rows[0],status:'Closed'}]}).cards.length,0);
 assert.match(D.tickets(summary,null).note,/unavailable/);
});
test('imported mail snapshot is visible with explicit unknown freshness/completeness, never live',()=>{
 const snapshot={state:'snapshot',coverage:'imported_only',mailbox_completeness_verified:false,generated_at:'2026-10-05T12:01:00Z',rows:[{ticket_id:'6914',custodial:true,active:true,status:'Open',title:'Synthetic gate'}]};
 const parsed=D.operations({ok:true,data:{...payload.data,spiceworks:snapshot,schools:{...snapshot,rows:[visit]}}});
 assert.equal(parsed.spiceworks.state,'snapshot');const tickets=D.tickets({open_tickets:[]},parsed.spiceworks);
 assert.equal(tickets.cards.length,1);assert.match(tickets.note,/snapshot.*Oct 5/);assert.match(tickets.note,/NOT verified/);
 const schools=D.schools(parsed.schools,noon);assert.equal(schools.cards.length,1);assert.match(schools.note,/snapshot.*NOT verified/);
 const after=D.schools(parsed.schools,Date.parse('2026-10-05T18:00:00Z'));assert.equal(after.cards.length,0);assert.equal(after.history.length,1);assert.match(after.note,/50 students.*58 people/);
 for(const patch of [{coverage:'complete'},{mailbox_completeness_verified:true},{generated_at:'yesterday'}])assert.equal(D.operations({ok:true,data:{...payload.data,spiceworks:{...snapshot,...patch}}}).spiceworks.state,'unavailable');
});
test('Events retain missing fields, source status, exact notes and scheduled-end caveat',()=>{
 const row={id:'e',name:'Fixture event',date:'2026-10-05',status:'SCHEDULED',custodial_notes:'8 trash boxes; 1 custodian requested'};
 const card=D.events([row],noon).cards[0];assert.match(card.lines.join('\n'),/Attendees: Not provided/);assert.match(card.lines.join('\n'),/End time\/instant not provided/);
 assert.match(card.lines.join('\n'),/8 trash boxes/);assert.equal(card.active,true);
 for(const status of ['CANCELLED','SUPERSEDED']){const view=D.events([{...row,status}],noon);assert.equal(view.cards.length,0);assert.equal(view.history[0].active,false);}
 assert.equal(D.events([{...row,status:'REVIEW_REQUIRED'}],noon).cards[0].active,false);
 const view=D.events([{...row,end_at:'2026-10-05T16:00:00Z'}],noon),ended=view.history[0];assert.equal(view.cards.length,0);assert.equal(ended.active,false);assert.match(ended.lines.join('\n'),/departure not independently/);
});
test('schools expire exactly at local 13:00 while daily totals and separate history survive',()=>{
 const feed={state:'current',rows:[visit]};assert.equal(D.schools(feed,noon).cards.length,1);
 assert.equal(D.schools(feed,Date.parse('2026-10-05T17:59:59Z')).cards.length,1);
 const ended=D.schools(feed,Date.parse('2026-10-05T18:00:00Z'));assert.equal(ended.cards.length,0);assert.equal(ended.history.length,1);assert.match(ended.note,/50 students.*7 adults.*58 people/);
 const winter={...visit,date:'2026-11-02',arrival_at:'2026-11-02T15:30:00Z',departure_at:'2026-11-02T19:00:00Z'};
 assert.equal(D.schools({state:'current',rows:[winter]},Date.parse('2026-11-02T18:59:59Z')).cards.length,1);
 assert.equal(D.schools({state:'current',rows:[winter]},Date.parse('2026-11-02T19:00:00Z')).cards.length,0);
});
test('late/missing school arrival is a review gap, never an invented overnight active visit',()=>{
 for(const arrival_at of [null,'2026-10-05T20:00:00Z']){
  const feed={state:'current',rows:[{...visit,arrival_at}]};assert.equal(D.schools(feed,noon).cards[0].state,'REVIEW_REQUIRED');
  const after=D.schools(feed,Date.parse('2026-10-05T20:00:00Z'));assert.equal(after.cards.length,0);assert.equal(after.history[0].state,'REVIEW_REQUIRED');
 }
 assert.match(D.schools(null,noon).note,/unknown/);
 const cancelled=D.schools({state:'current',rows:[{...visit,status:'CANCELLED'}]},noon);assert.equal(cancelled.cards.length,0);assert.match(cancelled.note,/0 students/);assert.equal(cancelled.history[0].state,'CANCELLED');
});

// Contract-only DOM fixture: executes the exact controller, not a browser or
// pixel/layout verification. No network, credentials, storage or live records.
function fixture({reduced=false,legacyDialog=false}={}){
 let now=noon,id=0;const frames=new Map(),timeouts=new Map(),all=[];
 class Node{
  constructor(tag='div'){this.tag=tag;this.dataset={};this.attrs={};this.children=[];this.listeners=new Map();this.hidden=false;this.disabled=false;this.open=false;this.inert=false;this.value='32';this.scrollTop=0;this.scrollHeight=1200;this.clientHeight=300;this.textContent='';
   const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,b){if(b??!classes.has(x))classes.add(x);else classes.delete(x);}};all.push(this);}
  addEventListener(t,fn){const list=this.listeners.get(t)||new Set();list.add(fn);this.listeners.set(t,list);}
  removeEventListener(t,fn){this.listeners.get(t)?.delete(fn);if(!this.listeners.get(t)?.size)this.listeners.delete(t);}
  emit(t,event={}){event.target??=this;event.preventDefault??=()=>{};event.stopPropagation??=()=>{};for(const fn of this.listeners.get(t)||[])fn(event);}
  append(...nodes){this.children.push(...nodes);for(const node of nodes)node.parent=this;}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(k,v){this.attrs[k]=v;if(k==='open')this.open=true;}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];if(k==='open')this.open=false;}
  focus(){doc.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  getBoundingClientRect(){return{left:this.x||0,top:0,width:24,height:24};}
  closest(selector){if(selector==='.mzMapPin')return this.pin?this:this.parent?.closest(selector);if(selector==='[data-location-select]')return this.dataset.locationSelect?this:this.parent?.closest(selector);return null;}
  querySelectorAll(selector){const result=[];for(const child of this.children){if(selector==='.mzMapPin'?child.pin:selector==='[data-location-select]'?!!child.dataset.locationSelect:selector==='[data-board]'?!!child.dataset.board:selector==='button,select,[tabindex="0"]'?['button','select'].includes(child.tag)||child.attrs.tabindex==='0':false)result.push(child);result.push(...child.querySelectorAll(selector));}return result;}
  querySelector(selector){if(selector==='[data-map-viewport]')return viewport;return null;}
 }
 const doc=new Node('document'),elements={};doc.createElement=tag=>new Node(tag);doc.getElementById=x=>elements[x];doc.hidden=false;doc.fullscreenEnabled=false;
 const html=readFileSync(new URL('../operations-dashboard.html',import.meta.url),'utf8');
 for(const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Node(match[1]);elements[match[2]]=node;node.id=match[2];}
 const main=new Node('main'),viewport=new Node(),map=elements['dashboard-map'],dialog=elements['operations-board'],content=elements['operations-board-content'];
 doc.body=new Node('body');doc.append(main,dialog);main.append(elements['operations-panels'],map);doc.querySelector=selector=>selector==='main'?main:null;
 dialog.append(elements['operations-board-pause'],elements['operations-board-speed'],elements['operations-board-fullscreen'],elements['operations-board-close'],content);content.attrs.tabindex='0';map.append(viewport);
 const triggers=['tickets','events','schools','locations'].map(kind=>{const node=new Node('button');node.dataset.board=kind;main.append(node);return node;});
 for(let i=0;i<47;i++){const node=new Node('button');node.pin=true;node.x=i*100;node.dataset={locationId:`location-${i}`,status:i<9?'overdue':'clean'};node.attrs['aria-label']=`Location ${i} — ${node.dataset.status}`;viewport.append(node);}
 if(legacyDialog){dialog.showModal=null;dialog.close=null;}
 const window=new Node('window'),motion=new Node();motion.matches=reduced;window.matchMedia=()=>motion;window.document=doc;
 const navigations=[];window.location={href:'https://example.invalid/operations-dashboard.html',assign:value=>navigations.push(value)};
 window.MemphisAuth={readSession:()=>({role:'ops_manager',manager_id:'synthetic-manager',credential_id:'synthetic-credential',device_id:'KIOSK_01'})};
 window.requestAnimationFrame=fn=>{const key=++id;frames.set(key,fn);return key;};window.cancelAnimationFrame=key=>frames.delete(key);
 window.setTimeout=(fn,delay)=>{assert.equal(delay,10000);const key=++id;timeouts.set(key,fn);return key;};window.clearTimeout=key=>timeouts.delete(key);
 let backCount=0;window.history={state:{prior:true},pushState(state){this.state=state;},replaceState(state){this.state=state;},back(){backCount++;this.state={prior:true};window.emit('popstate');}};
 doc.exitFullscreen=async()=>{doc.fullscreenElement=null;doc.emit('fullscreenchange');};
 const context={MemphisOperationsData:D,AbortController,Intl,Date,URL,console,module:{exports:{}}};vm.runInNewContext(ui,context);
 const controller=context.module.exports.create({document:doc,window,now:()=>now});let selected=null;
 controller.activate({selectLocation:value=>{selected=value;}});
 const text=node=>[node.textContent,...node.children.map(text)].join(' ');
 return{controller,window,doc,elements,main,triggers,dialog,content,viewport,motion,frames,timeouts,text,all,navigations,
  get selected(){return selected;},get backCount(){return backCount;},setNow:value=>{now=value;},step(time){const todo=[...frames.values()];frames.clear();for(const fn of todo)fn(time);},
  clean(){controller.stop();assert.equal(frames.size,0);assert.equal(timeouts.size,0);assert.equal(all.reduce((n,node)=>n+node.listeners.size,0),0);}};
}
const loaded=async(f,{operations=payload,scan=[{ticket_id:'1',location_name:'Fixture',maintenance_issue:'Fixture issue'}]}={})=>{
 const calls=[];await f.controller.refresh({headers:{Authorization:'Bearer SYNTHETIC','X-Device-Id':'SYNTHETIC'},isCurrent:()=>true,summary:{open_tickets:scan},fetchImpl:async(url,options)=>{
  calls.push({url,options});return{ok:true,json:async()=>url.endsWith('/operations')?operations:url.includes('attendance')?{ok:true,data:{attendance:12,stale:false,source_timestamp:'2026-10-05T17:00:00Z'}}:null};}});return calls;
};
test('non-event tickers retain their modal boards; Events uses one shared page',async()=>{
 const f=fixture();const calls=await loaded(f);assert.equal(calls.length,3);assert.equal(f.timeouts.size,0);
 for(const [i,kind]of [[0,'tickets'],[2,'schools'],[3,'locations']]){
  f.triggers[i].emit('click');assert.equal(f.dialog.open,true);assert.equal(f.frames.size,1);assert.equal(f.doc.activeElement,f.elements['operations-board-close']);
  assert.match(f.elements['operations-board-title'].textContent,new RegExp(kind==='tickets'?'tickets':kind==='locations'?'47':kind,'i'));
  f.elements['operations-board-close'].emit('click');assert.equal(f.dialog.open,false);assert.equal(f.frames.size,0);assert.equal(f.doc.activeElement,f.triggers[i]);
 }assert.equal(f.backCount,3);
 f.triggers[1].emit('click');assert.equal(f.dialog.open,false);assert.equal(f.frames.size,0);assert.equal(f.navigations.length,1);
 const target=new URL(f.navigations[0]);assert.equal(target.pathname,'/events.html');assert.equal(target.searchParams.get('hub'),'manager');assert.equal(target.searchParams.get('device'),'KIOSK_01');assert.equal(target.searchParams.has('token'),false);
 assert.equal(calls.length,3);f.clean();
});
test('auth headers go only to existing backend; forecast receives none',async()=>{
 const f=fixture(),calls=await loaded(f);for(const call of calls.filter(x=>x.url.includes('onrender.com')))assert.equal(call.options.headers.Authorization,'Bearer SYNTHETIC');
 assert.equal(calls.find(x=>x.url.includes('open-meteo.com')).options.headers,undefined);f.clean();
});
test('board speed/pause/reduced motion and Escape work without dropping true alerts',()=>{
 const f=fixture();f.triggers[3].emit('click');assert.equal(f.content.children.length,47);f.step(0);f.step(100);assert.equal(f.content.scrollTop,3.2);
 f.elements['operations-board-speed'].value='48';f.step(200);assert.equal(f.content.scrollTop,8);
 f.elements['operations-board-pause'].emit('click');f.step(300);assert.equal(f.content.scrollTop,8);
 f.dialog.emit('keydown',{key:'Escape'});assert.equal(f.frames.size,0);f.clean();
 const reduced=fixture({reduced:true});reduced.triggers[3].emit('click');reduced.step(0);reduced.step(100);assert.equal(reduced.content.scrollTop,0);reduced.clean();
});
test('fullscreen refusal stays a readable viewport board; fallback isolates focus; Back closes',async()=>{
 const f=fixture({legacyDialog:true});f.triggers[0].emit('click');assert.equal(f.main.inert,true);
 f.elements['operations-board-fullscreen'].emit('click');await Promise.resolve();assert.match(f.elements['operations-board-note'].textContent,/fills the browser window/);
 f.window.emit('popstate');assert.equal(f.dialog.open,false);assert.equal(f.main.inert,false);f.clean();
});
test('map fullscreen fallback exits and never alters pins',async()=>{
 const f=fixture();const positions=f.viewport.children.map(x=>x.x);
 f.elements['operations-map-fullscreen'].emit('click');await Promise.resolve();assert.equal(f.elements['dashboard-map'].classList.contains('is-expanded'),true);
 f.doc.emit('keydown',{key:'Escape'});assert.equal(f.elements['dashboard-map'].classList.contains('is-expanded'),false);
 assert.deepEqual(f.viewport.children.map(x=>x.x),positions);f.clean();
});
test('nearby chooser preserves coordinates and selects canonical stable ID',()=>{
 const f=fixture();f.viewport.children[1].x=10;const pin=f.viewport.children[0];f.viewport.emit('click',{target:pin});
 assert.equal(f.content.children.length,2);const button=f.content.querySelectorAll('[data-location-select]')[1];f.content.emit('click',{target:button});assert.equal(f.selected,'location-1');assert.equal(f.viewport.children[1].x,10);f.clean();
});
test('deletion converges while board open; hostile strings stay text, never HTML',async()=>{
 const f=fixture();await loaded(f,{scan:[{ticket_id:'1',location_name:'<img onerror=bad()>',maintenance_issue:'<script>bad()</script>'}]});f.triggers[0].emit('click');
 assert.match(f.text(f.content),/<script>bad/);assert.equal(f.content.querySelectorAll('img').length,0);
 await loaded(f,{scan:[]});assert.doesNotMatch(f.text(f.content),/bad/);f.clean();
});
test('sign-out/suspend aborts pending reads, closes boards and ignores late responses',async()=>{
 const f=fixture();let resolve;const pending=new Promise(r=>{resolve=r;}),signals=[];
 const run=f.controller.refresh({headers:{},summary:{open_tickets:[]},isCurrent:()=>true,fetchImpl:async(_url,options)=>{signals.push(options.signal);await pending;return{ok:true,json:async()=>payload};}});
 f.triggers[0].emit('click');f.controller.suspend();assert.equal(f.dialog.open,false);assert.equal(f.frames.size,0);assert.equal(f.timeouts.size,0);assert.ok(signals.every(s=>s.aborted));
 resolve();await run;assert.equal(f.elements['operations-panels'].hidden,true);assert.equal(f.elements['ops-attendance'].textContent,'Unavailable');f.clean();
});
test('new generation wins and return reuses the same controls without listener growth',async()=>{
 const f=fixture();let resolve;const pending=new Promise(r=>{resolve=r;});const old=f.controller.refresh({headers:{},summary:{open_tickets:[]},isCurrent:()=>true,fetchImpl:async()=>{await pending;return{ok:true,json:async()=>payload};}});
 await loaded(f);resolve();await old;assert.equal(f.elements['ops-attendance'].textContent,'12');
 const listeners=f.all.reduce((n,x)=>n+x.listeners.size,0);f.controller.suspend();f.controller.activate({});await loaded(f);assert.equal(f.all.reduce((n,x)=>n+x.listeners.size,0),listeners);f.clean();
});
test('school departure changes an open board on shared clock tick, retaining daily history',async()=>{
 const f=fixture();await loaded(f,{operations:{ok:true,data:{...payload.data,schools:{state:'current',generated_at:'2026-10-05T17:00:00Z',rows:[visit]}}}});f.triggers[2].emit('click');
 assert.match(f.text(f.content),/Within scheduled visit window/);f.setNow(Date.parse('2026-10-05T18:00:00Z'));f.controller.tick();
 assert.match(f.text(f.content),/Daily visit history/);assert.match(f.elements['operations-board-note'].textContent,/50 students/);f.clean();
});
test('request timeout uses one cancellable deadline and clears unavailable feeds',async()=>{
 const f=fixture();const requests=[];
 const pending=f.controller.refresh({headers:{},summary:{open_tickets:[]},isCurrent:()=>true,fetchImpl:async(_url,{signal})=>new Promise((resolve,reject)=>{requests.push(signal);signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});})});
 assert.equal(f.timeouts.size,1);for(const fn of [...f.timeouts.values()])fn();await pending;assert.ok(requests.every(s=>s.aborted));assert.equal(f.timeouts.size,0);assert.equal(f.elements['ops-attendance'].textContent,'Unavailable');f.clean();
});
test('principal change during response cannot populate any operations data',async()=>{
 const f=fixture();await f.controller.refresh({headers:{},summary:{open_tickets:[]},isCurrent:()=>false,fetchImpl:async()=>({ok:true,json:async()=>payload})});
 assert.notEqual(f.elements['ops-attendance'].textContent,'12');f.clean();
});

test('event navigation requires a current named session and never opens a duplicate board',()=>{const f=fixture();f.window.MemphisAuth.readSession=()=>null;f.triggers[1].emit('click');assert.equal(f.navigations.length,0);assert.equal(f.dialog.open,false);f.clean();});
