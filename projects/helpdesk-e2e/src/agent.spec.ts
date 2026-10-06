import type { TeamOverview } from '@helpdesk/contract';
import { expect, test } from '@playwright/test';
import { PASSWORD, rowOf, signInAs, snackBar } from './support';

// An agent's day (#986): take a ticket, move it on, answer the customer.
// The agent is the first on Nina Patel's team (Beacon), asked of the API,
// so the spec leaves Team Atlas (Chris, Sam) to the live-update specs and
// doesn't depend on the seed's generated names.

test('an agent takes a ticket, moves it to Pending and replies', async ({
  page,
  request,
}) => {
  const signedIn = await request.post('/api/auth/sign-in', {
    data: { userId: 'nina.patel', password: PASSWORD },
  });
  expect(signedIn.ok()).toBe(true);
  const team = (await (
    await request.get('/api/teams/mine')
  ).json()) as TeamOverview;
  const [agent] = team.members;

  await signInAs(page, agent.id, 'agent');
  const mine = page.locator('hd-ticket-table.mine');
  const unassigned = page.locator('hd-ticket-table.unassigned');
  const ticketNumber = (
    await unassigned.locator('td.mat-column-ticketNumber').first().innerText()
  ).trim();

  await test.step(`takes ${ticketNumber}`, async () => {
    await page
      .getByRole('button', { name: `Take it ${ticketNumber}`, exact: true })
      .click();

    await expect(snackBar(page, `${ticketNumber} is yours`)).toBeVisible();
    await expect(rowOf(mine, ticketNumber)).toBeVisible();
    await expect(rowOf(unassigned, ticketNumber)).toHaveCount(0);
  });

  await test.step('moves it to Pending', async () => {
    await page
      .getByRole('button', { name: `Change status of ${ticketNumber}` })
      .click();
    await page.getByRole('menuitem', { name: 'Pending' }).click();

    await expect(
      snackBar(page, `${ticketNumber} is now Pending`)
    ).toBeVisible();
    await expect(
      rowOf(mine, ticketNumber).locator('td.mat-column-status')
    ).toContainText('Pending');
  });

  await test.step('replies to the customer', async () => {
    const body = `Thanks for waiting. Looking into ${ticketNumber} now.`;
    await rowOf(mine, ticketNumber)
      .getByRole('button', { name: new RegExp(`^Open ${ticketNumber},`) })
      .click();
    const popup = page.getByRole('dialog');
    await popup.getByRole('textbox', { name: 'Message' }).fill(body);

    await popup.getByRole('button', { name: 'Reply', exact: true }).click();

    const last = popup.locator('.conversation li').last();
    await expect(last.locator('.body')).toHaveText(body);
    await expect(last.locator('.meta')).toContainText(
      `${agent.name} · Reply to`
    );
    await expect(popup.getByRole('textbox', { name: 'Message' })).toHaveValue(
      ''
    );
  });
});
