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

async function pageWithStorage(context, entries) {
  const page = await context.newPage();
  await page.goto('/tests/storage-seed.html');
  await page.evaluate((rows) => {
    for (const [key, value] of rows) localStorage.setItem(key, value);
  }, entries);
  return page;
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

test('employee thread selection loads once and background refresh stays unobtrusive', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let messageCalls = 0;
  let updateCalls = 0;
  let releaseUpdate;
  const updateGate = new Promise((resolve) => { releaseUpdate = resolve; });

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      messageCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 600));
      const rows = [message(FIRST_ID, 'Initial message', '2026-07-18T12:00:00.000Z')];
      if (messageCalls > 1) rows.push(message(SECOND_ID, 'Quiet background reply', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077'));
      return fulfillJson(route, rows);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/updates`) {
      updateCalls += 1;
      if (updateCalls === 1) {
        await updateGate;
        return fulfillJson(route, [message(SECOND_ID, 'Quiet background reply', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077')], {
          transport: 'cursor_long_poll',
          request_sequence: Number(url.searchParams.get('request_seq')),
          next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], {
        transport: 'cursor_long_poll',
        request_sequence: Number(url.searchParams.get('request_seq')),
        next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
      });
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) return fulfillJson(route, { marked: true });
    if (url.pathname === '/messaging-api/threads/updates') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: '00000000-0000-0000-0000-000000000000' } });
    }
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  const conversation = page.locator('.cs-conversation').filter({ hasText: 'Operations' });
  await expect(conversation).toBeVisible();
  await page.waitForTimeout(100);
  expect(messageCalls).toBe(0);

  await conversation.click();
  await expect.poll(() => messageCalls).toBe(1);
  await expect(page.locator('.cs-loader')).toHaveCount(1);
  const messageList = page.locator('.cs-message-list');
  await expect(messageList.getByText('Initial message', { exact: true })).toBeVisible();

  releaseUpdate();
  await expect.poll(() => messageCalls).toBe(2);
  await expect(messageList.getByText('Initial message', { exact: true })).toBeVisible();
  await expect(page.locator('.cs-loader')).toHaveCount(0);
  await expect(messageList.getByText('Quiet background reply', { exact: true })).toBeVisible();
  await context.close();
});

test('rapid composer sends reach the backend in the order they were entered', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const posted = [];
  const completed = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      return fulfillJson(route, [message(FIRST_ID, 'Initial message', '2026-07-18T12:00:00.000Z')]);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/message` && request.method() === 'POST') {
      const body = request.postDataJSON();
      posted.push(body.body);
      if (posted.length === 1) await firstGate;
      completed.push(body.body);
      return fulfillJson(route, { id: body.client_message_id, status: 'sent' });
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    if (url.pathname.endsWith('/read')) return fulfillJson(route, { marked: true });
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/messages.html?thread_id=${THREAD_ID}&device=${DEVICE_ID}&hub=employee`);
  const editor = page.locator('.cs-message-input__content-editor');
  await expect(editor).toBeVisible();
  await editor.fill('First ordered message');
  await editor.press('Enter');
  await editor.fill('Second ordered message');
  await editor.press('Enter');

  await expect.poll(() => posted.length).toBe(1);
  await page.waitForTimeout(150);
  expect(posted).toEqual(['First ordered message']);
  releaseFirst();
  await expect.poll(() => completed.length).toBe(2);
  expect(completed).toEqual(['First ordered message', 'Second ordered message']);
  await context.close();
});

test('read-only conversations still acknowledge reads', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const readBodies = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [{ ...threadRow(), viewer_can_send: false, unread_count: 1 }]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      return fulfillJson(route, [message(FIRST_ID, 'Read-only update', '2026-07-18T12:00:00.000Z', '00000000-0000-4000-8000-000000000077')]);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) {
      readBodies.push(route.request().postDataJSON());
      return fulfillJson(route, { marked: true });
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/messages.html?thread_id=${THREAD_ID}&device=${DEVICE_ID}&hub=employee`);
  await expect(page.locator('.cs-message-list').getByText('Read-only update', { exact: true })).toBeVisible();
  await expect.poll(() => readBodies.length).toBeGreaterThan(0);
  expect(readBodies.at(-1).through_message_id).toBe(FIRST_ID);
  await expect(page.locator('.cs-message-input__content-editor')).toHaveAttribute('contenteditable', 'false');
  await context.close();
});

