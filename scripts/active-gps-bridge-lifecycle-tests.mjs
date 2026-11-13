import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const source=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
const block=source.slice(source.indexOf('  let activeGpsLifecycle = null;'),source.indexOf('\n  window.fetch = bridgeFetch;'));
const pause=()=>new Promise(setImmediate);
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
function fixture({ready=Promise.resolve(),resume=null,network=null}={}){
 const events=new Map(),doc=new Map(),records=[],removed=[],calls=[],data=new Map([['protected','unchanged']]);
 const target=map=>({addEventListener:(t,f)=>{if(!map.has(t))map.set(t,new Set());map.get(t).add(f);},removeEventListener:(t,f)=>map.get(t)?.delete(f)});
 const w={...target(events),dispatchEvent:()=>{},MemphisScanSync:{ready:Promise.resolve(true),enqueue:async()=>{}}};
 const sandbox={window:w,document:{...target(doc),hidden:false},localStorage:data,deviceId:()=> 'KIOSK_08',navigator:{geolocation:{}},bridgeReady:ready,CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}},
 createActiveGpsLifecycle:()=>{const r={disposed:false,reconciles:0,dispose(){this.disposed=true;},async reconcile(){this.reconciles++;return{state:'active'};}};records.push(r);return r;},
 App:{async addListener(type){calls.push('resume');return resume?resume.promise:{remove:async()=>removed.push('resume')};}},Network:{async addListener(type){calls.push('network');return network?network.promise:{remove:async()=>removed.push('network')};}}};
 vm.runInNewContext(block+'\nglobalThis.api={install:installActiveGpsLifecycle,reconcile:reconcileActiveGps};',sandbox);
 const emit=async(type,event={})=>{for(const fn of [...events.get(type)||[]])fn(event);await pause();};
 return{...sandbox.api,emit,events,doc,records,removed,calls,data};
}
test('page disposal before native readiness creates no GPS work or listeners',async()=>{const d=deferred(),f=fixture({ready:d.promise});const work=f.install();await f.emit('pagehide');d.resolve();await work;assert.equal(f.records.length,0);assert.equal(f.calls.length,0);assert.equal(f.data.get('protected'),'unchanged');});
test('late native resume subscription is removed rather than leaked',async()=>{const d=deferred(),f=fixture({resume:d});const work=f.install();await pause();await f.emit('pagehide');d.resolve({remove:async()=>f.removed.push('late-resume')});await work;assert.deepEqual(f.calls,['resume']);assert.deepEqual(f.removed,['late-resume']);assert.equal(f.records[0].disposed,true);});
test('late network subscription and earlier resume subscription both close',async()=>{const d=deferred(),f=fixture({network:d});const work=f.install();await pause();await f.emit('pagehide');d.resolve({remove:async()=>f.removed.push('late-network')});await work;assert.deepEqual(f.removed,['resume','late-network']);});
test('persisted Back/Forward restoration starts one replacement lifecycle',async()=>{const f=fixture();await f.install();assert.equal(f.records.length,1);await f.emit('pagehide',{persisted:true});assert.equal(f.records[0].disposed,true);assert.equal(f.events.get('online').size,0);await f.emit('pageshow',{persisted:true});assert.equal(f.records.length,2);assert.equal(f.events.get('online').size,1);await f.emit('pageshow',{persisted:true});assert.equal(f.records.length,2);await f.emit('pagehide');assert.equal(f.events.get('online').size,0);assert.equal(f.doc.get('visibilitychange').size,0);assert.equal(f.data.get('protected'),'unchanged');});
test('simultaneous install calls do not create duplicate native subscriptions',async()=>{const d=deferred(),f=fixture({ready:d.promise});const first=f.install(),second=f.install();d.resolve();await Promise.all([first,second]);assert.equal(f.records.length,1);assert.deepEqual(f.calls,['resume','network']);await f.emit('pagehide');});
test('late reconciliation cannot recreate GPS after the page is closed',async()=>{const d=deferred(),f=fixture({ready:d.promise});const work=f.reconcile();await f.emit('pagehide');d.resolve();assert.equal((await work).state,'disposed');assert.equal(f.records.length,0);});
