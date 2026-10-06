import type { TeamOverview } from '@helpdesk/contract';
import { expect, type Page, test } from '@playwright/test';
import { rowOf, signInAs, snackBar } from './support';

// A supervisor's day (#986): give work out, move it when needed, look
// back at an agent's history. Omar Haddad leads Team Comet, so the spec
// leaves Team Atlas (Chris, Sam) to the live-update specs and Team Beacon
// to the agent spec. His agents are asked of the API: the seed generates
// their names.

/** `text` as a regular expression that matches it as it is. */
const literally = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Shows `name`'s tickets, picked in the Team member list. */
async function pickMember(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'Team member' }).click();
  await page
    .getByRole('option', { name: new RegExp(`^${literally(name)} \\(`) })
    .click();
}

/** Gives the ticket to `name` in the Assign popup. */
async function assignTo(page: Page, ticketNumber: string, name: string) {
  const popup = page.getByRole('dialog', { name: `Assign ${ticketNumber}` });
  await popup
    .getByRole('radio', { name: new RegExp(`^${literally(name)} `) })
    .check();
  await popup.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(popup).toBeHidden();
}

test('a supervisor assigns a ticket, reassigns it and checks the history', async ({
  page,
}) => {
  await signInAs(page, 'omar.haddad', 'supervisor');
  const team = (await (
    await page.request.get('/api/teams/mine')
  ).json()) as TeamOverview;
  const [first, second] = team.members;
  const unassigned = page.locator('hd-ticket-table.unassigned');
  const memberTickets = page.locator('hd-ticket-table.member');
  const ticketNumber = (
    await unassigned.locator('td.mat-column-ticketNumber').first().innerText()
  ).trim();

  await test.step(`assigns ${ticketNumber} to ${first.name}`, async () => {
    await unassigned
      .getByRole('button', { name: `Assign ${ticketNumber}`, exact: true })
      .click();
    await assignTo(page, ticketNumber, first.name);

    await expect(
      snackBar(page, `${ticketNumber} assigned to ${first.name}`)
    ).toBeVisible();
    await expect(rowOf(unassigned, ticketNumber)).toHaveCount(0);
    await pickMember(page, first.name);
    await expect(rowOf(memberTickets, ticketNumber)).toBeVisible();
  });

  await test.step(`reassigns it to ${second.name}`, async () => {
    await memberTickets
      .getByRole('button', { name: `Reassign ${ticketNumber}`, exact: true })
      .click();
    await assignTo(page, ticketNumber, second.name);

    await expect(
      snackBar(page, `${ticketNumber} assigned to ${second.name}`)
    ).toBeVisible();
    await expect(rowOf(memberTickets, ticketNumber)).toHaveCount(0);
    await pickMember(page, second.name);
    await expect(rowOf(memberTickets, ticketNumber)).toBeVisible();
  });

  await test.step(`finds it in ${second.name}'s history`, async () => {
    await page
      .getByRole('button', { name: `${second.name}, view 3-month history` })
      .click();
    const history = page.getByRole('dialog', { name: second.name });

    await expect(rowOf(history, ticketNumber)).toBeVisible();
  });
});