test('a saved read acknowledgement replays even when no messages are queued', async ({ browser }) => {
  const context = await browser.newContext();
  const key = `mz_chatscope_read_outbox:${USER_ID}:${THREAD_ID}`;
  const queuedRead = JSON.stringify({
    schema_version: 'chatscope-read-outbox.v2',
    id: key.slice('mz_chatscope_read_outbox:'.length),
    thread_id: THREAD_ID,
    user_id: USER_ID,
    device_id: DEVICE_ID,
    through_message_id: FIRST_ID,
    through_at: '2026-07-18T12:00:00.000Z',
    created_at: 1,
  });
  const readBodies = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) {
      readBodies.push(route.request().postDataJSON());
      return fulfillJson(route, { marked: true });
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    return fulfillJson(route, {});
  });

  const page = await pageWithStorage(context, [[key, queuedRead]]);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect.poll(() => readBodies.length).toBe(1);
  expect(readBodies[0].through_message_id).toBe(FIRST_ID);
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
  await context.close();
});

test('an unsafe legacy read acknowledgement is discarded without marking unseen messages', async ({ browser }) => {
  const context = await browser.newContext();
  const key = `mz_chatscope_read_outbox:${USER_ID}:${THREAD_ID}`;
  const legacyRead = JSON.stringify({
    schema_version: 'chatscope-read-outbox.v1',
    thread_id: THREAD_ID,
    user_id: USER_ID,
    device_id: DEVICE_ID,
    created_at: 1,
  });
  let readCalls = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) {
      readCalls += 1;
      return fulfillJson(route, { marked: true });
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    return fulfillJson(route, {});
  });

  const page = await pageWithStorage(context, [[key, legacyRead]]);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect.poll(() => page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
  expect(readCalls).toBe(0);
  await context.close();
});

test('a newer read horizon survives while the previous acknowledgement is in flight', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const readBodies = [];
  let messagesIncludeSecond = false;
  let releaseUpdate;
  let releaseFirstRead;
  const updateGate = new Promise((resolve) => { releaseUpdate = resolve; });
  const firstReadGate = new Promise((resolve) => { releaseFirstRead = resolve; });
  let updateCalls = 0;

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      const rows = [message(FIRST_ID, 'First visible horizon', '2026-07-18T12:00:00.000Z')];
      if (messagesIncludeSecond) rows.push(message(SECOND_ID, 'Second visible horizon', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077'));
      return fulfillJson(route, rows);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) {
      readBodies.push(request.postDataJSON());
      if (readBodies.length === 1) await firstReadGate;
      return fulfillJson(route, { marked: true });
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/updates`) {
      updateCalls += 1;
      if (updateCalls === 1) {
        await updateGate;
        messagesIncludeSecond = true;
        return fulfillJson(route, [message(SECOND_ID, 'Second visible horizon', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077')], {
          next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID } });
    }
    if (url.pathname === '/messaging-api/threads/updates') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: '00000000-0000-0000-0000-000000000000' } });
    }
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await page.locator('.cs-conversation').filter({ hasText: 'Operations' }).click();
  await expect.poll(() => readBodies.length).toBe(1);
  expect(readBodies[0].through_message_id).toBe(FIRST_ID);
  releaseUpdate();
  await expect(page.locator('.cs-message-list').getByText('Second visible horizon', { exact: true })).toBeVisible();
  expect(readBodies).toHaveLength(1);
  releaseFirstRead();
  await expect.poll(() => readBodies.length).toBe(2);
  expect(readBodies.map((row) => row.through_message_id)).toEqual([FIRST_ID, SECOND_ID]);
  await context.close();
});

test('a message fetch that finishes after Chats does not mark the hidden conversation read', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const readBodies = [];
  let releaseUpdate;
  let releaseHiddenFetch;
  const updateGate = new Promise((resolve) => { releaseUpdate = resolve; });
  const hiddenFetchGate = new Promise((resolve) => { releaseHiddenFetch = resolve; });
  let messageCalls = 0;
  let updateCalls = 0;

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow('Hidden arrival', SECOND_ID, '2026-07-18T12:00:01.000Z')]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      messageCalls += 1;
      if (messageCalls === 2) await hiddenFetchGate;
      const rows = [message(FIRST_ID, 'Visible before backing out', '2026-07-18T12:00:00.000Z')];
      if (messageCalls >= 2) rows.push(message(SECOND_ID, 'Arrived while leaving', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077'));
      return fulfillJson(route, rows);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) {
      readBodies.push(request.postDataJSON());
      return fulfillJson(route, { marked: true });
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/updates`) {
      updateCalls += 1;
      if (updateCalls === 1) {
        await updateGate;
        return fulfillJson(route, [message(SECOND_ID, 'Arrived while leaving', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077')], {
          next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID } });
    }
    if (url.pathname === '/messaging-api/threads/updates') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: '00000000-0000-0000-0000-000000000000' } });
    }
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  const conversation = page.locator('.cs-conversation').filter({ hasText: 'Operations' });
  await conversation.click();
  await expect.poll(() => readBodies.length).toBeGreaterThan(0);
  const visibleReadCount = readBodies.length;
  releaseUpdate();
  await expect.poll(() => messageCalls).toBe(2);
  await page.getByRole('button', { name: 'Back to conversations' }).click();
  releaseHiddenFetch();
  await page.waitForTimeout(250);
  expect(readBodies).toHaveLength(visibleReadCount);
  await conversation.click();
  await expect.poll(() => readBodies.some((row) => row.through_message_id === SECOND_ID)).toBe(true);
  await context.close();
});

