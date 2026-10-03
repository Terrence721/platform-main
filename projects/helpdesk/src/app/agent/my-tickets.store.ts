import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import type { TicketDto } from '@helpdesk/contract';
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
import { pipe, switchMap, tap } from 'rxjs';

/** Where the agent's own tickets come from, through the dev server's proxy. */
export const MY_TICKETS_API = '/api/tickets/mine';

export type MyTicketsLoadState = 'loading' | 'loaded' | 'failed';

/**
 * The signed-in agent's open work, for the agent page's My tickets. The
 * API sends it most urgent first, and the store keeps that order. Provided
 * by the page, so it lives only while the page is open; it loads when
 * created.
 */
export const MyTicketsStore = signalStore(
  withEntities<TicketDto>(),
  withState({ loadState: 'loading' as MyTicketsLoadState }),
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
  })),
  withHooks({
    onInit: (store) => store.load(),
  })
);
