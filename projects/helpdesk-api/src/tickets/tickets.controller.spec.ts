import {
  type CurrentUser,
  type Role,
  type TicketDto,
  TICKET_MESSAGE_MAX_LENGTH,
  type TicketMessage,
} from '@helpdesk/contract';
import { TicketMessagesService, TicketsService } from '@helpdesk/server';
import {
  BadRequestException,
  ConflictException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { SESSION_COOKIE } from '../auth/auth-config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import {
  readAssigneeId,
  readMessage,
  readStatus,
  TicketsController,
} from './tickets.controller';

/** One user per role; each one's session token is their role's name. */
const USERS: Record<Role, CurrentUser> = {
  agent: {
    id: 'sam.rivera',
    name: 'Sam Rivera',
    role: 'agent',
    teamId: 'atlas',
  },
  supervisor: {
    id: 'chris.taylor',
    name: 'Chris Taylor',
    role: 'supervisor',
    teamId: 'atlas',
  },
  admin: {
    id: 'alex.morgan',
    name: 'Alex Morgan',
    role: 'admin',
    teamId: null,
  },
};

/** Recognizes a session token named after a role as that role's user. */
const fakeAuth = {
  currentUser: async (token: string | undefined) =>
    Object.values(USERS).find(({ role }) => role === token) ?? null,
};

const overdue = {
  id: '7d0f6c2e-4b1a-4c3e-9a51-2f8d6e0b1c34',
  ticketNumber: 1001,
  subject: 'Cannot sign in after the password reset',
} as TicketDto;

const reply: TicketMessage = {
  id: '3b9e2a41-6c0d-4f7e-8a12-5d4c3b2a1f00',
  kind: 'reply',
  body: 'Which browser are you using?',
  author: { id: 'sam.rivera', name: 'Sam Rivera' },
  createdAt: '2026-10-04T09:00:00.000Z',
};

describe('readMessage', () => {
  it('reads the kind and the text, trimmed', () => {
    expect(
      readMessage({ kind: 'note', body: '  Checked the logs.\n' })
    ).toEqual({ kind: 'note', body: 'Checked the logs.' });
  });

  it('keeps text right at the limit', () => {
    const body = 'x'.repeat(TICKET_MESSAGE_MAX_LENGTH);

    expect(readMessage({ kind: 'reply', body })).toEqual({
      kind: 'reply',
      body,
    });
  });

  it.each([
    ['no body', null],
    ['no kind', { body: 'Hello.' }],
    ['an unknown kind', { kind: 'email', body: 'Hello.' }],
  ])('refuses %s with 400', (_, body) => {
    expect(() => readMessage(body)).toThrow(BadRequestException);
    expect(() => readMessage(body)).toThrow('Choose reply or note.');
  });

  it.each([
    ['no text', { kind: 'reply' }],
    ['blank text', { kind: 'reply', body: ' \n\t ' }],
    ['text that is not a string', { kind: 'reply', body: 7 }],
  ])('refuses %s with 400', (_, body) => {
    expect(() => readMessage(body)).toThrow(BadRequestException);
    expect(() => readMessage(body)).toThrow('Write a message first.');
  });

  it('refuses text over the limit with 400', () => {
    const body = 'x'.repeat(TICKET_MESSAGE_MAX_LENGTH + 1);

    expect(() => readMessage({ kind: 'reply', body })).toThrow(
      `Keep the message to ${TICKET_MESSAGE_MAX_LENGTH} characters or fewer.`
    );
  });
});

describe('readStatus', () => {
  it('reads the status a body names', () => {
    expect(readStatus({ status: 'resolved' })).toBe('resolved');
  });

  it.each([
    ['no body', null],
    ['no status', {}],
    ['an unknown status', { status: 'done' }],
  ])('refuses %s with 400', (_, body) => {
    expect(() => readStatus(body)).toThrow(BadRequestException);
    expect(() => readStatus(body)).toThrow(
      'Choose new, open, pending, resolved or closed.'
    );
  });
});

describe('readAssigneeId', () => {
  it('reads the agent a body names', () => {
    expect(readAssigneeId({ assigneeId: 'benny.lind' })).toBe('benny.lind');
  });

  it.each([
    ['no body', null],
    ['no agent', {}],
    ['an agent that is not a user ID', { assigneeId: 'Benny Lind' }],
    ['an agent that is not text', { assigneeId: 7 }],
  ])('refuses %s with 400', (_, body) => {
    expect(() => readAssigneeId(body)).toThrow(BadRequestException);
    expect(() => readAssigneeId(body)).toThrow(
      'Choose an agent to assign the ticket to.'
    );
  });
});

