import { PGlite } from '@electric-sql/pglite';
import {
  LAST_ADMIN_MESSAGE,
  OWN_ACCOUNT_MESSAGE,
  type Role,
  type TicketStatus,
  type UpdateAccountRequest,
} from '@helpdesk/contract';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import { customers, queues, teams, tickets, users } from '../database/schema';
import { UsersService } from './users.service';

/** The real migrations, so the tests run against the real schema. */
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** Atlas is led by Chris (Sam, Benny); Beacon by Nina. Two admins. */
const PEOPLE: { id: string; role: Role; teamId: string | null }[] = [
  { id: 'alex.morgan', role: 'admin', teamId: null },
  { id: 'priya.shah', role: 'admin', teamId: null },
  { id: 'chris.taylor', role: 'supervisor', teamId: 'atlas' },
  { id: 'nina.patel', role: 'supervisor', teamId: 'beacon' },
  { id: 'sam.rivera', role: 'agent', teamId: 'atlas' },
  { id: 'benny.lind', role: 'agent', teamId: 'atlas' },
];

/** Who holds which ticket, by status: Sam's open work and history, Benny's. */
const TICKETS: [string, TicketStatus, string][] = [
  ['samOpen', 'open', 'sam.rivera'],
  ['samPending', 'pending', 'sam.rivera'],
  ['samResolved', 'resolved', 'sam.rivera'],
  ['samClosed', 'closed', 'sam.rivera'],
  ['bennyOpen', 'open', 'benny.lind'],
];