test('desktop and mobile inboxes refresh promptly from thread change cursors', async ({ browser }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    let changed = false;
    let updateCalls = 0;
    let identityDeviceId = '';
    await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/messaging-api/me/by-device') {
        identityDeviceId = url.searchParams.get('device_id') || '';
        return fulfillJson(route, identity());
      }
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
    expect(identityDeviceId).toBe(DEVICE_ID);
    expect(updateCalls).toBeGreaterThanOrEqual(1);
    await context.close();
  }
});

test('one permanently failing outbox entry does not block the next queued message', async ({ browser }) => {
  const context = await browser.newContext();
  const poisonThreadId = '00000000-0000-4000-8000-000000000002';
  const poisonMessageId = 'msg:00000000-0000-4000-8000-000000000201';
  const validMessageId = 'msg:00000000-0000-4000-8000-000000000202';
  const delivered = [];
  const poisonBytes = JSON.stringify({
    id: poisonMessageId, thread_id: poisonThreadId, user_id: USER_ID,
    device_id: DEVICE_ID, body: 'stale queued message', memphis: false, created_at: 1,
  });
  const validBytes = JSON.stringify({
    id: validMessageId, thread_id: THREAD_ID, user_id: USER_ID,
    device_id: DEVICE_ID, body: 'deliver after poison entry', memphis: false, created_at: 2,
  });

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${poisonThreadId}/message`) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Thread no longer exists' }) });
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/message` && request.method() === 'POST') {
      delivered.push(request.postDataJSON());
      return fulfillJson(route, { id: SECOND_ID, status: 'sent' });
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) return fulfillJson(route, [message(FIRST_ID, 'Initial message', '2026-07-18T12:00:00.000Z')]);
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    if (url.pathname.endsWith('/read')) return fulfillJson(route, { marked: true });
    return fulfillJson(route, {});
  });

  const page = await pageWithStorage(context, [
    [`mz_chatscope_outbox:${poisonMessageId}`, poisonBytes],
    [`mz_chatscope_outbox:${validMessageId}`, validBytes],
  ]);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect.poll(() => delivered.length).toBe(1);
  expect(delivered[0].client_message_id).toBe(validMessageId);
  const outbox = await page.evaluate(({ badId, goodId }) => ({
    poison: JSON.parse(localStorage.getItem(`mz_chatscope_outbox:${badId}`) || 'null'),
    valid: localStorage.getItem(`mz_chatscope_outbox:${goodId}`),
  }), { badId: poisonMessageId, goodId: validMessageId });
  expect(outbox.poison.retry_count).toBeGreaterThanOrEqual(1);
  expect(outbox.poison.last_error).toContain('Thread no longer exists');
  expect(outbox.valid).toBeNull();
  await context.close();
});

