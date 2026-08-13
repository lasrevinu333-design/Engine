const { test, expect } = require('@playwright/test');

test('reassignment confirmation names pending work and prior-employee offline authority', async ({ page }) => {
  const currentEmployee = '00000000-0000-4000-8000-000000000201';
  const nextEmployee = '00000000-0000-4000-8000-000000000202';
  const priorEmployee = '00000000-0000-4000-8000-000000000203';
  await page.addInitScript(({ current, next, prior }) => {
    const data = {
      employees: [
        { id: current, display_name: 'Current Employee', employee_code: 'EMP201', assigned_device_id: 'KIOSK_02' },
        { id: next, display_name: 'Next Employee', employee_code: 'EMP202', assigned_device_id: null },
        { id: prior, display_name: 'Prior Employee', employee_code: 'EMP203', assigned_device_id: null },
      ],
      devices: [{
        device_id: 'KIOSK_02', device_name: 'Employee Phone', assigned_employee_id: current,
        employee_name: 'Current Employee', employee_code: 'EMP201', assignment_epoch: 8,
        pending_work_status: 'current', pending_work_count: 3,
        pending_work_oldest_at: '2026-08-13T12:00:00.000Z', pending_work_reported_at: new Date().toISOString(),
        offline_authority_employee_id: prior, offline_authority_assignment_epoch: 7,
        offline_authority_expires_at: '2099-08-14T12:00:00.000Z',
      }],
    };
    window.MemphisMobile = { requestEnvelope: async () => data };
  }, { current: currentEmployee, next: nextEmployee, prior: priorEmployee });

  await page.goto('/phone-assignments.html');
  await expect(page.locator('#phone-list .phoneRow')).toHaveCount(1);
  await expect(page.locator('.phoneOperationalWarning')).toContainText('3 pending phone items');
  await expect(page.locator('.phoneOperationalWarning')).toContainText('Prior Employee at assignment 7');
  await page.locator('[data-employee]').selectOption(nextEmployee);

  let confirmation = '';
  page.once('dialog', async (dialog) => {
    confirmation = dialog.message();
    await dialog.dismiss();
  });
  await page.locator('[data-save]').click();
  await expect.poll(() => confirmation).toContain('3 pending phone items');
  expect(confirmation).toContain('Prior Employee at assignment 7');
  expect(confirmation).toContain('remains attributed to its original employee');
});
