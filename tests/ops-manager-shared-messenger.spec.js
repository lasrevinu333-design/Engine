const { test, expect } = require('@playwright/test');

const MANAGER_USER_ID = '00000000-0000-4000-8000-000000000901';
const SHARED_THREAD_ID = '00000000-0000-4000-8000-000000000902';
const MANAGER_TOKEN = 'browser-test-manager-session-token';
const GROUP_THREAD_ID = '00000000-0000-4000-8000-000000000905';
const ORDINARY_THREAD_ID = '00000000-0000-4000-8000-000000000906';
const EMPLOYEE_USER_ID = '00000000-0000-4000-8000-000000000907';
const RECIPIENT_IDS = [
  '00000000-0000-4000-8000-000000000911',
  '00000000-0000-4000-8000-000000000912',
  '00000000-0000-4000-8000-000000000913',
];

function managerIdentity() {
  return {
    msg_user_id: MANAGER_USER_ID,
    user_id: MANAGER_USER_ID,
    display_name: 'Ops Manager',
    role: 'manager',
    identity_source: 'trusted_manager_session',
    ops_manager_thread_id: SHARED_THREAD_ID,
  };
}

function sharedThread() {
  return {
    thread_id: SHARED_THREAD_ID,
    thread_type: 'group',
    thread_title: 'Ops Manager Chat',
    system_key: 'ops_manager_shared_chat_v1',
    is_ops_manager_shared: true,
    unread_count: 1,
    last_message_id: '00000000-0000-4000-8000-000000000903',
    last_message_body: 'Shared operations update',
    last_message_at: '2026-07-18T15:00:00.000Z',
    updated_at: '2026-07-18T15:00:00.000Z',
    participant_names: 'Ops Manager, Custodial Manager',
    viewer_can_send: true,
  };
}

async function fulfill(route, data, status = 200, meta = {}) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status < 400 ? { ok: true, data, meta } : { ok: false, error: data }),
  });
}

