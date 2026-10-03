import { PGlite } from '@electric-sql/pglite';
import type { Role, TicketStatus } from '@helpdesk/contract';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import type { Database } from '../database/database.module';
import { customers, queues, teams, tickets, users } from '../database/schema';
import { TeamsService } from './teams.service';

/** The real migrations, so the tests run against the real schema. */
const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** "Now" for these tests: overdue means due before this. */
const NOW = new Date('2026-10-03T12:00:00.000Z');

/** Atlas (Chris) and Beacon (Nina), and who is on them. */
const PEOPLE: {
  id: string;
  name: string;
  role: Role;
  teamId: string | null;
}[] = [
  {
    id: 'chris.taylor',
    name: 'Chris Taylor',
    role: 'supervisor',
    teamId: 'atlas',
  },
  { id: 'sam.rivera', name: 'Sam Rivera', role: 'agent', teamId: 'atlas' },
  { id: 'benny.lind', name: 'Benny Lind', role: 'agent', teamId: 'atlas' },
  { id: 'ida.idle', name: 'Ida Idle', role: 'agent', teamId: 'atlas' },
  {
    id: 'nina.patel',
    name: 'Nina Patel',
    role: 'supervisor',
    teamId: 'beacon',
  },
  { id: 'omar.other', name: 'Omar Other', role: 'agent', teamId: 'beacon' },
  { id: 'alex.morgan', name: 'Alex Morgan', role: 'admin', teamId: null },
];

/**
 * Inserted in this order, so they get ticket numbers 1001, 1002, ... in
 * this order. Due times are before NOW (overdue), after it, or none.
 */
const TICKETS: {
  subject: string;
  assigneeId: string | null;
  status: TicketStatus;
  slaDueAt: string | null;
  queueId?: string;
}[] = [
  // #1001-#1003: Sam
  {
    subject: 'Sam overdue',
    assigneeId: 'sam.rivera',
    status: 'open',
    slaDueAt: '2026-10-02T12:00:00Z',
  },
  {
    subject: 'Sam due later',
    assigneeId: 'sam.rivera',
    status: 'pending',
    slaDueAt: '2026-10-04T12:00:00Z',
  },
  {
    subject: 'Sam resolved, was overdue',
    assigneeId: 'sam.rivera',
    status: 'resolved',
    slaDueAt: '2026-09-30T12:00:00Z',
  },
  // #1004-#1005: Benny
  {
    subject: 'Benny most overdue',
    assigneeId: 'benny.lind',
    status: 'new',
    slaDueAt: '2026-09-29T12:00:00Z',
  },
  {
    subject: 'Benny no SLA',
    assigneeId: 'benny.lind',
    status: 'open',
    slaDueAt: null,
  },
  // #1006: the supervisor's own, overdue
  {
    subject: 'Chris overdue',
    assigneeId: 'chris.taylor',
    status: 'open',
    slaDueAt: '2026-10-01T12:00:00Z',
  },
  // #1007: the other team, overdue
  {
    subject: 'Omar overdue',
    assigneeId: 'omar.other',
    status: 'open',
    slaDueAt: '2026-10-01T12:00:00Z',
  },
  // #1008-#1011: unassigned
  {
    subject: 'Unassigned due later',
    assigneeId: null,
    status: 'new',
    slaDueAt: '2026-10-05T12:00:00Z',
  },
  {
    subject: 'Unassigned overdue, billing',
    assigneeId: null,
    status: 'new',
    slaDueAt: '2026-10-02T12:00:00Z',
    queueId: 'billing',
  },
  {
    subject: 'Unassigned closed',
    assigneeId: null,
    status: 'closed',
    slaDueAt: '2026-09-01T12:00:00Z',
  },
  {
    subject: 'Unassigned no SLA',
    assigneeId: null,
    status: 'new',
    slaDueAt: null,
  },
];

