import type { Role } from './roles';

/**
 * How a user ID looks: 3 to 32 characters, lowercase letters, digits, dots
 * and hyphens, starting with a letter, such as `sam.rivera` or `agent-sam`.
 * Admins choose it when they set up an account.
 */
export const USER_ID_PATTERN = /^[a-z][a-z0-9.-]{2,31}$/;
export const USER_ID_MAX_LENGTH = 32;

/**
 * Password lengths. The minimum applies when a password is set, so the
 * sign-in form does not repeat it; the maximum applies everywhere.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** What the sign-in form sends to the API. */
export interface SignInRequest {
  userId: string;
  password: string;
}

/** The signed-in user, as the API describes them to the app. */
export interface CurrentUser {
  /** The sign-in user ID, e.g. `sam.rivera`. */
  id: string;
  name: string;
  role: Role;
  /** The user's team; `null` for admins, who belong to none. */
  teamId: string | null;
}

/**
 * What a successful sign-in returns. The session itself travels in an
 * httpOnly cookie the browser keeps, never in the response body.
 */
export interface SignInResponse {
  user: CurrentUser;
}

/**
 * Who is signed in (`GET /api/auth/me`): the user, or `null` when nobody
 * is (no session, or one that expired or whose account is inactive).
 * "Nobody" is an ordinary answer, not an error, so a first visit does not
 * log a failed request.
 */
export interface SessionResponse {
  user: CurrentUser | null;
}

/** The one answer for any failed sign-in, so user IDs cannot be guessed. */
export const SIGN_IN_FAILED_MESSAGE = 'User ID or password is incorrect.';

/** How long a sign-in lasts: one support shift. */
export const SESSION_HOURS = 8;

/** Whether a value, such as a form field, is a well-formed user ID. */
export function isUserId(value: unknown): value is string {
  return typeof value === 'string' && USER_ID_PATTERN.test(value);
}
