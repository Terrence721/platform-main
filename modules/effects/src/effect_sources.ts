import { ErrorHandler, Inject, Injectable } from '@angular/core';
import { Action } from '@ngrx/store';
import { Observable, Subject, merge } from 'rxjs';
import {
  dematerialize,
  exhaustMap,
  filter,
  groupBy,
  map,
  mergeMap,
  take,
} from 'rxjs/operators';

import {
  reportInvalidActions,
  EffectNotification,
} from './effect_notification';
import { EffectsErrorHandler } from './effects_error_handler';
import { mergeEffects } from './effects_resolver';
import {
  isOnIdentifyEffects,
  isOnRunEffects,
  isOnInitEffects,
} from './lifecycle_hooks';
import { EFFECTS_ERROR_HANDLER } from './tokens';
import {
  getSourceForInstance,
  isClassInstance,
  ObservableNotification,
} from './utils';

/**
 * Composes a private Subject instead of extending it, for the same reason
 * as ActionsSubject/ReducerManager/EffectSources' store-side counterparts:
 * the actual contract here is "push effect-source instances in via
 * addEffects(), get the merged action stream out via toActions()" - nothing
 * external ever calls next()/subscribe()/pipe() on an injected EffectSources
 * directly, so there's no reason to hand out the full RxJS Subject surface.
 */
@Injectable({ providedIn: 'root' })
export class EffectSources {
  private readonly sources$ = new Subject<any>();

  constructor(
    private errorHandler: ErrorHandler,
    @Inject(EFFECTS_ERROR_HANDLER)
    private effectsErrorHandler: EffectsErrorHandler
  ) {}

  addEffects(effectSourceInstance: any): void {
    this.sources$.next(effectSourceInstance);
  }

  error(err: any): void {
    this.sources$.error(err);
  }

  /**
   * @internal
   */
  toActions(): Observable<Action> {
    return this.sources$.pipe(
      groupBy((effectsInstance) =>
        isClassInstance(effectsInstance)
          ? getSourceForInstance(effectsInstance)
          : effectsInstance
      ),
      mergeMap((source$) => {
        return source$.pipe(groupBy(effectsInstance));
      }),
      mergeMap((source$) => {
        const effect$ = source$.pipe(
          exhaustMap((sourceInstance) => {
            return resolveEffectSource(
              this.errorHandler,
              this.effectsErrorHandler
            )(sourceInstance);
          }),
          map((output) => {
            reportInvalidActions(output, this.errorHandler);
            return output.notification;
          }),
          filter(
            (notification): notification is ObservableNotification<Action> =>
              notification.kind === 'N' && notification.value != null
          ),
          dematerialize()
        );

        // start the stream with an INIT action
        // do this only for the first Effect instance
        const init$ = source$.pipe(
          take(1),
          filter(isOnInitEffects),
          map((instance) => instance.ngrxOnInitEffects())
        );

        return merge(effect$, init$);
      })
    );
  }
}

function effectsInstance(sourceInstance: any) {
  if (isOnIdentifyEffects(sourceInstance)) {
    return sourceInstance.ngrxOnIdentifyEffects();
  }

  return '';
}

function resolveEffectSource(
  errorHandler: ErrorHandler,
  effectsErrorHandler: EffectsErrorHandler
): (sourceInstance: any) => Observable<EffectNotification> {
  return (sourceInstance) => {
    const mergedEffects$ = mergeEffects(
      sourceInstance,
      errorHandler,
      effectsErrorHandler
    );

    if (isOnRunEffects(sourceInstance)) {
      return sourceInstance.ngrxOnRunEffects(mergedEffects$);
    }

    return mergedEffects$;
  };
}
