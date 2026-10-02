import { PageRequest } from './page';
import { TicketPriority, TicketStatus } from './ticket';

/** Limits the app's forms and the API's validation both enforce. */
export const TICKET_SUBJECT_MAX_LENGTH = 200;
export const TICKET_DESCRIPTION_MAX_LENGTH = 10_000;
export const TICKET_MAX_TAGS = 10;
export const TICKET_TAG_MAX_LENGTH = 30;

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

/** Raises a ticket. New tickets start as `new` and unassigned. */
export interface CreateTicketRequest {
  subject: string;
  description: string;
  priority: TicketPriority;
  requesterId: string;
  queueId: string;
  tags?: string[];
}

/**
 * Changes any of a ticket's fields at once; fields left out stay as they
 * are. The server checks each changed field: the status against
 * `canTransition`, and assigning someone else against `hasPermission`.
 */
export interface UpdateTicketRequest {
  status?: TicketStatus;
  priority?: TicketPriority;
  /** Who works the ticket; `null` unassigns it. */
  assigneeId?: string | null;
  queueId?: string;
  tags?: string[];
}

/** The fields a ticket list can be sorted by. */
export const TICKET_SORT_FIELDS = [
  'ticketNumber',
  'createdAt',
  'updatedAt',
  'priority',
  'slaDueAt',
] as const;

export type TicketSortField = (typeof TICKET_SORT_FIELDS)[number];

/** A sort field, ascending; with a leading `-`, descending. */
export type TicketSort = TicketSortField | `-${TicketSortField}`;

/** Most recently changed first. */
export const DEFAULT_TICKET_SORT: TicketSort = '-updatedAt';

/** Filters, sorting and paging for a ticket list; every part is optional. */
export interface TicketListQuery extends PageRequest {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string;
  queueId?: string;
  /** Matched against the subject, description and ticket number. */
  search?: string;
  sort?: TicketSort;
}

/** Whether a value, such as a query string parameter, is a ticket sort. */
export function isTicketSort(value: unknown): value is TicketSort {
  if (typeof value !== 'string') {
    return false;
  }
  const field = value.startsWith('-') ? value.slice(1) : value;
  return (TICKET_SORT_FIELDS as readonly string[]).includes(field);
}

/** The ticket number as people see it: `#1042`. */
export function formatTicketNumber(ticketNumber: number): string {
  return `#${ticketNumber}`;
}
