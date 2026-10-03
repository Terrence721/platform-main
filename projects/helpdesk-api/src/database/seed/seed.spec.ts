import type { Database } from '../database.module';
import { minutesFrom, seedDatabase, ticketRow } from './seed';
import { SHOWCASE_TICKETS } from './story';

const now = new Date('2026-10-03T12:00:00.000Z');

describe('minutesFrom', () => {
  it('moves forward, backward or not at all from now', () => {
    expect(minutesFrom(now, 90).toISOString()).toBe('2026-10-03T13:30:00.000Z');
    expect(minutesFrom(now, -25).toISOString()).toBe(
      '2026-10-03T11:35:00.000Z'
    );
    expect(minutesFrom(now, 0)).toEqual(now);
  });
});

describe('ticketRow', () => {
  const [overdue] = SHOWCASE_TICKETS;
  const customerIds = new Map([[overdue.requesterEmail, 'customer-uuid-1']]);

  it('turns the relative times into dates, keeping an overdue SLA overdue', () => {
    const row = ticketRow(overdue, now, customerIds);

    expect(row.slaDueAt?.toISOString()).toBe('2026-10-03T11:35:00.000Z');
    expect(row.createdAt?.toISOString()).toBe('2026-10-03T07:00:00.000Z');
    expect(row.updatedAt?.toISOString()).toBe('2026-10-03T11:20:00.000Z');
  });

  it('points the ticket at its requester by customer ID', () => {
    const row = ticketRow(overdue, now, customerIds);

    expect(row.requesterId).toBe('customer-uuid-1');
    expect(row).toMatchObject({
      subject: overdue.subject,
      status: overdue.status,
      priority: overdue.priority,
      assigneeId: 'sam.rivera',
      queueId: 'accounts',
      tags: ['sign-in'],
    });
  });

  it('keeps a ticket without an SLA without one', () => {
    expect(
      ticketRow({ ...overdue, slaDueInMinutes: null }, now, customerIds)
        .slaDueAt
    ).toBeNull();
  });

  it('refuses a requester that is not a customer', () => {
    expect(() =>
      ticketRow(
        { ...overdue, requesterEmail: 'nobody@example.com' },
        now,
        customerIds
      )
    ).toThrow('No customer with the email nobody@example.com.');
  });
});

describe('seedDatabase', () => {
  it('refuses a database that already has users, and writes nothing', async () => {
    const database = {
      select: () => ({ from: async () => [{ existing: 3 }] }),
      transaction: vi.fn(),
      insert: vi.fn(),
    };

    await expect(
      seedDatabase(database as unknown as Database, { now })
    ).rejects.toThrow(
      'The database already has 3 users; seed only an empty one'
    );
    expect(database.transaction).not.toHaveBeenCalled();
    expect(database.insert).not.toHaveBeenCalled();
  });
});
