import { HttpException, HttpStatus } from '@nestjs/common';
import {
  FAILED_SIGN_IN_WINDOW_MS,
  MAX_FAILED_SIGN_INS,
  MAX_SIGN_INS_AT_ONCE,
  MAX_SIGN_INS_WAITING,
  SignInLimits,
} from './sign-in-limits';

describe('SignInLimits', () => {
  let limits: SignInLimits;
  let now: number;

  beforeEach(() => {
    now = Date.UTC(2026, 9, 7, 12);
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    limits = new SignInLimits();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const failTimes = (userId: string, times: number) => {
    for (let i = 0; i < times; i++) {
      limits.failed(userId);
    }
  };

  describe('failed sign-ins for one user ID', () => {
    it(`allows ${MAX_FAILED_SIGN_INS}, then makes it wait`, () => {
      failTimes('sam.rivera', MAX_FAILED_SIGN_INS - 1);
      expect(limits.secondsToWait('sam.rivera')).toBe(0);

      limits.failed('sam.rivera');

      expect(limits.secondsToWait('sam.rivera')).toBe(
        FAILED_SIGN_IN_WINDOW_MS / 1000
      );
    });

    it('lets it try again once the oldest failure is out of the window', () => {
      failTimes('sam.rivera', MAX_FAILED_SIGN_INS);
      now += FAILED_SIGN_IN_WINDOW_MS - 60_000;
      expect(limits.secondsToWait('sam.rivera')).toBe(60);

      now += 60_000;

      expect(limits.secondsToWait('sam.rivera')).toBe(0);
    });

    it('starts again from nothing after a successful sign-in', () => {
      failTimes('sam.rivera', MAX_FAILED_SIGN_INS - 1);
      limits.succeeded('sam.rivera');
      limits.failed('sam.rivera');

      expect(limits.secondsToWait('sam.rivera')).toBe(0);
    });

    it('counts each user ID on its own', () => {
      failTimes('sam.rivera', MAX_FAILED_SIGN_INS);

      expect(limits.secondsToWait('alex.chen')).toBe(0);
    });

    // So a wait does not show whether a user ID exists.
    it('counts a user ID nobody has like any other', () => {
      failTimes('nobody.here', MAX_FAILED_SIGN_INS);

      expect(limits.secondsToWait('nobody.here')).toBe(
        FAILED_SIGN_IN_WINDOW_MS / 1000
      );
    });

    // Anything typed can be a user ID; only well-formed ones get their own
    // count, so made-up values cannot fill the memory.
    it('counts malformed user IDs together', () => {
      failTimes('Not An ID', MAX_FAILED_SIGN_INS);

      expect(limits.secondsToWait('x'.repeat(10_000))).toBeGreaterThan(0);
      expect(limits.secondsToWait('sam.rivera')).toBe(0);
    });
  });

  describe('sign-ins at once', () => {
    /** A sign-in that runs until `finish` is called. */
    const held = () => {
      let finish = () => undefined as void;
      const done = new Promise<void>((resolve) => (finish = resolve));
      return { finish, work: () => done };
    };

    it(`runs ${MAX_SIGN_INS_AT_ONCE} at once, and the next when one ends`, async () => {
      const started: number[] = [];
      const sign = Array.from({ length: MAX_SIGN_INS_AT_ONCE + 1 }, held);
      const runs = sign.map((one, i) =>
        limits.run(() => {
          started.push(i);
          return one.work();
        })
      );
      await Promise.resolve();

      expect(started).toEqual([0, 1, 2, 3]);

      sign[0].finish();
      await runs[0];
      await Promise.resolve();

      expect(started).toEqual([0, 1, 2, 3, 4]);
      sign.forEach((one) => one.finish());
      await Promise.all(runs);
    });

    it(`turns away one more than ${MAX_SIGN_INS_AT_ONCE} running and ${MAX_SIGN_INS_WAITING} waiting, with 429`, async () => {
      const sign = Array.from(
        { length: MAX_SIGN_INS_AT_ONCE + MAX_SIGN_INS_WAITING },
        held
      );
      const runs = sign.map((one) => limits.run(one.work));

      const refused = await limits.run(async () => 'ran').catch((e) => e);

      expect(refused).toBeInstanceOf(HttpException);
      expect((refused as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS
      );
      sign.forEach((one) => one.finish());
      await Promise.all(runs);
      expect(await limits.run(async () => 'ran')).toBe('ran');
    });

    it('frees its place when a sign-in fails', async () => {
      for (
        let i = 0;
        i < MAX_SIGN_INS_AT_ONCE + MAX_SIGN_INS_WAITING + 1;
        i++
      ) {
        await expect(
          limits.run(async () => {
            throw new Error('database down');
          })
        ).rejects.toThrow('database down');
      }

      expect(await limits.run(async () => 'ran')).toBe('ran');
    });
  });
});
