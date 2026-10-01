import { EffectRef, Injector, Signal } from '@angular/core';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it, so a missing or mistyped
// public export fails here (#162). The store and its features have their own
// specs next to this one.
import {
  DeepSignal,
  EmptyFeatureResult,
  isWritableStateSource,
  Prettify,
  signalMethod,
  SignalMethod,
  signalStore,
  signalStoreFeature,
  StateSignals,
  StateSource,
  StateWatcher,
  watchState,
  withFeature,
  withMethods,
  withState,
  WritableStateSource,
} from '@ngrx/signals';

describe('@ngrx/signals public types', () => {
  it('EmptyFeatureResult has no state, props or methods', () => {
    // `{}` is how EmptyFeatureResult declares each of them.
    /* eslint-disable @typescript-eslint/no-empty-object-type */
    expectTypeOf<EmptyFeatureResult>().toEqualTypeOf<{
      state: {};
      props: {};
      methods: {};
    }>();
    /* eslint-enable @typescript-eslint/no-empty-object-type */
  });

  it('StateSignals has a signal per state key, deep for objects', () => {
    type Signals = StateSignals<{ count: number; user: { name: string } }>;
    expectTypeOf<Signals['count']>().toEqualTypeOf<Signal<number>>();
    expectTypeOf<Signals['user']>().toEqualTypeOf<
      DeepSignal<{ name: string }>
    >();
  });

  it('Prettify flattens an intersection', () => {
    expectTypeOf<Prettify<{ a: 1 } & { b: 2 }>>().toEqualTypeOf<{
      a: 1;
      b: 2;
    }>();
  });

  it('signalMethod takes a value or a signal, and is an EffectRef', () => {
    const log = signalMethod<number>(() => undefined);
    expectTypeOf(log).toEqualTypeOf<SignalMethod<number>>();
    expectTypeOf(log).toExtend<EffectRef>();
    expectTypeOf(log).parameter(0).toEqualTypeOf<number | (() => number)>();
    expectTypeOf(log)
      .parameter(1)
      .toEqualTypeOf<{ injector?: Injector } | undefined>();
    expectTypeOf(log).returns.toEqualTypeOf<EffectRef>();
  });

  it('watchState watches a state source and can be destroyed', () => {
    const Store = signalStore(withState({ count: 0 }));
    type Store = InstanceType<typeof Store>;
    expectTypeOf<StateWatcher<{ count: number }>>().toEqualTypeOf<
      (state: { count: number }) => void
    >();
    expectTypeOf(watchState<{ count: number }>).returns.toEqualTypeOf<{
      destroy(): void;
    }>();
    expectTypeOf<Store>().toExtend<StateSource<{ count: number }>>();
  });

  it('isWritableStateSource narrows a state source', () => {
    const source = {} as StateSource<{ count: number }>;
    if (isWritableStateSource(source)) {
      expectTypeOf(source).toEqualTypeOf<
        WritableStateSource<{ count: number }>
      >();
    }
  });

  it('withFeature passes the store to a feature factory', () => {
    const withDouble = (count: Signal<number>) =>
      signalStoreFeature(withMethods(() => ({ double: () => count() * 2 })));
    const Store = signalStore(
      withState({ count: 1 }),
      withFeature((store) => {
        expectTypeOf(store.count).toEqualTypeOf<Signal<number>>();
        return withDouble(store.count);
      })
    );
    expectTypeOf(Store)
      .instance.toHaveProperty('double')
      .toEqualTypeOf<() => number>();
  });
});
