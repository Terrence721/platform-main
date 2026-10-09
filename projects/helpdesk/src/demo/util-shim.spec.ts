import { promisify } from './util-shim';

describe('the demo stand-in for util', () => {
  it("resolves with the callback's result", async () => {
    const add = (a: number, b: number, done: (e: null, r: number) => void) =>
      done(null, a + b);

    await expect(promisify<number>(add)(2, 3)).resolves.toBe(5);
  });

  it("rejects with the callback's error, as Node's promisify does", async () => {
    const error = new Error('scrypt failed');
    const fail = (done: (e: Error) => void) => done(error);

    await expect(promisify(fail)()).rejects.toBe(error);
  });
});
