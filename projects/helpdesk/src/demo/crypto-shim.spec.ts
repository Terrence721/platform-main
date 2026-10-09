import { DemoBytes, randomBytes, scrypt, timingSafeEqual } from './crypto-shim';
import { promisify } from './util-shim';

// promisify's own tests, a rejection among them, are util-shim.spec.ts's.
describe('the demo stand-in for crypto', () => {
  it('prints bytes as Node does, in base64 and hex', () => {
    const bytes = new DemoBytes(new Uint8Array([104, 105, 255]));

    expect(bytes.toString('base64')).toBe('aGn/');
    expect(bytes.toString('hex')).toBe('6869ff');
    expect(bytes.length).toBe(3);
  });

  it('makes random salts of the size asked for, different each time', () => {
    const first = randomBytes(16);

    expect(first.length).toBe(16);
    expect(first.toString('hex')).not.toBe(randomBytes(16).toString('hex'));
  });

  // As the server library's hashPassword uses them: promisify(scrypt) with
  // the cost options (#1039), then base64.
  it('derives a key of the length asked for through promisify', async () => {
    const scryptAsync = promisify<DemoBytes>(scrypt);
    const salt = randomBytes(16);
    const cost = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

    const key = await scryptAsync('helpdesk-dev-only', salt, 64, cost);

    expect(key.length).toBe(64);
    expect(key.toString('base64')).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(
      timingSafeEqual(
        key,
        await scryptAsync('helpdesk-dev-only', salt, 64, cost)
      )
    ).toBe(true);
    expect(
      timingSafeEqual(key, await scryptAsync('other', salt, 64, cost))
    ).toBe(false);
  });

  it('also takes the call without options, as Node does', async () => {
    const scryptAsync = promisify<DemoBytes>(scrypt);

    expect((await scryptAsync('x', randomBytes(16), 64)).length).toBe(64);
  });
});
