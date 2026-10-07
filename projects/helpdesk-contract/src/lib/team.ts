import { IsoDateTime, PersonSummary, TicketDto } from './ticket-api';

/** An agent on a team, with how much open work they hold. */
export interface TeamMember extends PersonSummary {
  /** Their tickets still needing work: new, open or pending. */
  openTickets: number;
  /** Of those, past their due time. */
  overdueTickets: number;
}

/**
 * A supervisor's view of their team: who is on it and how loaded and how
 * far behind each agent is, plus the work nobody holds yet. An agent's own
 * tickets come one agent at a time, when the supervisor picks them. Open
 * work means new, open or pending.
 */
export interface TeamOverview {
  id: string;
  name: string;
  /** The team's agents, by name. */
  members: TeamMember[];
  /**
   * Every unassigned open ticket, most urgent first. Tickets belong to
   * queues, not teams, so any team may pick these up.
   */
  unassigned: TicketDto[];
}

/** How a team member's tickets in a period add up. */
export interface HistorySummary {
  /** Every ticket of theirs created or changed in the period. */
  assigned: number;
  /** Of `assigned`, resolved or closed. */
  finished: number;
  /** Of `assigned`, still new, open or pending. */
  open: number;
  /**
   * Finished tickets with a due time, finished by it: when they left open
   * work, whatever changed after (#1020).
   */
  onTime: number;
  /** Finished tickets with a due time, finished after it. */
  late: number;
}

/**
 * A team member's recent history, for their supervisor: their tickets
 * created or changed since `since`, most recently changed first, and how
 * those add up.
 */
export interface MemberHistory {
  member: PersonSummary;
  /** The start of the period. */
  since: IsoDateTime;
  summary: HistorySummary;
  tickets: TicketDto[];
}
