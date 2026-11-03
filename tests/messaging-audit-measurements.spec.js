const {currentLeadershipSession}=require('./helpers/current-leadership-session.cjs');
const {test,expect}=require('./helpers/isolated-browser-test.cjs');
const U='10000000-0000-4000-8000-000000000001',V='10000000-0000-4000-8000-000000000002',A='20000000-0000-4000-8000-000000000001',B='20000000-0000-4000-8000-000000000002',D='AUDIT_MESSENGER_PHONE';
const MID='30000000-0000-4000-8000-000000000001';
test.setTimeout(7000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fixture(browser,{mobile=false,message='Initial text',mode='normal',manager=false,readOnly=false}={}){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800}});
 await context.addInitScript(device=>{for(const key of ['memphisAssignedDeviceId','mz_scan_device_id','mz_employee_hub_device_id'])localStorage.setItem(key,device);},D);
 const h={context,posted:[],groupAttempts:[],changed:{},reads:[],loads:{},deny:false,release:null,mode,committed:[],pageErrors:[],failed:[]};
 const rows=id=>[{id:MID,thread_id:id,sender_user_id:V,sender_display_name:'Synthetic Recipient',body:message,message_type:'text',sent_at:'2026-10-06T15:00:00Z',metadata_json:{}}].concat(h.committed.filter(x=>x.thread_id===id));
 await context.route('https://memphis-zoo-mcp.onrender.com/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  const json=(status,data,meta={})=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':req.headers().origin||'http://127.0.0.1:4388','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Device-Id','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body:JSON.stringify(status<400?{ok:true,data,meta}:{ok:false,error:'Synthetic access denied',code:'access_revoked'})});
  if(req.method()==='OPTIONS')return json(200,{});
  if(path==='/custodial-leadership-api/session')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(currentLeadershipSession({deviceId:D,managerId:'10000000-0000-4000-8000-000000000070',accountId:U,credentialId:'10000000-0000-4000-8000-000000000004',displayName:'Synthetic Employee',session:{token:'SYNTHETIC-MANAGER',access_level:'full_access',read_only:false}}))});
  if(path==='/messaging-api/me/by-device')return json(200,{msg_user_id:U,display_name:'Synthetic Employee',role:manager?'manager':'employee',read_only:readOnly,canonical_device_id:D});
  if(path==='/messaging-api/threads')return h.deny?json(403,{}):json(200,[A,B].map((id,i)=>({thread_id:id,thread_type:'direct',thread_title:i?'Conversation B':'Conversation A',viewer_can_send:!readOnly,participant_names:'Synthetic Employee, Synthetic Recipient',last_message_at:'2026-10-06T15:00:00Z',last_message_body:'Initial text'})));
  if(path==='/messaging-api/users')return json(200,[{id:V,display_name:'Synthetic Recipient',role:'employee',is_active:true},{id:'10000000-0000-4000-8000-000000000003',display_name:'Synthetic Other Recipient',role:'employee',is_active:true}]);
  const id=path.includes(A)?A:B;
  if(path.endsWith('/messages')){h.loads[id]=(h.loads[id]||0)+1;return h.deny?json(403,{}):json(200,rows(id));}
  if(path.endsWith('/message')&&req.method()==='POST'){
   const body=req.postDataJSON();h.posted.push({thread:id,...body});
   if(h.mode==='hold')await new Promise(r=>{h.release=r;});
   if(h.mode==='offline')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Synthetic network outage'})});
   const row={id:'30000000-0000-4000-8000-'+String(h.posted.length+10).padStart(12,'0'),thread_id:id,sender_user_id:U,sender_display_name:'Synthetic Employee',body:body.body,message_type:'text',sent_at:new Date().toISOString(),client_message_id:body.client_message_id,metadata_json:{client_message_id:body.client_message_id}};
   if(!h.committed.some(x=>x.metadata_json.client_message_id===body.client_message_id))h.committed.push(row);
   return json(200,row);
  }
  if(path.endsWith('/read')){h.reads.push(req.postDataJSON());return json(readOnly?403:200,{marked:true});}
  if(path==='/messaging-api/thread/group'){h.groupAttempts.push(req.postDataJSON());return json(h.mode==='group-lost'&&h.groupAttempts.length===1?503:200,{id:A});}
  if(path.endsWith('/updates')){await sleep(120);const changed=h.changed[id];h.changed[id]=false;return h.deny?json(403,{}):json(200,changed?[{id:MID,thread_id:id}]:[],{next_cursor:{after:'2026-10-06T15:00:00Z',after_id:MID}});}
  if(path.endsWith('/thread/direct'))return json(200,{id:A});
  return json(200,{});
 });
 const page=await context.newPage();h.page=page;page.on('pageerror',e=>h.pageErrors.push(e.message));page.on('requestfailed',r=>h.failed.push(r.failure()?.errorText));
 await page.goto(`/messages.html?thread_id=${A}&device=${D}&hub=${manager?'manager':'employee'}`);
 await expect(page.locator('.cs-message-input__content-editor')).toBeVisible();
 await expect.poll(()=>h.loads[A]).toBeGreaterThan(0);await sleep(100);
 h.editor=page.locator('.cs-message-input__content-editor');
 h.switchTo=async id=>{if(mobile)await page.getByRole('button',{name:'Back to conversations'}).click();await page.locator('.cs-conversation').filter({hasText:id===A?'Conversation A':'Conversation B'}).click();await expect(page.locator('.cs-conversation-header__user-name')).toHaveText(id===A?'Conversation A':'Conversation B');};
 h.close=async()=>{h.release?.();await context.close();};return h;
}

