const {test,expect}=require('./helpers/isolated-browser-test.cjs');
const {currentLeadershipSession}=require('./helpers/current-leadership-session.cjs');
// Current neutral scenario explicitly requires no NEW feedback photo capture.
// Historical attachment review and original bytes remain protected. The old
// image-upload/compression cases are retained in the repair evidence baseline.
const manager=()=>currentLeadershipSession({displayName:'Synthetic feedback manager'});
async function currentFeedbackBackend(page,submit){
 await page.route('https://memphis-zoo-mcp.onrender.com/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/custodial-leadership-api/session')return route.fulfill({contentType:'application/json',body:JSON.stringify(manager())});
  if(path==='/feedback-api/submit')return submit(route);
  if(path==='/dashboard-api/system-feedback')return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:[]})});
  throw new Error('Unexpected synthetic feedback endpoint '+path);
 });
}
test('current feedback sends exact attributed JSON without adding new photo capture',async({page})=>{
 let submitted;await currentFeedbackBackend(page,async route=>{submitted={headers:route.request().headers(),body:route.request().postDataJSON()};return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,data:{item:{id:'45000000-0000-4000-8000-000000000001',operation_id:submitted.body.operation_id}}})});});
 await page.goto('/system-feedback.html?hub=manager');await expect(page.locator('#image-input')).toHaveCount(0);
 await page.locator('#message').fill('Current feedback contract check');await page.locator('#send-feedback').click();await expect(page.locator('#feedback-status')).toHaveText('Saved in the program.');
 expect(submitted.headers['content-type']).toContain('application/json');expect(submitted.body.message).toBe('Current feedback contract check');expect(submitted.body.hub_context).toBe('manager');expect(submitted.body.expected_manager_id).toBe(manager().session.managerSession.manager_id);expect(submitted.body.expected_credential_id).toBe(manager().session.registrationId);expect(submitted.body.image_attachment).toBeUndefined();expect(submitted.body.operation_id).toMatch(/^[a-f0-9-]{36}$/);expect(await page.evaluate(()=>localStorage.getItem('custodial.manager-feedback-original.v1'))).toBeNull();
});
test('feedback size boundary and lost reply preserve the exact original operation despite edits',async({page})=>{
 const requests=[];await currentFeedbackBackend(page,async route=>{const raw=route.request().postData();requests.push(raw);if(requests.length===1)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Synthetic response loss'})});return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{item:{id:'45000000-0000-4000-8000-000000000002',operation_id:JSON.parse(raw).operation_id}}})});});
 await page.goto('/system-feedback.html?hub=manager');const boundary=await page.evaluate(()=>{const p=window.MemphisFeedbackPayloadPolicy;return{authorized:p.maxAuthorizedRequestBytes,accepted:p.maxFeedbackRequestBytes,exact:p.serializedBodyFits('x'.repeat(p.maxFeedbackRequestBytes)),over:p.serializedBodyFits('x'.repeat(p.maxFeedbackRequestBytes+1))};});expect(boundary.authorized).toBe(4*1024*1024);expect(boundary.accepted).toBeLessThan(boundary.authorized);expect(boundary.exact).toBe(true);expect(boundary.over).toBe(false);
 await page.locator('#message').fill('Original saved feedback');await page.locator('#send-feedback').click();await expect(page.locator('#feedback-status')).toContainText('unconfirmed');const original=await page.evaluate(()=>localStorage.getItem('custodial.manager-feedback-original.v1'));expect(JSON.parse(original).body.message).toBe('Original saved feedback');await page.locator('#message').fill('Later edit must not replace original');await page.locator('#send-feedback').click();await expect(page.locator('#feedback-status')).toHaveText('Saved in the program. Your newer draft is still here and has not been sent.');await expect(page.locator('#message')).toHaveValue('Later edit must not replace original');expect(requests).toHaveLength(2);expect(requests[1]).toBe(requests[0]);expect(Buffer.byteLength(requests[0])).toBeLessThanOrEqual(boundary.accepted);
});
test('unapproved guest reporting stays visibly dormant and makes no submission calls', async ({ page }) => {
  let featureRequestCount = 0;
  let guestDataRequestCount = 0;
  await page.route('https://memphis-zoo-mcp.onrender.com/guest-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/guest-api/status') {
      featureRequestCount += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { enabled: false, approval_state: 'awaiting_zoo_approval' } }) });
    }
    guestDataRequestCount += 1;
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
  });
  await page.goto('/guest-report.html?code=TETM');
  await expect(page.getByText('Awaiting Memphis Zoo approval')).toBeVisible();
  await expect(page.locator('#report-card')).toBeHidden();
  await expect(page.locator('#issues-card')).toBeHidden();
  expect(featureRequestCount).toBe(1);
  expect(guestDataRequestCount).toBe(0);
});

test('manager feedback inbox reviews a retained image and applies one exact version-bound triage',async({page})=>{
 const feedbackId='00000000-0000-4000-8000-000000000505';let statusUpdate=null,version='a'.repeat(64),status='new';
 await page.route('https://memphis-zoo-mcp.onrender.com/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname,send=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(path==='/custodial-leadership-api/session')return send(manager());
  if(path==='/dashboard-api/system-feedback')return send({ok:true,data:[{id:feedbackId,summary:'Retained screenshot feedback',category:'app_problem',priority:'high',status,triage_version:version,message:'The save button is obscured.',metadata_json:{image_attachment:{storage_path:'feedback/test.png'}},created_at:new Date().toISOString()}]});
  if(path===`/feedback-api/image/${feedbackId}`)return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')});
  if(path===`/dashboard-api/system-feedback/${feedbackId}/status`){statusUpdate=request.postDataJSON();expect(statusUpdate.expected_version).toBe(version);expect(statusUpdate.expected_manager_id).toBe(manager().session.managerSession.manager_id);expect(statusUpdate.expected_credential_id).toBe(manager().session.registrationId);version='b'.repeat(64);status='acknowledged';return send({ok:true,replayed:false,receipt:{request_id:statusUpdate.request_id,feedback_id:feedbackId,status,triage_version:version,actor_manager_id:statusUpdate.expected_manager_id,actor_credential_id:statusUpdate.expected_credential_id,accepted_at:new Date().toISOString()}});}
  throw new Error('Unexpected original feedback request '+path);
 });
 await page.goto('/system-feedback.html?hub=manager');await expect(page.locator('#feedback-inbox')).toBeVisible();await expect(page.getByText('The save button is obscured.')).toBeVisible();await page.getByRole('button',{name:'View image'}).click();await expect(page.locator('.feedbackImage')).toBeVisible();await expect(page.locator('.feedbackImage')).toHaveJSProperty('naturalWidth',1);await page.getByRole('button',{name:'Acknowledge',exact:true}).click();await expect.poll(()=>statusUpdate?.status).toBe('acknowledged');expect(Object.keys(statusUpdate).sort()).toEqual(['expected_credential_id','expected_manager_id','expected_version','request_id','status']);expect(statusUpdate.request_id).toMatch(/^[a-f0-9-]{36}$/);await expect(page.locator('[data-feedback-id]')).toHaveAttribute('data-triage-version',version);
});