async function configureManagerBackend(context, deviceLabel) {
  const evidence = { authCalls: 0, managerApiCalls: 0, unauthenticatedManagerApiCalls: 0, deleteCalls: 0, deleteThreadCalls: [], createdGroups: [], teamCalls: 0 };
  let sharedMessage = {
    id: '00000000-0000-4000-8000-000000000903',
    thread_id: SHARED_THREAD_ID,
    sender_user_id: '00000000-0000-4000-8000-000000000904',
    sender_display_name: 'Custodial Manager',
    message_type: 'text',
    body: 'Shared operations update',
    metadata_json: {},
    sent_at: '2026-07-18T15:00:00.000Z',
    created_at: '2026-07-18T15:00:00.000Z',
    updated_at: '2026-07-18T15:00:00.000Z',
    is_deleted: false,
  };
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth-api/session') {
      evidence.authCalls += 1;
      return fulfill(route, {
        session: {
          token: MANAGER_TOKEN,
          role: 'ops_manager',
          roles: ['OPS_MANAGER'],
          access_level: 'full_access',
          expires_at: '2030-07-18T15:00:00.000Z',
          device_id: deviceLabel,
          credential_id: `credential-${deviceLabel}`,
        },
        trusted_device: { device_id: deviceLabel },
      });
    }
    if (url.pathname.startsWith('/messaging-api/')) {
      const authorized = request.headers().authorization === `Bearer ${MANAGER_TOKEN}`;
      if (authorized) evidence.managerApiCalls += 1;
      else evidence.unauthenticatedManagerApiCalls += 1;
      if (!authorized) return fulfill(route, 'Trusted Ops Manager session required.', 401);
      if (url.pathname === '/messaging-api/me/by-device') return fulfill(route, managerIdentity());
      if (url.pathname === '/messaging-api/threads') {
        const ordinary = {
          thread_id: ORDINARY_THREAD_ID,
          thread_type: 'direct',
          thread_title: 'Employee Conversation',
          participant_names: 'Ops Manager, Employee One',
          updated_at: '2026-07-18T14:00:00.000Z',
          viewer_can_send: true,
        };
        const created = evidence.createdGroups.map((createdGroup) => ({
          thread_id: GROUP_THREAD_ID,
          thread_type: 'group',
          thread_title: createdGroup.title,
          participant_names: 'Ops Manager, Employee One, Employee Two, Director',
          updated_at: '2026-07-18T16:00:00.000Z',
          viewer_can_send: true,
        }));
        return fulfill(route, [sharedThread(), ...created, ordinary]);
      }
      if (url.pathname === '/messaging-api/users') return fulfill(route, [
        { id: MANAGER_USER_ID, display_name: 'Ops Manager', role: 'manager', is_active: true },
        { id: RECIPIENT_IDS[0], display_name: 'Employee One', role: 'employee', is_active: true },
        { id: RECIPIENT_IDS[1], display_name: 'Employee Two', role: 'employee', is_active: true },
        { id: RECIPIENT_IDS[2], display_name: 'Employee Three', role: 'employee', is_active: true },
      ]);
      if (url.pathname === '/messaging-api/threads/updates') {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return fulfill(route, [], 200, {
          transport: 'cursor_long_poll',
          next_cursor: { after: '2026-07-18T15:00:00.000Z', after_id: SHARED_THREAD_ID },
        });
      }
      if (url.pathname === `/messaging-api/thread/${SHARED_THREAD_ID}/messages`) {
        return fulfill(route, [sharedMessage]);
      }
      if (url.pathname === `/messaging-api/thread/${SHARED_THREAD_ID}/message/${sharedMessage.id}/delete`) {
        evidence.deleteCalls += 1;
        sharedMessage = { ...sharedMessage, body: '[deleted]', is_deleted: true, deleted_at: '2026-07-18T16:00:00.000Z', purge_after: '2026-08-01T16:00:00.000Z', updated_at: '2026-07-18T16:00:00.000Z' };
        return fulfill(route, sharedMessage);
      }
      if (url.pathname === '/messaging-api/thread/group') {
        const createdGroup = request.postDataJSON();
        evidence.createdGroups.push(createdGroup);
        return fulfill(route, { id: GROUP_THREAD_ID, thread_type: 'group', title: createdGroup.title });
      }
      if (url.pathname === '/messaging-api/thread/team') {
        evidence.teamCalls += 1;
        return fulfill(route, 'The automatic Custodial Team room is retired.', 410);
      }
      if (url.pathname === `/messaging-api/thread/${ORDINARY_THREAD_ID}/delete`) {
        const body = request.postDataJSON();
        evidence.deleteThreadCalls.push(body);
        return fulfill(route, {
          deleted: true,
          thread_id: ORDINARY_THREAD_ID,
          operation_id: body.operation_id,
          deleted_at: '2026-07-18T17:00:00.000Z',
          purge_after: '2026-08-01T17:00:00.000Z',
        }, 200, { retention_days: 14, deletion: 'all_participants' });
      }
      if (url.pathname === `/messaging-api/thread/${GROUP_THREAD_ID}/messages`) return fulfill(route, []);
      if (url.pathname === `/messaging-api/thread/${GROUP_THREAD_ID}/read`) return fulfill(route, 0);
      if (url.pathname === `/messaging-api/thread/${SHARED_THREAD_ID}/updates`) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return fulfill(route, [], 200, {
          transport: 'cursor_long_poll',
          next_cursor: { after: '2026-07-18T15:00:00.000Z', after_id: '00000000-0000-4000-8000-000000000903' },
        });
      }
      if (url.pathname === `/messaging-api/thread/${SHARED_THREAD_ID}/read`) return fulfill(route, 1);
      return fulfill(route, {});
    }
    return route.continue();
  });
  return evidence;
}

