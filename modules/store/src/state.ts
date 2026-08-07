import { Inject, Injectable, OnDestroy, Provider, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  Observable,
  queueScheduler,
  Subscription,
} from 'rxjs';
import { observeOn, scan, withLatestFrom } from 'rxjs/operators';

import { ActionsSubject, INIT } from './actions_subject';
import { Action, ActionReducer } from './models';
import { ReducerObservable } from './reducer_manager';
import { ScannedActionsSubject } from './scanned_actions_subject';
import { INITIAL_STATE } from './tokens';

/**
 * Composes an Observable + Signal internally instead of extending
 * Observable, for the same reason as Store/ActionsSubject/ReducerManager:
 * the real contract here is "expose the current state as a stream and as a
 * signal," not the full RxJS operator surface that extending Observable
 * would hand every consumer of this DI token.
 */
export abstract class StateObservable {
  abstract readonly state$: Observable<any>;
  /**
   * @internal
   */
  abstract readonly state: Signal<any>;
}

@Injectable()
export class State<T> implements OnDestroy {
  static readonly INIT = INIT;

  private readonly stateSubject: BehaviorSubject<any>;
  private stateSubscription: Subscription;

  readonly state$: Observable<any>;

  /**
   * @internal
   */
  public state: Signal<T>;

  get value(): T {
    return this.stateSubject.value;
  }

  error(err: any): void {
    this.stateSubject.error(err);
  }

  constructor(
    actions$: ActionsSubject,
    reducer$: ReducerObservable,
    scannedActions: ScannedActionsSubject,
    @Inject(INITIAL_STATE) initialState: any
  ) {
    this.stateSubject = new BehaviorSubject<any>(initialState);
    this.state$ = this.stateSubject.asObservable();

    const actionsOnQueue$: Observable<Action> = actions$
      .asObservable()
      .pipe(observeOn(queueScheduler));
    const withLatestReducer$: Observable<[Action, ActionReducer<any, Action>]> =
      actionsOnQueue$.pipe(withLatestFrom(reducer$));

    const seed: StateActionPair<T> = { state: initialState };
    const stateAndAction$: Observable<{
      state: any;
      action?: Action;
    }> = withLatestReducer$.pipe(
      scan<[Action, ActionReducer<T, Action>], StateActionPair<T>>(
        reduceState,
        seed
      )
    );

    this.stateSubscription = stateAndAction$.subscribe(({ state, action }) => {
      this.stateSubject.next(state);
      scannedActions.next(action as Action);
    });

    this.state = toSignal(this.state$, {
      manualCleanup: true,
      requireSync: true,
    });
  }

  ngOnDestroy() {
    this.stateSubscription.unsubscribe();
    this.stateSubject.complete();
  }
}

export type StateActionPair<T, V extends Action = Action> = {
  state: T | undefined;
  action?: V;
};
export function reduceState<T, V extends Action = Action>(
  stateActionPair: StateActionPair<T, V> = { state: undefined },
  [action, reducer]: [V, ActionReducer<T, V>]
): StateActionPair<T, V> {
  const { state } = stateActionPair;
  return { state: reducer(state, action), action };
}

export const STATE_PROVIDERS: Provider[] = [
  State,
  { provide: StateObservable, useExisting: State },
];
