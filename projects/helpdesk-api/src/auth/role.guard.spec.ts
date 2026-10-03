import type { CurrentUser, Role } from '@helpdesk/contract';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { SESSION_COOKIE } from './auth-config';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OnlyFor, RoleGuard } from './role.guard';

/** One user per role; each one's session token is their role's name. */
const fakeAuth = {
  currentUser: async (
    token: string | undefined
  ): Promise<CurrentUser | null> =>
    token === 'agent' || token === 'supervisor' || token === 'admin'
      ? { id: `${token}.user`, name: 'Someone', role: token, teamId: null }
      : null,
};

/** For supervisors, except one method for admins. */
@Controller('supervisor-area')
@OnlyFor('supervisor')
class SupervisorAreaController {
  @Get('team')
  team() {
    return { ok: true };
  }

  @Get('settings')
  @OnlyFor('admin')
  settings() {
    return { ok: true };
  }
}

/** One method per way of using the guard. */
@Controller('pages')
class PagesController {
  @Get('agent')
  @OnlyFor('agent')
  agent() {
    return { ok: true };
  }

  /** RoleGuard without OnlyFor: a mistake, which must fail safe. */
  @Get('forgotten')
  @UseGuards(AuthGuard, RoleGuard)
  forgotten() {
    return { ok: true };
  }
}

describe('OnlyFor and RoleGuard', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SupervisorAreaController, PagesController],
      providers: [AuthGuard, { provide: AuthService, useValue: fakeAuth }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use(cookieParser());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  /** The status of GET `path`, signed in as `role`, or signed out. */
  const statusOf = async (path: string, role: Role | null) =>
    (
      await fetch(`${base}${path}`, {
        headers: role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` },
      })
    ).status;

  describe('on a method', () => {
    it('lets the right role in', async () => {
      expect(await statusOf('/pages/agent', 'agent')).toBe(200);
    });

    it.each(['supervisor', 'admin'] as const)(
      'turns away a %s with 403',
      async (role) => {
        expect(await statusOf('/pages/agent', role)).toBe(403);
      }
    );

    it('turns away a signed-out request with 401', async () => {
      expect(await statusOf('/pages/agent', null)).toBe(401);
    });
  });

  describe('on a controller', () => {
    it('applies to its methods', async () => {
      expect(await statusOf('/supervisor-area/team', 'supervisor')).toBe(200);
      expect(await statusOf('/supervisor-area/team', 'agent')).toBe(403);
      expect(await statusOf('/supervisor-area/team', null)).toBe(401);
    });

    it("gives way to a method's own role", async () => {
      expect(await statusOf('/supervisor-area/settings', 'admin')).toBe(200);
      expect(await statusOf('/supervisor-area/settings', 'supervisor')).toBe(
        403
      );
    });
  });

  it.each(['agent', 'supervisor', 'admin'] as const)(
    'closes an endpoint with no role to a %s (403)',
    async (role) => {
      expect(await statusOf('/pages/forgotten', role)).toBe(403);
    }
  );
});
