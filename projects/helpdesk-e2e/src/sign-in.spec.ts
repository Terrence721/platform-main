import { SIGN_IN_FAILED_MESSAGE } from '@helpdesk/contract';
import { expect, test } from '@playwright/test';
import { signIn, signInDialog } from './support';

test.describe('signing in', () => {
  for (const { userId, who, path, title } of [
    {
      userId: 'sam.rivera',
      who: 'Sam Rivera · agent',
      path: '/agent',
      title: 'My tickets · Helpdesk',
    },
    {
      userId: 'chris.taylor',
      who: 'Chris Taylor · supervisor',
      path: '/supervisor',
      title: 'My team · Helpdesk',
    },
    {
      userId: 'alex.morgan',
      who: 'Alex Morgan · admin',
      path: '/admin',
      title: 'Team accounts · Helpdesk',
    },
  ]) {
    test(`takes ${userId} to their own page`, async ({ page }) => {
      const dialog = await signIn(page, userId);

      await expect(dialog).toBeHidden();
      await expect(page).toHaveURL(path);
      await expect(page).toHaveTitle(title);
      await expect(page.locator('mat-toolbar')).toContainText(who);
    });
  }

  test('refuses a wrong password, and stays signed out', async ({ page }) => {
    const dialog = await signIn(page, 'sam.rivera', 'not-the-password');

    await expect(dialog.getByRole('alert')).toHaveText(SIGN_IN_FAILED_MESSAGE);
    await expect(page).toHaveURL('/');
    await page.goto('/agent');
    // Signed out, a role's page sends you to sign in instead.
    await expect(signInDialog(page)).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('signs out to the landing page, which then asks to sign in again', async ({
    page,
  }) => {
    await signIn(page, 'sam.rivera');
    await expect(page).toHaveURL('/agent');

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page).toHaveURL('/');
    await expect(
      page
        .getByRole('navigation', { name: 'Page' })
        .getByRole('button', { name: 'Sign in' })
    ).toBeVisible();
    await page.goto('/agent');
    await expect(signInDialog(page)).toBeVisible();
  });
});
