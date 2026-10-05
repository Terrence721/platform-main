import { PGlite } from '@electric-sql/pglite';
import type {
  TeamReport,
  TicketPriority,
  TicketStatus,
} from '@helpdesk/contract';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import type { Database } from '../database/database-token';
import {
  customers,
  queues,
  teams,
  ticketMessages,
  tickets,
  users,
} from '../database/schema';
import { ReportsService } from './reports.service';

/** The real migrations, so the tests run against the real schema. */
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

const now = new Date('2026-10-05T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

/** `hours` before `now` (after it, when negative). */
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * HOUR_MS);

interface TicketFixture {
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  createdHoursAgo: number;
  /** When it last changed: for a finished ticket, when it was finished. */
  updatedHoursAgo: number;
  /** When it is due, in hours ago (negative: still to come); none: no SLA. */
  dueHoursAgo: number | null;
  /** Its messages, by kind, in hours after it was created. */
  messages?: ['reply' | 'note', number][];
}

/**
 * Atlas (Sam) has open work of three priorities, one overdue, and three
 * tickets finished in the window (on time after 8 h, late after 50 h, no
 * due time after 4 h) plus one finished long before it. Beacon (Bea) has
 * one open and one finished on time after 6 h. Comet has no tickets. Two
 * unassigned new tickets, one overdue.
 */
const TICKETS: TicketFixture[] = [
  {
    subject: 'atlas open urgent, overdue',
    status: 'open',
    priority: 'urgent',
    assigneeId: 'sam.rivera',
    createdHoursAgo: 10,
    updatedHoursAgo: 2,
    dueHoursAgo: 1,
    // The note comes first; the first reply is 2 h in.
    messages: [
      ['note', 1],
      ['reply', 2],
    ],
  },
  {
    subject: 'atlas new low',
    status: 'new',
    priority: 'low',
    assigneeId: 'sam.rivera',
    createdHoursAgo: 2,
    updatedHoursAgo: 2,
    dueHoursAgo: -20,
  },
  {
    subject: 'atlas pending high',
    status: 'pending',
    priority: 'high',
    assigneeId: 'sam.rivera',
    createdHoursAgo: 30,
    updatedHoursAgo: 3,
    dueHoursAgo: -5,
  },
  {
    subject: 'atlas resolved on time',
    status: 'resolved',
    priority: 'normal',
    assigneeId: 'sam.rivera',
    createdHoursAgo: 48,
    updatedHoursAgo: 40,
    dueHoursAgo: 30,
    messages: [['reply', 3]],
  },
  {
    subject: 'atlas closed late',
    status: 'closed',
    priority: 'normal',
    assigneeId: 'sam.rivera',
    createdHoursAgo: 100,
    updatedHoursAgo: 50,
    dueHoursAgo: 80,
  },
  {
    subject: 'atlas closed, no due time',
    status: 'closed',
    priority: 'low',
    assigneeId: 'sam.rivera',
    createdHoursAgo: 24,
    updatedHoursAgo: 20,
    dueHoursAgo: null,
  },
  {
    subject: 'atlas closed before the window',
    status: 'closed',
    priority: 'normal',
    assigneeId: 'sam.rivera',
    createdHoursAgo: 50 * 24,
    updatedHoursAgo: 40 * 24,
    dueHoursAgo: 45 * 24,
    messages: [['reply', 1]],
  },
  {
    subject: 'beacon open normal',
    status: 'open',
    priority: 'normal',
    assigneeId: 'bea.quinn',
    createdHoursAgo: 5,
    updatedHoursAgo: 4,
    dueHoursAgo: -10,
    messages: [['reply', 1]],
  },
  {
    subject: 'beacon resolved on time',
    status: 'resolved',
    priority: 'high',
    assigneeId: 'bea.quinn',
    createdHoursAgo: 12,
    updatedHoursAgo: 6,
    dueHoursAgo: 1,
  },
  {
    subject: 'unassigned new urgent, overdue',
    status: 'new',
    priority: 'urgent',
    assigneeId: null,
    createdHoursAgo: 1,
    updatedHoursAgo: 1,
    dueHoursAgo: 0.5,
  },
  {
    subject: 'unassigned new normal',
    status: 'new',
    priority: 'normal',
    assigneeId: null,
    createdHoursAgo: 1,
    updatedHoursAgo: 1,
    dueHoursAgo: -5,
  },
];

/** A row with nothing in it: a team with no tickets. */
const EMPTY = {
  openByPriority: { low: 0, normal: 0, high: 0, urgent: 0 },
  overdue: 0,
  finished: 0,
  finishedWithDueTime: 0,
  finishedOnTime: 0,
  medianHoursToResolve: null,
  medianHoursToFirstReply: null,
};

const ATLAS: TeamReport = {
  teamId: 'atlas',
  name: 'Atlas',
  openByPriority: { low: 1, normal: 0, high: 1, urgent: 1 },
  overdue: 1,
  finished: 3,
  finishedWithDueTime: 2,
  finishedOnTime: 1,
  // Resolved after 8, 50 and 4 hours.
  medianHoursToResolve: 8,
  // First replies after 2 and 3 hours (the old ticket's is outside).
  medianHoursToFirstReply: 2.5,
};

