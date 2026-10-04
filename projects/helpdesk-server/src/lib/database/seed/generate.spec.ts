import {
  isUserId,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_MESSAGE_MAX_LENGTH,
  TICKET_SUBJECT_MAX_LENGTH,
} from '@helpdesk/contract';
import { AGENTS_PER_TEAM, generateSeed, SEED_DEFAULTS } from './generate';
import { SHOWCASE_TICKETS, TEAMS } from './story';

describe('generateSeed', () => {
  const data = generateSeed();

  it('has 4 admins, 4 supervisors and 40 agents', () => {
    const roles = data.users.map((user) => user.role);

    expect(roles.filter((role) => role === 'admin')).toHaveLength(4);
    expect(roles.filter((role) => role === 'supervisor')).toHaveLength(4);
    expect(roles.filter((role) => role === 'agent')).toHaveLength(40);
  });

  it('puts ten agents in each team, led by its supervisor; admins in none', () => {
    for (const team of TEAMS) {
      const members = data.users.filter((user) => user.teamId === team.id);

      expect(members.filter((user) => user.role === 'agent')).toHaveLength(
        AGENTS_PER_TEAM
      );
      expect(
        members
          .filter((user) => user.role === 'supervisor')
          .map((user) => user.id)
      ).toEqual([team.supervisorId]);
    }
    expect(
      data.users.filter((user) => user.role === 'admin' && user.teamId !== null)
    ).toEqual([]);
  });

  it('gives every user a unique, valid sign-in user ID', () => {
    const ids = data.users.map((user) => user.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !isUserId(id))).toEqual([]);
  });

  it('has the default counts of customers and tickets', () => {
    expect(data.customers).toHaveLength(SEED_DEFAULTS.customers);
    expect(data.tickets).toHaveLength(SEED_DEFAULTS.tickets);
  });

  it('gives every customer a unique email on a domain reserved for examples', () => {
    const emails = data.customers.map((customer) => customer.email);

    expect(new Set(emails).size).toBe(emails.length);
    expect(
      emails.filter((email) => !/@example\.(com|org|net)$/.test(email))
    ).toEqual([]);
  });

  it('only points tickets at users, customers and queues that exist', () => {
    const userIds = new Set(data.users.map((user) => user.id));
    const emails = new Set(data.customers.map((customer) => customer.email));
    const queueIds = new Set(data.queues.map((queue) => queue.id));

    for (const ticket of data.tickets) {
      expect(emails.has(ticket.requesterEmail)).toBe(true);
      expect(queueIds.has(ticket.queueId)).toBe(true);
      if (ticket.assigneeId !== null) {
        expect(userIds.has(ticket.assigneeId)).toBe(true);
      }
    }
  });

  it('keeps every subject and description within the contract limits', () => {
    for (const { subject, description } of data.tickets) {
      expect(subject.length).toBeLessThanOrEqual(TICKET_SUBJECT_MAX_LENGTH);
      expect(description.length).toBeLessThanOrEqual(
        TICKET_DESCRIPTION_MAX_LENGTH
      );
    }
  });

  it('leaves new tickets unassigned, and updates no ticket before it was raised', () => {
    for (const ticket of data.tickets) {
      if (ticket.status === 'new') {
        expect(ticket.assigneeId).toBeNull();
      }
      expect(ticket.updatedMinutesAgo).toBeLessThanOrEqual(
        ticket.createdMinutesAgo
      );
    }
  });

  it('starts with the landing page showcase tickets', () => {
    expect(data.tickets.slice(0, SHOWCASE_TICKETS.length)).toEqual(
      SHOWCASE_TICKETS
    );
  });

  it('writes conversations only on tickets someone is working', () => {
    const idle = data.tickets.filter(
      (ticket) => ticket.status === 'new' || ticket.assigneeId === null
    );
    const messages = data.tickets.flatMap((ticket) => ticket.messages);

    expect(idle.filter((ticket) => ticket.messages.length > 0)).toEqual([]);
    expect(messages.length).toBeGreaterThan(0);
    expect(new Set(messages.map((message) => message.kind))).toEqual(
      new Set(['reply', 'note'])
    );
  });

  it('times each message inside its ticket, oldest first', () => {
    for (const ticket of data.tickets) {
      const times = ticket.messages.map((message) => message.minutesAgo);

      for (const minutesAgo of times) {
        expect(minutesAgo).toBeGreaterThanOrEqual(ticket.updatedMinutesAgo);
        expect(minutesAgo).toBeLessThan(ticket.createdMinutesAgo);
      }
      expect(times).toEqual([...times].sort((a, b) => b - a));
    }
  });

  it("lets only the assignee or their team's supervisor write, and supervisors only note", () => {
    const supervisorOf = new Map(
      data.users.map((user) => [
        user.id,
        TEAMS.find((team) => team.id === user.teamId)?.supervisorId,
      ])
    );

    for (const { assigneeId, messages } of data.tickets) {
      for (const { authorId, kind } of messages) {
        if (authorId !== assigneeId) {
          expect(assigneeId).not.toBeNull();
          expect(authorId).toBe(supervisorOf.get(assigneeId ?? ''));
          expect(kind).toBe('note');
        }
      }
    }
  });

  it('keeps every message within the contract limit', () => {
    for (const { messages } of data.tickets) {
      for (const { body } of messages) {
        expect(body.length).toBeLessThanOrEqual(TICKET_MESSAGE_MAX_LENGTH);
      }
    }
  });

  it('includes every status and priority', () => {
    expect(new Set(data.tickets.map((ticket) => ticket.status)).size).toBe(5);
    expect(new Set(data.tickets.map((ticket) => ticket.priority)).size).toBe(4);
  });

  it('is the same for the same seed, and different for another', () => {
    expect(generateSeed()).toEqual(data);
    expect(generateSeed({ seed: SEED_DEFAULTS.seed + 1 })).not.toEqual(data);
  });

  it('can make more or less data on request', () => {
    const small = generateSeed({ customers: 10, tickets: 25 });

    expect(small.customers).toHaveLength(10);
    expect(small.tickets).toHaveLength(25);
  });
});
