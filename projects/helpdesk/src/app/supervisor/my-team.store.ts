import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type { TeamOverview, TicketDto } from '@helpdesk/contract';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap } from 'rxjs';

/** Where the supervisor's team comes from, through the dev server's proxy. */
export const MY_TEAM_API = '/api/teams/mine';

/** Where one team member's tickets come from. */
export function memberTicketsApi(userId: string): string {
  return `${MY_TEAM_API}/members/${encodeURIComponent(userId)}/tickets`;
}

/** `no-team`: the API found no team this supervisor leads (404). */
export type MyTeamLoadState = 'loading' | 'loaded' | 'no-team' | 'failed';

/** `idle`: no team member chosen yet. */
export type MemberTicketsState = 'idle' | 'loading' | 'loaded' | 'failed';

interface MyTeamState {
  team: TeamOverview | null;
  loadState: MyTeamLoadState;
  /** The team member chosen in the Team member list; `null` until then. */
  selectedMemberId: string | null;
  /** The chosen member's tickets: open work first, then finished. */
  memberTickets: TicketDto[];
  memberTicketsState: MemberTicketsState;
}

/**
 * The signed-in supervisor's team and its workload, for the supervisor
 * page's My team, plus the tickets of the team member the supervisor
 * chooses. Provided by the page, so it lives only while the page is open;
 * the team loads when created.
 */
export const MyTeamStore = signalStore(
  withState<MyTeamState>({
    team: null,
    loadState: 'loading',
    selectedMemberId: null,
    memberTickets: [],
    memberTicketsState: 'idle',
  }),
  withMethods((store, http = inject(HttpClient)) => ({
    /** Loads the team again; a newer load replaces one still running. */
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loadState: 'loading' })),
        switchMap(() =>
          http.get<TeamOverview>(MY_TEAM_API).pipe(
            tapResponse({
              next: (team) => patchState(store, { team, loadState: 'loaded' }),
              error: (error: unknown) =>
                patchState(store, {
                  team: null,
                  loadState:
                    error instanceof HttpErrorResponse && error.status === 404
                      ? 'no-team'
                      : 'failed',
                }),
            })
          )
        )
      )
    ),
    /**
     * Chooses a team member and loads their tickets; `null` chooses nobody,
     * and their tickets go. Any new choice cancels a load still running, so
     * a slow answer never shows tickets for someone no longer chosen.
     */
    selectMember: rxMethod<string | null>(
      pipe(
        tap((userId) =>
          patchState(store, {
            selectedMemberId: userId,
            memberTickets: [],
            memberTicketsState: userId === null ? 'idle' : 'loading',
          })
        ),
        switchMap((userId) =>
          userId === null
            ? EMPTY
            : http.get<TicketDto[]>(memberTicketsApi(userId)).pipe(
                tapResponse({
                  next: (memberTickets) =>
                    patchState(store, {
                      memberTickets,
                      memberTicketsState: 'loaded',
                    }),
                  error: () =>
                    patchState(store, { memberTicketsState: 'failed' }),
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
