// The demo build's stand-in for Node's crypto (tsconfig.demo.json points the
// import here). Only the server library's hashPassword runs in the demo (the
// seed and Create Account), never verifyPassword: demo sign-in checks the
// shared, published demo password instead, or the one Create Account set
// during the visit, which the demo API keeps in memory (#942). Every
// password lives in the visitor's browser and resets on reload, so a slow
// key derivation would only delay the start; this one is quick, and marked
// as not a real key.

/** Bytes that print themselves as Node's Buffer does, in base64 or hex. */
export class DemoBytes {
  constructor(readonly bytes: Uint8Array) {}

  get length(): number {
    return this.bytes.length;
  }

  toString(encoding: 'base64' | 'hex' = 'hex'): string {
    if (encoding === 'base64') {
      return btoa(String.fromCharCode(...this.bytes));
    }
    return Array.from(this.bytes, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
  }
}

/** Random bytes, from the browser's own generator. */
export function randomBytes(size: number): DemoBytes {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return new DemoBytes(bytes);
}

type ScryptCallback = (error: Error | null, key: DemoBytes) => void;

/**
 * Node's callback signature, with or without its cost options (which the
 * password helpers pass, #1039, and this ignores), and a quick stand-in
 * key: the password and salt marked "demo", padded to the length asked
 * for. Not a real key.
 */
export function scrypt(
  password: string,
  salt: DemoBytes,
  keyLength: number,
  optionsOrDone: object | ScryptCallback,
  maybeDone?: ScryptCallback
): void {
  const done = typeof optionsOrDone === 'function' ? optionsOrDone : maybeDone;
  if (done === undefined) {
    throw new TypeError('scrypt needs a callback.');
  }
  const text = new TextEncoder().encode(
    `demo:${salt.toString('hex')}:${password}`
  );
  const key = new Uint8Array(keyLength);
  key.set(text.subarray(0, keyLength));
  done(null, new DemoBytes(key));
}

/** Whether two byte strings are equal (constant time is not needed here). */
export function timingSafeEqual(a: DemoBytes, b: DemoBytes): boolean {
  return (
    a.length === b.length && a.bytes.every((byte, i) => byte === b.bytes[i])
  );
}
