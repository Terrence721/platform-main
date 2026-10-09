import type { CreateRequestRequest } from '@helpdesk/contract';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

// The public routes' spam checks (#1026), with no paid service: a honeypot
// field, a minimum time to fill the form in, and limits per address.

/** The shortest time a person takes to fill the form in. */
export const MIN_FILL_MS = 3_000;

/** Requests one address may send in the window. */
export const MAX_SENDS = 5;
export const SEND_WINDOW_MS = 60 * 60_000;

/** Status checks one address may make in the window. */
export const MAX_STATUS_CHECKS = 30;
export const STATUS_CHECK_WINDOW_MS = 10 * 60_000;

/**
 * Bytes of files one address may send in the window (that of sends): at
 * most 15 MB go with one request, so a person sending a few is never
 * near it, while the database can't be filled a request at a time.
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * Whether a request looks sent by a program, not a person: the hidden
 * field filled in, or the form sent faster than anyone could fill it.
 * The route answers such a request as if it worked and keeps nothing, so
 * a bot cannot tell it was caught.
 */
export function isLikelySpam({
  website,
  fillMilliseconds,
}: Pick<CreateRequestRequest, 'website' | 'fillMilliseconds'>): boolean {
  return website !== '' || fillMilliseconds < MIN_FILL_MS;
}

/** 429, with how long to wait (also sent as Retry-After). */
export class TooManyRequestsException extends HttpException {
  constructor(
    readonly retryAfterSeconds: number,
    message: string
  ) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * How many times each address used something in a sliding window. Kept in
 * memory, as the sign-in limits are: the API runs as one instance, and a
 * restart starting the counts afresh is acceptable.
 */
class SlidingLimit {
  /** When each address used it recently, oldest first. */
  private readonly uses = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly message: string
  ) {}

  /**
   * Counts one use by `address`, or refuses it with 429 once it has had
   * `max` in the window. A refused use does not count, so waiting out the
   * window is always enough.
   */
  take(address: string): void {
    const now = Date.now();
    const recent = (this.uses.get(address) ?? []).filter(
      (at) => at > now - this.windowMs
    );
    if (recent.length >= this.max) {
      const until = recent[recent.length - this.max] + this.windowMs;
      throw new TooManyRequestsException(
        Math.ceil((until - now) / 1000),
        this.message
      );
    }
    // Re-added, so the Map's order stays oldest use first.
    this.uses.delete(address);
    this.uses.set(address, [...recent, now]);
    this.forgetExpired(now);
  }

  /** Drops addresses whose last use is out of the window. */
  private forgetExpired(now: number): void {
    for (const [address, times] of this.uses) {
      if (times[times.length - 1] > now - this.windowMs) {
        // The rest were used later, so are recent too.
        return;
      }
      this.uses.delete(address);
    }
  }
}

/**
 * How much each address sent in a sliding window: as SlidingLimit, but
 * each use counts by its amount (bytes of files), not as one.
 */
class SlidingTotal {
  /** What each address sent recently, and when, oldest first. */
  private readonly sent = new Map<string, { at: number; amount: number }[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly message: string
  ) {}

  /**
   * Counts `amount` from `address`, or refuses it with 429 when it would
   * take the window's total over `max`, saying how long until enough of
   * the earlier ones are out of the window for it to fit. Nothing (0) is
   * never refused or kept; a refused amount does not count.
   */
  take(address: string, amount: number): void {
    if (amount <= 0) {
      return;
    }
    const now = Date.now();
    const recent = (this.sent.get(address) ?? []).filter(
      ({ at }) => at > now - this.windowMs
    );
    let total = recent.reduce((sum, { amount: sent }) => sum + sent, 0);
    if (total + amount > this.max) {
      // The oldest leave the window first: wait until enough have.
      let until = now + this.windowMs;
      for (const { at, amount: sent } of recent) {
        total -= sent;
        if (total + amount <= this.max) {
          until = at + this.windowMs;
          break;
        }
      }
      throw new TooManyRequestsException(
        Math.ceil((until - now) / 1000),
        this.message
      );
    }
    // Re-added, so the Map's order stays oldest send first.
    this.sent.delete(address);
    this.sent.set(address, [...recent, { at: now, amount }]);
    for (const [other, entries] of this.sent) {
      if (entries[entries.length - 1].at > now - this.windowMs) {
        break;
      }
      this.sent.delete(other);
    }
  }
}

/** The limits on the public routes, per visitor's address. */
@Injectable()
export class RequestLimits {
  private readonly sends = new SlidingLimit(
    MAX_SENDS,
    SEND_WINDOW_MS,
    'Too many requests from here. Please try again later.'
  );
  private readonly statusChecks = new SlidingLimit(
    MAX_STATUS_CHECKS,
    STATUS_CHECK_WINDOW_MS,
    'Too many checks from here. Please try again later.'
  );

  private readonly fileBytes = new SlidingTotal(
    MAX_FILE_BYTES,
    SEND_WINDOW_MS,
    'Too many files from here. Please try again later.'
  );

  /** Counts a request sent from `address`, or refuses it with 429. */
  send(address: string): void {
    this.sends.take(address);
  }

  /** Counts `bytes` of files sent from `address`, or refuses them with 429. */
  sendBytes(address: string, bytes: number): void {
    this.fileBytes.take(address, bytes);
  }

  /** Counts a status check from `address`, or refuses it with 429. */
  statusCheck(address: string): void {
    this.statusChecks.take(address);
  }
}
