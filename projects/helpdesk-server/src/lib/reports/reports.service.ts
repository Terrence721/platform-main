import {
  type AgentReport,
  type CurrentUser,
  DISMISS_REASONS,
  type DismissReason,
  OPEN_WORK_STATUSES,
  REPORT_WINDOW_DAYS,
  type ReportChoices,
  type ReportFigures,
  type ReportScope,
  type ReportsResponse,
  type RequestsReport,
  type TeamReport,
} from '@helpdesk/contract';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DATABASE, type Database } from '../database/database-token';
import {
  reportingRequests,
  reportingTeams,
  reportingTickets as t,
  reportingUsers,
} from '../database/reporting';

/** The name of the row for work nobody holds yet. */
export const UNASSIGNED_REPORT_NAME = 'Unassigned';

/**
 * Shown to a supervisor who leads no team, so has nothing to report on: as
 * on My team, a supervisor works with the team they lead.
 */
export const NO_TEAM_MESSAGE = "You don't lead a team.";
export const NO_SUCH_TEAM_MESSAGE = 'No such team.';
export const NO_SUCH_AGENT_MESSAGE = 'No such agent.';
export const TEAM_OR_AGENT_MESSAGE = 'Pick a team or an agent, not both.';

/** What GET /api/reports was asked for: a team, an agent, or neither. */
export interface ReportQuery {
  team?: string;
  agent?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Open work: the contract's `OPEN_WORK_STATUSES`. */
const isOpen = inArray(t.status, [...OPEN_WORK_STATUSES]);

/** How many tickets match `condition`. */
const countWhere = (condition: SQL) =>
  sql<number>`count(*) filter (where ${condition})`.mapWith(Number);

/** The median of `hours` over the tickets that match `condition`. */
const medianWhere = (hours: SQL, condition: SQL) =>
  sql<number | null>`percentile_cont(0.5) within group (order by ${hours})
    filter (where ${condition})`.mapWith(Number);

/** Hours from a ticket's creation to `to`. */
const hoursFromCreated = (to: SQL) =>
  sql`extract(epoch from (${to} - ${t.createdAt})) / 3600`;

/**
 * The figures a group of tickets adds up to: open work by status and
 * priority and overdue as of `now`; finished work, SLA and reply times
 * since `since`.
 */
function figureColumns(now: Date, since: Date) {
  const finishedInWindow = sql`${t.finishedAt} >= ${since}`;
  return {
    statusNew: countWhere(sql`${t.status} = 'new'`),
    statusOpen: countWhere(sql`${t.status} = 'open'`),
    statusPending: countWhere(sql`${t.status} = 'pending'`),
    low: countWhere(sql`${isOpen} and ${t.priority} = 'low'`),
    normal: countWhere(sql`${isOpen} and ${t.priority} = 'normal'`),
    high: countWhere(sql`${isOpen} and ${t.priority} = 'high'`),
    urgent: countWhere(sql`${isOpen} and ${t.priority} = 'urgent'`),
    overdue: countWhere(sql`${isOpen} and ${t.dueAt} < ${now}`),
    finished: countWhere(finishedInWindow),
    finishedWithDueTime: countWhere(
      sql`${finishedInWindow} and ${t.dueAt} is not null`
    ),
    finishedOnTime: countWhere(
      sql`${finishedInWindow} and ${t.finishedAt} <= ${t.dueAt}`
    ),
    medianHoursToResolve: medianWhere(
      hoursFromCreated(sql`${t.finishedAt}`),
      finishedInWindow
    ),
    medianHoursToFirstReply: medianWhere(
      hoursFromCreated(sql`${t.firstReplyAt}`),
      sql`${t.createdAt} >= ${since} and ${t.firstReplyAt} is not null`
    ),
  };
}

/** The figures of one group, as the query gives them. */
type GroupFigures = {
  [K in keyof ReturnType<typeof figureColumns>]: K extends `median${string}`
    ? number | null
    : number;
};

/**
 * The Reports popup's figures (#967, #969), from the reporting views
 * (#966): for every team, one team (and its agents), or one agent.
 */
@Injectable()
export class ReportsService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  /**
   * GET /api/reports for this caller: decides what they may see (see
   * `scopeFor`), then the report and what they may pick next.
   */
  async reportFor(
    user: CurrentUser,
    query: ReportQuery,
    now = new Date()
  ): Promise<ReportsResponse> {
    const scope = await this.scopeFor(user, query);
    const [report, choices] = await Promise.all([
      this.report(scope, now),
      this.choicesFor(user),
    ]);
    return { ...report, choices };
  }

