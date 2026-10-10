import { CAPABILITIES } from './capability';

describe('CAPABILITIES', () => {
  it('lists the six capabilities in the order the page shows them', () => {
    expect(CAPABILITIES.map(({ title }) => title)).toEqual([
      // How requests arrive (#1026): the public Report an issue page.
      'Customers report issues',
      'Tickets, priorities and deadlines',
      'Replies and internal notes',
      'Clear ownership',
      'Live updates',
      'Accounts and reports in the same app',
    ]);
  });

  // The public page, and the live demo beside it, promise only what the
  // app does (#1024): it has no queues, filters, search or canned replies.
  it.each(CAPABILITIES)(
    'promises in "$title" nothing the app lacks',
    ({ title, summary }) => {
      expect(`${title} ${summary}`).not.toMatch(
        /queue|filter|search|canned|customers,|nearly-due/i
      );
    }
  );

  it('gives each capability its own id, which @ngrx/data keys them by', () => {
    const ids = CAPABILITIES.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CAPABILITIES)(
    'gives "$title" an icon and a summary',
    (capability) => {
      expect(capability.icon).toMatch(/^[a-z_]+$/);
      expect(capability.summary.length).toBeGreaterThan(0);
    }
  );
});
