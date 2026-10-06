import type { CurrentUser, ReportsResponse } from '@helpdesk/contract';
import {
  NO_SUCH_TEAM_MESSAGE,
  ReportsService,
  TEAM_OR_AGENT_MESSAGE,
} from '@helpdesk/server';
import {
  BadRequestException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
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
  agents: [],
  choices: { teams: [], agents: [] },
};

describe('/api/reports', () => {
  // What the service decides is tested with it; here, only what the
  // controller hands it and passes on.
  const reports = { reportFor: vi.fn(async () => REPORT) };
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

  /** GET /api/reports with this query, as this session token or signed out. */
  const get = (session: string | null, query = '') =>
    fetch(`${base}${query}`, {
      headers:
        session === null ? {} : { cookie: `${SESSION_COOKIE}=${session}` },
    });

  it("answers with the service's report for the caller", async () => {
    const response = await get('admin');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(REPORT);
    expect(reports.reportFor).toHaveBeenCalledExactlyOnceWith(
      SESSIONS['admin'],
      { team: undefined, agent: undefined }
    );
  });

  it.each([
    ['a team', '?team=beacon', { team: 'beacon', agent: undefined }],
    ['an agent', '?agent=sam.rivera', { team: undefined, agent: 'sam.rivera' }],
  ])('hands the service %s the caller picked', async (_, query, picked) => {
    expect((await get('supervisor', query)).status).toBe(200);
    expect(reports.reportFor).toHaveBeenCalledExactlyOnceWith(
      SESSIONS['supervisor'],
      picked
    );
  });

  it.each([
    [new NotFoundException(NO_SUCH_TEAM_MESSAGE), 404],
    [new BadRequestException(TEAM_OR_AGENT_MESSAGE), 400],
  ])("passes on the service's %s", async (error, status) => {
    reports.reportFor.mockRejectedValueOnce(error);

    const response = await get('supervisor', '?team=beacon');

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(
      expect.objectContaining({ message: error.message })
    );
  });

  it.each([
    ['an agent', 'agent', 403],
    ['a signed-out request', null, 401],
  ] as const)('turns away %s, reading nothing', async (_, session, status) => {
    expect((await get(session)).status).toBe(status);
    expect(reports.reportFor).not.toHaveBeenCalled();
  });
});
