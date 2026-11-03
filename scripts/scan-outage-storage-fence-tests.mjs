import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {randomUUID,createHash} from 'node:crypto';
import {webcrypto} from 'node:crypto';
import {createScanOwnerVm,closedScanOwnerSource,FixtureStorage} from './scan-owner-vm-context.mjs';
import {createSyntheticScheduleLocks} from './synthetic-schedule-locks.mjs';
import {createProtectedBrowserAdmission,PROTECTED_BROWSER_HOLD_KEY,PROTECTED_BROWSER_MUTATION_KEY}
  from '../mobile/src/custodial/protected-browser-admission.js';

// Actual normalize/storage/claim/settle chain; the IndexedDB transaction adapter
// is synthetic. This is NOT browser crash durability or authenticated acceptance.
const sourcePath=process.argv.find(arg=>arg.startsWith('--legacy-browser-source='))?.slice('--legacy-browser-source='.length);
const source=readFileSync(sourcePath||new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
function slice(from,to){const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
if(process.argv.includes('--legacy-browser-source-pins-only')){
  await legacyBrowserSourcePinCases();process.exit(process.exitCode||0);
}
if(process.argv.includes('--legacy-browser-init-source-only')){
  await legacyBrowserSourcePinCases();process.exit(process.exitCode||0);
}

async function legacyBrowserSourcePinCases(){
  const {createSyntheticScheduleLocks}=await import('./synthetic-schedule-locks.mjs');
  const {PROTECTED_BROWSER_LOCK}=await import('../mobile/src/custodial/protected-browser-admission.js');
  const code=slice('  function custodialSecurity()','  function dispatchSecurityPause(')
    +'\nthis.mutate=mutateProtectedQueue;this.requireLegacy=requireLegacyBrowserMutation;';
  const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
  function fixture({pauseImport=false,optional=false,missingLocks=false,withInit=false,pauseOpen=false,withStatus=false}={}){
    class Storage {
      constructor(){this.rows=new Map();this.writes=[];this.onRead=null;this.onWrite=null;}
      getItem(key){this.onRead?.(key);return this.rows.get(key)??null;}
      setItem(key,value){this.writes.push([key,String(value)]);this.rows.set(key,String(value));this.onWrite?.(key);}
    }
    const local=new Storage(),realLocks=createSyntheticScheduleLocks(),requested=deferred();
    let imports=0,requests=0;
    const locks={request(...args){requests++;requested.resolve();return realLocks.request(...args);}};
    const window={localStorage:local,navigator:{locks:missingLocks?undefined:locks}};
    if(optional)Object.assign(window,{sessionStorage:{},indexedDB:{},crypto:{}});
    const state={deviceId:'original-web-receiver'},importStarted=deferred(),releaseImport=deferred();
    if(!pauseImport)releaseImport.resolve();
    const openEntered=deferred(),releaseOpen=deferred(),database=Object.freeze({fixtureDatabase:true});
    if(!pauseOpen)releaseOpen.resolve();
    const initRecords={resolveCalls:0,listeners:0,opens:[],intervals:0,scheduled:[]};
    const statuses=[],statusDispatched=deferred();
    if(withInit){
      state.deviceId='';state.db=null;
      window.indexedDB={};window.location={href:'https://fixture.invalid/scan'};
      window.MemphisDeviceIdentity={resolve(){initRecords.resolveCalls++;return {deviceId:'original-init-receiver'};}};
      window.setInterval=()=>{initRecords.intervals++;return 1;};
    }
    const context=vm.createContext({window,state,Object,Error,Promise,URL,navigator:window.navigator,
      safeText:value=>String(value??'').trim(),CONFIG:{POLL_MS:10000},
      installWorkerListeners(){initRecords.listeners++;},
      async openDb(ctx){
        ctx.assertCurrent();initRecords.opens.push(ctx.deviceId);openEntered.resolve();
        await releaseOpen.promise;ctx.assertCurrent();return database;
      },
      scheduleSync:delay=>initRecords.scheduled.push(delay),
      dispatchStatus(detail){statuses.push(detail);statusDispatched.resolve();},observeSync(){},sync(){}});
    const initCode=withInit?slice('  function resolveDeviceId()','  function sessionKey(')
      +slice('  async function init()','  function ensureWorkerReady(')+'\nthis.init=init;':'';
    const statusCode=withStatus?slice('  function dispatchSecurityPause(','  function scheduleSync(')
      +'\nthis.observe=observeSync;':'';
    new vm.Script(code+initCode+statusCode,{filename:'actual-scan-browser-source-pins',importModuleDynamically:async specifier=>{
      assert.equal(specifier,'./mobile/src/custodial/protected-browser-admission.js');
      imports++;importStarted.resolve();await releaseImport.promise;
      return import('../mobile/src/custodial/protected-browser-admission.js');
    }}).runInContext(context);
    return {window,state,context,local,Storage,locks,realLocks,requested,importStarted,releaseImport,
      imports:()=>imports,requests:()=>requests,initRecords,openEntered,releaseOpen,database,statuses,statusDispatched};
  }
  const settled=promise=>promise.then(value=>({value}),error=>({error}));
  function denied(result){assert.ok(result.error,'Original source withdrawal must refuse, not confirm successor work');}
  function noStamp(area){assert.equal(area.rows.get(PROTECTED_BROWSER_MUTATION_KEY),undefined);}
  const cases={
    async 'init-original-receiver'(){
      const f=fixture({withInit:true});
      const result=await settled(f.context.init());
      assert.equal(result.value,true,'Actual init must admit its originally resolved browser receiver');
      assert.equal(result.error,undefined);assert.equal(f.state.deviceId,'original-init-receiver');
      assert.equal(f.initRecords.resolveCalls,1);assert.deepEqual(f.initRecords.opens,['original-init-receiver']);
      assert.equal(f.state.db,f.database);assert.equal(f.initRecords.intervals,1);
      assert.deepEqual(f.initRecords.scheduled,[900]);assert.equal(f.imports(),1);
    },
    async 'init-import-receiver-withdrawal'(){
      const f=fixture({withInit:true,pauseImport:true}),pending=settled(f.context.init());
      await f.importStarted.promise;assert.equal(f.state.deviceId,'original-init-receiver');
      f.state.deviceId='successor-init-receiver';f.releaseImport.resolve();denied(await pending);
      assert.equal(f.state.deviceId,'successor-init-receiver','Never overwrite/adopt a successor after the await');
      assert.deepEqual(f.initRecords.opens,[]);assert.equal(f.state.db,null);
      assert.equal(f.initRecords.resolveCalls,1);assert.equal(f.initRecords.intervals,0);noStamp(f.local);
    },
    async 'init-queued-native-withdrawal'(){
      const f=fixture({withInit:true}),entered=deferred(),release=deferred();
      const blocker=f.realLocks.request(PROTECTED_BROWSER_LOCK,{mode:'exclusive'},async()=>{
        entered.resolve();await release.promise;
      });
      await entered.promise;const pending=settled(f.context.init());await f.requested.promise;
      f.window.MemphisMobile={edition:'custodial'};release.resolve();await blocker;denied(await pending);
      assert.deepEqual(f.initRecords.opens,[]);assert.equal(f.state.db,null);noStamp(f.local);
      assert.equal(f.initRecords.intervals,0);assert.equal(f.initRecords.resolveCalls,1);
    },
    async 'init-empty-and-unavailable-receivers'(){
      const empty=fixture({withInit:true});delete empty.window.MemphisDeviceIdentity;
      assert.equal(await empty.context.init(),true);
      assert.equal(empty.state.deviceId,'','No synthetic device ID may replace missing resolver DATA');
      assert.deepEqual(empty.initRecords.opens,['']);assert.equal(empty.state.db,empty.database);
      const unavailable=fixture({withInit:true});delete unavailable.window.indexedDB;
      assert.equal(await unavailable.context.init(),false);assert.equal(unavailable.state.deviceId,'');
      assert.equal(unavailable.initRecords.resolveCalls,0);assert.equal(unavailable.imports(),0);
      assert.deepEqual(unavailable.initRecords.opens,[]);assert.equal(unavailable.initRecords.intervals,0);
      noStamp(unavailable.local);
    },
    async 'init-open-port-terminal-withdrawal'(){
      const f=fixture({withInit:true,pauseOpen:true}),pending=settled(f.context.init());
      await f.openEntered.promise;assert.deepEqual(f.initRecords.opens,['original-init-receiver']);
      assert.equal(f.initRecords.intervals,0);assert.equal(f.state.db,null);
      f.state.deviceId='successor-init-receiver';f.releaseOpen.resolve();denied(await pending);
      assert.equal(f.state.db,null);assert.equal(f.initRecords.intervals,0);
      assert.equal(f.initRecords.resolveCalls,1);assert.deepEqual(f.initRecords.scheduled,[]);
      assert.equal(f.local.rows.get(PROTECTED_BROWSER_MUTATION_KEY),'1','Retain the original epoch, never roll back');
    },
    async 'init-selection-withdrawal'(){
      for(const changed of ['receiver','native']){
        const f=fixture({withInit:true});
        f.window.MemphisDeviceIdentity.resolve=()=>{
          if(changed==='receiver')f.state.deviceId='successor-before-import';
          else f.window.MemphisMobileBuildIdentity={edition:'custodial'};
          return {deviceId:'original-init-receiver'};
        };
        denied(await settled(f.context.init()));assert.equal(f.imports(),0);noStamp(f.local);
        assert.deepEqual(f.initRecords.opens,[]);assert.equal(f.state.db,null);
        assert.equal(f.state.deviceId,changed==='receiver'?'successor-before-import':'');
      }
    },
    async 'import-receiver'(){
      const f=fixture({pauseImport:true});let calls=0;
      const pending=settled(f.context.mutate(ctx=>{calls++;f.local.setItem('fixture-work',ctx.deviceId);}));
      await f.importStarted.promise;f.state.deviceId='successor-web-receiver';f.releaseImport.resolve();
      const result=await pending;
      assert.equal(calls,0,'Receiver replaced during import must not enter successor callback');
      denied(result);noStamp(f.local);assert.equal(f.local.rows.get('fixture-work'),undefined);
    },
    async 'import-storage'(){
      const f=fixture({pauseImport:true}),successor=new f.Storage();let calls=0;
      const pending=settled(f.context.mutate(ctx=>{calls++;f.window.localStorage.setItem('fixture-work',ctx.deviceId);}));
      await f.importStarted.promise;f.window.localStorage=successor;f.releaseImport.resolve();
      const result=await pending;
      assert.equal(calls,0,'Storage replaced during import must not receive successor callback');
      denied(result);noStamp(f.local);noStamp(successor);assert.deepEqual(successor.writes,[]);
    },
    async 'import-request'(){
      const f=fixture({pauseImport:true});let calls=0,successorRequests=0;
      const pending=settled(f.context.mutate(()=>{calls++;}));
      await f.importStarted.promise;f.locks.request=(...args)=>{successorRequests++;return f.realLocks.request(...args);};
      f.releaseImport.resolve();const result=await pending;
      denied(result);assert.equal(calls,0);assert.equal(successorRequests,0);noStamp(f.local);
    },
    async 'import-native-sticky'(){
      const f=fixture({pauseImport:true});let calls=0;
      const pending=settled(f.context.mutate(()=>{calls++;}));
      await f.importStarted.promise;f.window.MemphisMobile={edition:'custodial'};
      f.releaseImport.resolve();denied(await pending);
      delete f.window.MemphisMobile;
      denied(await settled(f.context.mutate(()=>{calls++;})));
      assert.equal(calls,0);noStamp(f.local);
    },
    async 'queued-originals'(){
      for(const changed of ['receiver','storage','request']){
        const f=fixture(),entered=deferred(),release=deferred();let calls=0;
        const blocker=f.realLocks.request(PROTECTED_BROWSER_LOCK,{mode:'exclusive'},async()=>{
          entered.resolve();await release.promise;
        });
        await entered.promise;
        const pending=settled(f.context.mutate(()=>{calls++;}));
        await f.requested.promise;
        const originalRequest=f.locks.request,successor=new f.Storage();
        if(changed==='receiver')f.state.deviceId='successor-web-receiver';
        if(changed==='storage')f.window.localStorage=successor;
        if(changed==='request')f.locks.request=(...args)=>f.realLocks.request(...args);
        release.resolve();await blocker;denied(await pending);
        assert.equal(calls,0);noStamp(f.local);noStamp(successor);
        if(changed!=='receiver'){
          f.window.localStorage=f.local;f.locks.request=originalRequest;
          denied(await settled(f.context.mutate(()=>{calls++;})));
          assert.equal(calls,0,'Observed resource A-B-A must stay revoked');
        }
      }
    },
    async 'receiver-callback-lifetime'(){
      const f=fixture(),entered=deferred(),release=deferred();let originalContext;
      const pending=settled(f.context.mutate(async ctx=>{
        originalContext=ctx;entered.resolve();await release.promise;ctx.assertCurrent();
      }));
      await entered.promise;f.state.deviceId='successor-web-receiver';
      assert.throws(()=>originalContext.assertCurrent());
      f.state.deviceId='original-web-receiver';release.resolve();denied(await pending);
      f.state.deviceId='later-legitimate-receiver';
      assert.equal(await f.context.mutate(ctx=>{
        assert.throws(()=>originalContext.assertCurrent(),'Closed callback must not borrow a later active mutation');
        f.context.requireLegacy();ctx.assertCurrent();return ctx.deviceId;
      }),'later-legitimate-receiver');
    },
    async 'queued-native-withdrawal'(){
      const f=fixture(),entered=deferred(),release=deferred();let calls=0;
      const blocker=f.realLocks.request(PROTECTED_BROWSER_LOCK,{mode:'exclusive'},async()=>{
        entered.resolve();await release.promise;
      });
      await entered.promise;const pending=settled(f.context.mutate(()=>{calls++;}));
      await f.requested.promise;f.window.MemphisMobileBuildIdentity={edition:'custodial'};
      release.resolve();await blocker;denied(await pending);assert.equal(calls,0);noStamp(f.local);
      delete f.window.MemphisMobileBuildIdentity;
      denied(await settled(f.context.mutate(()=>{calls++;})));assert.equal(calls,0);noStamp(f.local);
    },
    async 'epoch-write-terminal-source'(){
      for(const changed of ['storage','receiver']){
        const f=fixture(),successor=new f.Storage();let calls=0;
        f.local.onWrite=key=>{
          if(key!==PROTECTED_BROWSER_MUTATION_KEY)return;
          if(changed==='storage')f.window.localStorage=successor;
          else f.state.deviceId='successor-web-receiver';
        };
        denied(await settled(f.context.mutate(()=>{calls++;})));assert.equal(calls,0);
        assert.equal(f.local.rows.get(PROTECTED_BROWSER_MUTATION_KEY),'1','Original epoch write is retained on unknown result');
        assert.deepEqual(successor.writes,[]);f.local.onWrite=null;
        f.window.localStorage=f.local;f.state.deviceId='original-web-receiver';
        denied(await settled(f.context.mutate(()=>{calls++;})));assert.equal(calls,0);
        assert.equal(f.local.rows.get(PROTECTED_BROWSER_MUTATION_KEY),'1','No rollback or blind retry');
      }
    },
    async 'epoch-source-checks'(){
      for(const changed of ['request','method','firewall']){
        const f=fixture();let calls=0,observed=false;
        const originalRequest=f.locks.request,prototype=Object.getPrototypeOf(f.local);
        const descriptor=Object.getOwnPropertyDescriptor(prototype,'setItem');
        f.local.onRead=key=>{
          if(key!==PROTECTED_BROWSER_HOLD_KEY||observed)return;
          observed=true;
          if(changed==='request')f.locks.request=(...args)=>f.realLocks.request(...args);
          if(changed==='method')prototype.setItem=function(){throw new Error('Successor method must not run');};
          if(changed==='firewall')Object.defineProperty(prototype,'setItem',{...descriptor,writable:false,configurable:false});
        };
        denied(await settled(f.context.mutate(()=>{calls++;})));
        assert.equal(observed,true);assert.equal(calls,0);assert.deepEqual(f.local.writes,[]);
        f.local.onRead=null;f.locks.request=originalRequest;
        if(changed==='method')Object.defineProperty(prototype,'setItem',descriptor);
        denied(await settled(f.context.mutate(()=>{calls++;})));
        assert.equal(calls,0);noStamp(f.local);
      }
    },
    async 'minimal-successive-receivers'(){
      const f=fixture();let oldContext;
      assert.equal(await f.context.mutate(ctx=>{
        oldContext=ctx;f.context.requireLegacy();ctx.assertCurrent();
        f.local.setItem('first-fixture-work',ctx.deviceId);return ctx.deviceId;
      }),'original-web-receiver');
      f.state.deviceId='second-legitimate-receiver';
      assert.equal(await f.context.mutate(ctx=>{
        assert.throws(()=>oldContext.assertCurrent());f.context.requireLegacy();ctx.assertCurrent();
        f.local.setItem('second-fixture-work',ctx.deviceId);return ctx.deviceId;
      }),'second-legitimate-receiver');
      assert.equal(f.imports(),1);assert.equal(f.requests(),2);
      assert.equal(f.local.rows.get(PROTECTED_BROWSER_MUTATION_KEY),'2');
      assert.equal(f.local.rows.get('first-fixture-work'),'original-web-receiver');
      assert.equal(f.local.rows.get('second-fixture-work'),'second-legitimate-receiver');
      assert.throws(()=>f.context.requireLegacy());
      assert.equal('sessionStorage' in f.window,false);assert.equal('indexedDB' in f.window,false);
      assert.equal('crypto' in f.window,false);
    },
    async 'optional-source-pins'(){
      for(const port of ['sessionStorage','indexedDB','crypto']){
        const f=fixture({pauseImport:true,optional:true});let calls=0;
        const original=f.window[port],pending=settled(f.context.mutate(()=>{calls++;}));
        await f.importStarted.promise;f.window[port]={};f.releaseImport.resolve();
        denied(await pending);f.window[port]=original;
        denied(await settled(f.context.mutate(()=>{calls++;})));
        assert.equal(calls,0);noStamp(f.local);
      }
    },
    async 'unreadable-unused-ports'(){
      const f=fixture();let calls=0;
      for(const port of ['sessionStorage','indexedDB','crypto']){
        Object.defineProperty(f.window,port,{get(){throw new Error('Unused inventory port is blocked');}});
      }
      const result=await settled(f.context.mutate(ctx=>{
        ctx.assertCurrent();f.context.requireLegacy();calls++;
        f.local.setItem('fixture-work',ctx.deviceId);return ctx.deviceId;
      }));
      assert.equal(calls,1,'Only original localStorage and shared locks are required for mutation');
      assert.equal(result.error,undefined);assert.equal(result.value,'original-web-receiver');
      assert.equal(f.local.rows.get(PROTECTED_BROWSER_MUTATION_KEY),'1');
    },
    async 'missing-lock-and-unreadable'(){
      const f=fixture({missingLocks:true,withStatus:true});let calls=0;
      f.state.lastError='original-last-error-fixture-data';
      const result=await settled(f.context.mutate(()=>{calls++;}));
      f.context.observe(Promise.reject(result.error));await f.statusDispatched.promise;
      console.log('MISSING_LOCK_STATUS '+JSON.stringify({code:result.error?.code,reason:result.error?.reason,
        status:f.statuses[0]?.status}));
      assert.equal(result.error?.code,'custodial_security_state_unavailable');
      assert.equal(result.error?.reason,'browser_shared_lock_unavailable');
      assert.equal(f.statuses.length,1);assert.equal(f.statuses[0].status,'security-paused');
      assert.equal(f.statuses[0].reason,'browser_shared_lock_unavailable');assert.equal(f.statuses[0].recovery,null);
      assert.equal(f.state.lastError,'original-last-error-fixture-data','Protected pause must not enter worker-error mapping');
      assert.equal(calls,0);noStamp(f.local);assert.equal(f.imports(),0);
      const unreadable=fixture();
      Object.defineProperty(unreadable.window,'localStorage',{get(){throw new Error('Unreadable original storage');}});
      denied(await settled(unreadable.context.mutate(()=>{calls++;})));assert.equal(calls,0);noStamp(unreadable.local);
    },
    async 'terminal-withdrawal'(){
      for(const changed of ['storage','native']){
        const f=fixture(),entered=deferred(),release=deferred();let calls=0;
        const pending=settled(f.context.mutate(async ctx=>{
          ctx.assertCurrent();f.local.setItem('original-fixture-work',ctx.deviceId);calls++;
          entered.resolve();await release.promise;
        }));
        await entered.promise;
        if(changed==='storage')f.window.localStorage=new f.Storage();
        else f.window.MemphisMobileBuildIdentity={edition:'custodial'};
        release.resolve();denied(await pending);
        assert.equal(calls,1,'Already-settled original effect is retained, never rolled back/retried');
        assert.equal(f.local.rows.get('original-fixture-work'),'original-web-receiver');
        assert.equal(f.local.rows.get(PROTECTED_BROWSER_MUTATION_KEY),'1');
      }
    },
    async 'existing-hold'(){
      const f=fixture();f.local.rows.set(PROTECTED_BROWSER_HOLD_KEY,'retained-hold-data');let calls=0;
      denied(await settled(f.context.mutate(()=>{calls++;})));
      assert.equal(calls,0);assert.equal(f.local.rows.get(PROTECTED_BROWSER_HOLD_KEY),'retained-hold-data');
      assert.deepEqual(f.local.writes,[]);
    },
  };
  const selected=process.argv.find(arg=>arg.startsWith('--source-pin-case='))?.slice('--source-pin-case='.length);
  if(selected)assert.ok(Object.hasOwn(cases,selected),'Known new source-pin case required');
  for(const [name,run] of Object.entries(cases)){
    if(selected&&name!==selected)continue;
    if(process.argv.includes('--legacy-browser-init-source-only')&&!name.startsWith('init-'))continue;
    await run();console.log('PASS SCAN_BROWSER_SOURCE_PINS '+name);
  }
}
if(process.argv.includes('--queue-lock-admission-only')){
  await queueLockAdmissionCases();process.exit(process.exitCode||0);
}
if(process.argv.includes('--legacy-browser-preservation-only')){
  await legacyBrowserPreservationCases();process.exit(process.exitCode||0);
}
const finishOwnerOnly=process.argv.includes('--finish-claim-original-owner-only');
if(finishOwnerOnly){await originalCompletionRecovery();process.exit(process.exitCode||0);}
if(process.argv.includes('--scan-index-confirmation-callers-only')){
  await scanIndexConfirmationCallers();
  process.exit(process.exitCode||0);
}
if(process.argv.includes('--original-completion-recovery-only') || process.argv.includes('--completion-cleanup-await-only')
  || process.argv.includes('--completion-frozen-evidence-only') || process.argv.includes('--completion-settlement-status-only')
  || process.argv.includes('--completion-owner-events-only')){
  await originalCompletionRecovery();
  process.exit(process.exitCode||0);
}

async function queueLockAdmissionCases(){
  const {createSyntheticScheduleLocks}=await import('./synthetic-schedule-locks.mjs');
  const oldStart=source.indexOf('  function acquireFallbackLock()');
  const queueCode=(oldStart<0?'':source.slice(oldStart,source.indexOf('  async function withQueueLock(',oldStart)))
    +slice('  async function withQueueLock(','  async function enqueue(');
  const code=slice('  function custodialSecurity()','  function dispatchSecurityPause(')
    +slice('  function queueOpeningCheckpoint(','  function queueOpeningConnection(')
    +queueCode+'\nthis.lock=withQueueLock;this.mutate=mutateProtectedQueue;';
  const selected=process.argv.find(x=>x.startsWith('--queue-lock-case='))?.split('=')[1];let passed=0;
  const KEY='mz_scan_sync_worker_lock_v4',OP='11111111-1111-4111-8111-111111111111';
  const tick=()=>new Promise(setImmediate);
  function fixture(){
    const rows=new Map([['session:retained','{ exact original }']]),effects=[],locks=createSyntheticScheduleLocks();
    const storage={getItem:k=>rows.get(k)??null,setItem:(k,v)=>{effects.push(['set',k,String(v)]);rows.set(k,String(v));},
      removeItem:k=>{effects.push(['remove',k]);rows.delete(k);},key:i=>[...rows.keys()][i]??null,get length(){return rows.size;}};
    const navigator={locks},timers=new Map();let uuidCalls=0,startedTimers=0;
    const window={localStorage:storage,sessionStorage:storage,navigator,indexedDB:{databases:async()=>[]},crypto:webcrypto,
      setTimeout,clearTimeout,setInterval:fn=>{startedTimers++;timers.set(startedTimers,fn);return startedTimers;},clearInterval:id=>timers.delete(id)};
    const state={deviceId:'web-fixture',workerId:'scan-worker-22222222-2222-4222-8222-222222222222'};
    const context=vm.createContext({window,navigator,localStorage:storage,state,crypto:{randomUUID(){uuidCalls++;return randomUUID();}},
      CONFIG:{FALLBACK_LOCK_KEY:KEY,FALLBACK_LOCK_TTL_MS:75000,FALLBACK_LOCK_WAIT_MS:90000,FALLBACK_LOCK_HEARTBEAT_MS:15000,WEB_LOCK_NAME:'scan-queue-fixture'},
      now:()=>100000,safeText:x=>String(x??''),setTimeout,clearTimeout,Object,Error,Promise});
    new vm.Script(code,{filename:'actual-scan-queue-lock',importModuleDynamically:s=>{
      assert.equal(s,'./mobile/src/custodial/protected-browser-admission.js');return import('../mobile/src/custodial/protected-browser-admission.js');
    }}).runInContext(context);
    return {window,navigator,storage,rows,effects,locks,context,timers,uuidCalls:()=>uuidCalls,startedTimers:()=>startedTimers};
  }
  const unavailable=error=>error.code==='custodial_security_state_unavailable';
  async function run(name,body){if(selected&&name!==selected)return;await body();passed++;console.log('PASS_NEW_QUEUE_LOCK '+name);}
  await run('missing-lock-cannot-mutate-held-metadata-before-queue-refusal',async()=>{
    const x=fixture(),holder=createProtectedBrowserAdmission({storage:x.storage,locks:x.locks});
    await holder.holdAndObserve({operationId:OP});x.navigator.locks=undefined;let calls=0;
    const before=JSON.stringify([...x.rows]);let error;
    try{await x.context.lock(()=>{calls++;return true;},{ifAvailable:true});}catch(e){error=e;}
    assert.equal(x.effects.filter(([,key])=>key===KEY).length,0,'actual unsupported queue path must not write/delete captured fallback metadata');
    assert(error&&unavailable(error));assert.equal(calls,0);assert.equal(x.uuidCalls(),0);
    assert.equal(x.startedTimers(),0);assert.equal(JSON.stringify([...x.rows]),before);
  });
  await run('missing-shared-owner-already-refuses-the-shipping-mutation',async()=>{
    const x=fixture();x.navigator.locks=undefined;let calls=0;
    await assert.rejects(()=>x.context.mutate(()=>calls++),error=>error.code==='browser_shared_lock_unavailable');
    assert.equal(calls,0);assert.equal(x.effects.filter(([,key])=>key===KEY).length,0);
  });
  await run('supported-web-lock-waits-through-original-operation',async()=>{
    const x=fixture();let release,entered=false,done=false;
    const pending=x.context.lock(async c=>{assert.equal(c.recoverClaimsImmediately,true);entered=true;
      await new Promise(r=>release=r);return 'original-settled';},{ifAvailable:true}).then(v=>{done=true;return v;});
    await tick();assert.equal(entered,true);assert.equal(done,false);release();assert.equal(await pending,'original-settled');
    assert.equal(x.effects.length,0);assert.equal(x.uuidCalls(),0);assert.equal(x.startedTimers(),0);assert.equal(x.locks.pending,0);
  });
  await run('invalid-or-missing-lock-is-immediate-visible-unavailability',async()=>{
    for(const locks of [undefined,{}, {request:true}]){
      const x=fixture();x.navigator.locks=locks;let called=0;
      await assert.rejects(()=>x.context.lock(()=>called++),unavailable);
      assert.equal(called,0);assert.equal(x.uuidCalls(),0);assert.equal(x.startedTimers(),0);
      assert.equal(x.effects.length,0);assert.equal(x.storage.getItem('session:retained'),'{ exact original }');
    }
  });
  assert(passed>0);console.log(JSON.stringify({scope:'actual queue-lock source/actual browser owner; synthetic Storage and lock ports',
    passed,Android:false,SQL:false,network:false,clock_profile:false,ACK:false,old_groups_run:0}));
}

async function legacyBrowserPreservationCases(){
  const tick=()=>new Promise(setImmediate),passed=[];
  const code=slice('  function custodialSecurity()','  function dispatchSecurityPause(')
    +'\nthis.mutate=mutateProtectedQueue;this.check=queueOpeningCheckpoint;this.requireLegacy=requireLegacyBrowserMutation;'
    +slice('  function queueOpeningCheckpoint(','  function queueOpeningConnection(');
  function area(){const rows=new Map();return {rows,getItem:key=>rows.get(key)??null,
    setItem:(key,value)=>rows.set(key,String(value)),removeItem:key=>rows.delete(key),
    key:index=>[...rows.keys()][index]??null,get length(){return rows.size;}};}
  function fixture({missingLocks=false,native=null}={}){
    const local=area(),session=area(),indexedDb={databases:async()=>[],open(){throw Error('No fixture database exists');}};
    let tail=Promise.resolve(),active=0,imports=0;
    const locks={request(name,options,operation){
      const next=tail.then(async()=>{active++;try{return await operation({name,mode:'exclusive'});}finally{active--;}});
      tail=next.catch(()=>{});return next;
    }};
    const window={localStorage:local,sessionStorage:session,indexedDB:indexedDb,
      navigator:{locks:missingLocks?undefined:locks},crypto:webcrypto};
    if(native)window.MemphisCustodialSecurity=native;
    const context=vm.createContext({window,state:{deviceId:'web-fixture'},Object,Error,Promise,
      safeText:value=>String(value??''),setTimeout,clearTimeout});
    new vm.Script(code,{filename:'actual-scan-legacy-admission',importModuleDynamically:async specifier=>{
      assert.equal(specifier,'./mobile/src/custodial/protected-browser-admission.js');imports++;
      return import('../mobile/src/custodial/protected-browser-admission.js');
    }}).runInContext(context);
    return {context,window,local,session,locks,indexedDb,active:()=>active,imports:()=>imports};
  }
  const selected=process.argv.find(arg=>arg.startsWith('--case='))?.slice(7);
  async function run(name,body){if(selected&&!name.includes(selected))return;await body();passed.push(name);console.log('PASS_SOURCE_VM '+name);}
  await run('LEGACY_BROWSER_NEW existing hold blocks callback before original DATA write',async()=>{
    const f=fixture();f.local.setItem(PROTECTED_BROWSER_HOLD_KEY,'retained-denial-fixture');let called=0;
    await assert.rejects(()=>f.context.mutate(()=>{called++;f.local.setItem('session:original','changed');}),
      error=>error.code==='custodial_browser_preservation_pending');
    assert.equal(called,0);assert.equal(f.local.getItem('session:original'),null);assert.equal(f.active(),0);
  });
  await run('LEGACY_BROWSER_NEW actual shared hold waits for original terminal callback',async()=>{
    const f=fixture();let release,entered=false,retained;
    const pending=f.context.mutate(async context=>{entered=true;retained=context;
      await new Promise(resolve=>{release=resolve;});context.assertCurrent();f.local.setItem('session:original','exact');return 'committed';});
    while(!entered)await tick();assert.equal(f.active(),1);
    const holder=createProtectedBrowserAdmission({storage:f.local,sessionStorage:f.session,indexedDb:f.indexedDb,locks:f.locks,cryptoApi:webcrypto});
    const hold=holder.holdAndObserve({operationId:'11111111-1111-4111-8111-111111111111'});
    await tick();assert.equal(f.local.getItem(PROTECTED_BROWSER_HOLD_KEY),null);
    release();assert.equal(await pending,'committed');await hold;
    assert.equal(f.local.getItem('session:original'),'exact');assert.notEqual(f.local.getItem(PROTECTED_BROWSER_HOLD_KEY),null);
    assert.throws(()=>retained.assertCurrent());assert.equal(f.active(),0);assert.equal(f.imports(),1);
    await assert.rejects(()=>f.context.mutate(()=>{throw Error('Must not run');}));assert.equal(f.imports(),1);
  });
  await run('LEGACY_BROWSER_NEW epoch change across await refuses before DATA continuation',async()=>{
    const f=fixture();let release,entered=false;
    const pending=f.context.mutate(async context=>{entered=true;await new Promise(resolve=>{release=resolve;});
      context.assertCurrent();f.local.setItem('session:original','wrong');});
    while(!entered)await tick();f.local.setItem(PROTECTED_BROWSER_MUTATION_KEY,'99');release();
    await assert.rejects(()=>pending,error=>error.code==='custodial_security_state_unavailable');
    assert.equal(f.local.getItem('session:original'),null);assert.equal(f.active(),0);
  });
  await run('LEGACY_BROWSER_NEW native appearance and missing lock never fall through',async()=>{
    const f=fixture();let release,entered=false,calls=0;
    const pending=f.context.mutate(async context=>{entered=true;await new Promise(resolve=>{release=resolve;});context.assertCurrent();calls++;});
    while(!entered)await tick();f.window.MemphisMobile={edition:'custodial'};release();
    await assert.rejects(()=>pending,error=>error.code==='custodial_security_state_unavailable');assert.equal(calls,0);
    const absent=fixture({missingLocks:true});await assert.rejects(()=>absent.context.mutate(()=>calls++),error=>error.code==='browser_shared_lock_unavailable');
    assert.equal(calls,0);
  });
  await run('LEGACY_BROWSER_NEW native admission retains exact original context no web import',async()=>{
    const original={deviceId:'native-fixture',assertCurrent(){}},failure=Object.assign(Error('denied'),{code:'native-denied'});
    let calls=0,denied=false;
    const native={native:true,getStatus:()=>({ready:true}),waitForStableState:async()=>{},
      mutateProtectedWork(operation){if(denied)throw failure;return operation(original);}};
    const f=fixture({native});await f.context.mutate(context=>{assert.equal(context,original);calls++;});
    denied=true;await assert.rejects(()=>f.context.mutate(()=>calls++),error=>error===failure);
    assert.equal(calls,1);assert.equal(f.imports(),0);assert.equal(f.active(),0);
  });
  await run('LEGACY_BROWSER_JOIN synchronous checkpoint cannot admit itself or survive callback',async()=>{
    const f=fixture();assert.throws(()=>f.context.requireLegacy());let retained;
    await f.context.mutate(context=>{retained=context;context.assertCurrent();f.context.requireLegacy();
      f.local.setItem('session:original','exact');});
    assert.equal(f.local.getItem('session:original'),'exact');
    assert.throws(()=>f.context.requireLegacy());assert.throws(()=>retained.assertCurrent());assert.equal(f.active(),0);
  });
  await run('LEGACY_BROWSER_JOIN actual page writer uses queue owner and refuses successor',async()=>{
    const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
    const first=html.indexOf('    async function mutateCustodialWork('),last=html.indexOf('    function updateDebugPanel(',first);
    assert.ok(first>=0&&last>first);const f=fixture();
    f.window.MemphisScanSync={mutateProtectedWork:f.context.mutate};
    f.context.scanMutationSecurity=()=>f.context.queueMutationSecurity();
    f.context.scanSecurityUnavailable=()=>f.context.queueSecurityUnavailable();
    vm.runInContext(html.slice(first,last)+'\nthis.pageMutate=mutateCustodialWork;',f.context);
    await f.context.pageMutate(context=>{context.assertCurrent();f.context.requireLegacy();f.local.setItem('session:original','exact');});
    assert.equal(f.local.getItem('session:original'),'exact');assert.equal(f.active(),0);
    let entered=false,release;
    const pending=f.context.pageMutate(async context=>{entered=true;await new Promise(resolve=>{release=resolve;});context.assertCurrent();});
    while(!entered)await tick();f.window.MemphisScanSync={mutateProtectedWork:f.context.mutate};release();
    await assert.rejects(()=>pending,error=>error.code==='custodial_security_state_unavailable');
    assert.equal(f.local.getItem('session:original'),'exact');assert.equal(f.active(),0);
    f.local.setItem(PROTECTED_BROWSER_HOLD_KEY,'retained-denial-fixture');let called=0;
    await assert.rejects(()=>f.context.pageMutate(()=>called++));assert.equal(called,0);
  });
  assert.ok(passed.length,'No newly affected legacy browser member matched');
  console.log(JSON.stringify({status:'PASS_SOURCE_VM_NEW_LEGACY_BROWSER_ADMISSION',cases:passed,
    actual_module_and_queue_source:true,storage_and_lock_synthetic:true,browser:false,SQL:false,Android:false,ACK:false}));
}

async function scanIndexConfirmationCallers(){
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const uiSource=readFileSync(new URL('../memphis-ui.js',import.meta.url),'utf8');
  const part=(text,from,to)=>{const a=text.indexOf(from),b=text.indexOf(to,a);assert.ok(a>=0&&b>a,from);return text.slice(a,b);};
  const callerCode=part(html,'    let scanNativeSecurityRequired=','    guardedStart().catch(')
    +part(html,'    async function mutateCustodialWork(','    function updateDebugPanel(')
    +part(html,'    function captureScanViewConfirmation(','    async function removeLocalSession(');
  const queueCode=slice('  function custodialSecurity()','  function dispatchSecurityPause(')
    +slice('  function queueOpeningCheckpoint(','  function queueOpeningConnection(')
    +slice('  function sessionKey(','  function allSessions(')
    +slice('  const nativeLegacyCompletionBindings = new WeakMap();','  async function saveCompletedLocalWork(');
  function fixture({native=true}={}){
    const rows=new Map(),queue=[],device='KIOSK_08';let active=false,admissions=0,afterAdmission=null,outer=false;
    const status={ready:true,available:true,quarantined:false,state:'enrolled',deviceId:device,generation:7,
      principal:{schema_version:'custodial-protected-principal.v1',device_id:device,
        employee_id:'00000000-0000-4000-8000-000000000001',credential_id:'00000000-0000-4000-8000-000000000002',
        credential_operation_id:'00000000-0000-4000-8000-000000000003',assignment_epoch:3,
        installation_seal:'synthetic-installation-seal',enrolled_at:'2026-10-14T12:00:00.000Z'}};
    const storage={getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,String(v)),removeItem:k=>rows.delete(k),
      key:i=>[...rows.keys()][i]??null,get length(){return rows.size;}};
    const window={location:new URL('https://fixture.invalid/scan.html?device=KIOSK_08'),localStorage:storage,
      sessionStorage:storage,addEventListener(){},confirm:()=>true};window.top=window;window.self=window;
    const security={native:true,getStatus:()=>structuredClone(status),waitForStableState:async()=>structuredClone(status),
      async mutateProtectedWork(operation,options={}){
        assert.equal(active,false,'a confirmed index writer must not nest admission');
        if(options.expectedGeneration!=null&&options.expectedGeneration!==status.generation)throw Error('original generation changed');
        const generation=status.generation,principal=JSON.stringify(status.principal);
        const context=Object.freeze({deviceId:device,generation,state:'enrolled',assertCurrent(){
          if(!active||status.generation!==generation||JSON.stringify(status.principal)!==principal)throw Error('original callback closed or changed');}});
        active=true;admissions++;let result;
        try{result=await operation(context);context.assertCurrent();}finally{active=false;}
        if(afterAdmission)afterAdmission(admissions);return result;
      }};
    if(native){window.MemphisCustodialSecurity=security;window.MemphisMobile={edition:'custodial',principalIdentity:()=>JSON.stringify(status.principal)};}
    const sandbox={window,document:{body:{dataset:{memphisContext:'employee'}},documentElement:{classList:{add(){}},hidden:false},
      readyState:'loading',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],visibilityState:'visible'},
      URL,URLSearchParams,console,structuredClone,localStorage:storage,sessionStorage:storage,
      navigator:{userAgent:'Synthetic source fixture'},Element:class{},HTMLAnchorElement:class{},HTMLFormElement:class{},
      safeText:x=>String(x??'').trim(),canonicalJson:JSON.stringify,isUuid:x=>/^[0-9a-f-]{36}$/.test(x),
      storageFailure:(name,error)=>Error(name+': '+error.message),managerRecoveryError:message=>Error(message),
      state:{deviceId:device},currentDeviceId:device,
      sessionStorageKey:id=>'session:'+id,getLocalSessionById:id=>JSON.parse(rows.get('session:'+id)||'null'),
      mutateLocalSessions:async operation=>{assert.equal(outer,false);outer=true;try{return await operation();}finally{outer=false;}}};
    const context=vm.createContext(sandbox);vm.runInContext(uiSource,context,{filename:'actual-memphis-ui.js',timeout:1000});
    vm.runInContext(callerCode+queueCode,context,{filename:'actual-scan-confirmation-callers',timeout:1000});
    window.MemphisScanSync={isLocallyCompleted:context.isLocallyCompleted};
    sandbox.enqueueUnlocked=async(action,expectedGeneration)=>context.mutateProtectedQueue(()=>{
      queue.push(structuredClone(action));return queue.length;
    },{requireEnrollment:true,...(expectedGeneration==null?{}:{expectedGeneration})});
    const id='11111111-1111-4111-8111-111111111111',completion='22222222-2222-4222-8222-222222222222';
    const session={session_uuid:id,client_session_id:id,client_completion_id:completion,device_id:device,
      location_code:'NOCX',location_name:'Nocturnal',status:'active',started_at:'2026-10-14T12:00:00.000Z',
      ended_at:'2026-10-14T12:05:00.000Z',native_finish_scan_entry_id:'33333333-3333-4333-8333-333333333333',
      response_json:{work_result:'checked_no_cleaning_needed',services_performed:[]}};
    const action={type:'commit_workflow',payload:{p_client_session_id:id,p_client_completion_id:completion,p_device_id:device,
      p_location_code:session.location_code,p_client_started_at:session.started_at,p_client_ended_at:session.ended_at,
      p_native_finish_scan_entry_id:session.native_finish_scan_entry_id,p_response_json:structuredClone(session.response_json)}};
    return {context,window,rows,queue,status,session,action,key:'session:'+id,index:'mz_phone_scan_resume:'+device,
      after(fn){afterAdmission=fn;},admissions:()=>admissions,active:()=>active};
  }
  const selected=process.argv.find(a=>a.startsWith('--case='))?.slice(7),passed=[];
  async function run(name,fn){if(selected&&!name.includes(selected))return;await fn();passed.push(name);console.log('PASS_SOURCE_VM '+name);}
  await run('page-save-confirms-after-original-callback',async()=>{
    const f=fixture();await f.context.saveLocalSession(f.session);
    assert.equal(f.admissions(),2);assert.equal(f.active(),false);
    const index=JSON.parse(f.rows.get(f.index));assert.equal(index.sessions[0].session_uuid,f.session.session_uuid);
    assert.equal(index.sessions[0].location_code,f.session.location_code);
    assert.equal(JSON.parse(f.rows.get(f.key)).device_id,'KIOSK_08');
  });
  await run('page-owner-withdrawal-retains-session-no-index',async()=>{
    const f=fixture();let original;f.after(n=>{if(n===1){original=f.rows.get(f.key);f.status.generation++;}});
    await assert.rejects(()=>f.context.saveLocalSession(f.session),error=>
      error.code==='custodial_security_state_unavailable'||error.message==='Saved cleaning work needs manager recovery.');
    assert.equal(f.rows.get(f.key),original);assert.equal(f.rows.has(f.index),false);assert.equal(f.admissions(),1);
  });
  await run('completion-retirement-after-original-callback',async()=>{
    const f=fixture();f.rows.set(f.key,JSON.stringify(f.session));
    f.rows.set(f.index,JSON.stringify({schema_version:2,device_id:'KIOSK_08',sessions:[{...f.session,view:'timer'}]}));
    const result=await f.context.persistLocalCompletionUnlocked(f.session,f.action);
    assert.equal(f.context.isLocallyCompleted(result),true);assert.equal(f.queue.length,1);
    assert.deepEqual(JSON.parse(f.rows.get(f.index)).sessions,[]);assert.equal(f.admissions(),4);
    assert.equal(f.rows.has(f.key),true);assert.equal(f.active(),false);
  });
  await run('completion-owner-change-before-enqueue-retains-original-intent',async()=>{
    const f=fixture();f.rows.set(f.key,JSON.stringify(f.session));let original;
    f.after(n=>{if(n===1){original=f.rows.get(f.key);f.status.generation++;f.status.principal.employee_id='44444444-4444-4444-8444-444444444444';}});
    await assert.rejects(()=>f.context.persistLocalCompletionUnlocked(f.session,f.action));
    assert.equal(f.rows.get(f.key),original);assert.equal(f.queue.length,0);assert.equal(f.admissions(),1);
  });
  await run('completion-missing-original-principal-refuses-before-intent',async()=>{
    const f=fixture();f.status.principal=null;
    await assert.rejects(()=>f.context.persistLocalCompletionUnlocked(f.session,f.action));
    assert.equal(f.rows.size,0);assert.equal(f.queue.length,0);assert.equal(f.admissions(),0);
  });
  await run('never-marked-web-save-compatible',async()=>{
    const f=fixture({native:false});await f.context.saveLocalSession(f.session);
    assert.equal(f.admissions(),0);assert.equal(JSON.parse(f.rows.get(f.index)).sessions[0].session_uuid,f.session.session_uuid);
  });
  assert.ok(passed.length,'selected owning caller case must execute');
  console.log(JSON.stringify({status:'PASS_SOURCE_VM',cases:passed,actual_ui_and_caller_source:true,
    storage_native_admission_queue_synthetic:true,browser:false,SQL:false,Android:false}));
}

