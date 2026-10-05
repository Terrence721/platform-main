import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type {
  CreateAccountRequest,
  UpdateAccountRequest,
  UpdateAccountResponse,
  UserAccount,
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
  setAllEntities,
  setEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, pipe, switchMap, tap } from 'rxjs';

/** Where the accounts come from, through the dev server's proxy. */
export const TEAM_ACCOUNTS_API = '/api/users';

/** When creating fails for a reason the API did not explain. */
export const CREATE_UNAVAILABLE_MESSAGE =
  "Creating the account isn't available right now. Please try again.";

/** When saving an edit fails for a reason the API did not explain. */
export const UPDATE_UNAVAILABLE_MESSAGE =
  "Saving the account isn't available right now. Please try again.";

export type TeamAccountsLoadState = 'loading' | 'loaded' | 'failed';

/** Where a Create Account is up to; `idle` until one is sent. */
export type CreateState = 'idle' | 'saving' | 'created' | 'failed';

/** Where an Edit account is up to; `idle` until one is sent. */
export type UpdateState = 'idle' | 'saving' | 'saved' | 'failed';

/** An Edit account to send: whose account, and what it becomes. */
export interface AccountUpdate {
  userId: string;
  request: UpdateAccountRequest;
}

/** By name, then user ID: the API's order. */
function byName(a: UserAccount, b: UserAccount): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/**
 * The message for a refused Create Account or Edit account: the API's own
 * for a wrong field (400), no such account (404) or a conflict (409: a
 * taken user ID, the admin's own account, the last admin), `fallback`
 * otherwise.
 */
function refusalMessage(error: unknown, fallback: string): string {
  if (
    error instanceof HttpErrorResponse &&
    [400, 404, 409].includes(error.status) &&
    typeof error.error?.message === 'string'
  ) {
    return error.error.message;
  }
  return fallback;
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
    updateState: 'idle' as UpdateState,
    /** Why the last Edit account failed; `null` otherwise. */
    updateError: null as string | null,
    /** The last saved edit and what it handed back; `null` until one. */
    updated: null as UpdateAccountResponse | null,
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
                  createError: refusalMessage(
                    error,
                    CREATE_UNAVAILABLE_MESSAGE
                  ),
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
    /**
     * Saves an Edit account. On success the account changes in place
     * straight away; then the list loads again quietly (no loading state),
     * since an edit can also change who else leads a team. A second send
     * while one is saving is ignored.
     */
    update: rxMethod<AccountUpdate>(
      pipe(
        exhaustMap(({ userId, request }) => {
          patchState(store, {
            updateState: 'saving',
            updateError: null,
            updated: null,
          });
          return http
            .put<UpdateAccountResponse>(
              `${TEAM_ACCOUNTS_API}/${encodeURIComponent(userId)}`,
              request
            )
            .pipe(
              tapResponse({
                next: (response) =>
                  patchState(store, setEntity(response.account), {
                    updateState: 'saved',
                    updated: response,
                  }),
                error: (error: unknown) =>
                  patchState(store, {
                    updateState: 'failed',
                    updateError: refusalMessage(
                      error,
                      UPDATE_UNAVAILABLE_MESSAGE
                    ),
                  }),
              }),
              // Only after a save: a refused one completes above.
              switchMap(() => http.get<UserAccount[]>(TEAM_ACCOUNTS_API)),
              tapResponse({
                next: (accounts) => patchState(store, setAllEntities(accounts)),
                // The edited account is already shown; the rest can wait
                // for the next load.
                error: () => undefined,
              })
            );
        })
      )
    ),
    /** Back to no Edit account in progress, as a new form opens. */
    resetUpdate(): void {
      patchState(store, {
        updateState: 'idle',
        updateError: null,
        updated: null,
      });
    },
  })),
  withHooks({
    onInit: (store) => store.load(),
  })
);
