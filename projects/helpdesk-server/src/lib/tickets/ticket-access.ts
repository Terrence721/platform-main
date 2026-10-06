import type { CurrentUser, TicketStatus } from '@helpdesk/contract';
import { NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../database/database-token';
import { teams, tickets, users } from '../database/schema';

/** A ticket's id is a UUID; anything else names no ticket. */
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The same answer for no ticket and for one the user may not work on. */
export const NOT_YOURS = 'No such ticket among yours.';

/** What `Database.transaction` hands its callback. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Locks the ticket for the rest of the transaction (`share` to read,
 * `update` to write) and answers with its status, if `by` may work on it:
 * they hold it, or they lead the team of the agent who does. Otherwise 404,
 * the same answer as for no ticket at all (an unassigned ticket included).
 * The one rule for a ticket's details, its conversation and its status.
 */
export async function lockWorkable(
  tx: Transaction,
  ticketId: string,
  by: CurrentUser,
  lock: 'share' | 'update'
): Promise<TicketStatus> {
  if (!UUID.test(ticketId)) {
    throw new NotFoundException(NOT_YOURS);
  }
  const [ticket] = await tx
    .select({
      status: tickets.status,
      assigneeId: tickets.assigneeId,
      leadId: teams.supervisorId,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.assigneeId, users.id))
    .leftJoin(teams, eq(users.teamId, teams.id))
    .where(eq(tickets.id, ticketId))
    .for(lock, { of: tickets });
  const mayWork =
    ticket !== undefined &&
    ticket.assigneeId !== null &&
    (ticket.assigneeId === by.id ||
      (by.role === 'supervisor' && ticket.leadId === by.id));
  if (!mayWork) {
    throw new NotFoundException(NOT_YOURS);
  }
  return ticket.status;
}
