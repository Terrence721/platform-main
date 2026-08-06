import { Injectable, OnDestroy, Provider } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { Action } from './models';

/**
 * Composes a private Subject instead of extending it, for the same reason
 * as ActionsSubject: the contract here is "push scanned actions in, let
 * things observe them" (consumed externally as an Observable, e.g. by
 * @ngrx/effects' Actions service), not the full RxJS Subject operator
 * surface.
 */
@Injectable()
export class ScannedActionsSubject implements OnDestroy {
  private readonly scannedActions$ = new Subject<Action>();

  next(action: Action): void {
    this.scannedActions$.next(action);
  }

  error(err: any): void {
    this.scannedActions$.error(err);
  }

  /**
   * Unlike ActionsSubject.complete() (an intentional no-op, so external code
   * can't prematurely end the app's action bus), this genuinely completes
   * the stream - the real ngrx source doesn't override Subject.complete()
   * here, so this is a working terminator, not a neutered one.
   */
  complete(): void {
    this.scannedActions$.complete();
  }

  asObservable(): Observable<Action> {
    return this.scannedActions$.asObservable();
  }

  ngOnDestroy() {
    this.complete();
  }
}

export const SCANNED_ACTIONS_SUBJECT_PROVIDERS: Provider[] = [
  ScannedActionsSubject,
];
