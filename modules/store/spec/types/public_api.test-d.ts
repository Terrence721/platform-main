import {
  EnvironmentProviders,
  inject,
  InjectionToken,
  ModuleWithProviders,
} from '@angular/core';
import { Observable } from 'rxjs';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package names, as an app imports them, so a missing or mistyped
// public export fails here (#162). The exports the other type specs cover
// (createAction, createSelector, Store, createFeature, ...) are not repeated.
import {
  Action,
  ACTIVE_RUNTIME_CHECKS,
  ActionCreator,
  ActionReducer,
  ActionReducerFactory,
  ActionReducerMap,
  ActionsSubject,
  ActionType,
  combineReducers,
  compose,
  createAction,
  createReducerFactory,
  createSelector,
  createSelectorFactory,
  Creator,
  defaultMemoize,
  defaultStateFn,
  FEATURE_REDUCERS,
  FEATURE_STATE_PROVIDER,
  FeatureSlice,
  INIT,
  INITIAL_REDUCERS,
  INITIAL_STATE,
  isNgrxMockEnvironment,
  META_REDUCERS,
  MemoizedProjection,
  MemoizedSelector,
  MemoizeFn,
  MetaReducer,
  NotAllowedCheck,
  props,
  provideState,
  provideStore,
  REDUCER_FACTORY,
  reduceState,
  ReducerManager,
  ReducerManagerDispatcher,
  ReducerObservable,
  resultMemoize,
  ROOT_STORE_PROVIDER,
  RootStoreConfig,
  RuntimeChecks,
  ScannedActionsSubject,
  SelectSignalOptions,
  SelectorWithProps,
  setNgrxMockEnvironment,
  StateObservable,
  Store,
  STORE_FEATURES,
  StoreConfig,
  StoreFeatureModule,
  StoreModule,
  StoreRootModule,
  UPDATE,
  USER_PROVIDED_META_REDUCERS,
  USER_RUNTIME_CHECKS,
} from '@ngrx/store';
import {
  createMockStore,
  MockReducerManager,
  MockSelector,
  MockState,
  MockStore,
  MockStoreConfig,
  provideMockStore,
} from '@ngrx/store/testing';

interface State {
  count: number;
  user: { name: string; address: { city: string } };
}
const countReducer: ActionReducer<number> = (state = 0) => state;
const userReducer: ActionReducer<State['user']> = (
  state = { name: '', address: { city: '' } }
) => state;
const reducers: ActionReducerMap<State> = {
  count: countReducer,
  user: userReducer,
};
const selectCount = createSelector(
  (state: State) => state,
  (state) => state.count
);

