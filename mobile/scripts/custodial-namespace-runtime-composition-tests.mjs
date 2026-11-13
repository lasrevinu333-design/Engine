import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {getCustodialBridgeSecurityRuntime,getCustodialShellSecurityFacade} from '../src/custodial/security-runtime.js';
import {createRawStorageAdapter} from '../src/custodial/storage-firewall.js';
import {createProtectedBrowserAdmission,PROTECTED_BROWSER_HOLD_KEY as HOLD,PROTECTED_BROWSER_LOCK as LOCK}
  from '../src/custodial/protected-browser-admission.js';

// New source-composition qualification, not a rendered browser/native plugin.
// Each child has an isolated synthetic Storage prototype and public globals;
// no process may reset the real module's immutable runtime/security boundary.
const cases=['four-prefix-bridge-removal','unowned-before-runtime','corrupt-before-runtime',
  'public-status-only','bound-raw-before-firewall','ready-work-then-removal'];
const writerCases=['writer-persisted-hold','writer-missing-observed-marker','writer-lock-drain',
  'writer-foreign-hold-during-await','writer-binding-before-admission','writer-binding-after-await',
  'writer-missing-lock','writer-original-options','writer-removal-no-upgrade','writer-uninspectable-hold'];
cases.push(...writerCases);
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
// Same synthetic FIFO LockManager facility as the existing admission tests.
// Actual runtime/store/gate callbacks are never substituted by fake guards.
function locks(){const queue=[];let running=false;
 const pump=()=>{if(running||!queue.length)return;const item=queue.shift();if(item.aborted){pump();return;}
  running=true;item.entered=true;item.signal.removeEventListener('abort',item.abort);
  Promise.resolve().then(()=>item.work({name:item.name,mode:'exclusive'})).then(item.resolve,item.reject)
   .finally(()=>{running=false;pump();});};
 return {request(name,{mode,signal},work){assert.equal(name,LOCK);assert.equal(mode,'exclusive');
  return new Promise((resolve,reject)=>{const item={name,signal,work,resolve,reject,entered:false,aborted:false};
   item.abort=()=>{if(item.entered)return;item.aborted=true;reject(Object.assign(Error('aborted'),{name:'AbortError'}));};
   if(signal.aborted){item.abort();return;}signal.addEventListener('abort',item.abort,{once:true});queue.push(item);pump();});},
 get active(){return running;},get pending(){return queue.filter(item=>!item.aborted).length;}};
}
const prefixes=['mz_employee_feedback_outbox:','mz_chatscope_group_pending:',
  'mz_native_notification_outbox:','mz_custodial_prestart_recovery:'];

