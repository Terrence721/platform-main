import type {
  HistorySummary,
  TicketDto,
  TicketStatus,
} from '@helpdesk/contract';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module';
import { teams, tickets, users } from '../database/schema';
import { MOST_URGENT_FIRST, selectTickets, toTicketDto } from './ticket-dto';

/** A ticket's id is a UUID; anything else names no ticket. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  /**
   * A supervisor gives an open ticket to an active agent on their team: an
   * unassigned ticket, or one an agent on their team holds (reassigning).
   * A `new` ticket becomes `open`. All checked in one transaction; 404 for
   * a ticket or agent the supervisor cannot reach (the same answer as for
   * none at all), 409 for a finished ticket. Answers with the ticket.
   */
  async assign(
    ticketId: string,
    assigneeId: string,
    supervisorId: string
  ): Promise<TicketDto> {
    if (!UUID.test(ticketId)) {
      throw new NotFoundException('No such ticket.');
    }
    await this.database.transaction(async (tx) => {
      /** The user, if an active agent on this supervisor's team. */
      const agentOnTeam = async (userId: string) =>
        (
          await tx
            .select({ id: users.id })
            .from(users)
            .innerJoin(teams, eq(users.teamId, teams.id))
            .where(
              and(
                eq(users.id, userId),
                eq(users.role, 'agent'),
                eq(users.active, true),
                eq(teams.supervisorId, supervisorId)
              )
            )
        ).length > 0;

      const [ticket] = await tx
        .select({ status: tickets.status, assigneeId: tickets.assigneeId })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        // Held until the transaction ends, so two assignments cannot race.
        .for('update');
      if (ticket === undefined) {
        throw new NotFoundException('No such ticket.');
      }
      if (!OPEN_WORK_STATUSES.includes(ticket.status)) {
        throw new ConflictException(
          "This ticket is finished, so it can't be assigned."
        );
      }
      if (
        ticket.assigneeId !== null &&
        !(await agentOnTeam(ticket.assigneeId))
      ) {
        throw new NotFoundException('No such ticket on your team.');
      }
      if (!(await agentOnTeam(assigneeId))) {
        throw new NotFoundException('No such agent on your team.');
      }
      await tx
        .update(tickets)
        .set({
          assigneeId,
          status: ticket.status === 'new' ? 'open' : ticket.status,
        })
        .where(eq(tickets.id, ticketId));
    });

    const [row] = await selectTickets(this.database).where(
      eq(tickets.id, ticketId)
    );
    return toTicketDto(row);
  }

  /** Every unassigned open ticket, most urgent first: work anyone may take. */
  async unassigned(): Promise<TicketDto[]> {
    const rows = await selectTickets(this.database)
      .where(
        and(
          isNull(tickets.assigneeId),
          inArray(tickets.status, [...OPEN_WORK_STATUSES])
        )
      )
      .orderBy(...MOST_URGENT_FIRST);
    return rows.map(toTicketDto);
  }

  /**
   * An agent takes an unassigned open ticket for themselves; a `new` one
   * becomes `open`. In one transaction with the ticket locked, so when two
   * agents take it at once only the first gets it: the other gets 409. A
   * ticket they hold already stays theirs. 404 for no such ticket, 409 for
   * a finished one. Answers with the ticket.
   */
  async take(ticketId: string, agentId: string): Promise<TicketDto> {
    if (!UUID.test(ticketId)) {
      throw new NotFoundException('No such ticket.');
    }
    await this.database.transaction(async (tx) => {
      const [ticket] = await tx
        .select({ status: tickets.status, assigneeId: tickets.assigneeId })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .for('update');
      if (ticket === undefined) {
        throw new NotFoundException('No such ticket.');
      }
      if (!OPEN_WORK_STATUSES.includes(ticket.status)) {
        throw new ConflictException(
          "This ticket is finished, so it can't be taken."
        );
      }
      if (ticket.assigneeId === agentId) {
        return;
      }
      if (ticket.assigneeId !== null) {
        throw new ConflictException('Someone else has taken this ticket.');
      }
      await tx
        .update(tickets)
        .set({
          assigneeId: agentId,
          status: ticket.status === 'new' ? 'open' : ticket.status,
        })
        .where(eq(tickets.id, ticketId));
    });

    const [row] = await selectTickets(this.database).where(
      eq(tickets.id, ticketId)
    );
    return toTicketDto(row);
  }
}
