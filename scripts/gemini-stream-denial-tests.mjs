// Actual auth + Console sendCurrent, durable original and admission state machine.
// In-memory synthetic IndexedDB and native writer ports; no private admission injection.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root=process.argv[2],mode=process.argv[3],nodes=new Map(),events=new Map(),requests=[];
class Element {
  constructor(){this.children=[];this.textContent='';this.hidden=false;this.value='';this.style={setProperty(){}};this.dataset={};this.classList={add(){},remove(){}};this.scrollHeight=20;this.listeners=new Map();}
  addEventListener(k,f){this.listeners.set(k,f)} append(...v){this.children.push(...v)} replaceChildren(...v){this.children=v}
  querySelectorAll(){return []} querySelector(s){const name=s.slice(1);for(const child of this.children){if(child.className===name)return child;const nested=child.querySelector(s);if(nested)return nested;}return null;}
  setAttribute(){} focus(){} get text(){return this.textContent+this.children.map(v=>v.text).join('')}
}
const node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)}, id=n=>'ba000000-0000-4000-8000-'+String(n).padStart(12,'0');
const now=Date.parse('2026-11-15T01:00:00Z');class Clock extends Date{constructor(...v){super(...(v.length?v:[now]))}static now(){return now}}
const session={role:'ops_manager',token:'SYNTHETIC_ONLY',device_id:'synthetic-device',manager_id:id(2),credential_id:id(3),expires_at:'2026-11-15T02:00:00Z',auth_mode:'custodial_leadership_pin',owner:false,custodial_management_admin:true,read_only:false,access_level:'full_access',permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1}};
const localStorage={getItem(){return null},setItem(){},removeItem(){}};
const window={setTimeout(){return 1},clearTimeout(){},innerHeight:800,CustomEvent:class{constructor(type){this.type=type}},dispatchEvent:e=>events.get(e.type)?.(e),location:new URL('https://synthetic.invalid/gemini-admin.html'),navigator:{},localStorage,addEventListener(k,f){events.set(k,f)}};
const fetch=async(url,options={})=>{
  const path=new URL(url).pathname;requests.push({path,method:options.method||'GET'});let body;
  if(path.endsWith('/messages/stream')){
    if(mode==='network')throw Error('Synthetic transient network failure');
    const status=mode==='success'?200:Number(mode);return {ok:status===200,status,body:status===200?{getReader:()=>({read:async()=>({done:true})})}:null};
  }
  if(path.endsWith('/session'))body={ok:true,enrolled:true,csrfToken:'SYNTHETIC_CSRF',session:{identityAssurance:'SELF_ASSERTED_NAME',registrationId:id(3),claimedAccount:{accountId:id(1)},cohort:{principalId:session.manager_id,policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:session}};
  else if(path==='/gemini-api/conversations')body={ok:true,data:[{conversation_id:id(5),title:'SYNTHETIC_PRIVATE_CONVERSATION',draft_text:'SYNTHETIC_PRIVATE_DRAFT'}]};
  else if(path.endsWith('/messages'))body={ok:true,data:[{message_id:id(6),role:'assistant',body:'SYNTHETIC_PRIVATE_TRANSCRIPT',state:'completed'}]};
  else if(path.endsWith('/messages/original-outcome'))return {ok:false,status:503,json:async()=>({ok:false,error:'Synthetic original read unavailable'})};
  else if(path.endsWith('/repair-state'))body={ok:true,data:{proposals:[],jobs:[]}};else throw Error('Unexpected path '+path);
  return{ok:true,status:200,json:async()=>body};
};
const saved=new Map();let databaseOpened=false,idbWrites=0;
const database={version:1,objectStoreNames:{contains:name=>name==='outbox'},close(){},transaction(){
 const tx={aborted:false,pending:0,abort(){this.aborted=true;setImmediate(()=>this.onabort?.())}};
 const request=operation=>{const req={};tx.pending++;setImmediate(()=>{if(tx.aborted)return;try{req.result=operation();req.onsuccess?.({target:req});}catch(error){req.error=error;req.onerror?.({target:req});tx.onerror?.({target:req});tx.abort();}finally{tx.pending--;setImmediate(()=>{if(!tx.aborted&&tx.pending===0)tx.oncomplete?.()})}});return req;};
 tx.objectStore=()=>({get:key=>request(()=>saved.has(key)?structuredClone(saved.get(key)):undefined),getAll:()=>request(()=>[...saved.values()].map(v=>structuredClone(v))),add:value=>request(()=>{assert.equal(saved.has(value.client_message_id),false);saved.set(value.client_message_id,structuredClone(value));idbWrites++;return value.client_message_id}),put:value=>request(()=>{saved.set(value.client_message_id,structuredClone(value));idbWrites++;return value.client_message_id}),delete:key=>request(()=>saved.delete(key))});return tx;
}};
const indexedDB={databases:async()=>databaseOpened?[{name:'memphis-gemini-console',version:1}]:[],open(){databaseOpened=true;const req={};setImmediate(()=>{req.result=database;req.onsuccess?.()});return req;}};
const context=vm.createContext({window,document:{documentElement:node('html'),querySelector:node,createElement:()=>new Element(),addEventListener(){}},localStorage,navigator:window.navigator,fetch,URL,AbortSignal,AbortController,Date:Clock,Intl,console,TextDecoder,Uint8Array,setTimeout,clearTimeout,requestAnimationFrame:f=>f(),indexedDB,crypto:{randomUUID:()=>id(99)}});
vm.runInContext(readFileSync(root+'/memphis-auth.js','utf8'),context);
vm.runInContext(readFileSync(root+'/gemini-console.js','utf8').replace(/\}\)\(\);\s*$/,'window.__audit={state,sendCurrent};})();'),context);
await new Promise(r=>setImmediate(r));assert.match(node('#transcript').text,/SYNTHETIC_PRIVATE_TRANSCRIPT/);assert.equal(node('#app').hidden,false);
let writerCalls=0;window.MemphisCustodialSecurity={native:true,async mutateProtectedWork(fn,options){assert.equal(options.requireEnrollment,true);writerCalls++;return fn({assertCurrent(){}})}};
const a=window.__audit,record={client_message_id:id(11),correlation_id:id(12),conversation_id:id(5),body:'SYNTHETIC_NEW_ORIGINAL',attachment_ids:[],created_at:new Date(now).toISOString(),state:'queued'};
node('#message-input').value='SYNTHETIC_NEW_ORIGINAL';await a.sendCurrent();
const result={root,mode,actual_auth:true,actual_console:true,actual_send_current:true,actual_outbox_state_machine:true,idb_writes:idbWrites,durable_originals:[...saved.values()].map(v=>({client_message_id:v.client_message_id,state:v.state,body:v.body})),stream_posts:requests.filter(r=>r.path.endsWith('/messages/stream')).length,transcript_retained:node('#transcript').text.includes('SYNTHETIC_PRIVATE_TRANSCRIPT'),sidebar_retained:node('#conversation-list').text.includes('SYNTHETIC_PRIVATE_CONVERSATION'),app_visible:node('#app').hidden===false,session_retained:!!window.MemphisAuth.readSession(),status:node('#status').textContent,writer_calls:writerCalls};console.log(JSON.stringify(result));
assert.equal(result.stream_posts,1);assert.equal(result.session_retained,true);assert.equal(writerCalls,3);assert.equal(idbWrites,2);assert.equal(saved.size,1);assert.equal([...saved.values()][0].state,'dispatch_attempted');
if(mode==='401'||mode==='403'){assert.equal(result.app_visible,false,'terminal stream denial must withdraw the protected display');assert.equal(result.transcript_retained,false);assert.equal(result.sidebar_retained,false);}
else {assert.equal(result.app_visible,true);assert.equal(result.transcript_retained,true);}
