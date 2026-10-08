import { expect, test } from '@playwright/test';
import { PASSWORD, signInDialog } from './support';

// A session that ends during work (#1162): here the account is made
// inactive while the agent's page is open, which the API refuses from then
// on (401), as it does once a session's hours run out. The agent is new on
// every run, on Team Delta, which no other spec works in, so nobody else's
// tickets or sessions are touched.

test('an agent whose account is closed mid-shift is asked to sign in again, and told why', async ({
  browser,
  // The admin's cookies, apart from the agent's page.
  request,
}) => {
  const suffix = Date.now().toString(36);
  const userId = `e2e.quinn.${suffix}`;
  const password = 'starting-password-1';

  await test.step('an admin opens an account for a new agent', async () => {
    const admin = await request.post('/api/auth/sign-in', {
      data: { userId: 'alex.morgan', password: PASSWORD },
    });
    expect(admin.ok(), 'signing in as the admin').toBe(true);
    const created = await request.post('/api/users', {
      data: {
        userId,
        name: `Quinn Test ${suffix}`,
        role: 'agent',
        teamId: 'delta',
        password,
      },
    });
    expect(created.ok(), `creating ${userId}`).toBe(true);
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await test.step('the agent is at work', async () => {
    const signedIn = await page.request.post('/api/auth/sign-in', {
      data: { userId, password },
    });
    expect(signedIn.ok(), `signing in as ${userId}`).toBe(true);
    await page.goto('/agent');
    await expect(
      page.getByRole('button', { name: /^Take it / }).first()
    ).toBeVisible();
  });

  await test.step('the admin makes the account inactive', async () => {
    const changed = await request.put(`/api/users/${userId}`, {
      data: { role: 'agent', teamId: 'delta', active: false },
    });
    expect(changed.ok(), `making ${userId} inactive`).toBe(true);
  });

  await test.step('the next action takes the agent to sign in, saying why', async () => {
    await page
      .getByRole('button', { name: /^Take it / })
      .first()
      .click();

    const popup = signInDialog(page);
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('status')).toHaveText(
      'Your session has ended. Please sign in again.'
    );
    await expect(page).toHaveURL('/');
  });

  await context.close();
});
