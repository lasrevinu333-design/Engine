// Actual NewConversation mounted with the installed React/ReactDOM in isolated
// Chromium. Only this component's JSX is transformed in memory for the fixture;
// no product bundle/build, emitted JS, real API, user browser or phone is used.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../mobile/src/chatscope/app.jsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('app.jsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
const functions=names=>names.map(name=>{const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(node,'actual function '+name);return node.getText(ast);}).join('\n');
const component=functions(['NewConversation']);
const helpers=functions(['readOriginalGroupIntent','originalReadObjectKeys','isUuid','operationId']);
const transformed=ts.transpileModule(helpers+'\n'+component,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,module:ts.ModuleKind.None},reportDiagnostics:true});
assert.equal((transformed.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const marker='onCreated={async (id,assertCurrent,retireOriginal) => {';
const start=source.indexOf(marker),end=source.indexOf(' }} />}',start);assert.ok(start>0&&end>start);
const parent='async (id,assertCurrent,retireOriginal) => {'+source.slice(start+marker.length,end)+' }';

// Load unchanged installed CJS runtime files, with a tiny fixture-only loader.
// This deliberately avoids invoking the app's bundler/build scripts.
const modules={};
function add(name,file){modules[name]=readFileSync(file,'utf8');}
for(const name of ['react','react-dom','react-dom/client','scheduler']){
 const file=require.resolve(name),base=dirname(file);add(name,file);
 const dev=name==='react'?'react.development.js':name==='react-dom'?'react-dom.development.js':name==='react-dom/client'?'react-dom-client.development.js':'scheduler.development.js';
 add((name==='react-dom/client'?'react-dom':name)+'/cjs/'+dev,resolve(base,'cjs',dev));
}
const runtime=`(()=>{const sources=${JSON.stringify(modules)},cache={};function load(id){if(cache[id])return cache[id].exports;const module={exports:{}};cache[id]=module;function req(name){if(name.startsWith('./'))name=(id==='react-dom/client'?'react-dom':id)+'/:'+name.slice(2);name=name.replace('/:/','/').replace('/:','/');return load(name);}if(!(id in sources))throw Error('Unmapped fixture runtime '+id);new Function('require','module','exports','process',sources[id])(req,module,module.exports,{env:{NODE_ENV:'development'}});return module.exports;}window.React=load('react');window.__createRoot=load('react-dom/client').createRoot;})();`;
const results=[];let browser;
async function fixture(mode='normal',employee=false){
 const context=await browser.newContext({viewport:{width:412,height:900}});
 await context.route('**/*',route=>route.request().url()==='https://fixture.invalid/dialog'
  ?route.fulfill({contentType:'text/html',body:'<!doctype html><button id="outside">Prior focus</button><div id="fixture"></div>'})
  :route.abort('blockedbyclient'));
 const page=await context.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://fixture.invalid/dialog');await page.locator('#outside').focus();await page.addScriptTag({content:runtime});
 await page.evaluate(({mode,employee,parent})=>{
  const id=n=>`dc000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const actor=id(1),peer=id(2),peer2=id(3),intent=id(4),thread=id(5),device='SYNTHETIC_DEVICE';
  const originalDate=Date;let offset=0;
  class Clock extends originalDate {constructor(...args){super(...(args.length?args:[originalDate.now()+offset]));}static now(){return originalDate.now()+offset;}}
  window.Date=Clock;window.__advance=ms=>offset+=ms;
  window.EMPLOYEE_CONTEXT=employee;
  const mapped={msg_user_id:actor,canonical_device_id:device,read_only:false};let current=mapped;
  const session={token:'SYNTHETIC',manager_id:id(9),credential_id:id(10),device_id:device,role:'ops_manager',access_level:'full_access',read_only:false,expires_at:new originalDate(originalDate.now()+86400000).toISOString(),permissions:{schema:'custodial.manager-permissions.v1',read:true}};
  window.MemphisAuth={readSession:()=>session};
  window.__calls=[];window.__selected=[];window.__closed=0;window.__switchOwner=()=>{current={...mapped};};window.__identity=()=>current;
  window.deviceId=()=>device;window.custodialEmployeeMessage=()=>false;
  window.mutateCustodialWork=async fn=>fn({assertCurrent(){if(current!==mapped)throw Error('Synthetic stale owner');}});
  window.displayName=value=>String(value||'');window.roleTitle=()=>employee?'Employee':'Leadership';window.messengerAvatar=()=>null;
  localStorage.setItem('fixture:opaque-original','PRESERVED_DRAFT_AND_DELETE_BYTES');
  window.__groupBody=null;window.__issueCount=0;window.__consumeCount=0;
  window.api=async(path,options={})=>{
   window.__calls.push({path,body:options.body?structuredClone(options.body):null});
   options.assertCurrent?.();
   if(path.startsWith('/users?'))return{ok:true,data:[{id:peer,display_name:'Fixture Peer',role:'manager',is_active:true},{id:peer2,display_name:'Fixture Second',role:'manager',is_active:true}]};
   if(path==='/thread/direct-intent'){
    window.__issueCount++;
    if(mode==='delayed-issue'||mode==='owner-change')await new Promise(resolve=>{window.__releaseIssue=resolve;});
    return{ok:true,meta:{open_protocol:2},data:{intent_id:intent,request_id:options.body.request_id}};
   }
   if(path==='/thread/direct'){
    window.__consumeCount++;
    if((mode==='lost-consume'||mode==='expired')&&window.__consumeCount===1)throw Error('Synthetic lost consume response');
    if(mode==='array')return{ok:true,data:[{id:thread}]};
    return{ok:true,data:{id:thread}};
   }
   if(path==='/thread/group'){
    window.__groupBody=structuredClone(options.body);
    return{ok:true,data:{id:thread,thread_type:'group',created_by_user_id:actor,client_thread_id:options.body.client_thread_id,is_active:true,deleted_at:null,original_group_creation:{schema:'custodial.group-original-creation.v1',created_by_user_id:actor,client_thread_id:options.body.client_thread_id,title:options.body.title,member_user_ids:options.body.member_user_ids}}};
   }
   throw Error('Unexpected fixture API '+path);
  };
  window.loadThreads=async({assertCurrent})=>{assertCurrent();return mode==='hidden'||mode==='group-hidden'?[]:[{id:thread,type:window.__groupBody?'group':'direct'}];};
  window.selectThread=id=>window.__selected.push(id);
  window.setNewConversation=value=>{if(value===false){window.__closed++;window.__root.unmount();}};
  window.__parent=new Function('return ('+parent+')')();
  window.__mountComponent=()=>{
   window.__root=window.__createRoot(document.querySelector('#fixture'));
   window.__root.render(React.createElement(window.__NewConversation,{currentUserId:actor,currentDeviceId:device,getCurrentIdentity:window.__identity,onCreated:window.__parent,onClose:()=>{window.__closed++;window.__root.unmount();}}));
  };
 },{mode,employee,parent});
 await page.addScriptTag({content:`const {useState,useRef,useEffect}=React;${transformed.outputText}\nwindow.__NewConversation=NewConversation;window.__mountComponent();`});
 await page.getByRole('dialog').waitFor();await page.getByText('Fixture Peer',{exact:true}).waitFor();
 return{context,page,errors};
}
async function choose(f,group=false){
 await f.page.getByRole('checkbox').nth(0).check();if(group)await f.page.getByRole('checkbox').nth(1).check();
}
async function check(name,fn){await fn();results.push({name,pass:true});}
async function intact(page){assert.equal(await page.evaluate(()=>localStorage.getItem('fixture:opaque-original')),'PRESERVED_DRAFT_AND_DELETE_BYTES');}
try{
 browser=await chromium.launch({headless:true});
 await check('mounted manager dialog opens same direct result only after list confirmation',async()=>{const f=await fixture();try{assert.equal(await f.page.getByRole('button',{name:'Open conversation',exact:true}).isEnabled(),false);await choose(f);await f.page.getByRole('button',{name:'Open conversation',exact:true}).click();await f.page.getByRole('dialog').waitFor({state:'detached'});assert.deepEqual(await f.page.evaluate(()=>__calls.filter(c=>c.path.startsWith('/thread/')).map(c=>c.path)),['/thread/direct-intent','/thread/direct']);assert.equal(await f.page.evaluate(()=>__selected.length),1);await intact(f.page);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}});
 await check('mounted employee tap uses direct protocol without displaying manager selectors',async()=>{const f=await fixture('normal',true);try{assert.equal(await f.page.getByRole('checkbox').count(),0);await f.page.getByRole('button',{name:/Fixture Peer/}).click();await f.page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await f.page.evaluate(()=>__consumeCount),1);await intact(f.page);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}});
 await check('missing list result retains visible dialog, explanation, cancel and prior focus',async()=>{const f=await fixture('hidden');try{await choose(f);await f.page.getByRole('button',{name:'Open conversation',exact:true}).click();await f.page.getByText('This conversation is not available in your current list. It was not opened.',{exact:true}).waitFor();assert.equal(await f.page.evaluate(()=>__selected.length),0);await intact(f.page);await f.page.getByRole('button',{name:'Cancel',exact:true}).click();await f.page.getByRole('dialog').waitFor({state:'detached'});await f.page.waitForFunction(()=>document.activeElement===document.querySelector('#outside'));assert.deepEqual(f.errors,[]);}finally{await f.context.close();}});
 await check('delayed issuance disables cancel/open and ignores Escape until same request settles',async()=>{const f=await fixture('delayed-issue');try{await choose(f);await f.page.getByRole('button',{name:'Open conversation',exact:true}).click();await f.page.waitForFunction(()=>typeof __releaseIssue==='function');assert.equal(await f.page.getByRole('button',{name:'Cancel',exact:true}).isEnabled(),false);assert.equal(await f.page.getByRole('button',{name:'Open conversation',exact:true}).isEnabled(),false);await f.page.getByRole('dialog').press('Escape');assert.equal(await f.page.getByRole('dialog').count(),1);await f.page.evaluate(()=>__releaseIssue());await f.page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await f.page.evaluate(()=>__issueCount),1);await intact(f.page);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}});
 await check('late issuance after actual React unmount does not consume or select',async()=>{const f=await fixture('delayed-issue');try{await choose(f);await f.page.getByRole('button',{name:'Open conversation',exact:true}).click();await f.page.waitForFunction(()=>typeof __releaseIssue==='function');await f.page.evaluate(()=>{__root.unmount();__releaseIssue();});await f.page.getByRole('dialog').waitFor({state:'detached'});await f.page.evaluate(()=>Promise.resolve().then(()=>Promise.resolve()));assert.equal(await f.page.evaluate(()=>__consumeCount),0);assert.equal(await f.page.evaluate(()=>__selected.length),0);await intact(f.page);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}});
 await check('owner switch during issuance blocks consume in mounted dialog',async()=>{const f=await fixture('owner-change');try{await choose(f);await f.page.getByRole('button',{name:'Open conversation',exact:true}).click();await f.page.waitForFunction(()=>typeof __releaseIssue==='function');await f.page.evaluate(()=>{__switchOwner();__releaseIssue();});await f.page.getByText('Could not open that person. Try again.',{exact:true}).waitFor();assert.equal(await f.page.evaluate(()=>__consumeCount),0);assert.equal(await f.page.evaluate(()=>__selected.length),0);await intact(f.page);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}});
 await check('retry after uncertain consume preserves exact server intent and original storage',async()=>{const f=await fixture('lost-consume');try{await choose(f);await f.page.getByRole('button',{name:'Open conversation',exact:true}).click();await f.page.getByText('Could not open that person. Try again.',{exact:true}).waitFor();await f.page.getByRole('button',{name:'Open conversation',exact:true}).click();await f.page.getByRole('dialog').waitFor({state:'detached'});const calls=await f.page.evaluate(()=>__calls.filter(c=>c.path==='/thread/direct'));assert.equal(calls.length,2);assert.deepEqual(calls[0].body,calls[1].body);assert.equal(await f.page.evaluate(()=>__issueCount),1);await intact(f.page);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}});
 await check('expired held request gives actionable guidance without new issuance',async()=>{const f=await fixture('expired');try{await choose(f);await f.page.getByRole('button',{name:'Open conversation',exact:true}).click();await f.page.getByText('Could not open that person. Try again.',{exact:true}).waitFor();await f.page.evaluate(()=>__advance(15*60*1000));await f.page.getByRole('button',{name:'Open conversation',exact:true}).click();await f.page.getByText('This open request expired. Close this window and choose the person again.',{exact:true}).waitFor();assert.equal(await f.page.evaluate(()=>__issueCount),1);assert.equal(await f.page.evaluate(()=>__consumeCount),1);await intact(f.page);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}});
 for(const hidden of [false,true])await check(hidden?'group list absence preserves its exact durable original':'group confirmation retires only its matched original after list presence',async()=>{const f=await fixture(hidden?'group-hidden':'normal');try{await choose(f,true);await f.page.getByPlaceholder('Group name (optional)').fill('Fixture group');await f.page.getByRole('button',{name:'Open group',exact:true}).click();if(hidden){await f.page.getByText('Group result not confirmed. The original group is saved.',{exact:true}).waitFor();const saved=await f.page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('mz_chatscope_group_pending:'));return{raw:localStorage.getItem(key),body:__groupBody};});assert.deepEqual(JSON.parse(saved.raw),saved.body);assert.equal(await f.page.evaluate(()=>__selected.length),0);}else{await f.page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await f.page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('mz_chatscope_group_pending:')).length),0);assert.equal(await f.page.evaluate(()=>__selected.length),1);}await intact(f.page);assert.deepEqual(f.errors,[]);}finally{await f.context.close();}});
 const result={scope:'Actual current NewConversation mounted with installed React/ReactDOM in isolated Chromium; synthetic authority/API, component-only in-memory JSX test transform, no app bundle, real account/network/device or release proof',passed:results.length,results,current_source_sha256:createHash('sha256').update(source).digest('hex'),product_build:false};
 console.log(JSON.stringify(result,null,2));if(process.env.MZ_MOUNTED_RESULTS)writeFileSync(process.env.MZ_MOUNTED_RESULTS,JSON.stringify(result,null,2)+'\n');
}finally{await browser?.close();console.log('OWNED_SYNTHETIC_BROWSER_CLOSED');}
