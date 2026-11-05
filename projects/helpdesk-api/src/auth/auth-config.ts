import { SESSION_HOURS } from '@helpdesk/contract';

/**
 * The sign-in secret for local development only. It is published in this
 * repository, so production never uses it (see jwtSecret).
 */
export const DEV_JWT_SECRET = 'helpdesk-dev-only-jwt-secret';

/** The shortest secret production accepts: 256 bits, as HS256 needs. */
export const MIN_JWT_SECRET_LENGTH = 32;

/** The cookie the browser keeps the session in. */
export const SESSION_COOKIE = 'helpdesk_session';

/** How long a session lasts, in milliseconds (the contract's hours). */
export const SESSION_MS = SESSION_HOURS * 60 * 60 * 1000;

/**
 * The secret JWTs are signed with: HELPDEASK_JWT_SECRET, or, when it is not
 * set outside production, the development one. In production
 * (NODE_ENV=production, as in the Docker image) HELPDESK_JWT_SECRET must be
 * set, and the published development secret, or one shorter than 32
 * characters, stops the API from starting.
 */
export function jwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env['HELPDESK_JWT_SECRET'];
  if (env['NODE_ENV'] !== 'production') {
    return secret || DEV_JWT_SECRET;
  }
  if (!secret) {
    throw new Error(
      'HELPDESK_JWT_SECRET must be set in production: sessions would be ' +
        'signed with a random secret that changes on every restart.'
    );
  }
  if (secret === DEV_JWT_SECRET) {
    throw new Error(
      'HELPDESK_JWT_SECRET is the published development secret, which ' +
        'anyone could sign a session with; set a long, random one.'
    );
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `HELPDESK_JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} ` +
        'characters long.'
    );
  }
  return secret;
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
