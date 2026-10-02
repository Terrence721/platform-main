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

/** Whether a value, such as a form field, is a well-formed user ID. */
export function isUserId(value: unknown): value is string {
  return typeof value === 'string' && USER_ID_PATTERN.test(value);
}
