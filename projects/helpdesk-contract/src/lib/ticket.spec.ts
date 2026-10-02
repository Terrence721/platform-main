import {
  canTransition,
  isTicketPriority,
  isTicketStatus,
  TICKET_PRIORITIES,
  TICKET_STATUS_TRANSITIONS,
  TICKET_STATUSES,
  TicketPriority,
  TicketStatus,
} from './ticket';

describe('ticket statuses and priorities', () => {
  it('lists the statuses in workflow order', () => {
    expect(TICKET_STATUSES).toEqual([
      'new',
      'open',
      'pending',
      'resolved',
      'closed',
    ]);
  });

  it('lists the priorities lowest first', () => {
    expect(TICKET_PRIORITIES).toEqual(['low', 'normal', 'high', 'urgent']);
  });

  it('derives the types from the lists', () => {
    expectTypeOf<TicketStatus>().toEqualTypeOf<
      'new' | 'open' | 'pending' | 'resolved' | 'closed'
    >();
    expectTypeOf<TicketPriority>().toEqualTypeOf<
      'low' | 'normal' | 'high' | 'urgent'
    >();
  });
});

describe('isTicketStatus / isTicketPriority', () => {
  it.each(TICKET_STATUSES)('accepts the status %s', (status) => {
    expect(isTicketStatus(status)).toBe(true);
  });

  it.each(TICKET_PRIORITIES)('accepts the priority %s', (priority) => {
    expect(isTicketPriority(priority)).toBe(true);
  });

  it.each([['reopened'], ['Open'], [''], [null], [undefined], [1], [{}]])(
    'rejects %j',
    (value) => {
      expect(isTicketStatus(value)).toBe(false);
      expect(isTicketPriority(value)).toBe(false);
    }
  );

  it('narrows the type', () => {
    const value: unknown = 'open';
    if (isTicketStatus(value)) {
      expectTypeOf(value).toEqualTypeOf<TicketStatus>();
    }
  });
});

describe('status changes', () => {
  // The agreed rules (#864), written out independently of the implementation.
  const allowed = new Set([
    'new>open',
    'new>closed',
    'open>pending',
    'open>resolved',
    'open>closed',
    'pending>open',
    'pending>resolved',
    'pending>closed',
    'resolved>open',
    'resolved>closed',
  ]);

  it('has rules for every status', () => {
    expect(Object.keys(TICKET_STATUS_TRANSITIONS).sort()).toEqual(
      [...TICKET_STATUSES].sort()
    );
  });

  it('never lists a status as a change to itself', () => {
    for (const status of TICKET_STATUSES) {
      expect(TICKET_STATUS_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it('treats closed as final', () => {
    expect(TICKET_STATUS_TRANSITIONS.closed).toEqual([]);
  });

  it.each(
    TICKET_STATUSES.flatMap((from) => TICKET_STATUSES.map((to) => [from, to]))
  )('%s -> %s follows the agreed rules', (from, to) => {
    expect(canTransition(from, to)).toBe(allowed.has(`${from}>${to}`));
  });
});