test('a failed message blocks only later messages in the same conversation', async ({ browser }) => {
  const context = await browser.newContext();
  const otherThreadId = '00000000-0000-4000-8000-000000000003';
  const firstId = 'msg:00000000-0000-4000-8000-000000000301';
  const secondId = 'msg:00000000-0000-4000-8000-000000000302';
  const otherId = 'msg:00000000-0000-4000-8000-000000000303';
  let failFirst = true;
  const attempts = [];
  const queuedRows = [
    { id: firstId, thread_id: THREAD_ID, body: 'first in thread', created_at: 1 },
    { id: secondId, thread_id: THREAD_ID, body: 'second in thread', created_at: 2 },
    { id: otherId, thread_id: otherThreadId, body: 'other thread', created_at: 3 },
  ].map((row) => [`mz_chatscope_outbox:${row.id}`, JSON.stringify({
    schema_version: 'chatscope-message-outbox.v2',
    ...row,
    user_id: USER_ID,
    device_id: DEVICE_ID,
    memphis: false,
  })]);

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (request.method() === 'POST' && url.pathname.endsWith('/message')) {
      const body = request.postDataJSON();
      attempts.push(body.client_message_id);
      if (body.client_message_id === firstId && failFirst) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'temporary first-message failure' }) });
      }
      return fulfillJson(route, { id: body.client_message_id, status: 'sent' });
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: '00000000-0000-0000-0000-000000000000' } });
    }
    return fulfillJson(route, {});
  });

  const page = await pageWithStorage(context, queuedRows);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect.poll(() => attempts.includes(otherId)).toBe(true);
  expect(attempts).toEqual([firstId, otherId]);
  expect(await page.evaluate((id) => localStorage.getItem(`mz_chatscope_outbox:${id}`), secondId)).not.toBeNull();

  failFirst = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => attempts.filter((id) => id === secondId).length).toBe(1);
  expect(attempts).toEqual([firstId, otherId, firstId, secondId]);
  const remaining = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('mz_chatscope_outbox:')));
  expect(remaining).toEqual([]);
  await context.close();
});

test('a queued message owned by another signed-in user is preserved byte for byte', async ({ browser }) => {
  const context = await browser.newContext();
  const foreignId = 'msg:00000000-0000-4000-8000-000000000401';
  const foreignBytes = JSON.stringify({
    schema_version: 'chatscope-message-outbox.v2',
    id: foreignId,
    thread_id: THREAD_ID,
    user_id: '00000000-0000-4000-8000-000000000999',
    device_id: DEVICE_ID,
    body: 'do not erase another account message',
    memphis: false,
    created_at: 1,
  });
  let messagePosts = 0;

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (request.method() === 'POST' && url.pathname.endsWith('/message')) messagePosts += 1;
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: '00000000-0000-0000-0000-000000000000' } });
    }
    return fulfillJson(route, {});
  });

  const page = await pageWithStorage(context, [[`mz_chatscope_outbox:${foreignId}`, foreignBytes]]);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect(page.getByText('A saved message belongs to another signed-in user. Sign in as that user to send it.', { exact: true })).toBeVisible();
  expect(messagePosts).toBe(0);
  expect(await page.evaluate((id) => localStorage.getItem(`mz_chatscope_outbox:${id}`), foreignId)).toBe(foreignBytes);
  await context.close();
});

