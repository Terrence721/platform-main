import { isUserId } from '@helpdesk/contract';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/** Failed sign-ins one user ID may have in the window before it waits. */
export const MAX_FAILED_SIGN_INS = 5;
export const FAILED_SIGN_IN_WINDOW_MS = 15 * 60_000;

/**
 * Sign-ins checked at once, and how many more may wait their turn. Each
 * check is about half a second of scrypt work and 128 MB, and Node runs
 * four at a time; beyond these, a burst is turned away rather than queued.
 */
export const MAX_SIGN_INS_AT_ONCE = 4;
export const MAX_SIGN_INS_WAITING = 16;

/** One count for every malformed user ID, which can never sign in. */
const MALFORMED = '';

/** 429, with how long to wait (also sent as Retry-After). */
export class TooManySignInsException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      'Too many sign-in attempts. Please try again later.',
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}

/**
 * Limits on signing in, against guessing passwords and against bursts that
 * would hold up everyone's sign-in. Kept in memory: the API runs as one
 * instance, and a restart starting the counts afresh is acceptable.
 */
@Injectable()
export class SignInLimits {
  /** When each user ID's recent sign-ins failed, oldest first. */
  private readonly failures = new Map<string, number[]>();
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  /**
   * Seconds until this user ID may try again, or 0 now. A user ID nobody
   * has is counted like any other, so a wait shows nothing about it.
   */
  secondsToWait(userId: string): number {
    const recent = this.recentFailures(keyOf(userId));
    if (recent.length < MAX_FAILED_SIGN_INS) {
      return 0;
    }
    const until = recent[recent.length - MAX_FAILED_SIGN_INS];
    return Math.ceil((until + FAILED_SIGN_IN_WINDOW_MS - Date.now()) / 1000);
  }

  failed(userId: string): void {
    const key = keyOf(userId);
    // Re-added, so the Map's order stays oldest change first.
    const recent = this.recentFailures(key);
    this.failures.delete(key);
    this.failures.set(key, [...recent, Date.now()]);
    this.forgetExpired();
  }

  succeeded(userId: string): void {
    this.failures.delete(keyOf(userId));
  }

  /**
   * Runs one sign-in's check when its turn comes: at once while fewer than
   * MAX_SIGN_INS_AT_ONCE run, after waiting while the queue has room, or
   * not at all (429).
   */
  async run<T>(check: () => Promise<T>): Promise<T> {
    if (this.running < MAX_SIGN_INS_AT_ONCE) {
      this.running++;
    } else if (this.waiting.length < MAX_SIGN_INS_WAITING) {
      // The one finishing hands its place straight over.
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      throw new TooManySignInsException(1);
    }
    try {
      return await check();
    } finally {
      const next = this.waiting.shift();
      if (next === undefined) {
        this.running--;
      } else {
        next();
      }
    }
  }

  private recentFailures(key: string): number[] {
    const since = Date.now() - FAILED_SIGN_IN_WINDOW_MS;
    return (this.failures.get(key) ?? []).filter((at) => at > since);
  }

  /** Drops user IDs whose last failure is out of the window. */
  private forgetExpired(): void {
    const since = Date.now() - FAILED_SIGN_IN_WINDOW_MS;
    for (const [key, times] of this.failures) {
      if (times[times.length - 1] > since) {
        // The rest changed later, so are recent too.
        return;
      }
      this.failures.delete(key);
    }
  }
}

function keyOf(userId: string): string {
  return isUserId(userId) ? userId : MALFORMED;
}
