import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type { AssignTicketRequest, TicketDto } from '@helpdesk/contract';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { setAllEntities, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, forkJoin, pipe, switchMap, tap } from 'rxjs';
import { assigneeApi } from '../supervisor/my-team.store';

/** Where the agent's own tickets come from, through the dev server's proxy. */
export const MY_TICKETS_API = '/api/tickets/mine';

/** Where the tickets nobody holds come from. */
export const UNASSIGNED_API = '/api/tickets/unassigned';

/** When taking a ticket fails for a reason the API did not explain. */
export const TAKE_UNAVAILABLE_MESSAGE =
  "Taking tickets isn't available right now. Please try again.";

export type MyTicketsLoadState = 'loading' | 'loaded' | 'failed';

/** Where taking a ticket is up to; `idle` until one is taken. */
export type TakeState = 'idle' | 'saving' | 'taken' | 'failed';

/** The API's message for a refused take (403, 404, 409), or a general one. */
function takeErrorMessage(error: unknown): string {
  if (
    error instanceof HttpErrorResponse &&
    [403, 404, 409].includes(error.status) &&
    typeof error.error?.message === 'string'
  ) {
    return error.error.message;
  }
  return TAKE_UNAVAILABLE_MESSAGE;
}

/**
 * The signed-in agent's open work, for the agent page's My tickets, and
 * the unassigned work they may take. The API sends each most urgent first,
 * and the store keeps that order. Provided by the page, so it lives only
 * while the page is open; both load when created.
 */
export const MyTicketsStore = signalStore(
  withEntities<TicketDto>(),
  withState({
    loadState: 'loading' as MyTicketsLoadState,
    /** Every unassigned open ticket, most urgent first. */
    unassigned: [] as TicketDto[],
    unassignedState: 'loading' as MyTicketsLoadState,
    takeState: 'idle' as TakeState,
    /** Why the last take failed; `null` otherwise. */
    takeError: null as string | null,
    /** The ticket last taken, for the page to confirm. */
    lastTaken: null as TicketDto | null,
  }),
  withMethods((store, http = inject(HttpClient)) => ({
    /** Loads the tickets again; a newer load replaces one still running. */
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loadState: 'loading' })),
        switchMap(() =>
          http.get<TicketDto[]>(MY_TICKETS_API).pipe(
            tapResponse({
              next: (tickets) =>
                patchState(store, setAllEntities(tickets), {
                  loadState: 'loaded',
                }),
              error: () => patchState(store, { loadState: 'failed' }),
            })
          )
        )
      )
    ),
    /** Loads the unassigned tickets again. */
    loadUnassigned: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { unassignedState: 'loading' })),
        switchMap(() =>
          http.get<TicketDto[]>(UNASSIGNED_API).pipe(
            tapResponse({
              next: (unassigned) =>
                patchState(store, { unassigned, unassignedState: 'loaded' }),
              error: () => patchState(store, { unassignedState: 'failed' }),
            })
          )
        )
      )
    ),
    /**
     * The agent takes an unassigned ticket for themselves. Once done, both
     * lists are fetched again and swapped in quietly, with no spinner, so
     * the ticket moves from Unassigned into My tickets. A second take while
     * one is saving is ignored.
     */
    take: rxMethod<{ ticketId: string; agentId: string }>(
      pipe(
        exhaustMap(({ ticketId, agentId }) => {
          patchState(store, { takeState: 'saving', takeError: null });
          const body: AssignTicketRequest = { assigneeId: agentId };
          return http.put<TicketDto>(assigneeApi(ticketId), body).pipe(
            switchMap((ticket) =>
              forkJoin({
                ticket: [ticket],
                mine: http.get<TicketDto[]>(MY_TICKETS_API),
                unassigned: http.get<TicketDto[]>(UNASSIGNED_API),
              })
            ),
            tapResponse({
              next: ({ ticket, mine, unassigned }) =>
                patchState(store, setAllEntities(mine), {
                  unassigned,
                  takeState: 'taken',
                  lastTaken: ticket,
                }),
              error: (error: unknown) =>
                patchState(store, {
                  takeState: 'failed',
                  takeError: takeErrorMessage(error),
                }),
            })
          );
        })
      )
    ),
  })),
  withHooks({
    onInit: (store) => {
      store.load();
      store.loadUnassigned();
    },
  })
);
