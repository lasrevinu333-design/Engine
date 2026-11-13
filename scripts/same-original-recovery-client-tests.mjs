import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Recording-port/source tests only. No authenticated session, server decision,
// native operation, challenge issuance or permission is created by this fixture.
// Exact historical Source fixtures preserve their original pins; these are not current394/runtime authority.
const wirePath=fileURLToPath(new URL('../test-fixtures/ci/legacy-client/backend/src/same-original-recovery-wire.js',import.meta.url));
assert.equal(createHash('sha256').update(readFileSync(wirePath)).digest('hex'),'dc79e4f3a7f137c5ea159b1f2b909e864378497c67259f862c27cc9e233335cb');
const wire=await import(wirePath);
const {createSameOriginalRecoveryController}=createRequire(import.meta.url)('../same-original-recovery-client.js');
const PURPOSE='AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION';
const PATH='/admin-api/device-security/same-original-recovery/';
const id=n=>'95000000-0000-4000-8000-'+String(n).padStart(12,'0');
const limits={inventory_acknowledged:false,work_accepted:false,replay_allowed:false,finalizer_allowed:false,key_removal:false,phone_released:false};
const issuer={manager_id:id(1),manager_credential_id:id(2),manager_device_id:'manager-fixture'};
const initialOwner=()=>Object.freeze({...issuer,page_generation:1});
const target={operation_id:id(3),separation_id:id(4),separation_authority_revision:'7',canonical_device_pk:id(5),
 canonical_device_id:'KIOSK_08',employee_id:id(6),credential_id:id(7),assignment_epoch:'7',original_generation_id:id(8),
 original_credential_secret_key_id:'a'.repeat(64),principal_digest:'a'.repeat(64),engine_revision:'0',
 original_wire_sha256:'a'.repeat(64),original_frozen_work_sha256:'a'.repeat(64),capsule_sha256:'a'.repeat(64),
 record_sha256:'a'.repeat(64),frame_sha256:'a'.repeat(64),plan_sha256:'a'.repeat(64),aad_binding_sha256:'a'.repeat(64),
 source_capture_sha256:'a'.repeat(64),values_sha256:'a'.repeat(64),semantic_join_sha256:'a'.repeat(64),layout_sha256:'a'.repeat(64)};
function preview(){const v={schema:'custodial.same-original-recovery-review.v1',state:'ORIGINAL_BINDING_REVIEW_ONLY',
 purpose:PURPOSE,challenge_id:id(9),challenge_sha256:'b'.repeat(64),preview_sha256:'a'.repeat(64),
 original_target:structuredClone(target),expires_at:'2026-10-14T00:05:00.000000Z',limits:{...limits}};
 v.preview_sha256=wire.recoveryDocumentSha256('preview',v);return v;}
function receipt(original,p){const v={schema:'custodial.same-original-recovery-approval-receipt.v1',state:'APPROVAL_RECORDED_ONLY',
 approval_id:id(10),original_request:structuredClone(original),original_request_sha256:wire.recoveryDocumentSha256('request',original),
 issuer:{...issuer},challenge_sha256:p.challenge_sha256,preview_sha256:p.preview_sha256,original_target:structuredClone(p.original_target),
 purpose_admission_id:'same-original-preparation.v1',issued_at:'2026-10-14T00:00:00.000000Z',expires_at:p.expires_at,
 receipt_sha256:'a'.repeat(64),retry_safe:false,limits:{...limits}};
 v.receipt_sha256=wire.recoveryDocumentSha256('receipt',v);return v;}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(){
 const f={owner:initialOwner(),saved:null,p:preview(),r:null,calls:[],events:[],readHook:null,retainHook:null,requestHook:null};
 f.ports={currentOwner:()=>f.owner,retainOriginal:async value=>{
  f.events.push('retain');assert(Object.isFrozen(value));f.saved=structuredClone(value);
  if(f.retainHook)await f.retainHook(value);
 },readOriginal:async()=>{f.events.push('read');if(f.readHook)return f.readHook();return structuredClone(f.saved);},
 request:async call=>{assert(Object.isFrozen(call));f.calls.push(call);f.events.push(call.path);
  if(f.requestHook)return f.requestHook(call);
  if(call.method==='GET')return structuredClone(f.p);
  if(call.path===PATH+'approvals'){f.r=receipt(call.body,f.p);return structuredClone(f.r);}
  if(call.path===PATH+'approvals/original-status')return structuredClone(f.r);
  assert.fail('Unexpected request');
 }};
 f.controller=createSameOriginalRecoveryController(f.ports);
 f.review=()=>f.controller.review(id(9));f.confirm=()=>f.controller.confirm();
 f.approvals=()=>f.calls.filter(c=>c.path===PATH+'approvals');
 f.status=()=>f.calls.filter(c=>c.path===PATH+'approvals/original-status');
 return f;
}

