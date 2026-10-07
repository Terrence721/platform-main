import { PGlite } from '@electric-sql/pglite';
import type { CurrentUser, Role } from '@helpdesk/contract';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import type { Database } from '../database/database-token';
import { customers, queues, teams, tickets, users } from '../database/schema';
import { TicketMessagesService } from '../tickets/ticket-messages.service';
import { TicketsService } from '../tickets/tickets.service';
import { UsersService } from '../users/users.service';
import { LiveEvents, type LiveNotice } from './live-events';

// What each write tells the open pages (#950): the event, and who it
// concerns. The rules for who hears what are in live-events.spec.

/** The real migrations, so the tests run against the real schema. */
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** Atlas (Chris leads; Sam, Benny), Beacon (Nina leads; Bea), and Alex. */
const PEOPLE: { id: string; role: Role; teamId: string | null }[] = [
  { id: 'alex.morgan', role: 'admin', teamId: null },
  { id: 'chris.taylor', role: 'supervisor', teamId: 'atlas' },
  { id: 'nina.patel', role: 'supervisor', teamId: 'beacon' },
  { id: 'sam.rivera', role: 'agent', teamId: 'atlas' },
  { id: 'benny.lind', role: 'agent', teamId: 'atlas' },
  { id: 'bea.quinn', role: 'agent', teamId: 'beacon' },
];

/** Who signs in as whom, by user ID. */
const as = (id: string): CurrentUser => {
  const person = PEOPLE.find((candidate) => candidate.id === id);
  if (person === undefined) {
    throw new Error(`No ${id} in the data`);
  }
  return { id, name: id, role: person.role, teamId: person.teamId };
};

