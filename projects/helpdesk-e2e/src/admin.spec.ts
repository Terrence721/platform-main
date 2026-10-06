import { expect, test } from '@playwright/test';
import { signInAs, snackBar } from './support';

// An admin's day (#986): open an account for a new agent, then close it
// again. Team Delta (Lena Fischer's) takes the new agent, as no other spec
// uses it. The user ID is new on every run, so the spec also passes
// against a stack that keeps its data (E2E_BASE_URL).

test('an admin creates an account, then makes it inactive', async ({
  page,
  // Its own cookies: signing in with it leaves the admin's page alone.
  request,
}) => {
  const suffix = Date.now().toString(36);
  const userId = `e2e.robin.${suffix}`;
  const name = `Robin Test ${suffix}`;
  const password = 'starting-password-1';
  await signInAs(page, 'alex.morgan', 'admin');
  const delta = page.getByRole('region', { name: 'Team Delta' });
  const row = delta.getByRole('row', { name: new RegExp(userId) });

  await test.step(`creates ${userId} on Team Delta`, async () => {
    // The one at the top; the page repeats it below the tables.
    await page.getByRole('button', { name: 'Create Account' }).first().click();
    const popup = page.getByRole('dialog', { name: 'Create account' });
    await popup.getByRole('textbox', { name: 'User ID' }).fill(userId);
    await popup.getByRole('textbox', { name: 'Name' }).fill(name);
    // An agent is the default role.
    await popup.getByRole('combobox', { name: 'Team' }).click();
    await page.getByRole('option', { name: 'Team Delta' }).click();
    await popup.getByLabel('Starting password', { exact: true }).fill(password);

    await popup.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(popup).toBeHidden();
    await expect(snackBar(page, `Account ${userId} created`)).toBeVisible();
    await expect(row).toContainText(name);
    await expect(row.locator('td.mat-column-role')).toHaveText('agent');
    await expect(row.locator('td.mat-column-status')).toHaveText('Active');
  });

  await test.step('the new agent can sign in', async () => {
    const response = await request.post('/api/auth/sign-in', {
      data: { userId, password },
    });
    expect(response.ok()).toBe(true);
  });

  await test.step('makes the account inactive', async () => {
    await delta.getByRole('button', { name: `Edit ${name}` }).click();
    const popup = page.getByRole('dialog', { name: `Edit ${name}` });
    await popup.getByRole('switch', { name: 'Active: can sign in' }).click();
    await expect(
      popup.getByRole('switch', { name: "Inactive: can't sign in" })
    ).toBeVisible();

    await popup.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(popup).toBeHidden();
    await expect(snackBar(page, `Saved ${name}.`)).toBeVisible();
    await expect(row.locator('td.mat-column-status')).toHaveText('Inactive');
  });

  await test.step('the inactive account can no longer sign in', async () => {
    const response = await request.post('/api/auth/sign-in', {
      data: { userId, password },
    });
    expect(response.status()).toBe(401);
  });
});
