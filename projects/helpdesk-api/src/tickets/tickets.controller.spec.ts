import type { CurrentUser, Role, TicketDto } from '@helpdesk/contract';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { SESSION_COOKIE } from '../auth/auth-config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

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

describe('/api/tickets', () => {
  const tickets = { assignedTo: vi.fn(async () => [overdue]) };
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    tickets.assignedTo.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: fakeAuth },
        { provide: TicketsService, useValue: tickets },
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
});
