import { randomBytes, scryptSync } from 'crypto';
import { hashPassword, verifyPassword } from './password';

// At OWASP's cost each hash takes about half a second (#1039).
describe('password hashing', { timeout: 30_000 }, () => {
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

  it('stores scrypt$<cost>$<salt>$<key> at OWASP cost, never the password itself (#1039)', async () => {
    const stored = await hashPassword(password);

    // N = 2^17, r = 8, p = 1: OWASP's minimum for scrypt.
    expect(stored).toMatch(
      /^scrypt\$N=131072,r=8,p=1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/
    );
    expect(stored).not.toContain(password);
  });

  it('reads the cost from the stored form, so a hash made at another cost still verifies (#1039)', async () => {
    const salt = randomBytes(16);
    const key = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 });
    const stored = `scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${key.toString('base64')}`;

    expect(await verifyPassword(password, stored)).toBe(true);
    expect(await verifyPassword('wrong', stored)).toBe(false);
  });

  /** A well-formed hash's salt and key, to pair with other cost settings. */
  const saltAndKey = async () =>
    (await hashPassword(password)).split('$').slice(2).join('$');

  it.each([
    ['no cost settings', ''],
    ['an unknown setting', 'N=131072,r=8,p=1,x=1'],
    ['a missing setting', 'N=131072,r=8'],
    ['an N that is not a power of two', 'N=131071,r=8,p=1'],
    ['an N below the minimum', 'N=1024,r=8,p=1'],
    ['an N too large to run', 'N=1073741824,r=8,p=1'],
    ['an r of zero', 'N=131072,r=0,p=1'],
    ['a p of zero', 'N=131072,r=8,p=0'],
    ['settings that are not numbers', 'N=lots,r=8,p=1'],
  ])('answers false, without throwing, for %s (#1039)', async (_, settings) => {
    const stored = `scrypt$${settings}$${await saltAndKey()}`;

    await expect(verifyPassword(password, stored)).resolves.toBe(false);
  });

  it.each([
    ['empty', ''],
    // bcrypt's shape: $2b$<cost>$<53 characters>.
    ['another format', `$2b$10$${'A1'.repeat(26)}b`],
    ['an unknown prefix', 'argon2$N=131072,r=8,p=1$c2FsdA==$a2V5'],
    ['the old form, without cost settings', 'scrypt$c2FsdA==$a2V5'],
    ['a missing key', 'scrypt$N=131072,r=8,p=1$c2FsdA=='],
    ['an extra part', 'scrypt$N=131072,r=8,p=1$c2FsdA==$a2V5$more'],
    ['a key of the wrong length', 'scrypt$N=131072,r=8,p=1$c2FsdA==$a2V5'],
  ])('answers false, without throwing, for %s', async (_, stored) => {
    await expect(verifyPassword(password, stored)).resolves.toBe(false);
  });
});
