import {
  EnvironmentProviders,
  inject,
  InjectionToken,
  ModuleWithProviders,
} from '@angular/core';
import { Action, ActionsSubject, StateObservable } from '@ngrx/store';
import { Observable } from 'rxjs';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it, so a missing or mistyped
// public export fails here (#162).
import {
  ComputedState,
  DevToolsFeatureOptions,
  INITIAL_OPTIONS,
  LiftedAction,
  LiftedActions,
  LiftedState,
  provideStoreDevtools,
  RECOMPUTE,
  REDUX_DEVTOOLS_EXTENSION,
  ReduxDevtoolsExtension,
  StoreDevtools,
  StoreDevtoolsConfig,
  StoreDevtoolsModule,
  StoreDevtoolsOptions,
} from '@ngrx/store-devtools';

describe('@ngrx/store-devtools public types', () => {
  it('the options are a partial config or a function returning one', () => {
    expectTypeOf<StoreDevtoolsOptions>().toEqualTypeOf<
      Partial<StoreDevtoolsConfig> | (() => Partial<StoreDevtoolsConfig>)
    >();
    expectTypeOf<StoreDevtoolsConfig['maxAge']>().toEqualTypeOf<
      number | false
    >();
    expectTypeOf<DevToolsFeatureOptions['import']>().toEqualTypeOf<
      'custom' | boolean | undefined
    >();
  });

  it('INITIAL_OPTIONS holds the options as given, not the full config', () => {
    expectTypeOf(INITIAL_OPTIONS).toEqualTypeOf<
      InjectionToken<StoreDevtoolsOptions>
    >();
    expectTypeOf(inject(INITIAL_OPTIONS)).toEqualTypeOf<StoreDevtoolsOptions>();
  });

  it('the devtools are provided standalone or as a module', () => {
    expectTypeOf(provideStoreDevtools()).toEqualTypeOf<EnvironmentProviders>();
    expectTypeOf(
      provideStoreDevtools(() => ({ maxAge: 25, logOnly: true }))
    ).toEqualTypeOf<EnvironmentProviders>();
    expectTypeOf(StoreDevtoolsModule.instrument({ maxAge: 25 })).toEqualTypeOf<
      ModuleWithProviders<StoreDevtoolsModule>
    >();
    // @ts-expect-error maxAge is a number or false
    provideStoreDevtools({ maxAge: true });
  });

  it('a serialize replacer may leave a key out, as JSON’s does', () => {
    expectTypeOf(provideStoreDevtools).toBeCallableWith({
      serialize: {
        replacer: (key, value) => (key === 'token' ? undefined : value),
      },
    });
  });

  it('the lifted state records every action and computed state', () => {
    expectTypeOf<LiftedAction>().toEqualTypeOf<{
      type: string;
      action: Action;
    }>();
    expectTypeOf<LiftedActions[number]>().toEqualTypeOf<LiftedAction>();
    expectTypeOf<ComputedState>().toEqualTypeOf<{ state: any; error: any }>();
    expectTypeOf<LiftedState['actionsById']>().toEqualTypeOf<LiftedActions>();
    expectTypeOf<LiftedState['computedStates']>().toEqualTypeOf<
      ComputedState[]
    >();
    expectTypeOf<
      typeof RECOMPUTE
    >().toEqualTypeOf<'@ngrx/store-devtools/recompute'>();
  });

  it('StoreDevtools exposes the lifted and current state and the commands', () => {
    expectTypeOf<StoreDevtools['liftedState']>().toEqualTypeOf<
      Observable<LiftedState>
    >();
    expectTypeOf<StoreDevtools['state']>().toEqualTypeOf<StateObservable>();
    expectTypeOf<StoreDevtools['dispatcher']>().toEqualTypeOf<ActionsSubject>();
    expectTypeOf<StoreDevtools['jumpToAction']>().toEqualTypeOf<
      (actionId: number) => void
    >();
    expectTypeOf<StoreDevtools['pauseRecording']>().toEqualTypeOf<
      (status: boolean) => void
    >();
  });

  it('the Redux DevTools extension is injected when it is there', () => {
    expectTypeOf(REDUX_DEVTOOLS_EXTENSION).toEqualTypeOf<
      InjectionToken<ReduxDevtoolsExtension | null>
    >();
    expectTypeOf<ReduxDevtoolsExtension['send']>().returns.toBeVoid();
  });
});
