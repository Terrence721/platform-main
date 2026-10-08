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
    id: 'tickets',
    icon: 'confirmation_number',
    title: 'Tickets and priorities',
    summary:
      'Every request gets a number, a priority and a due time. Agents see their own work most urgent first, beside the work nobody holds yet.',
  },
  {
    id: 'deadlines',
    icon: 'schedule',
    title: 'Deadlines you can see',
    summary:
      'Each ticket carries its SLA due time and shows the time left, so overdue work is marked and the most urgent comes first.',
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
      "Admins create accounts, change roles and teams, and deactivate people; supervisors and admins see each team's reports.",
  },
];
