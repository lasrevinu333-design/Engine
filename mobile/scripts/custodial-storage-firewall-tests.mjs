#!/usr/bin/env node

import assert from 'node:assert/strict';
import { PROTECTED_BROWSER_HOLD_KEY } from '../src/custodial/protected-browser-admission.js';
import {
  createRawStorageAdapter,
  installCustodialStorageFirewall,
} from '../src/custodial/storage-firewall.js';

class TestStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
  clear() { this.values.clear(); }
}

// New receiver-isolation cases use ONLY this module's existing synthetic
// Storage fixture. No Map/private-field access is a real-browser write proof.
if(process.argv.includes('--original-receiver-only')){
  const variant=process.argv.find(arg=>arg.startsWith('--receiver-case='))?.slice('--receiver-case='.length);
  assert(['valueof','custom','raw-length','native-compat','held-routes','data-length','intrinsic-length','shadowed-method'].includes(variant));
  const receivers=[],nativeCalls=[];
  let local,session;
  class ReceiverStorage extends TestStorage{
    get receiver(){receivers.push(this);return this;}
    identity(){receivers.push(this);return this;}
    get length(){
      assert(this===local||this===session,'fixed captured length getter must retain its legitimate receiver');
      return super.length;
    }
    getItem(...args){nativeCalls.push({name:'getItem',receiver:this,args});return super.getItem(...args);}
    key(...args){nativeCalls.push({name:'key',receiver:this,args});return super.key(...args);}
    setItem(...args){nativeCalls.push({name:'setItem',receiver:this,args});return super.setItem(...args);}
    removeItem(...args){nativeCalls.push({name:'removeItem',receiver:this,args});return super.removeItem(...args);}
  }
  local=new ReceiverStorage({'original':'local exact'});session=new ReceiverStorage({'original':'session exact'});
  const rawLocal=createRawStorageAdapter(local),rawSession=createRawStorageAdapter(session);
  if(variant==='shadowed-method')
    Object.defineProperty(local,'getItem',{configurable:true,writable:true,value(){receivers.push(this);return this;}});
  if(variant==='raw-length'){
    let invoked=0,leaked=null;
    Object.defineProperty(ReceiverStorage.prototype,'length',{configurable:true,get(){invoked++;leaked=this;return 999;}});
    assert.equal(rawLocal.length,1,'private adapter must call its original getter, not a later application getter');
    rawLocal.setItem('another','exact');
    assert.equal(rawLocal.length,2,'captured getter must read current original count, not freeze a stale count');
    assert.equal(rawSession.length,1);assert.equal(invoked,0);assert.equal(leaked,null);
  }else if(variant==='intrinsic-length'){
    const originals={apply:Reflect.apply,get:Reflect.get,own:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf};
    let interceptions=0,count;
    try{
      // This isolated Node document models later application replacement.
      // No replacement callback may see the private original Storage.
      Reflect.apply=()=>{interceptions++;throw Error('later application apply');};
      Reflect.get=()=>{interceptions++;throw Error('later application get');};
      Object.getOwnPropertyDescriptor=()=>{interceptions++;throw Error('later application own');};
      Object.getPrototypeOf=()=>{interceptions++;throw Error('later application prototype');};
      count=rawLocal.length;
    }finally{
      Reflect.apply=originals.apply;Reflect.get=originals.get;
      Object.getOwnPropertyDescriptor=originals.own;Object.getPrototypeOf=originals.prototype;
    }
    assert.equal(count,1);assert.equal(interceptions,0);
  }else if(variant==='data-length'){
    const data=new TestStorage();
    Object.defineProperty(data,'length',{configurable:true,writable:true,enumerable:true,value:0});
    const raw=createRawStorageAdapter(data);
    assert.equal(raw.length,0);Object.defineProperty(data,'length',{value:3});assert.equal(raw.length,3);
    let invoked=0;
    Object.defineProperty(data,'length',{get(){invoked++;return data;},configurable:true});
    assert.throws(()=>raw.length,TypeError);assert.equal(invoked,0,'data-count replacement must not invoke a new getter');
    for(const value of [-1,1.5,NaN,Infinity,'2',null,{}]){
      const bad=new TestStorage();Object.defineProperty(bad,'length',{value,configurable:true});
      assert.throws(()=>createRawStorageAdapter(bad),TypeError);
    }
    const missing=Object.create(null);
    for(const key of ['getItem','setItem','removeItem','key'])missing[key]=rawLocal[key];
    assert.throws(()=>createRawStorageAdapter(missing),TypeError,'missing length is unavailable, not an empty original');
  }else{
    Object.defineProperty(globalThis,'localStorage',{value:local,writable:true,configurable:true});
    Object.defineProperty(globalThis,'sessionStorage',{value:session,writable:true,configurable:true});
    installCustodialStorageFirewall({storage:local,
      getSecurityStatus:()=>({initialized:true,ready:true,available:true,quarantined:false}),
      requireProtectedWorkMutation:()=>{}});
    const publicLocal=globalThis.localStorage,publicSession=globalThis.sessionStorage;
    assert.notEqual(publicLocal,local);assert.notEqual(publicSession,session);
    if(variant==='shadowed-method'){
      assert.equal(publicLocal.getItem('original'),publicLocal,'own custom method using a fixed name must not acquire raw receiver');
      assert.equal(receivers.at(-1),publicLocal);
      assert.equal(rawLocal.getItem('original'),'local exact','private original read was captured before application shadow');
      rawLocal.setItem(PROTECTED_BROWSER_HOLD_KEY,'original hold');
      assert.throws(()=>publicLocal.getItem().setItem('original','replacement'),e=>e.code==='custodial_protected_state_read_only');
      assert.equal(rawLocal.getItem('original'),'local exact');
    }else if(variant==='valueof'){
      for(const [area,raw]of [[publicLocal,local],[publicSession,session]]){
        assert.equal(area.valueOf(),area,'Object valueOf must not expose the raw Storage receiver');
        assert.notEqual(area.valueOf(),raw);assert.equal(area.valueOf,area.valueOf);
        assert.equal(Object.prototype.valueOf.call(area),area);
      }
    }else if(variant==='custom'){
      for(const [area,raw]of [[publicLocal,local],[publicSession,session]]){
        assert.equal(area.receiver,area,'custom getter must receive the public receiver');
        assert.equal(receivers.at(-1),area);assert.notEqual(receivers.at(-1),raw);
        assert.equal(area.identity(),area);assert.equal(receivers.at(-1),area);
        assert.equal(area.identity,area.identity);
      }
      Object.defineProperty(ReceiverStorage.prototype,'length',{configurable:true,get(){receivers.push(this);return 7;}});
      assert.equal(publicLocal.length,7);assert.equal(receivers.at(-1),publicLocal);
      assert.equal(rawLocal.length,1,'public getter substitution cannot rebaseline the private count');
      // Even an application getter/function closing over a known raw fixture
      // must not project that direct raw result through the public facade.
      Object.defineProperty(ReceiverStorage.prototype,'closedReceiver',{configurable:true,get(){return local;}});
      ReceiverStorage.prototype.closedFunction=function(){return local;};
      assert.equal(publicLocal.closedReceiver,publicLocal);assert.equal(publicLocal.closedFunction(),publicLocal);
      Object.defineProperty(publicLocal,'ordinaryReadonlyData',{configurable:false,writable:false,value:19});
      assert.equal(publicLocal.ordinaryReadonlyData,19);
      Object.defineProperty(publicLocal,'unsafeReadonlyFunction',{configurable:false,writable:false,value(){return local;}});
      assert.throws(()=>publicLocal.unsafeReadonlyFunction,TypeError,'Proxy-invariant unsafe callable is unavailable, never a raw handle');
    }else if(variant==='native-compat'){
      for(const [area,raw]of [[publicLocal,local],[publicSession,session]]){
        assert.equal(area.getItem('original','extra-read-arg'),raw===local?'local exact':'session exact');
        assert.equal(nativeCalls.at(-1).receiver,raw);assert.equal(nativeCalls.at(-1).args[1],'extra-read-arg');assert.equal(area.getItem,area.getItem);
        const key={toString:()=> 'ordinary'},value={toString:()=> 'exact value'};
        area.setItem(key,value);const call=nativeCalls.findLast(x=>x.name==='setItem');
        assert.equal(call.receiver,raw);assert.equal(call.args[0],key);assert.equal(call.args[1],value);
        assert.equal(area.length,2);assert.equal(area.key(1),'ordinary');assert.equal(nativeCalls.at(-1).receiver,raw);
        assert.equal(area.setItem,area.setItem);area.removeItem('ordinary');assert.equal(area.length,1);
        area.ordinaryProperty=42;assert.equal(area.ordinaryProperty,42);
        Object.defineProperty(area,'ordinaryAccessor',{get(){return this;},configurable:true});
        assert.equal(area.ordinaryAccessor,area);
      }
      assert.throws(()=>publicLocal.setItem('mz_scan_device_id','foreign'),e=>e.code==='custodial_protected_state_read_only');
      assert.equal(rawLocal.getItem('original'),'local exact');assert.equal(rawSession.getItem('original'),'session exact');
    }else if(variant==='held-routes'){
      const marker='exact existing held marker';rawLocal.setItem(PROTECTED_BROWSER_HOLD_KEY,marker);
      const beforeLocal=[...local.values],beforeSession=[...session.values];
      for(const area of [publicLocal,publicSession]){
        for(const route of [()=>area.valueOf(),()=>area.receiver,()=>area.identity()]){
          const exposed=route();assert.equal(exposed,area);
          assert.throws(()=>exposed.setItem('original','replacement'),e=>e.code==='custodial_protected_state_read_only');
          assert.throws(()=>exposed.removeItem('original'),e=>e.code==='custodial_protected_state_read_only');
          assert.throws(()=>{exposed['unknown-original']='replacement';},e=>e.code==='custodial_protected_state_read_only');
        }
        assert.throws(()=>area.clear(),e=>e.code==='custodial_protected_state_read_only');
      }
      assert.deepEqual([...local.values],beforeLocal);assert.deepEqual([...session.values],beforeSession);
      assert.equal(rawLocal.getItem(PROTECTED_BROWSER_HOLD_KEY),marker);
    }
  }
  console.log(JSON.stringify({case:'STORAGE_ORIGINAL_RECEIVER_NEW',variant,result:'PASS',
    proof:'actual firewall/adapter module, existing synthetic Storage fixture only; no real browser/native/all-realm/ACK proof'}));
  process.exit(0);
}

