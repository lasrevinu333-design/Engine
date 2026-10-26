import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {createFeedbackOutbox} from '../mobile/src/custodial/feedback-outbox.js';
import {createProtectedFeedbackIdentity} from '../mobile/src/custodial/protected-principal.js';

const sha=x=>createHash('sha256').update(x).digest('hex');
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);assert.equal(source.indexOf(start,a+1),-1);return source.slice(a,b);}

// Caller must retain actual normal runtime factories + live native IPC owner.
// No synthetic getStatus/ready/principal/mutation callback substitutes here.
export async function consumeNativeOriginalFeedbackJourney({frontendRoot,prepared,security,mobile,credentialStore,storage,nativeTransport,originalRow}) {
 assert.equal(security?.native,true);assert.equal(typeof security.mutateProtectedWork,'function');
 assert.equal(typeof credentialStore?.dispatchAuthorizedTransport,'function');assert.equal(typeof credentialStore?.waitForStableState,'function');
 assert.equal(typeof nativeTransport,'function');assert.equal(typeof originalRow,'function');
 const nativeSource=readFileSync(resolve(frontendRoot,'mobile/src/custodial/native-security.js'),'utf8');
 const bridgeSource=readFileSync(resolve(frontendRoot,'mobile/src/custodial/bridge.js'),'utf8');
 const {credentialRecoveryReasonForResponse}=await import(pathToFileURL(resolve(frontendRoot,'mobile/src/custodial/transport-policy.js')));
 const calls=[],notices=[],window={MemphisCustodialSecurity:security,MemphisMobile:mobile,dispatchEvent(){}};
 const scope=vm.createContext({window,localStorage:storage,Date,JSON,Set,Map,WeakMap,Object,Array,Number,String,Error,URL,Request,Response,Headers,AbortController,DOMException,FormData,Blob,Uint8Array,TextEncoder,TextDecoder,atob,btoa,location:{href:'https://localhost/employee-feedback.html'},setTimeout,clearTimeout,CustomEvent:class{},
  API:'https://memphis-zoo-mcp.onrender.com',canonicalDeviceId:value=>/^KIOSK_\d{2}$/.test(value)?value:'',securityError:code=>Object.assign(new Error(code),{code}),isCustodialNativeVaultPlatform:()=>true,
  CustodialNativeVault:{async authorizedRequest(input){assert.equal(input.method,'POST');assert.equal(input.path,'/feedback-api/submit');assert.equal(input.device_id,prepared.device_identifier);const response=await nativeTransport({method:input.method,path:input.path,body_base64:input.body_base64,headers:input.headers});calls.push({path:input.path,status:response.status});return response;}}});
 vm.runInContext(section(nativeSource,'function bytesToBase64(', '\nexport async function reportNativeCustodialRecoveryDiagnostic(').replace('export async function nativeCustodialAuthorizedFetch','async function nativeCustodialAuthorizedFetch'),scope,{timeout:1000});
 Object.assign(scope,{credentialStore,nativeVault:true,browserTestBuild:false,API_ORIGIN:'https://memphis-zoo-mcp.onrender.com',currentPrincipalIdentity:()=>mobile.principalIdentity(),rawFetch:()=>{throw Error('External network forbidden');},credentialRecoveryReasonForResponse});
 vm.runInContext(section(bridgeSource,'  function target(', '\n  function publicUnauthenticatedRoute(')+section(bridgeSource,'  function publicUnauthenticatedRoute(', '\n  async function requestEnvelope(')+section(bridgeSource,'  async function requestEnvelope(', '\n  async function confirmPendingEnrollment(')+'\nthis.normalRequestEnvelope=requestEnvelope;',scope,{timeout:1000});
 const identity=createProtectedFeedbackIdentity({ready:()=>security.ready,security,currentDeviceId:()=>prepared.device_identifier,online:()=>true,refreshStatus:()=>{throw Error('Existing original native principal required; no fabricated profile/refresh');}});
 let loseFirst=true;const box=createFeedbackOutbox({storage,mutate:work=>security.mutateProtectedWork(work),identity,online:()=>true,onStatus:value=>notices.push(value),
  request:async(path,options)=>{const response=await scope.normalRequestEnvelope(path,options);if(loseFirst){loseFirst=false;throw Error('SYNTHETIC_LOST_REPLY_AFTER_REAL_NATIVE_SQL_CAPTURE');}return response;}});
 const operationId=randomUUID(),body={operation_id:operationId,message:'Fresh G24 protected feedback ñ / zero0',category:'need_help',priority:'normal',page_url:'employee-feedback.html'};
 await box.save(body);const key=[...Array(storage.length)].map((_,i)=>storage.key(i)).find(k=>k.startsWith('mz_employee_feedback_outbox:')&&k.endsWith(':'+operationId));assert.ok(key);const raw=storage.getItem(key);assert.equal(typeof raw,'string');const original=JSON.parse(raw).body;
 assert.deepEqual(await box.flush(),[]);assert.equal(storage.getItem(key),raw,'lost settled response must retain original bytes');
 const first=await originalRow(operationId);assert.equal(first.operation_id,operationId);assert.equal(first.message,body.message);assert.equal(first.device_id,prepared.device_identifier);assert.equal(first.hub_context,'employee');
 assert.equal(first.metadata_json.identity_verification.employee_id,original.expected_employee_id);assert.equal(first.metadata_json.identity_verification.credential_id,original.expected_credential_id);assert.equal(String(first.metadata_json.identity_verification.assignment_epoch),original.expected_assignment_epoch);
 assert.deepEqual(await box.flush(),[operationId]);assert.equal(storage.getItem(key),null);const backupKey='mz_employee_feedback_retirement_backup:'+prepared.device_identifier+':'+operationId;const backup=JSON.parse(storage.getItem(backupKey));assert.equal(backup.original_key,key);assert.equal(backup.original_encoded,raw);
 const final=await originalRow(operationId);assert.deepEqual(final,first);assert.equal(calls.length,2);assert.ok(notices.every(n=>n.state!=='delivered'));assert.equal(notices.at(-1).state,'uploaded');
 return {schema:'custodial.native-feedback-local-consumer.v1',operation_id:operationId,feedback_id:first.id,requests:2,uniqueRows:1,lost_reply_preserved:true,retirement_backup_sha256:sha(raw),provider_send:false,android:false,physical:false,source_sha256:{native_security:sha(nativeSource),bridge:sha(bridgeSource)},scope:'ACTUAL_SHIPPING_OUTBOX_NATIVE_FIFO_AND_HTTP_BYTES_WITH_SYNTHETIC_BROWSER_PLATFORM'};
}
