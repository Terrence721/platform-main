import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import type { UserAccount } from '@helpdesk/contract';
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

/** Where the accounts come from, through the dev server's proxy. */
export const TEAM_ACCOUNTS_API = '/api/users';

export type TeamAccountsLoadState = 'loading' | 'loaded' | 'failed';

/**
 * Every Helpdesk account, for the admin page's Team accounts. The API sends
 * them by name, and the store keeps that order. Provided by the page, so it
 * lives only while the page is open; it loads when created.
 */
export const TeamAccountsStore = signalStore(
  withEntities<UserAccount>(),
  withState({ loadState: 'loading' as TeamAccountsLoadState }),
  withMethods((store, http = inject(HttpClient)) => ({
    /** Loads the accounts again; a newer load replaces one still running. */
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loadState: 'loading' })),
        switchMap(() =>
          http.get<UserAccount[]>(TEAM_ACCOUNTS_API).pipe(
            tapResponse({
              next: (accounts) =>
                patchState(store, setAllEntities(accounts), {
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
