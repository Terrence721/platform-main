import { PGlite } from '@electric-sql/pglite';
import type { CreateRequestRequest, CurrentUser } from '@helpdesk/contract';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import {
  customers,
  queues,
  requests,
  teams,
  tickets,
  users,
} from '../database/schema';
import { SLA_MINUTES } from '../database/seed/generate';
import type { LiveEvents } from '../live/live-events';
import { CustomerRequestsService } from './customer-requests.service';

const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** "Now" for these tests. */
const NOW = new Date('2026-10-09T12:00:00.000Z');

/** Chris, the supervisor who decides. */
const chris: CurrentUser = {
  id: 'chris.taylor',
  name: 'Chris Taylor',
  role: 'supervisor',
  teamId: 'atlas',
};

/** A request as the public form sends it, read and checked. */
const sent = (changes: Partial<CreateRequestRequest> = {}) =>
  ({
    name: 'Dana Whitfield',
    email: 'dana@example.com',
    category: 'billing',
    impact: 'blocked',
    subject: 'Charged twice',
    description: 'My card was charged twice this month.',
    where: 'Invoice INV-2026-10',
    consent: true,
    website: '',
    openedAt: '2026-10-09T11:58:00.000Z',
    ...changes,
  }) satisfies CreateRequestRequest;

