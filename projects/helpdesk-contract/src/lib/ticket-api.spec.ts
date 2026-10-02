import { PageRequest } from './page';
import {
  CreateTicketRequest,
  DEFAULT_TICKET_SORT,
  formatTicketNumber,
  isTicketSort,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_MAX_TAGS,
  TICKET_SORT_FIELDS,
  TICKET_SUBJECT_MAX_LENGTH,
  TICKET_TAG_MAX_LENGTH,
  TicketDto,
  TicketListQuery,
  TicketSort,
  UpdateTicketRequest,
} from './ticket-api';

describe('ticket limits', () => {
  it('match what the forms and the API enforce', () => {
    expect({
      subject: TICKET_SUBJECT_MAX_LENGTH,
      description: TICKET_DESCRIPTION_MAX_LENGTH,
      tags: TICKET_MAX_TAGS,
      tagLength: TICKET_TAG_MAX_LENGTH,
    }).toEqual({ subject: 200, description: 10_000, tags: 10, tagLength: 30 });
  });
});

describe('ticket sorting', () => {
  it('sorts by number, dates and priority, most recently changed first by default', () => {
    expect(TICKET_SORT_FIELDS).toEqual([
      'ticketNumber',
      'createdAt',
      'updatedAt',
      'priority',
      'slaDueAt',
    ]);
    expect(DEFAULT_TICKET_SORT).toBe('-updatedAt');
  });

  it.each(TICKET_SORT_FIELDS)(
    'accepts %s ascending and descending',
    (field) => {
      expect(isTicketSort(field)).toBe(true);
      expect(isTicketSort(`-${field}`)).toBe(true);
    }
  );

  it.each([
    ['--updatedAt'],
    ['-'],
    [''],
    ['subject'],
    ['UpdatedAt'],
    ['updatedAt-'],
    [null],
    [1],
  ])('rejects %j', (value) => {
    expect(isTicketSort(value)).toBe(false);
  });

  it('has exactly the ten sort values as its type', () => {
    expectTypeOf<TicketSort>().toEqualTypeOf<
      | 'ticketNumber'
      | 'createdAt'
      | 'updatedAt'
      | 'priority'
      | 'slaDueAt'
      | '-ticketNumber'
      | '-createdAt'
      | '-updatedAt'
      | '-priority'
      | '-slaDueAt'
    >();
  });
});

describe('formatTicketNumber', () => {
  it('shows the number the way people see it', () => {
    expect(formatTicketNumber(1042)).toBe('#1042');
    expect(formatTicketNumber(1)).toBe('#1');
  });
});

describe('ticket shapes', () => {
  it('describes a ticket as the API returns it', () => {
    const ticket: TicketDto = {
      id: 'b6f1c0de-0000-4000-8000-000000000001',
      ticketNumber: 1042,
      subject: 'Cannot sign in',
      description: 'The sign-in page says my password is wrong.',
      status: 'open',
      priority: 'high',
      requester: { id: 'c1', name: 'Ada Lovelace', email: 'ada@example.com' },
      assignee: null,
      queue: { id: 'q1', name: 'Accounts' },
      tags: ['sign-in'],
      slaDueAt: '2026-10-03T09:00:00.000Z',
      createdAt: '2026-10-02T09:00:00.000Z',
      updatedAt: '2026-10-02T09:15:00.000Z',
    };
    expect(formatTicketNumber(ticket.ticketNumber)).toBe('#1042');
    expectTypeOf(ticket.assignee).toEqualTypeOf<{
      id: string;
      name: string;
    } | null>();
  });

  it('requires every field to raise a ticket, except its tags', () => {
    expectTypeOf<CreateTicketRequest>().toEqualTypeOf<{
      subject: string;
      description: string;
      priority: 'low' | 'normal' | 'high' | 'urgent';
      requesterId: string;
      queueId: string;
      tags?: string[];
    }>();
  });

  it('makes every update field optional, and lets the assignee be cleared', () => {
    const unassign: UpdateTicketRequest = { assigneeId: null };
    const nothing: UpdateTicketRequest = {};
    expect([unassign, nothing]).toHaveLength(2);
    expectTypeOf<UpdateTicketRequest['assigneeId']>().toEqualTypeOf<
      string | null | undefined
    >();
    expectTypeOf<Required<UpdateTicketRequest>>().toHaveProperty('status');
  });

  it('includes paging in the list query', () => {
    expectTypeOf<TicketListQuery>().toExtend<PageRequest>();
    const query: TicketListQuery = {
      status: 'open',
      assigneeId: 'u1',
      search: 'password',
      sort: '-slaDueAt',
      page: 2,
      pageSize: 50,
    };
    expect(isTicketSort(query.sort)).toBe(true);
  });
});