test('unmounted ports and unavailable owner cannot query or authorize',async()=>{
 const missing=createSameOriginalRecoveryController();assert.equal(missing.getState().state,'UNAVAILABLE');
 await assert.rejects(missing.review(id(9)),/ports_unavailable/);
 const f=fixture();f.owner=null;await assert.rejects(f.review(),/current_owner_unavailable/);assert.equal(f.calls.length,0);
});
test('immutable closed owner port required; role flags/caller request are not authorization shortcuts',async()=>{
 const f=fixture();f.owner={...initialOwner()};await assert.rejects(f.review(),/immutable_owner_required/);
 f.owner=Object.freeze({...initialOwner(),role:'Security Admin'});await assert.rejects(f.review(),/wire_invalid/);
 f.owner=initialOwner();await f.review();await assert.rejects(f.controller.confirm({approved:true}),/caller_request_forbidden/);
 assert.equal(f.approvals().length,0);
});
test('explicit review exposes exact original target/purpose/server expiry with all effects denied',async()=>{
 const f=fixture(),v=await f.review();assert.equal(v.state,'REVIEW_ONLY');assert(v.can_confirm);
 assert.deepEqual(v.original_target,target);assert.equal(v.purpose,PURPOSE);assert.equal(v.server_expires_at,f.p.expires_at);
 assert.deepEqual(v.limits,limits);assert(Object.isFrozen(v.original_target));assert.equal(v.receipt,null);
 assert.deepEqual(f.calls.map(c=>[c.method,c.path]),[['GET',PATH+'challenges/'+id(9)]]);
});
test('one confirmation retains/readbacks exact closed original before one POST and records only metadata',async()=>{
 const f=fixture();await f.review();const v=await f.confirm();assert.equal(v.state,'RECORDED');
 assert.deepEqual(wire.validateRecoveryApprovalRequest(f.saved),f.saved);
 assert.deepEqual(wire.validateRecoveryApprovalReceipt(v.receipt),f.r);
 assert.deepEqual(f.saved,f.approvals()[0].body);assert.notEqual(f.saved.request_id,target.operation_id);
 assert.notEqual(f.saved.request_id,target.separation_id);assert.equal(Object.keys(f.saved).length,10);
 assert.deepEqual(f.events.slice(2,5),['read','retain','read']);assert.equal(f.events[5],PATH+'approvals');
 assert.equal(f.approvals().length,1);assert(v.retention_confirmed);assert.deepEqual(v.limits,limits);
 await assert.rejects(f.confirm(),/original_status_only/);await assert.rejects(f.review(),/original_status_only/);
 assert.equal(f.approvals().length,1);
});
test('lost POST reply retains original and resumes with status only, never another approval',async()=>{
 const f=fixture();await f.review();f.requestHook=call=>{
  f.r=receipt(call.body,f.p);throw new Error('synthetic lost reply');
 };const v=await f.confirm();assert.equal(v.state,'UNKNOWN');const raw=JSON.stringify(f.saved);
 f.requestHook=null;assert.equal((await f.controller.resume()).state,'RECORDED');
 assert.equal(f.approvals().length,1);assert.equal(f.status().length,1);assert.equal(JSON.stringify(f.saved),raw);
 assert.deepEqual(f.status()[0].body,f.approvals()[0].body);
});
test('reload same issuer with new page generation reads exact original status and never renews timestamps',async()=>{
 const f=fixture();await f.review();await f.confirm();const raw=JSON.stringify(f.saved),old=structuredClone(f.r);
 f.owner=Object.freeze({...issuer,page_generation:2});const reloaded=createSameOriginalRecoveryController(f.ports);
 const v=await reloaded.resume();assert.equal(v.state,'RECORDED');assert.deepEqual(v.receipt,old);
 assert.equal(v.issued_at,old.issued_at);assert.equal(v.server_expires_at,old.expires_at);
 assert.equal(JSON.stringify(f.saved),raw);assert.equal(f.approvals().length,1);assert.equal(f.status().length,1);
 await assert.rejects(reloaded.confirm(),/original_status_only/);
});
test('foreign issuer manager/credential/device reload remains held without status request or adoption',async()=>{
 for(const field of ['manager_id','manager_credential_id','manager_device_id']){
  const f=fixture();await f.review();await f.confirm();const raw=JSON.stringify(f.saved);
  f.owner=Object.freeze({...initialOwner(),[field]:field==='manager_device_id'?'foreign-device':id(99)});
  const v=await createSameOriginalRecoveryController(f.ports).resume();assert.equal(v.state,'UNKNOWN');
  assert.equal(v.original_request,null);assert.equal(f.status().length,0);assert.equal(JSON.stringify(f.saved),raw);
 }
});
test('owner loss across review read/GET awaits hides target and prevents confirmation',async()=>{
 for(const seam of ['read','get']){const f=fixture(),entered=deferred(),done=deferred();
  if(seam==='read')f.readHook=async()=>{entered.resolve();await done.promise;return null;};
  else f.requestHook=async()=>{entered.resolve();await done.promise;return f.p;};
  const work=f.review();await entered.promise;f.owner=null;done.resolve();const v=await work;
  assert.equal(v.state,'HELD');assert.equal(v.original_target,null);assert.equal(v.can_confirm,false);
  assert.equal(f.approvals().length,0);if(seam==='read')assert.equal(f.calls.length,0);
 }
});
test('generation or issuer drift while retaining preserves saved request and prevents approval POST',async()=>{
 for(const change of [null,Object.freeze({...initialOwner(),page_generation:2}),Object.freeze({...initialOwner(),manager_id:id(99)})]){
  const f=fixture(),entered=deferred(),done=deferred();await f.review();
  f.retainHook=async()=>{entered.resolve();await done.promise;};const work=f.confirm();await entered.promise;
  const raw=JSON.stringify(f.saved);f.owner=change;done.resolve();const v=await work;
  assert.equal(v.state,'HELD');assert.equal(f.approvals().length,0);assert.equal(JSON.stringify(f.saved),raw);
 }
});
test('disposal during retention preserves original without dispatch or published result',async()=>{
 const f=fixture(),entered=deferred(),done=deferred();await f.review();
 f.retainHook=async()=>{entered.resolve();await done.promise;};const work=f.confirm();await entered.promise;
 const raw=JSON.stringify(f.saved);f.controller.dispose();done.resolve();assert.equal((await work).state,'CLOSED');
 assert.equal(f.approvals().length,0);assert.equal(JSON.stringify(f.saved),raw);
});
test('changed owner at approval reply or original-status reply cannot publish returned receipt',async()=>{
 for(const seam of ['approval','status']){const f=fixture(),entered=deferred(),done=deferred();await f.review();
  if(seam==='status')await f.confirm();
  f.requestHook=async call=>{const r=seam==='approval'?receipt(call.body,f.p):f.r;entered.resolve();await done.promise;return r;};
  const work=seam==='approval'?f.confirm():f.controller.resume();await entered.promise;const raw=JSON.stringify(f.saved);
  f.owner=Object.freeze({...initialOwner(),page_generation:2});done.resolve();const v=await work;
  assert.equal(v.state,'HELD');assert.equal(v.receipt,null);assert.equal(JSON.stringify(f.saved),raw);
  assert.equal(f.approvals().length,1);
 }
});
test('concurrent confirm is refused before another retention or request UUID',async()=>{
 const f=fixture(),entered=deferred(),done=deferred();await f.review();
 f.retainHook=async()=>{entered.resolve();await done.promise;};const work=f.confirm();await entered.promise;
 const raw=JSON.stringify(f.saved);await assert.rejects(f.confirm(),/original_status_only/);done.resolve();
 assert.equal((await work).state,'RECORDED');assert.equal(f.approvals().length,1);
 assert.equal(f.events.filter(e=>e==='retain').length,1);assert.equal(JSON.stringify(f.saved),raw);
});
test('unknown status/timeout/malformed/contradictory receipt keeps exact saved original and has zero resend',async()=>{
 for(const bad of [null,{state:'UNKNOWN'},'timeout','tuple','effect','hash']){const f=fixture();await f.review();await f.confirm();
  const raw=JSON.stringify(f.saved);f.requestHook=()=>{
   if(bad==='timeout')throw new Error('synthetic timeout');
   if(bad==='tuple'){const r=structuredClone(f.r);r.original_request.request_id=id(99);return r;}
   if(bad==='effect'){const r=structuredClone(f.r);r.limits.key_removal=true;return r;}
   if(bad==='hash'){const r=structuredClone(f.r);r.receipt_sha256='f'.repeat(64);return r;}return bad;
  };
  const c=createSameOriginalRecoveryController(f.ports);assert.equal((await c.resume()).state,'UNKNOWN');
  assert.equal(JSON.stringify(f.saved),raw);assert.equal(f.approvals().length,1);await assert.rejects(c.confirm(),/original_status_only/);
 }
});
test('retained conflicting/extra/accessor original never posts or adopts another operation',async()=>{
 const f=fixture();await f.review();f.retainHook=()=>{f.saved.request_id=id(99);};
 const v=await f.confirm();assert.equal(v.state,'UNKNOWN');assert.equal(f.approvals().length,0);
 let getters=0;const saved={...f.saved};Object.defineProperty(saved,'decision',{enumerable:true,get(){getters++;return PURPOSE;}});
 f.saved=saved;const c=createSameOriginalRecoveryController({...f.ports,readOriginal:async()=>saved});
 assert.equal((await c.resume()).state,'UNKNOWN');assert.equal(getters,0);assert.equal(f.status().length,0);
});
test('closed preview rejects extra fields/getters/hash tampering and any claimed effect',async()=>{
 for(const change of ['extra','getter','hash','effect']){const f=fixture();let getters=0;
  if(change==='extra')f.p.approved=true;
  if(change==='getter')Object.defineProperty(f.p,'purpose',{enumerable:true,get(){getters++;return PURPOSE;}});
  if(change==='hash')f.p.preview_sha256='f'.repeat(64);
  if(change==='effect')f.p.limits.replay_allowed=true;
  f.requestHook=()=>f.p;assert.equal((await f.review()).state,'HELD');assert.equal(getters,0);assert.equal(f.approvals().length,0);
 }
});
test('same challenge cannot refresh original expiry or target, even with a valid representation hash',async()=>{
 const f=fixture();await f.review();f.p.expires_at='2026-10-14T00:06:00.000000Z';
 f.p.preview_sha256=wire.recoveryDocumentSha256('preview',f.p);assert.equal((await f.review()).state,'HELD');
 assert.equal(f.controller.getState().server_expires_at,'2026-10-14T00:05:00.000000Z');assert.equal(f.approvals().length,0);
});
test('receipt cannot extend reviewed expiry or replace original target despite correct document hashes',async()=>{
 for(const change of ['expiry','target']){const f=fixture();await f.review();f.requestHook=call=>{
  const r=receipt(call.body,f.p);
  if(change==='expiry'){r.issued_at='2026-10-14T00:01:00.000000Z';r.expires_at='2026-10-14T00:06:00.000000Z';}
  else r.original_target.employee_id=id(99);
  r.receipt_sha256=wire.recoveryDocumentSha256('receipt',r);return r;
 };const v=await f.confirm();assert.equal(v.state,'UNKNOWN');assert.equal(v.receipt,null);assert(f.saved);
 assert.equal(f.approvals().length,1);
 }
});
test('uncertain retention failure keeps one original and reads unknown status without dispatching it',async()=>{
 const f=fixture();await f.review();f.retainHook=()=>{throw new Error('synthetic save reply lost');};
 const v=await f.confirm();assert.equal(v.state,'UNKNOWN');assert.equal(f.approvals().length,0);
 const raw=JSON.stringify(f.saved);f.retainHook=null;f.requestHook=()=>({state:'UNKNOWN'});
 assert.equal((await f.controller.resume()).state,'UNKNOWN');assert.equal(f.status().length,1);
 assert.equal(f.approvals().length,0);assert.equal(JSON.stringify(f.saved),raw);
});
