const {currentLeadershipSession}=require('./helpers/current-leadership-session.cjs');
const { test, expect } = require('./helpers/isolated-browser-test.cjs');

const managerId='00000000-0000-4000-8000-000000000101';
const credentialId='00000000-0000-4000-8000-000000000102';
const conversationId='00000000-0000-4000-8000-000000000103';
const attachmentId='00000000-0000-4000-8000-000000000104';

function session(){return currentLeadershipSession({deviceId:'gemini-browser',managerId,credentialId,displayName:'Synthetic Gemini Manager'});}
function conversation(){return{conversation_id:conversationId,title:'New chat',status:'active',created_at:'2026-07-18T12:00:00Z',updated_at:'2026-07-18T12:00:00Z',last_activity_at:'2026-07-18T12:00:00Z',draft_text:''};}
function sse(events){return events.map(([type,data])=>`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`).join('');}

async function installBackend(context,{trusted=true,interruptFirst=false}={}){
  const state={messages:[],uploads:[],sendCount:0,streamBodies:[],interrupted:false,repair:{proposals:[],jobs:[]}};
  await context.route('https://memphis-zoo-mcp.onrender.com/**',async route=>{
    const request=route.request();const url=new URL(request.url());
    if(url.pathname==='/custodial-leadership-api/session'){
      await route.fulfill({status:trusted?200:401,contentType:'application/json',body:JSON.stringify(trusted?session():{ok:false,error:'Trusted device required.'})});return;
    }
    if(url.pathname==='/gemini-api/conversations'&&request.method()==='GET'){
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:[conversation()]})});return;
    }
    if(url.pathname==='/gemini-api/conversations'&&request.method()==='POST'){
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:conversation()})});return;
    }
    if(url.pathname===`/gemini-api/conversations/${conversationId}`&&request.method()==='PATCH'){
      const body=request.postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{...conversation(),...body}})});return;
    }
    if(url.pathname===`/gemini-api/conversations/${conversationId}/messages`){
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:state.messages,meta:{next_cursor:null}})});return;
    }
    if(url.pathname===`/gemini-api/conversations/${conversationId}/repair-state`){
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{...state.repair,can_authorize:true}})});return;
    }
    if(url.pathname===`/gemini-api/conversations/${conversationId}/attachments`){
      const body=request.postDataJSON();state.uploads.push(body);await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,data:{attachment_id:attachmentId,original_filename:body.filename,mime_type:body.mime_type,size_bytes:4,sha256:'a'.repeat(64),status:'pending',created_at:'2026-07-18T12:00:01Z'}})});return;
    }
    if(url.pathname===`/gemini-api/conversations/${conversationId}/messages/stream`){
      state.sendCount+=1;const body=request.postDataJSON();state.streamBodies.push(body);
      if(interruptFirst&&!state.interrupted){state.interrupted=true;await route.abort('connectionreset');return;}
      const user={message_id:'00000000-0000-4000-8000-000000000105',conversation_id:conversationId,manager_id:managerId,role:'user',body:body.body,state:'completed',client_message_id:body.client_message_id,created_at:'2026-07-18T12:00:02Z'};
      const assistant={message_id:'00000000-0000-4000-8000-000000000106',conversation_id:conversationId,manager_id:managerId,role:'assistant',body:'Verified grounded response.',state:'completed',response_to_message_id:user.message_id,created_at:'2026-07-18T12:00:03Z'};
      state.messages=[user,assistant];
      const proposal={proposal_id:'00000000-0000-4000-8000-000000000107',repair_kind:'acceptance_probe',status:'proposed',created_at:'2026-07-18T12:00:04Z'};
      const eventList=[['status',{state:'thinking',label:'Thinking'}],['user_message',user],['delta',{text:'Verified '}],['delta',{text:'grounded response.'}],['message',assistant]];
      if(/audit/i.test(body.body)){state.repair.proposals=[proposal];eventList.push(['proposal',proposal]);}
      eventList.push(['done',{correlation_id:body.correlation_id}]);
      await route.fulfill({status:200,contentType:'text/event-stream',headers:{'cache-control':'no-store'},body:sse(eventList)});return;
    }
    await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({ok:false,error:`Unhandled ${request.method()} ${url.pathname}`})});
  });
  return state;
}

