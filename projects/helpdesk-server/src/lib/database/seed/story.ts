import type {
  AttachmentMediaType,
  RequestCategory,
  RequestImpact,
  Role,
  TicketMessageKind,
  TicketPriority,
  TicketStatus,
} from '@helpdesk/contract';
import { ORDERS_EXPORT_PNG_BASE64 } from './orders-export-screenshot';

// The hand-written part of the seed: the people and tickets that tell the
// Helpdesk's story, the same on every run. generate.ts adds the volume
// around them. All names are fictional except the four showcase customers,
// who match the landing page's "My tickets" preview.

export interface SeedQueue {
  id: string;
  name: string;
}

export interface SeedTeam {
  id: string;
  name: string;
  /** The user ID of the supervisor who leads it. */
  supervisorId: string;
}

export interface SeedUser {
  id: string;
  name: string;
  role: Role;
  /** `null` for admins, who belong to no team. */
  teamId: string | null;
}

export interface SeedCustomer {
  name: string;
  email: string;
}

/**
 * A reply or internal note on a ticket, written by staff. It falls between
 * the ticket's creation and its last update.
 */
export interface SeedMessage {
  kind: TicketMessageKind;
  body: string;
  /** The user ID of the staff member who wrote it. */
  authorId: string;
  minutesAgo: number;
}

/** A ticket whose times are minutes from "now", so it stays current. */
export interface SeedTicket {
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterEmail: string;
  assigneeId: string | null;
  queueId: string;
  tags: string[];
  /** Minutes from now; negative is overdue. `null`: no SLA. */
  slaDueInMinutes: number | null;
  createdMinutesAgo: number;
  updatedMinutesAgo: number;
  /** The conversation after the description, oldest first. */
  messages: SeedMessage[];
}

export const QUEUES: readonly SeedQueue[] = [
  { id: 'accounts', name: 'Accounts' },
  { id: 'billing', name: 'Billing' },
  { id: 'product', name: 'Product' },
  { id: 'technical', name: 'Technical support' },
  { id: 'onboarding', name: 'Onboarding' },
  { id: 'security', name: 'Security and access' },
];

export const TEAMS: readonly SeedTeam[] = [
  { id: 'atlas', name: 'Team Atlas', supervisorId: 'chris.taylor' },
  { id: 'beacon', name: 'Team Beacon', supervisorId: 'nina.patel' },
  { id: 'comet', name: 'Team Comet', supervisorId: 'omar.haddad' },
  { id: 'delta', name: 'Team Delta', supervisorId: 'lena.fischer' },
];

/** Admins and supervisors, and the one agent the showcase follows. */
export const NAMED_USERS: readonly SeedUser[] = [
  { id: 'alex.morgan', name: 'Alex Morgan', role: 'admin', teamId: null },
  { id: 'priya.shah', name: 'Priya Shah', role: 'admin', teamId: null },
  { id: 'jordan.lee', name: 'Jordan Lee', role: 'admin', teamId: null },
  { id: 'maria.garcia', name: 'Maria Garcia', role: 'admin', teamId: null },
  {
    id: 'chris.taylor',
    name: 'Chris Taylor',
    role: 'supervisor',
    teamId: 'atlas',
  },
  {
    id: 'nina.patel',
    name: 'Nina Patel',
    role: 'supervisor',
    teamId: 'beacon',
  },
  {
    id: 'omar.haddad',
    name: 'Omar Haddad',
    role: 'supervisor',
    teamId: 'comet',
  },
  {
    id: 'lena.fischer',
    name: 'Lena Fischer',
    role: 'supervisor',
    teamId: 'delta',
  },
  { id: 'sam.rivera', name: 'Sam Rivera', role: 'agent', teamId: 'atlas' },
];

const SHOWCASE_AGENT = 'sam.rivera';
const HOUR = 60;
const DAY = 24 * HOUR;

/**
 * The landing page's "My tickets" preview, as real tickets. The app keeps
 * its own copy for the landing page (showcase-tickets.ts), and a spec there
 * checks the two match. Their due times are chosen to show each state on the
 * preview (overdue, due soon, on track), not computed from the priorities'
 * SLAs as generate.ts does.
 */
export const SHOWCASE_CUSTOMERS: readonly SeedCustomer[] = [
  { name: 'Ada Lovelace', email: 'ada@example.com' },
  { name: 'Grace Hopper', email: 'grace@example.com' },
  { name: 'Alan Turing', email: 'alan@example.com' },
  { name: 'Katherine Johnson', email: 'katherine@example.com' },
];

