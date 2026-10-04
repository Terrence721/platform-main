import type {
  PersonSummary,
  QueueSummary,
  RequesterSummary,
  TicketDto,
} from '@helpdesk/contract';
import { asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../database/database-token';
import { customers, queues, tickets, users } from '../database/schema';

/**
 * The columns a ticket query selects: the ticket, plus the summaries of
 * the people and queue it points at. Select them from `tickets` joined to
 * `customers` and `queues`, and LEFT joined to `users` (the assignee);
 * each row then fits `toTicketDto`. Drizzle gives a left-joined object as
 * `null` when the join found nothing, so an unassigned ticket's assignee
 * is `null`.
 */
export const TICKET_COLUMNS = {
  ticket: tickets,
  requester: {
    id: customers.id,
    name: customers.name,
    email: customers.email,
  },
  assignee: { id: users.id, name: users.name },
  queue: { id: queues.id, name: queues.name },
};

/**
 * Starts a ticket query: `TICKET_COLUMNS` with the joins they need. Add a
 * `where` and an `orderBy`; each row fits `toTicketDto`.
 */
export function selectTickets(database: Database) {
  return database
    .select(TICKET_COLUMNS)
    .from(tickets)
    .innerJoin(customers, eq(tickets.requesterId, customers.id))
    .innerJoin(queues, eq(tickets.queueId, queues.id))
    .leftJoin(users, eq(tickets.assigneeId, users.id));
}

/**
 * Most urgent first: the soonest SLA due time first (so overdue tickets
 * lead), tickets with no SLA last, and ties by ticket number.
 */
export const MOST_URGENT_FIRST = [
  sql`${tickets.slaDueAt} asc nulls last`,
  asc(tickets.ticketNumber),
];

/** A row selected with `TICKET_COLUMNS`. */
export interface TicketRow {
  ticket: typeof tickets.$inferSelect;
  requester: RequesterSummary;
  /** `null` when the left join found nobody: the ticket is unassigned. */
  assignee: PersonSummary | null;
  queue: QueueSummary;
}

/** A ticket as the contract sends it: dates as ISO strings in UTC. */
export function toTicketDto({
  ticket,
  requester,
  assignee,
  queue,
}: TicketRow): TicketDto {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    requester,
    assignee,
    queue,
    tags: ticket.tags,
    slaDueAt: ticket.slaDueAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}