  /**
   * The team a supervisor leads, or `null` (for anyone else, or a
   * supervisor who leads none). A supervisor works with the team they lead,
   * as on My team: one who is on a team without leading it (a replaced
   * lead) has no report of it.
   */
  private async ledTeamOf(user: CurrentUser): Promise<string | null> {
    if (user.role !== 'supervisor') {
      return null;
    }
    const [team] = await this.database
      .select({ teamId: reportingTeams.teamId })
      .from(reportingTeams)
      .where(eq(reportingTeams.leadId, user.id));
    return team?.teamId ?? null;
  }

  /**
   * What a caller may see. Admins: every team, or the team or agent they
   * pick. Supervisors: the team they lead, or an agent on it; another team
   * or agent is 404, as if there were none. A supervisor who leads no team:
   * 404. Both a team and an agent: 400. Agents: 403.
   */
  async scopeFor(user: CurrentUser, query: ReportQuery): Promise<ReportScope> {
    if (user.role === 'agent') {
      throw new ForbiddenException();
    }
    if (query.team && query.agent) {
      throw new BadRequestException(TEAM_OR_AGENT_MESSAGE);
    }
    // A supervisor's team, unless asked otherwise; 'all' for an admin.
    const ownTeam = await this.ledTeamOf(user);
    if (user.role === 'supervisor' && ownTeam === null) {
      throw new NotFoundException(NO_TEAM_MESSAGE);
    }

    if (query.agent) {
      const [agent] = await this.database
        .select({ teamId: reportingUsers.teamId })
        .from(reportingUsers)
        .where(
          and(
            eq(reportingUsers.userId, query.agent),
            eq(reportingUsers.role, 'agent')
          )
        );
      if (agent === undefined || (ownTeam && agent.teamId !== ownTeam)) {
        throw new NotFoundException(NO_SUCH_AGENT_MESSAGE);
      }
      return { agentId: query.agent };
    }
    if (query.team) {
      const [team] = await this.database
        .select({ teamId: reportingTeams.teamId })
        .from(reportingTeams)
        .where(eq(reportingTeams.teamId, query.team));
      if (team === undefined || (ownTeam && query.team !== ownTeam)) {
        throw new NotFoundException(NO_SUCH_TEAM_MESSAGE);
      }
      return { teamId: query.team };
    }
    return ownTeam ? { teamId: ownTeam } : 'all';
  }

  /**
   * What a caller may pick, by name: an admin every team (with its lead)
   * and every active agent; a supervisor the team they lead and its active
   * agents, and nothing if they lead none.
   */
  async choicesFor(user: CurrentUser): Promise<ReportChoices> {
    const ownTeam = await this.ledTeamOf(user);
    if (user.role === 'supervisor' && ownTeam === null) {
      return { teams: [], agents: [] };
    }
    const lead = alias(reportingUsers, 'lead');
    const teams = await this.database
      .select({
        teamId: reportingTeams.teamId,
        name: reportingTeams.name,
        leadName: lead.name,
      })
      .from(reportingTeams)
      .leftJoin(lead, eq(lead.userId, reportingTeams.leadId))
      .where(ownTeam ? eq(reportingTeams.teamId, ownTeam) : undefined)
      .orderBy(asc(reportingTeams.name));
    const agents = await this.database
      .select({
        agentId: reportingUsers.userId,
        name: reportingUsers.name,
        teamId: sql<string>`${reportingUsers.teamId}`,
      })
      .from(reportingUsers)
      .where(
        and(
          eq(reportingUsers.role, 'agent'),
          eq(reportingUsers.active, true),
          ownTeam
            ? eq(reportingUsers.teamId, ownTeam)
            : sql`${reportingUsers.teamId} is not null`
        )
      )
      .orderBy(asc(reportingUsers.name), asc(reportingUsers.userId));
    return { teams, agents };
  }