describe('what each write tells the open pages', { timeout: 60_000 }, () => {
  let client: PGlite;
  let live: LiveEvents;
  let published: LiveNotice[];
  let ticketsService: TicketsService;
  let messages: TicketMessagesService;
  let accounts: UsersService;
  /** The tickets' ids: one unassigned, one Sam holds, one finished. */
  const ids = { unassigned: '', heldBySam: '', finished: '' };

  // A fresh database for each test, as each one changes things.
  beforeEach(async () => {
    client = new PGlite();
    const database = drizzle(client);
    await migrate(database, { migrationsFolder: MIGRATIONS });
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
    await database.insert(queues).values({ id: 'accounts', name: 'Accounts' });
    const [customer] = await database
      .insert(customers)
      .values({ name: 'Dana Whitfield', email: 'dana.whitfield@example.com' })
      .returning({ id: customers.id });
    const ticket = (
      subject: string,
      status: 'new' | 'open' | 'closed',
      assigneeId: string | null
    ) => ({
      subject,
      description: subject,
      status,
      priority: 'normal' as const,
      requesterId: customer.id,
      queueId: 'accounts',
      assigneeId,
    });
    [{ id: ids.unassigned }, { id: ids.heldBySam }, { id: ids.finished }] =
      await database
        .insert(tickets)
        .values([
          ticket('unassigned', 'new', null),
          ticket("Sam's", 'open', 'sam.rivera'),
          ticket('finished', 'closed', null),
        ])
        .returning({ id: tickets.id });

    live = new LiveEvents();
    published = [];
    vi.spyOn(live, 'publish').mockImplementation((notice) => {
      published.push(notice);
    });
    const db: Database = database;
    ticketsService = new TicketsService(db, live);
    messages = new TicketMessagesService(db, live);
    accounts = new UsersService(db, live);
  }, 60_000);

  afterEach(() => client.close());

  describe('tickets', () => {
    it('taking unassigned work concerns everyone, and its new holder', async () => {
      await ticketsService.take(ids.unassigned, 'sam.rivera');

      expect(published).toEqual([
        {
          event: { type: 'ticket', ticketId: ids.unassigned },
          audience: {
            kind: 'ticket',
            holderIds: ['sam.rivera'],
            teamIds: ['atlas'],
            unassigned: true,
          },
        },
      ]);
    });

    it('taking a ticket you already hold tells no one: nothing changed', async () => {
      await ticketsService.take(ids.heldBySam, 'sam.rivera');

      expect(published).toEqual([]);
    });

    it('a refused change tells no one', async () => {
      await expect(
        ticketsService.take(ids.finished, 'sam.rivera')
      ).rejects.toThrow();

      expect(published).toEqual([]);
    });

    it('assigning unassigned work concerns everyone, and the agent', async () => {
      await ticketsService.assign(ids.unassigned, 'benny.lind', 'chris.taylor');

      expect(published).toEqual([
        {
          event: { type: 'ticket', ticketId: ids.unassigned },
          audience: {
            kind: 'ticket',
            holderIds: ['benny.lind'],
            teamIds: ['atlas'],
            unassigned: true,
          },
        },
      ]);
    });

    it('reassigning concerns the agent who had it and the one who has it', async () => {
      await ticketsService.assign(ids.heldBySam, 'benny.lind', 'chris.taylor');

      expect(published).toHaveLength(1);
      expect(published[0].audience).toEqual({
        kind: 'ticket',
        holderIds: expect.arrayContaining(['benny.lind', 'sam.rivera']),
        teamIds: ['atlas'],
        unassigned: false,
      });
    });

    it('a status change concerns its holder and their team', async () => {
      await ticketsService.changeStatus(
        ids.heldBySam,
        'pending',
        as('sam.rivera')
      );

      expect(published).toEqual([
        {
          event: { type: 'ticket', ticketId: ids.heldBySam },
          audience: {
            kind: 'ticket',
            holderIds: ['sam.rivera'],
            teamIds: ['atlas'],
            unassigned: false,
          },
        },
      ]);
    });
  });

  it('a reply concerns the ticket holder and their team', async () => {
    await messages.add(
      ids.heldBySam,
      { kind: 'reply', body: 'On it.' },
      as('chris.taylor')
    );

    expect(published).toEqual([
      {
        event: { type: 'message', ticketId: ids.heldBySam },
        audience: {
          kind: 'ticket',
          holderIds: ['sam.rivera'],
          teamIds: ['atlas'],
          unassigned: false,
        },
      },
    ]);
  });

  describe('accounts', () => {
    const accountsChanged: LiveNotice = {
      event: { type: 'accounts' },
      audience: { kind: 'accounts' },
    };

    it('creating one concerns the people who manage accounts', async () => {
      await accounts.create({
        userId: 'nia.new',
        name: 'Nia New',
        role: 'agent',
        teamId: 'atlas',
        password: 'a-starting-password',
      });

      expect(published).toEqual([accountsChanged]);
    });

    it("an edit that hands work back announces each ticket as unassigned, on the holder's old team", async () => {
      // Sam moves to Beacon: his open ticket goes back to Atlas's Unassigned.
      await accounts.update(
        'sam.rivera',
        { role: 'agent', teamId: 'beacon', active: true },
        'alex.morgan'
      );

      expect(published).toEqual([
        accountsChanged,
        {
          event: { type: 'ticket', ticketId: ids.heldBySam },
          audience: {
            kind: 'ticket',
            holderIds: ['sam.rivera'],
            teamIds: ['atlas'],
            unassigned: true,
          },
        },
      ]);
    });

    // Their open streams judge by the account as it was, so they end, and
    // the browser reconnects under the new role and team, or not at all
    // (#1073).
    it("an edit ends the edited person's open streams", async () => {
      const ended = vi.spyOn(live, 'endStreamsOf');

      await accounts.update(
        'sam.rivera',
        { role: 'agent', teamId: 'atlas', active: false },
        'alex.morgan'
      );

      expect(ended.mock.calls).toEqual([['sam.rivera']]);
    });

    it("a refused edit ends no one's streams", async () => {
      const ended = vi.spyOn(live, 'endStreamsOf');

      await expect(
        accounts.update(
          'sam.rivera',
          { role: 'agent', teamId: 'nowhere', active: true },
          'alex.morgan'
        )
      ).rejects.toMatchObject({ status: 400 });

      expect(ended).not.toHaveBeenCalled();
    });
  });
});
