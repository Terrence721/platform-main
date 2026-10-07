import { PGlite } from '@electric-sql/pglite';
import { asc, count, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import { verifyPassword } from '../../auth/password';
import type { Database } from '../database-token';
import { ticketMessages, tickets, users } from '../schema';
import {
  DEFAULT_SEED_PASSWORD,
  minutesFrom,
  seedDatabase,
  SeedSummary,
  ticketRow,
} from './seed';
import { SHOWCASE_TICKETS } from './story';

const now = new Date('2026-10-03T12:00:00.000Z');
const MIGRATIONS = fileURLToPath(
  new URL('../../../../drizzle', import.meta.url)
);

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

  it('says when a finished ticket was finished: its last change (#1020)', () => {
    expect(ticketRow(overdue, now, customerIds).finishedAt).toBeNull();
    for (const status of ['resolved', 'closed'] as const) {
      expect(
        ticketRow({ ...overdue, status }, now, customerIds).finishedAt
      ).toEqual(new Date('2026-10-03T11:20:00.000Z'));
    }
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

describe('seedDatabase into a fresh database', { timeout: 60_000 }, () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle>;
  let summary: SeedSummary;

  // One small seed for both tests, as they only read it.
  beforeAll(async () => {
    client = new PGlite();
    database = drizzle(client);
    await migrate(database, { migrationsFolder: MIGRATIONS });
    summary = await seedDatabase(database as unknown as Database, {
      now,
      customers: 10,
      tickets: 30,
    });
  });

  afterAll(() => client.close());

  it('hashes the shared password once, for every account, and it verifies (#1039)', async () => {
    const hashes = await database
      .selectDistinct({ hash: users.passwordHash })
      .from(users);

    expect(hashes).toHaveLength(1);
    expect(await verifyPassword(DEFAULT_SEED_PASSWORD, hashes[0].hash)).toBe(
      true
    );
  });

  it('stores every generated message, and counts them in the summary', async () => {
    const [{ stored }] = await database
      .select({ stored: count() })
      .from(ticketMessages);

    expect(summary.messages).toBeGreaterThan(0);
    expect(stored).toBe(summary.messages);
  });

  it('keeps each conversation with its own ticket, at its own times', async () => {
    const [ada] = await database
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.ticketNumber, 1001));
    const messages = await database
      .select({
        kind: ticketMessages.kind,
        body: ticketMessages.body,
        authorId: ticketMessages.authorId,
        createdAt: ticketMessages.createdAt,
      })
      .from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ada.id))
      .orderBy(asc(ticketMessages.createdAt));

    expect(messages).toEqual(
      SHOWCASE_TICKETS[0].messages.map((message) => ({
        kind: message.kind,
        body: message.body,
        authorId: message.authorId,
        createdAt: minutesFrom(now, -message.minutesAgo),
      }))
    );
  });
});
