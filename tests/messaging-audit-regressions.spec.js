const {test,expect}=require('./helpers/isolated-browser-test.cjs');
const U='10000000-0000-4000-8000-000000000001', A='20000000-0000-4000-8000-000000000001', B='20000000-0000-4000-8000-000000000002', D='AUDIT_RETRY_PHONE';
test('thread change remains retryable when its dependent list refresh fails',async({browser})=>{
 const context=await browser.newContext();let armed=false,failed=false,recovered=false;const cursors=[];
 await context.addInitScript(d=>{for(const k of ['memphisAssignedDeviceId','mz_scan_device_id','mz_employee_hub_device_id'])localStorage.setItem(k,d);},D);
 await context.route('https://memphis-zoo-mcp.onrender.com/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  const json=(status,data,meta={})=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':req.headers().origin||'http://127.0.0.1:4397','Access-Control-Allow-Credentials':'true'},body:JSON.stringify(status<400?{ok:true,data,meta}:{ok:false,error:'Synthetic transient list failure'})});
  if(req.method()==='OPTIONS')return json(200,{});
  if(path==='/messaging-api/me/by-device')return json(200,{msg_user_id:U,role:'employee',display_name:'Synthetic Employee',canonical_device_id:D});
  if(path==='/messaging-api/threads'){
   if(armed&&!failed){failed=true;return json(503,{});}
   if(armed&&failed)recovered=true;
   return json(200,(recovered?[A,B]:[A]).map((id,i)=>({thread_id:id,thread_type:'direct',thread_title:i?'Recovered Conversation':'Original Conversation',viewer_can_send:true,participant_names:'Synthetic Employee, Synthetic Peer'})));
  }
  if(path==='/messaging-api/threads/updates'){
   await new Promise(r=>setTimeout(r,100));const old=url.searchParams.get('after_id')!==B;
   if(armed)cursors.push(url.searchParams.get('after_id'));
   return json(200,armed&&old?[{thread_id:B,changed_at:'2026-11-02T10:00:00Z'}]:[],{next_cursor:{after:armed?'2026-11-02T10:00:00Z':url.searchParams.get('after'),after_id:armed?B:url.searchParams.get('after_id')}});
  }
  if(path.endsWith('/updates')){await new Promise(r=>setTimeout(r,100));return json(200,[]);}
  return json(200,[]);
 });
 try{
  const page=await context.newPage();await page.goto(`/messages.html?thread_id=${A}&device=${D}&hub=employee`);
  await expect(page.locator('.cs-message-input__content-editor')).toBeVisible();armed=true;
  await expect.poll(()=>failed).toBe(true);
  await expect(page.locator('.cs-conversation').filter({hasText:'Recovered Conversation'})).toBeVisible({timeout:4500});
  expect(cursors.filter(x=>x!==B).length).toBeGreaterThanOrEqual(2);
 }finally{await context.close();}
});
