import { jwtSecret, sessionCookieOptions } from './auth-config';

describe('jwtSecret', () => {
  it('uses the development secret outside production when none is set', () => {
    expect(jwtSecret({})).toBe('helpdesk-dev-only-jwt-secret');
    expect(jwtSecret({ HELPDESK_JWT_SECRET: 'custom-secret' })).toBe(
      'custom-secret'
    );
  });

  it('throws for the published development secret in production', () => {
    expect(() =>
      jwtSecret({
        NODE_ENV: 'production',
        HELPDESK_JWT_SECRET: 'helpdesk-dev-only-jwt-secret',
      })
    ).toThrow('published development secret');
  });

  it('throws for a short secret in production', () => {
    expect(() =>
      jwtSecret({
        NODE_ENV: 'production',
        HELPDESK_JWT_SECRET: 'short',
      })
    ).toThrow('at least 32 characters');
  });

  it('accepts a long secret in production', () => {
    const secret = 'a'.repeat(32);

    expect(
      jwtSecret({ NODE_ENV: 'production', HELPDESK_JWT_SECRET: secret })
    ).toBe(secret);
  });

  it('requires HELPDESK_JWT_SECRET in production', () => {
    expect(() => jwtSecret({ NODE_ENV: 'production' })).toThrow(
      'HELPDESK_JWT_SECRET must be set in production'
    );
  });
});

describe('sessionCookieOptions', () => {
  it('uses insecure local defaults outside production', () => {
    expect(sessionCookieOptions({})).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      path: '/api',
      maxAge: 8 * 60 * 60 * 1000,
      secure: false,
    });
  });

  it('sets secure in production', () => {
    expect(sessionCookieOptions({ NODE_ENV: 'production' }).secure).toBe(true);
  });
});
