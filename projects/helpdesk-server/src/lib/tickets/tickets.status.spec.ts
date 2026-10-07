import { PGlite } from '@electric-sql/pglite';
import type { CurrentUser, Role, TicketStatus } from '@helpdesk/contract';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import { customers, queues, teams, tickets, users } from '../database/schema';
import { TicketsService } from './tickets.service';

/** The real migrations, so the tests run against the real schema. */
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** "Now" for the Done list: finished within 24 hours of this. */
const NOW = new Date('2026-10-04T12:00:00.000Z');

/** Atlas is Chris's team (Sam, Benny); Beacon is Nina's (Omar). */
const PEOPLE: { id: string; role: Role; teamId: string | null }[] = [
  { id: 'chris.taylor', role: 'supervisor', teamId: 'atlas' },
  { id: 'sam.rivera', role: 'agent', teamId: 'atlas' },
  { id: 'benny.lind', role: 'agent', teamId: 'atlas' },
  { id: 'nina.patel', role: 'supervisor', teamId: 'beacon' },
  { id: 'omar.other', role: 'agent', teamId: 'beacon' },
  { id: 'alex.morgan', role: 'admin', teamId: null },
];

/** Who each person is, as a signed-in user. */
const as = (id: string): CurrentUser => {
  const person = PEOPLE.find((candidate) => candidate.id === id);
  if (!person) {
    throw new Error(`No ${id} in PEOPLE`);
  }
  return { id, name: id, role: person.role, teamId: person.teamId };
};

/** The tickets, by what each test needs. */
const TICKETS = {
  samOpen: { status: 'open', assigneeId: 'sam.rivera' },
  samNew: { status: 'new', assigneeId: 'sam.rivera' },
  samClosed: {
    status: 'closed',
    assigneeId: 'sam.rivera',
    updatedAt: '2026-09-01T09:00:00.000Z',
  },
  omarOpen: { status: 'open', assigneeId: 'omar.other' },
  unassigned: { status: 'open', assigneeId: null },
  // For the Done list: when each finished ticket last changed.
  samResolvedToday: {
    status: 'resolved',
    assigneeId: 'sam.rivera',
    updatedAt: '2026-10-04T09:00:00.000Z',
  },
  samClosedYesterday: {
    status: 'closed',
    assigneeId: 'sam.rivera',
    updatedAt: '2026-10-03T13:00:00.000Z',
  },
  samResolvedLongAgo: {
    status: 'resolved',
    assigneeId: 'sam.rivera',
    updatedAt: '2026-10-02T09:00:00.000Z',
  },
  bennyResolvedToday: {
    status: 'resolved',
    assigneeId: 'benny.lind',
    updatedAt: '2026-10-04T10:00:00.000Z',
  },
} satisfies Record<
  string,
  { status: TicketStatus; assigneeId: string | null; updatedAt?: string }
>;

type TicketName = keyof typeof TICKETS;

