import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),data=require('../operations-dashboard-data.js');
const source=readFileSync(new URL('../events-view.js',import.meta.url),'utf8');
const context={module:{exports:{}},URL,AbortController,Intl,Date,console};vm.runInNewContext(source,context);const V=context.module.exports;
const E='11111111-1111-4111-8111-111111111111',M='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',ID='44444444-4444-4444-8444-444444444444';
function fixture({employee=false,reduced=false,noIdentity=false}={}){
 let now=Date.parse('2026-10-06T12:00:00Z'),id=0;const all=[],intervals=new Map(),timeouts=new Map(),frames=new Map(),storage=new Map(),calls=[],nav=[];
 class N{constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.listeners=new Map();this.textContent='';this.scrollTop=0;this.scrollHeight=1000;this.clientHeight=200;this.value='32';all.push(this);}
  addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(f);}removeEventListener(t,f){this.listeners.get(t)?.delete(f);if(!this.listeners.get(t)?.size)this.listeners.delete(t);}
  emit(t,e={}){e.preventDefault??=()=>{};for(const f of [...(this.listeners.get(t)||[])])f(e);}setAttribute(k,v){this.attrs[k]=v;}append(...n){this.children.push(...n);}replaceChildren(...n){this.children=[...n];}querySelector(s){return s==='details'?this.children.find(n=>n.tag==='details'):null;}}
 const d=new N('document'),w=new N('window'),els={};for(const x of['shared-events-page','events-content','events-status','events-pause','events-speed','events-back','events-fullscreen'])els[x]=new N();
 d.getElementById=x=>els[x];d.createElement=t=>new N(t);d.body=new N('body');d.hidden=false;
 w.document=d;w.MemphisOperationsData=data;w.location={href:'https://example.invalid/events.html?hub=manager&return=https://evil.invalid',assign:u=>nav.push(u)};
 w.setInterval=f=>{const n=++id;intervals.set(n,f);return n;};w.clearInterval=n=>intervals.delete(n);w.setTimeout=f=>{const n=++id;timeouts.set(n,f);return n;};w.clearTimeout=n=>timeouts.delete(n);w.requestAnimationFrame=f=>{const n=++id;frames.set(n,f);return n;};w.cancelAnimationFrame=n=>frames.delete(n);
 const motion=new N();motion.matches=reduced;w.matchMedia=()=>motion;
 w.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 let session=noIdentity?null:{role:'ops_manager',manager_id:M,credential_id:C,device_id:'manager-browser',token:'SYNTHETIC_TOKEN',expires_at:'2026-10-06T18:00:00Z'};
 let security={native:true,state:'enrolled',ready:true,available:true,quarantined:false,deviceId:'KIOSK_08',generation:1};
 let profile={employee_id:E,assignment_epoch:1,credential_id:C};
 if(employee){w.MemphisCustodialSecurity={native:true,getStatus:()=>security,mutateProtectedWork:async fn=>fn()};w.MemphisMobile={edition:'custodial',ready:Promise.resolve(),readCustodialHomeCache:()=>({profile})};if(noIdentity)security.ready=false;}
 else w.MemphisAuth={readSession:()=>session,requireOpsManagerSession:async()=>session};
 let responseCode=200,pending=null;
 const payload={ok:true,feed:{schema:V.SCHEMA,timezone:'America/Chicago',source:'events_app_events',state:'snapshot',coverage:'published_records_only',mailbox_completeness_verified:false,generated_at:new Date(now).toISOString(),rows:[{id:ID,revision:1,timezone:'America/Chicago',name:'Synthetic event',date:'2026-10-06',end_date:'2026-10-06',start_at:'2026-10-06T15:00:00Z',end_at:'2026-10-06T16:00:00Z',status:'SCHEDULED',location:'Fixture venue',attendees:0,custodial_notes:'Two trash boxes',requirements:[]}]},meta:employee?{canonical_device_id:'KIOSK_08',employee_id:E,credential_id:C,assignment_epoch:1}:{manager_id:M,credential_id:C}};
 const fetchImpl=async(url,options)=>{calls.push({url,options});if(pending)await pending;if(responseCode===0)throw Error('offline');return{ok:responseCode===200,status:responseCode,json:async()=>structuredClone(payload)};};
 const app=V.create({window:w,document:d,fetchImpl,now:()=>now});
 const text=n=>[n.textContent,...n.children.map(text)].join(' ');
 return{w,d,els,app,calls,nav,storage,payload,intervals,timeouts,frames,motion,text,
  setCode:n=>{responseCode=n;},setPending:p=>{pending=p;},setSession:s=>{session=s;},patchSecurity:x=>{security={...security,...x};},patchProfile:x=>{profile={...profile,...x};},setNow:x=>{now=x;},
  step(t){const fs=[...frames.values()];frames.clear();for(const fn of fs)fn(t);},
  finish(){app.stop();assert.equal(intervals.size+timeouts.size+frames.size,0);assert.equal(all.reduce((n,x)=>n+x.listeners.size,0),0);}};
}
for(const employee of [false,true])test((employee?'employee':'manager')+' uses one safe page and correct feed',async()=>{const f=fixture({employee});await f.app.init();assert.equal(f.calls.length,1);assert.ok(f.calls[0].url.endsWith(employee?'/employee-events-api':'/dashboard-api/events-feed'));assert.match(f.text(f.els['events-content']),/Two trash boxes/);assert.match(f.text(f.els['events-content']),/Attendees: 0/);assert.equal(f.els['events-content'].children[0].dataset.revision,'1');f.els['events-back'].emit('click');const u=new URL(f.nav[0]);assert.equal(u.pathname,employee?'/index.html':'/operations-dashboard.html');assert.equal(u.searchParams.has('token'),false);assert.equal(u.origin,'https://example.invalid');f.finish();});
test('query parameter does not grant employee authority',async()=>{const f=fixture({noIdentity:true});f.w.location.href='https://example.invalid/events.html?hub=employee';await f.app.init();assert.equal(f.calls.length,0);assert.equal(f.els['events-content'].children.length,0);f.finish();});
test('employee denied before identity readiness',async()=>{const f=fixture({employee:true,noIdentity:true});await f.app.init();assert.equal(f.calls.length,0);f.finish();});
test('only manager request has manager bearer',async()=>{for(const employee of[false,true]){const f=fixture({employee});await f.app.init();assert.equal(Boolean(f.calls[0].options.headers.Authorization),!employee);f.finish();}});
test('normal speed, manual pause and reduced motion',async()=>{const f=fixture();await f.app.init();f.step(0);f.step(100);assert.equal(f.els['events-content'].scrollTop,3.2);f.els['events-content'].emit('wheel');f.step(200);assert.equal(f.els['events-content'].scrollTop,3.2);f.finish();const g=fixture({reduced:true});await g.app.init();g.step(0);g.step(100);assert.equal(g.els['events-content'].scrollTop,0);g.finish();});
test('hostile source text is never HTML',async()=>{const f=fixture();f.payload.feed.rows[0].name='<img src=x onerror=bad()>';await f.app.init();assert.match(f.text(f.els['events-content']),/<img/);assert.equal(f.els['events-content'].children[0].children.some(n=>n.tag==='img'),false);f.finish();});
test('cancellations and same-day ending move into shared history',async()=>{const f=fixture();await f.app.init();f.payload.feed.rows[0].status='CANCELLED';f.payload.feed.rows[0].revision=2;await f.app.refresh();assert.match(f.text(f.els['events-content']),/Cancelled/);assert.ok(f.els['events-content'].querySelector('details'));f.payload.feed.rows[0].status='SCHEDULED';f.setNow(Date.parse('2026-10-06T17:00:00Z'));await f.app.refresh();assert.match(f.text(f.els['events-content']),/Scheduled to have ended/);f.finish();});
test('overnight event is not ended at midnight',async()=>{const f=fixture();f.payload.feed.rows[0].end_at='2026-10-07T07:00:00Z';f.setNow(Date.parse('2026-10-07T06:00:00Z'));f.setSession({role:'ops_manager',manager_id:M,credential_id:C,device_id:'manager-browser',token:'SYNTHETIC_TOKEN',expires_at:'2026-10-08T00:00:00Z'});await f.app.init();assert.equal(f.els['events-content'].children[0].tag,'article');f.finish();});
test('unavailable is not empty',async()=>{const f=fixture();f.setCode(503);await f.app.init();assert.match(f.els['events-status'].textContent,/could not update/);assert.doesNotMatch(f.els['events-status'].textContent,/No upcoming/);f.finish();});
test('valid employee snapshot survives transport loss',async()=>{const f=fixture({employee:true});await f.app.init();assert.equal(f.storage.size,1);f.setCode(0);await f.app.refresh();assert.match(f.els['events-status'].textContent,/saved information/);assert.match(f.text(f.els['events-content']),/Synthetic event/);f.finish();});
test('server revocation clears page and all active timers',async()=>{const f=fixture({employee:true});await f.app.init();f.setCode(401);await f.app.refresh();assert.equal(f.els['events-content'].children.length,0);assert.equal(f.intervals.size+f.frames.size,0);assert.match(f.els['events-status'].textContent,/needs a manager/);f.finish();});
test('employee reassignment clears page immediately',async()=>{const f=fixture({employee:true});await f.app.init();f.patchProfile({employee_id:M});f.w.emit('memphis:custodial-security-state');assert.equal(f.els['events-content'].children.length,0);f.finish();});
test('wrong response credential rejected',async()=>{const f=fixture({employee:true});f.payload.meta.credential_id=M;await f.app.init();assert.equal(f.els['events-content'].children.length,0);assert.equal(f.storage.size,0);f.finish();});
test('late response after stop cannot render',async()=>{const f=fixture();let resolve;f.setPending(new Promise(r=>{resolve=r;}));const loading=f.app.init();await Promise.resolve();await Promise.resolve();f.app.stop();resolve();await loading;assert.equal(f.els['events-content'].children.length,0);f.finish();});
test('newer refresh wins',async()=>{const f=fixture();await f.app.init();let resolve;f.setPending(new Promise(r=>{resolve=r;}));const old=f.app.refresh();f.setPending(null);f.payload.feed.rows[0].revision=2;await f.app.refresh();resolve();await old;assert.equal(f.els['events-content'].children[0].dataset.revision,'2');f.finish();});
test('BFCache restores once without listener growth',async()=>{const f=fixture();await f.app.init();f.w.emit('pagehide',{persisted:true});assert.equal(f.intervals.size,0);assert.equal(f.els['events-content'].children.length,0);await f.app.init();assert.equal(f.intervals.size,2);assert.equal(f.els['events-content'].children[0].tag,'article');f.finish();});
test('contract rejects bad identity and unsupported freshness',()=>{const f=fixture();const p=structuredClone(f.payload);p.feed.rows.push({...p.feed.rows[0]});assert.throws(()=>V.validate(p));const c=structuredClone(f.payload);c.feed.state='current';assert.throws(()=>V.validate(c));f.finish();});

