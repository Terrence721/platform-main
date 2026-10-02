import { CAPABILITIES } from './capability';

describe('CAPABILITIES', () => {
  it('lists the six capabilities in the order the page shows them', () => {
    expect(CAPABILITIES.map(({ title }) => title)).toEqual([
      'Tickets and queues',
      'Deadlines you can see',
      'Replies and internal notes',
      'Clear ownership',
      'Live updates',
      'Admin in the same app',
    ]);
  });

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
