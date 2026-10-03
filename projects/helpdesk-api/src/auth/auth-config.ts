import { SESSION_HOURS } from '@helpdesk/contract';

/**
 * The sign-in secret for local development only: never used when
 * HELPDESK_JWT_SECRET is set, as any real deployment must set it.
 */
export const DEV_JWT_SECRET = 'helpdesk-dev-only-jwt-secret';

/** The cookie the browser keeps the session in. */
export const SESSION_COOKIE = 'helpdesk_session';

/** How long a session lasts, in milliseconds (the contract's hours). */
export const SESSION_MS = SESSION_HOURS * 60 * 60 * 1000;

/** The secret JWTs are signed with: HELPDESK_JWT_SECRET, or the dev one. */
export function jwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env['HELPDESK_JWT_SECRET'] || DEV_JWT_SECRET;
}

/**
 * How the session cookie is set. httpOnly: no script on the page can read
 * it. SameSite=Strict: other sites cannot make the browser send it. Path
 * /api: it only goes with API calls. Secure (HTTPS only) in production;
 * local development runs over plain HTTP.
 */
export function sessionCookieOptions(env: NodeJS.ProcessEnv = process.env): {
  httpOnly: true;
  sameSite: 'strict';
  path: string;
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: 'strict',
    path: '/api',
    maxAge: SESSION_MS,
    secure: env['NODE_ENV'] === 'production',
  };
}
