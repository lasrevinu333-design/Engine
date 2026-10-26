import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Actual panel + unchanged controller, recording DOM/ports only. No browser,
// authenticated manager, SQL, native permission or durable production store.
// Exact historical Source fixtures preserve their original pins; these are not current394/runtime authority.
const main=fileURLToPath(new URL('../test-fixtures/ci/legacy-panel',import.meta.url));
for(const [path,pin] of [
 ['frontend/same-original-recovery-client.js','4258f569d9417a6b3a4b0e1153b753409ee2b387499c5dcd4bf9491a187270dc'],
 ['frontend/mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/NativeSameOriginalRecoveryPreparationWire.java','b11134e9f35ad1c7a10f4d00a53e2416879617d296e0055530d9de2cd5bf1daa'],
 ['backend/src/manager-original-recovery-approval.js','622571d4ac00dc850b3aaac86d815fcaf00fbd2fe3967869a2cdeab1deec115d'],
 ['backend/src/same-original-recovery-wire.js','dc79e4f3a7f137c5ea159b1f2b909e864378497c67259f862c27cc9e233335cb']
])assert.equal(createHash('sha256').update(readFileSync(main+'/'+path)).digest('hex'),pin);
const require=createRequire(import.meta.url);
const {createSameOriginalRecoveryController}=require(main+'/frontend/same-original-recovery-client.js');
const {mountSameOriginalRecoveryPanel}=require('../same-original-recovery-panel.js');
const {recoveryDocumentSha256}=await import(main+'/backend/src/same-original-recovery-wire.js');
const id=n=>'96000000-0000-4000-8000-'+String(n).padStart(12,'0');
const PATH='/admin-api/device-security/same-original-recovery/';
const purpose='AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION';
const limits={inventory_acknowledged:false,work_accepted:false,replay_allowed:false,finalizer_allowed:false,key_removal:false,phone_released:false};
const issuer={manager_id:id(1),manager_credential_id:id(2),manager_device_id:'recording-panel-owner'};
function preview(){const original_target={operation_id:id(3),separation_id:id(4),separation_authority_revision:'8',
 canonical_device_pk:id(5),canonical_device_id:'KIOSK_08',employee_id:id(6),credential_id:id(7),assignment_epoch:'8',
 original_generation_id:id(8),original_credential_secret_key_id:'a'.repeat(64),principal_digest:'b'.repeat(64),engine_revision:'0',
 original_wire_sha256:'c'.repeat(64),original_frozen_work_sha256:'d'.repeat(64),capsule_sha256:'e'.repeat(64),record_sha256:'f'.repeat(64),
 frame_sha256:'1'.repeat(64),plan_sha256:'2'.repeat(64),aad_binding_sha256:'3'.repeat(64),source_capture_sha256:'4'.repeat(64),
 values_sha256:'5'.repeat(64),semantic_join_sha256:'6'.repeat(64),layout_sha256:'7'.repeat(64)};
 const p={schema:'custodial.same-original-recovery-review.v1',state:'ORIGINAL_BINDING_REVIEW_ONLY',purpose,challenge_id:id(9),
  challenge_sha256:'8'.repeat(64),preview_sha256:'9'.repeat(64),original_target,expires_at:'2026-10-14T00:05:00.000001Z',limits:{...limits}};
 p.preview_sha256=recoveryDocumentSha256('preview',p);return p;}
function receipt(original,p){const r={schema:'custodial.same-original-recovery-approval-receipt.v1',state:'APPROVAL_RECORDED_ONLY',
 approval_id:id(10),original_request:structuredClone(original),original_request_sha256:recoveryDocumentSha256('request',original),
 issuer:{...issuer},challenge_sha256:p.challenge_sha256,preview_sha256:p.preview_sha256,original_target:structuredClone(p.original_target),
 purpose_admission_id:'same-original-preparation.v1',issued_at:'2026-10-14T00:00:00.000001Z',expires_at:p.expires_at,
 receipt_sha256:'a'.repeat(64),retry_safe:false,limits:{...limits}};
 r.receipt_sha256=recoveryDocumentSha256('receipt',r);return r;}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};}

