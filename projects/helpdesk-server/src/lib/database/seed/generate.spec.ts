import {
  isUserId,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_MESSAGE_MAX_LENGTH,
  TICKET_SUBJECT_MAX_LENGTH,
} from '@helpdesk/contract';
import {
  AGENTS_PER_TEAM,
  FINISHED_ON_TIME_SHARE,
  generateSeed,
  OPEN_WORK_MAX_AGE_OF_SLA,
  SEED_DEFAULTS,
  SLA_MINUTES,
} from './generate';
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

  // Supervisors do not work tickets: one they held would be stuck, off My
  // team and impossible to reassign (#1009), and would count in its team's
  // report but in no agent's (#1065).
  it('gives tickets only to agents, never to supervisors or admins', () => {
    const agents = new Set(
      data.users.filter((user) => user.role === 'agent').map((user) => user.id)
    );
    const heldByOthers = data.tickets.filter(
      ({ assigneeId }) => assigneeId !== null && !agents.has(assigneeId)
    );

    expect(heldByOthers.map(({ subject }) => subject)).toEqual([]);
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

  describe('open work (new, open, pending) looks like a team keeping up', () => {
    const openWork = data.tickets.filter(({ status }) =>
      ['new', 'open', 'pending'].includes(status)
    );
    const withSla = openWork.filter(
      (ticket): ticket is typeof ticket & { slaDueInMinutes: number } =>
        ticket.slaDueInMinutes !== null
    );

    it('was raised within about its SLA, never months ago', () => {
      for (const { priority, createdMinutesAgo } of openWork) {
        expect(createdMinutesAgo).toBeLessThanOrEqual(
          SLA_MINUTES[priority] * OPEN_WORK_MAX_AGE_OF_SLA + 10
        );
      }
    });

    it('is mostly on time', () => {
      const onTime = withSla.filter(
        ({ slaDueInMinutes }) => slaDueInMinutes >= 0
      );

      expect(onTime.length / withSla.length).toBeGreaterThanOrEqual(0.7);
    });

    it('is late, when it is, by at most a quarter of its SLA', () => {
      for (const { priority, slaDueInMinutes } of withSla) {
        expect(-slaDueInMinutes).toBeLessThanOrEqual(
          SLA_MINUTES[priority] * (OPEN_WORK_MAX_AGE_OF_SLA - 1) + 10
        );
      }
    });

    it('leaves every ticket older than two weeks finished', () => {
      const old = data.tickets.filter(
        ({ createdMinutesAgo }) => createdMinutesAgo > 14 * 24 * 60
      );

      expect(old.length).toBeGreaterThan(0);
      expect(
        old.filter(({ status }) => !['resolved', 'closed'].includes(status))
      ).toEqual([]);
    });
  });

  describe('finished work (resolved, closed) looks like a team keeping its promises', () => {
    const finished = data.tickets.filter(({ status }) =>
      ['resolved', 'closed'].includes(status)
    );
    // A finished ticket's last change is when it was finished.
    const minutesToFinish = ({
      createdMinutesAgo,
      updatedMinutesAgo,
    }: (typeof finished)[number]) => createdMinutesAgo - updatedMinutesAgo;
    const withSla = finished.filter(
      ({ slaDueInMinutes }) => slaDueInMinutes !== null
    );

    it('was finished after it was raised, and not later than now', () => {
      expect(finished.length).toBeGreaterThan(0);
      for (const ticket of finished) {
        expect(ticket.updatedMinutesAgo).toBeGreaterThanOrEqual(0);
        expect(minutesToFinish(ticket)).toBeGreaterThanOrEqual(0);
      }
    });

    it(`was finished within its SLA about ${FINISHED_ON_TIME_SHARE * 100}% of the time`, () => {
      const onTime = withSla.filter(
        (ticket) => minutesToFinish(ticket) <= SLA_MINUTES[ticket.priority]
      );

      expect(onTime.length / withSla.length).toBeGreaterThanOrEqual(
        FINISHED_ON_TIME_SHARE - 0.05
      );
      expect(onTime.length / withSla.length).toBeLessThanOrEqual(
        FINISHED_ON_TIME_SHARE + 0.05
      );
    });

    it('was late, when it was, by at most its SLA again', () => {
      for (const ticket of finished) {
        expect(minutesToFinish(ticket)).toBeLessThanOrEqual(
          2 * SLA_MINUTES[ticket.priority]
        );
      }
    });
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