if(process.argv.includes('--all-key-hold-only')){
  const variant=process.argv.find(arg=>arg.startsWith('--hold-source='))?.split('=')[1]??'present';
  assert(['present','missing-after-observation','unreadable'].includes(variant));
  let inaccessible=false,coercions=0;
  class HeldStorage extends TestStorage{
    getItem(key){if(inaccessible&&this===local&&key===PROTECTED_BROWSER_HOLD_KEY)throw Error('original hold read unavailable');return super.getItem(key);}
  }
  const local=new HeldStorage({'future-unclassified-original':'local original'}),session=new HeldStorage({'future-unclassified-original':'session original'});
  Object.defineProperty(globalThis,'localStorage',{value:local,writable:true,configurable:true});
  Object.defineProperty(globalThis,'sessionStorage',{value:session,writable:true,configurable:true});
  const rawLocal=createRawStorageAdapter(local),rawSession=createRawStorageAdapter(session);
  const firewall=installCustodialStorageFirewall({storage:local,
    getSecurityStatus:()=>({initialized:true,ready:true,available:true,quarantined:false}),
    requireProtectedWorkMutation:()=>{throw Error('no ordinary writer claimed');}});
  const publicLocal=globalThis.localStorage,publicSession=globalThis.sessionStorage;
  // Unclassified ordinary UI preferences remain writable while unheld.
  publicLocal.setItem('ordinary-before-hold','allowed');publicSession.setItem('ordinary-before-hold','allowed');
  assert.equal(rawLocal.getItem('ordinary-before-hold'),'allowed');assert.equal(rawSession.getItem('ordinary-before-hold'),'allowed');
  if(variant==='unreadable')inaccessible=true;
  else rawLocal.setItem(PROTECTED_BROWSER_HOLD_KEY,'exact original local hold');
  assert.equal(firewall.blocked(),true);
  if(variant==='missing-after-observation')rawLocal.removeItem(PROTECTED_BROWSER_HOLD_KEY); // foreign fixture loss, NOT thaw
  const originalLocal=JSON.stringify([...local.values]),originalSession=JSON.stringify([...session.values]);
  for(const area of [publicLocal,publicSession]){
    const key='future-unclassified-original';
    for(const mutate of [()=>area.setItem(key,'replacement'),()=>area.removeItem(key),
      ()=>{area[key]='replacement';},()=>{delete area[key];},
      ()=>Object.defineProperty(area,key,{value:'replacement'}),()=>area.setItem('brand-new-unknown','new'),
      ()=>area.clear(),()=>area.setItem({toString(){coercions++;return key;}},'replacement')])
      assert.throws(mutate,error=>error.code==='custodial_protected_state_read_only','every held public writer must refuse before any key classification/coercion');
  }
  assert.equal(coercions,0);assert.equal(JSON.stringify([...local.values]),originalLocal);assert.equal(JSON.stringify([...session.values]),originalSession);
  assert.equal(rawLocal.getItem('future-unclassified-original'),'local original');assert.equal(rawSession.getItem('future-unclassified-original'),'session original');
  if(variant==='unreadable'){inaccessible=false;assert.throws(()=>publicLocal.setItem('future-unclassified-original','must not revive'));}
  console.log(JSON.stringify({case:'ALL_KEY_HOLD_NEW',variant,result:'PASS',areas:2,held_public_mutation_shapes:8,
    proof:'actual method and Proxy guards; synthetic Storage, not genuine browser/all-realm/native ACK'}));
  process.exit(0);
}

