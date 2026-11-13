import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/memphis-auth.js*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `window.MemphisAuth={
      requireOpsManagerSession:async()=>({manager_display_name:"Test Manager"}),
      opsManagerAuthHeaders:async()=>({Authorization:"Bearer test-token"})
    };`,
  }));
});

test('manager Today links open the matching dashboard truth', async ({ page }) => {
  await page.goto('/dashboard.html?demo=1#overdue');
  await expect(page.locator('.filterBtn[data-filter="overdue"]')).toHaveClass(/active/);
  await expect(page.getByText('Teton Trek Restrooms')).toBeVisible();
  await expect(page.getByText('China Restrooms')).toHaveCount(0);

  await page.evaluate(() => { window.location.hash = 'due-soon'; });
  await expect(page.locator('.filterBtn[data-filter="due_soon"]')).toHaveClass(/active/);
  await expect(page.getByText('China Restrooms')).toBeVisible();
  await expect(page.getByText('Teton Trek Restrooms')).toHaveCount(0);

  await page.evaluate(() => { window.location.hash = 'being-cleaned'; });
  await expect(page.locator('.filterBtn[data-filter="in_progress"]')).toHaveClass(/active/);
  await expect(page.getByText('No rows available.')).toHaveCount(2);

  await page.evaluate(() => { window.location.hash = 'tickets-section'; });
  await expect(page.locator('.filterBtn[data-filter="tickets"]')).toHaveClass(/active/);
  await expect(page.getByText('Soap dispenser loose on wall')).toBeVisible();
  await expect(page.locator('#restroom-section')).toHaveClass(/hidden/);
  await expect(page.locator('#exhibit-section')).toHaveClass(/hidden/);
});
