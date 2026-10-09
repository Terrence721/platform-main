import type { CurrentUser, Role } from '@helpdesk/contract';
import {
  Controller,
  Get,
  INestApplication,
  Module,
  Post,
  RequestMethod,
  UseGuards,
} from '@nestjs/common';
import {
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { AppModule } from '../app/app.module';
import { SESSION_COOKIE } from './auth-config';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { ONLY_FOR_ROLE, OnlyFor, RoleGuard } from './role.guard';

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

  @Get('work')
  @OnlyFor('supervisor', 'agent')
  work() {
    return { ok: true };
  }

  /**
   * RoleGuard added by hand without OnlyFor: closed to everyone. (Leaving
   * OnlyFor out altogether leaves no guard at all; the walk over every
   * route, at the end, catches that.)
   */
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

  describe('with several roles', () => {
    it.each(['supervisor', 'agent'] as const)('lets a %s in', async (role) => {
      expect(await statusOf('/pages/work', role)).toBe(200);
    });

    it('turns away the role not listed with 403, and signed out with 401', async () => {
      expect(await statusOf('/pages/work', 'admin')).toBe(403);
      expect(await statusOf('/pages/work', null)).toBe(401);
    });
  });

  it.each(['agent', 'supervisor', 'admin'] as const)(
    'closes an endpoint with no role to a %s (403)',
    async (role) => {
      expect(await statusOf('/pages/forgotten', role)).toBe(403);
    }
  );
});

/**
 * Every route reachable from `module` (its imports, theirs, and so on), as
 * "GET /path" without the /api prefix, and whether `OnlyFor` guards it, on
 * the method or its controller. OnlyFor is what attaches the guards, so a
 * route without it has none.
 */
function routesOf(module: unknown): { route: string; guarded: boolean }[] {
  const routes: { route: string; guarded: boolean }[] = [];
  const seen = new Set<unknown>();
  const visit = (entry: unknown): void => {
    // A dynamic module, such as JwtModule.registerAsync(...), is an object
    // naming its module class.
    const dynamic = typeof entry === 'object' && entry !== null;
    const moduleClass = dynamic
      ? (entry as { module?: unknown }).module
      : entry;
    if (typeof moduleClass !== 'function' || seen.has(entry)) {
      return;
    }
    seen.add(entry);
    const imports: unknown[] = [
      ...(Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) ?? []),
      ...((dynamic && (entry as { imports?: unknown[] }).imports) || []),
    ];
    imports.forEach(visit);
    const controllers: Function[] =
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleClass) ?? [];
    for (const controller of controllers) {
      const prefix: string = Reflect.getMetadata(PATH_METADATA, controller);
      const classGuarded =
        Reflect.getMetadata(ONLY_FOR_ROLE, controller) !== undefined;
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = Object.getOwnPropertyDescriptor(
          controller.prototype,
          name
        )?.value;
        if (name === 'constructor' || typeof handler !== 'function') {
          continue;
        }
        const path: string | undefined = Reflect.getMetadata(
          PATH_METADATA,
          handler
        );
        if (path === undefined) {
          continue;
        }
        const method: RequestMethod = Reflect.getMetadata(
          METHOD_METADATA,
          handler
        );
        const segments = `${prefix}/${path}`.split('/').filter(Boolean);
        routes.push({
          route: `${RequestMethod[method]} /${segments.join('/')}`,
          guarded:
            classGuarded ||
            Reflect.getMetadata(ONLY_FOR_ROLE, handler) !== undefined,
        });
      }
    }
  };
  visit(module);
  return routes;
}

const unguarded = (module: unknown) =>
  routesOf(module)
    .filter(({ guarded }) => !guarded)
    .map(({ route }) => route)
    .sort();

// A route without OnlyFor has no guard at all, and anyone may call it. So
// the API's open routes are listed here, and a new one fails this spec
// until it is given its roles or, if it is meant to be open, added below.
describe('every route of the API', () => {
  it('is for its roles only, except signing in and out, and health', () => {
    expect(unguarded(AppModule)).toEqual([
      'GET /auth/me',
      'GET /health',
      'POST /auth/sign-in',
      'POST /auth/sign-out',
    ]);
  });

  it('is found, every one of them', () => {
    // health 1, auth 3, events 1, reports 1, teams 4, tickets 8, users 3.
    expect(routesOf(AppModule)).toHaveLength(21);
  });

  it('would show a route that forgot OnlyFor, in an imported module', () => {
    @Controller('open')
    class ForgottenController {
      @Post()
      oops() {
        return { ok: true };
      }

      @Get('fine')
      @OnlyFor('admin')
      fine() {
        return { ok: true };
      }
    }
    @Module({ controllers: [ForgottenController] })
    class ForgottenModule {}
    @Module({
      imports: [{ module: ForgottenModule }],
      controllers: [SupervisorAreaController],
    })
    class SomeAppModule {}

    expect(unguarded(SomeAppModule)).toEqual(['POST /open']);
  });
});
