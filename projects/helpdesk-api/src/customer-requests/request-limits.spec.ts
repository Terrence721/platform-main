import { HttpStatus } from '@nestjs/common';
import {
  isLikelySpam,
  MAX_FILE_BYTES,
  MAX_SENDS,
  MAX_STATUS_CHECKS,
  MIN_FILL_MS,
  RequestLimits,
  SEND_WINDOW_MS,
  STATUS_CHECK_WINDOW_MS,
  TooManyRequestsException,
} from './request-limits';

// The public routes' spam checks (#1026): no paid service, so a honeypot,
// a minimum time to fill the form in, and limits per address.
describe('isLikelySpam', () => {
  it('passes a form a person filled in: honeypot empty, a few seconds taken', () => {
    expect(isLikelySpam({ website: '', fillMilliseconds: MIN_FILL_MS })).toBe(
      false
    );
  });

  it('catches a filled honeypot, which people never see', () => {
    expect(
      isLikelySpam({
        website: 'https://spam.example',
        fillMilliseconds: 60_000,
      })
    ).toBe(true);
  });

  it(`catches a form sent within ${MIN_FILL_MS / 1000} seconds of opening`, () => {
    expect(
      isLikelySpam({ website: '', fillMilliseconds: MIN_FILL_MS - 1 })
    ).toBe(true);
  });
});

describe('RequestLimits', () => {
  let limits: RequestLimits;
  let now: number;

  beforeEach(() => {
    now = Date.UTC(2026, 9, 9, 12);
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    limits = new RequestLimits();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Takes `times` turns at `take` for `address`, as one visitor would. */
  const takeTimes = (
    take: (address: string) => void,
    address: string,
    times: number
  ) => {
    for (let i = 0; i < times; i++) {
      take(address);
    }
  };

  describe.each([
    ['sending requests', 'send', MAX_SENDS, SEND_WINDOW_MS],
    [
      'checking on requests',
      'statusCheck',
      MAX_STATUS_CHECKS,
      STATUS_CHECK_WINDOW_MS,
    ],
  ] as const)('%s', (_, method, max, windowMs) => {
    const take = (address: string) => limits[method](address);

    it(`allows ${max} from one address, then answers 429 with how long to wait`, () => {
      takeTimes(take, '203.0.113.7', max);

      expect(() => take('203.0.113.7')).toThrow(TooManyRequestsException);
      try {
        take('203.0.113.7');
      } catch (error) {
        expect((error as TooManyRequestsException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS
        );
        expect((error as TooManyRequestsException).retryAfterSeconds).toBe(
          windowMs / 1000
        );
      }
    });

    it('allows one more once the oldest is out of the window', () => {
      takeTimes(take, '203.0.113.7', max);
      now += windowMs;

      expect(() => take('203.0.113.7')).not.toThrow();
    });

    it('counts each address on its own', () => {
      takeTimes(take, '203.0.113.7', max);

      expect(() => take('198.51.100.20')).not.toThrow();
    });

    // A refused one does not count, so waiting out the window is enough.
    it('does not count a refused one', () => {
      takeTimes(take, '203.0.113.7', max);
      for (let i = 0; i < 10; i++) {
        expect(() => take('203.0.113.7')).toThrow(TooManyRequestsException);
      }
      now += windowMs;

      expect(() => take('203.0.113.7')).not.toThrow();
    });
  });

  // Files, by their size as sent (#1026): a few sends of large files
  // could otherwise fill the database within the count's limit.
  describe('sending files', () => {
    const MB = 1024 * 1024;
    const MINUTE = 60_000;

    it(`allows ${MAX_FILE_BYTES / MB} MB an hour from one address, then answers 429 with how long until it fits`, () => {
      limits.sendBytes('203.0.113.7', 5 * MB);
      now += 10 * MINUTE;
      limits.sendBytes('203.0.113.7', 15 * MB);
      now += 10 * MINUTE;

      // 5 + 15 + 10 is over 25: it fits once the first 5 MB are an hour old.
      let refused: unknown;
      try {
        limits.sendBytes('203.0.113.7', 10 * MB);
      } catch (error) {
        refused = error;
      }
      expect(refused).toBeInstanceOf(TooManyRequestsException);
      expect((refused as TooManyRequestsException).retryAfterSeconds).toBe(
        40 * 60
      );

      now += 40 * MINUTE;
      expect(() => limits.sendBytes('203.0.113.7', 10 * MB)).not.toThrow();
    });

    it('allows exactly the limit', () => {
      expect(() =>
        limits.sendBytes('203.0.113.7', MAX_FILE_BYTES)
      ).not.toThrow();
      expect(() => limits.sendBytes('203.0.113.7', 1)).toThrow(
        TooManyRequestsException
      );
    });

    it('counts each address on its own, and not a refused send', () => {
      limits.sendBytes('203.0.113.7', 20 * MB);
      expect(() => limits.sendBytes('203.0.113.7', 10 * MB)).toThrow();

      expect(() => limits.sendBytes('203.0.113.7', 5 * MB)).not.toThrow();
      expect(() => limits.sendBytes('198.51.100.20', 25 * MB)).not.toThrow();
    });

    it('never refuses, or counts, a send with no files', () => {
      limits.sendBytes('203.0.113.7', MAX_FILE_BYTES);

      expect(() => limits.sendBytes('203.0.113.7', 0)).not.toThrow();
    });

    it('keeps apart from the count of sends', () => {
      limits.sendBytes('203.0.113.7', MAX_FILE_BYTES);

      expect(() => limits.send('203.0.113.7')).not.toThrow();
    });
  });

  it('keeps the two limits apart: checking does not use up sending', () => {
    takeTimes(
      (address) => limits.statusCheck(address),
      '203.0.113.7',
      MAX_STATUS_CHECKS
    );

    expect(() => limits.send('203.0.113.7')).not.toThrow();
  });
});
