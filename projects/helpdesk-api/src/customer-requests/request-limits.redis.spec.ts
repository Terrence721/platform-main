import { HttpException } from '@nestjs/common';
import {
  MAX_SENDS,
  MAX_STATUS_CHECKS,
  RedisRequestLimits,
} from './request-limits';

const redisUrl = process.env['REDIS_URL'];

describe.skipIf(!redisUrl)('RedisRequestLimits', () => {
  let limits: RedisRequestLimits;

  beforeEach(() => {
    limits = new RedisRequestLimits(redisUrl as string);
  });

  afterAll(async () => {
    // no-op: let process exit
  });

  it('allows sends up to the limit, then 429s', async () => {
    const address = `test-${Math.random()}@example.com`;
    for (let i = 0; i < MAX_SENDS; i++) {
      await limits.send(address);
    }
    await expect(limits.send(address)).rejects.toBeInstanceOf(HttpException);
  });

  it('tracks status checks per address', async () => {
    const address = `status-${Math.random()}@example.com`;
    for (let i = 0; i < MAX_STATUS_CHECKS; i++) {
      await limits.statusCheck(address);
    }
    await expect(limits.statusCheck(address)).rejects.toBeInstanceOf(
      HttpException
    );
  });

  it('rejects byte totals over the cap', async () => {
    const address = `bytes-${Math.random()}@example.com`;
    await limits.sendBytes(address, 20 * 1024 * 1024);
    await expect(
      limits.sendBytes(address, 10 * 1024 * 1024)
    ).rejects.toBeInstanceOf(HttpException);
  });
});
