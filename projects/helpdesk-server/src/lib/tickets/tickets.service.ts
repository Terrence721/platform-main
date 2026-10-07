import {
  canTransition,
  type CurrentUser,
  type HistorySummary,
  RECENTLY_FINISHED_HOURS,
  type TicketDto,
  type TicketStatus,
} from '@helpdesk/contract';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database-token';
import { teams, tickets, users } from '../database/schema';
import { LiveEvents } from '../live/live-events';
import { ticketAudience } from '../live/ticket-audience';
import { lockWorkable, UUID } from './ticket-access';
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

/**
 * Reads tickets for the people who work them, and changes them: taking,
 * assigning, moving through the workflow. Each change is told to the open
 * pages it concerns (`live`, #950; none in the in-browser demo).
 */
@Injectable()
export class TicketsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    // Named, as an optional parameter's recorded type is only `Object`.
    @Optional() @Inject(LiveEvents) private readonly live?: LiveEvents
  ) {}

  /** Tells the pages a change concerns that this ticket changed. */
  private async changed(
    ticketId: string,
    before: { formerHolderId?: string | null; wasUnassigned?: boolean } = {}
  ): Promise<void> {
    if (this.live) {
      this.live.publish({
        event: { type: 'ticket', ticketId },
        audience: await ticketAudience(this.database, ticketId, before),
      });
    }
  }

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
   * changed first, and how they add up. A finished ticket is on time when
   * it was finished by its due time, whatever changed after; one with no
   * due time counts as neither on time nor late.
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
        // By when it was finished, not its last change (#1020).
        if (
          ticket.finishedAt !== null &&
          ticket.finishedAt <= ticket.slaDueAt
        ) {
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
    const formerHolderId = await this.database.transaction(async (tx) => {
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
      return ticket.assigneeId;
    });
    await this.changed(ticketId, {
      formerHolderId,
      wasUnassigned: formerHolderId === null,
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
    const taken = await this.database.transaction(async (tx) => {
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
        return false;
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
      return true;
    });
    if (taken) {
      // It was unassigned work: everyone's Unassigned list changes.
      await this.changed(ticketId, { wasUnassigned: true });
    }

    const [row] = await selectTickets(this.database).where(
      eq(tickets.id, ticketId)
    );
    return toTicketDto(row);
  }

  /**
   * One ticket, for the agent who holds it or the supervisor who leads that
   * agent's team: the ticket popup's details, fetched again when the ticket
   * changes (#982). 404 for anyone else, and for an unassigned ticket: the
   * same answer as for no ticket at all (`lockWorkable`).
   */
  async one(ticketId: string, by: CurrentUser): Promise<TicketDto> {
    return this.database.transaction(async (tx) => {
      await lockWorkable(tx, ticketId, by, 'share');
      const [row] = await selectTickets(tx).where(eq(tickets.id, ticketId));
      return toTicketDto(row);
    });
  }

  /**
   * Moves a ticket to another status, as the workflow allows. Only the
   * agent who holds it, or the supervisor who leads that agent's team, may
   * (404 for anyone else, and for an unassigned ticket: the same answer as
   * for no ticket at all; `lockWorkable`). 409 for a move the workflow
   * does not allow, including to the status it has. In one transaction
   * with the ticket locked. Answers with the ticket.
   */
  async changeStatus(
    ticketId: string,
    to: TicketStatus,
    by: CurrentUser
  ): Promise<TicketDto> {
    await this.database.transaction(async (tx) => {
      const status = await lockWorkable(tx, ticketId, by, 'update');
      if (!canTransition(status, to)) {
        throw new ConflictException(
          status === 'closed'
            ? "A closed ticket can't change."
            : `${/^[aeiou]/.test(status) ? 'An' : 'A'} ${status} ticket can't become ${to}.`
        );
      }
      // When it was finished (#1020): set as it leaves open work, kept as a
      // resolved ticket is closed, cleared as it is reopened.
      const now = new Date();
      const finishing = !OPEN_WORK_STATUSES.includes(to);
      const wasOpenWork = OPEN_WORK_STATUSES.includes(status);
      await tx
        .update(tickets)
        .set({
          status: to,
          updatedAt: now,
          ...(!finishing && { finishedAt: null }),
          ...(finishing && wasOpenWork && { finishedAt: now }),
        })
        .where(eq(tickets.id, ticketId));
    });
    await this.changed(ticketId);

    const [row] = await selectTickets(this.database).where(
      eq(tickets.id, ticketId)
    );
    return toTicketDto(row);
  }

  /**
   * An agent's tickets that became resolved or closed lately (finished
   * within `RECENTLY_FINISHED_HOURS` of `now`), most recently finished
   * first: their Done list. Closing or replying to an older one does not
   * bring it back (#1020).
   */
  async recentlyFinished(
    agentId: string,
    now = new Date()
  ): Promise<TicketDto[]> {
    const since = new Date(
      now.getTime() - RECENTLY_FINISHED_HOURS * 60 * 60 * 1000
    );
    const rows = await selectTickets(this.database)
      .where(
        and(
          eq(tickets.assigneeId, agentId),
          inArray(tickets.status, ['resolved', 'closed']),
          gte(tickets.finishedAt, since)
        )
      )
      .orderBy(desc(tickets.finishedAt), asc(tickets.ticketNumber));
    return rows.map(toTicketDto);
  }
}
