import { event } from '../src';
import { on } from '../src';

describe('on', () => {
  it('returns the passed events and the final reducer', () => {
    const incremented = event('incremented', (payload: number) => ({
      payload,
    }));
    const reducer = () => ({ count: 1 });

    const result = on(incremented, reducer);

    expect(result.events).toEqual([incremented]);
    expect(result.reducer).toBe(reducer);
  });

  it('supports multiple event creators before the reducer', () => {
    const first = event('first');
    const second = event('second');
    const reducer = () => ({ count: 2 });

    const result = on(first, second, reducer);

    expect(result.events).toEqual([first, second]);
    expect(result.reducer).toBe(reducer);
  });
});
