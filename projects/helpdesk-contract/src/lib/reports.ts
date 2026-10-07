import type { TicketPriority, TicketStatus } from './ticket';
import type { IsoDateTime } from './ticket-api';

/** How far back the Reports popup looks at finished work, in days. */
export const REPORT_WINDOW_DAYS = 30;

/**
 * The statuses that still need someone's work, in workflow order. Resolved
 * and closed tickets are done.
 */
export const OPEN_WORK_STATUSES = [
  'new',
  'open',
  'pending',
] as const satisfies readonly TicketStatus[];

export type OpenWorkStatus = (typeof OPEN_WORK_STATUSES)[number];

/**
 * What a report row adds up, whoever it is for: a team, the Unassigned
 * work, or one agent. Open work is as of now; the rest covers the window.
 */
export interface ReportFigures {
  /** Open work (new, open or pending) by priority, every priority listed. */
  openByPriority: Record<TicketPriority, number>;
  /** Of the open work, past its due time. */
  overdue: number;
  /** Resolved or closed in the window. */
  finished: number;
  /** Of the finished, those with a due time (an SLA applied). */
  finishedWithDueTime: number;
  /**
   * Of those, finished by their due time: SLA met % is this over
   * `finishedWithDueTime`. A ticket was finished when it left open work
   * for resolved or closed; closing a resolved ticket, or a reply, does
   * not move that, and reopening it starts again.
   */
  finishedOnTime: number;
  /** Median hours from created to finished, in the window; `null` if none. */
  medianHoursToResolve: number | null;
  /**
   * Median hours from created to the first reply to the customer (notes
   * don't count), for tickets created in the window; `null` if none.
   */
  medianHoursToFirstReply: number | null;
}

/**
 * A team's row, or the work nobody holds yet (`teamId` null, named
 * "Unassigned"). A ticket's team is its assignee's.
 */
export interface TeamReport extends ReportFigures {
  /** `null` for the Unassigned row. */
  teamId: string | null;
  name: string;
}

/** One agent's row: the tickets they hold or finished. */
export interface AgentReport extends ReportFigures {
  agentId: string;
  name: string;
  teamId: string;
}

/**
 * Who a report is about: every team (admins only), one team (an admin's
 * pick, or a supervisor's own), or one agent (any for an admin; one on
 * their own team for a supervisor).
 */
export type ReportScope = 'all' | { teamId: string } | { agentId: string };

/** The query parameters of GET /api/reports that pick a team or agent. */
export const REPORT_TEAM_PARAM = 'team';
export const REPORT_AGENT_PARAM = 'agent';

/** A team the caller may pick, with who leads it. */
export interface ReportTeamChoice {
  teamId: string;
  name: string;
  /** The supervisor who leads it; `null` while nobody does. */
  leadName: string | null;
}

/** An agent the caller may pick. */
export interface ReportAgentChoice {
  agentId: string;
  name: string;
  teamId: string;
}

/**
 * What the popup's "Report for" choice offers: an admin every team and
 * every active agent, a supervisor their own team and its active agents.
 * Both by name.
 */
export interface ReportChoices {
  teams: ReportTeamChoice[];
  agents: ReportAgentChoice[];
}

/**
 * The Reports popup's data (GET /api/reports, optionally `?team=` or
 * `?agent=`), for supervisors and admins. Open work is as of now; finished
 * work and reply times cover the window since `since`.
 */
export interface ReportsResponse {
  /** When the figures were taken. */
  asOf: IsoDateTime;
  /** The start of the window: `REPORT_WINDOW_DAYS` before `asOf`. */
  since: IsoDateTime;
  /** Who the report is about. */
  scope: ReportScope;
  /** Open work by status, across the rows below. */
  openByStatus: Record<OpenWorkStatus, number>;
  /**
   * The teams by name, then the Unassigned row last: every team for 'all',
   * the one team for a team; none for an agent.
   */
  teams: TeamReport[];
  /**
   * The team's active agents by name; the one agent for an agent; none for
   * 'all'.
   */
  agents: AgentReport[];
  /** What the caller may pick next. */
  choices: ReportChoices;
}
