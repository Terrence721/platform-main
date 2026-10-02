/** The stages a ticket moves through, in workflow order. */
export const TICKET_STATUSES = [
  'new',
  'open',
  'pending',
  'resolved',
  'closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** How urgent a ticket is, lowest first. */
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/**
 * The statuses each status may change to. A resolved ticket can be reopened;
 * a closed one is final. Staying on the same status is not a change, so no
 * status lists itself.
 */
export const TICKET_STATUS_TRANSITIONS: Readonly<
  Record<TicketStatus, readonly TicketStatus[]>
> = {
  new: ['open', 'closed'],
  open: ['pending', 'resolved', 'closed'],
  pending: ['open', 'resolved', 'closed'],
  resolved: ['open', 'closed'],
  closed: [],
};

/** Whether a value, such as a request field, is a ticket status. */
export function isTicketStatus(value: unknown): value is TicketStatus {
  return (TICKET_STATUSES as readonly unknown[]).includes(value);
}

/** Whether a value, such as a request field, is a ticket priority. */
export function isTicketPriority(value: unknown): value is TicketPriority {
  return (TICKET_PRIORITIES as readonly unknown[]).includes(value);
}

/** Whether a ticket may change from one status to another. */
export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_STATUS_TRANSITIONS[from].includes(to);
}
