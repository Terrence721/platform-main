import { Signal } from '@angular/core';
import { expectTypeOf } from 'vitest';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '../../src';

describe('withHooks types', () => {
  it('provides state signals, props, methods and the writable state source to a hook', () => {
    signalStore(
      withState({ count: 0 }),
      withProps(() => ({ label: 'counter' })),
      withMethods(() => ({ double: (): number => 2 })),
      withHooks({
        onInit(store) {
          expectTypeOf(store.count).toEqualTypeOf<Signal<number>>();
          expectTypeOf(store.label).toEqualTypeOf<string>();
          expectTypeOf(store.double).toEqualTypeOf<() => number>();
          patchState(store, { count: 1 });
        },
      })
    );
  });

  it('provides the same members to a hooks factory', () => {
    signalStore(
      withState({ count: 0 }),
      withHooks((store) => {
        expectTypeOf(store.count).toEqualTypeOf<Signal<number>>();
        patchState(store, { count: 1 });

        return { onInit: () => undefined };
      })
    );
  });

  it('rejects an unknown hook name', () => {
    // @ts-expect-error `onInt` is not a hook
    withHooks({ onInt: () => undefined });
  });

  it('rejects a hook that takes a parameter in the factory form', () => {
    // @ts-expect-error hooks returned by a factory receive no argument
    withHooks(() => ({ onInit: (count: number) => count }));
  });

  it('accepts a class instance with hook methods', () => {
    class LifecycleHooks {
      onInit(): void {
        return;
      }
    }

    signalStore(withState({ count: 0 }), withHooks(new LifecycleHooks()));
  });
});
