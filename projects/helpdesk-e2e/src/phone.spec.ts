import type { Role } from '@helpdesk/contract';
import { expect, test } from '@playwright/test';
import { signInAs } from './support';

// On a phone each role's tables are wider than the screen (#1262). They
// scroll sideways on their own, inside the page, so the page itself, and
// the toolbar with it, stays the width of the screen.
test.describe('on a phone', () => {
  const width = 360;

  for (const { userId, role } of [
    { userId: 'sam.rivera', role: 'agent' },
    { userId: 'chris.taylor', role: 'supervisor' },
    { userId: 'alex.morgan', role: 'admin' },
  ] satisfies { userId: string; role: Role }[]) {
    test(`keeps the ${role}'s page to the screen, the tables scrolling on their own`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 740 });
      await signInAs(page, userId, role);
      const table = page.getByRole('table').first();
      await expect(table).toBeVisible();

      // The page is no wider than the screen.
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth)
      ).toBe(width);

      // The table's last column is reached by scrolling the table.
      const lastHeader = table.getByRole('columnheader').last();
      await lastHeader.scrollIntoViewIfNeeded();
      await expect(lastHeader).toBeInViewport();
    });
  }
});
