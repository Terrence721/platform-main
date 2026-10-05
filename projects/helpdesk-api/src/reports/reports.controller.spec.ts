import type { CurrentUser, ReportsResponse } from '@helpdesk/contract';
import { NO_TEAM_MESSAGE, ReportsService } from '@helpdesk/server';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { SESSION_COOKIE } from '../auth/auth-config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { ReportsController } from './reports.controller';

/** Who each session token signs in as. */
const SESSIONS: Record<string, CurrentUser> = {
  admin: {
    id: 'alex.morgan',
    name: 'Alex Morgan',
    role: 'admin',
    teamId: null,
  },
  supervisor: {
    id: 'chris.taylor',
    name: 'Chris Taylor',
    role: 'supervisor',
    teamId: 'atlas',
  },
  // A supervisor whose team was taken away: nothing to report on.
  noTeam: {
    id: 'old.lead',
    name: 'Old Lead',
    role: 'supervisor',
    teamId: null,
  },
  agent: {
    id: 'sam.rivera',
    name: 'Sam Rivera',
    role: 'agent',
    teamId: 'atlas',
  },
};

const fakeAuth = {
  currentUser: async (token: string | undefined) =>
    (token && SESSIONS[token]) || null,
};

/** A report with nothing in it, as the stubbed service answers. */
const REPORT: ReportsResponse = {
  asOf: '2026-10-05T12:00:00.000Z',
  since: '2026-09-05T12:00:00.000Z',
  scope: 'all',
  openByStatus: { new: 0, open: 0, pending: 0 },
  teams: [],
};

describe('/api/reports', () => {
  const reports = {
    report: vi.fn(async (scope: ReportsResponse['scope']) => ({
      ...REPORT,
      scope,
    })),
  };
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: fakeAuth },
        { provide: ReportsService, useValue: reports },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // As main.ts sets the app up.
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://localhost:${port}/api/reports`;
  });

  afterEach(async () => {
    await app.close();
  });

  /** GET /api/reports with this session token, or signed out. */
  const get = (session: string | null) =>
    fetch(base, {
      headers:
        session === null ? {} : { cookie: `${SESSION_COOKIE}=${session}` },
    });

  it('reports on every team for an admin', async () => {
    const response = await get('admin');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(REPORT);
    expect(reports.report).toHaveBeenCalledExactlyOnceWith('all');
  });

  it("reports on a supervisor's own team", async () => {
    const response = await get('supervisor');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...REPORT,
      scope: { teamId: 'atlas' },
    });
    expect(reports.report).toHaveBeenCalledExactlyOnceWith({
      teamId: 'atlas',
    });
  });

  it('answers a supervisor on no team with 404, reading nothing', async () => {
    const response = await get('noTeam');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(
      expect.objectContaining({ message: NO_TEAM_MESSAGE })
    );
    expect(reports.report).not.toHaveBeenCalled();
  });

  it.each([
    ['an agent', 'agent', 403],
    ['a signed-out request', null, 401],
  ] as const)('turns away %s, reading nothing', async (_, session, status) => {
    expect((await get(session)).status).toBe(status);
    expect(reports.report).not.toHaveBeenCalled();
  });
});
