import type { TicketPriority, TicketStatus } from './ticket';
import type { IsoDateTime, PersonSummary, TicketDto } from './ticket-api';

// Customer requests (#1026): how customers tell the help desk about a
// problem. Anyone may send one, with no account; it waits in supervisors'
// New requests until one of them turns it into a ticket or dismisses it.
// The customer checks on it with its reference and their email, as no
// confirmation email is sent.

/** What a request is about; each goes to a queue when it becomes a ticket. */
export const REQUEST_CATEGORIES = [
  'account',
  'billing',
  'bug',
  'feature',
  'other',
] as const;

export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

/** Each category as the form shows it. */
export const REQUEST_CATEGORY_LABELS: Readonly<
  Record<RequestCategory, string>
> = {
  account: 'Sign-in and account',
  billing: 'Billing',
  bug: 'Something is broken',
  feature: 'Feature request',
  other: 'Other',
};

/** How much the problem is affecting the customer, in their own view. */
export const REQUEST_IMPACTS = ['blocked', 'slowed', 'question'] as const;

export type RequestImpact = (typeof REQUEST_IMPACTS)[number];

/** Each impact as the form asks it. */
export const REQUEST_IMPACT_LABELS: Readonly<Record<RequestImpact, string>> = {
  blocked: "I'm blocked",
  slowed: "It's slowing me down",
  question: 'I have a question',
};

/**
 * The priority a request's impact suggests for its ticket. Only a
 * suggestion: the supervisor who turns it into a ticket sets the priority.
 */
export const SUGGESTED_PRIORITY: Readonly<
  Record<RequestImpact, TicketPriority>
> = {
  blocked: 'high',
  slowed: 'normal',
  question: 'low',
};

/**
 * Where a request is up to: waiting for a supervisor, turned into a
 * ticket, or dismissed. A request is never deleted.
 */
export const REQUEST_STATUSES = ['pending', 'ticket', 'dismissed'] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Why a supervisor dismissed a request instead of making it a ticket. */
export const DISMISS_REASONS = ['spam', 'duplicate', 'not-support'] as const;

export type DismissReason = (typeof DISMISS_REASONS)[number];

/** Each dismissal reason as supervisors pick it, and the customer sees it. */
export const DISMISS_REASON_LABELS: Readonly<Record<DismissReason, string>> = {
  spam: 'Spam',
  duplicate: 'Already reported',
  'not-support': 'Not a support request',
};

/** The longest name the form and the API accept. */
export const REQUEST_NAME_MAX_LENGTH = 100;

/** The longest email address (RFC 5321's limit for a path). */
export const REQUEST_EMAIL_MAX_LENGTH = 254;

/** The longest "Where it happened": a page, an order or account number. */
export const REQUEST_WHERE_MAX_LENGTH = 200;

/** A request's number as the customer sees it: `R-1042`. */
export function formatRequestReference(requestNumber: number): string {
  return `R-${requestNumber}`;
}

/** The largest request number the database can hold (a 4-byte integer). */
const MAX_REQUEST_NUMBER = 2_147_483_647;

/**
 * A reference as a customer may type it back (`R-1042`, `r-1042`,
 * `R1042` or `1042`, spaces around allowed) as its request number; `null`
 * for anything else.
 */
export function parseRequestReference(text: string): number | null {
  const match = /^\s*(?:r-?)?(\d{1,10})\s*$/i.exec(text);
  if (match === null) {
    return null;
  }
  const requestNumber = Number(match[1]);
  return requestNumber >= 1 && requestNumber <= MAX_REQUEST_NUMBER
    ? requestNumber
    : null;
}

/**
 * A new request, as the public form sends it. The server checks every
 * field: name, email and subject required, the description required and
 * within the tickets' limits, `where` optional, and consent given. Two
 * fields catch spam without a paid service: `website`, which the form
 * hides, so a person leaves it empty; and `openedAt`, when the form
 * opened, as a person takes a few seconds to fill it in.
 */
export interface CreateRequestRequest {
  name: string;
  email: string;
  category: RequestCategory;
  impact: RequestImpact;
  subject: string;
  description: string;
  /** Where it happened, such as a page or an order number; optional. */
  where: string | null;
  /** That the customer agreed to what is kept, and why. */
  consent: boolean;
  /** Hidden from people: must be empty. */
  website: string;
  openedAt: IsoDateTime;
}

/** The answer to a new request: its reference, never any ticket data. */
export interface CreateRequestResponse {
  reference: string;
}

/**
 * What "Check my request" tells a customer who gives a reference and the
 * email it was sent with: still waiting; turned into a ticket, with the
 * ticket's number and status; or dismissed, with why. A wrong email gets
 * the same answer as no such reference (404), so references can't be
 * tried one by one to learn who sent what.
 */
export type RequestStatusResponse =
  | { reference: string; status: 'pending' }
  | {
      reference: string;
      status: 'ticket';
      ticketNumber: number;
      ticketStatus: TicketStatus;
    }
  | { reference: string; status: 'dismissed'; reason: DismissReason };

/** An earlier request from the same customer, as a possible duplicate. */
export interface EarlierRequest {
  id: string;
  reference: string;
  subject: string;
  status: RequestStatus;
  createdAt: IsoDateTime;
}

/**
 * A request waiting in supervisors' New requests, with what might make it
 * a duplicate: the same customer's open tickets and earlier requests,
 * matched by email.
 */
export interface PendingRequest {
  id: string;
  reference: string;
  name: string;
  email: string;
  category: RequestCategory;
  impact: RequestImpact;
  subject: string;
  description: string;
  where: string | null;
  createdAt: IsoDateTime;
  possibleDuplicates: {
    openTickets: TicketDto[];
    earlierRequests: EarlierRequest[];
  };
}

/**
 * Turns a request into a ticket, as a supervisor confirms it: the queue
 * and the priority, both prefilled from the category and the impact. The
 * ticket starts `new` and Unassigned, its subject and description the
 * request's, and its customer found by email or created.
 */
export interface TurnIntoTicketRequest {
  queueId: string;
  priority: TicketPriority;
}

/**
 * Dismisses a request, with why; for a duplicate, the ticket it repeats.
 * Kept, with who dismissed it and when.
 */
export interface DismissRequestRequest {
  reason: DismissReason;
  /** For a duplicate only: the number of the ticket it repeats. */
  duplicateOfTicketNumber: number | null;
}

/** Who decided a request, and when: for the record kept with it. */
export interface RequestDecision {
  decidedBy: PersonSummary;
  decidedAt: IsoDateTime;
}

/** Whether a value, such as a request field, is a request category. */
export function isRequestCategory(value: unknown): value is RequestCategory {
  return (REQUEST_CATEGORIES as readonly unknown[]).includes(value);
}

/** Whether a value, such as a request field, is a request impact. */
export function isRequestImpact(value: unknown): value is RequestImpact {
  return (REQUEST_IMPACTS as readonly unknown[]).includes(value);
}

/** Whether a value, such as a request field, is a dismissal reason. */
export function isDismissReason(value: unknown): value is DismissReason {
  return (DISMISS_REASONS as readonly unknown[]).includes(value);
}