test('a delivered message survives a security-generation transition and retries with one stable id', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const nativeDeviceId = 'KIOSK_08';
  const page = await pageWithStorage(context, []);
  await page.addInitScript(({ deviceId: authoritativeDeviceId }) => {
    window.__messagingSecurityGeneration = 1;
    window.MemphisCustodialSecurity = {
      native: true,
      ready: Promise.resolve(),
      waitForStableState: async () => ({ generation: window.__messagingSecurityGeneration }),
      getStatus: () => ({
        ready: true,
        initialized: true,
        available: true,
        quarantined: false,
        deviceId: authoritativeDeviceId,
        generation: window.__messagingSecurityGeneration,
      }),
      mutateProtectedWork: async (operation, options = {}) => {
        const current = window.__messagingSecurityGeneration;
        if (options.expectedGeneration != null && Number(options.expectedGeneration) !== current) {
          const error = new Error('security generation changed');
          error.code = 'custodial_security_generation_changed';
          throw error;
        }
        return operation({ generation: current });
      },
    };
    window.MemphisMobile = {
      edition: 'custodial',
      ready: Promise.resolve(),
      deviceId: () => authoritativeDeviceId,
      authoritativeDeviceId: async () => authoritativeDeviceId,
      employeeDeviceAuthority: true,
      requestEnvelope: async (path, { method = 'GET', body, signal } = {}) => {
        const response = await fetch(`https://memphis-zoo-mcp.onrender.com${path}`, {
          method,
          signal,
          headers: {
            'X-Device-Id': authoritativeDeviceId,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
        return payload;
      },
    };
    window.MemphisMobileBuildIdentity = { edition: 'custodial' };
  }, { deviceId: nativeDeviceId });

  const attempts = [];
  const committed = new Set();
  let releaseFirstResponse;
  const firstResponseGate = new Promise((resolve) => { releaseFirstResponse = resolve; });

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth-api/session') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'No manager session' }) });
    }
    if (url.pathname === '/scan-api/rpc') return fulfillJson(route, []);
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, { ...identity(), canonical_device_id: nativeDeviceId });
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      return fulfillJson(route, [message(FIRST_ID, 'Initial message', '2026-07-18T12:00:00.000Z')]);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/message` && request.method() === 'POST') {
      const body = request.postDataJSON();
      attempts.push(body.client_message_id);
      committed.add(body.client_message_id);
      if (attempts.length === 1) await firstResponseGate;
      return fulfillJson(route, { id: body.client_message_id, status: 'sent' });
    }
    if (url.pathname.endsWith('/read')) return fulfillJson(route, { marked: true });
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    return fulfillJson(route, {});
  });

  await page.goto(`/messages.html?thread_id=${THREAD_ID}&device=${nativeDeviceId}&hub=employee`);
  const editor = page.locator('.cs-message-input__content-editor');
  await expect(editor).toBeVisible();
  await editor.fill('survive the generation transition');
  await editor.press('Enter');
  await expect.poll(() => attempts.length).toBe(1);
  await page.evaluate(() => { window.__messagingSecurityGeneration = 2; });
  releaseFirstResponse();
  await expect(page.getByText('No connection. Your message is saved and will send later.', { exact: true })).toBeVisible();
  const queuedKey = await page.evaluate(() => Object.keys(localStorage).find((key) => key.startsWith('mz_chatscope_outbox:')) || '');
  expect(queuedKey).not.toBe('');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).security_generation, queuedKey)).toBe(1);

  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[1]).toBe(attempts[0]);
  expect(committed.size).toBe(1);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), queuedKey)).toBeNull();
  await context.close();
});

test('custodial restore quarantine freezes the message outbox across retry events', async ({ browser }) => {
  const context = await browser.newContext();
  const queuedId = 'msg:00000000-0000-4000-8000-000000000299';
  const queuedBytes = JSON.stringify({
    id: queuedId,
    thread_id: THREAD_ID,
    user_id: USER_ID,
    device_id: 'KIOSK_08',
    body: 'preserve without retry mutation',
    memphis: false,
    created_at: 3,
    retry_count: 7,
    last_error: 'original failure',
  });
  const page = await pageWithStorage(context, [[`mz_chatscope_outbox:${queuedId}`, queuedBytes]]);
  await page.addInitScript(() => {
    window.MemphisCustodialSecurity = {
      ensureSecurityState: async () => {},
      getStatus: () => ({ initialized: true, available: true, quarantined: true, reason: 'restored_operational_state' }),
    };
  });

  let messagePosts = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname.endsWith('/message')) messagePosts += 1;
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname.endsWith('/updates')) {
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: FIRST_ID } });
    }
    return fulfillJson(route, {});
  });

  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new CustomEvent('memphis:messenger-resume'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate((id) => localStorage.getItem(`mz_chatscope_outbox:${id}`), queuedId)).toBe(queuedBytes);
  expect(messagePosts).toBe(0);
  await context.close();
});