describe('@ngrx/store public types', () => {
  describe('action types', () => {
    it('INIT and UPDATE are their literal action types', () => {
      expectTypeOf(INIT).toEqualTypeOf<'@ngrx/store/init'>();
      expectTypeOf(UPDATE).toEqualTypeOf<'@ngrx/store/update-reducers'>();
    });

    it('ActionType is the action an action creator creates', () => {
      const loaded = createAction('[Books] Loaded', props<{ ids: number[] }>());
      expectTypeOf(loaded({ ids: [1] })).toEqualTypeOf<
        ActionType<typeof loaded>
      >();
      expectTypeOf<ActionType<typeof loaded>>().toEqualTypeOf<
        { ids: number[] } & Action<'[Books] Loaded'>
      >();
      expectTypeOf<ActionType<string>>().toBeNever();
    });

    it('Creator is a function from its parameters to an object', () => {
      expectTypeOf<Creator<[number], { n: number }>>().toEqualTypeOf<
        (...args: [number]) => { n: number }
      >();
      expectTypeOf<ActionCreator<'x', Creator>>().toExtend<
        Creator & { type: 'x' }
      >();
    });

    it('NotAllowedCheck rejects arrays, a type property and empty objects', () => {
      expectTypeOf<NotAllowedCheck<{ id: number }>>().toBeUnknown();
      expectTypeOf<
        NotAllowedCheck<number[]>
      >().toEqualTypeOf<'action creator cannot return an array'>();
      expectTypeOf<
        NotAllowedCheck<{ type: string }>
      >().toEqualTypeOf<'action creator cannot return an object with a property named `type`'>();
      expectTypeOf<
        // The empty object type is the case under test.
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        NotAllowedCheck<{}>
      >().toEqualTypeOf<'action creator cannot return an empty object'>();
    });
  });

  describe('reducers', () => {
    it('combineReducers builds a reducer for the whole state', () => {
      expectTypeOf(combineReducers(reducers)).toEqualTypeOf<
        ActionReducer<State, Action>
      >();
      expectTypeOf(combineReducers<State>)
        .parameter(1)
        .toEqualTypeOf<Partial<State> | undefined>();
    });

    it('combineReducers is a reducer factory, the default one', () => {
      expectTypeOf(combineReducers<State>).toExtend<
        ActionReducerFactory<State>
      >();
      expectTypeOf<ActionReducerFactory<State>>()
        .parameter(1)
        .toEqualTypeOf<Partial<State> | undefined>();
    });

    it('createReducerFactory wraps a factory with meta-reducers', () => {
      const logger: MetaReducer<State> = (reducer) => reducer;
      const factory = createReducerFactory<State>(combineReducers, [logger]);
      expectTypeOf(factory).toEqualTypeOf<ActionReducerFactory<State>>();
      expectTypeOf(factory(reducers)).toEqualTypeOf<ActionReducer<State>>();
    });

    it('MetaReducer maps a reducer to a reducer, any state by default', () => {
      expectTypeOf<MetaReducer<State>>().toEqualTypeOf<
        (reducer: ActionReducer<State>) => ActionReducer<State>
      >();
      expectTypeOf<MetaReducer>().toEqualTypeOf<
        (reducer: ActionReducer<any>) => ActionReducer<any>
      >();
    });

    it('reduceState returns the next state and the action', () => {
      expectTypeOf(
        reduceState<number>(undefined, [{ type: 'x' }, countReducer])
      ).toEqualTypeOf<{ state: number | undefined; action?: Action }>();
    });

    it('compose chains functions right to left', () => {
      const toLength = (s: string) => s.length;
      const toText = (n: number) => `${n}`;
      expectTypeOf(compose(toText, toLength)).toEqualTypeOf<
        (i: string) => string
      >();
      expectTypeOf(compose<number>()).toEqualTypeOf<(i: number) => number>();
    });
  });

  describe('selectors', () => {
    it('SelectorWithProps takes the state and the props', () => {
      expectTypeOf<
        SelectorWithProps<State, { id: number }, string>
      >().toEqualTypeOf<(state: State, props: { id: number }) => string>();
    });

    it('the memoize functions return a MemoizedProjection', () => {
      expectTypeOf<MemoizedProjection>().toEqualTypeOf<{
        memoized: (...args: any[]) => any;
        reset: () => void;
        setResult: (result?: any) => void;
        clearResult: () => void;
      }>();
      expectTypeOf(defaultMemoize).returns.toEqualTypeOf<MemoizedProjection>();
      expectTypeOf(resultMemoize).returns.toEqualTypeOf<MemoizedProjection>();
      expectTypeOf(defaultMemoize).toExtend<MemoizeFn>();
      expectTypeOf(defaultStateFn)
        .parameter(3)
        .toEqualTypeOf<MemoizedProjection>();
    });

    it('createSelectorFactory returns a selector creator', () => {
      const create = createSelectorFactory<State, number>(defaultMemoize);
      expectTypeOf(create).returns.toEqualTypeOf<
        MemoizedSelector<State, number>
      >();
    });

    it('SelectSignalOptions takes an equality function for the result', () => {
      expectTypeOf<SelectSignalOptions<number>>().toEqualTypeOf<{
        equal?: (a: number, b: number) => boolean;
      }>();
    });
  });

  describe('providers and configuration', () => {
    it('provideStore and provideState return environment providers', () => {
      expectTypeOf(
        provideStore(reducers)
      ).toEqualTypeOf<EnvironmentProviders>();
      expectTypeOf(provideStore()).toEqualTypeOf<EnvironmentProviders>();
      expectTypeOf(
        provideState('count', countReducer)
      ).toEqualTypeOf<EnvironmentProviders>();
      expectTypeOf(
        provideState({ name: 'count', reducer: countReducer })
      ).toEqualTypeOf<EnvironmentProviders>();
      expectTypeOf(
        provideState('user', { name: userReducer })
      ).toEqualTypeOf<EnvironmentProviders>();
    });

    it('StoreModule returns typed module providers', () => {
      expectTypeOf(StoreModule.forRoot(reducers)).toEqualTypeOf<
        ModuleWithProviders<StoreRootModule>
      >();
      expectTypeOf(StoreModule.forFeature('count', countReducer)).toEqualTypeOf<
        ModuleWithProviders<StoreFeatureModule>
      >();
    });

    it('FeatureSlice names a feature reducer', () => {
      expectTypeOf<FeatureSlice<number>>().toEqualTypeOf<{
        name: string;
        reducer: ActionReducer<number, Action>;
      }>();
    });

    it('the configs take initial state, a reducer factory and meta-reducers', () => {
      expectTypeOf<StoreConfig<State>>()
        .toHaveProperty('metaReducers')
        .toEqualTypeOf<MetaReducer<State>[] | undefined>();
      expectTypeOf<StoreConfig<State>>()
        .toHaveProperty('reducerFactory')
        .toEqualTypeOf<ActionReducerFactory<State> | undefined>();
      expectTypeOf<RootStoreConfig<State>>().toExtend<StoreConfig<State>>();
      expectTypeOf<RootStoreConfig<State>>()
        .toHaveProperty('runtimeChecks')
        .toEqualTypeOf<Partial<RuntimeChecks> | undefined>();
    });

    it('RuntimeChecks has every check, each a boolean', () => {
      expectTypeOf<RuntimeChecks>().toEqualTypeOf<{
        strictStateSerializability: boolean;
        strictActionSerializability: boolean;
        strictStateImmutability: boolean;
        strictActionImmutability: boolean;
        strictActionWithinNgZone: boolean;
        strictActionTypeUniqueness?: boolean;
      }>();
    });
  });

  describe('injection tokens', () => {
    it('the user runtime checks are only those passed, maybe none', () => {
      expectTypeOf(USER_RUNTIME_CHECKS).toEqualTypeOf<
        InjectionToken<Partial<RuntimeChecks> | undefined>
      >();
      expectTypeOf(inject(USER_RUNTIME_CHECKS)).toEqualTypeOf<
        Partial<RuntimeChecks> | undefined
      >();
    });

    it('the active runtime checks are complete', () => {
      expectTypeOf(ACTIVE_RUNTIME_CHECKS).toEqualTypeOf<
        InjectionToken<RuntimeChecks>
      >();
    });

    it('the meta-reducer tokens hold arrays', () => {
      expectTypeOf(META_REDUCERS).toEqualTypeOf<
        InjectionToken<MetaReducer[]>
      >();
      expectTypeOf(USER_PROVIDED_META_REDUCERS).toEqualTypeOf<
        InjectionToken<MetaReducer[]>
      >();
    });

    it('the internal state tokens are untyped', () => {
      expectTypeOf(INITIAL_STATE).toEqualTypeOf<InjectionToken<unknown>>();
      expectTypeOf(INITIAL_REDUCERS).toEqualTypeOf<InjectionToken<unknown>>();
      expectTypeOf(REDUCER_FACTORY).toEqualTypeOf<InjectionToken<unknown>>();
      expectTypeOf(STORE_FEATURES).toEqualTypeOf<InjectionToken<unknown>>();
      expectTypeOf(FEATURE_REDUCERS).toEqualTypeOf<InjectionToken<unknown>>();
    });

    it('the initializer tokens provide nothing', () => {
      expectTypeOf(ROOT_STORE_PROVIDER).toEqualTypeOf<InjectionToken<void>>();
      expectTypeOf(FEATURE_STATE_PROVIDER).toEqualTypeOf<
        InjectionToken<void>
      >();
    });
  });

  // The services wrap a Subject instead of extending one (see their classes):
  // actions go in through next() and are observed through asObservable().
  describe('services', () => {
    it('the action streams take and expose actions', () => {
      expectTypeOf<ActionsSubject['next']>().toEqualTypeOf<
        (action: Action) => void
      >();
      expectTypeOf<ActionsSubject['asObservable']>().toEqualTypeOf<
        () => Observable<Action>
      >();
      expectTypeOf<ScannedActionsSubject['next']>().toEqualTypeOf<
        (action: Action) => void
      >();
      expectTypeOf<ScannedActionsSubject['asObservable']>().toEqualTypeOf<
        () => Observable<Action>
      >();
      expectTypeOf<ReducerManagerDispatcher>().toExtend<ActionsSubject>();
    });

    it('the reducer services expose the root reducer', () => {
      expectTypeOf<ReducerObservable>().toExtend<
        Observable<ActionReducer<any, any>>
      >();
      expectTypeOf<ReducerManager['asObservable']>().toEqualTypeOf<
        () => Observable<ActionReducer<any, any>>
      >();
      expectTypeOf<ReducerManager['currentReducers']>().toEqualTypeOf<
        ActionReducerMap<any, any>
      >();
    });

    it('StateObservable exposes the state as a stream', () => {
      expectTypeOf<StateObservable['state$']>().toEqualTypeOf<
        Observable<any>
      >();
    });

    it('the mock environment flag is a boolean', () => {
      expectTypeOf(setNgrxMockEnvironment).toEqualTypeOf<
        (value: boolean) => void
      >();
      expectTypeOf(isNgrxMockEnvironment).toEqualTypeOf<() => boolean>();
    });
  });
});

