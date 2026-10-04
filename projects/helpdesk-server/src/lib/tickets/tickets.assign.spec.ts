import { PGlite } from '@electric-sql/pglite';
import type { Role, TicketStatus } from '@helpdesk/contract';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import type { Database } from '../database/database-token';
import { customers, queues, teams, tickets, users } from '../database/schema';
import { TicketsService } from './tickets.service';

/** The real migrations, so the tests run against the real schema. */
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** Atlas is Chris's team; Beacon is Nina's. */
const PEOPLE: {
  id: string;
  role: Role;
  teamId: string;
  active?: boolean;
}[] = [
  { id: 'chris.taylor', role: 'supervisor', teamId: 'atlas' },
  { id: 'sam.rivera', role: 'agent', teamId: 'atlas' },
  { id: 'benny.lind', role: 'agent', teamId: 'atlas' },
  { id: 'ina.active', role: 'agent', teamId: 'atlas', active: false },
  { id: 'nina.patel', role: 'supervisor', teamId: 'beacon' },
  { id: 'omar.other', role: 'agent', teamId: 'beacon' },
];

/** The tickets, by what each test needs. */
const TICKETS: Record<
  | 'unassignedNew'
  | 'unassignedPending'
  | 'heldBySam'
  | 'finished'
  | 'heldByOmar',
  { status: TicketStatus; assigneeId: string | null }
> = {
  unassignedNew: { status: 'new', assigneeId: null },
  unassignedPending: { status: 'pending', assigneeId: null },
  heldBySam: { status: 'open', assigneeId: 'sam.rivera' },
  finished: { status: 'resolved', assigneeId: null },
  heldByOmar: { status: 'open', assigneeId: 'omar.other' },
};

type TicketName = keyof typeof TICKETS;