// Customer requests (#1026): what a customer sends, what they can check,
// and what a supervisor decides. Each test starts from the same people
// and Grace's tickets, with no requests yet.
describe('CustomerRequestsService', { timeout: 60_000 }, () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle>;
  let service: CustomerRequestsService;
  const live = { publish: vi.fn() };
  /** Grace's open ticket and her finished one. */
  let graceOpen: { id: string; ticketNumber: number };

  beforeAll(async () => {
    client = new PGlite();
    database = drizzle(client);
    await migrate(database, { migrationsFolder: MIGRATIONS });
    await database.insert(queues).values([
      { id: 'billing', name: 'Billing' },
      { id: 'technical', name: 'Technical support' },
    ]);
    await database.insert(teams).values({ id: 'atlas', name: 'Atlas' });
    await database.insert(users).values({
      ...chris,
      passwordHash: 'x',
    });
    const [grace] = await database
      .insert(customers)
      .values({ name: 'Grace Hopper', email: 'grace@example.com' })
      .returning({ id: customers.id });
    const ticket = (status: 'open' | 'resolved', subject: string) => ({
      subject,
      description: subject,
      status,
      priority: 'high' as const,
      requesterId: grace.id,
      queueId: 'billing',
    });
    [graceOpen] = await database
      .insert(tickets)
      .values(ticket('open', 'Refund for a double charge'))
      .returning({ id: tickets.id, ticketNumber: tickets.ticketNumber });
    await database
      .insert(tickets)
      .values(ticket('resolved', 'An old question'));
    service = new CustomerRequestsService(
      database,
      live as unknown as LiveEvents
    );
  });

  beforeEach(async () => {
    live.publish.mockClear();
    await database.delete(requests);
  });

  afterAll(() => client.close());

  /** Sends a request at `minutesAgo`, and answers with its id. */
  async function sentAt(
    changes: Partial<CreateRequestRequest>,
    minutesAgo: number
  ): Promise<string> {
    const at = new Date(NOW.getTime() - minutesAgo * 60_000);
    const { reference } = await service.send(sent(changes), at);
    const [row] = await database
      .select({ id: requests.id })
      .from(requests)
      .where(eq(requests.requestNumber, Number(reference.slice(2))));
    return row.id;
  }

  describe('send', () => {
    it('keeps the request, pending, agreed to as it was sent, and answers with its reference', async () => {
      const { reference } = await service.send(sent(), NOW);

      expect(reference).toMatch(/^R-\d+$/);
      const [row] = await database.select().from(requests);
      expect(row).toMatchObject({
        name: 'Dana Whitfield',
        email: 'dana@example.com',
        category: 'billing',
        impact: 'blocked',
        where: 'Invoice INV-2026-10',
        status: 'pending',
        consentedAt: NOW,
        createdAt: NOW,
        decidedById: null,
      });
      expect(`R-${row.requestNumber}`).toBe(reference);
    });
  });

  describe('statusOf', () => {
    it('tells the customer it is waiting, however they type the reference and email', async () => {
      const { reference } = await service.send(sent(), NOW);
      const typed = ` ${reference.toLowerCase().replace('-', '')} `;

      expect(await service.statusOf(typed, ' DANA@example.com ')).toEqual({
        reference,
        status: 'pending',
      });
    });

    // A wrong email answers as no such reference, so references can't be
    // tried one by one to learn who sent what.
    it.each([
      ['a wrong email', 'R-SAME', 'someone@example.com'],
      ['no such reference', 'R-999999', 'dana@example.com'],
      ['no reference at all', 'not one', 'dana@example.com'],
    ])('answers nothing for %s', async (_, reference, email) => {
      const { reference: real } = await service.send(sent(), NOW);

      expect(
        await service.statusOf(reference.replace('R-SAME', real), email)
      ).toBeNull();
    });

    it("says which ticket it became, and that ticket's status", async () => {
      const id = await sentAt({}, 5);
      const { reference } = (await service.pending())[0];
      const ticket = await service.turnIntoTicket(
        id,
        { queueId: 'billing', priority: 'high' },
        chris,
        NOW
      );

      expect(await service.statusOf(reference, 'dana@example.com')).toEqual({
        reference,
        status: 'ticket',
        ticketNumber: ticket.ticketNumber,
        ticketStatus: 'new',
      });
    });

    it('says why it was dismissed', async () => {
      const id = await sentAt({}, 5);
      const { reference } = (await service.pending())[0];
      await service.dismiss(
        id,
        { reason: 'not-support', duplicateOfTicketNumber: null },
        chris,
        NOW
      );

      expect(await service.statusOf(reference, 'dana@example.com')).toEqual({
        reference,
        status: 'dismissed',
        reason: 'not-support',
      });
    });
  });

  describe('pending', () => {
    it('lists the requests still waiting, oldest first', async () => {
      await sentAt({ subject: 'Newer' }, 5);
      const decided = await sentAt({ subject: 'Decided' }, 20);
      await sentAt({ subject: 'Oldest' }, 30);
      await service.dismiss(
        decided,
        { reason: 'spam', duplicateOfTicketNumber: null },
        chris,
        NOW
      );

      expect((await service.pending()).map(({ subject }) => subject)).toEqual([
        'Oldest',
        'Newer',
      ]);
    });

    it("shows the same customer's open tickets and other requests as possible duplicates", async () => {
      await sentAt(
        { email: 'grace@example.com', subject: 'Charged twice?' },
        60
      );
      await sentAt(
        { email: 'grace@example.com', subject: 'Charged twice again?' },
        5
      );

      const [, again] = await service.pending();

      expect(again.subject).toBe('Charged twice again?');
      expect(
        again.possibleDuplicates.openTickets.map(({ subject }) => subject)
      ).toEqual(['Refund for a double charge']);
      expect(
        again.possibleDuplicates.earlierRequests.map(({ subject }) => subject)
      ).toEqual(['Charged twice?']);
    });

    // An address no other test uses: tickets made from Dana's requests
    // stay from test to test, as only the requests are cleared.
    it('shows none for a customer new to the help desk', async () => {
      await sentAt({ email: 'first.time@example.com' }, 5);

      expect((await service.pending())[0].possibleDuplicates).toEqual({
        openTickets: [],
        earlierRequests: [],
      });
    });
  });

  describe('turnIntoTicket', () => {
    it('makes a new, unassigned ticket of it, due as its priority says, for the customer it finds', async () => {
      const id = await sentAt({ email: 'grace@example.com' }, 5);

      const ticket = await service.turnIntoTicket(
        id,
        { queueId: 'technical', priority: 'urgent' },
        chris,
        NOW
      );

      expect(ticket).toMatchObject({
        subject: 'Charged twice',
        description: 'My card was charged twice this month.',
        status: 'new',
        priority: 'urgent',
        queue: { id: 'technical' },
        requester: { name: 'Grace Hopper', email: 'grace@example.com' },
        assignee: null,
        slaDueAt: new Date(
          NOW.getTime() + SLA_MINUTES.urgent * 60_000
        ).toISOString(),
      });
      const [request] = await database
        .select()
        .from(requests)
        .where(eq(requests.id, id));
      expect(request).toMatchObject({
        status: 'ticket',
        ticketId: ticket.id,
        decidedById: 'chris.taylor',
        decidedAt: NOW,
      });
    });

    it('makes a customer of someone new, with the name they gave', async () => {
      const id = await sentAt(
        { name: 'Mei Chen', email: 'mei.chen@example.com' },
        5
      );

      const ticket = await service.turnIntoTicket(
        id,
        { queueId: 'billing', priority: 'normal' },
        chris,
        NOW
      );

      expect(ticket.requester).toMatchObject({
        name: 'Mei Chen',
        email: 'mei.chen@example.com',
      });
    });

    // It joins Unassigned, which every agent and supervisor sees.
    it('tells the pages of unassigned work about the new ticket', async () => {
      const id = await sentAt({}, 5);

      const ticket = await service.turnIntoTicket(
        id,
        { queueId: 'billing', priority: 'normal' },
        chris,
        NOW
      );

      expect(live.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          event: { type: 'ticket', ticketId: ticket.id },
          audience: expect.objectContaining({ unassigned: true }),
        })
      );
    });

    it('refuses a request already decided (409), changing nothing', async () => {
      const id = await sentAt({}, 5);
      await service.dismiss(
        id,
        { reason: 'spam', duplicateOfTicketNumber: null },
        chris,
        NOW
      );
      const before = await database.select({ id: tickets.id }).from(tickets);

      await expect(
        service.turnIntoTicket(
          id,
          { queueId: 'billing', priority: 'normal' },
          chris,
          NOW
        )
      ).rejects.toThrow(ConflictException);
      expect(await database.select({ id: tickets.id }).from(tickets)).toEqual(
        before
      );
    });

    it.each(['not-a-uuid', '00000000-0000-4000-8000-000000000000'])(
      'answers 404 for no such request (%s)',
      async (id) => {
        await expect(
          service.turnIntoTicket(
            id,
            { queueId: 'billing', priority: 'normal' },
            chris,
            NOW
          )
        ).rejects.toThrow(NotFoundException);
      }
    );

    it('refuses a queue that does not exist (400), leaving it pending', async () => {
      const id = await sentAt({}, 5);

      await expect(
        service.turnIntoTicket(
          id,
          { queueId: 'nowhere', priority: 'normal' },
          chris,
          NOW
        )
      ).rejects.toThrow(BadRequestException);
      expect((await service.pending()).map((request) => request.id)).toEqual([
        id,
      ]);
    });
  });

  describe('dismiss', () => {
    it('keeps why, who decided and when', async () => {
      const id = await sentAt({}, 5);

      await service.dismiss(
        id,
        { reason: 'not-support', duplicateOfTicketNumber: null },
        chris,
        NOW
      );

      const [request] = await database
        .select()
        .from(requests)
        .where(eq(requests.id, id));
      expect(request).toMatchObject({
        status: 'dismissed',
        dismissReason: 'not-support',
        duplicateOfTicketId: null,
        decidedById: 'chris.taylor',
        decidedAt: NOW,
      });
    });

    it('links a duplicate to the ticket it repeats', async () => {
      const id = await sentAt({ email: 'grace@example.com' }, 5);

      await service.dismiss(
        id,
        {
          reason: 'duplicate',
          duplicateOfTicketNumber: graceOpen.ticketNumber,
        },
        chris,
        NOW
      );

      const [request] = await database
        .select({ duplicateOfTicketId: requests.duplicateOfTicketId })
        .from(requests)
        .where(eq(requests.id, id));
      expect(request.duplicateOfTicketId).toBe(graceOpen.id);
    });

    it('refuses a duplicate of a ticket that does not exist (400)', async () => {
      const id = await sentAt({}, 5);

      await expect(
        service.dismiss(
          id,
          { reason: 'duplicate', duplicateOfTicketNumber: 999_999 },
          chris,
          NOW
        )
      ).rejects.toThrow('There is no ticket #999999.');
    });

    it('refuses a request already decided (409)', async () => {
      const id = await sentAt({}, 5);
      await service.dismiss(
        id,
        { reason: 'spam', duplicateOfTicketNumber: null },
        chris,
        NOW
      );

      await expect(
        service.dismiss(
          id,
          { reason: 'spam', duplicateOfTicketNumber: null },
          chris,
          NOW
        )
      ).rejects.toThrow(ConflictException);
    });
  });
});
