import { sql } from 'drizzle-orm';
import {
  boolean as booleanColumn,
  integer,
  pgSchema,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// The Reports popup's view of the help desk (#967): a `reporting` schema
// of read-only views over the tables in ./schema, which ReportsService
// reads instead of the tables themselves. Only what the reports need (the
// queues and messages views, made for a Power BI report that was dropped,
// went in #1049), and nothing private: no password hashes, no message text,
// no customers.
// Statuses, priorities, roles and message kinds are text, not PostgreSQL
// enums. Times keep their time zone, as in the tables.

export const reporting = pgSchema('reporting');

const at = (name: string) => timestamp(name, { withTimezone: true });

/** Each team, and who leads it (`null` while nobody does). */
export const reportingTeams = reporting
  .view('teams', {
    teamId: text('team_id').notNull(),
    name: text('name').notNull(),
    leadId: text('lead_id'),
  })
  .as(
    sql`select id as team_id, name, supervisor_id as lead_id from public.teams`
  );

/** Everyone who signs in: no password hashes. */
export const reportingUsers = reporting
  .view('users', {
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    teamId: text('team_id'),
    active: booleanColumn('active').notNull(),
  })
  .as(
    sql`select id as user_id, name, role::text as role, team_id, active from public.users`
  );

/**
 * Every ticket, keyed by its number. Its team is its assignee's (an
 * unassigned ticket has none yet). `finished_at` is when it became
 * resolved or closed (#1020); `null` while it is open work.
 * `first_reply_at` is the first reply to the customer (notes don't count);
 * `null` until there is one.
 */
export const reportingTickets = reporting
  .view('tickets', {
    ticketNumber: integer('ticket_number').notNull(),
    status: text('status').notNull(),
    priority: text('priority').notNull(),
    queueId: text('queue_id').notNull(),
    assigneeId: text('assignee_id'),
    teamId: text('team_id'),
    createdAt: at('created_at').notNull(),
    updatedAt: at('updated_at').notNull(),
    dueAt: at('due_at'),
    finishedAt: at('finished_at'),
    firstReplyAt: at('first_reply_at'),
  })
  .as(
    sql`select
  t.ticket_number,
  t.status::text as status,
  t.priority::text as priority,
  t.queue_id,
  t.assignee_id,
  assignee.team_id,
  t.created_at,
  t.updated_at,
  t.sla_due_at as due_at,
  t.finished_at,
  (
    select min(m.created_at)
    from public.ticket_messages m
    where m.ticket_id = t.id and m.kind = 'reply'
  ) as first_reply_at
from public.tickets t
left join public.users assignee on assignee.id = t.assignee_id`
  );

/**
 * Every customer request (#1026), keyed by its number: where it is up to,
 * what it is about, when it arrived and when it was decided (`null` while
 * it waits), and why it was dismissed (`null` otherwise). Nothing about
 * who sent it: no name, email, description or files.
 */
export const reportingRequests = reporting
  .view('requests', {
    requestNumber: integer('request_number').notNull(),
    status: text('status').notNull(),
    category: text('category').notNull(),
    impact: text('impact').notNull(),
    createdAt: at('created_at').notNull(),
    decidedAt: at('decided_at'),
    dismissReason: text('dismiss_reason'),
  })
  .as(
    sql`select
  request_number,
  status::text as status,
  category::text as category,
  impact::text as impact,
  created_at,
  decided_at,
  dismiss_reason::text as dismiss_reason
from public.requests`
  );