for (const fixture of [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
]) {
  test(`trusted Ops Manager ${fixture.name} opens the same shared room without a kiosk identity`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: fixture.viewport });
    const evidence = await configureManagerBackend(context, `manager-${fixture.name}`);
    const page = await context.newPage();
    await page.goto('/messages.html?hub=manager');

    await expect(page.getByText('Ops Manager Chat', { exact: true })).toBeVisible();
    await expect(page.getByText('All Ops Managers')).toBeVisible();
    await expect(page.getByText('Ops Manager · shared Ops Manager chat')).toBeVisible();
    await expect(page.locator(`[data-thread-wrap="${SHARED_THREAD_ID}"]`)).toHaveClass(/shared/);
    await expect(page.locator(`[data-thread-wrap="${SHARED_THREAD_ID}"] [data-thread-delete]`)).toHaveCount(0);
    await expect(page.locator(`[data-thread-wrap="${ORDINARY_THREAD_ID}"] [data-thread-delete]`)).toBeVisible();
    await expect(page.getByText('Custodial Team', { exact: true })).toHaveCount(0);
    expect(evidence.authCalls).toBeGreaterThanOrEqual(1);
    expect(evidence.managerApiCalls).toBeGreaterThanOrEqual(2);
    expect(evidence.unauthenticatedManagerApiCalls).toBe(0);

    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    expect(stored).not.toContain(MANAGER_TOKEN);

    await page.getByText('Ops Manager Chat', { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`thread_id=${SHARED_THREAD_ID}`));
    await expect(page.getByText('Shared by all Ops Managers')).toBeVisible();
    await expect(page.getByText('Shared operations update')).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete message from Custodial Manager' }).click();
    await expect(page.getByText('Message deleted', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Shared operations update')).toHaveCount(0);
    expect(evidence.deleteCalls).toBe(1);
    expect(evidence.unauthenticatedManagerApiCalls).toBe(0);

    await page.goto('/messages.html?hub=manager');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator(`[data-thread-wrap="${ORDINARY_THREAD_ID}"] [data-thread-delete]`).click();
    await expect(page.getByText('Employee Conversation', { exact: true })).toHaveCount(0);
    expect(evidence.deleteThreadCalls).toHaveLength(1);
    expect(evidence.deleteThreadCalls[0].operation_id).toMatch(/^[0-9a-f-]{36}$/i);
    await context.close();
  });
}

