import type { CreateRequestRequest } from '@helpdesk/contract';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

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

export interface RequestLimiter {
  send(address: string): void | Promise<void>;
  sendBytes(address: string, bytes: number): void | Promise<void>;
  statusCheck(address: string): void | Promise<void>;
}

// ---------------- in-memory backend ----------------

class SlidingLimit {
  private readonly uses = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly message: string
  ) {}

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
    this.uses.delete(address);
    this.uses.set(address, [...recent, now]);
    for (const [other, times] of this.uses) {
      if (times[times.length - 1] > now - this.windowMs) {
        break;
      }
      this.uses.delete(other);
    }
  }
}

class SlidingTotal {
  private readonly sent = new Map<string, { at: number; amount: number }[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly message: string
  ) {}

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

@Injectable()
export class InMemoryRequestLimits implements RequestLimiter {
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

  send(address: string): void {
    this.sends.take(address);
  }
  sendBytes(address: string, bytes: number): void {
    this.fileBytes.take(address, bytes);
  }
  statusCheck(address: string): void {
    this.statusChecks.take(address);
  }
}

// ---------------- redis backend ----------------

function redisKey(prefix: string, address: string): string {
  return `helpdesk:rl:${prefix}:${encodeURIComponent(address || '')}`;
}

@Injectable()
export class RedisRequestLimits implements RequestLimiter {
  private readonly redis: Redis;
  private readonly sendMsg =
    'Too many requests from here. Please try again later.';
  private readonly statusMsg =
    'Too many checks from here. Please try again later.';
  private readonly fileMsg =
    'Too many files from here. Please try again later.';

  constructor(url: string) {
    this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    void this.redis.connect().catch(() => undefined);
  }

  async send(address: string): Promise<void> {
    const key = redisKey('sends', address);
    const now = Date.now();
    try {
      const values = await this.redis.lrange(key, 0, -1);
      const recent = values
        .map(Number)
        .filter((at) => at > now - SEND_WINDOW_MS);
      if (recent.length >= MAX_SENDS) {
        const until = recent[recent.length - MAX_SENDS] + SEND_WINDOW_MS;
        throw new TooManyRequestsException(
          Math.ceil((until - now) / 1000),
          this.sendMsg
        );
      }
      await this.redis.rpush(key, String(now));
      await this.redis.ltrim(key, -MAX_SENDS * 4, -1);
      await this.redis.pexpire(key, SEND_WINDOW_MS);
    } catch (error) {
      if (error instanceof TooManyRequestsException) throw error;
      // fail open on redis outage
    }
  }

  async sendBytes(address: string, bytes: number): Promise<void> {
    if (bytes <= 0) return;
    const key = redisKey('bytes', address);
    const now = Date.now();
    try {
      const values = await this.redis.lrange(key, 0, -1);
      const recent = values
        .map((v) => {
          const [amount, at] = v.split(':');
          return { amount: Number(amount), at: Number(at) };
        })
        .filter((e) => e.at > now - SEND_WINDOW_MS);
      const total = recent.reduce((s, e) => s + e.amount, 0);
      if (total + bytes > MAX_FILE_BYTES) {
        let until = now + SEND_WINDOW_MS;
        let running = total;
        for (const e of recent) {
          running -= e.amount;
          if (running + bytes <= MAX_FILE_BYTES) {
            until = e.at + SEND_WINDOW_MS;
            break;
          }
        }
        throw new TooManyRequestsException(
          Math.ceil((until - now) / 1000),
          this.fileMsg
        );
      }
      await this.redis.rpush(key, `${bytes}:${now}`);
      await this.redis.ltrim(key, -MAX_SENDS * 8, -1);
      await this.redis.pexpire(key, SEND_WINDOW_MS);
    } catch (error) {
      if (error instanceof TooManyRequestsException) throw error;
    }
  }

  async statusCheck(address: string): Promise<void> {
    const key = redisKey('status', address);
    const now = Date.now();
    try {
      const values = await this.redis.lrange(key, 0, -1);
      const recent = values
        .map(Number)
        .filter((at) => at > now - STATUS_CHECK_WINDOW_MS);
      if (recent.length >= MAX_STATUS_CHECKS) {
        const until =
          recent[recent.length - MAX_STATUS_CHECKS] + STATUS_CHECK_WINDOW_MS;
        throw new TooManyRequestsException(
          Math.ceil((until - now) / 1000),
          this.statusMsg
        );
      }
      await this.redis.rpush(key, String(now));
      await this.redis.ltrim(key, -MAX_STATUS_CHECKS * 4, -1);
      await this.redis.pexpire(key, STATUS_CHECK_WINDOW_MS);
    } catch (error) {
      if (error instanceof TooManyRequestsException) throw error;
    }
  }
}

@Injectable()
export class RequestLimits implements RequestLimiter {
  private readonly backend: RequestLimiter;

  constructor() {
    const url = process.env['REDIS_URL'];
    this.backend = url
      ? new RedisRequestLimits(url)
      : new InMemoryRequestLimits();
  }

  send(address: string): void | Promise<void> {
    return this.backend.send(address);
  }
  sendBytes(address: string, bytes: number): void | Promise<void> {
    return this.backend.sendBytes(address, bytes);
  }
  statusCheck(address: string): void | Promise<void> {
    return this.backend.statusCheck(address);
  }
}
