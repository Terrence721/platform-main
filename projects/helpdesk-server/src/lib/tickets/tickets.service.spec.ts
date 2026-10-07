import { PGlite } from '@electric-sql/pglite';
import type { TicketStatus } from '@helpdesk/contract';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import { customers, queues, tickets, users } from '../database/schema';
import { TicketsService } from './tickets.service';

/** The real migrations, so the tests run against the real schema. */
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/**
 * Sam's, Benny's and Helen's tickets, inserted in this order, so they get
 * ticket numbers 1001, 1002, ... in this order. Due times are fixed;
 * "overdue" just means earlier than the rest. Some tickets say when they
 * were created or last changed; the rest default to the time of the insert.
 * A finished ticket was finished when it last changed, unless it says so.
 */
const TICKETS: {
  subject: string;
  assigneeId: string | null;
  status: TicketStatus;
  slaDueAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string;
}[] = [
  // #1001
  {
    subject: 'No SLA',
    assigneeId: 'sam.rivera',
    status: 'open',
    slaDueAt: null,
  },
  // #1002
  {
    subject: 'Due later',
    assigneeId: 'sam.rivera',
    status: 'pending',
    slaDueAt: '2026-10-05T09:00:00Z',
  },
  // #1003
  {
    subject: 'Overdue',
    assigneeId: 'sam.rivera',
    status: 'open',
    slaDueAt: '2026-10-01T09:00:00Z',
  },
  // #1004
  {
    subject: 'Resolved',
    assigneeId: 'sam.rivera',
    status: 'resolved',
    slaDueAt: '2026-09-30T09:00:00Z',
    updatedAt: '2026-09-30T10:00:00Z',
  },
  // #1005
  {
    subject: 'Closed',
    assigneeId: 'sam.rivera',
    status: 'closed',
    slaDueAt: '2026-09-29T09:00:00Z',
    // Changed after #1004, so it comes before it.
    updatedAt: '2026-10-02T10:00:00Z',
  },
  // #1006
  {
    subject: 'Due soon, second',
    assigneeId: 'sam.rivera',
    status: 'new',
    slaDueAt: '2026-10-03T09:00:00Z',
  },
  // #1007
  {
    subject: "Benny's",
    assigneeId: 'benny.lind',
    status: 'open',
    slaDueAt: '2026-09-28T09:00:00Z',
  },
  // #1008
  {
    subject: 'Unassigned',
    assigneeId: null,
    status: 'new',
    slaDueAt: '2026-09-27T09:00:00Z',
  },
  // #1009: the same due time as #1006, so the ticket number decides.
  {
    subject: 'Due soon, too',
    assigneeId: 'sam.rivera',
    status: 'open',
    slaDueAt: '2026-10-03T09:00:00Z',
  },
  // #1010-#1015: Helen's, for her history since HISTORY_SINCE (3 July).
  {
    subject: 'Open, created in the window',
    assigneeId: 'helen.history',
    status: 'open',
    slaDueAt: '2026-09-02T09:00:00Z',
    createdAt: '2026-09-01T09:00:00Z',
    updatedAt: '2026-09-01T09:00:00Z',
  },
  {
    subject: 'Resolved before its due time',
    assigneeId: 'helen.history',
    status: 'resolved',
    slaDueAt: '2026-08-03T09:00:00Z',
    createdAt: '2026-08-01T09:00:00Z',
    updatedAt: '2026-08-02T09:00:00Z',
  },
  {
    subject: 'Closed after its due time',
    assigneeId: 'helen.history',
    status: 'closed',
    slaDueAt: '2026-08-15T09:00:00Z',
    createdAt: '2026-08-10T09:00:00Z',
    updatedAt: '2026-08-20T09:00:00Z',
  },
  {
    subject: 'Closed, no SLA',
    assigneeId: 'helen.history',
    status: 'closed',
    slaDueAt: null,
    createdAt: '2026-09-10T09:00:00Z',
    updatedAt: '2026-09-11T09:00:00Z',
  },
  {
    subject: 'Created before the window, changed in it',
    assigneeId: 'helen.history',
    status: 'resolved',
    slaDueAt: '2026-03-05T09:00:00Z',
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: '2026-07-10T09:00:00Z',
  },
  {
    subject: 'Before the window entirely',
    assigneeId: 'helen.history',
    status: 'closed',
    slaDueAt: '2026-02-05T09:00:00Z',
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-03-01T09:00:00Z',
  },
  // #1016 (#1020): finished on time, closed after its due time.
  {
    subject: 'Resolved on time, closed later',
    assigneeId: 'helen.history',
    status: 'closed',
    slaDueAt: '2026-09-20T09:00:00Z',
    createdAt: '2026-09-15T09:00:00Z',
    finishedAt: '2026-09-18T09:00:00Z',
    updatedAt: '2026-09-25T09:00:00Z',
  },
];

/** The start of Helen's history window: 3 months before 3 October. */
const HISTORY_SINCE = new Date('2026-07-03T00:00:00Z');

