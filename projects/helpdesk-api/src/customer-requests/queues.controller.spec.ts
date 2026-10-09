import type { CurrentUser, QueueSummary, Role } from '@helpdesk/contract';
import { CustomerRequestsService } from '@helpdesk/server';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { SESSION_COOKIE } from '../auth/auth-config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { QueuesController } from './queues.controller';

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

const fakeAuth = {
  currentUser: async (token: string | undefined) =>
    Object.values(USERS).find(({ role }) => role === token) ?? null,
};

const QUEUES: QueueSummary[] = [
  { id: 'billing', name: 'Billing' },
  { id: 'technical', name: 'Technical support' },
];

// Turn into ticket's choices (#1026), for the supervisors who decide.
describe('/api/queues', () => {
  const service = { queues: vi.fn(async () => QUEUES) };
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [QueuesController],
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: fakeAuth },
        { provide: CustomerRequestsService, useValue: service },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // As main.ts sets the app up.
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://localhost:${port}/api/queues`;
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (role: Role | null) =>
    fetch(base, {
      headers: role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` },
    });

  it('lists every queue, by name, for a supervisor', async () => {
    const response = await get('supervisor');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(QUEUES);
  });

  it('answers 401 signed out, and 403 to agents and admins, reading nothing', async () => {
    expect((await get(null)).status).toBe(401);
    expect((await get('agent')).status).toBe(403);
    expect((await get('admin')).status).toBe(403);
    expect(service.queues).not.toHaveBeenCalled();
  });
});
