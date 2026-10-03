import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number
) => Promise<Buffer>;

/** Bytes of random salt per password, and of derived key. */
const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** Marks the format, so a stronger one can be added later. */
const PREFIX = 'scrypt';

/**
 * A password as stored: `scrypt$<salt>$<key>`, both base64. Each call uses
 * a new random salt, so the same password never stores the same way twice.
 * Uses Node's built-in scrypt (no extra package).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_BYTES);
  return [PREFIX, salt.toString('base64'), key.toString('base64')].join('$');
}

/**
 * Whether a password matches a stored hash. Compares in constant time, and
 * answers false (never throws) for a hash it cannot read.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [prefix, salt, key, ...rest] = stored.split('$');
  if (prefix !== PREFIX || !salt || !key || rest.length > 0) {
    return false;
  }
  const expected = Buffer.from(key, 'base64');
  if (expected.length !== KEY_BYTES) {
    return false;
  }
  const actual = await scryptAsync(
    password,
    Buffer.from(salt, 'base64'),
    KEY_BYTES
  );
  return timingSafeEqual(actual, expected);
}