describe('TicketsService: status', { timeout: 30_000 }, () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle>;
  let service: TicketsService;
  /** Each named ticket's id. */
  let ids: Record<TicketName, string>;

  // A fresh database for each test, as each one changes tickets.
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
      const { updatedAt, ...rest } = ticket as {
        status: TicketStatus;
        assigneeId: string | null;
        updatedAt?: string;
      };
      // A finished ticket here was finished when it last changed.
      const finished = rest.status === 'resolved' || rest.status === 'closed';
      const [{ id }] = await database
        .insert(tickets)
        .values({
          subject: name,
          description: name,
          priority: 'normal',
          requesterId: customer.id,
          queueId: 'accounts',
          ...rest,
          ...(updatedAt && { updatedAt: new Date(updatedAt) }),
          ...(updatedAt && finished && { finishedAt: new Date(updatedAt) }),
        })
        .returning({ id: tickets.id });
      ids[name as TicketName] = id;
    }

    service = new TicketsService(database);
  }, 60_000);

  afterEach(() => client.close());

  /** The stored ticket, straight from the table. */
  const stored = async (name: TicketName) =>
    (await database.select().from(tickets).where(eq(tickets.id, ids[name])))[0];

  describe('changeStatus', () => {
    it('lets the agent who holds a ticket move it, as the workflow allows', async () => {
      const ticket = await service.changeStatus(
        ids.samOpen,
        'resolved',
        as('sam.rivera')
      );

      expect(ticket.status).toBe('resolved');
      expect((await stored('samOpen')).status).toBe('resolved');
    });

    it("lets the agent's supervisor move it too", async () => {
      expect(
        (await service.changeStatus(ids.samOpen, 'pending', as('chris.taylor')))
          .status
      ).toBe('pending');
    });

    it('reopens a resolved ticket', async () => {
      expect(
        (
          await service.changeStatus(
            ids.samResolvedToday,
            'open',
            as('sam.rivera')
          )
        ).status
      ).toBe('open');
    });

    it('marks the ticket as changed', async () => {
      const before = (await stored('samOpen')).updatedAt;

      await service.changeStatus(ids.samOpen, 'pending', as('sam.rivera'));

      expect((await stored('samOpen')).updatedAt.getTime()).toBeGreaterThan(
        before.getTime()
      );
    });

    // #1020: reports and the history popup time a finished ticket by when it
    // was finished, so later changes must not move that.
    it('records when a ticket is finished, and forgets it when reopened', async () => {
      expect((await stored('samOpen')).finishedAt).toBeNull();

      await service.changeStatus(ids.samOpen, 'resolved', as('sam.rivera'));
      const resolved = await stored('samOpen');
      expect(resolved.finishedAt).toEqual(resolved.updatedAt);

      await service.changeStatus(ids.samOpen, 'open', as('sam.rivera'));
      expect((await stored('samOpen')).finishedAt).toBeNull();
    });

    it('records when a ticket is closed straight from open work', async () => {
      await service.changeStatus(ids.samNew, 'closed', as('sam.rivera'));

      const closed = await stored('samNew');
      expect(closed.finishedAt).toEqual(closed.updatedAt);
    });

    it('keeps when a resolved ticket was finished when it is closed later', async () => {
      await service.changeStatus(
        ids.samResolvedLongAgo,
        'closed',
        as('sam.rivera')
      );

      expect((await stored('samResolvedLongAgo')).finishedAt).toEqual(
        new Date('2026-10-02T09:00:00.000Z')
      );
    });

    it.each([
      ['another agent on the team', 'samOpen', 'benny.lind'],
      ["another team's agent", 'samOpen', 'omar.other'],
      ["another team's supervisor", 'samOpen', 'nina.patel'],
      ['an admin', 'samOpen', 'alex.morgan'],
      ['anyone, for an unassigned ticket', 'unassigned', 'chris.taylor'],
    ] as const)(
      'hides the ticket from %s (404), changing nothing',
      async (_, name, by) => {
        const before = await stored(name);

        await expect(
          service.changeStatus(ids[name], 'pending', as(by))
        ).rejects.toMatchObject({
          status: 404,
          message: 'No such ticket among yours.',
        });
        expect(await stored(name)).toEqual(before);
      }
    );

    it.each([
      [
        'new to pending',
        'samNew',
        'pending',
        "A new ticket can't become pending.",
      ],
      ['open to new', 'samOpen', 'new', "An open ticket can't become new."],
      ['open to open', 'samOpen', 'open', "An open ticket can't become open."],
      [
        'closed to anything',
        'samClosed',
        'open',
        "A closed ticket can't change.",
      ],
    ] as const)(
      'refuses a move the workflow does not allow (%s), with 409',
      async (_, name, to, message) => {
        const before = await stored(name);

        await expect(
          service.changeStatus(ids[name], to, as('sam.rivera'))
        ).rejects.toMatchObject({ status: 409, message });
        expect(await stored(name)).toEqual(before);
      }
    );

    it.each([
      ['an id that is no ticket', '7d0f6c2e-4b1a-4c3e-9a51-2f8d6e0b1c34'],
      ['an id that is not even a UUID', 'not-a-ticket'],
    ])('answers 404 for %s', async (_, ticketId) => {
      await expect(
        service.changeStatus(ticketId, 'pending', as('sam.rivera'))
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('recentlyFinished', () => {
    it("lists the agent's tickets finished in the last 24 hours, newest first", async () => {
      const done = await service.recentlyFinished('sam.rivera', NOW);

      // Not: resolved two days ago, closed in September, Benny's, or
      // Sam's open and new ones.
      expect(done.map(({ subject }) => subject)).toEqual([
        'samResolvedToday',
        'samClosedYesterday',
      ]);
    });

    it('leaves out a ticket resolved long ago and only closed lately (#1020)', async () => {
      await service.changeStatus(
        ids.samResolvedLongAgo,
        'closed',
        as('sam.rivera')
      );
      const justAfter = new Date(Date.now() + 1000);

      const done = await service.recentlyFinished('sam.rivera', justAfter);

      expect(done.map(({ subject }) => subject)).not.toContain(
        'samResolvedLongAgo'
      );
    });

    it('has nothing for an agent who finished nothing lately', async () => {
      expect(await service.recentlyFinished('omar.other', NOW)).toEqual([]);
    });
  });
});
