import type { UpdateAccountRequest, UserAccount } from '@helpdesk/contract';
import { expect, test } from '@playwright/test';
import { signInAs } from './support';

// A team emptied of its accounts stays a team (#1210): Team accounts still
// lists it, and Create Account can put someone in it again.
//
// Emptying a team hands its people's open tickets back to Unassigned, which
// the agent and supervisor journeys pick from, so this file runs after
// them (Playwright runs the files one at a time, by name). Delta's people
// leave it as admins, who are on no team, so no other team gains anyone or
// changes lead; and they come back after, its lead first, as the restart
// spec has Lena Fischer lead Delta.
test('an admin empties a team, which stays listed and can be joined again', async ({
  page,
}) => {
  await signInAs(page, 'alex.morgan', 'admin');
  /** Changes an account as Edit account does, with the page's cookies. */
  const change = async (id: string, request: UpdateAccountRequest) => {
    const response = await page.request.put(`/api/users/${id}`, {
      data: request,
    });
    expect(response.ok(), `changing ${id}`).toBe(true);
  };
  const accounts = (await (
    await page.request.get('/api/users')
  ).json()) as UserAccount[];
  // The lead first, so they lead Delta again when everyone comes back.
  const onDelta = accounts
    .filter(({ team }) => team?.id === 'delta')
    .sort((a, b) => Number(b.leadsTeam) - Number(a.leadsTeam));
  expect(onDelta.length).toBeGreaterThan(0);
  const delta = page.getByRole('region', { name: 'Team Delta' });

  try {
    await test.step('takes everyone off Team Delta', async () => {
      for (const { id, active } of onDelta) {
        await change(id, { role: 'admin', teamId: null, active });
      }
    });

    await test.step('Team Delta is still listed, with no accounts and no lead', async () => {
      await page.reload();

      await expect(delta.getByRole('heading')).toHaveText(
        /Team Delta\s*· 0 accounts\s*· No lead/
      );
      await expect(delta).toContainText('No accounts yet.');
      await expect(delta.getByRole('table')).toHaveCount(0);
    });

    await test.step('Create Account puts someone on Team Delta again', async () => {
      const suffix = Date.now().toString(36);
      const userId = `e2e.rejoin.${suffix}`;
      await page
        .getByRole('button', { name: 'Create Account' })
        .first()
        .click();
      const popup = page.getByRole('dialog', { name: 'Create account' });
      await popup.getByRole('textbox', { name: 'User ID' }).fill(userId);
      await popup
        .getByRole('textbox', { name: 'Name' })
        .fill(`Rejoin Test ${suffix}`);
      await popup.getByRole('combobox', { name: 'Team' }).click();
      await page.getByRole('option', { name: 'Team Delta' }).click();
      await popup
        .getByLabel('Starting password', { exact: true })
        .fill('starting-password-1');

      await popup.getByRole('button', { name: 'Create', exact: true }).click();

      await expect(popup).toBeHidden();
      await expect(
        delta.getByRole('row', { name: new RegExp(userId) })
      ).toBeVisible();
      await expect(delta).not.toContainText('No accounts yet.');
    });
  } finally {
    // Everyone back as they were, for any spec after this one.
    for (const { id, role, active } of onDelta) {
      await change(id, { role, teamId: 'delta', active });
    }
  }
});
