import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  const password = 'correct horse battery';

  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword(password);

    expect(await verifyPassword(password, stored)).toBe(true);
    expect(await verifyPassword('Correct horse battery', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('stores the same password differently each time (a new salt)', async () => {
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).not.toBe(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(password, second)).toBe(true);
  });

  it('stores scrypt$<salt>$<key>, never the password itself', async () => {
    const stored = await hashPassword(password);

    expect(stored).toMatch(/^scrypt\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(stored).not.toContain(password);
  });

  it.each([
    ['empty', ''],
    // bcrypt's shape: $2b$<cost>$<53 characters>.
    ['another format', `$2b$10$${'A1'.repeat(26)}b`],
    ['an unknown prefix', 'argon2$c2FsdA==$a2V5'],
    ['a missing key', 'scrypt$c2FsdA=='],
    ['an extra part', 'scrypt$c2FsdA==$a2V5$more'],
    ['a key of the wrong length', 'scrypt$c2FsdA==$a2V5'],
  ])('answers false, without throwing, for %s', async (_, stored) => {
    await expect(verifyPassword(password, stored)).resolves.toBe(false);
  });
});
