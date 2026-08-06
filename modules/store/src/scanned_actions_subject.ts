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

  asObservable(): Observable<Action> {
    return this.scannedActions$.asObservable();
  }

  ngOnDestroy() {
    this.scannedActions$.complete();
  }
}

export const SCANNED_ACTIONS_SUBJECT_PROVIDERS: Provider[] = [
  ScannedActionsSubject,
];