// Minimal recording DOM ports, not a rendered browser or alternate controller.
class Element{
 constructor(){this.value='';this.disabled=false;this.hidden=false;this.textContent='';this.listeners=new Map();}
 set innerHTML(_){assert.fail('Panel must never use innerHTML');}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 async emit(type,force=false){if(type==='click'&&this.disabled&&!force)return;
  const event={preventDefault(){}};await Promise.all([...(this.listeners.get(type)||[])].map(fn=>fn(event)));}
 countListeners(){return [...this.listeners.values()].reduce((n,set)=>n+set.size,0);}
}
class RecordingRoot extends Element{
 constructor(){super();this.nodes=new Map(['Challenge','Review','Confirm','Status','Summary','Message'].map(n=>['sameOriginal'+n,new Element()]));}
 querySelector(selector){return this.nodes.get(selector.slice(1))||null;}
 node(name){return this.nodes.get('sameOriginal'+name);}
 countAllListeners(){return this.countListeners()+[...this.nodes.values()].reduce((n,e)=>n+e.countListeners(),0);}
}
function fixture(){const f={root:new RecordingRoot(),owns:true,owner:Object.freeze({...issuer,page_generation:1}),saved:null,
 p:preview(),r:null,calls:[],requestHook:null,retainHook:null,disposer:null};
 f.ports={currentOwner:()=>f.owner,retainOriginal:async value=>{f.saved=structuredClone(value);if(f.retainHook)await f.retainHook();},
  readOriginal:async()=>structuredClone(f.saved),request:async call=>{f.calls.push(call);if(f.requestHook)return f.requestHook(call);
   if(call.method==='GET')return structuredClone(f.p);
   if(call.path===PATH+'approvals'){f.r=receipt(call.body,f.p);return structuredClone(f.r);}
   assert.equal(call.path,PATH+'approvals/original-status');return structuredClone(f.r);}};
 f.controller=createSameOriginalRecoveryController(f.ports);
 f.mount=controller=>{f.disposer=mountSameOriginalRecoveryPanel({root:f.root,controller:controller||f.controller,ownsPage:()=>f.owns});};
 f.click=(name,force=false)=>f.root.node(name).emit('click',force);
 f.review=async()=>{f.root.node('Challenge').value=id(9);await f.click('Review');};
 f.approvals=()=>f.calls.filter(c=>c.path===PATH+'approvals');
 f.status=()=>f.calls.filter(c=>c.path===PATH+'approvals/original-status');
 f.disabled=()=>{for(const n of ['Challenge','Review','Confirm','Status'])assert(f.root.node(n).disabled,n+' must be disabled');};
 f.hidden=()=>{assert.equal(f.root.node('Summary').textContent,'');assert(f.root.node('Summary').hidden);assert.equal(f.root.node('Challenge').value,'');};
 return f;
}

