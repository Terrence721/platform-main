import type {
  CurrentUser,
  HistorySummary,
  PersonSummary,
  Role,
  TeamOverview,
  TicketDto,
} from '@helpdesk/contract';
import { TeamsService, TicketsService } from '@helpdesk/server';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { SESSION_COOKIE } from '../auth/auth-config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { TeamsController } from './teams.controller';

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

const atlas: TeamOverview = {
  id: 'atlas',
  name: 'Atlas',
  members: [
    { id: 'sam.rivera', name: 'Sam Rivera', openTickets: 2, overdueTickets: 1 },
  ],
  unassigned: [],
};

const benny: PersonSummary = { id: 'benny.lind', name: 'Benny Lind' };

const memberTicket = { id: 'ticket-1312', ticketNumber: 1312 } as TicketDto;

const memberSummary: HistorySummary = {
  assigned: 24,
  finished: 19,
  open: 5,
  onTime: 15,
  late: 4,
};

describe('/api/teams', () => {
  const teams = {
    overviewFor: vi.fn(async (): Promise<TeamOverview | null> => atlas),
    /** Chris leads Benny; nobody else leads anyone here. */
    agentLedBy: vi.fn(async (supervisorId: string, userId: string) =>
      supervisorId === 'chris.taylor' && userId === benny.id ? benny : null
    ),
  };
  const tickets = {
    allAssignedTo: vi.fn(async () => [memberTicket]),
    historyFor: vi.fn(async () => ({
      summary: memberSummary,
      tickets: [memberTicket],
    })),
  };
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: fakeAuth },
        { provide: TeamsService, useValue: teams },
        { provide: TicketsService, useValue: tickets },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // As main.ts sets the app up.
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://localhost:${port}/api/teams`;
  });

  afterEach(async () => {
    await app.close();
  });

  /** GET `path` under /api/teams, signed in as `role`, or signed out. */
  const get = (path: string, role: Role | null) =>
    fetch(`${base}${path}`, {
      headers: role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` },
    });

  /** GET /mine, signed in as `role`, or signed out. */
  const mine = (role: Role | null) => get('/mine', role);

  describe('GET mine', () => {
    it("answers a supervisor with their own team's overview", async () => {
      const response = await mine('supervisor');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(atlas);
      expect(teams.overviewFor).toHaveBeenCalledExactlyOnceWith('chris.taylor');
    });

    it('answers 404 to a supervisor who leads no team', async () => {
      teams.overviewFor.mockResolvedValueOnce(null);

      const response = await mine('supervisor');

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(
        expect.objectContaining({ message: 'You do not lead a team.' })
      );
    });

    it('answers 401 when signed out, without reading the team', async () => {
      expect((await mine(null)).status).toBe(401);
      expect(teams.overviewFor).not.toHaveBeenCalled();
    });

    it.each(['agent', 'admin'] as const)(
      'answers a %s 403, without reading the team',
      async (role) => {
        expect((await mine(role)).status).toBe(403);
        expect(teams.overviewFor).not.toHaveBeenCalled();
      }
    );
  });

  describe('GET mine/members/:userId/tickets', () => {
    const memberTickets = (userId: string, role: Role | null) =>
      get(`/mine/members/${userId}/tickets`, role);

    it("answers with every ticket of an agent on the supervisor's team", async () => {
      const response = await memberTickets('benny.lind', 'supervisor');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([memberTicket]);
      expect(teams.agentLedBy).toHaveBeenCalledExactlyOnceWith(
        'chris.taylor',
        'benny.lind'
      );
      expect(tickets.allAssignedTo).toHaveBeenCalledExactlyOnceWith(
        'benny.lind'
      );
    });

    it.each([
      ["another team's agent", 'omar.other'],
      ['a user ID nobody has', 'no.such.user'],
    ])('answers 404 for %s, reading no tickets', async (_, userId) => {
      const response = await memberTickets(userId, 'supervisor');

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(
        expect.objectContaining({ message: 'No such member on your team.' })
      );
      expect(tickets.allAssignedTo).not.toHaveBeenCalled();
    });

    it.each([
      ['an agent', 'agent', 403],
      ['an admin', 'admin', 403],
      ['a signed-out request', null, 401],
    ] as const)('turns away %s', async (_, role, status) => {
      expect((await memberTickets('benny.lind', role)).status).toBe(status);
      expect(teams.agentLedBy).not.toHaveBeenCalled();
    });
  });

  describe('GET mine/members/:userId/history', () => {
    const NOW = new Date('2026-10-03T12:00:00.000Z');
    const history = (userId: string, role: Role | null) =>
      get(`/mine/members/${userId}/history`, role);

    beforeEach(() => {
      // Only Date, so the server and fetch still run normally.
      vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    });

    afterEach(() => vi.useRealTimers());

    it('answers with the last three months: the member, since when, the counts and the tickets', async () => {
      const response = await history('benny.lind', 'supervisor');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        member: benny,
        since: '2026-07-03T12:00:00.000Z',
        summary: memberSummary,
        tickets: [memberTicket],
      });
      expect(tickets.historyFor).toHaveBeenCalledExactlyOnceWith(
        'benny.lind',
        new Date('2026-07-03T12:00:00.000Z')
      );
    });

    it("answers 404 for anyone not on the supervisor's team, reading nothing", async () => {
      expect((await history('omar.other', 'supervisor')).status).toBe(404);
      expect(tickets.historyFor).not.toHaveBeenCalled();
    });

    it.each([
      ['an agent', 'agent', 403],
      ['a signed-out request', null, 401],
    ] as const)('turns away %s', async (_, role, status) => {
      expect((await history('benny.lind', role)).status).toBe(status);
    });
  });
});