describe('TeamsService', () => {
  let client: PGlite;
  let service: TeamsService;

  beforeAll(async () => {
    client = new PGlite();
    const database = drizzle(client);
    await migrate(database, { migrationsFolder: MIGRATIONS });

    await database.insert(queues).values([
      { id: 'accounts', name: 'Accounts' },
      { id: 'billing', name: 'Billing' },
    ]);
    const [customer] = await database
      .insert(customers)
      .values({ name: 'Dana Whitfield', email: 'dana.whitfield@example.com' })
      .returning({ id: customers.id });
    // Teams and users point at each other: teams first, then their people,
    // then each team's supervisor.
    await database.insert(teams).values([
      { id: 'atlas', name: 'Atlas' },
      { id: 'beacon', name: 'Beacon' },
    ]);
    await database
      .insert(users)
      .values(PEOPLE.map((person) => ({ ...person, passwordHash: 'x' })));
    await database
      .update(teams)
      .set({ supervisorId: 'chris.taylor' })
      .where(eq(teams.id, 'atlas'));
    await database
      .update(teams)
      .set({ supervisorId: 'nina.patel' })
      .where(eq(teams.id, 'beacon'));
    for (const ticket of TICKETS) {
      await database.insert(tickets).values({
        subject: ticket.subject,
        description: `About: ${ticket.subject}`,
        status: ticket.status,
        priority: 'normal',
        requesterId: customer.id,
        assigneeId: ticket.assigneeId,
        queueId: ticket.queueId ?? 'accounts',
        slaDueAt: ticket.slaDueAt === null ? null : new Date(ticket.slaDueAt),
      });
    }

    // The service is typed for the node-postgres driver; both are Drizzle's
    // Postgres databases with the same query builder.
    service = new TeamsService(database as unknown as Database);
  }, 60_000);

  afterAll(() => client.close());

  const overview = () => service.overviewFor('chris.taylor', NOW);

  it('has nothing for someone who leads no team', async () => {
    expect(await service.overviewFor('alex.morgan', NOW)).toBeNull();
  });

  it("names the supervisor's own team", async () => {
    expect(await overview()).toEqual(
      expect.objectContaining({ id: 'atlas', name: 'Atlas' })
    );
  });

  it('lists the agents by name with their open and overdue work, the idle one at 0', async () => {
    expect((await overview())?.members).toEqual([
      // Benny: new (overdue) + open (no SLA, so not overdue).
      {
        id: 'benny.lind',
        name: 'Benny Lind',
        openTickets: 2,
        overdueTickets: 1,
      },
      // Ida: nothing at all.
      { id: 'ida.idle', name: 'Ida Idle', openTickets: 0, overdueTickets: 0 },
      // Sam: open (overdue) + pending (due later). His resolved ticket,
      // though past its due time, is not open work, so neither counts it.
      {
        id: 'sam.rivera',
        name: 'Sam Rivera',
        openTickets: 2,
        overdueTickets: 1,
      },
      // Chris, the supervisor, is not a member row, so his own overdue
      // ticket counts nowhere.
    ]);
  });

  it('lists every unassigned open ticket, from any queue, most urgent first', async () => {
    const unassigned = (await overview())?.unassigned ?? [];

    expect(unassigned.map(({ ticketNumber }) => ticketNumber)).toEqual([
      1009, // overdue, in Billing
      1008, // due later
      1011, // no SLA
    ]);
    expect(unassigned.every(({ assignee }) => assignee === null)).toBe(true);
  });

  it("sends no agent's own tickets: those come one agent at a time", async () => {
    expect(Object.keys((await overview()) ?? {}).sort()).toEqual([
      'id',
      'members',
      'name',
      'unassigned',
    ]);
  });

  describe('agentLedBy', () => {
    it("finds an agent on the supervisor's own team", async () => {
      expect(await service.agentLedBy('chris.taylor', 'sam.rivera')).toEqual({
        id: 'sam.rivera',
        name: 'Sam Rivera',
      });
    });

    it.each([
      ['an agent on another team', 'chris.taylor', 'omar.other'],
      [
        'the supervisor, asking about their own user ID',
        'chris.taylor',
        'chris.taylor',
      ],
      ["another team's supervisor", 'chris.taylor', 'nina.patel'],
      ['an agent, to a supervisor of another team', 'nina.patel', 'sam.rivera'],
      ['an agent, to an admin who leads no team', 'alex.morgan', 'sam.rivera'],
      ['an admin', 'chris.taylor', 'alex.morgan'],
      ['a user ID nobody has', 'chris.taylor', 'no.such.user'],
    ])('does not find %s', async (_, supervisorId, userId) => {
      expect(await service.agentLedBy(supervisorId, userId)).toBeNull();
    });
  });
});
