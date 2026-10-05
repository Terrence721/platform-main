import {
  type CurrentUser,
  REPORT_WINDOW_DAYS,
  type ReportsResponse,
  type TeamReport,
} from '@helpdesk/contract';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, isNull, or, type SQL, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database-token';
import { reportingTeams, reportingTickets as t } from '../database/reporting';

/** The name of the row for work nobody holds yet. */
export const UNASSIGNED_REPORT_NAME = 'Unassigned';

/** Who a report is for: every team, or one team (and Unassigned). */
export type ReportScope = ReportsResponse['scope'];

/** Shown to a supervisor who is on no team, so has nothing to report on. */
export const NO_TEAM_MESSAGE = 'You are on no team.';

/**
 * What a signed-in supervisor or admin may see: every team for an admin,
 * their own team for a supervisor; 404 for a supervisor on no team.
 */
export function scopeFor(user: CurrentUser): ReportScope {
  if (user.role === 'admin') {
    return 'all';
  }
  if (user.teamId === null) {
    throw new NotFoundException(NO_TEAM_MESSAGE);
  }
  return { teamId: user.teamId };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Open work: new, open or pending. */
const isOpen = sql`${t.status} in ('new', 'open', 'pending')`;

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
 * The Reports page's figures (#967), from the reporting views (#966):
 * open work by status, priority and team as of `now`; finished work, SLA
 * and reply times over the last REPORT_WINDOW_DAYS days.
 */
@Injectable()
export class ReportsService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  /**
   * The report for `scope`: every team for an admin, one team for its
   * supervisor; both with the Unassigned row last. Every team in scope has
   * a row, with zeros when it has no tickets.
   */
  async report(scope: ReportScope, now = new Date()): Promise<ReportsResponse> {
    const since = new Date(now.getTime() - REPORT_WINDOW_DAYS * DAY_MS);
    const finishedInWindow = sql`${t.finishedAt} >= ${since}`;

    const teams = await this.database
      .select({ teamId: reportingTeams.teamId, name: reportingTeams.name })
      .from(reportingTeams)
      .where(
        scope === 'all' ? undefined : eq(reportingTeams.teamId, scope.teamId)
      )
      .orderBy(asc(reportingTeams.name));

    const figures = await this.database
      .select({
        teamId: t.teamId,
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
      })
      .from(t)
      .where(
        scope === 'all'
          ? undefined
          : or(eq(t.teamId, scope.teamId), isNull(t.teamId))
      )
      .groupBy(t.teamId);

    const byTeam = new Map(figures.map((row) => [row.teamId, row]));
    const sum = (pick: (row: (typeof figures)[number]) => number) =>
      figures.reduce((total, row) => total + pick(row), 0);

    return {
      asOf: now.toISOString(),
      since: since.toISOString(),
      scope,
      openByStatus: {
        new: sum((row) => row.statusNew),
        open: sum((row) => row.statusOpen),
        pending: sum((row) => row.statusPending),
      },
      teams: [
        ...teams.map(({ teamId, name }) =>
          teamReport(teamId, name, byTeam.get(teamId))
        ),
        teamReport(null, UNASSIGNED_REPORT_NAME, byTeam.get(null)),
      ],
    };
  }
}

/** The figures one team's tickets add up to, as the query gives them. */
interface TeamFigures {
  low: number;
  normal: number;
  high: number;
  urgent: number;
  overdue: number;
  finished: number;
  finishedWithDueTime: number;
  finishedOnTime: number;
  medianHoursToResolve: number | null;
  medianHoursToFirstReply: number | null;
}

/** A team's row: its figures, or zeros when it has no tickets. */
function teamReport(
  teamId: string | null,
  name: string,
  figures: TeamFigures | undefined
): TeamReport {
  return {
    teamId,
    name,
    openByPriority: {
      low: figures?.low ?? 0,
      normal: figures?.normal ?? 0,
      high: figures?.high ?? 0,
      urgent: figures?.urgent ?? 0,
    },
    overdue: figures?.overdue ?? 0,
    finished: figures?.finished ?? 0,
    finishedWithDueTime: figures?.finishedWithDueTime ?? 0,
    finishedOnTime: figures?.finishedOnTime ?? 0,
    medianHoursToResolve: roundHours(figures?.medianHoursToResolve),
    medianHoursToFirstReply: roundHours(figures?.medianHoursToFirstReply),
  };
}

/** Hours to one decimal; none stays `null`. */
function roundHours(hours: number | null | undefined): number | null {
  return hours === null || hours === undefined || Number.isNaN(hours)
    ? null
    : Math.round(hours * 10) / 10;
}