// Regression: rotating a bearer is not a change of person or credential.
test('expired web getter may return null while the same principal is renewed',async()=>{
 const f=fixture();let expired=false,acquisitions=0;const read=f.w.MemphisAuth.readSession;
 f.w.MemphisAuth.readSession=()=>expired?null:read();
 f.w.MemphisAuth.requireOpsManagerSession=async()=>{acquisitions++;if(expired){f.setSession({role:'ops_manager',manager_id:M,credential_id:C,device_id:'manager-browser',token:'RENEWED',expires_at:'2026-10-08T00:00:00Z'});expired=false;}return read();};
 await f.app.init();const before=acquisitions;expired=true;f.setNow(Date.parse('2026-10-06T19:00:00Z'));
 await f.app.refresh();assert.ok(acquisitions>before);assert.equal(f.calls.at(-1).options.headers.Authorization,'Bearer RENEWED');assert.equal(f.els['shared-events-page'].dataset.denied,'false');f.finish();
});
test('renewed identity may not substitute a different manager',async()=>{
 const f=fixture();await f.app.init();f.w.MemphisAuth.requireOpsManagerSession=async()=>{const s={role:'ops_manager',manager_id:E,credential_id:C,device_id:'manager-browser',token:'OTHER',expires_at:'2026-10-08T00:00:00Z'};f.setSession(s);return s;};
 const before=f.calls.length;await f.app.refresh();assert.equal(f.calls.length,before);assert.equal(f.els['events-content'].children.length,0);f.finish();
});
test('manager 401 performs only one forced read retry',async()=>{
 const f=fixture();let forced=0;const read=f.w.MemphisAuth.readSession;
 f.w.MemphisAuth.requireOpsManagerSession=async options=>{if(options?.forceRefresh)forced++;return read();};
 await f.app.init();f.setCode(401);const before=f.calls.length;await f.app.refresh();assert.equal(forced,1);assert.equal(f.calls.length-before,2);assert.equal(f.els['events-content'].children.length,0);f.finish();
});
test('manager 403 is terminal without forced renewal',async()=>{
 const f=fixture();let forced=0;const read=f.w.MemphisAuth.readSession;f.w.MemphisAuth.requireOpsManagerSession=async options=>{if(options?.forceRefresh)forced++;return read();};
 await f.app.init();f.setCode(403);const before=f.calls.length;await f.app.refresh();assert.equal(forced,0);assert.equal(f.calls.length-before,1);assert.equal(f.els['events-content'].children.length,0);f.finish();
});
test('ended event leaves active cards at exact end while offline and paused',async()=>{
 const f=fixture({employee:true});f.payload.feed.rows[0].end_at='2026-10-06T12:00:01Z';await f.app.init();
 f.els['events-content'].emit('wheel');f.setCode(0);f.w.emit('offline');f.setNow(Date.parse('2026-10-06T12:00:01Z'));
 for(const callback of f.intervals.values())callback();await Promise.resolve();await Promise.resolve();
 assert.equal(f.els['events-content'].children.filter(n=>n.tag==='article').length,0);assert.ok(f.els['events-content'].querySelector('details'));f.finish();
});
test('event projection expires past-date entries without inventing same-day end time',()=>{
 const row={id:ID,status:'SCHEDULED',name:'Untimed',date:'2026-10-05',end_date:'2026-10-05'};
 assert.equal(data.events([row],Date.parse('2026-10-06T15:00:00Z')).cards.length,0);
 assert.equal(data.events([{...row,date:'2026-10-06',end_date:'2026-10-06'}],Date.parse('2026-10-06T15:00:00Z')).cards.length,1);
});

test('native-handled 401 does not stack a second page-level retry',async()=>{
 const f=fixture();let forced=0;const read=f.w.MemphisAuth.readSession;
 f.w.MemphisMobile={handlesManagerAuthenticationRetry:true};f.w.MemphisAuth.requireOpsManagerSession=async options=>{if(options?.forceRefresh)forced++;return read();};
 await f.app.init();f.setCode(401);const before=f.calls.length;await f.app.refresh();assert.equal(forced,0);assert.equal(f.calls.length-before,1);f.finish();
});
test('temporary session-service outage clears display but permits later renewal',async()=>{
 const f=fixture();await f.app.init();const read=f.w.MemphisAuth.readSession;let outage=true;
 f.w.MemphisAuth.readSession=()=>outage?null:read();f.w.MemphisAuth.requireOpsManagerSession=async()=>{if(outage)throw Object.assign(Error('temporary'),{status:503});return read();};
 await f.app.refresh();assert.equal(f.els['events-content'].children.length,0);assert.equal(f.els['shared-events-page'].dataset.denied,'false');assert.equal(f.intervals.size,2);
 outage=false;await f.app.refresh();assert.equal(f.els['events-content'].children[0].tag,'article');f.finish();
});
