import type { TicketStatus } from '@helpdesk/contract';

/**
 * Each status as the app names it: in the ticket table, the ticket popup,
 * the "is now …" messages, and the landing page's workflow section.
 */
export const STATUS_LABELS: Readonly<Record<TicketStatus, string>> = {
  new: 'New',
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};
