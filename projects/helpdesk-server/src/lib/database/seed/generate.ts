import { en, Faker } from '@faker-js/faker';
import {
  isUserId,
  OPEN_WORK_STATUSES,
  TicketPriority,
  TicketStatus,
  USER_ID_MAX_LENGTH,
} from '@helpdesk/contract';
import {
  NAMED_USERS,
  QUEUES,
  SeedCustomer,
  SeedMessage,
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
export const SLA_MINUTES: Record<TicketPriority, number> = {
  urgent: 4 * HOUR,
  high: DAY,
  normal: 3 * DAY,
  low: 7 * DAY,
};

/**
 * How old open work (new, open, pending) may be, as a share of its SLA. Up
 * to 1.25 × the SLA: about four in five are still on time, and the rest are
 * late by at most a quarter of their SLA, as on a team keeping up.
 */
export const OPEN_WORK_MAX_AGE_OF_SLA = 1.25;

/**
 * Of the finished tickets (resolved or closed), the share finished within
 * their SLA; the rest are late by up to as long again (at most twice the
 * SLA), as on a team that mostly keeps its promises.
 */
export const FINISHED_ON_TIME_SHARE = 0.85;

/**
 * How long after it was raised a finished ticket was finished, in
 * minutes: within its priority's SLA for FINISHED_ON_TIME_SHARE of them,
 * otherwise after it, by up to as long again.
 */
export function minutesToFinish(
  faker: Faker,
  priority: TicketPriority
): number {
  const sla = SLA_MINUTES[priority];
  return faker.number.float() < FINISHED_ON_TIME_SHARE
    ? faker.number.int({ min: 10, max: sla })
    : faker.number.int({ min: sla + 1, max: 2 * sla });
}

/** Whether a ticket still needs work: new, open or pending. */
const isOpenWork = (status: TicketStatus) =>
  (OPEN_WORK_STATUSES as readonly TicketStatus[]).includes(status);

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

/** What agents write back to customers, per queue. */
const REPLIES: Record<string, readonly string[]> = {
  accounts: [
    'I have unlocked your account; please try signing in again and let me know how it goes.',
    'Could you confirm the email address on the account, so I can make the change safely?',
  ],
  billing: [
    'I have checked your billing history and asked our billing team to correct it.',
    'A corrected invoice is on its way; you should have it within one business day.',
  ],
  product: [
    'Thanks for the details. I can reproduce this and have passed it to our product team.',
    'This is on our roadmap; I have added your vote and will update you when it ships.',
  ],
  technical: [
    'Could you send the time it last happened and any error message you saw?',
    'Our engineers found the cause, and a fix is being deployed today.',
  ],
  onboarding: [
    'Happy to help. I have sent you a short guide; shall we book a call to go through it?',
    'I have set that up for you; your team will see it the next time they sign in.',
  ],
  security: [
    'Thank you for flagging this. We have checked and secured the account as a precaution.',
    'I have shared our security documents with you through a secure link.',
  ],
};

/** What agents note for each other on a ticket. */
const NOTES: readonly string[] = [
  'Waiting on the customer before doing anything else.',
  'Asked engineering to take a look and linked this ticket for them.',
  'Known issue: same cause as a few other tickets this week.',
  'The customer also called; same question as in the ticket.',
  'Checked the logs; nothing unusual on our side.',
];

/** What a team's supervisor notes on their agents' tickets. */
const SUPERVISOR_NOTES: readonly string[] = [
  'Please keep the customer updated at least once a day on this one.',
  'This is a key account; let me know if it needs escalating.',
  'Good handling so far; close it once the customer confirms.',
];

/**
 * Up to three messages on a ticket someone is working: mostly the
 * assignee's replies, some notes, now and then one from their supervisor.
 * Each falls between the ticket's creation and its last update.
 */
function messagesFor(
  faker: Faker,
  ticket: SeedTicket,
  supervisorOf: ReadonlyMap<string, string>
): SeedMessage[] {
  const { assigneeId, createdMinutesAgo, updatedMinutesAgo } = ticket;
  if (
    assigneeId === null ||
    ticket.status === 'new' ||
    createdMinutesAgo <= updatedMinutesAgo
  ) {
    return [];
  }
  const howMany = faker.helpers.weightedArrayElement([
    { value: 0, weight: 20 },
    { value: 1, weight: 40 },
    { value: 2, weight: 25 },
    { value: 3, weight: 15 },
  ]);
  const times = Array.from({ length: howMany }, () =>
    faker.number.int({ min: updatedMinutesAgo, max: createdMinutesAgo - 1 })
  ).sort((a, b) => b - a); // Oldest first.

  return times.map((minutesAgo): SeedMessage => {
    if (faker.number.float() < 0.7) {
      return {
        kind: 'reply',
        body: faker.helpers.arrayElement(REPLIES[ticket.queueId]),
        authorId: assigneeId,
        minutesAgo,
      };
    }
    const supervisorId = supervisorOf.get(assigneeId);
    return supervisorId !== undefined && faker.number.float() < 0.25
      ? {
          kind: 'note',
          body: faker.helpers.arrayElement(SUPERVISOR_NOTES),
          authorId: supervisorId,
          minutesAgo,
        }
      : {
          kind: 'note',
          body: faker.helpers.arrayElement(NOTES),
          authorId: assigneeId,
          minutesAgo,
        };
  });
}

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

/**
 * Status by how old the ticket is: recent ones are still being worked;
 * anything older than two weeks is finished (resolved or closed).
 */
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
            ['resolved', 20],
            ['closed', 80],
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
    // Open work is recent: raised within about its SLA, so most of it is
    // on time and the late ones are only just late. Finished tickets keep
    // the age drawn above, over the whole history.
    const createdMinutesAgo = isOpenWork(status)
      ? 10 +
        Math.floor(
          SLA_MINUTES[priority] *
            OPEN_WORK_MAX_AGE_OF_SLA *
            faker.number.float()
        )
      : ageMinutes;
    // New tickets wait for someone to take them; a few others do too. Only
    // agents hold tickets: supervisors assign them, and one a supervisor
    // held would be stuck (#1065).
    const unassigned = status === 'new' || faker.number.float() < 0.05;
    const assigneeId = unassigned
      ? null
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
        faker.number.float() < 0.05
          ? null
          : SLA_MINUTES[priority] - createdMinutesAgo,
      createdMinutesAgo,
      // Open work last changed any time since it was raised. Finished work
      // last changed when it was finished: a realistic time after it was
      // raised (see minutesToFinish), and never later than now.
      updatedMinutesAgo: isOpenWork(status)
        ? faker.number.int({ min: 0, max: createdMinutesAgo })
        : Math.max(0, createdMinutesAgo - minutesToFinish(faker, priority)),
      messages: [],
    });
  }

  // Conversations, in a pass of their own so the tickets above stay the
  // same as before they were added. The showcase tickets bring their own.
  const supervisorOf = new Map(
    agents.flatMap((agent) => {
      const team = TEAMS.find(({ id }) => id === agent.teamId);
      return team ? [[agent.id, team.supervisorId] as const] : [];
    })
  );
  for (const ticket of tickets.slice(SHOWCASE_TICKETS.length)) {
    ticket.messages = messagesFor(faker, ticket, supervisorOf);
  }

  return { queues: QUEUES, teams: TEAMS, users, customers, tickets };
}
