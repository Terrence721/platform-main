import { getGuid, getGuidComb, guidComparer } from '../..';

describe('guid-fns', () => {
  it('getGuid returns 28 hex characters, different each time', () => {
    const [a, b] = [getGuid(), getGuid()];
    expect(a).toMatch(/^[0-9a-f]{28}$/);
    expect(a).not.toBe(b);
  });

  it('getGuidComb returns 29 hex characters ending with the seed time', () => {
    expect(getGuidComb(0x123)).toMatch(/^[0-9a-f]{17}000000000123$/);
  });

  it('getGuidComb uses a seed of 0 instead of the current time', () => {
    expect(getGuidComb(0).slice(-12)).toBe('000000000000');
  });

  it('getGuidComb uses the current time without a seed', () => {
    const now = Date.now();
    const time = parseInt(getGuidComb().slice(-12), 16);
    expect(time).toBeGreaterThanOrEqual(now);
    expect(time - now).toBeLessThan(1000);
  });

  it('guidComparer orders getGuidComb values by their time part', () => {
    const early = getGuidComb(1);
    const late = getGuidComb(2);
    expect(guidComparer(early, late)).toBe(-1);
    expect(guidComparer(late, early)).toBe(1);
    expect(guidComparer(early, early)).toBe(0);
    expect([late, early].sort(guidComparer)).toEqual([early, late]);
  });
});