if (process.argv.includes('--separation-hold-only')) {
  const saved = 'original pending cleaning bytes';
  const local = new TestStorage({'session:original':saved});
  Object.defineProperty(globalThis,'localStorage',{value:local,writable:true,configurable:true});
  const raw = createRawStorageAdapter(local);
  const firewall = installCustodialStorageFirewall({storage:local,
    getSecurityStatus:()=>({initialized:true,ready:true,available:true,quarantined:false})});
  const publicStorage=globalThis.localStorage;
  const marker='{"schema":"custodial.browser-preservation-hold.v1","operation_id":"11111111-1111-4111-8111-111111111111","native_authority":false}';
  raw.setItem(PROTECTED_BROWSER_HOLD_KEY,marker);
  assert.equal(firewall.blocked(),true,'cached ready cannot admit writes across retained hold');
  for(const change of [()=>publicStorage.setItem(PROTECTED_BROWSER_HOLD_KEY,'forged'),
    ()=>publicStorage.removeItem(PROTECTED_BROWSER_HOLD_KEY),()=>{publicStorage[PROTECTED_BROWSER_HOLD_KEY]='forged';},
    ()=>{delete publicStorage[PROTECTED_BROWSER_HOLD_KEY];},
    ()=>Object.defineProperty(publicStorage,PROTECTED_BROWSER_HOLD_KEY,{value:'forged'}),
    ()=>publicStorage.setItem('session:original','replacement'),()=>publicStorage.removeItem('session:original')])
    assert.throws(change,e=>e.code==='custodial_protected_state_read_only');
  assert.equal(raw.getItem(PROTECTED_BROWSER_HOLD_KEY),marker);assert.equal(raw.getItem('session:original'),saved);
  raw.removeItem(PROTECTED_BROWSER_HOLD_KEY); // simulate foreign loss, NOT a production thaw
  assert.equal(firewall.blocked(),true);assert.throws(()=>publicStorage.setItem('session:original','replacement'),/cannot change/);
  assert.equal(raw.getItem('session:original'),saved);
  assert.throws(()=>publicStorage.setItem('unrelated-preference','ordinary'),/cannot change/);
  assert.equal(raw.getItem('unrelated-preference'),null,'unclassified rows share the retained original hold');
  console.log('NEW separation hold/firewall owning behavior PASS; synthetic Storage, not all-realm/native separation admission');
  process.exit(0);
}