  /**
   * The report for `scope`. Every team: each team by name, then
   * Unassigned. One team: the team, Unassigned, and a row per active agent
   * on it. One agent: that agent's row. Rows with no tickets are zeros.
   */
  async report(
    scope: ReportScope,
    now = new Date()
  ): Promise<Omit<ReportsResponse, 'choices'>> {
    const since = new Date(now.getTime() - REPORT_WINDOW_DAYS * DAY_MS);
    const header = {
      asOf: now.toISOString(),
      since: since.toISOString(),
      scope,
      requests: await this.requestsReport(since),
    };

    if (typeof scope === 'object' && 'agentId' in scope) {
      const rows = await this.agentRows(
        eq(reportingUsers.userId, scope.agentId),
        now,
        since
      );
      return {
        ...header,
        openByStatus: sumStatuses(rows.map(({ group }) => group)),
        teams: [],
        agents: rows.map(({ report }) => report),
      };
    }

    const teamId = scope === 'all' ? null : scope.teamId;
    const teams = await this.database
      .select({ teamId: reportingTeams.teamId, name: reportingTeams.name })
      .from(reportingTeams)
      .where(teamId ? eq(reportingTeams.teamId, teamId) : undefined)
      .orderBy(asc(reportingTeams.name));
    const figures = await this.database
      .select({ teamId: t.teamId, ...figureColumns(now, since) })
      .from(t)
      .where(teamId ? or(eq(t.teamId, teamId), isNull(t.teamId)) : undefined)
      .groupBy(t.teamId);
    const byTeam = new Map(figures.map((row) => [row.teamId, row]));
    const agents = teamId
      ? await this.agentRows(
          and(
            eq(reportingUsers.teamId, teamId),
            eq(reportingUsers.active, true)
          ),
          now,
          since
        )
      : [];

    return {
      ...header,
      openByStatus: sumStatuses(figures),
      teams: [
        ...teams.map(({ teamId, name }): TeamReport => ({
          teamId,
          name,
          ...reportFigures(byTeam.get(teamId)),
        })),
        {
          teamId: null,
          name: UNASSIGNED_REPORT_NAME,
          ...reportFigures(byTeam.get(null)),
        },
      ],
      agents: agents.map(({ report }) => report),
    };
  }

  /**
   * Customer requests' figures (#1026), from the requests view: received
   * since `since`; turned into tickets and dismissed (by why) since then;
   * waiting now, whenever they arrived; and the median hours from arrival
   * to a decision, for those decided since then. The same for every scope.
   */
  private async requestsReport(since: Date): Promise<RequestsReport> {
    const r = reportingRequests;
    const decidedInWindow = sql`${r.decidedAt} >= ${since}`;
    const [figures] = await this.database
      .select({
        received: countWhere(sql`${r.createdAt} >= ${since}`),
        turnedIntoTickets: countWhere(
          sql`${r.status} = 'ticket' and ${decidedInWindow}`
        ),
        waiting: countWhere(sql`${r.status} = 'pending'`),
        medianHoursToDecision: medianWhere(
          sql`extract(epoch from (${r.decidedAt} - ${r.createdAt})) / 3600`,
          decidedInWindow
        ),
      })
      .from(r);
    const dismissed = await this.database
      .select({ reason: r.dismissReason, count: countWhere(sql`true`) })
      .from(r)
      .where(and(eq(r.status, 'dismissed'), decidedInWindow))
      .groupBy(r.dismissReason);
    const byReason = new Map(
      dismissed.map(({ reason, count }) => [reason, count])
    );
    return {
      received: figures.received,
      turnedIntoTickets: figures.turnedIntoTickets,
      dismissed: Object.fromEntries(
        DISMISS_REASONS.map((reason) => [reason, byReason.get(reason) ?? 0])
      ) as Record<DismissReason, number>,
      waiting: figures.waiting,
      medianHoursToDecision: roundHours(figures.medianHoursToDecision),
    };
  }

