import { isFinished } from '@helpdesk/contract';
import { count, eq } from 'drizzle-orm';
import { hashPassword } from '../../auth/password';
import type { Database } from '../database-token';
import {
  customers,
  queues,
  teams,
  ticketMessages,
  tickets,
  users,
} from '../schema';
import { generateSeed, SeedData, SeedOptions } from './generate';
import type { SeedTicket, SeedUser } from './story';

/** The seeded users' password when HELPDESK_SEED_PASSWORD is not set. */
export const DEFAULT_SEED_PASSWORD = 'helpdesk-dev-only';

/** Rows per insert, well under PostgreSQL's limit on query parameters. */
const BATCH_SIZE = 500;
const MINUTE_MS = 60_000;

export interface SeedSummary {
  users: number;
  teams: number;
  queues: number;
  customers: number;
  tickets: number;
  /** Replies and internal notes, across all tickets. */
  messages: number;
  /** A couple of user IDs per role, to sign in with. */
  examples: Record<SeedUser['role'], string[]>;
  milliseconds: number;
}

/** A time `minutes` from `now`; negative minutes are in the past. */
export function minutesFrom(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * MINUTE_MS);
}

/** A seed ticket as a row, its relative times made real. */
export function ticketRow(
  ticket: SeedTicket,
  now: Date,
  customerIds: ReadonlyMap<string, string>
): typeof tickets.$inferInsert {
  const requesterId = customerIds.get(ticket.requesterEmail);
  if (requesterId === undefined) {
    throw new Error(`No customer with the email ${ticket.requesterEmail}.`);
  }
  const updatedAt = minutesFrom(now, -ticket.updatedMinutesAgo);
  return {
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    requesterId,
    assigneeId: ticket.assigneeId,
    queueId: ticket.queueId,
    tags: ticket.tags,
    slaDueAt:
      ticket.slaDueInMinutes === null
        ? null
        : minutesFrom(now, ticket.slaDueInMinutes),
    createdAt: minutesFrom(now, -ticket.createdMinutesAgo),
    updatedAt,
    // A seed ticket that is finished last changed when it was finished.
    finishedAt: isFinished(ticket.status) ? updatedAt : null,
  };
}

function inBatches<T>(rows: T[]): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    batches.push(rows.slice(start, start + BATCH_SIZE));
  }
  return batches;
}

/**
 * Fills an EMPTY database with the seed data, all in one transaction: if
 * anything fails, nothing is kept. Refuses a database that already has
 * users, so it never mixes with or duplicates real data.
 */
export async function seedDatabase(
  db: Database,
  {
    now = new Date(),
    password = DEFAULT_SEED_PASSWORD,
    ...options
  }: Partial<SeedOptions> & { now?: Date; password?: string } = {}
): Promise<SeedSummary> {
  const started = Date.now();
  const [{ existing }] = await db.select({ existing: count() }).from(users);
  if (existing > 0) {
    throw new Error(
      `The database already has ${existing} users; seed only an empty one ` +
        '(yarn db:reset empties it).'
    );
  }

  const data: SeedData = generateSeed(options);
  // Every seeded user has the same, published password, so one hash serves
  // them all: hashing it per user, at about half a second each (#1039),
  // would slow every start for nothing.
  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx.insert(queues).values([...data.queues]);
    // Teams and users point at each other: teams first without their
    // supervisor, then the users, then each team's supervisor.
    await tx
      .insert(teams)
      .values(data.teams.map(({ id, name }) => ({ id, name })));
    for (const batch of inBatches(
      data.users.map((user) => ({ ...user, passwordHash }))
    )) {
      await tx.insert(users).values(batch);
    }
    for (const team of data.teams) {
      await tx
        .update(teams)
        .set({ supervisorId: team.supervisorId })
        .where(eq(teams.id, team.id));
    }

    const customerIds = new Map<string, string>();
    for (const batch of inBatches(data.customers)) {
      const inserted = await tx
        .insert(customers)
        .values(batch)
        .returning({ id: customers.id, email: customers.email });
      inserted.forEach(({ id, email }) => customerIds.set(email, id));
    }

    // In order, so the showcase tickets get the first numbers; the numbers
    // then match each inserted row back to its seed ticket.
    const ticketIds: string[] = [];
    for (const batch of inBatches(
      data.tickets.map((ticket) => ticketRow(ticket, now, customerIds))
    )) {
      const inserted = await tx
        .insert(tickets)
        .values(batch)
        .returning({ id: tickets.id, ticketNumber: tickets.ticketNumber });
      inserted
        .sort((a, b) => a.ticketNumber - b.ticketNumber)
        .forEach(({ id }) => ticketIds.push(id));
    }

    for (const batch of inBatches(
      data.tickets.flatMap((ticket, index) =>
        ticket.messages.map((message) => ({
          ticketId: ticketIds[index],
          authorId: message.authorId,
          kind: message.kind,
          body: message.body,
          createdAt: minutesFrom(now, -message.minutesAgo),
        }))
      )
    )) {
      await tx.insert(ticketMessages).values(batch);
    }
  });

  const idsOf = (role: SeedUser['role']) =>
    data.users
      .filter((user) => user.role === role)
      .slice(0, 2)
      .map((user) => user.id);
  return {
    users: data.users.length,
    teams: data.teams.length,
    queues: data.queues.length,
    customers: data.customers.length,
    tickets: data.tickets.length,
    messages: data.tickets.reduce(
      (total, ticket) => total + ticket.messages.length,
      0
    ),
    examples: {
      admin: idsOf('admin'),
      supervisor: idsOf('supervisor'),
      agent: idsOf('agent'),
    },
    milliseconds: Date.now() - started,
  };
}
