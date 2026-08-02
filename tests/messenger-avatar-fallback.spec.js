const { test, expect } = require('@playwright/test');

const DEVICE_ID = 'KIOSK_AVATAR_TEST';
const USER_ID = '00000000-0000-4000-8000-000000000801';
const MEMPHIS_THREAD_ID = '00000000-0000-4000-8000-000000000802';
const ALIJAH_THREAD_ID = '00000000-0000-4000-8000-000000000803';

function thread({ id, title, type, updatedAt }) {
  return {
    thread_id: id,
    thread_type: type,
    thread_title: title,
    unread_count: 0,
    last_message_body: `Conversation with ${title}`,
    last_message_at: updatedAt,
    updated_at: updatedAt,
    participant_names: title,
    viewer_can_send: true,
  };
}

async function fulfillJson(route, data, meta = {}) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, data, meta }),
  });
}

async function installMessengerApi(context) {
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') {
      return fulfillJson(route, {
        msg_user_id: USER_ID,
        display_name: 'Karen Robinson',
        role: 'employee',
        canonical_device_id: DEVICE_ID,
      });
    }
    if (url.pathname === '/messaging-api/threads') {
      return fulfillJson(route, [
        thread({
          id: MEMPHIS_THREAD_ID,
          title: 'Memphis',
          type: 'bot',
          updatedAt: '2026-08-02T05:00:00.000Z',
        }),
        thread({
          id: ALIJAH_THREAD_ID,
          title: 'Alijah Collins',
          type: 'direct',
          updatedAt: '2026-08-02T04:00:00.000Z',
        }),
      ]);
    }
    if (url.pathname.includes('/messages')) return fulfillJson(route, []);
    if (url.pathname.endsWith('/read')) return fulfillJson(route, { marked: true });
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], {
        next_cursor: {
          after: '2026-08-02T05:00:00.000Z',
          after_id: MEMPHIS_THREAD_ID,
        },
      });
    }
    return fulfillJson(route, {});
  });
}

function conversation(page, name) {
  return page.locator('.cs-conversation').filter({ hasText: name });
}

test('employees without portrait data get initials while the Memphis image remains intact', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installMessengerApi(context);
  const page = await context.newPage();

  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);

  const alijahAvatar = conversation(page, 'Alijah Collins').locator('.cs-avatar');
  await expect(alijahAvatar.locator('.mz-avatar-visual')).toHaveAttribute('data-avatar-state', 'fallback');
  await expect(alijahAvatar.locator('.mz-avatar-initials')).toHaveText('AC');
  await expect(alijahAvatar.locator('img')).toHaveCount(0);
  await expect(alijahAvatar).not.toContainText('Alijah Collins');

  const memphisAvatar = conversation(page, 'Memphis AI').locator('.cs-avatar');
  await expect(memphisAvatar.locator('.mz-avatar-visual')).toHaveAttribute('data-avatar-state', 'loaded');
  const memphisImage = memphisAvatar.locator('img');
  await expect(memphisImage).toHaveCount(1);
  await expect(memphisImage).toHaveAttribute('alt', '');
  expect(await memphisImage.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);

  await context.close();
});

test('a failed portrait request fails closed to initials without broken-image text', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/memphis_avatar_ui.webp', (route) => route.abort('failed'));
  await installMessengerApi(context);
  const page = await context.newPage();

  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);

  const memphisAvatar = conversation(page, 'Memphis AI').locator('.cs-avatar');
  await expect(memphisAvatar.locator('.mz-avatar-visual')).toHaveAttribute('data-avatar-state', 'failed');
  await expect(memphisAvatar.locator('.mz-avatar-initials')).toHaveText('MA');
  await expect(memphisAvatar.locator('img')).toHaveCount(0);
  await expect(memphisAvatar).not.toContainText('Memphis AI');

  await context.close();
});
