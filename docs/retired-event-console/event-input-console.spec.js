const { test, expect } = require('@playwright/test');

const ZOO_GROUP = '00000000-0000-4000-8000-000000000801';
const MEMMEX_GROUP = '00000000-0000-4000-8000-000000000802';
const EVENT_CENTER_GROUP = '00000000-0000-4000-8000-000000000803';
const ZOO_VENUE = '00000000-0000-4000-8000-000000000811';
const EVENT_CENTER_VENUE = '00000000-0000-4000-8000-000000000812';

function authSession() {
  return {
    token: 'event-console-browser-session',
    role: 'ops_manager',
    roles: ['CUSTODIAL_MANAGER', 'OPS_MANAGER'],
    manager_id: '00000000-0000-4000-8000-000000000899',
    manager_display_name: 'Event Console Test Manager',
    device_id: 'event-console-browser',
    credential_id: '00000000-0000-4000-8000-000000000898',
    access_level: 'full_access',
    read_only: false,
    expires_at: '2036-07-18T00:00:00.000Z',
  };
}

const groups = [
  { location_group_id: ZOO_GROUP, group_code: 'ZOO_FOOTPRINT', group_name: 'Zoo Footprint', eligible_custodial_coverage: true },
  { location_group_id: MEMMEX_GROUP, group_code: 'MEMMEX', group_name: 'MemMex Restrooms', eligible_custodial_coverage: true, public_restroom: true },
  { location_group_id: EVENT_CENTER_GROUP, group_code: 'EVENT_CENTER', group_name: 'Event Center', eligible_custodial_coverage: true },
];
const venues = [
  { venue_id: ZOO_VENUE, venue_code: 'ZOO_FOOTPRINT', display_name: 'Zoo Footprint', location_group_id: ZOO_GROUP, event_scope: 'ZOO_WIDE', eligible_event_venue: false },
  { venue_id: EVENT_CENTER_VENUE, venue_code: 'EVENT_CENTER', display_name: 'Event Center', location_group_id: EVENT_CENTER_GROUP, event_scope: 'SINGLE_VENUE', eligible_event_venue: true },
];

async function installBackend(context) {
  const saves = [];
  await context.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const fulfill = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status < 400 ? { ok: true, data } : { ok: false, error: data }) });
    if (url.pathname === '/auth-api/session') return fulfill({ session: authSession(), trusted_device: { device_id: 'event-console-browser' } });
    if (url.pathname.endsWith('/location-groups')) return fulfill(groups);
    if (url.pathname.endsWith('/event-venues')) return fulfill(venues);
    if (url.pathname.endsWith('/coverage-locations')) return fulfill(groups);
    if (url.pathname === '/admin-api/events/parse-ai') {
      const text = String(request.postDataJSON()?.text || '');
      if (/members night|zoo[- ]wide|zoo footprint/i.test(text)) {
        return fulfill([{
          event_name: 'Members Night', event_scope: 'ZOO_WIDE', primary_venue_id: ZOO_VENUE,
          venue_ids: [ZOO_VENUE], display_location: 'Zoo Footprint', location_group_id: ZOO_GROUP,
          coverage_location_ids: /memmex/i.test(text) ? [MEMMEX_GROUP] : [], needs_review: false,
          parse_reason: 'Explicit zoo-wide language outranks custodial coverage.', parser_confidence: 1,
          event_date: '2026-07-17', start_time: '18:00:00', end_time: '20:30:00', attendee_count: null, notes: null,
        }]);
      }
      return fulfill([{
        event_name: 'Ambiguous Restroom Mention', event_scope: 'UNKNOWN', display_location: 'Needs Review',
        coverage_location_ids: [MEMMEX_GROUP], needs_review: true,
        parse_reason: 'MemMex Restrooms is eligible for coverage, not as an event venue.',
        event_date: '2026-07-19', start_time: '10:00:00', end_time: '11:00:00', attendee_count: null,
      }]);
    }
    if (url.pathname === '/admin-api/events/' && request.method() === 'GET') return fulfill([]);
    if (url.pathname === '/admin-api/events/' && request.method() === 'POST') {
      saves.push(request.postDataJSON());
      await new Promise((resolve) => setTimeout(resolve, 150));
      return fulfill({ id: '00000000-0000-4000-8000-000000000820' }, 201);
    }
    return fulfill([]);
  });
  return saves;
}

for (const profile of [
  { name: 'desktop', viewport: { width: 1280, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
]) {
  test(`${profile.name} console keeps zoo-wide venue separate from restroom coverage`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: profile.viewport });
    const saves = await installBackend(context);
    const page = await context.newPage();
    await page.goto('/events-admin.html');
    await expect(page.getByRole('heading', { name: 'Event Input Console' })).toBeVisible();
    await expect(page.locator('#event-venue option')).toHaveText(['Event Center']);
    await expect(page.locator('#coverage-locations option')).toHaveText(['Event Center', 'MemMex Restrooms', 'Zoo Footprint']);

    await page.locator('#paste-intake').fill('Members Night, zoo-wide, July 17 6pm to 8:30pm. Coverage: MemMex Restrooms.');
    await page.getByRole('button', { name: 'Parse Into Form' }).click();
    await expect(page.locator('#normalized-preview')).toContainText('Zoo Footprint');
    await expect(page.locator('#normalized-preview')).toContainText('MemMex Restrooms');
    await expect(page.locator('#normalized-preview')).toContainText('Ready to save');
    await expect(page.locator('#save-btn')).toBeEnabled();
    await page.locator('#save-btn').evaluate((button) => {
      button.click();
      button.click();
    });
    await expect.poll(() => saves.length).toBe(1);
    expect(saves[0].event_scope).toBe('ZOO_WIDE');
    expect(saves[0].display_location).toBe('Zoo Footprint');
    expect(saves[0].coverage_location_ids).toEqual([MEMMEX_GROUP]);
    expect(saves[0].location_group_id).toBe(ZOO_GROUP);
    for (const untrustedActorField of ['created_by', 'created_by_manager_id', 'actor', 'actor_id', 'manager_id']) {
      expect(saves[0]).not.toHaveProperty(untrustedActorField);
    }
    await context.close();
  });
}

test('restroom-only event venue remains unresolved and cannot be saved', async ({ browser }) => {
  const context = await browser.newContext();
  const saves = await installBackend(context);
  const page = await context.newPage();
  await page.goto('/events-admin.html');
  await page.locator('#paste-intake').fill('Staff meeting at MemMex Restrooms on July 19 from 10 to 11.');
  await page.getByRole('button', { name: 'Parse Into Form' }).click();
  await expect(page.locator('#event-scope')).toHaveValue('UNKNOWN');
  await expect(page.locator('#normalized-preview')).toContainText('Needs Review');
  await expect(page.locator('#save-btn')).toBeDisabled();
  expect(saves).toHaveLength(0);
  await context.close();
});
