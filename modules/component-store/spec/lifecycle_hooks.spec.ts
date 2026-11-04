import {
  isOnStateInitDefined,
  isOnStoreInitDefined,
} from '../src/lifecycle_hooks';

describe('lifecycle hook guards', () => {
  it('detects an OnStoreInit implementation', () => {
    const store = { ngrxOnStoreInit: () => undefined };
    const other = {};

    expect(isOnStoreInitDefined(store)).toBe(true);
    expect(isOnStoreInitDefined(other)).toBe(false);
  });

  it('detects an OnStateInit implementation', () => {
    const store = { ngrxOnStateInit: () => undefined };
    const other = {};

    expect(isOnStateInitDefined(store)).toBe(true);
    expect(isOnStateInitDefined(other)).toBe(false);
  });
});
