const { test, expect } = require('@playwright/test');

const MANAGER_USER_ID = '00000000-0000-4000-8000-000000000901';
const EMPLOYEE_USER_ID = '00000000-0000-4000-8000-000000000907';
const RETIRED_THREAD_ID = '00000000-0000-4000-8000-000000000902';
const MEMPHIS_THREAD_ID = '00000000-0000-4000-8000-000000000904';
const ORDINARY_THREAD_ID = '00000000-0000-4000-8000-000000000906';
const GROUP_THREAD_ID = '00000000-0000-4000-8000-000000000905';
const MANAGER_TOKEN = 'browser-test-manager-session-token';
const RECIPIENT_IDS = [
  '00000000-0000-4000-8000-000000000911',
  '00000000-0000-4000-8000-000000000912',
  '00000000-0000-4000-8000-000000000913',
];

async function fulfill(route, data, status = 200, meta = {}) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status < 400 ? { ok: true, data, meta } : { ok: false, error: data }),
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

function retiredThread() {
  return {
    thread_id: RETIRED_THREAD_ID,
    thread_type: 'group',
    thread_title: 'Operations Leadership Chat (Retired)',
    system_key: 'ops_manager_shared_chat_v1',
    is_ops_manager_shared: true,
    unread_count: 3,
    last_message_body: 'This retired room must never be visible.',
    last_message_at: '2026-07-18T15:00:00.000Z',
    updated_at: '2026-07-18T15:00:00.000Z',
    participant_names: 'Operations Leadership',
    viewer_can_send: false,
  };
}

function memphisThread() {
  return {
    thread_id: MEMPHIS_THREAD_ID,
    thread_type: 'bot',
    thread_title: 'Memphis',
    unread_count: 0,
    last_message_body: 'How can I help today?',
    last_message_at: '2026-07-18T15:30:00.000Z',
    updated_at: '2026-07-18T15:30:00.000Z',
    participant_names: 'Memphis',
    viewer_can_send: true,
  };
}

function ordinaryThread(title = 'Employee Conversation') {
  return {
    thread_id: ORDINARY_THREAD_ID,
    thread_type: 'direct',
    thread_title: title,
    unread_count: 1,
    last_message_body: 'Employee message preview',
    last_message_at: '2026-07-18T16:00:00.000Z',
    updated_at: '2026-07-18T16:00:00.000Z',
    participant_names: title,
    viewer_can_send: true,
  };
}

function groupThread(title) {
  return {
    thread_id: GROUP_THREAD_ID,
    thread_type: 'group',
    thread_title: title,
    unread_count: 0,
    last_message_body: '',
    last_message_at: null,
    updated_at: '2026-07-18T17:00:00.000Z',
    participant_names: 'Employee One, Employee Two',
    viewer_can_send: true,
  };
}

function message(threadId, senderUserId, senderName, body, id = '00000000-0000-4000-8000-000000000920') {
  return {
    id,
    thread_id: threadId,
    sender_user_id: senderUserId,
    sender_display_name: senderName,
    message_type: 'text',
    body,
    sent_at: '2026-07-18T16:01:00.000Z',
    created_at: '2026-07-18T16:01:00.000Z',
    updated_at: '2026-07-18T16:01:00.000Z',
    is_deleted: false,
  };
}