test('composer key, paste, composition and focus produce no application audio',async({browser})=>{
 const h=await fixture(browser);try{
  await h.page.evaluate(()=>{
   window.__auditAudio=[];HTMLMediaElement.prototype.play=function(){window.__auditAudio.push('media');return Promise.resolve();};
   for(const name of ['AudioContext','webkitAudioContext'])if(window[name])window[name]=function(){window.__auditAudio.push(name);throw Error('unexpected keyboard audio');};
  });
  await h.editor.focus();await h.editor.pressSequentially('Synthetic text');await h.editor.press('Backspace');await h.editor.press('Shift+Enter');
  await h.editor.evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','<literal pasted text>');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
  await h.editor.dispatchEvent('compositionstart');await h.editor.fill('composing');await h.editor.dispatchEvent('compositionend');
  expect(await h.page.evaluate(()=>window.__auditAudio)).toEqual([]);
 }finally{await h.close();}
});
test('bounded synthetic browser timings and request ownership',async({browser},info)=>{
 test.setTimeout(90000);
 const h=await fixture(browser,{mode:'hold'}),receiver=await fixture(browser);const samples=[];let active=0,maxActive=0;
 h.page.on('request',r=>{if(r.url().includes('/threads/updates'))maxActive=Math.max(maxActive,++active);});
 const done=r=>{if(r.url().includes('/threads/updates'))active=Math.max(0,active-1);};h.page.on('requestfinished',done);h.page.on('requestfailed',done);
 try{
  for(let i=0;i<20;i++){
   const text='Synthetic timing '+i;await h.editor.fill(text);const start=performance.now();await h.editor.press('Enter');
   await expect.poll(()=>h.posted.length).toBe(i+1);
   await expect(h.page.locator('.cs-message__content').filter({hasText:text}).last()).toBeVisible();const local=performance.now()-start;
   const released=performance.now();h.release();await expect.poll(()=>h.committed.length).toBe(i+1);
   await expect(h.page.locator('.cs-message--outgoing .cs-message__footer').last()).toHaveText('Sent to server');const accepted=performance.now()-released;
   receiver.committed.splice(0,receiver.committed.length,...h.committed);const catchup=performance.now();receiver.changed[A]=true;
   await expect(receiver.page.locator('.cs-message__content').filter({hasText:text}).last()).toBeVisible();
   samples.push({local_ui_ms:local,synthetic_http_acceptance_ui_ms:accepted,synthetic_recipient_catchup_ms:performance.now()-catchup});
  }
  expect(h.posted).toHaveLength(20);expect(new Set(h.posted.map(x=>x.client_message_id)).size).toBe(20);expect(maxActive).toBeLessThanOrEqual(1);
  const metrics={};for(const k of Object.keys(samples[0])){const a=samples.map(x=>x[k]).sort((a,b)=>a-b);metrics[k]={n:a.length,failures:0,p50:a[9],p95:a[18]};}
  await info.attach('synthetic-performance',{body:JSON.stringify({scope:'Playwright observer timings; synthetic HTTP acceptance only, no real DB/provider/phone. Receiver is a second browser context with synthetic visible history.',metrics,samples,max_concurrent_thread_polls:maxActive,page_errors:h.pageErrors.concat(receiver.pageErrors)},null,2),contentType:'application/json'});
 }finally{await h.close();await receiver.close();}
});