describe('TicketsService', () => {
  let client: PGlite;
  let service: TicketsService;

  beforeAll(async () => {
    client = new PGlite();
    const database = drizzle(client);
    await migrate(database, { migrationsFolder: MIGRATIONS });

    await database.insert(queues).values({ id: 'accounts', name: 'Accounts' });
    const [customer] = await database
      .insert(customers)
      .values({ name: 'Dana Whitfield', email: 'dana.whitfield@example.com' })
      .returning({ id: customers.id });
    await database.insert(users).values(
      [
        { id: 'sam.rivera', name: 'Sam Rivera' },
        { id: 'benny.lind', name: 'Benny Lind' },
        { id: 'nobody.yet', name: 'Nobody Yet' },
        { id: 'helen.history', name: 'Helen History' },
      ].map((user) => ({ ...user, role: 'agent' as const, passwordHash: 'x' }))
    );
    for (const ticket of TICKETS) {
      const finishedAt =
        ticket.status === 'resolved' || ticket.status === 'closed'
          ? (ticket.finishedAt ?? ticket.updatedAt)
          : undefined;
      await database.insert(tickets).values({
        subject: ticket.subject,
        description: `About: ${ticket.subject}`,
        status: ticket.status,
        priority: 'normal',
        requesterId: customer.id,
        assigneeId: ticket.assigneeId,
        queueId: 'accounts',
        slaDueAt: ticket.slaDueAt === null ? null : new Date(ticket.slaDueAt),
        ...(ticket.createdAt && { createdAt: new Date(ticket.createdAt) }),
        ...(ticket.updatedAt && { updatedAt: new Date(ticket.updatedAt) }),
        ...(finishedAt && { finishedAt: new Date(finishedAt) }),
      });
    }

    service = new TicketsService(database);
  }, 60_000);

  afterAll(() => client.close());

  it("lists only the user's open work: new, open and pending", async () => {
    const mine = await service.assignedTo('sam.rivera');

    expect(mine.map(({ status }) => status).sort()).toEqual([
      'new',
      'open',
      'open',
      'open',
      'pending',
    ]);
    expect(mine.every(({ assignee }) => assignee?.id === 'sam.rivera')).toBe(
      true
    );
  });

  it('puts the most urgent first: overdue, then by due time, no SLA last', async () => {
    const mine = await service.assignedTo('sam.rivera');

    expect(mine.map(({ ticketNumber }) => ticketNumber)).toEqual([
      1003, // overdue
      1006, // due soon; same time as #1009, lower number first
      1009,
      1002, // due later
      1001, // no SLA
    ]);
  });

  it('fills in the customer, assignee and queue', async () => {
    const [first] = await service.assignedTo('sam.rivera');

    expect(first).toEqual(
      expect.objectContaining({
        subject: 'Overdue',
        requester: expect.objectContaining({
          name: 'Dana Whitfield',
          email: 'dana.whitfield@example.com',
        }),
        assignee: { id: 'sam.rivera', name: 'Sam Rivera' },
        queue: { id: 'accounts', name: 'Accounts' },
        slaDueAt: '2026-10-01T09:00:00.000Z',
      })
    );
  });

  it('gives someone with nothing assigned an empty list', async () => {
    expect(await service.assignedTo('nobody.yet')).toEqual([]);
  });

  describe('allAssignedTo', () => {
    it("lists all the user's tickets: open work most urgent first, then finished work most recently changed first", async () => {
      const all = await service.allAssignedTo('sam.rivera');

      expect(all.map(({ ticketNumber }) => ticketNumber)).toEqual([
        // Open work, as on My tickets.
        1003, 1006, 1009, 1002, 1001,
        // Finished: closed on 2 October, then resolved on 30 September.
        1005, 1004,
      ]);
    });

    it("leaves out other people's and unassigned tickets", async () => {
      const all = await service.allAssignedTo('sam.rivera');

      expect(all.every(({ assignee }) => assignee?.id === 'sam.rivera')).toBe(
        true
      );
    });

    it('gives someone with nothing assigned an empty list', async () => {
      expect(await service.allAssignedTo('nobody.yet')).toEqual([]);
    });
  });

  describe('historyFor', () => {
    const history = () => service.historyFor('helen.history', HISTORY_SINCE);

    it('lists tickets created or changed in the window, most recently changed first', async () => {
      const { tickets } = await history();

      expect(tickets.map(({ ticketNumber }) => ticketNumber)).toEqual([
        1016, // changed 25 Sep
        1013, // 11 Sep
        1010, // 1 Sep
        1012, // 20 Aug
        1011, // 2 Aug
        1014, // 10 Jul: created in March, but changed in the window
        // Not #1015: created and last changed before the window.
      ]);
    });

    it('adds them up: finished on time or late, no SLA counting as neither', async () => {
      expect((await history()).summary).toEqual({
        assigned: 6,
        finished: 5, // #1011, #1012, #1013, #1014, #1016
        open: 1, // #1010
        // #1016 was finished before its due time, though closed after it
        // (#1020).
        onTime: 2, // #1011, #1016
        late: 2, // #1012, #1014 (#1013 has no SLA)
      });
    });

    it("keeps to the user: none of Sam's tickets", async () => {
      const { tickets } = await history();

      expect(
        tickets.every(({ assignee }) => assignee?.id === 'helen.history')
      ).toBe(true);
    });

    it('gives someone with no tickets an empty history', async () => {
      expect(await service.historyFor('nobody.yet', HISTORY_SINCE)).toEqual({
        summary: { assigned: 0, finished: 0, open: 0, onTime: 0, late: 0 },
        tickets: [],
      });
    });
  });
});
