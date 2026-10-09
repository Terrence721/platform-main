import { HttpStatus } from '@nestjs/common';
import {
  isLikelySpam,
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

  it('keeps the two limits apart: checking does not use up sending', () => {
    takeTimes(
      (address) => limits.statusCheck(address),
      '203.0.113.7',
      MAX_STATUS_CHECKS
    );

    expect(() => limits.send('203.0.113.7')).not.toThrow();
  });
});
