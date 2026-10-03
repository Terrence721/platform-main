import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type {
  AssignTicketRequest,
  TeamOverview,
  TicketDto,
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
import { EMPTY, exhaustMap, forkJoin, of, pipe, switchMap, tap } from 'rxjs';

/** Where the supervisor's team comes from, through the dev server's proxy. */
export const MY_TEAM_API = '/api/teams/mine';

/** Where one team member's tickets come from. */
export function memberTicketsApi(userId: string): string {
  return `${MY_TEAM_API}/members/${encodeURIComponent(userId)}/tickets`;
}

/** Where a ticket's assignee is set. */
export function assigneeApi(ticketId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId)}/assignee`;
}

/** When assigning fails for a reason the API did not explain. */
export const ASSIGN_UNAVAILABLE_MESSAGE =
  "Assigning isn't available right now. Please try again.";

/** `no-team`: the API found no team this supervisor leads (404). */
export type MyTeamLoadState = 'loading' | 'loaded' | 'no-team' | 'failed';

/** `idle`: no team member chosen yet. */
export type MemberTicketsState = 'idle' | 'loading' | 'loaded' | 'failed';

/** Where an assignment is up to; `idle` until one is sent. */
export type AssignState = 'idle' | 'saving' | 'assigned' | 'failed';

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
}

/** The API's message for a refused assignment (400, 404, 409), or a general one. */
function assignErrorMessage(error: unknown): string {
  if (
    error instanceof HttpErrorResponse &&
    [400, 404, 409].includes(error.status) &&
    typeof error.error?.message === 'string'
  ) {
    return error.error.message;
  }
  return ASSIGN_UNAVAILABLE_MESSAGE;
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
    assignState: 'idle',
    assignError: null,
    lastAssigned: null,
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
  withMethods((store, http = inject(HttpClient)) => ({
    /**
     * Gives a ticket to an agent on the team (assigning or reassigning).
     * Once done, the team (Unassigned, each member's counts) and the
     * chosen member's tickets are fetched again and swapped in quietly,
     * with no spinner. A second assignment while one is saving is ignored.
     */
    assign: rxMethod<{ ticketId: string; agentId: string }>(
      pipe(
        exhaustMap(({ ticketId, agentId }) => {
          patchState(store, { assignState: 'saving', assignError: null });
          const body: AssignTicketRequest = { assigneeId: agentId };
          return http.put<TicketDto>(assigneeApi(ticketId), body).pipe(
            switchMap((ticket) => {
              const memberId = store.selectedMemberId();
              return forkJoin({
                ticket: of(ticket),
                team: http.get<TeamOverview>(MY_TEAM_API),
                memberTickets:
                  memberId === null
                    ? of(store.memberTickets())
                    : http.get<TicketDto[]>(memberTicketsApi(memberId)),
              });
            }),
            tapResponse({
              next: ({ ticket, team, memberTickets }) =>
                patchState(store, {
                  team,
                  memberTickets,
                  assignState: 'assigned',
                  lastAssigned: ticket,
                }),
              error: (error: unknown) =>
                patchState(store, {
                  assignState: 'failed',
                  assignError: assignErrorMessage(error),
                }),
            })
          );
        })
      )
    ),
  })),
  withHooks({
    onInit: (store) => store.load(),
  })
);
