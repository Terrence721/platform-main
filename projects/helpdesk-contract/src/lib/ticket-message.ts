import { IsoDateTime, PersonSummary } from './ticket-api';

/**
 * What a message on a ticket is. A `reply` is written to the customer and
 * kept on the ticket (no email is sent); a `note` is internal, for staff
 * only.
 */
export const TICKET_MESSAGE_KINDS = ['reply', 'note'] as const;

export type TicketMessageKind = (typeof TICKET_MESSAGE_KINDS)[number];

/** The longest message the app's form and the API's validation accept. */
export const TICKET_MESSAGE_MAX_LENGTH = 5_000;

/**
 * One message in a ticket's conversation, as the API returns it. The
 * customer's first message is the ticket's description, so it is not
 * repeated here.
 */
export interface TicketMessage {
  id: string;
  kind: TicketMessageKind;
  body: string;
  /** The staff member who wrote it. */
  author: PersonSummary;
  createdAt: IsoDateTime;
}

/**
 * Adds a reply or an internal note to a ticket. The agent who holds the
 * ticket, or their team's supervisor, may do it.
 */
export interface AddTicketMessageRequest {
  kind: TicketMessageKind;
  body: string;
}

/** Whether a value, such as a request field, is a ticket message kind. */
export function isTicketMessageKind(
  value: unknown
): value is TicketMessageKind {
  return (TICKET_MESSAGE_KINDS as readonly unknown[]).includes(value);
}
