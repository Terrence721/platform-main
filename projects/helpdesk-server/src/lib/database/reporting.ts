import { sql } from 'drizzle-orm';
import {
  boolean as booleanColumn,
  integer,
  pgSchema,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// The Power BI report's view of the help desk (#965): a `reporting` schema
// of read-only views over the tables in ./schema, which the report reads
// instead of the tables themselves. Only what the report needs, and nothing
// private: no password hashes, no message text, no customers. Statuses,
// priorities, roles and message kinds are text, not PostgreSQL enums, so
// any reporting tool reads them. Times keep their time zone, as in the
// tables.

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

/** Where tickets are sorted. */
export const reportingQueues = reporting
  .view('queues', {
    queueId: text('queue_id').notNull(),
    name: text('name').notNull(),
  })
  .as(sql`select id as queue_id, name from public.queues`);

/**
 * Every ticket, keyed by its number. Its team is its assignee's (an
 * unassigned ticket has none yet). A resolved or closed ticket's last
 * change is when it was finished. `first_reply_at` is the first reply to
 * the customer (notes don't count); `null` until there is one.
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
  case when t.status in ('resolved', 'closed') then t.updated_at end as finished_at,
  (
    select min(m.created_at)
    from public.ticket_messages m
    where m.ticket_id = t.id and m.kind = 'reply'
  ) as first_reply_at
from public.tickets t
left join public.users assignee on assignee.id = t.assignee_id`
  );

/** Every reply and internal note, by ticket number: no message text. */
export const reportingMessages = reporting
  .view('messages', {
    ticketNumber: integer('ticket_number').notNull(),
    authorId: text('author_id').notNull(),
    kind: text('kind').notNull(),
    createdAt: at('created_at').notNull(),
  })
  .as(
    sql`select t.ticket_number, m.author_id, m.kind::text as kind, m.created_at
from public.ticket_messages m
join public.tickets t on t.id = m.ticket_id`
  );
