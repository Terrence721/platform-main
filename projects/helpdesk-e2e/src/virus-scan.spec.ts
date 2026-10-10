import type { PendingRequest } from '@helpdesk/contract';
import { expect, test } from '@playwright/test';
import { PASSWORD } from './support';
import { scanOn } from './stack';

// The optional virus scan (#1293), with real ClamAV: only when the stack
// was started with it (E2E_SCAN=1); otherwise skipped, so the usual run
// stays as fast as it was.
// The test file's own name: cspell:ignore EICAR

/**
 * The EICAR test file: 68 harmless characters every virus scanner flags.
 * Put together from pieces, so the whole text is never on disk, where an
 * antivirus would quarantine this file.
 */
function eicarTestFile(): Buffer {
  const file = Buffer.from(
    [
      'X5O!P%@AP[4\\PZX54(P^)7CC)7}$',
      'EICAR-STANDARD-',
      'ANTIVIRUS-TEST-',
      'FILE!$H+H*',
    ].join('')
  );
  expect(file).toHaveLength(68);
  return file;
}

// eslint-disable-next-line playwright/no-skipped-test -- off unless asked for (E2E_SCAN=1), and reported as skipped.
test.skip(!scanOn(), 'The virus scan is off: run with E2E_SCAN=1.');

test('a visitor attaching the test virus is told it failed the check, and nothing is kept', async ({
  page,
  request,
}) => {
  const subject = 'Export stops at 1,000 rows (infected attachment)';
  await page.clock.install();
  await page.goto('/report');
  await page.getByLabel('Your name').fill('Robin Ellis');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill('robin.scan@example.com');
  await page.getByRole('combobox', { name: 'What is it about?' }).click();
  await page.getByRole('option', { name: 'Something is broken' }).click();
  await page.getByRole('radio', { name: "I'm blocked" }).check();
  await page.getByLabel('Subject').fill(subject);
  await page.getByLabel('Describe the problem').fill('Notes attached.');
  // A .txt passes the picker's first check: only the scan can stop it.
  await page.locator('hd-attachment-picker input[type=file]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: eicarTestFile(),
  });
  await expect(page.locator('hd-attachment-picker li .name')).toHaveText([
    'notes.txt',
  ]);
  await page.getByRole('checkbox').check();
  await page.clock.fastForward('00:05');
  await page.getByRole('button', { name: 'Send request' }).click();

  await expect(page.locator('.send-error')).toHaveText(
    '"notes.txt" didn\'t pass the virus check.'
  );
  await expect(page.locator('.sent')).toHaveCount(0);

  await test.step('no supervisor sees it', async () => {
    await request.post('/api/auth/sign-in', {
      data: { userId: 'omar.haddad', password: PASSWORD },
    });
    const pending = (await (
      await request.get('/api/requests')
    ).json()) as PendingRequest[];
    expect(pending.map((waiting) => waiting.subject)).not.toContain(subject);
  });
});
