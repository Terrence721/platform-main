import {
  DISMISS_REASONS,
  REQUEST_CATEGORIES,
  REQUEST_EMAIL_MAX_LENGTH,
  REQUEST_IMPACTS,
  REQUEST_NAME_MAX_LENGTH,
  REQUEST_STATUSES,
  REQUEST_WHERE_MAX_LENGTH,
  ROLES,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_MESSAGE_KINDS,
  TICKET_MESSAGE_MAX_LENGTH,
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
  check,
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
export const ticketMessageKindEnum = pgEnum(
  'ticket_message_kind',
  TICKET_MESSAGE_KINDS
);
export const requestCategoryEnum = pgEnum(
  'request_category',
  REQUEST_CATEGORIES
);
export const requestImpactEnum = pgEnum('request_impact', REQUEST_IMPACTS);
export const requestStatusEnum = pgEnum('request_status', REQUEST_STATUSES);
export const dismissReasonEnum = pgEnum('dismiss_reason', DISMISS_REASONS);

/**
 * Created when the row is added; `updatedAt` also moves on every update made
 * through Drizzle (`$onUpdate`, not a database trigger, so raw SQL such as a
 * migration's backfill leaves it as it is).
 */
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

/**
 * A customer's request and the work on it: who raised it, its queue,
 * status and priority, who holds it and by when it is due. Its team is its
 * assignee's; an unassigned ticket belongs to no team yet.
 */
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
    /**
     * When it became resolved or closed; `null` while it is open work.
     * Closing a resolved ticket, or a reply to it, does not move it, as
     * `updatedAt` does (#1020); reopening clears it.
     */
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    // What the services filter and sort by: the holder (My tickets, the
    // history, Done), the status (open work), the due time (most urgent
    // first) and the last change (the history's order). No query lists a
    // queue's tickets yet; that index stays for when one does, as dropping
    // it would take a migration.
    index('tickets_status_idx').on(table.status),
    index('tickets_assignee_idx').on(table.assigneeId),
    index('tickets_queue_idx').on(table.queueId),
    index('tickets_sla_due_at_idx').on(table.slaDueAt),
    index('tickets_updated_at_idx').on(table.updatedAt),
  ]
);

/**
 * A ticket's conversation: replies to the customer and internal notes for
 * staff. Messages are never edited, so there is no `updatedAt`.
 */
export const ticketMessages = pgTable(
  'ticket_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Deleting a ticket deletes its conversation. */
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    /** Accounts are deactivated, not deleted, so authors are kept. */
    authorId: varchar('author_id', { length: USER_ID_MAX_LENGTH })
      .notNull()
      .references(() => users.id),
    kind: ticketMessageKindEnum('kind').notNull(),
    body: varchar('body', { length: TICKET_MESSAGE_MAX_LENGTH }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One ticket's conversation, oldest first.
    index('ticket_messages_ticket_created_idx').on(
      table.ticketId,
      table.createdAt
    ),
  ]
);

/**
 * What a customer sent in through the public form (#1026), waiting in
 * supervisors' New requests until one turns it into a ticket or dismisses
 * it. Never deleted: a decided request keeps who decided, when and how.
 * The customer gets its number as `R-1001`, and checks on it with that and
 * their email.
 */
export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The number the customer sees, `R-1042`: unique, from 1001. */
    requestNumber: integer('request_number')
      .notNull()
      .unique()
      .generatedAlwaysAsIdentity({ startWith: 1001 }),
    name: varchar('name', { length: REQUEST_NAME_MAX_LENGTH }).notNull(),
    email: varchar('email', { length: REQUEST_EMAIL_MAX_LENGTH }).notNull(),
    category: requestCategoryEnum('category').notNull(),
    impact: requestImpactEnum('impact').notNull(),
    // As long as a ticket's, which they become.
    subject: varchar('subject', {
      length: TICKET_SUBJECT_MAX_LENGTH,
    }).notNull(),
    description: varchar('description', {
      length: TICKET_DESCRIPTION_MAX_LENGTH,
    }).notNull(),
    /** Where it happened, such as a page; `where` is an SQL keyword. */
    where: varchar('where_happened', { length: REQUEST_WHERE_MAX_LENGTH }),
    /** When the customer agreed to what is kept, and why. */
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull(),
    status: requestStatusEnum('status').notNull().default('pending'),
    /** The ticket it became; tickets are never deleted. */
    ticketId: uuid('ticket_id').references(() => tickets.id),
    /** For a duplicate: the ticket it repeats. */
    duplicateOfTicketId: uuid('duplicate_of_ticket_id').references(
      () => tickets.id
    ),
    dismissReason: dismissReasonEnum('dismiss_reason'),
    /** The supervisor who decided; accounts are deactivated, not deleted. */
    decidedById: varchar('decided_by_id', {
      length: USER_ID_MAX_LENGTH,
    }).references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    // New requests: the pending ones, oldest first.
    index('requests_status_created_idx').on(table.status, table.createdAt),
    // Possible duplicates: the same customer's other requests.
    index('requests_email_idx').on(table.email),
    // A decision is recorded whole, or not at all while pending.
    check(
      'requests_decided_check',
      sql`(${table.status} = 'pending') = (${table.decidedById} is null and ${table.decidedAt} is null)`
    ),
    check(
      'requests_ticket_check',
      sql`(${table.status} = 'ticket') = (${table.ticketId} is not null)`
    ),
    check(
      'requests_dismissed_check',
      sql`(${table.status} = 'dismissed') = (${table.dismissReason} is not null)`
    ),
  ]
);
