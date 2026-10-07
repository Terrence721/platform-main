// Node's crypto and Buffer, declared here rather than left to another
// import to bring in: the app type-checks this file for the in-browser
// demo, whose build swaps crypto for its own stand-in (#1043).
/// <reference types="node" />
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

/** scrypt's cost settings: CPU and memory cost, block size, parallelism. */
interface ScryptCost {
  N: number;
  r: number;
  p: number;
}

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptCost & { maxmem: number }
) => Promise<Buffer>;

/** Bytes of random salt per password, and of derived key. */
const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** Marks the format, so a stronger one can be added later. */
const PREFIX = 'scrypt';

/**
 * The cost new passwords are hashed at: OWASP's minimum for scrypt
 * (N = 2^17, r = 8, p = 1), about half a second per hash (#1039).
 */
const COST: ScryptCost = { N: 2 ** 17, r: 8, p: 1 };

/**
 * The most memory one hash may use. scrypt needs 128 × N × r bytes (128 MB
 * at COST); Node's default limit, 32 MB, would refuse it.
 */
const MAX_MEMORY = 256 * 1024 * 1024;

/** The lowest N a stored hash may name: Node's own default. */
const MIN_N = 2 ** 14;

/**
 * A password as stored: `scrypt$N=131072,r=8,p=1$<salt>$<key>`, salt and key
 * in base64. The cost travels with the hash, so it can be raised later
 * without breaking the hashes already stored. Each call uses a new random
 * salt, so the same password never stores the same way twice. Uses Node's
 * built-in scrypt (no extra package).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_BYTES, {
    ...COST,
    maxmem: MAX_MEMORY,
  });
  return [
    PREFIX,
    `N=${COST.N},r=${COST.r},p=${COST.p}`,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

/**
 * Whether a password matches a stored hash, at the cost the hash names.
 * Compares in constant time, and answers false (never throws) for a hash
 * it cannot read, including one whose cost is missing, malformed, below
 * Node's default or too large to run.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [prefix, settings, salt, key, ...rest] = stored.split('$');
  if (prefix !== PREFIX || !salt || !key || rest.length > 0) {
    return false;
  }
  const cost = readCost(settings);
  if (cost === null) {
    return false;
  }
  const expected = Buffer.from(key, 'base64');
  if (expected.length !== KEY_BYTES) {
    return false;
  }
  const actual = await scryptAsync(
    password,
    Buffer.from(salt, 'base64'),
    KEY_BYTES,
    { ...cost, maxmem: MAX_MEMORY }
  );
  return timingSafeEqual(actual, expected);
}

/**
 * The cost a stored hash names (`N=…,r=…,p=…`, in that order), or `null`
 * when it is not one this server will run: N must be a power of two from
 * Node's default up, and the whole must fit in MAX_MEMORY.
 */
function readCost(settings: string | undefined): ScryptCost | null {
  const match = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(settings ?? '');
  if (match === null) {
    return null;
  }
  const [N, r, p] = match.slice(1).map(Number);
  const powerOfTwo = (N & (N - 1)) === 0;
  const fits = 128 * N * r < MAX_MEMORY;
  return powerOfTwo && N >= MIN_N && r >= 1 && p >= 1 && fits
    ? { N, r, p }
    : null;
}
