import { PGlite } from '@electric-sql/pglite';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import type { Database } from './database-token';
import { reportingTeams, reportingTickets, reportingUsers } from './reporting';
import { teams, ticketMessages, tickets, users } from './schema';
import { seedDatabase, type SeedSummary } from './seed/seed';

const now = new Date('2026-10-05T12:00:00.000Z');
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

describe('the reporting views', { timeout: 60_000 }, () => {
  let client: PGlite;
  let database: Database;
  let summary: SeedSummary;

  // One small seed for every test: they only read it.
  beforeAll(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS });
    database = drizzle(client);
    summary = await seedDatabase(database, {
      now,
      customers: 10,
      tickets: 60,
    });
  });

  afterAll(() => client.close());

  /** Each view's columns and their types, as PostgreSQL describes them. */
  async function viewColumns(): Promise<Record<string, string[]>> {
    const { rows } = await client.query<{
      table_name: string;
      column_name: string;
      data_type: string;
    }>(
      `select table_name, column_name, data_type
       from information_schema.columns
       where table_schema = 'reporting'
       order by table_name, ordinal_position`
    );
    const views: Record<string, string[]> = {};
    for (const { table_name, column_name, data_type } of rows) {
      (views[table_name] ??= []).push(`${column_name} ${data_type}`);
    }
    return views;
  }

  it('has the columns the report reads, as plain types, and nothing private', async () => {
    const at = 'timestamp with time zone';

    // Only the views the Reports popup reads: the Power BI report's queues
    // and messages views are gone (#1049).
    expect(await viewColumns()).toEqual({
      teams: ['team_id text', 'name text', 'lead_id character varying'],
      tickets: [
        'ticket_number integer',
        'status text',
        'priority text',
        'queue_id text',
        'assignee_id character varying',
        'team_id text',
        `created_at ${at}`,
        `updated_at ${at}`,
        `due_at ${at}`,
        `finished_at ${at}`,
        `first_reply_at ${at}`,
      ],
      users: [
        'user_id character varying',
        'name text',
        'role text',
        'team_id text',
        'active boolean',
      ],
    });
  });

  it('has one row per team, user and ticket', async () => {
    const rows = async (view: string) =>
      (
        await client.query<{ rows: number }>(
          `select count(*)::int as rows from reporting.${view}`
        )
      ).rows[0].rows;

    expect(await rows('teams')).toBe(summary.teams);
    expect(await rows('users')).toBe(summary.users);
    expect(await rows('tickets')).toBe(summary.tickets);
  });

  it('names each team and its lead', async () => {
    const view = await database
      .select()
      .from(reportingTeams)
      .orderBy(asc(reportingTeams.teamId));
    const table = await database.select().from(teams).orderBy(asc(teams.id));

    expect(view).toEqual(
      table.map(({ id, name, supervisorId }) => ({
        teamId: id,
        name,
        leadId: supervisorId,
      }))
    );
    expect(view.every(({ leadId }) => leadId !== null)).toBe(true);
  });

  it('lists users with their role as text, and no password hashes', async () => {
    const view = await database
      .select()
      .from(reportingUsers)
      .orderBy(asc(reportingUsers.userId));
    const table = await database.select().from(users).orderBy(asc(users.id));

    expect(view).toEqual(
      table.map(({ id, name, role, teamId, active }) => ({
        userId: id,
        name,
        role,
        teamId,
        active,
      }))
    );
  });

  describe('tickets', () => {
    /** The view's tickets beside the tables' own, by ticket number. */
    async function both() {
      const view = await database
        .select()
        .from(reportingTickets)
        .orderBy(asc(reportingTickets.ticketNumber));
      const table = await database
        .select({ ticket: tickets, assigneeTeamId: users.teamId })
        .from(tickets)
        .leftJoin(users, eq(users.id, tickets.assigneeId))
        .orderBy(asc(tickets.ticketNumber));
      return { view, table };
    }

    it('copies each ticket, with its due time', async () => {
      const { view, table } = await both();

      expect(
        view.map(
          ({
            ticketNumber,
            status,
            priority,
            queueId,
            assigneeId,
            createdAt,
            updatedAt,
            dueAt,
          }) => ({
            ticketNumber,
            status,
            priority,
            queueId,
            assigneeId,
            createdAt,
            updatedAt,
            dueAt,
          })
        )
      ).toEqual(
        table.map(({ ticket }) => ({
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          priority: ticket.priority,
          queueId: ticket.queueId,
          assigneeId: ticket.assigneeId,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          dueAt: ticket.slaDueAt,
        }))
      );
    });

    it("puts each ticket on its assignee's team, and an unassigned one on none", async () => {
      const { view, table } = await both();

      expect(view.some(({ assigneeId }) => assigneeId === null)).toBe(true);
      expect(view.map(({ teamId }) => teamId)).toEqual(
        table.map(({ ticket, assigneeTeamId }) =>
          ticket.assigneeId === null ? null : assigneeTeamId
        )
      );
    });

    it('gives resolved and closed tickets the time they were finished, open work none (#1020)', async () => {
      const { view, table } = await both();

      expect(view.some(({ finishedAt }) => finishedAt !== null)).toBe(true);
      expect(view.some(({ finishedAt }) => finishedAt === null)).toBe(true);
      expect(view.map(({ finishedAt }) => finishedAt)).toEqual(
        table.map(({ ticket }) => ticket.finishedAt)
      );
      for (const { status, finishedAt } of view) {
        expect(finishedAt === null).toBe(
          status !== 'resolved' && status !== 'closed'
        );
      }
    });

    it('gives the first reply to the customer, not counting notes', async () => {
      const { view } = await both();
      const messages = await database
        .select({
          ticketNumber: tickets.ticketNumber,
          kind: ticketMessages.kind,
          createdAt: ticketMessages.createdAt,
        })
        .from(ticketMessages)
        .innerJoin(tickets, eq(tickets.id, ticketMessages.ticketId))
        .orderBy(asc(ticketMessages.createdAt));
      const firstReply = new Map<number, Date>();
      const firstMessageIsNote = new Set<number>();
      const seen = new Set<number>();
      for (const { ticketNumber, kind, createdAt } of messages) {
        if (!seen.has(ticketNumber)) {
          seen.add(ticketNumber);
          if (kind === 'note') {
            firstMessageIsNote.add(ticketNumber);
          }
        }
        if (kind === 'reply' && !firstReply.has(ticketNumber)) {
          firstReply.set(ticketNumber, createdAt);
        }
      }

      // The seed has tickets whose conversation starts with a note.
      expect(firstMessageIsNote.size).toBeGreaterThan(0);
      expect(view.some(({ firstReplyAt }) => firstReplyAt === null)).toBe(true);
      for (const { ticketNumber, firstReplyAt } of view) {
        expect(firstReplyAt).toEqual(firstReply.get(ticketNumber) ?? null);
      }
    });
  });
});
