import { expect, test } from '@playwright/test';
import { compose, composeWith } from './stack';
import { HOME_PAGES, PASSWORD, rowOf } from './support';

// Live updates after the API restarts (#1174). While the API is down, nginx
// answers the stream with 502, and a browser gives up on a stream for good
// after an HTTP error; the app now opens it again once the API is back.
//
// Sessions survive a restart only with a fixed HELPDESK_JWT_SECRET (#1105:
// the image makes a new one at each start otherwise, and every page is
// then asked to sign in again), so the API is first recreated with one.
// A new agent on Team Delta, which no other spec works in, keeps the other
// specs' people and tickets as they are.

/** A 32-character test secret, used only on this throwaway stack. */
const SECRET = 'e2e-restart-secret-0123456789abcd';

/** Waits until the API answers again through nginx. */
async function apiAnswers(baseURL: string) {
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(new URL('/api/health', baseURL))).ok;
        } catch {
          return false;
        }
      },
      { timeout: 120_000, intervals: [1_000] }
    )
    .toBe(true);
}

test('live updates come back after the API restarts', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const url = baseURL ?? 'http://localhost:8088';
  const suffix = Date.now().toString(36);
  const userId = `e2e.riley.${suffix}`;
  const password = 'starting-password-1';

  await test.step('the API runs with a fixed sign-in secret', async () => {
    // The app's nginx is recreated too, so it finds the new API container.
    expect(
      composeWith(
        { HELPDESK_JWT_SECRET: SECRET },
        'up',
        '--detach',
        '--wait',
        '--no-build',
        '--force-recreate',
        'api',
        'app'
      )
    ).toBe(true);
    await apiAnswers(url);
  });

  const admin = await browser.newContext();
  await test.step('an admin opens an account for a new agent', async () => {
    const signedIn = await admin.request.post('/api/auth/sign-in', {
      data: { userId: 'alex.morgan', password: PASSWORD },
    });
    expect(signedIn.ok(), 'signing in as the admin').toBe(true);
    const created = await admin.request.post('/api/users', {
      data: {
        userId,
        name: `Riley Test ${suffix}`,
        role: 'agent',
        teamId: 'delta',
        password,
      },
    });
    expect(created.ok(), `creating ${userId}`).toBe(true);
  });

  const agent = await browser.newContext();
  const page = await agent.newPage();
  await test.step('the agent is at work, the stream open', async () => {
    const signedIn = await agent.request.post('/api/auth/sign-in', {
      data: { userId, password },
    });
    expect(signedIn.ok(), `signing in as ${userId}`).toBe(true);
    const stream = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/events'
    );
    await page.goto(HOME_PAGES.agent);
    expect((await stream).status()).toBe(200);
  });

  await test.step('the API restarts', async () => {
    expect(compose('restart', 'api')).toBe(true);
    await apiAnswers(url);
  });

  await test.step('a ticket assigned to the agent still reaches them live', async () => {
    const lead = await browser.newContext();
    const signedIn = await lead.request.post('/api/auth/sign-in', {
      data: { userId: 'lena.fischer', password: PASSWORD },
    });
    expect(signedIn.ok(), 'signing in as Team Delta’s lead').toBe(true);
    const team = await (await lead.request.get('/api/teams/mine')).json();
    const ticket = team.unassigned[0];
    const assigned = await lead.request.put(
      `/api/tickets/${ticket.id}/assignee`,
      { data: { assigneeId: userId } }
    );
    expect(assigned.ok(), `assigning #${ticket.ticketNumber}`).toBe(true);

    await expect(
      rowOf(page.locator('hd-ticket-table.mine'), `#${ticket.ticketNumber}`)
    ).toBeVisible({ timeout: 90_000 });
    await lead.close();
  });

  await agent.close();
  await admin.close();
});