async function configureEmployeeBackend(context, { confirmDeletion = true } = {}) {
  const evidence = { teamCalls: 0, groupCalls: [], deleteCalls: 0, unauthenticatedCalls: 0 };
  let employeeMessage = {
    id: '00000000-0000-4000-8000-000000000909',
    thread_id: ORDINARY_THREAD_ID,
    sender_user_id: EMPLOYEE_USER_ID,
    sender_display_name: 'Employee Phone User',
    message_type: 'text',
    body: 'Employee-owned message',
    sent_at: '2026-07-18T16:30:00.000Z',
    created_at: '2026-07-18T16:30:00.000Z',
    updated_at: '2026-07-18T16:30:00.000Z',
    is_deleted: false,
  };
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/messaging-api/')) return route.continue();
    evidence.unauthenticatedCalls += 1;
    if (request.headers().authorization) return fulfill(route, 'Employee requests must use device authority.', 403);
    if (url.pathname === '/messaging-api/me/by-device') return fulfill(route, {
      msg_user_id: EMPLOYEE_USER_ID,
      user_id: EMPLOYEE_USER_ID,
      display_name: 'Employee Phone User',
      role: 'employee',
      identity_source: 'device_assignment',
    });
    if (url.pathname === '/messaging-api/users') return fulfill(route, [
      { id: EMPLOYEE_USER_ID, display_name: 'Employee Phone User', role: 'employee', is_active: true },
      { id: RECIPIENT_IDS[0], display_name: 'Employee One', role: 'employee', is_active: true },
      { id: RECIPIENT_IDS[1], display_name: 'Employee Two', role: 'employee', is_active: true },
      { id: RECIPIENT_IDS[2], display_name: 'Ops Manager', role: 'manager', is_active: true },
    ]);
    if (url.pathname === '/messaging-api/thread/team') {
      evidence.teamCalls += 1;
      return fulfill(route, 'The automatic Custodial Team room is retired.', 410);
    }
    if (url.pathname === '/messaging-api/thread/group') {
      evidence.groupCalls.push(request.postDataJSON());
      return fulfill(route, { id: GROUP_THREAD_ID, thread_type: 'group', title: request.postDataJSON().title });
    }
    if (url.pathname === '/messaging-api/threads') {
      const ordinary = {
        thread_id: ORDINARY_THREAD_ID,
        thread_type: 'direct',
        thread_title: 'Employee One',
        participant_names: 'Employee Phone User, Employee One',
        last_message_body: employeeMessage?.body || '',
        last_message_at: employeeMessage?.sent_at || null,
        updated_at: '2026-07-18T16:30:00.000Z',
        viewer_can_send: true,
      };
      return fulfill(route, [ordinary]);
    }
    if (url.pathname === `/messaging-api/thread/${ORDINARY_THREAD_ID}/messages`) return fulfill(route, employeeMessage ? [employeeMessage] : []);
    if (url.pathname === `/messaging-api/thread/${ORDINARY_THREAD_ID}/message/00000000-0000-4000-8000-000000000909/delete`) {
      evidence.deleteCalls += 1;
      if (!confirmDeletion) return fulfill(route, { ...employeeMessage, is_deleted: false });
      const deleted = { ...employeeMessage, body: '[deleted]', is_deleted: true, deleted_at: '2026-07-18T16:32:00.000Z', purge_after: '2026-08-01T16:32:00.000Z', updated_at: '2026-07-18T16:32:00.000Z' };
      employeeMessage = null;
      return fulfill(route, deleted);
    }
    if (url.pathname === `/messaging-api/thread/${ORDINARY_THREAD_ID}/read`) return fulfill(route, 1);
    if (url.pathname === `/messaging-api/thread/${ORDINARY_THREAD_ID}/updates` || url.pathname === '/messaging-api/threads/updates') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfill(route, [], 200, { next_cursor: { after: '2026-07-18T16:32:00.000Z', after_id: ORDINARY_THREAD_ID } });
    }
    if (url.pathname === `/messaging-api/thread/${GROUP_THREAD_ID}/messages`) return fulfill(route, []);
    if (url.pathname.endsWith('/read')) return fulfill(route, 0);
    return fulfill(route, {});
  });
  return evidence;
}

