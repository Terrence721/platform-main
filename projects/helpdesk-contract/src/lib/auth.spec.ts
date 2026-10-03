import {
  CurrentUser,
  isUserId,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SESSION_HOURS,
  SIGN_IN_FAILED_MESSAGE,
  SignInRequest,
  SignInResponse,
  USER_ID_MAX_LENGTH,
} from './auth';
import type { Role } from './roles';

describe('user IDs', () => {
  it.each(['sam.rivera', 'agent-sam', 'ada', 'k.johnson2'])(
    'accepts %s',
    (userId) => {
      expect(isUserId(userId)).toBe(true);
    }
  );

  it.each([
    ['too short', 'sa'],
    ['uppercase', 'Sam.Rivera'],
    ['starting with a digit', '1sam'],
    ['starting with a dot', '.sam'],
    ['with a space', 'sam rivera'],
    ['with an underscore', 'sam_rivera'],
    ['an email address', 'sam@example.com'],
    ['empty', ''],
  ])('rejects one that is %s', (_, userId) => {
    expect(isUserId(userId)).toBe(false);
  });

  it('allows exactly USER_ID_MAX_LENGTH characters', () => {
    expect(isUserId('s'.repeat(USER_ID_MAX_LENGTH))).toBe(true);
    expect(isUserId('s'.repeat(USER_ID_MAX_LENGTH + 1))).toBe(false);
  });

  it.each([null, undefined, 42, {}, ['sam']])(
    'rejects %s, which is not a string',
    (value) => {
      expect(isUserId(value)).toBe(false);
    }
  );
});

describe('password lengths', () => {
  it('are 12 to 128 characters', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });
});

describe('SignInRequest', () => {
  it('carries a user ID and a password', () => {
    expectTypeOf<SignInRequest>().toEqualTypeOf<{
      userId: string;
      password: string;
    }>();
  });
});

describe('the signed-in user', () => {
  it('is described by user ID, name, role and team (none for admins)', () => {
    expectTypeOf<CurrentUser>().toEqualTypeOf<{
      id: string;
      name: string;
      role: Role;
      teamId: string | null;
    }>();
  });

  it('comes back from a sign-in, without the session itself', () => {
    expectTypeOf<SignInResponse>().toEqualTypeOf<{ user: CurrentUser }>();
  });
});

describe('a failed sign-in', () => {
  it('says the same thing whatever went wrong', () => {
    expect(SIGN_IN_FAILED_MESSAGE).toBe('User ID or password is incorrect.');
  });

  it('never tells which part was wrong, so user IDs cannot be guessed', () => {
    expect(SIGN_IN_FAILED_MESSAGE).not.toMatch(
      /not found|does not exist|unknown|wrong password|inactive/i
    );
  });
});

describe('a sign-in session', () => {
  it('lasts one support shift', () => {
    expect(SESSION_HOURS).toBe(8);
  });
});
