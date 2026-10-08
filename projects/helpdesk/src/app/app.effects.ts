import { inject, Injector } from '@angular/core';
import { Actions, createEffect } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { concatMap, filter, from, map, tap } from 'rxjs';

/**
 * An action that reports a failure, such as `[Landing API] Showcase Tickets
 * Load Failed`. A failure shown where it happened carries `message` instead,
 * so it isn't shown twice: sign-in's, which its popup shows.
 */
type ErrorAction = Action & { error: string };

function isErrorAction(action: Action): action is ErrorAction {
  return typeof (action as Partial<ErrorAction>).error === 'string';
}

/**
 * Shows the message of any action that carries a string `error` in a snack
 * bar, so each feature reports its failures without its own error UI. The
 * snack bar's code is loaded with the first error, not with the page:
 * statically imported, it would bring Material's overlay code into the
 * first download, and with it whatever the sign-in popup shares with it.
 */
export const showErrors = createEffect(
  (actions$ = inject(Actions), injector = inject(Injector)) => {
    return actions$.pipe(
      filter(isErrorAction),
      concatMap(({ error }) =>
        from(import('@angular/material/snack-bar')).pipe(
          map(({ MatSnackBar }) => ({
            snackBar: injector.get(MatSnackBar),
            error,
          }))
        )
      ),
      tap(({ snackBar, error }) =>
        snackBar.open(error, 'Dismiss', { duration: 5000 })
      )
    );
  },
  { functional: true, dispatch: false }
);
