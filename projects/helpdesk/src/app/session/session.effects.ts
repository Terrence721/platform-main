import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  type SessionResponse,
  SIGN_IN_FAILED_MESSAGE,
  type SignInResponse,
} from '@helpdesk/contract';
import {
  Actions,
  createEffect,
  ofType,
  ROOT_EFFECTS_INIT,
} from '@ngrx/effects';
import { mapResponse } from '@ngrx/operators';
import { catchError, exhaustMap, map, of, tap } from 'rxjs';
import { SignInLauncher } from '../sign-in/sign-in-launcher';
import { SignInDialogActions } from '../sign-in/sign-in.actions';
import { Sounds } from '../sound/sounds';
import { SessionApiActions, ToolbarActions } from './session.actions';
import { HOME_PAGES } from './session.feature';

/**
 * Where the API's sign-in endpoints are, on the app's own origin: through
 * the dev server's proxy, nginx in the Docker image, or the in-browser
 * demo's API.
 */
export const AUTH_API = '/api/auth';

/** When signing in fails for a reason other than wrong details. */
export const SIGN_IN_UNAVAILABLE_MESSAGE =
  "Signing in isn't available right now. Please try again.";

/**
 * When the API refuses for now after too many tries (429), and when to try
 * again, from its Retry-After seconds: retrying at once would only be
 * refused again.
 */
export function tooManyTriesMessage(retryAfter: string | null): string {
  const seconds = Number(retryAfter);
  const when =
    retryAfter === null || !Number.isFinite(seconds) || seconds <= 0
      ? 'later'
      : seconds <= 60
        ? 'in a moment'
        : `in ${Math.ceil(seconds / 60)} minutes`;
  return `Too many sign-in attempts. Please try again ${when}.`;
}

/** What the popup says when signing in failed. */
function signInFailureMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 401) {
    return SIGN_IN_FAILED_MESSAGE;
  }
  if (error instanceof HttpErrorResponse && error.status === 429) {
    return tooManyTriesMessage(error.headers.get('Retry-After'));
  }
  return SIGN_IN_UNAVAILABLE_MESSAGE;
}

/**
 * On start-up, asks the API whether the browser still has a session: a
 * user restores it; nobody (`user: null`), or an API that cannot be
 * reached, means there is none.
 */
export const restoreSession = createEffect(
  (actions$ = inject(Actions), http = inject(HttpClient)) => {
    return actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      exhaustMap(() =>
        http.get<SessionResponse>(`${AUTH_API}/me`).pipe(
          mapResponse({
            next: ({ user }) =>
              user === null
                ? SessionApiActions.noSession()
                : SessionApiActions.sessionRestored({ user }),
            error: () => SessionApiActions.noSession(),
          })
        )
      )
    );
  },
  { functional: true }
);

/**
 * Signs in with what the popup sent. A second send while one is running is
 * ignored. Wrong details get the contract's one message; too many tries,
 * when to try again; anything else (the API down, say) a different one, so
 * nobody retypes a correct password.
 */
export const signIn = createEffect(
  (actions$ = inject(Actions), http = inject(HttpClient)) => {
    return actions$.pipe(
      ofType(SignInDialogActions.submitted),
      exhaustMap(({ request }) =>
        http.post<SignInResponse>(`${AUTH_API}/sign-in`, request).pipe(
          mapResponse({
            next: ({ user }) => SessionApiActions.signedIn({ user }),
            error: (error: unknown) =>
              SessionApiActions.signInFailed({
                message: signInFailureMessage(error),
              }),
          })
        )
      )
    );
  },
  { functional: true }
);

/**
 * A chime when signing in works, a low tone when it is refused (#941); the
 * popup says what happened too. Signing in is the click browsers want
 * before any sound, so this is the first one a visit can play.
 */
export const signInSounds = createEffect(
  (actions$ = inject(Actions), sounds = inject(Sounds)) => {
    return actions$.pipe(
      ofType(SessionApiActions.signedIn, SessionApiActions.signInFailed),
      tap(({ type }) =>
        sounds.play(
          type === SessionApiActions.signedIn.type ? 'success' : 'error'
        )
      )
    );
  },
  { functional: true, dispatch: false }
);

/** After signing in, goes to the user's own page, by role. */
export const goHomeAfterSignIn = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) => {
    return actions$.pipe(
      ofType(SessionApiActions.signedIn),
      tap(({ user }) => void router.navigateByUrl(HOME_PAGES[user.role]))
    );
  },
  { functional: true, dispatch: false }
);

/**
 * Signs out. Counts as signed out even if the API cannot be reached, so
 * nobody is left stuck signed in.
 */
export const signOut = createEffect(
  (actions$ = inject(Actions), http = inject(HttpClient)) => {
    return actions$.pipe(
      ofType(ToolbarActions.signOutClicked),
      exhaustMap(() =>
        http.post<void>(`${AUTH_API}/sign-out`, null).pipe(
          map(() => SessionApiActions.signedOut()),
          catchError(() => of(SessionApiActions.signedOut()))
        )
      )
    );
  },
  { functional: true }
);

/** After signing out, back to the landing page. */
export const leaveAfterSignOut = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) => {
    return actions$.pipe(
      ofType(SessionApiActions.signedOut),
      tap(() => void router.navigateByUrl('/'))
    );
  },
  { functional: true, dispatch: false }
);

/**
 * When the session ended during work: back to the landing page, which
 * closes any open popup, and the sign-in popup, saying why.
 */
export const signInAgainAfterSessionEnded = createEffect(
  (
    actions$ = inject(Actions),
    router = inject(Router),
    signInLauncher = inject(SignInLauncher)
  ) => {
    return actions$.pipe(
      ofType(SessionApiActions.sessionEnded),
      exhaustMap(async () => {
        await router.navigateByUrl('/');
        await signInLauncher.open();
      })
    );
  },
  { functional: true, dispatch: false }
);
