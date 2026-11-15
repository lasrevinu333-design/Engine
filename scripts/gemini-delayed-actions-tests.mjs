import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';import{webcrypto,createHash}from'node:crypto';import{idbFixture,browserFixture,drive}from'./gemini-protected-idb-fixture.mjs';
const root=process.argv[2]||new URL('..',import.meta.url).pathname;const results=[];
for(const mode of ['file-stable','file-revoke','file-switch','upload-switch','draft-stable','draft-revoke','draft-switch']){
 const nodes=new Map(),events=new Map(),docs=new Map(),requests=[];
 class Element{constructor(){this.children=[];this.textContent='';this.hidden=false;this.value='';this.style={setProperty(){}};this.dataset={};this.classList={add(){},remove(){}};this.scrollHeight=20;this.listeners=new Map();}addEventListener(k,f){this.listeners.set(k,f)}append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}querySelectorAll(){return[]}setAttribute(){}focus(){}get text(){return this.textContent+this.children.map(x=>x.text).join('')}}
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
 let now=Date.parse('2026-11-14T12:00:00Z');class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
 const id=n=>'ba000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const session={role:'ops_manager',token:'SYNTHETIC_ONLY',device_id:'synthetic-manager-device',manager_id:id(2),claimed_manager_id:id(1),credential_id:id(3),expires_at:'2026-11-14T12:01:00Z',auth_mode:'custodial_leadership_pin',owner:false,custodial_management_admin:true,read_only:false,access_level:'full_access',permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1}};
 let serverSession=session,release;let fileRelease,uploadRelease;let deferred=false,denied=false;const timers=new Map();let timerId=0;
 const f=idbFixture([],true,{absent:true}),browser=browserFixture(),localStorage=browser.local;
 const window={setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id},clearTimeout:id=>timers.delete(id),innerHeight:800,CustomEvent:class{constructor(type){this.type=type}},dispatchEvent:e=>events.get(e.type)?.(e),location:new URL('https://synthetic.invalid/gemini-admin.html'),navigator:{locks:browser.locks},crypto:webcrypto,indexedDB:f.indexedDB,sessionStorage:browser.session,localStorage,addEventListener(k,f){events.set(k,f)}};
 const fetch=async(url,options={})=>{const path=new URL(url).pathname;requests.push({path,method:options.method||'GET'});if(denied&&path.startsWith('/gemini-api/'))return{ok:false,status:mode==='http401'?401:403,json:async()=>({ok:false,error:'Synthetic authoritative manager denial'})};let body;
 if(path.endsWith('/session'))body={ok:true,enrolled:true,csrfToken:'SYNTHETIC_CSRF',session:{identityAssurance:'SELF_ASSERTED_NAME',registrationId:id(3),claimedAccount:{accountId:id(1)},cohort:{principalId:serverSession.manager_id,policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:serverSession}};
 else if(path.endsWith('/revoke'))body={ok:true,revoked:true};
 else if(path==='/gemini-api/conversations'){if(deferred)await new Promise(r=>release=r);body={ok:true,data:[{conversation_id:id(5),title:'SYNTHETIC_PRIVATE_CONVERSATION',draft_text:'SYNTHETIC_PRIVATE_DRAFT'},{conversation_id:id(7),title:'SECOND',draft_text:'SECOND_DRAFT'}]};}
 else if(path.endsWith('/attachments')){if(mode==='upload-switch')await new Promise(r=>uploadRelease=r);body={ok:true,data:{attachment_id:JSON.parse(options.body).client_attachment_id,name:'synthetic.txt',size_bytes:3,sha256:createHash('sha256').update(new Uint8Array([1,2,3])).digest('hex')}};}
 else if(options.method==='PATCH'){body={ok:true,data:{conversation_id:id(5),draft_text:'SYNTHETIC_EDIT'}};}
 else if(path.endsWith('/messages'))body={ok:true,data:[{message_id:id(6),role:'assistant',body:'SYNTHETIC_PRIVATE_TRANSCRIPT',state:'completed'}]};
 else if(path.endsWith('/repair-state'))body={ok:true,data:{proposals:[],jobs:[]}};else throw Error('unexpected path '+path);
 return{ok:true,status:200,json:async()=>body};};
 const context=vm.createContext({window,document:{documentElement:node('html'),querySelector:node,createElement:()=>new Element(),addEventListener(k,f){docs.set(k,f)}},localStorage,navigator:window.navigator,fetch,URL,AbortSignal,Date:Clock,Intl,console,btoa,atob,AbortController,TextDecoder,Uint8Array,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,requestAnimationFrame:fn=>fn(),indexedDB:f.indexedDB,crypto:{randomUUID:()=>id(8),subtle:webcrypto.subtle}});
 vm.runInContext(readFileSync(root+'/memphis-auth.js','utf8'),context);vm.runInContext(readFileSync(root+'/gemini-console.js','utf8').replace('init().catch(lock);','window.__ready=init().catch(error=>{lock(error);throw error;});').replace(/\}\)\(\);\s*$/, 'window.__audit={addFiles,selectConversation,scheduleDraftSave};})();'),context,{filename:root+'/gemini-console.js',importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER});await drive(window.__ready,f);
 assert.equal(node('#app').hidden,false);assert.match(node('#transcript').text,/SYNTHETIC_PRIVATE_TRANSCRIPT/);
 const api=window.__audit;
 if(mode.startsWith('draft')){
  node('#message-input').value='SYNTHETIC_EDIT';api.scheduleDraftSave();
  const scheduled=[...timers.values()].filter(t=>t.at-now===500);assert.equal(scheduled.length,1);
  if(mode==='draft-revoke')await window.MemphisAuth.clearSession();if(mode==='draft-switch')await drive(api.selectConversation(id(7)),f);
  for(const t of scheduled)t.fn();await new Promise(r=>setImmediate(r));
  const writes=requests.filter(r=>r.method==='PATCH');assert.equal(writes.length,mode==='draft-stable'?1:0);
 }else{
  const file={name:'synthetic.txt',type:'text/plain',size:3,arrayBuffer:()=>mode==='upload-switch'?Promise.resolve(new Uint8Array([1,2,3]).buffer):new Promise(r=>fileRelease=r)};
  const pending=drive(api.addFiles([file]),f);if(mode==='upload-switch'){for(let n=0;n<200&&!uploadRelease;n++)await new Promise(setImmediate);assert.ok(uploadRelease,'upload actually dispatched before view switch');}else await new Promise(r=>setImmediate(r));
  if(mode==='file-revoke')await window.MemphisAuth.clearSession();
  if(mode==='file-switch'||mode==='upload-switch')await drive(api.selectConversation(id(7)),f);
  if(fileRelease)fileRelease(new Uint8Array([1,2,3]).buffer);if(uploadRelease)uploadRelease();await pending;
  const writes=requests.filter(r=>r.path.endsWith('/attachments')&&r.method==='POST');assert.equal(writes.length,['file-stable','upload-switch'].includes(mode)?1:0);
  assert.equal(node('#attachment-list').text.includes('synthetic.txt'),mode==='file-stable');
 }
 console.log(JSON.stringify({root,mode,status:'PASS',actual_auth:true,actual_console:true,synthetic_only:true,requests}));
}
