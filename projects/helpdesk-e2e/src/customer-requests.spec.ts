import type { TeamOverview } from '@helpdesk/contract';
import {
  type Browser,
  type Download,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';
import sharp from 'sharp';
import { PASSWORD, rowOf, signInAs, snackBar } from './support';

// Customer requests (#1026): a visitor reports a problem with no account,
// a supervisor decides it, and the visitor checks on it by reference and
// email. The supervisor is Omar Haddad and the agent one of his (Team
// Comet), whom no other spec uses; unassigned work is anyone's to take.

const SUPERVISOR = 'omar.haddad';

/** A file to attach, as Playwright's setInputFiles takes it. */
interface FilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** What a visitor reports, and any files they attach. */
interface Problem {
  email: string;
  subject: string;
  files?: FilePayload[];
}

/**
 * Sends a request at /report as a visitor, and returns its reference. The
 * clock jumps past the few seconds a person takes to fill the form in,
 * so the request isn't taken for spam.
 */
async function report(page: Page, { email, subject, files }: Problem) {
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
  if (files) {
    // The picker's own file input, as the browser's file chooser fills it.
    await page
      .locator('hd-attachment-picker input[type=file]')
      .setInputFiles(files);
  }
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

/**
 * A phone photo, as a customer sends one: stored sideways (64 x 32, its
 * orientation tag saying to turn it), with the owner's name hidden in it.
 */
const phonePhoto = async (): Promise<FilePayload> => ({
  name: 'phone photo.jpg',
  mimeType: 'image/jpeg',
  buffer: await sharp({
    create: { width: 64, height: 32, channels: 3, background: '#d93025' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    // cspell:ignore Exif
    .withExif({ IFD0: { Artist: 'Dana Whitfield', Make: 'PhoneMaker' } })
    .toBuffer(),
});

/**
 * Downloads a file with `button`, and checks it is the photo as sharp
 * redrew it on the way in: a JPEG, upright, its hidden data gone.
 */
async function downloadsRedrawnPhoto(page: Page, button: Locator) {
  const [download]: [Download, void] = await Promise.all([
    page.waitForEvent('download'),
    button.click(),
  ]);
  expect(download.suggestedFilename()).toBe('phone photo.jpg');
  // Read as a stream: path() refuses when the browser is connected to, as
  // the VS Code extension does with Show browser on.
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) {
    chunks.push(chunk as Buffer);
  }
  const bytes = Buffer.concat(chunks);
  const { format, width, height } = await sharp(bytes).metadata();
  expect({ format, width, height }).toEqual({
    format: 'jpeg',
    width: 32,
    height: 64,
  });
  expect(bytes.includes('Dana Whitfield')).toBe(false);
  expect(bytes.includes('PhoneMaker')).toBe(false);
}

/** Whether an image has been drawn: loaded, with a size. */
const drawn = (image: Locator) =>
  image.evaluate(
    (element: HTMLImageElement) => element.complete && element.naturalWidth > 0
  );

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

// Uploads (#1026, B8): a phone photo from the report page reaches the
// supervisor and the agent as sharp redrew it.
test('a visitor reports with a photo, which the supervisor and the agent see and download, redrawn', async ({
  page,
  browser,
  request,
}) => {
  const subject = 'Export stops at 1,000 rows (photo)';
  const reference = await report(page, {
    email: 'mei.photo@example.com',
    subject,
    files: [await phonePhoto()],
  });
  let ticketNumber = '';

  await test.step('the supervisor sees its thumbnail, downloads it, and makes it a ticket', async () => {
    const supervisor = await signedIn(browser, SUPERVISOR, 'supervisor');
    const card = supervisor.getByRole('article', { name: reference });
    const thumbnail = card.getByRole('img', { name: 'phone photo.jpg' });
    await expect(thumbnail).toBeVisible();
    expect(await drawn(thumbnail)).toBe(true);

    await downloadsRedrawnPhoto(
      supervisor,
      card.getByRole('button', { name: 'Download phone photo.jpg' })
    );

    await card.getByRole('button', { name: 'Turn into ticket' }).click();
    await supervisor
      .getByRole('dialog')
      .getByRole('button', { name: 'Create ticket' })
      .click();
    const said = snackBar(supervisor, `${reference} is now ticket #`);
    await expect(said).toHaveText(/#\d+, in Unassigned\./);
    ticketNumber = /#\d+/.exec(await said.innerText())?.[0] ?? '';
    await supervisor.context().close();
  });

  await test.step('the agent who takes it sees the photo in the popup, and downloads it', async () => {
    await request.post('/api/auth/sign-in', {
      data: { userId: SUPERVISOR, password: PASSWORD },
    });
    const team = (await (
      await request.get('/api/teams/mine')
    ).json()) as TeamOverview;
    const agent = await signedIn(browser, team.members[0].id, 'agent');
    await agent
      .getByRole('button', { name: `Take it ${ticketNumber}`, exact: true })
      .click();
    await expect(snackBar(agent, `${ticketNumber} is yours`)).toBeVisible();

    await rowOf(agent.locator('hd-ticket-table.mine'), ticketNumber)
      .getByRole('button', { name: new RegExp(`^Open ${ticketNumber},`) })
      .click();
    const popup = agent.getByRole('dialog');
    // In the customer's first message, under what they wrote.
    const first = popup.locator('.conversation li.customer');
    const thumbnail = first.getByRole('img', { name: 'phone photo.jpg' });
    await expect(thumbnail).toBeVisible();
    expect(await drawn(thumbnail)).toBe(true);

    await downloadsRedrawnPhoto(
      agent,
      first.getByRole('button', { name: 'Download phone photo.jpg' })
    );
    await agent.context().close();
  });
});
