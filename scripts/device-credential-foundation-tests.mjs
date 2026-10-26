import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash, webcrypto } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.resolve(root, name), 'utf8');
if(process.argv.includes('--credential-initialization-fence-only')){
  const {createCustodialCredentialStore,CUSTODIAL_CREDENTIAL_KEY}=await import('../mobile/src/custodial/credential-store.js');
  const {createProtectedBrowserAdmission,PROTECTED_BROWSER_HOLD_KEY,PROTECTED_BROWSER_MUTATION_KEY}=await import('../mobile/src/custodial/protected-browser-admission.js');
  const {createSyntheticScheduleLocks}=await import('./synthetic-schedule-locks.mjs');
  const selected=process.argv.find(v=>v.startsWith('--initialization-case='))?.slice('--initialization-case='.length);
  let ran=0;
  for(const mode of ['held-initialization','held-legacy-purge','hold-during-inspection','unheld-single-owner']){
    if(selected&&selected!==mode)continue;
    const rows=new Map([[CUSTODIAL_CREDENTIAL_KEY,'exact retained legacy plaintext original']]),writes=[],secureCalls=[];
    if(mode.startsWith('held'))rows.set(PROTECTED_BROWSER_HOLD_KEY,'existing original preservation hold');
    const storage={getItem:k=>rows.get(k)??null,setItem(k,v){writes.push(['set',k,v]);rows.set(k,String(v));},
      removeItem(k){writes.push(['remove',k]);rows.delete(k);},key:i=>[...rows.keys()][i]??null,get length(){return rows.size;}};
    const indexedDb={async databases(){
      await Promise.resolve();
      if(mode==='hold-during-inspection')rows.set(PROTECTED_BROWSER_HOLD_KEY,'foreign hold during awaited inspection');
      return [];
    },open(){assert.fail('empty declared fixture must not create a database');}};
    const gate=createProtectedBrowserAdmission({storage,sessionStorage:{...storage,getItem:()=>null,length:0},indexedDb,
      locks:createSyntheticScheduleLocks(),cryptoApi:webcrypto});
    let admissions=0;
    const store=createCustodialCredentialStore({storage,indexedDb,cryptoApi:webcrypto,
      secureStorage:{async get(k){secureCalls.push(['get',k]);return null;},async set(){assert.fail('no new secure record');},async remove(){assert.fail('no secure removal');}},
      protectedWorkAdmission:operation=>{admissions++;return gate.mutate(operation);},protectedWorkCheckpoint:()=>gate.requireAdmission()});
    if(mode.startsWith('held')||mode==='hold-during-inspection'){
      let refused=false;
      try{await (mode==='held-legacy-purge'?store.purgeLegacyPlaintextCredential():store.ensureSecurityState());}
      catch{refused=true;}
      assert.equal(rows.get(CUSTODIAL_CREDENTIAL_KEY),'exact retained legacy plaintext original','held startup/purge must not remove the original through its raw adapter');
      assert.equal(refused,true);assert.equal(writes.filter(row=>row[1]!==PROTECTED_BROWSER_MUTATION_KEY).length,0);assert.equal(secureCalls.length,0);
      if(mode==='hold-during-inspection')assert.equal(writes.length,1,'only the original pre-admission attempted-write epoch is retained');
      else assert.equal(writes.length,0);
      assert.equal(admissions,1);
    }else{
      await store.ensureSecurityState();assert.equal(rows.has(CUSTODIAL_CREDENTIAL_KEY),false);
      let callbacks=0;
      await store.runWhenReady(async context=>{callbacks++;gate.requireMutation();context.assertCurrent();});
      assert.equal(callbacks,1);assert.equal(admissions,2,'one shared owner per queued operation, no nested lock');
    }
    ran++;console.log('PASS_NEW_CREDENTIAL_INITIALIZATION_FENCE '+mode);
  }
  assert(ran>0);console.log('ACTUAL_CREDENTIAL_AND_BROWSER_GATE; SYNTHETIC_STORAGE_SECURESTORE_LOCKS; NO_NATIVE_ACK_OR_PHONE_PROOF');process.exit(0);
}
if (process.argv.includes('--same-original-page-caller-only')) {
  // Shipping inline caller + actual delivered modules and ESM admission/firewall.
  // Recording DOM/session/Storage/fetch/Web Locks: SOURCE MODEL, not live auth,
  // browser/native readiness, SQL, phone, or a production preparation grant.
  const main=process.env.DEVICE_SECURITY_CALLER_SOURCE_ROOT||'/home/eric/Documents/Codex/2026-09-13/i-x20/work/autonomous-repair-20260923/overnight-readiness-20261006/lean-held-correction-integration-20261011';
  const counterCases=process.env.DEVICE_SECURITY_CALLER_CASE?.startsWith('MANAGER_COUNTER_JOIN_NEW ');
  const counterRoot='/home/eric/Documents/Codex/2026-10-09/task-8/browser-writer-generation-20261014-v1/frontend';
  const wirePath=process.env.DEVICE_SECURITY_CALLER_WIRE_PATH||path.join(main,'backend/src/same-original-recovery-wire.js');
  for(const [name,sha] of [
    ['frontend/same-original-recovery-client.js','4258f569d9417a6b3a4b0e1153b753409ee2b387499c5dcd4bf9491a187270dc'],
    ['frontend/same-original-recovery-panel.js','f1c9d26178ad9272fc767fbaa32d00fcf80c8f560b2bfcf61edc45d597fca3cf'],
    ['frontend/same-original-recovery-original-store.js','75e256a0a8f8e50f301b1523d06555647a80ae0d51ed9af7ba82b4493ff3a6bb'],
    ['frontend/same-original-recovery-page.js','92dbf9570bab05eb7d7033dda0742e5459541df0ce977198275b482c95139520'],
    ['frontend/mobile/src/custodial/storage-firewall.js','59b9f10e7b0b2222ecc687f577e96520e3cb1bc10ed9249101756f328f02715f'],
    ['frontend/mobile/src/custodial/protected-browser-admission.js','ebfbbf615880151f4a620f814e1d07ff4bbe6186c1ad3161a81fedd946ce45df']
  ]){
    const leaf=name.replace(/^frontend\//,'');
    const replacement=counterCases&&leaf==='mobile/src/custodial/storage-firewall.js'?'e9045a5f3323d2756cc1c36f3662b578b3413a3994d4292045d42b505ff9635b'
      :counterCases&&leaf==='mobile/src/custodial/protected-browser-admission.js'?'22c1f3423b54c50006003c1bb9a10c77167f3cf76341e738792ae47358e91723':null;
    assert.equal(createHash('sha256').update(fs.readFileSync(replacement?path.join(counterRoot,leaf):path.join(main,name))).digest('hex'),replacement||sha,name);
  }
  assert.equal(createHash('sha256').update(fs.readFileSync(wirePath)).digest('hex'),'bc99757cce04e17ac0010169047498d35e71308dad2412aee2e885292bad62e7','exact newly admitted wire fixture dependency');
  const wire=await import(wirePath);
  const firewall=await import(path.join(counterCases?counterRoot:path.join(main,'frontend'),'mobile/src/custodial/storage-firewall.js'));
  const HOLD='mz_custodial_protected_browser_hold.v1';
  const id=n=>'98000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const issuer={manager_id:id(1),manager_credential_id:id(2),manager_device_id:'recording-page-owner'};
  const stem='mz_same_original_recovery_original.v1:'+issuer.manager_id+':'+issuer.manager_credential_id+':'+issuer.manager_device_id;
  const html=process.env.DEVICE_SECURITY_CALLER_HTML?fs.readFileSync(process.env.DEVICE_SECURITY_CALLER_HTML,'utf8'):read('device-security.html');
  const genericRequestCases=process.env.DEVICE_SECURITY_CALLER_CASE?.startsWith('GENERIC_REQUEST_NEW ');
  let originalInline=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  if(counterCases)for(const leaf of ['storage-firewall.js','protected-browser-admission.js']){
    const specifier="'./mobile/src/custodial/"+leaf+"'";
    assert.equal(originalInline.split(specifier).length,2);
    // Fixture import relocation only: execute the same actual shipping inline
    // caller with the exact sealed, UNMERGED writer candidate. Not a new owner
    // API, copied caller or native/browser/platform proof.
    originalInline=originalInline.replace(specifier,JSON.stringify('file://'+path.join(counterRoot,'mobile/src/custodial',leaf)));
  }
  const entry="    try{const session=await window.MemphisAuth.requireOpsManagerSession({accessLevel:'full_access',interactive:true";
  if(genericRequestCases)assert.equal(originalInline.split(entry).length,2,'one actual startup boundary');
  // Existing VM fixture exposes lexical shipping functions only in this
  // explicit new mode; no duplicate implementation or auth capability.
  const inline=genericRequestCases?originalInline.replace(entry,
    "    globalThis.fixtureDeviceSecurityCaller={request,generateCode,current:()=>currentSecurityAdmin(actionGeneration,managerSession)};\n"+entry):originalInline;
  const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
  class Node{
    constructor(){this.listeners=new Map();this.value='';this.disabled=false;this.hidden=false;this.textContent='';this.innerHTML='';this.className='';const classes=new Set();this.classList={add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)};}
    addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
    removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
    querySelectorAll(){return [];}
    scrollIntoView(){}
    async emit(type='click',force=false){if(this.disabled&&!force)return;await Promise.all([...this.listeners.get(type)||[]].map(fn=>fn({preventDefault(){}})));}
  }
  function review(){const p={schema:'custodial.same-original-recovery-review.v1',state:'ORIGINAL_BINDING_REVIEW_ONLY',purpose:'AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION',challenge_id:id(9),challenge_sha256:'a'.repeat(64),preview_sha256:'b'.repeat(64),expires_at:'2026-10-14T00:05:00.000000Z',limits:{inventory_acknowledged:false,work_accepted:false,replay_allowed:false,finalizer_allowed:false,key_removal:false,phone_released:false},original_target:{operation_id:id(11),separation_id:id(12),separation_authority_revision:'7',canonical_device_pk:id(13),canonical_device_id:'KIOSK_08',employee_id:id(14),credential_id:id(15),assignment_epoch:'7',original_generation_id:id(16),original_credential_secret_key_id:'a'.repeat(64),principal_digest:'a'.repeat(64),engine_revision:'0',original_wire_sha256:'a'.repeat(64),original_frozen_work_sha256:'a'.repeat(64),capsule_sha256:'a'.repeat(64),record_sha256:'a'.repeat(64),frame_sha256:'a'.repeat(64),plan_sha256:'a'.repeat(64),aad_binding_sha256:'a'.repeat(64),source_capture_sha256:'a'.repeat(64),values_sha256:'a'.repeat(64),semantic_join_sha256:'a'.repeat(64),layout_sha256:'a'.repeat(64)}};p.preview_sha256=wire.recoveryDocumentSha256('preview',p);return p;}
  function receipt(original,p){const r={schema:'custodial.same-original-recovery-approval-receipt.v1',state:'APPROVAL_RECORDED_ONLY',approval_id:id(10),original_request:original,original_request_sha256:wire.recoveryDocumentSha256('request',original),issuer:{...issuer},challenge_sha256:p.challenge_sha256,preview_sha256:p.preview_sha256,original_target:p.original_target,purpose_admission_id:'same-original-preparation.v1',issued_at:'2026-10-14T00:00:00.000000Z',expires_at:p.expires_at,receipt_sha256:'a'.repeat(64),retry_safe:false,limits:p.limits};r.receipt_sha256=wire.recoveryDocumentSha256('receipt',r);return r;}
  async function fixture(options={}){
    const f={calls:[],writes:[],floorCalls:0,headers:0,active:0,locks:[],timers:new Map(),p:review(),fetchHook:null,headerHook:null,floorHook:null,lockHook:null,readHook:null,setHook:null,receipt:null};
    const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Node()]));f.node=n=>nodes.get(n);f.replaceRoot=()=>nodes.set('app',new Node());
    f.node('app').classList.add('hidden');for(const n of ['Challenge','Review','Confirm','Status'])f.node('sameOriginal'+n).disabled=true;
    assert.match(html,/<pre id="sameOriginalSummary"[^>]*\bhidden/);f.node('sameOriginalSummary').hidden=true;
    const app=f.node('app');app.querySelector=selector=>nodes.get(selector.slice(1));
    class Storage{
      constructor(){this.rows=new Map();}
      getItem(key){if(f.readHook)f.readHook(key);return this.rows.has(key)?this.rows.get(key):null;}
      setItem(key,value){if(f.setHook)f.setHook(key,value);f.writes.push([key,value,f.active]);this.rows.set(key,value);}
      removeItem(){assert.fail('Caller cannot delete original records');}
      clear(){assert.fail('Caller cannot clear protected records');}
      key(i){return [...this.rows.keys()][i]??null;}
      get length(){return this.rows.size;}
    }
    f.storage=new Storage();if(counterCases)f.storage.rows.set('mz_custodial_protected_browser_writer_generation.v1',options.counter??'2');if(options.hold)f.storage.rows.set(HOLD,'recording durable hold');
    if(options.saved){const original={schema:'custodial.same-original-recovery-approval-request.v1',request_id:id(3),challenge_id:f.p.challenge_id,expected_challenge_sha256:f.p.challenge_sha256,expected_preview_sha256:f.p.preview_sha256,expected_manager_id:issuer.manager_id,expected_manager_credential_id:issuer.manager_credential_id,expected_manager_device_id:issuer.manager_device_id,decision:f.p.purpose,manager_confirmation:'CONFIRM_THIS_SAME_ORIGINAL_ONLY'};
      const raw=JSON.stringify(original),marker=JSON.stringify({schema:'custodial.same-original-recovery-original-intent.v1',original_request_utf8:raw,original_request_utf8_sha256:createHash('sha256').update(raw).digest('hex')});f.storage.rows.set(stem+':intent',marker);if(options.saved!=='marker')f.storage.rows.set(stem+':original',raw);f.receipt=receipt(original,f.p);}
    if(options.guarded)firewall.installCustodialStorageFirewall({storage:f.storage,getSecurityStatus:()=>({initialized:false,ready:false})});
    let tail=Promise.resolve();const locks={request(name,opts,callback){const run=tail.then(async()=>{if(f.lockHook)await f.lockHook();if(opts.signal.aborted)throw new Error('Recording admission cancelled');f.locks.push(name);assert.equal(f.active,0);f.active++;try{return await callback({name,mode:opts.mode});}finally{f.active--;}});tail=run.catch(()=>{});return run;}};
    const context=vm.createContext({console,TextEncoder,Uint8Array,AbortController,performance,crypto:webcrypto,Storage,localStorage:f.storage,navigator:{locks:options.noLocks?undefined:locks,clipboard:{writeText:async()=>{}}},document:{getElementById:n=>nodes.get(n)},location:{reload(){}},confirm:()=>true,
      setTimeout(fn,ms){const handle=setTimeout(fn,ms);handle.unref();f.timers.set(handle,{fn,ms});return handle;},clearTimeout(handle){clearTimeout(handle);f.timers.delete(handle);}});f.context=context;
    const realm=value=>vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(value))+')',context);f.realm=realm;
    context.fixtureSession=realm({role:'ops_manager',manager_id:issuer.manager_id,credential_id:issuer.manager_credential_id,device_id:issuer.manager_device_id,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true},access_level:'full_access',read_only:false,trusted_device:true,roles:['SECURITY_ADMIN'],expires_at:new Date(Date.now()+300000).toISOString()});
    if(options.limited)context.fixtureSession.read_only=true;
    if(options.ownerChange)options.ownerChange(context.fixtureSession);
    context.MemphisAuth={readSession:()=>context.fixtureSession,hasRole:(role,s)=>s?.roles?.includes(role)===true,requireOpsManagerSession:async()=>context.fixtureSession,
      getDeviceId:()=>f.browserDevice??issuer.manager_device_id,
      deviceSecuritySession:async()=>{f.floorCalls++;if(options.initialFloorDrift&&f.floorCalls===1)context.fixtureSession.device_id='successor-before-mount';if(f.floorHook)await f.floorHook();return{unlocked:true,configured:true,manager_id:f.foreignFloor?id(98):issuer.manager_id,expires_at:new Date(Date.now()+(options.expiredFirstFloor&&f.floorCalls===1?-1000:300000)).toISOString()};},
      deviceSecurityAuthHeaders:async()=>{f.headers++;if(f.headerHook)await f.headerHook();return{};},unlockDeviceSecurity:async()=>{},lockDeviceSecurity:async()=>{}};
    context.fetch=async(url,init)=>{const call={url,init,rows:[...f.storage.rows],active:f.active,listeners:f.node('sameOriginalReview').listeners.get('click')?.size||0};f.calls.push(call);assert.equal(f.active,0,'HTTP must not hold protected lock');if(f.fetchHook)return f.fetchHook(call);
      let data={policy:{},coverage:{devices:[]}};if(url.includes('/same-original-recovery/challenges/'))data=f.p;
      if(url.endsWith('/same-original-recovery/approvals')){assert(f.storage.rows.has(stem+':original'),'original must be persisted before POST');const original=JSON.parse(init.body);assert.equal(f.storage.rows.get(stem+':original'),init.body);f.receipt=receipt(original,f.p);data=f.receipt;}
      if(url.endsWith('/approvals/original-status'))data=f.receipt||{state:'UNKNOWN'};
      return{ok:true,status:200,json:async()=>realm({ok:true,data})};};
    const events=new Node();context.addEventListener=events.addEventListener.bind(events);context.removeEventListener=events.removeEventListener.bind(events);f.pagehide=()=>events.emit('pagehide');
    vm.runInContext('window=globalThis',context);
    for(const name of ['client','panel','original-store','page'])vm.runInContext(fs.readFileSync(path.join(main,'frontend/same-original-recovery-'+name+'.js'),'utf8'),context,{filename:name+'.js'});
    const script=new vm.Script(inline,{filename:path.join(main,'frontend/device-security.html'),importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER});
    f.ready=script.runInContext(context);f.close=async()=>{await f.pagehide();for(const h of f.timers.keys())clearTimeout(h);f.timers.clear();};
    f.posts=()=>f.calls.filter(c=>c.url.endsWith('/same-original-recovery/approvals'));
    f.statuses=()=>f.calls.filter(c=>c.url.endsWith('/approvals/original-status'));
    f.review=async()=>{f.node('sameOriginalChallenge').value=id(9);await f.node('sameOriginalReview').emit();};
    return f;
  }
  const cases=[];const check=(name,body)=>cases.push([name,body]);
  const withdrawn=f=>{for(const n of ['Challenge','Review','Confirm','Status'])assert(f.node('sameOriginal'+n).disabled,n);assert(f.node('sameOriginalSummary').hidden);assert.equal(f.node('sameOriginalSummary').textContent,'');};
  check('actual absent hydration is IDLE, public native firewall remains closed',async()=>{const f=await fixture();try{await f.ready;assert.equal(f.node('sameOriginalReview').disabled,false);assert.equal(f.statuses().length,0);assert.equal(f.writes.length,0);assert.throws(()=>f.storage.setItem(stem+':original','foreign'),/Protected/);assert.throws(()=>f.storage.setItem('mz_scan_completion_draft:foreign','x'),/Protected/);}finally{await f.close();}});
  check('actual one-confirm persists intent and exact body under global admission before POST',async()=>{const f=await fixture();try{await f.ready;await f.review();assert.equal(f.node('sameOriginalConfirm').disabled,false);await f.node('sameOriginalConfirm').emit();assert.equal(f.posts().length,1);assert.equal(f.writes.length,2);assert(f.writes.every(w=>w[2]===1));assert.deepEqual(f.locks,['memphis-custodial-protected-browser-work.v1']);assert.match(f.node('sameOriginalMessage').textContent,/Preparation recorded ONLY/);await f.node('sameOriginalConfirm').emit('click',true);assert.equal(f.posts().length,1);}finally{await f.close();}});
  check('saved and marker-only originals read status before listeners, never write or POST',async()=>{for(const saved of ['full','marker']){const f=await fixture({saved});try{const before=[...f.storage.rows];await f.ready;assert.equal(f.statuses().length,1);assert.equal(f.statuses()[0].listeners,0);assert.equal(f.posts().length,0);assert.equal(f.writes.length,0);assert.deepEqual([...f.storage.rows],before);assert(f.node('sameOriginalReview').disabled);assert.match(f.node('sameOriginalMessage').textContent,/recorded ONLY/);}finally{await f.close();}}});
  check('durable current hold blocks new intent without thaw or HTTP',async()=>{const f=await fixture({hold:true});try{await f.ready;await f.review();await f.node('sameOriginalConfirm').emit();assert.equal(f.writes.length,0);assert.equal(f.posts().length,0);assert.equal(f.storage.rows.get(HOLD),'recording durable hold');}finally{await f.close();}});
  check('missing Web Locks/already installed firewall/limited owner fail closed',async()=>{for(const option of ['noLocks','guarded','limited']){const f=await fixture({[option]:true});try{await f.ready;withdrawn(f);assert.equal(f.posts().length,0);assert.equal(f.writes.length,0);}finally{await f.close();}}});
  check('owner permission or device drift during headers cannot dispatch review',async()=>{for(const field of ['device','permission']){const f=await fixture();try{await f.ready;const entered=defer(),reply=defer();f.headerHook=async()=>{entered.resolve();await reply.promise;};const job=f.review();await entered.promise;if(field==='device')f.context.fixtureSession.device_id='successor-device';else f.context.fixtureSession.permissions.owner=false;reply.resolve();await job;assert.equal(f.calls.filter(c=>c.url.includes('/same-original-recovery/')).length,0);assert.equal(f.writes.length,0);withdrawn(f);}finally{await f.close();}}});
  check('owner loss during password-floor await cannot persist intent',async()=>{const f=await fixture();try{await f.ready;await f.review();const entered=defer(),reply=defer();f.floorHook=async()=>{entered.resolve();await reply.promise;};const job=f.node('sameOriginalConfirm').emit();await entered.promise;f.context.fixtureSession=f.realm({...f.context.fixtureSession,device_id:'successor'});reply.resolve();await job;assert.equal(f.writes.length,0);assert.equal(f.posts().length,0);withdrawn(f);}finally{await f.close();}});
  check('lock during original POST synchronously retires panel and preserves exact rows',async()=>{const f=await fixture();try{await f.ready;await f.review();const entered=defer(),reply=defer();f.fetchHook=async call=>{assert(call.url.endsWith('/same-original-recovery/approvals'));entered.resolve();return reply.promise;};const job=f.node('sameOriginalConfirm').emit();await entered.promise;const rows=[...f.storage.rows];assert.equal(f.posts().length,1);const lock=f.node('lock').emit();withdrawn(f);assert(f.posts()[0].init.signal.aborted);const message=f.node('sameOriginalMessage').textContent;reply.resolve({ok:true,status:200,json:async()=>f.realm({ok:true,data:receipt(JSON.parse(f.posts()[0].init.body),f.p)})});await job;await lock;assert.equal(f.node('sameOriginalMessage').textContent,message);assert.deepEqual([...f.storage.rows],rows);}finally{await f.close();}});
  check('device drift across JSON await refuses late repaint and leaves original',async()=>{const f=await fixture();try{await f.ready;await f.review();const entered=defer(),reply=defer();f.fetchHook=async call=>({ok:true,status:200,json:async()=>{entered.resolve();await reply.promise;return f.realm({ok:true,data:receipt(JSON.parse(call.init.body),f.p)});}});const job=f.node('sameOriginalConfirm').emit();await entered.promise;const rows=[...f.storage.rows];f.context.fixtureSession.device_id='successor';reply.resolve();await job;withdrawn(f);assert.deepEqual([...f.storage.rows],rows);assert.equal(f.posts().length,1);}finally{await f.close();}});
  check('uncertain response retains original and enables only fixed original status',async()=>{const f=await fixture();try{await f.ready;await f.review();f.fetchHook=async()=>{throw new Error('recording lost reply');};await f.node('sameOriginalConfirm').emit();const rows=[...f.storage.rows];assert.equal(f.posts().length,1);assert.match(f.node('sameOriginalMessage').textContent,/Outcome unknown/);assert(f.node('sameOriginalConfirm').disabled);assert.equal(f.node('sameOriginalStatus').disabled,false);f.fetchHook=null;await f.node('sameOriginalStatus').emit();assert.equal(f.statuses().length,1);assert.equal(f.statuses()[0].init.body,f.posts()[0].init.body);assert.equal(f.posts().length,1);assert.deepEqual([...f.storage.rows],rows);}finally{await f.close();}});
  check('same page disposal during hydration retains marker and installs no listeners',async()=>{const f=await fixture({saved:'marker'});try{const entered=defer(),reply=defer();f.fetchHook=async()=>{entered.resolve();return reply.promise;};await entered.promise;const rows=[...f.storage.rows];await f.pagehide();withdrawn(f);reply.resolve({ok:true,status:200,json:async()=>f.realm({ok:true,data:f.receipt})});await f.ready;withdrawn(f);assert.equal(f.node('sameOriginalReview').listeners.get('click')?.size||0,0);assert.deepEqual([...f.storage.rows],rows);}finally{await f.close();}});
  check('first observed password projection is never renewed by later rolling reads',async()=>{const f=await fixture({expiredFirstFloor:true});try{await f.ready;assert(f.floorCalls>=2);withdrawn(f);assert.equal(f.writes.length,0);assert.equal(f.posts().length,0);}finally{await f.close();}});
  check('repeated current unlock cannot remount or replace retained original',async()=>{const f=await fixture();try{await f.ready;await f.review();f.fetchHook=async()=>{throw new Error('recording lost reply');};await f.node('sameOriginalConfirm').emit();f.fetchHook=null;const rows=[...f.storage.rows],listeners=f.node('sameOriginalReview').listeners.get('click').size;await f.node('unlock').emit();await f.node('unlock').emit();assert.deepEqual([...f.storage.rows],rows);assert.equal(f.node('sameOriginalReview').listeners.get('click').size,listeners);assert.equal(f.posts().length,1);assert.equal(f.statuses().length,0);assert.match(f.node('sameOriginalMessage').textContent,/Outcome unknown/);}finally{await f.close();}});
  check('one absolute timeout across admission headers preserves original and forbids late POST',async()=>{const f=await fixture();try{await f.ready;await f.review();const entered=defer(),reply=defer();f.headerHook=async()=>{entered.resolve();await reply.promise;};const job=f.node('sameOriginalConfirm').emit();await entered.promise;assert(f.storage.rows.has(stem+':original'));const rows=[...f.storage.rows],timers=[...f.timers.values()].filter(t=>t.ms===30000);assert.equal(timers.length,1,'one original request deadline, never a per-await renewal');timers[0].fn();await job;assert.match(f.node('sameOriginalMessage').textContent,/Outcome unknown/);assert.equal(f.posts().length,0);assert.equal(f.node('sameOriginalStatus').disabled,false);reply.resolve();await new Promise(r=>setImmediate(r));assert.equal(f.posts().length,0);assert.deepEqual([...f.storage.rows],rows);}finally{await f.close();}});
  check('hold or owner change between synchronous marker/final writes preserves only marker',async()=>{for(const change of ['hold','owner']){const f=await fixture();try{await f.ready;await f.review();f.setHook=key=>{if(key===stem+':intent'){if(change==='hold')f.storage.rows.set(HOLD,'recording foreign hold');else f.context.fixtureSession.credential_id=id(99);}};await f.node('sameOriginalConfirm').emit();assert(f.storage.rows.has(stem+':intent'));assert(!f.storage.rows.has(stem+':original'));assert.equal(f.posts().length,0);assert.equal(f.writes.length,1);if(change==='hold')assert.equal(f.storage.rows.get(HOLD),'recording foreign hold');else withdrawn(f);}finally{await f.close();}}});
  check('full-owner floor cannot be manufactured by Security Admin role or defaults',async()=>{for(const ownerChange of [s=>{s.trusted_device=false;},s=>{s.permissions.owner=false;},s=>{s.permissions.schema='legacy';},s=>{s.access_level='read_only';},s=>{delete s.read_only;},s=>{s.role='system';}]){const f=await fixture({ownerChange});try{await f.ready;withdrawn(f);assert.equal(f.writes.length,0);assert.equal(f.posts().length,0);}finally{await f.close();}}});
  check('read response owner drift never repaints original review',async()=>{const f=await fixture();try{await f.ready;const entered=defer(),reply=defer();f.fetchHook=async()=>{entered.resolve();return reply.promise;};const job=f.review();await entered.promise;f.context.fixtureSession.expires_at=new Date(Date.now()+400000).toISOString();reply.resolve({ok:true,status:200,json:async()=>f.realm({ok:true,data:f.p})});await job;withdrawn(f);assert.equal(f.writes.length,0);}finally{await f.close();}});
  check('expired original budget cannot write after later global lock acquisition',async()=>{const f=await fixture();try{await f.ready;await f.review();const entered=defer(),reply=defer();f.lockHook=async()=>{entered.resolve();await reply.promise;};const job=f.node('sameOriginalConfirm').emit();await entered.promise;const timers=[...f.timers.values()].filter(t=>t.ms===30000);assert.equal(timers.length,1);timers[0].fn();reply.resolve();await job;assert.equal(f.writes.length,0);assert.equal(f.posts().length,0);assert.match(f.node('sameOriginalMessage').textContent,/Outcome unknown/);}finally{await f.close();}});
  check('initial password-session await cannot adopt a mutated named session before mount',async()=>{const f=await fixture({initialFloorDrift:true});try{await f.ready;withdrawn(f);assert.equal(f.writes.length,0);assert.equal(f.posts().length,0);assert.equal(f.calls.length,0);}finally{await f.close();}});
  check('a later foreign password-floor response cannot authorize original persistence',async()=>{const f=await fixture();try{await f.ready;await f.review();f.foreignFloor=true;await f.node('sameOriginalConfirm').emit();withdrawn(f);assert.equal(f.writes.length,0);assert.equal(f.posts().length,0);}finally{await f.close();}});
  check('root reuse during an original reply cannot repaint or erase protected original',async()=>{const f=await fixture();try{await f.ready;await f.review();const entered=defer(),reply=defer();f.fetchHook=async()=>{entered.resolve();return reply.promise;};const job=f.node('sameOriginalConfirm').emit();await entered.promise;const rows=[...f.storage.rows];f.replaceRoot();reply.resolve({ok:true,status:200,json:async()=>f.realm({ok:true,data:receipt(JSON.parse(f.posts()[0].init.body),f.p)})});await job;withdrawn(f);assert.deepEqual([...f.storage.rows],rows);assert.equal(f.posts().length,1);}finally{await f.close();}});
  check('initially observed hold cannot disappear into new-intent permission',async()=>{const f=await fixture({hold:true});try{await f.ready;f.storage.rows.delete(HOLD);await f.review();await f.node('sameOriginalConfirm').emit();assert.equal(f.writes.length,0);assert.equal(f.posts().length,0);assert.match(f.node('sameOriginalMessage').textContent,/Outcome unknown/);}finally{await f.close();}});
  if(counterCases){
    check('MANAGER_COUNTER_JOIN_NEW exact private primary admits original once and keeps public firewall closed',async()=>{
      const f=await fixture();try{
        await f.ready;await f.review();await f.node('sameOriginalConfirm').emit();
        assert.equal(f.posts().length,1,'actual manager inline caller must use original raw admission owner, not restricted wrapper');
        const originalWrites=f.writes.filter(w=>w[0]===stem+':intent'||w[0]===stem+':original');
        assert.equal(originalWrites.length,2);assert(originalWrites.every(w=>w[2]===1));
        assert.equal(f.storage.rows.get(stem+':original'),f.posts()[0].init.body);
        assert(Number(f.storage.rows.get('mz_custodial_protected_browser_writer_generation.v1'))>2);
        assert.throws(()=>f.storage.setItem(stem+':original','foreign'),/Protected/);
        await f.node('sameOriginalConfirm').emit('click',true);assert.equal(f.posts().length,1);
      }finally{await f.close();}
    });
    check('MANAGER_COUNTER_JOIN_NEW original hold and pending counter cannot write or post',async()=>{
      for(const options of [{hold:true},{counter:'3'}]){
        const f=await fixture(options);try{
          const before=[...f.storage.rows];await f.ready;await f.review();await f.node('sameOriginalConfirm').emit();
          assert.equal(f.posts().length,0);assert.equal(f.writes.length,0);assert.deepEqual([...f.storage.rows],before);
        }finally{await f.close();}
      }
    });
    check('MANAGER_COUNTER_JOIN_NEW current owner withdrawal before private admission retains metadata',async()=>{
      const f=await fixture();try{
        await f.ready;await f.review();const before=[...f.storage.rows],entered=defer(),reply=defer();
        f.floorHook=async()=>{entered.resolve();await reply.promise;};
        const job=f.node('sameOriginalConfirm').emit();await entered.promise;
        f.context.fixtureSession.permissions.owner=false;reply.resolve();await job;
        assert.equal(f.writes.length,0);assert.equal(f.posts().length,0);assert.deepEqual([...f.storage.rows],before);withdrawn(f);
      }finally{await f.close();}
    });
  }
  if(genericRequestCases){
    check('GENERIC_REQUEST_NEW header drift must not dispatch enrollment action',async()=>{
      const f=await fixture({saved:'marker'});try{
        await f.ready;const before=[...f.storage.rows],entered=defer(),reply=defer();
        f.headerHook=async()=>{entered.resolve();await reply.promise;};
        const job=vm.runInContext("fixtureDeviceSecurityCaller.generateCode('KIOSK_08')",f.context);
        await entered.promise;f.context.fixtureSession.credential_id=id(99);reply.resolve();await job;
        assert.equal(f.calls.filter(c=>c.url.endsWith('/enrollment-code')).length,0,'original action must not dispatch under changed credential');
        assert.deepEqual([...f.storage.rows],before);assert.equal(f.node('code').textContent,'');withdrawn(f);
      }finally{await f.close();}
    });
    const codeData={canonical_device_id:'KIOSK_08',employee_name:'SYNTHETIC fixture only',
      enrollment_code:'12345678',code_id:id(88),expires_at:'2030-01-01T00:00:00.000Z'};
    check('GENERIC_REQUEST_NEW followup header device scope browser and replacement drift cannot dispatch',async()=>{
      for(const change of [
        f=>{f.context.fixtureSession.device_id='successor';},
        f=>{f.context.fixtureSession.permissions.owner=false;},
        f=>{f.context.fixtureSession.read_only=true;f.context.fixtureSession.access_level='read_only';},
        f=>{f.browserDevice='successor-browser';},
        f=>{f.context.fixtureSession=f.realm({...f.context.fixtureSession,credential_id:id(98)});},
      ]){const f=await fixture({saved:'marker'});try{
        await f.ready;const rows=[...f.storage.rows],entered=defer(),reply=defer();
        f.headerHook=async()=>{entered.resolve();await reply.promise;};
        const job=vm.runInContext("fixtureDeviceSecurityCaller.generateCode('KIOSK_08')",f.context);
        await entered.promise;change(f);reply.resolve();await job;
        assert.equal(f.calls.filter(c=>c.url.endsWith('/enrollment-code')).length,0);
        assert.equal(f.node('code').textContent,'');withdrawn(f);assert.deepEqual([...f.storage.rows],rows);
      }finally{await f.close();}}
    });
    check('GENERIC_REQUEST_NEW followup fetch and JSON drift refuse code adoption and second floor',async()=>{
      for(const phase of ['fetch','json']){
        const f=await fixture({saved:'marker'});try{
          await f.ready;const rows=[...f.storage.rows],entered=defer(),reply=defer(),floors=f.floorCalls;
          f.fetchHook=async()=>phase==='fetch'?(entered.resolve(),await reply.promise):
            {ok:true,status:200,json:async()=>{entered.resolve();await reply.promise;return f.realm({ok:true,data:codeData});}};
          const job=vm.runInContext("fixtureDeviceSecurityCaller.generateCode('KIOSK_08')",f.context);
          await entered.promise;f.context.fixtureSession.credential_id=id(99);
          reply.resolve({ok:true,status:200,json:async()=>f.realm({ok:true,data:codeData})});await job;
          assert.equal(f.calls.filter(c=>c.url.endsWith('/enrollment-code')).length,1);
          assert.equal(f.floorCalls,floors,'stale response must not enter a new password check');
          assert.equal(f.node('code').textContent,'');assert(!f.node('code-box').classList.contains('show'));
          assert(f.node('app').classList.contains('hidden'));withdrawn(f);assert.deepEqual([...f.storage.rows],rows);
        }finally{await f.close();}
      }
    });
    check('GENERIC_REQUEST_NEW followup direct original summary cannot return data after browser drift',async()=>{
      const f=await fixture({saved:'marker'});try{
        await f.ready;const rows=[...f.storage.rows],entered=defer(),reply=defer();
        f.fetchHook=async()=>{entered.resolve();return reply.promise;};
        const job=vm.runInContext("fixtureDeviceSecurityCaller.request('/summary')",f.context);
        const refused=assert.rejects(job,/owner is no longer current/);
        await entered.promise;f.browserDevice='successor-browser';
        reply.resolve({ok:true,status:200,json:async()=>f.realm({ok:true,data:{policy:{mode:'enforce'}}})});
        await refused;withdrawn(f);assert.deepEqual([...f.storage.rows],rows);
      }finally{await f.close();}
    });
    check('GENERIC_REQUEST_NEW followup changed owner on rejected headers or fetch withdraws without stale error',async()=>{
      for(const phase of ['headers','fetch']){
        const f=await fixture({saved:'marker'});try{
          await f.ready;const rows=[...f.storage.rows],entered=defer(),reply=defer();
          const hook=async()=>{entered.resolve();await reply.promise;throw Error('SYNTHETIC delayed failure');};
          if(phase==='headers')f.headerHook=hook;else f.fetchHook=hook;
          const job=vm.runInContext("fixtureDeviceSecurityCaller.generateCode('KIOSK_08')",f.context);
          await entered.promise;f.context.fixtureSession.permissions.owner=false;reply.resolve();await job;
          withdrawn(f);assert(f.node('app').classList.contains('hidden'));
          assert.notEqual(f.node('status').textContent,'SYNTHETIC delayed failure');
          assert.equal(f.calls.filter(c=>c.url.endsWith('/enrollment-code')).length,phase==='headers'?0:1);
          assert.deepEqual([...f.storage.rows],rows);
        }finally{await f.close();}
      }
    });
    check('GENERIC_REQUEST_NEW followup page retirement during generic reply cannot show code or erase original',async()=>{
      const f=await fixture({saved:'marker'});try{
        await f.ready;const rows=[...f.storage.rows],entered=defer(),reply=defer();
        f.fetchHook=async()=>{entered.resolve();return reply.promise;};
        const job=vm.runInContext("fixtureDeviceSecurityCaller.generateCode('KIOSK_08')",f.context);
        await entered.promise;await f.pagehide();const message=f.node('sameOriginalMessage').textContent;
        reply.resolve({ok:true,status:200,json:async()=>f.realm({ok:true,data:codeData})});await job;
        assert.equal(f.node('code').textContent,'');assert(!f.node('code-box').classList.contains('show'));
        assert.equal(f.node('sameOriginalMessage').textContent,message);withdrawn(f);
        assert.deepEqual([...f.storage.rows],rows);assert.equal(f.calls.filter(c=>c.url.endsWith('/enrollment-code')).length,1);
      }finally{await f.close();}
    });
    check('GENERIC_REQUEST_NEW followup password helper already rejects second-await owner drift',async()=>{
      const f=await fixture({saved:'marker'});try{
        await f.ready;const rows=[...f.storage.rows],entered=defer(),reply=defer(),calls=f.calls.length;
        f.floorHook=async()=>{entered.resolve();await reply.promise;};
        const job=vm.runInContext('fixtureDeviceSecurityCaller.current()',f.context);
        await entered.promise;f.context.fixtureSession.device_id='successor';reply.resolve();
        assert.equal(await job,false);withdrawn(f);assert.equal(f.calls.length,calls);
        assert.deepEqual([...f.storage.rows],rows);
      }finally{await f.close();}
    });
    check('GENERIC_REQUEST_NEW followup unchanged original displays one code and preserves saved guard',async()=>{
      const f=await fixture({saved:'marker'});try{
        await f.ready;const rows=[...f.storage.rows];
        f.fetchHook=async()=>({ok:true,status:200,json:async()=>f.realm({ok:true,data:codeData})});
        await vm.runInContext("fixtureDeviceSecurityCaller.generateCode('KIOSK_08')",f.context);
        const calls=f.calls.filter(c=>c.url.endsWith('/enrollment-code'));
        assert.equal(calls.length,1);assert.equal(calls[0].init.method,'POST');
        assert.deepEqual(JSON.parse(calls[0].init.body),{device_id:'KIOSK_08'});
        assert.equal(f.node('code').textContent,codeData.enrollment_code);
        assert(f.node('code-box').classList.contains('show'));assert.deepEqual([...f.storage.rows],rows);
      }finally{await f.close();}
    });
    check('GENERIC_REQUEST_NEW password browser drift must not adopt an enrollment code',async()=>{
      const f=await fixture({saved:'marker'});try{
        await f.ready;const rows=[...f.storage.rows],entered=defer(),reply=defer();
        f.fetchHook=async()=>({ok:true,status:200,json:async()=>f.realm({ok:true,data:codeData})});
        f.floorHook=async()=>{entered.resolve();await reply.promise;};
        const job=vm.runInContext("fixtureDeviceSecurityCaller.generateCode('KIOSK_08')",f.context);
        await entered.promise;f.browserDevice='successor-browser';reply.resolve();await job;
        assert.equal(f.node('code').textContent,'','second password await cannot publish to successor browser');
        assert.equal(f.calls.filter(c=>c.url.endsWith('/enrollment-code')).length,1);
        withdrawn(f);assert.deepEqual([...f.storage.rows],rows);
      }finally{await f.close();}
    });
  }
  const filter=process.env.DEVICE_SECURITY_CALLER_CASE;
  let passed=0;for(const [name,body] of cases){if(filter&&!name.includes(filter))continue;await body();passed++;console.log('SOURCE_MODEL_PASS: '+name);}
  assert(passed>0);console.log('SAME_ORIGINAL_PAGE_CALLER_ONLY_PASS '+passed+' groups; actual source + recording ports only');
} else if (process.argv.includes('--same-original-panel-markup-only')) {
  // Reuse the already installed/pinned Capacitor CLI parser. Private source
  // candidates may point only this dependency lookup at the normal checkout;
  // no additional package, browser, parser implementation or capture is made.
  const dependencyRequire=createRequire(process.env.DEVICE_SECURITY_MARKUP_DEPENDENCY_ROOT
    ? path.resolve(process.env.DEVICE_SECURITY_MARKUP_DEPENDENCY_ROOT,'package.json') : import.meta.url);
  const cliRequire=createRequire(dependencyRequire.resolve('@capacitor/cli/package.json'));
  const {DOMParser}=createRequire(cliRequire.resolve('plist/package.json'))('@xmldom/xmldom');
  const html=read('device-security.html');
  const document=new DOMParser({onError:(level,message)=>{throw new Error(`Device Security HTML ${level}: ${message}`);}})
    .parseFromString(html,'text/html');
  const elements=Array.from(document.getElementsByTagName('*'));
  const ids=elements.filter(element=>element.hasAttribute('id')).map(element=>element.getAttribute('id'));
  assert.equal(new Set(ids).size,ids.length,'all actual static markup IDs must remain unique');
  const expected=['sameOriginalChallenge','sameOriginalReview','sameOriginalConfirm','sameOriginalStatus','sameOriginalSummary','sameOriginalMessage'];
  const nodes=expected.map(id=>{assert.equal(ids.filter(value=>value===id).length,1,`one actual ${id} required`);return document.getElementById(id);});
  const app=document.getElementById('app');assert(app);
  assert(app.getAttribute('class').split(/\s+/).includes('hidden'),'original password-locked app must remain hidden');
  for(const node of nodes){let parent=node.parentNode;while(parent&&parent!==app)parent=parent.parentNode;
    assert.equal(parent,app,`${node.id} must be inside existing locked app`);}
  const [challenge,review,confirm,status,summary,message]=nodes;
  assert.equal(challenge.tagName.toLowerCase(),'input');assert.equal(challenge.getAttribute('type'),'text');
  assert.equal(challenge.getAttribute('autocomplete'),'off');assert.equal(challenge.getAttribute('autocapitalize'),'none');
  assert.equal(challenge.getAttribute('spellcheck'),'false');assert(challenge.hasAttribute('disabled'));
  assert.equal(challenge.getAttribute('pattern'),'[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}');
  assert.equal(challenge.getAttribute('value'),null,'no original challenge is invented');
  const label=elements.find(element=>element.tagName.toLowerCase()==='label'&&element.getAttribute('for')==='sameOriginalChallenge');
  assert(label&&label.textContent.includes('Original challenge UUID'),'explicit original input label required');
  for(const button of [review,confirm,status]){assert.equal(button.tagName.toLowerCase(),'button');
    assert.equal(button.getAttribute('type'),'button');assert(button.hasAttribute('disabled'));
    assert(!button.hasAttribute('onclick'));assert(!button.hasAttribute('formaction'));
    for(let parent=button.parentNode;parent;parent=parent.parentNode)assert.notEqual(parent.tagName?.toLowerCase(),'form');}
  assert.equal(summary.tagName.toLowerCase(),'pre');assert(summary.hasAttribute('hidden'));assert.equal(summary.textContent,'');
  assert.match(message.textContent,/Preparation only/);assert.match(message.textContent,/No native approval, work acceptance, key retirement, or phone readiness/);
  assert(elements.some(element=>element.tagName.toLowerCase()==='h2'&&element.textContent==='Same-original recovery preparation'));
  const scripts=Array.from(document.getElementsByTagName('script'));
  const moduleNames=['same-original-recovery-client.js','same-original-recovery-panel.js','same-original-recovery-original-store.js','same-original-recovery-page.js'];
  const expectedSources=moduleNames.map(name=>`./${name}?v=release-2026.07.19.custodial-v3.12`);
  const moduleScripts=scripts.filter(script=>moduleNames.some(name=>script.getAttribute('src')?.includes(name)));
  assert.deepEqual(moduleScripts.map(script=>script.getAttribute('src')),expectedSources,'one each in actual dependency order');
  const inline=scripts.filter(script=>!script.hasAttribute('src'));assert.equal(inline.length,1,'no new inline/mounting script');
  for(const script of moduleScripts){assert(scripts.indexOf(script)<scripts.indexOf(inline[0]));
    assert(!script.hasAttribute('async'));assert(!script.hasAttribute('defer'));assert(!script.hasAttribute('type'));}
  assert.doesNotMatch(inline[0].textContent,/mountSameOriginalRecoveryPage|MemphisSameOriginalRecovery|sameOriginal/,'no mounting or fake ports yet');
  const panelBlock=html.match(/^      <!-- same-original preparation panel begin -->\n[\s\S]*?^      <!-- same-original preparation panel end -->\n/m)?.[0];
  const moduleBlock=html.match(/^  <!-- same-original preparation modules begin -->\n[\s\S]*?^  <!-- same-original preparation modules end -->\n/m)?.[0];
  assert(panelBlock&&moduleBlock,'only two declared new source chunks');
  assert.equal(html.split(panelBlock).length,2);assert.equal(html.split(moduleBlock).length,2);
  const untouched=html.replace(panelBlock,'').replace(moduleBlock,'');
  assert.equal(createHash('sha256').update(untouched).digest('hex'),'c3c28ac96e1176a546fd57347571c10806db8de636ba93564d6e9adb1c7669dc',
    'entire existing page/CSP/URLs/navigation/functions/styles must remain byte-identical');
  assert.equal(elements.find(element=>element.tagName.toLowerCase()==='a'&&element.hasAttribute('data-mz-back')).getAttribute('href'),'./start_page1.html');
  console.log('SAME_ORIGINAL_PANEL_MARKUP_ONLY_PASS: unique locked-app IDs; exact input; disabled nonsubmit controls; self dependency order/no mount; entire original page bytes preserved');
} else {
const source = read('memphis-device-identity.js');
const releaseManifest = JSON.parse(read('frontend-release-manifest.json'));
const releaseIdFormat = /^release-\d{4}\.\d{2}\.\d{2}\.[a-z0-9.-]+$/;

const sourceRelease = source.match(/const RELEASE='([^']+)'/)?.[1] || '';
assert.match(sourceRelease, releaseIdFormat);
assert.match(source, /credentials:'include'/);
assert.match(source, /X-Device-Id/);
assert.match(source, /device_credential_required/);
assert.match(source, /enrollment\.required&&!enrollment\.retry/);
assert.match(source, /if\(enrollment\.retry\)/);
assert.match(source, /memphis-device-enrolled/);
assert.match(source, /isManagerAuthRequest/);
assert.match(source, /opsManagerAuthHeaders/);
assert.match(source, /did not retain its protected cookie/);
assert.match(source, /refreshCredentialStatus\(\{force:true\}\)/);
assert.match(source, /enrollment code/i);
assert.doesNotMatch(source, /localStorage\.clear\s*\(/);
assert.doesNotMatch(source, /removeItem\([^)]*session:/i);
assert.doesNotMatch(source, /removeItem\([^)]*mz_scan_queue/i);

const calls = [];
const localStorage = {
  values: new Map([['mz_scan_device_id', 'KIOSK_06']]),
  getItem(key) { return this.values.get(key) || ''; },
  setItem(key, value) { this.values.set(key, value); },
};
const fakeFetch = async (input, init = {}) => {
  const request = input instanceof Request ? input : new Request(input, init);
  calls.push(request);
  return new Response(JSON.stringify({ ok: true, data: {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
const context = {
  URL, Request, Headers, Response,
  navigator: { userAgent: 'FullyKiosk' },
  localStorage,
  window: {
    location: { href: 'https://lasrevinu333-design.github.io/Engine/messages.html?device=KIOSK_06' },
    fetch: fakeFetch,
    Request,
    Headers,
    fully: null,
  },
};
context.window.window = context.window;
vm.runInNewContext(source, context, { filename: 'memphis-device-identity.js' });

await context.window.fetch('https://memphis-zoo-mcp.onrender.com/messaging-api/threads?device_id=KIOSK_06');
assert.equal(calls.length, 1);
assert.equal(calls[0].credentials, 'include');
assert.equal(calls[0].headers.get('x-device-id'), 'KIOSK_06');

// The shared manager scan device remains compatible with the device boundary by
// attaching its silently refreshed Ops session. Auth bootstrap requests themselves
// must bypass this injection to avoid recursive session refresh deadlock.
const managerCalls=[];
let managerHeaderCalls=0;
const managerStorage={
  values:new Map([['mz_scan_device_id','KIOSK_01']]),
  getItem(key){return this.values.get(key)||'';},
  setItem(key,value){this.values.set(key,value);},
};
const managerFetch=async(input,init={})=>{
  const request=input instanceof Request?input:new Request(input,init);
  managerCalls.push(request);
  return new Response(JSON.stringify({ok:true,data:{}}),{status:200,headers:{'Content-Type':'application/json'}});
};
const managerContext={
  URL,Request,Headers,Response,
  navigator:{userAgent:'FullyKiosk'},
  localStorage:managerStorage,
  window:{
    location:{href:'https://lasrevinu333-design.github.io/Engine/index.html?device=KIOSK_01'},
    fetch:managerFetch,Request,Headers,fully:null,
    MemphisAuth:{async opsManagerAuthHeaders(){managerHeaderCalls+=1;return{Authorization:'Bearer manager-token','X-Device-Id':'KIOSK_01'};}},
  },
};
managerContext.window.window=managerContext.window;
vm.runInNewContext(source,managerContext,{filename:'memphis-device-identity-manager.js'});
await managerContext.window.fetch('https://memphis-zoo-mcp.onrender.com/scan-api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(managerCalls.at(-1).headers.get('authorization'),'Bearer manager-token');
assert.equal(managerHeaderCalls,1);
await managerContext.window.fetch('https://memphis-zoo-mcp.onrender.com/auth-api/session');
assert.equal(managerHeaderCalls,1,'auth bootstrap requests must not recursively request manager headers');

// A successful enroll-mode response can carry a nonblocking enrollment hint.
// It must not be replayed: replaying a POST would duplicate scans, messages,
// acknowledgements, or completion submissions.
const hintedCalls = [];
const hintedFetch = async (input, init = {}) => {
  const request = input instanceof Request ? input : new Request(input, init);
  hintedCalls.push(request);
  return new Response(JSON.stringify({ ok: true, data: { committed: true } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Device-Enrollment-Required': 'true' },
  });
};
const hintedContext = {
  URL, Request, Headers, Response,
  navigator: { userAgent: 'FullyKiosk' },
  localStorage,
  window: {
    location: { href: 'https://lasrevinu333-design.github.io/Engine/index.html?device=KIOSK_06' },
    fetch: hintedFetch,
    Request,
    Headers,
    fully: null,
  },
};
hintedContext.window.window = hintedContext.window;
vm.runInNewContext(source, hintedContext, { filename: 'memphis-device-identity-hint.js' });
const hintedResponse = await hintedContext.window.fetch('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fn: 'tool_record_scan_event', args: { p_device_id: 'KIOSK_06' } }),
});
assert.equal(hintedResponse.status, 200);
assert.equal(hintedCalls.length, 1, 'successful enroll-mode responses must not be replayed after an enrollment hint');

const identity = context.window.MemphisDeviceIdentity.resolve({ url: new URL(context.window.location.href) });
assert.equal(identity.deviceId, 'KIOSK_06');
assert.equal(identity.source, 'url_canonical');

const protectedPages = [
  'employee-hub.html',
  'employee-schedule.html',
  'events.html',
  'index.html',
  'messages.html',
];
for (const page of protectedPages) {
  const pageSource = read(page);
  const importedRelease = pageSource.match(/memphis-device-identity\.js\?v=(release-[^"']+)/)?.[1] || '';
  assert.match(importedRelease, releaseIdFormat, `${page} must cache-bust the device identity asset with a release id`);
  const appVersion = pageSource.match(/APP_VERSION\s*:\s*["']([^"']+)["']/)?.[1] || '';
  if (appVersion) assert.equal(importedRelease, appVersion, `${page} must load device identity from its declared app release`);
  if (page === 'index.html') assert.equal(importedRelease, releaseManifest.release_id, 'the scan page must load device identity from the coordinated release');
}
const legacyThread = read('thread.html');
assert.match(legacyThread, /new URL\(['"]\.\/messages\.html['"],location\.href\)/, 'legacy thread links must redirect into the protected Messenger shell');
assert.match(legacyThread, /searchParams\.set\(key,value\)/, 'legacy thread redirects must retain device and thread query parameters');
assert.match(legacyThread, /target\.hash=location\.hash/, 'legacy thread redirects must retain hash state');

const securityPage = read('device-security.html');
assert.match(securityPage, /Device Security/);
assert.match(securityPage, /Security Admin unlock required/);
assert.match(securityPage, /separate Device Security password/);
assert.match(securityPage, /Unlock for 15 minutes/);
assert.match(securityPage, /window\.MemphisAuth\.unlockDeviceSecurity/);
assert.match(securityPage, /window\.MemphisAuth\.deviceSecurityAuthHeaders/);
assert.match(securityPage, /\/admin-api\/device-security/);
assert.match(securityPage, /\/admin-api\/device-auth/);
assert.match(securityPage, /Generate Code/);
assert.match(securityPage, /Revoke Code/);
assert.match(securityPage, /Revoke All Security Sessions/);
assert.match(securityPage, /Enforce credentials/);
assert.match(securityPage, /ready_to_enforce/);
assert.match(securityPage, /Registry row missing/);
assert.match(securityPage, /Device inactive/);
assert.match(securityPage, /No employee assigned/);
assert.match(securityPage, /Assigned employee inactive/);
assert.match(securityPage, /Assignment is not custodial/);
assert.match(securityPage, /Credential issued — awaiting phone confirmation/);
assert.match(securityPage, /data-code[^>]+disabled aria-disabled/);
assert.match(securityPage, /Number\(coverage\.ready\|\|0\)/);
assert.match(securityPage, /Codes are generated server-side, stored only as hashes, and displayed once/i);
assert.doesNotMatch(securityPage, /ops_pairing_token/);
assert.doesNotMatch(securityPage, /localStorage\.setItem\([^)]*deviceSecurity/i);

const managerHub = read('start_page1.html');
const managerHubScript = read('ops-hub.js');
assert.match(managerHub, /id="device-security-link"/);
assert.match(managerHub, /device-security\.html/);
assert.match(managerHub, /id="manager-access-link"/);
assert.match(managerHub, /manager-access\.html/);
assert.match(managerHubScript, /isReadOnlySession/);
assert.match(managerHubScript, /showAccessRequired/);
assert.match(managerHubScript, /window\.location\.replace/);
assert.match(managerHubScript, /deviceSecurityLink/);
assert.match(managerHubScript, /managerAccessLink/);
assert.match(managerHubScript, /hasRole\('SECURITY_ADMIN'/);

console.log('DEVICE_CREDENTIAL_FRONTEND_FOUNDATION_TESTS_PASS');
}
