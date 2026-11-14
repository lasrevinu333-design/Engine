// Executes the generated production bundle against synthetic auth/fetch only.
// Every non-fixture request is blocked; no real conversation is touched.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const asset = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const bundle=asset('chatscope-messenger.js');
const styles=['memphis-ui.css','chatscope-messenger.css','chatscope-mobile-overrides.css'].map(asset);
const browser=await chromium.launch({headless:true});
const results=[];
async function fixture(mode='same') {
  const context=await browser.newContext({viewport:{width:1100,height:800}});
  await context.route('**/*',route=>route.request().url()==='https://synthetic.invalid/messages.html'
    ? route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><div id="chatscope-root"></div></body></html>'})
    : route.abort('blockedbyclient'));
  const page=await context.newPage();
  page.setDefaultTimeout(5000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://synthetic.invalid/messages.html');
  await page.evaluate(mode=>{
    const id=n=>`b1220000-0000-4000-8000-${String(n).padStart(12,'0')}`;
    const originalNow=Date.now;
    let offset=0,restored=false,removed=false;
    Date.now=()=>originalNow()+offset;
    let session={token:'synthetic-initial',manager_id:id(1),credential_id:id(2),device_id:id(3),
      role:'ops_manager',roles:['CUSTODIAL_MANAGER'],access_level:'full_access',read_only:false,
      expires_at:new Date(Date.now()+(mode==='timer'?1800:3600000)).toISOString(),
      permissions:{schema:'custodial.manager-permissions.v1',read:true}};
    window.__calls=[];window.__renewals=0;window.__finishDeletion=null;
    window.__expire=()=>{offset+=7200000;};
    const fresh=()=>restored&&Date.parse(session.expires_at)>Date.now()?session:null;
    window.MemphisAuth={getDeviceId:()=>restored?session.device_id:id(99),readSession:fresh,
      requireOpsManagerSession:async options=>{
        window.__renewals++;restored=true;
        if(Date.parse(session.expires_at)<=Date.now()){
          window.__renewalOptions=options;
          if(mode==='revoked')throw Error('Synthetic registration revoked');
          session={...session,token:'synthetic-renewed',expires_at:new Date(Date.now()+3600000).toISOString()};
          if(mode==='manager')session.manager_id=id(71);
          if(mode==='credential')session.credential_id=id(72);
          if(mode==='device')session.device_id=id(73);
          if(mode==='readonly'){session.read_only=true;session.access_level='read_only';}
          if(mode==='permissions')session.permissions={...session.permissions,read:false};
        }
        return session;
      },isReadOnlySession:()=>session.read_only,
      opsManagerAuthHeaders:async()=>({Authorization:'Bearer '+session.token,'X-Device-Id':session.device_id,'X-CSRF-Token':'synthetic-csrf'})};
    const thread=id(4),user=id(5),row={id:id(100),thread_id:thread,sender_user_id:user,sender_display_name:'Synthetic owner',
      body:'Server accepted fixture',message_type:'text',sent_at:'2026-11-13T20:00:00Z',updated_at:'2026-11-13T20:00:00Z'};
    localStorage.setItem('synthetic:opaque-original','unchanged original bytes');
    window.fetch=async(url,options={})=>{
      const u=new URL(url),path=u.pathname;
      const body=options.body?JSON.parse(options.body):null;
      window.__calls.push({path,body,method:options.method||'GET',token:options.headers?.Authorization});
      if(window.__renewals>1&&mode==='threads-delayed'&&path.endsWith('/threads')){
        return new Promise(resolve=>{window.__failThreadRefresh=()=>resolve(new Response(JSON.stringify({ok:false,error:'Synthetic optional read unavailable'}),{status:503}));});
      }
      if(window.__renewals>1&&((mode==='threads-unavailable'&&path.endsWith('/threads'))||(mode==='messages-unavailable'&&path.endsWith('/messages')))){
        return new Response(JSON.stringify({ok:false,error:'Synthetic optional read unavailable'}),{status:503});
      }
      let data=[];
      if(path.endsWith('/me/by-device'))data={msg_user_id:mode==='mapping'&&window.__renewals>1?id(75):user,
        display_name:'Synthetic owner',role:'manager',canonical_device_id:session.device_id,read_only:session.read_only};
      else if(path.endsWith('/threads'))data=removed?[]:[{id:thread,thread_type:'direct',thread_title:'Synthetic conversation',participant_names:'Synthetic peer',viewer_can_send:true}];
      else if(path.endsWith('/users'))data=[{id:id(6),display_name:'Synthetic peer',role:'manager',is_active:true}];
      else if(path.endsWith('/messages'))data=[row];
      else if(path.endsWith('/read'))data=1;
      else if(path.endsWith('/updates'))return new Promise((resolve,reject)=>{
        options.signal?.addEventListener('abort',()=>reject(new DOMException('Closed synthetic request','AbortError')),{once:true});
        if(!window.__lateUpdate)window.__lateUpdate=()=>resolve(new Response(JSON.stringify({ok:true,data:[{...row,body:'STALE CALLBACK MUST NOT PUBLISH'}],meta:{}})));
      });
      else if(path.endsWith('/delete'))return new Promise(resolve=>{
        window.__finishDeletion=()=>{
          removed=true;
          const result={ok:true,deleted:true,deletion_scope:'user',thread_id:thread,user_id:user,
            operation_id:mode==='wrong-receipt'?id(999):body.operation_id,
            deleted_at:'2026-11-13T23:00:00Z',deleted_through:'2026-11-13T23:00:00Z'};
          resolve(new Response(JSON.stringify({ok:true,data:result,meta:{}}),{status:200}));
        };
      });
      else throw Error('Unexpected synthetic request '+path);
      return new Response(JSON.stringify({ok:true,data,meta:{}}),{status:200});
    };
  },mode);
  for(const content of styles)await page.addStyleTag({content});
  await page.addScriptTag({content:bundle});
  await page.getByText('Server accepted fixture',{exact:true}).waitFor({state:'visible',timeout:10000});
  await page.getByRole('textbox',{name:'Type a message',exact:true}).fill('Keep this unsent draft');
  return {context,page,errors};
}
async function intact(page) {
  assert.equal(await page.evaluate(()=>localStorage.getItem('synthetic:opaque-original')),'unchanged original bytes');
  assert.equal(await page.getByRole('textbox',{name:'Type a message',exact:true}).textContent(),'Keep this unsent draft');
}
try {
  for(const mode of ['same','threads-unavailable','messages-unavailable','manager','credential','device','readonly','permissions','mapping','revoked','timer']){
    const {context,page,errors}=await fixture(mode);
    try {
      assert.equal(await page.getByText('Sent',{exact:true}).count(),1,'accepted rows use Sent, without invented delivery/read receipts');
      if(mode==='timer')await page.waitForFunction(()=>window.__renewals===2);
      else await page.evaluate(()=>window.__expire());
      await page.getByRole('button',{name:'New',exact:true}).click();
      if(['same','threads-unavailable','messages-unavailable','timer'].includes(mode)){
        await page.getByRole('dialog',{name:'Start conversation',exact:true}).getByText('Synthetic peer',{exact:true}).waitFor({state:'visible'});
        assert.equal(await page.getByText('Conversation owner changed. Reopen Messages.',{exact:true}).count(),0);
        assert.ok((await page.evaluate(()=>window.__calls)).some(c=>c.path.endsWith('/users')&&c.token==='Bearer synthetic-renewed'));
        await page.getByRole('button',{name:'Cancel',exact:true}).click();
        await page.evaluate(()=>window.__lateUpdate?.());
        await intact(page);
        assert.equal(await page.getByText('STALE CALLBACK MUST NOT PUBLISH',{exact:true}).count(),0);
      }else{
        await page.getByText(mode==='revoked'?'Synthetic registration revoked':'Browser access changed. Saved drafts and requests remain protected. Reopen Messages.',{exact:true}).waitFor({state:'visible'});
        assert.equal((await page.evaluate(()=>window.__calls)).filter(c=>c.path.endsWith('/users')).length,0);
        await intact(page);
      }
      assert.equal((await page.evaluate(()=>window.__calls)).filter(c=>c.method==='POST'&&!c.path.endsWith('/read')).length,0);
      assert.equal(await page.evaluate(()=>window.__renewalOptions?.interactive),false,'renewal never prompts for enrollment/PIN');
      assert.deepEqual(errors,[]);
      results.push({case:mode,result:'PASS'});console.log(JSON.stringify(results.at(-1)));
    }finally{await context.close();}
  }
  for(const mode of ['same','wrong-receipt','threads-delayed']){
    const {context,page,errors}=await fixture(mode);
    try {
      page.on('dialog',dialog=>dialog.accept());
      await page.evaluate(()=>window.__expire());
      await page.getByRole('button',{name:'Delete',exact:true}).last().click();
      await page.getByText('Conversation removal is saved. Server confirmation is still pending.',{exact:true}).waitFor({state:'visible'});
      assert.equal(await page.getByText('Conversation removed from your Messenger.',{exact:true}).count(),0,'pending is not deletion acceptance');
      const saved=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('mz_chatscope_delete_outbox:')));
      assert.equal(saved.length,1);
      if(mode==='threads-delayed'){
        await page.waitForFunction(()=>typeof window.__failThreadRefresh==='function');
        await page.evaluate(async()=>{window.__failThreadRefresh();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
        assert.equal(await page.getByText('Synthetic optional read unavailable',{exact:true}).count(),0,'an older read failure cannot replace the pending deletion notice');
        assert.equal(await page.getByText('Conversation removal is saved. Server confirmation is still pending.',{exact:true}).count(),1);
      }
      await page.waitForFunction(()=>typeof window.__finishDeletion==='function');
      await page.evaluate(()=>window.__finishDeletion());
      if(mode==='same'||mode==='threads-delayed'){
        await page.getByText('Conversation removed from your Messenger.',{exact:true}).waitFor({state:'visible'});
        assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('mz_chatscope_delete_outbox:')).length),0);
      }else{
        await page.waitForFunction(()=>window.__calls.some(c=>c.path.endsWith('/delete')));
        assert.equal(await page.getByText('Conversation removed from your Messenger.',{exact:true}).count(),0);
        assert.deepEqual(await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('mz_chatscope_delete_outbox:'))),saved);
      }
      assert.equal((await page.evaluate(()=>window.__calls)).filter(c=>c.path.endsWith('/delete')).length,1,'one original operation only');
      assert.equal(await page.evaluate(()=>localStorage.getItem('synthetic:opaque-original')),'unchanged original bytes');
      assert.deepEqual(errors,[]);
      results.push({case:'deletion-'+mode,result:'PASS'});console.log(JSON.stringify(results.at(-1)));
    }finally{await context.close();}
  }
  console.log(JSON.stringify({status:'PASS',scope:'generated browser bundle, synthetic authentication/API only; no real messages, browser or phone',cases:results}));
}finally{await browser.close();console.log('OWNED_SYNTHETIC_BROWSER_CLOSED');}
