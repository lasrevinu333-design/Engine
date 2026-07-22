import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, oldText, newText) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`${path}: expected source block not found`);
  await writeFile(path, source.replace(oldText, newText));
}

await replaceExact('thread.html', `'Shared by all Ops Managers'`, `'Shared by Operations Leadership'`);

const spec = 'tests/ops-manager-shared-messenger.spec.js';
await replaceExact(spec,
`    display_name: 'Ops Manager',
    role: 'manager',
    identity_source: 'trusted_manager_session',`,
`    display_name: 'Eric Operle',
    role: 'manager',
    role_title: 'Custodial Manager',
    job_title: 'Custodial Manager',
    identity_source: 'trusted_manager_session',`);
await replaceExact(spec, `    thread_title: 'Ops Manager Chat',`, `    thread_title: 'Operations Leadership Chat',`);
await replaceExact(spec, `    participant_names: 'Ops Manager, Custodial Manager',`, `    participant_names: 'Eric Operle, Jennifer Sheffield, Annie Feist',`);
await replaceExact(spec, `    sender_display_name: 'Custodial Manager',`, `    sender_display_name: 'Eric Operle',`);
await replaceExact(spec,
`        { id: MANAGER_USER_ID, display_name: 'Ops Manager', role: 'manager', is_active: true },
        { id: RECIPIENT_IDS[0], display_name: 'Employee One', role: 'employee', is_active: true },
        { id: RECIPIENT_IDS[1], display_name: 'Employee Two', role: 'employee', is_active: true },
        { id: RECIPIENT_IDS[2], display_name: 'Employee Three', role: 'employee', is_active: true },`,
`        { id: MANAGER_USER_ID, display_name: 'Eric Operle', role: 'manager', role_title: 'Custodial Manager', job_title: 'Custodial Manager', is_active: true },
        { id: RECIPIENT_IDS[0], display_name: 'Employee One', role: 'employee', role_title: 'Employee', is_active: true },
        { id: RECIPIENT_IDS[1], display_name: 'Employee Two', role: 'employee', role_title: 'Employee', is_active: true },
        { id: RECIPIENT_IDS[2], display_name: 'Jennifer Sheffield', role: 'manager', role_title: 'Director of Operations', job_title: 'Director of Operations', is_active: true },`);
await replaceExact(spec, `    await expect(page.getByText('Ops Manager Chat', { exact: true })).toBeVisible();`, `    await expect(page.getByText('Operations Leadership Chat', { exact: true })).toBeVisible();`);
await replaceExact(spec, `    await expect(page.getByText('All Ops Managers')).toBeVisible();`, `    await expect(page.getByText('Operations Leadership', { exact: true })).toBeVisible();`);
await replaceExact(spec, `    await expect(page.getByText('Ops Manager · shared Ops Manager chat')).toBeVisible();`, `    await expect(page.getByText('Eric Operle · Custodial Manager', { exact: true })).toBeVisible();`);
await replaceExact(spec, `    await page.getByText('Ops Manager Chat', { exact: true }).click();`, `    await page.getByText('Operations Leadership Chat', { exact: true }).click();`);
await replaceExact(spec, `    await expect(page.getByText('Shared by all Ops Managers')).toBeVisible();`, `    await expect(page.getByText('Shared by Operations Leadership')).toBeVisible();`);
await replaceExact(spec, `    await page.getByRole('button', { name: 'Delete message from Custodial Manager' }).click();`, `    await page.getByRole('button', { name: 'Delete message from Eric Operle' }).click();`);
await replaceExact(spec,
`      { id: RECIPIENT_IDS[2], display_name: 'Ops Manager', role: 'manager', is_active: true },`,
`      { id: RECIPIENT_IDS[2], display_name: 'Jennifer Sheffield', role: 'manager', role_title: 'Director of Operations', job_title: 'Director of Operations', is_active: true },`);
await replaceExact(spec,
`    await expect(page.getByText('Select Everyone', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)).toBe(false);`,
`    await expect(page.getByText('Select Everyone', { exact: true })).toBeVisible();
    await expect(page.getByText('Jennifer Sheffield', { exact: true })).toBeVisible();
    await expect(page.getByText('Director of Operations', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)).toBe(false);`);

const contract = 'scripts/messenger-leadership-title-contract-tests.mjs';
await replaceExact(contract,
`assert.doesNotMatch(thread, /shared Ops Manager contact/);`,
`assert.doesNotMatch(thread, /shared Ops Manager contact/);
assert.match(thread, /Shared by Operations Leadership/);
assert.doesNotMatch(thread, /Shared by all Ops Managers/);`);

console.log('Prepared browser acceptance updates for named leadership titles.');
