import { signal } from '@angular/core';
import { of } from 'rxjs';
import { withMethods, withProps, withState } from '../src';
import { getInitialInnerStore } from '../src/signal-store';

describe('withProps', () => {
  it('adds properties to the store immutably', () => {
    const initialStore = getInitialInnerStore();

    const store = withProps(() => ({ p1: 1, p2: 2 }))(initialStore);

    expect(Object.keys(store.props)).toEqual(['p1', 'p2']);
    expect(Object.keys(initialStore.props)).toEqual([]);

    expect(store.props.p1).toBe(1);
    expect(store.props.p2).toBe(2);
  });

  it('logs warning if previously defined signal store members have the same name', () => {
    const STATE_SECRET = Symbol('state_secret');
    const METHOD_SECRET = Symbol('method_secret');
    const initialStore = [
      withState({
        s1: 10,
        s2: 's2',
        [STATE_SECRET]: 1,
      }),
      withProps(() => ({
        p1: of(100),
        p2: 10,
      })),
      withMethods(() => ({
        m1: () => undefined,
        m2: () => undefined,
        [METHOD_SECRET]: () => undefined,
      })),
    ].reduce((acc, feature) => feature(acc), getInitialInnerStore());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    withProps(() => ({
      s1: { foo: 'bar' },
      p: 10,
      p2: signal(100),
      m1: { ngrx: 'rocks' },
      m3: of('m3'),
      [STATE_SECRET]: 10,
      [METHOD_SECRET]: { x: 'y' },
    }))(initialStore);

    expect(console.warn).toHaveBeenCalledWith(
      '@ngrx/signals: SignalStore members cannot be overridden.',
      'Trying to override:',
      's1, p2, m1, Symbol(state_secret), Symbol(method_secret)'
    );
  });

  it('does not log a warning for a non-enumerable property, since it is never added to the store', () => {
    const initialStore = [
      withState({ s1: 10 }),
      withMethods(() => ({ m1: () => 'm1', m2: () => 'm2' })),
    ].reduce((acc, feature) => feature(acc), getInitialInnerStore());
    vi.spyOn(console, 'warn')
      .mockImplementation(() => undefined)
      .mockClear();

    const props = { p1: 1, m1: 'enumerable' };
    Object.defineProperty(props, 's1', { value: 'hidden', enumerable: false });
    Object.defineProperty(props, 'm2', { value: 'hidden', enumerable: false });
    const store = withProps(() => props)(initialStore);

    expect(Object.keys(store.props)).toEqual(['p1', 'm1']);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      '@ngrx/signals: SignalStore members cannot be overridden.',
      'Trying to override:',
      'm1'
    );
  });

  describe('plain object check', () => {
    it('logs a warning if the factory returns an instance of a class', () => {
      class Api {
        baseUrl = 'https://www.ngrx.io';

        createUrl(path: string): string {
          return this.baseUrl + path;
        }
      }
      vi.spyOn(console, 'warn')
        .mockImplementation(() => undefined)
        .mockClear();

      const store = withProps(() => new Api())(getInitialInnerStore());

      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
        '@ngrx/signals: withProps expects a plain object, but received an instance of Api.',
        'Members that it inherits from its prototype are ignored.',
        'Return an object literal instead, e.g. { service: inject(Service) }.'
      );
      // The props themselves are unchanged: only the own field is added.
      expect(Object.keys(store.props)).toEqual(['baseUrl']);
    });

    it('does not log a warning for an object literal or an object without a prototype', () => {
      vi.spyOn(console, 'warn')
        .mockImplementation(() => undefined)
        .mockClear();

      withProps(() => ({ p1: 1 }))(getInitialInnerStore());
      withProps(() => Object.assign(Object.create(null), { p2: 2 }))(
        getInitialInnerStore()
      );

      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