export const SHOWCASE_TICKETS: readonly SeedTicket[] = [
  {
    subject: 'Cannot sign in after password reset',
    description:
      'The reset link worked, but signing in with the new password says it is wrong.',
    status: 'open',
    priority: 'urgent',
    requesterEmail: 'ada@example.com',
    assigneeId: SHOWCASE_AGENT,
    queueId: 'accounts',
    tags: ['sign-in'],
    slaDueInMinutes: -25,
    createdMinutesAgo: 5 * HOUR,
    updatedMinutesAgo: 40,
    messages: [
      {
        kind: 'reply',
        body: 'Sorry about that, Ada. Which browser are you signing in with, and does a private window behave the same?',
        authorId: SHOWCASE_AGENT,
        minutesAgo: 4 * HOUR,
      },
      {
        kind: 'note',
        body: 'Checked the auth logs: the reset kept the old password hash. Escalating to the accounts team.',
        authorId: SHOWCASE_AGENT,
        minutesAgo: 40,
      },
    ],
  },
  {
    subject: 'Refund for a double charge',
    description: 'My card was charged twice for the October invoice.',
    status: 'pending',
    priority: 'high',
    requesterEmail: 'grace@example.com',
    assigneeId: SHOWCASE_AGENT,
    queueId: 'billing',
    tags: ['refund'],
    slaDueInMinutes: 2 * HOUR,
    createdMinutesAgo: 26 * HOUR,
    updatedMinutesAgo: 3 * HOUR,
    messages: [
      {
        kind: 'reply',
        body: 'I can see both charges. I have asked billing to refund the second one; it can take up to five business days.',
        authorId: SHOWCASE_AGENT,
        minutesAgo: 25 * HOUR,
      },
      {
        kind: 'note',
        body: 'Refund requested in the billing system for the duplicate October charge.',
        authorId: SHOWCASE_AGENT,
        minutesAgo: 24 * HOUR,
      },
      {
        kind: 'reply',
        body: 'The refund has gone through on our side. Could you let me know once it shows on your statement?',
        authorId: SHOWCASE_AGENT,
        minutesAgo: 3 * HOUR,
      },
    ],
  },
  {
    subject: 'Export to CSV leaves out the last row',
    description: 'Exporting a filtered report drops its final row every time.',
    status: 'open',
    priority: 'normal',
    requesterEmail: 'alan@example.com',
    assigneeId: SHOWCASE_AGENT,
    queueId: 'product',
    tags: ['export', 'bug'],
    slaDueInMinutes: 28 * HOUR,
    createdMinutesAgo: 2 * DAY,
    updatedMinutesAgo: 6 * HOUR,
    messages: [
      {
        kind: 'reply',
        body: 'Thanks, Alan. I can reproduce it whenever a filter is on, and I have passed it to our product team.',
        authorId: SHOWCASE_AGENT,
        minutesAgo: 46 * HOUR,
      },
      {
        kind: 'note',
        body: 'Product confirmed the bug; the fix is planned for the next release. Please keep Alan updated.',
        authorId: 'chris.taylor',
        minutesAgo: 6 * HOUR,
      },
    ],
  },
  {
    subject: 'How do I add a second admin?',
    description: 'We need a second person who can manage our team accounts.',
    status: 'pending',
    priority: 'low',
    requesterEmail: 'katherine@example.com',
    assigneeId: SHOWCASE_AGENT,
    queueId: 'accounts',
    tags: ['admin'],
    slaDueInMinutes: 3 * DAY,
    createdMinutesAgo: 4 * DAY,
    updatedMinutesAgo: DAY,
    messages: [
      {
        kind: 'reply',
        body: 'Any admin can do this under Settings, Team, Invite, choosing the Admin role. Does that work for you?',
        authorId: SHOWCASE_AGENT,
        minutesAgo: DAY,
      },
    ],
  },
];

/**
 * A request a customer sent through the public form (#1026), still waiting
 * for a supervisor. Sent `createdMinutesAgo`, and agreed to then.
 */
export interface SeedRequest {
  name: string;
  email: string;
  category: RequestCategory;
  impact: RequestImpact;
  subject: string;
  description: string;
  where: string | null;
  createdMinutesAgo: number;
  /** The files sent with it; none if absent. */
  attachments?: readonly SeedAttachment[];
}

/** A file sent with a request: its name, type, and bytes as base64. */
export interface SeedAttachment {
  fileName: string;
  mediaType: AttachmentMediaType;
  base64: string;
}

/**
 * New requests' first visitors, all pending. Grace Hopper writes again
 * about the double charge her open ticket is already about, so New requests
 * shows a possible duplicate; the others are new to the help desk. Mei
 * Chen sends a screenshot, so New requests has a file to show.
 */
export const SEED_REQUESTS: readonly SeedRequest[] = [
  {
    name: 'Mei Chen',
    email: 'mei.chen@example.com',
    category: 'bug',
    impact: 'blocked',
    subject: 'Export to CSV stops at 1,000 rows',
    description:
      'Exporting the orders report gives a file with exactly 1,000 rows; we have about 4,300 orders this month.',
    where: 'Reports > Orders > Export',
    createdMinutesAgo: 3 * HOUR,
    attachments: [
      {
        fileName: 'orders-export.png',
        mediaType: 'image/png',
        base64: ORDERS_EXPORT_PNG_BASE64,
      },
    ],
  },
  {
    name: 'Grace Hopper',
    email: 'grace@example.com',
    category: 'billing',
    impact: 'slowed',
    subject: 'Charged twice again?',
    description:
      'I see two charges for October on my statement. Is this the same problem as before?',
    where: 'Invoice INV-2026-10',
    createdMinutesAgo: 2 * HOUR,
  },
  {
    name: 'Tom Herrera',
    email: 'tom.herrera@example.com',
    category: 'feature',
    impact: 'question',
    subject: 'Can invoices show our VAT number?',
    description:
      'Our accountant needs our VAT number on every invoice. Is there a setting for it?',
    where: null,
    createdMinutesAgo: 50,
  },
  {
    name: 'Priya Nair',
    email: 'priya.nair@example.com',
    category: 'account',
    impact: 'blocked',
    subject: 'Locked out after changing my phone',
    description:
      'I changed phones and my sign-in codes now go to the old number. I cannot get into my account.',
    where: 'Sign-in page',
    createdMinutesAgo: 15,
  },
];
