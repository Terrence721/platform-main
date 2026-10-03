import { en, Faker } from '@faker-js/faker';
import {
  isUserId,
  TicketPriority,
  TicketStatus,
  USER_ID_MAX_LENGTH,
} from '@helpdesk/contract';
import {
  NAMED_USERS,
  QUEUES,
  SeedCustomer,
  SeedQueue,
  SeedTeam,
  SeedTicket,
  SeedUser,
  SHOWCASE_CUSTOMERS,
  SHOWCASE_TICKETS,
  TEAMS,
} from './story';

// The generated part of the seed, around the hand-written story: the rest
// of the agents, the customers and the ticket volume. Faker runs on a fixed
// seed, so every run produces exactly the same data.

export interface SeedData {
  queues: readonly SeedQueue[];
  teams: readonly SeedTeam[];
  users: SeedUser[];
  customers: SeedCustomer[];
  tickets: SeedTicket[];
}

export interface SeedOptions {
  /** Customers in all, the showcase ones included. */
  customers: number;
  /** Tickets in all, the showcase ones included. */
  tickets: number;
  /** Faker's seed: the same seed, the same data. */
  seed: number;
}

export const SEED_DEFAULTS: SeedOptions = {
  customers: 200,
  tickets: 1000,
  seed: 303,
};

/** Agents per team, the team's supervisor not counted. */
export const AGENTS_PER_TEAM = 10;

const HOUR = 60;
const DAY = 24 * HOUR;
/** How far back the ticket history goes. */
const HISTORY_DAYS = 182;

/** How long each priority may take before its SLA is missed, in minutes. */
const SLA_MINUTES: Record<TicketPriority, number> = {
  urgent: 4 * HOUR,
  high: DAY,
  normal: 3 * DAY,
  low: 7 * DAY,
};

/** Domains reserved for examples (RFC 2606), so no real inbox is used. */
const EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net'];

/** What customers write in about, per queue: a subject and a description. */
const TOPICS: Record<string, readonly (readonly [string, string])[]> = {
  accounts: [
    [
      'Locked out after too many attempts',
      'I typed my password wrong a few times and now my account is locked.',
    ],
    [
      'Change the email on our account',
      'Our contact person has left; please move the account to a new email address.',
    ],
    [
      'Two-factor codes are not arriving',
      'The sign-in code text message never arrives on my phone.',
    ],
    [
      'Merge two accounts',
      'We accidentally created a second account and would like to merge them.',
    ],
    [
      'Close my account',
      'Please close my account and confirm what happens to our data.',
    ],
  ],
  billing: [
    [
      'Invoice shows the wrong VAT number',
      'The VAT number on our latest invoice is not ours; please reissue it.',
    ],
    [
      'Charged after cancelling',
      'We cancelled last month but were charged again this month.',
    ],
    [
      'Switch to annual billing',
      'We would like to move from monthly to annual billing.',
    ],
    [
      'Payment failed with a valid card',
      'The card works elsewhere, but your checkout says the payment failed.',
    ],
    [
      'Need a copy of an old invoice',
      "Our accountant needs last year's invoices as PDFs.",
    ],
  ],
  product: [
    [
      'Dashboard is slow to load',
      'The main dashboard takes over a minute to load since the last update.',
    ],
    [
      'Search does not find recent items',
      'Items added today do not show up in search results.',
    ],
    [
      'Feature request: dark mode',
      'Our team works late; a dark theme would help a lot.',
    ],
    [
      'Report totals do not add up',
      'The monthly report total differs from the sum of its rows.',
    ],
    ['Notifications arrive twice', 'Every notification email arrives twice.'],
  ],
  technical: [
    [
      'Cannot connect the Slack integration',
      'Connecting Slack fails with an authorization error.',
    ],
    [
      'API returns 500 for large uploads',
      'Uploading files over 50 MB through the API fails with a server error.',
    ],
    [
      'Webhook deliveries are delayed',
      'Webhooks arrive up to an hour after the event.',
    ],
    [
      'SSO login loops back to the start',
      'Signing in through our identity provider sends us back to the login page.',
    ],
    [
      'Mobile app crashes on launch',
      'The app closes straight away after the latest update.',
    ],
  ],
  onboarding: [
    [
      'Help importing our old tickets',
      'We are moving from another tool and need to import three years of tickets.',
    ],
    [
      'Training session for new agents',
      'Could you run a short training session for five new agents?',
    ],
    [
      'How do queues and teams work?',
      'We are setting up and are not sure how to organize queues and teams.',
    ],
    [
      'Set up canned replies',
      'Where do we add the replies we send most often?',
    ],
    [
      'Invite the rest of the team',
      'How do I invite twenty colleagues at once?',
    ],
  ],
  security: [
    [
      'Suspicious sign-in from abroad',
      'We received an alert about a sign-in from a country nobody is in.',
    ],
    [
      'Remove access for a former employee',
      'Please confirm a former employee can no longer sign in.',
    ],
    [
      'Request our security documentation',
      'Our auditors ask for your security and data-handling documents.',
    ],
    [
      'Enforce two-factor for everyone',
      'Can we require two-factor sign-in for all our users?',
    ],
    [
      'Phishing email using your name',
      'We received an email pretending to be from you; is it genuine?',
    ],
  ],
};