// Each test gets a fresh database, as each one changes tickets.
describe('TicketsService.assign', { timeout: 30_000 }, () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle>;
  let service: TicketsService;
  /** Each named ticket's id. */
  let ids: Record<TicketName, string>;

  beforeEach(async () => {
    client = new PGlite();
    database = drizzle(client);
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
    await database.insert(users).values(
      PEOPLE.map((person) => ({
        ...person,
        name: person.id,
        passwordHash: 'x',
      }))
    );
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
          priority: 'normal',
          requesterId: customer.id,
          queueId: 'accounts',
          ...ticket,
        })
        .returning({ id: tickets.id });
      ids[name as TicketName] = id;
    }

    // The service is typed for the node-postgres driver; both are Drizzle's
    // Postgres databases with the same query builder.
    service = new TicketsService(database as unknown as Database);
  }, 60_000);

  afterEach(() => client.close());

  /** The stored ticket, straight from the table. */
  const stored = async (name: TicketName) =>
    (await database.select().from(tickets).where(eq(tickets.id, ids[name])))[0];

  /** Chris (Atlas's supervisor) assigns this ticket to this user. */
  const assign = (name: TicketName, assigneeId: string) =>
    service.assign(ids[name], assigneeId, 'chris.taylor');

  it('assigns an unassigned new ticket, and opens it', async () => {
    const ticket = await assign('unassignedNew', 'sam.rivera');

    expect(ticket.assignee).toEqual({ id: 'sam.rivera', name: 'sam.rivera' });
    expect(ticket.status).toBe('open');
    expect(await stored('unassignedNew')).toEqual(
      expect.objectContaining({ assigneeId: 'sam.rivera', status: 'open' })
    );
  });

  it('keeps any other status as it is', async () => {
    expect((await assign('unassignedPending', 'sam.rivera')).status).toBe(
      'pending'
    );
  });

  it("reassigns a team member's ticket to another agent on the team", async () => {
    const ticket = await assign('heldBySam', 'benny.lind');

    expect(ticket.assignee?.id).toBe('benny.lind');
    expect((await stored('heldBySam')).assigneeId).toBe('benny.lind');
  });

  it('takes assigning to the same agent again in its stride', async () => {
    expect((await assign('heldBySam', 'sam.rivera')).assignee?.id).toBe(
      'sam.rivera'
    );
  });

  it('marks the ticket as changed', async () => {
    const before = (await stored('unassignedNew')).updatedAt;

    await assign('unassignedNew', 'sam.rivera');

    expect((await stored('unassignedNew')).updatedAt.getTime()).toBeGreaterThan(
      before.getTime()
    );
  });

  it.each([
    [
      'an agent on another team',
      'unassignedNew',
      'omar.other',
      404,
      'No such agent on your team.',
    ],
    [
      'an inactive agent',
      'unassignedNew',
      'ina.active',
      404,
      'No such agent on your team.',
    ],
    [
      'a supervisor',
      'unassignedNew',
      'chris.taylor',
      404,
      'No such agent on your team.',
    ],
    [
      'nobody that exists',
      'unassignedNew',
      'no.such.user',
      404,
      'No such agent on your team.',
    ],
    [
      "a ticket another team's agent holds",
      'heldByOmar',
      'sam.rivera',
      404,
      'No such ticket on your team.',
    ],
    [
      'a finished ticket',
      'finished',
      'sam.rivera',
      409,
      "This ticket is finished, so it can't be assigned.",
    ],
  ] as const)(
    'refuses to assign to %s, changing nothing',
    async (_, name, assigneeId, status, message) => {
      const before = await stored(name);

      await expect(assign(name, assigneeId)).rejects.toMatchObject({
        status,
        message,
      });
      expect(await stored(name)).toEqual(before);
    }
  );

  it.each([
    ['an id that is no ticket', '7d0f6c2e-4b1a-4c3e-9a51-2f8d6e0b1c34'],
    ['an id that is not even a UUID', 'not-a-ticket'],
  ])('answers 404 for %s', async (_, ticketId) => {
    await expect(
      service.assign(ticketId, 'sam.rivera', 'chris.taylor')
    ).rejects.toMatchObject({ status: 404, message: 'No such ticket.' });
  });

  it("refuses another team's supervisor an agent who is not theirs", async () => {
    // Nina leads Beacon: Atlas's Sam is not hers to assign to.
    await expect(
      service.assign(ids.unassignedNew, 'sam.rivera', 'nina.patel')
    ).rejects.toMatchObject({ status: 404 });
  });

  describe('unassigned', () => {
    it('lists the unassigned open tickets only', async () => {
      const subjects = (await service.unassigned()).map(
        ({ subject }) => subject
      );

      // Not the finished one, nor those Sam or Omar hold.
      expect(subjects.sort()).toEqual(['unassignedNew', 'unassignedPending']);
    });
  });

  describe('take', () => {
    /** Benny takes this ticket for himself. */
    const take = (name: TicketName) => service.take(ids[name], 'benny.lind');

    it('gives an agent an unassigned new ticket, and opens it', async () => {
      const ticket = await take('unassignedNew');

      expect(ticket.assignee?.id).toBe('benny.lind');
      expect(ticket.status).toBe('open');
      expect(await stored('unassignedNew')).toEqual(
        expect.objectContaining({ assigneeId: 'benny.lind', status: 'open' })
      );
    });

    it('keeps any other status as it is', async () => {
      expect((await take('unassignedPending')).status).toBe('pending');
    });

    it('lets only the first of two agents have it', async () => {
      await take('unassignedNew');

      await expect(
        service.take(ids.unassignedNew, 'sam.rivera')
      ).rejects.toMatchObject({
        status: 409,
        message: 'Someone else has taken this ticket.',
      });
      expect((await stored('unassignedNew')).assigneeId).toBe('benny.lind');
    });

    it('leaves a ticket the agent holds already as theirs', async () => {
      expect(
        (await service.take(ids.heldBySam, 'sam.rivera')).assignee?.id
      ).toBe('sam.rivera');
    });

    it.each([
      [
        'a ticket someone else holds',
        'heldBySam',
        409,
        'Someone else has taken this ticket.',
      ],
      [
        'a finished ticket',
        'finished',
        409,
        "This ticket is finished, so it can't be taken.",
      ],
    ] as const)(
      'refuses %s, changing nothing',
      async (_, name, status, message) => {
        const before = await stored(name);

        await expect(take(name)).rejects.toMatchObject({ status, message });
        expect(await stored(name)).toEqual(before);
      }
    );

    it.each([
      ['an id that is no ticket', '7d0f6c2e-4b1a-4c3e-9a51-2f8d6e0b1c34'],
      ['an id that is not even a UUID', 'not-a-ticket'],
    ])('answers 404 for %s', async (_, ticketId) => {
      await expect(service.take(ticketId, 'benny.lind')).rejects.toMatchObject({
        status: 404,
        message: 'No such ticket.',
      });
    });
  });
});
