import type { Role } from '@helpdesk/contract';
import { expect, type Locator, type Page } from '@playwright/test';

// What the specs share: the seed's password, and two ways in. `signIn`
// goes through the sign-in popup, as a person does, for the specs about
// signing in. `signInAs` asks the API directly, as the popup does, then
// opens the person's page: quicker, for specs about what comes after.

/** The seed's password for everyone (.env can change it, as for Compose). */
export const PASSWORD =
  process.env['HELPDESK_SEED_PASSWORD'] ?? 'helpdesk-dev-only';

/** Each role's own page. */
export const HOME_PAGES: Record<Role, string> = {
  agent: '/agent',
  supervisor: '/supervisor',
  admin: '/admin',
};

/** The row for ticket `ticketNumber` (like "#1962") in a ticket table. */
export const rowOf = (table: Locator, ticketNumber: string) =>
  table.locator('tr', {
    has: table.page().locator('td.mat-column-ticketNumber', {
      hasText: ticketNumber,
    }),
  });

/**
 * The snack bar saying `message`. By its text: for a moment the last one
 * is still leaving as the next arrives.
 */
export const snackBar = (page: Page, message: string) =>
  page.locator('mat-snack-bar-container', { hasText: message });

/** The sign-in popup. */
export const signInDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Sign in to Helpdesk' });

/**
 * Opens the sign-in popup from the toolbar and signs in as `userId`.
 * Answers with the popup, which closes once signed in.
 */
export async function signIn(page: Page, userId: string, password = PASSWORD) {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Page' })
    .getByRole('button', { name: 'Sign in' })
    .click();
  const dialog = signInDialog(page);
  await dialog.getByRole('textbox', { name: 'User ID' }).fill(userId);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  return dialog;
}

/**
 * Signs in as `userId` through the API (the page's own cookies, so the
 * page is signed in too), then opens their role's page.
 */
export async function signInAs(page: Page, userId: string, role: Role) {
  const response = await page.request.post('/api/auth/sign-in', {
    data: { userId, password: PASSWORD },
  });
  expect(response.ok(), `signing in as ${userId}`).toBe(true);
  await page.goto(HOME_PAGES[role]);
  await expect(page).toHaveURL(HOME_PAGES[role]);
}
