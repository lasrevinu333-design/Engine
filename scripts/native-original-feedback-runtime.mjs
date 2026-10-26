import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createNativeProtectedStorage} from '../mobile/src/custodial/native-security.js';
import {getCustodialBridgeSecurityRuntime} from '../mobile/src/custodial/security-runtime.js';
import {principalIdentity,profileMatchesPrincipal} from '../mobile/src/custodial/protected-principal.js';
import {createSyntheticScheduleLocks} from './synthetic-schedule-locks.mjs';

// Same mutable Storage prototype shape as the maintained normal browser
// fixture in custodial-readiness-bridge-tests.mjs (Area class). DATA only;
// shipping admission/firewall still decides every protected write.
class StorageArea {
 constructor(){this.rows=new Map();}
 get length(){return this.rows.size;}
 key(index){return [...this.rows.keys()][index]??null;}
 getItem(key){return this.rows.get(String(key))??null;}
 setItem(key,value){this.rows.set(String(key),String(value));}
 removeItem(key){this.rows.delete(String(key));}
 clear(){this.rows.clear();}
}
function storage(){return new StorageArea();}
// ONE fresh owning Node child only, matching security-runtime's per-document
// singleton. Synthetic Web Storage/empty declared IDB/Web Locks are platform
// fixtures. Native state/principal come ONLY from the live new Engine/journal
// leaf. Actual native secure adapter, browser admission/firewall, credential
// store and public runtime are constructed by their SHIPPING factories.
export async function createNativeFeedbackRuntime({ipc}) {
 assert.equal(globalThis.MemphisCustodialSecurity,undefined,'fresh child runtime only');
 const local=storage(),session=storage();
 const indexedDb={async databases(){return [];},open(){throw Error('No fixture databases declared; do not fabricate a successful open');}};
 const plugin=Object.freeze({getState:()=>ipc.getState()});
 const secureStorage=createNativeProtectedStorage(plugin,local);
 const runtime=getCustodialBridgeSecurityRuntime({secureStorage,storage:local,sessionStorage:session,indexedDb,
  cryptoApi:webcrypto,locks:createSyntheticScheduleLocks()});
 await runtime.security.ready;
 const status=runtime.security.getStatus();assert.equal(status.ready,true);assert.equal(status.available,true);assert.equal(status.quarantined,false);
 assert.ok(status.principal,'native journal-produced principal required');
 const mobile=Object.freeze({edition:'custodial',principalIdentity:()=>principalIdentity(runtime.security.getStatus().principal),
  profileMatchesPrincipal:value=>profileMatchesPrincipal(value,runtime.security.getStatus().principal)});
 return Object.freeze({security:runtime.security,credentialStore:runtime.credentialStore,mobile,storage:local,
  scope:'SHIPPING_RUNTIME_FACTORIES_WITH_LIVE_NATIVE_SOURCE_STATE_AND_SYNTHETIC_BROWSER_PLATFORM'});
}
