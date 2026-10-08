import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, throwError } from 'rxjs';
import { SessionApiActions } from './session.actions';
import { sessionFeature } from './session.feature';

/** The API's session calls, which say themselves what a 401 means. */
const SESSION_CALLS = '/api/auth/';

/**
 * Notices a session that ended during work: a 401 from the API while
 * someone is signed in means the session ran out (after its hours), or the
 * account was deactivated or changed. It says so once, as Session Ended,
 * and lets the error go on to the call that met it.
 */
export const sessionEndedInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(Store);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        request.url.startsWith('/api/') &&
        !request.url.startsWith(SESSION_CALLS) &&
        store.selectSignal(sessionFeature.selectUser)() !== null
      ) {
        store.dispatch(SessionApiActions.sessionEnded());
      }
      return throwError(() => error);
    })
  );
};
