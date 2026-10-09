import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type {
  CreateRequestRequest,
  CreateRequestResponse,
} from '@helpdesk/contract';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, pipe, tap } from 'rxjs';
import { apiErrorMessage } from '../tickets/api-error-message';

/** Where requests are sent, on the app's own origin. */
export const REPORT_API = '/api/requests';

/** When sending fails for a reason the API did not explain. */
export const SEND_UNAVAILABLE_MESSAGE =
  "Sending isn't available right now. Please try again in a few minutes.";

/** Where a request is up to; `idle` until one is sent. */
export type SendState = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * How long to wait, in words, from a Retry-After in seconds: "in a
 * minute", "in about 30 minutes", "in about an hour"; "later" when it is
 * not known.
 */
export function tryAgainIn(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return 'later';
  }
  if (seconds <= 60) {
    return 'in a minute';
  }
  // From 50 minutes, in hours.
  if (seconds < 50 * 60) {
    return `in about ${Math.ceil(seconds / 60)} minutes`;
  }
  const hours = Math.round(seconds / 3600);
  return hours <= 1 ? 'in about an hour' : `in about ${hours} hours`;
}

/** Why a send failed, in words for the person who sent it. */
function failureMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 429) {
    const header = error.headers.get('Retry-After');
    return `Too many requests from here. Please try again ${tryAgainIn(
      header === null ? null : Number(header)
    )}.`;
  }
  return apiErrorMessage(error, SEND_UNAVAILABLE_MESSAGE);
}

/**
 * The Report an issue page's store (#1026): sends the public form and
 * keeps where that is up to, and the reference it gets back. Provided by
 * the page, so it lives only while the page is open.
 */
export const ReportStore = signalStore(
  withState({
    sendState: 'idle' as SendState,
    /** The request's reference, such as `R-1042`, once sent. */
    reference: null as string | null,
    /** Why the last send failed; `null` otherwise. */
    error: null as string | null,
  }),
  withMethods((store, http = inject(HttpClient)) => ({
    /** Sends the form; a second send while one is on its way is ignored. */
    send: rxMethod<CreateRequestRequest>(
      pipe(
        tap(() => patchState(store, { sendState: 'sending', error: null })),
        exhaustMap((request) =>
          http.post<CreateRequestResponse>(REPORT_API, request).pipe(
            tapResponse({
              next: ({ reference }) =>
                patchState(store, { sendState: 'sent', reference }),
              error: (error: unknown) =>
                patchState(store, {
                  sendState: 'failed',
                  error: failureMessage(error),
                }),
            })
          )
        )
      )
    ),
    /** Back to an empty form, for another request. */
    reset(): void {
      patchState(store, { sendState: 'idle', reference: null, error: null });
    },
  }))
);