async function originalCompletionRecovery(){
  const failures=[],passed=[];
  function fixture(){
    let clock=1780000000000,generation=4,mutations=0,captured=null,submitted=null,loseReply=false,ackHook=null,lookupHook=null,commitHook=null;
    const records=new Map(),sessions=new Map(),drafts=new Map(),recoveries=[];
    let admissionTail=Promise.resolve(),admissionActive=false,originalContext=null;
    const timers=new Set();let liveFinish=false;
    const nativeStatus={ready:true,available:true,quarantined:false,state:'enrolled',deviceId:'KIOSK_08',
      principal:{schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',
       employee_id:'00000000-0000-4000-8000-000000000001',credential_id:'00000000-0000-4000-8000-000000000002',
       credential_operation_id:'00000000-0000-4000-8000-000000000003',assignment_epoch:3,
       installation_seal:'synthetic-installation-seal',enrolled_at:'2026-10-14T12:00:00.000Z'}};
    const security={native:true,getStatus:()=>structuredClone({...nativeStatus,generation}),waitForStableState:async()=>structuredClone({...nativeStatus,generation}),
      mutateProtectedWork(operation,options={}){
       const execute=async()=>{
        if(options.expectedGeneration!=null&&options.expectedGeneration!==generation)throw Object.assign(Error('original generation changed'),{code:'custodial_security_generation_changed'});
        const original=generation,principal=JSON.stringify(nativeStatus.principal);let open=true;
        const context=Object.freeze({deviceId:'KIOSK_08',generation,state:'enrolled',assertCurrent(){
         if(!open||generation!==original||JSON.stringify(nativeStatus.principal)!==principal)throw Object.assign(Error('original callback owner changed'),{code:'custodial_security_generation_changed'});
        }});
        admissionActive=true;originalContext=context;
        try{const result=await operation(context);context.assertCurrent();return result;}finally{open=false;admissionActive=false;}
       };
       const result=admissionTail.then(execute,execute);admissionTail=result.then(()=>undefined,()=>undefined);return result;
      }};
    const session=randomUUID(),completion=randomUUID(),employee=randomUUID(),occurrence=randomUUID();
    const payload={p_client_session_id:session,p_client_completion_id:completion,p_device_id:'KIOSK_08',
      p_location_code:'CHINA',p_client_started_at:'2026-05-28T10:00:00.000Z',p_client_ended_at:'2026-05-28T10:15:00.000Z',
      p_native_finish_scan_entry_id:randomUUID(),p_native_completion_attestation_version:'custodial-native-completion.v2',
      p_native_completion_attestation:'a'.repeat(64),p_scan_evidence:[],p_response_json:{work_result:'check_only',services_performed:[]}};
    const row={id:1,type:'commit_workflow',operation_id:completion,client_id:completion,semantic_fingerprint:'b'.repeat(64),
      payload,replay_binding:{client_session_id:session,client_completion_id:completion,employee_id:employee,
        assignment_epoch:8,snapshot_id:'c'.repeat(64),occurrence_id:occurrence},created_at:clock,state:'pending'};
    // No snapshot on this row: the already frozen native proof is used without
    // invoking a transport attestation service. Native/SQL boundaries are synthetic.
    row.replay_binding.snapshot_id='';
    const local={session_uuid:session,client_session_id:session,client_completion_id:completion,
      offline_authority_employee_id:employee,offline_authority_assignment_epoch:8,offline_occurrence_id:occurrence,
      device_id:payload.p_device_id,location_code:payload.p_location_code,started_at:payload.p_client_started_at,
      ended_at:payload.p_client_ended_at,native_finish_scan_entry_id:payload.p_native_finish_scan_entry_id,
      native_completion_attestation_version:payload.p_native_completion_attestation_version,
      native_completion_attestation:payload.p_native_completion_attestation};
    nativeStatus.principal.employee_id=employee;nativeStatus.principal.assignment_epoch=8;
    sessions.set('session:'+session,JSON.stringify(local));
    const protectedDraft={schema_version:1,contract_version:'scan.v4.snapshot-bound-authority',session_uuid:session,
      client_completion_id:completion,device_id:'KIOSK_08',employee_id:employee,location_code:'CHINA',draft:{original:'original draft'}};
    drafts.set(session,{...protectedDraft,integrity_sha256:'d'.repeat(64),saved_at:'2026-05-28T10:15:00.000Z'});
    const result={status:'closed',client_session_id:session,client_completion_id:completion,occurrence_id:occurrence,
      accepted_at:'2026-05-28T10:16:00.000Z'};
    // New-only terminal adapter extends this SAME fixture's Map transaction.
    // It models event ordering/unknown commit, NOT real IDB isolation or crash durability.
    let behavior='normal',terminalRelease=null,afterDelete=null,terminalReadyResolve;
    const terminalReady=new Promise(resolve=>{terminalReadyResolve=resolve;}),events=[],effects=[];
    function finishTransaction(map){
      const pending=new Map([...map].map(([id,row])=>[id,structuredClone(row)]));let request=null,ended=false;
      effects.push('transaction');
      const late=type=>process.nextTick(()=>{
        let code=null;try{originalContext.assertCurrent();}catch(error){code=error.code||'changed';}
        events.push({type,active:admissionActive,contextCode:code});
      });
      const emit=type=>{tx['on'+type]?.({target:tx,type});late(type);};
      const commit=()=>{
        if(ended)return;ended=true;map.clear();for(const[id,row]of pending)map.set(id,row);
        if(commitHook){const hook=commitHook;commitHook=null;hook();}effects.push('commit');emit('complete');
      };
      const abort=()=>{if(ended)return;ended=true;effects.push('abort');emit('abort');};
      const tx={error:null,abort(){
        effects.push('abort-attempt');
        if(behavior==='abort-throws')throw Error('SYNTHETIC_ABORT_UNCONFIRMED');
        if(behavior==='error-terminal'){terminalRelease=abort;return;}
        queueMicrotask(abort);
      },objectStore:()=>({
       get:id=>(request={result:structuredClone(map.get(id))}),
       put:row=>{effects.push('put');pending.set(row.id,structuredClone(row));},
       delete:id=>{effects.push('delete');pending.delete(id);afterDelete?.();}
      })};
      queueMicrotask(()=>{
        try{
          if(lookupHook){const hook=lookupHook;lookupHook=null;hook();}
          if(behavior==='error-terminal'){
            tx.error=request.error=Error('SYNTHETIC_LOOKUP_ERROR');request.onerror?.({target:request});
            tx.onerror?.({target:request});tx.oncomplete?.({target:request});tx.onabort?.({target:request});
            terminalReadyResolve();return;
          }
          request.onsuccess?.();if(!ended)commit();
        }catch(error){tx.error=error;abort();}
      });
      return tx;
    }
    function db(map){return {close(){},transaction(){if(finishOwnerOnly&&liveFinish&&map===records)return finishTransaction(map);let request,aborted=false;const pending=new Map(map),tx={};
      tx.objectStore=()=>({get:id=>(request={result:structuredClone(map.get(id))}),
        getAll:()=>(request={result:[...map.values()].map(x=>structuredClone(x))}),
        put:r=>pending.set(r.id,structuredClone(r)),delete:id=>pending.delete(id)});
      tx.abort=()=>{aborted=true;tx.onabort?.({target:tx});};
      queueMicrotask(()=>{try{if(map===records&&lookupHook){const hook=lookupHook;lookupHook=null;hook();}request?.onsuccess?.();if(!aborted){map.clear();for(const [k,v]of pending)map.set(k,v);if(map===records&&commitHook){const hook=commitHook;commitHook=null;hook();}tx.oncomplete?.({target:tx});}}
        catch(error){tx.error=error;tx.onabort?.({target:tx});}});return tx;}};}
    const locals=new FixtureStorage();locals.rows=sessions;
    const mobile={getAuthenticatedCompletion:async args=>{recoveries.push(structuredClone(args));
      return captured?{found:true,result:structuredClone(captured)}:{found:false};},
      acknowledgeOfflineCompletion:async()=>{if(ackHook)await ackHook();return {acknowledged:true};}};
    mobile.edition='custodial';mobile.principalIdentity=()=>JSON.stringify(nativeStatus.principal);
    const sandbox={CONFIG:{STORE_NAME:'actions',COMPLETION_DRAFT_STORE_NAME:'drafts',COMPLETION_DRAFT_SCHEMA_VERSION:1,MAX_RETRIES:50,LEASE_MS:60000,
      SCHEMA_VERSION:6,REQUIRED_SCAN_CONTRACT_VERSION:'scan.v4.snapshot-bound-authority'},now:()=>clock,
      safeText:x=>String(x??'').trim(),isUuid:x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x),
      crypto:{randomUUID},structuredClone,localStorage:locals,window:{localStorage:locals,navigator:{locks:createSyntheticScheduleLocks()},setTimeout:finishOwnerOnly?((fn,delay)=>{const timer=setTimeout(()=>{timers.delete(timer);fn();},delay);timers.add(timer);return timer;}):setTimeout,MemphisMobile:mobile,indexedDB:{},MemphisCustodialSecurity:security},openCompletionDraftDb:async()=>db(drafts),
      sha256:async value=>createHash('sha256').update(value).digest('hex'),
      storageFailure:(label,e)=>new Error(label+': '+e.message),
      state:{workerId:'synthetic-worker',deviceId:'KIOSK_08',db:db(records)},Math:Object.assign(Object.create(Math),{random:()=>0}),
      rpc:async(name,args)=>{assert.equal(name,'tool_commit_cleaning_workflow');mutations++;submitted=structuredClone(args);captured=structuredClone(result);
        if(loseReply){loseReply=false;throw Object.assign(new Error('lost response'),{scanTransportFailure:true});}
        return structuredClone(result);}};
    let context;
    function restart(){
      context=vm.createContext(sandbox);
      const implementation=closedScanOwnerSource(source,['claimNextAction','finishClaim','processAction','recoverOrphanedClaims','storageRecord','normalizeRecord'],sandbox);
      vm.runInContext(implementation,context,{importModuleDynamically:specifier=>{
        assert.equal(specifier,'./mobile/src/custodial/protected-browser-admission.js');
        return import('../mobile/src/custodial/protected-browser-admission.js');
      }});return context;
    }
    restart();drafts.get(session).integrity_sha256=createHash('sha256').update(context.canonicalJson(protectedDraft)).digest('hex');
    records.set(1,structuredClone(context.storageRecord(row)));
    return {row,local,result,payload,records,sessions,drafts,recoveries,mobile,restart,get c(){return context;},
      get mutations(){return mutations;},get submitted(){return submitted;},lose(){loseReply=true;},accepted(){captured=structuredClone(result);},
      security,nativeStatus,sandbox,timers,active:()=>admissionActive,
      async hold(){let enter,release;const entered=new Promise(resolve=>{enter=resolve;});
       const promise=security.mutateProtectedWork(async context=>{context.assertCurrent();enter();await new Promise(resolve=>{release=resolve;});});
       await entered;return{release,promise};
      },
      finish(item,options){liveFinish=true;return context.finishClaim(item,options).finally(()=>{liveFinish=false;});},
      effects,events,terminalReady,setBehavior(value){behavior=value;},releaseTerminal(){terminalRelease?.();},afterDelete(fn){afterDelete=fn;},
      legacy(){delete sandbox.window.MemphisCustodialSecurity;delete sandbox.window.MemphisMobile;restart();},
      async clean(){
       if(admissionActive)await new Promise(resolve=>setTimeout(resolve,0));
       assert.equal(admissionActive,false);assert.equal(timers.size,0);if(originalContext)assert.throws(()=>originalContext.assertCurrent());
      },
      hook(fn){ackHook=fn;},beforeLookup(fn){lookupHook=fn;},afterCommit(fn){commitHook=fn;},rotate(){generation++;},advance(){clock=context.normalizeRecord(records.get(1)).next_attempt_at;}};
  }
  async function test(name,fn){
    const selected=process.argv.find(arg=>arg.startsWith('--case='));
    if(selected && !name.includes(selected.slice(7))) return;
    if(finishOwnerOnly!==name.startsWith('finish-original:'))return;
    if(finishOwnerOnly&&failures.length)return; // Stop at the FIRST newly affected failure.
    if(process.argv.includes('--completion-owner-events-only') && !name.startsWith('owner-event:')) return;
    if(process.argv.includes('--completion-cleanup-await-only') && !name.startsWith('await:')) return;
    if(process.argv.includes('--completion-frozen-evidence-only') && !name.startsWith('evidence:')) return;
    if(process.argv.includes('--completion-settlement-status-only') && !name.startsWith('settlement:')) return;
    if(process.argv.includes('--original-completion-recovery-only') && /^(await|evidence|settlement|owner-event):/.test(name)) return;
    try{await fn();passed.push(name);}catch(e){failures.push({name,error:e.stack||e.message});}
  }
  await test('finish-original: mutable item before FIFO is refused without deleting successor',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();const foreign=structuredClone(f.records.get(1));foreign.id=2;
    f.records.set(2,foreign);const before=JSON.stringify([...f.records]),sessions=JSON.stringify([...f.sessions]),held=await f.hold();
    const pending=f.finish(item,{succeeded:true,result:f.result});item.id=2;held.release();await held.promise;
    await assert.rejects(pending,/changed|original|unavailable/);
    assert.equal(JSON.stringify([...f.records]),before);assert.equal(JSON.stringify([...f.sessions]),sessions);await f.clean();
  });
  await test('finish-original: mutable result while get pending is held without reconciliation adoption',async()=>{
    const f=fixture(),item=await f.c.claimNextAction(),before=JSON.stringify([...f.records]),local=JSON.stringify([...f.sessions]);
    f.beforeLookup(()=>{f.result.status='cancelled';f.result.reason='SYNTHETIC foreign successor result';});
    await assert.rejects(()=>f.finish(item,{succeeded:true,result:f.result}),/original|changed/i);
    assert.equal(JSON.stringify([...f.records]),before);assert.equal(JSON.stringify([...f.sessions]),local);
    assert.equal(f.effects.includes('put'),false);assert.equal(f.effects.includes('delete'),false);await f.clean();
  });
  await test('finish-original: nested original payload mutation while get pending is held',async()=>{
    const f=fixture(),item=await f.c.claimNextAction(),before=JSON.stringify([...f.records]),local=JSON.stringify([...f.sessions]);
    f.beforeLookup(()=>{item.payload.p_response_json.work_result='SYNTHETIC changed original payload';});
    await assert.rejects(()=>f.finish(item,{succeeded:true,result:f.result}),/original|changed/i);
    assert.equal(JSON.stringify([...f.records]),before);assert.equal(JSON.stringify([...f.sessions]),local);
    assert.equal(f.effects.includes('put'),false);assert.equal(f.effects.includes('delete'),false);await f.clean();
  });
  await test('finish-original: option mutation while FIFO waits cannot change retry decision',async()=>{
    const f=fixture(),item=await f.c.claimNextAction(),before=JSON.stringify([...f.records]),held=await f.hold();
    const options={succeeded:false,error:'HTTP503',automaticRetry:true,retryAfterMs:90000},pending=f.finish(item,options);
    options.permanent=true;held.release();await held.promise;await assert.rejects(pending,/original|changed/i);
    assert.equal(JSON.stringify([...f.records]),before);assert.equal(f.effects.length,0);await f.clean();
  });
  await test('finish-original: same-generation successor principal before admission is refused',async()=>{
    const f=fixture(),item=await f.c.claimNextAction(),before=JSON.stringify([...f.records]),held=await f.hold();
    const pending=f.finish(item,{succeeded:true,result:f.result});
    // Source observation changes while BEFORE the new callback owns a context.
    f.nativeStatus.principal.employee_id='44444444-4444-4444-8444-444444444444';held.release();await assert.rejects(held.promise,/owner changed/);
    await assert.rejects(pending,/unavailable|original|changed/i);assert.equal(JSON.stringify([...f.records]),before);assert.equal(f.effects.length,0);await f.clean();
  });
  await test('finish-original: runtime method mobile identity and DB withdrawal before effects',async()=>{
    for(const change of [
      f=>{f.security.getStatus=()=>structuredClone({...f.nativeStatus,generation:4});},
      f=>{f.sandbox.window.MemphisMobile={...f.mobile};},
      f=>{f.mobile.principalIdentity=()=>JSON.stringify(f.nativeStatus.principal);},
      f=>{f.sandbox.state.db={...f.sandbox.state.db};},
    ]){
      const f=fixture(),item=await f.c.claimNextAction(),before=JSON.stringify([...f.records]),local=JSON.stringify([...f.sessions]),held=await f.hold();
      const pending=f.finish(item,{succeeded:true,result:f.result});change(f);held.release();await held.promise;
      await assert.rejects(pending,/unavailable|original|changed/i);assert.equal(JSON.stringify([...f.records]),before);assert.equal(JSON.stringify([...f.sessions]),local);await f.clean();
    }
  });
  await test('finish-original: foreign current lease row remains unmodified and unaccepted',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();
    f.records.set(1,{...f.records.get(1),lease_token:'SYNTHETIC_SUCCESSOR_LEASE'});const before=JSON.stringify([...f.records]),local=JSON.stringify([...f.sessions]);
    assert.equal(await f.finish(item,{succeeded:true,result:f.result}),false);
    assert.equal(JSON.stringify([...f.records]),before);assert.equal(JSON.stringify([...f.sessions]),local);
    assert.equal(f.effects.includes('delete'),false);assert.equal(f.effects.includes('put'),false);await f.clean();
  });
  await test('finish-original: error and foreign terminal targets cannot release before direct abort dispatch',async()=>{
    const f=fixture(),item=await f.c.claimNextAction(),before=JSON.stringify([...f.records]),local=JSON.stringify([...f.sessions]);
    f.setBehavior('error-terminal');let settled=false;
    const pending=f.finish(item,{succeeded:true,result:f.result}).then(value=>({value}),error=>({error})).finally(()=>{settled=true;});
    try{
      await f.terminalReady;await new Promise(resolve=>setTimeout(resolve,5));
      assert.equal(settled,false,'foreign complete/abort cannot settle the real transaction');assert.equal(f.active(),true);assert.equal(f.events.length,0);
    }finally{f.releaseTerminal();}
    const result=await pending;assert.ok(result.error);assert.match(result.error.message,/SYNTHETIC_LOOKUP_ERROR/);
    assert.equal(JSON.stringify([...f.records]),before);assert.equal(JSON.stringify([...f.sessions]),local);
    assert.equal(f.events.length,1);assert.equal(f.events[0].type,'abort');assert.equal(f.events[0].active,true);assert.equal(f.events[0].contextCode,null);await f.clean();
  });
  await test('finish-original: failed abort after staged delete keeps actual committed outcome unknown no compensation',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();
    f.records.set(2,{id:2,note:'SYNTHETIC unrelated unknown original'});const unknown=JSON.stringify(f.records.get(2));
    f.setBehavior('abort-throws');f.afterDelete(()=>{f.result.status='cancelled';});
    await assert.rejects(()=>f.finish(item,{succeeded:true,result:f.result}),/unconfirmed|original|changed/i);
    assert.equal(f.records.has(1),false,'fixture already committed; rejection is NOT rollback');
    assert.equal(f.sessions.size,0,'existing local effect is not compensated or falsely restored');
    assert.equal(JSON.stringify(f.records.get(2)),unknown);assert.equal(f.effects.filter(v=>v==='transaction').length,1);
    assert.equal(f.effects.filter(v=>v==='abort-attempt').length,1);assert.equal(f.effects.filter(v=>v==='delete').length,1);await f.clean();
  });
  await test('finish-original: original accepted closed result applies once under owned direct completion',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();assert.equal(await f.finish(item,{succeeded:true,result:f.result}),true);
    assert.equal(f.records.size,0);assert.equal(f.sessions.size,0);assert.equal(f.drafts.size,1);
    assert.deepEqual(f.effects,['transaction','delete','commit']);assert.equal(f.events.length,1);
    assert.equal(f.events[0].active,true);assert.equal(f.events[0].contextCode,null);await f.clean();
    const legacy=fixture();legacy.legacy();const webItem=await legacy.c.claimNextAction();
    assert.equal(await legacy.finish(webItem,{succeeded:true,result:legacy.result}),true);
    assert.equal(legacy.records.size,0);assert.equal([...legacy.sessions.keys()].some(key=>key.startsWith('session:')),false);assert.equal(legacy.drafts.size,1);await legacy.clean();
  });
  await test('finish-original: original terminal reconciliation retains full payload without local acceptance',async()=>{
    const f=fixture(),item=await f.c.claimNextAction(),payload=JSON.stringify(item.payload),local=JSON.stringify([...f.sessions]);
    const result={status:'recovery_required',reason:'SYNTHETIC original needs manager recovery',terminal:true};
    assert.equal(await f.finish(item,{succeeded:true,result}),true);const retained=f.c.normalizeRecord(f.records.get(1));
    assert.equal(retained.state,'quarantined');assert.equal(JSON.stringify(retained.payload),payload);
    assert.equal(retained.terminal_result.status,'recovery_required');assert.equal(JSON.stringify([...f.sessions]),local);
    assert.equal(f.effects.includes('delete'),false);await f.clean();
  });
  await test('finish-original: original outage retry keeps original payload delay and legacy fence',async()=>{
    const f=fixture(),item=await f.c.claimNextAction(),payload=JSON.stringify(item.payload),operation=item.operation_id,local=JSON.stringify([...f.sessions]);
    assert.equal(await f.finish(item,{succeeded:false,error:'HTTP503',automaticRetry:true,retryAfterMs:90000}),true);
    const raw=f.records.get(1),retained=f.c.normalizeRecord(raw);
    assert.equal(raw.dead_letter,true);assert.equal(raw.type,'forward-replay-fenced:commit_workflow');
    assert.equal(retained.state,'retrying');assert.equal(retained.dead_letter,false);assert.equal(retained.retry_count,1);
    assert.equal(retained.next_attempt_at,1780000090000);assert.equal(retained.operation_id,operation);assert.equal(JSON.stringify(retained.payload),payload);
    assert.equal(JSON.stringify([...f.sessions]),local);assert.equal(f.effects.includes('delete'),false);await f.clean();
  });
  await test('finish-original: malformed getter result is refused without invoking raw accessor',async()=>{
    const f=fixture(),item=await f.c.claimNextAction(),before=JSON.stringify([...f.records]);let getters=0;
    const result={};Object.defineProperty(result,'status',{enumerable:true,get(){getters++;return'closed';}});
    await assert.rejects(()=>f.finish(item,{succeeded:true,result}),/original|changed/i);
    assert.equal(getters,0);assert.equal(JSON.stringify([...f.records]),before);assert.equal(f.effects.length,0);await f.clean();
  });
  await test('finish-original: original mobile identity loss after commit cannot publish acceptance',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();f.afterCommit(()=>{f.mobile.principalIdentity=()=> 'SYNTHETIC_WITHDRAWN';});
    await assert.rejects(()=>f.finish(item,{succeeded:true,result:f.result}),/unavailable|original|changed/i);
    assert.equal(f.records.size,0);assert.equal(f.sessions.size,0);assert.equal(f.drafts.size,1);await f.clean();
  });
  await test('owner-event: withdrawn native generation before completion lookup cannot delete original',async()=>{
    const f=fixture(),item=await f.c.claimNextAction(),original=JSON.stringify(f.records.get(1)),session=JSON.stringify([...f.sessions]);
    f.beforeLookup(()=>f.rotate());
    await assert.rejects(()=>f.c.finishClaim(item,{succeeded:true,result:f.result}),{code:'custodial_security_state_unavailable'});
    assert.equal(JSON.stringify(f.records.get(1)),original);assert.equal(JSON.stringify([...f.sessions]),session);
  });
  await test('owner-event: healthy original completion settles and retains separate draft',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();
    assert.equal(await f.c.finishClaim(item,{succeeded:true,result:f.result}),true);
    assert.equal(f.records.size,0);assert.equal(f.sessions.size,0);assert.equal(f.drafts.size,1);
  });
  await test('owner-event: changed original lease is not retired or reported accepted',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();
    const replacement={...f.records.get(1),lease_token:'foreign-replacement-lease'};f.records.set(1,replacement);
    const original=JSON.stringify(replacement),session=JSON.stringify([...f.sessions]);
    assert.equal(await f.c.finishClaim(item,{succeeded:true,result:f.result}),false);
    assert.equal(JSON.stringify(f.records.get(1)),original);assert.equal(JSON.stringify([...f.sessions]),session);
  });
  await test('owner-event: ordinary outage updates retry without rewriting submitted original',async()=>{
    const f=fixture(),item=await f.c.claimNextAction(),payload=JSON.stringify(item.payload),operation=item.operation_id;
    assert.equal(await f.c.finishClaim(item,{succeeded:false,error:'HTTP503',automaticRetry:true}),true);
    const current=f.c.normalizeRecord(f.records.get(1));assert.equal(current.state,'retrying');assert.equal(current.dead_letter,false);
    assert.equal(current.operation_id,operation);assert.equal(JSON.stringify(current.payload),payload);assert.equal(f.sessions.size,1);
  });
  await test('owner-event: generation loss after actual fixture commit stays unknown without compensation',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();f.afterCommit(()=>f.rotate());
    await assert.rejects(()=>f.c.finishClaim(item,{succeeded:true,result:f.result}),{code:'custodial_security_state_unavailable'});
    assert.equal(f.records.size,0,'already committed transaction is not falsely rolled back');
    assert.equal(f.sessions.size,0);assert.equal(f.drafts.size,1,'separate protected draft not deleted by queue settlement');
  });
  await test('settlement: lost original queue ownership cannot announce synced or retire native receipt',async()=>{
    let claims=0,retirements=0;const statuses=[],row={id:1,type:'commit_workflow',payload:{p_device_id:'SYNTHETIC_PHONE'}};
    const state={db:{},deviceId:'SYNTHETIC_PHONE',syncing:false,lastServerAckAt:null};
    const context=vm.createContext({state,navigator:{onLine:true},window:{MemphisMobile:{retireAuthenticatedCompletion:async()=>{retirements++;}}},
      CONFIG:{},securityPause:async()=>null,dispatchSecurityPause:()=>{},securityErrorIsPause:()=>false,
      custodialSecurity:()=>null,recoverOrphanedClaims:async()=>0,claimNextAction:async()=>claims++===0?row:null,
      verifyWorkerBackendCompatibility:async()=>true,processAction:async()=>({status:'closed'}),finishClaim:async()=>false,
      withQueueLock:fn=>fn(),dispatchStatus:status=>statuses.push(status),listActions:async()=>[row],
      hasUnresolvedReconciliationWork:()=>true,nextClaimableAction:()=>null,scheduleSync:()=>{},now:()=>1780000000000,
      safeText:x=>String(x??'').trim(),isAutomaticOutageRetry:()=>false});
    vm.runInContext(slice('  async function runWorker(','  async function reconcileStartupRecovery('),context);
    await context.runWorker();
    assert.equal(statuses.some(x=>x.status==='synced'),false);assert.equal(retirements,0);
    assert.equal(state.lastServerAckAt,null);assert.ok(statuses.some(x=>x.status==='retrying'));
  });
  await test('evidence: local evidence changes cannot rewrite original saved completion submission',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();
    f.sessions.set('session:'+f.payload.p_client_session_id,JSON.stringify({...f.local,
      scan_evidence:[{client_event_id:randomUUID(),notes:'changed after save'}]}));
    await f.c.processAction(item);
    assert.equal(JSON.stringify(f.submitted.p_scan_evidence),JSON.stringify(f.payload.p_scan_evidence));
    assert.equal(JSON.stringify(f.c.normalizeRecord(f.records.get(1)).payload.p_scan_evidence),JSON.stringify(f.payload.p_scan_evidence));
  });
  await test('await: replacement lease during native acknowledgment preserves original drafts',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();f.accepted();
    f.hook(()=>{const current=f.records.get(1);current.lease_token=randomUUID();f.records.set(1,current);});
    await assert.rejects(f.c.processAction(item),/lease|ownership|changed/i);
    assert.equal(f.drafts.size,1);assert.equal(f.records.size,1);assert.equal(f.sessions.size,1);
  });
  await test('await: interrupted acknowledgment/restart retains first receipt and exact row; no second mutation',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();f.hook(()=>{throw new Error('ack interrupted');});
    await assert.rejects(f.c.processAction(item),/ack interrupted/);
    const saved=f.c.normalizeRecord(f.records.get(1)),receipt=JSON.stringify(saved.server_completion_receipt),payload=JSON.stringify(saved.payload);
    assert.equal(saved.operation_id,f.row.operation_id);assert.equal(f.drafts.size,1);
    f.hook(null);f.restart();assert.equal(await f.c.recoverOrphanedClaims(true),1);
    const next=await f.c.claimNextAction(),result=await f.c.processAction(next);
    assert.equal(JSON.stringify(next.payload),payload);assert.equal(JSON.stringify(next.server_completion_receipt),receipt);
    assert.equal(result.accepted_at,f.result.accepted_at);assert.equal(f.mutations,1);
    assert.equal(await f.c.finishClaim(next,{succeeded:true,result}),true);assert.equal(f.records.size,0);
  });
  await test('await: actor changes during captured receipt read hold before acknowledgment',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();f.accepted();let acknowledgments=0;
    const original=f.mobile.getAuthenticatedCompletion;
    f.mobile.getAuthenticatedCompletion=async args=>{const result=await original(args);
      f.sessions.set('session:'+f.payload.p_client_session_id,JSON.stringify({...f.local,offline_authority_employee_id:randomUUID()}));return result;};
    f.hook(()=>{acknowledgments++;});
    await assert.rejects(f.c.processAction(item),/original|changed/i);
    assert.equal(acknowledgments,0);assert.equal(f.records.size,1);assert.equal(f.drafts.size,1);assert.equal(f.mutations,0);
  });
  await test('lost response/restart preserves original operation and first acceptance; one mutation',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();f.lose();
    await assert.rejects(f.c.processAction(item),/lost response/);
    await f.c.finishClaim(item,{succeeded:false,error:'lost response',automaticRetry:true});
    const frozen=JSON.stringify(f.c.normalizeRecord(f.records.get(1)).payload);f.advance();f.restart();
    const recovered=await f.c.claimNextAction(),result=await f.c.processAction(recovered);
    assert.equal(JSON.stringify(recovered.payload),frozen);assert.equal(result.accepted_at,f.result.accepted_at);
    assert.equal(await f.c.finishClaim(recovered,{succeeded:true,result}),true);
    assert.equal(f.mutations,1);assert.equal(f.records.size,0);assert.equal(f.sessions.size,0);
    assert.equal(f.recoveries.at(-1).expectedGeneration,4,'native read receives original claim generation');
  });
  await test('foreign server session alias is not deleted',async()=>{
    const f=fixture(),foreign=randomUUID();f.sessions.set('session:'+foreign,JSON.stringify({...f.local,
      session_uuid:foreign,client_session_id:foreign,client_completion_id:randomUUID(),offline_authority_employee_id:randomUUID()}));
    const item=await f.c.claimNextAction();f.accepted();const result=await f.c.processAction(item);result.session_uuid=foreign;
    await f.c.finishClaim(item,{succeeded:true,result});assert.ok(f.sessions.has('session:'+foreign));
  });
  await test('changed employee/completion local row holds before native acknowledgment or draft cleanup',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();f.accepted();
    f.sessions.set('session:'+f.payload.p_client_session_id,JSON.stringify({...f.local,
      client_completion_id:randomUUID(),offline_authority_employee_id:randomUUID()}));
    await assert.rejects(f.c.processAction(item),/original|bound|changed/i);
    assert.equal(f.records.size,1);assert.equal(f.drafts.size,1);assert.equal(f.sessions.size,1);assert.equal(f.mutations,0);
  });
  await test('same lease cannot settle a replacement operation',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();
    const current=f.records.get(1);current.operation_id=randomUUID();f.records.set(1,current);
    assert.equal(await f.c.finishClaim(item,{succeeded:true,result:f.result}),false);
    assert.equal(f.records.size,1);assert.equal(f.sessions.size,1);
  });
  await test('generation rotation after native acknowledgment preserves drafts and queue',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();f.accepted();f.hook(()=>f.rotate());
    await assert.rejects(f.c.processAction(item),/generation changed/);
    assert.equal(f.drafts.size,1);assert.equal(f.records.size,1);assert.equal(f.sessions.size,1);
  });
  await test('frozen native completion time/proof cannot be overwritten by changed local proof',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();
    f.sessions.set('session:'+f.payload.p_client_session_id,JSON.stringify({...f.local,
      ended_at:'2026-05-28T10:20:00.000Z',native_completion_attestation:'e'.repeat(64)}));
    await assert.rejects(f.c.processAction(item),/original|bound|changed|frozen/i);
    assert.equal(f.mutations,0);assert.equal(f.records.size,1);
    assert.equal(f.c.normalizeRecord(f.records.get(1)).payload.p_client_ended_at,f.payload.p_client_ended_at);
  });
  await test('claim payload readback equals exact persisted submission after transport preparation',async()=>{
    const f=fixture(),item=await f.c.claimNextAction();await f.c.processAction(item);
    assert.equal(JSON.stringify(item.payload),JSON.stringify(f.c.normalizeRecord(f.records.get(1)).payload));
  });
  console.log(JSON.stringify({status:failures.length?'FAIL_ORIGINAL_COMPLETION_RECOVERY':'PASS_ORIGINAL_COMPLETION_RECOVERY',
    cases:passed.length+failures.length,passed,failures,
    limits:'Actual owning queue/session/process source; synthetic IDB, protected generation and native captured receipt/RPC. Not current SQL/principal, native lifecycle, actual browser crash durability or physical proof.'},null,2));
  if(failures.length)process.exitCode=1;
}
let clock=1780000000000,checks=0,applied=0;
const records=new Map();
const context=createScanOwnerVm(source,['claimNextAction','finishClaim'],{CONFIG:{STORE_NAME:'actions',MAX_RETRIES:50,LEASE_MS:60000,SCHEMA_VERSION:6,
  REQUIRED_SCAN_CONTRACT_VERSION:'scan.v4.snapshot-bound-authority'},now:()=>clock,safeText:x=>String(x??'').trim(),
  isUuid:x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x),
  crypto:{randomUUID},exactSessionForPayload:()=>null,
  isTerminalReconciliation:()=>false,applyProcessResult:()=>{applied++;},
  state:{workerId:'synthetic-worker',db:{transaction(){let request;const tx={};
    tx.abort=()=>queueMicrotask(()=>tx.onabort?.({target:tx}));
    tx.objectStore=()=>({get:id=>(request={result:structuredClone(records.get(id))}),
      getAll:()=>(request={result:[...records.values()].map(x=>structuredClone(x))}),
      put:row=>records.set(row.id,structuredClone(row)),delete:id=>records.delete(id)});
    queueMicrotask(()=>{request.onsuccess({target:request});tx.oncomplete({target:tx});});return tx;}}},
  Math:Object.assign(Object.create(Math),{random:()=>0})});
