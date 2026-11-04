import { _concatMetaReducers, _initialStateFactory } from '../src/store_config';

describe('_initialStateFactory', () => {
  it('returns a non-function value unchanged', () => {
    expect(_initialStateFactory({ count: 1 })).toEqual({ count: 1 });
    expect(_initialStateFactory(42)).toBe(42);
    expect(_initialStateFactory(null)).toBeNull();
  });

  it('invokes a function and returns its result', () => {
    const factory = vi.fn(() => ({ count: 2 }));

    expect(_initialStateFactory(factory)).toEqual({ count: 2 });
    expect(factory).toHaveBeenCalledOnce();
  });
});

describe('_concatMetaReducers', () => {
  it('concatenates the user-provided reducers after the defaults', () => {
    const first = vi.fn();
    const second = vi.fn();
    const user = vi.fn();

    expect(_concatMetaReducers([first, second], [user])).toEqual([
      first,
      second,
      user,
    ]);
  });

  it('returns the defaults when there are no user reducers', () => {
    const first = vi.fn();

    expect(_concatMetaReducers([first], [])).toEqual([first]);
  });
});
