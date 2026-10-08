import type { TicketDto } from '@helpdesk/contract';

const MINUTE = 60_000;

/** The agent whose queue the landing page's "My tickets" preview shows. */
const AGENT = { id: 'agent-sam', name: 'Sam Rivera' };

/**
 * The tickets the landing page shows off, as the API will return them. Times
 * are relative to `now`, so a ticket meant to be overdue still is whenever
 * the page is opened.
 */
export function showcaseTickets(now: Date): TicketDto[] {
  const at = (minutes: number) =>
    new Date(now.getTime() + minutes * MINUTE).toISOString();

  return [
    {
      id: 'showcase-1042',
      ticketNumber: 1042,
      subject: 'Cannot sign in after password reset',
      description:
        'The reset link worked, but signing in with the new password says it is wrong.',
      status: 'open',
      priority: 'urgent',
      requester: {
        id: 'customer-ada',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      },
      assignee: AGENT,
      queue: { id: 'queue-accounts', name: 'Accounts' },
      tags: ['sign-in'],
      slaDueAt: at(-25),
      createdAt: at(-5 * 60),
      updatedAt: at(-40),
    },
    {
      id: 'showcase-1039',
      ticketNumber: 1039,
      subject: 'Refund for a double charge',
      description: 'My card was charged twice for the October invoice.',
      status: 'pending',
      priority: 'high',
      requester: {
        id: 'customer-grace',
        name: 'Grace Hopper',
        email: 'grace@example.com',
      },
      assignee: AGENT,
      queue: { id: 'queue-billing', name: 'Billing' },
      tags: ['refund'],
      slaDueAt: at(2 * 60),
      createdAt: at(-26 * 60),
      updatedAt: at(-3 * 60),
    },
    {
      id: 'showcase-1035',
      ticketNumber: 1035,
      subject: 'Export to CSV leaves out the last row',
      description:
        'Exporting a filtered report drops its final row every time.',
      status: 'open',
      priority: 'normal',
      requester: {
        id: 'customer-alan',
        name: 'Alan Turing',
        email: 'alan@example.com',
      },
      assignee: AGENT,
      queue: { id: 'queue-product', name: 'Product' },
      tags: ['export', 'bug'],
      slaDueAt: at(28 * 60),
      createdAt: at(-2 * 24 * 60),
      updatedAt: at(-6 * 60),
    },
    {
      id: 'showcase-1031',
      ticketNumber: 1031,
      subject: 'How do I add a second admin?',
      description: 'We need a second person who can manage our team accounts.',
      status: 'pending',
      priority: 'low',
      requester: {
        id: 'customer-katherine',
        name: 'Katherine Johnson',
        email: 'katherine@example.com',
      },
      assignee: AGENT,
      queue: { id: 'queue-accounts', name: 'Accounts' },
      tags: ['admin'],
      slaDueAt: at(3 * 24 * 60),
      createdAt: at(-4 * 24 * 60),
      updatedAt: at(-24 * 60),
    },
  ];
}
