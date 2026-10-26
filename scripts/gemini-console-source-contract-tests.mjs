import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const js=fs.readFileSync('gemini-console.js','utf8');
if(process.argv.includes('--browser-preservation-new')||process.argv.includes('--outbox-new')||process.argv.includes('--dispatch-once-new')||process.argv.includes('--session-bound-new')||process.argv.includes('--workflow-race-new')||process.argv.includes('--original-outcome-new')||process.argv.includes('--original-lifetime-new')){
  await owningOutboxCases();
}else{
const html=fs.readFileSync('gemini-admin.html','utf8');
const auth=fs.readFileSync('memphis-auth.js','utf8');

assert.match(html,/Content-Security-Policy/);
assert.match(html,/default-src 'self'/);
assert.match(html,/object-src 'none'/);
assert.match(html,/conversation transcript/i);
assert.match(html,/Attach files, drag them here, or paste an image/);
assert.match(html,/class="gemini-global-back mz-back-link"[^>]*data-mz-back[^>]*href="\.\/start_page1\.html"/);
assert.match(fs.readFileSync('gemini-console.css','utf8'),/\[hidden\]\{display:none!important\}/);
assert.doesNotMatch(html,/premade|prompt card|model selector|temperature|API key|Gemini password/i);
assert.doesNotMatch(html,/onclick=|onerror=|<script(?![^>]*src=)/i);

assert.match(js,/requireOpsManagerSession\(\{accessLevel:'full_access',interactive:false/);
assert.match(js,/credentials:'include'/);
assert.match(js,/open\.call\(factory,DB_NAME,1\)/);
assert.match(js,/client_message_id:uuid\(\)/);
assert.match(js,/if\(state\.busy\|\|state\.submitting/);
assert.match(js,/document\.addEventListener\('paste'/);
assert.match(js,/window\.visualViewport\?\.height/);
assert.match(js,/--gemini-viewport-height/);
assert.match(js,/function openApp\(\)\{syncViewportHeight\(\)/);
assert.match(js,/dataTransfer\.files/);
assert.match(js,/text\.textContent=message\.body/);
assert.match(js,/timeZone:'America\/Chicago'/);
assert.match(js,/rawOutboxArea\('localStorage'\)/);assert.match(js,/rawOutboxArea\('sessionStorage'\)/);
assert.doesNotMatch(js,/innerHTML|insertAdjacentHTML|eval\(|new Function/);
assert.doesNotMatch(js,/requireGeminiAdmin|gemini\/login|gemini\/session|Gemini password/i);
assert.match(auth,/memphisGeminiAdminSession\.v1/);
assert.doesNotMatch(auth,/requireGeminiAdminSession|geminiAdminLogin/);

console.log('GEMINI_CONSOLE_SOURCE_CONTRACT_PASS');
}

async function owningOutboxCases(){
 const id='11111111-1111-4111-8111-111111111111',conversation='22222222-2222-4222-8222-222222222222',correlation='33333333-3333-4333-8333-333333333333';
 const original={client_message_id:id,correlation_id:correlation,conversation_id:conversation,body:'Exact saved original',
  attachment_ids:['44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555'],created_at:'2026-10-13T02:03:04.005Z',state:'queued'};
 const {webcrypto}=await import('node:crypto');
 const admissionModule=await import('../mobile/src/custodial/protected-browser-admission.js');
 const {installCustodialStorageFirewall}=await import('../mobile/src/custodial/storage-firewall.js');
 const copy=value=>structuredClone(value),tick=()=>new Promise(setImmediate),cases=[];
 function idbFixture(saved=[],serialized=false,options={}){
  const rows=new Map(saved.map(value=>[value.client_message_id,copy(value)])),transactions=[],counts={opens:0,closes:0,put:0,add:0,delete:0,upgrades:0};
  const opening=[];let exists=options.absent!==true;
  const indexedDB={databases:async()=>exists?[{name:'memphis-gemini-console',version:1}]:[],open(){counts.opens++;const request={};opening.push(request);let connectionClosed=false;
   request.result={version:1,objectStoreNames:Object.assign(['outbox'],{contains:name=>name==='outbox'}),createObjectStore(name){assert.equal(name,'outbox');counts.upgrades++;},close(){if(!connectionClosed){connectionClosed=true;counts.closes++;}},transaction(store,mode){
   assert.ok(store==='outbox'||Array.isArray(store)&&store.length===1&&store[0]==='outbox');let staged=new Map([...rows].map(([key,value])=>[key,copy(value)]));const requests=[];
   const tx={mode,requests,error:null,aborted:false,abort(){tx.aborted=true;queueMicrotask(()=>tx.onabort?.({target:tx}));},objectStore(){return {
    get:key=>queue('get',key),getAll:()=>queue('getAll'),openCursor:()=>queue('cursor',0),put:value=>queue('put',value),add:value=>queue('add',value),delete:key=>queue('delete',key)
   };}};
   function queue(op,arg){const r={op,arg,result:undefined,error:null};requests.push(r);return r;}
   tx.requestSuccess=(limit=Infinity)=>{
    // New competing-tab case schedules write transactions serially, as IDB
    // does for the same object store; acquire the committed snapshot at start.
    if(serialized&&!tx.started){staged=new Map([...rows].map(([key,value])=>[key,copy(value)]));tx.started=true;}
    let fired=0;
    for(let i=0;i<requests.length&&!tx.aborted&&fired<limit;i++){
     const r=requests[i];if(r.fired)continue;r.fired=true;
     fired++;
     if(r.op==='get')r.result=copy(staged.get(r.arg));
     else if(r.op==='getAll')r.result=[...staged.values()].map(copy);
     else if(r.op==='cursor'){const entry=[...staged.entries()][r.arg];r.result=entry?{primaryKey:entry[0],value:copy(entry[1]),continue(){r.arg++;r.fired=false;queueMicrotask(()=>tx.requestSuccess());}}:null;}
     else if(r.op==='delete'){counts.delete++;staged.delete(r.arg);}
     else {counts[r.op]++;staged.set(r.arg.client_message_id,copy(r.arg));r.result=r.arg.client_message_id;}
     r.onsuccess?.({target:r});
    }
   };
   tx.requestFailure=error=>{const r=requests[0];r.error=error;r.onerror?.({target:r});tx.onerror?.({target:r});};
   tx.commit=()=>{assert.equal(tx.aborted,false);if(mode==='readwrite'){rows.clear();for(const [key,value]of staged)rows.set(key,value);}tx.oncomplete?.({target:tx});};
   tx.fail=error=>{tx.error=error;tx.aborted=true;tx.onabort?.({target:tx});};
   transactions.push(tx);return tx;
  }};
   request.release=()=>{if(request.released)return;request.released=true;
    if(!exists){request.transaction={abort(){request.aborted=true;queueMicrotask(()=>{request.error=Object.assign(Error('upgrade aborted'),{name:'AbortError'});request.onerror?.();});}};
     request.onupgradeneeded?.();if(request.aborted)return;exists=true;}
    request.onsuccess?.();
   };
   queueMicrotask(()=>options.blockOpen?request.onblocked?.():request.release());return request;}};
  return {indexedDB,rows,transactions,counts,opening,setExists:value=>{exists=value;},get exists(){return exists;}};

 }
 function browserFixture(){
  class Area{
   constructor(){this.rows=new Map();}
   getItem(key){return this.rows.get(key)??null;}
   setItem(key,value){this.rows.set(key,String(value));}
   removeItem(key){this.rows.delete(key);}
   clear(){this.rows.clear();}
   key(index){return [...this.rows.keys()][index]??null;}
   get length(){return this.rows.size;}
  }
  const local=new Area(),session=new Area(),queue=[];let active=false;
  const pump=()=>{if(active||!queue.length)return;const item=queue.shift();if(item.aborted){pump();return;}
   active=true;item.entered=true;item.signal.removeEventListener('abort',item.abort);
   Promise.resolve().then(()=>item.work({name:item.name,mode:'exclusive'})).then(item.resolve,item.reject).finally(()=>{active=false;pump();});
  };
  const locks={request(name,{mode,signal},work){
   assert.equal(name,admissionModule.PROTECTED_BROWSER_LOCK);assert.equal(mode,'exclusive');
   return new Promise((resolve,reject)=>{const item={name,signal,work,resolve,reject};
    item.abort=()=>{if(item.entered)return;item.aborted=true;reject(Object.assign(Error('lock wait aborted'),{name:'AbortError'}));};
    if(signal.aborted){item.abort();return;}signal.addEventListener('abort',item.abort,{once:true});queue.push(item);pump();});
   },get active(){return active;},get pending(){return queue.filter(item=>!item.aborted).length;}};
  return {local,session,locks};
 }
 function scope(f,extra={}){
  const browser=extra.browser||browserFixture();
  const testSession={role:'ops_manager',manager_id:'fixture-manager',credential_id:'fixture-credential',device_id:'fixture-device',token:'fixture-only-not-a-credential',
   expires_at:'2099-01-01T00:00:00Z',access_level:'full_access',read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}};
  const state={session:testSession,busy:false,submitting:false,conversation:{conversation_id:conversation},selectedConversationGeneration:0,conversations:[{conversation_id:conversation}],attachments:[],messages:[]};
  const context=vm.createContext({indexedDB:f.indexedDB,DB_NAME:'memphis-gemini-console',DB_STORE:'outbox',MAX_ATTACHMENTS:8,MAX_FILE_BYTES:6*1024*1024,API:'fixture://gemini',
   setTimeout,clearTimeout,queueMicrotask,state,el:{input:{value:'',},status:{}},Object,Array,Date,JSON,Error,Number,String,Uint8Array,TextDecoder,AbortController,
   toggleBusy:()=>{},setStatus:()=>{},lock:()=>{},streamRecord:async()=>{},...extra,
   window:{localStorage:browser.local,sessionStorage:browser.session,indexedDB:f.indexedDB,navigator:{locks:browser.locks},crypto:webcrypto,...extra.window,MemphisAuth:{readSession:()=>testSession,opsManagerAuthHeaders:async()=>({Authorization:`Bearer ${testSession.token}`,'X-Device-Id':testSession.device_id}),...extra.window?.MemphisAuth}}});
  const start=js.includes('  // Private cooperative DATA writer owner;')?js.indexOf('  // Private cooperative DATA writer owner;'):js.indexOf('  function db()'),end=js.indexOf('  function fileBase64(',start);
  const capabilities=js.match(/  const freshOutboxOriginals=.*;/)?.[0];if(capabilities)vm.runInContext(capabilities,context);
  const managerStart=js.indexOf('  function captureOriginalManager()'),managerEnd=js.indexOf('  async function sendCurrent(',managerStart);
  if(managerStart>0)vm.runInContext(js.slice(managerStart,managerEnd),context);
  assert.ok(start>0&&end>start);vm.runInContext(js.slice(start,end)+'\nthis.put=outboxPut;this.remove=outboxDelete;this.all=outboxAll;this.transaction=txPromise;'+(js.includes('async function outboxAdmitDispatch(')?'this.admit=outboxAdmitDispatch;':''),context,{filename:fs.realpathSync('gemini-console.js'),importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER});
  return context;
 }
 function loadFunction(context,start,end){if(end==='  function db()'&&js.includes('  // Private cooperative DATA writer owner;'))end='  // Private cooperative DATA writer owner;';const a=js.indexOf(start),b=js.indexOf(end,a);assert.ok(a>0&&b>a);
  if((start==='  async function sendCurrent('||start==='  async function selectConversation(')&&js.includes('  function captureOriginalManager()')){
   const helper=js.indexOf('  function captureOriginalManager()');vm.runInContext(js.slice(helper,a),context);
  }vm.runInContext(js.slice(a,b),context);}
 const tracked=promise=>{const status={done:false,value:null,error:null};promise.then(value=>{status.done=true;status.value=value;},error=>{status.done=true;status.error=error;});return status;};
 const execute=async(f,work)=>{const result=tracked(work);await tick();const tx=f.transactions.at(-1);tx.requestSuccess();await tick();if(!tx.aborted)tx.commit();await tick();return result;};
 if(process.argv.includes('--browser-preservation-new')){
  const KEY=admissionModule.PROTECTED_BROWSER_HOLD_KEY,EPOCH=admissionModule.PROTECTED_BROWSER_MUTATION_KEY;
  const selected=process.argv.find(value=>value.startsWith('--preservation-case='))?.slice('--preservation-case='.length);
  const until=async(test,label)=>{for(let n=0;n<200&&!test();n++)await tick();assert.ok(test(),label);};
  const run=async(name,work)=>{if(selected&&selected!==name)return;await work();cases.push(name);console.log('PASS '+name);};
  const competitor=(f,b)=>admissionModule.createProtectedBrowserAdmission({storage:b.local,sessionStorage:b.session,indexedDb:f.indexedDB,locks:b.locks,cryptoApi:webcrypto});
  const settled=async(status,f)=>{let cursor=0;
   for(let step=0;step<200&&!status.done;step++){
    await tick();while(cursor<f.transactions.length){const tx=f.transactions[cursor++];tx.requestSuccess();await tick();if(!tx.aborted)tx.commit();await tick();}
   }
   assert.equal(status.done,true,'actual Console promise reaches its terminal event');await tick();return status;
  };
  const stream=(context,fetch)=>{
   context.fetch=fetch;context.appendAssistantStream=()=>({message:{},text:{},meta:{},node:{classList:{add(){}}}});
   Object.assign(context,{scrollBottom(){},formatTime(){},loadConversations:async()=>{},refreshMessages:async()=>{},refreshRepairState:async()=>{}});
   loadFunction(context,'  async function headers(','  async function api(');
   loadFunction(context,'  async function readEventStream(','  function db()');
   loadFunction(context,'  async function streamRecord(','  async function retryMessage(');
  };
  await run('PRESERVATION_NEW hold before absent DB create',async()=>{
   const f=idbFixture([],false,{absent:true}),b=browserFixture(),c=scope(f,{browser:b});
   b.local.setItem(KEY,'retained-existing-hold');
   const p=tracked(c.put(copy(original)));await until(()=>p.done||f.counts.opens>0,'first Console admission attempted');
   if(f.counts.opens)console.error(JSON.stringify({case:'hold-before-create',unguarded_opens:f.counts.opens,upgrades:f.counts.upgrades}));
   assert.equal(f.counts.opens,0);assert.equal(f.counts.upgrades,0);assert.equal(f.exists,false);
   assert.equal(p.done,true);assert.ok(p.error);assert.equal(f.transactions.length,0);assert.equal(b.local.getItem(EPOCH),null);
  });
  await run('PRESERVATION_NEW hold before write dispatch marker and delete',async()=>{
   for(const operation of ['put','remove']){
    const f=idbFixture([original]),b=browserFixture(),c=scope(f,{browser:b});b.local.setItem(KEY,'retained-hold');
    const p=tracked(c[operation](copy(original)));await until(()=>p.done,'held mutation refuses');
    assert.ok(p.error);assert.equal(f.counts.opens,0);assert.deepEqual(f.rows.get(id),original);assert.equal(b.locks.active,false);
   }
   const f=idbFixture(),b=browserFixture(),c=scope(f,{browser:b}),p=await settled(tracked(c.put(copy(original))),f);
   assert.equal(p.error,null);b.local.setItem(KEY,'retained-hold');
   const a=tracked(c.admit(p.value));await until(()=>a.done,'held dispatch marker refuses');
   assert.ok(a.error);assert.equal(f.transactions.length,1);assert.deepEqual(f.rows.get(id),original);
   await assert.rejects(c.admit(p.value),error=>error.code==='gemini_outbox_dispatch_held');assert.equal(b.locks.active,false);
  });
  await run('PRESERVATION_NEW pending transaction owns lock through complete',async()=>{
   const f=idbFixture(),b=browserFixture(),c=scope(f,{browser:b}),p=tracked(c.put(copy(original)));
   await until(()=>f.transactions.length===1,'writer entered');const tx=f.transactions[0];
   const h=tracked(competitor(f,b).holdAndObserve({operationId:id,timeoutMs:1000}));await tick();
   tx.requestSuccess();await tick();assert.equal(p.done,false);assert.equal(h.done,false);assert.equal(b.locks.pending,1);
   assert.equal(b.local.getItem(KEY),null);assert.equal(f.counts.closes,0);
   tx.commit();await until(()=>p.done,'writer complete');assert.equal(p.error,null);
   const observed=await settled(h,f);assert.equal(observed.error,null);
   assert.equal(observed.value.native_authority,false);assert.equal(observed.value.frozen,false);assert.equal(observed.value.acknowledged,false);
   assert.ok(b.local.getItem(KEY));assert.deepEqual(f.rows.get(id),original);assert.equal(b.locks.active,false);assert.equal(b.locks.pending,0);
   assert.equal(f.counts.opens,f.counts.closes);
  });
  await run('PRESERVATION_NEW request failure waits queued abort before hold',async()=>{
   const old={...original,body:'preserved different source'},f=idbFixture([old]),b=browserFixture(),c=scope(f,{browser:b});
   const p=tracked(c.put(copy(original)));await until(()=>f.transactions.length===1,'conflicting writer entered');
   const tx=f.transactions[0];tx.abort=()=>{throw Error('terminal abort already queued');};
   const h=tracked(competitor(f,b).holdAndObserve({operationId:id,timeoutMs:1000}));tx.requestSuccess();await tick();
   assert.equal(p.done,false);assert.equal(h.done,false);assert.equal(b.local.getItem(KEY),null);assert.equal(f.counts.closes,0);
   tx.fail(Error('terminal abort'));await until(()=>p.done,'actual abort delivered');
   assert.equal(p.error?.code,'gemini_outbox_original_conflict');await settled(h,f);
   assert.equal(h.error,null);assert.deepEqual(f.rows.get(id),old);assert.ok(b.local.getItem(KEY));assert.equal(b.locks.active,false);
   assert.equal(f.counts.opens,f.counts.closes);
  });
  await run('PRESERVATION_NEW blocked open is nonterminal and upgrade stays owned',async()=>{
   const f=idbFixture([],false,{absent:true,blockOpen:true}),b=browserFixture(),c=scope(f,{browser:b}),p=tracked(c.put(copy(original)));
   await until(()=>f.opening.length===1,'open blocked under owner');
   const h=tracked(competitor(f,b).holdAndObserve({operationId:id,timeoutMs:1000}));await tick();
   assert.equal(p.done,false);assert.equal(h.done,false);assert.equal(b.locks.pending,1);assert.equal(b.local.getItem(KEY),null);
   f.opening[0].release();await until(()=>f.transactions.length===1,'upgrade completed before write');
   assert.equal(f.counts.upgrades,1);f.transactions[0].requestSuccess();await tick();assert.equal(p.done,false);assert.equal(b.local.getItem(KEY),null);
   f.transactions[0].commit();await until(()=>p.done,'created database write complete');assert.equal(p.error,null);
   // The hold's read-only inventory open is also explicitly released; neither
   // blocked observation nor metadata is presented as browser custody proof.
   await until(()=>f.opening.length===2||h.done,'inventory started');
   if(f.opening.length===2)f.opening[1].release();await settled(h,f);
   assert.equal(h.error,null);assert.deepEqual(f.rows.get(id),original);assert.equal(b.locks.active,false);
   assert.equal(f.counts.opens,f.counts.closes);
  });
  await run('PRESERVATION_NEW readonly absence and disappeared enumeration never create under hold',async()=>{
   const f=idbFixture([],false,{absent:true}),b=browserFixture(),c=scope(f,{browser:b});b.local.setItem(KEY,'retained-hold');
   assert.deepEqual(copy(await c.all()),[]);assert.equal(f.counts.opens,0);assert.equal(f.exists,false);assert.equal(b.local.getItem(EPOCH),null);
   f.setExists(true);f.indexedDB.databases=async()=>{f.setExists(false);return [{name:'memphis-gemini-console',version:1}];};
   await assert.rejects(c.all(),error=>error.code==='gemini_outbox_original_absent');
   assert.equal(f.exists,false);assert.equal(f.counts.upgrades,0);assert.equal(f.transactions.length,0);assert.equal(f.counts.opens,f.counts.closes);
  });
  await run('PRESERVATION_NEW native refusal and missing native owner never fall back',async()=>{
   const f=idbFixture(),b=browserFixture(),refusal=Object.assign(Error('synthetic public native refusal'),{code:'native_fixture_refused'});
   const c=scope(f,{browser:b,window:{MemphisCustodialSecurity:{native:true,mutateProtectedWork:async()=>{throw refusal;}}}});
   await assert.rejects(c.put(copy(original)),error=>error===refusal);
   assert.equal(f.counts.opens,0);assert.equal(b.local.getItem(EPOCH),null);assert.equal(b.locks.pending,0);
   c.window.MemphisCustodialSecurity=null;
   await assert.rejects(c.put(copy(original)),error=>error.code==='custodial_security_state_unavailable');
   assert.equal(f.counts.opens,0);
   const inaccessible=scope(f,{browser:b});
   Object.defineProperty(inaccessible.window,'MemphisCustodialSecurity',{configurable:true,get(){throw Error('public native state unavailable');}});
   await assert.rejects(inaccessible.put(copy(original)),error=>error.code==='custodial_security_state_unavailable');
   delete inaccessible.window.MemphisCustodialSecurity;
   await assert.rejects(inaccessible.put(copy(original)),error=>error.code==='custodial_security_state_unavailable');
   assert.equal(f.counts.opens,0);assert.equal(b.local.getItem(EPOCH),null);
  });
  await run('PRESERVATION_NEW installed firewall is not rebound as raw web admission',async()=>{
   const f=idbFixture(),b=browserFixture();installCustodialStorageFirewall({storage:b.local,getSecurityStatus:()=>({initialized:true,ready:true,available:true}),
    requireProtectedWorkMutation(){throw Error('no private runtime owner');}});
   const c=scope(f,{browser:b});await assert.rejects(c.put(copy(original)),error=>error.code==='custodial_security_state_unavailable');
   assert.equal(f.counts.opens,0);assert.equal(b.local.getItem(EPOCH),null);
  });
  await run('PRESERVATION_NEW manager lost across open aborts before upgrade',async()=>{
   const f=idbFixture([],false,{absent:true,blockOpen:true}),b=browserFixture(),c=scope(f,{browser:b});
   const binding=c.captureOriginalManager(),p=tracked(c.put(copy(original),()=>c.sameOriginalManager(binding)));
   await until(()=>f.opening.length===1,'open awaits original manager');c.state.session.device_id='changed-fixture-device';
   f.opening[0].release();await until(()=>p.done,'lost manager upgrade abort settles');
   assert.equal(p.error?.code,'gemini_original_manager_changed');assert.equal(f.exists,false);assert.equal(f.counts.upgrades,0);
   assert.equal(f.transactions.length,0);assert.equal(f.counts.opens,f.counts.closes);assert.equal(b.locks.active,false);
  });
  await run('PRESERVATION_NEW no hold exactly once and restart read only retains IDs',async()=>{
   const f=idbFixture([],false,{absent:true}),b=browserFixture(),c=scope(f,{browser:b});
   const saved=await settled(tracked(c.put(copy(original))),f);assert.equal(saved.error,null);assert.equal(f.counts.upgrades,1);
   const restart=scope(f,{browser:b}),epoch=b.local.getItem(EPOCH),read=await settled(tracked(restart.all()),f);
   assert.equal(read.error,null);assert.deepEqual(copy(read.value),[original]);assert.equal(b.local.getItem(EPOCH),epoch);
   await assert.rejects(restart.admit(copy(original)),error=>error.code==='gemini_outbox_dispatch_held');
   const admitted=await settled(tracked(c.admit(saved.value)),f);assert.equal(admitted.error,null);
   const calls=[];stream(c,async(url,options)=>{calls.push({url,options});return{ok:true,body:new ReadableStream({start(controller){controller.close();}})};});
   const send=tracked(c.streamRecord(saved.value,c.captureOriginalManager()));await until(()=>send.done,'admitted stream settles');
   assert.equal(send.error,null);assert.equal(calls.length,1);assert.deepEqual(JSON.parse(calls[0].options.body),original);
   await c.streamRecord(saved.value,c.captureOriginalManager());assert.equal(calls.length,1);
   assert.deepEqual(f.rows.get(id),{...original,state:'dispatch_attempted'});assert.equal(f.counts.add,1);assert.equal(f.counts.put,1);
   assert.equal(f.counts.opens,f.counts.closes);assert.equal(b.locks.active,false);
  });
  await run('PRESERVATION_NEW hold during headers refuses final dispatch without replay',async()=>{
   const f=idbFixture(),b=browserFixture(),c=scope(f,{browser:b}),saved=await settled(tracked(c.put(copy(original))),f);
   assert.equal(saved.error,null);const admitted=await settled(tracked(c.admit(saved.value)),f);assert.equal(admitted.error,null);
   let release,headersStarted=false;const gate=new Promise(resolve=>{release=resolve;});
   c.window.MemphisAuth.opsManagerAuthHeaders=async()=>{headersStarted=true;await gate;return{Authorization:'Bearer fixture-only-not-a-credential','X-Device-Id':'fixture-device'};};
   const calls=[];stream(c,async(...args)=>{calls.push(args);throw Error('must not dispatch');});
   const p=tracked(c.streamRecord(saved.value,c.captureOriginalManager()));await until(()=>headersStarted,'headers awaited');
   b.local.setItem(KEY,'preserved-hold-during-headers');release();await until(()=>p.done,'held send settles');
   assert.equal(calls.length,0);await c.streamRecord(saved.value,c.captureOriginalManager());assert.equal(calls.length,0);
   assert.deepEqual(f.rows.get(id),{...original,state:'dispatch_attempted'});assert.equal(b.locks.active,false);
  });
  assert.ok(cases.length,'new preservation member required');
  console.log(JSON.stringify({status:'GEMINI_CONSOLE_PRESERVATION_NEW_PASS',groups:cases.length,cases,
   actual_Console_VM_and_admission_module:true,IDB_WebLocks_Storage_auth_transport_synthetic:true,
   real_browser_native_manager_SQL_provider:false,frozen:false,acknowledged:false}));return;
 }
 if(process.argv.includes('--original-outcome-new')||process.argv.includes('--original-lifetime-new')){
  const outcome={schema:'custodial.console-original-outcome.v1',state:'PERSISTED_COMPLETED_TURN_ONLY',
   client_message_id:id,correlation_id:correlation,conversation_id:conversation,body:original.body,
   orderedattachment_ids:[...original.attachment_ids],created_at:original.created_at,
   created_at_policy:'LOCAL_DISPLAY_METADATA_NOT_SERVER_AUTHORITY',
   user_message_id:'66666666-6666-4666-8666-666666666666',assistant_message_id:'77777777-7777-4777-8777-777777777777',
   user_completed_at:'2026-10-13T02:03:05.000Z',assistant_completed_at:'2026-10-13T02:03:06.000Z'};
  function currentFixture(saved=copy(original),reply=copy(outcome)){
   const f=idbFixture([saved]),calls=[],statuses=[];
   let response=reply,session;
   const context=scope(f,{setStatus:(...args)=>statuses.push(args),fetch:async(url,options)=>{
    calls.push({url,options});return{ok:true,json:async()=>({ok:true,data:response})};
   }});
   session=context.state.session;
   loadFunction(context,'  async function headers(','  async function api(');
   loadFunction(context,'  function captureOriginalManager(','  async function sendCurrent(');
   loadFunction(context,'  async function resumeOutbox(','  async function readEventStream(');
   vm.runInContext('this.recover=recoverOriginalOutcome;this.resume=resumeOutbox;this.capture=captureOriginalManager;this.same=sameOriginalManager;',context);
   const drive=async status=>{let cursor=0;for(let step=0;step<60&&!status.done;step++){
    await tick();while(cursor<f.transactions.length){const tx=f.transactions[cursor++];tx.requestSuccess();await tick();if(!tx.aborted)tx.commit();await tick();}
   }assert.equal(status.done,true,'all actual IDB transactions must settle');return status;};
   return {f,context,calls,statuses,session,drive,setResponse:value=>{response=value;}};
  }
  if(process.argv.includes('--original-lifetime-new')){
   const observations=[],failures=[];
   const verify=(name,check)=>{try{check();cases.push(name);}catch(error){failures.push({case:name,message:error.message});}};
   const toRetirement=async x=>{
    const status=tracked(x.context.recover(copy(original),x.context.capture()));
    for(let index=0;index<2;index++){
     await tick();const tx=x.f.transactions[index];assert.ok(tx,'owning original read transaction exists');
     tx.requestSuccess();tx.commit();await tick();
    }
    await tick();assert.ok(x.f.transactions[2],'owning retirement transaction exists');
    return{status,tx:x.f.transactions[2]};
   };
   for(const [name,change] of [
    ['same-object device changed while delete request awaited',x=>{x.session.device_id='changed-fixture-device';}],
    ['same-object expiry changed while delete request awaited',x=>{x.session.expires_at='2000-01-01T00:00:00Z';}],
    ['conversation selection superseded while delete request awaited',x=>{x.context.state.selectedConversationGeneration++;}],
   ]){
    const x=currentFixture(),{status,tx}=await toRetirement(x);
    tx.requestSuccess(1);assert.equal(tx.requests[1]?.op,'delete');assert.equal(x.f.counts.delete,0);
    change(x);tx.requestSuccess(1);await tick();if(!tx.aborted)tx.commit();await tick();
    observations.push({case:name,status_error:status.error?.code||null,row_retained:x.f.rows.has(id),transaction_aborted:tx.aborted});
    verify(name,()=>{assert.equal(status.done,true);assert.ok(status.error);assert.deepEqual(x.f.rows.get(id),original);
     assert.equal(tx.aborted,true);assert.equal(x.calls.length,1);assert.equal(x.f.counts.opens,x.f.counts.closes);});
   }
   {
    const x=currentFixture(),{status,tx}=await toRetirement(x);
    tx.requestSuccess(1);tx.requestSuccess(1);await tick();assert.equal(status.done,false,'retirement awaits terminal commit');
    tx.commit();await tick();
    verify('same original owner retires exact row only on terminal commit',()=>{assert.equal(status.error,null);assert.equal(status.value,true);
     assert.equal(x.f.rows.has(id),false);assert.equal(x.calls.length,1);assert.equal(x.f.counts.opens,x.f.counts.closes);});
   }
   {
    const x=currentFixture(),binding=x.context.capture(),open=x.f.indexedDB.open;
    x.f.indexedDB.open=()=>{const request=open();queueMicrotask(()=>{x.session.device_id='changed-during-db-open';});return request;};
    const status=tracked(x.context.remove(copy(original),()=>x.context.same(binding)));await tick();
    observations.push({case:'owner changed across database-open await',error:status.error?.code||null,opens:x.f.counts.opens,closes:x.f.counts.closes});
    verify('owner loss across database-open await closes connection and retains original',()=>{assert.equal(status.done,true);
     assert.equal(status.error?.code,'gemini_original_manager_changed');assert.deepEqual(x.f.rows.get(id),original);
     assert.equal(x.f.transactions.length,0);assert.equal(x.f.counts.opens,x.f.counts.closes);});
   }
   console.log(JSON.stringify({status:failures.length?'GEMINI_ORIGINAL_LIFETIME_NEW_FAIL':'GEMINI_ORIGINAL_LIFETIME_NEW_PASS',cases,failures,observations,
    actual_function_VM:true,IDB_and_auth_synthetic:true,SQL:false,provider:false,browser:false}));
   assert.equal(failures.length,0,'new original retirement lifetime cases');return;
  }
  {
   const x=currentFixture(),status=await x.drive(tracked(x.context.recover(copy(original),x.context.capture())));
   assert.equal(status.error,null);assert.equal(status.value,true);assert.equal(x.calls.length,1);
   assert.equal(x.calls[0].options.method,'POST');assert.match(x.calls[0].url,/\/messages\/original-outcome$/);
   assert.deepEqual(JSON.parse(x.calls[0].options.body),{client_message_id:id,correlation_id:correlation,conversation_id:conversation,
    body:original.body,orderedattachment_ids:original.attachment_ids,created_at:original.created_at});
   assert.equal(x.f.rows.has(id),false);assert.equal(x.f.counts.delete,1);assert.equal(x.f.counts.opens,x.f.counts.closes);
   cases.push('exact persisted pair reconciles only original raw row after one read-only status POST');
  }
  for(const [name,mutation] of [
   ['unknown',value=>({schema:value.schema,state:'UNCONFIRMED_ORIGINAL_RETAINED'})],
   ['wrong body',value=>({...value,body:'other'})],
   ['ordered attachments',value=>({...value,orderedattachment_ids:[...value.orderedattachment_ids].reverse()})],
   ['wrong conversation',value=>({...value,conversation_id:id})],
   ['legacy extra',value=>({...value,extra:'legacy'})],
   ['invalid completed date',value=>({...value,assistant_completed_at:'2026-02-31T02:03:06Z'})],
   ['wrong local-time policy',value=>({...value,created_at_policy:'SERVER_ACCEPTED'})]
  ]){
   const x=currentFixture(copy(original),mutation(copy(outcome)));
   const status=await x.drive(tracked(x.context.recover(copy(original),x.context.capture())));
   assert.equal(status.value,false,name);assert.equal(x.f.counts.delete,0,name);assert.deepEqual(x.f.rows.get(id),original,name);
   assert.equal(x.calls.length,1,name);cases.push(`${name} retains original`);
  }
  {
   const x=currentFixture({...original,extra:'legacy'}),status=await x.drive(tracked(x.context.recover({...original,extra:'legacy'},x.context.capture())));
   assert.ok(status.error);assert.equal(x.calls.length,0);assert.equal(x.f.counts.delete,0);
   cases.push('legacy saved extra field never queries or deletes');
  }
  {
   const x=currentFixture(),status=tracked(x.context.recover(copy(original),x.context.capture()));
   await tick();x.f.transactions[0].requestSuccess();x.session.permissions.owner=false;x.f.transactions[0].commit();await tick();
   const settled=await x.drive(status);assert.equal(settled.error?.code,'gemini_original_manager_changed');
   assert.equal(x.calls.length,0);assert.equal(x.f.counts.delete,0);cases.push('permission lost across saved-row await refuses transport');
  }
  {
   const x=currentFixture(),status=tracked(x.context.recover(copy(original),x.context.capture()));
   await tick();x.f.transactions[0].requestSuccess();
   // Session may return to the same conversation object; generation still
   // marks the intervening selection change and forbids a late publication.
   x.context.state.selectedConversationGeneration++;x.f.transactions[0].commit();await tick();
   const settled=await x.drive(status);assert.equal(settled.error?.code,'gemini_original_manager_changed');
   assert.equal(x.calls.length,0);cases.push('conversation generation ABA refuses late query');
  }
  {
   const x=currentFixture(),status=tracked(x.context.recover(copy(original),x.context.capture()));
   await tick();x.f.transactions[0].requestSuccess();x.f.transactions[0].commit();await tick();
   // A competing tab changes the exact raw original while the status read is pending.
   x.f.rows.set(id,{...original,body:'newer local source'});
   const settled=await x.drive(status);assert.ok(settled.error);assert.equal(x.f.counts.delete,0);
   assert.equal(x.f.rows.get(id).body,'newer local source');cases.push('raw stored CAS refuses changed original');
  }
  {
   const x=currentFixture();x.context.fetch=async(url,options)=>{x.calls.push({url,options});return{ok:true,json:async()=>{
    x.f.rows.set(id,{...original,body:'changed while status response arrived'});return{ok:true,data:copy(outcome)};
   }};};
   const status=await x.drive(tracked(x.context.recover(copy(original),x.context.capture())));
   assert.ok(status.error);assert.equal(x.calls.length,1);assert.equal(x.f.counts.delete,0);
   assert.equal(x.f.rows.get(id).body,'changed while status response arrived');
   cases.push('response-time raw storage replacement cannot be deleted');
  }
  {
   const x=currentFixture();x.context.fetch=async(url,options)=>{x.calls.push({url,options});return{ok:true,json:async()=>{
    x.session.token='rotated while status response arrived';return{ok:true,data:copy(outcome)};
   }};};
   const status=await x.drive(tracked(x.context.recover(copy(original),x.context.capture())));
   assert.equal(status.error?.code,'gemini_original_manager_changed');assert.equal(x.f.counts.delete,0);
   assert.deepEqual(x.f.rows.get(id),original);cases.push('changed original manager after reply retains saved row');
  }
  {
   const x=currentFixture();x.context.fetch=async(url,options)=>{x.calls.push({url,options});throw Error('status timeout');};
   const status=await x.drive(tracked(x.context.resume()));
   assert.equal(status.error,null);assert.deepEqual(x.f.rows.get(id),original);assert.equal(x.f.counts.delete,0);
   assert.equal(x.calls.length,1);cases.push('status transport timeout retains original without redispatch');
  }
  {
   const x=currentFixture(),status=await x.drive(tracked(x.context.resume()));
   assert.equal(status.error,null);assert.equal(x.calls.length,1);assert.equal(x.f.rows.has(id),false);
   assert.equal(x.calls.filter(call=>/\/stream/.test(call.url)).length,0);
   cases.push('resume only queries exact status and never redispatches');
  }
  console.log(JSON.stringify({status:'GEMINI_ORIGINAL_OUTCOME_NEW_SOURCE_CASES_PASS',cases,
   actual_function_VM:true,IDB_and_auth_synthetic:true,SQL:false,provider:false,browser:false}));
  return;
 }
 if(process.argv.includes('--workflow-race-new')){
  const manager={role:'ops_manager',manager_id:'fixture-manager',credential_id:'fixture-credential',device_id:'fixture-device',token:'fixture-only-not-a-credential',
   expires_at:'2099-01-01T00:00:00Z',access_level:'full_access',read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}};
  const itemA={conversation_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'A',draft_text:'A draft'},itemB={conversation_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',title:'B',draft_text:'B draft'};
  const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
  function pageContext({fetchImpl=async()=>({ok:true,json:async()=>({ok:true,data:[]})}),prompt=()=> 'renamed A',confirm=()=>true,authHeaders=async()=>({Authorization:`Bearer ${manager.token}`,'X-Device-Id':manager.device_id}),current=()=>manager}={}){
   const context=scope(idbFixture(),{autoSize:()=>{},renderAttachments:()=>{},renderConversations:()=>{},renderTranscript:()=>{},renderRepairCards:()=>{},setStatus:()=>{},scrollBottom:()=>{},
    fetch:fetchImpl,window:{prompt,confirm,MemphisAuth:{readSession:current,opsManagerAuthHeaders:authHeaders}}});
   context.el.title={textContent:''};context.el.sidebar={classList:{remove(){}}};context.el.attachmentList={replaceChildren(){},append(){}};
   context.state.session=current();context.state.conversations=[itemA,itemB];context.state.conversation=itemA;
   loadFunction(context,'  async function headers(','  async function api(');
   loadFunction(context,'  async function selectConversation(','  async function renameConversation(');
   loadFunction(context,'  async function renameConversation(','  async function deleteConversation(');
   loadFunction(context,'  async function deleteConversation(','  async function search(');
   loadFunction(context,'  function captureManagerIdentity(','  function captureOriginalManager(');
   loadFunction(context,'  async function addFiles(','  function renderAttachments(');
   loadFunction(context,'  async function removeAttachment(','  function captureManagerIdentity(');
   return context;
  }
  let navigationSafe=false;
  {
   const f=idbFixture(),requests=[],gates=new Map(),context=scope(f,{autoSize:()=>{},renderAttachments:()=>{},renderConversations:()=>{},renderTranscript:()=>{},renderRepairCards:()=>{},setStatus:()=>{},scrollBottom:()=>{},
    window:{MemphisAuth:{readSession:()=>manager,opsManagerAuthHeaders:async()=>({Authorization:`Bearer ${manager.token}`,'X-Device-Id':manager.device_id})}},
    fetch:url=>{const path=url.replace('fixture://gemini','');requests.push(path);const d=deferred();gates.set(path,d);return d.promise;}});
   context.el.title={textContent:''};context.el.sidebar={classList:{remove(){}}};
   context.state.session=manager;context.state.conversations=[itemA,itemB];context.state.conversation=itemA;
   loadFunction(context,'  async function headers(','  async function api(');loadFunction(context,'  async function selectConversation(','  async function renameConversation(');
   loadFunction(context,'  function captureManagerIdentity(','  function captureOriginalManager(');
   const a=tracked(context.selectConversation(itemA.conversation_id));await tick();const b=tracked(context.selectConversation(itemB.conversation_id));await tick();
   for(const path of requests.filter(x=>x.includes(itemB.conversation_id)))gates.get(path).resolve({ok:true,json:async()=>({ok:true,data:path.includes('/messages?')?[{conversation_id:itemB.conversation_id,role:'assistant',body:'B'}]:{proposals:[],jobs:[]}})});
   await tick();await tick();await tick();
   for(const path of requests.filter(x=>x.includes(itemA.conversation_id)))gates.get(path).resolve({ok:true,json:async()=>({ok:true,data:path.includes('/messages?')?[{conversation_id:itemA.conversation_id,role:'assistant',body:'A'}]:{proposals:[],jobs:[]}})});
   await tick();await tick();await tick();console.log(JSON.stringify({case:'A/B selection responses reverse order',requests,errors:[a.error?.message,b.error?.message],selected:context.state.conversation.conversation_id,messages:context.state.messages.map(m=>m.body)}));
   navigationSafe=context.state.conversation.conversation_id===itemB.conversation_id&&context.state.messages[0]?.body==='B'&&a.error===null&&b.error===null;
  }
  {
   const f=idbFixture(),read=deferred(),requests=[],uploads=[],context=scope(f,{uuid:()=>`local-${requests.length}`,btoa:value=>Buffer.from(value,'binary').toString('base64'),renderAttachments:()=>{},renderConversations:()=>{},renderTranscript:()=>{},renderRepairCards:()=>{},autoSize:()=>{},scrollBottom:()=>{},setStatus:()=>{},
    window:{MemphisAuth:{readSession:()=>manager,opsManagerAuthHeaders:async()=>({Authorization:`Bearer ${manager.token}`,'X-Device-Id':manager.device_id})}},
    fetch:async(url,options)=>{const path=url.replace('fixture://gemini','');requests.push(path);if(path.endsWith('/attachments'))uploads.push(JSON.parse(options.body));return{ok:true,json:async()=>({ok:true,data:path.endsWith('/attachments')?{attachment_id:'fixture-upload-response'}:path.includes('/messages?')?[]:path.endsWith('/repair-state')?{proposals:[],jobs:[]}:{}})};}});
   context.el.attachmentList={replaceChildren(){},append(){}};
   context.el.title={textContent:''};context.el.sidebar={classList:{remove(){}}};
   context.state.session=manager;context.state.conversation=itemA;context.state.conversations=[itemA,itemB];
   loadFunction(context,'  function fileBase64(','  function mimeFallback(');
   loadFunction(context,'  async function headers(','  async function api(');loadFunction(context,'  async function selectConversation(','  async function renameConversation(');loadFunction(context,'  function captureManagerIdentity(','  function captureOriginalManager(');
   loadFunction(context,'  async function addFiles(','  function renderAttachments(');
   const file={name:'original.txt',size:3,type:'text/plain',arrayBuffer:()=>read.promise};const pending=tracked(context.addFiles([file]));await tick();
   await context.selectConversation(itemB.conversation_id);read.resolve(Uint8Array.from([65,66,67]).buffer);await tick();await tick();await pending.promise;
   const uploadSafe=requests.every(path=>!path.endsWith('/attachments'))&&context.state.conversation===itemB&&context.state.attachments.length===0&&uploads.length===0;
   console.log(JSON.stringify({case:'A file read completes after actual B selection',attachment_uploads:requests.filter(path=>path.endsWith('/attachments')),selected:context.state.conversation.conversation_id}));
   assert.ok(navigationSafe&&uploadSafe,'old navigation replaced current transcript and/or file followed newer selected conversation');
  }
  {
   let context,switching;const calls=[];context=pageContext({prompt:()=>{switching=context.selectConversation(itemB.conversation_id);return'Renamed A';},fetchImpl:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({ok:true,data:[]})};}});
   const rename=tracked(context.renameConversation());await switching;await tick();
   const renameSafe=rename.error&&calls.every(call=>!call.url.endsWith(`/${itemA.conversation_id}`))&&context.state.conversation===itemB;
   console.log(JSON.stringify({case:'rename prompt reenters navigation',rename_sent:calls.some(call=>call.options?.method==='PATCH'),selected:context.state.conversation.conversation_id}));
   assert.ok(renameSafe,'rename submitted after its original conversation was replaced');
  }
  {
   let context,switching;const calls=[];context=pageContext({confirm:()=>{switching=context.selectConversation(itemB.conversation_id);return true;},fetchImpl:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({ok:true,data:[]})};}});
   const removal=tracked(context.deleteConversation());await switching;await tick();
   const deleteSafe=removal.error&&calls.every(call=>!call.url.endsWith(`/${itemA.conversation_id}`))&&context.state.conversation===itemB;
   console.log(JSON.stringify({case:'delete confirmation reenters navigation',delete_sent:calls.some(call=>call.options?.method==='DELETE'),selected:context.state.conversation.conversation_id}));
   assert.ok(deleteSafe,'delete submitted or cleared UI after its original conversation was replaced');
  }
  {
   const header=deferred(),calls=[],managerB={...manager,manager_id:'successor-manager',credential_id:'successor-credential',device_id:'successor-device',token:'synthetic-successor'};let current=manager;
   const context=pageContext({current:()=>current,authHeaders:async()=>{await header.promise;return{Authorization:`Bearer ${current.token}`,'X-Device-Id':current.device_id};},fetchImpl:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({ok:true,data:{conversation_id:itemA.conversation_id,title:'renamed'}})};}});
   const rename=tracked(context.renameConversation());await tick();current=managerB;context.state.session=managerB;header.resolve();await tick();await tick();
   const sessionSafe=rename.error&&calls.length===0&&context.state.conversation===itemA;
   console.log(JSON.stringify({case:'manager changes while rename headers await',fetches:calls.length,denied:Boolean(rename.error)}));
   assert.ok(sessionSafe,'rename crossed an awaited header boundary into a successor manager session');
  }
  {
   const removalReply=deferred(),calls=[],context=pageContext({fetchImpl:(url,options)=>{calls.push({url,options});return options.method==='DELETE'?removalReply.promise:Promise.resolve({ok:true,json:async()=>({ok:true,data:url.includes('/messages?')?[]:{proposals:[],jobs:[]}})});}});
   const old={localId:'A-file',attachment_id:'attachment-A',status:'ready',conversation_id:itemA.conversation_id};context.state.attachments=[old];
   const removal=tracked(context.removeAttachment(old));await tick();await context.selectConversation(itemB.conversation_id);
   const successor={localId:'B-file',attachment_id:'attachment-B',status:'ready',conversation_id:itemB.conversation_id};context.state.attachments=[successor];
   removalReply.resolve({ok:true,json:async()=>({ok:true,data:{}})});await tick();await tick();
   const attachmentSafe=removal.error&&context.state.attachments.length===1&&context.state.attachments[0]===successor;
   console.log(JSON.stringify({case:'late A attachment removal after B selection',selected:context.state.conversation.conversation_id,visible_attachment:context.state.attachments[0]?.attachment_id}));
   assert.ok(attachmentSafe,'late removal response changed the newer conversation attachment list');
  }
  {
   const deleteReply=deferred(),calls=[],context=pageContext({fetchImpl:(url,options)=>{calls.push({url,options});return options.method==='DELETE'?deleteReply.promise:Promise.resolve({ok:true,json:async()=>({ok:true,data:url.includes('/messages?')?[]:{proposals:[],jobs:[]}})});}});
   const deletion=tracked(context.deleteConversation());await tick();await context.selectConversation(itemB.conversation_id);
   deleteReply.resolve({ok:true,json:async()=>({ok:true,data:{}})});await tick();await tick();
   const deleteResponseSafe=deletion.error&&calls.some(call=>call.url.endsWith(`/${itemA.conversation_id}`))&&context.state.conversation===itemB;
   console.log(JSON.stringify({case:'late A delete response after B selection',selected:context.state.conversation.conversation_id,delete_target:calls.find(call=>call.options.method==='DELETE')?.url}));
   assert.ok(deleteResponseSafe,'late delete completion cleared the newer selection');
  }
  return;
 }
 if(process.argv.includes('--session-bound-new')){
  const full=(manager,credential,device,token)=>({role:'ops_manager',manager_id:manager,credential_id:credential,device_id:device,token,
   expires_at:'2099-01-01T00:00:00Z',access_level:'full_access',read_only:false,
   permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}});
  function page(f,{deferHeaders=false,deferResponse=false,deferRefresh=false,streamOpen=false,headerOverride=null,frames=''}={}){
   const first=full('manager-A','credential-A','device-A','synthetic-A'),second=full('manager-B','credential-B','device-B','synthetic-B');
   const calls=[],statuses=[],ids=[id,correlation],assistant={message:{body:''},text:{},meta:{},node:{classList:{add(){}}}};
   let current=first,releaseHeaders=()=>{},releaseResponse=()=>{},releaseRefresh=()=>{},streamController=null;
   const headerGate=deferHeaders?new Promise(resolve=>{releaseHeaders=resolve;}):Promise.resolve();
   const responseGate=deferResponse?new Promise(resolve=>{releaseResponse=resolve;}):Promise.resolve();
   const refreshGate=deferRefresh?new Promise(resolve=>{releaseRefresh=resolve;}):Promise.resolve();
   const context=scope(f,{API:'fixture://gemini',uuid:()=>ids.shift(),appendAssistantStream:()=>assistant,
    setStatus:text=>statuses.push(text),lock:()=>statuses.push('locked'),toggleBusy:()=>{},renderAttachments:()=>{},renderTranscript:()=>{},scheduleDraftSave:()=>{},scrollBottom:()=>{},
    loadConversations:async()=>{},refreshMessages:async()=>{},refreshRepairState:async()=>{},formatTime:()=>'',
    window:{MemphisAuth:{readSession:()=>current,opsManagerAuthHeaders:async()=>{await headerGate;return headerOverride?.(current)||{Authorization:`Bearer ${current.token}`,'X-Device-Id':current.device_id};}}},
    fetch:async(url,options)=>{calls.push({url,options});if(url.endsWith('/conversations?limit=100')){await refreshGate;return{ok:true,json:async()=>({ok:true,data:[{conversation_id:conversation,title:'successor list'}]})};}
     await responseGate;return{ok:true,body:new ReadableStream({start(c){streamController=c;if(frames)c.enqueue(new TextEncoder().encode(frames));if(!streamOpen)c.close();}})};}});
   context.state.session=first;context.el.input.value=original.body;
   loadFunction(context,'  async function headers(','  async function api(');
   loadFunction(context,'  async function readEventStream(','  function db()');
   loadFunction(context,'  async function sendCurrent(','  async function streamRecord(');
   loadFunction(context,'  async function streamRecord(','  async function retryMessage(');
   loadFunction(context,'  function stopResponse()','  function toggleBusy(');
   return{first,second,context,calls,statuses,assistant,releaseHeaders:()=>releaseHeaders(),releaseResponse:()=>releaseResponse(),
    releaseRefresh:()=>releaseRefresh(),setCurrent:session=>{current=session;},pushFrame:frame=>streamController.enqueue(new TextEncoder().encode(frame)),closeStream:()=>streamController.close()};
  }
  const commit=async(f,index)=>{const tx=f.transactions[index];assert.ok(tx);tx.requestSuccess();tx.commit();await tick();};
  {
   const f=idbFixture(),p=page(f,{frames:'event: message\ndata: {"body":"Original manager response","state":"completed"}\n\n'}),running=tracked(p.context.sendCurrent());
   await tick();await commit(f,0);assert.equal(p.calls.length,0);await commit(f,1);await tick();
   assert.equal(running.error,null);assert.equal(p.calls.length,1);assert.equal(p.calls[0].options.headers.Authorization,`Bearer ${p.first.token}`);
   assert.equal(p.calls[0].options.headers['X-Device-Id'],p.first.device_id);assert.equal(p.calls[0].options.body&&JSON.parse(p.calls[0].options.body).body,original.body);
   assert.equal(p.assistant.text.textContent,'Original manager response');assert.equal(f.rows.get(id).state,'dispatch_attempted');assert.ok(p.statuses.some(s=>/unconfirmed/.test(s)));
   assert.equal(f.counts.opens,f.counts.closes);cases.push('same original full manager, committed intent and attempt, and matching awaited headers publish assistant response');
  }
  {
   const f=idbFixture(),p=page(f),running=tracked(p.context.sendCurrent());await tick();p.setCurrent(p.second);await commit(f,0);
   assert.equal(running.error,null);assert.equal(f.transactions.length,1);assert.equal(f.rows.get(id).state,'queued');assert.equal(p.calls.length,0);
   assert.equal(p.context.el.input.value,original.body);assert.ok(p.statuses.includes('locked'));assert.equal(f.counts.opens,f.counts.closes);
   cases.push('manager changed during saved original transaction leaves queued row and input held');
  }
  {
   const f=idbFixture(),p=page(f),running=tracked(p.context.sendCurrent());await tick();await commit(f,0);p.setCurrent(p.second);await commit(f,1);
   assert.equal(running.error,null);assert.equal(f.rows.get(id).state,'dispatch_attempted');assert.equal(p.calls.length,0);assert.ok(p.statuses.includes('locked'));
   assert.equal(f.counts.opens,f.counts.closes);cases.push('manager changed during dispatch admission leaves original attempt held without fetch');
  }
  {
   const f=idbFixture(),p=page(f,{deferHeaders:true}),running=tracked(p.context.sendCurrent());await tick();await commit(f,0);await commit(f,1);
   const owned=p.context.state.abort;assert.ok(owned);p.setCurrent(p.second);p.releaseHeaders();await tick();
   assert.equal(running.error,null);assert.equal(p.calls.length,0,'new manager cannot inherit original POST');assert.equal(owned.signal.aborted,true);
   assert.equal(f.rows.get(id).state,'dispatch_attempted');assert.ok(p.statuses.includes('locked'));assert.equal(f.counts.opens,f.counts.closes);
   cases.push('manager and credential changed during normal header acquisition abort only owned stream');
  }
  {
   for(const change of [p=>{p.first.permissions.owner=false;},p=>{p.first.permissions.read=false;},p=>{p.first.permissions.schema='other';},
    p=>{p.first.read_only=true;p.first.access_level='read_only';},p=>{p.first.expires_at='2020-01-01T00:00:00Z';},
    p=>{p.first.device_id='device-B';},p=>{p.first.credential_id='credential-B';},p=>{p.first.token='other-synthetic';},
    p=>{p.context.state.session={...p.first};},p=>p.setCurrent({...p.first})]){
    const f=idbFixture(),p=page(f,{deferHeaders:true}),running=tracked(p.context.sendCurrent());await tick();await commit(f,0);await commit(f,1);
    change(p);p.releaseHeaders();await tick();assert.equal(running.error,null);assert.equal(p.calls.length,0);assert.equal(f.rows.get(id).state,'dispatch_attempted');
    assert.equal(f.counts.opens,f.counts.closes);
   }cases.push('permissions, expiry, token, credential, device, read-only and reentrant session changes fail closed');
  }
  {
   const f=idbFixture(),p=page(f,{headerOverride:current=>({Authorization:'Bearer DIFFERENT_SYNTHETIC','X-Device-Id':current.device_id})}),running=tracked(p.context.sendCurrent());
   await tick();await commit(f,0);await commit(f,1);assert.equal(running.error,null);assert.equal(p.calls.length,0);assert.equal(f.rows.get(id).state,'dispatch_attempted');
   assert.equal(f.counts.opens,f.counts.closes);cases.push('normal auth header mismatch refuses original POST despite unchanged page session');
  }
  {
   const f=idbFixture(),p=page(f,{deferResponse:true}),running=tracked(p.context.sendCurrent());await tick();await commit(f,0);await commit(f,1);await tick();
   assert.equal(p.calls.length,1);const owned=p.context.state.abort;p.setCurrent(p.second);p.releaseResponse();await tick();
   assert.equal(running.error,null);assert.equal(owned.signal.aborted,true);assert.equal(p.assistant.text.textContent,undefined);
   assert.equal(f.rows.get(id).state,'dispatch_attempted');assert.ok(p.statuses.includes('locked'));assert.equal(f.counts.opens,f.counts.closes);
   cases.push('successor during awaited HTTP response suppresses former manager publication and aborts owned transport');
  }
  {
   const f=idbFixture(),p=page(f,{streamOpen:true,frames:'event: delta\ndata: {"text":"old only"}\n\n'}),running=tracked(p.context.sendCurrent());
   await tick();await commit(f,0);await commit(f,1);await tick();assert.equal(p.assistant.text.textContent,'old only');const owned=p.context.state.abort;
   p.setCurrent(p.second);p.pushFrame('event: delta\ndata: {"text":"should not publish"}\n\n');p.closeStream();await tick();
   assert.equal(running.error,null);assert.equal(owned.signal.aborted,true);assert.equal(p.assistant.text.textContent,'old only');
   assert.equal(f.rows.get(id).state,'dispatch_attempted');assert.ok(p.statuses.includes('locked'));assert.equal(f.counts.opens,f.counts.closes);
   cases.push('changed manager between stream frames cannot publish later delta into successor UI');
  }
  {
   const f=idbFixture(),p=page(f,{deferRefresh:true}),running=tracked(p.context.sendCurrent());
   let renders=0;p.context.renderConversations=()=>{renders++;};
   loadFunction(p.context,'  async function api(','  async function loadConversations(');
   loadFunction(p.context,'  async function loadConversations(','  function renderConversations(');
   await tick();await commit(f,0);await commit(f,1);for(let i=0;i<5&&p.calls.length<2;i++)await tick();
   assert.equal(p.calls.length,2,'stream and current conversation refresh must be pending');p.setCurrent(p.second);p.releaseRefresh();await tick();
   assert.equal(running.error,null);assert.equal(renders,0);assert.equal(p.context.state.conversations.length,1);
   assert.equal(p.context.state.conversations[0].title,undefined);assert.equal(f.rows.get(id).state,'dispatch_attempted');
   assert.ok(p.statuses.includes('locked'));assert.equal(f.counts.opens,f.counts.closes);
   cases.push('poststream delayed conversation read checks original manager before repaint');
  }
  {
   const f=idbFixture(),p=page(f,{streamOpen:true}),running=tracked(p.context.sendCurrent());await tick();await commit(f,0);await commit(f,1);await tick();
   const owned=p.context.state.abort;p.context.state.userMessageId='fixture-message';p.setCurrent(p.second);p.context.stopResponse();
   assert.equal(owned.signal.aborted,true);assert.equal(p.calls.length,1,'successor cannot issue former manager server cancel');
   p.closeStream();await tick();assert.equal(running.error,null);assert.equal(f.rows.get(id).state,'dispatch_attempted');
   cases.push('stop after identity change aborts owned stream without successor server cancellation');
  }
  {
   const f=idbFixture(),p=page(f);p.first.permissions.owner=false;
   const running=tracked(p.context.sendCurrent());await tick();assert.equal(running.error.code,'gemini_original_manager_changed');
   assert.equal(f.transactions.length,0);assert.equal(p.calls.length,0);cases.push('read-only manager cannot launch original request');
  }
  console.log(JSON.stringify({status:'GEMINI_ORIGINAL_MANAGER_SESSION_NEW_PASS',groups:cases.length,cases,actual_source_functions:true,synthetic_IDB_auth_stream:true,real_manager:false,provider:false,browser:false,SQL:false}));return;
 }
 if(process.argv.includes('--dispatch-once-new')){
  function page(f,frames=''){
   const calls=[],statuses=[],assistant={message:{body:''},text:{},meta:{},node:{classList:{add(){}}}},ids=[id,correlation];
   const context=scope(f,{API:'https://memphis-zoo-mcp.onrender.com/gemini-api',uuid:()=>ids.shift(),appendAssistantStream:()=>assistant,setStatus:text=>statuses.push(text),scrollBottom:()=>{},appendCard:()=>{},
    renderAttachments:()=>{},renderTranscript:()=>{},scheduleDraftSave:()=>{},showError:error=>statuses.push(error.message),
    loadConversations:async()=>{},refreshMessages:async()=>{},refreshRepairState:async()=>{},formatTime:()=>'',selectConversation:async()=>{throw Error('recovery must not select/resend');},
    fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(frames));c.close();}})};}});
   loadFunction(context,'  async function headers(','  async function api(');
   loadFunction(context,'  async function readEventStream(','  function db()');
   loadFunction(context,'  async function sendCurrent(','  async function streamRecord(');
   loadFunction(context,'  async function streamRecord(','  async function retryMessage(');
   loadFunction(context,'  async function retryMessage(','  async function refreshMessages(');
   loadFunction(context,'  async function resumeOutbox()','  async function readEventStream(');
   context.el.input.value=original.body;context.state.attachments=original.attachment_ids.map(attachment_id=>({attachment_id,status:'ready'}));
   return {context,calls,statuses,assistant};
  }
  {
   const f=idbFixture(),p=page(f,'event: message\ndata: {"body":"Saved assistant response","state":"completed"}\n\n');
   const work=tracked(p.context.sendCurrent());await tick();const save=f.transactions[0];save.requestSuccess();await tick();assert.equal(p.calls.length,0);save.commit();await tick();
   const admission=f.transactions[1];assert.ok(admission);admission.requestSuccess();await tick();assert.equal(p.calls.length,0);assert.equal(f.rows.get(id).state,'queued');
   admission.commit();await tick();assert.equal(work.error,null);assert.equal(p.calls.length,1);assert.equal(f.rows.get(id).state,'dispatch_attempted');
   const wire=p.calls[0].body;assert.equal(wire.state,'queued');assert.deepEqual(wire.attachment_ids,original.attachment_ids);assert.equal(wire.created_at,f.rows.get(id).created_at);
   assert.equal(p.assistant.text.textContent,'Saved assistant response');assert.equal(p.assistant.message.state,'completed');assert.ok(p.statuses.some(s=>/unconfirmed/.test(s)));
   await p.context.streamRecord(wire);assert.equal(p.calls.length,1,'plain snapshot cannot recreate dispatch admission');
   const reload=page(f),recovery=await execute(f,reload.context.resumeOutbox());assert.equal(recovery.error,null);assert.equal(reload.calls.length,0);
   assert.deepEqual(f.rows.get(id),{...wire,state:'dispatch_attempted'});assert.equal(f.counts.opens,f.counts.closes);cases.push('fresh user dispatch only after terminal durable attempt; assistant visible; restart held');
  }
  {
   const f=idbFixture(),p=page(f),work=tracked(p.context.sendCurrent());await tick();f.transactions[0].requestSuccess();f.transactions[0].commit();await tick();
   const admission=f.transactions[1];admission.requestSuccess();await tick();assert.equal(p.calls.length,0);const failure=Error('attempt transaction aborted');admission.fail(failure);await tick();
   assert.equal(work.error,failure);assert.equal(p.calls.length,0);assert.equal(f.rows.get(id).state,'queued');
   const retained=copy(f.rows.get(id));await p.context.sendCurrent(retained);assert.equal(p.calls.length,0);assert.equal(f.transactions.length,2);
   const recovery=await execute(f,p.context.resumeOutbox());assert.equal(recovery.error,null);assert.deepEqual(f.rows.get(id),retained);assert.equal(f.counts.opens,f.counts.closes);
   cases.push('attempt success-before-abort never dispatches; retained queued cannot retry');
  }
  {
   for(const state of ['queued','dispatch_attempted','retained_unknown']){
    const row={...original,state,unknown_extra:'preserve'},f=idbFixture([row]),p=page(f);
    const recovery=await execute(f,p.context.resumeOutbox());assert.equal(recovery.error,null);assert.equal(p.calls.length,0);
    const retry=await execute(f,p.context.retryMessage({client_message_id:id}));assert.equal(retry.error,null);assert.equal(p.calls.length,0);assert.deepEqual(f.rows.get(id),row);
    assert.ok(p.statuses.some(s=>/unconfirmed/.test(s)));assert.equal(f.counts.put+f.counts.add+f.counts.delete,0);assert.equal(f.counts.opens,f.counts.closes);
   }cases.push('legacy listed queued/attempted/unknown rows held across resume and manual retry unchanged');
  }
  {
   const f=idbFixture([],true),first=page(f),second=page(f),a=tracked(first.context.put(copy(original))),b=tracked(second.context.put(copy(original)));await tick();
   f.transactions[0].requestSuccess();f.transactions[0].commit();await tick();f.transactions[1].requestSuccess();f.transactions[1].commit();await tick();assert.equal(a.error,null);assert.equal(b.error,null);
   const denied=tracked(second.context.admit(b.value));await tick();assert.equal(denied.error.code,'gemini_outbox_dispatch_held');
   const admitted=await execute(f,first.context.admit(a.value));assert.equal(admitted.error,null);await first.context.streamRecord(a.value);await first.context.streamRecord(a.value);
   await second.context.streamRecord(b.value);assert.equal(first.calls.length,1);assert.equal(second.calls.length,0);assert.equal(f.counts.add,1);assert.equal(f.counts.put,1);
   assert.equal(f.rows.get(id).state,'dispatch_attempted');assert.equal(f.counts.opens,f.counts.closes);cases.push('serialized competing tabs only new creator receives single-use dispatch');
  }
  {
   for(const change of [r=>r.body+=' changed',r=>r.correlation_id=id,r=>r.conversation_id=id,r=>r.attachment_ids.reverse(),r=>r.created_at+=' changed',r=>r.state='dispatch_attempted',r=>r.extra='unknown']){
    const f=idbFixture(),p=page(f),created=await execute(f,p.context.put(copy(original)));assert.equal(created.error,null);const changed=copy(f.rows.get(id));change(changed);f.rows.set(id,changed);
    const claim=await execute(f,p.context.admit(created.value));assert.ok(claim.error);await p.context.streamRecord(created.value);assert.equal(p.calls.length,0);assert.deepEqual(f.rows.get(id),changed);
    const again=tracked(p.context.admit(created.value));await tick();assert.equal(again.error.code,'gemini_outbox_dispatch_held');assert.equal(f.counts.put,0);assert.equal(f.counts.opens,f.counts.closes);
   }cases.push('stale original/foreign attempt/unknown fields refuse CAS and never dispatch or overwrite');
  }
  console.log(JSON.stringify({status:'GEMINI_DISPATCH_ONCE_NEW_PASS',groups:cases.length,cases,actual_source_functions:true,IDB_event_fixture:true,transport_mock_only:true,real_manager:false,provider:false,browser:false,SQL:false}));return;
 }
 if(process.argv.includes('--terminal-abort-new')){
  const f=idbFixture([original]),context=scope(f),changed={...original,body:'conflicting body'};
  const pending=tracked(context.put(changed));await tick();const tx=f.transactions[0];
  tx.abort=()=>{throw Error('terminal event already queued');};tx.requestSuccess();await tick();
  assert.equal(pending.done,false);assert.equal(f.counts.closes,0);assert.deepEqual(f.rows.get(id),original);
  tx.commit();await tick();assert.equal(pending.error.code,'gemini_outbox_original_conflict');assert.deepEqual(f.rows.get(id),original);
  assert.equal(f.counts.opens,f.counts.closes);
  console.log(JSON.stringify({status:'GEMINI_OUTBOX_TERMINAL_ABORT_NEW_PASS',groups:1,actual_function_VM:true,terminal_event_required:true,provider:false,browser:false}));return;
 }
 // Baseline reproducer runs only this changed owning sequence, not historical assertions.
 {
  const f=idbFixture(),calls=[],ids=[id,correlation];const context=scope(f,{streamRecord:async record=>calls.push(copy(record)),uuid:()=>ids.shift(),renderAttachments:()=>{},renderTranscript:()=>{},scheduleDraftSave:()=>{}});context.el.input.value=original.body;
  loadFunction(context,'  async function sendCurrent(','  async function streamRecord(');
  const pending=tracked(context.sendCurrent());await tick();const tx=f.transactions[0];tx.requestSuccess();await tick();
  console.log(JSON.stringify({case:'success-before-abort',provider_calls_before_commit:calls.length,put_resolved_before_commit:pending.done,source_VM:true}));
  const abortError=Error('transaction aborted after successful request');tx.fail(abortError);await tick();
  assert.equal(calls.length,0,'provider must not start before durable transaction completion');assert.equal(pending.error,abortError);
  assert.equal(f.rows.size,0);assert.equal(f.counts.opens,f.counts.closes);cases.push('request success then abort prevents stream');
 }
 {
  const f=idbFixture(),context=scope(f),pending=tracked(context.put(copy(original)));await tick();const tx=f.transactions[0];tx.requestSuccess();await tick();
  assert.equal(pending.done,false,'put waits for terminal commit');assert.equal(f.rows.size,0);assert.equal(f.counts.closes,0);
  tx.commit();await tick();assert.equal(pending.error,null);assert.deepEqual(f.rows.get(id),original);assert.equal(f.counts.opens,f.counts.closes);
  const read=tracked(context.all());await tick();const readTx=f.transactions.at(-1);readTx.requestSuccess();await tick();assert.equal(read.done,false);readTx.commit();await tick();
  assert.deepEqual(copy(read.value),[original]);assert.equal(f.counts.opens,f.counts.closes);cases.push('put and read complete only on commit');
 }
 {
  const f=idbFixture(),context=scope(f),pending=tracked(context.put(copy(original)));await tick();const tx=f.transactions[0],requestError=Error('original request failure'),abortError=Error('later transaction abort');
  tx.requestFailure(requestError);await tick();assert.equal(pending.done,false,'request error also waits for terminal abort');tx.fail(abortError);await tick();
  assert.equal(pending.error,requestError);assert.equal(f.counts.opens,f.counts.closes);cases.push('original request error preserved through abort');
 }
 {
  for(const change of [r=>r.correlation_id=id,r=>r.conversation_id=id,r=>r.body+=' changed',r=>r.attachment_ids.reverse(),r=>r.attachment_ids[0]=id,r=>r.created_at='2026-10-13T02:03:05.005Z']){
   const f=idbFixture([original]),context=scope(f),different=copy(original);change(different);const result=await execute(f,context.put(different));
   assert.ok(result.error,'conflicting original must reject');assert.deepEqual(f.rows.get(id),original);assert.equal(f.counts.put+f.counts.add,0);assert.equal(f.counts.opens,f.counts.closes);
  }
  const f=idbFixture([{...original,state:'retained_unknown',extra:'preserved'}]),context=scope(f);const result=await execute(f,context.put(copy(original)));
  assert.equal(result.error,null);assert.equal(f.rows.get(id).extra,'preserved');assert.equal(f.rows.get(id).state,'retained_unknown');assert.equal(f.counts.put+f.counts.add,0);
  cases.push('conflicting fields reject and matching original is not overwritten');
 }
 {
  const f=idbFixture([original]),calls=[],context=scope(f,{streamRecord:async r=>calls.push(r),selectConversation:async()=>{throw Error('unlisted cannot be selected');}});context.state.conversations=[];
  loadFunction(context,'  async function resumeOutbox()','  async function readEventStream(');
  const pending=tracked(context.resumeOutbox());await tick();f.transactions[0].requestSuccess();f.transactions[0].commit();await tick();
  // No follow-on deletion or provider request is permitted by list absence.
  assert.equal(f.transactions.length,1);assert.equal(calls.length,0);assert.equal(pending.error,null);assert.deepEqual(f.rows.get(id),original);assert.equal(f.counts.opens,f.counts.closes);
  cases.push('unlisted conversation retains original without resend');
 }
 {
  const changed={...original,body:'different newer source'},f=idbFixture([changed]),context=scope(f);const denied=await execute(f,context.remove(copy(original)));
  assert.ok(denied.error);assert.equal(f.counts.delete,0);assert.deepEqual(f.rows.get(id),changed);assert.equal(f.counts.opens,f.counts.closes);
  const valid=idbFixture([original]),ok=scope(valid),pending=tracked(ok.remove(copy(original)));await tick();valid.transactions[0].requestSuccess();await tick();assert.equal(pending.done,false);assert.deepEqual(valid.rows.get(id),original);
  valid.transactions[0].commit();await tick();assert.equal(pending.error,null);assert.equal(valid.rows.has(id),false);assert.equal(valid.counts.opens,valid.counts.closes);
  const aborted=idbFixture([original]),abortScope=scope(aborted),failed=tracked(abortScope.remove(copy(original)));await tick();aborted.transactions[0].requestSuccess();aborted.transactions[0].fail(Error('delete abort'));await tick();assert.ok(failed.error);assert.deepEqual(aborted.rows.get(id),original);assert.equal(aborted.counts.opens,aborted.counts.closes);
  cases.push('exact observed deletion waits commit and refuses replacement/abort');
 }
 {
  for(const frames of ['',`event: done\ndata: {"correlation_id":"${correlation}"}\n\n`]){
   const f=idbFixture(),statuses=[],assistant={message:{body:''},text:{},meta:{},node:{classList:{add(){}}}};
   const context=scope(f,{API:'https://memphis-zoo-mcp.onrender.com/gemini-api',appendAssistantStream:()=>assistant,setStatus:text=>statuses.push(text),scrollBottom:()=>{},appendCard:()=>{},
    loadConversations:async()=>{},refreshMessages:async()=>{},refreshRepairState:async()=>{},formatTime:()=>'',
    fetch:async()=>({ok:true,body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(frames));c.close();}})})});
   loadFunction(context,'  async function headers(','  async function api(');
   loadFunction(context,'  async function readEventStream(','  function db()');
   loadFunction(context,'  function captureOriginalManager()','  async function sendCurrent(');
   loadFunction(context,'  async function streamRecord(','  async function retryMessage(');
   // Rebind this historical input to the new mandatory dispatch prerequisite;
   // this old selector is not part of the targeted new qualification run.
   const saved=await execute(f,context.put(copy(original)));assert.equal(saved.error,null);const admitted=await execute(f,context.admit(saved.value));assert.equal(admitted.error,null);
   const pending=tracked(context.streamRecord(saved.value,context.captureOriginalManager()));await tick();
   assert.equal(f.transactions.length,2,'EOF/done without exact original receipt cannot delete');assert.equal(pending.error,null);assert.deepEqual(f.rows.get(id),{...original,state:'dispatch_attempted'});
   assert.ok(statuses.some(text=>/unconfirmed|retained/i.test(text)));assert.equal(context.state.busy,false);
  }
  cases.push('EOF and correlation-only done retain unconfirmed original');
 }
 console.log(JSON.stringify({status:'GEMINI_OUTBOX_NEW_SOURCE_CASES_PASS',groups:cases.length,cases,actual_function_VM:true,IDB_streams_auth_synthetic:true,real_manager:false,provider:false,browser:false,SQL:false}));
}