describe('@ngrx/store/testing public types', () => {
  it('createMockStore returns a MockStore of the state', () => {
    const store = createMockStore<State>({ initialState: undefined });
    expectTypeOf(store).toEqualTypeOf<MockStore<State>>();
    expectTypeOf(store).toExtend<Store<State>>();
    expectTypeOf(createMockStore()).toEqualTypeOf<MockStore<unknown>>();
  });

  it('provideMockStore returns plain providers for TestBed and Injector', () => {
    expectTypeOf(provideMockStore<State>()).toExtend<{ provide: unknown }[]>();
  });

  it('MockStoreConfig takes the initial state and the mocked selectors', () => {
    expectTypeOf<MockStoreConfig<State>>().toEqualTypeOf<{
      initialState?: State;
      selectors?: MockSelector[];
    }>();
    expectTypeOf<MockSelector['value']>().toBeAny();
  });

  it('MockStore.select keeps the result type of Store.select', () => {
    const store = createMockStore<State>();
    expectTypeOf(store.select(selectCount)).toEqualTypeOf<Observable<number>>();
    expectTypeOf(store.select((state) => state.user.name)).toEqualTypeOf<
      Observable<string>
    >();
    expectTypeOf(store.select('user', 'address', 'city')).toEqualTypeOf<
      Observable<string>
    >();
  });

  it('overrideSelector returns the selector, typed by its result', () => {
    const store = createMockStore<State>();
    expectTypeOf(store.overrideSelector(selectCount, 1)).toEqualTypeOf<
      MemoizedSelector<any, number>
    >();
    expectTypeOf(store.overrideSelector('count', 1)).toEqualTypeOf<
      MemoizedSelector<any, number>
    >();
    // @ts-expect-error the value must match the selector's result
    store.overrideSelector(selectCount, 'one');
  });

  it('MockState and MockReducerManager stand in for the real services', () => {
    expectTypeOf<MockState<State>['state$']>().toEqualTypeOf<
      Observable<State>
    >();
    expectTypeOf<MockState<State>['value']>().toEqualTypeOf<State>();
    expectTypeOf<MockState<State>['next']>().toEqualTypeOf<
      (state: State) => void
    >();
    expectTypeOf<MockReducerManager['asObservable']>().toEqualTypeOf<
      () => Observable<ActionReducer<any, any>>
    >();
  });
});
