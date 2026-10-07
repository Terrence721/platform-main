import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { Client, Pool } from 'pg';
import { fileURLToPath } from 'url';
import { customers, queues, teams, tickets, users } from '../database/schema';
import { TicketsService } from './tickets.service';

// Assigning or taking a ticket while an admin deactivates its agent (#1085).
// Two transactions must really overlap, which PGlite (one connection)
// cannot do, so this runs on real PostgreSQL: the database that
// HELPDESK_RACE_DATABASE_URL names, such as the Docker one
// (postgres://helpdesk:helpdesk-dev-only@localhost:5435/helpdesk). It works
// in a scratch database of its own there, and is skipped without one. CI
// runs it in the Docker job, against the stack's database.

const SERVER_URL = process.env['HELPDESK_RACE_DATABASE_URL'];
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** The same address, for another database on that server. */
const urlFor = (database: string) => {
  const url = new URL(SERVER_URL ?? '');
  url.pathname = `/${database}`;
  return url.toString();
};

describe.skipIf(!SERVER_URL)(
  'TicketsService on real PostgreSQL: the agent changes underneath (#1085)',
  { timeout: 60_000 },
  () => {
    const scratch = `helpdesk_race_${process.pid}_${Date.now()}`;
    let pool: Pool;
    let database: ReturnType<typeof drizzle>;
    let service: TicketsService;
    let ticketId: string;

    beforeAll(async () => {
      const server = new Client({ connectionString: SERVER_URL });
      await server.connect();
      await server.query(`create database "${scratch}"`);
      await server.end();
      pool = new Pool({ connectionString: urlFor(scratch), max: 4 });
      database = drizzle(pool);
      await migrate(database, { migrationsFolder: MIGRATIONS });
      service = new TicketsService(database);
    }, 60_000);

    afterAll(async () => {
      await pool?.end();
      const server = new Client({ connectionString: SERVER_URL });
      await server.connect();
      await server.query(`drop database if exists "${scratch}" with (force)`);
      await server.end();
    });

    // A fresh team each time: Chris leads Atlas, where Sam is an active
    // agent, and one new ticket waits, unassigned.
    beforeEach(async () => {
      await database.delete(tickets);
      await database.update(teams).set({ supervisorId: null });
      await database.delete(users);
      await database.delete(teams);
      await database.delete(customers);
      await database.delete(queues);
      await database.insert(teams).values({ id: 'atlas', name: 'Atlas' });
      await database.insert(users).values([
        {
          id: 'chris.taylor',
          name: 'Chris Taylor',
          role: 'supervisor',
          teamId: 'atlas',
          passwordHash: 'x',
        },
        {
          id: 'sam.rivera',
          name: 'Sam Rivera',
          role: 'agent',
          teamId: 'atlas',
          passwordHash: 'x',
        },
      ]);
      await database
        .update(teams)
        .set({ supervisorId: 'chris.taylor' })
        .where(eq(teams.id, 'atlas'));
      await database
        .insert(queues)
        .values({ id: 'accounts', name: 'Accounts' });
      const [customer] = await database
        .insert(customers)
        .values({ name: 'Dana Whitfield', email: 'dana@example.com' })
        .returning({ id: customers.id });
      [{ id: ticketId }] = await database
        .insert(tickets)
        .values({
          subject: 'Locked out',
          description: 'Locked out after a password reset.',
          priority: 'high',
          requesterId: customer.id,
          queueId: 'accounts',
        })
        .returning({ id: tickets.id });
    });

    /**
     * Runs `act` while an admin's edit of Sam is under way, as
     * UsersService.update does it: Sam's row locked, then (once `act` is
     * waiting on that lock, or done) Sam deactivated and his open tickets
     * handed back, all committed. Answers with how `act` ended.
     */
    async function whileSamIsDeactivated(act: () => Promise<unknown>) {
      const edit = await pool.connect();
      try {
        await edit.query('begin');
        await edit.query(
          `select id from users where id = 'sam.rivera' for update`
        );
        const outcome = act().then(
          () => 'done' as const,
          (error: { status?: number }) => error.status ?? 'error'
        );
        await waitUntilWaitingOrDone(outcome);
        await edit.query(
          `update users set active = false where id = 'sam.rivera'`
        );
        await edit.query(
          `update tickets set assignee_id = null
           where assignee_id = 'sam.rivera'
             and status in ('new', 'open', 'pending')`
        );
        await edit.query('commit');
        return await outcome;
      } finally {
        edit.release();
      }
    }

    /** Waits until another backend waits on a lock, or `act` is done. */
    async function waitUntilWaitingOrDone(outcome: Promise<unknown>) {
      let done = false;
      void outcome.then(() => (done = true));
      for (let tries = 0; tries < 100 && !done; tries++) {
        const { rows } = await pool.query(
          `select count(*)::int as waiting from pg_stat_activity
           where datname = current_database() and wait_event_type = 'Lock'`
        );
        if (rows[0].waiting > 0) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    /** Who holds the ticket now, and whether they are active. */
    async function holder() {
      const [row] = await database
        .select({ assigneeId: tickets.assigneeId, active: users.active })
        .from(tickets)
        .leftJoin(users, eq(users.id, tickets.assigneeId))
        .where(eq(tickets.id, ticketId));
      return row;
    }

    it('never leaves a ticket assigned to an agent deactivated meanwhile', async () => {
      const outcome = await whileSamIsDeactivated(() =>
        service.assign(ticketId, 'sam.rivera', 'chris.taylor')
      );

      // The assignment waits for the edit and then refuses: Sam is no
      // longer an active agent on Chris's team.
      expect(outcome).toBe(404);
      expect(await holder()).toEqual({ assigneeId: null, active: null });
    });

    it('never lets an agent deactivated meanwhile take a ticket', async () => {
      const outcome = await whileSamIsDeactivated(() =>
        service.take(ticketId, 'sam.rivera')
      );

      expect(outcome).toBe(403);
      expect(await holder()).toEqual({ assigneeId: null, active: null });
    });
  }
);
