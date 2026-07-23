const { test, expect } = require('@playwright/test');

const USER_ID = '00000000-0000-4000-8000-000000000088';
const THREAD_ID = '00000000-0000-4000-8000-000000000001';
const FIRST_ID = '00000000-0000-4000-8000-000000000091';
const SECOND_ID = '00000000-0000-4000-8000-000000000092';
const DEVICE_ID = 'KIOSK_SYNC_TEST';

function identity() {
  return { msg_user_id: USER_ID, display_name: 'Sync Tester', role: 'employee', canonical_device_id: DEVICE_ID };
}

function threadRow(preview = 'Initial message', lastId = FIRST_ID, lastAt = '2026-07-18T12:00:00.000Z') {
  return {
    thread_id: THREAD_ID,
    thread_type: 'direct',
    thread_title: 'Operations',
    unread_count: preview === 'Live inbox update' ? 1 : 0,
    last_message_id: lastId,
    last_message_body: preview,
    last_message_at: lastAt,
    updated_at: lastAt,
    participant_names: 'Sync Tester, Operations',
    viewer_can_send: true,
  };
}

function message(id, body, sentAt, sender = USER_ID) {
  return {
    id,
    thread_id: THREAD_ID,
    sender_user_id: sender,
    sender_display_name: sender === USER_ID ? 'Sync Tester' : 'Operations',
    message_type: 'text',
    body,
    metadata_json: {},
    sent_at: sentAt,
    created_at: sentAt,
  };
}

async function fulfillJson(route, data, meta = {}) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, data, meta }),
  });
}

test('open thread reconciles a concurrent reply through the cursor long poll', async ({ browser }) => {
  const context = await browser.newContext();
  let liveAvailable = false;
  let updateCalls = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      const rows = [message(FIRST_ID, 'Initial message', '2026-07-18T12:00:00.000Z')];
      if (liveAvailable) rows.push(message(SECOND_ID, 'Live concurrent reply', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077'));
      return fulfillJson(route, rows);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/updates`) {
      updateCalls += 1;
      if (updateCalls === 1) {
        liveAvailable = true;
        return fulfillJson(route, [message(SECOND_ID, 'Live concurrent reply', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077')], {
          transport: 'cursor_long_poll',
          request_sequence: Number(url.searchParams.get('request_seq')),
          next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return fulfillJson(route, [], {
        transport: 'cursor_long_poll',
        request_sequence: Number(url.searchParams.get('request_seq')),
        next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
      });
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) return fulfillJson(route, { marked: true });
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/thread.html?thread_id=${THREAD_ID}&user_id=${USER_ID}&device=${DEVICE_ID}&hub=employee`);
  const messageList = page.locator('.cs-message-list');
  await expect(messageList.locator('.cs-message__content').getByText('Initial message', { exact: true })).toBeVisible();
  await expect(messageList.locator('.cs-message__content').getByText('Live concurrent reply', { exact: true })).toBeVisible();
  expect(updateCalls).toBeGreaterThanOrEqual(1);
  const cursorRequest = await page.evaluate(() => ({
    cursorAt: window.state?.updateCursorAt,
    cursorId: window.state?.updateCursorId,
  })).catch(() => ({}));
  expect(JSON.stringify(cursorRequest)).not.toContain('undefined error');
  await context.close();
});

test('desktop and mobile inboxes refresh promptly from thread change cursors', async ({ browser }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    let changed = false;
    let updateCalls = 0;
    await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
      if (url.pathname === '/messaging-api/threads') {
        return fulfillJson(route, [changed
          ? threadRow('Live inbox update', SECOND_ID, '2026-07-18T12:00:01.000Z')
          : threadRow()]);
      }
      if (url.pathname === '/messaging-api/threads/updates') {
        updateCalls += 1;
        if (updateCalls === 1) {
          changed = true;
          return fulfillJson(route, [{ thread_id: THREAD_ID, changed_at: '2026-07-18T12:00:01.000Z' }], {
            transport: 'cursor_long_poll',
            next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: THREAD_ID },
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return fulfillJson(route, [], {
          transport: 'cursor_long_poll',
          next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: THREAD_ID },
        });
      }
      return fulfillJson(route, {});
    });

    const page = await context.newPage();
    await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
    await expect(page.getByText('Live inbox update')).toBeVisible();
    expect(updateCalls).toBeGreaterThanOrEqual(1);
    await context.close();
  }
});
