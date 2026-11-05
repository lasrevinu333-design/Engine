import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname;
const {getCustodialBridgeSecurityRuntime}=await import(root+'mobile/src/custodial/security-runtime.js');
const keys=await import(root+'mobile/src/custodial/credential-store.js');
const {createSyntheticScheduleLocks}=await import(root+'scripts/synthetic-schedule-locks.mjs');
const source=fs.readFileSync(root+'mobile/src/custodial/bridge.js','utf8');
const page=fs.readFileSync(root+'index.html','utf8');
const id=n=>'ed000000-0000-4000-8000-'+String(n).padStart(12,'0');
const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),credential_operation_id:id(3),assignment_epoch:7,installation_seal:'SYNTHETIC_SCAN_STARTUP_SEAL',enrolled_at:'2026-01-01T00:00:00.000Z'};
class Storage{constructor(){this.rows=new Map();}get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}getItem(k){return this.rows.get(k)??null;}setItem(k,v){this.rows.set(k,String(v));}removeItem(k){this.rows.delete(k);}clear(){this.rows.clear();}}
const storage=new Storage(),sessionStorage=new Storage(),secure=new Map();
for(const k of keys.CUSTODIAL_DEVICE_KEYS)storage.setItem(k,principal.device_id);
storage.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,principal.installation_seal);
secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,JSON.stringify({schema_version:1,credential:'SYNTHETIC_NOT_REAL',device_id:principal.device_id,installation_seal:principal.installation_seal,enrolled_at:principal.enrolled_at,principal}));
const runtime=getCustodialBridgeSecurityRuntime({storage,sessionStorage,locks:createSyntheticScheduleLocks(),cryptoApi:webcrypto,indexedDb:{databases:async()=>[]},secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
await runtime.security.ready;
let resolveRequest,dispatchSeen;const dispatched=new Promise(r=>{dispatchSeen=r;});
const messages=[],warnings=[];
const payload={version:'release-2026.07.19.custodial-v3.12',contracts:{scan:'scan.v4.snapshot-bound-authority'},release_manifest:{schema:{fingerprint:'fea262d4eb49204e7c920662cef476c36015c28330435cafd238a358defd79dc'}}};
const context={URL,Request,Response,Headers,Date,JSON,Number,Object,console:{warn:(...args)=>warnings.push(args.map(x=>x?.code||x?.message||x)),error:console.error},
 window:{MemphisCustodialSecurity:runtime.security,MemphisMobile:{edition:'custodial'},location:{href:'https://localhost/scan.html?backend_version='+payload.version}},navigator:{onLine:true},
 localStorage:storage,sessionStorage,credentialStore:runtime.credentialStore,nativeVault:true,API_ORIGIN:'https://memphis-zoo-mcp.onrender.com',target:input=>new URL(input),currentPrincipalIdentity:()=>JSON.stringify(principal),
 publicUnauthenticatedRoute:()=>true,nativeCustodialAuthorizedFetch:()=>{dispatchSeen();return new Promise(r=>{resolveRequest=()=>r(new Response(JSON.stringify(payload),{status:200}));});},
 getNativeCustodialVaultState:async()=>({state:'ACTIVE'}),removeEnrollment:()=>{throw Error('unexpected removal');},confirmPendingEnrollment:async()=>null,
 setBuildStamp(){},renderMessageCard:(...args)=>messages.push(args),backendMeetsMinimum:v=>v===payload.version,
 SCAN_CONTRACT_CACHE_KEY:'mz_scan_contract_cache:'+payload.version,BACKEND_REFRESH_KEY:'mz_scan_backend_refresh'};
vm.createContext(context);
const resume=source.slice(source.indexOf('  async function resumePendingSecurityWorkflow('),source.indexOf('\n  function safeNativeRoute('));
const pageFunctions=page.slice(page.indexOf('    let scanNativeSecurityRequired'),page.indexOf('    guardedStart().catch'))+page.slice(page.indexOf('    async function mutateCustodialWork('),page.indexOf('    function updateDebugPanel('));
const compatibility=page.split('\n').find(x=>x.includes('async function verifyBackendCompatibility('));
const config=page.match(/const CONFIG=(\{[^\n]+?\});/)[1];
vm.runInContext('const CONFIG='+config+';\n'+pageFunctions+'\n'+source.slice(source.indexOf('  async function bridgeFetch('),source.indexOf('\n  async function requestEnvelope('))+'\n'+resume+'\n'+compatibility+'\nfetch=bridgeFetch;',context);
const generationBefore=runtime.security.getStatus().generation;
const operation=context.verifyBackendCompatibility();
await dispatched;
await context.resumePendingSecurityWorkflow();
resolveRequest();
const refused=await operation;
const result={mode:'current-source',refused,messages,warnings,generation_before:generationBefore,generation_after:runtime.security.getStatus().generation,compatible_cache_saved:storage.getItem(context.SCAN_CONTRACT_CACHE_KEY)!==null,scope:'Shipping page compatibility, bridge fetch/resume and security runtime; synthetic native HTTP and browser platform; not phone acceptance'};
console.log(JSON.stringify(result,null,2));
assert.equal(refused,false);assert.equal(result.compatible_cache_saved,true);
assert.equal(result.generation_before,result.generation_after);
assert.deepEqual(messages,[]);assert.deepEqual(warnings,[]);
// Pending-operation fixtures exercise the original resume contract separately
// from the real runtime race above. They never represent phone authority.
for(const scenario of ['pending-active','pending-inactive','removal','native-read-fails','reconciliation-fails']){
 let pending={operation_id:id(4),status:'pending_server'},calls=[];
 const c={nativeVault:true,credentialStore:{getRemovalRecord:()=>scenario==='removal'?{}:null,
  getPendingEnrollmentOperation:()=>pending,ensureSecurityState:async()=>{calls.push('reconcile');if(scenario==='reconciliation-fails')throw Error('reconciliation unavailable');pending=null;}},
  getNativeCustodialVaultState:async()=>{calls.push('native-state');if(scenario==='native-read-fails')throw Error('native unavailable');return {state:scenario==='pending-inactive'?'PREPARED':'ACTIVE'};},
  removeEnrollment:async()=>{calls.push('remove');return 'removed';},resumeNativePendingEnrollment:async operation=>{assert.equal(operation,pending);calls.push('resume-original');return 'resumed';},
  confirmPendingEnrollment:async()=>{calls.push('confirm');return null;}};
 vm.createContext(c);vm.runInContext(resume,c);
 if(scenario.endsWith('fails'))await assert.rejects(c.resumePendingSecurityWorkflow(),/unavailable/);else await c.resumePendingSecurityWorkflow();
 const expected={'pending-active':['native-state','reconcile','confirm'],'pending-inactive':['native-state','resume-original'],removal:['remove'],'native-read-fails':['native-state'],'reconciliation-fails':['native-state','reconcile']}[scenario];
 assert.deepEqual(calls,expected,scenario);
}
console.log(JSON.stringify({passed:6,failed:0,scope:'Real runtime version-request race plus pending-operation control-flow fixtures; no phone acceptance'}));
