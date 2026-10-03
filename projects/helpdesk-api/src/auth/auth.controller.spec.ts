import type { CurrentUser } from '@helpdesk/contract';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

const sam: CurrentUser = {
  id: 'sam.rivera',
  name: 'Sam Rivera',
  role: 'agent',
  teamId: 'atlas',
};

/** A service that knows one user, password "right-password". */
const fakeAuth = {
  signIn: async (userId: string, password: string) =>
    userId === 'sam.rivera' && password === 'right-password'
      ? { user: sam, token: 'session-token' }
      : null,
  currentUser: async (token: string | undefined) =>
    token === 'session-token' ? sam : null,
};

describe('/api/auth', () => {
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthGuard, { provide: AuthService, useValue: fakeAuth }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // As main.ts sets the app up.
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://localhost:${port}/api/auth`;
  });

  afterEach(async () => {
    await app.close();
  });

  const signIn = (body: string, contentType = 'application/json') =>
    fetch(`${base}/sign-in`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    });

  describe('POST sign-in', () => {
    it('answers 200 with the user, and keeps the session out of the body', async () => {
      const response = await signIn(
        JSON.stringify({ userId: 'sam.rivera', password: 'right-password' })
      );

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(JSON.parse(body)).toEqual({ user: sam });
      expect(body).not.toContain('session-token');
    });

    it('sets the session in an httpOnly, SameSite=Strict cookie for /api, for 8 hours', async () => {
      const response = await signIn(
        JSON.stringify({ userId: 'sam.rivera', password: 'right-password' })
      );
      const [cookie] = response.headers.getSetCookie();

      expect(cookie).toMatch(/^helpdesk_session=session-token;/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api');
      expect(cookie).toContain('Max-Age=28800');
      // Plain HTTP locally; HTTPS only in production.
      expect(cookie).not.toContain('Secure');
    });

    it.each([
      [
        'a wrong password',
        JSON.stringify({ userId: 'sam.rivera', password: 'wrong' }),
        'application/json',
      ],
      ['an empty body', '', 'application/json'],
      [
        'fields of the wrong type',
        JSON.stringify({ userId: 42, password: ['right-password'] }),
        'application/json',
      ],
      ['a body that is not JSON', 'sam.rivera:right-password', 'text/plain'],
    ])(
      'answers %s with 401, the one message, and no cookie',
      async (_, body, contentType) => {
        const response = await signIn(body, contentType);

        expect(response.status).toBe(401);
        const { message } = (await response.json()) as { message: string };

        expect(message).toBe('User ID or password is incorrect.');
        expect(response.headers.getSetCookie()).toEqual([]);
      }
    );
  });

  describe('GET me', () => {
    it('answers with the signed-in user when the session cookie is sent', async () => {
      const response = await fetch(`${base}/me`, {
        headers: { cookie: 'helpdesk_session=session-token' },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ user: sam });
    });

    it.each([
      ['no cookie', undefined],
      ['a session nobody has', 'helpdesk_session=forged'],
    ])('answers 401 with %s', async (_, cookie) => {
      const response = await fetch(`${base}/me`, {
        headers: cookie ? { cookie } : {},
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST sign-out', () => {
    it('answers 204 and has the browser drop the session cookie', async () => {
      const response = await fetch(`${base}/sign-out`, { method: 'POST' });
      const [cookie] = response.headers.getSetCookie();

      expect(response.status).toBe(204);
      expect(cookie).toMatch(/^helpdesk_session=;/);
      expect(cookie).toContain('Path=/api');
      expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
    });
  });
});
