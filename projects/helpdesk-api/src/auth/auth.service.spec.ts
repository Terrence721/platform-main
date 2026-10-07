import { hashPassword } from '@helpdesk/server';
import { JwtService } from '@nestjs/jwt';
import type { Database } from '../database/database.module';
import {
  DEV_JWT_SECRET,
  jwtSecret,
  SESSION_MS,
  sessionCookieOptions,
} from './auth-config';
import { AuthService } from './auth.service';

const PASSWORD = 'helpdesk-dev-only';

interface FakeUser {
  id: string;
  name: string;
  role: 'agent' | 'supervisor' | 'admin';
  teamId: string | null;
  active: boolean;
  passwordHash: string;
}

/**
 * A stand-in for the Drizzle client's `select().from().where().limit()`,
 * answering from a list of users. The user ID asked for is the query's
 * parameter: the chunk with an `encoder` (its SQL text pieces have a
 * `value` too, so that alone does not find it).
 */
function fakeDatabase(rows: FakeUser[]) {
  return {
    select: () => ({
      from: () => ({
        where: (condition: { queryChunks: unknown[] }) => ({
          limit: async () => {
            const asked = condition.queryChunks.find(
              (chunk): chunk is { value: unknown } =>
                typeof chunk === 'object' &&
                chunk !== null &&
                'encoder' in chunk &&
                'value' in chunk
            )?.value;
            return rows.filter((row) => row.id === asked);
          },
        }),
      }),
    }),
  } as unknown as Database;
}

describe('AuthService', () => {
  let rows: FakeUser[];
  let jwt: JwtService;
  let auth: AuthService;

  beforeEach(async () => {
    const passwordHash = await hashPassword(PASSWORD);
    rows = [
      {
        id: 'sam.rivera',
        name: 'Sam Rivera',
        role: 'agent',
        teamId: 'atlas',
        active: true,
        passwordHash,
      },
      {
        id: 'gone.user',
        name: 'Gone User',
        role: 'agent',
        teamId: 'atlas',
        active: false,
        passwordHash,
      },
    ];
    jwt = new JwtService({
      secret: 'test-secret',
      signOptions: { expiresIn: '8h' },
    });
    auth = new AuthService(fakeDatabase(rows), jwt);
  });

  describe('signIn', () => {
    it('signs in with the right password: the user and a session token', async () => {
      const result = await auth.signIn('sam.rivera', PASSWORD);

      expect(result?.user).toEqual({
        id: 'sam.rivera',
        name: 'Sam Rivera',
        role: 'agent',
        teamId: 'atlas',
      });
      expect(await jwt.verifyAsync(result?.token ?? '')).toMatchObject({
        sub: 'sam.rivera',
        role: 'agent',
      });
    });

    it('never hands back the password hash', async () => {
      const result = await auth.signIn('sam.rivera', PASSWORD);

      expect(JSON.stringify(result)).not.toContain('scrypt$');
    });

    it.each([
      ['a wrong password', 'sam.rivera', 'not-the-password'],
      ['a user ID nobody has', 'nobody.here', PASSWORD],
      ['an inactive user', 'gone.user', PASSWORD],
      ['a malformed user ID', 'Sam Rivera', PASSWORD],
      ['an over-long password', 'sam.rivera', 'x'.repeat(129)],
    ])('fails the same way (null) for %s', async (_, userId, password) => {
      expect(await auth.signIn(userId, password)).toBeNull();
    });
  });

  describe('currentUser', () => {
    it('recognizes a fresh session token', async () => {
      const signedIn = await auth.signIn('sam.rivera', PASSWORD);

      expect(await auth.currentUser(signedIn?.token)).toEqual(signedIn?.user);
    });

    it('recognizes nobody without a token, or with a broken one', async () => {
      const signedIn = await auth.signIn('sam.rivera', PASSWORD);

      expect(await auth.currentUser(undefined)).toBeNull();
      expect(await auth.currentUser('')).toBeNull();
      expect(await auth.currentUser(`${signedIn?.token}x`)).toBeNull();
    });

    it('recognizes nobody from a token signed with another secret', async () => {
      const forged = await new JwtService({ secret: 'someone-else' }).signAsync(
        { sub: 'sam.rivera', role: 'admin' }
      );

      expect(await auth.currentUser(forged)).toBeNull();
    });

    it('recognizes nobody once the session has expired', async () => {
      const expired = await jwt.signAsync(
        { sub: 'sam.rivera', role: 'agent' },
        { expiresIn: -10 }
      );

      expect(await auth.currentUser(expired)).toBeNull();
    });

    it('ends the session of a user deactivated after signing in', async () => {
      const signedIn = await auth.signIn('sam.rivera', PASSWORD);
      rows[0].active = false;

      expect(await auth.currentUser(signedIn?.token)).toBeNull();
    });
  });

  // A live-updates stream must end with its session (#1073), so it needs to
  // know when that is.
  describe('sessionEndsAt', () => {
    it("is the token's expiry: eight hours after signing in", async () => {
      const signedIn = await auth.signIn('sam.rivera', PASSWORD);
      const { exp } = jwt.decode<{ exp: number }>(signedIn?.token ?? '');

      expect(await auth.sessionEndsAt(signedIn?.token)).toEqual(
        new Date(exp * 1000)
      );
      expect(exp * 1000 - Date.now()).toBeGreaterThan(8 * 60 * 60_000 - 60_000);
    });

    it('is nothing without a valid token', async () => {
      const signedIn = await auth.signIn('sam.rivera', PASSWORD);
      const expired = await jwt.signAsync(
        { sub: 'sam.rivera', role: 'agent' },
        { expiresIn: -10 }
      );
      const forged = await new JwtService({ secret: 'someone-else' }).signAsync(
        { sub: 'sam.rivera', role: 'agent' },
        { expiresIn: '8h' }
      );

      expect(await auth.sessionEndsAt(undefined)).toBeNull();
      expect(await auth.sessionEndsAt(`${signedIn?.token}x`)).toBeNull();
      expect(await auth.sessionEndsAt(expired)).toBeNull();
      expect(await auth.sessionEndsAt(forged)).toBeNull();
    });
  });
});

describe('auth config', () => {
  it('signs with HELPDESK_JWT_SECRET, or the development secret', () => {
    expect(jwtSecret({ HELPDESK_JWT_SECRET: 'from-env' })).toBe('from-env');
    expect(jwtSecret({})).toBe(DEV_JWT_SECRET);
    expect(jwtSecret({ HELPDESK_JWT_SECRET: '' })).toBe(DEV_JWT_SECRET);
  });

  it('keeps the session in an httpOnly, SameSite=Strict cookie for /api, for 8 hours', () => {
    expect(sessionCookieOptions({})).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      path: '/api',
      maxAge: 8 * 60 * 60 * 1000,
      secure: false,
    });
    expect(SESSION_MS).toBe(8 * 60 * 60 * 1000);
  });

  it('sends the cookie over HTTPS only in production', () => {
    expect(sessionCookieOptions({ NODE_ENV: 'production' }).secure).toBe(true);
    expect(sessionCookieOptions({ NODE_ENV: 'development' }).secure).toBe(
      false
    );
  });
});
