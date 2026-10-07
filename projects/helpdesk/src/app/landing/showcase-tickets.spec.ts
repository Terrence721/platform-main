import {
  isTicketPriority,
  isTicketStatus,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_SUBJECT_MAX_LENGTH,
} from '@helpdesk/contract';
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
      expect(isTicketPriority(ticket.priority)).toBe(true);
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