describe('/api/tickets', () => {
  const tickets = {
    assignedTo: vi.fn(async () => [overdue]),
    assign: vi.fn(async (): Promise<TicketDto> => overdue),
    unassigned: vi.fn(async () => [overdue]),
    take: vi.fn(async (): Promise<TicketDto> => overdue),
    recentlyFinished: vi.fn(async () => [overdue]),
    changeStatus: vi.fn(async (): Promise<TicketDto> => overdue),
  };
  const messages = {
    conversation: vi.fn(async () => [reply]),
    add: vi.fn(async (): Promise<TicketMessage> => reply),
  };
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: fakeAuth },
        { provide: TicketsService, useValue: tickets },
        { provide: TicketMessagesService, useValue: messages },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // As main.ts sets the app up.
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://localhost:${port}/api/tickets`;
  });

  afterEach(async () => {
    await app.close();
  });

  /** GET /mine, signed in as `role`, or signed out. */
  const mine = (role: Role | null) =>
    fetch(`${base}/mine`, {
      headers: role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` },
    });

  describe('GET mine', () => {
    it('answers an agent with their own tickets', async () => {
      const response = await mine('agent');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([overdue]);
      expect(tickets.assignedTo).toHaveBeenCalledExactlyOnceWith('sam.rivera');
    });

    it('answers 401 when signed out, without reading any tickets', async () => {
      const response = await mine(null);

      expect(response.status).toBe(401);
      expect(tickets.assignedTo).not.toHaveBeenCalled();
    });

    it.each(['supervisor', 'admin'] as const)(
      'answers a %s 403, without reading any tickets',
      async (role) => {
        const response = await mine(role);

        expect(response.status).toBe(403);
        expect(tickets.assignedTo).not.toHaveBeenCalled();
      }
    );
  });

  describe('PUT :ticketId/assignee', () => {
    /** PUT an Assign body for the overdue ticket, as `role` or signed out. */
    const assign = (
      role: Role | null,
      body: unknown = { assigneeId: 'benny.lind' }
    ) =>
      fetch(`${base}/${overdue.id}/assignee`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          ...(role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` }),
        },
        body: JSON.stringify(body),
      });

    it("assigns for a supervisor, on that supervisor's behalf", async () => {
      const response = await assign('supervisor');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(overdue);
      expect(tickets.assign).toHaveBeenCalledExactlyOnceWith(
        overdue.id,
        'benny.lind',
        'chris.taylor'
      );
    });

    it('answers a body with no agent with 400, assigning nothing', async () => {
      const response = await assign('supervisor', {});

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          message: 'Choose an agent to assign the ticket to.',
        })
      );
      expect(tickets.assign).not.toHaveBeenCalled();
    });

    it.each([
      [new NotFoundException('No such agent on your team.'), 404],
      [
        new ConflictException(
          "This ticket is finished, so it can't be assigned."
        ),
        409,
      ],
    ])("passes on the service's %s", async (error, status) => {
      tickets.assign.mockRejectedValueOnce(error);

      const response = await assign('supervisor');

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(
        expect.objectContaining({ message: error.message })
      );
    });

    it.each([
      ['an admin', 'admin', 403],
      ['a signed-out request', null, 401],
    ] as const)('turns away %s, assigning nothing', async (_, role, status) => {
      expect((await assign(role)).status).toBe(status);
      expect(tickets.assign).not.toHaveBeenCalled();
      expect(tickets.take).not.toHaveBeenCalled();
    });

    describe('as an agent', () => {
      it('takes the ticket for the agent themselves', async () => {
        const response = await assign('agent', { assigneeId: 'sam.rivera' });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(overdue);
        expect(tickets.take).toHaveBeenCalledExactlyOnceWith(
          overdue.id,
          'sam.rivera'
        );
        expect(tickets.assign).not.toHaveBeenCalled();
      });

      it('refuses to give the ticket to anyone else, with 403', async () => {
        const response = await assign('agent', { assigneeId: 'benny.lind' });

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual(
          expect.objectContaining({
            message: 'Agents can only take tickets for themselves.',
          })
        );
        expect(tickets.take).not.toHaveBeenCalled();
      });

      it("passes on the service's 409 when someone took it first", async () => {
        tickets.take.mockRejectedValueOnce(
          new ConflictException('Someone else has taken this ticket.')
        );

        const response = await assign('agent', { assigneeId: 'sam.rivera' });

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual(
          expect.objectContaining({
            message: 'Someone else has taken this ticket.',
          })
        );
      });
    });
  });

  describe('GET unassigned', () => {
    /** GET /unassigned, signed in as `role`, or signed out. */
    const unassigned = (role: Role | null) =>
      fetch(`${base}/unassigned`, {
        headers: role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` },
      });

    it('answers an agent with the unassigned tickets', async () => {
      const response = await unassigned('agent');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([overdue]);
      expect(tickets.unassigned).toHaveBeenCalledOnce();
    });

    it.each([
      ['a supervisor', 'supervisor', 403],
      ['an admin', 'admin', 403],
      ['a signed-out request', null, 401],
    ] as const)('turns away %s', async (_, role, status) => {
      expect((await unassigned(role)).status).toBe(status);
      expect(tickets.unassigned).not.toHaveBeenCalled();
    });
  });

  describe('GET mine/finished', () => {
    const finished = (role: Role | null) =>
      fetch(`${base}/mine/finished`, {
        headers: role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` },
      });

    it('answers an agent with their own finished tickets', async () => {
      const response = await finished('agent');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([overdue]);
      expect(tickets.recentlyFinished).toHaveBeenCalledExactlyOnceWith(
        'sam.rivera'
      );
    });

    it.each([
      ['a supervisor', 'supervisor', 403],
      ['an admin', 'admin', 403],
      ['a signed-out request', null, 401],
    ] as const)('turns away %s', async (_, role, status) => {
      expect((await finished(role)).status).toBe(status);
      expect(tickets.recentlyFinished).not.toHaveBeenCalled();
    });
  });

  describe('PUT :ticketId/status', () => {
    /** PUT a Change status body for the overdue ticket. */
    const changeStatus = (
      role: Role | null,
      body: unknown = { status: 'resolved' }
    ) =>
      fetch(`${base}/${overdue.id}/status`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          ...(role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` }),
        },
        body: JSON.stringify(body),
      });

    it.each([
      ['an agent', 'agent', 'sam.rivera'],
      ['a supervisor', 'supervisor', 'chris.taylor'],
    ] as const)(
      'changes the status for %s, as that user',
      async (_, role, id) => {
        const response = await changeStatus(role);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(overdue);
        expect(tickets.changeStatus).toHaveBeenCalledExactlyOnceWith(
          overdue.id,
          'resolved',
          expect.objectContaining({ id, role })
        );
      }
    );

    it('answers a body without a status with 400, changing nothing', async () => {
      const response = await changeStatus('agent', { status: 'done' });

      expect(response.status).toBe(400);
      expect(tickets.changeStatus).not.toHaveBeenCalled();
    });

    it.each([
      [new NotFoundException('No such ticket among yours.'), 404],
      [new ConflictException("A closed ticket can't change."), 409],
    ])("passes on the service's %s", async (error, status) => {
      tickets.changeStatus.mockRejectedValueOnce(error);

      const response = await changeStatus('agent');

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(
        expect.objectContaining({ message: error.message })
      );
    });

    it.each([
      ['an admin', 'admin', 403],
      ['a signed-out request', null, 401],
    ] as const)('turns away %s, changing nothing', async (_, role, status) => {
      expect((await changeStatus(role)).status).toBe(status);
      expect(tickets.changeStatus).not.toHaveBeenCalled();
    });
  });

  describe('GET :ticketId/messages', () => {
    /** GET the overdue ticket's conversation, as `role` or signed out. */
    const conversation = (role: Role | null) =>
      fetch(`${base}/${overdue.id}/messages`, {
        headers: role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` },
      });

    it.each([
      ['an agent', 'agent', 'sam.rivera'],
      ['a supervisor', 'supervisor', 'chris.taylor'],
    ] as const)(
      'answers %s with the conversation, read as that user',
      async (_, role, id) => {
        const response = await conversation(role);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([reply]);
        expect(messages.conversation).toHaveBeenCalledExactlyOnceWith(
          overdue.id,
          expect.objectContaining({ id, role })
        );
      }
    );

    it("passes on the service's 404", async () => {
      messages.conversation.mockRejectedValueOnce(
        new NotFoundException('No such ticket among yours.')
      );

      const response = await conversation('agent');

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(
        expect.objectContaining({ message: 'No such ticket among yours.' })
      );
    });

    it.each([
      ['an admin', 'admin', 403],
      ['a signed-out request', null, 401],
    ] as const)('turns away %s, reading nothing', async (_, role, status) => {
      expect((await conversation(role)).status).toBe(status);
      expect(messages.conversation).not.toHaveBeenCalled();
    });
  });

  describe('POST :ticketId/messages', () => {
    /** POST a message body to the overdue ticket. */
    const addMessage = (
      role: Role | null,
      body: unknown = { kind: 'reply', body: ' Which browser are you using? ' }
    ) =>
      fetch(`${base}/${overdue.id}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` }),
        },
        body: JSON.stringify(body),
      });

    it.each([
      ['an agent', 'agent', 'sam.rivera'],
      ['a supervisor', 'supervisor', 'chris.taylor'],
    ] as const)(
      'adds the message for %s, trimmed, as that user (201)',
      async (_, role, id) => {
        const response = await addMessage(role);

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual(reply);
        expect(messages.add).toHaveBeenCalledExactlyOnceWith(
          overdue.id,
          { kind: 'reply', body: 'Which browser are you using?' },
          expect.objectContaining({ id, role })
        );
      }
    );

    it('answers a body without text with 400, adding nothing', async () => {
      const response = await addMessage('agent', { kind: 'note', body: '' });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({ message: 'Write a message first.' })
      );
      expect(messages.add).not.toHaveBeenCalled();
    });

    it.each([
      [new NotFoundException('No such ticket among yours.'), 404],
      [new ConflictException("A closed ticket can't change."), 409],
    ])("passes on the service's %s", async (error, status) => {
      messages.add.mockRejectedValueOnce(error);

      const response = await addMessage('agent');

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(
        expect.objectContaining({ message: error.message })
      );
    });

    it.each([
      ['an admin', 'admin', 403],
      ['a signed-out request', null, 401],
    ] as const)('turns away %s, adding nothing', async (_, role, status) => {
      expect((await addMessage(role)).status).toBe(status);
      expect(messages.add).not.toHaveBeenCalled();
    });
  });
});