  /**
   * A row per agent matching `which`, by name, from the tickets they hold;
   * with each one's raw figures, for adding up their open work by status.
   */
  private async agentRows(
    which: SQL | undefined,
    now: Date,
    since: Date
  ): Promise<{ report: AgentReport; group: GroupFigures }[]> {
    const people = await this.database
      .select({
        agentId: reportingUsers.userId,
        name: reportingUsers.name,
        teamId: sql<string>`${reportingUsers.teamId}`,
      })
      .from(reportingUsers)
      .where(and(eq(reportingUsers.role, 'agent'), which))
      .orderBy(asc(reportingUsers.name), asc(reportingUsers.userId));
    if (people.length === 0) {
      return [];
    }
    const figures = await this.database
      .select({ agentId: t.assigneeId, ...figureColumns(now, since) })
      .from(t)
      .where(
        sql`${t.assigneeId} in (${sql.join(
          people.map(({ agentId }) => sql`${agentId}`),
          sql`, `
        )})`
      )
      .groupBy(t.assigneeId);
    const byAgent = new Map(figures.map((row) => [row.agentId, row]));
    return people.map((person) => {
      const group = byAgent.get(person.agentId) ?? emptyGroup();
      return { report: { ...person, ...reportFigures(group) }, group };
    });
  }
}

/** A group with no tickets. */
function emptyGroup(): GroupFigures {
  return {
    statusNew: 0,
    statusOpen: 0,
    statusPending: 0,
    low: 0,
    normal: 0,
    high: 0,
    urgent: 0,
    overdue: 0,
    finished: 0,
    finishedWithDueTime: 0,
    finishedOnTime: 0,
    medianHoursToResolve: null,
    medianHoursToFirstReply: null,
  };
}

/** Open work by status, added up over these groups. */
function sumStatuses(
  groups: Pick<GroupFigures, 'statusNew' | 'statusOpen' | 'statusPending'>[]
): ReportsResponse['openByStatus'] {
  const sum = (pick: (group: (typeof groups)[number]) => number) =>
    groups.reduce((total, group) => total + pick(group), 0);
  return {
    new: sum((group) => group.statusNew),
    open: sum((group) => group.statusOpen),
    pending: sum((group) => group.statusPending),
  };
}

/** A group's figures as a report row has them; zeros when it has none. */
function reportFigures(group: GroupFigures | undefined): ReportFigures {
  const figures = group ?? emptyGroup();
  return {
    openByPriority: {
      low: figures.low,
      normal: figures.normal,
      high: figures.high,
      urgent: figures.urgent,
    },
    overdue: figures.overdue,
    finished: figures.finished,
    finishedWithDueTime: figures.finishedWithDueTime,
    finishedOnTime: figures.finishedOnTime,
    medianHoursToResolve: roundHours(figures.medianHoursToResolve),
    medianHoursToFirstReply: roundHours(figures.medianHoursToFirstReply),
  };
}

/** Hours to one decimal; none stays `null`. */
function roundHours(hours: number | null): number | null {
  return hours === null || Number.isNaN(hours)
    ? null
    : Math.round(hours * 10) / 10;
}
