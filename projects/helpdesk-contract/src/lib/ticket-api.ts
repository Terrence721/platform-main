import { TicketPriority, TicketStatus } from './ticket';

/**
 * The longest subject and description a ticket may have: the widths of the
 * database columns that hold them.
 */
export const TICKET_SUBJECT_MAX_LENGTH = 200;
export const TICKET_DESCRIPTION_MAX_LENGTH = 10_000;

/**
 * A date and time as JSON carries it: an ISO 8601 string in UTC, such as
 * `2026-10-02T14:30:00.000Z`. Each side turns it into a `Date` itself.
 */
export type IsoDateTime = string;

/** A person on a ticket: enough to show, with the id to look up more. */
export interface PersonSummary {
  id: string;
  name: string;
}

/** The customer who raised a ticket. */
export interface RequesterSummary extends PersonSummary {
  email: string;
}

/** The queue a ticket is in. */
export interface QueueSummary {
  id: string;
  name: string;
}

/** A ticket as the API returns it. */
export interface TicketDto {
  id: string;
  /** The readable ticket number, shown as `#1042`; unique, never reused. */
  ticketNumber: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  requester: RequesterSummary;
  /** `null` while nobody has taken the ticket. */
  assignee: PersonSummary | null;
  queue: QueueSummary;
  tags: string[];
  /** When the ticket must be resolved by; `null` when no SLA applies. */
  slaDueAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * Gives an open ticket to an agent. A supervisor may give an unassigned
 * ticket, or one held by an agent on their team, to an active agent on
 * their team. An agent takes an unassigned ticket by naming themselves
 * (anyone else is refused; one someone has taken is a conflict).
 * Assigning a `new` ticket also opens it. Finished (resolved or closed)
 * tickets cannot be assigned.
 */
export interface AssignTicketRequest {
  assigneeId: string;
}

/**
 * Moves a ticket to another status, as the workflow allows
 * (`canTransition`). The agent who holds the ticket, or their team's
 * supervisor, may do it; a closed ticket stays closed.
 */
export interface ChangeStatusRequest {
  status: TicketStatus;
}

/** How long a finished ticket stays in an agent's Done list. */
export const RECENTLY_FINISHED_HOURS = 24;

/** The ticket number as people see it: `#1042`. */
export function formatTicketNumber(ticketNumber: number): string {
  return `#${ticketNumber}`;
}