async function run(name){
  let denyHoldRead=name==='writer-uninspectable-hold';
  class Storage {
    constructor(){this.rows=new Map();}
    get length(){return this.rows.size;}
    key(index){return [...this.rows.keys()][index]??null;}
    getItem(key){if(denyHoldRead&&String(key)===HOLD)throw Error('Synthetic hold storage unavailable');return this.rows.get(String(key))??null;}
    setItem(key,value){this.rows.set(String(key),String(value));}
    removeItem(key){this.rows.delete(String(key));}
    clear(){this.rows.clear();}
  }
  const storage=new Storage(),secure=new Map();let removals=0,remote=0,opens=0;
  const raw=createRawStorageAdapter(storage),sharedLocks=locks();
  if(name==='writer-persisted-hold')raw.setItem(HOLD,'{persisted-unknown-original');
  const key=prefixes[0]+'synthetic',originalRaw=name==='corrupt-before-runtime'?'{unreadable-original':JSON.stringify({body:{note:'SYNTHETIC original without identity'}});
  if(name==='unowned-before-runtime'||name==='corrupt-before-runtime')storage.setItem(key,originalRaw);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:storage});
  const options={storage,locks:name==='writer-missing-lock'?{}:sharedLocks,cryptoApi:webcrypto,indexedDb:{databases:async()=>[],open(){opens++;throw Error('absent DB must not be created');}},
    secureStorage:{get:async key=>secure.get(key)??null,set:async(key,value)=>secure.set(key,value),remove:async key=>{removals++;secure.delete(key);}}};
  const bridge=getCustodialBridgeSecurityRuntime(options),shell=getCustodialShellSecurityFacade(options),publicSecurity=globalThis.MemphisCustodialSecurity;
  await publicSecurity.ready;
  assert.strictEqual(bridge.security,publicSecurity);assert.strictEqual(shell.getStatus,publicSecurity.getStatus);
  const remove=()=>bridge.credentialStore.removeEnrollment({beforeRemove:async({checkpoint})=>{remote++;await checkpoint('server_logged_out');}});
  if(name==='unowned-before-runtime'||name==='corrupt-before-runtime'){
    const status=shell.getStatus();assert.equal(status.quarantined,true);assert.equal(status.preservedCounts.total_pending,1);
    assert.equal(status.preservedCounts.additional_protected_work,1);assert.equal(storage.getItem(key),originalRaw);
    assert.ok(bridge.credentialStore.getRecoveryRecord().original_identities.some(value=>value.device_id==='unowned_preserved_work'));
    assert.throws(()=>globalThis.localStorage.removeItem(key),error=>error.code==='custodial_protected_state_read_only');
    assert.throws(()=>{globalThis.localStorage[key]='replacement';},error=>error.code==='custodial_protected_state_read_only');
    assert.equal(remote,0);assert.equal(removals,0);assert.equal(opens,0);return;
  }
  await bridge.credentialStore.setEnrollment({deviceId:'KIOSK_08',credential:'SYNTHETIC_composition_only_credential'});
  assert.equal(publicSecurity.getStatus().ready,true);
  if(writerCases.includes(name)){
    const peer=createProtectedBrowserAdmission({...options,storage:raw,locks:sharedLocks});
    const workKey=prefixes[0]+'writer-original';
    const reject=(promise,code)=>assert.rejects(promise,error=>error.code===code);
    let called=0;
    for(const method of ['holdAndObserve','held','requireAdmission','hold','thaw','clear','admission','locks','rawStorage','secureStorage','credentialStore']){
      assert.equal(Object.hasOwn(publicSecurity,method),false);assert.equal(Object.hasOwn(shell,method),false);
    }
    if(name==='writer-persisted-hold'){
      // A new process/runtime, before its first writer, sees persisted ambiguity.
      const before=[...secure],marker=raw.getItem(HOLD);
      await reject(publicSecurity.mutateProtectedWork(()=>{called++;}),'custodial_browser_preservation_pending');
      assert.equal(called,0);assert.equal(raw.getItem(HOLD),marker);assert.deepEqual([...secure],before);
    }else if(name==='writer-missing-observed-marker'){
      raw.setItem(HOLD,'{malformed-original');
      await reject(publicSecurity.mutateProtectedWork(()=>{called++;}),'custodial_browser_preservation_pending');
      raw.removeItem(HOLD);
      await reject(publicSecurity.mutateProtectedWork(()=>{called++;}),'browser_hold_missing_after_observation');
      assert.equal(called,0);
    }else if(name==='writer-lock-drain'){
      const started=deferred(),finish=deferred(),original={saved:'same-return-object'},before=publicSecurity.getStatus();
      const writing=publicSecurity.mutateProtectedWork(async context=>{
        assert.equal(sharedLocks.active,true);assert.equal(Object.isFrozen(context),true);
        assert.deepEqual(context,{deviceId:before.deviceId,generation:before.generation,state:before.state});
        started.resolve();await finish.promise;
        globalThis.localStorage.setItem(workKey,JSON.stringify({device_id:context.deviceId,note:'last original'}));return original;
      });
      await started.promise;
      await reject(peer.mutate(()=>{called++;},{timeoutMs:20}),'browser_shared_lock_timeout');
      assert.equal(sharedLocks.active,true);assert.equal(called,0);
      const holding=peer.holdAndObserve({operationId:'11111111-1111-4111-8111-111111111111'});
      const later=publicSecurity.mutateProtectedWork(()=>{called++;});const denied=reject(later,'custodial_browser_preservation_pending');
      assert.equal(raw.getItem(HOLD),null);finish.resolve();assert.strictEqual(await writing,original);
      const observation=await holding;await denied;assert.equal(observation.native_authority,false);assert.equal(observation.frozen,false);
      assert.equal(observation.acknowledged,false);assert.equal(observation.phone_released,false);
      assert.equal(JSON.parse(raw.getItem(workKey)).note,'last original');assert.equal(called,0);
    }else if(name==='writer-foreign-hold-during-await'){
      const started=deferred(),finish=deferred();
      const writing=publicSecurity.mutateProtectedWork(async()=>{started.resolve();await finish.promise;raw.setItem(workKey,'original admitted bytes');return 'must not report success';});
      const denied=reject(writing,'custodial_browser_preservation_pending');await started.promise;
      raw.setItem(HOLD,'foreign changed hold');finish.resolve();await denied;
      assert.equal(raw.getItem(HOLD),'foreign changed hold');assert.equal(raw.getItem(workKey),'original admitted bytes');
      await reject(publicSecurity.mutateProtectedWork(()=>{called++;}),'custodial_browser_preservation_pending');assert.equal(called,0);
    }else if(name==='writer-binding-before-admission'){
      const started=deferred(),finish=deferred();const occupied=peer.mutate(async()=>{started.resolve();await finish.promise;});
      await started.promise;
      const writing=publicSecurity.mutateProtectedWork(()=>{called++;},{expectedGeneration:publicSecurity.getStatus().generation});
      const denied=reject(writing,'custodial_security_state_unavailable');await tick();assert.equal(sharedLocks.pending,1);
      raw.setItem('memphisAssignedDeviceId','KIOSK_02');finish.resolve();await occupied;await denied;
      assert.equal(called,0);assert.equal(publicSecurity.getStatus().ready,false);
    }else if(name==='writer-binding-after-await'){
      const started=deferred(),finish=deferred();const writing=publicSecurity.mutateProtectedWork(async context=>{
        assert.equal(context.deviceId,'KIOSK_08');started.resolve();await finish.promise;return 'unconfirmed result';
      });
      const denied=reject(writing,'custodial_security_state_unavailable');await started.promise;
      raw.setItem('memphisAssignedDeviceId','KIOSK_02');finish.resolve();await denied;assert.equal(publicSecurity.getStatus().ready,false);
    }else if(name==='writer-missing-lock'){
      const before=[...secure];await reject(publicSecurity.mutateProtectedWork(()=>{called++;}),'browser_shared_lock_unavailable');
      assert.equal(called,0);assert.deepEqual([...secure],before);assert.equal(publicSecurity.getStatus().ready,true);
    }else if(name==='writer-original-options'){
      const started=deferred(),finish=deferred();const first=publicSecurity.mutateProtectedWork(async()=>{started.resolve();await finish.promise;});
      await started.promise;const generation=publicSecurity.getStatus().generation;
      const own={expectedGeneration:generation-1},inherited=Object.create({expectedGeneration:generation-1});let boxed=generation-1;
      const options=[own,inherited,{expectedGeneration:{valueOf:()=>boxed}}];
      const denied=Promise.all(options.map(value=>reject(publicSecurity.mutateProtectedWork(()=>{called++;},value),'custodial_security_generation_changed')));
      own.expectedGeneration=null;Object.getPrototypeOf(inherited).expectedGeneration=null;boxed=generation;
      finish.resolve();await first;await denied;assert.equal(called,0);
      await assert.rejects(Promise.resolve().then(()=>publicSecurity.mutateProtectedWork(()=>{called++;},null)),error=>error instanceof TypeError);
      assert.equal(called,0);
    }else if(name==='writer-uninspectable-hold'){
      const before=[...secure];
      await reject(publicSecurity.mutateProtectedWork(()=>{called++;}),'browser_hold_uninspectable');
      denyHoldRead=false;
      await reject(publicSecurity.mutateProtectedWork(()=>{called++;}),'browser_hold_missing_after_observation');
      assert.equal(called,0);assert.deepEqual([...secure],before);assert.equal(raw.getItem(HOLD),null);
    }else if(name==='writer-removal-no-upgrade'){
      const bytes=JSON.stringify({device_id:'KIOSK_08',note:'protected pending original'});
      await publicSecurity.mutateProtectedWork(()=>globalThis.localStorage.setItem(workKey,bytes));raw.setItem(HOLD,'unknown preserved hold');
      const before=[...secure],beforeRemovals=removals;
      await reject(remove(),'custodial_pending_work');assert.equal(remote,0);assert.equal(removals,beforeRemovals);
      assert.deepEqual([...secure],before);assert.equal(raw.getItem(workKey),bytes);assert.equal(raw.getItem(HOLD),'unknown preserved hold');
    }
    await tick();assert.equal(sharedLocks.active,false);assert.equal(sharedLocks.pending,0);assert.equal(opens,0);return;
  }
  if(name==='public-status-only'){
    for(const method of ['setEnrollment','removeEnrollment','getCredential','credentialStore','secureStorage','rawStorage']){
      assert.equal(Object.hasOwn(publicSecurity,method),false);assert.equal(Object.hasOwn(shell,method),false);
    }
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,'MemphisCustodialSecurity');
    assert.equal(descriptor.writable,false);assert.equal(descriptor.configurable,false);assert.equal(Object.isFrozen(publicSecurity),true);
    assert.equal(JSON.stringify(publicSecurity.getStatus()).includes('SYNTHETIC_composition_only_credential'),false);
    assert.equal(Object.values(globalThis).includes(bridge.credentialStore),false);
  }else if(name==='bound-raw-before-firewall'){
    const before=[...secure],rows=[...storage.rows];
    assert.throws(()=>globalThis.localStorage.setItem('mz_scan_device_id','FOREIGN'),error=>error.code==='custodial_protected_state_read_only');
    assert.throws(()=>globalThis.localStorage.clear(),error=>error.code==='custodial_protected_state_read_only');
    assert.deepEqual([...secure],before);assert.deepEqual([...storage.rows],rows);assert.equal(publicSecurity.getStatus().deviceId,'KIOSK_08');
  }else{
    const selected=name==='four-prefix-bridge-removal'?prefixes:[prefixes[3]];
    for(const prefix of selected){
      await publicSecurity.mutateProtectedWork(()=>globalThis.localStorage.setItem(prefix+'original',JSON.stringify({device_id:'KIOSK_08',note:'SYNTHETIC exact work'})));
    }
    const beforeSecure=[...secure],beforeRows=[...storage.rows],beforeRemovals=removals;
    await assert.rejects(remove(),error=>error.code==='custodial_pending_work');
    assert.deepEqual([...secure],beforeSecure);assert.deepEqual([...storage.rows],beforeRows);
    assert.equal(shell.getStatus().preservedCounts.total_pending,selected.length);
    assert.equal(shell.getStatus().preservedCounts.additional_protected_work,selected.length);
    assert.equal(remote,0);assert.equal(removals,beforeRemovals);
  }
  assert.equal(opens,0);
}

const selected=process.argv.slice(2).find(value=>!value.startsWith('--'));
if(selected){assert.ok(cases.includes(selected));await run(selected);console.log('PASS '+selected);}
else{
  const selectedCases=process.argv.includes('--writer-only')?writerCases:cases;
  const outcomes=selectedCases.map(name=>{
    const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),name],{encoding:'utf8',timeout:15000});
    assert.ifError(result.error);assert.equal(result.status,0,name+' failed: '+result.stderr+result.stdout);
    return {name,status:result.status,stdout:result.stdout.trim()};
  });
  console.log(JSON.stringify({schema:'custodial.namespace-runtime-composition-qualification.v1',new_groups:outcomes.length,
    failed:0,skipped:0,scope:'ACTUAL_ESM_SECURITY_RUNTIME_RAW_STORAGE_FIREWALL_CREDENTIAL_OWNER;SYNTHETIC_STORAGE_SECURE_CALLBACKS_CRYPTO_IDB_ABSENCE_ONLY',
    old26_and7_rerun:false,rendered_browser_native_SQL_phone_key_removal_or_acceptance:false,outcomes},null,2));
}
