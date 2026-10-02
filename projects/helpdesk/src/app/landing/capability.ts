/** Something Helpdesk does: one card in the landing page's features section. */
export interface Capability {
  id: string;
  /** A Material icon name. */
  icon: string;
  title: string;
  summary: string;
}

/** The @ngrx/data entity name the capabilities are stored under. */
export const CAPABILITY = 'Capability';

/** What Helpdesk does, in the order the landing page shows it. */
export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'tickets-and-queues',
    icon: 'confirmation_number',
    title: 'Tickets and queues',
    summary:
      'Every request gets a number, a priority and a queue. Filter by status, assignee or queue, and search subjects and descriptions.',
  },
  {
    id: 'deadlines',
    icon: 'schedule',
    title: 'Deadlines you can see',
    summary:
      'Each ticket carries its SLA due time, so overdue and nearly-due work stands out before a customer has to chase it.',
  },
  {
    id: 'replies-and-notes',
    icon: 'forum',
    title: 'Replies and internal notes',
    summary:
      'Answer the customer and leave notes for colleagues on the same ticket, with canned replies for the questions you hear every day.',
  },
  {
    id: 'ownership',
    icon: 'assignment_ind',
    title: 'Clear ownership',
    summary:
      'Agents take tickets themselves; supervisors move work between people when someone is swamped or away.',
  },
  {
    id: 'live-updates',
    icon: 'bolt',
    title: 'Live updates',
    summary:
      'When a colleague replies, reassigns or closes a ticket, your screen changes too, without a refresh.',
  },
  {
    id: 'admin',
    icon: 'admin_panel_settings',
    title: 'Admin in the same app',
    summary:
      "Admins manage queues, customers, canned replies and the team's accounts without a separate console.",
  },
];
