import {
  EnvironmentProviders,
  ErrorHandler,
  FactoryProvider,
  inject,
  InjectionToken,
  ModuleWithProviders,
  Type,
} from '@angular/core';
import { Action, createAction } from '@ngrx/store';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package names, as an app imports them, so a missing or mistyped
// public export fails here (#162). createEffect, ofType, Actions,
// EffectsModule and provideEffects have their own ts-snippet specs.
import {
  Actions,
  createEffect,
  CreateEffectMetadata,
  defaultEffectsErrorHandler,
  EffectConfig,
  EffectNotification,
  EFFECTS_ERROR_HANDLER,
  EffectsErrorHandler,
  EffectsFeatureModule,
  EffectSources,
  EffectsMetadata,
  EffectsModule,
  EffectsRootModule,
  EffectsRunner,
  FunctionalEffect,
  getEffectsMetadata,
  mergeEffects,
  OnIdentifyEffects,
  OnInitEffects,
  OnRunEffects,
  provideEffects,
  ROOT_EFFECTS_INIT,
  rootEffectsInit,
  USER_PROVIDED_EFFECTS,
} from '@ngrx/effects';
import { provideMockActions } from '@ngrx/effects/testing';

const load = createAction('[Books] Load');
const loaded = createAction('[Books] Loaded');

class BookEffects {
  readonly actions$ = inject(Actions);
  load$ = createEffect(() => this.actions$.pipe(map(() => loaded())));
  log$ = createEffect(() => this.actions$.pipe(map(() => 'logged')), {
    dispatch: false,
  });
}

describe('@ngrx/effects public types', () => {
  it('EffectConfig has the three optional switches', () => {
    expectTypeOf<EffectConfig>().toEqualTypeOf<{
      dispatch?: boolean;
      functional?: boolean;
      useEffectsErrorHandler?: boolean;
    }>();
  });

  it('a class effect carries its config as CreateEffectMetadata', () => {
    expectTypeOf<BookEffects['load$']>().toExtend<CreateEffectMetadata>();
    expectTypeOf<BookEffects['load$']>().toExtend<
      Observable<Action<'[Books] Loaded'>>
    >();
  });

  it('a functional effect keeps its own function type', () => {
    const loadBooks = createEffect(
      (actions$ = inject(Actions)) => actions$.pipe(map(() => load())),
      { functional: true }
    );
    expectTypeOf(loadBooks).toExtend<FunctionalEffect>();
    expectTypeOf(loadBooks).returns.toEqualTypeOf<
      Observable<Action<'[Books] Load'>>
    >();
  });

  it('getEffectsMetadata maps each property to its config', () => {
    expectTypeOf(getEffectsMetadata(new BookEffects())).toEqualTypeOf<
      EffectsMetadata<BookEffects>
    >();
    expectTypeOf<keyof EffectsMetadata<BookEffects>>().toEqualTypeOf<
      'actions$' | 'load$' | 'log$'
    >();
    expectTypeOf<EffectsMetadata<BookEffects>['load$']>().toEqualTypeOf<
      EffectConfig | undefined
    >();
  });

  it('the error handlers wrap an effect’s observable', () => {
    expectTypeOf<EffectsErrorHandler>().toEqualTypeOf<
      <T extends Action>(
        observable$: Observable<T>,
        errorHandler: ErrorHandler
      ) => Observable<T>
    >();
    expectTypeOf(defaultEffectsErrorHandler).toExtend<EffectsErrorHandler>();
    expectTypeOf(EFFECTS_ERROR_HANDLER).toEqualTypeOf<
      InjectionToken<EffectsErrorHandler>
    >();
  });

  it('mergeEffects merges an instance’s effects into notifications', () => {
    expectTypeOf(mergeEffects).returns.toEqualTypeOf<
      Observable<EffectNotification>
    >();
    expectTypeOf<
      EffectNotification['propertyName']
    >().toEqualTypeOf<PropertyKey>();
    expectTypeOf<EffectNotification['sourceName']>().toEqualTypeOf<
      string | null
    >();
  });

  it('the root init action has its literal type', () => {
    // A plain const (no `as const`): its type is the literal, though passing
    // it to a generic widens it to string.
    expectTypeOf<
      typeof ROOT_EFFECTS_INIT
    >().toEqualTypeOf<'@ngrx/effects/init'>();
    expectTypeOf(rootEffectsInit()).toEqualTypeOf<
      Action<'@ngrx/effects/init'>
    >();
  });

  it('the lifecycle hooks have their method signatures', () => {
    expectTypeOf<OnIdentifyEffects['ngrxOnIdentifyEffects']>().toEqualTypeOf<
      () => string
    >();
    expectTypeOf<OnInitEffects['ngrxOnInitEffects']>().toEqualTypeOf<
      () => Action
    >();
    expectTypeOf<OnRunEffects['ngrxOnRunEffects']>().toEqualTypeOf<
      (
        resolvedEffects$: Observable<EffectNotification>
      ) => Observable<EffectNotification>
    >();
  });

  it('effects are provided as classes, functional records or tokens', () => {
    expectTypeOf(
      provideEffects(BookEffects)
    ).toEqualTypeOf<EnvironmentProviders>();
    expectTypeOf(
      provideEffects([BookEffects, { loadBooks: {} as FunctionalEffect }])
    ).toEqualTypeOf<EnvironmentProviders>();
    expectTypeOf(USER_PROVIDED_EFFECTS).toEqualTypeOf<
      InjectionToken<Array<Type<unknown> | InjectionToken<unknown>>[]>
    >();
    expectTypeOf(EffectsModule.forRoot([BookEffects])).toEqualTypeOf<
      ModuleWithProviders<EffectsRootModule>
    >();
    expectTypeOf(EffectsModule.forFeature(BookEffects)).toEqualTypeOf<
      ModuleWithProviders<EffectsFeatureModule>
    >();
  });

  it('the services add, run and expose effects', () => {
    expectTypeOf<EffectSources['addEffects']>().toEqualTypeOf<
      (effectSourceInstance: any) => void
    >();
    expectTypeOf<EffectSources['toActions']>().toEqualTypeOf<
      () => Observable<Action>
    >();
    expectTypeOf<EffectsRunner['isStarted']>().toEqualTypeOf<boolean>();
    expectTypeOf<EffectsRunner['start']>().toEqualTypeOf<() => void>();
  });
});

describe('@ngrx/effects/testing public types', () => {
  it('provideMockActions takes a source or a factory and provides Actions', () => {
    expectTypeOf(
      provideMockActions(of(load()))
    ).toEqualTypeOf<FactoryProvider>();
    expectTypeOf(
      provideMockActions(() => of(load()))
    ).toEqualTypeOf<FactoryProvider>();
  });
});