async function configureBackend(context, { manager = false, deviceLabel = 'KIOSK_04', deleteFailureStatus = 0 } = {}) {
  const evidence = {
    authCalls: 0,
    managerApiCalls: 0,
    employeeApiCalls: 0,
    unauthorizedCalls: 0,
    createdGroups: [],
    createdDirects: [],
    deletedThreads: [],
  };
  let createdGroup = null;
  let ordinaryDeleted = false;
  const currentUserId = manager ? MANAGER_USER_ID : EMPLOYEE_USER_ID;
  const identity = manager
    ? {
      msg_user_id: MANAGER_USER_ID,
      user_id: MANAGER_USER_ID,
      display_name: 'Eric Operle',
      role: 'manager',
      role_title: 'Custodial Manager',
      job_title: 'Custodial Manager',
      identity_source: 'trusted_manager_session',
    }
    : {
      msg_user_id: EMPLOYEE_USER_ID,
      user_id: EMPLOYEE_USER_ID,
      display_name: 'Employee Phone User',
      role: 'employee',
      role_title: 'Employee',
      identity_source: 'device_assignment',
      canonical_device_id: deviceLabel,
    };

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/auth-api/session') {
      evidence.authCalls += 1;
      if (!manager) return fulfill(route, 'Employee device authority is required.', 401);
      return fulfill(route, {
        session: {
          token: MANAGER_TOKEN,
          role: 'ops_manager',
          roles: ['OPS_MANAGER', 'CUSTODIAL_MANAGER'],
          manager_display_name: 'Eric Operle',
          manager_job_title: 'Custodial Manager',
          access_level: 'full_access',
          expires_at: '2030-07-18T15:00:00.000Z',
          device_id: deviceLabel,
          credential_id: `credential-${deviceLabel}`,
        },
        trusted_device: { device_id: deviceLabel },
      });
    }

    if (!url.pathname.startsWith('/messaging-api/')) return route.continue();
    const authorization = request.headers().authorization || '';
    if (manager) {
      if (authorization !== `Bearer ${MANAGER_TOKEN}`) {
        evidence.unauthorizedCalls += 1;
        return fulfill(route, 'Trusted Ops Manager session required.', 401);
      }
      evidence.managerApiCalls += 1;
    } else {
      if (authorization) {
        evidence.unauthorizedCalls += 1;
        return fulfill(route, 'Employee requests must use device authority.', 403);
      }
      evidence.employeeApiCalls += 1;
    }

    if (url.pathname === '/messaging-api/me/by-device') return fulfill(route, identity);
    if (url.pathname === '/messaging-api/users') return fulfill(route, [
      { id: currentUserId, display_name: identity.display_name, role: identity.role, role_title: identity.role_title, is_active: true },
      { id: RECIPIENT_IDS[0], display_name: 'Employee One', role: 'employee', role_title: 'Employee', is_active: true },
      { id: RECIPIENT_IDS[1], display_name: 'Employee Two', role: 'employee', role_title: 'Employee', is_active: true },
      { id: RECIPIENT_IDS[2], display_name: 'Jennifer Sheffield', role: 'manager', role_title: 'Director of Operations', job_title: 'Director of Operations', is_active: true },
    ]);
    if (url.pathname === '/messaging-api/threads') {
      const rows = [retiredThread(), memphisThread()];
      if (!ordinaryDeleted) rows.push(ordinaryThread(manager ? 'Employee Conversation' : 'Employee One'));
      if (createdGroup) rows.push(groupThread(createdGroup.title));
      return fulfill(route, rows);
    }
    if (url.pathname === '/messaging-api/threads/updates') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfill(route, [], 200, { next_cursor: { after: '2026-07-18T17:00:00.000Z', after_id: GROUP_THREAD_ID } });
    }
    if (url.pathname === `/messaging-api/thread/${MEMPHIS_THREAD_ID}/messages`) {
      return fulfill(route, [message(MEMPHIS_THREAD_ID, '00000000-0000-4000-8000-000000000999', 'Memphis AI', 'How can I help today?')]);
    }
    if (url.pathname === `/messaging-api/thread/${ORDINARY_THREAD_ID}/messages`) {
      return fulfill(route, ordinaryDeleted ? [] : [message(ORDINARY_THREAD_ID, manager ? EMPLOYEE_USER_ID : RECIPIENT_IDS[0], manager ? 'Employee Phone User' : 'Employee One', 'Employee-owned message')]);
    }
    if (url.pathname === `/messaging-api/thread/${GROUP_THREAD_ID}/messages`) return fulfill(route, []);
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfill(route, [], 200, { next_cursor: { after: '2026-07-18T17:00:00.000Z', after_id: GROUP_THREAD_ID } });
    }
    if (url.pathname.endsWith('/read')) return fulfill(route, 1);
    if (url.pathname === '/messaging-api/thread/direct') {
      const payload = request.postDataJSON();
      evidence.createdDirects.push(payload);
      return fulfill(route, { id: ORDINARY_THREAD_ID, thread_type: 'direct', title: 'Employee One' });
    }
    if (url.pathname === '/messaging-api/thread/group') {
      const payload = request.postDataJSON();
      evidence.createdGroups.push(payload);
      createdGroup = { title: payload.title || 'New Group' };
      return fulfill(route, { id: GROUP_THREAD_ID, thread_type: 'group', title: createdGroup.title });
    }
    if (url.pathname === `/messaging-api/thread/${ORDINARY_THREAD_ID}/delete`) {
      const payload = request.postDataJSON();
      evidence.deletedThreads.push(payload);
      if (deleteFailureStatus) return fulfill(route, 'Deletion is not allowed.', deleteFailureStatus);
      ordinaryDeleted = true;
      return fulfill(route, { deleted: true, thread_id: ORDINARY_THREAD_ID, operation_id: payload.operation_id });
    }
    if (url.pathname === '/messaging-api/memphis/thread') return fulfill(route, memphisThread());
    return fulfill(route, {});
  });

  return evidence;
}

