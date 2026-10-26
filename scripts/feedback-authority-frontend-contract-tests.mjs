#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(process.env.FEEDBACK_SOURCE || new URL('../system-feedback.html', import.meta.url), 'utf8');
if (!process.argv.includes('--triage-only')) {
const submit = source.slice(source.indexOf('async function submit(event)'), source.indexOf("els.form.addEventListener('submit'"));

assert.match(submit, /isNativeCustodialAuthority\(\) && state\.hub === 'employee' && !state\.deviceId/);
assert.match(submit, /const identityHeaders = state\.hub === 'manager' \? await managerHeaders\(\) : \{\}/);
assert.match(submit, /credentials: 'include'/);
assert.match(submit, /\.\.\.identityHeaders/);
assert.match(submit, /hub_context: state\.hub/);
assert.match(submit, /device_id: state\.deviceId/);

const bridge = readFileSync(new URL('../mobile/src/custodial/bridge.js', import.meta.url), 'utf8');
assert.match(bridge, /window\.fetch = bridgeFetch/);
assert.match(bridge, /dispatchAuthorizedTransport/);
assert.doesNotMatch(bridge, /publicUnauthenticatedRoute[\s\S]{0,500}feedback-api/,
  'Custodial feedback must continue through native enrolled-device transport');

const viewerHtml = readFileSync(new URL('../ops-viewer.html', import.meta.url), 'utf8');
const viewerScript = readFileSync(new URL('../ops-viewer.js', import.meta.url), 'utf8');
const releaseManifest = JSON.parse(readFileSync(new URL('../frontend-release-manifest.json', import.meta.url), 'utf8'));
assert.equal(releaseManifest.api_contract_versions.feedback, 'feedback.v3.enrolled-authority');
assert.deepEqual(
  [...viewerHtml.matchAll(/data-panel="([^"]+)"/g)].map((match) => match[1]),
  ['dashboard', 'events'],
  'Read Only Viewer must expose exactly Dashboard and Events',
);
assert.doesNotMatch(viewerHtml, /Feedback|<form|<textarea|<select|type=["']submit["']/i);
assert.doesNotMatch(viewerScript, /feedback-api\/submit|method\s*:\s*["']POST["']/i);

console.log('FEEDBACK_AUTHORITY_FRONTEND_CONTRACT_PASS');
}

// Affected cases execute the actual manager functions from this HTML, inside
// the existing owning contract test. Only HTTP/normal-session inputs are
// synthetic; this is not named-manager, browser, SDK or SQL proof.
const id=n=>`98000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const version='a'.repeat(64), feedbackId=id(1);
const session=()=>({role:'ops_manager',manager_id:id(2),credential_id:id(3),device_id:'synthetic-browser',token:'SYNTHETIC_NOT_A_CREDENTIAL',expires_at:'2099-01-01T00:00:00Z',access_level:'full_access',read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true}});
const row=()=>({id:feedbackId,status:'new',summary:'Original <script>feedback</script>',message:'Safe rendered text',triage_version:version,created_at:'2026-10-11T17:00:00Z'});
function tabStore(){const values=new Map(),calls=[];return {values,calls,getItem:key=>{calls.push(['get',key]);return values.get(key)??null;},setItem:(key,value)=>{calls.push(['set',key]);values.set(key,String(value));},removeItem:key=>{calls.push(['remove',key]);values.delete(key);}};}
function fixture({readOnly=false,fetchImpl=null,headersHook=null,native=false,hub='manager',search='',storage=tabStore()}={}) {
 let current=session();if(readOnly)current={...current,read_only:true,access_level:'read_only',permissions:{...current.permissions,owner:false}};
 const calls=[],authCalls=[],listeners=new Map(),intervals=new Map();let serial=0,headerCount=0,lastReceipt=null;
 const window={sessionStorage:storage,MemphisAuth:{readSession:()=>current,requireOpsManagerSession:async options=>{authCalls.push(options);return current;},opsManagerAuthHeaders:async()=>{headerCount++;if(headersHook)await headersHook(current,headerCount);return {Authorization:'Bearer '+current.token,'X-Device-Id':current.device_id};}},
   addEventListener:(k,f)=>listeners.set(k,f),setInterval:f=>{intervals.set(1,f);return 1;},clearInterval:k=>intervals.delete(k)};
 const el=(name='other')=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',querySelectorAll:()=>[],querySelector:()=>null,
  addEventListener:(k,f)=>listeners.set(name+':'+k,f),removeEventListener:(k,f)=>{if(listeners.get(name+':'+k)===f)listeners.delete(name+':'+k);}});
 const els={inbox:el(),inboxStatus:el('filter'),inboxRefresh:el('refresh'),inboxCheck:el('original-status'),inboxState:el(),inboxList:el('inbox')};els.inboxCheck.hidden=true;
 const location={href:'https://synthetic.invalid/system-feedback.html'+search};
 const fetch=async(url,opts={})=>{calls.push({url:String(url),opts});if(fetchImpl)return fetchImpl(String(url),opts);
  if(opts.method==='POST'){const payload=accepted(JSON.parse(opts.body));lastReceipt=payload.receipt;return response(payload);}
  return response({ok:true,data:[lastReceipt?{...row(),status:lastReceipt.status,triage_version:lastReceipt.triage_version}:row()]});};
 const code=source.slice(source.indexOf('function escapeHtml'),source.indexOf('async function submit(event)'));
 // Older sealed pages bind outside the function block. Current source binds
 // inside init; execute that owning code normally, never replace its guards.
 const clickSource=source.includes('function bindInboxControls')?'':source.slice(source.indexOf("els.inboxList.addEventListener('click'"),source.indexOf('void resolve().then'));
 const api=vm.runInNewContext(code+'\n'+clickSource+'\n;({loadInbox,loadInboxImage,updateInboxItem,initManagerInbox,exactTriageReceipt,exactOriginalStatus,checkOriginalTriageStatus:typeof checkOriginalTriageStatus===\'function\'?checkOriginalTriageStatus:null,stopInbox:typeof stopInbox===\'function\'?stopInbox:()=>{}})',{
  window,location,document:{hidden:false,addEventListener:(k,f)=>listeners.set(k,f)},state:{hub},els,API:'https://synthetic.invalid',URL,AbortController,Date,Map,Set,
  crypto:{randomUUID:()=>id(100+(serial++))},fetch,isNativeCustodialAuthority:()=>native});
 return {api,calls,els,window,location,storage,authCalls,intervals,listeners,keys:()=>serial,change:patch=>{current={...current,...patch};},current:()=>current};
}
function imageClick(f){const status={textContent:''},imageListeners=new Map(),slot={innerHTML:'',querySelector:()=>({addEventListener:(k,fn)=>imageListeners.set(k,fn)})};
 const article={dataset:{feedbackId,triageVersion:version},querySelector:key=>key==='[data-image-slot]'?slot:status};
 const button={dataset:{action:'image'},disabled:false,closest:()=>article};
 const event={target:{closest:()=>button}};return {status,slot,article,button,imageListeners,run:()=>f.listeners.get('inbox:click')(event)};}
const response=(payload,status=200)=>({ok:status>=200&&status<300,status,json:async()=>payload});
const accepted=body=>({ok:true,replayed:false,receipt:{request_id:body.request_id,feedback_id:feedbackId,status:body.status,triage_version:'b'.repeat(64),actor_manager_id:body.expected_manager_id,actor_credential_id:body.expected_credential_id,accepted_at:'2026-10-11T17:43:00.000001Z'}});
const tests=[];
async function check(name,fn){if(process.env.TRIAGE_CASE&&!name.includes(process.env.TRIAGE_CASE))return;try{await fn();tests.push(name);console.log('PASS '+name);}catch(error){console.error('FAIL '+name);throw error;}}
await check('positive exact versioned triage request',async()=>{
 const f=fixture();try{await f.api.initManagerInbox();await f.api.updateInboxItem(feedbackId,'acknowledged',version);const post=f.calls.find(x=>x.opts.method==='POST');assert.ok(post);const body=JSON.parse(post.opts.body);
  assert.deepEqual(Object.keys(body).sort(),['request_id','status','expected_version','expected_manager_id','expected_credential_id'].sort());
  assert.equal(body.expected_version,version);assert.equal(body.expected_manager_id,id(2));assert.equal(body.expected_credential_id,id(3));
  assert.match(f.els.inboxList.innerHTML,/data-triage-version="b{64}"/);assert.match(f.els.inboxList.innerHTML,/data-action="resolved"/);assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="acknowledged"/);
 }finally{f.api.stopInbox();}
});
await check('negative readonly controls and owner invocation ceiling',async()=>{
 const f=fixture({readOnly:true});try{await f.api.initManagerInbox();assert.match(f.els.inboxList.innerHTML,/Read-only manager view/);assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="(?:acknowledged|resolved|closed)"/);
  await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);assert.equal(f.keys(),0);assert.ok(f.authCalls.every(x=>x.accessLevel==='read_only'));
 }finally{f.api.stopInbox();}
});
await check('negative invalid/missing displayed version never manufactures a command',async()=>{
 for(const missing of [undefined,'not-a-version']){const f=fixture({fetchImpl:async()=>response({ok:true,data:[{...row(),triage_version:missing}]})});try{await f.api.initManagerInbox();assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="resolved"/);await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.keys(),0);assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);}finally{f.api.stopInbox();}}
});
await check('negative changed manager during awaited headers withdraws before POST',async()=>{
 let release;const wait=new Promise(resolve=>{release=resolve;});const f=fixture({headersHook:async(_s,n)=>{if(n===2)await wait;}});
 try{await f.api.initManagerInbox();const command=f.api.updateInboxItem(feedbackId,'resolved',version);await new Promise(resolve=>setImmediate(resolve));f.change({manager_id:id(99)});release();await assert.rejects(command);
  assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);assert.equal(f.els.inboxList.innerHTML,'');assert.equal(f.intervals.size,0);
 }finally{f.api.stopInbox();}
});
await check('negative refreshed version while headers wait holds the original unsent command',async()=>{
 let release,changed=false;const wait=new Promise(resolve=>{release=resolve;});const f=fixture({headersHook:async(_s,n)=>{if(n===2)await wait;},fetchImpl:async()=>response({ok:true,data:[{...row(),triage_version:changed?'c'.repeat(64):version}]})});
 try{await f.api.initManagerInbox();const command=f.api.updateInboxItem(feedbackId,'resolved',version);await new Promise(resolve=>setImmediate(resolve));changed=true;await f.api.loadInbox();release();await assert.rejects(command);
  assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);assert.match(f.els.inboxState.textContent,/Not sent/);
 }finally{f.api.stopInbox();}
});
await check('negative lost response retains one encoded original through refresh and blocks new command',async()=>{
 let saved;const f=fixture({fetchImpl:async(_url,opts)=>{if(opts.method==='POST'){saved=opts.body;throw Error('Synthetic lost HTTP response');}return response({ok:true,data:[row()]});}});
 try{await f.api.initManagerInbox();await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.match(f.els.inboxState.textContent,/unconfirmed.*Do not repeat/);
  await f.api.loadInbox();assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="resolved"/);await assert.rejects(f.api.updateInboxItem(feedbackId,'acknowledged',version));
  assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,1);assert.equal(f.keys(),1);assert.equal(f.calls.find(x=>x.opts.method==='POST').opts.body,saved);
 }finally{f.api.stopInbox();}
});
await check('negative duplicate click sends once and foreign exact receipt cannot show success',async()=>{
 let release,body;const f=fixture({fetchImpl:async(_url,opts)=>opts.method==='POST'?await new Promise(resolve=>{body=JSON.parse(opts.body);release=resolve;}):response({ok:true,data:[row()]})});
 try{await f.api.initManagerInbox();const command=f.api.updateInboxItem(feedbackId,'resolved',version);await new Promise(resolve=>setImmediate(resolve));await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));
  const payload=accepted(body);payload.receipt.actor_credential_id=id(99);release(response(payload));await assert.rejects(command);assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,1);assert.match(f.els.inboxState.textContent,/unconfirmed/);
 }finally{f.api.stopInbox();}
});
await check('negative conclusive stale denial requires fresh read before another command',async()=>{
 const f=fixture({fetchImpl:async(_url,opts)=>opts.method==='POST'?response({ok:false,command_rejected:true},409):response({ok:true,data:[row()]})});
 try{await f.api.initManagerInbox();await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.match(f.els.inboxState.textContent,/rejected or stale.*Refresh/);await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,1);
  await f.api.loadInbox();assert.match(f.els.inboxList.innerHTML,/data-action="resolved"/);assert.equal(f.keys(),1);
 }finally{f.api.stopInbox();}
});
await check('negative expiry and late HTTP receipt never install accepted state',async()=>{
 let release,body;const f=fixture({fetchImpl:async(_url,opts)=>opts.method==='POST'?await new Promise(resolve=>{body=JSON.parse(opts.body);release=resolve;}):response({ok:true,data:[row()]})});
 try{await f.api.initManagerInbox();const command=f.api.updateInboxItem(feedbackId,'resolved',version);await new Promise(resolve=>setImmediate(resolve));f.change({expires_at:'2020-01-01T00:00:00Z'});for(const tick of f.intervals.values())tick();release(response(accepted(body)));await assert.rejects(command);
  assert.equal(f.els.inboxList.innerHTML,'');assert.match(f.els.inboxState.textContent,/Access changed.*unconfirmed/);assert.equal(f.intervals.size,0);
 }finally{f.api.stopInbox();}
});
await check('negative employee/native manager inbox does not authenticate or fetch',async()=>{
 for(const input of [{hub:'employee'},{native:true}]){const f=fixture(input);try{await f.api.initManagerInbox();assert.equal(f.authCalls.length,0);assert.equal(f.calls.length,0);assert.equal(f.intervals.size,0);}finally{f.api.stopInbox();}}
});
await check('refresh-boundary accepted receipt with stale refreshed row keeps new commands disabled',async()=>{
 const f=fixture({fetchImpl:async(_url,opts)=>response(opts.method==='POST'?accepted(JSON.parse(opts.body)):{ok:true,data:[row()]})});
 try{await f.api.initManagerInbox();await f.api.updateInboxItem(feedbackId,'acknowledged',version);assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="(?:acknowledged|resolved)"/);assert.match(f.els.inboxState.textContent,/receipt accepted.*refreshed version unconfirmed/i);
  await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,1);
 }finally{f.api.stopInbox();}
});
await check('deeplink positive exact reader never substitutes filtered inbox and retains actor/version POST',async()=>{
 let receipt;const f=fixture({search:'?hub=manager&feedback='+feedbackId,fetchImpl:async(url,opts)=>{
  if(opts.method==='POST'){receipt=accepted(JSON.parse(opts.body));return response(receipt);}
  if(url.endsWith('/'+feedbackId))return response({ok:true,data:{...row(),metadata_json:{image_attachment:true},...(receipt?{status:receipt.receipt.status,triage_version:receipt.receipt.triage_version}:{})}});
  return response({ok:true,data:[{...row(),id:id(7),summary:'Wrong first inbox row'}]});}});
 try{await f.api.initManagerInbox();assert.equal(f.calls[0].url,'https://synthetic.invalid/dashboard-api/system-feedback/'+feedbackId);
  assert.match(f.els.inboxList.innerHTML,/Original &lt;script&gt;feedback/);assert.doesNotMatch(f.els.inboxList.innerHTML,/Wrong first/);
  assert.match(f.els.inboxList.innerHTML,/data-action="image"/);assert.equal(f.els.inboxStatus.disabled,true);
  await f.api.updateInboxItem(feedbackId,'acknowledged',version);const body=JSON.parse(f.calls.find(c=>c.opts.method==='POST').opts.body);
  assert.equal(body.expected_version,version);assert.equal(body.expected_manager_id,id(2));assert.equal(body.expected_credential_id,id(3));
  assert.match(f.els.inboxList.innerHTML,/data-triage-version="b{64}"/);assert.equal(f.els.inboxStatus.disabled,true);
  assert.ok(f.calls.filter(c=>c.opts.method!=='POST').every(c=>c.url.endsWith('/'+feedbackId)));
 }finally{f.api.stopInbox();}
});
await check('deeplink readonly original attachment/status uses normal read ceiling only',async()=>{
 const f=fixture({readOnly:true,search:'?feedback='+feedbackId,fetchImpl:async url=>url.includes('/feedback-api/image/')?
  {ok:true,blob:async()=>new Blob(['synthetic image'])}:response({ok:true,data:{...row(),status:'resolved',metadata_json:{image_attachment:true}}})});
 try{await f.api.initManagerInbox();assert.match(f.els.inboxState.textContent,/Exact linked feedback.*Read-only/);
  assert.match(f.els.inboxList.innerHTML,/resolved/);assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="(?:acknowledged|resolved|closed)"/);
  const click=imageClick(f);await click.run();assert.match(click.slot.innerHTML,/alt="Feedback attachment"/);
  assert.ok(f.authCalls.every(c=>c.accessLevel==='read_only'));assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);
 }finally{f.api.stopInbox();}
});
await check('deeplink invalid empty duplicate or malicious identity reads no substitute',async()=>{
 for(const search of ['?feedback=','?feedback=not-a-uuid','?feedback='+feedbackId+'&feedback='+id(7),'?feedback=%3Cscript%3E']){
  const f=fixture({search});try{await f.api.initManagerInbox();assert.equal(f.calls.length,0);assert.equal(f.authCalls.length,0);
   assert.match(f.els.inboxState.textContent,/Invalid feedback link/);assert.equal(f.els.inboxList.innerHTML,'');assert.equal(f.intervals.size,0);
  }finally{f.api.stopInbox();}}
});
await check('deeplink missing exact item keeps empty view and allows only original refresh',async()=>{
 const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async()=>response({ok:false,error:'not found'},404)});
 try{await f.api.initManagerInbox();assert.match(f.els.inboxState.textContent,/not found.*Check the link/);assert.equal(f.els.inboxList.innerHTML,'');
  await f.api.loadInbox();assert.equal(f.calls.length,2);assert.ok(f.calls.every(c=>c.url.endsWith('/'+feedbackId)));assert.equal(f.keys(),0);
 }finally{f.api.stopInbox();}
});
await check('deeplink denied server access withdraws exact view and refresh cannot retry',async()=>{
 for(const status of [401,403]){const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async()=>response({ok:false},status)});
  try{await f.api.initManagerInbox();assert.match(f.els.inboxState.textContent,/access denied/);assert.equal(f.els.inboxList.innerHTML,'');assert.equal(f.intervals.size,0);
   await f.api.loadInbox();assert.equal(f.calls.length,1);assert.equal(f.els.inboxRefresh.disabled,true);
  }finally{f.api.stopInbox();}}
});
await check('deeplink absent normal session shows access requirement without item request',async()=>{
 const f=fixture({search:'?feedback='+feedbackId});f.window.MemphisAuth.requireOpsManagerSession=async()=>null;
 try{await f.api.initManagerInbox();assert.equal(f.els.inbox.hidden,false);assert.match(f.els.inboxState.textContent,/Manager access required/);
  assert.equal(f.calls.length,0);assert.equal(f.intervals.size,0);
 }finally{f.api.stopInbox();}
});
await check('deeplink malformed foreign missing-version or unavailable data never enables guessed item',async()=>{
 for(const [data,status]of [[null,200],[[row()],200],[{...row(),id:id(7)},200],[row(),503],[{...row(),triage_version:null},200]]){
  const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async()=>response({ok:status===200,data},status)});
  try{await f.api.initManagerInbox();assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="(?:acknowledged|resolved|closed)"/);
   await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.keys(),0);assert.equal(f.calls.length,1);
  }finally{f.api.stopInbox();}}
});
await check('deeplink changed link during headers withdraws without requesting either item',async()=>{
 let release;const wait=new Promise(r=>release=r);const f=fixture({search:'?feedback='+feedbackId,headersHook:async()=>wait});
 try{const read=f.api.initManagerInbox();await new Promise(r=>setImmediate(r));f.location.href='https://synthetic.invalid/system-feedback.html?feedback='+id(7);
  release();await read;assert.equal(f.calls.length,0);assert.equal(f.els.inboxList.innerHTML,'');assert.equal(f.intervals.size,0);
 }finally{f.api.stopInbox();}
});
await check('deeplink changed manager or link rejects late exact HTTP body',async()=>{
 for(const change of ['manager','link']){let release;const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async()=>await new Promise(r=>release=r)});
  try{const read=f.api.initManagerInbox();await new Promise(r=>setImmediate(r));if(change==='manager')f.change({manager_id:id(7)});
   else f.location.href='https://synthetic.invalid/system-feedback.html?feedback='+id(7);
   release(response({ok:true,data:row()}));await read;assert.equal(f.els.inboxList.innerHTML,'');assert.equal(f.intervals.size,0);assert.equal(f.calls.length,1);
  }finally{f.api.stopInbox();}}
});
await check('deeplink late older refresh cannot overwrite exact newer version',async()=>{
 let release,calls=0;const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async()=>++calls===1?response({ok:true,data:row()}):calls===2?
  await new Promise(r=>release=r):response({ok:true,data:{...row(),triage_version:'c'.repeat(64),message:'Current exact item'}})});
 try{await f.api.initManagerInbox();const older=f.api.loadInbox();await new Promise(r=>setImmediate(r));await f.api.loadInbox();release(response({ok:true,data:row()}));await older;
  assert.match(f.els.inboxList.innerHTML,/Current exact item/);assert.match(f.els.inboxList.innerHTML,/data-triage-version="c{64}"/);
  await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.keys(),0);
 }finally{f.api.stopInbox();}
});
await check('deeplink lost triage response followed by missing read retains exact original no resend',async()=>{
 let sent;const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async(_url,opts)=>{
  if(opts.method==='POST'){sent=opts.body;throw Error('Synthetic lost reply');}return sent?response({ok:false},404):response({ok:true,data:row()});}});
 try{await f.api.initManagerInbox();await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));await f.api.loadInbox();
  assert.match(f.els.inboxState.textContent,/Triage outcome unconfirmed/);assert.equal(f.els.inboxList.innerHTML,'');
  await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.keys(),1);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
  assert.equal(f.calls.find(c=>c.opts.method==='POST').opts.body,sent);
 }finally{f.api.stopInbox();}
});
await check('attachment missing image reports unavailable not manager change',async()=>{
 const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async url=>url.includes('/feedback-api/image/')?response({ok:false},404):response({ok:true,data:{...row(),metadata_json:{image_attachment:true}}})});
 try{await f.api.initManagerInbox();const click=imageClick(f);await click.run();assert.equal(click.status.textContent,'Image unavailable.');
  assert.match(f.els.inboxState.textContent,/Exact linked feedback/);assert.match(f.els.inboxList.innerHTML,/Original/);assert.equal(click.button.disabled,false);
 }finally{f.api.stopInbox();}
});
await check('attachment error network and service messages stay local without masking pending triage',async()=>{
 for(const mode of ['network','503']){const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async(url,opts)=>{
  if(opts.method==='POST')throw Error('Synthetic uncertain triage');
  if(url.includes('/feedback-api/image/')){if(mode==='network')throw Error('Synthetic image failure');return response({ok:false},503);}
  return response({ok:true,data:{...row(),metadata_json:{image_attachment:true}}});}});
  try{await f.api.initManagerInbox();await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));const pendingText=f.els.inboxState.textContent;
   const click=imageClick(f);await click.run();assert.equal(click.status.textContent,'Could not load image. Try again.');assert.equal(f.els.inboxState.textContent,pendingText);
   await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
  }finally{f.api.stopInbox();}}
});
await check('attachment missing version still reads original image without mutation controls',async()=>{
 const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async url=>url.includes('/feedback-api/image/')?
  {ok:true,status:200,blob:async()=>new Blob(['synthetic image'])}:response({ok:true,data:{...row(),triage_version:null,metadata_json:{image_attachment:true}}})});
 try{await f.api.initManagerInbox();assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="(?:acknowledged|resolved|closed)"/);
  const click=imageClick(f);await click.run();assert.match(click.slot.innerHTML,/alt="Feedback attachment"/);assert.equal(click.status.textContent,'');
  await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.keys(),0);
 }finally{f.api.stopInbox();}
});
await check('attachment duplicate click requests once and actual decode error clears image',async()=>{
 let release;const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async url=>url.includes('/feedback-api/image/')?
  await new Promise(r=>release=r):response({ok:true,data:{...row(),metadata_json:{image_attachment:true}}})});
 try{await f.api.initManagerInbox();const click=imageClick(f),first=click.run();await new Promise(r=>setImmediate(r));await click.run();
  assert.equal(f.calls.filter(c=>c.url.includes('/feedback-api/image/')).length,1);
  release({ok:true,status:200,blob:async()=>new Blob(['synthetic image'])});await first;assert.match(click.slot.innerHTML,/blob:/);
  click.imageListeners.get('error')();assert.equal(click.slot.innerHTML,'');assert.equal(click.status.textContent,'Image unavailable.');assert.equal(click.button.disabled,false);
 }finally{f.api.stopInbox();}
});
await check('attachment lifecycle refresh aborts download and late image cannot render',async()=>{
 let release;const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async url=>url.includes('/feedback-api/image/')?
  await new Promise(r=>release=r):response({ok:true,data:{...row(),metadata_json:{image_attachment:true}}})});
 try{await f.api.initManagerInbox();const click=imageClick(f),read=click.run();await new Promise(r=>setImmediate(r));
  const request=f.calls.find(c=>c.url.includes('/feedback-api/image/'));await f.api.loadInbox();assert.equal(request.opts.signal?.aborted,true);
  release({ok:true,status:200,blob:async()=>new Blob(['late synthetic image'])});await read;assert.equal(click.slot.innerHTML,'');assert.match(f.els.inboxState.textContent,/Exact linked feedback/);
 }finally{f.api.stopInbox();}
});
await check('attachment lifecycle refresh during headers prevents obsolete image HTTP',async()=>{
 let release;const wait=new Promise(r=>release=r);const f=fixture({search:'?feedback='+feedbackId,headersHook:async(_s,n)=>{if(n===2)await wait;},fetchImpl:async()=>response({ok:true,data:{...row(),metadata_json:{image_attachment:true}}})});
 try{await f.api.initManagerInbox();const click=imageClick(f),read=click.run();await new Promise(r=>setImmediate(r));await f.api.loadInbox();release();await read;
  assert.equal(f.calls.filter(c=>c.url.includes('/feedback-api/image/')).length,0);assert.equal(click.slot.innerHTML,'');
 }finally{f.api.stopInbox();}
});
await check('attachment denied image access withdraws and preserves uncertain original triage',async()=>{
 for(const status of [401,403]){const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async(url,opts)=>{
  if(opts.method==='POST')throw Error('Synthetic uncertain triage');if(url.includes('/feedback-api/image/'))return response({ok:false},status);
  return response({ok:true,data:{...row(),metadata_json:{image_attachment:true}}});}});
  try{await f.api.initManagerInbox();await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));const click=imageClick(f);await click.run();
   assert.equal(f.els.inboxList.innerHTML,'');assert.equal(f.intervals.size,0);assert.match(f.els.inboxState.textContent,/access denied.*unconfirmed.*do not repeat/i);
   await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
  }finally{f.api.stopInbox();}}
});
await check('attachment changed manager during blob read withdraws aborts and never renders',async()=>{
 let release;const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async url=>url.includes('/feedback-api/image/')?
  {ok:true,status:200,blob:async()=>await new Promise(r=>release=r)}:response({ok:true,data:{...row(),metadata_json:{image_attachment:true}}})});
 try{await f.api.initManagerInbox();const click=imageClick(f),read=click.run();await new Promise(r=>setImmediate(r));f.change({credential_id:id(77)});
  for(const tick of f.intervals.values())tick();assert.equal(f.calls.find(c=>c.url.includes('/feedback-api/image/')).opts.signal?.aborted,true);
  release(new Blob(['late image']));await read;assert.equal(click.slot.innerHTML,'');assert.equal(f.els.inboxList.innerHTML,'');assert.equal(f.intervals.size,0);
 }finally{f.api.stopInbox();}
});
await check('flow missing or invalid feedback timestamp never manufactures Jan1970 or raw text',async()=>{
 for(const created_at of [null,undefined,0,'1','<script>not a date</script>']){const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async()=>response({ok:true,data:{...row(),created_at}})});
  try{await f.api.initManagerInbox();assert.match(f.els.inboxList.innerHTML,/Date unavailable/);assert.doesNotMatch(f.els.inboxList.innerHTML,/1969|1970|2001|not a date/);
  }finally{f.api.stopInbox();}}
});
await check('flow employee/native manager inbox owns no listeners',async()=>{
 for(const input of [{hub:'employee'},{native:true}]){const f=fixture(input);try{await f.api.initManagerInbox();assert.equal(f.listeners.has('inbox:click'),false);assert.equal(f.authCalls.length,0);assert.equal(f.calls.length,0);
 }finally{f.api.stopInbox();}}
});
await check('flow owner actual clicks keep image error local then triage once refresh exact and dispose controls',async()=>{
 let receipt;const f=fixture({search:'?feedback='+feedbackId,fetchImpl:async(url,opts)=>{
  if(url.includes('/feedback-api/image/'))return response({ok:false},503);
  if(opts.method==='POST'){receipt=accepted(JSON.parse(opts.body));return response(receipt);}
  return response({ok:true,data:{...row(),metadata_json:{image_attachment:true},...(receipt?{status:receipt.receipt.status,triage_version:receipt.receipt.triage_version}:{})}});}});
 try{await f.api.initManagerInbox();const image=imageClick(f);await image.run();assert.equal(image.status.textContent,'Could not load image. Try again.');
  const action=imageClick(f);action.button.dataset.action='resolved';await action.run();await action.run();
  const posts=f.calls.filter(c=>c.opts.method==='POST');assert.equal(posts.length,1);const body=JSON.parse(posts[0].opts.body);
  assert.equal(body.expected_version,version);assert.equal(body.expected_manager_id,id(2));assert.equal(body.expected_credential_id,id(3));
  assert.match(f.els.inboxList.innerHTML,/data-triage-version="b{64}"/);assert.match(f.els.inboxList.innerHTML,/data-action="closed"/);
  assert.ok(f.calls.filter(c=>!c.opts.method&&!c.url.includes('/feedback-api/image/')).every(c=>c.url.endsWith('/'+feedbackId)));
  f.api.stopInbox();assert.equal(f.listeners.has('inbox:click'),false);assert.equal(f.listeners.has('refresh:click'),false);assert.equal(f.listeners.has('filter:change'),false);assert.equal(f.intervals.size,0);
 }finally{f.api.stopInbox();}
});
await check('reload original uncertain command survives page replacement no second POST',async()=>{
 const storage=tabStore(),first=fixture({storage,fetchImpl:async(_url,opts)=>{if(opts.method==='POST')throw Error('Synthetic lost reply');return response({ok:true,data:[row()]});}});
 let next;try{await first.api.initManagerInbox();await assert.rejects(first.api.updateInboxItem(feedbackId,'resolved',version));first.api.stopInbox();
  next=fixture({storage});await next.api.initManagerInbox();assert.doesNotMatch(next.els.inboxList.innerHTML,/data-action="(?:acknowledged|resolved|closed)"/);
  assert.match(next.els.inboxState.textContent,/retained.*disabled.*do not repeat/i);const unload={preventDefault(){this.blocked=true;}};next.listeners.get('beforeunload')(unload);assert.equal(unload.blocked,true);
  await assert.rejects(next.api.updateInboxItem(feedbackId,'resolved',version));
  assert.equal(next.calls.filter(c=>c.opts.method==='POST').length,0);assert.equal(next.keys(),0);
 }finally{first.api.stopInbox();next?.api.stopInbox();}
});
const originalKey='memphis.feedback.triage.original.v1';
const originalBody=()=>({request_id:id(800),status:'resolved',expected_version:version,expected_manager_id:id(2),expected_credential_id:id(3)});
const originalGuard=(body=originalBody())=>JSON.stringify({schema:'custodial.feedback-triage-original-guard.v1',feedback_id:feedbackId,encoded:JSON.stringify(body)});
await check('reload guard is durable before POST stores only bounded original pins and bytes',async()=>{
 const storage=tabStore();let posted;const f=fixture({storage,fetchImpl:async(_url,opts)=>{
  if(opts.method==='POST'){posted=opts.body;const raw=storage.values.get(originalKey);assert.ok(raw);const record=JSON.parse(raw);
   assert.deepEqual(Object.keys(record).sort(),['schema','feedback_id','encoded'].sort());assert.equal(record.encoded,posted);assert.equal(record.feedback_id,feedbackId);
   assert.ok(raw.length<=2048);assert.doesNotMatch(raw,/SYNTHETIC_NOT_A_CREDENTIAL|synthetic-browser|Original|Safe rendered text|2099|attachment|token|message|expires_at/);
   assert.deepEqual(JSON.parse(record.encoded),JSON.parse(opts.body));throw Error('Synthetic lost reply');}
  return response({ok:true,data:[row()]});}});
 try{await f.api.initManagerInbox();await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
  const raw=storage.values.get(originalKey);f.api.stopInbox();assert.equal(storage.values.get(originalKey),raw);assert.equal(storage.calls.filter(c=>c[0]==='remove').length,0);
 }finally{f.api.stopInbox();}
});
await check('reload matching current status version or absent row cannot resolve original',async()=>{
 for(const data of [[{...row(),status:'resolved',triage_version:'b'.repeat(64)}],[]]){const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);
  const f=fixture({storage,fetchImpl:async()=>response({ok:true,data})});try{await f.api.initManagerInbox();await f.api.loadInbox();
   assert.match(f.els.inboxState.textContent,/Unconfirmed triage retained/);assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="(?:acknowledged|resolved|closed)"/);
   assert.equal(storage.values.get(originalKey),raw);assert.equal(storage.calls.filter(c=>c[0]!=='get').length,0);await assert.rejects(f.api.updateInboxItem(feedbackId,'closed','b'.repeat(64)));assert.equal(f.keys(),0);
  }finally{f.api.stopInbox();}}
});
await check('reload foreign manager or credential cannot clear guard or adopt original authority',async()=>{
 for(const patch of [{manager_id:id(90)},{credential_id:id(91)}]){const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);const f=fixture({storage});f.change(patch);
  try{await f.api.initManagerInbox();assert.match(f.els.inboxState.textContent,/locked to an earlier sign-in/);assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="resolved"/);
   await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));await f.api.loadInbox();assert.equal(storage.values.get(originalKey),raw);assert.equal(storage.calls.filter(c=>c[0]!=='get').length,0);assert.equal(f.keys(),0);
  }finally{f.api.stopInbox();}}
});
await check('reload readonly managers keep reads no owner action no storage clearing',async()=>{
 for(const managerId of [id(20),id(30)]){const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);const f=fixture({storage,readOnly:true});f.change({manager_id:managerId});
  try{await f.api.initManagerInbox();assert.match(f.els.inboxList.innerHTML,/Read-only manager view/);assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="(?:acknowledged|resolved|closed)"/);
   await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);assert.ok(f.authCalls.every(c=>c.accessLevel==='read_only'));
   assert.equal(storage.values.get(originalKey),raw);assert.equal(storage.calls.filter(c=>c[0]!=='get').length,0);
  }finally{f.api.stopInbox();}}
});
await check('reload malformed oversized duplicated or acceptance-shaped storage stays locked',async()=>{
 const record=JSON.parse(originalGuard()),body=originalBody();
 for(const raw of ['', 'not JSON','null','x'.repeat(2049),JSON.stringify({...record,state:'ACCEPTED'}),JSON.stringify({...record,encoded:JSON.stringify({...body,message:'PRIVATE_FAKE_TEXT'})}),
  JSON.stringify({...record,encoded:JSON.stringify({...body,expected_version:'bad'})}),JSON.stringify({...record,encoded:JSON.stringify({...body,status:'new'})}),
  originalGuard().replace('"feedback_id":','"feedback_id":"'+id(99)+'","feedback_id":')]){
  const storage=tabStore();storage.values.set(originalKey,raw);const f=fixture({storage});try{await f.api.initManagerInbox();assert.match(f.els.inboxState.textContent,/guard unavailable.*disabled/);
   assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="resolved"|PRIVATE_FAKE_TEXT/);await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));await f.api.loadInbox();
   assert.equal(storage.values.get(originalKey),raw);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);assert.equal(storage.calls.filter(c=>c[0]!=='get').length,0);
  }finally{f.api.stopInbox();}}
});
await check('reload unavailable storage disables commands while normal read remains',async()=>{
 const storage={getItem:()=>{throw Error('Synthetic denied session storage');},setItem:()=>assert.fail('No guard write allowed'),removeItem:()=>assert.fail('No guard removal allowed')};
 const f=fixture({storage});try{await f.api.initManagerInbox();assert.match(f.els.inboxList.innerHTML,/Original/);assert.match(f.els.inboxState.textContent,/guard unavailable/);
  await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);assert.equal(f.keys(),0);
 }finally{f.api.stopInbox();}
});
await check('reload failed guard persistence or readback prevents POST before any possible send',async()=>{
 for(const mode of ['quota','readback']){const storage=tabStore();storage.setItem=(key,value)=>{if(mode==='quota')throw Error('Synthetic quota');storage.values.set(key,'invalid readback');};
  const f=fixture({storage});try{await f.api.initManagerInbox();await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);
   assert.match(f.els.inboxState.textContent,/guard unavailable.*disabled/);await f.api.loadInbox();assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="resolved"/);
  }finally{f.api.stopInbox();}}
});
await check('reload another original appearing while headers wait is never overwritten or sent',async()=>{
 const storage=tabStore();let release;const wait=new Promise(r=>release=r);const f=fixture({storage,headersHook:async(_s,n)=>{if(n===2)await wait;}});
 try{await f.api.initManagerInbox();const command=f.api.updateInboxItem(feedbackId,'resolved',version);await new Promise(r=>setImmediate(r));
  const foreign=originalGuard({...originalBody(),request_id:id(999),expected_credential_id:id(98)});storage.values.set(originalKey,foreign);release();await assert.rejects(command);
  assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);assert.equal(storage.values.get(originalKey),foreign);assert.equal(storage.calls.filter(c=>c[0]!=='get').length,0);
 }finally{f.api.stopInbox();}
});
await check('reload deletion of retained guard in an active page cannot unlock new actions',async()=>{
 const storage=tabStore();storage.values.set(originalKey,originalGuard());const f=fixture({storage});try{await f.api.initManagerInbox();storage.values.delete(originalKey);
  await f.api.loadInbox();assert.match(f.els.inboxState.textContent,/guard unavailable/);assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="resolved"/);
  await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);
 }finally{f.api.stopInbox();}
});
await check('reload only exact live POST receipt releases own original then owner remains usable',async()=>{
 const storage=tabStore(),f=fixture({storage});let next;
 try{await f.api.initManagerInbox();await f.api.updateInboxItem(feedbackId,'acknowledged',version);assert.equal(storage.values.get(originalKey),undefined);assert.equal(storage.calls.filter(c=>c[0]==='remove').length,1);
  assert.match(f.els.inboxList.innerHTML,/data-action="resolved"/);f.api.stopInbox();next=fixture({storage});await next.api.initManagerInbox();assert.match(next.els.inboxList.innerHTML,/data-action="resolved"/);
  assert.equal(next.calls.filter(c=>c.opts.method==='POST').length,0);
 }finally{f.api.stopInbox();next?.api.stopInbox();}
});
await check('reload foreign live receipt keeps original bytes unresolved across new page',async()=>{
 const storage=tabStore(),f=fixture({storage,fetchImpl:async(_url,opts)=>{if(opts.method==='POST'){const p=accepted(JSON.parse(opts.body));p.receipt.request_id=id(99);return response(p);}return response({ok:true,data:[row()]});}});let next;
 try{await f.api.initManagerInbox();await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));const raw=storage.values.get(originalKey);assert.ok(raw);f.api.stopInbox();next=fixture({storage});await next.api.initManagerInbox();
  assert.match(next.els.inboxState.textContent,/retained/);assert.equal(storage.values.get(originalKey),raw);assert.equal(storage.calls.filter(c=>c[0]==='remove').length,0);
 }finally{f.api.stopInbox();next?.api.stopInbox();}
});
await check('reload exact conclusive rejection clears only own guard and requires fresh review',async()=>{
 const storage=tabStore(),f=fixture({storage,fetchImpl:async(_url,opts)=>opts.method==='POST'?response({ok:false,command_rejected:true},409):response({ok:true,data:[row()]})});
 try{await f.api.initManagerInbox();await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(storage.values.get(originalKey),undefined);
  await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);await f.api.loadInbox();assert.match(f.els.inboxList.innerHTML,/data-action="resolved"/);
 }finally{f.api.stopInbox();}
});
await check('reload failed removal after exact acceptance never unlocks or persists fake accepted state',async()=>{
 const storage=tabStore();storage.removeItem=()=>{throw Error('Synthetic removal failure');};const f=fixture({storage});let next;
 try{await f.api.initManagerInbox();await f.api.updateInboxItem(feedbackId,'acknowledged',version);const raw=storage.values.get(originalKey);assert.ok(raw);assert.doesNotMatch(raw,/ACCEPTED|published|receipt/);
  assert.match(f.els.inboxState.textContent,/Triage accepted.*disabled/);assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="resolved"/);
  f.api.stopInbox();next=fixture({storage});await next.api.initManagerInbox();assert.match(next.els.inboxState.textContent,/Unconfirmed triage retained/);assert.equal(storage.values.get(originalKey),raw);
 }finally{f.api.stopInbox();next?.api.stopInbox();}
});
await check('reload employee native and invalid link touch no guard storage',async()=>{
 for(const input of [{hub:'employee'},{native:true},{search:'?feedback=invalid'}]){const storage=tabStore();storage.values.set(originalKey,originalGuard());const f=fixture({...input,storage});
  try{await f.api.initManagerInbox();assert.equal(storage.calls.length,0);assert.equal(f.authCalls.length,0);assert.equal(f.calls.length,0);
  }finally{f.api.stopInbox();}}
});
await check('reload late reply cannot clear an original after credential or storage changed',async()=>{
 for(const mode of ['credential','foreign-storage']){const storage=tabStore();let release,posted;const f=fixture({storage,fetchImpl:async(_url,opts)=>{
  if(opts.method==='POST'){posted=JSON.parse(opts.body);return await new Promise(r=>release=r);}return response({ok:true,data:[row()]});}});let next;
  try{await f.api.initManagerInbox();const command=f.api.updateInboxItem(feedbackId,'resolved',version);await new Promise(r=>setImmediate(r));const original=storage.values.get(originalKey);
   const foreign=originalGuard({...originalBody(),request_id:id(999),expected_credential_id:id(99)});
   if(mode==='credential')f.change({credential_id:id(98)});else storage.values.set(originalKey,foreign);
   release(response(accepted(posted)));if(mode==='credential')await assert.rejects(command);else await command;
   assert.equal(storage.values.get(originalKey),mode==='credential'?original:foreign);assert.equal(storage.calls.filter(c=>c[0]==='remove').length,0);
   f.api.stopInbox();next=fixture({storage});await next.api.initManagerInbox();assert.doesNotMatch(next.els.inboxList.innerHTML,/data-action="resolved"/);
   await assert.rejects(next.api.updateInboxItem(feedbackId,'resolved',version));assert.equal(next.calls.filter(c=>c.opts.method==='POST').length,0);
  }finally{f.api.stopInbox();next?.api.stopInbox();}}
});
const originalApplied=(body=originalBody())=>({ok:true,outcome:'APPLIED',retry_safe:false,
 command:{request_id:body.request_id,feedback_id:feedbackId,status:body.status,expected_version:body.expected_version,expected_manager_id:body.expected_manager_id,expected_credential_id:body.expected_credential_id},receipt:accepted(body).receipt});
await check('original-status same-tab reload actual click clears only exact original and refreshes',async()=>{
 const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);let resolved=false;
 const f=fixture({storage,fetchImpl:async(url,opts)=>{
  if(opts.method==='POST'){assert.equal(new URL(url).pathname,`/dashboard-api/system-feedback/${feedbackId}/triage-status`);assert.equal(opts.body,JSON.parse(raw).encoded);resolved=true;return response(originalApplied());}
  return response({ok:true,data:[resolved?{...row(),status:'resolved',triage_version:'b'.repeat(64)}:row()]});}});
 try{await f.api.initManagerInbox();assert.equal(f.els.inboxCheck.hidden,false);assert.equal(f.els.inboxCheck.disabled,false);
  assert.equal(typeof f.listeners.get('original-status:click'),'function');await f.listeners.get('original-status:click')();
  assert.equal(storage.values.get(originalKey),undefined);assert.equal(storage.calls.filter(c=>c[0]==='remove').length,1);
  assert.equal(f.keys(),0);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);assert.equal(f.calls.length,3);
  assert.equal(f.els.inboxCheck.hidden,true);assert.match(f.els.inboxList.innerHTML,/data-action="closed"/);
 }finally{f.api.stopInbox();}
});
await check('original-status-new live lost reply exposes actual check without another writer or request',async()=>{
 let original,applied=false;const f=fixture({fetchImpl:async(url,opts)=>{
  if(opts.method==='POST'&&new URL(url).pathname.endsWith('/triage-status')){assert.equal(opts.body,original);applied=true;return response(originalApplied(JSON.parse(original)));}
  if(opts.method==='POST'){original=opts.body;throw Error('Synthetic lost writer reply');}
  return response({ok:true,data:[applied?{...row(),status:'resolved',triage_version:'b'.repeat(64)}:row()]});}});
 try{await f.api.initManagerInbox();await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));
  assert.equal(f.els.inboxCheck.hidden,false);assert.equal(f.els.inboxCheck.disabled,false);assert.equal(f.keys(),1);
  await f.listeners.get('original-status:click')();assert.equal(f.keys(),1);assert.equal(f.storage.values.get(originalKey),undefined);
  assert.equal(f.calls.filter(c=>c.opts.method==='POST'&&new URL(c.url).pathname.endsWith('/status')).length,1);
  assert.equal(f.calls.filter(c=>c.opts.method==='POST'&&new URL(c.url).pathname.endsWith('/triage-status')).length,1);
  assert.match(f.els.inboxList.innerHTML,/data-action="closed"/);
 }finally{f.api.stopInbox();}
});
await check('original-status-new unknown absent denied error or coincident item never clears or resends',async()=>{
 for(const mode of ['UNKNOWN','absent','denied','error','json','throw']){const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);
  const f=fixture({storage,fetchImpl:async(_url,opts)=>{
   if(opts.method!=='POST')return response({ok:true,data:[{...row(),status:'resolved',triage_version:'b'.repeat(64)}]});
   if(mode==='throw')throw Error('Synthetic unavailable reader');
   if(mode==='json')return {ok:true,status:200,json:async()=>{throw Error('Synthetic invalid JSON');}};
   return mode==='UNKNOWN'?response({ok:true,outcome:'UNKNOWN',retry_safe:false}):response({ok:false},mode==='absent'?404:mode==='denied'?403:503);
  }});
  try{await f.api.initManagerInbox();await f.listeners.get('original-status:click')();
   assert.equal(storage.values.get(originalKey),raw);assert.equal(storage.calls.filter(c=>c[0]==='remove').length,0);
   assert.match(f.els.inboxState.textContent,/unconfirmed.*locked.*do not resend/);assert.equal(f.els.inboxCheck.disabled,false);
   await f.api.loadInbox();assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="closed"/);
   await assert.rejects(f.api.updateInboxItem(feedbackId,'closed','b'.repeat(64)));assert.equal(f.keys(),0);
   assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
  }finally{f.api.stopInbox();}
 }
});
await check('original-status-new closed original command and typed receipt reject mismatches and raw extras',async()=>{
 const mutations=[p=>{p.raw_mail='<script>secret</script>';},p=>{p.retry_safe=true;},p=>{p.ok='true';},p=>{p.outcome='ACCEPTED';},
  ...['request_id','feedback_id','expected_manager_id','expected_credential_id'].map(k=>p=>{p.command[k]=id(99);}),
  p=>{p.command.status='closed';},p=>{p.command.expected_version='c'.repeat(64);},p=>{delete p.command.expected_version;},p=>{p.command.raw='private';},
  ...['request_id','feedback_id','actor_manager_id','actor_credential_id'].map(k=>p=>{p.receipt[k]=id(99);}),
  p=>{p.receipt.status='closed';},p=>{p.receipt.triage_version=version;},p=>{p.receipt.triage_version=null;},
  p=>{p.receipt.accepted_at='Jan 1 2026';},p=>{p.receipt.accepted_at='<script>alert(1)</script>';},p=>{p.receipt.accepted_at='2026-99-99T99:00:00Z';},
  p=>{p.receipt.notes='private';},p=>{delete p.receipt.actor_credential_id;},p=>{p.command=[];},p=>{p.receipt=[];},p=>{p.command=null;}];
 for(const mutate of mutations){const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);const p=originalApplied();mutate(p);
  const f=fixture({storage,fetchImpl:async(_url,opts)=>opts.method==='POST'?response(p):response({ok:true,data:[row()]})});
  try{await f.api.initManagerInbox();await f.listeners.get('original-status:click')();assert.equal(storage.values.get(originalKey),raw);
   assert.equal(storage.calls.filter(c=>c[0]==='remove').length,0);assert.match(f.els.inboxState.textContent,/unconfirmed/);
   assert.doesNotMatch(f.els.inboxState.textContent,/<script>|private|secret/);assert.equal(f.keys(),0);assert.equal(f.calls.length,2);
  }finally{f.api.stopInbox();}
 }
});
await check('original-status-new double click waits on one original receipt read',async()=>{
 const storage=tabStore();storage.values.set(originalKey,originalGuard());let release;
 const f=fixture({storage,fetchImpl:async(_url,opts)=>opts.method==='POST'?await new Promise(r=>release=r):response({ok:true,data:[row()]})});
 try{await f.api.initManagerInbox();const click=f.listeners.get('original-status:click'),pending=click();await new Promise(r=>setImmediate(r));
  assert.equal(f.els.inboxCheck.disabled,true);await click();assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
  release(response({ok:true,outcome:'UNKNOWN',retry_safe:false}));await pending;assert.equal(f.els.inboxCheck.disabled,false);assert.equal(f.keys(),0);
 }finally{f.api.stopInbox();}
});
await check('original-status-new changed actor guard generation or exit before headers prevents status send',async()=>{
 for(const mode of ['manager','credential','token','capability','guard','refresh','exit']){
  const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);let release;
  const f=fixture({storage,headersHook:async(_s,n)=>{if(n===2)await new Promise(r=>release=r);}});
  try{await f.api.initManagerInbox();const pending=f.listeners.get('original-status:click')();await new Promise(r=>setImmediate(r));
   if(mode==='manager')f.change({manager_id:id(99)});else if(mode==='credential')f.change({credential_id:id(99)});
   else if(mode==='token')f.change({token:'SYNTHETIC_CHANGED'});else if(mode==='capability')f.change({read_only:true});
   else if(mode==='guard')storage.values.set(originalKey,originalGuard({...originalBody(),request_id:id(999)}));
   else if(mode==='refresh')await f.api.loadInbox();else f.listeners.get('pagehide')();
   release();await pending;assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);
   assert.equal(storage.calls.filter(c=>c[0]==='remove').length,0);assert.equal(f.keys(),0);
   if(['manager','credential','token','capability','exit'].includes(mode))assert.equal(f.listeners.has('original-status:click'),false);
  }finally{f.api.stopInbox();}
 }
});
await check('original-status-new awaited HTTP or JSON reply cannot clear after currentness changed',async()=>{
 for(const stage of ['http','json'])for(const mode of ['credential','guard','delete','refresh','exit']){
  const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);let release,signal;
  const f=fixture({storage,fetchImpl:async(_url,opts)=>{
   if(opts.method!=='POST')return response({ok:true,data:[row()]});signal=opts.signal;
   return stage==='http'?await new Promise(r=>release=r):{ok:true,status:200,json:()=>new Promise(r=>release=r)};
  }});
  try{await f.api.initManagerInbox();const pending=f.listeners.get('original-status:click')();await new Promise(r=>setImmediate(r));
   const foreign=originalGuard({...originalBody(),request_id:id(999)});
   if(mode==='credential')f.change({credential_id:id(99)});else if(mode==='guard')storage.values.set(originalKey,foreign);
   else if(mode==='delete')storage.values.delete(originalKey);else if(mode==='refresh')await f.api.loadInbox();else f.listeners.get('pagehide')();
   release(stage==='http'?response(originalApplied()):originalApplied());await pending;
   assert.equal(storage.calls.filter(c=>c[0]==='remove').length,0);assert.equal(storage.values.get(originalKey),mode==='guard'?foreign:mode==='delete'?undefined:raw);
   assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);assert.equal(f.keys(),0);
   assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="resolved"/);
   if(['credential','refresh','exit'].includes(mode))assert.equal(signal.aborted,true);
  }finally{f.api.stopInbox();}
 }
});
await check('original-status-new storage failure during exact proof stays locked across reload',async()=>{
 for(const mode of ['remove','readback']){const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);
  storage.removeItem=()=>{if(mode==='remove')throw Error('Synthetic denied removal');};
  const f=fixture({storage,fetchImpl:async(_url,opts)=>opts.method==='POST'?response(originalApplied()):response({ok:true,data:[row()]})});let next;
  try{await f.api.initManagerInbox();await f.listeners.get('original-status:click')();assert.equal(storage.values.get(originalKey),raw);
   assert.equal(f.els.inboxCheck.hidden,true);await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));
   f.api.stopInbox();next=fixture({storage});await next.api.initManagerInbox();assert.doesNotMatch(next.els.inboxList.innerHTML,/data-action="resolved"/);
   assert.equal(next.calls.filter(c=>c.opts.method==='POST').length,0);
  }finally{f.api.stopInbox();next?.api.stopInbox();}
 }
});
await check('original-status-new readonly foreign invalid employee native or invalid link expose no check',async()=>{
 for(const mode of ['readonly','foreign','invalid','employee','native','link']){const storage=tabStore();storage.values.set(originalKey,mode==='invalid'?'invalid':mode==='foreign'?originalGuard({...originalBody(),expected_credential_id:id(99)}):originalGuard());
  const f=fixture({storage,readOnly:mode==='readonly',hub:mode==='employee'?'employee':'manager',native:mode==='native',search:mode==='link'?'?feedback=invalid':''});
  try{await f.api.initManagerInbox();assert.equal(f.els.inboxCheck.hidden,true);
   if(['readonly','employee','native','link'].includes(mode))assert.equal(f.listeners.has('original-status:click'),false);
   await f.api.checkOriginalTriageStatus();assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);
   assert.equal(storage.calls.filter(c=>c[0]==='remove').length,0);assert.equal(f.keys(),0);
  }finally{f.api.stopInbox();}
 }
});
await check('original-status-calendar rejects normalized impossible date and unbounded timestamp',async()=>{
 for(const accepted_at of ['2026-02-30T12:00:00Z','2026-10-11T17:43:00.'+'0'.repeat(1000)+'Z']){
  const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);const p=originalApplied();p.receipt.accepted_at=accepted_at;
  const f=fixture({storage,fetchImpl:async(_url,opts)=>opts.method==='POST'?response(p):response({ok:true,data:[row()]})});
  try{await f.api.initManagerInbox();await f.listeners.get('original-status:click')();assert.equal(storage.values.get(originalKey),raw);
   assert.equal(storage.calls.filter(c=>c[0]==='remove').length,0);assert.equal(f.keys(),0);
  }finally{f.api.stopInbox();}
 }
});
await check('original-status-reload actual lost writer response survives exit then exact reader click',async()=>{
 const storage=tabStore();let original;
 const first=fixture({storage,fetchImpl:async(_url,opts)=>{if(opts.method==='POST'){original=opts.body;throw Error('Synthetic lost response');}return response({ok:true,data:[row()]});}});let next;
 try{await first.api.initManagerInbox();await assert.rejects(first.api.updateInboxItem(feedbackId,'resolved',version));const raw=storage.values.get(originalKey);
  first.listeners.get('pagehide')();assert.equal(first.listeners.has('original-status:click'),false);
  next=fixture({storage,fetchImpl:async(url,opts)=>{
   if(opts.method==='POST'){assert.equal(new URL(url).pathname,`/dashboard-api/system-feedback/${feedbackId}/triage-status`);assert.equal(opts.body,original);assert.equal(storage.values.get(originalKey),raw);return response(originalApplied(JSON.parse(original)));}
   return response({ok:true,data:[{...row(),status:'resolved',triage_version:'b'.repeat(64)}]});}});
  await next.api.initManagerInbox();assert.equal(next.calls.length,1);assert.equal(storage.values.get(originalKey),raw);
  await next.listeners.get('original-status:click')();assert.equal(storage.values.get(originalKey),undefined);assert.equal(next.keys(),0);
  assert.equal(next.calls.filter(c=>c.opts.method==='POST').length,1);assert.match(next.els.inboxList.innerHTML,/data-action="closed"/);
 }finally{first.api.stopInbox();next?.api.stopInbox();}
});
await check('receipt-time status hour24 preserves uncertain original guard',async()=>{
 const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);const p=originalApplied();p.receipt.accepted_at='2026-10-11T24:00:00Z';
 const f=fixture({storage,fetchImpl:async(_url,opts)=>opts.method==='POST'?response(p):response({ok:true,data:[row()]})});
 try{await f.api.initManagerInbox();await f.listeners.get('original-status:click')();
  assert.equal(storage.values.get(originalKey),raw);assert.equal(storage.calls.filter(c=>c[0]==='remove').length,0);assert.equal(f.keys(),0);
  assert.match(f.els.inboxState.textContent,/unconfirmed/);
 }finally{f.api.stopInbox();}
});
await check('receipt-time write hour24 preserves uncertain original guard',async()=>{
 const f=fixture({fetchImpl:async(_url,opts)=>{if(opts.method==='POST'){const p=accepted(JSON.parse(opts.body));p.receipt.accepted_at='2026-10-11T24:00:00Z';return response(p);}return response({ok:true,data:[row()]});}});
 try{await f.api.initManagerInbox();await assert.rejects(f.api.updateInboxItem(feedbackId,'resolved',version));
  assert.ok(f.storage.values.get(originalKey));assert.equal(f.storage.calls.filter(c=>c[0]==='remove').length,0);
  assert.match(f.els.inboxState.textContent,/unconfirmed/);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
 }finally{f.api.stopInbox();}
});
const receiptTimeValid=[
 '2026-10-11T17:43:00.000001+00:00',
 '2026-10-11T17:43:00.123456+00:00',
 '0001-01-01T00:00:00Z','9999-12-31T23:59:59.999999-23:59',
 '2000-02-29T12:34:56.1Z','2024-02-29T00:00:00+23:59',
 '1900-02-28T23:59:59-00:00','2026-10-11T17:43:00Z'
];
const receiptTimeInvalid=[
 '2026-10-11T24:00:00Z','2026-10-11T23:60:00Z','2026-10-11T23:59:60Z',
 '2026-10-11T99:00:00Z','2026-10-11T17:43:00+24:00','2026-10-11T17:43:00-00:60',
 '2026-10-11T17:43:00+99:99','2026-10-11T17:43:00+0:00','2026-10-11T17:43:00+00:0',
 '2026-10-11T17:43:00+0000','2026-10-11T17:43:00+00:00:00','2026-10-11T17:43:00z',
 '2026-10-11T17:43:00.Z','2026-10-11T17:43:00.1234567+00:00',
 '2026-10-11T17:43:00.'+'0'.repeat(1000)+'Z','2026-10-11T17:43:00,1Z',
 '2026-10-11T17:43:00.1.2Z','2026-10-11T17:43Z','2026-10-11T7:43:00Z',
 '2026-10-11 17:43:00Z','2026-10-11t17:43:00Z','2026-10-11T17:43:00Z\n',
 ' 2026-10-11T17:43:00Z','2026-02-31T00:00:00Z','2026-02-30T12:00:00Z',
 '1900-02-29T00:00:00Z','2100-02-29T00:00:00Z','0000-01-01T00:00:00Z',
 '10000-01-01T00:00:00Z','2026-00-01T00:00:00Z','2026-13-01T00:00:00Z',
 '2026-01-00T00:00:00Z','2026-04-31T00:00:00Z',null,0,{accepted_at:'2026-10-11T17:43:00Z'}
];
await check('receipt-time both actual acceptance predicates exact SQL bytes and invalid civil fields',async()=>{
 const f=fixture(),body=originalBody(),command={body,feedbackId};
 try{for(const [expected,values]of [[true,receiptTimeValid],[false,receiptTimeInvalid]])for(const accepted_at of values){
   const write=accepted(body),status=originalApplied(body);write.receipt.accepted_at=status.receipt.accepted_at=accepted_at;
   assert.equal(f.api.exactTriageReceipt(write,command),expected,`write ${JSON.stringify(accepted_at)}`);
   assert.equal(f.api.exactOriginalStatus(status,command),expected,`status ${JSON.stringify(accepted_at)}`);
   assert.equal(write.receipt.accepted_at,accepted_at);assert.equal(status.receipt.accepted_at,accepted_at);
  }
  assert.equal(f.calls.length,0);assert.equal(f.keys(),0);assert.equal(f.authCalls.length,0);
 }finally{f.api.stopInbox();}
});
await check('receipt-time exact SQL microseconds offset flows through both consumers unchanged',async()=>{
 const accepted_at=receiptTimeValid[0];let written;
 const write=fixture({fetchImpl:async(_url,opts)=>{if(opts.method==='POST'){const p=accepted(JSON.parse(opts.body));p.receipt.accepted_at=accepted_at;written=p.receipt;return response(p);}
  return response({ok:true,data:[written?{...row(),status:written.status,triage_version:written.triage_version}:row()]});}});
 const storage=tabStore();storage.values.set(originalKey,originalGuard());let checked;
 const status=fixture({storage,fetchImpl:async(_url,opts)=>{if(opts.method==='POST'){const p=originalApplied();p.receipt.accepted_at=accepted_at;checked=p.receipt;return response(p);}
  return response({ok:true,data:[checked?{...row(),status:checked.status,triage_version:checked.triage_version}:row()]});}});
 try{await write.api.initManagerInbox();await write.api.updateInboxItem(feedbackId,'resolved',version);
  assert.equal(written.accepted_at,accepted_at);assert.equal(write.storage.values.get(originalKey),undefined);assert.match(write.els.inboxList.innerHTML,/data-action="closed"/);
  await status.api.initManagerInbox();await status.listeners.get('original-status:click')();
  assert.equal(checked.accepted_at,accepted_at);assert.equal(storage.values.get(originalKey),undefined);assert.match(status.els.inboxList.innerHTML,/data-action="closed"/);
  assert.equal(write.calls.filter(c=>c.opts.method==='POST').length,1);assert.equal(status.calls.filter(c=>c.opts.method==='POST').length,1);assert.equal(status.keys(),0);
 }finally{write.api.stopInbox();status.api.stopInbox();}
});
await check('route-binding current mounted original status path actual click preserves original command',async()=>{
 const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);let saved=false;
 const f=fixture({storage,fetchImpl:async(url,opts)=>{
  const path=new URL(url).pathname;
  if(opts.method==='POST'){
   assert.equal(path,`/dashboard-api/system-feedback/${feedbackId}/triage-status`);
   assert.equal(opts.body,JSON.parse(raw).encoded);assert.equal(opts.cache,'no-store');assert.equal(opts.credentials,'include');
   assert.equal(storage.values.get(originalKey),raw);saved=true;return response(originalApplied());
  }
  assert.equal(path,'/dashboard-api/system-feedback');return response({ok:true,data:[saved?{...row(),status:'resolved',triage_version:'b'.repeat(64)}:row()]});
 }});
 try{await f.api.initManagerInbox();await f.listeners.get('original-status:click')();
  assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);assert.equal(f.keys(),0);
  assert.equal(storage.values.get(originalKey),undefined);assert.match(f.els.inboxList.innerHTML,/data-action="closed"/);
 }finally{f.api.stopInbox();}
});
await check('route-binding mounted reader unavailable denied or UNKNOWN never falls back to writer',async()=>{
 for(const mode of ['unavailable','denied','UNKNOWN']){const storage=tabStore(),raw=originalGuard();storage.values.set(originalKey,raw);
  const f=fixture({storage,fetchImpl:async(url,opts)=>{
   if(opts.method!=='POST')return response({ok:true,data:[row()]});
   assert.equal(new URL(url).pathname,`/dashboard-api/system-feedback/${feedbackId}/triage-status`);assert.equal(opts.body,JSON.parse(raw).encoded);
   return mode==='UNKNOWN'?response({ok:true,outcome:'UNKNOWN',retry_safe:false}):response({ok:false,outcome:'UNKNOWN',retry_safe:false,code:mode==='denied'?'feedback_triage_status_auth_required':'feedback_triage_status_unconfirmed',error:'Exact original triage outcome is not confirmed.'},mode==='denied'?401:503);
  }});
  try{await f.api.initManagerInbox();await f.listeners.get('original-status:click')();assert.equal(storage.values.get(originalKey),raw);
   assert.equal(f.keys(),0);assert.equal(storage.calls.filter(c=>c[0]==='remove').length,0);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
   assert.match(f.els.inboxState.textContent,/unconfirmed.*locked.*do not resend/);assert.doesNotMatch(f.els.inboxList.innerHTML,/data-action="resolved"/);
  }finally{f.api.stopInbox();}
 }
});
console.log('FEEDBACK_TRIAGE_AFFECTED_CASES '+tests.length);
