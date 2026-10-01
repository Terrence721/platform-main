import { InjectionToken, Provider, Signal, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it, so a missing or mistyped
// public export fails here (#162). effect and updater have their own spec.
import {
  ComponentStore,
  INITIAL_STATE_TOKEN,
  OnStateInit,
  OnStoreInit,
  Projector,
  provideComponentStore,
  SelectConfig,
  SelectorResults,
  SelectSignalOptions,
  SignalsProjector,
} from '@ngrx/component-store';

interface State {
  count: number;
  name: string;
}

class CounterStore extends ComponentStore<State> {
  // get() is protected: only a subclass can read the state synchronously.
  readCount() {
    return this.get((state) => state.count);
  }
  readState() {
    return this.get();
  }
}

const store = new CounterStore({ count: 0, name: '' });
const count$ = store.select((state) => state.count);
const name$ = store.select((state) => state.name);

describe('@ngrx/component-store public types', () => {
  describe('state', () => {
    it('exposes the state as an Observable, a signal and a destroy stream', () => {
      expectTypeOf(store.state$).toEqualTypeOf<Observable<State>>();
      expectTypeOf(store.state).toEqualTypeOf<Signal<State>>();
      expectTypeOf(store.destroy$).toEqualTypeOf<Observable<void>>();
    });

    it('setState takes a state or an updater of the whole state', () => {
      expectTypeOf(store.setState)
        .parameter(0)
        .toEqualTypeOf<State | ((state: State) => State)>();
      // @ts-expect-error a partial state is for patchState
      store.setState({ count: 1 });
    });

    it('patchState takes a partial state, an Observable of one or a function', () => {
      expectTypeOf(store.patchState)
        .parameter(0)
        .toEqualTypeOf<
          | Partial<State>
          | Observable<Partial<State>>
          | ((state: State) => Partial<State>)
        >();
      expectTypeOf(store.patchState).returns.toBeVoid();
    });

    it('get reads the state or a projection of it', () => {
      expectTypeOf(store.readState()).toEqualTypeOf<State>();
      expectTypeOf(store.readCount()).toEqualTypeOf<number>();
    });
  });

  describe('select', () => {
    it('projects the state', () => {
      expectTypeOf(count$).toEqualTypeOf<Observable<number>>();
      expectTypeOf(
        store.select((state) => state.name, { debounce: true })
      ).toEqualTypeOf<Observable<string>>();
    });

    it('combines selectors with a projector, with or without a config', () => {
      expectTypeOf(
        store.select(count$, name$, (count, name) => `${name}: ${count}`)
      ).toEqualTypeOf<Observable<string>>();
      expectTypeOf(
        store.select(count$, (count) => count > 0, { debounce: true })
      ).toEqualTypeOf<Observable<boolean>>();
      store.select(count$, name$, (count, name) => {
        expectTypeOf(count).toEqualTypeOf<number>();
        expectTypeOf(name).toEqualTypeOf<string>();
        return 0;
      });
    });

    it('combines a selectors object into an object of their values', () => {
      expectTypeOf(store.select({ count: count$, name: name$ })).toEqualTypeOf<
        Observable<{ count: number; name: string }>
      >();
    });

    it('SelectConfig takes debounce and an equality function', () => {
      expectTypeOf<SelectConfig<number>>().toEqualTypeOf<{
        debounce?: boolean;
        equal?: (a: number, b: number) => boolean;
      }>();
    });

    it('SelectorResults and Projector map Observables to their values', () => {
      type Selectors = [Observable<number>, Observable<string>];
      expectTypeOf<SelectorResults<Selectors>>().toEqualTypeOf<
        [number, string]
      >();
      expectTypeOf<Projector<Selectors, boolean>>().toEqualTypeOf<
        (...args: [number, string]) => boolean
      >();
    });
  });

  describe('selectSignal', () => {
    it('projects the state into a signal', () => {
      expectTypeOf(store.selectSignal((state) => state.count)).toEqualTypeOf<
        Signal<number>
      >();
    });

    it('combines signals with a projector, with or without options', () => {
      const count = store.selectSignal((state) => state.count);
      const label = signal('x');
      expectTypeOf(
        store.selectSignal(count, label, (c, l) => `${l}${c}`)
      ).toEqualTypeOf<Signal<string>>();
      // With signals, give `equal` typed parameters: two unannotated lambdas
      // leave TypeScript no source for the result type, which becomes unknown
      // (select with selectors and a config is the same).
      expectTypeOf(
        store.selectSignal(count, (c) => c > 0, {
          equal: (a: boolean, b: boolean) => a === b,
        })
      ).toEqualTypeOf<Signal<boolean>>();
    });

    it('SignalsProjector and SelectSignalOptions type the values', () => {
      expectTypeOf<
        SignalsProjector<[Signal<number>, Signal<string>], boolean>
      >().toEqualTypeOf<(...values: [number, string]) => boolean>();
      expectTypeOf<SelectSignalOptions<number>>().toEqualTypeOf<{
        equal?: (a: number, b: number) => boolean;
      }>();
    });
  });

  describe('providers and hooks', () => {
    it('provideComponentStore takes a ComponentStore class', () => {
      expectTypeOf(provideComponentStore(CounterStore)).toEqualTypeOf<
        Provider[]
      >();
      // @ts-expect-error not a ComponentStore
      provideComponentStore(class {});
    });

    it('the lifecycle hooks are read-only functions', () => {
      expectTypeOf<OnStoreInit>().toEqualTypeOf<{
        readonly ngrxOnStoreInit: () => void;
      }>();
      expectTypeOf<OnStateInit>().toEqualTypeOf<{
        readonly ngrxOnStateInit: () => void;
      }>();
    });

    it('the initial state token is untyped', () => {
      expectTypeOf(INITIAL_STATE_TOKEN).toEqualTypeOf<
        InjectionToken<unknown>
      >();
      void of;
    });
  });
});
