import { PGlite } from '@electric-sql/pglite';
import type { CurrentUser, Role, TicketStatus } from '@helpdesk/contract';
import { NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import { customers, queues, teams, tickets, users } from '../database/schema';
import { TicketsService } from './tickets.service';

/** The real migrations, so the tests run against the real schema. */
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** Atlas is Chris's team (Sam, Benny); Beacon is Nina's (Omar). */
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
  {
    id: 'nina.patel',
    name: 'Nina Patel',
    role: 'supervisor',
    teamId: 'beacon',
  },
  { id: 'omar.other', name: 'Omar Other', role: 'agent', teamId: 'beacon' },
];

/** Who each person is, as a signed-in user. */
const as = (id: string): CurrentUser => {
  const person = PEOPLE.find((candidate) => candidate.id === id);
  if (!person) {
    throw new Error(`No ${id} in PEOPLE`);
  }
  return { id, name: person.name, role: person.role, teamId: person.teamId };
};

/** The tickets, by what each test needs. */
const TICKETS = {
  samPending: { status: 'pending', assigneeId: 'sam.rivera' },
  samClosed: { status: 'closed', assigneeId: 'sam.rivera' },
  unassigned: { status: 'new', assigneeId: null },
} satisfies Record<string, { status: TicketStatus; assigneeId: string | null }>;

type TicketName = keyof typeof TICKETS;

describe('TicketsService: one ticket', { timeout: 30_000 }, () => {
  let client: PGlite;
  let service: TicketsService;
  /** Each named ticket's id. */
  let ids: Record<TicketName, string>;

  // One database for every test: they only read.
  beforeAll(async () => {
    client = new PGlite();
    const database = drizzle(client);
    await migrate(database, { migrationsFolder: MIGRATIONS });

    await database.insert(queues).values({ id: 'accounts', name: 'Accounts' });
    const [customer] = await database
      .insert(customers)
      .values({ name: 'Dana Whitfield', email: 'dana.whitfield@example.com' })
      .returning({ id: customers.id });
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

    ids = {} as Record<TicketName, string>;
    for (const [name, ticket] of Object.entries(TICKETS)) {
      const [{ id }] = await database
        .insert(tickets)
        .values({
          subject: name,
          description: name,
          priority: 'high',
          requesterId: customer.id,
          queueId: 'accounts',
          ...ticket,
        })
        .returning({ id: tickets.id });
      ids[name as TicketName] = id;
    }

    service = new TicketsService(database);
  }, 60_000);

  afterAll(() => client.close());

  it('gives the agent who holds a ticket its details, as they are now', async () => {
    const ticket = await service.one(ids.samPending, as('sam.rivera'));

    expect(ticket).toMatchObject({
      id: ids.samPending,
      subject: 'samPending',
      status: 'pending',
      priority: 'high',
      assignee: { id: 'sam.rivera', name: 'Sam Rivera' },
      requester: { name: 'Dana Whitfield' },
      queue: { id: 'accounts', name: 'Accounts' },
    });
  });

  it("gives them to the agent's supervisor too", async () => {
    expect(
      (await service.one(ids.samPending, as('chris.taylor'))).assignee
    ).toEqual({ id: 'sam.rivera', name: 'Sam Rivera' });
  });

  it('gives a finished ticket too', async () => {
    expect((await service.one(ids.samClosed, as('sam.rivera'))).status).toBe(
      'closed'
    );
  });

  it.each([
    ['another agent, on the same team', 'samPending', 'benny.lind'],
    ['another agent, on another team', 'samPending', 'omar.other'],
    ["another team's supervisor", 'samPending', 'nina.patel'],
    ['anyone, for an unassigned ticket', 'unassigned', 'chris.taylor'],
  ] as const)('answers 404 to %s', async (_, ticket, userId) => {
    await expect(service.one(ids[ticket], as(userId))).rejects.toThrow(
      new NotFoundException('No such ticket among yours.')
    );
  });

  it.each([
    ['no such ticket', '00000000-0000-4000-8000-000000000000'],
    ['an id that is not a UUID', 'ticket-1'],
  ])('answers 404 for %s', async (_, ticketId) => {
    await expect(service.one(ticketId, as('sam.rivera'))).rejects.toThrow(
      NotFoundException
    );
  });
});
