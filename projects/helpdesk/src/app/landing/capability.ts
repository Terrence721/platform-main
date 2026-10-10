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
    id: 'customer-requests',
    icon: 'contact_support',
    title: 'Customers report issues',
    summary:
      'Customers describe a problem on the site, no account needed, and can attach screenshots. They get a reference to check on it, and a supervisor turns each one into a ticket or dismisses it.',
  },
  {
    id: 'tickets',
    icon: 'confirmation_number',
    title: 'Tickets, priorities and deadlines',
    summary:
      'Every request gets a number, a priority and a due time. Agents see their own work most urgent first, with the time left on each, so overdue work stands out.',
  },
  {
    id: 'replies-and-notes',
    icon: 'forum',
    title: 'Replies and internal notes',
    summary:
      'Answer the customer and leave internal notes for colleagues on the same ticket; customers never see the notes.',
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
    title: 'Accounts and reports in the same app',
    summary:
      "Admins create accounts, change roles and teams, and deactivate people; supervisors and admins see each team's reports, and how customer requests are handled.",
  },
];
