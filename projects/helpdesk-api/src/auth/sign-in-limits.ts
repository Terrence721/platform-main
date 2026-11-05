import { isUserId } from '@helpdesk/contract';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

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

/** The contract every sign-in limiter must satisfy. */
export interface SignInLimiter {
  secondsToWait(userId: string): number | Promise<number>;
  failed(userId: string): void | Promise<void>;
  succeeded(userId: string): void | Promise<void>;
  run<T>(check: () => Promise<T>): Promise<T>;
}

/** In-memory backend, suitable for one instance or tests. */
@Injectable()
export class InMemorySignInLimits implements SignInLimiter {
  /** When each user ID's recent sign-ins failed, oldest first. */
  private readonly failures = new Map<string, number[]>();
  private running = 0;
  private readonly waiting: (() => void)[] = [];

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
    const recent = this.recentFailures(key);
    this.failures.delete(key);
    this.failures.set(key, [...recent, Date.now()]);
    this.forgetExpired();
  }

  succeeded(userId: string): void {
    this.failures.delete(keyOf(userId));
  }

  async run<T>(check: () => Promise<T>): Promise<T> {
    if (this.running < MAX_SIGN_INS_AT_ONCE) {
      this.running++;
    } else if (this.waiting.length < MAX_SIGN_INS_WAITING) {
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

  private forgetExpired(): void {
    const since = Date.now() - FAILED_SIGN_IN_WINDOW_MS;
    for (const [key, times] of this.failures) {
      if (times[times.length - 1] > since) {
        return;
      }
      this.failures.delete(key);
    }
  }
}

/** Redis/Valkey backend: shared failure buckets across instances. */
@Injectable()
export class RedisSignInLimits implements SignInLimiter {
  private readonly redis: Redis;
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(url: string) {
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    void this.redis.connect().catch(() => undefined);
  }

  async secondsToWait(userId: string): Promise<number> {
    return this.secondsToWaitAsync(userId);
  }

  failed(_userId: string): void {
    // Fire and forget is unsafe; instead, record synchronously is impossible.
    // Store in a detached promise.
    void this.recordFailed(_userId);
  }

  private async recordFailed(userId: string): Promise<void> {
    try {
      const key = redisKey(keyOf(userId));
      const now = Date.now();
      await this.redis.rpush(key, String(now));
      await this.redis.ltrim(key, -MAX_FAILED_SIGN_INS * 4, -1);
      await this.redis.pexpire(key, FAILED_SIGN_IN_WINDOW_MS);
    } catch {
      // Fail open for availability on Redis outage.
    }
  }

  succeeded(userId: string): void {
    void this.redis.del(redisKey(keyOf(userId))).catch(() => undefined);
  }

  async recentCount(_userId: string): Promise<number> {
    try {
      const values = await this.redis.lrange(redisKey(keyOf(_userId)), 0, -1);
      const since = Date.now() - FAILED_SIGN_IN_WINDOW_MS;
      const recent = values.map(Number).filter((at) => at > since);
      return recent.length;
    } catch {
      return 0;
    }
  }

  async secondsToWaitAsync(userId: string): Promise<number> {
    try {
      const values = await this.redis.lrange(redisKey(keyOf(userId)), 0, -1);
      const since = Date.now() - FAILED_SIGN_IN_WINDOW_MS;
      const recent = values.map(Number).filter((at) => at > since);
      if (recent.length < MAX_FAILED_SIGN_INS) {
        return 0;
      }
      const until = recent[recent.length - MAX_FAILED_SIGN_INS];
      return Math.ceil((until + FAILED_SIGN_IN_WINDOW_MS - Date.now()) / 1000);
    } catch {
      return 0;
    }
  }

  async run<T>(check: () => Promise<T>): Promise<T> {
    if (this.running < MAX_SIGN_INS_AT_ONCE) {
      this.running++;
    } else if (this.waiting.length < MAX_SIGN_INS_WAITING) {
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
}

/**
 * Backend selector. If REDIS_URL is set, Redis holds shared failure buckets;
 * otherwise use the in-memory backend. The constructor runs once per instance.
 */
@Injectable()
export class SignInLimits implements SignInLimiter {
  private readonly backend: SignInLimiter;

  constructor() {
    const url = process.env['REDIS_URL'];
    this.backend = url
      ? new RedisSignInLimits(url)
      : new InMemorySignInLimits();
  }

  secondsToWait(userId: string): number | Promise<number> {
    return this.backend.secondsToWait(userId);
  }

  failed(userId: string): void {
    this.backend.failed(userId);
  }

  succeeded(userId: string): void {
    this.backend.succeeded(userId);
  }

  run<T>(check: () => Promise<T>): Promise<T> {
    return this.backend.run(check);
  }
}

function keyOf(userId: string): string {
  return isUserId(userId) ? userId : MALFORMED;
}

function redisKey(key: string): string {
  return `helpdesk:signin:failures:${key}`;
}
