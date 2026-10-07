import {
  isTicketStatus,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_SUBJECT_MAX_LENGTH,
} from '@helpdesk/contract';
import {
  NAMED_USERS,
  QUEUES,
  SHOWCASE_CUSTOMERS,
  SHOWCASE_TICKETS,
} from '@helpdesk/server';
import { showcaseTickets } from './showcase-tickets';

const now = new Date('2026-10-02T12:00:00.000Z');
const tickets = showcaseTickets(now);

const minutesFromNow = (iso: string | null) =>
  iso === null ? null : (new Date(iso).getTime() - now.getTime()) / 60_000;

describe('showcaseTickets', () => {
  it('has the four mockup tickets, in order', () => {
    expect(tickets.map(({ ticketNumber }) => ticketNumber)).toEqual([
      1042, 1039, 1035, 1031,
    ]);
  });

  it('sets the SLA due times relative to now', () => {
    expect(tickets.map(({ slaDueAt }) => minutesFromNow(slaDueAt))).toEqual([
      -25,
      2 * 60,
      28 * 60,
      3 * 24 * 60,
    ]);
  });

  // The same four tickets are seeded for Sam (the API's story.ts), so the
  // live demo's My tickets matches this preview; nothing else ties the two
  // hand-kept copies together (#1069).
  it("matches the seed's showcase tickets, field by field", () => {
    const queueName = new Map(QUEUES.map(({ id, name }) => [id, name]));
    const customer = new Map(
      SHOWCASE_CUSTOMERS.map((person) => [person.email, person])
    );
    const agentName = NAMED_USERS.find(
      ({ id }) => id === SHOWCASE_TICKETS[0].assigneeId
    )?.name;
    const minutesAgo = (iso: string) => -(minutesFromNow(iso) ?? 0);

    expect(
      tickets.map((ticket) => ({
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        requester: {
          name: ticket.requester.name,
          email: ticket.requester.email,
        },
        assignee: ticket.assignee?.name,
        queue: ticket.queue.name,
        tags: ticket.tags,
        slaDueInMinutes: minutesFromNow(ticket.slaDueAt),
        createdMinutesAgo: minutesAgo(ticket.createdAt),
        updatedMinutesAgo: minutesAgo(ticket.updatedAt),
      }))
    ).toEqual(
      SHOWCASE_TICKETS.map((seeded) => ({
        subject: seeded.subject,
        description: seeded.description,
        status: seeded.status,
        priority: seeded.priority,
        requester: customer.get(seeded.requesterEmail),
        assignee: agentName,
        queue: queueName.get(seeded.queueId),
        tags: seeded.tags,
        slaDueInMinutes: seeded.slaDueInMinutes,
        createdMinutesAgo: seeded.createdMinutesAgo,
        updatedMinutesAgo: seeded.updatedMinutesAgo,
      }))
    );
  });

  it('moves with the time it is given', () => {
    const later = new Date(now.getTime() + 60 * 60_000);

    expect(showcaseTickets(later)[0].slaDueAt).toBe(
      new Date(later.getTime() - 25 * 60_000).toISOString()
    );
  });

  it.each(tickets.map((ticket) => [ticket.ticketNumber, ticket] as const))(
    '#%s is valid by the contract',
    (_, ticket) => {
      expect(isTicketStatus(ticket.status)).toBe(true);
      expect(ticket.subject.length).toBeLessThanOrEqual(
        TICKET_SUBJECT_MAX_LENGTH
      );
      expect(ticket.description.length).toBeLessThanOrEqual(
        TICKET_DESCRIPTION_MAX_LENGTH
      );
      expect(ticket.createdAt <= ticket.updatedAt).toBe(true);
    }
  );

  it('gives every ticket its own id and number', () => {
    expect(new Set(tickets.map(({ id }) => id)).size).toBe(tickets.length);
    expect(new Set(tickets.map(({ ticketNumber }) => ticketNumber)).size).toBe(
      tickets.length
    );
  });

  it('assigns every ticket to the same agent, for the "My tickets" preview', () => {
    expect(new Set(tickets.map(({ assignee }) => assignee?.id))).toEqual(
      new Set(['agent-sam'])
    );
  });
});
