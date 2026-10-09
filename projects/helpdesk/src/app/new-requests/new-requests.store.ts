import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import type {
  DismissRequestRequest,
  PendingRequest,
  QueueSummary,
  TicketDto,
  TurnIntoTicketRequest,
} from '@helpdesk/contract';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  removeEntity,
  setAllEntities,
  withEntities,
} from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, filter, forkJoin, map, pipe, switchMap, tap } from 'rxjs';
import { LiveUpdates } from '../live/live-updates';
import { Sounds } from '../sound/sounds';
import { apiErrorMessage } from '../tickets/api-error-message';

/** Where the pending requests come from, on the app's own origin. */
export const NEW_REQUESTS_API = '/api/requests';

/** Where Turn into ticket's queue choices come from. */
export const QUEUES_API = '/api/queues';

/** When a decision fails for a reason the API did not explain. */
export const DECIDE_UNAVAILABLE_MESSAGE =
  "Deciding isn't available right now. Please try again.";

export type NewRequestsLoadState = 'loading' | 'loaded' | 'failed';

/** Where a decision is up to; `idle` until one is sent. */
export type DecideState = 'idle' | 'saving' | 'done' | 'failed';

/** A decision on one request: which, and what it is. */
export interface Decision<Request> {
  requestId: string;
  request: Request;
}

/**
 * Supervisors' New requests (#1026): the pending requests, oldest first,
 * and the queues one can become a ticket in; and the decisions on them.
 * Provided by the supervisor page, so it lives only while the page is
 * open. It loads when created, and again, quietly, whenever a live update
 * says a request arrived or was decided, playing the arrival tone when a
 * new one comes in.
 */
export const NewRequestsStore = signalStore(
  withEntities<PendingRequest>(),
  withState({
    queues: [] as QueueSummary[],
    loadState: 'loading' as NewRequestsLoadState,
    decideState: 'idle' as DecideState,
    /** Why the last decision failed; `null` otherwise. */
    decideError: null as string | null,
    /** The ticket the last Turn into ticket made; `null` otherwise. */
    ticket: null as TicketDto | null,
  }),
  withMethods((store, http = inject(HttpClient), sounds = inject(Sounds)) => {
    /** The pending requests and the queues, together. */
    const fetchAll = () =>
      forkJoin({
        requests: http.get<PendingRequest[]>(NEW_REQUESTS_API),
        queues: http.get<QueueSummary[]>(QUEUES_API),
      });
    /**
     * Fetches them again and swaps them in quietly: after a live update,
     * or a decision someone made first. A request not shown before has
     * arrived: the arrival tone says so. A failed refresh keeps what is
     * shown.
     */
    const refresh = rxMethod<void>(
      pipe(
        switchMap(() =>
          fetchAll().pipe(
            tapResponse({
              next: ({ requests, queues }) => {
                const shown = new Set(store.ids());
                if (
                  store.loadState() === 'loaded' &&
                  requests.some(({ id }) => !shown.has(id))
                ) {
                  sounds.play('arrival');
                }
                patchState(store, setAllEntities(requests), {
                  queues,
                  loadState: 'loaded',
                });
              },
              error: () => undefined,
            })
          )
        )
      )
    );
    /** A decision's request, sent once; on success it leaves the list. */
    const decide = <Request, Answer>(
      path: (requestId: string) => string,
      done: (answer: Answer) => Partial<{ ticket: TicketDto | null }>
    ) =>
      rxMethod<Decision<Request>>(
        pipe(
          exhaustMap(({ requestId, request }) => {
            patchState(store, {
              decideState: 'saving',
              decideError: null,
              ticket: null,
            });
            return http.post<Answer>(path(requestId), request).pipe(
              tapResponse({
                next: (answer) =>
                  patchState(store, removeEntity(requestId), {
                    decideState: 'done',
                    ...done(answer),
                  }),
                error: (error: unknown) => {
                  patchState(store, {
                    decideState: 'failed',
                    decideError: apiErrorMessage(
                      error,
                      DECIDE_UNAVAILABLE_MESSAGE
                    ),
                  });
                  // Someone may have decided it first: show the list
                  // as it is now.
                  refresh();
                },
              })
            );
          })
        )
      );
    return {
      /** Loads the requests and the queues again. */
      load: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loadState: 'loading' })),
          switchMap(() =>
            fetchAll().pipe(
              tapResponse({
                next: ({ requests, queues }) =>
                  patchState(store, setAllEntities(requests), {
                    queues,
                    loadState: 'loaded',
                  }),
                error: () => patchState(store, { loadState: 'failed' }),
              })
            )
          )
        )
      ),
      refresh,
      /** Turns a request into a ticket, then takes it off the list. */
      turnIntoTicket: decide<TurnIntoTicketRequest, TicketDto>(
        (requestId) =>
          `${NEW_REQUESTS_API}/${encodeURIComponent(requestId)}/ticket`,
        (ticket) => ({ ticket })
      ),
      /** Dismisses a request, then takes it off the list. */
      dismiss: decide<DismissRequestRequest, null>(
        (requestId) =>
          `${NEW_REQUESTS_API}/${encodeURIComponent(requestId)}/dismiss`,
        () => ({})
      ),
      /** Back to no decision in progress, as a popup opens. */
      resetDecision(): void {
        patchState(store, {
          decideState: 'idle',
          decideError: null,
          ticket: null,
        });
      },
    };
  }),
  withHooks({
    onInit: (store, live = inject(LiveUpdates)) => {
      store.load();
      // A request arrived or was decided, or the stream came back after a
      // break.
      store.refresh(
        live.updates.pipe(
          filter(
            (update) =>
              update.kind === 'reconnected' || update.event.type === 'requests'
          ),
          map(() => undefined)
        )
      );
    },
  })
);
