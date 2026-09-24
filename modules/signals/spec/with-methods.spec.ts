import { signal } from '@angular/core';
import { withComputed, withMethods, withState } from '../src';
import { getInitialInnerStore } from '../src/signal-store';

describe('withMethods', () => {
  it('adds methods to the store immutably', () => {
    const initialStore = getInitialInnerStore();

    const m1 = () => 100;
    const m2 = () => 'm2';

    const store = withMethods(() => ({ m1, m2 }))(initialStore);

    expect(Object.keys(store.methods)).toEqual(['m1', 'm2']);
    expect(Object.keys(initialStore.methods)).toEqual([]);

    expect(store.methods.m1).toBe(m1);
    expect(store.methods.m2).toBe(m2);
  });

  it('logs warning if previously defined signal store members have the same name', () => {
    const STATE_SECRET = Symbol('state_secret');
    const COMPUTED_SECRET = Symbol('computed_secret');
    const initialStore = [
      withState({
        p1: 'p1',
        p2: false,
        [STATE_SECRET]: 1,
      }),
      withComputed(() => ({
        s1: signal(true).asReadonly(),
        s2: signal({ s: 2 }).asReadonly(),
        [COMPUTED_SECRET]: signal(1).asReadonly(),
      })),
      withMethods(() => ({
        m1() {},
        m2() {},
      })),
    ].reduce((acc, feature) => feature(acc), getInitialInnerStore());
    const m2 = () => 10;
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    withMethods(() => ({
      p() {},
      p2() {},
      s: () => {},
      s1: () => 100,
      m2,
      m3: () => 'm3',
      [STATE_SECRET]() {},
      [COMPUTED_SECRET]() {},
    }))(initialStore);

    expect(console.warn).toHaveBeenCalledWith(
      '@ngrx/signals: SignalStore members cannot be overridden.',
      'Trying to override:',
      'p2, s1, m2, Symbol(state_secret), Symbol(computed_secret)'
    );
  });

  it('does not log a warning for a non-enumerable method, since it is never added to the store', () => {
    const initialStore = [
      withState({ p1: 10 }),
      withComputed(() => ({ s1: signal(true).asReadonly() })),
      withMethods(() => ({ m1: () => 'm1', m2: () => 'm2' })),
    ].reduce((acc, feature) => feature(acc), getInitialInnerStore());
    vi.spyOn(console, 'warn')
      .mockImplementation(() => undefined)
      .mockClear();

    const methods = { m3: () => 'm3', m1: () => 'enumerable' };
    Object.defineProperty(methods, 'p1', {
      value: () => 'hidden',
      enumerable: false,
    });
    Object.defineProperty(methods, 's1', {
      value: () => 'hidden',
      enumerable: false,
    });
    const store = withMethods(() => methods)(initialStore);

    expect(Object.keys(store.methods)).toEqual(['m1', 'm2', 'm3']);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      '@ngrx/signals: SignalStore members cannot be overridden.',
      'Trying to override:',
      'm1'
    );
  });
});
