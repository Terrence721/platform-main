import type { TeamOverview, TicketDto } from '@helpdesk/contract';
import {
  type Browser,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';
import { HOME_PAGES, PASSWORD, rowOf, snackBar } from './support';

// Live updates (#950, #941, #982), in two browsers at once: Chris (the
// supervisor) changes things in his, and Sam's (the agent's) shows them
// without a reload. Team Atlas is theirs; the other specs keep off it.
// Chris assigns and writes through his page; resolving and reassigning go
// through his API session, as the journeys cover those screens.

/** The tones Sam's page has played, in hertz (recorded by `recordTones`). */
declare global {
  interface Window {
    playedTones: number[];
  }
}

/** The arrival tone (app/sound/sounds.ts). */
const ARRIVAL_HZ = 988;

/**
 * Records every tone the page plays: the app makes its sounds with the Web
 * Audio API, so each oscillator's frequency is noted as it is set.
 */
function recordTones() {
  window.playedTones = [];
  const create = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () {
    const oscillator = create.call(this);
    const setAt = oscillator.frequency.setValueAtTime.bind(
      oscillator.frequency
    );
    oscillator.frequency.setValueAtTime = (value, at) => {
      window.playedTones.push(Math.round(value));
      return setAt(value, at);
    };
    return oscillator;
  };
}

/** The tones `page` has played so far. */
const tonesOf = (page: Page) => page.evaluate(() => window.playedTones);

/**
 * A browser of its own (its own cookies) for `userId`, signed in through
 * the API and on their role's page, its first table loaded.
 */
async function openAs(
  browser: Browser,
  userId: string,
  role: 'agent' | 'supervisor'
) {
  const context = await browser.newContext();
  await context.addInitScript(recordTones);
  const signedIn = await context.request.post('/api/auth/sign-in', {
    data: { userId, password: PASSWORD },
  });
  expect(signedIn.ok(), `signing in as ${userId}`).toBe(true);
  const page = await context.newPage();
  await page.goto(HOME_PAGES[role]);
  await expect(
    page.locator('td.mat-column-ticketNumber').first()
  ).toBeVisible();
  return page;
}

/** A detail (Status, Assigned to, ...) in a ticket popup. */
const detail = (popup: Locator, term: string) =>
  popup
    .locator('.details > div')
    .filter({ has: popup.page().getByText(term, { exact: true }) })
    .locator('dd');

/** Opens ticket `ticketNumber`'s popup from a table. */
async function openTicket(table: Locator, ticketNumber: string) {
  await rowOf(table, ticketNumber)
    .getByRole('button', { name: new RegExp(`^Open ${ticketNumber},`) })
    .click();
  const popup = table.page().getByRole('dialog');
  await expect(popup.locator('.conversation li').first()).toBeVisible();
  return popup;
}

/** Sam's open tickets that can still be resolved (open or pending). */
async function samsOpenWork(sam: Page) {
  const tickets = (await (
    await sam.request.get('/api/tickets/mine')
  ).json()) as TicketDto[];
  return tickets.filter(({ status }) => ['open', 'pending'].includes(status));
}

test.describe('live updates, in two browsers', () => {
  let chris: Page;
  let sam: Page;

  test.beforeEach(async ({ browser }) => {
    chris = await openAs(browser, 'chris.taylor', 'supervisor');
    sam = await openAs(browser, 'sam.rivera', 'agent');
  });

  test.afterEach(async () => {
    await chris.context().close();
    await sam.context().close();
  });

  test('a ticket Chris assigns reaches Sam at once, with the arrival tone', async () => {
    const unassigned = chris.locator('hd-ticket-table.unassigned');
    const ticketNumber = (
      await unassigned.locator('td.mat-column-ticketNumber').first().innerText()
    ).trim();

    await unassigned
      .getByRole('button', { name: `Assign ${ticketNumber}`, exact: true })
      .click();
    const popup = chris.getByRole('dialog', {
      name: `Assign ${ticketNumber}`,
    });
    await popup.getByRole('radio', { name: /^Sam Rivera / }).check();
    await popup.getByRole('button', { name: 'Assign', exact: true }).click();
    await expect(
      snackBar(chris, `${ticketNumber} assigned to Sam Rivera`)
    ).toBeVisible();

    await expect(
      rowOf(sam.locator('hd-ticket-table.mine'), ticketNumber)
    ).toBeVisible();
    await expect.poll(() => tonesOf(sam)).toContain(ARRIVAL_HZ);
  });

  test("Chris's note reaches Sam's open popup, with the arrival tone", async () => {
    const [ticket] = await samsOpenWork(sam);
    const ticketNumber = `#${ticket.ticketNumber}`;
    const samsPopup = await openTicket(
      sam.locator('hd-ticket-table.mine'),
      ticketNumber
    );

    await chris.getByRole('combobox', { name: 'Team member' }).click();
    await chris.getByRole('option', { name: /^Sam Rivera \(/ }).click();
    const chrisPopup = await openTicket(
      chris.locator('hd-ticket-table.member'),
      ticketNumber
    );
    const note = `Please call them back today (${Date.now()}).`;
    await chrisPopup.getByRole('textbox', { name: 'Message' }).fill(note);
    await chrisPopup
      .getByRole('button', { name: 'Internal note', exact: true })
      .click();

    await expect(samsPopup.getByText(note)).toBeVisible();
    await expect.poll(() => tonesOf(sam)).toContain(ARRIVAL_HZ);
  });

  test("Sam's open popup follows the ticket: resolved, then given away", async () => {
    const [first, second] = await samsOpenWork(sam);
    const mine = sam.locator('hd-ticket-table.mine');

    await test.step('Chris resolves it: the popup says Resolved', async () => {
      const popup = await openTicket(mine, `#${first.ticketNumber}`);
      const resolved = await chris.request.put(
        `/api/tickets/${first.id}/status`,
        { data: { status: 'resolved' } }
      );
      expect(resolved.ok()).toBe(true);

      await expect(detail(popup, 'Status')).toHaveText('Resolved');
      await expect(detail(popup, 'Due')).toHaveText('Finished');
      // Resolved can still be reopened, so the box stays.
      await expect(
        popup.getByRole('textbox', { name: 'Message' })
      ).toBeVisible();
      await sam.keyboard.press('Escape');
      await expect(popup).toBeHidden();
    });

    await test.step("Chris gives it to another agent: no longer Sam's", async () => {
      const team = (await (
        await chris.request.get('/api/teams/mine')
      ).json()) as TeamOverview;
      const other = team.members.find(({ id }) => id !== 'sam.rivera');
      const popup = await openTicket(mine, `#${second.ticketNumber}`);
      const given = await chris.request.put(
        `/api/tickets/${second.id}/assignee`,
        { data: { assigneeId: other?.id } }
      );
      expect(given.ok()).toBe(true);

      await expect(
        popup.getByText('This ticket is no longer assigned to you.')
      ).toBeVisible();
      await expect(detail(popup, 'Assigned to')).toHaveText('Someone else');
      await expect(
        popup.getByRole('textbox', { name: 'Message' })
      ).toBeHidden();
    });
  });
});