const original={id:1,type:'commit_workflow',operation_id:randomUUID(),client_id:randomUUID(),
  semantic_fingerprint:'b'.repeat(64),payload:{p_client_session_id:randomUUID(),p_device_id:'SYNTHETIC_PHONE',
    p_response_json:{work_result:'check_only',services_performed:[]}},created_at:clock,state:'pending'};
records.set(1,structuredClone(context.storageRecord(original)));
function check(value,expected,label){assert.deepEqual(value,expected,label);checks++;}
for(let attempt=1;attempt<=150;attempt++){
  const item=await context.claimNextAction();check(item?.id,1,'exact saved operation claimed');
  check(await context.claimNextAction(),null,'live lease cannot be concurrently claimed');
  await context.finishClaim(item,{succeeded:false,error:'HTTP 503',automaticRetry:true});
  const raw=records.get(1),normal=context.normalizeRecord(raw);
  check(raw.dead_letter,true,'older workers remain fenced');
  check(raw.type,'forward-replay-fenced:commit_workflow','older action type remains fenced');
  check(normal.dead_letter,false,'current worker remains eligible after outage');
  check(normal.retry_count,attempt,'retry count preserved through actual storage normalization');
  check(normal.operation_id,original.operation_id,'operation identity unchanged');
  check(JSON.stringify(normal.payload),JSON.stringify(original.payload),'original submitted work unchanged');
  check(normal.semantic_fingerprint,original.semantic_fingerprint,'semantic binding retained');
  check(await context.claimNextAction(),null,'retry delay prevents busy loop');
  clock=normal.next_attempt_at;
}
const recovered=await context.claimNextAction();
await context.finishClaim(recovered,{succeeded:true,result:{status:'closed'}});
check(records.size,0,'accepted result retires exact saved item');check(applied,1,'result applied once');
check(await context.claimNextAction(),null,'no duplicate after acceptance');

records.set(1,structuredClone(context.storageRecord({...original,retry_count:150,dead_letter:true,state:'dead-letter'})));
check(await context.claimNextAction(),null,'old held work is not automatically resurrected');
check(records.size,1,'old held evidence remains retained');
console.log(JSON.stringify({status:'PASS_SCAN_OUTAGE_STORAGE_FENCE',checks,attempts:150,
  limits:'Actual queue normalization/storage fence/claim/settlement; synthetic transaction and result boundary. No browser, device, native receipt, production or independent acceptance.'}));
