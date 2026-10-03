import {
  ROLES,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_SUBJECT_MAX_LENGTH,
  USER_ID_MAX_LENGTH,
} from '@helpdesk/contract';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  // The repo's id-blacklist rule bans the name `boolean`.
  boolean as booleanColumn,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// The Helpdesk's tables. Values and limits come from @helpdesk/contract, so
// the database, the API and the app agree on them. Changing this file means
// generating a migration: `yarn db:generate`.

export const roleEnum = pgEnum('role', ROLES);
export const ticketStatusEnum = pgEnum('ticket_status', TICKET_STATUSES);
export const ticketPriorityEnum = pgEnum('ticket_priority', TICKET_PRIORITIES);

/** Created when the row is added; `updatedAt` also moves on every update. */
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * A group of agents led by one supervisor, who sees and reassigns the
 * team's work. Admins belong to no team.
 */
export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  /** One team per supervisor; `null` while the team has none. */
  supervisorId: varchar('supervisor_id', { length: USER_ID_MAX_LENGTH })
    .unique()
    // users and teams refer to each other, so the type is spelled out.
    .references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
});

/**
 * Everyone who signs in. The key is the sign-in user ID (e.g. `sam.rivera`),
 * so a ticket's assignee is the same ID the user signs in with.
 */
export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: USER_ID_MAX_LENGTH }).primaryKey(),
    name: text('name').notNull(),
    role: roleEnum('role').notNull(),
    passwordHash: text('password_hash').notNull(),
    active: booleanColumn('active').notNull().default(true),
    /** The agent's or supervisor's team; `null` for admins. */
    teamId: text('team_id').references(() => teams.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [index('users_team_idx').on(table.teamId)]
);

/** Where tickets are sorted, e.g. `accounts`, `billing`. */
export const queues = pgTable('queues', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
});

/** The people who raise tickets. They never sign in. */
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  ...timestamps,
});

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The number people see, `#1042`: unique, never reused, from 1001. */
    ticketNumber: integer('ticket_number')
      .notNull()
      .unique()
      .generatedAlwaysAsIdentity({ startWith: 1001 }),
    subject: varchar('subject', {
      length: TICKET_SUBJECT_MAX_LENGTH,
    }).notNull(),
    description: varchar('description', {
      length: TICKET_DESCRIPTION_MAX_LENGTH,
    }).notNull(),
    status: ticketStatusEnum('status').notNull().default('new'),
    priority: ticketPriorityEnum('priority').notNull(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => customers.id),
    /** `null` while nobody has taken the ticket. */
    assigneeId: varchar('assignee_id', {
      length: USER_ID_MAX_LENGTH,
    }).references(() => users.id, { onDelete: 'set null' }),
    queueId: text('queue_id')
      .notNull()
      .references(() => queues.id),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** When it must be resolved by; `null` when no SLA applies. */
    slaDueAt: timestamp('sla_due_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    // The contract's list filters and sorts.
    index('tickets_status_idx').on(table.status),
    index('tickets_assignee_idx').on(table.assigneeId),
    index('tickets_queue_idx').on(table.queueId),
    index('tickets_sla_due_at_idx').on(table.slaDueAt),
    index('tickets_updated_at_idx').on(table.updatedAt),
  ]
);
