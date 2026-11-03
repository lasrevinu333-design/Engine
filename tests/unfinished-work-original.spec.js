const {test,expect}=require('./helpers/isolated-browser-test.cjs');
// Real page/auth/DOM/localStorage/Web Locks; synthetic HTTP responses only.
// This does not substitute for the separately required normal-runtime SQL case.
const id=n=>'1a120000-0000-4000-8000-'+String(n).padStart(12,'0');
async function fixture(context,{hold=false}={}){
 const state={posts:[],queries:[],lists:0,release:null};let released;
 const blocked=new Promise(resolve=>released=resolve);state.release=released;
 const session={registrationId:id(2),identityAssurance:'SELF_ASSERTED_NAME',claimedAccount:{accountId:id(3),displayName:'Fixture Eric selection'},cohort:{principalId:id(1),policyVersion:1,permissions:['custodialManagementAdmin']},managerSession:{token:'SYNTHETIC_NOT_A_REAL_CREDENTIAL',role:'ops_manager',manager_id:id(1),claimed_manager_id:id(3),credential_id:id(2),device_id:'owned-unfinished-browser-fixture',auth_mode:'custodial_leadership_pin',owner:false,custodial_management_admin:true,read_only:false,access_level:'full_access',expires_at:'2099-01-01T00:00:00Z',permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1}}};
 await context.route('https://memphis-zoo-mcp.onrender.com/**',async route=>{
  const req=route.request(),u=new URL(req.url());const send=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(u.pathname==='/custodial-leadership-api/session')return send({ok:true,enrolled:true,csrfToken:'fixture-csrf',session});
  const base='/admin-api/custodial/unfinished-work',reply=data=>send({ok:true,contract_version:'custodial.unfinished-work.v1',data});
  if(u.pathname===base){state.lists++;return reply({items:[{notice_id:id(4),attention_required:true,location:'Fixture place',employee:'Original fixture employee',deadline_at:'2026-11-01T00:00:00Z'}],truncated:false});}
  if(u.pathname===base+'/'+id(4)+'/clear'){
   const operation=req.headers()['idempotency-key'];expect(req.headers().authorization).toBe('Bearer '+session.managerSession.token);expect(req.headers()['x-csrf-token']).toBe('fixture-csrf');
   state.posts.push({operation,body:req.postDataJSON()});state.receipt={notice_id:id(4),operation_id:operation,status:'cancelled_without_completion',history_preserved:true,phone_released:false,key_removal:false};
   if(hold){await blocked;return reply(state.receipt);}return route.abort('connectionreset');
  }
  if(u.pathname.includes('/operations/')){state.queries.push(u.pathname);return reply({found:true,...state.receipt});}
  throw Error('Unprovided synthetic endpoint '+u.pathname);
 });return state;
}
async function preview(page){await page.goto('/unfinished-work.html');await page.getByRole('button',{name:'Review and clear',exact:true}).click();await page.getByLabel('Reason for clearing unfinished work').fill('Preserve the original work');await page.getByRole('button',{name:'Preview clear',exact:true}).click();}
test('lost clear response survives reload and retires only matching saved receipt',async({page,context})=>{
 const state=await fixture(context);page.on('dialog',dialog=>dialog.accept());await preview(page);await page.getByRole('button',{name:'Confirm clear',exact:true}).click();await expect(page.locator('#status')).toContainText('needs confirmation');expect(state.posts).toHaveLength(1);
 const before=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('mz_unfinished_clear:v1:')));expect(before).toHaveLength(1);expect(JSON.stringify(before)).not.toContain('SYNTHETIC_NOT_A_REAL_CREDENTIAL');
 await page.reload();await expect(page.getByRole('button',{name:'Check original clear',exact:true})).toBeVisible();expect(state.posts).toHaveLength(1);expect(state.lists).toBe(1);await expect(page.getByRole('button',{name:'Retry this exact clear',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Check original clear',exact:true}).click();await expect(page.locator('#status')).toContainText('original clear was confirmed');expect(state.queries).toHaveLength(1);expect(state.queries[0]).toContain(state.posts[0].operation);expect(state.posts).toHaveLength(1);
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('mz_unfinished_clear:v1:')))).toHaveLength(0);
});
test('in-flight clear holds exact original against cancellation and another tab',async({page,context})=>{
 const state=await fixture(context,{hold:true});await preview(page);await page.getByRole('button',{name:'Confirm clear',exact:true}).click();await expect.poll(()=>state.posts.length).toBe(1);await expect(page.getByRole('button',{name:'Cancel preview',exact:true})).toHaveCount(0);
 const second=await context.newPage();try{await second.goto('/unfinished-work.html');await expect(second.locator('#status')).toContainText('could not be checked');expect(state.lists).toBe(1);expect(state.posts).toHaveLength(1);state.release();await expect(page.locator('#status')).toContainText('original clear was confirmed');await second.getByRole('button',{name:'Refresh unfinished work',exact:true}).click();await expect(second.getByRole('button',{name:'Review and clear',exact:true})).toBeVisible();expect(state.posts).toHaveLength(1);}finally{state.release();await second.close();}
});
