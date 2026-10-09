import {
  OPEN_WORK_STATUSES,
  type PersonSummary,
  type TeamListing,
  type TeamMember,
  type TeamOverview,
} from '@helpdesk/contract';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database-token';
import { teams, tickets, users } from '../database/schema';
import {
  MOST_URGENT_FIRST,
  selectTickets,
  toTicketDto,
} from '../tickets/ticket-dto';

/**
 * Reads the teams: every one with its lead, for an admin; and a team's
 * members and workload, for its supervisor.
 */
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
   * Every team by name, each with the supervisor who leads it (`null`
   * while none does): one with no accounts too, which the accounts alone
   * would not show (#1210). For an admin's Team accounts.
   */
  async all(): Promise<TeamListing[]> {
    const rows = await this.database
      .select({
        id: teams.id,
        name: teams.name,
        leadId: users.id,
        leadName: users.name,
      })
      .from(teams)
      // A left join, so a team with no lead still comes back.
      .leftJoin(users, eq(users.id, teams.supervisorId))
      .orderBy(asc(teams.name));
    return rows.map(({ id, name, leadId, leadName }) => ({
      id,
      name,
      lead:
        leadId === null || leadName === null
          ? null
          : { id: leadId, name: leadName },
    }));
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
   * The team's active agents by name, each with their open-ticket count and
   * how many of those are past their due time at `now`. A deactivated agent
   * stays on the team but cannot be assigned work, so is left out (#1027).
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
        .where(
          and(
            eq(users.teamId, teamId),
            eq(users.role, 'agent'),
            eq(users.active, true)
          )
        )
        .groupBy(users.id, users.name)
        // By name; two of the same name by user ID, so the order is fixed.
        .orderBy(asc(users.name), asc(users.id))
    );
  }
}