const UNASSIGNED: TeamReport = {
  ...EMPTY,
  teamId: null,
  name: 'Unassigned',
  openByPriority: { low: 0, normal: 1, high: 0, urgent: 1 },
  overdue: 1,
};

describe('ReportsService', { timeout: 60_000 }, () => {
  let client: PGlite;
  let service: ReportsService;

  // One database for every test: they only read it.
  beforeAll(async () => {
    client = new PGlite();
    const database = drizzle(client);
    await migrate(database, { migrationsFolder: MIGRATIONS });

    await database.insert(teams).values([
      { id: 'atlas', name: 'Atlas' },
      { id: 'beacon', name: 'Beacon' },
      { id: 'comet', name: 'Comet' },
    ]);
    await database.insert(users).values([
      {
        id: 'sam.rivera',
        name: 'Sam Rivera',
        role: 'agent',
        teamId: 'atlas',
        passwordHash: 'x',
      },
      {
        id: 'bea.quinn',
        name: 'Bea Quinn',
        role: 'agent',
        teamId: 'beacon',
        passwordHash: 'x',
      },
    ]);
    await database.insert(queues).values({ id: 'accounts', name: 'Accounts' });
    const [customer] = await database
      .insert(customers)
      .values({ name: 'Dana Whitfield', email: 'dana.whitfield@example.com' })
      .returning({ id: customers.id });

    for (const ticket of TICKETS) {
      const [{ id }] = await database
        .insert(tickets)
        .values({
          subject: ticket.subject,
          description: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          requesterId: customer.id,
          queueId: 'accounts',
          assigneeId: ticket.assigneeId,
          createdAt: hoursAgo(ticket.createdHoursAgo),
          updatedAt: hoursAgo(ticket.updatedHoursAgo),
          slaDueAt:
            ticket.dueHoursAgo === null ? null : hoursAgo(ticket.dueHoursAgo),
        })
        .returning({ id: tickets.id });
      for (const [kind, hoursIn] of ticket.messages ?? []) {
        await database.insert(ticketMessages).values({
          ticketId: id,
          authorId: ticket.assigneeId ?? 'sam.rivera',
          kind,
          body: kind,
          createdAt: hoursAgo(ticket.createdHoursAgo - hoursIn),
        });
      }
    }

    // The service is typed for the node-postgres driver; both are Drizzle's
    // Postgres databases with the same query builder.
    service = new ReportsService(database as unknown as Database);
  });

  afterAll(() => client.close());

  describe('for every team (an admin)', () => {
    it('says when, over which window, and for whom', async () => {
      const report = await service.report('all', now);

      expect(report).toMatchObject({
        asOf: '2026-10-05T12:00:00.000Z',
        since: '2026-09-05T12:00:00.000Z',
        scope: 'all',
      });
    });

    it('counts open work by status across every row', async () => {
      expect((await service.report('all', now)).openByStatus).toEqual({
        new: 3,
        open: 2,
        pending: 1,
      });
    });

    it('lists every team by name, Unassigned last, with its figures', async () => {
      expect((await service.report('all', now)).teams).toEqual([
        ATLAS,
        {
          teamId: 'beacon',
          name: 'Beacon',
          openByPriority: { low: 0, normal: 1, high: 0, urgent: 0 },
          overdue: 0,
          finished: 1,
          finishedWithDueTime: 1,
          finishedOnTime: 1,
          medianHoursToResolve: 6,
          medianHoursToFirstReply: 1,
        },
        { ...EMPTY, teamId: 'comet', name: 'Comet' },
        UNASSIGNED,
      ]);
    });

    it('measures overdue at the time asked about', async () => {
      // Six hours on, Atlas's pending ticket and the unassigned normal one
      // are past due too; three hours before, nothing was yet.
      const later = new Date(now.getTime() + 6 * HOUR_MS);
      const earlier = new Date(now.getTime() - 3 * HOUR_MS);

      const overdue = async (at: Date) =>
        (await service.report('all', at)).teams.map(
          ({ name, overdue }) => `${name} ${overdue}`
        );

      expect(await overdue(later)).toEqual([
        'Atlas 2',
        'Beacon 0',
        'Comet 0',
        'Unassigned 2',
      ]);
      expect(await overdue(earlier)).toEqual([
        'Atlas 0',
        'Beacon 0',
        'Comet 0',
        'Unassigned 0',
      ]);
    });
  });

  describe("for one team (its supervisor's)", () => {
    it('has that team and Unassigned, and counts only their work', async () => {
      const report = await service.report({ teamId: 'atlas' }, now);

      expect(report.scope).toEqual({ teamId: 'atlas' });
      expect(report.teams).toEqual([ATLAS, UNASSIGNED]);
      expect(report.openByStatus).toEqual({ new: 3, open: 1, pending: 1 });
    });

    it('gives a team with no tickets zeros, and still Unassigned', async () => {
      const report = await service.report({ teamId: 'comet' }, now);

      expect(report.teams).toEqual([
        { ...EMPTY, teamId: 'comet', name: 'Comet' },
        UNASSIGNED,
      ]);
      expect(report.openByStatus).toEqual({ new: 2, open: 0, pending: 0 });
    });
  });
});