for (const fixture of [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
]) {
  test(`manager ${fixture.name} uses one ChatScope Messenger with Memphis AI and no forced leadership room`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: fixture.viewport });
    const evidence = await configureBackend(context, { manager: true, deviceLabel: `manager-${fixture.name}` });
    const page = await context.newPage();
    await page.goto('/messages.html?hub=manager');

    await expect(page.getByText('Memphis AI', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Employee Conversation', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Operations Leadership Chat/i)).toHaveCount(0);
    const identityLabel = page.getByText('Eric Operle · Custodial Manager', { exact: true });
    await expect(identityLabel).toHaveCount(1);
    if (fixture.name === 'desktop') await expect(identityLabel).toBeVisible();
    expect(evidence.authCalls).toBeGreaterThanOrEqual(1);
    expect(evidence.managerApiCalls).toBeGreaterThanOrEqual(2);
    expect(evidence.unauthorizedCalls).toBe(0);

    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    expect(stored).not.toContain(MANAGER_TOKEN);

    await page.getByText('Employee Conversation', { exact: true }).first().click();
    await expect(page.getByText('Employee-owned message', { exact: true })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Employee Conversation', { exact: true })).toHaveCount(0);
    expect(evidence.deletedThreads).toHaveLength(1);
    expect(evidence.deletedThreads[0]).toEqual({
      user_id: MANAGER_USER_ID,
      device_id: expect.stringMatching(/^manager-browser-[a-z0-9]+-[a-z0-9]+$/),
      operation_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    });
    await context.close();
  });
}

test('foreign, legacy, and malformed saved deletions stay visible and require manager recovery', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const evidence = await configureBackend(context, { manager: false, deviceLabel: 'KIOSK_04' });
  const foreignDeleteId = '00000000-0000-4000-8000-000000000931';
  const legacyDeleteId = '00000000-0000-4000-8000-000000000932';
  const malformedKey = 'mz_chatscope_delete_outbox:not-json';
  const foreignKey = `mz_chatscope_delete_outbox:${foreignDeleteId}`;
  const legacyKey = `mz_chatscope_delete_outbox:${legacyDeleteId}`;
  const foreignBytes = JSON.stringify({
    schema_version: 'chatscope-delete-outbox.v2',
    id: foreignDeleteId,
    thread_id: ORDINARY_THREAD_ID,
    user_id: MANAGER_USER_ID,
    device_id: 'KIOSK_04',
    security_generation: null,
    created_at: 1,
  });
  const legacyBytes = JSON.stringify({
    schema_version: 'chatscope-delete-outbox.v1',
    id: legacyDeleteId,
    thread_id: ORDINARY_THREAD_ID,
    user_id: EMPLOYEE_USER_ID,
    device_id: 'KIOSK_04',
    created_at: 2,
  });
  const malformedBytes = '{saved deletion is not valid JSON';
  const page = await pageWithStorage(context, [
    [foreignKey, foreignBytes],
    [legacyKey, legacyBytes],
    [malformedKey, malformedBytes],
  ]);

  await page.goto('/messages.html?hub=employee&device=KIOSK_04');
  await expect(page.getByText('Employee One', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('alert', { name: 'Saved deletion recovery' })).toContainText('Saved deletion needs manager recovery.');
  await expect(page.getByRole('button', { name: /Discard saved deletion/ })).toHaveCount(0);
  expect(evidence.deletedThreads).toHaveLength(0);
  expect(await page.evaluate(({ foreignKey: savedForeignKey, legacyKey: savedLegacyKey, badKey }) => ({
    foreign: localStorage.getItem(savedForeignKey),
    legacy: localStorage.getItem(savedLegacyKey),
    malformed: localStorage.getItem(badKey),
  }), { foreignKey, legacyKey, badKey: malformedKey })).toEqual({
    foreign: foreignBytes,
    legacy: legacyBytes,
    malformed: malformedBytes,
  });
  await context.close();
});

test('a named manager can explicitly discard one unchanged saved deletion recovery', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const deviceId = 'manager-delete-recovery';
  const evidence = await configureBackend(context, { manager: true, deviceLabel: deviceId });
  const legacyDeleteId = '00000000-0000-4000-8000-000000000933';
  const legacyKey = `mz_chatscope_delete_outbox:${legacyDeleteId}`;
  const legacyBytes = JSON.stringify({
    schema_version: 'chatscope-delete-outbox.v1',
    id: legacyDeleteId,
    thread_id: ORDINARY_THREAD_ID,
    user_id: EMPLOYEE_USER_ID,
    device_id: deviceId,
    created_at: 1,
  });
  const page = await pageWithStorage(context, [[legacyKey, legacyBytes]]);

  await page.goto('/messages.html?hub=manager');
  await expect(page.getByRole('alert', { name: 'Saved deletion recovery' })).toContainText('Saved deletion needs manager recovery.');
  expect(await page.evaluate((key) => localStorage.getItem(key), legacyKey)).toBe(legacyBytes);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Discard saved deletion/ }).click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), legacyKey)).toBeNull();
  expect(evidence.deletedThreads).toHaveLength(0);
  await context.close();
});

