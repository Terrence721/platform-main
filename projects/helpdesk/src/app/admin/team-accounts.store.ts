import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type { CreateAccountRequest, UserAccount } from '@helpdesk/contract';
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
import { exhaustMap, pipe, switchMap, tap } from 'rxjs';

/** Where the accounts come from, through the dev server's proxy. */
export const TEAM_ACCOUNTS_API = '/api/users';

/** When creating fails for a reason the API did not explain. */
export const CREATE_UNAVAILABLE_MESSAGE =
  "Creating the account isn't available right now. Please try again.";

export type TeamAccountsLoadState = 'loading' | 'loaded' | 'failed';

/** Where a Create Account is up to; `idle` until one is sent. */
export type CreateState = 'idle' | 'saving' | 'created' | 'failed';

/** By name, then user ID: the API's order. */
function byName(a: UserAccount, b: UserAccount): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/**
 * The message for a refused Create Account: the API's own for a wrong
 * field (400) or a taken user ID (409), a general one otherwise.
 */
function createErrorMessage(error: unknown): string {
  if (
    error instanceof HttpErrorResponse &&
    (error.status === 400 || error.status === 409) &&
    typeof error.error?.message === 'string'
  ) {
    return error.error.message;
  }
  return CREATE_UNAVAILABLE_MESSAGE;
}

/**
 * Every Helpdesk account, for the admin page's Team accounts, kept by name
 * (the API's order); and creating new ones. Provided by the page, so it
 * lives only while the page is open; it loads when created.
 */
export const TeamAccountsStore = signalStore(
  withEntities<UserAccount>(),
  withState({
    loadState: 'loading' as TeamAccountsLoadState,
    createState: 'idle' as CreateState,
    /** Why the last Create Account failed; `null` otherwise. */
    createError: null as string | null,
  }),
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
    /**
     * Creates an account. On success it joins the list in name order, so
     * its team's table and the counts update straight away. A second send
     * while one is saving is ignored.
     */
    create: rxMethod<CreateAccountRequest>(
      pipe(
        exhaustMap((request) => {
          patchState(store, { createState: 'saving', createError: null });
          return http.post<UserAccount>(TEAM_ACCOUNTS_API, request).pipe(
            tapResponse({
              next: (account) =>
                patchState(
                  store,
                  setAllEntities([...store.entities(), account].sort(byName)),
                  { createState: 'created' }
                ),
              error: (error: unknown) =>
                patchState(store, {
                  createState: 'failed',
                  createError: createErrorMessage(error),
                }),
            })
          );
        })
      )
    ),
    /** Back to no Create Account in progress, as a new form opens. */
    resetCreate(): void {
      patchState(store, { createState: 'idle', createError: null });
    },
  })),
  withHooks({
    onInit: (store) => store.load(),
  })
);
