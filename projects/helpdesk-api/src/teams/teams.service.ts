import type {
  PersonSummary,
  TeamMember,
  TeamOverview,
} from '@helpdesk/contract';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module';
import { teams, tickets, users } from '../database/schema';
import {
  MOST_URGENT_FIRST,
  selectTickets,
  toTicketDto,
} from '../tickets/ticket-dto';
import { OPEN_WORK_STATUSES } from '../tickets/tickets.service';

/** Reads a team's members and workload, for its supervisor. */
@Injectable()
export class TeamsService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  /**
   * The team this supervisor leads, with each agent's open and overdue
   * ticket counts, and every unassigned open ticket; `null` when they lead
   * no team. "Overdue" is measured at `now`.
   */
  async overviewFor(
    supervisorId: string,
    now = new Date()
  ): Promise<TeamOverview | null> {
    const [team] = await this.database
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.supervisorId, supervisorId));
    if (team === undefined) {
      return null;
    }

    const [members, unassigned] = await Promise.all([
      this.membersOf(team.id, now),
      selectTickets(this.database)
        .where(
          and(
            isNull(tickets.assigneeId),
            inArray(tickets.status, [...OPEN_WORK_STATUSES])
          )
        )
        .orderBy(...MOST_URGENT_FIRST),
    ]);
    return { ...team, members, unassigned: unassigned.map(toTicketDto) };
  }

  /**
   * The agent with this user ID, if they are on the team this supervisor
   * leads; otherwise `null` (another team's agent, the supervisor's own
   * user ID, someone with no team, or no such user). Endpoints that show
   * one team member's tickets check this first.
   */
  async agentLedBy(
    supervisorId: string,
    userId: string
  ): Promise<PersonSummary | null> {
    const [agent] = await this.database
      .select({ id: users.id, name: users.name })
      .from(users)
      .innerJoin(teams, eq(users.teamId, teams.id))
      .where(
        and(
          eq(users.id, userId),
          eq(users.role, 'agent'),
          eq(teams.supervisorId, supervisorId)
        )
      )
      .limit(1);
    return agent ?? null;
  }

  /**
   * The team's agents by name, each with their open-ticket count and how
   * many of those are past their due time at `now`.
   */
  private membersOf(teamId: string, now: Date): Promise<TeamMember[]> {
    return (
      this.database
        .select({
          id: users.id,
          name: users.name,
          openTickets: count(tickets.id),
          // count() skips nulls, so only the overdue ones are counted.
          overdueTickets: count(
            sql`case when ${lt(tickets.slaDueAt, now)} then 1 end`
          ),
        })
        .from(users)
        // A left join, so an agent with no open work still counts, as 0.
        .leftJoin(
          tickets,
          and(
            eq(tickets.assigneeId, users.id),
            inArray(tickets.status, [...OPEN_WORK_STATUSES])
          )
        )
        .where(and(eq(users.teamId, teamId), eq(users.role, 'agent')))
        .groupBy(users.id, users.name)
        .orderBy(asc(users.name))
    );
  }
}
