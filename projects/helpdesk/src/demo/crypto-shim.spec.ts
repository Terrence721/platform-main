import { DemoBytes, randomBytes, scrypt, timingSafeEqual } from './crypto-shim';
import { promisify } from './util-shim';

describe('the demo stand-ins for crypto and util', () => {
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

  // As the API's hashPassword uses them: promisify(scrypt), then base64.
  it('derives a key of the length asked for through promisify', async () => {
    const scryptAsync = promisify<DemoBytes>(scrypt);
    const salt = randomBytes(16);

    const key = await scryptAsync('helpdesk-dev-only', salt, 64);

    expect(key.length).toBe(64);
    expect(key.toString('base64')).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(
      timingSafeEqual(key, await scryptAsync('helpdesk-dev-only', salt, 64))
    ).toBe(true);
    expect(timingSafeEqual(key, await scryptAsync('other', salt, 64))).toBe(
      false
    );
  });

  it('passes an error from the callback on as a rejection', async () => {
    const failing = (done: (error: Error | null) => void) =>
      done(new Error('broken'));

    await expect(promisify(failing)()).rejects.toThrow('broken');
  });
});
