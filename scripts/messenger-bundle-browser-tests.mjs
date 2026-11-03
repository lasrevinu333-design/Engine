import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const bundle=readFileSync(new URL('../chatscope-messenger.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../chatscope-messenger.css',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true});let context;
try {
 context=await browser.newContext({viewport:{width:1100,height:800}});
 const intercepted=[];await context.route('**/*',route=>{
  intercepted.push(route.request().url());
  if(route.request().url()==='https://synthetic.invalid/messages.html')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><div id="chatscope-root"></div></body></html>'});
  return route.abort('blockedbyclient');
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('https://synthetic.invalid/messages.html');
 await page.evaluate(()=>{
  const id=n=>`b1220000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const session={token:'synthetic-current-cohort-token',manager_id:id(1),credential_id:id(2),device_id:id(3),role:'ops_manager',roles:['CUSTODIAL_MANAGER'],access_level:'full_access',read_only:false,expires_at:new Date(Date.now()+3600000).toISOString(),permissions:{schema:'custodial.manager-permissions.v1',read:true}};
  window.MemphisAuth={getDeviceId:()=>session.device_id,readSession:()=>session,requireOpsManagerSession:async()=>session,isReadOnlySession:()=>false,
   opsManagerAuthHeaders:async()=>({Authorization:'Bearer '+session.token,'X-Device-Id':session.device_id,'X-CSRF-Token':'synthetic-current-csrf'})};
  const thread=id(4),user=id(5),rows=Array.from({length:201},(_,i)=>({id:id(1000+i),thread_id:thread,sender_user_id:id(6),sender_display_name:'Synthetic peer',body:i===0?'Oldest retained fixture':`Retained fixture ${i+1}`,message_type:'text',sent_at:'2026-10-31T12:00:00.123456Z',created_at:'2026-10-31T12:00:00.123456Z',updated_at:'2026-10-31T12:00:00.123456Z',is_deleted:false}));
  window.__calls=[];window.__rows=rows;window.__releaseUpdates=null;
  // Replace fetch before the unchanged shipped bundle executes. No API request
  // reaches networking; the context blocks every non-fixture navigation/asset.
  window.fetch=async(url,options={})=>{
   const u=new URL(url);window.__calls.push({path:u.pathname+u.search,method:options.method,headers:options.headers});
   let data=[];
   if(u.pathname.endsWith('/me/by-device'))data={msg_user_id:user,display_name:'Synthetic name (shared PIN)',role:'manager',canonical_device_id:session.device_id,read_only:false};
   else if(u.pathname.endsWith('/threads'))data=[{id:thread,thread_type:'direct',thread_title:'Synthetic conversation',participant_names:'Synthetic peer',viewer_can_send:true}];
   else if(u.pathname.endsWith('/messages'))data=u.searchParams.has('before')?rows.slice(0,1):rows.slice(-200);
   else if(u.pathname.endsWith('/updates'))return new Promise((resolve,reject)=>{
    const aborted=()=>reject(new DOMException('Synthetic request closed','AbortError'));options.signal?.addEventListener('abort',aborted,{once:true});
    if(u.pathname.includes('/thread/'))window.__releaseUpdates=()=>{const row={...rows.at(-1),id:id(1201),body:'New live fixture',sent_at:'2026-10-31T12:00:01Z',updated_at:'2026-10-31T12:00:01Z'};rows.push(row);resolve(new Response(JSON.stringify({ok:true,data:[row],meta:{next_cursor:{after:row.updated_at,after_id:row.id}}})));};
   });
   else if(u.pathname.endsWith('/read'))data=1;
   else throw Error('Unexpected synthetic request '+u.pathname);
   return new Response(JSON.stringify({ok:true,data,meta:{}}),{status:200,headers:{'content-type':'application/json'}});
  };
 });
 await page.addStyleTag({content:css});await page.addScriptTag({content:bundle});
 await page.getByRole('button',{name:'Earlier messages',exact:true}).waitFor({state:'visible',timeout:10000});
 assert.equal(await page.getByText('Oldest retained fixture',{exact:true}).count(),0);
 const readBefore=await page.evaluate(()=>window.__calls.filter(c=>c.path.endsWith('/read')).length);
 await page.getByRole('button',{name:'Earlier messages',exact:true}).click();
 await page.getByText('Oldest retained fixture',{exact:true}).waitFor({state:'attached'});
 assert.equal(await page.locator('.cs-message').count(),201);
 const calls=await page.evaluate(()=>window.__calls);assert.equal(calls.filter(c=>c.path.endsWith('/read')).length,readBefore,'loading history must not ACK it');
 assert.ok(calls.some(c=>c.path.includes('before=2026-10-31T12%3A00%3A00.123456Z&before_id=b1220000-0000-4000-8000-000000001001')));
 assert.ok(calls.every(c=>c.headers['X-CSRF-Token']==='synthetic-current-csrf'),'unchanged built resolver uses current CSRF helper');
 await page.evaluate(()=>window.__releaseUpdates());await page.getByText('New live fixture',{exact:true}).waitFor({state:'attached'});
 assert.equal(await page.getByText('Oldest retained fixture',{exact:true}).count(),1);assert.equal(await page.locator('.cs-message').count(),202);
 assert.equal(errors.length,0,errors.join('\n'));
 assert.ok(intercepted.every(url=>url.startsWith('https://synthetic.invalid/')),'no API/provider network attempt escaped the fetch seam');
 console.log(JSON.stringify({status:'PASS',scope:'Unmodified generated Messenger JS/CSS in local headless Chromium; synthetic auth/fetch, no real API/provider/device',bundle_sha256:createHash('sha256').update(bundle).digest('hex'),messagesAfterHistory:201,messagesAfterLiveUpdate:202,csrfOnEveryRequest:true,historyDidNotAck:true,pageErrors:errors,networkRequestsIntercepted:intercepted.length}));
} finally {await context?.close();await browser.close();console.log('OWNED_SYNTHETIC_BROWSER_CLOSED');}
