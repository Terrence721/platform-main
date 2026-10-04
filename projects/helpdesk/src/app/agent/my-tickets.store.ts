import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type {
  AssignTicketRequest,
  ChangeStatusRequest,
  TicketDto,
  TicketStatus,
} from '@helpdesk/contract';
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

/** Where the agent's recently finished tickets come from. */
export const FINISHED_API = '/api/tickets/mine/finished';

/** Where a ticket's status is set. */
export function statusApi(ticketId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId)}/status`;
}

/** When taking a ticket fails for a reason the API did not explain. */
export const TAKE_UNAVAILABLE_MESSAGE =
  "Taking tickets isn't available right now. Please try again.";

/** When changing a status fails for a reason the API did not explain. */
export const STATUS_UNAVAILABLE_MESSAGE =
  "Changing the status isn't available right now. Please try again.";

export type MyTicketsLoadState = 'loading' | 'loaded' | 'failed';

/** Where taking a ticket is up to; `idle` until one is taken. */
export type TakeState = 'idle' | 'saving' | 'taken' | 'failed';

/** Where a status change is up to; `idle` until one is sent. */
export type StatusState = 'idle' | 'saving' | 'changed' | 'failed';

/**
 * The API's own message for a refusal it explains (400, 403, 404, 409), or
 * `fallback` when it cannot (the API down, say).
 */
function apiErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof HttpErrorResponse &&
    [400, 403, 404, 409].includes(error.status) &&
    typeof error.error?.message === 'string'
  ) {
    return error.error.message;
  }
  return fallback;
}

/**
 * The signed-in agent's open work, for the agent page's My tickets; the
 * unassigned work they may take; and what they finished in the last 24
 * hours (Done). Each comes in the API's order, which the store keeps.
 * Provided by the page, so it lives only while the page is open; all three
 * load when created.
 */
export const MyTicketsStore = signalStore(
  withEntities<TicketDto>(),
  withState({
    loadState: 'loading' as MyTicketsLoadState,
    /** Every unassigned open ticket, most urgent first. */
    unassigned: [] as TicketDto[],
    unassignedState: 'loading' as MyTicketsLoadState,
    /** The agent's tickets finished lately, most recently changed first. */
    finished: [] as TicketDto[],
    finishedState: 'loading' as MyTicketsLoadState,
    takeState: 'idle' as TakeState,
    /** Why the last take failed; `null` otherwise. */
    takeError: null as string | null,
    /** The ticket last taken, for the page to confirm. */
    lastTaken: null as TicketDto | null,
    statusState: 'idle' as StatusState,
    /** Why the last status change failed; `null` otherwise. */
    statusError: null as string | null,
    /** The ticket whose status last changed, for the page to confirm. */
    lastChanged: null as TicketDto | null,
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
                  takeError: apiErrorMessage(error, TAKE_UNAVAILABLE_MESSAGE),
                }),
            })
          );
        })
      )
    ),
    /** Loads the recently finished tickets (Done) again. */
    loadFinished: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { finishedState: 'loading' })),
        switchMap(() =>
          http.get<TicketDto[]>(FINISHED_API).pipe(
            tapResponse({
              next: (finished) =>
                patchState(store, { finished, finishedState: 'loaded' }),
              error: () => patchState(store, { finishedState: 'failed' }),
            })
          )
        )
      )
    ),
    /**
     * Moves one of the agent's tickets to another status. Once done, My
     * tickets and Done are fetched again and swapped in quietly, with no
     * spinner: a resolved ticket moves down into Done, a reopened one back
     * up. A second change while one is saving is ignored.
     */
    changeStatus: rxMethod<{ ticketId: string; status: TicketStatus }>(
      pipe(
        exhaustMap(({ ticketId, status }) => {
          patchState(store, { statusState: 'saving', statusError: null });
          const body: ChangeStatusRequest = { status };
          return http.put<TicketDto>(statusApi(ticketId), body).pipe(
            switchMap((ticket) =>
              forkJoin({
                ticket: [ticket],
                mine: http.get<TicketDto[]>(MY_TICKETS_API),
                finished: http.get<TicketDto[]>(FINISHED_API),
              })
            ),
            tapResponse({
              next: ({ ticket, mine, finished }) =>
                patchState(store, setAllEntities(mine), {
                  finished,
                  statusState: 'changed',
                  lastChanged: ticket,
                }),
              error: (error: unknown) =>
                patchState(store, {
                  statusState: 'failed',
                  statusError: apiErrorMessage(
                    error,
                    STATUS_UNAVAILABLE_MESSAGE
                  ),
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
      store.loadFinished();
    },
  })
);
