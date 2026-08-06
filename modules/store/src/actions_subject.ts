import { Injectable, OnDestroy, Provider } from '@angular/core';
import { BehaviorSubject, Observable, Observer, Subscription } from 'rxjs';

import { Action } from './models';

export const INIT = '@ngrx/store/init' as const;

/**
 * The internal action bus: actions are pushed in via `next()` and observed
 * via `subscribe()`/`asObservable()`.
 *
 * Composes a BehaviorSubject instead of extending it. Extending would also
 * inherit the full RxJS Observable/Subject operator surface (`pipe`, `lift`,
 * `toPromise`, `forEach`, ...), which isn't part of this class's actual
 * contract - push actions in, let things observe them, terminate on
 * destroy. Callers that need operator chaining go through `asObservable()`
 * explicitly rather than getting it implicitly from `ActionsSubject` itself.
 */
@Injectable()
export class ActionsSubject implements OnDestroy {
  private readonly actions$ = new BehaviorSubject<Action>({ type: INIT });

  next(action: Action): void {
    if (typeof action === 'function') {
      throw new TypeError(`
        Dispatch expected an object, instead it received a function.
        If you're using the createAction function, make sure to invoke the function
        before dispatching the action. For example, someAction should be someAction().`);
    } else if (typeof action === 'undefined') {
      throw new TypeError(`Actions must be objects`);
    } else if (typeof action.type === 'undefined') {
      throw new TypeError(`Actions must have a type property`);
    }
    this.actions$.next(action);
  }

  error(err: any): void {
    this.actions$.error(err);
  }

  complete(): void {
    /* noop */
  }

  subscribe(observer?: Partial<Observer<Action>>): Subscription;
  subscribe(next: (value: Action) => void): Subscription;
  subscribe(
    next?: ((value: Action) => void) | Partial<Observer<Action>> | null,
    error?: ((error: any) => void) | null,
    complete?: (() => void) | null
  ): Subscription {
    return (this.actions$.subscribe as any)(next, error, complete);
  }

  asObservable(): Observable<Action> {
    return this.actions$.asObservable();
  }

  ngOnDestroy() {
    this.actions$.complete();
  }
}

export const ACTIONS_SUBJECT_PROVIDERS: Provider[] = [ActionsSubject];
