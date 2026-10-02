import {
  isUserId,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SignInRequest,
  USER_ID_MAX_LENGTH,
} from './auth';

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
