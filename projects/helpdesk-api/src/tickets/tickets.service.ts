import type {
  HistorySummary,
  TicketDto,
  TicketStatus,
} from '@helpdesk/contract';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module';
import { tickets } from '../database/schema';
import { MOST_URGENT_FIRST, selectTickets, toTicketDto } from './ticket-dto';

/**
 * The statuses that still need someone's work. Resolved and closed tickets
 * are done, so a work list leaves them out.
 */
export const OPEN_WORK_STATUSES: readonly TicketStatus[] = [
  'new',
  'open',
  'pending',
];

/** Reads tickets for the people who work them. */
@Injectable()
export class TicketsService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  /** The open work assigned to a user, most urgent first. */
  async assignedTo(userId: string): Promise<TicketDto[]> {
    const rows = await selectTickets(this.database)
      .where(
        and(
          eq(tickets.assigneeId, userId),
          inArray(tickets.status, [...OPEN_WORK_STATUSES])
        )
      )
      .orderBy(...MOST_URGENT_FIRST);
    return rows.map(toTicketDto);
  }

  /**
   * Every ticket assigned to a user, in two groups: their open work first,
   * most urgent first (as on their own My tickets); then their resolved and
   * closed tickets, most recently changed first. Sorting all of them by due
   * time alone would put long-closed tickets at the top.
   */
  async allAssignedTo(userId: string): Promise<TicketDto[]> {
    const isOpenWork = inArray(tickets.status, [...OPEN_WORK_STATUSES]);
    const rows = await selectTickets(this.database)
      .where(eq(tickets.assigneeId, userId))
      .orderBy(
        // Open work first.
        sql`case when ${isOpenWork} then 0 else 1 end`,
        // Within open work: soonest due first, no SLA last.
        sql`case when ${isOpenWork} then ${tickets.slaDueAt} end asc nulls last`,
        // Within finished work: most recently changed first.
        sql`case when ${isOpenWork} then null else ${tickets.updatedAt} end desc nulls last`,
        asc(tickets.ticketNumber)
      );
    return rows.map(toTicketDto);
  }

  /**
   * A user's tickets created or changed since `since`, most recently
   * changed first, and how they add up. Finished tickets with no due time
   * count as neither on time nor late.
   */
  async historyFor(
    userId: string,
    since: Date
  ): Promise<{ summary: HistorySummary; tickets: TicketDto[] }> {
    const rows = await selectTickets(this.database)
      .where(
        and(
          eq(tickets.assigneeId, userId),
          or(gte(tickets.createdAt, since), gte(tickets.updatedAt, since))
        )
      )
      .orderBy(desc(tickets.updatedAt), asc(tickets.ticketNumber));

    const summary: HistorySummary = {
      assigned: rows.length,
      finished: 0,
      open: 0,
      onTime: 0,
      late: 0,
    };
    for (const { ticket } of rows) {
      if (OPEN_WORK_STATUSES.includes(ticket.status)) {
        summary.open++;
        continue;
      }
      summary.finished++;
      if (ticket.slaDueAt !== null) {
        if (ticket.updatedAt <= ticket.slaDueAt) {
          summary.onTime++;
        } else {
          summary.late++;
        }
      }
    }
    return { summary, tickets: rows.map(toTicketDto) };
  }
}
