import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';import{webcrypto,createHash}from'node:crypto';import{idbFixture,browserFixture,drive}from'./gemini-protected-idb-fixture.mjs';
const root=process.argv[2]||new URL('..',import.meta.url).pathname;const results=[];
for(const mode of ['deleted','partial','wrong-receipt','missing-receipt','network','denied','generic503']){
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
 else if(options.method==='DELETE'){
  if(mode==='network')throw Error('Synthetic ambiguous transport failure');
  if(mode==='denied')return {ok:false,status:403,json:async()=>({ok:false,error:'Synthetic protected denial'})};
  if(mode==='partial'||mode==='generic503')return {ok:false,status:503,json:async()=>({ok:false,error:'Removal unconfirmed',...(mode==='partial'?{code:'attachment_deletion_unconfirmed',data:{attachment_id:id(8),storage_removal:'confirmed',metadata_transition:'unconfirmed'}}:{})})};
  body={ok:true,data:mode==='missing-receipt'?{}:{attachment_id:mode==='wrong-receipt'?id(99):id(8),status:'deleted'}};
 }
 else if(path.endsWith('/attachments')){if(mode==='upload-switch')await new Promise(r=>uploadRelease=r);body={ok:true,data:{attachment_id:JSON.parse(options.body).client_attachment_id,name:'synthetic.txt',size_bytes:3,sha256:createHash('sha256').update(new Uint8Array([1,2,3])).digest('hex')}};}
 else if(options.method==='PATCH'){body={ok:true,data:{conversation_id:id(5),draft_text:'SYNTHETIC_EDIT'}};}
 else if(path.endsWith('/messages'))body={ok:true,data:[{message_id:id(6),role:'assistant',body:'SYNTHETIC_PRIVATE_TRANSCRIPT',state:'completed'}]};
 else if(path.endsWith('/repair-state'))body={ok:true,data:{proposals:[],jobs:[]}};else throw Error('unexpected path '+path);
 return{ok:true,status:200,json:async()=>body};};
 const context=vm.createContext({window,document:{documentElement:node('html'),querySelector:node,createElement:()=>new Element(),addEventListener(k,f){docs.set(k,f)}},localStorage,navigator:window.navigator,fetch,URL,AbortSignal,Date:Clock,Intl,console,btoa,atob,AbortController,TextDecoder,Uint8Array,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,requestAnimationFrame:fn=>fn(),indexedDB:f.indexedDB,crypto:{randomUUID:()=>id(8),subtle:webcrypto.subtle}});
 vm.runInContext(readFileSync(root+'/memphis-auth.js','utf8'),context);vm.runInContext(readFileSync(root+'/gemini-console.js','utf8').replace('init().catch(lock);','window.__ready=init().catch(error=>{lock(error);throw error;});').replace(/\}\)\(\);\s*$/, 'window.__audit={addFiles,removeAttachment,sendCurrent,state};})();'),context,{filename:root+'/gemini-console.js',importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER});await drive(window.__ready,f);
 assert.equal(node('#app').hidden,false);assert.match(node('#transcript').text,/SYNTHETIC_PRIVATE_TRANSCRIPT/);
 const api=window.__audit;
 const file={name:'synthetic.txt',type:'text/plain',size:3,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
 await drive(api.addFiles([file]),f);assert.equal(api.state.attachments.length,1);const original=api.state.attachments[0];assert.equal(original.attachment_id,id(8));assert.equal(original.status,'ready');
 let error;try{await drive(api.removeAttachment(original),f);}catch(e){error=e;}
 assert.equal(requests.filter(r=>r.method==='DELETE').length,1);
 if(mode==='deleted'){assert.equal(error,undefined);assert.equal(api.state.attachments.length,0);assert.equal(node('#app').hidden,false);}
 else if(mode==='denied'){assert.ok(error);assert.equal(node('#app').hidden,true);assert.equal(node('#transcript').text,'');assert.equal(original.attachment_id,id(8));}
 else {
  assert.ok(error);assert.equal(api.state.attachments.length,1);assert.equal(api.state.attachments[0],original);assert.equal(original.attachment_id,id(8));assert.equal(original.status,'removal_unconfirmed');
  assert.match(node('#attachment-list').text,/Removal unconfirmed/);assert.equal(node('#attachment-list').children[0].children[1].disabled,true);
  node('#message-input').value='SYNTHETIC_UNSENT_ORIGINAL';const before=requests.length;
  await drive(api.sendCurrent(),f);assert.equal(node('#message-input').value,'SYNTHETIC_UNSENT_ORIGINAL');assert.equal(requests.length,before,'unknown removal must not trigger message dispatch');
  await assert.rejects(api.removeAttachment(original),/unconfirmed/);assert.equal(requests.length,before,'no automatic or replacement deletion');
 }
 assert.equal(requests.filter(r=>r.path.endsWith('/attachments')&&r.method==='POST').length,1);
 assert.equal(requests.filter(r=>r.path.endsWith('/messages/stream')).length,0);
 console.log(JSON.stringify({root,mode,status:'PASS',actual_auth:true,actual_console:true,synthetic_only:true}));
}
