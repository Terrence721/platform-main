import { PGlite } from '@electric-sql/pglite';
import type { CurrentUser, Role, TicketStatus } from '@helpdesk/contract';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import type { Database } from '../database/database.module';
import {
  customers,
  queues,
  teams,
  ticketMessages,
  tickets,
  users,
} from '../database/schema';
import { TicketMessagesService } from './ticket-messages.service';

/** The real migrations, so the tests run against the real schema. */
const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

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
  samResolved: { status: 'resolved', assigneeId: 'sam.rivera' },
  samClosed: { status: 'closed', assigneeId: 'sam.rivera' },
  unassigned: { status: 'open', assigneeId: null },
} satisfies Record<string, { status: TicketStatus; assigneeId: string | null }>;

type TicketName = keyof typeof TICKETS;

/** When every ticket last changed, before the tests touch it. */
const LAST_CHANGED = new Date('2026-10-01T08:00:00.000Z');

describe('TicketMessagesService', { timeout: 30_000 }, () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle>;
  let service: TicketMessagesService;
  /** Each named ticket's id. */
  let ids: Record<TicketName, string>;

  /** A new database with the people, the tickets and Sam's conversation. */
  const freshDatabase = async () => {
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
          status: ticket.status as TicketStatus,
          updatedAt: LAST_CHANGED,
        })
        .returning({ id: tickets.id });
      ids[name as TicketName] = id;
    }

    // Sam's open ticket has a conversation, stored newest first so the
    // tests see it come back in time order.
    await database.insert(ticketMessages).values([
      {
        ticketId: ids.samOpen,
        authorId: 'chris.taylor',
        kind: 'note',
        body: 'Key account; keep them updated.',
        createdAt: new Date('2026-10-01T07:00:00.000Z'),
      },
      {
        ticketId: ids.samOpen,
        authorId: 'sam.rivera',
        kind: 'reply',
        body: 'Which browser are you using?',
        createdAt: new Date('2026-10-01T06:00:00.000Z'),
      },
    ]);

    // The service is typed for the node-postgres driver; both are Drizzle's
    // Postgres databases with the same query builder.
    service = new TicketMessagesService(database as unknown as Database);
  };

  /** The stored ticket, straight from the table. */
  const stored = async (name: TicketName) =>
    (await database.select().from(tickets).where(eq(tickets.id, ids[name])))[0];

  /** The stored messages on a ticket, straight from the table. */
  const messagesOn = (name: TicketName) =>
    database
      .select()
      .from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ids[name]));

  /** Every way of not reaching Sam's tickets, as [who, ticket, user]. */
  const HIDDEN = [
    ['another agent on the team', 'samOpen', 'benny.lind'],
    ["another team's agent", 'samOpen', 'omar.other'],
    ["another team's supervisor", 'samOpen', 'nina.patel'],
    ['an admin', 'samOpen', 'alex.morgan'],
    ['anyone, for an unassigned ticket', 'unassigned', 'chris.taylor'],
  ] as const;

  describe('conversation', () => {
    // These only read, so they share one database.
    beforeAll(freshDatabase, 60_000);
    afterAll(() => client.close());

    it('lists the messages oldest first, with their authors', async () => {
      expect(await service.conversation(ids.samOpen, as('sam.rivera'))).toEqual(
        [
          {
            id: expect.any(String),
            kind: 'reply',
            body: 'Which browser are you using?',
            author: { id: 'sam.rivera', name: 'sam.rivera' },
            createdAt: '2026-10-01T06:00:00.000Z',
          },
          {
            id: expect.any(String),
            kind: 'note',
            body: 'Key account; keep them updated.',
            author: { id: 'chris.taylor', name: 'chris.taylor' },
            createdAt: '2026-10-01T07:00:00.000Z',
          },
        ]
      );
    });

    it("lets the agent's supervisor read it too", async () => {
      expect(
        await service.conversation(ids.samOpen, as('chris.taylor'))
      ).toHaveLength(2);
    });

    it('is empty for a ticket nobody has written on', async () => {
      expect(
        await service.conversation(ids.samResolved, as('sam.rivera'))
      ).toEqual([]);
    });

    it.each(HIDDEN)('hides the ticket from %s (404)', async (_, name, by) => {
      await expect(
        service.conversation(ids[name], as(by))
      ).rejects.toMatchObject({
        status: 404,
        message: 'No such ticket among yours.',
      });
    });

    it.each([
      ['an id that is no ticket', '7d0f6c2e-4b1a-4c3e-9a51-2f8d6e0b1c34'],
      ['an id that is not even a UUID', 'not-a-ticket'],
    ])('answers 404 for %s', async (_, ticketId) => {
      await expect(
        service.conversation(ticketId, as('sam.rivera'))
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('add', () => {
    // Each of these writes, so each gets a database of its own.
    beforeEach(freshDatabase, 60_000);
    afterEach(() => client.close());

    it('adds a reply from the agent who holds the ticket, last in the conversation', async () => {
      const message = await service.add(
        ids.samOpen,
        { kind: 'reply', body: 'Fixed on our side; please try again.' },
        as('sam.rivera')
      );

      expect(message).toEqual({
        id: expect.any(String),
        kind: 'reply',
        body: 'Fixed on our side; please try again.',
        author: { id: 'sam.rivera', name: 'sam.rivera' },
        createdAt: expect.any(String),
      });
      const conversation = await service.conversation(
        ids.samOpen,
        as('sam.rivera')
      );
      expect(conversation).toHaveLength(3);
      expect(conversation[2]).toEqual(message);
    });

    it("adds a note from the agent's supervisor, as its author", async () => {
      const message = await service.add(
        ids.samOpen,
        { kind: 'note', body: 'Escalate if no answer by Friday.' },
        as('chris.taylor')
      );

      expect(message).toMatchObject({
        kind: 'note',
        author: { id: 'chris.taylor' },
      });
    });

    it('marks the ticket as changed', async () => {
      await service.add(
        ids.samOpen,
        { kind: 'note', body: 'Checked the logs.' },
        as('sam.rivera')
      );

      expect((await stored('samOpen')).updatedAt.getTime()).toBeGreaterThan(
        LAST_CHANGED.getTime()
      );
    });

    it('still takes messages on a resolved ticket', async () => {
      await service.add(
        ids.samResolved,
        { kind: 'reply', body: 'Did that fix it?' },
        as('sam.rivera')
      );

      expect(await messagesOn('samResolved')).toHaveLength(1);
    });

    it('refuses a closed ticket with 409, writing nothing', async () => {
      const before = await stored('samClosed');

      await expect(
        service.add(
          ids.samClosed,
          { kind: 'reply', body: 'One more thing.' },
          as('sam.rivera')
        )
      ).rejects.toMatchObject({
        status: 409,
        message: "A closed ticket can't change.",
      });
      expect(await messagesOn('samClosed')).toEqual([]);
      expect(await stored('samClosed')).toEqual(before);
    });

    it.each(HIDDEN)(
      'hides the ticket from %s (404), writing nothing',
      async (_, name, by) => {
        const before = await messagesOn(name);

        await expect(
          service.add(ids[name], { kind: 'note', body: 'Hello.' }, as(by))
        ).rejects.toMatchObject({
          status: 404,
          message: 'No such ticket among yours.',
        });
        expect(await messagesOn(name)).toEqual(before);
      }
    );
  });
});
