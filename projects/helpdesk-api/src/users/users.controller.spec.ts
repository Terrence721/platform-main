import type { CurrentUser, Role, UserAccount } from '@helpdesk/contract';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { SESSION_COOKIE } from '../auth/auth-config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

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

const accounts: UserAccount[] = [
  {
    id: 'alex.morgan',
    name: 'Alex Morgan',
    role: 'admin',
    team: null,
    active: true,
  },
  {
    id: 'sam.rivera',
    name: 'Sam Rivera',
    role: 'agent',
    team: { id: 'atlas', name: 'Atlas' },
    active: true,
  },
];

describe('/api/users', () => {
  const users = { list: vi.fn(async () => accounts) };
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    users.list.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: fakeAuth },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // As main.ts sets the app up.
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://localhost:${port}/api/users`;
  });

  afterEach(async () => {
    await app.close();
  });

  /** GET /api/users, signed in as `role`, or signed out. */
  const list = (role: Role | null) =>
    fetch(base, {
      headers: role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` },
    });

  describe('GET', () => {
    it('answers an admin with every account', async () => {
      const response = await list('admin');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(accounts);
      expect(users.list).toHaveBeenCalledOnce();
    });

    it.each([
      ['an agent', 'agent', 403],
      ['a supervisor', 'supervisor', 403],
      ['a signed-out request', null, 401],
    ] as const)(
      'turns away %s, reading no accounts',
      async (_, role, status) => {
        expect((await list(role)).status).toBe(status);
        expect(users.list).not.toHaveBeenCalled();
      }
    );
  });
});