const local = new TestStorage({
  'session:preserved': 'session-bytes',
  'mz_chatscope_outbox:preserved': 'outbox-bytes',
  'mz_scan_authority_snapshot:KIOSK_08': 'authority-snapshot-bytes',
  'mz_custodial_home_cache:KIOSK_08': 'home-cache-bytes',
  'mz_employee_events_snapshot:KIOSK_08': 'event-snapshot-bytes',
  harmless: 'ordinary-value',
});
const session = new TestStorage();
const raw = createRawStorageAdapter(local);
let status = { initialized: false, ready: false, available: true, quarantined: false };
installCustodialStorageFirewall({ storage: local, getSecurityStatus: () => status });

assert.throws(() => local.setItem('memphisAssignedDeviceId', 'KIOSK_08'), /cannot change/);
assert.throws(() => local.removeItem('session:preserved'), /cannot change/);
assert.throws(() => local.removeItem('mz_scan_authority_snapshot:KIOSK_08'), /cannot change/);
assert.throws(() => local.removeItem('mz_custodial_home_cache:KIOSK_08'), /cannot change/);
assert.throws(() => local.removeItem('mz_employee_events_snapshot:KIOSK_08'), /cannot change/);
assert.throws(() => local.clear(), /cannot change/);
assert.equal(local.getItem('session:preserved'), 'session-bytes');
assert.equal(local.getItem('mz_chatscope_outbox:preserved'), 'outbox-bytes');
assert.equal(local.getItem('mz_scan_authority_snapshot:KIOSK_08'), 'authority-snapshot-bytes');
assert.equal(local.getItem('mz_custodial_home_cache:KIOSK_08'), 'home-cache-bytes');
assert.equal(local.getItem('mz_employee_events_snapshot:KIOSK_08'), 'event-snapshot-bytes');