test('review click composes actual controller and renders exact original pins/expiry as text only',async()=>{
 const f=fixture();f.mount();assert.equal(f.root.node('Confirm').disabled,true);await f.review();
 assert.deepEqual(f.calls.map(c=>[c.method,c.path]),[['GET',PATH+'challenges/'+id(9)]]);
 assert.equal(f.root.node('Confirm').disabled,false);assert.equal(f.root.node('Status').disabled,true);
 const text=f.root.node('Summary').textContent;
 for(const value of [purpose,f.p.original_target.canonical_device_id,f.p.original_target.canonical_device_pk,
  f.p.original_target.employee_id,f.p.original_target.operation_id,f.p.original_target.original_generation_id,
  f.p.original_target.capsule_sha256,f.p.original_target.source_capture_sha256,f.p.expires_at])assert(text.includes(value));
 assert.equal(f.root.node('Summary').hidden,false);assert.match(f.root.node('Message').textContent,/preparation only, not a native grant/);
 f.disposer();assert.equal(f.root.countAllListeners(),0);
});
test('explicit confirm records preparation only; retained original disables review and any second approval',async()=>{
 const f=fixture();f.mount();await f.review();await f.click('Confirm');const raw=JSON.stringify(f.saved);
 assert.equal(f.approvals().length,1);assert.equal(f.root.node('Review').disabled,true);assert(f.root.node('Challenge').disabled);
 assert(f.root.node('Confirm').disabled);assert.equal(f.root.node('Status').disabled,false);
 assert.match(f.root.node('Message').textContent,/Preparation recorded ONLY/);assert.match(f.root.node('Message').textContent,/not native approval/);
 await f.click('Confirm',true);await f.click('Review',true);assert.equal(f.approvals().length,1);
 assert.equal(f.calls.filter(c=>c.method==='GET').length,1);assert.equal(JSON.stringify(f.saved),raw);f.disposer();
});
test('uncertain reply enables only exact original-status; successful status adds no approval POST',async()=>{
 const f=fixture();f.mount();await f.review();f.requestHook=call=>{f.r=receipt(call.body,f.p);throw new Error('lost response');};
 await f.click('Confirm');const raw=JSON.stringify(f.saved);assert.equal(f.approvals().length,1);
 assert(f.root.node('Review').disabled);assert(f.root.node('Confirm').disabled);assert.equal(f.root.node('Status').disabled,false);
 assert.match(f.root.node('Message').textContent,/Outcome unknown/);assert.match(f.root.node('Message').textContent,/Original-status only; no resend/);
 await f.click('Review',true);await f.click('Confirm',true);f.requestHook=null;await f.click('Status');
 assert.equal(f.approvals().length,1);assert.equal(f.status().length,1);assert.deepEqual(f.status()[0].body,f.approvals()[0].body);
 assert.equal(JSON.stringify(f.saved),raw);assert.match(f.root.node('Message').textContent,/Preparation recorded ONLY/);f.disposer();
});
test('unknown original status remains held with original bytes and no resend even on forced clicks',async()=>{
 const f=fixture();f.mount();await f.review();f.requestHook=()=>{throw new Error('lost response');};await f.click('Confirm');
 const raw=JSON.stringify(f.saved);f.requestHook=()=>({state:'UNKNOWN'});await f.click('Status');
 assert.equal(f.controller.getState().state,'UNKNOWN');assert.equal(JSON.stringify(f.saved),raw);
 await f.click('Confirm',true);await f.click('Review',true);assert.equal(f.approvals().length,1);assert.equal(f.status().length,1);
 assert.match(f.root.node('Message').textContent,/no resend or replacement/);f.disposer();
});
test('reload mounts hydrated original controller as status-only without inventing a new intent',async()=>{
 const f=fixture();await f.controller.review(id(9));await f.controller.confirm();const raw=JSON.stringify(f.saved);
 f.owner=Object.freeze({...issuer,page_generation:2});const restored=createSameOriginalRecoveryController(f.ports);
 // Main must hydrate before mount; panel has no saved-row/auth/storage getter.
 await restored.resume();f.mount(restored);assert(f.root.node('Review').disabled);assert(f.root.node('Confirm').disabled);
 assert.equal(f.root.node('Status').disabled,false);await f.click('Status');assert.equal(f.approvals().length,1);
 assert.equal(f.status().length,2);assert.equal(JSON.stringify(f.saved),raw);assert(f.root.node('Summary').textContent.includes(f.r.expires_at));f.disposer();
});
test('ownership loss during deferred review permanently hides reply and stops later actions',async()=>{
 const f=fixture(),entered=deferred(),reply=deferred();f.mount();f.root.node('Challenge').value=id(9);
 f.requestHook=async()=>{entered.resolve();await reply.promise;return f.p;};const work=f.click('Review');await entered.promise;
 f.owns=false;await f.root.emit('focusin');f.disabled();f.hidden();reply.resolve();await work;
 f.owns=true;await f.click('Confirm',true);await f.click('Review',true);f.disabled();f.hidden();assert.equal(f.calls.length,1);f.disposer();
});
test('dispose during approval await prevents late rendering and preserves original/controller',async()=>{
 const f=fixture(),entered=deferred(),reply=deferred();f.mount();await f.review();
 f.requestHook=async call=>{f.r=receipt(call.body,f.p);entered.resolve();await reply.promise;return f.r;};
 const work=f.click('Confirm');await entered.promise;const raw=JSON.stringify(f.saved);f.disposer();const closed=f.root.node('Message').textContent;
 f.disabled();f.hidden();assert.equal(f.root.countAllListeners(),0);reply.resolve();await work;
 assert.equal(f.root.node('Message').textContent,closed);assert.equal(JSON.stringify(f.saved),raw);
 assert.equal(f.controller.getState().state,'RECORDED');assert.equal(f.approvals().length,1);await f.click('Status',true);assert.equal(f.status().length,0);
});
test('ownership loss during original-status await hides content without deleting saved original',async()=>{
 const f=fixture(),entered=deferred(),reply=deferred();f.mount();await f.review();await f.click('Confirm');
 const raw=JSON.stringify(f.saved);f.requestHook=async()=>{entered.resolve();await reply.promise;return f.r;};
 const work=f.click('Status');await entered.promise;f.owns=false;await f.root.emit('pointerdown');f.disabled();f.hidden();
 const held=f.root.node('Message').textContent;reply.resolve();await work;assert.equal(f.root.node('Message').textContent,held);
 assert.equal(JSON.stringify(f.saved),raw);assert.equal(f.approvals().length,1);assert.equal(f.status().length,1);f.disposer();
});
test('double confirm while retain awaits is one panel action, one original and one POST',async()=>{
 const f=fixture(),entered=deferred(),finish=deferred();f.mount();await f.review();
 f.retainHook=async()=>{entered.resolve();await finish.promise;};const work=f.click('Confirm');await entered.promise;
 const raw=JSON.stringify(f.saved);await f.click('Confirm',true);await f.click('Status',true);await f.click('Review',true);
 assert.equal(f.approvals().length,0);assert.equal(f.status().length,0);assert.equal(JSON.stringify(f.saved),raw);
 finish.resolve();await work;assert.equal(f.approvals().length,1);assert.equal(JSON.stringify(f.saved),raw);f.disposer();
});
test('readonly page or absent controller ports cannot enable actions or display a cached target',async()=>{
 const f=fixture();await f.controller.review(id(9));f.owns=false;f.mount();f.disabled();f.hidden();
 await f.click('Confirm',true);assert.equal(f.approvals().length,0);f.disposer();
 const g=fixture();g.mount(createSameOriginalRecoveryController());g.disabled();g.hidden();
 await g.click('Review',true);await g.click('Confirm',true);await g.click('Status',true);assert.equal(g.calls.length,0);g.disposer();
});
test('changed controller principal at awaited reply cannot render cached original or enable confirm',async()=>{
 const f=fixture(),entered=deferred(),reply=deferred();f.mount();f.root.node('Challenge').value=id(9);
 f.requestHook=async()=>{entered.resolve();await reply.promise;return f.p;};const work=f.click('Review');await entered.promise;
 f.owner=null;reply.resolve();await work;assert.equal(f.root.node('Summary').textContent,'');assert(f.root.node('Confirm').disabled);
 assert.equal(f.approvals().length,0);f.disposer();
});
test('exact entered challenge is never normalized; changing selection after review requires another review',async()=>{
 const f=fixture();f.mount();for(const value of [' '+id(9),id(9)+'\n','<img src=x onerror=alert(1)>']){
  f.root.node('Challenge').value=value;await f.click('Review');assert.equal(f.calls.length,0);
  assert.equal(f.root.node('Summary').textContent,'');assert.match(f.root.node('Message').textContent,/exact canonical original challenge UUID/);
 }
 await f.review();f.root.node('Challenge').value=id(99);await f.root.node('Challenge').emit('input');
 assert(f.root.node('Confirm').disabled);await f.click('Confirm',true);assert.equal(f.approvals().length,0);f.disposer();
});
test('page loss before event has zero controller effects, including forced stale button clicks',async()=>{
 const f=fixture();f.mount();await f.review();f.owns=false;await f.click('Confirm',true);
 f.disabled();f.hidden();assert.equal(f.saved,null);assert.equal(f.approvals().length,0);f.disposer();
});
test('malicious transport error is not rendered; dispose is idempotent and removes all callbacks',async()=>{
 const f=fixture();f.mount();f.requestHook=()=>{throw new Error('<script>private-error-token</script>');};await f.review();
 assert.equal(f.root.node('Message').textContent.includes('private-error-token'),false);assert.equal(f.root.node('Summary').textContent,'');
 f.disposer();f.disposer();assert.equal(f.root.countAllListeners(),0);assert.equal(f.approvals().length,0);
});