test('employee UI never reports deletion success without authoritative server confirmation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const evidence = await configureEmployeeBackend(context, { confirmDeletion: false });
  const page = await context.newPage();
  await page.goto(`/thread.html?hub=employee&thread_id=${ORDINARY_THREAD_ID}&device=KIOSK_04`);
  await expect(page.getByText('Employee-owned message', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete message from Employee Phone User' }).click();
  await expect(page.getByText('Employee-owned message', { exact: true })).toBeVisible();
  expect(evidence.deleteCalls).toBe(1);
  await context.close();
});

for (const fixture of [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
]) {
  test(`employee ${fixture.name} can create groups, select everyone, and remove an owned message`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: fixture.viewport });
    const evidence = await configureEmployeeBackend(context);
    const page = await context.newPage();

    await page.goto('/thread.html?hub=employee&mode=new&device=KIOSK_04');
    await expect(page.getByText('Select Everyone', { exact: true })).toBeVisible();
    await page.getByText('Employee One', { exact: true }).click();
    await page.getByText('Employee Two', { exact: true }).click();
    await expect(page.getByText('2 people selected', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Create Conversation' }).click();
    await expect(page).toHaveURL(new RegExp(`thread_id=${GROUP_THREAD_ID}`));
    expect(evidence.groupCalls).toHaveLength(1);
    expect(new Set(evidence.groupCalls[0].member_user_ids)).toEqual(new Set(RECIPIENT_IDS.slice(0, 2)));
    expect(evidence.groupCalls[0].client_thread_id).toMatch(/^thread:/);

    await page.goto('/thread.html?hub=employee&mode=new&device=KIOSK_04');
    await page.getByText('Select Everyone', { exact: true }).click();
    await expect(page.getByText('3 people selected', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Create Conversation' }).click();
    await expect(page).toHaveURL(new RegExp(`thread_id=${GROUP_THREAD_ID}`));
    expect(evidence.teamCalls).toBe(0);
    expect(evidence.groupCalls).toHaveLength(2);
    expect(evidence.groupCalls[1].title).toBe('Everyone');
    expect(new Set(evidence.groupCalls[1].member_user_ids)).toEqual(new Set(RECIPIENT_IDS));

    await page.goto(`/thread.html?hub=employee&thread_id=${ORDINARY_THREAD_ID}&device=KIOSK_04`);
    await expect(page.getByText('Employee-owned message', { exact: true })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete message from Employee Phone User' }).click();
    await expect(page.getByText('Employee-owned message', { exact: true })).toHaveCount(0);
    await expect(page.locator(`[data-message-id="00000000-0000-4000-8000-000000000909"]`)).toHaveCount(0);
    expect(evidence.deleteCalls).toBe(1);
    expect(evidence.unauthenticatedCalls).toBeGreaterThan(0);
    await context.close();
  });
}

test('two independent trusted manager browser profiles resolve the same canonical chat', async ({ browser }) => {
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 1200, height: 780 } }),
    browser.newContext({ viewport: { width: 412, height: 915 } }),
  ]);
  try {
    await Promise.all(contexts.map((context, index) => configureManagerBackend(context, `independent-manager-${index + 1}`)));
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    await Promise.all(pages.map((page) => page.goto('/messages.html?hub=manager')));
    await Promise.all(pages.map((page) => expect(page.locator(`[data-thread-id="${SHARED_THREAD_ID}"]`)).toBeVisible()));
    const threadIds = await Promise.all(pages.map((page) => page.locator('[data-thread-id]').first().getAttribute('data-thread-id')));
    expect(new Set(threadIds)).toEqual(new Set([SHARED_THREAD_ID]));
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

for (const fixture of [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
]) {
  test(`Ops Manager ${fixture.name} can select multiple people or Select Everyone`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: fixture.viewport });
    const evidence = await configureManagerBackend(context, `recipient-picker-${fixture.name}`);
    const page = await context.newPage();
    await page.goto('/thread.html?hub=manager&mode=new');

    await expect(page.getByRole('heading', { name: 'Choose Recipients' })).toBeVisible();
    await expect(page.getByText('Select Everyone', { exact: true })).toBeVisible();
    await page.getByText('Employee One', { exact: true }).click();
    await page.getByText('Employee Two', { exact: true }).click();
    await expect(page.getByText('2 people selected', { exact: true })).toBeVisible();
    await page.getByText('Select Everyone', { exact: true }).click();
    await expect(page.getByText('3 people selected', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Create Conversation' }).click();

    await expect(page).toHaveURL(new RegExp(`thread_id=${GROUP_THREAD_ID}`));
    expect(evidence.teamCalls).toBe(0);
    expect(evidence.createdGroups).toHaveLength(1);
    expect(evidence.createdGroups[0].title).toBe('Everyone');
    expect(new Set(evidence.createdGroups[0].member_user_ids)).toEqual(new Set(RECIPIENT_IDS));
    expect(evidence.unauthenticatedManagerApiCalls).toBe(0);
    await context.close();
  });
}