describe('UsersService.update', { timeout: 60_000 }, () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle>;
  let service: UsersService;

  // A fresh database for each test, as each one changes accounts.
  beforeEach(async () => {
    client = new PGlite();
    database = drizzle(client);
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
    await database.insert(tickets).values(
      TICKETS.map(([subject, status, assigneeId]) => ({
        subject,
        description: subject,
        status,
        priority: 'normal' as const,
        requesterId: customer.id,
        queueId: 'accounts',
        assigneeId,
      }))
    );

    service = new UsersService(database);
  }, 60_000);

  afterEach(() => client.close());

  /** Changes `userId` as Alex, the admin, would. */
  const update = (userId: string, request: UpdateAccountRequest) =>
    service.update(userId, request, 'alex.morgan');

  /** Who holds each ticket now, by subject. */
  const holders = async () =>
    Object.fromEntries(
      (
        await database
          .select({ subject: tickets.subject, assigneeId: tickets.assigneeId })
          .from(tickets)
      ).map(({ subject, assigneeId }) => [subject, assigneeId])
    );

  /** Who leads each team now. */
  const leads = async () =>
    Object.fromEntries(
      (
        await database
          .select({ id: teams.id, lead: teams.supervisorId })
          .from(teams)
      ).map(({ id, lead }) => [id, lead])
    );

  describe('refusals, which change nothing', () => {
    it("refuses an admin's own account (409)", async () => {
      await expect(
        update('alex.morgan', { role: 'agent', teamId: 'atlas', active: true })
      ).rejects.toMatchObject({ status: 409, message: OWN_ACCOUNT_MESSAGE });
    });

    it('answers 404 for an account that does not exist', async () => {
      await expect(
        update('no.one', { role: 'agent', teamId: 'atlas', active: true })
      ).rejects.toMatchObject({ status: 404, message: 'No such account.' });
    });

    it.each([
      [
        'an admin on a team',
        { role: 'admin', teamId: 'atlas', active: true },
        'An admin belongs to no team.',
      ],
      [
        'an agent without a team',
        { role: 'agent', teamId: null, active: true },
        'Choose a team.',
      ],
      [
        'a team that does not exist',
        { role: 'agent', teamId: 'nowhere', active: true },
        'That team does not exist.',
      ],
    ] as const)('refuses %s (400)', async (_, request, message) => {
      const before = await holders();

      await expect(update('sam.rivera', request)).rejects.toMatchObject({
        status: 400,
        message,
      });
      expect(await holders()).toEqual(before);
    });

    it('never removes the last active admin (409)', async () => {
      await database
        .update(users)
        .set({ active: false })
        .where(eq(users.id, 'alex.morgan'));

      await expect(
        update('priya.shah', { role: 'admin', teamId: null, active: false })
      ).rejects.toMatchObject({ status: 409, message: LAST_ADMIN_MESSAGE });
      await expect(
        update('priya.shah', { role: 'agent', teamId: 'atlas', active: true })
      ).rejects.toMatchObject({ status: 409, message: LAST_ADMIN_MESSAGE });
    });

    it('lets one admin go while another stays', async () => {
      const { account } = await update('priya.shah', {
        role: 'admin',
        teamId: null,
        active: false,
      });

      expect(account).toMatchObject({ id: 'priya.shah', active: false });
    });
  });

  describe('open tickets', () => {
    it.each([
      ['deactivated', { role: 'agent', teamId: 'atlas', active: false }],
      [
        'moved to another team',
        { role: 'agent', teamId: 'beacon', active: true },
      ],
      ['made an admin', { role: 'admin', teamId: null, active: true }],
      // Supervisors don't work tickets, and reassigning takes only an
      // agent's, so kept tickets would be stuck (#1009).
      [
        'made a supervisor of the same team',
        { role: 'supervisor', teamId: 'atlas', active: true },
      ],
    ] as const)(
      'go back to Unassigned when the holder is %s; finished ones stay',
      async (_, request) => {
        const { releasedTickets } = await update('sam.rivera', request);

        expect(releasedTickets).toBe(2);
        expect(await holders()).toEqual({
          samOpen: null,
          samPending: null,
          samResolved: 'sam.rivera',
          samClosed: 'sam.rivera',
          bennyOpen: 'benny.lind',
        });
      }
    );

    it('stay with an agent still working the same team', async () => {
      const before = await holders();

      const { releasedTickets } = await update('sam.rivera', {
        role: 'agent',
        teamId: 'atlas',
        active: true,
      });

      expect(releasedTickets).toBe(0);
      expect(await holders()).toEqual(before);
    });
  });

  describe('the team lead', () => {
    it.each([
      ['deactivated', { role: 'supervisor', teamId: 'atlas', active: false }],
      ['made an agent', { role: 'agent', teamId: 'atlas', active: true }],
    ] as const)(
      'leaves the team with no lead when the lead is %s',
      async (_, request) => {
        const { account } = await update('chris.taylor', request);

        expect(account.leadsTeam).toBe(false);
        expect(await leads()).toEqual({ atlas: null, beacon: 'nina.patel' });
      }
    );

    it('takes the lead of their new team when a lead moves, leaving the old one with none', async () => {
      const { account } = await update('chris.taylor', {
        role: 'supervisor',
        teamId: 'beacon',
        active: true,
      });

      expect(account).toMatchObject({
        team: { id: 'beacon', name: 'Beacon' },
        leadsTeam: true,
      });
      expect(await leads()).toEqual({ atlas: null, beacon: 'chris.taylor' });
    });

    it('makes someone newly a supervisor the lead, the old lead staying a supervisor', async () => {
      const { account } = await update('sam.rivera', {
        role: 'supervisor',
        teamId: 'atlas',
        active: true,
      });

      expect(account).toEqual({
        id: 'sam.rivera',
        name: 'sam.rivera',
        role: 'supervisor',
        team: { id: 'atlas', name: 'Atlas' },
        leadsTeam: true,
        active: true,
      });
      expect(await leads()).toEqual({
        atlas: 'sam.rivera',
        beacon: 'nina.patel',
      });
      const [chris] = await database
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, 'chris.taylor'));
      expect(chris.role).toBe('supervisor');
    });

    it('does not make an inactive supervisor a lead', async () => {
      await update('sam.rivera', {
        role: 'supervisor',
        teamId: 'beacon',
        active: false,
      });

      expect(await leads()).toEqual({
        atlas: 'chris.taylor',
        beacon: 'nina.patel',
      });
    });
  });
});
