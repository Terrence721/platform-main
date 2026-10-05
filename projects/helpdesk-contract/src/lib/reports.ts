import type { TicketPriority, TicketStatus } from './ticket';
import type { IsoDateTime } from './ticket-api';

/** How far back the Reports page looks at finished work, in days. */
export const REPORT_WINDOW_DAYS = 30;

/** The statuses that count as open work, in workflow order. */
export const OPEN_REPORT_STATUSES = [
  'new',
  'open',
  'pending',
] as const satisfies readonly TicketStatus[];

export type OpenReportStatus = (typeof OPEN_REPORT_STATUSES)[number];

/**
 * One row of the Reports page: a team, or the work nobody holds yet
 * (`teamId` null, named "Unassigned"). A ticket's team is its assignee's.
 */
export interface TeamReport {
  /** `null` for the Unassigned row. */
  teamId: string | null;
  name: string;
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
   * `finishedWithDueTime`. A finished ticket's last change stands in for
   * when it was finished.
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
 * The Reports page's data (GET /api/reports), for supervisors and admins:
 * an admin sees every team, a supervisor their own; both see the
 * Unassigned row, as both can act on that work. Open work is as of now;
 * finished work and reply times cover the window since `since`.
 */
export interface ReportsResponse {
  /** When the figures were taken. */
  asOf: IsoDateTime;
  /** The start of the window: `REPORT_WINDOW_DAYS` before `asOf`. */
  since: IsoDateTime;
  /** Every team for an admin; for a supervisor, their own team's ID. */
  scope: 'all' | { teamId: string };
  /** Open work by status, across the rows below. */
  openByStatus: Record<OpenReportStatus, number>;
  /** The teams by name, then the Unassigned row last. */
  teams: TeamReport[];
}