local.setItem('harmless', 'changed-before-security-ready');
assert.equal(local.getItem('harmless'), 'changed-before-security-ready');
raw.setItem('memphisAssignedDeviceId', 'KIOSK_08');
assert.equal(local.getItem('memphisAssignedDeviceId'), 'KIOSK_08', 'credential store must retain a private raw adapter');

status = { initialized: true, ready: false, available: true, quarantined: false };
assert.throws(() => local.setItem('mz_scan_device_id', 'KIOSK_08'), /cannot change/);
assert.throws(() => local.removeItem('memphis_zoo_custodial_device_credential'), /cannot change/);

status = { initialized: true, ready: true, available: true, quarantined: false };
assert.throws(() => local.setItem('mz_scan_device_id', 'KIOSK_08'), /cannot change/);
assert.equal(local.getItem('mz_scan_device_id'), null);
local.setItem('session:ready-work', 'ready-session');
assert.equal(local.getItem('session:ready-work'), 'ready-session');
assert.throws(() => local.clear(), /cannot change/);

status = { initialized: true, ready: false, available: true, quarantined: true };
assert.throws(() => local.setItem('mz_employee_hub_device_id', 'KIOSK_02'), /cannot change/);
assert.throws(() => local.removeItem('mz_chatscope_outbox:preserved'), /cannot change/);
assert.equal(local.getItem('mz_chatscope_outbox:preserved'), 'outbox-bytes');

session.setItem('session:draft', 'session-storage-is-not-durable-work');
assert.equal(session.getItem('session:draft'), 'session-storage-is-not-durable-work');

console.log('CUSTODIAL_STORAGE_FIREWALL_PASS');
