import type { TeamOverview } from '@helpdesk/contract';
import { type Browser, expect, type Page, test } from '@playwright/test';
import { PASSWORD, rowOf, signInAs, snackBar } from './support';

// Customer requests (#1026): a visitor reports a problem with no account,
// a supervisor decides it, and the visitor checks on it by reference and
// email. The supervisor is Omar Haddad and the agent one of his (Team
// Comet), whom no other spec uses; unassigned work is anyone's to take.

const SUPERVISOR = 'omar.haddad';

/** What a visitor reports. */
interface Problem {
  email: string;
  subject: string;
}

/**
 * Sends a request at /report as a visitor, and returns its reference. The
 * clock jumps past the few seconds a person takes to fill the form in,
 * so the request isn't taken for spam.
 */
async function report(page: Page, { email, subject }: Problem) {
  await page.clock.install();
  await page.goto('/report');
  await page.getByLabel('Your name').fill('Robin Ellis');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByRole('combobox', { name: 'What is it about?' }).click();
  await page.getByRole('option', { name: 'Billing' }).click();
  await page.getByRole('radio', { name: "I'm blocked" }).check();
  await page.getByLabel('Subject').fill(subject);
  await page
    .getByLabel('Describe the problem')
    .fill('My card was charged twice for this month.');
  await page.getByRole('checkbox').check();
  await page.clock.fastForward('00:05');
  await page.getByRole('button', { name: 'Send request' }).click();

  const sent = page.locator('.sent h2');
  await expect(sent).toHaveText(/Your reference is R-\d+\.$/);
  return /R-\d+/.exec(await sent.innerText())?.[0] ?? '';
}

/** What Check my request answers for a reference and email. */
async function checkOn(page: Page, reference: string, email: string) {
  await page.goto(`/report/status?reference=${reference}`);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByRole('button', { name: 'Check' }).click();
  return page.locator('.answer');
}

/** A page signed in as someone, in their own browser context. */
async function signedIn(
  browser: Browser,
  userId: string,
  role: 'supervisor' | 'agent'
) {
  const page = await (await browser.newContext()).newPage();
  await signInAs(page, userId, role);
  return page;
}

test('a visitor reports a problem, a supervisor makes it a ticket, an agent takes it', async ({
  page,
  browser,
  request,
}) => {
  const email = 'robin.ellis@example.com';
  const subject = 'Charged twice this month';
  const reference = await report(page, { email, subject });

  await test.step(`${reference} waits for the team`, async () => {
    await expect(await checkOn(page, reference, email)).toHaveText(
      `${reference} is waiting for our team.`
    );
  });

  let ticketNumber = '';

  await test.step('a supervisor turns it into a ticket', async () => {
    const supervisor = await signedIn(browser, SUPERVISOR, 'supervisor');
    const card = supervisor.getByRole('article', { name: reference });
    await expect(card.getByRole('heading', { name: subject })).toBeVisible();

    await card.getByRole('button', { name: 'Turn into ticket' }).click();
    const popup = supervisor.getByRole('dialog');
    await expect(popup.getByRole('combobox', { name: 'Queue' })).toHaveText(
      'Billing'
    );
    await expect(popup.getByRole('combobox', { name: 'Priority' })).toHaveText(
      'High'
    );
    await popup.getByRole('button', { name: 'Create ticket' }).click();

    const said = snackBar(supervisor, `${reference} is now ticket #`);
    await expect(said).toHaveText(/#\d+, in Unassigned\./);
    ticketNumber = /#\d+/.exec(await said.innerText())?.[0] ?? '';
    await expect(card).toHaveCount(0);
    await supervisor.context().close();
  });

  await test.step(`the visitor sees ${ticketNumber || 'the ticket'}`, async () => {
    await expect(await checkOn(page, reference, email)).toHaveText(
      `${reference} is now ticket ${ticketNumber}, which is New.`
    );
  });

  await test.step('an agent takes it', async () => {
    // One of Omar's agents, asked of the API.
    await request.post('/api/auth/sign-in', {
      data: { userId: SUPERVISOR, password: PASSWORD },
    });
    const team = (await (
      await request.get('/api/teams/mine')
    ).json()) as TeamOverview;
    const agent = await signedIn(browser, team.members[0].id, 'agent');
    const unassigned = agent.locator('hd-ticket-table.unassigned');
    await expect(
      rowOf(unassigned, ticketNumber).getByText(subject)
    ).toBeVisible();

    await agent
      .getByRole('button', { name: `Take it ${ticketNumber}`, exact: true })
      .click();

    await expect(snackBar(agent, `${ticketNumber} is yours`)).toBeVisible();
    await expect(
      rowOf(agent.locator('hd-ticket-table.mine'), ticketNumber)
    ).toBeVisible();
    await agent.context().close();
  });

  await test.step('the visitor sees it is being worked on', async () => {
    await expect(await checkOn(page, reference, email)).toHaveText(
      `${reference} is now ticket ${ticketNumber}, which is Open.`
    );
  });
});

test('a supervisor dismisses a request, and the visitor is told why', async ({
  page,
  browser,
}) => {
  const email = 'kai.morgan@example.com';
  const reference = await report(page, {
    email,
    subject: 'Cheap watches, click here',
  });

  const supervisor = await signedIn(browser, SUPERVISOR, 'supervisor');
  const card = supervisor.getByRole('article', { name: reference });
  await card.getByRole('button', { name: 'Dismiss' }).click();
  const popup = supervisor.getByRole('dialog');
  await popup.getByRole('radio', { name: 'Spam' }).check();
  await popup.getByRole('button', { name: 'Dismiss request' }).click();

  await expect(snackBar(supervisor, `${reference} dismissed.`)).toBeVisible();
  await expect(card).toHaveCount(0);
  await supervisor.context().close();
  await expect(await checkOn(page, reference, email)).toHaveText(
    `${reference} was closed: Spam.`
  );
});
