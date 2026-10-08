import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type {
  AssignTicketRequest,
  ChangeStatusRequest,
  TeamOverview,
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
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  EMPTY,
  exhaustMap,
  filter,
  forkJoin,
  map,
  of,
  pipe,
  switchMap,
  tap,
} from 'rxjs';
import { LiveUpdates } from '../live/live-updates';
import { apiErrorMessage } from '../tickets/api-error-message';
import { assigneeApi, statusApi } from '../tickets/ticket-api-paths';

/** Where the supervisor's team comes from, on the app's own origin. */
export const MY_TEAM_API = '/api/teams/mine';

/** Where one team member's tickets come from. */
export function memberTicketsApi(userId: string): string {
  return `${MY_TEAM_API}/members/${encodeURIComponent(userId)}/tickets`;
}

/** When assigning fails for a reason the API did not explain. */
export const ASSIGN_UNAVAILABLE_MESSAGE =
  "Assigning isn't available right now. Please try again.";

/** When changing a status fails for a reason the API did not explain. */
export const STATUS_UNAVAILABLE_MESSAGE =
  "Changing the status isn't available right now. Please try again.";

/** `no-team`: the API found no team this supervisor leads (404). */
export type MyTeamLoadState = 'loading' | 'loaded' | 'no-team' | 'failed';

/** `idle`: no team member chosen yet. */
export type MemberTicketsState = 'idle' | 'loading' | 'loaded' | 'failed';

/** Where an assignment is up to; `idle` until one is sent. */
export type AssignState = 'idle' | 'saving' | 'assigned' | 'failed';

/** Where a status change is up to; `idle` until one is sent. */
export type StatusState = 'idle' | 'saving' | 'changed' | 'failed';

interface MyTeamState {
  team: TeamOverview | null;
  loadState: MyTeamLoadState;
  /** The team member chosen in the Team member list; `null` until then. */
  selectedMemberId: string | null;
  /** The chosen member's tickets: open work first, then finished. */
  memberTickets: TicketDto[];
  memberTicketsState: MemberTicketsState;
  assignState: AssignState;
  /** Why the last assignment failed; `null` otherwise. */
  assignError: string | null;
  /** The ticket the last assignment gave out, for the page to confirm. */
  lastAssigned: TicketDto | null;
  statusState: StatusState;
  /** Why the last status change failed; `null` otherwise. */
  statusError: string | null;
  /** The ticket whose status last changed, for the page to confirm. */
  lastChanged: TicketDto | null;
}

/**
 * The signed-in supervisor's team and its workload, for the supervisor
 * page's My team, plus the tickets of the team member the supervisor
 * chooses. Provided by the page, so it lives only while the page is open;
 * the team loads when created, and again, quietly, whenever a live update
 * says a ticket or an account changed (#950).
 */
export const MyTeamStore = signalStore(
  withState<MyTeamState>({
    team: null,
    loadState: 'loading',
    selectedMemberId: null,
    memberTickets: [],
    memberTicketsState: 'idle',
    assignState: 'idle',
    assignError: null,
    lastAssigned: null,
    statusState: 'idle',
    statusError: null,
    lastChanged: null,
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
  withMethods((store, http = inject(HttpClient)) => {
    /**
     * Fetches the team and the chosen member's tickets again and swaps
     * them in quietly, with no spinner: after the supervisor's own change,
     * and for a live update (#950), when something changed elsewhere. A
     * member who left the team is no longer chosen; one chosen while it ran
     * keeps their own tickets. A newer refresh replaces one still running;
     * a failed one keeps what is shown, until the next.
     */
    const refresh = rxMethod<void>(
      pipe(
        switchMap(() => {
          const memberId = store.selectedMemberId();
          return http.get<TeamOverview>(MY_TEAM_API).pipe(
            switchMap((team) => {
              const stillOnTeam =
                memberId !== null &&
                team.members.some(({ id }) => id === memberId);
              return forkJoin({
                team: of(team),
                memberTickets: stillOnTeam
                  ? http.get<TicketDto[]>(memberTicketsApi(memberId))
                  : of([]),
                stillOnTeam: of(stillOnTeam),
              });
            }),
            tapResponse({
              next: ({ team, memberTickets, stillOnTeam }) => {
                patchState(store, { team, loadState: 'loaded' });
                if (store.selectedMemberId() !== memberId) {
                  return;
                }
                patchState(
                  store,
                  stillOnTeam
                    ? { memberTickets, memberTicketsState: 'loaded' }
                    : {
                        selectedMemberId: null,
                        memberTickets: [],
                        memberTicketsState: 'idle',
                      }
                );
              },
              error: () => undefined,
            })
          );
        })
      )
    );
    return {
      /**
       * Gives a ticket to an agent on the team (assigning or reassigning).
       * The outcome is the API's answer to the assignment alone; then the
       * team (Unassigned, each member's counts) and the chosen member's
       * tickets are refreshed. A refresh that fails keeps what is shown,
       * and the assignment still stands. A second assignment while one is
       * saving is ignored.
       */
      assign: rxMethod<{ ticketId: string; agentId: string }>(
        pipe(
          exhaustMap(({ ticketId, agentId }) => {
            patchState(store, { assignState: 'saving', assignError: null });
            const body: AssignTicketRequest = { assigneeId: agentId };
            return http.put<TicketDto>(assigneeApi(ticketId), body).pipe(
              tapResponse({
                next: (ticket) => {
                  patchState(store, {
                    assignState: 'assigned',
                    lastAssigned: ticket,
                  });
                  refresh();
                },
                error: (error: unknown) =>
                  patchState(store, {
                    assignState: 'failed',
                    assignError: apiErrorMessage(
                      error,
                      ASSIGN_UNAVAILABLE_MESSAGE
                    ),
                  }),
              })
            );
          })
        )
      ),
      /**
       * Moves a team member's ticket to another status, as the workflow
       * allows. The outcome is the API's answer to the change alone; then
       * what is shown is refreshed, as after assigning. A second change
       * while one is saving is ignored.
       */
      changeStatus: rxMethod<{ ticketId: string; status: TicketStatus }>(
        pipe(
          exhaustMap(({ ticketId, status }) => {
            patchState(store, { statusState: 'saving', statusError: null });
            const body: ChangeStatusRequest = { status };
            return http.put<TicketDto>(statusApi(ticketId), body).pipe(
              tapResponse({
                next: (ticket) => {
                  patchState(store, {
                    statusState: 'changed',
                    lastChanged: ticket,
                  });
                  refresh();
                },
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
      refresh,
    };
  }),
  withHooks({
    onInit: (store, live = inject(LiveUpdates)) => {
      store.load();
      // A ticket changed somewhere, accounts changed (someone may have
      // joined or left the team), or the stream came back after a break:
      // what is shown may be out of date. Replies don't change it.
      store.refresh(
        live.updates.pipe(
          filter(
            (update) =>
              update.kind === 'reconnected' || update.event.type !== 'message'
          ),
          map(() => undefined)
        )
      );
    },
  })
);
