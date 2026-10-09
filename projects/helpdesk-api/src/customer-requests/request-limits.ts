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

  /** Counts a request sent from `address`, or refuses it with 429. */
  send(address: string): void {
    this.sends.take(address);
  }

  /** Counts a status check from `address`, or refuses it with 429. */
  statusCheck(address: string): void {
    this.statusChecks.take(address);
  }
}
