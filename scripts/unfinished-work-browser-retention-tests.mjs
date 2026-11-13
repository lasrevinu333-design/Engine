import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=page.split('\n').find(line=>line.includes('async function reconcileOpenLocalSessions('));assert.ok(code);
let calls=0,removals=[],status='cancelled';const raw=JSON.stringify({session_uuid:'original',client_session_id:'original-alias',location_code:'ORIGINAL',saved_answers:'Non-reconstructible original answer'});
const original=JSON.parse(raw),store=new Map([['session',raw],['draft','Original draft bytes stay untouched']]);
const context=vm.createContext({window:{MemphisMobile:{nativeOfflineTimeAuthority:false},MemphisUI:{resolveOpenScanSession:()=>({state:'open',session:original})}},managerRecoveryError:message=>Error(message),rpcOne:async()=>{calls++;return{latest_session_status:status,latest_session_uuid:'original'};},removeLocalSession:async id=>{removals.push(id);store.delete('session');store.delete('draft');}});
vm.runInContext(code,context);const reconcile=vm.runInContext('reconcileOpenLocalSessions',context);
for(status of ['cancelled','quarantined','recovery_required']){await reconcile('SYNTHETIC');assert.equal(removals.length,0);assert.equal(JSON.stringify(original),raw);assert.equal(store.get('session'),raw);assert.equal(store.get('draft'),'Original draft bytes stay untouched');}
status='closed';await reconcile('SYNTHETIC');assert.deepEqual(removals,['original','original-alias']);assert.equal(store.size,0);
context.window.MemphisMobile.nativeOfflineTimeAuthority=true;const before=calls;await reconcile('SYNTHETIC');assert.equal(calls,before);
console.log(JSON.stringify({passed:3,failed:0,scope:'Actual legacy browser reconciliation preserves cancelled/quarantined originals; completed cleanup and native ownership exclusion remain; no browser/phone execution'}));
