const { test, expect } = require('@playwright/test');

test('feedback image is sent in the supported JSON contract', async ({ page }) => {
  let submitted;
  await page.route('https://memphis-zoo-mcp.onrender.com/feedback-api/submit', async (route) => {
    submitted = {
      headers: route.request().headers(),
      body: route.request().postDataJSON(),
    };
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { item: { id: 'test' } } }) });
  });
  await page.goto('/system-feedback.html?hub=employee');
  await page.locator('#message').fill('Photo submission contract check');
  await page.locator('#image-input').setInputFiles({
    name: 'spill.png',
    mimeType: 'image/png',
    buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
  });
  await expect(page.locator('#image-preview')).toBeVisible();
  await page.locator('#send-feedback').click();
  await expect(page.locator('#feedback-status')).toHaveText('Sent. Thank you.');
  expect(submitted.headers['content-type']).toContain('application/json');
  expect(submitted.body.image_attachment.name).toBe('spill.png');
  expect(submitted.body.image_attachment.type).toBe('image/png');
  expect(submitted.body.image_attachment.data_url).toMatch(/^data:image\/png;base64,/);
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

test('manager feedback inbox exposes attachment review and status triage', async ({ page }) => {
  const feedbackId = '00000000-0000-4000-8000-000000000505';
  let statusUpdate;
  await page.route('**/memphis-auth.js*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `window.MemphisAuth={
      getDeviceId:()=>"OPS-TEST",
      readSession:()=>({manager_display_name:"Test Manager"}),
      requireOpsManagerSession:async()=>({token:"test-token",device_id:"OPS-TEST",manager_display_name:"Test Manager"}),
      opsManagerAuthHeaders:async()=>({Authorization:"Bearer test-token","X-Device-Id":"OPS-TEST"})
    };`,
  }));
  await page.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/dashboard-api/system-feedback' && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [{
        id: feedbackId,
        summary: 'Screenshot feedback',
        category: 'app_problem',
        priority: 'high',
        status: 'new',
        message: 'The save button is obscured.',
        metadata_json: { image_attachment: { storage_path: 'feedback/test.png' } },
        created_at: '2026-07-29T20:00:00.000Z',
      }] }) });
    }
    if (path === `/feedback-api/image/${feedbackId}`) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('89504e470d0a1a0a', 'hex') });
    }
    if (path === `/dashboard-api/system-feedback/${feedbackId}/status`) {
      statusUpdate = request.postDataJSON();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { id: feedbackId, status: statusUpdate.status } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
  await page.goto('/system-feedback.html?hub=manager');
  await expect(page.locator('#feedback-inbox')).toBeVisible();
  await expect(page.getByText('The save button is obscured.')).toBeVisible();
  await page.getByRole('button', { name: 'View image' }).click();
  await expect(page.locator('.feedbackImage')).toBeVisible();
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  expect(statusUpdate).toEqual({ status: 'acknowledged' });
});