test('trusted desktop has simple persistent chat, attachment, streaming, and duplicate-send interlock',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1280,height:720}});const backend=await installBackend(context);const page=await context.newPage();
  await page.goto('/gemini-admin.html');
  await expect(page.getByRole('heading',{name:'How can I help?'})).toBeVisible();
  const hubButton=page.locator('[data-mz-back]');
  await expect(hubButton).toBeVisible();
  await expect(hubButton).toHaveAttribute('href',/\/start_page1\.html$/);
  const desktopLayout=await page.evaluate(()=>{const composer=document.querySelector('.composer-wrap').getBoundingClientRect();const transcript=document.querySelector('.transcript').getBoundingClientRect();return{composerBottom:composer.bottom,composerTop:composer.top,transcriptHeight:transcript.height,viewportHeight:window.visualViewport?.height||window.innerHeight,bodyHeight:document.body.getBoundingClientRect().height};});
  expect(Math.abs(desktopLayout.composerBottom-desktopLayout.viewportHeight)).toBeLessThanOrEqual(1);
  expect(desktopLayout.composerTop).toBeGreaterThan(0);
  expect(desktopLayout.transcriptHeight).toBeGreaterThan(160);
  expect(desktopLayout.bodyHeight).toBeLessThanOrEqual(desktopLayout.viewportHeight+1);
  await expect(page.getByText(/premade prompt/i)).toHaveCount(0);
  await page.setInputFiles('#file-input',{name:'evidence.txt',mimeType:'text/plain',buffer:Buffer.from('test')});
  await expect(page.locator('.attachment-chip')).toContainText('evidence.txt');
  await page.getByLabel('Message Gemini Console').fill('Audit the disposable fixture.');
  await Promise.all([page.getByRole('button',{name:'Send'}).click(),page.getByRole('button',{name:'Send'}).click()]);
  await expect(page.getByText('Verified grounded response.')).toBeVisible();
  await expect(page.getByText('Disposable acceptance proposal ready.')).toBeVisible();
  expect(backend.sendCount).toBe(1);expect(backend.uploads).toHaveLength(1);expect(backend.streamBodies[0].attachment_ids).toEqual([attachmentId]);
  const storage=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage},url:location.href}));
  expect(JSON.stringify(storage)).not.toContain('Audit the disposable fixture.');
  await page.reload();await expect(page.getByText('Verified grounded response.')).toBeVisible();await expect(page.getByText('Disposable acceptance proposal ready.')).toBeVisible();
  await page.locator('[data-mz-back]').click();await expect(page).toHaveURL(/\/start_page1\.html$/);
  await context.close();
});

test('durable IndexedDB original survives interruption and reload without an unverified replacement send',async({browser})=>{
 const context=await browser.newContext();try{const backend=await installBackend(context,{interruptFirst:true});const page=await context.newPage();await page.goto('/gemini-admin.html');await page.getByLabel('Message Gemini Console').fill('Recover this exact message.');await page.getByRole('button',{name:'Send'}).click();
  await expect(page.locator('#status')).toHaveClass(/error/);expect(backend.sendCount).toBe(1);const firstId=backend.streamBodies[0].client_message_id;
  const readOriginal=()=>page.evaluate(async()=>{const names=await indexedDB.databases();if(!names.some(x=>x.name==='memphis-gemini-console'&&x.version===1))throw Error('Original outbox absent');
   return new Promise((resolve,reject)=>{const request=indexedDB.open('memphis-gemini-console',1);request.onupgradeneeded=()=>{request.transaction.abort();reject(Error('Unexpected outbox creation'));};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('outbox','readonly'),get=tx.objectStore('outbox').getAll();get.onsuccess=()=>resolve(get.result);get.onerror=()=>reject(get.error);tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();reject(tx.error);};};});});
  const original=await readOriginal();expect(original).toHaveLength(1);expect(original[0].client_message_id).toBe(firstId);expect(original[0].state).toBe('dispatch_attempted');
  await page.reload();await expect(page.locator('#status')).toHaveText('Saved original requests retained; their exact outcomes remain unconfirmed. No replacement request was sent.');
  expect(await readOriginal()).toEqual(original);expect(backend.sendCount).toBe(1);expect(backend.streamBodies[0].client_message_id).toBe(firstId);
 }finally{await context.close();}
});

test('mobile viewport supports the chat composer and an untrusted browser never sees the console',async({browser})=>{
  const mobile=await browser.newContext({viewport:{width:390,height:667},userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'});await installBackend(mobile);const page=await mobile.newPage();await page.goto('/gemini-admin.html');await expect(page.getByLabel('Message Gemini Console')).toBeVisible();await expect(page.getByRole('button',{name:'Open conversation history'})).toBeVisible();await expect(page.locator('[data-mz-back]')).toBeVisible();const mobileLayout=await page.evaluate(()=>{const composer=document.querySelector('.composer-wrap').getBoundingClientRect();const transcript=document.querySelector('.transcript').getBoundingClientRect();return{composerBottom:composer.bottom,transcriptHeight:transcript.height,viewportHeight:window.visualViewport?.height||window.innerHeight,scrollHeight:document.documentElement.scrollHeight};});expect(Math.abs(mobileLayout.composerBottom-mobileLayout.viewportHeight)).toBeLessThanOrEqual(1);expect(mobileLayout.transcriptHeight).toBeGreaterThan(100);expect(mobileLayout.scrollHeight).toBeLessThanOrEqual(mobileLayout.viewportHeight+1);await mobile.close();
  const denied=await browser.newContext();await installBackend(denied,{trusted:false});const locked=await denied.newPage();await locked.goto('/gemini-admin.html');await expect(locked).toHaveURL(/\/ops-manager-hub\.html\?/);await expect(locked.locator('#app')).toHaveCount(0);await denied.close();
});