for (const status of [403, 422]) {
  test(`a permanent ${status} deletion failure becomes recovery instead of hiding the conversation forever`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const evidence = await configureBackend(context, { manager: false, deviceLabel: 'KIOSK_04', deleteFailureStatus: status });
    const page = await context.newPage();
    await page.goto(`/messages.html?hub=employee&device=KIOSK_04&thread_id=${ORDINARY_THREAD_ID}`);

    await expect(page.getByText('Employee-owned message', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Saved deletion needs manager recovery. It was not applied automatically.', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert', { name: 'Saved deletion recovery' })).toContainText('Saved deletion needs manager recovery.');
    await page.getByRole('button', { name: 'Back to conversations' }).click();
    await expect(page.getByText('Employee One', { exact: true }).first()).toBeVisible();
    expect(evidence.deletedThreads).toHaveLength(1);
    expect(evidence.deletedThreads[0]).toEqual({
      user_id: EMPLOYEE_USER_ID,
      device_id: 'KIOSK_04',
      operation_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    });
    const permanentDelete = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) => item.startsWith('mz_chatscope_delete_outbox:')) || '';
      return key ? JSON.parse(localStorage.getItem(key) || 'null') : null;
    });
    expect(permanentDelete?.recovery_state).toBe('permanent');
    expect(permanentDelete?.last_error).toContain('Deletion is not allowed.');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(100);
    expect(evidence.deletedThreads).toHaveLength(1);
    await context.close();
  });
}

test('an invalid manager thread deep link does not open an unrelated conversation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await configureBackend(context, { manager: true, deviceLabel: 'manager-invalid-link' });
  const page = await context.newPage();
  await page.goto('/messages.html?hub=manager&thread_id=00000000-0000-4000-8000-000000000999');

  await expect(page.getByText('Memphis AI', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Employee Conversation', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Choose a message', { exact: true })).toBeVisible();
  await expect(page.locator('.cs-conversation-header')).toHaveCount(0);
  await context.close();
});

test('employee device authority opens ChatScope without attempting manager authentication', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const evidence = await configureBackend(context, { manager: false, deviceLabel: 'KIOSK_04' });
  const page = await context.newPage();
  await page.goto('/messages.html?hub=employee&device=KIOSK_04');

  await expect(page.getByText('Memphis AI', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Employee One', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Operations Leadership Chat/i)).toHaveCount(0);
  expect(evidence.authCalls).toBe(0);
  expect(evidence.employeeApiCalls).toBeGreaterThanOrEqual(2);
  expect(evidence.unauthorizedCalls).toBe(0);

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New Message' })).toBeVisible();
  await expect(page.getByText('Jennifer Sheffield', { exact: true })).toBeVisible();
  await expect(page.getByText('Director of Operations', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Group name (optional)')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(0);
  await page.locator('.mz-chat-new-list .mz-chat-user').filter({ hasText: 'Employee One' }).click();
  await expect(page.locator('.cs-conversation-header__user-name', { hasText: 'Employee One' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back to conversations' })).toHaveCount(1);
  await expect(page.locator('.cs-conversation-header__back')).toHaveCount(0);
  await expect(page.locator('.mz-chat-mobile-back')).toHaveCount(0);
  await expect(page.locator('.cs-conversation-header__info')).toBeEmpty();
  expect(evidence.createdDirects).toHaveLength(1);
  expect(evidence.createdDirects[0].other_user_id).toBe(RECIPIENT_IDS[0]);
  expect(evidence.createdGroups).toHaveLength(0);
  await context.close();
});

test('employee and manager routes both retain stable ChatScope incremental polling', async ({ browser }) => {
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 1200, height: 780 } }),
    browser.newContext({ viewport: { width: 412, height: 915 } }),
  ]);
  try {
    const managerEvidence = await configureBackend(contexts[0], { manager: true, deviceLabel: 'manager-browser' });
    const employeeEvidence = await configureBackend(contexts[1], { manager: false, deviceLabel: 'KIOSK_04' });
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    await Promise.all([
      pages[0].goto('/messages.html?hub=manager'),
      pages[1].goto('/messages.html?hub=employee&device=KIOSK_04'),
    ]);
    await Promise.all(pages.map((page) => expect(page.getByText('Memphis AI', { exact: true }).first()).toBeVisible()));
    await expect.poll(() => managerEvidence.managerApiCalls).toBeGreaterThan(2);
    await expect.poll(() => employeeEvidence.employeeApiCalls).toBeGreaterThan(2);
    expect(managerEvidence.unauthorizedCalls).toBe(0);
    expect(employeeEvidence.unauthorizedCalls).toBe(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