/** Tags a queue's tickets carry, a few at a time. */
const TAGS: Record<string, readonly string[]> = {
  accounts: ['sign-in', 'admin', 'profile', '2fa'],
  billing: ['invoice', 'refund', 'payment', 'plan'],
  product: ['bug', 'feature-request', 'performance', 'reports'],
  technical: ['integration', 'api', 'sso', 'mobile'],
  onboarding: ['import', 'training', 'setup'],
  security: ['access', 'audit', 'phishing', '2fa'],
};

/** A unique, valid user ID from a name: `first.last`, then `first.last2`… */
function userIdFor(first: string, last: string, taken: Set<string>): string {
  const clean = (part: string) => part.toLowerCase().replace(/[^a-z]/g, '');
  const base = `${clean(first)}.${clean(last)}`.slice(
    0,
    USER_ID_MAX_LENGTH - 2
  );
  let id = base;
  for (let n = 2; taken.has(id) || !isUserId(id); n++) {
    id = `${base}${n}`;
  }
  taken.add(id);
  return id;
}

/** Status by how old the ticket is: recent ones are still being worked. */
function statusFor(faker: Faker, ageMinutes: number): TicketStatus {
  const weights: [TicketStatus, number][] =
    ageMinutes < 2 * DAY
      ? [
          ['new', 25],
          ['open', 40],
          ['pending', 20],
          ['resolved', 15],
        ]
      : ageMinutes < 14 * DAY
        ? [
            ['open', 25],
            ['pending', 20],
            ['resolved', 40],
            ['closed', 15],
          ]
        : [
            ['open', 3],
            ['pending', 2],
            ['resolved', 20],
            ['closed', 75],
          ];
  return faker.helpers.weightedArrayElement(
    weights.map(([value, weight]) => ({ value, weight }))
  );
}

/** The volume of the seed around the story; the same for the same options. */
export function generateSeed(options: Partial<SeedOptions> = {}): SeedData {
  const {
    customers: customerCount,
    tickets: ticketCount,
    seed,
  } = {
    ...SEED_DEFAULTS,
    ...options,
  };
  const faker = new Faker({ locale: [en], seed });

  // Users: the named ones, then agents until every team has its ten.
  const taken = new Set(NAMED_USERS.map((user) => user.id));
  const users: SeedUser[] = [...NAMED_USERS];
  for (const team of TEAMS) {
    const inTeam = users.filter(
      (user) => user.role === 'agent' && user.teamId === team.id
    ).length;
    for (let i = inTeam; i < AGENTS_PER_TEAM; i++) {
      const first = faker.person.firstName();
      const last = faker.person.lastName();
      users.push({
        id: userIdFor(first, last, taken),
        name: `${first} ${last}`,
        role: 'agent',
        teamId: team.id,
      });
    }
  }
  const agents = users.filter((user) => user.role === 'agent');
  const supervisors = users.filter((user) => user.role === 'supervisor');

  // Customers: the showcase ones, then fictional people on example domains.
  const emails = new Set(SHOWCASE_CUSTOMERS.map((customer) => customer.email));
  const customers: SeedCustomer[] = [...SHOWCASE_CUSTOMERS];
  while (customers.length < customerCount) {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    const domain = faker.helpers.arrayElement(EMAIL_DOMAINS);
    let email = `${first}.${last}@${domain}`
      .toLowerCase()
      .replace(/[^a-z0-9.@]/g, '');
    for (let n = 2; emails.has(email); n++) {
      email = email.replace(/(\d*)@/, `${n}@`);
    }
    emails.add(email);
    customers.push({ name: `${first} ${last}`, email });
  }

  // Tickets: the showcase ones, then the history, newest weighted heavier.
  const tickets: SeedTicket[] = [...SHOWCASE_TICKETS];
  while (tickets.length < ticketCount) {
    const queue = faker.helpers.arrayElement(QUEUES);
    const [subject, description] = faker.helpers.arrayElement(TOPICS[queue.id]);
    const ageMinutes =
      10 + Math.floor(HISTORY_DAYS * DAY * faker.number.float() ** 2);
    const status = statusFor(faker, ageMinutes);
    const priority = faker.helpers.weightedArrayElement<TicketPriority>([
      { value: 'low', weight: 25 },
      { value: 'normal', weight: 45 },
      { value: 'high', weight: 22 },
      { value: 'urgent', weight: 8 },
    ]);
    // New tickets wait for someone to take them; a few others do too.
    const unassigned = status === 'new' || faker.number.float() < 0.05;
    const assigneeId = unassigned
      ? null
      : faker.number.float() < 0.05
        ? faker.helpers.arrayElement(supervisors).id
        : faker.helpers.arrayElement(agents).id;

    tickets.push({
      subject,
      description,
      status,
      priority,
      requesterEmail: faker.helpers.arrayElement(customers).email,
      assigneeId,
      queueId: queue.id,
      tags: faker.helpers.arrayElements(TAGS[queue.id], { min: 0, max: 2 }),
      // Due a priority's SLA after it was raised; a few have no SLA.
      slaDueInMinutes:
        faker.number.float() < 0.05 ? null : SLA_MINUTES[priority] - ageMinutes,
      createdMinutesAgo: ageMinutes,
      updatedMinutesAgo: faker.number.int({ min: 0, max: ageMinutes }),
    });
  }

  return { queues: QUEUES, teams: TEAMS, users, customers, tickets };
}
