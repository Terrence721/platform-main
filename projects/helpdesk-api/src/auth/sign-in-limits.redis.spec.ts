import { HttpException } from '@nestjs/common';
import { MAX_FAILED_SIGN_INS, RedisSignInLimits } from './sign-in-limits';

const redisUrl = process.env['REDIS_URL'];

describe.skipIf(!redisUrl)('RedisSignInLimits', () => {
  it('locks out after the failed limit', async () => {
    const limits = new RedisSignInLimits(redisUrl as string);
    const userId = `test-${Math.random()}`;
    for (let i = 0; i < MAX_FAILED_SIGN_INS; i++) {
      limits.failed(userId);
    }
    // Allow microtasks to flush
    await new Promise((resolve) => setTimeout(resolve, 50));
    const wait = await limits.secondsToWait(userId);
    expect(wait).toBeGreaterThan(0);
  });

  it('clears failures after success', async () => {
    const limits = new RedisSignInLimits(redisUrl as string);
    const userId = `ok-${Math.random()}`;
    limits.failed(userId);
    limits.succeeded(userId);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await limits.secondsToWait(userId)).toBe(0);
  });
});
