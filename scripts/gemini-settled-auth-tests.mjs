import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const root=process.argv[2]||new URL('..',import.meta.url).pathname;const results=[];
for(const mode of ['expiry','confirmed-revoke']){
 const nodes=new Map(),events=new Map(),docs=new Map(),requests=[];
 class Element{constructor(){this.children=[];this.textContent='';this.hidden=false;this.value='';this.style={setProperty(){}};this.dataset={};this.classList={add(){},remove(){}};this.scrollHeight=20;this.listeners=new Map();}addEventListener(k,f){this.listeners.set(k,f)}append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}querySelectorAll(){return[]}setAttribute(){}focus(){}get text(){return this.textContent+this.children.map(x=>x.text).join('')}}
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
 let now=Date.parse('2026-11-14T12:00:00Z');class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
 const id=n=>'ba000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const session={role:'ops_manager',token:'SYNTHETIC_ONLY',device_id:'synthetic-manager-device',manager_id:id(2),credential_id:id(3),expires_at:'2026-11-14T12:01:00Z',auth_mode:'custodial_leadership_pin',owner:false,custodial_management_admin:true,read_only:false,access_level:'full_access',permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1}};
 const localStorage={getItem(){return null},setItem(){},removeItem(){}};
 const window={innerHeight:800,CustomEvent:class{constructor(type){this.type=type}},dispatchEvent:e=>events.get(e.type)?.(e),location:new URL('https://synthetic.invalid/gemini-admin.html'),navigator:{},localStorage,addEventListener(k,f){events.set(k,f)}};
 const fetch=async(url,options={})=>{const path=new URL(url).pathname;requests.push({path,method:options.method||'GET'});let body;
 if(path.endsWith('/session'))body={ok:true,enrolled:true,csrfToken:'SYNTHETIC_CSRF',session:{identityAssurance:'SELF_ASSERTED_NAME',registrationId:id(3),claimedAccount:{accountId:id(1)},cohort:{principalId:session.manager_id,policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:session}};
 else if(path.endsWith('/revoke'))body={ok:true,revoked:true};
 else if(path==='/gemini-api/conversations')body={ok:true,data:[{conversation_id:id(5),title:'SYNTHETIC_PRIVATE_CONVERSATION',draft_text:'SYNTHETIC_PRIVATE_DRAFT'}]};
 else if(path.endsWith('/messages'))body={ok:true,data:[{message_id:id(6),role:'assistant',body:'SYNTHETIC_PRIVATE_TRANSCRIPT',state:'completed'}]};
 else if(path.endsWith('/repair-state'))body={ok:true,data:{proposals:[],jobs:[]}};else throw Error('unexpected path '+path);
 return{ok:true,status:200,json:async()=>body};};
 const context=vm.createContext({window,document:{documentElement:node('html'),querySelector:node,createElement:()=>new Element(),addEventListener(k,f){docs.set(k,f)}},localStorage,navigator:window.navigator,fetch,URL,AbortSignal,Date:Clock,Intl,console,setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),indexedDB:{open(){throw Error('must not open absent synthetic store')},databases:async()=>[]},crypto:{randomUUID:()=>id(99)}});
 vm.runInContext(readFileSync(root+'/memphis-auth.js','utf8'),context);vm.runInContext(readFileSync(root+'/gemini-console.js','utf8'),context);await new Promise(r=>setImmediate(r));
 assert.equal(node('#app').hidden,false);assert.match(node('#transcript').text,/SYNTHETIC_PRIVATE_TRANSCRIPT/);
 if(mode==='expiry')now+=61000;else await window.MemphisAuth.clearSession();assert.equal(window.MemphisAuth.readSession(),null);
 events.get('focus')?.();docs.get('visibilitychange')?.();events.get('pagehide')?.();events.get('pageshow')?.({persisted:true});await new Promise(r=>setImmediate(r));
 const r={root,mode,actual_auth:true,actual_console:true,synthetic_records_only:true,transcript_retained:node('#transcript').text.includes('SYNTHETIC_PRIVATE_TRANSCRIPT'),draft_retained:node('#message-input').value.includes('SYNTHETIC_PRIVATE_DRAFT'),app_visible:node('#app').hidden===false,console_writes:requests.filter(x=>x.path.startsWith('/gemini-api/')&&x.method!=='GET').length};console.log(JSON.stringify(r));results.push(r);
}
assert.equal(results.filter(r=>r.transcript_retained&&r.app_visible).length,0,'Console must withdraw settled protected transcript after manager authority ends');
