import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Actions, createEffect } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { filter, tap } from 'rxjs';

/** An action that reports a failure, such as `[Books API] Load Failure`. */
type ErrorAction = Action & { error: string };

function isErrorAction(action: Action): action is ErrorAction {
  return typeof (action as Partial<ErrorAction>).error === 'string';
}

/**
 * Shows the message of any action that carries a string `error` in a snack
 * bar, so each feature reports its failures without its own error UI.
 */
export const showErrors = createEffect(
  (actions$ = inject(Actions), snackBar = inject(MatSnackBar)) =>
    actions$.pipe(
      filter(isErrorAction),
      tap(({ error }) => snackBar.open(error, 'Dismiss', { duration: 5000 }))
    ),
  { functional: true, dispatch: false }
);
