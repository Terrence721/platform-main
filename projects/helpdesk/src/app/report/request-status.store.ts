import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import {
  DISMISS_REASON_LABELS,
  formatTicketNumber,
  type RequestStatusResponse,
} from '@helpdesk/contract';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { STATUS_LABELS } from '../tickets/status-labels';
import { tryAgainIn } from './report.store';

/** Where a request's status is asked, on the app's own origin. */
export const REQUEST_STATUS_API = '/api/requests/status';

/**
 * The answer when the reference and the email do not belong together: the
 * same for a wrong email as for no such reference, as the API answers.
 */
export const NO_MATCH_MESSAGE = 'No request matches that reference and email.';

/** When checking fails for a reason the API did not explain. */
export const CHECK_UNAVAILABLE_MESSAGE =
  "Checking isn't available right now. Please try again in a few minutes.";

/** Where a check is up to; `done` with an answer, `failed` with why. */
export type CheckState = 'idle' | 'checking' | 'done' | 'failed';

/** A request's status in words, as Check my request says it. */
export function describeStatus(answer: RequestStatusResponse): string {
  switch (answer.status) {
    case 'pending':
      return `${answer.reference} is waiting for our team.`;
    case 'ticket':
      return `${answer.reference} is now ticket ${formatTicketNumber(
        answer.ticketNumber
      )}, which is ${STATUS_LABELS[answer.ticketStatus]}.`;
    case 'dismissed':
      return `${answer.reference} was closed: ${
        DISMISS_REASON_LABELS[answer.reason]
      }.`;
  }
}

/** Why a check could not answer, in words. */
function failureMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 429) {
    const header = error.headers.get('Retry-After');
    return `Too many checks from here. Please try again ${tryAgainIn(
      header === null ? null : Number(header)
    )}.`;
  }
  return CHECK_UNAVAILABLE_MESSAGE;
}

/**
 * Check my request's store (#1026): asks where a request is up to, by its
 * reference and the email it was sent with, and keeps the answer in words.
 * Provided by the page, so it lives only while the page is open.
 */
export const RequestStatusStore = signalStore(
  withState({
    checkState: 'idle' as CheckState,
    /** The answer in words, or why there is none; `null` until a check. */
    answer: null as string | null,
  }),
  withMethods((store, http = inject(HttpClient)) => ({
    /** Checks a request; a newer check replaces one still on its way. */
    check: rxMethod<{ reference: string; email: string }>(
      pipe(
        tap(() => patchState(store, { checkState: 'checking', answer: null })),
        switchMap(({ reference, email }) =>
          http
            .get<RequestStatusResponse>(REQUEST_STATUS_API, {
              params: { reference, email },
            })
            .pipe(
              tapResponse({
                next: (answer) =>
                  patchState(store, {
                    checkState: 'done',
                    answer: describeStatus(answer),
                  }),
                error: (error: unknown) =>
                  patchState(
                    store,
                    error instanceof HttpErrorResponse && error.status === 404
                      ? { checkState: 'done', answer: NO_MATCH_MESSAGE }
                      : { checkState: 'failed', answer: failureMessage(error) }
                  ),
              })
            )
        )
      )
    ),
  }))
);
