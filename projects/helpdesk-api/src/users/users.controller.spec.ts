import {
  type CurrentUser,
  type Role,
  USER_ID_TAKEN_MESSAGE,
  type UserAccount,
} from '@helpdesk/contract';
import { UsersService } from '@helpdesk/server';
import { ConflictException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { SESSION_COOKIE } from '../auth/auth-config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { UsersController } from './users.controller';

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
    leadsTeam: false,
    active: true,
  },
  {
    id: 'sam.rivera',
    name: 'Sam Rivera',
    role: 'agent',
    team: { id: 'atlas', name: 'Atlas' },
    leadsTeam: false,
    active: true,
  },
];

/** A Create Account body that passes every check. */
const goodBody = {
  userId: 'nia.new',
  name: 'Nia New',
  role: 'agent',
  teamId: 'atlas',
  password: 'a-starting-password',
};

describe('/api/users', () => {
  const created: UserAccount = {
    id: 'nia.new',
    name: 'Nia New',
    role: 'agent',
    team: { id: 'atlas', name: 'Atlas' },
    leadsTeam: false,
    active: true,
  };
  const users = {
    list: vi.fn(async () => accounts),
    create: vi.fn(async (): Promise<UserAccount> => created),
  };
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    vi.clearAllMocks();
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

  describe('POST', () => {
    /** POST /api/users with this body, signed in as `role`, or signed out. */
    const create = (role: Role | null, body: unknown = goodBody) =>
      fetch(base, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` }),
        },
        body: JSON.stringify(body),
      });

    it('creates the account for an admin: 201 with the account', async () => {
      const response = await create('admin');

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(created);
      expect(users.create).toHaveBeenCalledExactlyOnceWith(goodBody);
    });

    it('answers a wrong field with 400 and its message, creating nothing', async () => {
      const response = await create('admin', {
        ...goodBody,
        password: 'short',
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          message: 'Use a password of 12 to 128 characters.',
        })
      );
      expect(users.create).not.toHaveBeenCalled();
    });

    it("passes on the service's 409 for a taken user ID", async () => {
      users.create.mockRejectedValueOnce(
        new ConflictException(USER_ID_TAKEN_MESSAGE)
      );

      const response = await create('admin');

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual(
        expect.objectContaining({ message: USER_ID_TAKEN_MESSAGE })
      );
    });

    it.each([
      ['an agent', 'agent', 403],
      ['a supervisor', 'supervisor', 403],
      ['a signed-out request', null, 401],
    ] as const)('turns away %s, creating nothing', async (_, role, status) => {
      expect((await create(role)).status).toBe(status);
      expect(users.create).not.toHaveBeenCalled();
    });
  });
});
