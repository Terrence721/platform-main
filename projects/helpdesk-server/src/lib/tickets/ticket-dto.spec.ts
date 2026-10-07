import { customers, queues, tickets, users } from '../database/schema';
import { TICKET_COLUMNS, TicketRow, toTicketDto } from './ticket-dto';

const row: TicketRow = {
  ticket: {
    id: '7d0f6c2e-4b1a-4c3e-9a51-2f8d6e0b1c34',
    ticketNumber: 1001,
    subject: 'Cannot sign in after the password reset',
    description: 'The reset email arrived, but the new password is refused.',
    status: 'open',
    priority: 'high',
    requesterId: '0b6e2a8c-1f3d-4e5a-8c7b-9d2e1f0a3b45',
    assigneeId: 'sam.rivera',
    queueId: 'accounts',
    tags: ['login', 'password'],
    slaDueAt: new Date('2026-10-03T12:00:00.000Z'),
    finishedAt: null,
    createdAt: new Date('2026-10-01T08:30:00.000Z'),
    updatedAt: new Date('2026-10-02T16:45:00.000Z'),
  },
  requester: {
    id: '0b6e2a8c-1f3d-4e5a-8c7b-9d2e1f0a3b45',
    name: 'Dana Whitfield',
    email: 'dana.whitfield@example.com',
  },
  assignee: { id: 'sam.rivera', name: 'Sam Rivera' },
  queue: { id: 'accounts', name: 'Accounts' },
};

describe('toTicketDto', () => {
  it('sends an assigned ticket as the contract shapes it, dates in UTC', () => {
    expect(toTicketDto(row)).toEqual({
      id: '7d0f6c2e-4b1a-4c3e-9a51-2f8d6e0b1c34',
      ticketNumber: 1001,
      subject: 'Cannot sign in after the password reset',
      description: 'The reset email arrived, but the new password is refused.',
      status: 'open',
      priority: 'high',
      requester: {
        id: '0b6e2a8c-1f3d-4e5a-8c7b-9d2e1f0a3b45',
        name: 'Dana Whitfield',
        email: 'dana.whitfield@example.com',
      },
      assignee: { id: 'sam.rivera', name: 'Sam Rivera' },
      queue: { id: 'accounts', name: 'Accounts' },
      tags: ['login', 'password'],
      slaDueAt: '2026-10-03T12:00:00.000Z',
      createdAt: '2026-10-01T08:30:00.000Z',
      updatedAt: '2026-10-02T16:45:00.000Z',
    });
  });

  it('keeps an unassigned ticket unassigned', () => {
    const unassigned = toTicketDto({
      ...row,
      ticket: { ...row.ticket, assigneeId: null },
      assignee: null,
    });

    expect(unassigned.assignee).toBeNull();
  });

  it('keeps a ticket with no SLA without a due time', () => {
    const noSla = toTicketDto({
      ...row,
      ticket: { ...row.ticket, slaDueAt: null },
    });

    expect(noSla.slaDueAt).toBeNull();
  });
});

describe('TICKET_COLUMNS', () => {
  it('selects the whole ticket', () => {
    expect(TICKET_COLUMNS.ticket).toBe(tickets);
  });

  it('selects only what the contract sends about people and queues', () => {
    expect(TICKET_COLUMNS.requester).toEqual({
      id: customers.id,
      name: customers.name,
      email: customers.email,
    });
    expect(TICKET_COLUMNS.assignee).toEqual({ id: users.id, name: users.name });
    expect(TICKET_COLUMNS.queue).toEqual({ id: queues.id, name: queues.name });
  });
});
