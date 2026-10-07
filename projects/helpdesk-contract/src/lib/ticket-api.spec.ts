import {
  formatTicketNumber,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_SUBJECT_MAX_LENGTH,
  TicketDto,
} from './ticket-api';

describe('ticket limits', () => {
  it('are the widths of the subject and description columns', () => {
    expect({
      subject: TICKET_SUBJECT_MAX_LENGTH,
      description: TICKET_DESCRIPTION_MAX_LENGTH,
    }).toEqual({ subject: 200, description: 10_000 });
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
});
